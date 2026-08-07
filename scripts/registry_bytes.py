#!/usr/bin/env python3
"""registry_bytes.py — session 213. THE ARTIFACT CHECK 7 HAS NEVER OPENED.

212 §6.3 handed this over and it is the last hop of a walk three sessions long:

    check 8 (209 §2)  stopped reading a FILE and started reading the WIRE
    check 6 (212 §3)  stopped reading the WORKING TREE and started reading the TARBALL
    check 7           still reads a VERSION STRING

`registry_lag.py` compares `npm view breakpoint-mcp version` against the local tags.
That is a NUMBER about an artifact, and the distance it measures is real and worth
measuring — 205 §3's fifty-version backlog is exactly what it catches. But in the
project's whole history NOTHING has ever compared WHAT NPM SERVES against WHAT THIS
REPOSITORY BUILDS, and check 7 is the only check in the ritual that looks at what
users actually install. A version string agreeing is not the artifact agreeing.

🔴 THIS READER EXTRACTS. IT DOES NOT SHA THE `.tgz`.
212 ran the diff by hand and wrote the trap down in red: gzip embeds an mtime, and
tar embeds one per member, so TWO BYTE-DIFFERENT TARBALLS CAN HOLD IDENTICAL FILES.
A sha over the tarball would report a difference that is not there, this check would
be red on a healthy publish, and the first person to see that would learn to ignore
it. The comparison is over the EXTRACTED TREES, entry name by entry name, and
`tarball_trap()` below proves that with two tarballs whose bytes differ and whose
contents do not — including the assertion that their bytes REALLY DO differ, because
a trap row whose premise has quietly stopped holding is a row that tests nothing.

🔴 AND IT MAKES TWO COMPARISONS, NOT ONE, BECAUSE 212 §6.1 FOUND A COINCIDENCE.
`npm publish` runs `prepublishOnly`, which is `npm run build && npm run stage-addon`.
`npm pack` DOES NOT. So the tarball a human packs to inspect and the tarball npm
actually ships are produced by two different processes, and on 212's clean tree they
agreed — "but that agreement is a coincidence of a clean tree, not something any
check asserts". It is asserted here:

    COMPARISON 1  pack as-is  vs  pack after prepublishOnly's own two steps
                  -> `npm pack` and `npm publish` ship the same bytes
    COMPARISON 2  that pack   vs  `npm pack breakpoint-mcp@<version>`
                  -> what this tree builds IS what the registry serves

Both run through the SAME comparator against the SAME floor, so neither is a
second implementation that can drift from the first.

🔴 WHY THIS IS A TRACKED FILE IN `scripts/` AND NOT CHECK 9 OF THE RELEASE SCRIPT.
The same reason `registry_lag.py` gives, and 212 §6.8 restated with evidence: the
ritual lives in `host/_to_delete/release<N>.py`, gitignored scratch copied forward by
hand, "which is how 211 §4's tautology got as far as being pre-written". A check that
survives only by being copied is not a check, it is a habit. This one is diffable, its
refusal is proved by `--selftest`, and that self-test runs in CI with no network.

🔴 AND WHEN IT CAN RUN IS A REFUSAL, NOT A SKIP.
The published version and the local version have to BE the same version for the
question to mean anything. At a release cut they are not — the bump has landed and
the publish has not happened — and that gap is check 7's job, not this one's. So a
mismatch REFUSES and says which reader owns the gap, rather than passing quietly on a
comparison it did not make. Unreachable registry is RED here for the reason
`registry_lag.py` gives at length: the 42-session blocker was an error that got
written down instead of re-run.
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from registry_lag import PKG, local_version, registry_version  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
HOST = ROOT / "host"

# 🔴 THE FLOOR UNDER THE ANSWER, AND IT IS THE WHOLE REASON THIS FILE CAN BE TRUSTED.
# "Every entry is byte-identical" is trivially true of two empty trees, and an empty
# tree is what this reader gets from a pack that failed quietly, an extraction into
# the wrong directory, or a `package/` root npm stopped emitting. That answer is the
# exact shape `tautology_gate.mjs` refuses one directory over — a claim whose failure
# set is empty by construction — and 212 §6.20's rule is the general form: ask of
# every ratio who chose the bottom number. 82 entries shipped at 1.73.1; 60 leaves
# room for the tarball to shrink honestly and none for it to vanish.
ENTRY_FLOOR = 60

# 🆕 220 — CHECK FIVE'S PREFIXES, FLOOR AND CODES. THE ADDON IS INSIDE THE ARTIFACT.
#
# 219 §6 built check 4 to ask whether the addon version still names the addon's TREE, and
# 219 §7.2 handed the re-stamp over as a STANDALONE step. Measured before running it, and
# measured rather than reasoned about: `host/package.json` ships `addon/**/*`,
# `prepublishOnly` runs `stage-addon`, and `host/scripts/stage-addon.mjs` is a `cpSync` of
# the repo-root `addons/breakpoint_mcp`. Then confirmed against the registry itself — the
# published `breakpoint-mcp@1.73.2` tarball carries `version="1.9.8"` in its own
# `plugin.cfg`. 🔴 THE ADDON IS NOT BESIDE THE PACKAGE. IT IS IN IT.
#
# 🔴 SO THE ADDON HAS A CADENCE npm CANNOT EXPRESS. `CONTRIBUTING.md` says the addon
# version moves on its own cadence — the line #272 corrected INTO the file, and true of the
# Asset Library, which serves whatever commit a submission named. It is FALSE of npm: every
# addon change is a change to the published artifact, and the only name npm has for that
# artifact is the HOST version. Three readers, and none of them asks this question:
#
#   check 4       reads the TREE                  — green on a standalone re-stamp
#   COMPARISON 2  reads the TREE vs the REGISTRY  — red, but only until the next host cut
#   check 7       reads a VERSION STRING          — green on every shape below
#   nothing       reads the ARTIFACT vs THE COMMIT ITS OWN VERSION WAS CUT FROM
#
# 🔴 AND THE DIRECTION THAT MATTERS IS THE ONE NOTHING WOULD HAVE CAUGHT. Re-stamping
# the addon BEFORE publishing 1.73.3 — which is the order 219 §7 hands over — would have put
# addon `1.9.9` inside `breakpoint-mcp@1.73.3`, whose release commit `4639828` ships `1.9.8`.
# COMPARISON 2 compares the artifact against the WORKING TREE and would have been GREEN on
# it, because the working tree is exactly where that 1.9.9 came from. A fourth tree under one
# name, and the reader built to catch trees under one name agreeing with it.
ADDON_TREE_PREFIX = "addons/breakpoint_mcp"   # where the repository keeps it
ADDON_PACK_PREFIX = "addon/breakpoint_mcp"    # where the tarball keeps it, after stage-addon

# 🔴 ITS OWN FLOOR, AND DELIBERATELY NOT `ENTRY_FLOOR`. This comparison runs over the
# twelve addon files, so the 60-entry floor would refuse every healthy run — and a floor that
# cannot be met is a floor the first reader lowers to zero, which is 205 §25's shape for
# constants. Twelve ship today; ten leaves room for one to be retired honestly and none for
# the subtree to come back EMPTY, which is the one answer this must never give, for
# `ENTRY_FLOOR`'s reason one directory over.
ADDON_ENTRY_FLOOR = 10

C5_OK = "C5_OK"
C5_ARTIFACT_ADDON_DRIFT = "C5_ARTIFACT_ADDON_DRIFT"
# 🔴 AN UNANSWERED QUESTION IS NOT A PASS — 219's `C4_ADDON_UNFINDABLE`, same argument
# and deliberately the same shape: a tree that ships no commit for its own version and a
# tree that agrees look identical in a green run.
C5_RELEASE_COMMIT_UNFINDABLE = "C5_RELEASE_COMMIT_UNFINDABLE"
# 🔴 A REFUSAL ABOUT THE READER, NOT THE ARTIFACT — 219's `C4_WINDOW_INCLUDES_STAMP`
# one file over. A prefix that matches nothing yields two empty subtrees, and two empty
# subtrees are byte-identical BY CONSTRUCTION.
C5_ADDON_UNMEASURABLE = "C5_ADDON_UNMEASURABLE"


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def tree_shas(root: Path) -> dict[str, str]:
    """Every regular file under `root`, as posix-relative name -> sha256 of its bytes.

    🔴 NAMES ARE POSIX AND RELATIVE ON PURPOSE. The two trees being compared live in
    two different temporary directories, so an absolute path is the one thing they can
    never share; comparing them by absolute path is a comparison that reports every
    entry as missing from both sides and is indistinguishable from a real total loss.
    """
    return {p.relative_to(root).as_posix(): sha(p)
            for p in sorted(root.rglob("*")) if p.is_file()}


def compare(local: dict[str, str], published: dict[str, str],
            entry_floor: int | None = None,
            labels: tuple[str, str] = ("the local pack", "the published tarball"),
            ) -> tuple[int, str]:
    """(differences, explanation). 0 is agreement; -1 is a comparison that cannot be made.

    🔴 THE SHAPE IS `lag()`'s ON PURPOSE (206 §3). Two readers in `scripts/` answering
    "is the registry what we think it is" that return their verdicts in two different
    shapes is two readers the release ritual has to special-case, and the special-casing
    is where the ritual grows the hand-carried logic this file exists to delete.

    🔴 THE THREE FAILURE MODES ARE REPORTED SEPARATELY, NOT SUMMED INTO "DIFFERENT".
    A missing entry, an extra entry and a moved byte fail for three different reasons —
    a stale `stage-addon`, a `files:` edit and a rebuilt `dist/` — and a check that
    prints one word for all three sends the reader back to `diff -r` anyway.
    """
    floor = ENTRY_FLOOR if entry_floor is None else entry_floor
    names = sorted(set(local) | set(published))
    if len(names) < floor:
        return -1, (
            f"the compared population is {len(names)} entr(y/ies) (floor {floor}). "
            f"Two empty trees are byte-identical BY CONSTRUCTION, which is the one "
            f"answer this reader must never give — check that both packs produced a "
            f"tarball and that each extracted a `package/` root")
    only_local = [n for n in names if n not in published]
    only_pub = [n for n in names if n not in local]
    moved = [n for n in names
             if n in local and n in published and local[n] != published[n]]
    total = len(only_local) + len(only_pub) + len(moved)
    if not total:
        return 0, f"{len(names)} entr(y/ies), every one byte-identical"
    parts = []
    if only_local:
        parts.append(f"{len(only_local)} only in {labels[0]}: {only_local}")
    if only_pub:
        parts.append(f"{len(only_pub)} only in {labels[1]}: {only_pub}")
    if moved:
        parts.append(f"{len(moved)} present in both with DIFFERENT BYTES: {moved}")
    return total, " · ".join(parts)


def addon_subtree(tree: dict[str, str], prefix: str) -> dict[str, str]:
    """The addon's own files, re-keyed RELATIVE TO THE ADDON ROOT.

    🔴 RELATIVE BECAUSE THE TWO SIDES DISAGREE ABOUT WHERE THE ADDON LIVES, AND THAT
    DISAGREEMENT IS CORRECT. The repository keeps it at `addons/breakpoint_mcp/`; the
    tarball keeps it at `addon/breakpoint_mcp/`, because `stage-addon` copies it into the
    build directory the package's `files:` list names. Comparing each side under its own
    name reports every entry as missing from both sides — which is `tree_shas`'s lesson
    about absolute paths one layer up, and is indistinguishable from the addon having
    vanished from the artifact entirely.

    🔴 AND THE TRAILING SLASH IS LOAD-BEARING. `addons/breakpoint_mcp` is a prefix of
    nothing in the tarball, but without the separator `addon/breakpoint_mcp` is a prefix of
    `addons/breakpoint_mcp/...` in the REPOSITORY — so the two spellings would silently
    match each other's trees and the comparison would run over a population it never meant.
    """
    p = prefix.rstrip("/") + "/"
    return {k[len(p):]: v for k, v in tree.items() if k.startswith(p)}


def artifact_addon_state(published: dict[str, str], at_commit: dict[str, str],
                         commit: str | None, version: str) -> tuple[str, str, dict]:
    """Check 5, as a PURE function of the two addon subtrees and the release commit.

    The question is not "do the copies of the addon version agree" (`contract_check`), nor
    "does the addon version name the addon's tree" (check 4), nor "is the artifact what
    this tree builds" (COMPARISON 2). It is: 🔴 DOES THE ADDON USERS INSTALL FROM npm
    MATCH THE ADDON AT THE COMMIT THE VERSION THEY INSTALLED WAS CUT FROM. Every other
    reader compares the artifact to a tree that is free to have moved since.
    """
    d = {"version": version, "commit": commit,
         "published": len(published), "at_commit": len(at_commit), "diffs": None}
    if commit is None:
        return C5_RELEASE_COMMIT_UNFINDABLE, (
            f"🔴 no commit in this history makes the shipped tree BECOME `{version}`, so "
            f"there is no tree to compare the published artifact against. 🔴 THIS IS NOT A "
            f"PASS: HEAD is not a substitute for the release commit — 219 §5 is the whole "
            f"story of what happens when it is used as one."), d
    n, why = compare(published, at_commit, entry_floor=ADDON_ENTRY_FLOOR,
                     labels=("the published tarball",
                             f"the addon at {commit[:12]}"))
    d["diffs"] = n
    if n == -1:
        return C5_ADDON_UNMEASURABLE, (
            f"🔴 {why}. 🔴 THIS REFUSES THE READER, NOT THE ARTIFACT: the prefixes are "
            f"`{ADDON_PACK_PREFIX}` in the tarball and `{ADDON_TREE_PREFIX}` in the tree, and "
            f"a prefix that has stopped matching yields an empty subtree that agrees with "
            f"every other empty subtree."), d
    if n:
        return C5_ARTIFACT_ADDON_DRIFT, (
            f"🔴 the addon inside `{PKG}@{version}` is NOT the addon at {commit[:12]}, the "
            f"commit that version was cut from — {why}. 🔴 THE PEOPLE WHO RAN `npm i "
            f"{PKG}@{version}` HAVE A TREE NO COMMIT SHIPPED UNDER THAT NAME. The addon rides "
            f"inside this package (`files:` carries `{ADDON_PACK_PREFIX}/**`, staged by "
            f"`prepublishOnly`), so an addon edit that lands without a HOST version bump "
            f"changes the artifact while leaving every version string in the tree agreeing "
            f"with itself. Cut a host version for it, or publish from the release commit."), d
    return C5_OK, (
        f"the {len(published)} addon entr(y/ies) inside `{PKG}@{version}` are byte-identical "
        f"to the addon at {commit[:12]}, the commit that version was cut from. The artifact "
        f"names one tree, which is the only thing that makes it a release rather than an "
        f"upload."), d


# ── the refusal proof (204 §8.27 — a check that has never refused is unaudited) ──
# Every row drives the PURE comparator, so the proof needs no network and no npm.
#
# 🔴 EACH ROW DECLARES THE FLOOR IT RUNS UNDER, for `registry_lag.py`'s reason and it
# is not bookkeeping. The rows about DIFFERENCES carry small trees and must run with
# the floor lowered, or the floor — not the difference — is what they measure. The
# rows about THE FLOOR ITSELF run under the LIVE `ENTRY_FLOOR`, which is what makes
# zeroing that constant redden anything at all. Without the split, `ENTRY_FLOOR = 0`
# reddens nothing: the floor rows fall through to "identical" and the table agrees
# with itself while the constant it exists to pin has been deleted.
def _tree(n: int, *, tag: str = "a", start: int = 0) -> dict[str, str]:
    return {f"dist/f{i}.js": f"{tag}{i}" for i in range(start, start + n)}


_BASE = _tree(82)
_MOVED = dict(_BASE, **{"dist/f7.js": "REBUILT"})
_EXTRA = dict(_BASE, **{"LICENSE": "lic"})
_RENAMED = {("README.md" if k == "dist/f3.js" else k): v for k, v in _BASE.items()}

# (name, local, published, live_floor, want_diffs, want_ok, want_msg_substring)
SELFTEST = [
    ("212's hand-run diff, reproduced — 82 entries, identical",
     _BASE, _BASE, False, 0, True, "byte-identical"),
    ("🔴 one entry rebuilt — THE BYTE DIFFERENCE",
     _BASE, _MOVED, False, 1, False, "DIFFERENT BYTES"),
    ("🔴 an entry the registry does not have",
     _EXTRA, _BASE, False, 1, False, "only in the local pack"),
    ("🔴 an entry the local pack does not have",
     _BASE, _EXTRA, False, 1, False, "only in the published tarball"),
    ("🔴 a RENAMED entry — both directions named, not one",
     _BASE, _RENAMED, False, 2, False, "only in"),
    ("🔴 every entry moved — all 82 reported, none truncated",
     _BASE, _tree(82, tag="z"), False, 82, False, "82 present in both"),
    ("🔴 the labels are the CALLER's, not this file's",
     _EXTRA, _BASE, False, 1, False, "only in the as-is pack"),
    ("🔴 two empty trees — THE FLOOR'S REFUSAL",
     {}, {}, True, -1, False, "population is 0"),
    ("🔴 one entry under the floor — THE FLOOR'S REFUSAL",
     _tree(59), _tree(59), True, -1, False, "compared population is 59"),
    ("exactly AT the floor is measurable, and identical",
     _tree(60), _tree(60), True, 0, True, "byte-identical"),
]


# ── 🆕 220 — check 5's tables. Both drive PURE functions: no network, no npm, no git. ──
def _addon_tree(version: str = "1.9.9", *, n: int = 12, tag: str = "a") -> dict[str, str]:
    """An addon-shaped subtree of `n` entries, one of which is the `plugin.cfg` stamp."""
    t = {f"f{i}.gd": f"{tag}{i}" for i in range(n - 1)}
    t["plugin.cfg"] = f'version="{version}"'
    return t


# 🔴 THE PREFIX TABLE EXISTS BECAUSE THE TWO SPELLINGS DIFFER BY ONE LETTER, and the
# one that is a prefix of the other is the direction that fails SILENTLY — into an empty
# subtree, which agrees with every other empty subtree. Row 3 is that letter.
# (name, tree, prefix, want)
SUBTREE_SELFTEST = [
    ("the tarball's prefix strips to the addon's own names",
     {"addon/breakpoint_mcp/plugin.cfg": "x", "dist/i.js": "y"},
     "addon/breakpoint_mcp", {"plugin.cfg": "x"}),
    ("the repository's prefix strips to the SAME names — which is the entire point",
     {"addons/breakpoint_mcp/plugin.cfg": "x", "README.md": "y"},
     "addons/breakpoint_mcp", {"plugin.cfg": "x"}),
    ("🔴 `addon/` MUST NOT MATCH `addons/` — one letter, and the separator is what stops it",
     {"addons/breakpoint_mcp/plugin.cfg": "x"}, "addon/breakpoint_mcp", {}),
    ("🔴 nested paths keep their shape below the root",
     {"addon/breakpoint_mcp/a/b.gd": "x"}, "addon/breakpoint_mcp", {"a/b.gd": "x"}),
    ("🔴 a prefix matching nothing returns EMPTY — and the floor is what refuses it",
     {"dist/i.js": "y"}, "addon/breakpoint_mcp", {}),
]

# (name, published, at_commit, commit, want_code, want_msg_substring)
ADDON_SELFTEST = [
    ("the artifact's addon IS the addon at the commit its version was cut from",
     _addon_tree(), _addon_tree(), "463982832006", C5_OK, "byte-identical"),
    ("🔴 THE LIVE SHAPE THIS SESSION FOUND — a re-stamped addon published under the "
     "PREVIOUS version's name, every version string in the tree agreeing with itself",
     _addon_tree("1.9.9"), _addon_tree("1.9.8"), "463982832006",
     C5_ARTIFACT_ADDON_DRIFT, "DIFFERENT BYTES"),
    ("🔴 a file the release commit does not have — named as the tarball's, not summed",
     dict(_addon_tree(), **{"new.gd": "x"}), _addon_tree(), "463982832006",
     C5_ARTIFACT_ADDON_DRIFT, "only in the published tarball"),
    ("🔴 a file the tarball does not have — the OTHER direction, named separately",
     _addon_tree(), dict(_addon_tree(), **{"dropped.gd": "x"}), "463982832006",
     C5_ARTIFACT_ADDON_DRIFT, "only in the addon at"),
    ("🔴 NO COMMIT CUTS THIS VERSION — unanswered, and unanswered is not a pass",
     _addon_tree(), _addon_tree(), None, C5_RELEASE_COMMIT_UNFINDABLE,
     "HEAD is not a substitute"),
    ("🔴 TWO EMPTY SUBTREES — the floor's refusal, and the reason it is not zero",
     {}, {}, "463982832006", C5_ADDON_UNMEASURABLE, "population is 0"),
    ("🔴 one entry under the floor — refused even though the two AGREE",
     _addon_tree(n=9), _addon_tree(n=9), "463982832006", C5_ADDON_UNMEASURABLE,
     "population is 9"),
    ("exactly AT the floor is measurable, and identical",
     _addon_tree(n=10), _addon_tree(n=10), "463982832006", C5_OK, "byte-identical"),
]


def _tar(src: Path, dest: Path, mtime: int) -> None:
    """Tar `src` as `package/`, pinning every member's mtime so the row is deterministic."""
    with tarfile.open(dest, "w:gz") as t:
        for p in sorted(src.rglob("*")):
            if not p.is_file():
                continue
            info = t.gettarinfo(str(p), arcname="package/" + p.relative_to(src).as_posix())
            info.mtime = mtime
            info.uid = info.gid = 0
            info.uname = info.gname = ""
            with p.open("rb") as fh:
                t.addfile(info, fh)


def tarball_trap() -> int:
    """🔴 THE ROW THAT PROVES WHY THIS READER EXTRACTS (212 §6.3's red note).

    Two tarballs, same files, different member mtimes. Their BYTES differ; their
    CONTENTS do not. A sha over the `.tgz` — the obvious implementation, and the one
    a reader reaching for `sha256sum *.tgz` writes — calls that a difference and turns
    a healthy publish red. This asserts both halves: that the bytes really do differ,
    and that the comparator says identical anyway. The first half is the row's own
    premise, and 212 §6.20's rule applies to premises too — a trap whose setup has
    stopped constructing the trap is a green line about nothing.
    """
    tmp = Path(tempfile.mkdtemp(prefix="regbytes_trap_"))
    try:
        src = tmp / "src"
        (src / "dist").mkdir(parents=True)
        for i in range(4):
            (src / "dist" / f"f{i}.js").write_text(f"export const n = {i};\n")
        (src / "package.json").write_text('{"name":"breakpoint-mcp"}\n')

        a, b = tmp / "a.tgz", tmp / "b.tgz"
        _tar(src, a, mtime=1_000_000_000)
        _tar(src, b, mtime=1_600_000_000)
        bytes_differ = sha(a) != sha(b)

        ta, tb = tmp / "xa", tmp / "xb"
        for tgz, into in ((a, ta), (b, tb)):
            into.mkdir()
            with tarfile.open(tgz) as t:
                try:
                    t.extractall(into, filter="data")
                except TypeError:      # python < 3.12 has no extraction filter
                    t.extractall(into)
        d, why = compare(tree_shas(ta / "package"), tree_shas(tb / "package"),
                         entry_floor=0)

        print(f"  {'🟢' if bytes_differ else '🔴'} the two tarballs' BYTES differ "
              f"({sha(a)[:12]} vs {sha(b)[:12]}) — the row's own premise")
        print(f"  {'🟢' if d == 0 else '🔴'} their extracted trees compare IDENTICAL "
              f"— {why}")
        if not bytes_differ:
            print("  🔴 THE TRAP NO LONGER CONSTRUCTS THE TRAP: two tarballs built "
                  "from the same tree with different mtimes came out byte-identical, "
                  "so this row proves nothing about why the comparison extracts.")
            return 1
        return 0 if d == 0 else 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def selftest() -> int:
    print("REGISTRY_BYTES selftest — the comparator's refusals, proved without a registry")
    bad = 0
    for name, loc, pub, live_floor, want_d, want_ok, want_msg in SELFTEST:
        labels = (("the as-is pack", "the rebuilt pack") if "CALLER" in name
                  else ("the local pack", "the published tarball"))
        d, why = compare(loc, pub, entry_floor=None if live_floor else 0, labels=labels)
        ok = d == 0
        verdict = "AGREE" if ok else "REFUSE"
        # 🔴 THE REASON IS CHECKED, NOT ONLY THE NUMBER — `registry_lag.py`'s lesson.
        # A missing entry and an extra entry both return 1, and a table reading only
        # the count cannot tell them apart, which is how a comparator that had lost one
        # of its two directions would stay green here.
        agree = (d == want_d) and (ok == want_ok) and (want_msg.lower() in why.lower())
        print(f"  {'🟢' if agree else '🔴'} {verdict:<6} diffs={d:<3} want={want_d:<3} "
              f"floor={'live' if live_floor else 'off ':<4} {name}")
        if not agree:
            bad += 1
            print(f"        want {want_msg!r} · got {why!r}")

    print("\n  check 5 — is the addon in the artifact the addon at its release commit? (🆕 220)")
    for name, tree, prefix, want in SUBTREE_SELFTEST:
        got = addon_subtree(tree, prefix)
        agree = got == want
        print(f"  {'🟢' if agree else '🔴'} {'addon_subtree':<22} {len(tree)}->{len(got):<3} {name}")
        if not agree:
            bad += 1
            print(f"        want {want!r} · got {got!r}")

    for name, pub, at, commit, want_code, want_msg in ADDON_SELFTEST:
        code, why, d = artifact_addon_state(pub, at, commit, "1.73.3")
        # 🔴 THE REASON IS CHECKED, NOT ONLY THE CODE — the existing table's lesson, and
        # it bites harder here: BOTH drift directions return C5_ARTIFACT_ADDON_DRIFT, so a
        # comparator that had lost one of them would stay green on the code alone.
        agree = code == want_code and want_msg.lower() in why.lower()
        print(f"  {'🟢' if agree else '🔴'} {code:<28} diffs={str(d['diffs']):<4} {name}")
        if not agree:
            bad += 1
            print(f"        want {want_code} / {want_msg!r} · got {code} / {why!r}")

    print("\n  🔴 the extraction trap — why this reader does not sha the .tgz:")
    trap = tarball_trap()
    bad += trap

    addon_refusals = sum(1 for r in ADDON_SELFTEST if r[4] != C5_OK)
    addon_codes = {r[4] for r in ADDON_SELFTEST}
    print(f"  check 5 · {len(SUBTREE_SELFTEST)} prefix row(s) · {len(ADDON_SELFTEST)} rows · "
          f"{addon_refusals} REFUSE · {len(addon_codes)} distinct code(s)")
    # 🔴 ALL FOUR CODES, NOT THREE. `C5_ADDON_UNMEASURABLE` is the one a reader would
    # drop first — it refuses on a tree where the two sides AGREE — and it is exactly the
    # row that stops an empty comparison from reading as a clean one.
    if addon_refusals < 5 or len(addon_codes) < 4:
        print(f"  🔴 check 5's table has stopped proving what it exists to prove "
              f"({addon_refusals} refusing rows, {len(addon_codes)} codes)")
        return 1
    refusals = sum(1 for r in SELFTEST if not r[5])
    floor_rows = sum(1 for r in SELFTEST if r[3])
    print(f"\n  {len(SELFTEST)} rows · {refusals} REFUSE · {floor_rows} run under the "
          f"live ENTRY_FLOOR · 1 extraction trap · "
          f"{'🟢 all agree' if not bad else f'🔴 {bad} DISAGREE'}")
    if refusals < 6 or floor_rows < 3:
        print(f"  🔴 the table has stopped proving what it exists to prove "
              f"({refusals} refusing rows, {floor_rows} floor rows) — a constant with "
              f"no refusing row is a constant nobody re-derives")
        return 1
    return 1 if bad else 0


def _pack(cwd: Path, spec: str | None, why: str) -> dict[str, str]:
    """`npm pack` into a fresh temp dir, extract it, and return the tree.

    🔴 THE TEMP DIR IS PER-CALL. Three packs happen in one run and `npm pack` names its
    output after the package and version — three identical filenames. Sharing one
    destination makes the second overwrite the first and the comparison compares a
    tarball with itself, which is 211 §4's defect in a different costume.
    """
    dest = Path(tempfile.mkdtemp(prefix="regbytes_pack_"))
    cmd = ["npm", "pack", "--pack-destination", str(dest)] + ([spec] if spec else [])
    r = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, timeout=900)
    if r.returncode != 0:
        raise SystemExit(f"🔴 REGISTRY_BYTES UNREACHABLE — `{' '.join(cmd)}` failed "
                         f"while packing {why}:\n{r.stdout}{r.stderr}\n"
                         f"Unreachable is RED, not a skip.")
    tgz = sorted(dest.glob("*.tgz"))
    if len(tgz) != 1:
        raise SystemExit(f"🔴 packing {why} produced {len(tgz)} tarball(s): "
                         f"{[p.name for p in tgz]}")
    into = dest / "x"
    into.mkdir()
    with tarfile.open(tgz[0]) as t:
        try:
            t.extractall(into, filter="data")
        except TypeError:
            t.extractall(into)
    pkg = into / "package"
    if not pkg.is_dir():
        raise SystemExit(f"🔴 {tgz[0].name} ({why}) did not extract a `package/` root: "
                         f"{sorted(p.name for p in into.iterdir())}")
    return tree_shas(pkg)


def _addon_at_commit(commit: str) -> dict[str, str]:
    """The addon's files at `commit`, sha'd the same way `tree_shas` shas the tarball's.

    🔴 `git archive` AND NOT `git ls-tree`. A tree listing hands back git's own blob
    sha1s, and the other side of this comparison is a sha256 over extracted bytes. Two
    hashes over one population is 203 §2's second list wearing a different algorithm, and
    it would report every entry as moved on a tree where nothing had moved at all — a
    refusal that is always red is a refusal nobody reads.
    """
    dest = Path(tempfile.mkdtemp(prefix="regbytes_addon_"))
    tar = dest / "addon.tar"
    r = subprocess.run(["git", "archive", "--format=tar", "-o", str(tar), commit,
                        "--", ADDON_TREE_PREFIX],
                       cwd=str(ROOT), capture_output=True, text=True, timeout=900)
    if r.returncode != 0:
        raise SystemExit(f"🔴 REGISTRY_BYTES UNREACHABLE — `git archive` failed at "
                         f"{commit[:12]}:\n{r.stdout}{r.stderr}\nUnreachable is RED, not a skip.")
    into = dest / "x"
    into.mkdir()
    with tarfile.open(tar) as t:
        try:
            t.extractall(into, filter="data")
        except TypeError:
            t.extractall(into)
    return tree_shas(into)


def verify() -> int:
    local = local_version()
    reg = registry_version()
    if reg is None:
        print("REGISTRY_BYTES  🔴 REFUSED — could not reach the npm registry.\n"
              "  RED and not a skip, for `registry_lag.py`'s reason: the 42-session "
              "publish blocker was a command whose error got\n"
              "  written down as a standing decision instead of being re-run "
              "(205 §3, §8.24).", file=sys.stderr)
        return 1
    print(f"REGISTRY_BYTES  local {local} · registry {reg} · entry floor {ENTRY_FLOOR}")
    if reg != local:
        print(f"\n🔴 REGISTRY_BYTES REFUSED — the registry serves {reg} and this tree "
              f"builds {local}.\n"
              f"  This reader asks whether the PUBLISHED ARTIFACT is what this tree "
              f"produces, and that question only\n"
              f"  has a meaning when they are the same version. THE GAP ITSELF IS "
              f"CHECK 7's — `scripts/registry_lag.py`\n"
              f"  counts it in tags and refuses above its ceiling. Run this one AFTER "
              f"`npm publish` and BEFORE `git tag`,\n"
              f"  which is the order 212 §6.1 found the hard way.", file=sys.stderr)
        return 1

    # ── COMPARISON 1 — the agreement 212 §6.1 caught being a coincidence ──
    as_is = _pack(HOST, None, "the working tree as-is")
    for script in ("build", "stage-addon"):
        r = subprocess.run(["npm", "run", script], cwd=str(HOST),
                           capture_output=True, text=True, timeout=900)
        if r.returncode != 0:
            print(f"\n🔴 REGISTRY_BYTES UNREACHABLE — `npm run {script}` failed, so "
                  f"what `npm publish` does cannot be reproduced:\n{r.stdout}{r.stderr}",
                  file=sys.stderr)
            return 1
    rebuilt = _pack(HOST, None, "the tree after prepublishOnly's own two steps")
    d1, why1 = compare(as_is, rebuilt,
                       labels=("the as-is pack", "the rebuilt pack"))
    print(f"                prepublishOnly agreement — {d1} difference(s): {why1}")
    if d1 != 0:
        print(f"\n🔴 REGISTRY_BYTES REFUSED — `npm pack` AND `npm publish` DO NOT SHIP "
              f"THE SAME BYTES.\n  {why1}\n"
              f"  `npm publish` runs `prepublishOnly` (`npm run build && npm run "
              f"stage-addon`); `npm pack` does not. So\n"
              f"  every check in the ritual that reads a packed tarball has been "
              f"reading a DIFFERENT artifact than the one\n"
              f"  that ships. On 212's tree the two agreed and nothing asserted it "
              f"(212 §6.1) — this is that assertion.", file=sys.stderr)
        return 1

    # ── COMPARISON 2 — what npm serves, against what this tree builds ──
    served = _pack(Path(tempfile.gettempdir()), f"{PKG}@{local}",
                   f"{PKG}@{local} from the registry")
    d2, why2 = compare(rebuilt, served)
    print(f"                registry agreement    — {d2} difference(s): {why2}")
    if d2 != 0:
        print(f"\n🔴 REGISTRY_BYTES REFUSED — WHAT NPM SERVES IS NOT WHAT THIS TREE "
              f"BUILDS.\n  {why2}\n"
              f"  Check 7 compares a VERSION STRING and would be green on this. "
              f"Check 6 opens the tarball this machine\n"
              f"  packs, and would be green on this too. This is the only check that "
              f"opens the one users install.", file=sys.stderr)
        return 1
    # ── 🆕 220 — COMPARISON 3 — the addon INSIDE the artifact, against the commit
    # that artifact's own version was cut from. COMPARISONS 1 and 2 both compare the
    # tarball to THIS TREE, which is free to have moved since the cut; this one compares
    # it to the tree the version names.
    #
    # 🔴 THE IMPORT IS LAZY, AND A REAL CYCLE IS WHY — measured, not assumed.
    # `release_names.py` already does `from registry_bytes import ENTRY_FLOOR` at module
    # scope, so the arrow between these two files points THIS way and has since 216. A
    # top-level `from release_names import release_commit` here would run release_names
    # while THIS module is initialised only as far as its own import block — 801 characters
    # short of where `ENTRY_FLOOR` is defined — and checks 1 through 4, which live in the
    # other file, would stop importing at all. Deferring it to the single call site that
    # needs it keeps one comparator, one packer and one direction.
    from release_names import release_commit  # noqa: E402  — see above
    cut = release_commit(local)
    at_commit = _addon_at_commit(cut) if cut else {}
    c5, why5, d5 = artifact_addon_state(
        addon_subtree(served, ADDON_PACK_PREFIX),
        addon_subtree(at_commit, ADDON_TREE_PREFIX), cut, local)
    print(f"                addon in artifact     — {d5['published']} entr(y/ies) served vs "
          f"{d5['at_commit']} at {(cut or '?')[:12]} (floor {ADDON_ENTRY_FLOOR})")
    if c5 != C5_OK:
        print(f"\n🔴 REGISTRY_BYTES REFUSED [{c5}] — {why5}\n"
              f"  Check 4 reads the TREE and is green on this. COMPARISON 2 reads the "
              f"tarball against the WORKING TREE\n"
              f"  and is green on this. Check 7 reads a VERSION STRING and is green on "
              f"this. 🔴 THIS IS THE ONLY READER THAT\n"
              f"  COMPARES WHAT USERS INSTALL AGAINST THE COMMIT THEY INSTALLED IT UNDER.",
              file=sys.stderr)
        return 1
    print(f"                🟢 [{c5}] {why5}")
    print("                🟢 the published artifact IS what this tree builds")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--selftest", action="store_true",
                    help="drive the pure comparator over its table, plus the "
                         "extraction trap; no network, no npm")
    a = ap.parse_args()
    return selftest() if a.selftest else verify()


if __name__ == "__main__":
    raise SystemExit(main())
