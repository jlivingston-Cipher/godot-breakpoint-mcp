#!/usr/bin/env python3
"""release_names.py — session 216. CHECK 1, OUT OF THE SCRATCH FILE.

215 §3 found TWO real defects in the release ritual's check 1 and fixed both — in
`host/_to_delete/release215.py`, which is GITIGNORED SCRATCH copied forward by hand
each session. 215 §6.3 wrote the cost down in red: *a real defect was found and
fixed in a file that is not in the repository*. This is that fix, in the repository.

🔴 THE ARGUMENT IS `registry_lag.py`'s AND `registry_bytes.py`'s, AND IT HAS NOW
BEEN PAID FOR TWICE. A check that survives only by being copied is not a check, it
is a habit — and a habit loses whichever edit the next copier does not notice. 211
§4's pre-written tautology is the same file's earlier bill. What is diffable here:
the two regexes, the floor, the two arms, and the SHIPPED_SOURCE map they read
against. What `--selftest` proves is that all four can still REFUSE.

── WHAT CHECK 1 ASKS ──────────────────────────────────────────────────────────
The released CHANGELOG block names things. The bump claims something about where
those things live. The two have to agree:

    PATCH — the notes describe INSTRUMENT work, so NO instrument constant they
            name may reach shipped source. (The original check, 203 §2.)
    MINOR — the notes describe PRODUCT work, so at least one identifier they name
            MUST reach shipped source. If none does, the notes and the bump are
            describing different releases. (210 §2 added this arm.)

🔴 210 §2 FIXED THE BUMP AXIS AND LEFT THE CASE AXIS, AND SAID SO IN ITS OWN
COMMENT WITHOUT SEEING IT. That comment reads: the SCREAMING pattern "CANNOT match
an API field name, because this codebase names wire fields in lower snake" —
written directly above a population floor that counted ONLY the SCREAMING form. So
a release whose notes describe their work in lower snake has an EMPTY population by
construction, and the floor reads that as "the notes are too thin to make a claim
about". Measured on 1.73.2: roster `['BYTES_CEILING']`, one name, floor of five,
ABORT — after the version writes had already landed. The notes were not thin. They
named `body_brace()`, `concise_blind()`, `log_seq`, `start_failed`, `editor_get_log`.
Twenty-two consecutive PATCHes whose notes happened to use constants is why nobody
noticed.

🔴 AND THE SECOND DEFECT UNDERNEATH IT: THE lower_snake REGEX COULD NOT SEE A
FUNCTION. It required the closing backtick to follow the name immediately, so
`` `body_brace()` `` — the natural way prose names a function — was invisible while
`` `log_seq` `` was not. An optional call-paren admits two more names from that same
block. Both defects are pinned by rows in SELFTEST below; neither is pinned by any
run over a healthy tree, because a healthy tree is exactly what they were both
silent on.

🔴 THE FLOOR AND THE LEAK ASSERTION ARE DIFFERENT QUESTIONS AND HAD BEEN ONE.
This is the half that is load-bearing, and it is the half a future simplification
will want to delete:

    the FLOOR asks  "is this block LEGIBLE enough to make a claim about?"
                    -> both cases. Vocabulary is vocabulary.
    the LEAK  asks  "do INSTRUMENT CONSTANTS stay out of the product?"
                    -> constants only.

lower_snake is how this codebase spells shipped wire fields, so a lower_snake name
reaching shipped source is EXPECTED and is evidence of nothing. Measured on 1.73.2:
`log_seq` and `start_failed` both reach it — `start_failed` is an event
`host/src/csdap.ts` already emits, named by notes about a TEST that now listens for
it. Widening the leak assertion to lower_snake would have made the PATCH claim read
FALSE on a release that changed no product code at all. `the separation is
load-bearing` in SELFTEST is the row that says so, and it PASSES; widen the
assertion and it goes red.

🔴 AND PROMOTING IT FOUND A THIRD DEFECT, IN THE ARM 215 §3 DID NOT TOUCH.
The ritual runs ONE arm per cut — the one matching the bump — so the two arms had
never been driven over the same block. A drivable pure function makes that one
command, and the answer is that the arms CONTRADICT EACH OTHER about what a
lower_snake name reaching shipped source means:

    PATCH arm — a reaching lower_snake name is EXPECTED, and evidence of nothing.
    MINOR arm — a reaching lower_snake name WAS THE WHOLE EVIDENCE of product work.

Both cannot be true, and the PATCH arm is the one that is right: measured on 1.73.2,
`log_seq` and `start_failed` both reach shipped source, and `start_failed` is an event
`host/src/csdap.ts` ALREADY emitted — named by notes about a TEST that now listens for
it. Nothing about it shipped. So the old MINOR arm PASSED on 1.73.2's block, the
release three handoffs wrongly called a MINOR (215 §2). 🔴 A check cannot be evidence
for a claim when it agrees with the claim's negation just as readily.

🔴 THE FIX IS A DIFF WINDOW, AND IT WAS MEASURED BEFORE IT WAS WRITTEN. The MINOR
question is not "does this name exist in the product" but "does this name appear in
what CHANGED in the product this window". Over the five producers below, added lines
only, measured at 216:

    v1.73.1..v1.73.2  PATCH   5 names   window    2 lines   0 in window
    v1.72.7..v1.73.0  MINOR  24 names   window  285 lines   7 in window
                              (engine_log, push_error, runtime_get_log,
                               runtime_get_monitors, runtime_screenshot,
                               runtime_step_frames, scene_get_dependencies)

The one real MINOR this arm has ever run on passes; 1.73.2-as-a-MINOR refuses. 🔴 SO
CHECK 1 WOULD NOW CATCH 215 §2 INDEPENDENTLY OF CHECK 8, and 215 §2's "check 8 is the
ONLY reason this was caught" is true of the ritual as it stood and no longer true here.

🔴 AND WITHOUT A WINDOW THE ARM REFUSES RATHER THAN PASSING. `registry_bytes.py`'s
rule: a reader that cannot make its comparison says so, instead of passing quietly on
a comparison it did not make.

🔴 WHY THE LIVE HALF STILL BELONGS TO THE CUT. It needs a released block that
exists — i.e. the version write has landed — so between cuts there is nothing for it
to read. `--selftest` is PURE: no network, no npm, no filesystem, and it runs on
every push, which is the half that carries 204 §8.27, *a check that has never
refused has not been audited*.

🔴 AND 216's LAST PARAGRAPH IS CLOSED — `--assert-map`, BELOW. It said `SHIPPED_SOURCE`
is check 3's map, that 203 §2's ONE LIST rule allows exactly one of it, and that the
tarball-roots-BOTH-WAYS assertion over it was still in the gitignored ritual. It is
here now, pure core plus a live half, and it runs in CI's `build` job beside the
`npm pack --dry-run` that job already does. 🔴 THE RITUAL MUST STILL IMPORT THE MAP
FROM HERE, NOT REDEFINE IT, or 203 §2 is broken by the very move that protected it.

── CHECK 2, AND WHY 216 §3's DIAGNOSIS WAS WRONG ──────────────────────────────
216 §3 wrote that check 2's population *"can NEVER be empty — the ritual's own version
write is in it"*, that `NOT EMPTY this window` had *"been printed on every release and
has never carried a bit of information"*, and shipped a split of that population into
`N this script wrote / N did not`.

🔴 IT IS NOT TRUE, AND THE REASON IS ONE LINE: `git diff v{OLD}..HEAD` COMPARES TWO
COMMITS. The ritual's version write is still UNCOMMITTED when check 2 reads it, so it
is not in that window and never was. 216 measured `v1.73.1..HEAD` *after* 1.73.2 had
already merged — a different window than the one the check reads.

🔴 MEASURED PROPERLY, AT `v{OLD}..parent(release commit)` — the window the ritual
actually sees — over all five producers, for the last ten cuts:

    1.73.2  0 files      1.72.7  0      1.72.4  0      1.72.1  0
    1.73.1  0 files      1.72.6  0      1.72.3  0
    1.73.0  5 files      1.72.5  0      1.72.2  0

Empty on NINE of ten, and non-empty on exactly one — 1.73.0, the only real MINOR in
the range. 🔴 SO THE LINE 216 CALLED "NEVER ABLE TO SAY NOTHING" HAS BEEN SAYING
"NOTHING MOVED" NINE TIMES OUT OF TEN, CORRECTLY. What was missing was never the
population. It was that nobody ever ASSERTED on it.

🔴 AND THAT MAKES CHECK 2 THE NOTES-INDEPENDENT COMPLEMENT TO CHECK 1. Check 1's MINOR
arm asks whether the identifiers THE NOTES NAME appear in the window, so notes that
name the wrong things defeat it. This arm reads no notes at all: it asks whether ANY
shipped producer moved. A MINOR whose producer window is empty ships nothing, whatever
its notes say — `C2_MINOR_NO_SUBSTANCE`. The two can disagree, which is the only
reason having both is worth anything (216 §2.1's rule, pointed the other way).

🔴 THE VERSION-BUMP HUNK CLASSIFIER IS STILL HERE, FOR THE TWO WINDOWS THAT DO CARRY
THE WRITE: a `--head-ref` replay of a historical cut ends AT the release commit, and a
tag placed later than its release commit drags the write in. A changed hunk is the
ritual's own write iff substituting the old version literal for the new one turns every
removed line into exactly its added line — nothing else on that line may differ. That
is the tightest test available and it needs no per-file pattern table.

🔴 AND ONE HOLE THIS FILE REPORTS RATHER THAN CLOSES. Tags are not always placed on
the release commit — `v1.73.1` points one commit PAST it, so #262 is invisible to every
window starting at that tag. Nothing touching a producer has fallen into such a shadow
yet. The direction that WOULD have made 216's story true — a tag placed EARLIER than
its release commit, dragging the version write into the next window — IS gated:
`C2_TAG_MISPLACED`, asserted from the tag's own tree.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
# 🔴 THE TARBALL POPULATION FLOOR IS IMPORTED, NOT RESTATED — 203 §2's ONE LIST rule
# applied to a NUMBER. `--assert-map` below floors exactly the population
# `registry_bytes.py` floors, for exactly its reason (`tarball_trap()`: two empty
# collections agree by construction, so the roots-both-ways answer is a tautology
# unless the entry list is real). A second literal here would be a second thing to
# move. 🔴 THE IMPORT IS ALSO WHAT KEEPS `--selftest` PURE: `registry_bytes` and the
# `registry_lag` it imports do no module-level work — measured at 217, both import in
# ~0.015s with no network. If either ever grows a side effect, this line is where the
# selftest stops being pure, and that is the thing to look at first.
from registry_bytes import ENTRY_FLOOR  # noqa: E402

# 🔴 CHECK 3's MAP — 203 §2's ONE LIST, and 204 §2's PRODUCERS. Check 6 is what
# licenses reading the producer as a proxy for the product: with the shipped bytes
# proved equal to their live sources, the source is a defensible reading of what
# ships. 🆕 217 — THE TARBALL-ROOTS-BOTH-WAYS ASSERTION OVER THIS MAP IS `--assert-map`
# BELOW, not in the ritual any more; 216 §6.4 named the promotion and this is it.
SHIPPED_SOURCE = {
    "dist":         ("host/src", "*.ts"),              # tsc
    "addon":        ("addons/breakpoint_mcp", "*"),    # host/scripts/stage-addon.mjs
    "README.md":    ("host/README.md", None),          # NOT the repo-root README
    "LICENSE":      ("host/LICENSE", None),
    # 201 §2 — npm ships this REGARDLESS of `files`.
    "package.json": ("host/package.json", None),
}

# 🔴 THE TWO PRODUCER FILES THE RITUAL ITSELF EDITS ON EVERY CUT. Six version fields
# across six files are written; only these two are inside `SHIPPED_SOURCE`, so only
# these two can ever appear in check 2's window. 🔴 THIS IS A TUPLE OF PATHS AND NOT A
# COUNT, ON PURPOSE — 216 §4 spent a `floor_pin_gate` run on two refusal codes that
# were floor-shaped only because they had been named after the floor they report. A
# name that says what a thing IS costs nothing; a name that says what it RESEMBLES
# costs a gate run.
RITUAL_VERSION_FILES = ("host/package.json", "host/src/index.ts")

# 🔴 THE FLOOR, AND IT IS ON THE POPULATION READ, NOT ON THE ANSWER. A block naming
# two identifiers is not evidence either way; five is the number the PATCH arm has
# been pinned to since 203 and there is no reason the two arms should disagree about
# what "enough to read" means. 🔴 IT IS ALSO THE CONSTANT 215 §3's FIRST DEFECT WAS
# MEASURED AGAINST — see `the 215 incident` in SELFTEST, which asserts BOTH sides of
# it, so lowering this number to make an abort go away reddens the table.
NAME_FLOOR = 5

# 🔴 THE UNDERSCORE IS REQUIRED IN BOTH — 202 §3. It is what keeps prose words out
# of the roster ("THE", "AND") and ordinary lowercase words out of the API set.
# 🆕 220 — AND THE NEGATIVE LOOKAHEAD IS A THIRD DEFECT, FOUND THE WAY THE OTHER
# TWO WERE: BY THE CHECK ABORTING A REAL CUT. `API_RE` below is scoped to BACKTICKS;
# this one is not, and reads SCREAMING runs out of running prose — which is right for
# `ENTRY_FLOOR` named mid-sentence and WRONG for the stem of a FILE PATH. 1.73.4's
# notes said "the two doc stamps in `README.md` and `docs/USER_GUIDE.md`", and
# `USER_GUIDE` reaches shipped source (the doctor and init strings point users at the
# guide), so the PATCH arm read a LEAK and refused a cut that changed no product code
# at all. 🔴 THE CHECK WAS WRONG, WHICH IS THE HALF 215 §3's LESSON DOES NOT COVER:
# its rule is that the notes are usually at fault, and here a path was being read as an
# identifier. The rule is exact rather than a guess — a SCREAMING run followed by a dot
# and a lowercase extension is a FILENAME STEM, and nobody writes `ENTRY_FLOOR.md`. A
# constant ending a sentence (`ENTRY_FLOOR.` then a space) is untouched, because the
# lookahead requires the letters.
CONST_RE = re.compile(r"\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b(?!\.[a-z]{1,5}\b)")
# 🔴 THE `(?:\(\))?` IS 215 §3's SECOND FIX AND IT IS NOT COSMETIC. Without it
# `body_brace()` is invisible and `log_seq` is not, so the reader's blind spot is
# "prose that names a function" — which is most prose about instrument work.
API_RE = re.compile(r"`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)(?:\(\))?`")

# Refusal codes. Named so the selftest can check WHICH refusal fired, not only that
# one did — registry_lag.py §SELFTEST's lesson: two defects returning the same value
# is how a zeroed constant stays green.
OK = "OK"
NO_BLOCK = "NO_BLOCK"
POPULATION_COLLAPSED = "POPULATION_COLLAPSED"
LEAK = "LEAK"
MINOR_POPULATION = "MINOR_POPULATION"
MINOR_UNSUPPORTED = "MINOR_UNSUPPORTED"
MINOR_NO_WINDOW = "MINOR_NO_WINDOW"
NO_ARM = "NO_ARM"

# 🆕 227 — THE MAJOR ARM'S CODES. 210 §9 left this arm unwritten and four handoffs
# carried it as a dated blocker; `NO_ARM` above is the refusal it has been returning
# instead. 🔴 IT COULD NOT HAVE BEEN WRITTEN BEFORE CHECK 8, and that is the whole
# reason it went unwritten rather than the reason anyone gave. The PATCH arm asks
# where names LIVE and the MINOR arm asks what MOVED; both are answerable from this
# repository's own text. A MAJOR's claim is not about this repository at all — it is
# that SOMETHING THAT WORKED AGAINST THE PREVIOUS RELEASE CAN NOW FAIL, which is a
# claim about a caller, and no reader of our source can see a caller. The wire can.
#
# 🔴 THE SUBSTANCE HALF IS THE MINOR ARM'S, SHARED RATHER THAN COPIED. A MAJOR
# contains product work by definition, so its floor and window questions are the same
# questions — but the CODES are distinct, because a refusal that prints "MINOR claim
# is UNSUPPORTED" on a MAJOR cut is a reader describing a release it is not reading.
MAJOR_POPULATION = "MAJOR_POPULATION"
MAJOR_UNSUPPORTED = "MAJOR_UNSUPPORTED"
MAJOR_NO_WINDOW = "MAJOR_NO_WINDOW"
MAJOR_NOT_BREAKING = "MAJOR_NOT_BREAKING"

# 🆕 217 — CHECK 2's CODES. Same discipline: a named refusal so the table can prove
# WHICH branch fired, not merely that one did.
C2_OK = "C2_OK"
C2_SILENT = "C2_SILENT"
C2_MINOR_NO_SUBSTANCE = "C2_MINOR_NO_SUBSTANCE"
C2_TAG_MISPLACED = "C2_TAG_MISPLACED"

# 🆕 219 — THE LATE-TAG DIRECTION, CLOSED BY MAKING THE TAG CARRY THE FACT.
#
# 217 §5 measured this direction and REFUSED to gate it, which was right: a tag placed one
# commit PAST its release commit hides that commit from every window starting at the tag,
# and finding "the previous release commit" meant a `grep` over commit subjects. A
# heuristic is not a gate, and `v1.73.1` is a live example — one commit, nothing touching a
# producer inside it, and nothing that could have said so.
#
# 🔴 SO THE RITUAL WRITES THE FACT INSTEAD OF THE READER INFERRING IT. `--tag-cmd` emits an
# ANNOTATED tag whose message declares the commit it names; the next cut reads that
# declaration back and the shadow is one `git rev-list --count` with nothing guessed. The
# same shape as `tag_tree_version`, one level up: read what the tag SAYS about itself
# rather than what its name implies.
#
# 🔴 AND A TAG THAT PREDATES THE CONVENTION IS NOT GREEN — IT IS UNANSWERABLE, AND SAYS SO.
# Every tag on this repository today is lightweight and carries no message at all, so for
# those the honest answer is "this cannot be measured here", printed, rather than a pass
# that reads like one. That state ends by itself: the first tag written by `--tag-cmd` is
# the last one that cannot answer.
C2_TAG_LATE = "C2_TAG_LATE"
TAG_TREE_DISAGREES = "TAG_TREE_DISAGREES"
TAG_COMMIT_UNFINDABLE = "TAG_COMMIT_UNFINDABLE"
TAG_OK = "TAG_OK"

# 🔴 ONE SPELLING, WRITTEN AND READ. `tag_command()` emits this line and `tag_release_commit()`
# parses it, and the self-test asserts the round trip rather than trusting two literals to
# stay the same — 203 §2's ONE LIST, applied to a wire format of one line.
TAG_DECL_RE = re.compile(r"^release-commit:\s*([0-9a-f]{7,40})\s*$", re.M)

# 🆕 219 — CHECK 4'S CODES. THE ADDON VERSION IS NOT A FUNCTION OF THE ADDON.
#
# Measured this session against the live Asset Library (asset 5335): it serves
# `version_string "1.9.8"` from `download_commit c3c3d51` = v1.72.7. `plugin.cfg` on `main`
# also says `1.9.8`. 🔴 THREE DIFFERENT TREES ANSWER TO THAT ONE NAME — the commit where
# it was stamped (#188), the commit the library serves (#231 already in it), and `main`
# (#258 on top, sixty-five lines further). Users installing "1.9.8" get the middle one.
#
# 🔴 AND THE RITUAL IS WHY. It writes six version fields at a cut and `plugin.cfg` is not
# one of them, because the addon is on its own cadence — so the host version moves every
# release and the addon version moves only when somebody remembers. `contract_check` asserts
# every COPY of the addon version agrees; nothing asserts that the version MOVED when the
# addon did. That is `tag_tree_version`'s lesson one artifact over: a name is not a tree.
#
# 🔴 THIS IS A RELEASE-TIME READER AND NOT A CI STEP, ON PURPOSE. `main` is stale RIGHT NOW,
# so wiring it to every push would ship a red tree; and the moment it actually matters is the
# cut, which is when `plugin.cfg` would be re-stamped. The refusals are proved on every push
# by `--selftest` regardless, which is the same split checks 1 and 2 already live under.
C4_OK = "C4_OK"
C4_ADDON_STALE = "C4_ADDON_STALE"
C4_ADDON_UNFINDABLE = "C4_ADDON_UNFINDABLE"
# 🔴 A REFUSAL ABOUT THE READER, NOT ABOUT THE TREE, AND THE MUTATION SWEEP IS WHY IT
# EXISTS. Widening the window to `stamp~1..HEAD` — including the stamp commit's own
# changes — left both the self-test and the live exit code unchanged, because the verdict
# stayed STALE and only the reported detail moved. A boundary nothing pins is a boundary
# that can be off by one for a year. The invariant is exact and cannot go stale: the stamp
# commit is the boundary, so it must never appear INSIDE the window it opens.
C4_WINDOW_INCLUDES_STAMP = "C4_WINDOW_INCLUDES_STAMP"

ADDON_DIR = "addons/breakpoint_mcp"
ADDON_CFG = f"{ADDON_DIR}/plugin.cfg"

# 🆕 217 — `--assert-map`'s codes, promoted from the ritual's check 3.
MAP_OK = "MAP_OK"
MAP_UNMAPPED = "MAP_UNMAPPED"
MAP_STALE = "MAP_STALE"
MAP_MISSING_SOURCE = "MAP_MISSING_SOURCE"
MAP_TARBALL_THIN = "MAP_TARBALL_THIN"


# 🆕 227 — CHECK 8'S CODES, AND THE REASON THIS FILE IS WHERE THEY LIVE.
#
# 🔴 THE INSTRUMENT EXISTED, WAS CORRECT, RAN GREEN IN CI, AND WAS NOT ATTACHED TO THE
# DECISION IT WAS BUILT FOR. `host/scripts/wire_diff.mjs` was written in 209 against the
# observation that checks 1-7 all *"PROJECT ONTO A FILE"* and none onto the wire — the
# `tools/list` payload, which is the entire public API of an MCP server and the only
# thing a MINOR/PATCH/MAJOR claim is actually ABOUT. Since 1.73.0 it has run in CI only
# as `wire_diff.selftest.mjs`: the classifier proving it can classify FIXTURES, on every
# push, while classifying no release. 226 §2 ran it BY HAND against the 1.74.0 cut and it
# said MAJOR — four field paths — where the shipped source's own docstring said *"older
# clients are unaffected"*. The cut was narrowed to a real MINOR before it shipped. 🔴 THE
# ONLY REASON THAT HAPPENED IS THAT SOMEBODY RAN A PROGRAM NOTHING ASKED THEM TO RUN.
#
# 🔴 A GREEN SELF-TEST LINE IS WHAT MADE IT LOOK ANSWERED. That is the failure worth
# naming, because it is not "we lacked an instrument" — it is harder to see than that.
# The gate existed and was passing; it was answering a SMALLER question. 226 §16.
#
# 🔴 AND IT GOES HERE, NOT IN THE RITUAL, BECAUSE THE RITUAL IS GITIGNORED SCRATCH.
# `host/_to_delete/release<N>.py` is copied forward by hand every session — 215 §6.3's
# bill, paid twice already, and the argument that pulled checks 1, 2, 3 and 4 into this
# file. A check wired into a file that is copied by hand is a check the next copier can
# drop, which is the same class of failure as never wiring it at all.
#
# 🔴 THERE IS NO SKIP FLAG, DELIBERATELY. `--no-wire` would be the humane thing to add
# the first time the baseline build is slow, and it would return this check to exactly
# the state 209 left it in: available, correct, and not consulted.
C8_OK = "C8_OK"
C8_BENEATH = "C8_BENEATH"
C8_UNREACHABLE = "C8_UNREACHABLE"
C8_NOT_A_VERDICT = "C8_NOT_A_VERDICT"

# PATCH < MINOR < MAJOR. The rank is `wire_diff.mjs`'s own, restated here because the
# two files cannot import each other across the language boundary — and the round trip
# is asserted in SELFTEST instead of trusted, the same way `TAG_DECL_RE` is.
WIRE_RANK = {"PATCH": 0, "MINOR": 1, "MAJOR": 2}


def wire_floor(wire: str | None, bump: str) -> tuple[str, str, dict]:
    """Check 8, PURE: may this bump be claimed over what the wire actually did?

    🔴 A FLOOR, NOT AN EQUALITY, AND THE ASYMMETRY IS THE DESIGN. Claiming LESS than
    the wire did is the defect — 1.74.0 was a MAJOR wearing a MINOR's name, and every
    caller that trusted the number would have been told the schemas held still. Claiming
    MORE is not a defect: a behaviour change that moves no schema is a real MINOR the
    classifier is blind to by construction, and a reader that refused it would be
    demanding the wire agree with a question it was never asked. So the high side is
    REPORTED and the low side REFUSES.

    🔴 UNREACHABLE IS RED. `wire_diff.mjs` says so in its own words — *"a baseline that
    will not build is not evidence that the public API held still"* — and this is that
    sentence with an exit code behind it.
    """
    d = {"wire": wire, "bump": bump,
         "rank_wire": WIRE_RANK.get(wire or ""), "rank_bump": WIRE_RANK.get(bump)}
    if wire is None:
        return C8_UNREACHABLE, (
            "🔴 check 8 could not read the wire, and that is a REFUSAL rather than a "
            "skip. The classifier needs BOTH surfaces: a baseline ref that still "
            "builds, and a CURRENT build at host/dist — run `npm run build` before "
            "the cut. A release that cannot say what its public API did is not a "
            "release anybody can size."), d
    if wire not in WIRE_RANK or bump not in WIRE_RANK:
        return C8_NOT_A_VERDICT, (
            f"🔴 check 8 read {wire!r} against bump {bump!r} and one of them is not a "
            f"verdict this reader knows ({sorted(WIRE_RANK)}). `wire_diff.mjs`'s output "
            f"format has moved, or the parse did. Do NOT treat an unparseable answer as "
            f"a passing one — that is the whole shape of the thing this check exists "
            f"to catch."), d
    if WIRE_RANK[wire] > WIRE_RANK[bump]:
        return C8_BENEATH, (
            f"🔴 THE BUMP IS BENEATH THE WIRE — this cut claims {bump} and the public "
            f"API did {wire}. That is 1.74.0's shape exactly (226 §2): a MAJOR under a "
            f"MINOR name, caught by hand because nothing asked. Read the classifier's "
            f"own MAJOR lines: either the bump is wrong, or the change is, and no third "
            f"reading of this exists."), d
    exact = WIRE_RANK[wire] == WIRE_RANK[bump]
    return C8_OK, (
        f"the wire did {wire} and the cut claims {bump}"
        + ("" if exact else
           f" — ABOVE the wire, which is legal and worth reading: a {bump} whose "
           f"schemas did not move is behaviour the classifier cannot see, so the "
           f"claim rests on the notes and check 2 rather than on this")), d


def major_evidence(wire: str | None,
                   engines: tuple[dict | None, dict | None] | None) -> list[str]:
    """What could make a MAJOR true, derived — never claimed. PURE.

    🔴 TWO SOURCES, AND THE SECOND ONE IS WHY THIS IS NOT JUST `wire == "MAJOR"`.
    The first draft of the MAJOR arm required the classifier's MAJOR and nothing else,
    and it would have REFUSED THE EXACT RELEASE THIS ARM EXISTS TO UNBLOCK: the SDK-v2
    migration's `engines.node` `>=18` -> `>=20` (226 item 12) breaks every consumer on
    Node 18 and moves NOT ONE SCHEMA. The wire would have said PATCH and the arm would
    have said "a MAJOR that breaks nothing" — a check refusing a real major because its
    one instrument is blind to install contracts.

    🔴 SO THE BREAKING SURFACE IS THE WIRE **AND** THE INSTALL CONTRACT. `engines` is
    the manifest field a consumer's package manager enforces; narrowing it is a
    breaking change delivered without touching a single tool. Both halves are derived
    from artifacts — `tools/list` and `host/package.json` at two refs — so neither can
    be satisfied by writing a sentence in the changelog.
    """
    out = []
    if wire == "MAJOR":
        out.append("check 8's classifier read MAJOR on the wire")
    if engines is not None:
        before, after = engines
        if before != after:
            out.append(f"the install contract moved: engines {before} -> {after}")
    return out


def read_names(released: str) -> tuple[list[str], list[str]]:
    """The whole vocabulary of a released block, split by CASE — pure.

    Returns (constants, api). The split is the docstring's floor/leak division and
    every caller downstream depends on it staying two lists.
    """
    constants = sorted(set(CONST_RE.findall(released)))
    api = sorted(set(API_RE.findall(released)))
    return constants, api


def verdict(released: str, shipped_text: str, bump: str,
            floor: int | None = None,
            changed_text: str | None = None,
            wire: str | None = None,
            engines: tuple[dict | None, dict | None] | None = None,
            ) -> tuple[str, str, dict]:
    """Check 1, as a PURE function of (block, corpus, bump). Never raises.

    🔴 IT RETURNS A REFUSAL RATHER THAN ASSERTING, so the table below can drive it.
    An assertion is not drivable, and an undrivable check is one whose refusal has
    never been seen — which is the state check 1 was in for twenty-two releases.

    Returns (code, human reason, detail).
    """
    f = NAME_FLOOR if floor is None else floor
    constants, api = read_names(released)
    legible = sorted(set(constants) | set(api))
    leaked = [n for n in constants if n in shipped_text]
    reaching = [n for n in api if n in shipped_text]
    # 🔴 `reaching` IS DETAIL NOW, NOT EVIDENCE. See the docstring's third defect:
    # a name reaching shipped source says nothing about whether THIS release moved
    # it. `in_window` is the one the MINOR arm reads.
    in_window = ([n for n in api if n in changed_text]
                 if changed_text is not None else None)
    d = {"constants": constants, "api": api, "legible": legible,
         "leaked": leaked, "reaching": reaching, "in_window": in_window,
         "floor": f}

    if not released.strip():
        return NO_BLOCK, "the released block is empty — nothing to read", d

    if bump == "PATCH":
        # 🔴 THE FLOOR READS BOTH CASES. 215 §3's first defect is exactly the arm
        # that read one. Do NOT narrow this back to `constants`.
        if len(legible) < f:
            return POPULATION_COLLAPSED, (
                f"check 1's population collapsed to {len(legible)} name(s): "
                f"{legible} (constants {constants}, api {api}) — floor is {f}. "
                f"Re-read the block by hand: either it really is too thin to "
                f"support a claim, or it names its work in a case this reader "
                f"cannot see, which is 215 §3's defect returning."), d
        # 🔴 AND THE LEAK ASSERTION READS ONLY THE CONSTANTS. Widening it to `api`
        # reddens `the separation is load-bearing` below, on purpose.
        if leaked:
            return LEAK, (
                f"PATCH claim is FALSE — these instrument constants reach shipped "
                f"source: {leaked}. The notes describe product work, or the bump "
                f"is wrong. Check 8 read the wire; go and look at what it said."), d
        return OK, (
            f"{len(legible)} name(s) read ({len(constants)} constant, {len(api)} "
            f"lower_snake); the {len(constants)} constant name(s) are 0 reachable "
            f"from the {len(SHIPPED_SOURCE)} shipped roots; {len(reaching)} "
            f"lower_snake name(s) DO reach shipped source ({reaching}) and that is "
            f"EXPECTED, not a leak"), d

    if bump in ("MINOR", "MAJOR"):
        # 🆕 227 — ONE SUBSTANCE TEST, TWO ARMS, THREE CODES EACH. A MAJOR contains
        # product work by definition, so its floor and window questions ARE the MINOR
        # arm's questions and sharing the implementation is 203 §2's ONE LIST rule
        # applied to a branch. The codes stay distinct so the table can still prove
        # WHICH arm refused — and so a refusal never describes a release it is not
        # reading.
        pop_code, window_code, unsupported_code = (
            (MINOR_POPULATION, MINOR_NO_WINDOW, MINOR_UNSUPPORTED) if bump == "MINOR"
            else (MAJOR_POPULATION, MAJOR_NO_WINDOW, MAJOR_UNSUPPORTED))
        # 🔴 THE MIRROR OF THE PATCH ARM'S FLOOR, AND IT READS `api` ALONE ON
        # PURPOSE: a MINOR's claim is about identifiers reaching the product, and
        # the codebase spells those in lower snake. A MINOR whose block names only
        # constants has not described product work.
        if len(api) < f:
            return pop_code, (
                f"check 1's {bump} population collapsed to {len(api)} name(s): "
                f"{api} — floor is {f}. A release block this thin cannot support a "
                f"{bump} claim; re-read it by hand."), d
        # 🔴 NO WINDOW, NO CLAIM. Passing here would be passing on a comparison
        # that was not made — registry_bytes.py's rule, and the shape of the
        # 42-session blocker: an answer that could not be computed, recorded as
        # though it had been.
        if in_window is None:
            return window_code, (
                f"🔴 the {bump} arm needs the DIFF WINDOW and was given none. The "
                "question is not whether these names exist in the product, it is "
                "whether this release MOVED them; without the window there is "
                "nothing to answer it with. Pass changed_text (the live half "
                "computes it from --previous)."), d
        if not in_window:
            return unsupported_code, (
                f"🔴 {bump} claim is UNSUPPORTED BY THE NOTES — none of the "
                f"{len(api)} identifier(s) the released block names appears in "
                f"what CHANGED in the {len(SHIPPED_SOURCE)} shipped roots this "
                f"window: {api}. {len(reaching)} of them do reach shipped source "
                f"({reaching}) and that is NOT evidence — a name can be in the "
                f"product without this release having touched it, which is exactly "
                f"how 1.73.2 passed this arm while being a PATCH (215 §2). Check 8 "
                f"says the wire moved and the notes describe something that did "
                f"not ship. One of the two is wrong. Do NOT delete this check."), d
        if bump == "MINOR":
            return OK, (f"{len(api)} identifier(s) named, {len(in_window)} of them "
                        f"appear in what CHANGED in the shipped roots ({in_window}); "
                        f"{len(reaching)} reach shipped source at all ({reaching})"), d

        # 🆕 227 — AND THE HALF THAT IS ONLY A MAJOR'S. Everything above proves the
        # release SHIPPED something; this asks whether what it shipped BREAKS anybody,
        # which is the entire difference between the two bumps and the one question no
        # reader of this repository's own text can answer. 🔴 THE EVIDENCE IS DERIVED
        # FROM ARTIFACTS AT TWO REFS — the wire and the install contract — so a MAJOR
        # cannot be talked into existence by the notes that claim it.
        breaking = major_evidence(wire, engines)
        d["breaking"] = breaking
        if not breaking:
            return MAJOR_NOT_BREAKING, (
                f"🔴 MAJOR claim has NO BREAKING EVIDENCE. The notes describe real "
                f"work — {len(in_window)} named identifier(s) moved in the shipped "
                f"roots — but check 8 read the wire as {wire!r} and the install "
                f"contract did not move ({engines!r}). A release that adds surface "
                f"without removing or narrowing any is a MINOR however large it "
                f"felt to write. 🔴 If it IS breaking, the break is in neither place "
                f"this arm can see: say where, in the notes, and widen "
                f"`major_evidence` to read it — do not lower the bar to admit an "
                f"unmeasured one."), d
        return OK, (f"{len(api)} identifier(s) named, {len(in_window)} of them appear "
                    f"in what CHANGED in the shipped roots ({in_window}); and the "
                    f"MAJOR is EVIDENCED, not claimed — {'; '.join(breaking)}"), d

    # 🔴 AND THIS IS NO LONGER THE MAJOR'S REFUSAL — 210 §9 IS CLOSED ABOVE. It stays
    # because the argument that put it here was never about MAJOR: `--bump` is
    # argparse-constrained today and a fourth bump word arriving from a caller that is
    # not argparse must land on a refusal rather than on the end of a function.
    return NO_ARM, (f"BUMP {bump!r} has no check 1 arm — the three this file knows are "
                    f"{sorted(WIRE_RANK)} (the MAJOR arm is 227's; 210 §9 is closed)"), d


# ── CHECK 2, AS A PURE READER OVER A DIFF — 216 §6.3, on a corrected premise ───

_FILE_RE = re.compile(r"^diff --git a/(\S+) b/\S+$")


def parse_diff(diff_text: str) -> dict[str, list[tuple[list[str], list[str]]]]:
    """`git diff --unified=0` text -> {path: [(removed, added), ...]} — pure.

    🔴 A PATH WITH AN EMPTY HUNK LIST IS A REAL CHANGE, NOT A MISSING ONE. A rename or
    a mode change produces a `diff --git` header and no `@@` at all, and `all()` over
    an empty list is True — so a classifier that forgets this reports "the ritual wrote
    it" about a file the ritual never touched. The empty list is preserved here and
    handled explicitly in `split_window`; `a rename has no hunks` in the table below is
    the row that reddens if either half is dropped.
    """
    files: dict[str, list[tuple[list[str], list[str]]]] = {}
    path: str | None = None
    cur: tuple[list[str], list[str]] | None = None
    for line in diff_text.splitlines():
        m = _FILE_RE.match(line)
        if m:
            path = m.group(1)
            files.setdefault(path, [])
            cur = None
            continue
        if path is None:
            continue
        if line.startswith("@@"):
            cur = ([], [])
            files[path].append(cur)
            continue
        # 🔴 THE `---`/`+++` HEADERS ARE OUTSIDE EVERY HUNK, so `cur is None` already
        # excludes them and no startswith guard is needed here. That matters: a REMOVED
        # line whose own content is `--` arrives as `---`, and a guard would silently
        # drop it — a content-shaped-like-a-header bug of exactly the kind 216 §4 found
        # in a name. Inside a hunk the first character is the only thing that is syntax.
        if cur is None:
            continue
        if line.startswith("-"):
            cur[0].append(line[1:])
        elif line.startswith("+"):
            cur[1].append(line[1:])
    return files


def is_version_bump_hunk(removed: list[str], added: list[str],
                         old: str, new: str) -> bool:
    """True iff this hunk is ONLY the version literal moving from `old` to `new`.

    🔴 THE TEST IS SUBSTITUTION AND EQUALITY, NOT A PATTERN. `removed.replace(old, new)
    == added` admits a line only when the version literal is the entire difference —
    any other edit anywhere on that line breaks the equality and the hunk is
    substantive. A regex over `"version": "..."` would have to be maintained per file
    and would pass a line that changed the version AND something else.
    """
    if not removed or len(removed) != len(added):
        return False
    return all(old in r and r.replace(old, new) == a
               for r, a in zip(removed, added))


def split_window(diff_text: str, old: str, new: str) -> tuple[list[str], list[str]]:
    """(ritual_only, substantive) file paths — pure.

    A file is `ritual_only` iff it has at least one hunk and EVERY hunk is a version
    bump. Everything else — including a header with no hunks at all — is substantive.
    """
    ritual_only, substantive = [], []
    for path, hunks in sorted(parse_diff(diff_text).items()):
        if hunks and all(is_version_bump_hunk(r, a, old, new) for r, a in hunks):
            ritual_only.append(path)
        else:
            substantive.append(path)
    return ritual_only, substantive


def population(diff_text: str, old: str, new: str, bump: str,
               tag_tree_version: str | None = None,
               shadow: int | None = None) -> tuple[str, str, dict]:
    """Check 2, as a PURE function of (window, versions, bump). Never raises.

    `tag_tree_version` is the version literal found in `host/src/index.ts` AT THE TAG
    the window starts from. It must be `old`: the tag is supposed to sit at or after
    the cut that wrote it. A tag placed EARLIER than its release commit drags that
    write into this window, which is the shape 216 §3 believed was universal.

    🆕 219 — `shadow` is the OTHER direction, and it is a COUNT rather than a version
    because the late case leaves the tag's tree entirely correct. A tag one commit past
    its cut still ships the new version, which is precisely why 216 and 217 could both
    read this window and see nothing wrong with it. `None` means the tag declares no
    release commit at all, and that is neither a pass nor a refusal — it is a question
    this window cannot answer, reported as one.
    """
    ritual_only, substantive = split_window(diff_text, old, new)
    d = {"ritual_only": ritual_only, "substantive": substantive,
         "moved": sorted(ritual_only + substantive),
         "tag_tree_version": tag_tree_version, "shadow": shadow}

    if tag_tree_version is not None and tag_tree_version != old:
        return C2_TAG_MISPLACED, (
            f"🔴 the window starts at v{old} but that tag's tree says the shipped "
            f"version is {tag_tree_version!r}. The tag is not on the cut it names, so "
            f"this window either drags the previous release's version write in or "
            f"drops work that landed before the tag. Check 2 and check 1's MINOR arm "
            f"both read this window; neither is answerable until the tag is right."), d

    if shadow:
        return C2_TAG_LATE, (
            f"🔴 v{old}'s tag DECLARES its release commit and sits {shadow} commit(s) "
            f"PAST it. Everything in that gap shipped in v{old} and is invisible to this "
            f"window and to check 1's MINOR arm — a producer that moved there cannot be "
            f"seen by either reader, in this cut or in any later one. 🔴 THE TAG'S TREE "
            f"IS CORRECT IN THIS CASE, which is why C2_TAG_MISPLACED cannot find it and "
            f"why 217 §5 left the direction open: the fact needed is which commit the "
            f"tag was FOR, and only the tagger knew it. Now the tag says."), d

    if bump == "MINOR" and not substantive:
        return C2_MINOR_NO_SUBSTANCE, (
            f"🔴 MINOR claim is UNSUPPORTED BY THE TREE — nothing in the "
            f"{len(SHIPPED_SOURCE)} shipped producers moved this window except "
            f"{len(ritual_only)} file(s) this ritual wrote itself ({ritual_only}). A "
            f"MINOR that ships no product change is a PATCH. 🔴 THIS READS NO NOTES AT "
            f"ALL, which is why it is worth having beside check 1: check 1's MINOR arm "
            f"can be satisfied by notes that name the right words, and this cannot."), d

    if not substantive:
        return C2_SILENT, (
            f"0 producer file(s) moved that this ritual did not write "
            f"({len(ritual_only)} it did: {ritual_only}). 🔴 THAT IS A REAL ZERO AND IT "
            f"IS THE {bump} CLAIM, from an angle that reads neither the notes nor the "
            f"wire — measured at 217, nine of the last ten cuts look exactly like "
            f"this, and the tenth was the only MINOR."), d

    return C2_OK, (
        f"{len(substantive)} producer file(s) moved that this ritual did not write "
        f"({substantive}); {len(ritual_only)} it did ({ritual_only}). The "
        f"MINOR/PATCH question is real this window and check 8 reads the wire for it."), d


# ── `--assert-map` — check 3's BOTH-WAYS assertion, promoted (216 §6.4) ────────

def assert_map(tarball: list[str], exists=None,
               entry_floor: int | None = None) -> tuple[str, str, dict]:
    """The tarball's roots against SHIPPED_SOURCE, BOTH WAYS — pure given `exists`.

    🔴 `exists` IS INJECTED SO THE TABLE CAN DRIVE THIS WITHOUT A TREE. The live half
    passes a real filesystem probe; `--selftest` passes a set. Same argument as
    `verdict`'s `shipped_text`: a check that can only be run by cutting a release is a
    check whose refusals nobody has watched.
    """
    f = ENTRY_FLOOR if entry_floor is None else entry_floor
    roots = sorted({e.split("/")[0] for e in tarball})
    unmapped = [r for r in roots if r not in SHIPPED_SOURCE]
    stale = [k for k in SHIPPED_SOURCE if k not in roots]
    d = {"entries": len(tarball), "roots": roots, "unmapped": unmapped,
         "stale": stale, "missing_source": [], "floor": f}

    # 🔴 THE FLOOR FIRST, AND IT IS NOT DEFENSIVE PROGRAMMING. Both answers below are
    # EMPTY when the tarball is empty — `unmapped` because there are no roots and
    # `stale` only if the map is empty too. An answer that is clean by construction is
    # `tarball_trap()`'s finding one file over, and 216 §2.4's: a control whose premise
    # did not hold reports the same shape as one that passed.
    if len(tarball) < f:
        return MAP_TARBALL_THIN, (
            f"🔴 the tarball has {len(tarball)} entr(y/ies), below the floor of {f}. "
            f"The roots-both-ways answer is clean by construction on a population this "
            f"small, so it is not an answer. Did `npm pack --dry-run` actually run, and "
            f"did `npm run stage-addon` run before it?"), d

    if unmapped:
        return MAP_UNMAPPED, (
            f"🔴 npm ships {len(unmapped)} top-level root(s) with NO declared source: "
            f"{unmapped}. Add each to SHIPPED_SOURCE and re-ask the MINOR/PATCH "
            f"question over it — an undeclared root is product that check 1, check 2 "
            f"and the corpus are all blind to. 🔴 DO NOT DELETE THIS ASSERTION; it is "
            f"the half check 8 cannot do, because the wire cannot name a file."), d

    if stale:
        return MAP_STALE, (
            f"🔴 SHIPPED_SOURCE names {len(stale)} root(s) npm no longer ships: "
            f"{stale}. Either `files` in host/package.json changed and the map did "
            f"not, or the tarball was packed without `npm run stage-addon` and the "
            f"`addon` root is simply absent. Both are worth stopping for."), d

    if exists is not None:
        missing = [f"{r} -> {SHIPPED_SOURCE[r][0]}"
                   for r in roots if not exists(SHIPPED_SOURCE[r][0])]
        d["missing_source"] = missing
        if missing:
            return MAP_MISSING_SOURCE, (
                f"🔴 the map declares a source that is not on disk: {missing}. The "
                f"corpus every name check reads is built from these paths, so a "
                f"missing one silently shrinks what 'reaches shipped source' means."), d

    return MAP_OK, (f"{len(tarball)} packed entr(y/ies) over {len(roots)} root(s) "
                    f"{roots}; every root maps to a declared source and every declared "
                    f"source is still shipped — both directions, floor {f}"), d


# ── the live half — needs a released block, so it belongs to the cut ───────────

def shipped_corpus(root: Path = ROOT) -> str:
    """Concatenate every PRODUCER named by SHIPPED_SOURCE. Refuses on a missing one."""
    parts = []
    for rootname, (rel, pat) in SHIPPED_SOURCE.items():
        p = root / rel
        if not p.exists():
            raise SystemExit(
                f"🔴 RELEASE_NAMES REFUSED — SHIPPED_SOURCE declares {rootname!r} at "
                f"{rel!r} and it does not exist. The map has rotted; fix it here and "
                f"re-run the ritual's check 3, which asserts it against the tarball.")
        if pat is None:
            parts.append(p.read_text(errors="ignore"))
        else:
            for f in sorted(p.rglob(pat)):
                if f.is_file():
                    parts.append(f.read_text(errors="ignore"))
    return "\n".join(parts)


def released_block(changelog: str, new: str, date: str, old: str) -> str | None:
    """The text between this release's header and the previous one. None if absent."""
    head = f"## [{new}] — {date}"
    if head not in changelog:
        return None
    rest = changelog.split(head, 1)[1]
    return rest.split(f"## [{old}]", 1)[0] if f"## [{old}]" in rest else rest


def changed_window(previous: str, root: Path = ROOT, head: str = "HEAD") -> str:
    """ADDED lines only, over the SHIPPED_SOURCE producers, since v{previous}.

    🔴 ADDED AND NOT REMOVED, ON PURPOSE. The MINOR claim is that this release put
    something into the product. A name appearing only in removed lines is a
    deletion, which is a claim about a different bump entirely.

    🔴 216 SAID THIS WINDOW IS NEVER EMPTY BECAUSE THE RITUAL'S OWN VERSION WRITES ARE
    IN IT. THEY ARE NOT. `git diff A..B` compares two COMMITS and the ritual's write is
    uncommitted when this runs, so at a cut it is invisible here — measured at 217 over
    the last ten cuts, this window is EMPTY on nine of them. The arm still reads NAMES
    and not a line count, because the two windows that DO carry the write are a
    `--head-ref` replay and a misplaced tag, and on those a line count would fire for a
    reason that has nothing to do with the release.
    """
    return "\n".join(l[1:] for l in raw_window(previous, root, head).splitlines()
                     if l.startswith("+") and not l.startswith("+++"))


def raw_window(previous: str, root: Path = ROOT, head: str = "HEAD") -> str:
    """The raw `git diff --unified=0` over the SHIPPED_SOURCE producers since v{previous}.

    Check 1's MINOR arm reads the ADDED LINES of this; check 2 reads its FILE and HUNK
    structure. 🔴 ONE `git diff`, TWO READERS — the two questions must be answered over
    the same window or agreeing means nothing.
    """
    srcs = [rel for rel, _ in SHIPPED_SOURCE.values()]
    r = subprocess.run(["git", "diff", "--unified=0", f"v{previous}..{head}",
                        "--", *srcs],
                       cwd=str(root), capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(
            f"🔴 RELEASE_NAMES REFUSED — could not read the diff window "
            f"v{previous}..{head}: {r.stderr.strip()}. This is RED and not a skip: "
            f"the MINOR arm's evidence IS this window.")
    return r.stdout


# 🆕 227 — CHECK 8's LIVE HALF. ONE SPELLING, WRITTEN THERE AND READ HERE: this pattern
# is the whole interface between the two files, and SELFTEST drives the classifier's own
# emitted line through it rather than trusting a literal — `TAG_DECL_RE`'s argument,
# across a language boundary this time.
WIRE_VERDICT_RE = re.compile(r"^WIRE_VERDICT\s+([A-Z]+)\s*$", re.M)
WIRE_DIFF_REL = "scripts/wire_diff.mjs"

# 🔴 GENEROUS, AND IT IS NOT A GUESS. The classifier checks out the baseline into a
# worktree, compiles it with `tsc`, then starts TWO servers per privilege level and
# pages `tools/list` out of each. Measured this session on the 1.74.0 baseline: ~90s
# in a warm container, and a cold `tsc` on a laptop is several times that. A timeout
# that fires on a slow machine turns this check into a coin toss, and a coin toss is
# how a check gets a `--no-wire` flag added to it.
WIRE_TIMEOUT_S = 900


def wire_read(previous: str, root: Path = ROOT,
              timeout: int = WIRE_TIMEOUT_S) -> tuple[str | None, str]:
    """Run the classifier against v{previous} and read its verdict. (verdict, transcript).

    🔴 NONE IS THE HONEST ANSWER FOR EVERY WAY THIS CAN FAIL, and `wire_floor` turns
    every one of them RED. A baseline that will not build, a missing current build, a
    node that is not installed, a timeout — none of them is evidence that the public
    API held still, and each of them has at some point been somebody's argument for
    skipping a check.
    """
    cmd = ["node", WIRE_DIFF_REL, "--baseline", f"v{previous}", "--summary"]
    try:
        r = subprocess.run(cmd, cwd=str(root / "host"),
                           capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return None, (f"$ {' '.join(cmd)}\n🔴 TIMED OUT after {timeout}s — the baseline "
                      f"build or one of the two servers never finished.")
    except OSError as e:                                    # node absent, cwd gone
        return None, f"$ {' '.join(cmd)}\n🔴 could not run it: {e}"
    transcript = f"$ {' '.join(cmd)}\n{r.stdout}{r.stderr}".rstrip()
    if r.returncode != 0:
        return None, transcript
    m = WIRE_VERDICT_RE.search(r.stdout)
    return (m.group(1) if m else None), transcript


def engines_window(previous: str, root: Path = ROOT,
                   head: str = "HEAD") -> tuple[dict | None, dict | None] | None:
    """`host/package.json`'s `engines` at v{previous} and at `head`. None if unreadable.

    🔴 THE INSTALL CONTRACT, READ AT TWO REFS RATHER THAN DIFFED AS TEXT. A regex over
    the diff window would have to recognise `"node": ">=20"` as an `engines` line
    without seeing the key it sits under; two parses and a `!=` cannot be wrong about
    that. 🔴 AND `head` IS READ FROM THE TREE WHEN IT IS HEAD, because at a cut the
    manifest edit is still uncommitted — the same fact 216 §3 got wrong about check 2.
    """
    def at(ref: str) -> dict | None:
        r = subprocess.run(["git", "show", f"{ref}:host/package.json"],
                           cwd=str(root), capture_output=True, text=True)
        if r.returncode != 0:
            return None
        try:
            return json.loads(r.stdout).get("engines")
        except ValueError:
            return None

    before = at(f"v{previous}")
    if before is None:
        return None
    if head == "HEAD":
        try:
            after = json.loads((root / "host" / "package.json").read_text()).get("engines")
        except (OSError, ValueError):
            return None
    else:
        after = at(head)
        if after is None:
            return None
    return before, after


def tag_tree_version(previous: str, root: Path = ROOT) -> str | None:
    """The version literal in `host/src/index.ts` AS OF tag v{previous}. None if unreadable.

    🔴 READ FROM THE TAG'S OWN TREE, NOT FROM THE TAG NAME. The point is to catch a tag
    that does not sit on the cut it is named after, so believing the name would answer
    the question with the question.
    """
    r = subprocess.run(["git", "show", f"v{previous}:host/src/index.ts"],
                       cwd=str(root), capture_output=True, text=True)
    if r.returncode != 0:
        return None
    m = re.search(r'name:\s*"breakpoint-mcp",\s*version:\s*"([^"]+)"', r.stdout)
    return m.group(1) if m else None


def tag_release_commit(previous: str, root: Path = ROOT) -> str | None:
    """The release commit a tag DECLARES in its own message. None if it declares none.

    🔴 A LIGHTWEIGHT TAG HAS NO MESSAGE, AND THAT IS NOT AN ERROR. `git tag -l --format`
    returns an empty body for one, which is the honest "unanswerable" state and must not
    be confused with a tag that declares a commit this reader failed to parse.
    """
    r = subprocess.run(["git", "tag", "-l", f"v{previous}", "--format=%(contents)"],
                       cwd=str(root), capture_output=True, text=True)
    if r.returncode != 0:
        return None
    m = TAG_DECL_RE.search(r.stdout)
    return m.group(1) if m else None


def tag_shadow(previous: str, root: Path = ROOT) -> int | None:
    """Commits between the release commit a tag declares and the tag itself.

    0 — the tag is on its cut. >0 — that many commits shipped in v{previous} and are
    invisible to every window that starts here. None — the tag declares nothing, so the
    question cannot be answered and is reported rather than guessed.
    """
    sha = tag_release_commit(previous, root)
    if sha is None:
        return None
    r = subprocess.run(["git", "rev-list", "--count", f"{sha}..v{previous}"],
                       cwd=str(root), capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:
        return int(r.stdout.strip())
    except ValueError:
        return None


def addon_state(version: str, stamp: str | None,
                moved: list[str], commits: list[str]) -> tuple[str, str, dict]:
    """Check 4, as a PURE function of (version, stamp commit, what moved after it).

    The question is not "do the copies of the addon version agree" — `contract_check` has
    asked that since 2026-06 and it has been green throughout. It is "does the version
    still name the tree it was stamped on".
    """
    d = {"version": version, "stamp": stamp, "moved": sorted(moved), "commits": list(commits)}
    if stamp is None:
        return C4_ADDON_UNFINDABLE, (
            f"🔴 no commit in this history introduces `version=\"{version}\"` into "
            f"{ADDON_CFG}. Either the stamp is uncommitted, or it landed on a branch this "
            f"one cannot see. 🔴 THIS IS NOT A PASS: the question was not answered, and an "
            f"unanswered question and a clean answer look identical in a green run."), d
    if any(stamp.startswith(c) or c.startswith(stamp) for c in commits):
        return C4_WINDOW_INCLUDES_STAMP, (
            f"🔴 the window opened at {stamp[:12]} CONTAINS {stamp[:12]} — a boundary that "
            f"includes itself. Every fact below it is then one commit wide of the truth, "
            f"and the verdict can stay the same while the reason stops being right. This "
            f"refuses the reader rather than the tree."), d
    if not moved:
        return C4_OK, (
            f"the addon has not moved since `{version}` was stamped at {stamp[:12]}. The "
            f"version names exactly one tree, which is the only thing that makes it a "
            f"version rather than a label."), d
    return C4_ADDON_STALE, (
        f"🔴 the addon has moved in {len(commits)} commit(s) since `{version}` was stamped "
        f"at {stamp[:12]}, touching {moved}. 🔴 MORE THAN ONE TREE ANSWERS TO "
        f"`{version}` — the one it was stamped on, and this one. The Asset Library serves "
        f"whichever commit its submission named, so a third can exist without either being "
        f"wrong about itself. Re-stamp {ADDON_CFG} (and the copies `contract_check` "
        f"asserts against it) in this cut, or the release ships a name that has stopped "
        f"identifying anything."), d


def _oldest(shas: list[str]) -> str | None:
    """The introduction, out of `git log`'s newest-first list — PURE, so it can be pinned.

    🔴 SPLIT OUT BECAUSE THE MUTATION SWEEP COULD NOT SEE THIS CHOICE. Flipping `[-1]` to
    `[0]` changed nothing anywhere: every version the tree is currently asked about has
    exactly ONE `-S` match, so newest and oldest are the same commit and the mutant was
    equivalent on today's inputs. 🔴 IT IS NOT EQUIVALENT IN GENERAL. A SUPERSEDED version
    has TWO matches — the commit that introduced the literal and the commit that removed it
    — measured live: `version: "1.73.2"` matches both #269 and #265, and `version="1.9.7"`
    matches both #188 and #183. Taking the newest returns the REMOVAL, so the first replay
    of a past cut, or the first `--tag-cmd` for a version already superseded, gets a commit
    that is not the release. A defect with no current input that reaches it is still a
    defect; making the choice a pure function is what lets a table say so.
    """
    return shas[-1] if shas else None


def _first_commit_introducing(needle: str, path: str, root: Path = ROOT) -> str | None:
    """The OLDEST commit whose diff changes the number of occurrences of `needle` in `path`.

    🔴 ONE IDIOM, TWO CALLERS, AND THE SECOND ONE IS WHY IT IS A FUNCTION. `-S` matches the
    commit that introduces a literal AND the one that removes it, so the oldest match is the
    introduction — a subtlety worth getting right once rather than twice. `release_commit`
    asks it of the host version in `host/src/index.ts`; `addon_stamp_commit` asks it of the
    addon version in `plugin.cfg`. Two literals over one rule is one of them wrong (203 §2).
    """
    r = subprocess.run(["git", "log", "--format=%H", "-S", needle, "--", path],
                       cwd=str(root), capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return _oldest(r.stdout.split())


def addon_version(root: Path = ROOT) -> str | None:
    """The addon's own version, from the canonical `plugin.cfg`. None if unreadable."""
    try:
        m = re.search(r'^version="([^"]+)"', (root / ADDON_CFG).read_text(), re.M)
    except OSError:
        return None
    return m.group(1) if m else None


def addon_stamp_commit(version: str, root: Path = ROOT) -> str | None:
    """The commit that stamped this addon version onto `plugin.cfg`."""
    return _first_commit_introducing(f'version="{version}"', ADDON_CFG, root)


def addon_moved_since(stamp: str, head: str = "HEAD",
                      root: Path = ROOT) -> tuple[list[str], list[str]]:
    """(files, commits) under the addon that moved AFTER `stamp`.

    🔴 `stamp..head` EXCLUDES THE STAMP COMMIT'S OWN CHANGES, WHICH IS THE POINT. A cut that
    re-stamps the version and touches the addon in the same commit has, by construction,
    said what it shipped — the window opens after it.

    🔴 ONE RANGE, TWO READERS — AND THE MUTATION SWEEP IS WHY IT IS A VARIABLE. The first
    draft spelled `f"{stamp}..{head}"` twice, once for the file list and once for the commit
    list, so widening one left the other where it was: `moved` and `commits` would then be
    describing DIFFERENT WINDOWS while the verdict read as if they described one. That is
    217's rule about check 1 and check 2 sharing a single `git diff`, one file over — two
    readers agreeing about different windows is not agreement — and it was reintroduced here
    within an hour of being written down.
    """
    rng = f"{stamp}..{head}"
    files = subprocess.run(
        ["git", "diff", "--name-only", rng, "--", ADDON_DIR],
        cwd=str(root), capture_output=True, text=True)
    commits = subprocess.run(
        ["git", "log", "--format=%h", rng, "--", ADDON_DIR],
        cwd=str(root), capture_output=True, text=True)
    if files.returncode != 0 or commits.returncode != 0:
        return [], []
    return files.stdout.split(), commits.stdout.split()


def release_commit(version: str, root: Path = ROOT) -> str | None:
    """The commit at which the shipped tree BECAME `version`. None if there is none.

    🔴 THIS EXISTS BECAUSE `--tag-cmd` READ HEAD, AND HEAD IS NOT THE RELEASE COMMIT FOR
    LONG. 219 shipped the declaration mechanism and then tried to use it on its own cut:
    by then one more PR had merged, so `--tag-cmd 1.73.3` would have declared THAT commit,
    the tag would have been created there, and `tag_shadow()` would have read 0. 🔴 A TAG
    ONE COMMIT LATE, DECLARING ITSELF ON-CUT — the exact failure the declaration exists to
    catch, laundered by the writer that was supposed to prevent it. The tree guard cannot
    see it either: both commits ship the same version, which is the whole reason the late
    direction was invisible to `C2_TAG_MISPLACED` in the first place.

    🔴 AND IT IS STILL NOT A HEURISTIC OVER MESSAGES. The release commit is the one where
    the version LITERAL entered the shipped tree, which `git log -S` answers exactly —
    217 §5 refused to close this direction because naming the commit meant a `grep` over
    subjects; naming it from the tree does not. The `-S` subtlety lives in
    `_first_commit_introducing`, which check 4 asks the same question of one file over.
    """
    return _first_commit_introducing(f'version: "{version}"', "host/src/index.ts", root)


def tag_message(version: str, sha: str) -> str:
    """The BODY git will store on the tag — the thing `tag_release_commit` reads back.

    🔴 SPLIT OUT FROM THE SHELL COMMAND, AND THE ROUND-TRIP ASSERTION IS WHY. Written as
    one string, the declaration ends with the closing quote of `-m "…"` and `TAG_DECL_RE`
    could not parse its own writer's output — the shell's quoting is not part of what git
    stores, so a reader pointed at the command was reading a different string from the one
    it would meet on the tag. The self-test found that on its first run; nothing else
    would have, until a `C2_TAG_LATE` failed to fire two releases from now.
    """
    return f"release: {version}\n\nrelease-commit: {sha}\n"


def tag_command(version: str, sha: str | None, tree_version: str | None) -> tuple[str, str]:
    """The annotated tag that declares its own release commit — PURE.

    🔴 GUARDED ON THE TREE, NOT ON THE NAME, and for the same reason `tag_tree_version`
    is: tagging v1.73.3 at a commit whose `host/src/index.ts` ships 1.73.2 is exactly the
    misplacement `C2_TAG_MISPLACED` catches ONE CUT LATER, when the window it broke is
    already unreadable. Catching it at the moment of tagging costs one comparison.

    🔴 AND THE COMMAND NAMES THE COMMIT EXPLICITLY. `git tag -a v{version}` with no
    commit-ish tags HEAD, so the emitted command was correct only while nothing had merged
    since the cut — a window measured in minutes here. Naming `sha` makes the tag's
    placement a property of what this function computed rather than of when it was run.
    """
    if sha is None:
        return TAG_COMMIT_UNFINDABLE, (
            f"🔴 REFUSED — no commit in this history makes the shipped tree ship "
            f"{version!r}. Either the version write is still uncommitted, or the release "
            f"commit is on a branch this one cannot see. There is nothing to declare, and "
            f"declaring HEAD instead is how a late tag is made to look like an on-cut one.")
    if tree_version != version:
        return TAG_TREE_DISAGREES, (
            f"🔴 REFUSED — this tree ships {tree_version!r}, not {version!r}. A tag names "
            f"a cut; a cut is a tree. Tagging here would place v{version} on a commit "
            f"that never shipped it, and the next ritual would refuse the window with "
            f"C2_TAG_MISPLACED without being able to say which commit was meant.")
    return TAG_OK, (
        f"git tag -a v{version} {sha} -F - <<'MSG'\n{tag_message(version, sha)}MSG\n"
        f"git push origin v{version}")


def tarball_entries(host: Path | None = None) -> list[str]:
    """`npm pack --dry-run --json` -> the packed entry paths. Refuses loudly."""
    h = (ROOT / "host") if host is None else host
    r = subprocess.run(["npm", "pack", "--dry-run", "--json"], cwd=str(h),
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(
            f"🔴 RELEASE_NAMES REFUSED — `npm pack --dry-run` failed in {h}: "
            f"{r.stderr.strip()[:400]}")
    try:
        return [f["path"] for f in json.loads(r.stdout)[0]["files"]]
    except (ValueError, KeyError, IndexError) as e:
        raise SystemExit(
            f"🔴 RELEASE_NAMES REFUSED — could not read `npm pack --json` output "
            f"({e}). Refusing rather than answering over an empty entry list, which "
            f"would be clean by construction.")


# ── the refusal proof (204 §8.27 — a check that has never refused is unaudited) ──
#
# 🔴 EVERY ROW DRIVES THE PURE FUNCTION. No filesystem, no npm, no network.
#
# 🔴 THE FIRST TWO ROWS ARE THE REAL 1.73.2 INCIDENT, NOT A CONSTRUCTION. The block
# below is a verbatim-in-its-names excerpt of that release's CHANGELOG entry, and it
# is the block that aborted the ritual. Measured on the live tree at 216:
#   constants ['BYTES_CEILING'] -> 1, BELOW the floor of 5   (215 §3 defect 1)
#   api with the call-paren fix -> 5, admitting body_brace and concise_blind
#                                     which the old regex could not see (defect 2)
#   legible -> 6, at the floor.  leaked -> [].  reaching -> ['log_seq','start_failed']
#
# 🔴 THE MINOR ROWS CARRY A WINDOW, AND TWO OF THEM ARE THE 1.73.2 SHAPE. The
# `reaches shipped source but NOT the window` row is the defect promoting this check
# found: it is what 1.73.2's block does, and the old arm passed it.
#
# (name, released, shipped, bump, floor, window, want_code, want_constants, want_api)
_B1732 = """### Fixed — the floor that fit only one of seven
The `body_brace()` reader and `concise_blind()` now agree about what a block is.
`log_seq` is asserted at the seam, and the `start_failed` event grew the floor
`dap` already had. `editor_get_log` is unchanged. `BYTES_CEILING` is unmoved.
"""
# 🔴 A CORPUS THAT SPELLS THE SEPARATION. Two lower_snake names appear in it, no
# constant does — which is the live tree's shape at 1.73.2 and the shape the leak
# assertion must NOT read as a leak.
_SHIPPED = "export function emit(log_seq: number) { send('start_failed'); }"

_MINOR_BLOCK = "`engine_log`, `runtime_get_log`, `push_error`, `a_b`, `c_d`."

SELFTEST = [
    ("🔴 the 215 incident — 1.73.2's own block, and it PASSES now",
     _B1732, _SHIPPED, "PATCH", None, None, OK, 1, 5),
    ("🔴 the separation is load-bearing — lower_snake in shipped source is NOT a leak",
     "The `log_seq` field, `body_brace()`, `a_b`, `c_d`, `e_f`.",
     "log_seq", "PATCH", None, None, OK, 0, 5),
    ("🔴 the call-paren — a block naming only functions must still be legible",
     "`body_brace()`, `concise_blind()`, `scope_walk()`, `seal_order()`, `taut_scan()`.",
     "", "PATCH", None, None, OK, 0, 5),
    ("🔴 A CONSTANT REACHING SHIPPED SOURCE — THE LEAK REFUSAL",
     "`BYTES_CEILING` moved, plus `a_b`, `c_d`, `e_f`, `g_h`, `i_j`.",
     "const BYTES_CEILING = 4;", "PATCH", None, None, LEAK, 1, 5),
    # 🆕 220 — THE PATH-STEM PAIR. Both directions, because a lookahead that ate
    # too much would pass the first row and silently delete real constants in the second.
    ("🔴 A DOC FILENAME IS NOT A CONSTANT — `docs/USER_GUIDE.md` aborted 1.73.4",
     "The stamps in `README.md` and `docs/USER_GUIDE.md` moved, plus `a_b`, `c_d`, "
     "`e_f`, `g_h`, `i_j`.",
     "USER_GUIDE and TOOL_CATALOG appear in shipped source", "PATCH", None, None,
     OK, 0, 5),
    ("🔴 AND A CONSTANT ENDING A SENTENCE IS STILL ONE — the lookahead must not eat it",
     "`BYTES_CEILING` moved. So did BYTES_CEILING. Plus `a_b`, `c_d`, `e_f`, `g_h`, `i_j`.",
     "const BYTES_CEILING = 4;", "PATCH", None, None, LEAK, 1, 5),
    ("🔴 A BLOCK TOO THIN TO READ — THE FLOOR'S REFUSAL",
     "Nothing much changed. `a_b` and `c_d`.", "", "PATCH", None, None,
     POPULATION_COLLAPSED, 0, 2),
    # 🔴 THERE IS NO ROW HERE FOR "SCREAMING-ONLY WOULD ABORT", ON PURPOSE. One was
    # written and deleted: it drove the same fixture through the same arm as row 1
    # and agreed with it by construction — a row that restates its neighbour proves
    # nothing and reads as coverage. The counterfactual is asserted below instead,
    # where it can actually disagree with NAME_FLOOR.
    ("a healthy MINOR — a named identifier is IN the window (the 1.73.0 shape)",
     _MINOR_BLOCK, "engine_log push_error", "MINOR", None,
     "+ export const engine_log = ...", OK, 0, 5),
    ("🔴 REACHES SHIPPED SOURCE BUT NOT THE WINDOW — 1.73.2's SHAPE, AND THE OLD "
     "ARM PASSED IT",
     _MINOR_BLOCK, "engine_log push_error runtime_get_log", "MINOR", None,
     '+ "version": "1.73.2",', MINOR_UNSUPPORTED, 0, 5),
    ("🔴 A MINOR WITH NO WINDOW AT ALL — REFUSES TO CLAIM, DOES NOT PASS",
     _MINOR_BLOCK, "engine_log", "MINOR", None, None, MINOR_NO_WINDOW, 0, 5),
    ("🔴 A MINOR WHOSE NAMES SHIP NOTHING — the window is empty too",
     "`a_b`, `c_d`, `e_f`, `g_h`, `i_j`.", "nothing here", "MINOR", None, "",
     MINOR_UNSUPPORTED, 0, 5),
    ("🔴 A MINOR BLOCK TOO THIN — THE MINOR FLOOR'S REFUSAL",
     "`a_b`, `c_d`.", "a_b", "MINOR", None, "+ a_b", MINOR_POPULATION, 0, 2),
    ("🔴 A FOURTH BUMP WORD STILL HAS NO ARM — the refusal 210 §9 left, kept",
     _B1732, _SHIPPED, "REWRITE", None, None, NO_ARM, 1, 5),
    ("🔴 AN EMPTY BLOCK IS A REFUSAL, NOT A PASS",
     "   \n  ", "", "PATCH", None, None, NO_BLOCK, 0, 0),
]

# 🆕 227 — THE MAJOR ARM'S TABLE. Same nine columns plus the two evidence sources, kept
# separate from SELFTEST because every row here needs them and threading two more
# `None`s through fourteen rows above would be noise pretending to be structure.
#
# 🔴 ROW 2 IS THE ONE THIS ARM EXISTS FOR AND IT IS THE ONE A FIRST DRAFT GETS WRONG:
# `engines` narrows, no schema moves, the wire says PATCH, and it is a REAL MAJOR. An
# arm keyed on the classifier alone refuses the SDK-v2 migration — the exact release
# 226 item 5 named as the reason to write this arm at all.
#
# 🔴 AND ROW 4 IS ITS NEGATIVE. Notes describing real work, both evidence sources
# silent: a MINOR that felt large. If this row ever passes, the arm has stopped asking.
_MAJOR_BLOCK = "`engine_log`, `runtime_get_log`, `push_error`, `a_b`, `c_d`."
_E18 = {"node": ">=18"}
_E20 = {"node": ">=20"}

MAJOR_SELFTEST = [
    ("a MAJOR the WIRE evidences — 1.74.0's shape, cut as what it was",
     _MAJOR_BLOCK, "+ export const engine_log = ...", "MAJOR", (_E18, _E18), OK),
    ("🔴 a MAJOR NO CLASSIFIER CAN SEE — engines >=18 -> >=20, and the wire says PATCH",
     _MAJOR_BLOCK, "+ export const engine_log = ...", "PATCH", (_E18, _E20), OK),
    ("both at once — the SDK-v2 shape, wire and install contract together",
     _MAJOR_BLOCK, "+ export const engine_log = ...", "MAJOR", (_E18, _E20), OK),
    ("🔴 REAL WORK, NOTHING BROKEN — a MINOR that felt large",
     _MAJOR_BLOCK, "+ export const engine_log = ...", "MINOR", (_E18, _E18),
     MAJOR_NOT_BREAKING),
    ("🔴 A MAJOR WITH NO WINDOW — refuses to claim, does not pass",
     _MAJOR_BLOCK, None, "MAJOR", (_E18, _E18), MAJOR_NO_WINDOW),
    ("🔴 A MAJOR WHOSE NAMES SHIP NOTHING — the window is empty",
     _MAJOR_BLOCK, "", "MAJOR", (_E18, _E20), MAJOR_UNSUPPORTED),
    # 🔴 BOTH EVIDENCE SOURCES LOUD AND THE ARM STILL REFUSES. Evidence answers "is
    # this breaking"; it cannot answer "did anybody describe it". A second row differing
    # only in its evidence was written here and deleted — it restated this one, and a
    # row that agrees with its neighbour by construction reads as coverage.
    ("🔴 EVIDENCE CANNOT SUBSTITUTE FOR SUBSTANCE — wire MAJOR, engines moved, "
     "notes too thin to read",
     "`a_b`, `c_d`.", "+ a_b", "MAJOR", (_E18, _E20), MAJOR_POPULATION),
]

# 🆕 227 — CHECK 8's TABLE. The floor is asymmetric on purpose and rows 3 and 4 are the
# pair that proves it: BENEATH refuses, ABOVE passes and says so.
#
# 🔴 THE LAST TWO ROWS ARE THE ONES THAT MATTER MOST. `None` is every way the classifier
# can fail to answer — a baseline that will not build, no current build, a timeout, node
# missing — and a reader that treated any of them as PATCH would be exactly the state
# this check was written to end: a green line answering a smaller question.
C8_SELFTEST = [
    ("PATCH claimed, wire held still — the ordinary green", "PATCH", "PATCH", C8_OK),
    ("MINOR claimed, wire added surface", "MINOR", "MINOR", C8_OK),
    ("🔴 1.74.0 — MINOR CLAIMED, WIRE SAID MAJOR. THE CUT THIS CHECK EXISTS FOR",
     "MAJOR", "MINOR", C8_BENEATH),
    ("🔴 PATCH claimed, wire added surface — a MINOR under a PATCH name",
     "MINOR", "PATCH", C8_BENEATH),
    ("ABOVE the wire is LEGAL — a MINOR whose schemas did not move",
     "PATCH", "MINOR", C8_OK),
    ("ABOVE by two — a MAJOR the classifier cannot see (engines)", "PATCH", "MAJOR", C8_OK),
    ("🔴 UNREACHABLE IS RED, NOT A SKIP", None, "PATCH", C8_UNREACHABLE),
    ("🔴 AN UNPARSEABLE ANSWER IS NOT A PASSING ONE", "PROBABLY", "PATCH",
     C8_NOT_A_VERDICT),
]


# ── check 2's table — 🆕 217 ───────────────────────────────────────────────────
#
# 🔴 THE FIRST TWO ROWS ARE BOTH REAL AND THEY ARE DIFFERENT WINDOWS OF THE SAME CUT.
# `_D_NOTHING` is what the ritual saw at 1.73.2: v1.73.1..HEAD before the write, and it
# is EMPTY — which is what 216 §3 said was impossible. `_D_BUMP_ONLY` is the same cut's
# window read AFTER the release merged, which is what 216 actually measured. Both are
# verbatim; the disagreement between them IS the finding.

_D_NOTHING = ""

_D_BUMP_ONLY = """diff --git a/host/package.json b/host/package.json
index 5b0a2b2..346d6c2 100644
--- a/host/package.json
+++ b/host/package.json
@@ -3 +3 @@
-  "version": "1.73.1",
+  "version": "1.73.2",
diff --git a/host/src/index.ts b/host/src/index.ts
index 6c8cdaf..3bfd417 100644
--- a/host/src/index.ts
+++ b/host/src/index.ts
@@ -88 +88 @@ async function main(): Promise<void> {
-    { name: "breakpoint-mcp", version: "1.73.1" },
+    { name: "breakpoint-mcp", version: "1.73.2" },
"""

_D_SUBSTANCE = _D_BUMP_ONLY + """diff --git a/host/src/schemas.ts b/host/src/schemas.ts
index 1111111..2222222 100644
--- a/host/src/schemas.ts
+++ b/host/src/schemas.ts
@@ -12,0 +13 @@ export const shapes = {
+export const engine_log = z.object({ seq: z.number() });
"""

# 🔴 THE VERSION MOVED **AND SO DID SOMETHING ELSE, ON THE SAME LINE**. A regex over
# `version: "..."` passes this and loses the `title` field forever. Substitution does not.
_D_BUMP_PLUS = """diff --git a/host/src/index.ts b/host/src/index.ts
index 6c8cdaf..3bfd417 100644
--- a/host/src/index.ts
+++ b/host/src/index.ts
@@ -88 +88 @@
-    { name: "breakpoint-mcp", version: "1.73.1" },
+    { name: "breakpoint-mcp", version: "1.73.2", title: "Breakpoint" },
"""

# 🔴 A HEADER WITH NO `@@` AT ALL. `all()` over an empty hunk list is True, so a
# classifier that forgets this calls a rename "the ritual wrote it".
_D_RENAME = """diff --git a/host/src/old_name.ts b/host/src/new_name.ts
similarity index 100%
rename from host/src/old_name.ts
rename to host/src/new_name.ts
"""

# (name, diff, old, new, bump, tag_version, want_code, want_ritual, want_substantive)
C2_SELFTEST = [
    ("🔴 1.73.2's REAL ritual window — EMPTY, which 216 §3 said was impossible",
     _D_NOTHING, "1.73.1", "1.73.2", "PATCH", None, C2_SILENT, 0, 0),
    ("the same cut read AFTER the merge — version writes only, still no substance",
     _D_BUMP_ONLY, "1.73.1", "1.73.2", "PATCH", None, C2_SILENT, 2, 0),
    ("🔴 A MINOR THAT SHIPS NOTHING — THE REFUSAL NOBODY HAS EVER MADE",
     _D_BUMP_ONLY, "1.73.1", "1.73.2", "MINOR", None, C2_MINOR_NO_SUBSTANCE, 2, 0),
    ("🔴 A MINOR WHOSE WINDOW IS EMPTY OUTRIGHT",
     _D_NOTHING, "1.73.1", "1.73.2", "MINOR", None, C2_MINOR_NO_SUBSTANCE, 0, 0),
    ("a healthy MINOR — a producer moved (the 1.73.0 shape)",
     _D_SUBSTANCE, "1.73.1", "1.73.2", "MINOR", None, C2_OK, 2, 1),
    ("🔴 THE VERSION LINE THAT CHANGED SOMETHING ELSE TOO — substitution, not a regex",
     _D_BUMP_PLUS, "1.73.1", "1.73.2", "PATCH", None, C2_OK, 0, 1),
    ("🔴 A RENAME HAS NO HUNKS — and `all()` over nothing is True",
     _D_RENAME, "1.73.1", "1.73.2", "PATCH", None, C2_OK, 0, 1),
    ("🔴 A TAG THAT IS NOT ON THE CUT IT NAMES — the window is unanswerable",
     _D_NOTHING, "1.73.1", "1.73.2", "PATCH", "1.73.0", C2_TAG_MISPLACED, 0, 0),
    ("a tag that IS on its cut passes the guard",
     _D_NOTHING, "1.73.1", "1.73.2", "PATCH", "1.73.1", C2_SILENT, 0, 0),
]


# ── `--assert-map`'s table — 🆕 217 ────────────────────────────────────────────

def _pack(*, extra=(), drop=(), n=70) -> list[str]:
    """A synthetic packed-entry list. `n` sizes the `dist` root so the floor is drivable."""
    out = []
    if "dist" not in drop:
        out += [f"dist/m{i}.js" for i in range(n)]
    if "addon" not in drop:
        out += ["addon/breakpoint_mcp/plugin.cfg", "addon/breakpoint_mcp/x.gd"]
    for f in ("README.md", "LICENSE", "package.json"):
        if f not in drop:
            out.append(f)
    return out + list(extra)


_ALL_THERE = lambda rel: True  # noqa: E731

# (name, tarball, exists, want_code)
MAP_SELFTEST = [
    ("the healthy shape — five roots, and BOTH directions clean",
     _pack(), _ALL_THERE, MAP_OK),
    ("🔴 AN UNDECLARED ROOT — npm ships something the map has never heard of",
     _pack(extra=("bin/cli.js",)), _ALL_THERE, MAP_UNMAPPED),
    ("🔴 A STALE MAP ENTRY — `addon` is absent (a pack with no stage-addon)",
     _pack(drop=("addon",)), _ALL_THERE, MAP_STALE),
    ("🔴 A DECLARED SOURCE THAT IS NOT ON DISK",
     _pack(), lambda rel: rel != "host/LICENSE", MAP_MISSING_SOURCE),
    ("🔴 AN EMPTY TARBALL ANSWERS BOTH DIRECTIONS CLEANLY — and that is not an answer",
     [], _ALL_THERE, MAP_TARBALL_THIN),
    # 🔴 THESE TWO RUN UNDER THE LIVE `ENTRY_FLOOR`, which is what makes moving it
    # redden anything at all — registry_bytes.py's own split, one file over. At the
    # floor it passes; one entry below it refuses.
    ("a tarball exactly AT the imported ENTRY_FLOOR still answers",
     _pack(n=ENTRY_FLOOR - 5), _ALL_THERE, MAP_OK),
    ("🔴 ONE ENTRY BELOW THE FLOOR AND IT REFUSES",
     _pack(n=ENTRY_FLOOR - 6), _ALL_THERE, MAP_TARBALL_THIN),
]


# ── 🆕 219 — the LATE-tag direction: the shadow arm, and the tag that declares it ──
# 🔴 THE SHADOW ROWS AND THE COMMAND ROWS ARE ONE TABLE ON PURPOSE. They are the two
# halves of a single fact — what the tagger knew and what the next cut reads — and the
# round trip below is what proves they are the same fact and not two literals that happen
# to agree today.
# (name, kind, arg, want_code)
TAG_SELFTEST = [
    ("a tag that DECLARES its release commit and sits exactly on it", "shadow", 0, C2_SILENT),
    ("🔴 ONE COMMIT PAST ITS OWN DECLARED RELEASE COMMIT — 217 §5's open direction, closed",
     "shadow", 1, C2_TAG_LATE),
    ("🔴 AND THREE PAST — the count is READ into the reason, not tested for truthiness",
     "shadow", 3, C2_TAG_LATE),
    ("🔴 A TAG THAT DECLARES NOTHING IS UNANSWERABLE — and must not refuse on that account",
     "shadow", None, C2_SILENT),
    ("the annotated tag command, when the tree ships the version being tagged",
     "cmd", "1.73.3", TAG_OK),
    ("🔴 TAGGING A VERSION THIS TREE DOES NOT SHIP — caught at the tag, not one cut later",
     "cmd", "1.74.0", TAG_TREE_DISAGREES),
    # 🆕 219 §2 — THE ROW FOR THE DEFECT THIS BRANCH FIXES. `--tag-cmd` declared HEAD, and
    # by the time the mechanism was used on its own release HEAD was one commit past the
    # cut — so the tag would have been placed late AND declared itself on-cut, which is
    # `C2_TAG_LATE` laundered by the writer built to prevent it. `release_commit()` reads
    # the commit where the tree BECAME the version; when there is none, there is nothing
    # to declare and saying so is the only honest answer.
    ("🔴 NO COMMIT MAKES THE TREE SHIP THIS VERSION — and HEAD is not a substitute for one",
     "cmd-nosha", "1.99.0", TAG_COMMIT_UNFINDABLE),
]


# ── 🆕 219 — check 4's table: does the addon version still name the addon's tree? ──
# 🔴 THE PASSING ROW IS NOT THE INTERESTING ONE AND IS HERE ANYWAY. A gate that only ever
# refuses constrains nothing either: the row below proves that re-stamping in the same cut
# that moved the addon is READ AS CLEAN, which is the behaviour the fix asks for.
# (name, stamp, moved, commits, want_code)
ADDON_SELFTEST = [
    ("the addon has not moved since its version was stamped — one name, one tree",
     "aaaaaaaaaaaa", [], [], C4_OK),
    ("🔴 ONE FILE MOVED AFTER THE STAMP — the live shape, and it has shipped",
     "aaaaaaaaaaaa", [f"{ADDON_DIR}/runtime_bridge.gd"], ["c5afeb5"], C4_ADDON_STALE),
    ("🔴 TWO FILES OVER TWO COMMITS — the count is read into the reason, not tested for truth",
     "aaaaaaaaaaaa", [f"{ADDON_DIR}/operations.gd", f"{ADDON_DIR}/runtime_bridge.gd"],
     ["c5afeb5", "782157c"], C4_ADDON_STALE),
    ("🔴 NO COMMIT STAMPS THIS VERSION — unanswered, and an unanswered question is not a pass",
     None, [], [], C4_ADDON_UNFINDABLE),
    ("🔴 THE WINDOW CONTAINS ITS OWN BOUNDARY — a refusal about the READER, not the tree",
     "aaaaaaaaaaaa", [f"{ADDON_DIR}/x.gd"], ["aaaaaaa", "c5afeb5"], C4_WINDOW_INCLUDES_STAMP),
]

# 🆕 219 §2 — the oldest-match choice, as a table, because a mutant flipping it was
# EQUIVALENT on every input the live tree can currently produce. See `_oldest`.
# (name, input, want)
OLDEST_SELFTEST = [
    ("no match at all is None, not a commit-shaped guess", [], None),
    ("one match is that match — the shape every CURRENT version has", ["intro"], "intro"),
    ("🔴 TWO MATCHES: git lists NEWEST first, so the introduction is the LAST",
     ["removal", "intro"], "intro"),
    ("🔴 AND THREE — a literal reintroduced after a revert still resolves to the first",
     ["removal", "reintro", "intro"], "intro"),
]


def selftest() -> int:
    bad = 0
    for name, rel, ship, bump, floor, win, want_code, want_c, want_a in SELFTEST:
        code, why, d = verdict(rel, ship, bump, floor=floor, changed_text=win)
        agree = (code == want_code
                 and len(d["constants"]) == want_c
                 and len(d["api"]) == want_a)
        mark = "🟢" if agree else "🔴"
        print(f"  {mark} {code:<18} const={len(d['constants'])}/{want_c} "
              f"api={len(d['api'])}/{want_a}  {name}")
        if not agree:
            bad += 1
            print(f"        want {want_code} · got {code} — {why}")

    # 🔴 THE ROW ABOVE NAMED `SCREAMING-ONLY WOULD STILL ABORT` IS NOT SELF-PROVING,
    # BECAUSE THE READER IT DESCRIBES NO LONGER EXISTS. So the counterfactual is
    # asserted HERE, against the same fixture and the LIVE floor. This is the whole
    # of 215 §3's first defect, stated so it can fail: if anyone narrows the floor
    # back to the constants, or lowers NAME_FLOOR to make an abort go away, one of
    # these two goes red.
    c, a = read_names(_B1732)
    legible = sorted(set(c) | set(a))
    counterfactual_ok = len(c) < NAME_FLOOR <= len(legible)
    print(f"\n  {'🟢' if counterfactual_ok else '🔴'} the counterfactual: the 1.73.2 "
          f"block reads {len(c)} constant(s) {c} — BELOW the floor of {NAME_FLOOR} — "
          f"and {len(legible)} name(s) across both cases, at or above it. "
          f"A SCREAMING-only floor aborts this release; a two-case floor does not.")
    if not counterfactual_ok:
        bad += 1

    print("\n  CHECK 1's MAJOR ARM — 210 §9's third arm, and it needed check 8 (🆕 227)")
    for name, rel, win, wire, eng, want_code in MAJOR_SELFTEST:
        code, why, d = verdict(rel, "", "MAJOR", changed_text=win, wire=wire, engines=eng)
        agree = code == want_code
        print(f"  {'🟢' if agree else '🔴'} {code:<22} wire={str(wire):<6} "
              f"breaking={len(d.get('breaking') or [])}  {name}")
        if not agree:
            bad += 1
            print(f"        want {want_code} · got {code} — {why}")

    # 🔴 THE ARM'S COUNTERFACTUAL, AND IT IS THE ONE A SIMPLIFIER WILL REACH FOR.
    # `major_evidence` looks like it wants to be `wire == "MAJOR"`. Written that way it
    # refuses the SDK-v2 migration — a real major that moves no schema — which is the
    # release 226 item 5 named as the reason to write this arm. Asserted here so the
    # simplification reddens rather than merely being wrong on a release nobody has cut.
    engines_only = major_evidence("PATCH", (_E18, _E20))
    wire_only = major_evidence("MAJOR", (_E18, _E18))
    both_silent = major_evidence("MINOR", (_E18, _E18))
    two_sources_ok = bool(engines_only) and bool(wire_only) and not both_silent
    print(f"\n  {'🟢' if two_sources_ok else '🔴'} the two sources are INDEPENDENT: a "
          f"narrowed `engines` alone evidences a MAJOR ({engines_only}), a MAJOR wire "
          f"alone evidences one ({wire_only}), and neither firing is not a MAJOR. "
          f"Collapse this to `wire == \"MAJOR\"` and the SDK-v2 bump becomes uncuttable.")
    if not two_sources_ok:
        bad += 1

    print("\n  CHECK 8 — the wire, and the bump it is a statement ABOUT (🆕 227)")
    for name, wire, bump, want_code in C8_SELFTEST:
        code, why, d = wire_floor(wire, bump)
        agree = code == want_code
        print(f"  {'🟢' if agree else '🔴'} {code:<22} wire={str(wire):<9} "
              f"bump={bump:<6} {name}")
        if not agree:
            bad += 1
            print(f"        want {want_code} · got {code} — {why}")

    # 🔴 THE CROSS-LANGUAGE ROUND TRIP, AND IT IS `TAG_DECL_RE`'s ARGUMENT ONE FILE OVER.
    # `wire_diff.mjs` PRINTS a line and this file PARSES one; two literals that merely
    # agree today are two literals, and this pair cannot even be checked by a type. The
    # classifier's own emitting line is read out of its source and driven through the
    # pattern that has to match it — so renaming the output on either side reddens here
    # rather than at a cut, six weeks later, as a silent C8_NOT_A_VERDICT.
    wd = (ROOT / "host" / WIRE_DIFF_REL)
    emitter_ok = False
    if wd.exists():
        m = re.search(r'console\.log\(`(WIRE_VERDICT [^`]+)`\)', wd.read_text())
        if m:
            sample = m.group(1).replace("${worst}", "MAJOR")
            hit = WIRE_VERDICT_RE.search(sample)
            emitter_ok = hit is not None and hit.group(1) == "MAJOR"
    print(f"\n  {'🟢' if emitter_ok else '🔴'} the round trip: the line "
          f"`{WIRE_DIFF_REL}` actually PRINTS is the line `WIRE_VERDICT_RE` reads back. "
          f"A classifier whose output format moves must redden HERE, not at a cut.")
    if not emitter_ok:
        bad += 1

    print("\n  CHECK 2 — the producer window, which reads no notes at all (🆕 217)")
    for name, diff, old, new, bump, tagv, want_code, want_r, want_s in C2_SELFTEST:
        code, why, d = population(diff, old, new, bump, tag_tree_version=tagv)
        agree = (code == want_code
                 and len(d["ritual_only"]) == want_r
                 and len(d["substantive"]) == want_s)
        print(f"  {'🟢' if agree else '🔴'} {code:<22} ritual={len(d['ritual_only'])}/{want_r} "
              f"subst={len(d['substantive'])}/{want_s}  {name}")
        if not agree:
            bad += 1
            print(f"        want {want_code} · got {code} — {why}")

    print("\n  --assert-map — check 3's BOTH-WAYS assertion, promoted (🆕 217)")
    for name, tar, exists, want_code in MAP_SELFTEST:
        code, why, d = assert_map(tar, exists=exists)
        agree = code == want_code
        print(f"  {'🟢' if agree else '🔴'} {code:<22} entries={d['entries']:<4} "
              f"roots={len(d['roots'])}  {name}")
        if not agree:
            bad += 1
            print(f"        want {want_code} · got {code} — {why}")

    print("\n  the LATE-tag direction — the shadow the tag declares about itself (🆕 219)")
    _SHA = "0123456789abcdef0123456789abcdef01234567"
    for name, kind, arg, want_code in TAG_SELFTEST:
        if kind == "shadow":
            code, why, d = population(_D_NOTHING, "1.73.2", "1.73.3", "PATCH",
                                      tag_tree_version="1.73.2", shadow=arg)
            detail = f"shadow={arg!r:<5}"
        else:
            code, why = tag_command(arg, None if kind == "cmd-nosha" else _SHA, "1.73.3")
            detail = f"tag v{arg:<8}"
        agree = code == want_code
        print(f"  {'🟢' if agree else '🔴'} {code:<22} {detail}  {name}")
        if not agree:
            bad += 1
            print(f"        want {want_code} · got {code} — {why}")

    # 🔴 THE ROUND TRIP, AND IT IS THE POINT OF THE WHOLE MECHANISM. The writer emits a
    # line and the reader parses one; asserting each against a literal would leave two
    # spellings free to drift apart while both tables stayed green. This asserts that what
    # `tag_command` WRITES is what `TAG_DECL_RE` READS, which is the only claim that makes
    # the next cut's `C2_TAG_LATE` mean anything.
    parsed = TAG_DECL_RE.search(tag_message("1.73.3", _SHA))
    _, emitted = tag_command("1.73.3", _SHA, "1.73.3")
    # 🆕 219 §2 — AND THE COMMAND MUST NAME THAT COMMIT AS THE TAG'S TARGET, not only in
    # the message. `git tag -a v1.73.3` with no commit-ish tags HEAD, so a command whose
    # message declares one commit while the tag lands on another is exactly the laundered
    # late tag this whole mechanism exists to make impossible.
    round_trip = (parsed is not None and parsed.group(1) == _SHA
                  and tag_message("1.73.3", _SHA) in emitted
                  and f"git tag -a v1.73.3 {_SHA} " in emitted)
    print(f"\n  {'🟢' if round_trip else '🔴'} the round trip: the SHA `tag_command` writes "
          f"into the tag message is the SHA `tag_release_commit`'s pattern reads back "
          f"({parsed.group(1)[:12] + '…' if parsed else 'NOT PARSEABLE'}), and the body "
          f"the command ships is that same message VERBATIM. Two literals that merely "
          f"agree today are two literals.")
    if not round_trip:
        bad += 1

    print("\n  check 4 — does the addon version still name the addon's tree? (🆕 219)")
    for name, stamp, moved, commits, want_code in ADDON_SELFTEST:
        code, why, d = addon_state("1.9.8", stamp, moved, commits)
        agree = code == want_code
        print(f"  {'🟢' if agree else '🔴'} {code:<22} moved={len(d['moved'])} "
              f"commits={len(d['commits'])}  {name}")
        if not agree:
            bad += 1
            print(f"        want {want_code} · got {code} — {why}")

    for name, shas, want in OLDEST_SELFTEST:
        got = _oldest(shas)
        agree = got == want
        print(f"  {'🟢' if agree else '🔴'} {'_oldest':<22} {len(shas)} match(es) -> "
              f"{got!r:<10} {name}")
        if not agree:
            bad += 1

    rows = (len(SELFTEST) + len(C2_SELFTEST) + len(MAP_SELFTEST) + len(TAG_SELFTEST)
            + len(ADDON_SELFTEST) + len(OLDEST_SELFTEST) + len(MAJOR_SELFTEST)
            + len(C8_SELFTEST))
    passing = {OK, C2_OK, C2_SILENT, MAP_OK, TAG_OK, C4_OK, C8_OK}
    seen = ({r[6] for r in SELFTEST} | {r[6] for r in C2_SELFTEST}
            | {r[3] for r in MAP_SELFTEST} | {r[3] for r in TAG_SELFTEST}
            | {r[4] for r in ADDON_SELFTEST} | {r[5] for r in MAJOR_SELFTEST}
            | {r[3] for r in C8_SELFTEST})
    refusals = (sum(1 for r in SELFTEST if r[6] not in passing)
                + sum(1 for r in C2_SELFTEST if r[6] not in passing)
                + sum(1 for r in MAP_SELFTEST if r[3] not in passing)
                + sum(1 for r in TAG_SELFTEST if r[3] not in passing)
                + sum(1 for r in ADDON_SELFTEST if r[4] not in passing)
                + sum(1 for r in MAJOR_SELFTEST if r[5] not in passing)
                + sum(1 for r in C8_SELFTEST if r[3] not in passing))
    print(f"\n  {rows} rows · {refusals} REFUSE · {len(seen)} distinct code(s) · "
          f"{'🟢 all agree' if not bad else f'🔴 {bad} DISAGREE'}")
    # 🔴 EVERY REFUSAL CODE MUST HAVE A ROW. A code with no row is a branch nobody
    # has watched fire, which is the state this whole file exists to leave. 🆕 217 —
    # THE SET IS DERIVED, NOT RETYPED: every module-level name ending in a refusal is
    # collected below, so ADDING a code with no row reddens this without anyone
    # remembering to extend a literal list. A hand-maintained set is a second list
    # (203 §2) and the drift it permits is silence about a new branch.
    declared = {v for k, v in sorted(globals().items())
                if isinstance(v, str) and k == v and v not in passing}
    missing = declared - seen
    if missing:
        print(f"  🔴 refusal code(s) with NO ROW: {sorted(missing)} — a branch with "
              f"no row is a branch nobody has seen fire")
        return 1
    if refusals < 12:
        print(f"  🔴 the table has stopped proving what it exists to prove "
              f"({refusals} refusing rows)")
        return 1
    return 1 if bad else 0


def _addon_live(head: str = "HEAD") -> tuple[str, str, dict]:
    """Check 4 against the working tree and its history. One reader, two callers.

    🔴 `--assert-addon` AND THE RITUAL CALL THE SAME FUNCTION, and that is deliberate: a
    standalone mode that answered a slightly different question from the one the cut asks
    is the second-list shape (203 §2) wearing a CLI flag.
    """
    v = addon_version()
    if v is None:
        return C4_ADDON_UNFINDABLE, (
            f"🔴 {ADDON_CFG} has no readable `version=` line at all."), \
            {"version": None, "stamp": None, "moved": [], "commits": []}
    stamp = addon_stamp_commit(v)
    moved, commits = addon_moved_since(stamp, head) if stamp else ([], [])
    return addon_state(v, stamp, moved, commits)


def main() -> int:
    ap = argparse.ArgumentParser(description="check 1 — the released block's names "
                                             "against the shipped corpus")
    ap.add_argument("--selftest", action="store_true",
                    help="drive the pure readers over their tables; no fs, no network")
    # 🔴 THE ONE MODE THAT DOES NOT NEED A RELEASE. Checks 1 and 2 both read a window
    # that only exists at a cut; the map assertion reads the TARBALL, which any build
    # can produce — so this runs in CI's `build` job, beside the `npm pack --dry-run`
    # that job already does, on every push rather than once a release.
    ap.add_argument("--assert-map", action="store_true",
                    help="check 3's tarball-roots-BOTH-WAYS assertion over "
                         "SHIPPED_SOURCE; needs `npm pack --dry-run`, no network")
    # 🆕 219 — CHECK 4, RUNNABLE ON ITS OWN because the moment it matters most is the Asset
    # Library submission, which is not a cut and has no ritual of its own. The ritual runs
    # it too; this is the same reader from the other door.
    ap.add_argument("--assert-addon", action="store_true",
                    help="check 4 — has the addon moved since its own version was "
                         "stamped? reads git, no network")
    # 🆕 219 — THE WRITER HALF OF THE LATE-TAG FIX, AND IT RUNS AFTER THE RELEASE COMMIT
    # RATHER THAN AT THE CUT. At ritual time the commit being tagged does not exist yet,
    # so the declaration cannot be made then; this is run once the release commit is on
    # `main`, and it reads HEAD rather than being told what HEAD is.
    ap.add_argument("--tag-cmd", metavar="VERSION",
                    help="print the ANNOTATED `git tag` that declares this cut's release "
                         "commit, so the NEXT cut reads the tag shadow instead of "
                         "inferring it from commit messages")
    ap.add_argument("--version", help="the version being cut, e.g. 1.73.2")
    ap.add_argument("--previous", help="the previous released version")
    ap.add_argument("--date", help="the released block's date, e.g. 2026-08-06")
    ap.add_argument("--bump", choices=["PATCH", "MINOR", "MAJOR"],
                    help="the bump this cut claims")
    # 🔴 AUDIT ONLY, AND THE RITUAL NEVER PASSES IT. At a cut the window ends at
    # HEAD by definition. This exists so a PAST cut can be replayed — which is how
    # 216 validated the MINOR arm against v1.72.7..v1.73.0, the one real MINOR this
    # arm has ever had to answer. 🔴 IT MOVES THE WINDOW ONLY: the corpus is still
    # read from the WORKING TREE, so `reaching` and the PATCH arm's leak assertion
    # are answered against today's source, not the historical one. For a MINOR audit
    # that is sound (the evidence is `in_window`); for a PATCH audit it is not.
    ap.add_argument("--head-ref", default="HEAD",
                    help="AUDIT ONLY — end the diff window at this ref instead of "
                         "HEAD, to replay a historical cut (see the code comment)")
    a = ap.parse_args()

    if a.selftest:
        print("RELEASE_NAMES selftest — the refusals of checks 1, 2 and the map, "
              "proved with no tree")
        return selftest()

    if a.assert_map:
        tarball = tarball_entries()
        code, why, d = assert_map(tarball,
                                  exists=lambda rel: (ROOT / rel).exists())
        print(f"RELEASE_NAMES --assert-map  ·  {d['entries']} packed entr(y/ies) · "
              f"roots {d['roots']} · floor {d['floor']} (imported from registry_bytes)")
        if code != MAP_OK:
            print(f"\n🔴 RELEASE_NAMES REFUSED [{code}]: {why}", file=sys.stderr)
            return 1
        print(f"               🟢 {why}")
        return 0

    if a.assert_addon:
        code, why, d = _addon_live()
        print(f"RELEASE_NAMES --assert-addon  ·  addon {d['version']} · stamped "
              f"{(d['stamp'] or '?')[:12]} · {len(d['moved'])} file(s) moved since over "
              f"{len(d['commits'])} commit(s)")
        if code != C4_OK:
            print(f"\n🔴 RELEASE_NAMES REFUSED [{code}]: {why}", file=sys.stderr)
            return 1
        print(f"               🟢 [{code}] {why}")
        return 0

    if a.tag_cmd:
        # 🔴 THE RELEASE COMMIT, NOT HEAD. Read the docstring on `release_commit()` — the
        # first draft of this branch took HEAD and would have declared a commit one past
        # the cut as being the cut, on this very release.
        sha = release_commit(a.tag_cmd)
        # And the tree guard reads the tree AT that commit, because that is the tree the
        # tag will name. The working tree is a different question and can differ from it.
        tree = None
        if sha is not None:
            r = subprocess.run(["git", "show", f"{sha}:host/src/index.ts"],
                               cwd=str(ROOT), capture_output=True, text=True)
            m = re.search(r'name:\s*"breakpoint-mcp",\s*version:\s*"([^"]+)"', r.stdout) \
                if r.returncode == 0 else None
            tree = m.group(1) if m else None
        code, text = tag_command(a.tag_cmd, sha, tree)
        if code != TAG_OK:
            print(f"\n🔴 RELEASE_NAMES REFUSED [{code}]: {text}", file=sys.stderr)
            return 1
        behind = subprocess.run(["git", "rev-list", "--count", f"{sha}..HEAD"],
                                cwd=str(ROOT), capture_output=True, text=True)
        n = behind.stdout.strip() if behind.returncode == 0 else "?"
        print(f"RELEASE_NAMES --tag-cmd  ·  v{a.tag_cmd} at {sha[:12]} — the commit where "
              f"the shipped tree BECAME {a.tag_cmd}, {n} commit(s) back from HEAD")
        print(f"               🟢 [{code}] the tag names that commit explicitly and "
              f"declares it in its own message, so the next cut reads the shadow")
        print(f"\n{text}")
        return 0

    if not all([a.version, a.previous, a.date, a.bump]):
        print("🔴 RELEASE_NAMES REFUSED — the live half needs --version, --previous, "
              "--date and --bump. It reads a RELEASED block, so it is a release-time "
              "reader; between cuts there is nothing for it to read.", file=sys.stderr)
        return 2

    changelog = (ROOT / "CHANGELOG.md").read_text()
    released = released_block(changelog, a.version, a.date, a.previous)
    if released is None:
        print(f"🔴 RELEASE_NAMES REFUSED — no `## [{a.version}] — {a.date}` header in "
              f"CHANGELOG.md. The version write has not landed, or the date is wrong.",
              file=sys.stderr)
        return 1

    corpus = shipped_corpus()
    # 🔴 ONE `git diff`, TWO READERS. Check 1's MINOR arm reads the ADDED LINES; check 2
    # reads the FILE and HUNK structure of the same bytes. Two diffs would be two
    # windows, and two checks agreeing about different windows is not agreement.
    raw = raw_window(a.previous, head=a.head_ref)
    window = "\n".join(l[1:] for l in raw.splitlines()
                       if l.startswith("+") and not l.startswith("+++"))
    # 🆕 227 — CHECK 8 RUNS BEFORE CHECK 1, because check 1's MAJOR arm READS ITS
    # VERDICT. 🔴 THE SAME FACT, TWO DIRECTIONS, AND THAT IS NOT A CONTRADICTION: check
    # 8 refuses a bump BENEATH the wire, and the MAJOR arm accepts the wire as evidence
    # FOR one. A MAJOR wire under a MINOR name is 1.74.0; a MAJOR wire under a MAJOR
    # name is the thing the number is supposed to mean.
    wire, wire_log = wire_read(a.previous)
    engines = engines_window(a.previous, head=a.head_ref)
    c8_code, c8_why, c8 = wire_floor(wire, a.bump)
    code, why, d = verdict(released, corpus, a.bump, changed_text=window,
                           wire=wire, engines=engines)
    print(f"RELEASE_NAMES  {a.version} · {a.bump} · block {len(released):,} chars · "
          f"corpus {len(corpus):,} chars over {len(SHIPPED_SOURCE)} shipped roots")
    print(f"               constants {d['constants']}")
    print(f"               api       {d['api']}")
    print(f"               floor {d['floor']} · legible {len(d['legible'])} · "
          f"leaked {d['leaked']} · reaching {d['reaching']}")
    print(f"               window v{a.previous}..{a.head_ref} — "
          f"{len(window.splitlines())} added line(s) over the shipped roots · "
          f"in window {d['in_window']}")
    if d.get("breaking") is not None:
        print(f"               breaking evidence: "
              + ("; ".join(d["breaking"]) if d["breaking"] else "🔴 NONE"))

    # 🆕 227 — CHECK 8, REPORTED BEFORE ANYTHING RETURNS, for the reason checks 2 and 4
    # are: a check that only ever runs on trees the checks above already passed is a
    # check nobody has watched fire on a red one.
    print(f"CHECK 8        wire v{a.previous} -> working tree: {wire or '🔴 UNREADABLE'}"
          f" · bump {a.bump} · engines {engines[0] if engines else '?'} -> "
          f"{engines[1] if engines else '?'}")
    if c8_code == C8_OK:
        print(f"               🟢 [{c8_code}] {c8_why}")
    else:
        # 🔴 THE CLASSIFIER'S OWN OUTPUT, ON THE REFUSAL PATH ONLY. A verdict is one
        # word and the field paths behind it are what a human acts on; printing them on
        # every green cut would bury the four lines that matter under two hundred.
        print(f"\n{wire_log}", file=sys.stderr)
        print(f"\n🔴 RELEASE_NAMES REFUSED [{c8_code}]: {c8_why}", file=sys.stderr)

    # 🔴 CHECK 2 RUNS OVER THE SAME WINDOW AND IS REPORTED WHETHER OR NOT CHECK 1
    # REFUSED, because the two answer different questions and the interesting case is
    # exactly the one where they disagree. 🔴 BOTH VERDICTS ARE COLLECTED BEFORE EITHER
    # RETURNS — an early `return` on check 1 would mean check 2's refusal had never
    # been seen on a tree where check 1 was already red, which is how a second check
    # stays unaudited forever.
    tagv = tag_tree_version(a.previous)
    shadow = tag_shadow(a.previous)
    c2_code, c2_why, c2 = population(raw, a.previous, a.version, a.bump,
                                     tag_tree_version=tagv, shadow=shadow)
    print(f"CHECK 2        v{a.previous} tree says {tagv!r} · moved {c2['moved']} · "
          f"{len(c2['ritual_only'])} written by the ritual, "
          f"{len(c2['substantive'])} not")
    # 🆕 219 — REPORTED WHETHER OR NOT IT REFUSED, and the undeclared case is reported
    # LOUDEST, because a question nobody can answer and a question answered "fine" look
    # identical in a green run (217 §20).
    print(f"               tag shadow: "
          + (f"🔴 {shadow} commit(s) past its own declared release commit" if shadow
             else "🟢 on the release commit it declares" if shadow == 0
             else "🟡 UNMEASURABLE — v" + a.previous + " declares no release commit "
                  "(a lightweight tag, written before `--tag-cmd` existed)"))
    if c2_code in (C2_OK, C2_SILENT):
        print(f"               🟢 [{c2_code}] {c2_why}")
    else:
        print(f"\n🔴 RELEASE_NAMES REFUSED [{c2_code}]: {c2_why}", file=sys.stderr)

    # 🆕 219 — CHECK 4, AND IT IS COLLECTED BEFORE ANYTHING RETURNS for the same reason
    # check 2 is: a check that only ever runs on trees the checks above already passed is
    # a check nobody has watched fire on a red one.
    c4_code, c4_why, c4 = _addon_live(head=a.head_ref)
    print(f"CHECK 4        addon {c4['version']} · stamped {(c4['stamp'] or '?')[:12]} · "
          f"{len(c4['moved'])} file(s) moved since over {len(c4['commits'])} commit(s)")
    if c4_code == C4_OK:
        print(f"               🟢 [{c4_code}] {c4_why}")
    else:
        print(f"\n🔴 RELEASE_NAMES REFUSED [{c4_code}]: {c4_why}", file=sys.stderr)

    if code != OK:
        print(f"\n🔴 RELEASE_NAMES REFUSED [{code}]: {why}", file=sys.stderr)
        return 1
    if c2_code not in (C2_OK, C2_SILENT):
        return 1
    if c4_code != C4_OK:
        return 1
    if c8_code != C8_OK:
        return 1
    print(f"               🟢 {why}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
