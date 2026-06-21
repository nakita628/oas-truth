import SwaggerParser from "@apidevtools/swagger-parser";

//#region src/openapi/index.d.ts
declare function parseOpenAPI(input: string): Promise<{
  readonly ok: true;
  readonly value: OpenAPI;
  readonly error?: never;
} | {
  readonly ok: false;
  readonly error: string;
  readonly value?: never;
}>;
type BaseOpenAPI = Awaited<ReturnType<typeof SwaggerParser.bundle>>;
type OpenAPI = BaseOpenAPI & {
  readonly openapi?: string;
  readonly $self?: string;
  readonly info?: {
    readonly title?: string;
    readonly summary?: string;
    readonly description?: string;
    readonly termsOfService?: string;
    readonly contact?: {
      readonly name?: string;
      readonly url?: string;
      readonly email?: string;
    };
    readonly license?: {
      readonly name?: string;
      readonly identifier?: string;
      readonly url?: string;
    };
    readonly version?: string;
  };
  readonly jsonSchemaDialect?: string;
  readonly servers?: readonly Server[];
  readonly paths: PathItem;
  readonly webhooks?: {
    readonly [k: string]: PathItem;
  };
  readonly components?: Components;
  readonly security?: readonly {
    readonly [k: string]: readonly string[];
  }[];
  readonly tags?: {
    readonly name: string;
    readonly summary?: string;
    readonly description?: string;
    readonly externalDocs?: ExternalDocs;
    readonly parent?: string;
    readonly kind?: string;
  }[];
  readonly externalDocs?: ExternalDocs;
} & {
  paths: OpenAPIPaths;
};
type Components = {
  readonly schemas?: {
    readonly [k: string]: Schema;
  };
  readonly responses?: {
    readonly [k: string]: Responses;
  };
  readonly parameters?: {
    readonly [k: string]: Parameter;
  };
  readonly examples?: {
    readonly [k: string]: {
      readonly summary?: string;
      readonly description?: string;
      readonly dataValue?: unknown;
      readonly serializedValue?: string;
      readonly externalValue?: string;
      readonly value?: unknown;
    } | Reference;
  };
  readonly requestBodies?: {
    readonly [k: string]: RequestBody;
  };
  readonly headers?: {
    readonly [k: string]: Header | Reference;
  };
  readonly securitySchemes?: {
    readonly [k: string]: {
      readonly type?: string;
      readonly description?: string;
      readonly name?: string;
      readonly in?: string;
      readonly scheme?: string;
      readonly bearerFormat?: string;
      readonly flows?: OAuthFlow;
      readonly password?: OAuthFlow;
      readonly clientCredentials?: OAuthFlow;
      readonly authorizationCode?: OAuthFlow;
      readonly deviceAuthorization?: OAuthFlow;
      readonly openIdConnectUrl?: string;
      readonly oauth2MetadataUrl?: string;
      readonly deprecated?: boolean;
    } | Reference;
  };
  readonly links?: {
    readonly [k: string]: Link | Reference;
  };
  readonly callbacks?: {
    readonly [k: string]: Callbacks | Reference;
  };
  readonly pathItems?: {
    readonly [k: string]: PathItem;
  };
  readonly mediaTypes?: {
    readonly [k: string]: Media | Reference;
  };
};
type OAuthFlow = {
  readonly implicit?: {
    readonly authorizationUrl: string;
    readonly deviceAuthorizationUrl: string;
    readonly tokenUrl: string;
    readonly refreshUrl: string;
    readonly scopes: {
      readonly [k: string]: string;
    };
  };
};
type OpenAPIPaths = { readonly [P in keyof NonNullable<BaseOpenAPI['paths']>]: PathItem };
type Type = 'string' | 'number' | 'integer' | 'date' | 'boolean' | 'array' | 'object' | 'null';
type Format = FormatString | FormatNumber;
type FormatString = 'email' | 'uuid' | 'uuidv4' | 'uuidv6' | 'uuidv7' | 'url' | 'uri' | 'httpUrl' | 'hostname' | 'hex' | 'jwt' | 'emoji' | 'base64' | 'base64url' | 'nanoid' | 'cuid' | 'cuid2' | 'ulid' | 'ipv4' | 'ipv6' | 'cidrv4' | 'cidrv6' | 'date' | 'time' | 'date-time' | 'duration' | 'binary' | 'byte' | 'password' | 'mac' | 'hash' | 'e164' | 'guid' | 'toLowerCase' | 'toUpperCase' | 'trim';
type FormatNumber = 'int32' | 'int64' | 'bigint' | 'float' | 'float32' | 'float64' | 'double' | 'password';
type Ref = `#/components/schemas/${string}` | `#/components/responses/${string}` | `#/components/parameters/${string}` | `#/components/examples/${string}` | `#/components/requestBodies/${string}` | `#/components/headers/${string}` | `#/components/securitySchemes/${string}` | `#/components/links/${string}` | `#/components/callbacks/${string}` | `#/components/pathItems/${string}` | `#/components/mediaTypes/${string}`;
type Server = {
  readonly url: string;
  readonly description?: string;
  readonly name?: string;
  readonly variables?: {
    readonly [k: string]: {
      readonly enum?: readonly string[];
      readonly default?: string;
      readonly description?: string;
    };
  };
};
type Header = {
  readonly description?: string;
  readonly required?: boolean;
  readonly deprecated?: boolean;
  readonly example?: unknown;
  readonly examples?: {
    readonly [k: string]: {
      readonly summary?: string;
      readonly description?: string;
      readonly defaultValue?: unknown;
      readonly serializedValue?: string;
      readonly externalValue?: string;
      readonly value?: unknown;
    } | Reference;
  };
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: Schema;
  content?: Content;
};
type Link = {
  readonly operationRef?: string;
  readonly operationId?: string;
  readonly parameters?: {
    readonly [k: string]: unknown;
  };
  readonly requestBody?: unknown;
  readonly description?: string;
  readonly server?: Server;
};
type Reference = {
  readonly $ref?: Ref;
  readonly summary?: string;
  readonly description?: string;
};
type Encoding = {
  readonly contentType?: string;
  readonly headers?: {
    readonly [k: string]: Header | Reference;
  };
  readonly encoding?: {
    readonly [k: string]: Encoding;
  };
  readonly prefixEncoding?: Encoding;
  readonly itemEncoding?: Encoding;
};
type Content = {
  readonly [k: string]: Media;
};
type PathItem = {
  readonly $ref?: Ref;
  readonly summary?: string;
  readonly description?: string;
  readonly get?: Operation;
  readonly put?: Operation;
  readonly post?: Operation;
  readonly delete?: Operation;
  readonly options?: Operation;
  readonly head?: Operation;
  readonly patch?: Operation;
  readonly trace?: Operation;
  readonly query?: Operation;
  readonly additionalOperations?: {
    readonly [k: string]: Operation;
  };
  readonly servers?: readonly Server[];
  readonly parameters?: readonly (Parameter | Reference)[];
};
type Operation = {
  readonly tags?: readonly string[];
  readonly summary?: string;
  readonly description?: string;
  readonly externalDocs?: {
    readonly description?: string;
    readonly url: string;
  };
  readonly operationId?: string;
  readonly parameters?: readonly (Parameter | Reference)[];
  readonly requestBody?: RequestBody | Reference;
  readonly responses: {
    readonly [k: string]: Responses;
  };
  readonly callbacks?: {
    readonly [k: string]: {
      readonly $ref?: string;
      readonly summary?: string;
      readonly description?: string;
    };
  };
  readonly deprecated?: boolean;
  readonly security?: readonly {
    readonly [scheme: string]: readonly string[];
  }[];
  readonly servers?: readonly {
    readonly url: string;
    readonly description?: string;
    readonly variables?: {
      readonly [k: string]: {
        readonly enum?: readonly string[];
        readonly default?: string;
        readonly description?: string;
      };
    };
  }[];
  readonly 'x-pagination'?: boolean;
};
type Responses = {
  readonly $ref?: Ref;
  readonly summary?: string;
  readonly description?: string;
  readonly content?: Content;
  readonly headers?: {
    readonly [k: string]: Header | Reference;
  };
  readonly links?: {
    readonly [k: string]: Link | Reference;
  };
};
type Discriminator = {
  readonly propertyName?: string;
  readonly mapping?: {
    readonly [k: string]: string;
  };
  readonly defaultMapping?: string;
};
type ExternalDocs = {
  readonly url: string;
  readonly description?: string;
};
type Schema = {
  readonly discriminator?: Discriminator;
  readonly xml?: {
    readonly nodeType?: string;
    readonly name?: string;
    readonly namespace?: string;
    readonly prefix?: string;
    readonly attribute?: boolean;
    readonly wrapped?: boolean;
  };
  readonly externalDocs?: ExternalDocs;
  readonly example?: unknown;
  readonly examples?: {
    readonly [k: string]: {
      readonly summary?: string;
      readonly description?: string;
      readonly defaultValue?: unknown;
      readonly serializedValue?: string;
      readonly externalValue?: string;
      readonly value?: unknown;
    } | Reference;
  };
  readonly title?: string;
  readonly name?: string;
  readonly description?: string;
  readonly type?: Type | [Type, ...Type[]];
  readonly format?: Format;
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number | boolean;
  readonly exclusiveMaximum?: number | boolean;
  readonly multipleOf?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly minProperties?: number;
  readonly maxProperties?: number;
  readonly default?: unknown;
  readonly properties?: {
    readonly [k: string]: Schema;
  };
  readonly required?: readonly string[];
  /**
   * JSON Schema 2020-12 §10.3.1.2: `items` may be a schema, a tuple of schemas
   * (Draft-04 compat), or a boolean schema (`true` = any item allowed,
   * `false` = no trailing items / length cap). Boolean form is exercised when
   * paired with `prefixItems` to enforce a strict tuple shape.
   */
  readonly items?: Schema | readonly Schema[] | boolean; /** JSON Schema 2020-12: Tuple validation */
  readonly prefixItems?: readonly Schema[];
  readonly enum?: readonly (string | number | boolean | null | readonly (string | number | boolean | null)[])[];
  readonly nullable?: boolean;
  readonly readOnly?: boolean;
  readonly writeOnly?: boolean;
  readonly deprecated?: boolean;
  readonly additionalProperties?: Schema | boolean;
  readonly $ref?: Ref;
  readonly oneOf?: readonly Schema[];
  readonly allOf?: readonly Schema[];
  readonly anyOf?: readonly Schema[];
  readonly not?: Schema;
  readonly const?: unknown;
  readonly patternProperties?: {
    readonly [k: string]: Schema;
  };
  readonly propertyNames?: Schema;
  readonly dependentRequired?: {
    readonly [k: string]: readonly string[];
  };
  readonly 'x-error-message'?: string;
  readonly 'x-length-message'?: string;
  readonly 'x-pattern-message'?: string;
  readonly 'x-minimum-message'?: string;
  readonly 'x-maximum-message'?: string;
  readonly 'x-exclusiveMinimum-message'?: string;
  readonly 'x-exclusiveMaximum-message'?: string;
  readonly 'x-multipleOf-message'?: string;
  readonly 'x-dependentRequired-message'?: string;
  readonly 'x-dependentSchemas-message'?: string;
  readonly 'x-propertyNames-message'?: string;
  readonly 'x-allOf-message'?: string;
  readonly 'x-anyOf-message'?: string;
  readonly 'x-oneOf-message'?: string;
  readonly 'x-not-message'?: string;
  readonly 'x-implication-message'?: string;
  readonly 'x-required-message'?: string;
  readonly 'x-additionalProperties-message'?: string;
  readonly 'x-uniqueItems-message'?: string;
  readonly 'x-const-message'?: string;
  readonly 'x-enum-message'?: string;
  readonly 'x-minLength-message'?: string;
  readonly 'x-maxLength-message'?: string;
  readonly 'x-minItems-message'?: string;
  readonly 'x-maxItems-message'?: string;
  readonly 'x-minProperties-message'?: string;
  readonly 'x-maxProperties-message'?: string;
  readonly 'x-patternProperties-message'?: string;
  readonly 'x-contains-message'?: string;
  readonly 'x-minContains-message'?: string;
  readonly 'x-maxContains-message'?: string;
  readonly 'x-properties-message'?: string;
  readonly 'x-prefixItems-message'?: string;
  readonly 'x-items-message'?: string;
  readonly 'x-unevaluatedProperties-message'?: string;
  readonly 'x-unevaluatedItems-message'?: string;
  readonly 'x-if-message'?: string;
  readonly 'x-then-message'?: string;
  readonly 'x-else-message'?: string;
  readonly $comment?: string;
  readonly contains?: Schema;
  readonly minContains?: number;
  readonly maxContains?: number;
  readonly contentEncoding?: 'base64' | 'base64url' | 'binary' | '7bit' | '8bit' | 'quoted-printable';
  readonly contentMediaType?: string;
  readonly contentSchema?: Schema;
  readonly dependentSchemas?: {
    readonly [k: string]: Schema;
  };
  readonly if?: Schema;
  readonly then?: Schema;
  readonly else?: Schema;
  readonly unevaluatedProperties?: boolean | Schema;
  readonly unevaluatedItems?: boolean | Schema;
  readonly $schema?: string;
  readonly $id?: string;
  readonly $anchor?: string;
  readonly $dynamicAnchor?: string;
  readonly $dynamicRef?: string;
  readonly $vocabulary?: {
    readonly [k: string]: boolean;
  };
  readonly $defs?: {
    readonly [k: string]: Schema;
  };
  readonly 'x-brand'?: string;
  readonly 'x-trim'?: boolean;
  readonly 'x-toLowerCase'?: boolean;
  readonly 'x-toUpperCase'?: boolean;
  readonly 'x-lowercase'?: boolean;
  readonly 'x-uppercase'?: boolean;
  readonly 'x-normalize'?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
  readonly 'x-coerce'?: boolean;
  readonly 'x-stringbool'?: true | {
    readonly truthy?: readonly string[];
    readonly falsy?: readonly string[];
    readonly case?: 'sensitive' | 'insensitive';
  };
  readonly 'x-emailPattern'?: 'html5' | 'rfc5322' | 'unicode';
  readonly 'x-emailRegex'?: string;
  readonly 'x-uuidVersion'?: 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7' | 'v8';
  readonly 'x-urlHostname'?: string;
  readonly 'x-urlProtocol'?: string;
  readonly 'x-urlNormalize'?: boolean;
  readonly 'x-isoPrecision'?: number;
  readonly 'x-isoOffset'?: boolean;
  readonly 'x-isoLocal'?: boolean;
  readonly 'x-macDelimiter'?: string;
  readonly 'x-jwtAlg'?: string;
  readonly 'x-hashAlg'?: 'sha1' | 'sha256' | 'sha384' | 'sha512' | 'md5';
  readonly 'x-hashEnc'?: 'hex' | 'base64' | 'base64url';
  readonly 'x-catch'?: unknown;
  readonly 'x-prefault'?: unknown;
  readonly 'x-readonly'?: boolean;
  readonly 'x-includes'?: string;
  readonly 'x-startsWith'?: string;
  readonly 'x-endsWith'?: string;
  readonly 'x-refine'?: string;
  readonly 'x-superRefine'?: string;
  readonly 'x-codec'?: string;
  readonly 'x-preprocess'?: string;
  readonly 'x-transform'?: string;
  readonly 'x-pipe'?: string;
};
type Parameter = {
  readonly $ref?: Ref;
  readonly name: string;
  readonly in: 'path' | 'query' | 'header' | 'cookie';
  readonly description?: string;
  readonly required?: boolean;
  readonly deprecated?: boolean;
  readonly allowEmptyValue?: boolean;
  readonly style?: string;
  readonly explode?: boolean;
  readonly allowReserved?: boolean;
  readonly schema?: Schema;
  readonly content?: Content;
  readonly example?: unknown;
  readonly examples?: {
    readonly [k: string]: {
      readonly summary?: string;
      readonly description?: string;
      readonly defaultValue?: unknown;
      readonly serializedValue?: string;
      readonly externalValue?: string;
      readonly value?: unknown;
    } | Reference;
  };
};
type RequestBody = {
  readonly description?: string;
  readonly content?: {
    readonly [k: string]: Media | Reference;
  };
  readonly required?: boolean;
};
type Media = {
  readonly schema: Schema;
  readonly itemSchema?: Schema;
  readonly example?: unknown;
  readonly examples?: {
    readonly [k: string]: {
      readonly summary?: string;
      readonly description?: string;
      readonly defaultValue?: unknown;
      readonly serializedValue?: string;
      readonly externalValue?: string;
      readonly value?: unknown;
    } | Reference;
  };
  readonly encoding?: {
    readonly [k: string]: Encoding;
  };
  readonly prefixEncoding?: Encoding;
  readonly itemEncoding?: Encoding;
};
type Callbacks = {
  readonly [k: string]: PathItem;
};
//#endregion
//#region src/adapter/index.d.ts
type ParamIn = 'query' | 'path';
type SchemaLib = 'zod' | 'valibot' | 'arktype' | 'effect' | 'typebox';
/**
 * The minimal surface the component generators consume from a validator
 * adapter. Each library's full adapter (carrying `toNamedExport`,
 * `annotateCyclic`, `objectField`, … for schema/contract generation) is a
 * structural supertype, so it can be passed wherever a `ComponentAdapter` is
 * required without a cast.
 *
 * `wrapSchema` is an optional host hook applied to every `schema:` slot
 * expression (inline and `$ref` alike). A host that needs to transform the
 * expression — e.g. hono-openapi wrapping it in `resolver(...)` — supplies it;
 * omitting it leaves the expression untouched (identity), so the shared library
 * stays framework-agnostic.
 */
type ComponentAdapter = {
  readonly renderImport: () => string;
  readonly toExpression: (schema: Schema, paramIn?: ParamIn) => string;
  readonly renderTypeInfer: (constName: string) => string;
  readonly wrapSchema?: (expr: string) => string;
};
declare function makeAdapter(lib: SchemaLib): ComponentAdapter;
//#endregion
//#region src/helper/ref-resolver.d.ts
declare function valueToCode(value: unknown, codeReplacements?: ReadonlyMap<unknown, string>): string;
//#endregion
//#region src/helper/schema-replacements.d.ts
declare function makeSchemaReplacements(value: unknown, adapter: ComponentAdapter): ReadonlyMap<unknown, string>;
//#endregion
//#region src/utils/index.d.ts
declare function toPascalCase(str: string): string;
/**
 * Extract the component name from a `$ref`, decoding percent-encoding so the
 * result matches the (decoded) key under `components.schemas`. Pure-ASCII refs
 * are returned unchanged. Used for component lookup, not variable naming.
 */
declare function schemaRefToName(ref: string): string;
/**
 * Convert a name to a valid PascalCase TypeScript identifier. Mirrors
 * schema-to-library's `toIdentifierPascalCase` so reference identifiers match
 * the component declaration names it emits. Non-ASCII names are encoded
 * injectively so distinct names never collide.
 */
declare function toIdentifierPascalCase(name: string): string;
/**
 * Encode a property key for object-literal output: bare identifiers stay
 * unquoted, everything else is JSON-encoded so hyphenated/reserved/numeric
 * keys (e.g. `X-Request-ID`) emit as valid TypeScript.
 */
declare function makeSafeKey(key: string): string;
/** Narrow an unknown value to a plain object (excludes arrays and null). */
declare function isRecord(v: unknown): v is {
  readonly [k: string]: unknown;
};
//#endregion
//#region src/generator/components/callbacks.d.ts
declare function makeCallbacksCode(components: Components, adapter: ComponentAdapter, readonly: boolean): string;
//#endregion
//#region src/generator/components/examples.d.ts
declare function makeExamplesCode(components: Components, readonly: boolean): string;
//#endregion
//#region src/generator/components/headers.d.ts
declare function makeHeadersCode(components: Components, adapter: ComponentAdapter, exportTypes?: boolean): string;
//#endregion
//#region src/generator/components/links.d.ts
declare function makeLinksCode(components: Components, readonly: boolean): string;
//#endregion
//#region src/generator/components/parameters.d.ts
declare function makeParametersCode(components: Components, adapter: ComponentAdapter, exportTypes?: boolean): string;
//#endregion
//#region src/generator/components/path-items.d.ts
declare function makePathItemsCode(components: Components, adapter: ComponentAdapter, readonly: boolean): string;
//#endregion
//#region src/generator/components/request-bodies.d.ts
declare function makeRequestBodiesCode(components: Components, adapter: ComponentAdapter, readonly: boolean): string;
//#endregion
//#region src/generator/components/responses.d.ts
declare function makeResponsesCode(components: Components, adapter: ComponentAdapter, readonly: boolean): string;
//#endregion
//#region src/generator/components/security-schemes.d.ts
declare function makeSecuritySchemesCode(components: Components, readonly: boolean): string;
//#endregion
export { Callbacks, ComponentAdapter, Components, Content, Encoding, Format, FormatNumber, FormatString, Header, Link, Media, OpenAPI, OpenAPIPaths, Operation, ParamIn, Parameter, PathItem, Ref, Reference, RequestBody, Responses, Schema, SchemaLib, Type, isRecord, makeAdapter, makeCallbacksCode, makeExamplesCode, makeHeadersCode, makeLinksCode, makeParametersCode, makePathItemsCode, makeRequestBodiesCode, makeResponsesCode, makeSafeKey, makeSchemaReplacements, makeSecuritySchemesCode, parseOpenAPI, schemaRefToName, toIdentifierPascalCase, toPascalCase, valueToCode };