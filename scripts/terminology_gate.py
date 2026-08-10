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

SUFFIXES = {".py", ".ts", ".mjs", ".js", ".md", ".json", ".yml", ".yaml", ".gd"}
TERM_FLOOR = 1          # governed by floor_pin_gate's SIZE_LEDGER


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
    print(f"TERMINOLOGY ok — {len(swept)} file(s) swept, 0 retired term(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
