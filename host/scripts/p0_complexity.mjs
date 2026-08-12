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
import ts from "typescript";
import { readFileSync, globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// resolve against host/, not the caller's cwd — a reporter whose population depends on
// where it was invoked from is a reporter whose count nobody can reproduce.
export const HOST = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function main() {
  const files = globSync("src/**/*.ts", { cwd: HOST });
  const rows = [];
  const fileRows = [];
  for (const f of files) {
    const r = measureSource(readFileSync(resolve(HOST, f), "utf8"), f);
    rows.push(...r.rows);
    fileRows.push({ file: f, lines: r.lines, maxNest: r.maxNest });
  }
  const by = (k) => [...rows].sort((a, b) => b[k] - a[k]).slice(0, 40);
  const pad = (n, w) => String(n).padStart(w);

  console.log(`functions measured: ${rows.length}   files: ${fileRows.length}`);
  console.log("\n=== TOP 40 BY CYCLOMATIC ===");
  for (const r of by("cyclo")) console.log(`${pad(r.cyclo, 4)}  cog=${pad(r.cognitive, 4)}  nest=${r.maxNest}  len=${pad(r.length, 4)}  ${r.file}:${r.line}  ${r.name}`);
  console.log("\n=== TOP 40 BY COGNITIVE ===");
  for (const r of by("cognitive")) console.log(`${pad(r.cognitive, 4)}  cyc=${pad(r.cyclo, 4)}  nest=${r.maxNest}  len=${pad(r.length, 4)}  ${r.file}:${r.line}  ${r.name}`);
  console.log("\n=== TOP 40 BY FUNCTION LENGTH — the control, and it disagrees on purpose ===");
  for (const r of by("length")) console.log(`${pad(r.length, 4)}  cyc=${pad(r.cyclo, 4)} cog=${pad(r.cognitive, 4)} nest=${r.maxNest}  ${r.file}:${r.line}  ${r.name}`);
  console.log("\n=== TOP 40 FILES BY LENGTH ===");
  for (const r of [...fileRows].sort((a, b) => b.lines - a.lines).slice(0, 40)) console.log(`${pad(r.lines, 5)}  maxnest=${r.maxNest}  ${r.file}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
