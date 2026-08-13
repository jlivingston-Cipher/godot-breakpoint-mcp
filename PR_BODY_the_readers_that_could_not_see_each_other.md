# The readers that could not see each other

**Session 242.** Base `42f6ec0`. Four queue rows paid — `lint-roster-py-only` (230),
`cause-rule-py-only` (229), `open-npm-lag-unread` (241), `replay-vs-ci-unread` (241) —
all four the same defect: **a reader whose declared scope is narrower than its claim.**

Widening them found **three live defects**, two of them in work merged eight days ago,
and then found **three more in the readers that were doing the widening.**

---

## 🔴 The one that matters: two shipped files could not load on two thirds of our own CI matrix

`host/scripts/p0_complexity.mjs` and `host/scripts/p0_testdup.mjs` — both merged in #296 —
import `globSync` from `node:fs`. It was exposed in **Node 22.0.0**. `host/package.json`
declares `engines.node ">=18"` and `ci.yml` runs the matrix **18 · 20 · 22**.

An ESM named import of an export that does not exist fails at **link** time, so the modules
never loaded at all. Reproduced on v20.19.0:

```
SyntaxError: The requested module 'node:fs' does not provide an export named 'globSync'
```

**Nothing caught it because both files are in no workflow and in no replay list.** 26 CI
jobs and eleven bespoke instruments had nothing to say about them. `tsc --checkJs` reported
it as TS2305 the whole time, from the shelf, for free.

Fixed with a hand walk — `readdirSync(…, {recursive:true})` would not do either, since that
option landed in 18.17/20.1 and an older 18 ignores it silently, which is a wrong population
rather than an error. Both selftests are now steps in the `test` job, on every matrix leg.

Swapping the walk also exposed that the reporter's ranked tables had **no tie-break**, so
their membership depended on directory order: the TOP-40-by-length table gained
`src/cli/doctor.ts:171 whichSync` and lost `src/tools/netcode.ts:350`, both at length 12.
Now sorted by `file:line` after the score. Every count is unchanged (1,095 functions, 68
files, 722 tests, 467 keys).

---

## 🟢 `lint-roster-py-only` — three numbers, and the axis nobody declared

230 priced this row at "63 errors" and it sat for twelve sessions. Re-measured:

| population | strictness | findings | files |
|---|---|---:|---:|
| `host/scripts/*.mjs` | non-strict | **63** | 10 |
| `host/scripts/*.mjs` | strict | 718 | 20 |
| all 64 tracked `.mjs` | non-strict | **1,010** | 31 |
| all 64 tracked `.mjs` | strict | **2,568** | 61 |

The queue row predicted the population multiplier (16x) and not the strictness one (2.5x).
All four are honest; what was missing was the sentence saying which question was asked.

`scripts/lint_ceiling.py` now runs both halves — **one classifier, one `problems()`, two
rosters.** Non-strict by choice, with the reason written down: `strict` adds 1,558 findings
that are all `noImplicitAny` reporting a missing annotation, which is an annotation-density
measure and not a defect measure. The strict number is measured, printed, and deliberately
not rostered.

The import closure (`host/dist/*.js` — 863 findings under strict, 4 without) is **counted
and printed and never rostered**. A reader that silently dropped it would be reporting on a
scope it had not named, which is the defect this row is about.

**Second defect found by the first run:** `tautology_gate.selftest.mjs` passed a fixture
name to two helpers that took one parameter and dropped it — seven claims proved under
`fixture.ts` while their own prose is about the `.mjs` idiom. All seven still hold with the
name honoured, so this was never a wrong answer; it was a claim not proving what it said it
proved, in the self-test of the gate whose whole subject is claims that cannot fail.

**Third:** the gate refused its author's own roster on the first run. `classify()` stripped
`'…'` and not `"…"`, so a per-file roster leaked into a class name. Every message `pyflakes`
emits quotes its subject the Python way; half a rule looked like a whole one for twelve
sessions, and pointing it at a second language said so immediately.

---

## 🟢 `cause-rule-py-only` — 229 predicted the wrong far side

229 said the unread population was *"the one users actually read"* — the shipped product.
Measured by machine:

```
host/src/**/*.ts     68 files    0 shortfall-marked refusals
addons/**/*.gd        8 files    0
host/test/**/*.ts    53 files    4, none asserting a cause
host/**/*.mjs        64 files   63, and ONE asserting a cause
```

**The product has never carried a single instance of the shape.** Sixty-three of sixty-seven
live in `host/scripts/` — the JavaScript half of the instruments, the half `LEDGER_DIRS`
could not see. The rule was not narrow against the product; it was narrow against itself.

One rule, two readers: `CAUSE_CLAIM`, `ALTERNATION`, `MEASURED_CAUSE` and
`shortfall_problems` are untouched, and only the walk that finds refusal text widened.

The single offender is `boundary_gate.selftest.mjs:738` and it becomes a `MEASURED_CAUSE`
row rather than a refusal, because `ran` is incremented before the condition is evaluated
and failures are counted separately — so *"went missing rather than failing"* really is a
measurement. The negative control was run: drop the row and the rule flags it.

**The floor had to become two floors.** The `ast` half is 27 of 94 refusals, so it could
stop matching entirely and the literal half alone would clear any single threshold beneath
the live sum. A number beneath which one reader dies silently is a total, not a floor.

---

## 🟢 `open-npm-lag-unread` — and the reason it shipped green

`npm.lag` had an extract and no reader: no in-process derivation, no network branch. The
only thing that could satisfy it was a `--measured` log, and `--open` hardcodes an empty log
and returns before `--measured` is parsed. Unreachable at TIER0 by construction, printing a
reason that named a fix the mode cannot perform.

Fixed by importing `registry_lag.py`'s pure `lag()` and dialing only its two inputs —
**origin's tags, not the clone's.** `--open --network` now re-reads 6 of 6 header atoms.

**The finding is not the row.** Nothing had ever called `check_header` from a self-test:
every claim in this file asserts the header *parser* and none had ever driven the function
that does the *comparing*. Five new claims drive it offline, including both directions —
every REMOTE row must be unread without a socket, and a TREE row must not be, because a
reader returning UNREAD for everything would satisfy the first alone.

---

## 🟢 `replay-vs-ci-unread` — fourteen merge-blocking commands the ritual never ran

241 passed its whole local ritual, pushed, and was refused in CI by `spec_conformance.py`.
Measured across all three workflow files: **14 merge-blocking `ci.yml` commands absent from
the replay list, 0 replay commands absent from CI.** The drift is entirely one-directional —
the ritual is a subset and reads like a superset. All fourteen are in the list now and all
fourteen ran.

`integration.yml` is exempt **as a whole workflow**, once, with the reason — every job boots
a real Godot binary under Xvfb — and the cost of that exemption is named rather than implied
by absence.

The reader deleted one of its author's own exemptions on the first run: `stage-addon.mjs`
runs as `npm run stage-addon`, so no `run:` line carries the basename and the reader can
never report it. An exemption for something the reader cannot see is an exemption over
nothing, and that is true even when the prose is correct.

### And then it found three defects in the readers doing the widening

Adding those fourteen commands to the measured log **immediately broke two counter extracts
that had been unambiguous only because their siblings' output had never been in a log**:

* `release_names.rows` read `(\d+) rows · (\d+) REFUSE` — a shape `registry_bytes.py` and
  `registry_lag.py` also print. It read `10 rows · 8 REFUSE` off the wrong instrument and
  refused a block whose number was correct. Now anchored at line start and on
  `distinct code(s)`, because `contract_check.py` prints the tail too.
* `mutlock.guarded` read `floor=\d+ live=(\d+)` — which is also `lint_ceiling.py
  --selftest`'s spelling. It reported eighteen guarded gates against a block saying five.
  Now anchored on `GUARDED_FLOOR`.
* The replay reader's clobber rule used `>(?!>)`, which matches `>>` **at its second
  character** — so every appending replay was refused as a truncation. Nothing had noticed
  because no replay had ever used `>>`; the existing fixture proved the rule only on the
  spelling it got right. Both halves are pinned now. The same rule also counted a `#`
  comment inside the fence as a redirect, and refused this session's replay for quoting the
  command it was explaining.

---

## 🟡 `breakpoint-lite` — priced into the tree, not built

`docs/BREAKPOINT_LITE_PRICED.md`, tracked, as steered. 292 tools; **216 (74%) need a live
Godot editor**, and the fifteen `dbg_*` tools ride Godot's built-in Debug Adapter on 6006,
which exists only while the editor is open.

> **A zero-install Breakpoint cannot set a breakpoint.**

Three of the four readings of "Lite" cost under a session each and all three ship a Godot
debugger that cannot debug. The fourth — an Asset Library listing — is not a Lite variant at
all; it is a distribution channel for the product that already exists, and the only option
that reaches a user who is not already at a terminal. The document also finds an
undocumented first-run trap: `init` writes `[editor_plugins]` into `project.godot` and Godot
does not hot-reload it, so running `init` against an open editor silently leaves the plugin
disabled and no doc says to reopen.

---

## Verified

Full replay against the committed tree, opened at TIER0 in 0.8s:

```
724/724 · contract 23/23 · scope 25 · control 59 · instrument ok across 13
floor_pin 97 · 46 governed · 867 keys · 94 shortfalls · unswept 0 · exempt 38
taut 4089 · seal 103 · boundary 185 · term 285 file(s) / 21 suffixes
lint_ceiling 18 .py + 64 .mjs · 10 declared TS classes · closure 4, unrostered
handoff 231 claims · queue 36 rows at head 242 · 26 CI jobs
HANDOFF_GATE ok — 30 atoms, 29 readers, 29 compared, clean tree
```

🔴 **The finding to carry:** 241 closed with *"the narrow side is the instruments and the
wide side is the product."* Four readers were widened here and **not one turned out to be
narrow against the product.** The lint roster was narrow against the other half of the
instruments. The cause rule was narrow against the other half of the instruments — the
product carries zero instances of the shape it guards. The replay list was narrow against
CI. `--open` was narrow against itself. **The instruments are not under-pointed at the
product; they are under-pointed at each other** — and the defect that cost this session most
was in the newest instrument, in the population no roster names.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01YZcJCkwjTdwBYpPsQb8o95
