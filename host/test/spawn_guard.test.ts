import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnGuarded, godotSpawnFailure, godotSpawnRemedy, isSpawnFailure } from "../src/spawn-guard.js";

/**
 * 🔴 RESOLVED FROM THE PACKAGE ROOT, NOT FROM `import.meta.url`, AND THE POSITIVE
 * CONTROL IS WHAT CAUGHT THAT. Compiled, this file runs from `dist-test/test/`, so
 * a path relative to the module resolved to `dist-test/src` — which holds `.js` and
 * no `.ts` at all. The walk read ZERO files and the assertion below passed for the
 * exact reason it exists to refuse: a scan that matches nothing is green.
 */
const SRC = path.join(process.cwd(), "src");

function everyTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? everyTs(full) : full.endsWith(".ts") ? [full] : [];
  });
}

test("a spawn that never starts RESOLVES with a refusal — it does not throw on the process", async () => {
  // 🔴 THE DEFECT VERBATIM. On the published 1.82.1 this path emitted an
  // unhandled `'error'` event and killed the whole MCP server, after the tool had
  // already answered `{"launched": true}`.
  const s = await spawnGuarded("/no/such/godot-binary-xyz", ["--version"], { stdio: "ignore" });
  assert.equal(s.ok, false);
  if (s.ok) return;
  assert.equal(s.errno, "ENOENT");
  assert.match(s.message, /Cannot start the Godot binary/);
  assert.match(s.message, /GODOT_BIN/, "254's rule: the refusal names the next action");
});

test("a spawn that DOES start resolves with the child — the direction that must not change", async () => {
  const s = await spawnGuarded(process.execPath, ["-e", "process.exit(0)"], { stdio: "ignore" });
  assert.equal(s.ok, true);
  if (!s.ok) return;
  assert.equal(typeof s.pid, "number");
  s.child.unref();
});

test("isSpawnFailure separates a process that never started from one that exited badly", () => {
  assert.equal(isSpawnFailure({ code: "ENOENT", syscall: "spawn godot" }), true);
  // An ordinary non-zero exit: `code` is a NUMBER and there is no spawn syscall.
  // These two used to collapse into `code: null` — see `runCaptured` in tools/cli.ts.
  assert.equal(isSpawnFailure({ code: 1, stderr: "boom" }), false);
  assert.equal(isSpawnFailure(null), false);
});

test("the remedy is a next action on its own, and the failure sentence carries both", () => {
  // check 28's grammar arm judges `*Remedy` exports: an imperative opening, a full
  // stop, and under the length ceiling. Pinned here too so the shape is a claim in
  // the suite and not only a refusal in a gate the host build does not run.
  const remedy = godotSpawnRemedy();
  assert.match(remedy, /^Set /, "a remedy opens with the next action");
  assert.ok(remedy.endsWith("."), "and ends in a full stop");
  assert.ok(remedy.length <= 210, `remedy is ${remedy.length} chars, ceiling 210`);
  const full = godotSpawnFailure("/tmp/nope", "ENOENT", "spawn /tmp/nope ENOENT");
  assert.match(full, /\/tmp\/nope/);
  assert.ok(full.includes(remedy), "the failure sentence carries the remedy, unaltered");
  assert.match(full, /breakpoint-mcp doctor/, "and the doctor pointer, which lives outside the remedy on purpose");
});

test("NO source file outside spawn-guard.ts spawns the configured Godot binary", () => {
  // 🔴 THE POPULATION IS DERIVED, WHICH IS THE ONLY REASON THIS IS WORTH HAVING.
  // Three separate call sites each grew the same defect independently —
  // `launchDetached` in tools/cli.ts, `ProcessRegistry.run` in tools/processes.ts,
  // and the peer spawner through it — because nothing anywhere said where a Godot
  // spawn is allowed to live. A fourth is written the day somebody needs one, and
  // this is what refuses it before it ships rather than after a user reports that
  // their server died.
  const offenders: string[] = [];
  for (const f of everyTs(SRC)) {
    if (path.basename(f) === "spawn-guard.ts") continue;
    const text = fs.readFileSync(f, "utf8");
    // Comments are prose ABOUT the spawn, and prose is not a call — 281 §2.2's
    // rule, which cost that session four wrong derivations to establish.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (/\bspawn\(\s*(?:cfg|config)\.godotBin\b/.test(code)) offenders.push(path.relative(SRC, f));
  }
  assert.deepEqual(offenders, [], `spawn the Godot binary through spawnGuarded: ${offenders.join(", ")}`);
  // POSITIVE CONTROL — an empty offender list is the answer whether the scan works or
  // matches nothing, and "matches nothing" is precisely how this defect stayed
  // unnoticed across three call sites. The same two expressions are driven over source
  // that DOES offend, and over the prose form that must not count as one.
  const offending = `const c = spawn(cfg.godotBin, args, {});`;
  const prose = `/* never spawn(cfg.godotBin) outside spawn-guard.ts */\n// spawn(config.godotBin)\n`;
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/\bspawn\(\s*(?:cfg|config)\.godotBin\b/.test(strip(offending)), true, "the scan finds a real call");
  assert.equal(/\bspawn\(\s*(?:cfg|config)\.godotBin\b/.test(strip(prose)), false, "and comments are prose, not calls");
  assert.ok(everyTs(SRC).length > 40, `the walk reached ${everyTs(SRC).length} source file(s)`);
});

test("the guarded spawn does not leave a stray process behind on failure", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-spawn-"));
  try {
    const s = await spawnGuarded(path.join(dir, "not-there"), [], { cwd: dir, stdio: "ignore" });
    assert.equal(s.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
