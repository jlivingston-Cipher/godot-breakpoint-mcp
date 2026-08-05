#!/usr/bin/env python3
"""scope_gate.py — session 172. THE GATE THAT BLINDS THE GATE.

171 §7 built a reverse sweep that re-injected taut169's own bug into the new tautology
gate, on the grounds that "a gate that cannot detect its own blindness is the gate that
produced this session". This is that idea applied to `contract_check.py`, and it is not
hypothetical: 171 §10.21 asked what each of its enumerators would print if its finder
matched nothing, and the answer, measured, was:

    25 blindable enumerators · CONTROL PASS · 11 caught · 🔴 14 STILL GREEN

Fourteen finders could match NOTHING and the run still printed ALL HARD CHECKS PASSED,
because every check downstream compares set intersections, iterates a list, or filters
for offenders — and an empty input satisfies all three instantly and silently. The scope
ledger (check 20) closed them with literal floors. THIS FILE IS WHAT KEEPS THEM CLOSED:
it blinds each enumerator in turn and asserts the run goes RED.

Without it the ledger is a list of numbers that nobody re-derives. A floor that is never
tested against the collapse it names is itself a claim that cannot fail.

Run: python3 scripts/scope_gate.py   (a CI step beside the tautology gate)
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# 🔴 ONE PARSER, NOT TWO. `statements()` is an AST walk that took three drafts in 186 to
# get right; `auto_fingerprints()` enforces the same one-statement-per-literal rule
# CONTROLS obeys by hand. A second copy here would drift from the gate whose number this
# one is meant to complete. control_gate does NOT import this file, so the edge is acyclic.
from control_gate import (  # noqa: E402
    auto_fingerprints as cg_auto_fingerprints,
    statements as cg_statements,
)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "contract_check.py"
MUT = ROOT / "scripts" / "_scope_gate_mutant.py"

# The empty value each return annotation promises. A finder that matched nothing would
# return exactly this — so injecting it IS the failure mode, not an approximation of it.
EMPTY: dict[str, str] = {
    "set[str]": "set()",
    "list[str]": "[]",
    "dict[str, str]": "{}",
    "dict[str, int]": "{}",
    "dict[str, list[str]]": "{}",
    "dict[str, set[str]]": "{}",
    "dict[Path, set[str]]": "{}",
    "list[tuple[Path, int, int]]": "[]",
    "list[tuple[Path, int, str, int]]": "[]",
    "list[tuple[Path, int, str, int, str]]": "[]",
    "tuple[list[str], set[tuple[Path, int]]]": "([], set())",
    "tuple[list[str], list[tuple[Path, int, int, str]]]": "([], [])",
    "tuple[list[str], int]": "([], 0)",
    "tuple[list[str], list[tuple[Path, int, int, str]], int]": "([], [], 0)",
}

# 🔴 THIS GATE DERIVES ITS OWN SCOPE, WHICH IS THE EXACT THING IT EXISTS TO DISTRUST.
# If `EMPTY` fell out of step with the annotations — a signature changed, a new shape
# added — the target list would shrink and every remaining target would still pass, so
# this file would report success over enumerators it had stopped testing. That is
# taut169, one level up again. The floor is a literal, and it is `>=` because the file
# is supposed to grow. 172 measured 25.
TARGET_FLOOR = 25


def targets(text: str) -> list[tuple[str, str, int]]:
    """(name, empty-literal, byte offset of the body) for every blindable enumerator."""
    found: list[tuple[str, str, int]] = []
    for m in re.finditer(r"^def (\w+)\([^)]*\)\s*->\s*(.+?):\s*$", text, re.M):
        name, ret = m.group(1), m.group(2).strip().strip('"')
        if name.startswith("_") and name != "_tracked_modes":
            continue
        empty = EMPTY.get(ret)
        if empty is None and ret.endswith("| None"):
            empty = "{}" if "dict" in ret else "[]"
        if empty is not None:
            found.append((name, empty, m.end()))
    return found


# 🔴 THE LINE contract_check.py PRINTS ONLY IF IT GOT AS FAR AS REPORTING (181).
# See `run()` below for why a returncode is not enough.
REPORT_MARKER = "=== breakpoint-mcp static contract check ==="


# 🔴 188 §5 — THE OUTPUT THIS GATE WAS ALREADY PAYING FOR AND THREW AWAY.
#
# `control_gate.py` printed, on every green run, "…23 of those are covered by
# scope_gate.py's blinded runs (186 §7, STATED, NOT RE-DERIVED HERE)". Both halves of
# that sentence were a problem. 186 measured 23 statements executed by ANYTHING, using a
# recording shim; the comment restated it as 23 covered by THIS gate, and a handoff
# subtracted it to size the remaining work. Re-derived here, against the twenty-five
# mutants below: NINETEEN. The residue was 34, not ~30.
#
# The measurement costs nothing. This gate already runs each mutant as a subprocess and
# already has its stdout in hand — it simply discarded it and kept the exit code. 184's
# rule was "a number an instrument prints and no gate reads is an unasked question"; this
# is one turn further down, an OUTPUT an instrument produces and no gate reads at all.
STATEMENT_ATTRIB_FLOOR = 20    # governed by floor_pin_gate SIZE_LEDGER (§9.3)


# ── 🔴 197 §4 — THE BLAST RADIUS, AND THE CLAIM THIS FILE'S DOCSTRING MAKES ────────
#
# 196 §3 found `control_gate.py` computing a FAIL-line count, printing it inside an `ok`
# line, and comparing it to nothing since 187. 196 §8.3 handed over the observation that
# the defect was a property of a CLASS of instrument and that this file is another member.
# Measured here, over the 25 blinded runs:
#
#     53 FAIL lines across 25 rows · 8 rows redden MORE THAN ONE check
#     🔴 3 of the 25 reddened NO SCOPE-LEDGER POPULATION AT ALL
#
# 🔴 AND THE THIRD LINE IS WORSE THAN THE SILENCE, BECAUSE OF WHAT THIS FILE CLAIMS.
# The docstring above says the scope ledger closed these enumerators with literal floors
# and that THIS FILE IS WHAT KEEPS THEM CLOSED. `doc_recipe_mentions`,
# `recipe_names_constant` and `privileged_tools` had no ledger entry: two went red on a
# `Could not parse X from Y` guard and one on check 12's roster comparison. Delete the
# whole ledger and this gate stayed green over those three. A subject caught by something
# other than the gate is not covered by it — it is being lucky near it. 197 added the three
# missing ledger entries, and the roster below is what stops the class coming back.
#
# 🔴 THE VERDICT HERE RESTS ON TWO EXACT READERS, NOT ON A FUZZY ONE. control_gate had to
# keep its attribution as diagnosis because literal-matching resolves 98 of 103 lines. This
# gate needs no such hedge: `FAIL: SCOPE COLLAPSE <population>:` names its population in the
# text, so "did the population this row feeds collapse" is answered exactly, for every row.
LEDGER: dict[str, tuple[str, ...]] = {
    "_tracked_modes": ("modes.shebangs_confirmed",),
    "all_false_annotation_claims": ("families.allfalse_lines",),
    "annotated_tools": ("annotations.roster",),
    "annotation_class_claims": ("families.annclass_lines",),
    "catalog_index_tools": ("catalog.index_tools",),
    "catalog_json_blocks": ("catalog.json_blocks",),
    "dispatch_methods": ("gdscript.editor_methods", "gdscript.runtime_methods"),
    "doc_recipe_mentions": ("recipes.doc_mentions",),                 # 🆕 197
    "doc_resource_claims": ("resources.doc_claims",),
    "exempt_family_lines": ("families.exempt_lines",),
    "host_bridge_calls": ("host.bridge_calls",),
    "input_schema_shapes": ("shapes.inputs_compared", "shapes.inputs_parsed"),
    "output_schema_shapes": ("shapes.outputs_compared", "shapes.outputs_parsed"),
    "prefix_family_claims": ("families.prefix_glob_lines",),
    "privileged_tools": ("tools.privileged",),                        # 🆕 197
    "recipe_names_constant": ("recipes.names_constant",),             # 🆕 197
    "registered_recipes": ("recipes.registered",),
    "registered_resources": ("resources.registered",),
    "registered_tools": ("tools.registered",),
    "test_count_constants": ("counts.test_constants",),
    "tool_count_claims": ("counts.tool_claims",),
    "toolset_aliases": ("families.toolset_aliases",),
    "toolset_claims": ("families.toolset_claims_resolved",),
    "toolset_sizes": ("families.toolset_claims_resolved", "families.toolset_sizes"),
    "uncaptured_tool_registrations": ("tools.registration_sites_scanned",),
}

# id -> the exact number of `FAIL:` lines that blind produces. Measured, not guessed.
BLAST: dict[str, int] = {
    "_tracked_modes": 4,                      # also: check 15
    "all_false_annotation_claims": 1,
    "annotated_tools": 2,                     # also: check 9
    "annotation_class_claims": 1,
    "catalog_index_tools": 2,                 # also: check 4
    "catalog_json_blocks": 1,
    "dispatch_methods": 3,                    # also: check 1
    "doc_recipe_mentions": 2,                 # also: check 12
    "doc_resource_claims": 2,                 # also: check 10
    "exempt_family_lines": 1,
    "host_bridge_calls": 1,
    "input_schema_shapes": 2,
    "output_schema_shapes": 2,
    "prefix_family_claims": 1,
    "privileged_tools": 3,                    # also: check 11 (the tool-count drift line)
    "recipe_names_constant": 2,               # also: check 12
    "registered_recipes": 4,                  # also: check 12
    "registered_resources": 3,                # also: check 10
    "registered_tools": 9,                    # also: checks 6 8 9 11 13
    "test_count_constants": 1,
    "tool_count_claims": 1,
    "toolset_aliases": 1,
    "toolset_claims": 1,
    "toolset_sizes": 2,
    "uncaptured_tool_registrations": 1,
}

SCOPE_BLAST_TOTAL_FLOOR = 45          # measured ABOVE this. Floored from BELOW for control_gate's reason:
                                # the per-row equalities above get edited one row at a time,
                                # and this is what notices the sweep going quieter overall
LEDGER_COLLAPSE_FLOOR = 24      # measured ABOVE this, across every row. The
                                # per-row assertion is the gate; this is the aggregate that
                                # notices the ledger being trimmed row by row to match

COLLAPSE_RE = re.compile(r"^FAIL: SCOPE COLLAPSE ([\w.]+):", re.M)


def collapsed_populations(out: str) -> set[str]:
    """Every SCOPE-LEDGER population that reported a collapse in this run.

    🔴 EXACT, NOT HEURISTIC. The population's name is in the text check 20 prints, so
    there is nothing here to be 95% right about (196 §4's hedge, not needed here).
    """
    return set(COLLAPSE_RE.findall(out))


def roster_problems(names: list[str], blast: dict, ledger: dict) -> list[str]:
    """A target with no declaration, and a declaration with no target — both halves (182).

    🔴 LIFTED OUT AND FIXTURE-FED (195 §8.4). On a healthy tree this returns [], so an
    inline version deletes invisibly.
    """
    problems = []
    for name in names:
        if name not in blast:
            problems.append(
                f"{name} has no BLAST entry — a blind whose radius nothing is watching, which "
                f"is how three rows stopped reddening the ledger without anyone noticing (197 §4)"
            )
        if name not in ledger:
            problems.append(
                f"{name} has no LEDGER entry — nothing says which population this blind is "
                f"supposed to collapse, so ANY red run reads as proof the ledger caught it"
            )
    for name in blast:
        if name not in names:
            problems.append(f"BLAST names {name!r}, which is not a target — a stale entry "
                            f"makes the roster look complete over a row that no longer exists")
    for name in ledger:
        if name not in names:
            problems.append(f"LEDGER names {name!r}, which is not a target")
    return problems


def run(source: str) -> tuple[bool, bool, str]:
    """(green, executed, output). The mutant is removed whatever happens.

    🔴 `executed` EXISTS BECAUSE `green=False` HAD TWO CAUSES AND ONE OBSERVABLE (181).

    Until this session `run` returned `p.returncode == 0 and "ALL HARD CHECKS PASSED"`,
    and every caller read a False as "the contract check CAUGHT the mutant". But a
    mutant that does not COMPILE also exits non-zero — Python exits 1 on a SyntaxError,
    exactly as `contract_check.py` exits 1 on a violation. So "caught" and "never ran"
    were the same observable, and this gate reported the first when it meant the second.

    Measured, by breaking the injected text so that EVERY mutant was uncompilable:

        SCOPE_GATE_CONTROL ok — an unmutated copy passes, so a caught mutant means something
        SCOPE_GATE_BLIND_COUNT 0 of 25
        SCOPE_GATE ok — every derived population collapses LOUDLY        exit 0

    Twenty-five targets, zero escapes, a green verdict, and not one `contract_check` had
    executed. The CONTROL below did not see it: it covers the UNMUTATED path, and the
    defect is on the mutated one — 179 §11.25's rule (a gate enforces its rules where
    they were WRITTEN, not where its population comes from) pointed at a harness.

    `REPORT_MARKER` is the discriminator, and it was measured before being relied on:
    all 25 genuine catches print it (`MARKER_ABSENT_ON_A_REAL_CATCH 0 of 25`), because
    `contract_check.py` prints its report and THEN exits 1. So a run that goes red
    WITHOUT the marker did not reach the report, and that is a harness failure rather
    than a catch.
    """
    MUT.write_text(source)
    try:
        p = subprocess.run(
            [sys.executable, str(MUT)], capture_output=True, text=True, cwd=str(ROOT)
        )
    finally:
        MUT.unlink(missing_ok=True)
    green = p.returncode == 0 and "ALL HARD CHECKS PASSED" in (p.stdout + p.stderr)
    return green, REPORT_MARKER in p.stdout, p.stdout + p.stderr


def gate_failed(targets_low: bool, blind: int, never_ran: int,
                attrib_low: bool = False, roster: int = 0, blast_drift: int = 0,
                ledger_miss: int = 0, blast_low: bool = False,
                collapse_low: bool = False) -> bool:
    """This gate's verdict, as a PURE function of its three populations.

    🔴 EXTRACTED FOR `combineFailed`'s REASON, ONE FILE OVER (180 §7.1, and 174 §8 / 176's
    G3 before it — the same defect four sessions running). `never_ran` arrived this
    session as a third way for the run to be untrustworthy, and inline it would have been
    one more `if x: failed = True`, which is a wire a mutant deletes with the verdict
    intact and the run still green. On a healthy tree all three inputs are already
    falsey, so the new term is never satisfied apart from the others and its deletion is
    invisible to every live run. Lifted out, the truth table below can assert it.

    🔴 197 ADDED FIVE MORE TERMS FOR THE SAME REASON. Every one of them is falsey on a
    healthy tree, so every one of them deletes invisibly unless the table below asserts it
    reaches this exit code ALONE.
    """
    return (targets_low or bool(blind) or bool(never_ran) or attrib_low
            or bool(roster) or bool(blast_drift) or bool(ledger_miss)
            or blast_low or collapse_low)


def _self_check() -> list[str]:
    """Run BEFORE the sweep. Each population must reach the verdict ALONE — 173's G3 and
    176's rule about two conditions that are never satisfied apart."""
    problems = []
    if gate_failed(False, 0, 0):
        problems.append("gate_failed reports a failure over three healthy populations")
    if STATEMENT_ATTRIB_FLOOR <= 0:
        problems.append(
            f"STATEMENT_ATTRIB_FLOOR is {STATEMENT_ATTRIB_FLOOR}. A floor at zero cannot bite, "
            f"and this is the only place the attribution is pinned."
        )
    for floor_name, floor in (("SCOPE_BLAST_TOTAL_FLOOR", SCOPE_BLAST_TOTAL_FLOOR),
                              ("LEDGER_COLLAPSE_FLOOR", LEDGER_COLLAPSE_FLOOR)):
        if floor <= 0:
            problems.append(
                f"{floor_name} is {floor}. A floor at zero cannot bite, and it is the only "
                f"thing watching the per-row equalities being edited one row at a time."
            )
    for label, args in (("targets_low", (True, 0, 0)), ("blind", (False, 1, 0)),
                        ("never_ran", (False, 0, 1)), ("attrib_low", (False, 0, 0, True)),
                        ("roster", (False, 0, 0, False, 1)),
                        ("blast_drift", (False, 0, 0, False, 0, 1)),
                        ("ledger_miss", (False, 0, 0, False, 0, 0, 1)),
                        ("blast_low", (False, 0, 0, False, 0, 0, 0, True)),
                        ("collapse_low", (False, 0, 0, False, 0, 0, 0, False, True))):
        if not gate_failed(*args):
            problems.append(
                f"gate_failed does not fail on {label} ALONE — that population cannot reach "
                f"the exit code by itself, so the branch that feeds it deletes invisibly"
            )

    # 🔴 THE 197 DETECTORS, FIXTURE-FED (195 §8.4's shape, applied on the way in). On a
    # healthy tree both return empty, so an inline version deletes invisibly — the class
    # 188's sweep proved live in control_gate three branches at a time.
    if roster_problems(["a"], {"a": 1}, {"a": ("p",)}):
        problems.append("roster_problems flags a complete roster")
    if not roster_problems(["a"], {}, {"a": ("p",)}):
        problems.append(
            "roster_problems does NOT flag a target with no BLAST entry — a blind whose "
            "radius nothing declares is exactly what 197 §4 found three of"
        )
    if not roster_problems(["a"], {"a": 1}, {}):
        problems.append(
            "roster_problems does NOT flag a target with no LEDGER entry — without one, "
            "ANY red run reads as proof the ledger caught the blind"
        )
    if not roster_problems([], {"gone": 1}, {"gone": ("p",)}):
        problems.append(
            "roster_problems does NOT flag a declaration with no target — a stale entry "
            "makes the roster look complete over a row that no longer exists"
        )
    if collapsed_populations("FAIL: SCOPE COLLAPSE families.exempt_lines: 0 < floor 1"
                            ) != {"families.exempt_lines"}:
        problems.append("collapsed_populations does not read a live SCOPE COLLAPSE line")
    if collapsed_populations("FAIL: something else entirely"):
        problems.append(
            "collapsed_populations reads a population out of a line that names none — the "
            "per-row ledger assertion would then pass on any red run at all"
        )
    return problems


def main() -> int:
    text = SRC.read_text()
    found = targets(text)
    print(f"SCOPE_GATE targets={len(found)} floor={TARGET_FLOOR}")

    for problem in _self_check():
        print(f"🔴 SCOPE_GATE_SELFCHECK {problem}")
    if _self_check():
        return 1

    targets_low = len(found) < TARGET_FLOOR
    if targets_low:
        print(
            f"🔴 SCOPE_GATE_TARGETS_COLLAPSE {len(found)} < {TARGET_FLOOR} — this gate's own\n"
            f"   scope shrank. Either an enumerator was deleted (lower the literal on purpose),\n"
            f"   or a return annotation changed shape and EMPTY no longer knows it, in which\n"
            f"   case every check below passes over a target it has stopped testing."
        )

    # CONTROL. An unmutated copy MUST pass, or every 'caught' below is meaningless —
    # 171 §5's M4, which is the only reason the green mutants there could be believed.
    control_green, control_ran, control_out = run(text)
    if not control_green:
        print("🔴 SCOPE_GATE_CONTROL an UNMUTATED copy does not pass — the harness is lying, stop.")
        return 1
    if not control_ran:
        print(f"🔴 SCOPE_GATE_MARKER the unmutated copy passed WITHOUT printing {REPORT_MARKER!r}.\n"
              "   The discriminator every judgement below rests on no longer identifies a run that\n"
              "   executed. Fix REPORT_MARKER before believing a single line of this gate.")
        return 1
    print("SCOPE_GATE_CONTROL ok — an unmutated copy passes AND prints the report marker,\n"
          "                       so both 'caught' and 'never ran' are distinguishable below")

    # The attribution table, built once. A statement counts as reached by this gate when
    # its own longest UNIQUE literal appears in a mutant's output — the same evidence
    # control_gate.py accepts from its hand-written fingerprints, applied to all of them.
    # Statements carrying no literal are absent from the table by construction and are
    # counted separately there (CONTROL_GATE_UNFINGERPRINTABLE), never silently dropped.
    stmts = cg_statements(text)
    fps = cg_auto_fingerprints(stmts)
    reached: set[int] = set()

    blind: list[str] = []
    never_ran: list[str] = []
    # 🔴 197 §4. The roster halves FIRST — a sweep over a roster with a hole in it would
    # print 24 clean rows and say nothing about the twenty-fifth.
    roster = roster_problems([n for n, _e, _p in found], BLAST, LEDGER)
    for problem in roster:
        print(f"🔴 SCOPE_GATE_ROSTER {problem}")

    blast_drift: list[str] = []
    ledger_miss: list[str] = []
    blast_total = 0
    collapses = 0
    for name, empty, pos in sorted(found):
        mutant = text[:pos] + f"\n    return {empty}  # SCOPE_GATE" + text[pos:]
        green, executed, out = run(mutant)
        reached.update(ln for ln, fp in fps.items() if fp in out)
        fails = out.count("\nFAIL: ") + int(out.startswith("FAIL: "))
        pops = collapsed_populations(out)
        declared = BLAST.get(name)
        want = set(LEDGER.get(name, ()))
        blast_total += fails
        collapses += len(pops & want)
        if green:
            blind.append(name)
            print(f"🔴 SCOPE_GATE_BLIND {name} -> {empty}: the run is STILL GREEN")
        elif not executed:
            never_ran.append(name)
            print(f"🔴 SCOPE_GATE_NEVER_RAN {name} -> {empty}: red, but the copy never reached the report")
        else:
            missing = want - pops
            if declared is not None and fails != declared:
                blast_drift.append(name)
                print(f"🔴 SCOPE_GATE_BLAST {name}: declared {declared} FAIL line(s), observed "
                      f"{fails}. The blind's radius moved. If a check was ADDED this row now "
                      f"reddens it too and nobody was told — 196 §3, which is the whole reason "
                      f"this number is compared. Update the BLAST entry ON PURPOSE, in the "
                      f"commit that moved it. Populations that collapsed: {sorted(pops) or '-'}")
            if missing:
                ledger_miss.append(name)
                print(f"🔴 SCOPE_GATE_LEDGER {name}: the run went red, but the SCOPE-LEDGER "
                      f"population(s) this blind is supposed to collapse did NOT: "
                      f"{sorted(missing)}. Something ELSE caught it — a parse guard, a count "
                      f"drift — and the ledger floor this row exists to defend is unprotected. "
                      f"Collapsed instead: {sorted(pops) or 'nothing at all'}")
            if not missing and (declared is None or fails == declared):
                print(f"  ok   {name:<34} -> {empty:<14} red · {fails} FAIL line(s), declared "
                      f"{declared} · collapsed {' '.join(sorted(want))}")

    print(f"SCOPE_GATE_BLIND_COUNT {len(blind)} of {len(found)} · never-ran {len(never_ran)}")
    attrib_low = len(reached) < STATEMENT_ATTRIB_FLOOR
    print(f"SCOPE_GATE_STATEMENTS {len(reached)}/{STATEMENT_ATTRIB_FLOOR} of {len(stmts)} failure "
          f"statement(s) in contract_check.py are\n"
          f"                      EXECUTED by these blinded runs — derived from their output, not "
          f"stated (188 §5)")
    if attrib_low:
        print(
            f"🔴 SCOPE_GATE_ATTRIB_COLLAPSE {len(reached)} < {STATEMENT_ATTRIB_FLOOR} — these mutants\n"
            "   reach fewer of contract_check.py's failure statements than when this floor was\n"
            "   measured. Every 'ok' above can still print while the runs redden for a shallower\n"
            "   reason than before, so this is the half the exit code cannot see. Lower it ON\n"
            "   PURPOSE if an enumerator was retired; otherwise a check stopped reporting."
        )
    if never_ran:
        print(
            f"\n🔴 {len(never_ran)} mutant(s) exited non-zero WITHOUT executing a single check, and\n"
            "   before 181 every one of them was counted as CAUGHT. A SyntaxError and a violation\n"
            "   are both `returncode != 0`; the injection landing badly, a changed def signature,\n"
            "   or an import that moved all produce this. Every 'ok' line above is only worth what\n"
            "   this list costs — fix the injection, do not lower the floor."
        )
    if blind:
        print(
            "\n🔴 The enumerator(s) above can match NOTHING AT ALL and contract_check.py still\n"
            "   prints ALL HARD CHECKS PASSED. 'Found no problems' and 'did not look' are the\n"
            "   same observable, which is the whole class 171 named: an instrument's silence is\n"
            "   a measurement of the instrument, not of the thing. Add the population it derives\n"
            "   to the SCOPE_LEDGER in contract_check.py with a LITERAL floor and the consequence\n"
            "   of its collapse — never a floor derived from the same finder (check 16 did that,\n"
            "   and `len(x) >= len(x)` is why it was on this list)."
        )
    # ── 🔴 197 §4. THE BLAST RADIUS AND THE LEDGER CLAIM, IN AGGREGATE ──────────────
    # Two numbers, not one (194 §33): `blast_total` is what the blinds DO, and
    # `collapses` is how much of that lands on the ledger this file exists to defend.
    # Both are floored from below; the per-row assertions above are the gate.
    blast_low = blast_total < SCOPE_BLAST_TOTAL_FLOOR
    collapse_low = collapses < LEDGER_COLLAPSE_FLOOR
    print(f"SCOPE_GATE_BLAST {blast_total}/{SCOPE_BLAST_TOTAL_FLOOR} FAIL line(s) across "
          f"{len(found)} blind(s), every row's count DECLARED and compared")
    print(f"SCOPE_GATE_LEDGER {collapses}/{LEDGER_COLLAPSE_FLOOR} scope-ledger population "
          f"collapse(s) — every blind reddens the LEDGER,\n"
          f"                  not merely the run (197 §4: three rows did not, and the "
          f"ledger had no entry for them)")
    if blast_low:
        print(f"🔴 SCOPE_GATE_BLAST_LOW {blast_total} < {SCOPE_BLAST_TOTAL_FLOOR} — the blinds\n"
              "   redden less than they did when this floor was measured. Each row's own\n"
              "   equality is edited one row at a time; this is what notices the sweep\n"
              "   getting quieter overall.")
    if collapse_low:
        print(f"🔴 SCOPE_GATE_LEDGER_LOW {collapses} < {LEDGER_COLLAPSE_FLOOR} — fewer\n"
              "   ledger populations collapse than when this was measured, so more of what\n"
              "   this gate reports as caught is being caught by something that is not the\n"
              "   ledger. That is the state 197 §4 found and closed; do not re-enter it by\n"
              "   lowering this number.")

    # 🔴 ONE VERDICT, THROUGH THE FUNCTION THE SELF-CHECK PROVED (see gate_failed above).
    if gate_failed(targets_low, len(blind), len(never_ran), attrib_low, len(roster),
                   len(blast_drift), len(ledger_miss), blast_low, collapse_low):
        print("\nSCOPE_GATE 🔴 FAILED")
        return 1
    # 🔴 THE VERDICT NAMES WHAT IT ACTUALLY VERIFIED (174 §5). The old wording —
    # "every derived population collapses LOUDLY" — was the line printed over 25 mutants
    # that never ran, and it is the only line a reader of a green CI log ever sees.
    print(f"\nSCOPE_GATE ok — all {len(found)} enumerator(s) blinded, each EXECUTED a "
          f"contract check, each went red,\n"
          f"                each reddened the exact number of FAIL lines it declares, and each "
          f"collapsed the\n"
          f"                SCOPE-LEDGER population it names — so the LEDGER is what caught it "
          f"(197 §4)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
