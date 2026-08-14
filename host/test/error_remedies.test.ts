import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { BridgeClient, BridgeError, remedyClause } from "../src/bridge.js";
import { fail as editorFail } from "../src/tools/editor/common.js";
import { startTcpServer, makeLineParser, writeLine, type TcpServer } from "./helpers/tcp.js";

// 🔴 WHAT THESE TESTS ARE ABOUT (254, closing `tool-error-sweep-unrun`). The addon
// attaches a next action to every failure it raises; the host has to carry it the last
// hop, into the text a client actually shows. contract_check check 28 proves the TABLE
// is complete and joined to the registry — a source-level assertion, because that file
// runs with no Godot. These prove the WIRE: a remedy on the response line survives the
// parse, reaches `BridgeError`, and lands in the rendered message; and a failure with
// no remedy renders exactly as it did before 254.

interface BridgeReq { id: string; method: string; params: Record<string, unknown> }

async function startBridge(handler: (req: BridgeReq, socket: net.Socket) => void): Promise<TcpServer> {
  return startTcpServer((s) => {
    const parse = makeLineParser((line) => handler(JSON.parse(line) as BridgeReq, s));
    s.on("data", (c) => parse(Buffer.from(c)));
  });
}

const textOf = (r: { content: Array<{ text: string }> }) => r.content[0].text;

test("a remedy on the wire reaches BridgeError and the rendered message", async () => {
  const srv = await startBridge((req, s) => writeLine(s, {
    id: req.id,
    ok: false,
    error: { code: "no_scene", message: "No scene is open", remedy: "Open a scene first: call `scene_open` with a res:// .tscn path." },
  }));
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  const err = await client.request("scene.save").then(() => null, (e: unknown) => e);
  assert.ok(err instanceof BridgeError);
  assert.equal(err.code, "no_scene");
  assert.equal(err.remedy, "Open a scene first: call `scene_open` with a res:// .tscn path.");
  // The whole point: the sentence a user reads carries the next action, not just the state.
  assert.equal(
    textOf(editorFail(err)),
    "Bridge error [no_scene]: No scene is open — Open a scene first: call `scene_open` with a res:// .tscn path.",
  );
  client.close();
  await srv.close();
});

test("a failure with no remedy renders exactly as it did before 254", async () => {
  const srv = await startBridge((req, s) => writeLine(s, {
    id: req.id, ok: false, error: { code: "bad_path", message: "Node not found: /root/x" },
  }));
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  const err = await client.request("node.delete").then(() => null, (e: unknown) => e);
  assert.ok(err instanceof BridgeError);
  assert.equal(err.remedy, undefined, "an absent remedy must not become an empty string on the error");
  assert.equal(textOf(editorFail(err)), "Bridge error [bad_path]: Node not found: /root/x");
  client.close();
  await srv.close();
});

test("a non-string remedy on the wire is dropped rather than rendered", async () => {
  // The addon is not the only thing that can put a line on this socket, and `${}` on a
  // number or an object renders "[object Object]" into the user's error text.
  const srv = await startBridge((req, s) => writeLine(s, {
    id: req.id, ok: false, error: { code: "bad_path", message: "nope", remedy: { call: "scene_open" } },
  }));
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  const err = await client.request("node.delete").then(() => null, (e: unknown) => e);
  assert.ok(err instanceof BridgeError);
  assert.equal(err.remedy, undefined);
  assert.equal(textOf(editorFail(err)), "Bridge error [bad_path]: nope");
  client.close();
  await srv.close();
});

test("remedyClause renders one clause and refuses every empty shape", () => {
  assert.equal(remedyClause(new BridgeError("x", "y", "Call `scene_get_tree`.")), " — Call `scene_get_tree`.");
  assert.equal(remedyClause(new BridgeError("x", "y")), "");
  assert.equal(remedyClause(new BridgeError("x", "y", "")), "");
  assert.equal(remedyClause(undefined), "");
  assert.equal(remedyClause(null), "");
  assert.equal(remedyClause(new Error("a plain error carries no remedy")), "");
  assert.equal(remedyClause({ remedy: 7 }), "", "a number is not a sentence, and template-rendering it is how it would look like one");
});
