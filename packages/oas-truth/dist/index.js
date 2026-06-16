import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import { NodeHost, compile } from "@typespec/compiler";
import { getOpenAPI3 } from "@typespec/openapi3";
import { schemaToArktype } from "schema-to-library/arktype";
import { schemaToEffect } from "schema-to-library/effect";
import { schemaToTypebox } from "schema-to-library/typebox";
import { schemaToValibot } from "schema-to-library/valibot";
import { schemaToZod } from "schema-to-library/zod";
//#region src/openapi/index.ts
async function parseOpenAPI(input) {
	try {
		if (typeof input === "string" && input.endsWith(".tsp")) {
			const program = await compile(NodeHost, path.resolve(input), { noEmit: true });
			if (program.diagnostics.length) return {
				ok: false,
				error: `TypeSpec compile failed:\n${program.diagnostics.map((d) => d.message).join("\n")}`
			};
			const [record] = await getOpenAPI3(program);
			const tsp = "document" in record ? record.document : record.versions[0].document;
			return {
				ok: true,
				value: await SwaggerParser.bundle(JSON.parse(JSON.stringify(tsp)))
			};
		}
		return {
			ok: true,
			value: await SwaggerParser.bundle(input)
		};
	} catch (e) {
		return {
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		};
	}
}
//#endregion
//#region src/adapter/index.ts
/**
* Widen the rich `Schema` type to a bare JSON-Schema object for schema-to-library.
* `Schema` is not structurally assignable to its `JSONSchema` (e.g. `x-emailPattern`
* literal unions differ), so this `as`-free bridge erases the incompatible members.
*/
function toJsonSchema(schema) {
	return schema;
}
/** Pull the bare expression out of a `export const X = <expr>` wrapper, then strip cross-schema refs. */
function extractExpr(code, stripRefs = (s) => s) {
	const joined = code.split("\n").filter((line) => !line.startsWith("import ")).join("\n").trim();
	const expr = joined.match(/^export const \w+ = (.+)$/s)?.[1];
	if (expr !== void 0) return stripRefs(expr.replace(/;?\s*$/, ""));
	return stripRefs(joined);
}
function makeAdapter(lib) {
	switch (lib) {
		case "zod": return makeZodAdapter();
		case "valibot": return makeValibotAdapter();
		case "arktype": return makeArktypeAdapter();
		case "typebox": return makeTypeboxAdapter();
		case "effect": return makeEffectAdapter();
	}
}
function makeZodAdapter() {
	const stripLazy = (code) => code.replace(/z\.lazy\(\(\)\s*=>\s*(\w+Schema)\)/g, "$1");
	return {
		toExpression(schema, paramIn) {
			return extractExpr(schemaToZod(toJsonSchema(schema), {
				exportType: false,
				openapi: true,
				readonly: false,
				...paramIn && { paramIn }
			}), stripLazy);
		},
		renderImport() {
			return "import * as z from 'zod'";
		},
		renderTypeInfer(constName) {
			return `export type ${constName}=z.infer<typeof ${constName}>`;
		}
	};
}
function makeValibotAdapter() {
	const stripLazy = (code) => code.replace(/v\.lazy\(\(\)\s*=>\s*(\w+Schema)\)/g, "$1");
	return {
		toExpression(schema, paramIn) {
			return extractExpr(schemaToValibot(toJsonSchema(schema), {
				exportType: false,
				openapi: true,
				readonly: false,
				...paramIn && { paramIn }
			}), stripLazy);
		},
		renderImport() {
			return "import * as v from 'valibot'";
		},
		renderTypeInfer(constName) {
			return `export type ${constName}=v.InferOutput<typeof ${constName}>`;
		}
	};
}
function makeArktypeAdapter() {
	return {
		toExpression(schema, paramIn) {
			return extractExpr(schemaToArktype(toJsonSchema(schema), {
				exportType: false,
				openapi: true,
				readonly: false,
				...paramIn && { paramIn }
			}));
		},
		renderImport() {
			return "import { type } from 'arktype'";
		},
		renderTypeInfer(constName) {
			return `export type ${constName}=typeof ${constName}.infer`;
		}
	};
}
function makeTypeboxAdapter() {
	return {
		toExpression(schema, paramIn) {
			return extractExpr(schemaToTypebox(toJsonSchema(schema), {
				exportType: false,
				openapi: true,
				readonly: false,
				...paramIn && { paramIn }
			}));
		},
		renderImport() {
			return "import { Type } from '@sinclair/typebox'";
		},
		renderTypeInfer(constName) {
			return `export type ${constName}=Static<typeof ${constName}>`;
		}
	};
}
function makeEffectAdapter() {
	return {
		toExpression(schema, paramIn) {
			return extractExpr(schemaToEffect(toJsonSchema(schema), {
				exportType: false,
				openapi: true,
				readonly: false,
				...paramIn && { paramIn }
			}));
		},
		renderImport() {
			return "import { Schema } from 'effect'";
		},
		renderTypeInfer(constName) {
			return `export type ${constName}=Schema.Schema.Type<typeof ${constName}>`;
		}
	};
}
//#endregion
//#region src/utils/index.ts
function toPascalCase(str) {
	return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, (_, c) => c.toUpperCase());
}
/**
* Decode percent-encoding, falling back to the raw input on malformed sequences
* (e.g. `%ZZ`, a lone `%`) so a single bad `$ref` never throws and aborts the
* whole generation run.
*/
function safeDecode(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
/**
* Extract the component name from a `$ref`, decoding percent-encoding so the
* result matches the (decoded) key under `components.schemas`. Pure-ASCII refs
* are returned unchanged. Used for component lookup, not variable naming.
*/
function schemaRefToName(ref) {
	const parts = ref.split("/");
	return safeDecode(parts[parts.length - 1] ?? "");
}
/**
* Encode non-ASCII characters as `u<hex codepoint>` so they survive identifier
* normalization instead of collapsing every non-ASCII name to the same value.
*/
function encodeNonAscii(name) {
	return Array.from(name).map((ch) => {
		const cp = ch.codePointAt(0) ?? 0;
		return cp > 127 ? `u${cp.toString(16)}` : ch;
	}).join("");
}
/**
* Convert a name to a valid PascalCase TypeScript identifier. Mirrors
* schema-to-library's `toIdentifierPascalCase` so reference identifiers match
* the component declaration names it emits. Non-ASCII names are encoded
* injectively so distinct names never collide.
*/
function toIdentifierPascalCase(name) {
	const parts = encodeNonAscii(name).split(/[^a-zA-Z0-9]+/).filter(Boolean);
	if (parts.length === 0) return "Schema";
	const result = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
	if (/^[0-9]/.test(result)) return `_${result}`.replace(/([0-9])([a-z])/, (_, d, c) => `${d}${c.toUpperCase()}`);
	return result;
}
/**
* Resolve a `#/components/schemas/...` `$ref` to its generated schema variable
* identifier (`UserSchema`), or `undefined` when the ref does not point at a
* component schema. Shared by ref-resolver and schema-replacements.
*/
function makeSchemaVarName(ref) {
	const name = ref.match(/^#\/components\/schemas\/(.+)$/)?.[1];
	if (name === void 0) return void 0;
	return `${toIdentifierPascalCase(safeDecode(name))}Schema`;
}
/**
* Encode a property key for object-literal output: bare identifiers stay
* unquoted, everything else is JSON-encoded so hyphenated/reserved/numeric
* keys (e.g. `X-Request-ID`) emit as valid TypeScript.
*/
function makeSafeKey(key) {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}
/** Narrow an unknown value to a plain object (excludes arrays and null). */
function isRecord(v) {
	return v !== null && typeof v === "object" && !Array.isArray(v);
}
//#endregion
//#region src/helper/ref-resolver.ts
function valueToCode(value, codeReplacements) {
	return encodeValue(value, codeReplacements, /* @__PURE__ */ new Set());
}
function encodeValue(value, codeReplacements, seen) {
	const replacement = codeReplacements?.get(value);
	if (replacement !== void 0) return replacement;
	if (value === null) return "null";
	if (value === void 0) return "undefined";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
	if (typeof value === "boolean") return String(value);
	if (typeof value === "bigint") return value.toString();
	if (Array.isArray(value)) {
		if (seen.has(value)) return "null";
		seen.add(value);
		const code = `[${value.map((v) => encodeValue(v, codeReplacements, seen)).join(",")}]`;
		seen.delete(value);
		return code;
	}
	if (isRecord(value)) {
		if (seen.has(value)) return "null";
		if ("$ref" in value && typeof value.$ref === "string") {
			const varName = makeSchemaVarName(value.$ref);
			if (varName) return varName;
		}
		seen.add(value);
		const entries = Object.entries(value).map(([k, v]) => {
			return `${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k)}:${encodeValue(v, codeReplacements, seen)}`;
		});
		seen.delete(value);
		return `{${entries.join(",")}}`;
	}
	return "null";
}
//#endregion
//#region src/helper/schema-replacements.ts
function isInlineSchema(value) {
	if (!isRecord(value)) return false;
	if ("$ref" in value) return false;
	return "type" in value || "properties" in value || "items" in value || "oneOf" in value || "anyOf" in value || "allOf" in value || "enum" in value || "const" in value || "not" in value;
}
function makeSchemaReplacements(value, adapter) {
	return new Map(makeEntries(value, adapter, /* @__PURE__ */ new Set()));
}
function makeEntries(v, adapter, seen, parentKey) {
	if (v === null || v === void 0 || typeof v !== "object") return [];
	if (seen.has(v)) return [];
	const wrap = adapter.wrapSchema ?? ((expr) => expr);
	if (parentKey === "schema") {
		if (isInlineSchema(v)) return [[v, wrap(adapter.toExpression(v))]];
		if (isRecord(v) && typeof v.$ref === "string") {
			const varName = makeSchemaVarName(v.$ref);
			if (varName) return [[v, wrap(varName)]];
		}
	}
	seen.add(v);
	const entries = Array.isArray(v) ? v.flatMap((item) => makeEntries(item, adapter, seen)) : isRecord(v) ? Object.entries(v).flatMap(([k, child]) => makeEntries(child, adapter, seen, k)) : [];
	seen.delete(v);
	return entries;
}
//#endregion
//#region src/generator/components/callbacks.ts
function makeCallbacksCode(components, adapter, readonly) {
	const { callbacks } = components;
	if (!callbacks) return "";
	const entries = Object.entries(callbacks);
	if (entries.length === 0) return "";
	const asConst = readonly ? " as const" : "";
	const exports = entries.filter(([, callback]) => !("$ref" in callback && callback.$ref)).map(([name, callback]) => {
		return `export const ${`${toIdentifierPascalCase(name)}Callback`}=${valueToCode(callback, makeSchemaReplacements(callback, adapter))}${asConst}`;
	}).filter(Boolean);
	if (exports.length === 0) return "";
	return exports.join(";");
}
//#endregion
//#region src/generator/components/examples.ts
function makeExamplesCode(components, readonly) {
	const { examples } = components;
	if (!examples) return "";
	const entries = Object.entries(examples);
	if (entries.length === 0) return "";
	const asConst = readonly ? " as const" : "";
	return `${entries.map(([name, example]) => {
		return `export const ${`${toIdentifierPascalCase(name)}Example`}=${valueToCode(example)}${asConst}`;
	}).join(";")}\n`;
}
//#endregion
//#region src/generator/components/headers.ts
function makeHeadersCode(components, adapter, exportTypes) {
	const { headers } = components;
	if (!headers) return "";
	const entries = Object.entries(headers);
	if (entries.length === 0) return "";
	const imports = adapter.renderImport();
	const exports = entries.map(([name, header]) => {
		if (!("schema" in header) || !header.schema) return "";
		const constName = `${toIdentifierPascalCase(name)}HeaderSchema`;
		return `export const ${constName}=${adapter.toExpression(header.schema)}${exportTypes ? `\n\n${adapter.renderTypeInfer(constName)}` : ""}`;
	}).filter(Boolean).join(";");
	return exports ? `${imports}\n\n${exports}\n` : "";
}
//#endregion
//#region src/generator/components/links.ts
function makeLinksCode(components, readonly) {
	const { links } = components;
	if (!links) return "";
	const entries = Object.entries(links);
	if (entries.length === 0) return "";
	const asConst = readonly ? " as const" : "";
	return `${entries.map(([name, link]) => {
		return `export const ${`${toIdentifierPascalCase(name)}Link`}=${valueToCode(link)}${asConst}`;
	}).join(";")}\n`;
}
//#endregion
//#region src/generator/components/parameters.ts
function makeParametersCode(components, adapter, exportTypes) {
	const { parameters } = components;
	if (!parameters) return "";
	const entries = Object.entries(parameters);
	if (entries.length === 0) return "";
	const imports = adapter.renderImport();
	const exports = entries.map(([name, param]) => {
		if (!param.schema) return "";
		const paramIn = param.in === "query" || param.in === "path" ? param.in : void 0;
		const constName = `${toIdentifierPascalCase(name)}ParamsSchema`;
		return `export const ${constName}=${adapter.toExpression(param.schema, paramIn)}${exportTypes ? `\n\n${adapter.renderTypeInfer(constName)}` : ""}`;
	}).filter(Boolean).join(";");
	return exports ? `${imports}\n\n${exports}\n` : "";
}
//#endregion
//#region src/generator/components/path-items.ts
function makePathItemsCode(components, adapter, readonly) {
	const { pathItems } = components;
	if (!pathItems) return "";
	const entries = Object.entries(pathItems);
	if (entries.length === 0) return "";
	const asConst = readonly ? " as const" : "";
	const exports = entries.map(([name, pathItem]) => {
		return `export const ${`${toIdentifierPascalCase(name)}PathItem`}=${valueToCode(pathItem, makeSchemaReplacements(pathItem, adapter))}${asConst}`;
	}).filter(Boolean);
	if (exports.length === 0) return "";
	return exports.join(";");
}
//#endregion
//#region src/generator/components/request-bodies.ts
function makeRequestBodiesCode(components, adapter, readonly) {
	const { requestBodies } = components;
	if (!requestBodies) return "";
	const entries = Object.entries(requestBodies);
	if (entries.length === 0) return "";
	const asConst = readonly ? " as const" : "";
	const exports = entries.map(([name, body]) => {
		return `export const ${`${toIdentifierPascalCase(name)}RequestBody`}=${valueToCode(body, makeSchemaReplacements(body, adapter))}${asConst}`;
	}).filter(Boolean);
	if (exports.length === 0) return "";
	return exports.join(";");
}
//#endregion
//#region src/generator/components/responses.ts
function makeResponsesCode(components, adapter, readonly) {
	const { responses } = components;
	if (!responses) return "";
	const entries = Object.entries(responses);
	if (entries.length === 0) return "";
	const asConst = readonly ? " as const" : "";
	const exports = entries.filter(([, response]) => !("$ref" in response && response.$ref)).map(([name, response]) => {
		return `export const ${`${toIdentifierPascalCase(name)}Response`}=${valueToCode(response, makeSchemaReplacements(response, adapter))}${asConst}`;
	}).filter(Boolean);
	if (exports.length === 0) return "";
	return exports.join(";");
}
//#endregion
//#region src/generator/components/security-schemes.ts
function makeSecuritySchemesCode(components, readonly) {
	const { securitySchemes } = components;
	if (!securitySchemes) return "";
	const entries = Object.entries(securitySchemes);
	if (entries.length === 0) return "";
	const asConst = readonly ? " as const" : "";
	return `${entries.map(([name, scheme]) => {
		return `export const ${`${toIdentifierPascalCase(name)}SecurityScheme`}=${valueToCode(scheme)}${asConst}`;
	}).join(";")}\n`;
}
//#endregion
export { isRecord, makeAdapter, makeCallbacksCode, makeExamplesCode, makeHeadersCode, makeLinksCode, makeParametersCode, makePathItemsCode, makeRequestBodiesCode, makeResponsesCode, makeSafeKey, makeSchemaReplacements, makeSecuritySchemesCode, parseOpenAPI, schemaRefToName, toIdentifierPascalCase, toPascalCase, valueToCode };
