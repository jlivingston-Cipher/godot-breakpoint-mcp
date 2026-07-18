import { log } from "./logger.js";

/**
 * Track 2 — global-pause latch (minimal prototype; see
 * PRIVILEGE_GROUPS_PAUSE_SCOPING_2026-07-17.md "Option B").
 *
 * A coarse, host-side pause OVERLAY on the existing destructive-op seam
 * (`confirm.ts` `gate()`). Per-tool elicitation gating stays the LEAD control —
 * this is the finer instrument for *what* mutates; the latch is the blunt "hold
 * everything that mutates" switch a human reaches for.
 *
 * Precise semantics (described exactly so it does NOT read as an emergency stop):
 *   - It holds ENTRY to a new mutating action while paused. In-flight calls are
 *     never interrupted; read-only tools (the whole verification family, gets,
 *     stack/scope inspection) never touch this seam and so are never held.
 *   - A held call waits until the operator RESUMES or `waitTimeoutMs` elapses;
 *     on timeout it BLOCKS (returns cleanly) rather than acting silently — the
 *     same fail-safe posture `gate()` takes when a client can't elicit.
 *
 * Control surface (prototype): OS signals on the running host — SIGUSR1 pauses,
 * SIGUSR2 resumes — plus optional start-paused and an env-tunable wait. A
 * production human-facing control (an in-editor "Pause Agent" button in the addon
 * status dock, toggling a latch the GDScript bridges also honor) is the natural
 * follow-up; it is intentionally NOT built here (that path bumps the addon
 * version and only covers the editor/runtime planes, whereas this host seam
 * covers the whole mutation surface across every plane at once).
 */

export interface ActivityEntry {
  seq: number;
  /** Human-readable summary of the mutating action (the `gate()` summary). */
  action: string;
  /** epoch ms when the action reached the gate. */
  at: number;
}

export class PauseLatch {
  private _paused: boolean;
  private readonly waiters = new Set<() => void>();
  private readonly activity: ActivityEntry[] = [];
  private seq = 0;
  private readonly cap: number;
  readonly waitTimeoutMs: number;

  constructor(opts?: { startPaused?: boolean; waitTimeoutMs?: number; activityCap?: number }) {
    this._paused = opts?.startPaused ?? false;
    this.waitTimeoutMs = opts?.waitTimeoutMs ?? 120000;
    this.cap = Math.max(1, opts?.activityCap ?? 50);
  }

  isPaused(): boolean {
    return this._paused;
  }

  pause(reason = "signal"): void {
    if (this._paused) return;
    this._paused = true;
    log(`[pause] agent PAUSED (${reason}) — new mutating tool calls will wait for resume`);
  }

  resume(reason = "signal"): void {
    if (!this._paused) return;
    this._paused = false;
    const n = this.waiters.size;
    for (const release of [...this.waiters]) release();
    this.waiters.clear();
    log(`[pause] agent RESUMED (${reason})${n ? ` — released ${n} waiting call(s)` : ""}`);
  }

  toggle(reason = "signal"): void {
    if (this._paused) this.resume(reason);
    else this.pause(reason);
  }

  /** Record a mutating action reaching the gate (the activity signal source). */
  record(action: string): void {
    this.seq += 1;
    this.activity.push({ seq: this.seq, action, at: Date.now() });
    while (this.activity.length > this.cap) this.activity.shift();
  }

  /** Last `n` recorded actions (most recent last). */
  recent(n = 10): ActivityEntry[] {
    return this.activity.slice(-Math.max(0, n));
  }

  latestSeq(): number {
    return this.seq;
  }

  /**
   * Resolve `true` immediately when not paused. While paused, wait until resumed
   * (→ `true`) or `timeoutMs` elapses (→ `false`). Only entry to a NEW action
   * waits; nothing already running is affected.
   */
  async awaitResumed(timeoutMs: number = this.waitTimeoutMs): Promise<boolean> {
    if (!this._paused) return true;
    return new Promise<boolean>((resolve) => {
      const release = (): void => {
        cleanup();
        resolve(true);
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
      const cleanup = (): void => {
        clearTimeout(timer);
        this.waiters.delete(release);
      };
      this.waiters.add(release);
    });
  }
}

function envFlag(name: string): boolean {
  return /^(1|true|on|yes)$/i.test(process.env[name] ?? "");
}

function envInt(name: string, dflt: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

/**
 * Process-wide latch, configured from the environment at load:
 *   BREAKPOINT_START_PAUSED       start held (resume with SIGUSR2). Default off.
 *   BREAKPOINT_PAUSE_TIMEOUT_MS   how long a held call waits before it blocks.
 * `gate()` consults this singleton; `main()` wires the signal handlers.
 */
export const pauseLatch = new PauseLatch({
  startPaused: envFlag("BREAKPOINT_START_PAUSED"),
  waitTimeoutMs: envInt("BREAKPOINT_PAUSE_TIMEOUT_MS", 120000),
});

/**
 * Wire OS-signal control onto a running host (the prototype's control surface):
 * SIGUSR1 → pause, SIGUSR2 → resume. Call once from `main()`; never at import,
 * so importing this module in tests registers no process-level handlers.
 */
export function installPauseSignalHandlers(latch: PauseLatch = pauseLatch): void {
  process.on("SIGUSR1", () => latch.pause("SIGUSR1"));
  process.on("SIGUSR2", () => latch.resume("SIGUSR2"));
}
