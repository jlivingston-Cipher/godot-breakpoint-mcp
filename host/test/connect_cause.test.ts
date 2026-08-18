import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { BridgeClient, BridgeError, remedyClause } from "../src/bridge.js";
import {
  REFUSED_CONNECT_CODES,
  UNRESOLVED_HOST_CODES,
  classifyConnect,
  connectHint,
  connectRemedy,
} from "../src/connect-cause.js";

/**
 * 🔴 THE CLAIM UNDER TEST, AND WHY IT NEEDS BOTH DIRECTIONS (265).
 *
 * Before this, a port nothing was listening on and a host name that never resolved
 * produced `bridge_unavailable` and the SAME appended hint:
 *
 * ```
 * Cannot reach the Godot editor bridge at 127.0.0.1:43305.            Is the editor open …? (connect ECONNREFUSED …)
 * Cannot reach the Godot editor bridge at not-a-real-host.invalid:6010. Is the editor open …? (getaddrinfo ENOTFOUND …)
 * ```
 *
 * and the second one is a FALSE CLAIM, not merely a vague one: on ENOTFOUND no packet
 * left the machine, so whether the editor is open had no bearing on the failure.
 *
 * Every claim here is asserted in BOTH directions and the pair is asserted to DIFFER —
 * 264's rule, kept: a test that only checked the unresolved case would pass against a
 * build that suppressed the hint unconditionally, which is a worse defect than the one
 * being fixed.
 */

const errno = (code: string, message: string) => Object.assign(new Error(message), { code });
const HINT = 'Is the editor open with the "Breakpoint MCP" plugin enabled?';

// ------------------------------------------------------------ the classifier ----

test("classifyConnect: the refused family classifies refused", () => {
  for (const code of REFUSED_CONNECT_CODES) {
    assert.equal(classifyConnect(errno(code, `connect ${code} 127.0.0.1:1`)), "refused", `${code} should be refused`);
  }
});

test("classifyConnect: the unresolved family classifies unresolved", () => {
  for (const code of UNRESOLVED_HOST_CODES) {
    assert.equal(classifyConnect(errno(code, `getaddrinfo ${code} nope.invalid`)), "unresolved", `${code} should be unresolved`);
  }
});

test("classifyConnect: an errno outside the two measured families is UNCLASSIFIED, not guessed", () => {
  // 🔴 264 §3.3's rule, kept. 265 drove ECONNREFUSED and ENOTFOUND and can speak for two.
  // EHOSTUNREACH, ETIMEDOUT, EACCES and EAI_AGAIN are all plausible at this site and NONE
  // was produced — this container's egress answers an unroutable address with
  // ECONNREFUSED, so the case could not be driven honestly. A third family inheriting a
  // sentence by default would be a claim nobody made wearing the authority of one that was.
  for (const code of ["EHOSTUNREACH", "ETIMEDOUT", "EACCES", "EAI_AGAIN"]) {
    const e = errno(code, `connect ${code}`);
    assert.equal(classifyConnect(e), "unclassified", `${code} must not be spoken for`);
    assert.equal(connectRemedy(e, "the editor", "BREAKPOINT_BRIDGE_HOST"), undefined);
    assert.equal(connectHint(e, HINT), HINT, `${code} must keep the shipped hint untouched`);
  }
});

test("classifyConnect: an absent cause is unclassified, not a fourth family invented for the slot", () => {
  // 🔴 THE ASYMMETRY WITH classifyClose IS DELIBERATE. There, a missing error MEANS
  // something — an orderly `end()` leaves no errno — so `undefined` maps to "deliberate".
  // A connect that fails always fails WITH an error, so here the same input means only
  // that something unexpected happened, and it gets no sentence.
  assert.equal(classifyConnect(undefined), "unclassified");
  assert.equal(connectRemedy(undefined, "the editor", "BREAKPOINT_BRIDGE_HOST"), undefined);
});

// ---------------------------------------------------------------- the hint ----

test("connectHint: suppressed for unresolved, BYTE-IDENTICAL for everything else", () => {
  const refused = errno("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:1");
  const unresolved = errno("ENOTFOUND", "getaddrinfo ENOTFOUND nope.invalid");
  assert.equal(connectHint(refused, HINT), HINT, "the refused case's hint is exactly right and must not move");
  assert.equal(connectHint(unresolved, HINT), "", "a hint about a peer that was never contacted must go");
  assert.notEqual(connectHint(refused, HINT), connectHint(unresolved, HINT));
});

// -------------------------------------------------------------- the remedy ----

test("connectRemedy: the two measured causes give DIFFERENT next actions", () => {
  const refused = connectRemedy(errno("ECONNREFUSED", "connect ECONNREFUSED"), "the editor", "BREAKPOINT_BRIDGE_HOST");
  const unresolved = connectRemedy(errno("ENOTFOUND", "getaddrinfo ENOTFOUND"), "the editor", "BREAKPOINT_BRIDGE_HOST");
  assert.ok(refused, "a refused connect must name a next action");
  assert.ok(unresolved, "an unresolved host must name a next action");
  assert.notEqual(refused, unresolved, "the two causes must not produce the same sentence");
  assert.match(refused, /^Start the editor and retry/);
  assert.match(unresolved, /^Check BREAKPOINT_BRIDGE_HOST/);
});

test("connectRemedy: names the HOST KNOB it was given, so each instance speaks of its own", () => {
  // The per-instance argument `deadlineKnob` already makes: the runtime bridge and its
  // peers are addressed by BREAKPOINT_RUNTIME_HOST, and a sentence naming the editor's
  // variable sends the operator to a knob that cannot move the address they just missed.
  const e = errno("ENOTFOUND", "getaddrinfo ENOTFOUND nope.invalid");
  assert.match(connectRemedy(e, "the editor", "BREAKPOINT_BRIDGE_HOST") ?? "", /BREAKPOINT_BRIDGE_HOST/);
  assert.match(connectRemedy(e, "the running game", "BREAKPOINT_RUNTIME_HOST") ?? "", /BREAKPOINT_RUNTIME_HOST/);
  assert.ok(!(connectRemedy(e, "the running game", "BREAKPOINT_RUNTIME_HOST") ?? "").includes("BREAKPOINT_BRIDGE_HOST"));
});

test("connectRemedy: names the peer it was given", () => {
  for (const peer of ["the editor", "the running game", "peer peer-1"]) {
    assert.match(connectRemedy(errno("ECONNREFUSED", "x"), peer, "BREAKPOINT_BRIDGE_HOST") ?? "", new RegExp(peer));
  }
});

test("connectRemedy: every sentence it produces ends in a full stop (check 28's grammar)", () => {
  for (const code of ["ECONNREFUSED", "ENOTFOUND"]) {
    const s = connectRemedy(errno(code, "x"), "the editor", "BREAKPOINT_BRIDGE_HOST");
    assert.ok(s?.endsWith("."), `remedy must end in a full stop: ${s}`);
  }
});

test("connectRemedy: the refused sentence does not repeat the errno the message already printed", () => {
  const s = connectRemedy(errno("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:1"), "the editor", "BREAKPOINT_BRIDGE_HOST");
  assert.ok(!(s ?? "").includes("ECONNREFUSED"));
});

// --------------------------------------------------- live, over a real socket ----

async function failedConnect(host: string, port: number, hint = HINT): Promise<BridgeError> {
  const client = new BridgeClient(host, port, 2000, "editor bridge", hint);
  try {
    await client.request("editor.ping");
    throw new Error("the request resolved; it was supposed to fail to connect");
  } catch (e) {
    client.close();
    return e as BridgeError;
  }
}

/** A loopback port that was bound long enough to learn its number, then released. */
async function deadPort(): Promise<number> {
  return await new Promise((res) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const p = (srv.address() as net.AddressInfo).port;
      srv.close(() => res(p));
    });
  });
}

test("live: a refused port and an unresolved host are told apart", async () => {
  const refused = await failedConnect("127.0.0.1", await deadPort());
  const unresolved = await failedConnect("not-a-real-host.invalid", 6010);

  // Same code — callers and tests branch on it, and 265 did not move it.
  assert.equal(refused.code, "bridge_unavailable");
  assert.equal(unresolved.code, "bridge_unavailable");

  // 🔴 AND NOW A DIFFERENT ANSWER, where before there was one hint for both.
  assert.ok(refused.remedy, "a refused connect must carry a next action");
  assert.ok(unresolved.remedy, "an unresolved host must carry a next action");
  assert.notEqual(refused.remedy, unresolved.remedy);
  assert.match(refused.remedy!, /^Start the editor and retry/);
  assert.match(unresolved.remedy!, /^Check BREAKPOINT_BRIDGE_HOST/);
});

test("live: the refused message is byte-identical to what shipped, hint and all", async () => {
  const port = await deadPort();
  const refused = await failedConnect("127.0.0.1", port);
  assert.equal(
    refused.message,
    `Cannot reach the Godot editor bridge at 127.0.0.1:${port}. ${HINT} (connect ECONNREFUSED 127.0.0.1:${port})`,
  );
});

test("live: the unresolved message no longer claims anything about the editor", async () => {
  const unresolved = await failedConnect("not-a-real-host.invalid", 6010);
  // 🔴 BOTH DIRECTIONS. The false sentence is gone AND the errno the caller needs is
  // still there — a fix that dropped the parenthetical too would be a different defect.
  assert.ok(!unresolved.message.includes("Is the editor open"), "the hint about a peer never contacted must be gone");
  assert.match(unresolved.message, /\(getaddrinfo ENOTFOUND not-a-real-host\.invalid\)$/);
  assert.ok(!unresolved.message.includes("  "), "suppressing the hint must not leave a double space");
});

test("live: the remedy reaches the rendered text through remedyClause, not just the field", async () => {
  // 264 §1.2: a next action in a message BODY is subject to no reader in this repository.
  // The field is the channel that IS read, and this asserts the answer arrives through it.
  const unresolved = await failedConnect("not-a-real-host.invalid", 6010);
  assert.match(remedyClause(unresolved), / — Check BREAKPOINT_BRIDGE_HOST/);
  assert.equal(remedyClause(new BridgeError("bridge_unavailable", "no remedy on this one")), "");
});
