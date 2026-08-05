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
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--selftest", action="store_true",
                    help="drive the pure reader over its table; no network")
    ap.add_argument("--offline-declared", action="store_true",
                    help="record on the record that the registry was unreachable "
                         "and the cut proceeded anyway")
    a = ap.parse_args()

    if a.selftest:
        print("REGISTRY_LAG selftest — the ceiling's refusal, proved without network")
        return selftest()

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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
