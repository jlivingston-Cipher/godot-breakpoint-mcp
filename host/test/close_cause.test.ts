import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { BridgeClient, BridgeError, remedyClause } from "../src/bridge.js";
import { ABRUPT_CLOSE_CODES, classifyClose, closeDetail, closeRemedy } from "../src/close-cause.js";
import { startTcpServer, type TcpServer } from "./helpers/tcp.js";

/**
 * 🔴 THE CLAIM UNDER TEST, AND WHY IT NEEDS BOTH DIRECTIONS (264 §3).
 *
 * Before this, a peer that was KILLED and a peer that shut down CLEANLY both produced
 * `bridge_closed` and the same sentence, separated by one parenthetical:
 *
 * ```
 * B  peer reset mid-request   Bridge connection closed before a response arrived (read ECONNRESET)
 * C  peer closed cleanly      Bridge connection closed before a response arrived
 * ```
 *
 * A test that only asserted the abrupt case would pass against a build that returned the
 * abrupt sentence unconditionally — which is the whole defect one layer up, a guard that
 * cannot tell the two states apart. So every claim here is asserted in BOTH directions,
 * and the pair is asserted to DIFFER.
 */

// ------------------------------------------------------------ the classifier ----

test("classifyClose: an errno in the abrupt family is abrupt", () => {
  for (const code of ABRUPT_CLOSE_CODES) {
    const e = Object.assign(new Error(`read ${code}`), { code });
    assert.equal(classifyClose(e), "abrupt", `${code} should classify abrupt`);
  }
});

test("classifyClose: no error at all is a deliberate close", () => {
  assert.equal(classifyClose(undefined), "deliberate");
});

test("classifyClose: an errno outside the measured families is UNCLASSIFIED, not guessed", () => {
  // 🔴 THE REFUSAL TO INVENT IS THE POINT. 264 measured two families and can speak for
  // two. A third errno getting the abrupt sentence by default would be a sentence nobody
  // measured, wearing the authority of one that was.
  const e = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
  assert.equal(classifyClose(e), "unclassified");
  assert.equal(closeRemedy(e, "the editor"), undefined);
});

test("closeRemedy: the two measured causes give DIFFERENT next actions", () => {
  const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
  const abrupt = closeRemedy(reset, "the editor");
  const deliberate = closeRemedy(undefined, "the editor");
  assert.ok(abrupt, "an abrupt close must name a next action");
  assert.ok(deliberate, "a deliberate close must name a next action");
  assert.notEqual(abrupt, deliberate, "the two causes must not produce the same sentence");
  assert.match(abrupt, /^Restart the editor/);
  assert.match(deliberate, /^Check whether the editor/);
});

test("closeRemedy: names the peer it was given, so each plane speaks of its own", () => {
  for (const peer of ["the editor", "the running game", "the debug adapter", "the language server"]) {
    assert.match(closeRemedy(undefined, peer) ?? "", new RegExp(peer.replace(/ /g, " ")));
  }
});

test("closeRemedy: every sentence it produces ends in a full stop (check 28's grammar)", () => {
  const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
  for (const s of [closeRemedy(reset, "the editor"), closeRemedy(undefined, "the editor")]) {
    assert.ok(s?.endsWith("."), `remedy must end in a full stop: ${s}`);
  }
});

test("closeDetail: keeps the parenthetical byte-identical to what shipped", () => {
  const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
  assert.equal(closeDetail(reset), " (read ECONNRESET)");
  assert.equal(closeDetail(undefined), "");
});

test("closeRemedy: the abrupt sentence does not repeat the errno closeDetail already printed", () => {
  const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
  assert.ok(!(closeRemedy(reset, "the editor") ?? "").includes("ECONNRESET"));
});

// --------------------------------------------------- live, over a real socket ----

async function pendingWhenClosed(kill: (s: net.Socket) => void): Promise<BridgeError> {
  const srv: TcpServer = await startTcpServer((s) => {
    s.on("data", () => kill(s));
  });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  try {
    await client.request("editor.ping");
    throw new Error("the request resolved; it was supposed to fail on a dropped connection");
  } catch (e) {
    client.close();
    await srv.close().catch(() => {});
    return e as BridgeError;
  }
}

test("live: a peer that RESETS mid-request is told apart from one that closes cleanly", async () => {
  const reset = await pendingWhenClosed((s) => s.resetAndDestroy());
  const clean = await pendingWhenClosed((s) => s.end());

  // Same code — callers and tests branch on it, and 264 did not move it.
  assert.equal(reset.code, "bridge_closed");
  assert.equal(clean.code, "bridge_closed");

  // 🔴 AND NOW A DIFFERENT ANSWER. Before 264 these two were the same sentence.
  assert.ok(reset.remedy, "an abrupt drop must carry a next action");
  assert.ok(clean.remedy, "an orderly close must carry a next action");
  assert.notEqual(reset.remedy, clean.remedy);
  assert.match(reset.remedy!, /^Restart the editor and retry/);
  assert.match(clean.remedy!, /^Check whether the editor is still running/);
});

test("live: the remedy reaches the rendered text through remedyClause, not just the field", async () => {
  // A field nothing renders is a field nobody reads — 254's whole argument for the
  // clause, applied to the host's own answer.
  const reset = await pendingWhenClosed((s) => s.resetAndDestroy());
  assert.match(remedyClause(reset), / — Restart the editor and retry/);
  assert.equal(remedyClause(new BridgeError("bridge_closed", "no remedy on this one")), "");
});

test("live: the message still carries the errno, so the detail and the action are both there", async () => {
  const reset = await pendingWhenClosed((s) => s.resetAndDestroy());
  assert.match(reset.message, /\(read ECONNRESET\)$/);
  const clean = await pendingWhenClosed((s) => s.end());
  assert.equal(clean.message, "Bridge connection closed before a response arrived");
});
