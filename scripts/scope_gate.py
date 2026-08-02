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


def run(source: str) -> bool:
    """True when the check runs GREEN. The mutant is removed whatever happens."""
    MUT.write_text(source)
    try:
        p = subprocess.run(
            [sys.executable, str(MUT)], capture_output=True, text=True, cwd=str(ROOT)
        )
    finally:
        MUT.unlink(missing_ok=True)
    return p.returncode == 0 and "ALL HARD CHECKS PASSED" in (p.stdout + p.stderr)


def main() -> int:
    text = SRC.read_text()
    found = targets(text)
    print(f"SCOPE_GATE targets={len(found)} floor={TARGET_FLOOR}")

    failed = False
    if len(found) < TARGET_FLOOR:
        print(
            f"🔴 SCOPE_GATE_TARGETS_COLLAPSE {len(found)} < {TARGET_FLOOR} — this gate's own\n"
            f"   scope shrank. Either an enumerator was deleted (lower the literal on purpose),\n"
            f"   or a return annotation changed shape and EMPTY no longer knows it, in which\n"
            f"   case every check below passes over a target it has stopped testing."
        )
        failed = True

    # CONTROL. An unmutated copy MUST pass, or every 'caught' below is meaningless —
    # 171 §5's M4, which is the only reason the green mutants there could be believed.
    if not run(text):
        print("🔴 SCOPE_GATE_CONTROL an UNMUTATED copy does not pass — the harness is lying, stop.")
        return 1
    print("SCOPE_GATE_CONTROL ok — an unmutated copy passes, so a caught mutant means something")

    blind: list[str] = []
    for name, empty, pos in sorted(found):
        mutant = text[:pos] + f"\n    return {empty}  # SCOPE_GATE" + text[pos:]
        if run(mutant):
            blind.append(name)
            print(f"🔴 SCOPE_GATE_BLIND {name} -> {empty}: the run is STILL GREEN")
        else:
            print(f"  ok   {name:<34} -> {empty:<14} blinded, run goes red")

    print(f"SCOPE_GATE_BLIND_COUNT {len(blind)} of {len(found)}")
    if blind:
        failed = True
        print(
            "\n🔴 The enumerator(s) above can match NOTHING AT ALL and contract_check.py still\n"
            "   prints ALL HARD CHECKS PASSED. 'Found no problems' and 'did not look' are the\n"
            "   same observable, which is the whole class 171 named: an instrument's silence is\n"
            "   a measurement of the instrument, not of the thing. Add the population it derives\n"
            "   to the SCOPE_LEDGER in contract_check.py with a LITERAL floor and the consequence\n"
            "   of its collapse — never a floor derived from the same finder (check 16 did that,\n"
            "   and `len(x) >= len(x)` is why it was on this list)."
        )
    if failed:
        print("\nSCOPE_GATE 🔴 FAILED")
        return 1
    print("\nSCOPE_GATE ok — every derived population collapses LOUDLY")
    return 0


if __name__ == "__main__":
    sys.exit(main())
