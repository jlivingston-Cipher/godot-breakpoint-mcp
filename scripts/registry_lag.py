#!/usr/bin/env python3
"""registry_lag.py — session 206. THE DISTANCE NOBODY WAS MEASURING.

205 §3 closed a fifty-version npm backlog in one publish. The failure it fixed was
NOT "we did not publish once" — it was:

    we did not publish for 42 sessions, and NOTHING MEASURED THE GAP,

while the blocker the whole time was one stale `_authToken` line in `~/.npmrc`
that nothing ever re-tested. Six patch releases went into building checks around
the CONSEQUENCES of not publishing (a staged addon that had fossilised at the
last publish) before anyone re-ran the publish itself.

🔴 WHY THIS IS A FILE IN `scripts/` AND NOT CHECK 7 OF THE RELEASE SCRIPT.
Checks 1-6 live in `host/_to_delete/release<N>.py`, which is GITIGNORED SCRATCH,
copied forward by hand each session. That is precisely 205 §23's meta-rule —
*a number carried in the handoff is a number no gate reads* — and a lag ceiling
that survives only by being copied is the same class of artefact as the "26 CI
jobs" that was carried for many sessions and meant something else. The ceiling
below is in the repository, diffable, and its refusal is proved by `--selftest`.

🔴 THE LIVE READING AND THE REFUSAL PROOF RUN IN DIFFERENT PLACES, ON PURPOSE.
The LIVE reading needs the registry and is only ACTIONABLE at a release cut —
between cuts it is a number nobody can do anything about, and a gate that reddens
where no one can fix it trains people to ignore it. The release script calls it;
CI does not, because making every push depend on registry reachability buys a
signal nobody would act on at the cost of real flake.

🔴 BUT `--selftest` IS PURE — NO NETWORK, NO REGISTRY — AND IT RUNS IN CI, as a
STEP in the existing `contract-check` job rather than a 27th job (44th session
running). That is the half that carries 204 §8.27: *a check that has never refused
has not been audited*. The table below has FOUR refusing rows and CI is what keeps
them refusing. Without it, `LAG_CEILING` is a literal nobody ever re-derives —
which is the exact class of artefact this file exists to replace.

🔴 A NETWORK FAILURE IS A REFUSAL, NOT A SILENCE, AND THAT IS THE WHOLE LESSON.
The 42-session blocker was a command that returned an error which got written down
as a standing decision instead of being re-run. If this check treated "cannot reach
the registry" as "nothing to report", it would fail in exactly the way the incident
it exists to prevent failed. Unreachable is RED. The only way past it is
`--offline-declared`, which is a claim a human makes on the record, in the release
commit, and which prints as a declaration rather than a pass.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PKG = "breakpoint-mcp"

# 🔴 THE DECLARED CEILING, sized against the incident it exists to catch. Publishing
# stopped at `1.29.0`; the very next cut was already one tag behind, and by the time
# anyone looked it was fifty. A ceiling this low refuses within the first week while
# still admitting a same-session patch burst — `1.72.1` through `1.72.5` were cut
# inside a single session and stay legal.
#
# This is a CEILING and not a floor, so the collapse-to-zero failure mode every floor
# in this tree guards against does not apply: zero lag is the HEALTHY reading. What
# can still collapse is the tag population, so that carries its own floor below.
LAG_CEILING = 3

# The tag corpus this distance is counted in, which must not silently empty out.
# 206 §3 measured it at more than a hundred.
TAG_FLOOR = 100

# 🔴 269 — THE SECOND DISTANCE, AND `registry-lag-blind-past-tag` is the row it closes.
#
# `lag()` counts TAGS the registry has not got. It is therefore structurally unable to
# see a COMMIT that no tag names, and it printed 🟢 on both sides of the same defect
# within twenty minutes at 260 — before that publish, `distance one, within ceiling`,
# while four merges of user-reaching work sat past the newest tag, among them a pipe
# truncation that silently cut every piped `tools --json` at one buffer; after it,
# `distance zero, within ceiling`, over a registry artifact that differed from its own
# tag by nearly nine hundred inserted lines. Same blindness, opposite sign, green both
# times.
#
# The instrument answers *how many tags has npm not got yet* and is read as *how far is
# the registry behind the work*. Those are the same number only in a history where every
# commit is tagged, and this history is not one: 248's own block already recorded the
# other face of it — a merged-but-untagged release cut reads a lag of zero — and treated
# it as a curiosity of the counter rather than opening the row.
#
# 🔴 TWO CEILINGS AND NOT A SUM, WHICH IS WHAT THE ROW ASKED FOR IN WORDS. The two
# numbers go stale in OPPOSITE directions: publishing drives `lag` to zero and leaves
# this one untouched; tagging drives this one to zero and leaves `lag` where it was. One
# ceiling over their total would let either be hidden by the other going green, which is
# the same reader-collapse this file exists to stop.
#
# 🔴 MEASURED, NOT PICKED. Every interval between consecutive tags across this
# repository's last twenty-five releases has a median of two, and every one of them is
# seven or under except `v1.74.0 -> v1.74.1`, which is twenty-six — the window 248's own
# session measured as twenty-five commits carrying exactly one change a user could
# observe. This ceiling admits the largest healthy interval and refuses that one, which
# is `LAG_CEILING`'s own shape one axis over.
UNTAGGED_CEILING = 8

TAG_RE = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")


def parse_tags(names: list[str]) -> list[tuple[int, int, int]]:
    """Every `vX.Y.Z` tag as a sortable triple, ascending. Non-matching names drop."""
    return sorted(tuple(int(g) for g in m.groups())
                  for m in (TAG_RE.match(n.strip()) for n in names) if m)


def lag(registry_version: str, tag_names: list[str],
        tag_floor: int | None = None) -> tuple[int, str]:
    """(distance, explanation) — how many released tags are NEWER than the registry.

    🔴 `tag_floor` IS A PARAMETER RATHER THAN A READ OF THE GLOBAL, and that is not a
    style choice. The self-test has to drive rows both under the live floor and out from
    under it, and the first draft did that by ASSIGNING TO THE MODULE GLOBAL. That put
    three `TAG_FLOOR = ...` statements in this file, `floor_pin_gate.py`'s DISCOVER half
    read every one of them as a floor declaration, and two of them could never be pinned
    by anything because they are not the constant — they are a probe rewriting it.
    Threading it through the signature leaves exactly ONE assignment in the file, which
    is the one the gate pins.

    🔴 THE DISTANCE IS COUNTED IN TAGS, NOT IN SEMVER ARITHMETIC. "1.29.0 to 1.72.7"
    is not a number; "fifty tags were cut and none of them were published" is. The
    tag list is what this repository actually released, so it is the only honest
    denominator. A version on the registry that this repository never tagged is not
    a small lag — it is an ANOMALY, and it refuses separately below.
    """
    floor = TAG_FLOOR if tag_floor is None else tag_floor
    tags = parse_tags(tag_names)
    if len(tags) < floor:
        return -1, (f"the tag population collapsed to {len(tags)} (floor {floor}). "
                    f"This reader cannot compute a distance it cannot measure — check "
                    f"`git fetch --tags` before reading this as a real finding")
    m = TAG_RE.match(f"v{registry_version.strip()}")
    if not m:
        return -1, f"registry version {registry_version!r} is not a vX.Y.Z version"
    reg = tuple(int(g) for g in m.groups())
    if reg not in tags:
        return -1, (f"THE REGISTRY IS PUBLISHING {registry_version}, WHICH THIS "
                    f"REPOSITORY HAS NEVER TAGGED. That is not a lag, it is a "
                    f"provenance failure — something was published from a tree that "
                    f"is not in this history. Do not cut a release over it")
    newer = [t for t in tags if t > reg]
    return len(newer), (f"{len(newer)} tag(s) newer than the published "
                        f"{registry_version}: "
                        f"{', '.join('v%d.%d.%d' % t for t in newer) or '(none)'}")


def untagged(commits: int, tag_names: list[str],
             tag_floor: int | None = None) -> tuple[int, str]:
    """(commits past the newest tag, explanation) — the distance `lag()` cannot see.

    🔴 THE DENOMINATOR IS THE SAME TAG CORPUS, so it carries the same floor, and for the
    same reason: a reader whose population has silently emptied answers zero and reads as
    healthy. `git rev-list --count v0.0.0..HEAD` against a clone with no tags does not
    fail — it counts the whole history or nothing at all depending on how it is asked,
    and either answer is a number this file would print beside a 🟢.

    🔴 AND `commits` IS A PARAMETER, NOT A GIT CALL. `lag()`'s docstring records what
    happened when its floor was a module global the self-test reassigned: three
    `TAG_FLOOR = ...` statements in one file, two of which no gate could pin. The same
    rule applies to the reading itself — the pure half is driven by the table below and
    the impure half is `head_past_newest_tag()`, so the decision is provable without a
    repository and the repository is read in exactly one place.
    """
    floor = TAG_FLOOR if tag_floor is None else tag_floor
    tags = parse_tags(tag_names)
    if len(tags) < floor:
        return -1, (f"the tag population collapsed to {len(tags)} (floor {floor}). "
                    f"A commit distance measured from a tag that is not there is not a "
                    f"small number, it is no measurement")
    if commits < 0:
        return -1, (f"the commit count came back {commits}, which git does not produce "
                    f"— treat it as unread rather than as zero")
    newest = "v%d.%d.%d" % tags[-1]
    return commits, (f"{commits} commit(s) on HEAD that {newest} does not name"
                     if commits else f"HEAD is {newest}")


def head_past_newest_tag() -> tuple[int, str]:
    """(commits from the newest vX.Y.Z tag to HEAD, problem) — reads the repository."""
    tags = parse_tags(git_tags())
    if not tags:
        return -1, "no vX.Y.Z tag in this clone — run `git fetch --tags`"
    newest = "v%d.%d.%d" % tags[-1]
    r = subprocess.run(["git", "rev-list", "--count", f"{newest}..HEAD"],
                       cwd=str(ROOT), capture_output=True, text=True)
    if r.returncode != 0:
        return -1, f"`git rev-list {newest}..HEAD` exited {r.returncode}"
    return int(r.stdout.strip() or -1), ""


def registry_version() -> str | None:
    """`latest` on the registry, or None if the registry could not be reached."""
    try:
        r = subprocess.run(["npm", "view", PKG, "version"],
                           capture_output=True, text=True, timeout=45)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None


def local_version() -> str:
    return json.loads((ROOT / "host" / "package.json").read_text())["version"]


# ══ 🆕 279 — THE SECOND REGISTRY QUESTION, AND SIX SESSIONS ASKED IT OF ONE NAME ══════
#
# 🔴 `sdk-v2-migration` (226) HAS BEEN RE-READ AT 250, 257, 262, 267 AND 278, AND EVERY
# ONE OF THOSE READINGS RAN `npm view @modelcontextprotocol/sdk dist-tags`, SAW NO 2.x,
# AND RE-TARGETED THE ROW. All five readings were correct about that package and none of
# them could have answered the question: the TypeScript SDK's version 2 shipped on
# 2026-07-27 as `@modelcontextprotocol/core`, `/server`, `/client`, `/node` and
# `/express`, published from the same repository, while `@modelcontextprotocol/sdk`
# stayed frozen at its 1.x. The row's own text pinned the reader to one name — *check
# `npm view @modelcontextprotocol/sdk dist-tags` first* — and a Tier 1 row waited
# fifty-three sessions for a release that had already happened under different ones.
#
# So the population is DERIVED and never typed: every package the registry serves from
# the same repository as the dependency `host/package.json` actually pins. A rename, a
# split or a sixth sibling joins the reading by itself; a curated list of names is the
# thing that just cost fifty-three sessions.
#
# The comparison is on the MAJOR only. A minor upstream of the pinned range is
# `sdk-drift.yml`'s job — that workflow rebuilds against the newest version IN RANGE, and
# a range cannot contain a new major, which is why the early-warning built for exactly
# this class was structurally unable to see it.
UPSTREAM_SCOPE = "@modelcontextprotocol"


def major_of(spec: str) -> int:
    """The major a version or range denotes, or -1 when nothing in it is a version.

    PURE. `^1.29.0`, `~1.29.0`, `>=1.29.0 <2`, `1.29.0` and `v1.29.0` all read 1.
    """
    m = re.search(r"(\d+)\.\d+", str(spec or ""))
    return int(m.group(1)) if m else -1


def pinned_upstream(root: Path = ROOT) -> "dict[str, str]":
    """{package: range} — every `UPSTREAM_SCOPE` dependency `host/package.json` pins."""
    pkg = json.loads((root / "host" / "package.json").read_text())
    out = {}
    for field in ("dependencies", "devDependencies", "peerDependencies"):
        for name, spec in (pkg.get(field) or {}).items():
            if name.startswith(UPSTREAM_SCOPE + "/"):
                out[name] = str(spec)
    return out


def siblings_of(rows: "list[dict]", repo: str) -> "dict[str, str]":
    """{package: newest version} for every search row published from `repo` — PURE.

    The repository is the join, not the scope: `@modelcontextprotocol/inspector` and
    `/conformance` carry the same scope and are different projects, and a package that
    moved out of the scope entirely would still be found by its repository.
    """
    want = repo_key(repo)
    if not want:
        return {}
    out = {}
    for r in rows or []:
        name = str(r.get("name") or "")
        got = repo_key(str((r.get("links") or {}).get("repository")
                           or r.get("repository") or ""))
        if name and got and got == want:
            out[name] = str(r.get("version") or "")
    return out


def repo_key(url: str) -> str:
    """`git+https://github.com/owner/name.git` -> `github.com/owner/name` — PURE."""
    s = re.sub(r"^git\+", "", str(url or "")).strip()
    s = re.sub(r"^[a-z+]+://", "", s)
    s = re.sub(r"^[^@/]+@", "", s).replace(":", "/", 1) if s.startswith("git@") else s
    return re.sub(r"\.git$", "", s).rstrip("/").lower()


def upstream_problems(pins: "dict[str, str]",
                      family: "dict[str, str]",
                      deprecated: "dict[str, str] | None" = None,
                      deferred: "dict[str, dict] | None" = None
                      ) -> "tuple[list[str], list[str]]":
    """(problems, notes) — is a MAJOR newer than what this tree pins on the registry?

    PURE over both readings, so every direction is drivable from a fixture and none of it
    needs a network — 235 §6.3, and the reason five hand-run readings of this question
    left nothing behind that a later session could re-run.

    🔴 A TREE THAT PINS NOTHING IN THE SCOPE IS UNREAD AND NOT GREEN. There is no newest
    major to compare against a pin that does not exist, and answering *no newer major*
    about a tree with no dependency is the confident-and-wrong shape this whole reader
    exists to stop.

    🆕 281 — `deferred` is the written argument for staying, `deprecated` is what the
    registry says about the packages that argument rests on. Both default to the shape
    that changes nothing: no deferral, and a deprecation reading nobody took. A caller
    that passes a deferral and no deprecation reading is refused by `deferral_problems`
    rather than believed.
    """
    if not pins:
        return ([], [f"SDK_UPSTREAM UNREAD — `host/package.json` pins nothing in "
                     f"{UPSTREAM_SCOPE}, so there is no major to compare"])
    if not family:
        return ([], ["SDK_UPSTREAM UNREAD — the registry listed no package published "
                     "from the same repository as the pinned dependency"])
    ours = max(major_of(s) for s in pins.values())
    ahead = sorted((n, v) for n, v in family.items() if major_of(v) > ours)
    if not ahead:
        return ([], [f"SDK_UPSTREAM 🟢 major {ours} — {len(family)} package(s) from that "
                     f"repository and none is ahead of what this tree pins"])
    held, why_held = deferral_problems(family, deprecated, deferred)
    if held:
        return (held, [])
    if why_held:
        return ([], why_held)
    return ([f"🔴 SDK_UPSTREAM REFUSED — the tree pins major {ours} and the registry "
             f"serves major {max(major_of(v) for _, v in ahead)} from the same "
             f"repository: " + ", ".join(f"{n} {v}" for n, v in ahead)
             + ".\n  This is the reading `sdk-v2-migration` (226) has been re-targeted "
               "against five times while asking one package name. Migrate, or say in the "
               "row which packages the answer lives in and why they do not apply."], [])


# ══ 🆕 281 — A DEFERRAL A READER CAN REFUSE ═══════════════════════════════════════════
#
# 280 closed `sdk-v2-migration` (226) against a full measurement and NOT by migrating:
# v2 kept the four task RPCs and dropped the server-side implementation behind them, so
# the whole cost of moving is one import with no home. That is a decision, and a decision
# a reader cannot see is the thing this file was built at 279 to stop.
#
# 🔴 THE READING ABOVE REFUSES FOREVER UNTIL SOMEBODY MIGRATES, WHICH IS THE SAME DEFECT
# ONE TURN LATER. A check that is red for a reason everybody already knows is a check
# people stop reading — 279's own argument for keeping `--upstream` out of `ci.yml`, made
# there about a red that would train people to ignore it, and true here of a red that
# would sit in `sdk-drift.yml` every Monday for as long as the deferral holds. Silencing
# it is not the answer either: that is 205 §3's forty-two sessions.
#
# So a deferral is a ROW, and the row is refused the moment its argument stops holding.
# 279's own refusal text asked for exactly this — *migrate, or say in the row which
# packages the answer lives in and why they do not apply* — and had nowhere to say it.
#
# 🔴 AND THE ROW CANNOT BE WRITTEN WITHOUT NAMING THE UPSTREAM IT WAS ARGUED AGAINST.
# That is 280's finding-to-carry applied to the row that produced it: `PROVENANCE` found
# `npm.untagged`'s population because a table would not take a row without answering
# *TREE, CLONE or REMOTE*. This table will not take a row without `seen` — the family's
# API coordinates at the moment the argument was made — so the argument is pinned to a
# measurement rather than to a memory of one. 279 §9's rule is the whole point: AN
# EXEMPTION WHOSE REASON HAS EXPIRED READS EXACTLY LIKE ONE WHOSE REASON HOLDS, unless
# the reason is re-derived on every run.
#
# The coordinate is `MAJOR.MINOR` and not the full version, and that is semver's own
# line rather than a taste: a PATCH adds no API, so it cannot give the missing symbols a
# home and it does not move the argument. A MINOR can, and does move it.
DEFER_SEEN, DEFER_WHY, DEFER_BLOCKED = "seen", "why", "blocked_by"

UPSTREAM_DEFERRED: "dict[str, dict]" = {
    "@modelcontextprotocol/sdk": {
        # Measured at 281 by `npm search @modelcontextprotocol --json`, joined on the
        # repository exactly as `siblings_of` joins it.
        DEFER_SEEN: {
            "@modelcontextprotocol/sdk": "1.30",
            "@modelcontextprotocol/core": "2.0",
            "@modelcontextprotocol/server": "2.0",
            "@modelcontextprotocol/client": "2.0",
            "@modelcontextprotocol/node": "2.0",
            "@modelcontextprotocol/express": "2.0",
        },
        DEFER_BLOCKED: ("InMemoryTaskStore", "isTerminal", "ExperimentalMcpServerTasks",
                        "assertToolsCallTaskCapability"),
        DEFER_WHY:
            "280 §1 measured the whole migration: 115 import statements over 70 files, "
            "112 of them rename-only, and ONE with no v2 home — `sdk/experimental/"
            "tasks`. v2 kept the PROTOCOL (all four task RPCs, byte-identical method "
            "names, in `core`) and dropped the SERVER-SIDE implementation behind it. "
            "Migrating means either vendoring ~600 lines of machinery upstream "
            "deliberately deleted and still calls experimental, or withdrawing a "
            "capability this server advertises in `initialize` and declares on all 289 "
            "tools — a MAJOR, one session after 1.82.0 measured what a MAJOR cut as a "
            "MINOR costs a caller. And it buys nothing on the wire today: v2's "
            "`LATEST_PROTOCOL_VERSION` is `2025-11-25`, the same as v1's, so no client "
            "could tell the two apart. Held at 281 by his decision, against this "
            "measurement.",
    },
}


def api_coord(version: str) -> str:
    """`2.0.0` -> `2.0` — the coordinates at which an API can gain a member. PURE.

    Semver's own line, not a taste: a PATCH publishes no new export, so it cannot give a
    missing symbol a home. A MINOR can. Anything unparseable returns "", which
    `deferral_problems` reads as a coordinate it cannot compare rather than as agreement.
    """
    m = re.match(r"v?(\d+)\.(\d+)", str(version or "").strip())
    return f"{m.group(1)}.{m.group(2)}" if m else ""


def deferral_problems(family: "dict[str, str]",
                      deprecated: "dict[str, str] | None",
                      deferred: "dict[str, dict] | None"
                      ) -> "tuple[list[str], list[str]]":
    """(problems, notes) — does a written deferral still hold against the live registry?

    PURE, so every direction is a fixture. `deprecated` is {package: message} for the
    packages the registry marks deprecated; `{}` means asked-and-none, and **None means
    NOT ASKED**, which is refused rather than assumed — a deferral resting on *v1 is not
    deprecated* cannot be honoured by a reading that never looked.

    Empty `deferred` is not a problem here: it means nothing is deferred, and the caller's
    own refusal is what should speak.
    """
    if not deferred:
        return ([], [])
    live = {n: api_coord(v) for n, v in (family or {}).items()}
    if deprecated is None:
        return ([f"🔴 SDK_UPSTREAM REFUSED — {len(deferred)} deferral(s) on the record and "
                 f"the registry was never asked whether the pinned package is "
                 f"DEPRECATED.\n  A deferral is an argument about upstream's state, and "
                 f"an unasked question is not an answer. UNREAD IS NOT GREEN."], [])
    notes = []
    for name, row in sorted(deferred.items()):
        seen = row.get(DEFER_SEEN) or {}
        if not seen:
            return ([f"🔴 SDK_UPSTREAM REFUSED — the deferral for {name} names no "
                     f"upstream it was argued against. A row with no `{DEFER_SEEN}` is a "
                     f"memory, and this table takes measurements."], [])
        if name not in live:
            return ([f"🔴 SDK_UPSTREAM REFUSED — {name} is deferred and the registry no "
                     f"longer serves it from that repository. The deferral is about a "
                     f"package nobody is offered; re-argue it against what is there."], [])
        gone = sorted(set(seen) - set(live))
        joined = sorted(set(live) - set(seen))
        moved = sorted(f"{n} {seen[n]} -> {live[n]}" for n in set(seen) & set(live)
                       if seen[n] != live[n])
        if gone or joined or moved:
            return ([f"🔴 SDK_UPSTREAM REFUSED — the deferral for {name} was argued "
                     f"against an upstream that has since moved, so nothing here knows "
                     f"whether it still holds.\n"
                     + (f"  joined: {', '.join(joined)}\n" if joined else "")
                     + (f"  gone: {', '.join(gone)}\n" if gone else "")
                     + (f"  moved: {'; '.join(moved)}\n" if moved else "")
                     + f"  The deferral rests on {', '.join(row.get(DEFER_BLOCKED) or ())}"
                       f" having no home in that family. Re-read it, then update "
                       f"`{DEFER_SEEN}` — or migrate."], [])
        bad = sorted(p for p in seen if deprecated.get(p))
        if bad:
            return ([f"🔴 SDK_UPSTREAM REFUSED — the deferral for {name} holds and the "
                     f"registry has DEPRECATED {', '.join(bad)}.\n"
                     f"  Staying is no longer the cheap door: upstream has said out loud "
                     f"that the version this tree pins is not the one to be on."], [])
        notes.append(f"SDK_UPSTREAM 🟢 DEFERRED — {name}: {len(seen)} package(s) at the "
                     f"coordinates the deferral was argued against, none deprecated. "
                     f"Blocked on {', '.join(row.get(DEFER_BLOCKED) or ())}.")
    return ([], notes)


def npm_deprecated(name: str) -> "tuple[str, str]":
    """(deprecation message, problem) for one package — NETWORK. Never raises.

    `npm view <pkg> deprecated` prints the message and nothing at all when the package is
    not deprecated, so an empty stdout on a clean exit IS the answer and not a silence.
    A non-zero exit is a silence, and it is returned as a problem.
    """
    try:
        r = subprocess.run(["npm", "view", name, "deprecated"],
                           capture_output=True, text=True, timeout=45)
    except (OSError, subprocess.TimeoutExpired) as e:
        return ("", f"`npm view {name} deprecated` could not run: {e}")
    if r.returncode != 0:
        return ("", f"`npm view {name} deprecated` exited {r.returncode}")
    return (r.stdout.strip(), "")


def npm_search_scope(scope: str = UPSTREAM_SCOPE) -> "tuple[list, str]":
    """(search rows, problem) — NETWORK. Never raises."""
    try:
        r = subprocess.run(["npm", "search", scope, "--json"],
                           capture_output=True, text=True, timeout=90)
    except (OSError, subprocess.TimeoutExpired) as e:
        return ([], f"`npm search {scope}` could not run: {e}")
    if r.returncode != 0:
        return ([], f"`npm search {scope}` exited {r.returncode}")
    try:
        rows = json.loads(r.stdout or "[]")
    except ValueError as e:
        return ([], f"`npm search {scope} --json` did not return JSON: {e}")
    return (rows if isinstance(rows, list) else [], "")


def npm_repo_of(name: str) -> "tuple[str, str]":
    """(repository url, problem) for one package — NETWORK. Never raises."""
    try:
        r = subprocess.run(["npm", "view", name, "repository.url"],
                           capture_output=True, text=True, timeout=45)
    except (OSError, subprocess.TimeoutExpired) as e:
        return ("", f"`npm view {name} repository.url` could not run: {e}")
    if r.returncode != 0:
        return ("", f"`npm view {name} repository.url` exited {r.returncode}")
    return (r.stdout.strip(), "")


def upstream_reading(root: Path = ROOT) -> "tuple[list[str], list[str]]":
    """(problems, notes) — the dialled half. Everything it decides, it decides in
    `upstream_problems`; this function only fetches."""
    pins = pinned_upstream(root)
    if not pins:
        return upstream_problems(pins, {})
    anchor = sorted(pins)[0]
    repo, why = npm_repo_of(anchor)
    if why:
        return ([], [f"SDK_UPSTREAM UNREAD — {why}"])
    rows, why = npm_search_scope()
    if why:
        return ([], [f"SDK_UPSTREAM UNREAD — {why}"])
    family = siblings_of(rows, repo)
    # 🆕 281 — THE DEPRECATION READING IS TAKEN ONLY WHEN A DEFERRAL RESTS ON IT, and its
    # population is the deferral's own `seen` rather than the whole family: a question
    # asked of packages no argument depends on is a network call that cannot change an
    # answer. A package the registry will not answer for leaves `deprecated` as None,
    # which `deferral_problems` refuses — an unasked question is not an answer.
    deprecated: "dict[str, str] | None" = None
    wanted = sorted({p for row in UPSTREAM_DEFERRED.values()
                     for p in (row.get(DEFER_SEEN) or {})})
    if wanted:
        got: "dict[str, str]" = {}
        for name in wanted:
            msg, why = npm_deprecated(name)
            if why:
                return ([], [f"SDK_UPSTREAM UNREAD — {why}"])
            got[name] = msg
        deprecated = got
    return upstream_problems(pins, family, deprecated, UPSTREAM_DEFERRED)


def git_tags() -> list[str]:
    r = subprocess.run(["git", "tag", "--list", "v*"], cwd=str(ROOT),
                       capture_output=True, text=True, check=True)
    return r.stdout.split()


# ── the refusal proof (204 §8.27 — a check that has never refused is unaudited) ──
# Every row drives the PURE function, so the proof needs no network and no registry.
#
# 🔴 EACH ROW DECLARES THE FLOOR IT RUNS UNDER, AND THAT IS NOT BOOKKEEPING.
# The rows about LAG DISTANCE carry deliberately tiny tag lists, so they must run with
# the floor lowered or the floor — not the distance — is what they would be measuring.
# The rows about THE FLOOR ITSELF run under the LIVE `TAG_FLOOR`. Without that split,
# zeroing `TAG_FLOOR` reddens nothing: an empty tag list falls through to the
# never-tagged branch and returns the same -1 for a different reason, so the table
# would agree with itself while the floor it is supposed to pin had been deleted.
# `floor_pin_gate.py` asked this question on this file's first run and that is the
# answer — 180 §7.3's shape on a new file.
#
# 🔴 THE FIRST ROW IS THE REAL INCIDENT, NOT A CONSTRUCTION: registry stuck on 1.29.0
# against the tags this repository actually cut while it sat there.
#
# (name, registry, tags, live_floor, want_distance, want_pass, want_reason_substring)
SELFTEST = [
    ("the 205 incident, at its worst",
     "1.29.0", [f"v1.{n}.0" for n in range(29, 73)], False, 43, False, "newer than"),
    ("the 205 incident, one release in",
     "1.29.0", ["v1.29.0", "v1.30.0"], False, 1, True, "newer than"),
    ("the 205 incident, at the ceiling",
     "1.29.0", ["v1.29.0", "v1.30.0", "v1.31.0", "v1.32.0"], False, 3, True, "newer than"),
    ("🔴 one past the ceiling — THE CEILING'S REFUSAL",
     "1.29.0", ["v1.29.0", "v1.30.0", "v1.31.0", "v1.32.0", "v1.33.0"],
     False, 4, False, "newer than"),
    ("current and healthy",
     "1.72.7", ["v1.72.6", "v1.72.7"], False, 0, True, "(none)"),
    ("a same-session patch burst stays legal",
     "1.72.1", ["v1.72.1", "v1.72.2", "v1.72.3", "v1.72.4"], False, 3, True, "newer than"),
    ("🔴 a version the repo never tagged — provenance, not lag",
     "9.9.9", ["v1.72.6", "v1.72.7"], False, -1, False, "NEVER TAGGED"),
    ("🔴 a tag list UNDER the floor — THE FLOOR'S REFUSAL",
     "1.72.7", ["v1.72.7"], True, -1, False, "tag population collapsed"),
    ("🔴 an empty tag list cannot yield a distance",
     "1.72.7", [], True, -1, False, "tag population collapsed"),
]

# 🔴 269 — THE SECOND TABLE, FOR THE SECOND DISTANCE, AND ITS FIRST ROW IS AN ADMISSION.
#
# 260's own instance was FOUR commits past the newest tag, and four is inside a ceiling
# of eight. This ceiling would NOT have refused it, and the row says so out loud rather
# than being sized down until it did: a ceiling tight enough to refuse four would refuse
# every ordinary mid-session state, because a session legitimately sits several merges
# past its last tag while it works. What 260 was missing is not a refusal — it is a
# NUMBER. `lag` printed 🟢 and nothing anywhere said *and four commits of user-reaching
# work are past the tag*. That number is printed now, on every run, beside the one it was
# being mistaken for. The ceiling is for the other failure, the one 248 measured at 26.
#
# (name, commits, tags, live_floor, want_distance, want_pass, want_reason_substring)
UNTAGGED_SELFTEST = [
    ("🟡 260's OWN INSTANCE — printed, and inside the ceiling; see the note above",
     4, [f"v1.{n}.0" for n in range(29, 76)], False, 4, True, "does not name"),
    ("HEAD is the newest tag — the healthy reading",
     0, ["v1.79.0", "v1.80.0"], False, 0, True, "HEAD is v1.80.0"),
    ("a session mid-flight, two merges past its tag",
     2, ["v1.79.0", "v1.80.0"], False, 2, True, "does not name"),
    ("at the ceiling — the largest healthy interval this repository has cut",
     UNTAGGED_CEILING, ["v1.74.1", "v1.75.0"], False, UNTAGGED_CEILING, True,
     "does not name"),
    ("🔴 one past the ceiling — THE CEILING'S REFUSAL",
     UNTAGGED_CEILING + 1, ["v1.74.1", "v1.75.0"], False, UNTAGGED_CEILING + 1, False,
     "does not name"),
    ("🔴 THE 248 WINDOW — twenty-five commits carrying one user-observable change",
     26, ["v1.74.0", "v1.74.1"], False, 26, False, "does not name"),
    ("🔴 a tag list UNDER the floor — THE FLOOR'S REFUSAL",
     3, ["v1.80.0"], True, -1, False, "tag population collapsed"),
    ("🔴 an empty tag list cannot anchor a commit distance",
     3, [], True, -1, False, "tag population collapsed"),
    ("🔴 a count git could not produce is UNREAD, never zero",
     -1, ["v1.79.0", "v1.80.0"], False, -1, False, "unread rather than as zero"),
]


def selftest() -> int:
    """Drive `lag()` over the table. Asserts each constant REFUSES, not just that it runs."""
    bad = 0
    for name, reg, tags, live_floor, want_d, want_ok, want_msg in SELFTEST:
        # 🔴 PASSED, NOT ASSIGNED. See `lag()`'s docstring: writing to the global here is
        # what made two un-pinnable `TAG_FLOOR = ...` statements exist in this file. A
        # probe must not leave residue in the population it measures (203 §4) — and a
        # probe that rewrites a governed constant is the sharpest form of that.
        d, why = lag(reg, tags, tag_floor=None if live_floor else 0)
        ok = 0 <= d <= LAG_CEILING
        verdict = "PASS" if ok else "REFUSE"
        # 🔴 THE REASON IS CHECKED, NOT ONLY THE NUMBER. Two different defects both
        # return -1, and a table that reads only the distance cannot tell them apart —
        # which is how zeroing TAG_FLOOR stayed green before this line existed.
        agree = (d == want_d) and (ok == want_ok) and (want_msg.lower() in why.lower())
        print(f"  {'🟢' if agree else '🔴'} {verdict:<6} lag={d:<3} want={want_d:<3} "
              f"floor={'live' if live_floor else 'off ':<4} {name}")
        if not agree:
            bad += 1
            print(f"        want {want_msg!r} · got {why!r}")
    refusals = sum(1 for r in SELFTEST if not r[5])
    floor_rows = sum(1 for r in SELFTEST if r[3])
    print(f"\n  {len(SELFTEST)} rows · {refusals} REFUSE · {floor_rows} run under the "
          f"live TAG_FLOOR · {'🟢 all agree' if not bad else f'🔴 {bad} DISAGREE'}")
    if refusals < 4 or floor_rows < 2:
        print(f"  🔴 the table has stopped proving what it exists to prove "
              f"({refusals} refusing rows, {floor_rows} floor rows) — a constant with "
              f"no refusing row is a constant nobody re-derives")
        return 1

    # 🆕 269 — the second distance, driven the same way and held to the same rule.
    print("\n  UNTAGGED — the commits no tag names, which `lag()` cannot see")
    for name, commits, tags, live_floor, want_d, want_ok, want_msg in UNTAGGED_SELFTEST:
        d, why = untagged(commits, tags, tag_floor=None if live_floor else 0)
        ok = 0 <= d <= UNTAGGED_CEILING
        verdict = "PASS" if ok else "REFUSE"
        agree = (d == want_d) and (ok == want_ok) and (want_msg.lower() in why.lower())
        print(f"  {'🟢' if agree else '🔴'} {verdict:<6} past={d:<3} want={want_d:<3} "
              f"floor={'live' if live_floor else 'off ':<4} {name}")
        if not agree:
            bad += 1
            print(f"        want {want_msg!r} · got {why!r}")
    u_refusals = sum(1 for r in UNTAGGED_SELFTEST if not r[5])
    u_floor_rows = sum(1 for r in UNTAGGED_SELFTEST if r[3])
    print(f"\n  {len(UNTAGGED_SELFTEST)} rows · {u_refusals} REFUSE · {u_floor_rows} run "
          f"under the live TAG_FLOOR · "
          f"{'🟢 all agree' if not bad else f'🔴 {bad} DISAGREE'}")
    if u_refusals < 4 or u_floor_rows < 2:
        print(f"  🔴 the untagged table has stopped proving what it exists to prove "
              f"({u_refusals} refusing rows, {u_floor_rows} floor rows)")
        return 1
    # 🔴 AND THE TWO CEILINGS MUST NOT BE ONE NUMBER, which is not pedantry. This row
    # exists because ONE reader was being read as the answer to two questions; two
    # constants that happened to be equal would invite exactly that collapse back the
    # next time somebody derived one from the other.
    if LAG_CEILING == UNTAGGED_CEILING:
        print(f"  🔴 LAG_CEILING and UNTAGGED_CEILING are both {LAG_CEILING} — they "
              f"bound populations that go stale in opposite directions, and one number "
              f"for both is how 260 happened")
        return 1
    # 🆕 279 — THE UPSTREAM SCOPE, AND THE ROW IT SHIPPED FOR IS THE FIRST FIXTURE.
    # Every row below is PURE over two readings, so none of it dials anything: 235 §6.3,
    # and the reason five hand-run readings of this question left nothing re-runnable.
    print("\n  SDK_UPSTREAM — a major on the registry the tree does not pin")
    _SDK = "@modelcontextprotocol/sdk"
    _REPO = "git+https://github.com/modelcontextprotocol/typescript-sdk.git"
    _rows = [
        {"name": _SDK, "version": "1.30.0", "links": {"repository": _REPO}},
        {"name": "@modelcontextprotocol/core", "version": "2.0.0",
         "links": {"repository": _REPO}},
        {"name": "@modelcontextprotocol/server", "version": "2.0.0",
         "links": {"repository": _REPO}},
        # 🔴 SAME SCOPE, DIFFERENT PROJECT — the join is the repository and not the scope.
        {"name": "@modelcontextprotocol/inspector", "version": "2.3.0",
         "links": {"repository": "git+https://github.com/modelcontextprotocol/inspector.git"}},
        {"name": "figma-mcp", "version": "0.1.4", "links": {}},
    ]
    _fam = siblings_of(_rows, _REPO)
    # 🆕 281 — A DEFERRAL AND THE UPSTREAM IT WAS ARGUED AGAINST. `_held` is the argument
    # in force; the rows below move exactly one thing about the world at a time and read
    # what the table says, which is the only way to know a deferral is refusable at all.
    _NONE: "dict[str, str]" = {}          # asked, and nothing is deprecated
    _held = {_SDK: {DEFER_SEEN: {n: api_coord(v) for n, v in _fam.items()},
                    DEFER_BLOCKED: ("InMemoryTaskStore",),
                    DEFER_WHY: "the fixture's argument"}}
    _patched = dict(_fam, **{"@modelcontextprotocol/core": "2.0.9"})
    _minor = dict(_fam, **{"@modelcontextprotocol/core": "2.1.0"})
    _joined = dict(_fam, **{"@modelcontextprotocol/tasks": "2.0.0"})
    # (name, pins, family, deprecated, deferred, want_ok, want_msg)
    UPSTREAM_SELFTEST = [
        ("the reading five sessions could not make", {_SDK: "^1.29.0"}, _fam, None, None,
         False, "serves major 2"),
        ("a tree already on the newest major", {_SDK: "^2.0.0"}, _fam, None, None,
         True, "none is ahead"),
        ("an exact pin reads its major the same way", {_SDK: "2.0.0"}, _fam, None, None,
         True, "none is ahead"),
        ("a range spelling reads its major the same way", {_SDK: ">=1.29.0 <2"}, _fam,
         None, None, False, "serves major 2"),
        # 🔴 UNREAD IS NOT GREEN, in both of the two directions it can be unread.
        ("a tree that pins nothing in the scope", {}, _fam, None, None, True,
         "pins nothing"),
        ("a registry that listed no sibling", {_SDK: "^1.29.0"}, {}, None, None, True,
         "no package"),
        # 🆕 281 — the deferral, and every way it stops holding.
        ("🟢 a deferral argued against THIS upstream", {_SDK: "^1.29.0"}, _fam, _NONE,
         _held, True, "DEFERRED"),
        ("🟢 a PATCH upstream does not move the argument — semver's own line",
         {_SDK: "^1.29.0"}, _patched, _NONE, _held, True, "DEFERRED"),
        ("🔴 a MINOR upstream CAN give the missing symbol a home",
         {_SDK: "^1.29.0"}, _minor, _NONE, _held, False, "has since moved"),
        ("🔴 A SIXTH SIBLING JOINED — the population the whole reader is derived over",
         {_SDK: "^1.29.0"}, _joined, _NONE, _held, False, "joined"),
        ("🔴 upstream DEPRECATED the version the deferral rests on staying at",
         {_SDK: "^1.29.0"}, _fam, {_SDK: "use @modelcontextprotocol/core"}, _held,
         False, "DEPRECATED"),
        # 🔴 THE TWO SHAPES A DEFERRAL CAN TAKE THAT ARE NOT ARGUMENTS AT ALL.
        ("🔴 a deferral that names no upstream is a memory, not a measurement",
         {_SDK: "^1.29.0"}, _fam, _NONE,
         {_SDK: {DEFER_SEEN: {}, DEFER_BLOCKED: ("InMemoryTaskStore",), DEFER_WHY: "x"}},
         False, "memory"),
        ("🔴 a deferral honoured by a run that never asked about deprecation",
         {_SDK: "^1.29.0"}, _fam, None, _held, False, "UNREAD IS NOT GREEN"),
        ("🔴 a deferral for a package the registry no longer serves from that repository",
         {_SDK: "^1.29.0"}, _fam, _NONE,
         {"@modelcontextprotocol/gone": {DEFER_SEEN: {"a": "1.0"},
                                         DEFER_BLOCKED: ("X",), DEFER_WHY: "x"}},
         False, "no longer serves"),
    ]
    u2_bad = 0
    for name, pins, fam, dep, defer, want_ok, want_msg in UPSTREAM_SELFTEST:
        probs, notes = upstream_problems(pins, fam, dep, defer)
        ok = not probs
        said = " ".join(probs + notes).lower()
        agree = (ok == want_ok) and (want_msg.lower() in said)
        print(f"  {'🟢' if agree else '🔴'} {'PASS' if ok else 'REFUSE':<6} {name}")
        if not agree:
            u2_bad += 1
            print(f"        want ok={want_ok} {want_msg!r} · got ok={ok} {said[:160]!r}")
    # The join itself, and the two shapes it has to reject.
    if sorted(_fam) != ["@modelcontextprotocol/core", "@modelcontextprotocol/sdk",
                        "@modelcontextprotocol/server"]:
        u2_bad += 1
        print(f"  🔴 siblings_of admitted the wrong population: {sorted(_fam)}")
    if repo_key(_REPO) != "github.com/modelcontextprotocol/typescript-sdk":
        u2_bad += 1
        print(f"  🔴 repo_key did not normalise the git+https spelling: {repo_key(_REPO)}")
    if major_of("^1.29.0") != 1 or major_of("") != -1 or major_of("v2.0.0") != 2:
        u2_bad += 1
        print("  🔴 major_of misread a range, an empty spec or a v-prefixed version")
    if api_coord("2.0.0") != "2.0" or api_coord("v1.30.7") != "1.30" or api_coord("") != "":
        u2_bad += 1
        print("  🔴 api_coord did not read MAJOR.MINOR off a version, a v-prefix or a blank")
    # 🔴 AND THE SHIPPED ROW IS DRIVEN, IN BOTH DIRECTIONS, over a family derived from its
    # own `seen`. The PASS alone would be close to `X == X` — 280 §5's tautology, one file
    # over — so it is the REFUSAL beside it that makes the pair evidence: the same row,
    # against a world one MINOR different, must not hold.
    for _live_name, _live_row in sorted(UPSTREAM_DEFERRED.items()):
        _seen = _live_row.get(DEFER_SEEN) or {}
        _as_argued = {n: f"{c}.0" for n, c in _seen.items()}
        _one_minor = dict(_as_argued)
        _first = sorted(_as_argued)[0]
        _mj, _mn = api_coord(_as_argued[_first]).split(".")
        _one_minor[_first] = f"{_mj}.{int(_mn) + 1}.0"
        _p_hold, _n_hold = upstream_problems({_SDK: "^1.29.0"}, _as_argued, _NONE,
                                             {_live_name: _live_row})
        _p_move, _ = upstream_problems({_SDK: "^1.29.0"}, _one_minor, _NONE,
                                       {_live_name: _live_row})
        if _p_hold or not any("DEFERRED" in n for n in _n_hold):
            u2_bad += 1
            print(f"  🔴 the SHIPPED deferral for {_live_name} does not hold against the "
                  f"upstream it names: {' '.join(_p_hold)[:160]}")
        if not _p_move:
            u2_bad += 1
            print(f"  🔴 the SHIPPED deferral for {_live_name} survived a MINOR moving "
                  f"under it — a deferral nothing can refuse is not an argument")
        if not (_live_row.get(DEFER_BLOCKED) and _live_row.get(DEFER_WHY)):
            u2_bad += 1
            print(f"  🔴 the deferral for {_live_name} names no blocking symbol or no "
                  f"reason — the two things a reader of this table needs to re-argue it")
    u2_refusals = sum(1 for r in UPSTREAM_SELFTEST if not r[5])
    print(f"\n  {len(UPSTREAM_SELFTEST)} rows · {u2_refusals} REFUSE · "
          f"{'🟢 all agree' if not u2_bad else f'🔴 {u2_bad} DISAGREE'}")
    bad += u2_bad

    print(f"\nREGISTRY_LAG_SELFTEST {len(SELFTEST) + len(UNTAGGED_SELFTEST) + len(UPSTREAM_SELFTEST)} "
          f"rows · {refusals + u_refusals + u2_refusals} REFUSE")
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--selftest", action="store_true",
                    help="drive the pure reader over its table; no network")
    ap.add_argument("--upstream", action="store_true",
                    help="the upstream-major reading ALONE, for a workflow whose subject "
                         "is upstream and not this repository's own release state")
    ap.add_argument("--offline-declared", action="store_true",
                    help="record on the record that the registry was unreachable "
                         "and the cut proceeded anyway")
    a = ap.parse_args()

    if a.selftest:
        print("REGISTRY_LAG selftest — the ceiling's refusal, proved without network")
        return selftest()

    # 🆕 279 — THE UPSTREAM READING GOES FIRST, AND THAT ORDER IS THE POINT.
    # Every refusal below returns immediately, so a reading placed after them is a reading
    # that only ever prints on a healthy tree — and this tree is not healthy today: it is
    # eleven commits past its newest tag, which returns 1 before the last line of this
    # function. 199 §9.2 and 277 §1.2 are the same finding twice: a gate that dies partway
    # reports only the failures it reached. This one reports before it can die.
    up_bad, up_notes = upstream_reading()
    for line in up_notes:
        print(f"              {line}")
    for line in up_bad:
        print(f"\n{line}", file=sys.stderr)

    # 🆕 279 — AND IT IS AVAILABLE ALONE, because the two subjects are different worlds.
    # `sdk-drift.yml` asks what UPSTREAM has done; the ceilings below ask what THIS
    # repository owes its own registry. Running the whole command there would redden the
    # early-warning workflow every time a release is owed, which is a check that trains
    # people to ignore it — the argument `python3 registry_lag.py`'s own `REPLAY_CI_EXEMPT`
    # row already makes about `ci.yml`, one workflow over.
    if a.upstream:
        return 1 if up_bad else 0

    local = local_version()
    reg = registry_version()
    if reg is None:
        if a.offline_declared:
            print(f"REGISTRY_LAG  ⚠️  DECLARED OFFLINE — registry unreachable, cut "
                  f"proceeding on a human's declaration. local {local}. "
                  f"🔴 Re-run `python3 scripts/registry_lag.py` before publishing.")
            return 0
        print(f"REGISTRY_LAG  🔴 REFUSED — could not reach the npm registry.\n"
              f"  This is RED and not a skip, on purpose. The 42-session publish "
              f"blocker was a command whose error got written down as a standing\n"
              f"  decision instead of being re-run (205 §3, §8.24). A reader that "
              f"goes quiet when it cannot see is how that happens.\n"
              f"  Fix the network, or pass --offline-declared to put the claim on "
              f"the record in this release commit.", file=sys.stderr)
        return 1

    d, why = lag(reg, git_tags())
    print(f"REGISTRY_LAG  local {local} · registry {reg} · ceiling {LAG_CEILING}")
    print(f"              distance {d} — {why}")
    if d < 0:
        print(f"\n🔴 REGISTRY_LAG REFUSED: {why}", file=sys.stderr)
        return 1
    if d > LAG_CEILING:
        print(f"\n🔴 REGISTRY_LAG REFUSED — {d} unpublished tag(s), ceiling is "
              f"{LAG_CEILING}.\n"
              f"  This repository has cut {d} releases the registry has never seen. "
              f"That is the 205 §3 failure in progress:\n"
              f"  the gap grows silently, the staged addon fossilises at the last "
              f"publish, and checks built around the\n"
              f"  consequences start costing more than the publish would have. "
              f"`cd host && npm publish` (let it prompt for the\n"
              f"  OTP — `prepublishOnly` takes ~18 s and burns an inline --otp "
              f"window), or raise LAG_CEILING ON PURPOSE.", file=sys.stderr)
        return 1
    print(f"              🟢 within ceiling")

    # 🆕 269 — AND THE OTHER DISTANCE, ALWAYS PRINTED, WHETHER OR NOT IT REFUSES. That is
    # the whole of what 260 was missing: `lag` said 🟢 twice around a publish that shipped
    # a tree four commits past its own tag, and no line anywhere carried the four. A
    # number printed beside the one it is mistaken for is what stops the mistake.
    n, problem = head_past_newest_tag()
    if problem:
        print(f"\n🔴 REGISTRY_LAG REFUSED — {problem}", file=sys.stderr)
        return 1
    u, u_why = untagged(n, git_tags())
    print(f"              untagged {u} · ceiling {UNTAGGED_CEILING} — {u_why}")
    if u < 0:
        print(f"\n🔴 REGISTRY_LAG REFUSED: {u_why}", file=sys.stderr)
        return 1
    if u > UNTAGGED_CEILING:
        print(f"\n🔴 REGISTRY_LAG REFUSED — {u} commit(s) past the newest tag, ceiling "
              f"is {UNTAGGED_CEILING}.\n"
              f"  `lag` above cannot see these: it counts TAGS the registry has not "
              f"got, so work that was never tagged is invisible to it\n"
              f"  in both directions — 🟢 before a publish that shipped it and 🟢 after "
              f"(260). Cut and tag a release, or raise\n"
              f"  UNTAGGED_CEILING ON PURPOSE. Do not read the green above as an answer "
              f"to this question.", file=sys.stderr)
        return 1
    print("              🟢 within untagged ceiling")
    return 1 if up_bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
