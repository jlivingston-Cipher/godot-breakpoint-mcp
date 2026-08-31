#!/usr/bin/env python3
"""Landscape sweep for alternative Godot MCP servers, over every channel they ship in.

🔴 THE FILENAME RECORDS THE FIRST CHANNEL, NOT THE POPULATION, AND 291 KEPT IT ON PURPOSE.
This reader was built in 223 against one host — godotengine.org's Asset Library — because
that is where Godot ADDONS are published. It is therefore structurally blind to a project
that ships as an npm package, registers in the official MCP Registry, or sells from its own
site, and it has been reporting a MEASURED green about a population that never contained
them. The name is referenced by fourteen files including two workflows and four gate
rosters; renaming it is a blast radius with no reader behind it, so the correction is
written HERE, where anyone who opens the file reads it before the first line of code.

🔴 WHAT THAT BLINDNESS COST, MEASURED AT 291. Three channels queried on one afternoon
surfaced FIFTY projects this roster had never held — against forty-five entries and
twenty-six repository slugs it had. One of them, `Coding-Solo/godot-mcp`, has 5,399 stars:
roughly 2.8x `hi-godot/godot-ai` at 1,954, which the roster and two published analyses both
call *the clear popularity leader*. That claim was wrong for as long as it was made, and no
amount of health in the Asset Library leg could ever have said so. Rule 3 of
`docs/LANDSCAPE_TRACKING_POLICY.md` had already written the sentence that explains it —
**a gate that reads a roster is a gate over a population somebody chose** — and somebody
chose one host.

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

  CHANNEL LEGS    🆕 291 — the discovery leg above, run once per CHANNEL. `CHANNELS` below
                  declares each one, what it enumerates, and whether it can be enumerated
                  mechanically at all. A channel that answers is READ; a channel whose every
                  query failed is UNREAD and is never reported as *nothing new*, which is
                  the distinction this file did not have and §3.5 of the 2026-08-27 analysis
                  asked for by name.

Usage:
    python3 scripts/assetlib_sweep.py                 # human-readable report
    python3 scripts/assetlib_sweep.py --json          # machine-readable
    python3 scripts/assetlib_sweep.py --check         # exit 1 if roster is stale
    python3 scripts/assetlib_sweep.py --emit          # the world-facing readings, one per line
    python3 scripts/assetlib_sweep.py --census        # OFFLINE; the roster's shape, no network
    python3 scripts/assetlib_sweep.py --selftest      # offline; drives the pure readers
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
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

# ── 🆕 291 — THE CHANNELS, AND THE POPULATION DECISION TAKEN WITH THEM ────────────────
#
# 🔴 A CHANNEL IS A PLACE A PROJECT CAN SHIP, AND THE ROSTER'S POPULATION IS THE UNION OF
# WHAT THEY ENUMERATE — not what one of them does. Each row below says what the channel
# serves, whether a machine can enumerate it AT ALL, and why. `enumerable: False` is a
# first-class answer and not an omission: a closed-source product sold from its own site
# cannot be surfaced by any query, so it is WATCHED by name and marked unverifiable at
# source, which stops every later sweep re-litigating whether the leg is broken.
NPM_SEARCH = "https://registry.npmjs.org/-/v1/search"
MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0/servers"

CHANNELS: "dict[str, dict]" = {
    "assetlib": {
        "enumerable": True,
        "serves": "Godot addons published to godotengine.org's Asset Library",
        "why": "where Godot addons are published — the original and, until 291, the only "
               "channel this roster's population was drawn from",
    },
    "npm": {
        "enumerable": True,
        "serves": "packages on registry.npmjs.org whose name or description carries both "
                  "a whole-word `godot` and a whole-word MCP signal",
        "why": "the channel the category's most-starred project ships in, and the one the "
               "Asset Library can never see: an npm-only server publishes no addon, so it "
               "was never in the query",
    },
    "mcp-registry": {
        "enumerable": True,
        "serves": "servers published to the official MCP Registry under any namespace, "
                  "filtered to those naming Godot",
        "why": "a publication act rather than a popularity proxy — a project here has "
               "declared itself an MCP server to the protocol's own index, and the index "
               "is queryable, which is the whole of what a discovery leg needs",
    },
    "commercial": {
        "enumerable": False,
        "serves": "closed-source and hosted products sold from their own sites",
        "why": "🔴 NO QUERY CAN ENUMERATE THIS. A product with no package, no registry "
               "entry and no readable source is reachable only by somebody naming it, so "
               "this channel is a WATCH LIST and its rows are marked `source_verifiable: "
               "false`. Declaring that is the difference between a leg that is absent and "
               "a leg that is broken — 271 §1's rule, applied to a channel instead of to "
               "a reading.",
        "watch": ["3ddelano/gdai-mcp-plugin-godot", "summer-engine"],
    },
}

# 🔴 OUR OWN PACKAGE, NAMED RATHER THAN TITLE-MATCHED, for `SELF_ASSET_ID`'s reason one
# channel over: a rename must not be able to re-admit us to our own discovery leg.
SELF_NPM = "breakpoint-mcp"
SELF_SLUG = "jlivingston-cipher/godot-breakpoint-mcp"

# 🔴 REPUBLISHING SCOPES. `@iflow-mcp/`, `@mseep/` and `@fastmcp-me/` are aggregators that
# re-publish OTHER people's servers under their own scope — thirteen of the sixty-eight
# relevant npm packages at 291 were copies of servers already in the list. A copy is not a
# project: counted as one it double-counts the category, and dropped outright it loses the
# three upstreams that appear on npm ONLY through a mirror. So a mirrored package is kept,
# folded onto its upstream repository when it declares one, and marked `via: republisher`
# when it does not — a row that says *this was surfaced through a mirror* rather than a row
# that quietly claims the mirror is the origin.
NPM_REPUBLISHERS = ("@iflow-mcp/", "@mseep/", "@fastmcp-me/")

# The npm search is fuzzy — `text=godot mcp` returns 250 objects of which most are neither.
# Relevance here is the conjunction, because either word alone is noise on this channel:
# `mcp` matches every MCP server ever published and `godot` matches game assets.
NPM_GODOT = re.compile(r"\bgodot\b", re.IGNORECASE)
NPM_MCP = re.compile(r"\b(mcp|model context protocol)\b", re.IGNORECASE)

CHANNEL_READ = "read"
CHANNEL_PARTIAL = "partial"
CHANNEL_UNREAD = "unread"


def repo_slug(url: str) -> str:
    """`owner/name`, lowercased, from any GitHub URL shape — PURE. The join key that lets
    one project surfaced by three channels be one row rather than three.

    🔴 EMPTY IS AN ANSWER AND NOT A FAILURE. A package with no repository link, or one
    hosted somewhere that is not GitHub, has no slug to join on; the caller keys it by its
    package name instead and the row says which. Returning the raw URL here would make two
    spellings of one repository — `git+https://…​.git` and `https://…` — two projects.

    🔴 AND IT NORMALISES THE ROSTER'S OWN SPELLING TOO, WHICH IS THE HALF THAT BIT FIRST.
    `docs/alternative_mcp_roster.json` has stored `repo` as a BARE `owner/name` since 223
    while both new registries serve URLs, so a key function that only understood URLs
    answered `""` for every entry this roster has ever analysed — and a comparison against
    a set of empty strings agrees with nothing and refuses nothing. Found by
    `SURFACED_PROMOTED`'s own negative control on the first run, which is what that control
    is for.
    """
    if not url:
        return ""
    if "://" in url or "@" in url:
        m = re.search(r"github\.com[/:]([^/]+/[^/.]+)", url)
        return m.group(1).lower() if m else ""
    return url.lower() if re.fullmatch(r"[^/\s]+/[^/\s]+", url) else ""


def channel_state(attempted: int, failed: int, enumerable: bool = True
                  ) -> "tuple[str, str]":
    """(state, detail) for one discovery channel — PURE, so all four answers are drivable
    from a fixture and none of them needs a network.

    🔴 THIS IS THE READER THE FILE DID NOT HAVE, AND ITS ABSENCE IS THE DEFECT. `discover()`
    printed `! query kw/gv failed` to stderr and CONTINUED, so a run where godotengine.org
    refused every query produced an empty NEW list — byte-indistinguishable from a run that
    looked at everything and found nothing. `--check` then exited 0 and the sweep reported a
    measured green about a population it had not read a single row of. 271 §1 is the rule
    being applied: **a reader's silence is not an answer.**

    🔵 AND `partial` IS A THIRD ANSWER FOR THE SAME REASON `unread` IS A THIRD ANSWER IN
    `source_state`. Nine of ten queries answering is not *read* — the tenth may be the one
    holding the entry nobody has seen — and it is not *unread* either, because the nine that
    answered are real evidence. Naming it is what lets a caller decide, rather than having
    the decision made for it by a count that rounds.
    """
    if not enumerable:
        return (CHANNEL_UNREAD, "not mechanically enumerable — this channel is a declared "
                                "watch list and no query can grow it")
    if attempted <= 0:
        return (CHANNEL_UNREAD, "no query was attempted on this channel")
    if failed >= attempted:
        return (CHANNEL_UNREAD, f"all {attempted} quer(ies) failed — this channel was not "
                                f"read, and an empty result from a channel nobody could "
                                f"reach is not `nothing new`")
    if failed:
        return (CHANNEL_PARTIAL, f"{failed} of {attempted} quer(ies) failed — the rows below "
                                 f"are what the surviving {attempted - failed} returned")
    return (CHANNEL_READ, f"{attempted} quer(ies), all answered")


def npm_relevant(objects: "list[dict]") -> "tuple[list[dict], int, int]":
    """(rows, dropped_as_irrelevant, dropped_as_self) over npm search objects — PURE.

    Each row is the shape the fold below joins on: `{slug, npm, version, published,
    description, via}`. The relevance filter is the conjunction of `NPM_GODOT` and
    `NPM_MCP` over the package name and description together, and what it drops is counted
    and printed on every run — 223's rule, unchanged, one channel over.
    """
    rows, dropped, self_dropped = [], 0, 0
    for o in objects:
        p = o.get("package") or o
        name = str(p.get("name") or "")
        blob = f"{name} {p.get('description') or ''}"
        if not (NPM_GODOT.search(blob) and NPM_MCP.search(blob)):
            dropped += 1
            continue
        slug = repo_slug(str((p.get("links") or {}).get("repository") or ""))
        if name == SELF_NPM or slug == SELF_SLUG:
            self_dropped += 1
            continue
        rows.append({
            "slug": slug,
            "npm": name,
            "registry_name": None,
            "version": p.get("version"),
            "published": str(p.get("date") or "")[:10],
            "description": str(p.get("description") or "")[:160],
            "via": "republisher" if name.startswith(NPM_REPUBLISHERS) else None,
            "channel": "npm",
        })
    return (rows, dropped, self_dropped)


def registry_relevant(servers: "list[dict]") -> "tuple[list[dict], int, int]":
    """(rows, dropped_as_irrelevant, dropped_as_self) over MCP Registry rows — PURE.

    🔴 LATEST ONLY, AND THE REGISTRY IS WHY. `/v0/servers` serves EVERY published version of
    every server, so a project that cut eleven releases appears eleven times; the registry
    marks exactly one of them `isLatest`. Reading them all would report a project's release
    count as a category size, which is the same class of error as counting a mirror.
    """
    rows, dropped, self_dropped = [], 0, 0
    for s in servers:
        srv = s.get("server") or {}
        meta = (s.get("_meta") or {}).get("io.modelcontextprotocol.registry/official") or {}
        if not meta.get("isLatest"):
            continue
        name = str(srv.get("name") or "")
        blob = f"{name} {srv.get('description') or ''}"
        if not NPM_GODOT.search(blob):
            dropped += 1
            continue
        slug = repo_slug(str((srv.get("repository") or {}).get("url") or ""))
        if slug == SELF_SLUG:
            self_dropped += 1
            continue
        npm_pkg = next((p.get("identifier") for p in srv.get("packages") or []
                        if p.get("registryType") == "npm"), None)
        rows.append({
            "slug": slug,
            "npm": npm_pkg,
            "registry_name": name,
            "version": srv.get("version"),
            "published": str(meta.get("updatedAt") or "")[:10],
            "description": str(srv.get("description") or "")[:160],
            "via": None,
            "channel": "mcp-registry",
        })
    return (rows, dropped, self_dropped)


def fold(rows: "list[dict]") -> "dict[str, dict]":
    """One project, one row, however many channels surfaced it — PURE.

    The key is the repository slug when there is one and `<channel>:<name>` when there is
    not. 🔴 THE FALLBACK KEY CARRIES THE CHANNEL ON PURPOSE: two packages with no
    repository link and the same bare name on two different registries are two projects,
    and a key that dropped the channel would silently merge them.
    """
    out: "dict[str, dict]" = {}
    for r in rows:
        key = r["slug"] or f"{r['channel']}:{r['npm'] or r['registry_name']}"
        cur = out.get(key)
        if cur is None:
            out[key] = {**r, "key": key, "channels": [r["channel"]]}
            continue
        if r["channel"] not in cur["channels"]:
            cur["channels"].append(r["channel"])
        for f in ("npm", "registry_name", "description"):
            if r.get(f) and not cur.get(f):
                cur[f] = r[f]
        if (r.get("published") or "") > (cur.get("published") or ""):
            cur["published"], cur["version"] = r["published"], r["version"]
    return out


def surfaced_problems(found: "dict[str, dict]", roster: dict) -> "list[str]":
    """Every project a leg surfaced owes a ROW, and nothing more — PURE.

    🔴 THIS IS 291's POPULATION DECISION AND IT IS THE WHOLE OF IT. Before this session the
    file had ONE severity for a never-tracked MCP-shaped entry: it owed a source-level pass.
    That was affordable while the population was one channel serving roughly ten new entries
    a year. Across three channels it is not — the first run surfaced fifty — and a rule that
    demands fifty source-level passes in one commit does not produce fifty analyses, it
    produces a gate that is red forever and a roster nobody can make green. That is the
    *governance wearing churn* the queue's own tier text refuses, arriving one file away.

    🔵 SO THE TWO COSTS ARE SPLIT, BECAUSE THEY WERE ALWAYS TWO COSTS.
      `entries`  — a product READ AT SOURCE, with a ruling. Carries `debugger`,
                   `real_dap_client`, `csharp`, `protocol_revision`, a `note`. Cost: a
                   source-level pass. Elected, never automatic.
      `surfaced` — a product a leg has SEEN, carried permanently, holding only what the leg
                   itself supplies: channel, slug, package, version, date, first-seen
                   session. Cost: one row. Owed by everything, automatically.

    A `surfaced` row makes no claim the sweep did not measure, which is exactly why it can be
    written for fifty projects in one commit and an `entries` row cannot. And the roster's own
    first line — *every product that has appeared in any prior sweep, carried forward
    permanently* — is satisfied by the cheap population, which is what it always described.
    """
    known = {repo_slug(str(e.get("repo") or "")) for e in roster.get("entries", [])}
    known |= {str(e.get("repo") or "").lower() for e in roster.get("entries", [])}
    known |= {str(s.get("key") or "") for s in roster.get("surfaced", [])}
    known.discard("")
    return [
        f"SURFACED_UNRECORDED {key} — surfaced by {'+'.join(row['channels'])} and in "
        f"neither `entries` nor `surfaced`. It owes a ROW and not an analysis: the roster "
        f"carries every product any sweep has seen, and a channel that surfaces a project "
        f"the roster cannot name is a discovery leg reporting to nobody"
        for key, row in sorted(found.items()) if key not in known
    ]


def npm_currency(entries: "list[dict]", live: "dict[str, dict]"
                 ) -> "tuple[list[dict], list[dict], list[dict]]":
    """(moved, held, unread) for every `entries` row that ships on npm — PURE.

    🔴 THE CARD LEG'S JOB, FOR THE CHANNEL THAT HAD NONE. `tracked` is keyed on
    `asset_id`, so both currency legs in this file — the Asset Library card and the
    repository head — skip every entry without one. An `entries` row on the npm channel
    would therefore be a row NO leg ever re-reads: analysed once, then carried forever with
    nothing able to say it had moved. That is the same defect the whole file is about,
    one level down and inside the fix for it, so it is closed in the same commit.

    `unread` when the live search did not return the package: a query that did not surface
    it is not evidence that it is gone (npm's search is ranked, not exhaustive), and
    reporting it as moved would make the loudest row on every run a fact about ranking.
    """
    moved, held, unread = [], [], []
    for e in entries:
        pkg = str(e.get("npm") or "")
        if not pkg:
            continue
        row = live.get(pkg)
        base = {"name": e.get("name"), "npm": pkg,
                "recorded_version": e.get("npm_version"),
                "recorded_published": e.get("npm_publish_date"),
                "last_analysed": e.get("last_analysed")}
        if row is None:
            unread.append({**base, "why": "the live npm search did not return this package "
                                          "on this run — search is ranked, not exhaustive, "
                                          "so this is not evidence that it moved"})
        elif (str(row.get("version")) == str(e.get("npm_version"))
                and str(row.get("published")) == str(e.get("npm_publish_date"))):
            held.append({**base, "live_version": row.get("version")})
        else:
            moved.append({**base, "live_version": row.get("version"),
                          "live_published": row.get("published")})
    return (moved, held, unread)


def channel_problems(states: "dict[str, tuple[str, str]]") -> "list[str]":
    """A channel that could not be read is NEVER `nothing new` — PURE.

    Only the mechanically enumerable channels are judged: `commercial` is declared UNREAD
    by construction and refusing on it every run would be a gate demanding that somebody
    fix the fact that closed source is closed.
    """
    out = []
    for name, (state, detail) in sorted(states.items()):
        if not CHANNELS.get(name, {}).get("enumerable", True):
            continue
        if state == CHANNEL_UNREAD:
            out.append(f"DISCOVERY_UNREAD {name} — {detail}. This run has NO opinion about "
                       f"what is new on this channel, and reporting one would be the "
                       f"measured green 291 was written to stop")
        elif state == CHANNEL_PARTIAL:
            out.append(f"DISCOVERY_PARTIAL {name} — {detail}. The new-entry list below is "
                       f"a lower bound, not a population")
    return out


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "breakpoint-mcp-sweep"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def load_roster() -> dict:
    with open(os.path.normpath(ROSTER), encoding="utf-8") as f:
        return json.load(f)


def discover() -> tuple[dict[int, dict], int, int, int, int]:
    """(relevant_by_id, seen_total, dropped_by_filter, attempted, failed).

    🆕 291 — THE LAST TWO ARE THE WHOLE OF `channel_state`'s INPUT, and they were being
    thrown away. Every failed query printed a line to stderr and the loop continued, so the
    only trace of *this channel refused to answer* was a message no caller read and no
    reader counted. Counting them is one integer and it is the difference between a green
    that was measured and a green that was silence.
    """
    seen: dict[int, dict] = {}
    attempted = failed = 0
    for kw in KEYWORDS:
        for gv in GODOT_VERSIONS:
            url = f"{API}/asset?filter={kw}&godot_version={gv}&max_results=500&type=addon"
            attempted += 1
            try:
                page = get(url)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                failed += 1
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
    return relevant, len(seen), len(seen) - len(relevant), attempted, failed


# ── 🆕 291 — THE TWO NEW CHANNEL LEGS. NETWORK, AND NOTHING ELSE ──────────────────────
#
# 🔴 EACH IS TRANSPORT ONLY, AND THAT IS DELIBERATE. Everything either one decides —
# relevance, self-exclusion, the mirror rule, the join key — lives in `npm_relevant`,
# `registry_relevant` and `fold`, which are PURE and driven from fixtures in `selftest()`.
# 174 §8's rule: a judgement inside a function that dials is a judgement nothing offline can
# reach, and the offline half is the half that runs in the merge path.
def discover_npm() -> "tuple[list[dict], int, int]":
    """(search objects, attempted, failed) from registry.npmjs.org's search endpoint."""
    objs, attempted, failed = [], 0, 0
    for text in ("godot mcp", "godot model context protocol"):
        attempted += 1
        try:
            page = get(f"{NPM_SEARCH}?text={urllib.parse.quote(text)}&size=250")
        except Exception as e:                    # noqa: BLE001 — see the block above
            failed += 1
            print(f"  ! npm query {text!r} failed: {e}", file=sys.stderr)
            continue
        objs.extend(page.get("objects") or [])
    return (objs, attempted, failed)


def discover_registry() -> "tuple[list[dict], int, int]":
    """(server rows, attempted, failed) from the official MCP Registry."""
    rows, attempted, failed = [], 0, 0
    for term in ("godot",):
        attempted += 1
        try:
            page = get(f"{MCP_REGISTRY}?search={urllib.parse.quote(term)}&limit=100")
        except Exception as e:                    # noqa: BLE001 — see the block above
            failed += 1
            print(f"  ! mcp-registry query {term!r} failed: {e}", file=sys.stderr)
            continue
        rows.extend(page.get("servers") or [])
    return (rows, attempted, failed)



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

    🆕 284 — AND A RULED-OUT ENTRY OWES NO SOURCE PASS, WHICH 284 LEARNED BY CREATING THE
    PROBLEM. Four entries carried no `last_analysed_commit`, so this reader was blind to
    them and said `unread` every run; 284 baselined all four, including `LimboAI`, which
    is `not-in-category` and has been for a year. LimboAI is also very much alive —
    1,409 commits, roughly eight a month — so the FIRST sweep after the baseline refused
    on it, and every sweep after that would have.

    🔵 THE RULE IS ABOUT WHAT A MOVEMENT COULD CHANGE. Rule 2's second clause exists
    because a tracked ALTERNATIVE can ship something that changes our analysis of it —
    `godot-mcp-enhanced` shipping a debugger forty-eight hours after a document said the
    category could not. A ruled-out project's ordinary development cannot change an
    analysis that concluded it is not in this category at all. The one movement that
    COULD is it becoming MCP-shaped, and that is what the discovery leg watches for, on
    every run, without needing a commit.

    🔴 THE COMMIT IS STILL RECORDED, DELIBERATELY. Dropping the field would put the entry
    back in `unread`, which is the state 284 baselined it out of: *unread* and *ruled out*
    are different answers and this reader distinguishes them. What changes is only whether
    a movement is OWED WORK.
    """
    if str(entry.get("status") or "") == "ruled-out":
        return ("held", "ruled out of category — its commits cannot change that reading, "
                        "and the discovery leg watches the one movement that could")
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
    ap.add_argument("--emit", action="store_true",
                    help="the world-facing readings, one per line, for a machine that "
                         "cannot dial to consume")
    ap.add_argument("--census", action="store_true",
                    help="OFFLINE — the roster's shape, read from the file, no network")
    args = ap.parse_args()

    if args.selftest:
        return selftest()
    if args.census:
        return census()

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

    relevant, seen_total, dropped, al_attempted, al_failed = discover()
    new = {i: a for i, a in relevant.items() if i not in tracked}

    # ── 🆕 291 — THE TWO NEW CHANNELS, THEIR STATES, AND THE FOLD ────────────────────
    npm_objs, npm_attempted, npm_failed = discover_npm()
    reg_rows, reg_attempted, reg_failed = discover_registry()
    npm_rows, npm_dropped, npm_self = npm_relevant(npm_objs)
    reg_relevant_rows, reg_dropped, reg_self = registry_relevant(reg_rows)
    found = fold(npm_rows + reg_relevant_rows)
    states = {
        "assetlib": channel_state(al_attempted, al_failed),
        "npm": channel_state(npm_attempted, npm_failed),
        "mcp-registry": channel_state(reg_attempted, reg_failed),
        "commercial": channel_state(0, 0, enumerable=False),
    }
    chan_problems = channel_problems(states)
    unrecorded = surfaced_problems(found, roster)
    mirrored = sum(1 for r in npm_rows if r["via"] == "republisher")
    npm_live = {r["npm"]: r for r in npm_rows if r.get("npm")}
    npm_moved, npm_held, npm_unread = npm_currency(roster.get("entries", []), npm_live)

    if args.emit:
        # 🔴 THE EMITTER, IN `--gh-open`'s SHAPE AND FOR ITS REASON (287). Three of this
        # file's four channels answer from nowhere in this project's own toolchain — the
        # Cowork container gets HTTP 403 from the egress proxy for godotengine.org and
        # registry.npmjs.org alike, and the device VM has no network at all — so a reading
        # taken on a machine that CAN dial has to be spendable somewhere else. One line per
        # fact, the fact first, no prose: the same contract `GH_OPEN_ISSUES` has had since
        # 271, so a consumer parses it with a `split()` and never a regex over English.
        for name in sorted(states):
            state, detail = states[name]
            print(f"DISCOVERY_CHANNEL {name} {state}")
        print(f"DISCOVERY_ASSETLIB seen {seen_total} relevant {len(relevant)} "
              f"dropped {dropped}")
        print(f"DISCOVERY_NPM objects {len(npm_objs)} relevant {len(npm_rows)} "
              f"dropped {npm_dropped} mirrored {mirrored}")
        print(f"DISCOVERY_MCP_REGISTRY rows {len(reg_rows)} relevant "
              f"{len(reg_relevant_rows)} dropped {reg_dropped}")
        print(f"DISCOVERY_SURFACED {len(found)} project(s) folded from "
              f"{len(npm_rows) + len(reg_relevant_rows)} row(s)")
        print(f"DISCOVERY_UNRECORDED {len(unrecorded)}")
        print(f"DISCOVERY_NPM_CURRENCY moved {len(npm_moved)} held {len(npm_held)} "
              f"unread {len(npm_unread)}")
        return 0

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
        # 🆕 291 — the channel legs, their states, and the folded population
        "channels": {n: {"state": s, "detail": d} for n, (s, d) in sorted(states.items())},
        "channel_problems": chan_problems,
        "npm_relevant": len(npm_rows),
        "npm_dropped_as_irrelevant": npm_dropped,
        "npm_mirrored": mirrored,
        "mcp_registry_relevant": len(reg_relevant_rows),
        "mcp_registry_dropped_as_irrelevant": reg_dropped,
        "surfaced": [
            {"key": k, "channels": v["channels"], "npm": v.get("npm"),
             "registry_name": v.get("registry_name"), "version": v.get("version"),
             "published": v.get("published"), "via": v.get("via")}
            for k, v in sorted(found.items())
        ],
        "surfaced_unrecorded": unrecorded,
        "npm_moved": npm_moved,
        "npm_no_change": npm_held,
        "npm_currency_unread": npm_unread,
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
        print(f"  CHANNELS             : {len(CHANNELS)} declared, "
              f"{sum(1 for c in CHANNELS.values() if c['enumerable'])} mechanically "
              f"enumerable")
        for n, (s, d) in sorted(states.items()):
            print(f"    {s:<8} {n:<14} {d}")
        print(f"  npm                  : {len(npm_objs)} object(s) -> {len(npm_rows)} "
              f"relevant, {npm_dropped} dropped, {mirrored} republished")
        print(f"  mcp-registry         : {len(reg_rows)} row(s) -> "
              f"{len(reg_relevant_rows)} relevant, {reg_dropped} dropped")
        print(f"  SURFACED             : {len(found)} project(s) across the two new "
              f"channels · {len(unrecorded)} with no roster row")
        print(f"  npm currency         : {len(npm_moved)} moved · {len(npm_held)} no "
              f"change · {len(npm_unread)} unread")
        for m in unrecorded:
            print(f"    {m.split(' — ')[0]}")
        for r in npm_moved:
            print(f"    NPM     {r['npm']}: {r['recorded_version']} "
                  f"({r['recorded_published']}) -> {r['live_version']} "
                  f"({r['live_published']}) · last source-level pass {r['last_analysed']}")
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
    # 🆕 291 — AND THE TWO NEW REFUSALS. `chan_problems` is the one that changes what a
    # green MEANS: before it, a run where every query failed produced an empty new-entry
    # list and exited 0. `unrecorded` is the population decision cashed — a row, not an
    # analysis, and refused when it is missing.
    if chan_problems:
        stale.append(f"{len(chan_problems)} discovery channel(s) not fully read")
    if unrecorded:
        stale.append(f"{len(unrecorded)} surfaced project(s) with no roster row")
    if npm_moved:
        stale.append(f"{len(npm_moved)} npm-channel entr(ies) published a new version "
                     f"since their last source-level pass")
    if args.check and stale:
        for m in chan_problems + unrecorded:
            print(f"  🔴 {m}", file=sys.stderr)
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
SURFACED_FIELDS = ("key", "channels", "first_seen")


def roster_shape_problems(roster: dict) -> "list[str]":
    """The roster's SHAPE, judged offline — PURE, so `census()` needs no network and can run
    in the merge path where every other reader in this file cannot.

    🔴 THE POINT IS THAT THE NEW POPULATION HAS A READER AT ALL. `surfaced` is fifty rows
    written by a machine and consumed by a machine; if the only thing that ever opened it
    were the weekly `--check` on a schedule, it would be a table nothing in the merge path
    reads — which is precisely the defect `QUEUE.md`'s own header was written about, and
    the one 290 §2.4 named one file over. Four claims, each of which can be wrong in a way
    a human editing JSON by hand will produce on the first try.
    """
    problems: list[str] = []
    entries = roster.get("entries", [])
    surfaced = roster.get("surfaced", [])

    for e in entries:
        ch = e.get("channel")
        if ch is not None and ch not in CHANNELS:
            problems.append(
                f"ROSTER_CHANNEL_UNKNOWN {e.get('name')!r} declares channel {ch!r}, which "
                f"is not one of {sorted(CHANNELS)}. A channel is where a project SHIPS and "
                f"the roster's population is the union of what the channels enumerate — a "
                f"row naming a channel no leg queries is a row no leg can ever re-read")

    seen: dict[str, int] = {}
    for s in surfaced:
        key = str(s.get("key") or "")
        missing = [f for f in SURFACED_FIELDS if not s.get(f)]
        if missing:
            problems.append(
                f"SURFACED_INCOMPLETE {key or '(no key)'} — missing {missing}. A surfaced "
                f"row holds only what a discovery leg supplies, and a row missing one of "
                f"those is a row that cannot be re-derived from the query that made it")
        for c in s.get("channels") or []:
            if c not in CHANNELS:
                problems.append(f"SURFACED_CHANNEL_UNKNOWN {key} names channel {c!r}")
        seen[key] = seen.get(key, 0) + 1

    for key, n in sorted(seen.items()):
        if n > 1:
            problems.append(
                f"SURFACED_DUPLICATE {key} appears {n} times. `fold` exists so that one "
                f"project surfaced by three channels is one row; two rows with one key is "
                f"the category counted twice")

    # 🔴 AND THE TWO POPULATIONS MAY NOT OVERLAP. A project read at source level has an
    # `entries` row with a ruling; leaving its `surfaced` row behind would make the roster
    # report it as both analysed and never analysed, and `surfaced_problems` would keep
    # accepting it on the strength of the row that says the weaker thing.
    analysed = {repo_slug(str(e.get("repo") or "")) for e in entries}
    analysed.discard("")
    for key in sorted(k for k in seen if k in analysed):
        problems.append(
            f"SURFACED_PROMOTED {key} has an `entries` row AND a `surfaced` row. A project "
            f"read at source level is promoted, not duplicated — drop the surfaced row in "
            f"the commit that adds the analysis")
    return problems


def census() -> int:
    """OFFLINE. The roster's shape and its two populations, printed as one counter line.

    🔴 NO NETWORK AND NO FIXTURES: this reads the tracked roster file, which is a fact about
    the TREE and therefore the one thing in this file a merge-blocking job can honestly ask
    about. Everything else here is a fact about four third-party hosts.
    """
    roster = load_roster()
    entries = roster.get("entries", [])
    surfaced = roster.get("surfaced", [])
    enumerable = sum(1 for c in CHANNELS.values() if c["enumerable"])
    watched = sum(len(c.get("watch") or []) for c in CHANNELS.values())
    # 🔴 `unclassified` IS PRINTED, NOT DEFAULTED AWAY. Forty-five entries predate the
    # channel legs and nobody has recorded where any of them SHIPS — and quietly counting
    # them as `assetlib` because that is the leg that found most of them would be this
    # file's own defect written into its own census. The number is visible, it is a real
    # intake, and it falls as sessions classify rows.
    by_channel: dict[str, int] = {}
    for e in entries:
        key = str(e.get("channel") or "unclassified")
        by_channel[key] = by_channel.get(key, 0) + 1
    problems = roster_shape_problems(roster)
    for m in problems:
        print(f"  🔴 {m}", file=sys.stderr)
    print(f"LANDSCAPE_CENSUS {len(CHANNELS)} channel(s) / {enumerable} enumerable · "
          f"{len(entries)} analysed / {len(surfaced)} surfaced · {watched} watched · "
          f"{len(problems)} problem(s)")
    print("  " + " · ".join(f"{k} {v}" for k, v in sorted(by_channel.items())))
    return 1 if problems else 0


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

    # ── 🆕 291 — `channel_state`, ALL FOUR ANSWERS, AND THE ONE THAT IS THE DEFECT ────
    #
    # 🔴 THE THIRD CLAIM IS THE ROW. Twenty-eight attempted queries, twenty-eight failures,
    # zero hits — the exact shape a run against an unreachable godotengine.org produced —
    # and before 291 it was reported as an empty NEW list and exit 0. `unread` is what that
    # run actually knows.
    claim("read: every query answered", channel_state(28, 0)[0], CHANNEL_READ)
    claim("partial: some queries failed", channel_state(28, 3)[0], CHANNEL_PARTIAL)
    claim("unread: EVERY query failed — the 2026-08-27 §3.5 shape",
          channel_state(28, 28)[0], CHANNEL_UNREAD)
    claim("unread: nothing was even attempted", channel_state(0, 0)[0], CHANNEL_UNREAD)
    claim("unread: a channel no query can enumerate",
          channel_state(0, 0, enumerable=False)[0], CHANNEL_UNREAD)
    claim("an unread channel says WHY, so the refusal can be argued with",
          bool(channel_state(28, 28)[1]), True)
    # Both directions of the refusal, and the one it must NOT make: `commercial` is UNREAD
    # by construction and refusing on it every run would be a gate demanding somebody open
    # somebody else's source.
    claim("channel_problems refuses an unread enumerable channel",
          len(channel_problems({"npm": channel_state(2, 2)})), 1)
    claim("channel_problems is silent on a read channel",
          channel_problems({"npm": channel_state(2, 0)}), [])
    claim("channel_problems does not refuse the declared watch list",
          channel_problems({"commercial": channel_state(0, 0, enumerable=False)}), [])
    claim("channel_problems names PARTIAL as a lower bound, not a population",
          len(channel_problems({"assetlib": channel_state(28, 1)})), 1)

    # ── `repo_slug` — the join key, over every URL shape the two registries serve ─────
    claim("slug: npm's `git+https://…​.git`",
          repo_slug("git+https://github.com/Coding-Solo/godot-mcp.git"),
          "coding-solo/godot-mcp")
    claim("slug: the registry's bare https URL",
          repo_slug("https://github.com/satelliteoflove/godot-mcp"),
          "satelliteoflove/godot-mcp")
    claim("slug: two spellings of one repository are ONE key",
          repo_slug("git+https://github.com/A/b.git") == repo_slug("https://github.com/a/B"),
          True)
    claim("slug: a non-GitHub host has no slug and says so with an empty string",
          repo_slug("git+https://gitlab.com/snopek-games/godai.git"), "")
    claim("slug: nothing recorded", repo_slug(""), "")
    # 🔴 THE ROSTER'S OWN SPELLING. `repo` has been a bare `owner/name` since 223 and both
    # new registries serve URLs; one key function has to answer for both or the join it
    # exists to make is a comparison against a set of empty strings.
    claim("slug: the roster's bare `owner/name`", repo_slug("Coding-Solo/godot-mcp"),
          "coding-solo/godot-mcp")
    claim("slug: a bare slug and a URL for one repository are ONE key",
          repo_slug("Coding-Solo/godot-mcp")
          == repo_slug("git+https://github.com/Coding-Solo/godot-mcp.git"), True)
    claim("slug: a bare word is not a slug", repo_slug("godot-mcp"), "")

    # ── the two relevance filters, and the self rule on each channel ─────────────────
    _npm_fx = [
        {"package": {"name": "@coding-solo/godot-mcp", "description": "MCP server for the "
                     "Godot game engine", "version": "0.1.1", "date": "2026-02-03",
                     "links": {"repository": "git+https://github.com/Coding-Solo/godot-mcp.git"}}},
        {"package": {"name": "breakpoint-mcp", "description": "Godot MCP debugger",
                     "version": "1.83.0", "date": "2026-08-26",
                     "links": {"repository": "https://github.com/jlivingston-Cipher/godot-breakpoint-mcp"}}},
        {"package": {"name": "some-mcp-server", "description": "an MCP server for something else",
                     "version": "1.0.0", "date": "2026-01-01", "links": {}}},
        {"package": {"name": "godot-terrain", "description": "a Godot terrain addon",
                     "version": "1.0.0", "date": "2026-01-01", "links": {}}},
        {"package": {"name": "@iflow-mcp/ee0pdt-godot-mcp", "description": "godot mcp",
                     "version": "1.0.1", "date": "2026-02-12", "links": {}}},
    ]
    _rows, _drop, _self = npm_relevant(_npm_fx)
    claim("npm: the conjunction keeps a Godot MCP server", len(_rows), 2)
    claim("npm: `mcp` alone and `godot` alone are both dropped", _drop, 2)
    claim("npm: our own package is excluded BY NAME, not by title", _self, 1)
    claim("npm: a republished package is kept and MARKED, never counted as its origin",
          [r["via"] for r in _rows if r["npm"].startswith("@iflow-mcp/")], ["republisher"])
    claim("npm: an unmirrored package carries no `via`",
          [r["via"] for r in _rows if r["npm"] == "@coding-solo/godot-mcp"], [None])

    def _srv(name, desc, url, ver, latest=True):
        return {"server": {"name": name, "description": desc, "version": ver,
                           "repository": {"url": url}, "packages": []},
                "_meta": {"io.modelcontextprotocol.registry/official":
                          {"isLatest": latest, "updatedAt": "2026-08-27T00:00:00Z"}}}
    _reg_fx = [
        _srv("io.github.satelliteoflove/godot-mcp", "Agent-driven Godot playtesting",
             "https://github.com/satelliteoflove/godot-mcp", "4.1.11"),
        _srv("io.github.satelliteoflove/godot-mcp", "Agent-driven Godot playtesting",
             "https://github.com/satelliteoflove/godot-mcp", "4.1.10", latest=False),
        _srv("io.github.someone/blender-mcp", "Blender control",
             "https://github.com/someone/blender-mcp", "1.0.0"),
    ]
    _rrows, _rdrop, _rself = registry_relevant(_reg_fx)
    claim("registry: one row per SERVER, not one per published version", len(_rrows), 1)
    claim("registry: a non-Godot server is dropped and counted", _rdrop, 1)

    # ── `fold` — one project surfaced by two channels is ONE row ─────────────────────
    _folded = fold(_rows + _rrows)
    claim("fold: the npm and registry rows for one repository are one key",
          len(fold([
              {"slug": "satelliteoflove/godot-mcp", "npm": "@satelliteoflove/godot-mcp",
               "registry_name": None, "version": "4.1.11", "published": "2026-08-27",
               "description": "", "via": None, "channel": "npm"},
              {"slug": "satelliteoflove/godot-mcp", "npm": None,
               "registry_name": "io.github.satelliteoflove/godot-mcp", "version": "4.1.11",
               "published": "2026-08-27", "description": "", "via": None,
               "channel": "mcp-registry"},
          ])), 1)
    claim("fold: and that one row records BOTH channels",
          sorted(fold([
              {"slug": "x/y", "npm": "y", "registry_name": None, "version": "1",
               "published": "2026-01-01", "description": "", "via": None, "channel": "npm"},
              {"slug": "x/y", "npm": None, "registry_name": "io.github.x/y", "version": "1",
               "published": "2026-01-01", "description": "", "via": None,
               "channel": "mcp-registry"},
          ])["x/y"]["channels"]), ["mcp-registry", "npm"])
    claim("fold: two slugless packages of the same name on two channels stay two projects",
          len(fold([
              {"slug": "", "npm": "ghost", "registry_name": None, "version": "1",
               "published": "2026-01-01", "description": "", "via": None, "channel": "npm"},
              {"slug": "", "npm": "ghost", "registry_name": "ghost", "version": "1",
               "published": "2026-01-01", "description": "", "via": None,
               "channel": "mcp-registry"},
          ])), 2)
    claim("fold: a slugless package is keyed by channel and name",
          sorted(fold([{"slug": "", "npm": "ghost", "registry_name": None, "version": "1",
                        "published": "2026-01-01", "description": "", "via": None,
                        "channel": "npm"}])), ["npm:ghost"])
    claim("fold: the whole fixture set folds to its distinct repositories",
          len(_folded), 3)

    # ── `surfaced_problems` — the population decision, both directions ───────────────
    _found = {"coding-solo/godot-mcp": {"channels": ["npm"]},
              "satelliteoflove/godot-mcp": {"channels": ["npm", "mcp-registry"]}}
    claim("surfaced: a project in neither population is refused BY NAME",
          len(surfaced_problems(_found, {"entries": [], "surfaced": []})), 2)
    claim("surfaced: an `entries` row satisfies it — a source-level pass is the stronger claim",
          surfaced_problems(_found, {
              "entries": [{"repo": "Coding-Solo/godot-mcp"},
                          {"repo": "satelliteoflove/godot-mcp"}], "surfaced": []}), [])
    claim("surfaced: a `surfaced` row satisfies it — a ROW is what is owed, not an analysis",
          surfaced_problems(_found, {"entries": [], "surfaced": [
              {"key": "coding-solo/godot-mcp"}, {"key": "satelliteoflove/godot-mcp"}]}), [])
    claim("surfaced: half-recorded is half-refused",
          len(surfaced_problems(_found, {"entries": [], "surfaced": [
              {"key": "coding-solo/godot-mcp"}]})), 1)
    claim("surfaced: the refusal names the channels that surfaced it",
          "npm+mcp-registry" in surfaced_problems(
              {"satelliteoflove/godot-mcp": {"channels": ["npm", "mcp-registry"]}},
              {"entries": [], "surfaced": []})[0], True)

    # ── `npm_currency` — the card leg's job for the channel that had none ────────────
    _live = {"@coding-solo/godot-mcp": {"version": "0.1.1", "published": "2026-02-03"}}
    _ent = [{"name": "coding-solo", "npm": "@coding-solo/godot-mcp",
             "npm_version": "0.1.1", "npm_publish_date": "2026-02-03"}]
    claim("npm currency: recorded == live is `no change`",
          [len(x) for x in npm_currency(_ent, _live)], [0, 1, 0])
    claim("npm currency: a new version is `moved`",
          [len(x) for x in npm_currency(
              [{**_ent[0], "npm_version": "0.1.0"}], _live)], [1, 0, 0])
    claim("npm currency: a re-publish of the SAME version at a new date is `moved` too",
          [len(x) for x in npm_currency(
              [{**_ent[0], "npm_publish_date": "2026-01-01"}], _live)], [1, 0, 0])
    claim("npm currency: a package the ranked search did not return is `unread`, not moved",
          [len(x) for x in npm_currency(_ent, {})], [0, 0, 1])
    claim("npm currency: an entry that ships on no registry is not judged",
          [len(x) for x in npm_currency([{"name": "addon-only"}], _live)], [0, 0, 0])
    claim("npm currency: the unread row says why, so it cannot read as a refusal",
          bool(npm_currency(_ent, {})[2][0]["why"]), True)

    # ── `roster_shape_problems` — the offline reader `--census` runs in the merge path ─
    claim("shape: a clean roster has nothing to say",
          roster_shape_problems({"entries": [{"name": "x", "channel": "npm", "repo": "a/b"}],
                                 "surfaced": [{"key": "c/d", "channels": ["npm"],
                                               "first_seen": 291}]}), [])
    claim("shape: an entry naming a channel no leg queries is refused",
          len(roster_shape_problems({"entries": [{"name": "x", "channel": "itch"}],
                                     "surfaced": []})), 1)
    claim("shape: a surfaced row missing a leg-supplied field is refused",
          len(roster_shape_problems({"entries": [],
                                     "surfaced": [{"key": "c/d", "channels": ["npm"]}]})), 1)
    claim("shape: one project may not be two surfaced rows",
          len(roster_shape_problems({"entries": [], "surfaced": [
              {"key": "c/d", "channels": ["npm"], "first_seen": 291},
              {"key": "c/d", "channels": ["npm"], "first_seen": 291}]})), 1)
    claim("shape: a project read at source level is PROMOTED, not duplicated",
          len(roster_shape_problems({"entries": [{"name": "x", "repo": "C/D"}],
                                     "surfaced": [{"key": "c/d", "channels": ["npm"],
                                                   "first_seen": 291}]})), 1)
    claim("shape: every declared channel says whether a machine can enumerate it",
          sorted({type(c["enumerable"]) for c in CHANNELS.values()}), [bool])
    claim("shape: the non-enumerable channel carries the watch list it is made of",
          bool(CHANNELS["commercial"]["watch"]), True)

    print(f"ASSETLIB_SELFTEST {claims - bad}/{claims} claims, {bad} failed")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
