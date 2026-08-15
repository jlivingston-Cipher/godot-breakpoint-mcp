import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { outputSchemas, applyOutputSchemas } from "../src/schemas.js";

/** Build a validator from a tool's frozen ZodRawShape. */
const schemaOf = (name: string) => z.object(outputSchemas[name]);

test("every entry in outputSchemas is a valid, NON-EMPTY ZodRawShape", () => {
  // 🔴 WHAT THIS USED TO ASSERT, AND WHY IT WAS NOT ENOUGH. Until 171 the block held
  // only `typeof shape === "object"` and `typeof zt.parse === "function"` — both true of
  // every wrong answer of the right type (168 §4). `mutate171.sh` M5 injected a null
  // entry and the test DID go red, so this was dismissed as a defect — but it went red
  // by ACCIDENT: `Object.entries(null)` throws on the very next line, so the suite
  // reports a TypeError instead of naming the offending schema. Two cases had no
  // backstop at all:
  //   • outputSchemas collapsing to `{}` — the loop body never runs, everything green
  //   • a shape of `{}` — applyOutputSchemas would enforce NOTHING, and every assertion
  //     in the old block still passed
  // Both are now claims rather than side effects.
  assert.ok(Object.keys(outputSchemas).length > 0, "outputSchemas collapsed to empty");
  for (const [name, shape] of Object.entries(outputSchemas)) {
    assert.ok(shape && typeof shape === "object", `${name} shape is not an object`);
    assert.ok(Object.keys(shape).length > 0, `${name} has an EMPTY shape — it would enforce nothing`);
    for (const [field, zt] of Object.entries(shape)) {
      assert.ok(zt && typeof (zt as z.ZodType).parse === "function", `${name}.${field} is not a Zod type`);
    }
  }
});

test("representative success shapes validate against their schema", () => {
  schemaOf("editor_ping").parse({ pong: true, addon_version: "0.4.9", godot: "4.4.1" });
  schemaOf("godot_version").parse({ version: "4.4.1", raw: { code: 0, stdout: "…", stderr: "", timedOut: false } });
  schemaOf("project_get_setting").parse({ name: "application/config/name", value: "My Game" });
  schemaOf("dbg_scopes").parse({ scopes: [{ name: "Locals", variables_ref: 1001 }] });
  schemaOf("dbg_evaluate").parse({ result: "42", type: "int", variables_ref: 0 });
  schemaOf("dbg_restart").parse({ session_id: "godot", method: "relaunch", state: "running", scene: null });
  schemaOf("dbg_goto").parse({ targets: [{ id: 1, label: "line 12", line: 12 }], jumped: true, target_id: 1 });
  schemaOf("dbg_data_breakpoints").parse({ breakpoints: [{ name: "hp", data_id: "hp@1", verified: true }], unresolved: [] });
  schemaOf("gd_rename").parse({ changed_files: ["res://player.gd"], edit_count: 3, applied: true, written: ["/abs/player.gd"] });
  schemaOf("gd_call_hierarchy").parse({
    direction: "incoming",
    items: [{ name: "take_damage", kind: "method", uri: "res://player.gd", line: 0, character: 5, detail: "func take_damage(n)",
      calls: [{ name: "_process", kind: "function", uri: "res://enemy.gd", line: 8, character: 5, detail: "", ranges: [{ line: 9, character: 8, end_line: 9, end_character: 19 }] }] }],
  });
  schemaOf("gd_semantic_tokens").parse({ token_count: 1, tokens: [{ line: 0, character: 0, length: 4, type: "keyword", modifiers: [] }] });
  schemaOf("runtime_get_monitors").parse({ monitors: { "time/fps": 60, "memory/static": 1234 } });
  schemaOf("godot_output").parse({
    id: "run-1", exited: false, exit_code: null, latest_seq: 2,
    lines: [{ seq: 1, stream: "stdout", text: "boot" }, { seq: 2, stream: "stderr", text: "warn" }],
  });
});

test("recursive scene/runtime tree schemas validate nested children", () => {
  schemaOf("scene_get_tree").parse({
    name: "Main", type: "Node2D", path: "/root/Main", script: null, child_count: 1,
    children: [{ name: "Player", type: "CharacterBody2D", path: "/root/Main/Player", script: "res://player.gd", child_count: 0 }],
  });
  schemaOf("runtime_get_tree").parse({
    name: "root", type: "Window", path: "/root", child_count: 1,
    children: [{ name: "Main", type: "Node2D", path: "/root/Main", child_count: 0, visible: true }],
  });
});

test("schemas are non-strict: EXTRA runtime fields still validate (catalog is a floor, not a ceiling)", () => {
  // runtime_get_tree gains visible/process_mode at runtime beyond the catalog shape.
  schemaOf("runtime_get_tree").parse({
    name: "root", type: "Window", path: "/root", child_count: 0,
    visible: true, process_mode: 0, extra_future_field: "ok",
  });
  // godot_output gains an unforeseen top-level field.
  schemaOf("godot_output").parse({
    id: "x", exited: true, exit_code: 0, latest_seq: 0, lines: [], server_time: 123,
  });
});

test("a deliberately WRONG shape is rejected (B1 enforcement)", () => {
  // pong must be boolean.
  assert.throws(() => schemaOf("editor_ping").parse({ pong: "yes", addon_version: "0.4.9", godot: "4.4.1" }), z.ZodError);
  // required field missing.
  assert.throws(() => schemaOf("scene_get_tree").parse({ name: "Main", path: "/root/Main", script: null, child_count: 0 }), z.ZodError);
  // stream must be one of the enum members.
  assert.throws(
    () => schemaOf("godot_output").parse({ id: "x", exited: false, exit_code: null, latest_seq: 1, lines: [{ seq: 1, stream: "network", text: "" }] }),
    z.ZodError,
  );
  // variables_ref must be a number.
  assert.throws(() => schemaOf("dbg_scopes").parse({ scopes: [{ name: "Locals", variables_ref: "1001" }] }), z.ZodError);
});

test("nullable fields accept null but not the wrong type", () => {
  schemaOf("godot_launch_editor").parse({ launched: true, pid: null, project: "/p" });
  schemaOf("godot_launch_editor").parse({ launched: true, pid: 4321, project: "/p" });
  assert.throws(() => schemaOf("godot_launch_editor").parse({ launched: true, pid: "4321", project: "/p" }), z.ZodError);
});

// ---- applyOutputSchemas injection mechanics -------------------------------

type ApplyTarget = Parameters<typeof applyOutputSchemas>[0];

function recordingRegisterServer() {
  const recorded: Array<{ name: string; config: Record<string, unknown> }> = [];
  const server = {
    registerTool(name: string, config: Record<string, unknown>) {
      recorded.push({ name, config });
      return { name };
    },
  };
  return { server: server as unknown as ApplyTarget, recorded };
}

test("applyOutputSchemas injects the frozen schema for a known tool", () => {
  const { server, recorded } = recordingRegisterServer();
  applyOutputSchemas(server);
  (server as unknown as { registerTool: (n: string, c: object, h: unknown) => void })
    .registerTool("editor_ping", { inputSchema: {} }, () => {});
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].config.outputSchema, outputSchemas["editor_ping"]);
});

test("applyOutputSchemas leaves an unknown tool without an outputSchema", () => {
  const { server, recorded } = recordingRegisterServer();
  applyOutputSchemas(server);
  (server as unknown as { registerTool: (n: string, c: object, h: unknown) => void })
    .registerTool("not_a_real_tool", { inputSchema: {} }, () => {});
  assert.equal(recorded[0].config.outputSchema, undefined);
});

test("applyOutputSchemas never overrides a tool's own explicit outputSchema", () => {
  const { server, recorded } = recordingRegisterServer();
  const sentinel = { marker: true };
  applyOutputSchemas(server);
  (server as unknown as { registerTool: (n: string, c: object, h: unknown) => void })
    .registerTool("editor_ping", { inputSchema: {}, outputSchema: sentinel }, () => {});
  assert.equal(recorded[0].config.outputSchema, sentinel);
});

// ── 255: THE PROMISE THE WIRE LEARNED TO SPELL AT zod 4.4.0 ──────────────────────────

/**
 * 🔴 A KEY TYPED `z.any()` CHANGED FROM IMPLICITLY OPTIONAL TO IMPLICITLY REQUIRED, AND
 * NOT AT THE MAJOR. Measured while moving this tree from 3.25.76 to 4.4.3:
 * `z.object({v: z.any()}).parse({})` PASSES on 4.0.x, 4.1, 4.2 and 4.3.6, and FAILS from
 * 4.4.0 — a break shipped inside a MINOR, invisible to the `zod/v4` subpath of zod 3
 * (which is core 4.0.0) that the migration spike had recommended as the cheap door.
 *
 * The SDK validates `structuredContent` against `outputSchema` on every SUCCESS result, so
 * this set is a list of keys whose absence turns a working tool into a thrown error. It is
 * pinned HERE, off the CONVERTED schema rather than off `outputSchemas`, because the thing
 * that moved was the conversion and not the declaration: reading it from the Zod objects
 * would ask the same library that changed its mind whether it had changed its mind.
 *
 * `contract_check.py`'s check 29 owns the other half — that something on the engine side
 * actually writes each of these. This half owns the count and the membership, so a future
 * zod that re-optionalises them cannot do it quietly.
 */
const REQUIRED_ANY_OUTPUT_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["anim_get_track_keys", "keys[].value"],
  ["editorsettings_get_set", "value"],
  ["node_call_method", "result"],
  ["node_get_property", "value"],
  ["node_set_property", "value"],
  ["project_get_setting", "value"],
  ["project_list_settings", "settings[].value"],
  ["resource_get_property", "value"],
  ["resource_set_property", "value"],
  ["runtime_assert_node_state", "mismatches[].actual"],
  ["runtime_assert_node_state", "mismatches[].expected"],
  ["runtime_await_condition", "value"],
  ["runtime_call_method", "return"],
  ["runtime_get_property", "value"],
  ["runtime_set_property", "value"],
  ["shadermaterial_set_param", "value"],
];

/** Every `required` name whose subschema constrains NOTHING, as a dotted path. */
function unconstrainedRequired(node: unknown, path: string, out: string[]): void {
  if (node === null || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const props = obj.properties as Record<string, unknown> | undefined;
  if (Array.isArray(obj.required) && props) {
    for (const name of obj.required as string[]) {
      const sub = props[name];
      // `{}` — no type, no enum, no combinator: the shape `z.any()` converts to.
      if (sub && typeof sub === "object" && Object.keys(sub as object).length === 0) {
        out.push(path ? `${path}.${name}` : name);
      }
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "properties" && props) {
      for (const [name, sub] of Object.entries(props)) {
        unconstrainedRequired(sub, path ? `${path}.${name}` : name, out);
      }
    } else if (k === "items") {
      unconstrainedRequired(v, `${path}[]`, out);
    } else if (k === "definitions" || k === "$defs") {
      for (const sub of Object.values(v as Record<string, unknown>)) {
        unconstrainedRequired(sub, path, out);
      }
    }
  }
}

test("🔴 255 — the output keys the wire REQUIRES and constrains not at all are exactly the declared set", async () => {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");

  const server = new McpServer({ name: "required-any-probe", version: "0" });
  for (const [name, shape] of Object.entries(outputSchemas)) {
    server.registerTool(name, { description: "d", inputSchema: {}, outputSchema: shape },
      async () => ({ content: [] }));
  }
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(b), client.connect(a)]);
  const listed = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : {});
    listed.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  await client.close();

  const found: Array<[string, string]> = [];
  for (const t of listed) {
    const hits: string[] = [];
    unconstrainedRequired(t.outputSchema, "", hits);
    for (const h of hits) found.push([t.name, h]);
  }
  const norm = (rows: ReadonlyArray<readonly [string, string]>) =>
    rows.map(([t, k]) => `${t}::${k}`).sort();
  assert.deepEqual(norm(found), norm(REQUIRED_ANY_OUTPUT_KEYS),
    "an `any`-typed output key changed its optionality on the wire. If a zod bump did it, "
    + "the tools listed are the ones whose SUCCESS path now validates differently — decide "
    + "each one and move the roster deliberately, never to match the library.");
});
