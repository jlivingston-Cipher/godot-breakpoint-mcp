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
      python3 scripts/handoff_gate.py --patterns [--measured run.log]   (237 §1)
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

import inspect
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
# 🔴 238 §2 — THE DISTINCT ATOM SPELLINGS THE TWELVE REAL BLOCKS CARRY. It floors the
# alias walk from BELOW, because `ALIAS_POPULATION` and `ALIAS_UNUSED` both go green on a
# population that stopped parsing and this one does not. 75 today; the value is the
# measurement and it only ever goes up, because the blocks it counts are already written.
# 🆕 239 — 71 -> 75, the move the ledger row predicted: a session added a block.
# 🆕 240 — 75 -> 76, the same move again: 239's block is the thirteenth.
ALIAS_SPELLING_FLOOR = 76
READER_FLOOR = 28        # governed by floor_pin_gate's SIZE_LEDGER

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
#        SINCE(n)  REQUIRED of blocks numbered n and later, OPTIONAL before — see below
CHEAP, LOCKED, SLOW, MUTATING = "CHEAP", "LOCKED", "SLOW", "MUTATING"
REQUIRED, OPTIONAL = "REQUIRED", "OPTIONAL"

# ── 🔴 237 §3 — OPTIONAL IS TWO CLAIMS WEARING ONE WORD ───────────────────────────────
#
# `release_names.rows` is OPTIONAL because a session that cut no release has nothing for
# that instrument to read: the counter is absent for a reason that recurs, and always
# will. `instrument.blast` was OPTIONAL because 227–231 predate the axis: absent for a
# reason that STOPPED being true in 232 and can never become true again. The first is a
# property of the counter; the second is a date, and a date written as a permanent
# exemption is 233 §18's stale reason with nothing to make it loud. 234 NEXT 6 named it,
# 235 and 236 carried it untouched, and the row that says so is `instrument.late_live`'s
# own reason — *"a row that stays OPTIONAL after its counter is universal is this file's
# own stale-reason class — promote it once 234 and later are the population."*
#
# 🔴 AND THE PROMOTION 236 §8.4 ASKED FOR WOULD HAVE BEEN WRONG BY ONE BLOCK IN TWO ROWS,
# BECAUSE IT WAS COUNTED FROM PROSE. *"Six readers are OPTIONAL because 227–232 predate
# their axes, and 236 is the fourth block in a row to carry all of them"* — measured over
# the real blocks, 232 carries `discover 48/12/12/18` and `0 undeclared` and **233 drops
# both**, so the run of blocks carrying all six is 234–236 and it is three long, not
# four. Two of the six are not new axes at all: they are counters a later session stopped
# restating, which is the DROPPED-counter direction this file exists to catch, and a
# blanket `REQUIRED` at 233 would have reddened a block that was correct about its own
# session. So the boundary is per row and it is the measurement, not the sentence.
SINCE_RE = re.compile(r"^SINCE (\d+)$")


def SINCE(n: int) -> str:
    """REQUIRED of blocks numbered n and later, OPTIONAL of the ones before it.

    `n` is the first session from which EVERY block carries the counter — not the session
    that introduced it. The two differ whenever a later block dropped the field, which is
    exactly the case a flat promotion gets wrong.
    """
    return f"SINCE {n}"


def needed(need: str, session: "int | None") -> str:
    """REQUIRED or OPTIONAL for the block in hand.

    🔴 AN UNKNOWN SESSION FALLS BACK TO OPTIONAL AND SAYS SO. A `SINCE` row read against a
    block whose number nobody could find is a comparison that did not happen; treating it
    as REQUIRED would refuse a correct 229 handed over under another name, and treating it
    as REQUIRED-and-silent is the green-over-an-unread-counter this file is about.
    """
    m = SINCE_RE.match(need)
    if m is None:
        return need
    return OPTIONAL if session is None else (
        REQUIRED if session >= int(m.group(1)) else OPTIONAL)


SESSION_RE = re.compile(r"HANDOFF_SESSION(\d+)", re.I)
BRANCH_RE = re.compile(r"^branch (\d+)\b")


def block_session(name: str, block: "list[str]") -> "tuple[int | None, str]":
    """(the session this block belongs to, where the number was read).

    The file's own name first, then the block's `branch n` row — which `HEADER_EXEMPT`
    already declares is the session number and not a measurement. Both are the document's
    own claim about itself, and a document that makes neither is not dated.
    """
    m = SESSION_RE.search(name)
    if m is not None:
        return (int(m.group(1)), f"the file name {name!r}")
    for line in block:
        m = BRANCH_RE.match(line)
        if m is not None:
            return (int(m.group(1)), f"the block's own {line.strip()[:20]!r} row")
    return (None, f"neither {name!r} nor any `branch n` row in the block carries a "
                  f"session number")

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
    # block, and the five rows below are what that walk found. All five were OPTIONAL:
    # absent from 233 for the good reason that its session did not run those instruments,
    # and a REQUIRED row here would redden every correct handoff that omits one.
    #
    # 🔴 237 §3 — AND THAT REASON IS TRUE OF THREE OF THEM AND FALSE OF TWO. `mutlock`,
    # `tree_quiet` and `release_names` are absent whenever a session did not run those
    # instruments; that recurs, and always will. `discover` and `undeclared` are absent
    # from 233 and from nothing since — 234, 235 and 236 all carry them — so their
    # absence was one session's omission rather than a property of the counter, and the
    # rows are `SINCE(234)`.
    ("mutlock.guarded", r"\bmutlock\b", 2,
     ("python3", "scripts/mutation_lock_gate.py", "--selftest"), ROOT,
     # 🆕 245 §2 — RE-ANCHORED. That file's summary line became `MUTATION_LOCK_SELFTEST_DONE`
     # this session so the verdict marker would be a string only a COMPLETED run prints
     # (198 §3's draft 1), and this reader was anchored on the old spelling. `--patterns`
     # refused it on the first CI run of the commit that moved it, which is the whole reason
     # that half exists — a reader anchored on a line its instrument no longer prints reports
     # the counter UNREAD, and UNREAD reads as `nothing to see`.
     r"GUARDED_FLOOR[^\n]*live=(\d+)[\s\S]*?MUTATION_LOCK_SELFTEST_DONE ok — (\d+) case", LOCKED, OPTIONAL,
     "🔴 THE ATOM IS SPELLED THREE WAYS ACROSS THREE SESSIONS — `mutlock 5/6/2` in 229, "
     "`mutlock 5 + 9 cases` in 230 and 231 — and the first draft of this row read only "
     "the leading number, so it refused 234's own block for claiming two. **The gate "
     "caught its author's handoff on the first run against it**, which is the outcome that "
     "makes the file worth its lines. Both numbers come from `--selftest`, which prints "
     "the live guarded count and its own cases, so one command answers the whole atom. "
     "🆕 242 — ANCHORED ON `GUARDED_FLOOR`, AND IT WAS `floor=\\d+ live=(\\d+)` BEFORE. "
     "That spelling is also `lint_ceiling.py --selftest`'s, which prints `floor=18 "
     "live=18` for its own file population — and the moment 242 added that command to the "
     "session replay, this row read eighteen guarded gates off it and refused a block "
     "saying five. Second row this session with the same cause: an extract that was "
     "unambiguous only because a sibling's output had never been in the log."),
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
     r"^\s*(\d+) rows · (\d+) REFUSE · \d+ distinct code", CHEAP, OPTIONAL,
     "🆕 242 — THE EXTRACT NOW REQUIRES `distinct code(s)`, AND IT DID NOT BEFORE. "
     "`(\\d+) rows · (\\d+) REFUSE` is a shape THREE selftests in this tree print: "
     "`release_names.py`, `registry_bytes.py` and `registry_lag.py`. It was unambiguous "
     "only because the other two were in `ci.yml` and not in the session replay, so their "
     "output had never been in a measured log. 242 added them to the replay — "
     "`replay-vs-ci-unread`'s whole point — and this row instantly read `10 rows · 8 "
     "REFUSE` off the wrong instrument and refused a block whose number was correct. "
     "**The reader was not wrong about the tree; it was right about a log that had never "
     "carried its sibling.** `distinct code(s)` is the tail only `release_names.py` "
     "prints — and the row is ANCHORED at the start of its line as well, because "
     "`contract_check.py` prints `check 5 · 5 prefix row(s) · 8 rows · 6 REFUSE · 4 "
     "distinct code(s)` and the tail alone still read the wrong instrument. 🔴 `61 rows/33 refusals`, AND IT HAS TO BE THE SELF-TEST. The live half refuses "
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
     r"instrument\(s\) · (\d+) gate/driver", MUTATING, SINCE(234),
     "🆕 232's discover half. `discover 48/12/12/18` — four numbers, no nouns, and the "
     "fourth has since moved to 22, which is what a counter restated as a bare tuple "
     "costs a later reader. 🔴 SINCE 234 AND NOT 233, WHICH IS THE WHOLE REASON THE "
     "BOUNDARY IS MEASURED: 232 carries this counter and 233 DROPS it. It is not a new "
     "axis 227–232 predate — it is a field one later block stopped restating, and 236 "
     "§8.4 counted it among the six anyway."),
    ("instrument.undeclared", r"\bundeclared\b", 1, ("python3", "scripts/instrument_gate.py"),
     ROOT, r"· (\d+) UNDECLARED", MUTATING, SINCE(234),
     "`0 undeclared` — 232 gave it its own atom, which is the right shape: it is the "
     "discover half's whole verdict and burying it inside a tuple would hide the one "
     "number that can go non-zero. SINCE 234 for `instrument.discover`'s reason — the "
     "two were introduced together in 232 and dropped together in 233."),

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
     r"^INSTRUMENT_GATE_LATE_LIVE (\d+)/(\d+)", MUTATING, SINCE(233),
     "🆕 233 — `LATE_LIVE 13/8`. The axis is new: 227–232's blocks predate it and would "
     "redden on a flat REQUIRED row for a counter that did not exist. 🟢 AND THIS ROW "
     "ASKED FOR ITS OWN PROMOTION — *\"a row that stays OPTIONAL after its counter is "
     "universal is this file\'s own stale-reason class (233 §18) — promote it once 234 "
     "and later are the population\"* — carried untouched by 234, 235 and 236. 233 is "
     "the first block that carries it and every block since carries it, so 233 is the "
     "boundary and the reason is a date the row now states instead of describing."),
    ("instrument.crashed", r"\bcrash", 1, ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE_CRASHED (\d+)/\d+", MUTATING, SINCE(232),
     "`0 crashes` — 227–231 do not carry it, 232 introduced it and no block since has "
     "dropped it. A session earlier than `late_live`\'s by one, which is why the "
     "boundary is a per-row measurement rather than the one date 236 §8.4 proposed."),
    ("instrument.blast", r"\bblast\b(?!.*\blate\b)", 1, ("python3", "scripts/instrument_gate.py"),
     ROOT, r"^INSTRUMENT_GATE_BLAST_TOTAL (\d+)", MUTATING, SINCE(232),
     "🔴 `blast 1383` IS A TOTAL AND 232's `blast 33/28` IS A SINGLE INSTRUMENT'S PAIR — "
     "the same word for two different measurements, one session apart. This row reads the "
     "TOTAL, which is what 233 meant, and the lookahead keeps it off `late blast`. That "
     "two blocks can spell incompatible things identically is the argument for binding on "
     "a pattern and then REFUSING ambiguity rather than resolving it. SINCE 232 — the "
     "block that spelled it the OTHER way is the one that introduced it, and the "
     "boundary is about the field\'s presence, which is all the DROPPED direction "
     "claims; the spelling is what the alias and `n` are for."),
    ("instrument.not_loaded", r"not-?loaded", 1, ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE_LATE_NOT_LOADED (\d+)/\d+", MUTATING, SINCE(233),
     "`late not-loaded 0` — 233 is the first block to carry it and every block since "
     "carries it."),

    # ── 🆕 246 — `queue-claims-unread` (240), AND ITS OWN COUNTER FIRST ───────────────
    # 🔴 THE ROW IS FROM 240 AND ITS SUBJECT HAS NEVER HAD A READER. 240 §NEXT 2 ordered
    # three steps — `BLOCK_POPULATION`, then this row, then the `BIND_PIN` — and said the
    # reader could be added by 242 and not before, because 240's block was the first that
    # would carry a `queue` counter at all. Measured in 246: no block in that table carries
    # one. 240's block mentions the queue in PROSE, in its header sentence, and the atom
    # was never written — so the row waited five sessions for a step nobody could take,
    # and the way to take it is to carry the atom in the block that adds the reader.
    ("queue.claims", r"^queue\b", 2, ("python3", "scripts/queue_gate.py", "--selftest"), ROOT,
     r"^QUEUE_SELFTEST (\d+)/(\d+) claims", CHEAP, SINCE(246),
     "`queue 33/33 claims` — the queue gate's own self-test, which is the instrument the "
     "whole queue rests on. Both halves for `contract.checks`'s reason: equal-but-smaller "
     "is claims being deleted, and a queue nobody can trust the gate of is 240's finding "
     "recreated one level down."),

    # ── 🆕 246 — `queue-claims-unread` (240), THREE COUNTERS OVER ─────────────────────
    # 245 §6.5 struck all three from its own status block rather than restate them
    # unchecked, and said so: *"they are printed on every run and no row in
    # `handoff_gate.py` binds them… do not put them back without a reader."* These are the
    # readers, and the block that carries them is the first block they could be read
    # against — which is the whole reason 240's row could not be closed on the session
    # that opened it either.
    #
    # 🔴 SINCE 246 AND NOT A FLAT REQUIRED. Every block in `BLOCK_POPULATION` predates
    # these atoms; a flat row would refuse the entire history for not carrying a field
    # that did not exist. The boundary is the first block that carries it, measured the
    # way `instrument.late_live`'s was.
    ("instrument.py_gates", r"^py gates\b", 3, ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE_PY (\d+) tracked scripts/\*\.py · (\d+) swept · (\d+) declared unswept",
     MUTATING, SINCE(246),
     "🆕 245's Python roster. `py gates 18/3/15` — three numbers, and all three are the "
     "claim: the walked population, the part of it that is an instrument, and the part "
     "that carries a written reason for not being one. The UNDECLARED and STALE halves "
     "are an equality the gate refuses on rather than a counter, so they are not here. "
     "🔴 ANCHORED ON TWO WORDS: `py` alone would bind inside any atom carrying those "
     "letters, and the binder's job is to refuse ambiguity rather than resolve it."),
    ("instrument.sig", r"\bSIG\b", 2, ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE_SIG (\d+)/(\d+)", MUTATING, SINCE(246),
     "`SIG 117/105` — resolved `{SIG:}` anchors over their floor. Both halves, for "
     "`contract.checks`'s reason: the pair going equal-but-smaller is a roster of anchors "
     "being replaced by the literals they resolve to today, which is the drift the "
     "placeholder exists to stop and which moves NO other printed line."),
    ("instrument.late_constructed", r"\blate constructed\b", 2,
     ("python3", "scripts/instrument_gate.py"), ROOT,
     r"^INSTRUMENT_GATE_LATE_CONSTRUCTED (\d+)/(\d+)", MUTATING, SINCE(246),
     "`late constructed 179/160` — late-axis blinds that were BUILT. 🔴 IT CARRIES THE "
     "WORD `late` AND MUST REACH NEITHER `instrument.late_live` NOR "
     "`instrument.not_loaded`, which is the third member of a collision those two rows "
     "already document; all three are anchored on more than the word."),
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
    "git.moved": TREE,      # `rev-list prev..this` — the PREVIOUS block's main, and this
                            # one's. Two SHAs off one row was 239 §2's tautology.
    "git.unmoved": TREE,    # 🆕 243 §3 — the SAME interval and the same two endpoints,
                            # claiming zero. A separate key because the block prints a
                            # separate word, and one row cannot bind two aliases.
    "version.unmoved": TREE,  # 🆕 243 §3 — package.json and plugin.cfg against the
                            # previous block's pair. Two files on disk, no network.
    "gh.issues": REMOTE,    # GitHub's tracker — no local question has this answer
    "gh.prs": REMOTE,
}

# 🔴 THE TOKENS IN THE HEADER THAT ARE NOT COUNTERS, EACH WITH THE REASON IT IS NOT ONE.
# This is the table 234's excluding paragraph was standing in for, and unlike a paragraph
# it goes stale loudly: `HEADER_EXEMPT_UNUSED` refuses a row that matched nothing across
# the real blocks the self-test walks.
#
# 🔴 238 §2 — AND THE FIRST TWO ROWS WERE ONE ROW WRITTEN TWICE, NARROWLY, AND THE GAP
# BETWEEN THEM REFUSED A CORRECT BLOCK. They were `\(#\d+\)` — *"a PR number in a commit
# subject"* — and `\bPR #\d+\b` — *"the same number naming the branch's own PR"*: two
# spellings of the ONE place each was observed, in the blocks that were in front of the
# author. 231's branch row cites a SECOND PR by bare number — `PR #285 OPEN, based on
# #284 (stacked)` — and `284` is in neither shape, so it survived the table, bound to no
# header reader, and 231 was refused as an UNREADABLE HEADER CLAIM on a row that was
# right. The exemption that covers all three is a property of the COUNTER and not of the
# sentence around it: a `#`-prefixed number is assigned by GitHub, nothing in this tree
# prints one, and no counter this half reads is ever spelled with a `#`.
HEADER_EXEMPT: "list[tuple[str, str]]" = [
    (r"#\d+", "🔴 A `#`-PREFIXED NUMBER, ANYWHERE IN A ROW. GitHub assigns it, no "
              "instrument prints it, and a session cannot restate it wrongly without the "
              "link breaking visibly. It replaces the two narrower spellings this table "
              "shipped with — `\\(#\\d+\\)` for the commit subject and `\\bPR #\\d+\\b` "
              "for the branch row — which between them covered every citation the author "
              "had in front of them and none of the one 231 wrote four sessions earlier."),
    (r"\b\d+'s\b", "🔴 A POSSESSIVE NUMERAL IS A CITATION OF ANOTHER SESSION, NOT A "
                   "COUNT. 231's `PR #284 OPEN (230's Owed item, cleared)` names session "
                   "230 inside a LABELLED ROW, which is 235 §3's note-line problem one "
                   "row up: prose that cites another session's work, in a line the "
                   "comparison reads as claims about this one. No counter this half "
                   "reads is ever possessive."),
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
    # 🆕 243 §3 — A CLAIM WHOSE NUMBER IS A WORD IS STILL A CLAIM. Every alias in
    # `HEADER_READERS` declaring zero digits is a counter spelled out — `UNMOVED` is
    # `MOVED +0` — and the numeral test below skipped every one of them silently. Derived
    # from the roster rather than listed here, because a second copy of the word is how
    # the two would drift.
    #
    # 🔴 AND THE CLEANED TEXT FOR A WORD CLAIM IS THE WHOLE ROW, WHICH THE FIRST RUN OF
    # THIS BRANCH MADE NECESSARY WITHIN THE MINUTE. The block prints `unmoved` TWICE and
    # it means two different things: on the `main` row it says no commit landed, and on
    # the `host / addon` row it says two version strings did not change. A numeral atom
    # carries its own subject — `lag 0`, `tags 121` — and a word does not, so the row is
    # the only thing that can tell the two apart. Binding both to one reader would have
    # compared an addon version against a commit interval and called it agreement.
    word_claims = [r[1] for r in HEADER_READERS if r[2] == 0]
    for line in rows:
        pieces = [p.strip(" *`,") for p in re.split(r"·|\s{3,}", line)]
        # the row's LABEL is its first field — `main`, `host / addon`, `npm`. It is what
        # a word claim is anchored to, and prepending it per-atom rather than matching
        # the whole line is what keeps the label itself from binding: `host / addon` in
        # the context `host / addon host / addon` carries no claim word and matches
        # nothing, while `🟢 unmoved` in `host / addon 🟢 unmoved` matches exactly one row.
        label = pieces[0] if pieces else ""
        for atom in pieces:
            if not atom:
                continue
            if not COUNTER_RE.search(atom):
                context = " ".join(f"{label} {atom}".split())
                if any(re.search(p, context, re.I) for p in word_claims):
                    atoms.append((atom, context))
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


_ORIGIN_TAG_CACHE: "dict[str, tuple[list[str], str]]" = {}


def origin_tag_names(root: Path = ROOT) -> "tuple[list[str], str]":
    """(tag names origin holds, problem) — NETWORK, and cached for the process.

    🆕 242 — LIFTED OUT OF `origin_tags` BECAUSE A SECOND READER NEEDED THE SAME LIST.
    `npm.lag` is counted in TAGS NEWER THAN THE PUBLISHED VERSION, so it needs the names
    and not the count, and it needs ORIGIN's names for the reason `origin_tags` gives
    below at length: the clone's tag list is a fact about the disk. `registry_lag.py`
    argues the opposite for its own purpose — *"the tag list is what this repository
    actually released"* — and it is right about a release cut on the authoring machine
    and wrong about a counter that has to mean the same thing in a fresh container. That
    disagreement is the whole of 234 §4.8, and this is the side of it the header takes.

    Cached because `--open --network` asks for it twice, once per reader, and two
    `git ls-remote` round trips to answer one question is the sort of thing that makes a
    ritual expensive enough to skip.
    """
    key = str(root)
    if key in _ORIGIN_TAG_CACHE:
        return _ORIGIN_TAG_CACHE[key]
    try:
        p = subprocess.run(("git", "ls-remote", "--tags", "origin"), cwd=root,
                           capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError) as e:
        return ([], f"could not reach origin: {e}")
    if p.returncode != 0:
        return ([], f"`git ls-remote` exited {p.returncode}: "
                    f"{(p.stderr or '').strip()[:200]}")
    names = sorted({ln.rsplit("refs/tags/", 1)[-1].strip() for ln in p.stdout.split("\n")
                    if "refs/tags/" in ln and not ln.rstrip().endswith("^{}")})
    _ORIGIN_TAG_CACHE[key] = (names, "")
    return (names, "")


def npm_lag(root: Path = ROOT) -> "tuple[int, str, str]":
    """(distance, note, problem) — NETWORK. The header atom `--open` could never read.

    🔴 241 §1 FOUND THIS ON THE FIRST RUN OF THE RITUAL THAT NEEDED IT. `npm.lag` sat in
    `HEADER_READERS` with an `extract` and nothing else: no in-process derivation like
    `ci.green`, no network branch like `npm.tags`, so the only thing that could ever
    satisfy it was a `--measured` log — and `--open` hardcodes an empty log and returns
    from `main()` before `--measured` is even parsed. It was unreachable at TIER0 by
    construction, and the reason it printed was the most misleading of the three the
    file can give: *"no --measured log carries it"* names a fix the mode cannot perform.
    A TIER0 open would have carried a stale lag across any number of sessions in silence.

    🔴 THE COMPUTATION IS `registry_lag.py`'s, IMPORTED RATHER THAN REWRITTEN — 229 §5.2's
    rule pointed at this tree's own shelf. `lag()` is pure; only the two inputs are dialed.
    The import is lazy so that a `handoff_gate.py --selftest` on a tree where
    `registry_lag.py` is broken still runs every claim that does not need it.
    """
    names, prob = origin_tag_names(root)
    if prob:
        return (-1, "", prob)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from registry_lag import lag as _lag, registry_version   # noqa: E402
    published = registry_version()
    if published is None:
        return (-1, "", "the npm registry could not be reached — `npm view` returned "
                        "nothing, which is not the same observation as a lag of zero")
    d, why = _lag(published, names)
    if d < 0:
        # 🔴 A REFUSAL IS NOT A NUMBER. `lag()` returns -1 for three distinct
        # conditions, one of which is the registry publishing something this repository
        # never tagged; reporting any of them as a distance would be inventing agreement.
        return (-1, "", f"`registry_lag.lag()` refused rather than measuring: {why}")
    return (d, f"npm.lag: registry at {published}, origin holds {len(names)} tag(s) — {why}", "")


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


def main_shas(block: "list[str]") -> "list[str]":
    """Every SHA on the block's `main` row, newest first — [] if it has no such row."""
    run = next((lines for kind, lines in _runs(block)
                if kind == ROW and lines[0].startswith("main")), None)
    return [] if run is None else [s for ln in run for s in SHA_RE.findall(ln)]


def previous_main(session: "int | None") -> "tuple[str, str]":
    """(the SHA main stood at when this session OPENED, problem) — from the population.

    🔴 239 §2 — THE OTHER ENDPOINT IS THE PREVIOUS BLOCK'S, AND 238 PUT IT IN THIS FILE.
    236 read it off the continuation line under the main row; measured over twelve real
    blocks, that line is the main SHA's own PARENT in every one of them, so the interval
    it bounded was `parent..commit` — which is 1 by construction, for any block that
    prints its history correctly. 235 NEXT 6 said the counter needs the previous tree and
    the gate has one tree; the half nobody revisited is that a previous BLOCK is not a
    previous tree, and `BLOCK_POPULATION` has held every one of them since 238.
    """
    if session is None:
        return ("", "this block is not dated, so the population cannot say which block "
                    "precedes it — and the interval's other endpoint is that block's "
                    "main row")
    earlier = [(s, t) for s, t in BLOCK_POPULATION if s < session]
    if not earlier:
        return ("", f"no block before {session} is in `BLOCK_POPULATION` — the endpoint "
                    f"main moved FROM is the previous block's own main row, and adding "
                    f"a block to that table is the step 238 NEXT 3 said nothing asks for")
    prev_sess, text = earlier[-1]
    shas = main_shas(status_block(text)[0])
    if not shas:
        return ("", f"{prev_sess}'s block is in the population and its `main` row "
                    f"carries no SHA, so it cannot supply an endpoint")
    return (shas[0], "")


def block_main(session: int) -> "tuple[str, str]":
    """(the SHA that block's own `main` row names, problem) — from the population."""
    hit = next((t for s, t in BLOCK_POPULATION if s == session), None)
    if hit is None:
        return ("", f"block {session} is not in `BLOCK_POPULATION`, so this reader "
                    f"cannot say which tree it was verified against")
    shas = main_shas(status_block(hit)[0])
    if not shas:
        return ("", f"block {session}'s `main` row carries no SHA")
    return (shas[0], "")


def moved_interval(block: "list[str]", session: "int | None" = None,
                   root: Path = ROOT) -> "tuple[int, str]":
    """(commits between the previous block's main and this one's, problem) — TREE.

    🔴 239 §2 — THE READER THIS REPLACES COULD ONLY EVER ANSWER 1. It bounded the
    interval with the main row's own two SHAs, and the second one is the first one's
    parent in all twelve real blocks — so `MOVED +1` agreed with a tautology and the two
    blocks that moved main twice (232, 233) were the only ones it could contradict. Both
    were right and both would have been refused. The endpoint that makes this a
    measurement comes from the block BEFORE this one, which is a fact about the tree and
    not about the sentence: still offline, still the same number in every full clone.
    """
    shas = main_shas(block)
    if not shas:
        return (-1, "no `main` row in this block")
    new = shas[0]
    old, why = previous_main(session)
    if why:
        return (-1, why)
    p = subprocess.run(("git", "rev-list", "--count", f"{old}..{new}"),
                       cwd=root, capture_output=True, text=True)
    if p.returncode != 0:
        return (-1, f"`git rev-list {old}..{new}` exited {p.returncode}: "
                    f"{(p.stderr or '').strip()[:120]} — this checkout does not hold "
                    f"both commits, which is a fact about the clone and not about the "
                    f"claim")
    return (int(p.stdout.strip() or 0), "")


# 🆕 243 §3 — THE OTHER `unmoved`, AND IT IS THE HALF NOBODY WOULD HAVE LOOKED FOR.
# `header-unmoved-unread` (OPEN 239) was written about the main row. The block prints the
# word on the `host / addon` row too, and there it claims something else entirely: that
# neither published version string has changed since the previous block. That claim is
# read from two files on disk against two numbers in the previous block — no network, no
# subprocess, and nothing has ever read it either.
VERSION_ROW_RE = re.compile(r"^host\s*/\s*addon\s+(\d+\.\d+\.\d+)\s*/\s*(\d+\.\d+\.\d+)")
ADDON_CFG_VERSION_RE = re.compile(r'^\s*version\s*=\s*"([^"]+)"', re.M)


def tree_versions(root: Path = ROOT) -> "tuple[tuple[str, str], str]":
    """((host version, addon version) as the TREE holds them, problem) — offline.

    The same two sources `contract_check.py` derives its parity from, for its reason: a
    version typed into this file is a number nobody re-derives, which is the artefact
    every reader in this tree exists to replace.
    """
    try:
        host = json.loads((root / "host" / "package.json").read_text())["version"]
    except (OSError, ValueError, KeyError) as e:
        return (("", ""), f"host/package.json is unreadable: {e}")
    try:
        cfg = (root / "addons" / "breakpoint_mcp" / "plugin.cfg").read_text()
    except OSError as e:
        return (("", ""), f"addons/breakpoint_mcp/plugin.cfg is unreadable: {e}")
    m = ADDON_CFG_VERSION_RE.search(cfg)
    if not m:
        return (("", ""), "addons/breakpoint_mcp/plugin.cfg carries no `version=` line")
    return ((str(host), m.group(1)), "")


def block_versions(block: "list[str]") -> "tuple[tuple[str, str], str]":
    """((host, addon) as a block's own `host / addon` row writes them, problem)."""
    for line in block:
        m = VERSION_ROW_RE.match(" ".join(line.lstrip("> ").split()))
        if m:
            return ((m.group(1), m.group(2)), "")
    return (("", ""), "no `host / addon` row in this block")


def version_interval(session: "int | None", root: Path = ROOT,
                     population: "list | None" = None) -> "tuple[int, str]":
    """(how many of the two versions moved since the previous block, problem) — TREE.

    🔴 THE ANSWER IS A COUNT AND NOT A BOOLEAN, so `unmoved` asserts zero exactly the way
    `MOVED +n` asserts n — one convention for both words, and the comparison in
    `check_header` does not have to know which row it is reading. It also means a block
    that moved ONE of the two and wrote `unmoved` is refused with a number that says
    which kind of drift it was.
    """
    if session is None:
        return (-1, "this block is not dated, so the population cannot say which block "
                    "precedes it — and `unmoved` is a claim about the one that does")
    # 🔴 `population` IS A PARAMETER FOR `replay_ci_problems`'s WRITTEN REASON, and this
    # reader needed it more than that one did: every block the live table holds carries
    # the SAME host/addon pair as the tree — the wire has not moved since 1.74.0 — so
    # there is no real block out of which a FALSE `unmoved` can be built, and a control
    # that cannot be fed a wrong answer proves only that the right one is returned.
    pop = BLOCK_POPULATION if population is None else population
    earlier = [(s, t) for s, t in pop if s < session]
    if not earlier:
        return (-1, f"no block before {session} is in `BLOCK_POPULATION` — the versions "
                    f"this row claims not to have moved FROM are the previous block's")
    prev_sess, text = earlier[-1]
    was, why = block_versions(status_block(text)[0])
    if why:
        return (-1, f"{prev_sess}'s block is in the population and {why}")
    now, why = tree_versions(root)
    if why:
        return (-1, why)
    return (sum(1 for a, b in zip(was, now) if a != b), "")


def parent_of(sha: str, root: Path = ROOT) -> "tuple[str, str]":
    """(the short SHA of `sha`'s first parent, problem) — TREE, offline.

    🔴 THE CLAIM THE OLD `MOVED` READER WAS ACTUALLY MAKING, WRITTEN DOWN AS ITS OWN.
    `rev-list parent..commit` is 1 whatever the two commits are, so the number told
    nobody anything; what the main row's two lines really assert is that the second is
    the first's parent, and THAT can be false. It is a different claim from `MOVED`, it
    is checked separately below, and neither one stands in for the other.
    """
    p = subprocess.run(("git", "rev-parse", "--short", f"{sha}^"),
                       cwd=root, capture_output=True, text=True)
    if p.returncode != 0:
        return ("", f"`git rev-parse {sha}^` exited {p.returncode}: "
                    f"{(p.stderr or '').strip()[:120]}")
    return (p.stdout.strip(), "")


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
     "🆕 239 §2 — `MOVED +1` — commits between the SHA main stood at when the session "
     "OPENED and the one it stands at now. The first endpoint is the PREVIOUS block's "
     "main row, read out of `BLOCK_POPULATION`; 236 read it off this block's own "
     "continuation line, which is the main SHA's parent in all twelve real blocks and "
     "made the answer 1 by construction. Still TREE, still offline."),
    # 🆕 243 §3 — `header-unmoved-unread` (OPEN 239), and the row is one word long.
    # `UNMOVED` is the SAME counter as `MOVED +n` with the number spelled as a word, and
    # `header_atoms` requires a numeral, so it was never an atom, never bound, never
    # compared — through every block that printed it. 🔴 THE ASYMMETRY IS THE FINDING:
    # `MOVED +1` is a claim this gate refuses when the tree disagrees, and `UNMOVED` was
    # a sentence. A session whose main branch moved could write `unmoved` on the row and
    # nothing here would have had an opinion. `n = 0` is what says "the WORD is the
    # digit": the claim carries no numeral and asserts zero, which the comparison below
    # supplies rather than parses.
    ("git.unmoved", r"^(?:main|branch)\b.*\bUNMOVED\b", 0, "",
     "🆕 243 §3 — `UNMOVED` on the main row asserts that main has NOT moved since the "
     "previous block's main row: the same interval `git.moved` measures, claiming zero. "
     "Same reader, same endpoints, same TREE provenance — the only difference is that "
     "the number is written as a word, which is exactly why nothing read it for four "
     "sessions. 🔴 ANCHORED TO THE ROW because the block prints the word twice."),
    ("version.unmoved", r"^host\s*/\s*addon\b.*\bunmoved\b", 0, "",
     "🆕 243 §3 — `unmoved` on the `host / addon` row is a DIFFERENT claim in the same "
     "word: that neither published version string changed since the previous block. "
     "Read from `host/package.json` and `addons/breakpoint_mcp/plugin.cfg` against the "
     "previous block's own two numbers, and it asserts zero of the two moved. TREE, "
     "offline, and the second half of `header-unmoved-unread`."),
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


# ── 🔴 238 §2 — TWO CLAIMS THE BLOCK WROTE WITHOUT A SEPARATOR ────────────────────────
#
# 236 gave the header a `gh.issues` row and a `gh.prs` row, and said why they were two:
# *"Separate row rather than a pair in one, because THE BLOCK PRINTS THEM AS TWO ATOMS
# and a reader that read both from one call would report a disagreement in whichever
# field came first."* Measured over the eleven real blocks, that sentence is true of six
# and false of five. 227–231 print the pair as ONE atom — `0 open issues / 0 open PRs`,
# separated by a slash rather than the `·` this parser splits on — and 232 is where the
# spelling changed. Run against those five, `check_header` refuses with *"binds to 2
# header readers — narrow the aliases"*, which is advice nobody can take: the atom really
# does carry both counters, and an alias narrow enough to miss one would stop reading the
# counter it was written for. 236 built the roster against the blocks in front of it, and
# the rule it produced reddens correct work — 237 §1's finding exactly, in the other half
# of this file, found the same way: by measuring instead of reading.
#
# 🔴 AND THIS IS NOT `bind()`'s AMBIGUITY, WHICH STAYS REFUSED. `807 keys` matching both
# `floor_pin.literal` and `wire_diff.key` is two readers claiming THE SAME SPAN: one of
# them is wrong and no rule here can say which, so refusing is the only honest answer.
# Two readers matching DISJOINT spans of one atom are not ambiguous at all — the block
# concatenated two atoms and left out the `·`. The distinction is measurable, so it is
# measured, and everything that fails the measurement keeps the old refusal.
def split_compound(cleaned: str, rows: "list[tuple]"
                   ) -> "tuple[list[tuple[tuple, str]] | None, str]":
    """([(reader row, its piece of the atom)], problem) — one of the two is empty.

    🔴 THE NUMERAL BELONGS TO THE LABEL THAT FOLLOWS IT. `0 open issues / 0 open PRs`
    cut at the second alias's own start puts BOTH zeroes in the first piece and leaves
    the second with none, which is how the first draft of this function silently gave
    `gh.prs` an empty claim. So each cut is made at the last numeral standing between the
    previous alias's end and this one's start, and every piece is then checked to carry
    at least one numeral and the pieces together to carry all of them. A split that
    cannot account for every numeral exactly once is not a split; it is a guess about
    which reader owns which number, and this file refuses guesses in this position.
    """
    hits = [(r, m) for r in rows if (m := re.search(r[1], cleaned, re.I)) is not None]
    if len(hits) < 2:
        return (None, "not a compound atom")
    hits.sort(key=lambda hm: hm[1].start())
    spans = [m.span() for _r, m in hits]
    for (_a, b), (c, d) in zip(spans, spans[1:]):
        if c < b:
            return (None, f"two aliases match OVERLAPPING spans ({b} > {c}) — that is "
                          f"`bind()`'s ambiguity and not a pair of atoms run together")
    cuts = [0]
    for i in range(1, len(hits)):
        lead = list(COUNTER_RE.finditer(cleaned[spans[i - 1][1]:spans[i][0]]))
        cuts.append(spans[i - 1][1] + lead[-1].start() if lead else spans[i][0])
    cuts.append(len(cleaned))
    pieces = [cleaned[cuts[i]:cuts[i + 1]] for i in range(len(hits))]
    counts = [len(COUNTER_RE.findall(p)) for p in pieces]
    if any(c < 1 for c in counts):
        return (None, f"a piece carries no numeral ({list(zip(pieces, counts))}) — the "
                      f"atom names two readers and cannot say what either one claims")
    if sum(counts) != len(COUNTER_RE.findall(cleaned)):
        return (None, "the pieces do not carry every numeral in the atom exactly once")
    return ([(r, p) for (r, _m), p in zip(hits, pieces)], "")


def check_header(block: "list[str]", log: str, run_network: bool,
                 session: "int | None" = None
                 ) -> "tuple[list[str], list[str], int, int]":
    """(problems, notes, atoms read, counters compared) for the lines above VERIFIED.

    🔴 239 §2 — `session` IS AN INPUT TO A COUNTER NOW, NOT JUST TO `needed()`. `MOVED`
    is an interval between two blocks, so the reader has to know which block it is
    reading; a block that cannot say answers UNREAD rather than a number derived from
    one end of it.
    """
    problems: "list[str]" = []
    notes: "list[str]" = []
    atoms, fired = header_atoms(block)

    # 🔴 238 §2 — RESOLVE FIRST, COMPARE SECOND, and a compound atom becomes two claims
    # rather than one refusal. Every entry below is (the atom as the block wrote it, the
    # text this claim is read from, the reader) — for an atom naming one reader the
    # second and third are what they always were, and for one naming two the piece is
    # that reader's own share of it.
    claims: "list[tuple[str, str, tuple]]" = []
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
            split, why_not = split_compound(cleaned, HEADER_READERS)
            if split is None:
                problems.append(
                    f"🔴 {raw!r} binds to {len(hits)} header readers "
                    f"({', '.join(h[0] for h in hits)}) and is not two atoms run "
                    f"together: {why_not}. Narrow the aliases, or give the block a `·`.")
                continue
            notes.append(f"header: {raw!r} is ONE atom carrying "
                         f"{len(split)} claims — 227–231's spelling, split into "
                         + " and ".join(f"{r[0]}={p.strip()!r}" for r, p in split))
            claims.extend((raw, p, r) for r, p in split)
            continue
        claims.append((raw, cleaned, hits[0]))

    compared = 0
    for raw, cleaned, row in claims:
        key, _alias, n, extract, why = row
        claimed = tuple(int(x) for x in COUNTER_RE.findall(cleaned))
        # 🆕 243 §3 — the word IS the digit. A zero-digit row asserts zero and parses
        # nothing, so `need` is what the length check compares against; writing `n = 1`
        # and a fake numeral would have made the roster lie about the block's own text.
        need = n
        if n == 0:
            claimed, need = (0,), 1
        got: "tuple[int, ...] | None" = None
        if key == "ci.green":
            total, _skipped = ci_check_runs()
            got = (total, total)
        elif key in ("git.moved", "git.unmoved"):
            n_moved, prob = moved_interval(block, session)
            if prob:
                notes.append(f"{key}: UNREAD — {prob}")
                continue
            got = (n_moved,)
        elif key == "version.unmoved":
            n_ver, prob = version_interval(session)
            if prob:
                notes.append(f"version.unmoved: UNREAD — {prob}")
                continue
            got = (n_ver,)
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
        elif key == "npm.lag":
            # 🆕 242 — THE BRANCH THIS ROW NEVER HAD. Log first, because a `--measured`
            # run has already paid for `registry_lag.py` and re-dialing would be a second
            # answer to a question already answered; network second, which is the half
            # `--open` needs and the half that did not exist.
            if extract and log and (m := re.search(extract, log, re.M)) is not None:
                got = tuple(int(g) for g in m.groups())
            elif run_network:
                d, note, prob = npm_lag()
                if prob:
                    notes.append(f"npm.lag: UNREAD — {prob}")
                    continue
                got = (d,)
                notes.append(note)
        elif extract and log and (m := re.search(extract, log, re.M)) is not None:
            got = tuple(int(g) for g in m.groups())
        if got is None:
            if key == "npm.lag":
                unread = ("pass --network to dial the registry, or supply a `distance "
                          "<n>` line from `registry_lag.py` in the measured log. Lag is a "
                          "fact about the WORLD: nothing in this tree can answer it, and "
                          "inheriting one across an --open is inheriting a number that "
                          "may have changed while nobody looked")
            elif key == "npm.tags":
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
        if len(claimed) != need or claimed != got:
            problems.append(
                f"🔴 {key} — the block says {list(claimed)}, the tree says {list(got)}\n"
                f"     atom: {raw!r}\n     {why}")

    # both directions on the exemption table — a row that matched nothing is a reason
    # nobody re-derived, which is 233 §18's class and the one this file keeps committing
    for pat, why in HEADER_EXEMPT:
        if pat not in fired:
            notes.append(f"HEADER_EXEMPT unused on this block: {pat} ({why[:60]}…)")

    # ── 🆕 244 §3 — `version-row-second-claim` (OPEN 243) — THE STRINGS BESIDE THE WORD ─
    #
    # 🔴 A NUMERAL READER CANNOT SEE A VERSION, AND THAT IS DELIBERATE THREE FILES DEEP.
    # `COUNTER_RE` refuses a digit with a dot against it so `1.74.0` is not read as three
    # counters — so the `host / addon` row's two version strings produced NO atom, bound
    # to no reader, and were compared to nothing, in every block ever written. 243 gave
    # the WORD on that row a reader and said so in its own queue: the row went from
    # half-read to three-quarters read, and this is the last quarter.
    #
    # 🔴 IT IS A ROW CLAIM AND NOT AN EXEMPTION, WHICH IS THE WHOLE DISTINCTION 236 §3
    # DELETED TWO ROWS OVER. `HEADER_EXEMPT` is for numerals no instrument prints; these
    # two are printed by `host/package.json` and `plugin.cfg`, and `contract_check.py`
    # has read both for parity for fifty sessions. An exemption here would have been an
    # exemption whose reason described the READER's state and not the counter's nature.
    #
    # 🔴 AND IT NAMES WHICH OF THE TWO DRIFTED. `version.unmoved` counts how many moved
    # since the PREVIOUS block; this compares THIS block's own pair against the tree in
    # front of it. Both live on one row, they are different claims, and together they are
    # a chain: the previous block's pair, the tree, and what this block says the tree is.
    was_pair, why_pair = block_versions(block)
    if why_pair:
        notes.append(f"version.pair: UNREAD — {why_pair}")
    else:
        now_pair, why_tree = tree_versions()
        if why_tree:
            notes.append(f"version.pair: UNREAD — {why_tree}")
        else:
            compared += 1
            drift = [f"{lbl}: block says {a}, tree says {b}"
                     for lbl, a, b in zip(("host", "addon"), was_pair, now_pair) if a != b]
            if drift:
                problems.append(
                    "🔴 version.pair — " + "; ".join(drift) + "\n"
                    "     the `host / addon` row states the two versions this tree "
                    "holds, read from `host/package.json` and "
                    "`addons/breakpoint_mcp/plugin.cfg`.\n"
                    "     Unread until 244: `COUNTER_RE` cannot see a dotted numeral, so "
                    "these two strings were never an atom and never bound.")

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

# ── 🔴 237 §2 — AND ROUTING IS NOT ORDER ──────────────────────────────────────────────
#
# 236 shipped the routing half and said so in its own NEXT: *"`REPLAY` checks routing,
# not order. `npm test` must run before `instrument_gate.py` in a fresh tree (§9's own
# standing rule, 178 §11.4's one-at-a-time rule) and nothing asserts it. The replay is a
# table now; it is not yet a DAG."* Every rule below is already written down in §9.2 as
# a standing rule, in prose, where the only thing that reads it is the next session's
# attention — which is 236 §21's finding exactly: *"ask of every sentence in a handoff
# that describes what an instrument does: which run would redden if it stopped being
# true?"* For these four the answer was none. It is this reader now.
#
# (earlier, later, why) — both tokens have to APPEAR for a rule to have an opinion. A
# replay that runs neither is not out of order, and a rule that fired on absence would
# refuse every partial replay a session legitimately prints.
REPLAY_ORDER: "list[tuple[str, str, str]]" = [
    ("npm test", "instrument_gate.py",
     "🔴 `npm test` EMITS `dist-test/`, WHICH IS PART OF THE POPULATION `instrument_gate"
     ".py` WALKS. Run the other way round in a fresh tree — every container, under 235's "
     "own practice — the instrument counts a tree that has not been built yet and prints "
     "a smaller `instruments=n` than the block claims. §9.2 has carried this as a "
     "standing rule since 233 and nothing has ever checked it."),
    ("pyflakes", "lint_ceiling.py",
     "🔴 WITHOUT `pyflakes` THE INSTRUMENT REFUSES AND `lint.files` GOES UNREAD — 236 §5, "
     "which is the defect that produced this session's whole NEXT 2. A replay that runs "
     "`lint_ceiling.py` in a container it never installed the module into is a replay "
     "whose log cannot answer the gate, and the reason it prints names the wrong file."),
]

# 🔴 178 §11.4 — ONE MUTATING GATE AT A TIME. Two on a line share `_gate_lock`'s window
# and the second one's population includes the first one's scratch; the rule is in §9.2's
# prose, in the replay's own comment (`# the mutating three — one at a time`), and in
# nothing that runs.
CHAINED_RE = re.compile(r"&&|\|\||;")

# ── 🆕 242 — THE REPLAY AND `ci.yml` ARE TWO ROSTERS OF THE SAME COMMANDS ─────────────
#
# 🔴 THE ROW (`replay-vs-ci-unread`, OPEN 241) AND HOW IT WAS FOUND. 241 ran the full
# local ritual, passed every command in its own §8.1 list, pushed, and `spec_conformance
# .py --check` refused the document IN CI — a step `ci.yml` has run for sessions and the
# replay list had never named. Nothing in this tree compares the two lists, so the ritual
# could go on claiming to be the local half of CI while drifting away from it silently.
#
# 🔴 MEASURED IN 242, script by script: **fourteen** merge-blocking `ci.yml` commands are
# absent from the replay, and **zero** replay commands are absent from CI. The drift is
# entirely in one direction — the ritual is a SUBSET and reads like a superset.
#
# The comparison is at SCRIPT granularity and not at flag granularity, and that is the
# defect's own shape: what 241 hit was a script the list had never named at all. Flags
# are the next question and this row does not pretend to have asked it.
INTEGRATION_WORKFLOW_EXEMPT = {
    "integration.yml":
        "🔴 EXEMPT AS A WHOLE WORKFLOW RATHER THAN AS TWENTY SCRIPTS, because the reason "
        "is a property of the workflow and not of any file in it: every job boots a real "
        "Godot binary under Xvfb against a live editor, and the session replay runs "
        "against a committed tree on a machine that has neither. Twenty near-identical "
        "rows would be twenty places to edit and one argument. 🔴 THE COST IS NAMED: no "
        "local ritual exercises these probes, so their only reader is CI, and this "
        "exemption is where that is written down rather than implied by absence.",
}

# Scripts CI runs that the replay deliberately does not, each with the reason.
REPLAY_CI_EXEMPT: "dict[str, str]" = {
    "assetlib_sweep.py":
        "`sdk-drift.yml` only, which is `schedule:` and `workflow_dispatch:` — it has no "
        "`push` or `pull_request` trigger, so it never blocks a merge and is not part of "
        "the ritual a session performs before cutting one.",
    "gate.sh":
        "a shell helper inside `integration.yml`'s own steps; it has no existence outside "
        "that workflow, which is exempt above.",
    "rb.sh": "same shape as `gate.sh` — an `integration.yml` step helper.",
}
# 🔴 `stage-addon.mjs` WAS THE FIFTH ROW AND THIS READER DELETED IT ON THE FIRST RUN.
# It is drafted as CI-only because `ci.yml` runs `npm run stage-addon` — and that is a
# PACKAGE SCRIPT, so no `run:` line in any workflow carries the basename and this reader
# cannot see it. `REPLAY_CI_EXEMPT_STALE` said so immediately: an exemption for something
# the reader never reports is an exemption over nothing, which is 174 §5 and is true even
# when the prose is correct. The right place for that fact is a comment, not a row.


def ci_scripts(root: Path = ROOT) -> "dict[str, set]":
    """{script basename: {workflow files that run it}} across every workflow.

    🔴 A HAND-ROLLED READER, LIKE THE TWO THIS TREE ALREADY HAS. Nothing here imports a
    YAML parser and the one job that would need it (`contract-check`) installs exactly one
    Python dependency, `pyflakes`. `ci_check_runs()` above and `instrument_gate.py`'s
    `CI_RUN_RE` are both regex readers of these same files; a third convention would be a
    third thing to keep in step.

    🔴 THE ANCHOR IS `run:` AND THAT IS WHAT KEEPS COMMENTS OUT. Six comments in `ci.yml`
    name scripts in backticks to explain why a step exists; a bare grep for `.py` counts
    every one of them as a command. Block scalars (`run: |`) are followed by their
    indented body, because four of the longest steps in the tree are written that way.
    """
    out: "dict[str, set]" = {}
    wf_dir = root / ".github" / "workflows"
    if not wf_dir.is_dir():
        return out
    for f in sorted(wf_dir.glob("*.y*ml")):
        lines = f.read_text().split("\n")
        i = 0
        while i < len(lines):
            ln = lines[i]
            if (m := CI_RUN_BLOCK.match(ln)) is not None:
                indent = len(ln) - len(ln.lstrip())
                i += 1
                while i < len(lines) and (not lines[i].strip()
                                          or len(lines[i]) - len(lines[i].lstrip()) > indent):
                    for s in CI_SCRIPT_RE.findall(lines[i]):
                        out.setdefault(s, set()).add(f.name)
                    i += 1
                continue
            if (m := CI_RUN_ONE.match(ln)) is not None:
                for s in CI_SCRIPT_RE.findall(m.group(1)):
                    out.setdefault(s, set()).add(f.name)
            i += 1
    return out


CI_RUN_BLOCK = re.compile(r"^\s*(?:-\s*)?run:\s*[|>][-+]?\s*$")
CI_RUN_ONE = re.compile(r"^\s*(?:-\s*)?run:\s*(.*\S)\s*$")
CI_SCRIPT_RE = re.compile(r"([A-Za-z0-9_.-]+\.(?:py|mjs|sh))")
CI_SCRIPT_FLOOR = 55   # governed by floor_pin_gate's SIZE_LEDGER


def replay_scripts(text: str) -> "set":
    """Every script the replay fence invokes, by basename. Comments stripped first —
    241's own list carries `# 🆕 241` and `# -> 724/724` on command lines."""
    blocks = [b for b in fenced(text) if REPLAY_MEASURED_RE.search(b)]
    body = blocks[-1] if blocks else text
    out = set()
    for ln in body.split("\n"):
        for s in CI_SCRIPT_RE.findall(ln.split("#")[0]):
            out.add(s)
    return out


def replay_ci_problems(text: str, ci: "dict[str, set]", floor: "int | None" = None,
                       exempt: "dict[str, str] | None" = None
                       ) -> "tuple[list[str], list[str]]":
    """(problems, notes) — the two rosters compared, in both directions.

    🔴 BOTH DIRECTIONS, BECAUSE THEY ARE DIFFERENT DEFECTS. A command CI runs and the
    replay does not is a session that can pass its whole ritual and be refused on push —
    241, exactly. A command the replay runs and CI does not is a check that only ever
    runs on the author's machine, which is a check that stops running the first time
    somebody forgets. Today the second list is empty and the first has fourteen entries,
    and that asymmetry is worth printing even when both are declared.
    """
    # 🔴 `floor` IS A PARAMETER RATHER THAN A READ OF THE GLOBAL, for `registry_lag.lag()`'s
    # written reason one file over: the self-test has to drive populations both under the
    # live floor and out from under it, and doing that by ASSIGNING TO THE MODULE GLOBAL
    # would put extra `CI_SCRIPT_FLOOR = …` statements in this file that `floor_pin_gate
    # .py`'s DISCOVER half reads as floor declarations and nothing can pin.
    floor = CI_SCRIPT_FLOOR if floor is None else floor
    exempt = REPLAY_CI_EXEMPT if exempt is None else exempt
    problems: "list[str]" = []
    notes: "list[str]" = []
    if len(ci) < floor:
        problems.append(
            f"🔴 REPLAY_CI_FLOOR this reader found {len(ci)} script(s) across the workflow "
            f"files, floor {floor} — either the workflows lost steps or "
            f"`CI_RUN_ONE`/`CI_RUN_BLOCK` stopped matching, and a comparison against an "
            f"empty CI roster reports perfect agreement.")
        return problems, notes
    rep = replay_scripts(text)
    exempt_wf = set(INTEGRATION_WORKFLOW_EXEMPT)
    missing = sorted(s for s, wfs in ci.items()
                     if s not in rep and s not in exempt
                     and not (wfs <= exempt_wf))
    for s in missing:
        problems.append(
            f"🔴 REPLAY_MISSING `{s}` runs in {sorted(ci[s])} and the replay list does not "
            f"name it. A session that performs this whole ritual and pushes can still be "
            f"refused by a step it never ran — which is what happened to 241 with "
            f"`spec_conformance.py`. Add it to the replay, or declare it in "
            f"REPLAY_CI_EXEMPT with the reason it is CI-only.")
    extra = sorted(s for s in rep if s not in ci and s not in exempt)
    for s in extra:
        problems.append(
            f"🔴 CI_MISSING `{s}` is in the replay list and in no workflow file. A check "
            f"that runs only where the handoff is written is a check that stops running "
            f"the first time somebody skips a step, and nothing would say so.")
    stale = sorted(s for s in exempt if s not in ci)
    for s in stale:
        problems.append(
            f"🔴 REPLAY_CI_EXEMPT_STALE `{s}` is declared CI-only and no workflow runs it "
            f"— an exemption that outlived the thing it exempts (174 §5).")
    notes.append(f"replay/ci: {len(rep)} script(s) in the replay · {len(ci)} across the "
                 f"workflows · {len(REPLAY_CI_EXEMPT)} declared CI-only · "
                 f"{len(INTEGRATION_WORKFLOW_EXEMPT)} workflow(s) exempt whole")
    return problems, notes


# ── 🆕 243 — THE THIRD DIRECTION: A TRACKED SCRIPT NEITHER ROSTER REACHES ─────────────
#
# 🔴 THE ROW IS `p0-reporters-unrostered` (OPEN 242) AND ITS SUBJECT IS NOT FIVE FILES.
# 241 shipped `p0_complexity.mjs` and `p0_testdup.mjs` tracked, both importing `globSync`
# from `node:fs` — exposed in Node 22, against a published `engines.node ">=18"` and a CI
# matrix of 18 · 20 · 22. An ESM named import of an export that does not exist fails at
# LINK time, so on two thirds of this project's own matrix the modules never loaded at
# all. Twenty-six CI jobs and eleven bespoke instruments had nothing to say, and the
# reason is one sentence: **every gate here reads a roster, and those files were in no
# roster.** 242 closed the two files by hand. This closes the CLASS.
#
# 🔴 THE COMPARISON ABOVE HAS TWO DIRECTIONS AND BOTH OF THEM PRESUPPOSE MEMBERSHIP.
# `REPLAY_MISSING` asks what CI runs that the replay does not; `CI_MISSING` asks the
# reverse. Neither can see a file that is in NEITHER list, and that intersection is
# exactly where the defect lived. This is the third question — *what does the union of
# both rosters never reach at all* — and it is the only one of the three whose answer was
# non-empty on the tree that shipped the defect.
#
# 🔴 REACHED MEANS INVOKED **OR LOADED**, AND THE DISTINCTION IS THE WHOLE ACCURACY OF
# THIS READER. `p0_complexity.mjs` is named by no `run:` line and no replay row, and it
# is nonetheless exercised on every push, because `p0_complexity.selftest.mjs` imports it
# and that self-test is in `ci.yml` — which is precisely the fix 242 made, and precisely
# the class of link error a load catches. A reader that counted only invocations would
# report both P0 reporters as unread today and be wrong about both. So the roster is
# closed over imports before anything is reported.
#
# 🔴 AND WHAT IT DOES NOT CLAIM, SAID HERE RATHER THAN LEFT TO BE DISCOVERED: a LOAD is
# not a RUN. `p0_complexity.mjs`'s `main()` is executed by nothing, so a defect that
# lives past the import boundary is outside this reader's reach the same way flag
# variants are outside `replay_ci_problems`'. Queue row `unreached-main-granularity`,
# OPEN 243 — the same shape, and the same honesty, as `replay-ci-flag-granularity`.
SCRIPT_SUFFIXES = (".py", ".mjs", ".sh")
SCRIPT_POPULATION_FLOOR = 80   # governed by floor_pin_gate's SIZE_LEDGER

# Tracked scripts the union of both rosters does not reach, each with the reason. 🔴 THE
# TWELVE `host/*.mjs` ROWS ARE ONE ARGUMENT WRITTEN TWELVE TIMES ON PURPOSE, and that is
# the opposite of `INTEGRATION_WORKFLOW_EXEMPT`'s choice one screen up. There the reason
# is a property of the WORKFLOW — every job in it boots Godot under Xvfb — so the
# workflow is exempt once. Here the reason is a property of each FILE, and the evidence
# differs file by file: this one spawns `GODOT_BIN`, that one dials 9080, a third dials
# 9081. A predicate over `host/*.mjs` would have swallowed the next reporter somebody
# drops in that directory without a word, which is the failure this row exists to end.
UNREACHED_EXEMPT: "dict[str, str]" = {
    "cs_demo_debugger_live.mjs":
        "dials the editor's debug adapter on a live loopback port; no headless ritual "
        "has one to dial.",
    "cs_demo_verify_live.mjs":
        "spawns `GODOT_BIN` and drives the C# runtime bridge in the running game.",
    "cs_demo_verify_live_gif.mjs":
        "the same live C# run, paced for an asciinema recording.",
    "cs_demo_verify_replay.mjs":
        "🔴 THE ONE EXEMPTION HERE THAT IS NOT ABOUT GODOT, AND IT IS WEAKER THAN THE "
        "OTHERS ON PURPOSE. It renders two captured JSON transcripts as a terminal "
        "narrative for a GIF, with deliberate `sleep`s for pacing — so it needs no "
        "editor and no binary, and running it in a ritual would spend the recording's "
        "whole runtime to prove a module loads. It is exempt for cost, not for "
        "impossibility, and it is the row to revisit first if this table is ever wrong.",
    "dap_scenario.mjs":
        "spawns `GODOT_BIN` and steps a live debug session.",
    "demo_debugger_live.mjs":
        "dials the debug adapter on 6006, which exists only while the editor is open.",
    "demo_verify_live.mjs":
        "spawns `GODOT_BIN` and drives the runtime bridge in the running game.",
    "drive.mjs":
        "an interactive driver against the live editor bridge.",
    "runtime_scenario.mjs":
        "dials the in-game runtime bridge on 9081, which exists only while the game runs.",
    "sweep_editor.mjs":
        "sweeps the editor bridge on 9080 against a live editor.",
    "verify_family_s102_live.mjs":
        "the session-102 verification family against the live runtime bridge on 9081.",
    "verify_shot_editor_live.mjs":
        "captures editor screenshots over the live bridge on 9080.",
    "stage-addon.mjs":
        "🔴 NOT UNREACHED — UNREADABLE. `ci.yml` runs it as `npm run stage-addon`, and a "
        "package script puts no basename on any `run:` line, so `ci_scripts()` cannot "
        "report it and the closure above cannot reach it. The same blind spot is written "
        "out at length above `REPLAY_CI_EXEMPT`, where it deleted one of that table's "
        "own rows on the first run. An exemption is the honest place for it: the file is "
        "exercised, by a channel this reader does not read.",
    "_caller_shape.harness.mjs":
        "🔴 ALSO REACHED BY A CHANNEL THIS READER CANNOT SEE, and a third one: "
        "`instrument_gate.py`'s `LATE_LIVE` table drives it as `node "
        "test-integration/_caller_shape.harness.mjs` from inside a gate that IS in both "
        "rosters. A driver table is an invocation the same way a `run:` line is; it is "
        "just not written where either reader looks.",
    "validate.sh":
        "a user-facing smoke helper documented in `docs/RUNBOOK.md`, requiring a Godot "
        "binary and a real project. `contract_check.py`'s check 15 governs its presence "
        "and its shebang; nothing in the merge ritual should be running a setup script "
        "against the developer's own machine.",
}

# 🔴 ANCHORED ON THE SPECIFIER AND NOTHING ELSE. `tautology_gate.mjs` carries the name of
# almost every file in this tree because it SWEEPS them as text, and a reader that
# counted a mention would report the whole population reached and refuse nothing ever
# again. A static ESM import is `from "<relative path>"`, a dynamic one is
# `import("<relative path>")`, and neither has any other spelling.
ESM_IMPORT_RE = re.compile(r"""\bfrom\s*["'](\.[^"']+)["']|\bimport\s*\(\s*["'](\.[^"']+)["']""")
PY_IMPORT_RE = re.compile(r"""^[ \t]*(?:import[ \t]+([A-Za-z_]\w*)|from[ \t]+([A-Za-z_]\w*)[ \t]+import)""",
                          re.M)


def tracked_scripts(root: Path = ROOT) -> "list[str]":
    """Every tracked `.py` / `.mjs` / `.sh`, repo-relative. `git ls-files` for
    `lint_ceiling.py`'s reason: an untracked scratch driver is not part of anything this
    project ships, and a filesystem walk cannot tell the two apart."""
    try:
        p = subprocess.run(("git", "ls-files"), cwd=root, capture_output=True, text=True)
    except (OSError, subprocess.SubprocessError):
        return []
    if p.returncode != 0:
        return []
    return [ln for ln in p.stdout.split() if ln.endswith(SCRIPT_SUFFIXES)]


def import_edges(paths: "list[str]", root: Path = ROOT) -> "dict[str, set]":
    """{basename: {basenames it imports}} over the given tracked scripts.

    Keyed by BASENAME because both rosters are: `ci_scripts()` and `replay_scripts()`
    read command lines, where the same file is spelled `scripts/x.mjs` here and
    `../scripts/x.mjs` there. A duplicate basename would merge two files' edges, which
    would only ever over-report reachability — and `contract_check.py` already refuses a
    duplicate script name for its own reasons.
    """
    known = {Path(p).name for p in paths}
    edges: "dict[str, set]" = {}
    for rel in paths:
        try:
            text = (root / rel).read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        got: "set" = set()
        for m in ESM_IMPORT_RE.finditer(text):
            got.add(Path(m.group(1) or m.group(2)).name)
        for m in PY_IMPORT_RE.finditer(text):
            name = (m.group(1) or m.group(2)) + ".py"
            if name in known:
                got.add(name)
        edges[Path(rel).name] = got & known
    return edges


def reached_scripts(roster: "set", edges: "dict[str, set]") -> "set":
    """The roster closed over imports — invoked, or loaded by something invoked."""
    seen: "set" = set()
    stack = [b for b in roster if b in edges]
    while stack:
        b = stack.pop()
        if b in seen:
            continue
        seen.add(b)
        stack.extend(n for n in edges.get(b, ()) if n not in seen)
    return seen


def unreached_problems(text: str, ci: "dict[str, set]", paths: "list[str] | None" = None,
                       edges: "dict[str, set] | None" = None, floor: "int | None" = None,
                       exempt: "dict[str, str] | None" = None
                       ) -> "tuple[list[str], list[str]]":
    """(problems, notes) — tracked scripts the union of both rosters never reaches."""
    floor = SCRIPT_POPULATION_FLOOR if floor is None else floor
    exempt = UNREACHED_EXEMPT if exempt is None else exempt
    paths = tracked_scripts() if paths is None else paths
    problems: "list[str]" = []
    notes: "list[str]" = []
    # 🔴 THE FLOOR IS OVER THE POPULATION, NOT OVER THE FINDINGS. A `git ls-files` that
    # returns nothing — no git, a different cwd, a subprocess that failed quietly —
    # yields an empty population, an empty unreached list, and a green run that has read
    # zero files. That is the same failure `REPLAY_CI_FLOOR` guards one function up, and
    # it is the failure this whole row is about: a reader reporting on a scope it never
    # opened.
    if len(paths) < floor:
        problems.append(
            f"🔴 SCRIPT_POPULATION_FLOOR this reader found {len(paths)} tracked script(s), "
            f"floor {floor} — a population that small means `git ls-files` did not answer, "
            f"and an empty population is reached by every roster ever written.")
        return problems, notes
    edges = import_edges(paths) if edges is None else edges
    roster = set(ci) | replay_scripts(text)
    seen = reached_scripts(roster, edges)
    for rel in sorted(paths):
        base = Path(rel).name
        if base in seen or base in exempt:
            continue
        problems.append(
            f"🔴 UNREACHED `{rel}` is invoked by no workflow and no replay row, and "
            f"imported by nothing either roster reaches. Both P0 reporters were in this "
            f"state when they shipped unable to LINK on two thirds of this project's own "
            f"CI matrix, and 26 jobs stayed green. Put it in the replay list or a "
            f"workflow, give it a `--selftest` something already runs, or declare it in "
            f"UNREACHED_EXEMPT with the reason nothing should run it.")
    # 🔴 STALE HAS TWO SHAPES AND ONLY ONE OF THEM IS OBVIOUS. An exemption whose file the
    # closure now REACHES is an argument that has stopped being true. An exemption naming
    # a file that is no longer tracked at all is worse: it is silent, it can never fire,
    # and it is the exact shape `REPLAY_CI_EXEMPT_STALE` caught on its own author in 242.
    present = {Path(p).name for p in paths}
    for b in sorted(b for b in exempt if b in seen):
        problems.append(
            f"🔴 UNREACHED_EXEMPT_STALE `{b}` is declared unreachable and the closure "
            f"reaches it — an exemption that outlived the thing it exempts (174 §5).")
    for b in sorted(b for b in exempt if b not in present):
        problems.append(
            f"🔴 UNREACHED_EXEMPT_STALE `{b}` is declared unreachable and is not a "
            f"tracked script at all — an exemption over nothing, which reads as coverage "
            f"and is not.")
    notes.append(f"unreached: {len(paths)} tracked script(s) · {len(seen)} reached by the "
                 f"two rosters and their imports · {len(exempt)} declared unreachable")
    return problems, notes


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

    # ── 🔴 238 §3 — THE ROUTING QUESTION, ASKED OF EVERY ROW THAT RUNS SOMETHING ──────
    #
    # 237 NEXT 3: *"`REPLAY` asks its routing question of ten rows and not of twenty-
    # eight. A CHEAP row escapes because `measure()` will re-run it live, which is true
    # and is not the same as the log carrying what the replay says it captures. Widen the
    # routing rule to every row with a `cmd`, or state in the reason why CHEAP is exempt —
    # and it will be the exemption's own shape, since the reason describes the READER's
    # ability rather than the counter."* Measured before building: 28 rows carry a `cmd`
    # and 10 were asked. The exemption is not written; the rule is widened.
    #
    # 🔴 THE TWO HALVES ARE NOT THE SAME QUESTION AND ONLY ONE OF THEM WIDENS. "The
    # replay never runs this instrument at all" is a refusal only where the counter can
    # come from nowhere else — MUTATING and SLOW — because a session that legitimately
    # prints a partial replay has not thereby lost a CHEAP counter `measure()` re-runs.
    # "The replay RUNS it and throws its output away" is a defect for every row, and it
    # is §7.2's own standing rule — *"ROUTE EVERY GATE INTO THE MEASURED LOG"* — which
    # has been carried as prose since 235 with nothing reading it.
    #
    # 🔴 AND THE UNIT IS THE SEGMENT, NOT THE LINE, WHICH IS THE WHOLE OF 237 §5.2. `node
    # scripts/wire_invisible_gate.selftest.mjs && node scripts/wire_invisible_gate.mjs |
    # tee -a run.log` routes the SECOND command; `wire_invisible.cases` reads the FIRST.
    # The line carries the log's name, so a rule that asked `is {base} on this line` — the
    # rule that shipped — called it routed. 237 found this by hand, wrote it down as a
    # NEXT, and shipped the replay that does it.
    for key, _alias, _n, cmd, _cwd, _ex, cost, _need, _why in COUNTER_READERS:
        if cmd is None:
            continue
        token = next((c.rsplit("/", 1)[-1] for c in reversed(cmd)
                      if c.endswith((".py", ".mjs"))), " ".join(cmd))
        # the reader's own `--measured` invocation is not an instrument run — and it is
        # excluded by what it IS rather than by the file it lives in, so `handoff.claims`
        # (whose instrument is this file, in `--selftest`) is asked the question too.
        running = [ln for ln in text.split("\n")
                   if token in ln and not REPLAY_MEASURED_RE.search(ln)]
        segments = [seg for ln in running for seg in CHAINED_RE.split(ln)
                    if token in seg]
        routed = [seg for seg in segments
                  if re.search(rf">>?\s*\S*{re.escape(base)}", seg)
                  or re.search(rf"\btee\s+(?:-a\s+)?\S*{re.escape(base)}", seg)]
        if not running:
            if cost in (MUTATING, SLOW):
                problems.append(
                    f"🔴 REPLAY — `{key}` is {cost}: this gate never runs it, and the "
                    f"replay does not run it either. The block's counter came from "
                    f"somewhere the document does not print, which is a procedure "
                    f"nobody can repeat.")
            continue
        if routed:
            continue
        if cost in (MUTATING, SLOW):
            problems.append(
                f"🔴 REPLAY — `{key}` is {cost} and its counter can ONLY come from "
                f"`--measured {log}`, but no command running `{token}` sends its output "
                f"there. Run as written, the last command of this replay refuses with "
                f"`{key}` UNMEASURED. Route it into {base} "
                f"(`| tee -a {base}`, or `>> {base}`).")
        else:
            problems.append(
                f"🔴 REPLAY — this replay runs `{token}` and routes none of it into "
                f"{base}: {segments[0].strip()[:70]!r}. `{key}` is {cost}, so "
                f"`measure()` will re-run it live and the block will be right — and that "
                f"is a fact about THIS READER's abilities, not about the procedure. The "
                f"log is what the next session repeats the measurement from, and a "
                f"replay whose log does not carry what it appears to capture is a "
                f"procedure that only works while somebody remembers the difference. "
                f"§7.2: route every gate into the measured log.")

    # 🔴 THE FIRST WRITE MAY TRUNCATE AND NO LATER ONE MAY, and the index that matters is
    # among the lines that ROUTE — 235's §1 discusses `--measured run.log` in prose three
    # sections above the replay, and a rule counting raw mentions would have called the
    # replay's own first redirect a clobber of a sentence.
    # 🆕 242 — AND A COMMENT IS NOT A COMMAND. The note above already argues that PROSE
    # three sections up must not count as a redirect; the same is true of a `#` comment
    # INSIDE the fence, and that half was missing. 242's replay opens with a comment
    # explaining why the log is appended to — quoting `npm test | tail -20 > run.log` to
    # say what it truncates — and the reader read the quotation as the first write, which
    # made the real command a *later* one and refused the replay for clobbering itself.
    # The rule was right about the shape and wrong about the population, which is the
    # fourth reader this session to be wrong in exactly that way.
    cmds = [re.sub(r"(?<!\S)#.*$", "", ln) for ln in lines]
    routing = [i for i, ln in enumerate(cmds)
               if re.search(rf">>?\s*\S*{re.escape(base)}", ln)
               or re.search(rf"\btee\s+(?:-a\s+)?\S*{re.escape(base)}", ln)]
    # 🆕 242 — `(?<!>)` IS NEW AND IT IS A DEFECT FIX, NOT A TIGHTENING. `>(?!>)` was
    # meant to read "a single `>`", and on the string `>>` it matches at the SECOND
    # character: the lookahead only asks what follows. So every `>> run.log` line in a
    # replay was classified as a TRUNCATING write and refused as a clobber. Nothing had
    # ever noticed because every replay since this reader shipped routed with `| tee -a`
    # and no line in one had ever used `>>` — the fixture at `clobber` below uses `>`
    # twice, so it proved the rule on the only spelling the rule got right. 242 is the
    # first session to append to the log (the TIER0 open, captured before `npm test`
    # truncates it) and the reader refused the ritual its own `TIER_UNSUPPORTED` demanded.
    truncating = [i for i, ln in enumerate(cmds)
                  if re.search(rf"(?<!>)>(?!>)\s*\S*{re.escape(base)}", ln)
                  or re.search(rf"\btee\s+(?!-a)\S*{re.escape(base)}", ln)]
    late = [i for i in truncating if routing and i != routing[0]]
    if late:
        problems.append(
            f"🔴 REPLAY — {base} is TRUNCATED by a later line ({lines[late[0]].strip()[:70]!r}) "
            f"after an earlier line had already written to it. Everything captured "
            f"before it is gone by the time the gate reads the file, and the counters it "
            f"carried go UNMEASURED with no sign that they were ever measured.")

    # ── 🔴 237 §2 — THE ORDER HALF ────────────────────────────────────────────────────
    all_lines = text.split("\n")

    def first(token: str) -> int:
        return next((i for i, ln in enumerate(all_lines) if token in ln), -1)

    for earlier, later, why in REPLAY_ORDER:
        i_late, i_early = first(later), first(earlier)
        if i_late < 0:
            continue
        if i_early < 0:
            problems.append(
                f"🔴 REPLAY — this replay runs `{later}` and never runs `{earlier}`. "
                f"{why}")
        elif i_early > i_late:
            problems.append(
                f"🔴 REPLAY — `{earlier}` is printed at line {i_early + 1}, AFTER "
                f"`{later}` at line {i_late + 1}, and this replay is a file somebody "
                f"runs top to bottom. {why}")

    # 🔴 AND THE READER IS THE LAST THING THAT TOUCHES THE LOG. A line that appends after
    # `--measured` has been read is a measurement the gate could not see — the truncation
    # rule's twin, and the one a session adds by appending a gate it forgot.
    i_reader = next((i for i, ln in enumerate(all_lines)
                     if REPLAY_MEASURED_RE.search(ln)), -1)
    trailing = [i for i, ln in enumerate(all_lines)
                if i > i_reader >= 0 and re.search(
                    rf">>?\s*\S*{re.escape(base)}|\btee\s+(?:-a\s+)?\S*{re.escape(base)}",
                    ln)]
    if trailing:
        problems.append(
            f"🔴 REPLAY — {base} is written to at line {trailing[0] + 1} "
            f"({all_lines[trailing[0]].strip()[:70]!r}), AFTER the gate has already read "
            f"it at line {i_reader + 1}. The counter that line captures is measured and "
            f"unread, which is the same silence as never measuring it — and it is the "
            f"shape a session produces by appending one more gate to the end.")

    # 🔴 178 §11.4 — and the mutating gates one at a time, on lines of their own
    mutating = [c[-1].rsplit("/", 1)[-1]
                for k, _a, _n, c, _w, _e, cost, _nd, _wh in COUNTER_READERS
                if cost == MUTATING and c is not None]
    for i, ln in enumerate(all_lines):
        named = sorted({t for t in mutating if t in ln})
        if len(named) > 1 and CHAINED_RE.search(ln):
            problems.append(
                f"🔴 REPLAY — line {i + 1} runs {len(named)} MUTATING gates in one "
                f"command ({', '.join(named)}): {ln.strip()[:70]!r}. 178 §11.4 — one at "
                f"a time. They mutate the tree under `_gate_lock` and restore it, so the "
                f"second one's population is the first one's scratch, and the replay's "
                f"own comment says `one at a time` in a line nothing reads.")
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


# 🔴 THE `>` IS NOT DECORATION AND THE FIRST DRAFT DROPPED IT. Every handoff in this
# series opens with a BLOCKQUOTE, so the natural place to write the declaration is a line
# beginning `> `, and a reader anchored on `^\s*ritual` reports UNDECLARED there — which
# reads as a session that skipped the ritual rather than one that announced it in the
# most prominent line of its own document. Caught by this file's own self-test on the day
# the mode was written, which is the seventh session running that a fixture is faster
# than the author.
TIER_DECLARE_RE = re.compile(r"^[>\s]*ritual\s+(TIER[01])\b", re.I | re.M)
TIER_RUN_RE = re.compile(r"^HANDOFF_OPEN\b.*?\bTIER0\b.*?INHERITED FROM (\d+) AT (\S+)",
                         re.M)


def tier_problems(text: str, log: str, session: "int | None"
                  ) -> "tuple[list[str], list[str]]":
    """The opening tier, declared in the document and read back out of the run.

    🔴 A TIER IS A CLAIM ABOUT WHAT THIS SESSION DID NOT DO, WHICH IS THE ONLY KIND OF
    CLAIM THIS FILE HAS NEVER HAD TO CHECK. Every other row here compares a number the
    block printed against the instrument that printed it. `ritual TIER0` says twenty-nine
    counters were INHERITED rather than measured — an absence, and an absence looks
    exactly like a session that ran the full ritual and forgot to say so, and exactly like
    a session that skipped it and said nothing. So the declaration is REQUIRED in both
    directions and TIER0 is read back out of the log the same way `724/724` is.
    """
    problems: "list[str]" = []
    notes: "list[str]" = []
    m = TIER_DECLARE_RE.search(text)
    if not m:
        problems.append(
            "🔴 TIER_UNDECLARED — this document does not say which tier its OPENING ran "
            "at. Write `ritual TIER0` or `ritual TIER1`. A block that does not say cannot "
            "be told from one that inherited twenty-nine counters in silence, and the "
            "whole argument for the cheap tier is that it announces itself.")
        return (problems, notes)
    tier = m.group(1).upper()
    if tier == TIER1:
        notes.append("ritual TIER1 — the opening ran the full replay, so every counter "
                     "below was re-measured rather than inherited")
        return (problems, notes)

    if not log:
        notes.append("ritual TIER0 declared and no --measured log was supplied, so the "
                     "declaration is READ and not checked")
        return (problems, notes)
    run = TIER_RUN_RE.search(log)
    if not run:
        problems.append(
            "🔴 TIER_UNSUPPORTED — the document declares `ritual TIER0` and the measured "
            "log carries no `HANDOFF_OPEN ... TIER0 ... INHERITED FROM <n> AT <sha>` "
            "line. The cheap tier is only honest because it refuses on a tree it cannot "
            "match; a TIER0 nobody ran is a TIER0 that never checked anything.")
        return (problems, notes)
    from_session, at_sha = int(run.group(1)), run.group(2)
    if session is not None and from_session != session - 1:
        problems.append(
            f"🔴 TIER0_PREDECESSOR — block {session} inherited from {from_session}. The "
            f"tier inherits the PREVIOUS session's verification, and a block that "
            f"inherited from further back skipped the sessions between it and its own "
            f"evidence.")
    # 🔴 AND THE ENDPOINT IS THE INHERITED BLOCK'S OWN MAIN ROW, NOT `previous_main`'s.
    # The first draft reached for `previous_main(session)`, which answers *the SHA main
    # stood at when this session OPENED* — 238's SHA for a block inheriting from 239. It
    # is one row off, in the direction that makes an honest document refuse, and it is
    # 239 §2's own shape: a reader borrowing an endpoint that was computed for a
    # different question. The tier inherits what block N-1 SHIPPED, so the endpoint is
    # block N-1's main row.
    want, why = block_main(from_session)
    if why:
        notes.append(f"TIER0_SHA unchecked — {why}")
    elif not (want.startswith(at_sha) or at_sha.startswith(want)):
        problems.append(
            f"🔴 TIER0_SHA — the opening inherited at {at_sha} and `BLOCK_POPULATION` "
            f"says block {from_session} stood at {want}. The whole justification for "
            f"inheriting a counter is that the tree did not move; two answers about "
            f"which tree that was is the justification failing.")
    else:
        notes.append(f"ritual TIER0 — {len(COUNTER_READERS)} tree counters inherited "
                     f"from {from_session} at {at_sha}, header re-read live")
    return (problems, notes)


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
    # 🆕 242 — the replay list against the workflow files, both directions.
    _ci = ci_scripts()
    rc_problems, rc_notes = replay_ci_problems(text, _ci)
    problems.extend(rc_problems)
    r_notes.extend(rc_notes)
    # 🆕 243 — and the third direction: what the union of both rosters never reaches.
    un_problems, un_notes = unreached_problems(text, _ci)
    problems.extend(un_problems)
    r_notes.extend(un_notes)

    session, how = block_session(handoff.name, block)
    t_problems, t_notes = tier_problems(text, log, session)
    problems.extend(t_problems)
    notes_session = [f"block session {session} — read from {how}"] if session is not None \
        else [f"SINCE rows fell back to OPTIONAL — {how}, so no block-number comparison "
              f"happened and this run cannot tell a dropped counter from a counter the "
              f"session predates"]

    h_problems, h_notes, h_atoms, h_compared = check_header(block, log, run_network,
                                                            session)
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
        if needed(need, session) == REQUIRED and key not in bound:
            since = SINCE_RE.match(need)
            when = (f" It is REQUIRED of block {session} because every block from "
                    f"{since.group(1)} onward carries it — measured, not assumed."
                    if since else "")
            problems.append(f"🔴 DROPPED COUNTER — `{key}` has a reader and this block "
                            f"does not claim it. Nothing else in this tree would notice "
                            f"a status block quietly ceasing to report a field.{when} "
                            f"({why})")

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
    return (problems, notes_session + notes + h_notes + r_notes, len(atoms), compared,
            h_atoms, h_compared)


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

# 🆕 246 — THE ONE-SESSION GAP THE THREE-STEP ORDER LEAVES, AND WHY IT NEEDED A TABLE.
#
# 240 NEXT 2 ordered three steps — `BLOCK_POPULATION`, then the `COUNTER_READERS` row,
# then the `BIND_PIN` — because `ALIAS_UNUSED` refuses a reader no real block reaches, and
# a block only becomes real when the NEXT session adds it. So a counter and its reader can
# never land together, and the counter has to be restated unread for one whole session
# first. 🔴 MEASURED IN 246: `queue-claims-unread` had been open since 240 because nobody
# ever took step one, and 245 struck three more counters from its own block rather than
# carry them unread. Five sessions and four counters, all waiting on an ordering.
#
# This table is the gap, written down and time-boxed. A key here is a reader whose atom
# first appears in the block THIS session is writing — unreachable from the table by
# construction, for exactly one session. The next session adds that block and the row goes
# stale, loudly, in the walk above.
def pending_problems(pending: dict, reached: set, reader_keys: set) -> list[str]:
    """Both ways a pending row goes stale — lifted out so a fixture can drive each (195 §8.4).

    On a healthy tree this returns [], so an inline version deletes invisibly: the exact
    class this file's own `roster` claims exist to refuse, one table over.
    """
    return ([f"{k}: reached by a real block now — delete the row" for k in pending if k in reached]
            + [f"{k}: not a reader in this file at all" for k in pending
               if k not in reader_keys])


# 🆕 247 — 🟢 AND IT EXPIRED ON SCHEDULE, WHICH IS THE HALF THAT WAS WORTH BUILDING.
# 246 wrote four rows here and said the next session would delete them; it is deleted
# BY THE GATE, not by the session remembering — adding 246's block to
# `BLOCK_POPULATION` above puts all four keys in `reached`, and `pending_problems`
# turns every one of them into `ALIAS_PENDING_STALE` on the same run. The table was
# empty for one session and is empty again, which is the only end state a time-boxed
# exemption is allowed to have. 🔴 THE EMPTY DICT IS THE POINT AND NOT AN ACCIDENT: a
# quiet second exemption list is what this would have become if the rows could outlive
# the block that answers them, and the branch that deletes them is fixture-driven below
# so it does not go silent now that the live table is empty.
ALIAS_PENDING: "dict[str, str]" = {}

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
    # 🆕 246 — the three `queue-claims-unread` counters, pinned in the commit that gives
    # them readers. Each is a spelling 245 §6.5 wrote down and then struck from its own
    # block for want of exactly this.
    ("queue 33/33 claims", "queue.claims",
     "🔴 THE COUNTER 240's ROW IS NAMED FOR, five sessions after the row said the reader "
     "could be added by the session after it"),
    ("py gates 18/3/15", "instrument.py_gates",
     "🔴 THE POPULATION, THE INSTRUMENTS AND THE DECLARED RESIDUE — three numbers whose "
     "middle one is the only one that can go up without work"),
    ("SIG 120/105", "instrument.sig", "resolved anchors over their floor"),
    ("late constructed 185/160", "instrument.late_constructed",
     "🔴 CARRIES `late` AND MUST REACH NEITHER `instrument.late_live` NOR "
     "`instrument.not_loaded` — the third member of that collision"),
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

# ── 🔴 238 §2 — THE ELEVEN BLOCKS, VERBATIM, AND THEY ARE THE POPULATION NOW ──────────
#
# 237 NEXT 2: *"`--patterns` covers the extract and not the alias. Every row has a `cmd`,
# an `extract` and an `alias`, and only two of the three are now asserted against
# something real. The alias is what binds a block's ATOM to the row, it is a pattern over
# English, and `BIND_PINS` are hand-written atoms rather than atoms taken from the blocks
# that exist. The population is 227–236's ten counter lines, they parse today, and
# nothing walks them."*
#
# 🔴 THE COUNT WAS RIGHT AND THE COVERAGE CLAIM WAS TOO KIND TO ITSELF. Measured before
# building: 227–237 is eleven counter lines carrying 222 atoms in 71 distinct spellings,
# and `BIND_PINS` reaches 32 of the 71 — one of its 33 pins (`handoff 87 claims`) is a
# spelling no block has ever carried. So the hand-written table covers 45% of the English
# the aliases actually have to read, and the missing 55% is where the drift lives:
# `floor_pin.literal` alone has been spelled seven ways, `term.swept` five, `lint.files`
# four.
#
# 🔴 AND THE POPULATION HAS TO BE IN THE FILE. `.gitignore` carries `HANDOFF*.md`, so a
# walk of the directory measures eleven blocks on the authoring machine, ZERO in CI and
# ZERO in a fresh clone — a coverage claim that evaporates on exactly the two machines
# nobody is watching. `HISTORY_PINS`, `REAL_BLOCK` and `SINCE_POPULATION` already solved
# this by embedding their inputs; this is the same answer at the population's full size,
# and `SINCE_POPULATION` now reads out of it rather than keeping its own four copies.
#
# These are not shaped to pass. 227 is seven atoms and three header rows; 231 is the
# block with two stacked PRs whose branch row cites `#284` twice; 232 is where the `gh`
# pair stopped being one atom; 233 carries the `807 keys` history already pinned above;
# 234–237 carry all six SINCE counters. Every one of them was written before the rule
# that reads it.

BLOCK_POPULATION: "list[tuple[int, str]]" = [
    (227, """> ```
> main / origin/main   cf18a41 — the instrument that was built for the decision, attached to it (#281)
> host / addon         1.74.0 / 1.9.9   🟢 addon debt still paid, unmoved since its stamp
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues / 0 open PRs
> 🟢 226's STATUS BLOCK ACCURATE IN EVERY FIELD — ELEVENTH SESSION RUNNING
> 🟢 CHECK 8 IS IN THE RITUAL. No skip flag. Unreachable is RED. Driven live, both ways.
> 🟢 CHECK 1 HAS ITS MAJOR ARM — 210 §9 CLOSED, and the SDK-v2 bump is now cuttable.
> 🔴 A FIRST DRAFT OF THAT ARM WOULD HAVE REFUSED THE RELEASE IT EXISTS TO UNBLOCK.
> 🟢 CHECK 14 READS THE WHOLE LOCKFILE MIRROR — and REFUSES the 1.74.0 release commit.
> 🟢 spec_conformance READS 154 FILES, NOT 83. The roster's blind half held the addon.
> 🔴 THE LIVE TREE CORRECTED THIS SESSION'S OWN NEW CODE WITHIN THE HOUR.
> 🟢 VERIFIED   61 rows/33 refusals · contract 23/23 · floor_pin 79 · scope 25 · control 59 · 724/724 · 26 CI
> ```
"""),
    (228, """> ```
> main / origin/main   b5e625e — the question no reader had to ask (#282)
> host / addon         1.74.0 / 1.9.9   🟢 addon debt still paid, unmoved since its stamp
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues / 0 open PRs
> 🟢 227's STATUS BLOCK ACCURATE IN EVERY FIELD — TWELFTH SESSION RUNNING
> 🟢 A READER CAN ASK. `tree_quiet.py`, three markers, three exit codes, wired to a hook.
> 🟢 THE RECORD SURVIVES SIGKILL — a BASELINE, not a flag, so a clean tree self-clears.
> 🔴 THE FIRST MARKER WOULD HAVE TRAINED ITS USER TO DELETE THE LOCK FILE.
> 🔴 THE FIRST REFUSAL NAMED A CAUSE THAT HAD NOT HAPPENED — 226 §3, THIRD SESSION.
> 🔴 THE FIRST `--recover` WOULD HAVE DESTROYED THE WORK IT WAS RUN TO PROTECT.
> 🟢 `mutation_lock_gate` CALLED THE NEW READER AN UNGUARDED MUTATOR, AND IT WAS RIGHT.
> 🔴 AND IT CAUGHT THE SESSION TWICE — both times a hand editing a tree mid-gate.
> 🟢 VERIFIED   tree_quiet 13 · contract 23/23 · floor_pin 79 · scope 25 · control 59
>               · mutlock 5 guarded / 6 records / 2 reader controls · 724/724 · 26 CI
> ```
"""),
    (229, """> ```
> main / origin/main   b46477e — the sentence and the evidence (#283)
> host / addon         1.74.0 / 1.9.9   🟢 addon debt still paid, unmoved since its stamp
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues / 0 open PRs
> 🟢 228's STATUS BLOCK ACCURATE IN EVERY FIELD — THIRTEENTH SESSION RUNNING
> 🟢 THE DEAD LEDGER ROW IS GONE AND ITS HISTORY SURVIVED — 30 rows became 31 governed
> 🟢 A DUPLICATE KEY IN ANY LITERAL IN scripts/ NOW REDDENS — 682 keys, not one table
> 🔴 THE ADDON'S 135 REFUSALS ARE CLEAN. THE CLASS WAS NEVER WHERE 228 EXPECTED IT.
> 🔴 THE RULE IS NOT "NAME TWO CAUSES" — IT IS DERIVED vs LITERAL POPULATION.
> 🔴 pyflakes HAS KNOWN ABOUT THE DUPLICATE KEY ALL ALONG. NOTHING HERE RUNS pyflakes.
> 🟢 VERIFIED   floor_pin 79 · 31/31 governed · 682 keys · 20 shortfalls · unswept 0
>               · contract 23/23 · scope 25 · control 59 · instrument ok · term 266
>               · mutlock 5/6/2 · tree_quiet 13 · 724/724 · 26 CI
> ```
"""),
    (230, """> ```
> main                 b46477e — the sentence and the evidence (#283)   UNMOVED
> branch               14c44c3 session230-the-tool-that-was-already-built
>                      🔴 COMMITTED, NOT PUSHED — no PR opened (see §6.1)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues / 0 open PRs
> 🟢 229's STATUS BLOCK ACCURATE IN EVERY FIELD — FOURTEENTH SESSION RUNNING
> 🔴 THE LINTER ITEM'S PRECEDENT WAS REAL AND ITS POPULATION IS ZERO. Six findings,
>    two classes, no defects — the one defect pyflakes ever found here is already fixed.
> 🔴 SO THE SHIP IS A CLASS ROSTER, NOT A CEILING. A total would go green on a tree
>    that deleted one f-string and grew a duplicate key.
> 🔴 §6.4's SPIKE ANSWERED — 18,252 lines emitted, 0 typed, and EXACTLY 3 facts in the
>    whole repository that the wire cannot carry.
> 🟢 A MUTATING GATE WAS KILLED MID-RUN BY THE ENVIRONMENT AND THE TREE RECOVERED CLEAN.
> 🟢 VERIFIED AFTER THE CHANGE   floor_pin 80 · 32/32 governed · 688 keys · 21 shortfalls
>               · unswept 0 · exempt 33 · contract 23/23 · scope 25 · control 59
>               · instrument ok · term 267 · mutlock 5 + 9 cases · release_names 61/33
>               · tree_quiet 13 · 724/724 · lint_ceiling 14 cases + live ok · 26 CI
> ```
"""),
    (231, """> ```
> main                 b46477e — the sentence and the evidence (#283)   UNMOVED
> branch 230           14c44c3 session230-the-tool-that-was-already-built
>                      🟢 PUSHED · PR #284 OPEN (230's Owed item, cleared)
> branch 231           30a2045 session231-the-rule-neither-emission-carries
>                      🟢 PUSHED · PR #285 OPEN, based on #284 (stacked)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues / 2 open PRs (ours)
> 🟢 230's STATUS BLOCK ACCURATE IN EVERY FIELD — FIFTEENTH SESSION RUNNING
> 🔴 THE `.finite()` POPULATION IS ONE CALL SITE, NOT THREE. 230's figure was
>    `grep -rooF '.finite()' | wc -l`; two of the three hits are comments about the one.
> 🔴 SO A FLOOR OF THREE WOULD HAVE PINNED TWO COMMENTS — and stayed green on a fourth
>    refinement added beside a deleted comment. 230 §2's own argument, in 230's own item.
> 🟢 MEASURED OFF THE ZOD: 292 tools · 310 refinements · 6 classes · EXACTLY ONE the
>    emitter drops. Every other class verified ON the wire by stripping it, not assumed.
> 🔴 `instrument_gate.py` HAS NO DISCOVERY HALF — the twelfth instrument was outside it
>    and the gate said `ok`. `floor_pin_gate.py` caught the same file's floors unprompted.
> 🟢 THE BRIDGE DROPPED MID-SESSION AGAIN AND THE TREE WAS CLEAN — second session running.
> 🟢 VERIFIED AFTER THE CHANGE   floor_pin 83 · 32/32 governed · 707 keys · 21 shortfalls
>               · unswept 0 · exempt 33 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 12 · term 269 · mutlock 5 + 9 cases
>               · release_names 61/33 · tree_quiet 13 · 724/724 · lint_ceiling 14 + live
>               · wire_invisible 27 cases + live ok · 26 CI
> ```
"""),
    (232, """> ```
> main                 741e717 — the rule neither emission carries (#285)   MOVED +2
>                      19f9b2d — the tool that was already built (#284)
> branch 232           ce34b87 session232-the-roster-that-could-not-see-what-joined
>                      🟢 PUSHED · PR #286 OPEN, based on main (not stacked)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues / 1 open PR (ours)
> 🟢 231's STATUS BLOCK ACCURATE IN EVERY FIELD — SIXTEENTH SESSION RUNNING
> 🔴 #285 DID NOT AUTO-RETARGET. GitHub only does that when the base branch is DELETED and
>    this repo keeps branches; retargeting by hand turned it CONFLICTING on 230's own edits.
> 🟢 REBASED --onto origin/main, AND THE REBASED TREE WAS BYTE-IDENTICAL (eb2c93c, diff 0).
> 🔴 THE DISCOVER HALF'S FIRST RUN NAMED `positive_control_gate.mjs` — 818 lines, five
>    exported members, a headless self-test, in CI since 219, never blinded.
> 🔴 AND BLINDING IT CRASHED THE PROOF TWICE — `classify` and `acceptance` took the
>    self-test down before its verdict line. Fixed in the self-test, not in the ceiling.
> 🔴 AND MY OWN FIRST GUARD CAUGHT THE THROW AND NOT THE EMPTY, in the file whose whole
>    subject is collections that are empty for more than one reason.
> 🟢 VERIFIED AFTER THE CHANGE   discover 48/12/12/18 · 0 undeclared · floor_pin 83
>               · 34 governed · 707 keys · 23 shortfalls · unswept 0 · exempt 35
>               · contract 23/23 · scope 25 · control 59 · instrument ok across 13
>               · 0 crashes · blast 33/28 · late blast 31/26 · term 269 · taut 4012
>               · 724/724 · lint_ceiling 15 files · wire_invisible 27 + live · 26 CI
> ```
"""),
    (233, """> ```
> main                 c27953d — the excuses the tree contradicted (#287)          MOVED +2
>                      e9d6ba2 — the roster that could not see what joined (#286)
> branch 233           191eca9 session233-the-excuses-the-tree-contradicted
>                      🟢 PUSHED · PR #287 MERGED, 26/26 green, based on main (not stacked)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🔴 232's STATUS BLOCK WAS WRONG IN ONE FIELD — THE FIRST IN SEVENTEEN SESSIONS.
>    `707 keys` under "VERIFIED AFTER THE CHANGE" is the value at `741e717`, BEFORE the
>    change. Measured at all three points: 682 -> 707 -> 747. Every other field held.
> 🔴 THREE `LATE_LIVE_NA` ROWS WERE FALSE, AND TWO NAMED THE COMMAND THEY DENIED.
> 🟢 `LATE_LIVE_NA` IS NOW EMPTY — ALL THIRTEEN INSTRUMENTS HAVE THE STRONGER AXIS (13/8).
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
>               · late not-loaded 0 · floor_pin 89 · 37 governed · 807 keys
>               · 25 shortfalls · unswept 0 · exempt 36 · term 275 file(s) / 21 suffixes
>               · taut 4046 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 15 files · 26 CI jobs
> ```
"""),
    (234, """> ```
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
>               · late not-loaded 0 · discover 48/12/12/22 · 0 undeclared
>               · floor_pin 91 · 39 governed · 816 keys · 25 shortfalls
>               · unswept 0 · exempt 36 · term 276 file(s) / 21 suffixes
>               · taut 4046 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 16 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 89 claims · 26 CI jobs
> ```
"""),
    (235, """> ```
> main                 7d6e9bf — the log the reader could not finish (#289)       MOVED +1
>                      bcc0b85 — the table that read itself back (#288)
> branch 235           92a8ca2 session235-the-log-the-reader-could-not-finish
>                      🟢 PUSHED · PR #289 MERGED, 26/26 green, based on main (not stacked)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 115 · 0 open issues · 0 open PRs
> 🟢 234's STATUS BLOCK HELD IN EVERY FIELD — 29 atoms, 29 readers, 29 compared, on
>    bcc0b85. Two blocks in a row went red on one counter each; this one did not.
> 🔴 `tags 121` WAS THE EXCEPTION AND NOTHING COULD SEE IT — the field sits above the
>    counter line, and the reader started at it. Origin holds 115; six tags were
>    never pushed. THE npm ROW IS READ NOW, AND `tags` IS READ OFF ORIGIN.
> 🔴 THE RITUAL 234 WROTE COULD NOT BE COMPLETED AS WRITTEN — see §1.
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
>               · late not-loaded 0 · discover 48/12/12/22 · 0 undeclared
>               · floor_pin 92 · 40 governed · 820 keys · 25 shortfalls
>               · unswept 0 · exempt 36 · term 276 file(s) / 21 suffixes
>               · taut 4046 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 16 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 133 claims · 26 CI jobs
> ```
"""),
    (236, """> ```
> main                 192bd55 — the replay that could not be run (#290)             MOVED +1
>                      7d6e9bf — the log the reader could not finish (#289)
> branch 236           e7a29fc session236-the-replay-that-could-not-be-run
>                      🟢 PUSHED · PR #290 MERGED, 26/26 green, based on main (not stacked)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 235's STATUS BLOCK HELD IN EVERY FIELD — 29 atoms, 29 readers, 29 compared, on
>    7d6e9bf, and the header half read 3 of 3. Second block in a row that verified clean.
> 🔴 235 §8.1's REPLAY REFUSES ON ITS OWN LAST LINE. Ten counters come only from the three
>    MUTATING gates; the replay prints them to the terminal and then reads run.log.
> 🟢 THE SIX TAGS ARE PUSHED — origin holds 121 now, and the number is the same on every
>    machine for the first time since 1.13.0.
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
>               · late not-loaded 0 · discover 48/12/12/22 · 0 undeclared
>               · floor_pin 92 · 40 governed · 826 keys · 25 shortfalls
>               · unswept 0 · exempt 36 · term 276 file(s) / 21 suffixes
>               · taut 4046 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 16 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 151 claims · 26 CI jobs
> ```
"""),
    (237, """> ```
> main                 0a8c64a — the rules that were only ever sentences (#291)     MOVED +1
>                      192bd55 — the replay that could not be run (#290)
> branch 237           69662af session237-the-rules-that-were-only-ever-sentences
>                      🟢 PUSHED · PR #291 MERGED, 26/26 green, based on main (not stacked)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 236's STATUS BLOCK HELD IN EVERY FIELD — 29 atoms, 29 readers, 29 compared, on
>    192bd55, and the header half read 6 of 6 for the first time (236 built the last three).
> 🔴 236 §8.4's PROMOTION WAS WRONG BY ONE BLOCK IN TWO ROWS. `232` carries `discover` and
>    `0 undeclared`; `233` DROPS both. The run carrying all six is 234–236, three long.
> 🔴 EIGHTEEN READER PATTERNS HAD NO FIXTURE THAT RAN THE COMMAND THEY NAME, and four
>    replay-order rules lived only in §9.2's prose. Both are checked now.
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
>               · late not-loaded 0 · discover 48/12/12/22 · 0 undeclared
>               · floor_pin 92 · 40 governed · 826 keys · 26 shortfalls
>               · unswept 0 · exempt 36 · term 276 file(s) / 21 suffixes
>               · taut 4046 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 16 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 180 claims · 26 CI jobs
> ```
"""),
    # 🆕 239 — THE TWELFTH BLOCK, WHICH IS 238 NEXT 3's WHOLE ITEM. *"Every claim the
    # alias walk makes is satisfiable by a population that stops growing, and a block
    # added to `BLOCK_POPULATION` is a manual step nothing asks for."* Nothing asked for
    # it; `git.moved` does now, because a session's own `MOVED` row cannot be read
    # without the previous block's main SHA, and the reader names the block that is
    # missing when it is. A table that stops growing now stops ANSWERING.
    (238, """> ```
> main                 831ce40 — the aliases nothing walked (#292)                  MOVED +1
>                      0a8c64a — the rules that were only ever sentences (#291)
> branch 238           7ffaa02 session238-the-aliases-nothing-walked
>                      🟢 PUSHED · PR #292 MERGED, 26/26 green, based on main (not stacked)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
>               · late not-loaded 0 · discover 48/12/12/22 · 0 undeclared
>               · floor_pin 93 · 41 governed · 827 keys · 26 shortfalls
>               · unswept 0 · exempt 36 · term 276 file(s) / 21 suffixes
>               · taut 4046 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 16 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 201 claims · 26 CI jobs
> ```
"""),
    # 🆕 240 — THE THIRTEENTH. 239 shipped the counter that makes this step ask for
    # itself: `git.moved` reads its endpoint out of this table, so a session whose
    # predecessor is missing gets UNREAD with the block named rather than a number.
    (239, """> ```
> main                 ef4e875 — the number that could only ever be one (#293)      MOVED +1
>                      831ce40 — the aliases nothing walked (#292)
> branch 239           0dd01dc session239-the-number-that-could-only-ever-be-one
>                      🟢 PUSHED · PR #293 MERGED, 26/26 green, based on main (not stacked)
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
>               · late not-loaded 0 · discover 48/12/12/22 · 0 undeclared
>               · floor_pin 93 · 41 governed · 827 keys · 26 shortfalls
>               · unswept 0 · exempt 36 · term 276 file(s) / 21 suffixes
>               · taut 4046 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 16 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 207 claims · 26 CI jobs
> ```
"""),
    # 🆕 241 — THE STANDING RULE, PAID. 240's block is the endpoint `git.moved` measures
    # FROM, and without this row the reader falls back and answers a different question:
    # it read 3 for a session that moved main by 1. 🔴 AND THIS IS ALSO THE FIRST OF THE
    # THREE STEPS 240 NEXT 2 ORDERS — BLOCK_POPULATION, then the `COUNTER_READERS` row for
    # `queue.claims`, then the `BIND_PIN`. `ALIAS_UNUSED` refuses any other order, and 241
    # stops here: the block below is the first in this table to carry a `queue` counter at
    # all, so the reader it needs can be added by 242 and not before.
    (240, """> **STATUS — 2026-08-12: THE MAINTAINER STOPPED THE RITUAL AND ASKED WHAT IT WAS BUYING.
> 🔴 THE ANSWER IS THAT THE QUEUE WAS THE ONE TABLE IN THIS TREE NOTHING READ, AND THE
> OPENING RITUAL RE-MEASURED A TREE NOBODY HAD TOUCHED. BOTH ARE INSTRUMENTS NOW — AND
> THE FIRST ONE FIRED ON ITS OWN AUTHOR ONE COMMIT LATER.**
>
> ritual TIER1 — the opening ran the full replay, because `--open` did not exist yet.
>
> ```
> main                 2ae5f3b — the kill that counted as progress (#295)             MOVED +2
>                      2bd3906 — the queue nothing read, and the ritual that re-measured an unchanged tree (#294)
> branch 240           1b48386 session240b-the-kill-that-counted
>                      🟢 PUSHED · PR #294 AND #295 MERGED, 26/26 green, neither stacked
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
>               · late not-loaded 0 · discover 48/12/12/22 · 0 undeclared
>               · floor_pin 95 · 43 governed · 829 keys · 26 shortfalls
>               · unswept 0 · exempt 36 · term 278 file(s) / 21 suffixes
>               · taut 4046 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 17 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 218 claims · 26 CI jobs
> ```"""),

    (241, """> ```
> main                 42f6ec0 — the endpoint the reader needed (#297)                MOVED +2
>                      8caa0df — P0 of the code review charter (#296)
> branch 241           b3b990a session241b · 4ebf4b9 session241c
>                      🟢 PUSHED · PR #296 AND #297 MERGED, 26/26 green each, neither stacked
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1383
>               · late not-loaded 0 · discover 52/14/12/22 · 2 exempt · 0 undeclared
>               · floor_pin 95 · 43 governed · 835 keys · 26 shortfalls
>               · unswept 0 · exempt 36 · term 284 file(s) / 21 suffixes
>               · taut 4086 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 219 claims · 26 CI jobs
> ```
"""),
    # 🆕 243 §3 — THE FIFTEENTH, AND THE FIRST ADDED BY A SESSION THAT ALSO WIDENED WHAT
    # THIS TABLE IS READ FOR. Until now every consumer read the main row: `git.moved`
    # takes its far endpoint from here, and the alias walk counts spellings. 243's
    # `version.unmoved` reads the `host / addon` row out of the same blocks — so a block
    # missing from this table now costs TWO readers their other end, not one.
    (242, """> ```
> main                 147bb35 — the PR body is scratch and it reached the tree (#299)  MOVED +2
>                      57d0939 — the readers that could not see each other (#298)
> branch 242           session242 · session242-cleanup — squashed into main
>                      🟢 PUSHED · PR #298 AND #299 MERGED, 26/26 green each, neither stacked
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   724/724 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1388
>               · late not-loaded 0 · discover 52/14/12/22 · 2 exempt · 0 undeclared
>               · floor_pin 97 · 46 governed · 867 keys · 94 shortfalls
>               · unswept 0 · exempt 38 · term 285 file(s) / 21 suffixes
>               · taut 4089 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 231 claims · 26 CI jobs
> ```
"""),
    # 🆕 244 — 243's OWN BLOCK, ADDED BEFORE THE CLOSE GATE RAN (241's standing rule, and
    # since 244 §2 this table also has a floor on how far BACK it reaches). It is the
    # block that carries `UNMOVED` on the main row over an interval that really is zero —
    # the input `UNMOVED_ACCEPTS` needs and the only real one this population has.
    (243, """> ```
> main                 147bb35 — the PR body is scratch and it reached the tree (#299)  UNMOVED
> branch 243           session243-the-word-that-was-never-a-claim
>                      🟡 NOT PUSHED FROM HERE — the container cannot push to this repo
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   726/726 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 13 · LATE_LIVE 13/8 · 0 crashes · blast 1388
>               · late not-loaded 0 · discover 52/14/12/22 · 2 exempt · 0 undeclared
>               · floor_pin 98 · 47 governed · 894 keys · 94 shortfalls
>               · unswept 0 · exempt 38 · term 285 file(s) / 21 suffixes
>               · taut 4096 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 253 claims · 26 CI jobs
> ```
"""),
    (244, """> ```
> main                 8cfe158 — the population a reader never admits it lost (#301)  MOVED +2
>                      299b8d6 — The word that was never a claim, and the intersection two directions could not see (#300)
> branch 244           session244-the-controls-that-could-not-run — squashed into main
>                      🟢 PUSHED · PR #300 AND #301 MERGED, 26/26 green each
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   726/726 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 15 · LATE_LIVE 15/8 · 0 crashes · blast 1442
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 942 keys · 94 shortfalls
>               · unswept 0 · exempt 38 · term 285 file(s) / 21 suffixes
>               · taut 4118 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 9 cases · tree_quiet 13 · release_names 61/33
>               · handoff 263 claims · 26 CI jobs
> ```
"""),
    # 🆕 246 — 245's block, added BEFORE the close gate runs, which is 241's standing
    # sequencing rule. `git.moved` measures FROM the newest entry, so a table one
    # session behind makes the reader answer a different question and costs a second PR.
    (245, """> ```
> main                 acb4efd — the reds that nothing could count (#302)  MOVED +1
>                      8cfe158 — the population a reader never admits it lost (#301)
> branch 245           session245-the-reds-that-nothing-could-count
>                      🟢 PUSHED · PR #302 MERGED, 26/26 green
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   726/726 · contract 23/23 · scope 25 · control 59
>               · instrument ok across 18 · LATE_LIVE 17/8 · 0 crashes · blast 1542
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1040 keys · 95 shortfalls
>               · unswept 0 · exempt 39 · term 285 file(s) / 21 suffixes
>               · taut 4118 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · handoff 264 claims · 26 CI jobs
> ```"""),
    # 🆕 247 — 246's BLOCK, AND IT IS THE HALF OF 240 NEXT 2 NOBODY COULD TAKE UNTIL NOW.
    # 240 ordered three steps and the order is unsatisfiable in one session: a reader is
    # refused unless a REAL block reaches it, and a block becomes real only when the NEXT
    # session adds it here. 246 wrote the four readers and time-boxed the gap in
    # `ALIAS_PENDING`; adding this block is what makes all four rows STALE, and they are
    # deleted in this same commit. 🔴 THE TABLE IS THE THING THAT CLOSED THE ORDERING —
    # not a session remembering, a gate refusing.
    (246, """> ```
> main                 0a7906b — the floors no blind could move (#303)  MOVED +1
>                      acb4efd — the reds that nothing could count (#302)
> branch 246           session246-the-floors-no-blind-could-move
>                      🟢 PUSHED · PR #303 MERGED, 26/26 green
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   726/726 · contract 24/24 · scope 30 · control 59
>               · instrument ok across 18 · LATE_LIVE 17/8 · 0 crashes · blast 1597
>               · py gates 18/3/15 · SIG 120/105 · late constructed 185/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1101 keys · 95 shortfalls
>               · unswept 0 · exempt 39 · term 285 file(s) / 21 suffixes
>               · taut 4131 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 33/33 claims · handoff 293 claims · 26 CI jobs
> ```"""),
    (247, """> ```
> main                 bee5529 — the members one language could not see (#304)  MOVED +1
>                      0a7906b — the floors no blind could move (#303)
> branch 247           session247-the-members-one-language-could-not-see
>                      🟢 PUSHED · PR #304 MERGED, 26/26 green
> host / addon         1.74.0 / 1.9.9   🟢 unmoved
> npm                  🟢 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   726/726 · contract 24/24 · scope 30 · control 59
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1657
>               · py gates 18/4/14 · SIG 130/105 · late constructed 193/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1132 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 285 file(s) / 21 suffixes
>               · taut 4131 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 37/37 claims · handoff 294 claims · 26 CI jobs
> ```"""),
    (248, """> ```
> main                 ea0fc2e — the command nothing had ever run (#305)  MOVED +1
>                      bee5529 — the members one language could not see (#304)
> branch 248           session248-the-command-nothing-had-ever-run
>                      🟢 PUSHED · PR #305 MERGED, 26/26 green
> host / addon         1.74.1 / 1.9.9   🔴 host MOVED — the cut is in the tree, not on npm
> npm                  🔴 1.74.0 · lag 0 · tags 121 · 0 open issues · 0 open PRs
> 🟢 VERIFIED AFTER THE CHANGE   756/756 · contract 24/24 · scope 30 · control 59
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1669
>               · py gates 18/4/14 · SIG 130/105 · late constructed 193/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1132 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 287 file(s) / 21 suffixes
>               · taut 4174 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 295 claims · 26 CI jobs
> ```"""),
    (249, """> ```
> main                 ea0fc2e — the command nothing had ever run (#305)   UNMOVED
> branch 249           session249-the-seams-between-two-working-things
>                      🔴 NOT PUSHED — the container cannot push (see Owed)
> host / addon         1.74.1 / 1.9.9   🟢 unmoved — no product code changed this session
> npm                  🟢 1.74.1 · lag 0 · tags 122 · gh UNREAD, no `gh` in this container
> 🟢 VERIFIED AFTER THE CHANGE   756/756 · contract 24/24 · scope 30 · control 59
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1669
>               · py gates 18/4/14 · SIG 130/105 · late constructed 193/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1132 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 287 file(s) / 21 suffixes
>               · taut 4174 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 296 claims · 26 CI jobs
> ```"""),
    (250, """> ```
> main                 ea0fc2e — the command nothing had ever run (#305)   UNMOVED
> branch 249           session249-the-seams-between-two-working-things
>                      🟢 PUSHED · its PR is open and unmerged — THIS BRANCH STACKS ON IT
> branch 250           session250-the-policy-that-spelled-itself-absent
>                      base 243748d, NOT ea0fc2e — say so on the patch
> host / addon         1.74.1 / 1.9.9   🟡 host code MOVED — no cut, no version bump
> npm                  🟢 1.74.1 · lag 0 · registry 1.74.1
> 🟢 VERIFIED AFTER THE CHANGE   764/764 · contract 24/24 · scope 30 · control 59
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1669
>               · py gates 18/4/14 · SIG 130/105 · late constructed 193/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1132 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 287 file(s) / 21 suffixes
>               · taut 4195 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 298 claims · 26 CI jobs
> ```"""),
    (251, """> ```
> main                 ea0fc2e — the command nothing had ever run (#305)   UNMOVED
> branch 249           session249-the-seams-between-two-working-things
>                      🟢 PUSHED · PR #306 open and unmerged
> branch 250           session250-the-policy-that-spelled-itself-absent
>                      🟢 PUSHED · PR #307 open and unmerged — 250's owed push is CLEARED
> branch 251           session251-the-column-nothing-had-ever-read
>                      base b18deb6, NOT ea0fc2e — say so on the patch. THIRD IN THE STACK
> host / addon         1.74.1 / 1.9.9   🟡 host code MOVED — no cut, no version bump
> npm                  🟢 1.74.1 · lag 0 · registry 1.74.1
> 🟢 VERIFIED AFTER THE CHANGE   768/768 · contract 24/24 · scope 31 · control 59
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1669
>               · py gates 18/4/14 · SIG 130/105 · late constructed 193/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1138 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 287 file(s) / 21 suffixes
>               · taut 4210 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 300 claims · 26 CI jobs
> ```"""),
    (252, """> ```
> main                 59e8e2a — the flag that demanded a game (#310)   MOVED, and it is THIS
> branch 250           session250-the-policy-that-spelled-itself-absent
>                      🟢 LANDED inside #309 · its own PR #308 CLOSED as superseded
> branch 251           session251-the-column-nothing-had-ever-read
>                      🟢 MERGED as #309 — it carried 250's commit with it
> branch 252           session252-the-heading-that-said-nothing
>                      🟢 MERGED as #310 · base was fadc10f · branch deleted
> host / addon         1.74.1 / 1.9.9   🟡 host code MOVED — no cut, no version bump
> npm                  🟢 1.74.1 · lag 0 · tags 122 · registry 1.74.1
> 🟢 VERIFIED AFTER THE CHANGE   774/774 · contract 24/24 · scope 32 · control 61
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1669
>               · py gates 18/4/14 · SIG 130/105 · late constructed 193/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1143 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 287 file(s) / 21 suffixes
>               · taut 4245 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3475 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 302 claims · 26 CI jobs
> ```"""),
    (253, """> ```
> main                 59e8e2a — the flag that demanded a game (#310)   UNMOVED at OPEN
> branch 253           session253-the-groups-that-were-only-ever-totals
>                      🔴 NOT YET PUSHED — patch only, base 59e8e2a
> host / addon         1.74.1 / 1.9.9   🟢 host code UNTOUCHED — docs and scripts only
> npm                  🟢 1.74.1 · lag 0 · tags 122 · registry 1.74.1
> 🟢 VERIFIED AFTER THE CHANGE   774/774 · contract 24/24 · scope 34 · control 64
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1669
>               · py gates 18/4/14 · SIG 130/105 · late constructed 193/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1150 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 287 file(s) / 21 suffixes
>               · taut 4245 · seal 103 · boundary 185 judged / DISCOVER 8-2-0
>               · wire_diff_key 292 tools / 3475 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 303 claims · 26 CI jobs
> ```
"""),
    (254, """> ```
> main                 69c3a91 — the sentences that named no next action (#312)   MERGED
> branch 254           session254-the-sentences-that-named-no-next-action
>                      🟢 PUSHED, 26/26 GREEN, SQUASH-MERGED — nothing is owed but the cut
> host / addon         1.74.1 / 1.10.0  🔴 HOST CODE MOVED — a release is owed
> npm                  🟢 1.74.1 · lag 0 · tags 122 · registry 1.74.1
> 🟢 VERIFIED AFTER THE CHANGE   778/778 · contract 25/25 · scope 36 · control 69
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1669
>               · py gates 18/4/14 · SIG 130/105 · late constructed 193/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 102 · 48 governed · 1160 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 287 file(s) / 21 suffixes
>               · taut 4262 · seal 103 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3475 nodes / 17 keys / 0 unread
>               · wire_invisible 27 + live · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 305 claims · 26 CI jobs
> ```
"""),
    (255, """> ```
> main                 69c3a91 — the sentences that named no next action (#312)   MERGED
> branch 255           session255-the-break-that-was-not-at-the-major
>                      🔴 A PATCH IS OWED — the container cannot push; cut from base 69c3a91
> host / addon         1.74.1 / 1.10.0  🔴 HOST CODE MOVED — a release is owed, and it is
>                      now TWO sessions' worth
> npm                  🟢 1.74.1 · lag 0 · tags 122 · registry 1.74.1
> 🟢 VERIFIED AFTER THE CHANGE   780/780 · contract 26/26 · scope 39 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1683
>               · py gates 18/4/14 · SIG 131/105 · late constructed 195/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 103 · 48 governed · 1170 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 291 file(s) / 21 suffixes
>               · taut 4270 · seal 103 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3655 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 306 claims · 26 CI jobs
> ```
"""),
    (256, """> ```
> main                 49ccb19 — release(1.75.0): the break that was not at the major,
>                      and the remedy two sessions owed (#314)   MERGED
> also merged          2ef89fe — the break that was not at the major (#313)   all green
> branch 256           session256-the-verdict-that-could-not-see-the-release
>                      🔴 A PATCH IS OWED — cut from base 49ccb19
> host / addon         1.75.0 / 1.10.0  🔴 HOST MOVED, this session's own cut; addon C4_OK
> tag                  🟢 v1.75.0 ANNOTATED at 49ccb19, declaring its own release commit
> npm                  🔴 1.75.0 · registry 1.74.1 · lag 0 by the ceiling's reading ·
>                      tags 123 · 0 open issues / 0 open PRs — THE PUBLISH IS OWED
> 🟢 VERIFIED AFTER THE CHANGE   780/780 · contract 26/26 · scope 39 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1683
>               · py gates 18/4/14 · SIG 131/105 · late constructed 195/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 103 · 48 governed · 1170 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 291 file(s) / 21 suffixes
>               · taut 4270 · seal 103 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3655 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 307 claims · 26 CI jobs
> ```
"""),
    (257, """> ```
> main                 bc05dba — the field that was true at a false time (#316)   MERGED
>                      26/26 green · branch deleted
> branch 257           none live — this session's work is on main
> host / addon         1.75.0 / 1.10.0  🟢 unmoved; no cut this session
> tag                  🟢 v1.75.0 ANNOTATED at 49ccb19
> npm                  🔴 1.75.0 · registry 1.74.1 · THE PUBLISH IS OWED AND IT IS
>                      BLOCKED ON A LOGIN — see §3.1
> 🟢 VERIFIED AFTER THE CHANGE   786/786 · contract 27/27 · scope 43 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1184 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 294 file(s) / 21 suffixes
>               · taut 4295 · seal 103 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 308 claims · 26 CI jobs
> ```
"""),
    (258, """> ```
> main                 bc05dba — the field that was true at a false time (#316)
> branch 258           session258-the-answer-that-did-not-survive-the-pipe
>                      🔴 A PATCH IS OWED — cut from base bc05dba
> host / addon         1.75.0 / 1.10.0  🟢 unmoved; no cut this session
> tag                  🟢 v1.75.0 ANNOTATED at 49ccb19
> npm                  🔴 1.75.0 · registry 1.74.1 · lag 1 · tags 123 — THE PUBLISH IS
>                      STILL OWED AND STILL BLOCKED ON A LOGIN, and the truncation below
>                      is a reason to want it
> 🟢 VERIFIED AFTER THE CHANGE   788/788 · contract 27/27 · scope 43 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1184 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 294 file(s) / 21 suffixes
>               · taut 4299 · seal 103 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · mutlock 5 + 12 cases · tree_quiet 13 · release_names 61/33
>               · queue 42/42 claims · handoff 309 claims · 26 CI jobs
> ```
"""),
    (259, """> ```
> main                 ca2d5d8 — the instruction that resolved and did nothing (#318)
>                      MERGED · 26/26 green · branch deleted
> also this session     657edec — the answer that did not survive the pipe (#317), which was
>                      258's owed patch, unapplied at pickup
> branch 259           none live — this session's work is on main
> host / addon         1.75.0 / 1.11.0  🔴 RE-STAMPED THIS SESSION — 1.10.0 named two trees
>                      🔴 AN ASSET LIBRARY SUBMISSION FOR 1.11.0 IS NOW OWED
> tag                  🟢 v1.75.0 ANNOTATED at 49ccb19
> npm                  🟢 1.75.0 · registry 1.75.0 · lag 0 — PUBLISHED FROM MAIN RATHER
>                      THAN FROM THE TAG, SEE THE OWED SECTION
> 🟢 VERIFIED AFTER THE CHANGE   805/805 · contract 27/27 · scope 45 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1189 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 297 file(s) / 21 suffixes
>               · seal 103 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · taut 4351 · mutlock 5 + 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 42/42 claims · handoff 310 claims · 26 CI jobs
> ```
"""),
    (260, """> ```
> main                 b76ff11 — release(1.76.0): the version that had already shipped under
>                      another name (#319) · MERGED · 26/26 green · branch deleted
> branch 260           none live — this session's work is on main
> host / addon         1.76.0 / 1.11.0  🟢 HOST MOVED, this session's own cut; addon C4_OK
>                      unmoved, still stamped at ca2d5d8
> tag                  🟢 v1.76.0 ANNOTATED at b76ff11, declaring its own release commit
> npm                  🟢 1.76.0 · registry 1.76.0 · lag 0 — PUBLISHED AND VERIFIED FROM
>                      OUTSIDE
> 🟢 VERIFIED AFTER THE CHANGE   805/805 · contract 27/27 · scope 45 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1189 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 297 file(s) / 21 suffixes
>               · seal 103 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · taut 4351 · mutlock 5 + 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 42/42 claims · handoff 310 claims · 26 CI jobs
> ```
"""),
    (261, """> ```
> main                 1dc2213 — the frame that was not on screen (#320)   MERGED
>                      26/26 green · branch deleted
> branch 261           none live — this session's work is on main
> host / addon         1.76.0 / 1.11.0  🟢 both unmoved; no cut this session, and the addon is
>                      untouched ON PURPOSE — the fix is host-side so no second Asset Library
>                      submission is owed while 1.11.0 is in review
> tag                  🟢 v1.76.0 ANNOTATED at b76ff11
> npm                  🟢 1.76.0 · registry 1.76.0 · lag 0
> 🟢 VERIFIED AFTER THE CHANGE   810/810 · contract 28/28 · scope 46 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1194 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 297 file(s) / 21 suffixes
>               · seal 103 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · taut 4374 · mutlock 5 + 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 42/42 claims · handoff 312 claims · 26 CI jobs
> ```
"""),
    # 🆕 262's block, added at 263 BEFORE the replay (253's rule). One atom differs from
    # what 262 wrote: `npm` read `1.77.0 · registry 1.76.0 · lag 1 — PUBLISH OWED`, and
    # the publish landed between the two sessions. `npm.lag` is REMOTE and re-read against
    # the live world, so the line is carried here as the world found it — 260's rule, which
    # is to correct the one world-facing atom rather than re-run fifty minutes of replay
    # for a number the registry moved.
    (262, """> ```
> main                 03d1d53 — the session that was not a stop (#321)   MERGED
>                      26/26 green · branch deleted
> branch 262           none live — this session's work is on main
> host / addon         1.77.0 / 1.11.0  🟢 HOST MOVED, this session's own cut; addon C4_OK
>                      unmoved, still stamped at ca2d5d8 — no second Asset Library
>                      submission is owed while 1.11.0 is in review
> tag                  🟢 v1.77.0 ANNOTATED at 03d1d53, declaring its own release commit
> npm                  🟢 1.77.0 · registry 1.77.0 · lag 0
> 🟢 VERIFIED AFTER THE CHANGE   816/816 · contract 28/28 · scope 46 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1194 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 297 file(s) / 21 suffixes
>               · seal 103 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · taut 4402 · mutlock 5 + 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 42/42 claims · handoff 313 claims · 26 CI jobs
> ```
"""),
    (263, """> ```
> main                 20a89e5 — the plane that was running in CI all along (#322)   MERGED
>                      26/26 green · branch deleted
> branch 263           none live — this session's work is on main
> host / addon         1.78.0 / 1.11.0  🟢 HOST MOVED, this session's own cut; addon C4_OK
>                      unmoved, still stamped at ca2d5d8 — no second Asset Library
>                      submission is owed while 1.11.0 is in review
> tag                  🟢 v1.78.0 ANNOTATED at 20a89e5, declaring its own release commit
> npm                  🟡 1.78.0 · registry 1.77.0 · lag 1 — PUBLISH OWED, see Owed below
> 🟢 VERIFIED AFTER THE CHANGE   822/822 · contract 28/28 · scope 46 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1194 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 297 file(s) / 21 suffixes
>               · seal 104 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · taut 4444 · mutlock 5 + 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 42/42 claims · handoff 314 claims · 26 CI jobs
> ```
"""),
    (264, """> ```
> main                 635cdb0 — the sentence that read like a measurement (#323)   MERGED
>                      26/26 green · branch deleted
> branch 264           none live — this session's work is on main
> host / addon         1.78.1 / 1.11.0  🟢 HOST MOVED, this session's own cut; addon
>                      unmoved, still stamped at ca2d5d8 — no second Asset Library
>                      submission is owed while 1.11.0 is in review
> tag                  🟢 v1.78.1 ANNOTATED at 635cdb0, declaring its own release commit
> npm                  🟢 1.78.1 · registry 1.78.1 · lag 0 · tags 127 — published from his TTY,
>                      artifact verified against its tag byte for byte
> 🟢 VERIFIED AFTER THE CHANGE   833/833 · contract 28/28 · scope 46 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1194 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 299 file(s) / 21 suffixes
>               · seal 104 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · taut 4469 · mutlock 5 + 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 42/42 claims · handoff 315 claims · 26 CI jobs
> ```
"""),
    (265, """> ```
> main                 45235ee — the hint that named a peer nobody contacted (#324)   MERGED
>                      26/26 green · branch deleted
> branch 265           none live — this session's work is on main
> host / addon         1.78.2 / 1.11.0  🟢 HOST MOVED, this session's own cut; addon
>                      unmoved, still stamped at ca2d5d8 — no second Asset Library
>                      submission is owed while 1.11.0 is in review
> tag                  🟢 v1.78.2 ANNOTATED at 45235ee, declaring its own release commit
> npm                  🟡 1.78.2 · registry 1.78.1 · lag 1 — PUBLISH OWED, see Owed below
> 🟢 VERIFIED AFTER THE CHANGE   850/850 · contract 28/28 · scope 46 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1194 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 301 file(s) / 21 suffixes
>               · seal 104 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · taut 4517 · mutlock 5 + 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 42/42 claims · handoff 316 claims · 26 CI jobs
> ```
"""),
(266, """> ```
> main                 cba323a — the question that named the wrong culprit (#325)   MERGED
>                      26/26 green · branch deleted
> branch 266           none live — this session's work is on main
> host / addon         1.78.3 / 1.11.0  🟢 HOST MOVED, this session's own cut; addon
>                      unmoved, still stamped at ca2d5d8, C4_OK — no second Asset Library
>                      submission is owed while 1.11.0 is in review
> tag                  🟢 v1.78.3 ANNOTATED at cba323a, declaring its own release commit
> npm                  🟡 1.78.3 · registry 1.78.2 · lag 1 · tags 129 — PUBLISH OWED
> 🟢 VERIFIED AFTER THE CHANGE   866/866 · contract 28/28 · scope 46 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1194 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 303 file(s) / 21 suffixes
>               · seal 104 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3671 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · taut 4577 · mutlock 5 + 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 42/42 claims · handoff 317 claims · 26 CI jobs
> ```
"""),
    (267, """> ```
> main                 eaadaa1 — the answers that had nowhere to go (#326)   MERGED
>                      26/26 green · branch deleted
> branch 267           none live — this session's work is on main
> host / addon         1.79.0 / 1.11.0  🟢 HOST MOVED, this session's own cut; addon
>                      unmoved, still stamped at ca2d5d8, C4_OK — no second Asset Library
>                      submission is owed while 1.11.0 is in review
> tag                  🟢 v1.79.0 ANNOTATED at eaadaa1, declaring its own release commit
> npm                  🟡 1.79.0 · registry 1.78.3 · lag 1 — PUBLISH OWED, needs his TTY
> 🟢 VERIFIED AFTER THE CHANGE   886/886 · contract 28/28 · scope 48 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105 · late constructed 197/160
>               · late not-loaded 0 · discover 52/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1200 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 306 file(s) / 21 suffixes
>               · seal 104 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3680 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 files
>               · taut 4662 · mutlock 5 + 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 42/42 claims · handoff 318 claims · 26 CI jobs
> ```
"""),
]

# ── 🆕 244 §2 — `population-reach-floor` (OPEN 239) — HOW FAR BACK, NOT HOW WIDE ──────
#
# 🔴 EVERY FLOOR THIS FILE HAS ON `BLOCK_POPULATION` IS A FLOOR ON ITS WIDTH.
# `ALIAS_SPELLING_FLOOR`, `HEADER_FLOOR`, `READER_FLOOR` and `CLAIM_FLOOR` all count
# things and refuse a small number, and a table that dropped 227 as it added 243 would
# satisfy every one of them: same width, same spellings, same claims, one session less
# reach. Nothing said a word about the direction the table loses.
#
# 🔴 AND THE COST OF LOSING IT IS NOT ONE CLAIM. Two readers take their FAR endpoint out
# of this table by construction — `moved_interval` reads the previous block's main SHA
# and `version_interval` (243) reads the previous block's version pair — so the oldest
# block in the table is the oldest interval either can measure. A sliding window keeps
# the newest claims answerable and quietly makes the old ones UNREAD, which is the shape
# 244 §1 found on CI: not a red, an absence, reported by nothing.
#
# 🔴 AND THE FIRST DRAFT OF THIS FLOOR WAS A WIDTH FLOOR WEARING A DIFFERENT WORD, WHICH
# THE CONTROL FOUND IN ONE RUN. It floored `newest - oldest`, and a contiguous table's
# reach IS its width minus one — so the sliding window it was written to refuse satisfied
# it exactly, and the claim restated `len()` in arithmetic. What cannot be satisfied by
# sliding is a PIN ON THE BACK: the oldest block the table has ever held, written down,
# so dropping it is an edit to a literal `floor_pin_gate` governs rather than a table one
# block shorter at the end nobody reads. Reach then grows on its own, every session.
#
# 🔴 TWO CLAIMS BECAUSE ONE OF THEM ALONE IS TRIVIAL. A table holding 227 and 242 and
# nothing between reaches its pin and measures two intervals; a table holding 240–242 is
# contiguous and reaches nothing. Neither half is satisfiable by adding blocks at the
# front, which is the property `SCRIPT_POPULATION_FLOOR` has and a `len()` floor does not.
# 🔴 AND THE NAME IS `_FLOOR` WHILE THE COMPARISON IS `<=`, WHICH IS NOT A SLIP.
# `floor_pin_gate.py`'s DISCOVER half reads names, and its `UNDISCOVERABLE_CEILING` is
# zero with a written reason: *the fix is still the constant's name rather than a wider
# guess.* A floor on REACH, expressed as the newest session number the OLDEST block may
# carry — so the number goes DOWN as the claim gets stronger, and a session that wants to
# drop the back has to edit a governed literal to do it.
POPULATION_REACH_FLOOR = 227   # the oldest block this table has ever reached


def population_reach_problems(pop: "list[tuple[int, str]]",
                              back: int = POPULATION_REACH_FLOOR) -> "list[str]":
    """What is wrong with how far back a block population reaches. Pure."""
    out: "list[str]" = []
    sessions = [s for s, _t in pop]
    if len(sessions) < 2:
        return [f"POPULATION_REACH {sessions} — a table of fewer than two blocks spans "
                f"no interval at all, so every reader taking its far endpoint out of it "
                f"is UNREAD and nothing here can say so"]
    if sessions[0] > back:
        out.append(f"POPULATION_REACH the oldest block is {sessions[0]} and the pin is "
                   f"{back} — the table dropped its back. Width says nothing about this: "
                   f"a window that slides forward keeps every count this file floors and "
                   f"takes the far endpoint off `moved_interval` and `version_interval` "
                   f"without either one going red. Moving the pin is the decision")
    gaps = [f"{a}→{b}" for a, b in zip(sessions, sessions[1:]) if b - a != 1]
    if gaps:
        out.append(f"POPULATION_CONTIGUOUS {gaps} — a hole in the table is a block whose "
                   f"interval readers point at the wrong previous session and answer "
                   f"confidently. Reaching the pin without contiguity is two blocks and a "
                   f"long subtraction")
    return out


# ── 🔴 237 §3 — THE POPULATION THE `SINCE` BOUNDARIES WERE MEASURED OVER ──────────────
#
# Four real counter lines, verbatim, spanning the two sessions where every boundary sits.
# The handoffs are not tracked (`.gitignore`: `HANDOFF*.md`), so a walk of the directory
# would measure nothing in CI and nothing in a fresh clone — the population has to be IN
# the file, the way `HISTORY_PINS` and `REAL_BLOCK` already are. These are not shaped to
# pass: 231 is the last block before the axes exist, 232 introduces four of the six,
# 233 carries two of those four and DROPS the other two, and 236 carries all six.
#
# 🔴 THE `SINCE` CLAIM IS ASSERTED IN BOTH DIRECTIONS OVER THIS TABLE. Forward: a row
# REQUIRED at n is carried by every block here numbered n or later — a boundary set too
# early reddens a block that was correct. Backward: at least one block earlier than n
# does NOT carry it — a boundary set too late, or set at all on a counter that was always
# universal, is an exemption covering nothing, which is the class 236 §4 deleted two of
# from `HEADER_EXEMPT` and the one this table would otherwise re-introduce a file over.
SINCE_POPULATION: "list[tuple[int, str]]" = BLOCK_POPULATION


def block_keys(text: str) -> "set[str]":
    """The reader keys a block's counter line claims — the roster's own parse, reused."""
    block, why = status_block(text)
    if why:
        return set()
    atoms, why = counter_atoms(block)
    if why:
        return set()
    return {k for k in (bind(a)[0] for a in atoms) if k}


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

# 🔴 236 §9.1's REPLAY, VERBATIM, AND IT IS THE POSITIVE CONTROL FOR THE ORDER HALF.
# Captioned *"Replay, executed verbatim against the committed tree"* — a file that was
# really written and really run, top to bottom, whose log really answered the gate. It is
# the only fixture here that satisfies every rule, and each negative below is this text
# with ONE documented edit, so a rule that stopped firing has nothing else to blame.
SHIPPED_REPLAY = """```bash
cd host && npm ci --include=dev && npm run build
python3 -m pyflakes --version || pip install pyflakes --break-system-packages   # §5

npm test | tail -20 > run.log                                    # -> 724/724

python3 ../scripts/handoff_gate.py --selftest        | tee -a run.log
node scripts/tautology_gate.mjs                      | tee -a run.log
python3 ../scripts/lint_ceiling.py                   | tee -a run.log
python3 ../scripts/contract_check.py                 | tee -a run.log

# the mutating three — one at a time (178 §11.4), in the CONTAINER, into the SAME log
python3 ../scripts/instrument_gate.py                | tee -a run.log
python3 ../scripts/scope_gate.py                     | tee -a run.log
python3 ../scripts/control_gate.py                   | tee -a run.log

# and the block above, read back off the instruments that printed it
python3 ../scripts/handoff_gate.py ../HANDOFF_SESSION236.md --measured run.log --network
```
"""

# (the edit, what it breaks, the word the refusal has to carry). One line moved or joined
# per row — nothing invented, nothing removed — so every ORDER rule is asserted against a
# real input in both directions. A rule with no row here is 237 §2's own subject arriving
# one file later: a claim asserted against nothing.
REPLAY_NEGATIVES: "list[tuple[str, str, str]]" = [
    ("npm test | tail -20 > run.log                                    # -> 724/724\n",
     "", "instrument_gate.py"),
    ("python3 -m pyflakes --version || pip install pyflakes "
     "--break-system-packages   # §5\n", "", "lint_ceiling.py"),
    ("python3 ../scripts/scope_gate.py                     | tee -a run.log",
     "python3 ../scripts/scope_gate.py | tee -a run.log && "
     "python3 ../scripts/control_gate.py | tee -a run.log", "MUTATING gates"),
    ("--measured run.log --network\n",
     "--measured run.log --network\nnode scripts/seal_order_gate.mjs | tee -a run.log\n",
     "AFTER the gate has already read it"),
]

# 🔴 237 §7.1's REPLAY, VERBATIM, AND IT IS THE NEGATIVE CONTROL FOR THE SEGMENT HALF.
# A file that was really written (`host/replay237.sh`) and really run, top to bottom,
# whose log really answered the gate — and which routes the wrong half of three of its
# own lines. 237 found that by hand and wrote it down as NEXT 3; this is the input, kept
# as it shipped, so the rule is asserted against the defect rather than against a shape
# invented after the rule existed. Exactly ONE row reads a command in an unrouted
# segment: `wire_invisible.cases` reads the selftest, and the `| tee` binds to the gate.
SEGMENT_REPLAY = """```bash
cd host && npm ci --include=dev && npm run build
python3 -m pyflakes --version || pip install pyflakes --break-system-packages   # §2

npm test | tail -20 > run.log                                    # -> 724/724

python3 ../scripts/handoff_gate.py --selftest        | tee -a run.log
node scripts/boundary_gate.selftest.mjs && node scripts/boundary_gate.mjs        | tee -a run.log
node scripts/wire_diff.selftest.mjs && node scripts/wire_diff.mjs --discover     | tee -a run.log
node scripts/wire_invisible_gate.selftest.mjs && node scripts/wire_invisible_gate.mjs | tee -a run.log
node scripts/tautology_gate.mjs                      | tee -a run.log
node scripts/seal_order_gate.mjs                     | tee -a run.log
python3 ../scripts/terminology_gate.py               | tee -a run.log
python3 ../scripts/registry_lag.py                   | tee -a run.log
python3 ../scripts/lint_ceiling.py                   | tee -a run.log
python3 ../scripts/floor_pin_gate.py                 | tee -a run.log
python3 ../scripts/mutation_lock_gate.py             | tee -a run.log
python3 ../scripts/tree_quiet.py                     | tee -a run.log
python3 ../scripts/contract_check.py                 | tee -a run.log

python3 ../scripts/instrument_gate.py                | tee -a run.log
python3 ../scripts/scope_gate.py                     | tee -a run.log
python3 ../scripts/control_gate.py                   | tee -a run.log

python3 ../scripts/handoff_gate.py --patterns --measured run.log | tee -a run.log

python3 ../scripts/handoff_gate.py ../HANDOFF_SESSION237.md --measured run.log --network
```
"""

# the same replay with ONE documented edit — the self-test moved onto a line of its own,
# routed, which is what 238's §7.1 does. Nothing else changes.
SEGMENT_FIXED = SEGMENT_REPLAY.replace(
    "node scripts/wire_invisible_gate.selftest.mjs && "
    "node scripts/wire_invisible_gate.mjs | tee -a run.log",
    "node scripts/wire_invisible_gate.selftest.mjs        | tee -a run.log\n"
    "node scripts/wire_invisible_gate.mjs                 | tee -a run.log")

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

    # ── 🔴 238 §2 — THE ALIAS, AGAINST EVERY BLOCK THAT EXISTS ────────────────────────
    #
    # 237 NEXT 2's third of the row. `cmd` and `extract` are asserted against a live
    # instrument by `--patterns`; the alias needs no instrument at all — it needs the
    # English real blocks are written in — so it belongs HERE, where the population is
    # embedded and CI reads it on a machine with nothing installed. That partition is the
    # answer to *"only two of the three are asserted against something real"*, and it is
    # written down rather than implied, because an unstated partition is how the alias
    # ended up being the one nothing covered.
    #
    # 🔴 EVERY ATOM OF EVERY REAL COUNTER LINE BINDS TO EXACTLY ONE READER. 222 of them
    # across eleven blocks, against 33 hand-written pins — and `bind()` already refuses
    # both failure modes, so what this adds is not a rule but a POPULATION: the rule has
    # been correct about 45% of the spellings it has to read and silent about the rest.
    unbound: "list[str]" = []
    ambiguous: "list[str]" = []
    seen_atoms = 0
    reached: "set[str]" = set()
    spellings: "set[str]" = set()
    for sess, text in BLOCK_POPULATION:
        pop_block, why_p = status_block(text)
        pop_atoms, why_a = counter_atoms(pop_block)
        claims += 1
        if why_p or why_a or len(pop_atoms) < 7:
            failed += 1
            print(f"  🔴 BLOCK_PARSE {sess} — {why_p or why_a or f'{len(pop_atoms)} atom(s)'}"
                  f". A block this file cannot parse contributes no coverage and says "
                  f"nothing about it; 227 is the smallest real one and carries seven")
            continue
        seen_atoms += len(pop_atoms)
        for a in pop_atoms:
            spellings.add(a)
            key, problem = bind(a)
            if key:
                reached.add(key)
            elif "binds to NO reader" in problem:
                unbound.append(f"{sess}: {a!r}")
            else:
                ambiguous.append(f"{sess}: {a!r}")

    claims += 1
    if unbound or ambiguous:
        failed += 1
        print(f"  🔴 ALIAS_POPULATION {len(unbound)} atom(s) bind to NO reader and "
              f"{len(ambiguous)} bind to more than one, over {seen_atoms} atom(s) in "
              f"{len(BLOCK_POPULATION)} real blocks.\n"
              f"     unbound: {unbound[:6]}\n     ambiguous: {ambiguous[:6]}\n"
              f"     An alias narrowed to fix today's block un-reads every earlier one "
              f"that spelled the counter differently, and the earlier ones are already "
              f"written and cannot be re-worded.")

    # 🔴 AND THE COVERAGE CLAIM IS THE OTHER DIRECTION, WHICH `ROSTER` MAKES AGAINST THE
    # PINS. A reader reachable only from a hand-written atom is a reader no session has
    # ever actually used — the roster's own DISCOVER half, asked of the roster.
    claims += 1
    never_used = [k for k, *_ in COUNTER_READERS if k not in reached and k not in ALIAS_PENDING]
    if never_used:
        failed += 1
        print(f"  🔴 ALIAS_UNUSED {never_used} — no atom in any of the "
              f"{len(BLOCK_POPULATION)} real blocks reaches these rows. Either the "
              f"counter is spelled in a way the alias cannot see, or the row reads a "
              f"counter no handoff has ever carried and `BIND_PINS` is the only thing "
              f"keeping it alive")

    # 🆕 246 — AND THE PENDING ROWS, WHICH EXPIRE BY THEMSELVES. A row whose atom has
    # ARRIVED is stale the moment the block carrying it joins the table, and a row naming
    # a reader that no longer exists is stale too. Both are refusals, so the table cannot
    # become a quiet second exemption list: the only way a key stays in it is for the block
    # that was supposed to carry the counter never to have been added — which is the state
    # 240's row sat in for five sessions with nothing saying so.
    claims += 1
    reader_keys = {r[0] for r in COUNTER_READERS}
    stale_pending = pending_problems(ALIAS_PENDING, reached, reader_keys)
    if stale_pending:
        failed += 1
        print(f"  🔴 ALIAS_PENDING_STALE {stale_pending} — an exemption its own walk can "
              f"falsify must not need a session to re-read it")
    if ALIAS_PENDING:
        print(f"  · ALIAS_PENDING {len(ALIAS_PENDING)} reader(s) whose first block is the "
              f"one being written this session: {sorted(ALIAS_PENDING)}")

    # 🔴 AND THE PREDICATE ITSELF, ON INPUTS IT MUST FLAG AND ONE IT MUST NOT. Every branch
    # above is quiet on a healthy tree, which is the whole reason these three exist.
    for label, args, want in (
            ("a pending row whose atom has arrived", ({"a": "why"}, {"a"}, {"a"}), True),
            ("a pending row naming no reader", ({"gone": "why"}, set(), {"a"}), True),
            ("a pending row still genuinely unreached", ({"a": "why"}, set(), {"a"}), False)):
        claims += 1
        if bool(pending_problems(*args)) is not want:
            failed += 1
            print(f"  🔴 ALIAS_PENDING_FIXTURE pending_problems is wrong about {label} — a "
                  f"table whose staleness nothing proves is a second exemption list")

    # 🔴 THE SPELLING FLOOR, WHICH IS WHAT MAKES THE TWO CLAIMS ABOVE HARD TO SATISFY BY
    # SHRINKING. Both go green if the population stops parsing; this one goes red. 71
    # distinct spellings today over 29 readers — the drift is the measurement, not an
    # anecdote, and an alias edit that costs the roster a spelling reddens here first.
    # 🔴 AND IT IS PINNED FROM BOTH SIDES BY TWO REAL WALKS, which is 184 §7's rule and
    # the one `floor_pin_gate.py` refuses this row without. Below: the spellings of the
    # NEWEST BLOCK ALONE — a floor at or under that is satisfied by a walk that read the
    # block in front of the author and stopped, which is the exact shrinkage this floor
    # exists to catch. Above: all eleven. Zeroing the floor fails the first bound and
    # raising it past the population fails the second, so the value is asserted rather
    # than merely present.
    newest = set(counter_atoms(status_block(BLOCK_POPULATION[-1][1])[0])[0])
    claims += 1
    if not (len(newest) < ALIAS_SPELLING_FLOOR <= len(spellings)):
        failed += 1
        print(f"  🔴 ALIAS_SPELLINGS floor {ALIAS_SPELLING_FLOOR} is not in "
              f"({len(newest)}, {len(spellings)}] — {len(spellings)} distinct atom "
              f"spelling(s) over {len(BLOCK_POPULATION)} blocks and {len(newest)} in the "
              f"newest one alone. `ALIAS_POPULATION` and `ALIAS_UNUSED` are both "
              f"satisfied by a population that stopped parsing; this is the one that is "
              f"not, and a floor inside one block's spellings would not be either")

    # 🔴 THE PINS ARE NOT THE POPULATION AND THIS SAYS BY HOW MUCH. Not a refusal — a
    # hand-written pin naming a spelling no block carries is legitimate, and `handoff 87
    # claims` is one — but a number printed rather than a feeling, because 237's finding
    # is that an instruction carrying a count is owed the count.
    invented = [a for a, _e, _w in BIND_PINS if a not in spellings]
    print(f"  · ALIAS_COVERAGE {len(spellings)} spelling(s) in {len(BLOCK_POPULATION)} "
          f"real blocks · {seen_atoms} atom(s) · {len(BIND_PINS)} pin(s) reaching "
          f"{len(BIND_PINS) - len(invented)} of them · {len(invented)} pin(s) no block "
          f"carries: {invented}")

    # 🔴 AND THE HEADER HALF, WHICH IS WHERE THE WALK FOUND SOMETHING. Every header atom
    # of every real block resolves — after `HEADER_EXEMPT`, and after a compound atom is
    # split — to exactly one reader each. Before 238 this was five refusals across
    # 227–231 on blocks that were correct.
    h_unresolved: "list[str]" = []
    h_reached: "set[str]" = set()
    for sess, text in BLOCK_POPULATION:
        pop_block, _pw = status_block(text)
        for raw, cleaned in header_atoms(pop_block)[0]:
            hits = [r for r in HEADER_READERS if re.search(r[1], cleaned, re.I)]
            if len(hits) == 1:
                h_reached.add(hits[0][0])
                continue
            split, why_not = split_compound(cleaned, HEADER_READERS) if hits else (None, "")
            if split is None:
                h_unresolved.append(f"{sess}: {raw!r} -> "
                                    f"{[r[0] for r in hits]} ({why_not or 'no reader'})")
            else:
                h_reached |= {r[0] for r, _p in split}

    claims += 1
    if h_unresolved:
        failed += 1
        print(f"  🔴 HEADER_ALIAS_POPULATION {len(h_unresolved)} header atom(s) across "
              f"the real blocks resolve to no reader or to more than one:\n     "
              + "\n     ".join(h_unresolved[:6])
              + "\n     A header roster built against the blocks in front of its author "
                "refuses the ones behind them, which is 237 §1's finding in the other "
                "half of this file.")

    claims += 1
    h_never = [k for k, *_ in HEADER_READERS if k not in h_reached]
    if h_never:
        failed += 1
        print(f"  🔴 HEADER_ALIAS_UNUSED {h_never} — no header atom in any real block "
              f"reaches these rows")

    # 🔴 THE SPLIT'S NEGATIVE, AND IT IS 231's OWN ATOM WITH ONE DOCUMENTED EDIT — the
    # `2` removed. Two aliases still match, the spans are still disjoint, and the second
    # piece now carries no numeral: the atom names two readers and cannot say what one of
    # them claims. That must REFUSE, because a split that quietly gave `gh.prs` an empty
    # claim would compare nothing and print `compared` one higher, which is the silent
    # green this whole file is against.
    claims += 1
    ok_split, _w = split_compound("0 open issues / 2 open PRs (ours)", HEADER_READERS)
    bad_split, bad_why = split_compound("0 open issues / open PRs (ours)", HEADER_READERS)
    if (ok_split is None or [r[0] for r, _p in ok_split] != ["gh.issues", "gh.prs"]
            or bad_split is not None or "no numeral" not in bad_why):
        failed += 1
        print(f"  🔴 SPLIT_COMPOUND 231's atom -> "
              f"{[r[0] for r, _p in ok_split] if ok_split else None}, pinned "
              f"['gh.issues', 'gh.prs']; the same atom with one numeral removed -> "
              f"{bad_why!r}, pinned a refusal naming the empty piece")

    # 🔴 AND `bind()`'s AMBIGUITY IS UNTOUCHED. The counter line does NOT split: `807
    # keys` reaching two readers means one of them is wrong about the same span, and
    # nothing here can say which. A session that read the paragraph above and generalised
    # it one function further would have resolved that collision by position, which is
    # the mistake `resolve_sig` was written against.
    claims += 1
    collision = "wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread"
    if bind(collision)[0] != "wire_diff.key" or bind("807 keys")[0] != "floor_pin.literal":
        failed += 1
        print(f"  🔴 BIND_UNSPLIT {collision!r} -> {bind(collision)[0]!r} and '807 keys' "
              f"-> {bind('807 keys')[0]!r} — the counter line resolves this collision by "
              f"a negative lookahead, not by splitting, and it must stay that way")

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
    # 🆕 243 §3 — `version.unmoved` JOINS THE PIN AND `git.unmoved` DOES NOT, and the
    # asymmetry is the measurement rather than an oversight. This block claims `MOVED +1`
    # on its main row and `unmoved` on its `host / addon` row, so exactly one of the two
    # word claims is reachable from it; the other is proved against the population by
    # `UNMOVED_POPULATION` below, over the blocks that actually printed it.
    if got_keys != ["ci.green", "gh.issues", "gh.prs", "git.moved", "npm.lag",
                    "npm.tags", "version.unmoved"]:
        failed += 1
        print(f"  🔴 HEADER_BIND {got_keys}, pinned ['ci.green', 'gh.issues', 'gh.prs', "
              f"'git.moved', 'npm.lag', 'npm.tags', 'version.unmoved'] — atoms {h_atoms}")

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

    # 🔴 BOTH DIRECTIONS ON THE EXEMPTION TABLE, OVER ALL ELEVEN BLOCKS — AND THE COMMENT
    # ABOVE THIS TABLE HAS SAID SO SINCE 236 WHILE THE CODE READ ONE. *"`HEADER_EXEMPT_
    # UNUSED` refuses a row that matched nothing across THE REAL BLOCKS THE SELF-TEST
    # WALKS"* — the self-test walked 234's header alone, so a row covering a spelling
    # only 231 uses looked like a row covering nothing. 238's `\b\d+'s\b` is exactly that
    # row: it fires on one block out of eleven, which is a reason that is true rather
    # than a reason that is popular. A sentence describing a wider population than the
    # loop beneath it is this session's whole subject, and it was in the comment above
    # the table the subject is about.
    exempt_fired: "set[str]" = set()
    for _sess, text in BLOCK_POPULATION:
        pop_block, _pw = status_block(text)
        exempt_fired |= header_atoms(pop_block)[1]
    for pat, why in HEADER_EXEMPT:
        claims += 1
        if pat not in exempt_fired:
            failed += 1
            print(f"  🔴 HEADER_EXEMPT_UNUSED {pat} matched nothing in any of the "
                  f"{len(BLOCK_POPULATION)} real headers — an exemption nobody "
                  f"re-derives is 233 §18's class ({why[:50]}…)")

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

    # ── 🆕 242: THE REPLAY LIST AGAINST THE WORKFLOW FILES ────────────────────────────
    #
    # Fixture-fed in both directions, because on a healthy tree BOTH lists are empty and
    # an inline version is deleted by anything and noticed by nothing — `instrument_gate
    # .py`'s written reason for `late_marker_roster_problems`, one reader over.
    _CI = {"a.py": {"ci.yml"}, "b.mjs": {"ci.yml"}, "probe.mjs": {"integration.yml"},
           "handoff_gate.py": {"ci.yml"}}
    _fence = ("```bash\npython3 a.py\nnode b.mjs\n"
              "python3 handoff_gate.py x --measured run.log\n```")
    claims += 1
    if replay_ci_problems(_fence, _CI, floor=4, exempt={})[0]:
        failed += 1
        print("  🔴 REPLAY_CI a replay naming every non-exempt CI script was refused — "
              "and `integration.yml`'s probe must not be demanded of a local ritual")
    claims += 1
    _short = "```bash\npython3 a.py\npython3 handoff_gate.py x --measured run.log\n```"
    if not any("REPLAY_MISSING `b.mjs`" in p for p in replay_ci_problems(_short, _CI, floor=4, exempt={})[0]):
        failed += 1
        print("  🔴 REPLAY_CI a merge-blocking command absent from the replay was not "
              "reported — which is 241's own experience with spec_conformance.py")
    claims += 1
    _extra = _fence.replace("node b.mjs", "node b.mjs\npython3 nowhere.py")
    if not any("CI_MISSING `nowhere.py`" in p for p in replay_ci_problems(_extra, _CI, floor=4, exempt={})[0]):
        failed += 1
        print("  🔴 REPLAY_CI a command that runs only where the handoff is written was "
              "not reported — the other direction, and a check nobody else ever runs")
    # 🔴 THE FLOOR ON THE READER ITSELF, which is the one that matters: a regex that
    # stopped matching reports an EMPTY CI roster and perfect agreement with everything.
    claims += 1
    if not any("REPLAY_CI_FLOOR" in p for p in replay_ci_problems(_fence, _CI, floor=9, exempt={})[0]):
        failed += 1
        print("  🔴 REPLAY_CI a CI roster far below its floor was compared against "
              "instead of refused — an empty roster agrees with every replay ever written")
    # 🔴 AND THE LIVE READER, against the live workflows: the comment trap named in
    # `ci_scripts`. Six comments in ci.yml spell script names in backticks; a reader
    # anchored anywhere but `run:` counts them and this claim is what says it does not.
    # 🔴 BRACKETED FROM BOTH SIDES, WHICH IS `HEADER_FLOOR`'s IDIOM AND THE ONLY KIND OF
    # PIN `floor_pin_gate.py` COUNTS. The live gate reads this only as `len(ci) < FLOOR`,
    # so ZEROING IT MAKES THE READER MORE PERMISSIVE and no live run can notice; the lower
    # bracket is what fails when it is zeroed. The bracket is the exemption table's size
    # rather than a magic number, because a floor at or under the number of declared
    # CI-only scripts is a floor that could be satisfied by the exemptions alone.
    claims += 1
    _live_ci = ci_scripts()
    if not (len(REPLAY_CI_EXEMPT) < CI_SCRIPT_FLOOR <= len(_live_ci)) \
            or "registry_lag.py" not in _live_ci:
        failed += 1
        print(f"  🔴 REPLAY_CI the live workflow read found {len(_live_ci)} script(s) "
              f"against floor {CI_SCRIPT_FLOOR} and {len(REPLAY_CI_EXEMPT)} exemption(s), "
              f"and {'did not find' if 'registry_lag.py' not in _live_ci else 'found'} a "
              f"command it certainly runs")
    claims += 1
    if any(s.endswith(".yml") or s.endswith(".yaml") for s in _live_ci):
        failed += 1
        print("  🔴 REPLAY_CI the workflow reader counted a `.yml` as a script — the "
              "suffix roster is what keeps `uses:` and `if:` lines out of the population")

    # ── 🆕 243: THE THIRD DIRECTION — WHAT NEITHER ROSTER REACHES ─────────────────────
    #
    # Fixture-fed, for the reason the block above gives: on a healthy tree the finding
    # list is empty, and a claim that only ever reads an empty list is a claim that holds
    # after the reader is deleted.
    _paths = ["scripts/a.py", "host/scripts/b.mjs", "host/scripts/lonely.mjs",
              "scripts/handoff_gate.py"]
    _edges = {"a.py": set(), "b.mjs": set(), "lonely.mjs": set(), "handoff_gate.py": set()}
    claims += 1
    _p = unreached_problems(_fence, _CI, _paths, _edges, floor=4, exempt={})[0]
    if not any("UNREACHED `host/scripts/lonely.mjs`" in p for p in _p):
        failed += 1
        print("  🔴 UNREACHED a tracked script in neither roster was not reported — which "
              "is the state both P0 reporters shipped in, unable to LINK on two thirds of "
              "this project's own CI matrix, past 26 green jobs")
    # 🔴 THE LOAD HALF, AND IT IS THE CLAIM THAT SEPARATES THIS READER FROM AN
    # INVOCATION-ONLY ONE. `lonely.mjs` is named by nothing; the ONLY thing that changes
    # between these two runs is that a file the roster DOES invoke imports it. A reader
    # that counted invocations would report it both times and be wrong the second time —
    # and wrong in exactly the way that would have condemned `p0_complexity.mjs`, which
    # no `run:` line names and whose self-test in `ci.yml` imports it.
    claims += 1
    _edges_linked = dict(_edges, **{"b.mjs": {"lonely.mjs"}})
    if unreached_problems(_fence, _CI, _paths, _edges_linked, floor=4, exempt={})[0]:
        failed += 1
        print("  🔴 UNREACHED a script LOADED by a rostered file was reported unread — a "
              "load is what catches a link error, and it is how 242 closed the two P0 "
              "reporters without giving either one a `run:` line")
    claims += 1
    _p = unreached_problems(_fence, _CI, _paths, _edges_linked, floor=4,
                            exempt={"lonely.mjs": "why"})[0]
    if not any("UNREACHED_EXEMPT_STALE `lonely.mjs`" in p for p in _p):
        failed += 1
        print("  🔴 UNREACHED_EXEMPT_STALE an exemption the closure now reaches was not "
              "reported — 174 §5, and `REPLAY_CI_EXEMPT_STALE` caught it on its own "
              "author's table on the first run")
    claims += 1
    _p = unreached_problems(_fence, _CI, _paths, _edges, floor=4,
                            exempt={"lonely.mjs": "why", "deleted.mjs": "why"})[0]
    if not any("UNREACHED_EXEMPT_STALE `deleted.mjs`" in p for p in _p):
        failed += 1
        print("  🔴 UNREACHED_EXEMPT_STALE an exemption naming a file that is not tracked "
              "at all was not reported — the silent shape, which can never fire and reads "
              "as coverage")
    # 🔴 THE FLOOR OVER THE POPULATION, which is the failure that makes every other claim
    # here vacuous: `git ls-files` answering with nothing yields no findings and a green
    # run that opened no files. Bracketed from both sides against the live tree below.
    claims += 1
    _p = unreached_problems(_fence, _CI, _paths, _edges, floor=9, exempt={})[0]
    if not (_p and "SCRIPT_POPULATION_FLOOR" in _p[0] and len(_p) == 1):
        failed += 1
        print("  🔴 SCRIPT_POPULATION_FLOOR a population far below its floor was walked "
              "instead of refused — and it must refuse INSTEAD of reporting, or the "
              "findings from a half-read tree read as the findings from a whole one")
    # 🔴 AND THE LIVE HALVES. Three, because the reader has three parts that can each go
    # quiet on their own: the population, the import closure, and the exemption table.
    claims += 1
    _live_paths = tracked_scripts()
    if not (len(UNREACHED_EXEMPT) < SCRIPT_POPULATION_FLOOR <= len(_live_paths)):
        failed += 1
        print(f"  🔴 SCRIPT_POPULATION_FLOOR is {SCRIPT_POPULATION_FLOOR} against "
              f"{len(_live_paths)} tracked script(s) and {len(UNREACHED_EXEMPT)} "
              f"exemption(s) — a floor at or under the exemption table is a floor the "
              f"exemptions alone could satisfy")
    # 🔴 THE CLOSURE, ON THE ONE EDGE THIS ROW EXISTS BECAUSE OF. `p0_complexity.mjs` is
    # in no workflow and no replay row; `p0_complexity.selftest.mjs` is in both and
    # imports it. If `ESM_IMPORT_RE` ever stops matching, this reader starts demanding a
    # `run:` line for every module in the tree and gets ignored — which is the death of a
    # gate, not a failure of one.
    claims += 1
    _live_edges = import_edges(_live_paths)
    if "p0_complexity.mjs" not in _live_edges.get("p0_complexity.selftest.mjs", set()):
        failed += 1
        print("  🔴 UNREACHED the import closure does not see `p0_complexity.selftest.mjs "
              "-> p0_complexity.mjs`, the one edge 242 built to close the Node-engine "
              "defect — the specifier regex has stopped matching")
    # 🔴 AND THE NEGATIVE CONTROL ON THAT SAME REGEX, because "matches an import" and
    # "matches a MENTION" are the same reader until something says otherwise.
    # `tautology_gate.mjs` names most of this tree as text it sweeps; if a mention
    # counted, the whole population would read as reached and this gate would refuse
    # nothing ever again.
    claims += 1
    if len(_live_edges.get("tautology_gate.mjs", set())) > 8:
        failed += 1
        print(f"  🔴 UNREACHED the closure reads `tautology_gate.mjs` as importing "
              f"{len(_live_edges.get('tautology_gate.mjs', set()))} script(s) — it SWEEPS "
              f"them as text, and a reader that counts a mention reports the whole tree "
              f"reached")

    # ── 🆕 242: `check_header` ITSELF, WHICH NOTHING HAS EVER DRIVEN ──────────────────
    #
    # 🔴 THIS IS WHY 241's DEFECT SHIPPED GREEN. Everything above asserts the header
    # PARSER — atoms, aliases, exemptions, provenance, the floor — and nothing had ever
    # called the function that does the COMPARING. `npm.lag` sat in the roster with an
    # extract and no reader for twelve sessions, `--selftest` passed on every one of them,
    # and the first thing that noticed was a human reading the count on the line. A roster
    # whose rows are checked and whose dispatch is not is a roster checked by nobody.
    #
    # Driven OFFLINE on purpose: a self-test that opens a socket is a self-test that
    # reports the network's health under this file's name. The claim is about which rows
    # this function can satisfy without one, and that is exactly the question `--open`
    # asks.
    claims += 1
    _hp, _hn, _ha, _hc = check_header(REAL_HEADER.strip("\n").split("\n"), "", False, 234)
    _named = {n.split(":", 1)[0] for n in _hn if "UNREAD" in n}
    _remote = {k for k, p in PROVENANCE.items() if p == REMOTE}
    if not _remote <= _named:
        failed += 1
        print(f"  🔴 HEADER_OFFLINE {sorted(_remote - _named)} answered itself with no log "
              f"and no socket while declared REMOTE — a row that quietly becomes readable "
              f"offline is a row now answered by the tree about the world")

    # 🔴 AND THE OTHER DIRECTION, WHICH IS WHAT MAKES THE ABOVE A CLAIM RATHER THAN A
    # TAUTOLOGY: a reader that returned UNREAD for everything would satisfy it. `ci.green`
    # is TREE, derived from `.github/workflows` in-process, and must be answered offline.
    claims += 1
    if "ci.green" in _named:
        failed += 1
        print("  🔴 HEADER_OFFLINE ci.green is UNREAD offline — it is derived from the "
              "tree in this process, so a reader that cannot answer it has stopped "
              "reading rather than started needing the network")

    # 🔴 AND THE REASON HAS TO NAME A FIX THE CALLER CAN PERFORM. 241's `npm.lag` printed
    # *"no --measured log carries it"* under `--open`, which cannot be given a log at all:
    # the mode returns from `main()` before `--measured` is parsed. A reason that sends
    # the next session to do something impossible is 233 §18 one file over — worse than no
    # reason, because it looks like one.
    claims += 1
    _lag_note = next((n for n in _hn if n.startswith("npm.lag")), "")
    if "--network" not in _lag_note or "fact about the WORLD" not in _lag_note:
        failed += 1
        print(f"  🔴 HEADER_UNREAD_REASON npm.lag's UNREAD reason does not name --network "
              f"and does not say lag is a fact about the world: {_lag_note[:120]!r}")

    # 🔴 THE ROSTER'S OWN DISPATCH COVERAGE, ASKED THE WAY 232's DISCOVER HALF ASKS IT.
    # Every REMOTE row must be reachable by SOME route other than a log — that is what
    # `npm.lag` was missing, and a count is what nobody had. The routes are the named
    # branches in `check_header`, so the claim is over the source of that function.
    claims += 1
    _src = inspect.getsource(check_header)
    _unrouted = sorted(k for k, p in PROVENANCE.items()
                       if p == REMOTE and f'"{k}"' not in _src)
    if _unrouted:
        failed += 1
        print(f"  🔴 HEADER_UNROUTED {_unrouted} — declared REMOTE and reachable only "
              f"through a --measured log. That is 241 §1 exactly: an atom the opening "
              f"ritual counts as a header row and can never re-read, so a stale value "
              f"rides forward across any number of sessions and nothing says a word")

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

    # ── 🔴 239 §2 — THE INTERVAL, AGAINST THE REAL COMMITS AND THE REAL POPULATION ────
    #
    # 234's header names bcc0b85 and c27953d and claims `MOVED +1`. 236 read both
    # endpoints off that one row and 238 believed the row disagreed with 232's block;
    # measured, the row cannot disagree with anything. c27953d is bcc0b85's PARENT — as
    # is every continuation line in all twelve real blocks — so `rev-list` over the pair
    # answers 1 whatever the session did, and the only block shape it could ever refuse
    # is one claiming `+2`. Both blocks that claim it (232, 233) are CORRECT.
    #
    # 🔴 AND THE FIRST VERSION OF THIS CLAIM WAS A CLAIM ABOUT THE MACHINE — 235 §6.3, ONE
    # SESSION LATER, IN THE SESSION THAT QUOTES IT. It asserted `rev-list` answers 1,
    # which is true on any full clone and false on CI, where `actions/checkout` fetches
    # one commit and neither endpoint exists. It went red there and nowhere else. So the
    # claim that survives is the same one 235 landed on: AGREEMENT. The PARSE half is
    # about the reader and holds everywhere; the LIVE half asserts a number where the
    # objects are and a REFUSAL where they are not, and never a number invented from one.
    claims += 1
    ends = main_shas(real_block)[:2]
    if ends != ["bcc0b85", "c27953d"]:
        failed += 1
        print(f"  🔴 MOVED_PARSE {ends}, pinned ['bcc0b85', 'c27953d'] — the main row's "
              f"own two SHAs, newest first. The FIRST is this counter's endpoint; the "
              f"second is read by `MOVED_PARENT` below and by nothing else")

    have = all(subprocess.run(("git", "cat-file", "-e", f"{s}^{{commit}}"), cwd=ROOT,
                              capture_output=True).returncode == 0 for s in ends)
    claims += 1
    got_moved, moved_why = moved_interval(real_block, 234)
    if have and (moved_why or got_moved != 1):
        failed += 1
        print(f"  🔴 MOVED_LIVE {moved_why or got_moved}, pinned 1 — 233's block puts "
              f"main at c27953d and 234's at bcc0b85, so the session moved it once")
    if not have and (not moved_why or got_moved != -1):
        failed += 1
        print(f"  🔴 MOVED_SHALLOW {got_moved}/{moved_why!r} — a checkout missing an "
              f"endpoint must make this UNREAD with the reason, not a number: a shallow "
              f"clone is a fact about the machine and the claim is about the interval")

    # 🔴 AND THE CLAIM THE OLD READER WAS REALLY MAKING, NOW MAKING IT ON ITS OWN. The
    # continuation line is the main SHA's parent — true of every block, and the only
    # thing `rev-list old..new` over one row was ever able to test. As its own claim it
    # can fail; as a counter it could not.
    claims += 1
    if have:
        par, par_why = parent_of(ends[0])
        if par_why or not par.startswith(ends[1][:7]) and not ends[1].startswith(par[:7]):
            failed += 1
            print(f"  🔴 MOVED_PARENT {par or par_why!r}, pinned {ends[1]!r} — the "
                  f"continuation line under the main row is that commit's parent, which "
                  f"is why an interval bounded by both was 1 in every block ever written")

    # 🔴 AND A COUNTER THAT ANSWERS THE SAME NUMBER FOR EVERY BLOCK IS NOT READING THEM.
    # This is the control the old reader had no way to pass: over the population it
    # returned 1, twelve times, including for the two blocks whose sessions moved main
    # twice. Distinct values are the measurement — 0 for the two UNMOVED sessions, 1 for
    # the seven single-merge ones, 2 for 232 and 233 — and one value is a constant with a
    # `git` call in front of it. Not floored: the assertion is that the set is not a
    # singleton, which no session can satisfy by shrinking the population to nothing.
    # 🆕 244 §1 — AND THE SKIP ABOVE THIS LOOP USED TO BE SILENT, WHICH IS THE WHOLE OF
    # THIS SESSION'S FIRST FINDING. A block whose endpoints are not in the object store
    # was dropped with a bare `continue`: no reason, no row, no counter. On CI's
    # `--depth 1` checkout that is EVERY block, so `pop_moved` is empty there and four
    # claims stand on it — two of them passing vacuously over the empty set for nine
    # sessions. The population is now PARTITIONED, and `POPULATION_ACCOUNTED` below
    # refuses a block that belongs to none of the three parts.
    pop_moved: "dict[int, int]" = {}
    pop_unread: "list[str]" = []
    pop_absent: "list[str]" = []
    for sess, text in BLOCK_POPULATION:
        pop_block = status_block(text)[0]
        ends_p = main_shas(pop_block)[:2]
        if not ends_p:
            pop_absent.append(f"{sess}: no SHA on the main row")
            continue
        gone = [s for s in ends_p
                if subprocess.run(("git", "cat-file", "-e", f"{s}^{{commit}}"), cwd=ROOT,
                                  capture_output=True).returncode != 0]
        if gone:
            pop_absent.append(f"{sess}: {' '.join(gone)} not in this object store")
            continue
        n_p, why_p = moved_interval(pop_block, sess)
        if why_p:
            pop_unread.append(f"{sess}: {why_p[:60]}")
        else:
            pop_moved[sess] = n_p

    # 🔴 EVERY BLOCK IS READ, UNREAD WITH A REASON, OR ABSENT WITH A REASON. The three
    # parts must add up to the table, which is the claim a `continue` cannot make. It is
    # not a floor on how many are readable — a shallow checkout is a fact about the
    # machine — it is a refusal of the fourth outcome the old loop had: dropped.
    claims += 1
    _parts = len(pop_moved) + len(pop_unread) + len(pop_absent)
    if _parts != len(BLOCK_POPULATION):
        failed += 1
        print(f"  🔴 POPULATION_ACCOUNTED {_parts} of {len(BLOCK_POPULATION)} block(s) "
              f"land in a named part — read {sorted(pop_moved)}, unread {pop_unread}, "
              f"absent {pop_absent}. A block this loop drops is a block every claim "
              f"below is silently not making")
    if pop_absent and not pop_moved:
        print(f"  🟡 POPULATION_ABSENT no block's endpoints are in this object store "
              f"({len(pop_absent)} of {len(BLOCK_POPULATION)}) — a shallow checkout. The "
              f"interval claims below take their REFUSAL path here and say so")

    claims += 1
    if pop_moved and len(set(pop_moved.values())) < 2:
        failed += 1
        print(f"  🔴 MOVED_CONSTANT {sorted(set(pop_moved.values()))} across "
              f"{len(pop_moved)} block(s) — a reader that answers one number for every "
              f"block in the population is agreeing with a printing convention, not "
              f"measuring an interval. 236's read `parent..commit` and answered 1 for "
              f"twelve blocks; the two that moved main twice were the only ones it could "
              f"contradict, and both were right")

    # 🔴 AND EVERY BLOCK THAT CLAIMS A NUMBER MUST GET ITS OWN NUMBER BACK. The walk 238
    # NEXT 2 asked for, over twelve blocks instead of the one in front of the author.
    claims += 1
    disagreed = []
    for sess, text in BLOCK_POPULATION:
        if sess not in pop_moved:
            continue
        pop_block = status_block(text)[0]
        atom = next((c for _r, c in header_atoms(pop_block)[0] if "MOVED" in c), "")
        want = tuple(int(x) for x in COUNTER_RE.findall(atom)) if atom else ()
        if want and want != (pop_moved[sess],):
            disagreed.append(f"{sess}: block says {want}, tree says {pop_moved[sess]}")
    if disagreed:
        failed += 1
        print(f"  🔴 MOVED_POPULATION {disagreed} — 238 NEXT 2 asked whether 232's "
              f"`MOVED +2` was wrong or the reader was. Measured over every block the "
              f"table holds, and any row here is one or the other")

    # ── 🆕 243 §3: `header-unmoved-unread` (OPEN 239) — THE WORD, MEASURED ────────────
    #
    # 🔴 THE WHOLE ROW IS THAT `UNMOVED` WAS NEVER A CLAIM. `MOVED +1` carries a numeral,
    # so `header_atoms` returned it, `check_header` bound it and the tree could
    # contradict it. `UNMOVED` carries none, was never an atom, and a session whose main
    # branch HAD moved could have written it and nothing here would have had an opinion —
    # for four sessions, across every block that printed the word. Both halves are proved
    # against the population rather than a fixture, because a fixture would only prove
    # the reader parses its own example.
    unmoved_blocks = []
    for sess, text in BLOCK_POPULATION:
        pop_block = status_block(text)[0]
        if any(re.search(r"^(?:main|branch)\b.*\bUNMOVED\b", c, re.I)
               for _r, c in header_atoms(pop_block)[0]):
            unmoved_blocks.append(sess)
    claims += 1
    if not unmoved_blocks:
        failed += 1
        print("  🔴 UNMOVED_POPULATION no block in the population reaches the "
              "`git.unmoved` row — either the word left the convention or the anchored "
              "alias has stopped matching, and an unreachable reader refuses nothing")
    claims += 1
    wrong = [f"{s}: block says UNMOVED, tree says {pop_moved[s]}"
             for s in unmoved_blocks if s in pop_moved and pop_moved[s] != 0]
    if wrong:
        failed += 1
        print(f"  🔴 UNMOVED_POPULATION {wrong} — the word asserts zero and the interval "
              f"disagrees. This is the comparison that did not exist before 243: the "
              f"block was believed because nothing could read it")
    # 🔴 THE NEGATIVE CONTROL, AND IT IS THE CLAIM THAT MATTERS. Everything above holds
    # on a tree where the word is always right; only this one fails on a reader that
    # binds the word and then agrees with it whatever the tree says.
    # 🔴 BUILT FROM THE POPULATION AND FROM ITS OWN SESSION, and the first draft of this
    # claim got that wrong in the most instructive way available: it took a block that
    # moved main twice, rewrote the word, and paired it with the WRONG session — for
    # which the interval really is zero, so the rewritten lie was true and the control
    # passed by agreeing with a fact nobody had asked about. A control fed the wrong
    # endpoints tests the fixture, not the reader.
    claims += 1
    _ctl = next(((s, txt) for s, txt in BLOCK_POPULATION
                 if pop_moved.get(s, 0) > 0
                 and any(re.match(r"^(?:main|branch)\b.*MOVED \+\d+", ln)
                         for ln in status_block(txt)[0])), None)
    if _ctl is None and pop_absent and not pop_moved:
        # 🆕 244 §1 — THE MACHINE, NOT THE READER. This control needs a block whose main
        # really moved, and "really" is a `rev-list` over two commits. Where neither
        # commit exists the control has no input for a reason that is a fact about the
        # checkout — 235's own lesson, one claim over. It says so and does not redden;
        # the DEEP half runs in `contract-check`, which fetches the history for check 4,
        # and that is where this control is enforced on every push.
        print("  🟡 UNMOVED_CONTROL UNREAD — the population's endpoints are not in this "
              "object store, so no block can be shown to have moved main. Enforced on "
              "the full-history job, not skipped: see ci.yml's contract-check")
    elif _ctl is None:
        failed += 1
        print("  🔴 UNMOVED_CONTROL no block in the population moved main at all, so "
              "there is nothing to rewrite into a false UNMOVED — the control has no "
              "input and proves nothing")
    else:
        _sess, _txt = _ctl
        _fake = [re.sub(r"MOVED \+\d+", "UNMOVED", ln)
                 for ln in status_block(_txt)[0]]
        _p, _n, _a, _c = check_header(_fake, "", False, _sess)
        if not any("git.unmoved" in x for x in _p):
            failed += 1
            print(f"  🔴 UNMOVED_CONTROL {_sess}'s block moved main {pop_moved[_sess]} "
                  f"time(s); rewriting its row to UNMOVED was not refused — problems "
                  f"{_p}, atoms {header_atoms(_fake)[0]}")

    # 🔴 AND THE POSITIVE HALF, WHICH THE FIRST DRAFT OF THIS BLOCK DID NOT HAVE AND A
    # MUTATION FOUND WITHIN THE MINUTE. Every claim above asserts that a FALSE `UNMOVED`
    # is refused; none asserted that a TRUE one is accepted. Breaking the length check so
    # the reader refused EVERY block carrying the word left all of them green — a gate
    # that refuses everything passes every test written about its refusals.
    claims += 1
    _true = [s for s in unmoved_blocks if pop_moved.get(s, -1) == 0]
    if not _true and pop_absent and not pop_moved:
        print("  🟡 UNMOVED_ACCEPTS UNREAD — same object store, same reason. The "
              "positive half needs an interval that really is zero and this checkout "
              "cannot measure one")
    elif not _true:
        failed += 1
        print("  🔴 UNMOVED_ACCEPTS no block in the population claims UNMOVED over an "
              "interval that really is zero, so nothing here proves the reader can agree")
    for _s in _true:
        _txt = next(txt for ss, txt in BLOCK_POPULATION if ss == _s)
        _p, _n, _a, _c = check_header(status_block(_txt)[0], "", False, _s)
        claims += 1
        if any("git.unmoved" in x for x in _p):
            failed += 1
            print(f"  🔴 UNMOVED_ACCEPTS {_s}'s block claims UNMOVED, main really did "
                  f"not move, and the reader refused it anyway: {_p}")

    # 🔴 AND THE SECOND `unmoved`, WHICH THE ROW DID NOT KNOW IT HAD. The same word on
    # the `host / addon` row claims two version strings did not move, and binding it to
    # the commit interval would have compared an addon version against a `rev-list`
    # count and called it agreement. Proved by moving one of the two.
    claims += 1
    _vers, _vwhy = tree_versions()
    _was, _wwhy = block_versions(status_block(BLOCK_POPULATION[-1][1])[0])
    if _vwhy or _wwhy or len(_vers) != 2 or len(_was) != 2:
        failed += 1
        print(f"  🔴 VERSION_UNMOVED_READ tree={_vers!r} {_vwhy!r} · "
              f"previous block={_was!r} {_wwhy!r} — one of the two ends is unreadable, "
              f"and an unreadable end is an UNREAD claim rather than a quiet zero")
    claims += 1
    _n_ver, _vprob = version_interval(BLOCK_POPULATION[-1][0] + 1)
    if _vprob or _n_ver != sum(1 for a, b in zip(_was, _vers) if a != b):
        failed += 1
        print(f"  🔴 VERSION_UNMOVED the interval reader answered {_n_ver}/{_vprob!r} "
              f"against {_was} -> {_vers}")
    claims += 1
    if version_interval(None)[1] == "":
        failed += 1
        print("  🔴 VERSION_UNMOVED an undated block got a number instead of UNREAD — "
              "`unmoved` is a claim about the block BEFORE this one, and a block that "
              "cannot say which that is has not made the claim")

    # 🔴 AND THE ONE THAT MAKES THE THREE ABOVE WORTH ANYTHING. All of them run against a
    # tree whose versions have not moved since the last block, so the true answer is zero
    # and a reader hard-wired to zero passes every one — two mutations proved exactly
    # that. This claim reaches back to a block whose versions REALLY differ from the
    # tree's and asserts the refusal, through `check_header` rather than through the
    # interval function, so a binding that silently stopped comparing fails it too.
    claims += 1
    _fixture = [(1, "> ```\n> main   deadbee — a fixture (#0)   MOVED +1\n"
                    "> host / addon         0.0.1 / 0.0.2   🟢 unmoved\n> ```")]
    _both, _bwhy = version_interval(2, population=_fixture)
    if _bwhy or _both != 2:
        failed += 1
        print(f"  🔴 VERSION_UNMOVED_CONTROL a previous block whose BOTH versions differ "
              f"from the tree's {_vers} answered {_both}/{_bwhy!r}, pinned 2 — a reader "
              f"wired to zero passes every claim made on a tree that has not moved, and "
              f"every block this table holds carries the same pair as the tree")
    claims += 1
    _one = [(1, "> ```\n> main   deadbee — a fixture (#0)   MOVED +1\n"
                f"> host / addon         {_vers[0]} / 0.0.2   🟢 unmoved\n> ```")]
    _n1, _w1 = version_interval(2, population=_one)
    if _w1 or _n1 != 1:
        failed += 1
        print(f"  🔴 VERSION_UNMOVED_CONTROL one version moved and one did not; the "
              f"reader answered {_n1}/{_w1!r}, pinned 1 — the count is what tells a "
              f"host cut from an addon re-stamp, and a boolean would have lost it")
    # 🔴 AND THE BINDING, WHICH IS A DIFFERENT FAILURE FROM THE READER BEING WRONG. If
    # `check_header`'s branch for this key ever goes dead, `got` stays None and the note
    # reads "no --measured log carries it" — the fallback for a counter with no reader at
    # all. Asserting the POPULATION's own reason comes back is what tells the two apart.
    claims += 1
    _early = [ln for ln in ["main                 deadbee — a fixture (#0)          MOVED +1",
                            "host / addon         1.0.0 / 1.0.0   🟢 unmoved"]]
    _p, _n, _a, _c = check_header(_early, "", False, BLOCK_POPULATION[0][0] - 1)
    if not any("version.unmoved: UNREAD — no block before" in x for x in _n):
        failed += 1
        print(f"  🔴 VERSION_UNMOVED_BOUND `check_header` did not route the `host / "
              f"addon` word claim to its reader — notes {_n}")

    # ── 🆕 244 §3 — `version-row-second-claim`: THE TWO STRINGS, BOTH DIRECTIONS ───────
    #
    # 🔴 THE POSITIVE HALF FIRST, AND IT IS FIRST ON PURPOSE — 243 §3.2's third mutation
    # is nine days old: a reader that refuses every block passes every claim written
    # about its refusals. The newest real block prints the pair this tree holds, so it
    # must be ACCEPTED, and no arrangement of a broken reader satisfies both this claim
    # and the two below it.
    #
    # 🔴 248 — AND IT COULD NOT SURVIVE THE FIRST RELEASE CUT AFTER IT WAS WRITTEN.
    # `BLOCK_POPULATION[-1]` is a block from a PAST session and the pair is read from the
    # tree in front of it, so the two agree on every ordinary session and differ on
    # exactly one commit: the one that bumps the version. There has been no cut since 244
    # added this claim, so it had never met the case, and its first meeting with it was a
    # self-test refusing the release it is supposed to be verifying — CHANGELOG 1.74.0's
    # *"CHECK 14 REFUSES THE RELEASE COMMIT"*, one gate over.
    #
    # 🔴 THE DIRECTION IS THE WHOLE FIX, AND IT KEEPS EVERY TOOTH. A block claiming a
    # version the tree does NOT hold is refused exactly as before — that is the drift
    # this claim exists for, and both negative controls below still drive it. A block
    # BEHIND the tree is the one lawful way the two can differ: a cut landed after that
    # block was written. It is admitted, and it is admitted LOUDLY, because a silent
    # allowance here would re-open the hole the claim was built to close.
    claims += 1
    _p, _n, _a, _c = check_header(status_block(BLOCK_POPULATION[-1][1])[0], "", False,
                                  BLOCK_POPULATION[-1][0])
    if any("version.pair" in x for x in _p):
        _was, _why = block_versions(status_block(BLOCK_POPULATION[-1][1])[0])
        _key = lambda v: tuple(int(n) for n in re.findall(r"\d+", v or "0"))
        _behind = (not _why and all(_key(a) <= _key(b) for a, b in zip(_was, _vers))
                   and tuple(_was) != tuple(_vers))
        if _behind:
            print(f"  🟡 VERSION_PAIR_ACCEPTS {BLOCK_POPULATION[-1][0]}'s block prints "
                  f"{list(_was)} and this tree holds {list(_vers)} — a RELEASE CUT has "
                  f"landed in this working tree since that block was written. Admitted "
                  f"because the block is BEHIND the tree; a block AHEAD of it is still "
                  f"refused, and the two controls below prove it")
        else:
            failed += 1
            print(f"  🔴 VERSION_PAIR_ACCEPTS {BLOCK_POPULATION[-1][0]}'s block prints "
                  f"the pair this tree holds ({_vers}) and the reader refused it: "
                  f"{[x for x in _p if 'version.pair' in x]}")
    # 🔴 AND EACH OF THE TWO STRINGS ON ITS OWN, BECAUSE A ROW-LEVEL CLAIM THAT ONLY EVER
    # SAW BOTH MOVE WOULD BE A BOOLEAN WEARING A PAIR. `1.74.0 / 1.9.9` is two sources —
    # a host cut and an addon re-stamp are different events, they have moved
    # independently through this project's whole history, and a block that restated one
    # of them wrongly is exactly the drift 234's `FLOOR_PIN_LITERAL` incident was.
    for _idx, _lbl in ((0, "host"), (1, "addon")):
        claims += 1
        _bad = list(_vers)
        _bad[_idx] = "9.9.9"
        _row = ["main                 deadbee — a fixture (#0)          MOVED +1",
                f"host / addon         {_bad[0]} / {_bad[1]}   🟢 unmoved"]
        _p, _n, _a, _c = check_header(_row, "", False, BLOCK_POPULATION[-1][0] + 1)
        if not any("version.pair" in x and f"{_lbl}:" in x for x in _p):
            failed += 1
            print(f"  🔴 VERSION_PAIR_CONTROL a block claiming {_bad} against a tree at "
                  f"{list(_vers)} was not refused for {_lbl} — problems {_p}. Whichever "
                  f"of the two a session restates wrongly, the refusal has to name it")
    # 🔴 AND THE UNREAD PATH, WHICH IS NOT THE SAME AS AGREEMENT. A block with no
    # `host / addon` row at all must say so in a note rather than compare nothing and
    # pass — 235 §6.3's rule, and the shape 244 §1 found four claims standing on.
    claims += 1
    _p, _n, _a, _c = check_header(
        ["main                 deadbee — a fixture (#0)          MOVED +1"], "", False,
        BLOCK_POPULATION[-1][0] + 1)
    if not any("version.pair: UNREAD — no `host / addon` row" in x for x in _n):
        failed += 1
        print(f"  🔴 VERSION_PAIR_UNREAD a block with no `host / addon` row compared "
              f"nothing and said nothing — notes {_n}")

    # ── 🆕 244 §2 — `population-reach-floor` (OPEN 239): HOW FAR BACK, NOT HOW WIDE ────
    #
    # 🔴 THE LIVE TABLE PASSES AND THAT IS THE POSITIVE HALF. Everything below refuses a
    # table that lost its back; without this claim a reader that refused every population
    # would satisfy all of them.
    claims += 1
    _reach = population_reach_problems(BLOCK_POPULATION)
    if _reach:
        failed += 1
        print(f"  🔴 POPULATION_REACH the live table is refused by its own floor: "
              f"{_reach}")
    # 🔴 THE SLIDING WINDOW, WHICH IS THE ROW'S ENTIRE SUBJECT AND WHICH THE FIRST DRAFT
    # OF THE FLOOR ACCEPTED. One block off the back, one on the front: same width, same
    # spellings, same claims, contiguous — and every count this file floors is unchanged.
    claims += 1
    _slid = BLOCK_POPULATION[1:] + [(BLOCK_POPULATION[-1][0] + 1, "")]
    if not any("POPULATION_REACH " in p for p in population_reach_problems(_slid)):
        failed += 1
        print(f"  🔴 POPULATION_REACH_CONTROL a window of {len(_slid)} block(s) starting "
              f"at {_slid[0][0]} was accepted against a pin of {POPULATION_REACH_FLOOR} — "
              f"same width as the live table, one session less reach, and a floor that "
              f"cannot tell the two apart is `len()` written as a subtraction")
    # 🔴 AND REACH WITHOUT CONTIGUITY IS TWO BLOCKS AND A LONG SUBTRACTION. This one
    # passes the floor above with room to spare, which is why the two claims are two.
    claims += 1
    _gapped = [BLOCK_POPULATION[0], BLOCK_POPULATION[-1]]
    _gp = population_reach_problems(_gapped)
    if not any("POPULATION_CONTIGUOUS" in p for p in _gp) or any(
            "POPULATION_REACH " in p for p in _gp):
        failed += 1
        print(f"  🔴 POPULATION_CONTIGUOUS_CONTROL a table holding only "
              f"{_gapped[0][0]} and {_gapped[-1][0]} answered {_gp} — it spans the floor "
              f"and measures two intervals, and only the contiguity half can say so")
    # 🔴 GROWTH AT THE FRONT IS NEVER A REFUSAL. A floor a session can trip by doing the
    # thing the ritual orders — adding the previous block before the close gate — is a
    # floor that gets deleted rather than obeyed.
    claims += 1
    _grown = BLOCK_POPULATION + [(BLOCK_POPULATION[-1][0] + 1, "")]
    if population_reach_problems(_grown):
        failed += 1
        print(f"  🔴 POPULATION_REACH_GROWTH adding the next block to the table was "
              f"refused: {population_reach_problems(_grown)}")

    # 🔴 AND A SINGLE SHA ON THE MAIN ROW IS ENOUGH NOW, WHICH IS THE WHOLE CHANGE. 233's
    # block prints one, claims `MOVED +2`, and was UNREAD until this session for needing
    # a second endpoint it never needed: 232's block has it. The pin is 2 — the number
    # 233 wrote, from a tree that never agreed with it before.
    claims += 1
    one_end, one_why = moved_interval(status_block(REAL_BLOCK)[0], 233)
    trimmed = main_shas(status_block(REAL_BLOCK)[0])
    if len(trimmed) == 1 and have and (one_why or one_end != 2):
        failed += 1
        print(f"  🔴 MOVED_ONE_END {one_end}/{one_why!r}, pinned 2 — one SHA on the main "
              f"row and the other endpoint in the population is the readable case, not "
              f"the refused one")

    # 🔴 AND UNDATED, OR UNPRECEDED, IS UNREAD WITH THE REASON. A block whose session the
    # file cannot name has no previous block; a session earlier than everything in the
    # table has none either, and that is 238 NEXT 3's manual step made loud — a table
    # that stops growing stops answering rather than quietly answering 1.
    for sess_arg, label in ((None, "MOVED_UNDATED"), (BLOCK_POPULATION[0][0],
                                                      "MOVED_NO_PREVIOUS")):
        claims += 1
        n_u, why_u = moved_interval(real_block, sess_arg)
        if not why_u or n_u != -1:
            failed += 1
            print(f"  🔴 {label} {n_u}/{why_u!r} — the endpoint main moved FROM is "
                  f"another block's row, and a run that cannot name that block must say "
                  f"so rather than read this one twice")

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

    # 🆕 242 — AND THE OTHER SPELLING, WHICH IS THE ONE THE RULE GOT WRONG. `>> run.log`
    # APPENDS; `>(?!>)` matched it at the second character and called every appending
    # replay a clobber. The fixture above uses `>` twice and therefore proved the rule
    # only on the spelling it handled — a positive control with no negative one, which is
    # this tree's oldest lesson wearing a regex. Both halves are pinned now.
    claims += 1
    append = FIXED_REPLAY.replace(
        "python3 ../scripts/handoff_gate.py ../HANDOFF_SESSION236.md",
        "cat open.log >> run.log\npython3 ../scripts/handoff_gate.py "
        "../HANDOFF_SESSION236.md")
    if any("TRUNCATED" in p for p in replay_problems(append)[0]):
        failed += 1
        print("  🔴 REPLAY_TRUNCATE an APPEND (`>> run.log`) was refused as a clobber — "
              "the lookahead reads what follows a `>` and not what precedes it, so `>>` "
              "matched at its own second character")

    # ── 🔴 237 §3 — THE `SINCE` BOUNDARIES, BOTH DIRECTIONS, OVER FOUR REAL BLOCKS ────
    carried = {sess: block_keys(text) for sess, text in SINCE_POPULATION}

    # the population itself has to be readable, or every claim below passes on empty sets
    claims += 1
    thin = [s for s, ks in carried.items() if len(ks) < 5]
    if thin:
        failed += 1
        print(f"  🔴 SINCE_POPULATION block(s) {thin} parsed to fewer than five bound "
              f"counters — a population that stopped parsing agrees with every boundary "
              f"in the table, which is the shape both claims below are guarding")

    for key, _alias, _n, _cmd, _cwd, _ex, _cost, need, _why in COUNTER_READERS:
        m = SINCE_RE.match(need)
        if m is None:
            continue
        n = int(m.group(1))
        claims += 1
        missing = sorted(s for s, ks in carried.items() if s >= n and key not in ks)
        if missing:
            failed += 1
            print(f"  🔴 SINCE_FORWARD `{key}` is REQUIRED from {n} and block(s) "
                  f"{missing} do not carry it — a boundary set too early refuses a "
                  f"handoff that was correct about its own session, which is the "
                  f"DROPPED-counter direction firing on a counter that was never there")
        claims += 1
        absent = sorted(s for s, ks in carried.items() if s < n and key not in ks)
        if not absent:
            failed += 1
            print(f"  🔴 SINCE_BACKWARD `{key}` is REQUIRED from {n} and every earlier "
                  f"block in the population carries it too — the boundary excuses "
                  f"nothing, so the row is plainly REQUIRED and the date is a reason "
                  f"nobody can re-derive (236 §4's class, one table over)")

    # 🔴 AND THE FALLBACK IS OPTIONAL, WHICH IS THE HALF THAT COULD HAVE BEEN SILENT.
    # A block whose number nobody found is a block no `SINCE` row was compared against;
    # REQUIRED there would refuse correct old handoffs read under another name.
    since_rows = [(k, nd) for k, _a, _n, _c, _w, _e, _co, nd, _wh in COUNTER_READERS
                  if SINCE_RE.match(nd)]
    claims += 1
    # 🆕 246 — SIX BECAME NINE, AND THE THREE ARE ONE EVENT. `queue-claims-unread` (240)
    # is three counters over: `instrument_gate.py` prints them on every run and 245's block
    # struck all three rather than restate them unread. A boundary row per counter is the
    # only honest shape — every block in the table predates them — and the pin moves in the
    # commit that adds them, which is what makes it a record rather than a restatement.
    if len(since_rows) != 10:
        failed += 1
        print(f"  🔴 SINCE_ROWS {len(since_rows)} row(s) carry a boundary, pinned 10 — "
              f"237 §3 measured six and 246 added four; the table is the only record of which")
    for key, nd in since_rows:
        claims += 1
        n = int(SINCE_RE.match(nd).group(1))
        if (needed(nd, None), needed(nd, n), needed(nd, n - 1)) != (
                OPTIONAL, REQUIRED, OPTIONAL):
            failed += 1
            print(f"  🔴 SINCE_NEEDED `{key}` {nd} -> undated {needed(nd, None)}, at {n} "
                  f"{needed(nd, n)}, at {n - 1} {needed(nd, n - 1)}")

    # the session number is read from the file's name, and from the block when the name
    # does not carry one — 234's header prints `branch 234` and nothing else dates it
    claims += 1
    named = block_session("HANDOFF_SESSION236.md", [])
    branched = block_session("run.log", status_block(REAL_HEADER)[0])
    undated = block_session("run.log", status_block(REAL_BLOCK)[0])
    if (named[0], branched[0], undated[0]) != (236, 234, None):
        failed += 1
        print(f"  🔴 SINCE_SESSION {named[0]}/{branched[0]}/{undated[0]}, pinned "
              f"236/234/None — the name first, then the block's own `branch n` row, "
              f"and a block with neither is not dated rather than dated zero")

    # ── 🔴 237 §2 — THE ORDER RULES, AGAINST THE REPLAY THAT WAS REALLY RUN ───────────
    claims += 1
    shipped_problems, _sn = replay_problems(SHIPPED_REPLAY)
    if shipped_problems:
        failed += 1
        print(f"  🔴 REPLAY_SHIPPED 236 §9.1's replay — written as a file, executed top "
              f"to bottom, and the log it wrote answered the gate — was refused: "
              f"{shipped_problems}")

    for edit, into, word in REPLAY_NEGATIVES:
        claims += 1
        assert edit in SHIPPED_REPLAY, edit
        broken = SHIPPED_REPLAY.replace(edit, into)
        if not any(word in p for p in replay_problems(broken)[0]):
            failed += 1
            print(f"  🔴 REPLAY_ORDER 236 §9.1's replay with {edit.strip()[:44]!r} "
                  f"{'removed' if not into else 'rewritten'} was NOT refused with "
                  f"{word!r} — the rule is asserted against nothing, which is this "
                  f"session's other finding one table over")

    # both directions on the ORDER table itself: a rule no negative reaches is a rule
    # somebody can loosen without a fixture noticing (`ROSTER`'s argument, one table over)
    claims += 1
    # ── 🔴 238 §3 — THE SEGMENT HALF, AGAINST 237's OWN REPLAY ────────────────────────
    #
    # Both directions over one real input. The negative is the replay 237 shipped, whose
    # `&&` routes the gate and not the self-test the row reads; the positive is that text
    # with the one edit 238 §7.1 makes. A rule that fired on neither would be the claim
    # asserted against nothing this file keeps shipping, and a rule that fired on BOTH
    # would be a rule about `&&` rather than about which command the log carries.
    claims += 1
    seg_problems, _sn = replay_problems(SEGMENT_REPLAY)
    seg_routing = [p for p in seg_problems if "routes none of it into" in p]
    if len(seg_routing) != 1 or "wire_invisible_gate.selftest.mjs" not in seg_routing[0]:
        failed += 1
        print(f"  🔴 REPLAY_SEGMENT 237 §7.1's replay produced {len(seg_routing)} routing "
              f"refusal(s), pinned exactly 1 naming `wire_invisible_gate.selftest.mjs` — "
              f"the `| tee` binds to the second command of an `&&` and the row reads the "
              f"first: {seg_routing}")

    claims += 1
    fixed_problems, _fn = replay_problems(SEGMENT_FIXED)
    if fixed_problems:
        failed += 1
        print(f"  🔴 REPLAY_SEGMENT_FIXED the same replay with the self-test on a routed "
              f"line of its own still refuses — {fixed_problems}")

    # 🔴 AND THE WIDENING IS A MEASUREMENT, NOT A SENTENCE. 237 NEXT 3 counted ten rows
    # asked of twenty-eight; a later edit that quietly drops a cost class out of the loop
    # would leave the paragraph above true and the rule narrow again.
    claims += 1
    asked = [k for k, _a, _n, cm, *_r in COUNTER_READERS if cm is not None]
    if len(asked) != len(COUNTER_READERS) - 1:
        failed += 1
        print(f"  🔴 REPLAY_ROUTING_POPULATION {len(asked)} row(s) carry a `cmd` out of "
              f"{len(COUNTER_READERS)}, and exactly one row (`ci.checks`) is derived — "
              f"the routing question is asked of every row that runs something")

    reached = {w for _e, _i, w in REPLAY_NEGATIVES}
    unreached = [ln for _e, ln, _w in REPLAY_ORDER if ln not in reached]
    if unreached:
        failed += 1
        print(f"  🔴 REPLAY_ORDER_UNREACHED {unreached} — every ORDER row needs a "
              f"negative derived from the real replay, or the rule is prose again")

    # ── 🔴 237 §1 — `--patterns` REACHES EVERY ROW, AND THE PARTITION IS THE CLAIM ────
    #
    # The mode's whole value is that it is exhaustive over the roster; a row whose cost is
    # none of the four classes falls out of every branch and is never asserted against its
    # instrument, silently, which is the defect the mode exists to catch arriving in the
    # mode itself. Static, so `--selftest` can hold it without measuring anything.
    claims += 1
    stray = [(k, c) for k, _a, _n, _cm, _cw, _e, c, _nd, _wh in COUNTER_READERS
             if c not in (CHEAP, LOCKED, SLOW, MUTATING)]
    if stray:
        failed += 1
        print(f"  🔴 PATTERNS_PARTITION {stray} — a cost class `patterns()` has no branch "
              f"for is a row it skips without saying so")

    claims += 1
    runnable = [k for k, _a, _n, cm, _cw, _e, c, _nd, _wh in COUNTER_READERS
                if cm is not None and c in (CHEAP, LOCKED)]
    if len(runnable) < 14:
        failed += 1
        print(f"  🔴 PATTERNS_LIVE {len(runnable)} row(s) can be run live and 236 NEXT 2 "
              f"counted fourteen — the observation, not a diagnosis. EITHER rows left "
              f"CHEAP/LOCKED for a cost class this mode cannot run, OR a row's `cmd` "
              f"went None, OR the population really shrank; a count cannot tell them "
              f"apart and the per-row lines `--patterns` prints can")

    # 🔴 THE HISTORY CONTROL
    for sess, claimed, actual, why in HISTORY_PINS:
        claims += 1
        red = claimed != actual
        if red != (sess in ("232", "233")):
            failed += 1
            print(f"  🔴 HISTORY {sess} claimed {claimed}, tree {actual} — {why}")

    # ── 🔴 THE OPENING TIER, AND EVERY BRANCH OF IT GETS A NEGATIVE CONTROL ───────────
    #
    # The cheap tier's whole safety argument is that it REFUSES on a tree it cannot
    # match. A `tier_trigger` that answered TIER0 for everything would look identical on
    # every green session and would be 239 §2's defect exactly — a reader that could only
    # ever return one answer — in the mode built by the session that quotes it. So the
    # trigger is asserted against fixtures where each refusal is the only thing wrong,
    # and the declaration reader is asserted in both directions.
    TIER_PINS: "list[tuple[str, str, str, str]]" = [
        ("ritual TIER0 — inherited from 239", TIER0, "", "the plain declaration"),
        ("> ritual TIER1 · full replay at open", TIER1, "", "blockquoted, with a rider"),
        ("  RITUAL tier0 ", TIER0, "", "🔴 CASE AND LEADING SPACE. The declaration is "
         "written by a human in a document nothing formats, and a reader anchored on one "
         "casing reports UNDECLARED — which reads as a session that skipped the ritual "
         "rather than one that shouted it."),
        ("the ritual tiering work is described in §3", None, "",
         "🔴 PROSE ABOUT THE TIER IS NOT A DECLARATION. A handoff whose SUBJECT is this "
         "mode names it in every paragraph, and a loose scanner would read its own §3 as "
         "the declaration — 236 §1's defect, where a document quoting a broken replay "
         "read as a document running it."),
    ]
    for text, expected, _unused, why in TIER_PINS:
        claims += 1
        got = declared_tier(text)
        if got != expected:
            failed += 1
            print(f"  🔴 TIER_DECLARE {text!r} -> {got!r}, pinned {expected!r} — {why}")

    # the document half, with a log
    # 🔴 THE FIXTURE INHERITS FROM 238, NOT 239, AND THE REASON IS THE CONVENTION ITSELF.
    # A session adds the PREVIOUS block to `BLOCK_POPULATION`, so the newest block in the
    # table is always one behind the newest block that exists — and `TIER0_SHA` can only
    # check a session whose predecessor is in the table. A fixture written against the
    # very newest block reports UNCHECKED and looks exactly like a fixture that passed.
    TIER0_LOG = ("HANDOFF_OPEN HANDOFF_SESSION238.md · TIER0 · 29 counter atom(s) "
                 "INHERITED FROM 238 AT 831ce40 · 6 header atom(s) · 6 re-read\n")
    for doc, log, sess, token, why in [
        ("no declaration anywhere", "", None, "TIER_UNDECLARED",
         "a document that says nothing about its tier passed"),
        ("ritual TIER0", "npm test\n# pass 724\n", 239, "TIER_UNSUPPORTED",
         "🔴 A TIER0 NOBODY RAN. The declaration is an absence-claim, so the only thing "
         "standing behind it is the line the mode prints; a log without it is a session "
         "that declared the saving and never took the check."),
        ("ritual TIER0", TIER0_LOG.replace("FROM 238", "FROM 236"), 239,
         "TIER0_PREDECESSOR",
         "inheriting from two sessions back skipped the block in between and passed"),
        ("ritual TIER0", TIER0_LOG.replace("831ce40", "deadbee"), 239, "TIER0_SHA",
         "the log inherited at a SHA the population does not give for that block, and "
         "the mismatch passed"),
    ]:
        claims += 1
        got, _n = tier_problems(doc, log, sess)
        if not any(token in p for p in got):
            failed += 1
            print(f"  🔴 {token} — {why}. Got: "
                  + ("; ".join(p[:80] for p in got) if got else "NOTHING"))

    # and the positive control, because every refusal above is worthless if the honest
    # document also refuses
    claims += 1
    got, _n = tier_problems("ritual TIER0", TIER0_LOG, 239)
    if got:
        failed += 1
        print(f"  🔴 TIER0_CLEAN — an honest TIER0 document with the matching log "
              f"refused: {'; '.join(p[:100] for p in got)}")
    claims += 1
    got, notes = tier_problems("ritual TIER1", "", 239)
    if got or not any("TIER1" in n for n in notes):
        failed += 1
        print("  🔴 TIER1_CLEAN — a TIER1 declaration needs no log and must not refuse")

    print(f"HANDOFF_SELFTEST {claims - failed}/{claims} claims, {failed} failed")
    return 1 if failed else 0


# ── 🔴 237 §1 — THE READERS' PATTERNS, ASSERTED AGAINST THEIR INSTRUMENTS ─────────────
#
# 236 NEXT 2, and it is the item 236 §5 was the evidence for: *"`lint.files` was anchored
# on a line its instrument had stopped printing on one of its two paths, and the only
# thing that found it was a container without `pyflakes`. Fourteen rows carry a `cmd` and
# an `extract`; a claim that each extract matches its instrument's live output would have
# caught this the session it shipped."*
#
# 🔴 IT CANNOT LIVE IN `--selftest`, AND THAT EXCLUSION IS THE POINT RATHER THAN AN
# OBSTACLE. `handoff.claims` runs `handoff_gate.py --selftest` as a subprocess to read its
# own counter back; a self-test that measured would recurse, so it *"measures nothing and
# returns before this roster is consulted"* — deliberate, correct, load-bearing, and
# named in 236 §22 as the same shape as the two exemptions 236 deleted: *"the question is
# what else covers the excluded half, and today the answer is running it, by hand, once."*
# This is the answer. A mode of its own, over the half `--selftest` declares out of
# scope, that runs the instruments and reads their real output back through the real
# patterns — and a run of it says which rows it could not reach rather than counting them
# green, because a coverage claim that hides its own gaps is the defect one level up.
def patterns(log: str) -> int:
    """Every reader's `extract` against its instrument's LIVE output. 0 if none disagreed.

    CHEAP and LOCKED rows are run here. SLOW and MUTATING rows are never run from this
    file — `npm test` costs minutes and the mutating three rewrite the tree — so they are
    read out of `--measured` when a log is supplied and reported UNCOVERED when it is not.
    """
    live = mismatched = from_log = uncovered = derived = 0
    problems: "list[str]" = []
    cache: "dict[tuple[str, ...], tuple[int, str]]" = {}

    for key, _alias, n, cmd, cwd, extract, cost, _need, _why in COUNTER_READERS:
        if cmd is None:
            derived += 1
            print(f"  · {key:<24} DERIVED — no instrument prints this counter; "
                  f"`ci_check_runs()` computes it and the roster says so")
            continue
        if cost in (SLOW, MUTATING):
            m = re.search(extract, log, re.M | re.S) if log else None
            if m is None:
                uncovered += 1
                print(f"  · {key:<24} UNCOVERED — {cost}, never run from here. Supply "
                      f"`--measured <log>` from a replay that ran it")
                continue
            from_log += 1
            if len(m.groups()) != n:
                mismatched += 1
                problems.append(
                    f"🔴 PATTERN `{key}` matched the measured log and returned "
                    f"{len(m.groups())} number(s), and the row declares {n}")
            else:
                print(f"  · {key:<24} 🟢 from the measured log -> {m.groups()}")
            continue

        if cmd not in cache:
            try:
                p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
                cache[cmd] = (p.returncode, p.stdout + p.stderr)
            except (OSError, subprocess.SubprocessError) as e:
                cache[cmd] = (-1, f"{e}")
        rc, printed = cache[cmd]
        live += 1
        m = re.search(extract, printed, re.M | re.S)
        if m is None:
            mismatched += 1
            first = next((ln for ln in printed.split("\n")
                          if ln.strip() and not ln.startswith(" ")), "")
            problems.append(
                f"🔴 PATTERN `{key}` — `{' '.join(cmd)}` ran and this row's extract "
                f"{extract!r} matched nothing in its output.\n"
                f"     It exited {rc}, so this is "
                + ("a line that MOVED — the instrument is green and printing something "
                   "else than the row was anchored on"
                   if rc == 0 else
                   "a REFUSAL, and a refusing instrument is a counter nobody can read "
                   "back today — 236 §5's class")
                + f"\n     first line: {first.strip()[:150]!r}")
        elif len(m.groups()) != n:
            mismatched += 1
            problems.append(
                f"🔴 PATTERN `{key}` — the row declares {n} number(s) and the extract "
                f"returned {len(m.groups())}: {m.groups()}. `measure()` compares tuples, "
                f"so this row reads a claim of a different width than the block's")
        else:
            print(f"  · {key:<24} 🟢 {' '.join(cmd)} -> {m.groups()}")

    for p in problems:
        print(p)
    total = live + from_log
    print(f"HANDOFF_PATTERNS {total - mismatched}/{total} extract(s) matched their "
          f"instrument · {live} run live · {from_log} off the measured log · "
          f"{uncovered} UNCOVERED · {derived} derived · {len(COUNTER_READERS)} row(s)")
    if mismatched:
        print(f"🔴 HANDOFF_PATTERNS refused — {mismatched} row(s). A reader anchored on a "
              f"line its instrument no longer prints reports the counter UNREAD, and "
              f"UNREAD is what a session reads as `nothing to see`.")
        return 1
    if uncovered:
        print(f"🟡 HANDOFF_PATTERNS ok over what it could reach — {uncovered} row(s) are "
              f"SLOW or MUTATING and no measured log carried them. They are named above "
              f"rather than counted green.")
        return 0
    print("🟢 HANDOFF_PATTERNS ok — every row's extract matched what its instrument "
          "really printed on this tree, with the width the row declares.")
    return 0


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


# ══ THE OPENING TIER ══════════════════════════════════════════════════════════════════
#
# 🔴 THE OPENING RITUAL RE-MEASURED A TREE NOBODY HAD TOUCHED SINCE IT WAS LAST MEASURED.
# Every session opened by running the whole replay against the previous session's block:
# `npm ci`, the 724-test suite, twenty gates including the mutating three, and
# `--patterns`. Timed in a container at 239's tree that is ~8.5 minutes of compute, of
# which four commands are 72% (`instrument_gate.py` 192s, `control_gate.py` 70s,
# `--patterns` 70s, `floor_pin_gate.py` 61s). It found nothing five sessions running, and
# 239 §4 said why in its own words: *"five clean blocks in a row is not evidence about
# this counter and never was."*
#
# THE REASON IS STRUCTURAL AND IT IS NOT ABOUT CARE. Every counter on the VERIFIED line is
# a measurement of the TREE. The session that wrote the block ran them against the commit
# it shipped and recorded the answers. If `HEAD` is that commit and the tree is clean,
# those counters were already measured on this exact tree — re-deriving them asks a
# question whose answer is written in the document being checked. That is 239 §20's own
# test (*"can the document being checked move both ends at once"*) applied to the ritual
# rather than to a reader.
#
# WHAT IS NOT INHERITABLE, AND IT IS EXACTLY THE HEADER. `npm.lag`, `npm.tags`,
# `gh.issues`, `gh.prs` and `git.moved` are facts about the WORLD — a registry, a
# forge, a remote — and the world moves between sessions while the tree does not. So the
# split this mode makes is not a compromise between cost and rigour; it is the line
# between a claim the tree can still answer and a claim only the network can. The header
# is six readers and seconds of network.
#
# 🔴 AND THE CONTROL ON THE INHERITANCE ALREADY EXISTS, WHICH IS WHY THIS IS NOT A HOLE.
# A session that ships runs the full ritual at CLOSE, against its own block. Any counter
# that is a fact about the MACHINE rather than the tree — 239 §5.2's class, a green that
# is true of one disk — shows up there as a disagreement on a tree whose source did not
# move, and that is a finding rather than a false red. Tier 0 does not assert the counters
# are right. It asserts something weaker and true: **session N verified them against this
# exact tree, and this is that tree.** The output says `INHERITED FROM <n> AT <sha>` and
# never `ok`, because a mode that printed the same word as a full run would be a mode that
# quietly redefined it.

TIER0, TIER1 = "TIER0", "TIER1"


def tier_trigger(prev: Path, root: Path = ROOT) -> "tuple[str, str, str, str]":
    """(required tier, HEAD sha, the block's sha, why) for opening against `prev`.

    The trigger is measured, never declared: a session cannot elect the cheap tier by
    saying so. `TIER1` is required whenever this reader cannot show that the tree in
    front of it is the tree the previous block was verified against.
    """
    def git(*a: str) -> str:
        p = subprocess.run(("git", *a), cwd=root, capture_output=True, text=True)
        return p.stdout.strip()

    head = git("rev-parse", "--short", "HEAD") or "?"
    dirt = [ln for ln in git("status", "--porcelain").split("\n") if ln.strip()]
    block, why = status_block(prev.read_text(encoding="utf-8"))
    if why:
        return (TIER1, head, "?", f"the previous block did not parse — {why}")
    shas = main_shas(block)
    if not shas:
        return (TIER1, head, "?", "the previous block's `main` row carries no SHA, so "
                                  "there is nothing to compare this tree against")
    claimed = shas[0]
    if dirt:
        return (TIER1, head, claimed,
                f"the working tree is DIRTY ({len(dirt)} file(s)) — the counters on the "
                f"block were measured against a clean {claimed} and this is not it")
    n = min(len(head), len(claimed))
    if head[:n] != claimed[:n]:
        return (TIER1, head, claimed,
                f"HEAD is {head} and the block was verified at {claimed}. Every counter "
                f"on the VERIFIED line is a measurement of the tree, and this is a "
                f"different tree")
    return (TIER0, head, claimed, "")


def open_tier(prev: Path, run_network: bool, root: Path = ROOT) -> int:
    """Tier 0: bind every counter atom without running an instrument, re-read the world."""
    tier, head, claimed, why = tier_trigger(prev, root)
    text = prev.read_text(encoding="utf-8")
    session = None
    m = SESSION_RE.search(prev.name)
    if m:
        session = int(m.group(1))

    if tier == TIER1:
        print(f"HANDOFF_OPEN TIER1_REQUIRED — {why}")
        print(f"🔴 the cheap tier is not available here. Run the full replay: the "
              f"counters on {prev.name}'s block cannot be inherited onto a tree they "
              f"were not measured against.")
        return 1

    # ── the counter line: bound, floored, and NOT re-run ──────────────────────────────
    block, _ = status_block(text)
    atoms, why2 = counter_atoms(block)
    if why2:
        print(f"🔴 HANDOFF_OPEN {why2}")
        return 1
    problems: "list[str]" = []
    keys: "set[str]" = set()
    for a in atoms:
        key, problem = bind(a)
        if key:
            keys.add(key)
        else:
            problems.append(f"🔴 {problem}")
    if len(atoms) < CLAIM_FLOOR:
        problems.append(f"🔴 CLAIM_FLOOR {len(atoms)} atom(s) < {CLAIM_FLOOR} — a block "
                        f"this reader parsed down to nothing agrees with everything")
    # the DROPPED-counter direction still holds at this tier: it is a property of the
    # block's text, not of any instrument, and it is the half that catches a session
    # quietly ceasing to report a field.
    unreached = [k for k, _a, _n, _c, _cw, _e, _co, need, _w in COUNTER_READERS
                 if k not in keys and needed(need, session) == REQUIRED]
    for k in unreached:
        problems.append(f"🔴 DROPPED COUNTER — no atom in the block reaches `{k}`, and "
                        f"that reader is REQUIRED for session {session}")

    # ── the header: re-read, because the world moves and the tree does not ────────────
    h_problems, h_notes, h_atoms, h_compared = check_header(block, "", run_network,
                                                            session)
    for n in h_notes:
        print(f"  · {n}")
    problems.extend(h_problems)

    print(f"HANDOFF_OPEN {prev.name} · TIER0 · {len(atoms)} counter atom(s) INHERITED "
          f"FROM {session} AT {claimed} · {h_atoms} header atom(s) · {h_compared} "
          f"re-read against the world")
    for p in problems:
        print(p)
    if problems:
        print(f"🔴 HANDOFF_OPEN refused — {len(problems)} problem(s).")
        return 1
    print(f"🟢 HANDOFF_OPEN ok — HEAD is {head}, the tree is clean, and it is the tree "
          f"session {session} verified these counters against. They are INHERITED, not "
          f"re-measured: the full replay runs at CLOSE, against the block this session "
          f"writes, and that is where a counter which is a fact about the machine rather "
          f"than the tree will disagree.")
    return 0


def declared_tier(text: str) -> "str | None":
    m = TIER_DECLARE_RE.search(text)
    return m.group(1).upper() if m else None


def main(argv: "list[str]") -> int:
    if "--selftest" in argv:
        return selftest()
    if "--open" in argv:
        rest = [a for a in argv[argv.index("--open") + 1:] if not a.startswith("--")]
        if not rest:
            print("🔴 --open needs the PREVIOUS session's handoff")
            return 2
        return open_tier(Path(rest[0]).resolve(), run_network="--network" in argv)
    log = ""
    if "--measured" in argv:
        log = Path(argv[argv.index("--measured") + 1]).read_text(encoding="utf-8")
    if "--patterns" in argv:
        return patterns(log)
    paths = [a for a in argv[1:] if not a.startswith("--")]
    if not paths:
        print(__doc__.strip().split("Run:")[-1])
        return 2
    handoff = Path(paths[0]).resolve()
    if not handoff.is_file():
        print(f"🔴 no such handoff: {handoff}")
        return 1
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
