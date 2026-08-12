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

Run:  python3 scripts/handoff_gate.py ../HANDOFF_SESSION235.md
      python3 scripts/handoff_gate.py ../HANDOFF_SESSION235.md --measured run.log
      python3 scripts/handoff_gate.py ../HANDOFF_SESSION235.md --measured run.log --network
      python3 scripts/handoff_gate.py ../HANDOFF_SESSION235.md --no-locked
      python3 scripts/handoff_gate.py --selftest
      python3 scripts/handoff_gate.py ../HANDOFF_SESSION235.md --read   (parse only)

🔴 THE MEASURED LOG'S ORDER IS NOT FREE — 235 §1. `host.suite` reads `# tests` and
`# pass` out of `npm test`'s own output, and the extract spans lines. It is linear now
and it was not: the shipped pattern was exponential in the lines AFTER the match, so a
log with `npm test` FIRST — the order 234 §6.1's replay prints — never returned, while
the same commands captured with `npm test` LAST answered in a millisecond. Both halves
are pinned by `--selftest` now (`EXTRACT_SHAPE`, `EXTRACT_BUDGET`), so the order no
longer matters; the note stays because the defect was invisible for exactly one reason,
which is that nobody ran the replay in the order the replay is written.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
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

# ── THE EXTRACT BUDGET ────────────────────────────────────────────────────────────────
#
# 🔴 235 §1 — THE READER HUNG ON THE ONLY LOG THAT COULD SATISFY IT, AND NOTHING WAS RED.
# `host.suite` is the one REQUIRED counter that cannot be run cheaply, so `--measured` is
# the only practical way to read it back — and the only log that carries `# tests` is
# `npm test`'s own output, which is 4,801 lines. Its extract was `^# tests (\d+)\n(?:.*\n
# )*?# pass (\d+)$` under `re.S`: a quantified group containing a quantifier over an atom
# that matched newlines. It answers in 80ms with 20 lines of trailing text, 5s with 26,
# and never with 30. 234 §6.1's replay prints `npm test` FIRST and the gate LAST; the
# session that wrote it captured them the other way round, which put `# pass` five lines
# from EOF and made an exponential pattern look instant. **The order in the replay block
# and the order in the run that verified it were not the same order.**
#
# So both directions, because the timing alone is a fact about one pattern and the shape
# is the class: `EXTRACT_SHAPE` refuses a nested quantifier in ANY extract, statically,
# and `EXTRACT_BUDGET_S` is a live reproduction of the one pattern that spans lines. A
# structural rule with no reproduction is a lint nobody trusts; a reproduction with no
# structural rule catches this pattern and not the next one.
EXTRACT_BUDGET_S = 2.0
EXTRACT_TRAILING_LINES = 4000

# a quantified GROUP whose body itself carries a quantifier — `(?:.*\n)*?`, `(\d+ )+`.
# This is the shape, not the flag: `re.S` is what let it reach across lines, but the
# exponent is the nesting, and a pattern with `[\s\S]*?` has none.
NESTED_QUANTIFIER_RE = re.compile(r"\((?:\?[:=!][^()]*|[^()?][^()]*)?[*+][^()]*\)\s*[*+]")

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

# 🔴 236 §2 — THE OLD SPELLING OF THIS PATTERN BEGAN `^\s*`, AND 235's OWN BLOCK
# HIJACKED IT. `counter_atoms` took the FIRST line matching, so a note whose text wrapped
# onto the word `VERIFIED` — 235 §3's *"the field sits ABOVE the / VERIFIED line"* —
# opened the counter line eleven lines early: the run swallowed three lines of prose,
# `724/724` ended up inside an atom that bound to nothing, and `host.suite` was reported
# DROPPED. The failure is noisy rather than silent, which is why 235 shipped the prose
# reworded and left the parser alone. The fix is not a better sentence: position is
# structural, so the anchor is column 0 and `_runs` decides what a line at column 0 is.
VERIFIED_RE = re.compile(r"^(?:[🟢🔴🆕]\s*)?\*{0,2}VERIFIED\b", re.U)


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
    # 🔴 235 §1 — THE `(?:.*\n)*?` THIS PATTERN SHIPPED WITH WAS EXPONENTIAL, AND IT IS
    # THE ONLY READER THAT SPANS LINES. `measure()` searches under `re.S`, so `.` matched
    # `\n` and the quantified group could partition the trailing text every possible way:
    # a NESTED quantifier over a newline-matching atom. Measured on `# tests 724\n# suites
    # 1\n# pass 724\n` plus N junk lines — 20 lines 0.08s, 24 lines 1.3s, 26 lines 5.0s,
    # 30 lines no answer in twenty minutes. `[\s\S]*?` is the same language with no
    # nesting, and it is linear: 5,000 trailing lines resolve in under a millisecond.
    ("host.suite", r"^\d+/\d+$", 2, ("npm", "test"), HOST,
     r"^# tests (\d+)$[\s\S]*?^# pass (\d+)$", SLOW, REQUIRED,
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
     r"^LINT_CEILING (?:pyflakes over |files=)(\d+)\b", CHEAP, REQUIRED,
     "🔴 236 §4 — THIS ROW USED TO READ ONE HEADER LINE AND CLAIM IT PRINTS ON BOTH "
     "PATHS, IN THE SESSION THAT GAVE THE INSTRUMENT A SECOND ONE. 235 §5 taught "
     "`lint_ceiling.py` to see an absent `pyflakes` and its refusal prints `LINT_CEILING "
     "files=16 floor=16` — not the `pyflakes over 16 tracked .py file(s)` this pattern "
     "was anchored on — so on every machine without the module the counter went UNREAD "
     "under a reason that pointed at the wrong file. Both spellings are read now, "
     "because the FILE COUNT is honest on both paths and that is what this row claims."),

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


# ── THE HEADER HALF ───────────────────────────────────────────────────────────────────
#
# 🔴 235 §3 — THE GATE'S OWN SCANNER SELF-TEST READS A LINE THE GATE NEVER CHECKS.
# `counter_atoms` starts at `VERIFIED`, so the four lines above it — main, branch, host /
# addon, npm — are parsed and dropped. `NUMERAL_PINS` nonetheless carries
# `("npm 🟢 1.74.0 · lag 0 · tags 121", (0, 121))`: a fixture proving the scanner reads
# exactly those two counters, in a file that then never asks anything about them.
#
# 234 EXCLUDED THAT HALF FOR A GOOD REASON AND THE REASON DOES NOT COVER ALL OF IT.
# The reason is written in this file's own self-test — *"a reader that swept the whole
# fence would bind them to nothing and report two unreadable claims on every correct
# handoff — a gate that cries on green."* True of SHAs, versions, PR numbers and session
# numbers, which no instrument prints and nobody can restate wrongly in the sense that
# matters. It is NOT true of `lag`, `tags` and `26/26 green`, which are counters in
# exactly the sense the VERIFIED line's are. So the header is read with its own roster
# and its own EXEMPT table, and the exclusion becomes a claim rather than a silence.
#
# 🔴 AND THE FIRST COUNTER IT READ WAS WRONG — MEASURED, NOT ARGUED. `tags 121` is the
# authoring machine's `git tag`. Origin has 115: six tags (v1.13.0, v1.15.0, v1.16.0,
# v1.17.0, v1.18.0, v1.18.1) exist only on that disk and were never pushed. Every block
# that carried the number carried a fact about one laptop on the line that describes the
# published package. 234 §4.8 named this class — *"any counter that reads GIT CONFIG,
# remotes, hooks or file modes is a fact about the clone"* — listed four kinds, did not
# list tags, and closed with the gap this table fills: *"nothing distinguishes the two
# classes of counter."*
TREE, CLONE, REMOTE = "TREE", "CLONE", "REMOTE"

# Every reader key's PROVENANCE — what the counter is a fact ABOUT. Asserted in both
# directions by the self-test: a key here with no reader is a stale row, a reader with no
# key here is a counter whose subject nobody declared.
PROVENANCE: "dict[str, str]" = {
    "npm.tags": REMOTE,     # origin's tag list — NOT `git tag`, which is CLONE and wrong
    "npm.lag": REMOTE,      # registry_lag.py dials npm
    "ci.green": TREE,       # derived from .github/workflows, like `ci.checks`
    "git.moved": TREE,      # `rev-list a..b` over two SHAs the block itself prints
    "gh.issues": REMOTE,    # GitHub's tracker — no local question has this answer
    "gh.prs": REMOTE,
}

# 🔴 THE TOKENS IN THE HEADER THAT ARE NOT COUNTERS, EACH WITH THE REASON IT IS NOT ONE.
# This is the table 234's excluding paragraph was standing in for, and unlike a paragraph
# it goes stale loudly: `HEADER_EXEMPT_UNUSED` refuses a row that matched nothing across
# the real blocks the self-test walks.
HEADER_EXEMPT: "list[tuple[str, str]]" = [
    (r"\(#\d+\)", "a PR number in a commit subject — GitHub assigns it, no instrument "
                  "prints it, and a session cannot restate it wrongly without the link "
                  "breaking visibly"),
    (r"\bPR #\d+\b", "the same number naming the branch's own PR"),
    (r"\bbranch \d+\b", "the session number — this file's own name, not a measurement"),
]

# 🔴 236 §3 — TWO ROWS LEFT THIS TABLE, AND BOTH REASONS WERE FALSE ABOUT THE BLOCK THEY
# WERE WRITTEN INTO. `MOVED +n` was exempt because *"the gate runs on ONE tree and this
# counter needs the previous one"* — and the previous tree's SHA is printed on the main
# row's own continuation line, two lines above the exemption, in every block since 227.
# `n open issues` was exempt because *"`gh` can answer it and this gate has no reader
# that does"*, which is a true sentence about the file and a description of a missing
# twenty lines rather than of a counter that cannot be read. 235 §25 named the class —
# *"a reason covering PART of its population reads exactly like a reason covering all of
# it"* — and this is the same shape once more: an exemption whose reason describes the
# READER's state, not the counter's nature. Both are read now.

# 🔴 AND THE FIRST DRAFT OF THE PARAGRAPH ABOVE CLAIMED THIS GATE DIALS NOTHING, WHILE
# THE FUNCTION TWENTY LINES DOWN CALLED `git ls-remote`. That is 234 §4.1 exactly — an
# exclusion written as a property of the file by the author of the code that breaks it,
# in the session whose whole subject is claims the tree contradicts — and it was caught
# by running the network half with the network off rather than by re-reading the
# sentence. So `NETWORK` is a declared cost class: it dials, it is NOT run by default,
# `--network` asks for it, and a run that did not do it says so instead of implying the
# comparison held.
NETWORK = "NETWORK"


# 🔴 A FENCE LINE THAT OPENS WITH A STATUS EMOJI AT COLUMN 0 IS A NOTE, NOT A ROW, AND
# THE FIRST RUN OF THIS HALF PROVED THE DISTINCTION IS LOAD-BEARING. 234's block carries
# seven lines of prose between the npm row and `VERIFIED` — *"807 keys is a value this
# tree has never held … 741e717 -> 707"* — every one of them full of numerals that are
# citations of OTHER trees. Read as claims they produced nine UNREADABLE refusals on a
# block that was correct, which is the gate-that-cries-on-green this half was warned
# about one function up. The rule is structural rather than a vocabulary: rows start at
# column 0 with a label, notes start at column 0 with a verdict, and indented lines
# continue whichever came last.
NOTE_RE = re.compile(r"^[🟢🔴🟡🆕]", re.U)

ROW, NOTE, COUNTER = "ROW", "NOTE", "COUNTER"


def _split_atoms(lines: "list[str]") -> "list[str]":
    """The `·`-separated atoms of a run, with its VERIFIED marker removed."""
    joined = re.sub(r"^\s*(?:[🟢🔴🆕]\s*)?\*{0,2}VERIFIED(?:\s+AFTER\s+THE\s+CHANGE)?\*{0,2}",
                    "", " ".join(lines), flags=re.U)
    return [a for a in (x.strip(" *`") for x in joined.split("·")) if a]


def _runs(block: "list[str]") -> "list[tuple[str, list[str]]]":
    """[(kind, lines)] — the block split into runs, structurally and with no vocabulary.

    🔴 235 NEXT 3 — ONE CLASSIFICATION, READ BY BOTH HALVES. 235 built the note/row split
    for the header and left `counter_atoms` scanning for the first line matching
    `VERIFIED_RE` anywhere, so the two halves disagreed about where the header ended: a
    prose line that WRAPPED onto the word `VERIFIED` opened the counter line inside a
    note, and the same block was parsed one way above and another way below. There is
    only one rule now and it is about position: a line at column 0 OPENS a run — COUNTER
    if the marker is there rather than merely mentioned, NOTE if it opens with a verdict
    emoji, ROW otherwise — and an INDENTED line continues whatever run came last.
    """
    runs: "list[tuple[str, list[str]]]" = []
    for line in block:
        if not line.strip():
            continue
        if line[:1] in (" ", "\t") and runs:
            runs[-1][1].append(line)
            continue
        kind = (COUNTER if VERIFIED_RE.match(line)
                else NOTE if NOTE_RE.match(line) else ROW)
        runs.append((kind, [line]))
    return runs


def counter_run(block: "list[str]") -> "tuple[list[str], str]":
    """(the counter line and its continuations, problem) — exactly one is empty.

    🔴 A CANDIDATE THAT CARRIES NO COUNTERS IS NOT THE COUNTER LINE, and two that do is
    an ambiguity this file refuses rather than resolves — `bind`'s rule, one level up.
    Taking the first would be the same defect the position rule just fixed, arriving
    through a different door.
    """
    live = [(kind, lines) for kind, lines in _runs(block) if kind == COUNTER
            and any(COUNTER_RE.search(a) for a in _split_atoms(lines))]
    if not live:
        opened = [ln for kind, lines in _runs(block) if kind == COUNTER
                  for ln in lines[:1]]
        if opened:
            return ([], f"the VERIFIED line carries no counters at all: {opened[0]!r} — "
                        f"a block whose counter line is empty is claiming nothing, and a "
                        f"parser that returned zero atoms here would agree with it")
        return ([], "no VERIFIED line in the status block — every block since 227 carries "
                    "one and a session that dropped it would be reporting nothing while "
                    "this reader reported no disagreements")
    if len(live) > 1:
        return ([], f"{len(live)} lines in this block open a counter run "
                    f"({', '.join(ln[0][:40] for _k, ln in live)}) — a parser that took "
                    f"the first would read half the claims and call the block checked")
    return (live[0][1], "")


def header_rows(block: "list[str]") -> "tuple[list[str], list[str]]":
    """(the labelled rows above the counter line, the note lines) — see `_runs`."""
    rows: "list[str]" = []
    notes: "list[str]" = []
    for kind, lines in _runs(block):
        if kind == COUNTER:
            break
        (notes if kind == NOTE else rows).extend(lines)
    return (rows, notes)


def header_atoms(block: "list[str]") -> "tuple[list[tuple[str, str]], set[str]]":
    """([(atom as written, atom with every exempt token removed)], patterns that fired).

    The labelled rows above `VERIFIED`, split the same way the counter line is. An atom
    whose every numeral is covered by `HEADER_EXEMPT` carries no claim and is not
    returned — and the CLEANED text is what the comparison reads, because `PR #288
    MERGED, 26/26 green` carries three numerals and only two of them are a counter.
    """
    rows, _notes = header_rows(block)
    atoms: "list[tuple[str, str]]" = []
    fired: "set[str]" = set()
    for line in rows:
        for raw in re.split(r"·|\s{3,}", line):
            atom = raw.strip(" *`,")
            if not atom or not COUNTER_RE.search(atom):
                continue
            kept = atom
            for pat, _why in HEADER_EXEMPT:
                if re.search(pat, kept):
                    fired.add(pat)
                    kept = re.sub(pat, " ", kept)
            if COUNTER_RE.search(kept):
                atoms.append((atom, kept))
    return (atoms, fired)


def clone_tags(root: Path = ROOT) -> int:
    """How many tags THIS checkout holds — offline, and the number the block claims."""
    p = subprocess.run(("git", "tag"), cwd=root, capture_output=True, text=True)
    return len([ln for ln in p.stdout.split("\n") if ln.strip()])


def origin_tags(root: Path = ROOT) -> "tuple[int, list[str], str]":
    """(tags origin holds, the ones only in this checkout, problem) — NETWORK.

    🔴 THE ONLY READER HERE THAT OPENS A SOCKET, AND IT IS THE ONE THAT FOUND THE DEFECT.
    `git tag` answers *what does this disk have*; the npm line is read as *what has this
    project published*. On the authoring machine those differ by six, and no amount of
    reading the tree could have told anyone — the divergence is not IN the tree. That is
    why this is a network call rather than a cleverer local one: there is no local
    question whose answer is the remote's tag list, and a proxy that was right on a fresh
    clone and wrong on the machine that writes the handoffs would be worse than nothing.
    """
    try:
        p = subprocess.run(("git", "ls-remote", "--tags", "origin"), cwd=root,
                           capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError) as e:
        return (-1, [], f"could not reach origin: {e}")
    if p.returncode != 0:
        return (-1, [], f"`git ls-remote` exited {p.returncode}: "
                        f"{(p.stderr or '').strip()[:200]}")
    remote = {ln.rsplit("refs/tags/", 1)[-1].strip() for ln in p.stdout.split("\n")
              if "refs/tags/" in ln and not ln.rstrip().endswith("^{}")}
    local = subprocess.run(("git", "tag"), cwd=root, capture_output=True, text=True)
    only_here = sorted(t.strip() for t in local.stdout.split("\n")
                       if t.strip() and t.strip() not in remote)
    return (len(remote), only_here, "")


# 🔴 A HEX RUN WITH NO DIGIT IN IT IS AN ENGLISH WORD. `deadbeef`, `facade`, `decade` and
# `added` are all `[0-9a-f]+`, and the main row is a SHA followed by a commit subject —
# so the second "SHA" a bare hex pattern finds is whichever word of the subject line
# happens to be spelled in hex. The digit is what makes it an identifier; a real short
# SHA with no digit at all is one run in seventy thousand, and it fails LOUDLY here (the
# row reads as carrying one endpoint) rather than quietly comparing the wrong interval.
SHA_RE = re.compile(r"\b(?=[0-9a-f]{7,40}\b)[0-9a-f]*\d[0-9a-f]*\b")


def moved_interval(block: "list[str]", root: Path = ROOT) -> "tuple[int, str]":
    """(commits between the two SHAs on the main row, problem) — TREE, offline.

    🔴 235 NEXT 6 SAID THIS COUNTER NEEDS THE PREVIOUS TREE AND THE GATE HAS ONE TREE.
    Both halves are true and the conclusion was not: the interval's other endpoint is
    printed by the block itself, on the main row's continuation line, because every
    block since 227 lists the commit main moved FROM directly under the one it moved TO.
    A clone holds both objects, so `rev-list old..new` answers it with no network, no
    previous handoff, and no second checkout — and the exemption was standing in for a
    reader nobody had tried to write.
    """
    run = next((lines for kind, lines in _runs(block)
                if kind == ROW and lines[0].startswith("main")), None)
    if run is None:
        return (-1, "no `main` row in this block")
    shas = [s for ln in run for s in SHA_RE.findall(ln)]
    if len(shas) < 2:
        return (-1, f"the main row carries {len(shas)} SHA(s) and an interval needs two "
                    f"— the commit main moved TO, and the one it moved FROM on the "
                    f"continuation line under it")
    new, old = shas[0], shas[1]
    p = subprocess.run(("git", "rev-list", "--count", f"{old}..{new}"),
                       cwd=root, capture_output=True, text=True)
    if p.returncode != 0:
        return (-1, f"`git rev-list {old}..{new}` exited {p.returncode}: "
                    f"{(p.stderr or '').strip()[:120]} — this checkout does not hold "
                    f"both commits, which is a fact about the clone and not about the "
                    f"claim")
    return (int(p.stdout.strip() or 0), "")


def gh_open(kind: str, root: Path = ROOT) -> "tuple[int, str]":
    """(open issues or PRs on origin, problem) — NETWORK.

    🔴 AN ABSENT TOOL IS NOT A ZERO, AND THAT IS THIS SESSION'S OTHER FINDING (236 §4).
    235 §5 taught `lint_ceiling.py` that `pyflakes` missing and a clean tree are
    different observations; a reader that shelled out to `gh` and read the length of an
    empty parse would make exactly that mistake on the counter whose correct value is
    almost always 0. Every failure path here returns a problem, and a problem prints
    UNREAD rather than agreeing with the block.
    """
    try:
        p = subprocess.run(("gh", kind, "list", "--state", "open", "--json", "number",
                            "-L", "200"), cwd=root, capture_output=True, text=True,
                           timeout=60)
    except FileNotFoundError:
        return (-1, "`gh` is not installed for this run — the tool never ran, which is "
                    "not the same observation as zero open items")
    except (OSError, subprocess.SubprocessError) as e:
        return (-1, f"`gh {kind} list` could not run: {e}")
    if p.returncode != 0:
        first = next((ln for ln in (p.stderr or p.stdout).split("\n") if ln.strip()), "")
        return (-1, f"`gh {kind} list` exited {p.returncode}: {first.strip()[:160]}")
    try:
        return (len(json.loads(p.stdout or "[]")), "")
    except ValueError as e:
        return (-1, f"`gh {kind} list --json` did not return JSON: {e}")


# (key, alias, n, extract-from-log, reason). The header's roster is separate from
# `COUNTER_READERS` on purpose: these counters are not read off an instrument's stdout in
# the same way, they have different provenance, and folding them in would have put CLONE
# and REMOTE rows under `READER_FLOOR`, which governs the VERIFIED line's population.
HEADER_READERS: "list[tuple[str, str, int, str, str]]" = [
    ("npm.tags", r"\btags?\b", 1, r"^ORIGIN_TAGS (\d+)$",
     "🔴 THE COUNTER THIS HALF WAS BUILT FOR, AND IT IS READ OFF ORIGIN RATHER THAN OFF "
     "THE DISK. `git tag` answers *what does this checkout hold* — 121 on the authoring "
     "machine, 115 in a fresh clone — and a reader that compared against THAT would "
     "agree with 234's block on one machine and refuse it on another, which is the "
     "disease rather than the cure. The npm line describes the published package, so "
     "the population is origin's tags: 115, on every machine, including the six that "
     "were never pushed."),
    ("npm.lag", r"\blag\b", 1, r"^\s*distance (\d+)",
     "`registry_lag.py`'s `distance n` — tags newer than what npm has published. REMOTE, "
     "read out of the instrument's own output rather than dialed from here."),
    ("ci.green", r"\d+/\d+ green", 2, "",
     "`26/26 green` on the branch line is the same derivation `ci.checks` already does "
     "for the VERIFIED line's `26 CI jobs`, restated as a ratio — so it is checked "
     "against the same reader, and both halves must equal it."),
    ("git.moved", r"\bMOVED\b", 1, "",
     "🆕 `MOVED +1` — commits between the SHA main moved FROM and the one it moved TO, "
     "both of which the block prints on the main row. It was exempt until 236 for a "
     "reason that described the gate rather than the counter; `rev-list old..new` is "
     "TREE, offline, and the same number in every clone."),
    ("gh.issues", r"\bopen issues\b", 1, r"^GH_OPEN_ISSUES (\d+)$",
     "🆕 `0 open issues` — NETWORK, `gh issue list --state open`. A counter whose "
     "correct value is almost always zero is the one an absent tool imitates perfectly, "
     "so every failure path prints UNREAD with the reason rather than a number."),
    ("gh.prs", r"\bopen PRs\b", 1, r"^GH_OPEN_PRS (\d+)$",
     "🆕 `0 open PRs` — the same reader against `gh pr list`. Separate row rather than a "
     "pair in one, because the block prints them as two atoms and a reader that read "
     "both from one call would report a disagreement in whichever field came first."),
]

HEADER_FLOOR = 2   # governed by floor_pin_gate's SIZE_LEDGER


def check_header(block: "list[str]", log: str, run_network: bool
                 ) -> "tuple[list[str], list[str], int, int]":
    """(problems, notes, atoms read, counters compared) for the lines above VERIFIED."""
    problems: "list[str]" = []
    notes: "list[str]" = []
    atoms, fired = header_atoms(block)

    compared = 0
    for raw, cleaned in atoms:
        hits = [r for r in HEADER_READERS if re.search(r[1], cleaned, re.I)]
        if not hits:
            problems.append(
                f"🔴 UNREADABLE HEADER CLAIM — {raw!r} carries a counter this half has "
                f"no reader for and no `HEADER_EXEMPT` row covers. Either give it a "
                f"reader, or declare in `HEADER_EXEMPT` what kind of thing it is and why "
                f"no instrument prints it.")
            continue
        if len(hits) > 1:
            problems.append(f"🔴 {raw!r} binds to {len(hits)} header readers "
                            f"({', '.join(h[0] for h in hits)}) — narrow the aliases")
            continue
        key, _alias, n, extract, why = hits[0]
        claimed = tuple(int(x) for x in COUNTER_RE.findall(cleaned))
        got: "tuple[int, ...] | None" = None
        if key == "ci.green":
            total, _skipped = ci_check_runs()
            got = (total, total)
        elif key == "git.moved":
            n_moved, prob = moved_interval(block)
            if prob:
                notes.append(f"git.moved: UNREAD — {prob}")
                continue
            got = (n_moved,)
        elif key in ("gh.issues", "gh.prs"):
            # NETWORK, and the log is read FIRST so a session that already ran `gh` does
            # not have to dial again — the same shape `npm.tags` uses for ORIGIN_TAGS.
            if extract and log and (m := re.search(extract, log, re.M)) is not None:
                got = tuple(int(g) for g in m.groups())
            elif run_network:
                n_open, prob = gh_open("issue" if key == "gh.issues" else "pr")
                if prob:
                    notes.append(f"{key}: UNREAD — {prob}")
                    continue
                got = (n_open,)
        elif key == "npm.tags":
            # 🔴 NETWORK, AND UNREAD IS NOT GREEN. The clone's count is reported beside
            # it because the difference IS the finding, but it is never the comparison.
            if run_network:
                n_remote, only_here, prob = origin_tags()
                if prob:
                    notes.append(f"npm.tags: origin unreachable — {prob}")
                else:
                    got = (n_remote,)
                    local = clone_tags()
                    if only_here:
                        notes.append(
                            f"npm.tags: this checkout holds {local}, origin {n_remote}; "
                            f"{len(only_here)} tag(s) exist only here and were never "
                            f"pushed: {', '.join(only_here)}. 234 §4.8's class, one "
                            f"counter over — the number on the npm line is origin's.")
                    else:
                        notes.append(f"npm.tags: clone and origin agree at {n_remote}")
            elif extract and log and (m := re.search(extract, log, re.M)) is not None:
                got = tuple(int(g) for g in m.groups())
        elif extract and log and (m := re.search(extract, log, re.M)) is not None:
            got = tuple(int(g) for g in m.groups())
        if got is None:
            if key == "npm.tags":
                unread = (f"pass --network, or supply `ORIGIN_TAGS <n>` in the measured "
                          f"log. This checkout reads {clone_tags()} and that is a fact "
                          f"about the checkout, not the claim on the npm line")
            elif key in ("gh.issues", "gh.prs"):
                unread = (f"pass --network to ask `gh`, or supply "
                          f"`{'GH_OPEN_ISSUES' if key == 'gh.issues' else 'GH_OPEN_PRS'}"
                          f" <n>` in the measured log. Nothing in the tree answers it")
            else:
                unread = "no --measured log carries it"
            notes.append(f"{key}: UNREAD — {unread}")
            continue
        compared += 1
        if len(claimed) != n or claimed != got:
            problems.append(
                f"🔴 {key} — the block says {list(claimed)}, the tree says {list(got)}\n"
                f"     atom: {raw!r}\n     {why}")

    # both directions on the exemption table — a row that matched nothing is a reason
    # nobody re-derived, which is 233 §18's class and the one this file keeps committing
    for pat, why in HEADER_EXEMPT:
        if pat not in fired:
            notes.append(f"HEADER_EXEMPT unused on this block: {pat} ({why[:60]}…)")

    if len(atoms) < HEADER_FLOOR:
        problems.append(f"🔴 HEADER_FLOOR — {len(atoms)} header atom(s), floor "
                        f"{HEADER_FLOOR}. Every block since 227 carries an npm line with "
                        f"`lag` and `tags` on it; a parse that found fewer has stopped "
                        f"reading the header rather than found a block without one.")
    return (problems, notes, len(atoms), compared)


# ── 🔴 236 §1 — THE REPLAY, WHICH IS A CLAIM ABOUT A PROCEDURE ────────────────────────
#
# 235 §24: *"an instrument that works is not an instrument that runs … ask of every
# instrument: has anyone executed the procedure as written, rather than a procedure that
# resembles it?"* — written one section above a replay that cannot be executed as
# written. 235 §8.1 prints `npm test | tail -20 > run.log`, then runs the three MUTATING
# gates to the TERMINAL, then `handoff_gate.py --measured run.log`. Ten of the block's
# counters come only from those three, `run.log` cannot carry them, and the last command
# of the printed ritual refuses with ten UNMEASURED. Verified by running it: the refusal
# is this session's first output.
#
# So the same fix as §1's, one document out. The finding is not that 235 was careless —
# it caught this exact class in 234 and wrote the paragraph about it — but that a replay
# is PROSE, and prose about what a procedure does goes stale silently while the tree
# beside it is checked in both directions. This is the replay, checked: every counter the
# roster can only get from a log has to reach that log, and the file the gate is told to
# read has to be the file the ritual wrote.
REPLAY_MEASURED_RE = re.compile(r"handoff_gate\.py[^\n]*?--measured\s+(\S+)")


def fenced(text: str) -> "list[str]":
    """Every ``` fenced block's body, in order."""
    out: "list[str]" = []
    cur: "list[str]" = []
    inside = False
    for line in text.split("\n"):
        if line.strip().startswith("```"):
            if inside:
                out.append("\n".join(cur))
                cur = []
            inside = not inside
            continue
        if inside:
            cur.append(line)
    return out


def replay_problems(text: str) -> "tuple[list[str], list[str]]":
    """(problems, notes) for the handoff's own replay block.

    🔴 THE POPULATION IS THE FENCE, NOT THE DOCUMENT, AND THE FIRST DRAFT GOT IT WRONG IN
    THE WAY THIS FILE KEEPS GETTING THINGS WRONG. Scanning every line made a handoff that
    QUOTES the previous session's broken replay — which is what a handoff reporting this
    defect does — read as a document that RUNS it, and 236's own §1 reddened §9's correct
    replay by citing the line it was correcting. Prose about a command is not the command.
    """
    problems: "list[str]" = []
    notes: "list[str]" = []
    blocks = [b for b in fenced(text) if REPLAY_MEASURED_RE.search(b)]
    text = blocks[-1] if blocks else text
    hits = REPLAY_MEASURED_RE.findall(text)
    if not hits:
        if "handoff_gate.py" in text:
            notes.append("replay: the document runs `handoff_gate.py` with no "
                         "`--measured`, so every MUTATING counter it claims is UNREAD")
        else:
            notes.append("replay: this document prints no `handoff_gate.py` invocation — "
                         "a handoff nobody runs the gate against is unchecked, and the "
                         "next session cannot tell which it is")
        return (problems, notes)
    log = hits[-1].strip("`'\"")
    base = log.rsplit("/", 1)[-1]
    lines = [ln for ln in text.split("\n") if base in ln]

    for key, _alias, _n, cmd, _cwd, _ex, cost, _need, _why in COUNTER_READERS:
        if cost not in (MUTATING, SLOW) or cmd is None:
            continue
        token = next((c.rsplit("/", 1)[-1] for c in reversed(cmd)
                      if c.endswith((".py", ".mjs"))), " ".join(cmd))
        printed = [ln for ln in text.split("\n")
                   if token in ln and "handoff_gate.py" not in ln]
        if not printed:
            problems.append(
                f"🔴 REPLAY — `{key}` is {cost}: this gate never runs it, and the replay "
                f"does not run it either. The block's counter came from somewhere the "
                f"document does not print, which is a procedure nobody can repeat.")
        elif not any(base in ln for ln in printed):
            problems.append(
                f"🔴 REPLAY — `{key}` is {cost} and its counter can ONLY come from "
                f"`--measured {log}`, but every line running `{token}` sends its output "
                f"to the terminal. Run as written, the last command of this replay "
                f"refuses with `{key}` UNMEASURED. Route it into {base} "
                f"(`| tee -a {base}`, or `>> {base}`).")

    # 🔴 THE FIRST WRITE MAY TRUNCATE AND NO LATER ONE MAY, and the index that matters is
    # among the lines that ROUTE — 235's §1 discusses `--measured run.log` in prose three
    # sections above the replay, and a rule counting raw mentions would have called the
    # replay's own first redirect a clobber of a sentence.
    routing = [i for i, ln in enumerate(lines)
               if re.search(rf">>?\s*\S*{re.escape(base)}", ln)
               or re.search(rf"\btee\s+(?:-a\s+)?\S*{re.escape(base)}", ln)]
    truncating = [i for i, ln in enumerate(lines)
                  if re.search(rf">(?!>)\s*\S*{re.escape(base)}", ln)
                  or re.search(rf"\btee\s+(?!-a)\S*{re.escape(base)}", ln)]
    late = [i for i in truncating if routing and i != routing[0]]
    if late:
        problems.append(
            f"🔴 REPLAY — {base} is TRUNCATED by a later line ({lines[late[0]].strip()[:70]!r}) "
            f"after an earlier line had already written to it. Everything captured "
            f"before it is gone by the time the gate reads the file, and the counters it "
            f"carried go UNMEASURED with no sign that they were ever measured.")
    return (problems, notes)


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
    """(the `·`-separated atoms of the counter line and its continuations, problem)."""
    lines, why = counter_run(block)
    if why:
        return ([], why)
    return ([a for a in _split_atoms(lines) if COUNTER_RE.search(a)], "")


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
    cache: "dict[tuple[str, ...], tuple[int, str]]" = {}
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
                try:
                    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
                    cache[cmd] = (p.returncode, p.stdout + p.stderr)
                except FileNotFoundError as e:
                    cache[cmd] = (-1, f"{e}")
            rc, printed = cache[cmd]
            m = re.search(extract, printed, re.M | re.S)
            if m is None:
                # 🔴 236 §4 — "THE INSTRUMENT'S OWN LINE MOVED" IS ONE CAUSE OF THREE AND
                # THIS READER USED TO PRINT IT FOR ALL OF THEM. The exit code was thrown
                # away, so an instrument that REFUSED — `lint_ceiling.py` on a machine
                # with no `pyflakes`, which is every fresh container 235's own practice
                # moves the gates into — was reported as a pattern that no longer
                # matches. That is 235 §5's defect exactly, one file out: a refusal with
                # a plausible reason that is not the live one, printed by the reader
                # written to catch it. The verdict was always right; only the reason was
                # wrong, and a wrong reason is what sends the next session to the wrong
                # file.
                first = next((ln for ln in printed.split("\n")
                              if ln.strip() and not ln.startswith(" ")), "")
                notes.append(
                    f"{key}: ran `{' '.join(cmd)}` and its pattern matched nothing — "
                    + ("the instrument's own line moved (it exited 0)" if rc == 0 else
                       f"IT EXITED {rc}, so this is a REFUSAL and not a moved line. "
                       f"First line: {first.strip()[:160]!r}"))
        if m is None:
            unmeasured.append(key)
            continue
        got = tuple(int(g) for g in m.groups())
        if len(got) != n:
            notes.append(f"{key}: reader declares {n} number(s), pattern returned {len(got)}")
        out[key] = got
    return out, unmeasured, notes


def check(handoff: Path, log: str, run_cheap: bool, run_slow: bool,
          run_locked: bool, run_network: bool = False
          ) -> "tuple[list[str], list[str], int, int, int, int]":
    """(problems, notes, atoms read, compared, header atoms, header compared)."""
    problems: "list[str]" = []
    text = handoff.read_text(encoding="utf-8")
    block, why = status_block(text)
    if why:
        return ([f"🔴 {why}"], [], 0, 0, 0, 0)
    atoms, why = counter_atoms(block)
    if why:
        return ([f"🔴 {why}"], [], 0, 0, 0, 0)
    r_problems, r_notes = replay_problems(text)
    problems.extend(r_problems)

    h_problems, h_notes, h_atoms, h_compared = check_header(block, log, run_network)
    problems.extend(h_problems)

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
    return (problems, notes + h_notes + r_notes, len(atoms), compared, h_atoms,
            h_compared)


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


# 🔴 234's HEADER, VERBATIM — FOUR LABELLED ROWS AND NINE LINES OF PROSE. Not a fixture
# shaped to pass: the prose is the reason `header_rows` exists, and every numeral in it
# (`741e717 -> 707`, `e9d6ba2 -> 747`, `-> 814`) is a citation of a tree that is not this
# one. The row half carries exactly three counters — `26/26 green`, `lag 0`, `tags 121` —
# and the last of them is wrong by six on the machine that wrote it.
REAL_HEADER = """> ```
> main                 bcc0b85 — the table that read itself back (#288)          MOVED +1
>                      c27953d — the excuses the tree contradicted (#287)
> branch 234           c5e124b session234-the-table-that-read-itself-back
>                      🟢 PUSHED · PR #288 MERGED, 26/26 green, based on main (not stacked)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🔴 233's STATUS BLOCK WAS WRONG IN ONE FIELD — AND IT IS 232's FIELD, ONE SESSION LATER.
>    `807 keys` is a value this tree has never held. Measured at four points and
>    deterministic: 741e717 -> 707, e9d6ba2 -> 747, 191eca9 and c27953d -> 814.
> 🟢 EVERY OTHER FIELD OF 233's BLOCK HELD, including the twelve 234 had to derive.
> 🔴 TWO OF THEM COULD ONLY BE VERIFIED BY RECONSTRUCTION — `26 CI jobs` is neither the
>    job count nor the matrix expansion, and `wire_invisible 27 + live` is a SELF-TEST.
> 🟢 THE HANDOFF READER SHIPS. 29 readers · 106 atoms across 227–233 · 0 unreadable.
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
> ```
"""


# 🔴 235's OWN HEADER, WITH §3's NOTE AS IT WAS FIRST WRITTEN — the input that hijacked
# the parser, kept verbatim rather than reworded, because 235 shipped the PROSE changed
# and the reader unchanged and said so: *"the fix is structural and this session already
# built half of it … the prose was reworded to ship."* A fixture that used the reworded
# sentence would assert nothing.
HIJACK_HEADER = """> ```
> main                 7d6e9bf — the log the reader could not finish (#289)       MOVED +1
>                      bcc0b85 — the table that read itself back (#288)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 115 · 0 open issues · 0 open PRs
> 🔴 `tags 121` WAS THE EXCEPTION AND NOTHING COULD SEE IT — the field sits ABOVE the
>    VERIFIED line, and the reader started at it. Origin holds 115; six tags were
>    never pushed.
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · floor_pin 92 · 40 governed · 820 keys · 25 shortfalls
> ```
"""

# 🔴 235 §8.1's REPLAY, VERBATIM, AND IT IS THE NEGATIVE CONTROL. Every line is real and
# the block is captioned *"Replay, verified against the committed tree"*. Run in the
# order it prints, its last command refuses: `run.log` holds twenty lines of `npm test`
# and the three MUTATING gates above it printed to the terminal. Like `HISTORY_PINS`,
# this is an input nobody could tune to pass — it is already written down, and what it
# does is already known.
REAL_REPLAY = """```bash
cd host && npm ci --include=dev && npm run build
npm test | tail -20 > run.log                        # -> 724/724

python3 ../scripts/handoff_gate.py --selftest        # -> 133/133 claims, 0 failed
python3 ../scripts/contract_check.py         # -> ALL HARD CHECKS PASSED (23/23)

# the mutating three — one at a time (178 §11.4), in the CONTAINER
python3 ../scripts/instrument_gate.py   # -> instruments=13 · LATE_LIVE 13/8 · CRASHED 0/0
python3 ../scripts/scope_gate.py        # -> 25 enumerator(s)
python3 ../scripts/control_gate.py      # -> 59 control(s) · BLIND 34

# and the block above, read back off the instruments that printed it
python3 ../scripts/handoff_gate.py ../HANDOFF_SESSION235.md --measured run.log --network
```
"""

# The same ritual with the output routed where the gate is told to read it.
FIXED_REPLAY = """```bash
npm test | tail -20 > run.log                        # -> 724/724
python3 ../scripts/instrument_gate.py   | tee -a run.log
python3 ../scripts/scope_gate.py        | tee -a run.log
python3 ../scripts/control_gate.py      | tee -a run.log
python3 ../scripts/handoff_gate.py ../HANDOFF_SESSION236.md --measured run.log --network
```
"""

# 🔴 `lint_ceiling.py`'s TWO HEADER LINES, CAPTURED FROM THE TWO RUNS. Same tree, same
# command, same counter — one machine has `pyflakes` and one does not. 235 gave the
# instrument the second spelling and told this file's roster the header was unchanged.
LINT_HEADERS: "list[tuple[str, str]]" = [
    ("LINT_CEILING pyflakes over 16 tracked .py file(s) · floor 16 · 6 finding(s) in "
     "2 class(es) · 2 declared", "the module is installed"),
    ("LINT_CEILING files=16 floor=16", "🔴 THE REFUSAL PATH — 235 §5's own output, which "
     "the shipped pattern could not read, on every machine without pyflakes"),
]


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

    # ── 🔴 235 §1 — THE EXTRACT THAT COULD NOT FINISH ─────────────────────────────────
    #
    # Both halves, and neither is redundant. The SHAPE claim is static and covers every
    # reader including the ones nobody has written yet; the BUDGET claim is the live
    # reproduction, on the real pattern, against a log the real ritual really produces.
    # The shipped pattern fails both. A structural rule alone would have been a lint the
    # next author routed around; a reproduction alone would have pinned this pattern and
    # said nothing about the next reader that has to span lines.
    for key, _alias, _n, _cmd, _cwd, extract, *_rest in COUNTER_READERS:
        claims += 1
        if NESTED_QUANTIFIER_RE.search(extract):
            failed += 1
            print(f"  🔴 EXTRACT_SHAPE `{key}` — {extract!r} carries a quantified group "
                  f"whose body is itself quantified. `measure()` searches under re.S, so "
                  f"the inner atom matches newlines and the group can partition the "
                  f"trailing text every possible way: the search is exponential in the "
                  f"lines AFTER the match, and a log long enough never returns. Use a "
                  f"flat lazy span (`[\\s\\S]*?`) — same language, no nesting")

    # 🔴 THE REPRODUCTION, AND IT IS THE REAL LOG'S SHAPE. `npm test` prints `# tests`,
    # `# suites`, `# pass` and then nothing — but a session capturing one run log per
    # 234 §6.1's printed order puts every other gate's output AFTER it. That is the only
    # difference between the run that shipped green and the run that never returned.
    claims += 1
    pathological = ("# tests 724\n# suites 1\n# pass 724\n"
                    + "x\n" * EXTRACT_TRAILING_LINES)
    row = next(r for r in COUNTER_READERS if r[0] == "host.suite")
    t0 = time.monotonic()
    hit = re.search(row[5], pathological, re.M | re.S)
    spent = time.monotonic() - t0
    if hit is None or hit.groups() != ("724", "724") or spent > EXTRACT_BUDGET_S:
        failed += 1
        print(f"  🔴 EXTRACT_BUDGET host.suite took {spent:.3f}s over "
              f"{EXTRACT_TRAILING_LINES} trailing line(s), budget {EXTRACT_BUDGET_S}s, "
              f"-> {hit.groups() if hit else None} (pinned ('724', '724')). This is the "
              f"log 234 §6.1's replay produces when it is run in the order it prints.")

    # ── 🔴 235 §3 — THE HALF NOTHING READ ─────────────────────────────────────────────
    #
    # The fixture is 234's header VERBATIM, prose and all, because the prose is what the
    # first run of this half got wrong. Nine note lines full of numerals that cite OTHER
    # trees (`741e717 -> 707`) produced nine unreadable-claim refusals on a block that
    # was correct — so the note/row split is asserted on the real input, not on a shape
    # somebody invented after the rule was written.
    real_block, _hw = status_block(REAL_HEADER)
    rows, note_lines = header_rows(real_block)
    h_atoms, fired = header_atoms(real_block)

    claims += 1
    if len(note_lines) != 7 or any("STATUS BLOCK WAS WRONG" in r for r in rows):
        failed += 1
        print(f"  🔴 HEADER_NOTES {len(note_lines)} note line(s), pinned 7; a verdict "
              f"line at column 0 is prose and its indented continuations are prose — "
              f"rows: {rows}")

    claims += 1
    got_keys = sorted(
        next((r[0] for r in HEADER_READERS if re.search(r[1], cleaned, re.I)), f"?{raw}")
        for raw, cleaned in h_atoms)
    if got_keys != ["ci.green", "gh.issues", "gh.prs", "git.moved", "npm.lag", "npm.tags"]:
        failed += 1
        print(f"  🔴 HEADER_BIND {got_keys}, pinned ['ci.green', 'gh.issues', 'gh.prs', "
              f"'git.moved', 'npm.lag', 'npm.tags'] — atoms {h_atoms}")

    # 🔴 AND THE HEADER'S ALIASES MUST BE MUTUALLY EXCLUSIVE, which `check_header` does
    # assert on every run and nothing pinned until 236 widened the roster from three rows
    # to six. `MOVED` and `unmoved`, `open issues` and `open PRs` are one edit apart.
    for raw, cleaned in h_atoms:
        claims += 1
        hits = [k for k, alias, *_ in HEADER_READERS if re.search(alias, cleaned, re.I)]
        if len(hits) != 1:
            failed += 1
            print(f"  🔴 HEADER_AMBIGUOUS {raw!r} -> {hits}")

    # 🔴 THE COUNTER THE COMPARISON READS IS THE CLEANED ONE. `PR #288 MERGED, 26/26
    # green` carries three numerals; an exempt table that ran on the ATOM and a
    # comparison that ran on the RAW text would compare (288, 26, 26) against (26, 26)
    # and report a disagreement in a field that is correct — this file's own §1 lesson,
    # which is that a wrong red sends the next session to fix a right number.
    claims += 1
    ci_atom = next((c for r, c in h_atoms if "green" in c), "")
    if tuple(int(x) for x in COUNTER_RE.findall(ci_atom)) != (26, 26):
        failed += 1
        print(f"  🔴 HEADER_CLEAN {ci_atom!r} -> "
              f"{tuple(int(x) for x in COUNTER_RE.findall(ci_atom))}, pinned (26, 26)")

    # both directions on the exemption table, over the real block
    for pat, why in HEADER_EXEMPT:
        claims += 1
        if pat not in fired:
            failed += 1
            print(f"  🔴 HEADER_EXEMPT_UNUSED {pat} matched nothing in 234's header — an "
                  f"exemption nobody re-derives is 233 §18's class ({why[:50]}…)")

    # 🔴 AND NO EXEMPT ROW MAY SWALLOW A REAL COUNTER. The table removes text before the
    # comparison reads it, so a row too wide silently deletes a claim — the DROPPED
    # counter, arriving through the machinery built to declare things absent.
    for atom in ("tags 121", "lag 0", "26/26 green"):
        claims += 1
        kept = atom
        for pat, _why in HEADER_EXEMPT:
            kept = re.sub(pat, " ", kept)
        if not COUNTER_RE.search(kept):
            failed += 1
            print(f"  🔴 HEADER_EXEMPT_GREEDY {atom!r} was erased by the exempt table — "
                  f"a row wide enough to eat a counter deletes the claim silently")

    # PROVENANCE, both directions against the header roster
    claims += 1
    h_keys = {k for k, *_ in HEADER_READERS}
    missing = sorted(h_keys - set(PROVENANCE))
    stale = sorted(k for k in PROVENANCE if k not in h_keys)
    if missing or stale:
        failed += 1
        print(f"  🔴 PROVENANCE missing {missing}, stale {stale} — 234 §4.8 asked for "
              f"the two classes of counter to be distinguished, and a table that drifts "
              f"from its roster distinguishes nothing")

    # 🔴 AND `npm.tags` MUST NOT BE READ OFF THE CLONE. The whole finding is that `git
    # tag` answers a different question on every machine; a reader declared CLONE here
    # would be agreeing with 234's 121 on the laptop that wrote it.
    claims += 1
    if PROVENANCE.get("npm.tags") != REMOTE:
        failed += 1
        print(f"  🔴 PROVENANCE npm.tags is {PROVENANCE.get('npm.tags')}, pinned REMOTE "
              f"— origin's tag list is the same number on every machine and `git tag` "
              f"is not")

    # HEADER_FLOOR from both sides: the real header has three, a header stripped to its
    # version line has none, and the floor must sit between them
    claims += 1
    bare, _f = header_atoms(["main   abc1234 — a subject (#1)", "host / addon  1.0.0 / 2.0.0"])
    if not (len(bare) < HEADER_FLOOR <= len(h_atoms)):
        failed += 1
        print(f"  🔴 HEADER_FLOOR {HEADER_FLOOR} is not in ({len(bare)}, {len(h_atoms)}]")

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

    # ── 🔴 235 NEXT 3 — THE NOTE THAT HIJACKED THE COUNTER LINE ───────────────────────
    hij, _hw = status_block(HIJACK_HEADER)
    hij_atoms, hij_why = counter_atoms(hij)
    hij_rows, hij_notes = header_rows(hij)

    claims += 1
    if hij_why or len(hij_atoms) != 8 or bind(hij_atoms[0])[0] != "host.suite":
        failed += 1
        print(f"  🔴 HIJACK {hij_why or f'{len(hij_atoms)} atom(s), pinned 8'} — a prose "
              f"line wrapping onto the word VERIFIED opened the counter line early, "
              f"swallowed three lines of notes into the first atom and reported "
              f"`host.suite` DROPPED: {hij_atoms[:2]}")

    # the other half of the same defect: the header scan stopped at the hijacked line, so
    # the npm row above the REAL counter line went unread on a block that carried it
    claims += 1
    if len(hij_rows) != 4 or len(hij_notes) != 3 or not any("npm" in r for r in hij_rows):
        failed += 1
        print(f"  🔴 HIJACK_HEADER {len(hij_rows)} row(s)/{len(hij_notes)} note(s), "
              f"pinned 4/3 — rows {hij_rows}")

    # 🔴 AMBIGUITY IS REFUSED HERE TOO. Two counter runs in one block is a session that
    # pasted a second block; taking the first would read half the claims and call it done.
    claims += 1
    _a, two_why = counter_atoms(["🟢 VERIFIED   724/724 · scope 25",
                                 "🟢 VERIFIED AFTER THE CHANGE   contract 23/23"])
    claims += 1
    _b, empty_why = counter_atoms(["🟢 VERIFIED AFTER THE CHANGE", "main   c27953d"])
    if not two_why:
        failed += 1
        print("  🔴 TWO_COUNTER_LINES a block with two counter runs returned no problem")
    if not empty_why:
        failed += 1
        print("  🔴 EMPTY_COUNTER_LINE a VERIFIED line carrying no counters returned no "
              "problem — a parse of nothing agrees with everything")

    # ── 🔴 235 NEXT 6 — THE INTERVAL, AGAINST THE REAL COMMITS ────────────────────────
    #
    # 234's header names bcc0b85 and c27953d and claims `MOVED +1`. The exemption said
    # this needed the previous TREE; it needed the previous SHA, which the block prints.
    #
    # 🔴 AND THE FIRST VERSION OF THIS CLAIM WAS A CLAIM ABOUT THE MACHINE — 235 §6.3, ONE
    # SESSION LATER, IN THE SESSION THAT QUOTES IT. It asserted `rev-list` answers 1,
    # which is true on any full clone and false on CI, where `actions/checkout` fetches
    # one commit and neither endpoint exists. It went red there and nowhere else. So the
    # claim that survives is the same one 235 landed on: AGREEMENT. The PARSE half is
    # about the reader and holds everywhere; the LIVE half asserts a number where the
    # objects are and a REFUSAL where they are not, and never a number invented from one.
    claims += 1
    main_run = next((lines for kind, lines in _runs(real_block)
                     if kind == ROW and lines[0].startswith("main")), [])
    ends = [s for ln in main_run for s in SHA_RE.findall(ln)][:2]
    if ends != ["bcc0b85", "c27953d"]:
        failed += 1
        print(f"  🔴 MOVED_PARSE {ends}, pinned ['bcc0b85', 'c27953d'] — the endpoints "
              f"are the main row's own two SHAs, newest first")

    claims += 1
    have = all(subprocess.run(("git", "cat-file", "-e", f"{s}^{{commit}}"), cwd=ROOT,
                              capture_output=True).returncode == 0 for s in ends)
    got_moved, moved_why = moved_interval(real_block)
    if have and (moved_why or got_moved != 1):
        failed += 1
        print(f"  🔴 MOVED_LIVE {moved_why or got_moved}, pinned 1 — this checkout holds "
              f"both endpoints and `rev-list bcc0b85..c27953d` is 1")
    if not have and (not moved_why or got_moved != -1):
        failed += 1
        print(f"  🔴 MOVED_SHALLOW {got_moved}/{moved_why!r} — a checkout missing an "
              f"endpoint must make this UNREAD with the reason, not a number: a shallow "
              f"clone is a fact about the machine and the claim is about the interval")

    # 🔴 AND THE SUBJECT LINE MUST NOT SUPPLY THE SECOND ENDPOINT. A commit subject is
    # English, and English contains hex: a bare `[0-9a-f]{7,40}` reads `deadbeef` out of
    # the very sentence that names the commit, then compares an interval between a SHA
    # and a word.
    claims += 1
    decoy = ["main   7d6e9bf — the deadbeef the facade decade added (#289)   MOVED +1"]
    if SHA_RE.findall(decoy[0]) != ["7d6e9bf"]:
        failed += 1
        print(f"  🔴 SHA_WORDS {SHA_RE.findall(decoy[0])}, pinned ['7d6e9bf'] — a hex run "
              f"with no digit is a word, and the main row's second one decides `MOVED`")

    # and a main row with ONE sha is UNREAD rather than a number invented from one end
    claims += 1
    one_end, one_why = moved_interval(status_block(REAL_BLOCK)[0])
    if not one_why or one_end != -1:
        failed += 1
        print(f"  🔴 MOVED_ONE_END {one_end}/{one_why!r} — 233's header prints a single "
              f"SHA on the main row and an interval needs two")

    # ── 🔴 236 §4 — BOTH OF `lint_ceiling.py`'s HEADER LINES ──────────────────────────
    lint_extract = next(r[5] for r in COUNTER_READERS if r[0] == "lint.files")
    for header, why in LINT_HEADERS:
        claims += 1
        m = re.search(lint_extract, header, re.M | re.S)
        if m is None or m.groups() != ("16",):
            failed += 1
            print(f"  🔴 LINT_HEADER {header[:44]!r} -> "
                  f"{m.groups() if m else None}, pinned ('16',) — {why}")

    # ── 🔴 236 §1 — THE REPLAY THAT COULD NOT BE RUN AS WRITTEN ───────────────────────
    claims += 1
    real_problems, _rn = replay_problems(REAL_REPLAY)
    hit_keys = {k for k in ("scope.enumerators", "control.controls", "instrument.across")
                if any(f"`{k}`" in p for p in real_problems)}
    if hit_keys != {"scope.enumerators", "control.controls", "instrument.across"}:
        failed += 1
        print(f"  🔴 REPLAY_REAL 235 §8.1's replay produced {len(real_problems)} "
              f"problem(s) naming {sorted(hit_keys)} — it prints the three MUTATING "
              f"gates to the terminal and then tells the gate to read run.log")

    # 🔴 AND A HANDOFF THAT QUOTES THE BROKEN REPLAY IS NOT A HANDOFF THAT RUNS IT. This
    # is the shape of the document reporting the defect: 235's replay cited in §1, the
    # session's own corrected one in §9. The replay a handoff SHIPS is the last fenced
    # block carrying a `--measured` invocation; everything above it is prose about it.
    claims += 1
    quoting = ("## §1 — the replay 235 printed\n\n" + REAL_REPLAY
               + "\n## §9 — the replay this session ran\n\n" + FIXED_REPLAY)
    quoted_problems, _qn = replay_problems(quoting)
    if quoted_problems:
        failed += 1
        print(f"  🔴 REPLAY_QUOTED a handoff quoting the previous session's broken "
              f"replay above its own correct one was refused: {quoted_problems}")

    claims += 1
    fixed_problems, _fn = replay_problems(FIXED_REPLAY)
    if fixed_problems:
        failed += 1
        print(f"  🔴 REPLAY_FIXED a replay that routes every MUTATING gate into the "
              f"measured log still refused: {fixed_problems}")

    # 🔴 AND THE TRUNCATING REDIRECT, which is the same defect with the right commands in
    # the wrong order — everything captured before it is gone when the gate reads it.
    claims += 1
    clobber = FIXED_REPLAY.replace(
        "python3 ../scripts/handoff_gate.py ../HANDOFF_SESSION236.md",
        "npm test | tail -20 > run.log\npython3 ../scripts/handoff_gate.py "
        "../HANDOFF_SESSION236.md")
    if not any("TRUNCATED" in p for p in replay_problems(clobber)[0]):
        failed += 1
        print("  🔴 REPLAY_TRUNCATE a second `> run.log` after the appends was not "
              "refused — it deletes measurements that were really taken")

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

    problems, notes, n_atoms, compared, h_atoms, h_compared = check(
        handoff, log, run_cheap="--no-run" not in argv, run_slow="--slow" in argv,
        run_locked="--no-locked" not in argv and "--no-run" not in argv,
        run_network="--network" in argv)
    for n in notes:
        print(f"  · {n}")
    print(f"HANDOFF_GATE_TREE {tree_state()} — the counters below were measured HERE, and "
          f"a status block describes the tree it was written against")
    print(f"HANDOFF_GATE_HEADER {h_atoms} atom(s) above VERIFIED · {len(HEADER_READERS)} "
          f"reader(s) · {h_compared} compared · {len(HEADER_EXEMPT)} exempt · floor "
          f"{HEADER_FLOOR}")
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
