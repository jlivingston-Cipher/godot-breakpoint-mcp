import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import {
  runDoctor,
  runDoctorChecks,
  summaryLine,
  withheldChecks,
  parseGodotVersion,
  MIN_GODOT,
  type Check,
} from "../src/cli/doctor.js";

/**
 * doctor_verdict.test.ts — session 282.
 *
 * 🔴 EVERY CLAIM HERE IS A SENTENCE THE PUBLISHED 1.82.1 SAID TO A USER AND
 * SHOULD NOT HAVE. Measured by installing the tarball and following
 * `USER_GUIDE.md`: `doctor` run from the wrong directory — which is the
 * documented invocation, a bare `breakpoint-mcp doctor` — printed *All required
 * checks passed*, exit 0, having never produced the addon checks at all.
 */

function capture(): { restore: () => void; text: () => string } {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: unknown }).write = (c: unknown) => {
    chunks.push(String(c));
    return true;
  };
  return { restore: () => { (process.stdout as unknown as { write: unknown }).write = orig; }, text: () => chunks.join("") };
}

function withProject<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prior = process.env.GODOT_PROJECT;
  process.env.GODOT_PROJECT = dir;
  return fn().finally(() => {
    if (prior === undefined) delete process.env.GODOT_PROJECT;
    else process.env.GODOT_PROJECT = prior;
  });
}

// ------------------------------------------------------------- withheld ------

test("a check withheld by a skipped prerequisite is NOT a pass", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doc-noproj-"));
  try {
    const report = await withProject(dir, () =>
      runDoctorChecks(loadConfig(), { timeoutMs: 50, liveLevel: "none", includeCsharp: false }),
    );
    assert.deepEqual(report.withheld, ["addon-enabled", "addon-installed", "addon-version"]);
    assert.equal(report.ok, false, "a run that never checked the addon has not answered doctor's question");
    const line = summaryLine(report);
    assert.match(line, /Not verified/);
    assert.match(line, /never ran because project did not pass/);
    assert.equal(/All required checks passed/.test(line), false, "the sentence that was the whole defect");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("withheldChecks is derived from the report, so a gate that PASSED withholds nothing", () => {
  const gating: Check = {
    name: "project", status: "skip", severity: "info", detail: "-",
    withholds: ["addon-installed", "addon-enabled"],
  };
  assert.deepEqual(withheldChecks([gating]), ["addon-enabled", "addon-installed"]);
  // Present in the report → not withheld, even though the gate still declares it.
  const present: Check = { name: "addon-installed", status: "ok", severity: "required", detail: "-" };
  assert.deepEqual(withheldChecks([gating, present]), ["addon-enabled"]);
  // The gate passing withholds nothing at all.
  assert.deepEqual(withheldChecks([{ ...gating, status: "ok" }]), []);
});

// ----------------------------------------------------------------- hints -----

test("the text renderer prints hints on skip and ok rows, not only on failures", async () => {
  // `doctor.ts` rendered `if (c.status === "fail" && c.hint)`, under a footer that
  // says "see the ↳ hints above". The `project` skip carries the remedy for the
  // most common first-run mistake and it was reachable only through --json.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doc-hint-"));
  const cap = capture();
  try {
    await withProject(dir, () => runDoctor(["--timeout", "50"]));
  } finally {
    cap.restore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const out = cap.text();
  assert.match(out, /–\s+project/, "the skip row is rendered");
  assert.match(out, /↳ Point this at your Godot project/, "and so is its hint");
});

test("the project hint names a remedy that exists on BOTH surfaces it is read on", async () => {
  // The same `Check` is returned by the `breakpoint_doctor` MCP tool, whose input
  // schema is `additionalProperties: false` and has no `--project`. The old hint
  // told an assistant to pass an argument that cannot be accepted.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doc-hint2-"));
  try {
    const report = await withProject(dir, () =>
      runDoctorChecks(loadConfig(), { timeoutMs: 50, liveLevel: "none", includeCsharp: false }),
    );
    const hint = report.checks.find((c) => c.name === "project")?.hint ?? "";
    assert.match(hint, /--project/, "the command-line remedy");
    assert.match(hint, /GODOT_PROJECT/, "and the in-session one");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------- the binary check ---

test("parseGodotVersion reads the engine pair and refuses what is not one", () => {
  assert.deepEqual(parseGodotVersion("4.4.1.stable.official.f47bb5e"), [4, 4]);
  assert.deepEqual(parseGodotVersion("4.3.stable.official"), [4, 3]);
  assert.deepEqual(parseGodotVersion("3.5.2.stable.official"), [3, 5]);
  // 🔴 THE MEASURED FALSE PASS: `GODOT_BIN=/bin/ls` produced `✓ godot-binary
  // /bin/ls → ls (GNU coreutils) 9.4` on the published 1.82.1, because the check's
  // predicate was "spawnSync did not error".
  assert.equal(parseGodotVersion("ls (GNU coreutils) 9.4"), null);
  assert.equal(parseGodotVersion("(no version output)"), null);
});

test("the minimum the check enforces is the minimum the docs name", () => {
  // 203 §2: a number in a sentence and a number in a branch agree until somebody
  // edits one of them. `USER_GUIDE.md` §2 and the check's own failure hint have
  // both said 4.2 since they were written, and nothing enforced it.
  assert.deepEqual([...MIN_GODOT], [4, 2]);
  const guide = fs.readFileSync(path.join(process.cwd(), "..", "docs", "USER_GUIDE.md"), "utf8");
  assert.match(guide, new RegExp(`Godot\\s+\\**${MIN_GODOT[0]}\\.${MIN_GODOT[1]}`),
    "the guide must name the same minimum this build enforces");
});

test("a binary that runs but is not Godot FAILS the godot-binary check", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doc-bin-"));
  const bin = path.join(dir, "fake");
  fs.writeFileSync(bin, "#!/bin/sh\necho 'ls (GNU coreutils) 9.4'\n", { mode: 0o755 });
  const prior = process.env.GODOT_BIN;
  process.env.GODOT_BIN = bin;
  try {
    const report = await withProject(dir, () =>
      runDoctorChecks(loadConfig(), { timeoutMs: 2000, liveLevel: "none", includeCsharp: false }),
    );
    const c = report.checks.find((x) => x.name === "godot-binary")!;
    assert.equal(c.status, "fail");
    assert.match(c.detail, /did not report a Godot version/);
  } finally {
    if (prior === undefined) delete process.env.GODOT_BIN;
    else process.env.GODOT_BIN = prior;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a real Godot BELOW the minimum fails the check whose hint already said 4.2+", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doc-old-"));
  const bin = path.join(dir, "godot");
  fs.writeFileSync(bin, "#!/bin/sh\necho '3.5.2.stable.official'\n", { mode: 0o755 });
  const prior = process.env.GODOT_BIN;
  process.env.GODOT_BIN = bin;
  try {
    const report = await withProject(dir, () =>
      runDoctorChecks(loadConfig(), { timeoutMs: 2000, liveLevel: "none", includeCsharp: false }),
    );
    const c = report.checks.find((x) => x.name === "godot-binary")!;
    assert.equal(c.status, "fail");
    assert.match(c.detail, /below the minimum 4\.2/);
    assert.match(c.hint ?? "", /4\.2 or newer/);
  } finally {
    if (prior === undefined) delete process.env.GODOT_BIN;
    else process.env.GODOT_BIN = prior;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a modern Godot still PASSES — the direction that must not change", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doc-new-"));
  const bin = path.join(dir, "godot");
  fs.writeFileSync(bin, "#!/bin/sh\necho '4.7.stable.custom'\n", { mode: 0o755 });
  const prior = process.env.GODOT_BIN;
  process.env.GODOT_BIN = bin;
  try {
    const report = await withProject(dir, () =>
      runDoctorChecks(loadConfig(), { timeoutMs: 2000, liveLevel: "none", includeCsharp: false }),
    );
    const c = report.checks.find((x) => x.name === "godot-binary")!;
    assert.equal(c.status, "ok", c.detail);
  } finally {
    if (prior === undefined) delete process.env.GODOT_BIN;
    else process.env.GODOT_BIN = prior;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------- flag values ------

test("doctor REFUSES a flag value it cannot read rather than dropping it", async () => {
  const cap = capture();
  const err: string[] = [];
  const origErr = process.stderr.write.bind(process.stderr);
  (process.stderr as unknown as { write: unknown }).write = (c: unknown) => { err.push(String(c)); return true; };
  try {
    // `--timeout abc` and a bare `--timeout` both silently fell back to 1500ms on
    // the published 1.82.1, while `--require-live=yes` on the same command line is
    // a hard exit 2.
    assert.equal(await runDoctor(["--timeout", "abc"]), 2);
    assert.equal(await runDoctor(["--project"]), 2);
  } finally {
    cap.restore();
    (process.stderr as unknown as { write: unknown }).write = origErr;
  }
  const text = err.join("");
  assert.match(text, /--timeout: expected a positive whole number/);
  assert.match(text, /--project: expected a directory/);
});
