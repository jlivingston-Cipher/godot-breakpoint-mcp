# P1–P6 · Spending the inventory — what reading the tree actually found

> **Charter:** `CODE_REVIEW_CHARTER_2026-08-05.md`, passes P1 through P6. Opened session
> **241** as one queue row, paid session **314** — **seventy-three sessions open**, the
> oldest row in `QUEUE.md` and the subject of ten consecutive handoff paragraphs that
> each argued for it and none of which started it.
>
> 🔴 **THINGS ARE FIXED IN THIS PASS, WHICH IS THE DIFFERENCE FROM P0.** P0 built the
> population and fixed nothing on purpose. Every count below is re-measured live at
> `3baafa2`, because the first thing this pass found is that P0's counts had all moved.

Measured against `3baafa2` (host **1.85.0**, addon **1.16.0**), in the cloud container, on
the tracked tree. **81 source files · 25,200 statements · 1,238 functions · 292 registered
tools · 960 tests.**

---

## §0 — 🔴 THE FIRST FINDING IS THAT THE INVENTORY HAD GONE STALE, AND NOTHING NOTICED

P0 measured at `2ae5f3b` (host 1.74.0) and wrote a scope for each of the six passes. Every
one of those scopes is now wrong, and two of them are wrong in a direction that would have
mis-planned the work:

| pass | P0's scope (session 241) | live at 314 | direction |
|---|---|---|---|
| P1 dead code | 3 symbols, "trivial" | **5**, and 2 of them are not deletions | grew, and changed kind |
| P2 comments | 1,339 describes-other-code | **2,457** | grew with the tree |
| P3 complexity | 46 over cyclomatic 10; `parseStatusV2` first by density | 1,238 functions; `runInit` first by cyclomatic, `parseStatusV2` still first by cognitive | reordered |
| P4 duplication | 12 clones @150 tokens, 293 lines | **11 clones, 352 lines** — still all one thing | grew, verdict unchanged |
| P5 test duplication | 114 clusters, 722 tests | **130 clusters, 960 tests** | grew with the suite |
| P6 coverage | 918 uncovered branches, 76.09% | **960 uncovered branches, 78.78%** | 🔴 **both directions at once** |

🔴 **P6 IS THE ONE WORTH STOPPING ON.** Branch coverage improved by 2.7 points while the
number of uncovered branches grew by 42. A pass scoped by the absolute count was scoped
against a number that no longer exists; a pass scoped by the ratio would have reported the
tree getting better. **The same population, two honest readings, opposite verdicts** —
which is 240's lesson about counters nobody re-derives, arriving from inside the review
that was supposed to consume them.

🔵 **AND THE STRUCTURAL LESSON IS ABOUT ROWS, NOT ABOUT NUMBERS.** A queue row that carries
six passes cannot be picked up, because no session can hold six passes, and a row nobody
can pick up ages instead of being worked. Seventy-three sessions and ten handoff paragraphs
are the measurement of that, not of anybody's diligence.

---

## §1 — P1 · Dead code — **and three of the five findings are not deletions**

```bash
npx ts-prune -p tsconfig.json | grep -v 'used in module'          # reader A
npx tsc --noEmit --noUnusedLocals --noUnusedParameters            # reader B
```

| | reader A (`ts-prune`) | reader B (`tsc`) |
|---|---|---|
| candidates at 241 | 5 | 2 |
| candidates at 314 | **7** | **3** |
| intersection | **0**, for the second time | |

Cross-checked by whole-word search across `host/src`, `host/test`, `host/test-integration`,
`host/scripts`, `scripts/` and `addons/`:

| symbol | reader | references | verdict at 314 |
|---|---|---|---|
| `installedAddonVersion` | A | 3 | live (tests) |
| `ANNOTATED_TOOLS` | A | 15 | live (tests) |
| `enumeratePathCohort` | A | 21 | live (tests) |
| `summarisePathCohort` | A | 7 | live (tests **and an instrument**) |
| `RECIPE_NAMES` | A | 13 | live (tests) |
| `gateTargets` | A | **0** | 🔴 **an export written FOR a test that no test called** |
| `PathRefusal` | A | **0** | 🔴 **a declared shape no expression ever had** |
| `sleep` (`src/peers.ts`) | B | 0 | dead constant, deleted |
| `toFsPath` (`src/tools/csdap.ts`) | B | 0 | dead import, deleted |
| `toFsPath` (`src/tools/dap.ts`) | B | 0 | dead import, deleted |

🔴 **READER A IS NOW WRONG ABOUT EVERY SINGLE CANDIDATE IT REPORTS.** Six survive after the
two real ones were bound, and all six are referenced from files outside
`tsconfig.json`'s `"include": ["src/**/*.ts"]`. That is P0 §1's finding — *a reader scoped
to a subdirectory, reporting a verdict about a tree* — at a **100% false-positive rate**.
🔵 It is left in place and NOT gated on: a gate whose every finding is false is a gate that
trains its readers to ignore it. The row `dead-code-reader-scoped-to-src` records the shape
of the cure.

🟢 **AND READER B IS NOW PERMANENT, FOR THE PRICE OF TWO LINES.** `noUnusedLocals` and
`noUnusedParameters` are on in `tsconfig.json`, so `npm run build` and `npm test` both
refuse an unused local from here on. 🔴 **Turning them on found four MORE, in the test tree
`tsconfig.test.json` compiles and nothing had ever read**: two unused arrow parameters in
`test/dbg_scene_guard.test.ts` and two dead imports. All four fixed. 🔵 This is also the
only answer P0 §4 has ever had — *"there is no lint or format configuration for TypeScript
in this repository"* — and it is a partial one: two rules, not a config.

### 1.1 — 🔴 `gateTargets` was a second copy of the gating rule, not a spare

`src/mutation-guard.ts:185` carries a doc comment saying the function is *"exported so a
test can take the reading over the REAL registry rather than over a list somebody typed"*.
No test called it. The test that wanted it — *"EVERY destructive tool on the registered
surface accepts `confirm`"* — hand-rolled the same three-line filter inline, so **the rule
deciding which tools get gated shipped in two places and only one of them was the one the
product runs.** The test now calls the export. Nothing else changed; the deletion that
reader A implied would have removed the better of the two copies.

### 1.2 — 🔴 `PathRefusal` described five constructors and checked none

`src/paths.ts` declares the refusal shape (`refusal: true`, `code: string`) that three
readers test for (`src/tools/csdap.ts`, `src/tools/dap.ts`, `src/tools/lsp-common.ts`) and
that five sites construct by hand with `Object.assign`. No expression in the tree ever had
the type, so a constructor that dropped `code` would have compiled. `refuse()` now names it,
which costs nothing at runtime and makes the declaration a check. 🔵 The other four
constructors are named in §4 as evidence rather than fixed here — they are in the mirror.

---

## §2 — P2 · Comments — **ruled: not debt, and the two debt-shaped buckets have not moved**

```bash
python3 scripts/p0_comments.py            # 5 buckets, host/src + scripts/
```

| bucket | 241 | 314 | in `scripts/` |
|---|---|---|---|
| describes-this-code | 9,383 | 19,576 | 70% |
| describes-other-code | 1,339 | **2,457** | **86%** |
| TODO-FIXME | 1 | **1** | the classifier's own docstring |
| commented-out-code | 7 | **7** | — |
| section-marker | 184 | 248 | — |

🟢 **THE RULING IS NO ACTION, AND THE EVIDENCE FOR IT IS THE TWO ROWS THAT DID NOT GROW.**
The tree roughly doubled; `TODO-FIXME` stayed at one and `commented-out-code` stayed at
seven. Those are the two buckets that are debt in any codebase, and they are flat across
seventy-three sessions. What grew is `describes-other-code`, 86% of it in `scripts/` —
which is the apparatus describing the product, and is what a gate IS. **Pricing that as
debt would price this repository's whole method as debt.**

🔴 **NO CEILING IS ADDED AND THAT IS A DECISION, NOT AN OMISSION.** A ceiling on
`describes-other-code` would make every new gate that explains itself a violation. The
floor stays — `p0_comments.py --floor` keeps the reader from going blind — and the census
stays a census.

---

## §3 — P3 · Complexity — **the ranking earned its keep as a READING ORDER, and the reading found three defects**

```bash
node host/scripts/p0_complexity.mjs       # cyclomatic, cognitive, nesting, length
```

```
functions measured: 1238   files: 81   max cyclomatic 48   max cognitive 88   max nesting 8
  48  cog= 86  nest=4  len=198   src/cli/init.ts:247        runInit
  42  cog= 51  nest=2  len=130   src/tools/assetgen.ts:203  generate
  40  cog= 70  nest=4  len=125   src/tools/tabletop.ts:437  emitCardTemplate
  26  cog= 88  nest=8  len= 57   src/tools/vcs.ts:232       parseStatusV2   <- P0's pick
```

🟢 **P0 POINTED AT `parseStatusV2` FOR DENSITY RATHER THAN SIZE, AND READING IT IS WHERE
THIS SESSION'S USER-FACING DEFECTS CAME FROM.** Three of them, all in §3.1. The function is
26th by cyclomatic complexity and 1st by cognitive complexity; a list ranked by either
length or cyclomatic alone would have sent the reader somewhere else.

🔴 **AND THE RULING IS THAT NOTHING IS REFACTORED FOR THE NUMBER.** Lowering
`parseStatusV2`'s nesting would not have found the quoting family, and rewriting a
security-relevant parser to satisfy a metric is the change most likely to introduce the
next one. **The complexity table is a reading order. It is not a defect list, and treating
it as one is how a pass produces churn instead of findings.**

### 3.1 — 🔴 THE DEFECT FAMILY: WHAT GIT DOES TO A PATH IT CANNOT PRINT PLAINLY

`git status --porcelain=v2` C-quotes any path holding a byte it considers unusual, which
by default is **every non-ASCII byte**. Measured on the shipped 1.85.0 against a real
repository whose Godot project holds `escena_ñ.tscn`, with `docs/café.md` outside it:

```
staged: [ { path: "\"../docs/caf\\303\\251.md\"" }, { path: "\"escena_\\303\\261.tscn\"" } ]
outside_project: []
```

Three consequences, each user-reachable, and none of them visible to 700 lines of passing
tests because every fixture in the tree was named in ASCII:

1. 🔴 **`vcs_status` returns a spelling no other tool in the family accepts** — quotes and
   octal escapes — for any project with an accented or CJK filename.
2. 🔴 **`outside_project` came back EMPTY while a path above the project sat in `staged`.**
   The escape test reads a leading `../` and the quote is in front of it. That is 295's
   finding — *"never leave a `../` member in a list of project paths"*, written in a comment
   four lines above the test that fails to do it — reopened on a spelling axis 295 did not
   have.
3. 🔴 **`vcs_restore`, a DESTRUCTIVE tool, reported work as not-restored after restoring
   it.** `requested` carries the caller's spelling and `restored` carried git's, so a caller
   asking *was the path I named restored?* read its own discarded work as nothing having
   happened. 295's own summary sentence, on the other axis, one release later.

🟢 **THE CURE IS TWO HALVES AND EACH HAS A CLAIM THAT FAILS WITHOUT IT.**
`-c core.quotePath=false` goes on the invocation in `git()`, because quoting is a property
of how git was asked and a future call site cannot forget it; `unquotePath()` decodes the
residue git quotes whatever that setting says (a double quote, a backslash, a control
character). Six claims, driven both ways: removing the setting fails the patch-text claim
alone, and stubbing the decoder to the identity fails the two parser claims.

🔴 **AND `-z` IS NOT THE CURE, WHICH IS THE FINDING INSIDE THE FIX.** It removes quoting
outright — and it also makes git print paths relative to the repository root and ignore
`status.relativePaths` while doing it, measured on git 2.43. It would have taken
`outside_project` apart in silence, because the `../` spelling the escape is detected BY
would stop existing. **The framing option that fixes the encoding changes the meaning of
the field.** The obvious parser-shaped answer was the wrong one and only a measurement said
so.

---

## §4 — P4 · Duplication — **the mirror is deliberate; the DRIFT inside it was the defect**

```bash
npx jscpd host/src --min-tokens 150
```

**11 clones · 352 duplicated lines · 1.38%** — and, exactly as at 241, **every one of them
is the C# plane against the GDScript plane**: `src/cslsp.ts` against `src/lsp.ts`,
`src/csdap.ts` against `src/dap.ts`, and the same two pairs again under `src/tools/`.

P0 left this as one decision: *factor the two planes onto a shared spine, or declare the
mirror deliberate.* 🔵 **THE DECISION WAS SETTLED BY MEASURING THE DRIFT RATHER THAN BY
PREFERENCE.** Every clone pair was normalised for the plane's own vocabulary (`Cs` prefixes,
`C#` for `GDScript`, `cslsp` for `lsp`) and diffed:

```
TOTAL identical after normalising 301 lines · differing 45
```

The 45 sort into three classes:

| class | count | example |
|---|---|---|
| real plane differences | ~30 | the GDScript restart returns a `scene`; the C# one cannot have one |
| naming drift, same concept | ~14 | `this.channel` on the C# planes, `this.conn` on the GDScript planes |
| 🔴 **a hardening one plane has and the other does not** | **1** | `normalizeWorkspaceEdit` |

🟢 **RULING: THE MIRROR IS DELIBERATE AND STAYS.** 301 of 346 mirrored lines are identical
and the differences that matter are differences between the two debuggers, not between two
copies of one idea. 224 §7.9's precedent — *a deliberate, documented divergence from a
sibling plane's rule* — is the right one, and a shared spine would need a per-plane hook at
nearly every point of difference in the two files with the worst branch coverage in the
tree (§6).

### 4.1 — 🔴 AND THE ONE DIFFERENCE THAT WAS NOT A DIFFERENCE WAS A FAIL-OPEN

`cs_rename` reads its result with `normalizeWorkspaceEdit`, which accepts a `WorkspaceEdit`
in either encoding — the legacy `changes` map or versioned `documentChanges` — and the
comment beside the call says so. `gd_rename` read `edit.changes` alone. A server answering
in the other encoding gave:

```
changed_files: []   edit_count: 0   applied: true   written: []
```

**A destructive tool reporting success for a rename it did not perform.** Fixed: the
GDScript plane calls the same helper. 🔵 **THE SEVERITY IS STATED HONESTLY** — this client
advertises no `workspace.workspaceEdit.documentChanges` capability, so a conforming server
should send `changes`, and no live failure is claimed. The defect is that the hardening
existed on one plane only, and on the plane that is **not** the primary one for a Godot
tool.

---

## §5 — P5 · Test duplication — **ruled: the mirror should be MORE complete, not less**

```bash
node host/scripts/p0_testdup.mjs          # subject | oracle | shape
```

**960 tests · 71 files · 682 distinct keys · 130 clusters · 408 tests inside them · 552
singletons.** The largest cluster is 12 tests across 2 files, and it is
`test/cslsp.test.ts` against `test/lsp.test.ts` — the plane mirror again, one layer up.

🟢 **THE RULING FOLLOWS §4 AND IT REVERSES THE PASS'S OWN PREMISE.** A mirrored
implementation wants a mirrored test suite, and this session proved why in the sharpest
possible form: **the one place the two test suites did NOT mirror each other was the one
place the two implementations had drifted.** `test/cslsp.test.ts:329` — *"cs_rename handles
OmniSharp's documentChanges WorkspaceEdit encoding (not just changes)"* — has existed all
along. `test/lsp.test.ts` had no such test, and `src/tools/lsp.ts` had no such handling. The
gap in the mirror and the gap in the product were the same gap.

🔴 **SO THE DEBT IS WHERE THE MIRROR IS INCOMPLETE, NOT WHERE IT IS COMPLETE**, and
deduplicating these clusters would delete the only instrument that can catch §4's failure
mode. 314 added one mirrored test rather than removing twelve.

---

## §6 — P6 · Coverage — **measured, ranked two ways, and the two rankings disagree**

```bash
npx tsc -p tsconfig.test.json && npx c8 --src=src --include='dist-test/src/**/*.js' \
  node --test dist-test/test/*.test.js
```

```
TOTAL   statements 97.46%   branches 78.78%   functions 95.57%
        branches 3,565/4,525 — 960 uncovered
```

| worst by ABSOLUTE uncovered branches | | worst by PERCENT (≥20 branches) | |
|---|---|---|---|
| `src/tools/tabletop.ts` | 103 (79.6%) | `src/tools/editor/physics.ts` | 34.5% (36) |
| `src/tools/lsp.ts` | 102 (51.0%) | `src/tools/editor/particles.ts` | 38.1% (13) |
| `src/tools/vcs.ts` | 50 (77.8%) | `src/tools/lsp.ts` | 51.0% (102) |
| `src/tools/netcode.ts` | 42 (67.4%) | `src/tools/lsp-common.ts` | 52.1% (23) |

🟢 **`src/tools/lsp.ts` IS THE ONLY FILE IN THE TOP FOUR OF BOTH RANKINGS, WHICH IS THE
ANSWER TO "WHERE DOES P6 START".** P0 named it and it is still there: 102 uncovered
branches at 51.0%, the worst large file in the tree. 🔵 It is also the file §4.1's defect
was in, which is not a coincidence — a fail-open that ships is a branch nobody executed.

🔴 **P6 IS NOT CLOSED BY THIS PASS AND IS NOT PRETENDED TO BE.** It is the one pass whose
work is proportional to the population rather than to a decision, and 960 branches is not a
session. It leaves as its own row with a live number, which is the thing 241's version of
it never had.

---

## §7 — What P1–P6 leaves behind

| pass | verdict at 314 |
|---|---|
| **P1** dead code | 🟢 **PAID.** 5 findings: 3 deleted, 2 bound. Reader B made permanent in `tsconfig.json`; 4 further findings in the test tree fixed. Reader A left un-gated, with its reason |
| **P2** comments | 🟢 **RULED, NO ACTION.** The two debt-shaped buckets are flat across 73 sessions; the one that grew is the apparatus explaining itself |
| **P3** complexity | 🟢 **RULED AND SPENT.** No refactor for the number; the ranking was used as a reading order and the reading found §3.1 |
| **P4** duplication | 🟢 **DECIDED.** The mirror is deliberate — 301 of 346 lines identical after normalising — and the one non-difference was a fail-open, now fixed |
| **P5** test duplication | 🟢 **RULED, REVERSED.** Do not deduplicate; the mirror is the instrument. One test added where the mirror had a hole |
| **P6** coverage | 🔴 **OPEN, AND SIZED.** 960 uncovered branches, 78.78%. `src/tools/lsp.ts` first in both rankings. Its own row |

🔵 **AND THE ONE RULE WORTH CARRYING OUT OF THIS DOCUMENT.** Five of the six passes ended in
a ruling rather than in work, and the two that produced defects produced them by **reading
the code the measurements pointed at** — not by acting on the measurements. P0's counts
were a map. Every defect in this document was found by going where the map pointed and then
looking at something the map does not measure.
