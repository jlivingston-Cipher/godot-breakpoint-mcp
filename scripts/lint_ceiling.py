#!/usr/bin/env python3
"""What a standard, off-the-shelf linter says about this repository.

🔴 229 §5.2 IS WHY THIS FILE EXISTS. `pyflakes` reports `dictionary key … repeated with
different values` on the shipped tree, and it has been able to for as long as it has
existed. Session 228 spent a session finding that defect by hand and 229 built a bespoke
reader for it. Eleven instruments in this tree, tens of thousands of words about coverage
and blast radius — and the thing that opened 229 was one `pip install` away the whole
time. 229's closing correction was: before building the instrument, check whether
somebody has already built it.

🔴 AND THE THING THIS GATE PINS IS NOT A COUNT. Measured on the live tree, `pyflakes`
reports SIX findings in TWO classes, and every one of them is cosmetic — five unnecessary
`f` prefixes and one local import the author already annotated `# noqa`. The defect that
motivated the whole item is fixed, so a ceiling on the TOTAL would be satisfied by a tree
that deleted one f-string and grew a duplicate key. **Six can be reached two ways**, which
is 229 §2's argument about `SCANNED_FLOOR` arriving in a fourth file: the healthy answer
for `duplicate key` is ZERO and the healthy answer for `unnecessary f-prefix` is five, and
summing them destroys the distinction the gate exists to make.

So the roster is by CLASS. A class not in `CLASS_CEILING` reddens on its first occurrence
whatever the total does; a class in it may not grow past what it was measured at; and a
class that drops to zero is a stale row, because an exemption that outlives the thing it
exempts is 174 §5 and this tree already refuses that shape twice.

🔴 A MISSING LINTER IS RED AND NOT A SKIP. `registry_lag.py` says why, in a comment about
a 42-session publish blocker: a reader that goes quiet when it cannot see is how a
standing decision gets written down in place of a command nobody re-ran. If `pyflakes` is
not installed, this gate refuses and says so.

WHAT THIS GATE IS NOT:
  * 🔴 NOT A CLEAN-UP. The six live findings are recorded at what they are. Driving them
    to zero is separate work this does not pretend to have done — 219's argument for
    `DEFECT_CEILING`, one language over.
  * NOT THE JS HALF. Measured in 230: `src/**/*.ts` and `test/**/*.ts` have been
    type-checked by `tsc --strict` all along, and `tsc` already refuses a duplicate object
    key (TS1117) — the standard tool was there first on that side. The 58 tracked `.mjs`
    files are outside every `tsconfig` include and are checked by no standard tool at all;
    a direct probe over all 180 tracked JS/TS files read 16,119 constant keys and found
    ZERO repeats, so that gap is a gap and not yet a defect. It is named in 230 NEXT.
"""

from __future__ import annotations

import importlib.util
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PY_FILE_FLOOR = 18      # governed by floor_pin_gate's SIZE_LEDGER
                        # 🆕 241: 17 -> 18, `scripts/p0_comments.py`. 🔴 THIS IS AN
                        # EQUALITY, NOT A FLOOR, and that is why it caught the new file
                        # instead of shrugging at it: a `>=` would have let an eighteenth
                        # tracked `.py` join the tree unlinted and said nothing. §4 of the
                        # P0 inventory is the same argument one plane over — these
                        # eighteen scripts are lint-governed and the 68 files of shipped
                        # TypeScript have no lint config at all — so the one population
                        # this tree DOES lint had better keep counting itself exactly.
                        # 🆕 240: 16 -> 17, `scripts/queue_gate.py`.

# 🔴 THE ROSTER IS THE GATE. Each row is a class `pyflakes` reports today, the number of
# occurrences it was measured at, and why that number is allowed to stand. A class absent
# from this table is a NEW KIND of finding and reddens on sight — which is the whole
# reason this is not a total.
CLASS_CEILING: dict[str, tuple[int, str]] = {
    "f-string is missing placeholders": (
        5,
        "An `f` prefix on a fragment that interpolates nothing. Every one of the five is "
        "an implicit-concatenation or `+` chain where a SIBLING fragment carries the "
        "value, so the message is correct and the prefix is redundant. Cosmetic, and "
        "recorded at what it is rather than fixed here.",
    ),
    "'X' imported but unused": (
        1,
        "`import builtins` inside `floor_pin_gate.py`'s patcher, already annotated "
        "`# noqa: F401` by its author — pyflakes does not read `noqa`, flake8 does. The "
        "row exists so the tool's disagreement with the author is written down once "
        "rather than re-argued every time somebody runs it.",
    ),
}


def tracked_py() -> list[str]:
    raw = subprocess.run(["git", "ls-files", "*.py"], capture_output=True, text=True, cwd=str(ROOT))
    return sorted(raw.stdout.split())


def classify(message: str) -> str:
    """A pyflakes message with its subject removed — the CLASS, not the instance.

    Quoted identifiers become `'X'` and bare integers become `N`, so `'builtins' imported
    but unused` and `'os' imported but unused` are one row rather than two. Nothing else
    is normalised: a class this cannot recognise must arrive as its own row and redden,
    which is the failure mode this file prefers.
    """
    return re.sub(r"\b\d+\b", "N", re.sub(r"'[^']*'", "'X'", message)).strip()


def pyflakes_absent() -> str | None:
    """The reason `pyflakes` cannot speak, or None if it can.

    🔴 235 §2 / 234 §4.6 — `python3 -m pyflakes` EXITS 1 WITH AN EMPTY STDOUT WHEN THE
    MODULE IS MISSING, and 1 is also how it reports findings. The shipped classifier read
    the return code alone, so an absent tool and a clean tree were the same observation:
    `0 finding(s)`, then `LINT_STALE_CLASS` on both declared rows, then three candidate
    causes — *the findings were fixed, the tool stopped reporting that class, or this
    reader stopped classifying it that way* — **and the actual cause was not among them.**
    It fails safe, so this was never about the verdict; it is about sending the next
    session to look for a defect in a roster that is correct.

    Reproduced this session and it is not hypothetical: 234's whole practice moved the
    gates into a fresh cloud container, and a fresh container has no `pyflakes`. The gate
    refused with the wrong reason on the FIRST run of the session that adopted the
    practice. 233 §18's rule, one gate over: a reason has to be checkable, and a cause
    list that omits the live cause is worse than no cause list.
    """
    if importlib.util.find_spec("pyflakes") is None:
        return (f"`pyflakes` is NOT INSTALLED for {sys.executable}. This is not a clean "
                f"tree and not a stale roster — the tool never ran. `pip install "
                f"pyflakes` (it is this gate's only dependency), then re-read the rows.")
    return None


def run_pyflakes(files: list[str]) -> tuple[list[tuple[str, str]], str | None]:
    """((file, message) …, error). `error` is not None when the TOOL could not speak."""
    if not files:
        return [], "nothing to lint — the file walk returned no tracked .py at all"
    if (why := pyflakes_absent()) is not None:
        return [], why
    try:
        p = subprocess.run([sys.executable, "-m", "pyflakes", *files],
                           capture_output=True, text=True, cwd=str(ROOT))
    except OSError as e:                                    # pragma: no cover
        return [], f"could not execute pyflakes: {e}"
    if p.returncode not in (0, 1):
        return [], (f"pyflakes exited {p.returncode} — {(p.stderr or '').strip()[:200]}")
    # 🔴 THE SECOND HALF, AND IT IS NOT REDUNDANT WITH THE PROBE ABOVE. `find_spec` finds
    # an importable module; it does not find a BROKEN one. A module that raises on import
    # exits 1 with an empty stdout and a traceback on stderr — the same observation as a
    # clean tree, arriving by a route the probe cannot see. Exit 1 means findings, and
    # findings go to stdout; exit 1 with nothing on stdout and something on stderr is the
    # tool failing to speak, whatever the reason.
    if p.returncode == 1 and not p.stdout.strip() and p.stderr.strip():
        return [], (f"pyflakes exited 1 with an empty stdout and this on stderr — the "
                    f"tool did not run, it did not report a clean tree:\n"
                    f"   {(p.stderr or '').strip()[:300]}")
    out: list[tuple[str, str]] = []
    for line in p.stdout.splitlines():
        m = re.match(r"^(.*?):\d+:\d+: (.*)$", line)
        if m:
            out.append((m.group(1), m.group(2)))
    return out, None


def problems(findings: list[tuple[str, str]], roster: dict[str, tuple[int, str]],
             files_read: int, floor: int) -> list[str]:
    """Four questions, kept apart on purpose.

    229 §5.3: folding two questions with different populations into one predicate made a
    self-check unable to ask either. `unknown class`, `over ceiling` and `stale row` have
    three different populations — the live findings, the roster's live rows, and the
    roster's dead ones — so each is asked over its own.
    """
    out: list[str] = []
    counts: dict[str, int] = {}
    for _f, msg in findings:
        counts[classify(msg)] = counts.get(classify(msg), 0) + 1

    for cls in sorted(counts):
        if cls in roster:
            continue
        where = ", ".join(sorted({f for f, m in findings if classify(m) == cls}))[:200]
        out.append(
            f"🔴 LINT_UNKNOWN_CLASS “{cls}” × {counts[cls]} — a kind of finding this "
            f"repository has never carried, in {where}. It is NOT covered by any ceiling "
            f"below, which is the point: a total would have absorbed it. Fix it, or add a "
            f"row to CLASS_CEILING saying what it is and why it stands.")

    for cls, (ceiling, _why) in roster.items():
        n = counts.get(cls, 0)
        if n > ceiling:
            where = ", ".join(sorted({f for f, m in findings if classify(m) == cls}))[:200]
            out.append(
                f"🔴 LINT_OVER_CEILING “{cls}” {n} > {ceiling} — this class grew since it "
                f"was measured, in {where}. The ceiling records what shipped, not what is "
                f"acceptable; raise it ON PURPOSE with a reason, or fix the new one.")
        elif n == 0:
            out.append(
                f"🔴 LINT_STALE_CLASS “{cls}” is declared at {ceiling} and pyflakes reports "
                f"NONE. Either the findings were fixed, or the tool stopped reporting that "
                f"class, or this reader stopped classifying it that way — and until one is "
                f"established the row is a ceiling over nothing, which is the shape 174 §5 "
                f"named and `MEASURED_CAUSE` already refuses one file over. Delete the row "
                f"if the work was done.")

    if files_read < floor:
        out.append(
            f"🔴 LINT_FILES_COLLAPSE {files_read} < {floor} — this gate linted fewer files "
            f"than when its floor was measured. Either .py files were deleted, or the walk "
            f"stopped reaching them, or `git ls-files` ran outside the repository — and a "
            f"linter with nothing to read reports a clean tree in exactly the same words "
            f"as a clean tree.")
    return out


def _selftest() -> int:
    print("LINT_CEILING selftest — the classifier and the four refusals, on fixtures")
    bad = 0

    for msg, want, why in [
        ("'builtins' imported but unused", "'X' imported but unused", "identifier normalised"),
        ("'os.path' imported but unused", "'X' imported but unused", "a different identifier is the SAME class"),
        ("f-string is missing placeholders", "f-string is missing placeholders", "no subject to strip"),
        ("dictionary key 'k' repeated with different values",
         "dictionary key 'X' repeated with different values",
         "🔴 229's OWN DEFECT — it must classify as its own row, not fold into another"),
        ("local variable 'x' defined in enclosing scope on line 12 referenced before assignment",
         "local variable 'X' defined in enclosing scope on line N referenced before assignment",
         "line numbers normalised too"),
    ]:
        got = classify(msg)
        ok = got == want
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {why:<66} -> {got}")

    R = {"f-string is missing placeholders": (5, "…"), "'X' imported but unused": (1, "…")}
    live = [("scripts/a.py", "f-string is missing placeholders")] * 5 + \
           [("scripts/b.py", "'builtins' imported but unused")]

    for findings, roster, n, floor, want, why in [
        (live, R, 14, 14, 0, "the LIVE shape is green"),
        (live + [("scripts/c.py", "dictionary key 'k' repeated with different values")],
         R, 14, 14, 1, "🔴 A DUPLICATE KEY REDDENS — the class is unknown"),
        # 🔴 THE ONE A TOTAL WOULD MISS, AND THE REASON THIS GATE IS NOT A TOTAL.
        # Six findings before, six after: one f-string fixed, one duplicate key grown.
        (live[:4] + [("scripts/c.py", "dictionary key 'k' repeated with different values")],
         R, 14, 14, 1, "🔴 SIX FINDINGS BEFORE AND AFTER — a count ceiling stays green"),
        (live + [("scripts/d.py", "f-string is missing placeholders")], R, 14, 14, 1,
         "a declared class growing by one refuses"),
        ([("scripts/b.py", "'builtins' imported but unused")], R, 14, 14, 1,
         "a declared class at ZERO is a stale row"),
        (live, R, 13, 14, 1, "the file walk below its floor refuses"),
        ([], {}, 14, 14, 0, "🔴 an EMPTY roster over an EMPTY tree must stay quiet — no ceiling invents a finding"),
    ]:
        got = len(problems(findings, roster, n, floor))
        ok = (got > 0) == (want > 0)
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {why:<66} -> {got} problem(s)")

    # 🔴 THE FLOOR, PINNED AGAINST THE LIVE TREE. `floor_pin_gate.py` moves
    # `PY_FILE_FLOOR` and demands this runner redden; the floor is read only as
    # `files_read < FLOOR`, so ZEROING IT MAKES THE GATE MORE PERMISSIVE and the live
    # run cannot notice. 225's rule: assert the literal here, from both sides.
    n_live = len(tracked_py())
    ok = PY_FILE_FLOOR == n_live
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'PY_FILE_FLOOR equals the live tracked .py count':<66} "
          f"floor={PY_FILE_FLOOR} live={n_live}")
    ok = bool(problems([], CLASS_CEILING, PY_FILE_FLOOR - 1, PY_FILE_FLOOR))
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'and one BELOW it refuses':<66} -> {ok}")

    # ── 🔴 235 §2 — AN ABSENT TOOL IS NOT A CLEAN TREE ────────────────────────────────
    #
    # The control is a module that certainly does not exist, run the way the real one is
    # run. It reproduces the absence exactly — exit 1, empty stdout, `No module named` on
    # stderr — which is the observation the shipped classifier could not tell from a tree
    # with nothing to report. Asserted on the RETURN of the reader rather than on a
    # message, because what went wrong was the return: `([], None)` says *clean*.
    p = subprocess.run([sys.executable, "-m", "pyflakes_absent_control_xyz",
                        "scripts/lint_ceiling.py"],
                       capture_output=True, text=True, cwd=str(ROOT))
    absent_shape = (p.returncode == 1 and not p.stdout.strip() and bool(p.stderr.strip()))
    bad += 0 if absent_shape else 1
    print(f"  {'🟢' if absent_shape else '🔴'} "
          f"{'a missing module exits 1 with an empty stdout — the shape of findings':<66} "
          f"rc={p.returncode}")

    # 🔴 AND THE MODULE THAT IS NOT THERE MUST BE NAMED. Only the negative direction is
    # asserted here, and the reason is this session's own subject arriving in its own
    # self-test: the first draft ALSO pinned `find_spec("pyflakes") is None == False` —
    # "the real module is importable here" — which is not a claim about this reader at
    # all. It is a claim about the machine. It passed on the container that had just
    # installed pyflakes and reddened `host tests` on CI, where that job does not, and
    # `FLOOR_PIN_CONTROL` reported the runner failing UNMUTATED. 235 §3's finding, in
    # 235's own fixture, four hours later.
    got = importlib.util.find_spec("pyflakes_absent_control_xyz") is None
    bad += 0 if got else 1
    print(f"  {'🟢' if got else '🔴'} "
          f"{'a module that is not there is reported absent':<66} -> absent={got}")

    # 🔴 THE LIVE HALF, AND IT IS THE ONE THAT WOULD HAVE FIRED IN 234's CONTAINER —
    # AGREEMENT, NOT INSTALLATION. `pyflakes_absent()` must say ABSENT exactly when the
    # interpreter cannot import it and stay quiet exactly when it can; that claim holds
    # on a machine with the module and on one without, which is what makes it a claim
    # about this reader. If it ever returns None on an interpreter without the module,
    # the gate is back where 234 found it.
    live_reason = pyflakes_absent()
    ok = (live_reason is None) == (importlib.util.find_spec("pyflakes") is not None)
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'pyflakes_absent() agrees with the interpreter':<66} "
          f"-> {'installed' if live_reason is None else 'ABSENT'}")

    print(f"LINT_CEILING selftest {'ok' if not bad else f'🔴 {bad} FAILED'}")
    return 1 if bad else 0


def main() -> int:
    if "--selftest" in sys.argv:
        return _selftest()

    files = tracked_py()
    findings, err = run_pyflakes(files)
    if err is not None:
        print(f"LINT_CEILING files={len(files)} floor={PY_FILE_FLOOR}")
        print(f"🔴 LINT_NO_TOOL — {err}\n"
              f"   This is RED and not a skip, on purpose, for `registry_lag.py`'s reason:\n"
              f"   a reader that goes quiet when it cannot see is how a standing decision\n"
              f"   gets written down in place of a command nobody re-ran. Install it with\n"
              f"   `pip install pyflakes` (it is the only dependency this gate has), or\n"
              f"   delete this gate on purpose. A tool that cannot run is not a clean tree.")
        return 1

    counts: dict[str, int] = {}
    for _f, msg in findings:
        counts[classify(msg)] = counts.get(classify(msg), 0) + 1

    print(f"LINT_CEILING pyflakes over {len(files)} tracked .py file(s) · floor "
          f"{PY_FILE_FLOOR} · {len(findings)} finding(s) in {len(counts)} class(es) · "
          f"{len(CLASS_CEILING)} declared")
    for cls in sorted(counts):
        ceiling = CLASS_CEILING.get(cls, (None, ""))[0]
        mark = "🟢" if ceiling is not None and counts[cls] <= ceiling else "🔴"
        print(f"  {mark} {counts[cls]:>3} / {ceiling if ceiling is not None else 'UNDECLARED'}"
              f"  {cls}")
    # 🔴 THE ROSTER'S OWN SILENT ROWS, PRINTED WHETHER OR NOT THEY REFUSE (217 §20): a
    # class nobody reports and a class nobody declared look identical in a green run.
    for cls in sorted(CLASS_CEILING):
        if cls not in counts:
            print(f"  🔴 {0:>3} / {CLASS_CEILING[cls][0]}  {cls}   (declared, none live)")

    bad = problems(findings, CLASS_CEILING, len(files), PY_FILE_FLOOR)
    if bad:
        for line in bad:
            print(line)
        print("🔴 LINT_CEILING refused. 229 §5.2: a defect a free off-the-shelf tool "
              "reports and eleven bespoke instruments miss is a question about the "
              "instruments' coverage, not about the defect.")
        return 1
    print(f"LINT_CEILING ok — every finding falls under a class declared with a reason, no "
          f"class grew past what it shipped at, no declared class is a ceiling over "
          f"nothing, and the walk reached {len(files)} file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
