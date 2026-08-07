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

🔴 AND ONE THING THIS FILE DOES NOT CLOSE. `SHIPPED_SOURCE` below is check 3's map
and 203 §2's ONE LIST rule says there must be exactly one of it. The ritual's check 3
asserts it against the real `npm pack --dry-run` roots BOTH WAYS; that assertion is
still in the scratch file. The map is defined HERE so the promoted reader does not
carry a second copy — 🔴 THE RITUAL MUST IMPORT IT FROM HERE, NOT REDEFINE IT, or
203 §2 is broken by the very move that was supposed to protect it.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# 🔴 CHECK 3's MAP — 203 §2's ONE LIST, and 204 §2's PRODUCERS. Check 6 is what
# licenses reading the producer as a proxy for the product: with the shipped bytes
# proved equal to their live sources, the source is a defensible reading of what
# ships. The tarball-roots-both-ways assertion over this map lives in the ritual's
# check 3; see the docstring's last paragraph for what that costs.
SHIPPED_SOURCE = {
    "dist":         ("host/src", "*.ts"),              # tsc
    "addon":        ("addons/breakpoint_mcp", "*"),    # host/scripts/stage-addon.mjs
    "README.md":    ("host/README.md", None),          # NOT the repo-root README
    "LICENSE":      ("host/LICENSE", None),
    # 201 §2 — npm ships this REGARDLESS of `files`.
    "package.json": ("host/package.json", None),
}

# 🔴 THE FLOOR, AND IT IS ON THE POPULATION READ, NOT ON THE ANSWER. A block naming
# two identifiers is not evidence either way; five is the number the PATCH arm has
# been pinned to since 203 and there is no reason the two arms should disagree about
# what "enough to read" means. 🔴 IT IS ALSO THE CONSTANT 215 §3's FIRST DEFECT WAS
# MEASURED AGAINST — see `the 215 incident` in SELFTEST, which asserts BOTH sides of
# it, so lowering this number to make an abort go away reddens the table.
NAME_FLOOR = 5

# 🔴 THE UNDERSCORE IS REQUIRED IN BOTH — 202 §3. It is what keeps prose words out
# of the roster ("THE", "AND") and ordinary lowercase words out of the API set.
CONST_RE = re.compile(r"\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b")
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
            changed_text: str | None = None) -> tuple[str, str, dict]:
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

    if bump == "MINOR":
        # 🔴 THE MIRROR OF THE PATCH ARM'S FLOOR, AND IT READS `api` ALONE ON
        # PURPOSE: a MINOR's claim is about identifiers reaching the product, and
        # the codebase spells those in lower snake. A MINOR whose block names only
        # constants has not described product work.
        if len(api) < f:
            return MINOR_POPULATION, (
                f"check 1's MINOR population collapsed to {len(api)} name(s): "
                f"{api} — floor is {f}. A release block this thin cannot support a "
                f"MINOR claim; re-read it by hand."), d
        # 🔴 NO WINDOW, NO CLAIM. Passing here would be passing on a comparison
        # that was not made — registry_bytes.py's rule, and the shape of the
        # 42-session blocker: an answer that could not be computed, recorded as
        # though it had been.
        if in_window is None:
            return MINOR_NO_WINDOW, (
                "🔴 the MINOR arm needs the DIFF WINDOW and was given none. The "
                "question is not whether these names exist in the product, it is "
                "whether this release MOVED them; without the window there is "
                "nothing to answer it with. Pass changed_text (the live half "
                "computes it from --previous)."), d
        if not in_window:
            return MINOR_UNSUPPORTED, (
                f"🔴 MINOR claim is UNSUPPORTED BY THE NOTES — none of the "
                f"{len(api)} identifier(s) the released block names appears in "
                f"what CHANGED in the {len(SHIPPED_SOURCE)} shipped roots this "
                f"window: {api}. {len(reaching)} of them do reach shipped source "
                f"({reaching}) and that is NOT evidence — a name can be in the "
                f"product without this release having touched it, which is exactly "
                f"how 1.73.2 passed this arm while being a PATCH (215 §2). Check 8 "
                f"says the wire moved and the notes describe something that did "
                f"not ship. One of the two is wrong. Do NOT delete this check."), d
        return OK, (f"{len(api)} identifier(s) named, {len(in_window)} of them "
                    f"appear in what CHANGED in the shipped roots ({in_window}); "
                    f"{len(reaching)} reach shipped source at all ({reaching})"), d

    # 🔴 A MAJOR HAS NO ARM AND NOBODY HAS WRITTEN ONE — 210 §9. Refusing is the
    # honest answer; passing would be a check that stops asking on the one bump
    # where the question matters most.
    return NO_ARM, (f"BUMP {bump!r} has no check 1 arm — a MAJOR needs a third one "
                    f"and nobody has written it (210 §9)"), d


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

    🔴 AND IT INCLUDES THE RITUAL'S OWN VERSION WRITES, WHICH IS WHY THE ARM READS
    NAMES AND NOT A LINE COUNT. `host/package.json` and `host/src/index.ts` both
    carry a version literal the ritual itself edits, so this window is NEVER empty
    on any release — measured at 216: the whole v1.73.1..v1.73.2 window over these
    five producers is those two lines and nothing else. A check reading "did the
    window move" would fire on every cut forever; a check reading "are any of the
    block's names IN it" does not.
    """
    import subprocess
    srcs = [rel for rel, _ in SHIPPED_SOURCE.values()]
    r = subprocess.run(["git", "diff", "--unified=0", f"v{previous}..{head}",
                        "--", *srcs],
                       cwd=str(root), capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(
            f"🔴 RELEASE_NAMES REFUSED — could not read the diff window "
            f"v{previous}..{head}: {r.stderr.strip()}. This is RED and not a skip: "
            f"the MINOR arm's evidence IS this window.")
    return "\n".join(l[1:] for l in r.stdout.splitlines()
                     if l.startswith("+") and not l.startswith("+++"))


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
    ("🔴 A MAJOR HAS NO ARM — 210 §9",
     _B1732, _SHIPPED, "MAJOR", None, None, NO_ARM, 1, 5),
    ("🔴 AN EMPTY BLOCK IS A REFUSAL, NOT A PASS",
     "   \n  ", "", "PATCH", None, None, NO_BLOCK, 0, 0),
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

    refusals = sum(1 for r in SELFTEST if r[6] != OK)
    codes = {r[6] for r in SELFTEST}
    print(f"\n  {len(SELFTEST)} rows · {refusals} REFUSE · {len(codes)} distinct "
          f"code(s) · {'🟢 all agree' if not bad else f'🔴 {bad} DISAGREE'}")
    # 🔴 EVERY REFUSAL CODE MUST HAVE A ROW. A code with no row is a branch nobody
    # has watched fire, which is the state this whole file exists to leave.
    missing = {NO_BLOCK, POPULATION_COLLAPSED, LEAK, MINOR_POPULATION, MINOR_UNSUPPORTED,
               MINOR_NO_WINDOW, NO_ARM} - codes
    if missing:
        print(f"  🔴 refusal code(s) with NO ROW: {sorted(missing)} — a branch with "
              f"no row is a branch nobody has seen fire")
        return 1
    if refusals < 6:
        print(f"  🔴 the table has stopped proving what it exists to prove "
              f"({refusals} refusing rows)")
        return 1
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="check 1 — the released block's names "
                                             "against the shipped corpus")
    ap.add_argument("--selftest", action="store_true",
                    help="drive the pure reader over its table; no fs, no network")
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
        print("RELEASE_NAMES selftest — check 1's refusals, proved with no tree")
        return selftest()

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
    window = changed_window(a.previous, head=a.head_ref)
    code, why, d = verdict(released, corpus, a.bump, changed_text=window)
    print(f"RELEASE_NAMES  {a.version} · {a.bump} · block {len(released):,} chars · "
          f"corpus {len(corpus):,} chars over {len(SHIPPED_SOURCE)} shipped roots")
    print(f"               constants {d['constants']}")
    print(f"               api       {d['api']}")
    print(f"               floor {d['floor']} · legible {len(d['legible'])} · "
          f"leaked {d['leaked']} · reaching {d['reaching']}")
    print(f"               window v{a.previous}..{a.head_ref} — "
          f"{len(window.splitlines())} added line(s) over the shipped roots · "
          f"in window {d['in_window']}")
    if code != OK:
        print(f"\n🔴 RELEASE_NAMES REFUSED [{code}]: {why}", file=sys.stderr)
        return 1
    print(f"               🟢 {why}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
