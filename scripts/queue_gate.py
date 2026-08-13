#!/usr/bin/env python3
"""The queue, read the way every other table in this tree is read.

🔴 THE SECTION THAT SAYS WHAT SHOULD HAPPEN NEXT WAS THE ONE TABLE NOTHING OPENED.
`handoff_gate.py` binds every atom of a status block to the instrument that printed it and
refuses over a single disagreement. It parses the block, the header row and the replay
fence. It has never parsed §6. Every number in a handoff is checked to the digit; the list
of work is prose, in a file `.gitignore` keeps out of the tree, where no gate could reach
it even if one wanted to.

WHAT THAT COST, MEASURED BEFORE THIS FILE WAS WRITTEN:
  Across 220–239 the Open section held 20–25 items and never drained. Generation and
  closure were equal and the composition never changed, because what a session closed was
  always what the previous session had created. Ages at 239: the review charter's P0 open
  34 sessions, `D1b` 33, the `declared-outside-this-file` five 25, `prepack` 24. Four
  sessions in a row (236–239) closed items and closed ONLY items opened by the session
  immediately before them. Nothing was red. Nothing could be.

WHY THE AGES ARE NOT A COLUMN:
  🔴 THE TYPED AGES DISAGREED WITH EACH OTHER ABOUT THEIR OWN CONVENTION. 239 carried
  `_gate_lock` as "Thirteenth session carried" from 228 and the `declared-outside` five as
  "twenty-fifth" from 214 — one counting inclusive of the opening session, the other from
  the session after. Two rows, two conventions, no reader, in a document whose whole
  subject is counters nobody restates. So `age` is DERIVED from `opened` and `QUEUE_HEAD`
  and there is nowhere to write one. **The strongest available pin on a number nobody
  rechecks is to delete the place it can be typed** — which is the shape 234's
  `FLOOR_PIN_LITERAL` finding wanted and could not have, because an instrument's output
  has to be printed somewhere.

WHY THE TABLE IS TRACKED AND THE HANDOFF IS NOT:
  238 embedded twelve status blocks in `handoff_gate.py` because `.gitignore` carries
  `HANDOFF*.md`, so a walk of the directory measures them on the authoring machine and
  ZERO in CI and in a fresh clone. The queue has the same problem and the opposite fix
  available: it is not a record of what a session measured, it is the state of the
  project, so it belongs IN the tree where CI reads it on every PR. The handoff's §6
  becomes a RENDERING of this file (`--render`), which is why `--render` prints computed
  ages: a handoff that types its own is a handoff that can drift from the table again.

WHAT IT DOES NOT CLAIM:
  🔴 `QUEUE_NOT_ONLY_NEWEST` IS SATISFIABLE BY CLOSING A TRIVIAL OLD ROW, AND A SESSION
  THAT WANTS TO GAME IT CAN. It is not a guarantee that the queue drains and it is not a
  measure of effort. It refuses exactly one thing: a session reporting closed queue items
  when every item it closed was one it had just invented. That was true of 236, 237, 238
  and 239, it was the mechanism by which a 34-session-old item stayed 34 sessions old, and
  no instrument in this repository said a word about it.

  🔴 AND `AGE_CEILING` DOES NOT DEMAND THE WORK. It demands a decision. An item nobody has
  elected in twenty-five sessions is a decision not to do it that nobody wrote down, and
  the cost of not writing it down is that it is re-read, re-priced and re-carried by every
  session after it. `SCHEDULED` with a target and `KILLED` with a reason are both fine
  answers. `OPEN` for the twenty-sixth session is not an answer.

Run:  python3 scripts/queue_gate.py
      python3 scripts/queue_gate.py --render      # the handoff's §6, ages computed
      python3 scripts/queue_gate.py --ages        # every row, oldest first
      python3 scripts/queue_gate.py --selftest
"""

from __future__ import annotations

import contextlib
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "QUEUE.md"

# ── THE CEILING AND THE SPAN ──────────────────────────────────────────────────────────
#
# 🔴 BOTH ARE POLICY AND BOTH ARE PINNED IN `SIZE_LEDGER`, because a ceiling a session can
# quietly raise to make its own queue green is a ceiling that measures nothing. Moving
# either is a deliberate act with a ledger row saying why, which is the same argument
# `TARGET_FLOOR` has carried since 190 and for the same reason.
AGE_CEILING = 8          # governed by floor_pin_gate's SIZE_LEDGER
# an item opened at `head` or `head - 1` is this session's own or the previous session's;
# closing only those is the loop. `>= 2` is the smallest span that has an opinion, and the
# opinion it has is the one four consecutive sessions would have failed.
SELF_GENERATED_SPAN = 2
QUEUE_ROW_FLOOR = 20     # governed by floor_pin_gate's SIZE_LEDGER

STATES = ("OPEN", "SCHEDULED", "DONE", "KILLED")
NONE = "—"

FORMAT_RE = re.compile(r"<!--\s*QUEUE_FORMAT\s+(\d+)\s*-->")
HEAD_RE = re.compile(r"<!--\s*QUEUE_HEAD\s+(\d+)\s*-->")
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# 🔴 THE POPULATION IS THE ROW, NOT THE LINE. `QUEUE.md` carries a second table (the one
# describing what this gate refuses) and a reader that scanned every pipe-delimited line
# would read its rows as queue items — silently, and with ids that are English. The queue
# table is the one whose header row declares the queue's own columns, and nothing else in
# the file may declare them.
COLUMNS = ("id", "state", "opened", "closed", "target", "title", "why")


class Row:
    __slots__ = COLUMNS + ("lineno",)

    def __init__(self, cells: "list[str]", lineno: int) -> None:
        for name, cell in zip(COLUMNS, cells):
            setattr(self, name, cell)
        self.lineno = lineno

    def age(self, head: int) -> int:
        return head - int(self.opened)

    def __repr__(self) -> str:      # pragma: no cover — diagnostics only
        return f"<{self.id} {self.state} opened={self.opened}>"


def _cells(line: str) -> "list[str]":
    line = line.strip()
    if not line.startswith("|") or not line.endswith("|"):
        return []
    return [c.strip() for c in line[1:-1].split("|")]


def parse(text: str) -> "tuple[int, int, list[Row], list[str]]":
    """(format, head, rows, problems). Problems here are STRUCTURAL — a file this
    function could not read is a file whose claims below would all pass vacuously, which
    is `CLAIM_FLOOR`'s argument one document over."""
    problems: "list[str]" = []
    m = FORMAT_RE.search(text)
    if not m:
        return (0, 0, [], ["🔴 QUEUE_PARSE no `<!-- QUEUE_FORMAT n -->` marker — this "
                           "reader cannot tell an empty queue from a file it failed to "
                           "open, and one of those is green"])
    fmt = int(m.group(1))
    m = HEAD_RE.search(text)
    if not m:
        return (fmt, 0, [], ["🔴 QUEUE_PARSE no `<!-- QUEUE_HEAD n -->` marker — every "
                             "age below is derived from it and a missing head derives "
                             "zero ages over any number of rows"])
    head = int(m.group(1))

    rows: "list[Row]" = []
    in_table = False
    for lineno, line in enumerate(text.split("\n"), 1):
        cells = _cells(line)
        if not cells:
            in_table = False
            continue
        if [c.lower() for c in cells] == list(COLUMNS):
            in_table = True
            continue
        if not in_table:
            continue
        if all(set(c) <= set("-: ") for c in cells) and cells:
            continue                                    # the |---|---| separator
        if len(cells) != len(COLUMNS):
            problems.append(f"🔴 QUEUE_PARSE line {lineno}: {len(cells)} cell(s), "
                            f"{len(COLUMNS)} column(s) — {line.strip()[:80]!r}")
            continue
        rows.append(Row(cells, lineno))
    return (fmt, head, rows, problems)


def check(text: str) -> "tuple[list[str], list[str], int, int]":
    """(problems, notes, rows read, open rows)."""
    fmt, head, rows, problems = parse(text)
    notes: "list[str]" = []
    if problems and not rows:
        return (problems, notes, 0, 0)

    # ── QUEUE_PARSE ───────────────────────────────────────────────────────────────────
    seen: "dict[str, int]" = {}
    for r in rows:
        if not ID_RE.match(r.id):
            problems.append(f"🔴 QUEUE_PARSE line {r.lineno}: id {r.id!r} is not a slug — "
                            f"an id is what a handoff, a commit and this table use to "
                            f"mean the same row, so it may not be prose")
        if r.id in seen:
            problems.append(f"🔴 QUEUE_PARSE line {r.lineno}: id {r.id!r} is already "
                            f"declared on line {seen[r.id]} — two rows with one id are "
                            f"one row whichever of them a reader reaches first")
        seen[r.id] = r.lineno
        if r.state not in STATES:
            problems.append(f"🔴 QUEUE_PARSE line {r.lineno}: state {r.state!r} is not "
                            f"one of {'/'.join(STATES)}")
        for field in ("opened", "closed", "target"):
            v = getattr(r, field)
            if v != NONE and not v.isdigit():
                problems.append(f"🔴 QUEUE_PARSE line {r.lineno}: {field}={v!r} is "
                                f"neither a session number nor {NONE!r}")
        if r.opened == NONE:
            problems.append(f"🔴 QUEUE_PARSE line {r.lineno}: {r.id} has no `opened` — "
                            f"every age in this file is derived from it")
        if not r.title or r.title == NONE:
            problems.append(f"🔴 QUEUE_PARSE line {r.lineno}: {r.id} has no title")

    if len(rows) < QUEUE_ROW_FLOOR:
        problems.append(f"🔴 QUEUE_ROW_FLOOR {len(rows)} row(s) < {QUEUE_ROW_FLOOR}. "
                        f"Closed rows STAY in this table — they are the only record the "
                        f"decision was taken — so the count only ever goes up, and a "
                        f"parse that quietly stopped matching looks exactly like a queue "
                        f"somebody drained")
    if problems:
        return (problems, notes, len(rows), 0)

    # ── QUEUE_FIELDS — a state carrying a field it must not is a contradiction ─────────
    for r in rows:
        need_closed = r.state in ("DONE", "KILLED")
        if need_closed and r.closed == NONE:
            problems.append(f"🔴 QUEUE_FIELDS {r.id} is {r.state} with no `closed` "
                            f"session — a decision with no date is a decision nobody can "
                            f"age")
        if not need_closed and r.closed != NONE:
            problems.append(f"🔴 QUEUE_FIELDS {r.id} is {r.state} and carries "
                            f"closed={r.closed} — an unclosed row with a closing session "
                            f"is a contradiction, not a note")
        if r.state == "SCHEDULED" and r.target == NONE:
            problems.append(f"🔴 QUEUE_FIELDS {r.id} is SCHEDULED with no `target`. "
                            f"SCHEDULED without a target is OPEN with the ceiling "
                            f"laundered off it, which is the loophole this row exists to "
                            f"close")
        if r.state != "SCHEDULED" and r.target != NONE:
            problems.append(f"🔴 QUEUE_FIELDS {r.id} is {r.state} and carries "
                            f"target={r.target}")
        if r.state == "KILLED" and (not r.why or r.why == NONE):
            problems.append(f"🔴 QUEUE_FIELDS {r.id} is KILLED with no `why`. A killed "
                            f"item with no reason is indistinguishable from a row that "
                            f"fell out of the table, and the next session cannot tell "
                            f"whether to reopen it")

    # ── QUEUE_AGE_CEILING — the loop-breaker's first half ─────────────────────────────
    for r in rows:
        if r.state != "OPEN":
            continue
        age = r.age(head)
        if age > AGE_CEILING:
            problems.append(
                f"🔴 QUEUE_AGE_CEILING {r.id} opened {r.opened}, OPEN for {age} session(s)"
                f" > {AGE_CEILING}. The ceiling does not ask for the work — SCHEDULE it "
                f"with a target session, or KILL it with a reason. An item nobody has "
                f"elected in {age} sessions is a decision not to do it that nobody wrote "
                f"down")

    # ── QUEUE_SCHEDULE_HONOURED — the half without which SCHEDULED means nothing ───────
    for r in rows:
        # 🔴 A ROW WITH NO TARGET IS `QUEUE_FIELDS`' FINDING, NOT THIS ONE, and reading
        # it here crashed the first run of this file. Two claims reaching for the same
        # missing cell is how a gate reports the second-best reason for a refusal — 236
        # §4's class, caught by its own self-test on the day it was written.
        if r.state != "SCHEDULED" or r.target == NONE:
            continue
        if int(r.target) < head:
            problems.append(
                f"🔴 QUEUE_SCHEDULE_HONOURED {r.id} was scheduled for {r.target} and the "
                f"head is {head}, and it is still not closed. Re-target it deliberately "
                f"or KILL it — a schedule nobody re-reads is the prose this table "
                f"replaced")

    # ── QUEUE_NOT_ONLY_NEWEST — the loop ──────────────────────────────────────────────
    # 🔴 AND A KILL IS NOT A CLOSURE — 241 §2, FOUND BY THE GATE FIRING ON ITS AUTHOR.
    # The first draft counted any old row closed at `head`, and the very first session
    # under it satisfied the claim by KILLING five items it had no intention of doing.
    # That is the caveat this file printed about itself — *"satisfiable by closing a
    # trivial old row, and a session that wants to game it can"* — arriving one session
    # later, in the session that wrote the caveat, without anybody gaming anything. A
    # decision to abandon work is a decision, and `AGE_CEILING` is the row that asks for
    # it; progress is `DONE`, and only `DONE` counts here.
    closed_now = [r for r in rows if r.closed != NONE and int(r.closed) == head]
    if closed_now:
        old = [r for r in closed_now
               if r.age(head) >= SELF_GENERATED_SPAN and r.state == "DONE"]
        if not old:
            killed = [r for r in closed_now if r.state == "KILLED"]
            ids = ", ".join(f"{r.id} ({r.state}, opened {r.opened})" for r in closed_now)
            problems.append(
                f"🔴 QUEUE_NOT_ONLY_NEWEST session {head} closed {len(closed_now)} "
                f"item(s) and not one of them is an item it did not create and actually "
                f"FINISHED: {ids}. Closing only what you or the session before you "
                f"invented is the shape 236–239 held for four sessions while a "
                f"34-session-old row sat untouched"
                + (f" — and {len(killed)} KILL(s) do not answer it. A kill is a decision, "
                   f"which `AGE_CEILING` is the row that asks for; this row asks for "
                   f"progress" if killed else "")
                + ". Finish one thing you did not create")
        else:
            notes.append(f"QUEUE_NOT_ONLY_NEWEST satisfied by "
                         f"{', '.join(r.id for r in old)}")
    else:
        notes.append(f"QUEUE_NOT_ONLY_NEWEST has no opinion — session {head} closed "
                     f"nothing, and a session that closed nothing has not closed only "
                     f"its own")

    n_open = sum(1 for r in rows if r.state == "OPEN")
    return (problems, notes, len(rows), n_open)


def render(text: str) -> int:
    """The handoff's §6, with every age derived. 🔴 A handoff that types its own ages is
    a handoff that can drift from this table, which is the defect this file was built for
    arriving one document later."""
    _fmt, head, rows, problems = parse(text)
    if problems:
        for p in problems:
            print(p)
        return 1
    live = [r for r in rows if r.state in ("OPEN", "SCHEDULED")]
    live.sort(key=lambda r: (r.state != "OPEN", -r.age(head)))
    print(f"### Open — rendered from `QUEUE.md` at head {head}, ages derived\n")
    for r in live:
        age = r.age(head)
        tail = (f"— **scheduled {r.target}**" if r.state == "SCHEDULED" else
                f"— **OPEN, {AGE_CEILING - age} session(s) of ceiling left**")
        print(f"- `{r.id}` · opened {r.opened} · **{age} session(s)** {tail}\n"
              f"  {r.title}")
    closed = [r for r in rows if r.closed != NONE and int(r.closed) == head]
    if closed:
        print("\n### Closed this session\n")
        for r in closed:
            print(f"- `{r.id}` · {r.state} · opened {r.opened}, "
                  f"**{r.age(head)} session(s) old** — {r.title}"
                  + (f"\n  **why:** {r.why}" if r.state == "KILLED" else ""))
    return 0


def ages(text: str) -> int:
    _fmt, head, rows, problems = parse(text)
    if problems:
        for p in problems:
            print(p)
        return 1
    rows.sort(key=lambda r: -r.age(head))
    print(f"{'id':<26} {'state':<10} {'opened':>6} {'age':>4}")
    for r in rows:
        print(f"{r.id:<26} {r.state:<10} {r.opened:>6} {r.age(head):>4}")
    print(f"QUEUE_AGES {len(rows)} row(s) at head {head}")
    return 0


# ══ SELF-TEST ═════════════════════════════════════════════════════════════════════════
#
# 🔴 EVERY CLAIM ABOVE GETS A NEGATIVE CONTROL, BECAUSE A GATE THAT HAS NEVER REFUSED IS
# A GATE NOBODY HAS TESTED — 239's own finding about `git.moved`, which answered 1 for
# twelve blocks and could not have answered anything else. The fixtures below are the
# smallest tables that make each claim the ONLY thing wrong.

HEAD = 240


def _table(rows: "list[str]", head: int = HEAD, fmt: int = 1) -> str:
    pad = [f"| filler-{i} | DONE | 100 | 101 | — | filler | — |"
           for i in range(QUEUE_ROW_FLOOR)]
    return ("<!-- QUEUE_FORMAT %d -->\n<!-- QUEUE_HEAD %d -->\n\n" % (fmt, head)
            + "| " + " | ".join(COLUMNS) + " |\n"
            + "|" + "---|" * len(COLUMNS) + "\n"
            + "\n".join(rows + pad) + "\n")


GOOD = ["| alpha | OPEN | 238 | — | — | a fresh one | — |",
        "| beta | SCHEDULED | 220 | — | 242 | an old one with a date | — |",
        "| gamma | KILLED | 205 | 240 | — | an old one with a reason | not worth it |",
        "| delta | DONE | 214 | 240 | — | an old one, closed | — |"]


def selftest() -> int:
    fails: "list[str]" = []
    claims = 0

    def claim(name: str, ok: bool, detail: str = "") -> None:
        nonlocal claims
        claims += 1
        if not ok:
            fails.append(f"🔴 {name} {detail}")

    def red(name: str, rows: "list[str]", token: str, head: int = HEAD) -> None:
        problems, _n, _r, _o = check(_table(rows, head))
        hit = [p for p in problems if token in p]
        claim(name, bool(hit),
              f"expected a {token} refusal, got: "
              + ("; ".join(p[:90] for p in problems) if problems else "NOTHING — the "
                 "fixture passed, which is a gate that cannot fail"))

    # ── the positive control comes first: a table with nothing wrong must be silent ────
    problems, notes, n_rows, n_open = check(_table(GOOD))
    claim("QUEUE_CLEAN", not problems,
          "a table with nothing wrong refused: " + "; ".join(p[:100] for p in problems))
    claim("QUEUE_CLEAN_ROWS", n_rows == len(GOOD) + QUEUE_ROW_FLOOR,
          f"read {n_rows} rows, expected {len(GOOD) + QUEUE_ROW_FLOOR}")
    claim("QUEUE_CLEAN_OPEN", n_open == 1, f"counted {n_open} OPEN, expected 1")
    claim("QUEUE_CLEAN_SATISFIED",
          any("NOT_ONLY_NEWEST satisfied" in n for n in notes),
          "the clean fixture closes two old rows and the note did not say so")

    # ── QUEUE_PARSE ───────────────────────────────────────────────────────────────────
    p, _n, _r, _o = check("no markers here at all")
    claim("PARSE_NO_FORMAT", any("QUEUE_FORMAT" in x for x in p),
          "a file with no format marker parsed")
    p, _n, _r, _o = check("<!-- QUEUE_FORMAT 1 -->\nnothing else")
    claim("PARSE_NO_HEAD", any("QUEUE_HEAD" in x for x in p),
          "a file with no head marker parsed, so every age would derive from zero")
    red("PARSE_BAD_ID", GOOD + ["| Not A Slug | OPEN | 239 | — | — | t | — |"],
        "is not a slug")
    red("PARSE_DUPLICATE_ID", GOOD + ["| alpha | OPEN | 239 | — | — | t | — |"],
        "already declared")
    red("PARSE_BAD_STATE", GOOD + ["| eps | PENDING | 239 | — | — | t | — |"],
        "is not one of")
    red("PARSE_BAD_SESSION", GOOD + ["| eps | OPEN | soon | — | — | t | — |"],
        "neither a session number")
    red("PARSE_NO_TITLE", GOOD + ["| eps | OPEN | 239 | — | — | — | — |"], "has no title")
    red("PARSE_WIDTH", GOOD + ["| eps | OPEN | 239 | — | — |"], "column(s)")

    # 🔴 THE FLOOR'S OWN CONTROL. A parser that stopped matching reads zero rows, finds
    # zero violations and prints ok — the exact silence `CLAIM_FLOOR` exists for, one
    # file over. The fixture is the good table with the pad removed.
    short = ("<!-- QUEUE_FORMAT 1 -->\n<!-- QUEUE_HEAD 240 -->\n\n| "
             + " | ".join(COLUMNS) + " |\n|" + "---|" * len(COLUMNS) + "\n"
             + "\n".join(GOOD) + "\n")
    p, _n, _r, _o = check(short)
    claim("ROW_FLOOR", any("QUEUE_ROW_FLOOR" in x for x in p),
          f"{len(GOOD)} rows passed a floor of {QUEUE_ROW_FLOOR}")

    # ── QUEUE_FIELDS ──────────────────────────────────────────────────────────────────
    red("FIELDS_DONE_NO_CLOSED", GOOD + ["| eps | DONE | 230 | — | — | t | — |"],
        "with no `closed`")
    red("FIELDS_OPEN_WITH_CLOSED", GOOD + ["| eps | OPEN | 239 | 240 | — | t | — |"],
        "is a contradiction")
    red("FIELDS_SCHEDULED_NO_TARGET", GOOD + ["| eps | SCHEDULED | 230 | — | — | t | — |"],
        "SCHEDULED without a target")
    red("FIELDS_TARGET_ON_OPEN", GOOD + ["| eps | OPEN | 239 | — | 250 | t | — |"],
        "carries target=")
    red("FIELDS_KILLED_NO_WHY", GOOD + ["| eps | KILLED | 230 | 240 | — | t | — |"],
        "KILLED with no `why`")

    # ── QUEUE_AGE_CEILING ─────────────────────────────────────────────────────────────
    red("AGE_CEILING", GOOD + ["| eps | OPEN | 205 | — | — | thirty-five sessions | — |"],
        "QUEUE_AGE_CEILING")
    # and the boundary in both directions, because an off-by-one here is a ceiling that
    # admits the row it was written for.
    p, _n, _r, _o = check(_table(GOOD + [
        f"| eps | OPEN | {HEAD - AGE_CEILING} | — | — | exactly at the ceiling | — |"]))
    claim("AGE_CEILING_ADMITS_EDGE", not any("AGE_CEILING" in x for x in p),
          f"an item exactly {AGE_CEILING} sessions old was refused; the ceiling is "
          f"`> {AGE_CEILING}`, not `>=`")
    p, _n, _r, _o = check(_table(GOOD + [
        f"| eps | OPEN | {HEAD - AGE_CEILING - 1} | — | — | one over | — |"]))
    claim("AGE_CEILING_REFUSES_EDGE", any("AGE_CEILING" in x for x in p),
          f"an item {AGE_CEILING + 1} sessions old passed")
    # 🔴 AND BOTH EDGES ARE PINNED ABSOLUTELY, NOT RELATIVE TO `AGE_CEILING`. The two
    # claims above derive their fixtures FROM the constant, so they hold at every value
    # of it — including zero, which is the mutation `floor_pin_gate` applies. 184 §7:
    # pinning the key is not pinning the value. These two name the sessions.
    p, _n, _r, _o = check(_table(GOOD + [
        "| eps | OPEN | 232 | — | — | eight sessions old | — |"], head=240))
    claim("AGE_CEILING_VALUE_ADMITS", not any("AGE_CEILING" in x for x in p),
          "a row opened at 232 was refused at head 240 — the ceiling is not 8")
    p, _n, _r, _o = check(_table(GOOD + [
        "| eps | OPEN | 231 | — | — | nine sessions old | — |"], head=240))
    claim("AGE_CEILING_VALUE_REFUSES", any("AGE_CEILING" in x for x in p),
          "a row opened at 231 passed at head 240 — the ceiling is not 8")

    # 🔴 AND THE CEILING MUST NOT REACH A ROW SOMEBODY DECIDED. A gate that reddened a
    # KILLED row for being old would make the decision it asks for impossible to record.
    p, _n, _r, _o = check(_table(GOOD))
    claim("AGE_CEILING_SPARES_DECIDED", not any("AGE_CEILING" in x for x in p),
          "a 35-session-old KILLED row and a 20-session-old SCHEDULED row were reddened "
          "by the ceiling, which would make the decision unrecordable")

    # ── QUEUE_SCHEDULE_HONOURED ───────────────────────────────────────────────────────
    red("SCHEDULE_LAPSED",
        GOOD + ["| eps | SCHEDULED | 230 | — | 238 | the target went past | — |"],
        "QUEUE_SCHEDULE_HONOURED")
    p, _n, _r, _o = check(_table(GOOD + [
        f"| eps | SCHEDULED | 230 | — | {HEAD} | targeted at the head | — |"]))
    claim("SCHEDULE_ADMITS_HEAD", not any("SCHEDULE_HONOURED" in x for x in p),
          "a row targeted at the head session was refused, so a session could never "
          "schedule work for itself")

    # ── QUEUE_NOT_ONLY_NEWEST — the loop, and its four historical instances ───────────
    red("ONLY_NEWEST",
        ["| a | OPEN | 205 | — | — | the old one nobody touches | — |",
         f"| b | DONE | {HEAD} | {HEAD} | — | invented and closed today | — |",
         f"| c | DONE | {HEAD - 1} | {HEAD} | — | invented last session | — |"],
        "QUEUE_NOT_ONLY_NEWEST")
    p, _n, _r, _o = check(_table(
        ["| a | OPEN | 238 | — | — | fresh | — |",
         f"| b | DONE | {HEAD} | {HEAD} | — | invented today | — |",
         f"| c | DONE | {HEAD - SELF_GENERATED_SPAN} | {HEAD} | — | an older one | — |"]))
    claim("ONLY_NEWEST_SATISFIED", not any("NOT_ONLY_NEWEST" in x for x in p),
          "closing one item older than the span was still refused")
    # 🔴 THE KILL CONTROL — 241 §2, the claim the first draft did not make. A session
    # that closes its own two inventions and kills five ancient rows has decided five
    # things and finished none, and the first draft called that satisfied.
    red("ONLY_NEWEST_KILL_IS_NOT_DONE",
        [f"| a | DONE | {HEAD} | {HEAD} | — | invented and closed today | — |",
         "| b | KILLED | 205 | 240 | — | thirty-five sessions, abandoned | not worth it |",
         "| c | KILLED | 206 | 240 | — | thirty-four sessions, abandoned | nor this |"],
        "QUEUE_NOT_ONLY_NEWEST")
    p, _n, _r, _o = check(_table(
        [f"| a | DONE | {HEAD} | {HEAD} | — | invented and closed today | — |",
         "| b | KILLED | 205 | 240 | — | abandoned | not worth it |",
         f"| c | DONE | 214 | {HEAD} | — | an old one, FINISHED | — |"]))
    claim("ONLY_NEWEST_DONE_ANSWERS", not any("NOT_ONLY_NEWEST" in x for x in p),
          "an old row that was actually finished did not satisfy the claim")

    p, notes, _r, _o = check(_table(["| a | OPEN | 238 | — | — | fresh | — |"]))
    claim("ONLY_NEWEST_ABSTAINS", any("no opinion" in n for n in notes),
          "a session that closed nothing was given an opinion it cannot have — a rule "
          "that fires on absence refuses every session that only opens work")

    # ── 🆕 247 §1 — THE TWO REPORTERS, WHICH NOTHING HAD EVER RUN ────────────────────
    #
    # 🔴 `ages` IS WHERE THIS FILE'S WHOLE PREMISE IS CASHED, AND NO AXIS REACHED IT.
    # The docstring above says the strongest pin on a number nobody rechecks is to delete
    # the place it can be typed — so the number is DERIVED, by this function, and until
    # now `ages` and `render` were called by `--ages` and `--render` and by nothing else:
    # not by this self-test, not by the no-flag live run `instrument_gate.py` blinds, not
    # by a step in ci.yml. Blinded to `return 0` both went green on BOTH axes (measured,
    # 247). A deriver nothing exercises is the typed column with an extra step in front.
    #
    # 🔴 AND THE CLAIM IS ON THE PRINTED LINE, NOT ON THE RETURN CODE. Both return an exit
    # code, so a claim about what they RETURN is satisfied by a function that prints
    # nothing at all — which is exactly what the blind produces.
    _cap = io.StringIO()
    with contextlib.redirect_stdout(_cap):
        _rc = ages(_table(GOOD))
    _ages_out = _cap.getvalue()
    claim("AGES_REPORTS",
          _rc == 0 and f"QUEUE_AGES {len(GOOD) + QUEUE_ROW_FLOOR} row(s)" in _ages_out,
          f"the age report over a clean fixture printed {_ages_out!r}")
    # `beta` is opened at 220 against a head of 240, and that arithmetic is the convention
    # 239 found two documents disagreeing about — read here off the REPORT rather than off
    # `Row.age`, so a reporter that stopped calling it cannot pass by agreeing with itself.
    claim("AGES_DERIVES_THE_NUMBER",
          any(ln.split()[:1] == ["beta"] and ln.split()[-1:] == [str(HEAD - 220)]
              for ln in _ages_out.split("\n") if ln.strip()),
          f"no `beta … {HEAD - 220}` line in the age report: {_ages_out!r}")
    _cap = io.StringIO()
    with contextlib.redirect_stdout(_cap):
        _rc = render(_table(GOOD))
    _render_out = _cap.getvalue()
    claim("RENDER_REPORTS",
          _rc == 0 and "`alpha`" in _render_out and "`beta`" in _render_out
          and "scheduled 242" in _render_out,
          f"§6 rendered without its live rows: {_render_out[:200]!r}")
    # 🔴 AND THE CEILING REMAINDER, which is the half of §6 a session reads to decide
    # anything. An OPEN row `HEAD - 238` sessions old has that much of the ceiling left,
    # and the sentence saying so is assembled in `render` from a constant `floor_pin_gate`
    # mutates — so this claim reddens on a zeroed ceiling as well as on a silent reporter.
    claim("RENDER_CEILING_REMAINDER",
          f"{AGE_CEILING - (HEAD - 238)} session(s) of ceiling left" in _render_out,
          f"§6 does not say how much ceiling `alpha` has left: {_render_out[:200]!r}")

    # ── the shipped file, read the way CI will read it ────────────────────────────────
    if QUEUE.is_file():
        p, _n, n_rows, _o = check(QUEUE.read_text(encoding="utf-8"))
        claim("SHIPPED_QUEUE_PARSES", n_rows >= QUEUE_ROW_FLOOR,
              f"the shipped QUEUE.md yielded {n_rows} row(s)")
        claim("SHIPPED_QUEUE_CLEAN", not p,
              "the shipped QUEUE.md refuses: " + "; ".join(x[:120] for x in p))

    for f in fails:
        print(f)
        # 🆕 245 §2 — THE SAME LINE IN THE ONE SPELLING `failure_lines` COUNTS. This gate's
        # reds read `🔴 <NAME> <detail>`, `p0_comments.py`'s read `🔴 <desc> -> False` and
        # `mutation_lock_gate.py`'s read `🔴 <name> unconfined=…`: three house styles, none
        # of them countable, so `instrument_gate.py` measured a blast of ZERO over all three
        # while their self-tests were reporting real failures (244 §4.4, one language over).
        print(f"  FAIL QUEUE_SELFTEST {f[2:].strip()[:90]}")
    print(f"QUEUE_SELFTEST {claims - len(fails)}/{claims} claims"
          + (f", {len(fails)} failed" if fails else ""))
    return 1 if fails else 0


def main(argv: "list[str]") -> int:
    if "--selftest" in argv:
        return selftest()
    if not QUEUE.is_file():
        print(f"🔴 QUEUE_GATE no such file: {QUEUE}")
        return 1
    text = QUEUE.read_text(encoding="utf-8")
    if "--render" in argv:
        return render(text)
    if "--ages" in argv:
        return ages(text)

    problems, notes, n_rows, n_open = check(text)
    _fmt, head, rows, _p = parse(text)
    # 🆕 245 §3 — 🔴 TWO READS OF ONE TABLE THAT HAD NEVER BEEN COMPARED. `check()` parses
    # the file and reports `n_rows`; the line above parses it AGAIN for the ages, and until
    # now nothing asked whether the two agreed. The late blind found it: `parse` is called
    # TWICE on this path, so a reader that answers honestly once and returns nothing
    # afterwards leaves the census line correct — it came from the first call — and empties
    # the population the ceiling is computed over. `oldest` then reads 0 and every OPEN row
    # is under every ceiling. This comparison is one line and it is the whole difference
    # between a number and a number somebody checked.
    if len(rows) != n_rows:
        problems.append(
            f"🔴 QUEUE_REPARSE_DISAGREES check() read {n_rows} row(s) and the re-parse for "
            f"the ages read {len(rows)}. Both are this file reading one table; the ceiling "
            f"below is derived from the SECOND and the census line is printed from the "
            f"FIRST, so a reader that goes quiet between them reports a full table and "
            f"ages nothing")
    for n in notes:
        print(f"  · {n}")
    oldest = max((r.age(head) for r in rows if r.state == "OPEN"), default=0)
    print(f"QUEUE_GATE {n_rows} row(s) at head {head} · {n_open} OPEN · oldest OPEN "
          f"{oldest} session(s) · ceiling {AGE_CEILING} · floor {QUEUE_ROW_FLOOR}")
    for p in problems:
        print(p)
        # 🆕 245 §2 — the countable spelling, on the live half too. `LATE_BLAST_FLOOR`
        # cannot floor an axis whose reds it cannot parse (244 §4.4).
        print(f"  FAIL QUEUE_GATE {p[:90]}")
    if problems:
        print(f"🔴 QUEUE_GATE refused — {len(problems)} problem(s). The queue is the "
              f"list of what this project intends to do, and for twenty sessions it was "
              f"the only table here nothing read.")
        return 1
    print("🟢 QUEUE_GATE ok — every row parses, every state carries the fields it "
          "requires, no OPEN row is past the ceiling, no schedule has lapsed, and this "
          "session did not close only what it invented")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
