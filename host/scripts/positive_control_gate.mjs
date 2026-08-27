#!/usr/bin/env node
// positive_control_gate.mjs — session 219.
//
// 215 §7.4/§7.5, promoted out of `_to_delete/probe214_control.mjs` after four sessions of
// being carried as a note. The question it asks is 213 §3's:
//
//     `assert.deepEqual(wire, [])` passes on a collection that CAN be non-empty and on
//     one that never fills. Does the claim's own unit prove which?
//
// 🔴 AND IT ASKS THAT QUESTION WITH THREE ANSWERS FOR "NO", NOT ONE. That is the whole
// correction 215 §4 made and the reason this could not be promoted as it stood. A boolean
// finder reports the two classes below as defects, gets overridden by hand on its first
// run, and an instrument overridden by hand is one nobody reads:
//
//   EXEMPT_TRAP        `unhandled` / `uncaught` are PROCESS TRAPS. They fill only when
//                      Node is about to die, so the "legal case that proves the collection
//                      can fill" would be a real uncaughtException injected into the shared
//                      test process — asserting the exact fault the test denies. Their
//                      floor sits on a COMPANION binding proving the failure path ran.
//   POPULATION_FLOORED `contradictory` is an INTERSECTION accumulated over `calls`. It can
//                      only ever fill when a real bug exists, so it cannot carry a control
//                      of its own; what can go vacuous is the POPULATION it drains, and
//                      that is where the floor belongs.
//
// 🔴 NEITHER CLASS IS A ROSTER. 217 §6.3: a hand-maintained set is a second list, and a
// second list is one an eighth member can be left off without anyone noticing. Both are
// derived STRUCTURALLY from the source — a trap is a collector whose every write happens
// inside a `process.on("uncaughtException"|"unhandledRejection", …)` callback, and a
// floored population is an accumulator whose iteration source carries a control. A trap
// with NO companion floor is not exempt; it is `PC_TRAP_UNFLOORED`, named separately so it
// cannot hide inside the defect ceiling.
//
// 🔴 AND THE ACCEPTANCE FIXTURE IS CONTENT-ADDRESSED. 215 §4 measured the probe's
// line-numbered list at 1/8 after a single session's edits — four line drifts and two
// intended flips, none of them a regression, all of them indistinguishable from one. A
// fixture that goes stale on the first edit to the files it watches is a fixture nobody
// will trust the second time it reddens. Members are addressed by (file, unit name, the
// claim's own text), and a member whose SITE cannot be found at all is its own refusal.
//
// 🆕 246 — AND THE READER NOW CROSSES THE IMPORT, WHICH IS 214 §7.6's FIRST OPTION AND
// THE ONE NOBODY TOOK FOR THIRTY-TWO SESSIONS. That row named five claims whose
// collection is a module constant in ANOTHER file and offered three ways out: teach the
// finder to read the import, floor each of the five inline, or exempt them and say so.
// The second and third both end at a roster; only the first makes the answer a
// MEASUREMENT. `declared-outside-this-file` stays exactly where it was for a specifier
// this reader cannot resolve — an honest terminal is the point of it — but an import it
// CAN follow is no longer a weak spot, it is one more hop in the same chain.
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { analyze, FLOORS, FLOOR_RE } from "./tautology_gate.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

// ── verdicts ────────────────────────────────────────────────────────────────────────
export const DEFENDED = "defended";
export const EXEMPT_TRAP = "exempt-trap";
export const POPULATION_FLOORED = "population-floored";
export const DEFECT = "defect";
export const RESIDUE = "residue";

// ── refusal codes ───────────────────────────────────────────────────────────────────
// Named so the self-test can assert WHICH refusal fired rather than only that one did:
// two defects returning the same value is how a zeroed constant stays green.
export const PC_OK = "PC_OK";
export const PC_POPULATION = "PC_POPULATION";
export const PC_FILES = "PC_FILES";
export const PC_ACCEPTANCE = "PC_ACCEPTANCE";
export const PC_ACCEPTANCE_MISSING = "PC_ACCEPTANCE_MISSING";
export const PC_TRAP_UNFLOORED = "PC_TRAP_UNFLOORED";
export const PC_UNDEFENDED_EXCESS = "PC_UNDEFENDED_EXCESS";
export const PC_UNREADABLE_EXCESS = "PC_UNREADABLE_EXCESS";

// 🔴 THE FLOORS, AND THEY EXIST BECAUSE A FINDER THAT READS NOTHING REPORTS NO DEFECTS.
// 170 §4's shape, and `verdict_gate`'s `VERDICT_SCOPE_COLLAPSE` one file over: every
// branch below is scored over `findings`, so a filter that quietly stopped matching leaves
// this gate printing "0 defects" over a population of zero. Measured 48 claims across 12
// files; set below both so ordinary editing has room and a collapse has none.
export const CLAIM_FLOOR = 40;
// The walk itself, floored the way `tautology_gate`'s FILE_FLOORS are and for the same
// reason: claim sites alone cannot see a directory that quietly stopped being read,
// because the remaining files' headroom absorbs the loss. Measured 106.
export const FILE_FLOOR = 90;
// 🔴 A CEILING, NOT A FLOOR, AND IT IS THE LIVE VALUE. Fifteen unguarded collectors ship
// today. The number was ungoverned for six sessions; ceilinging it at what it actually is
// means the next collector that arrives without a control reddens the run, and driving the
// existing ones down is a separate piece of work that this does not pretend to have done.
// 🆕 246 — IT CAME DOWN BY FIVE, AND NOT ONE UNIT CHANGED. The import hop below resolved
// the whole `declared-outside-this-file` terminal class, and every one of those five
// collections turned out to be derived from a non-empty literal in the file it was
// imported from. A ceiling left at its old value after the population under it shrank is
// headroom nobody voted for, so it moves in the commit that shrinks it.
export const DEFECT_CEILING = 15;
// 🆕 246 — HOW FAR THE READER MAY FOLLOW AN IMPORT, AND WHY THERE IS A LIMIT AT ALL.
// A re-export chain can be circular, and a walker with no budget on a cycle does not
// return. Three hops covers every case in this tree (`ANNOTATED_TOOLS` is the deepest at
// two: the test's import, then `ALL_ANNOTATED` in the same module); a chain longer than
// this ends in the same honest terminal an unresolvable specifier does.
export const IMPORT_HOPS = 3;
// 🆕 246 — AND HOW MANY DERIVATION STEPS ONE CHAIN MAY TAKE, WHICH THE HOP MOVED.
// It was a bare 8, and eight was enough while every chain ended in the file it started
// in. Measured after the hop, the deepest chain in this tree is THIRTEEN nodes and
// crosses one file: `stale` in `annotations.test.ts` reaches the roster literal in
// `src/annotations.ts` through a filter, a spread, a `new Set`, an `Object.freeze`, a
// second spread and a `.sort()`. 🔴 A BUDGET THAT RUNS OUT
// REPORTS TERMINAL `none` AND VERDICT DEFECT — the same answer as a real undefended
// collection, from a reader that simply stopped walking. That is the failure this file
// exists to refuse, so the number is named, stated as a measurement, and floored well
// above it rather than left as a literal in a boundary test.
export const CHAIN_DEPTH = 16;
// The claims this reader cannot read at all. 213 §4.22: a classifier with no `unclassified`
// column has not classified anything, it has partitioned — so residue is REPORTED, and
// capped, rather than folded into either answer.
export const RESIDUE_CEILING = 1;

// ── the population, and the exemption it inherits from `tautology_gate` ──────────────
const TEST_FNS = new Set(["test", "it", "family"]);
const CHECK_FNS = new Set(["check", "_check", "assertOk", "claim", "verdict"]);
const DERIVER_METHODS = new Set([
  "filter", "map", "flatMap", "flat", "reduce", "reduceRight", "concat", "slice",
  "sort", "reverse", "entries", "keys", "values", "toSorted", "toReversed", "join",
]);
const TRAP_EVENTS = /^(uncaughtException|unhandledRejection)$/;
const LISTENER_FNS = /^(on|once|addListener|prependListener|prependOnceListener)$/;

const EMPTY_LITERAL = "empty-array-literal";
const NONEMPTY_LITERAL = "non-empty-literal";
const OPAQUE_CALL = "opaque-producer-call";
// 🆕 246 — AN OBJECT LITERAL IS A POPULATION TOO, AND FOUR OF THE FIVE END IN ONE.
// `Object.keys(TOOL_CAPABILITIES)` was already walked into its argument by the static
// forms below; the argument then landed on an ObjectLiteralExpression and this reader had
// no branch for it, so the chain ended in `unreadable-ObjectLiteralExpression` — the
// terminal that means "ask a human". A literal with properties proves `Object.keys` of it
// is non-empty for the same reason a literal with elements proves it of an array.
const EMPTY_OBJECT = "empty-object-literal";
const NONEMPTY_OBJECT = "non-empty-object-literal";
export const IMPORTED = "declared-outside-this-file";

const norm = (s) => s.replace(/\s+/g, " ").trim();

// ── 🆕 246 — THE IMPORT HOP ──────────────────────────────────────────────────────────
//
// 🔴 THE FILESYSTEM STAYS ABOVE THE READER, WHICH IS THE WHOLE REASON `--selftest` CAN
// DRIVE THIS BRANCH. 215 §4's rule for this file is that `classify` is pure over
// (fileName, sourceText); an import hop that called `readFileSync` inside it would make
// the new branch the one thing in here no self-test could reach without a fixture tree on
// disk. So the hop takes a READER as a parameter — the real tree passes the one below,
// the self-test passes a Map — and the branch itself is the same code in both.
export function fsModuleReader(fromFile, spec, root = ROOT) {
  if (!spec.startsWith(".")) return null;          // a package, not a file in this tree
  const base = resolvePath(dirname(join(root, fromFile)), spec);
  // TypeScript sources import each other by their EMITTED `.js` specifier, so the file
  // that actually holds the declaration is the `.ts` beside it. Both are tried, and so is
  // a directory index, because guessing one convention is how a resolver goes quietly
  // blind on a tree that uses the other.
  const cands = [
    base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".mjs"), base,
    `${base}.ts`, `${base}.mjs`, `${base}.js`,
    join(base, "index.ts"), join(base, "index.mjs"), join(base, "index.js"),
  ];
  for (const c of cands) {
    if (!existsSync(c) || !statSync(c).isFile()) continue;
    return { fileName: c.startsWith(root) ? c.slice(root.length) : c, text: readFileSync(c, "utf8") };
  }
  return null;
}

const SF_CACHE = new Map();
function sourceFileOf(fileName, text) {
  const key = `${fileName}::${text.length}`;
  let sf = SF_CACHE.get(key);
  if (!sf) {
    sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true,
      /\.ts$/.test(fileName) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    SF_CACHE.set(key, sf);
  }
  return sf;
}

/** (module specifier, exported name) for `local` if this file imports it, else null. */
export function importedFrom(sf, local) {
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !s.importClause) continue;
    if (!ts.isStringLiteralLike(s.moduleSpecifier)) continue;
    const spec = s.moduleSpecifier.text;
    const nb = s.importClause.namedBindings;
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        if (el.name.text === local) return { spec, exported: (el.propertyName ?? el.name).text };
      }
    }
    // `import X from "…"` — a default export is a declaration this reader can still find.
    if (s.importClause.name && s.importClause.name.text === local) return { spec, exported: "default" };
  }
  return null;
}

/** The initializer of `export const <name> = …` in an already-parsed module, or null. */
export function exportedInitializer(sf, name) {
  for (const s of sf.statements) {
    if (!ts.isVariableStatement(s)) continue;
    if (!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of s.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer) return d.initializer;
    }
  }
  return null;
}


// ════════════════════════════════════════════════════════════════════════════════════
// THE BINDER — one walker, parameterised by the source file it walks (🆕 246).
//
// 🔴 ONE CHAIN WALKER, NOT TWO. Following an import means walking a SECOND file's AST,
// and the reflex is to write a small second reader for "just the imported constant".
// That reader would drift from this one on the first branch either gained — the exact
// failure `scope_gate.py`'s header calls out one language over ("ONE PARSER, NOT TWO").
// So the walker is lifted out of `classify` verbatim and takes its source file as an
// argument; the hop below builds another instance of the SAME function over the imported
// module and lets it push into the same chain.
//
// 🔴 AND THE KEYSPACE IS WHY THAT IS SAFE. A declaration key is a byte offset, so an
// offset from the imported file and an offset from this one can be equal while naming
// different bindings — and `sameTarget` matches a control to a claim on (text, declKey).
// Hopped entries are keyed `<file>@<offset>`, which cannot collide with the local
// numeric offsets, so a control in the unit can never bind to an imported node by
// arithmetic coincidence.
// ════════════════════════════════════════════════════════════════════════════════════
export function makeBinder(fileName, sf, opts = {}, hopsLeft = IMPORT_HOPS, keyspace = "") {
  const readModule = opts.readModule === undefined ? fsModuleReader : opts.readModule;

  function unwrap(e) {
    for (;;) {
      if (!e) return e;
      if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) ||
          ts.isAwaitExpression(e) || ts.isTypeAssertionExpression?.(e) || ts.isSatisfiesExpression?.(e)) {
        e = e.expression;
        continue;
      }
      return e;
    }
  }

  // 🔴 THE HOP, AND EVERY WAY IT CAN DECLINE IS THE SAME OLD TERMINAL. No reader, no
  // import statement, a package specifier, a file that is not there, an export this
  // module does not declare with an initialiser, or a budget spent — each returns null
  // and the caller falls back to `declared-outside-this-file`. A hop that half-worked
  // and reported something else would be worse than the weak spot it replaces.
  function hop(local, out, depth, seen) {
    if (!readModule || hopsLeft <= 0) return false;
    const imp = importedFrom(sf, local);
    if (!imp) return false;
    const mod = readModule(fileName, imp.spec);
    if (!mod) return false;
    const msf = sourceFileOf(mod.fileName, mod.text);
    const init = exportedInitializer(msf, imp.exported);
    if (!init) return false;
    const sub = makeBinder(mod.fileName, msf, opts, hopsLeft - 1, `${mod.fileName}@`);
    sub.chainOf(init, depth + 1, seen, out);
    return true;
  }

// ── binding resolution — the derivation chain, not a one-line regex (214 §5.2) ─────
function declaredNames(name, out) {
  if (ts.isIdentifier(name)) { out.push(name); return; }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const el of name.elements) if (ts.isBindingElement(el)) declaredNames(el.name, out);
  }
}
function matchIn(declList, name) {
  for (const d of declList) {
    const names = [];
    declaredNames(d.name, names);
    for (const n of names) {
      if (n.text !== name) continue;
      const whole = ts.isIdentifier(d.name);
      return { decl: d, key: d.pos, initializer: whole ? d.initializer ?? null : null, destructured: !whole };
    }
  }
  return null;
}
function resolveDecl(id) {
  const name = id.text;
  for (let p = id.parent; p; p = p.parent) {
    if ((ts.isForOfStatement(p) || ts.isForInStatement(p) || ts.isForStatement(p)) &&
        p.initializer && ts.isVariableDeclarationList(p.initializer)) {
      const m = matchIn(p.initializer.declarations, name);
      if (m) return ts.isForOfStatement(p) && !m.destructured ? { ...m, initializer: p.expression, forOf: true } : m;
    }
    if (ts.isFunctionLike(p)) {
      for (const prm of p.parameters ?? []) {
        const names = [];
        declaredNames(prm.name, names);
        if (names.some((n) => n.text === name)) return { decl: prm, key: prm.pos, initializer: null, parameter: true };
      }
    }
    const stmts = ts.isSourceFile(p) || ts.isBlock(p) || ts.isModuleBlock(p) || ts.isCaseClause(p) ? p.statements : null;
    if (!stmts) continue;
    for (const s of stmts) {
      if (!ts.isVariableStatement(s)) continue;
      const m = matchIn(s.declarationList.declarations, name);
      if (m) return m;
    }
  }
  return null;
}
function rootDeclKey(expr) {
  let e = unwrap(expr);
  for (let i = 0; e && i < 20; i++) {
    if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) || ts.isCallExpression(e)) { e = unwrap(e.expression); continue; }
    break;
  }
  if (e && ts.isIdentifier(e)) {
    const k = resolveDecl(e);
    // 🔴 A LOCAL KEY STAYS A NUMBER. `pushSites` asks `typeof declKey === "number"` to
    // decide whether a target is a binding it can find writes to, and `companionFloor`
    // compares raw `resolveDecl(...).key` values against it — so stringifying the local
    // case would silently take the trap and population-floor branches out of service.
    // The keyspace is a prefix for HOPPED files only, which is exactly where those two
    // readers must not reach anyway: a write site in another module is not in this unit.
    return k ? (keyspace ? `${keyspace}${k.key}` : k.key) : `free:${keyspace}${e.text}`;
  }
  return null;
}
// Where a terminal literal actually IS. A verdict that says "defended by a non-empty
// literal" and cannot say WHERE is a verdict a reader has to take on trust — and after
// the hop the literal is usually not in the file the claim is in.
const originOf = (n) => `${fileName}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;

function chainOf(expr, depth = 0, seen = new Set(), out = []) {
  const e = unwrap(expr);
  if (!e || depth > CHAIN_DEPTH) return out;
  const t = norm(e.getText(sf));
  if (!out.some((x) => x.text === t)) out.push({ text: t, node: e, declKey: rootDeclKey(e) });

  if (ts.isArrayLiteralExpression(e)) {
    if (e.elements.length && e.elements.every(ts.isSpreadElement)) {
      for (const el of e.elements) chainOf(el.expression, depth + 1, seen, out);
      return out;
    }
    out.push({ terminal: e.elements.length ? NONEMPTY_LITERAL : EMPTY_LITERAL, text: t, origin: originOf(e) });
    return out;
  }
  // 🆕 246 — AN OBJECT LITERAL, WHICH IS WHAT FOUR OF THE FIVE IMPORTS RESOLVE TO.
  // A spread-only literal is walked into for the array branch's reason: `{...X}` is
  // non-empty only if X is, and reading the brace as the answer would defend a claim
  // over a population that can be empty.
  if (ts.isObjectLiteralExpression(e)) {
    const props = e.properties;
    if (props.length && props.every((pp) => ts.isSpreadAssignment(pp))) {
      for (const pp of props) chainOf(pp.expression, depth + 1, seen, out);
      return out;
    }
    out.push({ terminal: props.length ? NONEMPTY_OBJECT : EMPTY_OBJECT, text: t, origin: originOf(e) });
    return out;
  }
  if (ts.isNewExpression(e)) {
    if (/^(Set|Map|Array)$/.test(e.expression.getText(sf)) && e.arguments?.length) {
      return chainOf(e.arguments[0], depth + 1, seen, out);
    }
    out.push({ terminal: OPAQUE_CALL, text: t });
    return out;
  }
  if (ts.isCallExpression(e)) {
    const callee = unwrap(e.expression);
    if (ts.isPropertyAccessExpression(callee)) {
      const m = callee.name.text;
      const recv = norm(callee.expression.getText(sf));
      // 🔴 THE STATIC FORMS ARE TESTED FIRST, AND THE ORDER IS NOT COSMETIC (214 §5.1).
      // `keys`/`values` are BOTH instance derivers and `Object.` statics, so a deriver
      // test that runs first reads `Object.keys(X)` as "a derivation of `Object`" and
      // walks to the global — four claims filed against a binding named `Object`.
      if (recv === "Object" && /^(keys|values|entries)$/.test(m) && e.arguments.length) {
        return chainOf(e.arguments[0], depth + 1, seen, out);
      }
      if (recv === "Array" && m === "from" && e.arguments.length) {
        return chainOf(e.arguments[0], depth + 1, seen, out);
      }
      // 🆕 246 — `Object.freeze(X)` IS X. It is the idiom this codebase publishes its
      // roster constants through (`ANNOTATED_TOOLS`), and reading it as an opaque
      // producer stops the chain one node short of the literal that answers the question.
      if (recv === "Object" && /^(freeze|assign)$/.test(m) && e.arguments.length) {
        return chainOf(e.arguments[0], depth + 1, seen, out);
      }
      if (DERIVER_METHODS.has(m)) return chainOf(callee.expression, depth + 1, seen, out);
    }
    out.push({ terminal: OPAQUE_CALL, text: t });
    return out;
  }
  if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
    return chainOf(e.expression, depth + 1, seen, out);
  }
  if (ts.isBinaryExpression(e) &&
      (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
       e.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
    return chainOf(e.left, depth + 1, seen, out);
  }
  if (ts.isIdentifier(e)) {
    const b = resolveDecl(e);
    const mark = b ? `decl@${keyspace}${b.key}` : `free:${keyspace}${e.text}`;
    if (seen.has(mark)) return out;
    seen.add(mark);
    if (b?.initializer) return chainOf(b.initializer, depth + 1, seen, out);
    // 🆕 246 — 214 §7.6's FIRST OPTION, TAKEN. Before the terminal is filed, ask whether
    // this file IMPORTS the name: a specifier that resolves to a module in this tree
    // whose export has an initialiser is a chain that continues, not a chain that ends.
    if (!b && hop(e.text, out, depth, seen)) return out;
    out.push({
      terminal: !b ? IMPORTED : b.destructured ? "destructured-binding"
        : b.parameter ? "function-parameter" : "binding-with-no-initialiser",
      text: t,
    });
    return out;
  }
  out.push({ terminal: `unreadable-${ts.SyntaxKind[e.kind]}`, text: t });
  return out;
}

  return { unwrap, chainOf, resolveDecl, rootDeclKey, declaredNames, matchIn };
}

// ════════════════════════════════════════════════════════════════════════════════════
// THE READER — pure over (fileName, sourceText). No filesystem anywhere below this line,
// which is what lets `--selftest` drive every branch from string literals.
// ════════════════════════════════════════════════════════════════════════════════════
export function classify(fileName, text, opts = {}) {
  const sf = sourceFileOf(fileName, text);
  const { chainOf, unwrap, rootDeclKey, resolveDecl } = makeBinder(fileName, sf, opts);
  const claims = analyze(fileName, text);
  const own = (c) => FLOOR_RE.test(c.floorText || c.cond || "");
  const findings = claims.filter((c) => (c.anyEvery || c.anyOffender) && !own(c));

  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // ── the claim's own node ───────────────────────────────────────────────────────────
  // `analyze` records the line of the node it scored; the widest CallExpression starting
  // on that line is that node. Anything not found is RESIDUE, never a silent skip.
  function nodeAt(line) {
    let best = null;
    const visit = (n) => {
      if (ts.isCallExpression(n) && lineOf(n) === line) {
        if (!best || n.getEnd() - n.getStart(sf) > best.getEnd() - best.getStart(sf)) best = n;
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return best;
  }

  // ── the unit, from the OWNER node (214 §5.3) ──────────────────────────────────────
  // The nearest enclosing test()/it()/family(), so the finder and `tautology_gate` cannot
  // disagree about which unit a claim is in.
  function unitOf(node) {
    for (let p = node.parent, hops = 0; p && hops < 80; p = p.parent, hops++) {
      if (ts.isCallExpression(p) && p.arguments.length && ts.isStringLiteralLike(p.arguments[0])) {
        const c = p.expression;
        const n = ts.isIdentifier(c) ? c.text
          : ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) ? c.expression.text : null;
        if (n && TEST_FNS.has(n)) {
          return { start: p.getStart(sf), end: p.getEnd(), name: p.arguments[0].text, line: lineOf(p), kind: "test" };
        }
      }
    }
    return null;
  }
  // 🔴 THE SPAN IS THE ATTRIBUTION'S OWN EXTENT, NOT "OWNER LINE TO NEXT OWNER LINE".
  // 214 §5.3: a section owner can sit BELOW its claims, so `[owner.line, …)` searched the
  // wrong half of the file and produced a clean DEFECT verdict from it. Taking the min/max
  // of every claim the owner actually owns cannot have that failure, because the claim is
  // in the set that defines the span.
  const ownerSpans = new Map();
  for (const c of claims) {
    if (!c.owner) continue;
    const k = `${c.owner.line}::${c.owner.name}`;
    const s = ownerSpans.get(k) ?? { lo: c.owner.line, hi: c.owner.line };
    s.lo = Math.min(s.lo, c.line);
    s.hi = Math.max(s.hi, c.line);
    ownerSpans.set(k, s);
  }
  function bannerUnit(c) {
    const s = ownerSpans.get(`${c.owner.line}::${c.owner.name}`) ?? { lo: c.owner.line, hi: c.owner.line };
    return {
      startLine: s.lo, endLine: s.hi + 1, name: c.owner.name, line: c.owner.line,
      kind: c.owner.section ? "section" : "banner",
    };
  }

  // ── the asserted collection ───────────────────────────────────────────────────────
  function assertedCollection(node) {
    let every = null;
    const visit = (n) => {
      if (every) return;
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(unwrap(n.expression)) &&
          unwrap(n.expression).name.text === "every") { every = unwrap(n.expression).expression; return; }
      ts.forEachChild(n, visit);
    };
    visit(node);
    if (every) return { expr: every, via: ".every() receiver" };

    const args = node.arguments.filter((a) => !ts.isStringLiteralLike(a) && !ts.isTemplateExpression(a));
    const isEmptyArr = (a) => { const u = unwrap(a); return ts.isArrayLiteralExpression(u) && u.elements.length === 0; };
    const ei = args.findIndex(isEmptyArr);
    if (ei >= 0) {
      const other = args.find((a, i) => i !== ei);
      if (other) return { expr: other, via: "compared against []" };
    }
    if (args.length) return { expr: args[0], via: "first non-literal argument" };
    return null;
  }


  // ── the positive control ──────────────────────────────────────────────────────────
  const SIZE_PROPS = /^(length|size|byteLength)$/;
  const WITNESS_METHODS = /^(includes|some|has|find|indexOf)$/;

  function isAssertLike(n) {
    if (!ts.isCallExpression(n)) return false;
    const c = unwrap(n.expression);
    if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === "assert") return true;
    if (ts.isIdentifier(c) && CHECK_FNS.has(c.text)) return true;
    return false;
  }
  const methodOf = (n) => {
    const c = unwrap(n.expression);
    return ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : "";
  };
  const nonZeroLiteral = (e) => {
    const u = unwrap(e);
    return Boolean(u && ts.isNumericLiteral(u) && Number(u.text) !== 0);
  };
  const pinnedRef = (e) => {
    const u = unwrap(e);
    return Boolean(u && (ts.isIdentifier(u) || ts.isPropertyAccessExpression(u)));
  };

  // 🔴 TEXT IS NOT IDENTITY, AND THE MATCH RUNS IN BOTH DIRECTIONS (214 §5.4). Two `wire`s
  // in one test() are two collections, so the match is on (text, declaration) and never on
  // the name alone — and a control on a DERIVED collection proves its SOURCE non-empty, so
  // the control's own chain is what gets intersected with the claim's.
  function sameTarget(expr, targets) {
    const u = unwrap(expr);
    if (!u) return null;
    for (const m of chainOf(u)) {
      if (m.terminal) continue;
      const hit = targets.find((x) => x.text === m.text && x.declKey === m.declKey);
      if (hit) return hit.text;
    }
    return null;
  }
  function sizeTarget(e, targets) {
    const u = unwrap(e);
    if (u && ts.isPropertyAccessExpression(u) && SIZE_PROPS.test(u.name.text)) return sameTarget(u.expression, targets);
    return null;
  }
  function provesNonEmpty(e, targets) {
    const K = ts.SyntaxKind;
    const u = unwrap(e);
    if (!u) return null;
    if (ts.isBinaryExpression(u)) {
      const op = u.operatorToken.kind;
      const lt = sizeTarget(u.left, targets), rt = sizeTarget(u.right, targets);
      const num = (x) => (ts.isNumericLiteral(unwrap(x)) ? Number(unwrap(x).text) : null);
      if (lt) {
        const v = num(u.right);
        if (v !== null) {
          if ((op === K.EqualsEqualsToken || op === K.EqualsEqualsEqualsToken) && v !== 0) return "literal";
          if (op === K.GreaterThanToken && v >= 0) return "literal";
          if (op === K.GreaterThanEqualsToken && v >= 1) return "literal";
          if ((op === K.ExclamationEqualsToken || op === K.ExclamationEqualsEqualsToken) && v === 0) return "literal";
        } else if (pinnedRef(u.right) &&
          (op === K.EqualsEqualsToken || op === K.EqualsEqualsEqualsToken || op === K.GreaterThanEqualsToken)) return "pinned";
      }
      if (rt) {
        const v = num(u.left);
        if (v !== null) {
          if (op === K.LessThanToken && v >= 0) return "literal";
          if (op === K.LessThanEqualsToken && v >= 1) return "literal";
          if ((op === K.EqualsEqualsToken || op === K.EqualsEqualsEqualsToken) && v !== 0) return "literal";
        } else if (pinnedRef(u.left) && (op === K.EqualsEqualsToken || op === K.EqualsEqualsEqualsToken)) return "pinned";
      }
      return null;
    }
    if (ts.isCallExpression(u) && ts.isPropertyAccessExpression(unwrap(u.expression))) {
      const pa = unwrap(u.expression);
      if (WITNESS_METHODS.test(pa.name.text) && sameTarget(pa.expression, targets)) return "literal";
    }
    // A witness is often bound before it is asserted: `const warned = entries.find(…);
    // assert.ok(warned)` proves `entries` is not empty exactly as the inline form would.
    // One hop, and only into a witness call — `assert.ok(handlers.get(t))` must not become
    // a proof that `handlers` is populated, because `get` is not a witness.
    if (ts.isIdentifier(u)) {
      const b = resolveDecl(u);
      const init = b?.initializer ? unwrap(b.initializer) : null;
      if (init && ts.isCallExpression(init) && ts.isPropertyAccessExpression(unwrap(init.expression))) {
        const pa = unwrap(init.expression);
        if (WITNESS_METHODS.test(pa.name.text) && sameTarget(pa.expression, targets)) return "literal";
      }
    }
    if (sizeTarget(u, targets)) return "literal";
    return null;
  }
  function controlIn(node, targets) {
    const m = methodOf(node);
    const args = node.arguments;
    const say = (strength) => ({ line: lineOf(node), text: norm(node.getText(sf)).slice(0, 110), strength });

    if (/^(equal|strictEqual|notEqual|notStrictEqual)$/.test(m) && args.length >= 2) {
      for (let i = 0; i < 2; i++) {
        if (!sizeTarget(args[i], targets)) continue;
        const other = args[1 - i];
        if (/^(equal|strictEqual)$/.test(m)) {
          if (nonZeroLiteral(other)) return say("literal");
          if (pinnedRef(other)) return say("pinned");
        } else if (ts.isNumericLiteral(unwrap(other)) && Number(unwrap(other).text) === 0) return say("literal");
      }
    }
    if (/^(deepEqual|deepStrictEqual)$/.test(m) && args.length >= 2) {
      const a = unwrap(args[0]), b = unwrap(args[1]);
      for (const [x, y] of [[a, b], [b, a]]) {
        if (sameTarget(x, targets) && ts.isArrayLiteralExpression(y) && y.elements.length) return say("literal");
      }
    }
    // The one-argument forms and the probe idiom with them: `assert.ok(cond)`,
    // `claim(cond, msg)` and `check(cond, "MARKER", detail)` are one proposition in three
    // spellings, and reading only `assert.ok` is why every script-shaped unit once came
    // back with no control — those files do not contain the word `assert`.
    if (m === "ok" || CHECK_FNS.has(m)) {
      for (const a of args) {
        if (ts.isStringLiteralLike(a) || ts.isTemplateExpression(a)) continue;
        const s = provesNonEmpty(a, targets);
        if (s) return say(s);
      }
    }
    return null;
  }
  const inSpan = (unit, n) => {
    const s = n.getStart(sf), e = n.getEnd();
    if (unit.start !== undefined) return s >= unit.start && e <= unit.end;
    const l = lineOf(n);
    return l >= unit.startLine && l < unit.endLine;
  };
  function findControl(unit, targets, claimNode) {
    const hits = [];
    const visit = (n) => {
      if (isAssertLike(n) && n !== claimNode && inSpan(unit, n)) {
        const c = controlIn(n, targets);
        if (c) hits.push(c);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    hits.sort((a, b) => (a.strength === b.strength ? a.line - b.line : a.strength === "literal" ? -1 : 1));
    return hits[0] ?? null;
  }

  // ── EVERY WRITE INTO THE COLLECTION, AND WHERE IT HAPPENS ─────────────────────────
  // Both new verdicts turn on the same question — not "what is this collection" but "what
  // fills it" — so both are answered from one walk over its `push` sites.
  function pushSites(declKey) {
    const out = [];
    const visit = (n) => {
      if (ts.isCallExpression(n)) {
        const c = unwrap(n.expression);
        if (ts.isPropertyAccessExpression(c) && /^(push|unshift|add|set)$/.test(c.name.text)) {
          const recv = unwrap(c.expression);
          if (ts.isIdentifier(recv) && (resolveDecl(recv)?.key ?? null) === declKey) out.push(n);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return out;
  }
  const enclosingFn = (n) => {
    for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return p;
    return null;
  };
  // Is `fn` registered as a handler for a process-fault event? Two spellings, and the
  // second is the one the tree actually uses: the callback is bound to a name first and
  // that NAME is passed to `process.on`, because the same reference has to be removable in
  // the `finally`. A reader that saw only the inline form would call every real trap a
  // defect and would look right doing it.
  function isTrapListener(fn) {
    const direct = fn.parent;
    const registers = (call, matchesArg) => {
      if (!ts.isCallExpression(call)) return false;
      const c = unwrap(call.expression);
      if (!ts.isPropertyAccessExpression(c) || !LISTENER_FNS.test(c.name.text)) return false;
      const ev = call.arguments[0];
      if (!ev || !ts.isStringLiteralLike(ev) || !TRAP_EVENTS.test(ev.text)) return false;
      return matchesArg(call);
    };
    if (registers(direct, (call) => call.arguments.some((a) => unwrap(a) === fn))) return true;
    // bound-to-a-name form
    let named = null;
    if (ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) named = fn.parent.name.text;
    if (!named) return false;
    let found = false;
    const visit = (n) => {
      if (found) return;
      if (registers(n, (call) => call.arguments.some((a) => {
        const u = unwrap(a);
        return ts.isIdentifier(u) && u.text === named;
      }))) { found = true; return; }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return found;
  }
  // The companion floor a trap's exemption is bought with: an assertion, inside the same
  // unit, that some OTHER binding is non-empty — `events.length === 1` proving the failure
  // path actually ran. Without it the two empty arrays are a silence nobody reached, and
  // that is a defect with its own name rather than an exemption.
  function companionFloor(unit, declKey, claimNode) {
    let hit = null;
    const visit = (n) => {
      if (hit) return;
      if (isAssertLike(n) && n !== claimNode && inSpan(unit, n)) {
        for (const a of n.arguments) {
          const u = unwrap(a);
          if (!u) continue;
          const cand = ts.isPropertyAccessExpression(u) && SIZE_PROPS.test(u.name.text) ? u.expression
            : ts.isBinaryExpression(u) && ts.isPropertyAccessExpression(unwrap(u.left)) &&
              SIZE_PROPS.test(unwrap(u.left).name.text) ? unwrap(u.left).expression : null;
          if (!cand || !ts.isIdentifier(cand)) continue;
          const k = resolveDecl(cand)?.key ?? null;
          if (k === null || k === declKey) continue;
          const other = [{ text: norm(cand.getText(sf)), declKey: k }];
          const c = controlIn(n, other);
          if (c) { hit = { ...c, binding: norm(cand.getText(sf)) }; return; }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return hit;
  }
  // The population an accumulator drains. `for (const c of calls) { bad.push(c.name) }`
  // makes `calls` the thing that can go vacuous — the accumulator itself cannot carry a
  // control, because filling it means the bug the test denies actually happened.
  function accumulatedFrom(pushNode) {
    for (let p = pushNode.parent; p; p = p.parent) {
      if (ts.isForOfStatement(p) || ts.isForInStatement(p)) return p.expression;
      if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(unwrap(p.expression))) {
        const pa = unwrap(p.expression);
        if (/^(forEach|map|filter|flatMap|some|every|reduce)$/.test(pa.name.text)) return pa.expression;
      }
      if (ts.isFunctionLike(p) && p.parent && ts.isVariableDeclaration(p.parent)) break;
    }
    return null;
  }

  // ── run ───────────────────────────────────────────────────────────────────────────
  const rows = [];
  for (const c of findings) {
    const row = { file: fileName, line: c.line, unit: null, claim: null };
    const node = nodeAt(c.line);
    if (!node) { rows.push({ ...row, verdict: RESIDUE, why: "no CallExpression starts on the claim's own line" }); continue; }
    row.claim = norm(node.getText(sf));

    const a = assertedCollection(node);
    if (!a) { rows.push({ ...row, verdict: RESIDUE, why: "the claim has no non-literal argument to read a collection from" }); continue; }

    const chain = chainOf(a.expr);
    // 🔴 A TARGET MUST BE ROOTED IN A BINDING (214 §5.4). A collector's chain ends in the
    // literal `[]`, and so does every OTHER collector's in the same unit — so matching on
    // text alone reported two process traps as defended on the strength of a shared `[]`.
    const targets = chain.filter((x) => !x.terminal && x.declKey !== null).map((x) => ({ text: x.text, declKey: x.declKey }));
    if (!targets.length) {
      rows.push({ ...row, verdict: RESIDUE, why: `chain resolved to nothing readable: ${chain.map((x) => x.terminal).join(", ")}` });
      continue;
    }
    const terminal = chain.find((x) => x.terminal)?.terminal ?? "none";
    const chainText = chain.map((x) => x.terminal ? `<${x.terminal}>` : x.text.slice(0, 44)).join("  ←  ");

    if (terminal === NONEMPTY_LITERAL || terminal === NONEMPTY_OBJECT) {
      // 🆕 246 — THE ORIGIN IS PART OF THE VERDICT. Before the hop, a literal terminal was
      // always in the file under the claim and "where" was not a question. It is now, and
      // a defence that cannot name the file it crossed into is one no reviewer can check.
      const where = chain.find((x) => x.terminal)?.origin;
      const kind = terminal === NONEMPTY_OBJECT ? "object" : "array";
      rows.push({ ...row, verdict: DEFENDED, terminal, chain: chainText, strength: "literal",
        why: `the collection is derived from a non-empty ${kind} literal`
          + (where && where !== fileName ? ` at ${where}` : "") });
      continue;
    }
    let unit = unitOf(node);
    if (!unit) {
      if (!c.owner) { rows.push({ ...row, verdict: RESIDUE, why: "no enclosing test() and no owner — module scope, unattributed" }); continue; }
      unit = bannerUnit(c);
    }
    row.unit = String(unit.name);

    const ctl = findControl(unit, targets, node);
    if (ctl) {
      rows.push({ ...row, verdict: DEFENDED, terminal, chain: chainText, strength: ctl.strength, why: `:${ctl.line} ${ctl.text}` });
      continue;
    }

    // The collector's own declaration — the one both new verdicts are asked about.
    const declKey = targets[0].declKey;
    const writes = typeof declKey === "number" ? pushSites(declKey) : [];

    if (writes.length && writes.every((w) => { const fn = enclosingFn(w); return fn && isTrapListener(fn); })) {
      const floor = companionFloor(unit, declKey, node);
      if (floor) {
        rows.push({ ...row, verdict: EXEMPT_TRAP, terminal, chain: chainText, strength: floor.strength,
          why: `every write is inside a process-fault listener; floored on \`${floor.binding}\` at :${floor.line}` });
      } else {
        rows.push({ ...row, verdict: DEFECT, terminal, chain: chainText, trapUnfloored: true,
          why: "a process trap with NO companion floor — the empty array is a silence nobody proved was reached" });
      }
      continue;
    }

    const sources = writes.map(accumulatedFrom).filter(Boolean);
    let floored = null;
    for (const s of sources) {
      const st = chainOf(s).filter((x) => !x.terminal && x.declKey !== null).map((x) => ({ text: x.text, declKey: x.declKey }));
      if (!st.length) continue;
      const f = findControl(unit, st, node);
      if (f) { floored = { ...f, source: norm(s.getText(sf)).slice(0, 48) }; break; }
    }
    if (floored) {
      rows.push({ ...row, verdict: POPULATION_FLOORED, terminal, chain: chainText, strength: floored.strength,
        why: `an accumulator over \`${floored.source}\`, whose population is floored at :${floored.line}` });
      continue;
    }
    rows.push({ ...row, verdict: DEFECT, terminal, chain: chainText, why: "no positive control in the unit" });
  }
  return rows;
}

// ════════════════════════════════════════════════════════════════════════════════════
// THE ACCEPTANCE FIXTURE — CONTENT-ADDRESSED (215 §7.5)
// ════════════════════════════════════════════════════════════════════════════════════
// 🔴 NOT LINE NUMBERS, AND 215 §4 IS THE PROOF IT MUST NOT BE. The probe's nine hardcoded
// `file:line` paths read 1/8 after one session of edits: four line drifts, two intended
// flips, and no way to tell those apart from a regression. A member here is (file, unit
// name, the claim's own text) — the three things that stay true while a file is edited
// around them, and that stop being true exactly when the claim itself changes.
//
// Every member's expected verdict was READ from the source, not copied from a run.
export const ACCEPTANCE = [
  // ── 213 §3's boundary pair: same spelling, same-named binding, opposite answers ───
  // The half that must NOT flag. `assert.equal(wire.length, 1)` sits four lines below it,
  // and a FILE-wide search (212's reading) or a CLAIM-scoped one (211's) gets this pair
  // wrong in opposite directions. Only the test BLOCK separates them.
  { file: "test/plane_path_guards.test.ts", verdict: DEFENDED,
    claim: /^assert\.deepEqual\(wire, \[\], "neither call may reach the adapter"\)$/,
    why: "213 §3's must-not-flag — the unit shows this `wire` CAN fill, four lines down" },
  // The half that DID flag, until 215 §4 class A gave every plane a legal in-root path.
  // 🔴 A FLIP AND A DRIFT ARE INDISTINGUISHABLE IN A LINE-NUMBERED FIXTURE, which is the
  // entire reason this list is addressed by content.
  { file: "test/plane_path_guards.test.ts", verdict: DEFENDED,
    claim: /^assert\.deepEqual\(wire, \[\], "no escaping path may reach any transport"\)$/,
    why: "215 §4 class A — one legal in-root path per plane, and PLANE_ROWS pins the table" },
  // 214 §5.4's declaration-identity case: TWO `wire`s in one test(), the control on the
  // second. A name-and-unit match calls this defended for the wrong reason; only the
  // declaration separates them, and 215 moved the legal restart INSIDE the loop so it does.
  { file: "test/dbg_scene_guard.test.ts", verdict: DEFENDED,
    claim: /^assert\.deepEqual\(wire, \[\], `dbg_restart: \$\{label\} must never reach the adapter`\)$/,
    why: "the counter-example 213's rule was one level too coarse for, closed at 215" },
  // ── 215 §4 class B — the process traps ───────────────────────────────────────────
  { file: "test/dap.test.ts", verdict: EXEMPT_TRAP,
    claim: /assert\.deepEqual\(unhandled, \[\], "a rejected attach must not produce an unhandled rejection"\)/,
    why: "fills only when Node is about to die; floored on `events.length === 1`" },
  { file: "test/dap.test.ts", verdict: EXEMPT_TRAP,
    claim: /assert\.deepEqual\(uncaught, \[\], "…nor an uncaught exception from an unlistened 'error' emit"\)/,
    why: "same trap, same unit, same companion floor" },
  { file: "test/csdap.test.ts", verdict: EXEMPT_TRAP,
    claim: /assert\.deepEqual\(uncaught, \[\], "the rejection must not surface as an unlistened 'error' emit"\)/,
    why: "the C# mirror; 215 gave it the `announced.length === 1` floor dap already had" },
  // ── 215 §4 class C — the contradiction detectors ─────────────────────────────────
  { file: "test/annotations.test.ts", verdict: POPULATION_FLOORED,
    claim: /assert\.deepEqual\(contradictory, \[\]/,
    why: "an intersection over `calls`; the population and each half are floored separately" },
  { file: "test/annotations.test.ts", verdict: POPULATION_FLOORED,
    claim: /assert\.deepEqual\(egressing, \[\]/,
    why: "same accumulator shape; openWorldHint deliberately gets no half-floor of its own" },
  { file: "test/annotations.test.ts", verdict: POPULATION_FLOORED,
    claim: /assert\.deepEqual\(bad, \[\], `tools marked read-only but confirmation-gated/,
    why: "the third of class C, floored on `calls.length` and on both halves" },
  // ── and the ones that are still, honestly, defects ───────────────────────────────
  // 🔴 PINNED AS DEFECTS ON PURPOSE. A fixture that lists only the answers it likes is a
  // fixture that cannot tell a fix from a finder that stopped looking: if one of these
  // silently becomes `defended`, something either fixed it or broke the reader, and both
  // are events somebody has to look at.
  { file: "test/dbg_scene_guard.test.ts", verdict: DEFECT,
    claim: /^assert\.deepEqual\(wire, \[\], `\$\{label\}: must never reach the adapter`\)$/,
    why: "213 §3's named collector; the unit still never shows this `wire` can fill" },
  { file: "test/dbg_scene_guard.test.ts", verdict: DEFECT,
    claim: /^assert\.deepEqual\(wire, \[\]\)$/,
    why: "the port-check ordering test — the bare form, and it carries no message either" },
  { file: "test/dap.test.ts", verdict: DEFECT,
    claim: /assert\.deepEqual\(received, \[\]/,
    why: "a destructured binding with no control — the honest remainder" },
];

export function acceptance(rows, fixture = ACCEPTANCE) {
  const out = [];
  for (const m of fixture) {
    const hits = rows.filter((r) => r.file === m.file && m.claim.test(r.claim ?? ""));
    if (!hits.length) { out.push({ ...m, got: null, ok: false, code: PC_ACCEPTANCE_MISSING }); continue; }
    for (const h of hits) {
      out.push({ ...m, got: h.verdict, line: h.line, ok: h.verdict === m.verdict, code: h.verdict === m.verdict ? PC_OK : PC_ACCEPTANCE });
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════
// THE JUDGE — pure over the rows, so the self-test can hand it populations the healthy
// tree cannot produce (174 §8: a collector only ever asserted empty loses its filter
// invisibly).
// ════════════════════════════════════════════════════════════════════════════════════
export function judge(rows, files, fixture = ACCEPTANCE, floors = {}) {
  const {
    claimFloor = CLAIM_FLOOR, fileFloor = FILE_FLOOR,
    defectCeiling = DEFECT_CEILING, residueCeiling = RESIDUE_CEILING,
  } = floors;
  const lines = [];
  const codes = [];
  const say = (l) => lines.push(l);
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  const defects = rows.filter((r) => r.verdict === DEFECT);
  const traps = defects.filter((r) => r.trapUnfloored);

  say(`POSITIVE_CONTROL ${rows.length} claim(s) over ${files} file(s) — `
    + `defended ${count(DEFENDED)} · exempt-trap ${count(EXEMPT_TRAP)} · `
    + `population-floored ${count(POPULATION_FLOORED)} · defect ${defects.length} · residue ${count(RESIDUE)}`);

  if (rows.length < claimFloor) {
    codes.push(PC_POPULATION);
    say(`🔴 ${PC_POPULATION} ${rows.length} < ${claimFloor} — the finder went blind. A gate scored`);
    say(`   over an empty population reports no defects and passes (170 §4).`);
  }
  if (files < fileFloor) {
    codes.push(PC_FILES);
    say(`🔴 ${PC_FILES} ${files} < ${fileFloor} — the directory walk stopped reading files. Claim`);
    say(`   sites alone cannot see this: the remaining files' headroom absorbs the loss (183).`);
  }
  for (const t of traps) {
    codes.push(PC_TRAP_UNFLOORED);
    say(`🔴 ${PC_TRAP_UNFLOORED} ${t.file}:${t.line} — ${t.why}`);
    say(`   A trap is exempt because a COMPANION binding proves the fault path ran. Without`);
    say(`   one the exemption is the claim it was supposed to earn.`);
  }
  if (defects.length > defectCeiling) {
    codes.push(PC_UNDEFENDED_EXCESS);
    say(`🔴 ${PC_UNDEFENDED_EXCESS} ${defects.length} > ${defectCeiling} — a collection arrived whose unit`);
    say(`   never shows it can be non-empty. Give it a control, or classify it honestly.`);
  }
  if (count(RESIDUE) > residueCeiling) {
    codes.push(PC_UNREADABLE_EXCESS);
    say(`🔴 ${PC_UNREADABLE_EXCESS} ${count(RESIDUE)} > ${residueCeiling} — this reader stopped being able to`);
    say(`   read claims it used to. Residue is reported, not folded into either answer.`);
  }
  const acc = acceptance(rows, fixture);
  const bad = acc.filter((a) => !a.ok);
  say(`ACCEPTANCE ${acc.length - bad.length}/${acc.length} content-addressed member(s) hold`);
  for (const a of bad) {
    codes.push(a.code);
    say(a.got === null
      ? `🔴 ${PC_ACCEPTANCE_MISSING} ${a.file} — no claim matches ${a.claim}. The SITE is gone, which is`
      : `🔴 ${PC_ACCEPTANCE} ${a.file}:${a.line} expected ${a.verdict}, got ${a.got} — ${a.why}`);
    if (a.got === null) say(`   a different event from a verdict changing and must not read as one.`);
  }
  const failed = codes.length > 0;
  if (!failed) {
    say(`POSITIVE_CONTROL_GATE ok — every collection is defended, exempt with a companion floor,`);
    say(`   floored on its population, or one of the ${defects.length} named defects at the ceiling`);
  }
  return { lines, failed, codes };
}

// ── 🆕 287 — `shape-before-field-uncounted` (285), AND THE POPULATION IT NEVER HAD ───
//
// 🔴 275 SHIPPED *ASSERT THE SHAPE BEFORE READING THE FIELD* AT THE ONE SITE ITS FLAKE
// HAPPENED. `godot_run_project` handed back a result with no `structuredContent`, the
// next line read a field off the cast, and the failure arrived as `Cannot read properties
// of undefined (reading 'bridge_ready')` — a TypeError one line after the defect,
// carrying none of its own diagnosis. The rule was written down and the population it
// belongs to was never derived, which is 282 §2.3's standing rule: a guarantee is false
// until something derives its population.
//
// 🔴 AND TWO SESSIONS COUNTED IT BY HAND AND DISAGREED WITH THEMSELVES. 285 §6.1 counted
// 98 SITES from two greps; §9.3 then said two helper edits "closed 32 of the 98" — but a
// call site behind a guarded helper carries no cast, so those 32 left the population by
// being COLLAPSED INTO ONE guarded cast rather than guarded one at a time. 286 §5
// re-derived it from the AST and found the unit was the CAST: 103 casts, 101 of them
// dereferenced, spelled 67 bound-const · 31 inline · 3 helper. This reader is that
// derivation, committed — because a number two sessions produced by hand and a third
// re-produced by hand is still a number nothing re-takes.
//
// 🔴 A CEILING ON THE UNGUARDED AND A FLOOR UNDER THE POPULATION, WHICH ARE TWO
// DIFFERENT FAILURES. The ceiling stops a new unguarded cast arriving. The floor stops
// this reader quietly ceasing to match — `.structuredContent as T` is a syntactic shape,
// and a test file that switched to a typed envelope would empty the population and print
// a clean green over nothing, which is `PC_POPULATION`'s own argument one axis over.
export const PC_SHAPE_POPULATION = "PC_SHAPE_POPULATION";
export const PC_SHAPE_UNGUARDED = "PC_SHAPE_UNGUARDED";
// Measured 103 casts across the four floored directories; set below it so ordinary
// editing has room and a collapse has none.
export const SHAPE_POPULATION_FLOOR = 80;
// 🔴 ZERO, AND IT IS THE LIVE VALUE — which is the only reason a ceiling may be zero.
// 286 §5 measured 99 unguarded and priced the sweep; 287 ran it from this reader and the
// remainder is nothing. A ceiling pinned above a population that has been driven to zero
// is headroom nobody voted for (246's rule on `DEFECT_CEILING`), so it moves in the
// commit that empties it.
export const SHAPE_UNGUARDED_CEILING = 0;

const SHAPE_ASSERT_RE = /^(assert|assert\.\w+|ok|equal|deepEqual|match)$/;

function shapeEnclosingFn(n) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) ||
        ts.isArrowFunction(p) || ts.isMethodDeclaration(p)) return p;
  }
  return null;
}

/** Every `X.structuredContent as T` in one file, classified — 🆕 287.
 *
 * 🔴 THE UNIT IS THE CAST, NOT THE READ, AND 285's ROW USED BOTH. A call site behind a
 * guarded helper reads a field off a value that was cast ONCE, somewhere else, with a
 * guard in front of it; counting those sites again is counting the same cast as many
 * times as it is used. `deref` is reported beside the count rather than folded into it,
 * because a cast nothing reads a field off is genuinely out of this rule's scope (285
 * §6.1) and saying so is not the same as not seeing it.
 *
 * 🔴 A GUARD IS AN EXISTENCE TEST ON THE SAME SUBJECT, AND NOTHING ELSE COUNTS. The
 * first draft credited any earlier `assert` whose text mentioned `structuredContent`,
 * which read `assert.equal((a.structuredContent as {c: number}).c, 1)` — itself a member
 * of this population — as a guard for the NEXT cast in the same test, on a different
 * object. That is a reader satisfied by the defect it is looking for, and it scored 32
 * guarded where the honest answer was 7.
 */
export function shapeSites(rel, text) {
  const sf = sourceFileOf(rel, text);
  const txt = (n) => n.getText(sf);
  const out = [];
  const walk = (n) => {
    if (ts.isAsExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === "structuredContent") {
      const subject = txt(n.expression.expression);
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const par = n.parent;
      const fn = shapeEnclosingFn(n);
      let spelling = "other";
      let deref = false;
      // 🔴 AN OPTIONAL-CHAINED READ CANNOT THROW, SO IT IS NOT WHAT THIS RULE IS ABOUT,
      // AND THE SWEEP IS WHAT PROVED IT. `csdap.test.ts` asserts that a launch the
      // adapter REJECTED does not report `state: "running"`, and it is written
      // `(res.structuredContent as { state?: string } | undefined)?.state` — the absent
      // envelope is the EXPECTED answer there, and `undefined !== "running"` is the
      // assertion passing for the right reason. Guarding it turned a passing claim into
      // a thrown precondition, and the suite said so within the minute. 275's defect is
      // a TypeError carrying no diagnosis; `?.` produces a value, and the claim that
      // reads it fails honestly with its own message.
      let optional = false;
      const accessOf = (x) =>
        (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) ? x : null;
      const acc = accessOf(par) ||
        (ts.isParenthesizedExpression(par) ? accessOf(par.parent) : null);
      if (acc && acc.questionDotToken) optional = true;
      if (ts.isPropertyAccessExpression(par) || ts.isElementAccessExpression(par)) {
        spelling = "inline"; deref = true;
      } else if (ts.isParenthesizedExpression(par) &&
                 (ts.isPropertyAccessExpression(par.parent) ||
                  ts.isElementAccessExpression(par.parent))) {
        spelling = "inline"; deref = true;
      } else if (ts.isVariableDeclaration(par) && ts.isIdentifier(par.name)) {
        spelling = "bound-const";
        const name = par.name.text;
        const scope = shapeEnclosingFn(par) || sf;
        const seek = (m) => {
          if ((ts.isPropertyAccessExpression(m) || ts.isElementAccessExpression(m)) &&
              ts.isIdentifier(m.expression) && m.expression.text === name) deref = true;
          ts.forEachChild(m, seek);
        };
        ts.forEachChild(scope, seek);
      }
      if (ts.isReturnStatement(par) || (fn && ts.isArrowFunction(fn) && fn.body === n)) {
        spelling = "helper"; deref = true;
      }
      let guarded = optional;
      if (!guarded && fn && fn.body) {
        const want = `${subject}.structuredContent`.replace(/\s+/g, "");
        const isExistenceTest = (m) => {
          const t = txt(m).replace(/\s+/g, "");
          return t === want || t === `!${want}`;
        };
        const before = [];
        const collect = (m) => {
          if (m.getStart(sf) < n.getStart(sf)) before.push(m);
          ts.forEachChild(m, collect);
        };
        ts.forEachChild(fn.body, collect);
        for (const m of before) {
          if (ts.isIfStatement(m) && isExistenceTest(m.expression) &&
              /throw|return/.test(txt(m.thenStatement))) { guarded = true; break; }
          if (ts.isCallExpression(m) && SHAPE_ASSERT_RE.test(txt(m.expression)) &&
              m.arguments.length && isExistenceTest(m.arguments[0])) { guarded = true; break; }
        }
      }
      if (optional) spelling = "optional-chained";
      out.push({ file: rel, line, spelling, deref, guarded, subject, cast: true,
                 type: txt(n.type), start: n.getStart(sf), end: n.getEnd() });
    }
    // 🔴 AND THE CALL SITES OF THE GUARDED HELPER ARE IN THE POPULATION, WHICH IS THE
    // HALF THE FIRST DRAFT GOT WRONG AND THE SWEEP PROVED WITHIN THE MINUTE. Floored on
    // CASTS alone, this reader went from 103 to 9 the moment the sweep replaced them —
    // a collapse indistinguishable from the reader ceasing to match, printed by the very
    // floor written to catch that. The population is every READ of `structuredContent`:
    // each is either a raw cast, guarded or not, or a call to the helper that casts once
    // behind a precondition. 285's row confused these two units in one sentence (§6.1's
    // 98 sites against §9.3's "closed 32 of them"); this is the unit that survives the
    // repair.
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
        n.expression.text === "structured") {
      out.push({ file: rel, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
                 spelling: "guarded-helper-call", deref: true, guarded: true, cast: false,
                 subject: n.arguments.length ? txt(n.arguments[0]) : "",
                 type: n.typeArguments?.length ? txt(n.typeArguments[0]) : "",
                 start: n.getStart(sf), end: n.getEnd() });
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

export function judgeShape(sites, {
  populationFloor = SHAPE_POPULATION_FLOOR,
  unguardedCeiling = SHAPE_UNGUARDED_CEILING } = {}) {
  const lines = [];
  const codes = [];
  const say = (l) => lines.push(l);
  const reads = sites.filter((s) => s.deref);
  const casts = sites.filter((s) => s.cast);
  const viaHelper = sites.filter((s) => !s.cast);
  const unguarded = reads.filter((s) => !s.guarded);
  const spell = (rows) => ["bound-const", "inline", "helper", "optional-chained",
                           "guarded-helper-call", "other"]
    .map((k) => [k, rows.filter((r) => r.spelling === k).length])
    .filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(" \u00b7 ");
  say(`SHAPE_BEFORE_FIELD ${reads.length} read(s) of structuredContent \u00b7 ` +
      `${casts.length} raw cast(s) \u00b7 ${viaHelper.length} through the guarded helper \u00b7 ` +
      `${unguarded.length} unguarded \u00b7 ceiling ${unguardedCeiling} \u00b7 floor ${populationFloor}`);
  say(`   by spelling: ${spell(reads) || "(none)"}`);
  if (reads.length < populationFloor) {
    codes.push(PC_SHAPE_POPULATION);
    say(`\ud83d\udd34 ${PC_SHAPE_POPULATION} ${reads.length} < ${populationFloor} — this reader stopped`);
    say(`   matching. Both halves are syntactic — \`.structuredContent as T\` and a call to`);
    say(`   \`structured<T>()\` — and a population that collapsed prints a clean green over`);
    say(`   nothing, which is what a ceiling of ${unguardedCeiling} would then be measuring.`);
  }
  if (unguarded.length > unguardedCeiling) {
    codes.push(PC_SHAPE_UNGUARDED);
    say(`\ud83d\udd34 ${PC_SHAPE_UNGUARDED} ${unguarded.length} > ${unguardedCeiling} — a field is read off a`);
    say(`   cast \`structuredContent\` with nothing asserting it is there. 275's TypeError`);
    say(`   arrives one line later carrying none of its own diagnosis. Use the guarded`);
    say(`   \`structured<T>(r)\` helper, or assert the shape on the same subject first.`);
    for (const s of unguarded.slice(0, 20)) say(`   ${s.file}:${s.line}  ${s.spelling}`);
  }
  return { lines, codes };
}

export function shapeScan(root = ROOT) {
  const sites = [];
  for (const dir of Object.keys(FLOORS)) {
    const d = join(root, dir);
    for (const f of readdirSync(d)
      .filter((f) => /\.(mjs|ts)$/.test(f) && statSync(join(d, f)).isFile()).sort()) {
      const rel = dir === "." ? f : `${dir}/${f}`;
      sites.push(...shapeSites(rel, readFileSync(join(d, f), "utf8")));
    }
  }
  return sites;
}

// ── the real tree ───────────────────────────────────────────────────────────────────
export function scan(root = ROOT) {
  const rows = [];
  let files = 0;
  for (const dir of Object.keys(FLOORS)) {
    const d = join(root, dir);
    for (const f of readdirSync(d).filter((f) => /\.(mjs|ts)$/.test(f) && statSync(join(d, f)).isFile()).sort()) {
      const p = join(d, f);
      const rel = dir === "." ? f : `${dir}/${f}`;
      const got = classify(rel, readFileSync(p, "utf8"));
      files++;
      rows.push(...got);
    }
  }
  return { rows, files };
}

export function main() {
  const { rows, files } = scan();
  const r = judge(rows, files);
  for (const l of r.lines) console.log(l);
  // 🆕 287 — `shape-before-field-uncounted` (285), in the gate that already reads
  // TypeScript through the compiler API. Its codes join this gate's, so the population
  // collapsing and an unguarded cast arriving are both this gate's exit code.
  const shape = judgeShape(shapeScan());
  for (const l of shape.lines) console.log(l);
  r.codes.push(...shape.codes);
  r.failed = r.failed || shape.codes.length > 0;
  for (const v of [EXEMPT_TRAP, POPULATION_FLOORED, DEFECT]) {
    const g = rows.filter((x) => x.verdict === v);
    if (!g.length) continue;
    console.log(`\n-- ${v.toUpperCase()} ${g.length}`);
    for (const x of g) console.log(`   ${x.file}:${x.line}  ${x.why}`);
  }
  const res = rows.filter((x) => x.verdict === RESIDUE);
  if (res.length) {
    console.log(`\n-- 🔴 RESIDUE ${res.length} — this reader could not read these`);
    for (const x of res) console.log(`   ${x.file}:${x.line}  ${x.why}`);
  }
  if (r.failed) process.exit(1);
}

if (process.argv[1]?.endsWith("positive_control_gate.mjs")) main();
