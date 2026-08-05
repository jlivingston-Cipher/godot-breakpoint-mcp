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
TARGET_FLOOR = 57   # 200: 56 -> 57 (SHIPPED_CLAIM_SITE_FLOORS, §12.3's expected table —
                    #      itself a floor-shaped constant of eleven literals, reported
                    #      UNSWEPT by this gate on the first run after it was written)
                    # 200: 51 -> 56 (COHORT_FLOORS' five values — `path-cohort.mjs`'s
                    #      `const FLOORS = [` since 173, rejected by the DISCOVER half's
                    #      VALUE side, so this gate had never named that file in ANY of
                    #      its three tables. 199 §12.2 was priced as a rename; the rename
                    #      was necessary, not sufficient, and dropping the value test is
                    #      what found these. §12.2 of this session's handoff)
                    # 199: 50 -> 51 (CLAIM_SITE_FLOORS, found UNSWEPT by §9.4's widening
                    #      on the very first run after it — the same return 197's CEILING
                    #      widening paid in 198, one direction over)
                    # 🔴 190 — AND IT IS MOVED BY HAND ON PURPOSE, which is the half of
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
    # 🆕 199 §9.4 — THE FLOOR THIS GATE'S OWN DISCOVERY HALF COULD NOT SEE, FOUND THE RUN
    # AFTER THE REGEX WAS WIDENED. `CLAIM_SITE_FLOORS` is eleven per-file floors in one
    # object literal, and it was outside this gate by construction on TWO counts: the .mjs
    # walk required a `\d+` value (the .py walk had accepted `{` since 197) AND a SINGULAR
    # name. Every dict-valued floor in the .mjs tree is plural, so the `{` widening alone
    # would have found nothing and read as "already covered" — 183 §12.29's rule needing
    # BOTH directions closed before the measurement means anything.
    #
    # 🔴 AND ITS VALUES WERE UNPINNED, WHICH IS THE FINDING. The self-test asserted the KEY
    # COUNT (11) and the per-file comparison, and nothing asserted a VALUE — so
    # `"_caller_shape.harness.mjs": 45` could go to 0 in silence, and that number is
    # 191's guard against the revert-by-predicate its own reverse sweep found. Three
    # claims added there in the same commit; this row is what proves they bite.
    ("CLAIM_SITE_FLOORS",        f"{S}/seal_order_gate.mjs",         r'("_caller_shape\.harness\.mjs": )45,',                     [f"{S}/seal_order_gate.selftest.mjs"]),
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
    # 🆕 200 §12.2 — RENAMED so the DISCOVER walk can name them, which is what took
    # `UNDISCOVERABLE_CEILING` to zero. The anchors move with the constants.
    ("LEDGER_SCOPE_FLOORS.classes",     f"{T}/_path_ledger.mjs",     r"(LEDGER_SCOPE_FLOORS = Object\.freeze\(\{ classes: )7,",   [f"{T}/_path_ledger.selftest.mjs"]),
    ("LEDGER_SCOPE_FLOORS.canaries",    f"{T}/_path_ledger.mjs",     r"(classes: 7, canaries: )2 ",                               [f"{T}/_path_ledger.selftest.mjs"]),
    ("LEDGER_POPULATION_FLOORS.live",   f"{T}/_path_ledger.mjs",     r"(LEDGER_POPULATION_FLOORS = Object\.freeze\(\{ live: )220,", [f"{T}/_path_ledger.selftest.mjs"]),
    ("LEDGER_POPULATION_FLOORS.ledger", f"{T}/_path_ledger.mjs",     r"(live: 220, ledger: )220 ",                                [f"{T}/_path_ledger.selftest.mjs"]),
    # 🆕 200 §12.2 — THE FIVE THIS GATE HAD NEVER SEEN. They lived in
    # `host/scripts/path-cohort.mjs` as `const FLOORS = [` from 173, and the DISCOVER
    # half's VALUE side rejected an array, so this file appeared in NONE of the three
    # tables. Moved into `_path_ledger.mjs` because that script opens an MCP transport at
    # import and nothing could assert a literal where it lay — 179's meta-rule, which
    # this same file already paid once for `LEDGER_POPULATION_FLOORS`.
    ("COHORT_FLOORS.tools",             f"{T}/_path_ledger.mjs",     r"(COHORT_FLOORS = Object\.freeze\(\{\n  tools: )285,",      [f"{T}/_path_ledger.selftest.mjs"]),
    ("COHORT_FLOORS.topLevelNamedPath", f"{T}/_path_ledger.mjs",     r"(topLevelNamedPath: )120,",                                [f"{T}/_path_ledger.selftest.mjs"]),
    ("COHORT_FLOORS.topLevelOther",     f"{T}/_path_ledger.mjs",     r"(topLevelOther: )124,",                                    [f"{T}/_path_ledger.selftest.mjs"]),
    ("COHORT_FLOORS.nested",            f"{T}/_path_ledger.mjs",     r"(  nested: )6,",                                           [f"{T}/_path_ledger.selftest.mjs"]),
    ("COHORT_FLOORS.total",             f"{T}/_path_ledger.mjs",     r"(  total: )250,",                                          [f"{T}/_path_ledger.selftest.mjs"]),
    # 🆕 200 §12.3 — THE EXPECTED TABLE THAT PINS THE OTHER TEN `CLAIM_SITE_FLOORS`.
    # It is itself a floor-shaped constant holding eleven literals, so it is swept like
    # any other: zero the 45 here and the per-key loop reddens its own self-test. This
    # gate reported it unswept on the run that first saw it, which is the DISCOVER half
    # doing exactly what it exists for, on a constant added ten minutes earlier.
    ("so.SHIPPED_CLAIM_SITE_FLOORS", f"{S}/seal_order_gate.selftest.mjs", r'(SHIPPED_CLAIM_SITE_FLOORS = \{\n  "_caller_shape\.harness\.mjs": )45,', [f"{S}/seal_order_gate.selftest.mjs"]),
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
# 🔴 199 §9.4 — AND THE `{` HALF, WHICH THE PY WALK HAS HAD SINCE 197 AND THIS ONE DID
# NOT. 197 §8.5 handed the asymmetry over and 198 relied on the PY side twice without
# paying it. TWO widenings, because measuring found the item's own description short by
# one: accepting `{` is not enough on this side, since every dict-valued floor in the .mjs
# tree is also PLURAL — `FLOORS`, `FILE_FLOORS`, `CLAIM_SITE_FLOORS`. A name-shape scoped
# to the singular is 183 §12.29 one more time, and the plural is the direction it does not
# cover. Measured before widening: 3 plural dict floors exist in the walked .mjs tree.
#
# 🔴 AND THE PREFIX IS OPTIONAL, WHICH THE FIRST DRAFT OF THIS WIDENING GOT WRONG.
# `[A-Za-z_][A-Za-z0-9_]*(?:FLOOR|CEILING)S?` requires at least one character BEFORE the
# floor word, so `FLOORS` — tautology_gate.mjs's own four-key roster, in TARGETS since
# 181 — still did not match, and the widening would have reported "nothing new found" over
# a constant it was written to reach. Caught by the UNDISCOVERABLE check below, on the
# first run after that check existed, which is what that check is for.
#
# 🔴 200 §12.2 — AND THE VALUE HALF IS GONE ENTIRELY, WHICH IS THE HALF 199 NEVER TOUCHED.
# 199 §12.2 priced this session as "rename `LEDGER_SCOPE` and `LEDGER_POPULATION` so the
# walk can see them". Measured first (`host/_to_delete/discover200.py`): the rename is
# NECESSARY BUT NOT SUFFICIENT, because `Object.freeze({...})` is neither a digit nor `{`
# and the renamed constant would still have been rejected — by the OTHER half. 199
# widened the NAME side twice (`CEILING`, then plural + optional prefix) and left a value
# shape nobody had asked about. That is 183 §12.29 in the direction the name does not
# cover, one axis over: A DISCOVERY HALF SCOPED TO A SHAPE ROTS IN THE DIRECTION THE
# SHAPE DOES NOT COVER, and the answer is to stop scoping by shape rather than to add
# `Object\.freeze\(` and then `\[` and then the next one.
#
# 🔴 MEASURED BEFORE REMOVING IT, in both trees: 66 name-shaped constants exist, 65 were
# already accepted, and dropping the value test admits exactly ONE more —
# `const FLOORS = [` in `host/scripts/path-cohort.mjs`. Five literal floors, in a script
# CI runs on every push, named in NONE of this gate's three tables. Not swept, not
# exempt, not declared: outside the gate by construction, with no line anywhere saying
# so. A constant whose NAME says it is a floor IS a floor, whatever it is bound to; the
# tables below decide what to do about it, and that is their job rather than the regex's.
DISCOVER_RE = re.compile(
    r"^\s*(?:export )?const ((?:[A-Za-z_][A-Za-z0-9_]*)?(?:FLOOR|CEILING)S?)\s*=", re.M)
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
#
# 🔴 200 §12.2 — AND ITS VALUE HALF GOES WITH THE OTHER ONE, SYMMETRICALLY. Nothing in
# `scripts/*.py` is rejected by it today (measured: 0 of the 66), so this costs no new
# work — and that is exactly why it is done in the same commit rather than "when it
# bites". 199 §8 is the whole argument: the two walks were left asymmetric for two
# sessions, 198 leaned on the PY side twice without paying it, and closing one side while
# leaving the other narrow is how the asymmetry gets recreated on the next widening.
DISCOVER_PY_RE = re.compile(
    r"^\s*((?:[A-Za-z_][A-Za-z0-9_]*)?(?:FLOOR|CEILING)S?)\s*[:=]", re.M)
# The name shape both walks look for, as ONE definition — used again in `main()` to read
# a TARGETS label. Two spellings of the same rule would drift (180 §7.1).
FLOORISH = re.compile(r"^(?:[A-Za-z_][A-Za-z0-9_]*)?(?:FLOOR|CEILING)S?$")

# 🔴 199 §9.4 — THE FLOORS THIS GATE SWEEPS AND ITS DISCOVERY HALF CANNOT NAME.
# The DISCOVER walk is scoped to a NAMING CONVENTION: a constant is findable only if its
# name ENDS in FLOOR/FLOORS/CEILING/CEILINGS. Two entries in TARGETS do not, and they are
# floors all the same — which means the discovery half's coverage of its own table was
# never checked in either direction. `UNDISCOVERABLE` below is that check, and this is its
# CEILING, declared with reasons in the shape 174 §5 requires.
#
# 🔴 IT IS ALSO WHAT MAKES THE TWO WIDENINGS ABOVE FALSIFIABLE. Narrow either regex back
# and `FLOORS`, `FILE_FLOORS` and `CLAIM_SITE_FLOORS` stop being discovered while sitting
# in TARGETS — which, before this check, nothing anywhere would have said. 197 solved the
# same problem for the `CEILING` widening with `stale-exempt`; this is that argument for
# the half of the table that is swept rather than exempt.
#
# 🟢 200 §12.2 — EMPTY, AND THE CEILING IS ZERO. `LEDGER_SCOPE` and `LEDGER_POPULATION`
# were renamed to `LEDGER_SCOPE_FLOORS` and `LEDGER_POPULATION_FLOORS`, so the walk names
# them like every other row. Emptied rather than kept as empty-with-a-comment, which is
# 199 §12.42's decision about `CRASH_DECLARED` applied to the table it wrote next.
#
# 🔴 AND THE RENAME ALONE WAS NOT WHAT DID IT. 199 §12.2 was written as "the fix is
# renaming the constants" and that was a surface reading of its own item: with the value
# half still in place, `Object.freeze(` failed the OTHER half and the renamed constants
# would have stayed exactly as undiscoverable. Both edits, or neither works — and the way
# that was found was measuring the claim before acting on it, not after (199 §32).
#
# 🔴 THE TWO REASONS THAT USED TO BE HERE QUOTED VALUES THE TREE DID NOT HOLD:
# `{classes: 8, canaries: 2}` against a shipped 7, and `{live: 240, ledger: 240}` against
# a shipped 220. Written in 199, wrong on the day they were written, and nothing compared
# them to anything — 199 §37's own rule (a number a gate prints and never compares) with
# the number inside a PROSE REASON instead of an output line.
#
# 🟢 201 §10.4 — AND THAT IS NOW A CHECK RATHER THAN A NOTE. `REASON_DIGIT` below governs
# every reason in BOTH tables: a digit-run in prose is legal only as a session citation or
# as the `{FLOOR}` placeholder, which is resolved from the tree on every run and therefore
# cannot be stale. This roster is empty today, so the rule is proved on a FIXTURE in
# `_self_check()` rather than on a live population — the U1 lesson (a check whose
# population is empty is passing for the wrong reason) applied to the table that taught it.
UNDISCOVERABLE_DECLARED: dict[tuple[str, str], str] = {}
UNDISCOVERABLE_CEILING = 0   # 🔴 IT FELL, AS 199 SAID IT SHOULD, AND IT STAYS A CEILING:
                             # a floor added tomorrow under a name the walk cannot read
                             # reddens here on the commit that adds it, and the fix is
                             # still the constant's name rather than a wider guess.

# Floors that live in a file no headless runner exercises. Each needs a REASON, not a
# name — 174 §5: an exclusion that costs nothing to write is one nobody re-reads.
#
# ═══════════════════════════════════════════════════════════════════════════════════
# 🔴 199 §9.3 — KEYED BY (FILE, NAME), AND THE BARE-NAME VERSION HAD A LIVE COLLISION.
# ═══════════════════════════════════════════════════════════════════════════════════
# 197 §8.4 named this and 198 made it worse by two without paying it. Measured before
# changing the key rather than after: of the twenty-two exempt names, `TARGET_FLOOR`
# resolves to TWO files — `floor_pin_gate.py` (this one) and `scope_gate.py` — and ONE
# entry was excusing both. That entry's prose happens to name both files, so the table was
# honest by luck; the STRUCTURE was not, and luck is not a property a gate can rest on.
#
# 🔴 AND THE SAME DEFECT WAS IN `known`, WHERE IT COSTS COVERAGE RATHER THAN HONESTY.
# The discovery half compared bare names against a set built from TARGETS labels, plus a
# hand-written `known |= {"SELFTEST_CLAIM_FLOOR", "CLAIM_FLOOR"}` because those two names
# each appear in THREE files. All six sites happen to be in TARGETS today — so nothing was
# unswept — but a seventh file declaring `CLAIM_FLOOR` would have been skipped in silence,
# with no reason written anywhere, which is strictly worse than a wrong exemption. Keying
# `known` by (file, name) DERIVES the pairs from the table's own rows and deletes that
# hand-written line entirely: 198's rule that an exclusion should come from data the tree
# already carries rather than from a roster somebody maintains.
DISCOVER_EXEMPT: dict[tuple[str, str], str] = {
    (f"{T}/authoring-plane.integration.mjs", "AUTH_SNAPSHOT_FILE_FLOOR"): "authoring-plane.integration.mjs — boots the editor GUI under Xvfb; no headless runner can redden it",
    (f"{T}/authoring-plane.integration.mjs", "AUTH_SNAPSHOT_DIR_FLOOR"): "same file, same reason",
    (f"{T}/authoring-plane.integration.mjs", "AUTH_FAMILY_FLOOR"): "same file, same reason",
    (f"{T}/authoring-plane.integration.mjs", "AUTH_CLAIM_FLOOR"): "same file, same reason",
    (f"{T}/gdscript-dap-plane.integration.mjs", "GD_DAP_CLAIM_FLOOR"): "gdscript-dap-plane.integration.mjs — needs a real Godot binary and a live DAP session",
    # 🔴 182 — THE THREE A GATE HOLDS OVER ITS OWN ROSTER. Mutating one here would mean
    # running that gate as a step of this one: `instrument_gate.py` is 34s and mutates the
    # working tree, and `scope_gate.py` is 90s and does too, so nesting them would break
    # 178 §11.4's rule that the three mutating gates never run concurrently. Each is
    # instead pinned WHERE IT LIVES, and that is stated rather than assumed:
    ("../scripts/instrument_gate.py", "INSTRUMENT_FLOOR"): "instrument_gate.py's own roster floor — pinned in-file by `_self_check()`, "
                        "which asserts the collapse branch BITES at zero (176's G12 shape). Running it "
                        "here would nest one tree-mutating gate inside another (178 §11.4)",
    ("../scripts/instrument_gate.py", "LATE_CONSTRUCTED_FLOOR"): "instrument_gate.py's floor on its own second axis — pinned in the "
                              "same `_self_check()`, which fails if it is not positive, because a "
                              "zero would re-permit an injector that injects nothing. Same nesting "
                              "reason as INSTRUMENT_FLOOR",
    ("../scripts/instrument_gate.py", "LATE_LIVE_FLOOR"): "🆕 183 — instrument_gate.py's floor on the LIVE-axis roster, pinned in the "
                       "same `_self_check()` by asserting the branch bites on an empty roster. It "
                       "exists because LATE_CONSTRUCTED_FLOOR cannot see a roster shrink: deleting "
                       "the three caller-shape entries takes about an eighth off the constructed "
                       "blinds and leaves the count comfortably above that floor. Same nesting "
                       "reason as INSTRUMENT_FLOOR",
    # 🆕 197 — instrument_gate.py's fifth and sixth, same nesting reason as the four above.
    ("../scripts/instrument_gate.py", "CRASH_CEILING"): "🆕 197 — instrument_gate.py's CEILING on how many blinds go red WITHOUT the "
                     "gate reaching its own verdict, i.e. crash it instead of failing it. It is the "
                     "first thing this gate discovers under that session's `CEILING` widening rather than "
                     "under `FLOOR`, and it is exempt for INSTRUMENT_FLOOR's reason: its runner "
                     "would be instrument_gate.py, which mutates the working tree. Pinned in the "
                     "same `_self_check()`, which feeds `crash_problems` a two-crash fixture over a "
                     "ceiling of one and requires it to bite",
    ("../scripts/instrument_gate.py", "BLAST_FLOOR"): "🆕 197 — instrument_gate.py's PER-INSTRUMENT floors on how many failure lines "
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
    ("../scripts/instrument_gate.py", "LATE_BLAST_FLOOR"): "🆕 198 — instrument_gate.py's PER-INSTRUMENT floors on the LATE axis's "
                        "blast radius, the `A:gate` half only. A dict, read by that session's `{` widening, "
                        "and exempt for INSTRUMENT_FLOOR's reason: its runner mutates the working "
                        "tree. Pinned in-file by `_self_check()`, which requires every value "
                        "positive, plus a `main()` assertion that no entry names a missing "
                        "instrument. 🔴 THE `B:live` HALF IS DELIBERATELY ABSENT rather than "
                        "pending: four of that axis's five commands report by collapsing a "
                        "population and print no per-claim FAIL line at all, so every floor there "
                        "would be a floor at zero — the shape this table's own entries refuse",
    ("../scripts/instrument_gate.py", "LATE_NOT_LOADED_CEILING"): "🆕 198 — instrument_gate.py's CEILING on late mutants that produced "
                        "no `LATE_BLIND_CALLS` line AT ALL, meaning the mutant never loaded. It is "
                        "ZERO and is measured zero: every mutant run across both axes hooked. "
                        "🔴 A CEILING AT ZERO WITH NO LIVE ROW IS EXACTLY 197 §3's HOLE — a mutant "
                        "that did not compile was filed 'not constructible' and reported green — "
                        "so it is fed a one-row fixture in `_self_check()` rather than trusted to "
                        "the tree, and exempt here for INSTRUMENT_FLOOR's nesting reason",
    ("../scripts/instrument_gate.py", "SIG_RESOLVED_FLOOR"): "🆕 195 — instrument_gate.py's floor on how many of its target anchors are "
                       "`{SIG:name}` PLACEHOLDERS rather than literal signatures. It is a third "
                       "collapse the two floors above cannot see: replacing a placeholder with the "
                       "signature it resolves to today changes no printed line, no verdict and no "
                       "blind — it only puts that row back on an expiry date, and the class arrived "
                       "one row at a time. Pinned in the same `_self_check()`, which asserts the "
                       "branch bites at zero. Same nesting reason as INSTRUMENT_FLOOR",
    # 🆕 187 — control_gate.py's two, and they are the same nesting problem a third time.
    # Its runner would be control_gate.py itself, which MUTATES THE WORKING TREE (it breaks
    # example/project.godot, README.md, a lockfile field and a tool name in turn), so
    # sweeping them here would run one tree-mutating gate inside another — 178 §11.4, the
    # rule INSTRUMENT_FLOOR is exempt under four lines up.
    ("../scripts/control_gate.py", "CONTROLLED_FLOOR"): "control_gate.py's floor on the number of failure statements that have a "
                        "positive control — pinned in-file by `_self_check()`, which fails if the "
                        "value is not positive, because a zero would leave `controls_low` unable to "
                        "bite and the gate green over an emptied CONTROLS table. Same nesting reason "
                        "as INSTRUMENT_FLOOR",
    ("../scripts/control_gate.py", "STATEMENT_FLOOR"): "control_gate.py's floor on the DENOMINATOR — the count of errors.append "
                       "statements in contract_check.py. It exists because a covered-of-total "
                       "ratio improves to covered-of-covered by DELETING every statement the "
                       "numerator does not reach, so the numerator's floor cannot "
                       "see the failure this one names. Pinned in the same `_self_check()`, same "
                       "nesting reason as INSTRUMENT_FLOOR",
    ("../scripts/control_gate.py", "UNFINGERPRINTABLE_FLOOR"): "control_gate.py's floor on what it CANNOT see — the statements "
                        "carrying no string literal of their own, which no fingerprint can ever "
                        "name (188 §4). Floored from below so the set cannot shrink by rewording, "
                        "and pinned in the same `_self_check()` as the two above it. Same nesting "
                        "reason as INSTRUMENT_FLOOR: its runner mutates the working tree",
    # 🆕 196 — control_gate.py's fourth and fifth, and they are TWO because 194 §33 said a
    # subtraction over more than one contributor needs two numbers. `BLAST_TOTAL_FLOOR` is
    # what the mutations DO; `ALSO_ATTRIBUTED_FLOOR` is how much of that the reader can
    # EXPLAIN. Either can collapse while the other holds — a rewording that breaks the
    # attributor moves only the second, and a control going quiet moves only the first.
    ("../scripts/control_gate.py", "BLAST_TOTAL_FLOOR"): "🆕 196 — control_gate.py's floor on the TOTAL number of FAIL lines its "
                        "fifty-six mutations produce, at {FLOOR}. Every row now declares its own count "
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
    ("../scripts/scope_gate.py", "SCOPE_BLAST_TOTAL_FLOOR"): "🆕 197 — scope_gate.py's floor on the TOTAL number of FAIL lines its "
                        "twenty-five blinded runs produce, at {FLOOR}. Same argument as control_gate's "
                        "BLAST_TOTAL_FLOOR below: each row declares its own count and the gate "
                        "compares them, but a per-row equality is edited one row at a time. Pinned "
                        "in scope_gate's own `_self_check()`, which fails if it is not positive",
    ("../scripts/scope_gate.py", "LEDGER_COLLAPSE_FLOOR"): "🆕 197 — scope_gate.py's floor on how many SCOPE-LEDGER populations "
                        "its blinds actually collapse, at {FLOOR} across twenty-five rows. It is a DIFFERENT "
                        "collapse from the one above and that is the whole finding: three rows "
                        "reddened the run without collapsing any ledger population at all, so they "
                        "were caught by a parse guard rather than by the ledger the gate exists to "
                        "defend. A FAIL-line total cannot see that; this number is what does. "
                        "Pinned in the same `_self_check()`",
    ("../scripts/control_gate.py", "ALSO_ATTRIBUTED_FLOOR"): "🆕 196 — control_gate.py's floor on its DIAGNOSIS rather than its "
                        "verdict: how many of those FAIL lines resolve to a named check, at "
                        "{FLOOR}. The verdict deliberately does NOT rest on this reader — it is "
                        "right about nineteen times in twenty and an assertion resting on it "
                        "would be 194 §4 shipped — but the "
                        "failure message's ability to say WHICH check arrived does. Floored so the "
                        "attributor cannot quietly stop working while every row still passes. "
                        "Pinned in the same `_self_check()`, same nesting reason",
    ("../scripts/scope_gate.py", "STATEMENT_ATTRIB_FLOOR"): "scope_gate.py's floor on how many of contract_check.py's failure "
                        "statements its own twenty-five blinded runs EXECUTE (188 §5, re-derived "
                        "from scope_gate's own runs after control_gate.py had stated a higher "
                        "number for two sessions, and raised once more when 188 §3 gave check "
                        "twelve a population). Not swept "
                        "here because its runner is scope_gate.py itself, which writes a mutant "
                        "copy of contract_check.py into scripts/ — the same nesting rule. Pinned "
                        "in that file's `_self_check()`, which fails if it is not positive",
    ("../scripts/floor_pin_gate.py", "UNDISCOVERABLE_CEILING"):
        "🆕 199 §9.4 — THIS file's ceiling on how many floors it sweeps that its own DISCOVER "
        "half cannot NAME. It went unswept on the first run after it was written, by the "
        "discovery half it was added to, which is the cheapest possible evidence that both "
        "are working. Same nesting reason as TARGET_FLOOR below: the runner would be "
        "floor_pin_gate.py itself. Pinned in-file the same way — `len(UNDISCOVERABLE_DECLARED) "
        "> UNDISCOVERABLE_CEILING` sits directly against the roster it bounds, so a third "
        "declaration added without raising the literal reddens on the next run — WHILE THE "
        "ROSTER HAS MEMBERS. 200 §12.2 found that it has none: an empty roster makes the "
        "comparison false for every value the ceiling could hold, so raising this literal "
        "reddened nothing and `mutate200.py`'s U1 measured exactly that. "
        "🟢 201 §10.3 — CLOSED, AND NOT BY THE ROSTER REFILLING. The branch is lifted into "
        "`ceiling_problems()` and fed a fixture by this file's FIRST `_self_check()`, which "
        "is what 199 §12.7 and §12.28 asked for: a roster of three against a ceiling of two "
        "MUST bite, and the same roster against a ceiling of three must NOT. The check no "
        "longer rests on the live population being non-empty, which is the general form of "
        "the defect — a check with an empty population passes for the wrong reason.",
    ("../scripts/floor_pin_gate.py", "USE_FLOOR"):
        "🆕 201 §10.2 — THIS file's floor over its USE-SITE roster, the list of floors that "
        "have a live CONSUMER rather than only a declaration-site pin. Same nesting reason "
        "as TARGET_FLOOR below: its runner would be floor_pin_gate.py itself. Pinned in-file "
        "by this file's FIRST `_self_check()`, which fails if the roster has shrunk below it "
        "— because a use-site roster that quietly empties leaves every consumer unasked while "
        "every declaration stays fully pinned, which is the exact asymmetry the roster exists "
        "to close.",
    ("../scripts/floor_pin_gate.py", "TARGET_FLOOR"):
        "THIS file's floor over its own target list — a gate cannot pin that without reading "
        "the constant it is checking, so it is pinned in-file: a session that deletes a "
        "TARGETS line without lowering it gets FLOOR_PIN_TARGETS_COLLAPSE, asserted twenty "
        "lines into main(). 🔴 199 — this row and the next one were ONE row under the old "
        "bare-name key, and that is 197 §8.4's defect caught live — the prose happened to "
        "name both files, so the table was honest by accident and unstructured on purpose.",
    ("../scripts/scope_gate.py", "TARGET_FLOOR"):
        "scope_gate.py's floor over ITS target list, the same shape and a different file. "
        "Not swept here for the nesting reason INSTRUMENT_FLOOR carries: its runner is "
        "scope_gate.py, which writes a mutant copy of contract_check.py into scripts/. "
        "Pinned in that file's own `_self_check()`, which asserts the branch bites.",
}

# ═══════════════════════════════════════════════════════════════════════════════════
# 🆕 201 §10.4 — A REASON STRING IS A NUMBER NOBODY COMPARES
# ═══════════════════════════════════════════════════════════════════════════════════
#
# 199 wrote two `UNDISCOVERABLE_DECLARED` reasons quoting `{classes: 8, canaries: 2}`
# and `{live: 240, ledger: 240}` against a shipped 7 and a shipped 220. Wrong on the day
# they were written, compared by nothing, and found only because 200 read them by eye.
# 200 §12.4 handed the class over: WHICH OTHER TABLES CARRY VALUES INSIDE PROSE?
#
# Measured before acting (200 §33). Twelve of the twenty-four rows above carried a
# non-citation digit-run, and FOUR of them were the same defect in the same shape — a
# parenthetical that a reader takes for THE ROW'S OWN FLOOR and which was in fact the
# LIVE measurement, already drifted apart:
#
#     BLAST_TOTAL_FLOOR        said (103)       the constant holds 95
#     SCOPE_BLAST_TOTAL_FLOOR  said (53)        the constant holds 45
#     LEDGER_COLLAPSE_FLOOR    said (29)        the constant holds 24
#     ALSO_ATTRIBUTED_FLOOR    said (98 of 103) the constant holds 90
#
# 🔴 THE RULE IS NOT "DO NOT QUOTE NUMBERS", IT IS "A NUMBER IN PROSE MUST COME FROM THE
# TREE". `{FLOOR}` is resolved from the row's OWN constant on every run, so it cannot be
# stale by construction — 188 §2's `{V}` idiom (a number inside a string, written as a
# placeholder the tool substitutes) applied one table over. Everything that is NOT the
# row's own value gets spelled in words, WHICH IS THIS TABLE'S OWN IDIOM RATHER THAN AN
# IMPOSITION ON IT: seventeen of the twenty-four rows already wrote "fifty-six
# mutations", "twenty-five blinded runs", "a two-crash fixture". 198's rule — an
# exclusion should come from something the tree already carries — applied to a house
# style instead of to a roster.
#
# A session citation is exempt because it is a POINTER, not a measurement: `199 §12.4`
# names a document that does not change. Everything else is a claim about now.
# 🔴 THE FIRST DRAFT OF THIS REGEX WAS WRONG AND THE SELF-CHECK BELOW CAUGHT IT ON THE
# FIRST RUN — which is the cheapest possible evidence that `_self_check()` was worth
# adding, and 199 §41's "the reader that was WRONG is the one worth keeping" paid on the
# same commit that introduced the reader. It read `\d{3}` followed by ANY punctuation or
# space, so `103,` parsed as a session citation and the rule flagged nothing at all.
#
# A citation is not identified by its RANGE — a measurement can be any number — it is
# identified by what FOLLOWS it: a section sign, an em-dash introducing the finding, or
# the possessive this codebase writes when it attributes a rule ("176's G12 shape"). A
# bare `103, measured across the rows` has none of those and is a claim about now.
REASON_CITE = re.compile(r"(?<!\d)(?:1[5-9]\d|20\d)(?=\s*(?:§|—|--|'|’))")
REASON_SECTION = re.compile(r"§\s*\d+(?:\.\d+)*")
REASON_PLACEHOLDER = re.compile(r"\{FLOOR\}")
REASON_DIGIT = re.compile(r"(?<![\w])(\d+)")
# A `{SIG:name}`-style literal quoted as prose is a NAME, not a number; so is a version
# range inside backticks. Both are stripped before the digit test, and both are narrow
# enough that a bare measurement cannot hide inside one.
REASON_BACKTICKED = re.compile(r"`[^`]*`")

_VALUE_CACHE: dict[tuple[str, str], int | None] = {}


def reason_value(relfile: str, name: str) -> int | None:
    """The CURRENT value of `name` in `relfile`, read from the tree on every run.

    🔴 THIS IS THE WHOLE POINT OF `{FLOOR}`. A reason that quotes a literal is a claim
    that was true when it was typed; a reason that quotes THIS is a claim that is true
    when it is read. The four rows above are the measured cost of the difference."""
    key = (relfile, name)
    if key in _VALUE_CACHE:
        return _VALUE_CACHE[key]
    p = (HOST / relfile).resolve()
    val: int | None = None
    if p.exists():
        t = p.read_text()
        m = (re.search(rf"^{re.escape(name)}(?::\s*[^=\n]+)?\s*=\s*(\d+)", t, re.M)
             or re.search(rf"^(?:export )?const {re.escape(name)}\s*=\s*(\d+)", t, re.M))
        if m:
            val = int(m.group(1))
    _VALUE_CACHE[key] = val
    return val


def render_reason(relfile: str, name: str, reason: str) -> str:
    v = reason_value(relfile, name)
    return reason.replace("{FLOOR}", str(v) if v is not None else "🔴UNRESOLVED")


def reason_problems(table: dict[tuple[str, str], str],
                    label: str,
                    resolve=reason_value) -> list[str]:
    """Every reason in `table`, asked whether it carries an ungoverned number.

    Lifted out of `main()` so `_self_check()` can feed it inputs it MUST flag — which is
    the shape control_gate.py, scope_gate.py and instrument_gate.py all use and this file
    has never had (199 §12.7, §12.28; 200 §12.3)."""
    problems: list[str] = []
    for (f, n), reason in table.items():
        if "{FLOOR}" in reason and resolve(f, n) is None:
            problems.append(
                f"🔴 FLOOR_PIN_REASON_UNRESOLVED {label} {f}:{n} — its reason asks for "
                f"`{{FLOOR}}` and the value cannot be read out of {f}. Either the constant "
                f"was renamed (fix the key) or the reader stopped working, which is the "
                f"dangerous half: an unresolved placeholder prints a marker rather than a "
                f"wrong number, and that is deliberate.")
        # 🔴 THE ORDER IS PART OF THE RULE. `REASON_SECTION` eats the `§` that
        # `REASON_CITE` recognises the session number BY, so stripping sections first
        # turns every citation into a bare number — the second defect the self-check
        # below caught, on the same run as the first.
        scrub = REASON_PLACEHOLDER.sub("", reason)
        scrub = REASON_BACKTICKED.sub("", scrub)
        scrub = REASON_CITE.sub("", scrub)
        scrub = REASON_SECTION.sub("", scrub)
        stray = REASON_DIGIT.findall(scrub)
        if stray:
            problems.append(
                f"🔴 FLOOR_PIN_REASON_DIGIT {label} {f}:{n} — its reason states {stray} as "
                f"bare digits. A number in prose is a measurement nobody compares (199's "
                f"two declaration reasons were wrong on the day they were written). Write "
                f"the row's OWN value as `{{FLOOR}}`, which is read from the tree on every "
                f"run; spell anything else in words, which is what seventeen of these rows "
                f"already do.")
    return problems


# ═══════════════════════════════════════════════════════════════════════════════════
# 🆕 201 §10.2 — THE MUTATION THAT COULD NOT REACH THE READER
# ═══════════════════════════════════════════════════════════════════════════════════
#
# 200's sweep declared `C2` green and named what it left unmeasured: `path-cohort.mjs`
# imports its five floors from `_path_ledger.mjs`, and RE-INLINING one there would be
# invisible — the self-test still pins `COHORT_FLOORS.total` and the reverse sweep still
# zeroes it, so both keep biting, but the script would be comparing against its own copy.
# 200 §35 generalised it: A CONSTANT IS DEFENDED WHERE IT IS DECLARED AND UNREAD WHERE
# IT IS USED, and asked which other instruments import a literal and could silently stop.
#
# 🔴 MEASURED: SIX cross-file floor imports exist, and FIVE are a self-test importing
# from the gate it tests — those ARE the declaration-site pins. Exactly one is a live
# CONSUMER, and it is the one 200 already named. The population is one, not six.
#
# 🔴 AND THE REASON NOTHING CATCHES IT IS THE DIRECTION OF THE MUTATION. Every row in
# TARGETS is mutated toward ZERO (191: or toward 999999 if it ships at zero), and for a
# `got >= floor` comparison ZERO IS THE VALUE THAT MAKES THE CONSUMER TRIVIALLY PASS. So
# the existing sweep can only ever prove that the SELF-TEST notices; it is structurally
# incapable of proving that the CONSUMER still reads the number. RAISING a floor above
# the live value is the mutation that reddens a live consumer — and a consumer holding a
# re-inlined literal stays GREEN through it, which is exactly the defect.
#
# (label, declaring file, regex whose group(1) ends immediately before the digits,
#  consumer argv). The consumer must PASS unmutated and go RED when the floor is raised.
USE_FLOOR = 5   # 201: this roster's own size. `>=`, because the day a second live
                # consumer imports a floor it belongs here — and a roster that can
                # shrink to nothing without anything noticing is the shape this whole
                # file exists to refuse.
COHORT = f"{T}/_path_ledger.mjs"
CO = [f"{S}/path-cohort.mjs", "--summary"]
USE_TARGETS: list[tuple[str, str, str, list[str]]] = [
    ("use.COHORT_FLOORS.tools",              COHORT, r"(tools: )285,",             CO),
    ("use.COHORT_FLOORS.topLevelNamedPath",  COHORT, r"(topLevelNamedPath: )120,", CO),
    ("use.COHORT_FLOORS.topLevelOther",      COHORT, r"(topLevelOther: )124,",     CO),
    ("use.COHORT_FLOORS.nested",             COHORT, r"(nested: )6,",              CO),
    ("use.COHORT_FLOORS.total",              COHORT, r"(total: )250",              CO),
]
USE_RAISE = "999999"


# ═══════════════════════════════════════════════════════════════════════════════════
# THE BRANCHES, LIFTED SO A FIXTURE CAN REACH THEM (199 §12.7 / 200 §12.3)
# ═══════════════════════════════════════════════════════════════════════════════════
#
# Each of these was an `if` inside `main()`, reachable only by breaking the real tree.
# control_gate.py's docstring says why that is not good enough: *lifted out,
# `_self_check()` can feed each one an input it MUST flag, so the branch is proved
# rather than assumed.* This file cited that sentence in six exemption reasons and had
# never applied it to itself.
def targets_collapse_problems(n_targets: int, floor: int) -> list[str]:
    if n_targets >= floor:
        return []
    return [f"🔴 FLOOR_PIN_TARGETS_COLLAPSE {n_targets} < {floor} — this gate's own\n"
            "   roster shrank. Either a floor was deleted (lower the literal on purpose), or a\n"
            "   line was dropped and every floor below it is now unswept."]


def ceiling_problems(declared: int, ceiling: int) -> list[str]:
    """🔴 THE BRANCH 200's U1 SAID NOTHING COULD REACH.

    `len(UNDISCOVERABLE_DECLARED) > UNDISCOVERABLE_CEILING` is false for EVERY ceiling
    value once the roster is empty, so the live tree can no longer exercise it and
    raising the literal reddens nothing. A fixture can, and does."""
    if declared <= ceiling:
        return []
    return [f"🔴 FLOOR_PIN_UNDISCOVERABLE_CEILING {declared} > "
            f"{ceiling} — this roster is a CEILING and is supposed to fall."]


def _self_check() -> list[str]:
    """This file's FIRST self-check (199 §12.7, §12.28 → 200 §12.3).

    Every branch below is fed BOTH an input it must flag and one it must not, because a
    predicate that returns a problem for everything passes the first half and is useless.
    194 §4's rule: an assertion that cannot be wrong is not an assertion."""
    bad: list[str] = []

    # ── the ceiling, which the live tree can no longer exercise (200's U1) ──
    if not ceiling_problems(3, 2):
        bad.append("_self_check: ceiling_problems(3, 2) did not bite — the "
                   "UNDISCOVERABLE_CEILING branch is dead and 200's U1 is still open")
    if ceiling_problems(3, 3):
        bad.append("_self_check: ceiling_problems(3, 3) bit on a roster AT its ceiling — "
                   "the comparison is `>` and a roster at the ceiling is legal")
    if ceiling_problems(0, 0):
        bad.append("_self_check: ceiling_problems(0, 0) bit on an EMPTY roster — that is "
                   "the live shape today and it must stay green")

    # ── this gate's own roster floor ──
    if not targets_collapse_problems(TARGET_FLOOR - 1, TARGET_FLOOR):
        bad.append("_self_check: targets_collapse_problems did not bite one below the floor")
    if targets_collapse_problems(TARGET_FLOOR, TARGET_FLOOR):
        bad.append("_self_check: targets_collapse_problems bit AT the floor — the "
                   "comparison is `<` and a roster at its floor is legal")

    # ── the reason rule, proved on a FIXTURE rather than on the live tables ──
    # 🔴 THIS IS THE U1 LESSON APPLIED FORWARD. `UNDISCOVERABLE_DECLARED` is EMPTY today,
    # so running the rule over it proves nothing at all — the same "false for every value"
    # shape, one table over. The fixtures below are the population that table does not have.
    fx_ok = {("x.py", "A_FLOOR"): "spelled in words: twenty-five rows, and a citation 199 §4"}
    fx_digit = {("x.py", "A_FLOOR"): "the floor is 103, measured across the rows"}
    fx_ph = {("x.py", "A_FLOOR"): "the floor is {FLOOR}, measured across the rows"}
    if reason_problems(fx_ok, "fixture", lambda f, n: 95):
        bad.append("_self_check: reason_problems flagged a reason with no bare digits — "
                   "the rule is over-wide and would force words onto session citations")
    if not reason_problems(fx_digit, "fixture", lambda f, n: 95):
        bad.append("_self_check: reason_problems did NOT flag a bare `103` in prose — the "
                   "REASON_DIGIT branch is dead and 199's two wrong reasons could be "
                   "re-typed today with nothing noticing")
    if reason_problems(fx_ph, "fixture", lambda f, n: 95):
        bad.append("_self_check: reason_problems flagged a `{FLOOR}` placeholder — the "
                   "escape hatch does not work, so every row would be forced into words")
    if not reason_problems(fx_ph, "fixture", lambda f, n: None):
        bad.append("_self_check: reason_problems did NOT flag a `{FLOOR}` that resolves to "
                   "nothing — an unresolvable placeholder would print a marker forever and "
                   "no run would say why")

    # ── the use-site roster's own floor ──
    if len(USE_TARGETS) < USE_FLOOR:
        bad.append(f"_self_check: USE_TARGETS shrank to {len(USE_TARGETS)} below "
                   f"USE_FLOOR {USE_FLOOR} — a live consumer stopped being asked whether "
                   f"it still reads the floor it imports")
    return bad


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
    print(f"FLOOR_PIN_GATE targets={len(TARGETS)} floor={TARGET_FLOOR} "
          f"use-targets={len(USE_TARGETS)} use-floor={USE_FLOOR}")

    # ── 🆕 201 §10.3 — THIS FILE'S FIRST SELF-CHECK, BEFORE ANYTHING ELSE RUNS ──────
    # It goes first for control_gate.py's reason: a gate whose own predicates are broken
    # reports a clean tree, and every line below this one would be a claim made by an
    # instrument that had not been asked whether it still works.
    sc = _self_check()
    for problem in sc:
        print(f"🔴 FLOOR_PIN_SELFCHECK {problem}")
    if sc:
        print("\nFLOOR_PIN_GATE 🔴 FAILED — its own self-check did not pass, so nothing "
              "below it means anything")
        return 1
    print("FLOOR_PIN_SELFCHECK ok — every lifted branch bit on an input it must flag and "
          "stayed quiet on one it must not")

    for problem in targets_collapse_problems(len(TARGETS), TARGET_FLOOR):
        print(problem)
        failed = True

    # ── 🆕 201 §10.4 — THE REASONS, ASKED WHETHER THEY QUOTE AN UNGOVERNED NUMBER ───
    reason_bad = (reason_problems(DISCOVER_EXEMPT, "exempt")
                  + reason_problems(UNDISCOVERABLE_DECLARED, "declared"))
    for problem in reason_bad:
        print(problem)
        failed = True
    print(f"FLOOR_PIN_REASON {len(DISCOVER_EXEMPT)} exempt + "
          f"{len(UNDISCOVERABLE_DECLARED)} declared reason(s) read · "
          f"{sum('{FLOOR}' in r for r in DISCOVER_EXEMPT.values())} resolve `{{FLOOR}}` "
          f"from the tree · {len(reason_bad)} carrying a bare number")

    # ── DISCOVERY: is any floor in the tree missing from the table above? ──────────
    # 🔴 199 §9.3 — (FILE, NAME), DERIVED FROM THE TABLE'S OWN ROWS. Every TARGETS row
    # already carries the file its floor lives in; the old `known` threw that away, kept
    # the bare label, and then needed a hand-written line re-admitting `CLAIM_FLOOR` and
    # `SELFTEST_CLAIM_FLOOR` because each appears in three files. That line is gone: the
    # pairs come from the data, and a same-named floor in a file NOT in this table is now
    # unswept and says so instead of being covered by a namesake three directories away.
    # 🔴 AND THE SEGMENT IS PICKED BY SHAPE, NOT BY POSITION (199 §9.4). This table's
    # labels carry a dot in TWO opposite conventions — `so.CLAIM_FLOOR` puts the FILE
    # first and `FILE_FLOORS.test` puts the CONSTANT first — so `split(".")[-1]` reads
    # the constant in one and a dict key in the other. Under the old singular regex that
    # never showed, because no plural dict floor was discoverable at all; widening the
    # regex is what made it matter. Every segment that LOOKS like a floor name is taken.
    known = {(f, seg) for lbl, f, *_ in TARGETS
             for seg in lbl.split(".") if FLOORISH.match(seg)}
    unswept: list[str] = []
    for d in DISCOVER_DIRS:
        for f in sorted(d.rglob("*.mjs")):
            if "_to_delete" in f.parts:
                continue
            rel = str(f.relative_to(HOST))
            for name in DISCOVER_RE.findall(f.read_text()):
                if (rel, name) in known or (rel, name) in DISCOVER_EXEMPT:
                    continue
                unswept.append(f"{rel}:{name}")
    for d in DISCOVER_PY_DIRS:                        # 🆕 182 — the other language
        for f in sorted(d.rglob("*.py")):
            if "_to_delete" in f.parts:
                continue
            rel = "../" + str(f.relative_to(ROOT))    # the spelling TARGETS uses
            for name in DISCOVER_PY_RE.findall(f.read_text()):
                if (rel, name) in known or (rel, name) in DISCOVER_EXEMPT:
                    continue
                unswept.append(f"{rel}:{name}")
    # 🔴 197 — AND THE OTHER HALF OF THE EXEMPTION TABLE, WHICH DID NOT EXIST (182's rule,
    # unpaid here). `DISCOVER_EXEMPT` was read in ONE direction: a name found in the tree
    # and present here was skipped. A name present here and found NOWHERE was skipped too —
    # silently — so an exemption outlives the constant it excuses, and the table gets longer
    # and less true one deleted floor at a time. It is also what made this session's
    # `CEILING` widening unfalsifiable: narrow the regex back to `FLOOR` and `CRASH_CEILING`
    # simply stops being discovered, with its exemption still sitting here reading as live.
    # 174 §5 is the rule and this is its enforcement: an exclusion nobody re-reads.
    #
    # 🔴 199 §9.3 — AND THIS HALF GETS SHARPER UNDER THE NEW KEY, WHICH IS THE POINT.
    # Under bare names it asked "does this name exist ANYWHERE the walk can see"; a floor
    # that MOVED to another file kept its exemption alive and reading as though it still
    # excused the original. Under (file, name) the exemption goes stale the moment the
    # constant leaves the file its reason is about — which is when the reason stops being
    # true, not whenever the name finally disappears from the tree.
    seen: set[tuple[str, str]] = set()
    for d in DISCOVER_DIRS:
        for f in sorted(d.rglob("*.mjs")):
            if "_to_delete" not in f.parts:
                rel = str(f.relative_to(HOST))
                seen.update((rel, n) for n in DISCOVER_RE.findall(f.read_text()))
    for d in DISCOVER_PY_DIRS:
        for f in sorted(d.rglob("*.py")):
            if "_to_delete" not in f.parts:
                rel = "../" + str(f.relative_to(ROOT))
                seen.update((rel, n) for n in DISCOVER_PY_RE.findall(f.read_text()))
    stale = sorted(f"{f}:{n}" for f, n in DISCOVER_EXEMPT if (f, n) not in seen)

    # ── 🆕 199 §9.4 — THE TABLE READ IN THE OTHER DIRECTION: CAN THE WALK SEE WHAT THIS
    # GATE ALREADY SWEEPS? Everything above asks "is a discovered floor in the table". A
    # floor in the TABLE that the walk CANNOT discover is the failure that makes every
    # widening unfalsifiable — narrow a regex and nothing goes red, because the constants
    # it stops finding are the ones already covered. Asked here, with a declared ceiling.
    undiscoverable = sorted(
        f"{fl}:{seg}"
        for lbl, fl, *_ in TARGETS
        for seg in ([s for s in lbl.split(".") if FLOORISH.match(s)] or [lbl.split(".")[0]])
        if (fl, seg) not in seen and (fl, seg) not in UNDISCOVERABLE_DECLARED)
    if undiscoverable:
        failed = True
        print("🔴 FLOOR_PIN_UNDISCOVERABLE this gate SWEEPS a floor its own DISCOVER half\n"
              "   cannot find:\n"
              + "".join(f"     {u}\n" for u in undiscoverable)
              + "   Either a discovery regex was narrowed (widen it back — the floors it stopped\n"
                "   finding in files NOT in this table went unswept in the same edit and nothing\n"
                "   else would say so), or the constant was renamed to something the walk cannot\n"
                "   recognise. Declare it in UNDISCOVERABLE_DECLARED with a reason if it is real.")
    stale_undisc = sorted(f"{f}:{n}" for f, n in UNDISCOVERABLE_DECLARED if (f, n) in seen)
    if stale_undisc:
        failed = True
        print("🔴 FLOOR_PIN_UNDISCOVERABLE_STALE a constant declared unfindable is now found:\n"
              + "".join(f"     {n}\n" for n in stale_undisc)
              + "   Delete its declaration and lower UNDISCOVERABLE_CEILING in the same commit.")
    for problem in ceiling_problems(len(UNDISCOVERABLE_DECLARED), UNDISCOVERABLE_CEILING):
        failed = True
        print(problem)
    print(f"FLOOR_PIN_UNDISCOVERABLE {len(undiscoverable)} undeclared · "
          f"{len(UNDISCOVERABLE_DECLARED)}/{UNDISCOVERABLE_CEILING} declared — swept floors the "
          f"DISCOVER half cannot name")
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

    # ── 🆕 201 §10.2 — THE OTHER DIRECTION, POINTED AT THE USE SITE ────────────────
    #
    # Everything above mutates a floor DOWN and asks whether the pin notices. That can
    # never reach a live consumer: `got >= 0` is true for every `got`, so a consumer
    # reading a zeroed floor passes and reports nothing. RAISE it instead and the
    # consumer must refuse — unless it is comparing against a literal of its own, which
    # is `C2`, the gap 200's sweep declared green.
    #
    # 🔴 THE CONTROL COMES FIRST, for the reason the control above it does: a consumer
    # that is red before the mutation makes every "reddens" below meaningless.
    use_consumers = sorted({tuple(t[3]) for t in USE_TARGETS})
    for c in use_consumers:
        if not run(list(c)):
            print(f"🔴 FLOOR_PIN_USE_CONTROL {c[0]} does not pass unmutated — the harness "
                  f"is lying, stop.")
            return 1
    print(f"FLOOR_PIN_USE_CONTROL ok — all {len(use_consumers)} consumer(s) pass unmutated")

    unread: list[str] = []
    for label, rel, rx, consumer in USE_TARGETS:
        p = HOST / rel
        text = ORIGINALS.setdefault(p, p.read_text())
        n = len(re.findall(rx, text))
        if n != 1:
            failed = True
            print(f"🔴 FLOOR_PIN_USE_ANCHOR {label}: matched {n} time(s), not once — this "
                  f"row tests NOTHING. Re-anchor it; do not delete the row.")
            continue
        m = re.search(rx, text)
        start = end = m.end(1)
        while text[end].isdigit():
            end += 1
        try:
            p.write_text(text[:start] + USE_RAISE + text[end:])
            green = run(list(consumer))
        finally:
            p.write_text(text)
        if green:
            unread.append(label)
            print(f"🔴 FLOOR_PIN_UNREAD {label} -> {USE_RAISE} and "
                  f"{Path(consumer[0]).name} STAYS GREEN")
        else:
            print(f"  ok   {label:<38} -> {USE_RAISE} reddens {Path(consumer[0]).name}")

    print(f"FLOOR_PIN_UNREAD_COUNT {len(unread)} of {len(USE_TARGETS)}")
    if unread:
        failed = True
        print("\n🔴 The floor(s) above can be RAISED ABOVE THE LIVE VALUE with the consumer\n"
              "   that imports them staying green. That means the consumer is not reading the\n"
              "   import: either it re-inlined a literal of its own, or the comparison was\n"
              "   deleted. Both leave the DECLARATION fully pinned — the self-test still\n"
              "   asserts the value and the sweep above still zeroes it — which is why this\n"
              "   axis exists (200 §35: a constant is defended where it is DECLARED and\n"
              "   unread where it is USED). Restore the import; do not lower the floor.")
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
          f"reddened its runner, all {len(USE_TARGETS)} floor(s) with a live consumer were "
          f"RAISED above it and each reddened that consumer, every reason is free of "
          f"ungoverned numbers, and no unswept floor exists in the tree")
    return 0


if __name__ == "__main__":
    sys.exit(main())
