#!/usr/bin/env python3
"""Static contract check for breakpoint-mcp.

Verifies, without running Godot or Node, that the three layers agree:
  1. every bridge method the host calls exists in a GDScript dispatcher
  2. every GDScript dispatch method is reachable from the host (orphan scan)
  3. registered MCP tool names are unique
  4. the tool catalog lists exactly the registered tools
  5. every fenced ```json block in the catalog is valid JSON
  6. NAME parity is not enough — SHAPE parity too: for every tool the catalog
     documents with an Input block, its documented params match the tool's
     `inputSchema` param names (shared schemas, `{...spread}`, and the universal
     `confirm` gate param are resolved/ignored)
  7. every field a tool pins in `host/src/schemas.ts` `outputSchemas` is
     documented in that tool's catalog Output block (return-shape parity)
  8. `outputSchemas` hygiene: no schema entry names a tool that does not exist
  9. MCP annotations are total: every registered tool is on `ALL_ANNOTATED`
 10. MCP resources: the registered set matches the expected roster, and every
     resource count the LIVE docs state agrees with the code
 11. Tool counts: every full-surface / secure-default / privileged-drop count
     stated in the live docs, in source prose, or in a host-test constant
     agrees with the code
 12. Recipes: the registered MCP prompts, the `RECIPE_NAMES` constant, and
     every live doc that names a recipe all agree on the roster
 13. Family claims are exact: every tool-name glob a doc counts, plus the
     all-annotations-false class, resolves against the code — with an explicit
     exemption roster rather than a silent skip
 14. Version parity: the host version in `host/package.json` and the addon
     version in the canonical `plugin.cfg` match every tracked copy and stamp,
     and no untracked copy of either file exists outside the roster
 15. File modes: the set of tracked files committed 100755 is exactly the exec
     roster, and every roster member carries an interpreter line
 16. Shape parity has a FLOOR: checks 6 and 7 compare intersections, so a tool
     the catalog parser cannot read drops out silently. Every tool must be
     compared, or exempt with a reason — asserted as set equality both ways
 17. The example project's renderer and autoload form: `gl_compatibility` on
     both rendering_method keys, and the autoload on the `res://` PATH form —
     the `uid://` form is REJECTED, carrying the CI output that proved it
     breaks 4.3 and every cold clone as the stated reason
 18. Every tracked `.gd` inside a Godot project this repo opens (`example/`,
     `example-csharp/`) has its `.uid` sidecar committed, so a boot or
     `--import` cannot leave permanent untracked noise in `git status`
 19. The DISTRIBUTABLE addon (`addons/breakpoint_mcp/`) ships NO `.uid`
     sidecars — the opposite rule to 18, for the reason spelled out there:
     the addon has no `uid://` references of its own, so a pinned uid buys
     nothing and costs a duplicate-uid warning for anyone vendoring a copy

Exit code 0 = all hard checks pass; 1 = a hard check failed.
"""
import json
import hashlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADDON = ROOT / "addons/breakpoint_mcp"
TOOLS = ROOT / "host/src/tools"
SCHEMAS = ROOT / "host/src/schemas.ts"
ANNOTATIONS = ROOT / "host/src/annotations.ts"
CATALOG = ROOT / "docs/TOOL_CATALOG.md"
HOST_SRC = ROOT / "host/src"
HOST_TEST = ROOT / "host/test"
CAPABILITIES = ROOT / "host/src/capabilities.ts"
RECIPES = ROOT / "host/src/recipes.ts"

# Live docs whose prose states the MCP resource count. `CHANGELOG.md` is
# deliberately EXCLUDED: it is an append-only historical record, and its older
# "5 MCP resources" lines were correct for the releases they describe. Same
# scoping rule the 276→286 comment fix used — gate the live surface, never the
# changelog's account of past ones.
RESOURCE_DOCS = [
    ROOT / "README.md",
    ROOT / "host/README.md",
    ROOT / "docs/TOOL_CATALOG.md",
    ROOT / "docs/USER_GUIDE.md",
]

# The MCP resources the WIRED server exposes: five from host/src/tools/resources.ts
# (the `resources` toolset) plus the always-on `godot://capabilities` from
# host/src/capabilities.ts, which index.ts registers unconditionally.
#
# Held as an explicit roster, not derived, so adding a resource is a deliberate
# edit here as well as in the source — which is the point of the gate.
EXPECTED_RESOURCE_URIS = {
    "godot://scene-tree",
    "godot://editor-state",
    "godot://runtime/tree",
    "godot://runtime/log",
    "godot://class/{name}",
    "godot://capabilities",
}

# Docs that MUST state a resource count, whether or not they currently do.
#
# Without this the doc half of check 10 is opt-in: `doc_resource_claims()`
# returns regex hits, so "N doc count(s) checked" is matches FOUND, not sites
# required. Reword every "6 MCP resources" to "six MCP resources" and the line
# reads `6 registered · 0 doc count(s) checked` — and the gate still passes,
# because there is nothing left to disagree with. Ship a 7th resource that way
# and no doc has to mention it.
#
# This mirrors RECIPE_ROSTER_REQUIRED exactly. Check 12 closed this same hole
# for recipes; check 10 had a code-side roster (EXPECTED_RESOURCE_URIS) and no
# doc-side counterpart, so the fix already existed in this file, two checks
# over, and simply was not applied here. Every entry must also appear in
# RESOURCE_DOCS or it is never scanned; that is asserted at the check rather
# than left as a comment.
RESOURCE_COUNT_REQUIRED: set[Path] = {
    ROOT / "README.md",
    ROOT / "docs/USER_GUIDE.md",
}

# Modules that speak to the Godot addon and are therefore scanned by check 1 for
# bridge methods with no GDScript handler.
BRIDGE_CALL_SCAN: list[Path] = [
    *sorted((TOOLS / "editor").glob("*.ts")),
    TOOLS / "runtime.ts",
    TOOLS / "resources.ts",
    TOOLS / "assetgen.ts",
    TOOLS / "netcode.ts",
    TOOLS / "backend.ts",
]

# Modules that use the same `.request("…")` shape but are NOT talking to the
# Godot bridge: these drive a DapClient over the Debug Adapter Protocol, so
# "evaluate" / "scopes" / "variables" / "goto" are DAP requests and have no
# GDScript handler by design. Scanning them would fail the gate on correct code.
#
# The exemption is right; what was missing is that nothing asserted the roster
# stayed complete. A `bridge.call("made.up.method")` added to any of the eleven
# UNSCANNED modules left `Host bridge calls: 176` unchanged and exited 0 — the
# same line in a scanned module failed the gate. Check 14 already scans for
# unlisted copies of the files it gates rather than trusting its roster; check 1
# now does the same, so a new bridge-speaking module must be filed deliberately
# into one list or the other instead of being silently invisible.
BRIDGE_SCAN_EXEMPT: set[Path] = {
    TOOLS / "dap.ts",
    TOOLS / "csdap.ts",
}

# Live docs that may carry the recipe roster. Held as its own list rather than
# reusing RESOURCE_DOCS: the two are identical today but are free to diverge,
# and sharing one list would silently widen one gate whenever the other grew.
# `CHANGELOG.md` is excluded for the same reason it is excluded from check 10 —
# it is an append-only record, and its older six-recipe lines were correct for
# the releases they describe.
RECIPE_DOCS = [
    ROOT / "README.md",
    ROOT / "host/README.md",
    ROOT / "docs/TOOL_CATALOG.md",
    ROOT / "docs/USER_GUIDE.md",
]

# Docs allowed to name SOME recipes without naming all of them. Deliberately
# EMPTY: strict-by-default is the whole point. A doc that legitimately cites a
# single recipe as an example belongs here WITH A REASON, so the exemption is a
# visible edit — rather than the gate carrying a threshold ("names two or more,
# so it must be a roster") that a list one entry short slips straight under.
# That is the hole 11b's first version was replaced for having.
RECIPE_ROSTER_EXEMPT: set[Path] = set()

# Docs that must carry the FULL roster whether or not they currently name a
# recipe. Without this, a doc that drops its recipe list entirely goes quiet
# instead of failing — the mention-driven rule can only compare a list that is
# still there. README is the page a reader meets first and the one that went
# three releases stale, so it is required rather than merely checked-if-present.
# Every entry must also appear in RECIPE_DOCS or it is never scanned; that is
# asserted below rather than left as a comment.
RECIPE_ROSTER_REQUIRED: set[Path] = {
    ROOT / "README.md",
}

# Docs that MUST state a recipe COUNT, whether or not they currently do.
#
# 🔴 188 §3 — AND THIS ONE WAS FOUND BY FAILING TO BUILD A POSITIVE CONTROL FOR IT.
# `control_gate.py` asks, per failure statement, *what one-line tree edit reddens this?*
# The recipe-count statement below has no such edit, and the reason is not that the
# statement is wrong: `doc_recipe_count_claims()` returned NOTHING. Every run had been
# printing it —
#
#     Recipes : 8 registered · 1 doc roster(s) checked · 0 count claim(s) checked
#
# — and no gate read the zero. A comparison over an empty population cannot disagree
# with anything, so the count half of check 12 has been inert since it was written, and
# a ninth recipe could have shipped with no doc mentioning a number at all.
#
# 🔴 THE FIX ALREADY EXISTED IN THIS FILE, TWO CHECKS OVER, AND SIMPLY WAS NOT APPLIED
# HERE — which is word for word what RESOURCE_COUNT_REQUIRED's own comment says about
# check 10 borrowing RECIPE_ROSTER_REQUIRED. The two checks have now each supplied the
# other's missing half: check 10 had a code-side roster and no doc-side count
# requirement; check 12 had a doc-side ROSTER requirement and no COUNT requirement.
# Every entry must also appear in RECIPE_DOCS or it is never scanned; asserted at the
# check rather than left as a comment.
RECIPE_COUNT_REQUIRED: set[Path] = {
    ROOT / "README.md",
    ROOT / "docs/USER_GUIDE.md",
}

# Three-digit counts that legitimately appear ON A LINE that also states a
# surface count, but are NOT the full or secure-default surface — a plane total,
# a tool-family size, an alternative's ceiling. Deliberately EMPTY today: every
# claim-bearing line in the tree states only 286 or 272, and the family counts
# (145 for plane A, 162 for an alternative's ceiling, 165 for the physics group) all sit
# on lines that make no surface claim, so check 11 never looks at them.
#
# If a legitimate family count later lands next to a surface count, add it here
# with a comment naming it — the same deliberate-edit rule EXPECTED_RESOURCE_URIS
# uses. Do NOT add a number here to silence a failure you have not identified.
SUBGROUP_COUNTS: set[int] = set()

# The universal elicitation-gate bypass param. It is added to every destructive
# tool's inputSchema by convention and documented once (not per-tool in the
# catalog Input blocks), so it is excluded from per-tool param-shape parity.
IGNORED_PARAMS = {"confirm"}

# Tools that deliberately return image content with NO structuredContent, so they
# carry no outputSchema and have no Output block to compare.
NO_OUTPUT_SCHEMA_OK = {"screenshot_editor", "runtime_screenshot"}

# The catalog documents three tool families by defining ONE result envelope and
# referring back to it, which keeps the shape in a single place. Each entry
# locates that definition so the referring tools resolve to a real shape rather
# than dropping out of the shape comparison. A phrase that stops matching is a
# hard error, not a silent loss of coverage — see _shared_envelopes.
ENVELOPE_DEFS = {
    "generator result envelope": r"The shared generator result envelope[^\n]*:\n```json\n(.*?)```",
    "codegen envelope": r"codegen tools share one result envelope[^\n]*:\n```json\n(.*?)```",
    "backend scaffold envelope": r"The shared backend scaffold envelope[^\n]*:\n```json\n(.*?)```",
}

# Tools whose documented shape the parser is ALLOWED not to find, each with the
# reason. Deliberately empty: every one of the 289 currently resolves through one
# of the four documentation forms. A name added here buys silence, so it must
# come with a reason no reader could mistake for "not documented yet" — and
# check 16 asserts in BOTH directions, so a stale name here fails the gate.
SHAPE_COVERAGE_EXEMPT: dict[str, str] = {}

errors: list[str] = []
warnings: list[str] = []

# 🔴 THE REPORT WIRE, PROVED TO CARRY (181). Check 20's scope ledger floors twenty-six
# populations — every one of them an INPUT: what a finder found before a check read it.
# Nothing floored the OUTPUT, which is this list. Measured, by leaving every check
# running and making `errors` unable to speak:
#
#     class _Silent(list):
#         def append(self, x): pass
#
#     -> all 26 SCOPE floors hold · ALL HARD CHECKS PASSED · exit 0
#
# So the one number the whole file exists to produce had nothing under it, in the same
# shape 180 §4 found in `tautology_gate.mjs`: the floors pin what went IN. `scope_gate.py`
# does not cover it either — it blinds `def`-annotated ENUMERATORS, and this is the wire
# after them.
#
# A floor cannot close it: the healthy value is ZERO errors, so there is no number to be
# above. What can is the canary idiom this repo already uses for rosters — put a known
# violation in at the top and require it to arrive. If `append` is broken, subverted, or
# the list is rebound to something that drops writes, the sentinel does not come back and
# the run dies loudly instead of passing quietly.
_WIRE_CANARY = "__report_wire_canary__ (if you are reading this in output, check 21 failed to strip it)"
errors.append(_WIRE_CANARY)

# 🔴 AND THE OTHER HALF OF 181 §5, WHICH THAT SESSION NAMED AND DID NOT CLOSE (181 §11.3).
#
# The canary above proves `errors` CARRIED. It says nothing about how many checks put
# anything into it, and the twenty-six SCOPE floors below count POPULATIONS, not
# COMPARISONS — so a check deleted outright takes its own errors away with it, every
# floor still holds, and this file prints ALL HARD CHECKS PASSED over one fewer contract
# than it claims to enforce. `scope_gate.py` cannot see it either: it blinds `def`-
# annotated ENUMERATORS, and a check is neither a def nor an enumerator.
#
# 🔴 THE COUNTER IS AT THE END OF EACH BLOCK, NOT THE START. A check whose header
# survives while its body is deleted is the same failure wearing a nicer name, and only
# the end position distinguishes the two. Names are pinned as a ROSTER rather than a
# count, because 181 §7's lesson is that a roster pinned by KEY is not a roster pinned —
# here it is the reverse risk, so both are asserted: the SET must match and the SIZE is
# floored at a literal.
CHECKS_EXPECTED = (
    "1&2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "11b", "11c",
    "12", "13", "14", "15", "16", "17", "18/19", "20", "23", "24", "25",
    # 🆕 246 — check 27, the guard-class half of 233's `discover-rosters` row. A member and
    # not a roster gate: it asks about the prose scanner's behaviour, not about this roster.
    # 🔴 AND NO ROUND BRACKETS ANYWHERE IN THIS COMMENT — including around a citation, and
    # including inside a quoted regex. `control_gate.py` resolves its `22.floor` anchor by
    # reading this roster out of this file with a lazy bracket group, so the first closing
    # bracket after the opening one ENDS the roster: the count reads one short, the anchor
    # resolves to a number this file does not contain, and the control stops firing in
    # silence. Found by that gate on the run that added this row, and then again on the
    # run that explained it.
    "27",
    # 🆕 254 — check 28, the remedy join. A member and not a roster gate: it asks whether
    # a failing tool tells the reader what to do next, on both sides of one wire.
    "28",
    # 🆕 255 — check 29, the required-any join. A member and not a roster gate: it asks
    # whether a key the wire now promises is a key the engine actually writes.
    "29",
    # 🆕 257 — check 30, the launcher readiness join. A member and not a roster gate: it
    # asks whether a tool that answers about a process it started waited for the thing the
    # caller is about to use. Population found by the spawn, never by a list — the row it
    # closes named one launcher and the twin had the same defect unnamed.
    "30",
    # 🆕 261 — check 31, the recipe/surface join. A member and not a roster gate: it asks
    # whether a step the guide tells the reader to run is a step their install can run.
    "31",
    # 🆕 268 — check 32, the error-code discipline. A member and not a roster gate: it
    # asks whether a shipped branch is selected by a FIELD or by a sentence, on both
    # sides of three joins. 🔴 AND NO ROUND BRACKETS HERE EITHER — see the note above
    # this tuple; the roster is read out of this file with a lazy bracket group.
    "32",
    # 🆕 278 — check 33, the observed-capability ledger. A member and not a roster gate:
    # it asks what a REAL debug adapter advertised, which is the one question every other
    # capability claim in this tree holds true on either side of. 🔴 AND NO ROUND
    # BRACKETS HERE EITHER — see the note above this tuple.
    "33",
    # 🆕 283 — check 34, the node-naming seam. A member and not a roster gate: it asks
    # whether the ONE place a node joins the edited scene still asks the engine for a
    # readable name. The twenty-two tools it collapses were each defective for as long
    # as they existed, and none of them had a list to fall off.
    "34",
    # 🆕 284 — check 35, the resource-save seam, and it is 283's lesson arriving a second
    # time on a second uncounted population. A member and not a roster gate: it asks
    # whether the ONE place a resource reaches disk still asks whether the destination
    # is already somebody's file. Nineteen tools destroyed one and answered `created`.
    "35",
)
CHECKS_RUN_FLOOR = 32   # measured: thirty-two blocks reach their own end on a healthy tree
checks_ran: "list[str]" = []


def _ran(check: str) -> None:
    """Called as the LAST statement of each check block. See CHECKS_EXPECTED above."""
    checks_ran.append(check)


def dispatch_methods(gd_file: Path, func_names: list[str]) -> set[str]:
    """Extract string case-labels inside the named dispatch function(s)."""
    text = gd_file.read_text()
    methods: set[str] = set()
    for fn in func_names:
        m = re.search(rf"func {re.escape(fn)}\(", text)
        if not m:
            continue
        start = m.end()
        nxt = re.search(r"\nfunc ", text[start:])
        body = text[start: start + (nxt.start() if nxt else len(text))]
        # Case labels look like:  "method.name":  on their own line.
        for lm in re.finditer(r'^\s*"([a-z_][a-z0-9_.]*)":\s*$', body, re.M):
            methods.add(lm.group(1))
    return methods


def host_bridge_calls(ts_files: list[Path]) -> set[str]:
    """String methods passed to call("..") or *.request("..") in given files."""
    calls: set[str] = set()
    for f in ts_files:
        text = f.read_text()
        for m in re.finditer(r'\bcall\(\s*"([a-z_][a-z0-9_.]*)"', text):
            calls.add(m.group(1))
        for m in re.finditer(r'\.request\(\s*"([a-z_][a-z0-9_.]*)"', text):
            calls.add(m.group(1))
    return calls


def registered_tools() -> list[str]:
    names: list[str] = []
    for f in sorted(TOOLS.rglob("*.ts")):
        text = f.read_text()
        # Plain tools: server.registerTool("name", ...)
        for m in re.finditer(r'registerTool\(\s*"([a-z0-9_]+)"', text):
            names.append(m.group(1))
        # Task-model tools (D2): registerTaskTool(server, "name", ...)
        for m in re.finditer(r'registerTaskTool\(\s*\w+\s*,\s*"([a-z0-9_]+)"', text):
            names.append(m.group(1))
    return names


def required_any_output_keys() -> "dict[str, set[str]]":
    """tool -> the output keys whose declared type constrains NOTHING and is not optional.

    🔴 255 — THE POPULATION THE WIRE ONLY LEARNED TO SPELL AT ZOD 4.4.0. `encodedValue`
    is `z.any()`: a Godot Variant through the addon's JSON codec, which is a scalar, an
    array or a `__type__`-tagged object, so no narrower type is available. Under zod 3 a
    key typed that way was IMPLICITLY OPTIONAL and dropped out of the emitted schema's
    `required` list — the schema could not say "always present" about an `any` at all.
    From zod 4.4.0 it is required, and `schemas.ts` had already been writing the
    distinction by hand: `runtime_assert_scene_structure` spells `encodedValue.optional()`
    for the two fields its handler omits, and nothing else does. That `.optional()` is
    the proof the author meant the difference; the wire simply could not carry it.

    So the reader is lexical and its rule is the file's own idiom: a key bound DIRECTLY to
    `encodedValue` or `z.any()`, with no `.optional()`. A key bound to `z.record(.., encodedValue)`
    or `z.array(..)` is not in the population — the container is what the schema constrains,
    and an absent container is a different question.

    🔴 THE BLIND IS THE WHOLE JOIN. Return `{}` and check 29 compares nothing to nothing
    in both directions, which is why this has a `SCOPE_LEDGER` floor rather than a comment.
    """
    text = SCHEMAS.read_text()
    m = re.search(r"export const outputSchemas[^=]*=\s*\{", text)
    if not m:
        return {}
    start = text.index("{", m.end() - 1)
    region = text[start : _match_braces(text, start)]
    out: "dict[str, set[str]]" = {}
    for em in re.finditer(r"(?m)^\s+([a-z_][a-z0-9_]*)\s*:\s*\{", region):
        brace = em.end() - 1
        body = region[brace + 1 : _match_braces(region, brace) - 1]
        keys = {
            km.group(1)
            for km in re.finditer(
                r"([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:encodedValue|z\.any\(\))(?!\s*\.)", body
            )
        }
        if keys:
            out[em.group(1)] = keys
    return out


def tool_bridge_methods() -> "dict[str, set[str]]":
    """tool -> the addon methods ITS OWN registration block puts on the wire.

    `host_bridge_calls` above answers the same question per FILE, which is the right
    granularity for checks 1 and 2 — they ask whether the two dispatch tables agree. It is
    the wrong granularity for a per-tool join: `runtime.ts` alone calls thirty methods, so
    a file-level answer would let any key emitted by any of them satisfy any tool.

    A block runs from one `registerTool(`/`registerTaskTool(` to the next, which is exactly
    how the tool files are written — one registration per call, in order, never nested.
    """
    out: "dict[str, set[str]]" = {}
    site = re.compile(r'register(?:Task)?Tool\(\s*(?:\w+\s*,\s*)?"([a-z0-9_]+)"')
    for f in sorted(TOOLS.rglob("*.ts")):
        text = f.read_text()
        sites = list(site.finditer(text))
        for i, sm in enumerate(sites):
            body = text[sm.end() : sites[i + 1].start() if i + 1 < len(sites) else len(text)]
            calls = set(re.findall(r'\bcall\(\s*"([a-z_][a-z0-9_.]*)"', body))
            calls |= set(re.findall(r'\.request\(\s*"([a-z_][a-z0-9_.]*)"', body))
            out.setdefault(sm.group(1), set()).update(calls)
    return out


def addon_handler_bodies() -> "dict[str, tuple[str, str]]":
    """addon method -> the file and body of the function its dispatch arm calls.

    The dispatch is a `match method:` whose arms are `"a.b":` followed by
    `return _handler(params)`, on both engine planes. Resolving the arm to the FUNCTION is
    what makes check 29 a join rather than a file-wide grep: `"value"` appears 30 times in
    `operations.gd`, and only the handler that answers `node.get_property` says anything
    about whether THAT tool's reply carries one.
    """
    out: "dict[str, tuple[str, str]]" = {}
    for gd in ("operations.gd", "runtime_bridge.gd"):
        path = ADDON / gd
        if not path.is_file():
            continue
        text = path.read_text()
        arms = dict(re.findall(r'"([a-z_][a-z0-9_.]*)":\s*\n\s*return (_[a-z0-9_]+)\(', text))
        for method, fn in arms.items():
            fm = re.search(rf"\nfunc {re.escape(fn)}\(", text)
            if not fm:
                continue
            nxt = re.search(r"\nfunc ", text[fm.end():])
            out[method] = (gd, text[fm.end(): fm.end() + (nxt.start() if nxt else len(text))])
    return out


# 🆕 272 — THE CONSTRUCTS THAT PUT A KEY ON THE WIRE, and nothing else counts as one.
#
# 🔴 WHY THIS EXISTS. Check 29 asked *does the handler write this key* by searching the
# handler's WHOLE BODY for `key:` — and a body contains more than what it returns. A
# GDScript local's type annotation (`var result: Variant = ..`) matches. So does the zod
# `inputSchema:` line in the tool's own registration block, which is in the joined text
# because the host half of the answer lives there. MEASURED AT 272 by deleting each real
# emit and re-running the join: **8 of the 16 keys still read PRESENT with nothing left
# writing them.** The join was half decoration.
#
# The openers are the four shapes this tree actually returns through, and they are a
# roster rather than a parser for the reason every other reader here is a regex:
#   `_ok(..)` / `ok(..)`   the success envelope on both engine planes and on the host
#   `.append(..)`          an array element — three of the sixteen keys are per-element
#   `var x := {..}`        a dict bound to a local and handed to `_ok` one line later
#   `const x = {..}`       the same idiom on the TypeScript side
#
# 🔴 AND A TOOL WITH NO REGION IS NOT A TOOL WITH NO KEY. If the openers match nothing in
# a body the reader has NOT observed a missing key — it has failed to find where the tool
# answers, which is a different sentence, and 271's rule is that the two may not share a
# spelling. Check 29 raises the reader's own failure under its own message.
EMIT_OPENERS = (
    re.compile(r"(?<![A-Za-z0-9_])_?ok\s*\("),
    re.compile(r"\.append\s*\("),
    re.compile(r"(?m)^\s*var\s+[A-Za-z_][A-Za-z0-9_]*\s*(?::\s*[A-Za-z_][A-Za-z0-9_]*\s*)?:?=\s*\{"),
    re.compile(r"(?m)^\s*const\s+[A-Za-z_][A-Za-z0-9_]*(?:\s*:[^=\n]*)?=\s*\{"),
)


def emitted_key_regions(body: str) -> "list[str]":
    """The spans of `body` that construct something the caller receives.

    Balanced-delimiter slices from each opener above, so a nested dict inside an `_ok(..)`
    comes along and a sibling statement does not.

    🔴 THE BLIND IS THE RIGHT-HAND SIDE OF THE JOIN. Return `[]` and every one of the
    sixteen keys reads as unwritten, which is check 29 going RED on a healthy tree — the
    loud failure, and the one this reader is allowed to have. The quiet failure is the one
    it replaced: a right-hand side wide enough that everything is present.
    """
    out: "list[str]" = []
    for rx in EMIT_OPENERS:
        for m in rx.finditer(body):
            op = body.rfind("(", m.start(), m.end())
            if op == -1:
                op = body.rfind("{", m.start(), m.end())
            if op == -1:
                continue
            out.append(body[op:_match_braces(body, op)])
    return out


def host_tool_blocks() -> "dict[str, str]":
    """tool -> the source text of ITS OWN registration block.

    The same block slicing three checks already do inline, named once because check 30
    needs it twice — a launcher is found by what its block CALLS, and judged by what its
    block RETURNS, and those are two reads of the same region.
    """
    out: "dict[str, str]" = {}
    site = re.compile(r'register(?:Task)?Tool\(\s*(?:\w+\s*,\s*)?"([a-z0-9_]+)"')
    for f in sorted(TOOLS.rglob("*.ts")):
        text = f.read_text()
        sites = list(site.finditer(text))
        for i, sm in enumerate(sites):
            end = sites[i + 1].start() if i + 1 < len(sites) else len(text)
            out[sm.group(1)] = text[sm.end(): end]
    return out


#: What a tool that launches the game must put on the wire beside `running`.
READINESS_KEYS = ("bridge_ready", "bridge_wait_ms", "bridge_note")

#: The spawns that produce a long-lived Godot process.
#
# 🔴 282 — `launchDetached(` IS GONE AND THE FLOOR IS WHAT SAID SO. The helper was
# replaced by `spawnGuarded(` (`host/src/spawn-guard.ts`) so a failure to START the
# binary stops taking the server down, and the population behind check 30 fell from
# 2 to 1 in the same edit — `SCOPE COLLAPSE xlang.game_launchers: 1 < floor 2`,
# which is the exact sentence the floor's own reason predicts: *the finder going
# quiet looks exactly like a tree with no launchers in it*. It was not a tree with
# no launchers; it was a finder reading a spelling nobody uses any more.
#
# 🔵 AND THE DERIVED EXCLUSION SURVIVED THE RENAME UNTOUCHED. `godot_launch_editor`
# spawns through the same new helper and still excludes itself by passing `-e`,
# which is what a roster of names would not have done.
LAUNCH_CALLS = ("spawnGuarded(", "registry.run(")

#: The engine flag that makes a launch an EDITOR launch rather than a game launch.
EDITOR_LAUNCH_FLAG = '"-e"'


def game_launcher_tools() -> "set[str]":
    """Tools whose own registration block spawns a game expected to host 9081.

    🔴 THE POPULATION IS FOUND BY THE SPAWN, NOT BY A ROSTER — which is the point.
    `run-project-returns-before-bridge` was written about `godot_run_project` alone, and
    `godot_run_managed` in a different file had the identical defect with no row naming
    it. A roster would have had to be remembered; a finder that reads the launch call
    finds the twin the moment it is written.

    🔴 AND THE EXCLUSION IS DERIVED, NOT LISTED. `godot_launch_editor` spawns the same
    binary through the same helper and is not in this population — it passes `-e`, which
    starts the EDITOR, and an editor hosts the editor bridge on 9080 and never binds the
    runtime port. Reading the flag means a second editor launcher excludes itself; a name
    on an exception list would have had to be remembered, which is the failure mode this
    whole check exists to answer.

    🔴 THE BLIND IS THE WHOLE CHECK. Return an empty set and check 30 judges nothing and
    prints ok, which is why this has a `SCOPE_LEDGER` floor rather than a comment.
    """
    out: "set[str]" = set()
    for tool, body in host_tool_blocks().items():
        if not any(c in body for c in LAUNCH_CALLS):
            continue
        if EDITOR_LAUNCH_FLAG in body:
            continue
        out.add(tool)
    return out


def readiness_waiting_tools() -> "set[str]":
    """Tools whose own registration block awaits the runtime bridge before answering."""
    return {t for t, body in host_tool_blocks().items() if "waitForRuntimeBridge(" in body}


def output_schema_keys() -> "dict[str, set[str]]":
    """tool -> every TOP-LEVEL key its output schema declares, whatever the type.

    `required_any_output_keys` above answers a narrower question — which keys are `any`
    and therefore required — and check 30 needs the plain one: does this tool's schema
    have somewhere to put the answer at all.
    """
    text = SCHEMAS.read_text()
    m = re.search(r"export const outputSchemas[^=]*=\s*\{", text)
    if not m:
        return {}
    start = text.index("{", m.end() - 1)
    region = text[start : _match_braces(text, start)]
    out: "dict[str, set[str]]" = {}
    for em in re.finditer(r"(?m)^\s{2}([a-z_][a-z0-9_]*)\s*:\s*\{", region):
        brace = em.end() - 1
        body = region[brace + 1 : _match_braces(region, brace) - 1]
        out[em.group(1)] = {
            km.group(1)
            for km in re.finditer(r"(?m)^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:", body)
        }
    return out


def remedy_tables() -> "dict[str, dict[str, str]]":
    """plane -> error code -> the next action, read out of `error_remedies.gd`.

    🔴 ONE READER FOR BOTH DIRECTIONS OF CHECK 28's JOIN, WHICH IS WHY IT IS ALSO THE
    ONE BLIND. Empty this and every raised code reads as remedied AND every remedy reads
    as raised, because both comparisons are computed from the same empty side — the
    failure that agrees with itself, which is the shape `scope_gate` exists to find.
    """
    path = ADDON / "error_remedies.gd"
    if not path.is_file():
        return {}
    src = path.read_text()
    tables: "dict[str, dict[str, str]]" = {}
    for plane, table in (("editor", "EDITOR_REMEDIES"), ("runtime", "RUNTIME_REMEDIES")):
        m = re.search(rf"const {table} := {{(.*?)^}}", src, re.S | re.M)
        rows: "dict[str, str]" = {}
        if m:
            for rm in re.finditer(r'^\t"([a-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)",\s*$',
                                  m.group(1), re.M):
                rows[rm.group(1)] = rm.group(2)
        tables[plane] = rows
    return tables


def remedy_renderers_read() -> "list[str]":
    """Every host file that renders a caught error into MCP error text.

    Derived rather than rostered: a sixth plane's `fail()` is in the population the
    moment it is written, which is the only moment anyone would notice it drops the
    next action.

    🔴 267 REMOVED THE `Partial<BridgeError>` CONDITION, AND THAT CONDITION WAS THE ROW.
    `remedy-channel-one-class-of-five` said it in one line — *`remedy` is a field on one
    error class of five, and the gate that guards it is scoped to the class that already
    has it.* This function WAS that scoping. Five renderers mentioned `Partial<BridgeError>`
    and were checked; the four rendering `DapError`, `LspError` and a path refusal were not
    in the population at all, so the gate could not notice they appended nothing — it
    agreed with itself over a set chosen to contain only the compliant members.

    The predicate is now the SIGNATURE all nine already share, so a renderer is in scope
    because it renders, not because it renders one class.
    """
    hits: "list[str]" = []
    for f in sorted(HOST_SRC.rglob("*.ts")):
        text = f.read_text()
        for m in re.finditer(r"function fail\w*\(err: unknown\)\s*{(.*?)\n}", text, re.S):
            del m
            hits.append(str(f.relative_to(ROOT)))
    return hits


# 🆕 267 — the RAISE-SITE half of the same join.
#
# A renderer that appends `remedyClause` proves the CHANNEL is open; it says nothing about
# whether anything was put in it. 264's census is the evidence that those are different
# questions: of 25 host-raised failures about the world, SEVEN knew the next action and
# pasted it into the message text, where the appending renderer cannot find it, no gate can
# join it, and a reword drops it with every test still green.
#
# The population is derived, not rostered — a site is exempt only when it RELAYS the peer's
# own words, which is visible in the constructor arguments themselves. Everything else is
# the host inventing a sentence, and a sentence the host invents is one it can answer for.
#
# 🔴 AND THE EXEMPTION IS THE INTERESTING HALF. A relaying site must NOT carry a remedy: it
# does not know what went wrong, only what the adapter said about it, and a next action
# invented over somebody else's error message is the failure 263 measured one plane over —
# an answer given on behalf of an adapter nobody asked.
_PEER_RELAY_MARKS = ("msg[", ".message ??", "e.message", "err.message")
# Matches `closeRemedy`, `CS_START_REMEDY` and the bare local `remedy` a close handler
# assigns: the rule is that something NAMED as a remedy reaches the constructor, not that
# it was spelled in one particular casing.
_REMEDY_NAME = re.compile(r"\b\w*[Rr]emedy\b|\b\w*_REMEDY\b")


def _balanced_span(text: "str", open_at: "int") -> "str":
    """The argument text of a call whose `(` is at `open_at`, brackets balanced."""
    depth = 0
    for i in range(open_at, len(text)):
        if text[i] == "(":
            depth += 1
        elif text[i] == ")":
            depth -= 1
            if depth == 0:
                return text[open_at + 1 : i]
    return ""


def host_invented_error_sites() -> "tuple[list[tuple[str, int, str]], int]":
    """Sites raising a DAP/LSP error the host WROTE, and the total scanned.

    Returns `(unanswered, scanned)`. `unanswered` is every host-invented raise site whose
    arguments name no `*Remedy` / `*_REMEDY`, as `(file, line, snippet)`.

    The scanned count is returned for the reason `uncaptured_tool_registrations` returns
    one: an empty list means *nothing unanswered* and *did not look* in exactly the same
    way, and only the second number tells them apart.
    """
    unanswered: "list[tuple[str, int, str]]" = []
    scanned = 0
    for f in sorted(HOST_SRC.rglob("*.ts")):
        text = f.read_text()
        for m in re.finditer(r"new (?:Dap|Lsp)Error\(", text):
            span = _balanced_span(text, m.end() - 1)
            scanned += 1
            if any(mark in span for mark in _PEER_RELAY_MARKS):
                continue
            if _REMEDY_NAME.search(span):
                continue
            line = text.count("\n", 0, m.start()) + 1
            unanswered.append((str(f.relative_to(ROOT)), line, " ".join(span.split())[:90]))
    return unanswered, scanned


def host_cause_remedies() -> "dict[str, str]":
    """Every next-action sentence the HOST writes, keyed `file:name#n`.

    Derived from a naming convention the tree already used before this check existed —
    `closeRemedy`, `connectRemedy`, `nonFiniteRemedy`, `DEBUGGER_HOLD_REMEDY` — so a new
    one is in the population the day it is written rather than the day somebody remembers
    to add it to a list.

    🔴 ONE SENTENCE PER `return`, NOT ONE PER LITERAL, and getting that wrong is not a
    detail. Every one of these is a `+`-chain of two or three literals, so judging literals
    individually asks the imperative rule of a FRAGMENT — the first draft of this reader
    reported that `timeoutRemedy` "begins 'host's'", which is the middle of its second
    line. A member with a `switch` returns several distinct sentences and each is judged on
    its own; interpolations collapse to `X`, because a peer noun substituted into a
    sentence changes neither where the imperative sits nor how it ends.
    """
    out: "dict[str, str]" = {}
    for f in sorted(HOST_SRC.rglob("*.ts")):
        if f.name.endswith(".test.ts"):
            continue
        text = f.read_text()
        rel = f.relative_to(HOST_SRC)
        for m in re.finditer(
            r"export (?:const ([A-Za-z_][A-Za-z0-9_]*_REMEDY)\s*=|function ([a-z][A-Za-z0-9_]*Remedy)\b)",
            text,
        ):
            name = m.group(1) or m.group(2)
            tail = text[m.end() :]
            nxt = re.search(r"\n(?:export |/\*\*)", tail)
            body = tail[: nxt.start()] if nxt else tail
            if m.group(1):
                spans = [body[: body.index(";")] if ";" in body else body]
            else:
                spans = []
                for r in re.finditer(r"\breturn\b", body):
                    rest = body[r.end() :]
                    if ";" in rest:
                        spans.append(rest[: rest.index(";")])
            i = 0
            for span in spans:
                for sentence in _sentences_in(span):
                    if len(sentence) < 40 or " " not in sentence:
                        continue
                    out[f"{rel}:{name}#{i}"] = sentence
                    i += 1
    return out


# A double-quoted string and a template literal are DIFFERENT literals, and conflating
# them silently ate the tool names out of every remedy that names one: `"Call `dbg_launch`
# …"` is one double-quoted string containing backticks, and a scanner that treats a
# backtick as a delimiter reads it as `Call ` + ` or ` + ` first…`, dropping exactly the
# words check 28c joins to the tool registry. Measured on the first draft of this reader:
# `DAP_RESTART_REMEDY` came out as "Call  or  first".
_LITERAL = re.compile(r'"((?:[^"\\]|\\.)*)"' + "|" + r"`((?:[^`\\]|\\.)*)`")


def _sentences_in(span: "str") -> "list[str]":
    """The distinct remedy sentences inside one expression.

    Literals joined only by `+` are ONE sentence; anything else between them — a ternary's
    `?` or `:`, a comma, a call boundary — starts a new one. 🔴 A `return` is not a
    sentence boundary: `peerExitRemedy` returns a ternary, and a reader that joined its
    whole return span produced a 240-character run-on ending
    `…with runtime_spawn_peers.Spawn a replacement with…` and then reported it over the
    length ceiling. That was the reader's defect being reported as the sentence's.
    """
    out: "list[str]" = []
    parts: "list[str]" = []
    prev_end = None
    for lit in _LITERAL.finditer(span):
        text = lit.group(1) if lit.group(1) is not None else lit.group(2)
        gap = span[prev_end : lit.start()] if prev_end is not None else ""
        if prev_end is not None and gap.strip(" \t\r\n+") != "":
            out.append("".join(parts))
            parts = []
        parts.append(text)
        prev_end = lit.end()
    if parts:
        out.append("".join(parts))
    return [re.sub(r"\$\{[^}]*\}", "X", t).replace("\\`", "`").replace('\\"', '"').strip() for t in out]
    return out


def uncaptured_tool_registrations() -> "tuple[list[str], int]":
    """Registration sites whose tool name the strict net above does NOT match.

    Checks 3, 4, 6 and 11 all reach the surface through `registered_tools()`, so
    a name the net misses is not under-reported — it is **absent**. It gets no
    catalog row demanded, no annotations demanded, no output schema demanded,
    and it does not move any count, so the gate's output is byte-identical to a
    clean run. There is no number a reviewer could notice.

    That was live through 1.26.0: this net was `[a-z_]+` while `annotated_tools`
    and `output_schema_shapes` used `[a-z0-9_]+`, so a tool following the repo's
    own `recipe_2d_player_controller` convention was invisible to four checks at
    once. Widening the net closed today's hole; **this function is what makes
    the next one fail loudly instead of silently.** It re-scans with a
    deliberately permissive literal net and reports the difference — so the gate
    asserts the net captured every site, rather than trusting that it did.

    🔴 AND IN 172 THIS DETECTOR WAS ITSELF BLINDED AND THE RUN STAYED GREEN. Early-
    returning `[]` here — a permissive net that matches nothing — prints ALL HARD
    CHECKS PASSED, because "no misses found" and "did not look" are the same
    observable. That is exactly the failure the paragraph above describes, committed
    by the function written to prevent it. It now returns the number of sites it
    SCANNED as well, and the scope ledger floors that against a literal.
    """
    missed: list[str] = []
    scanned = 0
    for f in sorted(TOOLS.rglob("*.ts")):
        text = f.read_text()
        for m in re.finditer(
            r'register(?:Task)?Tool\(\s*(?:\w+\s*,\s*)?"([^"\n]*)"', text
        ):
            scanned += 1
            name = m.group(1)
            if not re.fullmatch(r"[a-z0-9_]+", name):
                line = text.count("\n", 0, m.start()) + 1
                missed.append(f"{f.relative_to(ROOT)}:{line} {name!r}")
    return missed, scanned


def annotated_tools() -> set[str]:
    """Tool names on annotations.ts' ALL_ANNOTATED roster.

    The roster is the explicit list of every tool carrying MCP annotations
    (readOnly/destructive/idempotent/openWorld hints). It is deliberately NOT
    derived from the four hint lists — ~50 tools are all-false, so a derived
    union would omit them silently. Parsed here so a newly registered tool
    cannot ship without hints: without published annotations, consumers infer
    risk from the tool NAME, which is how `tilemap_clear` (undoable) gets
    catalogued as irreversible.
    """
    text = ANNOTATIONS.read_text()
    m = re.search(r"export const ALL_ANNOTATED: readonly string\[\] = \[(.*?)\n\];", text, re.S)
    if not m:
        return set()
    return set(re.findall(r'"([a-z0-9_]+)"', m.group(1)))


def registered_resources() -> dict[str, str]:
    """Resource name -> its `godot://…` URI, over every `server.registerResource`
    call in `host/src`.

    Both call forms are matched: a bare string URI, and the
    `new ResourceTemplate("godot://class/{name}", …)` form used by `class-doc`.

    Why this lives here and not in a host test: `registration.test.ts` drives
    `buildToolsets`, which never wires `applyCapabilities`, so it legitimately
    sees only the 5 toolset resources. Nothing counted the resources the wired
    server actually exposes — which is how the catalog said "5 MCP resources"
    for ten days after the 6th (`godot://capabilities`) landed.

    The `.` prefix is load-bearing: it matches the member call and skips both
    the `registerResources` function declaration and `registerResourceSubscriptions`
    (which registers no resources).
    """
    found: dict[str, str] = {}
    for f in sorted(HOST_SRC.rglob("*.ts")):
        for m in re.finditer(
            r'\.registerResource\(\s*"([a-z0-9-]+)"\s*,\s*(?:new\s+ResourceTemplate\(\s*)?"([^"]+)"',
            f.read_text(),
        ):
            found[m.group(1)] = m.group(2)
    return found


def doc_resource_claims() -> list[tuple[Path, int, int]]:
    """(file, line-no, claimed-count) for every "N MCP resources" / "N resources"
    statement in the live docs. Source comments and prose are the one surface no
    other gate reads, and drift there is silent — every test still passes."""
    claims: list[tuple[Path, int, int]] = []
    for f in RESOURCE_DOCS:
        if not f.exists():
            continue
        for lineno, line in enumerate(f.read_text().splitlines(), 1):
            for m in re.finditer(r"(\d+)\s+(?:MCP\s+)?resources\b", line, re.I):
                claims.append((f, lineno, int(m.group(1))))
    return claims


def registered_recipes() -> list[str]:
    """Recipe (MCP prompt) names in registration order, read from the
    `server.registerPrompt("name", …)` calls in `host/src/recipes.ts`.

    Derived from the registrations rather than read off `RECIPE_NAMES`, for the
    same reason check 11 derives both tool counts from the code: nothing here
    can be satisfied by editing a constant to match a stale doc.
    """
    return re.findall(r'registerPrompt\(\s*"([a-z0-9_]+)"', RECIPES.read_text())


def recipe_names_constant() -> list[str]:
    """The `RECIPE_NAMES` typed constant, in source order.

    `host/test/recipes.test.ts` asserts registration order equals this constant,
    so it is re-derived here beside the registrations rather than trusted — a
    gate that only read the constant would agree with the suite and with a stale
    doc simultaneously, which is exactly the failure being closed.
    """
    m = re.search(
        r"export const RECIPE_NAMES\s*=\s*\[(.*?)\n\]\s*as const;",
        RECIPES.read_text(),
        re.S,
    )
    return re.findall(r'"([a-z0-9_]+)"', m.group(1)) if m else []


def doc_recipe_mentions() -> dict[Path, set[str]]:
    """file -> every `recipe_*` identifier the file names."""
    found: dict[Path, set[str]] = {}
    for f in RECIPE_DOCS:
        if not f.exists():
            continue
        found[f] = set(re.findall(r"\brecipe_[a-z0-9_]+", f.read_text()))
    return found


def doc_recipe_count_claims() -> tuple[
    list[tuple[Path, int, int]], list[tuple[Path, int, str]]
]:
    """("N recipes" claims that resolve, recipe counts written as words).

    Digit claims are gated exactly. Word counts are returned separately and only
    WARNED about: a regex enumerating number words would read as verification
    while covering a fraction of the ways prose states a count, and 11b's first
    version is the standing lesson that a check which reads as verification and
    verifies nothing is worse than no check at all.
    """
    exact: list[tuple[Path, int, int]] = []
    prose: list[tuple[Path, int, str]] = []
    words = r"one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve"
    for f in RECIPE_DOCS:
        if not f.exists():
            continue
        for lineno, line in enumerate(f.read_text().splitlines(), 1):
            for m in re.finditer(r"(\d+)[\s-]+recipes\b", line, re.I):
                exact.append((f, lineno, int(m.group(1))))
            for m in re.finditer(rf"\b(?:{words})[\s-]+recipes\b", line, re.I):
                prose.append((f, lineno, m.group(0)))
    return exact, prose


def capability_group_names() -> "list[str]":
    """The capability group names, read out of `CAPABILITY_GROUPS` in capabilities.ts.

    🔴 283 — READ, NOT TYPED. Check 31 classifies a User Guide blockquote as a
    withholding DECLARATION by whether it talks about withholding, and the vocabulary
    that means "withholding" here is the group roster itself. A group added tomorrow
    joins this list by being declared, which is the property the §7 warning box
    famously did not have.
    """
    text = CAPABILITIES.read_text()
    m = re.search(r"export const CAPABILITY_GROUPS:[^=]*=\s*\[(.*?)\]", text, re.S)
    return re.findall(r'"([a-z][a-z0-9-]*)"', m.group(1)) if m else []


def privileged_tools() -> set[str]:
    """Tool names carrying a capability group in `capabilities.ts`
    `TOOL_CAPABILITIES` — i.e. the tools DROPPED at registration by default.

    This map is the single source of truth for the risk tagging, so the
    secure-default surface is `len(registered) - len(this)` and never a number
    typed by hand. Parsed rather than imported because this script must run with
    no Node and no build.
    """
    text = CAPABILITIES.read_text()
    m = re.search(
        r"export const TOOL_CAPABILITIES:[^=]*=\s*\{(.*?)\n\};", text, re.S
    )
    if not m:
        return set()
    return set(re.findall(r"^\s*([a-z0-9_]+)\s*:\s*\[", m.group(1), re.M))


def guide_recipe_tools() -> "dict[str, dict]":
    """Tool names the User Guide's worked recipes and troubleshooting steps NAME, split
    by whether the line naming them is a STEP or the section's own higher-trust
    DECLARATION.

    🔴 261 — THE RECIPES NAMED FIVE TOOLS A DEFAULT INSTALL DOES NOT LOAD, AND SAID
    NOTHING. Measured at 261 by installing the published `breakpoint-mcp@1.76.0` and
    listing the surface a default client actually gets: 279 tools. §10's four recipes
    named `godot_run_managed`, `godot_run_headless_script`, `runtime_call_method` and
    `dbg_evaluate`, and §11 named `runtime_spawn_peers` — all five in the
    `code-execution` group, all five withheld. Recipe D could not begin and recipe C
    stopped at step 1. §7 has carried a warning naming THREE of them since 248; the
    recipes were written later, named two more, and nothing joined the two lists.

    The population is found by the SECTION, never by a roster: any tool a future recipe
    names is in it the day the recipe is written, which is the property the §7 warning
    did not have.

    A line inside a blockquote is a DECLARATION (the section telling the reader what is
    withheld); every other line is a STEP (the section telling the reader what to run).

    Returns {tool: {"steps": [(line, section, marked)], "declared": bool}} where
    `section` is 10 or 11 and `marked` is whether that step line carries the literal
    `(higher-trust)`. The marker is required ONCE PER SECTION and not once per mention:
    the reader meets the warning where they start reading, and a paragraph that names a
    tool four times while explaining one remedy should not have to say it four times.
    """
    guide = ROOT / "docs/USER_GUIDE.md"
    if not guide.exists():
        return {}
    known = set(registered_tools())
    families = {t.split("_")[0] for t in known}
    lines = guide.read_text().splitlines()

    def _window(head: str, tail: str) -> "tuple[int, int] | None":
        try:
            return (next(i for i, l in enumerate(lines) if l.startswith(head)),
                    next(i for i, l in enumerate(lines) if l.startswith(tail)))
        except StopIteration:
            return None

    # 🔴 283 — §7 WAS THE SECTION THIS CHECK WAS WRITTEN ABOUT AND THE ONE IT DID NOT
    # READ. The header above diagnoses the §7 warning box by name — "written before the
    # recipes existed, never joined to them, and therefore stale the day recipe C was
    # added" — and then joined §10/§11 and left §7 governed by nobody. It went stale
    # again on schedule: `godot_run_managed` is named by §7 step 5 and is in the
    # `code-execution` group, and §7's box still named the same three tools it named at
    # 248, so a reader following the quick start hit an unannounced wall at step 5.
    # Measured at 283 against a live Godot 4.7 by running the section as written.
    #
    # 🔵 THE SAME FOUR DIRECTIONS OVER ONE MORE WINDOW, not a second check with its own
    # opinion. §7's convention is already this one — a blockquote is the declaration,
    # everything else is a step — so the join is a window, not a rule.
    windows = [w for w in (_window("## 7. Quick start", "## 8. Tool reference"),
                           _window("## 10. Typical workflows", "## 12. FAQ")) if w]
    if not windows:
        return {}
    # 🔴 283 — A BLOCKQUOTE IS NOT AUTOMATICALLY A WITHHOLDING DECLARATION, and §7 is
    # where that stops being true. §10's only blockquote IS the higher-trust block, so
    # "line starts with >" was a sufficient discriminator for as long as §10 was the
    # whole population. §7 also carries a blockquote about tagging rich values, which
    # names `node_set_property` and `runtime_set_property` — neither privileged — and
    # reading it as a declaration accused the guide of withholding two tools nobody
    # withholds. The declaring blockquote is the one that talks about WITHHOLDING, so
    # the run is classified by its own subject rather than by its punctuation.
    withhold_vocab = tuple(capability_group_names()) + ("--trust", "privileged", "not loaded")
    declaring_line = [False] * len(lines)
    i = 0
    while i < len(lines):
        if not lines[i].lstrip().startswith(">"):
            i += 1
            continue
        j = i
        while j < len(lines) and lines[j].lstrip().startswith(">"):
            j += 1
        block = "\n".join(lines[i:j])
        if any(v in block for v in withhold_vocab):
            for k in range(i, j):
                declaring_line[k] = True
        i = j

    out: "dict[str, dict]" = {}
    for start, end in windows:
        section = 7 if lines[start].startswith("## 7.") else 10
        for i in range(start, end):
            line = lines[i]
            if line.startswith("## 11."):
                section = 11
            declaring = declaring_line[i]
            marked = "(higher-trust)" in line
            for tok in re.findall(r"`([^`]+)`", line):
                if not re.fullmatch(r"[a-z][a-z0-9_]*_[a-z0-9_]+", tok):
                    continue
                # An identifier shaped like a tool AND sharing a family with a real one.
                # `viewport_not_active` and `exit_code` share a family with nothing, so an
                # error code and a result field never enter the population.
                if tok not in known and tok.split("_")[0] not in families:
                    continue
                row = out.setdefault(tok, {"steps": [], "declared": False})
                if declaring:
                    row["declared"] = True
                else:
                    row["steps"].append((i + 1, section, marked))
    return out



# A line that decides something by MATCHING an error's message body. `.trim()` and
# `?? String(err)` are deliberately not here: asking whether a message is EMPTY, or
# defaulting when it is absent, is a question about presence and not about wording.
PROSE_PREDICATE_RE = re.compile(
    r"""\.test\(\s*[\w.?]*\.message\s*\)"""
    r"""|\.message\s*\.\s*(?:includes|startsWith|endsWith|match|search)\s*\("""
    r"""|\.message\s*===\s*["'`]"""
)
# Any line that mentions a message at all — the HAYSTACK the scan above runs over, so
# that "found nothing" and "looked at nothing" are different numbers.
MESSAGE_READ_RE = re.compile(r"\.message\b")
# The label `tools/editor/common.ts` builds through `bridgeErrorLabel`. Spelled anywhere
# else it is a hand-copy of a template that lives in another file — 268's third site.
RENDERED_LABEL_RE = re.compile(r"""["'`]Bridge error \[""")
LABEL_HOME = "host/src/bridge.ts"
ERROR_RAISE_RE = re.compile(r"new\s+(?:Bridge|Lsp|Dap)Error\s*\(")
TIMEOUT_PHRASE = "timed out after"
# The tokens that spell a timeout code at a raise site, in any of the three classes.
TIMEOUT_CODE_TOKENS = ("BRIDGE_TIMEOUT_CODE", "DAP_TIMEOUT_CODE", '"timeout"')
# 🆕 269 — the two spellings a HOST-ORIGIN code can have, and nothing else counts. A code
# constant is declared once and read at its raise site; a raise site may also spell the
# word inline. `new BridgeError(e.code, ..)` is neither, which is how the RELAY excludes
# itself without anybody rostering it — see `host_origin_error_codes`.
HOST_CODE_CONST_RE = re.compile(
    r'^export const (BRIDGE_[A-Z0-9_]+)\s*=\s*"([a-z0-9_]+)";', re.M)
HOST_RAISE_RE = re.compile(
    r'new\s+BridgeError\s*\(\s*(?:"([a-z0-9_]+)"|([A-Za-z_$][\w$]*))')


def _uncommented(line: str) -> str:
    """The code part of a source line, or "" when the line is only prose.

    🔴 A GATE THAT READS SOURCE LINES MUST TELL CODE FROM PROSE ABOUT CODE, or the first
    thing it refuses is the paragraph explaining what it enforces. Measured while writing
    268: the unfiltered scan found six hits and every one of them was a comment
    describing the defect being removed. 246 learned the same lesson from the other end,
    where a bracket inside a comment silently truncated a roster.
    """
    s = line.lstrip()
    if s.startswith(("*", "//", "/*")):
        return ""
    return line


def error_prose_predicates() -> "tuple[list[str], int, int]":
    """Sites in `host/src` that decide behaviour by MATCHING English, plus the two
    populations the scan ran over.

    🔴 268 — `dap-timeout-predicate-reads-prose`, and the row named two of the three.
    Both DAP tool layers carried `err instanceof DapError && /timed out after/.test(
    err.message)`, so which sentence `dbg_evaluate` and `dbg_set_variable` returned was
    selected by a regex over a message body — and not only as a hazard: the same regex
    matched the ADAPTER'S OWN words at the relay site, so an adapter answering with its
    own inner deadline was told by this host that Godot does not implement setVariable.
    The THIRD site was found by asking the question of the whole tree instead of the two
    files the row happened to name: `timeout-caveat.ts` decided whether 198 mutating
    tools warn that a timed-out change may already have landed by matching the literal
    `Bridge error [timeout]`, a string it spelled out itself, one file from the template
    that builds it. §1's rule from 267, turned on this session's own row: a gate's
    population is a claim, and the two sites a row names are not it.

    Three directions:

      • a predicate matching a `.message` — the class itself, which after 268 has an
        empty population and must stay that way;
      • a raise site whose message says it timed out and carries no timeout CODE, or the
        reverse — the join that keeps a discriminator from being silently dropped by the
        fourth plane somebody adds;
      • the rendered bridge label spelled outside the module that builds it.

    Returns (problems, lines mentioning a message, raise sites judged). The two counts
    are reported because an empty problem list means *nothing wrong* and *did not look*
    identically, which is 267's own finding about reading a gate's output.
    """
    problems: "list[str]" = []
    message_reads = 0
    raise_sites = 0
    if not HOST_SRC.exists():
        return problems, message_reads, raise_sites
    for f in sorted(HOST_SRC.rglob("*.ts")):
        rel = str(f.relative_to(ROOT))
        text = f.read_text()
        for n, raw in enumerate(text.splitlines(), 1):
            line = _uncommented(raw)
            if not line:
                continue
            if MESSAGE_READ_RE.search(line):
                message_reads += 1
            if PROSE_PREDICATE_RE.search(line):
                problems.append(
                    f"{rel}:{n} decides something by matching an error's message body. "
                    f"A copy edit at the raise site then changes which answer a caller "
                    f"gets, with every test green — set a CODE at the raise site and read "
                    f"the field, as `DapError.code` does since 268."
                )
            if RENDERED_LABEL_RE.search(line) and rel != LABEL_HOME:
                problems.append(
                    f"{rel}:{n} spells the rendered bridge-error label out. It is built by "
                    f"`bridgeErrorLabel` in {LABEL_HOME}; a hand-copy stops matching the "
                    f"moment that template is reworded, and the reader it silences is the "
                    f"retry caveat on every non-idempotent tool."
                )
        for m in ERROR_RAISE_RE.finditer(text):
            raise_sites += 1
            # The raise expression, to its matching close bracket — the message and the
            # code are arguments of the same call, so they are read together or not at all.
            depth, i = 0, m.end() - 1
            while i < len(text):
                if text[i] == "(":
                    depth += 1
                elif text[i] == ")":
                    depth -= 1
                    if depth == 0:
                        break
                i += 1
            expr = text[m.start(): i + 1]
            line_no = text.count("\n", 0, m.start()) + 1
            says_timeout = TIMEOUT_PHRASE in expr
            has_code = any(tok in expr for tok in TIMEOUT_CODE_TOKENS)
            if says_timeout and not has_code:
                problems.append(
                    f"{rel}:{line_no} raises a failure whose message says it timed out and "
                    f"passes no timeout code. Two tool layers branch on that code; without "
                    f"it the branch goes quiet and nothing fails."
                )
            elif has_code and not says_timeout:
                problems.append(
                    f"{rel}:{line_no} passes a timeout code over a message that does not "
                    f"say the request timed out. The code is what a caller branches on and "
                    f"the sentence is what they read, and these two now disagree."
                )
    return problems, message_reads, raise_sites


def host_origin_error_codes() -> "set[str]":
    """Every error code the HOST itself originates, as opposed to relays.

    🔴 269 — `write-failed-names-two-producers`, and the population was measured before
    the word was chosen. `write_failed` was raised by `bridge.ts` for a socket the request
    could not be handed to, and by `operations.gd` for a file that would not open. Two
    failures with nothing in common except a word, and `error_remedies.gd` can answer only
    one of them: a caller reading *"Check the target path is inside the project and not
    read-only"* over a torn-down TCP connection is being told to check a path that does
    not exist.

    🔴 THE COLLISION WAS INVISIBLE FOR THE ORDINARY REASON — NOBODY OWNED THE UNION.
    Check 23 already compares the addon's code vocabulary to the codes TypeScript
    BRANCHES on, in both directions. It has never asked what the host itself RAISES,
    because on the wire a host-origin failure and a relayed one are the same envelope:
    `bridge.ts` re-raises the addon's code verbatim at its relay site, so `Bridge error
    [write_failed]` was a sentence two unrelated producers could both write and no reader
    could tell apart. The set difference nothing had ever taken is this one.

    🔴 AND ITS ANSWER TODAY IS ONE, WHICH IS WHY THIS IS A GATE AND NOT A FIELD. Eleven
    codes originate here, fifty are raised in the addon, and the intersection was exactly
    `write_failed` — a single collision, repaired by renaming the younger producer to
    `send_failed` rather than by hanging an origin discriminator on every error the wire
    carries. A gate is what keeps that answer at one; the second collision would otherwise
    be found the way this one was, which is three sessions after it shipped.

    A LITERAL first argument is a code this file owns. `new BridgeError(e.code, ..)` — the
    relay — is skipped BY CONSTRUCTION rather than by a roster: it passes an identifier
    that is not one of our constants, and the addon's word arriving through it is not a
    word this host chose. That distinction is the whole check, so it is drawn by what the
    source says rather than by a list of exceptions somebody has to keep true.
    """
    codes: "set[str]" = set()
    if not HOST_SRC.exists():
        return codes
    consts: "dict[str, str]" = {}
    for f in sorted(HOST_SRC.rglob("*.ts")):
        for m in HOST_CODE_CONST_RE.finditer(f.read_text()):
            consts[m.group(1)] = m.group(2)
    for f in sorted(HOST_SRC.rglob("*.ts")):
        for m in HOST_RAISE_RE.finditer(f.read_text()):
            literal, ident = m.group(1), m.group(2)
            if literal:
                codes.add(literal)
            elif ident in consts:
                codes.add(consts[ident])
    return codes


def test_count_constants() -> list[tuple[Path, int, str, int]]:
    """(file, line, const-name, value) for every hardcoded tool-count constant in
    the host tests — `EXPECTED_TOOL_COUNT` in registration/toolsets/annotations,
    `FULL_TOOL_COUNT` in capabilities, and `FULL` / `SECURE_DEFAULT` in the tools
    export.

    These are self-gating in the sense that the tests fail if the code and the
    constant disagree. They are checked here anyway so that ONE run names all of
    them at once with the derived number, instead of N separate assertion
    failures a reader has to reconcile by hand.

    🆕 251 — `FULL` AND `SECURE_DEFAULT` WERE OUTSIDE THE ROSTER FOR TWENTY-THREE
    SESSIONS, and the reason is the one this file already writes up about the
    sibling project: *the mechanism is right; the MARKER is what fails.* Five of
    the seven constants were matched because they are spelled with the word
    `TOOL_COUNT` in them; `tools-export.test.ts` named its two after what they
    are rather than after the pattern, and a roster of PHRASINGS could not see
    them. Nothing was wrong with either value — that is the point. A roster that
    happens to be complete and a roster that is complete by construction are the
    same output until the day they are not.

    🔴 `SECURE_DEFAULT` IS THE FIRST MEMBER THAT IS NOT `total_tools`. The caller
    resolves the expected value BY NAME (see check 13); adding a constant here
    without teaching that site what it should equal would compare 279 against 292
    and redden a correct tree.
    """
    found: list[tuple[Path, int, str, int]] = []
    for f in sorted(HOST_TEST.rglob("*.ts")):
        for lineno, line in enumerate(f.read_text().splitlines(), 1):
            m = re.match(
                r"\s*const\s+(EXPECTED_TOOL_COUNT|FULL_TOOL_COUNT|FULL|SECURE_DEFAULT)"
                r"\s*=\s*(\d+)",
                line,
            )
            if m:
                found.append((f, lineno, m.group(1), int(m.group(2))))
    return found


def _mask_continuations(text: str, suffix: str) -> str:
    """Blank the JSDoc `*` (or markdown `>`) line-continuation marker, preserving
    every character offset so line numbers computed from the masked text stay
    exact.

    Load-bearing: prose in this repo wraps mid-claim. `recipes.ts` says
    "(the 289-tool\n * count is unchanged)" and `capabilities.ts` says
    "The full\n * 289-tool surface". A line-by-line scan sees neither, and an
    unmasked file-wide scan is blocked by the `*`.
    """
    marker = r"\*" if suffix == ".ts" else ">"
    return re.sub(rf"(?m)^(\s*){marker}", lambda m: m.group(1) + " ", text)


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _snip(text: str) -> str:
    """Collapse a match to one line — claims wrap mid-phrase, and a raw newline
    in a FAIL message truncates the quoted evidence at the wrap."""
    return " ".join(text.split())


# Claims about the FULL surface. Each pattern captures the number in group 1.
# A time-unit lookahead keeps "the full 20 s DAP timeout" out of the count net.
#
# The numbers in the comments below are ILLUSTRATIVE examples of each pattern's
# shape, not claims about the current surface — this file is not in
# TOOL_COUNT_FILES and gates itself against nothing. Don't chase them on a
# release; do fix any that quote real source text verbatim.
TOTAL_CLAIM_RES = [
    # "full 286 tools", "all 286 tools", "full 286-tool", "total 286 MCP tools"
    re.compile(r"\b(?:full|all|entire|total)\s+\**(\d+)\**\s*(?:[-‑–]tool\b|(?:\s+MCP)?\s+tools?\b)"),
    # "the full **286**", "never sees all 286 at once" — bare, 3-digit only
    re.compile(r"\b(?:full|all)\s+\**(\d{3})\b(?!\s*\**\s*(?:ms|s|m|h|MB|KB)\b)"),
    # "the full surface (286 tools)"
    re.compile(r"\b(?:full|entire)\s+surface\s*\(\s*\**(\d+)"),
    # "286-tool surface", "the 286-tool count is unchanged"
    re.compile(r"\b(\d+)[-‑–]tool\s+(?:surface|count)\b"),
    # "**286 tools** in total"
    re.compile(r"\b(\d+)\s+tools?\**[^.\n]{0,24}\bin total\b"),
    # the catalog/host-README headline: "286 tools + 6 MCP resources"
    re.compile(r"\b(\d+)\s+tools?\**\s*\+\s*\d+\s*\**\s*MCP\s+resources"),
]

# Claims about the SECURE-DEFAULT surface (the two privileged groups off).
# The gap between the marker and the number excludes newlines and `(`: without
# them, `"secure-default")` in a CLI flag literal reaches across two lines to the
# `return 2` below it, and "the secure default (14 dropped)" gets read as a
# secure-default claim of 14 rather than the privileged claim it is.
SECURE_CLAIM_RES = [
    re.compile(r"\b(?:secure|safe)[-\s]default(?:\s+surface)?(?:\s+is|\s+of)?[^\d\n(]{0,24}?(\d+)"),
    re.compile(r"\bdefault\s+surface\s+is\s+\**(\d+)"),
]

# Claims about how many tools are DROPPED by default.
PRIVILEGED_CLAIM_RES = [
    re.compile(r"\((\d+)\s+dropped\)"),
    re.compile(r"\b(\d+)\s+privileged\b"),
    # README: "…not 286 with a warning label on 14 of them."
    re.compile(r"\bon\s+(\d+)\s+of\s+them\b"),
]

# "286 − 14 = 272 tools" — states all three numbers at once.
ARITH_CLAIM_RE = re.compile(r"(\d+)\s*[-−–—]\s*(\d+)\s*=\s*(\d+)\s*tools?\b")


def tool_count_claims(files: list[Path]) -> list[tuple[Path, int, str, int, str]]:
    """(file, line, kind, claimed, snippet) for every tool-count claim.

    `kind` is one of `full`, `secure-default`, `privileged`, or `residual`.

    Two nets, deliberately different in shape:

    * The pattern nets above match a number only when a SURFACE MARKER sits next
      to it — `full`, `all`, `secure-default`, `-tool surface`, `N dropped`, the
      `A − B = C tools` arithmetic. Family counts ("roughly 145 tools", the
      `runtime_*` plane's 14, an alternative's "162-tool ceiling") carry no such marker
      and are correctly invisible to this check: they are a different, far lower
      stakes class than a stale claim about the whole surface.
    * The `residual` net then says: on any line that ALREADY makes a surface
      claim, every three-digit integer must itself be a surface number. That is
      what catches README's "…**272 tools an agent can actually call**, not 286
      with a warning label", where the second number has no marker of its own and
      would otherwise drift alone. Three digits, not two, because two-digit
      matching trips over version strings like `1.21.1`.
    """
    claims: list[tuple[Path, int, str, int, str]] = []
    for f in files:
        if not f.exists():
            continue
        raw = _mask_continuations(f.read_text(), f.suffix)
        # Arithmetic first, then blank its span (same length, so offsets hold) so
        # "the secure-default surface is 286 − 14 = 272 tools" cannot be read as a
        # secure-default claim of 286.
        text = raw
        for m in ARITH_CLAIM_RE.finditer(raw):
            for grp, kind in ((1, "full"), (2, "privileged"), (3, "secure-default")):
                claims.append(
                    (f, _line_of(raw, m.start(grp)), kind, int(m.group(grp)), _snip(m.group(0)))
                )
            text = text[: m.start()] + " " * (m.end() - m.start()) + text[m.end() :]

        claimed_lines: set[int] = {ln for g, ln, _k, _n, _s in claims if g == f}
        for res, kind in (
            (TOTAL_CLAIM_RES, "full"),
            (SECURE_CLAIM_RES, "secure-default"),
            (PRIVILEGED_CLAIM_RES, "privileged"),
        ):
            for rx in res:
                for m in rx.finditer(text):
                    ln = _line_of(text, m.start(1))
                    claimed_lines.add(ln)
                    claims.append((f, ln, kind, int(m.group(1)), _snip(m.group(0))))

        # residual net — three-digit integers sharing a line with a real claim
        for ln, line in enumerate(text.splitlines(), 1):
            if ln not in claimed_lines:
                continue
            for m in re.finditer(r"(?<![\d.])(\d{3})(?![\d.])", line):
                claims.append((f, ln, "residual", int(m.group(1)), line.strip()[:90]))
    return claims


# --- 11b helpers: tool-FAMILY counts (WARN only) ----------------------------
# Check 11 gates only claims carrying a surface marker, and that stays right — the
# alternative is an allowlist of bare numbers, and every entry in such a list is a
# hole in the real check. But the family class is not harmless: README documented
# `BREAKPOINT_TOOLSETS=c` as 14 runtime tools for four releases after it became 24,
# and `editor,runtime,vcs` as 172 when it was 182.
#
# The first design here filtered "N tools" phrases against every subset SUM, and a
# negative test showed it swallowed BOTH of those defects — 14 and 172 are both
# reachable as sums, so it would have reported "0 suspects" while they sat stale.
# A check that reads as verification and verifies nothing is worse than none, so
# that approach was dropped for an exact one:
#
#   the docs state family counts in a fixed shape — a toolset expression followed
#   by an arrow and a number — and THAT can be resolved precisely, id by id.
#
# Anything not in that shape is listed for a human, explicitly as an eyeball aid
# and not as a check.

TOOLSET_CLAIM_RE = re.compile(
    r"`(?:BREAKPOINT_TOOLSETS=)?([a-z]+(?:\s*,\s*[a-z]+)*)`[^\n]{0,40}?[→>-]\s*\**(\d{1,4})\b"
)
ANY_TOOL_COUNT_RE = re.compile(r"\b(\d{2,4})\s*\**\s*[-‑–]?\s*tools?\b", re.I)


def toolset_members() -> dict[str, list[str]]:
    """toolset id -> the tool NAMES it registers, resolved through toolsets.ts.

    Each entry maps an id to one `register*Tools` call, and that function is
    imported from a known file, so the group is that file's registrations. The
    `editor` group is the one special case: `tools/editor.ts` re-exports the
    `tools/editor/*.ts` modules, so its members are the directory total.

    🆕 253 — THIS USED TO COUNT AND THE COUNT WAS THE WHOLE READER. `toolset_sizes`
    resolved a group by regex-COUNTING `registerTool(` sites and captured no names,
    so every claim in the tree downstream of it — check 11b's `<ids> -> N`, check
    25's derivable values, `doctor`'s group sizes — was verified as a TOTAL. Move
    one tool from `editor` to `runtime` and add one to `editor` and every one of
    those numbers stays green, because neither total moved. The names are what make
    the partition falsifiable, and they are the join the catalog's `Plane` column
    had been missing since the column existed.

    🔴 THE NAMES ARE ALSO A SECOND ASSERTION THE COUNT COULD NOT MAKE. Summed, this
    is `registered_tools()` — the same net over a DIFFERENT path to the same files:
    that walk is `tools/**`, this one is the reachability graph out of
    `toolsets.ts`. Check 4d compares them, so a module that registers tools and is
    imported by no toolset — surface a `BREAKPOINT_TOOLSETS` operator can never
    load — stops being invisible to everything.
    """
    text = (HOST_SRC / "toolsets.ts").read_text()
    imports = dict(
        re.findall(r'import\s*\{\s*(register\w+)\s*\}\s*from\s*"\./([^"]+)\.js"', text)
    )

    def names_in(path: Path) -> list[str]:
        if not path.exists():
            return []
        body = path.read_text()
        return re.findall(r'registerTool\(\s*"([a-z0-9_]+)"', body) + re.findall(
            r'registerTaskTool\(\s*\w+\s*,\s*"([a-z0-9_]+)"', body
        )

    members: dict[str, list[str]] = {}
    for tid, fn in re.findall(r'\{\s*id:\s*"([a-z]+)".*?(register\w+Tools)\(', text, re.S):
        rel = imports.get(fn)
        if not rel:
            continue
        names = names_in(HOST_SRC / f"{rel}.ts")
        d = HOST_SRC / rel
        if d.is_dir():
            for x in sorted(d.rglob("*.ts")):
                names += names_in(x)
        members[tid] = names
    return members


def toolset_sizes() -> dict[str, int]:
    """toolset id -> how many tools it registers. DERIVED from `toolset_members()`.

    🔴 DERIVED, NOT RE-READ, AND THAT IS THE POINT. Two regexes over one file for
    one fact is the shape 251 and 252 each spent a session correcting in a
    document; it is no better in a script. The count is now `len()` of the list
    the join is made from, so the size a prose claim is checked against and the
    membership a `Plane` cell is checked against cannot disagree.
    """
    return {tid: len(names) for tid, names in toolset_members().items()}


def toolset_aliases() -> dict[str, list[str]]:
    """The plane aliases (`a`/`b`/`c`/`d`/`csharp`/`semantic`) from config.ts."""
    text = (HOST_SRC / "config.ts").read_text()
    m = re.search(r"export const TOOLSET_ALIASES[^=]*=\s*\{(.*?)\n\};", text, re.S)
    if not m:
        return {}
    out: dict[str, list[str]] = {}
    for am, ids in re.findall(r'(\w+):\s*\[([^\]]*)\]', m.group(1)):
        out[am] = re.findall(r'"([a-z]+)"', ids)
    return out


def toolset_claims(files: list[Path]) -> "tuple[list[str], list[tuple[Path, int, int, str]], int, set[tuple[Path, int, int]]]":
    """(mismatches, unresolved, resolved, resolved triples) — exact check of `<ids>` -> N
    claims, plus every other "N tools" phrase listed for a human to eyeball.

    🔴 THE SIGNATURE STAYS ON ONE LINE, AND THAT IS NOT FORMATTING. `scope_gate.py`'s
    `targets()` matches `^def name(...) -> ret:$` on a SINGLE line; wrapped for width, this
    function stops being a blindable target, `SCOPE_GATE_TARGETS_COLLAPSE` fires, and the
    roster halves report it as a stale BLAST/LEDGER entry. Measured, this session, by
    wrapping it: 24 targets against a floor of 25. An enumerator this file can no longer be
    blinded through is an enumerator whose collapse nothing would notice.

    🔴 THE FOURTH RETURN IS (file, line, VALUE) AND THE VALUE IS WHY IT EXISTS (222).
    Check 25's population is the complement of what every reader here claimed, and a
    LINE-granular complement masks a second numeral sharing a resolved line — which is
    exactly `USER_GUIDE.md:463`, where `a,netcode,… -> 181` is resolved and the `148`
    after it is not. Reporting the line alone would have handed check 25 a blind spot of
    the same shape it was written to close.

    🔴 `resolved` IS THE SCOPE, AND IT WAS NOT REPORTED (172). Both returned lists are
    OFFENDER lists: empty means "nothing wrong", which is also what a finder that read
    nothing produces. Blinded, this function left check 11b green AND made its warning
    disappear — a gate getting quieter as it goes blind. The count of claims it actually
    RESOLVED is the only number that separates the two, so it comes back too.
    """
    sizes = toolset_sizes()
    aliases = toolset_aliases()
    mismatches: list[str] = []
    resolved_lines: set[tuple[Path, int]] = set()
    resolved_values: set[tuple[Path, int, int]] = set()

    for f in files:
        if not f.exists():
            continue
        text = _mask_continuations(f.read_text(), f.suffix)
        for m in TOOLSET_CLAIM_RE.finditer(text):
            toks = [x.strip() for x in m.group(1).split(",")]
            ids: list[str] = []
            for tok in toks:
                ids.extend(aliases.get(tok, [tok]))
            if not ids or any(i not in sizes for i in ids):
                continue  # not a toolset expression — e.g. a prose backtick
            ln = _line_of(text, m.start(2))
            resolved_lines.add((f, ln))
            expect = sum(sizes[i] for i in dict.fromkeys(ids))
            claimed = int(m.group(2))
            resolved_values.add((f, ln, claimed))
            if claimed != expect:
                mismatches.append(
                    f"{f.relative_to(ROOT)}:{ln} says `{m.group(1)}` -> {claimed}, "
                    f"code says {expect} ({' + '.join(f'{i}={sizes[i]}' for i in dict.fromkeys(ids))})"
                )

    unresolved: list[tuple[Path, int, int, str]] = []
    for f in files:
        if not f.exists():
            continue
        text = _mask_continuations(f.read_text(), f.suffix)
        for m in ANY_TOOL_COUNT_RE.finditer(text):
            ln = _line_of(text, m.start(1))
            if (f, ln) in resolved_lines:
                continue
            unresolved.append((f, ln, int(m.group(1)), _snip(m.group(0))))
    return mismatches, unresolved, len(resolved_lines), resolved_values


# --- 13 helpers: prefix families, the all-false class, an alternative's ceiling -
# 11b resolves a `<toolset ids>` -> N claim exactly and lists everything else
# for a human to eyeball. That list sat at EIGHT entries across three releases
# and nobody resolved it, which is the failure mode of any warn-only class:
# visible is not the same as verified, and a warning nobody acts on is a warning
# that has stopped working.
#
# All eight were resolved by hand in session 131. Every one was accurate as a
# number; one was accurate about the wrong thing (README and the User Guide
# state Plane A as ~146, the `editor` toolset, while the sentence around the
# number describes a scope the code puts at 179 — see the plane bullets). The
# three shapes they fall into are gated below, so the resolving does not have to
# be done by hand again.
#
# Nothing here relaxes 11b — 11b was promoted to a hard failure in the same
# session, so the two now agree. Each shape is resolved EXACTLY, from code:
#
#   1. a tool-name glob — "`runtime_*`, 27 tools" — counted against the
#      registered roster check 1 already builds. Not a sum over subsets, not an
#      allowlist of blessed numbers: both were rejected upstream for admitting
#      the very defects they were meant to catch.
#   2. `annotations.ts`'s all-false class, derived as ALL_ANNOTATED minus the
#      four hint lists — the same subtraction the comment claims.
#   3. numbers that are not claims about this surface at all. Today exactly one:
#      an ALTERNATIVE's tool ceiling. Named individually with a reason in
#      FAMILY_COUNT_EXEMPT, never pattern-matched — and an exemption that
#      matches nothing FAILS, because an exemption for a claim that is gone
#      exempts nothing and hides the next one (check 12's vacuity rule).

PREFIX_FAMILY_RE = re.compile(
    r"`([a-z][a-z0-9_]*_)\*`[^\n]{0,24}?\**(\d{1,4})\**\s*[-‑–]?\s*tools?\b"
)
ALL_FALSE_CLAIM_RE = re.compile(r"(\d{1,4})\s*\**\s*tools?\s+are\s+all-false")

#   4. an ANNOTATION CLASS — "`mutating+non-idempotent` 72 tools" — derived from
#      annotations.ts by the same set arithmetic the claim names. This is shape
#      2 generalised: the all-false count was one class, and `timeout-caveat.ts`
#      needs four more, because which caveat a tool's timeout carries IS that
#      arithmetic. A count that decides user-visible text is exactly the kind
#      that must not drift silently.
#
#      The class token is required in backticks so the claim says WHICH set it
#      is counting. A bare "72 tools" stays unresolved and warns, deliberately —
#      the point is not to bless the number 72, it is to tie a number to the
#      derivation that produces it.
ANNOTATION_CLASS_RE = re.compile(
    r"`(read-only|mutating|mutating\+idempotent|mutating\+non-idempotent)`"
    r"[^\n]{0,16}?\**(\d{1,4})\**\s*[-‑–]?\s*tools?\b"
)

# (path relative to ROOT, exact text that must still be present) -> why no check
# can own it. Adding an entry is a claim that NOTHING in this tree can derive
# the number; it is not a way to quiet a claim that is merely inconvenient.
FAMILY_COUNT_EXEMPT: dict[tuple[str, str], str] = {
    ("docs/TOOL_CATALOG.md", "162-tool"): (
        "godot-mcp-pro's ceiling — an alternative's surface, quoted to say which group "
        "crosses it. Nothing in this repo can derive it, and resolving it "
        "against our own counts would be wrong rather than lenient."
    ),
}


def prefix_family_claims(
    files: list[Path], tools: set[str]
) -> tuple[list[str], set[tuple[Path, int]]]:
    """(mismatches, resolved lines) — `<prefix>_*` -> N against the roster."""
    mismatches: list[str] = []
    resolved: set[tuple[Path, int]] = set()
    for f in files:
        if not f.exists():
            continue
        text = _mask_continuations(f.read_text(), f.suffix)
        for m in PREFIX_FAMILY_RE.finditer(text):
            prefix, claimed = m.group(1), int(m.group(2))
            actual = sum(1 for t in tools if t.startswith(prefix))
            ln = _line_of(text, m.start(2))
            resolved.add((f, ln))
            if actual == 0:
                mismatches.append(
                    f"{f.relative_to(ROOT)}:{ln} names `{prefix}*`, which matches "
                    f"no registered tool — a renamed family left a stale glob"
                )
            elif claimed != actual:
                mismatches.append(
                    f"{f.relative_to(ROOT)}:{ln} says `{prefix}*` -> {claimed}, "
                    f"the roster has {actual}"
                )
    return mismatches, resolved


def _annotation_names(raw: str):
    """One reader for annotations.ts's name lists, shared by every check that
    derives a class size from them.

    Extracted rather than duplicated: two checks that parse the same file with
    two copies of the same regex can disagree about what a list contains, and
    then one of them is silently counting something else. Same reasoning as
    `columnExprPlaceholders` sharing a scanner with `resolveColumnExpr`.
    """
    def names(const: str) -> set[str]:
        m = re.search(
            rf"const {const}:\s*readonly string\[\]\s*=\s*\[(.*?)\];", raw, re.S
        )
        return set(re.findall(r'"([a-z_0-9]+)"', m.group(1))) if m else set()

    return names


def annotation_class_claims(files) -> tuple[list[str], set[tuple[Path, int]]]:
    """(mismatches, resolved lines) — annotation-class sizes, actually derived.

    `timeout-caveat.ts` picks which caveat a bridge timeout carries from a tool's
    annotations, so its class sizes are load-bearing prose: they are the stated
    blast radius of a user-visible behaviour. Each is the size of the set its own
    backticked token names, computed here from `annotations.ts`.

    A class whose token appears with no derivable set is a hard error rather than
    a skip — the vacuity rule check 12 established. If ALL_ANNOTATED cannot be
    parsed, every claim would otherwise resolve against an empty set and pass.
    """
    src = HOST_SRC / "annotations.ts"
    mismatches: list[str] = []
    resolved: set[tuple[Path, int]] = set()
    if not src.exists():
        return mismatches, resolved
    names = _annotation_names(src.read_text())
    every, read_only, idem = names("ALL_ANNOTATED"), names("READ_ONLY"), names("IDEMPOTENT")
    mutating = every - read_only
    sizes = {
        "read-only": len(read_only),
        "mutating": len(mutating),
        "mutating+idempotent": len(mutating & idem),
        "mutating+non-idempotent": len(mutating - idem),
    }
    for f in files:
        try:
            text = _mask_continuations(f.read_text(), f.suffix)
        except OSError:
            continue
        for m in ANNOTATION_CLASS_RE.finditer(text):
            cls, stated = m.group(1), int(m.group(2))
            ln = _line_of(text, m.start(2))
            resolved.add((f, ln))
            if not every:
                mismatches.append(
                    f"{f.relative_to(ROOT)}:{ln} claims `{cls}` {stated} tools, but "
                    f"ALL_ANNOTATED could not be parsed — the claim would resolve "
                    f"against an empty set and pass blind"
                )
            elif stated != sizes[cls]:
                mismatches.append(
                    f"{f.relative_to(ROOT)}:{ln} says `{cls}` is {stated} tools; "
                    f"annotations.ts makes it {sizes[cls]}"
                )
    return mismatches, resolved


def all_false_annotation_claims() -> tuple[list[str], set[tuple[Path, int]]]:
    """(mismatches, resolved lines) — the all-false count, actually subtracted.

    `annotations.ts` explains that ALL_ANNOTATED cannot be derived as the union
    of the four hint lists because N tools are all-false. That N is the size of
    exactly that difference, so it is checkable — and it is the one number in
    the family class whose drift would quietly weaken the reasoning for the
    totality check itself.
    """
    f = HOST_SRC / "annotations.ts"
    mismatches: list[str] = []
    resolved: set[tuple[Path, int]] = set()
    if not f.exists():
        return mismatches, resolved
    raw = f.read_text()
    names = _annotation_names(raw)

    every = names("ALL_ANNOTATED")
    text = _mask_continuations(raw, f.suffix)
    claims = list(ALL_FALSE_CLAIM_RE.finditer(text))
    if not every:
        if claims:
            mismatches.append(
                f"{f.relative_to(ROOT)}: ALL_ANNOTATED could not be parsed, so the "
                f"all-false count cannot be derived — the check would pass blind"
            )
        return mismatches, resolved
    hinted = (
        names("READ_ONLY")
        | names("DESTRUCTIVE")
        | names("IDEMPOTENT")
        | names("OPEN_WORLD")
    )
    actual = len(every - hinted)
    for m in claims:
        ln = _line_of(text, m.start(1))
        resolved.add((f, ln))
        if int(m.group(1)) != actual:
            mismatches.append(
                f"{f.relative_to(ROOT)}:{ln} says {m.group(1)} tools are all-false; "
                f"ALL_ANNOTATED minus the four hint lists is {actual}"
            )
    return mismatches, resolved


def exempt_family_lines() -> tuple[list[str], set[tuple[Path, int]]]:
    """(errors, resolved lines) — FAMILY_COUNT_EXEMPT, plus its vacuity guard."""
    errors: list[str] = []
    resolved: set[tuple[Path, int]] = set()
    for (rel, needle), why in FAMILY_COUNT_EXEMPT.items():
        f = ROOT / rel
        hits = 0
        if f.exists():
            for i, line in enumerate(f.read_text().splitlines(), 1):
                if needle in line:
                    hits += 1
                    resolved.add((f, i))
        if hits == 0:
            errors.append(
                f"FAMILY_COUNT_EXEMPT names {rel} “{needle}”, which is no longer "
                f"there. An exemption for a claim that is gone exempts nothing and "
                f"hides the next number written on that line — delete the entry. "
                f"(reason on record: {why})"
            )
    return errors, resolved


# --- 25 helpers: the numerals NO reader claimed ------------------------------
# 🔴 EVERY COUNT READER ABOVE THIS LINE IS MARKER-GATED, AND 221 §4 IS WHAT THAT COSTS.
# `TOTAL_CLAIM_RES` needs `full` / `all` / `entire surface` / `N-tool surface` / `N tools
# in total` / `N tools + N MCP resources`; `SECURE_CLAIM_RES` needs a `secure-default`
# beside the number; 11b needs a backticked toolset expression and an arrow; 13 needs a
# glob or an annotation class in backticks. Two sentences in the shipped README carried
# none of them:
#
#     README.md:119  "the tool *count* is not the axis — ours is 289 because that is
#                     what a static contract check asserts"
#     README.md:381  "Recipes also add no tools (the count stays 289)"
#
# Seven other sites in the same file said 291, this file read that file at SEVEN call
# sites, and it exited 0 over both. A bare numeral in running prose carries no marker and
# was therefore outside every population — and the first of the two is the line that tells
# an alternative's reader our count is not the axis.
#
# 🔴 THE SAME MISS, IN A DIFFERENT LANGUAGE, FOUND IN AN ALTERNATIVE ON THE SAME DAY.
# `godot-mcp-enhanced` runs `check-tool-count.mjs` in CI and its `README.md:142` still
# drifts to 36/205, because that line is not in its regex table. Two projects, two count
# gates, both reading a ROSTER OF PHRASINGS rather than the file, both drifting in the
# sentence the roster did not name. The mechanism is right; the marker is what fails.
#
# 🔴 SO THIS CHECK IS THE INVERSE OF EVERY REGEX ABOVE IT, AND THE INVERSION IS THE POINT.
# The others ask *does this claim-shaped phrase agree with the code?* This one asks the
# complement — *is there a numeral here that no reader took?* — and refuses unless the
# number is one this tree can DERIVE. The population is defined as what the readers did
# NOT claim, so a reader added later shrinks it automatically and this check can never
# become the thing it is watching for: a second roster to keep in sync by hand.
#
# 🔴 AND THE EXCLUDED SCOPE IS ADMITTED RATHER THAN PINNED (221 §5.2). Exactly two things
# are outside the population, both stated and one of them COUNTED on every run:
#   * `docs/TOOL_CATALOG.md` — PROSE_NUMERAL_EXCLUDED, reason on the entry, numerals
#     counted and printed so the debt is a number every run instead of an absence.
#   * two-digit numbers — check 13 owns the family class, and two digits collide with
#     version strings (`1.21.1`) for the reason `tool_count_claims` already records.
# An allowlist of blessed NUMBERS is refused here as it has been refused four times
# already in this file (SUBGROUP_COUNTS, FAMILY_COUNT_EXEMPT, 11b's rejected subset-sum
# filter, SHAPE_COVERAGE_EXEMPT): PROSE_NUMERAL_EXEMPT is keyed by EXACT TEXT, never by
# value, and an entry that stops matching FAILS.

# Live docs whose PROSE numerals this check owns.
#
# 🔴 225 — `docs/TOOL_CATALOG.md` IS IN, AND THE DEBT IT WAS EXCLUDED FOR IS PAID. The
# exclusion note said "bringing it in means resolving six historical batch totals by hand
# first; until someone does, the count below is the size of that debt." It was carried at
# twenty numerals for three sessions (222 §2.1 -> 223 §6.7 -> 224 §7.5). Measured, the
# twenty were six running batch totals, five JSON Schema literals inside fences, four
# session citations, one alternative server's ceiling, one line of quoted compiler output,
# one worked example, and two total claims check 11 already owns.
#
# The six running totals — "(now **165**)", "(now **195**)" and four more — were DELETED
# from the prose rather than pinned. They were snapshots as of a batch, every one of them
# wrong today against a 292-tool surface, and nothing in this tree could ever derive one:
# a number whose only correct value is the one it had on the day it was typed is not a
# claim, it is a fossil. 224 §7.15's finding is the general case — a figure nobody
# re-derives goes stale, and the fix is to stop carrying it, not to carry it more carefully.
#
# 🔴 FENCED BLOCKS ARE NOW MASKED, AND THE COUNT IS PRINTED. The previous note said masking
# "would buy silence for a case that does not exist" — true of the three docs then in the
# population, and false the moment this one joined: it carries five three-digit literals
# inside ```json fences (`"default": 200`, `"maxLength": 255`). Those are not prose. They
# are the INPUT to checks 18/19, which parse all 522 catalog JSON blocks and compare every
# one against `schemas.ts` — so a numeral in a fence already has a reader, and it is a
# stricter one than this check. The masked count prints on every run beside the numerals
# read, because an exclusion nobody counts is the thing this check exists to prevent.
PROSE_NUMERAL_DOCS = [
    ROOT / "README.md",
    ROOT / "host/README.md",
    ROOT / "docs/USER_GUIDE.md",
    ROOT / "docs/TOOL_CATALOG.md",
]

# Live docs deliberately OUTSIDE the population, each with the reason. Their numerals are
# counted and reported rather than allowlisted, so the exclusion is a number a reader can
# argue with instead of a silence nobody can see.
#
# 🔴 DELIBERATELY EMPTY SINCE 225, and the emptiness is load-bearing rather than tidy: this
# table's only entry was TOOL_CATALOG.md, and every live doc in this tree is now inside the
# population. An entry added here must carry the same shape of reason the last one did —
# and, per its own precedent, an expiry condition somebody can actually meet.
PROSE_NUMERAL_EXCLUDED: dict[Path, str] = {}

# (path relative to ROOT, exact text that must still be present on the line) -> why no
# derivation in this tree can own the number. DELIBERATELY EMPTY, and strict-by-default is
# the point — RECIPE_ROSTER_EXEMPT's rule, one check over. An entry that stops matching
# FAILS, because an exemption for a sentence that is gone exempts nothing and hides the
# next numeral written on that line.
PROSE_NUMERAL_EXEMPT: dict[tuple[str, str], str] = {
    ("README.md", "An authoring-focused server we re-measured"): (
        "🔴 THE FIRST LIVE ENTRY IN THIS TABLE, AND IT IS THE ONE THE TABLE WAS BUILT "
        "FOR. D2's other half publishes what our tool surface costs, and a comparison "
        "with one number in it is not a comparison. The row's tool count and its "
        "bytes-per-tool are measurements of SOMEBODY ELSE'S SERVER: this tree can "
        "re-derive them — `token-cost.mjs --server` does exactly that, which is why the "
        "figures are ours to publish at all — but it cannot DERIVE them, because "
        "nothing here decides how many tools another project ships. Keyed by the "
        "sentence rather than by the values, so the day that row is re-measured against "
        "a different server the exemption stops matching and this check says so."
    ),
    # ── 225: the six survivors of admitting docs/TOOL_CATALOG.md ──────────────────────
    # Each is a number that belongs to somebody else's document, and the three classes are
    # kept apart on purpose: a citation, a quotation, and a worked example fail in
    # different ways, and an entry that lumped them would be one reason covering three
    # rules — 222 §2's defect, in a table built to prevent it.
    ("docs/TOOL_CATALOG.md", "(`Unexpected true - file Renamer.cs line 151`)"): (
        "QUOTED COMPILER OUTPUT. `151` is a line number in a C# file inside a user's own "
        "project, reproduced verbatim so a reader recognises the message when Godot's "
        "C# tooling hands it to them. Nothing here can derive it and nothing here should "
        "want to: the day we 'correct' a number inside a quotation, the quotation stops "
        "being one."
    ),
    ("docs/TOOL_CATALOG.md", "**Godot 4.7 performs full expression evaluation**"): (
        "A WORKED EXAMPLE. The sentence shows `counter + 1` evaluating to `101` to make "
        "the difference between Godot 4.3's bare-name lookup and 4.7's full evaluation "
        "concrete. The numeral is the OUTPUT of the example, not a claim about this "
        "tree's size — keyed by the engine-behaviour clause rather than by `101`, so "
        "rewriting the example around a different value keeps the exemption honest."
    ),
    ("docs/TOOL_CATALOG.md", "measured in session 161, four creators wrote seven files"): (
        "A SESSION CITATION, and the only entry here that matches on FOUR lines — the "
        "same provenance sentence is repeated on each of the four path-guarded creators, "
        "which is why it is one rule rather than four. `161` is where the measurement "
        "happened; it is history, and history is the one class of number that is "
        "supposed to stay fixed while the tree moves. 🔴 A future session that rewords "
        "this sentence on one of the four sites and not the others will find the "
        "exemption still matching the other three and the reworded one refused, which is "
        "the correct outcome and is why the key is the sentence."
    ),
}

# Three digits, not two, and not four. The guards on both sides are load-bearing rather
# than tidy: `342,113 B` must yield NEITHER 342 nor 113, `:6006` must yield nothing, and
# `1.73.4` must not be read as a claim about anything.
#
# 🔴 A `.` OR `,` DISQUALIFIES ONLY WHEN A DIGIT IS ON ITS FAR SIDE, AND THE FIRST DRAFT
# OF THIS LINE DID NOT SAY SO. It was `(?<![\d.,])(\d{3})(?![\d.,])`, which reads a
# TRAILING FULL STOP as evidence of a decimal — so a stale count ending a sentence
# ("…ours is 289.") was outside the population of the check written to find stale counts.
# 🔴 NOTHING IN THIS FILE FOUND THAT. `control_gate.py`'s new `25.prose` row did, on its
# first run, by inserting exactly that sentence and reporting CONTROL_GATE_GREEN — the
# positive control refuting the check it was written to cover, which is the only outcome
# that makes a control worth the tree mutation it costs. The pin below is that sentence.
# 🔴 THE LETTER GUARDS ARE 224's, AND A LIVE DEFECT FOUND THEM. Publishing the
# token-cost table put the word `cl100k_base` into README.md — a tokenizer's name —
# and this scanner read `100` out of the middle of it and refused the line. A
# three-digit run welded to a letter is part of an identifier, not a claim anybody
# can restate, and no reader was ever going to own it. Pinned below, both sides.
PROSE_NUMERAL_RE = re.compile(
    r"(?<![\dA-Za-z])(?<![\d][.,])(\d{3})(?![\dA-Za-z])(?![.,]\d)"
)

# 🔴 THE NEGATIVE HALF, WHICH IS THE HALF A POSITIVE CONTROL CANNOT REACH (221 §5.2).
# `control_gate.py` asserts that a mutation REDDENS a statement; every row it can express
# is a positive. The failure mode this scanner actually has is the opposite one — a
# pattern that eats too much and reddens on a number that was never ours — and the only
# thing that catches it is a row asserting the scanner flags NOTHING. Both directions are
# pinned here and evaluated on every run, not only under the sweep.
#
# (text, the numerals the scanner MUST return, why this row is in the table)
PROSE_NUMERAL_PINS: "list[tuple[str, tuple[int, ...], str]]" = [
    ("the tool *count* is not the axis — ours is 289 because that", (289,),
     "🔴 README.md:119 verbatim — the defect this check exists for"),
    ("Recipes also add no tools (the count stays 289) and cost nothing", (289,),
     "🔴 README.md:381 verbatim — the same class inside parentheses"),
    ("full 291 / secure-default 278 tools · 6 MCP resources", (291, 278),
     "two numerals on one line are two rows, never one"),
    ("**278 tools an agent can actually call**, not 291 with a warning label", (278, 291),
     "the residual shape check 11 was built for, seen from this side"),
    ("npm 1.73.4 · addon 1.9.9 · MIT", (),
     "🔴 version strings. A left guard that dropped `.` reads `73` and `1.9.9`'s parts"),
    ("278 tools = 342,113 B ≈ ~95,000 tokens", (278,),
     "🔴 THE ROW 221 §5.2 NAMED: comma-grouped byte and token counts are not ours, and a "
     "guard that dropped `,` returns 342, 113 and 000 from this one line"),
    ("the DAP client dials `:6006`, on 0.5 s and 2.0 s timers", (),
     "🔴 port numbers are four digits and a decimal is not an integer — both must miss"),
    ("a measured **~86–98% upfront token reduction**", (),
     "two-digit percentages are out of band, deliberately: check 13 owns that class"),
    ("the 278/13 split", (278,),
     "🔴 the privileged split — 278 is ours to derive, 13 is two digits and is not"),
    ("`runtime_*`, 27 tools", (),
     "two-digit family counts stay check 13's; a wider band would take them from it"),
    ("The axis is not 999.", (999,),
     "🔴 THE ROW A POSITIVE CONTROL WROTE. `25.prose` inserts this exact sentence and the "
     "first draft of the scanner did not see it — a trailing full stop read as a decimal "
     "point. A stale count ending a sentence was outside the population of the check "
     "written to find stale counts, and only the control noticed"),
    ("ours is 289. Everything else agrees", (289,),
     "the same hole in the shape it would actually ship in — the defect sentence, ended"),
    ("derived at ~3.6 bytes/token (cl100k_base, measured on the full surface)", (),
     "🔴 THE ROW A LIVE REFUSAL WROTE. `cl100k_base` is a tokenizer's NAME and this "
     "scanner read the three digits out of its middle, refusing the cost table on the "
     "session that published it. A numeral welded to a letter belongs to an identifier"),
    ("the 279-tool default weighs 343,463 B", (279,),
     "🔴 the letter guard must not cost the check its actual job: a real surface count "
     "on the same line as a comma-grouped byte count is still exactly one row"),
]


def prose_pin_problems() -> "tuple[list[str], int, int]":
    """(disagreements, rows read, rows that pin the scanner to flag NOTHING).

    The second and third returns are the scope, for `toolset_claims`'s reason (172): on a
    healthy tree the disagreement list is empty, so a table of ten rows and a table
    trimmed to one are the same observable — and a table trimmed to its POSITIVES is the
    specific trim that would leave the eats-too-much direction unpinned.
    """
    problems: list[str] = []
    negatives = 0
    for text, expected, why in PROSE_NUMERAL_PINS:
        if not expected:
            negatives += 1
        got = tuple(int(x) for x in PROSE_NUMERAL_RE.findall(text))
        if got != expected:
            problems.append(f"{text!r} -> {got}, pinned {expected} — {why}")
    return problems, len(PROSE_NUMERAL_PINS), negatives


def _mask_fences(text: str) -> "tuple[str, int]":
    """Blank the CONTENTS of ``` fences, preserving every character offset so line numbers
    stay exact. Returns the masked text and how many three-digit numerals were masked.

    🔴 225 — WHAT A FENCE IS, AND WHY IT IS NOT PROSE. `docs/TOOL_CATALOG.md` embeds 522
    JSON Schema blocks, and five of them carry a three-digit literal (`"default": 200`,
    `"maxLength": 255`). Those numerals ALREADY have a reader — checks 18/19 parse every
    one of those blocks and compare it against `schemas.ts`, which is a far stricter owner
    than "some human restated it". Reading them here would report a claim nobody made and
    push a real structure into an exemption table.

    The count comes back with the text because the alternative is the exact failure this
    check is named for: a masked region is an exclusion, and an exclusion nobody prints is
    a silence. It is reported beside the numerals read on every run.
    """
    masked_chars: list[str] = []
    n_masked = 0
    inside = False
    for line in text.split("\n"):
        if line.lstrip().startswith("```"):
            inside = not inside
            masked_chars.append(line)
            continue
        if inside:
            n_masked += len(PROSE_NUMERAL_RE.findall(line))
            masked_chars.append(" " * len(line))
        else:
            masked_chars.append(line)
    return "\n".join(masked_chars), n_masked


def prose_numerals(path: Path) -> "list[tuple[int, int, str]]":
    """(line, value, the whole line) for every three-digit numeral in a doc's prose."""
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8")
    text = _mask_continuations(raw, path.suffix)
    if path.suffix == ".md":
        text, _ = _mask_fences(text)
    out: list[tuple[int, int, str]] = []
    for ln, line in enumerate(text.splitlines(), 1):
        for m in PROSE_NUMERAL_RE.finditer(line):
            # The REPORTED line is the unmasked one — a reader who is told "line 2744" must
            # see what is on line 2744, not the blanks this function put there.
            out.append((ln, int(m.group(1)), raw.splitlines()[ln - 1].strip()))
    return out


def prose_numerals_masked(path: Path) -> int:
    """How many three-digit numerals `prose_numerals` declined because they sit in a fence."""
    if not path.exists() or path.suffix != ".md":
        return 0
    _, n = _mask_fences(_mask_continuations(path.read_text(encoding="utf-8"), path.suffix))
    return n


# Rows of the Tool Index: | `tool_name` | Plane | Status | Destructive |
# ONE regex, four cells. Both readers below come off it for `_annotation_names`'s
# reason — two copies of the same pattern can disagree about what a table contains,
# and then one of them is silently reading something else.
CATALOG_ROW_RE = re.compile(
    r"^\|\s*`([a-z0-9_]+)`\s*\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|", re.M
)


def catalog_index_rows() -> dict[str, str]:
    """Tool name -> the text of its `Destructive` cell, over the Tool Index table.

    🆕 251 — THE OTHER THREE COLUMNS HAD NEVER BEEN READ BY ANYTHING. Check 4 has
    compared the catalog to the registry since the catalog existed, and it compared
    the NAME cell: the regex stopped at the first `|`. `Plane`, `Status` and
    `Destructive` were shipped, published, and gated by nothing — which is how the
    column that tells a reader whether a tool can destroy their work came to
    disagree with the annotation the client actually consumes, on 21 of 292 rows,
    with the whole suite green.
    """
    return {m.group(1): m.group(4).strip() for m in CATALOG_ROW_RE.finditer(CATALOG.read_text())}


def catalog_index_tools() -> set[str]:
    return set(catalog_index_rows())


# The machine-owned atom inside the `Plane` cell: a backticked toolset id, first
# thing in the cell, with the human's group letter after it. `` `editor` · A / Editor ``.
CATALOG_PLANE_ATOM_RE = re.compile(r"^\s*`([a-z]+)`")


def catalog_index_planes() -> dict[str, str]:
    """Tool name -> the toolset id its `Plane` cell claims, "" when the cell has none.

    🆕 253 — THE THIRD COLUMN, AND THE ONE WHOSE TWO VOCABULARIES NEVER MET. 251
    read the `Destructive` cell off this table and left `Plane` and `Status` where
    it found them. `Plane` carried 22 free-form values — `A / Editor`, `B /
    Process`, `C / Runtime`, `J / Host` — and the code's partition is 14 toolset
    ids, so nothing could compare them even in principle: the doc's vocabulary is
    COARSER in one place (`M / Editor` is `netcode` and `backend`, two groups one
    cell cannot name) and FINER in nine others (`editor` is A, C, D, E, F, G, H, I
    and K). A normalization table between the two is the thing this repository
    refuses on principle, and it would have been a third copy to keep true.

    So the cell carries both: the toolset id as an atom the registry owns, and the
    group letter as the prose it always was. Same shape as 252's ✔ — one glyph,
    one predicate — and for the same reason, since `Plane` is read by a human
    deciding which groups to put in `BREAKPOINT_TOOLSETS` and the id is the string
    they must type.

    🔴 THIS READER COMES OFF `CATALOG_ROW_RE`, SO 251's ARGUMENT DOES CARRY OVER
    HERE — and 252's does not apply. The name and this cell arrive in ONE match, so
    a table shape the pattern stops reading empties `cat_tools` and check 4 names
    every registered tool as missing from the index. What is NOT free is the atom
    going missing while the rows still parse, so `catalog.plane_atoms` is floored
    below on its own line: an empty atom on every row would otherwise leave 4d
    comparing nothing and reporting agreement.
    """
    out: dict[str, str] = {}
    for name, cell in ((m.group(1), m.group(2)) for m in CATALOG_ROW_RE.finditer(CATALOG.read_text())):
        m = CATALOG_PLANE_ATOM_RE.match(cell)
        out[name] = m.group(1) if m else ""
    return out


# A per-tool section heading: "### `name` ✔ ✅ · note", or a combined one naming
# several tools — "### `dbg_continue` / `dbg_step` ✅". The ✔ binds to the name it
# FOLLOWS, which is the whole reason the marker is a glyph on the name rather
# than the word "destructive" somewhere in the trailing prose: three headings
# name two tools each, and one of those has exactly one destructive member.
#
# 🆕 276 — THE TRAILING TEXT IS CAPTURED NOW, BECAUSE THE HEADING CARRIES A SECOND
# GLYPH AND NOTHING HAD EVER READ IT: `### `gd_workspace_symbols` ⚠️ · unsupported
# by Godot ≤ 4.7 (handled gracefully)`. ONE pattern, two readers, for the reason
# `_annotation_names` gives — a second copy of this regex could disagree with this
# one about what a heading IS, and then one of the two is silently reading
# something else. Group 1 is the names, group 2 is everything after them.
CATALOG_HEADING_RE = re.compile(r"^###\s+((?:`[a-z0-9_]+`(?:\s*✔)?(?:\s*/\s*)?)+)(.*)$", re.M)
CATALOG_HEADING_NAME_RE = re.compile(r"`([a-z0-9_]+)`(\s*✔)?")


def catalog_heading_rows() -> dict[str, bool]:
    """Tool name -> whether its section HEADING marks it destructive.

    🆕 252 — THE THIRD PLACE THIS PREDICATE IS WRITTEN AND THE SECOND NOTHING
    READ. 251 found the Tool Index's `Destructive` column had never been compared
    to `annotations.ts` and corrected 21 rows. The per-tool section heading — the
    line a reader actually lands on, and the only text most readers of a single
    tool ever see — carried the same claim as free prose (`· destructive (writes
    a file)`) on 63 of 289 sections, and it disagreed with the wire on 44: 35
    tools whose section said nothing at all, `tilemap_clear`, `godot_stop`,
    `vcs_restore` and `vcs_stash` among them, and 9 that claimed it without the
    annotation.

    So the marker is the same ✔ the index uses, on the name, and the words that
    used to carry it stay as the note they always were. That is 251's rule — one
    glyph, one predicate — applied to the place 251 did not look.
    """
    marks: dict[str, bool] = {}
    for m in CATALOG_HEADING_RE.finditer(CATALOG.read_text()):
        for name, tick in CATALOG_HEADING_NAME_RE.findall(m.group(1)):
            marks[name] = bool(tick.strip())
    return marks


# 🆕 276 — THE ⚠️ IS THE ATOM AND THE ✅ IS PROSE, WHICH IS THE ONLY READING OF THIS
# COLUMN THAT SURVIVES ITS OWN CONTENTS. One heading already carries BOTH —
# `### `gd_document_highlight` ✅ on Godot 4.7 · ⚠️ advertised `false` on Godot 4.3
# (handled)` — so a rule that made ✅ the predicate would have to decide which of the
# two glyphs wins, and any answer to that is a convention nobody can look up. The ⚠️
# is present or it is not, it is one predicate, and it is the one a reader is about to
# act on: *can this tool answer "unsupported" instead of a result?*
def catalog_index_status() -> dict[str, bool]:
    """Tool name -> whether its `Status` CELL warns the connected build may not support it."""
    return {m.group(1): "⚠️" in m.group(3) for m in CATALOG_ROW_RE.finditer(CATALOG.read_text())}


def catalog_heading_status() -> dict[str, bool]:
    """Tool name -> whether its section HEADING carries the same ⚠️.

    🆕 276 — 252's SECOND COPY, FOR THE SECOND PREDICATE. The Tool Index is a table
    you scan and the heading is where a reader lands, and this glyph is written in
    both places by hand. That the two AGREED on all 292 rows at 276 is not evidence
    they were right: one hand wrote both at the same time, and both were wrong about
    the same ten tools.
    """
    marks: dict[str, bool] = {}
    for m in CATALOG_HEADING_RE.finditer(CATALOG.read_text()):
        warned = "⚠️" in m.group(2)
        for name, _tick in CATALOG_HEADING_NAME_RE.findall(m.group(1)):
            marks[name] = warned
    return marks


# The house shape of a graceful-degradation answer, in the four spellings the tree
# actually uses. The message ALWAYS names its own tool first — that is what makes
# this readable at all, and check 4e asserts it stays true rather than assuming it.
DEGRADE_PHRASE = "is unsupported by the connected"
DEGRADE_ANY_RE = re.compile(re.escape(DEGRADE_PHRASE))
DEGRADE_LITERAL_RE = re.compile(r'"([a-z0-9_]+) ' + re.escape(DEGRADE_PHRASE))
DEGRADE_TEMPLATE_RE = re.compile(r'`\$\{(\w+)\} ' + re.escape(DEGRADE_PHRASE))
DEGRADE_FUNC_RE = re.compile(r"^function\s+(\w+)\s*\(", re.M)


def degrading_tools() -> "tuple[set[str], int, list[str]]":
    """Tools that can answer "<tool> is unsupported by the connected …", the number of
    message sites, and any site the walk could not attribute to a tool name.

    🆕 276 — THE COLUMN'S COUNTERPART, AND IT IS NOT ONE FUNCTION. 275 §7 measured this
    join against `unsupportedLsp` BY NAME and reported four disagreeing rows. The
    predicate has FOUR spellings in this tree — a generic helper on the GDScript LSP
    plane, a second generic helper on the C# one, two zero-argument helpers that name
    their tool in the literal, and six inline returns on the two debug-adapter planes —
    so a join named after one function was a claim about that function wearing the shape
    of a claim about the thing it does. Ten rows were wrong, not four.

    The atom is the MESSAGE, which every spelling shares, and the tool name is whatever
    precedes it: a literal name, or `${param}` of an enclosing helper, resolved through
    that helper's call sites. `unattributed` is the third return for
    `uncaptured_tool_registrations`'s reason — a site this walk cannot read is not
    under-reported, it is ABSENT, and absent is byte-identical to a healthy tree.
    """
    texts = {p: p.read_text(encoding="utf-8") for p in sorted(TOOLS.glob("*.ts"))}
    named: set[str] = set()
    helpers: dict[str, tuple[str, int]] = {}
    sites = 0
    for path, text in texts.items():
        sites += len(DEGRADE_ANY_RE.findall(text))
        named |= {m.group(1) for m in DEGRADE_LITERAL_RE.finditer(text)}
        for m in DEGRADE_TEMPLATE_RE.finditer(text):
            enclosing = [f.group(1) for f in DEGRADE_FUNC_RE.finditer(text, 0, m.start())]
            if enclosing:
                helpers[enclosing[-1]] = (path.name, text.count("\n", 0, m.start()) + 1)
    for helper in helpers:
        call = re.compile(r"\b" + re.escape(helper) + r'\(\s*"([a-z0-9_]+)"')
        for text in texts.values():
            named |= {m.group(1) for m in call.finditer(text)}
    unattributed = sorted(
        f"{where[0]}:{where[1]} `{helper}` — a templated degradation message with no "
        f"call site passing a literal tool name"
        for helper, where in helpers.items()
        if not any(re.search(r"\b" + re.escape(helper) + r'\(\s*"[a-z0-9_]+"', t) for t in texts.values())
    )
    literal_sites = sum(len(DEGRADE_LITERAL_RE.findall(t)) for t in texts.values())
    template_sites = sum(len(DEGRADE_TEMPLATE_RE.findall(t)) for t in texts.values())
    if literal_sites + template_sites != sites:
        unattributed.append(
            f"{sites - literal_sites - template_sites} degradation message(s) named by "
            f"neither a literal tool name nor a `${{param}}` this walk can resolve"
        )
    return named, sites, unattributed


def catalog_json_blocks() -> list[str]:
    text = CATALOG.read_text()
    return re.findall(r"```json\n(.*?)```", text, re.S)


# --- shape helpers: brace-matching + top-level key extraction ---------------
def _match_braces(text: str, open_idx: int) -> int:
    """Index just past the '}' matching the '{'/'['/'(' at `open_idx`.
    Tracks nesting and skips string literals so brackets inside strings/args
    don't confuse the depth count."""
    depth, i, n = 0, open_idx, len(text)
    while i < n:
        c = text[i]
        if c in "\"'":
            q = c
            i += 1
            while i < n and text[i] != q:
                if text[i] == "\\":
                    i += 1
                i += 1
        elif c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def _strip_comments(body: str) -> str:
    """Remove `//` line and `/* */` block comments, respecting string and
    backtick literals, so commented-out text inside an object literal can't be
    misread as a key or spread. Line comments keep their trailing newline;
    block comments collapse to a single space (so neighbouring tokens don't
    fuse)."""
    out: list[str] = []
    i, n = 0, len(body)
    while i < n:
        c = body[i]
        if c in "\"'`":
            q = c
            out.append(c)
            i += 1
            while i < n and body[i] != q:
                if body[i] == "\\" and i + 1 < n:
                    out.append(body[i])
                    out.append(body[i + 1])
                    i += 2
                    continue
                out.append(body[i])
                i += 1
            if i < n:
                out.append(body[i])  # closing quote
                i += 1
            continue
        if c == "/" and i + 1 < n and body[i + 1] == "/":
            i += 2
            while i < n and body[i] != "\n":
                i += 1
            continue  # leave the newline for the next iteration
        if c == "/" and i + 1 < n and body[i + 1] == "*":
            i += 2
            while i + 1 < n and not (body[i] == "*" and body[i + 1] == "/"):
                i += 1
            i += 2  # skip the closing */
            out.append(" ")
            continue
        out.append(c)
        i += 1
    return "".join(out)


def _top_level_keys(body: str) -> set[str]:
    """`identifier:` keys at depth 0 of an object-literal body (between braces)."""
    body = _strip_comments(body)
    keys: set[str] = set()
    depth, i, n, tok = 0, 0, len(body), ""
    while i < n:
        c = body[i]
        if c in "\"'":
            q = c
            i += 1
            while i < n and body[i] != q:
                if body[i] == "\\":
                    i += 1
                i += 1
            i += 1
            continue
        if c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
        elif depth == 0 and c == ":":
            km = re.search(r"([A-Za-z_][A-Za-z0-9_]*)\s*$", tok)
            if km:
                keys.add(km.group(1))
            tok = ""
            i += 1
            continue
        elif depth == 0 and c == ",":
            tok = ""
            i += 1
            continue
        tok += c
        i += 1
    return keys


def _top_level_spreads(body: str) -> set[str]:
    """`...ident` object-spread names at depth 0 of an object-literal body."""
    body = _strip_comments(body)
    spreads: set[str] = set()
    depth, i, n = 0, 0, len(body)
    while i < n:
        c = body[i]
        if c in "\"'":
            q = c
            i += 1
            while i < n and body[i] != q:
                if body[i] == "\\":
                    i += 1
                i += 1
            i += 1
            continue
        if c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
        elif depth == 0 and body[i : i + 3] == "...":
            sm = re.match(r"\.\.\.([A-Za-z_][A-Za-z0-9_]*)", body[i:])
            if sm:
                spreads.add(sm.group(1))
        i += 1
    return spreads


def _file_const_shapes(text: str) -> dict[str, set[str]]:
    """`const NAME[: type] = { ... }` object literals in one file -> their
    top-level keys. Resolves `inputSchema: sharedSchema` refs / `{ ...sharedSchema }`
    and the shared `outputSchemas` envelopes (e.g. `const netcodeScaffold: z.ZodRawShape = {…}`).
    Only bare `= {` object literals are captured; `= z.object({…})` is skipped
    (its shape lives inside the call, not at the tool-entry level)."""
    out: dict[str, set[str]] = {}
    for m in re.finditer(r"const\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^=\n]+)?=\s*\{", text):
        brace = text.index("{", m.end() - 1)
        out[m.group(1)] = _top_level_keys(text[brace + 1 : _match_braces(text, brace) - 1])
    return out


def input_schema_shapes() -> dict[str, set[str]]:
    """tool name -> set of inputSchema param names (shared-schema refs and
    `{...spread}` resolved; `confirm` excluded). Each tool's inputSchema is
    bounded to its own registerTool/registerTaskTool call to avoid bleeding
    into the next tool's schema."""
    shapes: dict[str, set[str]] = {}
    for f in sorted(TOOLS.rglob("*.ts")):
        text = f.read_text()
        consts = _file_const_shapes(text)
        regs = list(re.finditer(r'register(?:Task)?Tool\(\s*(?:\w+\s*,\s*)?"([a-z0-9_]+)"', text))
        for idx, m in enumerate(regs):
            name = m.group(1)
            end = regs[idx + 1].start() if idx + 1 < len(regs) else len(text)
            window = text[m.end() : end]
            im = re.search(r"inputSchema:\s*", window)
            if not im:
                continue
            rest = window[im.end() :]
            keys: set[str] = set()
            if rest[:1] == "{":
                body = rest[1 : _match_braces(rest, 0) - 1]
                keys |= _top_level_keys(body)
                for sp in _top_level_spreads(body):
                    keys |= consts.get(sp, set())
            else:
                idm = re.match(r"([A-Za-z_][A-Za-z0-9_]*)", rest)
                if idm:
                    keys |= consts.get(idm.group(1), set())
            shapes[name] = keys - IGNORED_PARAMS
    return shapes


def output_schema_shapes() -> dict[str, set[str]]:
    """tool name -> set of field names it pins in schemas.ts `outputSchemas`.

    Handles both entry forms the file uses: inline `tool: { …fields… }` and the
    shared-envelope refs spread via IIFEs — `...(() => { const env = {…}; return
    { tool_a: env, tool_b: env }; })()`. A tool's ZodRawShape value is always
    either a `{` object literal or a bare shared-const identifier (never `z.x`),
    so scanning the region for those two entry forms is unambiguous."""
    text = SCHEMAS.read_text()
    m = re.search(r"export const outputSchemas[^=]*=\s*\{", text)
    if not m:
        return {}
    start = text.index("{", m.end() - 1)
    region = text[start : _match_braces(text, start)]
    consts = _file_const_shapes(text)
    shapes: dict[str, set[str]] = {}
    # inline entries: `tool: { … }`
    for em in re.finditer(r"(?m)^\s+([a-z_][a-z0-9_]*)\s*:\s*\{", region):
        brace = em.end() - 1
        shapes[em.group(1)] = _top_level_keys(region[brace + 1 : _match_braces(region, brace) - 1])
    # shared-envelope refs: `tool: envelopeConst,`
    for em in re.finditer(r"(?m)^\s+([a-z_][a-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*,", region):
        if em.group(2) in consts:
            shapes[em.group(1)] = consts[em.group(2)]
    return shapes


def _props_from_json(raw: str) -> "set[str] | None":
    """Property NAMES from a JSON Schema blob, or None if it is not one.

    Returns an empty set for a schema that genuinely declares no properties
    (`dbg_continue` takes no params) — callers must test `is not None`, never
    truthiness, or a no-param tool reads as undocumented.
    """
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict):
        return None
    # A schema may name its root through $ref into $defs rather than inlining it
    # (scene_get_tree's recursive SceneNode), putting properties one hop away.
    ref = obj.get("$ref")
    if isinstance(ref, str) and "properties" not in obj:
        m = re.match(r"#/\$defs/([A-Za-z0-9_]+)$", ref)
        defs = obj.get("$defs")
        if m and isinstance(defs, dict) and isinstance(defs.get(m.group(1)), dict):
            obj = defs[m.group(1)]
    props = obj.get("properties")
    return set(props.keys()) if isinstance(props, dict) else None


def _props_from_brace_list(raw: str) -> set[str]:
    """Field names from the catalog's OTHER shape convention: a backticked
    brace list — `{ ok, checked, failures[] }`, `{ path, line, character }`,
    `{ "changed_files": [string], "applied": boolean }`. Splits at depth 0 so a
    nested `[{ ... }]` does not leak its inner field names into the result."""
    inner = raw.strip()[1:-1]
    fields, depth, cur = [], 0, ""
    for ch in inner:
        if ch in "[{(":
            depth += 1
        elif ch in "]})":
            depth -= 1
        if ch == "," and depth == 0:
            fields.append(cur)
            cur = ""
        else:
            cur += ch
    fields.append(cur)
    names = set()
    for f in fields:
        f = f.strip().split(":")[0].strip().strip('"').strip()
        f = f.rstrip("?").replace("[]", "").strip().rstrip("?")
        if re.fullmatch(r"[a-z_][a-z0-9_]*", f):
            names.add(f)
    return names


def _shared_envelopes(text: str) -> dict[str, set[str]]:
    """The catalog documents three tool families by defining one result envelope
    and referring back to it, rather than repeating the schema per tool. Parse
    each definition once so the referring tools resolve to a REAL shape instead
    of being exempted — a family whose envelope drifts must still fail."""
    found: dict[str, set[str]] = {}
    for phrase, pattern in ENVELOPE_DEFS.items():
        m = re.search(pattern, text, re.S)
        if not m:
            errors.append(
                f"Catalog no longer defines the shared '{phrase}' in a fenced json "
                f"block, so every tool referring to it would silently lose its "
                f"documented output shape. Restore the definition or update "
                f"ENVELOPE_DEFS."
            )
            continue
        props = _props_from_json(m.group(1))
        if props is None:
            errors.append(f"Shared '{phrase}' definition is not a JSON Schema object.")
            continue
        found[phrase] = props
    return found


def _extra_fields(line: str, known_tools: set[str]) -> set[str]:
    """Backticked fields a referring tool adds on top of what it inherits —
    'plus `function`, `annotation`', 'each with an added `uri`'.

    Tool names are excluded. The clause often keeps explaining after naming the
    extra field ("plus an optional `peer` string (a peer id from
    `runtime_spawn_peers`; ...)"), and a backticked TOOL there is a pointer for
    the reader, not a param — without this, `runtime_spawn_peers` was read as a
    param of `runtime_get_property` and the gate failed on its own parse.
    """
    m = re.search(r"\b(?:plus|added)\b(.*)$", line)
    if not m:
        return set()
    return set(re.findall(r"`([a-z_][a-z0-9_]*)`", m.group(1))) - known_tools


def _reference_targets(line: str) -> list[str]:
    """Every tool named as the source of a referred-to shape. A line may name
    more than one — 'identical to `node_get_property` / `node_set_property`'
    documents a getter/setter PAIR in one sentence."""
    m = re.search(
        r"(?:same as|identical to|shape as|payload as|as)\s+"
        r"(`[a-z0-9_]+`(?:\s*/\s*`[a-z0-9_]+`)*)", line
    )
    return re.findall(r"`([a-z0-9_]+)`", m.group(1)) if m else []


def _best_reference(name: str, targets: list[str]) -> str:
    """Pick which of a reference line's targets THIS tool inherits from, by
    longest shared trailing name segment. `runtime_set_property` must take
    `node_set_property` and not `node_get_property`, which sit in the same
    sentence and differ by exactly the `value` param — taking the first match
    made the gate report a real-looking drift that was purely its own choice."""
    def overlap(target: str) -> int:
        n = 0
        for a, b in zip(reversed(name), reversed(target)):
            if a != b:
                break
            n += 1
        return n
    return max(targets, key=overlap)


def catalog_shapes(known_tools: set[str]) -> "tuple[dict[str, set[str]], dict[str, set[str]], dict[str, str]]":
    """Per-tool documented Input/Output property names, plus how each was found.

    The catalog states a shape in one of four ways and ALL FOUR are read here,
    because a shape the parser cannot read is indistinguishable from a shape
    that was deleted — which is exactly the hole check 16 closes:
      1. a fenced ```json block             (the majority)
      2. a backticked JSON object inline    (`dbg_step`)
      3. a backticked brace list            (the `runtime_*` assert family)
      4. a reference to another tool or to a shared family envelope
    `confirm` is excluded from inputs.
    """
    text = CATALOG.read_text()
    envelopes = _shared_envelopes(text)

    # Split on the heading, keeping EVERY backticked name in it: the catalog
    # documents some pairs under one combined heading (`dbg_continue` /
    # `dbg_step`), and taking only the first name hid the second one entirely.
    heads = list(re.finditer(r"^###\s+(`[a-z0-9_]+`(?:\s*/\s*`[a-z0-9_]+`)*)", text, re.M))
    shapes: dict[tuple[str, str], set[str]] = {}
    pending: dict[tuple[str, str], str] = {}
    origin: dict[str, str] = {}

    for i, head in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        names = re.findall(r"`([a-z0-9_]+)`", head.group(1))
        body = text[head.end():end]
        for name in names:
            for label, tag in (("Input", "in"), ("Output", "out")):
                block = None
                if len(names) > 1:
                    # Combined heading: prefer the per-name block if there is one.
                    m = re.search(
                        rf"- \*\*{label} \(`{re.escape(name)}`\)\*\*[^\n]*(?:\n```json\n.*?```)?",
                        body, re.S,
                    )
                    block = m.group(0) if m else None
                if block is None:
                    m = re.search(rf"^- \*\*{label}\*\*[^\n]*(?:\n```json\n.*?```)?",
                                  body, re.M | re.S)
                    block = m.group(0) if m else None
                if block is None:
                    continue
                key = (name, tag)
                fenced = re.search(r"```json\n(.*?)```", block, re.S)
                if fenced:
                    props = _props_from_json(fenced.group(1))
                    if props is not None:
                        shapes[key], origin[f"{name}.{tag}"] = props, "fenced"
                        continue
                inline = re.search(r"`(\{.*?\})`", block, re.S)
                if inline:
                    props = _props_from_json(inline.group(1))
                    kind = "inline-json"
                    if props is None:
                        props, kind = _props_from_brace_list(inline.group(1)), "brace-list"
                    if props is not None:
                        shapes[key], origin[f"{name}.{tag}"] = props, kind
                        continue
                pending[key] = " ".join(block.split())

    # Resolve references. Iterated so a reference to a referring tool still
    # lands (cs_references -> cs_definition -> gd_definition); bounded so a
    # circular reference stops rather than spins, and is reported by check 16
    # as an uncovered tool rather than silently dropped.
    for _ in range(len(ENVELOPE_DEFS) + 4):
        if not pending:
            break
        progressed = False
        for key in list(pending):
            name, tag = key
            line = pending[key]
            resolved, how = None, ""
            for phrase, props in envelopes.items():
                if phrase in line:
                    resolved = set(props) | _extra_fields(line, known_tools)
                    how = "envelope"
                    break
            if resolved is None:
                targets = [t for t in _reference_targets(line) if (t, tag) in shapes]
                if targets:
                    src = _best_reference(name, targets)
                    resolved = set(shapes[(src, tag)]) | _extra_fields(line, known_tools)
                    how = f"xref:{src}"
            if resolved is not None:
                shapes[key], origin[f"{name}.{tag}"] = resolved, how
                del pending[key]
                progressed = True
        if not progressed:
            break

    inputs = {n: props for (n, tag), props in shapes.items() if tag == "in"}
    outputs = {n: props for (n, tag), props in shapes.items() if tag == "out"}
    for name in inputs:
        inputs[name] = inputs[name] - IGNORED_PARAMS
    return inputs, outputs, origin


# --- 1 & 2: GDScript dispatch <-> host calls -------------------------------
editor_methods = dispatch_methods(ADDON / "operations.gd", ["dispatch"])
runtime_methods = dispatch_methods(ADDON / "runtime_bridge.gd", ["_dispatch"])
gd_all = editor_methods | runtime_methods
host_calls = host_bridge_calls(BRIDGE_CALL_SCAN)

# Roster completeness: any module that speaks either wire shape must be filed —
# scanned, or exempt with a reason. Otherwise a bridge call to a nonexistent
# GDScript handler ships from an unscanned module and fails at runtime instead
# of at the gate, with the "Host bridge calls" count reading exactly as before.
_bridge_shaped = re.compile(r'\bcall\(\s*"[a-z_][a-z0-9_.]*"|\.request\(\s*"[a-z_][a-z0-9_.]*"')
unfiled_bridge_modules = sorted(
    str(f.relative_to(ROOT))
    for f in TOOLS.rglob("*.ts")
    if f not in set(BRIDGE_CALL_SCAN)
    and f not in BRIDGE_SCAN_EXEMPT
    and _bridge_shaped.search(f.read_text())
)
if unfiled_bridge_modules:
    errors.append(
        f"Module(s) issue bridge-shaped calls but are on neither BRIDGE_CALL_SCAN "
        f"nor BRIDGE_SCAN_EXEMPT, so check 1 never sees them: "
        f"{unfiled_bridge_modules}. Add to the scan list, or exempt with the "
        f"reason it is not the Godot bridge (as dap.ts/csdap.ts are for DAP)."
    )

missing_in_gd = sorted(c for c in host_calls if c not in gd_all)
if missing_in_gd:
    errors.append(f"Host calls bridge methods with no GDScript handler: {missing_in_gd}")

orphans = sorted(m for m in gd_all if m not in host_calls and m != "ping")
if orphans:
    warnings.append(f"GDScript dispatch methods never called by host (ok if intentional): {orphans}")

_ran("1&2")

# --- 3: tool-name uniqueness + net completeness ----------------------------
tools = registered_tools()
dupes = sorted({t for t in tools if tools.count(t) > 1})
if dupes:
    errors.append(f"Duplicate registerTool names: {dupes}")

# A name the net misses is invisible to checks 3, 4, 6 and 11 at once, and the
# gate's output is byte-identical to a clean run. Assert the net saw every site
# rather than trusting the count it produced.
uncaptured, registration_sites_scanned = uncaptured_tool_registrations()
if uncaptured:
    errors.append(
        "Tool registration(s) whose name the scanner cannot match "
        f"(invisible to the catalog, annotation and count checks): {uncaptured}"
    )

_ran("3")

# --- 4: catalog <-> code ----------------------------------------------------
tool_set = set(tools)
cat_tools = catalog_index_tools()
# Managed-process/editor/etc. tools should all be in the catalog index.
not_in_catalog = sorted(tool_set - cat_tools)
if not_in_catalog:
    errors.append(f"Registered tools missing from catalog index: {not_in_catalog}")
in_catalog_not_code = sorted(cat_tools - tool_set)
if in_catalog_not_code:
    warnings.append(f"Catalog lists tools not found in code (may be planned/renamed): {in_catalog_not_code}")

# --- 4b: the Destructive COLUMN, against the annotation a client consumes -----
# 🔴 THE COLUMN AND THE ANNOTATION ARE TWO PREDICATES WEARING ONE WORD, AND UNTIL
# 251 NOTHING HAD EVER PUT THEM SIDE BY SIDE. `destructiveHint` has a definition in
# `annotations.ts` — *may overwrite or discard state the caller did not supply* —
# and it crosses the wire, where a client uses it to decide whether to ask the
# human first. The catalog's cell was free prose meaning roughly "writes
# something": 57 rows said `undoable`, 36 `✔ writes file`, 3 `runs code`. The two
# disagreed on 21 of 292 rows in both directions, including `anim_remove_key` and
# `godot_stop` reading `–` — flatly wrong under either predicate.
#
# So the ✔ is now the ANNOTATION and the prose stays beside it as the note it
# always was. Exactly one of the two facts in that cell is machine-owned, and the
# other is free to say what a `–` never could.
#
# 🔴 THIS READER NEEDS NO FLOOR OF ITS OWN, AND THAT IS A PROPERTY OF THE SHARED
# REGEX, NOT AN OVERSIGHT. `CATALOG_ROW_RE` yields the name and the cell from one
# match, so the two cannot collapse independently: a table shape this pattern
# stops matching empties `cat_tools`, and the check above then names every
# registered tool as missing from the index. A cell that reads empty for
# every row empties `marked`, and every destructive tool is reported UNMARKED
# below. Both collapses are already loud, in a check that already exists — which
# is the only reason a new `*_FLOOR` would have been the wrong answer here.
ann_names = _annotation_names(ANNOTATIONS.read_text())
code_destructive = ann_names("DESTRUCTIVE") & tool_set
marked_destructive = {n for n, cell in catalog_index_rows().items() if "✔" in cell} & tool_set
undermarked = sorted(code_destructive - marked_destructive)
overmarked = sorted(marked_destructive - code_destructive)
if undermarked:
    errors.append(
        f"Catalog Tool Index does not mark these `destructiveHint: true` tools with ✔ "
        f"(a reader is told they are safe and the wire says otherwise): {undermarked}"
    )
if overmarked:
    errors.append(
        f"Catalog Tool Index marks these ✔ and `annotations.ts` does not list them as "
        f"DESTRUCTIVE (the doc is stricter than the contract): {overmarked}"
    )

# --- 4c: the same predicate again, in the SECTION HEADING ---------------------
# 🔴 251 ASKED THE INDEX WHAT IT DID NOT COMPARE AND FOUND THREE COLUMNS. ASKING
# THE SAME QUESTION OF THE FILE FINDS A FOURTH COPY OF THE PREDICATE, AND IT WAS
# THE COPY A HUMAN READS. The Tool Index is a table you scan; the section heading
# is where a reader lands when they want to know what one tool does, and it said
# nothing about destruction for 35 tools that carry `destructiveHint: true` —
# `tilemap_clear`, `godot_stop`, `vcs_restore`, `vcs_stash`, every `asset_gen_*`
# — while claiming it for 9 that do not.
#
# 🔴 THE COVERAGE ASSERTION BELOW IS THIS READER'S FLOOR, AND IT IS NOT OPTIONAL
# HERE THE WAY IT WAS FOR 4b. 4b comes off the same match as `cat_tools`, so its
# collapse is already loud in check 4. This reader has its own regex over its own
# lines, so a heading shape it stops matching would empty `heading_marks`, report
# every destructive tool as unmarked — loud — but report NOTHING in the other
# direction, and a half-loud reader is a reader that can rot in one direction.
# `undocumented` names every registered tool at once when the parse dies.
heading_marks = catalog_heading_rows()
undocumented = sorted(tool_set - set(heading_marks))
if undocumented:
    errors.append(
        f"Registered tools with no `### ` section in the catalog (or a heading shape "
        f"CATALOG_HEADING_RE no longer reads): {undocumented}"
    )
heading_destructive = {n for n, marked in heading_marks.items() if marked} & tool_set
head_under = sorted(code_destructive - heading_destructive - set(undocumented))
head_over = sorted(heading_destructive - code_destructive)
if head_under:
    errors.append(
        f"Catalog section headings do not mark these `destructiveHint: true` tools with ✔ "
        f"(the page a reader lands on says nothing about it): {head_under}"
    )
if head_over:
    errors.append(
        f"Catalog section headings mark these ✔ and `annotations.ts` does not list them as "
        f"DESTRUCTIVE: {head_over}"
    )
# The index and the headings are two hand-maintained copies of one machine-owned
# fact. Both are compared to the wire above, so this can only fire if one of the
# two readers is misreading its own file — which is the failure that would
# otherwise look like agreement.
disagree = sorted(marked_destructive ^ heading_destructive)
if disagree:
    errors.append(
        f"The catalog's Tool Index and its section headings disagree about which tools "
        f"are destructive: {disagree}"
    )

# --- 4d: the Plane COLUMN, against the toolset a tool is actually registered in
# 🔴 251 GATED ONE COLUMN OF FOUR AND SAID SO. This is the second, and it is the
# column that answers a question the reader is about to ACT on: `Plane` is what a
# human reads before typing `BREAKPOINT_TOOLSETS=`, and until this session the
# string it showed them was not the string the server parses. `toolset_sizes()`
# verified the groups by CARDINALITY — `c` -> 27, `a,b` -> 155 — so a tool moving
# from `editor` to `runtime` alongside a new `editor` tool left every count in
# this tree green and every `Plane` cell stale. Cardinality is not membership.
#
# 🔴 AND THE JOIN IS TWO WALKS TO THE SAME FILES, WHICH IS WHY IT ASSERTS MORE
# THAN THE COLUMN. `registered_tools()` walks `tools/**`; `toolset_members()`
# walks the imports out of `toolsets.ts`. Equal sets mean every registered tool is
# reachable through some group AND no group claims a tool that is not registered.
# A `tools/*.ts` module nobody imports would ship a tool the catalog documents,
# the annotations cover, and no `BREAKPOINT_TOOLSETS` selection can ever load.
members = toolset_members()
toolset_of = {n: tid for tid, names in members.items() for n in names}
unreachable = sorted(tool_set - set(toolset_of))
if unreachable:
    errors.append(
        f"Registered tools in no toolset (registered under host/src/tools but not reachable "
        f"from any group in toolsets.ts, so no BREAKPOINT_TOOLSETS selection loads them): "
        f"{unreachable}"
    )
claimed_not_registered = sorted(set(toolset_of) - tool_set)
if claimed_not_registered:
    errors.append(
        f"toolsets.ts groups claim tools the registration walk does not see: {claimed_not_registered}"
    )
multi = sorted({n for tid, names in members.items() for n in names if toolset_of[n] != tid})
if multi:
    errors.append(
        f"Tools registered by more than one toolset — the partition is not a partition, and "
        f"`Plane` cannot name one group for them: {multi}"
    )

plane_atoms = catalog_index_planes()
no_atom = sorted(n for n in tool_set if n in plane_atoms and not plane_atoms[n])
if no_atom:
    errors.append(
        f"Catalog Tool Index rows whose `Plane` cell carries no backticked toolset id "
        f"(the group letter is prose and names nothing a reader can type): {no_atom}"
    )
unknown_atom = sorted(
    f"{n} says `{plane_atoms[n]}`" for n in tool_set
    if plane_atoms.get(n) and plane_atoms[n] not in members
)
if unknown_atom:
    errors.append(
        f"Catalog `Plane` cells naming a toolset id that toolsets.ts does not define: "
        f"{unknown_atom}"
    )
plane_drift = sorted(
    f"{n}: catalog says `{plane_atoms[n]}`, toolsets.ts registers it in `{toolset_of[n]}`"
    for n in tool_set
    if plane_atoms.get(n) and plane_atoms[n] in members and n in toolset_of
    and plane_atoms[n] != toolset_of[n]
)
if plane_drift:
    errors.append(f"Catalog `Plane` column disagrees with the toolset registry: {plane_drift}")

# --- 4e: the Status COLUMN, against the answer the tool can actually give ------
# 🔴 THE LAST OF 251's FOUR, AND THE ONLY ONE WHOSE COLUMN HAD NO STATED PREDICATE.
# `Plane` and `Destructive` each carry a "Reading the … column" paragraph naming the
# file they are derived from. `Status` carried a glyph and nothing else — no rule, no
# counterpart, nothing to disagree WITH — which is how ten of 292 rows came to say ✅
# about a tool that answers "unsupported by the connected …" instead of a result, with
# the whole suite green for the twenty-four sessions since the column was written.
#
# 🔴 AND THE SHARPEST ROW IS ONE THE DOCUMENT ITSELF CONTRADICTS. `dbg_goto`'s own
# section says, in prose, that *no Godot build advertises `supportsGotoTargetsRequest`,
# so the capability check returns first* — the tool cannot run on any shipped engine —
# and the column a reader scans before choosing it said ✅. The two sentences are four
# hundred lines apart and nothing had ever put them side by side.
#
# 🔴 THE ATTRIBUTION LINE IS THE READER'S OWN NET, AND IT IS NOT OPTIONAL. A
# degradation message this walk cannot attribute to a tool name is not reported small,
# it is reported ABSENT — which is indistinguishable from a plane that degrades
# nowhere. Same failure `uncaptured_tool_registrations` was given a second return for.
degrade, degrade_sites, degrade_unattributed = degrading_tools()
if degrade_unattributed:
    errors.append(
        f"Graceful-degradation message(s) whose tool this walk cannot name (invisible to "
        f"the catalog Status join): {degrade_unattributed}"
    )
degrade_orphan = sorted(degrade - tool_set)
if degrade_orphan:
    errors.append(
        f"Graceful-degradation messages naming tools that are not registered: {degrade_orphan}"
    )
degrade &= tool_set
status_caveated = {n for n, warned in catalog_index_status().items() if warned} & tool_set
heading_status = catalog_heading_status()
heading_caveated = {n for n, warned in heading_status.items() if warned} & tool_set
status_under = sorted(degrade - status_caveated)
status_over = sorted(status_caveated - degrade)
if status_under:
    errors.append(
        f"Catalog Tool Index `Status` says these tools are fine and the code can answer "
        f"'{DEGRADE_PHRASE} …' for them (a reader is told it works): {status_under}"
    )
if status_over:
    errors.append(
        f"Catalog Tool Index `Status` warns ⚠️ about tools with no graceful-degradation "
        f"path in the code (the doc is stricter than the tool): {status_over}"
    )
head_status_under = sorted(set(degrade) - heading_caveated - set(undocumented))
head_status_over = sorted(heading_caveated - degrade)
if head_status_under:
    errors.append(
        f"Catalog section headings carry no ⚠️ for tools the code can answer "
        f"'{DEGRADE_PHRASE} …' for: {head_status_under}"
    )
if head_status_over:
    errors.append(
        f"Catalog section headings carry ⚠️ for tools with no graceful-degradation path "
        f"in the code: {head_status_over}"
    )
# 252's cross-check, for the second predicate. Both sides are compared to the code
# above, so this can only fire when one of the two READERS is misreading its own file —
# the failure that would otherwise look like two documents agreeing.
status_disagree = sorted(status_caveated ^ heading_caveated)
if status_disagree:
    errors.append(
        f"The catalog's Tool Index and its section headings disagree about which tools "
        f"the connected build may not support: {status_disagree}"
    )

_ran("4")

# --- 5: JSON lint -----------------------------------------------------------
bad_json = 0
for i, block in enumerate(catalog_json_blocks()):
    try:
        json.loads(block)
    except json.JSONDecodeError as e:
        bad_json += 1
        errors.append(f"Invalid JSON block #{i+1} in catalog: {e}")

_ran("5")

# --- 6: input SHAPE parity (inputSchema params <-> catalog Input) -----------
code_inputs = input_schema_shapes()
cat_inputs, cat_outputs, shape_origin = catalog_shapes(tool_set)
input_comparable = sorted(set(code_inputs) & set(cat_inputs))
for name in input_comparable:
    code_only = sorted(code_inputs[name] - cat_inputs[name])
    doc_only = sorted(cat_inputs[name] - code_inputs[name])
    if code_only or doc_only:
        errors.append(
            f"Input shape drift for `{name}`: params in code not documented={code_only}, "
            f"documented but not in code={doc_only}"
        )

_ran("6")

# --- 7: output/return SHAPE parity (schemas.ts <-> catalog Output) ----------
code_outputs = output_schema_shapes()
output_comparable = sorted(set(code_outputs) & set(cat_outputs))
for name in output_comparable:
    # schemas.ts pins the REQUIRED envelope (z.object is non-strict), so the
    # catalog may document additional fields; every pinned field must be there.
    undocumented = sorted(code_outputs[name] - cat_outputs[name])
    if undocumented:
        errors.append(
            f"Output shape drift for `{name}`: fields pinned in schemas.ts but "
            f"absent from the catalog Output block={undocumented}"
        )

_ran("7")

# --- 16: shape-parity COVERAGE floor ---------------------------------------
# Checks 6 and 7 compare set INTERSECTIONS. An intersection has no floor: a tool
# the parser cannot find on the catalog side simply drops out, with no error and
# no count anyone asserts. So the checks could be driven to zero comparisons and
# still report PASSED — one find-and-replace of `"properties"` -> `"props"` took
# both to `0 checked` while the JSON linter still read `514 (0 invalid)`. A
# release in which every documented shape was wrong passed green.
#
# The floor is set equality, both directions, against the registered surface:
# every tool must be COMPARED, or exempt with a stated reason. "Documented by
# cross-reference" and "documentation deleted" are then no longer the same
# observable. Both directions matter — a stale exemption for a deleted tool has
# to fail too, or the roster rots into a list of names nobody can justify.
shape_cov_errors = []
for label, comparable, universe, universe_desc in (
    ("Input", set(input_comparable), set(code_inputs), "tools with a parsed inputSchema"),
    ("Output", set(output_comparable), set(code_outputs), "tools with an outputSchema"),
):
    exempt = set(SHAPE_COVERAGE_EXEMPT) & universe
    uncovered = sorted(universe - comparable - exempt)
    if uncovered:
        shape_cov_errors.append(
            f"{label} shape parity covers {len(comparable)} of {len(universe)} "
            f"{universe_desc}; these are neither compared nor exempt, so a wrong "
            f"or deleted {label} block for them cannot fail the gate: {uncovered}. "
            f"Document the shape in the catalog (a fenced block, an inline "
            f"backticked shape, or a reference to another tool / a shared "
            f"envelope), or add the tool to SHAPE_COVERAGE_EXEMPT with a reason."
        )
    stale = sorted(n for n in SHAPE_COVERAGE_EXEMPT if n in comparable)
    if stale:
        shape_cov_errors.append(
            f"{label}: SHAPE_COVERAGE_EXEMPT names tool(s) that ARE now compared, "
            f"so the exemption is buying silence it no longer needs: {stale}. "
            f"Remove them from the roster."
        )
errors.extend(shape_cov_errors)
unknown_exempt = sorted(set(SHAPE_COVERAGE_EXEMPT) - tool_set)
if unknown_exempt:
    errors.append(
        f"SHAPE_COVERAGE_EXEMPT names tool(s) that are not registered at all: "
        f"{unknown_exempt}. A stale exemption hides the next tool that takes the "
        f"same name."
    )

_ran("16")

# --- 8: outputSchemas hygiene (no schema for a non-existent tool) -----------
stale_schemas = sorted(set(code_outputs) - tool_set)
if stale_schemas:
    errors.append(f"schemas.ts outputSchemas names non-existent tools: {stale_schemas}")
missing_output_schema = sorted(tool_set - set(code_outputs) - NO_OUTPUT_SCHEMA_OK)
if missing_output_schema:
    warnings.append(
        f"Registered tools without an outputSchema (success shape unvalidated at "
        f"runtime): {missing_output_schema}"
    )

_ran("8")

# --- 9: MCP annotations are total (every tool publishes risk hints) ---------
annotated = annotated_tools()
if not annotated:
    errors.append("Could not parse ALL_ANNOTATED from host/src/annotations.ts")
else:
    unannotated = sorted(tool_set - annotated)
    if unannotated:
        errors.append(
            f"Registered tools missing from annotations.ts ALL_ANNOTATED (they would "
            f"ship with no MCP risk hints, leaving clients and policy catalogs to guess "
            f"from the tool name): {unannotated}"
        )
    stale_annotations = sorted(annotated - tool_set)
    if stale_annotations:
        errors.append(f"annotations.ts annotates non-existent tools: {stale_annotations}")

_ran("9")

# --- 10: MCP resource count — code <-> live docs ----------------------------
resources_found = registered_resources()
resource_uris = set(resources_found.values())
resource_count = len(resource_uris)

missing_resources = sorted(EXPECTED_RESOURCE_URIS - resource_uris)
if missing_resources:
    errors.append(
        f"Expected MCP resources not registered anywhere in host/src: {missing_resources}"
    )
unexpected_resources = sorted(resource_uris - EXPECTED_RESOURCE_URIS)
if unexpected_resources:
    errors.append(
        f"host/src registers MCP resources absent from EXPECTED_RESOURCE_URIS: "
        f"{unexpected_resources}. Adding a resource is a three-part change — the "
        f"source, this roster, and every resource count in the live docs."
    )

resource_claims = doc_resource_claims()

# The doc half of this check is only as good as its trigger. Assert the required
# sites actually stated a count, so rewording them out of the regex's reach is a
# failure rather than a quiet reduction to zero comparisons.
misfiled_resource_required = sorted(RESOURCE_COUNT_REQUIRED - set(RESOURCE_DOCS))
if misfiled_resource_required:
    errors.append(
        f"RESOURCE_COUNT_REQUIRED names files absent from RESOURCE_DOCS, so they "
        f"are never scanned and the requirement is inert: "
        f"{[str(p.relative_to(ROOT)) for p in misfiled_resource_required]}"
    )
claimed_in = {f for f, _ln, _n in resource_claims}
silent_required = sorted(RESOURCE_COUNT_REQUIRED - claimed_in)
if silent_required:
    errors.append(
        f"File(s) on RESOURCE_COUNT_REQUIRED state no MCP resource count at all "
        f"({resource_count} registered): "
        f"{[str(p.relative_to(ROOT)) for p in silent_required]}. A doc that stops "
        f"stating the count cannot disagree with the code — which is how the "
        f"count half of this check reads as green while comparing nothing. Restate "
        f"it in digits, or move the file to RESOURCE_DOCS-only with a reason."
    )

bad_claims = [(f, ln, n) for f, ln, n in resource_claims if n != resource_count]
if bad_claims:
    errors.append(
        f"Live docs state a resource count that disagrees with the code "
        f"({resource_count} registered): "
        + "; ".join(f"{f.relative_to(ROOT)}:{ln} says {n}" for f, ln, n in bad_claims)
    )

_ran("10")

# --- 11: tool count — code <-> live docs, source prose, test constants ------
# The counterpart to check 10, closing the other half of the same drift class.
# The resource half was found by a human noticing a wrong number; the tool half
# had already bitten once — three `276`s survived in `index.ts` comments for two
# releases after the surface reached 286, with every test green the whole time.
#
# Both numbers are DERIVED, never typed: the full surface is the registered tool
# set, and the secure-default surface is that minus the tools `capabilities.ts`
# tags with a privileged group. Nothing here can be satisfied by editing a
# constant to match a stale doc.
priv_tools = privileged_tools()
total_tools = len(tool_set)
privileged_count = len(priv_tools)
secure_default_tools = total_tools - privileged_count

if not priv_tools:
    errors.append("Could not parse TOOL_CAPABILITIES from host/src/capabilities.ts")
stale_privileged = sorted(priv_tools - tool_set)
if stale_privileged:
    errors.append(
        f"capabilities.ts TOOL_CAPABILITIES tags tools that do not exist: {stale_privileged}"
    )

EXPECTED_BY_KIND = {
    "full": total_tools,
    "secure-default": secure_default_tools,
    "privileged": privileged_count,
}
TOOL_COUNT_FILES = [
    *RESOURCE_DOCS,
    *sorted(HOST_SRC.rglob("*.ts")),
    *sorted(HOST_TEST.rglob("*.ts")),
]

seen_claims: set[tuple[Path, int, str, int]] = set()
count_claims: list[tuple[Path, int, str, int, str]] = []
for claim in tool_count_claims(TOOL_COUNT_FILES):
    key = (claim[0], claim[1], claim[2], claim[3])
    if key not in seen_claims:  # two patterns can match the same number
        seen_claims.add(key)
        count_claims.append(claim)

bad_counts: list[str] = []
for f, ln, kind, n, snippet in count_claims:
    if kind == "residual":
        if n in (total_tools, secure_default_tools) or n in SUBGROUP_COUNTS:
            continue
        bad_counts.append(
            f"{f.relative_to(ROOT)}:{ln} states {n} beside a surface count "
            f"(neither the full {total_tools} nor the secure-default "
            f"{secure_default_tools}) — “{snippet}”"
        )
    elif n != EXPECTED_BY_KIND[kind]:
        bad_counts.append(
            f"{f.relative_to(ROOT)}:{ln} claims {kind} = {n}, code says "
            f"{EXPECTED_BY_KIND[kind]} — “{snippet}”"
        )
if bad_counts:
    errors.append(
        "Tool-count drift (code: full "
        f"{total_tools} · secure-default {secure_default_tools} · privileged "
        f"{privileged_count}):\n      - " + "\n      - ".join(bad_counts) +
        "\n      If one of these is a tool-FAMILY count that legitimately shares a "
        "line with a surface count, add it to SUBGROUP_COUNTS with a comment "
        "naming it — do not add a number you have not identified."
    )

_ran("11")

# --- 11c: the test suite's own SIZE — the same drift class, one level out ----
# README's front-door badge claimed a "431-test suite" from host 1.18.1 all the
# way to 1.33.0 — fourteen minor releases and 124 tests stale, with every gate
# green the whole time, because nothing derived the number. Checks 10 and 11
# derive their counts from code; so does this one.
#
# The count is DERIVED by parsing the declarations `node --test` itself counts:
# one `test(...)`/`it(...)` opening a line, `await` allowed. It reports the
# identical figure (555 at 1.33.0), so no claim here can be satisfied by editing
# a constant to match a stale doc.
TEST_DECL_RE = re.compile(r"^[ \t]*(?:await[ \t]+)?(?:test|it)[ \t]*\(", re.M)
host_test_count = sum(
    len(TEST_DECL_RE.findall(p.read_text(encoding="utf-8")))
    for p in sorted(HOST_TEST.rglob("*.ts"))
)
TEST_COUNT_CLAIM_RE = re.compile(r"(\d[\d,]*)[- ]test suite", re.I)

test_count_claims: list[tuple[Path, int, int, str]] = []
for _f in RESOURCE_DOCS:
    if not _f.exists():
        continue
    for _ln, _line in enumerate(_f.read_text(encoding="utf-8").splitlines(), 1):
        for _m in TEST_COUNT_CLAIM_RE.finditer(_line):
            test_count_claims.append(
                (_f, _ln, int(_m.group(1).replace(",", "")), _line.strip()[:110])
            )

if not host_test_count:
    # The anchor-missing case: a check that cannot see the thing it guards
    # passes vacuously, which is worse than failing.
    errors.append(
        "Could not count any test declaration under host/test — the suite-size "
        "check would pass vacuously. Has the suite moved, or the declaration "
        "style changed away from a line-opening test(…)/it(…)?"
    )
else:
    bad_test_counts = [
        f"{_f.relative_to(ROOT)}:{_ln} claims a {_n}-test suite, host/test "
        f"declares {host_test_count} — “{_snippet}”"
        for _f, _ln, _n, _snippet in test_count_claims
        if _n != host_test_count
    ]
    if bad_test_counts:
        errors.append(
            f"Host test-suite size drift (suite: {host_test_count}):\n      - "
            + "\n      - ".join(bad_test_counts) +
            "\n      The suite size is derived, not typed — correct the prose, "
            "never the count."
        )

_ran("11c")

# --- 11b: tool-FAMILY counts ------------------------------------------------
# Exact where it can be — a `<toolset ids>` -> N claim resolves id by id — and
# an explicit eyeball list where it cannot.
#
# This block was warn-only until session 131, on the rule "check 11 owns the
# surface counts, and this must not become a second gate with softer semantics."
# That rule was right about the danger and wrong about which half it applied to.
# A RESOLVED claim is not soft: `a,netcode,backend,assetgen,tabletop` -> 179 is
# summed id by id out of toolsets.ts, the same way check 11 reads the roster,
# and the failure message names every addend. It was also incoherent alongside
# check 13, which fails hard on `runtime_*` -> 28 — one defect class, two exit
# codes, chosen by nothing but which shape the doc happened to use.
#
# So a resolved mismatch now FAILS. The eyeball list below is still warn-only,
# and that half of the original rule stands: an UNRESOLVED prose count is not
# verified, and gating on it would mean guessing which number a sentence meant.
(
    family_mismatches,
    family_unresolved,
    family_resolved_count,
    family_resolved_values,
) = toolset_claims(TOOL_COUNT_FILES)
surface_claim_keys = {(f, ln) for f, ln, _k, _n, _s in count_claims}
family_unresolved = [c for c in family_unresolved if (c[0], c[1]) not in surface_claim_keys]

if family_mismatches:
    errors.append(
        "Toolset-subset count(s) disagree with the code — this is the class that "
        "shipped `c` documented as 14 runtime tools when it was 24, and "
        "`editor,runtime,vcs` as 172 when it was 182:\n      - "
        + "\n      - ".join(family_mismatches)
    )

_ran("11b")

# --- 13: the rest of the family class, gated exactly ------------------------
# Runs before 11b's leftover list is emitted, because anything resolved here is
# no longer unresolved. What survives all of it is a genuinely new prose count,
# which is exactly what the warning is for.
prefix_mismatches, prefix_lines = prefix_family_claims(TOOL_COUNT_FILES, tool_set)
allfalse_mismatches, allfalse_lines = all_false_annotation_claims()
annclass_mismatches, annclass_lines = annotation_class_claims(TOOL_COUNT_FILES)
exempt_errors, exempt_lines = exempt_family_lines()

if prefix_mismatches:
    errors.append(
        "Tool-name-glob family count(s) disagree with the registered roster:"
        "\n      - " + "\n      - ".join(prefix_mismatches)
    )
if allfalse_mismatches:
    errors.append(
        "The all-false annotation count is stale — the reasoning ALL_ANNOTATED "
        "rests on no longer holds:\n      - " + "\n      - ".join(allfalse_mismatches)
    )
if annclass_mismatches:
    errors.append(
        "Annotation-class size(s) disagree with annotations.ts — the caveat a "
        "bridge timeout carries is picked by this arithmetic:"
        "\n      - " + "\n      - ".join(annclass_mismatches)
    )
if exempt_errors:
    errors.append("\n      - ".join(exempt_errors))

family_resolved_lines = prefix_lines | allfalse_lines | annclass_lines | exempt_lines
family_unresolved = [
    c for c in family_unresolved if (c[0], c[1]) not in family_resolved_lines
]

if family_unresolved:
    warnings.append(
        "Tool-FAMILY counts stated in prose (NOT verified — resolve by hand at a "
        "release; listed so the class is at least visible):\n      - "
        + "\n      - ".join(
            f"{f.relative_to(ROOT)}:{ln} “{s}”" for f, ln, _n, s in family_unresolved
        )
    )

count_constants = test_count_constants()
# Expected value BY NAME. Every member but one is the full registered surface;
# `SECURE_DEFAULT` is what a default install advertises, which is the same
# subtraction check 11 already derives. Resolved here rather than in the reader so
# the reader stays a scanner and this stays the one place that knows what a name
# should equal.
_CONST_EXPECTED = {
    "EXPECTED_TOOL_COUNT": total_tools,
    "FULL_TOOL_COUNT": total_tools,
    "FULL": total_tools,
    "SECURE_DEFAULT": secure_default_tools,
}
bad_constants = [
    f"{f.relative_to(ROOT)}:{ln} {name} = {v} (expected {_CONST_EXPECTED[name]})"
    for f, ln, name, v in count_constants
    if v != _CONST_EXPECTED[name]
]
if bad_constants:
    errors.append(
        f"Host-test tool-count constants disagree with the {total_tools} registered "
        f"tools: {bad_constants}"
    )

_ran("13")

# --- 25: THE NUMERALS NO READER CLAIMED (222, closing 221 §4) ---------------
# The inverse of every count reader above. Reasoning and admitted scope are on the
# helpers; what happens here is the complement itself.
#
# 🔴 RUNS AFTER 11, 11b, 11c AND 13, AND THE ORDER IS THE DESIGN. The population is
# "every three-digit prose numeral MINUS everything a reader took", so it can only be
# computed once every reader has spoken. Move this block above any of them and it starts
# reporting numerals that are, in fact, gated — a gate that cries wolf gets deleted, which
# is the same fate SCOPE_LEDGER's own note warns about from the other direction.
prose_pin_bad, prose_pins_read, prose_pins_negative = prose_pin_problems()
if prose_pin_bad:
    errors.append(
        "The prose-numeral scanner disagrees with its own pins, so check 25 is reading a "
        "different population than the one it is documented to read:\n      - "
        + "\n      - ".join(prose_pin_bad) +
        "\n      Half these rows pin the scanner to flag NOTHING. That half is not "
        "decoration: a positive control can only assert that a mutation REDDENS a "
        "statement, so the eats-too-much direction — a byte count, a port, a version "
        "string read as a surface claim — has no other cover in this tree."
    )

# What the readers actually claimed, at (file, line, VALUE) granularity wherever the
# reader can say which number it took.
prose_claimed_values: set[tuple[Path, int, int]] = {
    (f, ln, n) for f, ln, _k, n, _s in count_claims
}
prose_claimed_values |= {(f, ln, n) for f, ln, n, _s in test_count_claims}
prose_claimed_values |= family_resolved_values
# 🔴 AND THE ONE PLACE COVERAGE IS ONLY LINE-DEEP, COUNTED RATHER THAN HIDDEN. Check 13's
# four readers (glob, all-false, annotation class, alternative ceiling) report the LINE they
# resolved, not the value, so a second numeral sharing such a line is skipped here. Today
# that is zero numerals across the three gated docs — printed below, so the day it stops
# being zero is a diff and not a silence.
prose_line_only_lines = prefix_lines | allfalse_lines | annclass_lines | exempt_lines

# Every number this tree can DERIVE. Nothing is rostered: the surface three come from the
# registration walk, the suite size from the test declarations, the family sizes from
# toolsets.ts, and the alias sums from config.ts's own expansion. A numeral that equals
# none of them is a numeral no part of this repo can produce.
_prose_sizes = toolset_sizes()
DERIVED_NUMERALS: set[int] = {
    total_tools,
    secure_default_tools,
    privileged_count,
    host_test_count,
    *_prose_sizes.values(),
}
for _ids in toolset_aliases().values():
    DERIVED_NUMERALS.add(sum(_prose_sizes.get(i, 0) for i in dict.fromkeys(_ids)))
DERIVED_NUMERALS.discard(0)

prose_read = 0
prose_line_only = 0
prose_exempt_hits: dict[tuple[str, str], int] = {}
prose_bad: list[str] = []
for _f in PROSE_NUMERAL_DOCS:
    for _ln, _n, _line in prose_numerals(_f):
        prose_read += 1
        if (_f, _ln, _n) in prose_claimed_values:
            continue
        if (_f, _ln) in prose_line_only_lines:
            prose_line_only += 1
            continue
        _key = next(
            (
                (rel, needle)
                for (rel, needle) in PROSE_NUMERAL_EXEMPT
                if ROOT / rel == _f and needle in _line
            ),
            None,
        )
        if _key is not None:
            prose_exempt_hits[_key] = prose_exempt_hits.get(_key, 0) + 1
            continue
        if _n in DERIVED_NUMERALS:
            continue
        prose_bad.append(
            f"{_f.relative_to(ROOT)}:{_ln} states {_n}, which no reader claims and no "
            f"derivation produces — “{_line[:110]}”"
        )

if prose_bad:
    errors.append(
        "Prose numeral(s) no reader claims and no derivation produces — this is the class "
        "that left README.md:119 and :381 saying 289 while seven other sites in the same "
        f"file said {total_tools}, with this file reading README.md at seven call sites "
        "and exiting 0 over both:\n      - " + "\n      - ".join(prose_bad) +
        f"\n      Derivable today: full {total_tools} · secure-default "
        f"{secure_default_tools} · privileged {privileged_count} · suite {host_test_count} "
        f"· every toolset size and alias sum. Correct the prose. If the number genuinely "
        f"is not this tree's to derive, add it to PROSE_NUMERAL_EXEMPT keyed by the EXACT "
        f"text it sits in, with the reason — never by its value, because a blessed value "
        f"silences the next drift that happens to land on it."
    )

# The exemption's vacuity rule, in the direction check 12 established: an entry that no
# longer matches exempts nothing and hides the next numeral written on that line.
stale_prose_exempt = [
    f"PROSE_NUMERAL_EXEMPT names {rel} “{needle}”, which no gated doc still carries "
    f"(reason on record: {why})"
    for (rel, needle), why in PROSE_NUMERAL_EXEMPT.items()
    if prose_exempt_hits.get((rel, needle), 0) == 0
]
if stale_prose_exempt:
    # 🔴 THE MESSAGE CARRIES ITS OWN LITERAL, AND THAT IS NOT COSMETIC. `exempt_family_lines`
    # forwards a list built elsewhere — `errors.append("…".join(x))` — and is one of the
    # statements `control_gate.py` counts as UNFINGERPRINTABLE: no row can ever name it,
    # because there is no string constant in it to name. Copying that shape here would have
    # shipped a statement this session's own control could not address.
    errors.append(
        "PROSE_NUMERAL_EXEMPT entr(y/ies) that no longer match:\n      - "
        + "\n      - ".join(stale_prose_exempt)
    )

# The admitted scope, as a number rather than an absence.
prose_excluded_count = sum(
    len(prose_numerals(_f)) for _f in PROSE_NUMERAL_EXCLUDED
)

_ran("25")

# --- 27: THE GUARDS THIS SCANNER RUNS ON THE LIVE DOCS, AND WHETHER A PIN EXERCISES EACH
#         (246, closing 233's `discover-rosters` for PROSE_NUMERAL_PINS) ----------------
# 🔴 `PROSE_NUMERAL_PINS` IS A FIXTURE TABLE, AND A FIXTURE TABLE'S POPULATION IS NOT A
# TREE — which is why 233 §3 left it for last and why the discover question for it looks
# different from the other two. Its rows do not enumerate anything in this repository.
# What they pin is BEHAVIOUR: four lookarounds, each of which suppresses a three-digit run
# for a different reason, and every one of them was added because a live document refused
# or a control refuted the scanner.
#
# 🟢 SO THE POPULATION IS THE SUPPRESSIONS THE GUARDS ACTUALLY PERFORM. Every three-digit
# window in the gated docs that the scanner does NOT return was stopped by one of the four
# lookarounds; classify each by which one, and the roster question becomes answerable in
# both directions: a class that fires on the shipped documents and is exercised by no pin
# row is a guard whose live behaviour nothing would notice being narrowed — and narrowing
# one is exactly what 224's `cl100k_base` refusal and 221 §5.2's comma row were about.
#
# 🔴 THE WINDOWS OVERLAP, DELIBERATELY. `:6006` holds two three-digit runs and they are
# suppressed by DIFFERENT guards — `600` by the digit on its right, `006` by the digit on
# its left. A non-overlapping scan sees only the first, and the first draft of this check
# reported `digit-left` as an unpinned live class on the strength of that alone. The
# population is every window, not every disjoint match.
PROSE_GUARD_RAW = re.compile(r"(?=(\d{3}))")


def prose_guard_classes(text: str) -> "dict[str, int]":
    """Which guard suppressed each three-digit window this scanner declines to return."""
    kept = {m.start() for m in PROSE_NUMERAL_RE.finditer(text)}
    out: "dict[str, int]" = {}
    for m in PROSE_GUARD_RAW.finditer(text):
        start = m.start()
        if start in kept:
            continue
        end = start + 3
        before, after = text[start - 1:start], text[end:end + 1]
        hits = []
        if before.isdigit():
            hits.append("digit-left")
        if before.isalpha():
            hits.append("letter-left")
        if re.fullmatch(r"\d[.,]", text[max(0, start - 2):start]):
            hits.append("grouped-left")
        if after.isdigit():
            hits.append("digit-right")
        if after.isalpha():
            hits.append("letter-right")
        if re.fullmatch(r"[.,]\d", text[end:end + 2]):
            hits.append("grouped-right")
        for h in hits or ["unclassified"]:
            out[h] = out.get(h, 0) + 1
    return out


prose_guard_live: "dict[str, int]" = {}
for _p in PROSE_NUMERAL_DOCS:
    _t, _ = _mask_fences(_mask_continuations(_p.read_text(encoding="utf-8"), _p.suffix))
    for _k, _v in prose_guard_classes(_t).items():
        prose_guard_live[_k] = prose_guard_live.get(_k, 0) + _v
prose_guard_pinned: "dict[str, int]" = {}
for _text, _expected, _why in PROSE_NUMERAL_PINS:
    for _k, _v in prose_guard_classes(_text).items():
        prose_guard_pinned[_k] = prose_guard_pinned.get(_k, 0) + _v

if not prose_guard_live:
    errors.append(
        "The prose scanner suppresses NOTHING anywhere in the gated docs, which is not a "
        "state these four documents can be in — they carry version strings, ports and "
        "comma-grouped byte counts. Either the doc list emptied or the raw window reader "
        "stopped matching, and either way this check now has nothing to disagree with."
    )
if "unclassified" in prose_guard_live:
    errors.append(
        f"{prose_guard_live['unclassified']} three-digit window(s) in the gated docs are "
        f"suppressed by NONE of the four guards this check knows about. The scanner and "
        f"this reader disagree about why a numeral is being dropped, so the classes below "
        f"no longer partition the suppressions and a pin can no longer cover one."
    )
for _cls in sorted(set(prose_guard_live) - {"unclassified"}):
    if _cls not in prose_guard_pinned:
        errors.append(
            f"The `{_cls}` guard suppresses {prose_guard_live[_cls]} three-digit window(s) "
            f"in the shipped docs and NO row of PROSE_NUMERAL_PINS exercises it. Narrow or "
            f"drop that lookaround and check 25 silently reads a different population — "
            f"which is the direction a positive control cannot reach (221 §5.2) and the "
            f"reason this table has a negative half at all. Add a pin row carrying the "
            f"shape, with the numerals it must and must not return."
        )
print(f"PROSE_GUARDS {sum(prose_guard_live.values())} suppression(s) in "
      f"{len(prose_guard_live)} live class(es) · {len(prose_guard_pinned)} class(es) "
      f"exercised by a pin row · {len(PROSE_NUMERAL_PINS)} row(s)")
_ran("27")

# --- 12: recipe roster — code <-> live docs ---------------------------------
# The third instance of checks 10 and 11's drift class, and the one that had
# already gone wrong in the wild: README's hand-maintained recipe list never
# listed `recipe_deterministic_playtest`, shipped in 1.21.0 — six bullets for
# seven recipes, across three releases, with every test green the whole time.
# The roster existed as a typed constant and the registrations existed in
# source; nothing compared either against the prose a reader consults first.
#
# Strict by default, in both directions: a doc that names ANY recipe must name
# EVERY recipe (catches the omission that actually happened) and must name no
# recipe that is not registered (catches a rename leaving a stale mention).
recipes_registered = registered_recipes()
recipes_constant = recipe_names_constant()
recipe_set = set(recipes_registered)

if not recipes_registered:
    errors.append(
        "Could not parse any server.registerPrompt(...) recipe from host/src/recipes.ts"
    )
if not recipes_constant:
    errors.append("Could not parse RECIPE_NAMES from host/src/recipes.ts")

if recipes_registered and recipes_constant and recipes_registered != recipes_constant:
    errors.append(
        f"host/src/recipes.ts RECIPE_NAMES disagrees with the registered prompts — "
        f"registered {recipes_registered}, RECIPE_NAMES {recipes_constant}. Order is "
        f"compared as well as membership, because host/test/recipes.test.ts asserts "
        f"registration order equals RECIPE_NAMES."
    )

recipe_dupes = sorted({r for r in recipes_registered if recipes_registered.count(r) > 1})
if recipe_dupes:
    errors.append(f"Duplicate registerPrompt recipe names: {recipe_dupes}")

misfiled_required = sorted(RECIPE_ROSTER_REQUIRED - set(RECIPE_DOCS))
if misfiled_required:
    errors.append(
        f"RECIPE_ROSTER_REQUIRED names files absent from RECIPE_DOCS, so they are "
        f"never scanned and the requirement is vacuous: "
        f"{[str(p.relative_to(ROOT)) for p in misfiled_required]}"
    )

recipe_doc_mentions = doc_recipe_mentions()
recipe_rosters_checked = 0
for f in RECIPE_DOCS:
    mentioned = recipe_doc_mentions.get(f, set())
    required = f in RECIPE_ROSTER_REQUIRED
    if f in RECIPE_ROSTER_EXEMPT or (not mentioned and not required):
        continue
    recipe_rosters_checked += 1
    unlisted = sorted(recipe_set - mentioned)
    if unlisted and not mentioned:
        errors.append(
            f"{f.relative_to(ROOT)} is on RECIPE_ROSTER_REQUIRED but names no recipe "
            f"at all — all {len(recipe_set)} are missing. If the roster genuinely moved "
            f"elsewhere, move the entry; do not let it fall out of both places."
        )
    elif unlisted:
        errors.append(
            f"{f.relative_to(ROOT)} names recipes but not all {len(recipe_set)} "
            f"registered ones — missing: {unlisted}. A hand-maintained roster allowed "
            f"to be partial is not a roster: list every recipe, or add the file to "
            f"RECIPE_ROSTER_EXEMPT with a reason."
        )
    unknown = sorted(mentioned - recipe_set)
    if unknown:
        errors.append(
            f"{f.relative_to(ROOT)} names recipes that are not registered in "
            f"host/src/recipes.ts: {unknown}"
        )

recipe_count_claims, recipe_count_prose = doc_recipe_count_claims()

# The count half of this check is only as good as its trigger — the same assertion
# check 10 carries for RESOURCE_COUNT_REQUIRED, and the one check 12 was missing.
misfiled_recipe_count = sorted(RECIPE_COUNT_REQUIRED - set(RECIPE_DOCS))
if misfiled_recipe_count:
    errors.append(
        f"RECIPE_COUNT_REQUIRED names files absent from RECIPE_DOCS, so they are "
        f"never scanned and the count requirement is inert: "
        f"{[str(p.relative_to(ROOT)) for p in misfiled_recipe_count]}"
    )
recipe_claimed_in = {f for f, _ln, _n in recipe_count_claims}
silent_recipe_required = sorted(RECIPE_COUNT_REQUIRED - recipe_claimed_in)
if silent_recipe_required:
    errors.append(
        f"File(s) on RECIPE_COUNT_REQUIRED state no recipe count at all "
        f"({len(recipe_set)} registered): "
        f"{[str(p.relative_to(ROOT)) for p in silent_recipe_required]}. This is the "
        f"state check 12 shipped in and stayed in: zero claims compared, printed on "
        f"every green run as `0 count claim(s) checked` and read by nothing. Restate "
        f"it in digits, or move the file to RECIPE_DOCS-only with a reason."
    )
bad_recipe_counts = [
    f"{f.relative_to(ROOT)}:{ln} says {n}"
    for f, ln, n in recipe_count_claims
    if n != len(recipe_set)
]
if bad_recipe_counts:
    errors.append(
        f"Live docs state a recipe count that disagrees with the code "
        f"({len(recipe_set)} registered): " + "; ".join(bad_recipe_counts)
    )
if recipe_count_prose:
    warnings.append(
        "Recipe count(s) written as words (NOT resolved — check by hand at a release; "
        "listed so the class is visible rather than silently unchecked):\n      - "
        + "\n      - ".join(
            f"{f.relative_to(ROOT)}:{ln} “{s}”" for f, ln, s in recipe_count_prose
        )
    )

_ran("12")

# --- 14: version parity — the release ritual, gated -------------------------
# The third member of the drift class checks 10-12 close, and the one that had
# already gone wrong TWICE in consecutive releases before anything looked.
#
# The host version lives in five files (six fields, since package-lock.json
# carries two) and the addon version in five more. Nothing compared them to each
# other, and the checklist naming them existed only as prose in session handoffs
# — so each release re-derived the list from memory. 1.24.0 and 1.25.0 both
# missed `host/package-lock.json`; 1.24.0's miss was caught by review and
# 1.25.0's only because someone went looking for it.
#
# Found on the first run of this check: `example/addons/breakpoint_mcp/
# operations.gd` had `ADDON_VERSION := "1.7.0"` while its own plugin.cfg in the
# same folder said 1.9.1 — two addon releases stale, in a file byte-identical to
# the canonical copy in every other respect. `example/tests/ops_unit_test.gd`
# asserts `p["addon_version"] == Ops.ADDON_VERSION`, which compares the value to
# itself and therefore passes forever: a check that reads as verification and
# verifies nothing.
#
# Both versions are DERIVED, never typed here — the host's from package.json
# (what npm actually publishes) and the addon's from the canonical plugin.cfg —
# so no failure can be silenced by editing a constant in this script. The
# rosters are explicit, so a NEW copy of either file that nobody adds here fails
# rather than drifting unwatched.

HOST_VERSION_SOURCE = Path("host/package.json")
ADDON_VERSION_SOURCE = Path("addons/breakpoint_mcp/plugin.cfg")

# Every TRACKED place the addon version is written.
#
# `host/addon/` is deliberately absent: it is gitignored build output that
# `npm run stage-addon` recreates by copying `addons/breakpoint_mcp` verbatim,
# so it cannot drift independently — and it does not exist on a fresh clone.
# The CI `contract-check` job is checkout + python with no node and no build, so
# naming it here made this script raise FileNotFoundError on the very gate it
# was written to protect. example-csharp carries no copy at all (it enables only
# the host-side C# planes).
ADDON_CFG_FILES = [
    Path("addons/breakpoint_mcp/plugin.cfg"),
    Path("example/addons/breakpoint_mcp/plugin.cfg"),
]
ADDON_OPS_FILES = [
    Path("addons/breakpoint_mcp/operations.gd"),
    Path("example/addons/breakpoint_mcp/operations.gd"),
    # 🆕 259 — the RUNTIME plane grew an `ADDON_VERSION` too, because its `ping` did not
    # carry one and its own `unknown_method` remedy made a claim about it (258 §2). Three
    # copies and not two: example-csharp has no `operations.gd` but it DOES ship the
    # runtime bridge, so the C# example project joins this population for the first time.
    Path("addons/breakpoint_mcp/runtime_bridge.gd"),
    Path("example/addons/breakpoint_mcp/runtime_bridge.gd"),
    Path("example-csharp/addons/breakpoint_mcp/runtime_bridge.gd"),
]

# Directories the roster scan must not walk. Build output and scratch are not
# "an ungated copy of the addon" — failing on them would make a release gate
# fire on a developer's own working tree, which is how a gate gets disabled.
# `_to_delete/` is the bridge-scratch convention; `host/addon/` is generated.
VERSION_SCAN_SKIP = {
    ".git", "node_modules", "__pycache__", "dist", "dist-test", "addon", "_to_delete", ".godot",
}


# 🆕 276 — `serverinfo-version-literal` (#248, twenty-eight sessions), AND THE CLOSE IS
# A DELETION PLUS A READER. The row asked why `index.ts` wrote the server's advertised
# version as a literal where `packageVersion()` exists; `version.ts`'s own docstring
# answers it — *the best outcome is not a gated literal but no literal at all, so
# anything that merely needs to REPORT the version should call this instead of being
# added to the roster* — and check 14's roster was the workaround, not the answer.
#
# 🔴 SO THE SITE IS GONE AND THIS IS WHAT STOPS IT COMING BACK, over a population WIDER
# than the one row that was wrong. The incident `version.ts` documents is not the server
# at all: `lsp.ts` and `cslsp.ts` told Godot's language server and OmniSharp they were
# `0.2.0` from the initial commit to 1.26.0 — twenty-odd releases — and nothing noticed,
# because a literal nobody compares to anything cannot go stale loudly. Both of those
# fields are `clientInfo`, neither was ever on check 14's roster, and a gate that only
# knew the site that had already been found would have watched the wrong three.
INFO_VERSION_RE = re.compile(
    r'\{\s*name:\s*"[^"]+",\s*version:\s*"(\d+\.\d+\.\d+[^"]*)"\s*\}'
)


def hardcoded_info_versions() -> "tuple[list[str], int]":
    """(`file:line` for every serverInfo/clientInfo literal version, files scanned).

    The count is the second return for `uncaptured_tool_registrations`'s reason: an
    empty offence list means *nothing hardcoded* and *did not look* identically, and
    this walk is over a directory whose layout a refactor can move.
    """
    found: list[str] = []
    scanned = 0
    for path in sorted(HOST_SRC.rglob("*.ts")):
        scanned += 1
        text = path.read_text(encoding="utf-8")
        for m in INFO_VERSION_RE.finditer(text):
            found.append(f"{path.relative_to(ROOT)}:{text.count(chr(10), 0, m.start()) + 1} "
                         f"says {m.group(1)}")
    return found, scanned


def _text(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def _one(pattern, rel, what):
    """Exactly one match, or it is a roster problem rather than a value problem."""
    path = ROOT / rel
    if not path.exists():
        errors.append(
            f"check 14's roster names {rel}, which does not exist. Every site on the "
            f"roster must be a TRACKED file — this script runs on a bare checkout with "
            f"no node and no build."
        )
        return None
    # MULTILINE: several of these anchor with ^ at the start of a LINE, not the file.
    hits = re.findall(pattern, path.read_text(encoding="utf-8"), re.M)
    if len(hits) != 1:
        errors.append(
            f"{rel}: expected exactly one {what} stamp, found {len(hits)}. "
            f"Check 14 cannot verify a site it cannot locate — fix the file or the pattern."
        )
        return None
    return hits[0]


host_version = json.loads(_text(HOST_VERSION_SOURCE))["version"]
addon_version = _one(r'^version="([^"]+)"', ADDON_VERSION_SOURCE, "addon version")

# --- host version: two lock fields + three stamps ---------------------------
lock = json.loads(_text(Path("host/package-lock.json")))
lock_root = lock.get("version")
lock_self = lock.get("packages", {}).get("", {}).get("version")
# Absent is a FAILURE, not a skip. These two fields are the exact ones missed by
# both 1.24.0 and 1.25.0, and a lockfileVersion-1 file has no `packages` object
# at all — quietly asserting nothing about them would reproduce the bug this
# check exists to prevent, while still printing a reassuring site count.
for label, got in (("`.version`", lock_root), ('`.packages[""].version`', lock_self)):
    if got is None:
        errors.append(
            f"host/package-lock.json has no {label} field, so check 14 cannot verify it. "
            f"Regenerate the lockfile with a modern npm (lockfileVersion 2+)."
        )

# 🆕 227 — AND THE OTHER SIX FIELDS OF THE SAME OBJECT, WHICH NOTHING READ.
#
# 226 §4: `#276` moved `host/package.json` to `@modelcontextprotocol/sdk ^1.29.0` /
# `zod ^3.25.76` and never regenerated the lockfile, so `packages[""].dependencies`
# carried `^1.17.0` / `^3.23.8` THROUGH THREE MERGES AND TWO PUBLISHED RELEASES,
# 1.73.4 among them. It was found by `npm ci` rewriting two lines — a tool doing its
# job, not a check.
#
# 🔴 AND THE READER WAS ALREADY STANDING ON IT. Check 14 has parsed
# `packages[""]` since 1.25.0 to read ONE key out of it. `npm` mirrors the manifest's
# whole install contract into that object — this tree's copy carries `name`,
# `version`, `dependencies`, `devDependencies`, `engines`, `bin` and `license` — and
# the check read `version` and walked past the other six. Two copies of one fact,
# one reader holding one of them (226 §4).
#
# 🔴 THE POPULATION IS DERIVED FROM THE LOCKFILE'S OWN OBJECT, NOT ROSTERED. A list
# naming `dependencies` and `devDependencies` would be the four lines 226 asked for
# and would go blind the day npm mirrors a seventh key — the shape 226 §17 named:
# a hand-chosen roster inside the one true place. Every key `packages[""]` and the
# manifest BOTH carry must agree; a key in one and not the other is reported rather
# than skipped, because that asymmetry is npm's format moving under this reader and
# a silent pass would be the reader agreeing with a comparison it did not make.
#
# 🔴 `engines` IS IN HERE AND IT IS NOT INCIDENTAL. It is the field the SDK-v2
# migration moves (`node >=18` -> `>=20`), the one `release_names.py`'s new MAJOR arm
# reads as breaking evidence, and it would have drifted exactly the way the two
# dependency ranges did.
manifest = json.loads(_text(Path("host/package.json")))
lock_pkg = lock.get("packages", {}).get("", {})
mirrored = sorted(set(lock_pkg) & set(manifest))
lock_only = sorted(set(lock_pkg) - set(manifest))
if len(mirrored) < 5:
    errors.append(
        f"host/package-lock.json's `packages[\"\"]` mirrors only {len(mirrored)} "
        f"manifest key(s) ({mirrored}) — this tree's lockfile has always carried at "
        f"least name, version, dependencies, devDependencies and engines. A "
        f"population this thin means the lockfile format moved or the parse did, and "
        f"an empty comparison agrees with everything (226 §4)."
    )
drifted = [
    f"`{k}` is {json.dumps(lock_pkg[k], sort_keys=True)} in the lockfile and "
    f"{json.dumps(manifest[k], sort_keys=True)} in the manifest"
    for k in mirrored if lock_pkg[k] != manifest[k]
]
if drifted:
    errors.append(
        "host/package-lock.json's `packages[\"\"]` has drifted from "
        "host/package.json: " + "; ".join(drifted)
        + ". npm writes that object FROM the manifest, so a difference means the "
        "manifest was edited and the lockfile was never regenerated — run "
        "`npm ci --include=dev` (or `npm install`) in host/. This is how "
        "`@modelcontextprotocol/sdk ^1.17.0` and `zod ^3.23.8` survived three merges "
        "and two published releases under a manifest that said otherwise (226 §4)."
    )
if lock_only:
    errors.append(
        f"host/package-lock.json's `packages[\"\"]` carries {lock_only}, which "
        f"host/package.json does not. npm mirrors that object from the manifest, so a "
        f"key on only one side is the format moving under this check rather than a "
        f"value being wrong — read both files before deciding which one to change."
    )

host_sites = [
    ("host/package-lock.json .version", lock_root),
    ('host/package-lock.json .packages[""].version', lock_self),
    ("README.md badge", _one(r"^> \*\*npm ([0-9]+\.[0-9]+\.[0-9]+) ", Path("README.md"), "npm version")),
    ("docs/USER_GUIDE.md stamp", _one(r"^- \*\*Version:\*\* host ([0-9]+\.[0-9]+\.[0-9]+) ", Path("docs/USER_GUIDE.md"), "host version")),
]
# 🆕 276 — THE ROSTER'S COMPLEMENT, ASKED OF THE WHOLE DIRECTORY. Everything above
# compares a literal this file KNOWS ABOUT to the manifest; this asks whether a literal
# exists that nobody knows about, which is the state `lsp.ts` and `cslsp.ts` shipped in
# for twenty releases. It is an OFFENCE list and is empty on a healthy tree, so what
# needs a floor is the number of files walked, not the number of findings.
info_literals, info_files_scanned = hardcoded_info_versions()
if info_literals:
    errors.append(
        f"Hardcoded version(s) in a serverInfo/clientInfo literal under host/src — call "
        f"`packageVersion()` instead of adding a site to check 14's roster, which is "
        f"what `version.ts` asks for in its own words: {info_literals}"
    )

host_compared = [(w, g) for w, g in host_sites if g is not None]
bad_host = [f"{where} says {got}" for where, got in host_compared if got != host_version]
if bad_host:
    errors.append(
        f"Host version drift — {HOST_VERSION_SOURCE} says {host_version}, but: "
        + "; ".join(bad_host)
        + ". A release bump touches FOUR files (package-lock.json carries two fields) "
        "since 276 took the serverInfo literal off this roster and out of the source; "
        "missing one ships a binary whose docs contradict the tarball."
    )

# --- addon version: two plugin.cfg + two ADDON_VERSION + two doc stamps -----
addon_compared = []
if addon_version is not None:
    addon_sites = [
        (f"{f}", _one(r'^version="([^"]+)"', f, "addon version"))
        for f in ADDON_CFG_FILES
        if f != ADDON_VERSION_SOURCE
    ] + [
        (f"{f} ADDON_VERSION", _one(r'const ADDON_VERSION := "([^"]+)"', f, "ADDON_VERSION"))
        for f in ADDON_OPS_FILES
    ] + [
        ("README.md badge", _one(r"^> \*\*npm [0-9.]+ · addon ([0-9]+\.[0-9]+\.[0-9]+) ", Path("README.md"), "addon version")),
        ("docs/USER_GUIDE.md stamp", _one(r"^- \*\*Version:\*\* host [0-9.]+ · addon ([0-9]+\.[0-9]+\.[0-9]+)", Path("docs/USER_GUIDE.md"), "addon version")),
    ]
    addon_compared = [(w, g) for w, g in addon_sites if g is not None]
    bad_addon = [f"{where} says {got}" for where, got in addon_compared if got != addon_version]
    if bad_addon:
        errors.append(
            f"Addon version drift — {ADDON_VERSION_SOURCE} says {addon_version}, but: "
            + "; ".join(bad_addon)
            + ". The addon copies must stay in lockstep: a stale ADDON_VERSION is what "
            "`ping` reports to every client, and the example project's own unit test "
            "compares that value to itself, so it cannot catch this."
        )

# --- roster completeness: a new TRACKED copy nobody listed must FAIL ---------
def _scan(name):
    """Every copy of `name` that would actually SHIP.

    Prefers `git ls-files`, because only tracked files reach a release — and
    because scanning the working tree makes the gate fire on a developer's own
    scratch. `breakpoint-mcp init --project ./scratch` inside a checkout writes a
    real addon copy; failing the release gate on it would be a check going off
    when nothing is wrong, which is how checks get disabled. The rglob fallback
    keeps this working from a tarball or an exported tree, where the skip list
    does the same job less precisely.
    """
    try:
        out = subprocess.run(
            ["git", "-C", str(ROOT), "ls-files", "-z", "--", f"*/{name}", name],
            capture_output=True, check=True, timeout=10,
        ).stdout.decode()
        return {Path(x) for x in out.split("\0") if x}
    except Exception:
        found = set()
        for path in ROOT.rglob(name):
            rel = path.relative_to(ROOT)
            if VERSION_SCAN_SKIP & set(rel.parts):
                continue
            found.add(rel)
        return found


for label, found, roster in (
    ("plugin.cfg", _scan("plugin.cfg"), set(ADDON_CFG_FILES)),
    ("operations.gd", _scan("operations.gd"), set(ADDON_OPS_FILES)),
):
    unlisted = sorted(found - roster)
    if unlisted:
        errors.append(
            f"{label} copies exist that check 14's roster does not name: {unlisted}. "
            f"Add them (so their version is gated) or delete them — an ungated copy is "
            f"how the example project's ADDON_VERSION went two releases stale."
        )

# Comparisons actually performed — NOT the roster length. A site that could not be
# located raises its own error and must not inflate this number into reassurance.
version_sites_checked = len(host_compared) + len(addon_compared)

_ran("14")

# --- 15: file modes — the exec bit is a contract nothing else can see -------
# #125 rewrote `scripts/contract_check.py` through a Cowork mount that forbids
# `unlink` and reports every file as 0600. The mode landed as **100644 in the
# commit** on a file that had been 100755 since the project's first commit, and
# it merged with 20/20 checks green: every call site spells it
# `python3 scripts/contract_check.py`, so only `./scripts/contract_check.py`
# broke and nothing runs it that way. #126 restored the bit. Nothing in the
# repo could see it go — this check is that missing eye.
#
# The INDEX mode is the subject, never the working tree's. `core.fileMode=false`,
# a umask, a network mount or a zip round-trip all change what `ls -l` reports
# while leaving the committed mode untouched, and the committed mode is the one
# that ships and the one that regressed. `git ls-files -s` reads the index.
#
# The assertion is set EQUALITY, in both directions, which is why it needs a
# roster and not a heuristic. "Everything with a shebang is executable" is false
# here: twelve tracked `.mjs`/`.ts` files carry `#!` and are correctly 100644,
# because they are invoked as `node drive.mjs`. A roster member falling to
# 100644 is the regression that already happened; a non-member climbing to
# 100755 is the same drift from the other side, and is how a data file or a doc
# ends up executable in a tarball.
EXEC_ROSTER = {
    Path("scripts/contract_check.py"),
    Path("scripts/validate.sh"),
    # 🆕 228 — the pre-commit hook. git EXECUTES this file rather than passing it to an
    # interpreter, so 100755 is not a preference here, it is the only mode at which the
    # hook runs at all — and a hook git silently skips is 227 §7.2 back with a green
    # commit over it. 🔴 THIS CHECK CAUGHT IT IN CI AND NOT LOCALLY, because the local
    # run happened BEFORE `git add` and the population is the INDEX. Same shape as the
    # comment two blocks down, now on the executable side as well.
    Path(".githooks/pre-commit"),
}

# The "twelve" above was PROSE — the one number in this file that nothing
# checked, in the file whose entire job is checking numbers. It was accurate
# when written and would have gone stale silently the first time anyone added a
# thirteenth `#!` script, leaving a confident sentence quietly wrong. Assert it.
#
# The count is the point, not the identity: this is the non-executable-with-a-
# shebang population, and it is expected to move whenever a demo/driver script
# is added or removed. When it does, update this number in the same commit —
# that is the prompt to re-read the sentence above and confirm it still holds.
# 🆕 219: 34 -> 36. `positive_control_gate.mjs` and its self-test, both invoked as
# `node <file>` and both committed 100644, which is what this population is for.
# 🆕 223: 36 -> 37. `scripts/assetlib_sweep.py`, invoked as `python3 <file>` and
# committed 100644 like every other scripts/*.py in the tree — contract_check.py at
# 100755 is the outlier here, not the rule.
# 🆕 231: 42 -> 44. `host/scripts/wire_invisible_gate.mjs` and its self-test, both invoked
# as `node <file>` and both committed 100644 — the same pair-shaped move 219 records above,
# and the second session running that this check has read a new file within a minute of
# `git add` because it was run after staging rather than before (228 §6.9).
# 🆕 234: 44 -> 45. `scripts/handoff_gate.py`, invoked as `python3 <file>` like every gate
# beside it. 🔴 THIRD SESSION RUNNING THAT THIS CHECK HAS READ THIS SESSION'S OWN NEW FILE
# WITHIN A MINUTE OF `git add` — and 234's new file is the one that reads a handoff's
# counters back off the instruments, so the check catching it is the argument for it
# arriving from the other side.
SHEBANG_NONEXEC_EXPECTED = 48  # governed by floor_pin_gate SIZE_LEDGER (§9.3)
                               # 🆕 268: 47 -> 48, `host/scripts/publish_guard.mjs` —
                               # the publish guard, invoked as `node <file>` from
                               # `prepublishOnly` like every instrument beside it. 🔴 AND
                               # IT WAS CAUGHT TWICE IN THE SAME MINUTE, by this check and
                               # by `lint_ceiling`'s `MJS_FILE_FLOOR` equality, both of
                               # them reading a file staged four commands earlier. The
                               # file this one caught is itself a guard against shipping
                               # a tree nobody re-read, which is the argument for both.
                               # 🆕 241: 46 -> 47, `scripts/p0_comments.py` — the P0
                               # comment classifier, invoked as `python3 <file>` like
                               # every gate beside it. 🔴 AND IT FIRED ON THE SESSION
                               # WHOSE SUBJECT IS A COMMENT INVENTORY: the file this
                               # check caught is the one that classifies every comment in
                               # the tree, and it was caught BY a comment sitting beside a
                               # literal — the exact shape its own `describes-other-code`
                               # bucket counts 1,339 of. 228 §6.9's ordering is what makes
                               # that possible: run after `git add`, not before.
                               # 🆕 240: 45 -> 46, `scripts/queue_gate.py`.
#                              # 🆕 230: 41 -> 42. scripts/lint_ceiling.py, invoked as
#                              # `python3 <file>` like every gate beside it. 🔴 THIS CHECK
#                              # CAUGHT THE NEW FILE ON THE FIRST RUN AFTER `git add`,
#                              # which is 228 §6.9's ordering finding paying for itself a
#                              # second session running.
#                              # 🆕 228: 40 -> 41. scripts/tree_quiet.py, invoked as
#                              # `python3 <file>` like every gate beside it. The hook that
#                              # calls it is EXECUTABLE and is on EXEC_ROSTER instead —
#                              # two new entry points this session, one in each population.
#                              # 225: 38 -> 40, mutation_lock_gate.py + terminology_gate.py.
#                              # Check 15 refused both within minutes of `git add`, exactly
#                              # as 223 §5 and 216's comment record it doing to those
#                              # sessions. `_gate_lock.py` is a module, carries no shebang,
#                              # and correctly does not move this number.
                               # +1 session 224: scripts/spec_conformance.py — the
                               # method-ledger reader. Committed 100644 and invoked as
                               # `python3 <file>`, like every other gate in scripts/.
                               # +1 session 216: scripts/release_names.py — check 1,
                               #   out of the gitignored ritual and into the tree
                               #   (215 §6.3). Invoked as `python3 <file>` like every
                               #   reader beside it, so 100644 is correct.
                               #   🔴 AND THIS CHECK CAUGHT IT ONLY AFTER `git add`,
                               #   WHICH IS THE INTERESTING PART. The population is
                               #   TRACKED files, so the same tree passed this check
                               #   while the new file was untracked and failed it the
                               #   moment it was staged. A local run before staging is
                               #   a run against a different tree than the one that
                               #   gets committed — CI found it, at the cost of a
                               #   round trip.
                               # +1 session 213: scripts/registry_bytes.py — the
                               #   reader that OPENS the published tarball instead
                               #   of reading a version string about it (212 §6.3).
                               #   Invoked as `python3 <file>` like every reader
                               #   beside it, so 100644 is correct — and this count
                               #   is again the only thing in the tree that would
                               #   have noticed it arriving.
                               # +2 session 209: host/scripts/wire_diff.mjs and its
                               #   self-test — the release check that reads the WIRE
                               #   rather than a file (209 §2). Both invoked as
                               #   `node <file>`, so 100644 is correct.
                               # 🔴 AND THIS CHECK IS WHY THE POPULATION IS `git ls-files`
                               #   AND NOT THE FILESYSTEM: both files sat in the tree
                               #   UNTRACKED while every local gate ran green over them,
                               #   and check 15 fired the moment they were `git add`ed.
                               #   An untracked file is invisible to exactly the readers
                               #   that ask git, and visible to every reader that walks
                               #   the disk — 209 spent a while on the difference.
                               #   blinding technique, pointed at the failure statements
                               #   the other three cannot reach (186 §10.2). 100644 like
                               #   its three siblings; CI invokes it as `python3 <file>`.
                               # +2 session 185: host/scripts/seal_order_gate.mjs and its
                               #   self-test — the marker written above its own claims
                               #   (184 §10.3). Both invoked as `node <file>` from CI, so
                               #   100644 is correct and this count is the only thing that
                               #   would have noticed them arriving.
                               # +1 session 181: scripts/floor_pin_gate.py — the third
                               #   blinding technique, pointed at the floors the other
                               #   two rest on (180 §11.3). 100644 like its two siblings:
                               #   CI invokes it as `python3 <file>`.
                               # +2 session 177: host/scripts/boundary_gate.mjs and its
                               #   self-test — both invoked as `node <file>` from CI.
                               # +3 session 175: host/scripts/verdict_gate.mjs, its self-test,
                               # and host/test-integration/_png.selftest.mjs — all `node <file>`.
                               # +1 session 173: scripts/instrument_gate.py — the blinding
#                                 technique pointed at the JS instruments (172 §10.2)
#                                 +1 session 172: scripts/scope_gate.py — and see 172's
#                                 note below: the census now reads .py/.sh too, which is
#                                 how that file stopped being invisible to BOTH halves
#                                 of check 15 at once
#                                 +1 session 167: host/scripts/path-cohort.mjs
#                                 +2 session 171: host/scripts/tautology_gate{,.selftest}.mjs
#   (was 13, +1 session 147: host/verify_shot_editor_live.mjs)
# 🔴 SESSION 167 GOTCHA: this roster counts TRACKED files, so a newly written
# script passes this check LOCALLY until it is `git add`ed and only fails in CI
# afterwards. Run contract_check.py AFTER staging, not before.


def _tracked_modes() -> "dict[Path, str] | None":
    # QUOTED annotation on purpose. `X | None` is PEP 604 and needs 3.10, and a
    # `def`'s annotations are evaluated at definition time — so the bare form
    # raises TypeError on import. The bare `dict[...]`/`list[...]` generics used
    # elsewhere in this file are PEP 585 and are fine on 3.9. macOS still ships
    # 3.9.6 as `/usr/bin/python3`, which is what this script's own shebang
    # resolves to on the maintainer's machine; CI pins `python-version: '3.x'`
    # and would never have shown the break.
    """path -> index mode for every tracked entry, or None when off-git.

    Same reason check 14's `_scan` prefers `git ls-files`: only tracked content
    reaches a release. Here it is also the only source that answers the actual
    question, since the working tree's permission bits are whatever the last
    checkout, umask or mount decided they were.
    """
    try:
        out = subprocess.run(
            ["git", "-C", str(ROOT), "ls-files", "-s", "-z"],
            capture_output=True, check=True, timeout=10,
        ).stdout.decode()
    except Exception:
        return None
    modes: dict[Path, str] = {}
    for entry in out.split("\0"):
        if not entry:
            continue
        meta, tab, path = entry.partition("\t")
        parts = meta.split()
        if not tab or len(parts) != 3:
            continue
        modes[Path(path)] = parts[0]
    return modes or None


tracked_modes = _tracked_modes()
exec_tracked: set[Path] = set()
shebangs_confirmed = 0

if tracked_modes is None:
    # A tarball or an export carries no index, so the contract cannot be
    # verified here at all. Printing "0 checked" under a PASSED banner is the
    # exact disease this gate keeps finding in other people's checks, so the
    # skip is announced rather than absorbed.
    warnings.append(
        "check 15 could not read the git index, so no file mode was verified. "
        "An export or a tarball has no index; run the gate from a checkout if you "
        "need the exec-bit contract enforced."
    )
else:
    # Only regular files have a meaningful exec bit. 120000 is a symlink and
    # 160000 a gitlink; neither is a mode this roster governs.
    exec_tracked = {p for p, m in tracked_modes.items() if m == "100755"}

    unexpected = sorted(exec_tracked - EXEC_ROSTER)
    if unexpected:
        errors.append(
            "tracked file(s) committed 100755 that check 15's exec roster does not name: "
            + ", ".join(str(p) for p in unexpected)
            + ". Add them to EXEC_ROSTER if they are meant to be run directly, or commit them "
            "100644 (`git update-index --chmod=-x <path>`). An unreviewed exec bit is the same "
            "drift as a missing one, arriving from the other side."
        )

    for rel in sorted(EXEC_ROSTER - exec_tracked):
        got = tracked_modes.get(rel)
        if got is None:
            errors.append(
                f"check 15's exec roster names {rel}, which git does not track. Every roster "
                f"entry must be a TRACKED file — an untracked script's mode ships nowhere."
            )
        else:
            errors.append(
                f"{rel} is committed as {got}, not 100755. It is meant to be run directly, but "
                f"every call site invokes it through an interpreter, so neither CI nor this gate "
                f"can observe the loss any other way — which is precisely how #125 shipped the "
                f"bit off `scripts/contract_check.py` with 20/20 checks green. "
                f"Restore it with `git update-index --chmod=+x {rel}`."
            )

    # A mode the WORKING TREE has already lost but the index has not yet
    # recorded. The index is what ships, so it is the subject above — but this
    # is the state #125 committed *from*, and one step earlier is where a gate
    # earns its keep. It fired for real while this very check was being written:
    # an editor tool rewrote this file and silently dropped it to 0644.
    #
    # Asking git rather than `os.stat` is deliberate — git honours
    # `core.fileMode`, so this stays quiet on filesystems that cannot represent
    # an exec bit rather than failing every run there. The `--summary` lines are
    # reported verbatim rather than parsed: git's quoting of unusual paths is
    # not worth re-implementing to reword a message.
    try:
        _diff = subprocess.run(
            ["git", "-C", str(ROOT), "diff", "--summary"],
            capture_output=True, check=True, timeout=10,
        ).stdout.decode().splitlines()
    except Exception:
        _diff = []
    mode_drift = [ln.strip() for ln in _diff if ln.strip().startswith("mode change")]
    if mode_drift:
        errors.append(
            "unstaged file mode change(s) in the working tree: "
            + "; ".join(mode_drift)
            + ". `git add` records the new mode, so committing from here ships it. If the change "
            "is wanted, stage it and update EXEC_ROSTER; if it is an editor or a mount dropping "
            "the bit, restore it with `chmod +x <path>` before committing."
        )

    for rel in sorted(EXEC_ROSTER):
        if rel not in tracked_modes:
            continue  # already reported as untracked above
        path = ROOT / rel
        try:
            head = path.open("rb").read(2)
        except OSError as exc:
            errors.append(
                f"check 15 could not read {rel} to confirm its interpreter line: {exc}."
            )
            continue
        if head != b"#!":
            errors.append(
                f"{rel} is on check 15's exec roster but does not begin with `#!`. An exec bit on "
                f"a file the kernel cannot launch is a mode that means nothing — add the "
                f"interpreter line, or take the file off the roster."
            )
        else:
            shebangs_confirmed += 1

    # The prose above says twelve tracked `.mjs`/`.ts` files carry `#!` and are
    # correctly NOT executable. Count them, so the sentence cannot rot: this is
    # the population the roster's set-equality deliberately does not cover, and
    # it was the only number in this file that nothing verified.
    # 🔴 AND THE CENSUS ITSELF HAD A SUFFIX FILTER (172). It read `.mjs`/`.ts` only, so
    # `scripts/scope_gate.py` — the first tracked `#!` PYTHON file committed 100644 —
    # landed in NEITHER population: not on EXEC_ROSTER (it is not executable) and not in
    # this count (wrong suffix). It was invisible to check 15 in both directions, and
    # nothing said so. A population defined by a filter is a derived scope like any
    # other; this one was narrower than the contract it was standing in for.
    shebang_nonexec = []
    for rel, mode in tracked_modes.items():
        if rel.suffix not in (".mjs", ".ts", ".py", ".sh") or mode == "100755":
            continue
        try:
            if (ROOT / rel).open("rb").read(2) == b"#!":
                shebang_nonexec.append(rel)
        except OSError:
            continue  # unreadable is check 15's other branch, not this one
    shebang_nonexec_count = len(shebang_nonexec)
    if shebang_nonexec_count != SHEBANG_NONEXEC_EXPECTED:
        listed = ", ".join(str(r) for r in sorted(shebang_nonexec)[:15])
        errors.append(
            f"check 15: {shebang_nonexec_count} tracked .mjs/.ts/.py/.sh file(s) carry `#!` while committed "
            f"non-executable, but the comment beside EXEC_ROSTER says {SHEBANG_NONEXEC_EXPECTED}. "
            f"These are invoked as `node <file>`, so 100644 is correct — but the count is prose that "
            f"goes stale silently. Update SHEBANG_NONEXEC_EXPECTED and re-read that comment. "
            f"Current set: {listed}."
        )

_ran("15")

# --- 17: example/project.godot — the invariants a local editor boot erases ---
# Opening example/ in a real editor REWRITES project.godot from Godot's in-memory
# ConfigFile: it emits its own header, DROPS EVERY OTHER COMMENT, and resolves
# script references to uid://. Both measured on a real boot, session 148.
#
# That had two consequences, and this check exists because of them.
#
# FIRST — a five-line comment block in [rendering] explained WHY this project
# selects gl_compatibility: a CI runner has no GPU, the default Forward+/Vulkan
# renderer segfaults on init there, and the game the DAP plane launches therefore
# never reached its breakpoint. gl_compatibility is also what the integration
# workflow forces via `--rendering-driver opengl3`. That comment was destroyed on
# every local boot and restored by hand each time, which is not a convention — it
# is a recurring near-miss that only ever survived because someone noticed.
#
#   THE RATIONALE NOW LIVES HERE, in a file the editor cannot rewrite, and the
#   SETTINGS are asserted instead of explained. Do not put the comment back into
#   project.godot: it will not survive the next person who opens the editor.
#
# SECOND — the editor also rewrites the autoload from the res:// path form to the
# uid:// form. THAT REWRITE MUST NOT BE COMMITTED, and this check is here to make
# sure it never is again.
#
#   Session 148 committed it, on the reasoning that adopting the editor's own
#   output would leave a boot with nothing to rewrite. CI killed it in 90 seconds:
#
#     ERROR: Failed to create an autoload, can't load from path: uid://dkyjj7tbsecr0.
#            at: _create_autoload (editor/editor_autoload_settings.cpp:413)
#
#   The uid -> path map lives in .godot/uid_cache.bin, which is gitignored and
#   therefore absent on a fresh checkout — and on 4.3, which this repo still
#   supports in its matrix, script uids do not exist at all. The autoload resolved
#   to null, the runtime bridge never started, its port never opened, and the
#   runtime and peers planes timed out against a game that was never listening.
#   A failure as far from its cause as it is possible to get.
#
# So the path form is REQUIRED and the uid form is REJECTED. The cost is that a
# local editor boot still rewrites this one line, and that is the deliberate
# trade: one predictable line of `git status` noise, restored with
# `git checkout -- example/project.godot`, in exchange for an autoload that
# resolves on every engine version and on a cold clone.
RENDERING_METHOD_REQUIRED = "gl_compatibility"

_proj_path = ROOT / "example/project.godot"
if not _proj_path.exists():
    errors.append("check 17: example/project.godot is missing — the example project is CI's subject.")
else:
    _ptext = _proj_path.read_text(encoding="utf-8")

    for _key in ("renderer/rendering_method", "renderer/rendering_method.mobile"):
        _m = re.search(r'^' + re.escape(_key) + r'="([^"]*)"', _ptext, re.M)
        if _m is None:
            errors.append(
                f"check 17: example/project.godot no longer sets `{_key}`. It must be "
                f'"{RENDERING_METHOD_REQUIRED}" — CI runners have no GPU, Vulkan segfaults on init '
                f"there, and the game the DAP plane launches never reaches its breakpoint. The full "
                f"reasoning is in the comment above this check, deliberately NOT in project.godot, "
                f"because the editor deletes comments from that file on every boot."
            )
        elif _m.group(1) != RENDERING_METHOD_REQUIRED:
            errors.append(
                f'check 17: example/project.godot sets `{_key}="{_m.group(1)}"`, but CI requires '
                f'"{RENDERING_METHOD_REQUIRED}". Changing this makes the runtime and DAP planes fail '
                f"on a GPU-less runner. If the change is deliberate, update this check in the same "
                f"commit and say why."
            )

    _al = re.search(r'^BreakpointRuntimeBridge="\*([^"]+)"', _ptext, re.M)
    if _al is None:
        errors.append(
            "check 17: example/project.godot has no BreakpointRuntimeBridge autoload. The runtime "
            "bridge is loaded by that entry; without it every runtime-plane tool fails at a distance."
        )
    else:
        _ref = _al.group(1)
        if _ref.startswith("uid://"):
            errors.append(
                f"check 17: the BreakpointRuntimeBridge autoload is committed as `{_ref}`. That is "
                f"the editor's rewrite, and it MUST NOT be committed — the uid->path map lives in "
                f"the gitignored .godot/uid_cache.bin, so on a fresh checkout (and on 4.3, which has "
                f"no script uids at all) it resolves to null, the runtime bridge never starts, and "
                f"the runtime/peers planes time out against a game that never opened its port. "
                f"Measured, session 148. Restore the path form: "
                f'BreakpointRuntimeBridge="*res://addons/breakpoint_mcp/runtime_bridge.gd" '
                f"— `git checkout -- example/project.godot` does it."
            )
        elif not _ref.startswith("res://"):
            errors.append(
                f"check 17: the autoload is `{_ref}`, which is neither a res:// path nor a uid. "
                f"It must be `*res://addons/breakpoint_mcp/runtime_bridge.gd`."
            )
        elif not (ROOT / "example" / _ref[len("res://"):]).exists():
            errors.append(
                f"check 17: the autoload points at `{_ref}`, which does not exist under example/."
            )

_ran("17")

# --- 18/19: where .uid sidecars belong, and where they must not go ----------
# A .gd committed without its .uid is not broken — Godot mints one on first
# import and resolves by path regardless. It is committed INCOMPLETE, and the
# cost is paid every time: the editor writes the sidecar on boot, it shows up as
# untracked, and it sits in `git status` forever looking like something you did.
# Session 148 lost real time to exactly that — three such files made a local boot
# indistinguishable from a dirty working tree, and a `git add -A` swept them into
# a commit they had no business being in.
#
# Session 148 §7.4 left the rest of the repo undecided, on the grounds that
# whether uids ship to END USERS is a packaging decision rather than a hygiene
# one. Session 149 decided it, and the answer splits by directory because the two
# directories are different kinds of thing. The rule:
#
#   INSIDE a Godot project this repo opens  ->  the sidecar MUST be committed (18)
#   the DISTRIBUTABLE addon                 ->  no sidecar may be committed  (19)
#
# --- why 18 covers whole projects now ---------------------------------------
# example/ and example-csharp/ are both real Godot projects, and CI runs the
# editor or `--import` against both. Anything importable inside them gets a
# sidecar minted on the next boot whether or not it is committed, so the only
# question is whether that sidecar is tracked or is permanent untracked noise.
# Measured in session 149: `--headless --path example-csharp --import` minted
# exactly four untracked .uid files under example-csharp/addons/breakpoint_mcp/,
# reproducing the session-148 problem in a directory check 18 had deliberately
# excluded. Widening 18 from example/tests/ to both projects closes that; every
# example/ script already complied, so the convention was already real.
#
# --- why 19 is the OPPOSITE rule, not an oversight --------------------------
# addons/breakpoint_mcp/ is the distributable — what `stage-addon.mjs` copies
# verbatim into the npm package and what the Asset Library serves. It is NOT
# inside any Godot project in this repo, so nothing ever mints a sidecar there
# and check 18's hygiene argument does not apply. Shipping fixed uids to every
# install worldwide is a separate question, and the evidence says don't:
#
#   * The addon contains ZERO uid:// references to its own scripts. The only
#     uid:// strings in tracked non-.uid files are the two demo.tscn scene
#     self-uids, which are not addon files. So a shipped sidecar would resolve
#     nothing that a path does not already resolve.
#   * Fixed uids COST something. Measured on 4.7: two copies of one script
#     carrying the same committed uid produce, on every import,
#         WARNING: UID duplicate detected between res://vendor/... and res://addons/...
#     Users vendor addons. The control run — same two copies, no sidecars — minted
#     two distinct uids and logged nothing.
#   * The "ship uids so uid:// references resolve on a cold clone" argument is
#     empirically dead HERE, and #145 is the proof. That autoload failure was
#         ERROR: Failed to create an autoload, can't load from path: uid://dkyjj7tbsecr0
#     and uid://dkyjj7tbsecr0 is exactly what example/addons/breakpoint_mcp/
#     runtime_bridge.gd.uid contains — a TRACKED sidecar, present on that fresh
#     checkout. It still failed, because autoloads resolve before the import scan
#     populates the gitignored .godot/uid_cache.bin. A committed sidecar does not
#     make an early-boot uid:// reference resolvable.
#
# 19 therefore turns today's accident — that directory has no sidecars only
# because no editor has ever imported it — into a stated decision that a stray
# `git add` cannot quietly reverse.
_UID_PROJECT_DIRS = ("example/", "example-csharp/")
if tracked_modes is None:
    warnings.append("check 18/19: skipped — `git ls-files` unavailable, so tracked-ness is unknown.")
else:
    _tracked = set(tracked_modes)
    _in_projects = [
        p for p in _tracked
        if p.suffix == ".gd" and str(p).startswith(_UID_PROJECT_DIRS)
    ]
    _missing_uid = sorted(
        str(p) for p in _in_projects if Path(str(p) + ".uid") not in _tracked
    )
    if _missing_uid:
        errors.append(
            "check 18: tracked .gd file(s) inside a Godot project have no tracked .uid sidecar: "
            + ", ".join(_missing_uid)
            + ". Godot mints one on the next editor boot or `--import`, where it becomes permanent "
            "untracked noise in `git status` and an easy accident for `git add -A`. Import the "
            "project once and commit the generated sidecar alongside the script."
        )
    _uid_sidecars_checked = len(_in_projects)

    # 19 — the distributable must stay sidecar-free. See the rationale above.
    _shipped_uid = sorted(
        str(p) for p in _tracked
        if p.suffix == ".uid" and str(p).startswith("addons/breakpoint_mcp/")
    )
    if _shipped_uid:
        errors.append(
            "check 19: the distributable addon must not ship .uid sidecars, but these are tracked: "
            + ", ".join(_shipped_uid)
            + ". addons/breakpoint_mcp/ is copied verbatim into the npm package and the Asset "
            "Library zip, so a committed sidecar pins one uid onto every install worldwide. The "
            "addon has no uid:// references of its own, so this buys nothing — and it costs a "
            "`WARNING: UID duplicate detected` for any user who has two copies in one project. "
            "Delete the sidecar; the editor mints a unique one per install."
        )
    _shipped_uid_dir_scanned = len([
        p for p in _tracked if str(p).startswith("addons/breakpoint_mcp/")
    ])
# 🔴 HERE, NOT AFTER THE TWO PROSE SECTIONS BELOW — AND THE MEASUREMENT IS WHY. This
# counter was first placed before `# --- 20`, which put two comment-only sections between
# check 18/19's last statement and its own `_ran`. Deleting the check's CODE then left the
# `_ran` behind, the count stayed at 20, and `measure182f.py` reported the whole block
# gone with ALL HARD CHECKS PASSED. A counter that survives the code it counts is worse
# than no counter: it reports coverage that is not there.
_ran("18/19")

# --- 23: THE WIRE'S VOCABULARY — the cross-LANGUAGE half of 178 §10.25 ----------
#
# 🔴 NAMED "CLEARLY NEXT" FOR FOUR SESSIONS (178 §10.25 -> 189 §34 -> 190 §33 ->
# 191 §9.2) AND NEVER MEASURED. 190 paid the WITHIN-file half by exporting
# `READS_AS_CLAIM` so one predicate has one definition. This is the other half, and
# measuring it first (`_to_delete/xlang192.mjs`) turned one sentence into two
# populations that had been sharing a phrase:
#
#     the CODEC tag vocabulary   variant_json.gd encode()/decode()  <->  the tags
#                                TypeScript CONSTRUCTS in tool arguments
#     the ERROR CODE vocabulary  operations.gd `_err(code, ..)`     <->  the codes
#                                TypeScript BRANCHES ON
#
# Checks 1 & 2 already compare the two languages — but they compare METHOD NAMES. The
# PAYLOAD vocabulary crossing the same wire has never been compared by anything, which
# is what "enforced in GDScript and asserted in TypeScript, with nothing comparing the
# two" meant.
#
# 🔴 THE ERROR-CODE HALF IS THE ONE WITH TEETH, AND IT IS ALREADY LOAD-BEARING.
# `tabletop.ts` catches a failed `scene.close` and re-throws it as `overwrite_unsupported`
# — a REFUSAL — only when the addon's code is exactly `"unsupported"` (operations.gd's
# `_scene_close`, Godot < 4.4). Rename that code on the GDScript side and the branch stops
# firing: `board_create ... overwrite: true` silently APPENDS to the open stale tab, which
# is the exact bug the guard exists to prevent. And `tabletop_guard.test.ts` would still
# pass, because it constructs the thrown value itself:
#
#     throw Object.assign(new Error(".."), { code: "unsupported" })
#
# A test that manufactures the input it is testing against asserts TypeScript's behaviour
# GIVEN a hypothesis about GDScript. Nothing checked the hypothesis. That is the tautology
# class this repo already has a gate for, one language out.
#
# 🔴 THE FINDER FOR THE TS SIDE HAS A FALSE POSITIVE THAT WOULD HAVE SHIPPED. A naive
# `code\s*===\s*"..."` matches `typeof e.code === "number"` in cli.ts and vcs.ts, so the
# first draft reported `number` as "a code the addon never raises" — on a healthy tree.
# A gate that cries wolf on the first run gets deleted, so the `typeof` form is excluded
# explicitly. Node's own errno codes need no exclusion list: they are SCREAMING_CASE
# (`ENOENT`, `ESRCH`) and addon codes are snake_case, so the character class separates
# the two populations by construction rather than by a roster that would go stale.
#
# Numbered 23 because 21 and 22 are taken by the report-wire and checks-ran blocks, which
# are NOT in CHECKS_EXPECTED — they gate the roster and cannot be members of it.

_VJ = (ADDON / "variant_json.gd").read_text()
_vj_enc, _vj_dec = _VJ.split("static func decode", 1)
_vj_dec = _vj_dec[_vj_dec.index('match String(j["__type__"])'):]

codec_emitted = set(re.findall(r'"__type__":\s*"(\w+)"', _vj_enc))
codec_accepted = set(re.findall(r'^\t+"(\w+)":\s*$', _vj_dec, re.M))

# What GDScript's decode() actually READS out of each tagged object. A tag whose NAME
# matches but whose FIELDS do not decodes to a default-valued Variant — Vector2(0, 0)
# for a payload carrying {x, z} — and every layer downstream reports success.
#
# 🔴 SCANNED LINE BY LINE, AND THE LEDGER BELOW IS WHY. The first draft did it with one
# multi-line regex, `^\t+"(\w+)":$\n((?:^\t+(?!").*$\n)+)`, whose body arm is defeated by
# its own backtracking: `\t+` gives back a tab so the `(?!")` lookahead no longer sees the
# NEXT arm's quote, and arm one swallows the whole match block. It reported ONE arm of ten
# and `SCOPE COLLAPSE xlang.codec_fields: 1 < floor 8` on the very first run — the floor
# written in the same commit, catching the finder it was written to protect. An indent
# level is a delimiter, so it is compared as one rather than matched.
codec_fields: "dict[str, set[str]]" = {}
_arm: "str | None" = None
_arm_indent = 0
for _ln in _vj_dec.split("\n"):
    _stripped = _ln.strip()
    _indent = len(_ln) - len(_ln.lstrip("\t"))
    _hdr = re.match(r'^"(\w+)":$', _stripped)
    if _hdr:
        _arm, _arm_indent = _hdr.group(1), _indent
        codec_fields[_arm] = set()
    elif _arm is not None and _stripped and _indent <= _arm_indent:
        _arm = None                                   # dedent — the arm ended
    elif _arm is not None:
        codec_fields[_arm] |= set(re.findall(r'j\.get\("(\w+)"', _ln))

# 🔴 THE ONE-WAY PAIR, NAMED RATHER THAN TOLERATED. `Object` and `Unsupported` are
# emitted by encode() and have no decode arm ON PURPOSE: neither can be reconstructed
# from what the tag carries (a class name, a `str()` repr). The set is asserted EXACTLY
# in both directions, so a THIRD one-way tag arriving by accident — the shape a new
# encode branch takes when its decode arm is forgotten — is a failure and not a silent
# member of a tolerated class.
CODEC_ONEWAY = {"Object", "Unsupported"}

_oneway_now = codec_emitted - codec_accepted
for _tag in sorted(_oneway_now - CODEC_ONEWAY):
    errors.append(
        f"Codec tag {_tag!r} is emitted by variant_json.gd encode() and has no decode() "
        f"arm, so a property carrying it round-trips to null and every layer above "
        f"reports success. Add the decode arm, or name it in CODEC_ONEWAY with the "
        f"reason it cannot be reconstructed."
    )
for _tag in sorted(codec_accepted - codec_emitted):
    errors.append(
        f"Codec tag {_tag!r} has a decode() arm that nothing in encode() can produce. "
        f"A dead arm is indistinguishable from a live one until the day a caller needs "
        f"it — remove it, or emit the tag."
    )
for _tag in sorted(CODEC_ONEWAY - _oneway_now):
    errors.append(
        f"CODEC_ONEWAY names {_tag!r} as deliberately one-way, but it is no longer both "
        f"emitted and undecodable. The exemption is stale: either the decode arm arrived "
        f"(drop it from CODEC_ONEWAY) or encode() stopped emitting it (drop it, and the "
        f"encode branch it came from is gone too)."
    )

# The TypeScript side: tool arguments this host CONSTRUCTS and puts on the wire.
ts_variant_tags: "list[tuple[str, str, str]]" = []
for _f in sorted(HOST_SRC.rglob("*.ts")):
    for _m in re.finditer(r'__type__:\s*"(\w+)"([^}]*)', _f.read_text()):
        ts_variant_tags.append((_m.group(1), str(_f.relative_to(ROOT)), _m.group(2)))

for _tag, _rel, _rest in ts_variant_tags:
    if _tag not in codec_accepted:
        errors.append(
            f"{_rel} constructs a Variant tagged {_tag!r}, which variant_json.gd decode() "
            f"cannot read. It reaches GDScript as a plain Dictionary (or null) and the "
            f"property set silently does the wrong thing."
        )
        continue
    # 🔴 KEYS ONLY, NEVER "identifiers appearing anywhere in the literal". The obvious
    # shortcut — every \w+ in the object body — passes `{__type__:"Vector2", x: y}`,
    # because `y` is present as a VALUE. That is the exact defect this statement exists
    # to catch, so the finder that would miss it is not a shortcut, it is the bug.
    # Shorthand (`{r, g, b, a}`) and explicit (`{class: cls}`) both name a key first.
    _want = codec_fields.get(_tag, set())
    _have = set()
    for _piece in _rest.split(","):
        _k = re.match(r'^\s*(\w+)\s*(?::|$)', _piece)
        if _k:
            _have.add(_k.group(1))
    _missing = sorted(f for f in _want if f not in _have)
    if _missing:
        errors.append(
            f"{_rel} constructs a {_tag!r} Variant without field(s) {_missing}, which "
            f"decode() reads via j.get(). The tag NAME matches, so nothing rejects it — "
            f"it decodes to a default-valued {_tag} and the call reports success."
        )

# The error-code vocabulary. One regex per side; the TS one excludes `typeof x.code ===`
# (see above) and cannot match Node's SCREAMING_CASE errno codes by construction.
addon_err_codes: "set[str]" = set()
for _f in sorted(ADDON.glob("*.gd")):
    for _m in re.finditer(r'(?:_err\(\s*|"code"\s*:\s*)"([a-z0-9_]+)"', _f.read_text()):
        addon_err_codes.add(_m.group(1))

# 🔴 ONE SCAN, ONE PREDICATE — and the reverse sweep is what forced it. The binding
# comparison below started life with its own copy of this regex and its own `typeof`
# guard, and mutant C5's anchor immediately reported `occurs 2 time(s)`: two definitions
# of "a TypeScript branch on an addon error code", one of which the sweep could no longer
# reach. That is 190 §4's finding — one predicate, one definition — arriving inside the
# check written to enforce exactly that across a language boundary.
ERR_BRANCH_RE = re.compile(r'(typeof\s+)?[\w\)\]\.\?]*\.code\s*===\s*"([a-z0-9_]+)"')
_branch_hits: "list[tuple[str, str, str, int]]" = []        # (code, file, text, offset)
for _f in sorted(HOST_SRC.rglob("*.ts")):
    _t = _f.read_text()
    for _m in ERR_BRANCH_RE.finditer(_t):
        if _m.group(1):
            continue    # `typeof e.code === "number"` — a TYPE test, not a code test
        _branch_hits.append((_m.group(2), str(_f.relative_to(ROOT)), _t, _m.start()))

ts_err_branches: "list[tuple[str, str]]" = [(c, r) for c, r, _t, _o in _branch_hits]

for _code, _rel in ts_err_branches:
    if _code not in addon_err_codes:
        errors.append(
            f"{_rel} branches on the addon error code {_code!r}, which no `_err(..)` in "
            f"addons/breakpoint_mcp/ raises. The branch is dead: whatever it does instead "
            f"of firing — refuse, degrade, re-throw — is what the host now does always, "
            f"and a host-side test that constructs the error itself cannot tell."
        )

# 🔴 AND THE VOCABULARY TEST ABOVE IS NOT ENOUGH, WHICH THE REVERSE SWEEP PROVED RATHER
# THAN ARGUED (192 §6, mutant C1). Renaming `_scene_close`'s `_err("unsupported", ..)` —
# the ONE raise site `tabletop.ts`'s overwrite refusal depends on — left the run GREEN,
# because `"unsupported"` is raised at seven OTHER sites and the addon's VOCABULARY never
# moved. The membership test asks "does this word exist somewhere in GDScript"; the guard
# needs "does the handler I am wrapping raise it".
#
# So the pair is resolved to the BINDING: the bridge method whose call the branch guards,
# and the codes that method's handler can actually return. The method is the nearest
# `emit(..)` / `call(..)` / `.request(..)` literal ABOVE the branch, which is the shape a
# try/catch takes in every one of these sites; handler codes are the transitive closure
# over the GDScript functions the dispatch arm names, because a code raised one helper
# down is still a code that method returns and flagging it would be crying wolf.
_GD_SRC = {p.name: p.read_text() for p in sorted(ADDON.glob("*.gd"))}
_GD_ALL = "\n".join(_GD_SRC.values())
_gd_bodies: "dict[str, str]" = {}
for _m in re.finditer(r"^func (_?\w+)\(.*?(?=^func |\Z)", _GD_ALL, re.M | re.S):
    _gd_bodies[_m.group(1)] = _m.group(0)


def _codes_of(fn: str, seen: "set[str]|None" = None) -> "set[str]":
    """Every `_err` code reachable from `fn`, following the helpers it calls."""
    seen = seen if seen is not None else set()
    if fn in seen or fn not in _gd_bodies:
        return set()
    seen.add(fn)
    body = _gd_bodies[fn]
    out = set(re.findall(r'_err\(\s*"([a-z0-9_]+)"', body))
    for callee in set(re.findall(r"\b(_\w+)\(", body)):
        out |= _codes_of(callee, seen)
    return out


gd_handler_codes: "dict[str, set[str]]" = {}
for _m in re.finditer(r'^\t\t"([a-z_]+\.[a-z_]+)":\n((?:\t\t\t.*\n)+)', _GD_ALL, re.M):
    _codes: "set[str]" = set()
    for _fn in re.findall(r"\b(_\w+)\(", _m.group(2)):
        _codes |= _codes_of(_fn)
    gd_handler_codes[_m.group(1)] = _codes

_BRIDGE_CALL_RE = re.compile(r'(?:emit|call|request)\(\s*"([a-z_]+\.[a-z_]+)"')
err_branch_bindings: "list[tuple[str, str, str]]" = []      # (method, code, file)
for _code, _rel, _t, _off in _branch_hits:
    _above = [x.group(1) for x in _BRIDGE_CALL_RE.finditer(_t, 0, _off)]
    if _above:
        err_branch_bindings.append((_above[-1], _code, _rel))

for _method, _code, _rel in err_branch_bindings:
    _raises = gd_handler_codes.get(_method)
    if _raises is None:
        continue        # not a dispatch method — checks 1 & 2 own that failure, not this
    if _code not in _raises:
        errors.append(
            f"{_rel} guards a {_method!r} call and branches on the error code {_code!r}, "
            f"but that method's GDScript handler cannot return it (it raises "
            f"{sorted(_raises) or 'nothing'}). The branch never fires, so whatever it does "
            f"INSTEAD is what the host now does always — and the code may still be raised "
            f"elsewhere in the addon, which is exactly why the vocabulary test above "
            f"cannot see this."
        )

_ran("23")

# --- 28: THE MESSAGE SAYS WHAT BROKE; SOMETHING HAS TO SAY WHAT TO DO ---------
#
# 🔴 THE POPULATION, MEASURED BEFORE THE TABLE EXISTED (254, closing 248's
# `tool-error-sweep-unrun`). 525 `_err(..)` sites across the two engine-facing planes
# emit 216 distinct message templates. Classified by hand and then by predicate, 451
# of those sites named NO next action — including the three most-emitted messages in
# the addon: `No scene is open` at 90 sites, `Node not found: %s` at 53 and
# `ResourceSaver.save() returned %d` at 35. Each is true. None of them tells an agent
# that cannot see the editor what to do about it, and 248's eight-message sample said
# all eight were good, which is what a sample of eight out of 216 is worth.
#
# 🔴 WHY THIS IS A JOIN AND NOT A SPELLING RULE. The remedy hangs off the error CODE,
# which is the vocabulary check 23 above already reads on both sides of the wire, and
# the code is the axis the message VARIES within: every `X not found: %s` is one
# `not_found` with one next action. So the table is 50 rows rather than 216, and the
# thing that can rot — a remedy naming a tool that was renamed or never existed — is
# joined to `registered_tools()`, which is the same net checks 3, 4 and 11 use.
#
# WHAT IT ASSERTS, IN FOUR DIRECTIONS:
#   a. every code a plane's `_err(..)` raises has a remedy row in that plane's table
#   b. every remedy row is raised by that plane — a dead row is a maintained lie
#   c. every backticked `tool_name` inside a remedy is a REGISTERED tool
#   d. both `_err` implementations attach the remedy, and every host renderer of a
#      `Partial<BridgeError>` appends `remedyClause` — a sixth plane's `fail()` added
#      without it ships silent messages again, and nothing else in this tree would say so
#
# 🔴 AND THE EXEMPTION IS DERIVED, NOT ROSTERED. `bridge_server.gd`'s `unauthorized`
# and both planes' `bad_json` are built as dict literals rather than raised through
# `_err`, because the pre-auth path is deliberately no-echo — it must not tell an
# unauthenticated peer anything, remedy least of all. That is why the population is
# "codes reachable through `_err(`" and not "codes in the addon": the exclusion falls
# out of how the refusal is written, so no hand-maintained list of exempt codes exists
# to go stale. 253's `Status` column note asked for exactly this and named the
# alternative it refuses.
REMEDIES_FILE = ADDON / "error_remedies.gd"
_REMEDY_PLANES = [
    # (plane label, the file raising the codes, the table in error_remedies.gd)
    ("editor", ADDON / "operations.gd", "EDITOR_REMEDIES"),
    ("runtime", ADDON / "runtime_bridge.gd", "RUNTIME_REMEDIES"),
]
# One imperative, at the head of the sentence. A remedy that opens with a noun phrase is
# a second description of the failure, which is what the message already carried.
# 🆕 267 — five verbs added, and the reason matters more than the list. These openers were
# harvested from `error_remedies.gd`, so the tuple described ONE table's vocabulary while
# reading like a rule about imperatives. Widening the check to the host's own remedy
# sentences (d3 below) immediately refused `closeRemedy`'s "Restart the editor and retry" —
# a sentence nobody thinks is wrong. The check asks *does this open with a next action*,
# and each of these answers it; they are added as imperatives, NOT as exemptions, and the
# length ceiling and full-stop rules apply to them unchanged.
_REMEDY_IMPERATIVES = (
    "act", "call", "check", "choose", "create", "duplicate", "enable", "fix", "inspect",
    "look", "make", "open", "pass", "raise", "re-run", "read", "release", "restart", "run",
    "send", "set", "simplify", "spawn", "split", "start", "switch", "verify",
    # 🆕 268 — one verb, for the same reason 267 added five. Widening check 28's grammar
    # arm to `write_failed`'s new remedy refused "Retry the call", which is a next action
    # by any reading — `re-run` was already here and `retry` was not, which is a fact
    # about where the vocabulary was harvested rather than about English. Added as an
    # IMPERATIVE, so the ceiling and full-stop rules apply to it unchanged.
    "retry",
)
_REMEDY_MAX = 210            # measured longest at 254: 176 characters
remedy_rows = remedy_tables()
remedy_renderers = remedy_renderers_read()
remedy_tool_refs: "list[tuple[str, str, str]]" = []      # (plane, code, tool)
remedy_cli_refs: "list[tuple[str, str, str]]" = []       # (plane, code, the `breakpoint-mcp …` span)

# 🆕 259 — e: THE CLI HALF OF THE JOIN, AND WHY 254's HALF COULD NOT SEE IT.
#
# 254 joined every backticked TOOL NAME in a remedy to the live `registerTool(..)`
# surface, on the argument that a remedy is an instruction somebody will execute. A
# remedy naming a COMMAND was joined to nothing at all, and both `unknown_method` rows
# shipped one from the day the table landed:
#
#     "Re-run `breakpoint-mcp init` … the addon installed in the project is older."
#
# Every name in that sentence resolves. `breakpoint-mcp` is the binary, `init` is a real
# subcommand, and the diagnosis is correct. It is still a dead instruction: `installAddon`
# skips a destination that already has a `plugin.cfg`, and the addon being ALREADY
# INSTALLED is the precondition of the sentence — it is stale, so it is there. The command
# exits 0, prints `addon: skipped`, and changes nothing. A user who follows it concludes
# the diagnosis was wrong.
#
# 🔴 SO THE RULE IS NOT SPELLING, IT IS WHETHER THE EFFECT IS REACHABLE. Three parts, and
# the third is the one that would have caught it:
#   e1. every `breakpoint-mcp <sub>` span names a subcommand SYNOPSIS declares
#   e2. every `--flag` inside such a span is documented in that subcommand's USAGE block —
#       those rosters are `parseArgs`'s input, so an undocumented flag is one the CLI
#       REFUSES, and the remedy would fail at the command line
#   e3. a span naming `init` must also name `--force`, because a remedy is only ever read
#       by somebody who already has the addon, which is the exact state bare `init`
#       declines to act on
_CLI_BIN = "breakpoint-mcp"


def cli_surface() -> "tuple[set[str], dict[str, set[str]]]":
    """(subcommands, subcommand -> its documented flags), read out of `usage.ts`.

    Derived from the shipped help text rather than rostered here, and NOT from
    `INIT_FLAGS`/`DOCTOR_FLAGS`: those are only the value-taking subset — `--force`,
    `--dry-run` and `--json` are declared at the call site and appear in none of them. A
    gate reading the convenient list would have called `--force` undeclared, which is the
    failure mode of checking the population that was easy to reach.
    """
    path = HOST_SRC / "cli" / "usage.ts"
    if not path.is_file():
        return set(), {}
    src = path.read_text()
    subs: "set[str]" = set()
    m = re.search(r"export const SYNOPSIS: string\[\] = \[(.*?)\n\];", src, re.S)
    if m:
        subs |= set(re.findall(r'"\s*breakpoint-mcp\s+([a-z][a-z0-9-]*)\s', m.group(1)))
    flags: "dict[str, set[str]]" = {}
    for name in sorted(subs):
        b = re.search(rf"export const {name.upper()}_USAGE: string\[\] = \[(.*?)\n\];", src, re.S)
        flags[name] = set(re.findall(r'"\s*(--[a-z][a-z0-9-]*)', b.group(1))) if b else set()
    return subs, flags


CLI_SUBCOMMANDS, CLI_FLAGS = cli_surface()


def _remedy_grammar(plane: "str", table: "str", rows: "dict[str, str]") -> None:
    """The sentence rules every remedy obeys, wherever the table lives.

    Lifted out of check 28's addon loop so the host-side fallback table is held to the
    SAME grammar: it is the same sentence a reader gets when the addon is new enough to
    answer for itself, and a second table with its own house style would read as a
    different product speaking.
    """
    for code, text in sorted(rows.items()):
        low = text.lower()
        if not text.endswith("."):
            errors.append(
                f"check 28: {table}[{code!r}] does not end in a full stop. It is appended "
                f"to a message the user reads as one line; a clause that trails off reads as "
                f"truncation."
            )
        if len(text) > _REMEDY_MAX:
            errors.append(
                f"check 28: {table}[{code!r}] is over the length ceiling. The remedy rides "
                f"on every failure carrying this code; a paragraph is a cost paid on every "
                f"one of them."
            )
        if not any(low.startswith(v) for v in _REMEDY_IMPERATIVES):
            errors.append(
                f"check 28: {table}[{code!r}] does not open with a next action — it "
                f"begins {text.split()[0]!r}. A second description of the failure is what "
                f"the message already carried."
            )
        for span in re.findall(rf"`({_CLI_BIN}[^`]*)`", text):
            remedy_cli_refs.append((plane, code, span))
        for tool in re.findall(r"`([a-z][a-z0-9_]+)`", text):
            # A bare backticked subcommand is a COMMAND, not a tool, and joining it to the
            # tool registry would refuse a correct sentence. It is exempt only while the
            # remedy also spells the binary, so `init` standing alone — which reads like a
            # tool name to anyone who does not already know the CLI — still fails.
            if tool in CLI_SUBCOMMANDS and _CLI_BIN in text:
                continue
            remedy_tool_refs.append((plane, code, tool))

if not REMEDIES_FILE.is_file():
    errors.append(
        f"check 28: {REMEDIES_FILE.relative_to(ROOT)} is missing. Every `_err(..)` on both "
        f"engine planes reads its next-action clause from that file; without it the addon "
        f"answers with the bare message it answered with before 254, and the only sign is "
        f"a preload that fails at editor start."
    )
for _plane, _src_file, _table in _REMEDY_PLANES:
    _rows = remedy_rows.get(_plane, {})
    if REMEDIES_FILE.is_file() and not _rows:
        errors.append(
            f"check 28: no `const {_table} := ...` table resolved in "
            f"{REMEDIES_FILE.relative_to(ROOT)}. The comparisons below then read an EMPTY "
            f"table, where a code with no remedy and a remedy no code raises are equally "
            f"invisible — so the absence is reported here as its own failure rather than "
            f"as fifty missing rows."
        )
    _raised = set(re.findall(r'_err\(\s*"([a-z0-9_]+)"', _src_file.read_text()))

    # a — a code with no remedy
    for _code in sorted(_raised - set(_rows)):
        errors.append(
            f"check 28: {_src_file.name} raises the error code {_code!r} and "
            f"{_table} has no row for it, so every failure carrying that code reaches the "
            f"user as a bare description of what went wrong. That is the state the whole "
            f"addon was in before 254 — most of its raise sites — and the row is one line."
        )
    # b — a remedy nothing raises
    for _code in sorted(set(_rows) - _raised):
        errors.append(
            f"check 28: {_table} carries a remedy for {_code!r}, which no `_err(..)` in "
            f"{_src_file.name} raises. A dead row is worse than a missing one: it reads as "
            f"coverage, it is maintained as if it shipped, and the code it was written for "
            f"was renamed or deleted without anything saying so."
        )
    # the shape of the sentence, and the names it uses
    _remedy_grammar(_plane, _table, _rows)

# c — the join. A remedy naming a tool that does not exist is an instruction the reader
# cannot follow, and renaming a tool is exactly when it happens.
_registered_for_remedies = set(registered_tools())
for _plane, _code, _tool in remedy_tool_refs:
    if _tool not in _registered_for_remedies:
        errors.append(
            f"check 28: the {_plane} remedy for {_code!r} tells the reader to call "
            f"`{_tool}`, which no `registerTool(..)` in host/src/tools registers. The "
            f"remedy is read by an agent that will try it; a renamed tool turns the one "
            f"sentence that was supposed to unblock the call into a second failure."
        )

# d — the attach sites, on both sides of the wire. Source predicates, because the
# alternative is a live editor and this file runs with no Godot at all.
for _plane, _src_file, _table in _REMEDY_PLANES:
    if "Remedies.remedy(code," not in _src_file.read_text():
        errors.append(
            f"check 28: {_src_file.name}'s `_err` does not call `Remedies.remedy(code, ..)`. "
            f"The table can be complete and every row correct and not one of them crosses the "
            f"wire: `_err` is the single point every failure on this plane passes through, "
            f"which is why the attach is there and why its absence is checked here."
        )

for _rel in remedy_renderers:
    _body = (ROOT / _rel).read_text()
    for _m in re.finditer(r"function fail\w*\(err: unknown\)\s*{(.*?)\n}", _body, re.S):
        if "remedyClause(" not in _m.group(1):
            errors.append(
                f"check 28: {_rel} renders a caught error into MCP text and does not append "
                f"`remedyClause(err)`. Something attached a next action and this plane drops "
                f"it — invisible from the raising side, because the remedy is on a field, and "
                f"invisible from the rendering side, because the text still reads like a "
                f"complete sentence. 267 widened this population off the `fail(err: unknown)` "
                f"signature; until then it held only the class that already complied."
            )

# --- 🆕 267 — d2: the raise-site half. An open channel with nothing in it is silence ----
_unanswered, _sites_scanned = host_invented_error_sites()
if _sites_scanned < 12:
    errors.append(
        f"check 28: only {_sites_scanned} `new DapError(..)` / `new LspError(..)` site(s) were "
        f"scanned, against a floor of 12 measured at 267. This reader reports an EMPTY list "
        f"both when every site carries an answer and when it matched nothing at all, so the "
        f"count is the only thing that tells the two apart."
    )
for _f, _line, _snippet in _unanswered:
    errors.append(
        f"check 28: {_f}:{_line} raises a DAP/LSP error the host WROTE and names no remedy — "
        f"`{_snippet}`. A site relaying the peer's own words is exempt (it does not know what "
        f"went wrong, only what was said about it); this one invents the sentence, so it can "
        f"answer for it. Pass a `*Remedy` / `*_REMEDY` as the last argument, or make the "
        f"message relay rather than invent."
    )

# --- 🆕 267 — d3: the host's own remedy sentences, held to the addon table's grammar ----
#
# 254 argued the remedy belongs where the code is RAISED, and everything since has been the
# addon honouring that. The host raises too — `closeRemedy`, `connectRemedy`, `timeoutRemedy`
# and four consts now — and until 267 not one of those sentences was read by anything. They
# reach the same agent through the same clause, so they answer to the same rules.
_host_causes = host_cause_remedies()
if len(_host_causes) < 8:
    errors.append(
        f"check 28: only {len(_host_causes)} host-side remedy sentence(s) resolved, against a "
        f"floor of 8 measured at 267. An empty read passes every grammar rule below by "
        f"agreeing with itself, which is the shape `scope_gate` exists to find."
    )
for _where, _sentence in sorted(_host_causes.items()):
    _remedy_grammar("host", _where, {"sentence": _sentence})

# --- f: the HOST's own fallback table, and the ceiling that keeps it one row ---------
#
# 🔴 THE ROW EXISTS BECAUSE THE ADDON-SIDE TABLE CANNOT REACH ITS OWN AUDIENCE (258 §2).
# `error_remedies.gd` was ADDED IN ADDON 1.10.0, and its `unknown_method` row says *the
# addon is older than the host* — so every addon old enough to raise that code is old
# enough to predate the file that would explain it. The two populations are disjoint by
# construction, and no edit to the addon table can ever fix it: the fix has to come from
# the side that is current by definition.
#
# 🔴 AND WHY IT IS CEILINGED RATHER THAN LEFT OPEN. A host-side remedy table is the
# cheapest possible place to answer any awkward code, and 254 spent a session arguing the
# remedy belongs where the code is RAISED — one file, one join, checkable in both
# directions. A second row here is not forbidden; it is made loud, so it is a decision
# somebody defends rather than a table that quietly grows back.
HOST_REMEDIES_FILE = HOST_SRC / "remedies.ts"
_HOST_FALLBACK_MAX = 1


def host_fallback_remedies() -> "dict[str, str]":
    """code -> the host's fallback next action, read out of `remedies.ts`."""
    if not HOST_REMEDIES_FILE.is_file():
        return {}
    src = HOST_REMEDIES_FILE.read_text()
    m = re.search(r"export const HOST_FALLBACK_REMEDIES: Record<string, string> = \{(.*?)\n\};", src, re.S)
    if not m:
        return {}
    return {
        km.group(1): km.group(2)
        for km in re.finditer(r'^\s*([a-z0-9_]+):\s*\n?\s*"((?:[^"\\]|\\.)*)",\s*$', m.group(1), re.M)
    }


host_fallback = host_fallback_remedies()
_all_raised: "set[str]" = set()
for _plane, _src_file, _table in _REMEDY_PLANES:
    _all_raised |= set(re.findall(r'_err\(\s*"([a-z0-9_]+)"', _src_file.read_text()))

if HOST_REMEDIES_FILE.is_file():
    if not host_fallback:
        errors.append(
            "check 28: no `HOST_FALLBACK_REMEDIES` table resolved in host/src/remedies.ts. "
            "Every rule below then reads an EMPTY table and passes — the ceiling, the dead-row "
            "join and the grammar all agree with themselves — so the absence is the failure."
        )
    if "remedyForWireError(" not in (HOST_SRC / "bridge.ts").read_text():
        errors.append(
            "check 28: host/src/bridge.ts does not call `remedyForWireError(..)`. The fallback "
            "table can be perfect and never reach a reader: the reject site where a wire error "
            "becomes a `BridgeError` is the one point every addon failure passes through, which "
            "is why the lookup is there and why its absence is checked here."
        )
    if len(host_fallback) > _HOST_FALLBACK_MAX:
        errors.append(
            f"check 28: HOST_FALLBACK_REMEDIES has {len(host_fallback)} rows, over the ceiling "
            f"of {_HOST_FALLBACK_MAX}. Every row here answers a code from the side that did not "
            f"raise it, which is what 254 moved the remedies AWAY from. Raise the ceiling on "
            f"purpose, with the argument for why the raising side cannot answer this one either."
        )
    for _code in sorted(set(host_fallback) - _all_raised):
        errors.append(
            f"check 28: HOST_FALLBACK_REMEDIES answers {_code!r}, which no `_err(..)` on either "
            f"engine plane raises. A fallback for a code nothing sends is a row that can never "
            f"be read and can never be found wrong."
        )
    _remedy_grammar("host", "HOST_FALLBACK_REMEDIES", host_fallback)

# --- e: the CLI join. A remedy naming a COMMAND was joined to nothing until 259 -------
if not CLI_SUBCOMMANDS:
    errors.append(
        "check 28: no subcommands resolved out of usage.ts's SYNOPSIS, so the CLI join below "
        "compares every command in every remedy against an EMPTY set and passes. That is the "
        "shape where a reader agrees with itself, so the absence is reported as the error."
    )
for _plane, _code, _span in remedy_cli_refs:
    _words = _span.split()
    _sub = _words[1] if len(_words) > 1 and not _words[1].startswith("-") else None
    if _sub is None:
        continue                                  # bare `breakpoint-mcp` — the binary itself
    if _sub not in CLI_SUBCOMMANDS:
        errors.append(
            f"check 28: the {_plane} remedy for {_code!r} tells the reader to run `{_span}`, "
            f"and {_sub!r} is not a subcommand usage.ts declares. The remedy is an instruction "
            f"somebody will paste into a shell."
        )
        continue
    for _flag in [w for w in _words[2:] if w.startswith("--")]:
        if _flag not in CLI_FLAGS.get(_sub, set()):
            errors.append(
                f"check 28: the {_plane} remedy for {_code!r} runs `{_span}`, and {_sub!r} does "
                f"not document {_flag}. Those blocks are `parseArgs`'s input, so the command in "
                f"the remedy would be REFUSED at the command line."
            )
    # e3 — the one that would have caught the shipped defect.
    if _sub == "init" and "--force" not in _words:
        errors.append(
            f"check 28: the {_plane} remedy for {_code!r} says `{_span}` without `--force`. "
            f"`installAddon` skips a destination that already has a plugin.cfg, and every reader "
            f"of this sentence already has the addon — that is why it is stale. The name "
            f"resolves and the instruction is a no-op, which is the failure 254's tool join "
            f"could not see because it only ever asked whether a name existed."
        )

print(f"Error remedies         : "
      f"{sum(len(v) for v in remedy_rows.values())} row(s) across {len(remedy_rows)} plane(s) "
      f"+ {len(host_fallback)} host fallback "
      f"· {len(remedy_tool_refs)} tool reference(s) joined to the registry "
      f"· {len(remedy_cli_refs)} CLI command(s) joined to {len(CLI_SUBCOMMANDS)} subcommand(s) "
      f"· {len(remedy_renderers)} host renderer(s) checked")
_ran("28")

# --- 29: A KEY THAT CANNOT BE ABSENT IS A PROMISE, AND ONE ZOD COULD NOT PUBLISH -----
#
# 🔴 255 — MEASURED WHILE MOVING THE TREE FROM zod 3.25.76 TO 4.4.3, AND THE INTERESTING
# HALF IS WHEN IT CHANGED. `z.object({v: z.any()}).parse({})` PASSES on zod 4.0 through
# 4.3.6 and FAILS from 4.4.0 — so an `any`-typed key becoming required is not a 3 -> 4
# break at all, it is a 4.4.0 break shipped inside a MINOR, and the `zod/v4` subpath that
# the B3 spike recommended as the cheap door is core 4.0.0 and does not reproduce it. A
# tree that had taken that door would have carried the whole change into whichever later
# session ran `npm update`.
#
# WHAT ACTUALLY MOVED ON THE WIRE: 16 output keys and 7 input keys joined `required`.
# Nobody chose either state. Under zod 3 an `any` key was implicitly optional and was
# dropped from `required`; from 4.4.0 it is implicitly required. `schemas.ts` had been
# writing the distinction by hand the whole time — `runtime_assert_scene_structure` is
# the one entry that spells `encodedValue.optional()`, for exactly the two fields its
# handler omits — so the emitted schema now says what the file already meant.
#
# 🔴 WHICH MAKES IT A PROMISE, AND A PROMISE IS WORTH CHECKING AGAINST THE THING THAT
# KEEPS IT. The MCP SDK validates `structuredContent` against `outputSchema` on every
# SUCCESS result, so a required key the engine does not write turns a working tool into a
# thrown error on its happy path — the failure mode `schemas.ts`'s own header warns about,
# now reachable by renaming a dict key in GDScript with nothing else in the tree noticing.
# The join is per-TOOL and not per-file: `"value"` appears thirty times in operations.gd,
# and only the handler that answers `node.get_property` says anything about that tool.
#
# 🔴 WHAT IT DOES NOT PROVE, SAID OUT LOUD (251's second question). This is a PRESENCE
# join: the key is written by the handler that answers the tool. It does not prove the
# write is on every path through that handler — a key emitted inside one arm of a branch
# and forgotten in the other reads as present here.
#
# 🆕 272 — AND THAT SENTENCE WAS TRUE ABOUT A JOIN THAT WAS WEAKER THAN IT SAID. The
# search ran over the handler's whole body, so a type annotation or the tool's own
# `inputSchema:` line satisfied it: **8 of the 16 keys read PRESENT with their real emit
# deleted**, measured by doing exactly that. The right-hand side is `emitted_key_regions`
# now — the constructs a caller actually receives — and the same experiment leaves **0 of
# 16** standing. What the check catches did not change; what it could be fooled by did.
#
# 🔴 THE REACHABILITY HALF IS ANSWERED ELSEWHERE AND IS NOT PRETENDED TO BE ANSWERED HERE.
# 272 measured every one of the sixteen: thirteen of the fifteen handlers have exactly one
# success return, and the two that branch (`_editorsettings_get_set`, the host's
# `runtime_await_condition`) write the key on every arm — so the live defect count is zero
# and this is a tripwire, not a repair. The thing that actually throws is the SDK's
# `validateToolOutput`, and 272 put the runtime plane's probe on a real MCP client so that
# predicate is EXECUTED in CI rather than modelled here. A static branch walker was priced
# against that and refused: it needs a GDScript CFG in a file where every reader is a
# regex, and it false-positives on the `var out := {..}` and loop-built-element idioms
# this tree is written in.
required_any = required_any_output_keys()
tool_methods = tool_bridge_methods()
addon_handlers = addon_handler_bodies()
_host_tool_blocks: "dict[str, str]" = {}
_site_re = re.compile(r'register(?:Task)?Tool\(\s*(?:\w+\s*,\s*)?"([a-z0-9_]+)"')
for _f in sorted(TOOLS.rglob("*.ts")):
    _text = _f.read_text()
    _sites = list(_site_re.finditer(_text))
    for _i, _sm in enumerate(_sites):
        _end = _sites[_i + 1].start() if _i + 1 < len(_sites) else len(_text)
        _host_tool_blocks[_sm.group(1)] = _text[_sm.end(): _end]

_required_any_joined = 0
_emit_regions_read = 0
for _tool in sorted(required_any):
    if _tool not in set(registered_tools()):
        errors.append(
            f"check 29: schemas.ts declares an output schema for {_tool!r}, which no "
            f"`registerTool(..)` registers. Check 11 owns that comparison; it is named here "
            f"because the join below would otherwise report the key as unwritten and send "
            f"the reader to GDScript for a tool that does not exist."
        )
        continue
    _bodies = [addon_handlers[_m][1] for _m in sorted(tool_methods.get(_tool, ()))
               if _m in addon_handlers]
    _bodies.append(_host_tool_blocks.get(_tool, ""))
    # 🆕 272 — the join's right-hand side. See `emitted_key_regions` for why the whole
    # body was the wrong text to search and what deleting each real emit measured.
    _regions = [_r for _b in _bodies for _r in emitted_key_regions(_b)]
    _emit_regions_read += len(_regions)
    if not _regions:
        # 🔴 271's RULE ONE LAYER DOWN: a reader that found nothing has not observed an
        # absence. Say which of the two happened, under the reader's own name.
        errors.append(
            f"check 29 reader: nothing in what answers {_tool} matches an emitting construct "
            f"(`_ok(..)`, `.append(..)`, `var x := {{..}}`, `const x = {{..}}`), so the "
            f"key join below has no right-hand side to search and is NOT reporting that "
            f"{_tool}'s keys are missing — it is reporting that this reader could not "
            f"find where the tool answers. Either the handler returns through a shape "
            f"`EMIT_OPENERS` does not name, in which case add it there with its reason, "
            f"or the dispatch arm no longer resolves and check 1/2 owns that."
        )
        continue
    for _key in sorted(required_any[_tool]):
        _required_any_joined += 1
        if not any(re.search(rf'["\']{re.escape(_key)}["\']\s*:', _r) or
                   re.search(rf"(?<![A-Za-z0-9_]){re.escape(_key)}\s*:", _r) for _r in _regions):
            _where = ", ".join(sorted(tool_methods.get(_tool, ())) or ["no bridge method"])
            # 🆕 272 — THE DECOY CASE GETS ITS OWN SENTENCE, because it asks for a different
            # repair. A key that appears NOWHERE has been renamed or dropped; a key that
            # appears in the body but in nothing the caller receives has been moved OUT of
            # the answer — a `var x: Variant` annotation, a zod `inputSchema:` line, a
            # commented-out return. Eight of the sixteen keys were in exactly that state
            # under a synthetic deletion at 272, so this is the branch that would have been
            # printed for all eight had the old join been able to tell them apart.
            _elsewhere = any(re.search(rf'["\']{re.escape(_key)}["\']\s*:', _b) or
                             re.search(rf"(?<![A-Za-z0-9_]){re.escape(_key)}\s*:", _b)
                             for _b in _bodies)
            if _elsewhere:
                errors.append(
                    f"check 29 decoy: {_tool}'s output schema requires {_key!r} — an "
                    f"`any`-typed key, REQUIRED on the wire from zod 4.4.0 — and the only "
                    f"mentions of it in what answers this tool ({_where}) are OUTSIDE the "
                    f"{len(_regions)} construct(s) a caller receives. A local's type "
                    f"annotation, the tool's own `inputSchema:` line and a commented-out "
                    f"return all read like an emit and are not one; until 272 this join "
                    f"accepted every one of them. The SDK validates `structuredContent` on "
                    f"every SUCCESS result, so the happy path throws. Put the key back in "
                    f"the returned object, or spell `encodedValue.optional()` in schemas.ts "
                    f"the way `runtime_assert_scene_structure` does."
                )
                continue
            errors.append(
                f"check 29: {_tool}'s output schema requires {_key!r} — an `any`-typed key, "
                f"which from zod 4.4.0 is REQUIRED on the wire — and nothing that answers "
                f"this tool writes it ({_where}) into any of the "
                f"{len(_regions)} emitting construct(s) that answer it, or anywhere else in "
                f"its body. The SDK validates `structuredContent` "
                f"against `outputSchema` on every SUCCESS result, so this is not a "
                f"documentation defect: the tool's happy path throws. Either the handler "
                f"stopped emitting the key, or it was renamed on one side of the wire — or "
                f"the field really can be absent, in which case schemas.ts must spell "
                f"`encodedValue.optional()` the way `runtime_assert_scene_structure` does."
            )

# 🔴 HOW MANY `encodedValue.optional()` SPELLINGS `schemas.ts` IS DECLARED TO CARRY.
# A floor-shaped constant, and the shape it pins is a POPULATION rather than a size: the
# two that `runtime_assert_node_state` has carried since `255`, plus the two `270` added
# for `requested` on both `set_property` outputs. See check `29`'s evidence arm for why a
# non-emptiness test could not survive the population growing.
OPTIONAL_ANY_SPELLINGS = 4

# The other direction. `.optional()` is the ONLY thing that keeps an `any` key out of this
# population, so a spelling nobody notices is the whole risk: `encodedValue .optional()`,
# or a wrapper that swallows it, silently re-adds a key to the promise set.
#
# 🔴 THE CLAIM WAS *AT LEAST ONE REMAINS* UNTIL 270, AND GROWING THE POPULATION SILENCED
# ITS OWN CONTROL. `29.nooptional` empties the two spellings in `runtime_assert_node_state`
# and expects this to fire; issue #327's fix added two more for `requested`, so after the
# mutation two survived, the claim held, and the control observed nothing. A non-emptiness
# test cannot notice a deletion while any member is left — which is 269's finding wearing a
# different hat, and the reason this is a DECLARED COUNT now. It is the same idiom the
# rosters in this file already use: name the population, compare it, and make a change to
# it a decision somebody wrote down.
_optional_any = len(re.findall(r"encodedValue\s*\.optional\(\)", SCHEMAS.read_text()))
if _optional_any != OPTIONAL_ANY_SPELLINGS:
    errors.append(
        "check 29 evidence: schemas.ts carries {} `encodedValue.optional()` spelling(s) and "
        "OPTIONAL_ANY_SPELLINGS declares {}. That spelling is the only way the file can say "
        "an `any`-typed field may be ABSENT, and the count is the evidence that the "
        "required/optional split was authored rather than inherited from whichever zod is "
        "installed. Move the constant ON PURPOSE in the commit that moves the file — if the "
        "last one was genuinely deleted, this check's argument needs rewriting rather than "
        "its number adjusting.".format(_optional_any, OPTIONAL_ANY_SPELLINGS)
    )

print(f"Required-any keys      : "
      f"{_required_any_joined} key(s) across {len(required_any)} tool(s) joined to an "
      f"emitter · {_emit_regions_read} emitting construct(s) searched · "
      f"{_optional_any} declared optional · {len(addon_handlers)} handler(s) resolved")
_ran("29")

# --- 30: THE LAUNCHER THAT ANSWERED BEFORE THE THING IT LAUNCHED -----------
#
# 🔴 A TRUE FIELD AT A FALSE TIME, AND NOT ONE GATE IN THIS TREE COULD READ IT. 249 wrote
# the row: `godot_run_project` returned `running: true` the instant `spawn()` handed back a
# pid — measured 566, 2788 and 3213 ms before the game's autoload bound 9081 — and every
# `runtime_*` call inside that window answered *Is the project running?*. It was. The tool
# said so and returned the pid. The field was true, the question was the wrong one, and
# 249 §9 said the unsettling part out loud: every defect it found that session was a
# SENTENCE, and 36,987 lines of gate could read none of them.
#
# This is the reader for the class, and it is a join rather than a roster because the roster
# is what failed: the row named `godot_run_project`, and `godot_run_managed` in a different
# file had the identical defect with nothing in the tree naming it. `game_launcher_tools`
# finds the population by the SPAWN — a block that calls `launchDetached` or `registry.run`
# is a block that produces a process expected to host the runtime bridge — so the twin, and
# the third launcher nobody has written yet, are in the population the day they are written.
#
# Three directions, because there are three ways to lose the answer:
#   • a launcher that does not WAIT — the defect itself, back verbatim;
#   • a launcher that waits and has nowhere to SAY so — the wire silently drops the answer
#     the wait computed, and the caller is back to reading `running`;
#   • `runtime_await_condition` losing its retry — the one waiting tool, which returned in
#     2 ms against `timeout_ms: 15000` because it treated an unbound port as a verdict.
_launchers = game_launcher_tools()
_waiters = readiness_waiting_tools()
_out_keys = output_schema_keys()
_readiness_judged = 0
for _tool in sorted(_launchers):
    _readiness_judged += 1
    if _tool not in _waiters:
        errors.append(
            f"check 30: {_tool} launches a game process and does not call "
            f"`waitForRuntimeBridge`, so it answers before the runtime bridge binds. That "
            f"is `run-project-returns-before-bridge` (249) exactly: the launch reports "
            f"`running: true` while every runtime_* call in the next 0.5–3.2s fails with "
            f"`bridge_unavailable`. `readiness.ts` holds the wait; `peers.ts` has used it "
            f"against real peers since 1.21.0."
        )
        continue
    _missing = [k for k in READINESS_KEYS if k not in _out_keys.get(_tool, set())]
    if _missing:
        errors.append(
            f"check 30: {_tool} waits for the runtime bridge but its output schema in "
            f"schemas.ts declares no {', '.join(_missing)}, so the answer the wait computed "
            f"never reaches the caller. A wait nobody can read is a slower version of the "
            f"defect, not a fix for it."
        )

# The other direction. A schema that promises readiness on a tool that never waits is the
# same lie the other way round, and it is the cheaper mistake to make — a key is copied
# between two entries far more easily than a call is.
for _tool, _keys in sorted(_out_keys.items()):
    if "bridge_ready" in _keys and _tool not in _launchers:
        errors.append(
            f"check 30: {_tool}'s output schema declares `bridge_ready` and its "
            f"registration block launches nothing, so nothing computes the value it "
            f"promises. Either the launch call was removed and this key outlived it, or "
            f"the key was copied from a launcher's entry."
        )

# And the waiting tool's own retry, which is one negated call away from silently gone.
_await_block = host_tool_blocks().get("runtime_await_condition", "")
if "isTransportUnavailable(" not in _await_block:
    errors.append(
        "check 30: runtime_await_condition no longer branches on `isTransportUnavailable`, "
        "so the first `bridge_unavailable` ends its loop again. That is the 2 ms answer to "
        "a 15,000 ms request 249 measured — `deadline` and `sleep(interval)` both sit "
        "downstream of that catch and are never reached. The retry must stay scoped to the "
        "transport code: every other code is the game answering, and retrying an answer "
        "only makes it slower."
    )

print(f"Launcher readiness     : "
      f"{_readiness_judged} launcher(s) judged · {len(_waiters)} waiting · "
      f"{len(READINESS_KEYS)} key(s) required each · await-condition retry present")
_ran("30")

# --- 31: THE RECIPE THAT NAMED A TOOL THE READER'S INSTALL DOES NOT HAVE ----
#
# 🔴 MEASURED AT 261 BY BEING THE READER. The published 1.76.0 was installed from the
# registry into a fresh project and driven as an MCP client; the default surface is 279
# tools, and §10's four worked recipes named five that are not in it. Recipe D's only
# step is `godot_run_headless_script`; recipe C's step 1 is `godot_run_managed`. Both
# were unrunnable by anyone following the guide as written, and the guide's own §7
# already carried a warning naming three of the five — written before the recipes
# existed, never joined to them, and therefore stale the day recipe C was added.
#
# 🔴 THE FAILURE IS TWO LISTS THAT WERE NEVER THE SAME LIST (252's shape, one document
# further out). One list is the capability roster in `capabilities.ts`; the other is
# whatever a recipe happened to name. Nothing compared them, so the recipes drifted from
# the surface silently — the reader is the only instrument that was ever pointed at it,
# and the reader is the user.
#
# Four directions:
#   • a STEP naming a privileged tool without `(higher-trust)` on the line — the reader
#     is told to run something the server will not answer, in the section whose entire
#     purpose is to be followed literally;
#   • a STEP naming a privileged tool the section's own declaration block omits — the
#     §7 failure exactly, reproduced one section down;
#   • a declaration naming a tool no step uses, or one that is not privileged at all —
#     the list going stale in the other direction, which is how it reads as maintained;
#   • a backticked name in a tool family that resolves to no registered tool — a renamed
#     or mistyped tool in a recipe, which the reader discovers as a validation error.
_recipe_tools = guide_recipe_tools()
_priv_named = privileged_tools()
_known_tools = set(registered_tools())
_recipe_steps_judged = 0
for _tool, _row in sorted(_recipe_tools.items()):
    _steps = _row["steps"]
    _recipe_steps_judged += len(_steps)
    if _tool not in _known_tools:
        errors.append(
            f"check 31: docs/USER_GUIDE.md names `{_tool}` in a §7/§10/§11 step "
            f"(line{'s' if len(_steps) > 1 else ''} "
            f"{', '.join(str(n) for n, _s, _m in _steps) or '—'}) and no such tool is "
            f"registered. It shares a family with tools that are, so this is a rename or "
            f"a typo, and the reader finds it as an input-validation error mid-recipe."
        )
        continue
    if _tool not in _priv_named:
        if _row["declared"]:
            errors.append(
                f"check 31: docs/USER_GUIDE.md's §10 higher-trust declaration names "
                f"`{_tool}`, which carries no capability group in capabilities.ts. A "
                f"declaration that withholds a tool nobody withholds sends the reader to "
                f"`--trust full` for something they already have."
            )
        continue
    for _section in sorted({_s for _n, _s, _m in _steps}):
        _in_section = [(_n, _m) for _n, _s, _m in _steps if _s == _section]
        if not any(_m for _n, _m in _in_section):
            errors.append(
                f"check 31: docs/USER_GUIDE.md §{_section} names `{_tool}` as a step "
                f"(line{'s' if len(_in_section) > 1 else ''} "
                f"{', '.join(str(n) for n, _m in _in_section)}) and never marks it "
                f"`(higher-trust)` in that section. It is in the `code-execution` group, "
                f"so a default install does not load it and the step cannot be run as "
                f"written."
            )
    if _steps and not _row["declared"]:
        errors.append(
            f"check 31: `{_tool}` is named by a §7/§10/§11 step and is missing from the "
            f"section's higher-trust declaration block. That block is the list a reader "
            f"acts on before starting, and a recipe naming a privileged tool the block "
            f"omits is 261's defect returning."
        )
for _tool, _row in sorted(_recipe_tools.items()):
    if _row["declared"] and not _row["steps"]:
        errors.append(
            f"check 31: docs/USER_GUIDE.md's §10 higher-trust declaration names `{_tool}` "
            f"and no step in §7, §10 or §11 uses it. The declaration exists to warn about the "
            f"steps below it; an entry with no step behind it is the list going stale in "
            f"the direction that still reads as maintained."
        )

print(f"Guide recipes          : "
      f"{len(_recipe_tools)} tool(s) named across §7/§10/§11 · {_recipe_steps_judged} step "
      f"mention(s) judged · "
      f"{len([t for t in _recipe_tools if t in _priv_named])} higher-trust")
_ran("31")

DAP_LEDGER_FILE = ROOT / "docs/dap_capability_ledger.json"
DAP_CAPS_READ_RE = re.compile(r"capabilities(?:\?)?(?:\.)?\[\"([A-Za-z]+)\"\]")
DAP_MODIFIER_CAPS_RE = re.compile(
    r"BREAKPOINT_MODIFIER_CAPS[^=]*=\s*\{([^}]*)\}", re.S)


def dap_capability_gates(root: Path = ROOT) -> "set[str]":
    """Every adapter capability name `host/src` GATES A SHIPPED BEHAVIOUR ON, derived.

    🔴 THE POPULATION IS THE WHOLE POINT AND IT MUST NOT BE A LIST. The typed list this
    replaces lived in `gdscript-dap-plane.integration.mjs`, described itself as *the gates
    the host reads*, and was wrong in BOTH directions: it named `supportsTerminateRequest`,
    which `host/src` reads nowhere, and omitted `supportsConfigurationDoneRequest`, which
    it does — so the count it printed included one thing that is not a gate and could not
    include one that is. 276's finding, in the file that measures a live engine.

    Two spellings, because there are two: a direct subscript of `capabilities`, and the
    three reached indirectly through `BREAKPOINT_MODIFIER_CAPS`, whose VALUES are
    capability names and whose keys are wire fields. A reader that took only the first
    would miss exactly the three modifiers this session found dead.
    """
    names: "set[str]" = set()
    for path in sorted((root / "host/src").rglob("*.ts")):
        text = path.read_text()
        names.update(DAP_CAPS_READ_RE.findall(text))
        for m in DAP_MODIFIER_CAPS_RE.finditer(text):
            names.update(re.findall(r":\s*\"([A-Za-z]+)\"", m.group(1)))
    return names


def dap_ledger_arms(ledger: dict) -> "dict[str, dict]":
    """The per-engine-arm readings, as their own enumerator rather than a subscript.

    🔴 A SUBSCRIPT IS NOT A POPULATION AND `scope_gate.py` REFUSED THE FIRST DRAFT FOR IT.
    `dap.ledger_arms_read` was floored off `ledger["observed"]` read inline, so no blind in
    the sweep could collapse it — `SCOPE_GATE_LEDGER_REACH`, a floor never tested against
    the collapse it names. One line of reader, and the floor can fail.
    """
    return ledger.get("observed", {})


def dap_ledger_problems(gates: "set[str]", ledger: dict,
                        tools_text: str, probe_text: str) -> "tuple[list[str], int]":
    """(problems, JOINS ACTUALLY COMPARED) over `docs/dap_capability_ledger.json`.

    🔴 THE SECOND HALF IS NOT DECORATION AND `scope_gate.py` IS WHY. The first draft
    returned problems alone, and blinding it to `[]` left check 33 GREEN — of course it
    did: a reader whose only output is *what went wrong* says nothing when it is not
    called, and on a healthy tree that is indistinguishable from saying nothing when it
    is. `SCOPE_GATE_BLIND dap_ledger_problems -> []: the run is STILL GREEN`, on the run
    that added it. So the reader counts its own work and `dap.ledger_joins_read` floors
    it: 172 §6's one-number-per-population, and the only shape that makes a
    problem-reporter's absence observable on a tree with no problems in it.
    """
    out: "list[str]" = []
    joins = 0
    declared = set(ledger.get("gated_on", []))
    joins += len(gates | declared)
    for name in sorted(gates - declared):
        out.append(
            f"`{name}` is read off `capabilities` in host/src and is NOT in the ledger's "
            f"`gated_on`. A capability the host gates on and nothing has ever observed is "
            f"the state this ledger exists to end — add it, with `unread` on every arm "
            f"until a run reads it")
    for name in sorted(declared - gates):
        out.append(
            f"the ledger's `gated_on` names `{name}` and nothing in host/src gates on it. "
            f"A ledger row for a capability no shipped behaviour reads is the stale half "
            f"of the same defect — put it in `observed_beside_the_gates` or delete it")
    arms = dap_ledger_arms(ledger)
    if not arms:
        out.append("the ledger records no arm at all — `observed` is empty, and a ledger "
                   "with no reading is a claim about nothing (274)")
    for arm, row in sorted(arms.items()):
        joins += len(declared | set(row))
        missing, extra = declared - set(row), set(row) - declared
        if missing:
            out.append(f"arm {arm!r} has no reading for {sorted(missing)} — an arm short a "
                       f"key reads as agreement with every other arm on a key it never had")
        if extra:
            out.append(f"arm {arm!r} records {sorted(extra)}, which is not in `gated_on`")
    prov = ledger.get("read_from", {})
    joins += 4
    for field in ("workflow", "run", "commit", "read_on"):
        if not str(prov.get(field, "")).strip():
            out.append(f"the ledger's provenance carries no {field!r}. A number that names "
                       f"no tree is a claim about nothing (274) — and this one names a RUN, "
                       f"because the reading exists on CI and nowhere else")
    dead = ledger.get("dead_surface", {})
    says = str(dead.get("says", "")).strip()
    if not says:
        out.append("`dead_surface.says` is empty, so nothing joins the measurement to the "
                   "descriptions and the say-so half of this check cannot fail")
    for entry in dead.get("surfaces", []):
        joins += 1
        surface, cap = entry.get("surface", ""), entry.get("capability", "")
        seen = {arm: row.get(cap) for arm, row in sorted(arms.items())}
        if any(v == "unread" for v in seen.values()):
            out.append(
                f"DEAD_UNREAD `{surface}` is listed as dead surface on account of `{cap}`, which is "
                f"`unread` on {[a for a, v in seen.items() if v == 'unread']}. NOT KNOWING "
                f"IS NOT THE SAME AS ABSENT (271) — a surface cannot be called dead on a "
                f"reading nobody has taken")
        elif any(v != "absent" for v in seen.values()):
            out.append(
                f"DEAD_ALIVE `{surface}` is listed as dead surface and `{cap}` is observed "
                f"{ {a: v for a, v in seen.items() if v != 'absent'} } — a capability that "
                f"came ALIVE on a build. That is the good news this ledger was built to "
                f"deliver: retire the row and take the sentence back out of the description")
        elif says and says not in _dap_surface_text(surface, tools_text):
            out.append(
                f"DEAD_SILENT `{surface}` is dead on every arm and its own description does not say so. "
                f"The ledger's sentence is {says!r} and a caller reads the description "
                f"BEFORE choosing — that is the half 278 was asked to ship")
    if "dap_capability_ledger.json" not in probe_text:
        out.append("gdscript-dap-plane.integration.mjs does not read the ledger, so nothing "
                   "on a live engine can contradict it — the only falsifier this file has "
                   "runs there")
    return out, joins


def _dap_surface_text(surface: str, tools_text: str) -> str:
    """The description a caller sees for one tool, or for one parameter of one tool.

    A parameter's `.describe(..)` and its tool's `description:` are different strings in
    the same block, and the say-so has to land on the one the caller is reading when they
    choose that surface — so a parameter is sliced to its own `.describe(..)` line.

    🔴 ADJACENT LITERALS ARE JOINED FIRST, AND THE CHECK REFUSED ITS OWN AUTHOR WITHOUT
    IT. These descriptions are written as `"…this " + "project tests…"` across a line
    break, so the sentence a caller reads does not occur anywhere in the source that
    produces it — the first draft of check 33 reported two surfaces as silent whose
    descriptions said exactly what it wanted, and would have gone on reporting any
    sentence that happened to land on a wrap. The atom is the STRING, never its layout.
    """
    m = re.search(rf"registerTool\(\s*\"{re.escape(surface)}\"", tools_text)
    if m:
        brace = tools_text.index("{", m.end())
        region = tools_text[brace:_match_braces(tools_text, brace)]
    else:
        m = re.search(rf"(?m)^\s+{re.escape(surface)}:\s*z\..*$", tools_text)
        region = m.group(0) if m else ""
    return re.sub(r"\"\s*\+\s*\"", "", region)


# --- 32: THE BRANCHES THAT ANSWERED TO ENGLISH -----------------------------
#
# 🔴 268 — `dap-timeout-predicate-reads-prose`, and the row named two of the three sites.
# Both DAP tool layers carried `err instanceof DapError && /timed out after/.test
# err.message`, so which sentence `dbg_evaluate` and `dbg_set_variable` returned was
# chosen by a regex over a message body. 267 found it while giving the class a `remedy`
# field, declined to reword those messages for exactly that reason, and asserted the
# wording instead — a test defending a defect rather than a behaviour.
#
# 🔴 AND IT WAS NEVER ONLY A HAZARD. The same regex matched the ADAPTER'S OWN words at
# the relay site, so an adapter answering `setVariable` with a failure that mentioned its
# own inner deadline was told by this host that Godot's debug adapter does not implement
# setVariable — a measured claim about a different build, invented over a reply that had
# arrived. Three tests drive it and all three go red against the predicate this release
# removed.
#
# 🔴 THE THIRD SITE WAS NOT IN THE ROW, AND IT HAD A HUNDRED TIMES THE BLAST RADIUS.
# `timeout-caveat.ts` decided whether all 198 mutating tools warn that a timed-out change
# MAY ALREADY HAVE LANDED by matching the literal `Bridge error [timeout]`, spelled out
# in that file, one file from the template that builds it and two from the code it
# embeds. A reword of `fail` would have ended the warning everywhere in silence. It was
# found by asking the question of the whole tree rather than of the two files the row
# happened to name — 267 §1's own rule, turned on 267's own row.
#
# Three directions:
#   • a predicate matching a `.message` — the class itself, whose population is empty
#     after 268 and must stay so;
#   • a raise site whose message says it timed out and carries no timeout CODE, or a code
#     over a message that no longer says it — the join in both directions, so the fourth
#     plane somebody adds cannot drop the discriminator in silence;
#   • the rendered bridge label spelled outside the one module that builds it.
#
# 🆕 269 — A FOURTH DIRECTION, AND IT IS THE SAME CLASS ONE LEVEL OUT: ONE CODE, ONE
# PRODUCER. 268 measured `write_failed` reachable in `bridge.ts` and found, in the same
# breath, that `operations.gd` had been raising the word all along for a file it could
# not open. Both cross this wire as `Bridge error [write_failed]`, because the relay site
# re-raises the addon's code verbatim — so the two failures were indistinguishable to any
# caller branching on the label, and `error_remedies.gd` answered both of them with
# *check the target path is inside the project and not read-only*, which is a next action
# for one of them and a wrong turn for the other.
#
# 🔴 THE POPULATION WAS MEASURED BEFORE THE REPAIR WAS CHOSEN, AND IT WAS ONE. Eleven
# host-origin codes, fifty in the addon, one word in common. That is what licensed a
# RENAME — `send_failed`, on the younger producer, whose sentence was one release old and
# had shipped node's own prose before that — instead of an origin discriminator on every
# error the wire carries. A family would have wanted the field; a single collision wants
# the word fixed and a reader that keeps the answer at one.
#
# 🔴 AND IT IS CHECK 23's BLIND SPOT NAMED FROM THE OTHER SIDE. That check compares the
# addon's vocabulary to the codes TypeScript BRANCHES on, in both directions, and has
# never asked what the host RAISES — so the one set difference that could catch this was
# the one nobody had taken.
_prose_problems, _message_reads, _error_raises = error_prose_predicates()
for _p in _prose_problems:
    errors.append(f"check 32: {_p}")

_host_origin_codes = host_origin_error_codes()
for _code in sorted(_host_origin_codes & addon_err_codes):
    errors.append(
        f"check 32: one code, two producers — {_code!r} is raised BOTH by the host "
        f"and by an `_err(..)` in "
        f"addons/breakpoint_mcp/. Both cross the wire as `{_code}` — the relay site "
        f"re-raises the addon's code verbatim — so a caller branching on it cannot tell "
        f"the two failures apart, and `error_remedies.gd` can answer only one of them. "
        f"269 renamed the host's `write_failed` to `send_failed` for exactly this; rename "
        f"the younger producer, do not add a second meaning to a shipped word."
    )

print(f"Error-code discipline  : "
      f"{_message_reads} message read(s) scanned · {_error_raises} raise site(s) judged · "
      f"{len(_host_origin_codes)} host-origin code(s) vs {len(addon_err_codes)} addon · "
      f"{len(_prose_problems)} problem(s)")
_ran("32")


# --- 33: WHAT A REAL ADAPTER ACTUALLY ADVERTISED ---------------------------
#
# 🔴 276 FOUND IT AND 278 MEASURED IT: `dap-capability-dead-surface`. Three GDScript
# debugging tools refuse as unsupported on every Godot build this repository has ever
# described, and until now nothing in this tree RECORDED the capability set of a real
# adapter. The integration gate asserts a BICONDITIONAL — advertised implies it answers,
# unadvertised implies it refuses by reason — which is true on either side of the
# question, so eleven families of green said nothing about which side Godot is on.
#
# 🔴 AND THE MEASUREMENT IS WIDER THAN THE ROW. Read out of the post-merge integration
# run at `0be54af`, both arms green: 4.3-stable and 4.7-stable advertise an IDENTICAL
# set. The dead surface is SIX callable things, not three — the three tools, plus the
# `conditions` / `hit_conditions` / `log_messages` modifiers on `dbg_set_breakpoints`,
# which that run reports dropped on both arms.
#
# 🔴 THE TYPED LIST THAT STOOD IN FOR THIS WAS WRONG IN BOTH DIRECTIONS, which is why
# `dap_capability_gates` derives the population and this check joins it to the ledger
# rather than to a roster. It named `supportsTerminateRequest`, which host/src gates on
# nothing, and omitted `supportsConfigurationDoneRequest`, which it does — so the live
# gate's own message said *3 gate(s) the host reads* about two gates and one bystander,
# and the one capability that had never been observed was the one nobody could see was
# missing. 276's finding-to-carry, arriving in the row 276 opened.
#
# Five directions, and the interesting two are the ones that fire on GOOD news:
#   • the population, host/src <-> `gated_on`, both ways;
#   • every arm carries a reading for every gated capability — an arm short a key agrees
#     with every other arm about a key it never had;
#   • provenance: the workflow, the RUN and the commit the reading came from, because
#     this evidence exists on CI and nowhere else and a number that names no tree is a
#     claim about nothing (274);
#   • a surface may not be called dead on an `unread` capability — not knowing is not the
#     same as absent (271);
#   • a surface called dead whose capability is observed PRESENT on some build, and a
#     surface dead on every arm whose description does not say so. The first is a
#     capability coming alive, which is what this ledger was built to catch; the second
#     is the say-so half — a caller reads the description before choosing, and until 278
#     the one description that named a version named 4.3 as the example, which read as
#     though a newer build had filters. None does.
_dap_gates = dap_capability_gates()
_dap_ledger = json.loads(DAP_LEDGER_FILE.read_text()) if DAP_LEDGER_FILE.exists() else {}
_dap_probe_text = (ROOT / "host/test-integration/gdscript-dap-plane.integration.mjs").read_text()
_dap_problems, _dap_joins = dap_ledger_problems(
    _dap_gates, _dap_ledger, (HOST_SRC / "tools/dap.ts").read_text(), _dap_probe_text)
# 🔴 THE THREE DEAD-SURFACE VERDICTS GET THEIR OWN APPEND STATEMENTS, and the reason is
# `control_gate.py` rather than taste: a control's fingerprint is matched against the
# STRING CONSTANTS under an `errors.append`, so three classes funnelled through one
# `f"check 33: {p}"` are one statement and cannot be told apart by three controls. The
# prose stays in the reader, where it is testable; the discriminator lives here, where it
# is addressable. Found on the first run of the controls that prove this check.
for _p in _dap_problems:
    if _p.startswith("DEAD_SILENT "):
        errors.append(f"check 33: a dead surface whose own description does not say so — "
                      f"{_p[len('DEAD_SILENT '):]}")
    elif _p.startswith("DEAD_ALIVE "):
        errors.append(f"check 33: a capability came ALIVE on a build — "
                      f"{_p[len('DEAD_ALIVE '):]}")
    elif _p.startswith("DEAD_UNREAD "):
        errors.append(f"check 33: NOT KNOWING IS NOT THE SAME AS ABSENT — "
                      f"{_p[len('DEAD_UNREAD '):]}")
    else:
        errors.append(f"check 33: {_p}")

_dap_arms = dap_ledger_arms(_dap_ledger)
_dap_dead = _dap_ledger.get("dead_surface", {}).get("surfaces", [])
print(f"DAP capability ledger  : "
      f"{len(_dap_gates)} gated capabilit(y/ies) derived from host/src · "
      f"{len(_dap_arms)} arm(s) read · {len(_dap_dead)} dead surface(s) · "
      f"{_dap_joins} join(s) compared · {len(_dap_problems)} problem(s)")
_ran("33")

# --- 34: THE ONE PLACE A NODE JOINS THE EDITED SCENE ------------------------
#
# 🔴 MEASURED AT 283 BY BEING THE USER, ON A LIVE GODOT 4.7. Every one of the twenty-two
# authoring tools that creates a node called `add_child` with `force_readable_name` left
# at Godot's default of false, so the engine answered ANY name collision with the machine
# form `@Type@N`. `node_add {name: "SFX"}` twice returned "SFX" and then
# "@AudioStreamPlayer3D@19825" — no error, no flag, and the caller's next call addressing
# "SFX" got `bad_path`. `node_duplicate` had no non-colliding case at all: a duplicate
# always collides with its source, so `@Label@19826` was that tool's ONLY behaviour.
#
# 🔴 A ROSTER OF THE TWENTY-TWO WOULD BE THE DEFECT AGAIN (282 §2.3). Nobody passed the
# flag because nobody knew to, and a list of sites-to-fix is a list somebody has to keep
# true. The population is instead collapsed to ONE: `_commit_add` is the only place this
# file registers an `add_child` into an undo action, and a twenty-third authoring tool is
# covered by using the seam rather than by being remembered.
#
# 🔵 AND THE FLAG IS ASSERTED, NOT JUST THE SINGULARITY. One site that passes nothing is
# exactly the tree this check was written to refuse — it would simply have all
# twenty-two defects behind one call instead of twenty-two.
_OPS_GD = ROOT / "addons/breakpoint_mcp/operations.gd"
_RT_GD = ROOT / "addons/breakpoint_mcp/runtime_bridge.gd"
_add_child_sites = re.findall(
    r'^\s*ur\.add_do_method\([^,]+,\s*"add_child"(?P<rest>[^\n]*)$',
    _OPS_GD.read_text(), re.M,
)
# 🔴 THE RUNTIME PLANE IS THE SECOND CALL SITE, AND IT IS THE ONE THIS CHECK WOULD HAVE
# MISSED (1.42.0's rule, paid again at 282 §11.1). `runtime_node_add` had the identical
# defect and was WORSE: its reply carried `path` and `type` and no `name` at all, so a
# caller could not even see that the name had been replaced. A check that reads one
# plane licenses the other.
_rt_add_child = re.findall(r'^\s*\w+\.add_child\((?P<args>[^\n]*)$', _RT_GD.read_text(), re.M)
for _call in _rt_add_child:
    if "true" not in _call:
        errors.append(
            f"check 34: runtime_bridge.gd calls `add_child({_call.rstrip()}` without "
            f"`force_readable_name = true`. The runtime plane authors nodes into a LIVE "
            f"scene tree and collides exactly the same way the editor plane did; a caller "
            f"that asks twice for one name gets `@Type@N` and cannot address it."
        )
if len(_add_child_sites) != 1:
    errors.append(
        f"check 34: operations.gd registers `add_child` into an undo action at "
        f"{len(_add_child_sites)} site(s); the seam `_commit_add` must be the only one. "
        f"A second site is an authoring tool that does not get "
        f"`force_readable_name`, which is 283 §1's defect returning: the engine renames "
        f"the caller's node to `@Type@N` on any collision and nothing says so."
    )
elif "true" not in _add_child_sites[0]:
    errors.append(
        "check 34: operations.gd's single `add_child` registration does not pass "
        "`force_readable_name = true`. Godot's default answers a name collision with the "
        "machine form `@Type@N`; the editor's own Add Node passes true and answers "
        "`SFX2`. One site with the flag missing is all twenty-two tools defective again."
    )
_commit_add_callers = len(re.findall(r"_commit_add\(", _OPS_GD.read_text())) - 1
print(f"Node naming seam       : "
      f"{len(_add_child_sites)} add_child registration(s) · "
      f"{_commit_add_callers} authoring tool(s) through the seam · "
      f"{len(_rt_add_child)} runtime-plane call(s) · readable names asserted on both planes")
_ran("34")


# --- 35: THE ONE PLACE A RESOURCE REACHES DISK -----------------------------
#
# 🔴 MEASURED AT 284 BY BEING THE USER, ON A LIVE GODOT 4.7, AND IT IS 283 §1 ONE AXIS
# OVER WITH A WORSE ANSWER. 283 found a name collision answered by inventing `@Type@N`.
# Here the collision is a FILE and the answer was DELETION. Nine resources were created,
# a sentinel line appended to each on disk, and each tool called a SECOND time with
# identical arguments: nine sentinels gone, nine replies reading `created` / `saved` /
# `packed` in exactly the shape they read the first time. `resource_create` reset an
# Environment somebody had configured, then turned it into a StandardMaterial3D when
# asked for one at the same path. `scene_new` replaced a scene on disk while the editor
# still held the old one in memory.
#
# 🔴 AND THE PRODUCT HELD FOUR ANSWERS TO ONE QUESTION. `filesystem_move` refused
# `exists` with no way to force; the seven scaffold tools under `_mp_write_script`
# refused `exists` unless `overwrite`; `filesystem_create_dir` reported `existed`; the
# other nineteen destroyed silently. The seven that were right were right because they
# share a SEAM. This check makes `_commit_save` the same kind of fact for the
# twenty-four `ResourceSaver.save` sites, which were a roster in exactly 282 §2.3's
# sense — nobody wrote the check because nobody had counted the population.
#
# 🔵 AND THE SINGULARITY ALONE IS NOT THE CLAIM. One site that never asks whether the
# destination is taken is the tree this check exists to refuse: it would hold all
# nineteen defects behind one call instead of nineteen. So the seam's own body is read
# for the existence test and for both kinds, which is what makes `SAVE_NEW` mean
# something.
_ops_src = _OPS_GD.read_text()
_save_sites = re.findall(r'^\s*var \w+ := ResourceSaver\.save\(', _ops_src, re.M)
_save_sites += re.findall(r'^\s*\w+ = ResourceSaver\.save\(', _ops_src, re.M)
if len(_save_sites) != 1:
    errors.append(
        f"check 35: operations.gd writes a resource to disk at {len(_save_sites)} "
        f"site(s); the seam `_commit_save` must be the only one. A second site is a tool "
        f"that does not ask whether the destination is taken, which is 284's defect "
        f"returning: it destroys the file that was there and answers exactly as it "
        f"answers a fresh create."
    )
_seam_body = re.search(
    r"func _commit_save\(.*?\n(?=\n\n)", _ops_src, re.S)
if _seam_body is None:
    errors.append(
        "check 35: `_commit_save` is not in operations.gd. Nineteen tools took a "
        "destination path and nothing asked whether it was occupied; the seam is what "
        "makes that one question instead of nineteen."
    )
else:
    _body = _seam_body.group(0)
    if "FileAccess.file_exists" not in _body:
        errors.append(
            "check 35: `_commit_save` never asks whether the destination exists. The "
            "seam without the question is the roster without the fix — one call site "
            "holding all nineteen defects."
        )
    if "SAVE_NEW" not in _body or "overwrite" not in _body:
        errors.append(
            "check 35: `_commit_save` does not gate a SAVE_NEW write on `overwrite`. "
            "A destination the caller named is somebody else's file until they say "
            "otherwise; a save-back to the resource's own home is the operation itself."
        )
    if '"replaced"' not in _body:
        errors.append(
            "check 35: `_commit_save` does not report `replaced`. *I created a file* and "
            "*I overwrote your file because you asked me to* are not the same sentence, "
            "and 1.82.0's `coerced`/`requested` is the convention for saying so."
        )
# 🔵 THE KINDS ARE COUNTED AND BOTH MUST BE LIVE. A tree where every site is SAVE_BACK
# passes the singularity test and gates nothing; one where every site is SAVE_NEW has
# broken every `*_set_property` tool on the surface.
_new_sites = len(re.findall(r"_commit_save\([^\n]*SAVE_NEW", _ops_src))
_back_sites = len(re.findall(r"_commit_save\([^\n]*SAVE_BACK", _ops_src))
if _new_sites < 1 or _back_sites < 1:
    errors.append(
        f"check 35: the seam is called with SAVE_NEW {_new_sites} time(s) and SAVE_BACK "
        f"{_back_sites} time(s), and both must be live. All-SAVE_BACK passes the "
        f"singularity test while gating nothing; all-SAVE_NEW refuses every tool whose "
        f"job is to write a resource back to its own path."
    )
print(f"Resource save seam     : "
      f"{len(_save_sites)} ResourceSaver.save site(s) · "
      f"{_new_sites} destination write(s) gated on `overwrite` · "
      f"{_back_sites} save-back(s) · `replaced` reported")
_ran("35")


# --- 24: ONE WORD, TWO MEANINGS — AND THE COPIES NOBODY COMPARED ------------
#
# 192 §5 bound ONE branch to ONE handler: for each TypeScript branch, does the handler it
# guards actually raise the code? That is the FORWARD direction, and it is now guarded.
#
# 🔴 THE REVERSE DIRECTION IS THE ONE NOTHING ASKED. 53 codes are raised and the host has
# an opinion about ONE of them. 192 §9.2 handed the question over as a product question --
# "is any of those a refusal the host should be making?" -- and measuring it first turned
# the question into a sharper one, which is the third session running that measuring first
# has done that.
#
# `unsupported` is raised at 8 sites, and they are not one population. They split by what
# the GUARD CONDITION TESTS, and the split is total -- four and four:
#
#   CAPABILITY   the guard reads only engine/editor globals -- has_method(..), a null
#                EditorInterface accessor. The answer is "this Godot build cannot".
#                  _main_screen_get  _main_screen_set  _scene_close  _editorsettings_get_set
#
#   SHAPE        the guard reads the NODE THE CALLER NAMED, always after a `bad_path`
#                check on that same node has already passed. The answer is "the node you
#                picked is the wrong kind" -- which is what `bad_type` says at 47 other
#                sites in this same file.
#                  _particles_set_texture  _shadermaterial_create
#                  _shadermaterial_set_shader  _shadermaterial_set_param
#
# 🔴 THE HOST'S ONE BRANCH RENDERS `unsupported` AS A GODOT VERSION MESSAGE.
# `tabletop.ts` answers "closing a scene requires Godot 4.4+". That is correct today only
# because the binding pins it to `_scene_close`, which is capability-kind. Bind that same
# branch to a shape-kind handler and the host tells a caller to upgrade Godot when the fix
# is to pick a node with a material slot.
#
# 🔴 AND THE CODES ARE NOT RENAMED HERE, DELIBERATELY. `docs/TOOL_CATALOG.md` says
# "degrades to a clear `unsupported`" twice, for exactly the shape sites. That is a
# documented choice on a shipped surface, so it is steered rather than corrected in
# passing. What this check does is make the two populations COUNTABLE and the host rule
# that depends on the difference ASSERTED, so a future rename is a decision somebody takes
# rather than a drift nobody sees.
#
# The classifier is DERIVED, not rostered (189 §12.24's reason, carried): a roster of
# (site, kind) pairs that trips nothing goes stale on arrival. The derivation is floored
# instead, so classifying nothing is a collapse rather than a silence.
_CAPABILITY_PROBE_RE = re.compile(
    r"\b(?:has_method|has_signal|has_feature|class_exists|get_editor_settings|"
    r"_main_screen_root|get_editor_main_screen)\b"
)
_UNSUP_RE = re.compile(r'_err\(\s*"unsupported"')

unsupported_kinds: "dict[str, list[tuple[str, str, int]]]" = {"capability": [], "shape": []}
_unsup_unclassified: "list[tuple[str, int, str]]" = []
_unsup_detail: "dict[tuple[str, int], dict]" = {}
for _name, _src in _GD_SRC.items():
    _lines = _src.split("\n")
    _fn = "<file scope>"
    for _i, _ln in enumerate(_lines):
        _fm = re.match(r"^func\s+(\w+)", _ln)
        if _fm:
            _fn = _fm.group(1)
        if not _UNSUP_RE.search(_ln):
            continue
        # The guard is the nearest `if`/`elif` at or above the raise. Four lines covers
        # every site in the tree; a widened window that started swallowing the PREVIOUS
        # guard would move a site between kinds, and both kind counts are floored below.
        _guard = ""
        for _cand in reversed(_lines[max(0, _i - 4):_i + 1]):
            if re.match(r"\s*(?:el)?if\b", _cand):
                _guard = _cand
                break
        if not _guard:
            _unsup_unclassified.append((_name, _i + 1, "no enclosing `if` within 4 lines"))
            continue
        # 🔴 THE GUARD LINE ALONE IS NOT THE CONDITION, AND THE FLOOR CAUGHT THAT ON THE
        # FIRST RUN — `xlang.unsupported_capability: 3 < floor 4`, 192 §4's finding one
        # check later. `_editorsettings_get_set` reads
        #
        #     var es := EditorInterface.get_editor_settings()
        #     if es == null:
        #
        # so the probe is on the line ABOVE and the guard tests a local that stands for it.
        # Widening to "any capability token anywhere in the window" would fix the count and
        # break the rule: an unrelated preceding guard would drag a shape site across. So
        # the IDENTIFIER the guard tests is resolved to its assignment instead, and only
        # that assignment is read. `if prop == "":` resolves to `_material_prop(node)` and
        # stays SHAPE; `if es == null:` resolves to `get_editor_settings()` and is
        # CAPABILITY. One hop, because one hop is what the tree uses.
        _probe_text = _guard
        _ident = re.match(r"\s*(?:el)?if\s+(?:not\s+)?\(?\s*([A-Za-z_]\w*)\s*(?:==|!=|\bis\b|\))", _guard)
        if _ident and not _CAPABILITY_PROBE_RE.search(_guard):
            _assign = re.search(
                rf"^\s*var\s+{re.escape(_ident.group(1))}\s*:?=\s*(.+)$",
                "\n".join(_lines[max(0, _i - 4):_i + 1]),
                re.M,
            )
            if _assign:
                _probe_text = _guard + "\n" + _assign.group(1)
        _kind = "capability" if _CAPABILITY_PROBE_RE.search(_probe_text) else "shape"
        unsupported_kinds[_kind].append((_fn, _name, _i + 1))
        # 24c reads the same three things this loop already computed, so the message rule
        # and the kind rule are judged against ONE derivation rather than two that can
        # disagree. Keyed by (file, line) so the tuple shape above -- which `_cap_funcs`
        # and `_shape_funcs` unpack -- does not move.
        _unsup_detail[(_name, _i + 1)] = {
            "fn": _fn, "kind": _kind, "guard": _guard, "probe": _probe_text, "raise": _ln,
        }

for _name, _line, _why in _unsup_unclassified:
    errors.append(
        f"{_name}:{_line} raises 'unsupported' and this check cannot tell which kind it is "
        f"({_why}). A site the classifier cannot read is a site the host rule below cannot "
        f"protect — give it an enclosing `if`, or give the classifier a reason to see it."
    )

# 🔴 THE HOST RULE THE SPLIT MAKES ASSERTABLE, AND IT IS 192'S BINDING RUN BACKWARDS. A
# branch whose user-facing message cites a Godot version is telling the caller to upgrade
# the engine. That sentence is true only if the handler the branch is BOUND to fails for a
# capability reason. The binding says which handler; this says the message must match that
# handler's kind.
_VERSION_CLAIM_RE = re.compile(r"Godot\s+\d+\.\d+\+|requires\s+Godot", re.I)
_cap_funcs = {fn for fn, _, _ in unsupported_kinds["capability"]}
_shape_funcs = {fn for fn, _, _ in unsupported_kinds["shape"]}
kind_checked_branches = 0
for _method, _code, _rel in err_branch_bindings:
    if _code != "unsupported" or gd_handler_codes.get(_method) is None:
        continue
    _t = (ROOT / _rel).read_text()
    _m = re.search(re.escape(f'code === "{_code}"') + r"[\s\S]{0,900}?`([^`]*)`", _t)
    if not _m or not _VERSION_CLAIM_RE.search(_m.group(1)):
        continue
    kind_checked_branches += 1
    # Which GDScript functions does this dispatch arm reach, transitively? The SAME closure
    # the binding already walks — one predicate, one definition (190 §4). `_codes_of`
    # populates `seen` as it recurses, so the walk is reused rather than re-implemented.
    _reached: "set[str]" = set()
    for _arm in re.finditer(r'^\t\t"' + re.escape(_method) + r'":\n((?:\t\t\t.*\n)+)', _GD_ALL, re.M):
        for _callee in re.findall(r"\b(_\w+)\(", _arm.group(1)):
            _seen: "set[str]" = set()
            _codes_of(_callee, _seen)
            _reached |= _seen
    if not (_reached & _cap_funcs):
        _hit = sorted(_reached & _shape_funcs) or "no 'unsupported' site at all"
        errors.append(
            f"{_rel} guards a {_method!r} call, branches on 'unsupported', and answers the "
            f"caller with a message citing a Godot version — but nothing {_method!r} reaches "
            f"raises 'unsupported' for a CAPABILITY reason. It reaches {_hit}, which is the "
            f"SHAPE kind: the caller named a node of the wrong type. The message tells them "
            f"to upgrade the engine when the fix is to name a different node. One word, two "
            f"meanings, and the message picked the wrong one."
        )

# --- 24c: THE MESSAGE MUST MATCH THE KIND THE SITE WAS CLASSIFIED AS ---------
#
# 193 §9.2 handed this over as a DECISION rather than a build, and priced it as a rename.
# The decision taken was KEEP THE CODE AND FIX THE MESSAGE: the shipped vocabulary does not
# move -- `docs/TOOL_CATALOG.md` stays true, nothing branching on `unsupported` breaks --
# but the sentence the caller reads stops sounding like a statement about their Godot build.
#
# 🔴 THE HARM WAS NEVER THE WORD ON THE WIRE. It is what the reader DOES next. Read
# `unsupported` on `shadermaterial_create` against a message that says only
# "Sprite2D has no material slot" and the reasonable inference is "this build cannot do
# shader materials", so the caller stops. The correct read is "pick a node with a material
# slot", and until this check the difference between those two lived nowhere but in prose.
# Check 24 made the two populations countable; this makes the DIFFERENCE BETWEEN THEM
# legible to the person on the other end.
#
# Four arms, each asked of the site's own DERIVED kind rather than of a roster of sites
# (189 §12.24, carried -- a roster entry for a pair that trips nothing goes stale on
# arrival). They read `_unsup_detail`, which the classifier above populated, so the message
# rule and the kind rule cannot disagree about which site is which:
#
#   SHAPE       must name the caller's node           -- the subject is THEIR object
#   SHAPE       must not read as a capability refusal -- no version claim, no "unavailable"
#   SHAPE       must name a class the GUARD ITSELF TESTS -- it must say what to pass instead
#   CAPABILITY  must NOT name the caller's node       -- the subject is the BUILD
#
# 🔴 THE THIRD ARM IS THE ONE THAT DOES WORK, AND IT IS DERIVED RATHER THAN A WORD LIST.
# "The message must contain a capitalised word" is satisfied by "Pass" and would be vacuous
# the day it shipped. What the message must contain is one of the class names the guard's
# OWN predicate tests: `if not (node is GPUParticles2D)` demands `GPUParticles2D`;
# `if prop == "":` resolves to `_material_prop(node)`, whose body tests `CanvasItem` and
# `GeometryInstance3D`, and demands one of those. That cannot be satisfied by prose -- only
# by naming the thing the caller has to go and get. It failed 2 of 4 before this session.
#
# 🔴 THE SECOND HOP IS DECLARED, NOT SNUCK IN. The kind classifier resolves ONE hop: the
# identifier the guard tests, to its assignment. This arm needs the assignment's CALLEE
# body, which is a second. It is bounded the same way -- a call to a `_`-prefixed function
# defined in the same file, one level, no recursion -- and `shape_guard_classes` is floored
# so a hop that stops resolving is a collapse rather than four arms quietly passing.
_MSG_RE = re.compile(r'_err\(\s*"unsupported"\s*,\s*"((?:[^"\\]|\\.)*)"')
_NODE_INTERP_RE = re.compile(r"%\s*node\.name\b")
# The capability VOCABULARY, kept deliberately wider than `_VERSION_CLAIM_RE` above: that
# one asks "is the host telling somebody to upgrade", this one asks "would a reader take
# this sentence as being about the engine rather than about their node".
_CAPABILITY_SENTENCE_RE = re.compile(
    r"Godot\s+\d+\.\d+\+|requires\s+Godot|\bunavailable\b|\bnot\s+supported\b|"
    r"\bthis\s+(?:Godot|build|engine)\b|\bunsupported\s+(?:on|by)\b",
    re.I,
)

# func name -> body, per GDScript file. Built once; the second hop reads it.
_GD_BODIES: "dict[str, dict[str, str]]" = {}
for _name, _src in _GD_SRC.items():
    _bodies: "dict[str, list[str]]" = {}
    _cur = None
    for _ln in _src.split("\n"):
        _m = re.match(r"^func\s+(\w+)", _ln)
        if _m:
            _cur = _m.group(1)
            _bodies[_cur] = []
        elif _cur is not None:
            _bodies[_cur].append(_ln)
    _GD_BODIES[_name] = {k: "\n".join(v) for k, v in _bodies.items()}

unsup_messages_read = 0
shape_guard_classes = 0
for (_file, _line), _d in sorted(_unsup_detail.items()):
    _mm = _MSG_RE.search(_d["raise"])
    if not _mm:
        # 193 §7.2's shape exactly: `emit_failed`'s raise site WRAPS, and a per-line scan
        # cannot see it. A message this check cannot read is a message it cannot judge, and
        # silently passing four arms on it is the failure mode that finding was about.
        errors.append(
            f"{_file}:{_line} raises 'unsupported' and this check cannot read the message "
            f"literal off the raise line, so all four kind-vs-message arms would pass it "
            f"silently. Put the message literal on the raise line, or teach `_MSG_RE` the "
            f"new shape deliberately — 193 §7.2 is the same defect one check earlier."
        )
        continue
    unsup_messages_read += 1
    _msg = _mm.group(1)
    _names_node = bool(_NODE_INTERP_RE.search(_d["raise"]))

    if _d["kind"] == "capability":
        if _names_node:
            errors.append(
                f"{_file}:{_line} ({_d['fn']}) is a CAPABILITY-kind 'unsupported' — its "
                f"guard reads engine/editor globals, so the answer is 'this Godot build "
                f"cannot' — but the message interpolates the caller's node name. That "
                f"blames their scene for a property of the build. Say what the build is "
                f"missing, not which node they picked."
            )
        continue

    # ── SHAPE ────────────────────────────────────────────────────────────────
    if not _names_node:
        errors.append(
            f"{_file}:{_line} ({_d['fn']}) is a SHAPE-kind 'unsupported' — the guard reads "
            f"the node the CALLER named, after a `bad_path` check on it has already passed "
            f"— but the message never names that node. The caller cannot tell which of "
            f"their nodes was wrong, and a message with no subject reads as a statement "
            f"about the engine."
        )
    if _CAPABILITY_SENTENCE_RE.search(_msg):
        errors.append(
            f"{_file}:{_line} ({_d['fn']}) is a SHAPE-kind 'unsupported' but its message "
            f"reads as a CAPABILITY refusal: {_msg!r}. An agent that reads this concludes "
            f"the Godot build cannot do the thing and stops, when the fix is to pass a "
            f"different node. The kind is right and the sentence is not."
        )
    # The classes the guard's own predicate tests, following at most one call.
    _classes = set(re.findall(r"\bis\s+([A-Z]\w*)", _d["probe"]))
    if not _classes:
        for _callee in re.findall(r"\b(_\w+)\(", _d["probe"]):
            _classes |= set(
                re.findall(r"\bis\s+([A-Z]\w*)", _GD_BODIES.get(_file, {}).get(_callee, ""))
            )
    if _classes:
        shape_guard_classes += 1
        if not any(re.search(rf"\b{re.escape(_c)}\b", _msg) for _c in sorted(_classes)):
            errors.append(
                f"{_file}:{_line} ({_d['fn']}) is a SHAPE-kind 'unsupported' whose guard "
                f"tests {sorted(_classes)}, and the message names none of them: {_msg!r}. "
                f"The caller is told their node is wrong and not what a right one looks "
                f"like — which is the whole difference between 'pick a node with a material "
                f"slot' and 'this Godot cannot do shader materials'."
            )

# --- 24b: THE ADDON COPIES, COMPARED BY CONTENT RATHER THAN BY VERSION STAMP -
#
# 192 §9.7 asked for one hash comparison over `variant_json.gd`'s four copies. Measuring
# the whole population instead answered a bigger question and found a LIVE drift.
#
#   `variant_json.gd`    identical across every copy -- the predicted risk was not the real one
#   `host/addon/`        GITIGNORED BUILD OUTPUT, so not a copy that can drift on its own.
#                        Excluded by construction, the same way VERSION_SCAN_SKIP already
#                        excludes it for check 14.
#   `runtime_bridge.gd`  🔴 DIFFERS between `addons/` and `example-csharp/addons/`, today,
#                        by 53 lines.
#
# The C# example's copy is missing `object/count` (the ObjectDB leak monitor added in 153,
# which `node-lifecycle.integration.mjs` watches) and the WHOLE `emit_failed` fix -- it
# calls `node.callv("emit_signal", ..)` and discards the Error, so `signal_emit` answers
# `{"emitted": true}` for an emission the engine refused. That is the exact defect the repo
# fixed, documented in the catalog, and then shipped a copy without.
#
# 🔴 AND `emit_failed` IS ONE OF THE 53 CODES CHECK 23 COUNTS. The cross-language check
# reads `addons/breakpoint_mcp` only, so it has been asserting a vocabulary that one of the
# shipped copies does not have. That is check 23's blind spot, named by its own sibling.
#
# `.uid` files are excluded BY CONSTRUCTION, not by roster: Godot generates a distinct UID
# per project, so those files SHOULD differ, and a roster naming them would go stale the
# moment a new script arrives. The suffix is the rule.
ADDON_COPY_ROOTS = [
    Path("addons/breakpoint_mcp"),
    Path("example/addons/breakpoint_mcp"),
    Path("example-csharp/addons/breakpoint_mcp"),
]
_tracked = set(
    subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=False
    ).stdout.split("\n")
)
addon_copy_files: "dict[str, dict[str, str]]" = {}
for _root in ADDON_COPY_ROOTS:
    _abs = ROOT / _root
    if not _abs.is_dir():
        continue
    for _f in sorted(_abs.rglob("*")):
        if not _f.is_file() or _f.suffix == ".uid":
            continue
        _rel = str(_f.relative_to(ROOT))
        if _rel not in _tracked:
            continue
        addon_copy_files.setdefault(_f.name, {})[str(_root)] = hashlib.md5(
            _f.read_bytes()
        ).hexdigest()

addon_copy_compared = {n: m for n, m in addon_copy_files.items() if len(m) > 1}
# 🔴 THREE POPULATIONS, BECAUSE THE REVERSE SWEEP KILLED THE FIRST ONE. `copies_compared`
# alone was floored at 10 and mutant B2 -- dropping `example-csharp/` from the roots -- left
# the run GREEN at 11, because `example/` carries every file the source tree does and the
# count of files-in-more-than-one-copy never moved. A population that survives losing a
# whole root is not measuring the comparison; it is measuring the source directory.
# The PAIRS are what the comparison actually reads, and the ROOTS are what it read them
# from. 171 §10.22 again: one number per population, and B2 is what "population" meant here.
addon_copy_pairs = sum(len(_m) for _m in addon_copy_compared.values())
addon_copy_roots_read = len({_r for _m in addon_copy_compared.values() for _r in _m})
for _name, _m in sorted(addon_copy_compared.items()):
    if len(set(_m.values())) == 1:
        continue
    _where = ", ".join(f"{r} {h[:8]}" for r, h in sorted(_m.items()))
    errors.append(
        f"The addon file {_name!r} is not byte-identical across the tracked copies "
        f"({_where}). Every check in this file reads `addons/breakpoint_mcp` and nothing "
        f"else, so a copy that has drifted is asserted about by nothing: check 23 counts a "
        f"vocabulary the drifted copy may not have, and a user who opens that example "
        f"project gets the older addon with no version stamp to say so. Re-sync the copy, "
        f"or split it deliberately and give the split its own rule."
    )

_ran("24")

# --- 20: THE SCOPE LEDGER — one literal floor per derived population ---------
#
# 🔴 WHY THIS EXISTS, MEASURED RATHER THAN ARGUED (session 172, answering 171 §10.21:
# "for each instrument that reports a count over a scope it derives itself, ask what it
# would print if its finder matched nothing — and whether that output is distinguishable
# from success. Start with contract_check.py").
#
# It was not distinguishable. Blinding each enumerator in turn — an early return of the
# empty collection its own annotation promises — and re-running produced:
#
#     25 blindable enumerators · CONTROL (unmutated) PASS · 11 caught · 14 STILL GREEN
#
# Fourteen finders could match NOTHING AT ALL and this file still printed ALL HARD
# CHECKS PASSED. Every check downstream of them compares set intersections, iterates a
# list, or filters for offenders — and all three of those are satisfied, silently and
# instantly, by an empty input. That is 168 §4's class applied to a gate rather than a
# test: a claim true of every possible state of the code.
#
# 🔴 AND THE SHARPEST CASE WAS CHECK 16, THE ONE WRITTEN TO PREVENT PRECISELY THIS.
# Its own comment records the incident it was built for: "one find-and-replace of
# `"properties"` -> `"props"` took both to `0 checked` while the JSON linter still read
# `514 (0 invalid)`. A release in which every documented shape was wrong passed green."
# The floor it built is `universe - comparable - exempt`, where `universe` is
# `set(code_inputs)` — THE SAME FINDER'S OUTPUT. Blind the finder and the universe
# empties with it, so there is nothing left to be uncovered. `len(x) >= len(x)`, which
# is the exact tautology `_population.mjs`'s docstring says it takes a separate `scope`
# argument to avoid. A gate cannot floor a population against itself.
#
# So the floors here are LITERALS, and they are >= rather than exact for 171 §4's
# reason: these populations are supposed to grow, and a gate that goes red on good work
# gets deleted. Only a COLLAPSE is a defect. Each line states what a zero would mean,
# because a floor whose consequence nobody wrote down is a number nobody will maintain.
#
# 🔴 ONE LINE PER POPULATION, NEVER AGGREGATED (171 §10.22). The rule was written after
# a total collapse in one directory hid behind a healthy number from another. A single
# "N things checked" summing twenty populations is that failure waiting to happen.
# 🆕 246 — COMPUTED HERE RATHER THAN AT ITS PRINT, BECAUSE THE LEDGER BELOW READS IT.
# The value is unchanged and so is the line that prints it; what moved is the point
# at which the number exists, which a floor one screen down now depends on.
_prose_masked = sum(prose_numerals_masked(p) for p in PROSE_NUMERAL_DOCS)

SCOPE_LEDGER: "list[tuple[str, int, int, str]]" = [
    # (population, measured now, literal floor, what a collapse would mean)
    # 🆕 283 — the withholding vocabulary check 31 classifies a User Guide blockquote by.
    # A collapse here is silent in the direction that matters: with no group names, §7's
    # rich-values blockquote stops being told from its higher-trust one, and the check
    # goes back to accusing the guide of withholding tools nobody withholds — or, worse,
    # reading a declaration as a step. The floor is 1 and not len(): a roster compared to
    # itself is not a pin (280 §5).
    ("capabilities.group_names", len(capability_group_names()), 1,
     "check 31 loses the vocabulary that tells a withholding blockquote from any other, so "
     "a guide section's declaration and its prose become the same thing to it"),
    ("gdscript.editor_methods", len(editor_methods), 120,
     "checks 1 & 2 stop comparing the host's bridge calls to any GDScript handler"),
    ("gdscript.runtime_methods", len(runtime_methods), 18,
     "the runtime half of the same wire contract goes unchecked"),
    ("host.bridge_calls", len(host_calls), 140,
     "check 2 compares an EMPTY set of calls to the dispatch table and finds nothing missing"),
    ("tools.registered", len(tools), 250,
     "checks 3, 4, 6, 9 and 11 all reach the surface through this list — an empty one satisfies all five"),
    ("tools.registration_sites_scanned", registration_sites_scanned, 250,
     "the net-completeness DETECTOR itself stops looking, which is how it passed while blind (172)"),
    ("catalog.index_tools", len(cat_tools), 250,
     "check 4 stops demanding a catalog row for anything"),
    # 🆕 251 — THE SECOND POPULATION OUT OF THE SAME ROW READER, AND IT IS A DIFFERENT
    # COLLAPSE. `index_tools` floors the NAMES; this floors the CELLS. A regex that still
    # matches every name while its fourth group comes back empty leaves the row above
    # intact and reports the whole Destructive column as being in agreement.
    ("catalog.destructive_marked", len(marked_destructive), 60,
     "check 4 compares an EMPTY set of ✔ rows and finds the whole column in agreement"),
    # 🆕 252 — THE HEADING READER'S OWN TWO FLOORS. This one does NOT come off
    # `CATALOG_ROW_RE`, so 251's argument for leaving 4b unfloored does not carry over:
    # its regex can die alone. `sections_read` is the name half and `heading_marked` the
    # glyph half, exactly as above, because they fail independently — a heading shape the
    # pattern stops reading empties the first, and a ✔ that moves off the name empties the
    # second while every section is still found.
    ("catalog.sections_read", len(heading_marks), 250,
     "check 4c stops demanding a section for anything, and its half of the two-way "
     "comparison reports nothing missing"),
    ("catalog.heading_marked", len(heading_destructive), 60,
     "check 4c compares an EMPTY set of ✔ headings — every section reads as saying "
     "the tool is safe, which is the exact state 252 found"),
    # 🆕 253 — THE PLANE ATOM'S OWN FLOOR, AND IT IS THE ONE THING 4d DOES NOT GET
    # FREE FROM `CATALOG_ROW_RE`. The name and the cell come off one match, so a
    # table shape the pattern stops reading is already loud in check 4 — 251's
    # argument, and it holds. What that shared match does NOT cover is the atom
    # going missing while every row still parses: `CATALOG_PLANE_ATOM_RE` is its
    # own pattern over the cell, and an empty result there makes 4d compare a
    # column of nothing to the registry and report agreement.
    ("catalog.plane_atoms", len([n for n in plane_atoms.values() if n]), 250,
     "check 4d reads NO toolset id out of the Plane column, so every cell agrees with "
     "the registry by saying nothing — the state the column shipped in until 253"),
    # 🆕 276 — THE FOURTH COLUMN'S TWO DOCUMENT SIDES AND ITS ONE CODE SIDE. Each of
    # the three collapses ALONE is loud in 4e, because the join is symmetric and an
    # empty side makes the other side's whole population an error. What these rows buy
    # is the attribution: without them a blinded reader reddens the run with a list of
    # twenty tool names and nothing anywhere says which finder went quiet.
    ("catalog.status_caveated", len(status_caveated), 12,
     "check 4e compares an EMPTY set of ⚠️ rows and every degrading tool reads as "
     "undermarked — the state the column shipped in until 276"),
    ("catalog.heading_status", len(heading_caveated), 12,
     "check 4e's heading half goes quiet and the index/heading cross-check finds the "
     "two copies in agreement by comparing one of them to nothing"),
    ("code.degrade_paths", len(degrade), 12,
     "check 4e reads NO graceful-degradation path anywhere in host/src/tools and every "
     "⚠️ in the catalog reads as the doc being stricter than the tool"),
    ("code.degrade_sites", degrade_sites, 6,
     "the house message shape is gone from every plane at once — the collapse a "
     "reworded phrase produces, and the one the population above cannot tell apart "
     "from a tree that genuinely degrades nowhere"),
    # 🆕 253 — THE MEMBERSHIP HALF OF THE SAME JOIN. `families.toolset_sizes` floors
    # how many GROUPS resolve; this floors how many TOOLS they name. A member
    # extractor that resolves all 14 ids and captures no names leaves that row green,
    # every size at 0, and 4d comparing the catalog to an empty partition.
    ("families.toolset_members", sum(len(v) for v in members.values()), 250,
     "every toolset resolves to an EMPTY member list — 4d finds no owner for any tool "
     "and check 11b's family sizes all collapse to 0"),
    ("catalog.json_blocks", len(catalog_json_blocks()), 400,
     "check 5 lints zero blocks and still reports (0 invalid)"),
    ("annotations.roster", len(annotated), 250,
     "check 9 stops demanding risk hints, and consumers infer risk from the tool NAME"),
    ("resources.registered", resource_count, 5,
     "check 10 compares nothing to the documented resource count"),
    ("resources.doc_claims", len(resource_claims), 6,
     "the documented side of check 10 goes unread"),
    ("counts.tool_claims", len(count_claims), 60,
     "check 11 verifies zero of the surface counts stated in docs and prose"),
    ("counts.test_constants", len(count_constants), 3,
     "check 11c stops watching the host suite's own declared size — the 681 drifts silently"),
    ("families.toolset_sizes", len(toolset_sizes()), 10,
     "check 11b resolves no toolset and every prose family count becomes 'unverified' (warn only, and quiet)"),
    ("families.prefix_glob_lines", len(prefix_lines), 4,
     "check 13's exact tool-name globs match nothing and every glob claim reads as satisfied"),
    # 🔴 THESE THREE WERE ONE LINE IN THE FIRST DRAFT OF THIS LEDGER, AND THE BLINDING
    # HARNESS CAUGHT IT: with `allfalse` and `annclass` summed, blinding either one left
    # the total above the floor and the run green. 171 §10.22, committed by the ledger
    # written to enforce it, inside the same commit — the aggregation reflex is that
    # strong. One line per population is not a style rule.
    ("families.allfalse_lines", len(allfalse_lines), 1,
     "check 13's all-false annotation claims stop resolving — the ~50 tools with no hints at all go unverified"),
    ("families.annclass_lines", len(annclass_lines), 1,
     "the annotation-class half of check 13 stops resolving any claim it is meant to verify"),
    ("families.exempt_lines", len(exempt_lines), 1,
     "the alternative-ceiling exemptions stop being located, so a stale exemption is indistinguishable from a live one"),
    ("families.toolset_aliases", len(toolset_aliases()), 1,
     "check 11b can no longer expand an alias, so every aliased toolset claim silently drops to 'unverified'"),
    ("families.toolset_claims_resolved", family_resolved_count, 3,
     "🔴 check 11b resolves NOTHING and its warning DISAPPEARS — a gate that gets quieter as it goes blind"),
    # 🔴 CHECK 25's THREE POPULATIONS, AND EVERY ONE OF THEM IS A FINDER THAT GOES QUIET
    # RATHER THAN LOUD WHEN IT BREAKS. `prose_bad` is an OFFENDER list: empty is the
    # healthy state AND the blind state, which is the exact shape 172 measured across
    # fourteen finders in this file. One line per population, never summed (171 §10.22).
    ("prose.numerals_read", prose_read, 25,
     "🔴 check 25 reads NO numeral out of the three gated docs, so 'every numeral is "
     "accounted for' is said about an empty set — and the two 289s it was written for "
     "would be back inside a population of nothing"),
    ("prose.derivable_values", len(DERIVED_NUMERALS), 8,
     "the derivation collapses and EVERY unclaimed numeral reads as undeliverable — the "
     "LOUD direction, floored here for the reverse: a set trimmed to a subset that still "
     "contains the full count would pass the surface numbers and fail the family ones"),
    # 🆕 246 — THE EXCLUSION THIS CHECK PRINTS AND NOBODY READ, AND `scope_gate.py` FOUND
    # IT BY BEING ALLOWED TO ASK. `prose_numerals_masked` is an annotated enumerator whose
    # return shape `EMPTY` did not know, so it was outside that gate by construction with
    # no line anywhere saying so — 199 §9.4's sentence, one file over. Admitted in 246 and
    # blinded on the first sweep: it returned zero and the whole contract check stayed
    # GREEN. The masked count is printed beside the numerals read for a stated reason —
    # "an exclusion nobody counts is the thing this check exists to prevent" — and until
    # this row the print was the only reader it had.
    # 🆕 246 — CHECK 27's POPULATION, AND IT IS BLINDABLE, WHICH IS THE POINT. The class
    # reader is an annotated enumerator, so `scope_gate.py` empties it in the same sweep as
    # every other one and this floor is what that blind collapses. A check whose finder can
    # match nothing needs a floor here before it needs anything else (171 §10.21).
    ("prose.guard_suppressions", sum(prose_guard_live.values()), 200,
     "check 27 sees the scanner's four guards suppress nothing at all, so every guard "
     "class reads as covered and narrowing one costs nothing anywhere"),
    ("prose.numerals_masked", _prose_masked, 3,
     "check 25's fence exclusion stops being counted: the line reads 0 inside fences "
     "whether the docs hold none or the masker stopped masking, and those are the two "
     "observations this print exists to separate"),
    ("prose.pins_negative", prose_pins_negative, 4,
     "🔴 THE PIN TABLE LOSES ITS NEGATIVE HALF — the rows asserting the scanner flags "
     "NOTHING on a byte count, a port, a version string, a two-digit percentage. A "
     "positive control cannot cover that direction, so nothing else in this tree would "
     "notice a pattern that started eating too much"),
    ("recipes.registered", len(recipe_set), 6,
     "check 12's roster comparison has nothing on the code side to compare"),
    # 🔴 THE THREE 197 §3 MEASURED AS MISSING, AND THE MEASUREMENT IS WHY THEY ARE HERE.
    # `scope_gate.py` blinds all 25 enumerators in this file and asserts each one reddens
    # the run. It never asked WHICH check reddened. Measured: 22 of the 25 redden check 20
    # — this ledger — and THESE THREE DID NOT. Two were caught by a `Could not parse X`
    # guard and one by check 12's roster comparison, all three incidental: delete this
    # ledger entirely and scope_gate stays green over them. A gate whose subject is caught
    # by something other than the gate is not covering it, it is being lucky near it.
    ("recipes.names_constant", len(recipes_constant), 6,
     "RECIPE_NAMES stops resolving, so check 12's ORDER half compares an empty list to the "
     "registrations and agrees with a stale doc and the suite simultaneously"),
    ("recipes.doc_mentions", sum(len(v) for v in recipe_doc_mentions.values()), 6,
     "no doc names any recipe, so every roster file reads as complete by naming nothing"),
    ("tools.privileged", len(priv_tools), 10,
     "TOOL_CAPABILITIES resolves to nothing, so the secure-default surface is computed as "
     "`len(registered) - 0` and every privileged tool reads as shipping by default"),
    # 🆕 261 — check 31's two populations. The tools a recipe NAMES, and the step
    # mentions it makes of them. Empty here, the guide reads as naming nothing, and a
    # recipe telling the reader to run a tool their install does not load goes back to
    # being found by the reader — which is how 261 found it.
    ("guide.recipe_tools", len(_recipe_tools), 25,
     "no tool is read out of USER_GUIDE §10/§11, so every recipe reads as naming nothing "
     "and check 31 agrees with a guide that names a withheld tool in every step"),
    ("guide.recipe_steps", _recipe_steps_judged, 30,
     "the step mentions collapse to zero, so the higher-trust marker is required of no "
     "line and the declaration block is compared against an empty set of steps"),
    # 🆕 268 — check 32's two populations. The lines that read an error's MESSAGE, and the
    # sites that RAISE one. Empty here and the tree reads as having no branch that could
    # answer to English and no raise site that could drop a code — which is exactly the
    # state the check exists to distinguish from a clean one, because 267's finding is
    # that an empty list means *nothing wrong* and *did not look* identically.
    ("host.error_message_reads", _message_reads, 40,
     "no line in host/src is read for a prose predicate, so the class 268 removed can "
     "return anywhere in the tree and check 32 agrees that nothing decides by matching"),
    ("host.error_raise_sites", _error_raises, 20,
     "no failure raise site is judged, so a timeout that stops carrying its code and a "
     "code that outlives its sentence both pass the join in both directions"),
    # 🆕 269 — check 32's fourth arm. The codes the host ORIGINATES, which is the half of
    # the wire vocabulary nothing had ever read. Empty here and the intersection with the
    # addon's fifty is empty for the wrong reason, so a second `write_failed` — one word,
    # two producers, one remedy that can only fit one of them — lands green.
    ("host.origin_error_codes", len(_host_origin_codes), 8,
     "no code is read as host-origin, so the host and addon vocabularies never overlap "
     "and check 32's one-code-one-producer arm agrees with any collision at all"),
    ("shapes.inputs_parsed", len(code_inputs), 250,
     "🔴 CHECK 16's UNIVERSE — the population it floors coverage against. Empty here, nothing is uncovered"),
    ("shapes.inputs_compared", len(input_comparable), 250,
     "check 6 compares zero input shapes to the catalog and reports parity"),
    ("shapes.outputs_parsed", len(code_outputs), 250,
     "🔴 the same universe on the output side (172's measurement blinded both)"),
    ("shapes.outputs_compared", len(output_comparable), 250,
     "check 7 compares zero output shapes to the catalog and reports parity"),
    # 🆕 276 — the complement's own walk. An empty OFFENCE list is what a healthy tree
    # looks like AND what a walk over the wrong directory looks like, and only this
    # number separates them.
    ("versions.info_files_scanned", info_files_scanned, 20,
     "check 14's hardcoded-literal complement walks NO files, so every serverInfo and "
     "clientInfo version in host/src reads as derived — the state the tree shipped in "
     "from the initial commit to 1.26.0"),
    ("versions.sites_checked", version_sites_checked, 8,
     "check 14's release ritual verifies no stamp — a half-bumped release passes"),
    # 🆕 228: 2 -> 3, and the CONTROLS are what asked for it. `.githooks/pre-commit`
    # joined EXEC_ROSTER, so `15.unexpected` and `15.noshebang` — which take one roster
    # member out — left TWO confirmed behind and no longer crossed a floor of two.
    # `control_gate.py` reported both blast radii shrinking from 2 to 1 in the same run.
    # 🔴 A FLOOR THAT DOES NOT RISE WITH ITS POPULATION STOPS BEING A FLOOR QUIETLY: the
    # roster would have grown to ten while a mutation removing one of them stayed green.
    ("modes.shebangs_confirmed", shebangs_confirmed, 3,
     "check 15 confirms no interpreter line and the exec-bit contract stops being read"),
    # 🔴 CHECK 23's FIVE FINDERS. Every comparison in that block is a set difference or a
    # membership test, and BOTH are satisfied instantly by an empty left-hand side. The
    # codec pair is the sharpest: `emitted - accepted == CODEC_ONEWAY` is an equality, so
    # blinding BOTH finders at once leaves `set() - set() == {..}` FALSE and reddens --
    # but blinding either one alone is a silent pass in one direction. Floored separately
    # for exactly that reason. One line per finder, never summed.
    ("xlang.codec_emitted", len(codec_emitted), 10,
     "check 23 stops seeing any tag encode() produces, so no tag can be found undecodable"),
    ("xlang.codec_accepted", len(codec_accepted), 8,
     "every emitted tag reads as one-way and only the CODEC_ONEWAY equality still bites"),
    ("xlang.codec_fields", len(codec_fields), 8,
     "the FIELD half goes quiet — a tag whose name matches and whose payload does not is "
     "the failure that reports success, and it is the half a tag-name check never sees"),
    ("xlang.ts_variant_tags", len(ts_variant_tags), 2,
     "the host stops being read as a PRODUCER of tagged Variants and check 23's TS half "
     "compares an empty set to a healthy GDScript side"),
    # 🆕 254 — check 28's three populations. The remedy rows are the table itself; blind
    # the reader and every code reads as remedied and every remedy as raised, because both
    # directions of the join are computed from the SAME empty set and agree perfectly.
    ("xlang.remedy_rows", sum(len(v) for v in remedy_rows.values()), 45,
     "🔴 both halves of check 28's join go quiet at once — an empty table disagrees with "
     "nothing, so a code shipped with no next action and a remedy for a code nobody raises "
     "are equally invisible"),
    ("xlang.remedy_tool_refs", len(remedy_tool_refs), 35,
     "the remedies stop being joined to `registerTool`, so a renamed tool leaves the one "
     "sentence that was supposed to unblock the caller naming a tool that does not exist"),
    # 🆕 259 — check 28's CLI half and the host fallback. The tool join answered *does
    # this name exist*; neither of these asks that.
    ("xlang.remedy_cli_refs", len(remedy_cli_refs), 2,
     "no remedy's COMMAND is joined to anything — which is the state that shipped "
     "`breakpoint-mcp init` for four releases as the answer to a stale addon, a valid "
     "subcommand that skips in the one state the sentence is ever read in"),
    ("xlang.cli_subcommands", len(CLI_SUBCOMMANDS), 3,
     "the CLI join compares every command in every remedy to an EMPTY set of subcommands "
     "and reports nothing wrong — the far side of the same join going quiet"),
    ("xlang.host_fallback_rows", len(host_fallback), 1,
     "the host stops answering for the addon that cannot answer for itself: the ceiling, "
     "the dead-row join and the grammar all read an empty table and all agree"),
    ("xlang.remedy_renderers", len(remedy_renderers), 5,
     "🔴 the host half stops being read. Every `fail()` could drop `remedyClause` and the "
     "addon would still attach a remedy to every failure — the wire stays correct and the "
     "user reads the bare message, which is the state 254 measured"),
    ("xlang.host_invented_sites", _sites_scanned, 12,
     "🔴 the raise-site half stops being read, and it fails SILENTLY: an empty scan reports "
     "no unanswered site, which is the same observable as every site carrying an answer. "
     "That is why the count is floored here and not merely the list"),
    ("xlang.host_cause_sentences", len(_host_causes), 8,
     "🔴 the host's own remedy sentences stop being judged. The grammar rules below then read "
     "an EMPTY table and every one of them agrees with itself — which is exactly how two "
     "SHIPPED sentences sat unread until 267 widened this population to include them"),
    # 🆕 255 — check 29's three readers, floored separately because they fail separately
    # and every one of them fails SILENTLY. The join is `for each key, is it written` —
    # an empty left side asks nothing, an empty right side is the same as a handler that
    # writes nothing, and the difference between those two is the whole check.
    ("xlang.required_any_keys", _required_any_joined, 12,
     "🔴 check 29 stops asking. Every `any`-typed output key the wire now marks REQUIRED "
     "goes unjoined, and the SDK validates `structuredContent` on every success — so the "
     "first handler to drop one turns that tool's happy path into a thrown error, with "
     "nothing in this tree saying which key or which tool"),
    # 🆕 272 — the RIGHT-HAND side of that join, floored separately because it fails
    # separately and, until 272, failed in the direction nothing notices. An empty regions
    # list is LOUD — every key reads unwritten and the check reddens on a healthy tree.
    # A regions list that is too WIDE is the silent one, and is what this replaced: the
    # search used to run over the handler's whole body, where a `var x: Variant`
    # annotation and the tool's own `inputSchema:` line both matched. Deleting each real
    # emit and re-running the join measured it at 272 — eight of the sixteen keys still
    # read PRESENT with nothing left writing them. The floor is on the population because
    # a reader trimmed to a SUBSET of the emitting shapes is the failure that keeps the
    # check green: it would still find the eleven easy keys and go quiet about the rest.
    ("xlang.emit_regions", _emit_regions_read, 18,
     "🔴 the constructs check 29 searches stop being found. Fewer regions is a join that "
     "asks about fewer keys while printing the same sentence — and the shape that matters "
     "is not the total but the per-tool zero, which check 29 raises under its own message "
     "rather than reporting as an absent key"),
    # 🆕 257 — check 30's two populations, floored separately because they fail separately
    # and both fail SILENTLY. An empty launcher set judges nothing and prints ok; an empty
    # key map makes every launcher read as declaring nothing, which is the LOUD failure —
    # so the floor that matters is the first, and the second is here because a reader that
    # can go blank is a reader whose green means nothing either way.
    ("xlang.game_launchers", len(_launchers), 2,
     "🔴 check 30 stops asking. Every tool that starts a game can go back to answering "
     "before the runtime bridge binds, which is the defect `run-project-returns-before-"
     "bridge` names — and the finder going quiet looks exactly like a tree with no "
     "launchers in it"),
    ("xlang.readiness_waiters", len(_waiters), 2,
     "🔴 the WAITING half of check 30's comparison goes empty, and an empty right side "
     "makes every launcher read as a tool that never waited — which is loud rather than "
     "silent, and is exactly why the floor is here: the loud failure is what a reader "
     "trimmed to a subset would NOT produce, and a subset that still contains one waiter "
     "would pass the comparison for that one and say nothing about the rest"),
    ("xlang.output_schema_tools", len(_out_keys), 200,
     "the schema reader stops resolving entries, so check 30's key half compares an empty "
     "declaration to a required one and goes red on a healthy tree — the shape of gate "
     "that gets deleted rather than fixed"),
    ("xlang.tool_bridge_methods", sum(len(v) for v in tool_methods.values()), 150,
     "the per-TOOL half collapses to the per-FILE answer checks 1 and 2 already have: no "
     "tool resolves to a handler, so every key reads as unwritten and check 29 goes red on "
     "a healthy tree — which is the shape of gate that gets deleted rather than fixed"),
    ("xlang.addon_handlers_resolved", len(addon_handlers), 120,
     "the dispatch arms stop resolving to functions and check 29 falls back to the host "
     "block alone, where the addon's keys are not written and never were"),
    ("xlang.addon_err_codes", len(addon_err_codes), 40,
     "🔴 EVERY TypeScript branch on an addon error code reads as dead — or, with the "
     "offender loop as written, none does: an empty right-hand side makes every `in` test "
     "false and every branch an error, which is the LOUD failure. The floor is here for "
     "the reverse: a finder trimmed to a subset that still contains 'unsupported'"),
    ("xlang.ts_err_branches", len(ts_err_branches), 1,
     "🔴 the overwrite guard stops being watched. `tabletop.ts` refuses a board overwrite "
     "on a stale open tab ONLY when the addon answers 'unsupported'; with this finder "
     "blind, renaming that code on the GDScript side is a silent append"),
    # 🔴 THE BINDING FINDER, AND IT IS FLOORED BECAUSE THE SWEEP CAUGHT ITS ABSENCE. The
    # vocabulary test above passed mutant C1 — the rename of the ONE raise site the guard
    # depends on — because seven other sites keep the word alive. This population is the
    # pairs actually resolved to a dispatch method; resolve none and the binding test has
    # nothing to compare and says nothing, which is C1 surviving again by a quieter route.
    ("xlang.err_branch_bindings", len(err_branch_bindings), 1,
     "🔴 no TS branch resolves to the bridge method it guards, so the handler-level "
     "comparison compares nothing and the vocabulary test is all that is left — which is "
     "the exact state mutant C1 walked through"),
    # 🔴 BOTH KINDS ARE FLOORED, NOT JUST THE TOTAL. A classifier that stopped seeing the
    # capability probes would file all eight sites as SHAPE, the total would be unchanged
    # at eight, and the host rule below would start firing on a healthy tree — a gate that
    # cries wolf gets disabled, which is how the `typeof` false positive nearly shipped in
    # 192 §7. One number per population, 171 §10.22's rule, applied to a classifier.
    ("xlang.unsupported_capability", len(unsupported_kinds["capability"]), 4,
     "🔴 the classifier stopped recognising an engine-capability probe, so a site that "
     "means 'this Godot build cannot' is filed as 'you named the wrong node' — and the "
     "host rule that reads the kind starts refusing a message that is correct"),
    ("xlang.unsupported_shape", len(unsupported_kinds["shape"]), 4,
     "🔴 the reverse: every site reads as capability, so a version-citing host message "
     "bound to a shape handler passes. That is the defect this check exists for, and it "
     "would be invisible with only the total floored"),
    # The host rule is only asserted where a branch actually cites a version. Floor the
    # number of branches it REACHED, not the number of branches that exist: a rewording
    # that drops the version claim silently un-asserts the rule, and this is what says so.
    ("xlang.kind_checked_branches", kind_checked_branches, 1,
     "🔴 no host branch on 'unsupported' still carries a version-citing message, so the "
     "capability/shape rule is asserted about nothing. Either the message was reworded "
     "(fine — then this floor comes down deliberately) or the finder stopped reading it"),
    # 🔴 24c's TWO POPULATIONS, AND THEY FAIL FOR DIFFERENT REASONS THAN THE KIND FLOORS
    # ABOVE. `unsupported_capability`/`_shape` die when the CLASSIFIER breaks. These two
    # die when the MESSAGE READER breaks while the classifier stays healthy — a raise site
    # that wraps onto two lines (193 §7.2's `emit_failed`, exactly) reads as zero messages
    # while all eight sites still classify, and every message arm passes on nothing.
    ("xlang.unsup_messages_read", unsup_messages_read, 8,
     "🔴 the message reader saw fewer 'unsupported' messages than the classifier saw "
     "sites, so 24c's four arms are being asked of a subset. A raise site whose literal "
     "moved off the raise line is invisible to a per-line scan and passes silently"),
    ("xlang.shape_guard_classes", shape_guard_classes, 4,
     "🔴 the guard-class derivation stopped resolving, so 'the message must name a class "
     "the guard tests' is asserted about nothing — the arm that does the actual work goes "
     "quiet without a single error. The second hop into the guard's callee is what this "
     "counts, and it is the hop most likely to break when the addon is refactored"),
    # 🔴 THE CROSS-COPY POPULATION, AND IT IS THE FILES COMPARED RATHER THAN THE FILES
    # FOUND. A walk that started skipping `example-csharp/` would leave every remaining
    # file identical-by-construction and this check would pass by reading one copy.
    ("addon.copy_roots_read", addon_copy_roots_read, 3,
     "🔴 the cross-copy walk read fewer addon roots than the tree has, so 'all copies "
     "agree' is being said about a subset. Mutant B2 dropped a whole root and every other "
     "number here stayed healthy — this is the one that notices"),
    ("addon.copy_pairs", addon_copy_pairs, 22,
     "🔴 the (file, copy) pairs actually compared collapsed. This is the population the "
     "comparison READS; `copies_compared` counts only the files, and a file present in two "
     "copies looks identical to a file present in three"),
    # 🆕 278 — check 33's two populations. The first is DERIVED from host/src and is the
    # one 276's finding is about: a typed list stood here and was wrong in both
    # directions, so a floor on the derived count is what stops the derivation quietly
    # returning nothing and check 33 finding no disagreement with an empty set.
    ("dap.capability_gates", len(_dap_gates), 8,
     "🔴 the walk that derives which adapter capabilities host/src gates on collapsed, so "
     "check 33 compares an EMPTY population to the ledger and every direction agrees. "
     "This is the population, not the answer — it is what the typed list got wrong"),
    ("dap.ledger_joins_read", _dap_joins, 30,
     "🔴 check 33's reader stopped COMPARING. A join reader whose only other output is "
     "`what went wrong` is silent on a healthy tree whether it ran or not — this is the "
     "number that tells the two apart, and scope_gate proved it necessary by blinding "
     "the reader to `[]` and watching the check stay green"),
    ("dap.ledger_arms_read", len(_dap_arms), 2,
     "🔴 the ledger stopped carrying a reading per engine arm. One arm cannot disagree "
     "with another, and this evidence exists only on CI — an empty `observed` makes the "
     "live gate's ledger join vacuous on every build"),
    ("addon.copies_compared", len(addon_copy_compared), 10,
     "🔴 the cross-copy walk stopped finding files that exist in more than one addon "
     "copy, so 'all copies agree' is being said about a population of one. The drift it "
     "was written for — `runtime_bridge.gd`, 53 lines, two shipped fixes missing — is "
     "exactly what a shrunken population hides"),
]
scope_collapses = [(n, v, f, why) for (n, v, f, why) in SCOPE_LEDGER if v < f]
for name, value, floor, why in scope_collapses:
    errors.append(
        f"SCOPE COLLAPSE {name}: {value} < floor {floor}. The finder behind this "
        f"population matched (almost) nothing, so {why}. Either coverage really was "
        f"deleted — in which case lower the literal deliberately — or the finder "
        f"stopped recognising what it reads, which is indistinguishable from success "
        f"in every check downstream of it."
    )

_ran("20")

# --- report -----------------------------------------------------------------
print("=== breakpoint-mcp static contract check ===")
print(f"GDScript editor methods : {len(editor_methods)}")
print(f"GDScript runtime methods: {len(runtime_methods)}")
print(f"Host bridge calls       : {len(host_calls)}")
print(f"Registered MCP tools    : {len(tools)} (unique: {len(tool_set)})")
print(f"Catalog index tools     : {len(cat_tools)}")
print(f"Annotated tools         : {len(annotated)} (readOnly/destructive/idempotent/openWorld hints)")
print(f"MCP resources           : {resource_count} registered · {len(resource_claims)} doc count(s) checked")
print(
    f"Tool counts             : full {total_tools} · secure-default {secure_default_tools} "
    f"· privileged {privileged_count} · {len(count_claims)} claim(s) + "
    f"{len(count_constants)} test constant(s) checked"
)
print(
    f"Tool-family counts      : {len(toolset_sizes())} toolset size(s) resolved · "
    f"{len(family_mismatches)} mismatch(es) · {len(family_unresolved)} unverified prose claim(s) (warn only)"
)
print(
    f"Family claims (exact)   : {len(prefix_lines)} tool-name glob(s) · "
    f"{len(allfalse_lines) + len(annclass_lines)} annotation class · "
    f"{len(FAMILY_COUNT_EXEMPT)} exempt (alternative's ceiling)"
)
print(
    f"Host test suite         : {host_test_count} test(s) declared under host/test "
    f"· {len(test_count_claims)} doc claim(s) checked"
)
print(
    f"Prose numerals          : {prose_read} read across {len(PROSE_NUMERAL_DOCS)} doc(s) "
    f"· {len(DERIVED_NUMERALS)} derivable value(s) · {prose_pins_read} pin(s) "
    f"({prose_pins_negative} negative) · {len(PROSE_NUMERAL_EXEMPT)} exempt"
)
# 🔴 THE ADMITTED SCOPE, PRINTED AS A NUMBER ON GREEN RUNS (221 §5.2). What a gate does
# NOT cover is invisible by construction; the only way it stays arguable is if the size of
# the exclusion appears next to the size of the population every single run.
#
# 🔴 225 — AND THE LINE HAD TO CHANGE WHEN THE EXCLUSION EMPTIED. With TOOL_CATALOG.md
# admitted, `PROSE_NUMERAL_EXCLUDED` is `{}`, and the old line rendered as "0 numeral(s) in
# " — a trailing preposition with nothing after it, which is what a scope report looks like
# when its population goes to zero and nobody re-reads the sentence. The excluded-FILE count
# stays (it is the number that must remain 0), and the masked-fence count joins it, because
# masking a fence is now a real exclusion this check performs on every run.
print(
    f"  …not covered          : {prose_excluded_count} numeral(s) in "
    f"{len(PROSE_NUMERAL_EXCLUDED)} excluded doc(s) · {_prose_masked} inside ``` fences "
    f"(checks 18/19 own those) · {prose_line_only} covered only line-deep by check 13"
)
print(
    f"Recipes                 : {len(recipe_set)} registered · {recipe_rosters_checked} "
    f"doc roster(s) checked · {len(recipe_count_claims)} count claim(s) checked"
)
print(
    f"Version parity          : host {host_version} · addon {addon_version} "
    f"· {version_sites_checked} site(s) checked across 2 rosters"
)
print(
    f"File modes              : {len(exec_tracked)} tracked at 100755 · roster of "
    f"{len(EXEC_ROSTER)} · {shebangs_confirmed} interpreter line(s) confirmed · "
    f"{shebang_nonexec_count} shebang'd non-exec"
)
print(f"Catalog JSON blocks     : {len(catalog_json_blocks())} ({bad_json} invalid)")
print(
    f"Example project         : renderer {RENDERING_METHOD_REQUIRED} \u00b7 autoload on the res:// path form "
    f"\u00b7 {_uid_sidecars_checked} in-project script(s) checked for .uid sidecars "
    f"· {_shipped_uid_dir_scanned} distributable addon file(s) checked for shipped uids"
)

_origin_counts: dict[str, int] = {}
for _how in shape_origin.values():
    _key = "xref" if _how.startswith("xref") else _how
    _origin_counts[_key] = _origin_counts.get(_key, 0) + 1
_origin_note = " · ".join(f"{v} {k}" for k, v in sorted(_origin_counts.items()))
print(f"Input shapes            : {len(code_inputs)} parsed · {len(input_comparable)} checked vs catalog "
      f"· {len(set(code_inputs)) - len(set(input_comparable))} uncovered")
print(f"Output shapes           : {len(code_outputs)} in schemas.ts · {len(output_comparable)} checked vs catalog "
      f"· {len(set(code_outputs)) - len(set(output_comparable))} uncovered")
print(f"Shape sources           : {_origin_note} · {len(SHAPE_COVERAGE_EXEMPT)} exempt")
print()
# 🔴 ONE LINE PER POPULATION. The block above is a human summary; this is the gate.
# Printing it always — not only on failure — is what makes a shrink visible in a diff
# of two CI logs, which is the review nobody can do against a single "PASSED".
print(f"=== scope ledger ({len(SCOPE_LEDGER)} population(s), literal floors, >= ) ===")
for _name, _value, _floor, _why in SCOPE_LEDGER:
    _mark = "ok" if _value >= _floor else "🔴 COLLAPSE"
    print(f"SCOPE {_name:<36} {_value:>5} / {_floor:<5} {_mark}")
print()
# --- 22: EVERY CHECK REACHED ITS OWN END (182, closing 181 §11.3) ---------------
# 🔴 THE SCOPE LEDGER ABOVE COUNTS POPULATIONS, NOT COMPARISONS. Twenty-six floors pin
# what the finders found; not one of them notices a CHECK that is no longer there. A
# deleted block takes its own `errors.append` calls away with it, every floor holds, and
# the line below this one says ALL HARD CHECKS PASSED over one fewer contract.
#
# Both halves are asserted, because either alone is escapable: the SET catches a check
# renamed or replaced (the count would not move), and the literal FLOOR catches the
# roster itself being trimmed to match a smaller reality — 181 §7's `{ test: 0 }`, where
# every key was pinned and no value was.
_ran_set, _expected_set = set(checks_ran), set(CHECKS_EXPECTED)
# 🔴 AND THE FLOOR'S OWN VALUE IS PINNED, WHICH IS 181 §7 APPLIED TO THE FLOOR THIS
# SESSION ADDED. `CHECKS_RUN_FLOOR = 0` would leave the collapse branch below unable to
# bite, the roster check green on a healthy tree, and the whole counter re-permitted in
# silence — six floors were found in exactly that state one session ago. Tying it to the
# ROSTER is not circular, because the roster is itself compared against what actually ran.
if CHECKS_RUN_FLOOR != len(_expected_set):
    errors.append(
        f"CHECKS_RUN_FLOOR is {CHECKS_RUN_FLOOR} but CHECKS_EXPECTED names {len(_expected_set)} "
        f"check(s). The floor exists to notice a check going missing; set to anything other than "
        f"the roster size it stops being able to. Move both, on purpose."
    )
print(f"CHECKS_RUN {len(_ran_set)}/{CHECKS_RUN_FLOOR} reached their own end: {' '.join(checks_ran)}")
if len(_ran_set) < CHECKS_RUN_FLOOR:
    errors.append(
        f"CHECKS_RUN collapsed — {len(_ran_set)} check(s) reached their own end, floor is "
        f"{CHECKS_RUN_FLOOR}. Missing: {sorted(_expected_set - _ran_set)}. A check that is "
        f"deleted, or whose body stops before its end, takes its own errors away with it and "
        f"every scope floor above still holds — which is exactly what 'ALL HARD CHECKS PASSED' "
        f"would have meant here."
    )
if _ran_set != _expected_set:
    errors.append(
        f"CHECKS_RUN roster drift — ran {sorted(_ran_set)}, expected {sorted(_expected_set)}. "
        f"Unexpected: {sorted(_ran_set - _expected_set)}; missing: {sorted(_expected_set - _ran_set)}. "
        f"Add or remove the check ON PURPOSE, in CHECKS_EXPECTED, with the floor moved to match."
    )
if len(checks_ran) != len(_ran_set):
    errors.append(
        f"CHECKS_RUN counted a name twice — {checks_ran}. Two blocks claiming one name means one "
        f"of them can be deleted while the count stays put."
    )

# --- 26: THE CHECK BLOCKS THIS FILE CONTAINS, AGAINST THE ROSTER (246, closing 233's
#         `discover-rosters` for CHECKS_EXPECTED) --------------------------------------
# 🔴 CHECK 22 COMPARES WHAT RAN TO WHAT THE ROSTER NAMES, AND BOTH SIDES ARE THE ROSTER.
# `checks_ran` is filled by `_ran()` calls, and a check block that never calls `_ran` puts
# nothing in either set — so the two agree, the floor holds, and the block is invisible to
# every reader in this file. That is not hypothetical: 24b and 24c have been check blocks
# with headers, bodies and their own `errors.append` calls since 232, and no line anywhere
# counts them. 233's row asked the DISCOVER question of this roster and nobody had.
#
# 🟢 THE POPULATION IS A WALK OVER THIS FILE'S OWN SOURCE, and the membership rule is
# DERIVED rather than rostered: a header whose id has its own `_ran` is a member, a header
# whose id EXTENDS a member's and sits inside that member's block is a sub-block covered by
# its parent's counter, and anything else has to be declared below with a reason. Helper
# headers are excluded by their own spelling, which the walk reads rather than being told.
#
# 🔴 AND THIS CHECK IS NOT IN `CHECKS_EXPECTED`, FOR CHECK 21 AND 22's REASON: it gates the
# roster and cannot be a member of it. It is declared below in the same table that declares
# them, which is the only place in this file where that fact is written down rather than
# stated in a comment.
CHECK_HEADER_RE = re.compile(
    r"^# -{2,} *(?P<id>[0-9][0-9a-z]*(?: *& *[0-9]+)?(?:/[0-9]+)?)(?P<helper> helpers)? *:", re.M)
_RAN_SITE_RE = re.compile(r'^_ran\("([^"]+)"\)', re.M)

# (id -> why it is a check block that `CHECKS_EXPECTED` must not contain). Every row is
# checked against the walk in both directions: a row naming an id no header declares is
# stale, and an id with a row AND a `_ran` is a contradiction rather than a note.
CHECK_META_BLOCKS: "dict[str, str]" = {
    "21": "the report wire's own arrival check — it runs AFTER the roster comparison, so a "
          "`_ran` call from it could never be in the set check 22 compares",
    "22": "the roster comparison itself; a check cannot be a member of the roster it gates",
    "26": "this block, for the same reason as 22 — it is the DISCOVER half of that roster "
          "and a member of it would be a population containing itself",
}

_cc_src = Path(__file__).read_text(encoding="utf-8")
_headers = [(m.group("id").replace(" ", ""), bool(m.group("helper")), m.start())
            for m in CHECK_HEADER_RE.finditer(_cc_src)]
_ran_sites = {m.group(1): m.start() for m in _RAN_SITE_RE.finditer(_cc_src)}
_block_headers = [(i, pos) for i, helper, pos in _headers if not helper]
check_headers_found = len(_block_headers)
check_helper_headers = len(_headers) - check_headers_found

if not _block_headers:
    errors.append(
        "CHECK_HEADERS read NOTHING out of this file — the header convention changed and "
        "this half now reports full coverage over an empty population, which is the exact "
        "shape it was written to refuse. Fix CHECK_HEADER_RE; do not delete the check."
    )

# A header with no `_ran` of its own is covered when it sits INSIDE a member whose id it
# extends — `24b` and `24c` inside check 24, whose `_ran` is below both of them.
def _covering_member(hid: str, pos: int) -> "str | None":
    best = None
    for other, opos in _block_headers:
        if other == hid or not hid.startswith(other):
            continue
        rpos = _ran_sites.get(other)
        if rpos is None or not (opos < pos < rpos):
            continue
        if best is None or opos > best[1]:
            best = (other, opos)
    return None if best is None else best[0]

check_sub_blocks = 0
for hid, pos in _block_headers:
    if hid in _ran_sites:
        if hid in CHECK_META_BLOCKS:
            errors.append(
                f"Check block {hid!r} calls `_ran` AND is declared in CHECK_META_BLOCKS as a "
                f"block the roster must not contain. One of the two is wrong: a block that "
                f"counts itself is a member, and a member cannot gate the roster it is in."
            )
        elif hid not in CHECKS_EXPECTED:
            errors.append(
                f"Check block {hid!r} has a header and its own `_ran` call and is NOT in "
                f"CHECKS_EXPECTED. Check 22 compares what ran against the roster, and both "
                f"sides come from the roster — so a block missing from it is counted by "
                f"nothing at all. Add it, with CHECKS_RUN_FLOOR moved to match."
            )
        continue
    covering = _covering_member(hid, pos)
    if covering is not None:
        check_sub_blocks += 1
        continue
    if hid not in CHECK_META_BLOCKS:
        errors.append(
            f"Check block {hid!r} has a header, no `_ran` call of its own, and does not sit "
            f"inside a check whose id it extends — so nothing in this file counts it and "
            f"check 22 would pass with the block deleted. Give it a `_ran` and a "
            f"CHECKS_EXPECTED row, or declare it in CHECK_META_BLOCKS with the reason it "
            f"gates the roster rather than belonging to it."
        )

for hid in CHECK_META_BLOCKS:
    if hid not in dict(_block_headers):
        errors.append(
            f"CHECK_META_BLOCKS declares {hid!r}, which no header in this file names. A "
            f"stale row makes the roster's residue look explained when it is not."
        )
for name in CHECKS_EXPECTED:
    if name not in dict(_block_headers):
        errors.append(
            f"CHECKS_EXPECTED names {name!r}, which has no `# --- {name}: …` header. The "
            f"roster and the file disagree about what this file contains."
        )
    if name not in _ran_sites:
        errors.append(
            f"CHECKS_EXPECTED names {name!r}, which has no `_ran` call site in the source at "
            f"all — check 22 can only report it MISSING at runtime, which reads as a check "
            f"that failed to finish rather than one that was never wired."
        )
print(f"CHECK_HEADERS {check_headers_found} block(s) walked · {len(_ran_sites)} counted by "
      f"`_ran` · {check_sub_blocks} sub-block(s) · {len(CHECK_META_BLOCKS)} gating the roster "
      f"· {check_helper_headers} helper section(s)")

# --- 21: THE REPORT WIRE ARRIVED ------------------------------------------------
# 🔴 RUN BEFORE THE VERDICT, NOT AFTER IT. The canary appended at the top has to still
# be here; if it is not, `errors` did not carry, every "no violations found" above is
# vacuous, and the exit code below would be 0 for the worst possible reason. Stripped
# rather than reported, because a canary that reaches a reader is a false alarm — and
# `remove` is used deliberately: it raises if the sentinel is absent from a list that
# CLAIMS to contain it, which is one more way for a subverted collection to be caught.
if _WIRE_CANARY not in errors:
    print(
        "\n🔴 REPORT WIRE FAILED — the canary appended at the top of this file did not\n"
        "   survive to the report. `errors` is not carrying what the checks put in it, so\n"
        "   'no violations' above means only that nothing could be heard. Every check in\n"
        "   this file is unverified until this is fixed.",
        file=sys.stderr,
    )
    sys.exit(2)
errors.remove(_WIRE_CANARY)

for w in warnings:
    print("WARN:", w)
for e in errors:
    print("FAIL:", e)
if not errors:
    print("\nALL HARD CHECKS PASSED ✅")
sys.exit(1 if errors else 0)
