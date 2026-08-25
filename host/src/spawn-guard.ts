import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

/**
 * spawn-guard.ts — session 282. THE ONE THING A MISCONFIGURED USER DOES FIRST.
 *
 * 🔴 MEASURED AT 282 BY INSTALLING THE PUBLISHED TARBALL AND FOLLOWING
 * `USER_GUIDE.md`. `GODOT_BIN` pointing at a path that does not exist — the
 * single most likely first-run misconfiguration, and the one the README itself
 * anticipates ("Set `GODOT_BIN` if `godot` isn't on your `PATH`") — took the
 * whole MCP server down with an unhandled `'error'` event:
 *
 *     RESP id=3: {"launched": true, "pid": null, …}      <- answered SUCCESS
 *     node:events:497  throw er;  Error: spawn /Applications/Godot.app/… ENOENT
 *     (the next request never got a reply — the process was gone)
 *
 * Two defects in one call and they compound. `child_process.spawn` reports a
 * failure to start ASYNCHRONOUSLY, on the child's `'error'` event; a caller that
 * reads `child.pid` and returns has already answered before the failure exists,
 * and a child with no `'error'` listener re-throws on the process. So the tool
 * said the launch succeeded, and then the server died for the same reason.
 *
 * 🔵 AND THE FIX WAS ALREADY IN THIS TREE, ONE PLANE OVER. `stdio.ts`'s
 * OmniSharp path does exactly this correctly — `once("spawn")` against
 * `once("error")`, and a refusal that names the remedy. What was missing was
 * anywhere for the Godot planes to share it. That is this file: every spawn of
 * the CONFIGURED GODOT BINARY goes through here, and the population is derived
 * rather than remembered — `spawn_guard.test.ts` walks every `.ts` under `src/`
 * and refuses any `spawn(cfg.godotBin` outside this file. Three call sites grew
 * the identical defect independently because nothing anywhere said where a Godot
 * spawn is allowed to live.
 *
 * 🔴 THE REFUSAL NAMES THE NEXT ACTION, on 254's rule. `error_remedies.gd` gave
 * the addon planes a next-action table keyed by error code and `bridge.ts`
 * renders it; a host-side spawn failure had no such sentence anywhere, and the
 * one the user got was a Node stack trace.
 */

/** A spawn that never started, rendered as a sentence with a next action. */
export interface SpawnRefusal {
  ok: false;
  /** The user-facing sentence — names the binary, the errno, and what to do. */
  message: string;
  /** The raw errno (`ENOENT`, `EACCES`, …) when Node supplied one. */
  errno: string | null;
}

export interface SpawnStarted {
  ok: true;
  child: ChildProcess;
  pid: number | null;
}

export type GuardedSpawn = SpawnStarted | SpawnRefusal;

/**
 * The remedy sentence for a Godot binary that would not start.
 *
 * Kept separate from the spawn so the SAME wording is reachable from a path that
 * did not spawn anything — `runCaptured`'s `execFile` failure is the same user
 * mistake arriving through a different API, and answering it in two dialects is
 * how a user learns two different things about one problem.
 */
export function godotSpawnRemedy(): string {
  // 🔴 THE REMEDY IS THE NEXT ACTION AND NOTHING ELSE, which check 28's grammar
  // arm refused this file into. The first draft returned the whole message —
  // failure description first, remedy second — and the check said both true
  // things about it: over the length ceiling, and *does not open with a next
  // action, it begins 'Cannot'*. A second description of the failure is what the
  // message already carried. The description now lives in `godotSpawnFailure`,
  // which is deliberately not named `*Remedy` because it is not one.
  return (
    `Set GODOT_BIN to the Godot executable and restart the server — on macOS that is ` +
    `inside the bundle, at /Applications/Godot.app/Contents/MacOS/Godot.`
  );
}

/**
 * 🔴 THE `doctor` POINTER LIVES HERE AND NOT IN THE REMEDY, AND THAT IS A MEASURED
 * DECISION RATHER THAN A LAYOUT CHOICE. `contract_check.py`'s check 28 harvests every
 * `` `breakpoint-mcp …` `` span out of every remedy into `xlang.remedy_cli_refs` and joins
 * it to the CLI surface — good. But `scope_gate.py`'s LEDGER declares that population
 * collapsible by blinding ONE reader, `remedy_tables`, and a span written into a host
 * `*Remedy` export reaches the same list through a DIFFERENT producer
 * (`host_remedy_sentences`). Measured: the blind then reddens 70 lines instead of 71 and
 * `SCOPE_GATE_LEDGER` refuses, because the population it is supposed to collapse does not.
 * A population with two producers cannot be collapsed by blinding one of them, and the
 * ledger's one-blind-per-population shape cannot say so — `ledger-population-with-two-
 * producers` (282) is the row.
 */
const DOCTOR_POINTER = "Run `breakpoint-mcp doctor` to check it.";

/** The whole user-facing sentence: what failed, then what to do about it. */
export function godotSpawnFailure(bin: string, errno: string | null, detail: string): string {
  const what =
    errno === "ENOENT"
      ? `no such file or directory`
      : errno === "EACCES"
        ? `not executable by this user`
        : errno === "EISDIR"
          ? `that path is a directory, not an executable`
          : detail || "the operating system refused to start it";
  return `Cannot start the Godot binary \`${bin}\` — ${what}. ${godotSpawnRemedy()} ${DOCTOR_POINTER}`;
}

/** True when an error object is a failure to START a process, not a failure OF one. */
export function isSpawnFailure(err: unknown): boolean {
  const e = err as { code?: unknown; syscall?: unknown } | null;
  if (!e) return false;
  return typeof e.code === "string" && typeof e.syscall === "string" && e.syscall.startsWith("spawn");
}

/**
 * Spawn `bin` and RESOLVE ONLY ONCE THE OUTCOME IS KNOWN.
 *
 * 🔴 THE `'error'` LISTENER IS ATTACHED BEFORE THE FIRST `await`, WHICH IS THE
 * WHOLE FIX. Node emits the failure on a later tick; a listener registered after
 * any suspension point is registered after the throw. Both listeners are
 * attached synchronously in the same statement that creates the child.
 *
 * The caller gets `ok: false` and a sentence, never an exception and never a
 * child that is about to take the process down.
 */
export function spawnGuarded(bin: string, args: string[], opts: SpawnOptions): Promise<GuardedSpawn> {
  return new Promise<GuardedSpawn>((resolve) => {
    let settled = false;
    const child = spawn(bin, args, opts);
    child.once("error", (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, errno: err.code ?? null, message: godotSpawnFailure(bin, err.code ?? null, err.message) });
    });
    child.once("spawn", () => {
      if (settled) return;
      settled = true;
      resolve({ ok: true, child, pid: child.pid ?? null });
    });
  });
}
