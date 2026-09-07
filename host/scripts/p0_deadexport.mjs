// p0_deadexport.mjs — session 315. P0 · dead exports, read over the TRACKED TREE.
//
// 🔴 THIS FILE EXISTS BECAUSE THE READER IT REPLACES WAS WRONG ABOUT EVERY SINGLE THING
// IT REPORTED. `docs/CODE_REVIEW_P1_P6.md` §1 measured `ts-prune -p tsconfig.json` at 314:
// seven candidates, two real, and after the two real ones were bound the remaining SIX
// were all live — every one of them referenced from a test, an instrument or a probe
// outside `tsconfig.json`'s `"include": ["src/**/*.ts"]`. A 100% false-positive rate.
// The row is `dead-code-reader-scoped-to-src`; 230's `lint-roster-py-only` and 229's
// `cause-rule-py-only` are the same defect twice before, and `lint_ceiling.py`'s
// `TSC_FLAGS` comment is the fix applied to the sibling reader: *a flag list names its
// population on the command line where the reader can read it back*.
//
// 🔵 SO THE POPULATION IS `git ls-files`, NOT A `tsconfig`, NOT A GLOB. 245's `py_walk`
// is the precedent for reading the tree from git rather than from the filesystem: a
// scratch mutant left behind by a killed gate run is not part of this repository, and a
// reader that walks directories cannot tell.
//
// ── 🔴 THE TUNING IS THE OPPOSITE OF ts-prune's, AND DELIBERATELY ────────────────────
//
// ts-prune answers *is this exported name imported anywhere the compiler was pointed at*,
// which is precise and scoped, and the scope was the defect. This answers *does this
// exported name survive as an IDENTIFIER anywhere else in the tracked tree*, which is
// imprecise and unscoped. That trade is chosen and not conceded:
//
//   · a name re-used as an unrelated local somewhere else reads as live here — a FALSE
//     NEGATIVE, and this reader will under-report
//   · a name that appears only in a comment, a string or a markdown file does NOT count,
//     because the population is TOKENS and not text. That is the whole difference between
//     this and a `grep`, and it is what 313's `shell_scripts` rule means by *the cure for
//     a text reader is a parser*
//
// 🔴 THE DIRECTION OF THE ERROR IS THE POINT. A reader whose findings are all false
// trains its readers to ignore it (314 §2.2), so this one is built to be believed when it
// speaks and to stay quiet when it is unsure. A candidate here is a name no other file in
// the repository so much as mentions in code — which is a claim worth acting on, and a
// silence that is worth nothing at all. 🔵 `mentions` is printed beside `candidates` for
// exactly that reason: it is the population this reader declines to judge, and a session
// watching it grow is watching the reader's blind half grow.
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const HOST = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = resolve(HOST, "..");

// 🔴 THE SUBJECT IS `host/src` AND THE POPULATION IS EVERYTHING. Those are two different
// questions and conflating them is the defect this file is named after: we ask about the
// exports of the shipped source, and we ask it of the whole repository.
export const SUBJECT_PREFIX = "host/src/";

// Extensions whose contents are TOKENISED. Everything else in the tree is read for
// `mentions` only — a name in a `.md` or a `.json` is a mention, never a reference.
export const CODE_EXT = new Set([".ts", ".mts", ".cts", ".tsx", ".js", ".mjs", ".cjs"]);

export function tracked(root = ROOT) {
  const out = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8",
                                                  maxBuffer: 64 * 1024 * 1024 });
  return out.split("\n").filter((x) => x.trim().length > 0);
}

export function extOf(path) {
  const i = path.lastIndexOf(".");
  return i < 0 ? "" : path.slice(i);
}

// ── the two readers ──────────────────────────────────────────────────────────────────

/** Every name a file EXPORTS, from the AST — not from a regex over the text.
 *
 * 🔴 `export default` IS DELIBERATELY NOT COLLECTED. It has no name to search for, so a
 * reader that counted it would be reporting a population it cannot answer about, which is
 * the shape 292's rule refuses: a `false` is the claim *we looked and it is not there*.
 */
export function exportsOf(src, fileName = "x.ts") {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.ES2022, true);
  const names = new Set();
  const exported = (node) =>
    (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;
  const walk = (node) => {
    if (ts.isVariableStatement(node) && exported(node.declarationList.declarations[0])) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) names.add(d.name.text);
      }
    } else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)
                || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
                || ts.isEnumDeclaration(node))
               && node.name && exported(node)) {
      names.add(node.name.text);
    } else if (ts.isExportDeclaration(node) && node.exportClause
               && ts.isNamedExports(node.exportClause)) {
      // `export { a, b as c }` — the name the outside world can import is the ALIAS.
      for (const e of node.exportClause.elements) names.add(e.name.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return names;
}

/** Every IDENTIFIER token in a source file — comments and string contents excluded.
 *
 * 🔴 THE PARSER AND NOT THE SCANNER, AND THE FIRST DRAFT GOT THIS WRONG. A bare
 * `ts.createScanner` looked like the cheaper tool and it reported 152 distinct
 * identifiers in a 39 KB file, five of them the English word `the` — it was tokenising
 * COMMENT TEXT, which is the exact failure this reader exists to avoid. The parser makes
 * comments trivia by construction, so they can never reach an identifier node. 🔵 A parse
 * error yields a PARTIAL tree rather than an exception, so the degradation is the same
 * one the scanner was chosen for, without the defect it came with.
 */
export function identifiersOf(src, fileName = "x.ts") {
  return new Set(identifierCounts(src, fileName).keys());
}

/** How many times each identifier occurs — the COUNT, which is what tells a name used
 *  inside its own file from a name that only ever got declared there.
 *
 * 🔴 THIS IS THE DISTINCTION THE FIRST DRAFT OF THIS FILE DID NOT MAKE, AND IT REPORTED
 * FIFTY CANDIDATES BECAUSE OF IT. Excluding the declaring file from the search answers
 * *is this name imported anywhere*, and a type used throughout its own module is not
 * imported anywhere and is not remotely dead. That is what `ts-prune`'s
 * `grep -v 'used in module'` drops, and dropping it is right: the two findings are
 * different work. One says DELETE THIS; the other says THIS NEED NOT BE EXPORTED.
 */
export function identifierCounts(src, fileName = "x.ts") {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.ES2022, true);
  const out = new Map();
  const walk = (node) => {
    if (ts.isIdentifier(node)) out.set(node.text, (out.get(node.text) || 0) + 1);
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

const wordRe = (name) => new RegExp(`(?<![\\w$])${name.replace(/[$]/g, "\\$")}(?![\\w$])`);

/** (dead, overExported, mentions) — PURE over its inputs, so the self-test can hand it a
 *  tree that does not exist and drive every direction. 174 §8's rule.
 *
 *  `files` is `{path: text}`. THREE TIERS, and the whole value of this reader is that
 *  they are three and not one:
 *
 *    dead          the name occurs ONCE in the tree — its own declaration — and nowhere
 *                  else, in no file, not even the one that declares it. Delete it.
 *    overExported  used inside its own module and imported by nothing. The `export`
 *                  keyword is what is dead, not the code. A different piece of work, and
 *                  reporting it as dead code is how a reader gets ignored.
 *    mentions      survives only in prose — a comment, a string, a markdown file. Not
 *                  evidence of life, not evidence of death, so it is NAMED and not judged.
 */
export function deadExports(files, subjectPrefix = SUBJECT_PREFIX) {
  const subjects = Object.keys(files).filter(
    (p) => p.startsWith(subjectPrefix) && CODE_EXT.has(extOf(p)) && !p.endsWith(".d.ts"));
  const tokensByFile = new Map();
  const countsByFile = new Map();
  for (const [p, text] of Object.entries(files)) {
    if (!CODE_EXT.has(extOf(p))) continue;
    const counts = identifierCounts(text, p);
    tokensByFile.set(p, new Set(counts.keys()));
    countsByFile.set(p, counts);
  }
  const dead = [];
  const overExported = [];
  const mentions = [];
  for (const file of subjects) {
    for (const name of [...exportsOf(files[file], file)].sort()) {
      let referenced = false;
      for (const [p, toks] of tokensByFile) {
        if (p !== file && toks.has(name)) { referenced = true; break; }
      }
      if (referenced) continue;
      // 🔴 THE `export { x }` FORM DECLARES THE NAME TWICE IN ONE FILE — once where it is
      // defined and once in the clause — so a bare `> 1` would read every re-exported
      // name as used. The clause is not a use, and the count it contributes is subtracted
      // before the question is asked.
      const clause = (exportClauseNames(files[file], file).get(name) || 0);
      const own = (countsByFile.get(file)?.get(name) || 0) - clause;
      if (own > 1) { overExported.push({ file, name, uses: own - 1 }); continue; }
      const re = wordRe(name);
      const prose = Object.entries(files).some(([p, t]) => p !== file && re.test(t));
      (prose ? mentions : dead).push({ file, name });
    }
  }
  return { dead, overExported, mentions };
}

/** How many times each name appears inside an `export { … }` clause — the occurrences
 *  that are a DECLARATION of visibility rather than a use of the thing. */
export function exportClauseNames(src, fileName = "x.ts") {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.ES2022, true);
  const out = new Map();
  const bump = (n) => out.set(n, (out.get(n) || 0) + 1);
  const walk = (node) => {
    if (ts.isExportDeclaration(node) && node.exportClause
        && ts.isNamedExports(node.exportClause)) {
      for (const e of node.exportClause.elements) {
        bump(e.name.text);
        if (e.propertyName) bump(e.propertyName.text);
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

// ── the floor ────────────────────────────────────────────────────────────────────────
//
// 🔴 A CENSUS WITH NO FLOOR IS A NUMBER THAT CAN GO TO ZERO WITHOUT ANYBODY NOTICING —
// which is precisely how a reader stops discriminating while still printing. `exports`
// and `files` are the population; if either collapses this reader has stopped reading the
// tree and its `0 candidates` means nothing.
export const FLOOR = { files: 40, exports: 200, tokenFiles: 100 };

// 🔴 AND TWO CEILINGS, BECAUSE THIS READER IS NOW WORTH GATING ON AND ts-prune WAS NOT.
// Measured at 315 against the whole tracked tree: ZERO dead exports and SIXTY exported
// names nothing imports. The two numbers get opposite governance and the reason is the
// row this file closes — a gate is worth having exactly when its findings are true.
//
//   DEAD_CEILING 0     an export no file mentions in code is a deletion nobody has to
//                      argue about, and there are none today. This is a real claim: add
//                      an export nothing uses and it fires. It is not a floor waiting for
//                      cleanup; it is the state the tree is already in, held there.
//   OVEREXPORT_CEILING the sixty are a different piece of work — the `export` keyword is
//                      dead, not the code — and deleting sixty keywords is not the
//                      session that builds the reader. Ceilinged at the live value so it
//                      cannot grow quietly, which is 313's ruling on a long-carried
//                      ungoverned count: governance now, open-ended cleanup not bundled in.
export const DEAD_CEILING = 0;
export const OVEREXPORT_CEILING = 60;

export function floorProblems(stats, floor = FLOOR) {
  const out = [];
  const at = (what, got, want) => { if (got < want) out.push(`${what} ${got}, floor ${want}`); };
  at("subject files walked", stats.files, floor.files);
  at("exported names read", stats.exports, floor.exports);
  at("tracked files tokenised", stats.tokenFiles, floor.tokenFiles);
  return out;
}

/** The gate half — PURE over the counts, so the ceilings can be driven without a tree. */
export function ceilingProblems(dead, overExported,
                                deadCeiling = DEAD_CEILING,
                                overCeiling = OVEREXPORT_CEILING) {
  const out = [];
  if (dead.length > deadCeiling) {
    out.push(`P0_DEADEXPORT_DEAD ${dead.length} exported name(s) appear nowhere in the ` +
             `tracked tree as code, ceiling ${deadCeiling} — ` +
             dead.map((d) => `${d.file}:${d.name}`).join(", "));
  }
  if (overExported.length > overCeiling) {
    out.push(`P0_DEADEXPORT_OVER ${overExported.length} exported name(s) are imported by ` +
             `nothing, ceiling ${overCeiling}. The code is live and the \`export\` is not; ` +
             `drop the keyword or import it somewhere`);
  }
  return out;
}

function main() {
  const paths = tracked();
  const files = {};
  for (const p of paths) {
    try { files[p] = readFileSync(resolve(ROOT, p), "utf8"); } catch { /* binary or gone */ }
  }
  const { dead, overExported, mentions } = deadExports(files);
  const subjects = Object.keys(files).filter(
    (p) => p.startsWith(SUBJECT_PREFIX) && CODE_EXT.has(extOf(p)) && !p.endsWith(".d.ts"));
  const exportCount = subjects.reduce((a, p) => a + exportsOf(files[p], p).size, 0);
  const tokenFiles = Object.keys(files).filter((p) => CODE_EXT.has(extOf(p))).length;
  const stats = { files: subjects.length, exports: exportCount, tokenFiles };

  if (process.argv.includes("--floor")) {
    console.log(
      `P0_DEADEXPORT_CENSUS files=${stats.files} exports=${stats.exports} ` +
      `tokenFiles=${stats.tokenFiles} dead=${dead.length} ` +
      `over=${overExported.length} mentions=${mentions.length}`);
    const problems = floorProblems(stats).concat(ceilingProblems(dead, overExported));
    for (const p of problems) console.log(`  FAIL P0_DEADEXPORT_FLOOR ${p}`);
    if (problems.length) {
      console.log(
        `P0_DEADEXPORT_FLOOR ${problems.length} measure(s) collapsed — this reporter is ` +
        `still printing and has stopped reading the tree`);
      process.exitCode = 1;
      return;
    }
    console.log("P0_DEADEXPORT_FLOOR ok — every measure is above its floor");
    return;
  }

  console.log(`=== DEAD EXPORTS — ${stats.exports} exported name(s) across ` +
              `${stats.files} file(s) under ${SUBJECT_PREFIX} ===`);
  console.log(`tracked files tokenised: ${stats.tokenFiles}`);
  console.log(`\ndead — the name appears nowhere in the tree as code: ${dead.length}`);
  for (const c of dead) console.log(`      ${c.file}  ${c.name}`);
  console.log(`\nover-exported — used in its own module, imported by nothing: ${overExported.length}`);
  for (const o of overExported) {
    console.log(`      ${o.file}  ${o.name}  (${o.uses} use(s) in module)`);
  }
  console.log(`\nmentions — surviving only in prose, NOT judged: ${mentions.length}`);
  for (const m of mentions) console.log(`      ${m.file}  ${m.name}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
