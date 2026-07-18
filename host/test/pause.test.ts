import { test } from "node:test";
import assert from "node:assert/strict";
import { PauseLatch, pauseLatch } from "../src/pause.js";
import { gate } from "../src/confirm.js";

// ---------------------------------------------------------------- PauseLatch --

test("awaitResumed resolves true immediately when not paused", async () => {
  const l = new PauseLatch();
  assert.equal(l.isPaused(), false);
  assert.equal(await l.awaitResumed(5), true);
});

test("start-paused holds; awaitResumed times out to false while still paused", async () => {
  const l = new PauseLatch({ startPaused: true });
  assert.equal(l.isPaused(), true);
  assert.equal(await l.awaitResumed(20), false);
  assert.equal(l.isPaused(), true, "timing out does NOT auto-resume");
});

test("resume releases a waiting awaitResumed with true", async () => {
  const l = new PauseLatch({ startPaused: true });
  const p = l.awaitResumed(1000);
  l.resume("test");
  assert.equal(await p, true);
  assert.equal(l.isPaused(), false);
});

test("resume releases ALL pending waiters", async () => {
  const l = new PauseLatch({ startPaused: true });
  const ps = [l.awaitResumed(1000), l.awaitResumed(1000), l.awaitResumed(1000)];
  l.resume();
  assert.deepEqual(await Promise.all(ps), [true, true, true]);
});

test("toggle flips the paused state", () => {
  const l = new PauseLatch();
  assert.equal(l.isPaused(), false);
  l.toggle();
  assert.equal(l.isPaused(), true);
  l.toggle();
  assert.equal(l.isPaused(), false);
});

test("pause/resume are idempotent", () => {
  const l = new PauseLatch();
  l.resume(); // no-op when not paused
  assert.equal(l.isPaused(), false);
  l.pause();
  l.pause();
  assert.equal(l.isPaused(), true);
});

test("activity ring records, caps to activityCap, and reports recent + latestSeq", () => {
  const l = new PauseLatch({ activityCap: 3 });
  assert.deepEqual(l.recent(), []);
  l.record("a");
  l.record("b");
  l.record("c");
  l.record("d");
  assert.equal(l.latestSeq(), 4, "seq counts every record, even dropped ones");
  assert.deepEqual(l.recent(10).map((e) => e.action), ["b", "c", "d"], "oldest dropped at cap");
  assert.deepEqual(l.recent(2).map((e) => e.action), ["c", "d"]);
  const last = l.recent(1)[0];
  assert.equal(typeof last.seq, "number");
  assert.equal(typeof last.at, "number");
});

// ------------------------------------------------ gate() integration (singleton)

type ElicitResult = { action: string; content?: Record<string, unknown> };
function fakeServer(elicit: (req: unknown) => Promise<ElicitResult>): {
  server: Parameters<typeof gate>[0];
  calls: unknown[];
} {
  const calls: unknown[] = [];
  const server = {
    server: {
      elicitInput: async (req: unknown) => {
        calls.push(req);
        return elicit(req);
      },
    },
  } as unknown as Parameters<typeof gate>[0];
  return { server, calls };
}

test("gate proceeds normally when the latch is not paused", async () => {
  assert.equal(pauseLatch.isPaused(), false);
  const { server } = fakeServer(async () => ({ action: "accept", content: { proceed: true } }));
  assert.equal(await gate(server, true, "delete node"), null);
});

test("gate holds while paused, then proceeds once resumed", async () => {
  const { server } = fakeServer(async () => ({ action: "accept", content: { proceed: true } }));
  pauseLatch.pause("test");
  const pending = gate(server, true, "set property"); // confirm:true, but pause is checked first
  setTimeout(() => pauseLatch.resume("test"), 10); // operator resumes while the call is held
  assert.equal(await pending, null, "held gate proceeds after resume");
  assert.equal(pauseLatch.isPaused(), false);
});

test("gate blocks (never elicits/executes) when paused and the wait expires", async () => {
  const { server, calls } = fakeServer(async () => ({ action: "accept", content: { proceed: true } }));
  const orig = pauseLatch.awaitResumed.bind(pauseLatch);
  pauseLatch.awaitResumed = async () => false; // force a deterministic, fast timeout
  pauseLatch.pause("test");
  try {
    const r = await gate(server, true, "overwrite scene");
    assert.ok(r, "expected a blocking result");
    assert.equal(r?.isError, true);
    assert.match(r!.content[0].text, /Paused/);
    assert.match(r!.content[0].text, /overwrite scene/);
    assert.equal(calls.length, 0, "must not elicit while paused (pause overrides confirm:true)");
  } finally {
    pauseLatch.awaitResumed = orig;
    pauseLatch.resume("test");
  }
});
