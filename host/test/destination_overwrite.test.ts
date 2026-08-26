import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyOutputSchemas, outputSchemas } from "../src/schemas.js";
import { applyAnnotations } from "../src/annotations.js";
import { buildToolsets } from "../src/toolsets.js";
import { loadConfig } from "../src/config.js";

/**
 * 284 — `destination-exists-silently-destroys`, and the claim is a POPULATION rather
 * than a list.
 *
 * 🔴 MEASURED AGAINST A LIVE GODOT 4.7, NINE FOR NINE. Nine resources were created, a
 * sentinel line appended to each on disk, and each tool called a SECOND time with
 * identical arguments: every sentinel was gone and every reply read `created` / `saved` /
 * `packed`, the same words the first call returned. `resource_create` reset an
 * Environment somebody had configured, then turned it into a StandardMaterial3D when
 * asked for one at the same path. `scene_new` replaced a scene on disk while the editor
 * still held the old one in memory.
 *
 * 🔴 AND A LIST OF THE NINETEEN WOULD BE THE DEFECT AGAIN — 282 §2.3, and 283 §1.3 one
 * session earlier on `add_child`. Nobody passed `overwrite` because there was nothing to
 * pass; a roster of tools-that-should-have-it is a roster somebody has to keep true. So
 * the population is DERIVED from the registered surface, exactly as
 * `mutation_guard.test.ts` derives the guards', and the two halves are asserted to be
 * the same set: a tool that can report `replaced` must let the caller ask for it, and a
 * tool that takes `overwrite` must be able to say it used it.
 */
function registeredSurface(): Array<{ name: string; input: Set<string> }> {
  const calls: Array<{ name: string; input: Set<string> }> = [];
  const record = (name: string, config: { inputSchema?: Record<string, unknown> }) => {
    calls.push({ name, input: new Set(Object.keys(config?.inputSchema ?? {})) });
    return { name };
  };
  const server = {
    registerTool: record,
    registerResource() {},
    experimental: { tasks: { registerToolTask: record } },
    server: { elicitInput: async () => { throw new Error("no elicitation"); } },
  };
  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;
  const priorProject = process.env.GODOT_PROJECT;
  process.env.GODOT_PROJECT = fs.mkdtempSync(path.join(os.tmpdir(), "bp-dest-probe-"));
  applyOutputSchemas(mcp);
  applyAnnotations(mcp);
  const toolsets = buildToolsets({
    server: mcp, bridge: stub, runtime: stub, lsp: stub, csLsp: stub,
    dap: stub, csDap: stub, config: loadConfig(),
  });
  for (const ts of toolsets) ts.run();
  if (priorProject === undefined) delete process.env.GODOT_PROJECT;
  else process.env.GODOT_PROJECT = priorProject;
  return calls;
}

test("every tool that can report `replaced` also accepts `overwrite`, and the reverse", () => {
  const calls = registeredSurface();
  assert.ok(calls.length > 250, `the walk reached ${calls.length} registration(s)`);

  const takesOverwrite = calls.filter((c) => c.input.has("overwrite")).map((c) => c.name).sort();
  const reportsReplaced = Object.entries(outputSchemas)
    .filter(([, shape]) => Object.prototype.hasOwnProperty.call(shape ?? {}, "replaced"))
    .map(([name]) => name)
    .sort();

  // 🔴 ASSERTED NON-EMPTY FIRST. Two empty sets are equal, and a filter that stopped
  // matching would make this test pass over a tree where the feature had been deleted —
  // which is how a population claim goes quiet.
  assert.ok(takesOverwrite.length >= 10,
    `only ${takesOverwrite.length} tool(s) accept \`overwrite\`; the measured population was 17`);

  const onlyInput = takesOverwrite.filter((n) => !reportsReplaced.includes(n));
  const onlyOutput = reportsReplaced.filter((n) => !takesOverwrite.includes(n));
  assert.deepEqual(onlyInput, [],
    `tool(s) that accept \`overwrite\` and cannot say they used it: ${onlyInput.join(", ")}. ` +
    `"I created a file" and "I overwrote your file because you asked me to" are not the same sentence.`);
  assert.deepEqual(onlyOutput, [],
    `tool(s) that can report \`replaced\` and give the caller no way to ask for it: ${onlyOutput.join(", ")}`);
});

test("the destination-writing family is exactly the family that gates on `overwrite`", () => {
  // The other direction, and the one that would have caught this in the first place:
  // a tool that takes a caller-named DESTINATION is a tool that can land on somebody
  // else's file. `to_path` is this surface's name for that, and the two exceptions are
  // named rather than filtered away.
  const calls = registeredSurface();
  const NOT_A_RESOURCE_WRITE = new Set([
    // refuses `exists` outright and has no seam here — it moves a file, it does not save one
    "filesystem_move",
    // the seven scaffold tools already had `overwrite` before 284, through their own
    // seam (`_mp_write_script`); they are the reason the seam shape was known to work
    "mp_setup_enet_peer", "mp_setup_webrtc_peer", "mp_scaffold_lobby",
    "auth_scaffold", "backend_configure", "cloudsave_scaffold", "leaderboard_scaffold",
    // host-side CLI export: writes through the Godot binary, not through ResourceSaver
    "godot_export",
  ]);
  const missing = calls
    .filter((c) => (c.input.has("to_path") || c.name === "scene_new")
      && !c.input.has("overwrite") && !NOT_A_RESOURCE_WRITE.has(c.name))
    .map((c) => c.name)
    .sort();
  assert.deepEqual(missing, [],
    `tool(s) that take a caller-named destination and cannot be told not to destroy it: ${missing.join(", ")}`);
});
