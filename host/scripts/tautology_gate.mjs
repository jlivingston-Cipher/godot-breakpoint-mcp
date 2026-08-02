#!/usr/bin/env node
// tautology_gate.mjs — session 171.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// WHAT THIS DEFENDS, AND WHY IT EXISTS AT ALL
//
// 168 §4 named the class: an assertion whose condition is TRUE OF EVERY REPLY THE TOOL
// CAN PRODUCE. 169 built `taut169.mjs` to enumerate it mechanically and swept the probe
// suite. It also reported ZERO candidates against the 47-file host UNIT suite, and 170
// §10 item 2 handed that number over unresolved: "either good news or the classifier not
// understanding node:test assertions. Nobody has checked which."
//
// 🔴 IT WAS THE CLASSIFIER, AND TOTALLY. taut169's claim finder requires the callee to be
// a BARE IDENTIFIER (`pass(…)`, `check(…)`, the probe idiom). Every host unit assertion
// is `assert.equal(…)` — a PropertyAccessExpression. It found zero CLAIM SITES, not zero
// candidates: its 324 were 100% from `test-integration`, and 2175 unit assertions plus
// 422 bare `node:assert` calls inside the probes themselves were never examined.
//
// 🔴 AND ITS OWN SCOPE LINE COULD NOT SEE THAT. `TAUT169_SCOPE claim_sites=324 across 68
// files` aggregated both directories, so a total collapse in one hid behind a healthy
// number from the other. 168 §6 built that line to catch exactly this failure. It is
// 170 §4's VACUOUS one level up — a reassuring sentence that survives the deletion of
// everything beneath it — which is why SCOPE HERE IS PER DIRECTORY, WITH A LITERAL
// FLOOR, and a collapse is a hard failure rather than a quiet zero.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// THE UNIT OF JUDGEMENT IS THE TEST BLOCK, NOT THE ASSERTION
//
// `assert.ok(!r.isError)` is shape-only by 168 §4's definition and there are forty of
// them — each a PRECONDITION guarding real value assertions below it. Failing those is
// 170 §4's "a gate that cries wolf on green is a gate that gets deleted". What is
// actually wrong is a test() block in which EVERY assertion is shape-only: a case that
// passes whatever the code answers. That is 170's VACUOUS gate ported from probe
// families to test cases — the symmetry 170 §10.2 itself pointed at.
//
// THE THREE THINGS THAT FAIL THIS GATE
//   VACUOUS   a test block whose every assertion is satisfied by a wrong answer of the
//             right type                                    (recipes.test.ts, 171 D3)
//   EVERY     `.every(pred)` with no length floor — true of the empty collection
//   OFFENDER  `deepEqual(offenders, [])` where nothing in the FILE floors the
//             population that was filtered  (dbg_scene_guard.test.ts's REFUSED, 171 D1)
//   SCOPE     any directory whose claim-site count falls under its literal floor
//
// Every judgement below is checked by `tautology_gate.selftest.mjs`, which runs in the
// same required `ci` job — 169 §2 and 170 §5's rule: check the instrument before
// believing it. It is not a `node:test` file on purpose: `.ts` under `host/test` would
// move the 681 and drag `contract_check.py` check 11c in, for a file that needs no
// compile step and belongs beside the thing it checks (170 §5, carried).
import ts from "../node_modules/typescript/lib/typescript.js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname — the repo lives under "Godot MCP" and .pathname keeps
// the %20. A path wrong only when it contains a space works here and dies in CI.
const ROOT = fileURLToPath(new URL("../", import.meta.url));

// 🔴 FLOORS ARE >=, NOT EXACT, AND THAT IS DELIBERATE. 170 set its runtime probe floors
// EXACT because those populations are fixed and identical in four environments. This
// population is a unit suite that is SUPPOSED to grow; an exact floor would go red on
// every legitimate test added, and a gate that goes red on good work gets deleted. What
// must never happen is a COLLAPSE, so the floor is a collapse detector.
const FLOORS = { test: 2100, "test-integration": 700 };

// 🔴 EVERY FILE IS A POPULATION (172). 171 §10.22 wrote the rule after watching a total
// collapse in one directory hide behind a healthy number from the other: "any scope
// assertion over more than one population needs one number per population." A DIRECTORY
// is not the smallest population it aggregates — a FILE is. Measured before this line
// existed: `TAUT_SCOPE test-integration files=21 claim_sites=422 floor=400 ok` was
// printed while NINE of those twenty-one files contributed ZERO, including the largest
// probe in the tree. The floor could not see it for exactly the reason 171's could not
// see the unit suite. A file at zero is now a hard failure unless it is on this roster,
// with the reason it has nothing to count.
// 🔴 EXEMPT WITH A STATED REASON, THE WAY EVERY OTHER ROSTER IN THIS REPO IS
// (SHAPE_COVERAGE_EXEMPT, BRIDGE_SCAN_EXEMPT, FAMILY_COUNT_EXEMPT). A file that is
// SUPPOSED to have no claims is a decision somebody made; a file that has stopped
// having them is a defect. The only difference between the two is whether the reason
// is written down, which is what this roster is for. Each quotes the file's own header.
export const NO_CLAIMS_EXPECTED = {
  "csharp-lsp.integration.mjs": "documented LOG-ONLY diagnostic — its only gate is reachability (170, measured)",
  "csharp-dap.integration.mjs": "documented LOG-ONLY diagnostic — its only gate is reachability (170, measured)",
  "editor-lsp.integration.mjs": 'best-effort probe bank, its own header: "probe failures are never fatal — only an unreachable language server fails the job"',
  "editor-subscriptions.integration.mjs": 'event-push probe, its own header: "The reachability check is the gate (exit 1 if the addon is unreachable)"',
};

const SHAPE_TYPEOF = new Set(["boolean", "number", "string", "object", "function", "undefined", "bigint", "symbol"]);
// 🔴 `.includes(x)` AND `.some(p)` FLOOR A COLLECTION AS SURELY AS `.length > 0` DOES —
// a collection that contains something is not empty. Added in 172 after the extended
// finder reported `AUTH_SCENE_DEPENDENCIES` and `AUTH_NESTED_PATH_LEGAL`, both of which
// floor themselves this way, as unfloored `.every()`s. Same lesson as 171 §3's inline
// floor: the best version of the fix must not be what the gate reports.
const FLOOR_RE = /\.length|\.size|\bcount\b|\.byteLength|\.includes\s*\(|\.some\s*\(/;
const DERIVING = /\.(filter|map|flatMap|flat|reduce|concat|entries|keys|values|from)\s*\(|\bObject\.(keys|values|entries)\b/;
// `family` is `_population.mjs`'s block form and `authoring-plane`'s own — the probe
// equivalent of `test()`, and the unit its manifest is keyed on.
const TEST_FNS = new Set(["test", "it", "family"]);
const NOT_A_CLAIM = new Set(["fail"]);
const CONTROL = new Set(["throws", "rejects", "doesNotThrow", "doesNotReject"]);

// ── THE PROBE IDIOM (172) ───────────────────────────────────────────────────────────
// 🔴 171 REPLACED taut169's CLAIM FINDER RATHER THAN EXTENDING IT, AND NOBODY MEASURED
// WHAT FELL OUT. taut169 recognised bare-identifier callees (`check`, `pass`, `fail`);
// 171 recognised `assert.*`, fixed 2175 unseen unit assertions, and in the same move
// stopped seeing 303 probe claims — 209 of them in `authoring-plane`, the largest probe
// in the tree. Its `TAUT_SCOPE test-integration 422/400 ok` covered none of them.
// A finder swapped for its mirror image is still a finder that matches nothing here.
//
// The two shapes, read out of the sources rather than guessed:
//   check(cond, marker, detail)         lsp-plane, cs-lsp-plane, gdscript-dap-plane
//   cond ? pass(M, d) : fail(M, d)      authoring-plane, tabletop-plane
// 🔴 IN THE TERNARY THE CLAIM IS THE CONDITION, NOT THE CALL. taut169 pointed at the
// `pass(...)` site, where the only thing to classify is a marker string constant.
// 🔴 THE MARKER IS THE FIRST STRING LITERAL AND THE CONDITION IS THE FIRST ARGUMENT
// THAT IS NOT ONE. `lsp-plane` writes `check(cond, "MARKER", detail)`; `cs-dap-plane`
// writes `claim("NAME", cond, detail)` — the same idiom with the arguments the other
// way round. Keying on POSITION would have read one of them backwards and classified a
// marker string; keying on SHAPE reads both, and a bare `claim()` with no condition
// (the `_population.mjs` counting form) self-excludes because there is nothing to find.
const CHECK_FNS = new Set(["check", "_check", "assertOk", "claim"]);

// 🔴 AN OUTCOME FLAG IS A PRECONDITION, IN EVERY IDIOM (172). 171 §3 dismissed forty
// `assert.ok(!r.isError)` because each guards real value claims below it, and warned
// that failing them costs the gate its credibility on the first green run. The probes
// spell the same precondition `check(!res.isError, "SUPPORTED", …)` and tabletop-plane
// spells it `expectOk(marker, r)`. One rule for all three — and it is asked of the
// LEAVES rather than the source text, so it survives one-hop resolution and helper
// inlining, neither of which leaves the original spelling behind.
//
// It changes 171's judgement nowhere: a unit holding a precondition AND a shape-only
// value claim is still vacuous, because the value claim still is.
const OUTCOME_FLAG = /\.(isError|threw)$/;
const isPrecondition = (ls) => ls.length > 0 && ls.every((l) => OUTCOME_FLAG.test((l.text ?? "").trim()));

// ─────────────────────────────────────────────── the leaf classifier (169's judgements) --
// A leaf is SHAPE when it can be satisfied by a value that is the wrong ANSWER but the
// right TYPE. A leaf is VALUE when satisfying it constrains WHAT the value is.
export function classifyLeaf(node, src) {
  const t = (n) => n.getText(src);

  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    const eq = op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken;
    const ne = op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken;

    for (const [a, b] of [[node.left, node.right], [node.right, node.left]]) {
      if (ts.isTypeOfExpression(a) && ts.isStringLiteralLike(b)) {
        if (eq && SHAPE_TYPEOF.has(b.text) && b.text !== "undefined") return { kind: "SHAPE", why: `typeof === "${b.text}"`, text: t(node) };
        if (eq && b.text === "undefined") return { kind: "VALUE", why: "typeof === undefined (a negative)", text: t(node) };
        if (ne && b.text === "undefined") return { kind: "SHAPE", why: 'typeof !== "undefined" (presence only)', text: t(node) };
        return { kind: "VALUE", why: `typeof ${ne ? "!==" : "=="} "${b.text}"`, text: t(node) };
      }
      if (ne && (t(b) === "undefined" || t(b) === "null")) return { kind: "SHAPE", why: `${t(b)} presence check`, text: t(node) };
      if (eq && (t(b) === "undefined" || t(b) === "null")) return { kind: "VALUE", why: `asserts ${t(b)}`, text: t(node) };
    }

    if (/\.length$/.test(t(node.left)) || /\.length$/.test(t(node.right))) {
      const lit = ts.isNumericLiteral(node.right) ? Number(node.right.text) : ts.isNumericLiteral(node.left) ? Number(node.left.text) : null;
      if (lit === 0 && (op === ts.SyntaxKind.GreaterThanEqualsToken || op === ts.SyntaxKind.LessThanEqualsToken))
        return { kind: "SHAPE", why: "length >= 0 is vacuous", text: t(node) };
    }
    if (eq || ne) return { kind: "VALUE", why: "compared to a value", text: t(node) };
    return { kind: "VALUE", why: `relational (${ts.tokenToString(op)})`, text: t(node) };
  }

  if (ts.isCallExpression(node)) {
    const callee = t(node.expression);
    if (/^(Array\.isArray|Number\.isFinite|Number\.isInteger|Number\.isSafeInteger)$/.test(callee))
      return { kind: "SHAPE", why: `${callee}() is a type test`, text: t(node) };
    // 🔴 `.some()`/`.includes()`/`.find()` CONSTRAIN EXISTENCE — an empty collection
    // fails them. taut169 recursed into every predicate alike and so read an existence
    // claim as a shape test. `.every()` is the exact opposite and gets its own class.
    const m = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : null;
    if (m && ["some", "includes", "find", "findIndex", "indexOf"].includes(m))
      return { kind: "VALUE", why: `.${m}() constrains existence`, text: t(node) };
    return { kind: "CALL", why: callee, text: t(node), call: node, method: m };
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) return { kind: "SHAPE", why: "literal true", text: t(node) };
  if (ts.isNumericLiteral(node) && Number(node.text) !== 0) return { kind: "SHAPE", why: "truthy literal", text: t(node) };
  // A non-null assertion or an `as` cast is a COMPILE-time claim and constrains nothing
  // at runtime. These are TS-only forms that taut169's ScriptKind.JS parse never saw.
  if (ts.isNonNullExpression(node) || ts.isAsExpression(node)) return classifyLeaf(node.expression, src);
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    return { kind: "SHAPE", why: "bare truthiness (presence only)", text: t(node) };

  return { kind: "OTHER", why: ts.SyntaxKind[node.kind], text: t(node) };
}

export function leaves(node, src, out = [], depth = 0) {
  if (depth > 40) return out;
  if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) return leaves(node.expression, src, out, depth + 1);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken)
    return leaves(node.operand, src, out, depth + 1);
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      leaves(node.left, src, out, depth + 1);
      leaves(node.right, src, out, depth + 1);
      return out;
    }
  }
  const c = classifyLeaf(node, src);
  if (c.kind === "CALL" && c.call) {
    // 🔴 `.every(pred)` RETURNS TRUE ON AN EMPTY COLLECTION whatever pred is, so it is
    // satisfiable without a single element being examined. Its own class, because the
    // fix is a length floor rather than a rewrite.
    if (c.method === "every") {
      // 🔴 KEEP THE RECEIVER (172). `.every()` is vacuous because the collection may be
      // EMPTY — so a receiver that provably is not (a non-empty array literal, directly
      // or one hop away) is not this class at all. Measured: `gdscript-dap-plane`'s
      // `capNames.every(…)` runs over an eight-element literal declared two lines up.
      const recv = ts.isPropertyAccessExpression(c.call.expression) ? c.call.expression.expression.getText(src) : null;
      out.push({ kind: "EVERY", why: ".every() is vacuously true on an empty collection", text: c.text, recv });
      return out;
    }
    let recursed = false;
    for (const arg of c.call.arguments) {
      if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
        const body = ts.isBlock(arg.body) ? null : arg.body;
        if (body) { leaves(body, src, out, depth + 1); recursed = true; }
      }
    }
    if (recursed) return out;
    // A call we cannot see inside is OPAQUE, never a tautology: it may well be the
    // discriminating part. Under-reporting is the safe direction (169, carried).
    out.push({ kind: "OPAQUE", why: `call ${c.why}()`, text: c.text });
    return out;
  }
  out.push(c);
  return out;
}

// ─────────────────────────────────────────────────────────────────── regex vacuity --
// `assert.match(s, /./)` passes for every non-empty string. Rather than reason about
// regex algebra, PROBE it: a pattern accepting nine wildly different strings constrains
// nothing a wrong answer could fail.
const PROBES = ["", "x", "0", "!!", "\n", "a b c", "ZZZZ", "res://a.tscn", "{}"];
function regexVacuity(node, src) {
  if (!ts.isRegularExpressionLiteral(node)) return null;
  const raw = node.getText(src);
  const m = /^\/(.*)\/([a-z]*)$/s.exec(raw);
  if (!m) return null;
  let re;
  try { re = new RegExp(m[1], m[2].replace(/[gy]/g, "")); } catch { return null; }
  let hits = 0;
  for (const p of PROBES) { try { if (re.test(p)) hits++; } catch { return null; } }
  return hits === PROBES.length
    ? { kind: "SHAPE", why: `regex ${raw} matches every probe string`, text: raw }
    : { kind: "VALUE", why: `regex ${raw}`, text: raw };
}

// ───────────────────────────────────────────────────────────────── the claim finder --
// 🔴 THE PART taut169 STRUCTURALLY COULD NOT HAVE. node:test assertions are
// PropertyAccessExpressions on `assert`, plus the bare `assert(x)` call form. Each
// method carries its condition somewhere different; this mapping is the whole port.
function conditionOf(method, args, src) {
  const t = (n) => n.getText(src);
  const nullish = (n) => t(n) === "undefined" || t(n) === "null";

  switch (method) {
    case "ok": case "__bare__":
      return args[0] ? { leaves: leaves(args[0], src), shown: t(args[0]) } : null;

    case "equal": case "strictEqual": {
      const [a, b] = args; if (!a || !b) return null;
      if (t(a) === t(b)) return { leaves: [{ kind: "SHAPE", why: "both sides are the same expression", text: t(a) }], shown: `${t(a)} === ${t(b)}` };
      for (const [x, y] of [[a, b], [b, a]]) {
        if (ts.isTypeOfExpression(x) && ts.isStringLiteralLike(y)) {
          const shape = SHAPE_TYPEOF.has(y.text) && y.text !== "undefined";
          return { leaves: [{ kind: shape ? "SHAPE" : "VALUE", why: `typeof === "${y.text}"`, text: t(x) }], shown: `${t(a)} === ${t(b)}` };
        }
      }
      return { leaves: [{ kind: "VALUE", why: "equality against a value", text: t(b) }], shown: `${t(a)} === ${t(b)}` };
    }

    case "notEqual": case "notStrictEqual": {
      const [a, b] = args; if (!a || !b) return null;
      if (nullish(b) || nullish(a))
        return { leaves: [{ kind: "SHAPE", why: `notEqual ${nullish(b) ? t(b) : t(a)} — presence only`, text: t(a) }], shown: `${t(a)} !== ${t(b)}` };
      return { leaves: [{ kind: "VALUE", why: "inequality against a value", text: t(b) }], shown: `${t(a)} !== ${t(b)}` };
    }

    case "deepEqual": case "deepStrictEqual": {
      const [a, b] = args; if (!a || !b) return null;
      if (t(a) === t(b)) return { leaves: [{ kind: "SHAPE", why: "both sides are the same expression", text: t(a) }], shown: `${t(a)} deepEqual ${t(b)}` };
      // 🔴 THE OFFENDER-LIST IDIOM. `assert.deepEqual(missing, [])` is a STRONG claim
      // about content and a WEAK one about scope: an enumeration that returned nothing
      // satisfies it. Flagged only when the left side is DERIVED from a population; a
      // `deepEqual(reply, [])` against a fixed return value is a real claim.
      if (/^\[\s*\]$/.test(t(b)))
        return { leaves: [{ kind: "OFFENDER", why: "offender list vs [] — passes if the population is empty", text: t(a) }], shown: `${t(a)} deepEqual []` };
      return { leaves: [{ kind: "VALUE", why: "structural equality", text: t(b) }], shown: `${t(a)} deepEqual ${t(b)}` };
    }
    case "notDeepEqual": case "notDeepStrictEqual":
      return args[1] ? { leaves: [{ kind: "VALUE", why: "structural inequality", text: t(args[1]) }], shown: "notDeepEqual(…)" } : null;

    case "match": {
      const [s, r] = args; if (!s || !r) return null;
      const v = regexVacuity(r, src);
      return v ? { leaves: [v], shown: `match(${t(s)}, ${t(r)})` }
               : { leaves: [{ kind: "OPAQUE", why: "regex is not a literal", text: t(r) }], shown: `match(${t(s)}, …)` };
    }
    case "doesNotMatch":
      return { leaves: [{ kind: "VALUE", why: "a negative claim about content", text: t(args[1] ?? args[0]) }], shown: "doesNotMatch(…)" };

    default: return null;
  }
}

// ───────────────────────────────────────────── one-hop resolution (169's FP killer) --
// 🔴 A BARE IDENTIFIER IS ONLY A TAUTOLOGY IF WHAT DEFINED IT WAS ONE. 169 found this by
// checking its instrument before believing it: `good`, `residue.clean` and friends
// looked vacuous until the name was followed to `const good = a === "x" && b === 3`.
// Resolve to the NEAREST PRECEDING binding, which is what a reader does — a name bound
// more than once is not unresolvable.
function collectConsts(src) {
  const list = [];
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer)
      list.push({ name: n.name.text, pos: n.getStart(src), init: n.initializer });
    ts.forEachChild(n, visit);
  };
  visit(src);
  return list;
}
const lookup = (consts, name, usePos) => {
  let best = null;
  for (const c of consts) if (c.name === name && c.pos < usePos && (!best || c.pos > best.pos)) best = c;
  return best;
};
function resolveLeaves(ls, consts, src, usePos, depth = 0) {
  if (depth > 2) return ls;
  const out = []; let changed = false;
  for (const l of ls) {
    if (l.kind === "SHAPE" && l.why === "bare truthiness (presence only)" && /^[A-Za-z_$][\w$]*$/.test(l.text)) {
      const c = lookup(consts, l.text, usePos);
      if (c) {
        const sub = leaves(c.init, src);
        if (sub.length) { out.push(...sub.map((s) => ({ ...s, why: `${l.text} := ${s.why}` }))); changed = true; continue; }
      }
    }
    out.push(l);
  }
  return changed ? resolveLeaves(out, consts, src, usePos, depth + 1) : out;
}

// 🔴 A RECEIVER THAT IS A NON-EMPTY ARRAY LITERAL CANNOT BE EMPTY (172). One hop, the
// same resolution `resolveLeaves` does, asked of the collection rather than the claim.
function isNonEmptyLiteralArray(text, consts, src, usePos) {
  if (!text) return false;
  if (/^\[\s*[^\]\s]/.test(text)) return true;
  if (!/^[A-Za-z_$][\w$]*$/.test(text)) return false;
  const c = lookup(consts, text, usePos);
  if (!c) return false;
  return ts.isArrayLiteralExpression(c.init) && c.init.elements.length > 0;
}

// Is this expression a collection DERIVED from a population? Either it filters/maps
// inline, or it is a name whose nearest preceding binding does — or an empty-array
// accumulator a loop pushes offenders into.
function isDerived(text, consts, src, usePos) {
  if (DERIVING.test(text)) return true;
  if (!/^[A-Za-z_$][\w$]*$/.test(text)) return false;
  const c = lookup(consts, text, usePos);
  if (!c) return false;
  const init = c.init.getText(src);
  return DERIVING.test(init) || /^\[\s*\]$/.test(init);
}

// ─────────────────────────────────────── local asserter helpers (172, tabletop-plane) --
// 🔴 A THIRD PROBE SHAPE, AND THE ONLY REASON `tabletop-plane` READ AS SILENT.
// It asserts through two local helpers that take a REPLY rather than a condition:
//   function expectRefusal(marker, r, code) {
//     if (!r.isError && !r.threw) return fail(marker, …);
//     if (!text.includes(code))   return fail(marker, …);
//     pass(marker, …);
//   }
// There is no condition at the call site to classify — it lives one hop away, in the
// helper's guard clauses. Resolving into them is the same one-hop move `resolveLeaves`
// already makes for names, asked of a function instead. The guards are written in the
// FAILING polarity (`if (bad) fail`); `leaves()` unwraps a leading `!` already and the
// SHAPE/VALUE distinction does not depend on polarity, so the kinds carry over intact.
function collectAsserters(src) {
  const out = new Map();
  const guards = (body) => {
    const conds = [];
    const walk = (n) => {
      if (ts.isIfStatement(n) && /\b(pass|fail)\s*\(/.test(n.getText(src))) conds.push(n.expression);
      ts.forEachChild(n, walk);
    };
    walk(body);
    return conds;
  };
  const consider = (name, fn) => {
    if (!fn?.body || !/\b(pass|fail)\s*\(/.test(fn.body.getText(src))) return;
    const conds = guards(fn.body);
    if (conds.length) out.set(name, conds);
  };
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) consider(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)))
      consider(n.name.text, n.initializer);
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

// The nearest enclosing `test("name", …)` / `it(…)`, so each assertion is attributed to
// the case it belongs to.
function enclosingTest(node, src) {
  for (let p = node.parent, hops = 0; p && hops < 60; p = p.parent, hops++) {
    if (ts.isCallExpression(p) && p.arguments.length && ts.isStringLiteralLike(p.arguments[0])) {
      const c = p.expression;
      const n = ts.isIdentifier(c) ? c.text
        : ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) ? c.expression.text : null;
      if (n && TEST_FNS.has(n)) return { name: p.arguments[0].text, line: src.getLineAndCharacterOfPosition(p.getStart(src)).line + 1 };
    }
  }
  return null;
}

/** Analyse one source text. Exported so the self-test can drive it with no files. */
export function analyze(fileName, text) {
  const src = ts.createSourceFile(
    fileName, text, ts.ScriptTarget.Latest, true,
    /\.ts$/.test(fileName) ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
  const consts = collectConsts(src);
  const asserters = collectAsserters(src);
  const claims = [];

  // One shared scorer, so a probe claim and a unit claim are judged by the same rules.
  // `marker` is the probe's family name; it is the unit `_population.mjs` keys on, and
  // therefore the unit a probe's vacuity must be scored at.
  const record = (node, method, conds, marker) => {
    const list = Array.isArray(conds) ? conds : [conds];
    const raw = list.map((c) => c.getText(src)).join(" && ").replace(/\s+/g, " ");
    const ls = resolveLeaves(list.flatMap((c) => leaves(c, src)), consts, src, node.getStart(src));
    const off = ls.find((l) => l.kind === "OFFENDER");
    claims.push({
      file: fileName, line: src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1,
      method, marker, owner: enclosingTest(node, src),
      cond: raw.slice(0, 170),
      // 🔴 THE FLOOR MUST BE LOOKED FOR IN THE *RESOLVED* TEXT (172). `hasFloor` tested
      // `cond` alone, so `(searchOk && listOk)` — whose floor lives one hop away in the
      // const that defines `searchOk` — read as unfloored. Latent in the unit suite,
      // where conditions are mostly inline; immediate in the probes, where they are not.
      floorText: `${raw} ${ls.map((l) => l.text ?? "").join(" ")}`,
      leaves: ls,
      precondition: isPrecondition(ls),
      allShape: ls.length > 0 && ls.every((l) => l.kind === "SHAPE"),
      anyEvery: ls.some((l) => l.kind === "EVERY" && !isNonEmptyLiteralArray(l.recv, consts, src, node.getStart(src))),
      anyOffender: Boolean(off) && isDerived(off.text, consts, src, node.getStart(src)),
    });
  };

  const visit = (node) => {
    // ── the probe idioms (172) ─────────────────────────────────────────────────────
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length) {
      const callee = node.expression.text;
      // marker = the first string literal; condition = the first argument that is not
      // one. Order-independent, so `check(cond, "M")` and `claim("M", cond)` both read.
      const marker = node.arguments.find((a) => ts.isStringLiteralLike(a));
      const cond = node.arguments.find((a) => !ts.isStringLiteralLike(a));
      if (CHECK_FNS.has(callee) && cond) record(node, callee, cond, marker?.text ?? null);
      // a call to a local pass/fail helper: the condition lives in its guard clauses
      else if (asserters.has(callee) && marker) record(node, callee, asserters.get(callee), marker.text);
    }
    if (ts.isConditionalExpression(node)) {
      const callee = (e) => (ts.isCallExpression(e) && ts.isIdentifier(e.expression) ? e.expression.text : null);
      if (callee(node.whenTrue) === "pass" && callee(node.whenFalse) === "fail") {
        const a = node.whenTrue.arguments?.[0];
        record(node, "pass/fail", node.condition, a && ts.isStringLiteralLike(a) ? a.text : null);
      }
    }
    if (ts.isCallExpression(node)) {
      let method = null;
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "assert")
        method = node.expression.name.text;
      else if (ts.isIdentifier(node.expression) && node.expression.text === "assert") method = "__bare__";

      if (method && !NOT_A_CLAIM.has(method)) {
        const owner = enclosingTest(node, src);
        const line = src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
        if (CONTROL.has(method)) {
          // a throws/rejects IS a claim for block purposes: it constrains control flow.
          claims.push({ file: fileName, line, method, marker: null, owner, cond: `${method}(…)`, floorText: "", allShape: false, precondition: false, anyEvery: false, anyOffender: false });
        } else {
          const c = conditionOf(method, node.arguments, src);
          if (c) {
            const ls = resolveLeaves(c.leaves, consts, src, node.getStart(src));
            const off = ls.find((l) => l.kind === "OFFENDER");
            const shown = c.shown.replace(/\s+/g, " ");
            claims.push({
              file: fileName, line, method, marker: null, owner,
              cond: shown.slice(0, 170),
              floorText: `${shown} ${ls.map((l) => l.text ?? "").join(" ")}`,
              leaves: ls,
              precondition: isPrecondition(ls),
              allShape: ls.length > 0 && ls.every((l) => l.kind === "SHAPE"),
              anyEvery: ls.some((l) => l.kind === "EVERY" && !isNonEmptyLiteralArray(l.recv, consts, src, node.getStart(src))),
              anyOffender: Boolean(off) && isDerived(off.text, consts, src, node.getStart(src)),
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return claims;
}

/** Score a whole set of claims into the three failing classes. */
export function verdict(claims) {
  // 🔴 THE UNIT IS THE MARKER WHERE THERE IS ONE, THE test() BLOCK OTHERWISE (172).
  // A probe is a program, not a suite: it has no `test()` blocks, so 171's block scorer
  // skipped every one of its claims — `if (!c.owner) continue`. 171 §10.2 handed that
  // over as "two instruments, one seam, and nobody has checked the seam is flush",
  // assuming `_population.mjs` covered the other side. IT COVERS A DIFFERENT FAILURE:
  // its VACUOUS proves a family SPOKE. Nothing proved that what a family said could
  // have been different. The marker is exactly the key its manifest is built on, so
  // scoring there makes the two gates meet instead of merely abut.
  const blocks = new Map();
  for (const c of claims) {
    const k = c.marker ? `${c.file}::${c.marker}` : c.owner ? `${c.file}::${c.owner.line}::${c.owner.name}` : null;
    if (!k) continue;
    if (!blocks.has(k)) blocks.set(k, { file: c.file, name: c.marker ?? c.owner.name, line: c.marker ? c.line : c.owner.line, marker: Boolean(c.marker), claims: [] });
    blocks.get(k).claims.push(c);
  }
  // 🔴 THE FLOOR IS FILE-SCOPED, NOT BLOCK-SCOPED. `registration.test.ts` floors its
  // population in ONE test and spends four more on offender lists built from the same
  // enumerator; if it collapses, that one test goes red and CI is red — the others ARE
  // defended, just not locally. Scoring per block reported five defended tests as
  // defects. An INLINE floor in the claim's own condition counts too, which is how
  // `assert.ok(seen.length > 0 && seen.every(…))` — the best version of the fix —
  // stopped being reported as the defect.
  const floorFiles = new Set(claims.filter((c) => FLOOR_RE.test(c.floorText || c.cond || "")).map((c) => c.file));
  const hasFloor = (c) => FLOOR_RE.test(c.floorText || c.cond || "") || floorFiles.has(c.file);

  return {
    blocks: blocks.size,
    // A unit made ONLY of outcome-flag preconditions is 171 §3's forty, and demanding
    // more of them is how a gate loses its credibility on the first green run. A unit
    // that makes a real claim is judged on the real claims alone.
    vacuous: [...blocks.values()].filter((b) => {
      const real = b.claims.filter((c) => !c.precondition);
      return real.length > 0 && real.every((c) => c.allShape);
    }),
    every: claims.filter((c) => c.anyEvery && !hasFloor(c)),
    offender: claims.filter((c) => c.anyOffender && !hasFloor(c)),
  };
}

// ─────────────────────────────────────────────────────────────────────────── main --
function main() {
  let all = [], failed = false;
  for (const [dir, floor] of Object.entries(FLOORS)) {
    const d = join(ROOT, dir);
    const files = readdirSync(d).filter((f) => /\.(mjs|ts)$/.test(f) && !f.startsWith("_"));
    let mine = [];
    const empty = [];
    for (const f of files) {
      const got = analyze(join(d, f), readFileSync(join(d, f), "utf8"));
      if (got.length === 0 && !(f in NO_CLAIMS_EXPECTED)) empty.push(f);
      mine = mine.concat(got);
    }
    all = all.concat(mine);
    const ok = mine.length >= floor;
    console.log(`TAUT_SCOPE ${dir.padEnd(17)} files=${String(files.length).padStart(3)} claim_sites=${String(mine.length).padStart(5)} floor=${floor} ${ok ? "ok" : "🔴 BELOW FLOOR"}`);
    if (!ok) {
      console.log(`🔴 TAUT_SCOPE_COLLAPSE ${dir}: ${mine.length} < ${floor}. Either coverage was deleted, or the classifier stopped`);
      console.log(`   recognising this suite's assertions — which is exactly how taut169 reported a clean unit suite it had never read.`);
      failed = true;
    }
    // 🔴 AND THE DIRECTORY TOTAL IS ITSELF AN AGGREGATE (172). 171 §10.22: "any scope
    // assertion over more than one population needs one number per population." The
    // line above sums twenty-one files; a file that fell to zero hides behind the other
    // twenty exactly as `test` hid behind `test-integration`. Measured on the tree 171
    // shipped: NINE of twenty-one at zero under a floor that read `ok`.
    console.log(`TAUT_SCOPE_FILES ${dir.padEnd(11)} silent=${empty.length} exempt=${files.filter((f) => f in NO_CLAIMS_EXPECTED).length}`);
    // 🔴 AND AN EXEMPTION THAT IS NO LONGER EARNED IS A PLACE TO HIDE. Check 16 in
    // `contract_check.py` fails both directions for this reason; so does this. A file
    // rostered as silent that has since grown claims keeps buying a silence it does not
    // need, and the next file to take that name inherits it.
    for (const f of files) {
      if (!(f in NO_CLAIMS_EXPECTED)) continue;
      if (analyze(join(d, f), readFileSync(join(d, f), "utf8")).length === 0) continue;
      failed = true;
      console.log(`🔴 TAUT_ROSTER_STALE ${dir}/${f} is on NO_CLAIMS_EXPECTED but DOES make claims now — remove it.`);
    }
    for (const f of empty) {
      failed = true;
      console.log(`🔴 TAUT_FILE_SILENT ${dir}/${f} — not one claim site the classifier can read.`);
      console.log(`   Either this file asserts nothing, or the finder does not recognise the idiom it asserts in.`);
      console.log(`   Both are the failure 171 §2 named; neither is visible in the directory total above.`);
    }
  }

  const v = verdict(all);
  const orphan = all.filter((c) => !c.marker && !c.owner).length;
  console.log(`TAUT_CLAIM_SITES ${all.length} across ${v.blocks} unit(s) — ${orphan} attributed to neither a test() block nor a marker`);
  console.log(`TAUT_VACUOUS   ${v.vacuous.length}`);
  console.log(`TAUT_EVERY     ${v.every.length}`);
  console.log(`TAUT_OFFENDER  ${v.offender.length}`);

  for (const b of v.vacuous) {
    failed = true;
    console.log(`\n🔴 TAUT_VACUOUS ${b.file.replace(ROOT, "")}:${b.line} "${b.name}"`);
    console.log(`   every one of its ${b.claims.length} assertion(s) is satisfied by a wrong answer of the right type:`);
    for (const c of b.claims) console.log(`     L${c.line} ${c.marker ? c.method : `assert.${c.method}`} ${c.cond}   [${c.leaves.map((l) => l.why).join(" | ")}]`);
  }
  for (const c of v.every) {
    failed = true;
    console.log(`\n🔴 TAUT_EVERY ${c.file.replace(ROOT, "")}:${c.line} "${c.owner?.name ?? "(module scope)"}"`);
    console.log(`   ${c.cond}\n   .every() is true of the empty collection — assert a length in the same file.`);
  }
  for (const c of v.offender) {
    failed = true;
    console.log(`\n🔴 TAUT_OFFENDER ${c.file.replace(ROOT, "")}:${c.line} "${c.owner?.name ?? "(module scope)"}"`);
    console.log(`   ${c.cond}\n   nothing in this file floors the population that was filtered — an enumeration`);
    console.log(`   returning nothing satisfies this. Assert its size against a literal (170 §4 SCOPE).`);
  }

  if (failed) { console.log(`\nTAUT_GATE 🔴 FAILED`); process.exit(1); }
  console.log(`\nTAUT_GATE ok — ${all.length} claim sites, ${v.blocks} blocks, none vacuous`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("tautology_gate.mjs")) main();
