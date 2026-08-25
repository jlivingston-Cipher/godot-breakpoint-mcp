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

import collections
import contextlib
import io
import re
import subprocess
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

# ── THE TIER, WHICH IS THE ONE QUESTION THIS TABLE COULD NOT ASK ──────────────────────
#
# 🔴 MEASURED AT 248 AND IT IS THE WHOLE REASON THIS COLUMN EXISTS: of the sixteen live
# rows in this file, ZERO were observable by anyone who installs the package. Twenty-five
# commits had landed since the 1.74.0 tag, 15,664 insertions, and exactly ONE touched a
# file a user can reach. The apparatus that measures this product had grown to 1.77x the
# size of the product.
#
# That is not a queue that got its priorities wrong. It is a queue with no intake: every
# row in it was generated by a session reading the previous session's output, because
# nothing else was feeding it — 0 open issues and 0 pull requests against ~3,700
# downloads. A loop with one input generates rows about itself, and every claim below was
# written to govern a loop it could not see the shape of.
#
# `user`     — an installer or operator of the shipped package can observe it: host/src
#              and addon behaviour, CLI and error copy, packaging, README, USER_GUIDE.
# `internal` — everything else: gates, instruments, the handoff apparatus, CI,
#              contributor tooling. Real work, and none of it reaches a customer.
#
# The line deliberately REFUSES "reaches a user OR provably protects one", which was
# offered and rejected: every gate row in this table can claim to protect a user, so that
# line re-admits the entire internal tier by argument.
REACHES = ("user", "internal")
NONE = "—"

FORMAT_RE = re.compile(r"<!--\s*QUEUE_FORMAT\s+(\d+)\s*-->")
HEAD_RE = re.compile(r"<!--\s*QUEUE_HEAD\s+(\d+)\s*-->")
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# 🔴 THE POPULATION IS THE ROW, NOT THE LINE. `QUEUE.md` carries a second table (the one
# describing what this gate refuses) and a reader that scanned every pipe-delimited line
# would read its rows as queue items — silently, and with ids that are English. The queue
# table is the one whose header row declares the queue's own columns, and nothing else in
# the file may declare them.
COLUMNS = ("id", "state", "reach", "paths", "opened", "closed", "target", "title", "why")

# ── 🆕 271 §3 — `reach-column-joins-nothing` (OPEN 268) ───────────────────────────────
#
# 🔴 THE TIER WAS A PATH PREDICATE THAT EXISTED ONLY AS A SENTENCE. 248 defined `user` by
# the files a row's work touches — `host/src` and addon behaviour, CLI and error copy,
# packaging, `README.md`, `docs/USER_GUIDE.md` — and then asked every session to apply that
# sentence by hand and type the answer in a cell nothing read. Two sessions typed it five
# times in the same direction (`internal` -> `user`, never once back) and 268 read the
# uniformity as a bias in the typist. 269 found the other half: `QUEUE_TIER_ORDER` made
# `user` the only answer that let a session close its work, so the column was not being
# mistyped, it was being SELECTED. Neither reading could be settled, because there was
# nothing to settle it against.
#
# 🔴 SO THE PREDICATE BECOMES A ROSTER AND THE ROW DECLARES ITS PATHS. `reach` is still
# typed — deliberately, because a session knows what it is about to touch and a gate does
# not — but it is now typed BESIDE the evidence and compared to it. The roster is ordered
# and the FIRST match wins, which is what lets `docs/USER_GUIDE.md` sit above `docs/`.
#
# 🔴 ANY `user` PATH MAKES THE ROW `user`, and the asymmetry is 248's line rather than a
# convenience: the tier asks *can an installer observe this*, and one file they can observe
# is enough. A row touching `host/src/` and nine gates reaches a user through the one.
REACH_PATHS: "tuple[tuple[str, str, str], ...]" = (
    ("docs/USER_GUIDE.md",  "user",     "the document a user is told to follow"),
    ("docs/",               "internal", "every other doc is written for whoever works here"),
    ("host/src/",           "user",     "the shipped server: tools, CLI, error copy"),
    ("host/package.json",   "user",     "packaging — what `npm install` resolves"),
    ("host/package-lock.json", "internal", "resolution detail no installer of the "
                                           "published package ever reads"),
    ("host/scripts/",       "internal", "build and gate tooling, not shipped"),
    ("host/test",           "internal", "tests and their fixtures, both trees"),
    ("addons/",             "user",     "the addon a user copies into their project"),
    ("example",             "internal", "fixture projects the gates drive"),
    ("scripts/",            "internal", "the gate and instrument shelf"),
    (".github/",            "internal", "CI and contributor tooling"),
    (".githooks/",          "internal", "contributor tooling"),
    ("README.md",           "user",     "the first page of the package"),
    ("CHANGELOG.md",        "user",     "what an installer reads to decide to upgrade"),
    ("CONTRIBUTING.md",     "internal", "addressed to contributors by its own title"),
    ("CODE_OF_CONDUCT.md",  "internal", "addressed to contributors"),
    ("SECURITY.md",         "user",     "the reporting path a user of the package needs"),
    ("QUEUE.md",            "internal", "this table"),
)

# 🔴 THE ROW IS A PROMISE ABOUT THE TREE AND IT IS CHECKED AGAINST THE TREE. A declared
# path must be one this repository tracks — a prefix is enough, so work that will CREATE
# `scripts/whatever.py` declares `scripts/` and is honest about it, while a path that
# matches nothing is a claim about a file nobody has. That is the half that makes this a
# join rather than a second sentence agreeing with the first.
#
# 🔴 AND IT TURNS ON AT `271` RATHER THAN OVER THE BACK CATALOGUE, for `HEADER_FLOOR`'s
# reason one file over: a roster retro-fitted to ninety-six historical rows would be
# ninety-six guesses about what sessions long finished were touching, typed by somebody
# who was not there. A row opened at or closed at this session or later declares its
# paths; everything older carries `—` and is counted, not excused.
REACH_PATHS_SINCE = 271
# 🆕 272 — LOWERED FROM EIGHTEEN, WHICH IS THE ONLY DIRECTION IT CAN MOVE.
# Five rows closed this session, each declaring the paths its work touched, so five left
# the grandfathered population. The ceiling follows the population DOWN in the commit that
# shrank it — left at eighteen it would be five rows of room to type an unchecked tier,
# bought by work that had nothing to do with the back catalogue.
# 🆕 274 — LOWERED AGAIN, BY ONE, AND THE ROW THAT LEFT IS `replay-ci-flag-granularity`.
# It was opened at 242 with no `paths`, so it sat in the grandfathered population for
# thirty-two sessions; closing it at 274 makes it `due` under `REACH_PATHS_SINCE`, which
# is what forced the declaration rather than allowing the `—` it had carried all along.
# The back catalogue drains one row at a time and only ever by somebody finishing one.
UNDECLARED_CEILING = 13  # governed by floor_pin_gate's SIZE_LEDGER


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
    problems += age_domain(rows, head)
    return (fmt, head, rows, problems)


# ── 🆕 271 §2 — `queue-age-can-be-negative` (OPEN 256, fifteen sessions) ───────────────
#
# 🔴 A DERIVED NUMBER NOBODY BOUNDS IS A TYPED NUMBER WITH A COMPUTATION IN FRONT OF IT,
# which is this file's own header argument turned back on it. `age` is `head - opened` and
# nothing ever asked whether `opened` could be AFTER `head`. It could, and it was: 255
# added `required-any-reachability` with `opened 255` and left `QUEUE_HEAD` at 254, so the
# row rendered at **-1 session(s)** through `--render`, through `--ages` and through
# `QUEUE_AGE_CEILING` — three consumers, each reading a negative age as a number, none of
# them asking whether it was possible. The ceiling is a `>` test, so a negative sails
# through it; the internal tier has no ceiling at all. Nothing went red for fifteen
# sessions because nothing was looking.
#
# 🔴 IT LIVES IN `parse` AND NOT IN `check`, WHICH IS THE WHOLE POINT OF THE ROW. The
# defect was never that one claim mis-fired — it was that EVERY consumer of the table read
# the impossible number and passed it on. `parse` is the one function `check`, `render` and
# `ages` all call, and all three already refuse on what it returns, so a bound placed here
# is a bound none of them can be written without.
#
# 🔴 `target` IS EXEMPT AND SAYS SO. A schedule is a promise about a session that has NOT
# arrived, so `target > head` is the normal state of a scheduled row and the ONLY claim
# with an opinion about it is `QUEUE_SCHEDULE_HONOURED`, which refuses a target that has
# PASSED. Reading it here would refuse every schedule this table exists to carry.
def tracked_prefixes(root: Path = ROOT) -> "set[str]":
    """Every tracked path and every directory prefix of one. TREE, no network.

    🔴 `git ls-files` AND NOT A WALK, for 254's reason one gate over: a walk sees files
    `git add` has not reached and CI's `actions/checkout` clone does not have, so a
    declared path could resolve on the authoring machine and vanish in CI. It is also the
    reader that works on the `--depth 1` clone CI actually uses.
    """
    try:
        p = subprocess.run(("git", "ls-files"), cwd=root, capture_output=True,
                           text=True, timeout=120)
    except (OSError, subprocess.SubprocessError):
        return set()
    if p.returncode != 0:
        return set()
    out: "set[str]" = set()
    for f in p.stdout.split("\n"):
        f = f.strip()
        if not f:
            continue
        out.add(f)
        parts = f.split("/")
        for i in range(1, len(parts)):
            out.add("/".join(parts[:i]) + "/")
    return out


def reach_of(paths: "list[str]") -> "tuple[list[str], list[str]]":
    """(one tier per path, in order; the paths no `REACH_PATHS` row covers).

    🔴 IT RETURNS THE READINGS AND NOT THE VERDICT, which is this row's second draft and
    the difference matters to the harness rather than to the answer. A version returning a
    single tier had to return SOMETHING when it had read nothing, and the only available
    empty for a two-valued field is one of the two values — so a reader that had stopped
    reading was indistinguishable from a reader that found the commoner answer, and
    `instrument_gate.py`'s late axis said so on the first sweep. Returning the list lets
    the caller compare its LENGTH to the paths it handed over: a reader that answered for
    fewer paths than it was given is visible without anybody having to guess which value
    its silence would wear.
    """
    tiers, unknown = [], []
    for p in paths:
        hit = next((t for pat, t, _why in REACH_PATHS if p.startswith(pat)), None)
        if hit is None:
            unknown.append(p)
        else:
            tiers.append(hit)
    return (tiers, unknown)


def reach_join(rows: "list[Row]", head: int,
               tracked: "set[str] | None" = None) -> "list[str]":
    """`reach` compared to the paths the row says its work touches — 271 §3.

    🔴 THE TREE IS READ LAZILY AND ONCE. `git ls-files` is a subprocess, and a self-test
    that drives forty fixtures through here would pay for forty of them to answer a
    question none of those fixtures asks.
    """
    out: "list[str]" = []
    undeclared = 0
    if tracked is None and any(r.paths != NONE for r in rows):
        tracked = tracked_prefixes()
    tracked = tracked or set()
    for r in rows:
        due = ((r.opened.isdigit() and int(r.opened) >= REACH_PATHS_SINCE)
               or (r.closed != NONE and r.closed.isdigit()
                   and int(r.closed) >= REACH_PATHS_SINCE))
        if r.paths == NONE:
            if r.state in ("OPEN", "SCHEDULED"):
                undeclared += 1
            if due:
                out.append(
                    f"🔴 QUEUE_REACH_JOIN line {r.lineno}: {r.id} touches session "
                    f"{REACH_PATHS_SINCE} or later and declares no `paths`. From that "
                    f"session on, `reach` is typed BESIDE the evidence for it — name the "
                    f"tracked paths the work touches, `;`-separated, and this gate "
                    f"derives the tier and compares")
            continue
        declared = [p.strip() for p in r.paths.split(";") if p.strip()]
        missing = [p for p in declared if p not in tracked]
        if missing:
            out.append(
                f"🔴 QUEUE_REACH_JOIN line {r.lineno}: {r.id} declares "
                f"{', '.join(missing)}, which this repository does not track. A path "
                f"that matches nothing is a claim about a file nobody has; work that "
                f"will CREATE a file declares the directory it lands in")
            continue
        tiers, unknown = reach_of(declared)
        if unknown:
            out.append(
                f"🔴 QUEUE_REACH_JOIN line {r.lineno}: {r.id} declares "
                f"{', '.join(unknown)}, which no `REACH_PATHS` row tiers. An untiered "
                f"path is a file the ordering claim cannot see — add it to the roster "
                f"with the reason it lands on the side it lands on")
            continue
        # 🔴 ONE READING PER PATH, COUNTED — the roster answered for everything it was
        # given or it answered for a subset nobody chose. This is the only thing standing
        # between a live collapse of `reach_of` and a tier derived from whatever it still
        # had an opinion about; the length is the claim, and the tier is downstream of it.
        if len(tiers) != len(declared):
            out.append(
                f"🔴 QUEUE_REACH_JOIN line {r.lineno}: {r.id} declares {len(declared)} "
                f"path(s) and the roster returned {len(tiers)} tier(s). A reader that "
                f"answered for fewer paths than it was handed has stopped reading, and "
                f"the tier derived from the remainder is a claim about a subset nobody "
                f"chose")
            continue
        derived = "user" if "user" in tiers else "internal"
        if derived != r.reach:
            covered = [f"{p} -> {t}" for p, t in zip(declared, tiers)]
            out.append(
                f"🔴 QUEUE_REACH_JOIN line {r.lineno}: {r.id} is typed `{r.reach}` and "
                f"its own paths derive `{derived}` — {'; '.join(covered)}. Any path a "
                f"user can observe makes the row `user`; correct the cell, or correct "
                f"the paths if the row is not about what it says it is")
    if undeclared > UNDECLARED_CEILING:
        out.append(
            f"🔴 QUEUE_REACH_UNDECLARED {undeclared} live row(s) carry no `paths` > "
            f"{UNDECLARED_CEILING}. The back catalogue is grandfathered and COUNTED, not "
            f"excused — the ceiling is the number that was live when the column was "
            f"added, so it can only ever fall")
    return out


# ══ 🆕 281 — `reach-paths-unjoined-to-the-diff` (271) ═══════════════════════════════════
#
# 271 §3 gave `reach` something to be checked against and named what it still had not:
# the `paths` column is compared to the ROSTER and never to the files the closing commit
# actually changed. Both halves of a row can be internally consistent and describe work
# that never happened — `reach_join` above proves the declared paths exist, are tracked
# and derive the typed tier, and every one of those is true of a path nobody touched.
#
# 🔴 AND THE FIRST ROW IT REFUSED WAS IN THE SESSION THAT WROTE IT. `sdk-v2-migration`
# (226) closes at 281 declaring `host/package.json;host/package-lock.json` — the paths
# the MIGRATION would have touched — and the commit closing it touches
# `scripts/registry_lag.py`. Nothing was wrong with either fact; what was missing is that
# they disagree, and a reader looking only at the row cannot see it.
#
# 🔵 SO THE PREDICATE IS NOT *did the work land where it said*. That question has an
# honest NO — a row can close because a MEASUREMENT settled it, and a measurement lands
# in the reader that took it. The predicate is: **a row whose close touched none of its
# own declared paths did not do the work it was tiered for, and must say so in the one
# state this table has for that.** `KILLED` is that state, it already requires a `why`,
# and 244's rule that only `DONE` answers `QUEUE_NOT_ONLY_NEWEST` is what stops the
# distinction being a laundering route.
def paths_join(rows: "list[Row]", head: int,
               changed: "set[str] | None") -> "list[str]":
    """Declared `paths` against the files this session's close actually changed — PURE.

    🔴 `changed is None` IS A REFUSAL AND NOT A SKIP. It means the object store could not
    answer — a shallow checkout, a detached tree, no `origin/main` — and a reader that
    goes quiet when it cannot see is the shape this whole tree is built against. The
    `objects` requirement is declared in `GATE_INPUTS`; the job that runs this gate
    carries `fetch-depth: 0` and has since 220.
    """
    closing = [r for r in rows
               if r.closed != NONE and r.closed.isdigit() and int(r.closed) == head
               and r.paths != NONE]
    if not closing:
        return []
    if changed is None:
        return [f"🔴 QUEUE_PATHS_UNREAD {len(closing)} row(s) close at {head} and the "
                f"diff that closes them could not be read. Green over an unread "
                f"comparison is the defect this gate exists to refuse — run where "
                f"`origin/main` and the merge base are present"]
    out = []
    for r in closing:
        declared = [p.strip() for p in r.paths.split(";") if p.strip()]
        touched = [p for p in declared if any(f == p or f.startswith(p.rstrip("/") + "/")
                                              for f in changed)]
        if touched or r.state == "KILLED":
            continue
        out.append(
            f"🔴 QUEUE_PATHS_JOIN line {r.lineno}: {r.id} is {r.state} at {head} and the "
            f"close touched NONE of the paths it declares ({', '.join(declared)}). Those "
            f"paths are the evidence for its `{r.reach}` tier, so the row is typed for "
            f"work its own closing commit did not do. If a decision or a measurement "
            f"closed it, that is `KILLED` with the reason — `DONE` claims the work in the "
            f"title happened")
    return out


def session_diff(root: Path = ROOT) -> "set[str] | None":
    """The tracked paths this session's close changes, or None when git cannot say.

    The base is `merge-base(origin/main, HEAD)` on a branch. 🔴 ON `main` ITSELF THAT
    BASE IS HEAD and the diff is empty, which would read as *this session changed
    nothing* on exactly the post-merge run the close gate measures — so the base is
    `HEAD~1` there, which after a squash merge is the whole session.

    🔴 AND THE FAR END IS THE WORKING TREE, NOT `HEAD`. Written `base..HEAD` this reader
    refused its own session's replay: the ritual runs the whole fence BEFORE the commit,
    so every file the session had changed was invisible to it and two correctly-closed
    rows read as work that never happened. The question is *what has this session
    changed*, and mid-session the answer includes what is not committed yet. Untracked
    files are collected separately for the same reason `git ls-files` costs 254 a rule:
    a session that CREATES a file has changed it, and `git diff` cannot see one.
    """
    def _git(*args: str) -> "str | None":
        try:
            p = subprocess.run(("git",) + args, cwd=str(root), capture_output=True,
                               text=True, timeout=60)
        except (OSError, subprocess.SubprocessError):
            return None
        return p.stdout.strip() if p.returncode == 0 else None

    head = _git("rev-parse", "HEAD")
    base = _git("merge-base", "origin/main", "HEAD")
    if head is None:
        return None
    if base is None or base == head:
        base = _git("rev-parse", "HEAD~1")
    if base is None:
        return None
    out = _git("diff", "--name-only", base)
    if out is None:
        return None
    new = _git("ls-files", "--others", "--exclude-standard") or ""
    return {ln.strip() for ln in (out + "\n" + new).splitlines() if ln.strip()}


def age_domain(rows: "list[Row]", head: int) -> "list[str]":
    """The bounds `age` is derived under, checked where every reader passes through."""
    out: "list[str]" = []
    for r in rows:
        if r.opened != NONE and r.opened.isdigit() and int(r.opened) > head:
            out.append(
                f"🔴 QUEUE_AGE_DOMAIN line {r.lineno}: {r.id} was opened at {r.opened} "
                f"and the head is {head}, so its derived age is "
                f"{head - int(r.opened)} session(s). A row cannot be opened after the "
                f"session that is reading it — move `QUEUE_HEAD` to the session doing "
                f"the work, or correct `opened`. 255 shipped exactly this and three "
                f"readers printed the negative without comment")
        if r.closed != NONE and r.closed.isdigit() and int(r.closed) > head:
            out.append(
                f"🔴 QUEUE_AGE_DOMAIN line {r.lineno}: {r.id} is closed at {r.closed} "
                f"and the head is {head}. `QUEUE_NOT_ONLY_NEWEST` and the render's "
                f"`Closed this session` both select on `closed == head`, so a closing "
                f"session in the future is a row that will silently never be counted as "
                f"closed by anybody")
        if (r.opened != NONE and r.closed != NONE and r.opened.isdigit()
                and r.closed.isdigit() and int(r.closed) < int(r.opened)):
            out.append(
                f"🔴 QUEUE_AGE_DOMAIN line {r.lineno}: {r.id} is closed at {r.closed} "
                f"and opened at {r.opened} — a decision cannot precede the finding it "
                f"decides, and the age this file prints beside it is derived from "
                f"`opened` alone, so it would read as a positive number over an "
                f"impossible interval")
    return out


_UNSET: "set[str]" = set()   # sentinel: "read the diff yourself" vs an explicit empty set


def check(text: str, tracked: "set[str] | None" = None,
          changed: "set[str] | None" = _UNSET
          ) -> "tuple[list[str], list[str], int, int]":
    """(problems, notes, rows read, open rows).

    🆕 281 — `changed` is the paths this session's close touches. Left alone it is read
    from git once, and only when a row actually closes at the head; a caller that passes
    a set (including an empty one) is asking the pure question and nothing dials out.
    """
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
        if r.reach not in REACHES:
            problems.append(f"🔴 QUEUE_PARSE line {r.lineno}: reach {r.reach!r} is not "
                            f"one of {'/'.join(REACHES)}. Every row declares which side "
                            f"of the line it is on; a row with no tier is a row the "
                            f"ordering claim below cannot see, and an invisible row in a "
                            f"priority table is the priority nobody wrote down")
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

    # ── QUEUE_REACH_JOIN — the column, given something to be checked against (271 §3) ──
    problems += reach_join(rows, head, tracked)

    # ── 🆕 281 QUEUE_PATHS_JOIN — and the other end of it (271, closed) ───────────────
    # The diff is read LAZILY and ONCE, on `reach_join`'s own argument: it is a
    # subprocess, and the self-test's fixture rows drive `paths_join` directly with a
    # set, so none of them pays for a question none of them asks. `changed=None` means
    # a caller explicitly passed no diff and is asking the pure question; the live path
    # supplies `session_diff()`, which returns None only when git could not answer.
    if changed is _UNSET:
        changed = (session_diff()
                   if any(r.closed != NONE and r.closed.isdigit() and int(r.closed) == head
                          and r.paths != NONE for r in rows) else set())
    problems += paths_join(rows, head, changed)

    # ── QUEUE_AGE_CEILING — the loop-breaker's first half ─────────────────────────────
    for r in rows:
        # 🔴 THE CEILING IS A CLAIM ABOUT THE USER TIER AND ONLY THE USER TIER, and that
        # is not the ceiling being laundered off the internal one — it is 248 declining to
        # rebuild the loop under a new name. An `internal` row is DEFERRED with no clock:
        # the whole point of the tier is that nobody works it while user rows are open, so
        # a ceiling over it would demand a decision every eight sessions about work the
        # ordering claim has already forbidden anyone to touch. That is churn wearing
        # governance, and it is exactly what 240 built the ceiling to stop.
        if r.state != "OPEN" or r.reach != "user":
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
        # And a target is a promise about the USER tier for the ceiling's reason: the
        # internal tier's targets were cleared at 248 rather than exempted, so nothing
        # here is being excused — there is nothing left to excuse.
        if r.state != "SCHEDULED" or r.target == NONE or r.reach != "user":
            continue
        if int(r.target) < head:
            problems.append(
                f"🔴 QUEUE_SCHEDULE_HONOURED {r.id} was scheduled for {r.target} and the "
                f"head is {head}, and it is still not closed. Re-target it deliberately "
                f"or KILL it — a schedule nobody re-reads is the prose this table "
                f"replaced")

    # ── 🆕 280 — QUEUE_SCHEDULE_SET — the same promise, read by the SESSION ───────────
    _set_ceiling, _set_how = best_finished_set(rows)
    _sets = schedule_sets(rows)
    if not _sets:
        notes.append(f"QUEUE_SCHEDULE_SET no `user` row is parked on any session — "
                     f"{_set_how}, and there is nothing for that bar to be about")
    for _target, _ids in sorted(_sets.items()):
        if len(_ids) > _set_ceiling:
            problems.append(
                f"🔴 QUEUE_SCHEDULE_SET session {_target} is carrying {len(_ids)} `user` "
                f"row(s) — {', '.join(_ids)} — and {_set_how}. A schedule is a promise "
                f"about a session, and a session is one context: parking a set nothing "
                f"in this table's history has ever finished is not planning, it is a "
                f"lapse written in advance. 243 and 244 each opened carrying six. "
                f"Re-target the ones that are not the point, or say in the rows why this "
                f"set is different")
        else:
            notes.append(f"QUEUE_SCHEDULE_SET session {_target} carries {len(_ids)} "
                         f"`user` row(s) — {', '.join(_ids)} — against a derived bar of "
                         f"{_set_ceiling}: {_set_how}")

    # 🔴 AND A KILL IS NOT A CLOSURE — 241 §2, FOUND BY THE GATE FIRING ON ITS AUTHOR.
    # The first draft counted any old row closed at `head`, and the very first session
    # under it satisfied the claim by KILLING five items it had no intention of doing.
    # That is the caveat this file printed about itself — *"satisfiable by closing a
    # trivial old row, and a session that wants to game it can"* — arriving one session
    # later, in the session that wrote the caveat, without anybody gaming anything. A
    # decision to abandon work is a decision, and `AGE_CEILING` is the row that asks for
    # it; progress is `DONE`, and only `DONE` counts here.
    closed_now = [r for r in rows if r.closed != NONE and int(r.closed) == head]

    # ── QUEUE_TIER_ORDER — the ordering, enforced rather than intended ────────────────
    #
    # 🔴 THE SECONDARY QUEUE IS WORKED WHEN THE PRIMARY IS EMPTY AND NOT BEFORE. A
    # session may CLOSE an `internal` row only when no `user` row is still live, and the
    # refusal names the user rows that were available instead.
    #
    # 🔴 IT GOVERNS CLOSING, NOT OPENING, AND THE ASYMMETRY IS DELIBERATE. Refusing to
    # let a session RECORD an internal finding would not stop the finding — it would stop
    # it being written down, and an unrecorded defect is not a deferred defect, it is a
    # lost one. What the loop was made of was sessions SPENDING themselves on internal
    # rows, so spending is the verb this claim reads. Open whatever you find; finish what
    # reaches somebody.
    #
    # 🔴 269 — A `SCHEDULED` ROW WHOSE TARGET HAS NOT ARRIVED IS NOT WORK BEING SKIPPED,
    # AND READING IT AS LIVE HAD LOCKED THE SECONDARY QUEUE SHUT FOR TWENTY SESSIONS.
    # Measured off this file at head 268, which is the only reason it was found: from 240
    # to 247 every closed row was `internal` — twenty-three of them. From 248, the session
    # that added this claim, to 268, the count is ZERO out of thirty-nine. Not one internal
    # row has closed since the ordering became enforceable.
    #
    # The cause is structural and it is one row. `sdk-v2-migration` is `user`, has been
    # SCHEDULED since 226, and re-targets itself every time a session re-reads the registry
    # and finds that the 2.x it would migrate to still does not exist. It is therefore
    # PERMANENTLY live under the old reading, and permanently live is permanently blocking:
    # Tier 2 holds twenty rows aged eight to forty-five sessions and nothing in the ritual
    # could ever finish one of them.
    #
    # 🔴 AND THE PRESSURE CAME OUT SOMEWHERE, WHICH IS THE PART WORTH WRITING DOWN. 267 and
    # 268 re-tiered five rows `internal` -> `user` between them and 268 read that as a
    # typing bias in the `reach` column — five corrections, never once the other way. Every
    # one of those re-tierings was defensible on its merits AND was the only direction that
    # let the session close its work. A gate that makes one answer free and the other answer
    # cost the session does not measure the column; it selects it. `reach-column-joins-
    # nothing` is still the right row for the join, and this is the reason its evidence was
    # never going to be balanced.
    #
    # So: a row scheduled for a session that has not arrived does not block. Its ceiling is
    # `QUEUE_SCHEDULE_HONOURED`, which already refuses a target that has PASSED and is still
    # not closed — the schedule is governed there, by a claim written for it, rather than
    # here by a side effect of the word "live". An `OPEN` user row blocks exactly as before,
    # and so does a SCHEDULED one whose target has come due.
    live_user = [r for r in rows
                 if r.reach == "user"
                 and (r.state == "OPEN"
                      or (r.state == "SCHEDULED"
                          and (r.target == NONE or int(r.target) <= head)))]
    jumped = [r for r in closed_now if r.reach == "internal" and r.state == "DONE"]
    if live_user and jumped:
        problems.append(
            f"🔴 QUEUE_TIER_ORDER session {head} finished "
            f"{', '.join(r.id for r in jumped)} — internal row(s) — while "
            f"{len(live_user)} row(s) a user can observe were live: "
            f"{', '.join(r.id for r in live_user)}. The secondary queue is worked when "
            f"the primary is empty, and it is not empty. Finish the user-facing work, or "
            f"KILL the rows that are not going to be done and say why")
    elif jumped:
        notes.append(f"QUEUE_TIER_ORDER internal work was in order — no user row was live "
                     f"when {', '.join(r.id for r in jumped)} closed")
    # 🔴 AND WHAT THE CLAIM SET ASIDE IS PRINTED, NEVER ASSUMED. A user row parked on a
    # future session is the exact thing that used to block silently — a session read
    # "twenty internal rows and nothing I may finish" with no line anywhere saying which
    # row said so. Naming them on every run is what keeps 269's reading from becoming its
    # own blind spot: a schedule that keeps sliding forward is visible here as a row that
    # is named every session and never comes due.
    _parked = [r for r in rows
               if r.reach == "user" and r.state == "SCHEDULED"
               and r.target != NONE and int(r.target) > head]
    if _parked:
        notes.append(
            "QUEUE_TIER_ORDER set aside " +
            ", ".join(f"{r.id} (scheduled {r.target})" for r in _parked) +
            " — user row(s) parked on a session that has not arrived, so they do not "
            "block the internal tier; QUEUE_SCHEDULE_HONOURED governs the target itself")

    # ── QUEUE_NOT_ONLY_NEWEST — the loop ──────────────────────────────────────────────
    #
    # 🔴 RE-POINTED AT THE INTERNAL TIER AT 248, AND THE RE-POINT IS THE CLAIM GETTING
    # SHARPER RATHER THAN SOFTER. The pathology it was built for is a session inventing
    # gate work and closing its own invention — a loop whose only input is its own last
    # output. A `user` row cannot be that, because the tier is defined by coming from
    # OUTSIDE: a first-run pass, an error sweep, somebody's issue. 248 opened four user
    # rows and closed all four in the same session, which under the old reading was the
    # exact shape this claim refuses and in substance was the cure for it. Judging user
    # rows here would have refused the first session that broke the loop.
    closed_now = [r for r in closed_now if r.reach == "internal"]
    if closed_now:
        old = [r for r in closed_now
               if r.age(head) >= SELF_GENERATED_SPAN and r.state == "DONE"]
        if not old:
            killed = [r for r in closed_now if r.state == "KILLED"]
            ids = ", ".join(f"{r.id} ({r.state}, opened {r.opened})" for r in closed_now)
            problems.append(
                f"🔴 QUEUE_NOT_ONLY_NEWEST session {head} closed {len(closed_now)} "
                f"INTERNAL item(s) and not one of them is an item it did not create and actually "
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
        notes.append(f"QUEUE_NOT_ONLY_NEWEST has no opinion — session {head} closed no "
                     f"internal row, and a session that closed none has not closed only "
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
    # 🔴 THE TIERS RENDER AS TWO SECTIONS AND THE USER ONE GOES FIRST, because the
    # ordering claim above is only as useful as the reading order it produces in the
    # document a session actually opens. A single list sorted by age puts a
    # thirty-session gate row above a defect somebody hit this morning.
    for reach, heading in (("user", "Tier 1 — reaches a user"),
                           ("internal", "Tier 2 — reaches no user (deferred; worked only "
                                        "when Tier 1 is empty)")):
        tier = [r for r in live if r.reach == reach]
        print(f"#### {heading} — {len(tier)} live\n")
        if not tier:
            # 🔴 AN EMPTY TIER 1 IS NOT AN ACHIEVEMENT, IT IS A MISSING INTAKE. Said out
            # loud here because the failure mode this whole column exists to stop is a
            # session reading "0 user rows" as permission rather than as a question.
            print("- **none.** Tier 2 is unblocked — and an empty Tier 1 is a reading to\n"
                  "  distrust before it is a reading to act on: this queue had no user\n"
                  "  rows at all for its first eight sessions, not because none existed\n"
                  "  but because nothing was looking for them.\n")
            continue
        for r in tier:
            age = r.age(head)
            tail = (f"— **scheduled {r.target}**" if r.state == "SCHEDULED" else
                    f"— **OPEN, {AGE_CEILING - age} session(s) of ceiling left**"
                    if reach == "user" else "— **OPEN, deferred (no ceiling)**")
            print(f"- `{r.id}` · opened {r.opened} · **{age} session(s)** {tail}\n"
                  f"  {r.title}")
        print()
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
    print(f"{'id':<30} {'state':<10} {'reach':<9} {'opened':>6} {'age':>4}")
    for r in rows:
        print(f"{r.id:<30} {r.state:<10} {r.reach:<9} {r.opened:>6} {r.age(head):>4}")
    live_user = sum(1 for r in rows if r.state in ("OPEN", "SCHEDULED") and r.reach == "user")
    live_int = sum(1 for r in rows if r.state in ("OPEN", "SCHEDULED") and r.reach == "internal")
    print(f"QUEUE_AGES {len(rows)} row(s) at head {head} · live {live_user} user / "
          f"{live_int} internal")
    return 0


# ══ SELF-TEST ═════════════════════════════════════════════════════════════════════════
#
# 🔴 EVERY CLAIM ABOVE GETS A NEGATIVE CONTROL, BECAUSE A GATE THAT HAS NEVER REFUSED IS
# A GATE NOBODY HAS TESTED — 239's own finding about `git.moved`, which answered 1 for
# twelve blocks and could not have answered anything else. The fixtures below are the
# smallest tables that make each claim the ONLY thing wrong.

HEAD = 240


# 🆕 271 §3 — THE FIXTURES ARE WRITTEN WITHOUT THE NINTH CELL AND THIS FILLS IT IN, which
# is a convenience with a claim under it (`TABLE_PADS_PATHS` below). Forty fixtures exist
# to make one OTHER claim the only thing wrong with the table; growing every one of them a
# `—` would be forty edits that assert nothing. A fixture that wants to say something
# about `paths` writes all nine cells and this leaves it alone.
def _pad_paths(row: str) -> str:
    cells = [c.strip() for c in row.strip()[1:-1].split("|")]
    if len(cells) == len(COLUMNS) - 1:
        cells.insert(3, NONE)
    return "| " + " | ".join(cells) + " |"


# ══ 🆕 280 — `schedule-set-unread` (244, thirty-six sessions) ═════════════════════════
#
# 🔴 `QUEUE_SCHEDULE_HONOURED` READS ONE ROW AT A TIME. It refuses a target that has
# PASSED, which is the right question asked of the wrong unit: a row scheduled for 281 is
# a promise about 281, and five of them are a promise about 281 that nothing in this
# table has ever kept. 243 and 244 each opened carrying six, and no claim anywhere had an
# opinion — the row has been open ever since, which is itself the measurement.
#
# 🔴 THE CEILING IS DERIVED FROM THIS TABLE AND NOT CHOSEN, which is 280's own lesson one
# file over: a typed ceiling is a number nobody re-derives, and a *population nobody
# derived cannot report that it is short* (279). The bar is the most `user` rows any ONE
# session has actually FINISHED — measured off the `closed` column at head 280: four, by
# 248, 252, 261, 267 and 268, over twenty-two sessions that closed any at all, with a
# median of one. It rises only when a session really does finish more, which is evidence
# rather than permission, and 241 §2's rule already applies to the input: **only `DONE`
# counts.** A session cannot raise the bar by KILLING five rows.
#
# 🔴 AND A FLOOR, BECAUSE A DERIVED POPULATION THAT EMPTIES ANSWERS ZERO AND READS AS
# STRICT. Two is 278's own precedent, written down at 279 in its own words — *read-then-
# decide rows are a set one session can honestly carry* — and it is the smallest bar that
# does not forbid the arrangement this project has already judged honest.
SCHEDULE_SET_FLOOR = 2


def best_finished_set(rows: "list") -> "tuple[int, str]":
    """(the most `user` rows any one session has FINISHED, how that was derived).

    PURE over the parsed rows: no tree, no network, no head. `DONE` only — a KILL is a
    decision to abandon work and 241 §2 already refused it as progress one claim over.
    """
    by = collections.Counter(
        int(r.closed) for r in rows
        if r.state == "DONE" and r.reach == "user" and r.closed != NONE)
    if not by:
        return (SCHEDULE_SET_FLOOR,
                f"no session in this table has FINISHED a `user` row, so the floor of "
                f"{SCHEDULE_SET_FLOOR} stands in — a derived bar whose population has "
                f"emptied answers zero and reads as strictness")
    best = max(by.values())
    who = ", ".join(str(s) for s in sorted(s for s, c in by.items() if c == best))
    return (max(best, SCHEDULE_SET_FLOOR),
            f"{best} is the most any one session has FINISHED ({who}), over {len(by)} "
            f"session(s) that closed one, floor {SCHEDULE_SET_FLOOR}")


def schedule_sets(rows: "list") -> "dict[int, list[str]]":
    """{target session: the `user` row ids parked on it}. PURE.

    🔴 THE UNIT IS THE TARGET AND NOT THE ROW, which is the whole of this claim.
    `QUEUE_SCHEDULE_HONOURED` above reads each row against the head; this reads each
    SESSION against what a session has ever managed.
    """
    out: "dict[int, list[str]]" = {}
    for r in rows:
        if r.state == "SCHEDULED" and r.reach == "user" and r.target != NONE:
            out.setdefault(int(r.target), []).append(r.id)
    return {k: sorted(v) for k, v in out.items()}


def _table(rows: "list[str]", head: int = HEAD, fmt: int = 1) -> str:
    pad = [f"| filler-{i} | DONE | internal | — | 100 | 101 | — | filler | — |"
           for i in range(QUEUE_ROW_FLOOR)]
    return ("<!-- QUEUE_FORMAT %d -->\n<!-- QUEUE_HEAD %d -->\n\n" % (fmt, head)
            + "| " + " | ".join(COLUMNS) + " |\n"
            + "|" + "---|" * len(COLUMNS) + "\n"
            + "\n".join([_pad_paths(r) for r in rows] + pad) + "\n")


GOOD = ["| alpha | OPEN | internal | 238 | — | — | a fresh one | — |",
        "| beta | SCHEDULED | internal | 220 | — | 242 | an old one with a date | — |",
        "| gamma | KILLED | internal | 205 | 240 | — | an old one with a reason | not worth it |",
        "| delta | DONE | internal | 214 | 240 | — | an old one, closed | — |"]

# 🔴 THE SAME FOUR ROWS, TIER 1. `AGE_CEILING`, `SCHEDULE_HONOURED` and the render's
# ceiling remainder are claims about the USER tier since 248, so a fixture made entirely
# of `internal` rows can no longer make any of them fire — and a negative control that
# cannot fire is the thing this whole file exists to refuse. Every row moves together,
# because a base that mixed the tiers would make `QUEUE_TIER_ORDER` fire on the live user
# row instead and test the wrong claim.
GOOD_USER = [r.replace("| internal |", "| user |") for r in GOOD]


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

    # ── 🆕 280 — QUEUE_SCHEDULE_SET, IN BOTH DIRECTIONS AND ON ITS DERIVATION ────────
    #
    # 🔴 THE BAR IS DERIVED, SO THE FIXTURE HAS TO SUPPLY THE HISTORY THAT DERIVES IT.
    # A table whose `user` rows were never finished by anybody falls to the floor, and a
    # claim driven only against the live table would be a claim about today's numbers.
    _fin = [f"| fin-{i} | DONE | user | — | 200 | 201 | — | finished at 201 | — |"
            for i in range(3)]
    _park = [f"| park-{i} | SCHEDULED | user | — | 238 | — | 999 | parked on 999 | — |"
             for i in range(4)]
    _p, _n, _r, _o = check(_table(GOOD + _fin + _park[:3]))
    claim("SCHEDULE_SET_AT_BAR", not any("QUEUE_SCHEDULE_SET" in x for x in _p),
          "three rows parked on one session, against a history in which a session "
          "finished three, was refused — the bar is what has been done, and a reader "
          "that refuses its own evidence refuses every honest schedule: "
          + "; ".join(x[:90] for x in _p))
    red("SCHEDULE_SET_OVER", GOOD + _fin + _park, "QUEUE_SCHEDULE_SET")

    # 🔴 AND A KILL MAY NOT RAISE THE BAR — 241 §2's rule, reaching the input of a
    # DERIVED ceiling rather than the output of a counted one. A session that abandons
    # five rows has demonstrated nothing about what a session can carry.
    _killed = [f"| kil-{i} | KILLED | user | — | 200 | 201 | — | abandoned | why |"
               for i in range(5)]
    red("SCHEDULE_SET_KILL_NO_CREDIT", GOOD + _killed + _park, "QUEUE_SCHEDULE_SET")

    # 🔴 AND THE FLOOR STANDS IN WHEN THE DERIVED BAR IS LOWER, because a bar taken from
    # a population that has barely filled reads as strictness — at the limit it refuses
    # every schedule this table has ever carried, including the pair 278 judged honest.
    #
    # 🔴 AND THE DIGIT DECIDES BOTH FIXTURES, WHICH THE FIRST DRAFT OF THIS CLAIM DID
    # NOT. It read `best_finished_set([])[0] == SCHEDULE_SET_FLOOR` — the constant
    # compared against itself, true for every value it could hold, which is a pin that
    # cannot be wrong and therefore is not one. `floor_pin_gate.py` sweeps this file:
    # a claim satisfied by any digit is a floor nothing governs.
    _one_done = ["| onefin | DONE | user | — | 200 | 201 | — | one, at 201 | — |"]
    _pair = [f"| duo-{i} | SCHEDULED | user | — | 238 | — | 999 | parked on 999 | — |"
             for i in range(2)]
    _trio = _pair + ["| duo-2 | SCHEDULED | user | — | 238 | — | 999 | parked | — |"]
    _pp, _n, _r, _o = check(_table(GOOD + _one_done + _pair))
    claim("SCHEDULE_SET_FLOOR_ADMITS_PAIR",
          not any("QUEUE_SCHEDULE_SET" in x for x in _pp),
          "a PAIR parked on one session, against a history whose best session finished "
          "ONE, was refused — the derived bar is 1 here and the FLOOR is what admits "
          "it, so this fixture is where the digit is read: "
          + "; ".join(x[:90] for x in _pp))
    red("SCHEDULE_SET_FLOOR_REFUSES_TRIO", GOOD + _one_done + _trio,
        "QUEUE_SCHEDULE_SET")
    _bar, _how = best_finished_set(
        parse(_table(GOOD + _fin + _park))[2])
    claim("SCHEDULE_SET_DERIVED", _bar == 3 and "201" in _how,
          f"the bar derived from a history whose best session finished three came back "
          f"{_bar} ({_how}) — the number must come from the `closed` column and name the "
          f"session it came from, or it is a literal wearing a derivation")

    # ── QUEUE_PARSE ───────────────────────────────────────────────────────────────────
    p, _n, _r, _o = check("no markers here at all")
    claim("PARSE_NO_FORMAT", any("QUEUE_FORMAT" in x for x in p),
          "a file with no format marker parsed")
    p, _n, _r, _o = check("<!-- QUEUE_FORMAT 1 -->\nnothing else")
    claim("PARSE_NO_HEAD", any("QUEUE_HEAD" in x for x in p),
          "a file with no head marker parsed, so every age would derive from zero")
    red("PARSE_BAD_ID", GOOD + ["| Not A Slug | OPEN | internal | 239 | — | — | t | — |"],
        "is not a slug")
    red("PARSE_DUPLICATE_ID", GOOD + ["| alpha | OPEN | internal | 239 | — | — | t | — |"],
        "already declared")
    red("PARSE_BAD_STATE", GOOD + ["| eps | PENDING | internal | 239 | — | — | t | — |"],
        "is not one of")
    red("PARSE_BAD_SESSION", GOOD + ["| eps | OPEN | internal | soon | — | — | t | — |"],
        "neither a session number")
    red("PARSE_NO_TITLE", GOOD + ["| eps | OPEN | internal | 239 | — | — | — | — |"], "has no title")
    red("PARSE_WIDTH", GOOD + ["| eps | OPEN | internal | 239 | — | — |"], "column(s)")

    # 🔴 THE FLOOR'S OWN CONTROL. A parser that stopped matching reads zero rows, finds
    # zero violations and prints ok — the exact silence `CLAIM_FLOOR` exists for, one
    # file over. The fixture is the good table with the pad removed.
    short = ("<!-- QUEUE_FORMAT 1 -->\n<!-- QUEUE_HEAD 240 -->\n\n| "
             + " | ".join(COLUMNS) + " |\n|" + "---|" * len(COLUMNS) + "\n"
             + "\n".join(_pad_paths(r) for r in GOOD) + "\n")
    p, _n, _r, _o = check(short)
    claim("ROW_FLOOR", any("QUEUE_ROW_FLOOR" in x for x in p),
          f"{len(GOOD)} rows passed a floor of {QUEUE_ROW_FLOOR}")

    # ── QUEUE_FIELDS ──────────────────────────────────────────────────────────────────
    red("FIELDS_DONE_NO_CLOSED", GOOD + ["| eps | DONE | internal | 230 | — | — | t | — |"],
        "with no `closed`")
    red("FIELDS_OPEN_WITH_CLOSED", GOOD + ["| eps | OPEN | internal | 239 | 240 | — | t | — |"],
        "is a contradiction")
    red("FIELDS_SCHEDULED_NO_TARGET", GOOD + ["| eps | SCHEDULED | internal | 230 | — | — | t | — |"],
        "SCHEDULED without a target")
    red("FIELDS_TARGET_ON_OPEN", GOOD + ["| eps | OPEN | internal | 239 | — | 250 | t | — |"],
        "carries target=")
    red("FIELDS_KILLED_NO_WHY", GOOD + ["| eps | KILLED | internal | 230 | 240 | — | t | — |"],
        "KILLED with no `why`")

    # ── QUEUE_AGE_CEILING ─────────────────────────────────────────────────────────────
    red("AGE_CEILING", GOOD_USER + ["| eps | OPEN | user | 205 | — | — | thirty-five sessions | — |"],
        "QUEUE_AGE_CEILING")
    # and the boundary in both directions, because an off-by-one here is a ceiling that
    # admits the row it was written for.
    p, _n, _r, _o = check(_table(GOOD_USER + [
        f"| eps | OPEN | user | {HEAD - AGE_CEILING} | — | — | exactly at the ceiling | — |"]))
    claim("AGE_CEILING_ADMITS_EDGE", not any("AGE_CEILING" in x for x in p),
          f"an item exactly {AGE_CEILING} sessions old was refused; the ceiling is "
          f"`> {AGE_CEILING}`, not `>=`")
    p, _n, _r, _o = check(_table(GOOD_USER + [
        f"| eps | OPEN | user | {HEAD - AGE_CEILING - 1} | — | — | one over | — |"]))
    claim("AGE_CEILING_REFUSES_EDGE", any("AGE_CEILING" in x for x in p),
          f"an item {AGE_CEILING + 1} sessions old passed")
    # 🔴 AND BOTH EDGES ARE PINNED ABSOLUTELY, NOT RELATIVE TO `AGE_CEILING`. The two
    # claims above derive their fixtures FROM the constant, so they hold at every value
    # of it — including zero, which is the mutation `floor_pin_gate` applies. 184 §7:
    # pinning the key is not pinning the value. These two name the sessions.
    p, _n, _r, _o = check(_table(GOOD_USER + [
        "| eps | OPEN | user | 232 | — | — | eight sessions old | — |"], head=240))
    claim("AGE_CEILING_VALUE_ADMITS", not any("AGE_CEILING" in x for x in p),
          "a row opened at 232 was refused at head 240 — the ceiling is not 8")
    p, _n, _r, _o = check(_table(GOOD_USER + [
        "| eps | OPEN | user | 231 | — | — | nine sessions old | — |"], head=240))
    claim("AGE_CEILING_VALUE_REFUSES", any("AGE_CEILING" in x for x in p),
          "a row opened at 231 passed at head 240 — the ceiling is not 8")

    # 🔴 AND THE CEILING MUST NOT REACH A ROW SOMEBODY DECIDED. A gate that reddened a
    # KILLED row for being old would make the decision it asks for impossible to record.
    p, _n, _r, _o = check(_table(GOOD_USER))
    claim("AGE_CEILING_SPARES_DECIDED", not any("AGE_CEILING" in x for x in p),
          "a 35-session-old KILLED row and a 20-session-old SCHEDULED row were reddened "
          "by the ceiling, which would make the decision unrecordable")

    # ── QUEUE_SCHEDULE_HONOURED ───────────────────────────────────────────────────────
    red("SCHEDULE_LAPSED",
        GOOD_USER + ["| eps | SCHEDULED | user | 230 | — | 238 | the target went past | — |"],
        "QUEUE_SCHEDULE_HONOURED")
    p, _n, _r, _o = check(_table(GOOD_USER + [
        f"| eps | SCHEDULED | user | 230 | — | {HEAD} | targeted at the head | — |"]))
    claim("SCHEDULE_ADMITS_HEAD", not any("SCHEDULE_HONOURED" in x for x in p),
          "a row targeted at the head session was refused, so a session could never "
          "schedule work for itself")

    # ── 🆕 QUEUE_AGE_DOMAIN — the bounds `age` is derived under (271 §2) ───────────────
    #
    # 🔴 THE FIXTURE IS 255's OWN MISTAKE, RE-TYPED. A row opened one session after the
    # head rendered at **-1 session(s)** through three readers and nothing had an opinion,
    # for fifteen sessions.
    red("AGE_DOMAIN_OPENED_AFTER_HEAD",
        [f"| eps | OPEN | internal | {HEAD + 1} | — | — | opened next session | — |"],
        "QUEUE_AGE_DOMAIN")
    red("AGE_DOMAIN_CLOSED_AFTER_HEAD",
        [f"| eps | DONE | internal | 230 | {HEAD + 1} | — | closed next session | — |"],
        "QUEUE_AGE_DOMAIN")
    red("AGE_DOMAIN_CLOSED_BEFORE_OPENED",
        ["| eps | DONE | internal | 235 | 230 | — | decided before found | — |"],
        "QUEUE_AGE_DOMAIN")
    # 🔴 AND THE DIRECTION THAT KEEPS IT FROM BANNING THE SCHEDULE. A `target` AFTER the
    # head is what a scheduled row IS — the only claim with an opinion about a target is
    # `QUEUE_SCHEDULE_HONOURED`, which refuses one that has PASSED. A domain check that
    # read `target` here would refuse every schedule this table exists to carry.
    p, _n, _r, _o = check(_table(GOOD_USER + [
        f"| eps | SCHEDULED | user | 230 | — | {HEAD + 30} | parked far ahead | — |"]))
    claim("AGE_DOMAIN_SPARES_TARGET", not any("QUEUE_AGE_DOMAIN" in x for x in p),
          "a target thirty sessions ahead was refused as out of domain, which would make "
          "a schedule unwritable")
    # 🔴 AND THE READERS THAT ARE NOT `check`. The row's finding was that `--render` and
    # `--ages` printed the negative too, so the bound lives in `parse` and both of them
    # must refuse rather than print a number no arithmetic can produce.
    _bad = _table([f"| eps | OPEN | internal | {HEAD + 1} | — | — | from the future | — |"])
    _cap = io.StringIO()
    with contextlib.redirect_stdout(_cap):
        _rc_r, _rc_a = render(_bad), ages(_bad)
    claim("AGE_DOMAIN_REACHES_EVERY_READER", _rc_r == 1 and _rc_a == 1,
          f"--render returned {_rc_r} and --ages returned {_rc_a} over a row whose age is "
          f"negative — the two readers that printed 255's -1 without comment")

    # ── 🆕 QUEUE_REACH_JOIN — the column, joined to the tree (271 §3) ──────────────────
    #
    # A tiny tracked set, passed in rather than read: the claim is about the JOIN, and a
    # fixture that shelled out to `git ls-files` would be asserting this checkout's
    # contents under the join's name.
    _tk = {"host/src/", "host/src/index.ts", "scripts/", "scripts/queue_gate.py",
           "README.md", "docs/", "docs/USER_GUIDE.md"}
    _p9 = ("| eps | %s | %s | %s | 238 | — | — | a row with evidence | — |")
    p, _n, _r, _o = check(_table([_p9 % ("OPEN", "internal", "scripts/")]), tracked=_tk)
    claim("REACH_JOIN_AGREES", not any("QUEUE_REACH_JOIN" in x for x in p),
          f"an `internal` row declaring `scripts/` was refused: "
          f"{[x[:90] for x in p if 'REACH_JOIN' in x]}")
    p, _n, _r, _o = check(_table([_p9 % ("OPEN", "internal", "host/src/")]), tracked=_tk)
    claim("REACH_JOIN_REFUSES_MISTYPED", any("QUEUE_REACH_JOIN" in x for x in p),
          "a row typed `internal` whose only path is `host/src/` passed — that is the "
          "shipped server, and the column would still be joined to nothing")
    # 🔴 ONE OBSERVABLE PATH IS ENOUGH, which is 248's line and not a convenience: the
    # tier asks whether an installer can see the work, and nine gate files do not unsee
    # the one that ships.
    p, _n, _r, _o = check(_table([_p9 % ("OPEN", "user", "scripts/;host/src/")]),
                          tracked=_tk)
    claim("REACH_JOIN_ANY_USER_PATH_WINS", not any("QUEUE_REACH_JOIN" in x for x in p),
          f"a `user` row touching both tiers was refused: "
          f"{[x[:90] for x in p if 'REACH_JOIN' in x]}")
    p, _n, _r, _o = check(_table([_p9 % ("OPEN", "internal", "host/src/nope.ts")]),
                          tracked=_tk)
    claim("REACH_JOIN_REFUSES_UNTRACKED", any("does not track" in x for x in p),
          "a path this repository does not track passed — a declared path that matches "
          "nothing is a claim about a file nobody has")
    p, _n, _r, _o = check(_table([_p9 % ("OPEN", "internal", "docs/")]),
                          tracked={"docs/", "docs/CONTRIBUTORS.md"})
    claim("REACH_JOIN_ROSTER_ORDER", not any("QUEUE_REACH_JOIN" in x for x in p),
          "`docs/` derived `user` — the roster is FIRST-match and `docs/USER_GUIDE.md` "
          "sits above `docs/`, so the general row must not be shadowed by the specific "
          "one in the wrong direction")
    # 🔴 THE ROSTER ITSELF, IN THE DIRECTION NOTHING ELSE READS: a pattern that names no
    # tracked path is a tier for a directory this repository does not have, which is the
    # roster going stale exactly the way the prose it replaced did.
    _tracked_real = tracked_prefixes()
    if _tracked_real:
        claims_stale = [pat for pat, _t, _w in REACH_PATHS
                        if not any(f == pat or f.startswith(pat) for f in _tracked_real)]
        claim("REACH_PATHS_LIVE", not claims_stale,
              f"{claims_stale} tier paths this repository does not track — a roster that "
              f"outlives the tree it describes is the sentence it replaced")
    # 🔴 AND THE BACK CATALOGUE IS COUNTED, NOT EXCUSED. The ceiling is the number of live
    # rows that were already undeclared when the column landed, so it can only fall.
    _many = [f"| old-{i} | OPEN | internal | 200 | — | — | grandfathered | — |"
             for i in range(UNDECLARED_CEILING + 1)]
    p, _n, _r, _o = check(_table(_many, head=400))
    claim("REACH_UNDECLARED_CEILING", any("QUEUE_REACH_UNDECLARED" in x for x in p),
          f"{UNDECLARED_CEILING + 1} live rows with no `paths` passed a ceiling of "
          f"{UNDECLARED_CEILING}")
    # 🔴 AND A ROW FROM THIS SESSION ON MAY NOT CARRY `—` AT ALL.
    red("REACH_JOIN_DUE",
        [f"| eps | OPEN | internal | {REACH_PATHS_SINCE} | — | — | no evidence | — |"],
        "declares no `paths`", head=REACH_PATHS_SINCE)
    # 🔴 THE PADDING HELPER IS A CLAIM, NOT A COURTESY. Forty fixtures above are written
    # with eight cells and normalised here; if that normalisation ever stopped inserting
    # the column, every one of them would be width-refused and the claims they carry would
    # pass for the wrong reason — `CLAIM_FLOOR`'s shape, inside a test helper.
    #
    # 🔴 EVERY READ IS INSIDE THE CLAIM AND NONE OF THEM MAY THROW — `_cells`, `parse` and
    # `_table` each raised `CRASH_CEILING` on this claim's first draft. A blind that
    # CRASHES the gate proves that Python throws on an empty; it does not prove the gate's
    # own floor bites, and `instrument_gate.py` refuses the difference (197 §3).
    _padded = str(_pad_paths(GOOD[0]) or "")
    _parsed_rows = parse(_table(GOOD))[2]
    claim("TABLE_PADS_PATHS",
          len(COLUMNS) == 9 and _padded.count("|") == 10
          and bool(_parsed_rows) and _parsed_rows[0].paths == NONE,
          f"`_pad_paths` did not put an undeclared ninth cell into an eight-cell fixture, "
          f"or the padded table did not parse: {_padded!r}, {len(_parsed_rows)} row(s)")

    # ── QUEUE_TIER_ORDER — the ordering (248) ─────────────────────────────────────────
    red("TIER_ORDER",
        ["| u | OPEN | user | 234 | — | — | a defect a user can hit | — |",
         f"| g | DONE | internal | 200 | {HEAD} | — | a gate row, finished instead | — |"],
        "QUEUE_TIER_ORDER")
    # 🔴 AND IT MUST BE SILENT WHEN TIER 1 IS EMPTY, or it is not an ordering, it is a
    # ban — the internal tier is deferred, not abandoned, and a session that has cleared
    # Tier 1 is exactly the session that should be spending itself on Tier 2.
    p, _n, _r, _o = check(_table(
        ["| u | DONE | user | 234 | 240 | — | the last user row, closed | — |",
         f"| g | DONE | internal | 200 | {HEAD} | — | and then a gate row | — |"]))
    claim("TIER_ORDER_ADMITS_EMPTY_TIER1", not any("TIER_ORDER" in x for x in p),
          "internal work was refused with no live user row")
    # 🔴 AND A LIVE USER ROW MUST NOT BLOCK CLOSING ANOTHER USER ROW, which is the
    # ordering doing its job rather than deadlocking on itself.
    p, _n, _r, _o = check(_table(
        ["| u1 | OPEN | user | 234 | — | — | still open | — |",
         f"| u2 | DONE | user | 200 | {HEAD} | — | and one finished | — |"]))
    claim("TIER_ORDER_ADMITS_USER_WORK", not any("TIER_ORDER" in x for x in p),
          "finishing a user row was refused while another user row was live")
    # 🔴 AND A SCHEDULED USER ROW THAT HAS COME DUE COUNTS AS LIVE. `SCHEDULED` was the
    # state that laundered the ceiling off a row in 240; it must not launder the ordering
    # off one. The target here is BEHIND the head, so the row is work this session was
    # supposed to be doing and the internal row jumped it.
    red("TIER_ORDER_SCHEDULED_IS_LIVE",
        [f"| u | SCHEDULED | user | 200 | — | {HEAD - 5} | due five sessions ago | — |",
         f"| g | DONE | internal | 200 | {HEAD} | — | jumped anyway | — |"],
        "QUEUE_TIER_ORDER")
    # 🔴 AND ONE PARKED ON A SESSION THAT HAS NOT ARRIVED DOES NOT — 269, and this is the
    # claim that would have caught twenty sessions of a locked secondary queue. Under the
    # old reading `sdk-v2-migration`, `user` and scheduled forward since 226, made
    # `live_user` non-empty on EVERY run: from 248 to 268 not one internal row closed, out
    # of thirty-nine closed rows, while Tier 2 grew to twenty rows aged up to forty-five
    # sessions. A row nobody is allowed to work yet is not work being skipped, and its
    # schedule is `QUEUE_SCHEDULE_HONOURED`'s claim rather than this one's side effect.
    p, _n, _r, _o = check(_table(
        [f"| u | SCHEDULED | user | 200 | — | {HEAD + 2} | parked two sessions out | — |",
         f"| g | DONE | internal | 200 | {HEAD} | — | and Tier 2 may move | — |"]))
    claim("TIER_ORDER_SCHEDULED_AHEAD_IS_NOT_LIVE",
          not any("TIER_ORDER" in x for x in p),
          "a user row scheduled for a session that has not arrived blocked the internal "
          "tier — which is the state that closed Tier 2 for twenty sessions")
    # 🔴 AND THE ROW IT SET ASIDE IS NAMED, because the defect this replaces was SILENT:
    # twenty sessions read "nothing I may finish" with no line anywhere saying which row
    # said so. A claim on the refusal without one on the note would let the same blindness
    # return wearing the opposite sign.
    _p2, _n2, _r2, _o2 = check(_table(
        [f"| u | SCHEDULED | user | 200 | — | {HEAD + 2} | parked two sessions out | — |",
         f"| g | DONE | internal | 200 | {HEAD} | — | and Tier 2 may move | — |"]))
    claim("TIER_ORDER_NAMES_WHAT_IT_SET_ASIDE",
          any("set aside" in x and "u (scheduled" in x for x in _n2),
          "the parked user row was not named on the run that let the internal tier move")
    # 🔴 AND AN UNDECLARED TIER IS A PARSE FAILURE, not a default. A row that defaulted
    # to `internal` would be a row the ordering silently deprioritises; one that
    # defaulted to `user` would block the whole Tier 2 queue. Neither is a reading
    # anybody wrote down, so there is no default.
    red("PARSE_BAD_REACH", GOOD + ["| eps | OPEN | soon | 239 | — | — | t | — |"],
        "is not one of user/internal")

    # ── QUEUE_NOT_ONLY_NEWEST — the loop, and its four historical instances ───────────
    red("ONLY_NEWEST",
        ["| a | OPEN | internal | 205 | — | — | the old one nobody touches | — |",
         f"| b | DONE | internal | {HEAD} | {HEAD} | — | invented and closed today | — |",
         f"| c | DONE | internal | {HEAD - 1} | {HEAD} | — | invented last session | — |"],
        "QUEUE_NOT_ONLY_NEWEST")
    p, _n, _r, _o = check(_table(
        ["| a | OPEN | internal | 238 | — | — | fresh | — |",
         f"| b | DONE | internal | {HEAD} | {HEAD} | — | invented today | — |",
         f"| c | DONE | internal | {HEAD - SELF_GENERATED_SPAN} | {HEAD} | — | an older one | — |"]))
    claim("ONLY_NEWEST_SATISFIED", not any("NOT_ONLY_NEWEST" in x for x in p),
          "closing one item older than the span was still refused")
    # 🔴 THE KILL CONTROL — 241 §2, the claim the first draft did not make. A session
    # that closes its own two inventions and kills five ancient rows has decided five
    # things and finished none, and the first draft called that satisfied.
    red("ONLY_NEWEST_KILL_IS_NOT_DONE",
        [f"| a | DONE | internal | {HEAD} | {HEAD} | — | invented and closed today | — |",
         "| b | KILLED | internal | 205 | 240 | — | thirty-five sessions, abandoned | not worth it |",
         "| c | KILLED | internal | 206 | 240 | — | thirty-four sessions, abandoned | nor this |"],
        "QUEUE_NOT_ONLY_NEWEST")
    p, _n, _r, _o = check(_table(
        [f"| a | DONE | internal | {HEAD} | {HEAD} | — | invented and closed today | — |",
         "| b | KILLED | internal | 205 | 240 | — | abandoned | not worth it |",
         f"| c | DONE | internal | 214 | {HEAD} | — | an old one, FINISHED | — |"]))
    claim("ONLY_NEWEST_DONE_ANSWERS", not any("NOT_ONLY_NEWEST" in x for x in p),
          "an old row that was actually finished did not satisfy the claim")

    p, notes, _r, _o = check(_table(["| a | OPEN | internal | 238 | — | — | fresh | — |"]))
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
        _rc = render(_table(GOOD_USER))
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

    # ── 🆕 281 QUEUE_PATHS_JOIN — `reach-paths-unjoined-to-the-diff` (271) ────────────
    #
    # Every row drives the PURE half with a diff handed in, so none of this dials git —
    # `reach_join`'s own argument, one reader over. The refusing row is first because a
    # reader that has never refused is unaudited (204 §8.27).
    _mk = lambda body: parse("<!-- QUEUE_FORMAT 1 -->\n<!-- QUEUE_HEAD 281 -->\n"
                             "| id | state | reach | paths | opened | closed | target "
                             "| title | why |\n|---|---|---|---|---|---|---|---|---|\n"
                             + body)[2]
    _PJ = _mk(
        "| shipped | DONE | internal | scripts/a.py | 270 | 281 | — | t | w |\n"
        "| decided | KILLED | internal | scripts/a.py | 270 | 281 | — | t | w |\n"
        "| nested | DONE | internal | scripts | 270 | 281 | — | t | w |\n"
        "| earlier | DONE | internal | scripts/a.py | 270 | 280 | — | t | w |\n"
        "| undeclared | DONE | internal | — | 270 | 281 | — | t | w |\n")
    _hit = paths_join(_PJ, 281, {"scripts/b.py"})
    claim("PATHS_JOIN_REFUSES",
          len(_hit) == 1 and "shipped" in _hit[0],
          f"a DONE row whose close touched none of its declared paths was not refused, "
          f"or something else was: {_hit}")
    # 🔴 KILLED IS THE STATE THIS READER POINTS AT, so it cannot also be a thing it
    # refuses — a reader whose only repair its own predicate rejects has no repair.
    claim("PATHS_JOIN_KILLED_IS_THE_REPAIR",
          not any("decided" in x for x in paths_join(_PJ, 281, {"scripts/b.py"})),
          "a KILLED row was refused for touching none of its paths — that is the state "
          "the refusal tells the author to use")
    claim("PATHS_JOIN_PREFIX",
          not any("nested" in x for x in paths_join(_PJ, 281, {"scripts/deep/c.py"})),
          "a declared DIRECTORY was not matched by a file inside it")
    claim("PATHS_JOIN_POPULATION",
          not any("earlier" in x or "undeclared" in x
                  for x in paths_join(_PJ, 281, {"scripts/b.py"})),
          "the population is rows closing at THIS head with declared paths — a row "
          "closed earlier, or declaring none, is somebody else's question")
    claim("PATHS_JOIN_TOUCHED_IS_SILENT",
          not paths_join(_PJ, 281, {"scripts/a.py", "scripts/deep/c.py"}),
          "a close that DID touch the declared paths was refused anyway")
    # 🔴 UNREAD IS NOT GREEN — the whole reader's stance, and the one direction a reader
    # that shells out can fail silently in.
    claim("PATHS_JOIN_UNREAD_REFUSES",
          any("QUEUE_PATHS_UNREAD" in x for x in paths_join(_PJ, 281, None)),
          "a diff git could not produce was treated as a clean comparison")
    claim("PATHS_JOIN_EMPTY_POPULATION",
          not paths_join(_mk("| open | OPEN | internal | scripts/a.py | 270 | — | — "
                             "| t | w |\n"), 281, None),
          "a session that closed nothing was asked for a diff it has no use for")

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
