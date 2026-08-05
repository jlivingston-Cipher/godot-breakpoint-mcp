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
TARGET_FLOOR = 50   # 🔴 190 — AND IT IS MOVED BY HAND ON PURPOSE, which is the half of
                    #      189 §32's complaint that turns out to be wrong. That note asked
                    #      why this literal is not derived from the count the gate prints
                    #      one line below it. Because a floor that protects a LIST'S SIZE
                    #      cannot be read off that list: `TARGET_FLOOR = len(TARGETS)` is
                    #      satisfied by every deletion, which is exactly the event it
                    #      exists to catch. 176's rule, one level up.
                    # 194: 49 -> 50 (SECTION_ATTRIBUTED_FLOOR — the SECOND fallback under
                    #      the same subtraction. 193's argument, one path later: with two
                    #      fallbacks under one ceiling, either can die while the other's
                    #      growth keeps the total healthy)
                    # 193: 48 -> 49 (BANNER_ATTRIBUTED_FLOOR — the section-banner
                    #      fallback counted as its own population, because the ceiling
                    #      above it is a subtraction and a subtraction cannot say the
                    #      path RAN)
                    # 191: 46 -> 48 (ALIAS_BINDINGS_FLOOR — the floor UNDER the fifth
                    #      rule's ceiling, needed the moment that ceiling went to zero —
                    #      and ORPHAN_CEILING, 180 §11.4's nine-session complaint)
                    # 190: 45 -> 46 (the fifth rule's ALIAS_BLIND_CEILING)
                    # 189: 43 -> 45 (the region rule's REGION_FILES_FLOOR and the first
                    #      CEILING in this table, SILENT_REGIONS_CEILING)
                    # 187: 41 -> 43 (the marker rule's MARKER_HEADER_FILES_FLOOR and
                    #      HEADER_FAMILY_FLOOR, both swept by the seal-order self-test)
                    # 185: 37 -> 40 (the seal-order gate's FILES_FLOOR, SEAL_FLOOR and
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
    ("so.CLAIM_FLOOR",           f"{S}/seal_order_gate.selftest.mjs", r"(const CLAIM_FLOOR = )141;",                              [f"{S}/seal_order_gate.selftest.mjs"]),
    # 🆕 187 — the marker rule's two, and BOTH are swept here rather than exempted,
    # because their runner is a self-test that touches nothing. That is the difference
    # between these and control_gate.py's pair four entries down in DISCOVER_EXEMPT: the
    # exemption there is bought by tree mutation, not by the floor being any less real.
    ("MARKER_HEADER_FILES_FLOOR", f"{S}/seal_order_gate.mjs",         r"(export const MARKER_HEADER_FILES_FLOOR = )9;",           [f"{S}/seal_order_gate.selftest.mjs"]),
    ("HEADER_FAMILY_FLOOR",      f"{S}/seal_order_gate.mjs",          r"(export const HEADER_FAMILY_FLOOR = )85;",                [f"{S}/seal_order_gate.selftest.mjs"]),
    # 186 §3: the coverage floor on the UNANNOUNCED rule's own population. It is the only
    # one of the three seal-order floors that measures how much of the tree the rule can
    # READ, so a probe dropping the section idiom shrinks it without failing anything else.
    ("ANNOUNCED_REGIONS_FLOOR",  f"{S}/seal_order_gate.mjs",         r"(export const ANNOUNCED_REGIONS_FLOOR = )73;",             [f"{S}/seal_order_gate.selftest.mjs"]),
    # 🆕 189 — THE FOURTH RULE'S PAIR, AND THE SECOND OF THEM IS A CEILING, WHICH IS THE
    # FIRST ENTRY IN THIS TABLE HELD FROM ABOVE. The sweep does not care which direction a
    # pinned literal is read in — it moves it and demands a red — so a ceiling costs the
    # same one row a floor does, and 180 §11.4's seven-session complaint about a number
    # floored from one side only cost nothing at all to answer here.
    ("REGION_FILES_FLOOR",       f"{S}/seal_order_gate.mjs",         r"(export const REGION_FILES_FLOOR = )9;",                   [f"{S}/seal_order_gate.selftest.mjs"]),
    ("SILENT_REGIONS_CEILING",   f"{S}/seal_order_gate.mjs",         r"(export const SILENT_REGIONS_CEILING = )5;",               [f"{S}/seal_order_gate.selftest.mjs"]),
    # 🆕 190 — THE FIFTH RULE'S CEILING, and the SECOND one held from above. 189 §9.2's
    # instruction was to measure before widening the claim finder's regex; the measurement
    # found the unreadable `.assert` alias in exactly one binding out of nineteen and in
    # ZERO probes, so the finder was left alone and the blind spot was pinned instead.
    # A ceiling is the only shape that can pin a blind spot: a floor on it would be
    # satisfied by growing it.
    # 🆕 191 — AND IT IS ZERO NOW. 190 shipped it at 1 for the one binding the harness held
    # on purpose and warned, in its own §9.2, that a ceiling nobody can act on is worse than
    # none. The harness now claims through `sealPop.assert.ok`, which the finder reads, so
    # the tree holds no unreadable binding anywhere and the ceiling is a hard zero.
    ("ALIAS_BLIND_CEILING",      f"{S}/seal_order_gate.mjs",         r"(export const ALIAS_BLIND_CEILING = )0;",                  [f"{S}/seal_order_gate.selftest.mjs"]),
    # 🆕 191 — THE FLOOR UNDER THAT CEILING, which is a DIFFERENT target and not a variant
    # of it. A ceiling at zero is satisfied by a detector that finds nothing; only a floor
    # on the total binding population can tell "nothing unreadable" from "nothing read".
    # 190 §30's rule — a rule with zero offenders is honest only if its population was
    # counted separately — with the counting itself pinned.
    ("ALIAS_BINDINGS_FLOOR",     f"{S}/seal_order_gate.mjs",         r"(export const ALIAS_BINDINGS_FLOOR = )14;",                [f"{S}/seal_order_gate.selftest.mjs"]),
    # 🆕 191 — AND THE ONE 180 §11.4 ASKED FOR NINE SESSIONS AGO. `orphan = sites -
    # attributed` was printed from 170 and floored by nothing; `ATTRIBUTED_FLOOR` bounds it
    # only if `sites` is pinned too, and `sites` is free to grow. A ceiling, for the same
    # reason as the two above, and pinned exactly rather than with headroom.
    # 🔴 193 — THE ANCHOR TAKES `\d+`, AND THIS IS THE SECOND ROW IN THE TABLE TO EARN IT.
    # 192 §6 gave `CHECKS_RUN_FLOOR` a `\d+` anchor because its value is asserted EQUAL to
    # something the tree computes, so the act the control guards moves it. This ceiling is
    # the other shape with the same consequence: it is pinned EXACTLY on the live orphan
    # count, so every session that changes attribution moves it BY DESIGN — 509 → 147 → 148
    # in one session here. An anchor embedding the value would test nothing the moment the
    # rule it guards did its job, which is what it did on this session's first run.
    ("ORPHAN_CEILING",           f"{S}/tautology_gate.mjs",          r"(export const ORPHAN_CEILING = )\d+;",                    [f"{S}/tautology_gate.selftest.mjs"]),
    # 🔴 THE POSITIVE SIDE OF THE SAME FACT (193 §9.3). The ceiling says few claims are
    # orphans; it does not say the banner path RAN. Both would survive an `enclosingTest`
    # that stopped reading banners on a tree that had meanwhile grown `test()` blocks.
    # 🔴 194 — THE THIRD ANCHOR IN THIS TABLE TO EARN A `\d+`, AND FOR THE SAME REASON THE
    # FIRST TWO DID. It embedded `300;` and this session took the floor to 15, so the anchor
    # matched zero times on the first run — 192 §6's `CHECKS_RUN_FLOOR`, 193 §8's
    # `ORPHAN_CEILING`, and now this. The pattern is not "some anchors are unlucky": an
    # anchor that embeds a floor's VALUE is pinned to a number the tree is expected to move,
    # and every floor in this table is such a number. See §9 in the handoff.
    ("BANNER_ATTRIBUTED_FLOOR",  f"{S}/tautology_gate.mjs",          r"(export const BANNER_ATTRIBUTED_FLOOR = )\d+;",            [f"{S}/tautology_gate.selftest.mjs"]),
    ("SECTION_ATTRIBUTED_FLOOR", f"{S}/tautology_gate.mjs",          r"(export const SECTION_ATTRIBUTED_FLOOR = )\d+;",           [f"{S}/tautology_gate.selftest.mjs"]),
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
    # 🔴 192 — `\d+` RATHER THAN THE VALUE, AND THIS ROW ALONE. Adding check 23 to
    # CHECKS_EXPECTED moved this floor 20 -> 21 and the anchor matched ZERO times:
    # `FLOOR_PIN_ANCHOR CHECKS_RUN_FLOOR: matched 0 time(s)`. The guard worked; the anchor
    # was wrong. It is the SECOND instrument this one edit broke — `control_gate.py`'s
    # `22.floor` row went the same way and took the `{CHECKS}` placeholder — and the two
    # together are a class: an instrument anchored on a number the tree DERIVES elsewhere
    # is pinned to a moment (188 §2, one level up from the release ritual).
    #
    # WHY ONLY THIS ROW. Every other anchor here embeds the floor's OWN value, which moves
    # only when somebody deliberately moves that floor — and the DISCOVER half catches
    # that in the same run. This floor is the one value in the table asserted EQUAL to
    # something else (`CHECKS_RUN_FLOOR != len(_expected_set)` is check 22's own first
    # statement), so it moves for reasons that have nothing to do with this table.
    ("CHECKS_RUN_FLOOR",         "../scripts/contract_check.py",     r"(CHECKS_RUN_FLOOR = )\d+ ",                                ["../scripts/contract_check.py"]),
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
# 🔴 197 — AND `CEILING` TOO, WHICH IS 183 §12.29's RULE PAID A THIRTEENTH TIME.
# 182 widened this half from `.mjs` to `.py` after finding it scoped to a LANGUAGE rather
# than to the property. It was still scoped to a WORD: three ceilings live in TARGETS
# already (`SILENT_REGIONS_CEILING`, `ALIAS_BLIND_CEILING`, `ORPHAN_CEILING`), each put
# there by hand, and a fourth written today would have been outside this gate by
# construction with no line saying so. A floor and a ceiling are the same object read from
# opposite sides; the discovery half now says so. Measured before widening: 3 mjs ceilings
# and 1 py ceiling exist, all four already swept or exempt, so this costs no new work and
# closes the direction the name did not cover.
DISCOVER_RE = re.compile(
    r"^\s*(?:export )?const ([A-Za-z_][A-Za-z0-9_]*(?:FLOOR|CEILING))\s*=\s*\d+", re.M)
# 🔴 182 — AND THE SAME WALK IN PYTHON, BECAUSE THE FIRST DRAFT'S SCOPE WAS THE LANGUAGE
# AND NOT THE PROPERTY. `scripts/*.mjs` was walked; `scripts/*.py` was not, so a floor
# written in Python was outside this gate by construction and no line said so — the
# DISCOVER half rotting in a direction its own docstring promises it cannot.
DISCOVER_PY_DIRS = [ROOT / "scripts"]
# 🔴 197 — AND A FLOOR-SHAPED NAME BOUND TO A DICT IS STILL A FLOOR. `BLAST_FLOOR` in
# instrument_gate.py is nine per-instrument floors in one mapping (172 §6: one line per
# instrument, never summed). Under `\d+` this half could not see it at all, so it would
# have needed an exemption reading "the regex cannot read it" — which is an exclusion
# bought by the excluder's own limitation. Accepting `{` costs one alternation.
DISCOVER_PY_RE = re.compile(
    r"^\s*([A-Za-z_][A-Za-z0-9_]*(?:FLOOR|CEILING))\s*[:=][^=]*?=?\s*(?:\d|\{)", re.M)

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
    # 🆕 197 — instrument_gate.py's fifth and sixth, same nesting reason as the four above.
    "CRASH_CEILING": "🆕 197 — instrument_gate.py's CEILING on how many blinds go red WITHOUT the "
                     "gate reaching its own verdict, i.e. crash it instead of failing it. It is the "
                     "first thing this gate discovers under 197's `CEILING` widening rather than "
                     "under `FLOOR`, and it is exempt for INSTRUMENT_FLOOR's reason: its runner "
                     "would be instrument_gate.py, which mutates the working tree. Pinned in the "
                     "same `_self_check()`, which feeds `crash_problems` a two-crash fixture over a "
                     "ceiling of one and requires it to bite",
    "BLAST_FLOOR": "🆕 197 — instrument_gate.py's PER-INSTRUMENT floors on how many failure lines "
                   "each instrument's blinds actually produce (172 §6: one line each, never summed). "
                   "A DICT rather than a literal, which is why the PY regex above now accepts `{`: "
                   "an exemption reading 'the discovery regex cannot read it' would be an exclusion "
                   "bought by the excluder's own limitation. It is exempt for INSTRUMENT_FLOOR's "
                   "reason instead — its runner mutates the working tree — and pinned in-file by "
                   "`_self_check()`, which requires every value positive, plus a `main()` assertion "
                   "that the roster names every instrument and no others",
    # 🆕 198 — instrument_gate.py's seventh and eighth, both on its LATE axis, same nesting
    # reason as the six above. 197 §8.3 fixed `green()` on the primary axis and left
    # `run_counting()` reading a return code; these two are what the fixed runner compares.
    "LATE_BLAST_FLOOR": "🆕 198 — instrument_gate.py's PER-INSTRUMENT floors on the LATE axis's "
                        "blast radius, the `A:gate` half only. A dict, read by 197's `{` widening, "
                        "and exempt for INSTRUMENT_FLOOR's reason: its runner mutates the working "
                        "tree. Pinned in-file by `_self_check()`, which requires every value "
                        "positive, plus a `main()` assertion that no entry names a missing "
                        "instrument. 🔴 THE `B:live` HALF IS DELIBERATELY ABSENT rather than "
                        "pending: four of that axis's five commands report by collapsing a "
                        "population and print no per-claim FAIL line at all, so every floor there "
                        "would be a floor at zero — the shape this table's own entries refuse",
    "LATE_NOT_LOADED_CEILING": "🆕 198 — instrument_gate.py's CEILING on late mutants that produced "
                        "no `LATE_BLIND_CALLS` line AT ALL, meaning the mutant never loaded. It is "
                        "ZERO and is measured zero: all 118 mutant runs across both axes hooked. "
                        "🔴 A CEILING AT ZERO WITH NO LIVE ROW IS EXACTLY 197 §3's HOLE — a mutant "
                        "that did not compile was filed 'not constructible' and reported green — "
                        "so it is fed a one-row fixture in `_self_check()` rather than trusted to "
                        "the tree, and exempt here for INSTRUMENT_FLOOR's nesting reason",
    "SIG_RESOLVED_FLOOR": "🆕 195 — instrument_gate.py's floor on how many of its target anchors are "
                       "`{SIG:name}` PLACEHOLDERS rather than literal signatures. It is a third "
                       "collapse the two floors above cannot see: replacing a placeholder with the "
                       "signature it resolves to today changes no printed line, no verdict and no "
                       "blind — it only puts that row back on an expiry date, and the class arrived "
                       "one row at a time. Pinned in the same `_self_check()`, which asserts the "
                       "branch bites at 0. Same nesting reason as INSTRUMENT_FLOOR",
    # 🆕 187 — control_gate.py's two, and they are the same nesting problem a third time.
    # Its runner would be control_gate.py itself, which MUTATES THE WORKING TREE (it breaks
    # example/project.godot, README.md, a lockfile field and a tool name in turn), so
    # sweeping them here would run one tree-mutating gate inside another — 178 §11.4, the
    # rule INSTRUMENT_FLOOR is exempt under four lines up.
    "CONTROLLED_FLOOR": "control_gate.py's floor on the number of failure statements that have a "
                        "positive control — pinned in-file by `_self_check()`, which fails if the "
                        "value is not positive, because a zero would leave `controls_low` unable to "
                        "bite and the gate green over an emptied CONTROLS table. Same nesting reason "
                        "as INSTRUMENT_FLOOR",
    "STATEMENT_FLOOR": "control_gate.py's floor on the DENOMINATOR — the count of errors.append "
                       "statements in contract_check.py. It exists because '17 of 70' improves to "
                       "'17 of 17' by deleting sixty-eight checks, so the numerator's floor cannot "
                       "see the failure this one names. Pinned in the same `_self_check()`, same "
                       "nesting reason as INSTRUMENT_FLOOR",
    "UNFINGERPRINTABLE_FLOOR": "control_gate.py's floor on what it CANNOT see — the statements "
                        "carrying no string literal of their own, which no fingerprint can ever "
                        "name (188 §4). Floored from below so the set cannot shrink by rewording, "
                        "and pinned in the same `_self_check()` as the two above it. Same nesting "
                        "reason as INSTRUMENT_FLOOR: its runner mutates the working tree",
    # 🆕 196 — control_gate.py's fourth and fifth, and they are TWO because 194 §33 said a
    # subtraction over more than one contributor needs two numbers. `BLAST_TOTAL_FLOOR` is
    # what the mutations DO; `ALSO_ATTRIBUTED_FLOOR` is how much of that the reader can
    # EXPLAIN. Either can collapse while the other holds — a rewording that breaks the
    # attributor moves only the second, and a control going quiet moves only the first.
    "BLAST_TOTAL_FLOOR": "🆕 196 — control_gate.py's floor on the TOTAL number of FAIL lines its "
                        "fifty-six mutations produce (103). Every row now declares its own count "
                        "and the gate compares them, but a per-row equality is edited one row at a "
                        "time: a control that stops reddening is absorbed by updating its "
                        "declaration, and nothing would notice the gate as a whole going quieter. "
                        "This is the number that notices. Pinned in the same `_self_check()`, same "
                        "nesting reason as INSTRUMENT_FLOOR — its runner mutates the working tree",
    # 🆕 197 — scope_gate.py's TWO, and the same nesting reason a fourth time: its runner
    # would be scope_gate.py, which writes `_scope_gate_mutant.py` twenty-six times.
    # 🔴 THE FIRST IS NAMED `SCOPE_` ON PURPOSE. It was written as `BLAST_TOTAL_FLOOR` —
    # the same name control_gate's carries — and this table is keyed by BARE NAME, so it
    # would have been silently covered by an exemption whose text names a different file.
    # An exemption that reads as covering something it never mentioned is 174 §5 wearing
    # the right words, and the fix is on the constant rather than on the table.
    "SCOPE_BLAST_TOTAL_FLOOR": "🆕 197 — scope_gate.py's floor on the TOTAL number of FAIL lines its "
                        "twenty-five blinded runs produce (53). Same argument as control_gate's "
                        "BLAST_TOTAL_FLOOR below: each row declares its own count and the gate "
                        "compares them, but a per-row equality is edited one row at a time. Pinned "
                        "in scope_gate's own `_self_check()`, which fails if it is not positive",
    "LEDGER_COLLAPSE_FLOOR": "🆕 197 — scope_gate.py's floor on how many SCOPE-LEDGER populations "
                        "its blinds actually collapse (29 across 25 rows). It is a DIFFERENT "
                        "collapse from the one above and that is the whole finding: three rows "
                        "reddened the run without collapsing any ledger population at all, so they "
                        "were caught by a parse guard rather than by the ledger the gate exists to "
                        "defend. A FAIL-line total cannot see that; this number is what does. "
                        "Pinned in the same `_self_check()`",
    "ALSO_ATTRIBUTED_FLOOR": "🆕 196 — control_gate.py's floor on its DIAGNOSIS rather than its "
                        "verdict: how many of those FAIL lines resolve to a named check (98 of "
                        "103). The verdict deliberately does NOT rest on this reader — it is 95% "
                        "right and an assertion resting on it would be 194 §4 shipped — but the "
                        "failure message's ability to say WHICH check arrived does. Floored so the "
                        "attributor cannot quietly stop working while every row still passes. "
                        "Pinned in the same `_self_check()`, same nesting reason",
    "STATEMENT_ATTRIB_FLOOR": "scope_gate.py's floor on how many of contract_check.py's failure "
                        "statements its own twenty-five blinded runs EXECUTE (188 §5, re-derived "
                        "at 19 after control_gate.py had stated 23 for two sessions). Not swept "
                        "here because its runner is scope_gate.py itself, which writes a mutant "
                        "copy of contract_check.py into scripts/ — the same nesting rule. Pinned "
                        "in that file's `_self_check()`, which fails if it is not positive",
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
    # 🔴 197 — AND THE OTHER HALF OF THE EXEMPTION TABLE, WHICH DID NOT EXIST (182's rule,
    # unpaid here). `DISCOVER_EXEMPT` was read in ONE direction: a name found in the tree
    # and present here was skipped. A name present here and found NOWHERE was skipped too —
    # silently — so an exemption outlives the constant it excuses, and the table gets longer
    # and less true one deleted floor at a time. It is also what made this session's
    # `CEILING` widening unfalsifiable: narrow the regex back to `FLOOR` and `CRASH_CEILING`
    # simply stops being discovered, with its exemption still sitting here reading as live.
    # 174 §5 is the rule and this is its enforcement: an exclusion nobody re-reads.
    seen_names: set[str] = set()
    for d in DISCOVER_DIRS:
        for f in sorted(d.rglob("*.mjs")):
            if "_to_delete" not in f.parts:
                seen_names.update(DISCOVER_RE.findall(f.read_text()))
    for d in DISCOVER_PY_DIRS:
        for f in sorted(d.rglob("*.py")):
            if "_to_delete" not in f.parts:
                seen_names.update(DISCOVER_PY_RE.findall(f.read_text()))
    stale = sorted(n for n in DISCOVER_EXEMPT if n not in seen_names)
    print(f"FLOOR_PIN_DISCOVERED unswept={len(unswept)} exempt={len(DISCOVER_EXEMPT)} "
          f"stale-exempt={len(stale)}")
    if stale:
        failed = True
        print("🔴 FLOOR_PIN_STALE_EXEMPT this table excuses a constant that no longer exists\n"
              "   anywhere the DISCOVER half can see:\n"
              + "".join(f"     {n}\n" for n in stale)
              + "   Either the constant was deleted (delete its exemption in the same commit),\n"
                "   or the DISCOVER half stopped being able to READ it — which is the more\n"
                "   dangerous case, because every OTHER constant of that shape went unswept\n"
                "   with it and this line is the only thing that would say so.")
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

    # ── MUTATE: move each floor's VALUE and require its runner to go red ───────────
    #
    # 🔴 191 — AND THE MUTATION IS NOT ALWAYS "-> 0", BECAUSE THAT IS A NO-OP ON A
    # CONSTANT ALREADY AT ZERO. This gate rewrote every target to `0` and asked whether
    # the runner reddened. `ALIAS_BLIND_CEILING` went to zero this session — the tree
    # holds no unreadable binding at all now — and the sweep dutifully reported it
    # UNPINNED, having written the same digit that was already there and run an
    # unmutated tree. The row was not weak; the INSTRUMENT could not express a mutation
    # for it, which is 181 §5's problem ("a rule whose healthy value is zero cannot prove
    # it ever counted") turning up inside the gate that exists to catch exactly that.
    #
    # 🔴 SO THE MUTANT IS DEFINED AS "A DIFFERENT VALUE", NOT AS "ZERO". Zero for anything
    # non-zero — the strongest mutation, since it is the value a deleted floor decays to —
    # and a large number for a constant already at zero, which is the same act read from
    # the other side: a ceiling at zero that nobody pins can be raised to 999 and let
    # everything through. Both directions ask one question: does anything assert this
    # value? 184 §7's rule, which is that pinning the KEY is not pinning the VALUE.
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
        shipped = text[start:end]
        mutant = "999999" if shipped.lstrip("0") == "" else "0"
        try:
            p.write_text(text[:start] + mutant + text[end:])
            # 🔴 ASSERT THE MUTATION IS ONE. A row whose shipped value equals its mutant
            # tests nothing and would report `ok` — the exact failure this block fixes,
            # re-armed so it cannot come back by a different route.
            if p.read_text() == text:
                failed = True
                print(f"🔴 FLOOR_PIN_NOOP {label}: the mutant is byte-identical to the shipped tree.")
                continue
            green = run(runner)
        finally:
            p.write_text(text)
        if green:
            unpinned.append(label)
            print(f"🔴 FLOOR_PIN_UNPINNED {label} -> {mutant} and {Path(runner[0]).name} STAYS GREEN")
        else:
            print(f"  ok   {label:<28} -> {mutant:<6} reddens {Path(runner[0]).name}")

    print(f"FLOOR_PIN_UNPINNED_COUNT {len(unpinned)} of {len(TARGETS)}")
    if unpinned:
        failed = True
        print("\n🔴 The floor(s) above can be MOVED with nothing going red — to zero if they ship\n"
              "   non-zero, and to 999999 if they ship at zero (191: the second direction exists\n"
              "   because writing `0` over a `0` is not a mutation). A floor whose own\n"
              "   value nobody asserts is not a floor — it is a number, and the run that deletes it\n"
              "   passes. Pin it in the self-test with an EXACT comparison, the way\n"
              "   `verdict_gate.selftest.mjs` writes `SUBJECT_FLOOR === 4`. A `>=` bound that the\n"
              "   value trivially satisfies (`CONST_FLOOR >= 0` over a count) is not a pin.")

    if failed:
        print("\nFLOOR_PIN_GATE 🔴 FAILED")
        return 1
    print(f"\nFLOOR_PIN_GATE ok — all {len(TARGETS)} floor(s) MOVED off their shipped value, each "
          f"reddened its runner, and no unswept floor exists in the tree")
    return 0


if __name__ == "__main__":
    sys.exit(main())
