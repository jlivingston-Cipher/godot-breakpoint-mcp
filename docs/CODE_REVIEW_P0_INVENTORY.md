# P0 · Measurement — the inventory the other six passes consume

> **Charter:** `CODE_REVIEW_CHARTER_2026-08-05.md`, pass P0. Opened session **205**,
> paid session **241** — **36 sessions open**, the oldest row in `QUEUE.md` and the one
> `QUEUE_AGE_CEILING` was pointed at.
>
> 🔴 **NOTHING IS FIXED IN THIS PASS.** P0 builds the population; P1–P6 spend it. Every
> count below is reproducible by ONE command, and the command is printed beside it. Where
> a reader disagreed with another reader, **the disagreement is reported rather than
> resolved** — the charter's own instruction, and in §1 it turned out to be the finding.

Measured against `2ae5f3b` (host **1.74.0**, addon **1.9.9**), in the cloud container, on
the tracked tree. **68 source files · 20,940 lines · 1,095 functions · 289 registered
tools · 722 tests.**

| # | count | headline |
|---|---|---|
| 1 | dead code | **2 readers, intersection ZERO** — and 4 of one reader's 5 are false |
| 2 | comments | 10,914 lines; **1,339 describe other code, 86% of them in `scripts/`** |
| 3 | duplication | 5.01% @50 tokens, 1.69% @150 — and **all 12 big clones are one thing** |
| 4 | style | 🔴 **there is no lint or format config for TypeScript at all** |
| 5 | coverage | **lines 96.86% · branches 76.09%** — never measured before today |
| 6 | test duplication | 722 tests → 467 keys, 114 clusters, **369 tests inside one** |
| 7 | complexity | max cyclomatic 41, max cognitive 76, **max nesting 8** |

---

## §1 — Dead code, two independent readers, and **the gap is the finding**

```bash
npx ts-prune -p tsconfig.json | grep -v 'used in module'          # reader A
npx tsc --noEmit --noUnusedLocals --noUnusedParameters            # reader B
```

| | reader A (`ts-prune`) | reader B (`tsc`) |
|---|---|---|
| candidates | **5** | **2** |
| also: export used only inside its own module | 108 | — |

**INTERSECTION: 0. UNION: 7.** The two readers do not overlap by a single symbol, because
they are not asking the same question — A asks *is this export imported anywhere*, B asks
*is this local ever read*. The charter asked for both numbers separately and this is why.

🔴 **AND FOUR OF READER A's FIVE ARE FALSE, FOR A REASON THAT IS A QUEUE ROW IN ITS OWN
RIGHT.** Cross-checked by grep across `src/`, `test/` and `scripts/`:

| symbol | ts-prune | actual references | where |
|---|---|---|---|
| `enumeratePathCohort` | unreferenced | **16** | `test/path_cohort.test.ts` |
| `RECIPE_NAMES` | unreferenced | **12** | `test/recipes.test.ts` |
| `ANNOTATED_TOOLS` | unreferenced | **9** | `test/tools-export.test.ts`, `test/timeout-caveat.test.ts` |
| `summarisePathCohort` | unreferenced | **3** | `test/path_cohort.test.ts`, **`scripts/instrument_gate.py`** |
| `PathRefusal` | unreferenced | **0** | — |

`tsconfig.json` carries `"include": ["src/**/*.ts"]`. **The test suite and the Python gates
are outside the world ts-prune is judging**, so every export whose only consumer is a test
reads as dead. This is `lint-roster-py-only` (230) and `cause-rule-py-only` (229) arriving
a third time on a different instrument: **a reader scoped to a subdirectory, reporting a
verdict about a tree.** A P1 that had trusted this list would have deleted four live
symbols, one of them read by an instrument.

**TRUE DEAD AFTER CROSS-CHECK: 3** — `PathRefusal` (`src/paths.ts:46`) and the two unused
`toFsPath` imports (`src/tools/csdap.ts:6`, `src/tools/dap.ts:5`). **That is P1's whole
scope, and it is three lines.**

---

## §2 — Comment inventory

```bash
python3 scripts/p0_comments.py       # 5 buckets, host/src + scripts/
```

| bucket | total | `host/src` | `scripts/` |
|---|---|---|---|
| describes-this-code | 9,383 | 3,393 | 5,990 |
| 🔴 **describes-other-code** | **1,339** | **183** | **1,156** |
| TODO-FIXME | **1** | 0 | 1 |
| commented-out-code | 7 | 2 | 5 |
| section-marker | 184 | 86 | 98 |

**§8.4 — *"a mechanism in a comment that nothing compares"* — finally has a population, and
it is 1,339 lines.** A comment lands in that bucket when its text names something living
somewhere else: a path with a source suffix, or a session citation (`193 §12.27`, `§9.4`).
Those are exactly the comments whose truth is a claim about a part of the tree the comment
does not sit in, and therefore the only ones nothing can check.

🔴 **86% OF THEM ARE IN THE INSTRUMENTS, NOT THE PRODUCT.** The top four files are
`instrument_gate.py` (284), `floor_pin_gate.py` (209), `contract_check.py` (160) and
`handoff_gate.py` (99). The gates carry six times the cross-referencing prose that the
20,940 lines of shipped TypeScript do. That is 240's carried finding measured from a new
angle: **the explanatory mass of this repository is attached to the instruments.**

**ONE `TODO`/`FIXME`/`XXX`/`HACK` LINE IN THE ENTIRE TREE, AND IT IS THIS CLASSIFIER'S OWN
COMMENT EXPLAINING THE PATTERN IT MATCHES ON.** `scripts/p0_comments.py:34`. The shipped
product and every other instrument carry **zero**, which is not a null result — it is the
strongest single piece of evidence here that this tree's hygiene rules are enforced rather
than aspirational.

> 🔴 **THE ONE IS LEFT IN THE COUNT ON PURPOSE, AND THIS IS THE SECOND TIME THIS FILE
> ENTERED ITS OWN POPULATION.** The first draft's `\b(TODO|FIXME|XXX|HACK)\b` matched the
> docstring line *naming the bucket*, so the tree-wide count went 0 → 1 the moment the
> reporter joined `scripts/`. Tightening to the conventional annotation form (`TODO:`,
> `FIXME(`) fixed that — and then matched the comment explaining the tightening. **A
> self-inclusive scanner cannot carry a correct example of its own pattern and report
> zero.** The available moves were to exclude the reporter from its own walk, or to print
> the one and say what it is. Self-exclusion is how `SCANNED` rots (224 §7.6) and how
> ts-prune produced §1's four false positives — a reader whose scope is quietly not the
> tree. **So the count is 1 and the line is named.**

> 🔴 **The first draft of the classifier reported 49 commented-out-code lines. Seven are
> real.** It keyed on a trailing `;` — the most common mid-sentence mark in this tree's
> prose — so *"Screenshot tools that return an in-memory buffer count as read-only;"* was
> filed as code. Requiring a statement keyword **and** low English-function-word density
> took 49 → 7. The 42 were entirely the instrument. Recorded because a P0 count nobody
> re-derives is exactly the failure mode the charter exists to catch.

---

## §3 — Duplication, and **all of it is one thing**

```bash
npx jscpd src  --min-tokens 50    # and 150; then test/ separately
```

| population | threshold | clones | duplicated lines | % |
|---|---|---|---|---|
| `host/src` | 50 tokens | 70 | 869 / 17,350 | **5.01%** |
| `host/src` | 150 tokens | 12 | 293 / 17,350 | **1.69%** |
| `host/test` | 50 tokens | 83 | 686 / 12,550 | **5.47%** |

🔴 **EVERY ONE OF THE TWELVE 150-TOKEN CLONES IS THE C# PLANE AGAINST THE GDSCRIPT PLANE.**

```
 63 lines  cslsp.ts:66   <-> lsp.ts:83          41 lines  csdap.ts:118 <-> dap.ts:204
 41 …      csdap.ts:118  <-> dap.ts:204         33 lines  csdap.ts:392 <-> dap.ts:508
 30 lines  csdap.ts:425  <-> dap.ts:542         24 lines  csdap.ts:89  <-> dap.ts:175
 22 lines  src/tools/cslsp.ts:264 <-> src/tools/lsp.ts:386        … 5 more, same two pairs
```

There is no scattered duplication in this tree. There is **one** duplication, it is the
C# mirror of the LSP and DAP planes, and it is 293 lines. **P4 is therefore a single
decision — factor the two planes onto a shared spine, or declare the mirror deliberate —
not a cleanup.** 224 §7.9's *"a deliberate, documented divergence from a sibling plane's
rule"* is the precedent for the second option, and it is a real one.

---

## §4 — Style deltas

```bash
ls host/.eslintrc* host/.prettierrc* host/biome.json 2>/dev/null   # -> nothing
python3 scripts/lint_ceiling.py                                    # scripts/*.py only
```

🔴 **THERE IS NO LINT OR FORMAT CONFIGURATION FOR TYPESCRIPT IN THIS REPOSITORY.** No
ESLint, no Prettier, no Biome, no `.editorconfig`. The count the charter asked for —
*"violations that are currently unenforced"* — is undefined, because there is no config to
be in violation of.

What exists instead: `tsconfig.json` with `"strict": true` (which is doing real work —
reader B found only 2 unused locals across 20,940 lines), and `lint_ceiling.py`, which
runs `pyflakes` over **`scripts/*.py` and nothing else.**

**So the 17 Python gate scripts are lint-governed and the 68 files of shipped product
TypeScript are not.** This is the same asymmetry as §2 and it is the fourth instrument in
this inventory to report it independently.

---

## §5 — Test coverage · **the number that had never been measured**

```bash
npx tsc -p tsconfig.test.json && npx c8 --src=src --include='dist-test/src/**/*.js' \
  node --test dist-test/test/*.test.js
```

```
TOTAL   lines 96.86%   branches 76.09%   functions 94.08%
        lines 19,935/20,581     branches 2,923/3,841     functions 493/524
```

🔴 **LINE COVERAGE IS THE COUNTER THAT LOOKS GREEN AND BRANCH COVERAGE IS THE ONE THAT
ISN'T — AND THE GAP IS NOT SPREAD EVENLY, IT IS A FAMILY.** Eight files under
`src/tools/editor/` sit at **100.0% lines with 33–75% branches**:

| file | tools | uncov. branches | branch % | **line %** |
|---|---|---|---|---|
| `src/tools/editor/physics.ts` | 12 | 36 | **33.3%** | **100.0%** |
| `src/tools/editor/particles.ts` | 6 | 13 | **38.1%** | **100.0%** |
| `src/tools/editor/spatial.ts` | 10 | 22 | **60.0%** | **100.0%** |
| `src/tools/editor/audio.ts` | 6 | 12 | 67.6% | 100.0% |
| `src/tools/editor/tiles.ts` | 9 | 16 | 70.9% | 100.0% |
| `src/tools/editor/ui.ts` | 11 | 12 | 75.0% | 100.0% |
| `src/tools/editor/project_input_test.ts` | 12 | 17 | 75.0% | 100.0% |

Every line runs; **only one side of each optional-parameter guard does.** A suite that
executes every statement and takes one branch in three is the exact shape a line
percentage cannot show, and a line percentage is the number this project would have
printed if it had ever printed one.

**Ranked by uncovered-branches-per-tool** — the charter's ordering, and P6's work queue:

| file | tools | uncov. branches | per tool |
|---|---|---|---|
| `src/tools/tabletop.ts` | 14 | 108 | **7.71** |
| `src/tools/knowledge.ts` | 4 | 27 | **6.75** |
| `src/tools/netcode.ts` | 7 | 42 | **6.00** |
| `src/tools/lsp.ts` | 20 | 102 | **5.10** |
| `src/tools/assetgen.ts` | 7 | 30 | 4.29 |
| `src/tools/vcs.ts` | 12 | 46 | 3.83 |
| `src/tools/cslsp.ts` | 10 | 37 | 3.70 |
| … | | | |
| `src/tools/editor/animation.ts` | 14 | **0** | **0.00** |

**`src/tools/lsp.ts` is the worst absolute branch coverage of any file with tools: 50.2%,
102 uncovered branches across 20 tools.** `src/tools/editor/animation.ts` is the only file in
the tree at 100/100 across 14 tools — the control that proves the target is reachable.

---

## §6 — Test duplication, clustered by what the tests assert

```bash
node host/scripts/p0_testdup.mjs      # subject | oracle | shape
```

**722 tests · 53 files · 467 distinct `(subject | oracle | shape)` keys · 114 clusters of
2+ · 369 tests inside a cluster · 353 singletons.**

| n | subject \| oracle \| shape | files |
|---|---|---|
| 12 | `tmpProject \| deepEqualx1 \| OK/ASYNC/PURE/SINGLE` | 2 |
| 10 | `startDap \| deepEqualx1 \| OK/ASYNC/PURE/SINGLE` | 2 |
| 10 | `makeHarness \| deepEqualx1 \| OK/ASYNC/PURE/SINGLE` | 2 |
| 9 | `makeHarness \| deepEqualx1,equalx1,notEqualx1 \| OK/ASYNC/PURE/MULTI` | 2 |

The top clusters are **table-shaped**: ten `cs_dbg_*` tests that each start a DAP session
and `deepEqual` one mapped shape; twelve `cs_*`/`gd_*` tests that each map an LSP enum to
readable names across `cslsp.test.ts` and `lsp.test.ts`. **The same C# / GDScript mirror
§3 found in the source is present in the suite**, and it is the single largest merge
candidate in both populations.

🔴 **A CLUSTER IS A CANDIDATE, NOT A VERDICT.** P5 has to open each one. Reporting these
377 as "duplicates" would be the mistake this inventory spends §1 and §2 warning about.

> 🔴 **THIS CLUSTERER GOT ITS OWN SUBJECT WRONG TWICE, AND THE SECOND TIME A SELF-TEST
> CAUGHT IT RATHER THAN A READER.** Draft one's largest cluster was **44 tests under the
> subject `async`** — the regex matched the `async (` of every arrow callback, so the top
> row of a duplication report was a language keyword shared by a third of the suite. A
> noise set fixed that and moved keys 331 → 457. Draft two still read
> `assert.equal(toFsPath(x), y)` as subject **`equal`**: dropping the bare identifier
> `assert` left `\b(\w+)\s*\(` free to match the METHOD NAME after the dot, so the
> subject of a test was routinely its own assertion method. Requiring the identifier not
> to follow a `.` moved keys 457 → **467**.
>
> **Both drafts measured syntax and called it semantics, and the published numbers in the
> first version of this section were wrong because of the second one.** The claims are now
> pinned in `host/scripts/p0_testdup.selftest.mjs`, including a negative control that goes
> red if a keyword ever becomes a subject again — **240's closing finding, paid rather than
> repeated: the sentence describing the hole and the code closing it are not the same
> artifact.** Ninth session running that a fixture is faster than the author.

---

## §7 — Complexity

```bash
node host/scripts/p0_complexity.mjs      # TypeScript compiler API, real function boundaries
```

**1,095 functions across 68 files.**

| metric | max | p95 | median | mean |
|---|---|---|---|---|
| cyclomatic | **41** | 10 | 2 | 3.2 |
| cognitive | **76** | 10 | 1 | 2.7 |
| max nesting | **8** | 2 | 0 | 0.7 |
| function length | **813** | 56 | 6 | 18.2 |

Over threshold: **46** functions with cyclomatic > 10 · **26** with cognitive > 15 ·
**16** nested ≥ 4 deep · **29** longer than 100 lines · **10** files over 500 lines.

**Top by cognitive complexity — P3's list:**

| cognitive | cyclo | nesting | lines | function |
|---|---|---|---|---|
| **76** | 20 | **8** | 32 | `src/tools/vcs.ts:137` `parseStatusV2` |
| 71 | 37 | 4 | 153 | `src/cli/init.ts:176` `runInit` |
| 70 | 40 | 4 | 112 | `src/tools/tabletop.ts:437` `emitCardTemplate` |
| 49 | 41 | 2 | 128 | `src/tools/assetgen.ts:202` `generate` |
| 43 | 18 | 6 | 31 | `src/tools/tabletop.ts:185` `parseCsv` |
| 40 | 27 | 3 | 48 | `src/tools/tabletop.ts:251` `computeLayout` |
| 33 | 12 | 6 | 33 | `src/tools/knowledge.ts:70` `collectFiles` |

🔴 **`parseStatusV2` IS THE OUTLIER AND IT IS NOT THE LONGEST — IT IS 32 LINES.** Cognitive
76 at nesting depth **8**, in 32 lines, parsing `git status --porcelain=v2`. Every other
member of the top four is 112–153 lines. **Density, not size, and a percentile would have
hidden it**: it is inside `src/tools/vcs.ts`, which sits at 97.0% line coverage.

The longest functions are **not** the complex ones — `registerRuntimeTools` is 813 lines at
cyclomatic **2**, `registerDapTools` 669 at cyclomatic **1**. They are flat registration
blocks. **Ranking by length alone would have put nine near-branchless functions at the top
of P3's list and left the real one at rank 40.** Both columns, separately, is why.

---

## What P1–P6 inherit

| pass | scope, from the counts above | size |
|---|---|---|
| **P1** dead code | **3 symbols** — `PathRefusal`, two `toFsPath` imports | trivial |
| **P2** comments | 1,339 describes-other-code lines, 86% in `scripts/` | large |
| **P3** complexity | 46 over cyclomatic 10; `parseStatusV2` first | medium |
| **P4** duplication | **one decision**: the C#/GDScript mirror, 293 lines | medium |
| **P5** test duplication | 112 clusters, C#/GDScript mirror the largest | medium |
| **P6** coverage | 918 uncovered branches; `src/tools/lsp.ts` and the editor family | large |

> 🔴 **AND A FOURTH INSTRUMENT REFUSED THIS DOCUMENT ITSELF, IN CI, AFTER EVERY GATE IN
> THE LOCAL REPLAY HAD PASSED IT.** `spec_conformance.py --check` reads every shipped
> `.md` for tokens shaped like an MCP method and found **twenty**: the coverage tables
> above cited their files by bare directory — the namespace, a slash, then a word, which
> is exactly the shape of `tools/list` and `tools/call`. Its refusal names the only fix —
> *"Rewrite the prose — do not add an exemption"* — and the scanner's own left guard is
> what the rewrite uses: a namespace behind a slash is a path, so every citation here now
> carries its real `src/` prefix.
>
> 🔴 **AND THE FIRST DRAFT OF THIS VERY PARAGRAPH WAS REFUSED BY THE SAME SCANNER**, for
> quoting the two offending citations while explaining them — the third time in this
> document that a description of a pattern landed inside the pattern's own population
> (§2's `TODO` bucket twice, and here). **A scanner that reads shipped prose cannot be
> written about in shipped prose without being written about carefully.**
>
> **It is worth recording where that was caught.** The session replay in 240 §7.1 lists
> twenty-one commands and `spec_conformance.py` is not one of them, so this document
> passed the full local ritual and was refused by a step that only CI runs. **A replay
> list is a roster like any other, and this is the one nothing in the tree compares
> against `ci.yml`.**

🔴 **AND THE THING THIS INVENTORY FOUND THAT THE CHARTER DID NOT ASK FOR.** Three of the
seven readers — ts-prune's `include`, `lint_ceiling.py`'s `scripts/*.py`, and the absent
TypeScript lint config — report on a scope narrower than the tree they are read as
judging, **and in every case the narrow side is the instruments and the wide side is the
product.** §1 is the sharpest: a P1 that trusted reader A would have deleted four live
symbols. That is the same finding as 240's closing paragraph, arrived at from inside a
code review rather than from a download count.
