import { test } from "node:test";
import assert from "node:assert/strict";
import { registerEditorTools } from "../src/tools/editor.js";
import { BridgeError } from "../src/bridge.js";
import {
  makeRecordingServer,
  type ElicitFn,
  type ToolResultLike,
} from "./helpers/recording-server.js";

/**
 * Behavior tests for the editor plane (tools/editor.ts) — the largest surface
 * (toolset `editor` → 148 tools) and the one that had no unit coverage. Two
 * invariants matter most and are asserted here without a real Godot editor:
 *
 *   1. Every DESTRUCTIVE editor tool sits behind the confirmation gate: on a
 *      declined prompt it blocks and NEVER reaches the bridge; with confirm:true
 *      it skips the prompt and proceeds.
 *   2. When the editor bridge is unreachable, EVERY tool degrades to a friendly
 *      isError envelope rather than throwing an opaque protocol error.
 */

// editor.ts has 43 gate() call sites. 42 gate UNCONDITIONALLY (destructive by
// nature); the 43rd — editorsettings_get_set — is a dual read/write tool that
// gates only on the write path and is covered by its own test below. This list
// is the 42 unconditional ones, kept explicit (not a bare count) so that adding
// a destructive tool without a gate — or dropping a gate — fails loudly by name.
const UNCONDITIONALLY_GATED = [
  "anim_delete", "audio_bus_add", "audio_bus_add_effect", "audio_bus_set_volume",
  "audio_set_bus_layout", "environment_create", "environment_set_sky",
  "filesystem_move", "inputmap_add_action", "inputmap_add_event", "inputmap_erase_action",
  "node_call_method", "node_delete", "physics_set_gravity", "primitive_mesh_create",
  "project_add_autoload", "project_add_export_preset", "project_remove_autoload",
  "project_set_main_scene", "project_set_setting", "resource_create", "resource_duplicate",
  "resource_save", "resource_set_import_settings", "resource_set_property", "scene_close",
  "scene_new", "scene_pack", "scene_reload", "scene_save_as", "shader_create", "shader_set_code",
  "signal_emit", "theme_create", "theme_set_color", "theme_set_constant", "theme_set_font",
  "theme_set_stylebox", "tileset_add_source", "tileset_add_tile", "tileset_create",
  "tileset_set_tile_collision",
].sort();

interface BridgeCall {
  method: string;
  params: Record<string, unknown>;
}

/**
 * Register the editor plane against a recording server + a fake bridge whose
 * behavior (resolve vs. reject) and whose elicitation response are switchable
 * per test.
 */
function makeHarness(projectPath = "/tmp/g164-editor-harness") {
  const calls: BridgeCall[] = [];
  const elicitReqs: unknown[] = [];
  let bridgeMode: "resolve" | "reject" = "resolve";
  let canned: Record<string, unknown> = { ok: true };
  let elicitImpl: ElicitFn = async () => ({ action: "decline" });

  const bridge = {
    async request(method: string, params: Record<string, unknown> = {}) {
      calls.push({ method, params });
      // 🆕 261 — a per-method canned reply. `screenshot_editor` now asks the addon which
      // main-screen tab is active BEFORE it asks for a texture, so a single `canned` for
      // every method can no longer express the case the tool is being tested on.
      if (Object.prototype.hasOwnProperty.call(byMethod, method)) {
        const v = byMethod[method];
        if (v instanceof Error) throw v;
        return v as Record<string, unknown>;
      }
      if (bridgeMode === "reject") {
        throw new BridgeError(
          "bridge_unavailable",
          'Cannot reach the Godot editor bridge at 127.0.0.1:9080. Is the editor open with the "Breakpoint MCP" plugin enabled?',
        );
      }
      return canned;
    },
  };

  const byMethod: Record<string, Record<string, unknown> | Error> = {};

  const elicit: ElicitFn = async (req) => {
    elicitReqs.push(req);
    return elicitImpl(req);
  };
  const rec = makeRecordingServer(elicit);
  registerEditorTools(
    rec.server as unknown as Parameters<typeof registerEditorTools>[0],
    bridge as unknown as Parameters<typeof registerEditorTools>[1],
    { projectPath } as Parameters<typeof registerEditorTools>[2],
  );

  return {
    tools: rec.tools,
    handler: (name: string) => rec.handler(name),
    calls,
    elicitReqs,
    setBridge(mode: "resolve" | "reject", c?: Record<string, unknown>) {
      bridgeMode = mode;
      if (c) canned = c;
    },
    setBridgeMethod(method: string, value: Record<string, unknown> | Error) {
      byMethod[method] = value;
    },
    setElicit(fn: ElicitFn) {
      elicitImpl = fn;
    },
  };
}

const text = (r: ToolResultLike): string => r.content?.[0]?.text ?? "";

// -------------------------------------------------------- confirmation gate ----

test("the 42 unconditionally-destructive editor tools gate; each blocks on decline without touching the bridge", async () => {
  const h = makeHarness();
  // A rejecting bridge makes a leak obvious: a truly-gated tool must never get
  // this far on a declined prompt.
  h.setBridge("reject");
  h.setElicit(async () => ({ action: "decline" }));

  const discovered: string[] = [];
  for (const [name, t] of h.tools) {
    const bridgeBefore = h.calls.length;
    const elicitBefore = h.elicitReqs.length;
    let res: ToolResultLike | undefined;
    try {
      res = await t.handler({});
    } catch {
      res = undefined;
    }
    // A tool that never consulted the gate (on a no-arg call) is not
    // unconditionally destructive — editorsettings_get_set reads here.
    if (h.elicitReqs.length === elicitBefore) continue;

    discovered.push(name);
    assert.equal(h.calls.length, bridgeBefore, `${name} must NOT reach the bridge when the user declines`);
    assert.ok(res, `${name} must return a blocking result, not throw`);
    assert.equal(res!.isError, true, `${name} decline result must be an error`);
    assert.match(text(res!), /did not approve/i, `${name} must report the action was not approved`);
  }

  assert.deepEqual(
    discovered.sort(),
    UNCONDITIONALLY_GATED,
    `gated set drifted (found ${discovered.length}): ${discovered.sort().join(", ")}`,
  );
});

test("editorsettings_get_set gates the WRITE path only; reads pass through ungated", async () => {
  const h = makeHarness();
  // Read (no value): no elicitation, forwards straight to the bridge.
  h.setBridge("resolve", { name: "interface/editor/code_font_size", value: 14 });
  h.setElicit(async () => {
    throw new Error("a read must not prompt");
  });
  const read = await h.handler("editorsettings_get_set")({ name: "interface/editor/code_font_size" });
  assert.notEqual(read.isError, true);
  assert.equal(h.elicitReqs.length, 0, "reading an editor setting must not prompt");
  assert.deepEqual(h.calls[0].params, { name: "interface/editor/code_font_size" });

  // Write (value present) + decline: blocks, never reaches the bridge.
  const h2 = makeHarness();
  h2.setBridge("reject");
  h2.setElicit(async () => ({ action: "decline" }));
  const declined = await h2.handler("editorsettings_get_set")({ name: "x", value: 20 });
  assert.equal(declined.isError, true);
  assert.match(text(declined), /did not approve/i);
  assert.equal(h2.calls.length, 0, "a declined write must not reach the bridge");

  // Write + confirm:true: forwards name+value.
  const h3 = makeHarness();
  h3.setBridge("resolve", { name: "x", value: 20 });
  const written = await h3.handler("editorsettings_get_set")({ name: "x", value: 20, confirm: true });
  assert.notEqual(written.isError, true);
  assert.equal(h3.calls[0].method, "editorsettings.get_set");
  assert.deepEqual(h3.calls[0].params, { name: "x", value: 20 });
});

test("confirm:true skips the prompt and lets every destructive tool reach the bridge", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { done: true });
  h.setElicit(async () => {
    throw new Error("elicitInput must not be called when confirm:true");
  });

  for (const name of UNCONDITIONALLY_GATED) {
    const before = h.calls.length;
    const r = await h.handler(name)({ confirm: true });
    assert.ok(h.calls.length > before, `${name} with confirm:true should forward to the bridge`);
    assert.notEqual(r.isError, true, `${name} should succeed when confirmed and the bridge resolves`);
  }
  assert.equal(h.elicitReqs.length, 0, "no elicitation should occur when confirm:true");
});

test("a destructive tool blocks with a 'confirm: true' hint when the client cannot elicit", async () => {
  const h = makeHarness();
  h.setBridge("reject");
  h.setElicit(async () => {
    throw new Error("Method not found: elicitation/create");
  });
  const before = h.calls.length;
  const r = await h.handler("scene_new")({ path: "res://X.tscn", root_type: "Node2D" });
  assert.equal(r.isError, true);
  assert.match(text(r), /confirm: true/);
  assert.equal(h.calls.length, before, "must not reach the bridge when it cannot confirm");
});

// ---------------------------------------------------- bridge-unreachable degrade ----

test("every editor tool degrades to a friendly isError when the bridge is unreachable (never throws)", async () => {
  const h = makeHarness();
  h.setBridge("reject");
  // Confirm up front so gated tools proceed past the gate to the (down) bridge.
  let errored = 0;
  for (const [name, t] of h.tools) {
    let r: ToolResultLike;
    try {
      r = await t.handler({ confirm: true });
    } catch (e) {
      assert.fail(`${name} threw instead of returning an error envelope: ${(e as Error).message}`);
      return;
    }
    assert.ok(Array.isArray(r.content), `${name} must return a content array`);
    if (r.isError) {
      errored++;
      assert.match(text(r), /bridge_unavailable/, `${name} should surface the bridge-unavailable code`);
    }
  }
  // editor.ts is a pure bridge-forwarding plane, so with the bridge down every
  // tool forwards and degrades — none silently "succeed".
  assert.equal(errored, h.tools.size, "all editor tools should error when the bridge is down");
});

// ----------------------------------------------------------------- happy path ----

test("editor_ping returns the ok() envelope (text + structuredContent) when the bridge resolves", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { pong: true, editor: "4.7" });
  const r = await h.handler("editor_ping")({});
  assert.notEqual(r.isError, true);
  assert.deepEqual(r.structuredContent, { pong: true, editor: "4.7" });
  assert.equal(h.calls[0].method, "ping");
});

test("node_delete forwards node.delete with the path once confirmed", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { deleted: true });
  const r = await h.handler("node_delete")({ path: "/root/Main/Enemy", confirm: true });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].method, "node.delete");
  assert.deepEqual(h.calls[0].params, { path: "/root/Main/Enemy" });
});

// ------------------------------------------------- screenshot_editor viewport guard ----

/**
 * Godot keeps the main-screen tab you are NOT looking at alive at its minimum
 * size rather than tearing it down, so capturing it succeeds and yields a valid
 * 2x2 PNG — right mime, right magic bytes, 81-byte payload, a note reading
 * "Captured 2d viewport (2x2)". Every signal says success; the frame is empty.
 * Measured on Godot 4.7 across four editor boots in session 144, where a fresh
 * editor (the CI condition) boots on the 3D tab and opening a Node2D scene does
 * not switch it — so the degenerate case is the default, not the exception.
 */
test("screenshot_editor refuses a collapsed viewport instead of returning a placeholder frame", async () => {
  const h = makeHarness();
  // Exactly what the addon returned from an inactive 2D tab on Godot 4.7.
  h.setBridge("resolve", {
    base64: "iVBORw0KGgoAAAANSUhEUg==",
    mime: "image/png",
    width: 2,
    height: 2,
    viewport: "2d",
  });
  const r = await h.handler("screenshot_editor")({ viewport: "2d" });
  assert.equal(r.isError, true, "a 2x2 viewport must not be reported as a capture");
  assert.match(text(r), /viewport_not_rendered/, "the error must carry a code the caller can branch on");
  assert.match(text(r), /2x2/, "the error must name what was actually measured");
  assert.match(text(r), /2D tab/, "the error must say how to fix it");
  assert.equal(
    r.content?.some((c) => (c as { type?: string }).type === "image"),
    false,
    "no image block may survive — an assistant would look at it",
  );
});

test("screenshot_editor passes a real frame through untouched", async () => {
  const h = makeHarness();
  // The 3D tab on the same boot: 1417x548, a genuine frame.
  h.setBridge("resolve", {
    base64: "iVBORw0KGgoAAAANSUhEUgAA",
    mime: "image/png",
    width: 1417,
    height: 548,
    viewport: "3d",
  });
  const r = await h.handler("screenshot_editor")({ viewport: "3d" });
  assert.notEqual(r.isError, true);
  const img = r.content?.find((c) => (c as { type?: string }).type === "image") as
    | { data?: string; mimeType?: string }
    | undefined;
  assert.ok(img, "a rendered viewport must still come back as image content");
  assert.equal(img!.mimeType, "image/png");
  assert.equal(img!.data, "iVBORw0KGgoAAAANSUhEUgAA");
  // The note is content[1] on a success — content[0] is the image — so read the
  // text block by type rather than by position (text() takes content[0]).
  const note = r.content?.find((c) => (c as { type?: string }).type === "text") as { text?: string } | undefined;
  assert.match(note?.text ?? "", /1417x548/);
});

test("the viewport guard trips on either edge, and 8px is the boundary", async () => {
  const cases: Array<[number, number, boolean]> = [
    [2, 2, true],       // both collapsed — the observed case
    [1417, 4, true],    // height collapsed only
    [4, 548, true],     // width collapsed only
    [7, 7, true],       // just under the boundary
    [8, 8, false],      // the boundary itself is allowed through
    [1417, 548, false], // a real frame
  ];
  for (const [width, height, shouldRefuse] of cases) {
    const h = makeHarness();
    h.setBridge("resolve", { base64: "iVBORw0K", mime: "image/png", width, height, viewport: "3d" });
    const r = await h.handler("screenshot_editor")({ viewport: "3d" });
    assert.equal(
      r.isError === true,
      shouldRefuse,
      `${width}x${height} should ${shouldRefuse ? "be refused" : "pass through"}`,
    );
  }
});

// ------------------------------------------- 261: the capture of a hidden tab ----

/**
 * 🔴 THE SIZE GUARD ABOVE IS TRUE OF THE BRANCH AND FALSE OF THE ENGINE.
 *
 * `screenshot_editor refuses a collapsed viewport…` feeds a mocked 2x2 through a fake
 * bridge, so it proves the branch and can never observe what Godot does. Measured at 261
 * against a live 4.7 editor: a tab collapses to 2x2 only until its FIRST visit. After
 * that it keeps full size while hidden and stops being drawn to — so the capture is a
 * full-resolution frame of the past, returned as a success, and the size guard sees
 * nothing wrong because the size is the one thing that did not change. Adding a 900x700
 * magenta ColorRect to the scene left the returned 2D image byte-identical.
 *
 * These three pin the tab check that replaced the inference. They are unit tests with the
 * same blindness as the one above — which is the point of writing down where the
 * measurement came from.
 */
test("screenshot_editor refuses to capture a viewport whose tab is not the active one", async () => {
  const h = makeHarness();
  h.setBridgeMethod("main_screen.get", { active: "3D", available: ["2D", "3D"] });
  h.setBridgeMethod("screenshot.editor_viewport", new Error("must not be reached"));
  const r = await h.handler("screenshot_editor")({ viewport: "2d" });
  assert.equal(r.isError, true, "a hidden tab's frame must not be returned as a capture");
  assert.match(text(r), /viewport_not_active/, "the error must carry a code the caller can branch on");
  assert.match(text(r), /"3D" tab/, "the error must name the tab that IS on screen");
  assert.match(text(r), /main_screen_set/, "the error must name the call that fixes it");
  assert.equal(
    r.content?.some((c) => (c as { type?: string }).type === "image"),
    false,
    "no image block may survive — an assistant would look at it and believe it",
  );
  assert.equal(
    h.calls.some((c) => c.method === "screenshot.editor_viewport"),
    false,
    "the texture must not even be read: the refusal is decided before the capture",
  );
});

test("screenshot_editor captures normally when the requested viewport IS the active tab", async () => {
  const h = makeHarness();
  h.setBridgeMethod("main_screen.get", { active: "2D", available: ["2D", "3D"] });
  h.setBridgeMethod("screenshot.editor_viewport", {
    base64: "iVBORw0KGgo=",
    mime: "image/png",
    width: 2214,
    height: 1809,
    viewport: "2d",
  });
  const r = await h.handler("screenshot_editor")({ viewport: "2d" });
  assert.notEqual(r.isError, true, "the active tab must still capture");
  assert.equal(
    r.content?.some((c) => (c as { type?: string }).type === "image"),
    true,
    "the image must survive — the tab check is a refusal, not a new failure mode",
  );
});

test("screenshot_editor degrades to the size guard when the addon cannot answer main_screen.get", async () => {
  const h = makeHarness();
  // pre-1.9.3 addon: the method does not exist, so the tab is unknowable
  h.setBridgeMethod("main_screen.get", new Error("unknown_method"));
  h.setBridgeMethod("screenshot.editor_viewport", {
    base64: "iVBORw0KGgo=",
    mime: "image/png",
    width: 2,
    height: 2,
    viewport: "2d",
  });
  const r = await h.handler("screenshot_editor")({ viewport: "2d" });
  assert.equal(r.isError, true, "an unknowable tab must not disable the second line of defence");
  assert.match(text(r), /viewport_not_rendered/, "the collapsed case still refuses by size");
  assert.match(text(r), /2x2/, "and still names what was measured");
});
