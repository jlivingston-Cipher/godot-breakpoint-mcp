// p0_complexity.mjs — session 241. P0 · cyclomatic + cognitive complexity per function,
// file length, max nesting depth.
//
// Uses the TypeScript compiler API (already a devDependency) so the boundaries are REAL
// FUNCTION BOUNDARIES rather than a brace count. That matters more than it sounds: this
// tree's longest functions are flat `registerXTools` blocks — 813 lines at cyclomatic 2 —
// so any measure that keys on size ranks nine near-branchless registration bodies above
// every function that is actually hard to read.
//
// 🔴 BOTH COLUMNS ARE PRINTED SEPARATELY AND NEITHER IS COMBINED INTO A SCORE. Cyclomatic
// counts decision points; cognitive charges for NESTING. `parseStatusV2` is cyclomatic 20
// and cognitive 76 in 32 lines at depth 8 — it is the hardest function in the tree and it
// is nowhere near the longest. A single blended number would have hidden that, which is
// the failure mode the inventory records against a line-coverage percentage.
//
// This file PRINTS. Its claims are in p0_complexity.selftest.mjs beside it.
//
// 🆕 244 §4 — AND SINCE THIS SESSION IT ALSO REFUSES, WHICH IS THE ONLY REASON IT CAN BE
// SWEPT. `p0-reporters-unblinded` (241) was blocked on one sentence: *`LATE_LIVE` needs a
// second command that goes RED when a member is blinded, and a reporter that PRINTS
// cannot.* Blind `measureFunction` and this file still says `functions measured: 1095`
// and exits 0 — the exact observable the late axis exists to refuse. `--floor` is that
// second command: it asks whether this reporter's own measurement is still a MEASUREMENT.
// 🔴 AND IT IS NOT A FLOOR ON THE POPULATION ALONE, because `measureFunction` blinded
// leaves the population intact and takes every VALUE in it to a constant — 1095 functions,
// all scoring zero, in green. So the second half of the question is SPREAD: a reader that
// answers one number for every row is agreeing with the walk, not measuring the code.
// Same shape as `handoff_gate.py`'s `MOVED_CONSTANT`, one file over.
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// resolve against host/, not the caller's cwd — a reporter whose population depends on
// where it was invoked from is a reporter whose count nobody can reproduce.
export const HOST = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 🔴 242 — NOT `globSync`, AND THE REASON IS THE ENGINE RANGE THIS PACKAGE PUBLISHES.
// The shipped draft imported `globSync` from `node:fs`, which was exposed in Node
// **22.0.0**. `host/package.json` declares `engines.node: ">=18"` and CI runs the matrix
// 18 · 20 · 22, so on two of its own three legs this file did not merely misbehave — an
// ESM named import of an export that does not exist fails at LINK time, so the module
// never loaded at all: `SyntaxError: The requested module 'node:fs' does not provide an
// export named 'globSync'`, reproduced on v20.19.0. Nothing caught it because this file
// is in neither `ci.yml` nor the session replay list — 241 §4's IOU arriving as a defect
// one session later, and `tsc --checkJs` reported it as TS2305 the whole time.
//
// `readdirSync(dir, {recursive: true})` is NOT the fix either: that option landed in
// 18.17/20.1 and an older 18 IGNORES it silently, which is a wrong population rather
// than an error. A hand walk has no version floor at all. Sorted, because this reporter
// prints counts and cluster keys and a directory order that varies by filesystem is a
// number nobody can reproduce.
export function walkTs(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const abs = resolve(dir, e.name);
    if (e.isDirectory()) walkTs(abs, base, out);
    else if (e.name.endsWith(".ts")) out.push(abs.slice(base.length + 1).split("\\").join("/"));
  }
  return out;
}

export const DECISION = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ConditionalExpression,
]);

export const NESTING = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.ConditionalExpression,
]);

export const FUNCTIONISH = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);

const isLogicalBinary = (n) =>
  ts.isBinaryExpression(n) &&
  (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
    n.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
    n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken);

/** The name to file a function under — declared, or the binding it was assigned to. */
export function nameOf(node, sf) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  const p = node.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isPropertyAssignment(p) && p.name) return p.name.getText(sf);
  if (node.kind === ts.SyntaxKind.Constructor) return "constructor";
  return "<anonymous>";
}

/** Cyclomatic, cognitive and max nesting for ONE function, excluding nested functions. */
export function measureFunction(fn) {
  let cyclo = 1;
  let cognitive = 0;
  let maxNest = 0;
  function walk(n, depth) {
    // 🔴 DO NOT DESCEND INTO A NESTED FUNCTION. It is measured on its own row, and
    // charging its branches to the parent is how `registerRuntimeTools` — twenty-seven
    // tool callbacks in one body — would have come out as the most complex function in
    // the tree instead of the flattest one in the top forty.
    if (n !== fn && FUNCTIONISH.has(n.kind)) return;
    let d = depth;
    if (DECISION.has(n.kind)) cyclo++;
    if (isLogicalBinary(n)) { cyclo++; cognitive++; }
    if (NESTING.has(n.kind)) {
      cognitive += 1 + depth;        // structural increment PLUS the nesting penalty
      d = depth + 1;
      if (d > maxNest) maxNest = d;
    }
    ts.forEachChild(n, (c) => walk(c, d));
  }
  walk(fn, 0);
  return { cyclo, cognitive, maxNest };
}

/** Every function in one source, each with its own row. Nested functions get their own. */
export function measureSource(text, fileName = "<mem>") {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  const rows = [];
  let fileMaxNest = 0;

  function visit(node) {
    if (FUNCTIONISH.has(node.kind)) {
      const { cyclo, cognitive, maxNest } = measureFunction(node);
      const start = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const end = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      rows.push({ file: fileName, name: nameOf(node, sf), line: start, length: end - start + 1, cyclo, cognitive, maxNest });
      if (maxNest > fileMaxNest) fileMaxNest = maxNest;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return { rows, lines: text.split("\n").length, maxNest: fileMaxNest };
}

// 🆕 244 §4 — FLOORED FROM BELOW WITH HEADROOM (198 §36), NEVER SUMMED (172 §6). Measured
// on the live tree at 1.74.0: 68 files, 1095 functions, 24 distinct cyclomatic values, 34
// cognitive, 8 nesting depths, 363 distinct names, top cyclomatic 41. A floor a healthy
// tree can trip by deleting one function is a floor that gets deleted instead of obeyed;
// a floor per QUANTITY rather than one total is 172 §6's rule, because a single number
// lets one collapsed measure hide behind five intact ones.
export const FLOOR = {
  files: 55,
  functions: 900,
  cycloValues: 12,
  cognitiveValues: 16,
  nestValues: 4,
  names: 250,
  maxCyclo: 20,
};

export function floorProblems(rows, fileRows, floor = FLOOR) {
  const distinct = (k) => new Set(rows.map((r) => r[k])).size;
  const out = [];
  const at = (what, got, want) => {
    if (got < want) out.push(`${what} ${got}, floor ${want}`);
  };
  at("files walked", fileRows.length, floor.files);
  at("functions measured", rows.length, floor.functions);
  // 🔴 THE SPREAD HALF. Every one of these is a measure this file PUBLISHES a ranking of,
  // and each collapses to 1 under a different blind: `measureFunction` takes all three
  // numeric ones at once, `nameOf` takes the names, and a `measureSource` that stopped
  // recursing takes the population above. None of them is inferable from the others.
  at("distinct cyclomatic values", distinct("cyclo"), floor.cycloValues);
  at("distinct cognitive values", distinct("cognitive"), floor.cognitiveValues);
  at("distinct nesting depths", distinct("maxNest"), floor.nestValues);
  at("distinct function names", distinct("name"), floor.names);
  at("highest cyclomatic", Math.max(0, ...rows.map((r) => r.cyclo)), floor.maxCyclo);
  return out;
}

function main() {
  const files = walkTs(resolve(HOST, "src"), HOST);
  const rows = [];
  const fileRows = [];
  for (const f of files) {
    const r = measureSource(readFileSync(resolve(HOST, f), "utf8"), f);
    rows.push(...r.rows);
    fileRows.push({ file: f, lines: r.lines, maxNest: r.maxNest });
  }
  // 🔴 242 — THE TIE-BREAK IS PART OF THE RANKING, AND ITS ABSENCE WAS ONLY INVISIBLE
  // BECAUSE ONE WALK ORDER WAS EVER USED. `sort` is stable, so with no second key these
  // tables were ordered by the order the FILES arrived in — `globSync`'s, which is
  // neither sorted nor specified. Swapping the walk left every count identical (1095
  // functions, 68 files) and moved tied rows, one of them ACROSS the 40-row cut: the
  // TOP-40-BY-LENGTH table gained `cli/doctor.ts:171 whichSync` and lost
  // `tools/netcode.ts:350 <anonymous>`, both at length 12. A published table whose
  // membership depends on directory order is a number nobody can reproduce, which is the
  // property the header of this file claims for it. `file:line` is unique per row.
  // 🔴 THE REFUSING HALF RUNS BEFORE ANY TABLE IS PRINTED, so a `--floor` run that fails
  // says exactly which measure collapsed and nothing else — a refusal buried under four
  // forty-row tables is a refusal nobody reads.
  if (process.argv.includes("--floor")) {
    // 🔴 THE CENSUS FIRST, BEFORE ANY VERDICT BRANCH. `instrument_gate.py`'s late axis
    // reads this line to tell a CATCH from a CRASH, so it has to survive the red path —
    // the `ok` line below does not, which is 232 §5.6's draft-2 failure exactly.
    console.log(
      `P0_COMPLEXITY_CENSUS files=${fileRows.length} functions=${rows.length} ` +
      `cyclo=${new Set(rows.map((r) => r.cyclo)).size} ` +
      `cognitive=${new Set(rows.map((r) => r.cognitive)).size} ` +
      `nest=${new Set(rows.map((r) => r.maxNest)).size} ` +
      `names=${new Set(rows.map((r) => r.name)).size}`,
    );
    const problems = floorProblems(rows, fileRows);
    // 🔴 `FAIL <NAME>` IS THE SPELLING `instrument_gate.py`'s `failure_lines` COUNTS, and
    // the first draft of this command did not use it: blinded, `--floor` exited 1 and the
    // late axis recorded a blast of ZERO — a refusal the harness could see the shape of
    // and not the size of. A gate whose reds are uncountable cannot be floored.
    for (const p of problems) console.log(`  FAIL P0_COMPLEXITY_FLOOR ${p}`);
    if (problems.length) {
      console.log(
        `P0_COMPLEXITY_FLOOR ${problems.length} measure(s) collapsed — this reporter is ` +
        `still printing and has stopped measuring`,
      );
      process.exitCode = 1;
      return;
    }
    console.log("P0_COMPLEXITY_FLOOR ok — every measure is above its floor");
    return;
  }

  const rank = (k) => (a, b) => b[k] - a[k] || (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line);
  const by = (k) => [...rows].sort(rank(k)).slice(0, 40);
  const pad = (n, w) => String(n).padStart(w);

  console.log(`functions measured: ${rows.length}   files: ${fileRows.length}`);
  console.log("\n=== TOP 40 BY CYCLOMATIC ===");
  for (const r of by("cyclo")) console.log(`${pad(r.cyclo, 4)}  cog=${pad(r.cognitive, 4)}  nest=${r.maxNest}  len=${pad(r.length, 4)}  ${r.file}:${r.line}  ${r.name}`);
  console.log("\n=== TOP 40 BY COGNITIVE ===");
  for (const r of by("cognitive")) console.log(`${pad(r.cognitive, 4)}  cyc=${pad(r.cyclo, 4)}  nest=${r.maxNest}  len=${pad(r.length, 4)}  ${r.file}:${r.line}  ${r.name}`);
  console.log("\n=== TOP 40 BY FUNCTION LENGTH — the control, and it disagrees on purpose ===");
  for (const r of by("length")) console.log(`${pad(r.length, 4)}  cyc=${pad(r.cyclo, 4)} cog=${pad(r.cognitive, 4)} nest=${r.maxNest}  ${r.file}:${r.line}  ${r.name}`);
  console.log("\n=== TOP 40 FILES BY LENGTH ===");
  for (const r of [...fileRows].sort((a, b) => b.lines - a.lines || (a.file < b.file ? -1 : 1)).slice(0, 40)) console.log(`${pad(r.lines, 5)}  maxnest=${r.maxNest}  ${r.file}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
