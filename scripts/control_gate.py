#!/usr/bin/env python3
"""control_gate.py — session 187. THE POSITIVE CONTROL, WHICH IS THE ONLY THING THAT CAN
COVER A STATEMENT THAT RUNS ONLY WHEN THE TREE IS BROKEN.

182 §11.3 asked what `CHECKS_RUN 20/20` actually proves. 186 answered it, and the answer
is the reason this file exists:

    70 errors.append/extend statement(s) in contract_check.py
    EXECUTED BY SOMETHING: 23 of 70      NEVER EXECUTED BY ANYTHING: 47

`CHECKS_RUN` counts BLOCKS that reach their own end. Two thirds of the statements inside
those blocks had never run, and FIVE WHOLE CHECKS — 17, 22, 3, 11c and `host` — had no
executed failure statement at all. A check whose every failure statement is unexecuted is
indistinguishable, from the outside, from a check that cannot fail.

🔴 THE COUNTER IS NOT THE FIX, AND THAT WAS MEASURED RATHER THAN ASSUMED. 185 proposed
"delete each `errors.append(...)` in turn and ask what notices", and 186 showed the sweep
is meaningless as written: every one of those statements is unreachable on a healthy tree,
so deleting any of them changes nothing and the answer is trivially 70 of 70. A
per-statement counter is the same mistake one level down — it would count statements that
exist, which is what the roster already does.

What covers a statement that only runs when the tree is broken is a POSITIVE CONTROL: a
mutation that makes exactly that statement fire, asserted to fire. `scope_gate.py` is
already that for 25 enumerators, and its 25 blinded runs are precisely where 186's 23
executed statements came from. THIS FILE IS THE SAME IDEA POINTED AT THE SUBJECT INSTEAD
OF THE FINDER: it breaks the tree the way each check says it is guarding against, and
requires the check to say so.

Each control below answers the handoff's question for one statement — *what one-line tree
edit should redden it?* — and 187 asked it of all seventeen statements in the five checks
at zero before writing a line of this file. 🔴 **ALL SEVENTEEN HAVE ONE.** The alternative
finding was live: a statement with no such edit is a statement that cannot fire, and the
handoff's instruction for that case was to DELETE it rather than count it. None qualified.

Three properties are asserted per control, and the second is the one 181 paid for:

  * the run goes RED                    — the check noticed
  * the run EXECUTED                    — it printed the report marker, so 'red' is a
                                          verdict and not a crash on the way in
  * the EXPECTED statement fired        — a fingerprint resolving, statically, to exactly
                                          ONE errors.append in the file

The third is what makes this a control rather than a smoke test. Without it, any mutation
that reddens the run for any reason at all would count as covering whatever statement the
table claims — the harness would be measuring itself.

🔴 IT MUTATES THE WORKING TREE AND RESTORES IN A `finally`, THEN ASSERTS BYTE-IDENTITY.
Do not run it concurrently with `scope_gate.py`, `instrument_gate.py` or the reverse
sweeps (178 §11.4).

Run: python3 scripts/control_gate.py   (a CI step beside the scope and floor-pin gates)
"""
from __future__ import annotations

import ast
import atexit
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CC = ROOT / "scripts" / "contract_check.py"
MUT = ROOT / "scripts" / "_control_gate_mutant.py"

# 🔴 THE LINE contract_check.py PRINTS ONLY IF IT GOT AS FAR AS REPORTING (181 §4, and
# scope_gate.py's REPORT_MARKER for the identical reason). A SyntaxError and a violation
# are both `returncode != 0`; without this discriminator "caught" and "never ran" are one
# observable, and this gate would report the first while meaning the second.
REPORT_MARKER = "=== breakpoint-mcp static contract check ==="

PROJ = "example/project.godot"
AUTOLOAD = 'BreakpointRuntimeBridge="*res://addons/breakpoint_mcp/runtime_bridge.gd"'

# ── the controls ──────────────────────────────────────────────────────────────────
#
# (id, check, kind, target, old, new, fingerprint)
#
#   kind "sub"    — substitute in a real tree file; restored, then byte-compared
#   kind "rename" — move a real path aside; restored, then existence-compared
#   kind "src"    — substitute in a COPY of contract_check.py, run as the mutant. The
#                   tree is NOT touched, because check 22's subject IS this file: its
#                   four statements are about the roster of blocks that ran, and the
#                   only edit that can fire them is an edit to the roster.
#
# 🔴 EVERY `old` IS ASSERTED TO OCCUR EXACTLY ONCE BEFORE IT IS APPLIED. An anchor that
# has stopped matching is 180 §9.3's trap and floor_pin_gate.py's FLOOR_PIN_ANCHOR one
# file over: the sweep reports a clean pass over a control it never applied.
CONTROLS: list[tuple[str, str, str, str, str, str, str]] = [
    # ── check 3 — tool-name uniqueness + net completeness ─────────────────────────
    ("3.dupe", "3", "sub", "host/src/tools/assetgen.ts",
     '"asset_gen_placeholder",', '"asset_gen_configure",',
     "Duplicate registerTool names:"),
    # The net's own completeness. A name the strict net misses is not under-reported, it
    # is ABSENT — invisible to checks 3, 4, 6 and 11 at once, with output byte-identical
    # to a clean run. A space is the cheapest name `[a-z0-9_]+` cannot match and the
    # permissive re-scan can.
    ("3.uncaptured", "3", "sub", "host/src/tools/assetgen.ts",
     '"asset_gen_placeholder",', '"asset gen placeholder",',
     "whose name the scanner cannot match"),

    # ── check 11c — the test suite's own size ─────────────────────────────────────
    # The vacuous-anchor case, and the only control here that is not a text edit: the
    # statement fires when NOTHING can be counted, so the subject has to go away. That
    # is exactly what its message asks — "has the suite moved?"
    ("11c.vacuous", "11c", "rename", "host/test", "", "",
     "Could not count any test declaration under host/test"),
    ("11c.drift", "11c", "sub", "README.md",
     "684-test suite", "685-test suite",
     "Host test-suite size drift"),

    # ── check host — the release ritual's five files ──────────────────────────────
    # `.version` absent is a FAILURE and not a skip, which is the whole point of that
    # branch; renaming the key is the lockfileVersion-1 shape without a fake lockfile.
    ("host.nofield", "host", "sub", "host/package-lock.json",
     '{\n  "name": "breakpoint-mcp",\n  "version":',
     '{\n  "name": "breakpoint-mcp",\n  "versionX":',
     "so check 14 cannot verify it"),
    ("host.drift", "host", "sub", "README.md",
     "> **npm 1.62.0 ·", "> **npm 1.61.0 ·",
     "Host version drift"),

    # ── check 17 — example/project.godot, the invariants an editor boot erases ────
    # Seven statements, seven controls, and the two that matter most are the ones a
    # local editor boot actually produces: the uid:// autoload rewrite (committed once,
    # session 148, and it cost CI 90 seconds to find) and the rendering method.
    ("17.missing", "17", "rename", PROJ, "", "",
     "example/project.godot is missing"),
    ("17.nokey", "17", "sub", PROJ,
     '\nrenderer/rendering_method="gl_compatibility"',
     '\n;renderer/rendering_method="gl_compatibility"',
     "no longer sets"),
    ("17.badvalue", "17", "sub", PROJ,
     '\nrenderer/rendering_method="gl_compatibility"',
     '\nrenderer/rendering_method="forward_plus"',
     "but CI requires"),
    ("17.noautoload", "17", "sub", PROJ, AUTOLOAD,
     "BreakpointRuntimeBridgeX=" + AUTOLOAD.split("=", 1)[1],
     "has no BreakpointRuntimeBridge autoload"),
    ("17.uid", "17", "sub", PROJ, AUTOLOAD,
     'BreakpointRuntimeBridge="*uid://dkyjj7tbsecr0"',
     "autoload is committed as"),
    ("17.notres", "17", "sub", PROJ, AUTOLOAD,
     'BreakpointRuntimeBridge="*addons/breakpoint_mcp/runtime_bridge.gd"',
     "which is neither a res:// path nor a uid"),
    ("17.absent", "17", "sub", PROJ, AUTOLOAD,
     'BreakpointRuntimeBridge="*res://addons/breakpoint_mcp/no_such_file.gd"',
     "which does not exist under example/"),

    # ── check 22 — every check reached its own end ────────────────────────────────
    # 🔴 THE COUNTER GETS THE CONTROLS IT WAS ASKING FOR. 22 is the block that exists to
    # notice a check going missing, and until this session not one of its four statements
    # had ever run. Its floor is moved DOWN rather than up, so that only the pin fires
    # and not the collapse branch beside it.
    ("22.floor", "22", "src", "", "CHECKS_RUN_FLOOR = 20", "CHECKS_RUN_FLOOR = 19",
     "The floor exists to notice a check going missing"),
    ("22.collapse", "22", "src", "", '\n_ran("13")\n', "\n",
     "CHECKS_RUN collapsed"),
    ("22.drift", "22", "src", "", '\n_ran("13")\n', '\n_ran("13")\n_ran("zz")\n',
     "CHECKS_RUN roster drift"),
    ("22.twice", "22", "src", "", '\n_ran("13")\n', '\n_ran("13")\n_ran("13")\n',
     "CHECKS_RUN counted a name twice"),
]

# ── the three floors ──────────────────────────────────────────────────────────────
#
# 🔴 CONTROLLED_FLOOR IS THE ONE THAT MATTERS AND IT IS FLOORED FROM BELOW, because the
# failure it names is this gate quietly covering less. Delete a row from CONTROLS and
# every remaining row still passes; the only thing that moves is a number nobody reads.
# 186 §6 paid this on the way in for a new coverage number and the handoff's own note is
# that the OLD one is still unfloored — so this one is floored on the way in too.
CONTROLLED_FLOOR = 17          # 187: seventeen statements, the five checks that were at zero

# 🔴 AND THE DENOMINATOR IS FLOORED TOO, WHICH IS THE HALF A COVERAGE RATIO ALWAYS MISSES.
# "17 of 70" improves to "17 of 17" by DELETING sixty-eight failure statements, and every
# assertion in this file would still hold. A ratio with only its numerator pinned is a
# number that gets better as the thing it measures gets smaller — 175's rule, stated as a
# floor instead of quoted.
STATEMENT_FLOOR = 70           # 186 measured 70; it is supposed to grow

# The roster of checks this gate closes, pinned by NAME and not just by count — 182's
# both-halves lesson: the set catches a check renamed or swapped, the floor catches the
# roster itself being trimmed to match a smaller reality.
CHECKS_CLOSED = ("3", "11c", "host", "17", "22")


def statements(src: str) -> list[tuple[int, str, str]]:
    """(lineno, check label, literal blob) for every `errors.append/extend` call.

    Parsed rather than grepped, for 186 §7's reason: three drafts of that measurement were
    wrong — 0 of 70, then eight unmatched frames, then 64 of 70 — because a bare
    `errors.append(` is the text of dozens of lines and `f_lineno` does not point at the
    opening one. An AST walk has nothing to be off by one about.

    The blob is every string CONSTANT under the call, which for an f-string is exactly the
    literal parts. A fingerprint is therefore matched against text the check can actually
    print, never against an interpolated value that varies with the tree.
    """
    lines = src.split("\n")
    headers: dict[int, str] = {}
    cur = "(prologue)"
    for i, line in enumerate(lines, 1):
        m = re.match(r"# --- (\S+?)[:\s]", line)
        if m:
            cur = m.group(1)
        headers[i] = cur

    out: list[tuple[int, str, str]] = []
    for node in ast.walk(ast.parse(src)):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr in ("append", "extend")
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id == "errors"):
            blob = " ".join(
                sub.value for sub in ast.walk(node)
                if isinstance(sub, ast.Constant) and isinstance(sub.value, str)
            )
            out.append((node.lineno, headers[node.lineno], blob))
    return sorted(out)


def gate_failed(unresolved: int, uncontrolled: int, controls_low: bool,
                statements_low: bool, roster_drift: bool, unrestored: int) -> bool:
    """This gate's verdict, as a PURE function of its six populations.

    🔴 EXTRACTED FOR `combineFailed`'s REASON (180 §7.1, 174 §8, and scope_gate.py's
    `gate_failed` beside it — the same defect five sessions running). On a healthy tree
    every one of these six is already falsey, so no term is ever satisfied APART from the
    others and deleting any single one is invisible to every live run. Lifted out, the
    truth table below can assert each one reaches the exit code alone.
    """
    return (bool(unresolved) or bool(uncontrolled) or controls_low
            or statements_low or roster_drift or bool(unrestored))


def _self_check() -> list[str]:
    """Run BEFORE the sweep. Each population must reach the verdict ALONE — 173's G3 and
    176's rule about two conditions that are never satisfied apart.

    🔴 AND THE FLOORS ARE ASSERTED POSITIVE HERE RATHER THAN SWEPT BY floor_pin_gate.py.
    That gate zeroes a floor and requires its runner to redden; its runner for these would
    be THIS file, which mutates the working tree — and nesting one tree-mutating gate
    inside another breaks 178 §11.4. So both floors are exempt there WITH THIS FUNCTION
    NAMED AS THE REASON, and what makes the exemption honest is that a zeroed floor fails
    the assertion below: `CONTROLLED_FLOOR = 0` would leave `controls_low` unable to bite
    and this gate green over an empty table.
    """
    problems: list[str] = []
    if gate_failed(0, 0, False, False, False, 0):
        problems.append("gate_failed reports a failure over six healthy populations")
    alone = (
        ("unresolved", (1, 0, False, False, False, 0)),
        ("uncontrolled", (0, 1, False, False, False, 0)),
        ("controls_low", (0, 0, True, False, False, 0)),
        ("statements_low", (0, 0, False, True, False, 0)),
        ("roster_drift", (0, 0, False, False, True, 0)),
        ("unrestored", (0, 0, False, False, False, 1)),
    )
    for label, args in alone:
        if not gate_failed(*args):
            problems.append(
                f"gate_failed does not fail on {label} ALONE — that population cannot reach "
                f"the exit code by itself, so the branch that feeds it deletes invisibly"
            )
    for name, value in (("CONTROLLED_FLOOR", CONTROLLED_FLOOR),
                        ("STATEMENT_FLOOR", STATEMENT_FLOOR)):
        if value <= 0:
            problems.append(
                f"{name} is {value}. A floor at zero cannot bite, and this file is the only "
                f"place either floor is pinned (see the note in DISCOVER_EXEMPT)"
            )
    if len(set(CHECKS_CLOSED)) != len(CHECKS_CLOSED):
        problems.append("CHECKS_CLOSED names a check twice — the roster cannot be compared")
    return problems


ORIGINALS: dict[Path, str] = {}
MOVED: dict[Path, Path] = {}


@atexit.register
def _restore() -> None:
    """The tree goes back whatever happens — a KeyboardInterrupt, an unhandled raise, or a
    control whose subprocess dies. Registered rather than left to the `finally` below
    because a `finally` does not run for the mutation applied when the interrupt lands."""
    for path, text in ORIGINALS.items():
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            path.write_text(text, encoding="utf-8")
    for original, moved in MOVED.items():
        if moved.exists() and not original.exists():
            shutil.move(str(moved), str(original))
    MUT.unlink(missing_ok=True)


def run(script: Path) -> tuple[bool, bool, str]:
    """(red, executed, output). See REPORT_MARKER above for why the second is not the
    first's complement."""
    p = subprocess.run([sys.executable, "-u", str(script)], cwd=str(ROOT),
                       capture_output=True, text=True, timeout=900)
    return p.returncode != 0, REPORT_MARKER in p.stdout, p.stdout + p.stderr


def main() -> int:
    src = CC.read_text(encoding="utf-8")
    stmts = statements(src)
    print(f"CONTROL_GATE controls={len(CONTROLS)} floor={CONTROLLED_FLOOR} "
          f"statements={len(stmts)} floor={STATEMENT_FLOOR}")

    for problem in _self_check():
        print(f"🔴 CONTROL_GATE_SELFCHECK {problem}")
    if _self_check():
        return 1

    controls_low = len(CONTROLS) < CONTROLLED_FLOOR
    if controls_low:
        print(f"🔴 CONTROL_GATE_CONTROLS_COLLAPSE {len(CONTROLS)} < {CONTROLLED_FLOOR} — a row was\n"
              f"   deleted from CONTROLS and every remaining row still passes. Lower the literal ON\n"
              f"   PURPOSE, in the same commit, or restore the control.")
    statements_low = len(stmts) < STATEMENT_FLOOR
    if statements_low:
        print(f"🔴 CONTROL_GATE_STATEMENTS_COLLAPSE {len(stmts)} < {STATEMENT_FLOOR} — contract_check.py\n"
              f"   carries fewer failure statements than when this floor was measured. Coverage here\n"
              f"   improves when the denominator shrinks, so a deleted check reads as progress.")

    # ── STATIC: does every fingerprint resolve to exactly ONE statement? ───────────
    # 🔴 THIS IS WHAT MAKES A CONTROL A CONTROL. Without it, any mutation that reddens the
    # run for any reason at all would be counted as covering whatever statement its row
    # claims, and the harness would be measuring itself. 186 §31's corollary, applied
    # before a number is printed rather than after one is doubted.
    unresolved: list[str] = []
    covered: dict[int, str] = {}
    for cid, check, _kind, _target, _old, _new, fp in CONTROLS:
        hits = [(ln, label) for ln, label, blob in stmts if fp in blob]
        if len(hits) != 1:
            unresolved.append(f"{cid}: fingerprint matches {len(hits)} statement(s), needs exactly 1")
            continue
        line, label = hits[0]
        if label != check:
            unresolved.append(f"{cid}: fingerprint lands in check {label!r}, the row declares {check!r}")
            continue
        if line in covered:
            unresolved.append(f"{cid}: contract_check.py:{line} is already covered by {covered[line]}")
            continue
        covered[line] = cid
    print(f"CONTROL_GATE_RESOLVED {len(covered)} of {len(CONTROLS)} fingerprint(s) name exactly one statement")
    for problem in unresolved:
        print(f"🔴 CONTROL_GATE_UNRESOLVED {problem}")
    if unresolved:
        print("   A fingerprint that no longer resolves means the message was reworded and this row\n"
              "   has stopped testing anything. Re-anchor it on the new text; do not delete the row.")

    closed = {c for _cid, c, *_ in CONTROLS}
    roster_drift = closed != set(CHECKS_CLOSED)
    if roster_drift:
        print(f"🔴 CONTROL_GATE_ROSTER controls cover {sorted(closed)}, CHECKS_CLOSED names "
              f"{sorted(CHECKS_CLOSED)}. Move both, on purpose.")

    # ── CONTROL: an unmutated run must be GREEN, print the marker, and be SILENT on
    # every fingerprint. The third is this file's own version of scope_gate's control:
    # a fingerprint a clean run already prints discriminates nothing.
    red, executed, out = run(CC)
    if red or not executed:
        print(f"🔴 CONTROL_GATE_CONTROL an unmutated run is red={red} executed={executed} — the tree is\n"
              "   not clean, so every verdict below would be meaningless. Stop.")
        return 1
    leaked = [c[0] for c in CONTROLS if c[6] in out]
    if leaked:
        print(f"🔴 CONTROL_GATE_LEAK {len(leaked)} fingerprint(s) already appear in a CLEAN run: {leaked}")
        return 1
    print(f"CONTROL_GATE_CONTROL ok — clean run green, report marker printed, and no fingerprint\n"
          f"                        appears in it, so 'fired' below means the mutation caused it")

    # ── SWEEP: apply each control, require red + executed + the expected statement ──
    uncontrolled: list[str] = []
    for cid, check, kind, target, old, new, fp in CONTROLS:
        if any(u.startswith(f"{cid}:") for u in unresolved):
            continue                      # already reported; running it would prove nothing
        path = ROOT / target if target else CC
        try:
            if kind == "sub":
                text = ORIGINALS.setdefault(path, path.read_text(encoding="utf-8"))
                n = text.count(old)
                if n != 1:
                    uncontrolled.append(f"{cid}: anchor occurs {n} time(s) in {target}, needs exactly 1")
                    print(f"🔴 CONTROL_GATE_ANCHOR {cid}: {n} occurrence(s) of the anchor in {target}")
                    continue
                path.write_text(text.replace(old, new), encoding="utf-8")
                red, executed, out = run(CC)
            elif kind == "rename":
                moved = path.with_name(path.name + ".control_gate_moved")
                MOVED[path] = moved
                shutil.move(str(path), str(moved))
                red, executed, out = run(CC)
            else:                          # "src" — the mutant copy, tree untouched
                n = src.count(old)
                if n != 1:
                    uncontrolled.append(f"{cid}: source anchor occurs {n} time(s), needs exactly 1")
                    print(f"🔴 CONTROL_GATE_ANCHOR {cid}: {n} occurrence(s) in contract_check.py")
                    continue
                MUT.write_text(src.replace(old, new))
                red, executed, out = run(MUT)
        finally:
            if path in ORIGINALS:
                path.write_text(ORIGINALS[path], encoding="utf-8")
            if path in MOVED:
                if MOVED[path].exists():
                    shutil.move(str(MOVED[path]), str(path))
                del MOVED[path]
            MUT.unlink(missing_ok=True)

        fired = fp in out
        fails = out.count("\nFAIL: ")
        if red and executed and fired:
            print(f"  ok   {cid:<15} check {check:<5} reddens, executes, fires its own statement "
                  f"({fails} FAIL line(s))")
            continue
        uncontrolled.append(f"{cid}: red={red} executed={executed} fired={fired}")
        if not red:
            print(f"🔴 CONTROL_GATE_GREEN {cid}: check {check} does NOT notice its own mutation. That\n"
                  f"   statement cannot fire, and a statement that cannot fire is a check that cannot\n"
                  f"   fail — delete it rather than count it (186 §10.2).")
        elif not executed:
            print(f"🔴 CONTROL_GATE_NEVER_RAN {cid}: red, but the run never reached the report. The\n"
                  f"   mutation broke the check on the way in; this row is measuring the harness.")
        else:
            print(f"🔴 CONTROL_GATE_WRONG_STATEMENT {cid}: red and executed, but check {check}'s own\n"
                  f"   statement never printed. Something ELSE caught the mutation — a control that\n"
                  f"   covers a statement it does not name covers nothing.")

    # ── RESTORE, ASSERTED. A sweep that leaves the tree changed has corrupted every ──
    # measurement after it, including the ones in the same CI run.
    unrestored = [str(p.relative_to(ROOT)) for p, t in ORIGINALS.items()
                  if not p.exists() or p.read_text(encoding="utf-8") != t]
    unrestored += [str(p.relative_to(ROOT)) for p in MOVED if not p.exists()]
    if MUT.exists():
        unrestored.append(str(MUT.relative_to(ROOT)))
    if unrestored:
        print(f"🔴 CONTROL_GATE_UNRESTORED {unrestored} — the tree does not match what this gate read.")

    controlled = len(covered) - len(uncontrolled)
    print(f"\nCONTROL_GATE_COVERED {controlled} of {len(stmts)} failure statement(s) have a positive\n"
          f"   control here · checks closed: {' '.join(sorted(CHECKS_CLOSED))}")
    # 🔴 NAMED, NOT DERIVED, AND SAID SO. `scope_gate.py`'s 25 blinded runs execute 23
    # further statements (186 §7, measured with a recording shim that is far too heavy for
    # a CI step). This gate does not re-derive that number and does not add it to the one
    # above — the blind spot is the rest, and printing it on GREEN runs is 186 §6's rule:
    # a coverage number that only appears when something is wrong is not a coverage number.
    print(f"CONTROL_GATE_BLIND {len(stmts) - controlled} statement(s) have no positive control in this\n"
          f"   file; 23 of those are covered by scope_gate.py's blinded runs (186 §7, stated, not\n"
          f"   re-derived here), which leaves ~{len(stmts) - controlled - 23} covered by nothing at all")

    if gate_failed(len(unresolved), len(uncontrolled), controls_low,
                   statements_low, roster_drift, len(unrestored)):
        print("\nCONTROL_GATE 🔴 FAILED")
        return 1
    # 🔴 THE VERDICT NAMES WHAT IT VERIFIED (174 §5). Not "every check can fail" — this
    # file has seventeen statements' worth of evidence and the rest of the file is
    # untested by it.
    print(f"\nCONTROL_GATE ok — all {len(CONTROLS)} control(s) applied, each reddened contract_check,\n"
          f"                  each reached the report, and each fired the one statement it names")
    return 0


if __name__ == "__main__":
    sys.exit(main())
