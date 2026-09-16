import { execFile } from "node:child_process";
import path from "node:path";

/**
 * WHO holds a loopback port — the question `ports.ts` was forbidden to answer (318).
 *
 * 🔴 WHY THIS EXISTS. Seven places in this host learn that one of its ports is taken and
 * then stop at "something". The four game launchers refuse with a message that lists every
 * remedy "with the condition under which it applies, and asserts nothing about which one is
 * live" (`ports.ts`), because `portFree` learns only THAT a bind failed. `bridge.ts` reaches
 * the same wall from the other side — a listener that accepted the connection and never spoke
 * the protocol — and its sentence handed the person a Terminal command:
 * `lsof -nP -iTCP:<port> -sTCP:LISTEN`. An assistant in a client with no shell cannot run it,
 * and one that can still cannot tell whether the pid it prints is a game THIS server started.
 * Only this process knows that. So the host runs the command itself, and reads the pid
 * against its own ledger of the children it spawned.
 *
 * 🔴 THREE FAMILIES, EACH DRIVEN BEFORE IT WAS WRITTEN (318, macOS 15.7 lsof 4.91 and Ubuntu
 * 24.04 lsof, against real sockets):
 *
 * ```
 * a listener this account owns     exit 0  "p19023\ncnode\nf12\nn127.0.0.1:58567\n"
 * a listener another account owns  exit 1  ""   (macOS: launchd's *:5900; Linux: root's
 *                                                127.0.0.1:47123 read as `nobody`) — bind EADDRINUSE
 * nothing listening at all         exit 1  ""   — bind succeeds
 * ```
 *
 * The second and third rows are BYTE-IDENTICAL from lsof. They separate only on the bind, so
 * `none_visible` here claims exactly what lsof said — no listener this account can see — and
 * the caller, which already holds its own bind or connect result, says what that means.
 * macOS `netstat -anv` does print the other account's pid; it is not read, because its column
 * layout is a per-release fact nobody here has pinned, and a parser that guesses a column is a
 * claim nobody made.
 *
 * 🔴 WHAT IT DELIBERATELY DOES NOT DO:
 *   • read a command LINE. `-Fpcn` asks lsof for the pid, the program name and the address and
 *     nothing else. A foreign program's argv can carry a token, and the name is all a remedy
 *     needs.
 *   • look up a host that is not this machine. lsof reads THIS kernel's table; a
 *     `BREAKPOINT_*_HOST` naming another machine would get a confident answer about a port on
 *     the wrong computer, so it gets `unavailable` instead.
 *   • run on Windows. No Windows lookup was driven, so none is spoken for.
 *   • cost anything on a healthy call. Every caller reaches this only on a failure path.
 */

/** One listening socket, as lsof reports it. */
export interface Listener {
  pid: number;
  /** The program name lsof reports (`-Fc`), never its arguments. */
  command: string;
  /** `127.0.0.1:9081`, `*:9081`, `[::1]:9081` — the address the socket is bound to. */
  address: string;
}

export type HolderReading =
  | { kind: "found"; listeners: Listener[] }
  | { kind: "none_visible" }
  | { kind: "unavailable"; reason: string };

/** What one child-process run produced — the seam tests drive instead of a real lsof. */
export interface ExecOutcome {
  /** `0` on success, the exit status on a non-zero exit, the errno string when it never ran. */
  code: number | string | null;
  timedOut: boolean;
  stdout: string;
}
export type ExecFn = (file: string, args: readonly string[], timeoutMs: number) => Promise<ExecOutcome>;

/** Measured at 29 ms on the Mac; the ceiling exists for a machine with a hung network mount. */
export const LOOKUP_TIMEOUT_MS = 2000;

/** The one invocation. `+c 0` lifts lsof's nine-character truncation of the program name. */
export function lsofArgs(port: number): string[] {
  return ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpcn", "+c", "0"];
}

const runExec: ExecFn = (file, args, timeoutMs) =>
  new Promise((resolve) => {
    execFile(file, [...args], { timeout: timeoutMs, encoding: "utf8", maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (!err) {
        resolve({ code: 0, timedOut: false, stdout });
        return;
      }
      const e = err as NodeJS.ErrnoException & { code?: number | string; killed?: boolean };
      resolve({ code: e.code ?? null, timedOut: e.killed === true, stdout: typeof stdout === "string" ? stdout : "" });
    });
  });

/** Does `host` name this machine's loopback — the only table lsof can read for it? */
export function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h === "localhost" || h === "::1" || h === "[::1]" || /^127(\.\d{1,3}){3}$/.test(h);
}

/**
 * lsof escapes a byte it will not print as `\xNN` — measured on the Mac as
 * `ROLI\x20Hardware\x20Driver`. A remedy that names the program should name it as a person
 * sees it in Activity Monitor.
 */
export function decodeLsofName(s: string): string {
  return s.replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

/**
 * Parse `-Fpcn` output: a `p` line opens a process, `c` names it, and each `n` is one of its
 * sockets. Every other field letter is ignored — macOS emits an `f` line per socket and Linux,
 * measured the same day, does not.
 */
export function parseLsof(stdout: string): Listener[] {
  const out: Listener[] = [];
  let pid: number | null = null;
  let command = "";
  for (const raw of stdout.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.length === 0) continue;
    const value = line.slice(1);
    switch (line[0]) {
      case "p": {
        const n = Number(value);
        pid = Number.isInteger(n) && n > 0 ? n : null;
        command = "";
        break;
      }
      case "c":
        command = decodeLsofName(value);
        break;
      case "n":
        if (pid !== null && value.length > 0) out.push({ pid, command, address: value });
        break;
      default:
        break;
    }
  }
  return out;
}

export interface ReadOptions {
  exec?: ExecFn;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
}

/** Ask this machine's listener table who is listening on `port`. Never throws. */
export async function readHolder(host: string, port: number, opts: ReadOptions = {}): Promise<HolderReading> {
  if ((opts.platform ?? process.platform) === "win32") {
    return { kind: "unavailable", reason: "no listener lookup is implemented on Windows" };
  }
  if (!isLoopbackHost(host)) {
    return { kind: "unavailable", reason: `${host} is not this machine's loopback, so its listeners cannot be read from here` };
  }
  const timeoutMs = opts.timeoutMs ?? LOOKUP_TIMEOUT_MS;
  const r = await (opts.exec ?? runExec)("lsof", lsofArgs(port), timeoutMs);
  if (r.code === "ENOENT") return { kind: "unavailable", reason: "lsof is not installed" };
  if (r.timedOut) return { kind: "unavailable", reason: `lsof did not answer within ${timeoutMs} ms` };
  if (r.code === 1 && r.stdout.trim() === "") return { kind: "none_visible" };
  if (r.code !== 0) return { kind: "unavailable", reason: `lsof exited ${String(r.code)}` };
  const listeners = parseLsof(r.stdout);
  if (listeners.length === 0) return { kind: "unavailable", reason: "lsof printed nothing this reader could parse" };
  return { kind: "found", listeners };
}

// ── The ledger of what this server started ──────────────────────────────────────────────

/**
 * Which tool started a process, when this server started it.
 *
 * 🔴 A LEDGER OF PIDS, NOT A PORT ROSTER. What holds a port is read from the kernel; this only
 * answers "is that pid one of ours". The row is deleted on the child's `exit`, so a recycled
 * pid is never mistaken for a game this server started an hour ago.
 */
export type Owner =
  | { tool: "godot_run_managed"; id: string }
  | { tool: "runtime_spawn_peers"; id: string; port: number }
  | { tool: "godot_run_project" };

interface ExitEmitter {
  pid?: number;
  once(event: "exit", listener: () => void): unknown;
}

const owned = new Map<number, Owner>();

/** Record that this server started `child`. A child that never got a pid records nothing. */
export function noteOwned(child: ExitEmitter | null | undefined, owner: Owner): void {
  const pid = child?.pid;
  if (!child || typeof pid !== "number") return;
  owned.set(pid, owner);
  child.once("exit", () => {
    if (owned.get(pid) === owner) owned.delete(pid);
  });
}

/** The live peers this server spawned, with the port each was given. */
export function ownedPeers(): Array<{ id: string; port: number; pid: number }> {
  const out: Array<{ id: string; port: number; pid: number }> = [];
  for (const [pid, o] of owned) if (o.tool === "runtime_spawn_peers") out.push({ id: o.id, port: o.port, pid });
  return out.sort((a, b) => a.port - b.port);
}

// ── Attribution ─────────────────────────────────────────────────────────────────────────

export type Attribution =
  | { kind: "godot_run_managed"; id: string }
  | { kind: "runtime_spawn_peers"; id: string }
  | { kind: "godot_run_project" }
  | { kind: "this_server" }
  | { kind: "godot" }
  | { kind: "other" };

/**
 * Is `command` a Godot binary? The name contains "godot" (`Godot`, `godot`,
 * `Godot_v4.4-stable_linux.x86_64`, whose 15-byte Linux `comm` is `Godot_v4.4-stab`), or it is
 * exactly the basename `GODOT_BIN` names — the one case a renamed build is still recognised.
 */
export function looksLikeGodot(command: string, godotBin: string): boolean {
  const bin = path.basename(godotBin).replace(/\.exe$/i, "");
  return /godot/i.test(command) || (bin.length > 0 && command === bin);
}

/** Whose is this listener — ours by ledger, then this very process, then Godot-or-not by name. */
export function attribute(l: Listener, godotBin: string, selfPid: number = process.pid): Attribution {
  const o = owned.get(l.pid);
  if (o?.tool === "godot_run_managed") return { kind: "godot_run_managed", id: o.id };
  if (o?.tool === "runtime_spawn_peers") return { kind: "runtime_spawn_peers", id: o.id };
  if (o?.tool === "godot_run_project") return { kind: "godot_run_project" };
  if (l.pid === selfPid) return { kind: "this_server" };
  return looksLikeGodot(l.command, godotBin) ? { kind: "godot" } : { kind: "other" };
}

/** One process holding the port: its sockets folded together, and whose it is. */
export interface Holder {
  pid: number;
  command: string;
  addresses: string[];
  owner: Attribution;
}

export type PortHolder =
  | { kind: "found"; holders: Holder[] }
  | { kind: "none_visible" }
  | { kind: "unavailable"; reason: string };

/** Fold listeners by pid — one process on `127.0.0.1` and `[::1]` is one holder, not two. */
export function foldHolders(listeners: readonly Listener[], godotBin: string, selfPid: number = process.pid): Holder[] {
  const byPid = new Map<number, Holder>();
  for (const l of listeners) {
    const h = byPid.get(l.pid);
    if (h) {
      if (!h.addresses.includes(l.address)) h.addresses.push(l.address);
      continue;
    }
    byPid.set(l.pid, { pid: l.pid, command: l.command, addresses: [l.address], owner: attribute(l, godotBin, selfPid) });
  }
  return [...byPid.values()];
}

/** Read the table and attribute what it says. */
export async function whoHolds(host: string, port: number, godotBin: string, opts: ReadOptions = {}): Promise<PortHolder> {
  const r = await readHolder(host, port, opts);
  if (r.kind !== "found") return r;
  return { kind: "found", holders: foldHolders(r.listeners, godotBin) };
}

// ── Sentences ───────────────────────────────────────────────────────────────────────────

/** `the game godot_run_managed started as "godot-2" (pid 4312, Godot, on 127.0.0.1:9081)` */
export function holderPhrase(h: Holder): string {
  const facts = `(pid ${h.pid}, ${h.command || "unnamed"}, on ${h.addresses.join(" and ")})`;
  switch (h.owner.kind) {
    case "godot_run_managed":
      return `the game godot_run_managed started as "${h.owner.id}" ${facts}`;
    case "runtime_spawn_peers":
      return `peer "${h.owner.id}", which runtime_spawn_peers started ${facts}`;
    case "godot_run_project":
      return `a detached game godot_run_project started ${facts}`;
    case "this_server":
      return `this Breakpoint server's own process ${facts}`;
    case "godot":
      return `a Godot process this server did not start ${facts}`;
    default:
      return `a program that is not Godot ${facts}`;
  }
}

/** `a; b` for several holders, the phrase for one. */
export function holdersPhrase(holders: readonly Holder[]): string {
  return holders.map(holderPhrase).join("; ");
}

/**
 * The stop that is certain to work, when this server knows one — `undefined` when the holder
 * is not a process any tool here can stop. Only a ledger match earns a tool name: a Godot this
 * server did not start may be a game, an editor, or a debugger-launched session, and naming a
 * tool for it would be the guess `ports.ts` spent a paragraph refusing.
 */
export function certainStop(h: Holder): string | undefined {
  switch (h.owner.kind) {
    case "godot_run_managed":
      return `stop it with godot_stop, id "${h.owner.id}"`;
    case "runtime_spawn_peers":
      return `stop it with runtime_peer_stop, id "${h.owner.id}"`;
    default:
      return undefined;
  }
}

/** A short form for a row that is otherwise fine: `Godot, pid 511` / `3 processes`. */
export function holderBrief(holders: readonly Holder[]): string {
  if (holders.length !== 1) return `${holders.length} processes, pids ${holders.map((h) => h.pid).join(", ")}`;
  const h = holders[0];
  return `${h.command || "unnamed"}, pid ${h.pid}`;
}

/**
 * The silent-peer remedy with the holder named — `bridge.ts`'s sentence, which used to end in
 * a Terminal command, finished by running it. `undefined` when the lookup could not answer,
 * so the caller keeps the sentence it already had.
 */
export function silentHolderRemedy(
  host: string,
  port: number,
  peerNoun: string,
  hostKnob: string,
  holder: PortHolder,
): string | undefined {
  const head =
    `Nothing on ${host}:${port} has ever spoken the Breakpoint bridge protocol on this connection, ` +
    `so this is not ${peerNoun} failing — `;
  const elsewhere = `point this plane elsewhere with ${hostKnob} and its port knob`;
  if (holder.kind === "unavailable") return undefined;
  if (holder.kind === "none_visible") {
    return (
      head +
      `the port is held by a process this account cannot see (another user's, or the system's), so no ` +
      `tool here can stop it. ${cap(elsewhere)}.`
    );
  }
  const hs = holder.holders;
  const stop = hs.length === 1 ? certainStop(hs[0]) : undefined;
  if (stop) return head + `the port is held by ${holderPhrase(hs[0])}. ${cap(stop)}, or ${elsewhere}.`;
  const quit = hs.length === 1 && hs[0].owner.kind === "this_server" ? "" : `Quit ${hs.length === 1 ? "it" : "them"}, or `;
  return head + `the port is held by ${holdersPhrase(hs)}. ${quit ? quit + elsewhere : cap(elsewhere)}.`;
}

function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
