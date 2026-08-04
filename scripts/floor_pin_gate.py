#!/usr/bin/env python3
"""floor_pin_gate.py — session 181. EVERY FLOOR IN THE TREE, ASKED WHETHER ITS OWN VALUE
IS PINNED.

180 §7.3's reverse sweep set `SELFTEST_CLAIM_FLOOR = 0` in `_path_ledger.selftest.mjs`
and the file stayed GREEN. A `<` floor with nothing asserting its VALUE can be zeroed
invisibly: the run passes, the population line still prints, and the only thing that
changed is that the floor stopped being one. 180 closed that instance and handed over
§11.3 — *nobody has swept for the rest, and the mutant that finds them is three lines.*

Swept. 🔴 SIX of twenty-five were unpinned, and 180's prediction under-counted in both
directions (176 — the handoff is a hypothesis both ways):

    FLOORS.test · FLOORS."test-integration" · FLOORS.scripts · FLOORS."."
    _workspace.selftest.mjs   SELFTEST_CLAIM_FLOOR
    _population.selftest.mjs  SELFTEST_CLAIM_FLOOR

The first four are the sharp ones. `tautology_gate.selftest.mjs` pins that roster's four
KEYS — `Object.keys(FLOORS).length === 4` and each directory name present — and never a
single value, so `{ test: 0, "test-integration": 0, scripts: 0, ".": 0 }` satisfied every
word of the assertion written to defend it. Those are the same four floors 180 §4
reported as "held at their shipped values" while the gate resolved nothing.

🔴 WHY THIS IS A GATE AND NOT A ONE-OFF AUDIT. Both halves matter, and the second is the
one that would otherwise rot:

  * MUTATE — set each floor's value to 0, run the file that should notice, require red.
  * DISCOVER — find every floor-shaped constant in the shipped tree and fail if one is
    NOT in the table below. A sweep whose target list is hand-maintained goes quiet as
    the tree grows, which is taut169 and 174 §5 in one: an exclusion that costs nothing
    to write is an exclusion nobody re-reads. A floor added tomorrow fails this gate on
    the commit that adds it, and the fix is to sweep it, not to list it as exempt.

A floor cannot be covered by a LIVE reverse sweep, for 180 §8's reason: it is reachable
only from below and the shipped tree is above it by construction, so zeroing one can
never redden a live run. That is precisely why this gate exists in the self-tests' world
rather than the live one.

Run: python3 scripts/floor_pin_gate.py   (a CI step beside the scope and instrument gates)
"""
from __future__ import annotations

import atexit
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOST = ROOT / "host"
S, T = "scripts", "test-integration"

# 🔴 THIS GATE'S OWN SCOPE, FLOORED WITH A LITERAL — scope_gate.py's TARGET_FLOOR for the
# same reason, and `>=` because the list is supposed to grow. 181 measured 25.
TARGET_FLOOR = 40   # 185: 37 -> 40 (the seal-order gate's FILES_FLOOR, SEAL_FLOOR and
                    #      its self-test's own CLAIM_FLOOR)
                    # 184: 36 -> 37 (the caller-shape POPULATION_LINES roster floor)
#                     182: 25 -> 30 (HELPER, CONDUIT, SHAPED, PRECONDITION, CHECKS_RUN)

# (label, file, regex whose group(1) ends immediately before the digits, runner argv)
# The runner is the file that MUST go red when this floor's value is zeroed.
TARGETS: list[tuple[str, str, str, list[str]]] = [
    ("SUBJECT_FLOOR",            f"{S}/verdict_gate.mjs",            r"(export const SUBJECT_FLOOR = )4;",                        [f"{S}/verdict_gate.selftest.mjs"]),
    ("DISCARD_SITE_FLOOR",       f"{S}/verdict_gate.mjs",            r"(export const DISCARD_SITE_FLOOR = )55;",                  [f"{S}/verdict_gate.selftest.mjs"]),
    ("DISCARD_DIR_FLOOR",        f"{S}/verdict_gate.mjs",            r"(export const DISCARD_DIR_FLOOR = )2;",                    [f"{S}/verdict_gate.selftest.mjs"]),
    ("vg.CLAIM_FLOOR",           f"{S}/verdict_gate.selftest.mjs",   r"(const CLAIM_FLOOR = )69;",                                [f"{S}/verdict_gate.selftest.mjs"]),
    ("CONST_FLOOR",              f"{S}/boundary_gate.mjs",           r"(export const CONST_FLOOR = )20;",                         [f"{S}/boundary_gate.selftest.mjs"]),
    ("OP_FLOOR",                 f"{S}/boundary_gate.mjs",           r"(export const OP_FLOOR = )150;",                           [f"{S}/boundary_gate.selftest.mjs"]),
    ("TOOL_FLOOR",               f"{S}/boundary_gate.mjs",           r"(export const TOOL_FLOOR = )150;",                         [f"{S}/boundary_gate.selftest.mjs"]),
    ("SITE_FLOOR",               f"{S}/boundary_gate.mjs",           r"(export const SITE_FLOOR = )1500;",                        [f"{S}/boundary_gate.selftest.mjs"]),
    ("RETURN_FLOOR",             f"{S}/boundary_gate.mjs",           r"(export const RETURN_FLOOR = )150;",                       [f"{S}/boundary_gate.selftest.mjs"]),
    ("PLANE_FLOOR",              f"{S}/boundary_gate.mjs",           r"(export const PLANE_FLOOR = )2;",                          [f"{S}/boundary_gate.selftest.mjs"]),
    ("JUDGED_FLOOR",             f"{S}/boundary_gate.mjs",           r"(export const JUDGED_FLOOR = )150;",                       [f"{S}/boundary_gate.selftest.mjs"]),
    ("HELPER_FLOOR",             f"{S}/boundary_gate.mjs",           r"(export const HELPER_FLOOR = )350;",                       [f"{S}/boundary_gate.selftest.mjs"]),
    ("CONDUIT_FLOOR",            f"{S}/boundary_gate.mjs",           r"(export const CONDUIT_FLOOR = )15;",                       [f"{S}/boundary_gate.selftest.mjs"]),
    ("bg.CLAIM_FLOOR",           f"{S}/boundary_gate.selftest.mjs",  r"(const CLAIM_FLOOR = )130;",                               [f"{S}/boundary_gate.selftest.mjs"]),
    ("UNIT_FLOOR",               f"{S}/tautology_gate.mjs",          r"(export const UNIT_FLOOR = )1200;",                        [f"{S}/tautology_gate.selftest.mjs"]),
    ("ATTRIBUTED_FLOOR",         f"{S}/tautology_gate.mjs",          r"(export const ATTRIBUTED_FLOOR = )2500;",                  [f"{S}/tautology_gate.selftest.mjs"]),
    ("SHAPED_FLOOR",             f"{S}/tautology_gate.mjs",          r"(export const SHAPED_FLOOR = )80;",                        [f"{S}/tautology_gate.selftest.mjs"]),
    ("PRECONDITION_FLOOR",       f"{S}/tautology_gate.mjs",          r"(export const PRECONDITION_FLOOR = )40;",                  [f"{S}/tautology_gate.selftest.mjs"]),
    ("FLOORS.test",              f"{S}/tautology_gate.mjs",          r"(export const FLOORS = \{ test: )2100,",                   [f"{S}/tautology_gate.selftest.mjs"]),
    ("FLOORS.test-integration",  f"{S}/tautology_gate.mjs",          r'("test-integration": )850,',                               [f"{S}/tautology_gate.selftest.mjs"]),
    ("FLOORS.scripts",           f"{S}/tautology_gate.mjs",          r"(scripts: )90, ",                                          [f"{S}/tautology_gate.selftest.mjs"]),
    ('FLOORS."."',               f"{S}/tautology_gate.mjs",          r'("\.": )10 \};',                                           [f"{S}/tautology_gate.selftest.mjs"]),
    # 🆕 183 — THE FILE-COUNT FLOORS, THE PAIR `FLOORS.*` ABOVE COULD NOT COVER. Those
    # four pin claim SITES; these four pin FILES READ, which is the only number that sees
    # a directory walk that stopped admitting sources.
    ("FILE_FLOORS.test",             f"{S}/tautology_gate.mjs",      r"(export const FILE_FLOORS = \{ test: )45,",                [f"{S}/tautology_gate.selftest.mjs"]),
    ("FILE_FLOORS.test-integration", f"{S}/tautology_gate.mjs",      r'(FILE_FLOORS = \{ test: 45, "test-integration": )28,',     [f"{S}/tautology_gate.selftest.mjs"]),
    ("FILE_FLOORS.scripts",          f"{S}/tautology_gate.mjs",      r'("test-integration": 28, scripts: )8,',                    [f"{S}/tautology_gate.selftest.mjs"]),
    ('FILE_FLOORS."."',              f"{S}/tautology_gate.mjs",      r'(scripts: 8, "\.": )12 \};',                               [f"{S}/tautology_gate.selftest.mjs"]),
    # 🆕 185 — THE SEAL-ORDER GATE'S THREE. `FILES_FLOOR` and `SEAL_FLOOR` were reported
    # UNSWEPT by the DISCOVER half on this session's first run, which is 184 §7 happening
    # again on a new file and is that fix still working. `so.CLAIM_FLOOR` is the
    # self-test's own floor — the one that protects the other two, and the one no DISCOVER
    # walk finds because it is not exported.
    ("FILES_FLOOR",              f"{S}/seal_order_gate.mjs",         r"(export const FILES_FLOOR = )10;",                         [f"{S}/seal_order_gate.selftest.mjs"]),
    ("SEAL_FLOOR",               f"{S}/seal_order_gate.mjs",         r"(export const SEAL_FLOOR = )95;",                          [f"{S}/seal_order_gate.selftest.mjs"]),
    ("so.CLAIM_FLOOR",           f"{S}/seal_order_gate.selftest.mjs", r"(const CLAIM_FLOOR = )80;",                               [f"{S}/seal_order_gate.selftest.mjs"]),
    # 186 §3: the coverage floor on the UNANNOUNCED rule's own population. It is the only
    # one of the three seal-order floors that measures how much of the tree the rule can
    # READ, so a probe dropping the section idiom shrinks it without failing anything else.
    ("ANNOUNCED_REGIONS_FLOOR",  f"{S}/seal_order_gate.mjs",         r"(export const ANNOUNCED_REGIONS_FLOOR = )80;",             [f"{S}/seal_order_gate.selftest.mjs"]),
    ("LEDGER_SCOPE.classes",     f"{T}/_path_ledger.mjs",            r"(LEDGER_SCOPE = Object\.freeze\(\{ classes: )7,",          [f"{T}/_path_ledger.selftest.mjs"]),
    ("LEDGER_SCOPE.canaries",    f"{T}/_path_ledger.mjs",            r"(classes: 7, canaries: )2 ",                               [f"{T}/_path_ledger.selftest.mjs"]),
    ("LEDGER_POPULATION.live",   f"{T}/_path_ledger.mjs",            r"(LEDGER_POPULATION = Object\.freeze\(\{ live: )220,",      [f"{T}/_path_ledger.selftest.mjs"]),
    ("LEDGER_POPULATION.ledger", f"{T}/_path_ledger.mjs",            r"(live: 220, ledger: )220 ",                                [f"{T}/_path_ledger.selftest.mjs"]),
    ("pl.SELFTEST_CLAIM_FLOOR",  f"{T}/_path_ledger.selftest.mjs",   r"(const SELFTEST_CLAIM_FLOOR = )30;",                       [f"{T}/_path_ledger.selftest.mjs"]),
    ("ws.SELFTEST_CLAIM_FLOOR",  f"{T}/_workspace.selftest.mjs",     r"(const SELFTEST_CLAIM_FLOOR = )48;",                       [f"{T}/_workspace.selftest.mjs"]),
    ("pop.SELFTEST_CLAIM_FLOOR", f"{T}/_population.selftest.mjs",    r"(const SELFTEST_CLAIM_FLOOR = )46;",                       [f"{T}/_population.selftest.mjs"]),
    # 🔴 182 — THE FIRST FLOOR IN THIS TABLE THAT IS NOT JAVASCRIPT. `scripts/` was walked
    # for `.mjs` only, so a Python floor was outside the DISCOVER half by construction and
    # nobody would have been told. That is the shape 174 §5 names: an exclusion nobody
    # wrote down is an exclusion nobody re-reads.
    ("CHECKS_RUN_FLOOR",         "../scripts/contract_check.py",     r"(CHECKS_RUN_FLOOR = )20 ",                                 ["../scripts/contract_check.py"]),
    # 🆕 183 — AND THE FIRST TWO FLOORS THIS TABLE HAS EVER HELD THAT MIRROR AN EXEMPT
    # ONE. `AUTH_SNAPSHOT_FILE_FLOOR` / `_DIR_FLOOR` are four lines up in DISCOVER_EXEMPT
    # because no headless runner can redden a probe that boots the editor. These two are
    # the SAME NUMBERS in the headless caller-shape harness, so the pair that could not be
    # swept now has a swept twin — which is the point of the harness stated as a floor.
    ("SHAPE_SNAPSHOT_FILE_FLOOR", f"{T}/_caller_shape.harness.mjs",  r"(const SHAPE_SNAPSHOT_FILE_FLOOR = )70;",                  [f"{T}/_caller_shape.harness.mjs"]),
    ("SHAPE_SNAPSHOT_DIR_FLOOR",  f"{T}/_caller_shape.harness.mjs",  r"(const SHAPE_SNAPSHOT_DIR_FLOOR = )8;",                    [f"{T}/_caller_shape.harness.mjs"]),
    # 🆕 184 — THE HARNESS'S OWN ROSTER, WHICH IS 183 §9's `LATE_LIVE` FINDING ONE FILE
    # OVER: three Population instances drive three shapes, and deleting one took its claims
    # with it while every other number still read ok. A roster AND a floor, so zeroing the
    # floor has to redden the runner that reads it.
    ("POPULATION_LINES_FLOOR",    f"{T}/_caller_shape.harness.mjs",  r"(const POPULATION_LINES_FLOOR = )3;",                      [f"{T}/_caller_shape.harness.mjs"]),
]

# ── the DISCOVERY half ────────────────────────────────────────────────────────────
# Files walked for floor-shaped constants. Anything found here and absent from TARGETS
# is a gate failure, so the table above cannot silently fall behind the tree.
DISCOVER_DIRS = [HOST / "scripts", HOST / "test-integration"]
DISCOVER_RE = re.compile(r"^\s*(?:export )?const ([A-Za-z_][A-Za-z0-9_]*FLOOR)\s*=\s*\d+", re.M)
# 🔴 182 — AND THE SAME WALK IN PYTHON, BECAUSE THE FIRST DRAFT'S SCOPE WAS THE LANGUAGE
# AND NOT THE PROPERTY. `scripts/*.mjs` was walked; `scripts/*.py` was not, so a floor
# written in Python was outside this gate by construction and no line said so — the
# DISCOVER half rotting in a direction its own docstring promises it cannot.
DISCOVER_PY_DIRS = [ROOT / "scripts"]
DISCOVER_PY_RE = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*FLOOR)\s*[:=][^=]*?=?\s*\d+", re.M)

# Floors that live in a file no headless runner exercises. Each needs a REASON, not a
# name — 174 §5: an exclusion that costs nothing to write is one nobody re-reads.
DISCOVER_EXEMPT: dict[str, str] = {
    "AUTH_SNAPSHOT_FILE_FLOOR": "authoring-plane.integration.mjs — boots the editor GUI under Xvfb; no headless runner can redden it",
    "AUTH_SNAPSHOT_DIR_FLOOR": "same file, same reason",
    "AUTH_FAMILY_FLOOR": "same file, same reason",
    "AUTH_CLAIM_FLOOR": "same file, same reason",
    "GD_DAP_CLAIM_FLOOR": "gdscript-dap-plane.integration.mjs — needs a real Godot binary and a live DAP session",
    # 🔴 182 — THE THREE A GATE HOLDS OVER ITS OWN ROSTER. Mutating one here would mean
    # running that gate as a step of this one: `instrument_gate.py` is 34s and mutates the
    # working tree, and `scope_gate.py` is 90s and does too, so nesting them would break
    # 178 §11.4's rule that the three mutating gates never run concurrently. Each is
    # instead pinned WHERE IT LIVES, and that is stated rather than assumed:
    "INSTRUMENT_FLOOR": "instrument_gate.py's own roster floor — pinned in-file by `_self_check()`, "
                        "which asserts the collapse branch BITES at 0 (176's G12 shape). Running it "
                        "here would nest one tree-mutating gate inside another (178 §11.4)",
    "LATE_CONSTRUCTED_FLOOR": "instrument_gate.py's floor on its own second axis — pinned in the "
                              "same `_self_check()`, which fails if it is not positive, because a "
                              "zero would re-permit an injector that injects nothing. Same nesting "
                              "reason as INSTRUMENT_FLOOR",
    "LATE_LIVE_FLOOR": "🆕 183 — instrument_gate.py's floor on the LIVE-axis roster, pinned in the "
                       "same `_self_check()` by asserting the branch bites on an empty roster. It "
                       "exists because LATE_CONSTRUCTED_FLOOR cannot see a roster shrink: deleting "
                       "the three caller-shape entries takes 82 constructed blinds to 70, which is "
                       "still above that floor. Same nesting reason as INSTRUMENT_FLOOR",
    "TARGET_FLOOR": "the same shape in scope_gate.py and in THIS file — a gate cannot pin the floor "
                    "over its own target list without reading the constant it is checking. scope_gate "
                    "asserts its branch bites; this file's is the one below, and a session that "
                    "deletes a TARGETS line without lowering it gets FLOOR_PIN_TARGETS_COLLAPSE",
}


def run(argv: list[str]) -> bool:
    """🔴 THE INTERPRETER FOLLOWS THE FILE, NOT THE TABLE. `["node", *argv]` was hard-wired
    while every target happened to be JavaScript; the first Python floor (182's
    CHECKS_RUN_FLOOR) would have been run through node and reported as a catch — a syntax
    error and a violation being one observable, which is 181 §4 in a third spelling."""
    if argv and argv[0].endswith(".py"):
        p = subprocess.run([sys.executable, *argv], capture_output=True, text=True, cwd=str(HOST))
    else:
        p = subprocess.run(["node", *argv], capture_output=True, text=True, cwd=str(HOST))
    return p.returncode == 0


ORIGINALS: dict[Path, str] = {}


@atexit.register
def _restore() -> None:
    for p, t in ORIGINALS.items():
        if p.read_text() != t:
            p.write_text(t)


def main() -> int:
    failed = False
    print(f"FLOOR_PIN_GATE targets={len(TARGETS)} floor={TARGET_FLOOR}")

    if len(TARGETS) < TARGET_FLOOR:
        print(f"🔴 FLOOR_PIN_TARGETS_COLLAPSE {len(TARGETS)} < {TARGET_FLOOR} — this gate's own\n"
              "   roster shrank. Either a floor was deleted (lower the literal on purpose), or a\n"
              "   line was dropped and every floor below it is now unswept.")
        failed = True

    # ── DISCOVERY: is any floor in the tree missing from the table above? ──────────
    known = {lbl.split(".")[-1] for lbl, *_ in TARGETS} | {lbl for lbl, *_ in TARGETS}
    known |= {"SELFTEST_CLAIM_FLOOR", "CLAIM_FLOOR"}   # covered under file-qualified labels
    unswept: list[str] = []
    for d in DISCOVER_DIRS:
        for f in sorted(d.rglob("*.mjs")):
            if "_to_delete" in f.parts:
                continue
            for name in DISCOVER_RE.findall(f.read_text()):
                if name in known or name in DISCOVER_EXEMPT:
                    continue
                unswept.append(f"{f.relative_to(HOST)}:{name}")
    for d in DISCOVER_PY_DIRS:                        # 🆕 182 — the other language
        for f in sorted(d.rglob("*.py")):
            if "_to_delete" in f.parts:
                continue
            for name in DISCOVER_PY_RE.findall(f.read_text()):
                if name in known or name in DISCOVER_EXEMPT:
                    continue
                unswept.append(f"{f.relative_to(ROOT)}:{name}")
    print(f"FLOOR_PIN_DISCOVERED unswept={len(unswept)} exempt={len(DISCOVER_EXEMPT)}")
    if unswept:
        failed = True
        print("🔴 FLOOR_PIN_UNSWEPT a floor-shaped constant exists that this gate does not test:\n"
              + "".join(f"     {u}\n" for u in unswept)
              + "   Add it to TARGETS with the runner that should redden — or to DISCOVER_EXEMPT\n"
                "   with a reason a reader could not mistake for 'not done yet'.")

    # ── CONTROL: every runner passes unmutated, or a 'reddens' below means nothing ──
    runners = sorted({tuple(t[3]) for t in TARGETS})
    for r in runners:
        if not run(list(r)):
            print(f"🔴 FLOOR_PIN_CONTROL {r[0]} does not pass unmutated — the harness is lying, stop.")
            return 1
    print(f"FLOOR_PIN_CONTROL ok — all {len(runners)} runner(s) pass unmutated")

    # ── MUTATE: zero each floor's VALUE and require its runner to go red ───────────
    unpinned: list[str] = []
    for label, rel, rx, runner in TARGETS:
        p = HOST / rel
        text = ORIGINALS.setdefault(p, p.read_text())
        n = len(re.findall(rx, text))
        if n != 1:
            failed = True
            print(f"🔴 FLOOR_PIN_ANCHOR {label}: matched {n} time(s), not once — this row tests NOTHING.\n"
                  "   A regex that stops matching is 180 §9.3's trap: the sweep reports a clean pass\n"
                  "   over a floor it never touched. Re-anchor it; do not delete the row.")
            continue
        m = re.search(rx, text)
        start = end = m.end(1)
        while text[end].isdigit():
            end += 1
        try:
            p.write_text(text[:start] + "0" + text[end:])
            green = run(runner)
        finally:
            p.write_text(text)
        if green:
            unpinned.append(label)
            print(f"🔴 FLOOR_PIN_UNPINNED {label} -> 0 and {Path(runner[0]).name} STAYS GREEN")
        else:
            print(f"  ok   {label:<28} -> 0 reddens {Path(runner[0]).name}")

    print(f"FLOOR_PIN_UNPINNED_COUNT {len(unpinned)} of {len(TARGETS)}")
    if unpinned:
        failed = True
        print("\n🔴 The floor(s) above can be set to ZERO with nothing going red. A floor whose own\n"
              "   value nobody asserts is not a floor — it is a number, and the run that deletes it\n"
              "   passes. Pin it in the self-test with an EXACT comparison, the way\n"
              "   `verdict_gate.selftest.mjs` writes `SUBJECT_FLOOR === 4`. A `>=` bound that the\n"
              "   value trivially satisfies (`CONST_FLOOR >= 0` over a count) is not a pin.")

    if failed:
        print("\nFLOOR_PIN_GATE 🔴 FAILED")
        return 1
    print(f"\nFLOOR_PIN_GATE ok — all {len(TARGETS)} floor(s) zeroed, each reddened its runner, "
          f"and no unswept floor exists in the tree")
    return 0


if __name__ == "__main__":
    sys.exit(main())
