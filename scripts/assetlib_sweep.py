#!/usr/bin/env python3
"""Godot Asset Library sweep for AI / MCP entries.

Keeps the tracked roster of alternative MCP servers honest in two directions:

  ROSTER LEG      every entry we already track is re-read from the live API and
                  compared against the version/date recorded when it was last
                  analysed at source level.  Entries that did not move are
                  reported as `no change` WITH the evidence that says so; entries
                  that moved are reported as owing a source-level pass.

  DISCOVERY LEG   keyword queries against the live API surface every AI/MCP-shaped
                  entry.  Anything not already in the roster is reported as NEW.
                  This is the leg that stops manual monitoring from missing things.

The population is defined by the live query, not by a roster somebody curated —
the roster is only used to SUBTRACT what is already tracked.  A product added to
the roster shrinks the NEW list automatically; it can never grow the population.

Whatever the relevance filter drops is printed as a number on every run, so an
exclusion is something a reader can argue with rather than something nobody sees.

  SOURCE LEG      Rule 2 defines *no change* with two clauses, and the second one is the
                  repository head. An entry whose Asset Library card has not been
                  re-published can still have travelled a long way, so this leg reads the
                  forge and compares the head against `last_analysed_commit`.

Usage:
    python3 scripts/assetlib_sweep.py                 # human-readable report
    python3 scripts/assetlib_sweep.py --json          # machine-readable
    python3 scripts/assetlib_sweep.py --check         # exit 1 if roster is stale
    python3 scripts/assetlib_sweep.py --selftest      # offline; drives the pure readers
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

API = "https://godotengine.org/asset-library/api"
ROSTER = os.path.join(os.path.dirname(__file__), "..", "docs", "alternative_mcp_roster.json")

# Our own Asset Library entry.  Excluded from discovery for the obvious reason, and
# named here rather than filtered by title so a rename cannot silently re-admit us.
SELF_ASSET_ID = 5335

# Discovery keywords.  `mcp` is the high-signal one; the rest are broad and are
# expected to pull in noise, which the relevance filter below removes and counts.
KEYWORDS = ["mcp", "ai", "agent", "llm", "claude", "copilot", "assistant"]

# Asset Library `filter=` matches substrings, so `ai` alone hits "Terrain",
# "Container", "Maid" and friends.  An entry is relevant when its title or
# description carries a whole-word AI/MCP signal.
RELEVANT = re.compile(
    r"\b(mcp|model context protocol|llm|claude|chatgpt|gpt-?[45]|gemini|copilot|"
    r"anthropic|openai|ai agent|ai assistant|agentic|language model)\b",
    re.IGNORECASE,
)

# Within the relevant set, entries that look like MCP servers are the ones that owe a
# source-level pass.  The rest are in-editor AI addons — recorded on the roster, but a
# chat plugin is not a control plane and should not read as urgent.  Splitting the two
# is what keeps the NEW list actionable rather than merely long.
MCP_SHAPED = re.compile(
    r"\b(mcp|model context protocol|tool server|agent bridge|ai agent)\b", re.IGNORECASE
)

# Godot versions to query.  An entry declaring only 4.3 is invisible to a 4.4
# query, which is how tracked entries have gone missing from `filter=mcp` before.
GODOT_VERSIONS = ["4.5", "4.4", "4.3", "4.2"]


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "breakpoint-mcp-sweep"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def load_roster() -> dict:
    with open(os.path.normpath(ROSTER), encoding="utf-8") as f:
        return json.load(f)


def discover() -> tuple[dict[int, dict], int, int]:
    """Return (relevant_by_id, seen_total, dropped_by_filter)."""
    seen: dict[int, dict] = {}
    for kw in KEYWORDS:
        for gv in GODOT_VERSIONS:
            url = f"{API}/asset?filter={kw}&godot_version={gv}&max_results=500&type=addon"
            try:
                page = get(url)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                print(f"  ! query {kw}/{gv} failed: {e}", file=sys.stderr)
                continue
            for a in page.get("result", []):
                seen.setdefault(int(a["asset_id"]), a)
    seen.pop(SELF_ASSET_ID, None)
    relevant = {
        i: a
        for i, a in seen.items()
        if RELEVANT.search(f"{a.get('title','')} {a.get('description','')}")
    }
    return relevant, len(seen), len(seen) - len(relevant)



def our_pending_edits() -> list[dict]:
    """Edits we have SUBMITTED for our own asset that the library has not accepted yet.

    🔴 225 — THE READING NINE SESSIONS OF HANDOFFS COULD NOT MAKE. `/asset/{id}` serves
    the ACCEPTED version and nothing else, so a submitted-and-pending edit is
    byte-indistinguishable from never having submitted one. Sessions 217 through 224 each
    re-read the live entry, each correctly saw 1.9.8, and each concluded the card had not
    been submitted — the last of them printing "NINTH SESSION RUNNING" on a day when edit
    23974 had been sitting in the queue since 2026-08-09 22:09:03.

    Nobody was careless. **The instrument could not see the state it was being asked
    about**, and prose filled the gap — 224 §7.15's finding, arriving in the one place
    that session did not look. `/asset/edit?asset={id}` is the endpoint that can see it.

    Failure is not fatal: this is a courtesy reading about our own submission, and a
    sweep that dies because one extra endpoint moved would be worse than one that says
    it could not look.
    """
    try:
        res = get(f"{API}/asset/edit?asset={SELF_ASSET_ID}&status=new")
    except Exception as e:                        # noqa: BLE001 — see the docstring
        return [{"error": str(e)}]
    return [
        {"edit_id": e.get("edit_id"), "submitted": e.get("submit_date"),
         "version": e.get("version_string") or "(unchanged)", "status": e.get("status", "new")}
        for e in res.get("result", [])
    ]


# 🆕 279 — RULE 2 HAS TWO CLAUSES AND THIS FILE HAS ONLY EVER READ ONE.
#
# `docs/LANDSCAPE_TRACKING_POLICY.md` Rule 2 defines *no change* as: the live version and
# modify date match what the roster recorded, AND **the repository HEAD has not moved
# since `last_analysed`**. The second clause was never implemented, so an entry whose
# Asset Library card had not been re-published read as `no change` however far its source
# had travelled.
#
# 🔴 IT COST EXACTLY WHAT RULE 2 WAS WRITTEN TO STOP, TO THE SAME PROJECT. Rule 2's own
# "Why" records that the 2026-08-09 sweep found a carried project had shipped a debugger
# 48 hours after the document saying the category could not. `godot-mcp-enhanced` shipped
# an interactive debugger at 6394ddb on 2026-08-09 — one day after the commit the roster
# pinned as its last source-level pass — and its Asset Library card did not move until
# 2026-08-22. For thirteen days this sweep reported it as `no change`, with the evidence,
# and the evidence was about the card.
#
# The reading is a courtesy in the same sense `our_pending_edits` is: a forge that will
# not answer is reported UNREAD and never as `held`, because a reader's silence is not an
# answer (271 §1).
REPO_UNREAD = "unread"
GH_API = "https://api.github.com"


def repo_head(slug: str) -> "tuple[str, str]":
    """(sha, problem) for a `owner/name` slug's default-branch tip. Never raises."""
    if not slug:
        return ("", "no repository recorded for this entry")
    try:
        res = get(f"{GH_API}/repos/{slug}/commits?per_page=1")
    except Exception as e:                        # noqa: BLE001 — see the block above
        return ("", f"{slug}: {e}")
    rows = res if isinstance(res, list) else res.get("result") or []
    if not rows:
        return ("", f"{slug}: the forge listed no commit for the default branch")
    return (str(rows[0].get("sha") or "")[:7], "")


def repo_heads(tracked: "dict[int, dict]") -> "dict[int, tuple[str, str]]":
    """{asset_id: (head sha, problem)} — NETWORK. One call per entry that names a repo."""
    return {aid: repo_head(str(e.get("repo") or ""))
            for aid, e in sorted(tracked.items()) if e.get("repo")}


def source_state(entry: dict, head: "tuple[str, str]") -> "tuple[str, str]":
    """(state, detail) for Rule 2's SECOND clause — PURE, so both directions are drivable
    from a fixture and neither needs a network.

    Three answers and not two: `held`, `moved`, and `unread`. A pass that recorded no
    commit at all is `unread` with that as its reason — an entry nobody has ever analysed
    at source level cannot be said to have moved since a pass that did not happen.
    """
    was = str(entry.get("last_analysed_commit") or "")
    sha, prob = head if head else ("", "the repository head was not read on this run")
    if prob:
        return (REPO_UNREAD, prob)
    if not was:
        return (REPO_UNREAD, "no `last_analysed_commit` recorded, so there is no commit "
                             "to compare the repository head against")
    if sha.startswith(was[:7]) or was.startswith(sha[:7]):
        return ("held", sha)
    return ("moved", f"{was} -> {sha}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--check", action="store_true", help="exit 1 when the roster is stale")
    ap.add_argument("--selftest", action="store_true",
                    help="drive every classification off fixtures — offline, no network")
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    roster = load_roster()
    tracked = {e["asset_id"]: e for e in roster["entries"] if e.get("asset_id")}

    heads = repo_heads(tracked)

    moved, held, gone, src_moved, src_unread = [], [], [], [], []
    for aid, entry in sorted(tracked.items()):
        try:
            live = get(f"{API}/asset/{aid}")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            gone.append({**entry, "error": str(e)})
            continue
        row = {
            "asset_id": aid,
            "name": entry["name"],
            "recorded_version": entry.get("assetlib_version"),
            "live_version": live.get("version_string"),
            "recorded_modify": entry.get("assetlib_modify_date"),
            "live_modify": (live.get("modify_date") or "")[:10],
            "last_analysed": entry.get("last_analysed"),
        }
        same = row["recorded_version"] == row["live_version"] and \
            row["recorded_modify"] == row["live_modify"]
        (held if same else moved).append(row)

        state, detail = source_state(entry, heads.get(aid, ()))
        if state == "moved":
            src_moved.append({**row, "repo": entry.get("repo"), "head": detail,
                              "card_held": same})
        elif state == REPO_UNREAD and entry.get("repo"):
            src_unread.append({**row, "repo": entry.get("repo"), "why": detail})

    pending = our_pending_edits()

    relevant, seen_total, dropped = discover()
    new = {i: a for i, a in relevant.items() if i not in tracked}

    def shaped(a: dict) -> bool:
        return bool(MCP_SHAPED.search(f"{a.get('title','')} {a.get('description','')}"))

    new_mcp = {i: a for i, a in new.items() if shaped(a)}
    new_ai = {i: a for i, a in new.items() if not shaped(a)}

    result = {
        "tracked": len(tracked),
        "no_change": held,
        "moved": moved,
        "source_moved": src_moved,
        "source_unread": src_unread,
        "unreachable": gone,
        "new_mcp_shaped": [
            {
                "asset_id": i,
                "title": a.get("title"),
                "author": a.get("author"),
                "version": a.get("version_string"),
                "modify_date": (a.get("modify_date") or "")[:10],
            }
            for i, a in sorted(new_mcp.items())
        ],
        "new_ai_addons": [
            {
                "asset_id": i,
                "title": a.get("title"),
                "author": a.get("author"),
                "version": a.get("version_string"),
                "modify_date": (a.get("modify_date") or "")[:10],
            }
            for i, a in sorted(new_ai.items())
        ],
        "discovery_seen": seen_total,
        "discovery_dropped_as_irrelevant": dropped,
        "keywords": KEYWORDS,
        "godot_versions": GODOT_VERSIONS,
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Asset Library sweep — {len(tracked)} tracked entr(ies)")
        print(f"  no change            : {len(held)}")
        print(f"  moved since analysis : {len(moved)}")
        print(f"  SOURCE moved         : {len(src_moved)}   "
              f"<- Rule 2 clause two; {sum(1 for r in src_moved if r['card_held'])} of "
              f"them the card leg alone reports as no change")
        print(f"  source head UNREAD   : {len(src_unread)}")
        print(f"  unreachable          : {len(gone)}")
        print(f"  NEW, MCP-shaped      : {len(new_mcp)}   <- owe a source-level pass")
        print(f"  NEW, in-editor AI    : {len(new_ai)}   <- record on the roster")
        print(
            f"  …not covered         : {dropped} of {seen_total} discovery hit(s) "
            f"dropped as not AI/MCP-related"
        )
        print(
            f"  queried              : {len(KEYWORDS)} keyword(s) × "
            f"{len(GODOT_VERSIONS)} Godot version(s)"
        )
        for r in moved:
            print(
                f"    MOVED  {r['asset_id']:>5}  {r['name']}: "
                f"{r['recorded_version']} ({r['recorded_modify']}) -> "
                f"{r['live_version']} ({r['live_modify']}) "
                f"· last source-level pass {r['last_analysed']}"
            )
        for r in result["new_mcp_shaped"]:
            print(
                f"    NEW/MCP {r['asset_id']:>5}  {r['title']} — {r['author']} "
                f"v{r['version']} ({r['modify_date']})"
            )
        for r in result["new_ai_addons"]:
            print(
                f"    new/ai  {r['asset_id']:>5}  {r['title']} — {r['author']} "
                f"v{r['version']} ({r['modify_date']})"
            )
        for r in src_moved:
            print(f"    SRC     {r['asset_id']:>5}  {r['name']}: {r['repo']} {r['head']}"
                  + ("  🔴 the card leg calls this no change" if r["card_held"] else ""))
        for r in src_unread:
            print(f"    SRC ?   {r['asset_id']:>5}  {r['name']}: {r['why']}")
        for r in gone:
            print(f"    UNREACHABLE {r['asset_id']}  {r['name']}: {r['error']}")
        for r in pending:
            if "error" in r:
                print(f"    PENDING ?   could not read our own edit queue: {r['error']}")
            else:
                print(
                    f"    PENDING {r['edit_id']}  our asset {SELF_ASSET_ID}: submitted "
                    f"{r['submitted']} · {r['version']} · awaiting review — the live entry "
                    f"will keep serving the OLD version until this is accepted"
                )
        if not pending:
            print(f"    (no edit pending on our own asset {SELF_ASSET_ID})")

    # 🆕 279 — `new_ai` JOINS THE REFUSAL, AND THE ROSTER'S OWN CONTRACT IS WHY.
    #
    # 🔴 THIS FILE PRINTED `<- record on the roster` BESIDE FOURTEEN ENTRIES AND NOTHING
    # HAS EVER REFUSED WHEN NOBODY DID. The roster's first line of `_comment` says it holds
    # *every product that has appeared in any prior sweep* and that *an entry is never
    # dropped*; an in-editor AI addon the discovery leg has surfaced HAS appeared in a
    # sweep. So the population that must be on the roster was already defined, in the
    # roster, and the check read a narrower one — 278's *a claim in a comment is still a
    # claim* with the reader arriving one file later.
    #
    # This is deliberately NOT a new severity. Recording an in-editor AI addon costs one
    # roster row and no source-level pass (Rule 1: it opens no socket and cannot be driven
    # by an MCP client), so the refusal asks for the cheap thing the roster already
    # promises rather than for the expensive thing only an MCP-shaped entry owes.
    #
    # `source_unread` is a NOTE and never a refusal — 271 §1, and the same reason
    # `our_pending_edits` reports rather than dies: a sweep on a machine the forge will
    # not answer must still be able to run, or the check becomes a statement about
    # connectivity.
    stale = []
    if moved:
        stale.append(f"{len(moved)} tracked entr(ies) moved")
    if src_moved:
        stale.append(f"{len(src_moved)} tracked repositor(ies) moved since their last "
                     f"source-level pass (Rule 2 clause two)")
    if new_mcp:
        stale.append(f"{len(new_mcp)} never-tracked MCP-shaped entr(ies) found")
    if new_ai:
        stale.append(f"{len(new_ai)} never-recorded in-editor AI addon(s) found")
    if args.check and stale:
        print("\nROSTER STALE: " + ", ".join(stale)
              + ".\n  The moved entries owe a source-level pass; the in-editor AI addons "
                "owe a roster row and nothing more.",
              file=sys.stderr)
        return 1
    return 0


# ── 🆕 279 — THE OFFLINE HALF, AND THE COMMENT THAT ALREADY CLAIMED IT EXISTED ─────────
#
# 🔴 `sdk-drift.yml` SAYS *"The OFFLINE halves of both are merge-blocking in ci.yml"* ABOUT
# THIS FILE AND `spec_conformance.py`. It was true of one of them. `spec_conformance.py
# --check` runs in `ci.yml`; this file had no offline command at all, so its only reader
# was a weekly `schedule:` job — which is how `--check` stayed red from 2026-08-17 to
# 2026-08-24 with two sessions closing 🟢 *nothing owed* over the top of it.
#
# Every case below drives the PURE readers over fixtures. There is no network in this
# function and there is no roster read either: a self-test that dials is a statement about
# the machine (235 §6.3).
def selftest() -> int:
    claims, bad = 0, 0

    def claim(label: str, got, want) -> None:
        nonlocal claims, bad
        claims += 1
        if got != want:
            bad += 1
            print(f"  🔴 {label}: got {got!r}, want {want!r}")

    # ── `source_state` — Rule 2's second clause, all three answers ───────────────────
    claim("held: recorded commit is the head",
          source_state({"last_analysed_commit": "9ff512b"}, ("9ff512b", "")), ("held", "9ff512b"))
    claim("held: recorded short sha prefixes a longer head",
          source_state({"last_analysed_commit": "9ff512b"}, ("9ff512b0", ""))[0], "held")
    claim("moved: the head is a different commit",
          source_state({"last_analysed_commit": "8b56302"}, ("9609b06", "")),
          ("moved", "8b56302 -> 9609b06"))
    claim("unread: the forge would not answer",
          source_state({"last_analysed_commit": "8b56302"}, ("", "boom"))[0], REPO_UNREAD)
    claim("unread: nothing was ever analysed at source level",
          source_state({"last_analysed_commit": None}, ("9609b06", ""))[0], REPO_UNREAD)
    claim("unread: no head was read on this run",
          source_state({"last_analysed_commit": "8b56302"}, ())[0], REPO_UNREAD)

    # 🔴 THE POSITIVE CONTROL FOR THE DEFECT THIS SHIPPED FOR. The card leg compares the
    # Asset Library reading; the entry below is `godot-mcp-enhanced` as the roster carried
    # it between 2026-08-10 and 2026-08-17 — card unmoved, source thirteen days ahead. The
    # card comparison says `held` and Rule 2's second clause says `moved`, and only one of
    # them was ever read.
    _card_held = ("0.26.0" == "0.26.0" and "2026-08-09" == "2026-08-09")
    claim("the 2026-08-09 recurrence: the card leg holds", _card_held, True)
    claim("the 2026-08-09 recurrence: the source leg moves",
          source_state({"last_analysed_commit": "8b56302"}, ("6394ddb", ""))[0], "moved")

    # ── `repo_head` refuses rather than raising, on every shape the forge can return ──
    claim("repo_head: no slug recorded", repo_head("")[0], "")
    claim("repo_head: no slug recorded says why", bool(repo_head("")[1]), True)

    # ── the relevance and shape filters, which decide what the refusal counts ────────
    claim("RELEVANT matches a whole-word MCP signal",
          bool(RELEVANT.search("Godot MCP server")), True)
    claim("RELEVANT does not match `ai` inside a word",
          bool(RELEVANT.search("Terrain container maid")), False)
    claim("MCP_SHAPED splits a server from a chat addon",
          (bool(MCP_SHAPED.search("Godot MCP/CLI")),
           bool(MCP_SHAPED.search("Claude 3.5 Sonnet Chat API"))), (True, False))
    claim("an in-editor AI addon is RELEVANT and not MCP_SHAPED",
          (bool(RELEVANT.search("Claude 3.5 Sonnet Chat API")),
           bool(MCP_SHAPED.search("Claude 3.5 Sonnet Chat API"))), (True, False))

    # ── our own entry can never re-enter discovery under a rename ────────────────────
    claim("SELF_ASSET_ID is named, not title-matched", SELF_ASSET_ID, 5335)

    print(f"ASSETLIB_SELFTEST {claims - bad}/{claims} claims, {bad} failed")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
