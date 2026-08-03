#!/usr/bin/env python3
"""instrument_gate.py — session 173. THE BLINDING GATE, POINTED AT THE JS INSTRUMENTS.

172 built `scope_gate.py`: blind each of `contract_check.py`'s enumerators in turn and
assert the run goes RED. It closed 14 finders that could match nothing and still print
ALL HARD CHECKS PASSED, and it named the transferable part — not the ledger, the
harness — then listed the two instruments it had not reached:

    172 §10.2  "_population.mjs's manifests and host/scripts/path-cohort.mjs have never
                been asked the same question. Cheap start: the blinding technique in
                scope_gate.py ports directly."

This is that port. Measured in 173, before a line of fix was written:

    _population.mjs   1 of 8 STILL GREEN   -> reportOrDie()
    path-cohort.ts    0 of 8 STILL GREEN

🔴 AND THE THING THE SWEEP COULD NOT REACH IS WHY THIS FILE HAS THREE INSTRUMENTS AND
NOT TWO. The cohort's own walk was clean, but the LEDGER COMPARISON that consumes it had
no gate anywhere to point a harness at: it lived inline in a probe that boots the Godot
editor GUI under Xvfb, so no case with a known answer had ever been put through it. A
blinding harness reports nothing about an instrument with no gate, and reports it in
green — which is the same observable as "clean". Every instrument listed below must
therefore name a gate that RUNS HEADLESS, and that constraint is the finding.

Run: python3 scripts/instrument_gate.py   (a CI step beside the scope gate)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOST = ROOT / "host"

# ── the three instruments, each with the gate that is supposed to cover it ──────────
#
# 🔴 EACH FLOOR IS A LITERAL AND EACH INSTRUMENT GETS ITS OWN LINE (172 §6). The scope
# ledger's first draft summed two populations into one line and the blinding harness
# caught it an hour later: blinding either left the TOTAL above the floor. A sum is not
# a floor. `>=` because every one of these lists is supposed to grow.
INSTRUMENTS = [
    {
        "name": "_population.mjs",
        "src": HOST / "test-integration" / "_population.mjs",
        "gate": ["node", "test-integration/_population.selftest.mjs"],
        "cwd": HOST,
        "floor": 8,
        "why": "the claim counter fourteen live probes report their coverage through",
        # The empty each member's own contract promises — `claim` returns true, `seal`
        # returns the number it drained, `report` the failure list. Injecting it IS the
        # failure mode, not an approximation of it.
        "targets": {
            "claim(family)": "return true;",
            "open(label)": "return label;",
            "_closeOpen()": "return;",
            "async family(label, fn, onThrow)": "return { made: 0, threw: null };",
            'seal(marker, detail = "")': "console.log(marker); return 0;",
            "report()": "return [];",
            # 🔴 THE ONE THAT WAS GREEN IN 173. Eleven of fourteen probes call ONLY this.
            "reportOrDie()": "return 0;",
            "get assert()": "return nodeAssert;",
        },
    },
    {
        "name": "_path_ledger.mjs",
        "src": HOST / "test-integration" / "_path_ledger.mjs",
        "gate": ["node", "test-integration/_path_ledger.selftest.mjs"],
        "cwd": HOST,
        "floor": 3,
        "why": "the comparison that decides whether the live path cohort and the ledger agree",
        "targets": {
            "export function parsePathLedger(text) {": "return { entries: new Map(), badClass: [] };",
            # 🔴 THE ONE 173's OWN REVERSE SWEEP ADDED. Its first draft inlined this
            # check, so the only case any test could construct was the healthy one and
            # `scope` was a collector asserted EMPTY and never proved to collect.
            "export function ledgerScopeFailures(canaries = LEDGER_CANARIES, classes = LEDGER_CLASSES) {": "return [];",
            "export function comparePathLedger(liveRows, ledgerText) {":
                "return { unclassified: [], stale: [], badClass: [], lost: [], scope: [], "
                "liveCount: 0, ledgerCount: 0, canaryCount: 0 };",
        },
    },
    {
        # 🔴 174. SIX OF SIX STILL GREEN when this was measured — every headless gate in
        # the tree passed with the module fully blinded, because it is imported in
        # exactly one place: a probe that boots the editor GUI under Xvfb. That is
        # `_path_ledger.mjs`'s gap of one session earlier, one file over.
        #
        # AND THE SEAM IS WHY THIS ENTRY MATTERS MORE THAN ITS SELF-TEST. `restoreDir`
        # decides what to REMOVE from `walk()`; `diffDir` decides what APPEARED from
        # `walk()`. diffDir re-HASHES independently — the half #141/#143 were about —
        # but it does not re-ENUMERATE independently, so a blind enumerator means the
        # restore removes nothing AND the check that proves the restore worked reports
        # clean. A self-test cannot pin that: it calls the enumerator it would need to
        # distrust. A blinding harness can, and `walk` below is the target that does.
        "name": "_workspace.mjs",
        "src": HOST / "test-integration" / "_workspace.mjs",
        "gate": ["node", "test-integration/_workspace.selftest.mjs"],
        "cwd": HOST,
        "floor": 6,
        "why": "the snapshot/restore/diff that decides what AUTH_CLEAN's byte-identical means",
        "targets": {
            # 🔴 THE SHARED ENUMERATOR. Blinding this one is the seam itself.
            "function walk(root, rel, files, dirs) {": "return;",
            "export function snapshotDir(root) {": "return { root, files: new Map(), dirs: new Set() };",
            "function liveHash(abs, size) {": "return null;",
            "export function restoreDir(snap) {": "return { removed: [], rewritten: [], rmdir: [], failed: [] };",
            "export function diffDir(snap) {":
                "return { added: [], modified: [], missing: [], dirs: [], clean: true };",
            "export function describeDiff(d, limit = 6) {": 'return "nothing";',
        },
    },
    {
        # 🔴 175. `BLIND175 _png.mjs 2 of 2 STILL GREEN`, measured before a line of this
        # entry existed — the suite, both tautology gates, both verdict gates and all
        # three instrument self-tests passed with the module returning constants. Same
        # reason as `_workspace.mjs` a session earlier: it is imported in exactly two
        # places, `authoring-plane.integration.mjs` (boots the editor GUI under Xvfb)
        # and `verify_shot_editor_live.mjs` (needs a real GPU). Neither runs headless.
        #
        # AND WHAT IT DECIDES IS #143's FAILURE. `sampleDistinctColours` returning more
        # than 1 is the entire content of AUTH_SHOT_NOT_UNIFORM — the check separating a
        # rasterizer that drew something from one that initialised and drew nothing. The
        # tool's own label cannot tell those apart: an all-black frame has the right
        # mimeType, the right "(WxH)" note and the right four magic bytes.
        "name": "_png.mjs",
        "src": HOST / "test-integration" / "_png.mjs",
        "gate": ["node", "test-integration/_png.selftest.mjs"],
        "cwd": HOST,
        "floor": 3,
        "why": "the reader that decides whether a rendered frame contains anything at all",
        "targets": {
            "export function decodePng(buf) {": "return null;",
            # 🔴 NOT `return {distinct: 1, …}` — 1 is the FAILING answer, and a blind that
            # injects a failure proves nothing about a gate that is supposed to catch it.
            # The constant has to be the answer a healthy frame gives.
            "export function sampleDistinctColours(img, step = 7) {":
                "return { distinct: 999, sampled: 999 };",
            # 🔴 THIS ONE NEEDED A NEW CASE TO BE CATCHABLE AT ALL. Every paeth assertion
            # in the first draft used a row where the predictor legitimately chooses `a`,
            # so `return a;` round-tripped all of them — a wrong answer of the right type,
            # in the test for the function whose job is to reject exactly that. The
            # PAETH_CHOOSES_ABOVE case exists because this target was written first.
            "function paeth(a, b, c) {": "return a;",
        },
    },
    {
        # 🔴 176, AND MEASURED FIRST — WHICH IS WHY THIS ENTRY READS DIFFERENTLY FROM THE
        # FOUR ABOVE. `BLIND176 0 of 7 STILL GREEN`: every finder in this file reddens its
        # own self-test when blinded. 175 §11.2 handed it over as "finders whose silence
        # would be invisible"; their silence is loud, and the honest description of this
        # entry is a PIN on coverage that already exists rather than a hole being closed.
        #
        # It earns its line anyway, for the reason `_path_ledger.mjs` went in at 0 of 8:
        # coverage measured once is coverage at one commit. The self-test is 78 cases over
        # a classifier whose population is the whole repo, and the failure mode this gate
        # exists for is a case list that stops matching the thing it names — which is
        # exactly what 175 §10 found INSIDE this very self-test, where `probe()` declared
        # `const check = (c, m, d) => {};` and nine cases had been proving the classifier
        # against a stub no probe in the tree resembles.
        "name": "tautology_gate.mjs",
        "src": HOST / "scripts" / "tautology_gate.mjs",
        "gate": ["node", "scripts/tautology_gate.selftest.mjs"],
        "cwd": HOST,
        "floor": 7,
        "why": "the classifier that decides whether a repo-wide assertion could have failed",
        "targets": {
            # The classifier itself. VALUE, not SHAPE — SHAPE is the FAILING answer, and
            # a blind that injects a failure proves nothing about a gate meant to catch it
            # (175's `_png.mjs` reasoning, same trap one file over).
            "export function classifyLeaf(node, src) {": 'return { kind: "VALUE", why: "blind", text: "" };',
            "export function leaves(node, src, out = [], depth = 0) {": "return out;",
            "function collectConsts(src) {": "return [];",
            "function collectAsserters(src) {": "return new Map();",
            # 🔴 175's OWN FIX. This is the resolver that stopped a tool invoker called
            # `check` and a transcript reader called `assertOk` from fabricating seventeen
            # of the host root's twenty-four claim sites.
            "function collectFailers(src) {": "return new Set();",
            "export function analyze(fileName, text) {": "return [];",
            "export function verdict(claims) {": "return { blocks: 0, vacuous: [], every: [], offender: [] };",
        },
    },
    {
        # 🔴 176. THE NEWEST INSTRUMENT IN THE TREE, AND BLINDING IT IS WHAT FOUND THE
        # DEAD `declarations()` — a full AST walk built into `decls` on every file, read
        # by nothing: not `judge()`, not the self-test, not anywhere. It was 1 of 4 still
        # green here and green in scope_gate and instrument_gate too, so the deletion was
        # measured rather than assumed (172's rule) instead of being left alone the way
        # 175 §11.17 left `_check`.
        #
        # `scan()`'s blind returns FOUR healthy-looking subjects on purpose: three would
        # be caught by SUBJECT_FLOOR alone, which would prove the floor rather than the
        # scanner. The constant has to be the answer a healthy tree gives.
        "name": "verdict_gate.mjs",
        "src": HOST / "scripts" / "verdict_gate.mjs",
        "gate": ["node", "scripts/verdict_gate.selftest.mjs"],
        "cwd": HOST,
        "floor": 4,
        "why": "the gate for the ABSENCE of a check — the half no condition-grader can reach",
        "targets": {
            "export function inspect(file, text) {":
                'return { tools: [], readsVerdict: true, exitsNonZero: true, labelsAssert: false };',
            "export function judge(subjects, roster = NOT_A_VERDICT, floor = SUBJECT_FLOOR) {":
                'return { lines: ["VERDICT_GATE ok"], failed: false };',
            "export function scan() {":
                "return [{ f: \"a.mjs\", tools: [\"runtime_assert_x\"], readsVerdict: true, exitsNonZero: true }, "
                "{ f: \"b.mjs\", tools: [\"runtime_assert_x\"], readsVerdict: true, exitsNonZero: true }, "
                "{ f: \"c.mjs\", tools: [\"runtime_assert_x\"], readsVerdict: true, exitsNonZero: true }, "
                "{ f: \"d.mjs\", tools: [\"runtime_assert_x\"], readsVerdict: true, exitsNonZero: true }];",
            # 🔴 176's OWN NEW FINDER. `dropped: false` is the healthy answer — returning
            # an empty list would be caught by DISCARD_SITE_FLOOR, which proves the floor
            # rather than the finder, and those are different instruments.
            "export function discarded(file, text) {":
                'return [{ file, line: 1, tool: "runtime_assert_x", dropped: false }];',
        },
    },
    {
        # 🔴 177. THE INSTRUMENT THAT READS TWO LANGUAGES, WHICH IS ALSO ITS FAILURE MODE.
        # Every other gate here is wrong in one file at a time; this one is wrong when
        # `operations.gd`'s `_ok({…})` spelling drifts, when the addon's dispatcher is
        # rewritten, when `registerTool` is refactored, or when the probe idiom changes —
        # four independent halves, any one of which going quiet leaves the other three
        # reporting a clean tree. That is why `judge()` takes all four populations and why
        # each has its own named collapse.
        #
        # 🔴 `comparisons()` IS BLINDED TO A HEALTHY-LOOKING SITE, NOT TO NOTHING.
        # Returning `[]` would be caught by SITE_FLOOR, which proves the floor rather than
        # the finder — 176's reasoning for `discarded()`, one file over. The blind returns
        # a well-formed site whose receiver resolved to nothing, which is exactly what the
        # gate is entitled to see on a healthy tree.
        "name": "boundary_gate.mjs",
        "src": HOST / "scripts" / "boundary_gate.mjs",
        "gate": ["node", "scripts/boundary_gate.selftest.mjs"],
        "cwd": HOST,
        "floor": 9,   # 🆕 179: helpers() is the ninth, and the reader both 179 rules rest on
        "why": "the tautology that cannot be seen from either side alone — a GDScript constant asserted in JS",
        "targets": {
            "export function dispatchMap(gdText) {": 'return new Map([["a.b", "_a_b"]]);',
            "export function hardwired(gdText) {":
                'return { fields: new Map([["_a_b", new Map([["f", "true"]])]]), opaque: [], reads: 9 };',
            "export function toolOps(sources) {": 'return new Map([["t", "a.b"]]);',
            # 🆕 178. The conduit resolver blinded to "no helper is ever a conduit" — the
            # shape 177 §10.18 declined to build and 178 measured a live defect behind.
            "export function conduits(file, text, h = helpers(file, text)) {": "return new Map();",
            "export function comparisons(file, text, conduit = new Map(), h = helpers(file, text)) {":
                'return [{ file, line: 1, field: "ok", lit: "true", tool: null, drop: null, wouldBe: null, text: "", idiom: "===" }];',
            # 🆕 179. The reader both 179 rules rest on: which locally-defined helpers throw
            # on `isError`. Blinded to "none of them", every direct receiver is refused as
            # nonthrowing and `judged` goes to zero — which is exactly what JUDGED_FLOOR is
            # for, and nothing else in the file could have caught it.
            "export function helpers(file, text) {":
                "return { s: null, bodyOf: new Map(), throwers: new Set(), defined: new Set() };",
            "export function judge(pop, offenders) {":
                'return { lines: ["BOUNDARY_GATE ok"], failed: false };',
            # 🔴 THE COLLAPSE TEST ITSELF. 176 §8's G12 extracted this shape precisely so
            # that a floor set to zero has a case that reddens; blinding it to `false`
            # switches all four floors off at once, and the self-test must notice.
            "export function collapsed(n, floor) {": "return false;",
            # 🆕 178. The composition itself. `run()` and `report()` were extracted in 177
            # so the sweep could reach them; `scan()` is the third of the three, and a
            # blind that returns a healthy-looking population with an empty offender list
            # is precisely the green lie both fixtures exist to catch.
            "export function scan(host = HOST, gdPaths = GD) {":
                'return { pop: { consts: 99, ops: 999, tools: 999, sites: 9999, reads: 999, '
                'planes: 9, opaque: 0, judged: 9, unresolved: 0 }, offenders: [] };',
        },
    },
    {
        # The COMPILED walk rather than the .ts, so this step costs no tsc invocation:
        # `npm test` has already emitted dist-test/ by the time this runs.
        "name": "path-cohort (compiled walk)",
        "src": HOST / "dist-test" / "src" / "path-cohort.js",
        # 🔴 A BUILD ARTEFACT IS ONLY THE INSTRUMENT WHILE IT IS FRESH. Blinding a
        # dist-test/ that predates its own .ts sweeps a walk that is not the one that
        # ships, and reports the result in green. Hit for real in 173: an exploratory
        # harness recompiled per mutation, restored the .ts and left the last mutant
        # sitting in dist-test/.
        "fresher_than": HOST / "src" / "path-cohort.ts",
        "gate": ["node", "--test", "dist-test/test/path_cohort.test.js"],
        "cwd": HOST,
        "floor": 8,
        "why": "the enumerator whose predecessor's number was wrong by 180 rows in two shipped changelogs",
        "targets": {
            "function segments(name) {": "return [];",
            "function nameLooksPathLike(name) {": "return false;",
            "function branchesOf(node) {": "return [];",
            "function isStringy(node) {": "return false;",
            "function childMaps(node) {": "return [];",
            "function describe(schema) {": 'return "";',
            "function walk(tool, props, trail, depth, seen, sink) {": "return;",
            "export function enumeratePathCohort(tools) {": "return [];",
        },
    },
]


def scope_collapsed(n_instruments: int, floor: int) -> bool:
    """The gate's own scope check, as a PURE function of its two numbers.

    🔴 EXTRACTED BECAUSE 176's REVERSE SWEEP FOUND THE FLOOR UNFALSIFIABLE. Setting
    `INSTRUMENT_FLOOR = 0` left this gate entirely GREEN: seven instruments is not fewer
    than zero, and nothing anywhere asserted what the floor was supposed to BE. A literal
    read by one branch and asserted by nothing is a literal anyone can move — which is
    175's G9 (`SUBJECT_FLOOR`) and 176's G11 (the verdict self-test's claim floor), the
    same defect three times in three files, each of them a collapse detector.

    Pinning the value would be circular. Asserting that the BRANCH BITES is not: an
    emptied INSTRUMENTS list must be a collapse whatever the floor says, and with the
    floor at 0 it is not, so the self-check below goes red on exactly the mutant.
    """
    return n_instruments < floor


def _self_check(floor: int) -> list[str]:
    """Run before the sweep. A harness whose own collapse detector is off is not a harness."""
    problems = []
    if not scope_collapsed(0, floor):
        problems.append(
            f"INSTRUMENT_GATE's own floor is {floor}, which does not treat an EMPTY instrument "
            f"list as a collapse. A gate that would sweep nothing and exit 0 is the exact "
            f"shape this file exists to catch, one level up"
        )
    if scope_collapsed(len(INSTRUMENTS), floor):
        problems.append(
            f"INSTRUMENT_GATE's floor is {floor} but only {len(INSTRUMENTS)} instrument(s) are "
            f"listed — raise the list or lower the literal ON PURPOSE"
        )
    return problems


def green(inst: dict) -> bool:
    """True when the instrument's gate runs GREEN."""
    p = subprocess.run(inst["gate"], capture_output=True, text=True, cwd=str(inst["cwd"]))
    return p.returncode == 0


def blind(text: str, sig: str, empty: str) -> str | None:
    """Inject `empty` as the first statement of the member whose signature is `sig`."""
    idx = text.find("\n  " + sig + " {")
    if idx < 0:
        idx = text.find("\n" + sig)
        if idx < 0:
            return None
    brace = text.find("{", idx)
    if brace < 0:
        return None
    return text[: brace + 1] + f"\n    {empty}  // INSTRUMENT_GATE" + text[brace + 1 :]


def sweep(inst: dict) -> tuple[int, int, list[str]]:
    """(#still-green, #targets, problems). The source is restored whatever happens."""
    src: Path = inst["src"]
    problems: list[str] = []

    if not src.exists():
        return (0, 0, [f"{inst['name']}: {src} does not exist — nothing was tested"])

    stale_src: Path | None = inst.get("fresher_than")
    if stale_src is not None and stale_src.exists() and stale_src.stat().st_mtime > src.stat().st_mtime:
        return (0, 0, [
            f"{inst['name']}: {src.relative_to(ROOT)} is OLDER than {stale_src.relative_to(ROOT)} — "
            f"sweeping it would blind a build artefact that is not the instrument that ships, and "
            f"report the result in green. Rebuild (`npm test`) and re-run"
        ])

    original = src.read_text()
    targets = inst["targets"]
    print(f"\n-- {inst['name']} — {len(targets)}/{inst['floor']} target(s) · gate: {' '.join(inst['gate'])}")

    if len(targets) < inst["floor"]:
        problems.append(
            f"{inst['name']}: TARGET LIST COLLAPSED, {len(targets)} < {inst['floor']} — either a member was "
            f"deleted (lower the literal on purpose) or a signature changed and this file no longer matches "
            f"it, in which case every target below passes over something it stopped testing"
        )

    try:
        # CONTROL. 171 §5's M4: without it a 'caught' mutant means nothing at all.
        if not green(inst):
            return (0, len(targets), [f"{inst['name']}: CONTROL FAILED — the unmutated gate does not pass, so this harness is lying"])
        print("   CONTROL ok — unmutated, the gate passes")

        still_green: list[str] = []
        for sig, empty in targets.items():
            mutant = blind(original, sig, empty)
            if mutant is None:
                problems.append(
                    f"{inst['name']}: SIGNATURE NOT FOUND {sig!r} — this target has been silently skipped, "
                    f"which is the harness going blind rather than the instrument"
                )
                print(f"   🔴 UNMATCHED   {sig}")
                continue
            src.write_text(mutant)
            if green(inst):
                still_green.append(sig)
                print(f"   🔴 STILL GREEN {sig}  ->  {empty[:44]}")
            else:
                print(f"   ok            {sig}")
        return (len(still_green), len(targets), problems + [
            f"{inst['name']}: `{s}` can return the empty its contract promises and the gate stays GREEN — "
            f"'found nothing' and 'did not look' are the same observable ({inst['why']})"
            for s in still_green
        ])
    finally:
        src.write_text(original)


def main() -> int:
    problems: list[str] = []
    # 🔴 THIS GATE'S OWN SCOPE, FIRST. An INSTRUMENTS list quietly emptied to nothing
    # would sweep nothing, report nothing and exit 0 — the exact shape it exists to
    # catch, one level up. taut169, again, again.
    INSTRUMENT_FLOOR = 8   # 177: 7 -> 8, boundary_gate.mjs admitted
    #                        176: 5 -> 7, tautology_gate.mjs and verdict_gate.mjs admitted
    print(f"INSTRUMENT_GATE instruments={len(INSTRUMENTS)} floor={INSTRUMENT_FLOOR}")
    problems.extend(_self_check(INSTRUMENT_FLOOR))
    if scope_collapsed(len(INSTRUMENTS), INSTRUMENT_FLOOR):
        problems.append(
            f"INSTRUMENT_GATE swept {len(INSTRUMENTS)} instrument(s), floor is {INSTRUMENT_FLOOR} — "
            f"a harness whose own target list collapsed sweeps nothing and exits 0"
        )

    for inst in INSTRUMENTS:
        n_green, n_targets, probs = sweep(inst)
        problems.extend(probs)
        # ONE LINE PER INSTRUMENT. A total across all three would let one go blind while
        # the other two covered for it (172 §6, committed by the ledger written to stop it).
        print(f"INSTRUMENT_GATE_BLIND {inst['name']}: {n_green} of {n_targets} STILL GREEN")

    if problems:
        print("")
        for p in problems:
            print(f"🔴 {p}")
        print(
            "\n   Every line above is a finder that can match NOTHING while its gate stays green.\n"
            "   Give the population it derives a LITERAL floor, in the gate that reads it — never a\n"
            "   floor supplied by the same finder (172 §10.21: `len(x) >= len(x)` wearing a disguise).\n"
            "   And if an instrument has no headless gate at all, that is not a clean sweep — it is\n"
            "   an instrument this harness cannot say anything about.\n"
            "\nINSTRUMENT_GATE 🔴 FAILED"
        )
        return 1

    print("\nINSTRUMENT_GATE ok — every instrument collapses LOUDLY")
    return 0


if __name__ == "__main__":
    sys.exit(main())
