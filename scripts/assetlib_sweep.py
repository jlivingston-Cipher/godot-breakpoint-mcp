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

Usage:
    python3 scripts/assetlib_sweep.py                 # human-readable report
    python3 scripts/assetlib_sweep.py --json          # machine-readable
    python3 scripts/assetlib_sweep.py --check         # exit 1 if roster is stale
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--check", action="store_true", help="exit 1 when the roster is stale")
    args = ap.parse_args()

    roster = load_roster()
    tracked = {e["asset_id"]: e for e in roster["entries"] if e.get("asset_id")}

    moved, held, gone = [], [], []
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
        for r in gone:
            print(f"    UNREACHABLE {r['asset_id']}  {r['name']}: {r['error']}")

    if args.check and (moved or new_mcp):
        print(
            f"\nROSTER STALE: {len(moved)} tracked entr(ies) moved, "
            f"{len(new_mcp)} never-tracked MCP-shaped entr(ies) found. "
            f"Both owe a source-level pass at the next sweep.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
