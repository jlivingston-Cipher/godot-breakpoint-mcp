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
SIG_RESOLVED_FLOOR = 70
SIG_RESOLVED: set[str] = set()


def resolve_target(inst_name: str, text: str, sig: str) -> tuple[str, str]:
    anchor, problem = resolve_sig(text, sig)
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
            "{SIG:verdict}": "return { blocks: 0, attributed: 0, shaped: 116, precondition: 61, vacuous: [], every: [], offender: [] };",
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
            # 🔴 A LITERAL, AND THE ONLY ONE ADDED THIS SESSION. `{SIG:judgeDiscarded}`
            # RESOLVES TO NOTHING: this declaration's parameter list spans two lines and
            # `_decl_re` matches a single line ending in `{`. That is the resolver working
            # — an unappliable target is a sweep reporting green over a mutation nobody
            # made — and `literal_signature_problems` will not report this literal for the
            # same reason, because the placeholder does not resolve to it. A multi-line
            # signature widening is a real next item and is NOT scoped to this file.
            "export function judgeDiscarded(sites, floor = DISCARD_SITE_FLOOR, dirFloor = DISCARD_DIR_FLOOR,\n"
            "                               busiestFloor = DISCARD_BUSIEST_FLOOR) {":
                "return { lines: [], failed: false };",
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
        "floor": 3,   # every one of the three targets must be swept
        "why": "the reader that decides whether an empty collection was ever proved able "
               "to be non-empty",
        # The empty each member's own contract promises, read off the returns rather than
        # guessed: `classify` and `acceptance` return arrays of rows, `judge` returns
        # `{lines, failed, codes}` and `failed:false` is the shape that passes silently.
        "targets": {
            "{SIG:classify}": "return [];",
            "{SIG:acceptance}": "return [];",
            "{SIG:judge}": "return { lines: [], failed: false, codes: [] };",
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
_EXPORT_FN = re.compile(r"^export[ \t]+(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(")
_EXPORT_ARROW = re.compile(
    r"^export[ \t]+(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(?:async[ \t]+)?\(")

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
    ("positive_control_gate.mjs", "main"):
        "the invocation, not a reader — see verdict_gate.mjs::main. The three readers it "
        "calls are targeted individually and `scan` is reached by the live axis.",
}


def coverage_problems(instruments) -> list[str]:
    """Every exported callable is a target or carries a written reason — 🆕 212 §4."""
    problems: list[str] = []
    declared = set(NOT_A_TARGET)
    for inst in instruments:
        src: Path = inst["src"]
        if not src.exists():
            continue
        exported: list[str] = []
        for ln in src.read_text().split("\n"):
            m = _EXPORT_FN.match(ln) or _EXPORT_ARROW.match(ln)
            if m:
                exported.append(m.group(1))
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
              f"exported member(s) targeted · {len(excused)} declared NOT_A_TARGET")
        for n in missing:
            problems.append(
                f"{inst['name']}: `{n}` is EXPORTED and is neither a target nor declared in "
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
    "node scripts/token-cost.mjs --summary": "TOKEN_COST ",
    "node scripts/wire_invisible_gate.mjs": "WIRE_INVISIBLE_SURFACE ",
    "node scripts/wire_diff.mjs --discover": "WIRE_DIFF_KEY ",
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
    ("tautology_gate.mjs", "{SIG:combineFailed}", "A:gate"):
        "a 2x2 truth table called three times with LITERAL fixtures, not once per member "
        "of a population. Only `combineFailed(false, {failed:true})` can distinguish the "
        "function from `failedSoFar`, and it is the FIRST case — so a late blind here "
        "deletes the cases AFTER the discriminating one and measures case ORDER rather "
        "than coverage. The live axis calls it once, so it is N/A there.",
}


def late(text: str, sig: str, empty: str) -> str | None:
    """`empty` becomes the body from the SECOND call onwards. Same anchor as blind().

    🔴 AND THE SAME BRACE, VIA THE SAME FUNCTION (197 §5). This injector carried an
    identical copy of `text.find("{", idx)`, so it had the identical destructured-parameter
    bug — and on THIS axis the failure is quieter still, because a mutant that does not
    parse reports `calls=0` and is filed as "not constructible", which raises no problem at
    all. Two copies of one wrong line is 180 §7.1's class; there is now one.
    """
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
CI_RUN_RE = re.compile(r"^\s*-?\s*run:\s*(node\s+[^\n]+)$", re.M)
CI_COMMAND_FLOOR = 8


def ci_node_commands(text: str) -> set[str]:
    """Every single-line `run: node …` step in ci.yml, whitespace-normalised."""
    return {" ".join(m.group(1).split()) for m in CI_RUN_RE.finditer(text)}


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
        gate = " ".join(inst["gate"])
        src_name = Path(inst["src"]).name
        second = sorted(c for c in ci_cmds
                        if c != gate and len(c.split()) > 1
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
}
LATE_BLAST_OBSERVED: dict[tuple[str, str], int] = {}
LATE_CRASHED_A: list[tuple[str, str]] = []
LATE_CRASHED_B: list[tuple[str, str]] = []


# 🔴 THE FLOOR ON THE HARNESS ITSELF, AND THE REVERSE SWEEP IS WHY IT EXISTS. Make
# `late()` return the text unmodified and EVERY target reports `calls=0`, every one is
# filed as "not constructible", no problem is raised and the gate prints ok — the whole
# second axis neutralised in silence, which is the exact defect it was built to find, one
# level up. `>=`, and measured at 70 of 84 across both axes.
LATE_CONSTRUCTED_FLOOR = 98   # governed by floor_pin_gate SIZE_LEDGER (§9.3)
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
DISCOVER_EXEMPT: dict[str, str] = {}

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
        for sig, empty in inst["targets"].items():
            anchor, sig_problem = resolve_target(inst["name"], original, sig)
            if sig_problem:
                problems.append(f"{inst['name']} [{axis}]: {sig_problem}")
                continue
            mutant = late(original, anchor, empty)
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
    for _name, _v in LATE_BLAST_FLOOR.items():
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


def failure_lines(out: str, _name: str = "") -> int:
    """How many failures the gate REPORTED. Not the exit code — the count."""
    c = C_FAIL.findall(out)
    return len(A_FAIL.findall(out)) + len(B_FAIL.findall(out)) + (int(c[-1]) if c else 0)


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
    p = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if p.returncode == 0:
        return ""
    err = [ln for ln in (p.stderr + p.stdout).split("\n") if "Error" in ln]
    return (err[0] if err else "node --check failed with no recognisable error line").strip()


def blind(text: str, sig: str, empty: str) -> str | None:
    """Inject `empty` as the first statement of the member whose signature is `sig`."""
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
}
BLAST_OBSERVED: dict[str, int] = {}
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
        for sig, empty in targets.items():
            anchor, sig_problem = resolve_target(inst["name"], original, sig)
            if sig_problem:
                problems.append(f"{inst['name']}: {sig_problem}")
                print(f"   🔴 UNRESOLVED  {sig}")
                continue
            mutant = blind(original, anchor, empty)
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
        _disc_files, INSTRUMENTS, DISCOVER_EXEMPT, DISCOVER_OUTSIDE_WALK,
        DISCOVER_FLOOR, DISCOVER_MODULE_FLOOR, gate_scripts(INSTRUMENTS))
    print(f"INSTRUMENT_GATE_DISCOVER {_disc['files']} file(s) walked · "
          f"{_disc['modules']} export-bearing · {_disc['instruments']} instrument(s) · "
          f"{_disc['gates']} gate/driver(s) · {_disc['exempt']} exempt · "
          f"{_disc['outside']} outside the walk · {_disc['undeclared']} UNDECLARED "
          f"(floors {DISCOVER_FLOOR}/{DISCOVER_MODULE_FLOOR})")
    problems.extend(_disc_problems)

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
            why = LATE_LIVE_NA.get(inst["name"])
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
        floor = LATE_BLAST_FLOOR.get(name) if axis == "A:gate" else None
        if floor is None:
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
        floor = BLAST_FLOOR.get(inst["name"])
        print(f"INSTRUMENT_GATE_BLAST {inst['name']}: {n}/{floor} failure line(s) reported "
              f"across its blinds")
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
