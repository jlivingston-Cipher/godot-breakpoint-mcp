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
    INSTRUMENT_FLOOR = 4
    print(f"INSTRUMENT_GATE instruments={len(INSTRUMENTS)} floor={INSTRUMENT_FLOOR}")
    if len(INSTRUMENTS) < INSTRUMENT_FLOOR:
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
