import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, preflight } from "../src/cli/args.js";

test("value-taking flags consume the next token", () => {
  const { flags, positionals } = parseArgs(["--project", "/tmp/proj", "--timeout", "500"]);
  assert.equal(flags.project, "/tmp/proj");
  assert.equal(flags.timeout, "500");
  assert.deepEqual(positionals, []);
});

test("--flag=value form is always value-taking", () => {
  const { flags } = parseArgs(["--project=/tmp/x", "--timeout=250"]);
  assert.equal(flags.project, "/tmp/x");
  assert.equal(flags.timeout, "250");
});

test("declared boolean flags do not consume the next token", () => {
  const { flags, positionals } = parseArgs(["--json", "/tmp/proj"], ["json"]);
  assert.equal(flags.json, true);
  assert.deepEqual(positionals, ["/tmp/proj"]);
});

test("multiple boolean flags all become true", () => {
  const { flags } = parseArgs(
    ["--json", "--require-live", "--include-csharp"],
    ["json", "require-live", "include-csharp"],
  );
  assert.equal(flags.json, true);
  assert.equal(flags["require-live"], true);
  assert.equal(flags["include-csharp"], true);
});

test("a value flag with no following value becomes a boolean", () => {
  const { flags } = parseArgs(["--project"]);
  assert.equal(flags.project, true);
});

test("short flags are booleans and positionals are collected", () => {
  const { flags, positionals } = parseArgs(["-h", "doctor", "extra"]);
  assert.equal(flags.h, true);
  assert.deepEqual(positionals, ["doctor", "extra"]);
});

test("`--` sends the rest to positionals verbatim", () => {
  const { flags, positionals } = parseArgs(["--json", "--", "--not-a-flag", "x"], ["json"]);
  assert.equal(flags.json, true);
  assert.deepEqual(positionals, ["--not-a-flag", "x"]);
});

/**
 * The `knownFlags` roster and `preflight`. A parser that accepts any `--key`
 * cannot tell a flag from a typo, and what it produces is not silence but a
 * confident error about something else — see args.ts.
 */

test("no roster keeps the permissive behaviour and reports nothing unknown", () => {
  const { flags, unknown } = parseArgs(["--anything", "x", "--else"]);
  assert.equal(flags.anything, "x");
  assert.equal(flags.else, true);
  assert.deepEqual(unknown, []);
});

test("a roster reports the keys it does not name", () => {
  const { unknown } = parseArgs(["--project", "/p", "--porject", "/p"], [], ["project"]);
  assert.deepEqual(unknown, ["porject"]);
});

test("boolean flags are known by construction — a roster need not repeat them", () => {
  const { unknown } = parseArgs(["--json", "--project", "/p"], ["json"], ["project"]);
  assert.deepEqual(unknown, []);
});

test("the --flag=value form is judged by the same rule as --flag value", () => {
  // Computed after the loop, not inside it, so both spellings land on the key.
  const a = parseArgs(["--porject=/p"], [], ["project"]);
  const b = parseArgs(["--porject", "/p"], [], ["project"]);
  assert.deepEqual(a.unknown, ["porject"]);
  assert.deepEqual(b.unknown, ["porject"]);
});

test("short flags are judged too, and named with one dash", () => {
  const { unknown } = parseArgs(["-q"], [], ["project"]);
  assert.deepEqual(unknown, ["q"]);
});

test("positionals after `--` are never mistaken for unknown flags", () => {
  const { unknown, positionals } = parseArgs(["--", "--not-a-flag"], [], ["project"]);
  assert.deepEqual(unknown, []);
  assert.deepEqual(positionals, ["--not-a-flag"]);
});

test("preflight returns null when there is nothing to say", () => {
  const parsed = parseArgs(["--project", "/p"], [], ["project"]);
  assert.equal(preflight(parsed, "init", ["usage"]), null);
});

test("preflight answers --help with 0, and -h the same way", () => {
  for (const argv of [["--help"], ["-h"]]) {
    const parsed = parseArgs(argv, ["help", "h"], []);
    assert.equal(preflight(parsed, "init", ["usage"]), 0);
  }
});

test("preflight refuses an unknown option with 2", () => {
  const parsed = parseArgs(["--nope"], [], ["project"]);
  assert.equal(preflight(parsed, "doctor", ["usage"]), 2);
});
