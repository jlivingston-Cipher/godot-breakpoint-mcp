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

import ast
import atexit
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _gate_lock import acquire, run_and_settle  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
HOST = ROOT / "host"
S, T = "scripts", "test-integration"

# 🔴 THIS GATE'S OWN SCOPE, FLOORED WITH A LITERAL — scope_gate.py's TARGET_FLOOR for the
# same reason, and `>=` because the list is supposed to grow. 181 measured 25.
TARGET_FLOOR = 70   # governed by SIZE_LEDGER (§9.3). 🆕 243 §2 raised it by one:
                    #      `handoff_gate.py`'s SCRIPT_POPULATION_FLOOR, the floor under
                    #      the population the two command rosters are compared against —
                    #      the FOURTH new reader in a row whose first floor was reported
                    #      UNSWEPT by the DISCOVER half before any human read it.
                    # 🆕 216 §1 raised it by one:
                    #      check 1's NAME_FLOOR, on the day check 1 stopped being a
                    #      literal in gitignored scratch and became a tracked file —
                    #      reported UNSWEPT by the DISCOVER half on that file's first
                    #      run, the THIRD new reader in a row to be caught that way.
                    # 213 §2 raised it by one:
                    #      the registry-BYTES reader's ENTRY_FLOOR — the floor under
                    #      a comparison whose HEALTHY answer is "no differences",
                    #      which two empty trees give by construction.
                    #      211 §4 raised it by three: the
                    #      wire classifier's SHAPE_FLOOR — the first floor in that file
                    #      to pin its ANSWER rather than its input — and its self-test's
                    #      own COLLAPSE_SHAPE_FLOOR, which counts the refusals rather
                    #      than trusting a literal in a summary line; and §6 the
                    #      budget reader's own claim floor, which it grew on the day
                    #      it became an instrument roster entry.
                    # 209 §2 raised it by three: the
                    #      wire-diff classifier's SURFACE_FLOOR and its self-test's
                    #      CLAIM_FLOOR, plus the discard gate's DISCARD_BUSIEST_FLOOR —
                    #      the shape floor that exists because the two size floors beside
                    #      it were two files away from never biting again.
                    # 206 §4 raised it again for the
                    #      tool-surface budget's pair. 206 §3 raised it by two for the
                    #      registry-lag reader's TAG_FLOOR and LAG_CEILING, both reported
                    #      UNSWEPT by the DISCOVER half on that file's first run — and
                    #      TAG_FLOOR's pin was NOT load-bearing until this gate said so.
                    # 200 §12.3 admitted
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
    # 🆕 211 §4 — CHECK 8's SECOND FLOOR, AND THE FIRST ONE THAT PINS ITS ANSWER RATHER
    # THAN ITS INPUT. `SURFACE_FLOOR` floors the tool NAMES; this floors the schema PATHS
    # the classifier actually read. Moved off its value, `wire_diff.selftest.mjs`'s six
    # symmetric-collapse rows stop refusing and the file reddens.
    ("SHAPE_FLOOR",              f"{S}/wire_diff.mjs",               r"(export const SHAPE_FLOOR = )2000;",                       [f"{S}/wire_diff.selftest.mjs"]),
    # 🆕 233 — CHECK 8's THIRD AND FOURTH, AND THEY FLOOR THE READER'S VOCABULARY RATHER
    # THAN ITS POPULATION. `SURFACE_FLOOR` pins the tool names and `SHAPE_FLOOR` the
    # schema paths; neither can see a KEYWORD the classifier cannot read, which is the
    # failure that turns a MAJOR into `PATCH`. Zeroed, both go permissive and only the
    # self-test's own assertion bites.
    ("KEY_FLOOR",                f"{S}/wire_diff.mjs",               r"(export const KEY_FLOOR = )10;",                           [f"{S}/wire_diff.selftest.mjs"]),
    ("NODE_FLOOR",               f"{S}/wire_diff.mjs",               r"(export const NODE_FLOOR = )1500;",                        [f"{S}/wire_diff.selftest.mjs"]),
    # 🆕 211 §6 — the budget reader's self-test grew a collapse detector of its own when
    # it became a roster entry, and a collapse detector nothing moves is 176's G12 shape.
    # 🔴 257 — `\d+` RATHER THAN THE VALUE, and it earned it the way every other row in
    # this table that carries one did: the session that gave this file a whole new section
    # raised the detector 18 -> 24 and the anchor matched ZERO times, so the sweep reported
    # a clean pass over a floor it never touched. 194's sentence, a fourth time: an anchor
    # embedding a floor's VALUE is pinned to a number the tree is expected to move.
    ("tc.CLAIM_FLOOR",           f"{S}/token-cost.selftest.mjs",     r"(const CLAIM_FLOOR = )\d+;",                              [f"{S}/token-cost.selftest.mjs"]),
    # 🆕 257 — THE RESULT AXIS'S CEILING. `token-cost.mjs` governed the catalogue and could
    # not see a single result; this is the constant the new axis is judged against, and it
    # is swept for the reason the two above it are: it is read only as `max > CEILING`, so
    # ZEROING IT MAKES THE AXIS STRICTER rather than blind — which no comparison in the
    # self-test would notice on its own. `token-cost.selftest.mjs` therefore asserts the
    # constant BY SHAPE as well as driving it from both sides, the 172 §10.21 form, so a
    # zeroed ceiling reddens on the assertion rather than being absorbed by the rows.
    ("tc.RESULT_BYTES_CEILING",  f"{S}/token-cost.mjs",              r"(export const RESULT_BYTES_CEILING = )\d+;",              [f"{S}/token-cost.selftest.mjs"]),
    # 🆕 219 — the positive-control finder's four, and its self-test's own. All five
    # are asserted BY NAME in `positive_control_gate.selftest.mjs` as well as driven from
    # both sides (at the floor it passes, one past it refuses), so moving any of them off
    # its shipped value reddens that file for two independent reasons rather than one.
    # 🆕 225 — THE TWO GATES THIS SESSION ADDED. Both floors are used only as
    # `len(x) < FLOOR`, so ZEROING THEM MAKES THE GATE MORE PERMISSIVE, not less — the
    # mutation that this sweep applies is exactly the one those two gates would not
    # notice on their own. Each selftest therefore asserts its own literal against the
    # live tree, which is what turns an unfalsifiable floor into a pinned one.
    ("mutlock.GUARDED_FLOOR",   "../scripts/mutation_lock_gate.py", r"(GUARDED_FLOOR = )5",                                      ["../scripts/mutation_lock_gate.py", "--selftest"]),
    ("term.TERM_FLOOR",         "../scripts/terminology_gate.py",   r"(TERM_FLOOR = )1",                                         ["../scripts/terminology_gate.py", "--selftest"]),
    # 🆕 233 — THE SUFFIX DISCOVER HALF'S TWO, AND THEY ARE `TERM_FLOOR`'s SHAPE EXACTLY:
    # both are used only as `len(x) < FLOOR`, so ZEROING THEM MAKES THE GATE MORE
    # PERMISSIVE and its live run cannot notice. `--selftest` asserts each literal above
    # zero against the live tree, which is what turns an unfalsifiable floor into a
    # pinned one (225's rule, third file).
    ("term.TRACKED_FLOOR",      "../scripts/terminology_gate.py",   r"(TRACKED_FLOOR = )250",                                    ["../scripts/terminology_gate.py", "--selftest"]),
    ("term.SUFFIX_FLOOR",       "../scripts/terminology_gate.py",   r"(SUFFIX_FLOOR = )10",                                      ["../scripts/terminology_gate.py", "--selftest"]),
    # 🆕 227 — THE SPEC SCANNER'S, AND IT IS THE SAME SHAPE AS THE TWO ABOVE: used only
    # as `files_read < FLOOR`, so zeroing it makes the gate MORE permissive and the live
    # `--check` cannot notice. Its `--selftest` therefore asserts the literal against the
    # live tree from both sides, which is what makes this row a pin rather than a visit.
    ("spec.SCANNED_FLOOR",      "../scripts/spec_conformance.py",   r"(SCANNED_FLOOR = )120",                                    ["../scripts/spec_conformance.py", "--selftest"]),
    # 🆕 230 — THE LINT CEILING'S ONE NUMBER, AND IT IS THE SAME SHAPE AS THE THREE ABOVE:
    # read only as `files_read < FLOOR`, so zeroing it makes the gate MORE permissive and
    # the live run cannot notice. Its `--selftest` asserts the literal against the live
    # `git ls-files` count from both sides. 🔴 The roster it guards is `CLASS_CEILING`,
    # which is exempt below for the reason a dict of prose reasons is not a threshold.
    ("lint.PY_FILE_FLOOR",      "../scripts/lint_ceiling.py",       r"(PY_FILE_FLOOR = )18",                                     ["../scripts/lint_ceiling.py", "--selftest"]),
    # 🆕 242 — THE SAME FLOOR OVER THE JS HALF, AND IT IS FLOORED AND NOT EQUALLED. The
    # `.py` population is eighteen gates; the `.mjs` population is gates, probes and demo
    # scripts and grows whenever a plane gets one. `--selftest` asserts it from both sides
    # — at or under the live count, refusing one below, quiet one above.
    ("lint.MJS_FILE_FLOOR",     "../scripts/lint_ceiling.py",       r"(MJS_FILE_FLOOR = )65",                                    ["../scripts/lint_ceiling.py", "--selftest"]),
    # 🆕 242 — the handoff reader's floor over its READ OF THE WORKFLOW FILES. A regex
    # that stopped matching reports an empty CI roster, and an empty CI roster agrees
    # with every replay list ever written. Pinned from both sides by `--selftest`.
    ("handoff.CI_SCRIPT_FLOOR", "../scripts/handoff_gate.py",       r"(CI_SCRIPT_FLOOR = )55",                                   ["../scripts/handoff_gate.py", "--selftest"]),
    # 🆕 243 — the same reader's floor over its READ OF THE TREE. `CI_SCRIPT_FLOOR` floors
    # what it finds in the workflow files; this floors the population those rosters are
    # compared AGAINST. `git ls-files` answering with nothing yields an empty population,
    # no unreached findings and a green run that opened no files — the same quiet pass,
    # one input over. Pinned from both sides by `--selftest`.
    ("handoff.SCRIPT_POPULATION_FLOOR", "../scripts/handoff_gate.py",  r"(SCRIPT_POPULATION_FLOOR = )80",                           ["../scripts/handoff_gate.py", "--selftest"]),
    # 🆕 234 — THE HANDOFF READER'S TWO, AND THEY FLOOR THE TWO WAYS IT CAN GO QUIET.
    # `CLAIM_FLOOR` is the parse: a reader whose regexes stop matching the block reads
    # zero atoms, disagrees with nothing and prints ok, which is `scope_gate.py`'s quiet
    # pass inside the one instrument whose subject is claims nobody checks. `READER_FLOOR`
    # is the roster: the DROPPED-COUNTER direction is only enforceable while the rows that
    # enforce it exist. 🔴 BOTH ARE PINNED FROM ABOVE AS WELL AS BELOW by `--selftest`,
    # against two real parses rather than a constant — 233's own block (23 atoms) and a
    # headline-only fixture (7) — so a floor RAISED out of range fails as loudly as one
    # zeroed. 184 §7: pinning the key is not pinning the value.
    ("handoff.CLAIM_FLOOR",     "../scripts/handoff_gate.py",       r"(CLAIM_FLOOR = )15",                                       ["../scripts/handoff_gate.py", "--selftest"]),
    ("handoff.READER_FLOOR",    "../scripts/handoff_gate.py",       r"(READER_FLOOR = )28",                                      ["../scripts/handoff_gate.py", "--selftest"]),
    # 🆕 244 §2 — `population-reach-floor` (239). NOT a floor on a count: it is the OLDEST
    # SESSION `BLOCK_POPULATION` has ever held, and the row exists because every other
    # floor on that table counts it. Lifted, the live table starts before its own pin and
    # `POPULATION_REACH` reddens; the sliding-window control one claim down is what makes
    # that a refusal rather than an arithmetic identity.
    ("handoff.POPULATION_REACH_FLOOR", "../scripts/handoff_gate.py", r"(POPULATION_REACH_FLOOR = )227",                              ["../scripts/handoff_gate.py", "--selftest"]),
    # 🆕 244 §4 — THE THREE P0 REPORTERS' FLOORS, WHICH `FLOOR_PIN_UNSWEPT` ASKED FOR
    # WITHIN THE MINUTE OF THEIR EXISTING. Each is the refusal that makes its reporter
    # sweepable at all (`p0-reporters-unblinded`, 241), so a floor nothing re-derives
    # here would be the same unfalsifiable constant one layer under the fix. One key per
    # reporter is lifted rather than the whole dict: the key each file's own `a healthy
    # population is accepted` claim is measured against, so the runner reddens for the
    # reason the row is about rather than for arithmetic.
    ("p0cx.FLOOR.functions",    f"{S}/p0_complexity.mjs",           r"(\n  functions: )900,",                                    [f"{S}/p0_complexity.selftest.mjs"]),
    ("p0td.FLOOR.tests",        f"{S}/p0_testdup.mjs",              r"(\n  tests: )600,",                                        [f"{S}/p0_testdup.selftest.mjs"]),
    ("p0cm.FLOOR.rows",         "../scripts/p0_comments.py",        r"(\n    \"rows\": )9000,",                                    ["../scripts/p0_comments.py", "--selftest"]),
    # 🆕 235 §3 — the HEADER half's parse, pinned the same way and for the same reason:
    # `counter_atoms` starts at `VERIFIED`, so the four labelled rows above it went
    # unread while this file's own `NUMERAL_PINS` carried a fixture for the npm line. A
    # header parse that stops matching reads zero atoms and agrees with `tags 121`.
    ("handoff.HEADER_FLOOR",    "../scripts/handoff_gate.py",       r"(HEADER_FLOOR = )2",                                       ["../scripts/handoff_gate.py", "--selftest"]),
    # 🆕 238 §2 — the alias walk's population, pinned the same way and for the reason the
    # other two floors exist: `ALIAS_POPULATION` and `ALIAS_UNUSED` are both SATISFIED by
    # eleven blocks that stopped parsing, so the coverage claim needs a floor that is not.
    ("handoff.ALIAS_SPELLING_FLOOR", "../scripts/handoff_gate.py",   r"(ALIAS_SPELLING_FLOOR = )76",                              ["../scripts/handoff_gate.py", "--selftest"]),
    # 🆕 240 — THE QUEUE GATE'S TWO, AND THEY ARE THE FIRST FLOORS IN THIS TABLE THAT PIN
    # A POLICY RATHER THAN A POPULATION. `AGE_CEILING` is the number of sessions an item
    # may sit OPEN before a decision is owed, and a session that found its own queue red
    # could clear it by editing one integer — which is why it is swept from here and
    # pinned ABSOLUTELY in `queue_gate.py --selftest` (a row opened at 232 is admitted at
    # head 240 and one opened at 231 is refused, by session number rather than by
    # arithmetic on the constant). `QUEUE_ROW_FLOOR` is `len(rows) < FLOOR`, so zeroing
    # it makes the gate MORE permissive and its live run cannot notice — `TERM_FLOOR`'s
    # shape exactly.
    ("queue.AGE_CEILING",       "../scripts/queue_gate.py",         r"(AGE_CEILING = )8",                                        ["../scripts/queue_gate.py", "--selftest"]),
    ("queue.QUEUE_ROW_FLOOR",   "../scripts/queue_gate.py",         r"(QUEUE_ROW_FLOOR = )20",                                   ["../scripts/queue_gate.py", "--selftest"]),
    ("pc.CLAIM_FLOOR",           f"{S}/positive_control_gate.mjs",   r"(export const CLAIM_FLOOR = )40;",                         [f"{S}/positive_control_gate.selftest.mjs"]),
    ("pc.FILE_FLOOR",            f"{S}/positive_control_gate.mjs",   r"(export const FILE_FLOOR = )90;",                          [f"{S}/positive_control_gate.selftest.mjs"]),
    ("pc.DEFECT_CEILING",        f"{S}/positive_control_gate.mjs",   r"(export const DEFECT_CEILING = )15;",                      [f"{S}/positive_control_gate.selftest.mjs"]),
    ("pc.RESIDUE_CEILING",       f"{S}/positive_control_gate.mjs",   r"(export const RESIDUE_CEILING = )1;",                      [f"{S}/positive_control_gate.selftest.mjs"]),
    ("pc.CLAIM_FLOOR_SELF",      f"{S}/positive_control_gate.selftest.mjs", r"(const CLAIM_FLOOR_SELF = )58;",                    [f"{S}/positive_control_gate.selftest.mjs"]),
    ("wd.COLLAPSE_SHAPE_FLOOR",  f"{S}/wire_diff.selftest.mjs",      r"(const COLLAPSE_SHAPE_FLOOR = )6;",                        [f"{S}/wire_diff.selftest.mjs"]),
    ("SUBJECT_FLOOR",            f"{S}/verdict_gate.mjs",            r"(export const SUBJECT_FLOOR = )4;",                        [f"{S}/verdict_gate.selftest.mjs"]),
    ("DISCARD_SITE_FLOOR",       f"{S}/verdict_gate.mjs",            r"(export const DISCARD_SITE_FLOOR = )55;",                  [f"{S}/verdict_gate.selftest.mjs"]),
    ("DISCARD_DIR_FLOOR",        f"{S}/verdict_gate.mjs",            r"(export const DISCARD_DIR_FLOOR = )2;",                    [f"{S}/verdict_gate.selftest.mjs"]),
    # 🆕 209 — THE FLOOR THAT EXISTS BECAUSE THE TWO ABOVE WERE TWO FILES FROM SILENCE.
    # `DISCARD_SITE_FLOOR` catches a blinded finder only while the tree holds fewer
    # walkable .mjs files than the floor; this session's two new files crossed that line
    # and the late blind went green. This one reads the population's SHAPE instead, so
    # its bite does not depend on an unrelated count.
    ("DISCARD_BUSIEST_FLOOR",    f"{S}/verdict_gate.mjs",            r"(export const DISCARD_BUSIEST_FLOOR = )30;",               [f"{S}/verdict_gate.selftest.mjs"]),
    ("vg.CLAIM_FLOOR",           f"{S}/verdict_gate.selftest.mjs",   r"(const CLAIM_FLOOR = )69;",                                [f"{S}/verdict_gate.selftest.mjs"]),
    ("CONST_FLOOR",              f"{S}/boundary_gate.mjs",           r"(export const CONST_FLOOR = )20;",                         [f"{S}/boundary_gate.selftest.mjs"]),
    ("OP_FLOOR",                 f"{S}/boundary_gate.mjs",           r"(export const OP_FLOOR = )150;",                           [f"{S}/boundary_gate.selftest.mjs"]),
    ("TOOL_FLOOR",               f"{S}/boundary_gate.mjs",           r"(export const TOOL_FLOOR = )150;",                         [f"{S}/boundary_gate.selftest.mjs"]),
    ("SITE_FLOOR",               f"{S}/boundary_gate.mjs",           r"(export const SITE_FLOOR = )1500;",                        [f"{S}/boundary_gate.selftest.mjs"]),
    ("RETURN_FLOOR",             f"{S}/boundary_gate.mjs",           r"(export const RETURN_FLOOR = )150;",                       [f"{S}/boundary_gate.selftest.mjs"]),
    ("PLANE_FLOOR",              f"{S}/boundary_gate.mjs",           r"(export const PLANE_FLOOR = )2;",                          [f"{S}/boundary_gate.selftest.mjs"]),
    # 🆕 233 — THE DISCOVER HALF'S TWO, AND THE OLD `PLANE_FLOOR` ONE LINE UP IS WHY THEY
    # EXIST: it pins how many planes are READ and is satisfied, permanently, by a tree
    # that ships a third dispatcher nobody grades. These floor the WALK and the SHAPE
    # READER — two numbers, never a sum (172 §6), because a walk that reads eight files
    # while `dispatcherShaped` recognises none is the same collapse one layer in.
    ("PLANE_WALK_FLOOR",         f"{S}/boundary_gate.mjs",           r"(export const PLANE_WALK_FLOOR = )6;",                     [f"{S}/boundary_gate.selftest.mjs"]),
    ("PLANE_DISPATCH_FLOOR",     f"{S}/boundary_gate.mjs",           r"(export const PLANE_DISPATCH_FLOOR = )2;",                 [f"{S}/boundary_gate.selftest.mjs"]),
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
    # 🆕 206 — THE REGISTRY-LAG READER'S TWO CONSTANTS. Reported UNSWEPT by the
    # DISCOVER half on this file's FIRST run, which is 184 §7 happening again on a new
    # file and is that fix still working. 🔴 AND THE REPORT WAS LOAD-BEARING: as first
    # written, zeroing `TAG_FLOOR` reddened NOTHING — an empty tag list fell through to
    # the never-tagged branch and returned the same -1 for a different reason, so the
    # self-test agreed with itself over a deleted floor. The fix was to make the table
    # check the REASON and to run the floor's own rows under the LIVE constant. 180
    # §7.3's shape, found by the gate built for it rather than by reading.
    ("TAG_FLOOR",                "../scripts/registry_lag.py",             r"(TAG_FLOOR = )100",                                        ["../scripts/registry_lag.py", "--selftest"]),
    # 🆕 206 §4, LOWERED 208 — THE TOOL-SURFACE BUDGET. `BYTES_CEILING` is a ceiling that
    # is ALREADY too high: the surface measures ~1,210 B/tool against an alternative's measured
    # ~634, so it is here to stop drift while the surface is paid down rather than to
    # bless the current size. 🔴 208 LOWERED IT WITHOUT TRIMMING ANYTHING — two fields the
    # SDK emits and nobody here authored left the wire, so the ceiling followed the
    # surface down rather than the other way round. `TOOL_FLOOR` is the usual collapse
    # guard — a reader listing zero tools would otherwise report a wonderfully small
    # surface and pass.
    ("BYTES_CEILING",            f"{S}/token-cost.mjs",              r"(export const BYTES_CEILING = )366220;",                  [f"{S}/token-cost.selftest.mjs"]),
    ("tc.TOOL_FLOOR",            f"{S}/token-cost.mjs",              r"(export const TOOL_FLOOR = )250;",                         [f"{S}/token-cost.selftest.mjs"]),
    # 🆕 207 §7.1 — THE COMPONENT A COMPARISON MAY HONESTLY QUOTE. The alternative's
    # published figure was REPRODUCED this session (319 tools, 202,327 B, every one of
    # their ten per-group numbers exact), and the reproduction refuted what 206 read out
    # of it: our input schemas are within 9% of theirs on 28 FEWER tools, while four
    # optional keys they do not ship at all are 38% of our surface. `BYTES_CEILING`
    # moves when one of those four is added or dropped; this one does not, which is why
    # the honest number needs its own floor. 🔴 208 PRICED THOSE FOUR AND THE ANSWER MOVED
    # THIS ONE TOO: the input schema was carrying a dialect declaration nobody authored,
    # so the quotable number fell 520 -> 468 B/tool against their 433 — the gap this
    # governs is 1.08x where 207 measured 1.20x.
    ("SCHEMA_PER_TOOL_CEILING", f"{S}/token-cost.mjs",              r"(export const SCHEMA_PER_TOOL_CEILING = )490;",            [f"{S}/token-cost.selftest.mjs"]),
    ("LAG_CEILING",              "../scripts/registry_lag.py",             r"(LAG_CEILING = )3",                                        ["../scripts/registry_lag.py", "--selftest"]),
    ("UNTAGGED_CEILING",         "../scripts/registry_lag.py",             r"(UNTAGGED_CEILING = )8",                                   ["../scripts/registry_lag.py", "--selftest"]),
    # 🆕 213 §2 — THE REGISTRY-BYTES READER'S FLOOR. Its verdict is a COUNT OF
    # DIFFERENCES and zero is the healthy reading, so 181 §5's problem applies to the
    # POPULATION rather than to the answer: two EMPTY trees are byte-identical by
    # construction, and an empty tree is exactly what a pack that failed quietly or an
    # extraction into the wrong directory produces. `ENTRY_FLOOR` is what makes that
    # green line mean the comparison happened at all. Its rows run under the LIVE
    # constant for TAG_FLOOR's reason twenty lines up.
    ("ENTRY_FLOOR",              "../scripts/registry_bytes.py",           r"(ENTRY_FLOOR = )60",                                       ["../scripts/registry_bytes.py", "--selftest"]),
    # 🆕 220 — CHECK FIVE'S FLOOR, AND THE FIRST IN THIS ROSTER WHOSE POPULATION IS A
    # SUBTREE OF ANOTHER FLOOR'S POPULATION. `ENTRY_FLOOR` one line up floors the whole
    # package; this floors the ADDON INSIDE it. It has to be its own number rather than
    # reusing sixty — the addon is twelve entries against the package's eighty-two, so
    # sixty would refuse every healthy run, and a floor that cannot be met is a floor the
    # first reader lowers to zero. 🔴 ITS COLLAPSE IS PROVED BY A PAIR, NOT A ROW:
    # `_to_delete/mutate220.py`'s M3 empties the subtree and the live reader answers
    # C5_ADDON_UNMEASURABLE; M4 empties it AND zeroes this constant, and the same empty
    # comparison comes back C5_OK. The floor is the whole difference between them.
    ("ADDON_ENTRY_FLOOR",        "../scripts/registry_bytes.py",           r"(ADDON_ENTRY_FLOOR = )10",                                 ["../scripts/registry_bytes.py", "--selftest"]),
    # 🆕 216 §1 — CHECK 1's POPULATION FLOOR, on the day check 1 became a tracked file.
    # Reported UNSWEPT by the DISCOVER half on this file's FIRST run — 184 §7 happening
    # again on a new file, for the THIRD reader in a row, which is that fix still working.
    # 🔴 AND THE REPORT WAS LOAD-BEARING TWICE OVER. It also named `FLOOR_COLLAPSED` and
    # `MINOR_FLOOR`, which were REFUSAL CODES and not floors at all — floor-shaped only
    # because they had been named after the floor they report. They are
    # `POPULATION_COLLAPSED` and `MINOR_POPULATION` now. A gate that cannot tell a floor
    # from a string named like one is right to ask, and the answer was to stop lying in
    # the name rather than to widen an exemption table.
    # 🔴 THIS FLOOR IS THE ONE 215 §3's FIRST DEFECT WAS MEASURED AGAINST, so its rows
    # run under the LIVE constant for TAG_FLOOR's reason: the self-test's counterfactual
    # compares the 1.73.2 block's two populations to `NAME_FLOOR` itself, and passing the
    # floor in as an argument is what makes moving it redden at all.
    ("NAME_FLOOR",               "../scripts/release_names.py",            r"(NAME_FLOOR = )5",                                         ["../scripts/release_names.py", "--selftest"]),
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
    # 🆕 209 — CHECK 8's ONLY NUMBER, AND IT GUARDS THE ONE SILENCE THE CLASSIFIER CANNOT
    # REPORT ITS WAY OUT OF. `wire_diff.mjs` compares two `tools/list` payloads; two reads
    # that both returned NOTHING agree perfectly and answer PATCH. Every other row in its
    # self-test drives two populated surfaces, so this floor is the only thing between
    # "the public API held still" and "neither server started", and moving it must redden.
    ("SURFACE_FLOOR",             f"{S}/wire_diff.mjs",              r"(export const SURFACE_FLOOR = )200;",                      [f"{S}/wire_diff.selftest.mjs"]),
    ("wd.CLAIM_FLOOR",            f"{S}/wire_diff.selftest.mjs",     r"(const CLAIM_FLOOR = )50;",                                [f"{S}/wire_diff.selftest.mjs"]),
    # 🆕 231 — AND THE SAME SILENCE ONE READER OVER, WHERE IT IS TWO SILENCES RATHER THAN
    # ONE. `wire_invisible_gate.mjs` walks the ZOD instead of the wire, so it can collapse
    # in two independent ways: the surface fails to load (no tools, `TOOL_FLOOR`) or the
    # walker stops descending (every tool registered, no refinements read, `FACT_FLOOR`) —
    # 211 §4's finding, which is why `wire_diff.mjs` above needed a second floor too.
    # 🔴 BOTH ARE PROVED BEHAVIOURALLY RATHER THAN ASSERTED. Their self-test rows require
    # the gate to REFUSE an empty population, so a floor moved to 0 refuses nothing and
    # the row that expects a refusal fails — no `> 0` claim needed to make the mutation
    # visible, which is 180 §7.3's trap closed at the input instead of beside it.
    ("wig.TOOL_FLOOR",            f"{S}/wire_invisible_gate.mjs",    r"(export const TOOL_FLOOR = )200;",                         [f"{S}/wire_invisible_gate.selftest.mjs"]),
    ("wig.FACT_FLOOR",            f"{S}/wire_invisible_gate.mjs",    r"(export const FACT_FLOOR = )200;",                         [f"{S}/wire_invisible_gate.selftest.mjs"]),
    # 🆕 255 — AND A THIRD SILENCE IN THE SAME READER, WHICH IS THE ONE THE OTHER TWO
    # CANNOT STAND IN FOR. `TOOL_FLOOR` and `FACT_FLOOR` both count things; `SITE_FLOOR`
    # counts DISTINCT things, and an identity function that has stopped distinguishing them
    # moves neither of the other two. It exists because emptying the roster took the last
    # reader off `siteKey` — every roster rule fires only on a rostered class — and
    # `instrument_gate.py`'s late blind of it went green on the run that emptied the table.
    ("wig.SITE_FLOOR",            f"{S}/wire_invisible_gate.mjs",    r"(export const SITE_FLOOR = )150;",                         [f"{S}/wire_invisible_gate.selftest.mjs"]),
    ("wig.CLAIM_FLOOR",           f"{S}/wire_invisible_gate.selftest.mjs", r"(const CLAIM_FLOOR = )22;",                          [f"{S}/wire_invisible_gate.selftest.mjs"]),
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
    r"^\s*(?:export )?const ((?:[A-Za-z_][A-Za-z0-9_]*)?(?:FLOOR|CEILING)S?(?:_[A-Z0-9]+)*)\s*=",
    re.M)
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
    r"^\s*((?:[A-Za-z_][A-Za-z0-9_]*)?(?:FLOOR|CEILING)S?(?:_[A-Z0-9]+)*)\s*[:=]", re.M)
# The name shape both walks look for, as ONE definition — used again in `main()` to read
# a TARGETS label. Two spellings of the same rule would drift (180 §7.1).
# 🆕 211 §2 — AND THE CONVENTION WAS TERMINAL WHEN THE NAMES ARE NOT. Widened for a
# PREFIX in 199 and for the plural in 199; nobody widened for a SUFFIX, and two live
# ceilings sit past it. Measured (`probe211.py`): `LATE_CRASH_CEILING_A` and
# `LATE_CRASH_CEILING_B` (instrument_gate.py:680-681, consumed at :1566) match NONE of
# the three readers — not DISCOVER, not DISCOVER_PY, not SIZE_LEDGER — and appear in no
# exemption table either. Not swept, not exempt, not declared: outside the gate with no
# line anywhere saying so, which is the exact sentence DISCOVER_RE's own comment uses
# about the case it was written to end.
#
# 🔴 THE DISCRIMINATOR WAS NEVER "ENDS IN", IT WAS "CONTAINS THE WORD". `_A`/`_B` is a
# pair-of-measurements suffix, and a constant named `..._CEILING_A` is a ceiling by the
# same argument the file already makes for `..._CEILING`: a constant whose NAME says it
# is a floor IS a floor, whatever is appended to distinguish it from its twin.
FLOORISH = re.compile(r"^(?:[A-Za-z_][A-Za-z0-9_]*)?(?:FLOOR|CEILING)S?(?:_[A-Z0-9]+)*$")

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
UNDISCOVERABLE_CEILING = 0   # 🔴 IT FELL, AS 199 — SAID IT SHOULD, AND IT STAYS ONE:
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
    # 🆕 211 §2 — THE PRICE OF THE SUFFIX WIDENING, PAID IN THE TABLE RATHER THAN IN THE
    # REGEX. Admitting `..._A`/`..._B` also admits two names that CONTAIN the word and
    # are not numbers at all. That is this file's own doctrine working as designed —
    # "a constant whose NAME says it is a floor IS a floor, whatever it is bound to; the
    # tables below decide what to do about it, and that is their job rather than the
    # regex's" — so the two land here, with the reason a reader could not mistake for
    # 'not done yet'. 🔴 NARROWING THE REGEX TO EXCLUDE THEM WOULD RE-EXCLUDE THE TWO
    # LIVE CEILINGS IT WAS WIDENED FOR, which is the trade 199 §8 refuses.
    (f"{S}/tautology_gate.mjs", "FLOOR_RE"): "🆕 211 — a REGEX, not a number: `FLOOR_RE` is the pattern tautology_gate uses "
                "to decide whether a claim site sits under a floor. There is no value to mutate "
                "off and no threshold to move; blinding it is the instrument gate's job and it "
                "is already a `{SIG:}` target there",
    ("../scripts/lint_ceiling.py", "CLASS_CEILING"): "🆕 230 — a DICT of pyflakes message classes mapped to (ceiling, prose reason), "
                "not a threshold. There is no single value to mutate off: the sweep would have to "
                "pick one row, and every row's refusal is already driven from both sides in that "
                "file's `--selftest` — including the case a total would miss, six findings before "
                "and six after with one of them a duplicate key. Its POPULATION floor "
                "(`PY_FILE_FLOOR`) is swept in SIZE_LEDGER above",
    ("../scripts/lint_ceiling.py", "TS_CLASS_CEILING"): "🆕 242 — the same shape as `CLASS_CEILING` one row up, one language over: a "
                "DICT of `tsc` diagnostic classes mapped to (ceiling, prose reason), not a "
                "threshold. Same argument, and the same population floor answering for it — "
                "`MJS_FILE_FLOOR` is swept in SIZE_LEDGER above",
    (f"{T}/_path_ledger.mjs", "COHORT_FLOOR_WHY"): "🆕 211 — a STRING of prose explaining why the cohort floors are set where "
                       "they are. The floors themselves (`COHORT_FLOORS`) are swept; this is their "
                       "caption, and a caption has no refusal to prove",
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
    # 🆕 233 — THE SEVENTH, AND ITS SUBJECT IS AN EXCLUSION RATHER THAN A POPULATION.
    # `CI_COMMAND_FLOOR` floors how many `run: node …` steps the reader finds in ci.yml
    # before it is allowed to believe any `LATE_LIVE_NA` row; a regex that stopped
    # matching would check every excuse against nothing and pass. Pinned in-file by
    # `_self_check()` in both directions — the literal above zero, and the LIVE ci.yml
    # read against it — for INSTRUMENT_FLOOR's nesting reason.
    ("../scripts/instrument_gate.py", "CI_COMMAND_FLOOR"): "🆕 233 — instrument_gate.py's floor on how many node steps it reads out of "
                        "ci.yml before trusting a LATE_LIVE_NA row. Pinned in-file by `_self_check()`, "
                        "which fails if it is not positive AND if the live workflow yields fewer than "
                        "it. Same nesting reason as INSTRUMENT_FLOOR",
    ("../scripts/instrument_gate.py", "LATE_LIVE_FLOOR"): "🆕 183 — instrument_gate.py's floor on the LIVE-axis roster, pinned in the "
                       "same `_self_check()` by asserting the branch bites on an empty roster. It "
                       "exists because LATE_CONSTRUCTED_FLOOR cannot see a roster shrink: deleting "
                       "the three caller-shape entries takes about an eighth off the constructed "
                       "blinds and leaves the count comfortably above that floor. Same nesting "
                       "reason as INSTRUMENT_FLOOR",
    # 🆕 197 — instrument_gate.py's fifth and sixth, same nesting reason as the four above.
    # 🆕 211 §2 — THE TWO THIS GATE COULD NOT SEE UNTIL THIS SESSION, and their exemption
    # is the SAME one `CRASH_CEILING` below carries, arriving five sessions late for the
    # only reason that matters: 🔴 THE DISCOVERY REGEX COULD NOT NAME THEM. 197 widened
    # for `CEILING`, 199 for the plural and the prefix, 200 dropped the value half —
    # every widening terminal, and these two end in `_A`/`_B`. Not swept, not exempt, not
    # in SIZE_LEDGER, not in UNDISCOVERABLE_DECLARED: outside all three readers with no
    # line anywhere saying so, which is the exact case DISCOVER_RE's comment says the
    # tables exist to prevent. They are exempt HERE for the nesting reason, not for the
    # naming one, and the naming one is fixed above.
    ("../scripts/instrument_gate.py", "LATE_CRASH_CEILING_A"): "🆕 211 — instrument_gate.py's per-axis ceilings on late blinds that CRASH "
                             "their gate rather than reddening it, kept as two numbers rather than one sum "
                             "so an axis cannot borrow the other's headroom. Exempt for INSTRUMENT_FLOOR's "
                             "reason — the runner would be instrument_gate.py, which mutates the working "
                             "tree — and pinned in-file by `_self_check()`, which drives `crash_problems` "
                             "over a two-crash fixture against a ceiling of one and requires it to bite",
    ("../scripts/instrument_gate.py", "LATE_CRASH_CEILING_B"): "same constant one axis over, same pinning, same nesting reason",
    # 🆕 232 — THE TWO FLOORS THE DISCOVER HALF BROUGHT WITH IT (231 §5.1's item, built).
    # Same nesting reason as the six rows above — the runner would be instrument_gate.py,
    # which mutates the working tree (178 §11.4) — and both are pinned in-file by
    # `_self_check()`, which drives the walk over fixtures a healthy tree cannot produce.
    ("../scripts/instrument_gate.py", "DISCOVER_FLOOR"): "🆕 232 — instrument_gate.py's floor on the files its own DISCOVER walk reaches. "
                        "Pinned in `_self_check()`, which runs the walk over an EMPTY population and "
                        "requires the refusal to bite, and which also refuses the floor itself at or "
                        "below zero (231 §5.5's trap, recorded in the session that hit it)",
    ("../scripts/instrument_gate.py", "DISCOVER_MODULE_FLOOR"): "🆕 232 — the same walk's floor on the EXPORT-BEARING half, kept as a second "
                               "number rather than folded into the row above: a walk that still reads every "
                               "file while its module reader dies is a collapse the file count cannot see "
                               "(172 §6, never a sum). Pinned in the same `_self_check()` on a fixture whose "
                               "files all export nothing",
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
                        "instrument. 🔴 THE `B:live` HALF IS NO LONGER ABSENT — 245 §3 paid "
                        "`late-live-blast-unfloored`, and the sentence that used to sit here "
                        "(\"four of that axis's five commands print no per-claim FAIL line\") had "
                        "been false for two sessions and described five files rather than an axis "
                        "that has since grown to seventeen commands. See LATE_LIVE_BLAST_FLOOR",
    ("../scripts/instrument_gate.py", "LATE_LIVE_BLAST_FLOOR"): "🆕 245 §3 — instrument_gate.py's PER-INSTRUMENT floors on the LATE "
                        "axis's `B:live` half, the twin of the row above and exempt for the same "
                        "reason: its runner mutates the working tree. Pinned in-file by "
                        "`_self_check()` (every value positive) and by three `main()` assertions "
                        "that no row names a missing instrument, that no instrument is both "
                        "floored and declared uncountable, and — the one that matters — that a "
                        "row in `LATE_LIVE_BLAST_UNCOUNTABLE` is REFUSED the moment its "
                        "instrument reports a nonzero blast on that axis. An exclusion whose "
                        "own run can falsify it does not need a session to re-read it",
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
    ("../scripts/floor_pin_gate.py", "COMMENT_FLOOR"):
        "🆕 202 §6 — THIS file's floor over the declaration comments its own reason rule "
        "reads. Same nesting reason as the two below: its runner would be floor_pin_gate.py "
        "itself. 🔴 AND IT COULD NOT BE A TARGETS ROW EVEN IF IT WERE NOT NESTED, which is "
        "201 §32's direction lesson arriving inside the fix for it — every TARGETS row is "
        "mutated toward zero, and `len(comments) < 0` is false, so zeroing this floor is "
        "the mutation it survives for free. Pinned in-file by `_self_check()`, which feeds "
        "`comment_problems()` an EMPTY set it must flag and a full clean set it must not.",
    ("../scripts/floor_pin_gate.py", "SHORTFALL_FLOOR"):
        "🆕 229 §7.4 — THIS file's floor over the shortfall refusals its own cause rule "
        "reads, exempt for the same paired reason as the row below: nested, because its "
        "runner would be floor_pin_gate.py itself, and directional, because every TARGETS "
        "row is mutated toward zero and this comparison cannot bite at zero. `_self_check()` "
        "covers both halves — the predicate is fed a refusal that ASSERTS one cause and "
        "must flag it, one that LISTS two and one that asserts NONE and must stay quiet on "
        "both, and an empty population below the floor it must flag; and the reader in "
        "front of it is pointed at a written file holding one refusal and one line that is "
        "not one, so a finder that stopped finding is caught where a zeroed literal is not.",
    ("../scripts/floor_pin_gate.py", "SHORTFALL_LITERAL_FLOOR"):
        "🆕 242 — the SAME floor over the SECOND reader, exempt for the identical paired "
        "reason as the row above: nested runner, and a comparison that cannot bite at "
        "zero. It exists because one floor over the sum of two readers is a total and not "
        "a floor: the `ast` half could stop matching entirely and the literal half alone "
        "would still clear any threshold set beneath the combined live read. "
        "`_self_check()` proves the three directions that matter — the python floor "
        "refusing over a population that is entirely literal, the literal floor refusing "
        "over one that is entirely python, and neither refusing a population that meets "
        "both — and points the literal reader at a written directory holding one refusal "
        "per quote character across the three languages it claims.",
    ("../scripts/floor_pin_gate.py", "LITERAL_KEY_FLOOR"):
        "🆕 229 §6b — THIS file's floor over the constant keys its repeat-key reader gets "
        "through, and it is exempt for BOTH of the reasons the two rows below give at once. "
        "Nested: its runner would be floor_pin_gate.py itself. And direction: every TARGETS "
        "row is mutated toward zero, and a floor at zero is the one value this comparison "
        "cannot bite on, so the mutation that matters here is the one that empties the "
        "READER rather than the one that empties the number. `_self_check()` does both — it "
        "feeds `repeat_key_problems()` a population one below the floor that it must flag "
        "and one AT the floor that it must not, and it points `literal_keys()` at a written "
        "directory holding a clean literal, a duplicated key and a file that does not parse, "
        "so a walk that stopped walking is caught where a zeroed literal never would be.",
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
# 🆕 211 §2 — AND THE RANGE WAS A CALENDAR WITH AN EXPIRY DATE IN IT. `(?:1[5-9]\d|20\d)`
# recognises 150-209 and NOTHING ELSE. Measured (`probe211.py`): '209 §2' is read as a
# citation and scrubbed; 🔴 '210 §2' and '211 §5' are not, so the digit survives the scrub
# and `FLOOR_PIN_REASON_DIGIT` fires on the next session that cites itself in a reason —
# which is the house style this gate's own reasons are written in. 209 was the last
# session the window covered and 210 shipped without touching a reason, by luck.
#
# 🔴 THIS IS 210 §16's RULE ARRIVING AT THIS FILE. The comment above is right that a
# citation is identified by what FOLLOWS it rather than by its range — and then the
# pattern encodes a range anyway. The lookahead is the rule; three digits are enough to
# separate a citation from the two-digit counts and one-digit indices this codebase
# writes, and there is no session number this gate should refuse to let a reason cite.
# A four-digit number followed by `§` is not a thing anyone writes, and if it ever is,
# it is a citation too.
REASON_CITE = re.compile(r"(?<!\d)\d{3,}(?=\s*(?:§|—|--|'|’))")
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
        # 🔴 202 §5 — `^` WITHOUT `\s*` WAS A SECOND PREDICATE. `instrument_gate.py`
        # declares INSTRUMENT_FLOOR inside `main()`, so a module-level-only reader
        # silently skipped the one governed floor that is indented — and the SIZE_LEDGER
        # scan below inherited the same blindness until this was widened. Excluding a
        # real constant on a detail of its indentation is the shape this session found
        # three times over: the backtick in the release roster, the `files` field, the
        # producer map. Leading whitespace is not part of the claim.
        m = (re.search(rf"^\s*{re.escape(name)}(?::\s*[^=\n]+)?\s*=\s*(\d+)", t, re.M)
             or re.search(rf"^\s*(?:export )?const {re.escape(name)}\s*=\s*(\d+)", t, re.M))
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
USE_FLOOR = 5   # governed by SIZE_LEDGER (§9.3). `>=`, because the day a second live
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
# 🆕 201 §9.3 + §9.4 — THE SIZE LEDGER: WHY A ROSTER IS THE SIZE IT IS
# ═══════════════════════════════════════════════════════════════════════════════════
#
# 201's sweep declared `D1` green and named it: deleting a `USE_TARGETS` row AND lowering
# `USE_FLOOR` to match reddens NOTHING. That is correct for a deliberate removal and
# silent for an accidental one, and 201 §9.3 generalised it — the same is true of
# `TARGET_FLOOR`, every `*_CEILING` and `CHECKS_EXPECTED`. **NO INSTRUMENT IN THIS TREE
# READS WHY A ROSTER CHANGED SIZE.**
#
# 🔴 MEASURED FIRST (200 §33): TWENTY governed size constants across FIVE gate files,
# not the two 201 §9.3 named and not the four §9.4 did.
#
# The ledger is the second reader. A governed constant may hold any value it likes, but
# the value has to be written down HERE as well, next to a sentence saying why — so
# lowering a floor takes two edits in two files and the second one is nothing but the
# reason. An accidental shrink passes neither.
#
# 🔴 AND THE SAME TABLE CLOSES §9.4, WHICH IS WHY IT IS ONE MECHANISM AND NOT TWO.
# §9.4 asked about `control_gate.py`'s `BLAST_TOTAL_FLOOR = 95  # measured 103 across the
# 56 rows` and `scope_gate.py`'s `LEDGER_COLLAPSE_FLOOR = 24  # measured 29 ...` —
# 201 §5's defect exactly, one table over, and 201 declined to widen the reason rule to
# "every comment in every gate". It does not need to. These reasons go through
# `reason_problems()` UNCHANGED, `{FLOOR}` resolves from the live constant, and the
# ungoverned prose in the other gates' own comments is replaced by a pointer to the row
# that governs it rather than by a second rule nobody would re-read.
#
# 🔴 THIRTEEN OF THE TWENTY COMMENTS CARRIED A NON-CITATION DIGIT-RUN, and one was
# already stale on the day it was measured: `instrument_gate.py`'s LATE_CONSTRUCTED_FLOOR
# said "measured 82 of 102" against a live LATE_CONSTRUCTED of eighty-nine. 201 §5 caught
# the same number one file over and could not reach this one.
#
# 🔴 209 — AND THE DIVISION OF LABOUR THIS TABLE HAS WITH `TARGETS`, WRITTEN DOWN AT LAST.
# 206 §21 named it and three handoffs carried it: `SIZE_LEDGER` governs the constants in
# the PYTHON instruments (`../scripts/*.py`), `TARGETS` governs the ones in the JAVASCRIPT
# instruments (`host/scripts/*.mjs`, `host/test-integration/*.mjs`). Nothing stated it
# anywhere, so every session that moved a constant learned which table to edit by reading
# a neighbouring comment and inferring — and 208's two re-anchored constants both lived in
# `TARGETS` for a reason no file gave. A rule visible only as an absence is a rule the
# next reader re-derives, and re-derivation is where it stops being the same rule.
SIZE_LEDGER: dict[tuple[str, str], tuple[int, str]] = {
    ("../scripts/contract_check.py", "CHECKS_RUN_FLOOR"): (29, (
        "`{FLOOR}` blocks reach their own end on a healthy tree. Moves only when a check "
        "is ADDED or REMOVED, which is the datum 196 §2 named and every session since "
        "has failed to obtain. 🆕 RAISED BY ONE THIS SESSION, AND THIS IS THAT DATUM "
        "ARRIVING: the numerals-no-reader-claims check was added to close the previous "
        "session's finding, where two stale tool counts sat in the shipped README while "
        "`contract_check.py` read that file at seven call sites and exited clean. The "
        "floor moving is the deliberate half; the ledger row saying so in the same commit "
        "is what tells it from a check that quietly went missing. 🆕 246 §3 RAISED IT BY "
        "ONE AGAIN, and for the same shape of reason: the guard-class check was added to "
        "close 233's discover row for the prose scanner's pin table, which asks whether "
        "every lookaround that suppresses a numeral in the shipped documents is exercised "
        "by a pin — the direction a positive control cannot reach. 🆕 RAISED BY ONE A THIRD TIME: the "
        "remedy join was added to close the tool-error-sweep row, which measured that most "
        "of the addon's failure sites named no next action at all — the check compares the "
        "error-code vocabulary each engine plane raises against the table of next actions, "
        "in both directions, and joins the tools those actions name to the live "
        "registry. 🆕 RAISED BY ONE A FOURTH TIME: the required-any join was added on the "
        "session that moved this tree to the current zod major, where a key typed as "
        "unconstrained stopped being implicitly optional and became implicitly required on "
        "the wire — so the check asks, per tool rather than per file, whether something on "
        "the engine side actually writes each key the emitted schema now promises. "
        "🆕 RAISED BY ONE A FIFTH TIME: the launcher readiness join was added to close the "
        "row about a tool reporting that a game was running before the game's bridge could "
        "answer — the check finds every tool whose own block SPAWNS a game, and asks "
        "whether it waited and whether it has anywhere on the wire to say so. Found by the "
        "spawn and never by a roster, because the row it closes named one launcher and its "
        "twin in another file had the identical defect with nothing naming it. "
        "🆕 RAISED BY ONE A SIXTH TIME: the recipe/surface join was added after the User "
        "Guide's worked recipes were found naming five tools a default install does not "
        "load — the check reads the tools a recipe NAMES out of the guide's own sections "
        "rather than from a roster, so a recipe written next session is judged the day it "
        "is written, which is the property the hand-written warning it replaces did not "
        "have. "
        "🆕 RAISED BY ONE A SEVENTH TIME: the error-code discipline check was added to "
        "close the row about a shipped branch selected by a regex over an error message "
        "— the check asks, in three joins, whether behaviour is chosen by a FIELD or by a "
        "sentence, and it found a third site the row had not named, one whose blast radius "
        "is the retry caveat on every non-idempotent tool.")),
    ("../scripts/handoff_gate.py", "CLAIM_FLOOR"): (15, (
        "🆕 234 — the atoms a status block must yield before this reader is entitled to "
        "an opinion, at `{FLOOR}`. Derived rather than chosen, and both bounds are real "
        "parses rather than judgements: `--selftest` reads 233's own counter line and a "
        "block reduced to its headline counters, and asserts the floor admits the first "
        "and refuses the second. It moves "
        "when the block's counter line gains or loses a whole class of field — which is a "
        "session ADDING an instrument, and the ledger row saying so in the same commit is "
        "what tells that from a parser that quietly stopped matching.")),
    ("../scripts/handoff_gate.py", "READER_FLOOR"): (28, (
        "🆕 234 — the counter readers, at `{FLOOR}`. The lower bound is the roster with "
        "its largest single-instrument family deleted (six rows read floor_pin_gate.py), "
        "because a roster that lost a family would still look populated and the "
        "DROPPED-COUNTER direction would silently stop being enforced. Moves when an "
        "instrument is added to the block or retired from it. 🔴 RAISED ONCE ALREADY, ON THE SESSION THAT SET IT: the roster was complete for the block in front of it and blind to four instruments the six blocks before it had reported, which is the ledger row doing the job 196 §2 named — telling a deliberate move from a quiet one. 🆕 246 §4 raised it by four, for the three counters `instrument_gate.py` has printed on every run since the session before and no row here bound, plus the queue gate's own self-test count — the same class this floor governs, arriving from the instrument's side rather than the block's.")),
    ("../scripts/handoff_gate.py", "POPULATION_REACH_FLOOR"): (227, (
        "🆕 244 §2 — `population-reach-floor`, and the ONE row in this ledger whose value "
        "is a session number rather than a count. `{FLOOR}` is the oldest block "
        "`BLOCK_POPULATION` has ever held; the comparison is `<=`, so the claim gets "
        "STRONGER as the number gets smaller. It exists because every other floor on that "
        "table counts it — width, spellings, claims, readers — and a window that dropped "
        "its oldest block as it added its newest satisfies all four while taking the far "
        "endpoint off `moved_interval` and `version_interval`. Moves only when a session "
        "deliberately decides the table need not reach that far back, which is a decision "
        "and is why it is a governed literal rather than a length.")),
    ("../scripts/handoff_gate.py", "ALIAS_SPELLING_FLOOR"): (76, (
        "🆕 238 §2 — the DISTINCT atom spellings every real status block carries, at "
        "`{FLOOR}`. It exists because the two claims it guards can both be satisfied by "
        "shrinking: `ALIAS_POPULATION` finds no unbound atom and `ALIAS_UNUSED` finds no "
        "unreached reader in a population that stopped parsing, and neither says so. "
        "This one goes RED there. Both bounds are real walks, like `CLAIM_FLOOR`'s — the "
        "newest block's spellings below, all twelve blocks' above — because a floor "
        "inside what ONE block carries is satisfied by a walk that read the block in "
        "front of its author and stopped, which is the shrinkage the row is for. "
        "`{FLOOR}` is a measurement of text already written, so it only ever moves UP, "
        "when a session adds a block or an instrument. A commit that lowers it is a "
        "commit that lost a spelling an alias used to read, and the ledger row saying so "
        "is what tells that from a walk that quietly stopped reaching one.")),
    ("../scripts/handoff_gate.py", "HEADER_FLOOR"): (2, (
        "🆕 235 §3 — the counter-bearing atoms the block's LABELLED ROWS must yield, at "
        "`{FLOOR}`. It is small because the header is small: every block in this series "
        "puts `lag` and `tags` on one npm line and nothing else there is a counter, so "
        "`{FLOOR}` is the whole population and not a margin. Both bounds are real "
        "parses, like "
        "`CLAIM_FLOOR`'s — `--selftest` reads 234's header verbatim (three atoms, seven "
        "lines of prose it must NOT read) and a header stripped to its version row "
        "(none), and asserts the floor admits the first and refuses the second. It moves "
        "when the header gains or loses a row, which is a session changing the block's "
        "SHAPE rather than its numbers — the one change this reader could not otherwise "
        "tell from a parser that stopped matching.")),
    ("../scripts/queue_gate.py", "AGE_CEILING"): (8, (
        "🆕 240 — the sessions an item may sit OPEN before a decision is owed, at "
        "`{FLOOR}`. It is a POLICY and not a measurement, which makes it the one "
        "constant in this table a session has a motive to move: a queue that goes red "
        "is cleared either by deciding something or by editing this integer. So it is "
        "swept, and it is pinned absolutely rather than relatively — `--selftest` names "
        "two sessions by number rather than deriving its "
        "fixtures from the constant, because fixtures derived from a floor hold at every "
        "value of it including the zero this sweep writes. It moves when the project "
        "decides it can carry undecided work for longer, and the ledger row saying so is "
        "what tells that from a session quietly buying itself room.")),
    ("../scripts/queue_gate.py", "QUEUE_ROW_FLOOR"): (20, (
        "🆕 240 — the rows `QUEUE.md` must yield before this reader is entitled to an "
        "opinion, at `{FLOOR}`. Closed rows STAY in the table — they are the only record "
        "that a decision was taken — so the count only ever goes up, and every claim the "
        "gate makes is satisfied by a table that stopped parsing: no OPEN row is over "
        "the ceiling when no row is read at all. `TERM_FLOOR`'s shape, on the file whose "
        "whole subject is work nobody is doing.")),
    ("../scripts/lint_ceiling.py", "PY_FILE_FLOOR"): (18, (
        "🆕 230 — every tracked `.py` in this repository, at `{FLOOR}`, which is the whole "
        "population `pyflakes` is run over: `git ls-files '*.py'` and `scripts/` are the "
        "same set today and the floor is what says so if they stop being. It moves when a "
        "script is ADDED or DELETED on purpose — this row and the file arrived in the same "
        "commit, so its first value counts itself. 🔴 A linter with nothing to read prints "
        "a clean tree in the same words as a clean tree, which is why the population is "
        "floored and not just the findings. 🆕 RAISED BY ONE THIS SESSION, WHICH IS THE DELIBERATE HALF: `handoff_gate.py` joined the tree and the population is `git ls-files`, so the floor moving in the same commit as the file is what tells that from a walk that quietly stopped reaching one. 🆕 241 — RAISED BY ONE AGAIN, AND THIS TIME THE FILE JOINING THE POPULATION IS A LINTER'S SUBJECT RATHER THAN A GATE: `p0_comments.py`, the P0 comment classifier. It is worth writing down that the equality caught it before a reader did, because the inventory that file produces reports the opposite fact one plane over — the scripts here are lint-governed and the shipped TypeScript has no lint configuration of any kind. The population this tree DOES lint counts itself exactly; the one it ships does not count itself at all.")),
    ("../scripts/handoff_gate.py", "CI_SCRIPT_FLOOR"): (55, (
        "🆕 242 — the scripts `handoff_gate.py` reads out of `.github/workflows/`, at "
        "`{FLOOR}` against sixty live. It is the floor under `replay-vs-ci-unread`: the "
        "session replay list and the workflow files are two rosters of the same commands, "
        "the previous session passed the entire local ritual and was refused on push by a step the list had "
        "never named, and nothing in this tree compared them. Floored from BELOW, and the "
        "direction is the point — steps being ADDED never reddens this, and what it "
        "catches is `CI_RUN_ONE` or `CI_RUN_BLOCK` ceasing to match, which would report an "
        "empty CI roster in perfect agreement with every replay ever written. Same shape "
        "and same argument as `instrument_gate.py`'s `CI_COMMAND_FLOOR`, which reads the "
        "same files for a different question and is why this one is a second number "
        "rather than a widening of that one.")),
    ("../scripts/handoff_gate.py", "SCRIPT_POPULATION_FLOOR"): (80, (
        "🆕 243 — every tracked `.py`, `.mjs` and `.sh` in this repository, at `{FLOOR}` "
        "against eighty-three live. It is the floor under `p0-reporters-unrostered`: the "
        "replay list and the workflow files are two rosters of COMMANDS, and until this "
        "session nothing asked what the union of them never reaches at all. Both P0 "
        "reporters sat in that intersection when they shipped importing a Node "
        "twenty-two export against a declared engines floor of eighteen — an ESM LINK "
        "error, so on two thirds of this project's own matrix the modules never loaded, "
        "and twenty-six jobs stayed green. 🔴 FLOORED FROM BELOW, AND THE DIRECTION IS "
        "THE POINT: scripts being ADDED never reddens this, and what it catches is "
        "`git ls-files` failing to answer — which yields an empty population, no "
        "findings, and a green run that opened no files. Same argument as "
        "`CI_SCRIPT_FLOOR` two rows up, over the other input to the same comparison.")),
    ("../scripts/lint_ceiling.py", "MJS_FILE_FLOOR"): (65, (
        "🆕 242 — every tracked `.mjs` in this repository, at `{FLOOR}`, which is the "
        "population `tsc --allowJs --checkJs` is run over. It is the row "
        "`lint-roster-py-only` asked for: until this session the lint roster was "
        "`scripts/*.py` and nothing else, while every gate instrument in `host/scripts/`, "
        "every integration probe and every live demo script sat outside every `tsconfig` "
        "include and was read by no standard tool at all. 🔴 AN EQUALITY, LIKE "
        "`PY_FILE_FLOOR`, AND THE ASYMMETRY WAS DRAFTED AND THEN REJECTED. The first "
        "version floored it from below only, arguing that this population grows whenever "
        "a plane gains a probe; that argument is true of the row above it as well, and "
        "the session that raised THAT one by one wrote down that the equality is what "
        "caught the new file rather than shrugging at it. A gate that reddens when the "
        "population changes is asking for a number to be re-read, which is the whole "
        "practice. 🔴 The first run of the widened reader found two live defects the "
        "eleven bespoke instruments had missed — `globSync` imported by both of the "
        "previous session's reporters, which does not exist below Node twenty-two against "
        "a declared `engines.node` floor of eighteen, and seven arguments discarded at a "
        "one-parameter helper inside the tautology gate's own self-test.")),
    # 🆕 233 — instrument_gate.py's floor on its READ OF ci.yml, not on a population of
    # its own. Every `LATE_LIVE_NA` row is a claim that no second command exercises an
    # instrument, and until this session nothing re-derived it: three of the four rows
    # were false, and two named the very command they denied. This is the floor under
    # that derivation.
    ("../scripts/instrument_gate.py", "CI_COMMAND_FLOOR"): (8, (
        "`run: node …` steps read out of ci.yml, at `{FLOOR}` against twenty-one live. Floored "
        "from BELOW: steps being added never reddens, and what it catches is `CI_RUN_RE` "
        "ceasing to match — which would check every NA row against an empty set and pass, "
        "restoring exactly the silence that let three false rows stand. It moves the day "
        "the workflow drops below eight node steps on purpose.")),
    ("../scripts/control_gate.py", "UNFINGERPRINTABLE_FLOOR"): (3, (
        "Statements carrying no literal of their own, so no row can ever name them. A "
        "CEILING in spirit: it is supposed to fall, and `{FLOOR}` is where it stands.")),
    ("../scripts/control_gate.py", "CONTROLLED_FLOOR"): (56, (
        "Controls applied, at `{FLOOR}`. Seventeen when 187 — first measured it; 188 §4 "
        "added the constructible half of the group it had named.")),
    ("../scripts/control_gate.py", "STATEMENT_FLOOR"): (87, (
        "Failure statements, at `{FLOOR}`. 186 — measured seventy; 188 §3 added two and "
        "192 — added check twenty-three's.")),
    ("../scripts/control_gate.py", "BLAST_TOTAL_FLOOR"): (105, (
        "🔴 201 §5's DEFECT, ONE FILE OVER. Its own comment said the live blast was one "
        "hundred and three — a measurement that drifts, written where nothing compares "
        "it. Floored from BELOW at `{FLOOR}` so a row that stops reddening is caught. 🆕 246 §3 raised it in the commit that outgrew it — two control rows gained reach because two checks were added, and a floor left where it was would have absorbed the whole gain as headroom nobody voted for.")),
    ("../scripts/control_gate.py", "ALSO_ATTRIBUTED_FLOOR"): (99, (
        "🔴 SAME DEFECT, SAME FILE. Its comment quoted the live attributed count against "
        "the live blast, both of which move. The floor is `{FLOOR}` and the DIAGNOSIS's "
        "population is what it governs.")),
    ("../scripts/floor_pin_gate.py", "TARGET_FLOOR"): (70, (
        "This gate's own swept roster, at `{FLOOR}`. Raised by one when 200 §12.3 "
        "admitted the shipped claim-site floors, by two when 206 §3 added the "
        "registry-lag reader's pair, by two more when 206 §4 added the "
        "tool-surface budget's, by three when 209 §2 added the wire-diff "
        "classifier's pair and the discard gate's shape floor, and by two when "
        "211 §4 added that classifier's floor on its OWN ANSWER, the refusal "
        "count its self-test used to print as a literal, and the budget reader's "
        "claim floor, and by one when 213 §2 added the registry-BYTES reader's "
        "ENTRY_FLOOR — the first floor in the tree whose population is a TARBALL, "
        "and by one when 216 §1 added check one's NAME_FLOOR, the first entry here "
        "that arrived because a floor MOVED OUT of gitignored scratch rather than "
        "because a new one was written, and by one when 243 §2 added the handoff "
        "reader's SCRIPT_POPULATION_FLOOR — the floor under the tracked-script "
        "population that the replay list and the workflow files are compared "
        "AGAINST, which is a different quantity from either roster and could go "
        "empty without moving either one.")),
    ("../scripts/floor_pin_gate.py", "UNDISCOVERABLE_CEILING"): (0, (
        "A CEILING, at `{FLOOR}`, and it is supposed to fall — 199 — said so and it did. "
        "Its branch is unreachable from the live tree and is proved by fixture instead, "
        "which is 200's U1 closed rather than declared.")),
    ("../scripts/floor_pin_gate.py", "COMMENT_FLOOR"): (17, (
        "🔴 THE ROW `M2` EARNED. Declaration comments the rule reads, at `{FLOOR}`. It "
        "exists because breaking the reader emptied the population and the check went "
        "GREEN — 201 §9.43 arriving inside a check written the same day it was quoted.")),
    ("../scripts/floor_pin_gate.py", "SHORTFALL_LITERAL_FLOOR"): (55, (
        "🆕 242 — the shortfall refusals the LITERAL reader finds across `.mjs`, `.ts` and "
        "`.gd`, at `{FLOOR}`. It is the second half of `cause-rule-py-only`, and it is a "
        "second floor rather than a bigger first one because one threshold over two "
        "readers is a total: the `ast` half is a quarter of the combined population, so it "
        "could stop matching entirely and the literal half alone would still clear any "
        "single number set beneath the live read. `lint_ceiling.py` §2's sentence in this "
        "file's own terms — a population reachable two ways must be floored two ways or "
        "the sum destroys the distinction. Sits beneath its live read for the same reason "
        "the row below does: it moves whenever a probe gains a collapse refusal.")),
    ("../scripts/floor_pin_gate.py", "SHORTFALL_FLOOR"): (15, (
        "The shortfall refusals in `scripts/` this file reads before asking whether each "
        "one's sentence is its measurement, at `{FLOOR}`. Its healthy answer is ZERO "
        "refusals asserting a cause, so — like the row below it and `SCANNED_FLOOR` one "
        "file over — what can collapse is the population and never the answer: a finder "
        "that stopped recognising a collapse marker reports no offenders and is "
        "indistinguishable from a tree that has none. It sits beneath the live read "
        "because the population moves whenever a gate gains a floor, and a floor that "
        "tracks what it measures has stopped being one. It moves when a whole family of "
        "refusal — a new marker shape — joins the sweep.")),
    ("../scripts/floor_pin_gate.py", "LITERAL_KEY_FLOOR"): (500, (
        "🔴 THE ROW THAT EXISTS BECAUSE THIS TABLE HAD A ROW NOTHING COULD READ. The "
        "constant keys read out of every dict/set literal in `scripts/`, at `{FLOOR}`. "
        "The repeat check's healthy answer is ZERO, so what can collapse here is the "
        "POPULATION and never the answer — the same argument `SCANNED_FLOOR` and "
        "`ENTRY_FLOOR` each make one file over, arriving here because a duplicate key in "
        "THIS table is what put the check in the tree. It sits well beneath the live "
        "read on purpose: a floor that tracked its own population would move every time "
        "somebody adds a row to any roster in this directory, and a floor that moves "
        "with what it measures has stopped being one. It moves when a whole tree joins "
        "the scan.")),
    ("../scripts/floor_pin_gate.py", "USE_FLOOR"): (5, (
        "🔴 THE ROW `D1` WAS ABOUT. Live consumers asked whether they still READ the "
        "floor they import, at `{FLOOR}`. Deleting one of these rows and lowering this "
        "literal to match is the shrink-by-agreement this whole table exists to read.")),
    ("../scripts/registry_lag.py", "TAG_FLOOR"): (100, (
        "The tag corpus this reader divides by, at `{FLOOR}`. A distance counted in tags "
        "says nothing when the tag list has collapsed, so that case refuses instead of "
        "returning a comfortable zero — and the rows proving it run under the LIVE "
        "constant, because passing the floor in as an argument is what makes zeroing it "
        "redden at all.")),
    ("../scripts/registry_lag.py", "LAG_CEILING"): (3, (
        "A CEILING and a budget, at `{FLOOR}` — how many cut-but-unpublished tags this "
        "repository will tolerate before a release cut refuses. Sized against the "
        "incident it exists to catch: publishing stopped and the very next cut was "
        "already one behind, so a ceiling this low refuses within the first week while "
        "still admitting a same-session patch burst.")),
    ("../scripts/registry_lag.py", "UNTAGGED_CEILING"): (8, (
        "A CEILING and a budget, at `{FLOOR}` — how many commits past the newest tag "
        "this repository will tolerate before a release cut refuses. It bounds the "
        "distance `LAG_CEILING` cannot see, and the two are deliberately different "
        "numbers: they go stale in opposite directions, so one ceiling over their sum "
        "would let either be hidden by the other going green. Sized against MEASURED "
        "history rather than picked — every interval between consecutive tags across "
        "the last twenty-five releases is seven or under except one, which is the "
        "window a much earlier session measured as twenty-five commits carrying "
        "exactly one change a user could observe.")),
    ("../scripts/release_names.py", "NAME_FLOOR"): (5, (
        "The vocabulary a released CHANGELOG block must name before check one will "
        "make a claim about it, at `{FLOOR}`. 🔴 215 §3 — THIS IS THE FLOOR THAT "
        "ABORTED A REAL CUT, AND IT WAS RIGHT TO. The `1.73.2` block names one "
        "SCREAMING constant "
        "and five lower_snake identifiers; the arm counted only the first case, read a "
        "population of one, and refused a release whose notes were not thin at all. "
        "The floor is unchanged and the population it reads is what moved — so it is "
        "sized against the same block it once rejected, which now reads six. Lowering "
        "it to make an abort go away is the failure it exists to catch, and the "
        "self-test's counterfactual compares BOTH populations to this literal so that "
        "moving it reddens rather than quietly widening what counts as legible.")),
    ("../scripts/contract_check.py", "SHEBANG_NONEXEC_EXPECTED"): (48, (
        "Tracked `.mjs`/`.ts`/`.py`/`.sh` files carrying a shebang while committed "
        "non-executable, at `{FLOOR}`. They are invoked as `python3 <file>` or "
        "`node <file>`, so the non-executable mode is correct — but the COUNT is "
        "prose, and prose goes stale in silence. It moves only when such a file is "
        "added or removed, and the comment beside EXEC_ROSTER records each move with "
        "its reason. The session before last added the method-ledger reader. The current "
        "one raised it by TWO — the mutation-lock gate and the terminology gate — and the "
        "shebang check refused both within minutes of them being staged, the third session "
        "running that this check has caught its own author. `_gate_lock.py` is a module "
        "rather than an entry point, carries no shebang, and correctly does not move "
        "this number. The session that shipped the tree-quiet reader raised it by ONE "
        "again, and its `pre-commit` hook went to EXEC_ROSTER instead — git EXECUTES a "
        "hook rather than handing it to an interpreter, so that one file is in the other "
        "population for a reason the mode itself carries. "
        "🔴 AND THIS ROW ABSORBED A SECOND ONE WITH THE SAME KEY. This table carried "
        "`SHEBANG_NONEXEC_EXPECTED` TWICE — an earlier row, at a lower value, with its "
        "own paragraph. Python keeps the LAST, so that paragraph had never been read by "
        "anything: not by this rule, not by the digit rule, not by the line that prints "
        "how many constants are governed. Its history is folded in here. The Asset "
        "Library sweep, the promoted positive-control finder and its self-test, the "
        "release-name reader, the wire-diff classifier and its self-test, and the "
        "registry-lag reader each raised this count on the commit that staged them, and "
        "in every one of those cases the check refused within minutes of the staging "
        "rather than at the local run before it — the population is `git ls-files` and "
        "nothing else in the tree reads it. "
        "🆕 241 — RAISED BY ONE FOR THE P0 COMMENT CLASSIFIER, and the deliberate half is "
        "worth naming: the file joining this population is the one that walks every "
        "comment in the tree and sorts it into five buckets. It was caught by a shebang "
        "on its own first line and by an equality on a linter's file count, both within "
        "minutes of `git add` — the ordering rule doing what it was written for rather "
        "than a coincidence worth admiring. 🆕 RAISED BY ONE AGAIN, and caught the same way inside the same minute: the publish guard is a `.mjs` in `host/scripts/` carrying a shebang and committed non-executable, so this row and the linter file count both refused as soon as it was staged. A fourth session running in which a file added to this tree is counted by two independent readers before anybody asks it to be.")),
    ("../scripts/mutation_lock_gate.py", "GUARDED_FLOOR"): (5, (
        "The tree-mutating gates that must take the lock, at `{FLOOR}` — control, "
        "floor-pin, instrument, scope, and the tree-quiet reader's own `--recover`. "
        "🔴 The population is DERIVED from the source "
        "rather than listed, so this floor guards the deriver rather than a roster: if "
        "the write-shaped-call finder stops finding writes, every remaining file is "
        "'guarded' by never having been looked at, and the gate goes green over a tree "
        "with no lock in it. The handoff that raised this named THREE of the four and "
        "omitted floor-pin, the one that shares a mutated file with control — the "
        "reason this number is measured rather than typed. The session that shipped the "
        "tree-quiet reader raised it again and did not CHOOSE to: that file was written "
        "as a READER, and the deriver classified it UNGUARDED on its first run because "
        "`--recover` rewrites tracked files. The gate found its mutation first.")),
    # 🆕 233 — THE SUFFIX DISCOVER HALF'S TWO. `TERM_FLOOR` above governs the VOCABULARY;
    # these govern the POPULATION the vocabulary is swept over, which until this session
    # was a written-down set of nine suffixes filtering a `git ls-files` walk. 80 of 354
    # tracked files carried a suffix nobody had listed — including the `plugin.cfg` whose
    # `description=` the Asset Library publishes verbatim — and the gate printed
    # `0 retired term(s)` about a population it never opened.
    ("../scripts/terminology_gate.py", "TRACKED_FLOOR"): (250, (
        "Tracked paths `git ls-files` returns, at `{FLOOR}` against three hundred and fifty-four live. Floored from "
        "BELOW so files being ADDED never reddens a healthy tree; what it catches is the "
        "walk going quiet, because an empty listing makes every suffix trivially accounted "
        "for and the discover half passes over nothing. It moves when the repository "
        "genuinely loses a quarter of its files, which is not a thing that happens by "
        "accident.")),
    ("../scripts/terminology_gate.py", "SUFFIX_FLOOR"): (10, (
        "DISTINCT suffixes across those paths, at `{FLOOR}` against twenty-one live, and it is a "
        "SECOND floor rather than a share of the first (172 §6). A walk that still returns "
        "every tracked path while `Path.suffix` stops resolving reads as one enormous extensionless "
        "population — the path count above cannot see that, and only this can.")),
    ("../scripts/terminology_gate.py", "TERM_FLOOR"): (1, (
        "Retired terms parsed out of the landscape policy's first rule, at `{FLOOR}`. The "
        "gate does not carry its own copy of the vocabulary — it reads the rule — so a "
        "reworded policy would leave the parser matching nothing and the sweep would "
        "pass over the whole tree finding none. That is the shape this floor exists "
        "for: an unparseable rule is not an empty rule. It moves the day that rule retires "
        "a second word outright.")),
    # 🆕 227 — THE SPEC SCANNER'S POPULATION, WHICH BECAME FLOORABLE THE DAY IT STOPPED
    # BEING A ROSTER. 224 §7.6 carried "SCANNED is still a roster" for three handoffs;
    # deriving it from `git ls-files` is the fix and this floor is the fix's own bill.
    ("../scripts/spec_conformance.py", "SCANNED_FLOOR"): (120, (
        "The tracked files the spec scanner reads, at `{FLOOR}`. A roster of five paths "
        "either exists or raises; a derived population's failure mode is an EMPTY LIST — "
        "not a checkout, no git on PATH, a cwd that moved — and an empty population "
        "finds no nonconformant string by construction and exits green. That is exactly "
        "`ENTRY_FLOOR`'s argument below, arriving in a second file for the same reason: "
        "the answer this gate reports healthy is ZERO findings, so the thing that can "
        "collapse is never the answer, only the population. It sits well beneath the "
        "live read because the difference between them is the declared exclusion list, "
        "and a floor tracking its own population would have to move every time somebody "
        "writes a doc. It moves when a whole suffix or a whole tree joins the scan.")),
    ("../scripts/registry_bytes.py", "ENTRY_FLOOR"): (60, (
        "The tarball population the registry-bytes comparator is allowed to answer "
        "over, at `{FLOOR}`. Its healthy verdict is ZERO differences, so what can "
        "collapse here is the population and not the answer — two empty trees are "
        "byte-identical by construction, which is the tautology `tautology_gate.mjs` "
        "refuses one directory over, written into the check that guards what users "
        "install. The tarball shipped eighty-two entries at the version this floor "
        "was first measured against, so `{FLOOR}` leaves room for it to shrink "
        "honestly and none for it to vanish.")),
    ("../scripts/registry_bytes.py", "ADDON_ENTRY_FLOOR"): (10, (
        "The ADDON SUBTREE inside the published tarball, floored at `{FLOOR}` — check "
        "five's population, and the first here that is a subtree of another floor's. "
        "Its collapse mode is sharper than `ENTRY_FLOOR`'s because the two sides are "
        "found BY PREFIX — `addon/breakpoint_mcp` in the tarball, `addons/breakpoint_mcp` "
        "in the tree, one letter apart — and a prefix that has stopped matching yields "
        "an empty subtree that agrees with every other empty subtree. Twelve entries "
        "ship today, so `{FLOOR}` leaves room for one to be retired honestly and none "
        "for the addon to vanish out of the artifact unnoticed.")),
    ("../scripts/instrument_gate.py", "SIG_RESOLVED_FLOOR"): (105, (
        "Resolved signatures, floored at `{FLOOR}` from below. 🆕 212 §4 — RAISED, and "
        "DELIBERATE: `_decl_re` was widened to block-bodied arrow consts and "
        "`concise_blind` added for the concise ones, and a new coverage reader turned "
        "eighteen untargeted exported members into thirteen targets and five written "
        "reasons. Measured seventy-eight against a floor that had been fifty-five since "
        "the placeholder shipped; left there, the whole admission could be reverted one "
        "target at a time without a line of output moving. 🆕 245 §1 — RAISED AGAIN AND "
        "FOR THE SAME CAUSE ONE LANGUAGE OVER: `blind-py-gates` admitted three Python "
        "instruments and fifteen more placeholder anchors, and the live count reached one "
        "hundred and seventeen against a floor that had been seventy since the session "
        "that widened `_decl_re` to arrow consts.")),
    ("../scripts/instrument_gate.py", "LATE_NOT_LOADED_CEILING"): (0, (
        "A CEILING at `{FLOOR}`, supposed to fall and already at the bottom.")),
    ("../scripts/instrument_gate.py", "LATE_CONSTRUCTED_FLOOR"): (160, (
        "🔴 THE ONE THAT WAS ALREADY STALE WHEN §9.4 MEASURED IT. Its comment quoted a "
        "live constructed count that has since moved — 201 §5's finding, reaching a file "
        "that session's rule could not govern. The floor itself is `{FLOOR}`, read from "
        "the tree. 🆕 212 §4 — RAISED, and DELIBERATE, for the same cause as "
        "SIG_RESOLVED_FLOOR above: thirteen new targets are thirteen more late mutants "
        "that construct. Measured one hundred and nine against a floor of sixty-five, a "
        "gap wide enough for that entire admission to be deleted inside it. 🆕 245 §1 — "
        "RAISED A THIRD TIME, same cause: the Python cohort and its live axis construct "
        "one hundred and seventy-nine late mutants against a floor of ninety-eight.")),
    ("../scripts/instrument_gate.py", "LATE_LIVE_FLOOR"): (8, (
        "The live late axis, floored at `{FLOOR}`.")),
    ("../scripts/instrument_gate.py", "INSTRUMENT_FLOOR"): (8, (
        "🔴 THE ONE AN INDENTATION HID. Declared inside `main()`, so a module-level-only "
        "reader could not see it at all until 202 §5 widened `reason_value`. The roster "
        "of instruments, at `{FLOOR}`; 177 — admitted boundary_gate.mjs as the eighth.")),
    ("../scripts/instrument_gate.py", "DISCOVER_FLOOR"): (30, (
        "🆕 232 — the DISCOVER walk's file population, at `{FLOOR}` and floored from "
        "BELOW (198 §36). The half 231 §5.1 named: this gate read a typed roster and had "
        "no way to notice an instrument joining the tree, which is how it printed ok over "
        "eleven on the run that introduced the twelfth.")),
    ("../scripts/instrument_gate.py", "DISCOVER_MODULE_FLOOR"): (8, (
        "🆕 232 — the export-bearing half of the same walk, at `{FLOOR}`. Two floors and "
        "never one sum, for the reason 172 §6 gives about per-instrument floors.")),
    ("../scripts/instrument_gate.py", "CRASH_CEILING"): (0, (
        "A CEILING at `{FLOOR}` and it has fallen to the bottom. It stays a ceiling "
        "rather than becoming a floor for the reason its own comment gives.")),
    ("../scripts/scope_gate.py", "TARGET_FLOOR"): (39, (
        "That gate's swept enumerators, at `{FLOOR}`. 🆕 246 §2 raised it by four, and the "
        "four were not new work: they are annotated enumerators whose RETURN SHAPE that "
        "gate's empty-value table could not spell, so they had been outside its walk by "
        "construction with no line anywhere saying so — and one of them blinded GREEN. Raised by one again for the catalog's heading reader, whose name-to-flag return shape was the same kind of gap that table could not spell. Raised by two more for the toolset MEMBER reader and the catalog's plane reader — the pair that turned a group's SIZE into a group's ROSTER, and the size reader is now derived from the member one rather than reading the same file twice. Raised by two again for the remedy TABLE reader and the bridge-error RENDERER walk, and the first of those brought a return shape the empty-value table still could not spell — the third session running to add one, and the second where the row cost nothing but the line it is written on. 🆕 RAISED BY FOUR: the required-any join brought three readers of its own — the required-any key reader, the per-tool method reader and the addon handler resolver — and admitting the shape the last of those returns made a FOURTH enumerator blindable that had been outside the walk in silence. That is the same gap as the sessions above, arriving for the fourth time in a row, which is why the empty-value table now says out loud that writing a new reader means checking it in the same edit.")),
    ("../scripts/scope_gate.py", "STATEMENT_ATTRIB_FLOOR"): (20, (
        "Attributed statements, at `{FLOOR}`. Nineteen when re-derived; raised by one "
        "once 188 §3 gave check twelve a population.")),
    ("../scripts/scope_gate.py", "SCOPE_BLAST_TOTAL_FLOOR"): (62, (
        "🔴 201 §5's DEFECT AGAIN, THIRD FILE. Its comment quoted the live blast, which "
        "drifts. Floored from BELOW at `{FLOOR}` for control_gate's reason.")),
    ("../scripts/scope_gate.py", "LEDGER_COLLAPSE_FLOOR"): (32, (
        "🔴 FOURTH AND LAST OF THE SHAPE §9.4 NAMED. Its comment quoted the live "
        "collapse count against the live row count, both moving. The floor is "
        "`{FLOOR}`.")),
}

# The governed shape. A size constant is one whose NAME says it bounds a roster —
# derived from the naming convention the five gates already share rather than from a
# hand-written roster, which is 198's rule and the reason this table cannot quietly
# stop covering a file.
LEDGER_DECL = re.compile(
    r"^\s*([A-Z][A-Z0-9_]*(?:FLOOR|CEILING|EXPECTED))\s*=\s*(-?\d+)\s*(?:#.*)?$", re.M)
LEDGER_DIRS = [ROOT / "scripts"]


# ═══════════════════════════════════════════════════════════════════════════════════
# 🆕 229 — A TABLE WITH TWO ROWS UNDER ONE KEY, AND THE ROW NOBODY HAS EVER READ
# ═══════════════════════════════════════════════════════════════════════════════════
#
# 228 §6b MEASURED IT RATHER THAN SUSPECTING IT. `SIZE_LEDGER` carried the key
# `('../scripts/contract_check.py', 'SHEBANG_NONEXEC_EXPECTED')` twice — once with its
# own paragraph, once with the value the tree actually ships. Python keeps the LAST, so
# the first row's reason had never been read by ANYTHING: not by `reason_problems`, not
# by the digit rule, not by `ledger_problems`, and not by the line that prints how many
# constants this file governs. That line said one fewer than the source carries, and no
# reader in the tree could say why.
#
# 🔴 THE FAILURE IS NOT THAT A ROW WAS WRONG. IT IS THAT A ROW WAS UNREACHABLE. Every
# rule this file applies to a ledger row is applied to the SURVIVING row, so a duplicate
# is a row that is exempt from all of them while LOOKING like coverage — 174 §5's
# exemption nobody re-reads, written by accident instead of on purpose, and the only
# instrument that could ever notice is one that reads the SOURCE rather than the dict.
#
# 🔴 AND THE POPULATION IS EVERY LITERAL IN `scripts/`, NOT `SIZE_LEDGER`. 228 §7.18 is
# the reason: the population a guard NAMES and the population it PROTECTS are different
# sets, and a repeat-key check written only for the table that happened to have the
# defect is a guard complete over its own title. `CONTROLS`, `BLAST`, `SCOPE_LEDGER`,
# `TARGETS`, `EXEC_ROSTER` and every roster beside them collapse the same way for the
# same reason. This reads the AST of every one of them.
LITERAL_KEY_FLOOR = 500   # governed by SIZE_LEDGER (§9.3)


def _rel(f: Path) -> str:
    """Repo-relative when the file is in the repo, absolute when it is a fixture — a
    reader that raises on its own self-check's temporary directory is a reader whose
    proof cannot be run."""
    try:
        return str(f.relative_to(ROOT))
    except ValueError:
        return str(f)


def literal_keys(dirs=None) -> list[tuple[str, int, str, list[int]]]:
    """Every constant key in every dict/set LITERAL under `dirs`, with its lines.

    Returns one row per (file, literal, key) that appears MORE THAN ONCE, plus — as the
    second element of the pair — the total number of constant keys read, which is the
    population this reader can go blind on."""
    repeats: list[tuple[str, int, str, list[int]]] = []
    for d in (dirs if dirs is not None else LEDGER_DIRS):
        for f in sorted(Path(d).rglob("*.py")):
            if "_to_delete" in f.parts:
                continue
            try:
                tree = ast.parse(f.read_text())
            except SyntaxError:
                # 🔴 NOT SWALLOWED — 228 §6.5. A classifier that answers "no repeat here"
                # about a file it could not parse is saying nothing about a file that is
                # not a file. It is a FINDING, in the same list as a duplicate.
                repeats.append((_rel(f), 0, "<unparseable>", []))
                continue
            for node in ast.walk(tree):
                if not isinstance(node, (ast.Dict, ast.Set)):
                    continue
                elts = node.keys if isinstance(node, ast.Dict) else node.elts
                seen: dict[str, list[int]] = {}
                for k in elts:
                    if k is None:
                        continue
                    try:
                        key = repr(ast.literal_eval(k))
                    except (ValueError, TypeError, SyntaxError, MemoryError):
                        continue
                    seen.setdefault(key, []).append(k.lineno)
                for key, lines in seen.items():
                    if len(lines) > 1:
                        repeats.append((_rel(f), node.lineno, key, lines))
    return repeats


def literal_key_count(dirs=None) -> int:
    """How many constant keys the reader above actually read. Its healthy answer is ZERO
    repeats, so what can collapse here is the POPULATION and never the answer — which is
    `SCANNED_FLOOR`'s argument and `ENTRY_FLOOR`'s, arriving in a third file."""
    n = 0
    for d in (dirs if dirs is not None else LEDGER_DIRS):
        for f in sorted(Path(d).rglob("*.py")):
            if "_to_delete" in f.parts:
                continue
            try:
                tree = ast.parse(f.read_text())
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                if isinstance(node, (ast.Dict, ast.Set)):
                    elts = node.keys if isinstance(node, ast.Dict) else node.elts
                    for k in elts:
                        if k is None:
                            continue
                        try:
                            ast.literal_eval(k)
                        except (ValueError, TypeError, SyntaxError, MemoryError):
                            continue
                        n += 1
    return n


def repeat_key_problems(repeats: list, read: int, floor: int) -> list[str]:
    """Two branches, and the second is the one 201 §9.43 exists for: a reader that stops
    reading finds no repeats and is indistinguishable from a tree that has none."""
    problems: list[str] = []
    for rel, lineno, key, lines in repeats:
        if key == "<unparseable>":
            problems.append(
                f"🔴 FLOOR_PIN_LITERAL_UNPARSEABLE {rel} — this reader could not parse it, "
                f"so it has said NOTHING about that file's tables. Silence here reads "
                f"exactly like a clean answer, which is the one thing a classifier may "
                f"not do (181 §4).")
            continue
        problems.append(
            f"🔴 FLOOR_PIN_LITERAL_REPEAT {rel}: the literal at line {lineno} carries the "
            f"key {key} at lines {lines}. Python keeps the LAST, so every row above it "
            f"under that key is UNREACHABLE — read by no rule in this file and counted by "
            f"no line it prints, while still looking like a row. Delete the dead one, or "
            f"fold what it says into the one that survives.")
    if read < floor:
        problems.append(
            f"🔴 FLOOR_PIN_LITERAL_COLLAPSE {read} < {floor} — the reader above read fewer "
            f"constant keys than when this floor was measured. Either literals were "
            f"deleted from scripts/, or the walk stopped reaching them; this count cannot "
            f"tell them apart. Under the second, a repeat total of zero is not a tree "
            f"with no duplicates, and the two print the same line.")
    return problems


# ═══════════════════════════════════════════════════════════════════════════════════
# 🆕 229 §7.4 — EVERY SHORTFALL REFUSAL, ASKED WHETHER ITS SENTENCE IS ITS MEASUREMENT
# ═══════════════════════════════════════════════════════════════════════════════════
#
# 228 §7.17 handed this over as the sharpest item on its list: *the comparison knows less
# than the message claims, and that gap is where every wrong cause comes from.* Its own
# `diverged()` returns PATHS and cannot know who moved them, and the first draft of the
# refusal said "it was killed mid-sweep" anyway — because that was the story in the
# author's head while the comparison was being written. Six instances in three sessions.
#
# 🔴 THE SWEEP MEASURED SOMETHING DIFFERENT FROM WHAT THE HANDOFF PREDICTED, AND THE
# DIFFERENCE IS THE RULE. Of every shortfall refusal in `scripts/`, most name NO cause at
# all — they restate the comparison and stop, which is the ideal shape — and most of the
# rest name TWO. Only a handful named one. What separates them is not care. It is what
# the population is made of:
#
#   * a LITERAL population — `len(CONTROLS) < FLOOR` — has exactly one way to shrink,
#     because there is no reader between the source and the number. Naming the cause
#     there IS the measurement, and a message that offered alternatives would be
#     inventing them.
#   * a DERIVED population — anything a finder, a walk or a regex produces — has at
#     least two, always, and they are indistinguishable from inside the comparison: the
#     thing really shrank, or the finder stopped finding it.
#
# So the rule is not "name two causes". It is: **a derived population's shortfall may
# state its observation, or list its causes, but may not assert one of them.** The roster
# below is the literal-population half, declared with the literal that makes each one
# measured — and it is a roster with a POPULATION, not an empty escape hatch, which is
# 226's rule about exemptions that cost nothing to write.
SHORTFALL_FLOOR = 15   # governed by SIZE_LEDGER (§9.3) — the `ast` reader's half
SHORTFALL_LITERAL_FLOOR = 55   # 🆕 242 — governed by SIZE_LEDGER. The literal reader's
                               # half, across .mjs, .ts and .gd. Beneath the live read for
                               # the reason the row above it is: this population moves
                               # whenever a probe gains a floor, and a floor that tracks
                               # what it measures has stopped being one.

SHORTFALL_MARK = re.compile(r"_COLLAPSE\b|_LOW\b|COLLAPSED\b|\{[^{}]*\} < \{[^{}]*\}|shrank")
# A closed vocabulary on purpose. Every entry is a PREDICATION about how the world got
# this way — not a restatement of the comparison, and not a statement of consequence.
CAUSE_CLAIM = re.compile(
    r"stopped \w+ing|stopped being|was deleted|were deleted|was dropped|was renamed|"
    r"was reworded|means the |means that |went missing|has gone|got deleted", re.I)
# 🔴 `, or ` IS IN HERE AND `or` ALONE IS NOT. "a floor or a ceiling" is a noun phrase;
# "…, or the finder stopped recognising it" is a second cause. The comma is what tells
# them apart, and getting that wrong in the permissive direction would make this rule
# agree with everything (226 §4).
ALTERNATION = re.compile(r"\beither\b|, or |\botherwise\b|\bor whose\b|\bboth\b", re.I)

# The shortfalls whose population is a LITERAL, keyed the way the message is found and
# declared with the literal that makes one cause the measured one.
MEASURED_CAUSE: dict[tuple[str, str], str] = {
    ("scripts/control_gate.py", "CONTROL_GATE_CONTROLS_COLLAPSE"):
        "`CONTROLS` is a list literal in this file and the comparison is `len()` of it. "
        "There is no finder between the source and the number, so a shortfall has exactly "
        "one cause and naming it is the measurement. Offering an alternative here would "
        "be inventing one.",
    ("scripts/floor_pin_gate.py", "USE_TARGETS"):
        "`USE_TARGETS` is a list literal in this file, read by `len()` in this file's own "
        "self-check. Same shape as the row above: the only way it shrinks is a deleted "
        "line, and the sentence says so because that is what was measured.",
    # 🆕 242 — THE FIRST NON-PYTHON ROW, AND IT ARRIVED ON THE RUN THAT WIDENED THE READER.
    ("host/scripts/boundary_gate.selftest.mjs", "BOUNDARY_SELFTEST_COLLAPSE"):
        "`ran` is incremented by `claim()` on its FIRST LINE, before the condition is "
        "evaluated, and failures are counted separately in `bad`. That literal is what "
        "makes *“cases went missing rather than failing”* a measurement rather than an "
        "assertion: a claim that fails still counts, so failure is the one cause the "
        "counter can rule out, and the sentence rules out exactly that one. It is not a "
        "derived population — the line runs at the end of a file whose `claim()` calls are "
        "all unconditional top-level statements, so reaching it at all means the file got "
        "there. 🔴 THE ROW IS HERE BECAUSE THE RULE FOUND IT, NOT BECAUSE THE RULE WAS "
        "RELAXED: 229 predicted the population on the far side of this guard was the "
        "shipped product, and the product turned out to carry ZERO refusals of this shape. "
        "What carried them — sixty-three, and the one offender — was the other half of the "
        "instruments.",
}


# 🆕 242 — THE POPULATION THE CAUSE RULE IS ASKED OVER, AND UNTIL THIS SESSION IT WAS
# `scripts/` AND NOTHING ELSE. `cause-rule-py-only`, opened 229, carried thirteen sessions.
#
# 🔴 229 PREDICTED THE WRONG FAR SIDE, AND SAYING SO IS THE POINT OF MEASURING. Its words
# were: *"The host's TypeScript and the addon's GDScript were swept BY HAND this session
# and found clean — 135 addon refusals, all observation — but nothing holds them there …
# the population on the far side of this guard is the one users actually read."* Measured
# by machine in 242, over every tracked file in each body:
#
#     host/src/**/*.ts     68 files    0 shortfall-marked refusals
#     addons/**/*.gd        8 files    0
#     host/test/**/*.ts    53 files    4, none asserting a cause
#     host/**/*.mjs        64 files   63, and ONE asserting a cause
#
# The product does not carry this shape at all. What carries it — sixty-three of the
# sixty-seven in the tree — is the JavaScript half of the instruments, which is the half
# `LEDGER_DIRS` could not see. The rule was not narrow against the product; it was narrow
# against ITSELF, and thirteen sessions of prose about the shipped code were pointed at a
# population that has never had a single instance of the thing.
#
# 🔴 ONE RULE, TWO READERS, AND THAT ASYMMETRY IS DELIBERATE. `CAUSE_CLAIM`,
# `ALTERNATION`, `MEASURED_CAUSE` and `shortfall_problems` are untouched: what widened is
# only the walk that finds refusal TEXT. Python keeps its `ast` reader because it has one;
# the other languages get a literal scanner, because putting the rule itself in a second
# file in a second language is how two rules that were meant to be one drift apart — the
# argument this file already makes above `COMMENT_DECL`.
# 🔴 THE `**/` IS PER-ROW AND LOAD-BEARING. `host/*.mjs` is NON-recursive on purpose:
# `host/scripts` and `host/test-integration` are their own rows, and a recursive walk from
# `host` would read all three twice. A duplicated population is a floor that cannot fall.
LITERAL_DIRS = [
    (ROOT / "host", "*.mjs"),
    (ROOT / "host" / "scripts", "*.mjs"),
    (ROOT / "host" / "test-integration", "*.mjs"),
    (ROOT / "host" / "src", "**/*.ts"),
    (ROOT / "host" / "test", "**/*.ts"),
    (ROOT / "addons", "**/*.gd"),
]

# A string literal in JS/TS/GDScript: backtick, double or single quoted, escapes honoured.
# Template interpolations are rendered `{}` so the text matches what the Python reader
# produces for an f-string — `SHORTFALL_MARK`'s `\{[^{}]*\} < \{[^{}]*\}` has to see the
# same shape from both readers or the rule means two different things by language.
JS_LITERAL = re.compile(r"`(?:[^`\\]|\\.)*`|\"(?:[^\"\\\n]|\\.)*\"|'(?:[^'\\\n]|\\.)*'", re.S)


def _literal_bodies(text: str):
    """(line, body) for every string literal, interpolations rendered as `{}`."""
    for m in JS_LITERAL.finditer(text):
        body = m.group(0)[1:-1]
        if m.group(0)[0] == "`":
            body = re.sub(r"\$\{[^{}]*\}", "{}", body)
        yield text[:m.start()].count("\n") + 1, body


def shortfall_refusals(dirs=None, literal_dirs=None) -> list[tuple[str, int, str]]:
    """(file, line, text) for every shortfall refusal in the tree's refusing languages.

    A refusal is 'shortfall' when it carries a collapse marker or a `{} < {}` comparison —
    the family whose whole job is to notice a population getting smaller, and the family
    228 §7.17 was about.

    🔴 THE TWO READERS ANSWER DIFFERENT QUESTIONS AND THAT IS WHY BOTH RUN. Python is read
    through `ast`, so a shortfall string is only found where it is ARGUED — passed to
    `print`, `append` or `extend`. The literal reader has no call graph and reads every
    string literal in the file, which is wider: it would also catch a marker sitting in a
    comparison table or a fixture. Wider is the safe direction for a rule whose failure
    mode is going quiet, and the narrowing that matters is `CAUSE_CLAIM` — a literal that
    merely mentions a collapse is not a refusal that asserts why.
    """
    out: list[tuple[str, int, str]] = []
    for d in (dirs if dirs is not None else LEDGER_DIRS):
        for f in sorted(Path(d).rglob("*.py")):
            if "_to_delete" in f.parts:
                continue
            try:
                tree = ast.parse(f.read_text())
            except SyntaxError:
                out.append((_rel(f), 0, "<unparseable>"))
                continue
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                fn = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
                if fn not in ("print", "append", "extend"):
                    continue
                for a in node.args:
                    text = _flatten_str(a)
                    if text and SHORTFALL_MARK.search(text):
                        out.append((_rel(f), node.lineno, text))
    for d, pat in (literal_dirs if literal_dirs is not None else LITERAL_DIRS):
        if not d.is_dir():
            continue
        # 🔴 NOT `rglob`, BECAUSE `host` AND `host/scripts` ARE BOTH ROSTERED and a
        # recursive walk from the first would read the second twice — a duplicated
        # population is a floor that cannot fall, which is the opposite of what it is for.
        for f in sorted(d.glob(pat)):
            if "_to_delete" in f.parts or "node_modules" in f.parts:
                continue
            for line, body in _literal_bodies(f.read_text()):
                if SHORTFALL_MARK.search(body):
                    out.append((_rel(f), line, body))
    return out


def _flatten_str(node) -> str | None:
    """A string literal, an f-string or a `+` chain of either, with the interpolations
    rendered as `{}` — the text a reader sees, minus the values."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.JoinedStr):
        return "".join(v.value if isinstance(v, ast.Constant) and isinstance(v.value, str)
                       else "{}" for v in node.values)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left, right = _flatten_str(node.left), _flatten_str(node.right)
        if left is not None and right is not None:
            return left + right
    return None


def _declared_measured(rel: str, text: str) -> bool:
    return any(f == rel and token in text for (f, token) in MEASURED_CAUSE)


def shortfall_problems(refusals: list, floor: int, literal_floor: int | None = None) -> list[str]:
    """Two branches, and the population floor is the second — a finder that stops finding
    shortfall refusals reports none that assert a cause and reads exactly like a tree
    where none do (201 §9.43, and the reason every reader in this file has a floor).

    🆕 242 — AND THE FLOOR IS TWO FLOORS, BECAUSE THERE ARE NOW TWO READERS. A single
    floor over the sum cannot catch one of them dying: the `ast` reader finds 26 and the
    literal reader finds 67, so the Python half could stop matching entirely and the total
    would still be 67, which clears any floor set beneath the live sum. That is
    `lint_ceiling.py` §2's argument in this file's own words — *six can be reached two
    ways* — and 229 §2's about `SCANNED_FLOOR` arriving in a fourth file. Summing them
    destroys the distinction the floor exists to make. `literal_floor=None` keeps the
    fixtures single-population, which is what every `_self_check` case below wants.
    """
    problems: list[str] = []
    for rel, line, text in refusals:
        if text == "<unparseable>":
            problems.append(
                f"🔴 FLOOR_PIN_SHORTFALL_UNPARSEABLE {rel} — this reader could not parse "
                f"it, so it has said NOTHING about that file's refusals (181 §4).")
            continue
        if not CAUSE_CLAIM.search(text) or ALTERNATION.search(text):
            continue
        if _declared_measured(rel, text):
            continue
        problems.append(
            f"🔴 FLOOR_PIN_SHORTFALL_CAUSE {rel}:{line} — a shortfall refusal over a "
            f"DERIVED population asserts ONE cause: “{_excerpt(text)}”. The comparison "
            f"that produced it is a count, and a count cannot tell a population that "
            f"really shrank from a finder that stopped finding it. State the observation, "
            f"or list the causes and say which caller rules one out (228 §7.17). If the "
            f"population really is a literal, declare it in MEASURED_CAUSE with the "
            f"literal that makes one cause the measured one.")
    if len(refusals) < floor:
        problems.append(
            f"🔴 FLOOR_PIN_SHORTFALL_COLLAPSE {len(refusals)} < {floor} — this reader "
            f"found fewer shortfall refusals than when its floor was measured. Either "
            f"refusals were deleted, or the reader stopped recognising one, and zero "
            f"cause-asserting refusals over a population that collapsed is the shape this "
            f"whole file exists to refuse.")
    return problems


def shortfall_floor_problems(refusals: list, py_floor: int, literal_floor: int) -> list[str]:
    """🆕 242 — the two populations, floored apart. See `shortfall_problems`'s docstring.

    Partitioned by SUFFIX and not by which walk produced it, on purpose: the reader that
    found a refusal is an implementation detail, and the question a floor asks is whether
    the tree's Python refusals and its JavaScript ones are both still being seen.
    """
    py = [r for r in refusals if r[0].endswith(".py")]
    lit = [r for r in refusals if not r[0].endswith(".py")]
    out: list[str] = []
    for name, pop, fl, reader in (("PY", py, py_floor, "the `ast` reader over scripts/"),
                                  ("LITERAL", lit, literal_floor,
                                   "the string-literal reader over .mjs, .ts and .gd")):
        if len(pop) < fl:
            out.append(
                f"🔴 FLOOR_PIN_SHORTFALL_{name}_COLLAPSE {len(pop)} < {fl} — {reader} found "
                f"fewer shortfall refusals than when its floor was measured. The OTHER "
                f"reader is unaffected and its count says nothing about this one, which is "
                f"why these are two floors: a sum beneath which one reader can die "
                f"silently is not a floor, it is a total.")
    return out


def measured_cause_stale(refusals: list) -> list[str]:
    """🔴 THE ROSTER'S OWN DEAD ROWS, AND IT IS A SEPARATE PREDICATE ON PURPOSE. An
    exemption that outlives the message it was written for is 174 §5, and this file
    already refuses one shape of it in `stale-exempt`. It is lifted out of
    `shortfall_problems` so the rule above can be proved on FIXTURES without every
    fixture reading as a roster that went stale — the two questions have different
    populations and folding them together made the self-check unable to ask either."""
    problems: list[str] = []
    for (f_, token), _reason in MEASURED_CAUSE.items():
        if not any(rel == f_ and token in text for rel, _l, text in refusals):
            problems.append(
                f"🔴 FLOOR_PIN_SHORTFALL_STALE MEASURED_CAUSE declares {f_}:{token} and no "
                f"shortfall refusal there carries it. Either the message moved or the "
                f"reader stopped finding it — and until one is established the row is an "
                f"exemption with nothing under it, which is the one thing this table may "
                f"not be.")
    return problems


def _excerpt(text: str) -> str:
    """The clause that carries the claim, so the refusal quotes the sentence it is about
    rather than making the reader go and find it."""
    m = CAUSE_CLAIM.search(text)
    flat = " ".join(text.split())
    start = max(0, len(" ".join(text[:m.start()].split())) - 40)
    return flat[start:start + 130].strip()


def governed_sizes() -> dict[tuple[str, str], int]:
    """Every governed size constant in the tree, keyed the way TARGETS keys them."""
    out: dict[tuple[str, str], int] = {}
    for d in LEDGER_DIRS:
        for f in sorted(d.rglob("*.py")):
            if "_to_delete" in f.parts:
                continue
            rel = "../" + str(f.relative_to(ROOT))
            for name, val in LEDGER_DECL.findall(f.read_text()):
                out[(rel, name)] = int(val)
    return out


# 🔴 201 §9.4 — AND THE COMMENT ON THE DECLARATION LINE ITSELF.
# Rewriting the thirteen offenders is the fix; this is the gate that stops a fourteenth.
# The rule is `reason_problems()` UNCHANGED, pointed at the live tree instead of at a
# table — so the thing that governs a ledger reason and the thing that governs a floor's
# own annotation are one rule, not two that can drift apart.
#
# 🔴 THE SCOPE IS THE INLINE COMMENT ON THE DECLARATION LINE, AND THAT IS A BOUNDARY,
# NOT AN OVERSIGHT. Several of these constants carry continuation comments beneath them
# — prose paragraphs about why the floor exists. Those are governed by nothing and this
# session did not widen to them: it is a different population with a different shape, and
# a rule that forces narrative prose into spelled-out words is a rule people route
# around. Named in 202 §9 rather than left implied. What a reader takes for the
# constant's own annotation is the line the constant is on.
COMMENT_DECL = re.compile(
    r"^\s*([A-Z][A-Z0-9_]*(?:FLOOR|CEILING|EXPECTED))\s*=\s*-?\d+\s*#\s*(.+)$", re.M)
# 🔴 202 §6 — THIS FLOOR EXISTS BECAUSE THE SWEEP REFUTED A PREDICTION.
# `M2` broke COMMENT_DECL so it matched nothing and the check went GREEN: no comments
# read, no comments to flag. 201 §9.43's "a check with an empty population passes for
# the wrong reason", arriving inside a check written in the same session that quoted the
# rule — which is the cheapest possible argument for predicting every mutant's verdict
# and then believing the tree over the prediction (201 §8's C3).
#
# `governed_sizes()` did NOT need this: emptying it turns every ledger row STALE and
# reddens, which `L4` proves. The asymmetry is the point — one reader fails loud and one
# failed silent, and only running both mutants said which was which.
COMMENT_FLOOR = 17   # governed by SIZE_LEDGER (§9.3)


def declaration_comments() -> dict[tuple[str, str], str]:
    out: dict[tuple[str, str], str] = {}
    for d in LEDGER_DIRS:
        for f in sorted(d.rglob("*.py")):
            if "_to_delete" in f.parts:
                continue
            rel = "../" + str(f.relative_to(ROOT))
            for name, comment in COMMENT_DECL.findall(f.read_text()):
                out[(rel, name)] = comment.strip()
    return out


def comment_problems(comments: dict[tuple[str, str], str]) -> list[str]:
    """The reason rule, plus the floor `M2` proved it needed."""
    problems: list[str] = []
    if len(comments) < COMMENT_FLOOR:
        problems.append(
            f"🔴 FLOOR_PIN_COMMENT_COLLAPSE {len(comments)} < {COMMENT_FLOOR} — the "
            f"reader that finds declaration comments stopped finding them. This check "
            f"has NOTHING TO DISAGREE WITH and would pass for the wrong reason (201 "
            f"§9.43). Either comments were legitimately deleted (lower the floor on "
            f"purpose and say why in SIZE_LEDGER) or COMMENT_DECL was narrowed, which is "
            f"the dangerous half — every comment it stopped reading went ungoverned in "
            f"the same edit and this line is the only thing that would say so.")
    return problems + reason_problems(comments, "comment")


def ledger_problems(ledger: dict[tuple[str, str], tuple[int, str]],
                    live: dict[tuple[str, str], int]) -> list[str]:
    """🔴 201 §9.3 — READ WHY A ROSTER IS THE SIZE IT IS, IN BOTH DIRECTIONS.

    Lifted so `_self_check()` can feed it inputs it MUST flag and inputs it must not —
    the shape this file finally applied to itself in 201 §10.3."""
    problems: list[str] = []
    for key, value in sorted(live.items()):
        if key not in ledger:
            problems.append(
                f"🔴 FLOOR_PIN_LEDGER_UNGOVERNED {key[0]}:{key[1]} = {value} — a size "
                f"constant arrived with no ledger row. Add one saying why it is this "
                f"size; a roster nobody has to explain is one that can shrink by "
                f"accident, which is 201's D1.")
        elif ledger[key][0] != value:
            problems.append(
                f"🔴 FLOOR_PIN_LEDGER_DRIFT {key[0]}:{key[1]} holds {value} and its "
                f"ledger row says {ledger[key][0]}. If the change was DELIBERATE, update "
                f"the row and say why in the same commit — that sentence is the only "
                f"thing in this tree that tells a deliberate shrink from an accidental "
                f"one. If it was not, this is the line that caught it.")
    for key in sorted(ledger):
        if key not in live:
            problems.append(
                f"🔴 FLOOR_PIN_LEDGER_STALE {key[0]}:{key[1]} has a ledger row and no "
                f"constant. Either it was deleted (delete the row in the same commit) or "
                f"the scan stopped being able to READ it — the more dangerous half, "
                f"because every other constant of that shape went ungoverned with it "
                f"(197's rule, and 202 §5's indentation is how it happens).")
    return problems


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

    # ── 🆕 201 §9.2 — AND THE CALLS THEMSELVES, NOT JUST THE LOGIC ──────────────
    # Everything above proves a PREDICATE. `U2` said nothing proves `main()` still
    # RUNS one, because on a green tree a predicate that finds nothing reads exactly
    # like a predicate nobody asked. Patched stubs make each call site observable
    # without needing a population — which is why the empty table stops being special.
    bad += _call_wiring_problems()

    # ── 🆕 201 §9.3 — AND THE LEDGER'S OWN PREDICATE, ON A FIXTURE ──────────────
    if not ledger_problems({("f.py", "A_FLOOR"): (3, "a reason")}, {("f.py", "A_FLOOR"): 2}):
        bad.append("_self_check: ledger_problems did NOT flag a live value that "
                   "disagrees with its ledger entry — a roster could shrink with the "
                   "ledger still reading as though it had not")
    if ledger_problems({("f.py", "A_FLOOR"): (3, "a reason")}, {("f.py", "A_FLOOR"): 3}):
        bad.append("_self_check: ledger_problems flagged a value that AGREES with its "
                   "ledger — the rule is over-wide and every run would be red")
    if not ledger_problems({}, {("f.py", "A_FLOOR"): 3}):
        bad.append("_self_check: ledger_problems did NOT flag a governed constant with "
                   "no ledger entry at all — a new floor could arrive ungoverned")
    if not ledger_problems({("gone.py", "B_FLOOR"): (1, "r")}, {}):
        bad.append("_self_check: ledger_problems did NOT flag a ledger entry whose "
                   "constant no longer exists — 197's other direction, unread here")

    # ── 🆕 202 §6 — THE COMMENT FLOOR, WHICH `M2` PROVED THIS CHECK NEEDED ──────
    if not comment_problems({}):
        bad.append("_self_check: comment_problems stayed quiet on an EMPTY comment set — "
                   "that is exactly how M2 passed, and 201 §9.43 is the rule it breaks")
    if comment_problems({(f"f{i}.py", "A_FLOOR"): "spelled in words" for i in
                         range(COMMENT_FLOOR)}):
        bad.append("_self_check: comment_problems flagged a full set of clean comments — "
                   "the floor is `<` and a population AT it is legal")

    # ── 🆕 229 §6b — THE REPEAT-KEY RULE, ON FIXTURES, BOTH DIRECTIONS ──────────
    # The live tree's healthy answer is an EMPTY list, so running the rule over it
    # proves exactly nothing — the `U1` shape again, three predicates later.
    fx_rep = [("f.py", 9, "'K'", [9, 12])]
    if not repeat_key_problems(fx_rep, LITERAL_KEY_FLOOR, LITERAL_KEY_FLOOR):
        bad.append("_self_check: repeat_key_problems did NOT flag a key appearing twice "
                   "in one literal — the branch is dead and 228 §6b could be re-typed "
                   "today with this gate printing a clean line over it")
    if repeat_key_problems([], LITERAL_KEY_FLOOR, LITERAL_KEY_FLOOR):
        bad.append("_self_check: repeat_key_problems flagged a table with NO repeats and "
                   "a population at its floor — the rule is over-wide and the comparison "
                   "is `<`, so a population AT the floor is legal")
    if not repeat_key_problems([], LITERAL_KEY_FLOOR - 1, LITERAL_KEY_FLOOR):
        bad.append("_self_check: repeat_key_problems did NOT flag a population one below "
                   "its floor — zero repeats over a collapsed read is a reader that "
                   "stopped reading, and nothing else would say so")
    if not repeat_key_problems([("f.py", 0, "<unparseable>", [])], LITERAL_KEY_FLOOR,
                               LITERAL_KEY_FLOOR):
        bad.append("_self_check: repeat_key_problems treated an UNPARSEABLE file as a "
                   "clean answer — 228 §6.5's swallowed SyntaxError, in the reader "
                   "rather than in the control")

    # 🔴 AND THE READER ITSELF, ON A DIRECTORY WRITTEN FOR IT. A predicate proved on
    # fixtures says nothing about whether the AST walk in front of it can SEE a repeat:
    # 228 §6.5 is the same distinction one level down, where the classifier answered
    # about a file it had never parsed.
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        (d / "clean.py").write_text("T = {'a': 1, 'b': 2}\nS = {'x', 'y'}\n")
        if literal_keys([d]):
            bad.append("_self_check: literal_keys() found a repeat in a literal that has "
                       "none — every run would be red")
        if literal_key_count([d]) != 4:
            bad.append("_self_check: literal_key_count() miscounted a fixture whose keys "
                       "can be counted by hand — the population line is not measuring "
                       "what it says")
        (d / "dupe.py").write_text("T = {'a': 1, 'a': 2}\n")
        if not literal_keys([d]):
            bad.append("_self_check: literal_keys() did NOT see a key written twice in "
                       "one dict literal — the walk is blind and the predicate above it "
                       "would never be given anything to flag")
        (d / "broken.py").write_text("def f(:\n")
        if not any(k == "<unparseable>" for _, _, k, _ in literal_keys([d])):
            bad.append("_self_check: literal_keys() swallowed a SyntaxError and reported "
                       "nothing about a file it could not read (228 §6.5)")

    # ── 🆕 229 §7.4 — THE SHORTFALL RULE, BOTH DIRECTIONS, ON FIXTURES ──────────
    ASSERTS = [("f.py", 1, "🔴 X_COLLAPSE {} < {} — the finder stopped finding them.")]
    LISTS = [("f.py", 1, "🔴 X_COLLAPSE {} < {} — either a row was deleted, or the "
                         "finder stopped finding them.")]
    STATES = [("f.py", 1, "🔴 X_COLLAPSE {} < {} — fewer rows than when this was measured.")]
    if not shortfall_problems(ASSERTS, 0):
        bad.append("_self_check: shortfall_problems did NOT flag a derived shortfall that "
                   "asserts one cause — the branch is dead and 228 §7.17 could be "
                   "re-typed today with this gate green over it")
    if shortfall_problems(LISTS, 0):
        bad.append("_self_check: shortfall_problems flagged a refusal that LISTS its "
                   "causes — the rule is over-wide and the house idiom would become "
                   "the violation")
    if shortfall_problems(STATES, 0):
        bad.append("_self_check: shortfall_problems flagged a refusal that states its "
                   "observation and asserts nothing — that is the ideal shape, and a "
                   "rule that refuses it teaches authors to add causes they cannot "
                   "support")
    if not shortfall_problems([], SHORTFALL_FLOOR):
        bad.append("_self_check: shortfall_problems stayed quiet on an EMPTY population "
                   "below its floor — a reader that stopped reading finds no refusal "
                   "asserting a cause, which is 201 §9.43 in this file's newest rule")
    if not shortfall_problems([("f.py", 0, "<unparseable>")], 0):
        bad.append("_self_check: shortfall_problems treated an UNPARSEABLE file as a "
                   "clean answer (228 §6.5)")
    if not measured_cause_stale([]):
        bad.append("_self_check: measured_cause_stale stayed quiet over an EMPTY "
                   "population while MEASURED_CAUSE declares rows — every exemption in "
                   "it could outlive its message with nothing saying so (174 §5)")
    # and the reader in front of it, on a written directory
    # 🆕 242 — `literal_dirs=[]` IS LOAD-BEARING AND WAS THE FIRST THING THE WIDENING
    # BROKE. Adding a second walk to a finder whose fixture pinned "exactly one" made this
    # case read 68: one from the written file and sixty-seven from the live tree. A
    # fixture that silently absorbs the live population is a fixture proving nothing, so
    # each half is now pointed at its own written directory and nothing else.
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        (d / "r.py").write_text(
            'n = 1\nprint(f"🔴 A_COLLAPSE {n} < {n} — fewer than measured.")\n'
            'print("nothing to do with floors at all")\n')
        found = shortfall_refusals([d], literal_dirs=[])
        if len(found) != 1:
            bad.append(f"_self_check: shortfall_refusals() read {len(found)} refusal(s) "
                       f"out of a fixture holding exactly one — the finder this rule "
                       f"stands on is not reading what it says it reads")
        # 🆕 242 — THE LITERAL READER, ON ITS OWN WRITTEN FILE, IN THE THREE LANGUAGES IT
        # CLAIMS. Backtick with an interpolation, double quote and a GDScript single
        # quote, plus one line that mentions a floor and refuses nothing. Without this the
        # widened half is a walk nothing proves, which is the shape 229 §2 refuses.
        (d / "g.mjs").write_text(
            'const n = 1;\n'
            'console.log(`🔴 B_COLLAPSE ${n} < ${n} — fewer than measured.`);\n'
            'console.log("🔴 C_LOW — a second one, double quoted");\n'
            'console.log("nothing to do with floors at all");\n')
        (d / "h.gd").write_text(
            "func f():\n\tprint('🔴 D_COLLAPSE 1 < 2 — the addon spelling')\n")
        lit = shortfall_refusals([], literal_dirs=[(d, "*.mjs"), (d, "*.gd")])
        if len(lit) != 3:
            bad.append(f"_self_check: the literal reader found {len(lit)} refusal(s) in a "
                       f"fixture holding exactly three — one per quote character, and the "
                       f"one it misses is the language it stops covering")
        # 🔴 AND THE INTERPOLATION HAS TO RENDER AS `{}` OR `SHORTFALL_MARK`'s
        # `{} < {}` ARM MEANS TWO DIFFERENT THINGS BY LANGUAGE. Asserted on the TEXT.
        if not any("{} < {}" in t for _f, _l, t in lit):
            bad.append("_self_check: the literal reader did not render a template "
                       "interpolation as `{}`, so a JS refusal and the identical Python "
                       "f-string are two different strings to one rule")
        # 🔴 THE TWO FLOORS, EACH PROVED TO BITE OVER ITS OWN HALF AND STAY QUIET OVER THE
        # OTHER'S — which is the whole claim that they are two floors and not a total.
        py_only = [("a.py", 1, "x"), ("b.py", 1, "x")]
        js_only = [("a.mjs", 1, "x"), ("b.mjs", 1, "x")]
        if not any("PY_COLLAPSE" in m for m in shortfall_floor_problems(js_only, 2, 0)):
            bad.append("_self_check: the python floor stayed quiet over a population that "
                       "is ENTIRELY literal — a sum beneath which one reader dies silently")
        if not any("LITERAL_COLLAPSE" in m for m in shortfall_floor_problems(py_only, 0, 2)):
            bad.append("_self_check: the literal floor stayed quiet over a population that "
                       "is ENTIRELY python — the same defect with its sign flipped")
        if shortfall_floor_problems(py_only + js_only, 2, 2):
            bad.append("_self_check: both floors refused a population that meets both — a "
                       "floor that cannot be satisfied is not read, it is edited")
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


CALL_SENTINEL = "🔴 FLOOR_PIN_CALL_WIRING sentinel — a patched predicate reached the report"


def collect_problems() -> dict[str, list[str]]:
    """🔴 201 §9.2 — EVERY LIFTED PREDICATE IS INVOKED HERE AND NOWHERE ELSE.

    201 lifted five branches out of `main()` and fed each a fixture. 201's own reverse
    sweep then declared `U2` green: **delete the CALL from `main()` and nothing reddens.**
    The fixtures prove the FUNCTION; nothing proved the GATE still runs it. An instrument
    proved where its logic is DECLARED and unproved where it is INVOKED is `C2` one level
    up, and it is why this indirection exists.

    🔴 AND THE REASON A MUTATION OF THE INPUT COULD NOT CLOSE IT. `U2`'s note was that
    the live population is EMPTY — `ceiling_problems(0, 0)` returns `[]` whether it is
    called or not, so no edit to `UNDISCOVERABLE_DECLARED` can make that call site
    observable. On a GREEN tree the same is true of all four: a predicate that finds
    nothing is indistinguishable from a predicate nobody asked. Mutating the INPUT can
    never reach them.

    🆕 PATCHING THE PREDICATE CAN. `_call_wiring_problems()` replaces each function with
    a stub that returns a sentinel and requires that sentinel to arrive under its own key
    — which needs no population at all, and is why the empty table stops being special.
    Two `reason_problems` call sites are distinguished by their `label`, so the one whose
    table is empty is proved exactly as well as the one whose table has 25 rows.

    🔴 WHAT THIS DOES NOT CLOSE, STATED PLAINLY: `main()` calls THIS function, and that
    one call is unproved for the same reason the five were. The regress is real. It is
    now ONE call instead of five-plus-an-unreachable-hole, and `W1` in the reverse sweep
    is the mutant that says so."""
    return {
        "targets": targets_collapse_problems(len(TARGETS), TARGET_FLOOR),
        "reason": (reason_problems(DISCOVER_EXEMPT, "exempt")
                   + reason_problems(UNDISCOVERABLE_DECLARED, "declared")),
        "ceiling": ceiling_problems(len(UNDISCOVERABLE_DECLARED), UNDISCOVERABLE_CEILING),
        "ledger": (ledger_problems(SIZE_LEDGER, governed_sizes())
                   + reason_problems({k: v[1] for k, v in SIZE_LEDGER.items()}, "ledger")),
        "comment": comment_problems(declaration_comments()),
        "repeat": repeat_key_problems(literal_keys(), literal_key_count(),
                                      LITERAL_KEY_FLOOR),
        "shortfall": (shortfall_problems(shortfall_refusals(), 0)
                      + shortfall_floor_problems(shortfall_refusals(), SHORTFALL_FLOOR,
                                                 SHORTFALL_LITERAL_FLOOR)
                      + measured_cause_stale(shortfall_refusals())),
    }


def _call_wiring_problems() -> list[str]:
    """🔴 201 §9.2 — PROVE THE CALL, NOT THE LOGIC.

    For each predicate, swap in a stub that returns the sentinel and require
    `collect_problems()` to surface it under the key that predicate feeds. A deleted call
    site loses its sentinel and this reddens; a call site rewired to the WRONG key
    reddens too, because the key is part of the claim (199 §35).

    The stub returns a problem unconditionally, so an EMPTY input table is no longer a
    reason a call site cannot be observed — which is the whole of `U2`."""
    import builtins  # noqa: F401  (kept local; this function is the only patcher)
    g = globals()
    bad: list[str] = []

    # (key it must land under, name to patch, stub)
    CASES: list[tuple[str, str, object]] = [
        ("targets", "targets_collapse_problems", lambda *a, **k: [CALL_SENTINEL]),
        ("ceiling", "ceiling_problems", lambda *a, **k: [CALL_SENTINEL]),
        ("ledger", "ledger_problems", lambda *a, **k: [CALL_SENTINEL]),
        ("repeat", "repeat_key_problems", lambda *a, **k: [CALL_SENTINEL]),
        ("shortfall", "shortfall_problems", lambda *a, **k: [CALL_SENTINEL]),
    ]
    for key, fname, stub in CASES:
        real = g[fname]
        g[fname] = stub
        try:
            got = collect_problems()
        finally:
            g[fname] = real
        if CALL_SENTINEL not in got.get(key, []):
            bad.append(f"_call_wiring: main()'s report no longer carries {fname}() under "
                       f"{key!r} — the predicate is intact and NOTHING CALLS IT. This is "
                       f"201's U2: the fixture proves the function, this proves the gate "
                       f"still runs it")
        leaked = [k for k, v in got.items() if k != key and CALL_SENTINEL in v]
        if leaked:
            bad.append(f"_call_wiring: {fname}()'s result arrived under {leaked} as well "
                       f"as {key!r} — a predicate feeding a key its reason is not about "
                       f"is 199 §35, and the key is part of the claim")

    # 🔴 THE TWO reason_problems CALL SITES, TOLD APART BY THEIR LABEL. One reads a table
    # with 25 rows and one reads a table that is EMPTY. Under a mutation of the input the
    # second is unreachable; under a patched predicate both are ordinary.
    real = g["reason_problems"]
    g["reason_problems"] = lambda table, label, *a, **k: [f"{CALL_SENTINEL} [{label}]"]
    try:
        got = collect_problems()
    finally:
        g["reason_problems"] = real
    KEY_OF = {"exempt": "reason", "declared": "reason",
              "ledger": "ledger", "comment": "comment"}
    for label, key in KEY_OF.items():
        if f"{CALL_SENTINEL} [{label}]" not in got.get(key, []):
            bad.append(f"_call_wiring: reason_problems(..., {label!r}) is no longer "
                       f"called — and for {label!r} in particular nothing else would ever "
                       f"say so, because that table is empty and the predicate returns "
                       f"[] whether it runs or not")

    # 🔴 AND THE SCAN FEEDING THE LEDGER, WHICH IS A DIFFERENT CALL FROM THE PREDICATE
    # THAT READS IT. `ledger_problems(SIZE_LEDGER, governed_sizes())` has TWO arguments
    # and only one of them has been proved to arrive. Patching the scan to report a
    # constant the ledger does not govern must produce a problem; if it does not, the
    # scan's result is being computed and thrown away — 200 §35 in its third spelling,
    # a value defended where it is produced and unread where it is consumed.
    real = g["governed_sizes"]
    g["governed_sizes"] = lambda: {("../scripts/nowhere.py", "FABRICATED_FLOOR"): 1}
    try:
        got = collect_problems()
    finally:
        g["governed_sizes"] = real
    if not any("FABRICATED_FLOOR" in p for p in got.get("ledger", [])):
        bad.append("_call_wiring: governed_sizes()'s result never reaches "
                   "ledger_problems() — the tree is scanned and the answer discarded, so "
                   "every governed constant could drift with the ledger still agreeing "
                   "with itself")

    # 🆕 229 — AND THE TWO READERS BEHIND THE REPEAT CHECK, FOR THE SAME REASON.
    # `repeat_key_problems(literal_keys(), literal_key_count(), FLOOR)` has THREE
    # arguments and the sentinel above proves only that the predicate is called. On a
    # green tree `literal_keys()` returns [] and `literal_key_count()` is above its
    # floor, so BOTH could be computed and thrown away with the report unchanged — which
    # is exactly the shape 200 §35 named and `governed_sizes` is guarded against.
    real = g["literal_keys"]
    g["literal_keys"] = lambda *a, **k: [("nowhere/fabricated.py", 1, "'FABRICATED_KEY'",
                                          [1, 2])]
    try:
        got = collect_problems()
    finally:
        g["literal_keys"] = real
    if not any("FABRICATED_KEY" in p for p in got.get("repeat", [])):
        bad.append("_call_wiring: literal_keys()'s result never reaches "
                   "repeat_key_problems() — every table in scripts/ could carry a "
                   "duplicate key with this gate still printing a clean repeat line")
    real = g["literal_key_count"]
    g["literal_key_count"] = lambda *a, **k: 0
    try:
        got = collect_problems()
    finally:
        g["literal_key_count"] = real
    if not any("LITERAL_COLLAPSE" in p for p in got.get("repeat", [])):
        bad.append("_call_wiring: literal_key_count()'s result never reaches "
                   "repeat_key_problems() — the population could collapse to nothing "
                   "with the repeat check reporting zero repeats and meaning it")

    # 🆕 229 §7.4 — AND THE READER BEHIND THE SHORTFALL RULE. On a green tree it returns
    # a list with nothing to flag, so it can be computed and discarded with the report
    # byte-identical — 200 §35 for the third time in this function.
    real = g["shortfall_refusals"]
    g["shortfall_refusals"] = lambda *a, **k: [
        ("nowhere/fabricated.py", 1, "🔴 X_COLLAPSE {} < {} — the finder stopped finding it.")]
    try:
        got = collect_problems()
    finally:
        g["shortfall_refusals"] = real
    if not any("fabricated.py" in p for p in got.get("shortfall", [])):
        bad.append("_call_wiring: shortfall_refusals()'s result never reaches "
                   "shortfall_problems() — every refusal in scripts/ could assert a cause "
                   "its comparison cannot support with this gate still green")
    return bad


def main() -> int:
    # 🔴 224 §6.6 — BEFORE THE SELF-CHECK, NOT AFTER. This gate rewrites TRACKED
    # files and restores them in a `finally`; a second one running now would read
    # and write the same tree. A self-check that ran first would be reading
    # somebody else's mutant and would report it as a defect in this repository.
    acquire("floor_pin_gate.py")
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

    # ── 🆕 201 §9.2 — ONE INVOCATION POINT, SO THE CALLS THEMSELVES CAN BE PROVED ──
    probs = collect_problems()

    for problem in probs["targets"]:
        print(problem)
        failed = True

    # ── 🆕 201 §10.4 — THE REASONS, ASKED WHETHER THEY QUOTE AN UNGOVERNED NUMBER ───
    reason_bad = probs["reason"]
    for problem in reason_bad:
        print(problem)
        failed = True
    # ── 🆕 201 §9.3 + §9.4 — WHY EACH GOVERNED ROSTER IS THE SIZE IT IS ────────────
    for problem in probs["ledger"]:
        print(problem)
        failed = True
    for problem in probs["comment"]:
        print(problem)
        failed = True
    # ── 🆕 229 §6b — AND WHETHER ANY GOVERNED TABLE HAS A ROW NOTHING CAN REACH ────
    for problem in probs["repeat"]:
        print(problem)
        failed = True
    # ── 🆕 229 §7.4 — AND WHETHER EACH SHORTFALL REFUSAL'S SENTENCE IS ITS MEASUREMENT ─
    for problem in probs["shortfall"]:
        print(problem)
        failed = True
    _sizes = governed_sizes()
    _comments = declaration_comments()
    print(f"FLOOR_PIN_LEDGER {len(SIZE_LEDGER)} governed size constant(s) across "
          f"{len({f for f, _ in SIZE_LEDGER})} file(s) · {len(_sizes)} found in the tree "
          f"· {len(probs['ledger'])} ungoverned, drifted, stale or quoting a bare number")
    print(f"FLOOR_PIN_COMMENT {len(_comments)} declaration comment(s) read · "
          f"{len(probs['comment'])} quoting a number the tree does not govern")
    _short = shortfall_refusals()
    _py = sum(1 for r in _short if r[0].endswith(".py"))
    print(f"FLOOR_PIN_SHORTFALL {len(_short)} shortfall refusal(s) read · {_py} python / "
          f"floor {SHORTFALL_FLOOR} · {len(_short) - _py} literal / floor "
          f"{SHORTFALL_LITERAL_FLOOR} · {len(MEASURED_CAUSE)} declared measured-cause · "
          f"{len(probs['shortfall'])} asserting a cause their comparison cannot support")
    print(f"FLOOR_PIN_LITERAL {literal_key_count()} constant key(s) read across every "
          f"dict/set literal in scripts/ · floor {LITERAL_KEY_FLOOR} · "
          f"{len(probs['repeat'])} unreachable row(s) or unparseable file(s)")

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
    for problem in probs["ceiling"]:
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
    # 🆕 228 — `run_and_settle` and not `main`: the mutation record has to close on
    # EVERY exit path, and this file has more than one. See _gate_lock.run_and_settle.
    sys.exit(run_and_settle("floor_pin_gate.py", main))
