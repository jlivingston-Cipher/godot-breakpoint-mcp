import { test } from "node:test";
import assert from "node:assert/strict";
import { gate } from "../src/confirm.js";

type Server = Parameters<typeof gate>[0];
type ElicitResult = { action: string; content?: Record<string, unknown> };

/**
 * Build a fake McpServer whose elicitInput returns/throws as configured.
 *
 * 🆕 261 — `capabilities` is what the client DECLARED at initialize. `gate` reads it to
 * tell the two throwing cases apart; the default is a client that declares elicitation,
 * because that is the only kind whose answer can be malformed.
 */
function fakeServer(
  elicit: (req: unknown) => Promise<ElicitResult>,
  capabilities: Record<string, unknown> | undefined = { elicitation: {} },
): { server: Server; calls: unknown[] } {
  const calls: unknown[] = [];
  const server = {
    server: {
      elicitInput: async (req: unknown) => {
        calls.push(req);
        return elicit(req);
      },
      getClientCapabilities: () => capabilities,
    },
  } as unknown as Server;
  return { server, calls };
}

test("gate returns null immediately when confirm:true (skips the prompt)", async () => {
  const { server, calls } = fakeServer(async () => ({ action: "accept", content: { proceed: true } }));
  const result = await gate(server, true, "delete node /root/Foo");
  assert.equal(result, null);
  assert.equal(calls.length, 0, "elicitInput must not be called when confirm:true");
});

test("gate returns null when the user accepts and proceed:true", async () => {
  const { server } = fakeServer(async () => ({ action: "accept", content: { proceed: true } }));
  assert.equal(await gate(server, undefined, "delete node"), null);
});

test("gate blocks when the user accepts but proceed:false", async () => {
  const { server } = fakeServer(async () => ({ action: "accept", content: { proceed: false } }));
  const r = await gate(server, undefined, "delete node /root/Foo");
  assert.ok(r, "expected a blocking result");
  assert.equal(r?.isError, true);
  assert.match(r!.content[0].text, /did not approve/i);
  assert.match(r!.content[0].text, /delete node \/root\/Foo/);
});

test("gate blocks when the user declines/cancels the elicitation", async () => {
  const { server } = fakeServer(async () => ({ action: "decline" }));
  const r = await gate(server, undefined, "overwrite scene");
  assert.ok(r);
  assert.equal(r?.isError, true);
  assert.match(r!.content[0].text, /did not approve/i);
});

test("gate blocks with a 'confirm: true' hint when the client cannot elicit", async () => {
  const { server } = fakeServer(async () => {
    throw new Error("Method not found: elicitation/create");
  }, {});   // 261: a client that declared NO elicitation — the only case this sentence is true of
  const r = await gate(server, undefined, "rename symbol");
  assert.ok(r);
  assert.equal(r?.isError, true);
  assert.match(r!.content[0].text, /isn't available on this client/);
  assert.match(r!.content[0].text, /confirm: true/);
  assert.match(r!.content[0].text, /rename symbol/);
});

/**
 * 🔴 261 — ONE `catch`, THREE CAUSES, AND IT NAMED THE ONE THAT POINTS AT THE BYPASS.
 *
 * Measured against the published 1.76.0 with a client that declares elicitation and
 * answers `{action:"accept", content:{confirm:true}}` — an answer that does not satisfy
 * the tool's `requestedSchema`, which requires `proceed`. The SDK throws on validation,
 * the old catch reported "interactive confirmation isn't available on this client", and
 * the single remedy it offered was `confirm: true` — i.e. skip the confirmation the user
 * was in the middle of giving. A gate that misdiagnoses its own failure toward the
 * bypass is failing in the wrong direction.
 */
test("gate does NOT claim the client lacks elicitation when the client declared it and the attempt failed", async () => {
  const { server } = fakeServer(async () => {
    throw new Error('MCP error -32602: Invalid arguments: expected boolean at "proceed"');
  });
  const r = await gate(server, undefined, "set live property /root/Main.counter");
  assert.ok(r);
  assert.equal(r?.isError, true);
  assert.doesNotMatch(
    r!.content[0].text,
    /isn't available on this client/,
    "a client that DECLARED elicitation must not be told it cannot elicit",
  );
  assert.match(r!.content[0].text, /NOTHING WAS DONE/, "the reader's first question is whether it ran");
  assert.match(r!.content[0].text, /proceed/, "the underlying error must reach the reader");
  assert.match(r!.content[0].text, /set live property/, "and the action must still be named");
});

test("gate survives a server that cannot report client capabilities at all", async () => {
  const { server } = fakeServer(async () => {
    throw new Error("transport closed");
  }, undefined);
  const r = await gate(server, undefined, "delete node");
  assert.ok(r);
  assert.equal(r?.isError, true);
  assert.match(r!.content[0].text, /confirm: true/, "unknowable capabilities degrade to the old sentence");
});

test("gate passes the summary into the elicitation prompt message", async () => {
  const { server, calls } = fakeServer(async () => ({ action: "accept", content: { proceed: true } }));
  await gate(server, false, "SUMMARY-XYZ");
  const req = calls[0] as { message?: string };
  assert.match(req.message ?? "", /SUMMARY-XYZ/);
});
