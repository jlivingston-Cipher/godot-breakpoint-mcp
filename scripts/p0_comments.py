#!/usr/bin/env python3
"""P0 · comment inventory — every comment in host/src and scripts/, classified.

Five buckets, in the charter's words:
  describes-this-code / describes-other-code / TODO-FIXME / commented-out-code /
  section-marker

The bucket that matters is DESCRIBES-OTHER-CODE. It is §8.4 of the handoff — "a
mechanism in a comment that nothing compares" — carried unpaid since 205, and this
pass is the first thing that gives it a population.

A comment is describes-other-code when its text names something that lives somewhere
else: a path with a source suffix, a session citation (`193 §12.27`), a bare `§n`, or
a `file.py`-shaped token. Those are exactly the comments whose truth is a claim about
a part of the tree the comment does not sit in, and therefore the ones nothing checks.
"""
from __future__ import annotations

import io
import re
import sys
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "host" / "src"
SCRIPTS = ROOT / "scripts"

# ── classification ────────────────────────────────────────────────────────────────
# 🔴 A BARE WORD BOUNDARY MATCHED THIS FILE'S OWN DOCSTRING. The bucket is named
# "TODO-FIXME" in the header above, and `\b(TODO|FIXME)\b` filed the sentence naming
# the bucket INTO the bucket — so the reporter put itself in its own population and the
# tree-wide count went 0 -> 1 the moment this script joined `scripts/`. Requiring the
# conventional annotation form (`TODO:` / `FIXME(`) is the fix; self-exclusion would
# have been a different lie, and a louder one.
TODO_RE = re.compile(r"\b(TODO|FIXME|XXX|HACK)\s*[:(]")
SECTION_RE = re.compile(r"[─━=*#~_-]{6,}")
PATH_RE = re.compile(r"[\w./-]+\.(ts|mjs|js|py|md|json|gd|cfg|yml|yaml)\b")
SESSION_RE = re.compile(r"\b\d{2,3}\s*§[\d.]+|\B§[\d.]+")
# 🔴 THE FIRST DRAFT OF THIS PREDICATE CLASSIFIED PROSE AS CODE, and it did it the way
# a loose anchor always does — by matching a punctuation mark instead of a grammar. Any
# comment line ending in `;` was called commented-out-code, so
#
#     "Screenshot tools that return an in-memory buffer count as read-only;"
#
# landed in the bucket. A semicolon is the most common mid-sentence mark in this tree's
# prose. The fix is to require a STATEMENT KEYWORD or an assignment/call shape *and* a
# short, dense line — not a terminator. The count moved 49 -> the number printed below,
# and the difference is entirely false positives.
CODEISH_RE = re.compile(
    r"^\s*(const |let |var |if\s*\(|for\s*\(|while\s*\(|return[\s;]|function\s|import\s|"
    r"export\s|await\s|class\s+\w+|def\s+\w+\s*\(|print\(|\}|\{\s*$)"
)
ASSIGN_CALL_RE = re.compile(r"^\s*[\w.\[\]\"']+\s*(=[^=]|\.\w+\()")
PROSE_HINT_RE = re.compile(
    r"\b(the|a|an|is|are|was|were|that|which|because|so|and|but|it|this|not|"
    r"would|should|does|has|have|its|one|no)\b",
    re.I,
)


def _looks_like_code(s: str) -> bool:
    """A statement, not a sentence. Requires a code shape AND code-ish density."""
    words = s.split()
    if len(words) > 12:
        return False
    if s.rstrip().endswith((".", ":", "?", "!", ",", "—")):
        return False
    if not (CODEISH_RE.match(s) or ASSIGN_CALL_RE.match(s)):
        return False
    # a line whose tokens are mostly English function words is prose that happens to
    # start with a keyword ("return the list, not the count")
    prose = len(PROSE_HINT_RE.findall(s))
    return prose <= max(1, len(words) // 5)


def classify(body: str) -> str:
    stripped = body.strip()
    if not stripped:
        return "section-marker"
    if SECTION_RE.search(stripped) and len(re.sub(r"[─━=*#~_-]", "", stripped).strip()) < 60:
        return "section-marker"
    if TODO_RE.search(stripped):
        return "TODO-FIXME"
    if PATH_RE.search(stripped) or SESSION_RE.search(stripped):
        return "describes-other-code"
    if _looks_like_code(stripped):
        return "commented-out-code"
    return "describes-this-code"


# ── extraction ────────────────────────────────────────────────────────────────────
def ts_comments(text: str):
    """Line/block comments from a .ts source, skipping strings and template literals."""
    out, i, n = [], 0, len(text)
    line = 1
    while i < n:
        c = text[i]
        if c == "\n":
            line += 1
            i += 1
            continue
        if c in "\"'`":
            quote, i = c, i + 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == "\n":
                    line += 1
                    if quote != "`":
                        break
                if text[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            j = n if j == -1 else j
            out.append((line, text[i + 2 : j]))
            i = j
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            j = n if j == -1 else j + 2
            seg = text[i:j]
            out.append((line, seg[2:-2] if seg.endswith("*/") else seg[2:]))
            line += seg.count("\n")
            i = j
            continue
        i += 1
    return out


def py_comments(text: str):
    out = []
    try:
        for tok in tokenize.generate_tokens(io.StringIO(text).readline):
            if tok.type == tokenize.COMMENT:
                out.append((tok.start[0], tok.string.lstrip("#")))
            elif tok.type == tokenize.STRING and tok.line.strip().startswith(('"""', "'''")):
                out.append((tok.start[0], tok.string.strip("\"'")))
    except (tokenize.TokenError, IndentationError):
        pass
    return out


def main() -> int:
    rows = []
    for base, glob, reader in ((SRC, "**/*.ts", ts_comments), (SCRIPTS, "*.py", py_comments)):
        for f in sorted(base.rglob(glob.split("/")[-1]) if "**" in glob else base.glob(glob)):
            text = f.read_text(encoding="utf-8", errors="replace")
            for lineno, body in reader(text):
                # a block/docstring comment is classified per non-empty line
                for k, sub in enumerate(body.split("\n")):
                    if not sub.strip():
                        continue
                    rows.append(
                        {
                            "file": str(f.relative_to(ROOT)),
                            "line": lineno + k,
                            "bucket": classify(sub),
                            "text": sub.strip()[:160],
                        }
                    )

    counts: dict[str, int] = {}
    per_area: dict[tuple[str, str], int] = {}
    for r in rows:
        counts[r["bucket"]] = counts.get(r["bucket"], 0) + 1
        area = "host/src" if r["file"].startswith("host/src") else "scripts"
        per_area[(area, r["bucket"])] = per_area.get((area, r["bucket"]), 0) + 1

    print(f"=== COMMENT INVENTORY — {len(rows)} comment line(s) ===\n")
    order = [
        "describes-this-code",
        "describes-other-code",
        "TODO-FIXME",
        "commented-out-code",
        "section-marker",
    ]
    print(f"{'bucket':<24}{'total':>8}{'host/src':>10}{'scripts':>10}")
    for b in order:
        print(
            f"{b:<24}{counts.get(b,0):>8}"
            f"{per_area.get(('host/src',b),0):>10}{per_area.get(('scripts',b),0):>10}"
        )

    print("\n=== 🔴 describes-other-code — §8.4's population, by file ===")
    byf: dict[str, int] = {}
    for r in rows:
        if r["bucket"] == "describes-other-code":
            byf[r["file"]] = byf.get(r["file"], 0) + 1
    for f, c in sorted(byf.items(), key=lambda kv: -kv[1])[:25]:
        print(f"{c:>5}  {f}")

    print("\n=== TODO-FIXME, every one ===")
    for r in rows:
        if r["bucket"] == "TODO-FIXME":
            print(f"  {r['file']}:{r['line']}  {r['text'][:110]}")

    print("\n=== commented-out-code, first 30 ===")
    n = 0
    for r in rows:
        if r["bucket"] == "commented-out-code":
            print(f"  {r['file']}:{r['line']}  {r['text'][:110]}")
            n += 1
            if n >= 30:
                break
    return 0


if __name__ == "__main__":
    sys.exit(main())
