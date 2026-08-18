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

🆕 242 — AND IT IS NOW THE JS HALF TOO, WHICH IS WHAT `lint-roster-py-only` ASKED FOR.
230 measured the gap and named it: `src/**/*.ts` and `test/**/*.ts` are type-checked by
`tsc --strict` on every push, and the tracked `.mjs` files are outside every `tsconfig`
include and read by no standard tool at all. 230 also priced the wiring — *"`--allowJs
--checkJs` over `host/scripts/*.mjs` measured 63 errors"* — and that number is the reason
this row sat for twelve sessions.

🔴 THE CARRIED 63 IS NOT WRONG, IT IS AN ANSWER TO A NARROWER QUESTION, AND THE AXIS
NOBODY DECLARED IS STRICTNESS. Re-measured in 242 against the same tool:

    host/scripts/*.mjs   non-strict      63   in 10 files   <- 230's number, reproduced
    host/scripts/*.mjs   strict         718   in 20 files
    ALL 64 tracked .mjs  non-strict   1,010   in 31 files   <- this gate's population
    ALL 64 tracked .mjs  strict       2,568   in 61 files

The population is 16x and the strictness is another 2.5x, and the two compound to 40x.
The queue row predicted the first multiplier and not the second. Both numbers are honest;
neither is the number; what was missing was the sentence saying which question was asked.

🔴 THIS HALF RUNS NON-STRICT, ON PURPOSE, AND THE REASON IS THE ONE THIS FILE ALREADY
GIVES FOR ROSTERING BY CLASS. `strict` over untyped JavaScript adds 1,558 findings and
sixteen classes, and every one of them is `noImplicitAny` reporting that a parameter has
no annotation — an ANNOTATION-DENSITY measure, not a defect measure. Summing it with
`TS2339` would destroy exactly the distinction §2 of this file exists to make, and a
ceiling that moves whenever anybody writes a new function parameter is a gate people route
around. The strict number is measured, printed above, and deliberately not rostered.
The declared population is `git ls-files '*.mjs'` and the check is `--allowJs --checkJs`.

🔴 AND THE CLOSURE IS REPORTED RATHER THAN HIDDEN. `tsc` follows imports, so pointing it
at 64 `.mjs` files also type-checks whatever they import — including `host/dist/*.js`,
the BUILT OUTPUT, which contributes 863 findings under `strict` and 4 without. Findings
outside the declared population are counted and printed and never rostered: a reader that
silently dropped them would be reporting on a population it had not named, which is
241's closing finding and the reason this row existed.

🔴 WHAT THE FIRST RUN FOUND, AND IT IS 229 §5.2 VERBATIM ONE LANGUAGE OVER:
  * `TS2305 globSync` × 2 — `p0_complexity.mjs` and `p0_testdup.mjs`, both shipped
    tracked in 241, import `globSync` from `node:fs`. It was exposed in Node **22.0.0**;
    `host/package.json` declares `engines.node ">=18"` and CI runs 18 · 20 · 22. An ESM
    named import of an export that does not exist fails at LINK time, so on two of three
    legs the module never loaded: reproduced on v20.19.0, `SyntaxError: The requested
    module 'node:fs' does not provide an export named 'globSync'`. Both files are in
    neither `ci.yml` nor the replay list, so nothing had ever run them below 22.
  * `TS2554` × 7 — `tautology_gate.selftest.mjs` passed a fixture name to two helpers
    that took one parameter and dropped it. 185 §19 swept that gate's SUBJECT for
    arguments that do not reach the assertion; the same defect was in its own two helpers.
Both are fixed at the same commit as this reader, so both classes are absent below.
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

HOST = ROOT / "host"

MJS_FILE_FLOOR = 65     # 🆕 242 — governed by floor_pin_gate's SIZE_LEDGER.
                        # 🔴 AN EQUALITY, LIKE `PY_FILE_FLOOR` ABOVE, AND THE ASYMMETRY
                        # WAS DRAFTED AND THEN REJECTED. The first version floored this
                        # from below only, on the argument that the `.mjs` population is
                        # probes and demo scripts and grows with ordinary work. That is
                        # true of the row above as well — and the session that raised THAT
                        # one wrote down that the equality is what caught the new file
                        # instead of shrugging at it. A number that reddens when its
                        # population changes is a number somebody re-reads.

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

# 🆕 242 — THE SAME TABLE, ONE LANGUAGE OVER. Keyed by `TS<code> <classified message>`
# rather than by the message alone, because two different codes can normalise to similar
# prose and the code is the tool's own name for the class. Every row is what
# `tsc --allowJs --checkJs` reports on the tracked `.mjs` population TODAY, and why it
# stands. `TS2554` and `TS2305` are absent because 242 FIXED them; a row for a class at
# zero is refused by `LINT_STALE_CLASS`, which is how this table says "that work was done"
# rather than leaving an exemption behind it (174 §5).
TS_CLASS_CEILING: dict[str, tuple[int, str]] = {
    "TS2339 Property 'X' does not exist on type 'X'.": (
        # 🆕 261: 532 -> 533, ON PURPOSE and for one line. `authoring-plane.integration.mjs`
        # now reads `main_screen_get` before asserting on a capture, because the probe that
        # was pointed at the stale-frame defect accepted any full-size frame as proof the
        # tab was active — which is exactly what a HIDDEN tab returns after its first
        # visit. The reply is an untyped MCP result and the property access is the class
        # below, in the file that already carries dozens of it. MEASURED BOTH WAYS: the
        # bare `(await call(...)).active` costs TWO findings and a `/** @type {any} */`
        # in front of the reply costs ONE, so the cast is in and the remaining one is
        # here rather than silenced — this table's job is to keep the number visible.
        533,
        "The duck-typing tax, and the largest single class by four hundred. Untyped JS "
        "object literals infer to their narrowest shape, so every property added on a "
        "later branch reads as absent — `runtime_scenario.mjs` alone carries dozens off "
        "one `unknown` reply. Recorded, not fixed: annotating them is a `checkJs` "
        "migration and this row exists so that number is visible rather than implied.",
    ),
    "TS2775 Assertions require every name in the call target to be declared with an "
    "explicit type annotation.": (
        420,
        "One idiom, not 420 defects. TypeScript refuses to narrow through an assertion "
        "function reached by an un-annotated binding, and this tree's probes call "
        "`assert.ok`-shaped helpers through exactly that shape. It is a property of "
        "`checkJs` meeting `node:assert`, and it would vanish under one annotation per "
        "harness — which is work, not hygiene.",
    ),
    "TS2741 Property 'X' is missing in type 'X' but required in type 'X'.": (
        16, "Object literals built up across branches, judged against the fullest shape "
            "the file ever produces. Same root as TS2339, reported from the other side.",
    ),
    "TS2345 Argument of type 'X' is not assignable to parameter of type 'X'.": (
        13, "Inference over `null`-initialised accumulators: the parameter type is read "
            "off the first assignment and every later one disagrees.",
    ),
    'TS2740 Type \'X\' is missing the following properties from type \'X\': "X", "X", '
    '"X", "X", and N more.': (
        12, "🔴 THE ROW THAT FIXED THE CLASSIFIER. `seal_order_gate.selftest.mjs` checks "
            "a per-file expectation map against a narrower literal, and TS2740 names the "
            "missing members — in DOUBLE quotes, which `classify` did not strip until "
            "242. The first draft of this row pasted the leaked file names into the key "
            "and this gate refused it as UNKNOWN and STALE in the same run, which is "
            "exactly what a roster keyed on an instance rather than a class should do.",
    ),
    "TS2538 Type 'X' cannot be used as an index type.": (
        7, "Two LSP probes index a result map with a whole request object in a loop over "
           "heterogeneous tuples; the element type is the union of every tuple slot.",
    ),
    "TS2322 Type 'X' is not assignable to type 'X'.": (
        4, "Re-assignment across a widened union, same inference root as TS2345.",
    ),
    "TS2698 Spread types may only be created from object types.": (
        4, "Spreading a value typed `unknown` off a bridge reply, in four probes that "
           "check the reply's shape at runtime instead.",
    ),
    "TS2349 This expression is not callable.": (
        1, "`runtime_scenario.mjs:107` destructures `[name, args, ok]` out of an array "
           "literal whose rows mix strings, objects and predicates, so `ok` is typed as "
           "that union and calling it is refused. A tuple annotation is the fix and this "
           "file is a live demo script, so it is recorded rather than done here.",
    ),
    "TS2739 Type 'X' is missing the following properties from type 'X': start, end": (
        1, "🔴 A DELIBERATE UNION READ AS AN ERROR. `positive_control_gate.mjs` carries "
           "two unit shapes — `{start,end,…}` from a `test()` node and `{startLine,"
           "endLine,…}` from a banner — and discriminates them at line 451 with "
           "`unit.start !== undefined`. Untyped JS collapses them to one shape. The "
           "checker is wrong here and the row is where that is written down.",
    ),
}


def tracked_py() -> list[str]:
    raw = subprocess.run(["git", "ls-files", "*.py"], capture_output=True, text=True, cwd=str(ROOT))
    return sorted(raw.stdout.split())


def tracked_mjs() -> list[str]:
    """Every tracked `.mjs`, relative to `host/` — the declared population of the JS half.

    Relative to `host/` and not to the repo root because that is where `node_modules` is,
    and `tsc` must resolve `typescript`, `@types/node` and the SDK the way the files
    themselves do. `git ls-files` run inside a subdirectory answers about the whole tree
    but prints paths relative to the cwd, which is exactly the pair of properties needed.
    """
    raw = subprocess.run(["git", "ls-files", "*.mjs"], capture_output=True, text=True,
                         cwd=str(HOST))
    return sorted(raw.stdout.split())


# 🔴 NOT `tsconfig.json`, AND THAT IS THE POINT. Every `tsconfig` in this tree scopes
# itself with `include`, and P0 §2.1 is the record of what an `include` does to a reader:
# ts-prune read `["src/**/*.ts"]`, could not see the tests, and called four live symbols
# dead. A flag list names its population on the command line where the reader can read it
# back. `--strict` is absent on purpose (see the header). `--skipLibCheck` keeps the
# subject the tracked files rather than `@types`.
TSC_FLAGS = ["--allowJs", "--checkJs", "--noEmit", "--target", "ES2022",
             "--module", "Node16", "--moduleResolution", "Node16", "--lib", "ES2022",
             "--esModuleInterop", "--skipLibCheck", "--resolveJsonModule",
             "--types", "node"]

TSC_LINE = re.compile(r"^([^ (][^(]*)\((\d+),(\d+)\): error (TS\d+): (.*)$")


def classify(message: str) -> str:
    """A linter message with its subject removed — the CLASS, not the instance.

    Quoted identifiers become `'X'` and bare integers become `N`, so `'builtins' imported
    but unused` and `'os' imported but unused` are one row rather than two. Nothing else
    is normalised: a class this cannot recognise must arrive as its own row and redden,
    which is the failure mode this file prefers.

    🆕 242 — AND A DOUBLE-QUOTED SUBJECT IS A SUBJECT. This read `'…'` and not `"…"` for
    twelve sessions, and nothing noticed, because every message `pyflakes` emits quotes
    its subject the Python way. Pointing the same classifier at `tsc` produced the class
    on the first run: TS2740 spells its missing members in DOUBLE quotes, so a per-file
    roster leaked into the class NAME — one key carrying four file names and `and N
    more.`, which splits into a new class the day anybody adds a probe. The rule was
    always "strip the quoted subject"; it only ever implemented half of it, and the half
    it implemented was the half the first language needed. That is this session's whole
    subject arriving inside its own reader.
    """
    return re.sub(r"\b\d+\b", "N",
                  re.sub(r'"[^"]*"', '"X"', re.sub(r"'[^']*'", "'X'", message))).strip()


def tsc_absent() -> str | None:
    """The reason `tsc` cannot speak, or None if it can.

    🔴 THE SAME DOCTRINE AS `pyflakes_absent`, AND FOR THE SAME REASON 235 WROTE THAT ONE:
    a reader that goes quiet when it cannot see is how a standing decision gets written
    down in place of a command nobody re-ran. `tsc` is a devDependency this repository
    already installs to build and to test, so 'not there' means `npm ci --include=dev` was
    not run — which is a fact about the run, never about the tree.
    """
    if not (HOST / "node_modules" / "typescript" / "bin" / "tsc").is_file():
        return (f"`typescript` is NOT INSTALLED under {HOST.name}/node_modules. This is "
                f"not a clean population and not a stale roster — the tool never ran. Run "
                f"`npm ci --include=dev` in `host/` (it is already this repository's build "
                f"and test dependency), then re-read the rows.")
    return None


def dist_absent() -> str | None:
    """The reason the JS half cannot be read yet, or None.

    🆕 242 — WRITTEN BECAUSE CI REFUSED THIS GATE FOR A FACT ABOUT THE RUNNER. `tsc`
    follows imports, and fourteen tracked probes import `../dist/…`. On a tree where
    `npm run build` has not happened those imports resolve to nothing and the run reports
    **sixty `TS2307 Cannot find module`** — an UNDECLARED class, over a population that is
    entirely healthy, with a message that sends the next session looking for a defect in
    a roster that is correct. That is 235 §2's defect exactly, one language over: the
    difference between *the tool could not see* and *the tree is dirty*, collapsed into
    one observation. `ci.yml` now runs this gate after the build step; this reader is what
    says so when somebody runs it by hand.

    🔴 AND IT IS RED RATHER THAN A SKIP, like every other precondition in this file.
    """
    if not (HOST / "dist").is_dir():
        return (f"{HOST.name}/dist is NOT BUILT. `tsc --checkJs` follows imports and the "
                f"tracked probes import it, so every one of those would be reported as "
                f"`TS2307 Cannot find module` — a fact about this run, not about the "
                f"tree. Run `npm run build` in `host/`, then re-read the rows.")
    return None


def run_tsc(files: list[str]) -> tuple[list[tuple[str, str]], list[tuple[str, str]], str | None]:
    """((in-population findings), (closure findings), error).

    Two lists and not one, because `tsc` follows imports and the files it reaches that way
    are NOT the population this gate declares. Dropping them silently would make this
    reader report on a scope narrower than the one it names — 241's closing finding, which
    is the defect this whole row is about. They are returned so `main` can print them.

    `error` is not None when the TOOL could not speak, which is never a clean tree.
    """
    if not files:
        return [], [], "nothing to check — the file walk returned no tracked .mjs at all"
    if (why := tsc_absent()) is not None:
        return [], [], why
    if (why := dist_absent()) is not None:
        return [], [], why
    tsc = str(HOST / "node_modules" / "typescript" / "bin" / "tsc")
    try:
        p = subprocess.run(["node", tsc, *TSC_FLAGS, *files],
                           capture_output=True, text=True, cwd=str(HOST))
    except OSError as e:                                    # pragma: no cover
        return [], [], f"could not execute tsc: {e}"
    # 🔴 `tsc` EXITS 2 ON DIAGNOSTICS AND 1 ON ITS OWN FAILURE — the opposite way round
    # from pyflakes, and reading them the same way is how the absent-tool defect of 235
    # would arrive here. 0 is clean, 2 is findings; anything else is the tool failing.
    if p.returncode not in (0, 2):
        return [], [], (f"tsc exited {p.returncode} — a diagnostics run exits 0 or 2, so "
                        f"this is the compiler refusing rather than a population:\n   "
                        f"{((p.stderr or '') + (p.stdout or '')).strip()[:300]}")
    inside: list[tuple[str, str]] = []
    outside: list[tuple[str, str]] = []
    declared = set(files)
    for line in p.stdout.splitlines():
        if (m := TSC_LINE.match(line)) is None:
            continue
        rel, code, msg = m.group(1), m.group(4), m.group(5)
        (inside if rel in declared else outside).append((rel, f"{code} {msg}"))
    if p.returncode == 2 and not inside and not outside:
        return [], [], ("tsc exited 2 and this reader parsed no diagnostic out of its "
                        "stdout — the tool spoke and the reader did not understand it, "
                        "which is not the same observation as a clean population")
    return inside, outside, None


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
             files_read: int, floor: int, tool: str = "pyflakes",
             suffix: str = ".py") -> list[str]:
    """Four questions, kept apart on purpose.

    229 §5.3: folding two questions with different populations into one predicate made a
    self-check unable to ask either. `unknown class`, `over ceiling` and `stale row` have
    three different populations — the live findings, the roster's live rows, and the
    roster's dead ones — so each is asked over its own.

    🆕 242 — ONE RULE FOR TWO LANGUAGES, NOT TWO RULES THAT CAN DRIFT. `tool` and `suffix`
    are the only things that differ between the `pyflakes` half and the `tsc` half; the
    four predicates are the same four, over two rosters. `floor_pin_gate.py`'s note above
    `COMMENT_DECL` is the precedent and the argument: the thing that governs a ledger
    reason and the thing that governs a floor's annotation are one rule pointed twice, and
    a second copy of this function is how the two halves would stop agreeing.

    🔴 THE FILE COUNT IS STILL ASKED AS `<` HERE FOR BOTH. The `.py` half's EQUALITY is
    asserted in `_selftest` against the live tree and was deliberately left there: this
    session widened the reader, and quietly tightening the predicate the existing half runs
    under would have been a second change wearing the first one's clothes.
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
                f"🔴 LINT_STALE_CLASS “{cls}” is declared at {ceiling} and {tool} reports "
                f"NONE. Either the findings were fixed, or the tool stopped reporting that "
                f"class, or this reader stopped classifying it that way — and until one is "
                f"established the row is a ceiling over nothing, which is the shape 174 §5 "
                f"named and `MEASURED_CAUSE` already refuses one file over. Delete the row "
                f"if the work was done.")

    if files_read < floor:
        out.append(
            f"🔴 LINT_FILES_COLLAPSE {files_read} < {floor} — this gate read fewer files "
            f"than when its floor was measured. Either {suffix} files were deleted, or the "
            f"walk stopped reaching them, or `git ls-files` ran outside the repository — "
            f"and a linter with nothing to read reports a clean tree in exactly the same "
            f"words as a clean tree.")
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

    # ── 🆕 242: THE JS HALF ────────────────────────────────────────────────────────────
    #
    # 🔴 THE CLASSIFIER FIRST, BECAUSE THE CLASSIFIER IS WHAT WAS WRONG. Both quote
    # characters, and the negative direction with them: a message with no quoted subject
    # must survive untouched, or "strip the subject" becomes "strip everything" and every
    # class folds into one — the failure mode that makes a roster agree with anything.
    for msg, want, why in [
        ('Type \'A\' is missing: "a.mjs", "b.mjs", and 4 more.',
         'Type \'X\' is missing: "X", "X", and N more.',
         "🔴 242's OWN DEFECT — a DOUBLE-quoted subject is stripped like a single-quoted one"),
        ("Assertions require every name in the call target to be declared with an "
         "explicit type annotation.",
         "Assertions require every name in the call target to be declared with an "
         "explicit type annotation.",
         "a message with no quoted subject is left exactly alone"),
        ("Property 'find' does not exist on type 'unknown'.",
         "Property 'X' does not exist on type 'X'.",
         "the largest TS class normalises to one row"),
    ]:
        got = classify(msg)
        ok = got == want
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {why:<66} -> {got[:60]}")

    # 🔴 THE PARAMETER HAS TO REACH THE MESSAGE, which is 242's other subject. A `tool`
    # argument that never appears in the refusal is a reader telling a JS session to go
    # and install pyflakes, and nothing else in this file would ever say so.
    js_stale = problems([], {"TSX something": (3, "…")}, 64, 64, tool="tsc", suffix=".mjs")
    ok = bool(js_stale) and "tsc reports" in js_stale[0] and "pyflakes" not in js_stale[0]
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'the JS half names tsc in its refusal, not pyflakes':<66} -> {ok}")
    py_stale = problems([], {"x": (3, "…")}, 18, 18)
    ok = bool(py_stale) and "pyflakes reports" in py_stale[0]
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'…and the Python half still names pyflakes':<66} -> {ok}")

    # 🔴 THE FLOOR, PINNED AGAINST THE LIVE TREE FROM BOTH SIDES — `PY_FILE_FLOOR`'s claim
    # one population over. `floor_pin_gate.py` mutates this constant toward zero and
    # demands this runner redden; the live gate reads it only as `files_read < FLOOR`, so
    # ZEROING IT MAKES THE GATE MORE PERMISSIVE and the live run cannot notice. An
    # equality here is what makes the zeroed literal fail.
    n_mjs = len(tracked_mjs())
    ok = MJS_FILE_FLOOR == n_mjs
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'MJS_FILE_FLOOR equals the live tracked .mjs count':<66} "
          f"floor={MJS_FILE_FLOOR} live={n_mjs}")
    ok = bool(problems([], {}, MJS_FILE_FLOOR - 1, MJS_FILE_FLOOR, tool="tsc", suffix=".mjs"))
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'and one BELOW it refuses over an EMPTY roster':<66} -> {ok}")

    # 🔴 THE DIAGNOSTIC PARSER, ON A LITERAL `tsc` LINE. Its shape is the whole reason the
    # closure can be separated from the population at all; if it stops matching, `run_tsc`
    # returns two empty lists and 1,010 findings read as a clean tree.
    m = TSC_LINE.match("scripts/wire_diff.mjs(12,3): error TS2339: Property 'x' does not exist.")
    ok = bool(m) and m.group(1) == "scripts/wire_diff.mjs" and m.group(4) == "TS2339"
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'a tsc diagnostic line parses to (file, code, message)':<66} -> {ok}")
    ok = not TSC_LINE.match("  Property 'x' does not exist on type 'y'.")
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'…and an INDENTED continuation line is not a second finding':<66} -> {ok}")

    # 🔴 THE POPULATION SPLIT, ON A FIXTURE. A finding in a file the walk did not declare
    # must not be rostered — `host/dist/*.js` is `tsc`'s own emit and a ceiling over it
    # would be a ceiling over the compiler. The claim is that the ROSTER never sees it.
    declared = {"scripts/a.mjs"}
    rows = [("scripts/a.mjs", "TS1 msg"), ("dist/bridge.js", "TS1 msg")]
    inside = [r for r in rows if r[0] in declared]
    ok = len(inside) == 1 and not problems(inside, {"TS1 msg": (1, "…")}, 64, 64,
                                           tool="tsc", suffix=".mjs")
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'a closure finding is outside the population and not rostered':<66} -> {ok}")

    # 🔴 AND THE LIVE HALF — AGREEMENT, NOT INSTALLATION. 235's rule, quoted one tool over:
    # this claim must hold on a machine that ran `npm ci` and on one that did not, which is
    # what makes it a claim about this reader rather than about the machine.
    # 🔴 AND THE BUILD-STATE PRECONDITION, THE SAME WAY — the one CI added. It must say
    # ABSENT exactly when `host/dist` is missing and stay quiet exactly when it is there,
    # which is a claim about this reader and holds on a built tree and an unbuilt one.
    dist_reason = dist_absent()
    ok = (dist_reason is None) == (HOST / "dist").is_dir()
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'dist_absent() agrees with the filesystem':<66} "
          f"-> {'built' if dist_reason is None else 'ABSENT'}")

    ts_reason = tsc_absent()
    ok = (ts_reason is None) == (HOST / "node_modules" / "typescript" / "bin" / "tsc").is_file()
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'tsc_absent() agrees with the filesystem':<66} "
          f"-> {'installed' if ts_reason is None else 'ABSENT'}")

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

    # ── 🆕 242: THE JS HALF ────────────────────────────────────────────────────────────
    # Run whatever the Python half said, so one refusal never hides the other's population.
    mjs = tracked_mjs()
    inside, outside, js_err = run_tsc(mjs)
    if js_err is not None:
        print(f"LINT_CEILING_JS files={len(mjs)} floor={MJS_FILE_FLOOR}")
        print(f"🔴 LINT_NO_TOOL — {js_err}\n"
              f"   RED and not a skip, for the reason the Python half is: a reader that\n"
              f"   goes quiet when it cannot see is how a standing decision gets written\n"
              f"   down in place of a command nobody re-ran.")
        bad.append("🔴 LINT_CEILING_JS could not run its tool")
    else:
        js_counts: dict[str, int] = {}
        for _f, msg in inside:
            js_counts[classify(msg)] = js_counts.get(classify(msg), 0) + 1
        print(f"LINT_CEILING_JS tsc --allowJs --checkJs over {len(mjs)} tracked .mjs "
              f"file(s) · floor {MJS_FILE_FLOOR} · {len(inside)} finding(s) in "
              f"{len(js_counts)} class(es) · {len(TS_CLASS_CEILING)} declared · "
              f"{len(outside)} in the import closure, outside the declared population")
        for cls in sorted(js_counts):
            ceiling = TS_CLASS_CEILING.get(cls, (None, ""))[0]
            mark = "🟢" if ceiling is not None and js_counts[cls] <= ceiling else "🔴"
            print(f"  {mark} {js_counts[cls]:>4} / "
                  f"{ceiling if ceiling is not None else 'UNDECLARED'}  {cls[:118]}")
        for cls in sorted(TS_CLASS_CEILING):
            if cls not in js_counts:
                print(f"  🔴 {0:>4} / {TS_CLASS_CEILING[cls][0]}  {cls[:118]}   "
                      f"(declared, none live)")
        # 🔴 THE CLOSURE, NAMED BY DIRECTORY AND NEVER ROSTERED. `host/dist/` is BUILT
        # OUTPUT; a ceiling over it would be a ceiling over `tsc`'s own emit.
        if outside:
            where: dict[str, int] = {}
            for f, _m in outside:
                where[f.split("/")[0]] = where.get(f.split("/")[0], 0) + 1
            print("     closure: " + ", ".join(f"{k}/ ×{v}" for k, v in sorted(where.items()))
                  + "  — reached through imports, not declared, not rostered")
        bad += problems(inside, TS_CLASS_CEILING, len(mjs), MJS_FILE_FLOOR,
                        tool="tsc", suffix=".mjs")

    if bad:
        for line in bad:
            print(line)
        print("🔴 LINT_CEILING refused. 229 §5.2: a defect a free off-the-shelf tool "
              "reports and eleven bespoke instruments miss is a question about the "
              "instruments' coverage, not about the defect.")
        return 1
    print(f"LINT_CEILING ok — every finding falls under a class declared with a reason, no "
          f"class grew past what it shipped at, no declared class is a ceiling over "
          f"nothing, and the two walks reached {len(files)} .py and {len(mjs)} .mjs file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
