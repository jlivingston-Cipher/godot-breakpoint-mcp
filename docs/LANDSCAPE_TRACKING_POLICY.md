# Landscape tracking policy

**Effective 2026-08-09. Supersedes the ad-hoc practice of sessions 100–222.**

This file governs how Breakpoint MCP tracks the rest of the Godot AI/MCP landscape, and
how we write about it. It is short on purpose: four rules, each of which exists because
the previous practice failed in a specific, identifiable way.

---

## Rule 1 — Terminology: **alternative MCP servers**

The house term for other projects in this space is **"alternative MCP servers"** — short
form **"the alternatives"**, or simply the project's own name.

The word **"rival"** is retired, along with "competitor" used pejoratively, "threat",
"enemy", "beat", "kill", and "attack line". Filenames use `ALTERNATIVES`, not `RIVALS`.

Two qualifications keep the term accurate:

- Several tracked entries are **in-editor AI addons**, not MCP servers — they never open a
  socket and cannot be driven by an MCP client. Call those **in-editor AI addons**. Using
  "alternative MCP server" for something that is not one is exactly the kind of imprecision
  this policy exists to prevent.
- A few entries are **adjacent** (runtime bridges, asset-generation bridges) or have been
  **ruled out of category** entirely. The roster records which, and those rulings stand
  until new evidence overturns them.

**Why.** We are not in competition with these projects. We maintain and improve Breakpoint
so that adopting it is the most compelling choice for the greatest number of users. That is
a statement about our own work, and it is measured against users' needs — not against
anyone else's scoreboard. Language that frames the field as a fight produces analysis
that optimises for the fight.

## Rule 2 — The roster is permanent, and every sweep covers all of it

`docs/alternative_mcp_roster.json` holds **every product that has appeared in any prior
competitive-analysis sweep.** Entries are never dropped. A product that stops moving is
marked `dormant`; one ruled out of category keeps its ruling so a later sweep does not
re-litigate a settled question.

Every sweep covers the **whole roster**, in two tiers:

| | Condition | What the sweep owes it |
|---|---|---|
| **No change** | Live version and modify date match what the roster recorded, and the repository HEAD has not moved since `last_analysed` | A line stating **no change since `<last_analysed>`, with the evidence** — the commit SHA and version compared. Nothing more. |
| **Moved** | Either has changed | A **source-level pass**: clone at HEAD, read the diff since `last_analysed`, re-derive counts from source, and update the roster entry. |

**Counts are never taken from a README.** Derive from registration tables and dispatch
maps, and cross-check with a second independent derivation. Record both.

**Why.** Prior sweeps covered three or four projects each and carried the rest forward
unverified, with the carried section honestly flagged as stale. The 2026-08-09 sweep found
that one carried project had shipped a debugger 48 hours after the document that said the
category could not. The fix is not to read everything deeply every time — it is to make
"nothing changed" a *measured* result rather than an *unexamined* one.

🔴 **AND IT HAPPENED AGAIN, TO THE SAME PROJECT, BECAUSE ONLY THE FIRST HALF OF THAT
CONDITION WAS EVER IMPLEMENTED.** The "No change" row above has two clauses and
`assetlib_sweep.py` read one of them: the Asset Library card. `godot-mcp-enhanced` shipped
a complete interactive debugger at `6394ddb` on 2026-08-09 — an `EditorDebuggerPlugin`
subclass with ten handlers covering breakpoints, stepping, the call stack, frame
inspection and expression evaluation — and did not re-publish its card until 2026-08-22.
For thirteen days the sweep reported it as *no change*, with the evidence, and the
evidence was about the card. The roster's own two fields disagreed about when the pass had
happened as well: `last_analysed` read 2026-08-09 against a `last_analysed_commit` dated
2026-08-08, and the commit in the gap is the one that overturned the ruling.

Since 279 the sweep reads both clauses. `source_state` compares each entry's
`last_analysed_commit` against its repository's live head and answers three ways — held,
moved, and **unread**, because a forge that will not answer is not a green — and `--check`
refuses on a repository that moved even when the card did not. Every row the card leg
alone would call *no change* is marked as such in the printout.

## Rule 3 — Every channel a project can ship in is swept mechanically, not by memory

🔴 **THIS RULE WAS WRITTEN ABOUT ONE CHANNEL AND IT COST EXACTLY WHAT ITS OWN LAST SENTENCE
WARNED ABOUT.** That sentence is *a gate that reads a roster is a gate over a population
somebody chose* — and until 291 somebody had chosen godotengine.org's Asset Library, which
is where Godot **addons** are published. A project that ships as an npm package, registers
in the official MCP Registry, or sells from its own site was never in the query, so no
amount of health in the sweep could ever have surfaced it. Three channels read on one
afternoon surfaced **fifty projects this roster had never held**, including
`Coding-Solo/godot-mcp` at 5,399 stars — roughly 2.8× the project this document and two
published analyses both called *the clear popularity leader*. **The population was the
defect, and the data was fine.**

**The channels are declared in `scripts/assetlib_sweep.py`'s `CHANNELS`**, each with what it
serves, why it is in the population, and whether a machine can enumerate it at all:

| channel | enumerable | serves |
|---|---|---|
| `assetlib` | yes | Godot addons on godotengine.org's Asset Library |
| `npm` | yes | packages on registry.npmjs.org naming both Godot and MCP |
| `mcp-registry` | yes | servers in the official MCP Registry that name Godot |
| `commercial` | **no** | closed-source and hosted products sold from their own sites |

🔴 **`enumerable: false` IS AN ANSWER, NOT AN OMISSION.** A closed-source product with no
package and no registry entry is reachable only by somebody naming it, so that channel is a
declared **watch list** and its rows carry `source_verifiable: false` with every capability
field `null` rather than `false` — a ruling nobody can take is not a ruling of *no*. Writing
that down is the difference between a leg that is absent by design and a leg that is broken,
and it stops every later sweep re-litigating which one it is.

🔴 **AND A CHANNEL THAT COULD NOT BE READ IS NEVER *NOTHING NEW*.** Before 291 a failed
query printed a line to stderr and the loop continued, so a run against a host that refused
every request produced an empty new-entry list and exited 0 — indistinguishable from a run
that read everything and found nothing. `channel_state` now answers `read`, `partial` or
`unread`, and `--check` refuses on the last two **by name**. This is 271 §1 applied to a
channel instead of to a reading: *a reader's silence is not an answer.*

🔵 **A PROJECT SURFACED BY THREE CHANNELS IS ONE ROW.** The join key is the GitHub
`owner/name` slug, normalised from every spelling the registries serve and from the bare
form this roster has stored since 223. A package with no repository link is keyed by
`<channel>:<name>` instead, and the row says which — because two slugless packages with the
same bare name on two registries are two projects, not one.

🔵 **AND A REPUBLISHED PACKAGE IS KEPT AND MARKED, NEVER COUNTED AS ITS ORIGIN.**
`@iflow-mcp/`, `@mseep/` and `@fastmcp-me/` re-publish other people's servers under their
own scope; thirteen of the sixty-eight relevant npm packages at 291 were copies. Counted as
projects they double-count the category; dropped outright they lose the three upstreams that
appear on npm only through a mirror. So they are folded onto the upstream repository when
they declare one and marked `via: republisher` when they do not.

### The Asset Library leg, as this rule was originally written

`scripts/assetlib_sweep.py` queries the live Asset Library API and reports, on every run:

- tracked entries that **moved** since their last source-level pass,
- entries in the Asset Library matching an AI/MCP signal that are **not in the roster at
  all** — the leg that catches what manual monitoring misses,
- and **the number of discovery hits its relevance filter dropped**, so the excluded scope
  is something a reader can argue with rather than something nobody can see.

🔴 **AND EVERY NEVER-TRACKED ENTRY OWES A ROSTER ROW, INCLUDING THE ONES THAT ARE NOT
MCP SERVERS.** Until 279 the sweep printed *record on the roster* beside each new
in-editor AI addon and refused only on MCP-shaped ones, so fourteen accumulated that
nothing would ever go red about — while the roster's own first line already said it holds
*every product that has appeared in any prior sweep* and that *an entry is never dropped*.
The check now reads that population. Recording an in-editor AI addon costs one row and no
source-level pass, which is the cheap thing the roster already promises rather than the
expensive thing only an MCP-shaped entry owes.

The population is defined by the **live query**, minus what the roster already tracks.
Adding a product to the roster shrinks the new-entries list automatically; it can never
grow the population. This is deliberately the same shape as `contract_check.py`'s check 25:
a gate that reads a roster is a gate over a population somebody chose.

Run it at every sweep, and independently at least monthly.

**Why.** The first run of this script found **three Asset Library MCP entries that no prior
sweep had ever tracked**, one of which ships its own DAP and LSP clients. Seven months of
attentive manual monitoring missed them.

## Rule 5 — A roster row is a row; an analysis is elected

🔴 **THE ROSTER HAS TWO POPULATIONS AND THEY COST DIFFERENT THINGS.**

- **`entries`** — products **read at source**, each carrying a ruling: `debugger`,
  `real_dap_client`, `real_lsp_client`, `csharp`, `protocol_revision`, and a note giving the
  evidence. The cost of a row here is a source-level pass, so a row is **elected** and never
  automatic.
- **`surfaced`** — products a **discovery leg has seen**, carried permanently, holding only
  what the leg itself supplies: channel, repository slug, package, version, publish date and
  the session that first saw them. **No capability claim, because nobody has read them.**
  The cost of a row here is one row, so **everything any leg surfaces owes one**, and
  `assetlib_sweep.py --check` refuses by name when one is missing.

**Why the split, and why it is not a loophole.** Until 291 the sweep had a single severity:
a never-tracked MCP-shaped entry owed a source-level pass. That was affordable while the
population was one channel serving roughly ten new entries a year. The first run across
three channels surfaced fifty. A rule demanding fifty source-level passes in one commit does
not produce fifty analyses — it produces a gate that is red forever and a roster nobody can
make green, which is governance wearing churn. And the alternative, fifty `entries` rows
with the capability fields blank, is worse: **that is a coverage claim nobody made**, which
is the defect class this repository builds instruments to refuse.

🔴 **PROMOTION, NOT DUPLICATION.** When a project is read at source it moves from `surfaced`
to `entries` in the same commit that adds the analysis. `roster_shape_problems` refuses a
key that appears in both, because a roster reporting one project as *analysed* and *never
analysed* at once would keep passing the discovery check on the strength of the weaker row.

🔵 **`channel` IS OPTIONAL AND ITS ABSENCE IS PRINTED.** Forty-six entries predate the
channel legs and nobody has recorded where any of them ships. `assetlib_sweep.py --census`
counts them as `unclassified` rather than defaulting them into the leg that probably found
them — a visible number that falls as sessions classify rows, rather than a silent
assumption that this rule's own defect never happened.

## Rule 4 — Write about our capability, not about anyone's deficiency

Every sweep and every piece of public material follows this:

- **Maximise accurate positive statements about what Breakpoint does.** Concrete and
  verifiable beats superlative: *"step into, step out, scopes, watch expressions, variable
  writes, exception breakpoints, and conditional/hit-count/logpoint negotiation — for
  GDScript and C#"* is stronger than *"the best debugger"*, and it survives contact with
  someone checking.
- **Minimise negative statements about the alternatives.** State what a project does; note
  what it does not do only where a user choosing between them would actually need to know,
  and state it as a factual absence, without adjectives.
- **Credit good work explicitly.** Several of these projects are better than us at things
  we care about — onboarding friction, context cost, CI breadth, spec currency. Saying so
  is how the analysis stays useful to us.
- **Prefer "only" claims that are about depth, not existence.** Existence claims decay: the
  moment someone ships the feature, the claim is false and any material carrying it is
  wrong. Depth-and-coverage claims are durable and are the ones actually true.
- **No claim about the category may be asserted from a sample.** "Exhaustive grep across
  all four repositories" is a measurement of four repositories on one day. Write it that
  way.

**Why.** A recommendation is a claim with a delay fuse. The 2026-08-05 sweep recommended
the public line *"the only Godot MCP server with a debugger at all"*; it was false within
48 hours. It was never shipped, but only because nobody had copied it out yet.

---

## What a sweep produces

A dated `COMPETITIVE_ANALYSIS_<date>_ALTERNATIVES.md` in the shared folder containing:

1. Our own baseline, **measured that session**, never carried from a handoff.
2. The **full roster table** — every entry, with `no change` or `moved` and the evidence.
3. Source-level sections for the entries that moved, and for anything new.
4. The Asset Library sweep output, including the dropped-as-irrelevant count.
5. Capability findings stated per Rule 4.
6. A verification note: what was cloned, at which SHA, what could not be determined.
7. Roster updates written back to `docs/alternative_mcp_roster.json` in the same session.

Point 7 is not optional. A sweep that does not update the roster makes the next sweep
re-derive everything it just learned.
