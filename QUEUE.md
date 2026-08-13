# Breakpoint MCP — the queue

> 🔴 **THIS FILE EXISTS BECAUSE THE QUEUE WAS THE ONE TABLE IN THIS REPOSITORY NOTHING
> READ.** Every counter a handoff prints is bound to the instrument that printed it and
> compared to the digit; `handoff_gate.py` refuses a status block over a single atom that
> does not bind. The section of the same document that says *what should happen next* was
> prose, in a file `.gitignore` keeps out of the tree, and no gate has ever opened it.
>
> The consequence is measurable and it was measured before this file was written. Across
> sessions 220–239 the Open section held **20–25 items and never drained**: generation and
> closure were equal, and what got closed was always the newest. Every session closed the
> two items the previous session had created and carried the rest. Measured ages at 239:
> the review charter's P0 had been open **34 sessions**, `D1b` 33, the
> `declared-outside-this-file` five 25, `prepack` 24. The typed ages disagreed with each
> other about their own convention — one row counted from the session that opened it,
> another from the session after — which is exactly the drift a reader catches and prose
> does not.
>
> **So the ages are not written here.** There is no column to type one into.
> `queue_gate.py` derives every age from `opened` and `QUEUE_HEAD`, and the strongest pin
> available on a number nobody rechecks turned out to be deleting the place it could be
> written.

<!-- QUEUE_FORMAT 1 -->
<!-- QUEUE_HEAD 243 -->

## The table

`state` is one of `OPEN`, `SCHEDULED`, `DONE`, `KILLED`. `—` means not applicable.

* `OPEN` — no decision has been taken. **Subject to the ceiling**: `queue_gate.py` refuses
  an `OPEN` row older than `AGE_CEILING` sessions. The ceiling does not demand the work;
  it demands a decision, because an item nobody has picked up in twenty-five sessions is a
  decision not to do it that nobody wrote down.
* `SCHEDULED` — a `target` session is required, and **the target is checked**. A
  `SCHEDULED` row whose target has passed without becoming `DONE` or `KILLED` is refused.
  Without that half, `SCHEDULED` is just `OPEN` with the ceiling laundered off it.
* `DONE` / `KILLED` — a `closed` session is required, and `KILLED` requires a `why`.
  Closed rows **stay in the table**; they are the only record that the decision was taken,
  and `QUEUE_ROW_FLOOR` refuses a table that lost rows.

| id | state | opened | closed | target | title | why |
|---|---|---|---|---|---|---|
| header-unmoved-unread | DONE | 239 | 243 | — | `UNMOVED` is the same counter with no digit in it and nothing has ever read it | — |
| population-reach-floor | OPEN | 239 | — | — | Nothing floors how far back `BLOCK_POPULATION` must reach, only how wide it is | — |
| queue-claims-unread | OPEN | 240 | — | — | `QUEUE_SELFTEST n claims` is a counter no roster reads — the reader cannot be added until a real block carries the atom, and 240's block is the first that will | — |
| queue-unread | DONE | 240 | 240 | — | The Open section is the one table in the tree no gate reads | — |
| ritual-tier | DONE | 240 | 240 | — | The opening ritual re-measures a tree nobody has touched since it was last measured | — |
| queue-kill-loophole | DONE | 240 | 240 | — | `QUEUE_NOT_ONLY_NEWEST` counted a KILL as a closure, so the first session under it satisfied the claim by abandoning five items | — |
| discover-rosters | SCHEDULED | 233 | — | 244 | Ask the DISCOVER question of `SCOPE_LEDGER` (47), `CHECKS_EXPECTED` (23), `PROSE_NUMERAL_PINS` (14) | — |
| blind-py-gates | SCHEDULED | 234 | — | 244 | Blind the seventeen tracked `.py` gates — none is swept by the instrument that asks whether an instrument collapses loudly | — |
| lint-roster-py-only | DONE | 230 | 242 | — | The lint roster covers `*.py` and nothing else; the carried `.mjs` number is wrong by ~16x (~1,014, not 63) | — |
| cause-rule-py-only | DONE | 229 | 242 | — | The cause rule covers `scripts/*.py` and nothing else | — |
| git-hooks-unset | SCHEDULED | 228 | — | 246 | `git diff` and `git add` have no hook, and `core.hooksPath` is unset in a fresh clone | — |
| gate-lock-prevention | SCHEDULED | 225 | — | 246 | `_gate_lock`'s coverage is detection plus recovery, not prevention | — |
| sdk-v2-migration | SCHEDULED | 226 | — | 247 | The SDK-v2 migration is unblocked and not done | — |
| zod-3-to-4 | SCHEDULED | 226 | — | 247 | The Zod 3 → 4 migration, with its measured blast radius | — |
| breakpoint-lite | KILLED | 226 | 243 | — | Decide "Breakpoint Lite, zero install" — priced in `docs/BREAKPOINT_LITE_PRICED.md` (242) | Decided in 243 on the price 242 measured. 74% of the 292 tools need a live editor and the fifteen `dbg_*` tools ride Godot's debug adapter on 6006, which exists only while the editor is open — so three of the four readings of "Lite" ship a Godot debugger that cannot debug, and the fourth is an Asset Library listing, which is a distribution channel for the product that already exists rather than a variant of it. The four remaining install steps are each an action in somebody else's process and none is automatable by anything this project can ship. Reopen only against evidence that install friction is what separates the downloads from the feedback — 242 §6.6's untested premise, and the cheaper thing to test |
| alt-mcp-source-pass | SCHEDULED | 223 | — | 245 | A source-level pass on `Wick` and `godot-mcp-bridge` | — |
| declared-outside-five | SCHEDULED | 214 | — | 245 | The `declared-outside-this-file` five | — |
| sweep-227-15 | SCHEDULED | 228 | — | 245 | 227 §15's sweep | — |
| d10-capability-matrix | SCHEDULED | 223 | — | 246 | D10 capability matrix with a drift gate | — |
| review-charter-p0 | DONE | 205 | 241 | — | P0 of the code review charter | — |
| npm-token-scope | SCHEDULED | 228 | — | 244 | The npm publish token's scope is broader than the package needs | — |
| prepack-unwired | KILLED | 215 | 243 | — | `prepack` is unwired | Refused on purpose in 204 §8.28 and listed there under *decided — do not re-open*, then transcribed forward as open work for twenty-eight sessions. Re-measured in 243 and the refusal is stronger than it was: `prepack` runs before BOTH `pack` and `publish`, so a `prepack` that re-staged the addon would hand check 6 a tarball the pack had just repaired, and check 6 now reads the tarball rather than the working tree. The property it would enforce is MEASURED instead, by `registry_bytes.py`'s first comparison. The gap is real and was reproduced — `npm pack` on a clean checkout of 1.74.0 ships 71 entries and zero addon files against 83 and twelve after `prepublishOnly`'s two steps — and it is now written into `CONTRIBUTING.md` where a human packing a tarball will read it |
| check-7-9-overlap | KILLED | 205 | 240 | — | CHECK 7 / CHECK 9 overlap | Thirty-four sessions open with no session ever electing it and no defect ever traced to the overlap. Reopen with an id and a session if one is |
| concise-blind-late-axis | KILLED | 205 | 240 | — | `concise_blind` late axis | Thirty-four sessions open, superseded in practice by the LATE_LIVE counter the instrument roster now reports on every run |
| d1b-not-built | KILLED | 206 | 240 | — | D1b was never built | Thirty-three sessions open. It was priced once and never elected; carrying it has cost more reading than building it would have |
| twenty-defects | KILLED | 219 | 240 | — | The twenty defects were not driven down | Twenty sessions as a bare count with no roster anyone could act on. A number without a list is not a queue item |
| audit-204-205-backlog | KILLED | 204 | 240 | — | 205 §8.8–§8.11 (D6, D5, D3) and 204 §8.9–§8.24 not re-audited | Thirty-five sessions, carried as a citation of two documents rather than as work. Anything still live in them belongs here as its own row with its own id |
| replay-vs-ci-unread | DONE | 241 | 242 | — | The session replay list and `ci.yml` are two rosters of the same commands and nothing compares them — `spec_conformance.py` is in CI and not in the replay, and it refused a document the full local ritual had passed | — |
| p0-reporters-unblinded | SCHEDULED | 241 | — | 244 | The two P0 reporters are in `DISCOVER_EXEMPT` rather than `INSTRUMENTS` — a printing reporter has no live command that can redden, so the late axis has nothing to blind | — |
| review-charter-p1-p6 | SCHEDULED | 241 | — | 246 | P1–P6 of the charter, scope now measured: P1 is three symbols, P4 is one decision, P6 is 918 branches | — |
| open-npm-lag-unread | DONE | 241 | 242 | — | `handoff_gate.py --open` re-reads 5 of its 6 header atoms — `npm.lag` returns UNREAD, and lag is a fact about the world | — |
| p0-node-engine-floor | DONE | 242 | 242 | — | Both 241 reporters import `globSync`, exposed in Node 22, against a declared `engines.node >=18` and a CI matrix of 18/20/22 — an ESM link error, not a runtime one | — |
| replay-ci-flag-granularity | OPEN | 242 | — | — | The replay/CI comparison is at SCRIPT granularity; CI runs seven flag variants the replay does not (`--patterns`, `--assert-addon`, `--assert-map`, three `--selftest`, `--refresh`) and nothing compares those | — |
| p0-reporters-unrostered | DONE | 242 | 243 | — | `p0_complexity.mjs`, `p0_testdup.mjs`, their two self-tests and `p0_comments.py` are in NEITHER the replay list nor any workflow — the population that hid the Node-engine defect for a whole session | — |
| ts-strict-mjs-undeclared | OPEN | 242 | — | — | The JS lint roster runs non-strict by choice; `--strict` reports 2,568 findings in 26 classes over the same files, and whether the instruments should be judged at the strictness the product already gets is undecided | — |
| unreached-main-granularity | OPEN | 243 | — | — | The UNREACHED closure proves a LOAD and not a RUN — `main()` in all three P0 reporters is executed by nothing, so a defect past the import boundary is as invisible as the link error was | — |
| version-row-second-claim | OPEN | 243 | — | — | The `host / addon` row's `unmoved` now has a reader; the VERSION STRINGS beside it are exempt as non-counters and nothing compares them to the tree at all | — |
| backlog-md-stale | DONE | 161 | 240 | — | `BACKLOG.md` carries a 1.39.0 baseline against a 1.74.0 tree and still says "read this before anything else" | — |

## What the gate refuses

| claim | refuses |
|---|---|
| `QUEUE_PARSE` | a row that does not parse, a duplicate or non-slug id, a session field that is not an integer, a table under `QUEUE_ROW_FLOOR` |
| `QUEUE_FIELDS` | a state missing the field it requires, or carrying one it must not — an `OPEN` row with a `closed` session is a contradiction, not a note |
| `QUEUE_AGE_CEILING` | an `OPEN` row older than `AGE_CEILING` sessions |
| `QUEUE_SCHEDULE_HONOURED` | a `SCHEDULED` row whose `target` has passed and which is still not closed |
| `QUEUE_NOT_ONLY_NEWEST` | a session that closed items and **finished** none it did not itself create — a `KILLED` row does not answer it |

🔴 **`QUEUE_NOT_ONLY_NEWEST` IS THE ONE THAT BREAKS THE LOOP, AND ITS FIRST DRAFT WAS
SATISFIED BY THE SESSION THAT WROTE IT WITHOUT ANYBODY GAMING ANYTHING.** That draft
counted any old row closed at the head, and session 240 closed its own two inventions and
**killed five ancient items it had no intention of doing** — five decisions, no progress,
green. The caveat printed here said it was *"satisfiable by closing a trivial old row"*;
it took one session for the file to demonstrate its own warning. Only `DONE` counts now.
A kill is a decision, and `AGE_CEILING` is the row that asks for a decision; this row asks
for work finished.

It is still not a guarantee that the queue drains, and a session that wants to game it
still can by finishing something trivial. It refuses exactly one thing: a session
reporting closed queue items when nothing it finished was work it inherited. That was
true of 236 through 239 and no instrument said a word.
