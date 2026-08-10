#!/usr/bin/env python3
"""THE SPEC-CONFORMANCE LEDGER — does a string we ship still name a method the
protocol defines?

223 §5 fixed eleven shipped strings that named `tasks/result` and `tasks/list`,
methods revision 2026-07-28 deletes.  A human found them by reading a changelog.
Nothing in this tree could have found them, and nothing would find the next set.

THE POPULATION IS OUR OWN SHIPPED SURFACE, NOT THE LEDGER.  Every method-shaped
string in the scanned files is in the population; `docs/mcp_method_ledger.json`
is used only to CLASSIFY those strings against what each published revision
actually defines.  Adding a revision to the ledger can move a string from
unclassified to classified.  It can never add a string to the population, and it
can never shrink it.  That is `assetlib_sweep.py`'s invariant one instrument
over, and 222 §2's reason for it holds here unchanged: a gate reading a roster is
a gate over a population somebody chose, and an instrument that ships its own
list of things to look for reproduces the defect it was built to catch.

FOUR CLASSES, AND ONLY ONE OF THEM CAN FAIL A RUN.  The distinction is not
severity, it is who reads the string:

  SHIPPED  a method name inside PROSE — a tool description, a resource payload,
           a sentence in a doc.  A person or a model reads this and believes it.
           This is the refusal population.
  WIRE     a bare method token in a string literal with no spaces —
           `call("ping")`, `send("initialize", …)`.  In this tree every one of
           these is the Godot bridge, the language server or the debug adapter,
           none of which is MCP.  An actual MCP request is made by the SDK, not
           by us.
  LOG      inside a `log(…)` call.  `host/src/logger.ts` writes only to stderr;
           stdout is reserved for the stdio transport, so no client ever sees it.
  COMMENT  a comment line.  Comments outlive their docs on purpose and saying so
           is `host/src/tasks.ts:25`'s whole job.

🔴 THE CLASSES ARE COUNTED AND PRINTED EVERY RUN, GREEN OR RED.  222 §22's idiom:
what a gate does NOT cover is invisible by construction, so the size of each
exclusion appears next to the size of the population on every single run.  The
third number in this tree whose only job is to say what a gate does not read.

🔴 NO ANNOTATION ESCAPE, DELIBERATELY.  An earlier draft let a site opt out by
carrying a comment naming the deleting revision.  That is the shape `tasks.ts`
already uses — and its annotation asserts "no shipped tool description advertises
them", a claim nothing checks and which was ALREADY FALSE for the adjacent pair
when it was written.  An exemption a gate cannot verify is a promise, and this
file refuses to accept promises.  A comment is out of scope because comments are
not shipped, not because a comment says so.

Usage:
  python3 scripts/spec_conformance.py             # the report
  python3 scripts/spec_conformance.py --check     # exit 1 on a nonconformant string
  python3 scripts/spec_conformance.py --selftest  # the scanner's own pins, no network
  python3 scripts/spec_conformance.py --refresh   # re-derive the ledger from upstream
  python3 scripts/spec_conformance.py --json      # machine output, exclusions included
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, "docs", "mcp_method_ledger.json")

SPEC_RAW = (
    "https://raw.githubusercontent.com/modelcontextprotocol/"
    "modelcontextprotocol/main/schema/{rev}/schema.json"
)
EXT_TASKS_RAW = (
    "https://raw.githubusercontent.com/modelcontextprotocol/"
    "ext-tasks/main/schema/draft/schema.ts"
)

# Files whose prose reaches a user or a model.  Directories are walked.
SCANNED = [
    "host/src",
    "docs",
    "addons",
    "README.md",
    "host/README.md",
]
SCANNED_SUFFIXES = (".ts", ".md", ".gd", ".mjs")

# 🔴 DELIBERATELY OUTSIDE THE POPULATION, EACH WITH THE REASON, AND EACH COUNTED
# RATHER THAN SILENCED.  An exclusion is something a reader can argue with only
# if its size prints next to the population's.
EXCLUDED = {
    "CHANGELOG.md": (
        "append-only history.  A released note describing what a version did to a "
        "method string is a record of the past, and correcting it would make the "
        "history wrong rather than the surface right.  The same class checks 10 "
        "and 12 exclude it from."
    ),
    "host/test": (
        "tests name methods in order to assert on them; a test that stopped "
        "mentioning a removed method would stop testing the removal."
    ),
}

# 🔴 THE METHODS THIS SCANNER CANNOT SEE, DECLARED RATHER THAN QUIETLY MISSED.
# Both are real MCP methods that 2026-07-28 removes.  Both are also single English
# words, and in THIS tree every occurrence of them belongs to another protocol —
# the Godot bridges name their liveness opcode `ping` (and `editor_ping` is a
# shipped tool built on it), while the language server and the debug adapter both
# call their handshake `initialize`.
#
# 🔴 AN EARLIER DRAFT KEPT THEM IN THE SHAPE AND SUPPRESSED THEM BY ROSTER.  Run
# against the live tree it produced thirty-nine hits, TWO of which survived into
# the refusal population — `status_dock.gd`'s "a bare ping still answers" and
# `peers.ts`'s "never answered ping", both about the bridge, both about to be
# rewritten by a maintainer to satisfy a gate that was wrong.  A suppression
# roster cannot separate a word from itself.  So the shape declines them, the
# decline is a NUMBER printed on every run, and nobody gets to believe this file
# covers thirty-four methods when it covers thirty-two.
UNCOVERED_METHODS = {
    "ping": (
        "a single English word, and the editor and runtime bridges both name their "
        "liveness opcode `ping`"
    ),
    "initialize": (
        "a single English word, and the LSP and DAP handshakes are both called "
        "`initialize`"
    ),
}

NS = (
    r"(?:notifications|tools|resources|prompts|sampling|roots|completion|logging"
    r"|elicitation|tasks|subscriptions|server|experimental)"
)
# Left guard kills `res://addons/…`, `godot://runtime/tree`, `src/tools/list`,
# `http://json-schema.org/…` and every continuation of a longer path.
# Right guard stops `ping` matching `pinging` and `tools/list` matching
# `tools/list_changed` mid-token.
SHAPE = re.compile(
    rf"(?<![\w./:$#-])"
    rf"{NS}/[a-zA-Z_][a-zA-Z0-9_]*(?:/[a-zA-Z_][a-zA-Z0-9_]*)?"
    rf"(?![\w-])"
)

COMMENT_START = re.compile(r"^\s*(?://|\*|/\*|\*/|#|<!--)")
LOG_CALL = re.compile(r"\blog\s*\(")
# A string literal with no space in it is a bare token — a wire opcode, not prose.
BARE_TOKEN = re.compile(r"""["'`]([^"'`\s]+)["'`]""")
# 🔴 IN MARKDOWN A BACKTICKED METHOD NAME IS PROSE, NOT A WIRE TOKEN.  `tasks/get`
# written in a sentence is exactly how a doc names a method, and the first draft of
# this file read all four TOOL_CATALOG.md sites as opcodes and found nothing there.
PROSE_ONLY_SUFFIXES = (".md",)

CLASSES = ("shipped", "wire", "log", "comment")

# ── the scanner's own pins ────────────────────────────────────────────────────
# (line, expected methods, expected class, why this row is in the table).
# Rows expecting NOTHING are the ones that matter most: half of what this file
# must get right is what it declines to see.
PINS = [
    (
        '  "Exposed as an MCP task (poll/cancel via tasks/get, tasks/cancel).",',
        ("tasks/get", "tasks/cancel"), "shipped", ".ts",
        "🔴 host/src/tools/cli.ts:182 verbatim — the defect class this file exists for",
    ),
    (
        "task-aware clients poll/cancel it via `tasks/get` / `tasks/cancel`;",
        ("tasks/get", "tasks/cancel"), "shipped", ".md",
        "🔴 docs/TOOL_CATALOG.md:102 verbatim. THE ROW THE FIRST DRAFT GOT WRONG — a "
        "backticked method name has no spaces inside its delimiters, so the wire-token "
        "rule read all four catalog sites as opcodes and the gate found nothing in the "
        "docs at all.  In markdown a code span IS prose",
    ),
    (
        '    return call("tools/list");',
        ("tools/list",), "wire", ".ts",
        "🔴 a bare token in a source string is a wire opcode.  Prose and token must "
        "not be the same class, and this is the shape that separates them",
    ),
    (
        "  log(`resources/subscribe ${uri} (${subs.size} active)`);",
        ("resources/subscribe",), "log", ".ts",
        "🔴 THE ROW A CLASSIFIER ORDERED WRONGLY GETS BACKWARDS.  This literal is "
        "full of spaces, so a prose-vs-token test alone reads it as SHIPPED — the "
        "log check must run first, and logger.ts writes only to stderr",
    ),
    (
        " * the SDK installs the tasks/get, tasks/result, tasks/list and tasks/cancel",
        ("tasks/get", "tasks/result", "tasks/list", "tasks/cancel"), "comment", ".ts",
        "host/src/tasks.ts:27 verbatim — four methods on one line are four rows",
    ),
    (
        "import { registerEditorTools } from './tools/editor.js';",
        (), "shipped", ".ts",
        "🔴 OUR OWN SOURCE PATHS.  `tools/` is a real namespace and a real "
        "directory; the left guard must drop the one behind a slash",
    ),
    (
        "  const p = 'res://addons/breakpoint_mcp/plugin.cfg';",
        (), "shipped", ".ts",
        "🔴 a res:// path — the guard that keeps the next path-shaped string out",
    ),
    (
        "Enable or disable it, and read the logs/output panel either way.",
        (), "shipped", ".md",
        "🔴 `logs/output` is English prose with a slash.  `logging` is a namespace; "
        "`logs` is not, and the allowlist is the only thing that knows",
    ),
    (
        "subscribe to tools/list-changed to hear about it",
        (), "shipped", ".md",
        "🔴 THE RIGHT GUARD.  A hyphen after a method name means the token is not "
        "that method, and the scan must not settle for the prefix it can see",
    ),
    (
        "we also answer tools/inventEd, which no revision defines",
        ("tools/inventEd",), "shipped", ".md",
        "🔴 A SHAPED STRING NO REVISION DEFINES MUST STILL BE SEEN.  It leaves as "
        "UNCLASSIFIED rather than as silence — the same direction check 25 refuses a "
        "numeral no reader claims, and the reason a typo in a method name cannot "
        "pass by being unrecognisable",
    ),
    (
        "Poll it with tools/list and call it with tools/call.",
        ("tools/list", "tools/call"), "shipped", ".md",
        "the two names that are both real methods AND plausible filenames — a path "
        "heuristic would lose exactly these",
    ),
    (
        "  # notifications/resources/updated is emitted by the addon on save",
        ("notifications/resources/updated",), "comment", ".gd",
        "a GDScript comment.  Three segments, and the shape must take all three",
    ),
    (
        "See the undo/redo stack and the request/response pair.",
        (), "shipped", ".md",
        "🔴 English `a/b` prose.  Neither `undo` nor `request` is a namespace, and "
        "that is the whole defence",
    ),
    (
        '          const why = m?.exited ? `exited` : "never answered ping";',
        (), "shipped", ".ts",
        "🔴 host/src/peers.ts:250 verbatim, AND THE REASON `ping` LEFT THE SHAPE.  "
        "This sentence is shipped prose about the Godot bridge; a roster keyed by "
        "method name cannot tell it from a sentence about MCP, because they are the "
        "same word.  UNCOVERED_METHODS declares the miss instead of hiding it",
    ),
]


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "breakpoint-mcp-spec-gate"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def load_ledger() -> dict:
    with open(LEDGER, encoding="utf-8") as f:
        return json.load(f)


def scanned_files() -> "list[str]":
    out = []
    for entry in SCANNED:
        p = os.path.join(ROOT, entry)
        if os.path.isfile(p):
            out.append(p)
            continue
        for base, dirs, names in os.walk(p):
            dirs[:] = [d for d in dirs if d not in ("node_modules", "dist", "__pycache__")]
            for n in sorted(names):
                if n.endswith(SCANNED_SUFFIXES):
                    out.append(os.path.join(base, n))
    return sorted(out)


def classify(line: str, method: str, suffix: str = ".ts") -> str:
    """Which of the four classes this hit belongs to.  ORDER IS THE DESIGN."""
    if COMMENT_START.match(line):
        return "comment"
    if suffix in PROSE_ONLY_SUFFIXES:
        return "shipped"
    if LOG_CALL.search(line):
        return "log"
    for tok in BARE_TOKEN.findall(line):
        if tok == method:
            return "wire"
    return "shipped"


def hits(path: str) -> "list[tuple[int, str, str, str]]":
    """(line number, method, class, the whole line) for one file."""
    try:
        text = open(path, encoding="utf-8").read()
    except (OSError, UnicodeDecodeError):
        return []
    out = []
    for ln, line in enumerate(text.splitlines(), 1):
        for m in SHAPE.finditer(line):
            out.append((
                ln, m.group(0),
                classify(line, m.group(0), os.path.splitext(path)[1]),
                line.strip(),
            ))
    return out


def pin_problems() -> "tuple[list[str], int, int]":
    """(disagreements, rows read, rows that pin the scanner to see NOTHING)."""
    problems, negatives = [], 0
    for line, expected, klass, suffix, why in PINS:
        if not expected:
            negatives += 1
        got = tuple(m.group(0) for m in SHAPE.finditer(line))
        if got != expected:
            problems.append(f"{line.strip()!r} -> {got}, pinned {expected} — {why}")
            continue
        for method in got:
            actual = classify(line, method, suffix)
            if actual != klass:
                problems.append(
                    f"{line.strip()!r} classes {method} as {actual}, pinned {klass} — {why}"
                )
    return problems, len(PINS), negatives


def refresh() -> int:
    """Re-derive every revision's method set from upstream and diff the ledger."""
    ledger = load_ledger()
    drift = []
    for rev in ledger["revisions"]:
        name = rev["revision"]
        try:
            schema = json.loads(get(SPEC_RAW.format(rev=name)))
        except (urllib.error.URLError, OSError, ValueError) as e:
            print(f"  UNREACHABLE  {name}: {e}", file=sys.stderr)
            return 2
        live = set()
        stack = [schema]
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                m = node.get("method")
                if isinstance(m, dict) and isinstance(m.get("const"), str):
                    live.add(m["const"])
                stack.extend(node.values())
            elif isinstance(node, list):
                stack.extend(node)
        have = set(rev["methods"])
        if live != have:
            drift.append(
                f"{name}: ledger has {sorted(have - live)} upstream does not; "
                f"upstream has {sorted(live - have)} ledger does not"
            )
        print(f"  ok   {name:<12} {len(live)} method(s)")
    if drift:
        print("\n🔴 LEDGER DRIFT:\n      - " + "\n      - ".join(drift), file=sys.stderr)
        return 1
    print("\nLEDGER CURRENT — every revision's method set matches upstream.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="exit 1 on a nonconformant string")
    ap.add_argument("--selftest", action="store_true", help="the scanner's own pins")
    ap.add_argument("--refresh", action="store_true", help="re-derive the ledger upstream")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    bad_pins, pins_read, pins_negative = pin_problems()
    if bad_pins:
        print(
            "🔴 SPEC_SCANNER_UNPINNED — the scanner disagrees with its own pins, so "
            "every number below is over a different population than the documented "
            "one:\n      - " + "\n      - ".join(bad_pins),
            file=sys.stderr,
        )
        return 1
    if args.selftest:
        print(
            f"SPEC_CONFORMANCE selftest ok — {pins_read} pin(s), {pins_negative} of "
            f"them negative, shape and class both pinned on every row"
        )
        return 0

    if args.refresh:
        return refresh()

    ledger = load_ledger()
    current = ledger["current"]
    by_rev = {r["revision"]: set(r["methods"]) for r in ledger["revisions"]}
    live = by_rev[current]
    ext = {m for e in ledger["extensions"].values() for m in e["methods"]}
    ever = set().union(*by_rev.values()) | ext
    migrations = ledger["migrations"]

    counts = dict.fromkeys(CLASSES, 0)
    findings, unclassified = [], []
    excluded_hits = 0
    files_read = 0

    for path in scanned_files():
        rel = os.path.relpath(path, ROOT)
        if any(rel == e or rel.startswith(e + os.sep) for e in EXCLUDED):
            excluded_hits += len(hits(path))
            continue
        files_read += 1
        for ln, method, klass, line in hits(path):
            counts[klass] += 1
            if klass != "shipped":
                continue
            if method in live:
                continue
            if method not in ever:
                unclassified.append(f"{rel}:{ln} names `{method}` — “{line[:100]}”")
                continue
            where = "core" if method in ext else "anywhere"
            findings.append(
                f"{rel}:{ln} ships `{method}`, removed from {where} in {current} — "
                f"{migrations.get(method, 'no migration recorded')} — “{line[:90]}”"
            )

    total = sum(counts.values())
    if args.json:
        print(json.dumps({
            "current": current, "declared": ledger["declared"]["revision"],
            "files_read": files_read, "hits": counts, "total": total,
            "excluded_hits": excluded_hits, "excluded": list(EXCLUDED),
            "uncovered_methods": list(UNCOVERED_METHODS),
            "findings": findings, "unclassified": unclassified,
            "pins": pins_read, "pins_negative": pins_negative,
        }, indent=2))
    else:
        print(f"Spec conformance — current revision {current} · we negotiate "
              f"{ledger['declared']['revision']}")
        print(f"  files read           : {files_read}")
        print(f"  SHIPPED (prose)      : {counts['shipped']}   <- the refusal population")
        print(f"  wire tokens          : {counts['wire']}")
        print(f"  stderr log strings   : {counts['log']}")
        print(f"  comments             : {counts['comment']}")
        # 🔴 THE ADMITTED SCOPE, PRINTED AS A NUMBER ON GREEN RUNS.
        print(f"  …not covered         : {total - counts['shipped']} of {total} hit(s) "
              f"in classes no client reads · {excluded_hits} more in "
              f"{', '.join(EXCLUDED)}")
        print(f"  pins                 : {pins_read} ({pins_negative} negative)")
        # 🔴 AND THE SECOND ADMITTED SCOPE — the methods the SHAPE ITSELF declines.
        print(f"  …shape declines      : {len(UNCOVERED_METHODS)} of "
              f"{len(ever) + len(UNCOVERED_METHODS)} known method(s) "
              f"({', '.join(sorted(UNCOVERED_METHODS))}) — single English words")
        for f in findings:
            print(f"  🔴 {f}")
        for u in unclassified:
            print(f"  🔴 UNCLASSIFIED {u}")

    if findings or unclassified:
        if args.check:
            print(
                f"\nSPEC NONCONFORMANT: {len(findings)} shipped string(s) name a method "
                f"{current} removed, {len(unclassified)} name a method no revision "
                f"defines.  Rewrite the prose — do not add an exemption.  A wire verb "
                f"in a description is the client's business and it moves between "
                f"revisions; say what the tool does, not which RPC polls it.",
                file=sys.stderr,
            )
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
