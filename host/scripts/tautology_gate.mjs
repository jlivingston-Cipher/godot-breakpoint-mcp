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
const FLOORS = { test: 2100, "test-integration": 400 };

const SHAPE_TYPEOF = new Set(["boolean", "number", "string", "object", "function", "undefined", "bigint", "symbol"]);
const FLOOR_RE = /\.length|\.size|\bcount\b|\.byteLength/;
const DERIVING = /\.(filter|map|flatMap|flat|reduce|concat|entries|keys|values|from)\s*\(|\bObject\.(keys|values|entries)\b/;
const TEST_FNS = new Set(["test", "it"]);
const NOT_A_CLAIM = new Set(["fail"]);
const CONTROL = new Set(["throws", "rejects", "doesNotThrow", "doesNotReject"]);

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
    if (c.method === "every") { out.push({ kind: "EVERY", why: ".every() is vacuously true on an empty collection", text: c.text }); return out; }
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
  const claims = [];

  const visit = (node) => {
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
          claims.push({ file: fileName, line, method, owner, cond: `${method}(…)`, allShape: false, anyEvery: false, anyOffender: false });
        } else {
          const c = conditionOf(method, node.arguments, src);
          if (c) {
            const ls = resolveLeaves(c.leaves, consts, src, node.getStart(src));
            const off = ls.find((l) => l.kind === "OFFENDER");
            claims.push({
              file: fileName, line, method, owner,
              cond: c.shown.replace(/\s+/g, " ").slice(0, 170),
              leaves: ls,
              allShape: ls.length > 0 && ls.every((l) => l.kind === "SHAPE"),
              anyEvery: ls.some((l) => l.kind === "EVERY"),
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
  const blocks = new Map();
  for (const c of claims) {
    if (!c.owner) continue;
    const k = `${c.file}::${c.owner.line}::${c.owner.name}`;
    if (!blocks.has(k)) blocks.set(k, { file: c.file, ...c.owner, claims: [] });
    blocks.get(k).claims.push(c);
  }
  // 🔴 THE FLOOR IS FILE-SCOPED, NOT BLOCK-SCOPED. `registration.test.ts` floors its
  // population in ONE test and spends four more on offender lists built from the same
  // enumerator; if it collapses, that one test goes red and CI is red — the others ARE
  // defended, just not locally. Scoring per block reported five defended tests as
  // defects. An INLINE floor in the claim's own condition counts too, which is how
  // `assert.ok(seen.length > 0 && seen.every(…))` — the best version of the fix —
  // stopped being reported as the defect.
  const floorFiles = new Set(claims.filter((c) => FLOOR_RE.test(c.cond ?? "")).map((c) => c.file));
  const hasFloor = (c) => FLOOR_RE.test(c.cond ?? "") || floorFiles.has(c.file);

  return {
    blocks: blocks.size,
    vacuous: [...blocks.values()].filter((b) => b.claims.every((c) => c.allShape)),
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
    for (const f of files) mine = mine.concat(analyze(join(d, f), readFileSync(join(d, f), "utf8")));
    all = all.concat(mine);
    const ok = mine.length >= floor;
    console.log(`TAUT_SCOPE ${dir.padEnd(17)} files=${String(files.length).padStart(3)} claim_sites=${String(mine.length).padStart(5)} floor=${floor} ${ok ? "ok" : "🔴 BELOW FLOOR"}`);
    if (!ok) {
      console.log(`🔴 TAUT_SCOPE_COLLAPSE ${dir}: ${mine.length} < ${floor}. Either coverage was deleted, or the classifier stopped`);
      console.log(`   recognising this suite's assertions — which is exactly how taut169 reported a clean unit suite it had never read.`);
      failed = true;
    }
  }

  const v = verdict(all);
  console.log(`TAUT_CLAIM_SITES ${all.length} across ${v.blocks} test blocks`);
  console.log(`TAUT_VACUOUS   ${v.vacuous.length}`);
  console.log(`TAUT_EVERY     ${v.every.length}`);
  console.log(`TAUT_OFFENDER  ${v.offender.length}`);

  for (const b of v.vacuous) {
    failed = true;
    console.log(`\n🔴 TAUT_VACUOUS ${b.file.replace(ROOT, "")}:${b.line} "${b.name}"`);
    console.log(`   every one of its ${b.claims.length} assertion(s) is satisfied by a wrong answer of the right type:`);
    for (const c of b.claims) console.log(`     L${c.line} assert.${c.method} ${c.cond}   [${c.leaves.map((l) => l.why).join(" | ")}]`);
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
