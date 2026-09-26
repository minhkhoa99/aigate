import { isRecord, type Json } from "../json.js";

// The tool-schema cleaner of translator.openai-to-gemini-request (9router cleanJSONSchemaForAntigravity), corrected by
// user decision (2026-09-26): it walks schema positions only, so a parameter named like a keyword ("title", "format",
// "const", …) keeps its place in `properties`, and it never adds a required "reason" parameter to an empty object.

// Keywords the Gemini schema proto has no field for (9router's list, kept whole).
const UNSUPPORTED = new Set([
  "minLength", "maxLength", "exclusiveMinimum", "exclusiveMaximum", "minItems", "maxItems", "format", "multipleOf",
  "uniqueItems", "contains", "unevaluatedProperties", "unevaluatedItems", "contentSchema", "prefixItems", "additionalItems",
  "default", "examples", "$schema", "$defs", "definitions", "const", "$ref", "$comment", "deprecated", "readOnly", "writeOnly",
  "additionalProperties", "propertyNames", "patternProperties", "enumDescriptions", "anyOf", "oneOf", "allOf", "not",
  "dependencies", "dependentSchemas", "dependentRequired", "title", "optional", "if", "then", "else", "contentMediaType",
  "contentEncoding", "cornerRadius", "fillColor", "fontFamily", "fontSize", "fontWeight", "gap", "padding", "strokeColor",
  "strokeThickness", "textColor",
]);
// ponytail: recursion bounded by depth, so a hostile or cyclic-looking schema cannot exhaust the stack.
const MAX_DEPTH = 64;

// The subschemas of a schema node, read after `fn` has changed the node.
function children(node: Json): Json[] {
  const out: Json[] = [];
  if (isRecord(node.properties)) for (const value of Object.values(node.properties)) if (isRecord(value)) out.push(value);
  for (const key of ["items", "anyOf", "oneOf", "allOf", "prefixItems"]) {
    const value = node[key];
    if (isRecord(value)) out.push(value);
    else if (Array.isArray(value)) for (const item of value) if (isRecord(item)) out.push(item);
  }
  return out;
}

function eachSchema(node: Json, fn: (node: Json) => void, depth = 0): void {
  if (depth > MAX_DEPTH) return;
  fn(node);
  for (const child of children(node)) eachSchema(child, fn, depth + 1);
}

function constToEnum(node: Json): void {
  if (node.const !== undefined && node.enum === undefined) {
    node.enum = [node.const];
    delete node.const;
  }
}

// Gemini wants string enum values and an explicit type.
function enumToStrings(node: Json): void {
  if (!Array.isArray(node.enum)) return;
  node.enum = node.enum.map((value) => String(value));
  if (node.type === undefined) node.type = "string";
}

function mergeAllOf(node: Json): void {
  if (!Array.isArray(node.allOf)) return;
  const properties: Json = {};
  const required: unknown[] = [];
  for (const item of node.allOf) {
    if (!isRecord(item)) continue;
    if (isRecord(item.properties)) Object.assign(properties, item.properties);
    if (Array.isArray(item.required)) for (const name of item.required) if (!required.includes(name)) required.push(name);
  }
  delete node.allOf;
  if (Object.keys(properties).length > 0) node.properties = { ...(isRecord(node.properties) ? node.properties : {}), ...properties };
  if (required.length > 0) node.required = [...(Array.isArray(node.required) ? node.required : []), ...required];
}

function prefixItemsToItems(node: Json): void {
  if (!Array.isArray(node.prefixItems) || node.prefixItems.length === 0) return;
  const variants = node.prefixItems.filter((item) => isRecord(item) && item.type !== "null");
  if (node.items === undefined && variants.length === 1) node.items = variants[0];
  else if (node.items === undefined && variants.length > 1) node.items = { anyOf: variants };
  delete node.prefixItems;
}

// The richest branch wins: object, then array, then any other non-null type.
function score(item: Json): number {
  if (item.type === "object" || item.properties !== undefined) return 3;
  if (item.type === "array" || item.items !== undefined) return 2;
  return typeof item.type === "string" && item.type !== "null" ? 1 : 0;
}

function flattenUnion(node: Json): void {
  for (const key of ["anyOf", "oneOf"]) {
    const branches = node[key];
    if (!Array.isArray(branches)) continue;
    const candidates = branches.filter((item): item is Json => isRecord(item) && item.type !== "null");
    if (candidates.length === 0) continue;
    let best = candidates[0];
    for (const item of candidates) if (score(item) > score(best ?? {})) best = item;
    delete node[key];
    Object.assign(node, best);
  }
}

function flattenTypeArray(node: Json): void {
  if (!Array.isArray(node.type)) return;
  const types = node.type.filter((type) => type !== "null");
  node.type = types.length > 0 ? types[0] : "string";
}

function inferTypes(node: Json): void {
  if (node.properties !== undefined && node.type === undefined) node.type = "object";
  if (node.type === "array" && node.items === undefined) node.items = { type: "string" };
}

function removeUnsupported(node: Json): void {
  for (const key of Object.keys(node)) if (UNSUPPORTED.has(key) || key.startsWith("x-")) delete node[key];
}

function pruneRequired(node: Json): void {
  if (!Array.isArray(node.required) || !isRecord(node.properties)) return;
  const properties = node.properties;
  const kept = node.required.filter((name) => typeof name === "string" && Object.hasOwn(properties, name));
  if (kept.length === 0) delete node.required;
  else node.required = kept;
}

// Returns undefined for an object schema without properties, so the declaration is sent without parameters.
export function cleanGeminiSchema(input: Readonly<Record<string, unknown>> | undefined): Json | undefined {
  const schema: Json = input === undefined ? { type: "object", properties: {} } : structuredClone({ ...input });
  for (const phase of [constToEnum, enumToStrings, mergeAllOf, prefixItemsToItems, flattenUnion, flattenTypeArray, inferTypes, removeUnsupported, pruneRequired]) {
    eachSchema(schema, phase);
  }
  const empty = schema.type === "object" && (!isRecord(schema.properties) || Object.keys(schema.properties).length === 0);
  return empty || Object.keys(schema).length === 0 ? undefined : schema;
}
