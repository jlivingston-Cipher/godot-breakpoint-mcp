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

# Three-digit counts that legitimately appear ON A LINE that also states a
# surface count, but are NOT the full or secure-default surface — a plane total,
# a tool-family size, a rival's ceiling. Deliberately EMPTY today: every
# claim-bearing line in the tree states only 286 or 272, and the family counts
# (145 for plane A, 162 for a rival's ceiling, 165 for the physics group) all sit
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


def uncaptured_tool_registrations() -> list[str]:
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
    """
    missed: list[str] = []
    for f in sorted(TOOLS.rglob("*.ts")):
        text = f.read_text()
        for m in re.finditer(
            r'register(?:Task)?Tool\(\s*(?:\w+\s*,\s*)?"([^"\n]*)"', text
        ):
            name = m.group(1)
            if not re.fullmatch(r"[a-z0-9_]+", name):
                line = text.count("\n", 0, m.start()) + 1
                missed.append(f"{f.relative_to(ROOT)}:{line} {name!r}")
    return missed


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


def test_count_constants() -> list[tuple[Path, int, str, int]]:
    """(file, line, const-name, value) for every hardcoded tool-count constant in
    the host tests — `EXPECTED_TOOL_COUNT` in registration/toolsets/annotations
    and `FULL_TOOL_COUNT` in capabilities.

    These four are self-gating in the sense that the tests fail if the code and
    the constant disagree. They are checked here anyway so that ONE run names all
    four at once with the derived number, instead of four separate assertion
    failures a reader has to reconcile by hand.
    """
    found: list[tuple[Path, int, str, int]] = []
    for f in sorted(HOST_TEST.rglob("*.ts")):
        for lineno, line in enumerate(f.read_text().splitlines(), 1):
            m = re.match(
                r"\s*const\s+(EXPECTED_TOOL_COUNT|FULL_TOOL_COUNT)\s*=\s*(\d+)", line
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
      `runtime_*` plane's 14, a rival's "162-tool ceiling") carry no such marker
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


def toolset_sizes() -> dict[str, int]:
    """toolset id -> how many tools it registers, resolved through toolsets.ts.

    Each entry maps an id to one `register*Tools` call, and that function is
    imported from a known file, so the count is that file's registrations. The
    `editor` group is the one special case: `tools/editor.ts` re-exports the
    `tools/editor/*.ts` modules, so its size is the directory total.
    """
    text = (HOST_SRC / "toolsets.ts").read_text()
    imports = dict(
        re.findall(r'import\s*\{\s*(register\w+)\s*\}\s*from\s*"\./([^"]+)\.js"', text)
    )

    def count_in(path: Path) -> int:
        if not path.exists():
            return 0
        body = path.read_text()
        return len(re.findall(r'registerTool\(\s*"[a-z0-9_]+"', body)) + len(
            re.findall(r'registerTaskTool\(\s*\w+\s*,\s*"[a-z0-9_]+"', body)
        )

    sizes: dict[str, int] = {}
    for tid, fn in re.findall(r'\{\s*id:\s*"([a-z]+)".*?(register\w+Tools)\(', text, re.S):
        rel = imports.get(fn)
        if not rel:
            continue
        f = HOST_SRC / f"{rel}.ts"
        n = count_in(f)
        d = HOST_SRC / rel
        if d.is_dir():
            n += sum(count_in(x) for x in sorted(d.rglob("*.ts")))
        sizes[tid] = n
    return sizes


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


def toolset_claims(files: list[Path]) -> tuple[list[str], list[tuple[Path, int, int, str]]]:
    """(mismatches, unresolved) — exact check of `<ids>` -> N claims, plus every
    other "N tools" phrase listed for a human to eyeball."""
    sizes = toolset_sizes()
    aliases = toolset_aliases()
    mismatches: list[str] = []
    resolved_lines: set[tuple[Path, int]] = set()

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
    return mismatches, unresolved


# --- 13 helpers: prefix families, the all-false class, and a rival's ceiling -
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
#      a RIVAL's tool ceiling. Named individually with a reason in
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
        "godot-mcp-pro's ceiling — a rival's surface, quoted to say which group "
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


def catalog_index_tools() -> set[str]:
    text = CATALOG.read_text()
    tools: set[str] = set()
    # Rows of the form: | `tool_name` | ... | ... | ... |
    for m in re.finditer(r"^\|\s*`([a-z0-9_]+)`\s*\|", text, re.M):
        tools.add(m.group(1))
    return tools


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

# --- 3: tool-name uniqueness + net completeness ----------------------------
tools = registered_tools()
dupes = sorted({t for t in tools if tools.count(t) > 1})
if dupes:
    errors.append(f"Duplicate registerTool names: {dupes}")

# A name the net misses is invisible to checks 3, 4, 6 and 11 at once, and the
# gate's output is byte-identical to a clean run. Assert the net saw every site
# rather than trusting the count it produced.
uncaptured = uncaptured_tool_registrations()
if uncaptured:
    errors.append(
        "Tool registration(s) whose name the scanner cannot match "
        f"(invisible to the catalog, annotation and count checks): {uncaptured}"
    )

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

# --- 5: JSON lint -----------------------------------------------------------
bad_json = 0
for i, block in enumerate(catalog_json_blocks()):
    try:
        json.loads(block)
    except json.JSONDecodeError as e:
        bad_json += 1
        errors.append(f"Invalid JSON block #{i+1} in catalog: {e}")

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
family_mismatches, family_unresolved = toolset_claims(TOOL_COUNT_FILES)
surface_claim_keys = {(f, ln) for f, ln, _k, _n, _s in count_claims}
family_unresolved = [c for c in family_unresolved if (c[0], c[1]) not in surface_claim_keys]

if family_mismatches:
    errors.append(
        "Toolset-subset count(s) disagree with the code — this is the class that "
        "shipped `c` documented as 14 runtime tools when it was 24, and "
        "`editor,runtime,vcs` as 172 when it was 182:\n      - "
        + "\n      - ".join(family_mismatches)
    )

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
bad_constants = [
    f"{f.relative_to(ROOT)}:{ln} {name} = {v}" for f, ln, name, v in count_constants if v != total_tools
]
if bad_constants:
    errors.append(
        f"Host-test tool-count constants disagree with the {total_tools} registered "
        f"tools: {bad_constants}"
    )

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
]

# Directories the roster scan must not walk. Build output and scratch are not
# "an ungated copy of the addon" — failing on them would make a release gate
# fire on a developer's own working tree, which is how a gate gets disabled.
# `_to_delete/` is the bridge-scratch convention; `host/addon/` is generated.
VERSION_SCAN_SKIP = {
    ".git", "node_modules", "__pycache__", "dist", "dist-test", "addon", "_to_delete", ".godot",
}


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

host_sites = [
    ("host/package-lock.json .version", lock_root),
    ('host/package-lock.json .packages[""].version', lock_self),
    ("host/src/index.ts serverInfo", _one(r'\{ name: "breakpoint-mcp", version: "([^"]+)" \}', Path("host/src/index.ts"), "serverInfo version")),
    ("README.md badge", _one(r"^> \*\*npm ([0-9]+\.[0-9]+\.[0-9]+) ", Path("README.md"), "npm version")),
    ("docs/USER_GUIDE.md stamp", _one(r"^- \*\*Version:\*\* host ([0-9]+\.[0-9]+\.[0-9]+) ", Path("docs/USER_GUIDE.md"), "host version")),
]
host_compared = [(w, g) for w, g in host_sites if g is not None]
bad_host = [f"{where} says {got}" for where, got in host_compared if got != host_version]
if bad_host:
    errors.append(
        f"Host version drift — {HOST_VERSION_SOURCE} says {host_version}, but: "
        + "; ".join(bad_host)
        + ". A release bump touches FIVE files (package-lock.json carries two fields); "
        "missing one ships a binary whose serverInfo or docs contradict the tarball."
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
SHEBANG_NONEXEC_EXPECTED = 13  # +1 session 147: host/verify_shot_editor_live.mjs


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
    shebang_nonexec = []
    for rel, mode in tracked_modes.items():
        if rel.suffix not in (".mjs", ".ts") or mode == "100755":
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
            f"check 15: {shebang_nonexec_count} tracked .mjs/.ts file(s) carry `#!` while committed "
            f"non-executable, but the comment beside EXEC_ROSTER says {SHEBANG_NONEXEC_EXPECTED}. "
            f"These are invoked as `node <file>`, so 100644 is correct — but the count is prose that "
            f"goes stale silently. Update SHEBANG_NONEXEC_EXPECTED and re-read that comment. "
            f"Current set: {listed}."
        )

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
    f"{len(FAMILY_COUNT_EXEMPT)} exempt (rival ceiling)"
)
print(
    f"Host test suite         : {host_test_count} test(s) declared under host/test "
    f"· {len(test_count_claims)} doc claim(s) checked"
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
for w in warnings:
    print("WARN:", w)
for e in errors:
    print("FAIL:", e)
if not errors:
    print("\nALL HARD CHECKS PASSED ✅")
sys.exit(1 if errors else 0)
