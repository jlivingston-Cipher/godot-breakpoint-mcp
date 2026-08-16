import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ADDON_SKEW_HINT,
  compareAddonVersions,
  installedAddonVersion,
  readAddonVersion,
} from "../src/addon-version.js";
import { installAddon } from "../src/cli/init.js";
import { addonRunningCheck } from "../src/cli/doctor.js";
import { HOST_FALLBACK_REMEDIES, remedyForWireError } from "../src/remedies.js";

/**
 * 🔴 EVERY TEST IN THIS FILE COVERS THE SAME SHIPPED DEFECT FROM A DIFFERENT SIDE,
 * AND IT SHIPPED FOR ONE REASON: THE ADDON IS THE HALF OF THIS PRODUCT NOTHING
 * VERSIONED (258 §2).
 *
 * npm names the host. The addon rides inside the host tarball on its own cadence,
 * so the registry has no name for it — and the project knew that, and had three
 * readers for the addon version, and not one of them compared the copy a user is
 * RUNNING to the copy their host SHIPPED. Walked live against the published
 * `breakpoint-mcp@1.74.1`:
 *
 *   npm install breakpoint-mcp   → 1.74.1, addon 1.9.9
 *   breakpoint-mcp init          → addon: installed  (1.9.9)
 *   … upgrade the host to 1.75.0, whose bundled addon is 1.10.0 …
 *   breakpoint-mcp init          → addon: skipped    (STILL 1.9.9, forever)
 *   breakpoint-mcp doctor        → ✓ addon-installed (version 1.9.9)
 *
 * A green checkmark printing the number that proves it should be red. The rows
 * below are the four places that number now has to survive: the comparison itself,
 * the skip that made it permanent, the live handshake that was throwing it away,
 * and the remedy that could not reach the addon old enough to need it.
 */

// ---- compareAddonVersions -------------------------------------------------

test("compareAddonVersions orders dotted numeric versions in both directions", () => {
  assert.equal(compareAddonVersions("1.9.9", "1.10.0"), "older");
  assert.equal(compareAddonVersions("1.10.0", "1.9.9"), "newer");
  assert.equal(compareAddonVersions("1.10.0", "1.10.0"), "same");
  // 🔴 THE ROW THAT MAKES THE DIRECTION REAL. String comparison puts "1.9.9" AFTER
  // "1.10.0" — the exact pair this defect was measured on — so a lexicographic
  // implementation reports the stale addon as the newer one and the remedy tells a
  // user to overwrite the wrong side.
  assert.ok("1.9.9" > "1.10.0");
});

test("compareAddonVersions pads missing segments rather than guessing", () => {
  assert.equal(compareAddonVersions("1.10", "1.10.0"), "same");
  assert.equal(compareAddonVersions("2", "1.10.0"), "newer");
});

test("compareAddonVersions refuses to order anything that is not dotted digits", () => {
  // 254's rule: a remedy is an instruction somebody will execute, and "your addon is
  // older" is an instruction. Unparseable is `unknown`, never a direction.
  assert.equal(compareAddonVersions("1.10.0-rc1", "1.10.0"), "unknown");
  assert.equal(compareAddonVersions(null, "1.10.0"), "unknown");
  assert.equal(compareAddonVersions("1.10.0", null), "unknown");
});

// ---- readAddonVersion -----------------------------------------------------

test("readAddonVersion reads plugin.cfg, and reports unreadable as null not a sentinel", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bpmcp-ver-"));
  try {
    assert.equal(readAddonVersion(dir), null); // no plugin.cfg at all
    fs.writeFileSync(path.join(dir, "plugin.cfg"), '[plugin]\nname="x"\nversion="1.9.9"\n');
    assert.equal(readAddonVersion(dir), "1.9.9");
    fs.writeFileSync(path.join(dir, "plugin.cfg"), '[plugin]\nname="x"\n');
    assert.equal(readAddonVersion(dir), null); // present, but no version key
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the skip that made the skew permanent --------------------------------

test("installAddon reports the pair across a skip — the read `existsSync` never did", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bpmcp-skew-"));
  try {
    const src = path.join(dir, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, "plugin.cfg"), '[plugin]\nname="x"\nversion="1.10.0"\n');
    const proj = path.join(dir, "proj");
    fs.mkdirSync(path.join(proj, "addons", "breakpoint_mcp"), { recursive: true });
    fs.writeFileSync(
      path.join(proj, "addons", "breakpoint_mcp", "plugin.cfg"),
      '[plugin]\nname="x"\nversion="1.9.9"\n',
    );

    const skipped = installAddon(src, proj, { force: false });
    assert.equal(skipped.action, "skipped");
    assert.equal(skipped.installed, "1.9.9");
    assert.equal(skipped.source, "1.10.0");
    assert.equal(skipped.skew, "older");
    // The whole defect in one assertion: the skip left the old addon in place.
    assert.equal(installedAddonVersion(proj), "1.9.9");

    // …and `--force`, the thing the remedy never said, is what actually moves it.
    const forced = installAddon(src, proj, { force: true });
    assert.equal(forced.action, "overwritten");
    assert.equal(installedAddonVersion(proj), "1.10.0");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("installAddon calls a skip over an up-to-date addon exactly that, and stays quiet", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bpmcp-same-"));
  try {
    const src = path.join(dir, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, "plugin.cfg"), '[plugin]\nname="x"\nversion="1.10.0"\n');
    const proj = path.join(dir, "proj");
    fs.mkdirSync(path.join(proj, "addons", "breakpoint_mcp"), { recursive: true });
    fs.writeFileSync(
      path.join(proj, "addons", "breakpoint_mcp", "plugin.cfg"),
      '[plugin]\nname="x"\nversion="1.10.0"\n',
    );
    const r = installAddon(src, proj, { force: false });
    assert.equal(r.action, "skipped");
    // 🔴 THE NEGATIVE HALF. `init` is idempotent by design and re-running it is
    // normal; a warning on every skip would be noise on the correct path, and noise
    // on the correct path is how a warning stops being read on the wrong one.
    assert.equal(r.skew, "same");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the live half: what a bridge REPORTS ---------------------------------

test("addonRunningCheck reds a bridge reporting an older addon, and names the bridge", () => {
  const c = addonRunningCheck("editor-bridge", "1.9.9", "1.10.0");
  assert.ok(c);
  assert.equal(c.name, "addon-running-editor");
  assert.equal(c.status, "fail");
  assert.equal(c.severity, "info"); // reported, never a red exit — see doctor.ts
  assert.equal(c.hint, ADDON_SKEW_HINT);
});

test("addonRunningCheck emits nothing when no bridge answered with a version", () => {
  // A closed editor must produce no row rather than a row about nothing — 256's rule
  // that an untaken measurement and a passed one must not look the same at a glance.
  assert.equal(addonRunningCheck("editor-bridge", null, "1.10.0"), null);
});

test("addonRunningCheck separates the two planes, because the next actions differ", () => {
  const editor = addonRunningCheck("editor-bridge", "1.10.0", "1.10.0");
  const runtime = addonRunningCheck("runtime-bridge", "1.10.0", "1.10.0");
  assert.notEqual(editor?.name, runtime?.name);
  assert.equal(runtime?.name, "addon-running-runtime");
});

// ---- the remedy that shipped only where it was not needed ------------------

test("the host answers unknown_method for the addon that cannot answer for itself", () => {
  // 🔴 THE POINT OF THE WHOLE FALLBACK. `error_remedies.gd` was ADDED IN ADDON
  // 1.10.0, and its `unknown_method` row explains that the addon is older than the
  // host — so every addon old enough to raise the code predates the file that would
  // explain it. A stale addon sends an error with NO remedy field, which is this:
  const remedy = remedyForWireError("unknown_method", undefined);
  assert.ok(remedy);
  assert.match(remedy, /--force/);
});

test("an addon that sent its own remedy keeps it — the host never overrides", () => {
  const fromAddon = "Call `scene_open` first.";
  assert.equal(remedyForWireError("unknown_method", fromAddon), fromAddon);
  // Empty string is "the addon said nothing", not "the addon said nothing on purpose".
  assert.equal(remedyForWireError("unknown_method", ""), HOST_FALLBACK_REMEDIES.unknown_method);
});

test("a code with no fallback row gets no remedy invented for it", () => {
  assert.equal(remedyForWireError("no_scene", undefined), undefined);
});

test("the host fallback stays one row — the positive control over its own ceiling", () => {
  // 🔴 THIS ROW IS THE PREMISE, NOT THE FIX. 254 put the remedies where the codes are
  // RAISED, one file with a join checkable in both directions. A host-side table is
  // the cheapest place to answer anything, so it is the one that grows back. If this
  // reddens, the question is not "update the number" but "why can the raising side
  // not answer that code either" — see contract_check check 28f, which refuses on the
  // same ceiling from the gate side.
  assert.equal(Object.keys(HOST_FALLBACK_REMEDIES).length, 1);
});
