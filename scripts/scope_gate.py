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


def run(source: str) -> tuple[bool, bool]:
    """(green, executed). The mutant is removed whatever happens.

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
    return green, REPORT_MARKER in p.stdout


def gate_failed(targets_low: bool, blind: int, never_ran: int) -> bool:
    """This gate's verdict, as a PURE function of its three populations.

    🔴 EXTRACTED FOR `combineFailed`'s REASON, ONE FILE OVER (180 §7.1, and 174 §8 / 176's
    G3 before it — the same defect four sessions running). `never_ran` arrived this
    session as a third way for the run to be untrustworthy, and inline it would have been
    one more `if x: failed = True`, which is a wire a mutant deletes with the verdict
    intact and the run still green. On a healthy tree all three inputs are already
    falsey, so the new term is never satisfied apart from the others and its deletion is
    invisible to every live run. Lifted out, the truth table below can assert it.
    """
    return targets_low or bool(blind) or bool(never_ran)


def _self_check() -> list[str]:
    """Run BEFORE the sweep. Each population must reach the verdict ALONE — 173's G3 and
    176's rule about two conditions that are never satisfied apart."""
    problems = []
    if gate_failed(False, 0, 0):
        problems.append("gate_failed reports a failure over three healthy populations")
    for label, args in (("targets_low", (True, 0, 0)), ("blind", (False, 1, 0)),
                        ("never_ran", (False, 0, 1))):
        if not gate_failed(*args):
            problems.append(
                f"gate_failed does not fail on {label} ALONE — that population cannot reach "
                f"the exit code by itself, so the branch that feeds it deletes invisibly"
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
    control_green, control_ran = run(text)
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

    blind: list[str] = []
    never_ran: list[str] = []
    for name, empty, pos in sorted(found):
        mutant = text[:pos] + f"\n    return {empty}  # SCOPE_GATE" + text[pos:]
        green, executed = run(mutant)
        if green:
            blind.append(name)
            print(f"🔴 SCOPE_GATE_BLIND {name} -> {empty}: the run is STILL GREEN")
        elif not executed:
            never_ran.append(name)
            print(f"🔴 SCOPE_GATE_NEVER_RAN {name} -> {empty}: red, but the copy never reached the report")
        else:
            print(f"  ok   {name:<34} -> {empty:<14} blinded, run goes red")

    print(f"SCOPE_GATE_BLIND_COUNT {len(blind)} of {len(found)} · never-ran {len(never_ran)}")
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
    # 🔴 ONE VERDICT, THROUGH THE FUNCTION THE SELF-CHECK PROVED (see gate_failed above).
    if gate_failed(targets_low, len(blind), len(never_ran)):
        print("\nSCOPE_GATE 🔴 FAILED")
        return 1
    # 🔴 THE VERDICT NAMES WHAT IT ACTUALLY VERIFIED (174 §5). The old wording —
    # "every derived population collapses LOUDLY" — was the line printed over 25 mutants
    # that never ran, and it is the only line a reader of a green CI log ever sees.
    print(f"\nSCOPE_GATE ok — all {len(found)} enumerator(s) blinded, each EXECUTED a "
          f"contract check and each went red")
    return 0


if __name__ == "__main__":
    sys.exit(main())
