import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The ENTRY POINT, run the way a user runs it.
 *
 * 🔴 EVERY TEST IN THIS FILE COVERS A DEFECT THAT SHIPPED, AND THEY SHIPPED
 * TOGETHER FOR ONE REASON: 722 tests imported this package's functions and not
 * one of them executed its binary. `runInit`, `runDoctor` and `runTools` were
 * each well covered as FUNCTIONS; the argv dispatch that decides which one runs
 * — and what happens when none of them does — was reachable only by typing the
 * command, and nothing in this repository typed it.
 *
 * What that cost, measured against 1.74.0 by installing the published tarball
 * and running it:
 *
 *   breakpoint-mcp --version   → started an MCP server
 *   breakpoint-mcp -v          → started an MCP server
 *   breakpoint-mcp version     → started an MCP server
 *   breakpoint-mcp --typo      → started an MCP server
 *   breakpoint-mcp init --help → "no project.godot at <cwd>"
 *
 * A server on a stdin nobody is going to speak MCP into is a hung terminal, and
 * there was no way at all to ask the installed binary its version — the first
 * thing anyone filing a bug report is asked for.
 */

/**
 * Walk up to the package root rather than assuming a depth. This file is run
 * from TWO places — `test/` under tsx, and `dist-test/test/` under `npm test`,
 * which compiles first — so a fixed `..` is correct in one of them and silently
 * wrong in the other. It was wrong in the one CI runs.
 */
function packageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "package.json");
    try {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as { name?: string };
      if (pkg.name === "breakpoint-mcp") return dir;
    } catch {
      /* keep climbing */
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate the breakpoint-mcp package root from " + import.meta.url);
}

const ROOT = packageRoot();
const ENTRY = path.join(ROOT, "dist", "index.js");
const PKG_VERSION = (
  JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { version: string }
).version;

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run the entry point with an argv and a CLOSED stdin, under a deadline.
 *
 * Both halves are load-bearing. Closed stdin means that if a regression sends
 * one of these argvs back to the stdio server, the server sees EOF and exits
 * instead of hanging this suite forever; the timeout is the backstop for the
 * case where it does not. A test that hangs on failure is a test nobody runs.
 */
function run(args: string[]): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [ENTRY, ...args],
      { timeout: 20_000, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err && typeof (err as NodeJS.ErrnoException & { code?: number }).code !== "number") {
          reject(err);
          return;
        }
        resolve({
          code: (err as (Error & { code?: number }) | null)?.code ?? 0,
          stdout,
          stderr,
        });
      },
    );
    child.stdin?.end();
  });
}

test("the entry point this file is about was actually built", () => {
  // 🔴 FIRST, AND IT IS NOT CEREMONY. Every other test in this file spawns `dist/index.js`,
  // so a tree where the product was never built fails all twenty with `MODULE_NOT_FOUND` —
  // twenty identical stack traces saying nothing about the cause. It happened on this
  // file's first CI run: `npm test` compiles the SUITE into `dist-test/` and every other
  // test imports `../src/…`, so the host-tests job had never built `dist/` and nothing
  // had ever asked it to. One claim that names the missing artifact is worth twenty that
  // describe its absence.
  assert.ok(
    existsSync(ENTRY),
    `${ENTRY} does not exist — run \`npm run build\` before \`npm test\`. ` +
      "Every test below spawns that file; without it they fail as module-resolution " +
      "errors that say nothing about why.",
  );
});

for (const flag of ["--version", "-v", "-V", "version"]) {
  test(`\`${flag}\` prints the package version and exits 0`, async () => {
    const r = await run([flag]);
    assert.equal(r.code, 0, `expected exit 0, got ${r.code} (stderr: ${r.stderr})`);
    assert.equal(r.stdout.trim(), PKG_VERSION);
    // The whole point is a value a script can capture: one bare line, no banner.
    assert.equal(r.stdout.trim().split("\n").length, 1);
    assert.doesNotMatch(r.stdout, /ready ·/);
  });
}

test("the version comes from package.json, not a literal in the source", async () => {
  // version.ts exists because lsp.ts and cslsp.ts announced 0.2.0 to every LSP
  // server they met for twenty-odd releases. Asserting equality with a literal
  // written here would rebuild exactly that hazard in the test, so the
  // comparison is against the file the release process actually bumps.
  const r = await run(["--version"]);
  assert.equal(r.stdout.trim(), PKG_VERSION);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
});

for (const flag of ["--help", "-h", "help"]) {
  test(`\`${flag}\` prints the usage and exits 0`, async () => {
    const r = await run([flag]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /MCP server exposing Godot/);
    // Composed from the same blocks the subcommands print, so a flag documented
    // for one is documented here: assert one option from each of the three.
    assert.match(r.stdout, /--from-github/); // init
    assert.match(r.stdout, /--require-live/); // doctor
    assert.match(r.stdout, /--surface/); // tools
    assert.match(r.stdout, /--version/);
  });
}

for (const argv of [["--typo"], ["--porject"], ["nonsense"], ["-x"]]) {
  test(`an unrecognized argument (${argv.join(" ")}) is refused, not swallowed`, async () => {
    const r = await run(argv);
    assert.equal(r.code, 2, `expected exit 2, got ${r.code}`);
    assert.match(r.stderr, /unknown argument/);
    // 🔴 The message must contain the token the user actually typed. A generic
    // "bad usage" line sends them to the manual; this sends them to the typo.
    assert.ok(
      r.stderr.includes(argv[0]),
      `stderr does not name the offending token ${argv[0]}: ${r.stderr}`,
    );
    // The remedy names the launch contract, because the reader may be an MCP
    // client author who put a stray arg in their config.
    assert.match(r.stderr, /no arguments/);
    assert.doesNotMatch(r.stdout, /ready ·/);
  });
}

for (const sub of ["init", "doctor", "tools"]) {
  test(`\`${sub} --help\` prints ${sub}'s own options and exits 0`, async () => {
    const r = await run([sub, "--help"]);
    assert.equal(r.code, 0, `expected exit 0, got ${r.code} (stderr: ${r.stderr})`);
    assert.match(r.stdout, new RegExp(`breakpoint-mcp ${sub}`));
    assert.match(r.stdout, new RegExp(`${sub} options:`));
    // 🔴 THE REGRESSION THIS PINS: `init --help` used to reach the project
    // check and report a missing project.godot — an error about the user's
    // directory in answer to a question about flags.
    assert.doesNotMatch(r.stderr, /project\.godot/);
  });

  test(`\`${sub}\` refuses an unknown option by name`, async () => {
    const r = await run([sub, "--definitely-not-a-flag", "x"]);
    assert.equal(r.code, 2, `expected exit 2, got ${r.code} (stdout: ${r.stdout})`);
    assert.match(r.stderr, /unknown option/);
    assert.match(r.stderr, /--definitely-not-a-flag/);
    assert.match(r.stderr, new RegExp(`breakpoint-mcp ${sub} --help`));
  });
}

test("a mistyped --project reports the FLAG, not a directory the user never named", async () => {
  // The exact 1.74.0 shape: `--porject` parsed, was ignored, the project fell
  // back to the current directory, and init reported `no project.godot at
  // <cwd>` — a true sentence about a path nobody typed, and twenty minutes
  // spent on the wrong question.
  const r = await run(["init", "--porject", "/tmp/some/game"]);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /--porject/);
  assert.doesNotMatch(r.stderr, /no project\.godot/);
});

test("every documented subcommand is reachable and none of them starts a server", async () => {
  // The launch contract, stated as a claim: argv[2] undefined is the ONLY input
  // that reaches main(). Everything the usage text documents must terminate.
  for (const argv of [["--help"], ["--version"], ["tools", "--help"], ["doctor", "--help"]]) {
    const r = await run(argv);
    assert.doesNotMatch(r.stdout, /ready ·/, `${argv.join(" ")} started the server`);
  }
});
