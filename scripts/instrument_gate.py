#!/usr/bin/env python3
"""instrument_gate.py — session 173. THE BLINDING GATE, POINTED AT THE JS INSTRUMENTS.

172 built `scope_gate.py`: blind each of `contract_check.py`'s enumerators in turn and
assert the run goes RED. It closed 14 finders that could match nothing and still print
ALL HARD CHECKS PASSED, and it named the transferable part — not the ledger, the
harness — then listed the two instruments it had not reached:

    172 §10.2  "_population.mjs's manifests and host/scripts/path-cohort.mjs have never
                been asked the same question. Cheap start: the blinding technique in
                scope_gate.py ports directly."

This is that port. Measured in 173, before a line of fix was written:

    _population.mjs   1 of 8 STILL GREEN   -> reportOrDie()
    path-cohort.ts    0 of 8 STILL GREEN

🔴 AND THE THING THE SWEEP COULD NOT REACH IS WHY THIS FILE HAS THREE INSTRUMENTS AND
NOT TWO. The cohort's own walk was clean, but the LEDGER COMPARISON that consumes it had
no gate anywhere to point a harness at: it lived inline in a probe that boots the Godot
editor GUI under Xvfb, so no case with a known answer had ever been put through it. A
blinding harness reports nothing about an instrument with no gate, and reports it in
green — which is the same observable as "clean". Every instrument listed below must
therefore name a gate that RUNS HEADLESS, and that constraint is the finding.

Run: python3 scripts/instrument_gate.py   (a CI step beside the scope gate)
"""
from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _gate_lock import acquire, run_and_settle  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
HOST = ROOT / "host"

# ── 🔴 `{SIG:name}` — THE ANCHOR THAT STOPS BEING OUTRUN BY ITS OWN SIGNATURE ──────
#
# 195, and it is 188 §2's `{V}` arriving one class over rather than a new idea.
#
# Every target below is a FULL SIGNATURE LITERAL, and that is deliberate: a blind is a
# textual substitution, so a loosened prefix anchor matching two same-named members would
# blind the wrong one SILENTLY (193 §12.27, and the decision was right). The cost is a
# re-point every time a parameter is added, and the tree has paid it out loud:
#
#     judge       (seal_order/boundary/verdict)   9 distinct commits — 7 consecutive
#                                                 sessions for the seal_order one alone
#     judgeScope  (tautology_gate)                5 distinct commits, TWO of them 193/194
#     comparisons (boundary_gate)                 3
#
# 194 §9.2 named the build: resolve the signature instead of spelling it. The placeholder
# does NOT loosen the match — it makes the two things the literal was really asserting
# into assertions of their own, and drops the third:
#
#   EXISTENCE   0 declarations of `name`  -> LOUD. Removing or renaming the function is
#               still caught, which is the whole reason the literal was tolerable.
#   UNIQUENESS  2+ declarations of `name` -> LOUD. This is the case 193 §12.27 refused to
#               let a prefix decide quietly; here it is refused rather than decided.
#   TEXT        the parameter list is exactly this -> DROPPED, on purpose. It never
#               guarded the blind CONSTANT (a return shape is not in a signature) and it
#               is the only thing that was costing anything.
#
# 🔴 AND IT RESOLVES AGAINST THE FILE BEING MUTATED, WHICH `{V}` FORBIDS FOR ITSELF.
# The difference is what the anchor claims. `{V}`'s row claims a value that lives in
# another file, so reading it off the file under mutation would be self-satisfying and
# would take 180 §9.3's guard away. This anchor claims that a named member EXISTS EXACTLY
# ONCE in the file about to be swept — and both halves of that are asserted by the
# resolution, not assumed by it. A resolver that finds nothing fails; one that finds two
# fails. There is no reading of this file that makes either pass.
#
# Measured before a line of this was written (`host/_to_delete/sig195.py`):
# 59 targets · 59 resolve identically to the literal that ships · 0 ambiguous · 0 missing.
SIG_RE = re.compile(r"^\{SIG:(?P<name>[A-Za-z_$][\w$]*)\}$")


def _decl_re(name: str) -> re.Pattern:
    """A DECLARATION of `name` WHOSE BODY IS A BLOCK: it must open one at end of line.

    🆕 212 §4 — AND AN ARROW CONST IS A DECLARATION. This pattern matched `function` forms
    only, so `export const surface = (tools) => {` was unanchorable and every arrow-const
    member of every instrument sat outside the sweep with nothing saying so.

    🔴 MEASURED BEFORE THE WIDENING, NOT AFTER (`probe212_decl.py`): all 65 shipped
    placeholder targets re-resolve IDENTICALLY under the pattern below — 0 changed, 0
    newly ambiguous, and 0 literal anchors that `literal_signature_problems` would newly
    report. It admits 36 members across 6 instruments. A widening that moved even one
    existing resolution would have been a re-point disguised as a coverage increase.

    🔴 THE `=> {` IS REQUIRED FOR THE SAME REASON THE `function` ARM REQUIRES `{`, and it
    is the whole reason 211 §6.5's premise did not survive measurement: `blind()` injects
    a STATEMENT, and a member with no block has nowhere to put one. Concise-body arrows
    are `_concise_re` below, and they needed a second injector rather than a wider anchor.
    """
    n = re.escape(name)
    return re.compile(
        r"^(?P<indent>[ \t]*)(?:"
        r"(?:export[ \t]+)?(?:async[ \t]+)?(?:static[ \t]+)?(?:function[ \t]+)?"
        r"(?:get[ \t]+|set[ \t]+)?" + n + r"[ \t]*\(.*\)[ \t]*\{[ \t]*$"
        r"|(?:export[ \t]+)?(?:const|let|var)[ \t]+" + n +
        r"[ \t]*=[ \t]*(?:async[ \t]+)?\(.*\)[ \t]*=>[ \t]*\{[ \t]*$"
        r")")


# 🔴 A KEYWORD IS NOT A NAME, AND THE PROBE FOUND ONE BEFORE THE CODE DID. Measured over
# the thirteen instruments, the "declaration whose parameter list wraps" shape matches
# TWO sites and only one is a declaration: the other is a `for (` header in
# `tautology_gate.mjs` whose condition runs to a second line. A widening that admitted it
# would resolve `{SIG:for}` to a loop and blind a statement into somebody's iteration.
_NOT_A_NAME = frozenset(("for", "if", "while", "switch", "catch", "with", "return",
                         "typeof", "do", "else", "function", "new", "await", "yield"))


def _decl_span(text: str, name: str) -> "list[tuple[int, str]]":
    """[(1-based line, the WHOLE declaration)] for a parameter list that WRAPS.

    🆕 235 §4 / 234 NEXT 3 (233 NEXT 2, 232 NEXT 13, 205 §7) — `_decl_re` MATCHES ONE
    LINE, so a declaration whose parameters run onto a second cannot be a placeholder.
    Measured before this was written (`probe235_decl.py`, 212's discipline): 92 targets,
    91 placeholders and 1 literal, 92/92 resolving and 0 ambiguous — and the ONE literal
    in the whole roster is here for exactly this reason:

        export function judgeDiscarded(sites, floor = DISCARD_SITE_FLOOR, dirFloor = …,
                                       busiestFloor = DISCARD_BUSIEST_FLOOR) {

    🔴 THE WIDENING ADMITS EXACTLY ONE MEMBER AND MOVES NONE. It is consulted ONLY where
    `_decl_re` and `_concise_re` both find nothing, so no existing resolution can change
    — which is not an argument, it is the reason the probe ran first: all 92 anchors are
    byte-identical before and after. That measurement is a PROBE's, not this tree's, and
    saying so is the point — what the tree checks on every run is `_self_check`'s two
    claims (a keyword is not a name, a single-line declaration never reaches this path)
    and `literal_signature_problems`, which reported the literal below on the first run
    after the widening. The before/after equality is written down in 235 §4 with the
    probe that produced it, because a docstring that claims a `--selftest` this file does
    not have is 234 §4.1 for the third session running.

    🔴 AND WHAT IT REPLACES IS THE HAZARD. A two-line literal anchor is matched by exact
    text: reindent the continuation, or rename one default, and the target still
    "resolves" — literals are returned unchanged — while the blind it names silently
    stops applying. A sweep reporting green over a mutation nobody made is this gate's
    own subject, and it was sitting in its own roster.
    """
    if name in _NOT_A_NAME:
        return []
    n = re.escape(name)
    open_re = re.compile(
        r"^(?P<indent>[ \t]*)(?:export[ \t]+)?(?:async[ \t]+)?(?:static[ \t]+)?"
        r"(?:function[ \t]+)?(?:get[ \t]+|set[ \t]+)?" + n + r"[ \t]*\([^)]*$")
    close_re = re.compile(r"^[ \t]*[^()]*\)[ \t]*\{[ \t]*$")
    lines = text.split("\n")
    out: "list[tuple[int, str]]" = []
    for i, ln in enumerate(lines):
        if not open_re.match(ln):
            continue
        for j in range(i + 1, min(i + 10, len(lines))):
            if close_re.match(lines[j]):
                out.append((i + 1, "\n".join(lines[i:j + 1])))
                break
            # a blank line or a line already opening a block means this was not one
            if not lines[j].strip() or lines[j].rstrip().endswith("{"):
                break
    return out


def _concise_re(name: str) -> re.Pattern:
    """An arrow const whose body is an EXPRESSION rather than a block.

    🔴 212 §4 — THIS IS THE SHAPE 211 §6.5 EXPECTED A WIDER `_decl_re` TO REACH, AND NO
    WIDENING OF IT EVER COULD. `export const bytes = (v) => Buffer.byteLength(...)` has no
    brace, so `body_brace()` returns None however the declaration line is matched: the
    blocker was never the anchor, it was the INJECTOR. 211 §6 recorded `token-cost.mjs`
    shipping "two of four intended targets" for this reason and named the widening as the
    fix; measured this session, all SIX exported arrow consts across the eleven
    instruments are this shape, so the widening alone admits ZERO exported members.

    The `(?![ \t]*\{[ \t]*$)` is what keeps the two patterns disjoint — a block-bodied
    arrow belongs to `_decl_re`, and a name matching both is refused as ambiguous rather
    than resolved by whichever pattern is consulted first.
    """
    n = re.escape(name)
    return re.compile(
        r"^(?P<indent>[ \t]*)(?:export[ \t]+)?(?:const|let|var)[ \t]+" + n +
        r"[ \t]*=[ \t]*(?:async[ \t]+)?\(.*\)[ \t]*=>(?![ \t]*\{[ \t]*$)")


def resolve_sig(text: str, sig: str) -> tuple[str, str]:
    """(anchor, problem) — exactly one of the two is empty.

    A `sig` that is not a placeholder is returned unchanged, so a literal anchor still
    works where it has to (see `literal_signature_problems`: the ONLY place it has to is
    a name the resolver would refuse as ambiguous).
    """
    m = SIG_RE.match(sig)
    if m is None:
        return (sig, "")
    name = m.group("name")
    lines = text.split("\n")
    block = [(i + 1, ln) for i, ln in enumerate(lines) if _decl_re(name).match(ln)]
    concise = [(i + 1, ln) for i, ln in enumerate(lines) if _concise_re(name).match(ln)]
    # 🆕 212 §4 — BOTH SHAPES, AND A NAME DECLARED IN BOTH IS AMBIGUOUS. Not because
    # ambiguity is tidy, but for the reason the two-match branch below already gives: a
    # resolver that picked one would blind the wrong member silently, which is what
    # 193 §12.27 refused to let a loosened anchor do. Measured across all eleven
    # instruments: 0 names are declared in both shapes today, so this branch is empty by
    # measurement rather than by construction.
    pat = _decl_re(name) if block else _concise_re(name)
    found = block + concise
    # 🆕 235 §4 — THE WRAPPED PARAMETER LIST, CONSULTED ONLY WHERE BOTH OTHERS FOUND
    # NOTHING. Placed here rather than beside them so that no name resolvable today can
    # reach it: the third shape cannot move an existing anchor if it is never asked about
    # one. Measured — 92/92 targets resolve byte-identically across this change.
    spanned = _decl_span(text, name) if not found else []
    if spanned:
        if len(spanned) > 1:
            at = ", ".join(str(n) for n, _ in spanned)
            return ("", f"{sig} matches {len(spanned)} wrapped declarations of `{name}` "
                        f"(lines {at}) — same refusal as the single-line case, and for "
                        f"the same reason")
        line_no, whole = spanned[0]
        indent = re.match(r"^[ \t]*", whole).group(0)
        if indent and indent != "  ":
            return ("", f"{sig} resolves to a wrapped member indented {len(indent)} "
                        f"space(s); `blind()` looks for exactly two")
        return (whole, "")
    if not found:
        return ("", f"{sig} RESOLVES TO NOTHING — no declaration of `{name}` in this file. "
                    f"The member this target blinds was renamed or removed, and a target that "
                    f"cannot be applied is a sweep reporting green over a mutation nobody made")
    if len(found) > 1:
        at = ", ".join(str(n) for n, _ in found)
        return ("", f"{sig} matches {len(found)} declarations of `{name}` (lines {at}) — a "
                    f"placeholder that picked one would blind the wrong member silently, which "
                    f"is exactly what 193 §12.27 refused to let a loosened anchor do. Anchor "
                    f"this target on the full signature literal instead, and say why here")
    line = found[0][1]
    indent = pat.match(line).group("indent")
    if indent and indent != "  ":
        return ("", f"{sig} resolves to a member indented {len(indent)} space(s); `blind()` "
                    f"looks for exactly two. Fix the injector rather than the anchor")
    # The two shapes `blind()`/`late()` search for, and which one is decided by the indent.
    return (line.strip().rstrip("{").rstrip() if indent else line.rstrip(), "")


# 🔴 THE POPULATION OF THE NEW MACHINERY, PINNED LIKE EVERY OTHER ONE IN THIS FILE.
# A `resolve_sig` that stopped resolving would be caught by SIGNATURE NOT FOUND — but a
# roster that quietly stopped USING it would not be caught by anything, and every printed
# line would still read ok while the anchors went back to being literals one at a time.
# 🆕 212 §4: 55 -> 70, measured 78 — the widening and the new roster together added
#            thirteen resolving placeholders, and a floor left at 55 would let the
#            whole 212 admission be reverted one target at a time without a line.
# 🆕 245 §1 — RAISED FROM BELOW: three Python instruments are fifteen more placeholder
# anchors, and 117 against a floor of seventy is 198 §36's gap — wide enough for the whole
# admission to go back to literals one target at a time with no line of output moving.
SIG_RESOLVED_FLOOR = 105
SIG_RESOLVED: set[str] = set()


def resolve_target(inst_name: str, text: str, sig: str, lang: str = "js") -> tuple[str, str]:
    # 🆕 245 §1 — the resolver is chosen by the file being swept, never by a roster column.
    anchor, problem = (py_resolve_sig if lang == "py" else resolve_sig)(text, sig)
    if not problem and SIG_RE.match(sig):
        SIG_RESOLVED.add(f"{inst_name}::{sig}")
    return (anchor, problem)


def literal_signature_problems(inst_name: str, text: str, sigs) -> tuple[list[str], int]:
    """(problems, targets read) — a literal anchor where `{SIG:}` would resolve to it.

    🔴 THE SECOND RETURN VALUE IS NOT DECORATION, for `derived_literal_problems`' reason
    one file over: on a healthy tree `problems` is empty, so an audit over one target and
    an audit over fifty-nine are the same observable and trimming the input is invisible.
    The count is what the caller pins.
    """
    sigs = list(sigs)
    out: list[str] = []
    for sig in sigs:
        if SIG_RE.match(sig):
            continue
        m = re.match(r"^(?:export[ \t]+)?(?:async[ \t]+)?(?:static[ \t]+)?(?:function[ \t]+)?"
                     r"(?:get[ \t]+|set[ \t]+)?(?P<name>[A-Za-z_$][\w$]*)[ \t]*\(", sig.strip())
        if m is None:
            continue
        anchor, problem = resolve_sig(text, "{SIG:" + m.group("name") + "}")
        if problem or anchor != sig:
            continue   # ambiguous, absent, or a different member — the literal is the only way
        out.append(
            f"{inst_name}: `{sig[:60]}` is a LITERAL signature that {{SIG:{m.group('name')}}} "
            f"resolves to exactly. Write the placeholder — a literal here is outrun by the next "
            f"parameter, and this anchor class has cost a re-point in seven consecutive sessions"
        )
    return out, len(sigs)

# ── the three instruments, each with the gate that is supposed to cover it ──────────
#
# 🔴 EACH FLOOR IS A LITERAL AND EACH INSTRUMENT GETS ITS OWN LINE (172 §6). The scope
# ledger's first draft summed two populations into one line and the blinding harness
# caught it an hour later: blinding either left the TOTAL above the floor. A sum is not
# a floor. `>=` because every one of these lists is supposed to grow.
INSTRUMENTS = [
    {
        "name": "_population.mjs",
        "src": HOST / "test-integration" / "_population.mjs",
        "gate": ["node", "test-integration/_population.selftest.mjs"],
        "cwd": HOST,
        "floor": 8,
        "why": "the claim counter fourteen live probes report their coverage through",
        # The empty each member's own contract promises — `claim` returns true, `seal`
        # returns the number it drained, `report` the failure list. Injecting it IS the
        # failure mode, not an approximation of it.
        "targets": {
            "{SIG:claim}": "return true;",
            "{SIG:open}": "return label;",
            "{SIG:_closeOpen}": "return;",
            "{SIG:family}": "return { made: 0, threw: null };",
            "{SIG:seal}": "console.log(marker); return 0;",
            "{SIG:report}": "return [];",
            # 🔴 THE ONE THAT WAS GREEN IN 173. Eleven of fourteen probes call ONLY this.
            "{SIG:reportOrDie}": "return 0;",
            "{SIG:assert}": "return nodeAssert;",
        },
    },
    {
        "name": "_path_ledger.mjs",
        "src": HOST / "test-integration" / "_path_ledger.mjs",
        "gate": ["node", "test-integration/_path_ledger.selftest.mjs"],
        "cwd": HOST,
        "floor": 3,
        "why": "the comparison that decides whether the live path cohort and the ledger agree",
        "targets": {
            "{SIG:ledgerKey}":
                # 🆕 212 §4 — a concise-body arrow, unanchorable until `concise_blind`.
                # Every (tool, param) pair collapsing to ONE key is the ledger losing
                # its population without losing a row.
                'return "COLLAPSED";',
            "{SIG:parsePathLedger}": "return { entries: new Map(), badClass: [] };",
            # 🔴 THE ONE 173's OWN REVERSE SWEEP ADDED. Its first draft inlined this
            # check, so the only case any test could construct was the healthy one and
            # `scope` was a collector asserted EMPTY and never proved to collect.
            "{SIG:ledgerScopeFailures}": "return [];",
            "{SIG:comparePathLedger}":
                "return { unclassified: [], stale: [], badClass: [], lost: [], scope: [], "
                "liveCount: 0, ledgerCount: 0, canaryCount: 0 };",
        },
    },
    {
        # 🔴 174. SIX OF SIX STILL GREEN when this was measured — every headless gate in
        # the tree passed with the module fully blinded, because it is imported in
        # exactly one place: a probe that boots the editor GUI under Xvfb. That is
        # `_path_ledger.mjs`'s gap of one session earlier, one file over.
        #
        # AND THE SEAM IS WHY THIS ENTRY MATTERS MORE THAN ITS SELF-TEST. `restoreDir`
        # decides what to REMOVE from `walk()`; `diffDir` decides what APPEARED from
        # `walk()`. diffDir re-HASHES independently — the half #141/#143 were about —
        # but it does not re-ENUMERATE independently, so a blind enumerator means the
        # restore removes nothing AND the check that proves the restore worked reports
        # clean. A self-test cannot pin that: it calls the enumerator it would need to
        # distrust. A blinding harness can, and `walk` below is the target that does.
        "name": "_workspace.mjs",
        "src": HOST / "test-integration" / "_workspace.mjs",
        "gate": ["node", "test-integration/_workspace.selftest.mjs"],
        "cwd": HOST,
        "floor": 7,   # 181: 6 -> 7, blindWalk admitted
        "why": "the snapshot/restore/diff that decides what AUTH_CLEAN's byte-identical means",
        "targets": {
            # 🔴 THE SHARED ENUMERATOR. Blinding this one is the seam itself.
            "{SIG:walk}": "return;",
            # 🔴 AND THE COMPARISON THAT CATCHES THE BLIND THIS ONE CANNOT CONSTRUCT (181).
            # Blinding `walk` above empties `snapshotDir` too, so the caller's
            # AUTH_SNAPSHOT_FILE_FLOOR = 70 catches it — which is why this entry was green
            # for the whole class while the LATE blind, the walk going quiet only on the
            # second and third calls, passed as `clean=true` over a polluted tree.
            # Measured: snapshot=6, restore removed=0, diff clean=true, artefact on disk.
            "{SIG:blindWalk}": "return [];",
            "{SIG:snapshotDir}": "return { root, files: new Map(), dirs: new Set() };",
            "{SIG:liveHash}": "return null;",
            "{SIG:restoreDir}": "return { removed: [], rewritten: [], rmdir: [], failed: [] };",
            "{SIG:diffDir}":
                "return { added: [], modified: [], missing: [], dirs: [], blind: [], clean: true };",
            "{SIG:describeDiff}": 'return "nothing";',
        },
    },
    {
        # 🔴 175. `BLIND175 _png.mjs 2 of 2 STILL GREEN`, measured before a line of this
        # entry existed — the suite, both tautology gates, both verdict gates and all
        # three instrument self-tests passed with the module returning constants. Same
        # reason as `_workspace.mjs` a session earlier: it is imported in exactly two
        # places, `authoring-plane.integration.mjs` (boots the editor GUI under Xvfb)
        # and `verify_shot_editor_live.mjs` (needs a real GPU). Neither runs headless.
        #
        # AND WHAT IT DECIDES IS #143's FAILURE. `sampleDistinctColours` returning more
        # than 1 is the entire content of AUTH_SHOT_NOT_UNIFORM — the check separating a
        # rasterizer that drew something from one that initialised and drew nothing. The
        # tool's own label cannot tell those apart: an all-black frame has the right
        # mimeType, the right "(WxH)" note and the right four magic bytes.
        "name": "_png.mjs",
        "src": HOST / "test-integration" / "_png.mjs",
        "gate": ["node", "test-integration/_png.selftest.mjs"],
        "cwd": HOST,
        "floor": 3,
        "why": "the reader that decides whether a rendered frame contains anything at all",
        "targets": {
            "{SIG:decodePng}": "return null;",
            # 🔴 NOT `return {distinct: 1, …}` — 1 is the FAILING answer, and a blind that
            # injects a failure proves nothing about a gate that is supposed to catch it.
            # The constant has to be the answer a healthy frame gives.
            "{SIG:sampleDistinctColours}":
                "return { distinct: 999, sampled: 999 };",
            # 🔴 THIS ONE NEEDED A NEW CASE TO BE CATCHABLE AT ALL. Every paeth assertion
            # in the first draft used a row where the predictor legitimately chooses `a`,
            # so `return a;` round-tripped all of them — a wrong answer of the right type,
            # in the test for the function whose job is to reject exactly that. The
            # PAETH_CHOOSES_ABOVE case exists because this target was written first.
            "{SIG:paeth}": "return a;",
        },
    },
    {
        # 🔴 176, AND MEASURED FIRST — WHICH IS WHY THIS ENTRY READS DIFFERENTLY FROM THE
        # FOUR ABOVE. `BLIND176 0 of 7 STILL GREEN`: every finder in this file reddens its
        # own self-test when blinded. 175 §11.2 handed it over as "finders whose silence
        # would be invisible"; their silence is loud, and the honest description of this
        # entry is a PIN on coverage that already exists rather than a hole being closed.
        #
        # It earns its line anyway, for the reason `_path_ledger.mjs` went in at 0 of 8:
        # coverage measured once is coverage at one commit. The self-test is 78 cases over
        # a classifier whose population is the whole repo, and the failure mode this gate
        # exists for is a case list that stops matching the thing it names — which is
        # exactly what 175 §10 found INSIDE this very self-test, where `probe()` declared
        # `const check = (c, m, d) => {};` and nine cases had been proving the classifier
        # against a stub no probe in the tree resembles.
        "name": "tautology_gate.mjs",
        "src": HOST / "scripts" / "tautology_gate.mjs",
        "gate": ["node", "scripts/tautology_gate.selftest.mjs"],
        "cwd": HOST,
        "floor": 9,
        "why": "the classifier that decides whether a repo-wide assertion could have failed",
        "targets": {
            "{SIG:isLiteralish}":
                # 🆕 212 §4 — nothing is a literal, so no leaf classifies as SHAPE and
                # `TAUT_CLASSIFIED shaped=` empties under a floor that is supposed to bite.
                "return false;",
            # The classifier itself. VALUE, not SHAPE — SHAPE is the FAILING answer, and
            # a blind that injects a failure proves nothing about a gate meant to catch it
            # (175's `_png.mjs` reasoning, same trap one file over).
            "{SIG:classifyLeaf}": 'return { kind: "VALUE", why: "blind", text: "" };',
            "{SIG:leaves}": "return out;",
            "{SIG:collectConsts}": "return [];",
            # 🆕 185: `export` in the anchor. The word was added so 184 §10.2's
            # measurement could import this map rather than re-derive it, and this
            # gate reported the target UNMATCHED on the first run afterwards — which
            # is the whole point of an unmatched target being a failure rather than a
            # skip. A blind that stops applying is a blind that proves nothing.
            "{SIG:collectAsserters}": "return new Map();",
            # 🔴 175's OWN FIX. This is the resolver that stopped a tool invoker called
            # `check` and a transcript reader called `assertOk` from fabricating seventeen
            # of the host root's twenty-four claim sites.
            "{SIG:collectFailers}": "return new Set();",
            "{SIG:analyze}": "return [];",
            # 🆕 182: `shaped` and `precondition` are in the blind at their HEALTHY values
            # for the same reason `scan()`'s blind returns four subjects — a blind that
            # trips the new floors proves the floor, not the finder.
            # 🆕 275 — `duration: []` JOINED THE EMPTY IN THE COMMIT THAT ADDED THE FIELD,
            # and the first draft did not: `judgeDuration(v.duration)` got `undefined` from
            # the blind and threw, so the row went RED WITHOUT A VERDICT and `CRASH_CEILING`
            # went 0 -> 1. A blind's empty is the CONTRACT's empty, and a field added to the
            # return shape is a change to that contract.
            "{SIG:verdict}": "return { blocks: 0, attributed: 0, shaped: 116, precondition: 61, vacuous: [], every: [], offender: [], duration: [] };",
            # 🔴 180. THE OUTPUT FLOOR, AND IT IS A BLIND TARGET FOR THE SAME REASON THE
            # CLASSIFIER IS: `judgeScope` is the only thing standing between "attribution
            # resolved nothing" and `TAUT_GATE ok`. Blinded to a passing verdict it must
            # take the self-test red, or §18's twelve cases are proving nothing.
            #
            # 🔴 THIS IS THE ROW `{SIG:}` WAS BUILT FOR. It was re-pointed in 193
            # (`bannerFloor` joined the signature) and again in 194 (`sectionFloor`), each
            # time going UNMATCHED on the first run and each time costing a read of a
            # nine-parameter literal to change nothing about what is being tested. 193
            # §12.27's decision — do NOT loosen the match, because a prefix matching two
            # members would blind the wrong one silently — is still the right decision and
            # is why the placeholder REFUSES an ambiguous name rather than resolving it.
            # What the literal was really asserting was existence and uniqueness, and both
            # of those are now assertions instead of side effects. Measured: five distinct
            # commits wrote this one anchor before it stopped being a literal.
            "{SIG:judgeScope}":
                "return { lines: [], failed: false };",
            # 🔴 180. THE WIRE, AND IT IS HERE BECAUSE THE REVERSE SWEEP CAUGHT IT GREEN.
            # `if (scope.failed) failed = true` inline in main() could be deleted with
            # every gate staying green — on a healthy tree the term is never satisfied
            # apart, which is 174 SS8 and verdict_gate's `combine()` a third time. Blinded
            # to "the scope verdict never reaches the exit code", the self-test must red.
            "{SIG:combineFailed}": "return failedSoFar;",
            # 🆕 275 — `duration-assertions-unguarded` (273). The three members of the
            # duration rule, each blinded to the answer that makes the rule silent: no
            # site is a duration claim, nothing is judged, and every quoted span survives.
            # The last one is the interesting blind — leaving the quotes in place puts the
            # gate's own fixtures back in the population, which is how the first draft was
            # caught, so its blind must redden the self-test rather than merely change a
            # number.
            "{SIG:durationClaim}": "return null;",
            "{SIG:judgeDuration}": "return { lines: [], failed: false };",
            "{SIG:unquoted}": "return text;",
        },
    },
    {
        # 🔴 176. THE NEWEST INSTRUMENT IN THE TREE, AND BLINDING IT IS WHAT FOUND THE
        # DEAD `declarations()` — a full AST walk built into `decls` on every file, read
        # by nothing: not `judge()`, not the self-test, not anywhere. It was 1 of 4 still
        # green here and green in scope_gate and instrument_gate too, so the deletion was
        # measured rather than assumed (172's rule) instead of being left alone the way
        # 175 §11.17 left `_check`.
        #
        # `scan()`'s blind returns FOUR healthy-looking subjects on purpose: three would
        # be caught by SUBJECT_FLOOR alone, which would prove the floor rather than the
        # scanner. The constant has to be the answer a healthy tree gives.
        "name": "verdict_gate.mjs",
        "src": HOST / "scripts" / "verdict_gate.mjs",
        "gate": ["node", "scripts/verdict_gate.selftest.mjs"],
        "cwd": HOST,
        "floor": 4,
        "why": "the gate for the ABSENCE of a check — the half no condition-grader can reach",
        "targets": {
            "{SIG:scanDiscarded}": "return [];",
            # 🆕 212 §4 — a judge that never fails, and a combiner that drops BOTH
            # halves. `combine` is the only place the two readers meet.
            # 🆕 235 §4 — AND IT IS A PLACEHOLDER NOW, WHICH MAKES THE ROSTER 92/92
            # PLACEHOLDERS AND ZERO LITERALS. 212 §4 wrote here that `{SIG:judgeDiscarded}`
            # RESOLVES TO NOTHING because the parameter list spans two lines, called the
            # widening "a real next item", and shipped the two-line literal instead —
            # where it sat for seven sessions as the only exact-text anchor in the tree,
            # one reindent away from a blind that silently stops applying. `_decl_span`
            # reaches it now, and `literal_signature_problems` REPORTED THIS LITERAL on
            # the first run after the widening rather than being told to: the placeholder
            # resolves to it byte-for-byte, which is the condition that check exists for.
            "{SIG:judgeDiscarded}": "return { lines: [], failed: false };",
            "{SIG:combine}": "return { lines: [], failed: false };",
            "{SIG:inspect}":
                'return { tools: [], readsVerdict: true, exitsNonZero: true, labelsAssert: false };',
            "{SIG:judge}":
                'return { lines: ["VERDICT_GATE ok"], failed: false };',
            "{SIG:scan}":
                "return [{ f: \"a.mjs\", tools: [\"runtime_assert_x\"], readsVerdict: true, exitsNonZero: true }, "
                "{ f: \"b.mjs\", tools: [\"runtime_assert_x\"], readsVerdict: true, exitsNonZero: true }, "
                "{ f: \"c.mjs\", tools: [\"runtime_assert_x\"], readsVerdict: true, exitsNonZero: true }, "
                "{ f: \"d.mjs\", tools: [\"runtime_assert_x\"], readsVerdict: true, exitsNonZero: true }];",
            # 🔴 176's OWN NEW FINDER. `dropped: false` is the healthy answer — returning
            # an empty list would be caught by DISCARD_SITE_FLOOR, which proves the floor
            # rather than the finder, and those are different instruments.
            "{SIG:discarded}":
                'return [{ file, line: 1, tool: "runtime_assert_x", dropped: false }];',
        },
    },
    {
        # 🔴 177. THE INSTRUMENT THAT READS TWO LANGUAGES, WHICH IS ALSO ITS FAILURE MODE.
        # Every other gate here is wrong in one file at a time; this one is wrong when
        # `operations.gd`'s `_ok({…})` spelling drifts, when the addon's dispatcher is
        # rewritten, when `registerTool` is refactored, or when the probe idiom changes —
        # four independent halves, any one of which going quiet leaves the other three
        # reporting a clean tree. That is why `judge()` takes all four populations and why
        # each has its own named collapse.
        #
        # 🔴 `comparisons()` IS BLINDED TO A HEALTHY-LOOKING SITE, NOT TO NOTHING.
        # Returning `[]` would be caught by SITE_FLOOR, which proves the floor rather than
        # the finder — 176's reasoning for `discarded()`, one file over. The blind returns
        # a well-formed site whose receiver resolved to nothing, which is exactly what the
        # gate is entitled to see on a healthy tree.
        "name": "boundary_gate.mjs",
        "src": HOST / "scripts" / "boundary_gate.mjs",
        "gate": ["node", "scripts/boundary_gate.selftest.mjs"],
        "cwd": HOST,
        "floor": 9,   # 🆕 179: helpers() is the ninth, and the reader both 179 rules rest on
        "why": "the tautology that cannot be seen from either side alone — a GDScript constant asserted in JS",
        "targets": {
            "{SIG:run}": "return { lines: [], failed: false };",
            # 🆕 212 §4 — 🔴 `report` RETURNS THE EXIT CODE. A blind here is the whole
            # gate exiting 0 over its own failure lines, which is the loudest thing in
            # this file that nothing was pointed at.
            "{SIG:report}": "return 0;",
            "{SIG:dispatchMap}": 'return new Map([["a.b", "_a_b"]]);',
            "{SIG:hardwired}":
                'return { fields: new Map([["_a_b", new Map([["f", "true"]])]]), opaque: [], reads: 9 };',
            "{SIG:toolOps}": 'return new Map([["t", "a.b"]]);',
            # 🆕 178. The conduit resolver blinded to "no helper is ever a conduit" — the
            # shape 177 §10.18 declined to build and 178 measured a live defect behind.
            "{SIG:conduits}": "return new Map();",
            "{SIG:comparisons}":
                'return [{ file, line: 1, field: "ok", lit: "true", tool: null, drop: null, wouldBe: null, text: "", idiom: "===" }];',
            # 🆕 179. The reader both 179 rules rest on: which locally-defined helpers throw
            # on `isError`. Blinded to "none of them", every direct receiver is refused as
            # nonthrowing and `judged` goes to zero — which is exactly what JUDGED_FLOOR is
            # for, and nothing else in the file could have caught it.
            "{SIG:helpers}":
                "return { s: null, bodyOf: new Map(), throwers: new Set(), defined: new Set() };",
            "{SIG:judge}":
                'return { lines: ["BOUNDARY_GATE ok"], failed: false };',
            # 🔴 THE COLLAPSE TEST ITSELF. 176 §8's G12 extracted this shape precisely so
            # that a floor set to zero has a case that reddens; blinding it to `false`
            # switches all four floors off at once, and the self-test must notice.
            "{SIG:collapsed}": "return false;",
            # 🆕 178. The composition itself. `run()` and `report()` were extracted in 177
            # so the sweep could reach them; `scan()` is the third of the three, and a
            # blind that returns a healthy-looking population with an empty offender list
            # is precisely the green lie both fixtures exist to catch.
            # 🆕 182: `helperDefs`/`conduitEntries` at HEALTHY values, same reasoning as
            # every other constant here — a blind that trips a floor proves the floor.
            "{SIG:scan}":
                'return { pop: { consts: 99, ops: 999, tools: 999, sites: 9999, reads: 999, '
                'planes: 9, opaque: 0, judged: 9, unresolved: 0, helperDefs: 999, '
                'conduitEntries: 99 }, offenders: [] };',
            # 🆕 233 — THE DISCOVER HALF'S THREE MEMBERS. Each empty is the one its own
            # contract promises, so injecting it IS the failure mode: the shape reader
            # answering "nothing dispatches", the walk answering "the directory is empty",
            # and the collector answering "nothing is wrong". The first two trip the two
            # discover floors; the third is what the self-test's twelve fixtures are for,
            # and it is DECLARED GREEN on the live axis below for exactly that reason.
            "{SIG:dispatcherShaped}": "return false;",
            "{SIG:planeWalk}": "return [];",
            "{SIG:discoveryProblems}": "return [];",
        },
    },
    {
        # 🆕 185. THE EIGHTH INSTRUMENT, AND THE FIRST WHOSE DEFECT NO RUNTIME GATE COULD
        # HAVE SEEN. `seal()` attributes backwards, so a marker written above its own
        # assertions misaims the report by one section — and because nothing goes
        # UNATTRIBUTED when that happens, `_population.mjs`'s own six gates are blind to
        # it by construction (184 §5). A seal also drains what has already happened, so
        # the defect is in the source's reading and the instrument is a source scan.
        #
        # 🔴 `claimCallees` IS THE ONE WORTH READING. Blinded to "nothing is a claim", the
        # gate finds zero claim sites in every file — and zero claim sites can never sit
        # after a seal, so every trailing check passes. That is the exact shape 171 §2
        # named and the reason CLAIM_SITE_FLOORS exists: the per-file floor is what turns
        # a finder that stopped reading into a red run instead of a clean one.
        "name": "seal_order_gate.mjs",
        "src": HOST / "scripts" / "seal_order_gate.mjs",
        "gate": ["node", "scripts/seal_order_gate.selftest.mjs"],
        "cwd": HOST,
        "floor": 8,   # 190: 7 -> 8, assertAliases admitted
                      # 187: 6 -> 7, markerList admitted
        "why": "the marker written above the claims it describes — invisible to every gate _population.mjs has",
        "targets": {
            # 🔴 NOT `return [];`, AND THE REASON IS A DEFECT THIS TARGET FOUND. Measured
            # first with `[]`, then with the shape below: BOTH crashed the self-test —
            # `ps[1].from` threw on a short array after the claims above it had already
            # failed correctly, so the gate went red WITHOUT reaching its own verdict and
            # the row proved that JavaScript throws rather than that the claims bite
            # (197 §5). Fixed where it belongs, in `seal_order_gate.selftest.mjs`, and
            # this target is a catch. One paragraph spanning the whole region is kept over
            # `[]` regardless: it is the same collapse with the CONTRACT KEPT — every
            # boundary the reader exists to find is gone and the caller still gets the
            # shape it is typed against, which is a claim about the gate rather than
            # about optional chaining.
            "{SIG:paragraphsOf}": "return [{ from, to }];",
            # 🆕 212 §4 — both concise-body arrows, both predicates that decide a
            # POPULATION: nothing is a probe, and nothing reads as a claim.
            "{SIG:isProbe}": "return false;",
            "{SIG:READS_AS_CLAIM}": "return false;",
            "{SIG:claimCallees}":
                "return { helpers: new Set(), isClaimCall: () => false };",
            # Blinded to a well-formed EMPTY file rather than to a throw — 176's rule for
            # `discarded()`: a blind that returns nothing proves the floor, a blind that
            # returns something healthy-looking proves the finder.
            "{SIG:inspect}":
                'return { file, claims: [], seals: [], helpers: [], lines: [] };',
            # 🔴 THE MOST EXPENSIVE ANCHOR IN THE FILE, AND THE REASON `{SIG:}` COVERS THE
            # WHOLE ROSTER RATHER THAN ONE ROW. Its thirteen-parameter literal MOVED IN
            # SEVEN CONSECUTIVE SESSIONS (185 §8, 186 §6, 187, 188, 189, 190, 191) — every
            # time a rule gained a floor or a ceiling, which is every session a rule was
            # added; 191 moved BOTH anchors in this file at once. Every one of those was
            # caught LOUDLY as SIGNATURE NOT FOUND rather than skipped, which is the only
            # reason the target stayed live, and none of them was a defect.
            # 🔴 STILL DO NOT SOFTEN THE MATCH TO A PREFIX. `{SIG:judge}` is not a prefix:
            # it resolves to the single declaration of `judge` in THIS file and refuses —
            # loudly — if there are none or more than one. A prefix would decide that case
            # quietly, which is what 193 §12.27 rejected and this build does not do.
            "{SIG:judge}":
                'return { lines: ["SEAL_ORDER_GATE ok"], failed: false };',
            # 🆕 187 — THE THIRD RULE'S FINDER. `markerList` returning null for every file
            # empties the marker population entirely, and nothing but MARKER_HEADER_FILES_FLOOR
            # can tell that from a tree where no probe carries a header. Blinded to null
            # rather than to an empty object, because null IS the shape the function returns
            # for a file with no header — the failure mode, not an approximation of it.
            "{SIG:markerList}": "return null;",
            # 🆕 190 — THE FIFTH RULE'S FINDER. It is the newest thing in this gate that
            # can match nothing while every number stays plausible: blinded to `[]` the
            # alias population reads 0, `0/1 unreadable` prints, and the whole rule
            # reports a clean tree over a file it never looked at. That is the exact
            # shape this instrument exists to name, and a rule whose finder is unswept is
            # a rule with a floor and no population.
            "{SIG:assertAliases}": "return [];",
            "{SIG:scan}": "return [];",
            # 🆕 186 §3 — THE SECOND RULE'S TWO HALVES, BLINDED SEPARATELY BECAUSE THEY
            # COLLAPSE DIFFERENTLY. `sectionBoundary` returning null leaves every region
            # in the population and unreadable; `regionsOf` returning [] removes the
            # population itself. Only the coverage floor can tell either from a clean run,
            # which is the whole reason that floor exists.
            "{SIG:sectionBoundary}": "return null;",
            "{SIG:regionsOf}": "return [];",
        },
    },
    {
        # The COMPILED walk rather than the .ts, so this step costs no tsc invocation:
        # `npm test` has already emitted dist-test/ by the time this runs.
        "name": "path-cohort (compiled walk)",
        "src": HOST / "dist-test" / "src" / "path-cohort.js",
        # 🔴 A BUILD ARTEFACT IS ONLY THE INSTRUMENT WHILE IT IS FRESH. Blinding a
        # dist-test/ that predates its own .ts sweeps a walk that is not the one that
        # ships, and reports the result in green. Hit for real in 173: an exploratory
        # harness recompiled per mutation, restored the .ts and left the last mutant
        # sitting in dist-test/.
        "fresher_than": HOST / "src" / "path-cohort.ts",
        # 🔴 `--test-reporter=spec` IS PART OF THE GATE, NOT A PREFERENCE (197 §5, found
        # by CI). `node --test` picks its reporter from whether stdout is a TTY: `spec`
        # on a developer's terminal, `tap` in Actions. The two print different summary
        # lines — `ℹ fail 0` and `# fail 0` — so this instrument's VERDICT_MARKER and its
        # failure count were both silently environment-dependent, green on a Mac and
        # unreadable in CI. Pinning the reporter makes the dialect a property of the
        # command rather than of the terminal. The CONTROL assertion is what caught it,
        # on the first CI run, before a single mutant — which is the whole design.
        "gate": ["node", "--test", "--test-reporter=spec",
                 "dist-test/test/path_cohort.test.js"],
        "cwd": HOST,
        "floor": 8,
        "why": "the enumerator whose predecessor's number was wrong by 180 rows in two shipped changelogs",
        "targets": {
            "{SIG:summarisePathCohort}":
                # 🆕 212 §4 — the SHAPE is kept and every count but the total zeroed:
                # a summary that answers structurally and says nothing.
                "return { total: rows.length, topLevelNamedPath: 0, topLevelOther: 0, nested: 0 };",
            "{SIG:segments}": "return [];",
            "{SIG:nameLooksPathLike}": "return false;",
            "{SIG:branchesOf}": "return [];",
            "{SIG:isStringy}": "return false;",
            "{SIG:childMaps}": "return [];",
            "{SIG:describe}": 'return "";',
            "{SIG:walk}": "return;",
            "{SIG:enumeratePathCohort}": "return [];",
        },
    },
    {
        # 🆕 209 — CHECK 8's CLASSIFIER, AND IT GOES IN ON ITS FIRST DAY RATHER THAN ON
        # THE SESSION SOMEBODY NOTICES IT IS MISSING. `token-cost.mjs` was the precedent
        # NOT followed here: it had a self-test, it was read by CI, and it appeared
        # nowhere in this roster — an absence nothing declares, which is the shape every
        # entry above was written to close.
        # 🆕 211 §6 — AND THAT ABSENCE IS NOW AN ENTRY, two sessions after this comment
        # named it. 🔴 THE LESSON IS NOT "add it sooner", IT IS THAT A PROSE CONFESSION
        # DOES NOT RE-ASSERT ITSELF: this paragraph was true, correct, load-bearing and
        # completely silent on every one of the fifty-odd green runs between 209 and 211.
        # The missing-half checks added this session are the mechanical version of it.
        #
        # 🔴 AND THE BLIND IS WHAT FOUND THE DEFECT, BEFORE THIS ENTRY EXISTED. Asking
        # "what would blinding `stripDialect` redden?" answered NOTHING — the function
        # deleted every `$schema` key in the tool object and `classify` never compares a
        # raw schema, so the strip changed no verdict while blinding the classifier to a
        # tool's own property of that name. It is gone; the row that would have caught it
        # is in the self-test. The instrument gate's question paid before the gate ran.
        "name": "wire_diff.mjs",
        "src": HOST / "scripts" / "wire_diff.mjs",
        "gate": ["node", "scripts/wire_diff.selftest.mjs"],
        "cwd": HOST,
        "floor": 4,
        "why": "the classifier that decides whether a release moved the public API",
        "targets": {
            # 🆕 212 §4 — every tool forbidden, so the taskSupport population the
            # dialect refusal is computed over empties without the count moving.
            '{SIG:effectiveTaskSupport}': 'return "forbidden";',
            # 🔴 THE HEALTHY ANSWER, NOT THE FAILING ONE (175's `_png.mjs` rule). PATCH
            # over a populated surface is what a clean release looks like, so a classifier
            # blinded to it is exactly the failure this gate exists to catch — and the
            # floor rows, which demand a THROW, redden on the same blind.
            "{SIG:classify}":
                "return { verdict: \"PATCH\", major: [], minor: [], patch: [], moved: 0, "
                "counts: { before: 999, after: 999 } };",
            "{SIG:shapeOf}": "return new Map();",
            # 🔴 `\"string\"` AND NOT `\"unknown\"`: every type in the self-test's healthy
            # rows resolves to a real name, so a constant that no schema ever produces
            # would redden the table for being absurd rather than for being blind.
            "{SIG:typeName}": 'return "string";',
            "{SIG:normalise}": "return { taskSupport: \"forbidden\" };",
            # 🆕 233 — THE KEY DISCOVER HALF'S TWO. `schemaKeys` blinded is a walk that
            # descends into nothing; `keyProblems` blinded is a collector that finds
            # nothing, and its live population is EMPTY today — so the first trips both
            # discover floors and the second is covered by the self-test's twelve fixtures.
            "{SIG:schemaKeys}": "return { keys: new Map(), nodes: 0 };",
            "{SIG:keyProblems}": "return [];",
            # 🆕 276 — THE TOOLCHAIN HALF'S TWO, ADDED IN THE COMMIT THAT SHIPPED THEM
            # RATHER THAN IN A LATER ONE — this file's own standing rule, and it enforced
            # the rule on the very run that added them by naming both as members that are
            # neither a target nor declared. `depResolution` blinded is a lockfile reader
            # that resolves nothing, so every window reads `deps=0`: the exact silence the
            # second baseline was built to end. `resolutionDrift` blinded is the
            # comparison itself answering *nothing moved* — the SAME observable a healthy
            # window produces, which makes it the sharper of the two.
            "{SIG:depResolution}": "return {};",
            "{SIG:resolutionDrift}": "return [];",
        },
    },
    {
        # 🆕 231 — THE TWELFTH, ADDED IN THE COMMIT THAT SHIPPED IT RATHER THAN IN A
        # LATER ONE. 🔴 AND THE REASON IS THE PARAGRAPH ABOVE, WHICH SAYS A PROSE
        # CONFESSION DOES NOT RE-ASSERT ITSELF: this gate's population is a HAND-WRITTEN
        # roster with no discovery half, so `wire_invisible_gate.mjs` passed it in silence
        # on the run that introduced it — the gate said `ok — every instrument collapses
        # loudly` over eleven, and the twelfth was simply not a member. `floor_pin_gate`
        # would have caught the same omission in its own domain, because it HAS a DISCOVER
        # half; this file does not, and the difference is named in 231's handoff.
        "name": "wire_invisible_gate.mjs",
        "src": HOST / "scripts" / "wire_invisible_gate.mjs",
        "gate": ["node", "scripts/wire_invisible_gate.selftest.mjs"],
        "cwd": HOST,
        "floor": 3,
        "why": "the roster over refinements the emitter drops — the rules no wire carries",
        "targets": {
            # 🔴 THE HEALTHY ANSWER, NOT A FAILING ONE (175's `_png.mjs` rule). "No
            # problem" is what a clean tree looks like, so an auditor blinded to it is
            # precisely this gate's subject.
            "{SIG:audit}": "return [];",
            # 🔴 THE MEASUREMENT'S OWN MOVING PART. A strip that removes nothing makes
            # every class compare equal to itself and read INVISIBLE — the blind that
            # would turn a measurement into a tautology.
            "{SIG:stripCheck}": "return node;",
            "{SIG:walkNode}": "return out;",
            "{SIG:walkSurface}": "return [];",
            "{SIG:siteKey}": 'return "a site";',
            # 🆕 255 — the kind reader, and it is the whole port. The installed zod spells a
            # check's kind at `check._zod.def.check`; a reader that returns nothing names
            # every class `undefined`, collapses the walk's classes to one and makes the
            # strip ask for a kind no check carries.
            "{SIG:checkKind}": "return undefined;",
        },
    },
    {
        # 🆕 244 §4 — `p0-reporters-unblinded` (241), PAID WHERE THE IOU WAS WRITTEN.
        # 241 put this file in `DISCOVER_EXEMPT` and said exactly why: the late axis
        # needs a second command that goes RED when a member is blinded, and a reporter
        # that PRINTS cannot. `--floor` is that command now (see the file's own header),
        # so the row moves out of the exemption table and into this one.
        "name": "p0_complexity.mjs",
        "src": HOST / "scripts" / "p0_complexity.mjs",
        "gate": ["node", "scripts/p0_complexity.selftest.mjs"],
        "cwd": HOST,
        "floor": 3,
        "why": "the P0 complexity reporter — the ranking P3 will be argued from",
        "targets": {
            # 🔴 THE ONE THE ROW WAS WRITTEN ABOUT. Blinded, this file still prints
            # `functions measured: 1095` and exits 0; what collapses is every VALUE in
            # the population, which is why `--floor` asks about spread and not size.
            "{SIG:measureFunction}": "return { cyclo: 1, cognitive: 0, maxNest: 0 };",
            # A walk that stops recursing is the population going to nothing.
            "{SIG:measureSource}": "return { rows: [], lines: 0, maxNest: 0 };",
            "{SIG:walkTs}": "return [];",
            # 🔴 THE HEALTHY ANSWER, NOT A FAILING ONE (175's `_png.mjs` rule). A name is
            # not a number, so this blind is invisible to every floor on the measures and
            # visible only to the one on the names — which is the claim that the
            # published `file:line  name` rows still identify distinct functions.
            "{SIG:nameOf}": 'return "fn";',
            # 🔴 see p0_testdup.mjs::floorProblems below — same member, same reason.
            "{SIG:floorProblems}": "return [];",
        },
    },
    {
        # 🆕 244 §4 — the second half of the same row, and a different collapse. This
        # reporter's output is a CLUSTERING, so what fails is not an empty population but
        # a key that stops discriminating; its floors are on the PARTS of the key and on
        # the singletons rather than on the verdict the table prints.
        "name": "p0_testdup.mjs",
        "src": HOST / "scripts" / "p0_testdup.mjs",
        "gate": ["node", "scripts/p0_testdup.selftest.mjs"],
        "cwd": HOST,
        "floor": 3,
        "why": "the P0 test-duplication clusterer — the candidate list P5 will be argued from",
        "targets": {
            "{SIG:extractTests}": "return [];",
            "{SIG:subjectOf}": 'return "S";',
            "{SIG:shapeOf}": 'return "SH";',
            "{SIG:oracleOf}": "return {};",
            "{SIG:oracleKeyOf}": 'return "<none>";',
            "{SIG:cluster}": "return new Map();",
            # 🔴 THE REFUSAL ITSELF, AND IT IS A TARGET RATHER THAN A NOT_A_TARGET ROW
            # BECAUSE A FLOOR THAT CANNOT REFUSE IS THE WHOLE 244 §4 DEFECT ONE LAYER
            # DOWN. Blinded, `--floor` agrees with every collapse the other five blinds
            # cause — so the live axis would go green over all of them at once. The
            # self-test's own floor claims are what catch it, which is why they were
            # written in the same commit as the command.
            "{SIG:floorProblems}": "return [];",
        },
    },
    {
        # 🆕 211 §6 — 209 §9.6 NAMED THIS AND 210 CARRIED IT. `token-cost.mjs` has a
        # headless self-test, three governed floors swept by `floor_pin_gate`, and a CI
        # step — and it appeared in NO roster in this file. 🔴 THE FILE SAID SO ITSELF,
        # in prose, beside the entry above: "it appears nowhere in this roster — an
        # absence nothing declares." A confession is not a mechanism; nothing would have
        # said it again on any run.
        #
        # 🔴 AND 211 §5 IS WHY IT IS NOT A HOUSEKEEPING ROW. Its numbers are what priced
        # the `BYTES_CEILING` decision this session — `measure()` is the reader every
        # option in that table was weighed with, and a `measure()` that had quietly
        # stopped deriving `schemaPerTool` from its schemas would have made all six
        # options agree.
        "name": "token-cost.mjs",
        "src": HOST / "scripts" / "token-cost.mjs",
        "gate": ["node", "scripts/token-cost.selftest.mjs"],
        "cwd": HOST,
        "floor": 2,
        "why": "the budget reader whose numbers a ceiling decision is argued from",
        "targets": {
            "{SIG:bytes}": "return 0;",
            # 🆕 212 §4 — 🔴 THE TWO 211 §6 RECORDED AS UNREACHABLE, REACHED. Both are
            # concise-body arrows; the widening 211 §6.5 proposed does not admit them
            # and never could (see `_concise_re`). `bytes` returning 0 is a budget
            # reader measuring an empty surface; `family` collapsing is the per-key
            # decomposition losing every grouping while the total holds.
            '{SIG:family}': 'return "other";',
            # 🔴 THE HEALTHY ANSWER, NOT A FAILING ONE (175's `_png.mjs` rule). A blind
            # returning a surface that BREACHES the ceiling would redden the self-test's
            # refusal rows for the right reason by accident. This one returns a plausible
            # in-budget measurement, so only the rows that assert the numbers are DERIVED
            # can catch it — which is the half 199 §34 calls a claim rather than a fix.
            "{SIG:measure}":
                "return { count: 291, total: 360699, names: 0, descs: 0, schemas: 0, "
                "schemaPerTool: 468, perTool: 1239, dialects: 0, taskDefault: 0, "
                "families: [], keys: [], frame: 0 };",
            # The refusal itself. `ok` with no problems is what a budget reader that has
            # stopped reading looks like from the outside.
            "{SIG:verdict}": "return { ok: true, problems: [] };",
            # 🆕 257 — THE RESULT AXIS'S THREE, AND EACH BLINDS TO THE ANSWER THAT LOOKS
            # HEALTHY. `parseResults` returning nothing is a log that read as empty;
            # `measureResults` returning a plausible in-budget summary is the axis
            # measuring and finding nothing wrong; `verdictResults` agreeing is the axis
            # that has stopped deciding. All three are the shape 175's `_png.mjs` rule
            # asks for — a blind that returns a FAILING value would redden the refusal
            # rows for the wrong reason and prove nothing about the rows that matter.
            "{SIG:parseResults}": "return [];",
            "{SIG:measureResults}":
                "return { calls: 1, tools: 1, total: 512, worst: [[\"gd_hover\", "
                "{ n: 1, max: 512, sum: 512 }]] };",
            "{SIG:verdictResults}": "return { ok: true, problems: [] };",
            # 🔴 `bytes` AND `family` ARE NOT TARGETS, AND THE REASON IS THE ANCHOR'S
            # SHAPE RATHER THAN A JUDGEMENT ABOUT THEM. Both are arrow-function consts
            # (`export const bytes = (v) => ...`), and `_decl_re` anchors a `function`
            # declaration opening a block. Listed as targets they reported RESOLVES TO
            # NOTHING on the first run — which is this gate working: an unappliable
            # target is a sweep reporting green over a mutation nobody made. Said here
            # rather than left as an absence, because that absence is what §5 above is
            # about. 🔴 A WIDENING OF `_decl_re` TO ARROW CONSTS IS A REAL NEXT ITEM:
            # it is not scoped to this file, and it would admit members in every
            # instrument at once.
        },
    },
    {
        # 🆕 232 — THE THIRTEENTH, AND THE ONE THIS FILE COULD NOT SEE. 231 §5.1 recorded
        # `instrument_gate.py` printing `ok — every instrument collapses loudly` over
        # eleven instruments on the run that introduced the twelfth, and named the cause:
        # its population is a TYPED ROSTER with no DISCOVER half. The half below this
        # entry is that fix, and this entry is what its FIRST RUN found — an 818-line
        # export-bearing module with a headless self-test, both of which CI has run on
        # every push since 219, never once blinded.
        #
        # 🔴 AND IT IS THE POSITIVE CONTROL. The reader whose entire job is to catch
        # collections that can never be non-empty was itself never asked whether IT can
        # go quiet. `classify()` returning `[]` is the exact defect this instrument
        # exists to name, in the file that names it.
        "name": "positive_control_gate.mjs",
        "src": HOST / "scripts" / "positive_control_gate.mjs",
        "gate": ["node", "scripts/positive_control_gate.selftest.mjs"],
        "cwd": HOST,
        "floor": 6,   # every one of the six targets must be swept
        "why": "the reader that decides whether an empty collection was ever proved able "
               "to be non-empty",
        # The empty each member's own contract promises, read off the returns rather than
        # guessed: `classify` and `acceptance` return arrays of rows, `judge` returns
        # `{lines, failed, codes}` and `failed:false` is the shape that passes silently.
        #
        # 🆕 246 — AND THE IMPORT HOP'S THREE, WHICH ARRIVED WITH `declared-outside-five`.
        # `makeBinder`'s empty is the interesting one: it returns FUNCTIONS, so the empty
        # its contract promises is a binder that resolves nothing — which is precisely the
        # reader-went-quiet shape this instrument exists to catch, expressed one level up.
        # 🔴 AND ITS `unwrap` IS THE IDENTITY RATHER THAN `null`, WHICH THE FIRST DRAFT GOT
        # WRONG AND THIS HARNESS CAUGHT. A blinded `unwrap` returning null makes the caller
        # ask `ts.isArrayLiteralExpression(null)`, which THROWS — so the row proved that
        # JavaScript dies on an empty rather than that the gate's claims bite, and the
        # sweep filed it as CRASHED. The empty a binder's contract actually promises is one
        # that unwraps nothing and resolves nothing (198 §3, a third time).
        # The two resolvers return null the way a specifier this reader cannot follow does,
        # so blinding either takes every hopped chain back to the terminal the row was
        # named for, and the self-test's DEFENDED cases say so.
        "targets": {
            "{SIG:classify}": "return [];",
            "{SIG:acceptance}": "return [];",
            "{SIG:judge}": "return { lines: [], failed: false, codes: [] };",
            "{SIG:makeBinder}": "return { unwrap: (e) => e, chainOf: () => [], "
                                "resolveDecl: () => null, rootDeclKey: () => null };",
            "{SIG:importedFrom}": "return null;",
            "{SIG:exportedInitializer}": "return null;",
        },
    },
    # ══ 🆕 245 §1 — THE FIRST THREE PYTHON INSTRUMENTS — `blind-py-gates` (234) ══════
    #
    # 🔴 EVERY ENTRY BELOW WAS MEASURED BEFORE IT WAS WRITTEN, and the sweep found four
    # things no session had suspected — see §1.2. The cohort is THREE and not eighteen for
    # a reason this file already enforces one table down: an instrument joins `INSTRUMENTS`
    # when every member the sweep names can be caught, and a member that cannot is a
    # PROBLEM to fix rather than a row to leave out. Three fit in one session; the other
    # fifteen are in `PY_NOT_SWEPT` with the measurement each one needs, which is a
    # roster nobody can mistake for coverage.
    {
        "name": "p0_comments.py",
        "src": ROOT / "scripts" / "p0_comments.py",
        "gate": ["python3", "../scripts/p0_comments.py", "--selftest"],
        "cwd": HOST,
        "floor": 4,
        "why": "the classifier and the two extractors under §8.4's whole population",
        # The empty each member's own contract promises. `classify` returns a BUCKET NAME,
        # so its empty is the healthy-looking one — a constant nobody would notice — and
        # not a sentinel that fails on sight (`_png.mjs`'s `sampleDistinctColours` rule).
        "targets": {
            "{SIG:classify}": 'return "describes-this-code"',
            "{SIG:_looks_like_code}": "return False",
            "{SIG:ts_comments}": "return []",
            "{SIG:py_comments}": "return []",
            "{SIG:floor_problems}": "return []",
        },
    },
    {
        "name": "queue_gate.py",
        "src": ROOT / "scripts" / "queue_gate.py",
        "gate": ["python3", "../scripts/queue_gate.py", "--selftest"],
        "cwd": HOST,
        "floor": 3,
        "why": "the parser under the one table in this repository that says what to do next",
        "targets": {
            "{SIG:_cells}": "return []",
            "{SIG:parse}": "return (1, HEAD, [], [])",
            "{SIG:check}": "return ([], [], 0, 0)",
            # 🆕 281 — `reach-paths-unjoined-to-the-diff` (271). `session_diff` blinded
            # to None does NOT go quiet: `SHIPPED_QUEUE_CLEAN` reads the live table
            # through `check`, the diff comes back unreadable, and `QUEUE_PATHS_UNREAD`
            # refuses — which is the reader's own stance proving itself under the blind.
            "{SIG:paths_join}": "return []",
            # 🆕 247 §1 — THE THREE THE COVERAGE ROSTER ASKED FOR THE MOMENT IT COULD
            # READ PYTHON, and two of them are where this gate's premise is cashed.
            # `ages` derives the number `QUEUE.md` deleted the column for; `render`
            # writes the handoff's §6. Both were called by `--ages`/`--render` and by
            # nothing else — measured green on both axes before 247 gave the self-test a
            # claim on the printed LINE (a claim on the return code is satisfied by a
            # reporter that prints nothing, which is what the blind produces).
            "{SIG:ages}": "return 0",
            "{SIG:render}": "return 0",
            # The fixture builder every negative control in that file is constructed
            # with: emptied, every `red()` case stops being the table it claims to be.
            "{SIG:_table}": 'return ""',
            # 🆕 271 §2/§3 — THE FIVE THIS SESSION ADDED, and the first two are where the
            # new claims are cashed. `age_domain` is the bound `--render`, `--ages` and
            # `check` all pass through, so emptying it puts every consumer back to
            # printing a negative age without comment; `reach_join` is the tier column's
            # only evidence. `reach_of` and `tracked_prefixes` are the two readings that
            # join is made of — the roster lookup and the tree — and emptying either makes
            # the comparison agree with everything. `_pad_paths` is the fixture normaliser
            # forty negative controls now pass through: emptied, they are width-refused
            # rather than refused for the reason each of them names.
            "{SIG:age_domain}": "return []",
            "{SIG:reach_join}": "return []",
            "{SIG:reach_of}": "return ([], [])",
            "{SIG:tracked_prefixes}": "return set()",
            "{SIG:_pad_paths}": 'return ""',
            # 🆕 280 — `schedule-set-unread` (244). `QUEUE_SCHEDULE_SET` reads the TARGET
            # as its unit, and both halves of it are here. `best_finished_set` derives
            # the bar from the `closed` column — blinded to a large number, every set
            # passes and the claim is a comment. `schedule_sets` is the population it
            # judges — blinded to empty, there is nothing to be over the bar.
            "{SIG:best_finished_set}": 'return (999, "")',
            "{SIG:schedule_sets}": "return {}",
        },
    },
    {
        "name": "mutation_lock_gate.py",
        "src": ROOT / "scripts" / "mutation_lock_gate.py",
        "gate": ["python3", "../scripts/mutation_lock_gate.py", "--selftest"],
        "cwd": HOST,
        "floor": 4,
        "why": "the deriver that decides which gates rewrite this tree and must not run "
               "beside each other",
        "targets": {
            "{SIG:write_sites}": "return ([], [])",
            "{SIG:calls}": "return True",
            "{SIG:acquires}": "return True",
            # 🔴 THE TARGET THAT WAS STILL GREEN ON THE FIRST SWEEP, and §1.2 is what it
            # found: `settles` — the half that CLOSES a mutation record — was called by
            # nothing in that file's self-test, while its twin `acquires` had three cases.
            "{SIG:settles}": "return True",
            # 🔴 THE EMPTY IS THE PARTITION WITH NO MEMBERS, NOT `{}`. The first draft returned a
            # bare dict and the caller died on a KeyError — a mutant that CRASHES its gate is
            # not evidence about the instrument (197 §5), and this file's own marker would
            # have filed it as a catch.
            "{SIG:classify}": 'return ({"guarded": [], "unguarded": [], "temp_only": []}, 0, 0)',
            # ══ 🆕 279 §6 — THE FIVE `mutlock-controls-unblindable` (247) HELD FOR
            # THIRTY-TWO SESSIONS, AND THE EMPTY IS THE ROW'S OWN ARGUMENT ══════════════
            #
            # 🔴 EACH CONTROL RETURNS A PAIR, AND `(False, "")` IS THE FAILURE IT CANNOT
            # DESCRIBE. 247 priced the work as *a `--selftest` claim per control that
            # asserts the PAIR, so `(False, "")` fails on the empty reason rather than
            # passing as "did not refuse"* — so that pair is exactly the empty to blind
            # them to, and the claims that catch it are the ones the row asked for.
            # Every claim drives the member over a FIXTURE script: no lock is taken and no
            # real gate is spawned, which is what lets them sit on the A:gate axis at all.
            #
            # 🔵 AND 278 §2.3's SECOND-ENTRY SHAPE WAS JUDGED AND DOES NOT TRANSFER: the
            # second command IS the locked one, so no arrangement of entries dissolves a
            # lock. The row closed on the work it priced, not on the shape 278 suggested.
            "{SIG:refuses_under_lock}": 'return (False, "")',
            "{SIG:reader_refuses_under_lock}": 'return (False, "")',
            "{SIG:hook_refuses_under_lock}": 'return (False, "")',
            "{SIG:negative_control}": 'return (False, "")',
            "{SIG:_js_mutators}": "return ([], 0)",
            # 🆕 247 §1 — the two the coverage roster found that the A:gate axis already
            # reaches. `_base_name` strips a mutating gate's temp suffix and `_temp_roots`
            # is the set of directories a write is allowed to land in; both are read by
            # `classify`, and both were outside every mechanism in this file.
            "{SIG:_base_name}": "return None",
            "{SIG:_temp_roots}": "return set()",
        },
    },
    # ══ 🆕 247 §2 — THE FOURTH PYTHON INSTRUMENT — `py-cohort-two` (245) ═══════════════
    #
    # 🔴 IT IS ONE FILE AND NOT FOUR FOR THE REASON §1 IS ABOUT: until this session nothing
    # could tell a complete Python target list from an empty one, so adding four more
    # hand-written rosters would have been four more `0/0` lines. The roster comes first;
    # the cohort grows behind it.
    #
    # 🔴 AND SWEEPING THIS ONE FOUND A LIVE DEFECT ON THE FIRST BLIND. `tracked_files()` —
    # the walk that decides which files this gate scans — emptied to `[]` left it printing
    # `TERMINOLOGY ok — 0 file(s) swept, 0 retired term(s)` and exiting 0, on BOTH axes.
    # Every floor in that file was on the UNFILTERED walk. See terminology_gate.py's
    # `TERMINOLOGY_WALK` for the comparison that closes it.
    {
        "name": "terminology_gate.py",
        "src": ROOT / "scripts" / "terminology_gate.py",
        "gate": ["python3", "../scripts/terminology_gate.py", "--selftest"],
        "cwd": HOST,
        "floor": 5,
        "why": "the parser, the scanner and BOTH walks under the one rule in this project "
               "about the words it publishes",
        "targets": {
            # The parser: Rule 1's sentence, read out of the live policy.
            "{SIG:retired_terms}": "return []",
            # The scanner. 🔴 Caught on A:gate and DECLARED GREEN on B:live — a scanner
            # that finds nothing is the HEALTHY live reading, which is why the fixtures
            # exist at all.
            "{SIG:offenders}": "return []",
            # 🔴 THE ONE THAT WAS GREEN EVERYWHERE. Both walks are targeted, because the
            # gate has two and floored only one of them.
            "{SIG:tracked_files}": "return []",
            "{SIG:tracked_paths}": "return []",
            "{SIG:suffix_problems}": "return ([], {})",
        },
    },
    # ══ 🆕 277 §2 — THE FIFTH PYTHON INSTRUMENT — `py-cohort-handoff-gate` (247) ══════
    #
    # 🔴 THE ROW SAID FORTY-NINE AND THE FILE HOLDS SEVENTY-EIGHT. 247 measured the count,
    # nothing printed it, and twenty-nine sessions carried it as though it were a fact
    # about the tree — 276's own finding-to-carry, arriving in the row 276 handed forward.
    # It is not a small drift either: the members 247 could not see are more than half
    # again as many as the ones it could.
    #
    # 🔴 EVERY ONE OF THE SEVENTY-EIGHT WAS BLINDED AND THIS COMMAND RUN AGAINST IT before
    # a line of this roster was written. Fifty-six redden and are below. Twenty-two do
    # not, and they are not twenty-two reasons — they are THREE, and each row in
    # `NOT_A_TARGET` names which: twelve dial a network, SEVEN read an object store a
    # `--depth 1` checkout does not have, three are the invocation itself.
    #
    # 🔴 AND THE SWEEP FOUND TWO LIVE DEFECTS ON ITS FIRST PASS, which is why this entry
    # is worth more than the coverage line it prints (`terminology_gate.py` at 247, same
    # sentence). SEVEN of the seventy-eight originally CRASHED the self-test rather than
    # reddening it, all seven through two sites in `selftest()` — `all()` over an empty
    # `ends` sending the reader into `ends[0]`, and `len()` over a `read_measured` return
    # its own annotation says may be `None`. A gate that dies partway reports only the
    # failures it reached (199 §9.2): blinding `_runs` reddened five claims and killed the
    # command, and with the two sites fixed it reddens EIGHTY-SEVEN. Both are in
    # `handoff_gate.py` §277 §1 and the crash ceiling is what keeps them fixed.
    {
        "name": "handoff_gate.py",
        "src": ROOT / "scripts" / "handoff_gate.py",
        "gate": ["python3", "../scripts/handoff_gate.py", "--selftest"],
        "cwd": HOST,
        "floor": 40,
        "why": "every reader under the one document that says what this project measured, "
               "and the two assemblies that are the gate",
        "targets": {
            # ── the block and its atoms — the parse every claim downstream rests on ──
            "{SIG:SINCE}": "return \"\"",
            "{SIG:needed}": "return \"\"",
            "{SIG:block_session}": "return (None, \"\")",
            "{SIG:_split_atoms}": "return []",
            "{SIG:_runs}": "return [(\"\", [])]",
            "{SIG:counter_run}": "return ([], \"\",)",
            "{SIG:header_rows}": "return ([], [],)",
            "{SIG:header_atoms}": "return ([], set(),)",
            "{SIG:main_shas}": "return [\"\"]",
            "{SIG:block_main}": "return (\"\", \"\",)",
            "{SIG:population_block_shape}": "return []",
            "{SIG:moved_interval}": "return (0, \"\",)",
            "{SIG:tree_versions}": "return ((\"\", \"\",), \"\",)",
            "{SIG:block_versions}": "return ((\"\", \"\",), \"\",)",
            "{SIG:block_assetlib}": "return (\"\", \"\",)",
            "{SIG:version_interval}": "return (0, \"\",)",
            "{SIG:split_compound}": "return (None, \"\")",
            "{SIG:status_block}": "return ([\"\"], \"\")",
            "{SIG:counter_atoms}": "return ([], \"\",)",
            "{SIG:block_keys}": "return set()",
            # ── the join — an atom to the reader that answers it, and the measured log's own half ──
            "{SIG:main_at_head_of}": "return (\"\", \"\", [], \"\",)",
            # 🆕 279 — THE POPULATION `main_at_head_of` CANNOT SEE, AND THE TWO ACCESSORS
            # BOTH READINGS SHARE. `elsewhere_red_of` reports the newest run of every
            # workflow that did NOT land on `main`'s newest sha and did not pass — a
            # `schedule:` workflow is in that position for all but the window between its
            # cron run and the next merge, which is how a red `sdk-drift` survived two
            # sessions unread. Its empty is the list, and the empty list is exactly the
            # answer it gave for a week.
            "{SIG:elsewhere_red_of}": "return []",
            "{SIG:wf_name}": "return \"\"",
            "{SIG:wf_sha}": "return \"\"",
            "{SIG:main_head_problems}": "return ([], [],)",
            "{SIG:check_header}": "return ([], [], 0, 0,)",
            "{SIG:bind}": "return (\"\", \"\",)",
            "{SIG:measure}": "return ({}, [], [],)",
            "{SIG:read_measured}": "return (\"\", [])",
            "{SIG:log_readable}": "return False",
            "{SIG:ci_provenance}": "return ([], [], \"\")",
            "{SIG:leg_disagreements}": "return []",
            "{SIG:measured_run}": "return \"\"",
            "{SIG:verdict_problems}": "return ([], [],)",
            "{SIG:pending_problems}": "return []",
            "{SIG:population_reach_problems}": "return []",
            "{SIG:declared_tier}": "return None",
            # ── the replay and the workflows — 235 §8.1's list against what CI actually runs ──
            "{SIG:ci_scripts}": "return {}",
            "{SIG:command_norm}": "return \"\"",
            "{SIG:ci_commands_text}": "return {}",
            "{SIG:ci_commands}": "return {}",
            "{SIG:replay_commands}": "return set()",
            "{SIG:replay_ci_flag_problems}": "return ([], [],)",
            "{SIG:replay_scripts}": "return set()",
            "{SIG:replay_ci_problems}": "return ([], [],)",
            "{SIG:tracked_scripts}": "return []",
            "{SIG:import_edges}": "return {}",
            "{SIG:reached_scripts}": "return set()",
            "{SIG:unreached_problems}": "return ([], [],)",
            "{SIG:fenced}": "return []",
            "{SIG:replay_problems}": "return ([], [],)",
            "{SIG:ci_capture_steps}": "return []",
            "{SIG:ci_capture_norm}": "return \"\"",
            "{SIG:ci_capture_problems}": "return ([], [],)",
            # ── the two verdicts — the document gate, and the tier the open gate may grant ──
            "{SIG:gh_emit}": "return 0",
            "{SIG:tier_problems}": "return ([], [],)",
            "{SIG:check}": "return ([], [], 0, 0, 0, 0,)",
            "{SIG:tier_trigger}": "return (\"\", \"\", \"\", \"\",)",
            "{SIG:open_tier}": "return 0",
            # ── 🆕 278 §3 — the depth roster, `sweep-evidence-depth-sensitive` (277) ──
            # Three members, and every branch of all three is unexecuted by the live run:
            # `input_problems` returns `[]` on the shipped tree because every GATE_INPUTS
            # row runs in a job that supplies what it needs. That is the shape this
            # instrument exists for — a rule whose healthy answer is silence deletes in
            # silence too.
            "{SIG:workflow_jobs}": "return []",
            "{SIG:job_depth}": "return None",
            # 🆕 280 §4 — `depth_problems` IS `input_problems` NOW, and the rename is not
            # cosmetic: `gate-input-requirements-untabled` (279) turned one column into
            # five, so the four members below are the supply side that column never had.
            # `job_provides` reads each input off the job's own text and
            # `workflow_merge_blocking` reads the trigger block — blind either and every
            # requirement is satisfied by a job that supplies nothing.
            "{SIG:input_problems}": "return ([], [])",
            "{SIG:provider_coverage}": "return []",
            "{SIG:job_provides}": "return set()",
            # 🆕 281 — `counter-provenance-undeclared` (280). Eight members, and the two
            # worth naming are `code_only` and `reader_corpus`: they decide the
            # POPULATION the derivation reads, and both of them were measured wrong
            # before they were right. A blinded `code_only` hands the raw source back and
            # the prose fixtures start matching; a blinded `reader_corpus` drops
            # `_gate_lock.py` and every mutating gate's counter reads TRACKED.
            "{SIG:code_only}": "return ''",
            "{SIG:subject_of}": "return ('TRACKED', [])",
            "{SIG:reader_source}": "return None",
            "{SIG:reader_corpus}": "return []",
            "{SIG:derive_subjects}": "return {}",
            "{SIG:subject_coverage}": "return []",
            "{SIG:counter_subject_problems}": "return []",
            "{SIG:_stronger}": "return False",
            "{SIG:workflow_merge_blocking}": "return True",
            # 🆕 280 §3 — `release-1820-bump-under-wire` (278). The reader that refuses a
            # block which cut a release and said nothing about what the wire did, and the
            # pure semver derivation it may not be handed instead. Blind the first and
            # 1.82.0 ships again; blind the second and every cut reads as a PATCH.
            "{SIG:release_verdict_problems}": "return ([], [])",
            "{SIG:release_bump}": "return (\"PATCH\", \"\")",
        },
    },
    # ══ 🆕 278 §4 — THE SIXTH PYTHON INSTRUMENT — `release-names-twelve-readers` (247) ══
    #
    # 🔴 THE ROW SAID SEVENTEEN MEMBERS AND THE FILE HOLDS THIRTY-THREE. 277 §1 found
    # `handoff_gate.py`'s row wrong by twenty-nine; this is its SIBLING, split out of the
    # same 247 cohort, wrong the same way in the same direction, measured one session
    # later. 276's finding-to-carry has now landed in three consecutive sessions and every
    # time the reason was identical: the count was taken by hand, nothing printed it, and
    # a claim with no reader cannot be wrong.
    #
    # 🔴 AND THE BLAST READ ZERO BEFORE `E_FAIL` EXISTED. This file reports in a FIFTH
    # dialect and `failure_lines` could spell four, so the sweep that produced the roster
    # below measured 0 across ten reddening blinds — a floor taken from it would have been
    # a floor at nothing (172 §10.21), which is precisely what 277 §4 recorded about the
    # instrument directly above this one. 245 measured the same thing about the first three
    # Python instruments. Three sessions, three hand measurements, no refusal — so 278
    # shipped `BLAST_UNREADABLE` beside the fifth regex, and THAT is the part that stops a
    # sixth being found by hand.
    #
    # 🔴 THE SWEEP FOUND SIX CRASHES AND FIXED FOUR OF THEM INTO CATCHES. Every one was the
    # same shape as 277 §1.2 one file over — `selftest()` subscripting a detail bag straight
    # off a reader whose own annotation permits the empty — and a fifth was on the LIVE path
    # (`--assert-addon`'s printer, `KeyError: 'version'` BEFORE the refusal line, so the
    # command could not say what was wrong with it). `detail_or_refusal` in that file is the
    # third state, refused by name. Measured: 10 red / 6 crash before, 15 red / 2 crash
    # after, and the blast went 63 -> 110 across the same population.
    #
    # 🔵 THE TWO REMAINING CRASHES ARE THE INVOCATION ITSELF, exactly as `handoff_gate.py`'s
    # three are: blinding `selftest` or `main` makes the command do nothing and exit 0, which
    # is a fact about argv rather than about the instrument. Both are in `NOT_A_TARGET`.
    {
        "name": "release_names.py",
        "src": ROOT / "scripts" / "release_names.py",
        "gate": ["python3", "../scripts/release_names.py", "--selftest"],
        "cwd": HOST,
        "floor": 12,
        "why": "every predicate under the one file that decides what a release is ALLOWED "
               "to be called, and the guard that keeps its own self-test reporting",
        "targets": {
            # ── check 1 and check 8 — the names in the block, and the wire beneath them ──
            "{SIG:read_names}": "return ([], [])",
            "{SIG:verdict}": "return (\"\", \"\", {})",
            "{SIG:wire_floor}": "return (\"\", \"\", {})",
            "{SIG:major_evidence}": "return []",
            # ── check 2 — the producer window, which reads no notes at all ──
            "{SIG:parse_diff}": "return {}",
            "{SIG:is_version_bump_hunk}": "return False",
            "{SIG:split_window}": "return ([], [])",
            "{SIG:population}": "return (\"\", \"\", {})",
            # ── check 3 and check 4 — the tarball map, and the addon's own tree ──
            "{SIG:assert_map}": "return (\"\", \"\", {})",
            "{SIG:addon_state}": "return (\"\", \"\", {})",
            "{SIG:_oldest}": "return None",
            # ── the tag the NEXT cut reads, and the fixture the whole table is built on ──
            "{SIG:tag_message}": "return \"\"",
            "{SIG:tag_command}": "return (\"\", \"\")",
            "{SIG:_pack}": "return []",
            # 🆕 278 — THE GUARD ADDED THIS SESSION IS A TARGET LIKE ANY OTHER. A guard
            # that can return "the bag is complete" for a bag that is not is the defect it
            # was written against, wearing the fix's name.
            "{SIG:detail_or_refusal}": "return \"\"",
        },
    },
    # ══ 🆕 278 §4 — THE SAME FILE, A SECOND COMMAND, AND THE REASON IS STRUCTURAL ═══════
    #
    # 🔴 BOTH OF THIS HARNESS'S AXES ARE ANCHORED TO ONE TARGET LIST, and until this entry
    # existed that made a whole class of member unreachable. A target must redden on
    # `inst["gate"]` — there is no `DECLARED_GREEN` for the primary axis and deliberately
    # so — and the B:live late sweep iterates the SAME list. So a member that is green
    # under the gate command and CAUGHT by a different live command has nowhere to be
    # declared: not a target, because the primary axis would refuse it STILL GREEN; not
    # an exclusion either, because it is demonstrably covered.
    #
    # 🔴 MEASURED, AND IT IS EXACTLY THE ROW 247 OPENED. Blinding all sixteen members that
    # survive `--selftest` against BOTH live commands: four die under `--assert-addon`,
    # one under `--assert-map`, eleven under neither. 247 said *the readers are exercised
    # only by `--assert-addon` and `--assert-map`* and was right — there was simply no
    # shape in this file that could say so, which is why the row sat for thirty sessions.
    #
    # 🔵 THE SHAPE ALREADY EXISTED AND IS ONE ROW UP: `path-cohort (compiled walk)` is a
    # SECOND entry over a second artefact with its own name, targets and floors. This is
    # that, over a second COMMAND rather than a second file. Entry one is
    # gate `--selftest` / live `--assert-addon`; this one is gate `--assert-addon` / live
    # `--assert-map`, so between them all three commands ci.yml runs against this file are
    # an axis rather than a claim about one.
    {
        "name": "release_names.py (--assert-addon)",
        "src": ROOT / "scripts" / "release_names.py",
        "gate": ["python3", "../scripts/release_names.py", "--assert-addon"],
        "cwd": HOST,
        "floor": 4,
        "why": "check 4's four live readers — the ones that ask whether the addon's version "
               "still names exactly one tree, and which no fixture can reach",
        "targets": {
            "{SIG:addon_version}": "return None",
            "{SIG:addon_stamp_commit}": "return None",
            "{SIG:_first_commit_introducing}": "return None",
            # 🔴 AND THIS ONE IS THE SIXTH CRASH SITE, NOW A CATCH. Blinded, it used to take
            # `--assert-addon` down with `KeyError: 'version'` from check 4's own printer,
            # BEFORE the refusal line — so the command could not say what was wrong with
            # it (273's reader that cannot show its own refusal). `detail_or_refusal` at
            # the printer is what turned that crash into this target.
            "{SIG:_addon_live}": "return (\"\", \"\", {})",
        },
    },
]


# ══ 🆕 212 §4 — THE ROSTER THAT COULD NOT REPORT ITS OWN OMISSIONS ═════════════════
#
# 🔴 EVERY MECHANISM IN THIS FILE MAKES A TARGET ROBUST. NOTHING ASKED WHETHER THE LIST
# COVERS THE MODULE. `resolve_sig` refuses a target that resolves to nothing (EXISTENCE)
# and one that resolves to two things (UNIQUENESS); `blind()` refuses one it cannot
# apply; `BLAST_FLOOR` refuses a sweep that stopped reddening. All of them are about
# targets that ARE written. A member nobody wrote a target for is invisible to all four,
# and the sweep prints `ok` over an instrument half of which was never mutated.
#
# 🔴 MEASURED BEFORE THE CHECK EXISTED (`probe212_exported.py`): 45 exported callables
# targeted across the eleven instruments and EIGHTEEN not — including seven plain
# `function` declarations `_decl_re` could have anchored all along, and `report` in
# `boundary_gate.mjs`, which RETURNS THE GATE'S EXIT CODE.
#
# 🔴 AND THIS IS WHY 211 §6 IS A ROSTER ROW AND NOT A PARAGRAPH. 211 §19: "when a session
# declines to fix something and writes a comment saying so, the comment should be a
# `problems.append` or a roster row with a reason, never a paragraph." `token-cost.mjs`
# carried exactly such a paragraph about `bytes` and `family` for two sessions and it was
# silent on every green run since. The exclusions below cost a written reason; the
# absence of a member from both tables costs a failure.
#
# The population is DERIVED — "exported callable in the instrument's own source" — rather
# than listed. A rule scoped to a property cannot rot in the direction a list does, which
# is 183's lesson in `tautology_gate.mjs` and 182 §9's in `floor_pin_gate.py`.
#
# ── 🆕 247 §1 — AND THE PROPERTY IT WAS SCOPED TO WAS `export`, WHICH IS ONE LANGUAGE ──
#
# 🔴 THE TWO PATTERNS BELOW ARE JAVASCRIPT. 245 §1 put three PYTHON instruments in the
# table above and this roster has printed `0/0 exported member(s) targeted · 0 declared
# NOT_A_TARGET` over every one of them on every run since — not a small number, THE
# number a file with no members would print. Every claim in the paragraph above was true
# of the `.mjs` half and vacuous over the `.py` half, and a Python target list has been
# a hand-written roster with no DISCOVER half at all: exactly the state 212 §4 built this
# check to end, arriving again the moment the population gained a second language.
#
# 🔴 MEASURED BEFORE THE FIX (`probe247b.py`, every top-level `def` blinded and each
# instrument's own command run): THIRTY members across the three, TWELVE targeted.
#
#     mutation_lock_gate.py   14 def(s), 5 targeted — and three of the nine are
#                             `refuses_under_lock`, `reader_refuses_under_lock` and
#                             `hook_refuses_under_lock`, the controls that decide whether
#                             every mutating gate in this tree refuses to run beside
#                             another. `--selftest` never calls one.
#     queue_gate.py            8 def(s), 3 targeted — `ages` among them, the deriver
#                             `QUEUE.md`'s premise rests on ("the ages are DERIVED — do
#                             not type one here"), reached only by `--render`.
#     p0_comments.py           7 def(s), 5 targeted — the two left are the invocation
#                             pair, and this one really was complete.
#
# 🔴 AND `NOT_A_TARGET` COULD NOT HAVE HELD THE ANSWER EITHER. `declared` below is
# subtracted by each instrument's EXPORTED members, so a Python row would have been
# reported as an exemption outliving its member forever — the roster refusing the only
# way there was to write an excuse in it. Both halves are language-aware now: what the
# population is, and what a row in the escape hatch is allowed to name.
_EXPORT_FN = re.compile(r"^export[ \t]+(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(")
_EXPORT_ARROW = re.compile(
    r"^export[ \t]+(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(?:async[ \t]+)?\(")
# 🔴 COLUMN ZERO, WHICH IS THE WHOLE OF THE READING. A `def` at any indent is a method or
# a closure, and `py_resolve_sig` anchors on `py_decl_lines` — which reads exactly this —
# so a population wider than the anchor could name members no target could ever address.
# The two readers agree by construction: this is the same pattern, asked of the module.
_PY_DEF = re.compile(r"^def[ \t]+([A-Za-z_][\w]*)[ \t]*\(")


def members_of(src: "Path") -> "list[str]":
    """The callables a coverage claim is made over, in the language the file is written in.

    PURE over the file's text. 🔴 THE `.py` HALF IS EVERY TOP-LEVEL `def` AND NOT THE
    PUBLIC ONES: Python has no `export`, and the three instruments above already target
    `_looks_like_code`, `_cells` and `_base_name`. A population that dropped the
    underscore names would have declared three existing targets un-covered and, worse,
    excused `_js_mutators` — a real member with a real blind — by a naming convention.
    """
    text = src.read_text(encoding="utf-8", errors="replace")
    if str(src).endswith(".py"):
        return [m.group(1) for ln in text.split("\n") if (m := _PY_DEF.match(ln))]
    out: "list[str]" = []
    for ln in text.split("\n"):
        m = _EXPORT_FN.match(ln) or _EXPORT_ARROW.match(ln)
        if m:
            out.append(m.group(1))
    return out

NOT_A_TARGET: dict[tuple[str, str], str] = {
    # 🔴 `main` IS THE INVOCATION, NOT A READER. Blinding it stops the gate producing any
    # output at all, so it never prints its VERDICT_MARKER and the sweep files it as a
    # CRASH — a judgement about this harness rather than about the instrument. The
    # readers `main` calls are targeted individually, which is where the claim lives.
    ("verdict_gate.mjs", "main"): "the invocation, not a reader — blinding it removes the "
                                  "verdict marker and produces a crash rather than a catch",
    ("boundary_gate.mjs", "main"): "the invocation, not a reader — see verdict_gate.mjs::main",
    ("seal_order_gate.mjs", "main"): "the invocation, not a reader — see verdict_gate.mjs::main",
    # 🔴 MEASURED BEFORE IT WAS DECLARED, WHICH IS THE DIFFERENCE BETWEEN A ROSTER ROW AND
    # AN EXCUSE. `{SIG:surface}` was written as a target and swept: blinded to `return []`
    # the gate STAYED GREEN on the A:gate axis, and on the late axis the mutant produced
    # no LATE_BLIND_CALLS line at all. Both say the same thing — `wire_diff.selftest.mjs`
    # NEVER CALLS IT. It cannot: `surface()` boots a built server over stdio and the
    # self-test is fixture-driven by construction (206 §3), and `wire_diff.mjs` is in
    # LATE_LIVE_NA so there is no live axis to reach it either. The only caller that
    # exercises this member is the release script's check 8.
    # 🔴 SO THE HONEST STATEMENT IS THAT THIS INSTRUMENT'S WIRE READER IS UNCOVERED BY CI,
    # and it is written HERE — where a member appearing or a driver arriving reddens the
    # roster — rather than in a paragraph that is silent on every green run (211 §19).
    # Giving `wire_diff.mjs` a B:live axis against `host/dist/index.js` is the fix and is
    # its own item: it needs a built server in the gate's own runtime budget.
    ("wire_diff.mjs", "surface"):
        "boots a built server over stdio; the self-test is fixture-driven by construction "
        "(206 §3) and this instrument has no B:live axis, so NO gate this harness runs "
        "calls it. Measured, not assumed: blinded to `return []` the A:gate axis stayed "
        "GREEN and the late mutant never loaded. Its only live caller is the release "
        "script's check 8. 🔴 A live axis against host/dist/index.js is the fix.",
    # 🆕 231 — THE SAME SPLIT ONE INSTRUMENT OVER, AND IT IS THE SAME THREE SENTENCES.
    # `wire_invisible_gate.mjs` has a PURE half (`audit`, `walkNode`, `walkSurface`,
    # `stripCheck`, `siteKey` — all targeted above) and a LIVE half that needs `host/dist`
    # and an in-memory MCP pair. The self-test drives the pure half by construction, so a
    # blind on any of these three cannot redden it — measured, not assumed: the gate
    # refused all three as untargeted on this file's first run and each was checked before
    # being written down here rather than after.
    # 🔴 THE HONEST STATEMENT IS THAT THIS INSTRUMENT'S LIVE READER IS COVERED BY THE CI
    # STEP AND NOT BY THIS HARNESS. `node scripts/wire_invisible_gate.mjs` runs in the
    # host-tests job after the dist build and exercises all three on every push; what no
    # gate here does is BLIND them and require a red. That is the same item `wire_diff.mjs`
    # carries above, and it is one item rather than two.
    ("wire_invisible_gate.mjs", "recordSurface"):
        "records the surface out of `host/dist` — the self-test is fixture-driven by "
        "construction and this instrument has no B:live axis, so no gate this harness runs "
        "calls it. The CI step `node scripts/wire_invisible_gate.mjs` does, unblinded.",
    ("wire_invisible_gate.mjs", "emitPair"):
        "spawns an in-memory MCP server pair to read `tools/list` — same shape as "
        "wire_diff.mjs::surface, and unreachable from a fixture-driven proof for the same "
        "reason.",
    ("wire_invisible_gate.mjs", "measureVisibility"):
        "the loop over `emitPair`; it cannot be exercised without a server either, and "
        "`audit` — which is what decides the verdict from its result — IS targeted.",
    # 🆕 232 — THE THIRTEENTH INSTRUMENT'S TWO, AND BOTH WERE MEASURED BEFORE BEING
    # WRITTEN HERE. `positive_control_gate.selftest.mjs` imports `classify`, `judge` and
    # `acceptance` and NOTHING ELSE — read off its import list, not guessed — so a blind
    # on either member below cannot redden the A:gate axis whatever it returns.
    # 🔴 AND UNLIKE THE FOUR ROWS ABOVE, THESE TWO ARE COVERED — by the B:live axis this
    # instrument ships with, `node scripts/positive_control_gate.mjs`, which CI runs on
    # every push and which this gate BLINDS. `scan` is the tree walk that feeds it; a
    # late blind there takes the population to nothing and PC_POPULATION/PC_FILES fire.
    # The row is here because the A:gate axis cannot reach them, not because nothing can.
    ("positive_control_gate.mjs", "scan"):
        "the real-tree walk: `positive_control_gate.selftest.mjs` is fixture-driven by "
        "construction (it drives `classify`/`judge` over source text with no tree at all), "
        "so the A:gate axis cannot reach it. 🟢 The B:live axis DOES — `node "
        "scripts/positive_control_gate.mjs` is in LATE_LIVE and blinds this member.",
    # 🆕 246 — THE FILESYSTEM HALF OF THE IMPORT HOP, AND IT IS `scan`'s ROW EXACTLY.
    ("positive_control_gate.mjs", "fsModuleReader"):
        "the resolver that turns a module specifier into a file: the self-test is "
        "fixture-driven by construction and hands `classify` its own reader through "
        "`opts`, so no A:gate case ever calls this one. 🟢 The B:live axis DOES — the live "
        "run uses the default reader, and blinding it takes all five imported terminals "
        "back to `declared-outside-this-file`, which puts the defect count back over "
        "`DEFECT_CEILING` and reddens `node scripts/positive_control_gate.mjs`.",
    ("positive_control_gate.mjs", "main"):
        "the invocation, not a reader — see verdict_gate.mjs::main. The three readers it "
        "calls are targeted individually and `scan` is reached by the live axis.",
    # ══ 🆕 247 §1 — THE PYTHON ROWS, WHICH THIS TABLE COULD NOT HOLD UNTIL THIS SESSION ══
    #
    # Every row below was measured with `probe247b.py` before it was written: each member
    # blinded to the empty its annotation promises, each instrument's own command run.
    #
    # 🔴 THE INVOCATION PAIR IS TWO ROWS IN PYTHON AND ONE IN JAVASCRIPT, and the reason is
    # in the measurement rather than in the style. `sys.exit(main())` is the entry point, and
    # each of these files dispatches from `main` into a `--selftest` body — so blinding
    # EITHER produces a process that prints nothing, reaches no verdict marker and exits 0.
    # That is `verdict_gate.mjs::main`'s class exactly (a crash rather than a catch), twice
    # per file, because the dispatch is a second function and not an `if` in the first.
    ("p0_comments.py", "main"): "the invocation, not a reader — see verdict_gate.mjs::main",
    ("p0_comments.py", "_selftest"):
        "the second half of the invocation: `main` dispatches `--selftest` here, so blinding "
        "it removes the whole report rather than a reading inside it. The five members it "
        "drives are targeted individually, which is where the claims live.",
    ("queue_gate.py", "main"): "the invocation, not a reader — see verdict_gate.mjs::main",
    ("queue_gate.py", "selftest"):
        "the second half of the invocation — see p0_comments.py::_selftest. Blinded, the "
        "A:gate command prints no `QUEUE_SELFTEST` line at all.",
    # 🆕 281 — MEASURED, AND THE MEASUREMENT IS WHY IT CANNOT BE A TARGET. Its subject is
    # THE CHECKOUT, and the two checkouts this gate runs on disagree on purpose: deep in
    # `contract-check`, `--depth 1` in `host tests`. Blinded to False it changes nothing
    # on a deep tree (the answer it returns anyway) and on a shallow one it reddens for a
    # reason that is a fact about the runner, so the target would be a claim about which
    # machine swept it — 277's whole finding, and the class this file's own
    # object-store rows are exempted under one instrument over.
    ("queue_gate.py", "repo_is_shallow"):
        "reads the state of the CHECKOUT, and CI's two callers are deliberately "
        "different depths — `git rev-parse --is-shallow-repository`.",
    # 🆕 281 — `handoff_gate.py::previous_main`'s class, one instrument over, and it was
    # SHIPPED AS A TARGET FIRST AND REFUSED BY THIS GATE ON CI. That refusal was correct
    # and its sentence is the row: *'found nothing' and 'did not look' are the same
    # observable*. On a shallow checkout they are — which is the whole reason
    # `repo_is_shallow` exists — so a blind on the reader that produces the diff has
    # nothing left to change there.
    ("queue_gate.py", "session_diff"):
        "reads the git object store and REDDENS on a full clone, which is exactly why it "
        "may not be a target. Measured on both depths rather than assumed: blinded to "
        "`None` on a deep tree the gate exits 1 with two `QUEUE_PATHS_UNREAD` refusals; "
        "on a `--depth 1` clone of the same tree it exits 0, because there is no merge "
        "base for the unblinded reader to have found either. `host tests` is the shallow "
        "caller (via this file's own live axis) and `contract-check` is the deep one — "
        "the reading is merge-blocking there.",
    ("mutation_lock_gate.py", "main"):
        "the invocation, not a reader — and in this file `main` is ALSO the live control "
        "runner, which is what the five rows below are about.",
    ("mutation_lock_gate.py", "_selftest"):
        "the second half of the invocation — see p0_comments.py::_selftest.",
    # 🟢 279 §5 — THE FIVE LEFT THIS TABLE. `mutlock-controls-unblindable` (247) is closed:
    # `refuses_under_lock`, `reader_refuses_under_lock`, `hook_refuses_under_lock`,
    # `negative_control` and `_js_mutators` are each driven from `--selftest` now, over
    # fixture scripts and a fixture directory, so all five are A:gate TARGETS and none is
    # declared. Three of them were hard-wired to one path and are parameters now, which is
    # 228's own move on `negative_control` repeated for its neighbours; every live caller
    # is byte-identical because the default is the path that was hard-wired.
    #
    # 🔵 AND 278 §2.3's SECOND-ENTRY SHAPE WAS JUDGED AND DOES NOT TRANSFER — the second
    # command IS the locked one, so no arrangement of entries dissolves a lock. The row
    # closed on the work it priced at 247 rather than on the shape 278 suggested.
    # 🆕 247 §2 — the fourth Python instrument's invocation pair.
    ("terminology_gate.py", "main"):
        "the invocation, not a reader — see verdict_gate.mjs::main. 🔴 AND IT IS THE ONE "
        "PLACE THIS FILE'S NEW LIVE CHECK LIVES, which is why `tracked_files` is targeted "
        "and this is not: the blind that mattered goes through the member, not the frame.",
    ("terminology_gate.py", "_selftest"):
        "the second half of the invocation — see p0_comments.py::_selftest. Blinded, the "
        "A:gate command prints no `TERMINOLOGY_SELFTEST_DONE` line at all.",
    # ══ 🆕 277 §2 — `py-cohort-handoff-gate` (247): TWENTY-ONE ROWS AND THREE REASONS ══
    #
    # 🔴 EACH OF THESE WAS BLINDED AND MEASURED GREEN BEFORE IT WAS WRITTEN DOWN, which is
    # 211 §19's difference between a roster row and an excuse. What makes them a table
    # rather than twenty-one paragraphs is that they fall into three classes and the class
    # is the reason: this file's self-test is fixture-driven by construction, so a member
    # whose measurement is the NETWORK, the OBJECT STORE, or the INVOCATION ITSELF has
    # nothing here that could redden it. Anything outside those three is a target.
    #
    # ── I — the network (12). Twelve members whose population is a forge, a registry or
    # an asset library. `--selftest` runs with no network by design and CI's own container
    # answers HTTP 403 to all three hosts, so a blind here would be green on a healthy
    # tree for the same reason it is green on a broken one — `registry_lag.py`'s and
    # `assetlib_sweep.py`'s reason in `PY_NOT_SWEPT`, one level down, at member scope.
    # 🔴 AND THE PURE HALVES ARE TARGETED, WHICH IS WHAT MAKES THIS A SPLIT AND NOT AN
    # EXEMPTION: `main_at_head_of` is `main_at_head`'s whole judgement with the dial taken
    # out, `main_head_problems` is the refusal it feeds, and both are swept above. What is
    # excused here is the transport, never the verdict.
    **{("handoff_gate.py", _n): (
        "reads the network — `--selftest` is fixture-driven by construction and dials "
        "nothing, and the container CI runs it in answers HTTP 403 to github.com, "
        "registry.npmjs.org and godotengine.org alike. Measured green under the blind, "
        "not assumed. Where this member has a pure half, that half IS a target above.")
       # 🆕 280 — `npm_untagged` JOINS ITS SIBLING, and for its sibling's reason: its
       # transport is `origin_tag_names`, which is `git ls-remote`, and the pure half
       # it defers to — `registry_lag.untagged()` — is a target in that file's own
       # roster. What is excused here is the dial, never the verdict.
       for _n in ("ci_check_runs", "npm_lag", "npm_untagged", "gh_rest_fetch",
                  "gh_rest_object", "gh_rest",
                  "gh_open", "gh_open_rest", "assetlib_live", "main_at_head",
                  # 🆕 279 — `main_at_head_rest` LEFT THIS LIST BECAUSE IT LEFT THE FILE.
                  # Both readings of `main` are taken off ONE dial now, so the transport is
                  # `main_run_rows` and its `gh`-free half; a second function dialling for
                  # the same list would be two chances for the two readings to disagree
                  # about which world they describe (275's `MEASURED_LEG_DISAGREEMENT`).
                  "main_run_rows", "main_run_rows_rest",
                  "gh_run_verdict", "gh_run_verdict_rest")},
    # ── II — the object store (7). Every one reads git history or git config, and 235
    # §6.3 is the standing finding: `actions/checkout` fetches one commit, so a claim over
    # tags, parents or a remote is a claim about the MACHINE. This file has paid for that
    # exact mistake once, in `MOVED_LIVE`, and the claim that survived it asserts a number
    # where the objects are and a REFUSAL where they are not. A blind on these six is
    # green on a full clone and green on CI's shallow one, and neither green is evidence.
    **{("handoff_gate.py", _n): (
        "reads the git object store or git config — CI's checkout is `--depth 1`, so a "
        "self-test claim over tags, parents, remotes or working-tree state is a claim "
        "about the machine (235 §6.3, which this file already paid for at `MOVED_LIVE`). "
        "Measured green under the blind on a FULL clone, where the objects do exist.")
       for _n in ("clone_tags", "origin_tag_names", "origin_tags", "parent_of",
                  "origin_slug", "tree_state")},
    # 🔴 THE SEVENTH, AND IT IS THE ONLY ONE OF THE TWENTY-TWO THAT WAS MEASURED WRONG.
    # `previous_main` REDDENS on a full clone, so 277's first sweep filed it as a target
    # and this gate refused it on CI: `INSTRUMENT_GATE_BLIND … 🔴 STILL GREEN
    # {SIG:previous_main}` on all three `host tests` legs and on no local run. The reason
    # is `moved_interval`, its only consumer: it runs `git rev-list old..new`, and on a
    # `--depth 1` checkout that command fails and the reader returns its documented
    # refusal — *a fact about the clone and not about the claim* — with or without the
    # blind. So the coverage a target here records is coverage this instrument has on one
    # machine and not on the machine that gates the merge.
    # 🔴 AND THE SESSION THAT WROTE IT HAD JUST SPENT A DAY ON THIS EXACT SENTENCE. The
    # measurement was taken on a full clone and reported as a fact about the tree, which
    # is 276's finding-to-carry happening to the person carrying it. 275's
    # `MEASURED_LEG_DISAGREEMENT` found the same thing in a counter; this is it in a
    # coverage claim, and CI is what said so both times.
    ("handoff_gate.py", "previous_main"):
        "reads the git object store, and unlike the six above it REDDENS on a full clone — "
        "which is exactly why it may not be a target. Its only consumer, `moved_interval`, "
        "runs `git rev-list old..new`; on CI's `--depth 1` checkout that fails and the "
        "reader returns the same documented refusal blinded or not. Measured on both "
        "machines, not assumed: caught locally, STILL GREEN on all three CI legs (235 "
        "§6.3, and 275's `MEASURED_LEG_DISAGREEMENT` one layer down).",
    # ── III — the invocation (3), and the third is the one worth reading twice.
    ("handoff_gate.py", "main"):
        "the invocation, not a reader — see verdict_gate.mjs::main. Every command it "
        "dispatches to is a target above, which is where the claim lives.",
    ("handoff_gate.py", "selftest"):
        "🔴 THIS COMMAND. Blinding the self-test to `return 0` removes the axis every "
        "judgement in this sweep is made on, so the mutant is not evidence about the "
        "instrument — it is the harness measuring its own absence (`instrument_gate.py`'s "
        "own reason in `PY_NOT_SWEPT`, one file over).",
    ("handoff_gate.py", "patterns"):
        "🔴 THE ONE ROW HERE THAT IS A COST AND NOT A KIND, and it is written down rather "
        "than folded into the class above because the two are different work. `--patterns` "
        "is a second command CI runs, so `LATE_LIVE_COST` gives it the [B:live] axis a "
        "budget rather than an excuse; what it cannot be is a TARGET, because the only "
        "claim `--selftest` could make about it is that it returns 0, which is exactly "
        "what a blind returns. A claim on the printed line needs a tree with a broken "
        "anchor in it, and that is a fixture nothing here builds — `queue_gate.py`'s "
        "`{SIG:ages}` shape (247 §1) without `queue_gate.py`'s cheap live command.",
    # ══ 🆕 278 §4 — `release-names-twelve-readers` (247): FOURTEEN ROWS, THREE REASONS ══
    #
    # 🔴 EVERY ONE BLINDED AND MEASURED ON BOTH AXES BEFORE IT WAS WRITTEN DOWN — all
    # thirty-three members against `--selftest`, then all sixteen A:gate greens against
    # BOTH `--assert-map` AND `--assert-addon`. That second sweep is what turned five of
    # the sixteen into targets and left eleven, so the number below is a residue rather
    # than a starting position: 247's row guessed twelve unreachable readers, the first
    # axis found sixteen, and the second put four of them on the live axis and named the
    # command that catches the fifth.
    #
    # ── I — the RELEASE RITUAL, and there is no command CI can run to reach it (11) ──
    #
    # 🔴 THIS IS THE ONE REASON HERE THAT IS ABOUT A MACHINE RATHER THAN A POPULATION, AND
    # IT WAS MEASURED RATHER THAN ARGUED. These eleven are called only by `main()`'s
    # no-flag path — the cut itself — and that path refuses on any ordinary commit before
    # it reaches them, because a released block for the version being cut does not exist
    # until the cut writes one. The axis needs a tree no CI run has.
    #
    # 🔵 AND A PATH TO IT DOES EXIST, WHICH IS WHY THIS IS A ROW AND NOT A DEAD END.
    # `--head-ref` replays a PAST cut, and 278 drove one green — version 1.82.0 against
    # previous 1.81.0 at that tag, claiming MAJOR — which exercises checks 1, 2, 4 and 8
    # and exits 0. It is not adopted here because it pins two tag literals and a bump that
    # are facts about one historical window; a third axis built on those is a claim about
    # the machine in a different costume. Opened as `release-names-ritual-axis`.
    **{("release_names.py", _n): (
        "reached only by the RELEASE RITUAL — `main()`'s no-flag path — and that path "
        "refuses before it reaches this member on any tree without a released block for "
        "the version being cut, which is every tree CI ever checks out. Measured on both "
        "of the commands CI DOES run: green under the blind against `--assert-map` AND "
        "against `--assert-addon`. `release-names-ritual-axis` is where the third axis "
        "is priced.")
       for _n in ("shipped_corpus", "released_block", "changed_window", "raw_window",
                  "wire_read", "engines_window", "tag_tree_version", "tag_release_commit",
                  "tag_shadow", "addon_moved_since", "release_commit")},
    # ── II — the one caught by the OTHER live command (1) ──
    #
    # 🔴 AN EXCLUSION WITH A MEASUREMENT IN IT CAN BE FALSIFIED (277 §4), so this row names
    # the command that catches it and the refusal that command prints.
    ("release_names.py", "tarball_entries"):
        "caught, but by the live command this instrument's B:live axis does not run. "
        "Blinded to its empty it takes `--assert-map` red with `MAP_TARBALL_THIN — the "
        "tarball has 0 entr(y/ies), below the floor`; `--assert-addon`, which IS this "
        "file's live axis, does not call it. `LATE_LIVE` is keyed one command per "
        "instrument and `--assert-addon` catches four members against this one — so the "
        "four win and this row names what would catch it. Falsify by making the axis run "
        "both commands.",
    # ── III — the invocation (2), exactly as `handoff_gate.py`'s three are ──
    ("release_names.py", "main"):
        "the invocation, not a reader — see verdict_gate.mjs::main. Blinded to `return 0` "
        "the command produces no output at all and never prints its VERDICT_MARKER, so the "
        "sweep files it a CRASH: a judgement about argv rather than about the instrument.",
    ("release_names.py", "selftest"):
        "🔴 THIS COMMAND — see handoff_gate.py::selftest above. Blinding the self-test "
        "removes the axis every judgement in this sweep is made on, so the mutant measures "
        "the harness's own absence rather than the instrument.",
    # ── IV — covered by the SECOND ENTRY, which is the whole reason it exists (4) ──
    #
    # 🔵 THE ONLY ROWS IN THIS TABLE THAT MEAN *COVERED ELSEWHERE* RATHER THAN *NOT
    # COVERED*. Each is green under `--selftest` — the fixtures never call it — and each
    # reddens `--assert-addon`, which is `release_names.py (--assert-addon)`'s gate. The
    # exclusion is falsified by deleting that entry: `INSTRUMENT_GATE_COVERAGE` would then
    # report four members with a reason naming an instrument that does not exist.
    **{("release_names.py", _n): (
        "green under `--selftest` because the fixtures never call it, and a TARGET of "
        "`release_names.py (--assert-addon)` — the second entry over this same file, whose "
        "gate is the live command that does. Measured on both, not assumed.")
       for _n in ("addon_version", "addon_stamp_commit", "_first_commit_introducing",
                  "_addon_live")},
    # ── 🆕 278 §4 — THE SECOND ENTRY'S COVERAGE, and it is one sentence twenty-nine times.
    #
    # `coverage_problems` reads `members_of(src)` per ENTRY, and both entries share a
    # source file — so every member this command does not reach needs a row here under the
    # second name. That is not duplication: it is the check refusing to let a second entry
    # quietly narrow the population it is judged against. The four it DOES reach are its
    # targets; `selftest` and `main` are the invocation for the same reason as above.
    **{("release_names.py (--assert-addon)", _n): (
        "targeted under `release_names.py`, whose gate is `--selftest`. This entry exists "
        "only for the four members that command cannot reach (see its header), and "
        "`--assert-addon` does not call this one — measured under the blind, green.")
       for _n in ("wire_floor", "major_evidence", "read_names", "verdict", "parse_diff",
                  "is_version_bump_hunk", "split_window", "population", "assert_map",
                  "shipped_corpus", "released_block", "changed_window", "raw_window",
                  "wire_read", "engines_window", "tag_tree_version", "tag_release_commit",
                  "tag_shadow", "addon_state", "_oldest", "addon_moved_since",
                  "release_commit", "tag_message", "tag_command", "tarball_entries",
                  "_pack", "detail_or_refusal", "selftest", "main")},
}


def coverage_problems(instruments) -> list[str]:
    """Every exported callable is a target or carries a written reason — 🆕 212 §4."""
    problems: list[str] = []
    declared = set(NOT_A_TARGET)
    for inst in instruments:
        src: Path = inst["src"]
        if not src.exists():
            continue
        exported: list[str] = members_of(src)
        # 🔴 LITERAL ANCHORS COUNT, AND THE FIRST RUN OF THIS CHECK PROVED WHY IT HAS TO
        # SAY SO. `judgeDiscarded` is targeted by a two-line literal because its signature
        # spans two lines and `_decl_re` is line-anchored; a coverage reader that only
        # understood placeholders reported the one member in this file that IS swept as
        # the one that is not. A check whose own population is read the wrong way is the
        # defect it was written to find, one level up.
        targeted = set()
        for s in inst["targets"]:
            if (m := SIG_RE.match(s)) is not None:
                targeted.add(m.group("name"))
                continue
            m = re.match(r"^(?:export[ \t]+)?(?:async[ \t]+)?(?:static[ \t]+)?"
                         r"(?:function[ \t]+)?(?:get[ \t]+|set[ \t]+)?"
                         r"(?P<name>[A-Za-z_$][\w$]*)[ \t]*\(", s.strip())
            if m is None:
                m = re.match(r"^(?:export[ \t]+)?(?:const|let|var)[ \t]+"
                             r"(?P<name>[A-Za-z_$][\w$]*)[ \t]*=", s.strip())
            if m is not None:
                targeted.add(m.group("name"))
        missing = [n for n in sorted(set(exported))
                   if n not in targeted and (inst["name"], n) not in NOT_A_TARGET]
        excused = [n for n in sorted(set(exported)) if (inst["name"], n) in NOT_A_TARGET]
        declared -= {(inst["name"], n) for n in exported}
        print(f"INSTRUMENT_GATE_COVERAGE {inst['name']}: "
              f"{len(set(exported)) - len(missing) - len(excused)}/{len(set(exported))} "
              f"declared member(s) targeted · {len(excused)} declared NOT_A_TARGET")
        for n in missing:
            problems.append(
                f"{inst['name']}: `{n}` is a MEMBER and is neither a target nor declared in "
                f"NOT_A_TARGET. Nothing in this file can see that — EXISTENCE, UNIQUENESS, "
                f"the injector's refusal and BLAST_FLOOR are all about targets that were "
                f"WRITTEN. Add `{{SIG:{n}}}` with the empty its contract promises, or a "
                f"NOT_A_TARGET row saying why there cannot be one")
    # 🔴 AND THE OTHER HALF, WHICH IS THE ONE 211 §5 FOUND MISSING ON THE LATE AXIS: a
    # roster naming something that is not there any more. An exclusion outliving its
    # member is an exemption nobody re-argued.
    for inst_name, member in sorted(declared):
        problems.append(
            f"NOT_A_TARGET declares {inst_name}::{member}, which is not an exported member "
            f"of that instrument any more — a written reason outliving the thing it "
            f"excused is an exemption nobody has re-argued")
    return problems


# ══ THE LATE BLIND — 182, answering 181 §11.2 ══════════════════════════════════════
#
# 🔴 EVERY TARGET ABOVE BLINDS FOR THE WHOLE RUN, AND 181 §6 SHOWED THAT IS THE WEAKER
# HALF OF THE CLASS. `_workspace.mjs`'s caller floors `snapshotDir` at 70 files and then
# walks the same tree twice more, two minutes later. A GLOBAL blind empties the snapshot
# too, so the floor catches it and the entry read green for the whole class — the hazard
# is the enumerator going quiet AFTER the population floor has already been satisfied,
# and a global blind cannot construct that.
#
# The late blind is the SAME TABLE behind a call counter. Call 1 answers honestly and
# satisfies whatever floor is above it; every call after it is the blind:
#
#     function walk(...) { if (++n > 1) { return; }   ...the real body...
#
# No new constant: the injected text is the `empty` the global blind already uses. What
# it found, put to all 51 targets on two axes (182):
#
#     conduits blinded from call 2  ->  judged 185 -> 162, floor 150, `ok`, exit 0
#     helpers  blinded from call 2  ->  nonthrowing 18 -> 0, judged 185 -> 180, exit 0
#     classifyLeaf, 1604 of 1605 blinded  ->  BYTE-IDENTICAL output, exit 0
#     leaves, 1215 of 1216 blinded        ->  byte-identical again, exit 0
#
# 🔴 AND THE AXIS THAT FOUND ALL FOUR IS THE LIVE ONE, NOT THE SELF-TEST. For four of the
# eight instruments the shipped gate IS the caller, and it runs headless; those get both
# axes. The other four are reachable only through a probe that boots the editor under
# Xvfb, so their self-test is the only place a late blind can be constructed at all.
LATE_MARK = "LATE_BLIND_CALLS"
LATE_HOOK = (
    'if(!globalThis.__LBH){globalThis.__LBH=1;'
    'process.on("exit",()=>{try{process.stdout.write("\\n%s "+(globalThis.__LB||0)+"\\n")}catch(e){}});}'
    'globalThis.__LB=(globalThis.__LB||0)+1;' % LATE_MARK
)

# The LIVE caller for each instrument that has one that runs headless. The second element
# overrides which FILE to blind: `path-cohort.mjs` imports `dist/`, while the unit-test
# gate above imports `dist-test/src/` — two artefacts compiled from one .ts, and blinding
# the wrong one sweeps a walk that is not the one the live gate reads.
LATE_LIVE = {
    "tautology_gate.mjs": (["node", "scripts/tautology_gate.mjs"], None),
    "verdict_gate.mjs": (["node", "scripts/verdict_gate.mjs"], None),
    "boundary_gate.mjs": (["node", "scripts/boundary_gate.mjs"], None),
    "_path_ledger.mjs": (["node", "scripts/path-cohort.mjs", "--summary"], None),
    "path-cohort (compiled walk)": (["node", "scripts/path-cohort.mjs", "--summary"],
                                    HOST / "dist" / "path-cohort.js"),
    # 🆕 183 — 182 §11.2's REMAINING HALF. These three are imported only by probes that
    # boot the editor under Xvfb, so until now their late blind ran against the SELF-TEST
    # and the axis that found every 182 defect was unavailable to exactly the three files
    # 181 §6's defect lived in. `_caller_shape.harness.mjs` is a headless SUBSTITUTE
    # caller: it reproduces the one property the self-test structurally cannot have — a
    # population floored at t=0 and a verdict re-derived at t=1 — over a temp tree and two
    # PNGs it authored itself, and takes every verdict from a reading this gate never
    # blinds. One command for all three, because one caller drives all three.
    "_workspace.mjs": (["node", "test-integration/_caller_shape.harness.mjs"], None),
    "_png.mjs": (["node", "test-integration/_caller_shape.harness.mjs"], None),
    "_population.mjs": (["node", "test-integration/_caller_shape.harness.mjs"], None),
    # 🆕 232 — AND THIS ONE GETS THE STRONGER AXIS RATHER THAN A LATE_LIVE_NA ROW,
    # because the reason those rows have to give is "there is no second command that
    # exercises this file" and here there plainly is one: CI runs the gate for real
    # (`node scripts/positive_control_gate.mjs`, ci.yml) one step after it runs the
    # self-test. Declaring it NA would have been an exclusion bought with a sentence
    # anybody could check and find false — 211 §5's whole point about the reasons.
    "positive_control_gate.mjs": (["node", "scripts/positive_control_gate.mjs"], None),
    # 🆕 278 §4 — AND THIS ONE HAD NO EXEMPTION AVAILABLE TO IT, WHICH IS THE GATE DOING
    # ITS JOB. `LATE_LIVE_NA` has one sentence to say — *there is no second command that
    # exercises this file* — and ci.yml runs TWO (`--assert-map` in the build job,
    # `--assert-addon` in contract-check), so 232 §5.6 refuses it. `LATE_LIVE_COST` is
    # refused the other way: it is falsified when the declared price drops UNDER budget,
    # and these cost 0.69 s and 0.08 s per mutant against a 20 s budget. Neither excuse
    # was buyable, so the file got the axis. That is `LATE_LIVE_COST`'s design working in
    # the direction 277 built it for.
    #
    # 🔴 `--assert-addon` AND NOT `--assert-map`, AND THE CHOICE IS MEASURED. Blinding all
    # sixteen A:gate greens against BOTH commands: `--assert-addon` catches four
    # (`addon_version`, `addon_stamp_commit`, `_first_commit_introducing`, `_addon_live`)
    # and `--assert-map` catches one (`tarball_entries`). This roster takes one command per
    # instrument, so the four win and the one carries its own `NOT_A_TARGET` row naming the
    # command that DOES catch it — an exclusion with a measurement in it (277 §4).
    "release_names.py": (["python3", "../scripts/release_names.py", "--assert-addon"], None),
    # 🆕 278 §4 — and the second entry's live axis is the third of the three commands, so
    # between the two entries `--selftest`, `--assert-addon` and `--assert-map` are each
    # either a gate or a live axis. Same reasoning as the row above: `LATE_LIVE_NA` would
    # be false and `LATE_LIVE_COST` is falsified by its own price.
    "release_names.py (--assert-addon)": (
        ["python3", "../scripts/release_names.py", "--assert-map"], None),
    # 🆕 244 §4 — THE TWO P0 REPORTERS, AND THIS PAIR OF ROWS IS THE ROW ITSELF. 241's
    # `DISCOVER_EXEMPT` entries said the late axis had nothing to blind because a reporter
    # that prints cannot redden. `--floor` is a second command that CAN: it asks each
    # reporter whether its own measurement is still a measurement, and every target above
    # takes at least one of its floors under. Not `LATE_LIVE_NA` — 232 §5.6's rule is that
    # an NA row has to say there is no second command, and there is one, in this repo,
    # eleven lines further down ci.yml.
    "p0_complexity.mjs": (["node", "scripts/p0_complexity.mjs", "--floor"], None),
    "p0_testdup.mjs": (["node", "scripts/p0_testdup.mjs", "--floor"], None),
    # 🆕 233 — THE THREE ROWS `LATE_LIVE_NA` WAS BUYING WITH A SENTENCE THE TREE
    # CONTRADICTED. 232 §5.6 decided the rule for `positive_control_gate.mjs`: an NA row
    # has to say "there is no second command that exercises this file", so a row is false
    # the moment ci.yml runs one. Asked of the OTHER THREE rows — which is 232 §6.2's
    # discover question pointed at this roster rather than at INSTRUMENTS — all three were
    # false, and had been for as long as their steps have existed:
    #
    #     seal_order_gate.mjs      ci.yml:346  node scripts/seal_order_gate.mjs
    #     token-cost.mjs           ci.yml:391  node scripts/token-cost.mjs --summary
    #     wire_invisible_gate.mjs  ci.yml:412  node scripts/wire_invisible_gate.mjs
    #
    # 🔴 AND TWO OF THE THREE REASONS NAMED THE COMMAND WHILE DENYING IT. `token-cost.mjs`
    # said "the live read spawns a built server … on purpose" and `wire_invisible_gate.mjs`
    # said "the second command IS the gate — `node scripts/wire_invisible_gate.mjs`". Both
    # sentences are about a command CI runs on every push. The exclusion was not wrong
    # about the FACT; it was an exclusion written where an axis was available.
    "seal_order_gate.mjs": (["node", "scripts/seal_order_gate.mjs"], None),
    "token-cost.mjs": (["node", "scripts/token-cost.mjs", "--summary"], None),
    "wire_invisible_gate.mjs": (["node", "scripts/wire_invisible_gate.mjs"], None),
    # 🆕 233 — THE FOURTH ROW, AND IT LEFT `LATE_LIVE_NA` BY THE REASON EXPIRING RATHER
    # THAN BY BEING WRONG. Its excuse was the baseline worktree, which is a real cost and
    # is why the classifier cannot be a per-push step. `--discover` is the half that does
    # not pay it: one server start against the `dist/` CI already builds, asking the live
    # wire what keys it carries. The axis was not unavailable — it was unbuilt.
    "wire_diff.mjs": (["node", "scripts/wire_diff.mjs", "--discover"], None),
    # 🆕 245 §1 — THE TWO PYTHON INSTRUMENTS WITH A SECOND COMMAND CI ALREADY RUNS.
    # `p0_comments.py --floor` is 244's refusing command; `queue_gate.py` with no flag is
    # the live read of QUEUE.md. Both are steps in ci.yml today, which is 232 §5.6's test
    # for whether an NA row could ever be honest here — it could not.
    "p0_comments.py": (["python3", "../scripts/p0_comments.py", "--floor"], None),
    "queue_gate.py": (["python3", "../scripts/queue_gate.py"], None),
    # 🆕 247 §2 — `terminology_gate.py` with no flag is the live sweep, and ci.yml runs
    # it, so 232 §5.6's rule refuses a `LATE_LIVE_NA` row for this file outright.
    "terminology_gate.py": (["python3", "../scripts/terminology_gate.py"], None),
}

# ── 🔴 198 §3 — THE LATE AXIS'S VERDICT MARKER, AND WHY IT IS NOT `VERDICT_MARKER` ──
#
# 197 §5 gave the PRIMARY axis a declared marker per instrument, proved on its control run.
# The obvious way to pay 197 §8.3 was to hand the same dict to `run_counting`. 🔴 THE
# CAPTURE REFUTED THAT BEFORE A LINE WAS WRITTEN: all EIGHT `B:live` controls run green
# WITHOUT printing their instrument's marker, because the live caller is a DIFFERENT
# COMMAND that prints a DIFFERENT REPORT. Reusing `VERDICT_MARKER` there would have
# classified every red on the live axis as a crash — the axis that finds things, switched
# to noise, by the fix meant to sharpen it.
#
# 🔴 SO THIS ROSTER IS KEYED BY THE COMMAND, NOT BY THE INSTRUMENT. Three instruments share
# `_caller_shape.harness.mjs`; keyed by instrument the same string would be stored three
# times and two copies could rot without anything reading them (180 §7.1's class).
#
# 🔴 AND THE CHOICE OF STRING WAS MADE AGAINST GROUND TRUTH, NOT AGAINST LOOKS. Two drafts
# of the reader were refuted offline against one capture, at zero cost (197 §38):
#
#   draft 1  rank candidates by "how few reds would this call a crash", smallest first.
#            🔴 WRONG DIRECTION: a marker printed EARLY survives a run that dies later, so
#            the minimum is systematically the marker LEAST able to tell a catch from a
#            crash. On `_caller_shape.harness.mjs` it picks `SHAPE_SEAL_A`, which calls all
#            THREE genuine crashes a catch.
#   draft 2  take the gate's final verdict line. 🔴 ALSO WRONG, the other way: `CALLER_SHAPE`
#            is printed only on a GREEN run, so it calls SEVEN genuine catches a crash —
#            197 §35 exactly, a discriminator exercised on one class only.
#   draft 3  classify each captured run independently — node prints an uncaught exception as
#            a stack-frame trace, which no gate report uses — and then keep the candidates
#            that AGREE with that classification on every row. `SHAPE_POPULATION` is the
#            only one of the six that does.
LATE_VERDICT_MARKER: dict[str, str] = {
    "node scripts/tautology_gate.mjs": "TAUT_GATE",
    "node scripts/verdict_gate.mjs": "VERDICT_GATE",
    "node scripts/boundary_gate.mjs": "BOUNDARY_GATE",
    "node scripts/path-cohort.mjs --summary": "PATH_COHORT",
    "node test-integration/_caller_shape.harness.mjs": "SHAPE_POPULATION",
    # 🆕 232 — `POSITIVE_CONTROL <n> claim(s) over <m> file(s)` is `judge()`'s FIRST say()
    # line and is emitted before any verdict branch, so it survives the red path — which
    # is the property draft 2 above failed and the reason this is not `POSITIVE_CONTROL_GATE`
    # (printed only when nothing failed).
    "node scripts/positive_control_gate.mjs": "POSITIVE_CONTROL ",
    # 🆕 233 — ALL THREE CHOSEN BY DRAFT 3's RULE ABOVE, NOT BY LOOKS. Each is the FIRST
    # line its command prints and it is emitted before any verdict branch, so it survives
    # the red path (draft 2's failure) and it is absent from a stack-frame trace (draft 1's
    # failure). The census line, never the `ok —` line.
    "node scripts/seal_order_gate.mjs": "SEAL_ORDER_GATE files=",
    # 🆕 278 §4 — draft 3's rule again, and this command has TWO report paths rather than
    # the usual one: a green run prints `RELEASE_NAMES --assert-addon · addon …` and a
    # refusal prints `🔴 RELEASE_NAMES REFUSED [<code>]: …` on stderr, which `run_counting`
    # concatenates. 🔴 AND SINCE 278 THERE IS A THIRD: a detail bag short a key its printer
    # reads is refused BEFORE the header line, so a marker taken from the header alone
    # would classify exactly the catch this session ADDED as a crash. `RELEASE_NAMES ` is
    # the substring all three share.
    "python3 ../scripts/release_names.py --assert-addon": "RELEASE_NAMES ",
    "python3 ../scripts/release_names.py --assert-map": "RELEASE_NAMES ",
    "node scripts/token-cost.mjs --summary": "TOKEN_COST ",
    "node scripts/wire_invisible_gate.mjs": "WIRE_INVISIBLE_SURFACE ",
    "node scripts/wire_diff.mjs --discover": "WIRE_DIFF_KEY ",
    # 🆕 244 §4 — THE CENSUS LINE, WHICH IS WHY `--floor` PRINTS ONE AT ALL. 233's rule
    # above chose these three by the same test: the FIRST line the command prints, emitted
    # before any verdict branch, so a refusal still carries it and a red is a CATCH rather
    # than an unclassifiable crash. The `ok` line these two also print would have failed
    # that test exactly the way draft 2 of `positive_control_gate.mjs`'s did.
    "node scripts/p0_complexity.mjs --floor": "P0_COMPLEXITY_CENSUS ",
    "node scripts/p0_testdup.mjs --floor": "P0_TESTDUP_CENSUS ",
    # 🆕 245 §1 — the census line again, chosen by the same draft-3 rule and RUN rather
    # than read. `P0_COMMENTS_CENSUS` is printed after both extractors have finished and
    # before any verdict branch, so a blinded reader that dies never reaches it and a
    # refusal still carries it. `QUEUE_GATE <n> row(s) …` is the same shape.
    "python3 ../scripts/p0_comments.py --floor": "P0_COMMENTS_CENSUS ",
    "python3 ../scripts/queue_gate.py": "QUEUE_GATE ",
    # 🆕 247 §2 — the live sweep's census line, printed before any verdict branch.
    "python3 ../scripts/terminology_gate.py": "TERMINOLOGY_SUFFIX ",
}

# THE LIVE AXIS'S CRASHES, DECLARED WITH THEIR REASON — `CRASH_DECLARED`'s shape and its
# teeth (174 §5), for the axis that has different ones. The `A:gate` half needs NO roster of
# its own: measured over all 55 red rows, the late axis crashes in EXACTLY the nine places
# the primary axis does, because the crash is a property of the SELF-TEST's setup read and
# not of which injector wrote the mutant. §8.2's nine call sites therefore pay both axes at
# once, and this file reuses `CRASH_DECLARED` there rather than copying it.
#
# 🟢 199: THE REUSE IS WHY BOTH HALVES WENT TO ZERO TOGETHER. Nine self-test edits emptied
# `CRASH_DECLARED`, and `LATE_CRASH_CEILING_A` fell with it without a second measurement —
# which is the return on 198's decision not to copy the roster.
# 🟢 199 §9.2 — EMPTY, AND THE CEILINGS ARE AT ZERO. All three `B:live` rows died at
# `_caller_shape.harness.mjs`'s `sok()` because `runSeal()` and `runTally()` were the two
# of five sections running OUTSIDE the throw-catcher `pop.family(…)` gives the other
# three. One `section()` wrapper, and all three now record a `_THREW` failure, print
# `SHAPE_POPULATION`, and reach the verdict.
LATE_CRASH_DECLARED_B: dict[tuple[str, str], str] = {}
LATE_CRASH_CEILING_A = 0   # 🟢 BOTH CEILINGS FELL TO ZERO IN ONE COMMIT (198 §9.2's end
LATE_CRASH_CEILING_B = 0   # state, reached). Kept as two numbers rather than one sum —
#                            194 §33, and the reason is unchanged: the A half was paid by
#                            editing the self-tests and the B half by editing the caller-
#                            shape harness. A single zero would let either regress while
#                            the other absorbed it. 🔴 THEY ARE STILL CEILINGS: any new
#                            crash on either axis is now an UNDECLARED one and fails.

# 🔴 DECLARED GREEN, WITH A REASON EACH RATHER THAN A NAME EACH (174 §5) — AND THE GATE
# FAILS IF ONE EVER STARTS REDDENING (181's `mutate181.py` idiom). A late blind that
# leaves a gate green is not automatically a defect: two states produce it, and only one
# of them is.
LATE_DECLARED_GREEN = {
    # ══ 🆕 278 §4 — ONE ROW, AND IT IS 277's SENTENCE ABOUT THE AXIS AGAIN ══════════════
    #
    # 🔴 `_pack` IS A FIXTURE BUILDER CALLED AT IMPORT TIME, SIX TIMES, BEFORE ANY CLAIM
    # RUNS. The late injector blinds from the SECOND call, so on the `--assert-addon` axis
    # the five calls after the first return `[]` into module-level tables that command
    # never reads — nothing downstream of them is exercised, so nothing can redden.
    # Measured, not assumed: it is a target on the A:gate primary axis above, where the
    # blind is global and it reddens with five reported failures.
    ("release_names.py", "{SIG:_pack}", "B:live"):
        "a fixture builder run at IMPORT time, six times, into module-level tables that "
        "`--assert-addon` never reads. The late blind takes effect from call two, so every "
        "affected table is one this command does not consult — 277 §1.5's sentence about "
        "the axis, with a different cause. Caught on A:gate, where the blind is global.",
    # ══ 🆕 277 §2 — FIVE, AND ALL FIVE SAY THE SAME THING ABOUT THE LATE AXIS ITSELF ══
    #
    # 🔴 A NEGATIVE CLAIM CANNOT CATCH A LATE BLIND, AND THAT IS A PROPERTY OF THE AXIS
    # RATHER THAN A GAP IN THIS FILE. The late blind lets a member answer CORRECTLY once
    # and return its empty for every call after; so whichever of a reader's claims runs
    # LAST is the one under the blind, and a claim of the form *this reader finds nothing
    # here* is satisfied by a reader that finds nothing anywhere. Each of the five below
    # is called exactly twice by `--selftest`, and in each the second call is either the
    # negative direction or a consumer that floors nothing.
    #
    # 🔴 MEASURED, NOT ASSUMED — every one of them is a target on the A:gate PRIMARY axis
    # above, where the blind is global and all fifty-seven redden. What is declared here is
    # narrower than an exemption: the member IS covered, and the late axis is the one axis
    # that cannot see it. `p0_comments.py::_looks_like_code` below is the same sentence
    # with a different cause, and 205 §25's ratio argument is the same one again.
    ("handoff_gate.py", "{SIG:leg_disagreements}", "A:gate"):
        "both directions are claimed and the NEGATIVE one runs second — `MEASURED_LEG_"
        "AGREE` asserts this reader finds nothing across four agreeing legs, which is "
        "exactly what a blinded reader answers. Caught globally on the primary axis.",
    ("handoff_gate.py", "{SIG:ci_scripts}", "A:gate"):
        "call two is inside `check()`, where the value is consumed by `replay_ci_problems` "
        "and the floor that guards it (`CI_SCRIPT_FLOOR`) was already satisfied by call "
        "one. Caught globally on the primary axis.",
    ("handoff_gate.py", "{SIG:ci_commands}", "A:gate"):
        "same shape as `ci_scripts` — `CI_COMMANDS_LIVE` floors the live walk on call one "
        "and call two is the consumer inside `check()`. Caught globally on the primary "
        "axis.",
    ("handoff_gate.py", "{SIG:tracked_scripts}", "A:gate"):
        "`SCRIPT_POPULATION_FLOOR` reads call one; call two is the same walk inside "
        "`unreached_problems`, whose own refusal is about REACHABILITY and is satisfied "
        "vacuously by an empty population. Caught globally on the primary axis.",
    ("handoff_gate.py", "{SIG:import_edges}", "A:gate"):
        "call two is `unreached_problems`' own edge read, and an empty edge set makes "
        "every script unreached — which the floor above it catches only because call one "
        "supplied the population. Caught globally on the primary axis.",
    # 🆕 245 §1 — MEASURED, AND THE REASON IS THE FLOOR TABLE'S OWN COMMENT. Blinded from
    # its second call, `_looks_like_code` decides exactly one bucket — `commented-out-code`,
    # SEVEN lines tree-wide — and `--floor` deliberately does not floor that bucket:
    # `FLOOR["buckets"]` is 3 rather than 5 because `TODO-FIXME` stands at one and a session
    # that deleted the tree's last commented-out line would otherwise redden the gate that
    # exists to encourage exactly that work. So the live command cannot see this collapse
    # BY A DECISION WRITTEN DOWN IN THE FILE ITSELF, not by an oversight. 🟢 The A:gate axis
    # blinds it globally and reddens, and the same axis catches it late.
    ("p0_comments.py", "{SIG:_looks_like_code}", "B:live"):
        "it decides only the `commented-out-code` bucket, which `--floor` does not floor on "
        "purpose (FLOOR['buckets'] is 3, not 5, so emptying the smallest buckets is not a "
        "refusal). Both halves of the A:gate axis catch it.",
    # 🆕 212 §4 — THE ONLY LATE GREEN THE NEW TARGETS PRODUCED, AND IT IS A STATEMENT
    # ABOUT THE FLOORS RATHER THAN ABOUT THE MEMBER. `isLiteralish` is called 1227 times
    # on the live tree. Blinding it from call 2 moves `TAUT_CLASSIFIED shaped=` and
    # `precondition=` — both floored from BELOW with headroom (119/80 and 61/40 measured
    # this session), so a collapse that starts after the first call lands INSIDE the
    # headroom and no floor bites. The global blind DOES redden it, which is why the
    # A:gate row above is a catch and this one is not.
    # 🔴 THIS IS 205 §25's RATIO ARGUMENT IN MINIATURE: the coverage is real, it is just
    # not re-read after the population is admitted. Closing it means a floor on the
    # classification that is re-derived rather than accumulated — recorded, not built.
    # 🆕 275 — AND A SECOND CALL SITE IS WHAT PUT THIS ROW HERE, WHICH IS WORTH THE
    # PARAGRAPH. `combineFailed` had exactly ONE caller until this session, so a blind that
    # answers honestly once and returns its empty afterwards never got to lie: there was no
    # second call. `duration-assertions-unguarded` added one, and the second argument's
    # healthy value is `false` — so from call 2 the duration refusal stops reaching the exit
    # code and a green tree stays green, by construction rather than by oversight.
    # 🔴 THE GLOBAL BLIND ON THE SAME MEMBER STILL REDDENS (the A:gate row below), so the
    # member is covered and it is the LATE axis that is not; and the second wire has a case
    # with a known answer in `tautology_gate.selftest.mjs`, which is the axis where one can
    # exist. The declaration reddens the day a third caller appears, or the day the duration
    # rule's live population stops being clean — both of which are re-measured every run.
    ("tautology_gate.mjs", "{SIG:combineFailed}", "B:live"):
        "it has two callers and the second one's verdict is false on every healthy tree, so "
        "a blind from call 2 drops a refusal that was not going to be made. The GLOBAL blind "
        "reddens the gate, and the self-test drives `combineFailed(false, judgeDuration(<an "
        "unguarded lower bound>))` directly, which is the only place the second wire can be "
        "proved.",
    ("tautology_gate.mjs", "{SIG:isLiteralish}", "B:live"):
        "the two counts it moves (shaped, precondition) are floored from below with "
        "measured headroom, so a collapse from call 2 lands inside it. The GLOBAL blind "
        "on the same member reddens the gate, so the member is covered and the LATE axis "
        "is what is not. Re-measured every run: a floor raised to its live value would "
        "make this declaration redden, which is the point of not writing it down once.",
    # 🆕 233 — THE DISCOVER COLLECTOR, AND IT IS THE SAME CLASS AS `collapsed` BELOW: the
    # live population is HEALTHY, so a blind that reports nothing is reporting the truth.
    # There is no undeclared plane for it to miss — measured every run, `planeWalk()` reads
    # eight `.gd` and the shape reader names exactly the two `PLANES` names — so a green
    # here says nothing about the refusal. Its coverage is the self-test's twelve fixtures,
    # where a tree that cannot exist has a known answer. 🔴 THE MOMENT A THIRD DISPATCHER
    # SHIPS THIS DECLARATION REDDENS, which is the point of re-measuring it every run
    # rather than writing the exemption down once.
    ("boundary_gate.mjs", "{SIG:discoveryProblems}", "B:live"):
        "the live walk is healthy — eight .gd, two dispatcher-shaped, both rostered, the "
        "exemption table empty — so there is no problem for it to report and a blind that "
        "reports none is correct. Its coverage is the twelve fixtures in "
        "`boundary_gate.selftest.mjs`, which is the axis where a case with a known answer "
        "exists. A third dispatcher, or a stale exempt row, makes this declaration redden.",
    # 🆕 271 §2 — THE SAME CLASS, ON A REFUSAL WHOSE HEALTHY ANSWER IS SILENCE. `age_domain`
    # returns the ways a row's session numbers can be impossible, and `QUEUE.md` has none —
    # so on the live axis an emptied reader and a working one print the identical nothing,
    # and no floor above it can tell them apart because there is no population to floor.
    # 🔴 IT IS NOT A HARNESS GAP THIS FILE CAN CLOSE BY WRITING A FLOOR: the sibling
    # `reach_of` was RESTRUCTURED in the same session so its silence became countable
    # (it returns one reading per path, and the caller compares the count), and that
    # option does not exist for a reader whose entire output is a list of violations. The
    # A:gate axis blinds it globally against four fixtures with known answers and reddens.
    ("queue_gate.py", "{SIG:age_domain}", "B:live"):
        "the live table is HEALTHY — no row is opened or closed after the head and none is "
        "closed before it was opened — so there is no violation for it to report and a "
        "blind that reports none is reporting the truth. Unlike its sibling `reach_of`, "
        "whose silence was made countable by returning one reading per path, a reader "
        "whose whole output is a list of refusals has no population to floor. Its coverage "
        "is the four fixtures on the A:gate axis, where an impossible row has a known "
        "answer. The moment a real domain violation lands in `QUEUE.md` this declaration "
        "reddens, which is why it is re-measured every run rather than written once.",
    # 🆕 233 — THE FOUR THE NEW LIVE AXES CANNOT REACH, EVERY ONE MEASURED RATHER THAN
    # REASONED ABOUT (198 §36's rule for this table). Three instruments gained a [B:live]
    # axis this session because ci.yml was already running the command; a fourth gained one
    # that had to be built. The axis being available is not the same as the axis reaching
    # every member, and the honest shape is to say WHICH ones and WHY, per row, rather than
    # to leave the instrument on the weaker axis entirely (211 §5).
    ("seal_order_gate.mjs", "{SIG:paragraphsOf}", "B:live"):
        "MEASURED: five calls on the live tree, and the gate's own floors are read ONCE, "
        "at the top of the run, before the fourth of them. Blinding from call 2 leaves "
        "`SEAL_ORDER_GATE files=/seals=` already printed and every downstream population "
        "already floored. The GLOBAL blind on the same member reddens both axes, so the "
        "member is covered and it is the LATE axis that is not — the same statement about "
        "floors rather than about the member that `isLiteralish` carries below.",
    ("token-cost.mjs", "{SIG:bytes}", "B:live"):
        "MEASURED at 7,433 calls, and the budget verdict is a CEILING: blinding from call "
        "2 makes the surface look SMALLER, which is the direction a budget gate is built "
        "not to refuse. A late blind that under-reports cannot trip a ceiling, and saying "
        "so is more honest than a floor here would be — the number this file prints is "
        "argued from, and `verdict` is the member that decides, which this axis DOES redden.",
    ("token-cost.mjs", "{SIG:family}", "B:live"):
        "the same direction as `bytes` above and for the same reason: the per-family "
        "decomposition shrinking cannot push a total over a ceiling. Its coverage is the "
        "[A:gate] axis, where `token-cost.selftest.mjs` asserts the decomposition sums to "
        "the whole and reddens on the first missing family.",
    ("token-cost.mjs", "{SIG:measure}", "B:live"):
        "MEASURED at exactly TWO calls — one per privilege view — so a blind 'from the "
        "second call' reaches only the privileged view, whose total is compared against "
        "nothing on this command. `--summary` prints both and refuses on the default view "
        "alone. The [A:gate] axis blinds it globally and reddens.",
    ("wire_diff.mjs", "{SIG:effectiveTaskSupport}", "B:live"):
        "the live axis compares this surface WITH ITSELF, and a symmetric comparison "
        "cannot see a member that answers identically on both sides — every tool reads "
        "`forbidden`, and `forbidden === forbidden`. That is a property of the baseline "
        "this command can afford (there is only one surface), not of the member: the "
        "[A:gate] axis reddens it, and so would the release-time classifier against a real "
        "ref. It is the one of five that the self-comparison structurally cannot reach.",
    ("boundary_gate.mjs", "{SIG:collapsed}", "B:live"):
        "the blind returns `false` — which is the CORRECT answer for all seven live "
        "populations of a healthy tree. There is no collapse for it to miss, so a green "
        "run says nothing about the collapse test. Its coverage is the self-test's "
        "`collapsed(0, 0) === true`, where a case with a known answer exists.",
    ("path-cohort (compiled walk)", "{SIG:segments}", "B:live"):
        "MEASURED, not assumed: of 258 live cohort rows, 0 reach the cohort through the "
        "segment branch — `hint_only=0 both=252 segments_only=0`, because every path-like "
        "parameter this surface publishes is snake_case and NAME_HINT matches it first. "
        "The branch is there for camelCase (`toPath`), which the live surface has none of. "
        "If one ever appears this declaration reddens, which is the point of re-measuring "
        "it every run rather than writing the exemption down once.",
    # 🆕 183 — THE ONE GREEN OF TWELVE ON THE NEW LIVE AXIS, AND IT IS THE SAME CLASS AS
    # `collapsed(n, floor)` ABOVE. 182 §11.27 asked the question this answers: is the
    # blind constant a HEALTHY answer or a FAILING one, and which axis can therefore see
    # it? Eleven of the twelve blinds the caller-shape harness constructs produce a wrong
    # observable and are caught. This one cannot be.
    ("_population.mjs", "{SIG:_closeOpen}", "B:live"):
        "`_closeOpen` exists to file a section that closed having asserted NOTHING, and a "
        "healthy caller has no such section — so the function's entire output on a healthy "
        "run is the empty set, which is exactly what the blind returns. Neither caller "
        "depends on it for anything else: `family()` sets `this.current = null` itself "
        "(170's structural fix), and `report()` reaches it with nothing open. The constant "
        "IS the healthy answer, so NO live axis can ever judge this target however the "
        "caller is shaped. Its coverage is `_population.selftest.mjs`, where a vacuous "
        "section is constructible on purpose — the same split `collapsed(n, floor)` has.",
    # 🆕 275 — 🟢 AND THE `A:gate` ROW THAT STOOD HERE IS DELETED BY THE GATE'S OWN
    # REFUSAL, WHICH IS THE HALF A DECLARATION TABLE IS FOR. Its reason was that the
    # `combineFailed` cases are a 2x2 truth table whose only discriminating case is the
    # FIRST, so a late blind deletes the cases after it and measures case ORDER — and that
    # a live axis calling the member once cannot judge it either. `duration-assertions-
    # unguarded` changed both halves in one commit: the self-test now drives
    # `combineFailed(false, judgeDuration(<an unguarded lower bound>))` as a LATER case, so
    # the A:gate blind reddens and the declaration reported itself expired on the first run
    # after the change (174 §5). The B:live row above replaces it, for the opposite reason:
    # the live axis calls it TWICE now.
}


def late(text: str, sig: str, empty: str, lang: str = "js") -> str | None:
    """`empty` becomes the body from the SECOND call onwards. Same anchor as blind().

    🔴 AND THE SAME BRACE, VIA THE SAME FUNCTION (197 §5). This injector carried an
    identical copy of `text.find("{", idx)`, so it had the identical destructured-parameter
    bug — and on THIS axis the failure is quieter still, because a mutant that does not
    parse reports `calls=0` and is filed as "not constructible", which raises no problem at
    all. Two copies of one wrong line is 180 §7.1's class; there is now one.
    """
    if lang == "py":
        return py_late(text, sig, empty)
    brace = body_brace(text, sig)
    if brace is None:
        return concise_blind(text, sig, empty, late_hook=True)
    return (text[: brace + 1]
            + f"\n    {LATE_HOOK} if(globalThis.__LB>1){{ {empty} }}  // INSTRUMENT_GATE LATE"
            + text[brace + 1 :])


def late_marker(cmd, inst_name: str, axis: str) -> str:
    """The string that says THIS COMMAND reached its own verdict.

    `A:gate` runs `inst["gate"]` — one command per instrument — so `VERDICT_MARKER` is the
    right key there and was already proved on that command's control by 197 §5. `B:live`
    runs something else entirely and needs its own roster (see `LATE_VERDICT_MARKER`).

    🔴 THE `"\\0"` FALLBACK FAILS LOUD, NOT QUIET. A command with no entry gets a marker
    that can never appear, so every red over it is filed a CRASH and the gate reddens —
    and `late_marker_roster_problems` has already said why. The alternative fallback,
    "assume it reached its verdict", is the `returncode == 0` this whole change deletes.
    """
    if axis == "A:gate":
        return VERDICT_MARKER.get(inst_name, "\0")
    return LATE_VERDICT_MARKER.get(" ".join(cmd), "\0")


def run_counting(cmd, cwd, marker: str) -> tuple[bool, bool, int, bool, int]:
    """(green, REACHED ITS VERDICT, calls, THE HOOK LINE APPEARED, failures reported).

    🔴 197 §8.3. This was `(p.returncode == 0, calls)` and carried BOTH defects 197 §5
    fixed on the primary axis, plus a third that only exists here:

      1. `red` had two causes and one observable — a late blind that CRASHES its gate read
         exactly like one the gate CAUGHT. Measured: twelve rows across the two axes.
      2. the failure COUNT was captured and thrown away, so the late axis had no blast
         radius at all — 196 §3's defect, one file over.
      3. 🔴 AND `max(hits) if hits else 0` MAPPED TWO STATES ONTO ONE NUMBER. The hook
         writes its line from a `process.on("exit")` handler installed on the target's
         FIRST call, so `hits == [1]` means "really called once" and `hits == []` means
         THE HOOK NEVER RAN — the mutant did not load. Both landed in `calls <= 1`, both
         were filed "a late blind is not constructible there", and NEITHER raised a
         problem. That is 197 §3's SyntaxError reading as `ok`, on the other axis, in
         softer language: `{SIG:judge}` was ALSO unloadable here for those 25 commits, and
         this axis reported it as a target that simply is not called twice.
    """
    p = subprocess.run(cmd, capture_output=True, text=True, cwd=str(cwd))
    out = p.stdout + p.stderr
    hits = [int(m) for m in re.findall(rf"{LATE_MARK} (\d+)", out)]
    return (p.returncode == 0, marker in out, max(hits) if hits else 0,
            bool(hits), failure_lines(out))


# 🔴 THE MUTANTS THAT NEVER LOADED. Empty on a healthy tree — measured, all 118 mutant runs
# across both axes produced a hook line — so this is a REGRESSION BACKSTOP and not a live
# finding, and saying which it is matters: 197 §3's hole was exactly this shape and sat open
# for twenty-five commits without a single row to show for itself.
LATE_NOT_LOADED: list[tuple[str, str, str]] = []
LATE_NOT_LOADED_CEILING = 0

# 🆕 257 — THE ONE CAUSE OF A SILENT HOOK THAT IS NOT A DEFECT, AND IT IS DECLARED PER ROW.
#
# The message above names two causes and refuses both: a mutant that never LOADED, and a
# target that is never CALLED on this axis. They are not the same failure. The first is
# always a defect; the second is a fact about which command the axis runs — and it became
# reachable at 257, when `token-cost.mjs` grew a second reader behind a second flag.
# `--summary`, the live command, measures the CATALOGUE; `--results <file>` measures tool
# results and needs a meter log that the live command has no way to produce. Three members
# are therefore uncallable on [B:live] by construction rather than by accident.
#
# 🔴 THE PARSE CHECK IS WHAT MAKES THIS SOUND, AND IT ALREADY RUNS. A mutant that does not
# compile is caught by `parses()` BEFORE it is executed and reported as its own problem, so
# by the time a row can reach this table the only remaining cause of a silent hook is "not
# called". A row here says which member, on which axis, and why — never "not done yet".
LATE_NOT_CALLED: dict[tuple[str, str, str], str] = {
    # 🆕 276 — THE TOOLCHAIN HALF'S TWO, AND THE REASON IS THE COMMAND AND NOT THE
    # MEMBER. The live axis is `wire_diff.mjs --discover`, which asks about the wire that
    # is HERE and needs no baseline at all — that is the whole reason it can be a CI step
    # where the classifier cannot. Neither of these is on that path: they read a lockfile
    # at a REF, which `--discover` never resolves. The [A:gate] axis blinds both globally
    # and reddens, and so does the release-time classifier, where they are the only two
    # members that decide whether the second baseline gets built at all.
    ("wire_diff.mjs", "{SIG:depResolution}", "B:live"):
        "`--discover` returns before `main()` ever resolves a baseline ref, so no "
        "lockfile is read on this command. The member is reachable only from the "
        "release-time path, where the [A:gate] axis and `wire_diff.selftest.mjs`'s seven "
        "resolution rows both redden on a blind.",
    ("wire_diff.mjs", "{SIG:resolutionDrift}", "B:live"):
        "the same command and the same reason, one hop further out: with no lockfile "
        "read there is nothing to compare, so the drift walk is never entered. Its "
        "coverage is the self-test, where a blind returning the empty list makes the "
        "root-version row and the six drift rows disagree at once.",
    ("token-cost.mjs", "{SIG:parseResults}", "B:live"):
        "the live command is `--summary`, which reads a live `tools/list` and measures the "
        "CATALOGUE. This member parses the RESULT meter's log, which is reached only "
        "through `--results <file>` — a flag the live command does not pass and a file it "
        "does not produce. Its coverage is the [A:gate] axis, where blinding it to `[]` "
        "reddens `token-cost.selftest.mjs` on the row that asserts well-formed lines "
        "survive and malformed ones do not.",
    ("token-cost.mjs", "{SIG:measureResults}", "B:live"):
        "same axis, same reason as `parseResults` above: the result summary is computed "
        "only on the `--results` path. Blinding it on [A:gate] to a plausible in-budget "
        "summary reddens the rows that drive the ceiling from both sides, which is the "
        "half a healthy-looking blind is built to defeat.",
    ("token-cost.mjs", "{SIG:verdictResults}", "B:live"):
        "same axis, same reason. This is the member that DECIDES on the result axis, and "
        "the live command never reaches the decision because it never reaches the log. On "
        "[A:gate] it is blinded to `ok` with no problems — an axis that has stopped "
        "deciding — and every refusal row in the self-test reddens.",
}


def not_loaded_problems(rows, ceiling: int) -> list[str]:
    """🔴 FIXTURE-FED — this returns empty on a healthy tree and would delete invisibly."""
    if len(rows) <= ceiling:
        return []
    problems = [
        f"{inst} [{axis}]: `{sig}`'s mutant produced NO `{LATE_MARK}` line AT ALL. The hook "
        f"is injected into the member's own body and writes from a process exit handler, so "
        f"either the mutant NEVER LOADED — a SyntaxError, or a throw at import — or this "
        f"target is never called on this axis. Both were filed 'not constructible' and "
        f"reported in green until now, which is how a target that had not compiled since "
        f"#211 read as ok for 25 commits (197 §3)"
        for inst, sig, axis in rows
    ]
    problems.append(
        f"INSTRUMENT_GATE_LATE_NOT_LOADED {len(rows)} > {ceiling} — a late mutant that does "
        f"not load measures nothing and must not be counted as a target that is merely "
        f"called once")
    return problems


def late_marker_roster_problems(live: dict, markers: dict) -> list[str]:
    """Both halves (174 §5 / 182), for a roster keyed by COMMAND rather than instrument.

    🔴 FIXTURE-FED for the same reason `marker_roster_problems` is: both lists are empty on
    a healthy tree, so an inline version is deleted by anything and noticed by nothing.
    """
    cmds = {" ".join(cmd) for cmd, _alt in live.values()}
    problems = []
    for c in sorted(cmds - set(markers)):
        problems.append(
            f"the live late axis runs `{c}` with no LATE_VERDICT_MARKER — every red over it "
            f"would be filed a crash, which is the 197 §5 defect with its sign flipped")
    for c in sorted(set(markers) - cmds):
        problems.append(
            f"LATE_VERDICT_MARKER names `{c}`, which no instrument's live axis runs — a "
            f"marker for a command that is gone is an exemption outliving its reason")
    return problems


# ── 🆕 233 — THE EXCLUSION THAT IS RE-DERIVED INSTEAD OF RE-READ ──────────────────────
#
# 🔴 A `LATE_LIVE_NA` ROW IS A CLAIM ABOUT THE TREE, AND UNTIL NOW IT WAS THE ONLY CLAIM
# IN THIS FILE THAT NOTHING RE-DERIVED. The sentence each row has to say is 232 §5.6's:
# *there is no second command that exercises this file*. Three of the four rows said it
# while ci.yml ran exactly such a command, and two of them NAMED the command inside the
# sentence denying it. Nothing could see that, because the reason was prose and prose is
# read by people who already believe it.
#
# 🔴 THE DERIVATION IS THE INSTRUMENT'S OWN SOURCE FILE, NOT A NAME SHAPE. An instrument's
# gate is `x.selftest.mjs`; a SECOND command that exercises the same file is a `run:` step
# invoking `x.mjs` itself. Both halves come from data the tree already carries — `inst`
# supplies the source and the gate, ci.yml supplies the steps — so this cannot drift away
# from either the way a written-down exemption does (198's rule, 199 §9.3's reason).
#
# 🔴 AND THE WALK IS FLOORED, because a regex that stops matching returns an empty set and
# every row then passes for the wrong reason — which is this gate's own U1, and the exact
# shape `DISCOVER_EXEMPT` is fixture-proved against one screen down.
CI_YML = ROOT / ".github" / "workflows" / "ci.yml"
# ── 🆕 277 §2 — AND THIS READER SPELLED ONE LANGUAGE, WHICH IS 247 §1 IN THE FILE THAT
# FIXED 247 §1. `members_of` was taught Python the moment the instrument table gained a
# `.py` row; the roster that decides whether an instrument may be EXCUSED from the live
# axis was not, and has matched `run: node …` alone ever since. Four Python instruments
# later it has never bitten — all four carry a `LATE_LIVE` row, so no NA row has ever
# been checked against a Python step — and the first one that needed it would have bought
# its exemption with a sentence this reader could not read the counter-evidence for.
# 🔴 THE SAME SHAPE, THIRD TIME IN THREE SESSIONS: the population was the reader's
# vocabulary, reported as a fact about ci.yml. Measured: `node` alone finds 28 steps in
# this tree's ci.yml, `node|python3` finds 55.
CI_RUN_RE = re.compile(r"^\s*-?\s*run:\s*((?:node|python3)\s+[^\n]+)$", re.M)
CI_COMMAND_FLOOR = 8


def ci_node_commands(text: str) -> set[str]:
    """Every single-line `run: node …` or `run: python3 …` step in ci.yml, normalised."""
    return {" ".join(m.group(1).split()) for m in CI_RUN_RE.finditer(text)}


def ci_cmd_key(cmd: str) -> str:
    """A command's identity, with the shell plumbing and the caller's cwd taken out.

    🔴 274 TEES NINETEEN STEPS INTO THE CAPTURE LOG, and `late_na_ci_problems` compares an
    instrument's gate to a workflow step with `!=`. So `python3 x.py --selftest` and
    `python3 x.py --selftest 2>&1 | tee -a "$CI_MEASURED_LOG"` were two different commands
    to this reader, and `../scripts/x.py` and `scripts/x.py` — the same file from the two
    working directories ci.yml uses — were a third and a fourth.
    🔴 MEASURED THE MOMENT THE WALK ABOVE LEARNED PYTHON: the first instrument to need
    this got its OWN gate step back as *a second command that exercises this file*, which
    is the reader disagreeing with itself. Both halves were invisible while the walk
    spelled one language, and neither was ever about the language.
    """
    core = re.split(r"[|>&]", cmd, 1)[0].split()
    if len(core) < 2:
        return " ".join(core)
    return " ".join([core[0], Path(core[1]).name, *core[2:]])


def late_na_ci_problems(na: dict, instruments: list, ci_cmds: set[str],
                        floor: int = CI_COMMAND_FLOOR) -> list[str]:
    """PURE over its inputs (174 §8), so the self-check can hand it a tree that cannot exist."""
    problems: list[str] = []
    if len(ci_cmds) < floor:
        # 🔴 THE OBSERVATION, NOT A CAUSE (228 §7.17). ci.yml may have lost steps, or the
        # reader may have stopped matching them — a count cannot separate those, and both
        # leave every row below passing over an empty population.
        problems.append(
            f"LATE_LIVE_NA_CI read {len(ci_cmds)} node step(s) from ci.yml, floor {floor} — "
            f"the workflow may have lost them or CI_RUN_RE may have stopped matching, and a "
            f"count cannot separate those. Either way every NA row below is checked against "
            f"nothing and passes")
    by_name = {i["name"]: i for i in instruments}
    for name, _why in sorted(na.items()):
        inst = by_name.get(name)
        if inst is None:
            problems.append(
                f"LATE_LIVE_NA names {name!r}, which is not an instrument — an exclusion "
                f"outliving its subject (174 §5)")
            continue
        gate = ci_cmd_key(" ".join(inst["gate"]))
        src_name = Path(inst["src"]).name
        second = sorted(c for c in ci_cmds
                        if ci_cmd_key(c) != gate and len(c.split()) > 1
                        and Path(c.split()[1]).name == src_name)
        if second:
            problems.append(
                f"LATE_LIVE_NA_CI {name}: the row says no second command exercises this "
                f"file, and ci.yml runs `{second[0]}`. An instrument CI already drives for "
                f"real gets the [B:live] axis — the STRONGER of the two — at no new cost; "
                f"an NA row here buys an exemption with a sentence the tree contradicts "
                f"(232 §5.6, 211 §5)")
    return problems


# 🔴 THE LATE AXIS'S BLAST RADIUS, `A:gate` ONLY, AND THE MISSING HALF IS DELIBERATE.
# Per instrument and never summed, for 172 §6's reason. `B:live` gets NO floor: four of its
# five commands print no per-claim FAIL line at all — `tautology_gate.mjs`,
# `verdict_gate.mjs`, `boundary_gate.mjs` and `path-cohort.mjs --summary` report by
# collapsing a population, not by listing claims — so every floor there would be a floor at
# ZERO, which this file already refuses one screen up. The number is PRINTED on that axis
# and explicitly not compared, which is the honest half of 196 §33 rather than its defect.
# 🟢 199 §9.2 — THE SAME FOUR MOVED HERE, FOR THE SAME REASON AND BY THE SAME MEASUREMENT.
# Two ceilings falling to zero (`LATE_CRASH_CEILING_A/_B`) is what let these gates finish
# their reports on the late axis too.
LATE_BLAST_FLOOR: dict[str, int] = {
    # 🆕 277 §2 — measured 613 on A:gate, floored ~20% below. There is no B:live row
    # here because there is no B:live axis: `LATE_LIVE_COST` prices it out, and the
    # blast tables say so in `LATE_LIVE_BLAST_UNCOUNTABLE` rather than by omission.
    "handoff_gate.py": 490,   # 277: measured 613
    "_population.mjs": 55,
    "_path_ledger.mjs": 35,   # 212: 26 -> 35, measured 39
    "_workspace.mjs": 85,     # 199: 32 -> 85, measured 96
    "_png.mjs": 25,           # 199: 5 -> 25, measured 29
    "tautology_gate.mjs": 158,  # 199: 115 -> 158, measured 175
    "verdict_gate.mjs": 44,   # 212: 24 -> 44, measured 49
    "boundary_gate.mjs": 165,  # 212: 145 -> 165, measured 186
    "seal_order_gate.mjs": 300,  # 212: 220 -> 300, measured 338
    "path-cohort (compiled walk)": 48,
    # 🆕 211 §5 — THE TWO ROWS WHOSE ABSENCE PRINTED "on purpose". Both measured below on
    # the [A:gate] axis, floored from BELOW like every row above. Neither was a decision;
    # `wire_diff.mjs` was added to the gate in 209 with a `BLAST_FLOOR` row and no late
    # twin, and nothing in this file compared the two rosters until now.
    "wire_diff.mjs": 120,
    # 🆕 244 §4 — THE TWO P0 REPORTERS, MEASURED ON THE FIRST SWEEP THAT COULD SEE THEM.
    # 31 and 19 on the [A:gate] axis. 🔴 AND THE FIRST MEASUREMENT WAS 29 AND 17, TAKEN
    # BEFORE THE SWEEP HAD FINISHED TALKING: it also reported that `{SIG:walkTs}` and
    # `{SIG:oracleKeyOf}` could return their empties with both self-tests GREEN — the walk
    # under every table `p0_complexity.mjs` ranks, and the middle third of the clustering
    # key `p0_testdup.mjs` exists to defend, neither covered by the file beside it.
    # Flooring the first numbers would have pinned the gap in place. Six claims later the
    # numbers are these, and they are floored from BELOW with the usual headroom.
    "p0_complexity.mjs": 26,   # 244: measured 31 across its five blinds, 0 crashed
    "p0_testdup.mjs": 16,      # 244: measured 19 across its six blinds, 0 crashed
    "token-cost.mjs": 20,  # 212: 8 -> 20, measured 23
    # 🆕 231 — MEASURED AT 20 ON THIS AXIS AND FLOORED FROM BELOW, which is 198 §36's rule
    # and the reason the first draft of this row (40, guessed from the sibling above
    # before the sweep ran) would have been wrong in the direction that reddens a healthy
    # tree. The count is small because this proof reports one line per failed claim and
    # the five blinded members are read by 27 claims, not by 157.
    "wire_invisible_gate.mjs": 16,
    # 🆕 232 — MEASURED AT THIRTY-ONE ON THIS AXIS after the self-test stopped crashing,
    # floored from BELOW with 198 §36's headroom. Lower than the primary axis for the
    # reason 231's row one line up gives: the late injector blinds from the SECOND call,
    # so the claims reading a member once still pass and only the repeated readers fail.
    "positive_control_gate.mjs": 26,  # 232: measured 31 on [A:gate]
    # 🆕 245 §1 — the Python cohort's late [A:gate] blast, floored from BELOW. Lower than
    # the global blast for 231's reason: the late injector blinds from the SECOND call, so
    # the claims that read a member once still pass.
    "p0_comments.py": 6,
    "queue_gate.py": 160,          # 271: 78 -> 160, measured 202 (+5 targets)
    "mutation_lock_gate.py": 15,   # 247: 6 -> 19 measured, floored from below
    "terminology_gate.py": 9,      # 247: measured 11 on [A:gate]
    # 🆕 278 §4 — measured 101 on [A:gate], floored ~20% below. Close to the primary
    # blast (110) rather than well under it, unlike every JavaScript row above: this
    # self-test reads most members MORE than once across its eight fixture tables, so a
    # blind from call two still reaches nearly every claim.
    "release_names.py": 80,                       # 278: measured 101 on [A:gate]
    # 🆕 278 §4 — 🔵 A ROSTER ROW OVER AN EMPTY POPULATION, AND IT SAYS SO. All four of
    # this entry's targets are called exactly ONCE by `--assert-addon`, so a late blind is
    # not constructible on either of its axes and neither ever records a blast. The row
    # exists because `LATE_BLAST_FLOOR` is checked for COMPLETENESS — an instrument with no
    # row reads as an instrument nobody measured — and the number is the smallest that can
    # separate "reported something" from "reported nothing" if one ever becomes
    # constructible. It is not a measurement and does not pretend to be one.
    "release_names.py (--assert-addon)": 1,       # 278: not constructible; completeness row
}
# ══ 🆕 245 §3 — `late-live-blast-unfloored` (244) ══════════════════════════════════
#
# 🔴 THE EXCLUSION ABOVE WAS A DESCRIPTION OF FIVE FILES WEARING THE SHAPE OF A RULE.
# "`B:live` gets NO floor: four of its five commands print no per-claim FAIL line at all"
# was true when it was written and had been false for two sessions by the time 244 named
# it: `p0_complexity.mjs --floor` and `p0_testdup.mjs --floor` were built in 244 with a
# `FAIL <NAME>` spelling precisely so their reds could be counted, and this file went on
# printing their blast beside "NOT floored on this axis, on purpose". The live axis has
# grown from five commands to seventeen since that sentence was written and nothing
# re-read it. **An instrument whose late blinds stopped reddening anything reads exactly
# like one whose never could.**
#
# 🔴 SO IT IS TWO TABLES AND THE SECOND ONE REFUTES ITSELF. Every instrument's live axis is
# either FLOORED here or carries a row in `LATE_LIVE_BLAST_UNCOUNTABLE` — and a row there
# is refused the moment its instrument reports a nonzero blast, which is the same run's own
# output disagreeing with the excuse. The eleven rows below are not an argument that those
# commands could never be counted; they are the measurement that today they report by
# COLLAPSING A POPULATION rather than by listing claims, and the way to leave the table is
# to give the command a `FAIL <NAME>` line, exactly as 244 did for two of them.
#
# Measured this session across every live axis, floored from BELOW with 198 §36's headroom.
LATE_LIVE_BLAST_FLOOR: dict[str, int] = {
    "_population.mjs": 32,        # 245: measured 40
    "p0_complexity.mjs": 12,      # 245: measured 15
    "p0_testdup.mjs": 11,         # 245: measured 14
    "_png.mjs": 7,                # 245: measured 9
    "_workspace.mjs": 5,          # 245: measured 7
    "p0_comments.py": 5,          # 245: measured 7
    # 🔴 A POPULATION OF ONE, AND THE FLOOR SAYS SO. This axis has exactly one constructible
    # late target (`{SIG:_cells}`; the other two are called once), and the number of reds it
    # produces is a function of what QUEUE.md holds that session. Floored at the smallest
    # number that separates "reported something" from "reported nothing", which is the only
    # honest pin available over a population this size.
    "queue_gate.py": 3,           # 271: 1 -> 3, measured 6 (+reach_join)
    # 🆕 247 §2 — ANOTHER POPULATION OF ONE, and the one is the point. Four of the five
    # late blinds on the live axis are not constructible there (the walks and the parser
    # are each called once); `{SIG:offenders}` is called 290 times and was GREEN until
    # this session floored the excluded population it reads. The pin is the smallest
    # number that separates "reported something" from "reported nothing".
    "terminology_gate.py": 1,     # 247: measured 1
    # 🆕 278 §4 — measured 101 on [A:gate], floored ~20% below. Close to the primary
    # blast (110) rather than well under it, unlike every JavaScript row above: this
    # self-test reads most members MORE than once across its eight fixture tables, so a
    # blind from call two still reaches nearly every claim.
    # 🆕 278 §4 — ONLY THE SECOND ENTRY IS FLOORED HERE. The first is in
    # `LATE_LIVE_BLAST_UNCOUNTABLE` with the measurement that says why: its live command
    # calls exactly one of its fifteen targets twice. Two entries over one file, two
    # different answers about the same axis, and both are readings rather than opinions.
    "release_names.py (--assert-addon)": 1,       # 278: not constructible; see A:gate row
}

LATE_LIVE_BLAST_UNCOUNTABLE: dict[str, str] = {
    # 🆕 277 §2 — the SECOND row here that is not about the command's output. Like
    # `mutation_lock_gate.py` below, `handoff_gate.py` reports zero on this axis because
    # the axis did not run — `LATE_LIVE_COST` prices `--patterns` out of a fifty-seven
    # target sweep. Kept as a row rather than special-cased, for the reason that row gives.
    # 🆕 278 §4 — AND THIS ONE IS NOT "THE AXIS DID NOT RUN". It ran, over all fifteen
    # targets, and reddened NOTHING — which is a different sentence and gets its own row
    # rather than a floor of one nobody could ever meet. Measured: `--assert-addon` calls
    # exactly one of this instrument's fifteen targets more than once (`_pack`, six times
    # at import), and that one is declared in `LATE_DECLARED_GREEN` with its reason. The
    # other fourteen are `not-called` on this axis by construction, so there is no
    # population for a blast to be taken over. 🔵 The coverage those fourteen would want
    # is `release_names.py (--assert-addon)`'s, which is why that entry exists.
    "release_names.py": "the live axis ran and had nothing to redden — `--assert-addon` "
                        "calls exactly one of the fifteen targets twice and that one is in "
                        "LATE_DECLARED_GREEN. A floor over an empty population is 172 "
                        "§10.21 wearing a number.",
    "handoff_gate.py": "no B:live axis ran — `LATE_LIVE_COST` prices `--patterns` at 172s "
                       "per mutant, so this number would be zero for a third reason again",
    "tautology_gate.mjs": "it reports by collapsing a population, not by listing claims",
    "verdict_gate.mjs": "it reports by collapsing a population, not by listing claims",
    "boundary_gate.mjs": "it reports by collapsing a population, not by listing claims",
    "path-cohort (compiled walk)": "`path-cohort.mjs --summary` prints a table, not claims",
    "_path_ledger.mjs": "its live driver is `path-cohort.mjs --summary`, the row above",
    "seal_order_gate.mjs": "the live gate prints a census and one verdict, not per-claim lines",
    "token-cost.mjs": "`--summary` prints a budget table, not per-claim lines",
    "wire_invisible_gate.mjs": "the live surface read prints a roster, not per-claim lines",
    "wire_diff.mjs": "`--discover` prints the keys it found, not per-claim lines",
    "positive_control_gate.mjs": "the live run prints its census and one verdict line",
    # 🔴 THE ONE THAT IS NOT ABOUT THE COMMAND'S OUTPUT AT ALL. `mutation_lock_gate.py` has
    # no B:live axis (see `LATE_LIVE_LOCKED`), so it reports zero here for a third reason
    # again — the axis did not run. The row is kept rather than special-cased because the
    # refusal above is driven by the NUMBER, and a locked instrument that somehow starts
    # reporting a blast on an axis that never ran is a thing this file should refuse.
    "mutation_lock_gate.py": "its B:live axis does not run at all — the live command takes "
                             "the mutation lock this sweep holds (LATE_LIVE_LOCKED)",
}

LATE_BLAST_OBSERVED: dict[tuple[str, str], int] = {}
LATE_CRASHED_A: list[tuple[str, str]] = []
LATE_CRASHED_B: list[tuple[str, str]] = []


# 🔴 THE FLOOR ON THE HARNESS ITSELF, AND THE REVERSE SWEEP IS WHY IT EXISTS. Make
# `late()` return the text unmodified and EVERY target reports `calls=0`, every one is
# filed as "not constructible", no problem is raised and the gate prints ok — the whole
# second axis neutralised in silence, which is the exact defect it was built to find, one
# level up. `>=`, and measured at 70 of 84 across both axes.
LATE_CONSTRUCTED_FLOOR = 160  # governed by floor_pin_gate SIZE_LEDGER (§9.3)
#                               245: 98 -> 160, measured 179 late mutants constructed
#                               212: 65 -> 98, measured 109 late mutants constructed
LATE_CONSTRUCTED: list[str] = []

# 🆕 183 — AND THE ROSTER ABOVE NEEDS ITS OWN FLOOR, WHICH IS THE HALF `LATE_CONSTRUCTED`
# CANNOT COVER. Deleting the three `_caller_shape.harness.mjs` entries from LATE_LIVE
# takes the constructed count from 82 to 70 — still clear of the floor above, because that
# floor is a backstop on the INJECTOR and not on the roster. Two different collapses, so
# two different numbers: 182 §8 reached the same conclusion about `CHECKS_RUN` and settled
# it the same way — a roster AND a floor rather than either alone. `>=`, because the point
# of the caller-shape harness is that this list grows.
LATE_LIVE_FLOOR = 8

# 🆕 211 §5 — THE EXCLUSION, WRITTEN DOWN. Every instrument is now either in `LATE_LIVE`
# or in here with a reason; the branch in `main()` refuses a name in neither. 🔴 THE
# REASONS ARE ABOUT THE DRIVER, NOT ABOUT THE INSTRUMENT — "there is no second command
# that exercises this file" is a fact anybody can check, where "not needed" is not.
# 🆕 233 — ONE ROW, DOWN FROM FOUR, AND THE THREE THAT LEFT WERE MEASURED OUT RATHER THAN
# ARGUED OUT. Every remaining row must say the thing 232 §5.6 requires — that no second
# command exercises this file — and that sentence is now checked against ci.yml rather
# than trusted: `LATE_LIVE_NA_CI` below refuses a row whose instrument CI runs a second
# command for. The three rows that left had been false since the steps that falsify them
# were written, and nothing in this file could see it, because the excuse was READ and
# never RE-DERIVED. That is 232's finding one roster over: complete about what it
# contains, blind to what the tree says about it.
# 🔴 EMPTY, AND IT EMPTIED IN THE SAME COMMIT THAT LEARNED TO CHECK IT. Three rows were
# refuted by ci.yml (§5.1). The fourth — `wire_diff.mjs` — said "the live axis needs a
# baseline ref built in a worktree", and that was true of the command it had; this session
# gave it one that does not (`--discover`, which reads the wire that is here now and asks
# what keys it carries), so the reason expired the moment the step was written and the row
# went with it. **Every instrument in this tree now gets the STRONGER of the two axes.**
#
# 🔴 SO THE RULE ABOVE IS PROVED ON FIXTURES AND NOT ON A POPULATION — `instrument_gate.py`
# arriving at its own U1 for the third table in two sessions. `_self_check` drives both
# branches of the NA path over a tree that cannot exist, because an empty table is the one
# state in which "this check passes" and "this check is switched off" look identical.
LATE_LIVE_NA: dict[str, str] = {}

# 🆕 245 §1 — 🔴 A THIRD ANSWER, BECAUSE THE SECOND COMMAND EXISTS AND CANNOT BE RUN HERE.
# `mutation_lock_gate.py` with no flag is a step in ci.yml, so 232 §5.6's rule refuses a
# `LATE_LIVE_NA` row for it outright — the sentence those rows have to say ("there is no
# second command that exercises this file") would be false. What is true is narrower and it
# is a fact about THIS HARNESS rather than about that instrument: the live command calls
# `acquire()`, this gate holds the mutation lock for the whole sweep, and 224 §6.6 is the
# entire reason both of those are so. Spawned from in here it exits on the refusal path
# before it reads a line of its own source.
#
# 🔴 AND THE ROW IS DERIVED, NOT BELIEVED. `late_locked_problems` refuses a row whose file
# does not actually call `acquire(` — the same check `mutation_lock_gate.py` makes of every
# other gate, pointed back at the reason it is excused. An exclusion whose evidence is a
# sentence is 211 §5's class; this one's evidence is the call site.
LATE_LIVE_LOCKED: dict[str, str] = {
    "mutation_lock_gate.py":
        "its only second command (`python3 scripts/mutation_lock_gate.py`, ci.yml) takes "
        "the mutation lock, and this sweep holds it from `main()` to the finally. Two "
        "mutating gates at once produce a red that is entirely the harness (224 §6.6), so "
        "the B:live axis is unavailable BY THE LOCK rather than by the absence of a "
        "command. The A:gate axis blinds all five members and reddens on every one.",
}


def late_locked_problems(locked: dict, root) -> list[str]:
    """A row here must name a file that really acquires the lock. PURE over its inputs."""
    out: list[str] = []
    for name, why in sorted(locked.items()):
        src = Path(root) / "scripts" / name
        if not src.exists():
            out.append(f"LATE_LIVE_LOCKED names {name!r}, which is not in scripts/")
            continue
        if not re.search(r"^[ \t]*acquire\(", src.read_text(), re.M):
            out.append(
                f"LATE_LIVE_LOCKED {name} is excused from the B:live axis because its live "
                f"command takes the mutation lock, and that file contains no `acquire(` "
                f"call site. The reason has outlived the fact (174 §5) — either the lock "
                f"was removed, in which case the axis is available and this row must go, "
                f"or the row was wrong when it was written: {why[:60]}…")
    return out


# ══ 🆕 277 §2 — THE THIRD ANSWER: THE AXIS EXISTS, IS DRIVABLE, AND COSTS TOO MUCH ═════
#
# 🔴 `LATE_LIVE_NA` HAS EXACTLY ONE SENTENCE TO SAY AND IT WOULD BE FALSE HERE. ci.yml
# runs `python3 ../scripts/handoff_gate.py --patterns`, so 232 §5.6's rule refuses an NA
# row for that instrument outright — correctly, and only because the walk above learned to
# spell Python this session. `LATE_LIVE_LOCKED` is false too: nothing about that command
# takes the mutation lock. What IS true is a third sentence, and unlike the other two it
# is a NUMBER: `--patterns` runs every instrument's live command and takes 172 s on this
# tree, so a fifty-seven-target late sweep of it is 2.7 HOURS on every push.
#
# 🔴 A COST ROW IS FALSIFIABLE AND A PROSE EXCUSE IS NOT, which is the whole reason this
# is a third table rather than a paragraph in the second. The row names the command and
# the seconds; the check below refuses it if ci.yml stops running that command (the
# exemption outliving its subject, 174 §5) and refuses it if the declared cost drops UNDER
# the budget (the exemption outliving its reason — at that price the axis is simply owed).
# Neither refusal needs anybody to remember this decision.
LATE_LIVE_COST_BUDGET = 20      # seconds per mutant. One sweep is ~57 of them.
LATE_LIVE_COST: dict[str, tuple[str, int]] = {
    "handoff_gate.py": ("python3 handoff_gate.py --patterns", 172),
}


def late_live_cost_problems(cost: dict, instruments: list, ci_cmds: "set[str]",
                            live: dict, na: dict, locked: dict,
                            budget: int = LATE_LIVE_COST_BUDGET) -> "list[str]":
    """PURE over its inputs (174 §8), so the self-check can drive every direction."""
    out: "list[str]" = []
    by_name = {i["name"]: i for i in instruments}
    keys = {ci_cmd_key(c) for c in ci_cmds}
    for name, (cmd, secs) in sorted(cost.items()):
        if name not in by_name:
            out.append(f"LATE_LIVE_COST names {name!r}, which is not an instrument — an "
                       f"exclusion outliving its subject (174 §5)")
            continue
        for other, label in ((live, "LATE_LIVE"), (na, "LATE_LIVE_NA"),
                             (locked, "LATE_LIVE_LOCKED")):
            if name in other:
                out.append(f"LATE_LIVE_COST {name} is also in {label} — two tables "
                           f"answering one question is 180 §7.1, and only one of them "
                           f"can be the reason this instrument has no live axis")
        if ci_cmd_key(cmd) not in keys:
            out.append(
                f"LATE_LIVE_COST {name}: the row is bought with the price of "
                f"`{cmd}` and ci.yml does not run it. A cost row for a command nobody "
                f"runs is an exemption for an axis that was never available — which is a "
                f"`LATE_LIVE_NA` row, said honestly, and belongs in that table")
        if secs <= budget:
            out.append(
                f"LATE_LIVE_COST {name}: the row declares `{cmd}` at {secs}s per mutant "
                f"and the budget is {budget}s. At that price the [B:live] axis is OWED, "
                f"not excused — this is the reason outliving the fact (174 §5) with the "
                f"fact written down beside it")
    return out


# ══ THE DISCOVER HALF — 232, answering 231 §5.1 ════════════════════════════════════
#
# 🔴 THE GATE THAT GRADES EVERY INSTRUMENT WAS THE ONE GATE THAT COULD NOT NOTICE A NEW
# ONE. 231 §5.1: this file printed `ok — every instrument collapses loudly` over ELEVEN
# instruments on the run that introduced the twelfth, and it was right about all eleven.
# `floor_pin_gate.py` refused that same commit's floors unprompted twenty minutes earlier,
# because it WALKS THE TREE where this one READ A LIST. A typed roster cannot report what
# joined; that is not a defect in any row, it is the absence of this half.
#
# 🔴 THE DISCRIMINATOR IS A STRUCTURAL PROPERTY, MEASURED — NOT A NAME SHAPE. An
# instrument is a MODULE: something another file imports, whose members a blind can reach
# and whose collapse would be silent. A file that exports nothing has no member to inject
# into — `blind()` would have nowhere to put the statement — so it cannot be an instrument
# whatever it is called. The alternative on offer was the suffix (`.selftest.mjs`,
# `.integration.mjs`), and it is refused for the reason `floor_pin_gate.py`'s own history
# gives three times over: a rule scoped to a SPELLING rots in the direction the spelling
# does not cover (183 §12.29, 197, 199, 200 §12.2).
#
# 🔴 BOTH CANDIDATE DISCRIMINATORS WERE MEASURED BEFORE ONE WAS CHOSEN, and they agree
# exactly (`/tmp/probe232/census.py`, over the live tree):
#
#     48 .mjs file(s) walked · 11 instruments · 11 named as an instrument's gate
#     12 export-bearing · 12 imported by >= 1 tracked file
#     A) exports and is neither instrument nor gate  ->  positive_control_gate.mjs
#     B) imported and is neither instrument nor gate ->  positive_control_gate.mjs
#     C) instruments that export nothing             ->  none
#     D) instruments nobody imports                  ->  none
#
# ONE file, found by both readings, and it is an 818-line reader with a headless self-test
# that CI has run on every push since 219 without ever being blinded. It is the entry
# above rather than a row in DISCOVER_EXEMPT below, which is what a discovery half is for.
#
# 🔴 AND THE WALK IS SCOPED TO THE TWO DIRECTORIES, WHICH IS ITSELF A LIMIT WITH A ROW.
# The twelfth instrument's swept file is `host/dist-test/src/path-cohort.js` — a BUILD
# ARTEFACT compiled from `src/path-cohort.ts`, outside both dirs. Rather than widen the
# walk to `src/` (a population of hundreds, none of which is an instrument today) the
# other direction is checked instead: every instrument the walk CANNOT reach must be
# declared below with a reason, and a declaration for one it CAN reach is stale and
# refuses. That is `floor_pin_gate.py`'s UNDISCOVERABLE check, one file over — the
# discovery half's coverage of its own roster, asked in both directions.
DISCOVER_DIRS = [HOST / "scripts", HOST / "test-integration"]
MODULE_RE = re.compile(r"^export[ \t]", re.M)

# 🔴 EMPTY, AND THE RULE IS PROVED ON A FIXTURE RATHER THAN ON A POPULATION (the U1
# lesson: a check whose population is empty is passing for the wrong reason). Nothing in
# the walk today is an export-bearing file that is neither an instrument nor a gate — the
# one that was is now the thirteenth entry. A row here needs the shape 174 §5 requires: a
# REASON, not a name, and one a reader can check rather than agree with.
DISCOVER_EXEMPT: dict[str, str] = {
    # 🆕 244 §4 — 🟢 EMPTY, AND THE ROW THAT EMPTIED IT IS `p0-reporters-unblinded` (241).
    #
    # 241 opened this table with two entries and called them an IOU rather than a
    # judgement: *"both BELONG in `INSTRUMENTS` — the entries were written, and what
    # stopped them was the late axis rather than the gate one: `LATE_LIVE` needs a second
    # command that goes RED when a member is blinded, and a reporter that PRINTS cannot."*
    # 244 gave all three P0 reporters a `--floor` command that refuses when their own
    # measurement collapses, and both `.mjs` rows moved into `INSTRUMENTS` with their
    # blinds and their `LATE_LIVE` entries.
    #
    # 🔴 IT STAYS, EMPTY, BECAUSE THE MECHANISM IS THE POINT AND NOT THE ROWS. The DISCOVER
    # half reads this table; deleting it would mean the next file dropped in these two
    # directories is either swept or silently outside every roster, which is
    # `token-cost.mjs`'s ten sessions (211 §6) arriving a third time. An exemption table
    # with nothing in it is a gate that has nothing to excuse.
}

# The instruments whose swept file the walk above cannot see, each with the reason.
DISCOVER_OUTSIDE_WALK: dict[str, str] = {
    "path-cohort (compiled walk)":
        "its swept file is `host/dist-test/src/path-cohort.js`, a BUILD ARTEFACT compiled "
        "from `src/path-cohort.ts` by `npm test`. The walk is scoped to the two .mjs "
        "directories on purpose: widening it to `src/` would admit hundreds of modules, "
        "none of which is an instrument, and every one of which would need a row here. "
        "The TypeScript source is covered by `tsc --strict` and by the unit gate this "
        "entry names; what is uncovered is nothing, because the artefact IS swept — it is "
        "only unreachable by THIS walk.",
}

# 🔴 TWO FLOORS, NOT ONE SUM (172 §6). A walk pointed at a directory that no longer
# exists returns nothing and every downstream check passes over an empty population;
# a walk that still reads 48 files while the MODULE reader silently stops recognising
# exports is the same collapse one layer in, and the file count cannot see it.
# Measured before they were set: 48 files walked, 12 export-bearing. Floored from BELOW
# (198 §36) so growth never reddens a healthy tree.
DISCOVER_FLOOR = 30
DISCOVER_MODULE_FLOOR = 8


def discover_walk(dirs) -> list[tuple[str, bool]]:
    """(path relative to ROOT, does it export anything) for every .mjs in `dirs`."""
    out: list[tuple[str, bool]] = []
    for d in dirs:
        if not d.exists():
            continue
        for f in sorted(d.glob("*.mjs")):
            out.append((str(f.relative_to(ROOT)), bool(MODULE_RE.search(f.read_text()))))
    return out


def gate_scripts(instruments) -> set[str]:
    """Every file the ROSTER ITSELF names as a runner — derived, never re-typed.

    198's rule, and 199 §9.3's reason for it: an exclusion built from data the tree
    already carries cannot drift away from the thing it excludes. A `.selftest.mjs` is
    not an instrument because it is the GATE, and the only trustworthy statement of
    which files those are is the `gate` command each entry already declares. The live
    drivers in `LATE_LIVE` are read the same way — `_caller_shape.harness.mjs` is a
    caller this file constructs mutants for, not a member it blinds.
    """
    out: set[str] = set()
    for inst in instruments:
        for a in inst["gate"]:
            if a.endswith((".mjs", ".js")):
                out.add(str((Path(inst["cwd"]) / a).resolve().relative_to(ROOT)))
    for cmd, _alt in LATE_LIVE.values():
        for a in cmd:
            if a.endswith((".mjs", ".js")):
                out.add(str((HOST / a).resolve().relative_to(ROOT)))
    return out


def discovery_problems(files, instruments, exempt, outside, walk_floor, module_floor,
                       gates) -> tuple[list[str], dict]:
    """PURE over its inputs, so the self-check can hand it a tree that cannot exist.

    174 §8's rule: a collector only ever asserted over the healthy population loses its
    filter invisibly. Every refusal below is driven from both sides in `_self_check`.
    """
    problems: list[str] = []
    inst_path = {}
    for i in instruments:
        try:
            inst_path[str(Path(i["src"]).resolve().relative_to(ROOT))] = i["name"]
        except ValueError:
            inst_path[str(Path(i["src"]))] = i["name"]
    walked = {p for p, _ in files}
    modules = [p for p, exports in files if exports]

    for p in sorted(modules):
        if p in inst_path or p in gates or p in exempt:
            continue
        problems.append(
            f"INSTRUMENT_GATE_DISCOVER UNDECLARED {p} — it EXPORTS members, so another "
            f"file can import it and a blind can reach it, and it is neither an entry in "
            f"INSTRUMENTS nor a gate this roster names nor a row in DISCOVER_EXEMPT. "
            f"Nothing else in this file can see that: every other check here is about "
            f"instruments that were WRITTEN DOWN. Add the entry, or the row with a reason")
    for p in sorted(exempt):
        if p not in walked:
            problems.append(
                f"INSTRUMENT_GATE_DISCOVER STALE_EXEMPT {p} — declared exempt, and the walk "
                f"cannot find it. An exclusion outliving its subject is an exemption nobody "
                f"has re-argued (174 §5)")
        elif p in inst_path:
            problems.append(
                f"INSTRUMENT_GATE_DISCOVER EXEMPT_IS_INSTRUMENT {p} — it is swept as "
                f"`{inst_path[p]}` AND carries a reason for not being swept. One of the two "
                f"is wrong and this file cannot decide which")
    if len(files) < walk_floor:
        problems.append(
            # 🔴 THE OBSERVATION, NOT A CAUSE (228 §7.17). This population is DERIVED from a
            # directory walk, and a count cannot tell a tree that really lost files from a
            # walk that stopped reaching them — the first draft of this line asserted the
            # second and `floor_pin_gate.py` refused it on the run that added it.
            f"INSTRUMENT_GATE_DISCOVER WALK_FLOOR {len(files)} < {walk_floor} — fewer files "
            f"than the floor. The tree may have lost them, or the walk may have stopped "
            f"reaching them, and a count cannot separate those; either way a discovery half "
            f"over a population this small reports nothing undeclared and passes, which is "
            f"this gate's own 231 §5.1 one layer down")
    if len(modules) < module_floor:
        problems.append(
            f"INSTRUMENT_GATE_DISCOVER MODULE_FLOOR {len(modules)} < {module_floor} — fewer "
            f"export-bearing files than the floor, over {len(files)} file(s) read. Modules "
            f"may have been deleted or merged, or MODULE_RE may have stopped recognising "
            f"them; the count cannot separate those. Both leave every file reading as an "
            f"executable, and the file count above cannot see it — which is why this is a "
            f"second floor and never a sum (172 §6)")
    for name, path in sorted((v, k) for k, v in inst_path.items()):
        if path in walked or name in outside:
            continue
        problems.append(
            f"INSTRUMENT_GATE_DISCOVER OUTSIDE_WALK {name} ({path}) — swept by this gate and "
            f"unreachable by its own DISCOVER walk, with no row saying why. The walk's "
            f"coverage of the roster has to be checked in BOTH directions or it rots in the "
            f"one nobody reads (floor_pin_gate.py's UNDISCOVERABLE, one file over)")
    for name in sorted(outside):
        path = next((p for p, n in inst_path.items() if n == name), None)
        if path is None:
            problems.append(
                f"INSTRUMENT_GATE_DISCOVER OUTSIDE_STALE {name} — declared unreachable by the "
                f"walk, and no instrument of that name is swept at all")
        elif path in walked:
            problems.append(
                f"INSTRUMENT_GATE_DISCOVER OUTSIDE_STALE {name} — declared unreachable by the "
                f"walk, which now reaches it at {path}. The reason has outlived the fact")
    stats = {
        "files": len(files), "modules": len(modules),
        "instruments": sum(1 for p in walked if p in inst_path),
        "gates": sum(1 for p in walked if p in gates),
        "exempt": len(exempt),
        "undeclared": sum(1 for m in problems if "UNDECLARED" in m),
        "outside": len(outside),
    }
    return problems, stats



# ══ 🆕 245 §1 — THE PYTHON DISCOVER HALF ═══════════════════════════════════════════
#
# 🔴 `blind-py-gates` SAID "SEVENTEEN TRACKED .py GATES" AND THE TREE HOLDS EIGHTEEN. The
# row was written at 234; `p0_comments.py` joined `scripts/` at 243 and nothing anywhere
# could see it, because there was no roster of Python gates at all — not an empty one,
# none. That is 231 §5.1 and 244's whole finding arriving at the language this file could
# not read: an instrument working perfectly on the population it can see, silent about the
# one it cannot.
#
# 🔴 AND IT IS AN EQUALITY, NOT A FLOOR. Every tracked `scripts/*.py` is swept or carries a
# reason; every reason names a file the walk found. A walk that returns nothing turns every
# row below STALE and refuses, so this half needs no floor constant — the roster floors it.
PY_NOT_SWEPT: dict[str, str] = {
    # ── already blinded, by an older harness ──────────────────────────────────────────
    "contract_check.py":
        "swept since 172 by `scope_gate.py`, which derives twenty-five targets from the "
        "return annotations and requires each blinded run to go RED. It is the one Python "
        "file in this tree that had a blinding harness before this session, and a second "
        "one here would be two rosters over one file (180 §7.1).",
    # ── the mutating gates: their only command takes the lock this sweep holds ────────
    "instrument_gate.py":
        "this file. It holds the mutation lock for the whole sweep and rewrites the tree; "
        "blinding it from inside itself would be a mutant sweeping its own mutants.",
    "scope_gate.py":
        "a mutating gate — it takes the mutation lock and runs `contract_check.py` against "
        "the working tree, so spawning it from in here exits on the refusal path before it "
        "reads a line of its own source (224 §6.6). Same fact as `LATE_LIVE_LOCKED`, one "
        "axis further up: for these four there is no unlocked command at all.",
    "control_gate.py":
        "a mutating gate — takes the mutation lock (see `scope_gate.py` above).",
    "floor_pin_gate.py":
        "a mutating gate — takes the mutation lock (see `scope_gate.py` above).",
    # ── no command of their own ──────────────────────────────────────────────────────
    "_gate_lock.py":
        "a library, not a gate: nothing runs it. Its behaviour is asserted from the "
        "outside by `mutation_lock_gate.py`'s controls, which spawn every guarded gate "
        "while the lock is HELD and require each to refuse — a stronger reading than a "
        "blind of the library would give.",
    # ── the network readers ──────────────────────────────────────────────────────────
    "registry_lag.py":
        "its measurement is the npm registry. A blind here would be swept in CI against a "
        "network this gate is explicitly allowed to fail on (`REGISTRY_LAG REFUSED`), so a "
        "green would mean the network and a red would mean nothing.",
    "assetlib_sweep.py":
        "same shape — its population is godotengine.org, and the container this gate runs "
        "in cannot reach it.",
    # ── 🔴 THE SIX THAT ARE READY EXCEPT FOR WHAT THE SWEEP FOUND IN THEM ────────────
    #
    # Every reason below is a MEASUREMENT taken this session with the injector above, and
    # every one names the members that would have to be closed first. That is the point of
    # writing them here rather than leaving the files out: a row that says WHAT IS WRONG is
    # a work item, and a file with no row is a coverage claim nobody made.
    # 🟢 277 §2 — `handoff_gate.py` LEFT THIS TABLE. It is the fifth Python instrument
    # above: 78 members, 56 targeted, 22 declared in `NOT_A_TARGET` under three reasons.
    # 247's row said FORTY-NINE and nothing printed the number, so the drift to 78 was
    # invisible for twenty-nine sessions — a count of what the reader could spell (276).
    # 🟢 278 §4 — `release_names.py` LEFT THIS TABLE. It is the sixth Python instrument
    # above: 33 members, 15 targeted on A:gate, 4 more on the B:live axis `--assert-addon`
    # gives it, 14 declared in `NOT_A_TARGET` under three reasons. 247's row said
    # SEVENTEEN and nothing printed the number, so the drift to 33 was invisible for
    # thirty sessions — a count of what the reader could spell (276), for the third
    # consecutive session and in the sibling of the row 277 closed.
    "spec_conformance.py":
        "measured: 3 of 7 caught. 🆕 247 §1 — AND ONE OF THE TWO GREENS WAS NOT A COVERAGE "
        "GAP AT ALL. `scanned_files` was called by NOTHING in this repository, so its blind "
        "was green for the most boring reason there is, and from outside the axis that is "
        "the same observation as a member no case reaches. It is deleted. `{SIG:get}` "
        "remains: it is the network read `--refresh` uses and no other command calls it. "
        "Re-measured over the whole module rather than over the shapes `EMPTY` can spell: "
        "10 members, and `load_ledger`, `hits` and `pin_problems` are each green under "
        "`--selftest` while `is_excluded` is caught only by `--check`.",
    "registry_bytes.py":
        "measured: 4 of 10 caught, `{SIG:tree_shas}` STILL GREEN under `--selftest`.",
    "lint_ceiling.py":
        "measured: 4 of 8 caught. The three tool-absence guards — `{SIG:tsc_absent}`, "
        "`{SIG:dist_absent}`, `{SIG:pyflakes_absent}` — can each answer 'the tool is here' "
        "and the self-test cannot tell, which is the guard that decides whether a whole "
        "lint class was READ or merely not reported.",
    "tree_quiet.py":
        "measured, and this one is about the HARNESS rather than about the file: its two "
        "members do their work in a SUBPROCESS, so the late hook's `atexit` line is written "
        "into a child's output and the axis records NEVER LOADED rather than a call count. "
        "Both are caught on the global axis. A late blind needs a second injector that "
        "crosses a process boundary, and that is not this session's row.",
}


def py_walk(root) -> "list[str]":
    """Every TRACKED `scripts/*.py`, from git rather than from a glob — a scratch mutant
    left behind by a killed run is not a gate, and `_scope_gate_mutant.py` is exactly that."""
    p = subprocess.run(["git", "ls-files", "scripts/*.py"],
                       capture_output=True, text=True, cwd=str(root))
    return sorted(Path(x).name for x in p.stdout.split("\n") if x.strip().endswith(".py"))


def py_discovery_stats(files, instruments, declared) -> dict:
    """The census line's numbers. Split from the refusals so `_call_wiring_problems` can
    stub the predicate without the stats call collapsing with it — the two answer different
    questions and only one of them is a verdict."""
    swept = {Path(i["src"]).name for i in instruments if str(i["src"]).endswith(".py")}
    walked = set(files)
    probs = py_discovery_problems(files, instruments, declared)
    return {
        "files": len(walked), "swept": len(swept & walked),
        "declared": len(set(declared) & walked),
        "undeclared": sum(1 for m in probs if "UNDECLARED" in m),
        "stale": sum(1 for m in probs if " STALE " in m),
    }


def py_discovery_problems(files, instruments, declared) -> list[str]:
    """PURE over its inputs — 174 §8's rule, so `_self_check` can hand it a tree that
    cannot exist and drive both directions of every refusal.

    🆕 278 §4 — SWEPT IS KEYED ON THE SOURCE FILE, NOT ON THE ENTRY NAME. This half asks
    *is this tracked Python gate swept by anything*, and an entry's `name` is a LABEL: it
    is `release_names.py (--assert-addon)` for the second entry over that same file, and
    `path-cohort (compiled walk)` has never been a filename at all. Keyed on the label, a
    second entry over an already-swept file reported `PY OUTSIDE` — the walk cannot reach
    a name that is not a path — which is this reader answering a question about labels
    while describing itself as answering one about files.
    """
    problems: list[str] = []
    swept = {Path(i["src"]).name for i in instruments if str(i["src"]).endswith(".py")}
    walked = set(files)
    for name in sorted(walked - swept - set(declared)):
        problems.append(
            f"INSTRUMENT_GATE_PY UNDECLARED {name} — a tracked Python gate that is neither "
            f"an entry in INSTRUMENTS nor a row in PY_NOT_SWEPT. Nothing else in this file "
            f"can see it: every other check here is about instruments that were WRITTEN "
            f"DOWN, and for eighteen files that list did not exist. Add the entry, or the "
            f"row with the measurement that says what is stopping it")
    for name in sorted(set(declared) - walked):
        problems.append(
            f"INSTRUMENT_GATE_PY STALE {name} — declared unswept with a reason, and the walk "
            f"cannot find it. An exclusion outliving its subject is an exemption nobody has "
            f"re-argued (174 §5)")
    for name in sorted(swept & set(declared)):
        problems.append(
            f"INSTRUMENT_GATE_PY BOTH {name} — it is swept AND carries a reason for not "
            f"being swept. One of the two is wrong and this file cannot decide which")
    for name in sorted(swept - walked):
        problems.append(
            f"INSTRUMENT_GATE_PY OUTSIDE {name} — swept as a Python instrument and the walk "
            f"does not reach it, so the roster's coverage is checked in one direction only")
    return problems


def late_sweep(inst: dict, cmd: list[str], src: Path, axis: str) -> tuple[int, int, list[str]]:
    """(#undeclared-green, #targets swept, problems). Source restored whatever happens."""
    original = src.read_text()
    problems: list[str] = []
    green_undeclared: list[str] = []
    marker = late_marker(cmd, inst["name"], axis)
    print(f"\n-- {inst['name']} [{axis}] — late blind · {' '.join(cmd)}")
    try:
        ok, reached, _c, _h, _f = run_counting(cmd, inst["cwd"], marker)
        if not ok:
            return (0, 0, [
                f"{inst['name']} [{axis}]: CONTROL FAILED — the unmutated gate does not pass "
                f"under `{' '.join(cmd)}`, so every late-blind result below is meaningless"
            ])
        # 🔴 197 §5's CONTROL ASSERTION, ON THE AXIS IT DID NOT REACH. The marker is proved
        # HERE, on a healthy tree, before a single mutant — because every "caught" and
        # "crashed" judgement below rests on that one string, and a marker that stopped
        # being printed would silently reclassify the whole axis. 197 §5 caught a real
        # defect this way on its first CI run; this is the same assertion, one axis over.
        if not reached:
            return (0, 0, [
                f"{inst['name']} [{axis}]: the UNMUTATED gate passes under "
                f"`{' '.join(cmd)}` WITHOUT printing {marker!r}. Every crash/catch call "
                f"below would rest on that string, so fix the marker before believing any "
                f"of them — a marker proved only on the class it was chosen from is 197 §35"
            ])
        na = 0
        lang = lang_of(src)
        for sig, empty in inst["targets"].items():
            anchor, sig_problem = resolve_target(inst["name"], original, sig, lang)
            if sig_problem:
                problems.append(f"{inst['name']} [{axis}]: {sig_problem}")
                continue
            mutant = late(original, anchor, empty, lang)
            if mutant is None:
                problems.append(
                    f"{inst['name']} [{axis}]: SIGNATURE NOT FOUND {sig!r} for the late blind"
                )
                continue
            src.write_text(mutant)
            # 🆕 212 §4 — AND ON THIS AXIS TOO, ABOVE THE `not hook` BRANCH. A mutant that
            # does not parse never loads, so it lands in LATE_NOT_LOADED — a bucket with a
            # CEILING, which quietly absorbs a broken injector as though it were a target
            # the harness could not construct. Those are different failures and only one
            # of them is about the instrument.
            syntax = parses(src)
            if syntax:
                problems.append(
                    f"{inst['name']} [{axis}]: the late mutant for {sig!r} DOES NOT PARSE "
                    f"— {syntax}. Without this it is filed as NEVER LOADED, under a "
                    f"ceiling, and reads as a harness limitation rather than a defect")
                print(f"   🔴 UNPARSEABLE {sig[:52]}")
                continue
            green, reached, calls, hook, fails = run_counting(cmd, inst["cwd"], marker)
            declared = LATE_DECLARED_GREEN.get((inst["name"], sig, axis))
            # 🔴 THE HOOK BEFORE THE COUNT. `calls == 0` and "the hook never printed" were
            # ONE bucket until now, and the second of them is a mutant that never ran.
            if not hook:
                # 🆕 257 — DECLARED-NOT-CALLED, and only ever AFTER `parses()` above has
                # cleared the mutant. A row in `LATE_NOT_CALLED` says this member belongs
                # to a command this axis does not run; anything undeclared still lands in
                # `LATE_NOT_LOADED`, whose ceiling is and stays ZERO.
                why = LATE_NOT_CALLED.get((inst["name"], sig, axis))
                if why:
                    print(f"   not-called   {sig[:52]}  — {why[:60]}")
                    na += 1
                    continue
                LATE_NOT_LOADED.append((inst["name"], sig, axis))
                print(f"   🔴 NEVER LOADED {sig[:52]}")
                continue
            if calls <= 1:
                # 🔴 NOT "defended" — NOT CONSTRUCTIBLE. The guard never fired, so the run
                # is the control. Re-measured every time: a target called once today and
                # twice tomorrow moves out of this bucket on the commit that changes it.
                na += 1
                continue
            LATE_CONSTRUCTED.append(f"{inst['name']}[{axis}]::{sig[:40]}")
            LATE_BLAST_OBSERVED[(inst["name"], axis)] = (
                LATE_BLAST_OBSERVED.get((inst["name"], axis), 0) + fails)
            # 🔴 RED WITHOUT A VERDICT IS NOT A CATCH, AND UNTIL NOW IT WAS COUNTED AS ONE.
            # Filed to its axis's roster and taken OUT of the catch/green judgement below:
            # a crash is not evidence the gate's floor bites, and it is not evidence a
            # `LATE_DECLARED_GREEN` reason has expired either.
            if not green and not reached:
                (LATE_CRASHED_A if axis == "A:gate" else LATE_CRASHED_B).append(
                    (inst["name"], sig))
                key = (inst["name"], sig)
                known = key in (CRASH_DECLARED if axis == "A:gate" else LATE_CRASH_DECLARED_B)
                print(f"   {'declared-crash' if known else '🔴 CRASHED    '} "
                      f"{sig[:48]}  calls={calls} fails={fails}")
                continue
            if green and declared is None:
                green_undeclared.append(f"{sig}  (called {calls}x)")
                print(f"   🔴 STILL GREEN {sig[:58]}  calls={calls}")
            elif green:
                print(f"   declared-green {sig[:52]}  calls={calls}")
            elif declared is not None:
                # 🔴 A DECLARED EXEMPTION THAT STARTS REDDENING IS A STRUCTURE CHANGE, AND
                # SILENCE HERE WOULD BE THE EXEMPTION OUTLIVING ITS REASON (174 §5).
                problems.append(
                    f"{inst['name']} [{axis}]: `{sig}` is DECLARED GREEN and now REDDENS. The "
                    f"reason on file no longer holds — re-read it and delete the declaration: {declared}"
                )
            else:
                print(f"   ok            {sig[:48]}  calls={calls} fails={fails}")
        print(f"   ({na} target(s) called once — a late blind is not constructible there)")
        return (len(green_undeclared), len(inst["targets"]), problems + [
            f"{inst['name']} [{axis}]: `{s}` can answer ONCE and return its empty for every "
            f"call after that, and the gate stays GREEN — the population above it was floored "
            f"before the collapse and nothing re-reads it ({inst['why']})"
            for s in green_undeclared
        ])
    finally:
        src.write_text(original)


def scope_collapsed(n_instruments: int, floor: int) -> bool:
    """The gate's own scope check, as a PURE function of its two numbers.

    🔴 EXTRACTED BECAUSE 176's REVERSE SWEEP FOUND THE FLOOR UNFALSIFIABLE. Setting
    `INSTRUMENT_FLOOR = 0` left this gate entirely GREEN: seven instruments is not fewer
    than zero, and nothing anywhere asserted what the floor was supposed to BE. A literal
    read by one branch and asserted by nothing is a literal anyone can move — which is
    175's G9 (`SUBJECT_FLOOR`) and 176's G11 (the verdict self-test's claim floor), the
    same defect three times in three files, each of them a collapse detector.

    Pinning the value would be circular. Asserting that the BRANCH BITES is not: an
    emptied INSTRUMENTS list must be a collapse whatever the floor says, and with the
    floor at 0 it is not, so the self-check below goes red on exactly the mutant.
    """
    return n_instruments < floor


def _self_check(floor: int) -> list[str]:
    """Run before the sweep. A harness whose own collapse detector is off is not a harness."""
    problems = []
    # 🆕 203 §4 — THE CALL WIRING, FIRST. Every fixture below proves a predicate WORKS;
    # none of them proves this gate still CALLS it, and on a green tree no input can tell
    # those apart (202 §4). Defined after this function, so the lookup is deferred.
    problems.extend(_call_wiring_problems())

    # 🆕 235 §4 — THE THIRD ANCHOR SHAPE, AND THE TWO THINGS THE WIDENING MUST NOT DO.
    # `_decl_span` reaches a declaration whose parameter list wraps; the risk of any
    # widening is that it MOVES an anchor that already resolved, or admits something that
    # is not a declaration at all. Both are asserted on the live tree rather than on a
    # fixture, because both were found on the live tree: the probe measured 92/92 targets
    # byte-identical across this change, and the `for (` header in `tautology_gate.mjs`
    # is the thing a keyword guard exists for.
    for kw in ("for", "if", "while", "switch"):
        if _decl_span("  " + kw + " (a,\n       b) {\n", kw):
            problems.append(
                f"`_decl_span` resolved the keyword `{kw}` as a declaration. A widening "
                f"that admits a loop header would blind a statement into somebody's "
                f"iteration — measured: `tautology_gate.mjs` has exactly this shape")
    # a single-line declaration must NEVER reach the wrapped path — that is what keeps
    # the widening from re-pointing the 91 anchors that already resolved
    _one_line = "export function f(a, b) {\n  return a;\n}\n"
    if _decl_span(_one_line, "f"):
        problems.append(
            "`_decl_span` matched a single-line declaration. It is consulted only where "
            "`_decl_re` and `_concise_re` find nothing, and a shape that reaches both "
            "would make the resolution order load-bearing")
    if not scope_collapsed(0, floor):
        problems.append(
            f"INSTRUMENT_GATE's own floor is {floor}, which does not treat an EMPTY instrument "
            f"list as a collapse. A gate that would sweep nothing and exit 0 is the exact "
            f"shape this file exists to catch, one level up"
        )
    if scope_collapsed(len(INSTRUMENTS), floor):
        problems.append(
            f"INSTRUMENT_GATE's floor is {floor} but only {len(INSTRUMENTS)} instrument(s) are "
            f"listed — raise the list or lower the literal ON PURPOSE"
        )
    # 🆕 182. THE LATE AXIS'S OWN FLOOR, PINNED THE SAME WAY AND FOR THE SAME REASON.
    # `LATE_CONSTRUCTED_FLOOR = 0` would re-permit an injector that injects nothing, in
    # silence — 181 §7's six unpinned floors, in the code written this session. Asserting
    # the VALUE would be circular; asserting that it can still BITE is not.
    if not LATE_CONSTRUCTED_FLOOR > 0:
        problems.append(
            f"LATE_CONSTRUCTED_FLOOR is {LATE_CONSTRUCTED_FLOOR}, which cannot treat an axis that "
            f"built ZERO late blinds as a collapse. That is the second axis switched off with one "
            f"digit, and every line it prints would still say ok"
        )
    # 🆕 183. THE LIVE-AXIS ROSTER'S FLOOR, PINNED BY ASSERTING ITS BRANCH BITES ON AN
    # EMPTY ROSTER. Same shape as the two above and for the same reason: a floor of 0
    # would let every `B:live` entry be deleted in silence, and the A:gate axis alone
    # produced exactly one green in 51 — so the axis that finds things would be gone and
    # every line would still read ok.
    if not len(LATE_LIVE) >= LATE_LIVE_FLOOR or LATE_LIVE_FLOOR <= 0:
        problems.append(
            f"LATE_LIVE holds {len(LATE_LIVE)} live axis(es), floor is {LATE_LIVE_FLOOR} — the "
            f"axis that found every 182 defect is the live one, and a roster that shrank takes "
            f"its instruments back to the self-test without changing a single printed line"
        )

    # 🆕 195. THE THIRD FLOOR, PINNED THE SAME WAY AS THE TWO ABOVE AND FOR THE SAME
    # REASON — `floor_pin_gate.py` exempts it BY NAME on the promise that this line
    # exists, and an exemption whose reason is not true is 174 §5 in the file that keeps
    # citing it. Asserting the VALUE would be circular; asserting the branch can still
    # BITE is not.
    if not SIG_RESOLVED_FLOOR > 0:
        problems.append(
            f"SIG_RESOLVED_FLOOR is {SIG_RESOLVED_FLOOR}, which cannot treat a roster where EVERY "
            f"anchor went back to a literal signature as a collapse — and that roster passes every "
            f"other line in this file, because a literal anchor resolves to itself and blinds "
            f"exactly what it names. It is only wrong one parameter later"
        )

    # ── 🔴 197 §5's DETECTORS, FIXTURE-FED (195 §8.4's shape, applied on the way in) ──
    # Every one of these returns empty on a healthy tree, so every one of them deletes
    # invisibly without a fixture underneath it. `CRASH_CEILING` is asserted to BITE
    # rather than pinned to its value, for the same reason the floors above are.
    _k = ("i", "s")
    if crash_problems([], {}, 1):
        problems.append("crash_problems flags a healthy sweep")
    if not crash_problems([_k], {}, 1):
        problems.append(
            "crash_problems does NOT flag an UNDECLARED crash — a blind that kills the gate "
            "instead of failing it would read exactly like a catch, which is 181 §4")
    if not crash_problems([], {_k: "why"}, 1):
        problems.append(
            "crash_problems does NOT flag a declaration that stopped crashing — an exemption "
            "outliving its reason is 174 §5")
    if not crash_problems([_k, ("i", "s2")], {_k: "w", ("i", "s2"): "w"}, 1):
        problems.append(
            "crash_problems does NOT enforce CRASH_CEILING — the roster could then grow one "
            "declared entry at a time and never be read as growing")
    # ── 🆕 198 §3's DETECTORS, FED THE SAME WAY AND FOR THE SAME REASON ──────────────
    # All three are empty on a healthy tree. `LATE_NOT_LOADED` is empty by MEASUREMENT
    # rather than by construction — 118 mutant runs across both axes all produced a hook
    # line — so it is a regression backstop with no live row to keep it honest, which is
    # precisely the state 197 §3's hole was in for twenty-five commits.
    if not_loaded_problems([], 0):
        problems.append("not_loaded_problems flags a healthy sweep")
    if not not_loaded_problems([("i", "s", "A:gate")], 0):
        problems.append(
            "not_loaded_problems does NOT flag a mutant that never loaded — a late blind "
            "that fails to parse reports calls=0 and is filed 'not constructible', which "
            "reads as a target nobody calls twice (197 §3, on the other axis)")
    # 🆕 257 — the not-called table is an EXEMPTION, so the thing worth asserting is that
    # it cannot be emptied of its reasons and keep working. A row whose reason is blank
    # would read as declared while saying nothing, which is the shape 174 §5 refuses.
    for _key, _why in LATE_NOT_CALLED.items():
        if not isinstance(_why, str) or len(_why.strip()) < 40:
            problems.append(
                f"LATE_NOT_CALLED{_key} carries no reason a reader could act on. An "
                f"exemption without one is 'not done yet' wearing a table row — and this "
                f"table's whole claim is that the silence is by construction")
    if set(LATE_NOT_CALLED) & set(LATE_DECLARED_GREEN):
        problems.append(
            "a target is in BOTH LATE_NOT_CALLED and LATE_DECLARED_GREEN — the first says "
            "the axis never calls it and the second says the axis called it and stayed "
            "green. Both cannot be true, and whichever is stale is now invisible")
    _LIVE = {"x": (["node", "a.mjs"], None)}
    if late_marker_roster_problems(_LIVE, {"node a.mjs": "M"}):
        problems.append("late_marker_roster_problems flags a complete roster")
    if not late_marker_roster_problems(_LIVE, {}):
        problems.append(
            "late_marker_roster_problems does NOT flag a live command with no marker — its "
            "runs would all be filed crashes, which is 197 §5's defect with the sign flipped")
    if not late_marker_roster_problems({}, {"node gone.mjs": "M"}):
        problems.append(
            "late_marker_roster_problems does NOT flag a marker for a command nobody runs")
    # 🔴 AND THE KEY ITSELF. Three instruments share one live caller, so a roster keyed by
    # INSTRUMENT would hold the same string three times — this asserts the join, because a
    # future edit to `LATE_LIVE`'s shape would otherwise silently make every lookup miss
    # and every red on the live axis a crash.
    if late_marker_roster_problems(
            {"a": (["node", "s.mjs"], None), "b": (["node", "s.mjs"], None)},
            {"node s.mjs": "M"}):
        problems.append(
            "late_marker_roster_problems does not treat two instruments sharing ONE live "
            "command as one roster entry — the key is the command, not the instrument")
    # 🆕 233 — `late_na_ci_problems`, DRIVEN FROM BOTH SIDES AND FROM THE FLOOR.
    _NA_INST = [{"name": "x.mjs", "src": Path("/r/scripts/x.mjs"),
                 "gate": ["node", "scripts/x.selftest.mjs"]}]
    _NA_CI = {"node scripts/x.selftest.mjs", "node scripts/a.mjs", "node scripts/b.mjs",
              "node scripts/c.mjs", "node scripts/d.mjs", "node scripts/e.mjs",
              "node scripts/f.mjs", "node scripts/g.mjs"}
    if late_na_ci_problems({"x.mjs": "why"}, _NA_INST, _NA_CI, floor=8):
        problems.append(
            "late_na_ci_problems flags an NA row whose instrument CI runs only the GATE "
            "for — the self-test is the gate, not a second command, and calling it one "
            "would empty LATE_LIVE_NA of rows that are true")
    if not late_na_ci_problems({"x.mjs": "why"}, _NA_INST,
                               _NA_CI | {"node scripts/x.mjs"}, floor=8):
        problems.append(
            "late_na_ci_problems does NOT flag an NA row for a file ci.yml runs a second "
            "command over — which is the whole of 233 §5.1: three rows said no such "
            "command existed while CI ran it on every push")
    if not late_na_ci_problems({"gone.mjs": "why"}, _NA_INST, _NA_CI, floor=8):
        problems.append(
            "late_na_ci_problems does NOT flag an NA row naming something that is not an "
            "instrument — an exclusion outliving its subject (174 §5)")
    if not late_na_ci_problems({}, _NA_INST, set(), floor=8):
        problems.append(
            "late_na_ci_problems passes over an EMPTY ci.yml read — a reader that stopped "
            "matching checks every row against nothing and reports no problem, which is "
            "this file's own U1 (172 §10.21)")
    # 🆕 277 §2 — AND THE COMPARISON ITSELF, which was string equality on a line ci.yml
    # writes with a tee and from two working directories. Both spellings of the gate must
    # read as the gate; anything else and an instrument's own step comes back as evidence
    # against it.
    if late_na_ci_problems({"x.mjs": "why"}, _NA_INST,
                           _NA_CI | {'node scripts/x.selftest.mjs 2>&1 | tee -a "$L"'},
                           floor=8):
        problems.append(
            "late_na_ci_problems reads a TEED gate step as a second command — 274 tees "
            "nineteen steps into the capture log, so `!=` on the raw line makes an "
            "instrument's own gate evidence that it has a live axis")
    if late_na_ci_problems(
            {"x.mjs": "why"},
            [{"name": "x.mjs", "src": Path("/r/scripts/x.mjs"),
              "gate": ["node", "../scripts/x.selftest.mjs"]}], _NA_CI, floor=8):
        problems.append(
            "late_na_ci_problems reads the SAME script from a different working directory "
            "as a second command — ci.yml runs steps from the repo root and from host/, "
            "and `../scripts/x` is not a different file from `scripts/x`")
    # 🆕 277 §2 — the cost table: named, priced, and refused in all four directions.
    _C_LIVE = {"x.mjs": (["node", "scripts/x.mjs"], None)}
    if late_live_cost_problems({"x.mjs": ("node scripts/x.mjs", 172)}, _NA_INST,
                               _NA_CI | {"node scripts/x.mjs"}, {}, {}, {}, budget=20):
        problems.append(
            "late_live_cost_problems flags a row that names a command CI really runs, at "
            "a price over the budget — which is the only shape this table is FOR")
    if not late_live_cost_problems({"x.mjs": ("node scripts/x.mjs", 172)}, _NA_INST,
                                   _NA_CI, {}, {}, {}, budget=20):
        problems.append(
            "late_live_cost_problems does NOT flag a row priced against a command ci.yml "
            "never runs — an axis that was never available is a LATE_LIVE_NA row, and "
            "buying it with a price hides which of the two sentences is true")
    if not late_live_cost_problems({"x.mjs": ("node scripts/x.mjs", 9)}, _NA_INST,
                                   _NA_CI | {"node scripts/x.mjs"}, {}, {}, {}, budget=20):
        problems.append(
            "late_live_cost_problems does NOT flag a row whose declared price is UNDER "
            "the budget — at that price the axis is owed, and a cheap exemption is the "
            "reason outliving the fact with the fact printed beside it (174 §5)")
    if not late_live_cost_problems({"x.mjs": ("node scripts/x.mjs", 172)}, _NA_INST,
                                   _NA_CI | {"node scripts/x.mjs"}, _C_LIVE, {}, {},
                                   budget=20):
        problems.append(
            "late_live_cost_problems does NOT flag an instrument that is in LATE_LIVE and "
            "in the cost table at once — two tables answering one question (180 §7.1)")
    if not late_live_cost_problems({"gone.mjs": ("node scripts/gone.mjs", 172)}, _NA_INST,
                                   _NA_CI, {}, {}, {}, budget=20):
        problems.append(
            "late_live_cost_problems does NOT flag a cost row naming something that is "
            "not an instrument — an exclusion outliving its subject (174 §5)")
    if LATE_LIVE_COST_BUDGET <= 0:
        problems.append(
            f"LATE_LIVE_COST_BUDGET is {LATE_LIVE_COST_BUDGET}. A budget at zero admits "
            f"every price, which is the cost table degenerating into a prose excuse")
    problems.extend(late_live_cost_problems(
        LATE_LIVE_COST, INSTRUMENTS,
        ci_node_commands(CI_YML.read_text(encoding="utf-8")) if CI_YML.exists() else set(),
        LATE_LIVE, LATE_LIVE_NA, LATE_LIVE_LOCKED))
    # 🔴 AND THE FLOOR ITSELF, which a zero would make unable to bite (198 §36's rule
    # applied to the guard rather than to the population).
    if CI_COMMAND_FLOOR <= 0:
        problems.append(
            f"CI_COMMAND_FLOOR is {CI_COMMAND_FLOOR}. A floor at zero cannot bite, and the "
            f"only symptom is an NA roster that stops being checked")
    # 🔴 AND THE READER OVER THE REAL FILE — a regex proved on a fixture is not a regex
    # proved to match ci.yml's actual indentation (202 §9.4's argument, one layer out).
    if CI_YML.exists() and len(ci_node_commands(CI_YML.read_text(encoding="utf-8"))) < CI_COMMAND_FLOOR:
        problems.append(
            "CI_RUN_RE reads fewer node steps out of the LIVE ci.yml than the floor — the "
            "fixtures above prove the predicate, this proves it against the file it ships "
            "against")
    # 🆕 245 §3 — the B:live twin, held to the same rule. A floor at zero on the axis
    # 244 §4.4 showed was uncountable would be the old exclusion wearing a number.
    for _name, _v in list(LATE_BLAST_FLOOR.items()) + list(LATE_LIVE_BLAST_FLOOR.items()):
        if _v <= 0:
            problems.append(
                f"LATE_BLAST_FLOOR[{_name!r}] is {_v}. A floor at zero cannot bite, and this "
                f"dict is invisible to floor_pin_gate.py's discovery half for the same reason "
                f"BLAST_FLOOR is")
    if marker_roster_problems([{"name": "i"}], {"i": "M"}):
        problems.append("marker_roster_problems flags a complete roster")
    if not marker_roster_problems([{"name": "i"}], {}):
        problems.append(
            "marker_roster_problems does NOT flag an instrument with no VERDICT_MARKER — "
            "without one every red run over it is unclassifiable again")
    if not marker_roster_problems([], {"gone": "M"}):
        problems.append("marker_roster_problems does NOT flag a marker with no instrument")
    # The failure reader must COUNT, and must not INVENT. Three dialects, one fixture each,
    # plus the clean case — a reader that counts noise makes every blast floor unfalsifiable.
    if failure_lines("  FAIL SOME_MARKER a claim\n") != 1:
        problems.append("failure_lines does not read the marker dialect")
    if failure_lines("🔴 FAILED: a claim did not hold\n") != 1:
        problems.append("failure_lines does not read the prose dialect")
    if failure_lines("ℹ fail 3\n") != 3:
        problems.append("failure_lines does not read the node:test SPEC dialect")
    if failure_lines("# fail 3\n") != 3:
        problems.append(
            "failure_lines does not read the node:test TAP dialect — which is the one CI "
            "gets, because node picks its reporter by whether stdout is a TTY (197 §5)")
    # 🆕 277 §2 — the fourth dialect, both directions. The zero case matters more than
    # the count: a verdict line reading `0 failed` is what a HEALTHY control prints, and a
    # reader that counted it as one failure would make every control run look caught.
    if failure_lines("HANDOFF_SELFTEST 379/385 claims, 6 failed\n") != 6:
        problems.append(
            "failure_lines does not read the COUNTED handoff dialect — the instrument "
            "that reports this way measured a blast of zero across fifty-seven reddening "
            "blinds until this reader existed (277 §2)")
    if failure_lines("HANDOFF_SELFTEST 385/385 claims, 0 failed\n"):
        problems.append(
            "failure_lines counts a failure in the handoff dialect's HEALTHY verdict — "
            "every control run would read as caught")
    # 🆕 278 §4 — THE FIFTH DIALECT, ASSERTED THE SAME WAY AND FOR THE SAME REASON.
    if failure_lines("\n  66 rows · 36 REFUSE · 34 distinct code(s) · 🔴 13 DISAGREE\n") != 13:
        problems.append(
            "failure_lines does not read the COUNTED release-names dialect — the "
            "instrument that reports this way measured a blast of zero across ten "
            "reddening blinds until this reader existed (278 §4)")
    if failure_lines("\n  66 rows · 36 REFUSE · 34 distinct code(s) · 🟢 all agree\n"):
        problems.append(
            "failure_lines counts a failure in the release-names dialect's HEALTHY "
            "verdict — every control run would read as caught")
    # 🆕 278 §4 — THE SIXTH DIALECT, AND THE HEALTHY DIRECTION MATTERS MORE HERE THAN
    # ANYWHERE ELSE IN THIS LIST: this is the house refusal spelling, so a reader that
    # matched the GREEN header of the same commands would count a failure on every clean
    # run and make every blast floor unfalsifiable from below.
    if failure_lines("🔴 RELEASE_NAMES REFUSED [C4_ADDON_UNFINDABLE]: nope\n") != 1:
        problems.append(
            "failure_lines does not read the house REFUSED dialect — the instrument that "
            "reports this way measured a blast of zero across four caught blinds, and "
            "BLAST_UNREADABLE is what said so (278 §4)")
    if failure_lines("RELEASE_NAMES --assert-addon  ·  addon 1.12.0 · stamped abc\n"):
        problems.append(
            "failure_lines counts a failure in the house dialect's HEALTHY header — every "
            "clean run of those commands would read as caught")
    if failure_lines("everything is fine\n  ok   NOT_A_FAILURE\n"):
        problems.append(
            "failure_lines counts a failure in clean output — the blast floors would then be "
            "met by noise and could never fall")
    # 🔴 AND THE PER-INSTRUMENT FLOORS THEMSELVES. `floor_pin_gate.py` exempts `BLAST_FLOOR`
    # BY NAME on the promise that this line exists — its DISCOVER regexes read literals and
    # this is a dict, so nothing outside this file can see these values at all. A zero here
    # is a floor that cannot bite, which is 176's G11 in a mapping instead of a constant.
    for _name, _v in BLAST_FLOOR.items():
        if _v <= 0:
            problems.append(
                f"BLAST_FLOOR[{_name!r}] is {_v}. A floor at zero cannot bite, and this dict is "
                f"invisible to floor_pin_gate.py's discovery half — this assertion is the only "
                f"thing standing between it and being quietly zeroed one instrument at a time")

    # ── 🆕 195. `{SIG:}`'s OWN THREE BRANCHES, EACH FED AN INPUT IT MUST ANSWER ──────
    #
    # 🔴 EVERY ONE OF THESE IS EMPTY ON A HEALTHY TREE, WHICH IS WHY THEY ARE HERE AND
    # NOT INLINE. 59 targets resolve, none is ambiguous, none is missing, and no literal
    # survives — so `resolve_sig`'s two failure branches and every line of
    # `literal_signature_problems` are unexecuted by the live run, and deleting any of
    # them is invisible to it. That is control_gate's reasoning for lifting its three
    # detectors out (188), arriving one file over: a branch that cannot be reached by the
    # tree has to be reached by a fixture, or the sweep is entitled to declare it green.
    ONE = "export function f(a, b = X) {\n  return 1;\n}\n"
    TWO = "class K {\n  f(a) {\n    return 1;\n  }\n}\nexport function f(a) {\n  return 2;\n}\n"

    anchor, problem = resolve_sig(ONE, "{SIG:f}")
    if anchor != "export function f(a, b = X) {" or problem:
        problems.append(
            f"resolve_sig does not resolve a UNIQUE declaration: {anchor!r} / {problem!r}. "
            f"Every target in this file is a placeholder, so a resolver that stopped "
            f"resolving takes the whole sweep with it"
        )
    if not resolve_sig("export function g(a) {\n}\n", "{SIG:f}")[1]:
        problems.append(
            "resolve_sig accepts a name with NO declaration — the one thing the literal "
            "anchors were keeping (removing the function is caught) would be gone, and "
            "every target below would report on a mutation nobody made"
        )
    if not resolve_sig(TWO, "{SIG:f}")[1]:
        problems.append(
            "resolve_sig accepts an AMBIGUOUS name — it would pick one of two declarations "
            "and blind the wrong member silently, which is exactly the case 193 §12.27 "
            "refused to let a loosened anchor decide"
        )
    # 🔴 THE BRANCH WITH NO LIVE POPULATION AT ALL, AND IT GETS A FIXTURE FOR EXACTLY THAT
    # REASON (179 §9's argument about floors, applied to an injector's reach). Every member
    # in the roster sits at column 0 or at two spaces, so the refusal below is never
    # executed by the tree — and a resolver that handed `blind()` an anchor it cannot find
    # would report SIGNATURE NOT FOUND, which reads like a renamed function rather than
    # like an injector that does not reach that far.
    FOUR = "class K {\n    f(a) {\n      return 1;\n    }\n}\n"
    if not resolve_sig(FOUR, "{SIG:f}")[1]:
        problems.append(
            "resolve_sig accepts a member `blind()` cannot reach — it looks for exactly two "
            "spaces of indent, and an anchor resolved past that limit fails as a MISSING "
            "signature, which is a different diagnosis from the true one"
        )
    if resolve_sig(ONE, "export function f(a, b = X) {") != ("export function f(a, b = X) {", ""):
        problems.append(
            "resolve_sig does not pass a LITERAL anchor through unchanged — an ambiguous "
            "name has no other way to be anchored, and refusing the escape hatch would "
            "force the loosened match this build exists to avoid"
        )

    lit, read = literal_signature_problems("fixture", ONE, ["export function f(a, b = X) {"])
    if not lit:
        problems.append(
            "literal_signature_problems does NOT flag a literal that {SIG:} resolves to "
            "exactly — the next author spells out a signature, the row works today, and "
            "the re-point comes back one parameter later"
        )
    if read != 1:
        problems.append(f"literal_signature_problems read {read} target(s) of 1 — the count is "
                        f"what pins the audit, since its problem list is empty on a healthy tree")
    if literal_signature_problems("fixture", ONE, ["{SIG:f}"])[0]:
        problems.append("literal_signature_problems flags a target that already uses the placeholder")
    if literal_signature_problems("fixture", TWO, ["export function f(a) {"])[0]:
        problems.append(
            "literal_signature_problems flags a literal whose name is AMBIGUOUS — that is "
            "the one case where the literal is the only correct anchor, and refusing it "
            "would leave no way to write the row at all"
        )

    for inst in INSTRUMENTS:
        src = Path(inst["src"])
        if not src.exists():
            continue
        lit, read = literal_signature_problems(inst["name"], src.read_text(), inst["targets"])
        problems.extend(lit)
        if read != len(inst["targets"]):
            problems.append(f"{inst['name']}: the literal audit read {read} of "
                            f"{len(inst['targets'])} target(s)")
    # ══ 🆕 232 — THE DISCOVER HALF, DRIVEN ON FIXTURES ═══════════════════════════════
    # 🔴 EVERY REFUSAL FROM BOTH SIDES, because a discovery half that cannot refuse is
    # the shape 231 §5.1 found in this very file: a green line over a population it was
    # not reading. The fixtures are a tree that does not exist, which is the only way to
    # drive `STALE_EXEMPT` and `OUTSIDE_STALE` at all (174 §8).
    _D_INST = [{"name": "i.mjs", "src": ROOT / "host" / "scripts" / "i.mjs",
                "gate": ["node", "scripts/i.selftest.mjs"], "cwd": HOST}]
    _D_GATES = {"host/scripts/i.selftest.mjs"}
    _D_OK = [("host/scripts/i.mjs", True),
             ("host/scripts/i.selftest.mjs", False),
             ("host/test-integration/probe.integration.mjs", False)]

    def _disc(files, exempt=None, outside=None, walk=1, mod=1):
        return discovery_problems(files, _D_INST, exempt or {}, outside or {},
                                  walk, mod, _D_GATES)[0]

    if _disc(_D_OK):
        problems.append(
            "INSTRUMENT_GATE_DISCOVER refused a healthy fixture — an instrument, its gate "
            "and an export-free probe. A discovery half that reds on the shape the tree "
            "actually has cannot be run, and one nobody runs refuses nothing")
    # 🔴 THE ONE THAT MATTERS — a module joins the tree and nobody writes it down.
    if not _disc(_D_OK + [("host/scripts/new.mjs", True)]):
        problems.append(
            "INSTRUMENT_GATE_DISCOVER stayed quiet over an export-bearing file that is "
            "neither an instrument, nor a gate, nor exempt — which is 231 §5.1 exactly, "
            "in the half written to end it")
    # 🔴 AND THE DISCRIMINATOR HAS TO DISCRIMINATE. The same new file exporting NOTHING is
    # an executable: there is no member to blind, so demanding a row for it would make the
    # table 36 rows of noise and 174 §5's argument says nobody would re-read one of them.
    if _disc(_D_OK + [("host/scripts/new.mjs", False)]):
        problems.append(
            "INSTRUMENT_GATE_DISCOVER demanded a row for a file that exports nothing — the "
            "rule would then be about file COUNT rather than about modules, and every probe "
            "and self-test in the tree would need an excuse")
    if not _disc(_D_OK, exempt={"host/scripts/gone.mjs": "why"}):
        problems.append("INSTRUMENT_GATE_DISCOVER kept an exemption for a file the walk cannot find")
    if not _disc(_D_OK, exempt={"host/scripts/i.mjs": "why"}):
        problems.append(
            "INSTRUMENT_GATE_DISCOVER accepted a file that is BOTH swept and excused from "
            "being swept — the two rows contradict and this gate must not pick one")
    # 🔴 THE FLOORS, AND THE COLLAPSE EACH ONE ALONE CANNOT SEE.
    if not _disc([], walk=1, mod=1):
        problems.append("INSTRUMENT_GATE_DISCOVER passed over an EMPTY walk")
    if not _disc([(p, False) for p, _ in _D_OK] * 4, walk=1, mod=1):
        problems.append(
            "INSTRUMENT_GATE_DISCOVER passed with 12 file(s) read and ZERO recognised as "
            "modules — the file floor is satisfied and the module reader is dead, which is "
            "the collapse the second floor exists for")
    # 🔴 231 §5.5's TRAP, IN THE FILE THAT RECORDED IT. `len(x) < 0` never fires, so a
    # floor at zero is a check that cannot refuse anything and reads green forever.
    for _label, _f in (("DISCOVER_FLOOR", DISCOVER_FLOOR),
                       ("DISCOVER_MODULE_FLOOR", DISCOVER_MODULE_FLOOR)):
        if not isinstance(_f, int) or _f <= 0:
            problems.append(
                f"{_label} is {_f!r} — a floor at or below zero refuses nothing, and the "
                f"comparison it is read by can never fire (231 §5.5, live in this file)")
    # 🔴 THE ROSTER'S OTHER DIRECTION — an instrument the walk cannot reach.
    if not _disc([("host/scripts/i.selftest.mjs", False)]):
        problems.append(
            "INSTRUMENT_GATE_DISCOVER stayed quiet about an instrument its own walk cannot "
            "reach and no row declares — the coverage question asked in one direction only")
    # 🔴 THE FIRST DRAFT OF THIS CASE PROVED THE WRONG REFUSAL — a walk holding only the
    # self-test has ZERO modules, so `MODULE_FLOOR` fired and the case would have passed
    # while saying nothing about out-of-walk rows at all. It carries an exempt module now,
    # so the only thing left to refuse is the thing under test.
    if _disc([("host/scripts/i.selftest.mjs", False), ("host/scripts/m.mjs", True)],
             exempt={"host/scripts/m.mjs": "a reason"}, outside={"i.mjs": "declared"}):
        problems.append("INSTRUMENT_GATE_DISCOVER refused a DECLARED out-of-walk instrument")
    if not _disc(_D_OK, outside={"i.mjs": "declared"}):
        problems.append(
            "INSTRUMENT_GATE_DISCOVER kept an out-of-walk reason for an instrument the walk "
            "now reaches — a reason outliving its fact")
    if not _disc(_D_OK, outside={"ghost.mjs": "declared"}):
        problems.append(
            "INSTRUMENT_GATE_DISCOVER kept an out-of-walk row for an instrument nothing sweeps")
    # 🔴 AND THE GATE SET IS DERIVED, NOT TYPED (198). Emptying the roster must empty it:
    # a hand-written set would keep excusing self-tests for instruments that no longer exist.
    if ("host/scripts/i.selftest.mjs" not in gate_scripts(_D_INST)
            or "host/scripts/i.selftest.mjs" in gate_scripts([])):
        problems.append(
            "gate_scripts() does not derive its answer from the roster it is handed — an "
            "exclusion that survives its own table is a roster nobody maintains (198)")

    # ══ 🆕 245 §1 — THE PYTHON HALF, DRIVEN FROM BOTH SIDES OVER A TREE THAT CANNOT EXIST
    #
    # 🔴 EVERY REFUSAL BELOW RETURNS EMPTY ON A HEALTHY TREE, which is the one state where
    # "this check passes" and "this check is switched off" look identical (174 §8, and this
    # file's own U1 three tables over). Fixtures, never the live population.
    _PY_ONE = (
        "import os\n"
        "\n"
        "def alpha(a,\n"
        "          b=2):\n"
        "    \"\"\"doc.\"\"\"\n"
        "    return a + b\n"
        "\n"
        "class K:\n"
        "    def beta(self):\n"
        "        return 1\n"
        "\n"
        "def alpha_two():\n"
        "    return 0\n"
    )
    _PY_TWO = _PY_ONE + "\ndef alpha(x):\n    return x\n"

    anchor, prob = py_resolve_sig(_PY_ONE, "{SIG:alpha}")
    if prob or not anchor.startswith("def alpha(a,") or not anchor.endswith("b=2):"):
        problems.append(
            f"py_resolve_sig does not resolve a WRAPPED declaration header: {anchor!r} / "
            f"{prob!r}. A `def` whose parameters run onto a second line is the case that "
            f"cost `_decl_span` a whole session on the JavaScript side")
    if not py_resolve_sig(_PY_ONE, "{SIG:gamma}")[1]:
        problems.append(
            "py_resolve_sig accepts a name that is DECLARED NOWHERE — EXISTENCE is half of "
            "what this anchor claims, and without it a renamed member is a silently skipped "
            "target reported as covered")
    if not py_resolve_sig(_PY_TWO, "{SIG:alpha}")[1]:
        problems.append(
            "py_resolve_sig accepts a name declared TWICE — UNIQUENESS is the other half, "
            "and a textual blind would rewrite whichever came first (193 §12.27)")
    if py_resolve_sig(_PY_ONE, "{SIG:alpha_two}")[1]:
        problems.append(
            "py_resolve_sig cannot resolve `alpha_two` beside `alpha` — the pattern is "
            "matching a PREFIX rather than a name, which is the loosening this anchor class "
            "exists to refuse")
    # the INDENT is read off the source, not computed: a method's body is not four spaces in
    _m_anchor, _m_prob = py_resolve_sig(_PY_ONE, "{SIG:beta}")
    _m = py_blind(_PY_ONE, _m_anchor, "return 99") if not _m_prob else None
    if _m is None or "\n        return 99  # INSTRUMENT_GATE" not in _m:
        problems.append(
            "py_blind does not indent an injection to the body it is entering — a guessed "
            "`header + 4` produces a mutant that does not PARSE, and this file would report "
            "that as a harness failure over a target it had silently stopped testing")
    for _label, _fn in (("py_blind", py_blind), ("py_late", py_late)):
        _mut = _fn(_PY_ONE, anchor, "return 99")
        if _mut is None:
            problems.append(f"{_label} could not apply a resolved anchor at all")
            continue
        try:
            compile(_mut, "<selfcheck>", "exec")
        except SyntaxError as _e:
            problems.append(
                f"{_label}'s mutant DOES NOT PARSE ({_e.msg}) — a mutant that never loads is "
                f"filed as NOT CONSTRUCTIBLE on the late axis, under a ceiling, and reads as "
                f"a harness limitation rather than as the injector being broken (212 §4)")
    _late_mut = py_late(_PY_ONE, anchor, "return 99")
    if _late_mut is None or LATE_MARK not in _late_mut or "_IG_CALLS > 1" not in _late_mut:
        problems.append(
            f"py_late's injection carries no {LATE_MARK} counter — `run_counting` reads that "
            f"line to tell 'called once' from 'the mutant never loaded', and without it "
            f"every Python late target lands in the second bucket in silence (197 §3)")
    # 🆕 247 §3 — 🔴 AND THE REGISTRATION IS AT MODULE SCOPE, WHICH IS THE CLAIM ITSELF.
    # A hook registered inside the member prints nothing when the member is never called,
    # and `not hook` is the branch that says NEVER LOADED — so an axis that simply does
    # not call a target reads as a mutant that did not compile. The two claims below are
    # the difference: the `atexit` register at column zero, the counter indented into the
    # body. A regression puts three of `queue_gate.py`'s targets back under a zero ceiling.
    if _late_mut is not None:
        # The register BLOCK's own first line, which is the one that decides its scope —
        # the `_igx.register` call sits inside an `if` and is indented either way, and
        # the first draft of this claim read that line and failed on a correct mutant.
        _reg = [ln for ln in _late_mut.split("\n") if "atexit as _igx" in ln]
        if not _reg or _reg[0] != PY_LATE_REGISTER[0]:
            problems.append(
                "py_late registers its exit handler INSIDE the member body — a target the "
                "axis never calls then produces no LATE_BLIND_CALLS line and is filed as "
                "NEVER LOADED, which is a claim about the mutant compiling and not about "
                "the instrument (247 §3)")
        if "\n    _igb._IG_CALLS = getattr" not in _late_mut:
            problems.append(
                "py_late's call counter is no longer indented into the member's body — a "
                "counter at module scope counts imports, not calls, and every late target "
                "would read as constructible on its first run")

    # ── 🆕 247 §1 — THE COVERAGE POPULATION, IN BOTH LANGUAGES ────────────────────────
    # 🔴 THE `.py` BRANCH IS THE ONE THAT DID NOT EXIST, and the `.mjs` branch is asserted
    # beside it because a language-aware reader that quietly answered `[]` for JavaScript
    # would print `0/0` over fourteen instruments exactly the way it did over three.
    _mem_dir = Path(tempfile.mkdtemp(prefix="ig_members_"))
    (_mem_dir / "m.py").write_text(_PY_ONE, encoding="utf-8")
    (_mem_dir / "m.mjs").write_text(
        "export function one() {}\nfunction two() {}\n"
        "export const three = () => 1;\n", encoding="utf-8")
    _py_members = members_of(_mem_dir / "m.py")
    if _py_members != ["alpha", "alpha_two"]:
        problems.append(
            f"members_of reads {_py_members!r} out of a Python module — it must be every "
            f"TOP-LEVEL `def` and only those: `beta` is a method, which no `{{SIG:}}` anchor "
            f"can address, and a population wider than the anchor names members no target "
            f"could ever cover")
    _js_members = members_of(_mem_dir / "m.mjs")
    if sorted(_js_members) != ["one", "three"]:
        problems.append(
            f"members_of reads {_js_members!r} out of an ES module — the exported callables "
            f"and not the module-private ones, which is 212 §4's population and must not "
            f"move when a second language is added beside it")

    # ── the Python DISCOVER roster, both directions ────────────────────────────────────
    _PI = [{"name": "a.py", "src": ROOT / "scripts" / "a.py"}]
    if not py_discovery_problems(["a.py", "b.py"], _PI, {}):
        problems.append(
            "py_discovery_problems accepts a tracked Python gate in NEITHER the roster nor "
            "PY_NOT_SWEPT — the whole point of this half is that a typed population cannot "
            "report what joined it (231 §5.1)")
    if py_discovery_problems(["a.py", "b.py"], _PI, {"b.py": "reason"}):
        problems.append(
            "py_discovery_problems refuses a tree where every file is swept or declared — "
            "the healthy direction has to pass or the refusals above prove nothing")
    if not py_discovery_problems(["a.py"], _PI, {"gone.py": "reason"}):
        problems.append(
            "py_discovery_problems keeps a PY_NOT_SWEPT row for a file the walk cannot find "
            "— an exclusion outliving its subject (174 §5)")
    if not py_discovery_problems(["a.py"], _PI, {"a.py": "reason"}):
        problems.append(
            "py_discovery_problems accepts a file that is swept AND excused at once")
    if not py_discovery_problems([], _PI, {}):
        problems.append(
            "py_discovery_problems reports NOTHING over an empty walk — a walk that stopped "
            "reaching the directory is the collapse this half has no floor for, and the "
            "roster is what floors it")

    # ── the locked-axis row, whose evidence is a call site and not a sentence ──────────
    if not late_locked_problems({"nosuchfile.py": "because"}, ROOT):
        problems.append(
            "late_locked_problems accepts a row naming a file that is not in scripts/")
    if not late_locked_problems({"p0_comments.py": "because"}, ROOT):
        problems.append(
            "late_locked_problems accepts a B:live exclusion for a file that never calls "
            "`acquire(` — the row's whole content is that the live command takes the "
            "mutation lock, and that is a fact about a call site rather than a sentence")
    if late_locked_problems({"mutation_lock_gate.py": "because"}, ROOT):
        problems.append(
            "late_locked_problems refuses the one file that really does take the lock — the "
            "healthy direction has to pass (174 §8)")

    return problems


# ── 🔴 197 §5 — THE VERDICT MARKER, WHICH IS 181 §4 ARRIVING HERE FIVE SESSIONS LATE ──
#
# `green()` was `p.returncode == 0`. It CAPTURED the gate's whole output and threw it away,
# so `red` had two causes and one observable: the gate CAUGHT the blind, or the blind
# CRASHED the gate. `scope_gate.py` fixed exactly this in 181 with `REPORT_MARKER`, and
# `control_gate.py` carries it as `executed`; this file never got it. Measured over the 59
# blinds: 727 failure lines nothing read, and NINE blinds that went red without the gate
# ever reaching its own verdict — eight uncaught `TypeError`s and one file that did not
# parse (§5's `judge`).
#
# 🔴 A DECLARED MARKER, ASSERTED ON THE CONTROL, RATHER THAN A DERIVED ONE. There are three
# report dialects among these nine instruments and a reader that guesses which one an
# instrument speaks is a reader that can be wrong — 196 §4's hedge. Declaring it costs one
# string per instrument and the CONTROL run, which happens every sweep, is what proves the
# string is right: a marker that stopped appearing on a HEALTHY run is caught before a
# single mutant is applied.
VERDICT_MARKER: dict[str, str] = {
    # 🆕 245 §1 — THE THREE PYTHON SELF-TESTS. Every one is the FIRST line its command
    # prints and is emitted before any verdict branch, which is 233's draft-3 rule: it
    # survives the red path (draft 2's failure) and is absent from a Python traceback
    # (draft 1's failure). Chosen by RUNNING each command red, never by reading a
    # neighbour — 244 §4.3 is what that costs when it is not.
    "p0_comments.py": "P0_COMMENTS_SELFTEST_DONE",
    "queue_gate.py": "QUEUE_SELFTEST ",
    "mutation_lock_gate.py": "MUTATION_LOCK_SELFTEST_DONE",
    # 🆕 247 §2 — same rule, same reason: `TERMINOLOGY selftest` is this file's FIRST
    # line, so the marker had to be a new one that only the end of the run prints.
    "terminology_gate.py": "TERMINOLOGY_SELFTEST_DONE",
    # 🆕 277 §2 — and this one needed no new line, because `HANDOFF_SELFTEST <n>/<n>
    # claims` is already a COUNTER_READERS `extract` (236): printed once, last, on the
    # red path and the green one alike. A marker that is also a counter is the strongest
    # shape available — a rename breaks the roster join before it breaks this sweep.
    "handoff_gate.py": "HANDOFF_SELFTEST ",
    # 🆕 278 §4 — same rule, same reason, and 277's row above is the precedent: a marker
    # that is ALSO a counter is the strongest shape available, because a rename breaks the
    # roster join before it breaks this sweep. `<rows> rows · <n> REFUSE · <n> distinct
    # code(s) · …` is printed ONCE, LAST, before either early `return 1`, and on the red
    # path and the green one alike — the `🟢 all agree` / `🔴 n DISAGREE` tail is on that
    # same line. Chosen by RUNNING the command red (245's rule), not by reading a
    # neighbour: the substring is the part BEFORE the verdict tail, so it survives both.
    "release_names.py": " distinct code(s) · ",
    # 🆕 278 §4 — the second entry's gate command. `RELEASE_NAMES ` is the substring its
    # THREE report paths share: the green header, the `🔴 RELEASE_NAMES REFUSED [code]`
    # on stderr, and the short-bag refusal this session added, which prints BEFORE the
    # header and would have been classified a crash by any marker taken from it.
    "release_names.py (--assert-addon)": "RELEASE_NAMES ",
    "_population.mjs": "POP_SELFTEST",
    "_path_ledger.mjs": "LEDGER_SELFTEST",
    "_workspace.mjs": "WORKSPACE_SELFTEST",
    "_png.mjs": "PNG_SELFTEST",
    "tautology_gate.mjs": "TAUT_SELFTEST",
    "verdict_gate.mjs": "VERDICT_SELFTEST",
    "boundary_gate.mjs": "BOUNDARY_SELFTEST",
    "seal_order_gate.mjs": "SEAL_ORDER_SELFTEST",
    # node:test prints its own summary; `ℹ fail <n>` is the line that only exists when the
    # runner reached the end of the run.
    "path-cohort (compiled walk)": "ℹ fail ",
    # 🆕 244 §4 — BOTH P0 SELF-TESTS ARE `node:test` RUNS, so the marker is the runner's
    # own summary line for the same reason `path-cohort` uses it: `ℹ fail <n>` exists only
    # when the run REACHED the end, and it is printed on the red path as well as the green
    # one — which is the property 209's row settled and 232's re-derived.
    # 🔴 AND THE SPELLING IS `# fail `, NOT THE `ℹ fail ` ONE ROW UP, WHICH THE FIRST DRAFT
    # COPIED FROM IT. `ℹ` is `node --test`'s reporter; a self-test invoked as `node
    # file.mjs` prints `# fail <n>`. Both rows are node:test and the two invocations
    # disagree about the glyph — a marker chosen by reading a neighbour rather than by
    # running the command is 197 §35, and this gate refused it on the first sweep.
    "p0_complexity.mjs": "# fail ",
    "p0_testdup.mjs": "# fail ",
    # 🆕 209 — check 8's classifier. 🔴 THE PREFIX, NOT `WIRE_DIFF_SELFTEST ok`: the
    # marker's job is to say the run REACHED its own verdict, which a failing run does
    # too. Pinning the passing spelling would have classified every genuine catch as a
    # crash — 197 §5's discriminator needing a marker that survives the red path.
    "wire_diff.mjs": "WIRE_DIFF_SELFTEST",
    # 🆕 211 §6 — the budget reader. Same prefix-not-"ok" rule as the row above, and it
    # cost a change in that file: sections 2-5 asserted with a bare `node:assert`, which
    # aborts before any verdict line, so a blind on `measure()` would have been an
    # unclassifiable red rather than a catch. They go through `claim()` now.
    "token-cost.mjs": "TOKEN_COST_SELFTEST",
    # 🆕 231 — the wire-invisible roster. Same prefix-not-"ok" rule as the two rows above,
    # and the reason it holds here for free: every case in that self-test goes through
    # `claim()` and every risky call through `safe()`, so a blinded member reaches the
    # verdict line and is classified as a CATCH rather than as an unclassifiable crash.
    "wire_invisible_gate.mjs": "WIRE_INVISIBLE_SELFTEST",
    # 🆕 232 — the positive control's own proof. Same prefix-not-"ok" rule as the four
    # rows above: that file prints `POSITIVE_CONTROL_SELFTEST ok — …` green and
    # `🔴 POSITIVE_CONTROL_SELFTEST — n of m claim(s) FAILED` red, so the prefix is the
    # thing that says the run REACHED its verdict rather than the thing that says it
    # passed. Its failures are the `🔴 FAILED: ` dialect (B_FAIL), already read.
    "positive_control_gate.mjs": "POSITIVE_CONTROL_SELFTEST",
}


# 🔴 THE THREE DIALECTS, SUMMED RATHER THAN CLASSIFIED. A reader that decides which
# dialect an instrument speaks is a reader that can be wrong, and a wrong classifier here
# reports 0 failures for five of the nine — which is exactly what the first draft of the
# measuring script did. The three patterns are disjoint, so adding them needs no classifier
# and cannot mis-file a line (197 §5).
A_FAIL = re.compile(r"^[ \t]*FAIL[ \t]+[A-Z][A-Z0-9_]+", re.M)      # the .selftest.mjs harnesses
B_FAIL = re.compile(r"^🔴 FAILED: ", re.M)                          # the *_gate.mjs self-tests
# 🔴 BOTH node:test SUMMARY SPELLINGS. `spec` prints `ℹ fail 0`, `tap` prints `# fail 0`,
# and node picks between them by whether stdout is a TTY. The gate command now pins
# `--test-reporter=spec` so the choice is not the terminal's to make, and this alternation
# means a future instrument that forgets to pin it is merely read rather than read as zero.
C_FAIL = re.compile(r"^(?:ℹ|#) fail (\d+)$", re.M)                  # node:test
# 🆕 277 §2 — THE FOURTH DIALECT, AND IT IS A COUNT LIKE `C_FAIL` RATHER THAN A LINE.
# `handoff_gate.py --selftest` prints its per-claim reds as `  🔴 NAME …` and its verdict
# as `HANDOFF_SELFTEST <passed>/<claims> claims, <n> failed` — none of the three spellings
# above. 🔴 MEASURED ON THE RUN THAT ADDED THAT INSTRUMENT: its blast read ZERO across
# fifty-six blinds every one of which reddened, so a floor taken from that measurement
# would have been a floor at nothing — 172 §10.21 arriving inside the table built to stop
# it. A fourth reader is right and a fourth GATE would not be: the number this file wants
# is *how many claims did the instrument report*, and every dialect here answers it.
D_FAIL = re.compile(r"^HANDOFF_SELFTEST \d+/\d+ claims, (\d+) failed", re.M)
# 🆕 278 §4 — THE FIFTH DIALECT, AND IT IS THE THIRD SESSION RUNNING THAT ONE WAS FOUND
# BY HAND ON THE RUN THAT ADDED AN INSTRUMENT. `release_names.py --selftest` prints its
# per-row reds as `  🔴 CODE …` and its verdict as
# `<rows> rows · <n> REFUSE · <n> distinct code(s) · 🔴 <bad> DISAGREE`, and speaks none of
# the four spellings above. 🔴 MEASURED BEFORE THE ROSTER BELOW WAS WRITTEN: ten blinds
# reddened and `failure_lines` read ZERO off all ten, so the floor this session would have
# taken was a floor at nothing — 277 §4's finding, one file over, one session later.
# The counted half is what this file wants (how many rows did the instrument report), so
# it is a `C_FAIL`-shaped reader rather than a line count.
# 🔵 AND `BLAST_UNREADABLE` IS THE HALF THAT STOPS A SIXTH BEING FOUND BY HAND — see the
# blast loop. A fifth regex answers this instrument; a refusal answers the class.
E_FAIL = re.compile(r"^\s*\d+ rows · \d+ REFUSE · \d+ distinct code\(s\) · 🔴 (\d+) DISAGREE", re.M)
# 🆕 278 §4 — A SIXTH, AND `BLAST_UNREADABLE` IS WHAT FOUND IT RATHER THAN A PERSON.
#
# 🔴 THE REFUSAL SHIPPED IN THIS COMMIT CAUGHT THE NEXT INSTRUMENT ADDED IN THE SAME
# COMMIT, on its first run: `release_names.py (--assert-addon)` reported *4 blind(s) were
# CAUGHT and `failure_lines` read ZERO failure line(s) off them*. That is the whole
# argument for building the refusal rather than a fifth regex — the sixth dialect was
# nineteen lines away and three sessions of care had not been enough to see it.
#
# 🔵 AND IT IS DELIBERATELY WIDER THAN ONE COMMAND. This project's Python gates refuse
# with `🔴 <GATE_NAME> REFUSED [<code>]: …` on stderr, one line, no count — a shape
# `release_names.py`, `registry_lag.py` and `registry_bytes.py` all speak. Reading the
# FAMILY rather than the instance is what stops a seventh row being needed for the next
# file that uses the house spelling. It is a line count like `A_FAIL`/`B_FAIL`, because a
# command that refuses once reports one failure.
F_FAIL = re.compile(r"^🔴 [A-Z][A-Z0-9_]* REFUSED\b", re.M)


def failure_lines(out: str, _name: str = "") -> int:
    """How many failures the gate REPORTED. Not the exit code — the count."""
    c = C_FAIL.findall(out)
    d = D_FAIL.findall(out)
    e = E_FAIL.findall(out)
    return (len(A_FAIL.findall(out)) + len(B_FAIL.findall(out))
            + len(F_FAIL.findall(out))
            + (int(c[-1]) if c else 0) + (int(d[-1]) if d else 0)
            + (int(e[-1]) if e else 0))


# 🔴 THE BLINDS THAT CRASH THEIR GATE INSTEAD OF FAILING IT, DECLARED WITH THEIR REASON.
#
# Eight of the fifty-nine make the self-test throw before it reaches its verdict. Every one
# is a self-test that consumes the blinded member's return value in SETUP — outside the
# claim wrapper that would have recorded a failure — so the process dies on a `TypeError`
# instead. The blind IS caught in the weak sense that CI reddens, but the gate is
# demonstrating that JavaScript throws on `undefined`, not that its floor bites. That is a
# weaker claim than the `ok` line was making, so it is written down rather than counted.
#
# 🔴 THE SAME SHAPE AS `LATE_DECLARED_GREEN`, INCLUDING ITS TEETH (174 §5): a declared
# crash that STOPS crashing is a structure change and reddens this gate, so an exemption
# cannot outlive its reason. And `CRASH_CEILING` is a CEILING, not a floor — this list is
# supposed to shrink, and the way to shrink it is to move the setup call inside the claim.
#
# 🟢 199 §9.2 — EMPTY. THE CEILING FELL TO ZERO, AND WHAT IT WAS HIDING WAS THE BLAST.
# The nine were paid at TEN sites across SIX files, not the "twelve across five" the
# handover priced: `_workspace.selftest.mjs:94` carried two rows, and one of the nine was
# not in a self-test at all — `{SIG:inspect}` died in `seal_order_gate.mjs` itself, where
# `files.filter((f) => f.markers !== null)` let a record with NO `markers` key through to
# a `.declared.length`. A strict `!== null` guarding a read that assumes a whole object.
#
# 🔴 AND THE SITE LIST WAS A SURFACE, NOT A POPULATION. Fixing the ten exposed the next
# unguarded read behind each of them, four rounds deep in two files: capture, fix,
# re-capture, until nothing crashed. Twenty-two guards in the end, of which exactly one is
# not a `?.` — `RESTORE_CONTENT` read a file a blinded restore never rewrote and threw
# ENOENT, which no optional chain can reach.
#
# 🟢 THE PRICE OF THE CRASHES WAS 249 UNREPORTED FAILURES. Blast across the twelve rows
# went 92 -> 341: every crash was truncating its own gate's report, so the axis was not
# merely misclassifying nine rows, it was losing three quarters of the evidence in them.
CRASH_DECLARED: dict[tuple[str, str], str] = {}
CRASH_CEILING = 0      # 🟢 IT FELL. It stays a CEILING and not a floor for the reason it
                       # always was one: the next crash to appear is an UNDECLARED crash
                       # and fails this gate, rather than being absorbed by a number with
                       # room in it. 🔴 DO NOT RE-DECLARE A ROW HERE TO GET GREEN — the
                       # roster is for crashes that cannot be moved inside a claim, and
                       # 199 measured that none of the twelve were.


def crash_problems(crashes: list, declared: dict, ceiling: int) -> list[str]:
    """Undeclared crashes, and declarations that stopped crashing. Both halves (174 §5).

    🔴 FIXTURE-FED, because on a healthy tree both halves are empty.
    """
    problems = []
    for key in crashes:
        if key not in declared:
            problems.append(
                f"{key[0]}: `{key[1]}` went RED WITHOUT the gate reaching its own verdict — "
                f"the blind CRASHED it rather than failing it, so this row proves that "
                f"JavaScript throws on an empty, not that the gate's floor bites. Move the "
                f"setup read inside a claim, or declare it here with the reason"
            )
    for key in declared:
        if key not in crashes:
            problems.append(
                f"{key[0]}: `{key[1]}` is DECLARED as crashing and now reaches the verdict. "
                f"The reason on file no longer holds — delete the declaration and lower "
                f"CRASH_CEILING in the same commit: {declared[key]}"
            )
    if len(crashes) > ceiling:
        problems.append(
            f"CRASH_CEILING {len(crashes)} > {ceiling} — more blinds crash their gate than "
            f"when this was measured. This number is a CEILING and is supposed to fall"
        )
    return problems


def marker_roster_problems(instruments, markers: dict) -> list[str]:
    """An instrument with no marker, and a marker with no instrument (182's both halves).

    🔴 FIXTURE-FED (195 §8.4): both lists are empty on a healthy tree, so an inline version
    deletes invisibly.
    """
    names = [i["name"] for i in instruments]
    problems = []
    for n in names:
        if n not in markers:
            problems.append(
                f"{n} has no VERDICT_MARKER — every red run over it is unclassifiable, so "
                f"'the gate caught it' and 'the mutant crashed the gate' are one observable "
                f"again (181 §4, and 197 §5 found nine live)"
            )
    for n in markers:
        if n not in names:
            problems.append(f"VERDICT_MARKER names {n!r}, which is not an instrument")
    return problems


def green(inst: dict) -> tuple[bool, bool, int]:
    """(gate ran GREEN, the gate REACHED ITS OWN VERDICT, how many failures it reported).

    🔴 THREE VALUES BECAUSE `red` HAD THREE MEANINGS AND ONE OBSERVABLE (197 §5, and 181
    §4 before it, one file over). The third is the blast radius: a number this function has
    always had in hand and always discarded — 196 §3, one turn worse, because control_gate
    at least printed it.
    """
    p = subprocess.run(inst["gate"], capture_output=True, text=True, cwd=str(inst["cwd"]))
    out = p.stdout + p.stderr
    return (p.returncode == 0, VERDICT_MARKER.get(inst["name"], "\0") in out,
            failure_lines(out, inst["name"]))


def body_brace(text: str, sig: str) -> int | None:
    """Index of the `{` that opens the member's BODY — not the first `{` after its name.

    🔴 197 §5. BOTH INJECTORS SAID `text.find("{", idx)`, AND FOR ONE TARGET THAT BRACE WAS
    A DESTRUCTURING PATTERN IN THE PARAMETER LIST.

        export function judge(files, { filesFloor = FILES_FLOOR, … } = {}) {

    `seal_order_gate.judge` gained that options bag in #211. From then on the injection
    landed INSIDE the parameter list, node exited 1 on `SyntaxError: Unexpected token '{'`,
    `green()` read `returncode != 0` — and this gate printed `ok  {SIG:judge}` over a file
    that does not compile, for 25 commits. The target was not merely failing to prove
    anything: it was never applied, and nothing anywhere said so.

    🔴 THE FIX IS TO COMPUTE THE BRACE FROM THE ANCHOR RATHER THAN SEARCH FOR IT. The
    anchor `resolve_sig()` returns already carries the answer: an indented member is
    matched with its ` {` appended, and a top-level declaration's anchor ENDS in `{`
    (`_decl_re` requires a block-opening brace at end of line, which is why a call site can
    never be anchored). The paren-depth walk below is a backstop for an anchor that
    carries neither, and it too refuses to accept a brace inside a parameter list.
    """
    pat = "\n  " + sig + " {"
    idx = text.find(pat)
    if idx >= 0:
        return idx + len(pat) - 1
    idx = text.find("\n" + sig)
    if idx < 0:
        return None
    stripped = sig.rstrip()
    if stripped.endswith("{"):
        return idx + len(stripped)      # 1 for the "\n", len(stripped)-1 for the brace
    # 🆕 212 §4 — AND THE BACKSTOP HAS TO STOP. 197 §5 fixed the case where this walk
    # found a brace TOO EARLY (a destructuring pattern in the parameter list). The
    # mirror case was still open and is worse: for an anchor with NO block of its own —
    # a concise-body arrow, which is exactly what 211 §6.5 proposed anchoring — the walk
    # ran off the end of the declaration and returned the opening brace of *whatever was
    # declared next in the file*. `blind()` then injected a statement into a member
    # nobody had named, the mutant PARSED, the gate went red for a reason belonging to a
    # different function, and the sweep called it a catch.
    #
    # 🔴 MEASURED, NOT REASONED ABOUT: caught on the first smoke run of `concise_blind`
    # against `token-cost.mjs::bytes`, whose injection landed in the declaration below
    # it. No shipped target reaches this walk today — every anchor either ends in `{` or
    # is matched with one appended — so it was latent, and it was waiting precisely for
    # the widening that admits members without blocks.
    #
    # The rule is the statement's own boundary: a member's body brace cannot come after
    # the declaration that opens it has ended. A `;` at depth 0 first means there is no
    # block, which is a `concise_blind` case and NOT this function's to guess at.
    # 🔴 AND IT HAS TO KNOW WHAT IT IS WALKING THROUGH, which is the third instance of
    # this one walk being wrong about a brace. 197 §5: a `{` in a destructuring parameter
    # list. Above: a `{` belonging to the NEXT declaration. And measured on the same smoke
    # run, `_path_ledger.mjs::ledgerKey`:
    #
    #     export const ledgerKey = (tool, param) => `${tool}\t${param}`;
    #
    # the first `{` at paren-depth 0 is the one in `${tool}` — inside a TEMPLATE LITERAL.
    # The injection landed in the interpolation and the mutant did not parse. Strings and
    # templates are skipped now, and `parses()` is under all three: this walk is a
    # heuristic and the only honest thing to do with a heuristic is check its output.
    depth = 0
    quote: str | None = None
    i = idx
    while i < len(text):
        c = text[i]
        if quote is not None:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "\"'`":
            quote = c
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        elif c == ";" and depth <= 0:
            return None
        elif c == "{" and depth <= 0:
            return i
        i += 1
    return None


def initialiser_end(text: str, i: int) -> int | None:
    """Index of the `;` that ends the initialiser starting at `i` — 🆕 212 §4.

    🔴 A DEPTH WALK RATHER THAN A `find(";")`, AND 197 §5 IS WHY. That session found both
    injectors computing a brace with `text.find("{", idx)` and landing inside a
    destructuring parameter list; the mutant did not parse, node exited 1, and the gate
    read the non-zero exit as a CATCH for 25 commits. A `;` inside a string, a template
    literal or a nested call is the identical trap one punctuation mark over. Strings,
    templates, comments and every bracket class are tracked, and an unterminated
    initialiser returns None rather than a guess — `parses()` is the backstop under it.
    """
    depth = 0
    quote: str | None = None
    while i < len(text):
        c = text[i]
        if quote is not None:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "\"'`":
            quote = c
        elif c == "/" and text[i + 1 : i + 2] == "/":
            i = text.find("\n", i)
            if i < 0:
                return None
            continue
        elif c == "/" and text[i + 1 : i + 2] == "*":
            i = text.find("*/", i)
            if i < 0:
                return None
            i += 2
            continue
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
            if depth < 0:
                return None
        elif c == ";" and depth == 0:
            return i
        i += 1
    return None


def concise_blind(text: str, sig: str, empty: str, late_hook: bool = False) -> str | None:
    """Give a concise-body arrow a BLOCK body, so `empty` has somewhere to go — 🆕 212 §4.

    🔴 THE REWRITE PRESERVES THE STATEMENT VOCABULARY ON PURPOSE. Every target in this
    file is written as a statement (`return { … };`), and a concise arrow needs an
    EXPRESSION. Converting `=> EXPR;` into `=> { <statement> }` rather than substituting
    an expression keeps one target dialect across both injectors — a second dialect would
    be a target that reads correct against the wrong injector, which is the class this
    file spent 197 §5 and 202 §9.4 removing.

    The late form keeps the original expression as the call-1 answer, so the counter has
    something honest to return before it starts lying.
    """
    idx = text.find("\n" + sig)
    if idx < 0:
        return None
    arrow = text.find("=>", idx + 1)
    if arrow < 0:
        return None
    end = initialiser_end(text, arrow + 2)
    if end is None:
        return None
    if late_hook:
        expr = text[arrow + 2 : end].strip()
        body = (f"=> {{\n    {LATE_HOOK} if(globalThis.__LB>1){{ {empty} }}"
                f"\n    return ({expr});\n}}")
    else:
        body = f"=> {{\n    {empty}  // INSTRUMENT_GATE\n}}"
    return text[:arrow] + body + text[end:]


def parses(path: Path) -> str:
    """"" if the file is syntactically valid JavaScript, else the first error line.

    🔴 212 §4 — THIS CLOSES THE CLASS 197 §5 FIXED ONE INSTANCE OF, AND THE FILE ALREADY
    SAYS SO. `body_brace`'s docstring: the injection landed inside a parameter list, "node
    exited 1 on SyntaxError, `green()` read `returncode != 0` — and this gate printed
    `ok {SIG:judge}` over a file that does not compile, for 25 commits." 197 computed the
    brace from the anchor so that PARTICULAR injection could not go wrong. Nothing was
    added that could tell a syntax error from a catch, so the next injector — including
    `concise_blind` above — inherits the same silence. A mutant that does not parse is not
    evidence about an instrument; it is evidence about this harness, and it now says which.
    """
    if str(path).endswith(".py"):
        return py_parses(path)
    p = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if p.returncode == 0:
        return ""
    err = [ln for ln in (p.stderr + p.stdout).split("\n") if "Error" in ln]
    return (err[0] if err else "node --check failed with no recognisable error line").strip()


# ══ 🆕 245 §1 — THE PYTHON HALF — `blind-py-gates` (234) ═══════════════════════════
#
# 🔴 EIGHTEEN TRACKED `.py` GATES AND NOT ONE OF THEM HAS EVER BEEN BLINDED. 234 opened the
# row and named the blocker exactly: *"the injector is the work — `blind()` anchors a JS
# function body and Python needs its own."* Everything above this line is language-agnostic
# — the control, the verdict marker, the crash/catch split, the two axes, the blast radius,
# the not-loaded bucket — and every one of those was unavailable to more than half the
# instruments in this repository because of three functions.
#
# 🔴 AND THE ROW'S OWN COUNT WAS ALREADY WRONG WHEN IT WAS WRITTEN. "Seventeen" was true at
# 234; `p0_comments.py` joined `scripts/` at 243 and nothing in the row could see it. That
# is the reason `PY_NOT_SWEPT` below is checked against a WALK rather than read: a typed
# population cannot report what joined it (231 §5.1, and 244's whole finding).
#
# The anchor is the same `{SIG:name}` placeholder, and it claims the same two things —
# EXISTENCE and UNIQUENESS — for the same reason. What differs is only the body:
# JavaScript's is delimited by a brace this file can count to, and Python's by an INDENT it
# has to read off the source. So the anchor here is the DECLARATION HEADER (`def name(` down
# to the line that ends the parameter list), and the injection point is the line after it at
# the indent the real body already uses. A `def` whose parameters wrap is handled for free,
# which took `_decl_span` a whole session on the other side of the fence.
_PY_DECL = "def "


def py_decl_lines(text: str, name: str) -> "list[int]":
    """Every 0-based line index that DECLARES `name`. Existence and uniqueness, unassumed."""
    pat = re.compile(rf"^[ \t]*(?:async[ \t]+)?def[ \t]+{re.escape(name)}[ \t]*\(")
    return [i for i, ln in enumerate(text.split("\n")) if pat.match(ln)]


def py_resolve_sig(text: str, sig: str) -> tuple[str, str]:
    """(anchor, problem) — the Python twin of `resolve_sig`, with the same two claims.

    The anchor is the whole declaration header, newlines included, so a wrapped parameter
    list resolves without a second pattern. A literal anchor is passed through unchanged for
    `resolve_sig`'s reason: an ambiguous name has no other way to be anchored, and refusing
    the escape hatch would leave a target unwritable rather than written down.
    """
    m = SIG_RE.match(sig)
    if not m:
        return (sig, "")
    name = m.group("name")
    lines = text.split("\n")
    hits = py_decl_lines(text, name)
    if not hits:
        return ("", f"{{SIG:{name}}} matches NO `def {name}(` — the member this target names "
                    f"does not exist in the file being swept, so the blind would be skipped "
                    f"silently and the sweep would report the instrument as covered")
    if len(hits) > 1:
        return ("", f"{{SIG:{name}}} matches {len(hits)} declarations of `def {name}(` at "
                    f"lines {[h + 1 for h in hits]} — a textual blind would rewrite whichever "
                    f"one came first, and this file refuses to let a loosened anchor decide "
                    f"which (193 §12.27, one language over)")
    i = hits[0]
    j = i
    while j < len(lines) and not re.search(r":[ \t]*(#.*)?$", lines[j]):
        j += 1
        if j - i > 14:
            return ("", f"{{SIG:{name}}}'s declaration header runs past 14 lines without "
                        f"reaching the `:` that opens its body — the injector would have "
                        f"nowhere to put a statement")
    return ("\n".join(lines[i:j + 1]), "")


def py_body_indent(text: str, anchor: str) -> "tuple[int, int] | None":
    """(line index the header ENDS on, the indent the body already uses).

    🔴 READ OFF THE SOURCE, NEVER COMPUTED AS `header + 4`. A method on a class, a nested
    helper and a top-level function all differ, and a guessed indent produces a mutant that
    does not PARSE — which `py_parses` would catch, but as a harness failure rather than as
    the target it silently stopped testing.
    """
    at = text.find(anchor)
    if at < 0 or text.count(anchor) != 1:
        return None
    end = text[:at].count("\n") + anchor.count("\n")
    lines = text.split("\n")
    head_indent = len(lines[end - anchor.count("\n")]) - len(
        lines[end - anchor.count("\n")].lstrip())
    k = end + 1
    while k < len(lines) and not lines[k].strip():
        k += 1
    if k >= len(lines):
        return None
    body = len(lines[k]) - len(lines[k].lstrip())
    return (end, body if body > head_indent else head_indent + 4)


def py_blind(text: str, anchor: str, empty: str) -> "str | None":
    """`empty` becomes the first statement of the member. The docstring below it is dead
    code afterwards and that is fine — a blind is about what the member RETURNS."""
    pos = py_body_indent(text, anchor)
    if pos is None:
        return None
    end, ind = pos
    lines = text.split("\n")
    lines.insert(end + 1, " " * ind + empty + "  # INSTRUMENT_GATE")
    return "\n".join(lines)


# 🔴 THE LATE HOOK, AND IT IS NOT A TRANSLATION OF THE JS ONE — IT IS THE SAME OBSERVABLE
# REBUILT. `LATE_HOOK` leans on `globalThis` and `process.on("exit")`; Python has neither, so
# the counter lives on the `builtins` module (the one namespace every module in a run shares
# without importing anything) and the line is written by `atexit`. The MARKER is identical,
# because `run_counting` is what reads it and that reader is language-agnostic — which is the
# whole reason this port is three functions and not a second gate.
# ── 🆕 247 §3 — THE REGISTRATION LEAVES THE BODY, AND THAT IS THE WHOLE FIX ──────────
#
# 🔴 `NEVER LOADED` AND `NEVER CALLED` WERE ONE OBSERVATION, AND THE MESSAGE SAID SO.
# The refusal this file prints reads *"either the mutant NEVER LOADED — a SyntaxError, or
# a throw at import — or this target is never called on this axis"*: two failures, one
# bucket, and only one of them is about the instrument. 212 §4 split `not hook` out of
# `calls == 0` for exactly this reason and stopped one turn short — the hook that decides
# it was still registered from INSIDE the member, so a module that imported perfectly and
# simply never called that function was indistinguishable from a module that did not parse.
#
# 🔴 MEASURED: it bit the first time a target was added that one axis does not call.
# `queue_gate.py`'s `{SIG:ages}`, `{SIG:render}` and `{SIG:_table}` are that file's two
# reporters and its fixture builder; the live no-flag command reads QUEUE.md and calls
# none of them. All three landed in `LATE_NOT_LOADED`, whose ceiling is ZERO — so a
# correctly-constructed sweep of a healthy tree failed on three mutants that had loaded,
# run and behaved exactly as the table says they should.
#
# The registration is a MODULE-LEVEL statement now, written in at column zero directly
# above the target's own `def`, so it executes on import and the exit handler prints
# `LATE_BLIND_CALLS 0` for a member nothing called. No hook line still means no module.
PY_LATE_REGISTER = (
    'import builtins as _igb, atexit as _igx  # INSTRUMENT_GATE LATE',
    'if not getattr(_igb, "_IG_HOOKED", 0):',
    '    _igb._IG_HOOKED = 1; _igb._IG_CALLS = 0',
    '    _igx.register(lambda: print("\\n%s %%d" %% getattr(_igb, "_IG_CALLS", 0)))' % LATE_MARK,
)
PY_LATE_HOOK = (
    'import builtins as _igb  # INSTRUMENT_GATE LATE',
    '_igb._IG_CALLS = getattr(_igb, "_IG_CALLS", 0) + 1',
    'if _igb._IG_CALLS > 1: {empty}',
)


def py_late(text: str, anchor: str, empty: str) -> "str | None":
    """`empty` from the SECOND call onwards. Same anchor as `py_blind`, same marker.

    🔴 THE COUNTER IS IN THE BODY AND THE REGISTRATION IS NOT — see the note above for
    the one bucket that collapsed into while both halves lived inside the member.
    """
    pos = py_body_indent(text, anchor)
    if pos is None:
        return None
    end, ind = pos
    pad = " " * ind
    lines = text.split("\n")
    head = anchor.split("\n")[0]
    if head not in lines:
        return None
    # The body first: inserting above the declaration afterwards moves it down whole,
    # where doing it the other way round would invalidate `end`.
    lines[end + 1:end + 1] = [pad + ln.replace("{empty}", empty) for ln in PY_LATE_HOOK]
    decl = lines.index(head)
    lines[decl:decl] = list(PY_LATE_REGISTER)
    return "\n".join(lines)


def py_parses(path: Path) -> str:
    """`parses()` for Python — `compile()` rather than a subprocess, exact and free."""
    try:
        compile(path.read_text(), str(path), "exec")
    except SyntaxError as e:
        return f"SyntaxError: {e.msg} at line {e.lineno}"
    return ""


def lang_of(src) -> str:
    """`py` or `js`, from the file being swept. Derived, never typed into a roster row —
    a language column would be one more thing that can disagree with the tree."""
    return "py" if str(src).endswith(".py") else "js"


def blind(text: str, sig: str, empty: str, lang: str = "js") -> str | None:
    """Inject `empty` as the first statement of the member whose signature is `sig`."""
    if lang == "py":
        return py_blind(text, sig, empty)
    brace = body_brace(text, sig)
    if brace is None:
        return concise_blind(text, sig, empty)
    return text[: brace + 1] + f"\n    {empty}  // INSTRUMENT_GATE" + text[brace + 1 :]


# 🔴 197 §5 — WHAT THE BLINDS DO, ONE LINE PER INSTRUMENT AND NEVER SUMMED (172 §6).
# A single total across all nine would let one instrument's sweep go quiet while the other
# eight covered for it, which is the exact defect the per-instrument BLIND lines exist to
# prevent. Floored from BELOW and with headroom, because these self-tests GROW: a per-row
# equality would redden on every honest new claim, which is a gate that gets deleted.
# 🟢 199 §9.2 — FOUR OF THE NINE MOVED, AND THE CRASHES ARE WHY. A gate that dies partway
# through reports only the failures it reached, so every declared crash was holding its
# instrument's blast down. With the twelve reaching their verdicts the four instruments
# that carried them measure 107/30/178/268 against floors of 36/6/120/140 — a floor three
# to five times below its measurement is a floor that cannot bite, which is 198 §36's rule
# arriving at the numbers it was written about. Raised with ~10% headroom, still from
# BELOW, still per instrument and never summed (172 §6).
BLAST_FLOOR: dict[str, int] = {
    # 🆕 277 §2 — measured 645 across fifty-six blinds, floored ~20% below. The
    # number was ZERO on the run that added this instrument and the reason was
    # `failure_lines`, not the sweep: this gate reports in a fourth dialect (`D_FAIL`).
    # 🆕 278 — 530, measured 664 across fifty-nine blinds. Raised in the commit that
    # outgrew it (198 §36) rather than left at 277's 515, which the three new §3 targets
    # had already put 29% under the live number.
    "handoff_gate.py": 530,   # 278: measured 664 (277: 515/645)
    # 🆕 278 §4 — measured 110 across fifteen blinds, floored ~20% below. 🔴 THE NUMBER WAS
    # SIXTY-THREE ON THE FIRST SWEEP AND ZERO BEFORE `E_FAIL`: sixty-three because four
    # members CRASHED the self-test instead of reddening it and a gate that dies partway
    # reports only the failures it reached (199 §9.2), zero because this file speaks a
    # fifth dialect. Both are fixed in the commit that takes this floor, which is the only
    # honest order — see `BLAST_UNREADABLE`.
    "release_names.py": 88,   # 278: measured 110
    # 🆕 278 §4 — measured 4 across its four blinds, one house-spelling refusal each, and
    # the number was ZERO until `F_FAIL` existed. `BLAST_UNREADABLE` is what said so, on
    # the first run of the commit that shipped it — see the note beside `F_FAIL`.
    "release_names.py (--assert-addon)": 3,   # 278: measured 4
    "_population.mjs": 80,
    "_path_ledger.mjs": 36,   # 212: 30 -> 36, measured 41 (+ledgerKey)
    "_workspace.mjs": 95,     # 199: 36 -> 95, measured 107
    "_png.mjs": 26,           # 199: 6 -> 26, measured 30
    "tautology_gate.mjs": 160,  # 199: 120 -> 160, measured 178
    # # 🆕 212 §4: raised from BELOW with ~10% headroom after the coverage roster admitted
    #          the untargeted exported members — 198 §36's rule, which is that a floor
    #          well under its measurement is a floor that cannot bite.
    "verdict_gate.mjs": 52,   # 212: 28 -> 52, measured 59 (+scanDiscarded, judgeDiscarded, combine)
    "boundary_gate.mjs": 180,  # 212: 160 -> 180, measured 201 (+run, report)
    # 🔴 127 BEFORE §5's INJECTOR FIX, 166 AFTER — the 39-claim difference is `{SIG:judge}`
    # being applied for the first time since #211. The floor is set against the CORRECT
    # number, so a regression to the broken injector would now be caught here as well.
    "seal_order_gate.mjs": 320,   # 212: 240 -> 320, measured 359 (+paragraphsOf, isProbe, READS_AS_CLAIM)
    "path-cohort (compiled walk)": 50,
    "wire_diff.mjs": 120,  # 209: measured 95 across four blinds, 0 crashed. 🆕 211 §4:
                           # measured 140 after the six symmetric-collapse rows and the
                           # value-carrying typeName rows landed — raised from below with
                           # the usual headroom rather than left at a number the file has
                           # outgrown, which is 198 §36's rule.
    # 🆕 212 §4 — 🔴 AND THIS ROW IS THE MEASUREMENT THAT ANSWERS 211 §6. It read
    # "measured 11 across its two ANCHORABLE members"; there are four now, `bytes` and
    # `family` reached by `concise_blind` rather than by the `_decl_re` widening 211 §6.5
    # named. 11 -> 23, which is what the other two were worth.
    "token-cost.mjs": 20,  # 212: 8 -> 20, measured 23 across all four
    "wire_invisible_gate.mjs": 18,  # 231: measured 22 across its five blinds, 0 crashed
    # 🆕 232 — MEASURED BY HAND BEFORE THE ROW WAS WRITTEN, and the first measurement was
    # of a file that CRASHED rather than failed: `classify` and `acceptance` blinded took
    # this proof down before its verdict line, so the numbers the first sweep printed were
    # about JavaScript and not about the gate (197 §5). After `safe`/`jg`/`ac` landed in
    # the self-test the three blinds report twenty-one, five and seven failure lines.
    # Floored from BELOW at 198 §36's usual headroom.
    "positive_control_gate.mjs": 28,  # 232: measured 33 across its three blinds, 0 crashed
    # 🆕 244 §4 — `p0-reporters-unblinded` (241). See LATE_BLAST_FLOOR for why these two
    # numbers are not the ones the first sweep printed.
    "p0_complexity.mjs": 28,   # 244: measured 33 across its five blinds, 0 crashed
    "p0_testdup.mjs": 18,      # 244: measured 21 across its six blinds, 0 crashed
    # 🆕 245 §1 — THE FIRST THREE PYTHON ROWS, and every one of them was ZERO until §2.
    # `failure_lines` reads three spellings and not one Python gate in this tree used any
    # of them: measured over the fifteen blinds below before a line was changed, the A:gate
    # blast was 0, 0 and 0 while the three self-tests were reporting real failed claims.
    # A floor is not available over an uncountable red — 244 §4.4, arriving at a population
    # rather than at one command. Floored from BELOW with the usual headroom (198 §36).
    "p0_comments.py": 9,
    # 🆕 247 §1 — 198 §36: RAISE A FLOOR THE SAME COMMIT THAT OUTGROWS IT. The coverage
    # roster asked for five more targets across these two and the sweep reddens harder for
    # them; a floor left at the old number is headroom nobody voted for.
    "queue_gate.py": 170,          # 271: 90 -> 170, measured 216 (+the five 271 added)
    "mutation_lock_gate.py": 16,   # 247: 9 -> 16, measured 21 (+_base_name, _temp_roots)
    # 🆕 247 §2 — the fourth Python instrument, floored from BELOW on its first sweep.
    "terminology_gate.py": 12,     # 247: measured 15 across its five blinds, 0 crashed
}
BLAST_OBSERVED: dict[str, int] = {}
# 🆕 278 — HOW MANY BLINDS THE GATE ACTUALLY CAUGHT, per instrument, beside how many
# failure lines were READ off them. The two numbers exist to be compared: see
# `BLAST_UNREADABLE` in the blast loop for the third time this project has measured a
# blast of zero over blinds every one of which reddened.
CAUGHT_OBSERVED: dict[str, int] = {}
CRASHED: list[tuple[str, str]] = []


def sweep(inst: dict) -> tuple[int, int, list[str]]:
    """(#still-green, #targets, problems). The source is restored whatever happens."""
    src: Path = inst["src"]
    problems: list[str] = []

    if not src.exists():
        return (0, 0, [f"{inst['name']}: {src} does not exist — nothing was tested"])

    stale_src: Path | None = inst.get("fresher_than")
    if stale_src is not None and stale_src.exists() and stale_src.stat().st_mtime > src.stat().st_mtime:
        return (0, 0, [
            f"{inst['name']}: {src.relative_to(ROOT)} is OLDER than {stale_src.relative_to(ROOT)} — "
            f"sweeping it would blind a build artefact that is not the instrument that ships, and "
            f"report the result in green. Rebuild (`npm test`) and re-run"
        ])

    original = src.read_text()
    targets = inst["targets"]
    print(f"\n-- {inst['name']} — {len(targets)}/{inst['floor']} target(s) · gate: {' '.join(inst['gate'])}")

    if len(targets) < inst["floor"]:
        problems.append(
            f"{inst['name']}: TARGET LIST COLLAPSED, {len(targets)} < {inst['floor']} — either a member was "
            f"deleted (lower the literal on purpose) or a signature changed and this file no longer matches "
            f"it, in which case every target below passes over something it stopped testing"
        )

    try:
        # CONTROL. 171 §5's M4: without it a 'caught' mutant means nothing at all.
        ok, saw_verdict, ctrl_fails = green(inst)
        if not ok:
            return (0, len(targets), [f"{inst['name']}: CONTROL FAILED — the unmutated gate does not pass, so this harness is lying"])
        # 🔴 197 §5. THE MARKER IS PROVED ON THE HEALTHY RUN, BEFORE A SINGLE MUTANT.
        # A declared marker that no longer appears would silently reclassify every catch
        # below as a crash — 181 §4's discriminator needing its own control, which
        # scope_gate learned the same way (`SCOPE_GATE_MARKER`).
        if not saw_verdict:
            return (0, len(targets), [
                f"{inst['name']}: the unmutated gate passes WITHOUT printing "
                f"{VERDICT_MARKER.get(inst['name'])!r}. Every 'caught' and 'crashed' "
                f"judgement below rests on that string; fix VERDICT_MARKER before believing "
                f"a line of this sweep"])
        if ctrl_fails:
            return (0, len(targets), [
                f"{inst['name']}: the unmutated gate reports {ctrl_fails} failure line(s) "
                f"while exiting 0 — the failure reader and the exit code disagree on a "
                f"HEALTHY tree, so the blast radius below is measuring something else"])
        print("   CONTROL ok — unmutated, the gate passes, prints its verdict marker, "
              "and reports 0 failure line(s)")

        still_green: list[str] = []
        lang = lang_of(src)
        for sig, empty in targets.items():
            anchor, sig_problem = resolve_target(inst["name"], original, sig, lang)
            if sig_problem:
                problems.append(f"{inst['name']}: {sig_problem}")
                print(f"   🔴 UNRESOLVED  {sig}")
                continue
            mutant = blind(original, anchor, empty, lang)
            if mutant is None:
                problems.append(
                    f"{inst['name']}: SIGNATURE NOT FOUND {sig!r} — this target has been silently skipped, "
                    f"which is the harness going blind rather than the instrument"
                )
                print(f"   🔴 UNMATCHED   {sig}")
                continue
            src.write_text(mutant)
            # 🆕 212 §4 — BEFORE THE GATE RUNS, NOT AFTER. See `parses()`: a mutant that
            # does not compile reddens the gate for a reason that has nothing to do with
            # the instrument, and every judgement below reads it as a catch.
            syntax = parses(src)
            if syntax:
                problems.append(
                    f"{inst['name']}: the mutant for {sig!r} DOES NOT PARSE — {syntax}. "
                    f"The gate would have gone red and this sweep would have called it a "
                    f"catch (197 §5, for 25 commits). Fix the injector or the anchor; a "
                    f"target that cannot be APPLIED proves nothing about the instrument")
                print(f"   🔴 UNPARSEABLE {sig[:52]}")
                continue
            mut_green, mut_verdict, fails = green(inst)
            BLAST_OBSERVED[inst["name"]] = BLAST_OBSERVED.get(inst["name"], 0) + fails
            if mut_green:
                still_green.append(sig)
                print(f"   🔴 STILL GREEN {sig}  ->  {empty[:44]}")
            elif not mut_verdict:
                # 🔴 RED, BUT THE GATE NEVER REACHED ITS OWN VERDICT (197 §5). Declared or
                # not is `crash_problems`' call; this loop only records what happened.
                CRASHED.append((inst["name"], sig))
                mark = "declared-crash" if (inst["name"], sig) in CRASH_DECLARED else "🔴 CRASHED"
                print(f"   {mark:<14} {sig[:52]}  no verdict, {fails} failure line(s)")
            else:
                CAUGHT_OBSERVED[inst["name"]] = CAUGHT_OBSERVED.get(inst["name"], 0) + 1
                print(f"   ok            {sig[:52]}  red · {fails} failure line(s) reported")
        return (len(still_green), len(targets), problems + [
            f"{inst['name']}: `{s}` can return the empty its contract promises and the gate stays GREEN — "
            f"'found nothing' and 'did not look' are the same observable ({inst['why']})"
            for s in still_green
        ])
    finally:
        src.write_text(original)


CALL_SENTINEL = "🔴 INSTRUMENT_CALL_WIRING sentinel — a patched predicate reached the report"


def collect_problems(stage: str) -> dict[str, list[str]]:
    """🔴 202 §9.4 — THE ONE INVOCATION POINT, SO THE CALLS CAN BE PATCHED.

    202 closed `U2` in `floor_pin_gate.py`: a predicate proved by a fixture is NOT a
    predicate proved to be CALLED, and on a green tree no mutation of the INPUT can tell
    the two apart. The mechanism was named as portable and the population left unmeasured.
    `measure203.py` measured it: SEVEN unproved predicate calls across the other three
    gates, FOUR of them here.

    🔴 THE STAGE IS AN ARGUMENT AND NOT A COMMENT. This gate has two axes and the second
    axis's tables do not exist when the first axis reports — a single seam over both would
    read `CRASHED` before the sweep that fills it and quietly report zero. Splitting by
    stage keeps every `problems.extend` exactly where it was, which is 202 §8's rule: this
    changes where the lists come from, not what is printed or in what order."""
    if stage == "late":
        return {
            "not_loaded":   not_loaded_problems(LATE_NOT_LOADED, LATE_NOT_LOADED_CEILING),
            "late_roster":  late_marker_roster_problems(LATE_LIVE, LATE_VERDICT_MARKER),
            "late_na_ci":   late_na_ci_problems(
                LATE_LIVE_NA, INSTRUMENTS,
                ci_node_commands(CI_YML.read_text(encoding="utf-8"))
                if CI_YML.exists() else set()),
            "crash_late_a": crash_problems(LATE_CRASHED_A, CRASH_DECLARED, LATE_CRASH_CEILING_A),
            "crash_late_b": crash_problems(LATE_CRASHED_B, LATE_CRASH_DECLARED_B,
                                           LATE_CRASH_CEILING_B),
        }
    if stage == "final":
        return {
            "crash":  crash_problems(CRASHED, CRASH_DECLARED, CRASH_CEILING),
            "roster": marker_roster_problems(INSTRUMENTS, VERDICT_MARKER),
        }
    # 🆕 245 §1 — the two rosters this session added, invoked here for 202 §9.4's reason:
    # a predicate proved by a fixture is not a predicate proved to be CALLED, and both of
    # these return EMPTY on a healthy tree, which is the state in which a deleted call site
    # and a satisfied check are the same observable.
    if stage == "py":
        return {
            "py_discover": py_discovery_problems(py_walk(ROOT), INSTRUMENTS, PY_NOT_SWEPT),
            "late_locked": late_locked_problems(LATE_LIVE_LOCKED, ROOT),
        }
    raise AssertionError(
        f"collect_problems: unknown stage {stage!r}. A stage nobody defined returns no "
        f"problems, which is a whole axis switched off by a typo — 172 §10.21's shape "
        f"with a string for a disguise")


def _call_wiring_problems() -> list[str]:
    """🔴 PROVE THE CALL, NOT THE LOGIC. 202 §9.4 ported, and it is HARDER here.

    Each predicate is swapped for a stub returning the sentinel, and `collect_problems()`
    must surface that sentinel under the key that predicate feeds. The stub needs no
    population, which is why an empty table stops being a reason a call site cannot be
    observed — the whole of 201's `U2`.

    🔴 `crash_problems` HAS THREE CALL SITES AND `floor_pin_gate.py` HAD NO SUCH CASE.
    There its two `reason_problems` sites were told apart by a `label` argument that
    exists for the purpose. Here the three sites differ only by WHICH TABLE they are
    handed, so the stub is keyed on the identity of its first argument. That makes the
    check strictly sharper: a call site passing the wrong table — `LATE_CRASHED_A` where
    `LATE_CRASHED_B` was meant, the two ceilings 194 §33 insisted stay separate — lands
    its sentinel under the wrong key and reddens, which no label could have caught."""
    g = globals()
    bad: list[str] = []

    SIMPLE = [
        ("late",  "not_loaded",  "not_loaded_problems"),
        ("late",  "late_roster", "late_marker_roster_problems"),
        ("late",  "late_na_ci",  "late_na_ci_problems"),
        ("final", "roster",      "marker_roster_problems"),
        ("py",    "py_discover", "py_discovery_problems"),
        ("py",    "late_locked", "late_locked_problems"),
    ]
    for stage, key, fname in SIMPLE:
        real = g[fname]
        g[fname] = lambda *a, **k: [CALL_SENTINEL]
        try:
            got = collect_problems(stage)
        finally:
            g[fname] = real
        if CALL_SENTINEL not in got.get(key, []):
            bad.append(f"_call_wiring: {fname}() no longer reaches the report under {key!r} "
                       f"in stage {stage!r} — the predicate is intact and NOTHING CALLS IT. "
                       f"The fixture proves the function; this proves the gate still runs it")
        leaked = [k for k, v in got.items() if k != key and CALL_SENTINEL in v]
        if leaked:
            bad.append(f"_call_wiring: {fname}()'s result arrived under {leaked} as well as "
                       f"{key!r} — a predicate feeding a key its reason is not about is "
                       f"199 §35, and the key is part of the claim")

    # 🔴 THE THREE `crash_problems` CALL SITES, TOLD APART BY THE TABLE THEY ARE HANDED.
    TABLE_KEY = {id(LATE_CRASHED_A): "crash_late_a", id(LATE_CRASHED_B): "crash_late_b",
                 id(CRASHED): "crash"}
    real = g["crash_problems"]
    g["crash_problems"] = lambda crashes, *a, **k: [
        f"{CALL_SENTINEL} [{TABLE_KEY.get(id(crashes), 'UNKNOWN TABLE')}]"]
    try:
        got = {**collect_problems("late"), **collect_problems("final")}
    finally:
        g["crash_problems"] = real
    for key in ("crash_late_a", "crash_late_b", "crash"):
        if f"{CALL_SENTINEL} [{key}]" not in got.get(key, []):
            bad.append(f"_call_wiring: crash_problems() is no longer called with the table "
                       f"{key!r} names. Either the call is gone, or it is being handed a "
                       f"DIFFERENT table than the one its ceiling defends — and 194 §33 "
                       f"split these into two rosters and two ceilings precisely so that "
                       f"one half could not grow while the other shrank in silence")
    if any("UNKNOWN TABLE" in p for v in got.values() for p in v):
        bad.append("_call_wiring: crash_problems() was handed a table this check cannot "
                   "name. A fourth call site was added and TABLE_KEY was not — the roster "
                   "of call sites is part of the claim, exactly like the roster of keys")
    return bad


def main() -> int:
    # 🔴 224 §6.6 — BEFORE THE SELF-CHECK, NOT AFTER. This gate rewrites TRACKED
    # files and restores them in a `finally`; a second one running now would read
    # and write the same tree. A self-check that ran first would be reading
    # somebody else's mutant and would report it as a defect in this repository.
    acquire("instrument_gate.py")
    problems: list[str] = []
    # 🔴 THIS GATE'S OWN SCOPE, FIRST. An INSTRUMENTS list quietly emptied to nothing
    # would sweep nothing, report nothing and exit 0 — the exact shape it exists to
    # catch, one level up. taut169, again, again.
    INSTRUMENT_FLOOR = 8   # governed by floor_pin_gate SIZE_LEDGER (§9.3)
    #                        176: 5 -> 7, tautology_gate.mjs and verdict_gate.mjs admitted
    print(f"INSTRUMENT_GATE instruments={len(INSTRUMENTS)} floor={INSTRUMENT_FLOOR}")
    problems.extend(_self_check(INSTRUMENT_FLOOR))
    if scope_collapsed(len(INSTRUMENTS), INSTRUMENT_FLOOR):
        problems.append(
            f"INSTRUMENT_GATE swept {len(INSTRUMENTS)} instrument(s), floor is {INSTRUMENT_FLOOR} — "
            f"a harness whose own target list collapsed sweeps nothing and exits 0"
        )

    # 🆕 212 §4 — THE ROSTER'S OWN COVERAGE, BEFORE A SINGLE MUTANT. It is not about any
    # one sweep's result; it is about whether the list those sweeps iterate is the module.
    problems.extend(coverage_problems(INSTRUMENTS))

    # 🆕 232 — AND THE HALF THAT ASKS WHAT JOINED THE TREE (231 §5.1). `coverage_problems`
    # above reads DOWN from the roster — every exported member of every instrument named.
    # This one reads UP from the tree, and the difference is the entire finding of 231 §20:
    # a roster can be complete about everything it contains and blind to everything it
    # does not. Its first run found `positive_control_gate.mjs`.
    _disc_files = discover_walk(DISCOVER_DIRS)
    _disc_problems, _disc = discovery_problems(
        # 🆕 245 §1 — THE JS INSTRUMENTS, not all of them. This walk is `.mjs` only by
        # design (see `DISCOVER_OUTSIDE_WALK`), so handing it the three Python entries
        # would report each of them OUTSIDE_WALK and invite three rows of prose excusing a
        # language. The Python roster is `py_discovery_problems` below and it is checked in
        # both directions the same way.
        _disc_files, [i for i in INSTRUMENTS if lang_of(i["src"]) == "js"],
        DISCOVER_EXEMPT, DISCOVER_OUTSIDE_WALK,
        DISCOVER_FLOOR, DISCOVER_MODULE_FLOOR, gate_scripts(INSTRUMENTS))
    print(f"INSTRUMENT_GATE_DISCOVER {_disc['files']} file(s) walked · "
          f"{_disc['modules']} export-bearing · {_disc['instruments']} instrument(s) · "
          f"{_disc['gates']} gate/driver(s) · {_disc['exempt']} exempt · "
          f"{_disc['outside']} outside the walk · {_disc['undeclared']} UNDECLARED "
          f"(floors {DISCOVER_FLOOR}/{DISCOVER_MODULE_FLOOR})")
    problems.extend(_disc_problems)
    _py_stage = collect_problems("py")
    problems.extend(_py_stage["late_locked"])

    # 🆕 245 §1 — 🔴 AND THE SAME QUESTION ASKED OF THE HALF OF THIS TREE THAT IS PYTHON.
    # The walk above is `.mjs` only, so for eighteen tracked `scripts/*.py` there was no
    # roster at all — not an empty one, none — and `blind-py-gates` said "seventeen" for
    # ten sessions while an eighteenth joined without a line moving. The comparison is an
    # EQUALITY rather than a floor: every walked file is an instrument or carries a reason,
    # and every reason names a file the walk found. A walk that returns nothing makes every
    # row stale and refuses, so this half needs no floor constant of its own.
    _py_problems = _py_stage["py_discover"]
    _py = py_discovery_stats(py_walk(ROOT), INSTRUMENTS, PY_NOT_SWEPT)
    print(f"INSTRUMENT_GATE_PY {_py['files']} tracked scripts/*.py · {_py['swept']} swept · "
          f"{_py['declared']} declared unswept · {_py['undeclared']} UNDECLARED · "
          f"{_py['stale']} stale row(s)")
    problems.extend(_py_problems)

    for inst in INSTRUMENTS:
        n_green, n_targets, probs = sweep(inst)
        problems.extend(probs)
        # ONE LINE PER INSTRUMENT. A total across all three would let one go blind while
        # the other two covered for it (172 §6, committed by the ledger written to stop it).
        print(f"INSTRUMENT_GATE_BLIND {inst['name']}: {n_green} of {n_targets} STILL GREEN")

    # ── THE SECOND AXIS (182) ───────────────────────────────────────────────────────
    # 🔴 SEPARATE LINES AND A SEPARATE PASS, NOT A SECOND COLUMN ON THE FIRST. The two
    # axes answer different questions — "can this finder match nothing" and "can it match
    # something ONCE and then stop" — and 181 §6 is the whole reason the second exists:
    # the first is satisfied by a floor at the top of the run, and the second is not.
    print("\n" + "=" * 78)
    print("INSTRUMENT_GATE_LATE — the same targets, blinded from their SECOND call")
    for inst in INSTRUMENTS:
        src = Path(inst["src"])
        if not src.exists():
            problems.append(f"{inst['name']}: {src} does not exist — the late axis swept nothing")
            continue
        n_green, n_targets, probs = late_sweep(inst, inst["gate"], src, "A:gate")
        problems.extend(probs)
        print(f"INSTRUMENT_GATE_LATE {inst['name']} [A:gate]: {n_green} of {n_targets} STILL GREEN")
        # 🆕 211 §5 — A BARE `continue` WAS A SKIPPED AXIS REPORTED IN GREEN, WHICH IS
        # THE SENTENCE THIS BLOCK'S OWN NEXT BRANCH USES ABOUT A MISSING ARTEFACT.
        # 🔴 MEASURED: ten instruments printed `[A:gate]`, EIGHT printed `[B:live]`, and
        # `INSTRUMENT_GATE_LATE_LIVE 8/8` read clean — because `LATE_LIVE_FLOOR` floors
        # the ROSTER against itself, not the instruments the roster is supposed to cover.
        # `seal_order_gate.mjs` and `wire_diff.mjs` got one axis instead of two and no
        # line said so. The file's own §592-595 argues the LIVE axis is the stronger one.
        #
        # Declared rather than demanded: some instruments genuinely have no live driver,
        # and the honest shape is the one `LATE_BLAST_FLOOR`'s exclusion note uses — say
        # it out loud in a table with a reason, so that a row going missing by accident
        # is distinguishable from a row that was never applicable.
        if inst["name"] not in LATE_LIVE:
            why = LATE_LIVE_NA.get(inst["name"]) or LATE_LIVE_LOCKED.get(inst["name"])
            # 🆕 277 §2 — the third table, and its reason is a price rather than a kind.
            if why is None and inst["name"] in LATE_LIVE_COST:
                _cmd, _secs = LATE_LIVE_COST[inst["name"]]
                why = (f"`{_cmd}` is a second command CI runs and it costs {_secs}s per "
                       f"mutant — {_secs * len(inst['targets']) // 60} minutes for this "
                       f"target list, over a budget of {LATE_LIVE_COST_BUDGET}s")
            if why is None:
                problems.append(
                    f"{inst['name']}: no LATE_LIVE entry and no LATE_LIVE_NA reason — it "
                    f"gets the [A:gate] axis and silently not the [B:live] one, which is "
                    f"the WEAKER of the two. Add the live driver, or declare why there "
                    f"cannot be one")
            else:
                print(f"INSTRUMENT_GATE_LATE {inst['name']} [B:live]: NOT RUN — {why}")
            continue
        cmd, alt = LATE_LIVE[inst["name"]]
        live_src = alt or src
        if not live_src.exists():
            problems.append(
                f"{inst['name']}: the live late axis needs {live_src.relative_to(ROOT)}, which does "
                f"not exist — build first (`npm run build`). A missing artefact is a SKIPPED axis, "
                f"and a skipped axis reported in green is what this gate exists to stop"
            )
            continue
        n_green, n_targets, probs = late_sweep(inst, cmd, live_src, "B:live")
        problems.extend(probs)
        print(f"INSTRUMENT_GATE_LATE {inst['name']} [B:live]: {n_green} of {n_targets} STILL GREEN")

    # 🔴 AND THE HARNESS'S OWN POPULATION, WHICH IS THE ONE NOTHING ELSE ABOVE COULD SEE.
    # Every line printed by the late axis is a judgement about a mutant that was BUILT. A
    # `late()` that stopped injecting files every target as "not constructible", raises no
    # problem, and lets this gate print ok over an axis that measured nothing — the exact
    # failure the axis exists to find, in the axis itself.
    print(f"INSTRUMENT_GATE_LATE_LIVE {len(LATE_LIVE)}/{LATE_LIVE_FLOOR}")
    print(f"INSTRUMENT_GATE_LATE_CONSTRUCTED {len(LATE_CONSTRUCTED)}/{LATE_CONSTRUCTED_FLOOR}")

    # ── 🆕 198 §3 — WHAT THE LATE AXIS'S RUNNER NOW HAS IN HAND AND USED TO DISCARD ──
    print(f"INSTRUMENT_GATE_LATE_NOT_LOADED {len(LATE_NOT_LOADED)}/{LATE_NOT_LOADED_CEILING}"
          f" mutant(s) produced no {LATE_MARK} line at all")
    _late = collect_problems("late")
    problems.extend(_late["not_loaded"])
    problems.extend(_late["late_roster"])
    # 🔴 TWO ROSTERS AND TWO CEILINGS, NOT ONE SUM (194 §33). `A:gate`'s nine are fixed by
    # editing the SELF-TESTS; `B:live`'s three are fixed by editing the caller-shape
    # harness. One number would let either half grow while the other shrank.
    print(f"INSTRUMENT_GATE_LATE_CRASHED [A:gate] {len(LATE_CRASHED_A)}/{LATE_CRASH_CEILING_A}"
          f" · [B:live] {len(LATE_CRASHED_B)}/{LATE_CRASH_CEILING_B} — red WITHOUT the gate "
          f"reaching its own verdict")
    problems.extend(_late["crash_late_a"])
    problems.extend(_late["crash_late_b"])
    # 🔴 THE BLAST, PER INSTRUMENT AND PER AXIS, NEVER SUMMED (172 §6). `A:gate` is floored;
    # `B:live` is printed and explicitly NOT floored — see LATE_BLAST_FLOOR for why, and
    # note that saying so is the point: an uncompared number that does not admit it is one
    # is 196 §33, and an uncompared number that does is a measurement with a reason.
    for (name, axis), n in sorted(LATE_BLAST_OBSERVED.items()):
        floor = (LATE_BLAST_FLOOR.get(name) if axis == "A:gate"
                 else LATE_LIVE_BLAST_FLOOR.get(name))
        if floor is None:
            # 🆕 245 §3 — `late-live-blast-unfloored` (244). A row reaching this branch on
            # the live axis must be in `LATE_LIVE_BLAST_UNCOUNTABLE`, and the row is REFUSED
            # the moment the number beside it is not zero: the exclusion's whole content is
            # "this command prints no per-claim FAIL line", and a nonzero blast is that
            # sentence being false in the output the same run produced.
            if axis == "B:live":
                why = LATE_LIVE_BLAST_UNCOUNTABLE.get(name)
                if why is None:
                    problems.append(
                        f"{name} [B:live]: {n} failure line(s) and NO floor — every live "
                        f"axis is floored or carries a written reason it cannot be, and "
                        f"this one is neither")
                elif n:
                    problems.append(
                        f"{name} [B:live]: declared uncountable — {why} — and this run "
                        f"counted {n} failure line(s) on that axis. The reason has expired "
                        f"(174 §5): give it a floor. This is exactly the sentence 244 §4.4 "
                        f"made false for two commands and nothing re-derived")
                else:
                    print(f"INSTRUMENT_GATE_LATE_BLAST {name} [{axis}]: {n} — uncountable "
                          f"on this axis, declared: {why[:60]}")
                continue
            print(f"INSTRUMENT_GATE_LATE_BLAST {name} [{axis}]: {n} — NOT floored on this "
                  f"axis, on purpose")
            continue
        print(f"INSTRUMENT_GATE_LATE_BLAST {name} [{axis}]: {n}/{floor}")
        if n < floor:
            problems.append(
                f"{name} [{axis}]: the late axis produced {n} reported failure(s), floor is "
                f"{floor} — its late blinds have stopped reddening what they used to, and "
                f"'the gate went red' cannot tell you that on its own")
    for stale in sorted(set(LATE_BLAST_FLOOR) - {i["name"] for i in INSTRUMENTS}):
        problems.append(f"LATE_BLAST_FLOOR names {stale!r}, which is not an instrument")
    # 🆕 245 §3 — BOTH DIRECTIONS OVER BOTH NEW TABLES. A name in neither is caught in the
    # loop above; a name in BOTH is a floor and an excuse for the same axis, and a name in
    # neither table nor the roster is a row outliving its subject (174 §5).
    _names = {i["name"] for i in INSTRUMENTS}
    for stale in sorted((set(LATE_LIVE_BLAST_FLOOR) | set(LATE_LIVE_BLAST_UNCOUNTABLE)) - _names):
        problems.append(
            f"the B:live blast tables name {stale!r}, which is not an instrument")
    for both in sorted(set(LATE_LIVE_BLAST_FLOOR) & set(LATE_LIVE_BLAST_UNCOUNTABLE)):
        problems.append(
            f"{both} is FLOORED on the B:live axis and declared UNCOUNTABLE on it. One of "
            f"the two is wrong and this file cannot decide which")
    for missing in sorted(_names - set(LATE_LIVE_BLAST_FLOOR) - set(LATE_LIVE_BLAST_UNCOUNTABLE)):
        problems.append(
            f"{missing} has no B:live blast row — neither a floor nor a written reason it "
            f"cannot have one. 244's version of this sentence was a description of five "
            f"files that outlived them by twelve commands")
    # 🆕 211 §5 — AND THE OTHER HALF, WHICH `BLAST_FLOOR` HAS HAD SINCE 183 AND THIS
    # AXIS NEVER GOT. The loop above catches a roster naming something that is not an
    # instrument. Nothing caught an INSTRUMENT the roster does not name.
    #
    # 🔴 MEASURED IN A GREEN RUN, NOT REASONED ABOUT. `LATE_BLAST_FLOOR` carried nine
    # rows for ten instruments, and the missing one printed:
    #
    #     INSTRUMENT_GATE_LATE_BLAST wire_diff.mjs [A:gate]: 99 — NOT floored on this
    #                                                            axis, on purpose
    #
    # It was not on purpose. `floor is None` means two different things on the two axes —
    # on `B:live` it is the declared exclusion the comment above describes, and on
    # `A:gate` it is nobody having written the row — and the printed line asserts the
    # first one for both. 🔴 THAT IS 210 §16's RULE POINTED AT A REPORT RATHER THAN A
    # READER: the line's population is "floors that exist", the answer "this row was
    # never written" is not in it, and the output is a green sentence claiming intent.
    for missing in sorted({i["name"] for i in INSTRUMENTS} - set(LATE_BLAST_FLOOR)):
        problems.append(
            f"{missing} has no LATE_BLAST_FLOOR — the late axis prints its blast as "
            f"'NOT floored on this axis, on purpose', which is a sentence about the "
            f"OTHER axis. An instrument whose late blinds stop reddening anything would "
            f"read exactly the same. Measure it and add the row, or move it to a table "
            f"that says out loud it is excluded")
    # 🆕 195. THE THIRD POPULATION OF THIS HARNESS, AND IT IS A DIFFERENT COLLAPSE FROM
    # BOTH ABOVE. `LATE_CONSTRUCTED` counts blinds that were BUILT; this counts anchors
    # that were RESOLVED. An author replacing one placeholder with the literal it resolves
    # to today changes no printed line and no verdict — the row simply goes back to being
    # outrun by the next parameter, one row at a time, which is how the class arrived.
    # `literal_signature_problems` refuses that edit and this number is what notices if
    # the refusal stops being applied.
    print(f"INSTRUMENT_GATE_SIG {len(SIG_RESOLVED)}/{SIG_RESOLVED_FLOOR}")
    if len(SIG_RESOLVED) < SIG_RESOLVED_FLOOR:
        problems.append(
            f"INSTRUMENT_GATE resolved {len(SIG_RESOLVED)} `{{SIG:}}` anchor(s), floor is "
            f"{SIG_RESOLVED_FLOOR} — targets have gone back to literal signatures, and a literal "
            f"signature is an anchor with an expiry date nobody is told about"
        )
    if len(LATE_CONSTRUCTED) < LATE_CONSTRUCTED_FLOOR:
        problems.append(
            f"INSTRUMENT_GATE_LATE built {len(LATE_CONSTRUCTED)} late blind(s), floor is "
            f"{LATE_CONSTRUCTED_FLOOR} — a target whose counter never fires is filed as 'not "
            f"constructible' and reported in green, so an injector that stopped injecting reads "
            f"exactly like a tree where nothing is called twice"
        )

    # ── 🔴 197 §5. THE BLAST RADIUS, AND THE BLINDS THAT CRASH RATHER THAN FAIL ──────
    # One line per instrument, never summed (172 §6). `green()` had every one of these
    # numbers in hand on every run since this file was written, and returned a boolean.
    print("")
    for inst in INSTRUMENTS:
        n = BLAST_OBSERVED.get(inst["name"], 0)
        caught = CAUGHT_OBSERVED.get(inst["name"], 0)
        floor = BLAST_FLOOR.get(inst["name"])
        print(f"INSTRUMENT_GATE_BLAST {inst['name']}: {n}/{floor} failure line(s) reported "
              f"across its blinds · {caught} caught")
        # ── 🆕 278 — `BLAST_UNREADABLE`, AND IT IS THE THIRD TIME THIS WAS MEASURED ────
        #
        # 🔴 A BLAST OF ZERO OVER BLINDS THAT REDDENED IS THE READER FAILING, NOT THE
        # TREE PASSING. `failure_lines` sums four dialects; an instrument reporting in a
        # fifth returns zero from it while its gate exits 1 on every mutant, so the floor
        # a session takes from that measurement is a floor at NOTHING — 172 §10.21 inside
        # the table built to stop it.
        #
        # 🔴 THREE TIMES, AND UNTIL NOW NOTHING REFUSED IT. 245 §1 recorded the first
        # three Python instruments measuring 0/0/0 while their self-tests reported real
        # failed claims. 277 §4 recorded `handoff_gate.py` measuring ZERO across
        # fifty-six blinds every one of which reddened, and added a fourth dialect.
        # 278 measured `release_names.py` at ZERO across ten, and added a fifth. Each
        # session found it by hand, on the run that added the instrument, and each wrote
        # the lesson into a comment rather than into a refusal — so the next one paid for
        # it again. This is the refusal.
        #
        # 🔵 IT CANNOT FIRE ON A HEALTHY TREE AND IT CANNOT FIRE ON AN HONEST ZERO. An
        # instrument whose sweep caught nothing has `caught == 0` and is already refused,
        # loudly, one line per target, by `STILL GREEN`. The only state this reaches is
        # the one that has cost three sessions: reddening blinds, an unreadable report.
        if caught and n == 0:
            problems.append(
                f"{inst['name']}: BLAST_UNREADABLE — {caught} blind(s) were CAUGHT and "
                f"`failure_lines` read ZERO failure line(s) off them. The gate is working "
                f"and the reader that counts its output is not: this instrument reports in "
                f"a dialect none of the patterns in `failure_lines` can spell, and a "
                f"BLAST_FLOOR taken from this run would be a floor at nothing (172 §10.21). "
                f"Add the dialect beside `A_FAIL`..`E_FAIL` and assert it in `selftest()` — "
                f"245, 277 and 278 each measured this by hand and none of them left a "
                f"refusal behind")
        if floor is None:
            problems.append(
                f"{inst['name']} has no BLAST_FLOOR — its sweep could stop reddening "
                f"anything at all and every line above would still print ok")
        elif n < floor:
            problems.append(
                f"{inst['name']}: BLAST {n} < {floor} — its blinds redden LESS than when this "
                f"floor was measured. The per-instrument BLIND count cannot see this: a gate "
                f"that still exits 1 while reporting half as many failures is a gate getting "
                f"quieter, and 196 §3 is what that silence costs")
    for stale in sorted(set(BLAST_FLOOR) - {i["name"] for i in INSTRUMENTS}):
        problems.append(f"BLAST_FLOOR names {stale!r}, which is not an instrument")
    print(f"INSTRUMENT_GATE_BLAST_TOTAL {sum(BLAST_OBSERVED.values())} across "
          f"{len(INSTRUMENTS)} instrument(s) — PRINTED, NOT FLOORED\n"
          f"                             (172 §6: the sum is the number that hides a collapse)")
    print(f"INSTRUMENT_GATE_CRASHED {len(CRASHED)}/{CRASH_CEILING} blind(s) went red WITHOUT "
          f"their gate reaching its own\n"
          f"                        verdict — a CEILING, and every one declared with its reason")
    _final = collect_problems("final")
    problems.extend(_final["crash"])
    problems.extend(_final["roster"])

    if problems:
        print("")
        for p in problems:
            print(f"🔴 {p}")
        print(
            "\n   Every line above is a finder that can match NOTHING while its gate stays green.\n"
            "   Give the population it derives a LITERAL floor, in the gate that reads it — never a\n"
            "   floor supplied by the same finder (172 §10.21: `len(x) >= len(x)` wearing a disguise).\n"
            "   And if an instrument has no headless gate at all, that is not a clean sweep — it is\n"
            "   an instrument this harness cannot say anything about.\n"
            "\nINSTRUMENT_GATE 🔴 FAILED"
        )
        return 1

    # 🔴 THE VERDICT NAMES WHAT IT ACTUALLY VERIFIED (174 §5). "Every instrument collapses
    # LOUDLY" was the line printed over nine blinds that crashed their gate rather than
    # failing it, and over one that never compiled — for 25 commits.
    print("\nINSTRUMENT_GATE ok — every instrument collapses LOUDLY: each blind reddened its "
          "gate,\n"
          "                    each gate REACHED ITS OWN VERDICT (or is one of the "
          f"{len(CRASHED)} declared\n"
          "                    crashes), and each instrument reported at least its floor of "
          "failure lines")
    return 0


if __name__ == "__main__":
    # 🆕 228 — `run_and_settle` and not `main`: the mutation record has to close on
    # EVERY exit path, and this file has more than one. See _gate_lock.run_and_settle.
    sys.exit(run_and_settle("instrument_gate.py", main))
