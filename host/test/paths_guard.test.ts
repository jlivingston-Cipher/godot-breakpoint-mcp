import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  resolveInsideProject,
  resolveExistingFile,
  resolveWriteTarget,
} from "../src/paths.js";

/**
 * The escape / existence guards added in session 161.
 *
 * These exist because five sessions READ this code and got the conclusion wrong
 * in two directions; the sixth measured it against a real editor and found that
 * `card_deck_from_table` read a file OUTSIDE the project root through three
 * different spellings, and that four tabletop writers plus four netcode writers
 * CREATED files outside it through `res://../` — which satisfies a
 * `startsWith("res://")` pre-guard. Every case below is one of those
 * measurements, pinned so it cannot come back.
 */

/** A real project root with a real sibling beside it — the sibling is the point. */
function workspace(): { root: string; evil: string; cleanup: () => void } {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gcb-guard-")));
  const root = path.join(base, "proj");
  // NOT "evil" in a separate parent: `<root>_evil` deliberately SHARES the root's
  // string prefix, which is exactly what a bare startsWith(root) would let past.
  const evil = `${root}_evil`;
  fs.mkdirSync(root);
  fs.mkdirSync(evil);
  fs.writeFileSync(path.join(root, "cards.csv"), "name\nAlpha\n");
  fs.writeFileSync(path.join(root, "empty.csv"), "");
  fs.mkdirSync(path.join(root, "adir"));
  fs.writeFileSync(path.join(evil, "outside.csv"), "name\nLEAK\n");
  return { root, evil, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

const codeOf = (fn: () => unknown): string => {
  try { fn(); } catch (e) { return (e as { code?: string }).code ?? "<no code>"; }
  return "<did not throw>";
};

// ------------------------------------------------ resolveInsideProject ----

test("resolveInsideProject accepts res://, project-relative, and absolute-INSIDE", () => {
  const { root, cleanup } = workspace();
  const want = path.join(root, "cards.csv");
  assert.equal(resolveInsideProject("res://cards.csv", root), want);
  assert.equal(resolveInsideProject("cards.csv", root), want);
  // James's call, session 161: an absolute path that LANDS INSIDE stays legal —
  // `table_path` is documented as "res:// or absolute" and narrowing it would
  // break callers passing a full path to a file in their own project.
  assert.equal(resolveInsideProject(want, root), want);
  cleanup();
});

test("resolveInsideProject REFUSES all three escape spellings", () => {
  const { root, evil, cleanup } = workspace();
  const outside = path.join(evil, "outside.csv");
  for (const spelling of [
    outside,                                            // absolute
    `res://../${path.basename(evil)}/outside.csv`,      // res://.. — passes a startsWith("res://") pre-guard
    `../${path.basename(evil)}/outside.csv`,            // bare ../
  ]) {
    assert.equal(codeOf(() => resolveInsideProject(spelling, root)), "path_outside_project", spelling);
  }
  cleanup();
});

test("resolveInsideProject compares against root + sep, so a SIBLING sharing the prefix is refused", () => {
  const { root, evil, cleanup } = workspace();
  // The regression this pins: `${root}_evil`.startsWith(root) is TRUE. Only the
  // separator makes the two directories distinguishable. 160 §7 carries this as
  // a standing gotcha; here it is an assertion instead of a note.
  assert.ok(evil.startsWith(root), "the fixture must share the prefix or it proves nothing");
  assert.equal(codeOf(() => resolveInsideProject(path.join(evil, "outside.csv"), root)), "path_outside_project");
  cleanup();
});

test("resolveInsideProject allows the project root itself (a directory check is a separate question)", () => {
  const { root, cleanup } = workspace();
  assert.equal(resolveInsideProject("", root), path.resolve(root));
  cleanup();
});

// ------------------------------------------------- resolveExistingFile ----

test("resolveExistingFile separates the FOUR causes that all answered 'does it exist?'", () => {
  const { root, evil, cleanup } = workspace();
  // Measured, session 161 — three of these four DID exist and were told they
  // might not. An empty table is a data problem; a missing one is a path problem.
  assert.equal(codeOf(() => resolveExistingFile("res://__nope.csv", root)), "not_found");
  assert.equal(codeOf(() => resolveExistingFile("res://adir", root)), "not_a_file");
  assert.equal(codeOf(() => resolveExistingFile("", root)), "not_a_file");
  assert.equal(codeOf(() => resolveExistingFile(path.join(evil, "outside.csv"), root)), "path_outside_project");
  // ...and a real, reachable, EMPTY file is none of the above: it resolves.
  assert.equal(resolveExistingFile("res://empty.csv", root), path.join(root, "empty.csv"));
  cleanup();
});

test("resolveExistingFile names the project root explicitly when the path is empty", () => {
  const { root, cleanup } = workspace();
  try {
    resolveExistingFile("", root);
    assert.fail("expected a refusal");
  } catch (e) {
    assert.match((e as Error).message, /project root itself/);
  }
  cleanup();
});

test("resolveExistingFile refuses OUTSIDE before it asks whether the file exists", () => {
  const { root, evil, cleanup } = workspace();
  // The outside file really is there, so a wrong ordering would answer
  // "not_found" or succeed — either would hide the escape.
  assert.ok(fs.existsSync(path.join(evil, "outside.csv")));
  assert.equal(codeOf(() => resolveExistingFile(`res://../${path.basename(evil)}/outside.csv`, root)), "path_outside_project");
  cleanup();
});

// ------------------------------------------------- resolveWriteTarget ----

test("resolveWriteTarget refuses an existing target unless overwrite, and reports `exists`", () => {
  const { root, cleanup } = workspace();
  // A path that is free: no refusal, exists:false.
  assert.deepEqual(
    resolveWriteTarget("res://new.tscn", root, {}),
    { fsPath: path.join(root, "new.tscn"), exists: false },
  );
  // A path that is taken, with no overwrite: REFUSED. This is the one an
  // ordinary caller hits by accident — before this, a second create APPENDED to
  // the existing scene and reported success (5 nodes on disk became 9).
  assert.equal(codeOf(() => resolveWriteTarget("res://cards.csv", root, {})), "exists");
  assert.equal(codeOf(() => resolveWriteTarget("res://cards.csv", root, { overwrite: false })), "exists");
  // ...and with overwrite:true it resolves, reporting that a tab may be stale.
  assert.deepEqual(
    resolveWriteTarget("res://cards.csv", root, { overwrite: true }),
    { fsPath: path.join(root, "cards.csv"), exists: true },
  );
  cleanup();
});

test("resolveWriteTarget refuses an ESCAPING target even with overwrite:true", () => {
  const { root, evil, cleanup } = workspace();
  // overwrite is permission to replace something of YOURS. It is not permission
  // to leave the project root, and an over-eager `if (overwrite) return` would
  // read as correct while reopening the whole hole.
  assert.equal(
    codeOf(() => resolveWriteTarget(`res://../${path.basename(evil)}/x.tscn`, root, { overwrite: true })),
    "path_outside_project",
  );
  cleanup();
});

test("every refusal carries refusal:true and a code, so fail() renders it", () => {
  const { root, cleanup } = workspace();
  try {
    resolveInsideProject("../nope/x.csv", root, "table_path");
    assert.fail("expected a refusal");
  } catch (e) {
    const r = e as { refusal?: boolean; code?: string; message: string };
    assert.equal(r.refusal, true);
    assert.equal(r.code, "path_outside_project");
    // The label is the caller's parameter NAME — "table_path", not "path" — so
    // the message tells you which argument to fix.
    assert.match(r.message, /table_path/);
  }
  cleanup();
});
