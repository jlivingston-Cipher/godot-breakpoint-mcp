#!/usr/bin/env python3
"""control_gate.py — session 187. THE POSITIVE CONTROL, WHICH IS THE ONLY THING THAT CAN
COVER A STATEMENT THAT RUNS ONLY WHEN THE TREE IS BROKEN.

182 §11.3 asked what `CHECKS_RUN 20/20` actually proves. 186 answered it, and the answer
is the reason this file exists:

    70 errors.append/extend statement(s) in contract_check.py
    EXECUTED BY SOMETHING: 23 of 70      NEVER EXECUTED BY ANYTHING: 47

`CHECKS_RUN` counts BLOCKS that reach their own end. Two thirds of the statements inside
those blocks had never run, and FIVE WHOLE CHECKS — 17, 22, 3, 11c and `host` — had no
executed failure statement at all. A check whose every failure statement is unexecuted is
indistinguishable, from the outside, from a check that cannot fail.

🔴 THE COUNTER IS NOT THE FIX, AND THAT WAS MEASURED RATHER THAN ASSUMED. 185 proposed
"delete each `errors.append(...)` in turn and ask what notices", and 186 showed the sweep
is meaningless as written: every one of those statements is unreachable on a healthy tree,
so deleting any of them changes nothing and the answer is trivially 70 of 70. A
per-statement counter is the same mistake one level down — it would count statements that
exist, which is what the roster already does.

What covers a statement that only runs when the tree is broken is a POSITIVE CONTROL: a
mutation that makes exactly that statement fire, asserted to fire. `scope_gate.py` is
already that for 25 enumerators, and its 25 blinded runs are precisely where 186's 23
executed statements came from. THIS FILE IS THE SAME IDEA POINTED AT THE SUBJECT INSTEAD
OF THE FINDER: it breaks the tree the way each check says it is guarding against, and
requires the check to say so.

Each control below answers the handoff's question for one statement — *what one-line tree
edit should redden it?* — and 187 asked it of all seventeen statements in the five checks
at zero before writing a line of this file. 🔴 **ALL SEVENTEEN HAVE ONE.** The alternative
finding was live: a statement with no such edit is a statement that cannot fire, and the
handoff's instruction for that case was to DELETE it rather than count it. None qualified.

Three properties are asserted per control, and the second is the one 181 paid for:

  * the run goes RED                    — the check noticed
  * the run EXECUTED                    — it printed the report marker, so 'red' is a
                                          verdict and not a crash on the way in
  * the EXPECTED statement fired        — a fingerprint resolving, statically, to exactly
                                          ONE errors.append in the file

The third is what makes this a control rather than a smoke test. Without it, any mutation
that reddens the run for any reason at all would count as covering whatever statement the
table claims — the harness would be measuring itself.

🔴 IT MUTATES THE WORKING TREE AND RESTORES IN A `finally`, THEN ASSERTS BYTE-IDENTITY.
Do not run it concurrently with `scope_gate.py`, `instrument_gate.py` or the reverse
sweeps (178 §11.4).

Run: python3 scripts/control_gate.py   (a CI step beside the scope and floor-pin gates)
"""
from __future__ import annotations

import ast
import atexit
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CC = ROOT / "scripts" / "contract_check.py"
MUT = ROOT / "scripts" / "_control_gate_mutant.py"

# 🔴 THE LINE contract_check.py PRINTS ONLY IF IT GOT AS FAR AS REPORTING (181 §4, and
# scope_gate.py's REPORT_MARKER for the identical reason). A SyntaxError and a violation
# are both `returncode != 0`; without this discriminator "caught" and "never ran" are one
# observable, and this gate would report the first while meaning the second.
REPORT_MARKER = "=== breakpoint-mcp static contract check ==="

PROJ = "example/project.godot"
AUTOLOAD = 'BreakpointRuntimeBridge="*res://addons/breakpoint_mcp/runtime_bridge.gd"'

# ── 🔴 THE ANCHORS THAT A NORMAL CHANGE MOVES, AND WHY THEY ARE PLACEHOLDERS ──────
#
# 188 §2. `host.drift` shipped in 187 anchored on the literal `> **npm 1.62.0 ·`, and the
# VERY NEXT COMMIT — the 1.63.0 release cut, six version fields across five files — moved
# it. CI went red on the release itself with `CONTROL_GATE_ANCHOR host.drift: 0
# occurrence(s) of the anchor in README.md`, and the local run had been green minutes
# earlier because it ran BEFORE the bump.
#
# 🟢 THE ANCHOR ASSERTION IS WHY THAT WAS A FAILURE AND NOT A SILENT PASS (180 §9.3): a
# control whose `old` no longer matches applies nothing and would otherwise report `ok`
# over a mutation that never happened. So the guard worked. What was wrong is the anchor.
#
# 🔴 AND IT IS A CLASS, NOT ONE ROW. `11c.drift` anchors on `684-test suite`, which moves
# the day anybody adds a test. Both rows embed a number the tree DERIVES elsewhere, so the
# control is pinned to a moment rather than to the invariant it is testing. These
# placeholders resolve against the SOURCE OF TRUTH — not against the file being mutated,
# which would make the anchor trivially self-satisfying and take 180 §9.3's guard away.
#
#   {V}      the live host version, from host/package.json
#   {TESTS}  the live count of test declarations under host/test — TEST_DECL_RE's
#            population, which is exactly what check 11c compares the prose against
#
# `_self_check()` refuses any control whose LITERAL anchor embeds either number, so the
# next author who types today's version into a row is told to use the placeholder instead
# of finding out one release later.
TEST_DECL_RE = re.compile(r"^[ \t]*(?:await[ \t]+)?(?:test|it)[ \t]*\(", re.M)


def live_version() -> str:
    m = re.search(r'^  "version": "([^"]+)",', (ROOT / "host/package.json").read_text(), re.M)
    return m.group(1) if m else ""


def live_tests() -> str:
    return str(sum(len(TEST_DECL_RE.findall(p.read_text(encoding="utf-8")))
                   for p in sorted((ROOT / "host/test").rglob("*.ts"))))


def live_checks() -> str:
    """The size of contract_check.py's CHECKS_EXPECTED roster — 192, and it is the THIRD
    member of the class 188 §2 opened rather than a new idea.

    `22.floor` anchored on the LITERAL `CHECKS_RUN_FLOOR = 20`, and adding check 23 to the
    roster moved it — the same failure `host.drift` had at the 1.63.0 cut, arriving from
    the other direction: not a release outrunning the anchor, but the very act the control
    exists to guard. A row that guards "a check went missing" cannot be pinned to how many
    checks there are today.

    Resolved against the ROSTER, never against `CHECKS_RUN_FLOOR` itself — the floor is
    what the control mutates, and an anchor read off the mutated line would be trivially
    self-satisfying and would take 180 §9.3's guard away.
    """
    m = re.search(r"CHECKS_EXPECTED = \((.*?)\)", (ROOT / "scripts/contract_check.py").read_text(), re.S)
    return str(len(re.findall(r'"[^"]+"', m.group(1)))) if m else ""


def resolve(s: str) -> str:
    return (s.replace("{V}", live_version())
             .replace("{TESTS}", live_tests())
             .replace("{CHECKS}", live_checks()))


# ── 🔴 THE THREE DETECTORS BELOW ARE PURE FOR ONE REASON, AND MUTATE188 IS THE REASON ──
#
# Each was written inline first, and the reverse sweep declared three of them GREEN: on a
# healthy tree every anchor matches exactly once, every row uses a placeholder and every
# statement carries a literal, so each branch is EMPTY here and deleting it is invisible
# to every live run. That is 176's rule — `gate_failed` was lifted out for exactly this —
# arriving one level down, at the detectors instead of at the verdict.
#
# Lifted out, `_self_check()` can feed each one an input it MUST flag, so the branch is
# asserted rather than merely present. The sweep's U1/U7/U8 are what these three answer.

def derived_literal_problems(rows, values) -> tuple[list[str], int]:
    """(problems, rows actually read) — anchors spelling out a number the tree derives.

    🔴 THE SECOND RETURN VALUE IS NOT DECORATION. On a healthy tree `problems` is empty,
    so an audit over ONE row and an audit over forty-two are the same observable, and
    trimming the input is invisible — mutate188's U1. The count is what the caller pins.
    """
    rows = list(rows)
    out: list[str] = []
    for name, value in values:
        if not value:
            out.append(
                f"{name} resolves to nothing — its source of truth moved, and every anchor "
                f"using it would silently stop matching. Fix the derivation, not the rows."
            )
            continue
        for cid, _c, _k, _t, old, new, _fp in rows:
            if value in old or value in new:
                out.append(
                    f"{cid}: the anchor embeds the live value {value!r}, which this tree "
                    f"derives. Write {name} instead — a literal here is outrun by the next "
                    f"release or the next test, and the row stops applying anything."
                )
    return out, len(rows)


def anchor_problem(text: str, old: str) -> int | None:
    """The occurrence count, when it is not exactly one — 180 §9.3's trap.

    Returns None when the anchor is applicable. A row whose anchor matches zero times
    applies NOTHING, and without this the sweep prints `ok` over a mutation it never made.
    """
    n = text.count(old)
    return None if n == 1 else n


def unfingerprintable(stmts: list[tuple[int, str, str]]) -> list[int]:
    """Statements carrying no string literal of their own, so no row can ever name one."""
    return sorted({ln for ln, _lb, _b in stmts} - set(auto_fingerprints(stmts)))

# ── the controls ──────────────────────────────────────────────────────────────────
#
# (id, check, kind, target, old, new, fingerprint)
#
#   kind "sub"    — substitute in a real tree file; restored, then byte-compared
#   kind "rename" — move a real path aside; restored, then existence-compared
#   kind "src"    — substitute in a COPY of contract_check.py, run as the mutant. The
#                   tree is NOT touched, because check 22's subject IS this file: its
#                   four statements are about the roster of blocks that ran, and the
#                   only edit that can fire them is an edit to the roster.
#
# 🔴 EVERY `old` IS ASSERTED TO OCCUR EXACTLY ONCE BEFORE IT IS APPLIED. An anchor that
# has stopped matching is 180 §9.3's trap and floor_pin_gate.py's FLOOR_PIN_ANCHOR one
# file over: the sweep reports a clean pass over a control it never applied.
CONTROLS: list[tuple[str, str, str, str, str, str, str]] = [
    # ── check 3 — tool-name uniqueness + net completeness ─────────────────────────
    ("3.dupe", "3", "sub", "host/src/tools/assetgen.ts",
     '"asset_gen_placeholder",', '"asset_gen_configure",',
     "Duplicate registerTool names:"),
    # The net's own completeness. A name the strict net misses is not under-reported, it
    # is ABSENT — invisible to checks 3, 4, 6 and 11 at once, with output byte-identical
    # to a clean run. A space is the cheapest name `[a-z0-9_]+` cannot match and the
    # permissive re-scan can.
    ("3.uncaptured", "3", "sub", "host/src/tools/assetgen.ts",
     '"asset_gen_placeholder",', '"asset gen placeholder",',
     "whose name the scanner cannot match"),

    # ── check 11c — the test suite's own size ─────────────────────────────────────
    # The vacuous-anchor case, and the only control here that is not a text edit: the
    # statement fires when NOTHING can be counted, so the subject has to go away. That
    # is exactly what its message asks — "has the suite moved?"
    ("11c.vacuous", "11c", "rename", "host/test", "", "",
     "Could not count any test declaration under host/test"),
    ("11c.drift", "11c", "sub", "README.md",
     "{TESTS}-test suite", "0-test suite",
     "Host test-suite size drift"),

    # ── check host — the release ritual's five files ──────────────────────────────
    # `.version` absent is a FAILURE and not a skip, which is the whole point of that
    # branch; renaming the key is the lockfileVersion-1 shape without a fake lockfile.
    ("host.nofield", "host", "sub", "host/package-lock.json",
     '{\n  "name": "breakpoint-mcp",\n  "version":',
     '{\n  "name": "breakpoint-mcp",\n  "versionX":',
     "so check 14 cannot verify it"),
    # 🔴 `0.0.0` RATHER THAN "the previous version", which is what shipped in 187 and what
    # the release moved. A literal that is never any real version cannot become correct by
    # accident, and the anchor tracks the bump instead of being outrun by it.
    ("host.drift", "host", "sub", "README.md",
     "> **npm {V} ·", "> **npm 0.0.0 ·",
     "Host version drift"),

    # ── check 23 — the wire's vocabulary, across the language boundary ────────────
    # SIX statements, SIX controls, registered in the SAME commit as the check. 191 §9.3
    # has carried "thirty-one statements still have no control" for four sessions; a new
    # check that ships uncontrolled makes that number worse while looking like progress.
    #
    # Each control names EXACTLY ONE statement, which took some arranging: the obvious
    # mutation for "a tag emitted but not decodable" is to RENAME a tag in encode(), and
    # that fires two statements at once (the new name is undecodable, the old name's
    # decode arm is now dead). Every row below therefore ADDS a branch rather than
    # renaming one — the shape a forgotten decode arm actually takes in the wild.
    ("23.encode_only", "23", "sub", "addons/breakpoint_mcp/variant_json.gd",
     "\t\tTYPE_QUATERNION:\n",
     "\t\tTYPE_TRANSFORM3D:\n\t\t\treturn {\"__type__\": \"Transform3D\", \"m\": 0}\n\t\tTYPE_QUATERNION:\n",
     "has no decode() arm"),
    ("23.decode_only", "23", "sub", "addons/breakpoint_mcp/variant_json.gd",
     "\t\t\t\t\"Resource\":\n",
     "\t\t\t\t\"Transform3D\":\n\t\t\t\t\treturn null\n\t\t\t\t\"Resource\":\n",
     "has a decode() arm that nothing in encode() can produce"),
    # The exemption going STALE in the direction nobody expects: not by deleting the
    # entry, but by the tag quietly becoming decodable and the entry staying put.
    ("23.oneway_stale", "23", "sub", "addons/breakpoint_mcp/variant_json.gd",
     "\t\t\t\t\"Resource\":\n",
     "\t\t\t\t\"Object\":\n\t\t\t\t\treturn null\n\t\t\t\t\"Resource\":\n",
     "as deliberately one-way, but it is no longer both"),
    ("23.ts_tag", "23", "sub", "host/src/tools/tabletop.ts",
     '{ __type__: "Color", r, g, b, a }', '{ __type__: "Colour", r, g, b, a }',
     "cannot read. It reaches GDScript as a plain Dictionary"),
    # 🔴 THE FIELD HALF. The tag name still matches, so every name-based check stays
    # green; GDScript reads `j.get("y", 0.0)`, finds nothing, and builds Vector2(x, 0).
    ("23.ts_fields", "23", "sub", "host/src/tools/tabletop.ts",
     '{ __type__: "Vector2", x, y }', '{ __type__: "Vector2", x, z: y }',
     "Variant without field(s)"),
    # 🔴 THE ONE WITH CONSEQUENCES. This is the board-overwrite refusal: with the code
    # renamed on either side the branch stops firing and `board_create overwrite:true`
    # appends to the stale open tab instead of refusing. `tabletop_guard.test.ts` passes
    # either way, because it constructs the thrown error itself.
    ("23.err_branch", "23", "sub", "host/src/tools/tabletop.ts",
     '?.code === "unsupported"', '?.code === "unsupported_v2"',
     "branches on the addon error code"),
    # 🔴 THE SEVENTH ROW EXISTS BECAUSE THE REVERSE SWEEP REFUTED THE SIXTH (192 §6). The
    # row above mutates the HOST side, where the code becomes a word GDScript never says
    # and the vocabulary test catches it. Mutant C1 mutated the ADDON side instead — the
    # one `_scene_close` raise site the refusal actually depends on — and the run stayed
    # GREEN, because `"unsupported"` is raised at seven other sites and the vocabulary
    # never moved. Same defect, opposite side of the wire, and only the handler-level
    # binding can see it. A control per SIDE, not per statement.
    ("23.err_binding", "23", "sub", "addons/breakpoint_mcp/operations.gd",
     'return _err("unsupported", "scene_close requires Godot 4.4+',
     'return _err("unsupported_v2", "scene_close requires Godot 4.4+',
     "but that method's GDScript handler cannot return it"),

    # ── check 24 — one word, two meanings, and the copies nobody compared ────────
    # Three statements, three controls, in the same commit. 191 §9.3 has complained for
    # four sessions that 31 statements have no control; 192 answered it by shipping check
    # 23 covered, and a session that shipped 24 blind would make the complaint worse while
    # looking like progress. CONTROL_GATE_BLIND stays at 31 for that reason.
    #
    # 🔴 THE CLASSIFIER LOSING A SITE. Not by deleting the raise — that is check 23's
    # population — but by moving it out of reach of its own guard, which is what an
    # early-return refactor does. The site is still raised, the vocabulary is unchanged,
    # and only the KIND becomes unreadable.
    ("24.unclassified", "24", "sub", "addons/breakpoint_mcp/operations.gd",
     '\tif not EditorInterface.has_method("close_scene"):\n\t\treturn _err("unsupported", "scene_close requires Godot 4.4+',
     '\tvar _gate := EditorInterface.has_method("close_scene")\n\t# 1\n\t# 2\n\t# 3\n\t# 4\n\t# 5\n\treturn _err("unsupported", "scene_close requires Godot 4.4+',
     "and this check cannot tell which kind it is"),
    # 🔴 THE ONE THE SPLIT EXISTS FOR, AND IT IS THE REVERSE OF 23.err_binding. That
    # control renames the code so the branch binds to nothing; this one leaves the code
    # alone and rebinds the branch to a SHAPE-kind handler. Every vocabulary test stays
    # green — `unsupported` is still raised, still by a method the host calls — and the
    # user-facing sentence becomes "upgrade Godot" for a node with no material slot.
    ("24.kind_mismatch", "24", "sub", "host/src/tools/tabletop.ts",
     'await emit("scene.close", { path: p });',
     'await emit("shadermaterial.create", { path: p });',
     "One word, two meanings, and the message picked the wrong one"),
    # 🔴 THE DRIFT THIS CHECK WAS WRITTEN AFTER FINDING LIVE. `runtime_bridge.gd` really
    # did differ between `addons/` and `example-csharp/addons/` by 53 lines, missing the
    # `emit_failed` fix and the ObjectDB leak monitor. One byte reproduces the class.
    ("24b.copy_drift", "24b", "sub", "example-csharp/addons/breakpoint_mcp/variant_json.gd",
     "static func encode", "static func  encode",
     "is not byte-identical across the tracked copies"),

    # ── check 24c — the message must match the kind the site was classified as ───
    # 193 §9.2's decision, built: keep the shipped `unsupported` code, make the SHAPE
    # sites stop reading as statements about the caller's Godot build. Five statements,
    # five controls, in the same commit as the check.
    #
    # 🔴 THE READER GOING BLIND, WHICH IS THE ONE THAT PASSES EVERYTHING SILENTLY. Wrap
    # the message literal onto the next line and a per-line scan cannot see it — 193 §7.2's
    # `emit_failed` exactly, one check later. All four arms below would pass on a site
    # nobody read, so the unreadable case is its own error rather than a `continue`.
    # 🔴 THE WRAP GOES AFTER THE COMMA, AND THAT IS THE WHOLE POINT OF THE ROW. Wrapping
    # BEFORE `"unsupported"` takes the raise out of `_UNSUP_RE`'s reach too, so the site
    # vanishes from the classifier entirely and `unsupported_shape` collapses — a different
    # number, and 193 §32's rule says that makes it a different mutant. Splitting after the
    # comma leaves the site classified and ONLY the message unreadable, which is the state
    # this statement exists for.
    ("24c.msg_unreadable", "24c", "sub", "addons/breakpoint_mcp/operations.gd",
     '\t\treturn _err("unsupported", "%s has no texture',
     '\t\treturn _err("unsupported",\n\t\t\t"%s has no texture',
     "cannot read the message literal off the raise line"),
    # 🔴 THE ARM THAT DOES THE WORK. Strip the class name the guard itself tests and the
    # message still names the node, still avoids every capability word, and still tells
    # the caller nothing they can act on. This is the state two of the four sites shipped
    # in before this session.
    # The three material sites carry the SAME sentence, so the anchor takes the line after
    # it to name one of them — `_shadermaterial_create` is the one that builds the material.
    ("24c.no_guard_class", "24c", "sub", "addons/breakpoint_mcp/operations.gd",
     '"%s has no material slot. Pass a node that has one: any CanvasItem exposes CanvasItem.material, any GeometryInstance3D exposes GeometryInstance3D.material_override." % node.name)\n\tvar mat := ShaderMaterial.new()',
     '"%s has no material slot" % node.name)\n\tvar mat := ShaderMaterial.new()',
     "and the message names none of them"),
    # 🔴 THE HARM, REPRODUCED AS ONE WORD. A shape site whose sentence reads as a build
    # refusal is the whole reason this check exists: the agent concludes the engine cannot
    # do it and stops, when the fix is to pass a different node.
    ("24c.shape_sounds_capability", "24c", "sub", "addons/breakpoint_mcp/operations.gd",
     "%s has no texture: only GPUParticles2D has one",
     "%s has no texture: GPUParticles2D support is unavailable, only GPUParticles2D has one",
     "reads as a CAPABILITY refusal"),
    # A shape message with no subject: the caller cannot tell WHICH of their nodes was
    # wrong, and a sentence with no subject reads as a sentence about the engine.
    ("24c.shape_no_node", "24c", "sub", "addons/breakpoint_mcp/operations.gd",
     '"%s has no texture: only GPUParticles2D has one, and GPUParticles3D draws meshes instead. Pass the path of a GPUParticles2D node." % node.name',
     '"A GPUParticles2D is required here; GPUParticles3D draws meshes instead."',
     "but the message never names that node"),
    # 🔴 AND THE SYMMETRIC ARM, WHICH IS A PIN RATHER THAN A FIX — all four capability
    # sites already pass it. A capability message that names the caller's node blames
    # their scene for a property of the build.
    ("24c.capability_names_node", "24c", "sub", "addons/breakpoint_mcp/operations.gd",
     '\t\treturn _err("unsupported", "EditorSettings unavailable")',
     '\t\treturn _err("unsupported", "EditorSettings unavailable for %s" % node.name)',
     "but the message interpolates the caller's node name"),

    # ── check 17 — example/project.godot, the invariants an editor boot erases ────
    # Seven statements, seven controls, and the two that matter most are the ones a
    # local editor boot actually produces: the uid:// autoload rewrite (committed once,
    # session 148, and it cost CI 90 seconds to find) and the rendering method.
    ("17.missing", "17", "rename", PROJ, "", "",
     "example/project.godot is missing"),
    ("17.nokey", "17", "sub", PROJ,
     '\nrenderer/rendering_method="gl_compatibility"',
     '\n;renderer/rendering_method="gl_compatibility"',
     "no longer sets"),
    ("17.badvalue", "17", "sub", PROJ,
     '\nrenderer/rendering_method="gl_compatibility"',
     '\nrenderer/rendering_method="forward_plus"',
     "but CI requires"),
    ("17.noautoload", "17", "sub", PROJ, AUTOLOAD,
     "BreakpointRuntimeBridgeX=" + AUTOLOAD.split("=", 1)[1],
     "has no BreakpointRuntimeBridge autoload"),
    ("17.uid", "17", "sub", PROJ, AUTOLOAD,
     'BreakpointRuntimeBridge="*uid://dkyjj7tbsecr0"',
     "autoload is committed as"),
    ("17.notres", "17", "sub", PROJ, AUTOLOAD,
     'BreakpointRuntimeBridge="*addons/breakpoint_mcp/runtime_bridge.gd"',
     "which is neither a res:// path nor a uid"),
    ("17.absent", "17", "sub", PROJ, AUTOLOAD,
     'BreakpointRuntimeBridge="*res://addons/breakpoint_mcp/no_such_file.gd"',
     "which does not exist under example/"),

    # ── check 22 — every check reached its own end ────────────────────────────────
    # 🔴 THE COUNTER GETS THE CONTROLS IT WAS ASKING FOR. 22 is the block that exists to
    # notice a check going missing, and until this session not one of its four statements
    # had ever run. Its floor is moved DOWN rather than up, so that only the pin fires
    # and not the collapse branch beside it.
    # 🔴 `{CHECKS}` FOR `host.drift`'s REASON, FOUND BY ADDING CHECK 23 (192 §4). This row
    # shipped in 188 anchored on the literal `CHECKS_RUN_FLOOR = 20` and the very next
    # check added to the roster moved it — a control that guards "a check went missing"
    # pinned to how many checks existed the day it was written. `0` rather than "one less"
    # for the same reason `host.drift` mutates to `0.0.0`: a value that is never the roster
    # size cannot become correct by accident, and it still fires the pin and not the
    # collapse branch beside it (21 < 0 is false).
    ("22.floor", "22", "src", "", "CHECKS_RUN_FLOOR = {CHECKS}", "CHECKS_RUN_FLOOR = 0",
     "The floor exists to notice a check going missing"),
    ("22.collapse", "22", "src", "", '\n_ran("13")\n', "\n",
     "CHECKS_RUN collapsed"),
    ("22.drift", "22", "src", "", '\n_ran("13")\n', '\n_ran("13")\n_ran("zz")\n',
     "CHECKS_RUN roster drift"),
    ("22.twice", "22", "src", "", '\n_ran("13")\n', '\n_ran("13")\n_ran("13")\n',
     "CHECKS_RUN counted a name twice"),

    # ══ 188 §4 — THE THIRTY-FOUR STATEMENTS COVERED BY NOTHING, MINUS WHAT RESISTED ══
    #
    # §8.2 handed these over with an instruction: do the cheap ones first and STOP at the
    # first statement that resists, because 187 found none and the first is new
    # information. Twenty-two of twenty-three candidates worked; the five that did not are
    # in the note under CONTROLS_RESIST below, and not ONE of them resisted for the reason
    # the handoff predicted.
    #
    # ── the ROSTER-HYGIENE family. These statements fire when contract_check's OWN roster
    # disagrees with the tree, in one direction or the other. The roster IS the subject, so
    # a `src` edit to it is precisely the mutation the statement describes — this is the
    # same justification check 22's four rows carry, applied to a much larger family.
    ("1.unfiled", "1", "src", "", '    TOOLS / "netcode.ts",\n', "",
     "nor BRIDGE_SCAN_EXEMPT, so check 1 never sees them"),
    ("10.unexpected", "10", "src", "", '    "godot://capabilities",\n', "",
     "host/src registers MCP resources absent from EXPECTED_RESOURCE_URIS"),
    ("10.misfiled", "10", "src", "", "RESOURCE_COUNT_REQUIRED: set[Path] = {\n",
     'RESOURCE_COUNT_REQUIRED: set[Path] = {\n    ROOT / "docs/NO_SUCH_DOC.md",\n',
     "RESOURCE_COUNT_REQUIRED names files absent from RESOURCE_DOCS"),
    ("12.misfiled", "12", "src", "", "RECIPE_ROSTER_REQUIRED: set[Path] = {\n",
     'RECIPE_ROSTER_REQUIRED: set[Path] = {\n    ROOT / "docs/NO_SUCH_DOC.md",\n',
     "RECIPE_ROSTER_REQUIRED names files absent from RECIPE_DOCS"),
    ("12.countmisfiled", "12", "src", "", "RECIPE_COUNT_REQUIRED: set[Path] = {\n",
     'RECIPE_COUNT_REQUIRED: set[Path] = {\n    ROOT / "docs/NO_SUCH_DOC.md",\n',
     "RECIPE_COUNT_REQUIRED names files absent from RECIPE_DOCS"),
    ("16.unknown", "16", "src", "", "SHAPE_COVERAGE_EXEMPT: dict[str, str] = {}",
     'SHAPE_COVERAGE_EXEMPT: dict[str, str] = {"__control_gate__": "a tool that does not exist"}',
     "SHAPE_COVERAGE_EXEMPT names tool(s) that are not registered at all"),
    ("13.exemptgone", "13", "src", "", '("docs/TOOL_CATALOG.md", "162-tool")',
     '("docs/TOOL_CATALOG.md", "162000-tool")',
     "which is no longer "),
    ("roster.unlisted", "roster", "src", "",
     '    Path("example/addons/breakpoint_mcp/plugin.cfg"),\n', "",
     "copies exist that check 14's roster does not name"),
    ("15.unexpected", "15", "src", "", '    Path("scripts/validate.sh"),\n', "",
     "that check 15's exec roster does not name"),
    ("15.notexec", "15", "src", "", "EXEC_ROSTER = {\n",
     'EXEC_ROSTER = {\n    Path("README.md"),\n',
     "It is meant to be run directly, but "),
    ("14.norel", "14", "src", "",
     '_one(r"^> \\*\\*npm [0-9.]+ · addon ([0-9]+\\.[0-9]+\\.[0-9]+) ", Path("README.md"), "addon version")',
     '_one(r"^> \\*\\*npm [0-9.]+ · addon ([0-9]+\\.[0-9]+\\.[0-9]+) ", Path("README_NO_SUCH.md"), "addon version")',
     "which does not exist. Every site on the "),
    ("14.notone", "14", "src", "",
     '_one(r"^- \\*\\*Version:\\*\\* host [0-9.]+ · addon ([0-9]+\\.[0-9]+\\.[0-9]+)", Path("docs/USER_GUIDE.md"), "addon version")',
     '_one(r"^- \\*\\*NoSuchStamp:\\*\\* host [0-9.]+ · addon ([0-9]+\\.[0-9]+\\.[0-9]+)", Path("docs/USER_GUIDE.md"), "addon version")',
     "Check 14 cannot verify a site it cannot locate"),
    # 🔴 CHECKS 18/19 ARE GIT-DERIVED, AND THAT IS WHY BOTH OF THESE ARE ROSTER EDITS AND
    # NOT TREE EDITS. Moving a `.uid` aside on disk changes nothing: the population comes
    # from `git ls-files`, so the file is still tracked and check 18 stays green. That was
    # measured, not assumed — the candidate that renamed `example-csharp/Player.cs.uid`
    # RESISTED. It is 187 §31's corollary answering its own question, one check over.
    ("18.nouid", "why", "src", "", '_UID_PROJECT_DIRS = ("example/", "example-csharp/")',
     '_UID_PROJECT_DIRS = ("example/", "example-csharp/", "addons/")',
     "have no tracked .uid sidecar"),
    ("19.shipped", "why", "src", "",
     'if p.suffix == ".uid" and str(p).startswith("addons/breakpoint_mcp/")',
     'if p.suffix == ".uid" and str(p).startswith("example-csharp/addons/breakpoint_mcp/")',
     "the distributable addon must not ship .uid sidecars"),
    ("shape.nodef", "shape", "src", "",
     '"generator result envelope": r"The shared generator result envelope',
     '"generator result envelope": r"The NO SUCH generator result envelope',
     "in a fenced json "),

    # ── the DERIVED-SIDE family. The statement compares prose against a number the code
    # derives. Moving the DERIVED side is the same disagreement as moving the prose, and
    # unlike the prose it carries no literal for the next release to outrun — which is
    # §2's whole lesson, applied on the way in rather than a release later.
    ("11.countdrift", "11", "src", "", "total_tools = len(tool_set)\n",
     "total_tools = len(tool_set) + 1\n",
     "If one of these is a tool-FAMILY count that legitimately shares a line"),
    ("addon.drift", "addon", "src", "",
     'addon_version = _one(r\'^version="([^"]+)"\', ADDON_VERSION_SOURCE, "addon version")',
     'addon_version = _one(r\'^version="([^"]+)"\', ADDON_VERSION_SOURCE, "addon version") + "x"',
     "The addon copies must stay in lockstep"),

    # ── the TREE family. Here the subject really is a shipped file, so the mutation is a
    # text edit in it and nothing in contract_check.py moves.
    ("5.badjson", "5", "sub", "docs/TOOL_CATALOG.md",
     '"description": "A plain JSON scalar/array/object, OR a tagged Godot value.",',
     '"description": "A plain JSON scalar/array/object, OR a tagged Godot value.",,',
     "Invalid JSON block #"),
    ("9.unannotated", "9", "sub", "host/src/annotations.ts",
     '"asset_gen_placeholder", "asset_gen_sprite", "asset_gen_texture", "audio_bus_add",',
     '"asset_gen_sprite", "asset_gen_texture", "audio_bus_add",',
     "they would ship with no MCP risk hints"),
    ("12.order", "12", "sub", "host/src/recipes.ts",
     '\n  "recipe_2d_player_controller",\n  "recipe_wire_signal_and_assert",',
     '\n  "recipe_wire_signal_and_assert",\n  "recipe_2d_player_controller",',
     "Order is compared as well as membership"),
    ("12.dupe", "12", "sub", "host/src/recipes.ts",
     'server.registerPrompt(\n    "recipe_type_safe_edit",',
     'server.registerPrompt(\n    "recipe_2d_player_controller",',
     "Duplicate registerPrompt recipe names:"),
    # 🔴 `recipe_type_safe_editx`, LOWER-CASE, AND THE FIRST DRAFT USED `...X` AND DID NOT
    # REDDEN. `doc_recipe_mentions` matches `\brecipe_[a-z0-9_]+`, so an upper-case suffix
    # leaves the original name still matching and the mention still found. The spike
    # caught it; a hand-written row would have shipped as a control that controls nothing.
    ("12.partial", "12", "sub", "README.md",
     "- **`recipe_type_safe_edit`**", "- **`recipe_type_safe_editx`**",
     "A hand-maintained roster allowed "),
    # 188 §3's new statement, and the one that could not be controlled until it had a
    # population at all: RECIPE_COUNT_REQUIRED did not exist when this row was drafted.
    ("12.silentcount", "12", "sub", "README.md",
     "Breakpoint ships 8 recipes", "Breakpoint ships eight recipes",
     "state no recipe count at all"),
    ("15.noshebang", "15", "sub", "scripts/validate.sh", "#!/", "##/",
     "does not begin with `#!`"),
]

# 🔴 THE FIVE THAT RESISTED, AND WHY NONE OF THEM IS THE CASE THE HANDOFF EXPECTED.
#
# §8.2's instruction was to stop at the first statement with no possible one-line tree
# edit, because that is a check that cannot fail and should be DELETED rather than
# counted. Five statements resisted and every one has an obvious tree edit. What they
# lack is something else, and the three reasons are different from each other:
#
#   L1934  check 12's recipe-count comparison — AN EMPTY POPULATION. No doc stated a
#          recipe count, so `0 count claim(s) checked` printed on every green run and
#          nothing could disagree. Not deleted and not counted: GIVEN A POPULATION
#          (RECIPE_COUNT_REQUIRED, 188 §3), after which `12.silentcount` above controls
#          the new statement and the old one compares something.
#
#   L237   `errors.append(_WIRE_CANARY)` — NO LITERAL OF ITS OWN. Its argument is a Name.
#   L1557  `errors.extend(shape_cov_errors)`      — forwards a list built elsewhere.
#   L1828  `errors.append("\n      - ".join(exempt_errors))` — same shape.
#          🔴 ALL THREE HAVE TREE EDITS THAT REDDEN THEM. What they cannot have is a
#          FINGERPRINT: the static resolver matches against the string constants under
#          the call, and these carry none, so no row could ever name exactly one of them.
#          They are invisible to this gate BY CONSTRUCTION, which is a property of the
#          instrument and not of the checks — and it is floored below rather than
#          silently subtracted, because a gate that quietly drops what it cannot see
#          reports a coverage ratio over a population it chose.
UNFINGERPRINTABLE_FLOOR = 3

# ── the three floors ──────────────────────────────────────────────────────────────
#
# 🔴 CONTROLLED_FLOOR IS THE ONE THAT MATTERS AND IT IS FLOORED FROM BELOW, because the
# failure it names is this gate quietly covering less. Delete a row from CONTROLS and
# every remaining row still passes; the only thing that moves is a number nobody reads.
# 186 §6 paid this on the way in for a new coverage number and the handoff's own note is
# that the OLD one is still unfloored — so this one is floored on the way in too.
CONTROLLED_FLOOR = 56          # 187: 17 · 188: +24, the constructible half of the 34 (§4)
                               # 192: +7, check 23's statements — SIX by design and a
                               # SEVENTH the reverse sweep demanded (192 §6)

# 🔴 AND THE DENOMINATOR IS FLOORED TOO, WHICH IS THE HALF A COVERAGE RATIO ALWAYS MISSES.
# "17 of 70" improves to "17 of 17" by DELETING sixty-eight failure statements, and every
# assertion in this file would still hold. A ratio with only its numerator pinned is a
# number that gets better as the thing it measures gets smaller — 175's rule, stated as a
# floor instead of quoted.
STATEMENT_FLOOR = 87           # 186 measured 70; 188 §3 added two; 192 added check 23's
                               # seven. It is supposed to grow

# The roster of checks this gate closes, pinned by NAME and not just by count — 182's
# both-halves lesson: the set catches a check renamed or swapped, the floor catches the
# roster itself being trimmed to match a smaller reality.
CHECKS_CLOSED = ("3", "11c", "host", "17", "22",
                 # 188: every check that gained at least one control this session
                 "1", "5", "9", "10", "11", "12", "13", "14", "15", "16",
                 "addon", "roster", "shape", "why",
                 # 192: the cross-LANGUAGE check, closed on the way in rather than carried
                 "23",
                 # 193: check 24 the same way — covered on arrival, so BLIND stays at 31.
                 # `24b` is the cross-copy half under its own section header, and the
                 # fingerprint resolver reads headers — the same reason `11b`/`11c` are
                 # named separately above rather than folded into `11`.
                 "24", "24b", "24c")


def statements(src: str) -> list[tuple[int, str, str]]:
    """(lineno, check label, literal blob) for every `errors.append/extend` call.

    Parsed rather than grepped, for 186 §7's reason: three drafts of that measurement were
    wrong — 0 of 70, then eight unmatched frames, then 64 of 70 — because a bare
    `errors.append(` is the text of dozens of lines and `f_lineno` does not point at the
    opening one. An AST walk has nothing to be off by one about.

    The blob is every string CONSTANT under the call, which for an f-string is exactly the
    literal parts. A fingerprint is therefore matched against text the check can actually
    print, never against an interpolated value that varies with the tree.
    """
    lines = src.split("\n")
    headers: dict[int, str] = {}
    cur = "(prologue)"
    for i, line in enumerate(lines, 1):
        m = re.match(r"# --- (\S+?)[:\s]", line)
        if m:
            cur = m.group(1)
        headers[i] = cur

    out: list[tuple[int, str, str]] = []
    for node in ast.walk(ast.parse(src)):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr in ("append", "extend")
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id == "errors"):
            blob = " ".join(
                sub.value for sub in ast.walk(node)
                if isinstance(sub, ast.Constant) and isinstance(sub.value, str)
            )
            out.append((node.lineno, headers[node.lineno], blob))
    return sorted(out)


def auto_fingerprints(stmts: list[tuple[int, str, str]], minimum: int = 16) -> dict[int, str]:
    """line -> the longest string literal that resolves to exactly ONE statement.

    🔴 EXPORTED FOR `scope_gate.py`, WHICH IS WHY IT LIVES HERE. That gate already runs
    twenty-five blinded copies of `contract_check.py` and throws every one of their
    outputs away; giving it this table lets it DERIVE which statements its own mutants
    execute, at zero marginal cost, instead of this file stating a number measured once in
    186 with a shim and copied into a comment ever since (188 §5 — re-derived at 19, not
    23). The uniqueness rule is the same one CONTROLS' hand-written fingerprints obey: a
    literal two statements share proves nothing about either.
    """
    out: dict[int, str] = {}
    for ln, _label, blob in stmts:
        parts = sorted((p.strip() for p in re.split(r"\s{2,}|\n", blob)
                        if len(p.strip()) >= minimum), key=len, reverse=True)
        for p in parts:
            if sum(1 for _l, _lb, b in stmts if p in b) == 1:
                out[ln] = p
                break
    return out


def gate_failed(unresolved: int, uncontrolled: int, controls_low: bool,
                statements_low: bool, roster_drift: bool, unrestored: int,
                unfingerprintable_low: bool = False) -> bool:
    """This gate's verdict, as a PURE function of its SEVEN populations.

    🔴 EXTRACTED FOR `combineFailed`'s REASON (180 §7.1, 174 §8, and scope_gate.py's
    `gate_failed` beside it — the same defect five sessions running). On a healthy tree
    every one of these is already falsey, so no term is ever satisfied APART from the
    others and deleting any single one is invisible to every live run. Lifted out, the
    truth table below can assert each one reaches the exit code alone.
    """
    return (bool(unresolved) or bool(uncontrolled) or controls_low
            or statements_low or roster_drift or bool(unrestored)
            or unfingerprintable_low)


def _self_check() -> list[str]:
    """Run BEFORE the sweep. Each population must reach the verdict ALONE — 173's G3 and
    176's rule about two conditions that are never satisfied apart.

    🔴 AND THE FLOORS ARE ASSERTED POSITIVE HERE RATHER THAN SWEPT BY floor_pin_gate.py.
    That gate zeroes a floor and requires its runner to redden; its runner for these would
    be THIS file, which mutates the working tree — and nesting one tree-mutating gate
    inside another breaks 178 §11.4. So both floors are exempt there WITH THIS FUNCTION
    NAMED AS THE REASON, and what makes the exemption honest is that a zeroed floor fails
    the assertion below: `CONTROLLED_FLOOR = 0` would leave `controls_low` unable to bite
    and this gate green over an empty table.
    """
    problems: list[str] = []
    if gate_failed(0, 0, False, False, False, 0):
        problems.append("gate_failed reports a failure over six healthy populations")
    alone = (
        ("unresolved", (1, 0, False, False, False, 0)),
        ("uncontrolled", (0, 1, False, False, False, 0)),
        ("controls_low", (0, 0, True, False, False, 0)),
        ("statements_low", (0, 0, False, True, False, 0)),
        ("roster_drift", (0, 0, False, False, True, 0)),
        ("unrestored", (0, 0, False, False, False, 1)),
        ("unfingerprintable_low", (0, 0, False, False, False, 0, True)),
    )
    for label, args in alone:
        if not gate_failed(*args):
            problems.append(
                f"gate_failed does not fail on {label} ALONE — that population cannot reach "
                f"the exit code by itself, so the branch that feeds it deletes invisibly"
            )
    for name, value in (("CONTROLLED_FLOOR", CONTROLLED_FLOOR),
                        ("STATEMENT_FLOOR", STATEMENT_FLOOR),
                        ("UNFINGERPRINTABLE_FLOOR", UNFINGERPRINTABLE_FLOOR)):
        if value <= 0:
            problems.append(
                f"{name} is {value}. A floor at zero cannot bite, and this file is the only "
                f"place either floor is pinned (see the note in DISCOVER_EXEMPT)"
            )
    if len(set(CHECKS_CLOSED)) != len(CHECKS_CLOSED):
        problems.append("CHECKS_CLOSED names a check twice — the roster cannot be compared")

    # 🔴 THE RULE 188 PAID FOR. An anchor that embeds a number the tree DERIVES is a
    # control pinned to a moment: `host.drift` was written as `> **npm 1.62.0 ·` and the
    # next commit — the release cut — moved it, so CI went red on the release itself.
    # Checked against the LITERAL row, before `resolve()` runs, so a row that spells the
    # number out is caught and a row that uses the placeholder is not.
    # 🔴 THE REAL ROWS AND THE PLANTED ONE GO THROUGH ONE CALL, ON PURPOSE. Audited
    # separately, the live call appends nothing on a healthy tree and deleting it is
    # invisible — mutate188's U1 proved exactly that, and it was the last mutant standing.
    # Passing the planted row through the SAME call means a deletion takes the assertion
    # with it and `audit` becomes a NameError rather than an empty list.
    #
    # 🔴 WHAT THIS STILL DOES NOT CATCH, WRITTEN DOWN RATHER THAN LEFT TO BE DISCOVERED:
    # deleting this whole block. No self-check can assert its own presence, and that is
    # `floor_pin_gate.py`'s job one level up and the reverse sweep's at this one. It is a
    # real residual, not a solved problem.
    values = (("{V}", live_version()), ("{TESTS}", live_tests()), ("{CHECKS}", live_checks()))
    PLANTED = ("__planted__", "x", "sub", "x", f"npm {live_version() or 'x.y.z'} ·", "y", "z")
    audit, rows_read = derived_literal_problems([*CONTROLS, PLANTED], values)
    if rows_read != len(CONTROLS) + 1:
        problems.append(
            f"the anchor audit read {rows_read} row(s), not every control plus the planted "
            f"one ({len(CONTROLS) + 1}). A trimmed input is silent on a healthy tree, so "
            f"this count is the only thing that notices the rule covering less than it says."
        )
    if live_version() and not any(p.startswith("__planted__:") for p in audit):
        problems.append(
            "derived_literal_problems does NOT flag a row spelling out the live version. "
            "That rule is the whole of §2 and on a healthy tree it never fires, so this "
            "planted row is the only thing standing between it and a silent deletion."
        )
    problems += [p for p in audit if not p.startswith("__planted__:")]

    # ── 🔴 AND EACH DETECTOR IS FED AN INPUT IT MUST FLAG, WHICH IS WHAT mutate188 ──
    # BOUGHT. The sweep un-fixed three branches below and every one SURVIVED: on a healthy
    # tree they are empty, so their deletion is invisible to every live run and the gate
    # stayed green over an instrument with its detection removed. These four cases are the
    # `alone` truth table one level down, at the detectors instead of at the verdict.
    if live_version():
        if derived_literal_problems([("clean", "x", "sub", "x", "npm {V} ·", "y", "z")], values)[0]:
            problems.append("derived_literal_problems flags a row that uses the placeholder")
    if anchor_problem("aXa", "X") is not None:
        problems.append("anchor_problem rejects an anchor occurring exactly once")
    for text, old, label in (("aa", "X", "zero"), ("XaX", "X", "two")):
        if anchor_problem(text, old) is None:
            problems.append(
                f"anchor_problem does NOT flag an anchor occurring {label} time(s). Without "
                f"it the sweep reports ok over a mutation it never applied (180 §9.3), and "
                f"every row's verdict becomes a statement about nothing."
            )
    # The uniqueness rule inside auto_fingerprints, which scope_gate.py's attribution rests
    # on: a literal two statements share must be REJECTED, or a hit credits both.
    shared = [(1, "a", "the shared sentence here"), (2, "b", "the shared sentence here")]
    if auto_fingerprints(shared):
        problems.append(
            "auto_fingerprints picks a literal that two statements share — an attribution "
            "built on it credits a statement that never fired (188 §5's whole basis)."
        )
    if unfingerprintable(shared) != [1, 2]:
        problems.append("unfingerprintable does not report statements no row can name")
    if unfingerprintable([(1, "a", "a literal long enough to be unique")]):
        problems.append("unfingerprintable reports a statement that carries its own literal")
    return problems


ORIGINALS: dict[Path, str] = {}
MOVED: dict[Path, Path] = {}


@atexit.register
def _restore() -> None:
    """The tree goes back whatever happens — a KeyboardInterrupt, an unhandled raise, or a
    control whose subprocess dies. Registered rather than left to the `finally` below
    because a `finally` does not run for the mutation applied when the interrupt lands."""
    for path, text in ORIGINALS.items():
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            path.write_text(text, encoding="utf-8")
    for original, moved in MOVED.items():
        if moved.exists() and not original.exists():
            shutil.move(str(moved), str(original))
    MUT.unlink(missing_ok=True)


def run(script: Path) -> tuple[bool, bool, str]:
    """(red, executed, output). See REPORT_MARKER above for why the second is not the
    first's complement."""
    p = subprocess.run([sys.executable, "-u", str(script)], cwd=str(ROOT),
                       capture_output=True, text=True, timeout=900)
    return p.returncode != 0, REPORT_MARKER in p.stdout, p.stdout + p.stderr


def main() -> int:
    src = CC.read_text(encoding="utf-8")
    stmts = statements(src)
    print(f"CONTROL_GATE controls={len(CONTROLS)} floor={CONTROLLED_FLOOR} "
          f"statements={len(stmts)} floor={STATEMENT_FLOOR}")

    for problem in _self_check():
        print(f"🔴 CONTROL_GATE_SELFCHECK {problem}")
    if _self_check():
        return 1

    controls_low = len(CONTROLS) < CONTROLLED_FLOOR
    if controls_low:
        print(f"🔴 CONTROL_GATE_CONTROLS_COLLAPSE {len(CONTROLS)} < {CONTROLLED_FLOOR} — a row was\n"
              f"   deleted from CONTROLS and every remaining row still passes. Lower the literal ON\n"
              f"   PURPOSE, in the same commit, or restore the control.")
    statements_low = len(stmts) < STATEMENT_FLOOR
    if statements_low:
        print(f"🔴 CONTROL_GATE_STATEMENTS_COLLAPSE {len(stmts)} < {STATEMENT_FLOOR} — contract_check.py\n"
              f"   carries fewer failure statements than when this floor was measured. Coverage here\n"
              f"   improves when the denominator shrinks, so a deleted check reads as progress.")

    # ── STATIC: does every fingerprint resolve to exactly ONE statement? ───────────
    # 🔴 THIS IS WHAT MAKES A CONTROL A CONTROL. Without it, any mutation that reddens the
    # run for any reason at all would be counted as covering whatever statement its row
    # claims, and the harness would be measuring itself. 186 §31's corollary, applied
    # before a number is printed rather than after one is doubted.
    unresolved: list[str] = []
    covered: dict[int, str] = {}
    for cid, check, _kind, _target, _old, _new, fp in CONTROLS:
        hits = [(ln, label) for ln, label, blob in stmts if fp in blob]
        if len(hits) != 1:
            unresolved.append(f"{cid}: fingerprint matches {len(hits)} statement(s), needs exactly 1")
            continue
        line, label = hits[0]
        if label != check:
            unresolved.append(f"{cid}: fingerprint lands in check {label!r}, the row declares {check!r}")
            continue
        if line in covered:
            unresolved.append(f"{cid}: contract_check.py:{line} is already covered by {covered[line]}")
            continue
        covered[line] = cid
    print(f"CONTROL_GATE_RESOLVED {len(covered)} of {len(CONTROLS)} fingerprint(s) name exactly one statement")
    for problem in unresolved:
        print(f"🔴 CONTROL_GATE_UNRESOLVED {problem}")
    if unresolved:
        print("   A fingerprint that no longer resolves means the message was reworded and this row\n"
              "   has stopped testing anything. Re-anchor it on the new text; do not delete the row.")

    closed = {c for _cid, c, *_ in CONTROLS}
    roster_drift = closed != set(CHECKS_CLOSED)
    if roster_drift:
        print(f"🔴 CONTROL_GATE_ROSTER controls cover {sorted(closed)}, CHECKS_CLOSED names "
              f"{sorted(CHECKS_CLOSED)}. Move both, on purpose.")

    # ── CONTROL: an unmutated run must be GREEN, print the marker, and be SILENT on
    # every fingerprint. The third is this file's own version of scope_gate's control:
    # a fingerprint a clean run already prints discriminates nothing.
    red, executed, out = run(CC)
    if red or not executed:
        print(f"🔴 CONTROL_GATE_CONTROL an unmutated run is red={red} executed={executed} — the tree is\n"
              "   not clean, so every verdict below would be meaningless. Stop.")
        return 1
    leaked = [c[0] for c in CONTROLS if c[6] in out]
    if leaked:
        print(f"🔴 CONTROL_GATE_LEAK {len(leaked)} fingerprint(s) already appear in a CLEAN run: {leaked}")
        return 1
    print(f"CONTROL_GATE_CONTROL ok — clean run green, report marker printed, and no fingerprint\n"
          f"                        appears in it, so 'fired' below means the mutation caused it")

    # ── SWEEP: apply each control, require red + executed + the expected statement ──
    uncontrolled: list[str] = []
    for cid, check, kind, target, old, new, fp in CONTROLS:
        if any(u.startswith(f"{cid}:") for u in unresolved):
            continue                      # already reported; running it would prove nothing
        old, new = resolve(old), resolve(new)
        path = ROOT / target if target else CC
        try:
            if kind == "sub":
                text = ORIGINALS.setdefault(path, path.read_text(encoding="utf-8"))
                n = anchor_problem(text, old)
                if n is not None:
                    uncontrolled.append(f"{cid}: anchor occurs {n} time(s) in {target}, needs exactly 1")
                    print(f"🔴 CONTROL_GATE_ANCHOR {cid}: {n} occurrence(s) of the anchor in {target}")
                    continue
                path.write_text(text.replace(old, new), encoding="utf-8")
                red, executed, out = run(CC)
            elif kind == "rename":
                moved = path.with_name(path.name + ".control_gate_moved")
                MOVED[path] = moved
                shutil.move(str(path), str(moved))
                red, executed, out = run(CC)
            else:                          # "src" — the mutant copy, tree untouched
                n = anchor_problem(src, old)
                if n is not None:
                    uncontrolled.append(f"{cid}: source anchor occurs {n} time(s), needs exactly 1")
                    print(f"🔴 CONTROL_GATE_ANCHOR {cid}: {n} occurrence(s) in contract_check.py")
                    continue
                MUT.write_text(src.replace(old, new))
                red, executed, out = run(MUT)
        finally:
            if path in ORIGINALS:
                path.write_text(ORIGINALS[path], encoding="utf-8")
            if path in MOVED:
                if MOVED[path].exists():
                    shutil.move(str(MOVED[path]), str(path))
                del MOVED[path]
            MUT.unlink(missing_ok=True)

        fired = fp in out
        fails = out.count("\nFAIL: ")
        if red and executed and fired:
            print(f"  ok   {cid:<15} check {check:<5} reddens, executes, fires its own statement "
                  f"({fails} FAIL line(s))")
            continue
        uncontrolled.append(f"{cid}: red={red} executed={executed} fired={fired}")
        if not red:
            print(f"🔴 CONTROL_GATE_GREEN {cid}: check {check} does NOT notice its own mutation. That\n"
                  f"   statement cannot fire, and a statement that cannot fire is a check that cannot\n"
                  f"   fail — delete it rather than count it (186 §10.2).")
        elif not executed:
            print(f"🔴 CONTROL_GATE_NEVER_RAN {cid}: red, but the run never reached the report. The\n"
                  f"   mutation broke the check on the way in; this row is measuring the harness.")
        else:
            print(f"🔴 CONTROL_GATE_WRONG_STATEMENT {cid}: red and executed, but check {check}'s own\n"
                  f"   statement never printed. Something ELSE caught the mutation — a control that\n"
                  f"   covers a statement it does not name covers nothing.")

    # ── RESTORE, ASSERTED. A sweep that leaves the tree changed has corrupted every ──
    # measurement after it, including the ones in the same CI run.
    unrestored = [str(p.relative_to(ROOT)) for p, t in ORIGINALS.items()
                  if not p.exists() or p.read_text(encoding="utf-8") != t]
    unrestored += [str(p.relative_to(ROOT)) for p in MOVED if not p.exists()]
    if MUT.exists():
        unrestored.append(str(MUT.relative_to(ROOT)))
    if unrestored:
        print(f"🔴 CONTROL_GATE_UNRESTORED {unrestored} — the tree does not match what this gate read.")

    controlled = len(covered) - len(uncontrolled)
    print(f"\nCONTROL_GATE_COVERED {controlled} of {len(stmts)} failure statement(s) have a positive\n"
          f"   control here · checks closed: {' '.join(sorted(CHECKS_CLOSED))}")

    # 🔴 WHAT THIS GATE CANNOT SEE, COUNTED RATHER THAN SUBTRACTED (188 §4). A statement
    # carrying no string constant of its own — the wire canary, and the two that forward a
    # list built elsewhere — can never be named by a fingerprint that resolves to exactly
    # one statement. That is a property of the INSTRUMENT, and a gate that quietly drops
    # what it cannot read reports a ratio over a population it chose for itself. Floored
    # from below so the set cannot shrink by rewording, and printed on green runs.
    blind_to_rows = unfingerprintable(stmts)
    unfingerprintable_low = len(blind_to_rows) < UNFINGERPRINTABLE_FLOOR
    print(f"CONTROL_GATE_UNFINGERPRINTABLE {len(blind_to_rows)}/{UNFINGERPRINTABLE_FLOOR} "
          f"statement(s) carry no literal of their own and can never be named by a row: "
          f"{blind_to_rows}")
    if unfingerprintable_low:
        print(f"🔴 CONTROL_GATE_UNFINGERPRINTABLE_LOW {len(blind_to_rows)} < "
              f"{UNFINGERPRINTABLE_FLOOR} — one of these gained a literal, or was deleted.\n"
              f"   Either is fine and both are DELIBERATE: lower the floor in the same commit.")
    # 🔴 AND THE STATED NUMBER IS GONE (188 §5). Until this session the line below read
    # "…23 of those are covered by scope_gate.py's blinded runs (186 §7, STATED, NOT
    # RE-DERIVED HERE), which leaves ~30 covered by nothing at all", and both numbers were
    # wrong. 186 measured 23 statements executed by ANYTHING with a recording shim; the
    # comment restated that as 23 covered by scope_gate specifically, and the subtraction
    # was carried into a handoff as the size of the remaining work. Re-derived against
    # scope_gate's own twenty-five mutants: 19. The residue was 34, not 30 — four
    # statements were being credited to a source that does not cover them.
    #
    # So this gate no longer asserts anyone else's coverage. `scope_gate.py` DERIVES its
    # own attribution now, from the outputs of runs it was already paying for, and prints
    # SCOPE_GATE_STATEMENTS. Two lines, each owned by the gate that can measure it, beats
    # one line quoting a number nobody re-ran.
    print(f"CONTROL_GATE_BLIND {len(stmts) - controlled} statement(s) have no positive control in this\n"
          f"   file. What ELSE reaches them is scope_gate.py's to measure and it prints\n"
          f"   SCOPE_GATE_STATEMENTS from its own blinded runs — no number is stated here")

    if gate_failed(len(unresolved), len(uncontrolled), controls_low,
                   statements_low, roster_drift, len(unrestored), unfingerprintable_low):
        print("\nCONTROL_GATE 🔴 FAILED")
        return 1
    # 🔴 THE VERDICT NAMES WHAT IT VERIFIED (174 §5). Not "every check can fail" — this
    # file has one statement's worth of evidence per row and the rest of the file is
    # untested by it.
    print(f"\nCONTROL_GATE ok — all {len(CONTROLS)} control(s) applied, each reddened contract_check,\n"
          f"                  each reached the report, and each fired the one statement it names")
    return 0


if __name__ == "__main__":
    sys.exit(main())
