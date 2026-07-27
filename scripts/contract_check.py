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

Exit code 0 = all hard checks pass; 1 = a hard check failed.
"""
import json
import re
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
        for lm in re.finditer(r'^\s*"([a-z_][a-z_.]*)":\s*$', body, re.M):
            methods.add(lm.group(1))
    return methods


def host_bridge_calls(ts_files: list[Path]) -> set[str]:
    """String methods passed to call("..") or *.request("..") in given files."""
    calls: set[str] = set()
    for f in ts_files:
        text = f.read_text()
        for m in re.finditer(r'\bcall\(\s*"([a-z_][a-z_.]*)"', text):
            calls.add(m.group(1))
        for m in re.finditer(r'\.request\(\s*"([a-z_][a-z_.]*)"', text):
            calls.add(m.group(1))
    return calls


def registered_tools() -> list[str]:
    names: list[str] = []
    for f in sorted(TOOLS.rglob("*.ts")):
        text = f.read_text()
        # Plain tools: server.registerTool("name", ...)
        for m in re.finditer(r'registerTool\(\s*"([a-z_]+)"', text):
            names.append(m.group(1))
        # Task-model tools (D2): registerTaskTool(server, "name", ...)
        for m in re.finditer(r'registerTaskTool\(\s*\w+\s*,\s*"([a-z_]+)"', text):
            names.append(m.group(1))
    return names


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
    "(the 286-tool\n * count is unchanged)" and `capabilities.ts` says
    "The full\n * 286-tool surface". A line-by-line scan sees neither, and an
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


def catalog_index_tools() -> set[str]:
    text = CATALOG.read_text()
    tools: set[str] = set()
    # Rows of the form: | `tool_name` | ... | ... | ... |
    for m in re.finditer(r"^\|\s*`([a-z_]+)`\s*\|", text, re.M):
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
        regs = list(re.finditer(r'register(?:Task)?Tool\(\s*(?:\w+\s*,\s*)?"([a-z_]+)"', text))
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


def catalog_shapes() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """Per-tool documented Input/Output property names from the catalog's
    `**Input**` / `**Output**` JSON blocks. `confirm` excluded from inputs."""
    text = CATALOG.read_text()
    parts = re.split(r"^###\s+`([a-z_]+)`", text, flags=re.M)
    inputs: dict[str, set[str]] = {}
    outputs: dict[str, set[str]] = {}
    for i in range(1, len(parts), 2):
        name, body = parts[i], parts[i + 1]
        for label, bucket in (("Input", inputs), ("Output", outputs)):
            lm = re.search(rf"\*\*{label}\*\*\s*\n```json\n(.*?)```", body, re.S)
            if not lm:
                continue
            try:
                props = json.loads(lm.group(1)).get("properties")
            except json.JSONDecodeError:
                continue
            if isinstance(props, dict):
                bucket[name] = set(props.keys())
    for name in inputs:
        inputs[name] -= IGNORED_PARAMS
    return inputs, outputs


# --- 1 & 2: GDScript dispatch <-> host calls -------------------------------
editor_methods = dispatch_methods(ADDON / "operations.gd", ["dispatch"])
runtime_methods = dispatch_methods(ADDON / "runtime_bridge.gd", ["_dispatch"])
gd_all = editor_methods | runtime_methods
host_calls = host_bridge_calls([*sorted((TOOLS / "editor").glob("*.ts")), TOOLS / "runtime.ts", TOOLS / "resources.ts", TOOLS / "assetgen.ts", TOOLS / "netcode.ts", TOOLS / "backend.ts"])

missing_in_gd = sorted(c for c in host_calls if c not in gd_all)
if missing_in_gd:
    errors.append(f"Host calls bridge methods with no GDScript handler: {missing_in_gd}")

orphans = sorted(m for m in gd_all if m not in host_calls and m != "ping")
if orphans:
    warnings.append(f"GDScript dispatch methods never called by host (ok if intentional): {orphans}")

# --- 3: tool-name uniqueness -----------------------------------------------
tools = registered_tools()
dupes = sorted({t for t in tools if tools.count(t) > 1})
if dupes:
    errors.append(f"Duplicate registerTool names: {dupes}")

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
cat_inputs, cat_outputs = catalog_shapes()
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

count_constants = test_count_constants()
bad_constants = [
    f"{f.relative_to(ROOT)}:{ln} {name} = {v}" for f, ln, name, v in count_constants if v != total_tools
]
if bad_constants:
    errors.append(
        f"Host-test tool-count constants disagree with the {total_tools} registered "
        f"tools: {bad_constants}"
    )

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
print(f"Catalog JSON blocks     : {len(catalog_json_blocks())} ({bad_json} invalid)")
print(f"Input shapes            : {len(code_inputs)} parsed · {len(input_comparable)} checked vs catalog")
print(f"Output shapes           : {len(code_outputs)} in schemas.ts · {len(output_comparable)} checked vs catalog")
print()
for w in warnings:
    print("WARN:", w)
for e in errors:
    print("FAIL:", e)
if not errors:
    print("\nALL HARD CHECKS PASSED ✅")
sys.exit(1 if errors else 0)
