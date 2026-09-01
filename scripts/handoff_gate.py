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
      python3 scripts/handoff_gate.py --gh-open      (271 §1 / 272 §3, emitter: the three
                                                     world-facing readings — GH_OPEN_ISSUES,
                                                     GH_OPEN_PRS, ASSETLIB_VERSION)
      python3 scripts/handoff_gate.py --open ../HANDOFF_SESSION270.md --measured run.log

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

import contextlib
import inspect
import io
import json
import os
import re
import subprocess
import sys
import tempfile
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
READER_FLOOR = 29        # governed by floor_pin_gate's SIZE_LEDGER

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
    # 🆕 269 — check 32's line, WHICH 268 PUT IN ITS BLOCK AND NEVER GAVE A ROW. That is
    # how `--open` refused at this session's pickup: `error-code discipline 54 reads / 29
    # raise sites / 0 problems` bound to nothing, so the one number in it that can go
    # non-zero was a sentence rather than a claim. All five halves are read, because the
    # populations are the part that can quietly collapse — `0 problem(s)` over a scan that
    # found no raise sites and no codes is the empty-population green this whole file
    # exists to refuse, and 267's finding is that it looks exactly like a clean one.
    ("contract.error_codes", r"error-code discipline", 5,
     ("python3", "../scripts/contract_check.py"), HOST,
     r"^Error-code discipline\s*: (\d+) message read\(s\) scanned · (\d+) raise site\(s\) "
     r"judged · (\d+) host-origin code\(s\) vs (\d+) addon · (\d+) problem\(s\)",
     CHEAP, SINCE(269),
     "`error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 53 addon / 0 "
     "problems`. SINCE 269 because 268 is the first block to carry the line and it "
     "carries a three-number spelling this reader does not extract — the row is declared "
     "from the session that made the print match it."),

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

    # ── assetlib_sweep.py --census ────────────────────────────────────────────────────
    # 🆕 291 — THE LANDSCAPE ROSTER'S TWO POPULATIONS, AND THE COUNTER EXISTS BECAUSE THE
    # SECOND ONE IS WRITTEN BY A MACHINE. `surfaced` is forty-seven rows derived from a
    # live query and consumed by a gate; a population that size, arriving in one commit,
    # with no number in any status block, is precisely the shape 246 named and 290 §2.4
    # re-found one file over — a table whose size can move without a line going red.
    # 🔴 THREE NUMBERS AND NOT ONE, BECAUSE THE INTERESTING FACT IS THE RATIO. `analysed`
    # standing still while `surfaced` rises is the roster covering a wider field more
    # thinly, and `channel(s)` is what makes either number a claim about a POPULATION
    # rather than about one host — a channel quietly leaving `CHANNELS` would shrink the
    # other two counts for a reason no reader of the block could see.
    ("landscape.roster", r"\blandscape\b", 3,
     ("python3", "../scripts/assetlib_sweep.py", "--census"), HOST,
     r"^LANDSCAPE_CENSUS (\d+) channel\(s\) / \d+ enumerable · (\d+) analysed / "
     r"(\d+) surfaced",
     CHEAP, SINCE(291),
     "channels declared, products read at source, products a discovery leg has seen. "
     "`landscape 4 channel(s) / 51 analysed / 47 surfaced`."),

    # ── the .mjs instruments ──────────────────────────────────────────────────────────
    ("taut.sites", r"\btaut\b", 1, ("node", "scripts/tautology_gate.mjs"), HOST,
     r"^TAUT_GATE ok — (\d+) claim site", CHEAP, REQUIRED,
     "claim sites read. `taut 4046`."),
    # 🆕 275 — `duration-assertions-unguarded` (273). The OFFENCE is zero on a healthy
    # tree and cannot be a counter; the POPULATION the rule recognised can, and is the
    # only number that separates a reader working from a reader that stopped reading the
    # idiom. SINCE 275 because 275 is the first block that can carry it.
    ("taut.duration", r"\bduration\b", 3, ("node", "scripts/tautology_gate.mjs"), HOST,
     r"^TAUT_DURATION\s+sites=(\d+)/\d+ lower=(\d+) guarded=(\d+)", CHEAP, SINCE(275),
     "elapsed-time assertion sites, of which lower bounds, of which guarded by a named "
     "slack term. `duration 4 sites / 2 lower / 2 guarded`."),
    # 🆕 287 — `block-counters-without-readers` (286 §1.3). 285 shipped
    # `difference_field_gate.mjs` and pinned `ORPHAN_CEILING` at its live value, then put
    # BOTH counters in its block with no row here — two numbers the block asserted that
    # nothing in this tree could check. `INSTRUMENT_GATE_DISCOVER` accepts a roster entry
    # or a declared exemption and nothing else; this reader accepts a reader or SILENCE,
    # and 285 took a third option that does not exist. They were dropped from the block
    # to get the close green, which is the weaker of the two answers.
    #
    # 🔴 SINCE 287 IS A MEASUREMENT, NOT A COURTESY. 285's block is the only one that ever
    # carried either spelling and 286 dropped both, so there is no run of blocks to make
    # them REQUIRED of — 287 is the first block that can carry them, which is
    # `taut.duration`'s boundary for `taut.duration`'s reason. The row and the counter
    # ship in the same PR, which is 286 §7.5.
    ("taut.orphan", r"\borphan\b", 2, ("node", "scripts/tautology_gate.mjs"), HOST,
     r"orphan=(\d+)/(\d+)", CHEAP, SINCE(287),
     "🔴 THE READER WAS ALREADY WRITTEN. `tautology_gate.mjs` has printed "
     "`TAUT_ATTRIBUTED units=… claims=… orphan=44/44` since 258 and 285 restated the "
     "pair by hand with nothing comparing it. Bound to the gate's own line rather than "
     "to the block's phrasing, for `instrument.across`'s reason: the block's spelling is "
     "a session's synthesis of two lines and the roster line is the one whose subject is "
     "the population. The pair is claims-attributed over the ceiling, so it costs "
     "nothing beyond `taut.sites` — same command, already run."),
    ("difference_field.population", r"\bdifference_?field\b", 3,
     ("node", "scripts/difference_field_gate.mjs"), HOST,
     r"^DIFFERENCE_FIELD (\d+) in population · (\d+) unreachable by default "
     r"\((\d+) declared\)", CHEAP, SINCE(287),
     "`difference_field 28 population / 5 unreachable / 5 declared` — the population, "
     "the half of it no ordinary client can reach, and the half of THAT which is "
     "declared. Three numbers in one atom because the second is meaningless without the "
     "first and the third is the whole verdict on the second: a session that let the "
     "undeclared count drift would be reporting an unreachable tool as accounted for."),
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
     "claims; the spelling is what the alias and `n` are for. "
     "🆕 292 — 🔴 READ THIS COUNTER OUT OF `ci<N>/ci-measured-host-tests-*/`, NEVER OUT "
     "OF THE LOCAL REPLAY. 291 §3.1 took seven readings of ONE commit: a Cowork container "
     "answered 2937 four times over two clones and two `npm ci` installs, and GitHub "
     "Actions answered 2928 three times over three runners and three Node majors, one of "
     "them a re-run an hour later — twenty-three per-instrument lines byte-identical "
     "within each side and zero variance on either. So the counter is a deterministic "
     "function of (tree, MACHINE CLASS) and of nothing else this apparatus varies: not a "
     "re-run, not a clone, not an install, not a Node major, not an hour. Six sessions "
     "each paid one correction discovering that at the close, because the close compares "
     "against the CI artifacts and a block carrying the machine\'s own number is a block "
     "that will be refused. The rule has no preference in it — the counter\'s SOURCE is "
     "the artifact directory, because that is what the gate reads. 🔵 `leg_disagreements` "
     "cannot see this and is not broken: the three CI legs agree with each other exactly, "
     "so the only disagreement is CI-versus-elsewhere and no comparison between artifacts "
     "reaches it. 🔵 WHICH difference between the two machine classes moves the count by "
     "nine — CPU count, and therefore `node:test` concurrency, is the first suspect, "
     "since the number counts FAILURE LINES and a differently-interleaved run can "
     "truncate or repeat them — is a smaller question and was never what the row asked."),
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

# ══ 🆕 281 — WHAT IS EACH OF THESE THIRTY-FIVE NUMBERS A FACT ABOUT? ═══════════════════
#
# 234 §4.8 named the class and closed with the gap: *"nothing distinguishes the two
# classes of counter."* `PROVENANCE`, below, closed it for the NINE header rows. It has
# never been asked of these thirty-five, and 280 opened `counter-provenance-undeclared`
# for exactly that asymmetry — the one table in this tree that asks a reader what its
# counter is a fact ABOUT covers a quarter of the readers.
#
# 🔴 AND THE HEADER'S OWN THREE VALUES DO NOT TRANSFER. `TREE / CLONE / REMOTE` asks
# WHERE a number is read from, and all thirty-five run a command in this checkout, so
# every row would answer TREE and the column would be a predicate with one value and no
# population — 276's *a column with no stated predicate cannot be wrong*, re-created by
# copying a good table into the wrong question. The question that has a population here
# is the one TIER0 already turns on: **what could make this number different at THIS
# COMMIT?** `open_tier` inherits all thirty-five when HEAD matches and the tree is clean,
# and its own printed sentence has said since 240 that *a counter which is a fact about
# the machine rather than the tree will disagree* at the close. That sentence names a
# hazard with no reader between it and anybody — which is 280's second failure shape
# exactly, in the file that found it.
#
# 🔵 AND THE ANSWER IS DERIVED FROM THE READER'S OWN SOURCE, not typed: `subject_of`
# greps the script a row RUNS for the idioms that make its answer depend on something
# other than the tracked bytes, exactly as `job_provides` derives what a CI job supplies
# from the job's own YAML. A row whose command names no script cannot be derived and
# must say so with a measured reason — `SUBJECT_UNDERIVABLE`, on `NOT_A_TARGET`'s
# convention that an exemption is measured before it is written down.
#
# 🔴 THE FIRST DRAFT OF THAT DERIVATION READ COMMENTS AND GOT FOUR ROWS WRONG.
# `tautology_gate.mjs` was called MACHINE for a `Date.now()` that appears once, inside a
# sentence explaining why millisecond resolution scored zero. `wire_diff.mjs`,
# `release_names.py` and `control_gate.py` were called INDEX for `git diff` and
# `git ls-files` written in prose ABOUT what they read. Four of the thirteen scripts,
# every hit a comment. That is 279's terminology finding one file over — a predicate
# satisfied by a MENTION is a predicate about mentions — so `code_only` strips comments
# and string literals before anything is matched, and the derivation answers about code.
# 🔴 THE OBJECT STORE AND THE NETWORK ARE NOT ON THIS AXIS, AND LEAVING THEM OFF IS THE
# DESIGN. `GATE_INPUTS` (280 §4) already answers *what does this command need* over
# `objects` and `network`, derived from each job's own YAML. A second table restating
# either would be two opinions about one fact the first time one of them was edited —
# 203 §2's rule, and 229 §5.2's import-don't-restate. This column answers only what that
# one does not: at a commit where every input IS supplied, what can still move the number?
#
# 🔵 AND `CLONE` IS 234 §4.8's OWN WORD, GIVEN A POPULATION AT LAST. `PROVENANCE` declares
# TREE / CLONE / REMOTE and no header row has ever carried CLONE — it is named there only
# as the word for the wrong answer. 234 listed the class in prose — *any counter that
# reads GIT CONFIG, remotes, hooks or file modes is a fact about the clone* — and nothing
# has ever asked it of a counter. `git-hooks-unset` (228, fifty-three sessions open) is
# that class with a queue row and no reader.
TRACKED, INDEX, CLONE_CFG, MACHINE = "TRACKED", "INDEX", "CLONE", "MACHINE"

# value -> (what the number is a fact about, what shows it in the source). The regex IS
# the predicate; it is here beside the meaning so the two cannot drift apart — 280 §4's
# `INPUT_PROVIDERS`, one table over.
#
# 🔴 A GIT SIGNAL IS MATCHED ONLY IN ITS ARGV SPELLING, AND FOUR WRONG ANSWERS BOUGHT
# THAT RULE. Every reader here spells a command as a LIST — `["git", "ls-files", …]`,
# `run("git", ["worktree", "add", …])` — so the pattern has to reach the pair. Written
# loosely it matched, in one run: `"add"` inside `scope_gate.py`'s `_GROWERS` tuple of
# METHOD names; `"add"` inside `wire_diff.mjs`'s `git worktree add`, which is the object
# store and not the index; `git config` inside an `instrument_gate.py` exemption REASON,
# which is prose that happens to live in a single-line string; and `hrtime` inside THIS
# TABLE'S OWN REGEX, because the corpus of a derivation over `scripts/` contains the
# derivation. Requiring `"git"` NEXT TO the verb kills the first three outright.
#
# 🔴 AND EVEN AN UNAMBIGUOUS VERB IS MATCHED ONLY AS A WHOLE QUOTED TOKEN, which this
# file's own self-test is what found — the live pair below refused the draft above it.
# `floor_pin_gate.py` carries the sentence *Tracked paths `git ls-files` returns* inside
# a FLOOR REASON, and a reason is a single-line string, which `code_only` keeps because
# an argv element is one too. The difference is that an argv element IS the whole string
# and prose merely contains the words. That is the entire distinction, and it is now a
# claim rather than a hope.
#
# 🔵 AND IT MEANS A COMMAND SPELLED AS A SHELL STRING WOULD BE MISSED, so that assumption
# is a claim rather than a hope: `SUBJECT_SHELL_SPELLING` in the self-test refuses any
# reader script that spells `git <verb>` outside an argv list.
#
# 🔴 AND THE VERB IS NOT ALWAYS NEXT TO THE WORD. `_gate_lock.py`, which every mutating
# gate imports and none of them can run without, spells it `subprocess.run(("git",) +
# args)` and takes its baseline as `_git("status", "--porcelain", "-z")`. Nothing
# adjacent, in either file — the two halves of the command live on different lines of
# different modules, so a reader that reaches the index through the shared lock is
# invisible to a grep over its own source AND to a grep over the helper's. That is why
# the corpus is the script PLUS the first-party modules it imports (`reader_corpus`), and
# why the idioms come in two tiers: an UNAMBIGUOUS one (`ls-files`, `--porcelain`,
# `--cached`) is matched anywhere in code, and an AMBIGUOUS one (`status`, `add`,
# `config` — words that are also method names and English) only next to `"git"`.
_GIT = r"[\"']git[\"']\s*,\s*\[?\s*[\"']"
SUBJECT_SIGNALS: "dict[str, tuple[str, str]]" = {
    MACHINE: ("the runner — interpreter version, installed tooling, parallelism or the "
              "clock. Two machines at the SAME commit may honestly disagree, which is "
              "the one class TIER0's inheritance cannot be repaired for by re-running",
              # 🆕 289 — `cpu_count` WAS THE ONE BARE TOKEN IN THIS PATTERN, and every
              # sibling idiom beside it is call-shaped or module-qualified (`time.time(`,
              # `Date.now(`, `os.cpu`, `process.hrtime`). Bare, it matched two things that
              # are not readings of a machine: this regex's own source text, and the
              # selftest fixture below that drives it — so the derivation over `scripts/`
              # answered MACHINE about the file that defines the derivation (281's row,
              # re-measured at 282). Call-shaping it costs nothing an idiom-shaped grep
              # was buying and removes both. The expensive half of that row — deriving per
              # INVOCATION rather than per file — is still open and still worth having.
              r"cpu_count\(|os\.cpu|time\.time\(|time\.perf|Date\.now\(|process\.version"
              r"|sys\.version_info|shutil\.which|platform\.(?:system|machine|release)"
              r"|process\.hrtime|multiprocessing\.|Math\.random\(|random\.(?:random|choice|shuffle)"),
    CLONE_CFG: ("THIS CHECKOUT's configuration — hooks, remotes, `git config`. 234 §4.8 "
                "named the class and nothing has ever asked it of a counter; a number "
                "that reads it is true of one disk",
                _GIT + r"(?:config|remote)[\"']|core\.hooksPath|get-url"),
    INDEX: ("what git currently TRACKS — `git ls-files`, `git status`, the index. Equal "
            "on every machine at a committed clean tree and NOT equal in a dirty one, "
            "which is 254's measured rule: an untracked file is invisible to the reader "
            "while it sits in the working tree, so a blast radius measures smaller "
            "locally than in CI and a green local replay is refused there",
            r"[\"'](?:ls-files|--porcelain|--cached|diff-index)[\"']|"
            + _GIT + r"(?:status|add)[\"']"),
    TRACKED: ("the tracked bytes at this commit, and nothing else. The same number on "
              "every machine, in CI or locally, in a dirty tree or a clean one — the "
              "only class TIER0 can inherit without qualification", r""),
}

# 🔴 THE ROWS THE DERIVATION CANNOT ANSWER FOR, with the measured reason for each — on
# `NOT_A_TARGET`'s convention that an exemption is measured before it is written down.
# Three rows, and each is a different way of being unanswerable.
SUBJECT_UNDERIVABLE: "dict[str, str]" = {
    "host.suite":
        "NO SCRIPT IN THE ARGV. `npm test`'s subject is the whole `host/test` tree and "
        "the engine under it. 🔴 DECLARED MACHINE ON A MEASUREMENT, NOT A GUESS: "
        "`dap-late-rejection-flake` (275) is an OPEN queue row recording that "
        "`dap.test.ts`'s *a launch rejection arriving AFTER a stop still ends the "
        "session* failed once on a loaded `node 22` runner and passes everywhere else. "
        "The block's most prominent counter — the bare `904/904` every session copies "
        "first — is the one this tree has already measured as not a pure function of "
        "its own bytes, and no session has ever said so on the line that carries it.",
    "ci.checks":
        "NO COMMAND AT ALL — the single `cmd=None` row, derived in-process by "
        "`ci_check_runs` from `.github/workflows`. TRACKED, and the cleanest member of "
        "that class in the table: the workflow files are the entire population.",
    "handoff.claims":
        "🔴 ONE FILE, TWO SUBJECTS, AND THE ROW RUNS THE PURE ONE. The derivation "
        "answers about a FILE and a row invokes a MODE. `handoff_gate.py --selftest` is "
        "fixture-driven and reads nothing but this file's own tables; the same file's "
        "`--gh-open` dials GitHub and npm. 🆕 289 — RE-MEASURED, AND THE ANSWER MOVED "
        "WITHOUT THE ROW MOVING: it came back MACHINE on a bare `cpu_count` that was in "
        "`SUBJECT_SIGNALS`' own regex, and call-shaping that idiom drops it to CLONE on "
        "`\"git\", \"config\"`, `\"git\", \"remote\"`, `core.hooksPath` and `get-url` — "
        "the network and configuration path `--selftest` does not reach. The exemption "
        "is unchanged and its reason is stronger: the file still holds two subjects and "
        "this row still runs the pure one. TRACKED, by the mode.",
}

# Every reader key's SUBJECT, derived at 281 by `subject_of` over `reader_corpus` and
# checked against it on every run — this is a table of measurements, not of opinions, and
# `SUBJECT_UNDERSTATED` refuses any row whose reader reads more than its value admits.
#
# 🔵 THE SHAPE IS A DICT BESIDE THE TABLE rather than a tenth tuple column, which is
# `PROVENANCE`'s own shape one roster over: a column costs an edit to all thirty-five
# nine-tuples, and 203 §2's rule is about the READER being one, not the storage.
COUNTER_PROVENANCE: "dict[str, str]" = {
    "host.suite":                  MACHINE,
    "contract.checks":             INDEX,
    "contract.error_codes":        INDEX,
    "floor_pin.targets":           INDEX,
    "floor_pin.governed":          INDEX,
    "floor_pin.literal":           INDEX,
    "floor_pin.shortfall":         INDEX,
    "floor_pin.unswept":           INDEX,
    "floor_pin.exempt":            INDEX,
    "term.swept":                  INDEX,
    "landscape.roster":            TRACKED,
    "taut.sites":                  TRACKED,
    "taut.duration":               TRACKED,
    "taut.orphan":                 TRACKED,
    "difference_field.population": TRACKED,
    "seal.count":                  TRACKED,
    "boundary.judged":             TRACKED,
    "wire_diff.key":               TRACKED,
    "wire_invisible.cases":        TRACKED,
    "lint.files":                  INDEX,
    "ci.checks":                   TRACKED,
    "mutlock.guarded":             INDEX,
    "tree_quiet.cases":            CLONE_CFG,
    "release_names.rows":          TRACKED,
    "instrument.discover":         INDEX,
    "instrument.undeclared":       INDEX,
    "handoff.claims":              TRACKED,
    "scope.enumerators":           INDEX,
    "control.controls":            INDEX,
    "instrument.across":           INDEX,
    "instrument.late_live":        INDEX,
    "instrument.crashed":          INDEX,
    "instrument.blast":            INDEX,
    "instrument.not_loaded":       INDEX,
    "queue.claims":                INDEX,
    "instrument.py_gates":         INDEX,
    "instrument.sig":              INDEX,
    "instrument.late_constructed": INDEX,
}


def code_only(text: str, suffix: str) -> str:
    """Source with its PROSE removed and its arguments kept — PURE.

    🔴 THE FIRST DRAFT REMOVED COMMENTS AND GOT FOUR ROWS WRONG IN ONE DIRECTION.
    A grep for `git diff` over `wire_diff.mjs` matches a sentence explaining what check 2
    reads; `Date.now` over `tautology_gate.mjs` matches a note about millisecond
    resolution. A predicate satisfied by a MENTION is a predicate about mentions — 279's
    terminology exclusion, which excused any tracked file for naming a policy file.

    🔴 AND THE SECOND DRAFT REMOVED STRING LITERALS AND GOT THIRTEEN WRONG IN THE OTHER.
    Every one of these readers spells its command as an argv LIST — `["git", "ls-files",
    …]` — so the signal this column exists to find lives in exactly the tokens a
    prose-stripper throws away. It returned TRACKED for `instrument_gate.py`, whose
    `blast` counter three separate sessions have had to correct from a local reading to
    CI's at the same commit. **A derivation that answers cleanly about the wrong
    population is worse than no derivation**, and this one had already been written down
    as a finding before the count contradicted it.

    So the line is PROSE, not strings: `#` and `//` and `/* */` go, TRIPLE-quoted blocks
    and JSDoc go, and ordinary quoted strings stay, because an argv is a string and a
    docstring is a paragraph. Python goes through `tokenize`, which can tell a
    triple-quoted token from a single-quoted one exactly.
    """
    if suffix == ".py":
        import io
        import tokenize as _tok
        out = []
        try:
            for t in _tok.generate_tokens(io.StringIO(text).readline):
                if t.type == _tok.COMMENT:
                    continue
                if t.type == _tok.STRING and re.match(r'^[a-zA-Z]*("""|\'\'\')', t.string):
                    continue
                out.append(t.string)
        except (_tok.TokenError, IndentationError, SyntaxError):
            # A file this reader cannot tokenize is UNREAD, not clean: hand back the text
            # so the signals still match and the row is judged on the raw source.
            return text
        return " ".join(out)
    out, i, n = [], 0, len(text)
    while i < n:
        c = text[i]
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            i = text.find("\n", i)
            if i < 0:
                break
        elif c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
        else:
            out.append(c)
            i += 1
    return "".join(out)


def subject_of(source: str, suffix: str) -> "tuple[str, list[str]]":
    """(the strongest class this source shows, the idioms that showed it) — PURE.

    Strongest wins, because a reader that dials the registry AND reads `git ls-files` is
    a fact about the world before it is a fact about the index — the weaker answer would
    understate what can move the number. `TRACKED` is the absence of every signal and
    carries no idioms, which is why its own regex is empty and it is never matched for.
    """
    code = code_only(source, suffix)
    for value in (MACHINE, CLONE_CFG, INDEX):
        rx = SUBJECT_SIGNALS[value][1]
        hits = sorted(set(m.strip() for m in re.findall(rx, code)))
        if hits:
            return (value, hits[:6])
    return (TRACKED, [])


def reader_source(cmd: "tuple[str, ...] | None", cwd: Path) -> "Path | None":
    """The script a COUNTER_READERS row runs, or None when its command names none — PURE
    over the row, which is what makes `SUBJECT_UNDERIVABLE` a closed population."""
    for arg in cmd or ():
        if arg.endswith((".py", ".mjs", ".js")):
            return (cwd / arg).resolve()
    return None


def reader_corpus(script: Path) -> "list[Path]":
    """The script and every FIRST-PARTY module it imports from its own directory.

    🔴 THE SCRIPT ALONE IS THE WRONG POPULATION AND `_gate_lock.py` IS THE PROOF. Every
    mutating gate imports `run_and_settle` from it and cannot run without it; the helper
    is where the `git status --porcelain` baseline is taken, and a derivation over the
    gate's own bytes sees none of it. A reader that reaches its input through an import
    is one an import-blind grep calls clean.

    The population is DERIVED — a sibling `.py` named by a `from X import` — and not a
    list, so a helper that gets split, renamed or joined by a second one enters by
    itself. One hop only: a hop counter is a graph walk, and every first-party module in
    this tree lives one import from the script that uses it. If that stops being true it
    stops being true visibly, because the module named will not be a sibling.
    """
    out = [script]
    if script.suffix != ".py":
        return out
    try:
        text = script.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return out
    for name in re.findall(r"^from\s+([A-Za-z_][\w]*)\s+import\s", text, re.M):
        sib = script.parent / f"{name}.py"
        if sib.exists() and sib != script:
            out.append(sib)
    return out


def subject_coverage(declared: "dict[str, str]") -> "list[str]":
    """Every value in `SUBJECT_SIGNALS` that no row in `declared` carries.

    🔴 ASKED OF THE TABLE HANDED IN AND OF NOTHING ELSE — 280 §4's rule, paid there by a
    whole-table question asked inside a per-roster reader. A value nothing carries is a
    predicate with no population, which is the defect this whole column exists to name.
    """
    if not declared:
        return []
    carried = set(declared.values())
    return [f"🔴 SUBJECT_UNPOPULATED `{v}` — {SUBJECT_SIGNALS[v][0][:60]}… and no row "
            f"carries it. A value nothing answers is a predicate that cannot be wrong"
            for v in SUBJECT_SIGNALS if v not in carried]


def derive_subjects(rows: "list[tuple]", underivable: "dict[str, str]"
                    ) -> "dict[str, tuple[str, list[str]]]":
    """{key: (subject, idioms)} for every row the derivation CAN answer for — impure only
    in that it reads the reader scripts off disk; every decision is `subject_of`'s.

    A row in `underivable` is skipped, and so is one whose script is not present: a
    derivation over a file that is not there would return TRACKED, which is the confident
    answer to an unasked question.
    """
    out: "dict[str, tuple[str, list[str]]]" = {}
    for r in rows:
        key, cmd, cwd = r[0], r[3], r[4]
        if key in underivable:
            continue
        script = reader_source(cmd, cwd)
        if script is None or not script.exists():
            continue
        try:
            text = "\n".join(p.read_text(encoding="utf-8", errors="replace")
                             for p in reader_corpus(script))
        except OSError:
            continue
        out[key] = subject_of(text, script.suffix)
    return out


def counter_subject_problems(rows: "list[tuple]", declared: "dict[str, str]",
                             derived: "dict[str, tuple[str, list[str]]]",
                             underivable: "dict[str, str]") -> "list[str]":
    """Every way the declared subject of a counter disagrees with the tree — PURE.

    `derived` is {key: (value, idioms)} for the rows whose command names a script;
    `underivable` is the measured-reason table for the rest. Four directions, and the
    third is the live one.
    """
    keys = {r[0] for r in rows}
    out = []
    for k in sorted(set(declared) - keys):
        out.append(f"🔴 SUBJECT_STALE `{k}` is declared and is not a reader in this file")
    for k in sorted(keys - set(declared)):
        out.append(f"🔴 SUBJECT_UNDECLARED `{k}` — a counter whose subject nobody named. "
                   f"234 §4.8's gap, on the half `PROVENANCE` does not cover")
    for k in sorted(set(underivable) - keys):
        out.append(f"🔴 SUBJECT_UNDERIVABLE_STALE `{k}` — exempted from derivation and "
                   f"not a reader. 174 §5: an exemption outlives what it excused")
    for k in sorted(derived):
        if k not in declared:
            continue
        got, idioms = derived[k]
        if got != declared[k] and _stronger(got, declared[k]):
            out.append(
                f"🔴 SUBJECT_UNDERSTATED `{k}` is declared {declared[k]} and its reader's "
                f"own code shows {got}: {', '.join(idioms)}. Either the declaration is "
                f"wrong or the reader reads more than its row admits")
    by_cmd: "dict[tuple, set[str]]" = {}
    for r in rows:
        if r[3] and r[0] in declared:
            by_cmd.setdefault(r[3], set()).add(declared[r[0]])
    for cmd, values in sorted(by_cmd.items()):
        if len(values) > 1:
            out.append(f"🔴 SUBJECT_SPLIT `{' '.join(cmd)}` produces counters declared "
                       f"{sorted(values)}. One command is one reading of one world; two "
                       f"subjects off one invocation is 239 §2's shape")
    return out


def _stronger(got: str, declared: str) -> bool:
    """Is `got` a wider claim about what can move a number than `declared`? — PURE.

    Only an UNDERSTATEMENT is a problem. A row declared MACHINE whose code shows only
    INDEX is a row being careful, and this reader does not argue with care — 275's
    `dap-late-rejection-flake` is the standing proof that a source-level grep cannot see
    every way a number moves.
    """
    order = [TRACKED, INDEX, CLONE_CFG, MACHINE]
    return order.index(got) > order.index(declared)


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
    "npm.untagged": REMOTE,  # 🆕 280 — commits past ORIGIN's newest tag. REMOTE for
                            # the reason the row had to be written to discover: the
                            # denominator is origin's tag list and NOT `git tag`,
                            # which is 234 §4.8's class one counter over. See
                            # `npm_untagged` for why a clone cannot answer it.
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
    # 🆕 292 §5 — 🔴 A COMMIT SHA WHOSE SEVEN CHARACTERS HAPPEN TO BE ALL DIGITS. Every
    # block since 227 prints two or three abbreviated SHAs above `VERIFIED` — the `main`
    # row's, the pre-squash tip on the branch row's continuation, and the one in `CI GREEN
    # … at <sha>` — and for sixty-five blocks every one of them contained a letter, so
    # `COUNTER_RE` never saw them. 292's merge commit is `5155079`. It is a SHA, git
    # resolves it, and it is also seven decimal digits, so the header half read it as a
    # counter twice: `UNREADABLE HEADER CLAIM` on `squashed to 5155079`, and `git.moved —
    # the block says [5155079, 1], the tree says [1]` on the `main` row, where the atom's
    # ONE number became two.
    #
    # 🔴 THIS IS NOT RARE AND WAITING FOR IT AGAIN IS NOT A PLAN. A uniformly distributed
    # hex prefix is all-digits with probability (10/16)^7 ≈ **3.7%**, so it lands about
    # once every twenty-seven sessions — and it lands at the CLOSE, on the one document a
    # session cannot re-measure without moving the tree the block describes. 292 found it
    # by being the unlucky session and paid a second PR for it.
    #
    # 🔵 WIDTH IS THE TEST AND IT IS THE HONEST ONE. Every counter this block has ever
    # carried is at most four digits — `taut 4963` is the largest in sixty-five blocks —
    # and git's abbreviated SHA is seven characters or more. There is no overlap to
    # arbitrate, and the pattern deliberately covers hex-with-letters too, which was never
    # a counter and is now exempt for a stated reason rather than by accident of spelling.
    # 🔴 The negative control is the half that matters and it is driven in `--selftest`: a
    # four-digit counter beside a SHA in the same atom survives this row, or the exemption
    # would eat the number it exists to protect.
    (r"\b[0-9a-f]{7,40}\b",
     "🔴 AN ABBREVIATED COMMIT SHA IS NOT A COUNTER, AND ONLY ITS SPELLING EVER SAID SO. "
     "A block prints two or three of them above `VERIFIED` and sixty-five blocks running "
     "contained a letter in every one, which is why nothing needed this row until 292 "
     "merged at `5155079` — seven characters, all of them digits, read as a count in two "
     "atoms at once. Git abbreviates to seven or more; the largest counter any block has "
     "carried is four digits (`taut 4963`); so the width test separates them with nothing "
     "in between to arbitrate, and it is checked in both directions by `--selftest`."),
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


def npm_untagged(root: Path = ROOT) -> "tuple[int, str, str]":
    """(commits past the newest tag ORIGIN holds, note, problem) — NETWORK.

    🆕 280 — `untagged-count-unbound` (279). `registry_lag.py` has printed this
    number beside `distance` since 269 and no header atom has ever read it, so 277,
    278 and 279 each carried a `lag 0` that was true beside a commit distance nobody
    compared: 278's block records nine, 279's pickup measured ELEVEN, and the first
    block that tried to state the number at all was refused for claiming a counter
    nothing binds. 🔴 THE READING THAT DECIDES WHETHER A RELEASE IS OWED WAS THE ONE
    READING NOTHING BOUND.

    🔴 AND BINDING IT IS WHAT FORCED THE POPULATION TO BE NAMED, which is 279's own
    finding arriving one file over. `registry_lag.untagged()` is fed `git_tags()` —
    THIS CHECKOUT's tag list — and 234 §4.8 already measured what that is worth on
    the authoring machine: six tags that existed on one disk and nowhere else. A
    distance counted from a tag origin does not have is a fact about the disk, and a
    distance counted from a tag this checkout does not have cannot be counted at all.
    So the header's reader takes ORIGIN's names, exactly as `npm.lag` does, and
    REFUSES rather than measuring when the newest of them is not here. `PROVENANCE`
    is where that question got asked, because a row cannot be added to it without
    answering *what is this counter a fact ABOUT*.

    The pure half is `registry_lag.untagged()`, imported rather than rewritten (229
    §5.2's rule pointed at this tree's own shelf); only the two inputs are dialed.
    """
    names, prob = origin_tag_names(root)
    if prob:
        return (-1, "", prob)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from registry_lag import parse_tags as _parse, untagged as _untagged  # noqa: E402
    tags = _parse(names)
    if not tags:
        return (-1, "", "origin holds no vX.Y.Z tag — a commit distance measured "
                        "from a tag that is not there is not a small number, it is "
                        "no measurement")
    newest = "v%d.%d.%d" % tags[-1]
    p = subprocess.run(("git", "rev-list", "--count", f"{newest}..HEAD"), cwd=root,
                       capture_output=True, text=True)
    if p.returncode != 0:
        return (-1, "", f"origin's newest tag is {newest} and `git rev-list "
                        f"{newest}..HEAD` exited {p.returncode} — this checkout "
                        f"cannot measure a distance from a tag it does not hold. "
                        f"`git fetch --tags`, then read it again")
    d, why = _untagged(int(p.stdout.strip() or -1), names)
    if d < 0:
        # 🔴 A REFUSAL IS NOT A NUMBER — `npm_lag`'s rule, and the same three
        # conditions reach it here: a collapsed tag population, a `git` that answered
        # with something that is not a count, and a floor nobody re-derived.
        return (-1, "", f"`registry_lag.untagged()` refused rather than measuring: "
                        f"{why}")
    return (d, f"npm.untagged: origin's newest tag is {newest}, origin holds "
               f"{len(names)} tag(s) — {why}", "")


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


QUEUE_HEAD_RE = re.compile(r"<!--\s*QUEUE_HEAD\s+(\d+)\s*-->")


def queue_head(root: Path = ROOT) -> "tuple[int, str]":
    """(the session `QUEUE.md` says the tree is at, problem).

    🆕 284 — THE TREE ALREADY KNEW WHICH SESSION IT WAS, AND NOTHING IN THIS FILE ASKED.
    `QUEUE.md` carries `<!-- QUEUE_HEAD N -->` because `queue_gate.py` derives every row's
    age from it, and 240 deleted the age column precisely so that number could not be
    typed twice. It is therefore the one tracked, gate-read fact that names the session
    the working tree belongs to — and a handoff document, which is the other thing that
    knows, is in `.gitignore` and unreadable from CI by construction (269).
    """
    f = root / "QUEUE.md"
    if not f.is_file():
        return (0, "QUEUE.md is not in this tree, so nothing here can say which session "
                   "it belongs to")
    m = QUEUE_HEAD_RE.search(f.read_text(encoding="utf-8"))
    if not m:
        return (0, "QUEUE.md carries no `<!-- QUEUE_HEAD N -->`, and `queue_gate.py` "
                   "derives every row age from it — so this is a refusal there too")
    return (int(m.group(1)), "")


# ══ 🆕 289 — A SESSION THAT SHIPPED NOTHING LEAVES NOTHING TO REGISTER ═══════════════
#
# 🔴 `population_currency` DERIVES ITS REQUIREMENT FROM `QUEUE_HEAD`, AND THAT DERIVATION
# CARRIES AN ASSUMPTION NOBODY HAD WRITTEN DOWN: that every session between 233 and the
# head SHIPPED. 288 did not. It was asked for analysis and documentation only — no commit,
# no branch, nothing under `godot-claude-bridge/` touched — and it therefore published no
# status block, on its own §7.2 argument that a block is a claim that somebody verified a
# tree and a session that verified none has nothing to claim. Its handoff predicted this
# collision in words (*"would then owe a `BLOCK_POPULATION` row for a session that shipped
# nothing"*) and could not resolve it, because the resolution is a line of code in this
# file and 288 was not allowed to touch this file.
#
# 🔴 THE ANSWER IS A DECLARATION, NOT AN INFERENCE. A gap this reader ignored on its own
# would be a hole any session could open by not registering a block — the precise failure
# `POPULATION_CURRENCY` exists to close, and one that `previous_main` and
# `version_interval` would answer confidently and wrongly through. So an absence is
# admitted only when it is TYPED here with its reason, and the roster is judged in both
# directions: a session cannot be declared absent AND carry a block (that is a
# contradiction, and the block is the stronger evidence), a session at or after the head
# cannot be declared at all (that is a claim about a future nobody has run), and a row
# below the population's own floor exempts nothing.
#
# 🔵 AND THE SUBSTANTIVE REASON THE SKIP IS SAFE IS THE SAME FACT THAT MAKES THE SESSION
# ABSENT. Both backward-scanning readers want the last tree that MOVED; a session that
# shipped no commit did not move it, so scanning past it reaches the same answer it would
# have reached if that session had never opened. The declaration says the tree did not
# move; `git.moved` at the next close is what would catch the claim being false.
BLOCK_ABSENT: "dict[int, str]" = {
    288: "🔴 ANALYSIS AND DOCUMENTATION ONLY, BY INSTRUCTION — a PR was inflight with CI "
         "running, so 288 opened no queue row, ran no mutating gate, made no commit and "
         "left the tree clean at 287's branch tip. It published no status block "
         "deliberately (288 §0.2, §7.2): every counter on a VERIFIED line is a "
         "measurement of a tree, 288 measured none, and a block copied forward would be "
         "287's numbers wearing 288's name. 289 therefore opened against "
         "`HANDOFF_SESSION287.md`, whose block was still the live one because the tree "
         "had not moved. What 288 produced is in the shared folder — the landscape "
         "refresh and the screened unified plan — and 289's Rank 1 is the first of it to "
         "ship.",
}


def block_absent_problems(head: "int | None" = None,
                          population: "list[tuple[int, str]] | None" = None,
                          absent: "dict[int, str] | None" = None) -> "list[str]":
    """The absence roster judged against the population and the head — PURE.

    An entry that contradicts a block, names a session this tree cannot have seen ship,
    or sits below the floor is refused: a roster of exemptions nobody re-reads is 174 §5,
    and this one is the only route past a reader that exists to have no routes past it.
    """
    pop = BLOCK_POPULATION if population is None else population
    ros = BLOCK_ABSENT if absent is None else absent
    have = {s for s, _ in pop}
    out: "list[str]" = []
    for session in sorted(ros):
        if session in have:
            out.append(
                f"🔴 POPULATION_ABSENT_CONTRADICTED session {session} is declared to have "
                f"shipped nothing AND its block is in `BLOCK_POPULATION`. A block is a "
                f"measurement somebody took; the declaration is a sentence somebody "
                f"typed. Delete the row")
        if head is not None and session >= head:
            out.append(
                f"🔴 POPULATION_ABSENT_FUTURE session {session} is declared absent and "
                f"this tree calls itself session {head} — a session at or after the head "
                f"has not finished, so nothing can yet be said about what it left behind")
        if session < POPULATION_SHAPE_FROM:
            out.append(
                f"🔴 POPULATION_ABSENT_UNDERFLOOR session {session} is below "
                f"{POPULATION_SHAPE_FROM}, the oldest session this table is judged from, "
                f"so the row exempts nothing and hides the next one")
        if len((ros[session] or "").strip()) < 80:
            out.append(
                f"🔴 POPULATION_ABSENT_UNREASONED session {session} is declared absent "
                f"with no substantive reason. The whole cost of this roster is that "
                f"somebody has to say why, in a sentence the next reader can disagree "
                f"with")
    return out


def shipped_predecessor(session: int,
                        absent: "dict[int, str] | None" = None) -> "tuple[int, list[int]]":
    """The previous session that SHIPPED — `session - 1`, walked back over every session
    `BLOCK_ABSENT` declares to have left nothing behind. Returns the predecessor and the
    sessions stepped over, because a reader that silently skipped one would be the hole
    this roster exists to keep out of the table.

    🆕 290 — 289 §3.4. `population_currency` learned at 289 that a session which shipped
    nothing owes no block, and `tier_problems` was still asking `from_session ==
    session - 1` — the same assumption, in the other reader, unasked. With 288 declared
    absent, block 289 inheriting from 287 IS inheriting from its predecessor: nothing
    happened in between, and that is the entire content of the declaration. Until this
    resolution existed every session following a no-ship session paid a full replay it
    did not owe — 289 paid exactly that one, and said so in the document this comes from.

    🔴 THE WALK IS FLOORED AT `POPULATION_SHAPE_FROM` AND THAT IS NOT DEFENSIVE PADDING.
    `block_absent_problems` refuses a row below the floor, but this function is called
    with a caller-supplied roster in the self-test and with the module's in the field, and
    a resolver that can walk off the bottom of the table answers a session number no
    reader below it can look up — an unbounded loop in the field and a confusing
    `TIER0_SHA` in the fixture. It stops where the population stops.
    """
    ros = BLOCK_ABSENT if absent is None else absent
    stepped: "list[int]" = []
    n = session - 1
    while n in ros and n > POPULATION_SHAPE_FROM:
        stepped.append(n)
        n -= 1
    return n, stepped


def population_currency(head: "int | None" = None,
                        population: "list[tuple[int, str]] | None" = None) -> "list[str]":
    """253's rule, DERIVED and enforced — every block a shipped session left behind is in
    `BLOCK_POPULATION` before this tree can call itself a later session.

    🆕 284 — 253'S RULE HAS BEEN ENFORCED BY A SENTENCE FOR THIRTY-ONE SESSIONS AND THE
    SENTENCE HAS BEEN GETTING LOUDER. *Add the previous block to `BLOCK_POPULATION`
    before the replay.* 241 missed it and paid a second PR and a full re-replay against a
    moved HEAD. 282 missed it, wrote it in capitals, and paid the same price. 283 read
    282's capitals, missed it anyway, and paid it a third time — then wrote the row this
    reader closes: *the warning is not what is failing; nothing RUNS at pickup that would
    catch it.*

    🔴 AND THE REASON IT KEPT BEING MISSED IS THAT IT IS THE ONE STEP WITH NO NATURAL
    TRIGGER. Every other opening action is provoked by something — the pickup runs
    `--open`, the work provokes the gates, the close provokes the replay. Copying a block
    into a table is provoked by nothing at all until `previous_main` falls back to the
    wrong endpoint six hours later, and by then the price is fixed.

    🔴 SO THE TRIGGER IS THE FACT THE TREE ALREADY MOVES. A session that does any queue
    work at all bumps `QUEUE_HEAD`, and the moment it reads 284 this reader requires 283's
    block — because a tree that calls itself session 284 is a tree in which session 283 has
    SHIPPED. Nothing new has to be remembered and nothing new has to be typed: the
    requirement is derived from a number the session was going to change anyway, which is
    282 §2.3's rule (*a guarantee is false until something derives its population*) applied
    to the one guarantee this apparatus keeps making and breaking about itself.

    🔴 IT DEMANDS A CONTIGUOUS RUN, NOT JUST THE NEWEST. Requiring only `head - 1` would
    be satisfied by a table with a hole in the middle, and both readers that take their FAR
    endpoint out of this table (`previous_main`, `version_interval`) resolve by scanning
    BACKWARD from a session — so a gap is not a cosmetic absence, it is a wrong answer
    delivered confidently, which is the exact failure 244 §2 floored the table's reach for.

    🔴 AND IT CANNOT DEMAND A BLOCK THAT HAS NOT SHIPPED. The population it requires ends
    at `head - 1`: at session 284's pickup `QUEUE_HEAD` still reads 283 and 283's block is
    correctly absent, because 283 is the session whose document this one is standing on and
    a session does not register its own. That asymmetry is why the trigger is the bump and
    not the pickup.
    """
    pop = BLOCK_POPULATION if population is None else population
    have = {s for s, _ in pop}
    if head is None:
        head, why = queue_head()
        if why:
            return [f"🔴 POPULATION_CURRENCY {why}"]
    # 🔴 AND A HEAD THIS READER CANNOT BELIEVE IS A REFUSAL, NOT AN EMPTY REQUIREMENT.
    # `range(233, head)` is empty for any head at or below the population's own floor, so
    # a `queue_head` that answered 0 would take the requirement to nothing and this
    # reader would report CLEAN over a tree it had learned nothing about — the exact
    # shape 281 wrote `UPSTREAM_DEFERRED` for (*unread is not green*), and the exact
    # thing `instrument_gate.py` blinds a reader to find. The blind is what asked for
    # this line: with the head reader emptied, every claim below stayed green.
    if head <= POPULATION_SHAPE_FROM:
        return [f"🔴 POPULATION_CURRENCY `QUEUE.md` reads head {head}, at or below the "
                f"oldest block this table is judged from ({POPULATION_SHAPE_FROM}). "
                f"Either the head is unreadable or this is not a tree of this project — "
                f"and an empty requirement derived from an unreadable number is a green "
                f"that has checked nothing"]
    need = [n for n in range(POPULATION_SHAPE_FROM, head)]
    # 🆕 289 — a session DECLARED to have shipped nothing owes no block; the declaration
    # is judged by `block_absent_problems`, which is where an undeclared hole stays a
    # refusal and a declared one stays somebody's typed sentence.
    absent = set(BLOCK_ABSENT)
    missing = [n for n in need if n not in have and n not in absent]
    if not missing:
        return []
    newest = max(missing)
    lead = (f"🔴 POPULATION_CURRENCY `QUEUE.md` says this tree is session {head}, so "
            f"session {newest} has SHIPPED and its status block is not in "
            f"`BLOCK_POPULATION`")
    if len(missing) > 1:
        lead += f" — nor are {len(missing) - 1} other(s): {missing[:-1]}"
    return [lead + (". 253's rule: the previous block goes in THIS session's FIRST PR, "
                    "before the replay. `previous_main` resolves by scanning backward "
                    "from a session, so until it is there the close measures `MOVED +N` "
                    "from the wrong endpoint and `git.moved` refuses — which is what 241, "
                    "282 and 283 each paid a second PR and a full re-replay to discover.")]


def population_block_shape() -> "list[str]":
    """Every block in `BLOCK_POPULATION`, judged by the rules a LIVE block is judged by.

    🔴 269 — AND THE FILE EVERY SESSION STANDS ON WAS THE ONE ARTIFACT NO GATE IN THE
    RITUAL EVER READ. This module has a close path — the roster of REQUIRED counters, the
    header floor, the rule that every atom must bind to a reader — and 268's own handoff
    fails five of those claims. It shipped anyway, and the next session stood on it.

    The mechanism is boring and total. `HANDOFF*.md` is in `.gitignore`, so no CI job can
    see the document. The replay script runs `handoff_gate.py --selftest` and
    `--patterns`, which prove the gate's PREDICATES on fixtures; neither of them is the
    gate pointed at the block being written. The close path is real and correct and is
    invoked, in practice, by the NEXT session at pickup — after the block has been
    published, acted on, and used as the base for a release.

    So 268's block dropped `ci.checks`, `instrument.not_loaded` and
    `instrument.late_constructed`; carried one header atom against a floor of two;
    invented `error-code discipline …` as a counter with no reader; and abbreviated its
    replay list to *267's plus one, in full, in the script*, which `REPLAY_MISSING`
    refuses in thirty-five places and 248 had already written down as a rule. 267's block,
    run through the same path on the same tree, has none of it.

    🔴 THE REPAIR IS THE POPULATION THAT WAS ALREADY HERE. 253's rule already requires the
    previous block to be copied into `BLOCK_POPULATION` BEFORE the replay — so every block
    enters the tree exactly one session after it ships, and from that moment CI can read
    it. This is the reader. A block that shipped non-conformant is caught by the session
    after it, by a machine, instead of by whoever next happens to run `--open` and read
    past a green summary.

    It cannot catch a block in the session that WROTE it — nothing in-tree can, while the
    document is gitignored — and that is stated rather than papered over: the guarantee is
    one session of lag, which is 253's rule turned from bookkeeping into a check. Running
    the close gate on your own handoff before you ship it is still the ritual's job, and
    §7.1 now says so.

    Judged here: every atom binds; every counter REQUIRED of that block's session is
    present; the header carries at least `HEADER_FLOOR` atoms. The replay list is NOT
    judged — a block records a replay that ran against the tree of its own session, and
    `ci.yml` has moved since, so re-reading it here would refuse old blocks for the
    workflow changing underneath them. That exclusion is a property of what the roster
    compares against, not a taste, which is why it is written down instead of rostered.

    🔴 AND THE START OF THE POPULATION IS MEASURED, NOT CHOSEN. Run over all forty-one
    blocks the first time, this reader returned forty-seven problems and every single one
    of them was a DROPPED COUNTER on blocks 227–232 — a roster that has grown since,
    against blocks that were correct about their own trees. Zero atom-binding failures and
    zero header shortfalls, across all forty-one. Blocks 233 through 267 are clean on
    every claim, thirty-five in a row. So the boundary is 233, the number the population
    itself names, and it is the same session the `SINCE` convention already turns on for
    exactly this reason. A boundary picked to make a gate green is an exemption; this one
    is where the evidence changes, and the six blocks below it are history rather than
    debt.
    """
    problems: "list[str]" = []
    for session, text in BLOCK_POPULATION:
        if session < POPULATION_SHAPE_FROM:
            continue
        block, why = status_block(text)
        if why:
            problems.append(f"block {session}: {why}")
            continue
        atoms, why = counter_atoms(block)
        if why:
            problems.append(f"block {session}: {why}")
            continue
        bound: "set[str]" = set()
        for atom in atoms:
            key, atom_why = bind(atom)
            if atom_why:
                problems.append(
                    f"block {session} claims {atom!r}, which binds to NO reader — a "
                    f"counter no instrument prints, shipped in the one document the "
                    f"next session stands on")
                continue
            bound.add(key)
        for key, _alias, _n, _cmd, _cwd, _ex, _cost, need, _why in COUNTER_READERS:
            if needed(need, session) == REQUIRED and key not in bound:
                problems.append(
                    f"block {session} dropped `{key}`, a counter REQUIRED of it — a "
                    f"status block quietly ceasing to report a field, which is the "
                    f"class this whole module exists to refuse")
        h_atoms, _exempt = header_atoms(block)
        if len(h_atoms) < HEADER_FLOOR:
            problems.append(
                f"block {session} carries {len(h_atoms)} header atom(s) against a floor "
                f"of {HEADER_FLOOR} — a parse that found fewer has stopped reading the "
                f"header rather than found a block without one")
    # 🔴 THE DEBT IS SUBTRACTED HERE AND CHECKED IN BOTH DIRECTIONS. A declared failure
    # that no longer happens is refused just as loudly as an undeclared one: the first
    # would mean a block in this tree had been edited to make a gate green, which is the
    # one repair this reader must never accept.
    kept: "list[str]" = []
    for p in problems:
        declared = [d for row in POPULATION_SHAPE_DEBT.values() for d in row
                    if p.startswith(d)]
        if not declared:
            kept.append(p)
    for session, row in sorted(POPULATION_SHAPE_DEBT.items()):
        for d in row:
            if not any(p.startswith(d) for p in problems):
                kept.append(
                    f"POPULATION_SHAPE_DEBT declares {d!r} and block {session} no longer "
                    f"fails it. Either the reader stopped looking, or a block that has "
                    f"already shipped was edited to make this gate green — the debt row "
                    f"is the record of what was published, not a target to drive to zero")
    return kept


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


# ══ 🆕 280 §3 — `release-1820-bump-under-wire` (278) ══════════════════════════════════
#
# 🔴 1.82.0 WAS A MAJOR CUT AS A MINOR, AND CHECK 8 WOULD HAVE SAID SO. Replayed at the
# real release commit — a worktree at `v1.82.0`, `npm ci`, `npm run build`, corpus and
# window both at `e35dc3e`, and NO `--head-ref` — `release_names.py` refuses it
# `C8_BENEATH`: `WIRE_VERDICT MAJOR`, `major 7 · minor 4 · patch 0`, on both surfaces.
# 278 named two things that could have excused that reading and both are false. The
# `--head-ref` audit was not involved, because this replay does not use it. And 276's
# toolchain arm was not involved either: at `v1.82.0`, `release_names.py` contains the
# string `toolchain` ZERO times and `wire_diff.mjs` never printed `WIRE_TOOLCHAIN`. The
# refusal is the SOURCE verdict, from the cut's own classifier, at the cut's own commit.
#
# The seven MAJORs are one change: `value` on seven tools went from `type: unknown` —
# unconstrained AND, because `z.any()` answers true to zod's `isOptional()`, published
# OUTSIDE `required` — to a required six-variant `anyOf`. A client that omitted it was
# obeying our published schema and is refused now. 279 tools -> 279; nothing added or
# removed. That is MAJOR, exactly, and the CHANGELOG says every word of it. Only the
# number does not.
#
# 🔴 AND THE REASON NOTHING CAUGHT IT IS THE ROW THIS READER CLOSES: session 270's replay
# list ran `release_names.py --selftest` and `--assert-addon`. The full
# `--version/--previous/--date/--bump` invocation — the one that runs checks 1, 2 and 8 —
# was never run at the cut. The check existed, would have refused, and nothing invoked it.
# `release-names-ritual-axis` (278) names eleven readers reachable only by the ritual; the
# ritual is whatever the person cutting remembers to type, and 279 remembered where 270
# did not. **A reading nothing binds to a commit is a reading somebody has to remember.**
#
# 🔵 SO THE BINDING IS THE SAME ONE `untagged-count-unbound` GOT ONE SECTION OVER, and
# deliberately so: the block states the verdict, the gate compares it, and the comparison
# is `release_names.wire_floor` ITSELF — imported, not restated (229 §5.2), so the gate's
# rule and the ritual's rule cannot drift into two opinions. What this reader adds is not
# a second classifier. It is the refusal that fires when a block cuts a release and says
# NOTHING about what the wire did, which is the state 270 shipped in and 271 inherited.
#
# 🔴 AND THE BUMP IS DERIVED FROM THE TWO VERSION STRINGS, NEVER TYPED. A block that
# could name its own bump could name the one that passes; the two `host / addon` rows are
# already there, already read by `version.unmoved`, and semver is not a matter of opinion.
RELEASE_VERDICT_FROM = 280
RELEASE_WIRE_RE = re.compile(r"\bwire (PATCH|MINOR|MAJOR)\b")
RELEASE_TOOLCHAIN_RE = re.compile(r"\btoolchain (PATCH|MINOR|MAJOR)\b")


def release_bump(previous: str, now: str) -> "tuple[str, str]":
    """(the bump these two version strings describe, problem) — PURE, no tree, no tags."""
    try:
        p = [int(x) for x in previous.split(".")]
        n = [int(x) for x in now.split(".")]
    except ValueError:
        return ("", f"{previous!r} -> {now!r} is not a pair of semver versions")
    if len(p) != 3 or len(n) != 3:
        return ("", f"{previous!r} -> {now!r} is not a pair of semver versions")
    if n < p:
        return ("", f"{previous} -> {now} goes BACKWARDS, which is not a bump")
    if n[0] != p[0]:
        return ("MAJOR", "")
    if n[1] != p[1]:
        return ("MINOR", "")
    return ("PATCH", "")


def release_verdict_problems(block: "list[str]", session: "int | None",
                             population: "list | None" = None
                             ) -> "tuple[list[str], list[str]]":
    """(problems, notes) — a block that CUT a release must say what the wire did.

    Silent on every block that cut nothing, which is most of them: the subject is the
    CUT and not the session. Silent as well on blocks older than `RELEASE_VERDICT_FROM`,
    because `BLOCK_POPULATION` carries every block since 227 and not one of them printed
    the pair — 279's own §7 records check 8's answer in PROSE, which is the shape this
    reader exists to stop being enough.
    """
    pop = BLOCK_POPULATION if population is None else population
    if session is None or session < RELEASE_VERDICT_FROM:
        return [], []
    (host, _addon), why = block_versions(block)
    if why:
        return [], []                       # `VERSION_PAIR_UNREAD` already refuses this
    earlier = [txt for s, txt in pop if s < session]
    if not earlier:
        return [], []
    prev_block, why = status_block(earlier[-1])
    if why:
        return [], []
    (prev_host, _prev_addon), why = block_versions(prev_block)
    if why:
        return [], []
    if host == prev_host:
        return [], [f"release verdict: host stayed at {host} — no cut in this session, "
                    f"so check 8 is owed nothing and this reader says so out loud rather "
                    f"than by being silent"]
    bump, why = release_bump(prev_host, host)
    if why:
        return [f"🔴 RELEASE_VERDICT — this block's `host / addon` row and the previous "
                f"one cannot be read as a bump: {why}"], []
    text = "\n".join(block)
    m_wire = RELEASE_WIRE_RE.search(text)
    m_tool = RELEASE_TOOLCHAIN_RE.search(text)
    if m_wire is None or m_tool is None:
        return [f"🔴 RELEASE_VERDICT_UNREAD — this block cuts {prev_host} -> {host}, "
                f"which is a {bump}, and carries no `wire <VERDICT>` / `toolchain "
                f"<VERDICT>` pair. That pair is `release_names.py --version {host} "
                f"--previous {prev_host} --date <the block's date> --bump {bump}`'s own "
                f"CHECK 8 line, and running it is the step 270 skipped when it cut "
                f"1.82.0 as a MINOR over a MAJOR wire. A cut whose block cannot say what "
                f"the public API did is a cut nobody sized."], []
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from release_names import wire_floor as _wire_floor, C8_OK   # noqa: E402
    code, why8, _d = _wire_floor(m_wire.group(1), bump, m_tool.group(1))
    if code != C8_OK:
        return [f"🔴 RELEASE_VERDICT [{code}] — {prev_host} -> {host} is a {bump} and "
                f"this block states wire {m_wire.group(1)}, toolchain "
                f"{m_tool.group(1)}. {why8}"], []
    return [], [f"release verdict: {prev_host} -> {host} is a {bump}; the block states "
                f"wire {m_wire.group(1)}, toolchain {m_tool.group(1)} — {why8}"]


# 🆕 272 — the `assetlib` row's own claim: WHICH ADDON VERSION THE ASSET LIBRARY SERVES.
# Dotted like the `host / addon` pair, and unread for the same mechanical reason until a
# reader was written for it — `COUNTER_RE` refuses a digit with a dot against it, so this
# was never an atom, never bound, and never compared (244 §3's finding, one row down).
ASSETLIB_ROW_RE = re.compile(r"^assetlib\b.*?\baddon (\d+\.\d+\.\d+) live\b")


def block_assetlib(block: "list[str]") -> "tuple[str, str]":
    """(the version a block's own `assetlib` row claims is live, problem).

    🔴 A BLOCK WITHOUT THE ROW IS NOT REFUSED, and the reason is the population rather
    than politeness: `BLOCK_POPULATION` carries every block since 227 and none of them has
    this row, so requiring it would refuse forty shipped documents for not anticipating
    272. What IS refused is the row being present and wrong, which is the defect 270
    actually hit — three handoffs carrying an inherited version the world had moved past.
    """
    for line in block:
        m = ASSETLIB_ROW_RE.match(" ".join(line.lstrip("> ").split()))
        if m:
            return (m.group(1), "")
    return ("", "no `assetlib` row in this block")


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


def origin_slug(root: Path = ROOT) -> "tuple[str, str]":
    """(`owner/repo` for origin, problem) — TREE. Both remote spellings, no network."""
    try:
        p = subprocess.run(("git", "remote", "get-url", "origin"), cwd=root,
                           capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError) as e:
        return ("", f"`git remote get-url origin` could not run: {e}")
    if p.returncode != 0:
        return ("", f"`git remote get-url origin` exited {p.returncode}: "
                    f"{(p.stderr or '').strip()[:120]}")
    url = p.stdout.strip()
    m = re.search(r"github\.com[:/]+([^/]+)/(.+?)(?:\.git)?/?$", url)
    if not m:
        return ("", f"origin {url!r} is not a github.com remote this reader can name")
    return (f"{m.group(1)}/{m.group(2)}", "")


def gh_rest_fetch(path: str, root: Path = ROOT) -> "tuple[object, str]":
    """(whatever the endpoint decoded to, problem) — the transport, with no shape rule.

    🆕 275 — SPLIT OUT OF `gh_rest`, WHICH ASSERTED `list` INSIDE THE TRANSPORT. That
    assertion is right for every route that COUNTS rows and wrong for `/actions/runs/<id>`,
    which answers with one object; a second copy of the request would have been fifteen
    duplicated lines whose token header could drift apart from this one's.
    """
    import urllib.error
    import urllib.request

    slug, prob = origin_slug(root)
    if prob:
        return (None, prob)
    req = urllib.request.Request(
        f"https://api.github.com/repos/{slug}/{path}",
        headers={"Accept": "application/vnd.github+json",
                 "User-Agent": "breakpoint-mcp-handoff-gate"})
    for var in ("GH_TOKEN", "GITHUB_TOKEN"):
        if os.environ.get(var):
            req.add_header("Authorization", f"Bearer {os.environ[var]}")
            break
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return (None, f"`GET /repos/{slug}/{path}` answered HTTP {e.code} — an endpoint "
                      f"that refused is not an endpoint that counted zero")
    except (urllib.error.URLError, OSError) as e:
        return (None, f"`GET /repos/{slug}/{path}` could not be reached: {e}")
    try:
        return (json.loads(body), "")
    except ValueError as e:
        return (None, f"`GET /repos/{slug}/{path}` did not return JSON: {e}")


def gh_rest_object(path: str, root: Path = ROOT) -> "tuple[dict, str]":
    """(the decoded JSON object, problem) — `gh_rest`'s shape rule, one type over.

    🆕 275 — A RUN IS NOT A LIST, and the array assertion above is not loosened to admit
    it: an endpoint that answers with the wrong shape is a finding on either side, and
    each reader says which shape its own question needs.
    """
    out, prob = gh_rest_fetch(path, root)
    if prob:
        return ({}, prob)
    if not isinstance(out, dict):
        return ({}, f"`GET /repos/…/{path}` returned {type(out).__name__}, not the object "
                    f"this reader reads a verdict off")
    return (out, "")


def gh_rest(path: str, root: Path = ROOT) -> "tuple[list, str]":
    """(the decoded JSON array, problem) — NETWORK, over plain HTTPS and no `gh`.

    🆕 271 — THE SECOND ROUTE, AND IT EXISTS BECAUSE THE FIRST ONE IS A THIRD-PARTY CLI.
    270's block claimed `1 open issues` in an environment with no `gh`, and the choice
    the row handed over was *force `gh` into every checking environment, or omit a count
    the maintainer wants to see*. This is the third answer: the counter is a public fact
    about a public repository, `api.github.com` serves it unauthenticated, and an
    environment that has a network but not a CLI can now answer for itself. A token is
    used when the environment offers one and never required — the rate limit on an
    anonymous read is sixty an hour and this reader makes two.

    🔴 STILL NOT A ZERO ON ANY FAILURE PATH. Every branch below returns a problem, for
    236 §4's reason: the counter whose correct value is almost always zero is the one an
    unreachable endpoint imitates perfectly.
    """
    out, prob = gh_rest_fetch(path, root)
    if prob:
        return ([], prob)
    if not isinstance(out, list):
        return ([], f"`GET /repos/…/{path}` returned {type(out).__name__}, not the "
                    f"array this reader counts")
    return (out, "")


def gh_open(kind: str, root: Path = ROOT) -> "tuple[int, str]":
    """(open issues or PRs on origin, problem) — NETWORK.

    🔴 AN ABSENT TOOL IS NOT A ZERO, AND THAT IS THIS SESSION'S OTHER FINDING (236 §4).
    235 §5 taught `lint_ceiling.py` that `pyflakes` missing and a clean tree are
    different observations; a reader that shelled out to `gh` and read the length of an
    empty parse would make exactly that mistake on the counter whose correct value is
    almost always 0. Every failure path here returns a problem, and a problem prints
    UNREAD rather than agreeing with the block.

    🆕 271 — AND A SECOND ROUTE UNDERNEATH IT, tried only when the first one could not
    run. `gh` stays FIRST because it carries the maintainer's own credentials and sees
    exactly what he sees; `gh_rest` is the fallback for an environment that has a socket
    and no CLI. The two reasons are joined into one when BOTH fail, because a caller told
    only *`gh` is not installed* would go and install it and still get nothing.
    """
    try:
        p = subprocess.run(("gh", kind, "list", "--state", "open", "--json", "number",
                            "-L", "200"), cwd=root, capture_output=True, text=True,
                           timeout=60)
    except FileNotFoundError:
        why = ("`gh` is not installed for this run — the tool never ran, which is "
               "not the same observation as zero open items")
        return gh_open_rest(kind, why, root)
    except (OSError, subprocess.SubprocessError) as e:
        return gh_open_rest(kind, f"`gh {kind} list` could not run: {e}", root)
    if p.returncode != 0:
        first = next((ln for ln in (p.stderr or p.stdout).split("\n") if ln.strip()), "")
        return gh_open_rest(kind, f"`gh {kind} list` exited {p.returncode}: "
                                  f"{first.strip()[:160]}", root)
    try:
        return (len(json.loads(p.stdout or "[]")), "")
    except ValueError as e:
        return (-1, f"`gh {kind} list --json` did not return JSON: {e}")


def gh_open_rest(kind: str, why_cli: str, root: Path = ROOT) -> "tuple[int, str]":
    """The `gh`-free half of `gh_open`, carrying the CLI's reason forward on failure.

    🔴 `/issues` IS BOTH POPULATIONS AND THAT IS THE ONE TRAP IN THIS ENDPOINT. GitHub's
    REST API answers `/issues` with issues AND pull requests — every PR is an issue in
    that store — so a reader that counted the array would report `gh issue list`'s number
    plus the open PRs. The discriminator is the `pull_request` key, which only the PR
    rows carry, and dropping them is what makes this the same population `gh` reports.
    """
    if kind == "issue":
        rows, prob = gh_rest("issues?state=open&per_page=100", root)
        rows = [r for r in rows if isinstance(r, dict) and "pull_request" not in r]
    else:
        rows, prob = gh_rest("pulls?state=open&per_page=100", root)
    if prob:
        return (-1, f"{why_cli}; and the API route did not answer either: {prob}")
    return (len(rows), "")


# ── 🆕 272 — `assetlib-claim-has-no-reader` (271): THE LAST WORLD-FACING CLAIM ─────────
#
# 🔴 THE ROW'S OWN SENTENCE: *the Asset Library's live version is a world-facing fact
# asserted in every handoff and read by nothing.* Measured at 270, the hard way — three
# consecutive handoffs carried "1.11.0 still in review" while the entry had been ACCEPTED
# and live since `2026-08-17 00:49:42`. Nobody was careless; the line was INHERITED, which
# is what a claim with no reader is for. 271 closed the `gh.*` half of exactly this class
# and left this one open because the refusal it built had no reader to sit under yet.
#
# 🔴 THE ASSET ID IS A CONSTANT AND NOT A LOOKUP. `godotengine.org/asset-library` has no
# route from a repo slug to an asset, so the number is written here once, beside the reader
# that uses it, rather than being derived from something that cannot derive it.
ASSETLIB_ASSET_ID = 5335
ASSETLIB_API = "https://godotengine.org/asset-library/api/asset"


def assetlib_live(asset_id: int = ASSETLIB_ASSET_ID) -> "tuple[str, str]":
    """(the addon version the Asset Library currently SERVES, problem) — NETWORK.

    🔴 UNREADABLE IS A REASON AND NEVER A VERSION, which is 271's rule arriving at the
    reader it was written for. The Cowork container cannot reach `godotengine.org` at all,
    so this is the second atom in the roster whose honest answer in one environment is
    UNREAD — and under 271 that means the block may not claim it there, not that the block
    may carry whatever the last session wrote.
    """
    import urllib.error
    import urllib.request

    url = f"{ASSETLIB_API}/{asset_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "breakpoint-mcp-handoff-gate"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return ("", f"`GET {url}` answered HTTP {e.code} — an endpoint that refused is not "
                    f"an endpoint that served a version")
    except (urllib.error.URLError, OSError) as e:
        return ("", f"`GET {url}` could not be reached: {e}")
    try:
        out = json.loads(body)
    except ValueError as e:
        return ("", f"`GET {url}` did not return JSON: {e}")
    if not isinstance(out, dict):
        return ("", f"`GET {url}` returned {type(out).__name__}, not the object this "
                    f"reader reads `version_string` off")
    got = str(out.get("version_string", "")).strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", got):
        return ("", f"`GET {url}` carries version_string={got!r}, which is not the "
                    f"three-part addon version this claim is about")
    return (got, "")


# The spellings `HEADER_READERS` extracts, kept beside the emitter that writes them so
# a rename cannot make one of them stale in silence — `--selftest` joins the pair below to
# the roster's own `extract` regex, which is the join `npm.lag` did not have for twelve
# sessions (241 §1).
GH_EMIT = (("gh.issues", "issue", "GH_OPEN_ISSUES"), ("gh.prs", "pr", "GH_OPEN_PRS"))

# ══ 🆕 277 §3 — `main-red-between-sessions-unread` (276): THE FOURTH READING ══════════
#
# 🔴 EVERY GATE IN THIS TREE READS THE TREE, AND NOTHING READS WHETHER `main` IS GREEN.
# 273 found `main` failing on its own twice, one of them for eighteen hours, and the only
# reason either was seen is that a pickup happened to ask a git question. 275 built the
# verdict reader and 276 wrote down what it still could not see: it fires at a CI-measured
# CLOSE, which is the one moment a session already knows its own run passed. The window
# nobody reads is BETWEEN sessions, and the moment to read it is PICKUP.
#
# 🔴 THE ATOM IS THE COMMIT AND NOT THE RUN. `gh_run_verdict` asks whether ONE run
# concluded; a branch has several workflows and a session inherits the whole commit, so
# the population is every run at `main`'s newest sha and the verdict is the worst of them.
# A reader keyed on one run id answers green for a commit whose integration workflow
# failed — 276's own finding about joins, one file over.
RUN_PENDING = "pending"


def wf_name(r: dict) -> str:
    return str(r.get("workflowName") or r.get("name") or "?")


def wf_sha(r: dict) -> str:
    return str(r.get("headSha") or r.get("head_sha") or "")


# 🆕 279 — 🔴 AND THE POPULATION AT ONE SHA IS AN ACCIDENT OF THE SCHEDULE.
#
# 277 wrote *the atom is the commit and not the run*, and it is — for the merge path,
# where every workflow is triggered by the push that made the commit. It is not true of a
# workflow triggered by `schedule:`. `sdk-drift.yml` runs on a cron; its run sits at
# whatever sha `main` happened to hold that morning, so it is inside `main`'s newest-sha
# population only in the window between that run and the next merge, and outside it
# afterwards — with nothing anywhere reporting the difference.
#
# 🔴 MEASURED, ON THE PICKUP THAT FOUND IT: `sdk-drift` failed on 2026-08-17 and again on
# 2026-08-24. Sessions 277 and 278 each read this line and each got a clean `success`,
# because on both of their pickups `main` had moved past the failing run — and both closed
# their blocks 🟢 *nothing owed* over a job that had been red for a week. 279 saw it only
# because `main` had not moved since Friday.
#
# So the reading is two readings. The COMMIT verdict is unchanged and still refuses: a run
# at the commit being inherited that did not pass is 277's finding and it stands. Beside
# it, the newest run of every OTHER workflow — at whatever sha it landed on — is reported
# by name. That half is a NOTE and never a refusal: it is a fact about a workflow's own
# subject and not about the health of the tree this session is picking up (271 §1's rule
# for every other world reading in this file).
def main_at_head_of(rows: "list[dict]") -> "tuple[str, str, list[str], str]":
    """(sha, conclusion, workflows that did not pass, problem) — PURE over the forge's
    answer, so both directions are drivable from a fixture and neither needs a network.

    🔴 A RUN STILL GOING IS NOT A GREEN AND IT IS NOT A RED EITHER. It is the third answer
    this reader has to be able to give, because a pickup minutes after a merge is exactly
    when it happens, and collapsing it into either of the other two is the reader lying
    about which way it does not know.
    """
    if not rows:
        return ("", "", [], "the forge lists no workflow run for `main` at all — either "
                            "this repository has never run one, or the query was refused")
    sha = wf_sha(rows[0])
    if not sha:
        return ("", "", [], "the newest run listed for `main` carries no head sha, so "
                            "there is no commit to attribute a verdict to")
    at = [r for r in rows if wf_sha(r) == sha]
    if any(str(r.get("status") or "") != "completed" for r in at):
        return (sha, RUN_PENDING, [], "")
    bad = sorted({wf_name(r) for r in at
                  if str(r.get("conclusion") or "") != RUN_GREEN})
    return (sha, RUN_GREEN if not bad else "failure", bad, "")


def elsewhere_red_of(rows: "list[dict]") -> "list[tuple[str, str]]":
    """[(workflow, sha)] — workflows whose NEWEST run on `main` did not pass and did not
    run at `main`'s newest sha. PURE, and `main_at_head_of`'s blind spot by construction.

    Ordered newest-first by the forge, so the first row per workflow is that workflow's
    newest run. A workflow already named by the commit verdict is not repeated here.
    """
    if not rows:
        return []
    head = wf_sha(rows[0])
    newest: "dict[str, dict]" = {}
    for r in rows:
        newest.setdefault(wf_name(r), r)
    out = []
    for name, r in newest.items():
        if wf_sha(r) == head:
            continue
        if str(r.get("status") or "") != "completed":
            continue
        if str(r.get("conclusion") or "") != RUN_GREEN:
            out.append((name, wf_sha(r)[:7]))
    return sorted(out)


def main_run_rows(root: Path = ROOT) -> "tuple[list, str]":
    """(the forge's rows for `main`, problem) — NETWORK, and dialled ONCE.

    🆕 279 — both readings are taken off one answer. Two functions that each dial for the
    same list would be two chances for the two readings to disagree about which world
    they are describing, which is the shape 275's `MEASURED_LEG_DISAGREEMENT` found.
    """
    try:
        p = subprocess.run(("gh", "run", "list", "--branch", "main", "--limit", "40",
                            "--json", "headSha,status,conclusion,workflowName"),
                           cwd=root, capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        return main_run_rows_rest("`gh` is not installed for this run", root)
    except (OSError, subprocess.SubprocessError) as e:
        return main_run_rows_rest(f"`gh run list` could not run: {e}", root)
    if p.returncode != 0:
        first = next((ln for ln in (p.stderr or p.stdout).split("\n") if ln.strip()), "")
        return main_run_rows_rest(f"`gh run list --branch main` exited {p.returncode}: "
                                  f"{first.strip()[:160]}", root)
    try:
        rows = json.loads(p.stdout or "[]")
    except ValueError as e:
        return ([], f"`gh run list --json` did not return JSON: {e}")
    return (rows if isinstance(rows, list) else [], "")


def main_run_rows_rest(why_cli: str, root: Path = ROOT) -> "tuple[list, str]":
    """The `gh`-free half, carrying the CLI's reason forward — `gh_open_rest`'s shape."""
    _slug, prob = origin_slug(root)
    if prob:
        return ([], f"{why_cli}; and the API route has no origin to ask: {prob}")
    out, prob = gh_rest_object("actions/runs?branch=main&per_page=40", root)
    if prob:
        return ([], f"{why_cli}; and the API route did not answer either: {prob}")
    return (list(out.get("workflow_runs") or []), "")


def main_at_head(root: Path = ROOT) -> "tuple[str, str, list[str], str]":
    """The same reading, dialled — NETWORK. `gh_run_verdict`'s shape, one branch wider."""
    rows, prob = main_run_rows(root)
    if prob:
        return ("", "", [], prob)
    return main_at_head_of(rows)


# 🔴 THE LINE A LATER `--open` BINDS TO. Same shape as the three above it: a numeral-free
# UNREAD line carries no claim, and this pattern is what refuses to match it.
#
# 🆕 279 — 🔴 AND IT DROPPED THE ONE THING THE REFUSAL NEEDED TO SAY. `--gh-open` has
# printed the failing workflow names since 277 (`MAIN_AT_HEAD e65ed07 failure —
# sdk-drift`) and this pattern captured the sha and the conclusion only, so through the
# measured-log route the refusal read *`main` is failure at e65ed07* and stopped there.
# 273's *a reader that cannot show its own refusal*, found in the first refusal this
# reader ever issued. The printed line is UNCHANGED — what was missing was a third group.
MAIN_AT_HEAD_RE = re.compile(r"^MAIN_AT_HEAD ([0-9a-f]{7,40}) (\w+)(?: — ([^\n]+))?", re.M)

# 🆕 279 — the second line, and the population `MAIN_AT_HEAD` cannot see by construction.
WORKFLOW_RED_ELSEWHERE_RE = re.compile(r"^WORKFLOW_RED_ELSEWHERE (\S+) ([0-9a-f]{7,40})",
                                       re.M)


def main_head_problems(log: str, run_network: bool, head: str = "",
                       read=main_at_head) -> "tuple[list[str], list[str]]":
    """(problems, notes) — is `main` green at the commit this session is picking up?

    🔴 TIER0'S PREMISE IS THAT THE TREE HERE IS THE TREE THE PREVIOUS BLOCK WAS VERIFIED
    AGAINST, and `tier_trigger` proves the IDENTITY of that tree and nothing about its
    health. A branch protected by twenty-six required checks can still be red, because the
    checks gate the MERGE and nothing re-reads them after it — 273's finding, written down
    for four sessions and wired to nothing. Inheriting a counter line from a commit whose
    own run failed is inheriting a green that is not there.

    🔴 AND UNREAD IS A NOTE, NEVER A REFUSAL. 271 §1's rule for the three readings beside
    this one holds identically: a pickup on a machine that cannot reach the forge must
    still be able to open, and refusing on connectivity would make the tier a statement
    about the network. What is refused is a verdict that WAS read and is not `success`.
    """
    elsewhere = [(w, s) for w, s in WORKFLOW_RED_ELSEWHERE_RE.findall(log or "")]

    def _with_elsewhere(problems: "list[str]", notes: "list[str]") -> "tuple[list, list]":
        # 🆕 279 — LOUD, NAMED, AND NEVER A REFUSAL. A workflow triggered by `schedule:`
        # sits at whatever sha `main` held that morning, so it leaves the commit
        # population the moment anything merges — which is how a red `sdk-drift` survived
        # two sessions unread. It is reported here because its subject is the world and
        # not the health of the tree being inherited (271 §1).
        for w, s in elsewhere:
            notes.append(f"🔴 WORKFLOW_RED_ELSEWHERE `{w}` did not pass at {s[:7]}, which "
                         f"is not `main`'s newest commit — so the verdict above cannot "
                         f"see it and never could. It is owed work, not a reason to "
                         f"refuse the tier")
        return (problems, notes)

    # 🆕 287 — 🔴 TWO READINGS THAT DISAGREE ABOUT WHAT WAS ASKED ARE NOT DRIFT.
    #
    # `MAIN_AT_HEAD` is matched with `re.search` over `read_measured`'s concatenation of
    # `sorted(rglob("*.log"))`, so the FIRST match wins and a `ci<N>/` that was APPENDED
    # to carries the pickup's reading above the close's. 285 appended, and its close
    # verified the block against `5233a71` — the commit before the merge, a tree the
    # block was not written about — and said so only in the DRIFT NOTE below, which is
    # deliberately not a refusal (286 §1.1).
    #
    # 🔴 THE DRIFT ARM IS RIGHT FOR WHAT IT COVERS AND THIS IS NOT IT. Drift is ONE
    # honest reading that is about another commit, and the note is correct because the
    # reading is. Two readings naming DIFFERENT commits are a reader that cannot say
    # which one the session meant, and taking the first is answering by file order.
    #
    # 🔴 AND TWO LINES NAMING THE SAME COMMIT MUST PASS, because that is `--gh-open` run
    # twice into one directory — a wasteful ritual, not a wrong one. The comparison is by
    # short-sha prefix for the same reason `drift` below is: the emitter prints seven
    # characters and the forge answers forty.
    named: "list[str]" = []
    for _sha, _concl, _bad in MAIN_AT_HEAD_RE.findall(log or ""):
        if not any(_sha.startswith(s[:7]) or s.startswith(_sha[:7]) for s in named):
            named.append(_sha)
    if len(named) > 1:
        return _with_elsewhere(
            [f"🔴 MAIN_AT_HEAD_AMBIGUOUS the measured log names {len(named)} different "
             f"commits — {', '.join(s[:7] for s in named)} — and this reader takes the "
             f"first, which is an answer chosen by file order rather than by the session. "
             f"REPLACE the four `--gh-open` readings at the close; never append them "
             f"(286 §7.2). Keep the pickup's set beside them under a name `*.log` cannot "
             f"see — `open.pickup.txt` is the spelling 286 used."], [])

    m = MAIN_AT_HEAD_RE.search(log or "")
    if m:
        sha, concl = m.group(1), m.group(2)
        bad = [b.strip() for b in (m.group(3) or "").split(",") if b.strip()]
    elif run_network:
        sha, concl, bad, prob = read()
        if prob:
            return _with_elsewhere([], [f"main at HEAD: UNREAD — {prob}"])
    else:
        return _with_elsewhere([], [
            "main at HEAD: UNREAD — no `MAIN_AT_HEAD` line in the measured log "
            "and no `--network`. Supply it from `handoff_gate.py --gh-open` on a "
            "machine that can reach the forge, or pass `--network`. Nothing in "
            "this tree can answer it: whether `main` passed is a fact about the "
            "forge"])
    if concl == RUN_PENDING:
        return _with_elsewhere([], [f"main at HEAD: {sha[:7]} — the run has not "
                                    f"concluded, so nothing here knows yet whether the "
                                    f"tree being inherited passed"])
    if concl != RUN_GREEN:
        return _with_elsewhere(
            [f"🔴 MAIN_RED_AT_HEAD `main` is {concl} at {sha[:7]}"
             + (f" ({', '.join(bad)})" if bad else "")
             + ". TIER0 inherits a counter line measured against this commit and the "
               "forge says this commit did not pass. Read the run before inheriting "
               "a green that is not there, or open at TIER1 and measure the tree."],
            [])
    drift = head and not (sha.startswith(head[:7]) or head.startswith(sha[:7]))
    return _with_elsewhere([], [f"main at HEAD: {sha[:7]} {concl}"
                                + (f" — 🔴 and this checkout is at {head}, so the verdict "
                                   f"above is about a different commit" if drift else "")])


def gh_emit(root: Path = ROOT) -> int:
    """`--gh-open`: put the two GitHub counters into a log a later `--measured` can read.

    🆕 271 §1 — AN EMITTER, NOT A GATE, AND IT EXITS 0 WHETHER OR NOT IT COULD READ.
    The roster has carried `^GH_OPEN_ISSUES (\\d+)$` as an `extract` since 236 and NOTHING
    IN THE TREE HAS EVER PRINTED THAT LINE: the only route to the counter was `--network`
    plus a `gh`, which is why 270 typed a number instead. A replay can now pay for the
    reading once, on whichever machine can make it, and every later reader of that log
    gets the same answer rather than dialing again.

    🔴 UNREAD IS PRINTED, NOT RAISED. An emitter that exited non-zero where the network is
    absent would turn `the replay's exit sum` — the one verdict this project reads — into
    a statement about connectivity. The unreadable case prints the reason with no numeral
    on the line, so the roster's `(\\d+)` finds nothing and the atom stays honestly UNREAD.
    """
    for _key, kind, label in GH_EMIT:
        n, prob = gh_open(kind, root)
        print(f"{label} {n}" if not prob else f"{label} UNREAD — {prob}")
    # 🆕 272 — the Asset Library rides in the same emitter, because it is the same errand:
    # a world-facing fact that only one machine in the loop can read, paid for once and
    # written into the log every later reader reads. Same rule as the two above — a line
    # with no version on it carries no claim and the atom stays honestly UNREAD.
    v, prob = assetlib_live()
    print(f"ASSETLIB_VERSION {v}" if not prob else f"ASSETLIB_VERSION UNREAD — {prob}")
    # 🆕 277 §3 — the fourth reading, and the only one of the four that is about THIS
    # repository rather than about a registry. Same rule again: the unreadable case prints
    # a reason and no sha, so `MAIN_AT_HEAD_RE` finds nothing and `--open` says nobody
    # looked rather than inheriting a green it never saw.
    rows, prob = main_run_rows(root)
    if prob:
        print(f"MAIN_AT_HEAD UNREAD — {prob}")
    else:
        sha, concl, bad, prob = main_at_head_of(rows)
        print(f"MAIN_AT_HEAD UNREAD — {prob}" if prob else
              f"MAIN_AT_HEAD {sha[:7]} {concl}" + (f" — {', '.join(bad)}" if bad else ""))
        # 🆕 279 — the second line, off the same answer. A workflow whose newest run did
        # not pass and did not land on `main`'s newest commit is invisible to the verdict
        # above BY CONSTRUCTION, and a `schedule:` workflow is in that position for all
        # but the window between its run and the next merge.
        for name, wsha in elsewhere_red_of(rows):
            print(f"WORKFLOW_RED_ELSEWHERE {name} {wsha}")
    return 0


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
    # 🆕 280 — `untagged-count-unbound` (279). THE OTHER DISTANCE, and the one that
    # actually says whether a release is owed. `lag` counts TAGS THE REGISTRY HAS NOT
    # GOT, so work that was never tagged is invisible to it in BOTH directions — 🟢
    # before a publish that shipped a tree four commits past its own tag and 🟢 after
    # (260). `registry_lag.py` has printed the second number beside the first since
    # 269 and the header read one of them. 🔴 THE ALIAS IS ONE WORD BOUNDARY FROM
    # `npm.tags`: `\btags?\b` does not match inside `untagged` and this row must not
    # match `tags 121`, which `HEADER_AMBIGUOUS` asserts on every atom of every block.
    ("npm.untagged", r"\buntagged\b", 1, r"^\s*untagged (\d+) ",
     "🆕 280 — `registry_lag.py`'s `untagged n`: commits on HEAD that the newest tag does "
     "not name. REMOTE, and the row had to answer WHY to be added at all — the "
     "denominator is ORIGIN's tag list, because a distance counted from a tag only one "
     "disk holds is 234 §4.8's class, and a distance counted from a tag this checkout "
     "does not hold is not a small number but no measurement. Read from the measured "
     "log first and derived from origin second, exactly as `npm.lag` is."),
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
# 🆕 269 — the first block `population_block_shape` judges. MEASURED and not chosen: run
# over all forty-one shipped blocks, that reader's only complaints were dropped counters
# on 227-232, against a roster that has grown since; 233 through 267 are clean on every
# claim, thirty-five consecutively. The number is where the evidence changes, and it is
# the same session `SINCE` already turns on. Governed by floor_pin_gate's SIZE_LEDGER.
POPULATION_SHAPE_FROM = 233

# 🔴 269 — THE DEBT, WHICH IS THE FINDING ITSELF IN A FORM A MACHINE READS.
#
# `population_block_shape` refuses a shipped block that fails a claim the close path
# already makes. Block 268 fails five of them, and it is in this tree because 253's rule
# copies every block here one session after it ships. That leaves two honest options and
# one dishonest one. The dishonest one is to CORRECT the block: it would make the gate
# green over a document that never existed, and the whole point of the population is that
# it is what actually shipped. The two honest ones are to refuse forever or to write the
# failure down. This is the second, and the row is the measurement:
#
#   • `ci.checks` — the block spelled `26/26 green` on its `main` row and no atom in it
#     reaches the derived CI counter, which 234 had to reconstruct by hand once already;
#   • `instrument.not_loaded` and `instrument.late_constructed` — carried by every block
#     since 233 and 246 respectively, and simply absent here;
#   • the header carried ONE atom against a floor of two, because the npm row lost `lag`
#     and `tags`.
#
# The fifth failure — `error-code discipline 54 reads / 29 raise sites / 0 problems`,
# a counter 268 wrote into its block and never gave a row — is NOT here, because it was
# ADMITTED rather than exempted: `contract.error_codes` is in `COUNTER_READERS` now, the
# atom binds, and the claim stops failing because the tree gained the reader 268 owed it.
# That is the difference this table is for. A missing reader is a gap in this file and
# gets closed; a counter a published block never printed is a fact about a document
# nobody may edit, and gets written down.
#
# 🔴 IT IS SELF-CLEARING, WHICH IS THE ONLY THING THAT KEEPS A ROSTER LIKE THIS HONEST. A
# row naming a claim the block now passes is itself a REFUSAL, so this table cannot rot
# into a general permission — it can only shrink, and it can only shrink by the block
# changing, which nobody should do. A second row here means a second session shipped a
# block nothing read, and that is a finding and not a maintenance task.
POPULATION_SHAPE_DEBT: "dict[int, tuple[str, ...]]" = {
    268: (
        "block 268 dropped `ci.checks`",
        "block 268 dropped `instrument.not_loaded`",
        "block 268 dropped `instrument.late_constructed`",
        "block 268 carries 1 header atom(s) against a floor of 2",
    ),
}


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

    # ── 🆕 271 §1 — `block-claims-a-count-its-own-read-could-not-make` (OPEN 270) ──────
    #
    # 🔴 AN ATOM WHOSE READER ANSWERED UNREAD MAY NOT BE CLAIMED, and the price of the
    # missing half is on the record. 269's block asserted `0 open issues` while a real
    # user's bug report had been open for five and a half hours, and this function said
    # exactly the right thing about it — *UNREAD, `gh` is not installed for this run,
    # which is not the same observation as zero open items* — in a NOTE, printed above an
    # accepted claim. A note is what a session reads as `nothing to see`. That is 236 §4's
    # finding arriving one layer up: `gh_open` was built so an absent tool could never be
    # mistaken for a zero, and then its caller mistook it for a zero anyway, because
    # nothing joined the reader's silence to the block's number.
    #
    # 🔴 WHAT IS REFUSED IS THE CLAIM, NOT THE ENVIRONMENT. Nothing here demands a socket,
    # a token or a `gh`: a checkout that cannot dial is expected, and 249's own block
    # already spells the honest alternative — ``gh UNREAD, no `gh` in this container`` —
    # which carries no numeral, binds no atom and asserts nothing. The refused third thing
    # is a number typed where a reading belongs. 270 §7 is the same class one document
    # over: `1.11.0 is in review` was carried through three handoffs by sessions that
    # never re-read it, and the library had already accepted it.
    def unread(key: str, raw: str, claimed: "tuple[int, ...]", why_unread: str) -> None:
        notes.append(f"{key}: UNREAD — {why_unread}")
        problems.append(
            f"🔴 HEADER_UNREAD_CLAIMED {key} — the block claims {list(claimed)} and "
            f"nothing in this run could read it: {why_unread}\n"
            f"     atom: {raw!r}\n"
            f"     An atom whose reader answered UNREAD may not be CLAIMED. Either give "
            f"this run the reading — `--network`, or a `--measured` log carrying the "
            f"instrument's own line — or write the counter as UNREAD with the reason and "
            f"make no claim, which is what 249's block did and what this gate has always "
            f"accepted.")

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
                unread(key, raw, claimed, prob)
                continue
            got = (n_moved,)
        elif key == "version.unmoved":
            n_ver, prob = version_interval(session)
            if prob:
                unread("version.unmoved", raw, claimed, prob)
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
                    unread(key, raw, claimed, prob)
                    continue
                got = (n_open,)
        elif key == "npm.tags":
            # 🔴 NETWORK, AND UNREAD IS NOT GREEN. The clone's count is reported beside
            # it because the difference IS the finding, but it is never the comparison.
            if run_network:
                n_remote, only_here, prob = origin_tags()
                if prob:
                    unread("npm.tags", raw, claimed, f"origin unreachable — {prob}")
                    continue
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
                    unread("npm.lag", raw, claimed, prob)
                    continue
                got = (d,)
                notes.append(note)
        elif key == "npm.untagged":
            # 🆕 280 — THE SAME TWO ROUTES AS `npm.lag`, IN THE SAME ORDER AND FOR THE
            # SAME TWO REASONS: a `--measured` run has already paid for
            # `registry_lag.py` and re-deriving would be a second answer to an answered
            # question; `--open` has no log at all, which is precisely the branch 241 §1
            # found missing on this row's sibling after twelve sessions.
            if extract and log and (m := re.search(extract, log, re.M)) is not None:
                got = tuple(int(g) for g in m.groups())
            elif run_network:
                d, note, prob = npm_untagged()
                if prob:
                    unread("npm.untagged", raw, claimed, prob)
                    continue
                got = (d,)
                notes.append(note)
        elif extract and log and (m := re.search(extract, log, re.M)) is not None:
            got = tuple(int(g) for g in m.groups())
        if got is None:
            if key == "npm.lag":
                why_unread = ("pass --network to dial the registry, or supply a `distance "
                              "<n>` line from `registry_lag.py` in the measured log. Lag "
                              "is a fact about the WORLD: nothing in this tree can answer "
                              "it, and inheriting one across an --open is inheriting a "
                              "number that may have changed while nobody looked")
            elif key == "npm.untagged":
                why_unread = ("pass --network to derive it from ORIGIN's tags, or "
                              "supply an `untagged <n>` line from `registry_lag.py` "
                              "in the measured log. It is a fact about the WORLD in "
                              "the same sense lag is — the denominator is what origin "
                              "holds — and a count taken from this checkout's own tag "
                              "list is a fact about the disk, which is the reading "
                              "234 §4.8 measured wrong by six")
            elif key == "npm.tags":
                why_unread = (f"pass --network, or supply `ORIGIN_TAGS <n>` in the "
                              f"measured log. This checkout reads {clone_tags()} and that "
                              f"is a fact about the checkout, not the claim on the npm "
                              f"line")
            elif key in ("gh.issues", "gh.prs"):
                why_unread = (f"pass --network to ask `gh` or the REST API, or supply "
                              f"`{'GH_OPEN_ISSUES' if key == 'gh.issues' else 'GH_OPEN_PRS'}"
                              f" <n>` from `handoff_gate.py --gh-open` in the measured "
                              f"log. Nothing in the tree answers it")
            else:
                why_unread = "no --measured log carries it"
            unread(key, raw, claimed, why_unread)
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

    # ── 🆕 272 §3 — `assetlib-claim-has-no-reader` (271) — THE LAST INHERITED FACT ──────
    #
    # 🔴 THE CLAIM IS ABOUT THE WORLD, SO THE TREE CANNOT ANSWER IT AND NEITHER CAN THE
    # PREVIOUS BLOCK. That is the whole row: 270 found three consecutive handoffs saying
    # the Asset Library still had 1.11.0 in review while it had been live for two days,
    # because the sentence was copied forward and no reader ever disagreed with it.
    #
    # 🔴 AND IT OBEYS 271's RULE, WHICH IS WHY IT IS SAFE TO ADD AT ALL. The container this
    # session runs in cannot reach `godotengine.org`; a reader that treated unreachable as
    # agreement would be the exact defect 271 spent a session removing, one endpoint over.
    # No log line and no `--network` means UNREAD with the reason, no comparison, and — by
    # the same rule — no claim standing beside it.
    claimed_al, why_al = block_assetlib(block)
    if why_al:
        notes.append(f"assetlib.live: {why_al} — nothing claimed, nothing to compare")
    else:
        got_al, why_read = "", ""
        if log and (m := re.search(r"^ASSETLIB_VERSION (\d+\.\d+\.\d+)$", log, re.M)):
            got_al = m.group(1)
        elif run_network:
            got_al, why_read = assetlib_live()
        else:
            why_read = ("pass --network to dial the Asset Library, or supply "
                        "`ASSETLIB_VERSION <x.y.z>` from `handoff_gate.py --gh-open` in "
                        "the measured log. Nothing in this tree answers it — the live "
                        "entry is a fact about godotengine.org")
        if why_read or not got_al:
            # 🔴 SPELLED OUT HERE RATHER THAN THROUGH `unread`, because that helper renders
            # the claim as a list of integers and this one is a version string — a message
            # reading "the block claims []" about a row that plainly claims 1.11.0 would be
            # 271's own defect wearing 271's own fix.
            why_read = why_read or "no reading"
            notes.append(f"assetlib.live: UNREAD — {why_read}")
            problems.append(
                f"🔴 HEADER_UNREAD_CLAIMED assetlib.live — the block claims the Asset "
                f"Library serves addon {claimed_al} and nothing in this run could read "
                f"it: {why_read}\n"
                f"     atom: 'addon {claimed_al} live'\n"
                f"     An atom whose reader answered UNREAD may not be CLAIMED (271 §1). "
                f"Either give this run the reading, or drop the `assetlib` row and make "
                f"no claim.")
        else:
            compared += 1
            if got_al != claimed_al:
                problems.append(
                    f"🔴 assetlib.live — the block says the Asset Library serves addon "
                    f"{claimed_al}, it serves {got_al}\n"
                    f"     atom: 'addon {claimed_al} live'\n"
                    f"     A world-facing claim nobody re-reads is the class 270 paid for: "
                    f"three handoffs carried an inherited\n"
                    f"     'still in review' while the entry had been accepted. Re-read "
                    f"`{ASSETLIB_API}/{ASSETLIB_ASSET_ID}`.")

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
# 🆕 279 — 🔴 `assetlib_sweep.py`'s BASENAME ROW IS GONE, AND ITS OWN REASON IS WHY.
# The row said *`sdk-drift.yml` only*, and that WAS true: the file had no offline command at
# all, so its only reader was a weekly `schedule:` job — which is how `--check` stayed red
# from 2026-08-17 to 2026-08-24 with two sessions closing 🟢 *nothing owed* over it.
# `--selftest` shipped at 279 and runs merge-blocking in `ci.yml`, so the basename is covered
# and only the NETWORK flag is not, which moves the exemption one table down —
# `spec_conformance.py --refresh`'s exact shape, and `replay-ci-flag-granularity` (242)
# stating its case for a second file.
#
# 🔴 AND NOTHING WOULD HAVE CAUGHT THE ROW GOING FALSE. `REPLAY_CI_EXEMPT_STALE` asks
# whether ANY workflow still runs the basename, and one still does; it cannot ask whether
# the row's stated reason — *`sdk-drift.yml` only* — is still true. An exemption whose
# reason has expired reads exactly like one whose reason holds. 174 §5's staleness class
# has a fourth shape, and this is 279's own finding one table over: a claim with no reader
# is not wrong, it is unfalsifiable.
REPLAY_CI_EXEMPT: "dict[str, str]" = {
    "gate.sh":
        "a shell helper inside `integration.yml`'s own steps; it has no existence outside "
        "that workflow, which is exempt above.",
}
# 🔴 274 — `rb.sh` WAS THE SIXTH ROW AND IT EXCUSED A FILE THAT HAS NEVER EXISTED. Its
# reason read *"same shape as `gate.sh` — an `integration.yml` step helper"*, which is a
# true sentence about `gate.sh` (a heredoc written to `/tmp` at integration.yml:1064) and
# a sentence about nothing at all in the other case: the "script" came from the strings
# `OPS_UNIT_PASS rb.shot.mime` and `OPS_UNIT_SKIP rb.shot.capture`, sliced by an
# unanchored suffix pattern. So an exemption was carried for eight sessions, its prose
# was plausible, `REPLAY_CI_EXEMPT_STALE` could not see it — the roster DID report the
# name, which is exactly the condition that row tests for — and the only thing that ever
# found it was anchoring the pattern for an unrelated reason. 233 §18's staleness class
# has a third shape: an exemption that was never about a real thing, kept alive by the
# same defect that invented it.
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
# 🆕 274 — `(?![A-Za-z0-9_])` IS A DEFECT FIX AND IT WAS FOUND BY A LINE THAT HAS
# NOTHING TO DO WITH SCRIPTS. The suffix was unanchored, so the extension could land in
# the MIDDLE of a token: `${{ github.sha }}` — the expression every provenance step in
# `ci.yml` now writes — yields the "script" `github.sh`, and `REPLAY_MISSING` demanded
# the replay run it. The roster has been admitting non-scripts since 242 and nothing
# noticed for one reason, which is that no workflow line had ever carried a token whose
# tail happened to spell one. A population defined by a pattern is a derived population
# like any other, and this one was WIDER than the thing it stands for.
CI_SCRIPT_RE = re.compile(r"([A-Za-z0-9_.-]+\.(?:py|mjs|sh))(?![A-Za-z0-9_])")
CI_SCRIPT_FLOOR = 55   # governed by floor_pin_gate's SIZE_LEDGER


# ── 🆕 274 — `replay-ci-flag-granularity` (OPEN 242): THE SAME TWO ROSTERS, WITH FLAGS ─
#
# 🔴 242 NAMED SEVEN VARIANTS AND THE LIVE ANSWER IS THREE, WHICH IS WHY THE ROW WAS
# WORTH MEASURING RATHER THAN IMPLEMENTING FROM ITS OWN DESCRIPTION. The row reads *CI
# runs seven flag variants the replay does not (`--patterns`, `--assert-addon`,
# `--assert-map`, three `--selftest`, `--refresh`)*. Measured at 274 against `ci.yml` and
# 273's fence, five of those seven have since joined the replay and one — `--refresh` —
# no longer exists in any workflow. What is left is three real divergences, and they are
# not the same defect as each other:
#
#   `release_names.py --assert-map`      CI runs it, the replay does not
#   `spec_conformance.py --selftest`     CI runs it, the replay runs only `--check`
#   `registry_lag.py` (bare)             the replay runs it, CI runs only `--selftest`
#
# The first two are 241's defect exactly, one resolution finer: a session can perform its
# whole ritual and be refused on push by a FLAG it never passed. Both are cheap and both
# are now in the fence. The third is the row's OTHER direction and it is not a defect —
# the bare command dials the npm registry to answer `npm.lag`, which is a fact about the
# WORLD and not about the tree. A workflow asserting it would redden every unrelated pull
# request the day somebody else publishes. That is what the exemption below says, and
# saying it is the whole difference between a check nobody runs and a check nobody needs.
#
# 🔴 THE FLOOR IS BORROWED RATHER THAN INVENTED, AND THE REASON IS AN INVARIANT. Every
# basename in `ci_scripts()` comes from at least one command line, so the flag-granular
# population can never be smaller than the basename one — `CI_SCRIPT_FLOOR` therefore
# floors both, and a second constant would be a second thing to keep in step for no
# second guarantee.
REPLAY_CI_FLAG_EXEMPT: "dict[str, str]" = {
    "python3 registry_lag.py":
        "the bare command DIALS THE NPM REGISTRY to answer `npm.lag`, a fact about the "
        "world rather than about this tree. CI runs `--selftest`, which proves the "
        "ceiling can still refuse, and deliberately not this — a workflow asserting a "
        "registry distance reddens every unrelated pull request the moment somebody "
        "publishes, which is a check that trains people to ignore it. The handoff header "
        "is where that reading belongs and `HEADER_UNREAD_CLAIMED` is what makes it "
        "honest there (271 §1).",
    "python3 assetlib_sweep.py --check":
        "🆕 279 — `sdk-drift.yml` only, and that workflow is `schedule:` and "
        "`workflow_dispatch:` — no `push`, no `pull_request`, so it never blocks a merge "
        "and is not part of the ritual a session performs before cutting one. Its "
        "population is godotengine.org and, since 279, the forge each roster entry names, "
        "so it cannot run on a container that reaches neither. 🔴 AND THAT IS THE WHOLE "
        "COST OF THIS ROW: a reader whose only trigger is a weekly cron is unread for up "
        "to a week BY CONSTRUCTION, which is what 279's pickup found it had been. The "
        "offline half is in the replay and merge-blocking in `ci.yml`.",
    "python3 assetlib_sweep.py --emit":
        "🆕 292 — 291 §5.7's OPTION (a), TAKEN. The emitter dials godotengine.org, "
        "registry.npmjs.org and registry.modelcontextprotocol.io, and the Cowork container "
        "the replay runs in gets HTTP 403 from its egress proxy for all three. So a replay "
        "line for this command can only ever record `DISCOVERY_CHANNEL <name> unread` three "
        "times over — a statement about the MACHINE and not about the landscape (235 §6.3) "
        "— and a week later nothing distinguishes it from three channels that genuinely "
        "went quiet. 🔴 THE ALTERNATIVE WAS SHIPPED FIRST AND IT IS THE WEAKER ONE: 291 put "
        "the command in its own §7 fence, on the argument that `--emit` always exits 0 and "
        "exercises every line of the emitter except the socket, and it did so only because "
        "the desktop app disconnected mid-close and a merged repair would have moved `main` "
        "off the commit its block was measured at. That is a reason about a session, not "
        "about the command. `--selftest` and `--census` are both in the replay AND "
        "merge-blocking in `ci.yml`, and `sdk-drift.yml` runs `--emit` BEFORE `--check` so "
        "the readings survive the refusal — which is where a world-facing reading belongs "
        "and where this one already is.",
    "python3 registry_lag.py --upstream":
        "🆕 279 — `sdk-drift.yml` only, same trigger and the same argument. It asks whether "
        "the registry serves a MAJOR newer than the one `host/package.json` pins, which is "
        "a fact about upstream and not about this tree; the replay runs "
        "`python3 registry_lag.py` bare, which carries the same reading beside the two "
        "ceilings that ARE about this tree. Running the whole command in that workflow "
        "would redden the early warning every time a release is owed, which is the check "
        "that trains people to ignore it — the argument the row above makes about `ci.yml`.",
    "python3 spec_conformance.py --refresh":
        "`sdk-drift.yml` only, and that workflow is `schedule:` and `workflow_dispatch:` "
        "— no `push`, no `pull_request`, so it never blocks a merge and is not part of "
        "the ritual a session performs before cutting one. Same argument as "
        "`assetlib_sweep.py`'s row one table up; it needs its own entry here because "
        "`spec_conformance.py` DOES run merge-blocking in `ci.yml`, so the basename is "
        "covered and only this FLAG is not — which is `replay-ci-flag-granularity` (242) "
        "stating its own case.",
}


def command_norm(seg: str) -> str:
    """One shell segment reduced to the command it runs: comments, redirections, pipes
    and the path each token was spelled with, all dropped. `python3 ../scripts/x.py` and
    `python3 scripts/x.py` are one command run from two working directories."""
    seg = re.sub(r"(?<!\S)#.*$", "", seg).split("2>&1")[0].split("|")[0]
    seg = re.sub(r"[<>]+\s*\S+", " ", seg)
    return " ".join(t.rsplit("/", 1)[-1] for t in seg.split())


# ══ 🆕 278 §3 — `sweep-evidence-depth-sensitive` (277 §1.4) ═══════════════════════════
#
# 🔴 277's FINDING WAS THAT A GREEN IS ONLY EVER GREEN ON A MACHINE, and it left the
# question open: *on which of the two machines is this evidence, and does the other one
# know?* This is that question turned into a claim, over the one axis 277 measured — the
# depth of the git object store the evidence was taken against.
#
# 🔴 PRICED FIRST, AS 277 NEXT 3 INSTRUCTED, AND THE PRICE CHANGED THE ANSWER. A
# `--depth 1` clone of this repository costs **0.39 s**, so "a second sweep against a
# shallow clone" — which that row called the expensive option — is affordable, and the
# cheap option it recommended is not the only one available. What the shallow clone then
# showed is sharper than the row predicted, and it is why this roster is keyed on the
# COMMAND rather than on the reader:
#
#   `release_names.py --assert-addon` is GREEN on both machines AND ANSWERS A DIFFERENT
#   QUESTION ON EACH. On the container's full clone it reports the addon stamped at
#   `e35dc3e7`; on a `--depth 1` clone of the same commit it reports HEAD, with *0 file(s)
#   moved since over 0 commit(s)* — vacuously true, because a store holding one commit has
#   nothing to move across. Both exit 0. Both print a 🟢.
#
# 🔴 SO THE HAZARD IS NOT "READS GIT", IT IS "ANSWERS INSTEAD OF REFUSING". 277's seven
# object-store rows in `instrument_gate.py` are the safe kind: on a shallow store their
# readers return a documented refusal — *a fact about the clone and not about the claim* —
# which is 271's rule doing its job. A reader that instead produces a confident, cheerful,
# WRONG answer is invisible to every one of them.
#
# 🔵 AND CI IS ALREADY RIGHT ABOUT THIS, WHICH IS THE POINT. `contract-check` carries
# `fetch-depth: 0` and a comment naming check 4 as the reason. That invariant lives in a
# YAML file with nothing joining it to the reader that needs it: change the 0, or move the
# step to any other job, and the check goes green-and-vacuous with no gate anywhere saying
# so. Every other job in all three workflows is shallow. A comment is not a claim.
# ══ 🆕 280 §4 — `gate-input-requirements-untabled` (279) ══════════════════════════════
#
# 🔴 278 ASKED WHAT A GATE NEEDS IN ORDER TO BE EVIDENCE AND ANSWERED IT IN ONE COLUMN.
# The row 279 opened names the rest — *a full object store, a network, a compiled
# `dist/`, a staged addon, a live engine* — and the reason they were never a table is
# not that nobody knew them. Every one of them is already WRITTEN DOWN, in prose, in the
# file it is about:
#
#   • `wire_invisible_gate.mjs` line 50: *"(needs dist/ — run `npm run build`)"*
#   • `ci.yml`, above the `--assert-map` step: the tarball *"whose `addon` root does not
#     exist on a fresh clone until `stage-addon`"*
#   • `integration.yml`, above `vcs-plane`: *"The one plane that needs NO Godot"*
#   • `sdk-drift.yml`: the two live halves that must not be merge-blocking (279 §4)
#
# Four true statements, each in the one file that would never be read by anyone checking
# a different file. **A comment is not a claim** — 278's own sentence about `fetch-depth`,
# and it was true of four more columns while it was being written.
#
# 🔴 AND EVERY COLUMN HAS A DERIVED PROVIDER, WHICH IS THE PART 279's FINDING DEMANDS.
# A requirements table whose SUPPLY side is typed is a roster that agrees with itself and
# can never be short: that is *a population nobody derived*, and 279 found four of them by
# tripping over them. `job_provides` reads all five off the JOB's own text, so moving a
# step between jobs, dropping a build, or giving a schedule-only workflow a `push:`
# trigger changes the answer without anybody editing a row here.
INPUT_OBJECTS, INPUT_DIST, INPUT_ADDON, INPUT_ENGINE, INPUT_NETWORK = (
    "objects", "dist", "addon", "engine", "network")

# {input: (what the command needs, how a JOB is READ as supplying it)}. The second half
# is the predicate `job_provides` implements, written where the requirement is stated so
# that a row and its provider cannot drift into two different questions.
INPUT_PROVIDERS: "dict[str, tuple[str, str]]" = {
    INPUT_OBJECTS: ("the whole git object store",
                    "`actions/checkout` carrying `fetch-depth: 0`"),
    INPUT_DIST: ("a compiled `host/dist`",
                 "a step in the same job running `npm run build`"),
    INPUT_ADDON: ("the canonical addon staged into `host/addon`",
                  "a step in the same job running `npm run stage-addon`"),
    INPUT_ENGINE: ("a real Godot binary",
                   "a step exporting `GODOT_BIN` into `$GITHUB_ENV`"),
    INPUT_NETWORK: ("a socket to somewhere outside the runner",
                    "a workflow with NO `push`/`pull_request` trigger. 🔴 THE COLUMN IS "
                    "NOT *does the runner have a network* — every runner does. It is "
                    "*may this reading fail a merge*: a command whose subject is the "
                    "WORLD turns an npm outage or a forge's bad afternoon into a red "
                    "pull request, which is why both live halves sit in `sdk-drift.yml` "
                    "and only their offline halves are merge-blocking (279 §4)"),
}

# {normalised command: {input: why THIS command needs it}}. Seven rows, four columns, and
# every reason is a measurement or a quotation from the file the command lives in.
GATE_INPUTS: "dict[str, dict[str, str]]" = {
    "python3 queue_gate.py": {
        INPUT_OBJECTS:
            "🆕 281 — `QUEUE_PATHS_JOIN` compares a closing row's declared `paths` "
            "against the files this session actually changed, and the base of that diff "
            "is `merge-base(origin/main, HEAD)`. A `--depth 1` checkout has no merge "
            "base and no `origin/main` to find one against, so `session_diff` returns "
            "None and the reader prints `QUEUE_PATHS_UNREAD` — a refusal rather than a "
            "silence, which is the only reason this row can be an honest requirement "
            "instead of a shallow-clone trap. The job that runs it is `contract-check`, "
            "which has carried `fetch-depth: 0` since 220 for check 4 one row up. "
            "🔵 `--selftest` is a DIFFERENT command and is not in this table: every one "
            "of its `paths_join` rows is handed a diff, so it needs no history at all."},
    "python3 release_names.py --assert-addon": {
        INPUT_OBJECTS:
            "check 4 walks history for the commit that STAMPED the addon's version and "
            "then asks what has moved since. Measured at 278 on both machines at the "
            "same commit: a full clone answers `stamped e35dc3e73a8c`, a `--depth 1` "
            "clone answers `stamped 0be54af515af` — HEAD, the only object it has — with "
            "`0 file(s) moved over 0 commit(s)`. Both exit 0. The shallow answer is not "
            "a refusal, it is a different claim wearing the same green."},
    "python3 release_names.py --assert-map": {
        INPUT_ADDON:
            "check 3 asserts the packed tarball's roots BOTH WAYS against "
            "`SHIPPED_SOURCE`, and `ci.yml`'s own comment above the step already says "
            "what this row is: the tarball *whose `addon` root does not exist on a fresh "
            "clone until `stage-addon`*. Without the staged copy the assertion is made "
            "over a tarball missing one of the roots it exists to assert about — and it "
            "PASSES, because both directions agree about a root neither of them can see."},
    "node wire_invisible_gate.mjs": {
        INPUT_DIST:
            "it records the shipped surface by importing `host/dist`, and its own line 50 "
            "says so in the imperative: *(needs dist/ — run `npm run build`)*. 231 §2 "
            "wrote it to read what check 8 cannot see. On a tree with no build it prints "
            "`WIRE_INVISIBLE_UNREACHABLE`, which is the honest half — this row exists so "
            "that a job which quietly stopped building is caught by a gate rather than by "
            "whoever next reads the count and believes it."},
    "node set-property-verify.integration.mjs": {
        INPUT_ENGINE:
            "1.82.0's own live probe, driving all three write families against a real "
            "engine on every supported Godot. Its subject is what the ENGINE stores — "
            "`set_ignored` when a write does not land, `set_mismatch` when the type is "
            "incompatible, `coerced`/`requested` when a setter clamps — and not one of "
            "those questions has an answer without a binary to ask. `integration.yml` "
            "names the negative control itself: `vcs-plane` is *the one plane that needs "
            "NO Godot*, and it is the job this predicate must not accept."},
    "python3 registry_lag.py --upstream": {
        INPUT_NETWORK:
            "it dials the registry for every package published from the same repository "
            "as the dependency `host/package.json` actually pins (279 §2) — the reading "
            "`sdk-v2-migration` waited fifty-three sessions for. It refuses today, on "
            "purpose, and a refusal about the world must not be able to block a merge."},
    "python3 assetlib_sweep.py --check": {
        INPUT_NETWORK:
            "the sweep's live half asks godotengine.org for each tracked card and each "
            "tracked forge for its head (279 §3). Its OFFLINE half — `--selftest` — is "
            "the one that became merge-blocking at 279, and 279 §9 records what it cost "
            "to get the two halves' rosters straight. This row is what keeps them from "
            "swapping places."},
}

_BUILD_RE = re.compile(r"npm run build")
_STAGE_ADDON_RE = re.compile(r"npm run stage-addon")
# 🔴 THE ENGINE PREDICATE IS THE EXPORT AND NOT THE WORD. `integration.yml` mentions
# Godot in a dozen comments and in the `vcs-plane` comment that says it needs none; the
# observable that distinguishes a job which HAS a binary is the install step writing
# `GODOT_BIN=…` into `$GITHUB_ENV`, which is how every probe below it finds the engine.
_GODOT_BIN_RE = re.compile(r"(?m)^.*GODOT_BIN=.*GITHUB_ENV.*$")

_JOB_RE = re.compile(r"(?m)^  ([A-Za-z0-9_-]+):[ \t]*$")
_CHECKOUT_RE = re.compile(r"uses:\s*actions/checkout")
_FETCH_DEPTH_RE = re.compile(r"fetch-depth:\s*(\S+)")


def workflow_jobs(text: str) -> "list[tuple[str, str]]":
    """(job name, job body) for every real job in ONE workflow's text.

    🔴 `runs-on:` IS THE DISCRIMINATOR AND NOT THE INDENT. `on:`'s own keys sit at the same
    two-space depth as a job's, so a walk keyed on indentation alone reports `push` and
    `pull_request` as jobs — and then reports them as jobs with no checkout, which is the
    quiet direction. Pure over text so a fixture can drive both.
    """
    hits = list(_JOB_RE.finditer(text))
    out: "list[tuple[str, str]]" = []
    for i, m in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(text)
        body = text[m.start():end]
        if "runs-on:" in body:
            out.append((m.group(1), body))
    return out


def job_depth(body: str) -> "str | None":
    """`"0"` full history, `"1"` the shallow default, `None` when the job checks out nothing.

    🔴 THE DEFAULT IS THE WHOLE POINT. `actions/checkout` with no `fetch-depth:` fetches
    ONE commit, so the absence of a line is a decision — and it is the decision this reader
    exists to see. Returning `None` for it would collapse *shallow* into *no checkout at
    all*, which is the two-states-one-observable shape this project keeps paying for.
    """
    if not _CHECKOUT_RE.search(body):
        return None
    m = _FETCH_DEPTH_RE.search(body)
    return m.group(1) if m else "1"


def workflow_merge_blocking(text: str) -> bool:
    """Does THIS workflow report a check run on a pull request? Pure over its text.

    🔴 THE SAME PREDICATE `ci_check_runs` USES, LIFTED SO TWO READERS CANNOT DISAGREE
    ABOUT WHICH WORKFLOWS ARE MERGE-BLOCKING. That function reads the trigger block to
    decide whether a workflow's jobs are in the `26/26 green` population; this one reads
    it to decide whether a job may be handed a command whose answer is about the world.
    Two copies of one question is how `sdk-drift.yml` would end up in one population and
    not the other, with nothing anywhere saying so.
    """
    head = text.split("\njobs:", 1)[0]
    return re.search(r"^\s*(pull_request|push)\s*:", head, re.M) is not None


def job_provides(body: str, merge_blocking: bool) -> "set[str]":
    """Which of `INPUT_PROVIDERS`' five inputs THIS job supplies. Pure over the job text.

    🔴 DERIVED, ONE PREDICATE PER MEMBER, AND THAT IS THE WHOLE POINT OF THE TABLE ABOVE.
    276's rule is that a column with no stated predicate cannot be wrong; 279 measured
    the sharper version four times in one session — a population nobody derived cannot
    report that it is short. A requirements roster whose supply side was typed beside its
    demand side would be two halves of one opinion. Every branch below reads the job's own
    text, so the answer changes when the workflow changes and not when somebody remembers.
    """
    have: "set[str]" = set()
    if job_depth(body) == "0":
        have.add(INPUT_OBJECTS)
    if _BUILD_RE.search(body):
        have.add(INPUT_DIST)
    if _STAGE_ADDON_RE.search(body):
        have.add(INPUT_ADDON)
    if _GODOT_BIN_RE.search(body):
        have.add(INPUT_ENGINE)
    if not merge_blocking:
        have.add(INPUT_NETWORK)
    return have


def provider_coverage(required: "dict[str, dict[str, str]]") -> "list[str]":
    """Which `INPUT_PROVIDERS` columns no row in the LIVE roster needs.

    🆕 280 — SEPARATE FROM `input_problems` BECAUSE IT IS A QUESTION ABOUT THE WHOLE
    TABLE AND NOT ABOUT A ROSTER. The first draft asked it inside that function, and
    every per-column fixture below — each of which passes a deliberately one-row
    roster — came back with four complaints about columns it was not testing. A pure
    reader handed a subset must answer about the subset; the coverage question has a
    population of exactly one table, and it is this one. Caught by the fixtures on
    the run that added them, which is what a per-member claim is for (276).

    A column with no member is a predicate nothing exercises — the shape 276 named
    and 279 measured four times in one session.
    """
    named = {i for need in required.values() for i in need}
    return [f"`INPUT_PROVIDERS` defines `{inp}` and no GATE_INPUTS row needs it — a "
            f"column with no member is a predicate nothing exercises"
            for inp in sorted(set(INPUT_PROVIDERS) - named)]


def input_problems(files: "dict[str, str]",
                   required: "dict[str, dict[str, str]]") -> "tuple[list[str], list[str]]":
    """(problems, rows) — every GATE_INPUTS command against what its job actually supplies.

    Both directions, because a roster rots both ways: a command that needs an input running
    in a job that does not supply it is the defect, and a roster naming a command no
    workflow runs is an exemption outliving its subject (174 §5).

    🆕 280 — AND A THIRD, WHICH THE ONE-COLUMN VERSION COULD NOT HAVE: an input named by
    a row and by no provider is a requirement nothing can ever satisfy. The fourth —
    a provider no row needs — is `provider_coverage` above, because it is a question
    about the whole table rather than about the roster this call was handed.
    """
    problems: "list[str]" = []
    rows: "list[str]" = []
    for key, need in sorted(required.items()):
        for inp in sorted(need):
            if inp not in INPUT_PROVIDERS:
                problems.append(
                    f"GATE_INPUTS row `{key}` needs `{inp}`, which `INPUT_PROVIDERS` does "
                    f"not define — a requirement with no way to be satisfied is not a "
                    f"stricter check, it is a row nothing can read")
    seen: "dict[str, list[tuple[str, str, str]]]" = {k: [] for k in required}
    # 🔴 THE COMMANDS COME FROM `ci_commands_text`, RUN PER JOB, AND NOT FROM A SECOND
    # WALK. The first draft re-implemented the line scan here and the fixture refused it
    # within a minute: a `run:` step's text is `- run: python3 …`, so `command_norm` over
    # the raw line kept the `- run:` and matched nothing. That walk already handles the
    # block form, the one-line form, chained segments and comments — a second copy of it
    # is 203 §2's ONE LIST rule broken in a reader written to enforce joins.
    for wf, text in sorted(files.items()):
        mb = workflow_merge_blocking(text)
        for job, body in workflow_jobs(text):
            have = job_provides(body, mb)
            for key in ci_commands_text({f"{wf}:{job}": body}):
                if key in required:
                    seen[key].append((wf, job, have))
    for key, need in sorted(required.items()):
        if not seen[key]:
            problems.append(
                f"GATE_INPUTS names `{key}`, which no workflow job runs. An exemption "
                f"outliving its subject is a claim nobody re-argued (174 §5) — either the "
                f"step moved and this row should follow it, or the command is gone and so "
                f"should the row be")
            continue
        for wf, job, have in seen[key]:
            rows.append(f"GATE_INPUTS {key} · {wf}:{job} · needs "
                        f"{'+'.join(sorted(need))} · supplies "
                        f"{'+'.join(sorted(have)) or 'nothing'}")
            # 🔴 AN INPUT THIS TABLE CANNOT DEFINE HAS ALREADY BEEN REPORTED ABOVE
            # AND IS NOT REPORTED TWICE HERE. The first draft looked it up anyway and
            # the undefined-input fixture raised `KeyError` on the run that added it:
            # a reader that refuses a roster and then CRASHES on the same roster has
            # told the caller nothing it can act on. Caught by the claim, in the
            # session that wrote both — the cheap direction.
            for inp in sorted(set(need) - have):
                if inp not in INPUT_PROVIDERS:
                    continue
                what, how = INPUT_PROVIDERS[inp]
                problems.append(
                    f"`{key}` runs in {wf}:{job}, which does not supply `{inp}` — {what}, "
                    f"read as {how}. {need[inp]} A missing input does not make this step "
                    f"FAIL, it makes it ANSWER, greenly, about something that is not there")
    return problems, rows


def ci_commands_text(files: "dict[str, str]") -> "dict[str, set]":
    """{normalised command: {workflow file names running it}} over workflow TEXT.

    🆕 275 — LIFTED OUT OF `ci_commands` SO A FIXTURE CAN DRIVE IT, which is the same
    reason `judgeScope` and `pending_problems` are functions: this walk's every branch is
    healthy on the shipped tree, so a rule it stops applying deletes invisibly.

    🔴 A COMMENT IS NOT A COMMAND, AND THE SIBLING READER ALREADY KNEW THAT.
    `replay_commands` has tested `seg.split("#")[0]` since it was written; this walk did
    not, and the two are compared against each other — so a `#` line INSIDE a `run: |`
    block naming any `.py`, `.mjs` or `.sh` became a CI command the replay could never
    run. Measured at 275 on this session's own close: a comment in the new workflow-lint
    step mentioning `lint_ceiling.py` normalised to the EMPTY STRING, and
    `REPLAY_FLAG_MISSING` demanded the replay run `` — a refusal with nothing in it, about
    a command that does not exist. 274 §3's class one turn further: the roster admitted
    something that is not a script, and this time it was not even a name.
    """
    out: "dict[str, set]" = {}

    def take(line: str, name: str) -> None:
        for seg in CHAINED_RE.split(line):
            seg = seg.split("#")[0]
            if CI_SCRIPT_RE.search(seg):
                out.setdefault(command_norm(seg), set()).add(name)

    for name, body in sorted(files.items()):
        lines = body.split("\n")
        i = 0
        while i < len(lines):
            ln = lines[i]
            if CI_RUN_BLOCK.match(ln) is not None:
                indent = len(ln) - len(ln.lstrip())
                i += 1
                while i < len(lines) and (not lines[i].strip()
                                          or len(lines[i]) - len(lines[i].lstrip()) > indent):
                    take(lines[i], name)
                    i += 1
                continue
            if (m := CI_RUN_ONE.match(ln)) is not None:
                take(m.group(1), name)
            i += 1
    return out


def ci_commands(root: Path = ROOT) -> "dict[str, set]":
    """`ci_commands_text` over the tree's own workflow files — `ci_scripts()`'s walk, kept
    at FLAG granularity instead of collapsed to basenames."""
    wf_dir = root / ".github" / "workflows"
    if not wf_dir.is_dir():
        return {}
    return ci_commands_text({f.name: f.read_text(encoding="utf-8")
                             for f in sorted(wf_dir.glob("*.y*ml"))})


# 🆕 287 — WHAT THE DEPENDENT READERS SAY INSTEAD OF REFUSING. Each of the three compares
# a roster it derives FROM the fence against one it derives from the workflow files, so
# with no fence every one of them would report the whole of CI missing from the replay.
# 286 §1 is the arithmetic: one omission, 122 problems, and the thirteen real ones under
# them. The note is loud, names the reader that stayed silent, and points at the one
# refusal that is about the actual defect.
NO_FENCE_NOTE = ("{reader}: NOT COMPARED — this document has no replay fence, so both "
                 "rosters would be compared against nothing. `REPLAY_FENCE_MISSING` is "
                 "the refusal; this reader stays silent rather than restating it (287)")


def replay_fence(text: str) -> "tuple[str, bool]":
    """(the fence's body, whether the document HAS one) — 🆕 287.

    🔴 A HANDOFF WITH NO REPLAY FENCE IS ONE WHOSE FENCE IS THE WHOLE DOCUMENT. Three
    readers each opened `blocks[-1] if blocks else text`, and that fallback defeats the
    guard the population exists to be. `replay_problems`'s own docstring states the rule
    it walks around — *prose about a command is not the command* — and then hands the
    entire document to the loop the moment no fenced block carries an invocation. 285
    shipped §8.6, WHAT WAS MEASURED AND ON WHICH MACHINE, which is a better artifact for
    a person and invisible to this reader, in place of §8.7; its close read 135 problems
    and 122 of them were prose lines graded as commands (286 §1.2).

    🔴 THE REFUSAL IS ONE AND IT IS `replay_problems`'S. The readers below answer the
    EMPTY SET rather than the document, so a missing fence costs ONE refusal naming what
    is missing instead of fifty derived from a body that was never a replay — the same
    arithmetic 286 §1 measured, one omission and 122 problems. A reader that cannot show
    its own refusal (273) has the shape where the true one is buried in what it caused.

    🔴 AND THE FALLBACK MAY NOT SIMPLY BE DELETED. A gate that went quiet on a document
    with no fence would accept `§8.6 instead of §8.7` in silence, which is the state 285
    shipped. What replaces it has to REFUSE and name what belongs in the block, or the
    next session satisfies the reader with a fence containing one line.
    """
    blocks = [b for b in fenced(text) if REPLAY_MEASURED_RE.search(b)]
    return (blocks[-1], True) if blocks else ("", False)


def replay_commands(text: str) -> "set":
    """Every command the replay fence invokes, with its flags."""
    body, has_fence = replay_fence(text)
    if not has_fence:
        return set()
    out = set()
    for ln in body.split("\n"):
        # the reader's own `--measured` invocation is the thing being run, not a gate the
        # run performs — the same exclusion the routing loop makes, for the same reason.
        if REPLAY_MEASURED_RE.search(ln):
            continue
        for seg in CHAINED_RE.split(ln):
            if CI_SCRIPT_RE.search(seg.split("#")[0]):
                out.add(command_norm(seg))
    return out


def replay_ci_flag_problems(text: str, ci: "dict[str, set]",
                            exempt: "dict[str, str] | None" = None,
                            floor: "int | None" = None
                            ) -> "tuple[list[str], list[str]]":
    """(problems, notes) — the same two rosters as `replay_ci_problems`, with flags."""
    problems: "list[str]" = []
    notes: "list[str]" = []
    if not replay_fence(text)[1]:
        return (problems, [NO_FENCE_NOTE.format(reader="replay/ci flags")])
    exempt = REPLAY_CI_FLAG_EXEMPT if exempt is None else exempt
    floor = CI_SCRIPT_FLOOR if floor is None else floor
    if len(ci) < floor:
        problems.append(
            f"🔴 REPLAY_CI_FLAG_FLOOR this reader found {len(ci)} command(s) across the "
            f"workflow files, floor {floor} — either the workflows lost steps or "
            f"`CI_RUN_ONE`/`CI_RUN_BLOCK`/`CI_SCRIPT_RE` stopped matching, and a "
            f"comparison against a collapsed roster reports perfect agreement. The floor "
            f"is borrowed from the basename walk because this population is a REFINEMENT "
            f"of that one and cannot be smaller than it; which of the two causes this is "
            f"can be told apart by running `ci_scripts()` beside it, and this count "
            f"alone cannot.")
        return problems, notes
    rep = replay_commands(text)
    exempt_wf = set(INTEGRATION_WORKFLOW_EXEMPT)
    bare_exempt = set(REPLAY_CI_EXEMPT)
    for cmd, wfs in sorted(ci.items()):
        if cmd in rep or cmd in exempt or wfs <= exempt_wf:
            continue
        if any(b in cmd for b in bare_exempt):
            continue
        problems.append(
            f"🔴 REPLAY_FLAG_MISSING `{cmd}` runs in {sorted(wfs)} and the replay runs no "
            f"command spelled that way. 241's defect one resolution finer: the basename "
            f"comparison is satisfied by any invocation of the same file, so a session "
            f"can run `x.py` its whole ritual and be refused on push by `x.py --flag` it "
            f"never passed. Add it to the replay, or declare it in "
            f"REPLAY_CI_FLAG_EXEMPT with the reason it is CI-only.")
    for cmd in sorted(rep):
        if cmd in ci or cmd in exempt:
            continue
        if any(b in cmd for b in bare_exempt):
            continue
        problems.append(
            f"🔴 CI_FLAG_MISSING `{cmd}` is in the replay and no workflow runs a command "
            f"spelled that way. A check that runs only where the handoff is written is a "
            f"check that stops running the first time somebody skips a step — and at "
            f"this resolution that includes a flag CI passes differently.")
    stale = sorted(c for c in exempt if c not in rep and c not in ci)
    for c in stale:
        problems.append(
            f"🔴 REPLAY_CI_FLAG_EXEMPT_STALE `{c}` is declared and neither roster runs it "
            f"— an exemption that outlived the thing it exempts (174 §5).")
    notes.append(f"replay/ci flags: {len(rep)} command(s) in the replay · {len(ci)} "
                 f"across the workflows · {len(exempt)} declared CI-only or local-only")
    return problems, notes


def replay_scripts(text: str) -> "set":
    """Every script the replay fence invokes, by basename. Comments stripped first —
    241's own list carries `# 🆕 241` and `# -> 724/724` on command lines."""
    body, has_fence = replay_fence(text)
    if not has_fence:
        return set()
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
    if not replay_fence(text)[1]:
        return (problems, [NO_FENCE_NOTE.format(reader="replay/ci")])
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
    if not replay_fence(text)[1]:
        return (problems, [NO_FENCE_NOTE.format(reader="unreached")])
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


def replay_problems(text: str, ci_measured: bool = False
                    ) -> "tuple[list[str], list[str]]":
    """(problems, notes) for the handoff's own replay block.

    🆕 274 — `ci_measured` MOVES ONE QUESTION AND LEAVES THE REST. When the log came from
    a CI artifact, *does the fence run this instrument and route its output* is being
    asked of the wrong procedure: the commands ran in a workflow and the fence is two
    lines of `gh run download`. That arm is answered by `ci_capture_problems()` against
    the workflow files instead — at FLAG granularity, which is stricter than this loop
    has ever been. Everything else here still applies, because everything else here is
    about the DOCUMENT: the order rules, the `contract_check.py`-after-`git add` rule,
    and the requirement that the document print the invocation at all.

    🔴 THE POPULATION IS THE FENCE, NOT THE DOCUMENT, AND THE FIRST DRAFT GOT IT WRONG IN
    THE WAY THIS FILE KEEPS GETTING THINGS WRONG. Scanning every line made a handoff that
    QUOTES the previous session's broken replay — which is what a handoff reporting this
    defect does — read as a document that RUNS it, and 236's own §1 reddened §9's correct
    replay by citing the line it was correcting. Prose about a command is not the command.
    """
    problems: "list[str]" = []
    notes: "list[str]" = []
    # 🆕 287 — `replay_fence()` REPLACES `blocks[-1] if blocks else text`, and the three
    # arms below are the three states that fallback collapsed into one. A document whose
    # only `--measured` invocation is PROSE is not a document with a fence; it is the
    # state 285 shipped, and it is refused here rather than read as a fence the size of
    # the file.
    body, has_fence = replay_fence(text)
    if not has_fence:
        if REPLAY_MEASURED_RE.search(text):
            problems.append(
                "🔴 REPLAY_FENCE_MISSING this document names a `handoff_gate.py "
                "--measured` invocation and every one of them is PROSE — no fenced block "
                "carries one, so there is no replay for this reader to grade and the "
                "counters below came from a procedure the document does not print. §8.7 "
                "is the block that carries it: the commands as run, IN ORDER, each "
                "routed into the log the last line reads back. 285 wrote §8.6 instead — "
                "the same facts addressed to a person — and a reader cannot run a "
                "paragraph (286 §7.1). A fence containing one line satisfies nothing "
                "either: what is owed is the replay, not a block that parses.")
        elif "handoff_gate.py" in text:
            notes.append("replay: the document runs `handoff_gate.py` with no "
                         "`--measured`, so every MUTATING counter it claims is UNREAD")
        else:
            notes.append("replay: this document prints no `handoff_gate.py` invocation — "
                         "a handoff nobody runs the gate against is unchecked, and the "
                         "next session cannot tell which it is")
        return (problems, notes)
    text = body
    hits = REPLAY_MEASURED_RE.findall(text)
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
        if ci_measured:
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
    # 🆕 274 — AND THE RULES BELOW ARE LEFT RUNNING RATHER THAN SWITCHED OFF. They all
    # anchor on a line that WRITES `{base}`, and a fence that downloads an artifact
    # writes nothing, so each of them finds nothing by measurement instead of by
    # exemption — which is the difference between a rule that does not apply and a rule
    # somebody decided not to ask.
    if ci_measured:
        notes.append(
            f"replay: `{log}` is a CI artifact, so the routing question is asked of the "
            f"workflow files rather than of this fence — `ci_capture_problems()`, at "
            f"flag granularity, which is stricter than the fence loop has ever been")
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


# ── 🆕 274 — `replay-measured-nowhere-but-locally`: THE MEASUREMENT MOVES TO THE MERGE ──
#
# 🔴 THE ROW'S FINDING IS THAT THE LOCAL REPLAY VERIFIES NOTHING CI HAD NOT ALREADY
# VERIFIED. 272 §6.1 derived the replay list from `ci_scripts()` and recorded it as a
# strict SUBSET; 273 §5.3 timed it — 54 commands, 863 s — and asked what the fourteen
# minutes buy. The answer measured there was two things, and neither of them is
# verification: a captured log `--measured` can read, and pre-push feedback. Every
# command in the list, INCLUDING the mutating three, already runs merge-blocking on
# every push.
#
# 🔴 AND IT MEASURES THE WRONG TREE, WHICH IS THE HALF THAT MATTERS. The local run
# happens on a pre-merge branch; the commit that ships is the merge commit, and it is a
# tree no local replay has ever been run against. 244's rule — *the measured log goes
# stale the moment any tracked file changes* — is an mtime-shaped stand-in for a question
# that has an exact answer: WHICH COMMIT WAS THIS LOG PRODUCED AT? CI knows. It has
# always known. It threw the answer away with the output.
#
# So the log gets a provenance line, the workflow uploads it, and this reader binds it to
# the SHA the status block claims. The staleness rule does not get worked around; it
# dissolves, because a log that describes a different commit is now refused by name
# instead of being suspected by timestamp.
#
# 🔴 THE READER TAKES A DIRECTORY BECAUSE `gh run download` PRODUCES ONE. Four artifacts
# come back from a green run — one per matrix leg of `test`, one from `contract-check` —
# and the counters are spread across them. Concatenating is the whole of the merge; what
# is NOT free is the agreement between them, which is why `MEASURED_LEG_DISAGREEMENT`
# exists two functions down.
CI_MEASURED_RE = re.compile(
    r"^CI_MEASURED\s+sha=(?P<sha>[0-9a-f]{7,40})\s+run=(?P<run>\d+)\s+"
    r"attempt=(?P<attempt>\d+)\s+job=(?P<job>\S+)\s+workflow=(?P<workflow>\S+)\s*$", re.M)

# 🔴 A FLOOR ON THE MERGE, AND IT IS NOT DECORATION. `gh run download` against a run
# whose artifacts expired, or against the wrong run, succeeds and leaves an empty
# directory; concatenating nothing produces a log that carries no counter, and every
# counter then reports UNMEASURED — a refusal with a true message naming the wrong cause.
# The reader says which it was.
CI_PART_FLOOR = 1


def read_measured(target: Path) -> "tuple[str, list[tuple[str, str]] | None]":
    """(concatenated text, [(name, text)] or None for a plain file).

    🔴 A FILE STAYS A FILE. The local replay's `run273.log` is one path with one text and
    no provenance, and every session before this one produced exactly that; a reader that
    demanded a directory would have made the new route the only route on the day it
    landed.

    🔴 AND `None` IS NOT `[]`, WHICH THE FIRST DRAFT COLLAPSED AND ITS OWN FIXTURE CAUGHT
    ON THE FIRST RUN. Returning an empty list for a directory holding no `*.log` made an
    EMPTY DOWNLOAD indistinguishable from a local file — so `MEASURED_EMPTY`, the refusal
    written for exactly that case, was unreachable, and a `gh run download` against an
    expired run would have been reported as an unattributed local log with all
    thirty-four counters UNMEASURED. A true refusal naming the wrong cause is 235 §5's
    class and this reader's own subject.
    """
    if target.is_dir():
        parts = []
        for f in sorted(target.rglob("*.log")):
            parts.append((str(f.relative_to(target)), f.read_text(encoding="utf-8")))
        return ("\n".join(t for _n, t in parts), parts)
    return (target.read_text(encoding="utf-8"), None)


# 🔴 THE POPULATION AN UNATTRIBUTED PART IS JUDGED AGAINST IS THE ONE `measure()` WOULD
# ACTUALLY READ OUT OF IT, and the first draft used "every row in COUNTER_READERS", which
# is wider. `ci.checks` is computed from the workflow files by `ci_check_runs()` and is
# special-cased above the log search; it carries `cmd = None` and an EMPTY extract, and an
# empty pattern matches every string ever written — so the fixture for a legitimate local
# part was refused for supplying a counter no log has ever supplied. A derived population
# that is wider than the thing it stands for is 246's class, and it took one fixture.
def log_readable(cmd, extract) -> bool:
    """Whether `measure()` would read this row's counter out of a measured log."""
    return cmd is not None and bool(extract)


def ci_provenance(text: str, parts: "list[tuple[str, str]] | None", target: str
                  ) -> "tuple[list[str], list[str], str]":
    """(problems, notes, sha) — what commit this measured log was produced at.

    🔴 THE THREE REFUSALS ARE THREE DIFFERENT LIES A LOG CAN TELL and only the first is
    obvious. A part with NO provenance line inside a download directory is a stray file
    contributing numbers nobody can attribute. Parts disagreeing on `sha` is two commits
    merged into one claim. Parts agreeing on `sha` and disagreeing on `run` is the same
    commit measured on two occasions — which is not wrong about the tree and IS wrong
    about the evidence, because a session that re-ran one leg after a fix and downloaded
    both would be quoting a number the other three legs never saw.
    """
    problems: "list[str]" = []
    notes: "list[str]" = []
    if parts is None:
        m = CI_MEASURED_RE.search(text)
        if m is None:
            notes.append(
                f"measured: `{target}` carries no `CI_MEASURED` line, so it is a LOCAL "
                f"replay log and 244's staleness rule is the only thing standing behind "
                f"it — this run cannot tell which commit it was produced at")
            return (problems, notes, "")
        notes.append(f"measured: one file, CI-produced at {m.group('sha')[:7]}")
        return (problems, notes, m.group("sha"))

    if len(parts) < CI_PART_FLOOR:
        problems.append(
            f"🔴 MEASURED_EMPTY `{target}` is a directory holding {len(parts)} `*.log` "
            f"file(s), floor {CI_PART_FLOOR}. Every counter below would report UNMEASURED "
            f"with a message about a pattern that did not match, and the real cause is "
            f"that there is nothing to match against: the download produced no artifact. "
            f"Check the run id, and that the run's artifacts have not expired.")
        return (problems, notes, "")

    # 🔴 AN UNATTRIBUTED PART IS NOT AUTOMATICALLY A STRAY, AND THE FIRST DRAFT SAID IT
    # WAS. Two readings a CI artifact structurally cannot carry have to travel with it:
    # the three world-facing lines from `--gh-open`, which are facts about a registry and
    # a forge rather than about the tree, and the `HANDOFF_OPEN … TIER0 … INHERITED FROM`
    # line, which is produced at PICKUP on the session's own machine and is what
    # `TIER_UNSUPPORTED` demands. Both are local by nature; neither is a counter.
    #
    # So the rule is not about the file's name — a convention this reader would then have
    # to police — but about what the file SUPPLIES. An unattributed part may sit in the
    # download directory and may carry the world and the tier. The moment one of them
    # answers a COUNTER, it is a number nothing can attribute to a commit, and that is
    # the defect the whole provenance line exists to make impossible.
    seen: "dict[str, tuple[str, str]]" = {}
    for name, body in parts:
        m = CI_MEASURED_RE.search(body)
        if m is None:
            supplies = sorted(
                key for key, _a, _n, c, _w, extract, _co, _nd, _wh in COUNTER_READERS
                if log_readable(c, extract) and re.search(extract, body, re.M | re.S))
            if supplies:
                problems.append(
                    f"🔴 MEASURED_UNATTRIBUTED `{name}` is in `{target}`, carries no "
                    f"`CI_MEASURED sha=… run=…` line, and answers {len(supplies)} "
                    f"counter(s): {', '.join(supplies)}. Those numbers would be read as "
                    f"this commit's and nothing here can say which commit, run or "
                    f"machine produced them. A local file may travel with the download "
                    f"to carry the world-facing readings and the TIER0 open line — it "
                    f"may not answer a counter.")
            else:
                notes.append(f"measured: `{name}` is unattributed and answers no counter "
                             f"— carried for the world readings and the tier line")
            continue
        seen[name] = (m.group("sha"), m.group("run"))
    if not seen:
        return (problems, notes, "")
    shas = {s for s, _r in seen.values()}
    runs = {r for _s, r in seen.values()}
    if len(shas) > 1:
        detail = ", ".join(f"{n}={s[:7]}" for n, (s, _r) in sorted(seen.items()))
        problems.append(
            f"🔴 MEASURED_MIXED_SHA the parts of `{target}` were produced at "
            f"{len(shas)} different commits: {detail}. Concatenating them makes one log "
            f"claiming to describe one tree, and it describes none of them.")
        return (problems, notes, "")
    if len(runs) > 1:
        detail = ", ".join(f"{n}=run {r}" for n, (_s, r) in sorted(seen.items()))
        problems.append(
            f"🔴 MEASURED_MIXED_RUN the parts of `{target}` agree on the commit and come "
            f"from {len(runs)} different runs: {detail}. Same tree, different occasions — "
            f"which is what a partial re-run produces, and a block quoting it would carry "
            f"numbers no single run ever printed together.")
        return (problems, notes, "")
    sha = shas.pop()
    notes.append(f"measured: {len(seen)} CI artifact(s) — {', '.join(sorted(seen))} — all "
                 f"from run {runs.pop()} at {sha[:7]}")
    return (problems, notes, sha)


def leg_disagreements(parts: "list[tuple[str, str]]", keys: "set[str]") -> "list[str]":
    """Counters two CI artifacts read differently on the same commit.

    🔴 THIS IS THE READER 273 §6 ARGUED FOR WITHOUT NAMING IT. The whole case for
    inheriting counters at TIER0 rests on *a counter that is a fact about the MACHINE
    rather than the tree shows up as a disagreement on a tree whose source did not move* —
    and until now nothing in this repository ever measured the same counter twice on the
    same commit, so that sentence was a promise rather than a check. The `test` job runs
    on three Node versions. Thirty counters are read on all three. Any of them that
    differs is a green that is true of one disk, and it is a FINDING rather than a
    tie-break to be resolved by picking one.
    """
    problems: "list[str]" = []
    for key, _alias, _n, _cmd, _cwd, extract, _cost, _need, why in COUNTER_READERS:
        if key not in keys or not log_readable(_cmd, extract):
            continue
        got: "dict[tuple[int, ...], list[str]]" = {}
        for name, body in parts:
            m = re.search(extract, body, re.M | re.S)
            if m is None:
                continue
            got.setdefault(tuple(int(g) for g in m.groups()), []).append(name)
        if len(got) > 1:
            detail = "; ".join(f"{list(v)} from {', '.join(sorted(ns))}"
                               for v, ns in sorted(got.items()))
            problems.append(
                f"🔴 MEASURED_LEG_DISAGREEMENT `{key}` was read on the same commit by "
                f"{sum(len(ns) for ns in got.values())} artifact(s) and they do not "
                f"agree: {detail}. One tree cannot have two answers, so this counter is "
                f"a fact about the machine that measured it. ({why})")
    return problems


# ── 🆕 275 — THE VERDICT OF THE RUN THAT PRODUCED THE NUMBERS ─────────────────────────
#
# 🔴 273's FINDING, AND THE HALF 274 LEFT OPEN IN ITS OWN §5.9. *A check nobody reads
# after it runs is not a check, it is a receipt.* 274 made the run's OUTPUT readable and
# bound it to a commit; nothing reads whether the run PASSED. `main` can go red after a
# merge and no instrument in the ritual says so — both of 273's finds were sitting in run
# history, one of them for eighteen hours, and the only reason either was seen is that a
# pickup happened to ask for a git assessment.
#
# 🔴 AND 274's OWN UPLOAD IS WHAT MAKES THIS URGENT RATHER THAN TIDY. The capture is
# uploaded `if: always()`, deliberately — the run that REFUSED is the one worth reading —
# so a download directory exists for a run whose gates went red, carries a `CI_MEASURED`
# line, binds to the block's commit, and reads as *bound: these counters describe the tree
# that shipped*. Every word of that is true and the run failed. The artifact cannot say so
# and was never meant to: a verdict is a fact about the RUN, not about its output.
#
# 🔴 MEASURED AT 275, ON THIS SESSION'S OWN PICKUP. 274's `ci.yml` used `${{ runner.temp }}`
# in a job-level `env:`, which is not a context available there, so GitHub refused the file:
# the `ci` run at that commit concluded `failure` in 0s, created no jobs, and none of the
# twenty-six required checks reported at all. The local replay was green. This reader is
# the one thing in the tree that would have said so, and it is one API call.
#
# 🔴 NO EMITTED LINE AND NO BLOCK CLAIM, WHICH IS A NARROWING AND NOT AN OVERSIGHT. The
# three world-facing readings need `--gh-open` because the machine that can read them and
# the machine that closes may differ. This one cannot: only a machine that ran
# `gh run download` has a run id to ask about, and that machine has the network by
# construction. A carried-line route here would be a route for an environment that cannot
# exist, and a second spelling to keep joined for nothing.
RUN_GREEN = "success"


def measured_run(text: str, parts: "list[tuple[str, str]] | None") -> str:
    """The run id every attributed part agrees on, or "" when there is none.

    `ci_provenance` already refuses a directory whose parts disagree on the run, so by the
    time this is asked the answer is single-valued or the close is already refused.
    """
    for body in ([b for _n, b in parts] if parts is not None else [text]):
        m = CI_MEASURED_RE.search(body)
        if m is not None:
            return m.group("run")
    return ""


def gh_run_verdict(run_id: str, root: Path = ROOT) -> "tuple[str, str, list[str], str]":
    """(conclusion, status, jobs that did not pass, problem) — NETWORK.

    🔴 AN UNREACHABLE FORGE IS NOT A GREEN, which is 236 §4's rule arriving at the one
    counter in this file whose correct value is a WORD. Every failure path returns a
    problem, and the caller refuses the close rather than assuming the run was fine.
    """
    try:
        p = subprocess.run(("gh", "run", "view", run_id, "--json",
                            "conclusion,status,headSha,jobs"),
                           cwd=root, capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        return gh_run_verdict_rest(run_id, "`gh` is not installed for this run", root)
    except (OSError, subprocess.SubprocessError) as e:
        return gh_run_verdict_rest(run_id, f"`gh run view` could not run: {e}", root)
    if p.returncode != 0:
        first = next((ln for ln in (p.stderr or p.stdout).split("\n") if ln.strip()), "")
        return gh_run_verdict_rest(run_id, f"`gh run view {run_id}` exited "
                                           f"{p.returncode}: {first.strip()[:160]}", root)
    try:
        out = json.loads(p.stdout or "{}")
    except ValueError as e:
        return ("", "", [], f"`gh run view {run_id} --json` did not return JSON: {e}")
    bad = [j.get("name", "?") for j in out.get("jobs") or []
           if j.get("conclusion") not in (RUN_GREEN, "skipped", "")]
    return (str(out.get("conclusion") or ""), str(out.get("status") or ""), bad, "")


def gh_run_verdict_rest(run_id: str, why_cli: str, root: Path = ROOT
                        ) -> "tuple[str, str, list[str], str]":
    """The `gh`-free half, carrying the CLI's reason forward — `gh_open_rest`'s shape.

    🔴 THE JOB NAMES ARE DROPPED ON THIS ROUTE AND THE VERDICT IS NOT. A second request
    for `/jobs` would double the cost of the read to make a message nicer, and the refusal
    is already actionable without it: it names the run and the run has a URL.
    """
    slug, prob = origin_slug(root)
    if prob:
        return ("", "", [], f"{why_cli}; and the API route has no origin to ask: {prob}")
    rows, prob = gh_rest_object(f"actions/runs/{run_id}", root)
    if prob:
        return ("", "", [], f"{why_cli}; and the API route did not answer either: {prob}")
    return (str(rows.get("conclusion") or ""), str(rows.get("status") or ""), [], "")


# 🆕 287 — THE FIFTH WORLD READING, AND THE ONLY ONE THAT HAD NO EMITTER.
#
# 🔴 `GH_OPEN_ISSUES`, `GH_OPEN_PRS`, `ASSETLIB_VERSION` and `MAIN_AT_HEAD` were each
# given `--gh-open` — 271 §1, 272 §3, 277 §3 — for one argument stated once and never
# revisited: *a replay can pay for the reading once, on whichever machine can make it,
# and every later reader of that log gets the same answer rather than dialling again.*
# The run VERDICT is the same kind of fact about the same forge, and it was left dialling
# LIVE inside the close, with two routes and no third: `gh`, or the REST endpoint.
#
# 🔴 SO THE CLOSE COULD ONLY EVER RUN WHERE THE FORGE WAS REACHABLE AT THAT MOMENT, and
# 286 §0 read that constraint one layer too high. It recorded *a Cowork session cannot
# perform a close* and attributed it to the artifact download being 401 anonymous, which
# is true and is not the whole of it: the download is one authenticated command a person
# can run, and the verdict was a live dial inside the gate itself. 287 measured the
# difference — everything else in the close ran in a container against `ci286/`, and this
# was the one refusal left.
#
# 🔴 AND THE LINE IS BOUND TO ITS RUN, WHICH THE OTHER FOUR DO NOT NEED TO BE. A stale
# `ASSETLIB_VERSION` is a wrong version; a stale `MEASURED_VERDICT` is a GREEN belonging
# to some other run, laid over the numbers of this one. That is the receipt 273 named,
# so the run id is IN the line and a line about a different run is refused rather than
# skipped — 285's appended `MAIN_AT_HEAD` is what skipping looks like (286 §1.1).
MEASURED_VERDICT_RE = re.compile(r"^MEASURED_VERDICT (\d+) (\w+)(?: — ([^\n]+))?", re.M)


def verdict_emit(run_id: str, root: Path = ROOT, read=gh_run_verdict) -> int:
    """`--gh-verdict <run>`: put the run's verdict into a log a later `--measured` reads.

    🔴 AN EMITTER, NOT A GATE, AND IT EXITS 0 WHETHER OR NOT IT COULD READ — `gh_emit`'s
    rule, for `gh_emit`'s reason. An emitter that exited non-zero where the network is
    absent would turn the replay's exit sum into a statement about connectivity. The
    unreadable case prints the reason with no verdict word on the line, so
    `MEASURED_VERDICT_RE` finds nothing and the close says nobody looked rather than
    standing on a green it never saw.
    """
    conclusion, status, bad, prob = read(run_id, root)
    if prob:
        print(f"MEASURED_VERDICT UNREAD — {prob}")
    elif not conclusion:
        print(f"MEASURED_VERDICT UNREAD — run {run_id} is `{status or 'unknown'}` and has "
              f"reached no verdict yet")
    else:
        print(f"MEASURED_VERDICT {run_id} {conclusion}"
              + (f" — {', '.join(bad)}" if bad else ""))
    return 0


def verdict_of_log(run_id: str, log: str) -> "tuple[str, list[str], str]":
    """(conclusion, jobs that did not pass, problem) off the measured log — 🆕 287.

    🔴 THE THREE ANSWERS ARE NOT TWO. A log with no line is *nobody wrote one down*, and
    the caller falls through to the live dial; a log whose line is about ANOTHER run, or
    whose lines disagree, is a reading that cannot be used and must not be silently
    dropped. `main_head_problems`' ambiguity arm, on the counter this close stands on.
    """
    rows = MEASURED_VERDICT_RE.findall(log or "")
    if not rows:
        return ("", [], "")
    mine = [(c, b) for r, c, b in rows if r == run_id]
    foreign = sorted({r for r, _c, _b in rows if r != run_id})
    if foreign and not mine:
        return ("", [], f"the measured log carries MEASURED_VERDICT for run(s) "
                        f"{', '.join(foreign)} and none for {run_id}, whose artifacts "
                        f"produced these counters. A verdict about another run is not "
                        f"this run's verdict. REPLACE the emitted readings at the close; "
                        f"never append them (286 §7.2)")
    if foreign:
        return ("", [], f"the measured log carries MEASURED_VERDICT for {run_id} and "
                        f"also for run(s) {', '.join(foreign)} — the directory holds "
                        f"readings from more than one run and this reader cannot say "
                        f"which the session meant. REPLACE the emitted readings at the "
                        f"close; never append them (286 §7.2)")
    said = sorted({c for c, _b in mine})
    if len(said) > 1:
        return ("", [], f"the measured log names run {run_id} with {len(said)} different "
                        f"verdicts — {', '.join(said)} — and two readings that disagree "
                        f"are not a verdict")
    concl, bad = mine[0][0], [b.strip() for b in (mine[0][1] or "").split(",") if b.strip()]
    return (concl, bad, "")


def verdict_problems(run_id: str, log_sha: str, run_network: bool,
                     read=gh_run_verdict, log: str = "") -> "tuple[list[str], list[str]]":
    """(problems, notes) — did the run these counters came from actually pass?"""
    problems: "list[str]" = []
    notes: "list[str]" = []
    if not run_id:
        return (problems, notes)
    # 🆕 287 — THE LOG ROUTE IS ASKED FIRST, AND IT IS ASKED BEFORE `--network` IS EVEN
    # CONSULTED. A reading already taken, on a machine that could take it, is not
    # improved by dialling again — and dialling again is the second chance for two
    # readings to describe two different worlds that 279 removed from `main_run_rows`.
    _concl, _bad, _prob = verdict_of_log(run_id, log)
    if _prob:
        problems.append(
            f"🔴 MEASURED_VERDICT_UNUSABLE {_prob}. An unreachable forge is not a green "
            f"(236 §4) and neither is a green about something else.")
        return (problems, notes)
    if _concl:
        if _concl != RUN_GREEN:
            problems.append(
                f"🔴 MEASURED_RUN_RED run {run_id} produced every counter below and the "
                f"log says it concluded `{_concl}`"
                + (f" — {', '.join(_bad)} did not pass" if _bad else "")
                + ". The artifact is uploaded `if: always()` on purpose, so it exists "
                  "for a run whose gates refused and reads exactly like one from a run "
                  "that did not.")
            return (problems, notes)
        notes.append(
            f"measured: run {run_id} concluded `{_concl}` — read from a "
            f"`MEASURED_VERDICT` line in the measured directory rather than dialled "
            f"here, which is what lets a close run where the forge cannot be reached "
            f"(287, the rule 271 §1 wrote for the other four world readings)")
        return (problems, notes)
    if not run_network:
        problems.append(
            f"🔴 MEASURED_VERDICT_UNREAD these counters were produced by run {run_id} and "
            f"nothing in this run asked whether that run PASSED. The artifact is uploaded "
            f"`if: always()` on purpose, so it exists for a run whose gates refused and "
            f"reads exactly like one from a run that did not — bound, attributed, and "
            f"about a red tree. Pass `--network`, or supply "
            f"`MEASURED_VERDICT {run_id} <conclusion>` from `handoff_gate.py "
            f"--gh-verdict {run_id}` in the measured directory (287).")
        return (problems, notes)
    conclusion, status, bad, prob = read(run_id)
    if prob:
        problems.append(
            f"🔴 MEASURED_VERDICT_UNREAD run {run_id} produced every counter below and its "
            f"verdict could not be read: {prob}. An unreachable forge is not a green "
            f"(236 §4) — a close standing on numbers from a run nobody graded is the "
            f"receipt 273 named, one layer up. 🆕 287 — and the reading can be paid for "
            f"elsewhere: run `handoff_gate.py --gh-verdict {run_id}` on a machine that "
            f"can reach the forge and put its line in the measured directory, the same "
            f"route the other four world readings have had since 271.")
        return (problems, notes)
    if not conclusion:
        problems.append(
            f"🔴 MEASURED_VERDICT_PENDING run {run_id} is `{status or 'unknown'}` and has "
            f"reached no verdict. Its artifacts are downloadable because the capture "
            f"uploads as each job ends; a verdict that does not exist yet is not a green. "
            f"Wait for the run, then close against it.")
        return (problems, notes)
    if conclusion != RUN_GREEN:
        detail = f" — {', '.join(bad)} did not pass" if bad else \
                 " — and it created no jobs at all, which is what a workflow file GitHub " \
                 "refuses looks like from here"
        problems.append(
            f"🔴 MEASURED_RUN_NOT_GREEN run {run_id} produced every counter below and "
            f"concluded `{conclusion}`{detail}. The numbers are real and the tree they "
            f"describe is red: `if: always()` means an artifact is evidence of a run, "
            f"never of a passing one. This is 273's other half — nothing in this ritual "
            f"has ever read a post-merge run's verdict, and both of 273's finds were "
            f"sitting in run history where nobody looked.")
        return (problems, notes)
    notes.append(
        f"measured: run {run_id} concluded `{conclusion}` — the commit this block claims "
        f"({log_sha[:7]}) is GREEN on the run that produced these counters, which is the "
        f"post-merge verdict nothing in this ritual read before 275")
    return (problems, notes)


# ── 🆕 274 — AND THE ROUTING QUESTION, ASKED OF THE WORKFLOW ──────────────────────────
#
# 🔴 `replay_problems()` ASKS EVERY MUTATING AND SLOW ROW WHETHER THE FENCE RUNS ITS
# INSTRUMENT AND SENDS THE OUTPUT TO THE LOG. Correct, and it is a question about a
# procedure a human performs. When the log comes from CI the procedure is the WORKFLOW,
# and the same question has to be asked one file over — otherwise a session that closes
# against a CI artifact is asked nothing at all about where its numbers came from, which
# is a weaker gate than the one it replaces.
#
# 🔴 AND IT IS ASKED AT FLAG GRANULARITY, WHICH CLOSES `replay-ci-flag-granularity`
# (OPEN 242). `ci_scripts()` compares by BASENAME, so `mutation_lock_gate.py --selftest`
# and `mutation_lock_gate.py` are one entry — and they are different commands printing
# different things: `mutlock.guarded` comes from the first and nothing reads the second's
# output. A basename comparison reports a captured `mutation_lock_gate.py` and cannot say
# WHICH of the two the artifact carries. The roster below keeps the flags.
#
# 🔴 THE `shell: bash` ARM IS NOT STYLE. GitHub's default shell for a `run:` step on
# Linux is `bash -e {0}` — no `pipefail` — so `gate.py | tee -a "$LOG"` exits with tee's
# status and a REFUSING gate goes green. Every capture in `ci.yml` is a pipe, so a
# capture that forgot the line would silently convert a merge-blocking check into a
# receipt. That is this session's own finding pointed at the change this session is
# making, and it is checked rather than remembered.
CI_STEP_SPLIT = re.compile(r"^\s*-\s", re.M)
CI_CAPTURE_TOKEN = "$CI_MEASURED_LOG"


def ci_capture_steps(root: Path = ROOT) -> "list[tuple[str, str, bool]]":
    """[(workflow file, command as written, guarded by `shell: bash`)] for every step
    routing its output into the captured log."""
    out: "list[tuple[str, str, bool]]" = []
    wf_dir = root / ".github" / "workflows"
    if not wf_dir.is_dir():
        return out
    for f in sorted(wf_dir.glob("*.y*ml")):
        for step in CI_STEP_SPLIT.split(f.read_text(encoding="utf-8")):
            guarded = re.search(r"^\s*shell:\s*bash\s*$", step, re.M) is not None
            for ln in step.split("\n"):
                m = CI_RUN_ONE.match(ln)
                if m is None or CI_CAPTURE_TOKEN not in m.group(1):
                    continue
                cmd = m.group(1).split("2>&1")[0].split("|")[0].strip()
                out.append((f.name, cmd, guarded))
    return out


def ci_capture_norm(cmd: str) -> str:
    """The command with its flags and without its path — `ci.yml` spells the same
    instrument `python3 scripts/x.py` in one job and `python3 ../scripts/x.py` in
    another, because the working directory differs and the command does not."""
    return " ".join(t.rsplit("/", 1)[-1] for t in cmd.split())


def ci_capture_problems(captured: "list[tuple[str, str, bool]]", keys: "set[str]"
                        ) -> "tuple[list[str], list[str]]":
    """(problems, notes) — the routing question, asked of the workflow files."""
    problems: "list[str]" = []
    notes: "list[str]" = []
    for wf, cmd, guarded in captured:
        if not guarded:
            problems.append(
                f"🔴 CI_CAPTURE_UNGUARDED `{wf}` routes `{cmd}` into the captured log "
                f"and the step does not declare `shell: bash`. The default shell has no "
                f"`pipefail`, so the step exits with `tee`'s status: a gate that REFUSED "
                f"would be reported green, and its refusal would be sitting in the "
                f"artifact nobody's exit code reflected.")
    have = {ci_capture_norm(c) for _wf, c, _g in captured}
    for key, _alias, _n, cmd, _cwd, _ex, cost, _need, _why in COUNTER_READERS:
        if key not in keys or cmd is None or cost == CHEAP:
            continue
        want = ci_capture_norm(" ".join(cmd))
        if want not in have:
            problems.append(
                f"🔴 CI_CAPTURE_MISSING `{key}` is {cost}, so its counter can come from "
                f"nowhere but the measured log — and no step in any workflow file sends "
                f"`{want}` there. The artifact this block was closed against cannot "
                f"carry it, whatever else it carries. Route the step "
                f"(`… 2>&1 | tee -a \"$CI_MEASURED_LOG\"`, under `shell: bash`).")
    notes.append(f"ci capture: {len(captured)} step(s) route into the captured log, "
                 f"compared at FLAG granularity against {len(have)} distinct command(s)")
    return problems, notes


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


def tier_problems(text: str, log: str, session: "int | None",
                  absent: "dict[int, str] | None" = None
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
    # 🆕 290 — *THE PREVIOUS SESSION* MEANS *THE PREVIOUS SESSION THAT SHIPPED*, AND THE
    # DIFFERENCE IS A DECLARATION SOMEBODY MADE RATHER THAN A GAP THIS READER GUESSED AT.
    # 289 §3.4: a session declared in `BLOCK_ABSENT` left no tree and no block, so there
    # is no verification there to inherit and nothing between it and its predecessor for
    # a block to have skipped. An undeclared hole is still refused by name — that pair is
    # the whole safety argument, and it is asserted on one fixture in `--selftest`.
    skipped: "list[int]" = []
    if session is not None:
        want_from, skipped = shipped_predecessor(session, absent)
        if from_session != want_from:
            why = ("The tier inherits the PREVIOUS session's verification, and a block "
                   "that inherited from further back skipped the sessions between it "
                   "and its own evidence.")
            if skipped and from_session in skipped:
                why = (f"Session {from_session} is declared in `BLOCK_ABSENT` — it "
                       f"shipped nothing, published no status block and left no verified "
                       f"tree, so there is no verification there to inherit. The "
                       f"predecessor that shipped is {want_from}.")
            elif skipped:
                why += (f" {len(skipped)} session(s) between here and {want_from} are "
                        f"declared absent ({skipped}), which is why the predecessor is "
                        f"not {session - 1}.")
            problems.append(
                f"🔴 TIER0_PREDECESSOR — block {session} inherited from {from_session}, "
                f"and the session it must inherit from is {want_from}. {why}")
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
        over = (f", over {len(skipped)} session(s) declared absent ({skipped})"
                if skipped else "")
        notes.append(f"ritual TIER0 — {len(COUNTER_READERS)} tree counters inherited "
                     f"from {from_session} at {at_sha}{over}, header re-read live")
    return (problems, notes)


def check(handoff: Path, log: str, run_cheap: bool, run_slow: bool,
          run_locked: bool, run_network: bool = False,
          parts: "list[tuple[str, str]] | None" = None, measured: str = ""
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

    # ── 🆕 274 — WHERE THE LOG CAME FROM, BEFORE ANYTHING READS A NUMBER OUT OF IT ────
    # 🔴 `parts or []` IS THE DEFECT `read_measured` WAS FIXED FOR, REINTRODUCED AT ITS
    # CALL SITE, AND THIS GATE CAUGHT IT ON ITS OWN HANDOFF. `None` means *the argument
    # was a FILE*; `[]` means *it was a directory and there was nothing in it*. Collapsing
    # them here made `MEASURED_EMPTY` fire on the local replay log — a refusal naming a
    # cause that could not possibly be the live one, printed by the reader written to
    # stop exactly that. The distinction is worth two lines because it is load-bearing
    # twice, and it was wrong at the second place within an hour of being fixed at the
    # first.
    p_problems, p_notes, log_sha = ci_provenance(log, parts, measured or "the log")
    problems.extend(p_problems)
    r_problems, r_notes = replay_problems(text, ci_measured=bool(log_sha))
    problems.extend(r_problems)
    r_notes.extend(p_notes)
    # 🆕 242 — the replay list against the workflow files, both directions.
    _ci = ci_scripts()
    rc_problems, rc_notes = replay_ci_problems(text, _ci)
    problems.extend(rc_problems)
    r_notes.extend(rc_notes)
    # 🆕 274 — and the same two rosters at FLAG granularity (`replay-ci-flag-granularity`,
    # OPEN 242). The basename comparison above is satisfied by any invocation of the same
    # file; this one is not.
    rf_problems, rf_notes = replay_ci_flag_problems(text, ci_commands())
    problems.extend(rf_problems)
    r_notes.extend(rf_notes)
    # 🆕 243 — and the third direction: what the union of both rosters never reaches.
    un_problems, un_notes = unreached_problems(text, _ci)
    problems.extend(un_problems)
    r_notes.extend(un_notes)
    # 🆕 278 §3 — AND A FOURTH, WHICH IS ABOUT THE MACHINE RATHER THAN THE LIST. The three
    # above ask whether the replay and CI run the same commands; this one asks whether the
    # commands that need a particular input are run somewhere that SUPPLIES it. 🆕 280 —
    # and it is five inputs now rather than one: see `GATE_INPUTS`. It is checked here, at
    # every close, because the answer lives in the workflow files and changes when somebody
    # moves a step between jobs — or gives a schedule-only workflow a `push:` trigger.
    _wf_dir = ROOT / ".github" / "workflows"
    _wf_files = ({f.name: f.read_text(encoding="utf-8")
                  for f in sorted(_wf_dir.glob("*.y*ml"))} if _wf_dir.is_dir() else {})
    d_problems, d_rows = input_problems(_wf_files, GATE_INPUTS)
    d_problems.extend(provider_coverage(GATE_INPUTS))
    problems.extend(d_problems)
    r_notes.extend(d_rows)

    session, how = block_session(handoff.name, block)
    # 🆕 280 §3 — AND WHAT THE WIRE DID, IF THIS SESSION CUT ANYTHING. Read here
    # rather than in `check_header` because it is not a counter: the claim is a
    # VERDICT, its population is the cuts and not the sessions, and the comparison is
    # `release_names.wire_floor` rather than an equality between two numerals.
    rv_problems, rv_notes = release_verdict_problems(block, session)
    problems.extend(rv_problems)
    r_notes.extend(rv_notes)
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

    # ── 🆕 274 — THE LOG IS BOUND TO THE COMMIT THE BLOCK CLAIMS ──────────────────────
    #
    # 🔴 THIS IS THE LINE 244's STALENESS RULE WAS STANDING IN FOR. *The measured log
    # goes stale the moment any tracked file changes* is true, unenforceable, and one
    # question away from the thing actually worth knowing — which commit produced these
    # numbers. A CI artifact answers that exactly, so the rule stops being a discipline
    # somebody has to remember and becomes an equality somebody can fail.
    if log_sha:
        shas = main_shas(block)
        if not shas:
            problems.append(
                f"🔴 MEASURED_UNBINDABLE the measured log was produced at {log_sha[:7]} "
                f"and this block's `main` row carries no SHA to compare it to. A "
                f"CI-measured close is only worth more than a local one because the two "
                f"ends can be joined; with one end missing it is worth less, because it "
                f"reads as bound and is not.")
        else:
            claimed = shas[0]
            n = min(len(claimed), len(log_sha))
            if claimed[:n] != log_sha[:n]:
                problems.append(
                    f"🔴 MEASURED_SHA_MISMATCH the block's `main` row says {claimed} and "
                    f"the measured log was produced at {log_sha[:7]}. Every counter "
                    f"below describes a tree this block does not claim to be about. This "
                    f"is the defect 244 wrote its staleness rule against, and unlike the "
                    f"rule it is a comparison rather than an instruction: download the "
                    f"run for {claimed}, or correct the row.")
            else:
                r_notes.append(
                    f"measured: bound — the log was produced at {log_sha[:7]} and the "
                    f"block's `main` row claims {claimed}, so these counters describe "
                    f"the tree that shipped rather than a branch tip that no longer "
                    f"exists (274, replacing 244's staleness rule)")
        problems.extend(leg_disagreements(parts or [], set(bound)))
        cap_problems, cap_notes = ci_capture_problems(ci_capture_steps(), set(bound))
        problems.extend(cap_problems)
        r_notes.extend(cap_notes)
        # 🆕 275 — and the run that produced them: did it PASS? The sha binding above says
        # these numbers describe the tree that shipped; only this says the tree that
        # shipped was green. `if: always()` is what makes the two different questions.
        v_problems, v_notes = verdict_problems(measured_run(log, parts), log_sha,
                                               run_network, log=log)
        problems.extend(v_problems)
        r_notes.extend(v_notes)

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
            # 🆕 281 — AND THE SUBJECT IS ON THE REFUSAL, because the two kinds of
            # disagreement want opposite repairs and have been indistinguishable since
            # 227. A number declared TRACKED that disagrees at the commit it was
            # measured at cannot be a machine talking: the block is stale, or the reader
            # is not the pure function its row claims. A number declared INDEX, CLONE or
            # MACHINE disagreeing is that class doing exactly what it was declared to do
            # — 254's untracked file, 234 §4.8's one disk, 275's loaded runner — and the
            # repair is to re-read, not to hunt.
            subj = COUNTER_PROVENANCE.get(key, "")
            said = SUBJECT_SIGNALS.get(subj, ("", ""))[0].split(".")[0]
            problems.append(
                f"🔴 {key} — the block says {list(claimed)}, the tree says {list(got)}\n"
                f"     atom: {atom!r}\n"
                + (f"     🔴 SUBJECT {subj} — this counter is declared a fact about "
                   f"{said.lower()}, so a disagreement here is a STALE BLOCK or a "
                   f"reader that is not the pure function its row claims. Nothing about "
                   f"the machine can explain it.\n" if subj == TRACKED else
                   f"     SUBJECT {subj} — a fact about {said.lower()}. Two honest runs "
                   f"can differ; re-read at the shipped tree rather than hunting.\n"
                   if subj else "")
                + f"     {row[8]}")

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
    # 🆕 281 — `counter-provenance-undeclared` (280). The roster is checked against the
    # readers' own code on EVERY close, not once when it was written: a table of
    # measurements that is never re-measured is a table of memories, and this file has
    # spent four sessions establishing that those are the same thing wearing green.
    problems.extend(counter_subject_problems(
        COUNTER_READERS, COUNTER_PROVENANCE,
        derive_subjects(COUNTER_READERS, SUBJECT_UNDERIVABLE), SUBJECT_UNDERIVABLE))
    problems.extend(subject_coverage(COUNTER_PROVENANCE))
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
# 🆕 276 — AND IT IS EMPTY AGAIN, ON THE SCHEDULE THE ROW ITSELF PREDICTED. 275 wrote
# `taut.duration` here with the note *276 adds 275's block to `BLOCK_POPULATION` and this
# row goes STALE on the same run, deleted by the gate rather than by a session
# remembering*. That is exactly what happened: adding the block put the key in `reached`,
# `pending_problems` reported `ALIAS_PENDING_STALE`, and this session deleted the row
# because it was told to rather than because it looked. Two sessions running that a
# one-session exemption has expired on time, which is the only end state 246 designed
# this table to have.
ALIAS_PENDING: "dict[str, str]" = {
    # 🆕 292 — EMPTY AGAIN, AND `landscape.roster` LEFT ON THE SCHEDULE ITS OWN ROW WROTE.
    # 291 filed it with the note *292 adds 291's block to `BLOCK_POPULATION` and
    # `pending_problems` turns this row into `ALIAS_PENDING_STALE` on that same run — delete
    # it because the gate says so, not because you remembered*. That is what happened: this
    # session's first PR carries 291's block, the block prints `landscape 4 channel(s) / 51
    # analysed / 47 surfaced`, the key became reached, and the row was refused by name before
    # anybody looked for it. 🔴 FIFTH TABLE IN A ROW TO EXPIRE ON TIME (276, 287, 289, 291's
    # predecessor set, and this one), which remains the only end state 246 designed the table
    # to have — a one-session exemption that can outlive the block answering it is a second
    # exemption list nobody reads.
    # 🆕 289 — EMPTY AGAIN, AND BOTH ROWS LEFT THE WAY THE TABLE IS DESIGNED FOR: 287's
    # block joined `BLOCK_POPULATION` in this session's first PR, `taut.orphan` and
    # `difference_field.population` became reached on that same run, and
    # `ALIAS_PENDING_STALE` refused them by name. Deleted because the gate said so, not
    # because a session remembered — the third table in a row to expire on time (276,
    # 287, 289), which is the only end state 246 designed this one to have.
}

# 🆕 280 — `untagged-count-unbound` (279) NEEDED THE HEADER HALF OF 246's TABLE AND
# THERE WAS NOT ONE. `ALIAS_PENDING` governs `COUNTER_READERS`; `HEADER_ALIAS_UNUSED`
# has refused an unreached header row since 236 with no way to add one, so a new
# header reader could be shipped only by editing a block that had already shipped —
# which is the ONE repair `population_block_shape` says out loud it must never accept.
# 🔴 THE ASYMMETRY WAS INVISIBLE BECAUSE NOBODY HAD ADDED A HEADER READER SINCE THE
# TABLE WAS BUILT: 243 §3's two word-claims were about counters the blocks already
# printed, so they reached a real block on the run that added them. A roster whose
# only untried path is the one a new row takes is a roster nobody has added to.
#
# The predicate is `pending_problems`, unchanged and SHARED with `ALIAS_PENDING` —
# two tables checked by one reader is 203 §2's rule, and two readers is how the two
# halves of this file drift apart in the first place.
#
# 🔴 AND THE ROW EXPIRES AT 281, DELETED BY THE GATE RATHER THAN BY A SESSION
# REMEMBERING. 280's block prints `untagged 0` on its npm row; 253's rule copies that
# block into `BLOCK_POPULATION` in 281's FIRST PR, which puts `npm.untagged` into
# `h_reached` and turns this row into `HEADER_ALIAS_PENDING_STALE` on the same run.
# 275's `taut.duration` did exactly this one roster over, and 246 designed the shape.
# 🆕 281 — EMPTY, ON SCHEDULE, IN THE COMMIT THAT MADE IT STALE. 280 shipped
# `npm.untagged` here with an expiry written into the row — *adding that block at 281
# deletes this row* — and the same PR that adds 280's entry to `BLOCK_POPULATION` is the
# one where `untagged 2` becomes reachable. It is deleted rather than left to be found by
# `pending_problems`, because a table whose whole contract is one session is a table that
# proves nothing if anybody has to be reminded.
HEADER_ALIAS_PENDING: "dict[str, str]" = {}

BIND_PINS: "list[tuple[str, str, str]]" = [
    ("807 keys", "floor_pin.literal", "🔴 THE ROW THIS FILE EXISTS FOR"),
    ("wire_diff_key 292 tools / 3474 nodes / 17 keys / 0 unread", "wire_diff.key",
     "🔴 THE COLLISION. Carries `keys` and must NOT reach `floor_pin.literal`"),
    ("blast 1383", "instrument.blast", "the total"),
    # 🆕 287 — `block-counters-without-readers` (286 §1.3). Both spellings are
    # 285's OWN, taken from the block it wrote and then had to strip: these are the
    # two atoms whose close said `UNREADABLE CLAIM`, and the fixture is the sentence
    # that could not be read.
    # 🔴 A ROW WITH NO PIN IS A BINDING NOTHING WOULD NOTICE THE LOSS OF, and these
    # two need one more than most — no SHIPPED block carries either spelling, because
    # the one session that wrote them removed them rather than write the rows.
    ("orphan 44/44", "taut.orphan", "285's, and the reader was already printing it"),
    ("difference_field 28 population / 5 unreachable / 5 declared",
     "difference_field.population",
     "285's, three numbers with no instrument behind them"),
    ("late not-loaded 0", "instrument.not_loaded",
     "🔴 CARRIES `late` AND MUST NOT REACH `instrument.late_live`"),
    ("724/724", "host.suite", "the unlabelled ratio"),
    ("contract 23/23", "contract.checks", "a ratio with a label"),
    ("unswept 0", "floor_pin.unswept", ""),
    ("exempt 36", "floor_pin.exempt", ""),
    ("term 275 file(s) / 21 suffixes", "term.swept", ""),
    ("landscape 4 channel(s) / 51 analysed / 47 surfaced", "landscape.roster",
     "three numbers on one atom, and the alias is the word `landscape` — which appears "
     "in no other counter and in no prose numeral this block spells"),
    ("duration 4 sites / 2 lower / 2 guarded", "taut.duration",
     "🔴 CARRIES THREE NUMBERS AND THE WORD `sites`, and must NOT reach `taut.sites`, "
     "whose alias is the word `taut` — the same collision `wire_diff_key` is pinned "
     "against two rows up"),
    ("26 CI jobs", "ci.checks", "the derived counter"),
    ("error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 53 addon / 0 problems",
     "contract.error_codes",
     "🔴 CARRIES `code` AND MUST NOT REACH `contract.checks`, whose alias is the word "
     "`contract` — 268 wrote this line into its block with no row at all, so the first "
     "thing pinned about it is that it binds to one reader and not to none"),
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
    (268, """> ```
> main                 4820efb — the branches that answered to English (#329)   MERGED
>                      26/26 green · branch deleted
> branch 268           none live — this session's work is on main
> tag                  🟢 v1.80.0 ANNOTATED at 4820efb, declaring its own release commit
> host / addon         1.80.0 / 1.11.0  🟢 HOST MOVED, this session's own cut; addon
>                      unmoved, still stamped at ca2d5d8, C4_OK — no second Asset Library
>                      submission is owed while 1.11.0 is in review
> npm                  🟡 1.80.0 · registry 1.79.0 — PUBLISH OWED, needs his TTY
> 🟢 VERIFIED AFTER THE CHANGE   903/903 · contract 29/29 · scope 49 · control 71
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1691
>               · py gates 18/4/14 · SIG 134/105
>               · discover 53/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 104 · 48 governed · 1202 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 308 file(s) / 21 suffixes
>               · seal 104 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3680 nodes / 20 keys / 0 unread
>               · wire_invisible 326 refinements · lint_ceiling 18 py / 65 mjs
>               · taut 4726 · mutlock 5 guarded · tree_quiet 13
>               · release_names 61/33 · queue 91 rows / 21 OPEN · handoff 319 claims
>               · error-code discipline 54 reads / 29 raise sites / 0 problems
> ```
"""),
    (269, """> ```
> main                 4abc77d — the word two producers shared (#330)   MERGED
>                      branch deleted
> branch 269           none live — this session's work is on main
> tag                  🟢 v1.81.0 ANNOTATED at 4abc77d, declaring its own release commit
> host / addon         1.81.0 / 1.11.0  🟢 HOST MOVED, this session's own cut; addon
>                      unmoved, still stamped at ca2d5d8, C4_OK — no Asset Library
>                      submission is owed while 1.11.0 is in review
> npm                  🟡 1.81.0 · registry 1.80.0 · lag 1 · tags 132 · 0 open issues /
>                      0 open PRs — PUBLISH OWED, needs his TTY
> 🟢 VERIFIED AFTER THE CHANGE   903/903 · contract 29/29 · scope 50 · control 72 · 26 CI jobs
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1695
>               · late not-loaded 0 · late constructed 197/160
>               · py gates 18/4/14 · SIG 134/105
>               · discover 53/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 105 · 49 governed · 1207 keys · 96 shortfalls
>               · unswept 0 · exempt 39 · term 308 file(s) / 21 suffixes
>               · seal 104 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3680 nodes / 20 keys / 0 unread
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4726 · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · release_names 61/33 · queue 44/44 claims · handoff 328 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 53
>                 addon / 0 problems
> ```
"""),
    (270, """> ```
> main                 e35dc3e — the write that reported success (#331)   MERGED
> branch 270           session270_issue327 — merged, deleted
> tag                  🟢 v1.82.0 ANNOTATED at e35dc3e, declaring its own release commit
> host / addon         1.82.0 / 1.12.0  🔴 BOTH MOVED — the addon's four scripts all
>                      changed, so 1.11.0 could no longer name one tree. An Asset Library
>                      submission for 1.12.0 is OWED; the card is written and 1.11.0 is
>                      LIVE, not in review — see the postscript
> npm                  🟡 1.82.0 · registry 1.81.0 · lag 1 · tags 133 ·
>                      1 open issues / 0 open PRs
>                      — PUBLISH OWED, needs his TTY. #327 is FIXED and its reply is
>                      drafted, unsent, which is the only reason the issue is still open
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 29/29 · scope 50 · control 72 · 26 CI jobs
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1695
>               · late not-loaded 0 · late constructed 197/160
>               · py gates 18/4/14 · SIG 134/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 105 · 49 governed · 1207 keys · 97 shortfalls
>               · unswept 0 · exempt 39 · term 309 file(s) / 21 suffixes
>               · seal 104 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4739 · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · queue 44/44 claims · handoff 329 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    # 🆕 272 — 271's block, copied in BEFORE the replay per 253's rule: `git.moved` refuses
    # a handoff whose predecessor is not in this table, and paying that at ship time costs
    # a second PR and a full re-replay against a moved HEAD (241's sequencing lesson).
    (271, """> ```
> main                 4a718f7 — the number a reader could not make (#332)   MERGED
> branch 271           session271_unread_may_not_be_claimed — merged, deleted
> host / addon         1.82.0 / 1.12.0  🟢 unmoved — no product code changed this session
> npm                  🟢 1.82.0 · registry 1.82.0 · lag 0 · tags 133 ·
>                      0 open issues / 0 open PRs
>                      — nothing owed. The gh pair is a READING this time, not a number
>                      typed beside one: `--gh-open` on his Mac put it in the log
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 29/29 · scope 50 · control 72 · 26 CI jobs
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1782
>               · late not-loaded 0 · late constructed 206/160
>               · py gates 18/4/14 · SIG 139/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 106 · 50 governed · 1229 keys · 97 shortfalls
>               · unswept 0 · exempt 39 · term 309 file(s) / 21 suffixes
>               · seal 104 · boundary 185 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4739 · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · queue 58/58 claims · handoff 333 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (272, """> ```
> main                 d6ca644 — the mentions that were not answers (#333)   MERGED
> branch 272           session272_the_mentions_that_were_not_answers — merged, deleted
> host / addon         1.82.0 / 1.12.0  🟢 unmoved — no product code changed this session
> npm                  🟢 1.82.0 · registry 1.82.0 · lag 0 · tags 133 ·
>                      0 open issues / 0 open PRs
>                      — nothing owed. Both gh counters are a READING, taken on his Mac
>                      and appended to the log: the container has neither route
> assetlib             🟢 addon 1.11.0 live · the edit for the addon's current
>                      version is pending review
>                      — 🆕 THE FIRST BLOCK TO CARRY THIS ROW, and the first whose
>                      Asset Library claim is compared to what the library serves
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 29/29 · scope 66 · control 74 · 26 CI jobs
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1782
>               · late not-loaded 0 · late constructed 206/160
>               · py gates 18/4/14 · SIG 139/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 106 · 51 governed · 1240 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 309 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4745 · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · queue 58/58 claims · handoff 336 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (273, """> ```
> main                 255d139 — the timer that came back inside its own window,
>                                and the refusal that showed its banner (#334)   MERGED
> branch 273           session273_the_timer_that_came_back_inside_its_own_window
>                                — merged, deleted
> host / addon         1.82.0 / 1.12.0  🟢 unmoved — no product code changed this session
> npm                  🟢 1.82.0 · registry 1.82.0 · lag 0 ·
>                      0 open issues / 0 open PRs
>                      — nothing owed. Both gh counters are a READING taken on his Mac
> assetlib             🟢 addon 1.11.0 live · the edit for the addon's current
>                      version is pending review, and out of his hands
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 29/29 · scope 66 · control 74 · 26 CI jobs
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1782
>               · late not-loaded 0 · late constructed 206/160
>               · py gates 18/4/14 · SIG 139/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 106 · 51 governed · 1240 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 309 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4745 · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · queue 58/58 claims · handoff 336 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    # 🆕 275 — AND THE THREE BLOCKS ABOVE ARRIVED TOGETHER, WHICH IS THE FINDING.
    # 253's standing rule is *add the previous block to `BLOCK_POPULATION` before the
    # replay*, and 272, 273 and 274 each closed without it: the table's newest block
    # was 271 while `main` had moved four times. Nothing refused, because every floor
    # here pins the table's BACK and its WIDTH and none of them pins its FRONT — 244
    # §2's own argument, one direction over. Two things were quietly broken by it: the
    # `ALIAS_PENDING` row 246 designed to expire in ONE session had nothing that could
    # expire it, and `moved_interval` answered confidently about an interval three
    # sessions too long. `POPULATION_CONTIGUOUS` is what made the debt payable in one
    # go — it refused 274 alone and named the hole.
    (274, """> ```
> main                 255d139 — the timer that came back inside its own window,
>                                and the refusal that showed its banner (#334)
> branch 274           db068c6 session274_the_numbers_that_described_a_tree_nobody_shipped
>                                — PENDING, not merged, not pushed from here
> host / addon         1.82.0 / 1.12.0  🟢 unmoved — no product code changed this session
> npm                  🟢 1.82.0 · registry 1.82.0 · lag 0 ·
>                      0 open issues / 0 open PRs
>                      — nothing owed. Both gh counters are a READING taken on his Mac
> assetlib             🟢 addon 1.11.0 live · the edit for the addon's current
>                      version is pending review, and out of his hands
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 29/29 · scope 66 · control 74 · 26 CI jobs
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1782
>               · late not-loaded 0 · late constructed 206/160
>               · py gates 18/4/14 · SIG 139/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 107 · 52 governed · 1267 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 309 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4745 · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · queue 58/58 claims · handoff 366 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (275, """> ```
> main                 1fd4c97 — a comment is not a command (#337)   MOVED +3
>                      872326e — the verdict the artifact could not carry (#336)
> branch 275           session275-the-verdict-the-artifact-could-not-carry · PR #336
>                      session275b-a-comment-is-not-a-command · PR #337
>                      🟢 BOTH PUSHED AND MERGED, 26/26 green
> host / addon         1.82.0 / 1.12.0  🟢 unmoved — no product code changed this session
> npm                  🟢 1.82.0 · registry 1.82.0 · lag 0 ·
>                      0 open issues / 0 open PRs
>                      — nothing owed. Both gh counters are a READING taken on his Mac
> assetlib             🟢 addon 1.11.0 live · the edit for the addon's current
>                      version is pending review, and out of his hands
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 29/29 · scope 66 · control 74 · 26 CI jobs
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1797
>               · late not-loaded 0 · late constructed 212/160
>               · py gates 18/4/14 · SIG 142/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 108 · 52 governed · 1273 keys · 100 shortfalls
>               · unswept 0 · exempt 40 · term 309 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4761 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · queue 58/58 claims · handoff 384 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    # 🆕 277 — 253's standing rule, honoured on time for the second session
    # running. 276 verified 2032d04 with 26/26 green and its own block passed the
    # CI-measured close against that commit.
    (276, """> ```
> main                 2032d04 — the column the document contradicted (#338)   MOVED +1
> branch 276           session276-the-column-the-document-contradicted · PR #338
>                      🟢 PUSHED AND MERGED, 26/26 green on the first run
> host / addon         1.82.0 / 1.12.0  🟢 unmoved — no version bump this session
> npm                  🟢 1.82.0 · registry 1.82.0 · lag 0 ·
>                      0 open issues / 0 open PRs
>                      — nothing owed. Both gh counters are a READING taken on his Mac
> assetlib             🟢 addon 1.11.0 live · the edit for the addon's current
>                      version is pending review, and out of his hands
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 29/29 · scope 70 · control 80 · 26 CI jobs
>               · instrument ok across 19 · LATE_LIVE 18/8 · 0 crashes · blast 1806
>               · late not-loaded 0 · late constructed 214/160
>               · py gates 18/4/14 · SIG 144/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 108 · 52 governed · 1292 keys · 100 shortfalls
>               · unswept 0 · exempt 40 · term 309 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4768 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · queue 58/58 claims · handoff 385 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    # 🆕 278 — 253's standing rule, honoured in the FIRST PR for the third session
    # running. 277 paid a whole extra PR for remembering it after the first had merged.
    (277, """> **STATUS — 2026-08-21: TWO ROWS CLOSED, ONE PRICED AND KILLED, AND THE ROW THAT ASKED
> FOR A COUNT WAS WRONG ABOUT ITS OWN BY TWENTY-FIVE.**
> Two PRs, seven files, no release, no version bump, no behaviour change to any shipped
> tool.
>
> 🔴 **THE ROW SAID FORTY-NINE TOP-LEVEL `def`s AND `handoff_gate.py` HOLDS SEVENTY-EIGHT.**
> 247 measured the number, nothing ever printed it, and twenty-nine sessions carried it as
> a fact about the tree. That is 276's own finding-to-carry arriving inside the row 276
> handed forward. Every member was blinded to the empty its own annotation promises and
> the command run against it before a line of the roster was written: fifty-six redden,
> twenty-two do not, and the twenty-two are THREE reasons rather than twenty-two. §1.
>
> 🔴 **AND THE SWEEP FOUND TWO LIVE DEFECTS ON ITS FIRST PASS.** Seven members CRASHED the
> self-test instead of reddening it, all seven through two sites in `selftest()`: `all()`
> over an empty sequence is `True`, so a failed parse sent the reader into the branch that
> asserts a NUMBER and then indexed `ends[0]`; and `len()` over a `read_measured` return
> its own annotation says may be `None`, so the message describing a failure could not be
> built in the case that failure is about. Blinding `_runs` reddened five claims and
> killed the command; with both fixed it reddens eighty-seven. §1.
>
> 🔴 **CI REFUSED THE SWEEP ON THIS SESSION'S OWN SUBJECT.** `{SIG:previous_main}` reddens
> on a full clone and cannot on a `--depth 1` one — its only consumer runs `git rev-list
> old..new`, which fails there and returns the same documented refusal blinded or not.
> Three `host tests` legs said so and no local run could. The measurement was taken on one
> checkout and reported as a fact about the tree, by the session spending the day on
> exactly that sentence. §1.4.
>
> 🔴 **`mutating-gate-writes-not-atomic` (272) WAS PRICED AS INSTRUCTED AND THE ANSWER IS
> NOT TO BUILD IT.** A torn mutant is already recoverable byte-for-byte on both routes,
> and atomicity there converts a loud residue into a quiet one. The pricing found the
> window that DOES lose bytes — five lines, one file over, in `_gate_lock._stash()`. §3.
>
> ritual TIER1 — the full fence was run rather than inherited. `main` was clean at pickup
> and matched 276's block exactly, so TIER0 was available; this session edited three of
> the gates the fence is made of and took TIER1.
>
> ```
> main                 0be54af — the previous block joins the population (#340)   MOVED +2
>                      16ac0cd — of what, exactly, is this a count? (#339)
> branch 277           session277-of-what-is-this-a-count · PR #339
>                      session277b-block-population · PR #340
>                      🟢 BOTH PUSHED AND MERGED, 26/26 green
> host / addon         1.82.0 / 1.12.0  🟢 unmoved — no version bump this session
> npm                  🟢 1.82.0 · registry 1.82.0 · lag 0 ·
>                      0 open issues / 0 open PRs
>                      — nothing owed. Both gh counters are a READING taken on his Mac
> assetlib             🟢 addon 1.12.0 live · accepted between sessions, and the open
>                      gate is what noticed
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 29/29 · scope 70 · control 80 · 26 CI jobs
>               · instrument ok across 20 · LATE_LIVE 18/8 · 0 crashes · blast 2447
>               · late not-loaded 0 · late constructed 266/160
>               · py gates 18/5/13 · SIG 200/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 108 · 52 governed · 1413 keys · 100 shortfalls
>               · unswept 0 · exempt 40 · term 309 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4768 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · queue 58/58 claims · handoff 395 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
>
> 🔵 **THIRD BLOCK IN THE SERIES CLOSED AGAINST CI'S OWN OUTPUT**, on the route 275 wrote
> and 276 confirmed. It needed no re-derivation for the second session running.
"""),
    # 🆕 279 — 253's rule, honoured in the FIRST PR, which is what 277 paid a second PR to
    # learn and 278 then did correctly. The population is what `git.moved` reads to know
    # which endpoint a block's own diff is measured from.
    (278, """> ```
> main                 e65ed07 — the key nobody had ever read (#342)   MOVED +2
>                      7af276b — on which machine is this evidence? (#341)
> branch 278           session278-on-which-machine-is-this-evidence · PR #341
>                      session278b-the-key-nobody-had-read · PR #342
>                      🟢 BOTH PUSHED AND MERGED, 26/26 green
> host / addon         1.82.0 / 1.12.0  🟢 unmoved — no version bump this session
> npm                  🟢 1.82.0 · registry 1.82.0 · lag 0 ·
>                      0 open issues / 0 open PRs
>                      — 🔴 AND THE LAG READING IS NOT THE WHOLE ANSWER: see Owed
> assetlib             🟢 addon 1.12.0 live · unchanged since the previous session
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 30/30 · scope 73 · control 83 · 26 CI jobs
>               · instrument ok across 22 · LATE_LIVE 20/8 · 0 crashes · blast 2575
>               · late not-loaded 0 · late constructed 285/160
>               · py gates 18/6/12 · SIG 222/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 108 · 52 governed · 1478 keys · 100 shortfalls
>               · unswept 0 · exempt 40 · term 310 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4771 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 12 cases · tree_quiet 13
>               · queue 58/58 claims · handoff 403 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
>
> 🔵 **FOURTH BLOCK IN THE SERIES CLOSED AGAINST CI'S OWN OUTPUT**, on the route 275 wrote.
> Third session running that it needed no re-derivation.
"""),
    # 🆕 280 — 253's RULE, HONOURED IN THE FIRST PR. 279's block enters before the
    # replay runs, not as this session ships: `git.moved` reads its `main` row as the
    # FAR endpoint of 280's own interval, and `version_interval` reads its
    # `host / addon` pair the same way. Adding it afterwards costs a second PR and a
    # full re-replay against a moved HEAD, which is 241's lesson and 253's rule.
    #
    # 🔵 AND IT IS THE LAST BLOCK THAT WILL BE ADMITTED WITHOUT A WIRE VERDICT ON A
    # CUT. 279 cut 1.82.1 and states check 8's answer — *the wire did PATCH* — in
    # §7, in prose, where no reader goes. `release_verdict_problems` starts at 280
    # (`RELEASE_VERDICT_FROM`) for exactly that reason: this block is correct and
    # could not have known.
    (279, """> ```
> main                 21d4699 — the exemption whose reason expired (#345)  MOVED +3
>                      6febf1a — release: 1.82.1 (#344)
>                      3cca3c5 — of what population is this a reading? (#343)
> branch 279           session279-of-what-population-is-this-a-reading · PR #343
>                      the release branch · PR #344
>                      session279c-the-exemption-whose-reason-expired · PR #345
>                      🟢 ALL THREE PUSHED AND MERGED
> host / addon         1.82.1 / 1.12.0  🟢 host BUMPED, PUBLISHED and TAGGED
> npm                  🟢 1.82.1 · registry 1.82.1 · lag 0 ·
>                      0 open issues / 0 open PRs
>                      — 🔴 AND A SECOND REGISTRY READING REFUSES ON PURPOSE: SDK_UPSTREAM
>                      — 🔵 the other ceiling is in Owed, and the reason it is not here is
>                        `untagged-count-unbound`: no header atom reads it
> assetlib             🟢 addon 1.12.0 live · unchanged since the previous session
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 30/30 · scope 73 · control 83 · 26 CI jobs
>               · instrument ok across 22 · LATE_LIVE 20/8 · 0 crashes · blast 2602
>               · late not-loaded 0 · late constructed 292/160
>               · py gates 18/6/12 · SIG 230/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 108 · 52 governed · 1547 keys · 100 shortfalls
>               · unswept 0 · exempt 40 · term 311 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4771 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 58/58 claims · handoff 407 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```"""),
    # 🆕 281 — 253's RULE, HONOURED IN THE FIRST PR for the fifth session running. And
    # this is the first block `release_verdict_problems` (280 §2.3) has an opinion about:
    # `RELEASE_VERDICT_FROM = 280` and 280 cut nothing, so the reader is silent on it by
    # its own population rule — the CUTS, not the sessions. Silence here is the reader
    # working, and the next cut is where it speaks.
    #
    # 🔵 IT IS ALSO WHAT EXPIRES `HEADER_ALIAS_PENDING`. 280 shipped `npm.untagged` as a
    # header reader no shipped block could reach, on a one-session exemption that says
    # out loud it ends at 281. This block prints `untagged 2` on its npm row, so the row
    # is reached by a real block the moment this entry lands and the exemption is deleted
    # in the same commit — 275's `taut.duration`, one roster over.
    (280, """> ```
> main                 53d52db — the plane that lost its editor (#347)  MOVED +2
>                      1f130bc — what makes a reading happen? (#346)
> branch 280           session280-what-makes-a-reading-happen · PR #346
>                      session280b-the-plane-that-lost-its-editor · PR #347
>                      🟢 BOTH PUSHED AND MERGED, 26/26 green
> host / addon         1.82.1 / 1.12.0  🟢 unmoved — no version bump this session
> npm                  🟢 1.82.1 · registry 1.82.1 · lag 0 · untagged 2 ·
>                      0 open issues / 0 open PRs
>                      — 🔴 AND A SECOND REGISTRY READING REFUSES ON PURPOSE: SDK_UPSTREAM
>                      — 🔴 AND THE NEW COUNTER CAUGHT ITS AUTHOR ON THE FIRST BLOCK THAT
>                        EVER STATED IT: this row said zero, read at pickup, and the close
>                        gate said two — this session's own two merges past `v1.82.1`. That
>                        is `untagged-count-unbound`'s own defect, committed by the session
>                        that closed it, refused by the reader it shipped
> assetlib             🟢 addon 1.12.0 live · unchanged since the previous session
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 30/30 · scope 73 · control 83 · 26 CI jobs
>               · instrument ok across 22 · LATE_LIVE 20/8 · 0 crashes · blast 2671
>               · late not-loaded 0 · late constructed 299/160
>               · py gates 18/6/12 · SIG 237/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 109 · 53 governed · 1571 keys · 100 shortfalls
>               · unswept 0 · exempt 40 · term 311 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4771 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 64/64 claims · handoff 431 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```"""),
    (281, """> ```
> main                 fad1fb8 — the reader that argues with the tree (#348)  MOVED +1
> branch 281           session281-the-reader-that-argues-with-the-tree · PR #348
>                      🟢 PUSHED AND MERGED, 26/26 green — at the THIRD push.
>                      Three commits: the work, and two fixups CI found
> host / addon         1.82.1 / 1.12.0  🟢 unmoved — no version bump this session
> npm                  🟢 1.82.1 · registry 1.82.1 · lag 0 · untagged 3 ·
>                      0 open issues / 0 open PRs
>                      — 🟢 AND THE SECOND REGISTRY READING IS NO LONGER RED: SDK_UPSTREAM
>                        reads DEFERRED against a measurement it retakes every run
> assetlib             🟢 addon 1.12.0 live · unchanged since the previous session
> 🟢 VERIFIED AFTER THE CHANGE   904/904 · contract 30/30 · scope 73 · control 83 · 26 CI jobs
>               · instrument ok across 22 · LATE_LIVE 20/8 · 0 crashes · blast 2705
>               · late not-loaded 0 · late constructed 308/160
>               · py gates 18/6/12 · SIG 246/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 109 · 53 governed · 1667 keys · 100 shortfalls
>               · unswept 0 · exempt 40 · term 311 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3747 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4771 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 72/72 claims · handoff 448 claims
>               · error-code discipline 54 reads / 29 raise sites / 11 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    # 🆕 283 — 282's block, added LATE and that is the whole note. 253's rule says this
    # goes in the session's FIRST PR; 282's own handoff says so in capitals, having paid
    # 241's price for missing it one session earlier. 283 missed it too, so `MOVED +N` was
    # measured from 281's endpoint and the close refused the same way. The rule is not
    # hard; it is simply not part of any ritual a gate runs, which is why three sessions
    # in a row have now discovered it at the close instead of at the start.
    (282, """> ```
> main                 28eb2ed — 281's block into BLOCK_POPULATION (#350)  MOVED +2
> branch 282           session282-the-session-that-looked-from-the-users-side · PR #349
>                      🟢 PUSHED AND MERGED, 26/26 green — at the THIRD push.
>                      Three commits: the work, and two fixups CI found
> branch 282b          session282-the-block-that-was-not-registered · PR #350
>                      🟢 253's rule, paid late — see the standing rule below
> host / addon         1.82.1 / 1.12.0  🟢 unmoved — no version bump this session
>                      🔴 A MINOR IS OWED — the wire grew an optional field
> npm                  🟢 1.82.1 · registry 1.82.1 · lag 0 · untagged 5 ·
>                      0 open issues / 0 open PRs
> assetlib             🟢 addon 1.12.0 live · unchanged since the previous session
> 🟢 VERIFIED AFTER THE CHANGE   930/930 · contract 30/30 · scope 73 · control 83 · 26 CI jobs
>               · instrument ok across 22 · LATE_LIVE 20/8 · 0 crashes · blast 2716
>               · late not-loaded 0 · late constructed 308/160
>               · py gates 18/6/12 · SIG 246/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 109 · 53 governed · 1680 keys · 100 shortfalls
>               · unswept 0 · exempt 40 · term 316 file(s) / 21 suffixes
>               · seal 104 · boundary 187 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3760 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4868 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 75/75 claims · handoff 449 claims
>               · error-code discipline 60 reads / 30 raise sites / 12 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    # 🆕 284 — 283's block, added in this session's FIRST PR, which is where 253's rule
    # has said it goes since 253. 241, 282 and 283 each added it late and each paid the
    # same price: `previous_main` fell back to the block BEFORE the one being opened
    # against, `MOVED +N` was measured from the wrong endpoint, and `git.moved` refused
    # the close. Three sessions, three second PRs, three louder warnings — and the
    # warning was never the thing that was failing. `POPULATION_CURRENCY` below is what
    # runs now, so the fourth session to forget is told by a gate instead of by a
    # sentence.
    (283, """> ```
> main                 1a5eb13 — the rule no gate runs (#354)  MOVED +4
> branch 283           session283-the-names-the-engine-gave-back · PR #351
>                      🟢 PUSHED AND MERGED, 26/26 green — at the SECOND push.
>                      Two commits: the work, and the gate refusals it caused
> branch 283b          session283b-282s-block-into-block-population · PR #352
>                      🟢 253's rule, paid late for the THIRD session running
> branch 283d          session283d-the-rule-no-gate-runs · PR #354
>                      🟢 one QUEUE row — the lead this handoff first wrote as PROSE
> branch 283c          session283c-the-runtime-plane-the-crossing-dropped · PR #353
>                      🔴 PUSHED AND MERGED, 26/26 green — at the FOURTH push.
>                      Work an amend orphaned; see the section on crossing a patch
> host / addon         1.83.0 / 1.14.1  🔴 BOTH MOVED — the owed MINOR, cut here ·
>                      wire MINOR · toolchain PATCH
>                      The addon line moved THREE times inside one unpublished cut
> npm                  🟢 registry 1.82.1 · the cut is merged and NOT published ·
>                      0 open issues / 0 open PRs
> assetlib             🟢 addon 1.12.0 live · 1.14.1 submission now owed
> 🔴 WORKFLOW_RED_ELSEWHERE  sdk-drift at e65ed07 — two weeks red, see §7
> 🟢 VERIFIED AFTER THE CHANGE   932/932 · contract 31/31 · scope 74 · control 83 · 26 CI jobs
>               · instrument ok across 22 · LATE_LIVE 20/8 · 0 crashes · blast 2722
>               · late not-loaded 0 · late constructed 308/160
>               · py gates 18/6/12 · SIG 246/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 109 · 53 governed · 1682 keys · 100 shortfalls
>               · unswept 0 · exempt 40 · term 316 file(s) / 21 suffixes
>               · seal 104 · boundary 193 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3807 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4883 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 75/75 claims · handoff 450 claims
>               · error-code discipline 60 reads / 30 raise sites / 12 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (284, """> ```
> main                 5233a71 — a ruled-out entry owes no source pass (#359)  MOVED +5
> branch 284           session284-the-rule-that-runs-at-the-bump · PR #355
>                      🟢 PUSHED AND MERGED, 26/26 green — AT THE FIRST PUSH
> branch 284b          session284b-the-sweep-that-read-the-source · PR #356
>                      🟢 PUSHED AND MERGED, 26/26 green — the landscape sweep
> branch 284c          session284c-the-second-call-is-where-it-shows · PR #357
>                      🟢 PUSHED AND MERGED, 26/26 green — at the SECOND push; the
>                      tabletop plane on a real editor found the fixup
> branch 284d          session284d-a-ranked-search-is-not-a-population · PR #358
>                      🟢 PUSHED AND MERGED, 26/26 green — sdk-drift's second cause
> branch 284e          session284e-a-ruled-out-entry-owes-no-source-pass · PR #359
>                      🟢 PUSHED AND MERGED, 26/26 green — cleaning up after 284's
>                      own baselining, which made the next sweep refuse
> host / addon         1.83.0 / 1.15.0  🔴 ADDON MOVED — the write behaviour changed
>                      after the 1.14.1 stamp, so `--assert-addon` refused the commit
> npm                  🔴 registry 1.82.1 · the cut is merged and NOT published ·
>                      `npm whoami` REFUSED, the stored token is rejected — `npm login`
>                      first · 0 open issues / 0 open PRs
> assetlib             🟢 addon 1.12.0 live · 1.15.0 submission now owed
> 🟢 sdk-drift SUCCESS at 5233a71 — red since 2026-08-17, green now; all three legs
> 🟢 VERIFIED AFTER THE CHANGE   935/935 · contract 32/32 · scope 75 · control 83 · 26 CI jobs
>               · instrument ok across 22 · LATE_LIVE 20/8 · 0 crashes · blast 2730
>               · late not-loaded 0 · late constructed 309/160
>               · py gates 18/6/12 · SIG 248/105
>               · discover 54/14/14/26 · 0 exempt · 0 undeclared
>               · floor_pin 109 · 53 governed · 1696 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 317 file(s) / 21 suffixes
>               · seal 104 · boundary 193 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3852 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4893 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 75/75 claims · handoff 455 claims
>               · error-code discipline 60 reads / 30 raise sites / 12 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (285, """> ```
> main                 32f90f3 — session285 the difference field is an optional name (#360)  MOVED +1
> branch 285           session285-the-difference-field-is-an-optional-name · PR #360
>                      🟢 PUSHED AND MERGED, 26/26 green at `5621c87` — at the THIRD run
> host / addon         1.83.0 / 1.15.0  🟢 UNMOVED — no source touched under addons/
> npm                  🟢 registry 1.83.0 · untagged 1 ·
>                      0 open issues / 0 open PRs
> assetlib             🟡 addon 1.12.0 live · 1.15.0 submitted, in review —
>                      DO NOT RESUBMIT
> 🟢 CI GREEN — 26 of 26 required checks at 5621c87, third run; §9 is how
> 🟢 VERIFIED AFTER THE CHANGE   935/935 · contract 32/32 · scope 75 · control 83 · 26 CI jobs
>               · instrument ok across 23 · LATE_LIVE 21/8 · 0 crashes · blast 2746
>               · late not-loaded 0 · late constructed 310/160
>               · py gates 18/6/12 · SIG 249/105
>               · discover 56/15/15/28 · 0 exempt · 0 undeclared
>               · floor_pin 110 · 53 governed · 1712 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 319 file(s) / 21 suffixes
>               · seal 104 · boundary 193 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3852 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4928 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 75/75 claims · handoff 456 claims
>               · error-code discipline 60 reads / 30 raise sites / 12 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (286, """> ```
> main                 c6443a2 — session286 a second derivation that disagrees (#361)  MOVED +1
> branch 286           session286-a-second-derivation-that-disagrees · PR #361
>                      🟢 PUSHED AND MERGED, 26/26 green at `a3c606f` — AT THE FIRST PUSH
> host / addon         1.83.0 / 1.15.0  🟢 UNMOVED — no source touched under addons/
> npm                  🟢 registry 1.83.0 · untagged 2 ·
>                      0 open issues / 0 open PRs
> assetlib             🟡 addon 1.12.0 live · 1.15.0 submitted, in review —
>                      DO NOT RESUBMIT
> 🟢 CI GREEN — 26 of 26 required checks at c6443a2, the post-merge run
> 🟢 VERIFIED AFTER THE CHANGE   935/935 · contract 32/32 · scope 75 · control 83 · 26 CI jobs
>               · instrument ok across 23 · LATE_LIVE 21/8 · 0 crashes · blast 2806
>               · late not-loaded 0 · late constructed 313/160
>               · py gates 18/6/12 · SIG 251/105
>               · discover 56/15/15/28 · 0 exempt · 0 undeclared
>               · floor_pin 110 · 53 governed · 1714 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 319 file(s) / 21 suffixes
>               · seal 104 · boundary 193 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3852 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4928 · duration 4 sites / 2 lower / 2 guarded
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 83/83 claims · handoff 458 claims
>               · error-code discipline 60 reads / 30 raise sites / 12 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (287, """> ```
> main                 96b5d48 — session287 a reading paid for once (#362)  MOVED +1
> branch 287           session287-a-reading-paid-for-once · PR #362
>                      🟢 PUSHED AND MERGED at `b253467`, squashed to `96b5d48`
> host / addon         1.83.0 / 1.15.0  🟢 UNMOVED — no source touched under addons/
> npm                  🟢 registry 1.83.0 · untagged 3 ·
>                      0 open issues / 0 open PRs
> assetlib             🟢 addon 1.15.0 live
> 🟢 CI GREEN — run 33124129058 concluded `success` at 96b5d48, the post-merge run
> 🟢 VERIFIED AFTER THE CHANGE   935/935 · contract 32/32 · scope 75 · control 83 · 26 CI jobs
>               · instrument ok across 23 · LATE_LIVE 21/8 · 0 crashes · blast 2880
>               · late not-loaded 0 · late constructed 318/160
>               · py gates 18/6/12 · SIG 257/105
>               · discover 56/15/15/28 · 0 exempt · 0 undeclared
>               · floor_pin 112 · 53 governed · 1726 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 320 file(s) / 21 suffixes
>               · seal 104 · boundary 193 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3852 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4942 · duration 4 sites / 2 lower / 2 guarded
>               · orphan 44/44 · difference_field 28 population / 5 unreachable / 5 declared
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 83/83 claims · handoff 476 claims
>               · error-code discipline 60 reads / 30 raise sites / 12 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (289, """> ```
> main                 e270510 — the count a capped client refuses on (#363)  MOVED +1
> branch 289           session289-the-count-a-capped-client-refuses-on · PR #363
>                      🟢 PUSHED AND MERGED
> host / addon         1.83.0 / 1.15.0  🟢 UNMOVED — no source touched under addons/
> npm                  🟢 registry 1.83.0 · untagged 4 ·
>                      0 open issues / 0 open PRs
> assetlib             🟢 addon 1.15.0 live
> 🟢 CI GREEN — 26 of 26 required checks at 484d8fb, and the post-merge run at e270510
> 🟢 VERIFIED AFTER THE CHANGE   943/943 · contract 32/32 · scope 75 · control 83 · 26 CI jobs
>               · instrument ok across 23 · LATE_LIVE 21/8 · 0 crashes · blast 2905
>               · late not-loaded 0 · late constructed 320/160
>               · py gates 18/6/12 · SIG 258/105
>               · discover 56/15/15/28 · 0 exempt · 0 undeclared
>               · floor_pin 112 · 53 governed · 1735 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 323 file(s) / 21 suffixes
>               · seal 104 · boundary 193 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3852 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4963 · duration 4 sites / 2 lower / 2 guarded
>               · orphan 44/44 · difference_field 28 population / 5 unreachable / 5 declared
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 83/83 claims · handoff 484 claims
>               · error-code discipline 60 reads / 30 raise sites / 12 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (290, """> ```
> main                 8d434b2 — the previous session that shipped (#364)  MOVED +1
> branch 290           session290-the-previous-session-that-shipped · PR #364
>                      🟢 PUSHED AND MERGED at `55563ec`, squashed to `8d434b2`
> host / addon         1.83.0 / 1.15.0  🟢 UNMOVED — no source touched under addons/
> npm                  🟢 registry 1.83.0 · untagged 5 ·
>                      0 open issues / 0 open PRs
> assetlib             🟢 addon 1.15.0 live
> 🟢 CI GREEN — 26 of 26 required checks at 55563ec, and the post-merge run at 8d434b2
> 🟢 VERIFIED AFTER THE CHANGE   943/943 · contract 32/32 · scope 75 · control 83 · 26 CI jobs
>               · instrument ok across 23 · LATE_LIVE 21/8 · 0 crashes · blast 2921
>               · late not-loaded 0 · late constructed 321/160
>               · py gates 18/6/12 · SIG 259/105
>               · discover 56/15/15/28 · 0 exempt · 0 undeclared
>               · floor_pin 112 · 53 governed · 1741 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 323 file(s) / 21 suffixes
>               · seal 104 · boundary 193 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3852 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4963 · duration 4 sites / 2 lower / 2 guarded
>               · orphan 44/44 · difference_field 28 population / 5 unreachable / 5 declared
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 83/83 claims · handoff 493 claims
>               · error-code discipline 60 reads / 30 raise sites / 12 host-origin vs 56
>                 addon / 0 problems
> ```
"""),
    (291, """> ```
> main                 a50d968 — the channels a project can ship in (#365)  MOVED +1
> branch 291           session291-the-channels-a-project-can-ship-in · PR #365
>                      🟢 PUSHED AND MERGED at `09f46b3`, squashed to `a50d968`
> host / addon         1.83.0 / 1.15.0  🟢 UNMOVED — no source touched under addons/
> npm                  🟢 registry 1.83.0 · untagged 6 ·
>                      0 open issues / 0 open PRs
> assetlib             🟢 addon 1.15.0 live
> 🟢 CI GREEN — 26 of 26 required checks at 09f46b3, and the post-merge run at a50d968
> 🟢 VERIFIED AFTER THE CHANGE   943/943 · contract 32/32 · scope 75 · control 83 · 26 CI jobs
>               · instrument ok across 23 · LATE_LIVE 21/8 · 0 crashes · blast 2928
>               · late not-loaded 0 · late constructed 321/160
>               · py gates 18/6/12 · SIG 259/105
>               · discover 56/15/15/28 · 0 exempt · 0 undeclared
>               · floor_pin 112 · 53 governed · 1977 keys · 98 shortfalls
>               · unswept 0 · exempt 40 · term 323 file(s) / 21 suffixes
>               · seal 104 · boundary 193 judged / DISCOVER 9-2-0
>               · wire_diff_key 292 tools / 3852 nodes / 20 keys / 0 problems
>               · wire_invisible 34 cases · lint_ceiling 18 py
>               · taut 4963 · duration 4 sites / 2 lower / 2 guarded
>               · orphan 44/44 · difference_field 28 population / 5 unreachable / 5 declared
>               · mutlock 5 guarded / 23 cases · tree_quiet 13
>               · queue 83/83 claims · handoff 500 claims
>               · landscape 4 channel(s) / 51 analysed / 47 surfaced
>               · error-code discipline 60 reads / 30 raise sites / 12 host-origin vs 56
>                 addon / 0 problems
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
                              back: int = POPULATION_REACH_FLOOR,
                              absent: "dict[int, str] | None" = None) -> "list[str]":
    """What is wrong with how far back a block population reaches. Pure.

    🆕 290 — AND THE THIRD READER LEARNS THE SAME FACT, FOUND BY THE PR THAT TAUGHT THE
    SECOND. 288 shipped nothing and 289 wrote `BLOCK_ABSENT` for it; `population_currency`
    was taught to stop requiring its block, `tier_problems` was taught this session to
    stop requiring its verification, and THIS claim — the shape of the table itself — was
    still reading `287→289` as a hole. It surfaced the moment a session actually
    registered a block on the far side of the declared absence, which is to say in this
    row's own first commit and not one session earlier: 289 registered 287, and 287 was
    contiguous.

    🔴 A GAP IS A HOLE ONLY WHERE SOMETHING IS MISSING THAT SHOULD BE THERE. The two
    readers this claim protects — `moved_interval` and `version_interval` — scan BACKWARD
    for the last tree that MOVED, and a session that shipped no commit did not move it, so
    scanning across a declared absence reaches the same endpoint it would have reached had
    that session never opened. That is 289 §2.5's own argument for the skip, arriving at
    the reader that describes the table rather than the one that fills it.

    🔴 AND A PARTLY-DECLARED GAP IS STILL A HOLE, NAMED DOWN TO THE SESSIONS THAT ARE NOT
    DECLARED. A widened inference — *any gap next to any declaration is fine* — would be
    the hole 289 refused to open, one reader over.
    """
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
    ros = BLOCK_ABSENT if absent is None else absent
    gaps: "list[str]" = []
    for a, b in zip(sessions, sessions[1:]):
        undeclared = [n for n in range(a + 1, b) if n not in ros]
        if not undeclared:
            continue
        shown = undeclared if len(undeclared) <= 4 else undeclared[:4] + ["…"]
        gaps.append(f"{a}→{b}" + (f" (undeclared {shown})"
                                  if len(undeclared) != b - a - 1 else ""))
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
    claims = failed = unread = 0

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
                # 🆕 269 — an unbound atom this table already declares is not evidence
                # that an alias is too narrow. This claim's whole argument is that a
                # spelling the roster cannot read means the ROSTER is wrong, which holds
                # for a block written in good English and fails for 268's invented
                # counter: there is no reader because 268 added a line and no row. The
                # debt says which, so the alias does not move to accommodate it.
                if not any(a in d for d in POPULATION_SHAPE_DEBT.get(sess, ())):
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
    h_never = [k for k, *_ in HEADER_READERS
               if k not in h_reached and k not in HEADER_ALIAS_PENDING]
    if h_never:
        failed += 1
        print(f"  🔴 HEADER_ALIAS_UNUSED {h_never} — no header atom in any real block "
              f"reaches these rows")

    # 🆕 280 — AND THE OTHER DIRECTION, ON THE SAME PREDICATE `ALIAS_PENDING` USES. A
    # pending row whose key IS now reached is an exemption its own walk can see is
    # over, and a pending row naming no reader at all is a row about nothing. Neither
    # is a maintenance task: the first means the block that answers it has landed and
    # the row must go, which is the whole reason the table is allowed to exist.
    claims += 1
    h_stale = pending_problems(HEADER_ALIAS_PENDING, h_reached,
                               {k for k, *_ in HEADER_READERS})
    if h_stale:
        failed += 1
        print(f"  🔴 HEADER_ALIAS_PENDING_STALE {h_stale} — an exemption its own walk "
              f"can see is over. Delete the row; do not edit the block that ended it")
    if HEADER_ALIAS_PENDING:
        print(f"  · HEADER_ALIAS_PENDING {len(HEADER_ALIAS_PENDING)} header reader(s) "
              f"whose first block is the one being written this session: "
              f"{sorted(HEADER_ALIAS_PENDING)}")

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

    # ── 🆕 281: COUNTER_PROVENANCE — the same question, asked of the other thirty-five ─
    #
    # 🔴 THE FIXTURES COME FIRST AND THEY ARE THE POINT. On a healthy tree every reader
    # below returns [], so an inline version of any of them deletes invisibly — this
    # file's own written reason for lifting `pending_problems` out, two rosters over.
    _R = [("a", "", 1, ("python3", "a.py"), ROOT, "", CHEAP, REQUIRED, "why"),
          ("b", "", 1, ("python3", "a.py"), ROOT, "", CHEAP, REQUIRED, "why"),
          ("c", "", 1, ("node", "c.mjs"), ROOT, "", CHEAP, REQUIRED, "why")]
    claims += 1
    _got = counter_subject_problems(_R, {"a": TRACKED, "b": TRACKED, "c": TRACKED},
                                    {"a": (INDEX, ["ls-files"]), "c": (TRACKED, [])}, {})
    if not any("SUBJECT_UNDERSTATED" in g and "`a`" in g for g in _got):
        failed += 1
        print("  🔴 SUBJECT_UNDERSTATED did not fire on a row declared TRACKED whose "
              "own code reads `git ls-files` — the live direction of this whole column")
    claims += 1
    # 🔴 CARE IS NOT A DEFECT. A row declared MACHINE whose source shows only INDEX is a
    # row being cautious, and 275's `dap-late-rejection-flake` is the standing proof that
    # a grep cannot see every way a number moves. Only the UNDERSTATEMENT is refused.
    _over = counter_subject_problems(_R, {"a": MACHINE, "b": MACHINE, "c": MACHINE},
                                     {"a": (INDEX, ["ls-files"])}, {})
    if any("SUBJECT_UNDERSTATED" in g for g in _over):
        failed += 1
        print("  🔴 SUBJECT_UNDERSTATED fired on a row declared MORE strongly than its "
              "source shows — that is a careful row, not a wrong one")
    claims += 1
    # 🔴 AND THE LADDER HAS TO HOLD AT EVERY RUNG, NOT JUST THE BOTTOM ONE. This claim is
    # here because the LATE axis refused the first draft: `_stronger` was called twice and
    # both calls could be answered by a reader that told the truth once and then returned
    # False forever — *can answer ONCE and return its empty for every call after that*,
    # which is the sweep's own sentence. A third rung, above the first, is what makes a
    # collapse visible.
    _rung = counter_subject_problems(_R, {"a": INDEX, "b": INDEX, "c": INDEX},
                                     {"a": (MACHINE, ["cpu_count"])}, {})
    if not any("SUBJECT_UNDERSTATED" in g and "`a`" in g for g in _rung):
        failed += 1
        print("  🔴 SUBJECT_UNDERSTATED did not fire on a row declared INDEX whose "
              "reader's code shows MACHINE — the order is TRACKED < INDEX < CLONE < "
              "MACHINE and every rung of it is a claim")
    claims += 1
    _split = counter_subject_problems(_R, {"a": TRACKED, "b": INDEX, "c": TRACKED}, {}, {})
    if not any("SUBJECT_SPLIT" in g for g in _split):
        failed += 1
        print("  🔴 SUBJECT_SPLIT did not fire on two counters off ONE command declared "
              "two different subjects — one invocation is one reading of one world")
    claims += 1
    _ros = counter_subject_problems(_R, {"a": TRACKED, "b": TRACKED, "c": TRACKED,
                                         "gone": TRACKED}, {}, {"nope": "why"})
    if not (any("SUBJECT_STALE" in g for g in _ros)
            and any("SUBJECT_UNDERIVABLE_STALE" in g for g in _ros)):
        failed += 1
        print("  🔴 the roster halves did not both refuse: a declared key that is not a "
              "reader, and an exemption for a reader that is not there")
    claims += 1
    if counter_subject_problems(_R, {"a": TRACKED, "c": TRACKED}, {}, {}):
        # 'b' undeclared must be the ONLY complaint, and it must be one
        pass
    if not any("SUBJECT_UNDECLARED" in g and "`b`" in g
               for g in counter_subject_problems(_R, {"a": TRACKED, "c": TRACKED}, {}, {})):
        failed += 1
        print("  🔴 SUBJECT_UNDECLARED did not fire on a reader nobody classified — "
              "234 §4.8's gap is the whole reason this table exists")

    # 🔴 `code_only` IS THE READER THAT DECIDES THE POPULATION, and both of its wrong
    # answers are pinned here because both were shipped and measured before they were
    # caught. Prose about a command is not a command; an argv IS a command.
    claims += 1
    _prose_py = '# the reader runs git ls-files here\n"""and git status in a docstring"""\nx = 1\n'
    _prose_js = "// git ls-files in a comment\n/* and --porcelain in a block */\nlet x = 1;\n"
    if (subject_of(_prose_py, ".py")[0] != TRACKED
            or subject_of(_prose_js, ".mjs")[0] != TRACKED):
        failed += 1
        print("  🔴 subject_of read PROSE as a signal — 279's terminology exclusion, "
              "which excused any tracked file for NAMING a policy file")
    claims += 1
    _argv_py = 'r = subprocess.run(["git", "ls-files"], cwd=str(ROOT))\n'
    _argv_js = 'const t = run("git", ["status", "--porcelain"], REPO);\n'
    if (subject_of(_argv_py, ".py")[0] != INDEX
            or subject_of(_argv_js, ".mjs")[0] != INDEX):
        failed += 1
        print("  🔴 subject_of missed a command spelled as an ARGV LIST, which is how "
              "every reader in this tree spells one — the answer that returned TRACKED "
              "for thirteen of seventeen scripts")

    # 🔴 THE CORPUS IS THE SCRIPT PLUS ITS FIRST-PARTY IMPORTS, and `_gate_lock.py` is
    # why: six `floor_pin.*` counters and ten `instrument.*` reach `git status
    # --porcelain` only through it. A live pair, because a fixture cannot prove that the
    # helper this tree actually shares is inside the population.
    claims += 1
    _lock = ROOT / "scripts" / "_gate_lock.py"
    _fp = ROOT / "scripts" / "floor_pin_gate.py"
    if _lock.exists() and _fp.exists():
        if _lock not in reader_corpus(_fp):
            failed += 1
            print("  🔴 reader_corpus did not reach `_gate_lock.py` from a gate that "
                  "imports it — the helper where the index is actually read")
        if subject_of(_fp.read_text(encoding='utf-8', errors='replace'), ".py")[0] != TRACKED:
            failed += 1
            print("  🔴 floor_pin_gate.py's OWN bytes should show no index signal — if "
                  "they do, this claim's pair below proves nothing about the corpus")
        _joined = "\n".join(p.read_text(encoding='utf-8', errors='replace')
                            for p in reader_corpus(_fp))
        if subject_of(_joined, ".py")[0] != INDEX:
            failed += 1
            print("  🔴 the corpus of floor_pin_gate.py does not show INDEX, so either "
                  "the shared lock stopped taking a `git status` baseline or the walk "
                  "stopped reaching it. Both are findings; neither is green")

    # 🔴 AND THE TWO READERS THAT DECIDE WHICH FILE IS EVEN LOOKED AT. A blinded
    # `reader_source` points the derivation at nothing and a blinded `derive_subjects`
    # hands `counter_subject_problems` an empty map — both of which make every claim
    # above pass, because a comparison with no left-hand side agrees with everything.
    claims += 1
    if (reader_source(("python3", "../scripts/x.py"), HOST) != (ROOT / "scripts" / "x.py")
            or reader_source(("npm", "test"), HOST) is not None):
        failed += 1
        print("  🔴 reader_source did not resolve a script relative to the row's own "
              "`cwd`, or claimed one for a command that names none")
    claims += 1
    _live = derive_subjects(COUNTER_READERS, SUBJECT_UNDERIVABLE)
    if _live.get("instrument.blast", ("", []))[0] != INDEX:
        failed += 1
        print(f"  🔴 derive_subjects reads `instrument.blast` as "
              f"{_live.get('instrument.blast')} — the counter three sessions have had to "
              f"correct from a local reading to CI's at the same commit is the one this "
              f"whole column was opened over, and INDEX is the answer its reader's code "
              f"gives")
    claims += 1
    # 🔴 READ TWICE, OVER A TREE THAT DID NOT MOVE, AND THE SECOND READ IS THE CLAIM.
    # 246's collapse and the LATE axis's whole premise are the same shape: a reader that
    # answers once and empties afterwards passes every table checked on its first call.
    # Nothing about this tree changes between these two lines, so a disagreement is the
    # reader, not the world.
    _again = derive_subjects(COUNTER_READERS, SUBJECT_UNDERIVABLE)
    if _again != _live or not _again:
        failed += 1
        print(f"  🔴 derive_subjects gave two different answers about one unchanged "
              f"tree ({len(_live)} row(s) then {len(_again)}) — a derivation that "
              f"answers once and collapses is green everywhere it is read once")

    # 🔴 A VALUE NOTHING CARRIES IS A PREDICATE THAT CANNOT BE WRONG — 276, and the
    # reason `subject_coverage` is asked of the LIVE table on every close.
    # 🔴 THE SILENT DIRECTION GOES FIRST, DELIBERATELY. Under the LATE axis a reader is
    # allowed to answer once and return its empty forever after, so a table whose only
    # must-COMPLAIN claim is the first call is a table a collapsed reader passes. The
    # must-be-silent case is the cheap call to spend on rung one.
    claims += 1
    if subject_coverage({}):
        failed += 1
        print("  🔴 subject_coverage complained about an EMPTY table — a pure reader "
              "handed a subset must answer about the subset (280 §4)")
    claims += 1
    if not subject_coverage({"a": TRACKED}):
        failed += 1
        print("  🔴 subject_coverage was silent about a table carrying one of four "
              "values — a value no row answers is a column with no population")
    claims += 1
    if not subject_coverage({"a": TRACKED, "b": INDEX, "c": CLONE_CFG}):
        failed += 1
        print("  🔴 subject_coverage was silent about a table missing only MACHINE — "
              "three of four is still a value nothing answers")

    # Both directions against the reader roster, exactly as PROVENANCE is checked above.
    claims += 1
    _ck = {r[0] for r in COUNTER_READERS}
    _miss = sorted(_ck - set(COUNTER_PROVENANCE))
    _stale = sorted(k for k in COUNTER_PROVENANCE if k not in _ck)
    if _miss or _stale:
        failed += 1
        print(f"  🔴 COUNTER_PROVENANCE missing {_miss}, stale {_stale} — 234 §4.8's "
              f"gap, on the half `PROVENANCE` was never asked of")

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

    # ── 🆕 287 — THE FENCE ITSELF, AND THE THREE STATES THE FALLBACK COLLAPSED ────────
    #
    # 🔴 `blocks[-1] if blocks else text` MADE *NO FENCE* AND *A FENCE CONTAINING THE
    # WHOLE DOCUMENT* THE SAME INPUT, and 285's close is what that costs: 135 problems,
    # 122 of them prose lines graded as commands, and the thirteen real ones underneath.
    # Four directions, because three of them must NOT refuse — a document that runs the
    # gate without `--measured` and one that names no gate at all are both notes, and
    # they are different notes.
    claims += 1
    _prose_only = ("§7 then says: run `python3 ../scripts/handoff_gate.py "
                   "../HANDOFF_SESSION285.md --measured ci285/ --network` on his Mac.\n"
                   "\n```bash\nnpm test | tail -20 > run.log\n```\n")
    _po = replay_problems(_prose_only)
    _has = replay_problems(_fence)
    _quiet = replay_problems("this document names no gate and runs nothing")
    _nomeas = replay_problems("```bash\npython3 handoff_gate.py --selftest\n```")
    if (not any("REPLAY_FENCE_MISSING" in p for p in _po[0])
            or any("REPLAY_FENCE_MISSING" in p for p in _has[0])
            or _quiet[0] or _nomeas[0]
            or not any("prints no `handoff_gate.py` invocation" in n for n in _quiet[1])
            or not any("no `--measured`" in n for n in _nomeas[1])):
        failed += 1
        print(f"  🔴 REPLAY_FENCE prose={_po[0][:1]} fenced={_has[0][:1]} "
              f"quiet={_quiet} nomeasured={_nomeas} — a `--measured` invocation that "
              f"appears ONLY in prose is a document with no replay, and the two silent "
              f"states are notes with different reasons")

    # 🔴 AND THE DEPENDENT READERS MUST STAY SILENT, WHICH IS THE HALF THAT MAKES THE
    # REFUSAL READABLE. Each of them compares a roster derived FROM the fence against one
    # derived from the workflows, so on a fence-less document every CI command reads as
    # missing from the replay — one omission and fifty findings, which is the arithmetic
    # this whole change exists to stop.
    claims += 1
    _nf_ci = replay_ci_problems(_prose_only, _CI, floor=4, exempt={})
    _nf_flag = replay_ci_flag_problems(_prose_only, {"python3 a.py": {"ci.yml"}},
                                       exempt={}, floor=1)
    if (_nf_ci[0] or _nf_flag[0]
            or not all(any("NOT COMPARED" in n for n in x[1])
                       for x in (_nf_ci, _nf_flag))):
        failed += 1
        print(f"  🔴 REPLAY_FENCE_CASCADE ci={_nf_ci} flags={_nf_flag} — with no fence "
              f"these two readers have nothing to compare, and a reader that restates "
              f"another reader's refusal fifty times buries it")
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
    # 🆕 280 — THE POPULATION OF THIS CLAIM IS DERIVED AND NOT ASSUMED, which is 279's
    # finding turned on this file's own self-test. 234's header is a SHIPPED block and
    # may not be edited, so it carries exactly the REMOTE rows that existed when it was
    # written; a claim asserting the whole REMOTE set against it fails the moment a
    # REMOTE row is added, and reads as the new row being broken rather than as the
    # fixture being silent about it. The rows this fixture can speak for are the ones
    # it BINDS; the ones it cannot are driven below over a fixture that does.
    _bound_here = {k for k, alias, *_ in HEADER_READERS
                   if any(re.search(alias, c, re.I) for _r, c in h_atoms)}
    if not (_remote & _bound_here) <= _named:
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

    # ── 🆕 271 §1 — `block-claims-a-count-its-own-read-could-not-make` (OPEN 270) ──────
    #
    # 🔴 EVERY UNREAD ROW ABOVE IS ALSO A REFUSAL NOW, and the two claims below are the
    # same fixture read twice. The one directly above asserts that the REMOTE rows go
    # UNREAD offline; this one asserts that going UNREAD while the block TYPED A NUMBER
    # is a problem and not a note. 269's block is the negative example and it is not
    # hypothetical: `0 open issues`, accepted, over a user's bug report that had been
    # open for hours.
    claims += 1
    _uc = {x.split()[2] for x in _hp if x.startswith("🔴 HEADER_UNREAD_CLAIMED")}
    # 🆕 280 — SAME DERIVED POPULATION AS THE CLAIM ABOVE, AND FOR THE SAME REASON.
    # A block cannot fail to refuse a claim it never made: 234's npm row carries no
    # `untagged` segment, so asserting the whole REMOTE set here would report the
    # NEW row as broken on the run that added it. `npm.untagged` is driven against a
    # fixture that does claim it, below.
    if not (_remote & _bound_here) <= _uc:
        failed += 1
        print(f"  🔴 HEADER_UNREAD_CLAIMED {sorted((_remote & _bound_here) - _uc)} went UNREAD against a "
              f"block that claims a number for each of them and produced no problem — "
              f"which is the state 270 shipped in: the reader was right, the note was "
              f"printed, and the claim was accepted beside it")

    # 🔴 AND THE OTHER DIRECTION, WHICH IS THE HALF THAT KEEPS THE RULE HONEST: an
    # environment that cannot read is not being refused, a BLOCK THAT CLAIMS is. The
    # fixture is 249's own npm row — the session that met this exactly, wrote
    # ``gh UNREAD, no `gh` in this container``, and shipped a block with no numeral where
    # the counter goes. It binds no atom, so there is nothing to compare and nothing to
    # refuse, and it must stay that way or the rule becomes "own a `gh`".
    claims += 1
    _honest = [ln for ln in REAL_HEADER.strip("\n").split("\n")
               if not ln.startswith("> npm ")]
    _honest.insert(5, "> npm                  🟢 1.74.0 · lag UNREAD · tags UNREAD · gh "
                      "UNREAD, no `gh` in this container")
    _hp2, _hn2, _ha2, _hc2 = check_header(_honest, "", False, 234)
    _uc2 = {x.split()[2] for x in _hp2 if x.startswith("🔴 HEADER_UNREAD_CLAIMED")}
    if _uc2 & {"npm.lag", "npm.tags", "gh.issues", "gh.prs"}:
        failed += 1
        print(f"  🔴 HEADER_UNREAD_CLAIMED refused {sorted(_uc2)} on a block that made no "
              f"claim — a row spelled UNREAD carries no numeral, so it is not an atom and "
              f"there is nothing to compare. Refusing it would make this rule a "
              f"requirement to own a network rather than a requirement to be honest")

    # ── 🆕 280 — `untagged-count-unbound` (279), DRIVEN IN FOUR DIRECTIONS ──────────
    #
    # 🔴 THE ROW 279's BLOCK WAS REFUSED FOR TRYING TO STATE. 234's header predates
    # the counter and cannot speak for it, and it is a shipped document nobody may
    # edit — so the fixture is that header with the segment the npm row should have
    # been carrying since 269. Offline on purpose, like every claim around it.
    _u_lines = [ln for ln in REAL_HEADER.strip("\n").split("\n")
                if not ln.startswith("> npm ")]
    _u_lines.insert(5, "> npm                  🟢 1.74.0 · lag 0 · untagged 4 · tags 121")
    _up, _un, _ua, _uc3 = check_header(_u_lines, "", False, 234)
    # 🔴 `check_header` RETURNS A COUNT OF ATOMS AND `header_atoms` RETURNS THE
    # ATOMS. The first draft of this claim read the count as the list, and python
    # said so loudly — which is the cheap direction. The expensive one is a reader
    # that iterates something plausible and reports agreement.
    _u_block, _ = status_block("\n".join(_u_lines))
    _u_atoms, _ = header_atoms(_u_block)
    _u_bound = {k for k, alias, *_ in HEADER_READERS
                if any(re.search(alias, c, re.I) for _r, c in _u_atoms)}

    claims += 1
    if "npm.untagged" not in _u_bound:
        failed += 1
        print("  🔴 HEADER_UNTAGGED_UNBOUND `untagged 4` on the npm row binds to no "
              "reader — which is the exact refusal 279's block took on the first "
              "block that ever tried to print the number, and the row this claim "
              "exists to keep closed")

    claims += 1
    if "npm.untagged" not in {n.split(":", 1)[0] for n in _un if "UNREAD" in n}:
        failed += 1
        print("  🔴 HEADER_UNTAGGED_OFFLINE `npm.untagged` answered itself with no "
              "log and no socket while declared REMOTE — the denominator is origin's "
              "tag list, and a reader that finds it in the tree is reading the disk")

    claims += 1
    if "npm.untagged" not in {x.split()[2] for x in _up
                              if x.startswith("🔴 HEADER_UNREAD_CLAIMED")}:
        failed += 1
        print("  🔴 HEADER_UNTAGGED_CLAIMED the block typed a number for `untagged` "
              "and the reader went UNREAD beside it without refusing — 271 §1's "
              "shape, on the counter that says whether a release is owed")

    # 🔴 AND THE NEGATIVE CONTROL, BECAUSE `untagged` CONTAINS `tags`. `npm.tags`'s
    # alias is `\btags?\b` and it is one word boundary away from swallowing this row;
    # a single reader answering both would compare the wrong number against the wrong
    # claim and report agreement. `HEADER_AMBIGUOUS` above asks this of 234's atoms,
    # which do not include an `untagged` one — so it is asked again here, of a block
    # that carries both words on one line.
    claims += 1
    _u_amb = [(raw, [k for k, alias, *_ in HEADER_READERS
                     if re.search(alias, cleaned, re.I)])
              for raw, cleaned in _u_atoms]
    if any(len(hits) != 1 for _raw, hits in _u_amb):
        failed += 1
        print(f"  🔴 HEADER_UNTAGGED_AMBIGUOUS {_u_amb} — `lag 0`, `untagged 4` and "
              f"`tags 121` on one row must bind to exactly three readers, one each")

    # 🔴 THE EMITTER AND THE ROSTER, JOINED — the join `npm.lag` did not have for twelve
    # sessions (241 §1). `GH_OPEN_ISSUES` has been an `extract` since 236 and nothing in
    # the tree printed it, so the pattern could have been renamed on either side without a
    # single test noticing. The claim runs the emitter's own format string against the
    # roster's own regex; it does not dial, because the shape is what is being asserted.
    claims += 1
    _unjoined = []
    for _k, _kind, _label in GH_EMIT:
        _row = next((r for r in HEADER_READERS if r[0] == _k), None)
        if _row is None or re.match(_row[3], f"{_label} 7") is None:
            _unjoined.append(f"{_label} -> {_k}")
    if _unjoined:
        failed += 1
        print(f"  🔴 GH_EMIT_JOIN {_unjoined} — the line `--gh-open` prints is not the "
              f"line `HEADER_READERS` extracts. An emitter and a reader that agree only "
              f"by coincidence are 236's `extract` with a producer bolted on")

    # 🆕 272 — THE SAME JOIN FOR THE ASSET LIBRARY, and it is asserted rather than assumed
    # for the reason the row above exists: `ASSETLIB_VERSION` is printed in one function
    # and matched in another, with nothing between them. It is NOT a `HEADER_READERS` row —
    # a dotted version is not a counter and `COUNTER_RE` refuses it by design (244 §3) — so
    # the reader lives inline in `check_header` and this claim reaches into that source
    # rather than into the roster.
    claims += 1
    _al_src = inspect.getsource(check_header)
    _al_emit = "ASSETLIB_VERSION {v}"
    _al_pat = re.search(r'r"(\^ASSETLIB_VERSION[^"]*)"', _al_src)
    if _al_pat is None or re.match(_al_pat.group(1), "ASSETLIB_VERSION 1.11.0") is None:
        failed += 1
        print(f"  🔴 ASSETLIB_EMIT_JOIN the line `--gh-open` prints ({_al_emit!r}) is not "
              f"the line `check_header` extracts. Same defect class as GH_EMIT_JOIN above, "
              f"on the claim 270 paid a day for")
    # And the emitter must still be printing it — a join proved against a producer that
    # was deleted is 236's `extract` with nothing behind it, which is the whole lesson.
    claims += 1
    if "ASSETLIB_VERSION" not in inspect.getsource(gh_emit):
        failed += 1
        print("  🔴 ASSETLIB_EMIT_ABSENT `--gh-open` no longer prints ASSETLIB_VERSION, so "
              "the only route to that reading outside `--network` is gone and every "
              "offline run must answer UNREAD")

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

    # ── 🆕 292 §5 — AN ALL-DIGIT SHA IS A SHA, AND A COUNTER BESIDE ONE IS STILL A COUNTER
    #
    # 🔴 THE POSITIVE CASE IS 292's OWN CLOSE, VERBATIM. `5155079` is the commit this
    # session merged at: seven characters, every one a digit, and git resolves it. Before
    # the `HEADER_EXEMPT` row above, this atom carried TWO numbers and `git.moved` refused
    # with *the block says [5155079, 1], the tree says [1]* — the SHA counted as a claim.
    # A hex SHA with a letter in it (`a50d968`, 291's) must reach the same answer, because
    # the two spell one kind of thing and only luck ever told them apart.
    claims += 1
    _digit_sha, _ = header_atoms(["main   5155079 — the price of being unread (#367)  MOVED +1"])
    _hex_sha, _ = header_atoms(["main   a50d968 — the channels a project can ship in (#365)  MOVED +1"])
    if not (len(_digit_sha) == len(_hex_sha) == 1
            and re.findall(r"\d+", _digit_sha[0][1]) == re.findall(r"\d+", _hex_sha[0][1])
            == ["1"]):
        failed += 1
        print(f"  🔴 an all-digit commit SHA is read as a counter — the `main` row "
              f"{_digit_sha!r} does not reduce to the same single claim as {_hex_sha!r}. "
              f"A block whose merge commit happens to be all digits (one session in "
              f"twenty-seven) cannot bind, and it finds that out at the close")

    # 🔴 AND THE NEGATIVE CONTROL, WHICH IS THE HALF THAT CAN BE WRONG. An exemption wide
    # enough to eat a SHA must not eat the counter standing next to it: the `CI GREEN` row
    # carries a SHA AND a count in one atom, and the four-digit counters (`taut 4963`) are
    # the ones a width test could plausibly reach. Both survive, or this row protects the
    # block by deleting what the block says.
    claims += 1
    _beside, _ = header_atoms(["main   26 of 26 required checks at 467fcb4",
                               "taut   4963 claim sites at 5155079"])
    _nums = [n for _r, c in _beside for n in re.findall(r"\d+", c)]
    if _nums != ["26", "26", "4963"]:
        failed += 1
        print(f"  🔴 the SHA exemption ate a counter beside a SHA: kept {_nums}, want "
              f"['26', '26', '4963']. A row that removes the claim it was written to "
              f"protect is worse than the refusal it replaces")

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

    # ── 🆕 277 §1 — `all()` OVER AN EMPTY SEQUENCE IS TRUE, AND THAT IS NOT WHAT `have`
    # MEANS. `ends` is short whenever the parse above failed, and a vacuous `have` sent
    # this reader straight down the branch that asserts a NUMBER — the one thing the
    # paragraph above says it must never do without the objects in hand — and then indexed
    # `ends[0]` at `MOVED_PARENT` and took every claim below that line down with it.
    #
    # 🔴 MEASURED UNDER THE BLIND, NOT REASONED ABOUT (277 §1): emptying `main_shas`,
    # `_runs` or `status_block` reddens four claims here and then dies with an
    # `IndexError`, so ~200 claims further down went unrun and the command reported a
    # traceback where its verdict line belongs. A parse failure is not a shallow clone: it
    # is a THIRD state this reader did not have, and the two claims that rest on the parse
    # are refused by name rather than skipped, invented, or crashed into.
    parsed = len(ends) == 2
    have = parsed and all(
        subprocess.run(("git", "cat-file", "-e", f"{s}^{{commit}}"), cwd=ROOT,
                       capture_output=True).returncode == 0 for s in ends)
    claims += 1
    got_moved, moved_why = moved_interval(real_block, 234)
    if not parsed:
        failed += 1
        print(f"  🔴 MOVED_ENDPOINTS {ends} — the main row yielded {len(ends)} SHA(s) and "
              f"both claims here need two. Refused rather than skipped: `all()` over an "
              f"empty sequence is True, so a vacuous `have` would send the branch below "
              f"into asserting a number with no objects to read it from")
    elif have and (moved_why or got_moved != 1):
        failed += 1
        print(f"  🔴 MOVED_LIVE {moved_why or got_moved}, pinned 1 — 233's block puts "
              f"main at c27953d and 234's at bcc0b85, so the session moved it once")
    elif not have and (not moved_why or got_moved != -1):
        failed += 1
        print(f"  🔴 MOVED_SHALLOW {got_moved}/{moved_why!r} — a checkout missing an "
              f"endpoint must make this UNREAD with the reason, not a number: a shallow "
              f"clone is a fact about the machine and the claim is about the interval")

    # 🔴 AND THE CLAIM THE OLD READER WAS REALLY MAKING, NOW MAKING IT ON ITS OWN. The
    # continuation line is the main SHA's parent — true of every block, and the only
    # thing `rev-list old..new` over one row was ever able to test. As its own claim it
    # can fail; as a counter it could not.
    claims += 1
    if parsed and have:
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
    # 🆕 275 — THE LOOP RUNS OVER THE POPULATION AND NOT OVER WHAT THE CHECKOUT COULD
    # MEASURE, AND THAT IS THE WHOLE FIX. It used to iterate `_true`, which is EMPTY on a
    # `--depth 1` clone — so this file's own claim count was six lower in the `test` job
    # than in `contract-check`, which fetches full history for check 4. 274's
    # `MEASURED_LEG_DISAGREEMENT` found it on the first real download: `handoff.claims`
    # read 366 from one artifact and 360 from the other three, at one commit, and a status
    # block carrying either number was true in one job and false in three. The counter was
    # a fact about the CHECKOUT DEPTH wearing the shape of a fact about the tree, which is
    # 239 §5.2's class exactly — measured, at last, rather than promised. `unmoved_blocks`
    # is derived from the block TEXT, so the count below is the same in every environment
    # and what a shallow store cannot measure is named UNREAD instead of subtracted in
    # silence.
    for _s in unmoved_blocks:
        claims += 1
        if _s not in pop_moved:
            unread += 1
            continue
        if pop_moved[_s] != 0:
            continue          # a FALSE `UNMOVED`, already refused by the claim above
        _txt = next(txt for ss, txt in BLOCK_POPULATION if ss == _s)
        _p, _n, _a, _c = check_header(status_block(_txt)[0], "", False, _s)
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
    # ── 🆕 290 — A DECLARED ABSENCE IS NOT A HOLE, AND THE PAIR IS ON ONE FIXTURE ──────
    #
    # 289 §2.5's argument reaching the third reader. The two sessions below are the live
    # ones — 287 shipped, 288 declared, 289 shipped — so this asserts the table this file
    # actually carries rather than a shape invented to agree with the change.
    claims += 1
    _absent_pair = [(287, ""), (289, "")]
    if any("POPULATION_CONTIGUOUS" in p
           for p in population_reach_problems(_absent_pair, back=287,
                                              absent={288: "declared"})):
        failed += 1
        print("  🔴 POPULATION_CONTIGUOUS_ABSENT 287→289 was called a hole with 288 "
              "declared absent — the declaration says the tree did not move, and both "
              "readers this claim protects scan backward for the last tree that DID")
    claims += 1
    if not any("POPULATION_CONTIGUOUS" in p
               for p in population_reach_problems(_absent_pair, back=287, absent={})):
        failed += 1
        print("  🔴 POPULATION_CONTIGUOUS_ABSENT the SAME gap was accepted with nothing "
              "declared, so the roster is decorative and any session could open a hole "
              "by not registering a block")
    # 🔴 AND A PARTLY-DECLARED GAP IS STILL A HOLE. A reader that waved through any gap
    # touching any declaration would be the widened inference 289 refused to write.
    claims += 1
    _partial = population_reach_problems([(287, ""), (291, "")], back=287,
                                         absent={288: "d", 290: "d"})
    if not any("POPULATION_CONTIGUOUS" in p and "289" in p for p in _partial):
        failed += 1
        print(f"  🔴 POPULATION_CONTIGUOUS_PARTIAL a gap with 288 and 290 declared and "
              f"289 undeclared must still be refused, and must name 289: {_partial}")

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
        # 🆕 269 — a block whose omission is DECLARED in `POPULATION_SHAPE_DEBT` is not
        # evidence that the boundary is wrong. This claim reads a missing counter as *the
        # SINCE row was set too early*, which is the right reading for a block that
        # predates the counter and the wrong one for a block that simply dropped it: 268
        # is the second, it is written down as the second, and letting it argue here would
        # make the roster move to accommodate a defect.
        missing = sorted(s for s, ks in carried.items()
                         if s >= n and key not in ks
                         and not any(f"`{key}`" in d
                                     for d in POPULATION_SHAPE_DEBT.get(s, ())))
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
    # 🆕 269 — TEN BECAME ELEVEN. `contract.error_codes` is declared `SINCE(269)` and not
    # flat REQUIRED, because 268 IS in the population and DOES carry the line — in a
    # three-number spelling this reader's extract does not read. A flat row would refuse
    # the block that introduced the counter, which is the exact failure mode the boundary
    # convention exists for and the reason the pin moves in the commit that adds the row.
    # 🆕 275 — ELEVEN BECAME TWELVE. `taut.duration` is `SINCE(275)` for the plainest
    # version of the reason: the line it reads is printed for the first time by the commit
    # that adds the row, so every block in the population predates the counter.
    # 🆕 287 — TWELVE BECAME FOURTEEN, and these two are the version of that reason where
    # the line was ALREADY being printed and no block had ever bound it. `taut.orphan`
    # has been in `tautology_gate.mjs`'s output since 258; 285 restated it and its pair
    # by hand, nothing compared either, and 286 dropped both to get the close green
    # (§1.3). The counter is not new — the ROW is, so 287 is the first block that can
    # carry them and the pin moves in the commit that adds them.
    # 🆕 291 — FOURTEEN BECAME FIFTEEN, and `landscape.roster` is the plainest version of
    # 275's reason: `assetlib_sweep.py --census` prints `LANDSCAPE_CENSUS` for the first
    # time in the commit that adds the row, so every block in the population predates the
    # counter and a flat `REQUIRED` would refuse all sixty-three of them.
    if len(since_rows) != 15:
        failed += 1
        print(f"  🔴 SINCE_ROWS {len(since_rows)} row(s) carry a boundary, pinned 15 — "
              f"237 §3 measured six, 246 added four, 269 added one, 275 added one, 287 "
              f"added two and 291 added one; the table is the only record of which")
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

    # ── 🆕 290 — THE PREDECESSOR RESOLVES THROUGH `BLOCK_ABSENT` (289 §3.4) ────────────
    #
    # 289 taught `population_currency` that a session which shipped nothing owes no
    # block, and left the same assumption standing, unasked, in the reader above: *the
    # previous session* meant `session - 1` whatever the roster said. With 288 declared
    # absent, block 289 inheriting from 287 IS inheriting from its predecessor — nothing
    # happened in between — and 289 paid a full replay to a refusal that was reading a
    # gap where there was a declaration.
    #
    # 🔴 THE FIXTURE IS THE SESSION THAT FOUND IT, NOT AN INVENTED ONE. The log line
    # below is the one `ci289/open-tier.log` actually carried and 96b5d48 is what
    # `BLOCK_POPULATION` gives for block 287, so the positive arm asserts the real close
    # this reader refused rather than a shape written to agree with the fix.
    ABSENT_LOG = ("HANDOFF_OPEN HANDOFF_SESSION287.md · TIER0 · 37 counter atom(s) "
                  "INHERITED FROM 287 AT 96b5d48 · 4 header atom(s) · 7 re-read\n")
    # 🔴 AND THE PAIR IS ON ONE FIXTURE, WHICH IS 289 §2.5's OWN ARGUMENT REUSED: a
    # resolver that skipped every hole and a resolver that refused every hole each
    # satisfy exactly one of these two, and only the correct one satisfies both.
    claims += 1
    got, notes = tier_problems("ritual TIER0", ABSENT_LOG, 289, {288: "declared"})
    if got:
        failed += 1
        print(f"  🔴 TIER0_ABSENT_PAIR a block inheriting ACROSS a declared absence was "
              f"still refused, so the declaration is not a route and 289's replay was "
              f"owed after all: {'; '.join(p[:110] for p in got)}")
    elif not any("declared absent" in n for n in notes):
        failed += 1
        print("  🔴 TIER0_ABSENT_SILENT the resolution stepped over a declared absence "
              "and the note did not say so — a skip nobody can read is a skip nobody can "
              "disagree with")
    claims += 1
    got, _n = tier_problems("ritual TIER0", ABSENT_LOG, 289, {})
    if not any("TIER0_PREDECESSOR" in p for p in got):
        failed += 1
        print("  🔴 TIER0_ABSENT_PAIR the SAME missing session was clean with no "
              "declaration at all, so the roster is decorative and any session could "
              "open a hole by inheriting past one")

    # 🔴 INHERITING *FROM* A DECLARED ABSENCE IS THE OTHER DIRECTION AND IT IS NOT THE
    # SAME MISTAKE. 288 published no block, so a block claiming to have inherited 288's
    # verification is claiming to have inherited nothing — `block_main` would answer
    # UNCHECKED and the counters would ride on a tree no instrument ever read.
    claims += 1
    got, _n = tier_problems("ritual TIER0",
                            ABSENT_LOG.replace("FROM 287 AT 96b5d48", "FROM 288 AT 96b5d48"),
                            289, {288: "declared"})
    if not any("TIER0_PREDECESSOR" in p for p in got):
        failed += 1
        print("  🔴 TIER0_ABSENT_SOURCE a block inherited FROM a session declared to have "
              "left no tree and nothing refused — the tier's evidence is a block that "
              "does not exist")

    # and the ordinary two-back hole stays refused whichever roster is passed, because a
    # resolver keyed on the roster must not go quiet on the case that has no roster at all
    for ros, why in [({}, "with an empty roster"), (None, "with the module's own roster")]:
        claims += 1
        got, _n = tier_problems("ritual TIER0", TIER0_LOG.replace("FROM 238", "FROM 236"),
                                239, ros)
        if not any("TIER0_PREDECESSOR" in p for p in got):
            failed += 1
            print(f"  🔴 TIER0_PREDECESSOR inheriting from two sessions back passed "
                  f"{why}, and neither 237 nor 238 is declared absent")

    # ── 🆕 269: THE SHIPPED BLOCKS, JUDGED BY THE RULES THEY WERE WRITTEN UNDER ───────
    #
    # 🔴 THE ONE DOCUMENT EVERY SESSION STANDS ON WAS THE ONE ARTIFACT NO GATE EVER READ,
    # and 268's block is the evidence: it dropped three REQUIRED counters, carried one
    # header atom against a floor of two, invented a counter that binds to no reader, and
    # abbreviated a replay list 248 had already written a rule about. Every one of those
    # is refused by the close path in this file. None of them was refused, because
    # `HANDOFF*.md` is gitignored — CI cannot see it — and the replay runs `--selftest`
    # and `--patterns`, which prove this gate's predicates on fixtures rather than
    # pointing it at the block being written. The close path's real first reader is the
    # NEXT session, at pickup, after the block has been published and acted on.
    #
    # `BLOCK_POPULATION` is the repair, and it was already here. 253's rule copies each
    # block into this tree one session after it ships, so CI can read it from then on.
    # The guarantee is one session of lag and it is stated rather than papered over —
    # running the close gate on your own handoff before shipping it is still the ritual's
    # job, and §7.1 says so now.
    claims += 1
    shape = population_block_shape()
    if shape:
        failed += 1
        print(f"  🔴 POPULATION_SHAPE {len(shape)} problem(s) in shipped blocks: "
              + "; ".join(p[:140] for p in shape[:4]))
    # 🔴 AND THE POSITIVE CONTROL, because a reader that judged nothing would print the
    # same green. A block with its counter line emptied to a single unbound atom must be
    # refused on all three arms at once — the class 268 shipped, constructed here so the
    # reader cannot pass by looking at an empty population.
    claims += 1
    _mutant = [(POPULATION_SHAPE_FROM, "> ```\n> 🟢 VERIFIED   nonsense 7 widgets\n> ```\n")]
    _real, globals()["BLOCK_POPULATION"] = BLOCK_POPULATION, _mutant
    _real_debt, globals()["POPULATION_SHAPE_DEBT"] = POPULATION_SHAPE_DEBT, {}
    try:
        _got = population_block_shape()
    finally:
        globals()["BLOCK_POPULATION"] = _real
        globals()["POPULATION_SHAPE_DEBT"] = _real_debt
    if not any("binds to NO reader" in p for p in _got) \
            or not any("dropped" in p for p in _got) \
            or not any("header atom" in p for p in _got):
        failed += 1
        print(f"  🔴 POPULATION_SHAPE_CONTROL a block claiming one unbound atom and "
              f"nothing else was not refused on all three arms: {_got[:3]}")

    # ── 🆕 284 — `POPULATION_CURRENCY`, and it runs HERE because here is where CI runs ──
    #
    # The shape reader above judges the blocks that ARE in the table. This one judges the
    # blocks that are NOT — the direction 253's rule is about, and the one nothing has
    # ever read. It is a claim about the live tree rather than a fixture, exactly like
    # `POPULATION_SHAPE`, and it is cheap: one regex over `QUEUE.md` and a set difference.
    claims += 1
    _cur = population_currency()
    if _cur:
        failed += 1
        print("  " + _cur[0][:400])
    # 🔴 AND THE POSITIVE CONTROL IS THE INSTANCE, NOT A SHAPE. Drop the newest block and
    # advance the head by one — the exact tree 241, 282 and 283 each shipped — and this
    # reader must name that session. A control that only proved "some missing block is
    # refused" would pass over a reader that reported the OLDEST gap, which is the answer
    # that reads as history rather than as this session's own first action.
    claims += 1
    _newest = max(s for s, _ in BLOCK_POPULATION)
    _thinned = [(s, b) for s, b in BLOCK_POPULATION if s != _newest]
    _ctl = population_currency(head=_newest + 1, population=_thinned)
    if not _ctl or f"session {_newest} has SHIPPED" not in _ctl[0]:
        failed += 1
        print(f"  🔴 POPULATION_CURRENCY_CONTROL a tree calling itself session "
              f"{_newest + 1} with {_newest}'s block missing was not refused by name: "
              f"{_ctl[:1]}")
    # 🔴 AND THE OTHER DIRECTION, because a reader that refused everything would satisfy
    # the control above and stop every session at its pickup. A tree whose head is the
    # newest block PLUS nothing — the pristine pickup state, where the block being opened
    # against is correctly absent — must be CLEAN.
    claims += 1
    if population_currency(head=_newest, population=_thinned):
        failed += 1
        print("  🔴 POPULATION_CURRENCY_PICKUP the pristine pickup state was refused — "
              "a session does not register its own block, and demanding it here would "
              "refuse every opening this apparatus has")
    # 🔴 AND THE HEAD READER'S OWN BLIND. `instrument_gate.py` empties `queue_head` to
    # `(0, "")` and asks whether anything reddens. `range(233, 0)` is empty, so the first
    # draft answered CLEAN over a tree it had learned nothing about — a requirement
    # derived from an unreadable number, reported as a green. This is the claim that
    # keeps the blind red.
    claims += 1
    _blind = population_currency(head=0)
    if not _blind or "checked nothing" not in _blind[0]:
        failed += 1
        print(f"  🔴 POPULATION_CURRENCY_HEAD an unreadable head was turned into an EMPTY "
              f"requirement and reported clean, which is the reader going quiet rather "
              f"than the tree being right: {_blind[:1]}")

    # ── 🆕 289 — `BLOCK_ABSENT`, THE ONLY ROUTE PAST THE READER ABOVE ────────────────
    #
    # 🔴 THE ROSTER IS DRIVEN, NOT ASSERTED. It is the one way a session can satisfy
    # `POPULATION_CURRENCY` without registering a block, so every arm that admits and
    # every arm that refuses runs here on a fixture — 273 §2's rule, and the reason a
    # roster whose refusals have never executed is a roster nobody has.
    claims += 1
    if block_absent_problems(head=queue_head()[0]):
        failed += 1
        print("  " + block_absent_problems(head=queue_head()[0])[0][:300])
    # The pair that makes the roster meaningful rather than permissive: the SAME hole is
    # clean when declared and refused when not. A reader that skipped every gap would
    # satisfy the first half alone.
    claims += 1
    _hole = [(s, b) for s, b in BLOCK_POPULATION if s != 285]
    _undeclared = population_currency(head=287, population=_hole)
    if not _undeclared or "session 285 has SHIPPED" not in _undeclared[0]:
        failed += 1
        print(f"  🔴 POPULATION_ABSENT_PAIR an UNDECLARED hole at 285 was not refused by "
              f"name: {_undeclared[:1]}")
    # …and the same tree with that one session declared is CLEAN. Both halves on one
    # fixture, because a reader that refused everything and a reader that skipped
    # everything each satisfy exactly one of them.
    claims += 1
    _saved = dict(BLOCK_ABSENT)
    try:
        BLOCK_ABSENT[285] = "d" * 100
        _declared = population_currency(head=287, population=_hole)
    finally:
        BLOCK_ABSENT.clear()
        BLOCK_ABSENT.update(_saved)
    if _declared:
        failed += 1
        print(f"  🔴 POPULATION_ABSENT_PAIR a DECLARED absence was still refused, so the "
              f"roster is not the route past this reader it claims to be: {_declared[:1]}")
    claims += 1
    _both = block_absent_problems(head=999, population=BLOCK_POPULATION,
                                  absent={287: "a" * 100})
    if not any("POPULATION_ABSENT_CONTRADICTED" in g for g in _both):
        failed += 1
        print("  🔴 POPULATION_ABSENT_CONTRADICTED did not fire on a session declared "
              "absent whose block is in the population — the block is the measurement "
              "and the declaration is a sentence")
    claims += 1
    _future = block_absent_problems(head=289, population=BLOCK_POPULATION,
                                    absent={289: "b" * 100})
    if not any("POPULATION_ABSENT_FUTURE" in g for g in _future):
        failed += 1
        print("  🔴 POPULATION_ABSENT_FUTURE did not fire on a session declared absent at "
              "or after the head — a session that has not finished has left nothing to "
              "say anything about")
    claims += 1
    _thin = block_absent_problems(head=999, population=[], absent={288: "too short"})
    if not any("POPULATION_ABSENT_UNREASONED" in g for g in _thin):
        failed += 1
        print("  🔴 POPULATION_ABSENT_UNREASONED did not fire on a row with no "
              "substantive reason — the whole cost of this roster is that somebody has "
              "to say why")
    claims += 1
    _floor = block_absent_problems(head=999, population=[],
                                   absent={POPULATION_SHAPE_FROM - 1: "c" * 100})
    if not any("POPULATION_ABSENT_UNDERFLOOR" in g for g in _floor):
        failed += 1
        print("  🔴 POPULATION_ABSENT_UNDERFLOOR did not fire on a row below the oldest "
              "session this table is judged from — an exemption for a session nothing "
              "asks about hides the next one")

    # ── 🆕 274 — THE CI-MEASURED CLOSE, EVERY ARM DRIVEN ON A FIXTURE ─────────────────
    #
    # 🔴 EACH REFUSAL IS DRIVEN, NOT ASSERTED — 273 §2's own lesson one file over. The
    # accept path and the refuse path of a reader that decides whether a number may be
    # believed are different code, and the one that has never run is the one that will be
    # wrong when it matters. `tautology_gate.mjs` grades these blocks by what satisfies
    # them, so every claim below compares a real return value.
    _PROV = ("CI_MEASURED sha=255d13980f1e2a3b4c5d6e7f8091a2b3c4d5e6f7 run=42 attempt=1 "
             "job=host-tests-node22 workflow=ci")
    _SUITE = "# tests 904\n# pass 904\n"          # host.suite's own two lines
    _SCOPE = "SCOPE_GATE 66 enumerator(s) swept\n"

    def _dir(files: "dict[str, str]") -> Path:
        d = Path(tempfile.mkdtemp(prefix="handoff_ci_"))
        for name, body in files.items():
            (d / name).parent.mkdir(parents=True, exist_ok=True)
            (d / name).write_text(body, encoding="utf-8")
        return d

    # ── the accept path: a directory of two attributed parts reads as one bound log ───
    claims += 1
    _d = _dir({"a/host.log": f"{_PROV}\n{_SUITE}", "b/contract.log": f"{_PROV}\nx 1\n"})
    _text, _parts = read_measured(_d)
    _p, _n, _sha = ci_provenance(_text, _parts, str(_d))
    # ── 🆕 277 §1 — `_parts` IS `None` ON A HEALTHY SHAPE AND BOTH DIAGNOSTICS BELOW USED
    # TO `len()` IT. `read_measured` is annotated `list[…] | None`, and `None` is exactly
    # what it answers for a PLAIN FILE — which is what the second claim below is about. So
    # the message describing that claim's failure could not be BUILT: any other clause of
    # its assertion going wrong produced `TypeError: object of type 'NoneType' has no
    # len()`, killed the command, and took every claim after it unrun. The shipped reader
    # guards `parts is None` on `ci_provenance`'s first line; the two places that JUDGE
    # that reader did not, which is 273's *a reader that cannot show its own refusal* one
    # file over. Swept: names bound from the four readers whose annotation admits `None`,
    # and the population of unguarded sites is these two.
    _shape = "None" if _parts is None else f"{len(_parts)} part(s)"
    if _p or _parts is None or len(_parts) != 2 or not _sha.startswith("255d139") \
            or "# tests 904" not in _text:
        failed += 1
        print(f"  🔴 CI_MEASURED_ACCEPT a directory of two attributed parts did not read "
              f"back as one log bound to one commit: {_p or (_sha, _shape)}")

    # ── and a plain file is still a plain file, carrying no provenance and no refusal ──
    claims += 1
    _f = _dir({"run.log": _SUITE}) / "run.log"
    _text, _parts = read_measured(_f)
    _p, _n, _sha = ci_provenance(_text, _parts, str(_f))
    _shape = "None" if _parts is None else f"{len(_parts)} part(s)"
    if _p or _parts or _sha or not any("no `CI_MEASURED` line" in x for x in _n):
        failed += 1
        print(f"  🔴 CI_MEASURED_FILE the local replay's own log was not read as an "
              f"unattributed file: problems={_p} parts={_shape} sha={_sha!r}")

    # ── an unattributed part that ANSWERS A COUNTER is the defect the line exists for ──
    claims += 1
    _d = _dir({"ci.log": f"{_PROV}\nx 1\n", "stray.log": _SUITE})
    _p, _n, _sha = ci_provenance(*read_measured(_d), str(_d))
    if not any("MEASURED_UNATTRIBUTED" in x and "host.suite" in x for x in _p):
        failed += 1
        print(f"  🔴 MEASURED_UNATTRIBUTED_CONTROL a part with no provenance line "
              f"supplied `host.suite` and was not refused: {_p}")

    # ── and one that answers NO counter is what carries the world and the tier line ────
    claims += 1
    _d = _dir({"ci.log": f"{_PROV}\nx 1\n",
               "open.log": "GH_OPEN_ISSUES 0\nHANDOFF_OPEN x · TIER0 · INHERITED FROM 273 "
                           "AT 255d139\n"})
    _p, _n, _sha = ci_provenance(*read_measured(_d), str(_d))
    if _p or not _sha:
        failed += 1
        print(f"  🔴 MEASURED_UNATTRIBUTED_WORLD a local part answering no counter was "
              f"refused, so the TIER0 line and the `--gh-open` readings have nowhere to "
              f"travel: {_p}")

    # ── two commits merged into one claim, and two runs at one commit ────────────────
    claims += 1
    _other = _PROV.replace("sha=255d139", "sha=d6ca644")
    _p, _n, _sha = ci_provenance(*read_measured(
        _dir({"a.log": f"{_PROV}\nx 1\n", "b.log": f"{_other}\nx 1\n"})), "d")
    if not any("MEASURED_MIXED_SHA" in x for x in _p) or _sha:
        failed += 1
        print(f"  🔴 MEASURED_MIXED_SHA_CONTROL parts from two commits were not refused: {_p}")
    claims += 1
    _p, _n, _sha = ci_provenance(*read_measured(
        _dir({"a.log": f"{_PROV}\nx 1\n", "b.log": f"{_PROV.replace('run=42', 'run=43')}\nx 1\n"})),
        "d")
    if not any("MEASURED_MIXED_RUN" in x for x in _p) or _sha:
        failed += 1
        print(f"  🔴 MEASURED_MIXED_RUN_CONTROL parts from two runs at one commit were "
              f"not refused: {_p}")

    # ── an empty download is named as an empty download, not as 34 moved patterns ─────
    claims += 1
    _p, _n, _sha = ci_provenance(*read_measured(_dir({"readme.txt": "nothing"})), "d")
    if not any("MEASURED_EMPTY" in x for x in _p):
        failed += 1
        print(f"  🔴 MEASURED_EMPTY_CONTROL a download directory with no `*.log` in it "
              f"was not named as the cause: {_p}")

    # 🔴 `None` AND `[]` ARE DIFFERENT ANSWERS, PINNED AT THE READER RATHER THAN AT ITS
    # CALLER — because the caller collapsed them an hour after the reader stopped, and
    # `MEASURED_EMPTY` fired on a plain local replay log. A pair, both directions.
    claims += 1
    _p_file, _n_file, _ = ci_provenance(_SUITE, None, "run274.log")
    _p_dir, _n_dir, _ = ci_provenance("", [], "ci274/")
    if any("MEASURED_EMPTY" in x for x in _p_file) or \
            not any("MEASURED_EMPTY" in x for x in _p_dir):
        failed += 1
        print(f"  🔴 MEASURED_NONE_IS_NOT_EMPTY a FILE (parts=None) and an EMPTY DIRECTORY "
              f"(parts=[]) were not told apart: file={_p_file} dir={_p_dir}")

    # ── the leg reader: one tree, two answers, on a counter read by both artifacts ────
    claims += 1
    _got = leg_disagreements(
        [("node18.log", f"{_PROV}\n{_SCOPE}"),
         ("node22.log", f"{_PROV}\nSCOPE_GATE 65 enumerator(s) swept\n")],
        {"scope.enumerators"})
    if not any("MEASURED_LEG_DISAGREEMENT" in x and "scope.enumerators" in x for x in _got):
        failed += 1
        print(f"  🔴 MEASURED_LEG_CONTROL two artifacts read `scope.enumerators` "
              f"differently on one commit and nothing refused: {_got}")
    claims += 1
    if leg_disagreements([("a.log", _SCOPE), ("b.log", _SCOPE)], {"scope.enumerators"}):
        failed += 1
        print("  🔴 MEASURED_LEG_AGREE two artifacts that AGREE were refused — the reader "
              "must fire on disagreement and be silent on the healthy case")

    # ── 🆕 275 — THE RUN'S VERDICT, EVERY ARM DRIVEN ON A STUBBED READING ─────────────
    #
    # 🔴 THE READING IS INJECTED BECAUSE THE ONE THING THESE CLAIMS MUST NOT DO IS DIAL.
    # `--selftest` runs merge-blocking in CI on every push and a fixture that reached
    # `api.github.com` would make this file's own verdict a statement about connectivity —
    # which is the exact confusion `gh_emit` was written to avoid one screen up.
    claims += 1
    _p, _n = verdict_problems("42", "255d139", True,
                              read=lambda _r: (RUN_GREEN, "completed", [], ""))
    if _p or not any("GREEN on the run that produced these counters" in x for x in _n):
        failed += 1
        print(f"  🔴 VERDICT_ACCEPT a run that concluded `{RUN_GREEN}` was refused, or "
              f"said nothing about it: {_p or _n}")

    # 🔴 THE CASE THE `if: always()` UPLOAD CREATES, and the reason this reader exists:
    # a directory of real, attributed, correctly-bound counters from a run that went red.
    claims += 1
    _p, _n = verdict_problems("42", "255d139", True,
                              read=lambda _r: ("failure", "completed",
                                               ["host tests (node 22)"], ""))
    if not any("MEASURED_RUN_NOT_GREEN" in x and "host tests (node 22)" in x for x in _p):
        failed += 1
        print(f"  🔴 VERDICT_RED_CONTROL counters from a FAILED run were accepted, or the "
              f"refusal did not name the job that failed: {_p}")

    # 🔴 AND THE SHAPE 275's OWN PICKUP FOUND: a run that created no jobs at all, which is
    # what a workflow file GitHub refuses looks like from the outside. `bad` is empty and
    # the conclusion is still not green — a reader that named the failing jobs and stopped
    # would have had nothing to say about the only run that has ever failed this way here.
    claims += 1
    _p, _n = verdict_problems("42", "255d139", True,
                              read=lambda _r: ("failure", "completed", [], ""))
    if not any("MEASURED_RUN_NOT_GREEN" in x and "created no jobs" in x for x in _p):
        failed += 1
        print(f"  🔴 VERDICT_STARTUP_CONTROL a run that failed with no jobs was not "
              f"named as such: {_p}")

    claims += 1
    _p, _n = verdict_problems("42", "255d139", True,
                              read=lambda _r: ("", "in_progress", [], ""))
    if not any("MEASURED_VERDICT_PENDING" in x for x in _p):
        failed += 1
        print(f"  🔴 VERDICT_PENDING_CONTROL an unfinished run was read as a green: {_p}")

    claims += 1
    _p, _n = verdict_problems("42", "255d139", True,
                              read=lambda _r: ("", "", [], "`gh` is not installed"))
    if not any("MEASURED_VERDICT_UNREAD" in x for x in _p):
        failed += 1
        print(f"  🔴 VERDICT_UNREAD_CONTROL an unreachable forge was read as a green — "
              f"236 §4's rule, at the one atom whose value is a word: {_p}")

    # 🔴 AND WITHOUT `--network` NOTHING IS DIALED AND NOTHING IS ASSUMED. The stub raises,
    # so a draft that read first and checked the flag afterwards fails here rather than in
    # a container with no socket.
    claims += 1

    def _never(_r):
        raise AssertionError("verdict_problems dialed without --network")

    _p, _n = verdict_problems("42", "255d139", False, read=_never)
    if not any("MEASURED_VERDICT_UNREAD" in x and "--network" in x for x in _p):
        failed += 1
        print(f"  🔴 VERDICT_OFFLINE_CONTROL a close with no network neither read the "
              f"verdict nor said so: {_p}")

    # 🔴 THE OLD ROUTE IS UNTOUCHED, WHICH IS THE HALF A NEW REFUSAL BREAKS. A local replay
    # log names no run, so there is no verdict to ask for and no claim to refuse — every
    # block before 275 closed that way and still can.
    claims += 1
    if verdict_problems("", "", True, read=_never)[0] \
            or measured_run(_SUITE, None) \
            or measured_run("", [("a.log", f"{_PROV}\n{_SUITE}")]) != "42":
        failed += 1
        print("  🔴 VERDICT_LOCAL_LOG a log with no `CI_MEASURED` line was asked for a "
              "run verdict, or the run id was not read back out of an attributed part")

    # ── 🆕 287 — THE LOG ROUTE, AND WHY IT IS BOUND TO ITS RUN ────────────────────────
    #
    # 🔴 SIX DIRECTIONS, AND `_never` IS IN FIVE OF THEM. A route that answered off the
    # log and dialled anyway would be two readings of one world (279); a route that
    # accepted any `MEASURED_VERDICT` line would let a green about ANOTHER run stand over
    # these counters, which is the receipt 273 named. The green arm is the only one that
    # may be silent, and it must be silent WITHOUT the network — that is the whole point
    # of the emitter.
    claims += 1
    _v_green = verdict_problems("42", "255d139", False,
                                read=_never, log="MEASURED_VERDICT 42 success\n")
    _v_red = verdict_problems("42", "255d139", False,
                              read=_never, log="MEASURED_VERDICT 42 failure — ci\n")
    _v_other = verdict_problems("42", "255d139", False,
                                read=_never, log="MEASURED_VERDICT 41 success\n")
    _v_both = verdict_problems("42", "255d139", False, read=_never,
                               log="MEASURED_VERDICT 42 success\nMEASURED_VERDICT 41 "
                                   "success\n")
    _v_two = verdict_problems("42", "255d139", False, read=_never,
                              log="MEASURED_VERDICT 42 success\nMEASURED_VERDICT 42 "
                                  "failure\n")
    _v_twice = verdict_problems("42", "255d139", False, read=_never,
                                log="MEASURED_VERDICT 42 success\nMEASURED_VERDICT 42 "
                                    "success\n")
    if (_v_green[0] or not any("concluded `success`" in n for n in _v_green[1])
            or not any("MEASURED_RUN_RED" in p and "ci" in p for p in _v_red[0])
            or not any("MEASURED_VERDICT_UNUSABLE" in p for p in _v_other[0])
            or not any("MEASURED_VERDICT_UNUSABLE" in p for p in _v_both[0])
            or not any("MEASURED_VERDICT_UNUSABLE" in p for p in _v_two[0])
            or _v_twice[0]):
        failed += 1
        print(f"  🔴 VERDICT_LOG_ROUTE green={_v_green} red={_v_red[0][:1]} "
              f"foreign={_v_other[0][:1]} both={_v_both[0][:1]} two={_v_two[0][:1]} "
              f"twice={_v_twice[0][:1]} — a verdict emitted onto the log is read where "
              f"the forge cannot be reached; a red one still refuses; a green about "
              f"another run is not this run's; and the same reading written twice is "
              f"`--gh-verdict` run twice, not a disagreement")

    # 🔴 AND THE EMITTER ITSELF PRINTS A LINE THIS READER BINDS TO, which is the property
    # 271 §1's four readings have and the thing that makes an emitter more than a print.
    # `MAIN_AT_HEAD`'s own reason: an UNREAD line carries no numeral, so the pattern finds
    # nothing and the close says nobody looked.
    claims += 1

    def _emit(answer):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            verdict_emit("42", read=lambda _r, _root=None: answer)
        return buf.getvalue()

    _e_green = _emit((RUN_GREEN, "completed", [], ""))
    _e_red = _emit(("failure", "completed", ["host tests (node 18)"], ""))
    _e_dead = _emit(("", "", [], "the forge could not be reached"))
    _e_pend = _emit(("", "in_progress", [], ""))
    if (verdict_of_log("42", _e_green) != (RUN_GREEN, [], "")
            or verdict_of_log("42", _e_red)[0] != "failure"
            or "host tests (node 18)" not in verdict_of_log("42", _e_red)[1]
            or verdict_of_log("42", _e_dead) != ("", [], "")
            or verdict_of_log("42", _e_pend) != ("", [], "")
            or not verdict_problems("42", "255d139", False, read=_never,
                                    log=_e_red)[0]):
        failed += 1
        print(f"  🔴 VERDICT_EMIT_SHAPE green={_e_green!r} red={_e_red!r} "
              f"dead={_e_dead!r} pending={_e_pend!r} — the emitter's own spelling is what "
              f"the reader binds to, and a line with no verdict word on it carries no "
              f"claim: an unreachable forge and a run still going are both UNREAD, which "
              f"is `MAIN_AT_HEAD`'s rule (277 §3) on the fifth reading")

    # ── the workflow routing question, both arms, at FLAG granularity (242's row) ─────
    claims += 1
    _caps = ci_capture_steps()
    _p, _n = ci_capture_problems(_caps, {k for k, *_ in COUNTER_READERS})
    if _p:
        failed += 1
        print(f"  🔴 CI_CAPTURE this tree's own workflows do not route every non-CHEAP "
              f"counter into the captured log: {_p}")
    claims += 1
    if not any(g for _w, _c, g in _caps) or not _caps:
        failed += 1
        print(f"  🔴 CI_CAPTURE_EMPTY the reader found {len(_caps)} captured step(s) in "
              f"this tree's workflows — a routing check over an empty roster reports "
              f"perfect agreement")
    claims += 1
    _p, _n = ci_capture_problems([("ci.yml", "python3 ../scripts/scope_gate.py", False)],
                                 {"scope.enumerators"})
    if not any("CI_CAPTURE_UNGUARDED" in x for x in _p):
        failed += 1
        print(f"  🔴 CI_CAPTURE_UNGUARDED_CONTROL a captured step with no `shell: bash` "
              f"was not refused, so a refusing gate would exit with tee's status: {_p}")
    claims += 1
    _p, _n = ci_capture_problems([("ci.yml", "python3 ../scripts/scope_gate.py", True)],
                                 {"scope.enumerators", "control.controls"})
    if not any("CI_CAPTURE_MISSING" in x and "control_gate.py" in x for x in _p):
        failed += 1
        print(f"  🔴 CI_CAPTURE_MISSING_CONTROL a MUTATING counter no workflow routes was "
              f"not reported: {_p}")
    # 🔴 THE GRANULARITY CLAIM ITSELF — `replay-ci-flag-granularity` (OPEN 242) IS THIS
    # ROW AND NOTHING ELSE. A basename comparison calls `mutation_lock_gate.py` captured
    # when the flagged variant is the one that prints the counter; this asserts the
    # flagged and bare spellings are two different entries.
    claims += 1
    _p, _n = ci_capture_problems(
        [("ci.yml", "python3 ../scripts/mutation_lock_gate.py", True)], {"mutlock.guarded"})
    if not any("CI_CAPTURE_MISSING" in x and "--selftest" in x for x in _p):
        failed += 1
        print(f"  🔴 CI_CAPTURE_FLAGS the bare `mutation_lock_gate.py` satisfied a counter "
              f"that only `--selftest` prints — the comparison collapsed to basenames, "
              f"which is 242's row and not its fix: {_p}")
    claims += 1
    if ci_capture_norm("python3 ../scripts/x.py --flag") != ci_capture_norm(
            "python3 scripts/x.py --flag"):
        failed += 1
        print("  🔴 CI_CAPTURE_NORM the same command run from two working directories did "
              "not normalise to one entry")

    # ── 🆕 274 — `replay-ci-flag-granularity` (242): THE ROSTERS, WITH FLAGS ──────────
    #
    # 🔴 THE ANCHOR FIRST, BECAUSE IT IS WHAT MADE THE ROW MEASURABLE. An unanchored
    # suffix sliced `github.sha` into the script `github.sh` and `rb.shot.mime` into
    # `rb.sh`, and the second of those carried a written exemption for eight sessions.
    for probe, want, why in [
        ("${{ github.sha }}", [], "a token whose TAIL spells an extension is not a script"),
        ("OPS_UNIT_PASS rb.shot.mime", [], "the phantom `rb.sh` carried an exemption"),
        ("python3 scripts/x.py", ["x.py"], "a real invocation is still found"),
        ('node scripts/a.mjs --flag', ["a.mjs"], "a flagged invocation is still found"),
        ("bash /tmp/gate.sh", ["gate.sh"], "a real `.sh` at end of token is still found"),
    ]:
        claims += 1
        got = CI_SCRIPT_RE.findall(probe)
        if got != want:
            failed += 1
            print(f"  🔴 CI_SCRIPT_ANCHOR {probe!r} -> {got}, pinned {want} — {why}")

    for probe, want, why in [
        ("python3 ../scripts/x.py --flag  | tee -a run.log", "python3 x.py --flag",
         "the routing tail is not part of the command"),
        ("python3 scripts/x.py --flag", "python3 x.py --flag",
         "the same command from another working directory is the same command"),
        ("npm test | tail -20 > run.log", "npm test", "a redirect is not an argument"),
        ("python3 x.py   # 🆕 274", "python3 x.py", "a comment is not an argument"),
    ]:
        claims += 1
        got = command_norm(probe)
        if got != want:
            failed += 1
            print(f"  🔴 COMMAND_NORM {probe!r} -> {got!r}, pinned {want!r} — {why}")

    # a flagged variant CI runs and the fence does not is refused; the same fence with
    # the flag present is not — the pair, because a rule that only ever fires is a rule
    # that would pass a roster it can no longer read.
    _ci_flags = {"python3 gate.py --selftest": {"ci.yml"},
                 "python3 gate.py": {"ci.yml"}}
    _fence_no = "```bash\npython3 ../scripts/gate.py\n" \
                "python3 ../scripts/handoff_gate.py x --measured run.log\n```"
    _fence_yes = "```bash\npython3 ../scripts/gate.py\npython3 ../scripts/gate.py --selftest\n" \
                 "python3 ../scripts/handoff_gate.py x --measured run.log\n```"
    claims += 1
    _p, _n = replay_ci_flag_problems(_fence_no, _ci_flags, exempt={}, floor=2)
    if not any("REPLAY_FLAG_MISSING" in x and "--selftest" in x for x in _p):
        failed += 1
        print(f"  🔴 REPLAY_FLAG_MISSING_CONTROL a fence running `gate.py` and not "
              f"`gate.py --selftest` was accepted — the comparison collapsed to "
              f"basenames, which is 242's row and not its fix: {_p}")
    claims += 1
    _p, _n = replay_ci_flag_problems(_fence_yes, _ci_flags, exempt={}, floor=2)
    if _p:
        failed += 1
        print(f"  🔴 REPLAY_FLAG_HEALTHY a fence carrying BOTH spellings was refused: {_p}")
    claims += 1
    _p, _n = replay_ci_flag_problems(_fence_yes, _ci_flags, exempt={"python3 nobody.py": "x"},
                                     floor=2)
    if not any("REPLAY_CI_FLAG_EXEMPT_STALE" in x for x in _p):
        failed += 1
        print(f"  🔴 REPLAY_CI_FLAG_EXEMPT_STALE_CONTROL an exemption neither roster runs "
              f"was not reported: {_p}")
    claims += 1
    _p, _n = replay_ci_flag_problems(_fence_yes, {"python3 gate.py": {"ci.yml"}},
                                     exempt={}, floor=9)
    if not any("REPLAY_CI_FLAG_FLOOR" in x for x in _p):
        failed += 1
        print(f"  🔴 REPLAY_CI_FLAG_FLOOR_CONTROL a roster below its floor was compared "
              f"anyway, and a comparison against a collapsed roster agrees with "
              f"everything: {_p}")
    # and the live walk is not empty — the floor above only fires on a roster this
    # reader can still read at all
    claims += 1
    _live = ci_commands()
    if len(_live) < CI_SCRIPT_FLOOR:
        failed += 1
        print(f"  🔴 CI_COMMANDS_LIVE the flag-granular walk found {len(_live)} command(s) "
              f"in this tree's workflows, floor {CI_SCRIPT_FLOOR} — it is a REFINEMENT of "
              f"the basename walk and cannot be smaller than it")

    # 🆕 275 — AND NO ROW IN IT IS EMPTY, WHICH IS THE SHAPE THIS SESSION'S OWN CLOSE
    # PRODUCED. A `#` line inside a `run: |` block naming any script became a command that
    # normalises to the empty string, and the refusal it generated named nothing at all:
    # ``REPLAY_FLAG_MISSING `` runs in ['ci.yml']``. The sibling reader `replay_commands`
    # has stripped comments since it was written, so the two rosters this file compares
    # were reading the same lines under different rules. Both directions, because a walk
    # that returned nothing would satisfy the emptiness claim vacuously and the floor above
    # is what stops that.
    claims += 1
    _blank = [k for k in _live if not k.strip()]
    if _blank:
        failed += 1
        print(f"  🔴 CI_COMMANDS_BLANK the flag-granular walk yielded {len(_blank)} empty "
              f"command(s). A comparison against one produces a refusal naming nothing, "
              f"and the replay cannot run a command with no name")
    claims += 1
    _comment = ci_commands_text(
        {"ci.yml": "      - run: |\n          echo hi\n          # see lint_ceiling.py for the shape\n"})
    _real = ci_commands_text({"ci.yml": "      - run: python3 scripts/queue_gate.py --selftest\n"})
    if _comment or list(_real) != ["python3 queue_gate.py --selftest"]:
        failed += 1
        print(f"  🔴 CI_COMMANDS_COMMENT a comment inside a `run:` block naming a script "
              f"was read as a command, or a real command stopped being read — comment "
              f"{_comment}, real {_real}. Both directions, because a walk that reads "
              f"NOTHING satisfies the first half and is the collapse the floor above "
              f"exists for")

    # ══ 🆕 277 §2 — THE SIX ASSEMBLIES THIS FILE PROVED THE PARTS OF AND NEVER THE SUM ══
    #
    # 🔴 MEASURED FIRST, WHICH IS THE ONLY REASON THESE SIX ARE HERE AND NOT NINETEEN.
    # `py-cohort-handoff-gate` (247) asked for a target or a written reason for every
    # top-level `def` in this file. The count in the row was FORTY-NINE and the file holds
    # SEVENTY-FOUR — 276's own finding, one file over: a number nobody's reader printed,
    # taken at 247 and carried for twenty-nine sessions as though it were about the tree.
    #
    # Every one of the seventy-four was blinded to the empty its own annotation promises
    # and this command run against it. Fifty-six redden. Of the twenty-two that do not,
    # every one is unreachable FROM HERE for one of three reasons — twelve dial a network,
    # seven read an object store a `--depth 1` checkout does not have, three are the
    # invocation itself — and each is written down in `instrument_gate.py`'s
    # `NOT_A_TARGET` with which of the three it is.
    #
    # 🔴 AND SIX OF THEM WERE REACHABLE ALL ALONG AND NOBODY HAD ASKED. They are the file's
    # ASSEMBLIES — `check` is what `main` calls to be the gate; `open_tier` is what
    # `--open` calls to be the open gate; `measure`, `tier_trigger`, `block_assetlib` and
    # `gh_emit` are the four readers those two are made of. Every claim above this line
    # proves a PART works. None of them proved the assembly still CALLS it, and on a green
    # tree no input can tell those apart — 202 §4's call-wiring finding, arriving in the
    # file that judges the handoff rather than in the one that judges the instruments.
    #
    # 🔴 AND THE FIXTURE'S SHA IS IMPOSSIBLE ON PURPOSE. A claim that `tier_trigger`
    # answers TIER1 because HEAD happens to differ from a real block's commit is a claim
    # about the machine (235 §6.3, and this file has paid for it once). Forty zeros is a
    # commit no checkout can be at, so the two tier claims below are about the reader.
    _asm_block, _asm_why = status_block(BLOCK_POPULATION[-1][1])
    _asm_text = re.sub(r"\b[0-9a-f]{7,40}\b", "0" * 7, BLOCK_POPULATION[-1][1])
    _asm_dir = _dir({f"HANDOFF_SESSION{BLOCK_POPULATION[-1][0]}.md": _asm_text})
    _asm_doc = _asm_dir / f"HANDOFF_SESSION{BLOCK_POPULATION[-1][0]}.md"

    claims += 1
    _c_p, _c_n, _c_a, _c_c, _c_h, _c_hc = check(_asm_doc, "", False, False, False, False)
    if _asm_why or _c_a < CLAIM_FLOOR or _c_h < HEADER_FLOOR or not _c_p:
        failed += 1
        print(f"  🔴 CHECK_ASSEMBLY the gate's own driver read {_c_a} atom(s) and "
              f"{_c_h} header atom(s) out of a real shipped block and raised {len(_c_p)} "
              f"problem(s) — floors {CLAIM_FLOOR}/{HEADER_FLOOR}, and a block belonging to "
              f"another commit cannot be problem-free. `check` is called from exactly one "
              f"place, `main`; every reader it assembles is proved above and until now "
              f"nothing asserted the assembly")

    claims += 1
    _o_out = io.StringIO()
    with contextlib.redirect_stdout(_o_out):
        _o_rc = open_tier(_asm_doc, False)
    if _o_rc != 1 or "TIER1_REQUIRED" not in _o_out.getvalue():
        failed += 1
        print(f"  🔴 OPEN_ASSEMBLY `--open` against a block verified at a commit no "
              f"checkout can be at returned {_o_rc} and said {_o_out.getvalue()[:80]!r}. "
              f"The cheap tier is the one thing this command can wrongly GRANT, so the "
              f"claim is on the refusal and not on the pass")

    claims += 1
    _t_tier, _t_head, _t_claimed, _t_why = tier_trigger(_asm_doc)
    if _t_tier != TIER1 or not _t_why:
        failed += 1
        print(f"  🔴 TIER_TRIGGER_ASSEMBLY {_t_tier!r}/{_t_why!r} — the trigger is MEASURED "
              f"and never declared, so a block whose commit is unreachable must require "
              f"the full replay AND say why. A tier with no reason is a tier nobody can "
              f"check")

    claims += 1
    _m_out, _m_un, _m_notes = measure({"host.suite"}, "# tests 904\n# pass 904\n",
                                      False, False, False)
    if _m_out.get("host.suite") != (904, 904) or _m_un:
        failed += 1
        print(f"  🔴 MEASURE_ASSEMBLY a captured log carrying a counter this file has a "
              f"reader for measured {_m_out!r} with {_m_un!r} unmeasured. The log arm is "
              f"the only arm a CI-measured close ever uses (274), and it is the one arm "
              f"that runs no command and therefore leaves no other trace")

    claims += 1
    _al_have = block_assetlib(_asm_block)
    _al_none = block_assetlib(["> 🟢 VERIFIED AFTER THE CHANGE   904/904"])
    if _al_have[1] or not _al_have[0] or _al_none[0] or not _al_none[1]:
        failed += 1
        print(f"  🔴 BLOCK_ASSETLIB_ASSEMBLY {_al_have} / {_al_none} — both directions, "
              f"because a reader that answers the empty string for every block agrees "
              f"with the world and refuses nothing. This is the reader that caught 276's "
              f"block claiming a version the Asset Library had already moved past")

    # 🔴 THE CLAIM IS ON THE LINE AND NOT ON THE EXIT CODE, and 271 §1 is why: this emitter
    # exits 0 whether or not it could read, on purpose, so that a replay's exit sum stays a
    # statement about the tree rather than about connectivity. A blind that returns 0 and
    # prints nothing satisfies every claim a return code can carry — 247's own finding on
    # `queue_gate.py`'s two reporters, in the one other file shaped like this.
    claims += 1
    _g_out = io.StringIO()
    with contextlib.redirect_stdout(_g_out):
        gh_emit()
    _g_lines = [ln for ln in _g_out.getvalue().split("\n") if ln.strip()]
    _g_want = ["GH_OPEN_ISSUES", "GH_OPEN_PRS", "ASSETLIB_VERSION", "MAIN_AT_HEAD"]
    if [w for w in _g_want if not any(ln.startswith(w) for ln in _g_lines)]:
        failed += 1
        print(f"  🔴 GH_EMIT_ASSEMBLY `--gh-open` printed {len(_g_lines)} line(s) and the "
              f"labels a later `--measured` binds to are {_g_want}: {_g_lines}. UNREAD is "
              f"a line with a reason and no numeral — an emitter that prints NOTHING is "
              f"the one shape no reader downstream can tell from a missing network")

    # ══ 🆕 277 §3 — `main-red-between-sessions-unread` (276), BOTH READERS, BOTH WAYS ═══
    #
    # 🔴 THE THREE ANSWERS ARE DRIVEN AND NOT ARGUED FOR. A verdict reader with a green
    # arm and a red arm and no PENDING arm is one that has to lie about a run in flight,
    # and a pickup minutes after a merge is exactly when that happens. `main_at_head_of`
    # is PURE over the forge's JSON precisely so all three are reachable from a fixture on
    # a machine with no network — 231's rule about splitting the pure half out, applied to
    # the one reader in this file whose whole subject is a thing the container cannot dial.
    claims += 1
    _ok = main_at_head_of([{"headSha": "abc1234", "status": "completed",
                            "conclusion": "success", "workflowName": "ci"},
                           {"headSha": "abc1234", "status": "completed",
                            "conclusion": "success", "workflowName": "integration"}])
    _red = main_at_head_of([{"headSha": "abc1234", "status": "completed",
                             "conclusion": "success", "workflowName": "ci"},
                            {"headSha": "abc1234", "status": "completed",
                             "conclusion": "failure", "workflowName": "integration"}])
    _pend = main_at_head_of([{"headSha": "abc1234", "status": "in_progress",
                              "conclusion": None, "workflowName": "ci"}])
    _older = main_at_head_of([{"headSha": "abc1234", "status": "completed",
                               "conclusion": "success", "workflowName": "ci"},
                              {"headSha": "dead999", "status": "completed",
                               "conclusion": "failure", "workflowName": "ci"}])
    if (_ok[:3] != ("abc1234", RUN_GREEN, []) or _red[1] != "failure"
            or _red[2] != ["integration"] or _pend[1] != RUN_PENDING
            or _older[1] != RUN_GREEN or not main_at_head_of([])[3]):
        failed += 1
        print(f"  🔴 MAIN_AT_HEAD_READER green={_ok[:3]} red={_red[:3]} "
              f"pending={_pend[:3]} older-commit-ignored={_older[:3]} — the verdict is "
              f"the WORST run at the newest sha, a run still going is neither answer, and "
              f"a failure at an OLDER commit is not this commit's problem")

    # 🔴 AND THE REFUSAL IS ON THE VERDICT, NEVER ON THE READING. Four directions, because
    # three of them must NOT refuse: this gate's own premise is that a machine which
    # cannot reach the forge can still open a session (271 §1).
    claims += 1
    _mh_red = main_head_problems("MAIN_AT_HEAD 2032d04 failure\n", False)
    _mh_ok = main_head_problems("MAIN_AT_HEAD 2032d04 success\n", False)
    _mh_pend = main_head_problems(f"MAIN_AT_HEAD 2032d04 {RUN_PENDING}\n", False)
    _mh_none = main_head_problems("", False)
    if (not any("MAIN_RED_AT_HEAD" in x for x in _mh_red[0]) or _mh_ok[0] or _mh_pend[0]
            or _mh_none[0] or not all(any("main at HEAD" in n for n in x[1])
                                      for x in (_mh_ok, _mh_pend, _mh_none))):
        failed += 1
        print(f"  🔴 MAIN_HEAD_PROBLEMS red={_mh_red[0]} ok={_mh_ok} pending={_mh_pend} "
              f"unread={_mh_none} — a READ verdict that is not `success` refuses the cheap "
              f"tier; success, a run in flight and no reading at all are notes. An UNREAD "
              f"that refused would make the tier a statement about connectivity")

    # 🔴 AND THE DRIFT ARM, which is the one that says the verdict is about a DIFFERENT
    # commit — the shape 270 paid for three handoffs running, in the newest reading and
    # therefore the one least likely to be doubted.
    claims += 1
    _mh_drift = main_head_problems("MAIN_AT_HEAD 2032d04 success\n", False, head="1fd4c97")
    if _mh_drift[0] or not any("different commit" in n for n in _mh_drift[1]):
        failed += 1
        print(f"  🔴 MAIN_HEAD_DRIFT {_mh_drift} — a green read at a commit this checkout "
              f"is not at is still a green, and it is a green about something else")

    # ── 🆕 287 — TWO READINGS THAT DISAGREE ABOUT WHAT WAS ASKED ─────────────────────
    #
    # 🔴 THE SHA PAIR IS 285's OWN. `5233a71` is the pickup's reading and `32f90f3` the
    # close's, and 285's `ci285/` held both because the ritual said APPEND — so the close
    # graded the block against the commit before the merge and the only thing that said
    # so was a note (286 §1.1). The SAME-commit arm is the one that keeps this from being
    # a rule against running `--gh-open` twice, and the long-sha arm is why the
    # comparison is a prefix rather than equality.
    claims += 1
    _mh_two = main_head_problems("MAIN_AT_HEAD 5233a71 success\n"
                                 "MAIN_AT_HEAD 32f90f3 success\n", False)
    _mh_same = main_head_problems("MAIN_AT_HEAD 32f90f3 success\n"
                                  "MAIN_AT_HEAD 32f90f3 success\n", False)
    _mh_wide = main_head_problems(
        "MAIN_AT_HEAD 32f90f3 success\n"
        "MAIN_AT_HEAD 32f90f3d0a1b2c3d4e5f60718293a4b5c6d7e8f90 success\n", False)
    if (not any("MAIN_AT_HEAD_AMBIGUOUS" in x for x in _mh_two[0])
            or _mh_same[0] or _mh_wide[0]
            or not all(any("main at HEAD" in n for n in x[1])
                       for x in (_mh_same, _mh_wide))):
        failed += 1
        print(f"  🔴 MAIN_HEAD_AMBIGUOUS two={_mh_two[0][:1]} same={_mh_same} "
              f"wide={_mh_wide} — two lines naming DIFFERENT commits are a reader that "
              f"cannot say which the session meant; two naming the SAME one are "
              f"`--gh-open` run twice, and the short sha is a prefix of the long one")

    # ── 🆕 286 — `git-hooks-unset` (228), DRIVEN IN A REAL REPOSITORY ─────────────
    #
    # 🔴 FOUR STATES AND THE POSITIVE CONTROL IS ONE OF THEM. A reader that refused
    # every checkout would refuse the fixtures too and be removed within a session; one
    # that refused none is the promise 228 shipped. Both directions are driven here, in a
    # throwaway repo, because `core.hooksPath` is a fact about a real `.git/config` and a
    # fixture that stubbed it would be testing the stub (228's own `_probe` rule).
    claims += 1
    # 🔴 `mkdtemp` AND NOT `TemporaryDirectory`, BECAUSE `mutation_lock_gate` READS THE
    # CALL. Its confinement walker proves a write lands under a temp directory by hopping
    # from `Path(tempfile.mkdtemp())`; a `with TemporaryDirectory() as d` binding is a
    # shape it cannot follow, so the first draft of this fixture was reported as
    # `MUTATION_LOCK_UNGUARDED handoff_gate.py — 2 unconfined write(s)`. The gate is right
    # and the fixture was written in a dialect it does not read (172 §10.21's cousin: a
    # reader that cannot see a thing reports the thing, not itself).
    if True:
        _ht = Path(tempfile.mkdtemp(prefix="handoff_hook_"))
        subprocess.run(["git", "init", "-q", str(_ht)], capture_output=True)
        (_ht / ".githooks").mkdir()
        _hp = _ht / ".githooks" / "pre-commit"
        _hp.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
        _hp.chmod(0o755)
        subprocess.run(["git", "add", "-A"], cwd=str(_ht), capture_output=True)
        subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t",
                        "commit", "-qm", "hook"], cwd=str(_ht), capture_output=True)
        _h_unset = hook_problems(_ht)
        subprocess.run(["git", "config", "core.hooksPath", ".githooks"],
                       cwd=str(_ht), capture_output=True)
        _h_set = hook_problems(_ht)
        # the drift case: an executable `pre-commit` git would run that the tree does not
        # track, which satisfies "a hook exists" and is a second copy
        subprocess.run(["git", "config", "--unset", "core.hooksPath"],
                       cwd=str(_ht), capture_output=True)
        (_ht / ".git" / "hooks").mkdir(exist_ok=True)
        _hc = _ht / ".git" / "hooks" / "pre-commit"
        _hc.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
        _hc.chmod(0o755)
        _h_drift = hook_problems(_ht)
    _h_nogit = hook_problems(Path(tempfile.gettempdir()))
    if (not any("HOOK_UNINSTALLED" in x for x in _h_unset) or _h_set
            or not any("HOOK_UNINSTALLED" in x for x in _h_drift) or _h_nogit
            or not any("no `diff` or `add` hook" in x for x in _h_unset)):
        failed += 1
        print(f"  🔴 HOOK_PROBLEMS unset={_h_unset} set={_h_set} drift={_h_drift} "
              f"nogit={_h_nogit} — an unset `core.hooksPath` and an UNTRACKED hook git "
              f"would run must both refuse, an installed tracked hook must be silent, a "
              f"directory that is not a work tree must say nothing (the fixtures live "
              f"there), and the refusal must declare the half it cannot cover")

    # ── 🆕 279 — THE POPULATION THE COMMIT VERDICT CANNOT SEE, DRIVEN FROM FIXTURES ──
    #
    # 🔴 THE FIRST ROW IS THE WORLD AS 279 FOUND IT, AND THE SECOND IS THE WORLD AS 277
    # AND 278 FOUND IT — the same failing `sdk-drift` run, once inside `main`'s newest-sha
    # population and once outside it, with nothing but a merge between them. `_at` refuses
    # and `_after` does not, and before this session `_after` said nothing at all.
    claims += 1
    _sched_red = {"headSha": "0be54af", "status": "completed",
                  "conclusion": "failure", "workflowName": "sdk-drift"}
    _at = [{"headSha": "0be54af", "status": "completed", "conclusion": RUN_GREEN,
            "workflowName": "ci"}, _sched_red]
    _after = [{"headSha": "e65ed07", "status": "completed", "conclusion": RUN_GREEN,
               "workflowName": "ci"},
              {"headSha": "e65ed07", "status": "completed", "conclusion": RUN_GREEN,
               "workflowName": "integration"}, _sched_red]
    if (elsewhere_red_of(_at) != []
            or elsewhere_red_of(_after) != [("sdk-drift", "0be54af")]
            or elsewhere_red_of([]) != []):
        failed += 1
        print(f"  🔴 ELSEWHERE_RED at={elsewhere_red_of(_at)} "
              f"after={elsewhere_red_of(_after)} — a scheduled workflow leaves the "
              f"newest-sha population on the next merge and must not leave the reading")

    # 🔴 AND A WORKFLOW ALREADY GREEN SOMEWHERE OLDER IS NOT REPORTED, or the note would
    # fire on every repository that has ever had a red run.
    claims += 1
    _healed = [{"headSha": "e65ed07", "status": "completed", "conclusion": RUN_GREEN,
                "workflowName": "sdk-drift"},
               {"headSha": "0be54af", "status": "completed", "conclusion": "failure",
                "workflowName": "sdk-drift"}]
    _running = [{"headSha": "e65ed07", "status": "completed", "conclusion": RUN_GREEN,
                 "workflowName": "ci"},
                {"headSha": "0be54af", "status": "in_progress", "conclusion": "",
                 "workflowName": "sdk-drift"}]
    if elsewhere_red_of(_healed) != [] or elsewhere_red_of(_running) != []:
        failed += 1
        print(f"  🔴 ELSEWHERE_RED_STALE healed={elsewhere_red_of(_healed)} "
              f"running={elsewhere_red_of(_running)} — only a workflow's NEWEST run "
              f"counts, and a run still going is not a red")

    # 🔴 AND THE NAMES SURVIVE THE MEASURED-LOG ROUTE NOW. The refusal that fired on 279's
    # own pickup could not say `sdk-drift` because the pattern had two groups.
    claims += 1
    _named = main_head_problems("MAIN_AT_HEAD e65ed07 failure — sdk-drift\n", False)
    _note = main_head_problems("MAIN_AT_HEAD e65ed07 success\n"
                               "WORKFLOW_RED_ELSEWHERE sdk-drift 0be54af\n", False)
    if (not any("sdk-drift" in p for p in _named[0])
            or _note[0]
            or not any("WORKFLOW_RED_ELSEWHERE" in n and "sdk-drift" in n
                       for n in _note[1])):
        failed += 1
        print(f"  🔴 MAIN_HEAD_NAMES named={_named[0]} note={_note} — a refusal that "
              f"cannot say what failed, and a note that is a refusal, are the two ways "
              f"this pair goes wrong")

    # 🆕 275 — `unread` IS PRINTED RATHER THAN SUBTRACTED. A claim this checkout
    # cannot make is not a claim that does not exist: the count above is the same
    # in every environment now, and the difference between them is this number.
    # ── 🆕 278 §3 — THE DEPTH ROSTER, DRIVEN BOTH WAYS FROM FIXTURES ────────────────
    #
    # 🔴 EVERY BRANCH BELOW IS UNEXECUTED BY THE LIVE RUN, which is exactly why it is here.
    # `input_problems` returns `[]` on the shipped tree — `contract-check` already carries
    # `fetch-depth: 0` — so a rule this reader stopped applying would delete in silence,
    # and the sentence it exists to say would go with it. Three shapes: the defect, the
    # healthy case, and the exemption that outlived its subject.
    _DEPTH_FULL = ("name: ci\n"
                   "on:\n"
                   "  push:\n"
                   "jobs:\n"
                   "  contract-check:\n"
                   "    runs-on: ubuntu-latest\n"
                   "    steps:\n"
                   "      - uses: actions/checkout@v6\n"
                   "        with:\n"
                   "          fetch-depth: 0\n"
                   "      - run: python3 scripts/release_names.py --assert-addon\n")
    _DEPTH_ONE = {"python3 release_names.py --assert-addon":
                  {INPUT_OBJECTS: "the objects column, alone, so the three fixtures "
                                  "below measure the DEPTH rule and not the table."}}
    _DEPTH_SHALLOW = _DEPTH_FULL.replace("        with:\n          fetch-depth: 0\n", "")
    _DEPTH_GONE = _DEPTH_FULL.replace(
        "      - run: python3 scripts/release_names.py --assert-addon\n", "")

    for _label, _text, _want, _why in (
        ("full", _DEPTH_FULL, 0,
         "a required command in a job that fetches the whole history is the HEALTHY case, "
         "and a reader that refuses it refuses the shipped tree"),
        ("shallow", _DEPTH_SHALLOW, 1,
         "the defect: `actions/checkout` with no `fetch-depth:` takes ONE commit, and the "
         "step then answers greenly about a history that is not there"),
        ("gone", _DEPTH_GONE, 1,
         "the roster naming a command no job runs — an exemption outliving its subject "
         "(174 §5), and the direction a one-way reader would never see"),
    ):
        claims += 1
        _got, _ = input_problems({"ci.yml": _text}, _DEPTH_ONE)
        if len(_got) != _want:
            failed += 1
            print(f"  🔴 DEPTH_{_label.upper()} -> {len(_got)} problem(s), want {_want} "
                  f"— {_why}. Got: {_got}")

    # ── 🆕 280 §3 — `release-1820-bump-under-wire` (278), AND THE INCIDENT IS ROW 1 ──
    #
    # 🔴 A CHECK THAT HAS NEVER REFUSED IS UNAUDITED (204 §8.27), and this one has an
    # incident to be driven over rather than a construction: 1.82.0, replayed at its own
    # commit with its own classifier, is `wire MAJOR` under a MINOR bump. Row 2 is the
    # shape 270 ACTUALLY shipped — the same cut with the pair simply absent, because the
    # ritual step that produces it was never run. Row 3 is 279's cut, which is the healthy
    # case and must not be refused.
    def _blk(host, extra=""):
        return ["> ```",
                "> main                 abc1234 — a commit (#1)          MOVED +1",
                f"> host / addon         {host} / 1.12.0  🟢 host BUMPED{extra}",
                "> npm                  🟢 " + host + " · lag 0 · tags 134",
                "> ```"]

    _prev_1810 = [(279, "\n".join(_blk("1.81.0")))]
    _prev_1820 = [(279, "\n".join(_blk("1.82.0")))]
    for _label, _block, _pop, _want, _why in (
        ("beneath", _blk("1.82.0", " · wire MAJOR · toolchain PATCH"), _prev_1810, 1,
         "1.82.0 ITSELF: a MINOR bump over a wire that did MAJOR. `wire_floor` is the "
         "comparison and it returns C8_BENEATH — the reading the cut never took"),
        ("unread", _blk("1.82.0"), _prev_1810, 1,
         "the shape 270 shipped: a cut whose block says NOTHING about the wire, because "
         "the invocation that answers it was not in the replay list"),
        ("healthy", _blk("1.82.1", " · wire PATCH · toolchain PATCH"), _prev_1820, 0,
         "279's cut — a PATCH over a PATCH wire. A reader that refuses this refuses the "
         "shipped tree, which is the direction that makes the other two worthless"),
        ("no-cut", _blk("1.82.1", " · wire PATCH · toolchain PATCH"),
         [(279, "\n".join(_blk("1.82.1")))], 0,
         "the host version did not move, so no cut happened and check 8 is owed nothing "
         "— the population is the CUTS and not the sessions"),
        ("above", _blk("1.83.0", " · wire PATCH · toolchain PATCH"), _prev_1820, 0,
         "a MINOR whose schemas held still is legal and REPORTED, never refused: the "
         "floor is one-sided by design (`wire_floor`'s own docstring), and a reader that "
         "demanded equality would refuse every behaviour change the classifier is blind to"),
        ("toolchain", _blk("1.82.1", " · wire PATCH · toolchain MAJOR"), _prev_1820, 1,
         "276's arm, reached through this reader: a PATCH source verdict beside a MAJOR "
         "TOOLCHAIN verdict floors at the worse of the two, so a dependency that moved "
         "the wire cannot cancel on both sides and read as a patch (#256)"),
    ):
        claims += 1
        _got, _ = release_verdict_problems(_block, 280, _pop)
        if len(_got) != _want:
            failed += 1
            print(f"  🔴 RELEASE_VERDICT_{_label.upper()} -> {len(_got)} problem(s), want "
                  f"{_want} — {_why}. Got: {_got}")

    # 🔴 AND THE POPULATION BOUNDARY IS A CLAIM, NOT A COMMENT. Every block in
    # `BLOCK_POPULATION` predates the `wire`/`toolchain` pair — 279's own §7 states check
    # 8's answer in PROSE — so a reader without this boundary would refuse forty shipped
    # documents for not anticipating 280, which is `block_assetlib`'s rule at 272 and the
    # one repair `population_block_shape` says out loud it must never accept.
    claims += 1
    _old, _ = release_verdict_problems(_blk("1.82.0"), RELEASE_VERDICT_FROM - 1,
                                       _prev_1810)
    if _old:
        failed += 1
        print(f"  🔴 RELEASE_VERDICT_BOUNDARY a block older than {RELEASE_VERDICT_FROM} "
              f"was refused for not carrying a pair that did not exist when it shipped "
              f"— {_old}")

    # 🔴 AND THE BUMP IS DERIVED. A block that could NAME its own bump could name the one
    # that passes, which is the entire failure mode 1.82.0 is an instance of.
    for _prev, _now, _want in (("1.81.0", "1.82.0", "MINOR"), ("1.82.0", "1.82.1", "PATCH"),
                               ("1.82.1", "2.0.0", "MAJOR"), ("1.82.1", "1.82.1", "PATCH")):
        claims += 1
        _b, _w = release_bump(_prev, _now)
        if _b != _want or _w:
            failed += 1
            print(f"  🔴 RELEASE_BUMP {_prev} -> {_now} read as {_b!r} ({_w}), want "
                  f"{_want!r} — semver is not a matter of opinion and this is the one "
                  f"input to check 8 the block is not allowed to supply")
    claims += 1
    _b, _w = release_bump("1.82.1", "1.82.0")
    if _b or "BACKWARDS" not in _w:
        failed += 1
        print(f"  🔴 RELEASE_BUMP_BACKWARDS 1.82.1 -> 1.82.0 read as {_b!r} ({_w}) — a "
              f"version going backwards is not a PATCH, it is a block that cannot be read")

    # ── 🆕 280 — ONE FIXTURE PER COLUMN, IN BOTH DIRECTIONS ──────────────────────────
    #
    # 🔴 AN AGGREGATE CANNOT BE WRONG ABOUT A MEMBER (276, and 279 §5 paid for it in a
    # different roster in the same tree). The three claims above drive `objects` and
    # would pass unchanged if `dist`, `addon`, `engine` and `network` were decoration:
    # each new column needs its own supplying job and its own withholding one, or the
    # table has four predicates nothing has ever exercised.
    _J = ("name: {name}\n"
          "on:\n"
          "{trigger}"
          "jobs:\n"
          "  the-job:\n"
          "    runs-on: ubuntu-latest\n"
          "    steps:\n"
          "      - uses: actions/checkout@v6\n"
          "{supply}"
          "      - run: {cmd}\n")
    _PUSH, _CRON = "  push:\n", "  schedule:\n    - cron: '0 6 * * 1'\n"
    _BUILD_STEP = "      - run: npm run build\n"
    _STAGE_STEP = "      - run: npm run stage-addon\n"
    _GODOT_STEP = ("      - run: |\n"
                   "          echo \"GODOT_BIN=$PWD/godot\" >> \"$GITHUB_ENV\"\n")
    for _inp, _cmd, _supply, _short in (
        (INPUT_DIST, "node scripts/wire_invisible_gate.mjs", _BUILD_STEP,
         "a job with no `npm run build` hands the surface reader an empty `dist/`, and "
         "it prints UNREACHABLE rather than a surface"),
        (INPUT_ADDON, "python3 scripts/release_names.py --assert-map", _STAGE_STEP,
         "a job with no `npm run stage-addon` packs a tarball whose `addon` root does "
         "not exist, and check 3 agrees with itself about a root neither direction sees"),
        (INPUT_ENGINE, "node test-integration/set-property-verify.integration.mjs",
         _GODOT_STEP,
         "a job that never exports `GODOT_BIN` has no engine to ask what it stored — "
         "`integration.yml` names that job itself: `vcs-plane`, *the one plane that "
         "needs NO Godot*"),
    ):
        _row = {command_norm(_cmd): {_inp: "fixture"}}
        claims += 1
        _ok, _ = input_problems(
            {"w.yml": _J.format(name="w", trigger=_PUSH, supply=_supply, cmd=_cmd)}, _row)
        _bad, _ = input_problems(
            {"w.yml": _J.format(name="w", trigger=_PUSH, supply="", cmd=_cmd)}, _row)
        if len(_ok) != 0 or len(_bad) != 1:
            failed += 1
            print(f"  🔴 GATE_INPUT_{_inp.upper()} supplying job -> {len(_ok)} "
                  f"problem(s) (want 0), withholding job -> {len(_bad)} (want 1) — "
                  f"{_short}. Got: {_ok or _bad}")

    # 🔴 AND `network` IS THE COLUMN WHOSE PROVIDER IS THE WORKFLOW AND NOT THE JOB, so
    # its two fixtures differ in the TRIGGER BLOCK and in nothing else. This is the
    # claim that would have refused 279 §9's near-miss in advance: `assetlib_sweep.py`'s
    # offline half moved into `ci.yml` that session and its live half must never follow.
    claims += 1
    _nrow = {"python3 assetlib_sweep.py --check": {INPUT_NETWORK: "fixture"}}
    _ncmd = "python3 scripts/assetlib_sweep.py --check"
    _n_ok, _ = input_problems(
        {"sdk-drift.yml": _J.format(name="d", trigger=_CRON, supply="", cmd=_ncmd)}, _nrow)
    _n_bad, _ = input_problems(
        {"ci.yml": _J.format(name="ci", trigger=_PUSH, supply="", cmd=_ncmd)}, _nrow)
    if len(_n_ok) != 0 or len(_n_bad) != 1:
        failed += 1
        print(f"  🔴 GATE_INPUT_NETWORK schedule-only -> {len(_n_ok)} problem(s) (want "
              f"0), merge-blocking -> {len(_n_bad)} (want 1) — a reading whose subject "
              f"is the WORLD must not be able to fail a pull request. Got: "
              f"{_n_ok or _n_bad}")

    # 🔴 AND THE TWO TABLE-SHAPED WAYS TO BE WRONG, WHICH ONLY EXIST BECAUSE THERE ARE
    # COLUMNS NOW: a row needing an input no provider defines is a requirement nothing
    # can satisfy, and a provider no row needs is a predicate nothing exercises.
    claims += 1
    _undef, _ = input_problems({"ci.yml": _DEPTH_FULL},
                               {"python3 release_names.py --assert-addon":
                                {INPUT_OBJECTS: "ok", "a-cluster-of-gpus": "invented"}})
    if not any("INPUT_PROVIDERS` does not define" in p for p in _undef):
        failed += 1
        print(f"  🔴 GATE_INPUT_UNDEFINED a row needing an undefined input was accepted "
              f"— {_undef}")
    claims += 1
    _unused = provider_coverage(_DEPTH_ONE)
    if len(_unused) != 4 or provider_coverage(GATE_INPUTS):
        failed += 1
        print(f"  🔴 GATE_INPUT_UNUSED a one-column roster left four of the five "
              f"providers unexercised and this reader did not say so, or the LIVE "
              f"table has a column no row needs — {_unused} / "
              f"{provider_coverage(GATE_INPUTS)}")

    # 🔴 AND THE WALK ITSELF, BECAUSE `on:`'s KEYS SIT AT A JOB'S INDENT. A reader that
    # counted `push` as a job would report it as a job with no checkout, which is the quiet
    # direction — every GATE_INPUTS row would then pass for the wrong reason.
    claims += 1
    _jobs = [n for n, _b in workflow_jobs(_DEPTH_FULL)]
    if _jobs != ["contract-check"]:
        failed += 1
        print(f"  🔴 DEPTH_JOB_WALK -> {_jobs}, want ['contract-check'] — `runs-on:` is the "
              f"discriminator, not the indent: `on:`'s own keys sit at the same depth")

    # 🔴 AND THE DEFAULT IS A DECISION, NOT AN ABSENCE. Collapsing *shallow* into *no
    # checkout at all* is the two-states-one-observable shape this project keeps paying for.
    for _label, _body, _want in (("full", _DEPTH_FULL, "0"),
                                 ("shallow", _DEPTH_SHALLOW, "1"),
                                 ("no checkout", "runs-on: ubuntu-latest\n    steps:\n", None)):
        claims += 1
        _d = job_depth(_body)
        if _d != _want:
            failed += 1
            print(f"  🔴 DEPTH_DEFAULT {_label} -> {_d!r}, want {_want!r} — a missing "
                  f"`fetch-depth:` means ONE commit and must not read as 'no checkout'")

    print(f"HANDOFF_SELFTEST {claims - failed}/{claims} claims, {failed} failed"
          + (f", {unread} unread on this checkout" if unread else ""))
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
            # 🔴 THE FIRST LINE IS THE BANNER, AND THE BANNER IS THE ONE LINE GUARANTEED
            # NOT TO CARRY THE REASON. Until 273 this reported exactly that. When
            # `tree_quiet.py --selftest` refused on `main` at `4abc77d`, and again on the
            # 273 branch, what reached the log both times was its title — *the
            # ADMIT/REFUSE table, each row on a real repository* — while the rows it
            # marked red and the verdict it prints LAST went nowhere. An instrument that
            # refuses has already said why. A reader that prints the greeting instead
            # makes the refusal unactionable and the run unrepeatable, which is 236 §5's
            # class arriving one layer above the counter it was written for.
            # 🔴 SELECTED BY INDEX AND NOT BY FILTER, so the two things worth reading are
            # both here and neither can crowd the other out: the last few lines the
            # instrument MARKED, and the last few it printed at all. A refusal that spells
            # its reason in a marked row is answered by the first; one that dies in a
            # traceback puts the exception's own message on the LAST line, where no marker
            # appears, and is answered by the second. Picking either alone was measured
            # against a fixture broken on purpose and neither showed the cause.
            lines = [ln.rstrip() for ln in printed.split("\n") if ln.strip()]
            marks = [i for i, ln in enumerate(lines)
                     if "🔴" in ln or "FAILED" in ln or "Traceback" in ln]
            keep = set(marks[-4:]) | set(range(max(0, len(lines) - 3), len(lines)))
            tail = [lines[i] for i in sorted(keep)]
            problems.append(
                f"🔴 PATTERN `{key}` — `{' '.join(cmd)}` ran and this row's extract "
                f"{extract!r} matched nothing in its output.\n"
                f"     It exited {rc}, so this is "
                + ("a line that MOVED — the instrument is green and printing something "
                   "else than the row was anchored on"
                   if rc == 0 else
                   "a REFUSAL, and a refusing instrument is a counter nobody can read "
                   "back today — 236 §5's class")
                + "\n     what it printed — the lines it marked, and its last:\n"
                + ("\n".join(f"       | {ln[:200]}" for ln in tail)
                   if tail else "       | (the instrument printed nothing at all)"))
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


# ── 🆕 286 — `git-hooks-unset` (228, fifty-eight sessions) ─────────────────────────
#
# 🔴 THE PICKUP HAS NAMED THIS GAP IN PROSE EVERY SESSION AND NEVER ONCE CHECKED IT.
# `--open` prints `🟡 INHERITED ON TRUST — n atom(s) declared CLONE: … THIS CHECKOUT's
# configuration — hooks, remotes, `git config`` and then inherits it. 228 opened a row
# saying the hook is not installed in a fresh clone, wrote `hook_state()` and
# `--install-hook` in `tree_quiet.py`, and left the reading as a 🟡 NOTE printed on the
# read path when the tree is quiet — *"the honest reading here is that this half is a
# promise, so it is labelled one instead of counted as coverage"*. A promise printed
# beside a green is 211 §19's shape, and it held for fifty-eight sessions.
#
# 🔴 AND 286 IS THE SESSION THAT PAID IT. Three commits were made in a fresh container
# clone with NO hook firing at all, while the identical commit on the device VM was
# refused by it — `GATE_TREE_UNRESTORED`, a killed `floor_pin_gate` leaving its record
# open. Same tree, same commit, one environment protected and one not, and nothing said
# which was which.
#
# 🔴 IT REFUSES AT THE PICKUP BECAUSE THAT IS THE ONE MOMENT EVERY SESSION PASSES
# THROUGH (284 §1.2 — the trigger should be something the session was going to do anyway),
# and because a refusal in CI would be a claim about a machine that never commits.
#
# 🔴 AND IT ASKS WHETHER GIT WOULD RUN *THE TRACKED HOOK*, NOT WHETHER SOME HOOK EXISTS.
# `core.hooksPath` unset resolves to `.git/hooks`, which is untracked by construction, so
# a hand-copied `pre-commit` there would satisfy "an executable hook exists" while being a
# second copy that drifts from the one in the tree. The resolved file must be TRACKED.
#
# 🔵 WHAT IT CANNOT SEE, SAID OUT LOUD (281 §1.2): git has no `diff` or `add` hook, so
# the other half of 228's row is not a thing this or any reader can close — `git add` and
# `git diff` walk into no reader and never will. This covers `git commit`, which is where
# `tree_quiet`'s refusal lives, and it says so rather than implying it covers the row.
def hook_problems(root: "Path" = ROOT) -> "list[str]":
    """Would `git commit` in THIS checkout consult the tracked pre-commit hook?"""
    inside = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], cwd=str(root),
                            capture_output=True, text=True)
    if inside.returncode != 0 or inside.stdout.strip() != "true":
        return []
    got = subprocess.run(["git", "config", "--get", "core.hooksPath"], cwd=str(root),
                         capture_output=True, text=True).stdout.strip()
    resolved = (root / got) if got else (root / ".git" / "hooks")
    hook = resolved / "pre-commit"
    tracked = subprocess.run(["git", "ls-files", "--error-unmatch", str(hook)],
                             cwd=str(root), capture_output=True, text=True).returncode == 0
    if hook.is_file() and os.access(hook, os.X_OK) and tracked:
        return []
    why = (f"`core.hooksPath` is {got or 'unset, so git resolves .git/hooks'}"
           if not (hook.is_file() and os.access(hook, os.X_OK))
           else f"`core.hooksPath` is {got or '.git/hooks'} and the `pre-commit` there is "
                f"not a tracked file, so it is a second copy that drifts")
    return [f"🔴 HOOK_UNINSTALLED {why} — `git commit` in this checkout does NOT "
            f"consult `tree_quiet.py`, so a commit made while a mutating gate's record is "
            f"open is not refused. 286 made three commits in a fresh clone this way while "
            f"the same commit on another machine was refused. Install it with "
            f"`python3 scripts/tree_quiet.py --install-hook`. 🔵 This covers `git commit` "
            f"only: git has no `diff` or `add` hook, which is the half of 228's row "
            f"nothing can close"]


def open_tier(prev: Path, run_network: bool, root: Path = ROOT, log: str = "") -> int:
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

    # ── 🆕 277 §3 — and BEFORE any counter is inherited: is `main` green at HEAD? ──────
    head_problems, head_notes = main_head_problems(log, run_network, head)
    for n in head_notes:
        print(f"  · {n}")

    # ── 🆕 284 — 253's RULE, NAMED AT THE MOMENT IT APPLIES ───────────────────────────
    #
    # `population_currency` cannot refuse here and must not: at a pristine pickup the
    # block being opened against is correctly absent, because a session does not register
    # its own. What this reader CAN do is the half that was missing — say the sentence
    # while it is still cheap to act on, addressed to the session that has to act, with
    # the name of the block and the number of sessions that have paid for reading it late.
    #
    # 🔴 IT IS NOT A WARNING STANDING ALONE, WHICH IS THE WHOLE POINT. 241, 282 and 283
    # each read a louder warning than this one, in a document, and missed it anyway. This
    # line is the reminder; `POPULATION_CURRENCY` in `--selftest` is the refusal, and it
    # arrives on the first commit that touches `QUEUE.md`. A rule enforced only by a
    # sentence gets discovered at the close — so the sentence now has something behind it.
    if session is not None and session not in {s for s, _ in BLOCK_POPULATION}:
        print(f"  · 🔵 FIRST ACTION — {session}'s status block is not in "
              f"`BLOCK_POPULATION` yet, which is correct at a pickup and wrong by the "
              f"first commit. 253's rule puts it in THIS session's FIRST PR; "
              f"`POPULATION_CURRENCY` refuses as soon as `QUEUE.md` reads "
              f"{session + 1}. 241, 282 and 283 each paid a second PR for reading "
              f"that sentence in a document instead of from a gate")

    # ── the counter line: bound, floored, and NOT re-run ──────────────────────────────
    block, _ = status_block(text)
    atoms, why2 = counter_atoms(block)
    if why2:
        print(f"🔴 HANDOFF_OPEN {why2}")
        return 1
    problems: "list[str]" = list(head_problems)
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
    h_problems, h_notes, h_atoms, h_compared = check_header(block, log, run_network,
                                                            session)
    for n in h_notes:
        print(f"  · {n}")
    problems.extend(h_problems)

    # 🆕 281 — AND THE SENTENCE BELOW NAMES ITS OWN POPULATION NOW. It has said since
    # 240 that *a counter which is a fact about the machine rather than the tree will
    # disagree* at the close, and for forty-one sessions nothing anywhere knew WHICH.
    # `counter-provenance-undeclared` (280) is that gap, and this is the line it was
    # opened over: the inheriting session is told, at the moment it inherits, exactly
    # which of the thirty-five it is inheriting on trust.
    # 🔴 282 — AND THE LOOKUP WAS OVER THE WRONG VARIABLE, SO THIS LINE HAS NEVER
    # ONCE BEEN RIGHT. `atoms` holds the block's atom TEXT — `'904/904'`,
    # `'contract 30/30'`, `'26 CI jobs'` — and `COUNTER_PROVENANCE` is keyed by
    # READER NAME (`host.suite`, `contract.checks`). The intersection of the two
    # is EXACTLY ZERO, so every lookup missed and `.get(k, TRACKED)` answered with
    # the reassuring default: 281's own pickup printed *35 of the 35 are declared
    # TRACKED and cannot [disagree]* over a table declaring 24 INDEX, 1 CLONE and
    # 1 MACHINE, and 282's pickup printed it again. `keys`, built ten lines above
    # by `bind()`, is the population this table is written in.
    #
    # 🔴 A DEFAULT IS WHAT MADE IT SILENT, AND THE DEFAULT IS GONE. `.get(k,
    # TRACKED)` turns *this key is not in the table* into *this counter is the
    # safest class there is* — UNREAD REPORTED AS GREEN, which is the rule 281
    # wrote for `UPSTREAM_DEFERRED` two hundred lines away in this same file. A
    # bound key with no row is a PROBLEM now, so the table cannot go quiet about
    # a counter again.
    #
    # 🔵 AND WHAT WOULD HAVE CAUGHT IT IS WHAT 281 ITSELF CONCLUDED: a derivation
    # is trustworthy only when something compares it to a fact the tree already
    # holds. The counts below are now asserted against `COUNTER_PROVENANCE` by
    # `PROVENANCE_PICKUP_POPULATION` in `selftest()`, which is that comparison.
    problems += hook_problems(root)
    undeclared = sorted(k for k in keys if k not in COUNTER_PROVENANCE)
    for k in undeclared:
        problems.append(f"🔴 COUNTER_PROVENANCE has no row for `{k}` — the pickup "
                        f"cannot say whether inheriting it is safe, and an unread "
                        f"subject is not a TRACKED one")
    not_tracked = sorted(k for k in keys
                         if k in COUNTER_PROVENANCE and COUNTER_PROVENANCE[k] != TRACKED)
    if not_tracked:
        by_subject: "dict[str, list[str]]" = {}
        for k in not_tracked:
            by_subject.setdefault(COUNTER_PROVENANCE[k], []).append(k)
        for subj, ks in sorted(by_subject.items()):
            print(f"  · 🟡 INHERITED ON TRUST — {len(ks)} atom(s) declared {subj}: "
                  f"{', '.join(ks)}. {SUBJECT_SIGNALS[subj][0].split('.')[0]}. These "
                  f"are the ones that can honestly disagree at the close")
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
          f"than the tree will disagree — {len(keys) - len(not_tracked)} of the "
          f"{len(keys)} bound reader(s) are declared TRACKED and cannot.")
    return 0


def declared_tier(text: str) -> "str | None":
    m = TIER_DECLARE_RE.search(text)
    return m.group(1).upper() if m else None


def main(argv: "list[str]") -> int:
    if "--selftest" in argv:
        return selftest()
    if "--gh-open" in argv:
        return gh_emit()
    # 🆕 287 — the fifth world reading, emitted the same way and for the same reason.
    # It takes the run id because a verdict with no run is a green with no subject.
    if "--gh-verdict" in argv:
        rest = [a for a in argv[argv.index("--gh-verdict") + 1:] if not a.startswith("--")]
        if not rest:
            print("🔴 --gh-verdict needs the run id whose artifacts the close will read")
            return 2
        return verdict_emit(rest[0])
    # 🆕 271 §1 — `--measured` IS PARSED BEFORE `--open` NOW, and the reorder is the whole
    # of the fix. 241 §1 recorded that `--open` *returns from `main()` before `--measured`
    # is even parsed*, which made a log-supplied reading unavailable at exactly the tier
    # that re-reads the world; with UNREAD now refusing a claim, an environment that
    # cannot dial had no route left but to drop the counter. It has one: run
    # `--gh-open` wherever the reading is available, and hand the file to `--open`.
    # 🆕 274 — `--measured` TAKES A DIRECTORY NOW, because `gh run download` produces
    # one. A file is still a file and still carries no provenance; everything downstream
    # branches on the `CI_MEASURED` line rather than on the shape of this argument.
    log, parts, measured = "", [], ""
    if "--measured" in argv:
        measured = argv[argv.index("--measured") + 1]
        log, parts = read_measured(Path(measured))
    if "--open" in argv:
        rest = [a for a in argv[argv.index("--open") + 1:] if not a.startswith("--")]
        rest = [a for a in rest if not log or a != argv[argv.index("--measured") + 1]]
        if not rest:
            print("🔴 --open needs the PREVIOUS session's handoff")
            return 2
        return open_tier(Path(rest[0]).resolve(), run_network="--network" in argv,
                         log=log)
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
        run_network="--network" in argv, parts=parts, measured=measured)
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
