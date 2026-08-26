import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolsets } from "../src/toolsets.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { applyAnnotations, annotationsFor, ANNOTATED_TOOLS } from "../src/annotations.js";
import { applyDestructiveGate, applyPauseLatch, declaresConfirm } from "../src/mutation-guard.js";
import { PauseLatch } from "../src/pause.js";
import { loadConfig } from "../src/config.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * mutation_guard.test.ts — session 282.
 *
 * 🔴 THE POPULATION IS THE REAL REGISTRY AND NOT A ROSTER, WHICH IS THE ONLY
 * REASON THIS FILE IS EVIDENCE. Both shipped sentences these guards make true
 * were false about a set nobody had enumerated: 23 of 89 destructive tools took
 * no `confirm`, and 111 of the 279 secure-default tools mutated while paused.
 * A test written against a list of tool names would have been green about the
 * same wrong population — 281 §2.2's four drafts, one plane over. So the harness
 * drives `buildToolsets`, the same ordered registry `index.ts` drives, and asks
 * every tool that comes out of it.
 */

/**
 * A throwaway project directory for the probe, and it is not optional.
 *
 * 🔴 THIS PROBE IS THE MOST DESTRUCTIVE THING IN THE SUITE, WHICH IS THE POINT
 * OF IT AND WAS ALSO ITS FIRST DEFECT. It calls EVERY tool annotated
 * `destructiveHint: true`. Most of them relay through a bridge that is a stub
 * here and do nothing — but the `vcs_*` family shells out to `git` HOST-SIDE
 * against `cfg.projectPath`, and `vcs_stash` gates only `op=drop` on purpose
 * (`vcs.ts`: "push/pop/list ungated; drop GATED"). The first run of this file
 * therefore executed `git stash push` in the working tree of THIS REPOSITORY and
 * took the whole session's uncommitted work with it. Recovered from
 * `refs/stash`; the repair is that the probe never points at a real project.
 *
 * 🔵 AND IT IS ASSERTED RATHER THAN ARRANGED, because an arrangement is a thing
 * a later edit can quietly stop doing — 267's rule about `git reset --hard`
 * spelled for a test harness.
 */
function probeProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-guard-probe-"));
  assert.ok(!fs.existsSync(path.join(dir, ".git")), "the probe's project must not be a git working tree");
  return dir;
}

/** Register the whole surface through the guards and keep what came out. */
function registerGuarded(latch?: PauseLatch) {
  const calls: Array<{ name: string; config: Record<string, unknown>; handler: (...a: unknown[]) => unknown }> = [];
  const ran: string[] = [];
  const elicited: unknown[] = [];
  const server = {
    registerTool(name: string, config: Record<string, unknown>, handler: (...a: unknown[]) => unknown) {
      calls.push({ name, config, handler });
      return { name };
    },
    registerResource() {},
    experimental: {
      tasks: {
        registerToolTask(name: string, config: Record<string, unknown>, handler: (...a: unknown[]) => unknown) {
          calls.push({ name, config, handler });
          return { name };
        },
      },
    },
    // A client that CANNOT elicit — the degradation `confirm.ts` documents, and
    // the one every non-interactive agent runner actually presents.
    server: {
      elicitInput: async (req: unknown) => {
        elicited.push(req);
        throw new Error("this client does not support elicitation");
      },
    },
  };
  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;

  // Every tool this file drives resolves paths and runs commands against
  // `cfg.projectPath`. It is a fresh empty directory for the length of the
  // registration, and the environment is put back afterwards.
  const priorProject = process.env.GODOT_PROJECT;
  process.env.GODOT_PROJECT = probeProject();

  applyOutputSchemas(mcp);
  applyAnnotations(mcp);
  applyDestructiveGate(mcp);
  applyPauseLatch(mcp, latch ?? new PauseLatch());

  // The handler each toolset hands in is replaced by the wrappers above, so what
  // `calls` holds is the guarded handler — call it and you are calling the tool
  // exactly as `tools/call` would. The bodies never reach a bridge: every guard
  // under test answers before the handler runs, and the ones that do run are
  // recorded rather than dispatched.
  const toolsets = buildToolsets({
    server: mcp,
    bridge: stub,
    runtime: stub,
    lsp: stub,
    csLsp: stub,
    dap: stub,
    csDap: stub,
    config: loadConfig(),
  });
  for (const ts of toolsets) ts.run();
  if (priorProject === undefined) delete process.env.GODOT_PROJECT;
  else process.env.GODOT_PROJECT = priorProject;
  return { calls, ran, elicited };
}

/**
 * The smallest argument bag a tool's own input schema accepts.
 *
 * 🔴 `{}` WAS NOT GOOD ENOUGH AND THE REASON IS ITSELF A FINDING. Seven
 * destructive tools gate through a SHARED helper — `scaffold()` in `backend.ts`,
 * the `asset_gen_*` writer — and that helper builds its confirmation summary
 * from the arguments BEFORE it calls `gate()`. Probed with an empty bag they
 * throw on `opts.kind` rather than reaching the gate, and a test that read the
 * throw as a refusal would have been green about tools it never actually
 * exercised. The bag is therefore DERIVED from each tool's registered zod shape,
 * so what is driven is the real handler with arguments it would really receive.
 *
 * Only REQUIRED fields are filled: `confirm` is optional everywhere and stays
 * absent, which is the whole condition under test.
 */
function minimalArgs(config: { inputSchema?: Record<string, unknown> }): Record<string, unknown> {
  const shape = config.inputSchema ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(shape)) {
    const s = schema as { safeParse?: (v: unknown) => { success: boolean }; _zod?: { def?: { type?: string; entries?: Record<string, unknown> } } };
    if (s.safeParse?.(undefined).success) continue; // optional — leave it out
    out[key] = /path/i.test(key) ? "res://probe_arg.tscn" : sampleFor(s);
  }
  return out;
}

function sampleFor(s: { _zod?: { def?: { type?: string; entries?: Record<string, unknown>; element?: unknown; innerType?: unknown } } }): unknown {
  const def = s._zod?.def;
  switch (def?.type) {
    case "string": return "x";
    case "number": case "int": case "bigint": return 1;
    case "boolean": return false;
    case "array": return [];
    case "object": case "record": return {};
    case "enum": return Object.values(def.entries ?? { a: "a" })[0];
    case "literal": return (def as unknown as { values?: unknown[] }).values?.[0] ?? "x";
    case "union": return "x";
    case "nullable": return null;
    default: return "x";
  }
}

/**
 * Call a registered tool the way `tools/call` would, whatever shape its handler
 * is. A plain tool's handler IS the entry point; a D2 task tool's is a
 * `{ createTask, getTask, getTaskResult }` bag whose `createTask` starts the work.
 */
async function callEntry(handler: unknown, args: Record<string, unknown> = {}): Promise<unknown> {
  if (typeof handler === "function") return (handler as (...a: unknown[]) => unknown)(args, { signal: undefined });
  const h = handler as { createTask?: (...a: unknown[]) => unknown };
  if (typeof h?.createTask === "function") return h.createTask(args, { signal: undefined });
  throw new Error("UNGUARDED_HANDLER_SHAPE: neither a function nor a task handler");
}

test("every registered handler has a shape the guards understand", () => {
  // 🔴 THE CLAIM THE FIRST DRAFT OF THIS FILE NEEDED AND DID NOT HAVE. Both
  // guards fell through on any handler that was not a function, and the three D2
  // task tools are objects — so the guards declined to cover
  // `godot_run_headless_script`, which EXECUTES a GDScript, and said nothing.
  // A wrapper that skips what it does not recognise is a wrapper whose coverage
  // is unmeasurable; this is the reading that makes it measurable.
  const { calls } = registerGuarded();
  const alien = calls
    .filter((c) => {
      const h = c.handler as unknown as { createTask?: unknown };
      return typeof c.handler !== "function" && typeof h?.createTask !== "function";
    })
    .map((c) => c.name);
  assert.ok(calls.length > 250, `the walk reached ${calls.length} registration(s)`);
  assert.deepEqual(alien, [], `handler shape(s) neither guard can wrap: ${alien.join(", ")}`);
  // POSITIVE CONTROL — an empty list is the answer whether the filter works or reads
  // nothing at all, so the same predicate is shown finding a shape it should reject.
  const shapes = [{ handler: () => 0 }, { handler: { createTask: () => 0 } }, { handler: { poll: () => 0 } }];
  const rejected = shapes.filter((c) => {
    const h = c.handler as { createTask?: unknown };
    return typeof c.handler !== "function" && typeof h?.createTask !== "function";
  });
  assert.equal(rejected.length, 1, "the predicate rejects a handler that is neither shape");
});

test("a gated TASK tool REFUSES in the task model's own currency", async () => {
  // 🔴 284, MEASURED AGAINST A LIVE GODOT 4.7 BEFORE IT WAS UNDERSTOOD HERE.
  // 282 gave both guards a task-handler branch — because `typeof handler !==
  // "function"` is fail-open and `godot_run_headless_script` had fallen through
  // both — and drove only the PASS-THROUGH half. The other direction, the guard
  // actually blocking, could not be called from a container.
  //
  // `createTask` has a return type and the SDK reads `.task.taskId` straight off
  // it. Returning the gate's ToolResult there dereferences `undefined`, so a
  // caller who omitted `confirm` got `Cannot read properties of undefined
  // (reading 'taskId')` — a raw JS TypeError with no prompt, no remedy, and
  // nothing naming the tool. With `confirm: true` the identical call ran fine.
  const { calls } = registerGuarded();
  const gatedTasks = calls.filter((c) => {
    const h = c.handler as unknown as { createTask?: unknown };
    return typeof h?.createTask === "function" && annotationsFor(c.name).destructiveHint;
  });
  // The population is derived, not typed, and it is asserted NON-EMPTY: a filter
  // that matched nothing would make every assertion below vacuously true, which
  // is how this class of test goes quiet.
  assert.ok(gatedTasks.length >= 1,
    `no destructive task-registered tool found — this claim would pass over an empty set`);

  for (const c of gatedTasks) {
    const stored: Array<{ taskId: string; status: string; result: unknown }> = [];
    const taskStore = {
      createTask: async () => ({ taskId: "t-1", status: "working" }),
      getTask: async () => ({ taskId: "t-1" }),
      getTaskResult: async () => ({}),
      storeTaskResult: async (taskId: string, status: string, result: unknown) => {
        stored.push({ taskId, status, result });
      },
    };
    const h = c.handler as unknown as { createTask: (...a: unknown[]) => Promise<unknown> };
    const out = await h.createTask({}, { taskStore, taskId: "t-1", signal: undefined });

    // 1 — it must answer in the shape `createTask` promises, or the SDK reads
    //     `.taskId` off undefined and the user sees a TypeError.
    assert.ok(out && typeof out === "object" && "task" in (out as object),
      `${c.name}: a blocked createTask returned ${JSON.stringify(out)}, not { task }`);

    // 2 — and the refusal must actually be delivered, as a FAILED task result,
    //     so a plain client's auto-poll returns the same text every other gated
    //     tool returns. A `{ task }` that never settles is a hang, not a refusal.
    assert.equal(stored.length, 1, `${c.name}: the refusal was not stored as a task result`);
    assert.equal(stored[0].status, "failed", `${c.name}: refusal stored as ${stored[0].status}`);
    const text = JSON.stringify(stored[0].result);
    assert.match(text, /confirm/i, `${c.name}: the stored refusal does not mention confirm: ${text}`);
  }
});

test("EVERY destructive tool on the registered surface accepts `confirm`", () => {
  // docs/TOOL_CATALOG.md: "Every tool flagged destructive accepts an optional
  // `confirm: boolean`". Measured false on the published 1.82.1 for 23 tools —
  // `tilemap_clear`'s input properties were `['path']`, with no `confirm` for a
  // caller to pass.
  const { calls } = registerGuarded();
  const missing = calls
    .filter((c) => annotationsFor(c.name).destructiveHint && !declaresConfirm(c.config))
    .map((c) => c.name)
    .sort();
  assert.ok(calls.length > 250, `the walk reached ${calls.length} registration(s)`);
  assert.deepEqual(missing, [], `destructive tool(s) with no \`confirm\` parameter: ${missing.join(", ")}`);
  // POSITIVE CONTROL — `declaresConfirm` is what the emptiness above rests on, so it is
  // shown answering NO on a config with the field removed. Without this the assertion
  // is equally green against a reader that says yes to everything.
  const sample = calls.find((c) => annotationsFor(c.name).destructiveHint)!;
  const stripped = { ...sample.config, inputSchema: {} };
  assert.equal(declaresConfirm(sample.config), true, `${sample.name} declares confirm`);
  assert.equal(declaresConfirm(stripped), false, "and the same reader refuses a config without it");
});

/**
 * What one destructive tool did when called with NO `confirm`.
 *
 * 🔴 THE THIRD STATE IS NAMED RATHER THAN HIDDEN, AND THE PROBE'S FIRST DRAFT
 * DID NOT HAVE IT. Driven with no confirm, 28 destructive tools answered
 * something that was not a confirmation refusal — and every one of them was a
 * tool whose PATH GUARD ran first, which `resource.ts` says out loud it does on
 * purpose (163 §3: a call that can never legally succeed should not first ask a
 * human to approve it). A probe with two buckets would have called those 28
 * defects; a probe that silently accepted any `isError` would have called a tool
 * that never gates at all a pass. So the classification is three-valued, and
 * `PRE_REFUSED` is a state this reader can SEE but cannot see PAST — declared as
 * a blind spot with a floor under the population it does resolve, on 277's rule
 * that a reader with two states for three outcomes reports one of them wrongly.
 */
type GateVerdict = "GATED" | "PRE_REFUSED" | "NO_OP" | "DISPATCHED";

/**
 * The five tools whose un-confirmed call answers WITHOUT ERROR and without the
 * gate having decided anything — measured, with the reason, on
 * `NOT_A_TARGET`'s convention that an exemption is measured before it is
 * written down.
 *
 * `asset_gen_*` return `status: "no_backend"` before `gate()` when no generation
 * backend is configured, and `assetgen.ts` says why on the line above it:
 * *"Degrade path — no file written, no confirmation needed."* That is correct —
 * asking a human to approve an action the tool has already decided not to take
 * is the same defect as 163 §3's, in the other direction — and it is the ONE
 * shape this probe cannot tell apart from a tool that acted, so it is named
 * here rather than absorbed into a pass.
 */
const NO_OP_WITHOUT_A_BACKEND = new Set([
  "asset_gen_sprite", "asset_gen_texture", "asset_gen_icon", "asset_gen_audio_sfx", "asset_gen_model",
]);

/**
 * What one destructive tool did when called with NO `confirm`, on a client that
 * cannot elicit.
 *
 * 🔴 THE SIGNAL FOR *THE GATE RAN* IS THE ELICITATION ATTEMPT, NOT THE ANSWER,
 * and the first draft of this probe got that wrong. Read off the RESULT, a gate
 * that ran and a path guard that refused first look the same — 28 tools came
 * back indistinguishable, every one of them a `resolveInsideProject` refusal
 * that `resource.ts` performs before `gate()` deliberately (163 §3: a call that
 * can never legally succeed should not first ask a human to approve it). The
 * elicitation attempt is a fact about the SEAM rather than about the outcome,
 * and it is the only observation here that separates the two.
 *
 * 🔴 AND THE THIRD AND FOURTH STATES ARE DERIVED, NOT ROSTERED. `PRE_REFUSED` is
 * *the same error with and without confirm* — confirmation could not have
 * changed it — so a new path guard joins that class by behaving like one.
 * `NO_OP` is *the same NON-error*, which is the one class a reader cannot tell
 * from acting, and it carries the roster above.
 */
async function probeGate(
  c: { name: string; config: Record<string, unknown>; handler: unknown },
  elicited: unknown[],
): Promise<GateVerdict> {
  const args = minimalArgs(c.config);
  const asText = (r: unknown): string => {
    const x = r as { isError?: boolean; content?: Array<{ text?: string }> };
    return `${x?.isError === true ? "E:" : "-:"}${JSON.stringify(x?.content?.[0]?.text ?? "")}`;
  };
  const safe = async (a: Record<string, unknown>): Promise<string> =>
    asText(await callEntry(c.handler, a).catch((e) => ({ isError: true, content: [{ text: `THREW ${String(e)}` }] })));

  const before = elicited.length;
  const without = await safe(args);
  if (elicited.length > before) return "GATED";
  const withC = await safe({ ...args, confirm: true });
  if (without !== withC) return "DISPATCHED";
  return without.startsWith("E:") ? "PRE_REFUSED" : "NO_OP";
}

test("NO destructive tool executes without confirmation on a client that cannot elicit", async () => {
  // docs/TOOL_CATALOG.md: "a destructive op is never executed silently". Measured
  // false on the published 1.82.1: `tilemap_clear` and `node_change_type`
  // DISPATCHED against a client declaring no elicitation capability, in the same
  // run where `node_delete` correctly refused.
  const { calls, elicited } = registerGuarded();
  const destructive = calls.filter((c) => annotationsFor(c.name).destructiveHint);
  assert.ok(destructive.length >= 80, `expected the destructive surface, got ${destructive.length}`);
  const verdicts = new Map<string, GateVerdict>();
  for (const c of destructive) verdicts.set(c.name, await probeGate(c, elicited));

  assert.ok(verdicts.size >= 80, `the probe classified ${verdicts.size} destructive tool(s)`);
  const dispatched = [...verdicts].filter(([, v]) => v === "DISPATCHED").map(([n]) => n).sort();
  assert.deepEqual(dispatched, [], `destructive tool(s) that ran without confirmation: ${dispatched.join(", ")}`);
  // POSITIVE CONTROL — `DISPATCHED` is the verdict the emptiness above claims nothing
  // earns, so something has to earn it. A handler that IGNORES the gate and answers
  // differently with and without `confirm` is exactly the shape `tilemap_clear` was in
  // on 1.82.1, and `probeGate` must classify it that way.
  const ungated = {
    name: "node_delete", config: { inputSchema: {} },
    handler: async (a: { confirm?: boolean }) => ({ content: [{ type: "text", text: a?.confirm ? "confirmed" : "did it anyway" }] }),
  };
  assert.equal(await probeGate(ungated, elicited), "DISPATCHED",
    "the classifier must be able to return DISPATCHED, or the assertion above is about nothing");

  // The unresolvable class is a ROSTER with a reason, in both directions: a new
  // member is a tool nobody looked at, and a member that stops being one is an
  // exemption whose reason expired (279 §9).
  const noOp = [...verdicts].filter(([, v]) => v === "NO_OP").map(([n]) => n).sort();
  assert.deepEqual(noOp, [...NO_OP_WITHOUT_A_BACKEND].sort(),
    "the set this probe cannot resolve moved — measure the change before rostering it");

  // 🔴 AND A FLOOR UNDER THE POPULATION THE PROBE ACTUALLY RESOLVED. `PRE_REFUSED`
  // is a pass this reader cannot verify, and a build that turned every tool into
  // one would satisfy the assertion above while gating nothing — 280 §5, a
  // constant compared against itself is not a pin.
  const gated = [...verdicts].filter(([, v]) => v === "GATED").length;
  assert.ok(gated >= 50, `only ${gated} of ${destructive.length} destructive tools were OBSERVED to gate`);
});

test("the tools this session GAVE a gate are observed to gate, one by one", async () => {
  // The finding named 23 ungated destructive tools; 12 of them are on the
  // secure-default surface and the rest sit in higher-trust groups. Driven
  // individually rather than counted — including `godot_run_headless_script`,
  // whose handler is an OBJECT and which both guards originally declined to wrap.
  const { calls, elicited } = registerGuarded();
  const byName = new Map(calls.map((c) => [c.name, c]));
  const NEWLY_GATED = [
    "anim_remove_key", "godot_stop", "node_change_type", "node_remove_from_group",
    "runtime_peer_stop", "shadermaterial_create", "shadermaterial_set_param",
    "shadermaterial_set_shader", "signal_disconnect", "tilemap_clear",
    "tilemap_set_cell", "tilemap_set_cells_rect", "godot_run_headless_script",
  ];
  for (const name of NEWLY_GATED) {
    const c = byName.get(name);
    assert.ok(c, `${name} is not on the registered surface`);
    assert.equal(declaresConfirm(c!.config), true, `${name} must accept confirm`);
    assert.equal(await probeGate(c!, elicited), "GATED", `${name} must refuse without confirmation`);
  }
});

test("a READ-ONLY tool is given neither guard — the direction that must not change", async () => {
  // 280 §5: a constant compared against itself is not a pin. The two claims above
  // are only evidence because this one holds at the same time — a build that
  // gated and held everything would satisfy both and would be unusable.
  const paused = new PauseLatch({ startPaused: true, waitTimeoutMs: 5 });
  const { calls } = registerGuarded(paused);
  const readOnly = calls.filter((c) => annotationsFor(c.name).readOnlyHint);
  assert.ok(readOnly.length > 80, `expected the read-only surface, got ${readOnly.length}`);
  for (const c of readOnly) {
    assert.equal(declaresConfirm(c.config) && !DECLARES_CONFIRM_NATIVELY.has(c.name), false,
      `${c.name} is read-only and was given a confirmation gate`);
  }
  // And a read-only tool answers while the agent is PAUSED, which is the whole
  // reason the latch is scoped by `readOnlyHint` rather than applied to all.
  const probe = readOnly.find((c) => c.name === "godot_version")!;
  const out = await callEntry(probe.handler);
  assert.ok(out, "a read-only tool must not be held by the pause latch");
});

/**
 * Read-only tools that declared `confirm` before this session — none, measured.
 * Kept as a named empty set rather than dropped, so a future tool that arrives
 * read-only AND confirmation-taking has to be looked at rather than absorbed.
 */
const DECLARES_CONFIRM_NATIVELY = new Set<string>([]);

test("the annotation roster covers every registered tool — the guards' population IS this table", () => {
  // 🔴 BOTH GUARDS DERIVE FROM `annotationsFor`, WHICH ANSWERS FOR ANY STRING:
  // a name absent from the roster comes back `readOnlyHint: false` (held, which
  // is fail-safe) and `destructiveHint: false` (ungated, which is NOT). So the
  // roster's completeness stopped being a documentation property this session
  // and became a safety one, and it is asserted here rather than assumed.
  const { calls } = registerGuarded();
  const roster = new Set(ANNOTATED_TOOLS);
  assert.ok(calls.length > 250, `the walk reached ${calls.length} registration(s)`);
  const unrostered = calls.map((c) => c.name).filter((n) => !roster.has(n)).sort();
  assert.deepEqual(unrostered, [], `registered but unannotated: ${unrostered.join(", ")}`);
  // POSITIVE CONTROL — the roster is what makes the emptiness meaningful, so it is shown
  // refusing a name. A `roster` that had gone empty would satisfy nothing here.
  assert.ok(roster.size > 200, `the annotation roster holds ${roster.size} name(s)`);
  assert.equal(roster.has("no_such_tool_282"), false, "and it is a real membership test");
  assert.deepEqual(["no_such_tool_282"].filter((n) => !roster.has(n)), ["no_such_tool_282"],
    "the same filter that returned [] does flag an unrostered name");
});
