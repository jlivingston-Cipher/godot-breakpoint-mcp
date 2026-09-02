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
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `TOOL_CATALOG.md` on disk — the surviving home for 298's two mechanism cuts.
 *
 * 🔴 FOUND BY THE SUITE ON ITS FIRST RUN. A path counted in `..`s off this file is
 * counted off the COMPILED file, which sits one directory deeper (`dist-test/test/`)
 * than the source it was written beside. The tree is walked upward for the marker file
 * instead, so the reader answers the same from either location — and a miss is a THROW
 * rather than an empty string, because a catalog read as "" satisfies every
 * `doesNotMatch` on this page and fails only the arms that prove something.
 */
function repoFile(rel: string): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let up = 0; up < 6; up++) {
    const cand = path.join(dir, rel);
    if (existsSync(cand)) return readFileSync(cand, "utf8");
    dir = path.dirname(dir);
  }
  throw new Error(`${rel} not found above ${path.dirname(fileURLToPath(import.meta.url))}`);
}
const CATALOG = repoFile(path.join("docs", "TOOL_CATALOG.md"));

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

/* ───────────────────────────────────────────────────────────────────────────────────
 * 🆕 298 — THE SAME PAIR, FOR TWO OTHER PLACES A FACT CAN SURVIVE.
 *
 * 297's six cuts all survived in a field's own `.describe()`, in the same `tools/list`
 * payload. 298's five do not, and the difference is the point: a cut is only redundancy
 * reclaimed if somebody can name where the fact went, and "somewhere" is not a place.
 *
 *   CUTS_TO_OUTPUT   three "Returns the …" sentences that re-listed the tool's own
 *                    `outputSchema` — same payload, different half of it.
 *   CUTS_TO_CATALOG  two "decomposes onto scene.new → …" sentences naming host-internal
 *                    bridge methods a caller cannot invoke. 🔴 THESE ARE NOT BUDGET
 *                    CUTS. 298's finding is that this repository stated the MECHANISM in
 *                    three places and its CONSEQUENCE in none — the four composites moved
 *                    the editor's edited scene and said so nowhere. 🆕 299 removed the
 *                    consequence by removing the movement: the four put the caller back,
 *                    and the description says THAT instead. The mechanism is unchanged
 *                    and so is this pair's argument — it keeps its home in
 *                    `TOOL_CATALOG.md`, which is where it was already written in fuller
 *                    form. Deleting it from BOTH would be the deletion this file exists
 *                    to catch, so the surviving arm reads the catalog on disk.
 * ─────────────────────────────────────────────────────────────────────────────────── */

/** (tool, deleted phrase, output-schema properties that must still carry the fact) */
const CUTS_TO_OUTPUT: Array<[string, RegExp, string[]]> = [
  ["board_create", /Returns the cell_id/, ["cells", "cell_count"]],
  ["board_tile_create", /Returns the layer path/, ["layer_path", "rows", "cols", "tile_size"]],
  ["piece_template_create", /Returns the scene path/, ["scene_path", "nodes"]],
];

/** (tool, deleted phrase, a phrase TOOL_CATALOG.md must still carry for that tool) */
const CUTS_TO_CATALOG: Array<[string, RegExp, RegExp]> = [
  ["board_tile_create", /decomposes onto scene\.new/,
   /decomposes onto `scene\.new` → `tileset\.create` → `tilemaplayer\.create`/],
  ["piece_template_create", /Decomposes onto scene\.new/,
   /decomposes onto `scene\.new` → `node\.add` → `node\.set_property` → `resource\.create`/],
];

/**
 * The four composites that decompose onto `scene.new`, and must SAY what they leave
 * the editor on.
 *
 * 🆕 299 — RENAMED WITH THE BEHAVIOUR. At 298 these tools moved the caller and the
 * population was named for that; steered at 299, they put the caller back. A roster
 * still called `MOVES_EDITED_SCENE` would be the same defect 298 found — a name that
 * knows something the surface no longer does — in the file built to catch it.
 */
const RESTORES_EDITED_SCENE = [
  "card_template_create", "piece_template_create", "board_create", "board_tile_create",
];

/**
 * 🆕 299 — AND THE OLD SENTENCE IS NOW WRONG ADVICE, WHICH IS WORSE THAN NO ADVICE.
 * 298's descriptions told a caller *reopen yours first*. A caller who follows that
 * after this change reopens a scene the tool has already reopened for them — harmless
 * — but a caller who reads *the created scene becomes the EDITED scene* and SKIPS the
 * in-scene work they wanted is harmed by a surface that describes a movement it no
 * longer makes. 298's whole finding was a repository whose documents disagreed with
 * its behaviour; leaving these two phrases behind would reproduce it pointing the
 * other way, so both are refused by name.
 */
const STALE_MOVE_WARNINGS = /becomes the EDITED scene|reopen yours first/;

function outputProps(name: string): Record<string, unknown> {
  const cfg = S.get(name) as { outputSchema?: Record<string, unknown> } | undefined;
  return (cfg?.outputSchema ?? {}) as Record<string, unknown>;
}

for (const [tool, deleted, props] of CUTS_TO_OUTPUT) {
  test(`${tool}: the "Returns …" sentence is gone AND the outputSchema still declares it`, () => {
    const cfg = S.get(tool);
    assert.ok(cfg, `${tool} is not on the surface`);
    assert.doesNotMatch(
      cfg.description ?? "", deleted,
      `${tool}'s description re-lists its own outputSchema. The caller receives both in ` +
      `one payload, so the sentence is paid for twice.`);
    const declared = outputProps(tool);
    for (const p of props) {
      assert.ok(
        p in declared,
        `${tool} no longer declares \`${p}\` in its outputSchema, and its description no ` +
        `longer says it either — the fact has left the surface entirely, which is the ` +
        `failure mode this cut was allowed to have.`);
    }
  });
}

for (const [tool, deleted, survives] of CUTS_TO_CATALOG) {
  test(`${tool}: the decomposition left the description AND is still in TOOL_CATALOG.md`, () => {
    const cfg = S.get(tool);
    assert.ok(cfg, `${tool} is not on the surface`);
    assert.doesNotMatch(
      cfg.description ?? "", deleted,
      `${tool}'s description names the host-internal bridge methods it decomposes onto. ` +
      `A caller cannot invoke them; the consequence of that decomposition — where the ` +
      `call leaves the editor — is what belongs here, and does.`);
    assert.match(
      CATALOG, survives,
      `TOOL_CATALOG.md no longer states ${tool}'s decomposition, and the description no ` +
      `longer states it either. 298 moved that fact; it did not delete it.`);
  });
}

test("299: every composite that restores the edited scene says so, in both halves", () => {
  for (const tool of RESTORES_EDITED_SCENE) {
    const cfg = S.get(tool);
    assert.ok(cfg, `${tool} is not on the surface`);
    assert.ok(
      "edited_scene" in outputProps(tool),
      `${tool} decomposes onto \`scene.new\`, which calls \`open_scene_from_path\` and ` +
      `moves the editor — and its answer does not name where it left the caller. ` +
      `Measured at 298 on a live Godot 4.7: compose a table, create a card template, ` +
      `then \`card_instance\` with \`parent: "."\` — the card lands in the TEMPLATE and ` +
      `every call answers success. 299 restores the caller instead, and this field is ` +
      `how a caller learns the restore actually happened.`);
    assert.match(
      cfg.description ?? "", /Puts the editor back on the scene you had open/,
      `${tool}'s description does not tell a caller that it restores the scene they had ` +
      `open. The field alone is read AFTER the call; the description is what a caller ` +
      `reads BEFORE choosing (278's rule), and a caller who does not know the tool puts ` +
      `them back will keep paying for the \`scene_open\` this change made unnecessary.`);
    assert.doesNotMatch(
      cfg.description ?? "", STALE_MOVE_WARNINGS,
      `${tool}'s description still carries 298's move warning. The tool no longer leaves ` +
      `the caller on the created scene, so that sentence now describes behaviour this ` +
      `surface does not have — which is 298's own finding with the sign flipped.`);
  }
});

test("298 positive control — the edited-scene claim fails for a tool outside the population", () => {
  // `card_instance` does NOT create a scene and must NOT carry the field: a checker that
  // has stopped reading `outputSchema` would find `edited_scene` nowhere and pass the
  // loop above by finding nothing, so one negative membership is asserted too.
  assert.ok(S.get("card_instance"), "card_instance is not on the surface");
  assert.equal(
    "edited_scene" in outputProps("card_instance"), false,
    "card_instance declares `edited_scene`. The field means *this call could have moved " +
    "the editor and here is where it actually left you*; on a tool that never touches " +
    "the edited scene the field is a claim nothing can honour, " +
    "and the population 298 declared has stopped meaning anything.");
  assert.ok(
    Object.keys(outputProps("card_instance")).length > 0,
    "outputProps() returned nothing for a tool that certainly declares an output " +
    "schema — the reader is broken and every membership arm above passed for the " +
    "wrong reason.");
});
