// p0_deadexport.selftest.mjs — session 315.
//
// 🔴 THE READER THIS FILE GUARDS EXISTS BECAUSE ITS PREDECESSOR WAS WRONG ABOUT EVERY
// FINDING IT MADE, so the one thing these claims must establish is that this one can be
// wrong in the other direction too — that it SPEAKS when there is something to say. A
// reader with a green live tree and no positive control is indistinguishable from a
// reader that returns the empty list, which is 245's `blind-py-gates` and the reason
// every arm below is driven both ways.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ROOT, HOST, CODE_EXT, SUBJECT_PREFIX, DEAD_CEILING, OVEREXPORT_CEILING,
  exportsOf, exportClauseNames, identifiersOf, identifierCounts, deadExports,
  floorProblems, ceilingProblems, tracked, extOf,
} from "./p0_deadexport.mjs";

let claims = 0, bad = 0;
const claim = (label, got, want) => {
  claims += 1;
  try { assert.deepEqual(got, want); } catch {
    bad += 1;
    console.log(`  FAIL P0_DEADEXPORT_SELFTEST ${label}\n      got  ${JSON.stringify(got)}` +
                `\n      want ${JSON.stringify(want)}`);
  }
};

// ── `exportsOf` — the AST, and every form the tree actually uses ─────────────────────
claim("exports: a const", [...exportsOf("export const A = 1;")], ["A"]);
claim("exports: several in one statement",
      [...exportsOf("export const A = 1, B = 2;")].sort(), ["A", "B"]);
claim("exports: a function", [...exportsOf("export function f() {}")], ["f"]);
claim("exports: a class", [...exportsOf("export class C {}")], ["C"]);
claim("exports: an interface", [...exportsOf("export interface I { a: number }")], ["I"]);
claim("exports: a type alias", [...exportsOf("export type T = string;")], ["T"]);
claim("exports: an enum", [...exportsOf("export enum E { a }")], ["E"]);
claim("exports: a clause exports the ALIAS, which is the importable name",
      [...exportsOf("const a = 1;\nexport { a as b };")], ["b"]);
claim("exports: a NON-exported declaration is not one",
      [...exportsOf("const A = 1;\nfunction f() {}")], []);
// 🔴 `export default` HAS NO NAME TO SEARCH FOR, so counting it would put a row in the
// population this reader cannot answer about — 292's rule about what a `false` costs.
claim("exports: `export default` is deliberately not collected",
      [...exportsOf("export default function () {}")], []);

// ── `identifierCounts` — the parser, and the defect the scanner shipped with ─────────
//
// 🔴 THE FIRST DRAFT USED `ts.createScanner` AND TOKENISED COMMENT TEXT. It read 152
// distinct identifiers out of a 39 KB file and five of them were the English word `the`,
// so a live export whose only other use was in a file the scanner mis-lexed would have
// been reported dead. This claim is the pin: a name that appears ONLY in a comment or a
// string is not an identifier, and the two below are what tell a parser from a `grep`.
claim("counts: a comment is not code",
      identifierCounts("// mentions widget\nconst x = 1;").get("widget"), undefined);
claim("counts: a string is not code",
      identifierCounts('const s = "widget";').get("widget"), undefined);
claim("counts: a real use is counted, and counted once per occurrence",
      identifierCounts("const widget = 1; widget; widget;").get("widget"), 3);
claim("identifiersOf is the key set of the same walk",
      [...identifiersOf("const a = 1; a; b;")].sort(), ["a", "b"]);

// ── `exportClauseNames` — the occurrences that are visibility, not use ───────────────
//
// 🔵 WITHOUT THIS SUBTRACTION `export { x }` DECLARES ITS NAME TWICE and every
// re-exported symbol reads as used-in-module. The clause is not a use of the thing.
claim("clause: `export { a }` names `a` once",
      exportClauseNames("const a = 1;\nexport { a };").get("a"), 1);
claim("clause: `export { a as b }` names both sides",
      [exportClauseNames("const a = 1;\nexport { a as b };").get("a"),
       exportClauseNames("const a = 1;\nexport { a as b };").get("b")], [1, 1]);
claim("clause: a file with no clause names nothing",
      exportClauseNames("export const a = 1;").size, 0);

// ── `deadExports` — the three tiers, each driven in both directions ──────────────────
const F = (o) => o;
claim("tiers: an export imported by another file is in NO tier",
      deadExports(F({ "host/src/a.ts": "export const widget = 1;",
                      "host/test/b.ts": "import { widget } from '../src/a.js'; widget;" })),
      { dead: [], overExported: [], mentions: [] });
claim("tiers: an export nothing anywhere carries is DEAD",
      deadExports(F({ "host/src/a.ts": "export const widget = 1;",
                      "host/test/b.ts": "const other = 2;" })).dead,
      [{ file: "host/src/a.ts", name: "widget" }]);
claim("tiers: an export used in its own module and imported by nothing is OVER-EXPORTED",
      deadExports(F({ "host/src/a.ts": "export const widget = 1;\nconst y = widget + 1;\nexport const z = y;",
                      "host/test/b.ts": "import { z } from '../src/a.js'; z;" })).overExported,
      [{ file: "host/src/a.ts", name: "widget", uses: 1 }]);
claim("tiers: an export surviving only in prose is a MENTION and is not judged",
      deadExports(F({ "host/src/a.ts": "export const widget = 1;",
                      "docs/notes.md": "the widget is described here" })).mentions,
      [{ file: "host/src/a.ts", name: "widget" }]);
// 🔴 AND A MENTION IS NOT A DEATH. The same fixture with the prose file removed must
// change tier — if it did not, `mentions` would be decoration rather than a partition.
claim("tiers: remove the prose and the same name becomes DEAD",
      deadExports(F({ "host/src/a.ts": "export const widget = 1;" })).dead.length, 1);
// 🔵 THE SUBJECT IS `host/src`, AND A FILE OUTSIDE IT IS POPULATION, NEVER SUBJECT.
claim("tiers: an export OUTSIDE the subject prefix is not judged at all",
      deadExports(F({ "scripts/x.ts": "export const widget = 1;" })),
      { dead: [], overExported: [], mentions: [] });
claim("tiers: but a file outside the subject still counts as a REFERENCE",
      deadExports(F({ "host/src/a.ts": "export const widget = 1;",
                      "scripts/x.mjs": "widget;" })),
      { dead: [], overExported: [], mentions: [] });
// 🔴 A `.d.ts` IS A DECLARATION FILE AND NOT SHIPPED SOURCE.
claim("tiers: a .d.ts under the subject prefix is not a subject",
      deadExports(F({ "host/src/a.d.ts": "export const widget: number;" })).dead, []);

// ── the floors, and the ceilings ─────────────────────────────────────────────────────
claim("floor: a healthy population is silent",
      floorProblems({ files: 999, exports: 999, tokenFiles: 999 }), []);
// 🔴 THE ORDER OF THESE TWO IS LOAD-BEARING AND THE LATE-BLIND AXIS IS WHY. 277 §2: a
// late blind lets a member answer correctly ONCE and return its empty for every call
// after, so whichever claim runs LAST is the one under the blind — and a claim of the
// form *this reader finds nothing here* is satisfied by a reader that finds nothing
// anywhere. The first draft put the healthy case second and `instrument_gate.py` reported
// `{SIG:floorProblems}` STILL GREEN on `A:gate`. The refusal runs last now, so a
// collapsed `floorProblems` is caught on both axes rather than only on the global one.
claim("floor: a collapsed population is refused",
      floorProblems({ files: 0, exports: 0, tokenFiles: 0 }).length, 3);
// 🔴 314 §5.4 — A FIXTURE DERIVED FROM THE CONSTANT IT GOVERNS CANNOT SEE THAT CONSTANT
// MOVE. `REACH_UNDECLARED_CEILING` built `ceiling + 1` rows and therefore refused at
// every value the ceiling could take, which made it green at a million. So these drive
// FIXED counts against the shipped ceilings and assert the shipped values by name.
// 🔴 AND `floor_pin_gate` CAUGHT THE FIRST DRAFT OF THESE FOUR LINES DOING EXACTLY WHAT
// THE PARAGRAPH ABOVE FORBIDS. The over-export fixture was `new Array(OVEREXPORT_CEILING)`
// — derived from the constant it governs — so lowering the ceiling shrank the fixture with
// it and the claim stayed green at every value, including zero. The comment was written
// before the code and the code broke it anyway, which is worth recording: 314 §5.4 is not
// a rule you can hold in your head while typing the line it governs. THE PINS ARE EXACT
// EQUALITIES ON THE SHIPPED VALUES, and the fixtures are FIXED COUNTS.
claim("ceiling: the shipped dead ceiling is zero", DEAD_CEILING === 0, true);
claim("ceiling: the shipped over-export ceiling is sixty", OVEREXPORT_CEILING === 60, true);
claim("ceiling: one dead export is over a ceiling of zero",
      ceilingProblems([{ file: "host/src/a.ts", name: "w" }], []).length, 1);
claim("ceiling: no dead export is not",
      ceilingProblems([], []).length, 0);
const rows = (n) => new Array(n).fill({ file: "f", name: "n" });
claim("ceiling: sixty over-exports pass the shipped ceiling",
      ceilingProblems([], rows(60)).length, 0);
claim("ceiling: sixty-one do not",
      ceilingProblems([], rows(61)).length, 1);
// 🔵 AND THE PARAMETER IS DRIVEN SEPARATELY FROM THE CONSTANT, so the arm is proved over
// values the shipped number does not take — which is the half a pin on one value cannot
// give you, and the half that stays true when the ceiling moves.
claim("ceiling: the bound is the parameter, driven low",
      ceilingProblems([], rows(3), 0, 2).length, 1);
claim("ceiling: and the parameter, driven high",
      ceilingProblems([], rows(3), 0, 3).length, 0);
// 🔵 THE POSITIVE CONTROL ON THE REFUSAL TEXT — a refusal that does not name the symbol
// is a refusal somebody has to go and re-derive, which is what `--floor` output is for.
claim("ceiling: the dead refusal names the file and the symbol",
      ceilingProblems([{ file: "host/src/a.ts", name: "widget" }], [])[0]
        .includes("host/src/a.ts:widget"), true);

// ── the live tree — the claim that this reader disagrees with its predecessor ────────
//
// 🔴 THE SEVEN NAMES ts-prune REPORTED AT 314 ARE ASSERTED BY NAME. Six of them were
// measured live by hand in `docs/CODE_REVIEW_P1_P6.md` §1 and this reader must not call
// any of them dead. `PathRefusal` is the seventh and it is the interesting one: 314 bound
// it by making `refuse()` name the type, so it is used in its own module and imported by
// nothing — OVER-EXPORTED, which is true, and which is a different sentence from the one
// ts-prune was saying about it.
const files = {};
for (const p of tracked()) {
  try { files[p] = readFileSync(resolve(ROOT, p), "utf8"); } catch { /* binary */ }
}
const live = deadExports(files);
const deadNames = new Set(live.dead.map((d) => d.name));
const overNames = new Set(live.overExported.map((d) => d.name));
for (const name of ["installedAddonVersion", "ANNOTATED_TOOLS", "enumeratePathCohort",
                    "summarisePathCohort", "RECIPE_NAMES", "gateTargets"]) {
  claim(`live: \`${name}\` — reported by ts-prune at 314, measured live — is not dead here`,
        deadNames.has(name), false);
  claim(`live: \`${name}\` is not over-exported either — it is IMPORTED`,
        overNames.has(name), false);
}
claim("live: `PathRefusal` is over-exported, which is the true sentence about it",
      overNames.has("PathRefusal"), true);
claim("live: and it is not dead, because 314 bound it",
      deadNames.has("PathRefusal"), false);
claim("live: the tree holds no dead export at all", live.dead, []);
// 🔵 AND THE POPULATION IS REAL — a reader that read nothing would satisfy every claim
// above by returning empty lists.
claim("live: the subject population is the shipped source, and it is not empty",
      Object.keys(files).filter((p) => p.startsWith(SUBJECT_PREFIX) && CODE_EXT.has(extOf(p)))
        .length > 40, true);
claim("live: over-exported is a real population, not an empty one",
      live.overExported.length > 0, true);
claim("live: HOST resolves under ROOT", HOST.startsWith(ROOT), true);

console.log(`P0_DEADEXPORT_SELFTEST ${claims - bad}/${claims} claims, ${bad} failed`);
process.exitCode = bad ? 1 : 0;
