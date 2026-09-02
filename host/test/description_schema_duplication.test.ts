/**
 * DESCRIPTION vs SCHEMA — a fact deleted from prose must still reach the caller.
 *
 * 🔴 THE RISK A PROSE CUT CARRIES. 297 deleted six sentences from tool descriptions to
 * buy headroom under `BYTES_CEILING`, and every one of them was deleted on the same
 * argument: the client already receives this fact, in the same payload, as the
 * `.describe()` on the field the sentence was about. That argument is checkable, and
 * until it is checked it is exactly the kind of claim 295 §5.2 warns about — a green
 * that means "nobody looked" and a green that means "somebody looked" are the same
 * colour.
 *
 * So each cut is driven as a PAIR (295 §5.3's rule): the description must NOT carry the
 * sentence any more — a later session that re-adds it has re-introduced the duplication
 * and pays for it twice — and the field's own description MUST carry the fact. Neither
 * arm alone says anything. A cut whose fact went nowhere fails the second; a cut that
 * was never made fails the first.
 *
 * 🔴 AND THE POSITIVE CONTROL IS A FACT THAT LIVES IN NEITHER PLACE, planted here so a
 * helper that has quietly stopped reading either side cannot pass this file by finding
 * nothing and calling it clean (201 §9.43, the rule this repository keeps re-earning).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolsets } from "../src/toolsets.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { loadConfig } from "../src/config.js";
import { applyCapabilities, selectPrivilegedGroups } from "../src/capabilities.js";

type Cfg = { description?: string; inputSchema?: Record<string, unknown> };

/** The whole surface with its configs, wired the way index.ts wires it. */
function surface(): Map<string, Cfg> {
  const out = new Map<string, Cfg>();
  const record = (name: string, config: Cfg) => {
    out.set(name, config);
    return { name };
  };
  const server = {
    registerTool: record,
    registerResource() {},
    experimental: { tasks: { registerToolTask: record } },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };
  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;
  applyOutputSchemas(mcp);
  applyCapabilities(mcp, selectPrivilegedGroups(["all"]));
  for (const ts of buildToolsets({
    server: mcp, bridge: stub, runtime: stub, lsp: stub, csLsp: stub,
    dap: stub, csDap: stub, config: loadConfig(),
  })) ts.run();
  return out;
}

/**
 * What the CLIENT reads for one field: zod carries `.describe()` text on `.description`,
 * and that string is serialized into `inputSchema` in the same `tools/list` payload the
 * description travels in. Reading it here is reading the same bytes the caller gets.
 */
function fieldDescription(cfg: Cfg, field: string): string {
  const schema = cfg.inputSchema?.[field] as { description?: string } | undefined;
  return schema?.description ?? "";
}

const S = surface();

/**
 * (tool, field, a phrase from the DELETED sentence, a phrase the FIELD must still carry)
 *
 * The deleted phrase is quoted narrowly enough that re-adding the sentence in any form a
 * reader would recognise trips it, and the surviving phrase is quoted from the field's
 * own text rather than from the sentence, so the two arms cannot be satisfied by one
 * string sitting in one place.
 */
const CUTS: Array<[string, string, RegExp, RegExp]> = [
  ["card_hand_layout", "spacing",
   /fan_angle \/ columns/, /px between cards/],
  ["board_tile_place", "reparent",
   /With `reparent` \(default true\)/, /layer-local/],
  ["gd_call_hierarchy", "direction",
   /direction=incoming, the default/, /incoming = who calls this \(default\)/],
  ["runtime_assert_perf", "direction",
   /Pass direction is inferred/, /time\/fps higher_better/],
  ["dbg_launch", "scene",
   /scene may be 'main', 'current'/, /must be inside the project/],
  ["dbg_data_breakpoints", "watch",
   /Call with no `watch`/, /omit or \[\] to clear all data breakpoints/],
];

for (const [tool, field, deleted, survives] of CUTS) {
  test(`${tool}: the cut sentence is gone AND ${field} still carries the fact`, () => {
    const cfg = S.get(tool);
    assert.ok(cfg, `${tool} is not on the surface — this claim is about a tool that exists`);

    assert.doesNotMatch(
      cfg.description ?? "", deleted,
      `${tool}'s description carries a sentence 297 deleted as duplicated by ` +
      `\`${field}\`'s own text. Re-adding it means the caller pays for the fact twice, ` +
      `on a budget that had thirty-four bytes of room when this cut was made.`);

    assert.match(
      fieldDescription(cfg, field), survives,
      `${tool}.${field} no longer states what 297 deleted from the description on the ` +
      `argument that this field already said it. The fact has now left the surface ` +
      `entirely, which is the failure mode the cut was allowed to have and this line ` +
      `is the only thing that would say so.`);
  });
}

test("positive control — the pair fails for a fact that lives in NEITHER place", () => {
  const cfg = S.get("dbg_launch");
  assert.ok(cfg);
  const ABSENT = /this sentence appears in no description on this surface/;
  assert.doesNotMatch(cfg.description ?? "", ABSENT);
  assert.doesNotMatch(fieldDescription(cfg, "scene"), ABSENT);
  // Both arms above pass on an absent fact, which is precisely why the SECOND arm of
  // every pair above is an assert.match rather than another doesNotMatch: a checker
  // built only out of absences is satisfied by an empty surface.
  assert.equal(
    fieldDescription(cfg, "scene").length > 0, true,
    "fieldDescription() returned nothing for a field that certainly has text — the " +
    "reader is broken and every `survives` arm above was passing for the wrong reason");
});

test("every cut names a field the tool actually declares", () => {
  for (const [tool, field] of CUTS) {
    const cfg = S.get(tool);
    assert.ok(cfg, tool);
    assert.ok(
      cfg.inputSchema && field in cfg.inputSchema,
      `${tool} does not declare \`${field}\` — the cut's argument was that this field ` +
      `carries the fact, and a field that is gone carries nothing. Renaming a field is ` +
      `where a description cut silently becomes a deletion.`);
  }
});
