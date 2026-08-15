import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * 208 §7.1 — WHAT THE PROTOCOL ALREADY SAYS, DELETED FROM THE WIRE.
 *
 * Two fields on every tool in `tools/list` were not authored here and say nothing a
 * conforming peer does not already assume. Both are removed on the way out.
 *
 *  1. 🔴 `"$schema": "http://json-schema.org/draft-07/schema#"`, inside EVERY input and
 *     output schema. Nobody in this repo writes it: the SDK converts our Zod and asks for
 *     draft-07 while doing it.
 *
 *     🆕 255 — AND MOVING TO THE ZOD-v4 BRANCH DID NOT CHANGE THAT, WHICH THE PARAGRAPH
 *     THIS REPLACES IMPLIED IT WOULD. The old text read "the `target` option is read only
 *     by the Zod-v4 branch", which is true and useless: `server/mcp.js` calls
 *     `toJsonSchemaCompat` with no `target` at either version, and the v4 branch maps an
 *     absent target to `'draft-7'` before handing it to zod's own converter. So the
 *     declaration on the wire is the SDK's choice and not the library's, it survived a
 *     major bump unchanged, and this strip stays necessary — the same conclusion the
 *     migration spike reached from the outside, now measured from inside the tree.
 *
 *     MCP fixes the DEFAULT dialect at JSON Schema 2020-12 and
 *     requires every implementation to support it; a `$schema` field is an EXPLICIT
 *     SWITCH to a dialect nobody is obliged to support and which a peer MUST reject
 *     gracefully if it does not. So this is not decoration and it is not a trim:
 *     **580 of our 580 schemas fail to compile under a strict 2020-12 validator as
 *     shipped, and 580 of 580 compile with the declaration removed, with zero semantic
 *     disagreement across 2,320 probe instances.** The bytes (30,160 — 7.7% of the
 *     surface) are the smaller half of the finding.
 *
 *  2. `execution: { taskSupport: "forbidden" }`, on the 288 tools that are not task
 *     tools. Also not authored here — `McpServer.registerTool` hardcodes it. The spec
 *     defines `"forbidden"` as the value when the field is ABSENT ("clients MUST NOT
 *     attempt to invoke the tool as a task... This is the default behavior"), and the
 *     field does not exist AT ALL on `Tool` in revision 2026-07-28, which moved tasks to
 *     an extension with no per-tool flag. The three real task tools keep `"optional"`.
 *
 * 🔴 THE DIALECT STRIP IS FAIL-SAFE BY CONSTRUCTION, AND THAT IS THE WHOLE DESIGN.
 * Removing `$schema` is only meaning-preserving while the schema stays inside the
 * draft-07 ∩ 2020-12 intersection. `dialectSensitive()` walks for the keywords where the
 * two dialects disagree and the declaration is KEPT if it finds one — so a future schema
 * that actually needs draft-07 silently keeps working instead of silently changing
 * meaning. `token-cost.mjs` then refuses on any surviving declaration, which turns the
 * fail-safe from a quiet fallback into a red gate. **The transform never guesses; the
 * gate makes the one case it declines to handle impossible to miss.**
 */

/**
 * Keywords whose FORM or MEANING differs between draft-07 and 2020-12. Presence of any
 * one of them means the dialect label is load-bearing and must not be dropped.
 *
 * 🔴 `exclusiveMinimum`/`exclusiveMaximum` are listed for their BOOLEAN form only —
 * draft-04's. Both draft-07 and 2020-12 take a number there, and 65 of ours do, so
 * matching on the key alone would keep the declaration on a third of the surface for a
 * difference that does not exist. The predicate reads the value, not just the key.
 */
export const DIALECT_SENSITIVE: ReadonlyArray<readonly [string, (v: unknown) => boolean]> = [
  ["items", (v) => Array.isArray(v)], //            tuple form; 2020-12 spells it prefixItems
  ["additionalItems", () => true], //               2020-12 folds this into items
  ["exclusiveMinimum", (v) => typeof v === "boolean"], // draft-04 form
  ["exclusiveMaximum", (v) => typeof v === "boolean"], // draft-04 form
  ["dependencies", () => true], //                  split into dependentSchemas/dependentRequired
  ["prefixItems", () => true], //                   2020-12 only
  ["unevaluatedProperties", () => true], //         2020-12 only
  ["unevaluatedItems", () => true], //              2020-12 only
];

/**
 * The definition CONTAINERS, which are the one entry above that could not be decided from
 * its own value.
 *
 * 🔴 255 — AND THEY WERE ON THE LIST FOR A SPELLING DIFFERENCE THAT DOES NOT REACH A
 * REFERENCE. `definitions` is draft-07's container and `$defs` is 2020-12's, so each is an
 * unknown keyword under the other dialect — and an unknown keyword is one both specs
 * require a validator to IGNORE. What actually resolves a reference is `$ref`, and
 * `"#/definitions/X"` is a URI-reference resolved as a JSON Pointer into the same schema
 * resource under BOTH dialects: the pointer walks the document by key, and it does not
 * care whether the key it walks through is vocabulary or not.
 *
 * So the container is dialect-bound only when something inside it is REACHED BY A NAME
 * rather than by a path — `$anchor` (2020-12 only) or a nested `$id` (a new base URI in
 * both, resolved differently) — or when a `$ref` anywhere in the document is not a plain
 * local pointer. That is the predicate below, and it is a property of the WHOLE document,
 * which is why it could not live in the table above.
 *
 * 🔴 THIS WAS MEASURED BEFORE IT WAS BELIEVED, AND IT IS MEASURED AGAIN ON EVERY RUN.
 * `wire_defaults.test.ts` compiles the STRIPPED schema under a strict 2020-12 validator
 * and the declared one under draft-07, and compares their verdicts on probe instances —
 * Ajv is a second opinion with no stake in this argument. The fail-safe is not weakened:
 * a container that is reached by name, or a reference that leaves the document, still
 * keeps its declaration.
 */
const CONTAINER_KEYS = ["definitions", "$defs"] as const;

/** Reached by NAME rather than by path — the two ways a container stops being inert. */
const NAME_REACHED = new Set(["$id", "$anchor", "$dynamicAnchor", "$dynamicRef", "$recursiveAnchor", "$recursiveRef"]);

/**
 * Can a definition container be renamed between dialects without changing meaning?
 * A property of the whole document: every `$ref` in it must be a plain local pointer, and
 * nothing anywhere may be reached by name.
 */
export function containersInert(doc: unknown): boolean {
  let inert = true;
  const walk = (node: unknown): void => {
    if (!inert || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (NAME_REACHED.has(k)) { inert = false; return; }
      if (k === "$ref" && !(typeof v === "string" && v.startsWith("#/"))) { inert = false; return; }
      walk(v);
    }
  };
  walk(doc);
  return inert;
}

/** Keys under these keywords are AUTHOR-CHOSEN NAMES, not schema vocabulary. */
const NAME_BEARING = new Set(["properties", "patternProperties", "definitions", "$defs"]);

/**
 * Does this schema depend on which dialect validates it?
 *
 * 🔴 THE `properties` SKIP IS NOT A REFINEMENT, IT IS THE DIFFERENCE BETWEEN A TRUE AND A
 * FALSE ANSWER. A first pass over this surface reported one `dependencies` hit and would
 * have kept the declaration on the whole surface; the hit was `scene_get_dependencies`'s
 * output field, a property NAMED dependencies. A walker that cannot tell a keyword from a
 * key reads an author's vocabulary as the protocol's.
 *
 * 🔴 THE CONTAINER ANSWER IS COMPUTED ONCE, AT THE DOCUMENT, AND CARRIED DOWN. Whether
 * `definitions` is load-bearing is not readable from `definitions` — see `containersInert`
 * — so the recursion threads the document's answer rather than re-deriving a different one
 * at each level, which is how the same schema would get two verdicts from one walk.
 */
export function dialectSensitive(node: unknown, inNamePosition = false): boolean {
  return walkSensitive(node, inNamePosition, containersInert(node));
}

function walkSensitive(node: unknown, inNamePosition: boolean, inert: boolean): boolean {
  if (node === null || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((v) => walkSensitive(v, false, inert));
  const obj = node as Record<string, unknown>;
  // draft-07 ignores keywords adjacent to $ref; 2020-12 applies them.
  if (obj.$ref !== undefined && Object.keys(obj).length > 1) return true;
  for (const [k, v] of Object.entries(obj)) {
    if (!inNamePosition) {
      for (const [key, matches] of DIALECT_SENSITIVE) if (k === key && matches(v)) return true;
      if (!inert && (CONTAINER_KEYS as readonly string[]).includes(k)) return true;
    }
    if (walkSensitive(v, NAME_BEARING.has(k), inert)) return true;
  }
  return false;
}

/** The declaration the SDK emits, and the only one this strips. */
export const SDK_DIALECT = "http://json-schema.org/draft-07/schema#";

/**
 * Drop `$schema` iff it is the SDK's draft-07 default AND nothing in the schema needs it.
 * Any other declaration is somebody's deliberate choice and is left alone.
 */
export function stripDialect<T>(schema: T): T {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return schema;
  const obj = schema as Record<string, unknown>;
  if (obj.$schema !== SDK_DIALECT) return schema;
  if (dialectSensitive({ ...obj, $schema: undefined })) return schema;
  const { $schema: _dropped, ...rest } = obj;
  return rest as T;
}

/** Drop `execution` iff it carries nothing but the spec's own default. */
export function stripDefaultExecution<T extends { execution?: unknown }>(tool: T): T {
  const ex = tool.execution;
  if (ex === null || typeof ex !== "object") return tool;
  const keys = Object.keys(ex as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== "taskSupport") return tool;
  if ((ex as { taskSupport?: unknown }).taskSupport !== "forbidden") return tool;
  const { execution: _dropped, ...rest } = tool;
  return rest as T;
}

/** Both transforms over one tool. Pure, so the refusal proofs can drive it directly. */
export function normalizeTool<T extends Record<string, unknown>>(tool: T): T {
  let out: Record<string, unknown> = tool;
  if (out.inputSchema !== undefined) {
    const s = stripDialect(out.inputSchema);
    if (s !== out.inputSchema) out = { ...out, inputSchema: s };
  }
  if (out.outputSchema !== undefined) {
    const s = stripDialect(out.outputSchema);
    if (s !== out.outputSchema) out = { ...out, outputSchema: s };
  }
  return stripDefaultExecution(out as T & { execution?: unknown }) as T;
}

/** The `tools/list` result, normalized. Shape-preserving: cursors and extras survive. */
export function normalizeToolList<T extends { tools?: unknown }>(result: T): T {
  if (!result || !Array.isArray(result.tools)) return result;
  return { ...result, tools: result.tools.map((t) => normalizeTool(t as Record<string, unknown>)) };
}

/**
 * Wrap the low-level `tools/list` handler so every listing leaves normalized.
 *
 * 🔴 MUST RUN BEFORE THE FIRST `registerTool`. `McpServer` installs its tools/list
 * handler lazily, from inside the first registration (`setToolRequestHandlers`), so a
 * wrapper added afterwards has nothing to wrap and would silently do nothing. It is
 * therefore the FIRST of the apply* family, not merely an early one.
 *
 * 🔴 AND IT WRAPS THE HANDLER, NOT THE REGISTRY. The alternative — stripping at
 * registration — cannot work for the dialect: the Zod-to-JSON-Schema conversion happens
 * at LIST time, so at registration there is no `$schema` to remove yet.
 */
export function applyWireDefaults(server: McpServer): void {
  const low = server.server as unknown as {
    setRequestHandler: (schema: unknown, handler: (...a: unknown[]) => unknown) => void;
  };
  const raw = low.setRequestHandler.bind(low);
  low.setRequestHandler = (schema: unknown, handler: (...a: unknown[]) => unknown) => {
    if (schema !== ListToolsRequestSchema) return raw(schema, handler);
    return raw(schema, async (...args: unknown[]) =>
      normalizeToolList((await handler(...args)) as { tools?: unknown }),
    );
  };
}
