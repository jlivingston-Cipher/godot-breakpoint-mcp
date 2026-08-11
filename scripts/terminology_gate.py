#!/usr/bin/env python3
"""The retired words, read out of the rule that retired them.

🔴 223 §2 SET THE RULE AND 223 §5.4 DECLARED IT DONE: nine back-catalogue documents
rewritten, three renamed, "residual adversarial terms across all of them: ZERO". That
sentence was true. **Its population was nine documents, and the word was live in five
source files the whole time** — including two that PRINT it on a green run:
`contract_check.py` ended every successful pass with `1 exempt (rival ceiling)`, and
`token-cost.mjs --summary` headed its per-family table "the breakdown the rival
published". Twenty-four occurrences, measured in session 225.

That is 224 §7.6's shape one instrument over: a sweep whose FILE SET is curated reports
zero for the files somebody thought of. The population here is therefore the complement —
every tracked text file — and a file leaves it only for a reason printed on every run.

🔴 THE TERM LIST IS PARSED OUT OF `docs/LANDSCAPE_TRACKING_POLICY.md`, NOT RETYPED HERE.
A gate carrying its own copy of the rule is a second rule that drifts from the first, and
the drift is invisible because both look authoritative. Rule 1 names the retired words in
prose; this file reads them from that prose and fails if it cannot find any — a policy
whose wording moves out from under the parser must break the gate loudly rather than
quietly enforce nothing. `assetlib_sweep.py`'s invariant, applied to vocabulary.

WHAT IS OUT OF THE POPULATION, AND WHY IT IS DERIVED RATHER THAN LISTED:
  * `CHANGELOG.md` — append-only history, the same class checks 10 and 12 exclude. Editing
    a shipped changelog entry to change its vocabulary would be falsifying a record.
  * 🔴 EVERY FILE THAT CITES THE POLICY DOCUMENT BY PATH. A file about the rule has to be
    able to name what the rule retires; a gate that reddened on the sentence "the word
    rival is retired" would make its own rule unstateable, which is the reductio every
    keyword scanner walks into eventually.

THE SECOND EXCLUSION IS DERIVED, AND THIS FILE IS WHY. The first draft named the policy
and the roster explicitly — a two-entry roster — and it went red on ITSELF the moment
`git add` made it tracked: nine hits across its own docstring, its parser's worked example
and its selftest fixtures. Adding a third name would have been the roster growing by
exactly the case that refuted it. **Citing the policy is the property those three files
actually share**, and it is one a reader can check: the excluded files are printed by name
on every run, so a file that starts citing the policy in order to earn silence is visible
in the same line that grants it.
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "LANDSCAPE_TRACKING_POLICY.md"
ROSTER = ROOT / "docs" / "alternative_mcp_roster.json"
CHANGELOG = ROOT / "CHANGELOG.md"

# 🆕 233 — `.cfg` ADMITTED, AND IT IS THE MOST PUBLIC PROSE IN THE REPOSITORY. The
# docstring above says the population is "the complement — every tracked text file", and
# this set is what made that sentence false: 80 of 354 tracked files carried a suffix
# nobody had listed, and one of them is `addons/breakpoint_mcp/plugin.cfg`, whose
# `description=` line is the text the Godot Asset Library publishes verbatim. A rule about
# vocabulary that cannot read the sentence 5,000 people see is 224 §7.6's shape a third
# time, and this time in the direction that reaches users.
SUFFIXES = {".py", ".ts", ".mjs", ".js", ".md", ".json", ".yml", ".yaml", ".gd", ".cfg",
            ".cs", ".sh", ".tsv"}
TERM_FLOOR = 1          # governed by floor_pin_gate's SIZE_LEDGER

# ── 🆕 233 — THE DISCOVER HALF, ASKED OF `SUFFIXES` ────────────────────────────────────
#
# 🔴 A SUFFIX ROSTER IS A CURATED FILE SET WEARING A DERIVATION'S CLOTHES. `tracked_files`
# starts from `git ls-files` — a walk — and then filters it through a written-down set, so
# the population is exactly as complete as somebody's memory of which extensions carry
# prose. Nothing said so: a `.cfg` shipping the word this gate retires produced the same
# `0 retired term(s)` a clean tree does.
#
# 🔴 THE DISCRIMINATOR IS "COULD A HUMAN SENTENCE LIVE HERE", AND IT IS DECIDED BY
# DECLARATION RATHER THAN BY GUESS, because no scanner can tell prose from an identifier.
# So every tracked suffix is in one of exactly two tables — swept, or excluded WITH A
# REASON — and a suffix in neither refuses. That is the only shape in which "we thought of
# the text files" becomes a claim a reader can check.
#
# 🔴 AND THE EXCLUSIONS ARE BINARY-OR-GENERATED, EACH ARGUABLE ON ITS FACE. Not "the rest":
# a category, per row, that a reader can disagree with.
SUFFIX_EXEMPT: dict[str, str] = {
    "": "extensionless dotfiles and hooks — `.gitignore`, `.gitattributes`, LICENSE, and "
        "`.githooks/pre-commit`. Configuration and a licence text nobody here authored; "
        "the licence in particular is a verbatim third-party document and editing its "
        "vocabulary would falsify it, which is CHANGELOG.md's reason one file over",
    ".png": "raster image",
    ".gif": "animated raster image",
    ".svg": "vector image — the banner artwork carries no sentence, and a scanner reading "
            "path data as prose is the `server/i` class spec_conformance.py already found",
    ".uid": "Godot-generated resource identifiers, one opaque token per file — regenerated "
            "by the editor, so an edit here does not survive the next import",
    ".tscn": "Godot-generated scene files — node graphs and property assignments the "
             "editor rewrites wholesale; any string in them is engine data, not prose",
    ".godot": "Godot-generated project settings, rewritten by the editor on save",
    ".cast": "asciinema terminal recordings — a captured transcript of a session that "
             "already happened, which is CHANGELOG.md's append-only reason exactly",
    ".csproj": "MSBuild project XML, generated by the C# tooling",
    ".sln": "Visual Studio solution file, generated by the C# tooling",
    # 🔴 A `.cfg.disabled` ROW WAS WRITTEN HERE AND `STALE_EXEMPT` REFUSED IT WITHIN A
    # MINUTE — `Path.suffix` returns only the LAST component, so the row could never have
    # matched anything, and it was speculative besides. Third session running that a rule
    # caught code written minutes earlier in the same commit (232 §5.4, 231).
}

# 🔴 FLOORED FROM BELOW, AND AS TWO NUMBERS RATHER THAN ONE SUM (172 §6). A `git ls-files`
# that returns nothing reads as "every suffix is accounted for"; a walk that still returns
# 354 paths while `Path.suffix` stops resolving reads as one enormous extensionless
# population, and the file count cannot see the second. Measured: 354 tracked paths,
# 21 distinct suffixes, 280 swept and 74 excused.
TRACKED_FLOOR = 250
SUFFIX_FLOOR = 10


def retired_terms(policy_text: str) -> list[str]:
    """The words Rule 1 retires, read from Rule 1.

    Rule 1's sentence is: `The word **"rival"** is retired, along with "competitor" used
    pejoratively, "threat", "enemy", "beat", "kill", and "attack line".` Only the FIRST
    clause is taken — the bolded word retired outright. The qualified ones ("competitor
    used pejoratively") are judgements about usage, and a scanner that cannot see tone
    cannot enforce them; claiming otherwise would be a gate whose greens mean less than
    they appear to. That narrowing is printed, not assumed.
    """
    m = re.search(r'The word \*\*"([a-z]+)"\*\* is retired', policy_text)
    return [m.group(1)] if m else []


def offenders(term: str, path: Path) -> list[tuple[int, str]]:
    rx = re.compile(rf"\b{term}s?\b", re.IGNORECASE)
    out = []
    for ln, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        if rx.search(line):
            out.append((ln, line.strip()[:120]))
    return out


def tracked_files() -> list[Path]:
    raw = subprocess.run(["git", "ls-files"], capture_output=True, text=True, cwd=str(ROOT))
    return [ROOT / f for f in raw.stdout.split() if Path(f).suffix in SUFFIXES]


def tracked_paths() -> list[str]:
    """Every tracked path, unfiltered — the walk the suffix set is a filter over."""
    raw = subprocess.run(["git", "ls-files"], capture_output=True, text=True, cwd=str(ROOT))
    return raw.stdout.split()


def suffix_problems(paths, swept, exempt,
                    tracked_floor: int = TRACKED_FLOOR,
                    suffix_floor: int = SUFFIX_FLOOR) -> tuple[list[str], dict]:
    """PURE over its inputs (174 §8), so the self-check can hand it a tree that cannot exist.

    A collector only ever asserted over the healthy population loses its filter invisibly,
    and on a healthy tree every list below is empty.
    """
    problems: list[str] = []
    seen: dict[str, int] = {}
    for f in paths:
        seen[Path(f).suffix] = seen.get(Path(f).suffix, 0) + 1
    for suf in sorted(seen):
        if suf in swept or suf in exempt:
            continue
        problems.append(
            f"TERMINOLOGY_SUFFIX UNDECLARED {suf or '(none)'!r} — {seen[suf]} tracked file(s) "
            f"carry it and it is in neither SUFFIXES nor SUFFIX_EXEMPT, so this gate reports "
            f"`0 retired term(s)` about a population it never opened. Sweep it, or give it a "
            f"row saying what kind of file it is")
    for suf in sorted(set(exempt) - set(seen)):
        problems.append(
            f"TERMINOLOGY_SUFFIX STALE_EXEMPT {suf!r} — excluded with a reason, and no tracked "
            f"file carries it. An exclusion outliving its subject is one nobody re-argued "
            f"(174 §5)")
    for suf in sorted(set(swept) & set(exempt)):
        problems.append(
            f"TERMINOLOGY_SUFFIX BOTH {suf!r} — swept AND excused. One of the two is wrong "
            f"and this file cannot decide which")
    if len(paths) < tracked_floor:
        # 🔴 THE OBSERVATION, NOT A CAUSE (228 §7.17): `git ls-files` may have returned less,
        # or the call may have stopped reaching git, and a count cannot separate those.
        problems.append(
            f"TERMINOLOGY_SUFFIX TRACKED_FLOOR {len(paths)} < {tracked_floor} — fewer tracked "
            f"paths than the floor. The tree may have lost them or the walk may have stopped "
            f"reaching them; either way every check above runs over a population too small to "
            f"contain the case it is looking for")
    if len(seen) < suffix_floor:
        problems.append(
            f"TERMINOLOGY_SUFFIX SUFFIX_FLOOR {len(seen)} < {suffix_floor} distinct suffix(es) "
            f"over {len(paths)} path(s) — the walk may be reading fewer kinds of file, or "
            f"`Path.suffix` may have stopped resolving them, and the path count above cannot "
            f"see the second. Two floors, never a sum (172 §6)")
    return problems, {"paths": len(paths), "suffixes": len(seen),
                      "swept": sum(n for s, n in seen.items() if s in swept),
                      "exempt": sum(n for s, n in seen.items() if s in exempt)}


def _selftest() -> int:
    print("TERMINOLOGY selftest — the parser and the scanner, on fixtures")
    bad = 0
    cases = [
        ('The word **"rival"** is retired, along with "threat".', ["rival"], "the live wording"),
        ('The word **"enemy"** is retired.', ["enemy"], "a different retired word is followed"),
        ("Rule 1 — Terminology: alternative MCP servers", [], "🔴 wording gone -> NO terms, which must FAIL the gate"),
    ]
    for text, want, why in cases:
        got = retired_terms(text)
        ok = got == want
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {why:<62} -> {got}")
    d = Path(tempfile.mkdtemp(prefix="term_self_"))
    f = d / "x.md"
    for text, want_n, why in [("a rival's ceiling", 1, "possessive matches"),
                              ("the rivals publish", 1, "plural matches"),
                              ("on arrival it works", 0, "🔴 `arrival` must NOT match — the first census counted 38 and 14 were this"),
                              ("A RIVAL ceiling", 1, "case-insensitive")]:
        f.write_text(text, encoding="utf-8")
        got = len(offenders("rival", f))
        ok = got == want_n
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {why:<62} -> {got}")
    # ── 🆕 233 — THE SUFFIX DISCOVER HALF, DRIVEN FROM BOTH SIDES ────────────────────
    # 🔴 FIXTURE-FED, because on a healthy tree every list `suffix_problems` builds is
    # empty and an inline version would be deleted by anything and noticed by nothing.
    _P = ["a.md"] * 200 + ["b.py"] * 60 + ["c.png"] * 20 + ["d.gd"] * 20 + \
         ["e.ts"] * 10 + ["f.json"] * 10 + ["g.yml"] * 10 + ["h.mjs"] * 10 + \
         ["i.js"] * 5 + ["j.cs"] * 5 + ["k.sh"] * 3 + ["l.cfg"] * 2
    _SW = {".md", ".py", ".gd", ".ts", ".json", ".yml", ".mjs", ".js", ".cs", ".sh", ".cfg"}
    _EX = {".png": "raster image"}
    for want, args, why in [
        (False, (_P, _SW, _EX), "silent when every tracked suffix is swept or excused"),
        (True, (_P + ["m.tscn"], _SW, _EX),
         "🔴 REFUSES a tracked suffix in neither table — the whole of 233 §5.3: 80 of 354 "
         "files were in this state and the gate printed `0 retired term(s)`"),
        (True, (_P, _SW, {**_EX, ".zzz": "gone"}),
         "🔴 refuses an exclusion for a suffix nothing carries (174 §5)"),
        (True, (_P, _SW, {**_EX, ".md": "both"}),
         "🔴 refuses a suffix that is BOTH swept and excused"),
        (True, (_P[:20], _SW, _EX),
         "🔴 refuses a tracked walk that shrank, without asserting which of the two causes"),
        (True, ([], _SW, _EX),
         "🔴 does NOT pass over an EMPTY walk — the shape that makes every case above vacuous"),
        (True, (["a.md"] * 300, _SW, _EX),
         "🔴 refuses 300 paths of ONE suffix — the second floor, which the path count cannot see"),
    ]:
        got = bool(suffix_problems(*args)[0])
        ok = got == want
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {why[:62]:<62} -> {got}")
    # 🔴 AND THE READER OVER THE TREE IT SHIPS AGAINST — the fixtures prove the predicate,
    # this proves the walk still reaches git (202 §9.4, one layer out).
    _live_ok = len(tracked_paths()) >= TRACKED_FLOOR
    bad += 0 if _live_ok else 1
    print(f"  {'🟢' if _live_ok else '🔴'} {'tracked_paths() still reaches git ls-files':<62} "
          f"-> {len(tracked_paths())}")
    # 🔴 AND THE FLOORS THEMSELVES, which a zero would make unable to bite.
    _f_ok = TRACKED_FLOOR > 0 and SUFFIX_FLOOR > 0
    bad += 0 if _f_ok else 1
    print(f"  {'🟢' if _f_ok else '🔴'} {'both suffix floors are pinned above zero':<62} "
          f"-> {TRACKED_FLOOR}/{SUFFIX_FLOOR}")

    # 🔴 THE FLOOR, PINNED AGAINST THE LIVE POLICY. `floor_pin_gate.py` mutates
    # `TERM_FLOOR` and requires this file to redden; a floor used only as
    # `len(terms) < TERM_FLOOR` gets WEAKER when zeroed, so the literal has to be
    # asserted here or the mutation passes silently.
    live = len(retired_terms(POLICY.read_text(encoding="utf-8")))
    ok = TERM_FLOOR == live
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'TERM_FLOOR equals what the live policy retires':<62} "
          f"floor={TERM_FLOOR} live={live}")
    print(f"TERMINOLOGY selftest {'ok' if not bad else f'🔴 {bad} FAILED'}")
    return 1 if bad else 0


def main() -> int:
    if "--selftest" in sys.argv:
        return _selftest()

    terms = retired_terms(POLICY.read_text(encoding="utf-8"))
    print(f"TERMINOLOGY terms={len(terms)} floor={TERM_FLOOR} {terms}")
    # 🆕 233 — THE DISCOVER HALF, REPORTED INTO THE SAME VERDICT rather than beside it.
    _paths = tracked_paths()
    _sp, _st = suffix_problems(_paths, SUFFIXES, SUFFIX_EXEMPT)
    print(f"TERMINOLOGY_SUFFIX {_st['paths']} tracked path(s) · {_st['suffixes']} distinct "
          f"suffix(es) · {_st['swept']} swept · {_st['exempt']} excused · {len(_sp)} problem(s) "
          f"(floors {TRACKED_FLOOR}/{SUFFIX_FLOOR})")
    for _m in _sp:
        print(f"🔴 {_m}")
    if len(terms) < TERM_FLOOR:
        print(f"🔴 TERMINOLOGY_NO_TERMS — Rule 1's sentence in {POLICY.relative_to(ROOT)} no "
              f"longer parses, so this gate would sweep the whole tree for nothing and exit 0.\n"
              f"   Either the rule moved (point the parser at it) or it was withdrawn (delete\n"
              f"   this gate on purpose). An unparseable rule is not an empty rule.")
        return 1

    files = tracked_files()
    # The derivation: a file that cites the policy by path is a file ABOUT the rule.
    cites = POLICY.name
    states_the_rule = {
        p for p in files
        if p == POLICY or cites in p.read_text(encoding="utf-8", errors="replace")
    }
    excluded = states_the_rule | {CHANGELOG}
    swept = [p for p in files if p not in excluded]

    bad = 0
    for term in terms:
        for path in swept:
            for ln, line in offenders(term, path):
                bad += 1
                print(f"  🔴 {path.relative_to(ROOT)}:{ln} — “{line}”")

    # The excluded scope, as numbers, every run.
    exc_hits = sum(len(offenders(t, p)) for t in terms for p in excluded if p.exists())
    named = ", ".join(sorted(str(p.relative_to(ROOT)) for p in states_the_rule))
    print(f"   …not covered: {len(files) - len(swept)} of {len(files)} tracked text file(s), "
          f"carrying {exc_hits} legitimate occurrence(s) — the changelog (append-only), and "
          f"the {len(states_the_rule)} file(s) that CITE the policy: {named}")
    print("   …and only the outright-retired word is enforced: Rule 1's qualified terms "
          "(\"competitor\" used pejoratively, \"threat\", \"beat\") are judgements about tone "
          "that no scanner can make")

    if bad:
        print(f"🔴 TERMINOLOGY {bad} occurrence(s) of a retired term. House usage is "
              f"\"alternative MCP servers\" / \"the alternatives\" / the project's own name "
              f"({POLICY.relative_to(ROOT)}, Rule 1).")
        return 1
    if _sp:
        # 🔴 THE SUFFIX ROSTER IS PART OF THE VERDICT, not a note under it. A population
        # this gate never opened is indistinguishable, from the outside, from a population
        # it opened and found clean — which is the whole of 233 §5.3.
        return 1
    print(f"TERMINOLOGY ok — {len(swept)} file(s) swept, 0 retired term(s), and every one "
          f"of the {_st['suffixes']} tracked suffix(es) is swept or excused with a reason")
    return 0


if __name__ == "__main__":
    sys.exit(main())
