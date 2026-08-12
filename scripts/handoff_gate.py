#!/usr/bin/env python3
"""The handoff's own counters, read back out of the instruments that printed them.

🔴 234 §1 — TWICE IN A ROW, IN THE SAME FIELD, AND THE SECOND TIME WAS BY THE SESSION
THAT CAUGHT THE FIRST. 232's status block printed `707 keys` under a line captioned
"VERIFIED AFTER THE CHANGE"; 707 is the value at its BASE. 233 measured that field by
field, found it, and wrote the sentence this file exists to enforce — *"the number was
carried forward … which is the one place a status block cannot afford to be a copy"* —
and then printed `807 keys` in its own block, against a tree that reads **814**. Measured
at four points and deterministic on repeat: `741e717` 707, `e9d6ba2` 747, `191eca9` and
`c27953d` both 814. **807 is not a value this tree has ever had.**

Every other field of both blocks held. So the defect is not attention, and a session
resolving to be more careful is not a fix — 233 was more careful than any session before
it about exactly this, in writing, on the same counter, and still missed. **The claim is
TYPED where every other claim in this repository is DERIVED**, and 174 §5's rule turns
out to have a twenty-third instance: a number an instrument prints and no gate reads is
an unasked question. `FLOOR_PIN_LITERAL` prints on every run. Nothing has ever read it
back.

🔴 THE HANDOFF IS THE LAST UNCHECKED TABLE IN THE TREE. Every roster here is asserted in
both directions; every exemption table is checked for staleness; 233 §18 added that a
reason has to be checkable. The status block is a table of two dozen claims about what
the instruments said, it is the first thing the next session reads, it decides what that
session believes it is standing on — and it is the only one nothing reads back.

WHY THIS FILE TAKES A PATH INSTEAD OF FINDING ITS POPULATION:
  Handoffs are not tracked. They live beside the clone, not in it, so there is no
  `git ls-files` that reaches them and no walk that could. This is an AUTHORING
  instrument, run against the handoff being written the way `tree_quiet.py` is run
  before a cut — and that is a real limitation, printed here rather than discovered
  later: **a handoff nobody runs this against is exactly as unchecked as it was.**

WHY THE READER IS ANCHORED ON LABELS AND NOT ON NUMERALS:
  🔴 A BARE NUMERAL SCANNER READS `27953` OUT OF `c27953d`. The status block's other
  lines carry SHAs, versions (`1.74.0`), PR numbers and session numbers, none of which
  any instrument prints and none of which anybody can restate wrongly in the sense that
  matters. That is check 11's lesson (`PROSE_NUMERAL_PINS`, and the `cl100k_base`
  refusal that wrote its letter guards) arriving one document over, so `COUNTER_RE`
  below carries the same guards and `NUMERAL_PINS` pins both directions of it.

WHY THE POPULATION IS THE ATOMS AND NOT A LIST OF FIELD NAMES:
  🔴 THE FIELD VOCABULARY DRIFTS EVERY SESSION AND THAT IS NOT A DEFECT. Measured over
  227–233: `floor_pin 79` became `floor_pin 83` became `floor_pin 89`; `instrument ok`
  became `instrument ok across 12` became `ok across 13`; 232 reported `discover
  48/12/12/18` and 233 reported no such field; `wire_invisible 27 cases + live ok` and
  `wire_invisible 27 + live` are the same claim spelled two ways. A parser holding a
  fixed vocabulary would stop matching the session it was written for and report zero
  disagreements over zero claims — `scope_gate.py`'s quiet pass, in a reader whose whole
  subject is claims nobody checks. So the population is every `·`-separated ATOM the
  block actually contains, each one must bind to exactly one reader, and `CLAIM_FLOOR`
  refuses a parse that went quiet.

BOTH DIRECTIONS, AND THE SECOND ONE HAS NEVER BEEN THE FAILURE YET:
  * An atom binding to NO reader is a claim nobody can check — the shape this file
    exists for, and the shape the next renamed field will take.
  * A reader matching NO atom is a counter the block DROPPED. Nothing today would
    notice a session quietly ceasing to report `unswept`, and the block would look
    complete because completeness is judged by eye against the previous one.
  Readers legitimately absent from a given block are `OPTIONAL` with a reason.

WHAT IT REFUSES TO PRETEND IT MEASURED:
  🔴 `scope_gate.py`, `control_gate.py` and `instrument_gate.py` MUTATE THE TREE, and a
  reader that ran them as a side effect of checking prose would be a gate with a blast
  radius nobody asked for. They are `MUTATING`, they are never run from here, and their
  counters come from `--measured <log>` — the session already ran them. When no log is
  supplied they are reported UNMEASURED and the gate REFUSES. Green over a block where
  seven of twenty-three counters were never read is the exact silence this file is about.

  🔴 AND THE FIRST DRAFT OF THAT PARAGRAPH WAS FALSE, IN THIS FILE, ABOUT THIS FILE.
  It said the mutating gates are never run from here while six rows called
  `floor_pin_gate.py`, which takes `_gate_lock` and rewrites every floor in the tree
  before restoring them — the same family as the three it named, distinguished only by
  being fast. That is 233 §18's class exactly (an exclusion is a claim about the tree,
  and a claim nobody re-derives is prose) committed by the session that built the
  instrument for it, inside the instrument, on the first day. `LOCKED` is the honest
  third class: it mutates under the lock and restores on every exit path, it is run by
  default because the replay runs it in this position anyway, `--no-locked` declines it,
  and the run says which lock it took rather than leaving a reader to find out.

Run:  python3 scripts/handoff_gate.py ../HANDOFF_SESSION234.md
      python3 scripts/handoff_gate.py ../HANDOFF_SESSION234.md --measured run.log
      python3 scripts/handoff_gate.py ../HANDOFF_SESSION234.md --no-locked
      python3 scripts/handoff_gate.py --selftest
      python3 scripts/handoff_gate.py ../HANDOFF_SESSION234.md --read   (parse only)
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOST = ROOT / "host"

# ── THE FLOORS ────────────────────────────────────────────────────────────────────────
#
# 🔴 BOTH FLOOR THE SAME SILENCE FROM OPPOSITE SIDES, which is `wire_invisible_gate`'s
# two-floor argument one document over. A parser that stops matching reads zero atoms,
# binds zero readers, disagrees with nothing and prints ok — and a roster that lost its
# rows binds zero atoms and reports every claim unreadable, which is loud. The quiet one
# is `CLAIM_FLOOR`; `READER_FLOOR` is here because a roster silently shrinking would make
# the DROPPED-counter direction unenforceable without making anything red.
CLAIM_FLOOR = 15         # governed by floor_pin_gate's SIZE_LEDGER
READER_FLOOR = 24        # governed by floor_pin_gate's SIZE_LEDGER

# 🔴 THE SAME GUARDS AS `PROSE_NUMERAL_RE`, AND FOR THE SAME REASONS, WITH ONE WIDENING.
# check 11 reads three digits exactly because its subject is tool counts in a README;
# this file's subject is every counter an instrument prints, which runs from `0 crashes`
# to `blast 1383` to `3474 nodes`. So the digit-run is unbounded and the guards do all
# the work: a digit welded to a letter belongs to an identifier (`c27953d`), and a `.`
# or `,` with a digit on its far side belongs to a version or a grouped number
# (`1.74.0`, `342,113`). Both directions are pinned in `NUMERAL_PINS`.
COUNTER_RE = re.compile(
    r"(?<![\dA-Za-z])(?<![\d][.,])(\d+)(?![\dA-Za-z])(?![.,]\d)"
)

# The counter line and its continuations. A block's counters begin at the line carrying
# `VERIFIED` and run to the end of the fence, every continuation starting with `·`.
VERIFIED_RE = re.compile(r"^\s*(?:[🟢🔴🆕]\s*)?\*{0,2}VERIFIED\b", re.U)


# ── THE ROSTER ────────────────────────────────────────────────────────────────────────
#
# 🔴 A ROW IS A COUNTER, THE COMMAND THAT PRINTS IT, THE PATTERN THAT READS IT BACK, AND
# A REASON. The reason is required for `MEASURED_CAUSE`'s argument — a row without one is
# a binding somebody will later loosen because it was in the way — and `alias` is a
# PATTERN rather than a literal because of the vocabulary drift measured above.
#
# cost:  CHEAP     runs in seconds, run by default
#        LOCKED    mutates the tree under `_gate_lock` and restores; run by default,
#                  declined by --no-locked, and named in the output when it runs
#        SLOW      the host suite; run only under --slow or supplied by --measured
#        MUTATING  never run from here (see the docstring)
#
# need:  REQUIRED  a block that omits this counter has dropped it
#        OPTIONAL  legitimately absent from some blocks, with the reason saying when
CHEAP, LOCKED, SLOW, MUTATING = "CHEAP", "LOCKED", "SLOW", "MUTATING"
REQUIRED, OPTIONAL = "REQUIRED", "OPTIONAL"

# (key, alias, n, cmd, cwd, extract, cost, need, reason)
COUNTER_READERS: "list[tuple[str, str, int, tuple[str, ...] | None, Path, str, str, str, str]]" = [
    # ── the host suite ────────────────────────────────────────────────────────────────
    ("host.suite", r"^\d+/\d+$", 2, ("npm", "test"), HOST,
     r"^# tests (\d+)\n(?:.*\n)*?# pass (\d+)$", SLOW, REQUIRED,
     "🔴 THE ONE ATOM WITH NO LABEL AT ALL. Every block since 227 spells the host suite "
     "as a bare `724/724`, so the alias is the SHAPE — a lone ratio — and that is exactly "
     "as fragile as it sounds. It is here rather than exempted because a bare ratio is "
     "the block's single most-copied field and the one a reader's eye slides over."),

    # ── contract_check.py ─────────────────────────────────────────────────────────────
    ("contract.checks", r"\bcontract\b", 2, ("python3", "../scripts/contract_check.py"), HOST,
     r"^CHECKS_RUN (\d+)/(\d+) reached their own end", CHEAP, REQUIRED,
     "`CHECKS_RUN n/n`. Both halves, because the pair going equal-but-smaller is a check "
     "that quietly stopped being reached — 196 §2's datum, which is the whole reason the "
     "line prints a ratio instead of a count."),

    # ── floor_pin_gate.py ─────────────────────────────────────────────────────────────
    ("floor_pin.targets", r"\bfloor_?pin\b", 1, ("python3", "scripts/floor_pin_gate.py"), ROOT,
     r"^FLOOR_PIN_GATE targets=(\d+)", LOCKED, REQUIRED,
     "the swept floors. `floor_pin 89`."),
    ("floor_pin.governed", r"\bgoverned\b", 1, ("python3", "scripts/floor_pin_gate.py"), ROOT,
     r"^FLOOR_PIN_LEDGER (\d+) governed size constant", LOCKED, REQUIRED,
     "the SIZE_LEDGER rows. `37 governed`."),
    ("floor_pin.literal", r"^(?!.*wire).*\bkeys?\b", 1, ("python3", "scripts/floor_pin_gate.py"), ROOT,
     r"^FLOOR_PIN_LITERAL (\d+) constant key", LOCKED, REQUIRED,
     "🔴 **THE ROW THIS FILE WAS BUILT FOR.** Wrong in 232's block and wrong again in "
     "233's, the second time in the session that caught the first. The negative "
     "lookahead keeps it off `wire_diff_key`'s `17 keys`, which is a different counter "
     "wearing the same noun — and that collision is why the binder refuses ambiguity "
     "instead of taking the first match (`resolve_sig`'s doctrine, 193 §12.27)."),
    ("floor_pin.shortfall", r"\bshortfalls?\b", 1, ("python3", "scripts/floor_pin_gate.py"), ROOT,
     r"^FLOOR_PIN_SHORTFALL (\d+) shortfall refusal", LOCKED, REQUIRED,
     "the shortfall refusals read. `25 shortfalls`."),
    ("floor_pin.unswept", r"\bunswept\b", 1, ("python3", "scripts/floor_pin_gate.py"), ROOT,
     r"^FLOOR_PIN_DISCOVERED unswept=(\d+)", LOCKED, REQUIRED,
     "the DISCOVER half's residue. `unswept 0`."),
    ("floor_pin.exempt", r"\bexempt\b", 1, ("python3", "scripts/floor_pin_gate.py"), ROOT,
     r"^FLOOR_PIN_DISCOVERED unswept=\d+ exempt=(\d+)", LOCKED, REQUIRED,
     "the DISCOVER half's exemption table. `exempt 36`."),

    # ── terminology_gate.py ───────────────────────────────────────────────────────────
    ("term.swept", r"\bterm\b", 2, ("python3", "scripts/terminology_gate.py"), ROOT,
     r"^TERMINOLOGY ok — (\d+) file\(s\) swept.*?every one of the (\d+) tracked suffix",
     CHEAP, REQUIRED,
     "files swept and suffixes reached. `term 275 file(s) / 21 suffixes` — two numbers "
     "on one atom, which 233 built the second half of and is the field most likely to "
     "be restated as one."),

    # ── the .mjs instruments ──────────────────────────────────────────────────────────
    ("taut.sites", r"\btaut\b", 1, ("node", "scripts/tautology_gate.mjs"), HOST,
     r"^TAUT_GATE ok — (\d+) claim site", CHEAP, REQUIRED,
     "claim sites read. `taut 4046`."),
    ("seal.count", r"\bseal\b", 1, ("node", "scripts/seal_order_gate.mjs"), HOST,
     r"^SEAL_ORDER_GATE ok — (\d+) seal\(s\)", CHEAP, REQUIRED,
     "section seals. `seal 103`."),
    ("boundary.judged", r"\bboundary\b", 4, ("node", "scripts/boundary_gate.mjs"), HOST,
     r"judged=(\d+)/\d+.*?\nBOUNDARY_GATE_PERFILE.*?\nBOUNDARY_GATE_DISCOVER (\d+) \.gd "
     r"walked · (\d+) dispatcher-shaped · \d+ plane\(s\) · (\d+) exempt",
     CHEAP, REQUIRED,
     "🆕 233's DISCOVER half, and the block spells it `boundary 185 judged / DISCOVER "
     "8-2-0` — four numbers in one atom across two printed lines. Read together because "
     "233 §5.3's argument is that the judged total and the walk are the same claim seen "
     "from two sides; a session restating one and not the other is the drift."),
    ("wire_diff.key", r"\bwire_?diff", 4, ("node", "scripts/wire_diff.mjs", "--discover"), HOST,
     r"^WIRE_DIFF_KEY (\d+) tool\(s\) · (\d+) schema node\(s\) · (\d+) distinct key\(s\)"
     r".*?· (\d+) problem\(s\)", CHEAP, REQUIRED,
     "🆕 233's `--discover`. `wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread` "
     "— the block's word is `unread` and the gate's is `problem(s)`; they are the same "
     "number and this row is the only place that is written down."),
    ("wire_invisible.cases", r"\bwire_?invisible\b", 1,
     ("node", "scripts/wire_invisible_gate.selftest.mjs"), HOST,
     r"^WIRE_INVISIBLE_SELFTEST (\d+)/\d+ claims", CHEAP, REQUIRED,
     "🔴 THE SELF-TEST'S CASES, NOT THE GATE'S ROSTER, and 234 had to reconstruct that "
     "from the two spellings to be sure. `wire_invisible 27 + live` reads like a live "
     "population and is not one: the live roster is 1 row over 292 tools and 310 "
     "refinements. 231 spelled it `27 cases + live ok`, which was the unambiguous "
     "version, and the abbreviation lost the word that made it checkable."),

    # ── lint_ceiling.py ───────────────────────────────────────────────────────────────
    ("lint.files", r"\blint_?ceiling\b", 1, ("python3", "scripts/lint_ceiling.py"), ROOT,
     r"^LINT_CEILING pyflakes over (\d+) tracked \.py file", CHEAP, REQUIRED,
     "🔴 READ OFF THE HEADER LINE, WHICH PRINTS ON A REFUSAL TOO — deliberately. 234 §5 "
     "found this gate cannot tell `pyflakes` clean from `pyflakes` absent: with the "
     "module missing it reports `0 finding(s)`, refuses on STALE_CLASS, and offers three "
     "candidate causes, none of them the real one. The file count is honest either way, "
     "so this row keeps working while that defect is open, and says so."),

    # ── the CI surface ────────────────────────────────────────────────────────────────
    ("ci.checks", r"\bCI\b", 1, None, ROOT, "", CHEAP, REQUIRED,
     "🔴 THE ONE COUNTER NO INSTRUMENT PRINTS, so this row derives it (`ci_check_runs`) "
     "rather than exempting it. `26 CI jobs` is the number of check runs a PR reports, "
     "and it is neither the job count (18) nor the matrix expansion (28): it is the "
     "expansion minus the workflows that are schedule-only. 234 had to reconstruct that "
     "to verify one field of 233's block, which is precisely the reconstruction a reader "
     "should never have to do twice."),

    # ── the counters 227–232 carried and 233 did not ─────────────────────────────────
    #
    # 🔴 THE ROSTER'S OWN DISCOVER HALF, AND ITS POPULATION IS SEVEN REAL BLOCKS RATHER
    # THAN A MEMORY. Built against 233 alone, this roster read 23 of 23 atoms and looked
    # complete; run over 227–232 it left eleven claims unreadable across four instruments
    # it had never heard of. A roster complete for the block in front of it is 224 §7.6's
    # shape — a sweep whose file set is curated reports zero for the files somebody
    # thought of — so the population is every counter that has appeared in a real status
    # block, and the five rows below are what that walk found. All OPTIONAL: they are
    # absent from 233 for the good reason that its session did not run those instruments,
    # and a REQUIRED row here would redden every correct handoff that omits one.
    ("mutlock.guarded", r"\bmutlock\b", 2,
     ("python3", "scripts/mutation_lock_gate.py", "--selftest"), ROOT,
     r"floor=\d+ live=(\d+)[\s\S]*?MUTATION_LOCK selftest ok — (\d+) case", LOCKED, OPTIONAL,
     "🔴 THE ATOM IS SPELLED THREE WAYS ACROSS THREE SESSIONS — `mutlock 5/6/2` in 229, "
     "`mutlock 5 + 9 cases` in 230 and 231 — and the first draft of this row read only "
     "the leading number, so it refused 234's own block for claiming two. **The gate "
     "caught its author's handoff on the first run against it**, which is the outcome that "
     "makes the file worth its lines. Both numbers come from `--selftest`, which prints "
     "the live guarded count and its own cases, so one command answers the whole atom."),
    ("tree_quiet.cases", r"\btree_?quiet\b", 1, ("python3", "scripts/tree_quiet.py", "--selftest"),
     ROOT, r"^TREE_QUIET selftest ok — (\d+) case", LOCKED, OPTIONAL,
     "`tree_quiet 13` — the self-test's cases. The live run prints a verdict and no "
     "count, so the block's number has only ever been the self-test's."),
    # 🔴 THE ALIAS CARRIES 227's SPELLING, WHICH NAMES NO INSTRUMENT AT ALL. `61
    # rows/33 refusals` is the same claim as 230's `release_names 61/33` with the subject
    # dropped — a counter identified only by its nouns. Widening to the nouns is not
    # generosity: an atom nothing binds is reported UNREADABLE, and a session reading that
    # about a field it wrote correctly learns to stop running the gate.
    ("release_names.rows", r"\brelease_?names\b|\brows\b.*\brefusals?\b", 2,
     ("python3", "scripts/release_names.py", "--selftest"), ROOT,
     r"(\d+) rows · (\d+) REFUSE", CHEAP, OPTIONAL,
     "🔴 `61 rows/33 refusals`, AND IT HAS TO BE THE SELF-TEST. The live half refuses "
     "without `--version --previous --date --bump`: it reads a RELEASED block, so between "
     "cuts there is nothing for it to read. A row pointed at the live command would have "
     "reported the counter UNMEASURED on every session that did not cut a release, which "
     "is most of them."),
    # 🔴 ANCHORED AT THE START OF THE ATOM, AND THE BINDER'S AMBIGUITY REFUSAL IS WHY.
    # The first draft was `\bdiscover\b`, which also matches 233's `boundary 185 judged /
    # DISCOVER 8-2-0` — two instruments' discover halves, one word. The roster's own
    # walk introduced the collision and the run that added it refused, which is the fourth
    # time this session a rule caught code from its own commit.
    ("instrument.discover", r"^discover\b", 4, ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE_DISCOVER (\d+) file\(s\) walked · (\d+) export-bearing · (\d+) "
     r"instrument\(s\) · (\d+) gate/driver", MUTATING, OPTIONAL,
     "🆕 232's discover half. `discover 48/12/12/18` — four numbers, no nouns, and the "
     "fourth has since moved to 22, which is what a counter restated as a bare tuple "
     "costs a later reader."),
    ("instrument.undeclared", r"\bundeclared\b", 1, ("python3", "scripts/instrument_gate.py"),
     ROOT, r"· (\d+) UNDECLARED", MUTATING, OPTIONAL,
     "`0 undeclared` — 232 gave it its own atom, which is the right shape: it is the "
     "discover half's whole verdict and burying it inside a tuple would hide the one "
     "number that can go non-zero."),

    # ── this file ─────────────────────────────────────────────────────────────────────
    ("handoff.claims", r"\bhandoff\b", 1, ("python3", "scripts/handoff_gate.py", "--selftest"),
     ROOT, r"^HANDOFF_SELFTEST (\d+)/\d+ claims", CHEAP, OPTIONAL,
     "🔴 THE READER IS IN ITS OWN ROSTER, AND IT HAS TO BE. This file's argument is that "
     "a counter no gate reads back is an unasked question; a session restating "
     "`handoff 87 claims` while nothing compared it would be the same defect one file "
     "further out, committed by the file that names it. The subprocess runs `--selftest`, "
     "which measures nothing and returns before this roster is consulted, so the "
     "self-reference terminates — and it terminating is a property worth stating rather "
     "than one worth discovering."),

    # ── instrument_gate.py · scope_gate.py · control_gate.py — MUTATING ───────────────
    ("scope.enumerators", r"\bscope\b", 1, ("python3", "scripts/scope_gate.py"), ROOT,
     r"(\d+) enumerator\(s\)", MUTATING, REQUIRED,
     "`scope 25`. MUTATING — supplied by --measured."),
    ("control.controls", r"\bcontrol\b", 1, ("python3", "scripts/control_gate.py"), ROOT,
     r"(\d+) control\(s\)", MUTATING, REQUIRED,
     "`control 59`. MUTATING — supplied by --measured."),
    ("instrument.across", r"\binstrument\b", 1, ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE instruments=(\d+)", MUTATING, REQUIRED,
     "🔴 `instrument ok across 13` IS A SENTENCE THE GATE DOES NOT PRINT. It prints "
     "`INSTRUMENT_GATE instruments=13 floor=8` on its first line and `across 13 "
     "instrument(s)` inside BLAST_TOTAL's; the block's phrasing is a session's synthesis "
     "of the two. Bound to the roster line, because that is the one whose subject is the "
     "population — and the synthesis is why a reader anchored on the handoff's own words "
     "would have found nothing to compare against."),
    ("instrument.late_live", r"\blate_?live\b", 2, ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE_LATE_LIVE (\d+)/(\d+)", MUTATING, OPTIONAL,
     "🆕 233 — `LATE_LIVE 13/8`. OPTIONAL because the axis is new: 227–232's blocks "
     "predate it and would redden on a REQUIRED row for a counter that did not exist. "
     "🔴 A ROW THAT STAYS OPTIONAL AFTER ITS COUNTER IS UNIVERSAL IS THIS FILE'S OWN "
     "STALE-REASON CLASS (233 §18) — promote it once 234 and later are the population."),
    ("instrument.crashed", r"\bcrash", 1, ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE_CRASHED (\d+)/\d+", MUTATING, OPTIONAL,
     "`0 crashes`. OPTIONAL for the same reason as `late_live` — 227–231 do not carry it."),
    ("instrument.blast", r"\bblast\b(?!.*\blate\b)", 1, ("python3", "scripts/instrument_gate.py"),
     ROOT, r"^INSTRUMENT_GATE_BLAST_TOTAL (\d+)", MUTATING, OPTIONAL,
     "🔴 `blast 1383` IS A TOTAL AND 232's `blast 33/28` IS A SINGLE INSTRUMENT'S PAIR — "
     "the same word for two different measurements, one session apart. This row reads the "
     "TOTAL, which is what 233 meant, and the lookahead keeps it off `late blast`. That "
     "two blocks can spell incompatible things identically is the argument for binding on "
     "a pattern and then REFUSING ambiguity rather than resolving it."),
    ("instrument.not_loaded", r"not-?loaded", 1, ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE_LATE_NOT_LOADED (\d+)/\d+", MUTATING, OPTIONAL,
     "`late not-loaded 0`. OPTIONAL — 233 is the first block to carry it."),
]


def ci_check_runs(root: Path = ROOT) -> "tuple[int, list[str]]":
    """(check runs a PR reports, the workflows that do not contribute and why).

    🔴 THE THREE NUMBERS THIS COULD RETURN ARE ALL DEFENSIBLE AND ONLY ONE IS THE CLAIM.
    18 job keys; 28 with the `matrix` legs expanded; 26 once the schedule-only workflows
    are dropped. The block says 26 and the PR says `26/26 green`, so the claim is check
    RUNS ON A PULL REQUEST — which means a workflow's TRIGGERS are part of the count, and
    a reader that stopped at the job keys would agree with a tree that had just moved
    every integration job onto a nightly schedule.
    """
    total, skipped = 0, []
    for wf in sorted((root / ".github" / "workflows").glob("*.y*ml")):
        txt = wf.read_text(encoding="utf-8")
        head = txt.split("\njobs:", 1)[0]
        if not re.search(r"^\s*(pull_request|push)\s*:", head, re.M):
            skipped.append(f"{wf.name} (no pull_request/push trigger)")
            continue
        m = re.search(r"^jobs:\s*$", txt, re.M)
        if m is None:
            skipped.append(f"{wf.name} (no jobs: block)")
            continue
        body = txt[m.end():]
        starts = [(mm.start(), mm.group(1))
                  for mm in re.finditer(r"^  ([A-Za-z0-9_-]+):\s*$", body, re.M)]
        for i, (pos, _name) in enumerate(starts):
            blk = body[pos:starts[i + 1][0] if i + 1 < len(starts) else len(body)]
            legs = 1
            if "matrix" in blk:
                for arr in re.findall(r"^\s{6,}[A-Za-z0-9_-]+:\s*\[([^\]]*)\]\s*$", blk, re.M):
                    n = len([x for x in arr.split(",") if x.strip()])
                    if n:
                        legs *= n
            total += legs
    return total, skipped


# ── THE PARSER ────────────────────────────────────────────────────────────────────────

def status_block(text: str) -> "tuple[list[str], str]":
    """(the fenced status block's lines, problem). The first ``` fence inside the
    leading blockquote — the block every handoff since 227 opens with.
    """
    lines = text.split("\n")
    fence = [i for i, ln in enumerate(lines) if ln.strip() in ("> ```", ">```", "```")]
    if len(fence) < 2:
        return ([], "no fenced status block — the handoff does not open with one, or the "
                    "fence moved out from under this reader, and a parser that returned "
                    "an empty block here would agree with every claim in the file")
    body = lines[fence[0] + 1:fence[1]]
    return ([re.sub(r"^>\s?", "", ln) for ln in body], "")


def counter_atoms(block: "list[str]") -> "tuple[list[str], str]":
    """(the `·`-separated atoms of the VERIFIED line and its continuations, problem)."""
    start = next((i for i, ln in enumerate(block) if VERIFIED_RE.match(ln)), None)
    if start is None:
        return ([], "no VERIFIED line in the status block — every block since 227 carries "
                    "one and a session that dropped it would be reporting nothing while "
                    "this reader reported no disagreements")
    joined = " ".join(block[start:])
    joined = re.sub(r"^\s*(?:[🟢🔴🆕]\s*)?\*{0,2}VERIFIED(?:\s+AFTER\s+THE\s+CHANGE)?\*{0,2}",
                    "", joined, flags=re.U)
    atoms = [a.strip(" *`") for a in joined.split("·")]
    return ([a for a in atoms if a and COUNTER_RE.search(a)], "")


def bind(atom: str) -> "tuple[str, str]":
    """(the reader key this atom claims, problem) — exactly one of the two is empty.

    🔴 AMBIGUITY IS REFUSED, NOT RESOLVED, and `floor_pin.literal` vs `wire_diff.key` is
    why: both atoms carry the word `keys`. A binder that took the first match would
    compare 233's `807 keys` against the wire's 17 and report a disagreement in the wrong
    field, which is worse than reporting none — it would send the next session to fix a
    counter that was right. `resolve_sig`'s two-match branch, one document over.
    """
    hits = [key for key, alias, *_ in COUNTER_READERS
            if re.search(alias, atom, re.I)]
    if not hits:
        return ("", f"{atom!r} binds to NO reader — a claim in the status block that "
                    f"nothing in this tree can check. Either the field was renamed out "
                    f"from under its row, or it is a counter no instrument prints and it "
                    f"needs one before it is worth restating")
    if len(hits) > 1:
        return ("", f"{atom!r} binds to {len(hits)} readers ({', '.join(hits)}) — a "
                    f"binder that picked one would compare the right number against the "
                    f"wrong counter. Narrow the aliases; do not resolve by order")
    return (hits[0], "")


def measure(keys: "set[str]", log: str, run_cheap: bool, run_slow: bool, run_locked: bool
            ) -> "tuple[dict[str, tuple[int, ...]], list[str], list[str]]":
    """(measured counters, unmeasured keys, notes). `log` is a captured run, searched
    first; anything it does not carry is run live when its cost allows.
    """
    out: "dict[str, tuple[int, ...]]" = {}
    unmeasured: "list[str]" = []
    notes: "list[str]" = []
    cache: "dict[tuple[str, ...], str]" = {}
    for key, _alias, n, cmd, cwd, extract, cost, _need, _why in COUNTER_READERS:
        if key not in keys:
            continue
        if key == "ci.checks":
            total, skipped = ci_check_runs()
            out[key] = (total,)
            for s in skipped:
                notes.append(f"ci.checks excludes {s}")
            continue
        m = re.search(extract, log, re.M | re.S) if log else None
        if m is None and cmd is not None and (
                (cost == CHEAP and run_cheap) or (cost == SLOW and run_slow)
                or (cost == LOCKED and run_locked)):
            if cost == LOCKED and cmd not in cache:
                notes.append(f"{key}: running `{' '.join(cmd)}` — LOCKED, it takes "
                             f"`_gate_lock` and restores the tree on every exit path")
            if cmd not in cache:
                p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
                cache[cmd] = p.stdout + p.stderr
            m = re.search(extract, cache[cmd], re.M | re.S)
            if m is None:
                notes.append(f"{key}: ran `{' '.join(cmd)}` and its pattern matched "
                             f"nothing — the instrument's own line moved")
        if m is None:
            unmeasured.append(key)
            continue
        got = tuple(int(g) for g in m.groups())
        if len(got) != n:
            notes.append(f"{key}: reader declares {n} number(s), pattern returned {len(got)}")
        out[key] = got
    return out, unmeasured, notes


def check(handoff: Path, log: str, run_cheap: bool, run_slow: bool,
          run_locked: bool
          ) -> "tuple[list[str], list[str], int, int]":
    """(problems, notes, atoms read, counters compared)."""
    problems: "list[str]" = []
    block, why = status_block(handoff.read_text(encoding="utf-8"))
    if why:
        return ([f"🔴 {why}"], [], 0, 0)
    atoms, why = counter_atoms(block)
    if why:
        return ([f"🔴 {why}"], [], 0, 0)

    bound: "dict[str, tuple[str, tuple[int, ...]]]" = {}
    for atom in atoms:
        key, why = bind(atom)
        if why:
            problems.append(f"🔴 UNREADABLE CLAIM — {why}")
            continue
        bound[key] = (atom, tuple(int(x) for x in COUNTER_RE.findall(atom)))

    # ── the second direction: a counter the block DROPPED ─────────────────────────────
    for key, _alias, _n, _cmd, _cwd, _ex, _cost, need, why in COUNTER_READERS:
        if need == REQUIRED and key not in bound:
            problems.append(f"🔴 DROPPED COUNTER — `{key}` has a reader and this block "
                            f"does not claim it. Nothing else in this tree would notice "
                            f"a status block quietly ceasing to report a field. ({why})")

    measured, unmeasured, notes = measure(set(bound), log, run_cheap, run_slow,
                                         run_locked)

    compared = 0
    for key, (atom, claimed) in sorted(bound.items()):
        if key not in measured:
            continue
        got = measured[key]
        compared += 1
        if claimed != got:
            row = next(r for r in COUNTER_READERS if r[0] == key)
            problems.append(
                f"🔴 {key} — the block says {list(claimed)}, the tree says {list(got)}\n"
                f"     atom: {atom!r}\n"
                f"     {row[8]}")

    for key in sorted(unmeasured):
        row = next(r for r in COUNTER_READERS if r[0] == key)
        problems.append(f"🔴 UNMEASURED — `{key}` ({row[6]}) was claimed and not read "
                        f"back. Supply a run with --measured, or --slow to run it here. "
                        f"Green over an unread counter is this file's own subject.")

    if len(atoms) < CLAIM_FLOOR:
        problems.append(f"🔴 CLAIM_FLOOR — {len(atoms)} atom(s) parsed, floor {CLAIM_FLOOR}. "
                        f"A parse this thin agrees with everything it failed to read.")
    if len(COUNTER_READERS) < READER_FLOOR:
        problems.append(f"🔴 READER_FLOOR — {len(COUNTER_READERS)} reader(s), floor "
                        f"{READER_FLOOR}.")
    return (problems, notes, len(atoms), compared)


# ── THE SELF-TEST ─────────────────────────────────────────────────────────────────────
#
# 🔴 THE NUMERAL PINS ARE BOTH DIRECTIONS AND THE NEGATIVE HALF IS THE ONE THAT MATTERS.
# check 11's table earned its letter guards from a live refusal (`cl100k_base`) and its
# full-stop guard from a positive control, and this scanner is that one widened to every
# digit-run — so it inherits both hazards and adds SHAs, which are the status block's
# most common token and are hexadecimal.
NUMERAL_PINS: "list[tuple[str, tuple[int, ...], str]]" = [
    ("724/724", (724, 724), "the bare ratio — both halves, no label"),
    ("floor_pin 89", (89,), "label then number"),
    ("unswept 0", (0,), "🔴 ZERO IS A COUNTER. A truthiness test anywhere in this reader "
                        "drops `unswept 0` and `0 crashes` — the two atoms whose whole "
                        "job is to be zero — and the gate goes quiet on exactly the "
                        "fields a bad session would move first"),
    ("26 CI jobs", (26,), "number then label"),
    ("LATE_LIVE 13/8", (13, 8), "a population over its floor"),
    ("boundary 185 judged / DISCOVER 8-2-0", (185, 8, 2, 0),
     "🔴 FOUR NUMBERS IN ONE ATOM, and the hyphens must not read as one token"),
    ("wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread", (292, 3474, 17, 0),
     "four numbers, four nouns, one of them `keys` — the collision `floor_pin.literal` "
     "narrows against"),
    ("c27953d — the excuses the tree contradicted (#287)", (287,),
     "🔴 THE SHA MUST YIELD NOTHING. `c27953d` carries `27953` and a scanner without the "
     "letter guards reads it as a counter; the PR number is a real numeral and is caught "
     "by the binder having no reader for it, not by the scanner refusing to see it"),
    ("host / addon 1.74.0 / 1.9.9", (),
     "🔴 VERSION STRINGS YIELD NOTHING — check 11's row, and the reason `1.9.9` is here "
     "as well as `1.74.0` is that a guard dropping only the FIRST dot still reads `9`"),
    ("npm 🟢 1.74.0 · lag 0 · tags 121", (0, 121),
     "the version drops out and the two real counters beside it survive"),
    ("342,113 B ≈ ~95,000 tokens", (),
     "221 §5.2's row — comma-grouped numbers are not ours, and neither half leaks"),
    ("the DAP client dials `:6006`", (6006,),
     "🔴 A PORT IS SEEN AND THEN REFUSED BY THE BINDER, not by the scanner. check 11 "
     "excludes it by digit-width; this scanner cannot, and pretending otherwise would "
     "put a silent width rule where a visible binding failure belongs"),
    ("cl100k_base", (), "224's live refusal — a digit-run welded to letters is an identifier"),
]

BIND_PINS: "list[tuple[str, str, str]]" = [
    ("807 keys", "floor_pin.literal", "🔴 THE ROW THIS FILE EXISTS FOR"),
    ("wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread", "wire_diff.key",
     "🔴 THE COLLISION. Carries `keys` and must NOT reach `floor_pin.literal`"),
    ("blast 1383", "instrument.blast", "the total"),
    ("late not-loaded 0", "instrument.not_loaded",
     "🔴 CARRIES `late` AND MUST NOT REACH `instrument.late_live`"),
    ("724/724", "host.suite", "the unlabelled ratio"),
    ("contract 23/23", "contract.checks", "a ratio with a label"),
    ("unswept 0", "floor_pin.unswept", ""),
    ("exempt 36", "floor_pin.exempt", ""),
    ("term 275 file(s) / 21 suffixes", "term.swept", ""),
    ("26 CI jobs", "ci.checks", "the derived counter"),
    ("wire_invisible 27 + live", "wire_invisible.cases", "233's spelling"),
    ("wire_invisible 27 cases + live ok", "wire_invisible.cases",
     "🔴 231's SPELLING OF THE SAME CLAIM — the drift the alias exists to absorb"),
    ("instrument ok across 13", "instrument.across", ""),
    ("scope 25", "scope.enumerators", ""),
    ("control 59", "control.controls", ""),
    ("lint_ceiling 15 files", "lint.files", ""),
    ("taut 4046", "taut.sites", ""),
    ("seal 103", "seal.count", ""),
    ("floor_pin 89", "floor_pin.targets", ""),
    ("37 governed", "floor_pin.governed", ""),
    ("25 shortfalls", "floor_pin.shortfall", ""),
    ("boundary 185 judged / DISCOVER 8-2-0", "boundary.judged",
     "🆕 233's DISCOVER half, four numbers in one atom"),
    ("LATE_LIVE 13/8", "instrument.late_live",
     "🔴 CARRIES `late` AND `live` AS ONE TOKEN — the atom `late not-loaded 0` must not "
     "reach this row and this one must not reach that row; the pair is the reason both "
     "aliases are anchored on more than the word `late`"),
    ("0 crashes", "instrument.crashed",
     "🔴 A COUNTER WHOSE CORRECT VALUE IS ZERO, bound by its noun and not its number"),
    ("mutlock 5 + 9 cases", "mutlock.guarded", "230 and 231's spelling"),
    ("mutlock 5/6/2", "mutlock.guarded",
     "🔴 229's SPELLING OF THE SAME FIELD, and it is a different tuple — the binder is "
     "the same, the comparison is not, and only the leading number survives both"),
    ("tree_quiet 13", "tree_quiet.cases", ""),
    ("handoff 87 claims", "handoff.claims", "🔴 THE READER READING ITSELF"),
    ("release_names 61/33", "release_names.rows", "230 and 231's spelling"),
    ("61 rows/33 refusals", "release_names.rows",
     "🔴 227's SPELLING, WHICH NAMES NO INSTRUMENT — bound by its nouns or not at all"),
    ("discover 48/12/12/18", "instrument.discover",
     "🔴 MUST NOT REACH `boundary.judged`, whose atom also carries the word DISCOVER"),
    ("0 undeclared", "instrument.undeclared", ""),
    ("blast 33/28", "instrument.blast",
     "🔴 232's SPELLING, WHICH MEANT SOMETHING ELSE. One instrument's pair, not the "
     "total 233 reports under the same word. The binder cannot tell them apart and does "
     "not try — it binds the atom and the COMPARISON is what fails, loudly, in the field "
     "rather than silently in the alias"),
]

# 🔴 THE POSITIVE CONTROL HISTORY WROTE, AND IT IS THE ONLY FIXTURE HERE THAT COULD NOT
# HAVE BEEN INVENTED. The same counter, in three consecutive real status blocks, against
# three real commits: 231 restated it correctly, 232 copied its base's value forward, and
# 233 — the session that found 232's copy and wrote the paragraph about it — printed a
# value the tree has never held. A control asserting this reader calls the first green
# and the other two red is a control nobody could tune to pass, because the inputs are
# already written down and the answers are already in git.
HISTORY_PINS: "list[tuple[str, int, int, str]]" = [
    ("231", 707, 707, "🟢 correct — `30a2045` squashed to `741e717`, which reads 707"),
    ("232", 707, 747, "🔴 the copy 233 caught — `ce34b87`'s tree reads 747"),
    ("233", 807, 814, "🔴 the copy 233 MADE, in the field it had just written the "
                      "paragraph about — `191eca9` reads 814, and 807 is a value no "
                      "commit in this repository has ever produced"),
]


# 🔴 233's COUNTER LINE, VERBATIM. Not a fixture somebody invented to pass: the real
# input, carrying the real defect, in the real shape — 23 atoms across four continuation
# lines, two numbers in one atom twice and four in another twice. It is what pins
# `CLAIM_FLOOR` from ABOVE; the small block below pins it from BELOW, and between them a
# floor moved in either direction reddens.
REAL_BLOCK = """> ```
> main                 c27953d — the excuses the tree contradicted (#287)          MOVED +2
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
>               · late not-loaded 0 · floor_pin 89 · 37 governed · 807 keys
>               · 25 shortfalls · unswept 0 · exempt 36 · term 275 file(s) / 21 suffixes
>               · taut 4046 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 15 files · 26 CI jobs
> ```
"""


def selftest() -> int:
    claims = failed = 0

    for text, expected, why in NUMERAL_PINS:
        claims += 1
        got = tuple(int(x) for x in COUNTER_RE.findall(text))
        if got != expected:
            failed += 1
            print(f"  🔴 NUMERAL {text!r} -> {got}, pinned {expected} — {why}")

    for atom, expected, why in BIND_PINS:
        claims += 1
        key, problem = bind(atom)
        if key != expected:
            failed += 1
            print(f"  🔴 BIND {atom!r} -> {key or problem!r}, pinned {expected} — {why}")

    # every reader is reachable from at least one pin — a row nothing binds to is a
    # reader that could be deleted without a fixture noticing
    claims += 1
    covered = {bind(a)[0] for a, _e, _w in BIND_PINS}
    orphan = [k for k, *_ in COUNTER_READERS if k not in covered]
    if orphan:
        failed += 1
        print(f"  🔴 ROSTER {len(orphan)} reader(s) no BIND_PIN reaches: {orphan} — a row "
              f"with no fixture is a binding nothing would notice the loss of")

    # the aliases are mutually exclusive over the pinned atoms: refusing ambiguity is
    # only a guarantee if the roster is actually unambiguous on real input
    for atom, _e, _w in BIND_PINS:
        claims += 1
        hits = [k for k, alias, *_ in COUNTER_READERS if re.search(alias, atom, re.I)]
        if len(hits) != 1:
            failed += 1
            print(f"  🔴 AMBIGUOUS {atom!r} -> {hits}")

    # the parser, end to end, on a block shaped like the real ones
    claims += 1
    fixture = (
        "# Handoff — fixture\n\n> ```\n"
        "> main                 c27953d — the excuses the tree contradicted (#287)\n"
        "> host / addon         1.74.0 / 1.9.9   🟢 unmoved\n"
        "> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25\n"
        ">               · floor_pin 89 · 37 governed · 807 keys · unswept 0\n"
        "> ```\n")
    block, why = status_block(fixture)
    atoms, why2 = counter_atoms(block)
    if why or why2 or len(atoms) != 7:
        failed += 1
        print(f"  🔴 PARSE {why or why2 or f'{len(atoms)} atoms, pinned 7'} — {atoms}")

    # 🔴 THE HEADER LINES MUST NOT BECOME CLAIMS. The SHA and the version live above the
    # VERIFIED line, and a reader that swept the whole fence would bind them to nothing
    # and report two unreadable claims on every correct handoff — a gate that cries on
    # green, which is the failure that gets a gate switched off.
    claims += 1
    if any("c27953d" in a or "1.74.0" in a for a in atoms):
        failed += 1
        print(f"  🔴 SCOPE the header lines leaked into the counters: {atoms}")

    # a block with no VERIFIED line must refuse rather than agree
    claims += 1
    _atoms, why = counter_atoms(["main   c27953d", "host / addon  1.74.0 / 1.9.9"])
    if not why:
        failed += 1
        print("  🔴 QUIET a block with no VERIFIED line returned no problem")

    # 🔴 THE REAL BLOCK, WHOLE — every atom binds, and nothing in the header leaks
    claims += 1
    real, _w = status_block(REAL_BLOCK)
    real_atoms, _w2 = counter_atoms(real)
    unreadable = [a for a in real_atoms if bind(a)[0] == ""]
    if len(real_atoms) != 23 or unreadable:
        failed += 1
        print(f"  🔴 REAL {len(real_atoms)} atom(s), pinned 23; unreadable {unreadable}")

    # 🔴 CLAIM_FLOOR, PINNED FROM BOTH SIDES BY TWO REAL PARSES. Below: the four-line
    # fixture above, 7 atoms, which is what a block reduced to its headline counters
    # looks like and must NOT satisfy the floor. Above: 233's block, 23 atoms, which must.
    # Zeroing the floor fails the first claim; raising it past 23 fails the second — so
    # the value is asserted rather than merely present, which is 184 §7's rule.
    claims += 1
    if not (len(atoms) < CLAIM_FLOOR <= len(real_atoms)):
        failed += 1
        print(f"  🔴 CLAIM_FLOOR {CLAIM_FLOOR} is not in ({len(atoms)}, {len(real_atoms)}] "
              f"— a floor below the small fixture admits a parse that read almost nothing, "
              f"and one above a real block refuses every handoff ever written")

    # 🔴 READER_FLOOR, THE SAME WAY, AND THE LOWER BOUND IS THE LARGEST FAMILY. Six of
    # these rows read `floor_pin_gate.py`; if that family were lost the roster would still
    # look populated, so the floor must sit above what remains. Above: today's roster.
    claims += 1
    family = max(len([1 for k, *_ in COUNTER_READERS if k.split(".")[0] == f])
                 for f in {k.split(".")[0] for k, *_ in COUNTER_READERS})
    if not (len(COUNTER_READERS) - family < READER_FLOOR <= len(COUNTER_READERS)):
        failed += 1
        print(f"  🔴 READER_FLOOR {READER_FLOOR} is not in "
              f"({len(COUNTER_READERS) - family}, {len(COUNTER_READERS)}] — the lower "
              f"bound is the roster with its largest family ({family} rows) deleted")

    # 🔴 THE HISTORY CONTROL
    for sess, claimed, actual, why in HISTORY_PINS:
        claims += 1
        red = claimed != actual
        if red != (sess in ("232", "233")):
            failed += 1
            print(f"  🔴 HISTORY {sess} claimed {claimed}, tree {actual} — {why}")

    print(f"HANDOFF_SELFTEST {claims - failed}/{claims} claims, {failed} failed")
    return 1 if failed else 0


def tree_state(root: Path = ROOT) -> str:
    """`<sha> clean` or `<sha> DIRTY (n file(s))`.

    🔴 THE COMPARISON IS AGAINST THE TREE THIS RUNS ON, AND THAT IS NOT A DETAIL. Every
    counter here is a measurement of the working tree, and a handoff is a claim about the
    tree at ITS commit. Run against a later tree, correct blocks disagree — 234 hit this
    within a minute of writing the file, when `unswept 0` went red because THIS file's two
    new floors had joined the tree the DISCOVER half walks. A gate that printed neither
    the commit nor the dirt would have made that read as 233 having been wrong twice.
    """
    def git(*a: str) -> str:
        p = subprocess.run(("git", *a), cwd=root, capture_output=True, text=True)
        return p.stdout.strip()
    sha = git("rev-parse", "--short", "HEAD") or "?"
    dirt = [ln for ln in git("status", "--porcelain").split("\n") if ln.strip()]
    return f"{sha} clean" if not dirt else f"{sha} DIRTY ({len(dirt)} file(s))"


def main(argv: "list[str]") -> int:
    if "--selftest" in argv:
        return selftest()
    paths = [a for a in argv[1:] if not a.startswith("--")]
    if not paths:
        print(__doc__.strip().split("Run:")[-1])
        return 2
    handoff = Path(paths[0]).resolve()
    if not handoff.is_file():
        print(f"🔴 no such handoff: {handoff}")
        return 1
    log = ""
    if "--measured" in argv:
        log = Path(argv[argv.index("--measured") + 1]).read_text(encoding="utf-8")
    read_only = "--read" in argv

    if read_only:
        block, why = status_block(handoff.read_text(encoding="utf-8"))
        atoms, why2 = counter_atoms(block)
        if why or why2:
            print(f"🔴 {why or why2}")
            return 1
        for a in atoms:
            key, problem = bind(a)
            print(f"  {'🟢' if key else '🔴'} {a:<52} -> {key or problem}")
        print(f"HANDOFF_READ {len(atoms)} atom(s)")
        return 0

    problems, notes, n_atoms, compared = check(
        handoff, log, run_cheap="--no-run" not in argv, run_slow="--slow" in argv,
        run_locked="--no-locked" not in argv and "--no-run" not in argv)
    for n in notes:
        print(f"  · {n}")
    print(f"HANDOFF_GATE_TREE {tree_state()} — the counters below were measured HERE, and "
          f"a status block describes the tree it was written against")
    print(f"HANDOFF_GATE {handoff.name} · {n_atoms} atom(s) · {len(COUNTER_READERS)} "
          f"reader(s) · {compared} compared · floors {CLAIM_FLOOR}/{READER_FLOOR}")
    for p in problems:
        print(p)
    if problems:
        print(f"🔴 HANDOFF_GATE refused — {len(problems)} problem(s). A status block is a "
              f"table of claims about what the instruments printed, and it is the first "
              f"thing the next session stands on.")
        return 1
    print("🟢 HANDOFF_GATE ok — every counter in the status block binds to exactly one "
          "instrument, every required counter is present, and each one equals what that "
          "instrument printed on this tree")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
