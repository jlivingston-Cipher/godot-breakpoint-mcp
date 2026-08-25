import { test } from "node:test";
import assert from "node:assert/strict";
import { PauseLatch, pauseLatch } from "../src/pause.js";
import { applyPauseLatch } from "../src/mutation-guard.js";
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

test("gate no longer consults the latch — the hold moved to the whole mutating surface", async () => {
  // 🔴 282 — THIS IS THE DEFECT'S OWN TEST, INVERTED ON PURPOSE. It used to
  // assert that `gate()` holds while paused, and that assertion was TRUE and was
  // exactly why the documented guarantee was false: only the 74 gated tools ever
  // reached this seam, so `USER_GUIDE.md` §9's "across the whole tool surface"
  // described a surface `gate()` could not see. The hold now lives in
  // `applyPauseLatch`, and the two tests below drive it over the REAL annotation
  // table rather than over a roster.
  const { server, calls } = fakeServer(async () => ({ action: "accept", content: { proceed: true } }));
  const orig = pauseLatch.awaitResumed.bind(pauseLatch);
  pauseLatch.awaitResumed = async () => false;
  pauseLatch.pause("test");
  try {
    assert.equal(await gate(server, true, "overwrite scene"), null, "confirm:true proceeds; pause is not this seam's question");
    assert.equal(calls.length, 0, "confirm:true still skips elicitation");
  } finally {
    pauseLatch.awaitResumed = orig;
    pauseLatch.resume("test");
  }
});

// ------------------------------------------- applyPauseLatch (the whole surface)

/**
 * A recorder in `registration.test.ts`'s shape: the wrapper under test rewrites
 * `registerTool`, so the only honest way to read what it did is to register
 * through it and call what comes out the far side.
 */
function latchRig(latch: PauseLatch) {
  const handlers = new Map<string, (...a: unknown[]) => Promise<unknown>>();
  const ran: string[] = [];
  const server = {
    registerTool(name: string, _config: unknown, handler: (...a: unknown[]) => Promise<unknown>) {
      handlers.set(name, handler);
      return { name };
    },
  } as unknown as Parameters<typeof applyPauseLatch>[0];
  applyPauseLatch(server, latch);
  const reg = (name: string) =>
    (server as unknown as { registerTool: (n: string, c: unknown, h: unknown) => unknown }).registerTool(
      name,
      { inputSchema: {} },
      async () => {
        ran.push(name);
        return { content: [{ type: "text", text: "did it" }] };
      },
    );
  return { reg, handlers, ran };
}

test("applyPauseLatch HOLDS a mutating tool that never calls gate(), and lets it through on resume", async () => {
  // 🔴 THE MEASURED CASE. On the published 1.82.1 `node_add` and `scene_save`
  // were DISPATCHED at t=1.00s and t=1.50s of a run that was paused from t=0 —
  // neither is confirmation-gated, and neither reached the old seam.
  const l = new PauseLatch({ startPaused: true });
  const rig = latchRig(l);
  rig.reg("node_add");
  const pending = rig.handlers.get("node_add")!({});
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(rig.ran, [], "the handler must NOT have run while paused");
  l.resume("test");
  await pending;
  assert.deepEqual(rig.ran, ["node_add"], "and it runs once the operator resumes");
});

test("applyPauseLatch BLOCKS rather than acts when the wait expires", async () => {
  const l = new PauseLatch({ startPaused: true, waitTimeoutMs: 5 });
  const rig = latchRig(l);
  rig.reg("scene_save");
  const r = (await rig.handlers.get("scene_save")!({})) as { isError?: boolean; content: Array<{ text: string }> };
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Paused/);
  assert.match(r.content[0].text, /scene_save/);
  assert.deepEqual(rig.ran, [], "a timed-out hold blocks; it never falls through to the action");
});

test("applyPauseLatch leaves READ-ONLY tools alone, which is the half that must NOT change", async () => {
  // The refusal beside the pass is what makes the pair evidence (280 §5): a latch
  // that held everything would satisfy the test above and would break every
  // read a paused operator makes to work out what is going on.
  const l = new PauseLatch({ startPaused: true, waitTimeoutMs: 5 });
  const rig = latchRig(l);
  rig.reg("scene_get_tree");
  await rig.handlers.get("scene_get_tree")!({});
  assert.deepEqual(rig.ran, ["scene_get_tree"], "a read-only tool answers while paused");
});
