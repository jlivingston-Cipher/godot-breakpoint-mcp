#!/usr/bin/env python3
"""scope_gate.py — session 172. THE GATE THAT BLINDS THE GATE.

171 §7 built a reverse sweep that re-injected taut169's own bug into the new tautology
gate, on the grounds that "a gate that cannot detect its own blindness is the gate that
produced this session". This is that idea applied to `contract_check.py`, and it is not
hypothetical: 171 §10.21 asked what each of its enumerators would print if its finder
matched nothing, and the answer, measured, was:

    25 blindable enumerators · CONTROL PASS · 11 caught · 🔴 14 STILL GREEN

Fourteen finders could match NOTHING and the run still printed ALL HARD CHECKS PASSED,
because every check downstream compares set intersections, iterates a list, or filters
for offenders — and an empty input satisfies all three instantly and silently. The scope
ledger (check 20) closed them with literal floors. THIS FILE IS WHAT KEEPS THEM CLOSED:
it blinds each enumerator in turn and asserts the run goes RED.

Without it the ledger is a list of numbers that nobody re-derives. A floor that is never
tested against the collapse it names is itself a claim that cannot fail.

Run: python3 scripts/scope_gate.py   (a CI step beside the tautology gate)
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _gate_lock import acquire, run_and_settle  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
# 🔴 ONE PARSER, NOT TWO. `statements()` is an AST walk that took three drafts in 186 to
# get right; `auto_fingerprints()` enforces the same one-statement-per-literal rule
# CONTROLS obeys by hand. A second copy here would drift from the gate whose number this
# one is meant to complete. control_gate does NOT import this file, so the edge is acyclic.
from control_gate import (  # noqa: E402
    auto_fingerprints as cg_auto_fingerprints,
    statements as cg_statements,
)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "contract_check.py"
MUT = ROOT / "scripts" / "_scope_gate_mutant.py"

# The empty value each return annotation promises. A finder that matched nothing would
# return exactly this — so injecting it IS the failure mode, not an approximation of it.
EMPTY: dict[str, str] = {
    "set[str]": "set()",
    "list[str]": "[]",
    "dict[str, str]": "{}",
    "dict[str, int]": "{}",
    # 🆕 252 — the shape 246's lesson said would come back. `catalog_heading_rows`
    # returns name -> "is it marked ✔", and without this row it is an enumerator
    # outside this gate BY CONSTRUCTION, with nothing anywhere saying so.
    "dict[str, bool]": "{}",
    # 🆕 254 — plane -> code -> remedy. The third session in a row to add a shape this
    # table could not spell, and the second where the row cost nothing but the line: 252
    # admitted `dict[str, bool]` and said the class would return, which it has.
    "dict[str, dict[str, str]]": "{}",
    # 🆕 255 — method -> (file, body). THE FOURTH SESSION RUNNING TO ADD A SHAPE THIS TABLE
    # COULD NOT SPELL, and the fourth where the row costs one line. 246 said the class would
    # return; 252, 254 and now this are the evidence. The rule has earned a stronger
    # statement than "add the row": a reader whose return annotation is not in `EMPTY` is
    # outside this gate silently, so writing a new enumerator means checking this table in
    # the same edit — the gate cannot tell you, because what it cannot spell it cannot count.
    "dict[str, tuple[str, str]]": "{}",
    # 🆕 259 — (subcommands, subcommand -> its flags). THE FIFTH SESSION RUNNING TO ADD A
    # SHAPE THIS TABLE COULD NOT SPELL, and the first where the reader is a PAIR: check 28's
    # CLI join needs both halves at once, and a reader returning two populations is outside
    # this gate exactly as silently as one returning an unspellable single. 255 asked for a
    # stronger statement than "add the row" — this is what that costs when it is remembered
    # in the same edit, and what it would have cost if it were not.
    "tuple[set[str], dict[str, set[str]]]": "(set(), {})",
    # 🆕 261 — tool -> {"steps": [...], "declared": bool}. THE SIXTH SESSION RUNNING, and
    # the first where the gate said so out loud rather than being noticed: check 31's
    # reader landed with its LEDGER row and its own BLAST entry and no TARGETS row, so
    # `SCOPE_GATE_ROSTER` refused both of the other two for naming a target that does not
    # exist. 255's stronger statement — a reader whose annotation is not in this table is
    # outside the gate silently — is now enforced from the other end, which is the only
    # reason this cost a CI round rather than a session.
    "dict[str, dict]": "{}",
    "dict[str, list[str]]": "{}",
    "dict[str, set[str]]": "{}",
    "dict[Path, set[str]]": "{}",
    "list[tuple[Path, int, int]]": "[]",
    "list[tuple[Path, int, str, int]]": "[]",
    "list[tuple[Path, int, str, int, str]]": "[]",
    "tuple[list[str], set[tuple[Path, int]]]": "([], set())",
    "tuple[list[str], list[tuple[Path, int, int, str]]]": "([], [])",
    "tuple[list[str], int]": "([], 0)",
    # 🆕 267 — (unanswered sites, scanned). The FIFTH session running to add a shape this
    # table could not spell, and the fifth where the row costs one line. The reader returns
    # a count beside its list for exactly the reason 172 gave `uncaptured_tool_registrations`
    # one: an empty list means *nothing unanswered* and *did not look* identically.
    "tuple[list[tuple[str, int, str]], int]": "([], 0)",
    "tuple[list[str], list[tuple[Path, int, int, str]], int]": "([], [], 0)",
    # 🆕 222 — `toolset_claims` grew a fourth return so check 25 can subtract what it
    # resolved at (file, line, VALUE) rather than at (file, line). Without the row the
    # function stops being blindable and TARGET_FLOOR catches it — which it did, on the
    # first run after the signature moved.
    "tuple[list[str], list[tuple[Path, int, int, str]], int, set[tuple[Path, int, int]]]":
        "([], [], 0, set())",
    # 🆕 246 — THE FOUR SHAPES THIS TABLE DID NOT KNOW, AND WHAT THAT COST.
    #
    # 🔴 A RETURN SHAPE `EMPTY` HAS NO ROW FOR IS AN ENUMERATOR OUTSIDE THIS GATE BY
    # CONSTRUCTION, WITH NO LINE ANYWHERE SAYING SO — which is 199 §9.4's sentence about
    # `floor_pin_gate`'s own discovery half, one file over and never asked here. The
    # docstring above says twenty-five blindable enumerators; the tree held twenty-nine,
    # and the difference was four annotations this dict could not spell. `TARGET_FLOOR`
    # could not see it either: it floors the targets FOUND, and a shape it cannot read
    # never becomes one.
    #
    # 🔴 AND ADMITTING THEM FOUND A GREEN BLIND ON THE FIRST SWEEP. `prose_numerals_masked`
    # returned zero — no numeral is inside a fence anywhere in four documents — and
    # `contract_check.py` printed ALL HARD CHECKS PASSED. 246 gave it the SCOPE_LEDGER row
    # it never had. `EMPTY_UNDECLARED` below is what stops the class recurring: the walk
    # now asks its own question in both directions rather than answering it by omission.
    "int": "0",
    "list[tuple[int, int, str]]": "[]",
    "tuple[dict[str, set[str]], dict[str, set[str]], dict[str, str]]": "({}, {}, {})",
    "tuple[list[str], int, int]": "([], 0, 0)",
}

# 🔴 THIS GATE DERIVES ITS OWN SCOPE, WHICH IS THE EXACT THING IT EXISTS TO DISTRUST.
# If `EMPTY` fell out of step with the annotations — a signature changed, a new shape
# added — the target list would shrink and every remaining target would still pass, so
# this file would report success over enumerators it had stopped testing. That is
# taut169, one level up again. The floor is a literal, and it is `>=` because the file
# is supposed to grow. 172 measured 25; 🆕 246 measured 30 — four of them annotated
# enumerators `EMPTY` had never been able to spell, and one the new check 27 brought with
# it. A floor left at the old measurement is headroom for five targets to be dropped in
# silence (198 §36).
TARGET_FLOOR = 39   # at `{FLOOR}`, raised by four: the required-any join brought three
                    # readers of its own, and admitting the shape one of them returns made
                    # a fourth enumerator blindable that had been outside this gate in
                    # silence — a floor is raised where it is outgrown, never after


def targets(text: str) -> list[tuple[str, str, int]]:
    """(name, empty-literal, byte offset of the body) for every blindable enumerator."""
    found: list[tuple[str, str, int]] = []
    for m in re.finditer(r"^def (\w+)\([^)]*\)\s*->\s*(.+?):\s*$", text, re.M):
        name, ret = m.group(1), m.group(2).strip().strip('"')
        if name.startswith("_") and name != "_tracked_modes":
            continue
        empty = EMPTY.get(ret)
        if empty is None and ret.endswith("| None"):
            empty = "{}" if "dict" in ret else "[]"
        if empty is not None:
            found.append((name, empty, m.end()))
    return found


# 🔴 THE LINE contract_check.py PRINTS ONLY IF IT GOT AS FAR AS REPORTING (181).
# See `run()` below for why a returncode is not enough.
REPORT_MARKER = "=== breakpoint-mcp static contract check ==="


# 🔴 188 §5 — THE OUTPUT THIS GATE WAS ALREADY PAYING FOR AND THREW AWAY.
#
# `control_gate.py` printed, on every green run, "…23 of those are covered by
# scope_gate.py's blinded runs (186 §7, STATED, NOT RE-DERIVED HERE)". Both halves of
# that sentence were a problem. 186 measured 23 statements executed by ANYTHING, using a
# recording shim; the comment restated it as 23 covered by THIS gate, and a handoff
# subtracted it to size the remaining work. Re-derived here, against the twenty-five
# mutants below: NINETEEN. The residue was 34, not ~30.
#
# The measurement costs nothing. This gate already runs each mutant as a subprocess and
# already has its stdout in hand — it simply discarded it and kept the exit code. 184's
# rule was "a number an instrument prints and no gate reads is an unasked question"; this
# is one turn further down, an OUTPUT an instrument produces and no gate reads at all.
STATEMENT_ATTRIB_FLOOR = 20    # governed by floor_pin_gate SIZE_LEDGER (§9.3)


# ── 🔴 197 §4 — THE BLAST RADIUS, AND THE CLAIM THIS FILE'S DOCSTRING MAKES ────────
#
# 196 §3 found `control_gate.py` computing a FAIL-line count, printing it inside an `ok`
# line, and comparing it to nothing since 187. 196 §8.3 handed over the observation that
# the defect was a property of a CLASS of instrument and that this file is another member.
# Measured here, over the 25 blinded runs:
#
#     53 FAIL lines across 25 rows · 8 rows redden MORE THAN ONE check
#     🔴 3 of the 25 reddened NO SCOPE-LEDGER POPULATION AT ALL
#
# 🔴 AND THE THIRD LINE IS WORSE THAN THE SILENCE, BECAUSE OF WHAT THIS FILE CLAIMS.
# The docstring above says the scope ledger closed these enumerators with literal floors
# and that THIS FILE IS WHAT KEEPS THEM CLOSED. `doc_recipe_mentions`,
# `recipe_names_constant` and `privileged_tools` had no ledger entry: two went red on a
# `Could not parse X from Y` guard and one on check 12's roster comparison. Delete the
# whole ledger and this gate stayed green over those three. A subject caught by something
# other than the gate is not covered by it — it is being lucky near it. 197 added the three
# missing ledger entries, and the roster below is what stops the class coming back.
#
# 🔴 THE VERDICT HERE RESTS ON TWO EXACT READERS, NOT ON A FUZZY ONE. control_gate had to
# keep its attribution as diagnosis because literal-matching resolves 98 of 103 lines. This
# gate needs no such hedge: `FAIL: SCOPE COLLAPSE <population>:` names its population in the
# text, so "did the population this row feeds collapse" is answered exactly, for every row.
LEDGER: dict[str, tuple[str, ...]] = {
    "_tracked_modes": ("modes.shebangs_confirmed",),
    "all_false_annotation_claims": ("families.allfalse_lines",),
    "annotated_tools": ("annotations.roster",),
    "annotation_class_claims": ("families.annclass_lines",),
    "catalog_index_tools": ("catalog.index_tools",),
    # 🆕 259 — the two readers check 28's CLI half and its host fallback are computed from.
    "host_fallback_remedies": ("xlang.host_fallback_rows",),
    "cli_surface": ("xlang.cli_subcommands",),
    # 🆕 251 — THE ROW READER BOTH OF THE ABOVE NOW COME OFF. `catalog_index_tools` is a
    # `set()` over its keys, so blinding this one collapses the names AND the Destructive
    # cells: one match, two populations, and the map has to say both or the second reads
    # as an unexplained BLAST drift in some later session.
    "catalog_index_rows": ("catalog.index_tools", "catalog.destructive_marked"),
    # 🆕 252 — THE SAME SHAPE ONE FILE-SECTION OVER. `catalog_heading_rows` returns a
    # name -> bool map, so blinding it collapses the sections AND the ✔ glyphs on them:
    # one match, two populations, same reason the row above names both.
    "catalog_heading_rows": ("catalog.sections_read", "catalog.heading_marked"),
    # 🆕 253 — THE PLANE ATOM, AND IT IS ONE POPULATION AND NOT TWO. The two rows above
    # each name a pair because one match yields a name AND a cell. This reader takes its
    # names from `CATALOG_ROW_RE` — already floored as `catalog.index_tools`, and already
    # loud in check 4 when that pattern dies — so only the ATOM is its own. A row named
    # after a population it does not actually collapse reads as covered and is not.
    "catalog_index_planes": ("catalog.plane_atoms",),
    "catalog_json_blocks": ("catalog.json_blocks",),
    # 🆕 254 — ONE READER, TWO POPULATIONS, and 251's rule for which ones. The rows and
    # the tool references both come off this one match, so the map names both. The
    # renderer walk is its own reader over a different tree entirely — the host's, not
    # the addon's — so it gets its own row rather than riding on this one.
    # 🆕 259 — A THIRD POPULATION OFF THE SAME READER. The remedy text is where the CLI
    # spans are found, so blinding this collapses the command join too — the radius moved
    # because a new reader started consuming an existing blind's output, which is 251's
    # third cost and the one that is easiest to leave unwritten.
    "remedy_tables": ("xlang.remedy_rows", "xlang.remedy_tool_refs", "xlang.remedy_cli_refs"),
    "remedy_renderers_read": ("xlang.remedy_renderers",),
    "host_invented_error_sites": ("xlang.host_invented_sites",),
    "host_cause_remedies": ("xlang.host_cause_sentences",),
    # 🆕 255 — check 29's three readers, and each names exactly the population it feeds.
    # `required_any_output_keys` is the LEFT side of the join and the widest blind here:
    # empty it and there is nothing to look for, so every direction agrees instantly.
    "required_any_output_keys": ("xlang.required_any_keys",),
    # 🆕 257 — check 30's four readers. Two are floored populations and two are the
    # block slicer they both stand on, which is why the pair below name no ledger row of
    # their own: `host_tool_blocks` is what the other two READ, so collapsing it collapses
    # both of theirs, and `readiness_waiting_tools` empties into the launcher half of the
    # same comparison rather than into a population with a floor.
    "game_launcher_tools": ("xlang.game_launchers",),
    "output_schema_keys": ("xlang.output_schema_tools",),
    "host_tool_blocks": ("xlang.game_launchers", "xlang.readiness_waiters"),
    "readiness_waiting_tools": ("xlang.readiness_waiters",),
    "tool_bridge_methods": ("xlang.tool_bridge_methods",),
    "addon_handler_bodies": ("xlang.addon_handlers_resolved",),
    "dispatch_methods": ("gdscript.editor_methods", "gdscript.runtime_methods"),
    "doc_recipe_mentions": ("recipes.doc_mentions",),                 # 🆕 197
    "doc_resource_claims": ("resources.doc_claims",),
    "exempt_family_lines": ("families.exempt_lines",),
    "host_bridge_calls": ("host.bridge_calls",),
    "input_schema_shapes": ("shapes.inputs_compared", "shapes.inputs_parsed"),
    "output_schema_shapes": ("shapes.outputs_compared", "shapes.outputs_parsed"),
    "prefix_family_claims": ("families.prefix_glob_lines",),
    "guide_recipe_tools": ("guide.recipe_tools", "guide.recipe_steps"),  # 🆕 261
    "privileged_tools": ("tools.privileged",),                        # 🆕 197
    "recipe_names_constant": ("recipes.names_constant",),             # 🆕 197
    "registered_recipes": ("recipes.registered",),
    "registered_resources": ("resources.registered",),
    "registered_tools": ("tools.registered",),
    "test_count_constants": ("counts.test_constants",),
    "tool_count_claims": ("counts.tool_claims",),
    # 🆕 222 — BOTH READERS GAINED A SECOND CONSUMER, AND THE MAP HAS TO SAY SO. Check 25
    # builds its derivable set from `toolset_sizes()` and expands it with
    # `toolset_aliases()`, so blinding either one now collapses `prose.derivable_values`
    # too. Left unstated, the extra collapse would arrive as an unexplained BLAST drift in
    # some later session rather than as a declared consequence of this one.
    "toolset_aliases": ("families.toolset_aliases",),
    "toolset_claims": ("families.toolset_claims_resolved",),
    "toolset_sizes": ("families.toolset_claims_resolved", "families.toolset_sizes",
                      "prose.derivable_values"),
    # 🆕 253 — THE READER THE THREE ABOVE NOW COME OFF, AND ITS ROW IS THE SUPERSET.
    # `toolset_sizes` is `len()` over this one, so blinding this collapses everything
    # that row names PLUS the membership 4d joins the catalog with. Stated in full
    # rather than by reference: a row that says "same as toolset_sizes" is a row a
    # later session has to resolve by reading two entries, and the map exists so a
    # collapse can be read off one.
    "toolset_members": ("families.toolset_members", "families.toolset_claims_resolved",
                        "families.toolset_sizes", "prose.derivable_values"),
    "uncaptured_tool_registrations": ("tools.registration_sites_scanned",),
    # 🆕 246 — THE FOUR `EMPTY` COULD NOT SPELL. Three of them landed on populations the
    # ledger already had; the fourth is the one that had none, and finding that out is
    # what admitting them was for.
    "catalog_shapes": ("shapes.inputs_compared", "shapes.outputs_compared"),
    "prose_guard_classes": ("prose.guard_suppressions",),
    "prose_numerals": ("prose.numerals_read",),
    "prose_numerals_masked": ("prose.numerals_masked",),
    "prose_pin_problems": ("prose.pins_negative",),
}

# id -> the exact number of `FAIL:` lines that blind produces. Measured, not guessed.
BLAST: dict[str, int] = {
    # 🆕 228: 4 -> 5. `.githooks/pre-commit` joined check 15's EXEC_ROSTER, and blinding
    # the mode reader reports one FAIL per roster member it can no longer see — so a third
    # member is a fifth line. The radius moved because the ROSTER grew, which is the one
    # cause this number is supposed to make visible.
    "_tracked_modes": 5,                      # also: check 15
    # 🆕 254 — check 28's two blinds. `remedy_tables` is the wider one BY CONSTRUCTION:
    # empty it and both directions of the join go quiet together, so what reddens is not
    # the missing rows but the sixty remedies that now read as dead — one FAIL line each,
    # plus the two ledger collapses.
    "remedy_tables": 65,                      # 🆕 259: 64 -> 65, the CLI span join
    "remedy_renderers_read": 1,
    # 🆕 255 — check 29's three, and the asymmetry is the check's own shape. Emptying the
    # LEFT side asks nothing and reports nothing but its ledger row; emptying either RIGHT
    # side leaves all sixteen keys looking unwritten, one FAIL line each, plus the row.
    "required_any_output_keys": 1,            # also: check 29's left side
    # 🆕 257 — check 30's four, and the asymmetry is again the check's shape. Emptying the
    # LAUNCHER set asks nothing of anybody and reports only its ledger row. Emptying the
    # LAUNCHER set asks nothing of anybody — and still costs three lines, because the
    # ledger row goes with it and so does the await-condition retry test, whose block this
    # reader is not what supplies. Emptying the WAITER set leaves both live launchers
    # reading as tools that never waited; emptying the KEY map leaves both reading as tools
    # with nowhere to say so; and emptying the BLOCK SLICER underneath all three is the
    # widest at five, because it takes BOTH floored populations and the retry test with it.
    # 🔴 EVERY NUMBER HERE WAS MEASURED AFTER A PREDICTION MISSED. The first draft of this
    # table guessed 1/2/2/2 from the shape of the check and the sweep answered 3/3/3/5 —
    # which is 196 §3's whole argument for comparing the radius rather than the colour.
    "game_launcher_tools": 3,
    "readiness_waiting_tools": 3,
    "output_schema_keys": 3,
    "host_tool_blocks": 5,
    # Measured rather than predicted: emptying the per-tool method map leaves the ten keys
    # whose emitter is the ADDON unwritten, plus the ledger row. The six keys the HOST block
    # also writes survive it, which is the two-sided join doing what it was built to do.
    "tool_bridge_methods": 11,                # also: check 29's right side
    "addon_handler_bodies": 11,
    "all_false_annotation_claims": 1,
    "annotated_tools": 2,                     # also: check 9
    "annotation_class_claims": 1,
    # 🆕 259 — TWO, AND THE SECOND IS THE LEDGER'S. Blinding the host fallback reader empties
    # a table whose every rule is a rule ABOUT that table: the ceiling passes on zero rows,
    # the dead-row join has nothing to join, the grammar has no sentence to check. Only the
    # emptiness refusal fires — which is exactly why that refusal had to be written — and the
    # SCOPE_LEDGER row collapses alongside it. PREDICTED as 1 and MEASURED as 2, which is the
    # whole reason this number is observed rather than reasoned about.
    "host_fallback_remedies": 2,
    # 🆕 259 — SEVEN, PREDICTED AS TWO, AND THE FIVE THAT WERE MISSED ARE THE POINT.
    # Blinding the CLI-surface reader fires its own emptiness refusal and collapses the
    # ledger row (the two that were reasoned about), refuses each of the 3 `breakpoint-mcp …`
    # spans as naming an undeclared subcommand — and then TWO MORE, because the tool join's
    # exemption is computed from the same reader: with no subcommands resolved, the bare
    # `init` in each `unknown_method` remedy stops being a command and is joined to
    # `registerTool(..)`, which has never had one. A blind whose radius reaches a rule written
    # to EXEMPT things from another rule is exactly what a predicted number gets wrong.
    "cli_surface": 7,
    "catalog_index_tools": 2,                 # also: check 4
    # 🆕 251 — FOUR, AND TWO OF THEM ARE THE LEDGER'S. Blinding the row reader empties
    # both populations it feeds: check 4 names every registered tool as missing from the
    # index, reports all 88 destructive tools as unmarked, and the ledger reddens twice.
    # 🆕 252: 4 -> 5. Check 4c cross-compares the index's ✔ set against the HEADING's,
    # so emptying the row reader no longer only under-reports the column — it also makes
    # the two hand-maintained copies disagree, on one more line. The radius moved because
    # a second reader started being compared to this one.
    "catalog_index_rows": 5,                  # also: check 4 (both columns) + 4c's cross-check
    # 🆕 252 — FOUR, AND THE SHAPE IS 251's. Blinding the heading reader empties both
    # populations it feeds: check 4c names every registered tool as having no section,
    # reports all 89 destructive tools as unmarked in their heading, and the ledger
    # reddens twice. The index/heading cross-comparison does NOT add a fifth — it is
    # subsumed, because an empty heading set makes the symmetric difference the whole
    # index set on one line.
    "catalog_heading_rows": 4,                # also: check 4c (sections + glyphs)
    # 🆕 253 — ONE, AND THE SMALLEST RADIUS ON THIS TABLE IS THE HONEST NUMBER HERE.
    # Blinding the plane reader empties the atoms and 4d names every registered tool on
    # ONE line — its own. It cannot reach the index/heading comparisons, because the
    # names still come off `CATALOG_ROW_RE` and this reader never touched them.
    "catalog_index_planes": 1,                # also: nothing — 4d's atom line alone
    "catalog_json_blocks": 1,
    "dispatch_methods": 3,                    # also: check 1
    "doc_recipe_mentions": 2,                 # also: check 12
    "doc_resource_claims": 2,                 # also: check 10
    # 🆕 225 — TWO, NOT ONE, AND THE GATE FOUND IT RATHER THAN THE AUTHOR. Admitting
    # `docs/TOOL_CATALOG.md` into check 25's population put its "godot-mcp-pro's 162-tool
    # ceiling" sentence in reach of a SECOND reader. Blinding the family exemption used to
    # redden check 13 alone; now check 25 sees an unclaimed 162 on the same line and
    # reddens too. The blind's radius genuinely moved, in the commit that moved it — which
    # is the whole contract this table encodes (196 §3).
    "exempt_family_lines": 2,                 # also: check 25
    "host_bridge_calls": 1,
    "input_schema_shapes": 2,
    "output_schema_shapes": 2,
    "prefix_family_claims": 1,
    # 🆕 251: 3 -> 4. `SECURE_DEFAULT` joined check 13's constant roster, and it is the
    # FIRST member of that roster whose expected value is not `total_tools` — it is
    # `total - privileged`, so blinding `privileged_tools` now moves what check 13
    # expects and reddens a line that sat outside this blind's radius entirely.
    # The row moved because a reader started depending on this population, which is
    # exactly the cause 196 §3 wrote the number to make visible.
    # 🆕 261 — check 31's reader. Blinding it empties both of its populations at once
    # and no other check reads the guide's recipes, so the radius is the two ledger
    # floors and nothing else. Predicted 2 and MEASURED 2 (259's rule: predict, then
    # measure — `cli_surface` was predicted at 2 and measured 7).
    "guide_recipe_tools": 2,
    # 🆕 261: 4 -> 9. Check 31 reads this roster to decide which tool a recipe names is
    # WITHHELD, so emptying it takes all five higher-trust entries in the guide's §10
    # declaration block into "declared but not privileged" at once. The row moved because
    # a reader started depending on this population — 251's rule, and the same cause the
    # 3 -> 4 note below records.
    "privileged_tools": 9,                    # also: checks 11, 13 (the constant roster), 31
    "recipe_names_constant": 2,               # also: check 12
    "registered_recipes": 4,                  # also: check 12
    "registered_resources": 3,                # also: check 10
    # 🆕 222 — TEN, NOT NINE. Blinding the tool roster takes `total_tools` to zero, so the
    # README's two count sentences that no reader claimed until this session — the ones
    # 221 §4 found stale — now redden check 25 as well. The row moving is the new check
    # reaching a population the old ones did not.
    # 🆕 251: 10 -> 11. `catalog.destructive_marked` is intersected with the registered
    # set, so emptying the roster empties the marked column too and the ledger carries one
    # more collapse. The radius moved because a new population was derived FROM this one.
    # 🆕 252: 11 -> 12. `catalog.heading_marked` is intersected with the registered set
    # too, so emptying the roster empties the heading column as well and 4c reports one
    # more collapse. Same cause as 251's 10 -> 11, one population later.
    # 🆕 253: 12 -> 13, AND THE CAUSE IS THE OTHER DIRECTION FOR ONCE. The three before
    # it moved because a new population was DERIVED from this roster. This one moves
    # because 4d compares the roster to a second walk of the same files: with the
    # registration walk empty, `toolsets.ts` is left claiming 292 tools nothing
    # registers, and that line is reachable only because the comparison is symmetric.
    # 🆕 254: 13 -> 63, AND IT IS THE LARGEST SINGLE MOVE THIS ROW HAS EVER MADE. Check
    # 28 joins every tool a REMEDY names back to this roster, so an empty registration
    # walk leaves all fifty of those sentences telling the reader to call a tool that does
    # not exist. The radius is fifty lines wide because the remedies are fifty instructions
    # — which is the cost of writing instructions a machine can check, paid in the one
    # place that says out loud what a blind reaches.
    # 🆕 255: 63 -> 79. Check 29 reads `registered_tools()` to refuse a required-any key on a
    # tool nothing registers, so emptying the registry now names all fifteen of those tools
    # as unregistered and collapses a fourth ledger population with them. The radius moved
    # because a NEW check started reading this reader — 196 §4's shape, declared in the
    # commit that moved it rather than discovered by a later run.
    # 🆕 261: 79 -> 81. `guide_recipe_tools` derives its own tool families FROM this
    # roster, so emptying it collapses check 31's two ledger populations as well — the
    # guide reads as naming nothing. Two lines, both in the ledger, and predicted before
    # they were measured.
    "registered_tools": 81,                   # also: checks 6 8 9 11 13 25 28 29 31, 4c, 4d
    "test_count_constants": 1,
    "tool_count_claims": 1,
    # 🆕 222 — BOTH MOVED, AND BOTH MOVED BECAUSE A CHECK WAS ADDED. This is exactly the
    # case 196 §3 says this number exists to surface: check 25 reads both functions, so
    # blinding `toolset_aliases` now also collapses `prose.derivable_values` (+1), and
    # blinding `toolset_sizes` collapses that AND leaves check 25 reporting every family
    # numeral in the README as underivable (+2). Declared in the commit that moved them.
    # 🔴 AND THE THIRD ROW IS THE ONE THAT PROVES THE FOURTH RETURN IS LOAD-BEARING.
    # Blinding `toolset_claims` empties the (file, line, VALUE) set check 25 subtracts, so
    # the README's family numerals — `a` -> 148, `a,b` -> 154 — stop being claimed by
    # anybody and check 25 reports them. That is the reader and the complement agreeing
    # about the same blindness, which is exactly what the value-level handoff bought.
    "toolset_aliases": 2,                     # also: check 25
    "toolset_claims": 2,                      # also: check 25
    "toolset_sizes": 4,                       # also: check 25
    # 🆕 253 — SEVEN, AND IT IS THE WIDEST NEW RADIUS THIS SESSION BECAUSE IT IS THE
    # READER EVERYTHING ELSE IS NOW DERIVED FROM. Blinding the members collapses
    # `toolset_sizes` with them — check 11b's four, unchanged — and adds 4d's three: no
    # tool has an owner, every catalog `Plane` cell names an id the registry no longer
    # defines, and `toolsets.ts` claims nothing while 292 tools stay registered. That
    # the count row did NOT move is the measurement worth keeping: deriving the size
    # from the membership cost the size half nothing and bought the names.
    "toolset_members": 7,                     # also: checks 11b, 25, 4d
    "uncaptured_tool_registrations": 1,
    # 🆕 267 — measured on the blinded run, not predicted. `host_invented_error_sites`
    # collapses to a scan of zero, which trips its own floor; `host_cause_remedies` empties
    # the sentence table, and the floor beneath it is the only thing that notices, because
    # every grammar rule downstream then agrees with an empty population.
    "host_invented_error_sites": 2,
    "host_cause_remedies": 2,
    # 🆕 246 — measured on the sweep that admitted them, not predicted.
    "catalog_shapes": 4,                      # also: checks 6 7
    "prose_guard_classes": 2,                 # 🆕 246 — check 27's own finder
    "prose_numerals": 2,                      # also: check 25's own scope line
    "prose_numerals_masked": 1,
    "prose_pin_problems": 1,
}

SCOPE_BLAST_TOTAL_FLOOR = 62    # 🆕 246 §2 — at `{FLOOR}`, raised with the four targets admitted
                                # in the same commit. Measured ABOVE it and floored from BELOW
                                # for control_gate's reason:
                                # the per-row equalities above get edited one row at a time,
                                # and this is what notices the sweep going quieter overall
LEDGER_COLLAPSE_FLOOR = 32      # 🆕 246 §2 — at `{FLOOR}`, raised by the same four. Measured
                                # ABOVE it, across every row. The
                                # per-row assertion is the gate; this is the aggregate that
                                # notices the ledger being trimmed row by row to match

COLLAPSE_RE = re.compile(r"^FAIL: SCOPE COLLAPSE ([\w.]+):", re.M)


def collapsed_populations(out: str) -> set[str]:
    """Every SCOPE-LEDGER population that reported a collapse in this run.

    🔴 EXACT, NOT HEURISTIC. The population's name is in the text check 20 prints, so
    there is nothing here to be 95% right about (196 §4's hedge, not needed here).
    """
    return set(COLLAPSE_RE.findall(out))


def roster_problems(names: list[str], blast: dict, ledger: dict) -> list[str]:
    """A target with no declaration, and a declaration with no target — both halves (182).

    🔴 LIFTED OUT AND FIXTURE-FED (195 §8.4). On a healthy tree this returns [], so an
    inline version deletes invisibly.
    """
    problems = []
    for name in names:
        if name not in blast:
            problems.append(
                f"{name} has no BLAST entry — a blind whose radius nothing is watching, which "
                f"is how three rows stopped reddening the ledger without anyone noticing (197 §4)"
            )
        if name not in ledger:
            problems.append(
                f"{name} has no LEDGER entry — nothing says which population this blind is "
                f"supposed to collapse, so ANY red run reads as proof the ledger caught it"
            )
    for name in blast:
        if name not in names:
            problems.append(f"BLAST names {name!r}, which is not a target — a stale entry "
                            f"makes the roster look complete over a row that no longer exists")
    for name in ledger:
        if name not in names:
            problems.append(f"LEDGER names {name!r}, which is not a target")
    return problems


# ── 🆕 246 — `discover-rosters` (233): THE DISCOVER QUESTION, ASKED OF THE LEDGER ─────
#
# 233 §3 asked the discover question of four rosters and found each already answered
# because its population was another roster that had already got a walk. `LEDGER` above
# is that shape from ONE side only: `roster_problems` checks it against `targets()` in
# both directions, so every enumerator has a declared population and every declared
# population belongs to a live enumerator. Nobody ever asked the other question.
#
# 🔴 THE OTHER QUESTION IS ABOUT THE LEDGER, AND ITS ANSWER WAS 29 OF 47. This file's
# docstring says the scope ledger closed the enumerators with literal floors and THIS FILE
# IS WHAT KEEPS THEM CLOSED. Measured in 246, before a line was changed: of the 47
# populations `contract_check.py` floors, twenty-nine could be collapsed by some blind in
# this sweep and EIGHTEEN could not be collapsed by any of them. A floor no blind can move
# is a floor never tested against the collapse it names — the exact thing this gate's
# opening paragraph says such a floor is: "a claim that cannot fail". Nothing said which
# floors those were, in either direction, for seventy-four sessions.
#
# 🟢 THE WALK IS THE ANSWER AND THE ROSTER IS THE RESIDUE. `ledger_populations` reads the
# ledger out of the source — a walk, not a second list — and every population it finds is
# either reachable by a declared blind or carries a row below saying what stops it. An
# equality, not a floor: a walk that returns nothing turns every row stale and refuses, so
# this half needs no floor constant of its own (245 §1's shape, one gate over).
LEDGER_START = re.compile(r'^SCOPE_LEDGER: "list\[tuple\[str, int, int, str\]\]" = \[$', re.M)
LEDGER_ROW = re.compile(r'^    \("([\w.]+)", ', re.M)


def ledger_populations(text: str) -> list[str]:
    """Every population name in `contract_check.py`'s SCOPE_LEDGER, in file order."""
    m = LEDGER_START.search(text)
    if not m:
        return []
    end = text.index("\n]\n", m.end())
    return LEDGER_ROW.findall(text[m.end():end])


# 🔴 EVERY ROW IS ONE MEASUREMENT AND THEY ALL HAVE THE SAME CAUSE, WHICH IS WHY THE CAUSE
# IS WRITTEN ONCE. `targets()` blinds a FUNCTION: it anchors on an annotated `def` and
# injects the empty its return type promises. Each population below is a module-level
# accumulator — a list, set, dict or counter initialised at the top of a check block and
# filled by a loop inside it — so there is no `def` to anchor on and no return to empty.
# Blinding the initialiser is a no-op, because the loop below it fills the binding again.
#
# 🔴 THAT IS A HARNESS LIMITATION REPORTED UNDER A CEILING, WHICH IS 197 §3's SHAPE, AND
# SAYING SO IS THE POINT OF THE TABLE. Sixteen floors in the file this gate exists to
# defend are currently defended by nothing but their own arithmetic. The work is a SECOND
# INJECTOR — one that anchors on a module-level binding and empties it AFTER the loop that
# fills it — and it is `scope-ledger-unreached` in the queue, priced by this table.
LEDGER_UNREACHED: dict[str, str] = {
    "versions.sites_checked":
        "check 14's release-ritual counter, summed from two comparison lists as the check "
        "walks them; there is no enumerator between the files and the number",
    "xlang.codec_emitted":
        "check 23 reads it with a module-level `re.findall` over the addon's encoder half — "
        "an expression, not a function",
    "xlang.codec_accepted":
        "the decoder half of the same statement, and the same reason",
    "xlang.codec_fields":
        "a dict initialised empty at the top of check 23 and filled by the loop under it, "
        "so emptying the initialiser is undone before any check reads it",
    "xlang.ts_variant_tags":
        "check 23's TypeScript producer list, accumulated by the same shape of loop",
    "xlang.addon_err_codes":
        "check 23's GDScript error codes, a set filled while walking the addon",
    "xlang.ts_err_branches":
        "a comprehension over `_branch_hits`, which is itself a module-level accumulation",
    "xlang.err_branch_bindings":
        "the (method, code, file) list check 23 builds as it reads the TS branches",
    "xlang.unsupported_capability":
        "one KEY of check 24's `unsupported_kinds` dict — a blind would have to empty the "
        "key rather than the binding, which is a shape the current injector cannot express",
    "xlang.unsupported_shape":
        "the other key of the same dict, and the same shape",
    "xlang.kind_checked_branches":
        "check 24's counter, incremented in a loop",
    "xlang.unsup_messages_read":
        "check 24c's message counter, incremented in the loop that classifies each site",
    "xlang.shape_guard_classes":
        "check 24c's guard-class counter, incremented beside it",
    "addon.copy_roots_read":
        "check 24b derives it from `addon_copy_compared` with a set comprehension",
    "addon.copy_pairs":
        "a `sum` over the same mapping, one line up",
    "addon.copies_compared":
        "the mapping itself, built by a dict comprehension over `addon_copy_files`",
}


def ledger_reach_problems(pops: list[str], ledger: dict, unreached: dict) -> list[str]:
    """Both directions between the ledger's populations and the blinds that can move them.

    🔴 LIFTED OUT AND FIXTURE-FED for `roster_problems`'s reason (195 §8.4): on a healthy
    tree this returns [], so an inline version deletes invisibly.
    """
    problems: list[str] = []
    if not pops:
        problems.append(
            "ledger_populations read NOTHING out of contract_check.py — the SCOPE_LEDGER "
            "moved or was renamed, and every row in LEDGER_UNREACHED below is now a claim "
            "about a table this gate can no longer find"
        )
    reachable = set().union(*ledger.values()) if ledger else set()
    known = set(pops)
    for pop in pops:
        if pop in reachable or pop in unreached:
            continue
        problems.append(
            f"{pop} is floored in the SCOPE_LEDGER and NO blind in this sweep can collapse "
            f"it — a floor never tested against the collapse it names is a claim that "
            f"cannot fail. Give it an enumerator, or declare it in LEDGER_UNREACHED with "
            f"the measurement that says what stops one"
        )
    for pop in unreached:
        if pop not in known:
            problems.append(
                f"LEDGER_UNREACHED names {pop!r}, which is not a population in the ledger — "
                f"a stale row makes the residue look smaller than it is"
            )
        elif pop in reachable:
            problems.append(
                f"LEDGER_UNREACHED says {pop!r} is beyond every blind, and LEDGER declares a "
                f"blind that collapses it. The run's own tables refute the exclusion, which "
                f"is the only way an exclusion should ever have to be re-read (245 §3)"
            )
    for pop in reachable:
        if pop not in known:
            problems.append(
                f"LEDGER declares a blind collapsing {pop!r}, which the ledger does not "
                f"contain — the population was renamed and the per-row assertion above is "
                f"now waiting for a line that can never be printed"
            )
    return problems

def run(source: str) -> tuple[bool, bool, str]:
    """(green, executed, output). The mutant is removed whatever happens.

    🔴 `executed` EXISTS BECAUSE `green=False` HAD TWO CAUSES AND ONE OBSERVABLE (181).

    Until this session `run` returned `p.returncode == 0 and "ALL HARD CHECKS PASSED"`,
    and every caller read a False as "the contract check CAUGHT the mutant". But a
    mutant that does not COMPILE also exits non-zero — Python exits 1 on a SyntaxError,
    exactly as `contract_check.py` exits 1 on a violation. So "caught" and "never ran"
    were the same observable, and this gate reported the first when it meant the second.

    Measured, by breaking the injected text so that EVERY mutant was uncompilable:

        SCOPE_GATE_CONTROL ok — an unmutated copy passes, so a caught mutant means something
        SCOPE_GATE_BLIND_COUNT 0 of 25
        SCOPE_GATE ok — every derived population collapses LOUDLY        exit 0

    Twenty-five targets, zero escapes, a green verdict, and not one `contract_check` had
    executed. The CONTROL below did not see it: it covers the UNMUTATED path, and the
    defect is on the mutated one — 179 §11.25's rule (a gate enforces its rules where
    they were WRITTEN, not where its population comes from) pointed at a harness.

    `REPORT_MARKER` is the discriminator, and it was measured before being relied on:
    all 25 genuine catches print it (`MARKER_ABSENT_ON_A_REAL_CATCH 0 of 25`), because
    `contract_check.py` prints its report and THEN exits 1. So a run that goes red
    WITHOUT the marker did not reach the report, and that is a harness failure rather
    than a catch.
    """
    MUT.write_text(source)
    try:
        p = subprocess.run(
            [sys.executable, str(MUT)], capture_output=True, text=True, cwd=str(ROOT)
        )
    finally:
        MUT.unlink(missing_ok=True)
    green = p.returncode == 0 and "ALL HARD CHECKS PASSED" in (p.stdout + p.stderr)
    return green, REPORT_MARKER in p.stdout, p.stdout + p.stderr


def gate_failed(targets_low: bool, blind: int, never_ran: int,
                attrib_low: bool = False, roster: int = 0, blast_drift: int = 0,
                ledger_miss: int = 0, blast_low: bool = False,
                collapse_low: bool = False) -> bool:
    """This gate's verdict, as a PURE function of its three populations.

    🔴 EXTRACTED FOR `combineFailed`'s REASON, ONE FILE OVER (180 §7.1, and 174 §8 / 176's
    G3 before it — the same defect four sessions running). `never_ran` arrived this
    session as a third way for the run to be untrustworthy, and inline it would have been
    one more `if x: failed = True`, which is a wire a mutant deletes with the verdict
    intact and the run still green. On a healthy tree all three inputs are already
    falsey, so the new term is never satisfied apart from the others and its deletion is
    invisible to every live run. Lifted out, the truth table below can assert it.

    🔴 197 ADDED FIVE MORE TERMS FOR THE SAME REASON. Every one of them is falsey on a
    healthy tree, so every one of them deletes invisibly unless the table below asserts it
    reaches this exit code ALONE.
    """
    return (targets_low or bool(blind) or bool(never_ran) or attrib_low
            or bool(roster) or bool(blast_drift) or bool(ledger_miss)
            or blast_low or collapse_low)


def _self_check() -> list[str]:
    """Run BEFORE the sweep. Each population must reach the verdict ALONE — 173's G3 and
    176's rule about two conditions that are never satisfied apart."""
    problems = []
    # 🆕 204 §5 — THE CALL WIRING, FIRST. Every fixture below proves a predicate WORKS;
    # none of them proves this gate still CALLS it, and on a green tree no input can tell
    # those apart (202 §4). Defined after this function, so the lookup is deferred.
    problems.extend(_call_wiring_problems())
    if gate_failed(False, 0, 0):
        problems.append("gate_failed reports a failure over three healthy populations")
    if STATEMENT_ATTRIB_FLOOR <= 0:
        problems.append(
            f"STATEMENT_ATTRIB_FLOOR is {STATEMENT_ATTRIB_FLOOR}. A floor at zero cannot bite, "
            f"and this is the only place the attribution is pinned."
        )
    for floor_name, floor in (("SCOPE_BLAST_TOTAL_FLOOR", SCOPE_BLAST_TOTAL_FLOOR),
                              ("LEDGER_COLLAPSE_FLOOR", LEDGER_COLLAPSE_FLOOR)):
        if floor <= 0:
            problems.append(
                f"{floor_name} is {floor}. A floor at zero cannot bite, and it is the only "
                f"thing watching the per-row equalities being edited one row at a time."
            )
    for label, args in (("targets_low", (True, 0, 0)), ("blind", (False, 1, 0)),
                        ("never_ran", (False, 0, 1)), ("attrib_low", (False, 0, 0, True)),
                        ("roster", (False, 0, 0, False, 1)),
                        ("blast_drift", (False, 0, 0, False, 0, 1)),
                        ("ledger_miss", (False, 0, 0, False, 0, 0, 1)),
                        ("blast_low", (False, 0, 0, False, 0, 0, 0, True)),
                        ("collapse_low", (False, 0, 0, False, 0, 0, 0, False, True))):
        if not gate_failed(*args):
            problems.append(
                f"gate_failed does not fail on {label} ALONE — that population cannot reach "
                f"the exit code by itself, so the branch that feeds it deletes invisibly"
            )

    # 🔴 THE 197 DETECTORS, FIXTURE-FED (195 §8.4's shape, applied on the way in). On a
    # healthy tree both return empty, so an inline version deletes invisibly — the class
    # 188's sweep proved live in control_gate three branches at a time.
    if roster_problems(["a"], {"a": 1}, {"a": ("p",)}):
        problems.append("roster_problems flags a complete roster")
    if not roster_problems(["a"], {}, {"a": ("p",)}):
        problems.append(
            "roster_problems does NOT flag a target with no BLAST entry — a blind whose "
            "radius nothing declares is exactly what 197 §4 found three of"
        )
    if not roster_problems(["a"], {"a": 1}, {}):
        problems.append(
            "roster_problems does NOT flag a target with no LEDGER entry — without one, "
            "ANY red run reads as proof the ledger caught the blind"
        )
    if not roster_problems([], {"gone": 1}, {"gone": ("p",)}):
        problems.append(
            "roster_problems does NOT flag a declaration with no target — a stale entry "
            "makes the roster look complete over a row that no longer exists"
        )
    if collapsed_populations("FAIL: SCOPE COLLAPSE families.exempt_lines: 0 < floor 1"
                            ) != {"families.exempt_lines"}:
        problems.append("collapsed_populations does not read a live SCOPE COLLAPSE line")
    if collapsed_populations("FAIL: something else entirely"):
        problems.append(
            "collapsed_populations reads a population out of a line that names none — the "
            "per-row ledger assertion would then pass on any red run at all"
        )

    # 🆕 246 — THE LEDGER-REACH HALF, EVERY BRANCH ALONE. Four refusals and one silence;
    # a table that only ever returns [] on a healthy tree needs every branch driven by a
    # fixture or it is four dead lines wearing one live name.
    if ledger_reach_problems(["a"], {"e": ("a",)}, {}):
        problems.append("ledger_reach_problems flags a population a declared blind reaches")
    if ledger_reach_problems(["a", "b"], {"e": ("a",)}, {"b": "why"}):
        problems.append("ledger_reach_problems flags a population declared unreachable with a reason")
    if not ledger_reach_problems(["a", "b"], {"e": ("a",)}, {}):
        problems.append(
            "ledger_reach_problems does NOT flag a floor no blind can move — the whole "
            "question 233's row asked, and the answer was eighteen of forty-seven"
        )
    if not ledger_reach_problems(["a"], {"e": ("a",)}, {"gone": "why"}):
        problems.append(
            "ledger_reach_problems does NOT flag a row naming a population the ledger has "
            "lost — a stale row makes the residue look smaller than it is"
        )
    if not ledger_reach_problems(["a"], {"e": ("a",)}, {"a": "why"}):
        problems.append(
            "ledger_reach_problems does NOT flag a row REFUTED by the run's own tables — an "
            "exclusion its own gate can falsify must not need a session to re-read it"
        )
    if not ledger_reach_problems(["a"], {"e": ("ghost",)}, {}):
        problems.append(
            "ledger_reach_problems does NOT flag a LEDGER entry naming a population that is "
            "not in the ledger — the per-row assertion would wait forever for that line"
        )
    if not ledger_reach_problems([], {"e": ("a",)}, {"a": "why"}):
        problems.append(
            "ledger_reach_problems does NOT flag an EMPTY walk — the equality that stands in "
            "for a floor here, and the one thing that makes every row below it stale"
        )
    if not ledger_populations(SRC.read_text()):
        problems.append(
            "ledger_populations reads nothing out of the live contract_check.py — the walk "
            "is scoped to a declaration this file no longer matches"
        )
    return problems


CALL_SENTINEL = "🔴 SCOPE_CALL_WIRING sentinel — a patched predicate reached the report"

# 🔴 204 §5 — THE KEY ROSTER IS PART OF THE CLAIM (199 §35, and 203's `I4` for the
# call-site roster one axis over). A predicate that joins this seam without being
# declared here is a predicate whose call nothing proves, arriving inside the very
# mechanism built to prove calls.
# 🆕 246 — A SECOND KEY, AND THE BRANCH ITS ABSENCE MADE UNWRITABLE IS NOW WRITTEN.
# `_call_wiring_problems` below says in as many words that a ONE-KEY SEAM HAS NO OTHER KEY
# TO LEAK INTO, and that the commit which adds a second key is the commit in which the leak
# branch becomes writable and must be written. This is that commit. The check the comment
# deferred is `_call_wiring: <fn>() leaked into <other key>` — a stub answering under a key
# it is not about, which on a one-key seam had no way to happen and now does.
SEAM_KEYS = ("roster", "ledger_reach")


def collect_problems(names: list[str], pops: "list[str] | None" = None) -> dict[str, list[str]]:
    """🔴 204 §5 — THE ONE INVOCATION POINT, SO THE CALL CAN BE PATCHED.

    202 closed `U2` in `floor_pin_gate.py` and 203 ported it to `instrument_gate.py`:
    a predicate proved by a fixture is NOT a predicate proved to be CALLED, and on a
    green tree no mutation of the INPUT can tell the two apart, because a predicate
    that finds nothing reads exactly like a predicate nobody asked. `measure203.py`
    measured the remaining population at three, and this is one of them.

    🔴 THE POPULATION IS AN ARGUMENT AND NOT A GLOBAL. `instrument_gate`'s seam reads
    module tables and takes only a stage; this gate's roster is computed from `targets()`
    inside `main()`, so the names come in through the door. A seam that reached back into
    `main()`'s locals would be a second reader of the same population — 200 §34's
    two-predicate rot, inside the seam.

    The `problems.extend` this feeds stayed exactly where it was: this changes where the
    list comes from, not what is printed or in what order (202 §8)."""
    # 🔴 THE POPULATION COMES IN THROUGH THE DOOR, AS THE NAMES DO. `main()` reads the
    # source once and hands both in; a seam that re-read the file here would be a second
    # reader of the same population, which is the rot the docstring above names.
    return {
        "roster": roster_problems(names, BLAST, LEDGER),
        "ledger_reach": ledger_reach_problems(list(pops or []), LEDGER, LEDGER_UNREACHED),
    }


def _call_wiring_problems() -> list[str]:
    """🔴 PROVE THE CALL, NOT THE LOGIC. 202 §9.4 / 203 §5 ported, with ONE BRANCH
    DELIBERATELY NOT WRITTEN.

    203 §6 shipped `I7` because a branch of its new check had never fired ALONE, and
    said a check that has never refused has not been audited. The corollary is the
    reason this seam is shorter than that one: `instrument_gate`'s leak branch asks
    whether a stub's result arrived under a key it is not about, and a ONE-KEY SEAM HAS
    NO OTHER KEY TO LEAK INTO. Writing it here would ship a branch whose population is
    structurally empty — 201 §9.43's passes-for-the-wrong-reason, in the instrument.

    🟢 `SEAM_KEYS` IS WHAT FIRES THE DAY THAT STOPS BEING TRUE. A second predicate
    joining this seam reddens the roster branch until it is declared, and declaring it
    is the commit in which the leak branch becomes writable and must be written."""
    g = globals()
    bad: list[str] = []

    keys = tuple(sorted(collect_problems([]).keys()))
    if keys != tuple(sorted(SEAM_KEYS)):
        bad.append(
            f"_call_wiring: the seam returns {keys} and SEAM_KEYS declares "
            f"{tuple(sorted(SEAM_KEYS))}. A key nobody declared is a predicate whose call "
            f"nothing proves — and if the seam now has TWO keys, the leak branch this "
            f"check does not carry has stopped being unwritable and must be written")

    for key, fname in (("roster", "roster_problems"), ("ledger_reach", "ledger_reach_problems")):
        real = g[fname]
        g[fname] = lambda *a, **k: [CALL_SENTINEL]
        try:
            got = collect_problems([])
        finally:
            g[fname] = real
        if CALL_SENTINEL not in got.get(key, []):
            bad.append(
                f"_call_wiring: {fname}() no longer reaches the report under {key!r} — the "
                f"predicate is intact and NOTHING CALLS IT. The four fixtures in "
                f"`_self_check` prove the function; this proves the gate still runs it, and "
                f"197 §4 found three blinds with no declared radius the last time it did not")
        # 🆕 246 — AND THE BRANCH A ONE-KEY SEAM COULD NOT HAVE. A stub is patched over
        # exactly one predicate, so its sentinel must arrive under exactly one key. If it
        # appears under another, the two predicates share a call the seam presents as
        # separate — and the whole point of naming keys is that a caller can tell which
        # answer came from which reader (203 §5's leak branch, made writable by the second
        # key and written in the same commit that added it).
        for other, spilled in got.items():
            if other != key and CALL_SENTINEL in spilled:
                bad.append(
                    f"_call_wiring: {fname}()'s result LEAKED into {other!r}. One stub, two "
                    f"keys: the seam reports two readers where the tree has one, so a "
                    f"predicate could be deleted and its key would still be answered")
    return bad


def main() -> int:
    # 🔴 224 §6.6 — BEFORE THE SELF-CHECK, NOT AFTER. This gate rewrites TRACKED
    # files and restores them in a `finally`; a second one running now would read
    # and write the same tree. A self-check that ran first would be reading
    # somebody else's mutant and would report it as a defect in this repository.
    acquire("scope_gate.py")
    text = SRC.read_text()
    found = targets(text)
    print(f"SCOPE_GATE targets={len(found)} floor={TARGET_FLOOR}")

    for problem in _self_check():
        print(f"🔴 SCOPE_GATE_SELFCHECK {problem}")
    if _self_check():
        return 1

    targets_low = len(found) < TARGET_FLOOR
    if targets_low:
        print(
            f"🔴 SCOPE_GATE_TARGETS_COLLAPSE {len(found)} < {TARGET_FLOOR} — this gate's own\n"
            f"   scope shrank. Either an enumerator was deleted (lower the literal on purpose),\n"
            f"   or a return annotation changed shape and EMPTY no longer knows it, in which\n"
            f"   case every check below passes over a target it has stopped testing."
        )

    # CONTROL. An unmutated copy MUST pass, or every 'caught' below is meaningless —
    # 171 §5's M4, which is the only reason the green mutants there could be believed.
    control_green, control_ran, control_out = run(text)
    if not control_green:
        print("🔴 SCOPE_GATE_CONTROL an UNMUTATED copy does not pass — the harness is lying, stop.")
        return 1
    if not control_ran:
        print(f"🔴 SCOPE_GATE_MARKER the unmutated copy passed WITHOUT printing {REPORT_MARKER!r}.\n"
              "   The discriminator every judgement below rests on no longer identifies a run that\n"
              "   executed. Fix REPORT_MARKER before believing a single line of this gate.")
        return 1
    print("SCOPE_GATE_CONTROL ok — an unmutated copy passes AND prints the report marker,\n"
          "                       so both 'caught' and 'never ran' are distinguishable below")

    # The attribution table, built once. A statement counts as reached by this gate when
    # its own longest UNIQUE literal appears in a mutant's output — the same evidence
    # control_gate.py accepts from its hand-written fingerprints, applied to all of them.
    # Statements carrying no literal are absent from the table by construction and are
    # counted separately there (CONTROL_GATE_UNFINGERPRINTABLE), never silently dropped.
    stmts = cg_statements(text)
    fps = cg_auto_fingerprints(stmts)
    reached: set[int] = set()

    blind: list[str] = []
    never_ran: list[str] = []
    # 🔴 197 §4. The roster halves FIRST — a sweep over a roster with a hole in it would
    # print 24 clean rows and say nothing about the twenty-fifth.
    seam = collect_problems([n for n, _e, _p in found], ledger_populations(text))
    roster = seam["roster"]
    for problem in roster:
        print(f"🔴 SCOPE_GATE_ROSTER {problem}")
    # 🆕 246 — `discover-rosters` (233), THE HALF THAT WAS ABOUT THE LEDGER RATHER THAN
    # ABOUT THIS FILE'S OWN ROSTERS. Printed with the numbers whether it refuses or not:
    # the residue is the point, and a residue that only appears on failure is a residue
    # nobody sizes.
    reach = seam["ledger_reach"]
    for problem in reach:
        print(f"🔴 SCOPE_GATE_LEDGER_REACH {problem}")
    _pops = ledger_populations(text)
    _reachable = sorted(set().union(*LEDGER.values()) & set(_pops))
    print(f"SCOPE_GATE_LEDGER_REACH {len(_reachable)}/{len(_pops)} ledger population(s) can be "
          f"collapsed by a blind in this\n"
          f"                        sweep · {len(LEDGER_UNREACHED)} declared beyond it, each with "
          f"the measurement that says why")

    blast_drift: list[str] = []
    ledger_miss: list[str] = []
    blast_total = 0
    collapses = 0
    for name, empty, pos in sorted(found):
        mutant = text[:pos] + f"\n    return {empty}  # SCOPE_GATE" + text[pos:]
        green, executed, out = run(mutant)
        reached.update(ln for ln, fp in fps.items() if fp in out)
        fails = out.count("\nFAIL: ") + int(out.startswith("FAIL: "))
        pops = collapsed_populations(out)
        declared = BLAST.get(name)
        want = set(LEDGER.get(name, ()))
        blast_total += fails
        collapses += len(pops & want)
        if green:
            blind.append(name)
            print(f"🔴 SCOPE_GATE_BLIND {name} -> {empty}: the run is STILL GREEN")
        elif not executed:
            never_ran.append(name)
            print(f"🔴 SCOPE_GATE_NEVER_RAN {name} -> {empty}: red, but the copy never reached the report")
        else:
            missing = want - pops
            if declared is not None and fails != declared:
                blast_drift.append(name)
                print(f"🔴 SCOPE_GATE_BLAST {name}: declared {declared} FAIL line(s), observed "
                      f"{fails}. The blind's radius moved. If a check was ADDED this row now "
                      f"reddens it too and nobody was told — 196 §3, which is the whole reason "
                      f"this number is compared. Update the BLAST entry ON PURPOSE, in the "
                      f"commit that moved it. Populations that collapsed: {sorted(pops) or '-'}")
            if missing:
                ledger_miss.append(name)
                print(f"🔴 SCOPE_GATE_LEDGER {name}: the run went red, but the SCOPE-LEDGER "
                      f"population(s) this blind is supposed to collapse did NOT: "
                      f"{sorted(missing)}. Something ELSE caught it — a parse guard, a count "
                      f"drift — and the ledger floor this row exists to defend is unprotected. "
                      f"Collapsed instead: {sorted(pops) or 'nothing at all'}")
            if not missing and (declared is None or fails == declared):
                print(f"  ok   {name:<34} -> {empty:<14} red · {fails} FAIL line(s), declared "
                      f"{declared} · collapsed {' '.join(sorted(want))}")

    print(f"SCOPE_GATE_BLIND_COUNT {len(blind)} of {len(found)} · never-ran {len(never_ran)}")
    attrib_low = len(reached) < STATEMENT_ATTRIB_FLOOR
    print(f"SCOPE_GATE_STATEMENTS {len(reached)}/{STATEMENT_ATTRIB_FLOOR} of {len(stmts)} failure "
          f"statement(s) in contract_check.py are\n"
          f"                      EXECUTED by these blinded runs — derived from their output, not "
          f"stated (188 §5)")
    if attrib_low:
        print(
            f"🔴 SCOPE_GATE_ATTRIB_COLLAPSE {len(reached)} < {STATEMENT_ATTRIB_FLOOR} — these mutants\n"
            "   reach fewer of contract_check.py's failure statements than when this floor was\n"
            "   measured. Every 'ok' above can still print while the runs redden for a shallower\n"
            "   reason than before, so this is the half the exit code cannot see. Lower it ON\n"
            "   PURPOSE if an enumerator was retired; otherwise a check stopped reporting."
        )
    if never_ran:
        print(
            f"\n🔴 {len(never_ran)} mutant(s) exited non-zero WITHOUT executing a single check, and\n"
            "   before 181 every one of them was counted as CAUGHT. A SyntaxError and a violation\n"
            "   are both `returncode != 0`; the injection landing badly, a changed def signature,\n"
            "   or an import that moved all produce this. Every 'ok' line above is only worth what\n"
            "   this list costs — fix the injection, do not lower the floor."
        )
    if blind:
        print(
            "\n🔴 The enumerator(s) above can match NOTHING AT ALL and contract_check.py still\n"
            "   prints ALL HARD CHECKS PASSED. 'Found no problems' and 'did not look' are the\n"
            "   same observable, which is the whole class 171 named: an instrument's silence is\n"
            "   a measurement of the instrument, not of the thing. Add the population it derives\n"
            "   to the SCOPE_LEDGER in contract_check.py with a LITERAL floor and the consequence\n"
            "   of its collapse — never a floor derived from the same finder (check 16 did that,\n"
            "   and `len(x) >= len(x)` is why it was on this list)."
        )
    # ── 🔴 197 §4. THE BLAST RADIUS AND THE LEDGER CLAIM, IN AGGREGATE ──────────────
    # Two numbers, not one (194 §33): `blast_total` is what the blinds DO, and
    # `collapses` is how much of that lands on the ledger this file exists to defend.
    # Both are floored from below; the per-row assertions above are the gate.
    blast_low = blast_total < SCOPE_BLAST_TOTAL_FLOOR
    collapse_low = collapses < LEDGER_COLLAPSE_FLOOR
    print(f"SCOPE_GATE_BLAST {blast_total}/{SCOPE_BLAST_TOTAL_FLOOR} FAIL line(s) across "
          f"{len(found)} blind(s), every row's count DECLARED and compared")
    print(f"SCOPE_GATE_LEDGER {collapses}/{LEDGER_COLLAPSE_FLOOR} scope-ledger population "
          f"collapse(s) — every blind reddens the LEDGER,\n"
          f"                  not merely the run (197 §4: three rows did not, and the "
          f"ledger had no entry for them)")
    if blast_low:
        print(f"🔴 SCOPE_GATE_BLAST_LOW {blast_total} < {SCOPE_BLAST_TOTAL_FLOOR} — the blinds\n"
              "   redden less than they did when this floor was measured. Each row's own\n"
              "   equality is edited one row at a time; this is what notices the sweep\n"
              "   getting quieter overall.")
    if collapse_low:
        print(f"🔴 SCOPE_GATE_LEDGER_LOW {collapses} < {LEDGER_COLLAPSE_FLOOR} — fewer\n"
              "   ledger populations collapse than when this was measured, so more of what\n"
              "   this gate reports as caught is being caught by something that is not the\n"
              "   ledger. That is the state 197 §4 found and closed; do not re-enter it by\n"
              "   lowering this number.")

    # 🔴 ONE VERDICT, THROUGH THE FUNCTION THE SELF-CHECK PROVED (see gate_failed above).
    if gate_failed(targets_low, len(blind), len(never_ran), attrib_low, len(roster) + len(reach),
                   len(blast_drift), len(ledger_miss), blast_low, collapse_low):
        print("\nSCOPE_GATE 🔴 FAILED")
        return 1
    # 🔴 THE VERDICT NAMES WHAT IT ACTUALLY VERIFIED (174 §5). The old wording —
    # "every derived population collapses LOUDLY" — was the line printed over 25 mutants
    # that never ran, and it is the only line a reader of a green CI log ever sees.
    print(f"\nSCOPE_GATE ok — all {len(found)} enumerator(s) blinded, each EXECUTED a "
          f"contract check, each went red,\n"
          f"                each reddened the exact number of FAIL lines it declares, and each "
          f"collapsed the\n"
          f"                SCOPE-LEDGER population it names — so the LEDGER is what caught it "
          f"(197 §4)")
    return 0


if __name__ == "__main__":
    # 🆕 228 — `run_and_settle` and not `main`: the mutation record has to close on
    # EVERY exit path, and this file has more than one. See _gate_lock.run_and_settle.
    sys.exit(run_and_settle("scope_gate.py", main))
