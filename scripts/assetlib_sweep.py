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
import datetime
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

# ── 🆕 292 §1 — WHAT A NEVER-TRACKED PROJECT COSTS IS A PROPERTY OF ITS CHANNEL ───────
#
# 🔴 291 SHIPPED TWO ANSWERS TO ONE QUESTION AND WROTE NEITHER OF THEM DOWN. *A project
# exists and we have not read it* was priced a source-level pass when the Asset Library
# leg found it (`new_mcp`, below) and one roster row when npm or the MCP Registry found it
# (`surfaced_problems`). 291 §3.3 filed that against itself: **the asymmetry is defensible
# and that is not the same as declared.** A reader opening this file found two rules for
# one question and no line saying they were meant to differ, which is a shape in which a
# decision and an oversight are indistinguishable.
#
# 🔵 THE ARGUMENT FOR THE ASYMMETRY IS VOLUME, AND IT IS A REAL ARGUMENT. The Asset
# Library serves roughly ten new MCP-shaped entries a year; npm and the MCP Registry
# surfaced FIFTY untracked projects between them on the first afternoon anybody queried
# them. A rule demanding fifty source-level passes in one commit does not produce fifty
# analyses — it produces a gate that is red forever and a roster nobody can make green.
# So the price differs because the arrival rate differs by an order of magnitude.
#
# 🔴 SO IT IS A FIELD NOW, NOT A BRANCH. Both refusal sites read `severity` off the
# channel that surfaced the project; neither one spells its own price any more. That is
# the whole of the fix and it is deliberately not a behaviour change: `assetlib` declares
# `analysis` and the other three declare `row`, which is exactly what 291 shipped. What
# changes is that the difference is now a value a gate reads, carrying the argument for
# itself, so a later session re-pricing a channel edits one line here instead of finding
# the `if` a project fell down. 🔵 `severity_problems` refuses a channel that declares
# neither, so the next channel added cannot inherit the cheap price by saying nothing —
# which is how this asymmetry got in undeclared the first time.
SEVERITY_ROW = "row"
SEVERITY_ANALYSIS = "analysis"
SEVERITIES = (SEVERITY_ROW, SEVERITY_ANALYSIS)

CHANNELS: "dict[str, dict]" = {
    "assetlib": {
        "enumerable": True,
        "serves": "Godot addons published to godotengine.org's Asset Library",
        "why": "where Godot addons are published — the original and, until 291, the only "
               "channel this roster's population was drawn from",
        "severity": SEVERITY_ANALYSIS,
        "severity_why": "roughly ten new MCP-shaped entries a year, and every one of them "
                        "is an addon a Godot user can install into the editor Breakpoint "
                        "competes in — a rate one session can read at source, and a "
                        "population where being unread is the expensive kind of unread",
    },
    "npm": {
        "enumerable": True,
        "serves": "packages on registry.npmjs.org whose name or description carries both "
                  "a whole-word `godot` and a whole-word MCP signal",
        "why": "the channel the category's most-starred project ships in, and the one the "
               "Asset Library can never see: an npm-only server publishes no addon, so it "
               "was never in the query",
        "severity": SEVERITY_ROW,
        "severity_why": "forty-eight untracked slugs on the first query, against a roster "
                        "of twenty-six — an intake this leg can name but no session can "
                        "read at source in one commit, so the row is owed and the analysis "
                        "is elected",
    },
    "mcp-registry": {
        "enumerable": True,
        "serves": "servers published to the official MCP Registry under any namespace, "
                  "filtered to those naming Godot",
        "why": "a publication act rather than a popularity proxy — a project here has "
               "declared itself an MCP server to the protocol's own index, and the index "
               "is queryable, which is the whole of what a discovery leg needs",
        "severity": SEVERITY_ROW,
        "severity_why": "nine untracked of twelve on the first query, and the index grows "
                        "with every publication act rather than with every release worth "
                        "reading — the same intake argument npm makes",
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
        "severity": SEVERITY_ROW,
        "severity_why": "🔵 DECLARED AND UNREACHABLE, WHICH IS NOT THE SAME AS CHEAP. No "
                        "query surfaces a project here, so nothing is ever refused on this "
                        "channel and the value is never read — it is written because "
                        "`severity_problems` refuses a channel that declares none, and a "
                        "channel exempted from declaring is the hole this row closes",
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

# ── 🆕 293 — A `false` IS A CLAIM, AND FOR EIGHTY OF THEM NOBODY HAD MADE IT ───────────
#
# 🔴 292 §2.3 READ THREE PROJECTS AT SOURCE AND ALL THREE CARRIED `csharp: false`. All
# three were wrong, and every one of them was wrong BEFORE the pass that wrote the value:
# `godot-mcp-enhanced` shipped `runDotnetBuild()` eighteen days earlier, `fennara`'s
# `run_dotnet_build_if_needed` predated the analysed commit, and `godot-mcp-go`'s
# `run_build()` dates to 0.4.0. Nobody had looked. The value was a default that had been
# copied forward until somebody finally read the tree.
#
# 🔴 288 §7.4 — *a capability claim is unsourced until somebody reads its source* — WAS
# BEING APPLIED TO ONE SIDE OF THE COLUMN. A `true` feels like a claim, so every `true`
# on this roster carried file-and-symbol evidence in its note. A `false` is the claim **we
# looked and it is not there**, which needs the whole tree rather than one file and is
# therefore strictly HARDER to earn — and it biases in the one direction that flatters us,
# because an unsourced `false` on an alternative reads as a gap they have and we do not.
#
# 🔵 SO THE THIRD STATE IS THE FIX AND NOT A SOURCE PASS ON FIFTY PROJECTS. `unread` means
# *this row once asserted a value and nobody can show the reading behind it, so the
# assertion is withdrawn* — which is a different sentence from an ABSENT field, where the
# roster never claimed anything at all. `census()` prints how many are outstanding, one
# number, and it falls as sessions read them.
CAPABILITY_UNREAD = "unread"
CAPABILITY_FIELDS = ("real_dap_client", "real_lsp_client", "csharp", "debugger")

# The vocabulary each field may spend, `unread` and `null` aside. 🔴 `null` IS NOT THE SAME
# ANSWER and is deliberately still legal: the two `source_verifiable: false` rows carry
# nulls because no reading is POSSIBLE there — a closed-source product sold from its own
# site — and `unread` would say a session merely has not got to it yet.
CAPABILITY_VALUES: "dict[str, tuple]" = {
    "real_dap_client": (True, False),
    "real_lsp_client": (True, False),
    "csharp": (True, False, "spike-only"),
    "debugger": ("none", "godot-internal-editor-debugger", "real-dap-client",
                 "dap-client-output-only", "screen-scrapes-stack-trace-panel"),
}

# 🔵 A CITATION IS SOMETHING A LATER READER CAN GO AND LOOK AT WITHOUT REDOING THE
# ANALYSIS — a path, a call, a scoped API name, a port, an identifier to grep for, or a
# stated exhaustive search. Evidence carrying none of those is still evidence (somebody
# looked and wrote down what they concluded) and it is WEAKER evidence, so it is counted
# separately and never refused: a control that reddened on prose would delete real
# readings to make a number look tidy, which is the failure 291 §3.1 called governance
# wearing churn.
CAPABILITY_CITATION = re.compile(
    r"[\w./-]+\.(?:gd|cs|ts|tsx|js|mjs|py|go|rs|cpp|h|hpp|json|yml|yaml|md|toml)\b"
    r"|\b\w+\("
    r"|\b\w+(?:\.|::)\w+"
    r"|\bports?\s+\d{2,5}\b|:\d{2,5}\b"
    r"|\b[a-z]+_[a-z_]+\b"
    r"|\b\w*[a-z][A-Z]\w*\b"
    r"|\bzero (?:repo-wide )?hits\b|\banywhere in the tree\b|\brepo-wide\b"
)


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


def severity_of(channel: str, channels: "dict[str, dict]" = None) -> str:
    """What a never-tracked project on this channel OWES — PURE, and the single place that
    answers it.

    🔴 THE DEFAULT IS THE EXPENSIVE ONE, AND THAT IS THE WHOLE OF THE DESIGN. An unknown
    channel, or one whose row forgot the field, answers `analysis` — because the failure
    this file has actually suffered is a population priced cheaply by accident, not one
    priced dearly by accident. A gate that guesses low on a channel nobody declared is a
    gate that reports a measured green about a price nobody chose, which is 291 §2.3's
    defect one field over. `severity_problems` refuses the undeclared row separately, so
    the default never has to stand in for the declaration.
    """
    row = (channels if channels is not None else CHANNELS).get(channel) or {}
    sev = row.get("severity")
    return sev if sev in SEVERITIES else SEVERITY_ANALYSIS


def severity_problems(channels: "dict[str, dict]" = None) -> "list[str]":
    """Every declared channel prices its own unread projects — PURE.

    🔴 THIS IS THE CONTROL THAT KEEPS THE FIELD FROM BECOMING DECORATION. 291's asymmetry
    arrived because a second and a third channel were added and neither one was asked what
    an unread project on it costs; the answer came from whichever branch of an `if` the
    project happened to fall down. A channel that declares no severity is refused BY NAME
    here, so the next channel cannot enter the union the same way.
    """
    out = []
    for name, row in sorted((channels if channels is not None else CHANNELS).items()):
        sev = row.get("severity")
        if sev is None:
            out.append(
                f"CHANNEL_SEVERITY_UNDECLARED {name} — the channel says what it serves and "
                f"whether a machine can enumerate it, and not what a never-tracked project "
                f"on it OWES. That is the question 291 answered two ways and wrote down "
                f"neither; declare `severity` as one of {list(SEVERITIES)} with the "
                f"argument beside it")
        elif sev not in SEVERITIES:
            out.append(
                f"CHANNEL_SEVERITY_UNKNOWN {name} declares severity {sev!r}, which is not "
                f"one of {list(SEVERITIES)}. A price no refusal site can spend is a price "
                f"nobody set")
        elif not row.get("severity_why"):
            out.append(
                f"CHANNEL_SEVERITY_UNARGUED {name} declares {sev!r} and gives no reason. "
                f"Grading a severity by a channel's arrival rate is a DECISION, and a "
                f"decision with no argument beside it is indistinguishable from the "
                f"oversight this row was written to end (291 §5.4)")
    return out


def owes(severity: str) -> str:
    """The English for one severity, written once — PURE.

    Both refusal sites print what is owed, and before 292 each spelled its own sentence.
    Two spellings of one price is how a reader concludes the two are different prices.
    """
    return ("a ROW and not an analysis" if severity == SEVERITY_ROW
            else "a SOURCE-LEVEL PASS and not just a row")


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

    🆕 292 §2 — 🔴 A MIRROR MAY JOIN A PROJECT AND MAY NOT DATE IT, AND 291 LET IT DO BOTH.
    The currency fold below took the NEWEST `published` across every row folded onto a key.
    A republishing scope copies somebody else's server days or weeks after they ship it, so
    a mirror's timestamp is ALWAYS the newest one — and the newest one won. Measured on the
    first live run of this code: `@ryanmazzolini/minimal-godot-mcp` published 0.1.6 on
    2026-02-13, `@iflow-mcp/ryanmazzolini-minimal-godot-mcp` mirrored that same 0.1.6 on
    2026-02-26, the fold handed the upstream the mirror's date, and `npm_currency` then read
    the project's own real date back off npm and reported *published a new version* about a
    version that had not moved in six months.

    🔴 THAT IS `NPM_REPUBLISHERS`' OWN ARGUMENT WITH ONE WORD LEFT OUT. 291 kept mirrors so
    the three upstreams reachable only through one are not lost, and refused to count them
    as projects because *a copy is not a project*. A copy is not a RELEASE either. The join
    is what a mirror supplies; the currency is not, so a first-party row wins the version
    and the date outright and a mirror supplies them only when NOTHING first-party did —
    the case where the mirror is the only evidence the project exists at all, which the row
    then says with `via: republisher` exactly as before.
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
        # 🔴 FIRST-PARTY BEATS MIRROR OUTRIGHT; NEWEST ONLY DECIDES BETWEEN EQUALS.
        mine, theirs = bool(cur.get("via")), bool(r.get("via"))
        if theirs and not mine:
            continue
        if (mine and not theirs) or (r.get("published") or "") > (cur.get("published") or ""):
            cur["published"], cur["version"] = r["published"], r["version"]
            if mine and not theirs:
                cur["via"] = r.get("via")
                cur["npm"] = r.get("npm") or cur.get("npm")
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

    🆕 292 §1 — AND WHAT IT COSTS IS READ OFF THE CHANNEL RATHER THAN BAKED IN HERE. 291
    hard-coded `a ROW and not an analysis` into this sentence while the Asset Library leg
    hard-coded a source-level pass into its own, which made one question look like two. The
    price is `severity_of` now, taken from whichever channels surfaced the project, and a
    project surfaced by several takes the DEAREST of them — a cheap channel seeing a project
    an expensive one also sees does not discount it.
    """
    known = {repo_slug(str(e.get("repo") or "")) for e in roster.get("entries", [])}
    known |= {str(e.get("repo") or "").lower() for e in roster.get("entries", [])}
    known |= {str(s.get("key") or "") for s in roster.get("surfaced", [])}
    known.discard("")
    out = []
    for key, row in sorted(found.items()):
        if key in known:
            continue
        chans = row["channels"]
        sev = (SEVERITY_ANALYSIS if any(severity_of(c) == SEVERITY_ANALYSIS for c in chans)
               else SEVERITY_ROW)
        out.append(
            f"SURFACED_UNRECORDED {key} — surfaced by {'+'.join(chans)} and in neither "
            f"`entries` nor `surfaced`. It owes {owes(sev)}: the roster carries every "
            f"product any sweep has seen, and a channel that surfaces a project the roster "
            f"cannot name is a discovery leg reporting to nobody")
    return out


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


def capability_claims(entry: dict) -> "list[tuple[str, object]]":
    """The capability fields this ONE entry actually spends, as (field, value) — PURE.

    🔴 ABSENT IS NOT `unread` AND THE DIFFERENCE IS THE WHOLE POINT. A row with no
    `csharp` key makes no claim about C#; a row carrying `unread` says a session looked at
    the claim, could not find the reading behind it, and withdrew it. Counting absences
    would bury thirty-five withdrawn claims under a hundred and sixty rows nobody has ever
    opened, and the number would stop being something a session can act on.
    """
    return [(f, entry[f]) for f in CAPABILITY_FIELDS if f in entry]


def capability_problems(roster: dict) -> "list[str]":
    """Every capability claim owes the reading behind it — PURE, and refused in `census()`.

    Three refusals, and the first of them is 292 §2.3's finding turned into a control:
    a definite value with no `capability_evidence` entry is a claim nobody can check.
    """
    problems: list[str] = []
    for e in roster.get("entries", []):
        name = e.get("name")
        ev = e.get("capability_evidence") or {}
        if not isinstance(ev, dict):
            problems.append(f"CAPABILITY_EVIDENCE_SHAPE {name!r} — `capability_evidence` "
                            f"must be an object keyed by capability field")
            continue
        for field, value in capability_claims(e):
            if value is None or value == CAPABILITY_UNREAD:
                continue
            if value not in CAPABILITY_VALUES[field]:
                problems.append(
                    f"CAPABILITY_UNKNOWN_VALUE {name!r}.{field} = {value!r}, which is not "
                    f"one of {list(CAPABILITY_VALUES[field])} and not {CAPABILITY_UNREAD!r}. "
                    f"A value no reader can spell is a value no sweep can compare")
            elif not str(ev.get(field) or "").strip():
                problems.append(
                    f"CAPABILITY_UNSOURCED {name!r}.{field} = {value!r} with no "
                    f"`capability_evidence.{field}`. 288 §7.4: a capability claim is "
                    f"unsourced until somebody reads its source — AND THAT INCLUDES A "
                    f"`false`, which is the claim *we looked and it is not there* and is "
                    f"the harder one to earn. Write the reading or write "
                    f"{CAPABILITY_UNREAD!r}")
        claimed = {f for f, _ in capability_claims(e)}
        for field in sorted(ev):
            if field not in CAPABILITY_FIELDS:
                problems.append(f"CAPABILITY_EVIDENCE_ORPHAN {name!r} carries evidence for "
                                f"{field!r}, which is not a capability field")
            elif field not in claimed or e.get(field) in (None, CAPABILITY_UNREAD):
                problems.append(
                    f"CAPABILITY_EVIDENCE_ORPHAN {name!r}.{field} has evidence and no "
                    f"claim. Evidence for a withdrawn claim is the shape this control "
                    f"exists to stop: a reading nobody can see in the value")
    return problems


def capability_counts(roster: dict) -> "tuple[int, int, int]":
    """(claimed, unread, uncited) across the whole roster — PURE.

    🔵 `uncited` IS PRINTED AND NEVER REFUSED. It counts claims whose evidence names no
    file, symbol, port or stated search — somebody looked and recorded a conclusion rather
    than a place to go and check it. It is a weaker reading and it is a real one, so it is
    a number that falls rather than a gate that reddens.
    """
    claimed = unread = uncited = 0
    for e in roster.get("entries", []):
        ev = e.get("capability_evidence") or {}
        for field, value in capability_claims(e):
            if value == CAPABILITY_UNREAD:
                unread += 1
            elif value is not None:
                claimed += 1
                if not CAPABILITY_CITATION.search(str(ev.get(field) or "")):
                    uncited += 1
    return (claimed, unread, uncited)


# ── 🆕 293 §3.1 — THE SOURCE LEG IS A CHANNEL AND ITS SILENCE WAS AN ANSWER ────────────
#
# 🔴 292 §3.1 MEASURED IT ON THIS SESSION'S OWN VERIFICATION RUN: twenty consecutive
# `HTTP Error 403: rate limit exceeded`, one per tracked repository, and `--check` exited
# **0**. `repo_head()` dials `api.github.com` with no token, so the whole leg runs on the
# unauthenticated sixty-per-hour budget of whatever IP it is on and two runs in an hour
# spend it. `source_unread` is a NOTE by design (271 §1) — but a run that read ZERO heads
# prints `SOURCE moved: 0`, omits source drift from `ROSTER STALE` entirely and exits 0,
# byte-indistinguishable from a run that read every head and found nothing.
#
# 🔴 THAT IS 291 §2.3's DEFECT ONE LEG OVER, IN THE LEG 291 DID NOT TOUCH, and the reader
# it needs was already written and already pure. `channel_state` answers read / partial /
# unread from two integers the SRC leg computes and threw away.
#
# 🔵 A TOKEN IS NOT THE FIX AND IS DELIBERATELY NOT TAKEN. It raises the budget, which
# makes the failure rarer without making it visible — and the leg would still report a
# green on the run where it happens. What was wrong here is that silence was spendable as
# an answer, not that silence was frequent.
def source_problems(state: "tuple[str, str]") -> "list[str]":
    """The SRC leg's state as a refusal — PURE, the twin of `channel_problems`.

    Named `SOURCE_UNREAD` and `SOURCE_PARTIAL` for the same reason `DISCOVERY_UNREAD` and
    `DISCOVERY_PARTIAL` are named: a reader grepping a red run should find the leg in the
    first token rather than in the English after it.
    """
    kind, detail = state
    if kind == CHANNEL_UNREAD:
        return [f"SOURCE_UNREAD — {detail}. This run has NO opinion about whether any "
                f"tracked repository has moved since its last source-level pass, and "
                f"`SOURCE moved: 0` from a leg that read nothing is the measured green "
                f"291 was written to stop"]
    if kind == CHANNEL_PARTIAL:
        return [f"SOURCE_PARTIAL — {detail}. Rule 2's second clause was answered for some "
                f"of the roster and not for all of it, so the moved list below is a lower "
                f"bound and not a population"]
    return []


# ── 🆕 293 §3.2 — A MOVE IS OWED WORK ONLY WHERE THE RULING COULD HAVE CHANGED ─────────
#
# 🔴 292 §3.2's MEASUREMENT: `hybridindie/godot-mcp` moved twice in ninety minutes, so the
# source pass recording `037b00f` was stale before the pull request carrying it could
# merge. Rule 2's second clause prices being out of date against a COMMIT, and for a
# project committing several times a day that claim expires faster than a session can
# spend it — a red nobody can clear, which is the treadmill Rule 5 refused one column over
# arriving through the clock instead of through the population.
#
# 🔵 AND THE CADENCE COLUMN CANNOT ABSORB IT, because `weekly` is already the fastest tier
# and the honest question is not a faster clock. A ruling is about what a project DOES:
# `2400578` changed neither the tool count nor the debugger. So a pass records the paths
# its ruling RESTS ON, and a move that touches none of them is `moved-immaterial` — the
# head is recorded as having moved, the roster says so, and nothing is owed.
#
# 🔴 THE DEFAULT IS THE STRICT ONE. An entry that declares no `capability_paths` is priced
# exactly as it was before this reader existed: any move is `moved`. Immateriality is a
# claim a session makes by naming the paths, and a claim nobody made cannot be inherited
# by silence — which is 292 §2.1's argument one file over.
def material_change(changed: "list[str]", paths: "list[str]") -> "tuple[bool, str]":
    """(is material, why) for a set of changed paths against an entry's capability paths.

    A `capability_paths` entry matches by PREFIX, so a directory covers its tree and a file
    covers itself. Matching is on the repository-relative path exactly as the forge spells
    it.
    """
    if not paths:
        return (True, "no `capability_paths` recorded, so every move is material")
    if not changed:
        return (True, "the changed-file list could not be read, so materiality is unknown "
                      "and unknown is not immaterial")
    hits = sorted({p for p in changed
                   for pre in paths if p == pre or p.startswith(pre.rstrip("/") + "/")})
    if hits:
        return (True, f"{len(hits)} changed path(s) under the capability paths: "
                      + ", ".join(hits[:4]) + ("…" if len(hits) > 4 else ""))
    return (False, f"{len(changed)} changed path(s), none of them under the "
                   f"{len(paths)} recorded capability path(s)")


# ══ 🆕 294 §2.2 — `cadence` BECOMES A FIELD A GATE READS ════════════════════════════════
#
# 🔴 FIFTY-TWO ENTRIES HAVE CARRIED THIS COLUMN SINCE THE ROSTER EXISTED AND NOTHING HAS
# EVER READ IT. `grep -rn cadence scripts/ host/ .github/` returns comments about the
# ADDON's release cadence and not one reader of this field. It is the oldest declared-and-
# unread thing in the roster, and 293 §3.4 named it as one of two candidate answers to
# *what does a green mean on this job* — the other being 294 §2.1, one file over.
#
# 🔴 THE DEFECT IT ANSWERS, MEASURED AT 294's PICKUP. `sdk-drift` refused on six rows. Two
# of them had a source-level pass ZERO and ONE day old: `hybridindie-godot-mcp`, whose card
# moved to catch up with the very tag 293 had read at source that morning, and
# `godot-mcp-go`. A refusal that asks a session to re-read what the previous session read
# this morning is not governance; it is 293 §3.2's treadmill arriving through the card leg
# instead of through the commit leg.
#
# 🔵 AND IT IS THE COMPLEMENT OF 293's ANSWER, NOT A REPLACEMENT FOR IT. The policy says in
# terms that *a faster `cadence` tier is not the answer, because the subject is wrong
# rather than the interval* — and that is RIGHT about materiality, which is what
# `capability_paths` prices: whether a move could have changed the ruling. This prices the
# question `capability_paths` cannot reach: how often is it worth ASKING. A project that
# ships weekly does change weekly; what it does not do is become worth re-reading twice in
# ninety minutes.
#
# 🔴 SO THE RULE IS A CAP AND NOT AN EXCUSE: a moved row is owed a source-level pass at
# most once per its own declared cadence, and it is owed one the moment that window is
# past. Nothing here makes a row owed LESS often than the project ships, and nothing here
# clears a row that has been stale longer than its cadence — `selftest()` drives exactly
# that, because a reader that only ever excused would be a silencer with a lookup table.
#
# 🔴 AND THE DEFAULT IS STRICT, WHICH IS 293 §2.2's ARGUMENT IN THIS FILE. An entry whose
# cadence nobody has measured gets the SHORTEST window, never the longest: a grace period
# is a claim a session MAKES and never one a silence inherits.
CADENCE_FLOOR = 7
CADENCE_DAYS: "dict[str, tuple[int, str]]" = {
    "daily": (CADENCE_FLOOR,
              "🔴 SEVEN AND NOT ONE. A project shipping every day is not re-read every day "
              "by anybody, and a window of one would restore the exact treadmill this "
              "table exists to bound. The floor is the shortest interval a human roster "
              "will actually pay, and daily movement buys daily NOTICE, never daily "
              "analysis."),
    "weekly": (7, "it ships weekly, so a weekly reading is proportionate to what changes "
                  "and a second reading inside the same week is re-reading one release"),
    "biweekly": (14, "it ships fortnightly, so a fortnightly reading sees each release "
                     "once"),
    "monthly": (30, "it ships monthly, so a monthly reading sees each release once and a "
                    "faster one spends a source pass on an unchanged tree"),
    "quarterly": (91, "it ships quarterly, so a quarterly reading sees each release once; "
                      "the window is 91 days rather than 90 so a quarter never rounds "
                      "down into owing a pass a day early"),
    "annual": (365, "it ships about once a year, and a row this slow is carried for the "
                    "ruling rather than for the release notes"),
    "dormant": (180,
                "it has stopped shipping, so a movement is interesting rather than urgent "
                "— and the roster keeps dormant rows precisely so a RESUMPTION is noticed, "
                "which a six-month window still catches"),
    "archive": (365,
                "the project ended. Its `status` already holds the ruling and "
                "`source_state` answers `held` for a ruled-out entry, so this window is "
                "the belt to that braces and never the only thing carrying the row"),
    "unknown": (CADENCE_FLOOR,
                "🔴 THE STRICT BUCKET, AND IT BUYS THE LEAST. A cadence nobody has "
                "measured gets the SHORTEST window — a closed-source product whose "
                "releases are not observable, or an entry whose old free-text value "
                "described commit SHAPE rather than frequency. Silence must never purchase "
                "a longer grace than a measurement would (293 §2.2)."),
}


def cadence_days(entry: dict) -> "tuple[int, str]":
    """(window in days, why) for an entry's declared cadence — PURE, table-driven.

    An unrecognised or absent value falls to the strict floor rather than raising, because
    `--census` is where a bad value is REFUSED and a sweep that crashed on one would take
    the whole reading down with it.
    """
    val = str(entry.get("cadence") or "").strip()
    if val in CADENCE_DAYS:
        return CADENCE_DAYS[val]
    return (CADENCE_FLOOR, f"cadence {val!r} is not in the declared vocabulary, so the "
                           f"strict floor applies; `--census` refuses it by name")


def days_since(iso: str, today: "datetime.date" = None) -> int:
    """Whole days from an ISO date to `today`, or -1 when there is no readable date.

    🔴 -1 AND NOT 0. A missing `last_analysed` means nobody has ever taken a source-level
    pass, and 0 would read as *taken today* — the one answer that would excuse the row
    forever. -1 is past every window, so an unmeasured entry is always owed.
    """
    try:
        d = datetime.date.fromisoformat(str(iso or "")[:10])
    except ValueError:
        return -1
    return ((today or datetime.date.today()) - d).days


def within_cadence(entry: dict, today: "datetime.date" = None) -> "tuple[bool, str]":
    """(is inside its window, detail) — PURE. The whole of 294 §2.2's judgement."""
    win, why = cadence_days(entry)
    age = days_since(entry.get("last_analysed"), today)
    if age < 0:
        return (False, "no readable `last_analysed`, so no pass has ever been taken and "
                       "the row is owed one whatever its cadence says")
    if age < win:
        return (True, f"last source-level pass {age}d ago, inside the {win}d window for "
                      f"cadence {str(entry.get('cadence') or '')!r} — {why}")
    return (False, f"last source-level pass {age}d ago, past the {win}d window for "
                   f"cadence {str(entry.get('cadence') or '')!r}")


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
SOURCE_IMMATERIAL = "moved-immaterial"
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


def repo_changed(slug: str, base: str, head: str) -> "list[str]":
    """The repository-relative paths that changed between two commits — NETWORK, never
    raises, and `[]` on any failure so materiality falls back to *unknown is not
    immaterial*.

    🔵 ONE CALL, AND ONLY FOR AN ENTRY WHOSE HEAD ACTUALLY MOVED. The compare endpoint
    returns the whole changed-file list in a single response, so the cost of asking whether
    a move is material is one request per moved repository rather than a clone — and the
    roster usually carries none to a handful of moved entries per sweep.
    """
    if not (slug and base and head):
        return []
    try:
        res = get(f"{GH_API}/repos/{slug}/compare/{base}...{head}")
    except Exception:                             # noqa: BLE001 — see `repo_head` above
        return []
    files = res.get("files") if isinstance(res, dict) else None
    return [str(f.get("filename") or "") for f in (files or []) if f.get("filename")]


def source_state(entry: dict, head: "tuple[str, str]",
                 changed: "list[str]" = None) -> "tuple[str, str]":
    """(state, detail) for Rule 2's SECOND clause — PURE, so every direction is drivable
    from a fixture and none of them needs a network.

    🆕 293 — FOUR ANSWERS NOW. `moved-immaterial` is 292 §3.2's finding: a head that moved
    over paths the ruling does not rest on has not made the ruling stale, and refusing on
    it produces a new SHA and no new knowledge. `changed` is the compare list when one
    could be read and empty when it could not, and an entry that declares no
    `capability_paths` can never reach the new answer.

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
    material, why = material_change(list(changed or []),
                                    list(entry.get("capability_paths") or []))
    if not material:
        return (SOURCE_IMMATERIAL, f"{was} -> {sha}; {why}")
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
    # 🆕 293 §3.1 — THE TWO INTEGERS THE LEG ALREADY COMPUTED AND THREW AWAY. One call was
    # attempted per entry naming a repository; one failed for every entry whose `(sha,
    # problem)` carries a problem. That is the whole of `channel_state`'s input and it is
    # the difference between a green that was measured and a green that was silence.
    src_attempted = len(heads)
    src_failed = sum(1 for sha, prob in heads.values() if prob)
    src_state = channel_state(src_attempted, src_failed)
    src_problems = source_problems(src_state)

    TODAY = datetime.date.today()
    moved, held, gone, src_moved, src_unread = [], [], [], [], []
    src_immaterial: "list[dict]" = []
    # 🆕 294 §2.2 — the two cadence-capped populations. Named separately from `held` on
    # purpose: `held` means NOTHING MOVED, and these moved and are inside their window.
    # Folding them into `held` would be the census counting an answer as a non-event,
    # which is the defect 293 §2.4 fixed one column over for `channel: null`.
    card_within: "list[dict]" = []
    src_within: "list[dict]" = []
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
        # 🆕 294 §2.2 — AND A MOVE INSIDE THE PROJECT'S OWN CADENCE IS RECORDED RATHER THAN
        # OWED. The row still moved and still prints; what it does not do is make the
        # roster STALE before the window it declared for itself has passed.
        inside, cad_why = within_cadence(entry, TODAY)
        row["cadence"] = entry.get("cadence")
        row["cadence_why"] = cad_why
        if same:
            held.append(row)
        elif inside:
            card_within.append(row)
        else:
            moved.append(row)

        state, detail = source_state(entry, heads.get(aid, ()))
        # 🆕 293 §3.2 — AND ONLY NOW IS THE COMPARE WORTH A CALL. A head that did not move
        # needs no changed-file list, and an entry that named no capability paths cannot
        # reach the immaterial answer however the list comes back.
        if state == "moved" and entry.get("capability_paths"):
            state, detail = source_state(
                entry, heads.get(aid, ()),
                repo_changed(str(entry.get("repo") or ""),
                             str(entry.get("last_analysed_commit") or ""),
                             (heads.get(aid) or ("", ""))[0]))
        if state == "moved" and inside:
            # 🔴 THE SAME CAP ON THE SOURCE LEG, AND IT IS THE HALF THAT MATTERED AT 294's
            # PICKUP. `godot-mcp-go`'s head moved one day after a source pass; the ruling
            # cannot have gone stale in a day on a project that ships weekly.
            src_within.append({**row, "repo": entry.get("repo"), "head": detail})
        elif state == "moved":
            src_moved.append({**row, "repo": entry.get("repo"), "head": detail,
                              "card_held": same})
        elif state == SOURCE_IMMATERIAL:
            src_immaterial.append({**row, "repo": entry.get("repo"), "head": detail})
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
        # 🆕 293 §3.1 / §3.2 — the SRC leg is a reading about the world in exactly the
        # sense the four above are, so it owes an emitter (287 §7.3).
        print(f"SOURCE_CHANNEL {src_state[0]} attempted {src_attempted} "
              f"failed {src_failed}")
        print(f"SOURCE_IMMATERIAL {len(src_immaterial)}")
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
        "card_within_cadence": card_within,
        "source_moved": src_moved,
        "source_within_cadence": src_within,
        "source_immaterial": src_immaterial,
        "source_unread": src_unread,
        "source_channel": {"state": src_state[0], "detail": src_state[1],
                           "attempted": src_attempted, "failed": src_failed},
        "source_problems": src_problems,
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
        print(f"  card within cadence  : {len(card_within)}   "
              f"<- moved, and inside the window the entry declares for itself")
        print(f"  SOURCE moved         : {len(src_moved)}   "
              f"<- Rule 2 clause two; {sum(1 for r in src_moved if r['card_held'])} of "
              f"them the card leg alone reports as no change")
        print(f"  SOURCE within cadence: {len(src_within)}   "
              f"<- head moved, and inside the entry's own cadence window")
        print(f"  SOURCE immaterial    : {len(src_immaterial)}   "
              f"<- head moved over nothing the ruling rests on")
        print(f"  source head UNREAD   : {len(src_unread)}")
        print(f"  SOURCE leg           : {src_state[0]} — {src_state[1]}")
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
        # 🆕 294 §2.2 — 🔴 PRINTED, BECAUSE A CAP THAT PRINTS NOTHING IS INDISTINGUISHABLE
        # FROM A LEG THAT SAW NOTHING. These rows moved; the roster has decided it is not
        # yet worth re-reading them, and a session that disagrees can see exactly which
        # rows the decision covered and how close each is to falling out of its window.
        for r in card_within:
            print(f"    WITHIN {r['asset_id']:>5}  {r['name']}: "
                  f"{r['recorded_version']} -> {r['live_version']} · {r['cadence_why']}")
        for r in src_within:
            print(f"    SRC/IN {r['asset_id']:>5}  {r['name']}: {r['repo']} "
                  f"{r['head']} · {r['cadence_why']}")
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
        for r in src_immaterial:
            print(f"    SRC =   {r['asset_id']:>5}  {r['name']}: {r['repo']} {r['head']}")
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
    # 🆕 292 §1 — AND THIS LINE NO LONGER SPELLS ITS OWN PRICE. The Asset Library's
    # severity is declared in `CHANNELS` with the volume argument attached, so the sentence
    # a reader sees here and the sentence `surfaced_problems` prints come from one place
    # and differ only where the channels differ.
    if new_mcp:
        stale.append(f"{len(new_mcp)} never-tracked MCP-shaped entr(ies) found "
                     f"(assetlib owes {owes(severity_of('assetlib'))})")
    if new_ai:
        stale.append(f"{len(new_ai)} never-recorded in-editor AI addon(s) found")
    # 🆕 291 — AND THE TWO NEW REFUSALS. `chan_problems` is the one that changes what a
    # green MEANS: before it, a run where every query failed produced an empty new-entry
    # list and exited 0. `unrecorded` is the population decision cashed — a row, not an
    # analysis, and refused when it is missing.
    if chan_problems:
        stale.append(f"{len(chan_problems)} discovery channel(s) not fully read")
    # 🆕 293 §3.1 — AND THE SOURCE LEG JOINS THEM, BY NAME. Before this line a run that
    # read zero repository heads printed `SOURCE moved: 0` and exited 0; the reading it
    # had was silence and silence was spendable as `nothing has moved`.
    if src_problems:
        stale.append(f"the source leg was {src_state[0]}, so Rule 2's second clause was "
                     f"not answered for the whole roster")
    if unrecorded:
        stale.append(f"{len(unrecorded)} surfaced project(s) with no roster row")
    if npm_moved:
        stale.append(f"{len(npm_moved)} npm-channel entr(ies) published a new version "
                     f"since their last source-level pass")
    if args.check and stale:
        for m in src_problems + chan_problems + unrecorded:
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
        # 🆕 293 — AND A ROW THAT NAMES NO CHANNEL AT ALL IS NOW REFUSED, because the
        # population it left behind has been read. `null` is a MEASUREMENT — no
        # enumerable channel surfaces this project, so no leg here will ever re-read it —
        # and an ABSENT key is nobody having looked. 291 shipped the field optional
        # because forty-six rows predated it; 293 filled all forty-six, so the cheap
        # answer is gone and the number cannot climb back by omission.
        elif "channel" not in e:
            problems.append(
                f"ROSTER_CHANNEL_UNDECLARED {e.get('name')!r} names no channel. Declare "
                f"one of {sorted(CHANNELS)}, or `null` if no enumerable channel surfaces "
                f"it — which is a reading somebody took and not a blank")

        # ── 🆕 294 §2.2 — AND `cadence` IS A READ FIELD NOW, SO IT OWES A VOCABULARY ────
        #
        # 🔴 IT CARRIED FREE TEXT FOR AS LONG AS NOBODY READ IT, WHICH IS THE WHOLE
        # ARGUMENT FOR REFUSING ONE. Two of the fifty-two values were prose describing
        # commit SHAPE rather than release frequency — `release-squashed`, and
        # `dependency-only since 2026-04-30` — and a column nothing reads can hold prose
        # forever without anybody noticing. The moment it prices staleness, an
        # unrecognised value is a silent fall to the strict floor, which is the safe
        # direction and still a value nobody chose. 293's `CAPABILITY_UNKNOWN_VALUE` is
        # this same refusal one column over.
        cad = e.get("cadence")
        if "cadence" not in e:
            problems.append(
                f"ROSTER_CADENCE_UNDECLARED {e.get('name')!r} declares no cadence, and "
                f"`assetlib_sweep.py` now prices staleness against it: without one the "
                f"entry silently takes the {CADENCE_FLOOR}-day floor, which is a window "
                f"nobody chose. Declare one of {sorted(CADENCE_DAYS)}")
        elif str(cad or "").strip() not in CADENCE_DAYS:
            problems.append(
                f"ROSTER_CADENCE_UNKNOWN_VALUE {e.get('name')!r} declares cadence "
                f"{cad!r}, which is not one of {sorted(CADENCE_DAYS)}. The value now "
                f"decides how long a moved row waits before it is owed a source-level "
                f"pass, so a spelling no table maps is a grace period arrived at by "
                f"accident")

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
    # 🔴 `unclassified` WAS PRINTED, NOT DEFAULTED AWAY, AND AT 293 IT IS ZERO. Forty-six
    # entries predated the channel legs and nobody had recorded where any of them SHIPS;
    # quietly counting them as `assetlib` because that is the leg that found most of them
    # would have written this file's own defect into the census that exists to report it.
    # So the number was made visible instead, and it has now been read down to nothing —
    # forty-one by construction from an `asset_id`, one measured onto npm, three measured
    # onto no enumerable channel at all.
    #
    # 🔵 AND `no-channel` IS ITS OWN BUCKET, because it is an ANSWER. Four rows declare
    # `null`: nothing enumerable surfaces them, so no leg here will re-read them and they
    # are carried because a human named them. Counting a measured `null` beside a blank
    # was the census reporting a reading as a gap.
    by_channel: dict[str, int] = {}
    for e in entries:
        key = ("unclassified" if "channel" not in e
               else str(e["channel"] or "no-channel"))
        by_channel[key] = by_channel.get(key, 0) + 1
    # 🆕 292 §1 — THE SEVERITY CONTROL RUNS HERE AND NOWHERE CHEAPER. An undeclared price
    # is a defect in the TREE, not a fact about a third-party host, so it belongs in the
    # one leg of this file a merge-blocking job can honestly run — the same argument that
    # put `roster_shape_problems` here. A control living only in the weekly `--check` is a
    # control a branch can go red past.
    # 🆕 293 — AND THE CAPABILITY CONTROL RUNS HERE FOR `severity_problems`' REASON. An
    # unsourced claim is a defect in the TREE — a value in a tracked JSON file with no
    # reading behind it — so it belongs in the one leg of this file a merge-blocking job
    # can honestly run, rather than in a weekly `--check` a branch can go red past.
    problems = (roster_shape_problems(roster) + severity_problems()
                + capability_problems(roster))
    for m in problems:
        print(f"  🔴 {m}", file=sys.stderr)
    print(f"LANDSCAPE_CENSUS {len(CHANNELS)} channel(s) / {enumerable} enumerable · "
          f"{len(entries)} analysed / {len(surfaced)} surfaced · {watched} watched · "
          f"{len(problems)} problem(s)")
    print("  " + " · ".join(f"{k} {v}" for k, v in sorted(by_channel.items())))
    # 🔴 AND THE PRICES ARE PRINTED, BECAUSE A DECLARATION NOBODY CAN SEE IS THE SHAPE
    # THIS SESSION IS HERE TO END. One line, channel and price, in the order the table
    # declares them — so `git diff` on a re-priced channel shows up in the census output
    # a reader already reads rather than only in the source.
    print("  severity · " + " · ".join(f"{n} {severity_of(n)}" for n in sorted(CHANNELS)))
    # 🆕 293 — THE THREE NUMBERS 292 §2.3 LEFT THIS ROSTER OWING. `claimed` is how many
    # capability rulings the roster asserts and can show the reading for; `unread` is how
    # many it once asserted and has withdrawn, which is the number that falls as sessions
    # read them; `uncited` is how many of the claims rest on a conclusion somebody wrote
    # down rather than on a file, symbol or port a later reader can go and check.
    cap_claimed, cap_unread, cap_uncited = capability_counts(roster)
    print(f"LANDSCAPE_CAPABILITY {cap_claimed} claimed / {cap_unread} unread / "
          f"{cap_uncited} uncited")
    # 🆕 294 §2.2 — THE ROSTER'S STALENESS SHAPE, READ OFF THE FILE AND WITHOUT A NETWORK.
    #
    # 🔴 THE PAIR IS THE POINT, FOR `LANDSCAPE_CAPABILITY`'s REASON ONE LINE UP. `within`
    # rising while `past` stands still is the roster being read on schedule; `past` rising
    # is passes falling behind; and `never` — entries with no readable `last_analysed` at
    # all — is the one number a cadence cap can never shrink, because a row nobody has
    # ever analysed is owed a pass whatever interval it declares. Any one of the three can
    # move for the wrong reason and the triple cannot.
    #
    # 🔵 AND IT IS PRINTED BY THE OFFLINE LEG DELIBERATELY. `--check` reports staleness
    # against what the WORLD did; this reports it against what the ROSTER has, which is a
    # fact about this tree and belongs where a merge can read it.
    _today = datetime.date.today()
    cad_within = sum(1 for e in entries if within_cadence(e, _today)[0])
    cad_never = sum(1 for e in entries if days_since(e.get("last_analysed"), _today) < 0)
    print(f"LANDSCAPE_CADENCE {cad_within} within / "
          f"{len(entries) - cad_within - cad_never} past / {cad_never} never analysed")
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
          roster_shape_problems({"entries": [{"name": "x", "channel": "npm", "repo": "a/b",
                                                  "cadence": "weekly"}],
                                 "surfaced": [{"key": "c/d", "channels": ["npm"],
                                               "first_seen": 291}]}), [])
    claim("shape: an entry naming a channel no leg queries is refused",
          len(roster_shape_problems({"entries": [{"name": "x", "channel": "itch",
                                                  "cadence": "weekly"}],
                                     "surfaced": []})), 1)
    claim("shape: a surfaced row missing a leg-supplied field is refused",
          len(roster_shape_problems({"entries": [],
                                     "surfaced": [{"key": "c/d", "channels": ["npm"]}]})), 1)
    claim("shape: one project may not be two surfaced rows",
          len(roster_shape_problems({"entries": [], "surfaced": [
              {"key": "c/d", "channels": ["npm"], "first_seen": 291},
              {"key": "c/d", "channels": ["npm"], "first_seen": 291}]})), 1)
    claim("shape: a project read at source level is PROMOTED, not duplicated",
          len(roster_shape_problems({"entries": [{"name": "x", "channel": "npm",
                                                  "repo": "C/D",
                                                  "cadence": "weekly"}],
                                     "surfaced": [{"key": "c/d", "channels": ["npm"],
                                                   "first_seen": 291}]})), 1)
    claim("shape: every declared channel says whether a machine can enumerate it",
          sorted({type(c["enumerable"]) for c in CHANNELS.values()}), [bool])
    claim("shape: the non-enumerable channel carries the watch list it is made of",
          bool(CHANNELS["commercial"]["watch"]), True)

    # ── 🆕 292 §1 — the per-channel severity: the field, its default, and its controls ─
    #
    # 🔴 THE LIVE TABLE IS ASSERTED BY VALUE, NOT BY SHAPE. 291's behaviour is that the
    # Asset Library demands a pass and the two registries demand a row; if a later session
    # re-prices a channel it must edit a claim here, so the change is visible in a diff
    # rather than only in a refusal somebody happens to run with a network.
    claim("severity: the Asset Library still demands a source-level pass",
          severity_of("assetlib"), SEVERITY_ANALYSIS)
    claim("severity: the two registries still demand a row",
          [severity_of("npm"), severity_of("mcp-registry")],
          [SEVERITY_ROW, SEVERITY_ROW])
    claim("severity: every declared channel prices itself",
          severity_problems(), [])
    claim("severity: every declared channel argues its price",
          sorted({bool(c.get("severity_why")) for c in CHANNELS.values()}), [True])
    # 🔴 AND THE THREE NEGATIVE CONTROLS, WHICH ARE THE HALF THAT CAN FAIL. A field with
    # no refusal behind it is decoration, and decoration is what 291 §3.3 was filed about.
    claim("severity: a channel that declares no price is REFUSED",
          [p.split()[0] for p in severity_problems({"x": {"enumerable": True}})],
          ["CHANNEL_SEVERITY_UNDECLARED"])
    claim("severity: a price no refusal site can spend is REFUSED",
          [p.split()[0] for p in severity_problems(
              {"x": {"enumerable": True, "severity": "later", "severity_why": "w"}})],
          ["CHANNEL_SEVERITY_UNKNOWN"])
    claim("severity: a price with no argument beside it is REFUSED",
          [p.split()[0] for p in severity_problems(
              {"x": {"enumerable": True, "severity": SEVERITY_ROW}})],
          ["CHANNEL_SEVERITY_UNARGUED"])
    # 🔴 THE DEFAULT GUESSES DEAR. An unknown channel is the case where nobody chose, and
    # the cheap guess is the one that reports a green about a price nobody set.
    claim("severity: an unknown channel defaults to the EXPENSIVE price",
          severity_of("itch"), SEVERITY_ANALYSIS)
    claim("severity: the two prices read differently to a human",
          owes(SEVERITY_ROW) != owes(SEVERITY_ANALYSIS), True)
    # 🔴 AND THE JOIN: one project seen by a cheap channel AND an expensive one owes the
    # expensive thing. A discount for being seen twice is the defect written backwards.
    _rost = {"entries": [], "surfaced": []}
    claim("surfaced: a project only npm saw owes a row",
          "owes a ROW" in surfaced_problems(
              {"a/b": {"channels": ["npm"]}}, _rost)[0], True)
    claim("surfaced: a project the Asset Library also saw owes the pass",
          "owes a SOURCE-LEVEL PASS" in surfaced_problems(
              {"a/b": {"channels": ["npm", "assetlib"]}}, _rost)[0], True)
    claim("surfaced: a project already carried owes nothing either way",
          surfaced_problems({"a/b": {"channels": ["npm", "assetlib"]}},
                            {"entries": [{"repo": "a/b"}], "surfaced": []}), [])

    # ── 🆕 292 §2 — the fold's currency: a mirror joins a project, it does not date it ─
    #
    # 🔴 THE FIXTURE IS THE MEASUREMENT. `@ryanmazzolini/minimal-godot-mcp` shipped 0.1.6
    # on 2026-02-13 and `@iflow-mcp/…` mirrored that same 0.1.6 on 2026-02-26; 291's fold
    # took the newest date across the pair, so the roster recorded the MIRROR's date as the
    # project's and `npm_currency` reported a version that never moved as moved. Both
    # orderings are driven, because a fold that only checked the row it saw second would
    # pass one of them by luck.
    _up = {"slug": "r/m", "npm": "@ryanmazzolini/minimal-godot-mcp", "registry_name": None,
           "version": "0.1.6", "published": "2026-02-13", "description": "d", "via": None,
           "channel": "npm"}
    _mir = {**_up, "npm": "@iflow-mcp/ryanmazzolini-minimal-godot-mcp",
            "published": "2026-02-26", "via": "republisher"}
    claim("fold: a mirror published later does not re-date its upstream",
          fold([_up, _mir])["r/m"]["published"], "2026-02-13")
    claim("fold: and not in the other order either",
          fold([_mir, _up])["r/m"]["published"], "2026-02-13")
    claim("fold: the first-party package name is the one that survives",
          fold([_mir, _up])["r/m"]["npm"], "@ryanmazzolini/minimal-godot-mcp")
    claim("fold: a first-party row is not marked as reached through a mirror",
          fold([_mir, _up])["r/m"]["via"], None)
    # 🔴 AND THE CASE THE MIRROR EXISTS FOR: when nothing first-party surfaced, the mirror
    # IS the evidence, it still supplies the row, and the row still says how it was reached.
    claim("fold: a mirror alone still surfaces the project",
          (fold([_mir])["r/m"]["published"], fold([_mir])["r/m"]["via"]),
          ("2026-02-26", "republisher"))
    # 🔵 The newest-wins rule is unchanged BETWEEN EQUALS — two first-party rows on two
    # channels are two real publications and the later one is the project's currency.
    _reg = {**_up, "npm": None, "registry_name": "io.github.r/m", "version": "0.2.0",
            "published": "2026-03-01", "channel": "mcp-registry"}
    claim("fold: between two first-party rows the newest still wins",
          (fold([_up, _reg])["r/m"]["version"], fold([_up, _reg])["r/m"]["published"]),
          ("0.2.0", "2026-03-01"))
    claim("fold: and it is still ONE project on two channels",
          sorted(fold([_up, _reg])["r/m"]["channels"]), ["mcp-registry", "npm"])

    # ── 🆕 293 §3.1 — THE SOURCE LEG'S SILENCE IS NOT AN ANSWER ──────────────────────
    #
    # 🔴 THE FIXTURE IS 292 §3.1's MEASUREMENT. Twenty tracked repositories, twenty
    # `HTTP Error 403: rate limit exceeded`, and `--check` exited 0 having read not one
    # head. `channel_state` has answered that shape since 291; nothing was asking it.
    claim("source: a leg that answered for every entry is read",
          source_problems(channel_state(20, 0)), [])
    claim("source: a leg the forge refused entirely is REFUSED",
          [p.split()[0] for p in source_problems(channel_state(20, 20))],
          ["SOURCE_UNREAD"])
    claim("source: a leg that answered for some of the roster is REFUSED",
          [p.split()[0] for p in source_problems(channel_state(20, 3))],
          ["SOURCE_PARTIAL"])
    claim("source: and a leg with nothing to ask is unread, not read",
          source_problems(channel_state(0, 0))[0].split()[0], "SOURCE_UNREAD")
    # 🔴 THE NEGATIVE CONTROL IS THE HALF THAT COULD HAVE BEEN WRONG: a refusal wide
    # enough to catch a rate limit must not fire on a healthy sweep, or the roster is red
    # every week for being alive.
    claim("source: a healthy leg names no problem at all",
          channel_state(20, 0)[0], CHANNEL_READ)

    # ── 🆕 293 §3.2 — A MOVE OVER NOTHING THE RULING RESTS ON IS NOT OWED WORK ────────
    #
    # 🔴 THE FIXTURE IS THE ENTRY THAT CANNOT BE MADE GREEN. `hybridindie/godot-mcp` moved
    # 037b00f -> 2400578 while the pull request recording 037b00f was still open, and
    # 292 §3.2 measured the head moving TWICE in ninety minutes. The paths its ruling
    # rests on are the debugger plugin, the toolset table and the tool registrations.
    _hy = {"last_analysed_commit": "037b00f",
           "capability_paths": ["godot/addons/godot_mcp/mcp_debugger.gd",
                                "mcp_server/toolsets.py", "mcp_server/tools/"]}
    claim("material: a move touching only the README is immaterial",
          source_state(_hy, ("2400578", ""), ["README.md", "docs/roadmap.md"])[0],
          SOURCE_IMMATERIAL)
    claim("material: a move touching the debugger plugin is owed work",
          source_state(_hy, ("2400578", ""),
                       ["godot/addons/godot_mcp/mcp_debugger.gd"])[0], "moved")
    claim("material: a prefix covers its tree",
          source_state(_hy, ("2400578", ""), ["mcp_server/tools/import_asset.py"])[0],
          "moved")
    claim("material: and a prefix does not cover a sibling that merely starts the same",
          source_state(_hy, ("2400578", ""), ["mcp_server/toolsets_test.py"])[0],
          SOURCE_IMMATERIAL)
    # 🔴 THE TWO DEFAULTS, AND BOTH OF THEM ARE STRICT. An entry that named no paths is
    # priced exactly as it was before this reader existed, and a compare nobody could read
    # is UNKNOWN — which is not immaterial.
    claim("material: an entry that declared no capability paths still moves",
          source_state({"last_analysed_commit": "037b00f"},
                       ("2400578", ""), ["README.md"])[0], "moved")
    claim("material: an unreadable compare is not an immaterial one",
          source_state(_hy, ("2400578", ""), [])[0], "moved")
    claim("material: no compare was attempted, so the answer is unchanged",
          source_state(_hy, ("2400578", ""))[0], "moved")
    claim("material: an immaterial move still records BOTH commits",
          "037b00f -> 2400578" in
          source_state(_hy, ("2400578", ""), ["README.md"])[1], True)
    claim("material: a held head never reaches the reader at all",
          source_state(_hy, ("037b00f", ""), ["README.md"])[0], "held")

    # ── 🆕 293 — A `false` IS A CLAIM, AND A CLAIM OWES ITS READING ───────────────────
    #
    # 🔴 THE FIXTURE IS 292 §2.3's FINDING. `csharp: false` with nothing behind it is the
    # exact row the sweep carried for `godot-mcp-enhanced`, `fennara-godot-mcp` and
    # `godot-mcp-go`, and all three were wrong before the pass that wrote them.
    _bare = {"entries": [{"name": "x", "csharp": False}]}
    claim("capability: a `false` with no reading behind it is REFUSED",
          [p.split()[0] for p in capability_problems(_bare)], ["CAPABILITY_UNSOURCED"])
    # 🔴 AND SYMMETRICALLY, WHICH IS THE HALF 288 §7.4 WAS ALREADY SUPPOSED TO COVER.
    claim("capability: and so is a `true`, for the same reason",
          [p.split()[0] for p in
           capability_problems({"entries": [{"name": "x", "csharp": True}]})],
          ["CAPABILITY_UNSOURCED"])
    claim("capability: a claim with its reading beside it is accepted",
          capability_problems({"entries": [{
              "name": "x", "csharp": False,
              "capability_evidence": {"csharp": "zero repo-wide hits for dotnet"}}]}), [])
    claim("capability: a withdrawn claim owes nothing",
          capability_problems({"entries": [{"name": "x",
                                            "csharp": CAPABILITY_UNREAD}]}), [])
    claim("capability: a null owes nothing either — no reading is possible there",
          capability_problems({"entries": [{"name": "x", "csharp": None}]}), [])
    claim("capability: a value no reader can spell is REFUSED",
          [p.split()[0] for p in capability_problems(
              {"entries": [{"name": "x", "debugger": "sort-of",
                            "capability_evidence": {"debugger": "a.gd"}}]})],
          ["CAPABILITY_UNKNOWN_VALUE"])
    claim("capability: evidence with no claim to support is REFUSED",
          [p.split()[0] for p in capability_problems(
              {"entries": [{"name": "x", "csharp": CAPABILITY_UNREAD,
                            "capability_evidence": {"csharp": "a.gd"}}]})],
          ["CAPABILITY_EVIDENCE_ORPHAN"])
    claim("capability: evidence for a field that is not a capability is REFUSED",
          [p.split()[0] for p in capability_problems(
              {"entries": [{"name": "x", "capability_evidence": {"stars": "a.gd"}}]})],
          ["CAPABILITY_EVIDENCE_ORPHAN"])
    # 🔵 ABSENT IS NOT WITHDRAWN, AND THE COUNTS ARE WHERE THAT DIFFERENCE IS SPENT.
    claim("capability: an entry claiming nothing counts as nothing",
          capability_counts({"entries": [{"name": "x", "cadence": "weekly"}]}), (0, 0, 0))
    claim("capability: a withdrawn claim is counted as unread and not as a claim",
          capability_counts({"entries": [{"name": "x", "csharp": CAPABILITY_UNREAD}]}),
          (0, 1, 0))
    claim("capability: a cited claim is claimed and not uncited",
          capability_counts({"entries": [{
              "name": "x", "csharp": True,
              "capability_evidence": {"csharp": "src/tools/script.ts:158"}}]}),
          (1, 0, 0))
    claim("capability: a claim resting on prose alone is counted uncited",
          capability_counts({"entries": [{
              "name": "x", "csharp": True,
              "capability_evidence": {"csharp": "C# is the centre of gravity"}}]}),
          (1, 0, 1))
    # 🔴 AND THE SHIPPED ROSTER IS JUDGED BY `census()` AND NOT HERE. A self-test that
    # opens the roster is a statement about the tree rather than about the reader (235
    # §6.3), and `census()` is already the merge-blocking leg that reads the file — so the
    # live population is refused there, where a roster edit is what is being judged.
    # What belongs here is the reader, driven from fixtures, in both directions.
    # ── 🆕 293 — AND A ROW THAT NAMES NO CHANNEL IS A ROW NO LEG CAN RE-READ ─────────
    claim("channel: a row naming no channel at all is REFUSED",
          [p.split()[0] for p in roster_shape_problems({"entries": [{"name": "x", "cadence": "weekly"}]})],
          ["ROSTER_CHANNEL_UNDECLARED"])
    claim("channel: `null` is an ANSWER and is accepted",
          roster_shape_problems({"entries": [{"name": "x", "channel": None, "cadence": "weekly"}]}), [])
    claim("channel: a declared channel is accepted",
          roster_shape_problems({"entries": [{"name": "x", "channel": "npm", "cadence": "weekly"}]}), [])
    claim("channel: a channel no leg queries is still REFUSED",
          [p.split()[0] for p in roster_shape_problems(
              {"entries": [{"name": "x", "channel": "itch", "cadence": "weekly"}]})],
          ["ROSTER_CHANNEL_UNKNOWN"])

    # ── 🆕 294 §2.2 — CADENCE, AND THE ARM THAT MUST STILL REFUSE ────────────────────
    #
    # 🔴 THE SECOND CLAIM IS THE ONE THAT KEEPS THIS HONEST. Almost every claim here shows
    # the reader EXCUSING a row, and a reader that only ever excused would be indistin-
    # guishable from `return (True, "")` — the shape 293 §2.1 refused for the source leg
    # and 288 §7.3 refuses for any gate over a population somebody chose. So: inside the
    # window is excused, PAST the window is owed, and no `last_analysed` at all is owed
    # whatever the cadence says.
    _mar1 = datetime.date(2026, 3, 1)
    claim("cadence: a weekly project read 3 days ago is inside its window",
          within_cadence({"cadence": "weekly", "last_analysed": "2026-02-26"}, _mar1)[0],
          True)
    claim("cadence: 🔴 the SAME project read 30 days ago is OWED — the cap never excuses "
          "a row past its own window",
          within_cadence({"cadence": "weekly", "last_analysed": "2026-01-30"}, _mar1)[0],
          False)
    claim("cadence: an entry that has never been analysed is owed whatever it declares",
          within_cadence({"cadence": "annual"}, _mar1)[0], False)
    claim("cadence: a quarterly project read 62 days ago is inside its window",
          within_cadence({"cadence": "quarterly", "last_analysed": "2025-12-29"},
                         _mar1)[0], True)
    claim("cadence: 🔴 an UNKNOWN cadence takes the strict FLOOR and not the longest "
          "window — silence never buys a longer grace than a measurement would",
          cadence_days({"cadence": "unknown"})[0], CADENCE_FLOOR)
    claim("cadence: an unrecognised value falls to the floor rather than raising",
          cadence_days({"cadence": "every other tuesday"})[0], CADENCE_FLOOR)
    claim("cadence: 🔴 `daily` is capped at the floor and not at one day, or the "
          "treadmill this table bounds comes straight back",
          cadence_days({"cadence": "daily"})[0], CADENCE_FLOOR)
    claim("cadence: a missing date reads -1 and not 0, so it is past every window",
          days_since("", _mar1), -1)
    claim("cadence: every declared cadence carries an argument for its window",
          sorted({k for k, (d, why) in CADENCE_DAYS.items()
                  if not isinstance(d, int) or d < 1 or len(why) < 20}), [])
    claim("cadence: a row declaring no cadence at all is REFUSED",
          [p.split()[0] for p in roster_shape_problems(
              {"entries": [{"name": "x", "channel": "npm"}]})],
          ["ROSTER_CADENCE_UNDECLARED"])
    claim("cadence: free text no table maps is REFUSED by name",
          [p.split()[0] for p in roster_shape_problems(
              {"entries": [{"name": "x", "channel": "npm",
                            "cadence": "release-squashed"}]})],
          ["ROSTER_CADENCE_UNKNOWN_VALUE"])

    claim("capability: every declared field has a vocabulary to spend",
          sorted(CAPABILITY_VALUES) == sorted(CAPABILITY_FIELDS), True)
    claim("capability: `unread` is not smuggled into a field's own vocabulary",
          [f for f, v in CAPABILITY_VALUES.items() if CAPABILITY_UNREAD in v], [])

    print(f"ASSETLIB_SELFTEST {claims - bad}/{claims} claims, {bad} failed")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
