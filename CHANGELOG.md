# Changelog

All notable changes to Breakpoint MCP are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.73.1] — 2026-08-06

### Fixed — the release classifier could not see a value, and could not tell a clean read from no read

`wire_diff.mjs` is check 8: the only reader in the release ritual that projects onto the
`tools/list` payload a client actually consumes, and the one the release script pins the
MAJOR/MINOR/PATCH decision to. Two things it could not report have been fixed.

**A schema's accepted values are part of its type.** `typeName()` answered `"const"` for
every `const` regardless of its value, and `enum(n)` for every enum of arity *n*
regardless of its members; a `type` with a `pattern`, `minimum` or `maxLength` answered
the bare type name. Changing a `const` from `"v1"` to `"v2"`, swapping an enum's members
at equal arity, or tightening a numeric bound therefore produced identical shape maps,
zero reported differences and a verdict of `PATCH` — every one of them a change that
breaks a validating caller. Values and constraints now contribute a bounded digest, so
they land in `major` where they belong. Member *order* still does not, and a description
beside a type still does not.

**A reader that read nothing now says so.** `SURFACE_FLOOR` floored the number of tool
*names*; nothing floored the number of schema *paths* the classifier actually walked.
`shapeOf()` descends `properties` and array `items` and nothing else, and it is one
function applied to both surfaces — so an SDK relocating schemas under `$defs`, wrapping
them in an envelope, or moving to `$ref` indirection empties its population on both sides
at once, every comparison silently becomes a no-op, and the verdict is `PATCH` with a
clean exit. The new `SHAPE_FLOOR` refuses that case loudly. A one-sided collapse was
always loud; the symmetric one was not.

### Fixed — three gate rosters that could not report their own omissions

- `instrument_gate.py` printed `NOT floored on this axis, on purpose` for any instrument
  missing a `LATE_BLAST_FLOOR` row. On the `B:live` axis that sentence is true and
  declared; on the floored `A:gate` axis it meant nobody had written the row, and
  `wire_diff.mjs` had been reading that way since it joined the roster. The missing-half
  check `BLAST_FLOOR` has carried since 183 now exists on the late axis too.
- Instruments absent from `LATE_LIVE` were skipped via a bare `continue`: ten instruments
  were swept on the `A:gate` axis and eight on the stronger `B:live` one, with the summary
  reading `8/8`. Exclusions are now declared in `LATE_LIVE_NA` with a reason, and a name in
  neither table is a failure.
- `floor_pin_gate.py`'s discovery walk required a floor's name to *end* in
  `FLOOR`/`CEILING`. `LATE_CRASH_CEILING_A` and `LATE_CRASH_CEILING_B` are live ceilings
  and matched none of its three readers, nor any exemption table. The convention was never
  "ends in" — it was "contains the word".

### Fixed — a citation rule that expired

`floor_pin_gate.py`'s `REASON_CITE` recognised session numbers 150–209 and nothing else,
so the next reason written in the house style would have been read as an ungoverned
measurement and failed the gate. A citation is identified by what follows it, not by its
range, which is what the rule's own comment already said.

### Added — `token-cost.mjs` is an instrument

The budget reader has a self-test, three governed floors and a CI step, and appeared in no
mutation roster; the omission was recorded in a code comment two sessions ago and nothing
re-asserted it on any green run since. Its self-test's sections 2–5 asserted through a bare
`node:assert`, which aborts before any verdict line and makes "the gate caught it" and "the
mutant crashed the gate" one observable — they go through a non-throwing `claim()` now, and
the file prints its verdict on both paths.

## [1.73.0] — 2026-08-06

**Why this is a MINOR, and the first since 1.50.0.** `engine_log` is a new optional
field on the `outputSchema` of 22 runtime tools. Nothing was removed, nothing was
retyped, and no argument became required, so no conforming client breaks — that rules
out MAJOR. But a field that is present where it was absent is a change a validating
client can observe, which rules out PATCH. `wire_diff.mjs` read the `tools/list`
payload at v1.72.9 against the one this release ships, at both privilege levels, and
counted **147 additive schema paths across 21 tools in the secure default, 154 across
the privileged surface, and 0 MAJOR** — 291 tools before and after, none added, none
removed. The bump was decided from that; the release script asserts the two agree
rather than taking the classifier's word for it.

### Added — the engine error that reaches the caller who caused it (D1a)

The runtime bridge has kept a log ring for a long time and `runtime_get_log` has always
served it. What nothing did was tie an entry to the **call that provoked it**: a caller
had to notice something was wrong, go and read the log, and then guess which lines were
its own. D1a has been "next" for four handoffs.

Reading `_log_seq` either side of the dispatch answers it by construction — everything
appended in between belongs to this call and nothing else does. Every runtime tool whose
reply is the bridge's verbatim result now carries an optional `engine_log`:

```json
{ "engine_log": { "entries": [ { "seq": 41, "level": "error", "message": "Invalid access to property or key 'hp' (player.gd:12)" } ],
                  "total": 1, "since_seq": 40 } }
```

- 🔴 **`isError` is untouched, deliberately.** A `push_error` during a call that returned
  what it was asked for is a diagnostic, not a failed call. Promoting it would make every
  noisy frame look like a broken tool and would change the meaning of a field callers
  already branch on.
- 🔴 **Absent, never `[]`.** 208 §4 measured that no SDK materialises a documented default,
  so absent and explicitly-empty are different values to a client — and "nothing went
  wrong" is worth saying with silence.
- 🔴 **`entries` is capped at 20 and `total` is not.** A caller reading twenty cannot
  otherwise tell twenty from two hundred, and the second is the case that matters.
- **The async lane echoes too.** `runtime_step_frames` runs the game for N frames, so it
  is the dispatch most able to provoke errors from code the caller never named.

🔴 **DECLARED ON 22 TOOLS AND ON EXACTLY 22.** `structuredContent` is validated against
`outputSchema` by both SDK clients, which throw on a mismatch, so a field the addon adds
and `schemas.ts` does not declare breaks every conforming caller. The roster is **derived
from the handlers** rather than typed: a tool gets the declaration if and only if its
handler is a bare `call("runtime.…")`, i.e. its reply IS the bridge reply. The five that
build their own — `runtime_screenshot`, `runtime_await_condition`, `runtime_spawn_peers`,
`runtime_peer_stop`, `runtime_peers_digest` — would drop the field, so declaring it there
would document something always absent. `engine_log_echo.test.ts` reads `runtime.ts` and
refuses in both directions.

🔴 **AND THE LIVE PROBE IS THE ONLY READER THAT CAN SEE THE FEATURE AT ALL, WHICH IS
208 §6 ARRIVING ON PURPOSE THIS TIME.** The host adds no code to the request path — the
field rides the bridge reply — so removing BOTH addon call sites leaves all 700 unit tests
green. Measured, not assumed. `runtime-capture.integration.mjs` gains five claims against
a real engine on 4.3, 4.5 and 4.7, and the pair that matters is a provoking call and a
quiet one: `take_damage` push_logs a warning and must carry it; `runtime_get_monitors`
provokes nothing and must come back with the field **absent**. Without the second, the
first cannot tell attribution from "always attach the tail of the ring".

The version arm is `push_error`, added to the example project as
`provoke_engine_error()`. It travels Godot's own error path rather than the bridge's
`push_log`, so it reaches the ring only through the 4.5+ scriptable `Logger`: on 4.5+ the
caller's own response carries it; on 4.3/4.4 the field is asserted **absent**, so the
degradation is proved deliberate rather than assumed.

```
wire surface   352,207 -> 360,699 B  (+8,492, +2.4%)  · 291 tools, none added
check 8        WIRE_VERDICT MINOR — 147 additive schema paths across 21 tools, 0 MAJOR
host tests     695 -> 700
```

The 8,492 B is what the declaration costs, and it is the price of the field being
readable by a validating client rather than smuggled into a text blob.

## [1.72.9] — 2026-08-06

### Added — the release check that reads the wire, and two floors that were about to stop biting

The standing release-scope question, asked for the tenth time: *"what does this reader
PROJECT its population onto, and what is invisible in that projection?"* Nine cuts have
answered it by going a level down or a level out. This one pointed it at all seven readers
at once.

🔴 **EVERY RELEASE CHECK PROJECTS ONTO A FILE.** Checks 1–7 read a constant roster in the
changelog text, `git diff -- host/src`, the tarball's roots, its entry names in both
directions, its entry bytes, and the published package. **Not one reads the WIRE** — the
`tools/list` payload, which is the entire public API of an MCP server and the only thing
the MINOR/PATCH question is about. The proxy is check 2, and on any release that contains
work it goes red and hands the question to a human.

Measured over the 33 release windows from 1.40.0, building every tag and reading its live
surface:

```
v1.48.0..v1.49.0   check 2 RED    wire MOVED       agree
v1.49.0..v1.50.0   check 2 RED    wire MOVED       agree
v1.50.0..v1.72.8   check 2 GREEN  wire IDENTICAL   agree   (32 windows, byte-for-byte)
v1.72.8..HEAD      check 2 RED    wire UNMOVED     🔴 DISAGREE
```

A disagreement population of one is thin and is not why this ships. 🔴 **The reason is
structural, and #256 is the proof: check 2's population is source this repository AUTHORED,
and the wire carries bytes it did NOT.** `$schema: draft-07` rode the wire for fifty
releases, nobody here wrote it, and no check could see it. An SDK bump inside the declared
caret range moves every schema on the wire with all seven checks green.

`host/scripts/wire_diff.mjs` builds a baseline ref in a throwaway worktree against the
CURRENT `node_modules` — one toolchain, two sources, so a dependency diff cannot wear an
API diff's clothes — reads both surfaces over stdio at both privilege levels, and
classifies. A removed tool, a removed or retyped property, a newly-required argument is
MAJOR; a new tool or property is MINOR; prose is PATCH. It does not decide the release: it
answers what the public API did and the caller asserts that against the bump, the same
split `registry_lag.py` uses. Unreachable is RED.

🔴 **AND `normalise()` SHIPPED WITHOUT THE FAIL-SAFE ITS FIRST DRAFT HAD, WHICH IS 208 §3
ARRIVING INSIDE THE FILE WRITTEN TO HONOUR IT.** That draft deleted every key named
`$schema` at any depth so #256's removal would not read as a change. It was dead —
`classify` compares shapes and prose, never a raw schema object — and it was a blind spot:
a tool's own input property named `$schema` would have been deleted before the walk saw it,
and removing it later would have classified as PATCH. Found by asking what blinding the
function would redden. Nothing.

🔴 **AND THE ONE THIS SESSION DID NOT GO LOOKING FOR.** `instrument_gate.py` blinds
`verdict_gate.mjs`'s `discarded()` from its second call onwards to a healthy-looking single
site — which fabricates roughly ONE SITE PER `.mjs` FILE WALKED. `DISCARD_SITE_FLOOR = 55`
therefore caught it only while the tree held fewer walkable files than the floor. Adding
two files to `host/scripts` — neither carrying a single verdict call — took the fabricated
total from 53 to 55 and **the gate went green**. The floor's bite was an accident of an
unrelated population's size, and it had five files of margin left.

`DISCARD_BUSIEST_FLOOR` reads the population's SHAPE instead of its size: the real
population is concentrated — 61 sites in nine files, forty of them in one — while a
fabricated one is uniform however large it grows. Ten thousand synthetic sites fail it.

```
wire_diff.selftest.mjs   19 rows · 15 answer something other than PATCH (10 MAJOR) · 62 claims
instrument_gate          10 instruments · wire_diff 0 of 4 still green · blast 95
floor_pin_gate           65 floors · SURFACE_FLOOR, CLAIM_FLOOR, DISCARD_BUSIEST_FLOOR pinned
```

`wire_diff.mjs` joins the blinding roster on its first day rather than on the session
somebody notices it missing — `token-cost.mjs` is the precedent deliberately not followed
there, an absence nothing declares. `SHEBANG_NONEXEC_EXPECTED` 30 → 32, and check 15 was
the only reader in the tree that noticed the new files at all: its population is
`git ls-files`, and they had sat untracked while every disk-walking gate ran green over
them.

### Changed — two fields nobody here wrote, deleted from the wire

207 §7.1 asked what four optional MCP keys are worth and said to measure what a client
actually does with each before proposing anything. Measured. Two of the four turned out
not to be ours at all — the SDK emits them — and both say only what the protocol already
says.

🔴 **THE DIALECT DECLARATION, AND IT IS NOT A TRIM.** Every input and output schema shipped
`"$schema": "http://json-schema.org/draft-07/schema#"`. Nobody in this repo writes it: the
SDK converts our Zod through `zod-to-json-schema`, which defaults to draft-07 and takes no
target on the Zod-v3 path. MCP fixes the DEFAULT dialect at 2020-12, obliges every
implementation to support it, and treats a `$schema` field as an explicit switch to a
dialect a peer **MUST reject gracefully if it does not support**. Measured against Ajv's
2020-12 validator:

```
as shipped        580 of 580 schemas FAIL to compile
declaration gone  580 of 580 compile · 0 semantic disagreements over 2,320 probes
```

The 30,160 B is the smaller half. The larger half is that this is the documented cause of
a class of client breakage (`typescript-sdk#745`, and the Anthropic Messages API rejecting
non-2020-12 tool schemas outright).

**And `execution: {taskSupport:"forbidden"}` on the 288 non-task tools** — also SDK-
hardcoded, also the spec's own value for an ABSENT field, in a field revision 2026-07-28
deletes from `Tool` entirely. The three real task tools keep `"optional"`.

```
393,887 B -> 352,207 B   (-41,680, -10.6%)   input schemas 520 -> 468 B/tool
```

🔴 **THE STRIP IS FAIL-SAFE BY CONSTRUCTION.** Dropping `$schema` preserves meaning only
while a schema stays inside the draft-07 ∩ 2020-12 intersection, so `dialectSensitive()`
walks for the keywords where the dialects disagree and **keeps** the declaration if it
finds one. It also distinguishes a keyword from a property NAMED like one — the first pass
read `scene_get_dependencies`'s own output field as the `dependencies` keyword and would
have declined to strip anything, a silent no-op wearing a fail-safe's face.

`BYTES_CEILING` 410000 → 366000 and `SCHEMA_PER_TOOL_CEILING` 545 → 490 follow the surface
down. Two new checks in `token-cost.mjs` refuse on any dialect declaration or any
spec-default `taskSupport` reaching the wire — 🔴 **and neither has a constant behind it,
deliberately: a ceiling is a budget you may spend, these are invariants you may not, and a
knob for "how many schemas may declare a foreign dialect" would invite turning it up on the
afternoon somebody wanted the build green.**

🟡 **The other two keys were priced and KEPT.** `outputSchema` (101,374 B) is the only one
of the four with a normative obligation on both sides — servers MUST conform, clients
SHOULD validate — and both SDKs' clients throw on a mismatch. `title` (8,915 B) is the
only one whose loss a person sees. `annotations` (30,446 B) stays whole: VS Code acts on
`readOnlyHint` and `openWorldHint`, and that `destructiveHint`/`idempotentHint` have no
reader today is a fact about August 2026, not about the fields.

### Changed — the rival's number, reproduced, and the projection that could not see itself

206 §7.1 refused to let any claim quote the rival's published figure until it had been
re-derived here. It has been. `regiellis/godot-mcp-go` v0.7.2 built, driven through
`token-cost.mjs`, measured by the same `measure()` that governs this repo:

```
theirs, published    319 tools   ~202 KB     ~50,000 tokens (their 4 B/token)
theirs, REPRODUCED   319 tools  202,327 B    ~51,000 tokens (their 4 B/token)
```

🟢 **IT REPRODUCES, AND TO THE BYTE.** All ten of their published per-group figures land,
nine exactly; their two project-local commands are in the count; and the single-tool row
they publish at "~1.9 KB / ~470 tokens" measures 1,891 B with no apparatus at all. The
method they published — `initialize`, then `tools/list`, bytes of the payload — is this
file's method. **The comparison is now honest in both directions.**

🔴 **AND IT REFUTED WHAT 206 READ OUT OF IT.** 206 named input schemas as the real finding —
38% of our surface, the heaviest component. Decomposed against a server whose schemas are
70% of *its* surface: ours are **151,295 B against their 138,033 — nine percent apart, on
twenty-eight FEWER tools.** The gap is four keys they do not ship at all — `outputSchema`,
`annotations`, `execution`, `title` — **151,210 B, 38% of our surface and 79% of the entire
gap.** `outputSchema` alone is a quarter of everything we send.

🔴 **206's OWN `measure()` COULD NOT SEE ONE BYTE OF THEM.** It decomposed a tool into
`name`, `description` and `inputSchema`, and the printer presented those three as the
breakdown; on the real surface they are 60.9% of it. The other 39.1% was reported nowhere.
`measure()` now walks **every key a tool actually carries**, with a structural frame as the
only remainder by construction — so a field nobody named can no longer hide in the
difference.

Also: `SCHEMA_PER_TOOL_CEILING`, a third governed constant on the one component two servers
can honestly be compared on (`BYTES_CEILING` moves whenever an optional key is added or
dropped; this does not), and `token-cost.mjs --server <cmd> [args...]`, which drives **any**
stdio MCP server through the same core. 🔴 **Our floors are NOT applied to a foreign
surface** — a budget written for this repo has no jurisdiction over anyone else's, and a
gate that reddens on a rival's choices is a gate nobody can act on. A dead, unreferenced
copy of the self-test's first section was deleted from `token-cost.selftest.mjs`.

### Added — the cost nobody had measured, and it goes the wrong way

`host/scripts/token-cost.mjs` + its self-test. 205 §8.6 said to measure the tool surface's
token cost **before writing any claim about it**, because the competitive item behind it is
a rival publishing a number we had never taken. Measured:

```
ours,  all groups   291 tools   393,887 B   1,354 B/tool
ours,  default      278 tools   373,855 B   1,345 B/tool
theirs (published)  319 tools  ~206,848 B    ~648 B/tool
```

🔴 **WE SHIP TWENTY-EIGHT FEWER TOOLS AND COST ROUGHLY TWICE AS MUCH PER TOOL.** The measurement
refuted the premise it was taken under. 205 §5's "do not race the count" now has a companion:
we would also lose on cost. **Input schemas are 38% of the whole surface** — more than double
the descriptions — and five families run past 3,000 B/tool against a 1,354 median.

🔴 **NO README CLAIM SHIPS OFF THIS.** Their figure is published, not reproduced; measuring
ours one way and quoting theirs measured another is the "26 CI jobs" defect with someone
else's number. Reproducing it against their server is the owed next step, and until then the
number lives in an instrument rather than in prose.

`BYTES_CEILING` is therefore a budget that is **already too high** — it exists to stop the
number drifting further while it is paid down, and is meant to be LOWERED. `TOOL_FLOOR` is
the collapse guard beside it: a reader that lists nothing reports a wonderfully small surface
and passes.

🔴 **AND FOUR GATES REFUSED IT BEFORE IT WAS RIGHT.** The tautology gate found the printer
silent and took the `path-cohort.mjs` exemption plus a real self-test rather than an exemption
alone; then found its six new claims unattributed and took section markers. `floor_pin_gate`
found the ledger rows misfiled — `SIZE_LEDGER` governs the Python instruments and every `.mjs`
floor in this tree is governed by `TARGETS` alone, and being the only `.mjs` rows in that table
was the tell. It also could not READ `410_000`: a numeric separator makes a constant report as
DELETED, which that error message itself calls the more dangerous half.

## [1.72.8] — 2026-08-05

### Added — the distance nobody was measuring

`scripts/registry_lag.py`. 205 closed a fifty-version npm backlog in one publish, and the
failure it fixed was not "we did not publish once" — it was that nothing measured the gap
for 42 sessions while the blocker was one stale line in a config file that nothing ever
re-tested. This prints the registry-vs-tags distance and refuses above `LAG_CEILING`.
It would have refused at 1.33.0, which is week one of the fifty.

🔴 **A NETWORK FAILURE IS RED, NOT A SKIP, AND THAT IS THE WHOLE DESIGN.** The blocker that
cost 42 sessions was a command whose error got written down as a standing decision instead
of being re-run. A reader that goes quiet when it cannot see fails in exactly that way.
Unreachable refuses; `--offline-declared` is the only way past it, and it puts the claim on
the record instead of hiding it.

🔴 **THE LIVE READING AND THE REFUSAL PROOF LIVE IN DIFFERENT PLACES.** The live read needs
the registry and is only actionable at a release cut, so CI does not run it — a gate that
reddens where nobody can act trains people to ignore it. `--selftest` is pure and runs as a
step in the existing `contract-check` job (no 27th job, 44th session running). Nine rows,
five of them refusing, the first being the real 205 incident at lag 43.

🔴 **AND `floor_pin_gate.py` REFUSED THIS FILE TWICE BEFORE IT WAS RIGHT, WHICH IS THE POINT
OF HAVING IT.** As first written, zeroing `TAG_FLOOR` reddened nothing: an empty tag list
fell through to the never-tagged branch and returned the same `-1` for a different reason,
so the table agreed with itself over a deleted floor — 180 §7.3's shape on a new file. The
fix was to check the REASON and not only the distance. Then it objected again, because the
self-test set the floor by ASSIGNING TO THE MODULE GLOBAL, putting three `TAG_FLOOR = ...`
statements in a file that has one constant. `tag_floor` is a parameter now. A probe that
rewrites a governed constant is the sharpest form of residue landing in its own population.

### Fixed — the last two call sites that would lift, and the branch that could not fire

203 measured what 202 had only priced: **seven** unproved predicate calls across three
gates, four of them closed in `instrument_gate.py`. This closes the two that 203 §8.2
measured as cheap — `scope_gate.py`'s `roster_problems` and `control_gate.py`'s
`blast_roster_problems` — each a single pre-sweep call, each lifted into a
`collect_problems()` seam a stub can be patched into. A predicate proved by a fixture is
not a predicate proved to be **called**, and on a green tree no mutation of the input can
tell those apart.

🔴 **AND THE THIRD IS STILL NOT TAKEN, WITH THE PRICE NAMED IN THE FILE.**
`control_gate.py`'s `also_checks` is called twice from **inside the sweep loop**, on that
loop's own `fail_lines`. Lifting it means moving the loop — a different change with a
different risk. 202's "about thirty lines each" is half right, and
`_call_wiring_problems`'s docstring is where it now says so.

🔴 **ONE BRANCH IS DELIBERATELY NOT WRITTEN.** 203 shipped `I7` because the leak branch of
its new check had never fired alone, and said a check that has never refused has not been
audited. The corollary is that a **one-key seam has no other key to leak into** — writing
that branch in these two gates would ship a population that is structurally empty, which
is 201 §9.43's passes-for-the-wrong-reason inside the instrument itself.

🟢 **`SEAM_KEYS` IS WHAT REPLACES IT.** The seam's key roster is declared and compared, so
a second predicate joining reddens until it is declared — and that commit is the one in
which the leak branch becomes writable and must be written. `mutate204.py`: 11 mutants,
9 red, 2 declared-green, predictions agreeing 11/11, both gates restored byte-for-byte.

🔴 **THE TWO SEAMS TAKE DIFFERENT ARGUMENTS AND THAT IS A MEASUREMENT.** `scope_gate`'s
roster is computed inside `main()`, so the population comes in through the door;
`control_gate`'s tables are module globals, so its seam takes nothing. Declared in both
docstrings rather than left to be inferred from the signatures.

Every `problems.extend` and every `for problem in ...` stayed exactly where it was —
202 §8's rule, which is why `SCOPE_GATE`'s `BLAST 53/45`, `LEDGER 29/24` and
`STATEMENTS 20/20`, and `CONTROL_GATE`'s `56/56`, `BLAST 103/95` and `ALSO 98/90`, did
not move a digit.

## [1.72.7] — 2026-08-05

### Fixed — the calls nobody had counted, and the branch that never fired alone

202 closed `U2` in `floor_pin_gate.py` — a predicate proved by a fixture is not a predicate
proved to be **called**, and on a green tree no mutation of the *input* can tell those apart,
because a predicate that finds nothing reads exactly like a predicate nobody asked. It named
the mechanism as portable to the other three gates, priced it at "about thirty lines each",
and left the population **unmeasured**.

🔴 **MEASURED FIRST (200 §33). SEVEN unproved predicate calls across the three gates** —
`control_gate.py` 2, `scope_gate.py` 1, `instrument_gate.py` 4 — and two more predicates
reachable only through a `_self_check`. Not a guess, and not the same number in each gate.

🔴 **THE FOUR IN `instrument_gate.py` ARE TAKEN HERE, AND THE CASE IS HARDER THAN THE ONE
202 SOLVED.** `crash_problems` has **three** call sites. `floor_pin_gate.py`'s two
`reason_problems` sites were told apart by a `label` argument that exists for the purpose;
these three differ only by **which table they are handed**, so the stub is keyed on the
identity of its first argument. That makes the check strictly sharper than the one it was
ported from: a call site passing `LATE_CRASHED_A` where `LATE_CRASHED_B` was meant — the two
rosters and two ceilings 194 §33 insisted stay separate — lands its sentinel under the wrong
key and reddens. No label could have caught that.

🔴 **THE STAGE IS AN ARGUMENT AND NOT A COMMENT.** This gate has two axes, and the second
axis's tables do not exist when the first axis reports. A single seam over both would read
`CRASHED` before the sweep that fills it and quietly report zero — the failure the axis
exists to find, in the axis itself. `collect_problems(stage)` splits them, and an unknown
stage raises rather than returning `{}`, because a whole axis switched off by a typo is
172 §10.21 with a string for a disguise.

Every `problems.extend` stayed exactly where it was. This changes where the lists come from,
not what is printed or in what order — 202 §8's rule, which is why `INSTRUMENT_GATE`'s
`SIG 59/55`, `LATE_CONSTRUCTED 89/65`, `CRASHED 0/0` and `BLAST_TOTAL 990` did not move.

🔴 **AND THE SWEEP FOUND A BRANCH OF ITS OWN CHECK THAT HAD NEVER FIRED ALONE.** `I2` swaps
two predicates onto each other's keys and trips *both* halves of the check at once, so the
leak half had never been observed in isolation — a check that has never refused on its own
has not been audited (203 §9.1, turned on the check written to answer it). `I7` feeds **one**
predicate to **two** keys, which leaves the "no longer reaches" half satisfied and can only
be caught by the leak half. It reddens.

```
mutate203.py   EXPECT_DISCRIMINATES 7/7 · pass=7 red=6 declared-green=1 · agreeing 7/7
               I6 declared: _self_check no longer READS _call_wiring_problems() — the
               residue no in-process probe can see, because the probe IS the bypass
```

## [1.72.6] — 2026-08-05

### Fixed — the call, the shrink, and the number one file over

201 declared two gaps green rather than closing them and handed both over, plus a third it
named and deliberately did not take. All three are closed here, and the sweep that was meant
to confirm the fixes refuted two of its own predictions on the way.

🔴 **AN INSTRUMENT IS PROVED WHERE ITS LOGIC IS DECLARED AND UNPROVED WHERE IT IS INVOKED.**
201 lifted five branches out of `floor_pin_gate.py`'s `main()` and fed each a fixture. Its
own reverse sweep then found `U2`: delete the CALL and nothing reddens. The note blamed an
empty population — but on a GREEN tree the same is true of all five, because a predicate
that finds nothing reads exactly like a predicate nobody asked. **No mutation of the INPUT
can reach any of them.** Patching the PREDICATE can: each is swapped for a stub returning a
sentinel, and `collect_problems()` must surface that sentinel under the key that predicate
feeds. The stub needs no population, which is why the empty table stops being special — the
call site 201 could not reach is now proved exactly as well as the one reading twenty-five
rows. A predicate rewired to the wrong key reddens too.

🔴 **A ROSTER THAT SHRINKS BY AGREEMENT READS THE SAME AS ONE THAT SHRINKS BY ACCIDENT**
(201's `D1`). Deleting a `USE_TARGETS` row *and* lowering `USE_FLOOR` to match reddened
nothing. Measured before acting: **twenty-one** governed size constants across five gate
files, not the two 201 named. `SIZE_LEDGER` is the second reader — every one of them carries
its value and a sentence saying why, so lowering a floor takes two edits in two files and
the second is nothing but the reason. An accidental shrink passes neither.

🔴 **AND THE SAME TABLE CLOSED §9.4, WHICH IS WHY IT IS ONE MECHANISM AND NOT TWO.** 201 §5
governed prose numbers in `floor_pin_gate.py`'s own tables and named the same defect in the
other gates' declaration comments — `control_gate.py`'s `BLAST_TOTAL_FLOOR = 95  # measured
103 across the 56 rows`, `scope_gate.py`'s `LEDGER_COLLAPSE_FLOOR = 24  # measured 29 ...` —
without widening to them. Measured: **thirteen of twenty comments carried a non-citation
digit-run**, and one had already drifted (`LATE_CONSTRUCTED_FLOOR` said eighty-two against a
live eighty-nine). All thirteen rewritten, and the rule that stops a fourteenth is
`reason_problems()` UNCHANGED, pointed at the live tree instead of at a table.

🔴 **`reason_value` COULD NOT SEE AN INDENTED CONSTANT.** `INSTRUMENT_FLOOR` is declared
inside `instrument_gate.py`'s `main()`, so a module-level-only reader skipped the one
governed floor that is indented. Leading whitespace is not part of the claim.

🟢 **AND THE SWEEP REFUTED TWO OF ITS OWN PREDICTIONS.** `M2` — breaking the comment reader
so it finds nothing — was predicted RED and came back **green**: no comments read, no
comments to flag. That is 201 §9.43's *a check with an empty population passes for the wrong
reason*, arriving inside a check written the same day the rule was quoted. `COMMENT_FLOOR`
is the floor it earned. `governed_sizes()` needed no such floor — emptying it turns every
ledger row stale and reddens — and only running both mutants said which reader failed loud
and which failed silent.

## [1.72.5] — 2026-08-05

### Fixed — the mutation that could not reach the reader, and the numbers written in prose

200 handed over three items. All three measured differently from how they were written, and
measuring first (200 §33) is the only reason that was found.

🔴 **A floor is defended where it is DECLARED and unread where it is USED.** `path-cohort.mjs`
imports its five cohort floors from `_path_ledger.mjs`; re-inlining a literal there would be
invisible, because the self-test still pins `COHORT_FLOORS.total` and the reverse sweep still
zeroes it. 200's sweep declared that gap green as `C2` and 200 §35 asked which other
instruments could stop reading an import silently.

**Measured: six cross-file floor imports exist and five are a self-test importing from the
gate it tests** — those *are* the declaration-site pins. Exactly one is a live consumer, and
it is the one already named. The population is one, not six.

🔴 **And the reason nothing catches it is the DIRECTION of the mutation.** Every row in
`floor_pin_gate.py`'s sweep moves a floor toward zero, and for a `got >= floor` comparison
zero is the value that makes a consumer trivially pass. The sweep is therefore structurally
incapable of proving a consumer still reads the number — it can only prove the self-test does.
`USE_TARGETS` **raises** each floor above the live value instead, and requires the consumer to
refuse. All five reddened `path-cohort.mjs`; a re-inlined literal would keep it green.

🔴 **`floor_pin_gate.py` had no `_self_check()`, and cited other files' by name in six
exemption reasons.** `UNDISCOVERABLE_CEILING` bounded a roster that went empty, so
`len(roster) > ceiling` was false for every value the ceiling could hold and raising it
reddened nothing — 200's `U1`, which declared the gap rather than closing it. The branch is
lifted into `ceiling_problems()` and fed a fixture: three declarations against a ceiling of two
must bite, three against three must not, and zero against zero — today's live shape — must stay
green. Four more branches are lifted and fixtured beside it.

🔴 **A reason string is a number nobody compares.** Twelve of the exemption table's
twenty-four reasons carried a non-citation digit-run, and four were the same defect in the same
shape — a parenthetical a reader takes for the row's floor, which was the *live* measurement
and had already drifted:

```
BLAST_TOTAL_FLOOR        said (103)        the constant holds  95
SCOPE_BLAST_TOTAL_FLOOR  said (53)         the constant holds  45
LEDGER_COLLAPSE_FLOOR    said (29)         the constant holds  24
ALSO_ATTRIBUTED_FLOOR    said (98 of 103)  the constant holds  90
```

The rule is not *do not quote numbers*, it is *a number in prose must come from the tree*.
`{FLOOR}` resolves from the row's own constant on every run — 188 §2's `{V}` idiom one table
over — and everything else is spelled in words, which **seventeen of the twenty-four rows
already did**: the rule is derived from the table's own house style rather than imposed on it.

🔴 **The self-check caught its own author twice, on the first run.** The citation regex read
three digits followed by any punctuation, so `103,` parsed as a session citation and the rule
flagged nothing; and stripping `§` sections before citations turned every citation into a bare
number. A citation is identified by what *follows* it, not by its range.

### Verification

```
mutate201.py    EXPECT_DISCRIMINATES 4/4 · pass=9 fail=0 declared-green=2 of 9
floor_pin_gate  57/57 pinned · 🆕 5/5 USE-site floors raised and each reddened its consumer
                🆕 _self_check ok · 🆕 25 reasons read, 4 resolving `{FLOOR}`, 0 bare numbers
```

## [1.72.4] — 2026-08-05

### Fixed — the floor a rename could not reach, and the ten the sum could not see

199 §12.2 was the only open item with a written-down end state: rename `LEDGER_SCOPE` and
`LEDGER_POPULATION` so `floor_pin_gate.py`'s discovery half can name them, and
`UNDISCOVERABLE_CEILING` falls from 2 to 0. It fell. 🔴 **But the rename was not what did it,
and measuring before acting is the only reason that was found.**

`DISCOVER_RE` has two halves. 199 widened the NAME half twice and never touched the VALUE half,
which accepted a digit or `{`. `Object.freeze({...})` is neither — so the renamed constants
would have stayed exactly as undiscoverable, and the item would have read as done. Both edits,
or neither works.

🔴 **Dropping the value half entirely then found a floor this gate had never named.**
`host/scripts/path-cohort.mjs` held `const FLOORS = [` from session 173: five literal floors, in
a script CI runs on every push, appearing in **none** of the gate's three tables — not TARGETS,
not `DISCOVER_EXEMPT`, not `UNDISCOVERABLE_DECLARED`. Outside the gate by construction, with no
line anywhere saying so. Measured across both walked trees: 66 floor-shaped constants exist, 65
were already accepted, and dropping the value test admits exactly one more.

They could not have been pinned where they lay — that script opens an MCP transport at import,
so nothing can import it to assert a literal. The five move into `_path_ledger.mjs` as
`COHORT_FLOORS`, which is 179's rule (*an instrument enforces its rules where they were written,
not where its population comes from*) paid by that file for the second time. Each is now pinned
by value in the self-test and swept by its own TARGETS row. `TARGET_FLOOR` 51 → 57.

🔴 **And the array left behind is no longer called `FLOORS`.** The gate reported it unswept on
the first run after the widening — correctly. An exemption reading *"it holds no literal now"*
would silently excuse a literal re-inlined there tomorrow; naming it `COHORT_ROWS` takes it out
of the discovery half **because it is not a floor**, rather than in spite of being one.

**Ten of the eleven `CLAIM_SITE_FLOORS` were pinned only by their sum** (199 §12.3). A sum
cannot see a compensated change — one entry down, another up — which is the only shape a
session lowering a floor on purpose would produce. All eleven are now pinned per key against an
expected table, in both directions. That table is itself a floor-shaped constant and this gate
reported it unswept on the run that first saw it, so it has a TARGETS row too.

### Verification

```
mutate200.py    EXPECT_DISCRIMINATES 3/3 · pass=8 fail=0 declared-green=3 of 8
                R1 the value half restored          -> RED   (the widening is falsifiable)
                S1 compensated swap, sum unchanged  -> RED   (green before this session)
floor_pin_gate  57/57 · unswept 0 · UNDISCOVERABLE 0 undeclared · 0/0 declared · CEILING 0
tautology_gate  orphan 46/46 — a claim site written inside a loop body reddened as an
                orphan and was UNROLLED rather than absorbed by raising the ceiling
```

Three mutants are **declared green**, each naming what is not measured rather than leaving it in
a comment: the symmetric Python widening is defensive; re-inlining a cohort literal in the
script is a real and currently invisible gap; and `UNDISCOVERABLE_CEILING` now bounds an empty
roster, so `0 > 2` is false for every value it could hold.

## [1.72.3] — 2026-08-05

### Fixed — the reads that ran outside their claims, and the floors a name could not reach

198 §9.2 handed over twelve declared crashes as the only open item with a written-down end
state. That end state is reached: `CRASH_CEILING`, `LATE_CRASH_CEILING_A` and
`LATE_CRASH_CEILING_B` are all **zero** and both rosters are empty. A blind that used to kill
its gate now makes it report.

**Twelve rows are nine sites across six files, not twelve across five.**
`_workspace.selftest.mjs:94` carried two rows and `_caller_shape.harness.mjs:449` carried
three. 🔴 One of the nine is not in a self-test at all: `{SIG:inspect}` dies inside the
**shipped** `seal_order_gate.mjs`, where `files.filter((f) => f.markers !== null)` — a strict
test against one falsy value — let a record with no `markers` key through to
`.declared.length`.

🔴 **And the site list was a surface, not a population.** Fixing the nine exposed the next
unguarded read behind each; four rounds of capture-fix-recapture before nothing crashed.
Twenty-two guards, of which exactly one is not a `?.` — a claim that read a file a blinded
restore never rewrote and threw ENOENT, which no optional chain can reach.

🔴 **The three live-axis rows were one edit.** `runSeal()` and `runTally()` were the two of
five sections running outside the throw-catcher `pop.family(…, onThrow)` gives the other
three, so an assertion failure killed the process before the population line printed.

🟢 **The crashes were costing 249 unreported failures.** Blast across the twelve rows went
92 → 341; four `BLAST_FLOOR`s and four `LATE_BLAST_FLOOR`s were sitting three to five times
below their own measurement and are raised with headroom.

**`floor_pin_gate.py`'s exemption table is keyed by `(file, name)`.** `TARGET_FLOOR` resolved
to two files under one bare-name entry — 197 §8.4's defect, live. The same key change on the
`known` side deletes a hand-written line that re-admitted `CLAIM_FLOOR` and
`SELFTEST_CLAIM_FLOOR`, each of which names three files.

**The `.mjs` discovery half now reads a dict-valued floor** — and a plural one, because every
dict floor in that tree is plural and accepting `{` alone would have found nothing. It found
`CLAIM_SITE_FLOORS` unswept on its first run, whose eleven values were pinned by nothing:
`"_caller_shape.harness.mjs": 45` is 191's guard against a revert-by-predicate and could have
gone to zero in silence.

### Added — the check that makes a widened discovery regex falsifiable

```
FLOOR_PIN_UNDISCOVERABLE   0 undeclared · 2/2 declared
```

Every check in that gate asked whether a discovered floor is in the table. None asked the
reverse, so narrowing either discovery regex reddened nothing — everything it stopped finding
was already swept. Two floors are genuinely unnameable by the walk (`LEDGER_SCOPE`,
`LEDGER_POPULATION`, whose names carry no floor word) and are declared with reasons under a
ceiling meant to fall by renaming the constants.

## [1.72.2] — 2026-08-05

### Fixed — the axis that was still reading a return code, and the marker that had to be chosen against ground truth

197 §5 gave `instrument_gate.py`'s PRIMARY axis three values where it had one — green,
reached-its-own-verdict, and the failure count — after finding nine blinds that went red
without their gate ever reaching a verdict, one of which had not compiled since #211. It did
not reach the LATE axis. `run_counting()` was still, in full:

```python
p = subprocess.run(cmd, capture_output=True, text=True, cwd=str(cwd))
hits = [int(m) for m in re.findall(rf"{LATE_MARK} (\d+)", p.stdout + p.stderr)]
return (p.returncode == 0, max(hits) if hits else 0)
```

so it carried both defects 197 fixed, plus a third that only exists on this axis.

**`red` had two causes and one observable, here too.** Measured over 85 red rows across the
two late axes: **twelve** blinds crash their gate rather than failing it and were counted as
catches. Nine of them are on the self-test axis and are **exactly** the nine already declared
on the primary axis — the crash is a property of the self-test's setup read, not of which
injector wrote the mutant — so that half reuses `CRASH_DECLARED` rather than copying it, and
§8.2's nine call sites now pay both axes at once. The other three are on the live axis, in
`_caller_shape.harness.mjs`'s own `sok()`, and are declared with their reasons.

**The failure count was captured and discarded**, so the late axis had no blast radius at
all. It now has one, per instrument and never summed. 🔴 The `B:live` half is deliberately
**not** floored: four of that axis's five commands report by collapsing a population and
print no per-claim `FAIL` line, so every floor there would be a floor at zero — the shape
this file already refuses. The number is printed and says of itself that it is not compared.

**And `max(hits) if hits else 0` mapped two states onto one number.** The counting hook is
injected into the target's own body and writes from a `process.on("exit")` handler, so
`hits == [1]` means "really called once" while `hits == []` means **the hook never ran** —
the mutant did not load. Both landed in `calls <= 1`, both were filed *"a late blind is not
constructible there"*, and neither raised a problem. That is #237's `SyntaxError` reading as
`ok`, on the other axis, in softer language: `{SIG:judge}` was unloadable here too for those
twenty-five commits, and this axis reported it as a target that simply is not called twice.
🔴 The guard for it has **no live row** — all 118 mutant runs on a healthy tree hook — so it
is a regression backstop fed by a fixture, and this entry says so rather than implying a
catch.

**🔴 The marker could not be the primary axis's, and the capture said so before a line was
written.** All eight `B:live` controls run green *without* printing their instrument's
marker, because the live caller is a different command printing a different report — so
handing `VERDICT_MARKER` to the late runner would have called every red on the live axis a
crash. `LATE_VERDICT_MARKER` is therefore keyed by the **command**, not the instrument (three
instruments share one live caller), and the string for each was chosen against an independent
classification of the captured runs rather than by inspection. Two drafts were refuted
offline at zero cost: ranking candidates by the smallest crash roster picks
`SHAPE_SEAL_A`, which calls all three genuine crashes a catch; taking the gate's final
verdict line picks `CALLER_SHAPE`, which is printed only on a green run and calls seven
genuine catches a crash. Both are now mutants in the reverse sweep, because nothing else in
the tree can tell the right string from either wrong one.

### Added — the floors, ceilings and rosters that make the above falsifiable

```
INSTRUMENT_GATE_LATE_CRASHED   [A:gate] 9/9 · [B:live] 3/3   two ceilings, never summed
INSTRUMENT_GATE_LATE_NOT_LOADED            0/0               a mutant that never loaded
INSTRUMENT_GATE_LATE_BLAST     9 per-instrument A:gate floors; B:live printed, not floored
LATE_VERDICT_MARKER            5 commands, roster read in BOTH directions
```

`floor_pin_gate.py`'s discovery half found both new constants unswept on the first run and
they are exempted by name with reasons, alongside the six `instrument_gate.py` constants that
already were: its runner would be `instrument_gate.py`, which mutates the working tree.

## [1.72.1] — 2026-08-04

### Fixed — the target that had not compiled since #211, and the verdict nobody waited for

196 §3 found `control_gate.py` computing a number, printing it inside an `ok` line, and
comparing it to nothing since 187 — and 196 §8.3 handed over the observation that the
defect belongs to a CLASS of mutation-based instrument, of which `scope_gate.py` and
`instrument_gate.py` are the two remaining members. Both were asked the same question.

**`instrument_gate.py` — `{SIG:judge}` on `seal_order_gate.mjs` has not been applied since
#211, and the gate printed `ok` over it for 25 commits.** Both injectors anchored the
blind on `text.find("{", idx)` — the first brace after the declaration. In #211
`seal_order_gate.judge` gained a destructured options bag:

```js
export function judge(files, { filesFloor = FILES_FLOOR, sealFloor = SEAL_FLOOR, … } = {}) {
```

so the injection landed inside the parameter list, node exited 1 on
`SyntaxError: Unexpected token '{'`, and `green()` — which was `return p.returncode == 0` —
read that as a catch. The brace is now computed from the anchor rather than searched for,
in one function both injectors call. Applied correctly, that blind reddens **39** claims;
`seal_order_gate.mjs`'s blast total goes 127 → 166.

**And `red` had three meanings with one observable.** `green()` captured the gate's whole
output and returned a boolean, so "the gate caught the blind" and "the blind crashed the
gate" were indistinguishable — 181 §4's `REPORT_MARKER` problem, fixed in `scope_gate` five
sessions ago and carried in `control_gate` as `executed`, never applied here. Measured over
the 59 blinds: **727 failure lines nothing read**, and **9 blinds that go red without their
gate reaching its own verdict** — eight uncaught `TypeError`s in self-test *setup* plus the
`judge` case above. Each instrument now declares a `VERDICT_MARKER`, proved on its own
CONTROL run before any mutant is applied; the nine crashes are declared with their reasons
under `CRASH_CEILING = 9`, a **ceiling** because moving those setup reads inside a claim is
what should edit it.

**`scope_gate.py` — three of its twenty-five blinds never reddened the scope ledger at
all.** The file's docstring says the ledger closed these enumerators with literal floors
and that this file is what keeps them closed. `doc_recipe_mentions`, `recipe_names_constant`
and `privileged_tools` had **no ledger entry**: two went red on a `Could not parse X from Y`
guard and one on check 12's roster comparison. Delete the entire ledger and the gate stayed
green over them — caught by something near the gate rather than by the gate. The three
missing `SCOPE_LEDGER` populations were added, and every row now declares both the exact
number of `FAIL` lines it produces and the ledger population it must collapse, checked per
row against `FAIL: SCOPE COLLAPSE <population>:` — an exact reader, so no diagnosis-only
hedge is needed here.

**And the new control assertion caught a third defect on its first CI run.** `node --test`
picks its reporter from whether stdout is a TTY — `spec` on a developer's terminal, `tap`
in Actions — and the two print different summary lines (`ℹ fail 0` vs `# fail 0`). The
`path-cohort` instrument's verdict marker and failure count were therefore
environment-dependent: green on a Mac, unreadable in CI. `--test-reporter=spec` is now part
of the gate command rather than a preference, so the dialect is a property of the command
and not of the terminal. This is exactly what the CONTROL assertion exists to do, and it
did it before a single mutant was applied.

### Added — the floors and ceilings that make the above falsifiable

```
SCOPE_GATE_BLAST            53/45    FAIL lines across 25 blinds, every row declared
SCOPE_GATE_LEDGER           29/24    ledger populations actually collapsed
INSTRUMENT_GATE_BLAST       9 per-instrument floors, never summed (172 §6)
INSTRUMENT_GATE_CRASHED      9/9     a CEILING, every entry declared with its reason
FLOOR_PIN stale-exempt       0       the exemption table read in BOTH directions
```

`floor_pin_gate.py`'s discovery half was scoped to the word `FLOOR` — three ceilings sat in
its target table by hand, and a fourth written today would have been outside the gate by
construction. It now discovers `CEILING` too, and reads a dict-valued floor. It also reads
`DISCOVER_EXEMPT` in the other direction: an exemption naming a constant that no longer
exists anywhere is now a failure, because otherwise narrowing the discovery regex silently
un-sweeps every constant of that shape while its exemptions still read as live.

## [1.72.0] — 2026-08-04

### Added — the number the gate had always printed and never read

195 §8.2 asked an **archive** question: which shipped claims in CHANGELOG entries 180–193
rest on a reverse-sweep mutant that edited `addons/` or a file with a tracked copy? 194 §6
had found that such a mutant reddens check 24b whether or not it does anything else, and
that its red run had been read as proof of the check it was written for. That scratch is
gone, so the audit is impossible.

**The same question asked of the SHIPPED instrument is answerable exactly, and the answer
was sitting in its own output.** `control_gate.py` applies 56 mutations and asserts three
properties of each: the run goes red, it reached the report, and the statement the row
NAMES fired. It also computes `fails = out.count("\nFAIL: ")`, prints it inside the `ok`
line, and compares it to nothing. Measured:

```
26 of 56 rows redden MORE THAN ONE failure statement
18 of 56 rows redden a CHECK THEY DO NOT NAME
check 24b   reddened by 10 rows that do not name it — every one of the ten
            edits a file with tracked addon copies
check 20    reddened by 8
```

`23.encode_only`, `23.decode_only` and `23.oneway_stale` were written in 192, **before
check 24b existed**. 193 added 24b; each of them silently went from one FAIL line to two,
and for three sessions nothing said so.

Every control now declares its blast radius in a `BLAST` roster, and the gate compares the
declaration to the observation. A check added since a row was written is now a loud,
named failure in the commit that adds it:

```
🔴 CONTROL_GATE_BLAST 15.noshebang: declared 3, observed 2. This
   mutation's blast radius moved. Checks it reddens that it does NOT name: ['20']
```

**The verdict rests on the count, not on the attribution, and that is deliberate.** The
new `also_checks()` reader resolves 98 of 103 FAIL lines to a named check; the five it
cannot are statements whose every literal is shared across checks. An assertion resting on
a reader that is 95% right is 194 §4 shipped. So the count — a number this file already
computed and no new reader can be wrong about — is the gate, and the attribution is the
**diagnosis**, printed when a row drifts so the next author is told which check arrived.

Two floors, not one, for 194 §33's reason — a subtraction over more than one contributor
needs two numbers:

| floor | what collapses without it |
|---|---|
| `BLAST_TOTAL_FLOOR` 103/95 | a control going quiet, absorbed by editing its own declaration one row at a time |
| `ALSO_ATTRIBUTED_FLOOR` 98/90 | the attributor silently ceasing to resolve, while every row still passes |

Three new detectors — the roster's two halves and the attributor's confession — are lifted
out and fixture-fed, so none of them can be deleted invisibly on a healthy tree.

## [1.71.0] — 2026-08-04

### Changed — the anchor that outran itself

`instrument_gate.py` blinds 59 named members across eight instruments and requires each
one's gate to go red. Every target was anchored on the member's **full signature literal** —
precise, because a blind is a textual substitution, and outrun by every correct change that
adds a parameter. Measured from git rather than from memory:

```
judge       (seal_order / boundary / verdict)   9 distinct commits — the seal_order
                                                anchor moved in SEVEN consecutive sessions
judgeScope  (tautology_gate)                    5 distinct commits, two of them 193 and 194
comparisons (boundary_gate)                     3
```

Each was caught loudly as `SIGNATURE NOT FOUND` rather than skipped quietly, and none was a
defect. The gate was working; the anchor was pinned to a moment rather than to the invariant.

Targets are now written `{SIG:name}`. This is **not** a loosened prefix — 193 §12.27 refused
that on the grounds that a prefix matching two same-named members would blind the wrong one
silently, and that decision holds. The placeholder turns the two things the literal was
really asserting into assertions of their own and drops the third:

```
0 declarations of `name`    ->  LOUD.  RESOLVES TO NOTHING — a renamed or deleted
                                       member is still caught, which is the whole
                                       reason a literal anchor was tolerable
2+ declarations of `name`   ->  LOUD.  refuses to choose, and says which lines
1 declaration               ->  the anchor, read off the live source
the parameter list is EXACTLY this  ->  dropped, on purpose. It never guarded the
                                       blind CONSTANT — a return shape is not in a
                                       signature — and it was the only thing costing
```

🔴 **It resolves against the file being mutated, which 188 §2's `{V}` forbids for itself.**
The difference is what the anchor claims. `{V}`'s row claims a value that lives in another
file, so reading it off the file under mutation would be self-satisfying and would take
180 §9.3's guard away. This anchor claims a named member exists **exactly once in the file
about to be swept**, and both halves of that are asserted by the resolution rather than
assumed by it.

Measured before a line was written (194 §31 — *open the file the item names*):
**59 targets · 59 resolve identically to the literal that ships · 0 ambiguous · 0 missing**.
That is why the whole roster converts rather than the single row 194 §9.2 named: a discovery
half scoped to one name rots in the direction the name does not cover (183 §12.29), and
`judge` had already cost more than `judgeScope`.

`literal_signature_problems` refuses a literal anchor **when the placeholder would resolve
to it exactly** — `derived_literal_problems`' shape one file over, including its second
return value, because on a healthy tree the problem list is empty and an audit over one
target reads the same as an audit over fifty-nine. Where a name is ambiguous or absent the
literal remains the only correct anchor and is still allowed.

`INSTRUMENT_GATE_SIG 59/55` is a third population for this harness and a third collapse
neither existing floor could see: replacing a placeholder with the signature it resolves to
today changes no printed line, no verdict and no blind — it only puts that row back on an
expiry date, which is how the class arrived, one row at a time. Registered in
`floor_pin_gate.py`'s exempt table and pinned in `_self_check()`, because an exemption whose
reason is not true is 174 §5 in the file that keeps citing it.

**Reverse sweep: MUTATE195 pass=11 fail=0 declared-green=0**, with `carries=` mandatory
(194 §9.3) and a new `expect=` — the mutated text must contain what the mutant says it
changed, before anything runs. 194 §32: last session's H1 changed the file and ran a
*different* mutation than the one it declared. The pair that is the claim:

```
C1   green   a tenth parameter joins judgeScope       ->  the gate stays GREEN
C1b  red     the same parameter, literal anchor back  ->  SIGNATURE NOT FOUND
```

No surface change: 291 tools / 278 read / 13 write. No new tool, no response-field change,
no new CI job. Addon untouched at 1.9.8.

## [1.70.0] — 2026-08-04

### Added — the message that blamed the engine

193 §3 split `unsupported` into two populations and handed the rest over as a decision:
four SHAPE sites answer "the node you named is the wrong kind", which is what `bad_type`
says at 47 other sites, and `docs/TOOL_CATALOG.md` documents that choice twice. The
decision taken is **keep the code, fix the message** — the shipped vocabulary does not
move, so the catalog stays true and nothing branching on `unsupported` breaks.

🔴 **The harm was never the word on the wire; it is what the reader does next.** Read
`unsupported` on `shadermaterial_create` against a message that says only
`Sprite2D has no material slot` and the reasonable inference is *"this build cannot do
shader materials"* — so the caller stops. The correct read is *"pick a node with a
material slot"*, and until now the difference between those two lived nowhere but in prose.

All four shape messages now name the caller's node, name the classes that would work, and
avoid every capability word. **Check 24c** holds them there, with four arms asked of each
site's own derived kind rather than of a roster:

```
SHAPE       must name the caller's node             the subject is THEIR object
SHAPE       must not read as a capability refusal   no version claim, no "unavailable"
SHAPE       must name a class the GUARD ITSELF TESTS  it must say what to pass instead
CAPABILITY  must NOT name the caller's node         the subject is the BUILD
```

🔴 **The third arm is the one that does work, and it is derived rather than a word list.**
"Contains a capitalised word" is satisfied by "Pass" and would be vacuous the day it
shipped. What the message must contain is a class the guard's own predicate tests:
`if not (node is GPUParticles2D)` demands `GPUParticles2D`; `if prop == "":` resolves to
`_material_prop(node)`, whose body tests `CanvasItem` and `GeometryInstance3D`. That cannot
be satisfied by prose — only by naming the thing the caller has to go and get. **It failed
2 of 4 before this change.** A fifth statement covers the reader itself: a raise site whose
message literal is not on the raise line is 193 §7.2's `emit_failed` exactly, and it would
have passed all four arms silently.

### Fixed — the probes' own section markers, which the scorer was not reading

193 taught the tautology scorer the section BANNER and took the orphan ceiling 509 → 148.
Reading under what was left found the reader was missing the idiom that matters most:
`_population.mjs` attributes every claim at runtime by two calls, and the scorer read
neither.

```
HEADER-FIRST  population.open(label)   claims count into it until the next open
FAIL-FAST     population.seal(marker)  attributes every claim since the previous seal,
                                       so the marker sits BELOW its own claims
```

`vcs.integration.mjs` spells all twelve of its sections with `seal()` — 78 claims, the
largest single block of orphans in the tree. The runtime always knew which section each of
them belonged to. **The scorer now asks the same question, so this closes without adding a
single banner to a single test file.** The `family()` idiom is excluded by construction: it
sets `current = null` on exit, so "nearest event above" would hand a post-family claim the
section that already closed — and those files are already owned by the AST walk.

🔴 **And the banner reader knew one of the three ways this tree draws a banner.** 193
generalised from eleven files and was right about those eleven. The same convention is
drawn with box characters in 183 lines across `scripts/`, `test/` and `test-integration/`,
and with a three-dash leading rule in both LSP plane probes — `verdict_gate.selftest.mjs`,
`cs-lsp-plane` and `lsp-plane` were being counted as carrying no banners while carrying
them. A second form matches a title FLANKED by rules, as a union with the first, never a
swap; `// -- TODO --` still matches nothing.

```
orphan 148 → 46 · attributed 3582 → 3700 · units 1688 → 1739
sectionAttributed 448 (new floor 380) · bannerAttributed 362 → 21 (floor 300 → 15)
vacuous 0 · every 0 · offender 0 — every newly-scored claim is clean
```

The banner floor came down because the section path is tried **first**: `population.seal()`
is what the runtime counts by and a comment above the same claim is decoration. Ten of the
eleven files that floor was measured on carry both, so 341 of its 362 moved to the path
that is right about them. Two paths under one subtraction need two numbers — 172 §10.22 —
so `SECTION_ATTRIBUTED_FLOOR` is the second, and killing either while the other grows is
now a named failure rather than a quiet one.

## [1.69.0] — 2026-08-04

### Added — one word with two meanings, and the copies nobody compared

192 §5 bound one TypeScript branch to one GDScript handler: for each branch, does the
handler it guards actually raise the code? That is the forward direction. **Check 24 pays
the reverse one** — 53 codes are raised and the host has an opinion about exactly one of
them — and measuring it first turned a product question into a sharper one.

`unsupported` is raised at eight sites, and they are two populations. They split by what
the **guard condition tests**, four and four:

```
CAPABILITY  the guard reads only engine/editor globals — has_method(..), a null accessor
            _main_screen_get  _main_screen_set  _scene_close  _editorsettings_get_set
            → "this Godot build cannot"

SHAPE       the guard reads the node the CALLER named, always after a `bad_path` check on
            that same node has already passed
            _particles_set_texture  _shadermaterial_create / _set_shader / _set_param
            → "the node you picked is the wrong kind"
```

The host's one branch renders `unsupported` as *"closing a scene requires Godot 4.4+"*.
That is correct **only** because 192's binding pins it to `_scene_close`. Bind the same
branch to a shape-kind handler and the host tells a caller to upgrade Godot when the fix is
to name a node with a material slot. Check 24 asserts exactly that: a branch whose message
cites a Godot version must be bound to a capability-kind site.

🔴 **The four shape codes are not renamed here.** `docs/TOOL_CATALOG.md` says "degrades to
a clear `unsupported`" twice, for those exact sites — a documented choice on a shipped
surface. The check makes the two populations countable and the rule that depends on them
asserted, so a future rename is a decision rather than a drift.

The classifier is derived, not rostered, and **its floor caught it on the first run**:
`_editorsettings_get_set` writes `var es := EditorInterface.get_editor_settings()` above
`if es == null:`, so the probe is on the previous line. The identifier the guard tests is
resolved to its assignment — one hop, because one hop is what the tree uses.

### Fixed — a shipped addon copy was missing two fixes, and nothing compared them

192 §9.7 asked for one hash comparison over `variant_json.gd`'s four copies. Measuring the
whole population instead found the predicted risk was not the real one — `variant_json.gd`
is identical everywhere, and `host/addon/` is gitignored build output — while
**`runtime_bridge.gd` differed between `addons/` and `example-csharp/addons/` by 53 lines.**

The C# example's copy was missing the `object/count` ObjectDB leak monitor that
`node-lifecycle.integration.mjs` watches, and the **entire `emit_failed` fix**: it called
`node.callv("emit_signal", ..)` and discarded the Error, so `signal_emit` answered
`{"emitted": true}` for an emission the engine refused. `emit_failed` is one of the 53
codes check 23 counts — the cross-language check had been asserting a vocabulary one of the
shipped copies did not have. The copy is re-synced and check 24b compares content across
copies, with `.uid` files excluded by suffix rather than by a roster that would go stale.

### Fixed — the live-engine integration suite was never scored for tautology

191 turned `orphan = sites - attributed` into `ORPHAN_CEILING = 509`; 192 carried it forward
saying "not one of them has been read". Reading them answered the question both ways, 85/15:
77 legitimate banner claims, and **432 across eleven `*.integration.mjs` files where not one
claim reached a unit**. Those files use zero `node:test` — bare async scripts with a `die()`
helper — so `enclosingTest` found nothing, and `vacuous`/`every`/`offender` are scored over
attributed units only. The most expensive tests in the repo were scored by nothing.

`enclosingTest` now falls back to the **section-banner idiom those files already write**,
which costs no new maintenance surface, and only where a file has no `test()` blocks at all.
362 claims became attributed and the ceiling came down 509 → 148. All 362 score clean.

`BANNER_ATTRIBUTED_FLOOR` counts the fallback as its own population, because the ceiling is
a subtraction and a subtraction cannot say a path ran — mutant C3 kills banner attribution
while the orphan count stays under its ceiling, and only that floor notices.

## [1.68.0] — 2026-08-04

### Added — the vocabulary that crossed the wire, and the word that was raised eight times

178 §10.25 named the cross-language invariants and four sessions carried them: the addon's
`Codec` encodings and `_err` codes are enforced in GDScript and asserted in TypeScript, with
nothing comparing the two. 190 paid the *within-file* half by exporting `READS_AS_CLAIM` so
one predicate has one definition. **Check 23 pays the cross-LANGUAGE half.**

Measuring first turned one sentence into two populations that had been sharing a phrase:

```
the CODEC tag vocabulary   encode() emits 12 · decode() accepts 10 · TypeScript builds 3
the ERROR CODE vocabulary  operations.gd raises 53 · TypeScript branches on 1
```

Checks 1 & 2 already compare the two languages — but they compare **method names**. The
payload vocabulary crossing the same wire had never been compared by anything.

Check 23 asserts six things: a tag emitted with no decode arm (it round-trips to `null` and
every layer reports success); a decode arm nothing emits; the one-way pair `{Object,
Unsupported}` asserted **exactly** rather than tolerated, so a third one-way tag arriving by
accident is a failure; a TypeScript-constructed tag GDScript cannot decode; a constructed tag
whose **fields** don't cover what `decode()` reads — the tag name matches, so nothing rejects
it and a `Vector2` payload carrying `{x, z}` decodes to `Vector2(x, 0)`; and a TypeScript
branch on an error code no `_err(..)` raises.

🔴 **The reverse sweep refuted the sixth and the check had to grow a seventh.** Mutant C1
renamed the one `_scene_close` raise site `tabletop.ts`'s board-overwrite refusal depends on
— and the run stayed **green**. `"unsupported"` is raised at eight sites, so the addon's
*vocabulary* never moved. The membership test asks "does this word exist somewhere in
GDScript"; the guard needs "does the handler I am wrapping raise it". So the pair is now
resolved to the **binding** — the bridge method whose call the branch guards, against the
transitive closure of `_err` codes that method's handler can return. `board_create` with
`overwrite: true` silently appending to a stale open tab was one rename away, and
`tabletop_guard.test.ts` passes either way because it constructs the thrown error itself.

Seven statements, seven controls, registered in the same commit as the check — `covered`
48 of 79, and `blind` stays at 31 rather than growing by seven.

### Fixed — two instruments anchored on how many checks there were the day they were written

Adding one name to `CHECKS_EXPECTED` broke the anchor in **two** separate gates, both pinned
to the roster size: `control_gate.py`'s `22.floor` row (which guards "a check went missing")
and `floor_pin_gate.py`'s `CHECKS_RUN_FLOOR` sweep, which reported `matched 0 time(s), not
once — this row tests NOTHING`. Both guards worked; both anchors were wrong. The control row
takes a `{CHECKS}` placeholder resolved against the roster — the third member of the class
188 §2 opened — and the sweep anchor takes `\d+`, which is right for this row alone because
it is the one floor in that table asserted equal to something else.

## [1.67.0] — 2026-08-04

### Added — the idiom no gate could read, and the count nobody could act on

190 closed a defect by measuring it and deciding not to fix it: `_caller_shape.harness.mjs`
bound `const sassert = sealPop.assert`, wrapped it in `sok()`, and its seven fixture claims
were invisible to a claim finder that matches the callee's *text*. The measurement found the
shape in one binding of nineteen and in **zero probes**, so the finder was left alone and the
blind spot was declared instead — `ALIAS_BLIND_CEILING = 1`. 190 §9.2 then handed over the
question it had deliberately not answered: **should that file keep an idiom no gate can read
at all, now that the alternative has been priced?**

It should not. The harness claims through `sealPop.assert.ok` directly — a spelling
`READS_AS_CLAIM` reads through its `\.assert\.` arm, which promotes `sok` by the ordinary
fixed point, the same mechanism that already made `ok`, `eq` and `run` readable forty lines
above it. **`ALIAS_BLIND_CEILING` is now 0**: the tree holds no unreadable binding anywhere,
and the rule that was a counted exemption is a hard zero.

🔴 **The cost was not the cost 190 predicted.** That handoff wrote "renaming `sassert` would
count seven more sites and cost nothing measured." Measured, the delta is **nine** — the
seven `sok(…)` sites, the `sealPop.assert.ok` inside `sok`, and `runSeal()`, which the fixed
point promotes once its body reaches a readable call. `claim-sites` 595 → 604. A carried item
that names a fix has usually not been measured, and this one named the fix *and* the number.

Three rules land with it, each because something would otherwise be unguarded:

* **`ALIAS_BINDINGS_FLOOR`** — a ceiling at zero is satisfied by a detector that finds
  nothing at all. The total binding population (18) is now floored separately, so
  "nothing unreadable" can be told from "nothing was read". 190 §30's rule applied to
  190's own rule.
* **`CLAIM_SITE_FLOORS["_caller_shape.harness.mjs"]` 25 → 45** — found by the reverse sweep.
  Narrowing `READS_AS_CLAIM` to `/^assert\.\w+$/` drops the file 50 → 41 and **nothing went
  red**, because 41 cleared a floor of 25. The alias ceiling guards the revert-by-alias; this
  guards the revert-by-predicate. Same collapse, second route.
* **`ORPHAN_CEILING`** — 180 §11.4's complaint, carried by nine handoffs. `orphan = sites -
  attributed` has been printed since 170 and floored by nothing: `ATTRIBUTED_FLOOR` bounds it
  only if `sites` is pinned too, and `sites` is free to grow. It read 472 when the complaint
  was written and 509 today, with every floor in that gate green the whole way. Pinned
  exactly, not with headroom.

### Fixed — the gate that pins floors could not pin a floor at zero

`floor_pin_gate.py` mutates each floor to `0` and requires its runner to redden. Writing `0`
over a constant that already ships at `0` is not a mutation — it runs an unmutated tree and
reports the row as **UNPINNED**. That is 181 §5's problem ("a rule whose healthy value is
zero cannot prove it ever counted") sitting inside the gate built to catch exactly that, and
it surfaced the moment `ALIAS_BLIND_CEILING` went to zero.

The mutant is now defined as *a different value*: `0` for anything non-zero, a large number
for a constant already at zero — the same question asked from the other side, since an
unpinned ceiling at zero can be raised to let everything through. A no-op guard fails loudly
rather than printing `ok` over a row it never touched.

## [1.66.0] — 2026-08-04

### Added — the alias the finder could not read, and the section under the file's own floor

189 handed over a defect with an instruction attached to it. `_caller_shape.harness.mjs`
binds `const sassert = sealPop.assert` and wraps it in `sok()`, so its seven fixture claims
are spelled `sassert.ok` — which the claim finder cannot read, because the character before
`assert` is `s` and not a dot. The helper fixed point cannot rescue the wrapper either: a
helper is promoted only when its body reaches a call the finder *already* reads. That whole
seal section reports zero claim sites while `CLAIM_SITE_FLOORS` stays satisfied by the
file's other two shapes. **A per-SECTION collapse underneath a per-FILE floor.**

🔴 **The instruction was to measure the shape before widening anything, and the measurement
is the finding.** Across all thirty files in `test-integration/`: **eleven bind a
population's `.assert`, and ten of them bind it to a name spelled exactly `assert`**, which
`^assert\.\w+$` reads. One binding in the whole directory is invisible, and **zero probes
have the shape**. So the regex is untouched — widening it would move `claim-sites`, every
per-file floor under it and the tautology gate's population on account of one instrument's
fixtures. The fixture claims stay deliberately unreadable; what changes is that they are now
**declared**.

**`SEAL_ORDER_ALIAS_BLIND`** counts every binding that holds a `.assert` member and asks
`READS_AS_CLAIM` — the finder's own predicate, now exported so the two cannot drift — whether
a call through it would be read. In a **probe** an unreadable binding is a failure outright.
In an instrument it is counted and held from above by `ALIAS_BLIND_CEILING = 1`: a ceiling
rather than a roster, because the harness trips nothing and a roster entry for a file that
trips nothing fires `SEAL_ORDER_ROSTER_STALE` the moment it lands.

**`SEAL_ORDER_SECTION_SILENT`** is the same finding from the other side, at the granularity
189 named. Measured first, again: of the 89 inter-seal regions, **six report zero claim sites
and all six are in the two instruments** — four fixture sections plus the two the alias
hides. Zero probe sections are empty, so over the population the region rules already use the
rule is green with no exclusions and still has teeth. It is what would have caught the harness
had the harness been a probe.

The reverse sweep is fourteen mutants, and three of them are dismissals: a detector that calls
every binding readable, one that calls every binding unreadable, and one that flags every
region. A fourth mutates the shared predicate as **drift** rather than deletion — re-spelling
it inside the finder — which is the cross-language question 178 asked, paid down in one file.

## [1.65.0] — 2026-08-04

### Added — the regions that announced nothing, and the roster that was one name short

`seal_order_gate.mjs`'s second rule reads the boundary of a section off its header or,
failing that, its first comment, and a claim above that boundary was written in the section
the seal just closed. **Six regions announce themselves in no way at all**, so the rule is
blind to them by construction. 186 measured them and floored them; 187 and 188 carried the
note unchanged.

**Read first, and the reading split them 5/1.** Five are probe regions — `cs-dap-plane` ×2,
`runtime-peers`, `runtime-screenshot`, `verification-family` — and every one is correctly
attributed: a tight run of statements whose claims are all about the very thing the next
seal names. Nothing to fix in any of them.

🔴 **The sixth is `_caller_shape.harness.mjs`, and it documents the opposite idiom in its
own words:** *"Verified in the NEXT section on purpose: a claim made after the last seal
belongs to no section and is counted in the total."* The premise all three region rules rest
on — a claim between two seals was written for the second — is false there deliberately,
because that file is a fixture for the counting machinery rather than a narrative of a live
system. And `NOT_A_PROBE` had already said exactly that about the *other* instrument, one
file over, in prose: *"a blank line between sections is a PROBE idiom and this file is not a
probe."* **The roster was one name short and nothing could see it** — the harness gets away
with it only because its fixture claims are spelled `sassert.ok`, which the claim finder
cannot read.

So the region population is now **probe files only**, derived from the same `_*` convention
188 §6 gave the header rule. 89 → 82 regions, announced 83 → 77, and **not one judged site
lost**: both instruments contributed zero. The floor moved down because the population
narrowed, not because coverage fell.

**And the residue got a rule.** Measured across all 89 regions before it was written: every
silent region is a *single unbroken paragraph*, while 55 of the 83 announced ones are not —
so it discriminates. The blank line is already this gate's own section separator (the
`SEAL_ORDER_TRAILING` rule is built on it), which makes a one-paragraph silent region
unambiguous and a **multi-paragraph** one a section break the author drew with the separator
and announced with nothing. That is `SEAL_ORDER_SILENT_SPLIT`: zero on this tree, planted in
the self-test, and swept.

`SILENT_REGIONS_CEILING = 5` holds the count from **above** — the first ceiling in
`floor_pin_gate.py`'s table. The five were read one at a time and that reading is what
licenses passing over them; a sixth is a region nobody has read. 180 §11.4's complaint about
a number floored from one side only, seven sessions old, answered where it cost nothing.

🔴 **The reverse sweep found two things the tree could not.** The exclusion was applied to
the region *count* and to the per-file *judgement*, and restoring the judgement half changed
no output at all — the one excused instrument happens to have no unannounced site, so that
guard was dead code that would come alive on the day one grew. It is now asserted with the
same source under two filenames. And a claim about the roster cannot be tested by neutering
the claim; the mutant plants a probe *in* the roster instead.

## [1.64.0] — 2026-08-04

### Added — the statements that resisted, and the two lists that were never one number

**The inherited number was wrong.** `control_gate.py` printed, on every green run, *"23 of
those are covered by `scope_gate.py`'s blinded runs (**stated, not re-derived here**)"*. 186
measured 23 statements executed by *anything*, with a recording shim; the comment restated
that as 23 covered by `scope_gate` specifically, and the next handoff subtracted it to size
the remaining work. Re-derived against `scope_gate`'s own twenty-five mutants: **19**. The
residue was **34**, not ~30.

🔴 **The fix is to derive it, and the measurement was already paid for.** `scope_gate.py`
runs those twenty-five mutants every CI run and discarded every one of their outputs, keeping
only the exit code. It now reads them, and prints `SCOPE_GATE_STATEMENTS` with a floor of its
own. `control_gate.py` no longer asserts anybody else's coverage. 184's rule was *a number an
instrument prints and no gate reads is an unasked question*; this is one turn further down —
an **output** an instrument produces and no gate reads at all.

**Twenty-four new controls, 17 → 41 of 72 statements, across nineteen checks.** Three
families: roster-hygiene statements, where `contract_check.py`'s own roster *is* the subject;
derived-side statements, where moving the code's number is the same disagreement as moving
the prose and carries no literal to go stale; and tree edits, where the subject really is a
shipped file.

🔴 **And five statements resisted — none for the reason the handoff predicted.** It expected
*no possible tree edit → the check cannot fail → delete it*. All five have obvious tree edits.

- **check 12's recipe-count comparison had an empty population.** No doc stated a recipe
  count at all, so `0 count claim(s) checked` printed on every green run and nothing could
  disagree with anything. Check 10 carries `RESOURCE_COUNT_REQUIRED` for precisely this, and
  check 12 — which supplied check 10 with its *roster* requirement — never got the *count*
  one back. Not deleted and not counted: **given a population** (`RECIPE_COUNT_REQUIRED`).
- **checks 18/19 derive their population from `git ls-files`, not from disk.** Moving a
  `.uid` sidecar aside changes nothing; the file is still tracked. That is 187's own
  corollary about the local `contract_check` and an unstaged file, answering its own question
  one check over — and it is why both rows are roster edits rather than tree edits.
- **three statements carry no string literal of their own** — the wire canary, and two that
  forward a list built elsewhere. Every one has a tree edit that reddens it; what none can
  have is a *fingerprint*, since the static resolver matches against the constants under the
  call. They are invisible to this gate **by construction**, and are now counted and floored
  rather than quietly subtracted.

### Added — a header is required of a probe, and the exclusion is derived

187 left five sealing files carrying no grep-able marker header, floored and printed but not
closed, with one instruction: **read them first**, because two may be instruments and that
would make this a roster-with-a-reason rather than five edits.

Read. **Three are probes** — `cs-dap-plane`, `tree-shape` and `vcs` each declare a
`Population`, seal 8–11 families and print every marker; they were missing a header for no
reason beyond the order they were written in. All three now carry one. **Two are
instruments**: `_caller_shape.harness.mjs` is 183's live axis, `_population.selftest.mjs` is
the gate on the gate. Neither has families a reader would grep for.

🔴 **So `markers === null` is now `MARKER_NO_HEADER` for a probe, and the exclusion is
derived from the name.** The two instruments are the only two entries in the directory
beginning with `_`, which is the convention every file in it already follows — so the rule is
*every sealing file not named `_*` must carry a header*. A new probe is covered the moment it
lands and nobody maintains a list. That is 187's `MARKER_PHANTOM` reasoning — findability
rather than a roster — applied to files instead of tokens. Coverage **6/6 → 9/9** files,
**61 → 91** families.

### Fixed — anchors that a normal change outruns

`host.drift` anchored on the literal `> **npm 1.62.0 ·` and cutting 1.63.0 moved it, so CI
went red on the release commit itself. Anchors now carry `{V}` and `{TESTS}`, resolved
against the **source of truth** rather than the file being mutated, and `_self_check()`
refuses any row that spells either value out.

### The reverse sweep, and what it caught

**`MUTATE188` pass=17 fail=0 declared-green=0** — but **five mutants survived the first
run**, and every one un-fixed a branch of *this session's own new code*. On a healthy tree
those branches are empty, so deleting them was invisible to every live run and the gate
stayed green over an instrument with its detection removed.

The three detectors — the derived-literal rule, the exactly-once anchor guard, and the
unfingerprintable set — are now pure functions, each fed an input in `_self_check()` that it
**must** flag. That is 176's rule, which `gate_failed` was lifted out for, arriving one level
down: at the detectors instead of at the verdict. 🔴 **The residual no self-check can close —
deleting the whole block — is written into the file rather than left to be discovered.**

## [1.63.0] — 2026-08-04

### Added — the two lists that were never the same list

186 §8 asked 185's one-rule-two-spellings question of these probes and reported the answer
as a defect class: six of the eleven sealing files print their markers in a grep-able
header comment **and** declare them in the `Population` manifest, and **zero of six
agreed** — eight families missing from a header, five markers "advertised that are not
families", three of them called the residue of 184's own fix.

🔴 **187 re-measured before writing the rule, and the second measurement killed the
first.** `host/_to_delete/markerspike187.mjs` classified every header token on the axis
that matters to a reader — *does grepping for it find anything?*

```
family AND printed                                              59
printed, deliberately NOT a family (_PING, _RESULT, …)          16
🔴 PHANTOM — in the header, neither a family nor in the file      0
🔴 FAMILY ABSENT FROM ITS OWN HEADER                              2
```

Every "phantom" is a real, greppable line. `F6_PEERS_SPAWN`, `F6_PEERS_FROZEN`,
`F6_PEERS_CONVERGE`, `NODE_LIVE_SCENE` and `RENDER_LIVE_SCENE` are all printed by their own
probes. **The header is *what a reader can grep for* and the manifest is *what is sealed as
a family*, and the header is a superset by design.** The equality rule 186 named would have
demanded sixteen deletions of accurate documentation, or sixteen fake families to make a
classifier happy.

So the rule shipped is **asymmetric**, and it is a third rule in `seal_order_gate.mjs`
rather than a new gate — same population, same instrument, and **no new CI step**:

- **`MARKER_UNLISTED`** — every family in the manifest must appear in the header. Two did
  not: `ANIM_LIVE_LEFT_CLEAN` and `NODE_LIVE_NO_LEAK`, each a whole section a reader greps
  the documented list for and does not find. Both headers corrected.
- **`MARKER_PHANTOM`** — every token in the header must be findable in the file below it.
  **Measured at zero and shipped anyway**, because it is what excludes `_PING` and
  `_RESULT` *by construction* rather than by a roster — 186's own instruction, and 174 §5's
  reason: an exclusion that costs nothing to write is an exclusion nobody re-reads.

**And its coverage is floored on the way in**, for the second session running.
`MARKER_HEADER_FILES_FLOOR = 6` of eleven — five sealing files carry no header and this
rule reads nothing in them, so a probe that *deletes* its header does not fail the rule, it
removes itself from it. `HEADER_FAMILY_FLOOR = 55` catches the other half of the same
collapse: every header still present with the manifests emptied. Both are swept by
`floor_pin_gate.py` (41 → **43** targets) rather than exempted, because their runner is a
self-test that touches nothing.

The self-test grows 85 → **101 claims**, and the case that decided the rule's shape is the
one that must **not** fire: a header listing two families plus a printed `_PING` and
`_RESULT` is clean. Deleting the line that prints `_PING` turns it into a phantom — which
is the entire design, stated as one case. Reverse sweep **pass=8 fail=0
declared-green=0**, two of them un-fixing the two corrected headers so the edits are pinned
by something that runs rather than by a reviewer's memory.

### Added — the checks that had never once been allowed to fail

182 §11.3 asked what `CHECKS_RUN 20/20` actually proves, and it stayed open for four
sessions. 186 answered it — after re-asking it, because the question as written could not
be answered at all:

```
70 errors.append/extend statement(s) in contract_check.py
EXECUTED BY SOMETHING: 23 of 70      NEVER EXECUTED BY ANYTHING: 47
five whole checks at zero: 17, 22, 3, 11c, host
```

`CHECKS_RUN` counts **blocks that reach their own end**. Two thirds of the failure
statements inside those blocks had never run, and from outside, a check whose every failure
statement is unexecuted is indistinguishable from a check that cannot fail.

🔴 **The counter is not the fix, and a finer counter is the same mistake one level down.**
A statement that only runs when the tree is broken cannot be covered by any run over a
healthy tree, at any resolution. What covers it is a **positive control**: a mutation that
breaks the tree the way the check says it is guarding against, asserted to make exactly
that statement fire. `scope_gate.py` has been one for 25 enumerators since 172 — its
blinded runs are where all 23 of the executed statements came from.

`scripts/control_gate.py` is that idea pointed at the **subject** instead of the finder, as
a step in the existing `test` job — **no 27th CI job, twenty-fifth session running.**

**Seventeen controls, one per statement, across all five checks that were at zero.** The
handoff's question was asked of each statement before a line of the gate was written —
*what one-line tree edit should redden it?* — because the alternative finding was live and
had an instruction attached: a statement with no such edit is a check that cannot fail, and
should be **deleted rather than counted**. All seventeen had one; none qualified.

Three properties are asserted per control, and the third is what makes it a control:

- **the run goes red** — the check noticed;
- **the run executed** — it printed the report marker, so red is a verdict and not a crash
  on the way in (181's discriminator, `scope_gate.py`'s reason for the same line);
- **the expected statement fired** — matched on a fingerprint that resolves, *statically*,
  to exactly one `errors.append` in the file. Without this, any mutation that reddened the
  run for any reason would count as covering whatever statement its row claims, and the
  harness would be measuring itself.

**Both ends of the ratio are floored.** `CONTROLLED_FLOOR = 17` catches a deleted row —
every remaining row still passes, and the only thing that moves is a number nobody reads.
`STATEMENT_FLOOR = 70` catches the other direction: *17 of 70* improves to *17 of 17* by
deleting sixty-eight checks, and a ratio with only its numerator pinned gets better as the
thing it measures gets smaller. Both are exempt in `floor_pin_gate.py` **with the reason
written out** — their runner would be this gate, which mutates the working tree, and
nesting one tree-mutating gate inside another is 178 §11.4 — and both are pinned in-file by
a `_self_check()` that fails if either is not positive.

**The blind spot is printed on green runs too.** 17 of 70 have a control here; 23 more are
covered by `scope_gate.py` (stated, not re-derived — the shim that measures it is far too
heavy for a CI step); **~30 statements are covered by nothing at all**, and that number is
in the gate's own output rather than in a handoff.

The reverse sweep is **pass=14 fail=0 declared-green=0**, and four of the fourteen matter
more than the other ten: they un-fix `contract_check.py` itself — neutering the duplicate
tool-name branch, the `uid://` autoload branch that CI killed in 90 seconds in session 148,
check 22's own roster drift, and one failure statement *deleted outright*. A control table
that stays green over a check with its detection removed is a table measuring its own rows.

### Fixed — the control the release itself broke

🔴 **CI went red on this release commit, at the control gate #216 shipped one commit
earlier.** `host.drift` — the control proving check 14 notices a stale version stamp —
anchored on the literal `> **npm 1.62.0 ·` in `README.md`, and cutting 1.63.0 moved it:

```
🔴 CONTROL_GATE_ANCHOR host.drift: 0 occurrence(s) of the anchor in README.md
```

🟢 **The anchor assertion is why that was a failure rather than a silent pass.** A control
whose `old` no longer matches applies nothing; without the exactly-once guard the sweep
would have printed `ok` over a mutation it never made. The guard worked — the anchor was
wrong.

**And it is a class, not a row.** `11c.drift` anchors on `684-test suite`, which moves the
day anybody adds a test. Both embedded a number the tree *derives* somewhere else, which
pins the control to a moment instead of to the invariant it tests.

Anchors may now carry `{V}` (the live host version, from `host/package.json`) and
`{TESTS}` (the live count of `test(…)`/`it(…)` declarations under `host/test` — check
11c's own population), resolved against the **source of truth** rather than against the
file being mutated, which would make the anchor trivially self-satisfying and take the
exactly-once guard away. `host.drift` now substitutes `0.0.0`, a literal that cannot
become correct by accident, rather than "the previous version".

🔴 **`_self_check()` refuses any row whose literal anchor embeds either derived value**, so
the next author who types today's version into a control is told at authoring time instead
of one release later.

## [1.62.0] — 2026-08-04

### Added — the section that existed in the source and had no marker of its own

185 shipped `seal_order_gate.mjs` and wrote down, in its own header and its own self-test,
the case it could not see: a claim written a *paragraph* below its marker is drained by the
next seal exactly as one written directly under it. 185 §10.2 asked the follow-up rather
than assuming the class was closed:

> The open question: is there any signal that separates "the author meant this for the
> previous marker" from "this is the next section"? Start by measuring how many claims sit
> between a seal and the next seal across the tree.

**There is one, and three throwaway measurements were needed to find it** — the first
candidate was wrong and the second was wrong about *why*:

```
sectionsignal186   rule-line / numbered headers      63 of 86 regions   9 claims above one
headless186        read the 23 "headless" regions -> every one opens with a PROSE comment
introcomment186    the first comment in the region  81 of 86 regions   8 claims above one
```

Neither candidate alone was right, and the disagreement is the finding: the two signals
caught *different* defects. So the boundary of the next section is **its header if it has
one and its first comment otherwise**, and a claim above that boundary was written in the
section the seal just closed — however many blank lines are in between.

🔴 **The header tier has to win where both exist, and that is asserted rather than
assumed.** If a numbered header falls between two seals, seal B is inside the next numbered
section by construction and everything above the header is in seal A's — a structural
reading. A prose comment is only the idiom these files keep, and a claim can be introduced
by its own paragraph while still sitting inside the section above. That is exactly
`animation-lane`'s case, which the comment tier alone reads as clean.

**Fourteen claims across four regions in two probes, and hand-reading all four found the
same defect every time: a section that existed in the source, was commented and asserted
like one, and had no marker of its own.**

| probe | the section | was counted onto |
|---|---|---|
| `animation-lane` | the idempotent re-stop (#146) | `ANIM_LIVE_SWITCH` |
| `verification-family` | the red control for `assert_node_state` | `VERIFY_LIVE_NODE_LIVE` |
| `verification-family` | `present:false` and its inverse | `VERIFY_LIVE_TEXT_HIDDEN` |
| `verification-family` | live retexting, with its restore claim | `VERIFY_LIVE_DIGEST` |

`verification-family` gains `_NODE_RED`, `_TEXT_ABSENT` and `_TEXT_LIVE` — the file already
had `_STRUCT_RED` and `_PERF_RED`, so the red control for the third tool was the sibling
nobody noticed was missing. **`claims: 100` does not move**: three sections changed hands,
none was added, and the exact claim total is what proves it.

- **The rule's own coverage is floored** (`ANNOUNCED_REGIONS_FLOOR`, 83 of 89 regions
  announced). Six regions announce themselves in no way at all and this rule reads nothing
  in them — a probe that stops announcing its sections does not *fail* the rule, it removes
  itself from it, and the gate would print ok over a shrinking population. 184 §10.6's
  complaint about one-sided floors, paid on the way in rather than four sessions later.
- **One claim, one finding.** A claim already named by the shape rule is not named again by
  this one, or a reader who fixes the first report discovers the second on the next run.
- **A stale exemption is now judged on both rules.** The first draft read only the shape
  rule and would have told a maintainer to delete an entry the new rule was still earning.

## [1.61.0] — 2026-08-04

### Fixed — the argument that reaches the assertion, and the population it turned out to sit on

184 §8 caught its own new code with its own reverse sweep and then declined to patch it:
`tautology_gate.mjs` classifies the **assertion**, not the argument that reaches it. A helper
whose guard is `actual !== expected` is read as a value comparison for *every* call site,
however vacuous the operands are one frame up — so replacing a reading with a literal left
the gate green. 184 wrote down what to measure first instead of shipping a rule on a hunch:

> The question is not "flag constant operands" — that false-fails every honest
> `assert.equal(count, 3)`. It is: for a helper that the gate treats as a claim site, can
> anything tell whether its CALLERS vary the reading? Start by counting how many claim sites
> in the tree are reached through a comparison helper rather than written inline.

**Measured: 30 of 3591 — 0.8%, across three helpers in two files.** All three already vary
their readings (21, 13 and 9 distinct arguments across their call sites), so the proposed
proxy would have passed everything that exists and could only bite on a future regression.
🔴 **So the helper is not the defect, and asking the shipped classifier directly said where
the defect is:**

```
assert.equal(3, 3)     ->  SHAPE  "both sides are the same expression"   flagged
assert.ok(84 !== 84)   ->  VALUE  "compared to a value"                  GREEN
```

**The rule already existed. It was enforced in one spelling and not the other** —
`conditionOf`'s `equal` / `deepEqual` cases have tested identical sides since 169;
`classifyLeaf`'s comparison branch never had it, and that branch is the path taken by every
`assert.ok(a === b)`, every ternary condition and **every helper guard**. `notEqual` never
had it in either spelling. That is 179's rule inside the instrument 179's rule was written
for: *an instrument enforces its rules where they were written, not where its population
comes from.*

- **Both operands literal, not merely identical — and the tree is why.** Across 2006
  comparisons exactly **one** has textually identical sides, and it is a *real claim*:
  `_population.selftest.mjs:197` asserts `assert.ok === assert.ok`, where `assert` is a
  memoising **Proxy**, so evaluating the same text twice need not give the same value. A
  rule reading "identical sides are vacuous" would have reddened the single honest instance
  of its own shape. A literal cannot be a proxy trap and cannot be the `x !== x` NaN idiom,
  so both counterexamples are excluded **by construction** rather than by an exemption
  anyone has to maintain.
- **And the half the helper hides, which is G2 itself.** A call to a local pass/fail helper
  where *every* non-marker argument is decided at authoring time is vacuous regardless of
  the guard — the caller determined both sides. `tcheck(census(dir).files, 84)` is untouched;
  `tcheck(84, 84)` is now flagged, and the report names the **call site's** arguments so the
  reader is sent to the right frame.

Measured cost on the tree: **zero sites** on both rules, `TAUT_VACUOUS 0` unchanged. 184's
own framing was one word from the rule that works — **ALL** the operands, not **ANY**.

### Added — the marker written above its own claims, gated where the defect actually lives

184 §5 found four markers in `runtime-peers.integration.mjs` sealing the section *before*
them: `Population.seal()` attributes every claim made since the **previous** seal, so a
marker written above its own assertions owns the section before it and hands its own to the
next one. Nothing goes unattributed when that happens — so `report()`'s sixth gate, the
`unsealed` count 184 had just added, is blind to it by construction. What breaks is the
report's **aim**: delete section 5's three claims and it is `F6_PEERS_CEILING` that reads
vacuous, one section past the one that broke. 184 fixed the four instances with a 40-line
regex scan that called itself heuristic in its own docstring, and left the class.

`scripts/seal_order_gate.mjs`, with a self-test, both as steps in the existing `test` job —
**no 27th CI job, twenty-third session running.**

🔴 **And no runtime gate could have covered it, which is what decided the shape.** A seal
drains what has *already* happened, so every claim it takes preceded it in time; the defect
is entirely in the source's reading. The call-site reading was measured before being
rejected rather than dismissed: the outermost own-file stack frame is the async IIFE's own
invocation line and **vanishes across an `await`**, and the innermost is the *helper's body*
line for any claim made inside one — of which there are **thirteen defined below the first
seal of their own file**, across six probes. A rule reading innermost frames would have
called every claim they make a violation.

- **The finder had to be measured before the rule.** 171 §2: a file reporting zero claim
  sites either makes none or asserts in an idiom the finder cannot read. `cs-dap-plane` is
  the live proof — eleven seals and not one `assert.` call anywhere, because it keeps a
  local `claim(name, cond)` arrow. So the finder resolves local claim helpers to a fixed
  point, and `CLAIM_SITE_FLOORS` gives every file a measured floor: a probe whose idiom this
  cannot read **reddens instead of passing at zero sites**.
- **It catches the real thing.** Run against `runtime-peers.integration.mjs` at `df5e913` —
  the commit before 184 fixed it — the gate reports **three markers and six claims**, where
  the regex scan's two-line window found four.
- **What it does not catch is written into its own self-test.** The rule bans a *shape*: a
  claim under a marker with no blank line between them. The same defect a paragraph away is
  invisible, and that dismissal is asserted as a case, so it cannot be discovered as a
  surprise later.
- **One exemption, and it costs a written reason** (174 §5). `_population.selftest.mjs`
  builds fixtures one compressed line per section, so consecutive claims and seals are
  separate fixtures rather than a section and its marker. It still counts toward the roster,
  the seal floor and its own claim-site floor — an exemption should not buy a collapsed
  finder. A dead entry and a *stale* one both fail the gate.

## [1.60.0] — 2026-08-04

### Fixed — the one number in the population line that nothing read, and the four sections it was hiding

183 §12.3 handed this over as a one-liner: a claim made after the last seal belongs to no
section, is counted in the total, and prints as `unsealed=N` — past all five of `report()`'s
gates. **It is 169's tautology inside the instrument built to catch it.** The number was
written for a human and consumed by nothing, so nobody had ever asked what it should be.

`report()` gains a sixth gate, and the count is **declared** rather than assumed:

```
claims=61/61 families=11/11 vacuous=0 partial=0 unsealed=0/0
```

Exact on both sides. Upward drift is claims leaking out of their families to hold the claim
floor up on behalf of nothing; downward drift is a banner claim quietly ceasing to be made.
A non-zero declaration **costs a written reason** or the constructor refuses to build — 183 §7's
rule, one file over: *"a filename prefix costs nothing and is invisible in the output."* And
the field prints in the healthy case too, with both numbers; it used to appear only when
non-zero, so the value a passing run should show was in no log anywhere.

🔴 **Then the gate was pointed at the fourteen live probes, and four sections came back.**

- **`animation-lane` and `verification-family` both end in a "left clean" section that no
  marker sealed** — six claims and three claims respectively, the #146 restore checks that
  stop a probe leaving a frozen clock or a mutated fixture behind for whatever runs next.
  They counted toward `claims: 61` and `claims: 100` and belonged to no family, so deleting
  *some* of them was invisible: only deleting enough to breach the total would have said
  anything at all. Sealed as the sections they are, which also gives them vacuity coverage.
- **`runtime-peers` asserted its idempotent-stop claim AFTER its own seal**, so the marker's
  detail line read `repeat stop = no-op` while the assertion behind those words was
  attributed to nothing.
- **`tabletop-plane` legitimately makes two** — its reachability and registration banners —
  and its own source said so in a *comment*. A comment is not a gate. Declared, with the
  reason moved into the declaration, so a third one appearing is a failure.

🔴 **And a fifth finding the new gate cannot see, measured while looking for it.** `seal()`
attributes every claim made since the *previous* seal, so a marker written above its own
assertions owns the section before it and hands its own to the next one. Every marker in
`runtime-peers` was off by one section this way: nothing went unattributed, but delete section
5's three claims and it is `F6_PEERS_CEILING` that reads vacuous — one section past the one
that broke. Four claims, all in that file, all moved below their markers.

### Added — the TALLY shape gets a live caller, and `claim(family)`'s explicit arm gets a witness

183 §12.2. `claim()` has two arms: with an explicit family it attributes immediately, with
none it is held until a marker drains it. `_caller_shape.harness.mjs` drove the WRAPPED-FAMILY
and SEAL instances, both of which take the second arm — so the first, the one `lsp-plane` and
`cs-lsp-plane` run on, **was exercised by nothing live at all**. Delete it and both instances
stayed green.

A third `Population` instance drives it, and its verdicts come from a Map this file builds at
the same call sites: *counted* and *counted onto the family it named* are two verdicts rather
than one. It also carries one banner claim on purpose, reproducing `tabletop-plane`'s shape,
which is what puts the new gate on a live axis instead of only in the self-test — and its
verification claims are made from **inside** a family, because a harness that made them
outside every family would trip the very gate it is there to drive.

🔴 **And the harness's own roster needed a floor, which is 183 §9 turned on this file.**
Delete the tally instance and its entry from the roster — the same three lines `LATE_LIVE`
took — and the harness drops from 43 claims to 31, prints two healthy population lines
instead of three, and says nothing, because `claims: 20` has the headroom to absorb it.
`POPULATION_LINES_FLOOR = 3`, one per shape `_population.mjs` has. `floor_pin_gate.py`
discovered it unswept on the first run and then found it unpinned on the second: a floor
cannot redden a roster that is still complete, so the value is pinned inside the run as well.
Its `TARGET_FLOOR` goes 36 → 37.

## [1.59.0] — 2026-08-03

### Added — the live axis for the three instruments whose only caller boots the editor

182 §11.2 handed over the remaining half of the late blind in one sentence: `_workspace.mjs`,
`_png.mjs` and `_population.mjs` are imported only by probes that boot the Godot editor under
Xvfb, so their late blind ran against the SELF-TEST — and the self-test cannot reproduce the
caller's shape. The axis that found every defect in 182 was the live one, and it was
unavailable to exactly the three files 181 §6's defect lived in.

`host/test-integration/_caller_shape.harness.mjs` is that axis: a headless SUBSTITUTE caller
that reproduces the one property a self-test structurally cannot have —

```
t=0   derive a population and FLOOR it          (snapshotDir -> 84 files >= 70)
...   do the work the floor was permission for  (write 30, modify one, delete one)
t=1   RE-DERIVE and take a verdict from that    (restoreDir + diffDir -> clean?)
```

— over a temp tree and two PNGs it authored itself. It is not the authoring probe and does
not claim the probe's coverage; what it adds that the probe cannot have is GROUND TRUTH, so
every verdict is taken from a reading `instrument_gate.py` never blinds: an independent
`census()` with its own recursion and its own hash, an independent claim count, and an
authored distinct-colour count. **12 late blinds are constructible on the new axis where
there were 0. Eleven produce a wrong observable and are caught.**

🔴 **The one green is a whole CLASS, and it is 182 §11.27's question answered.** `_closeOpen()`
exists to file a section that closed having asserted nothing, and a healthy caller has none —
so the function's entire output on a healthy run is the empty set, which is exactly what the
blind returns. No live axis can ever judge it, however the caller is shaped, and its coverage
has to be the self-test. Declared with that reason, and the gate fails if it starts reddening.

🔴 **`report()` was the same shape until the harness checked the LINE rather than the return
value.** Its failure list is empty on a healthy run too — but the caller depends on something
else it does: it PRINTS the population line, and that line, not the return value, is what the
CI job logs are grepped for. Nothing anywhere asserted that it prints.

🔴 **`LATE_LIVE` needed a floor of its own, and the reverse sweep is why.** Deleting the three
new entries takes the constructed count from 82 to 70 — still clear of `LATE_CONSTRUCTED_FLOOR`,
because that floor is a backstop on the INJECTOR and not on the roster. Two collapses, two
numbers: `LATE_LIVE_FLOOR = 8`, pinned in `_self_check()` by asserting the branch bites on an
empty roster. `LATE_CONSTRUCTED_FLOOR` 55 → 65, measured 82.

### Fixed — the tautology gate read files by NAME, so 174 fixed the instance and left the class

The directory walk filtered `!f.startsWith("_") || f.endsWith(".selftest.mjs")` — a whitelist
keyed on a NAMING CONVENTION. Every underscore-prefixed file that is not a `.selftest.mjs` was
exempt by construction, the scope line read the same either way, and the gate's own comment
four lines above said what was wrong with exactly that: *"NO_CLAIMS_EXPECTED costs a written
reason; a filename prefix costs nothing and is invisible in the output."*

This is 182 §9 one gate over — `floor_pin_gate.py`'s DISCOVER walk was scoped to `.mjs` rather
than to "is a floor", so a Python floor sat outside it. **Same defect, second spelling: the
discovery half scoped to a name instead of to the property.** A file added this session that
is nothing but claims would have been swept by nothing while the gate printed ok.

Inverted rather than extended: every `.mjs`/`.ts` is read, and the only exemption is the one
that costs a written reason. The four helper modules are on `NO_CLAIMS_EXPECTED` now, each
quoting its own header.

🔴 **And the exclusion was invisible because nothing floored the FILE COUNT.** `FLOORS` counts
claim SITES, so five files silently dropping out is absorbed by the headroom of the ones that
remain — and an unread file cannot be reported as silent. `FILE_FLOORS = { test: 45,
"test-integration": 28, scripts: 8, ".": 12 }`, measured 47 / 30 / 8 / 12, printed on
`TAUT_SCOPE_FILES` as `read=N/floor`, pinned by key and by value in the self-test and swept by
`floor_pin_gate.py`. Restoring the old filter now reddens the gate; before this it did not.

## [1.58.0] — 2026-08-03

### Added — the late blind, put to all 51 targets, and the four instruments that could answer once and stop

181 §6 found `_workspace.mjs`'s floor sitting on the FIRST of three walks and handed over
the generalisation: *every "blind the enumerator" target in `instrument_gate.py` replaces a
whole function body, so it blinds for the whole run. Ask each of the 51 whether anything
between the floor and the verdict re-derives.*

The answer is mechanical and needs no new constant — the same target table behind a call
counter, so call 1 answers honestly and satisfies whatever floor is above it and every call
after it is the blind:

```
function walk(...) { if (++n > 1) { return; }   ...the real body...
```

**Two axes, and the one that found everything is the LIVE gate rather than the self-test.**
For four of the eight instruments the shipped gate IS the caller and runs headless. 84 runs:

```
A:gate  51 targets   1 green (declared)          14 not constructible (called once)
B:live  33 targets   6 green — FOUR of them real
```

🔴 **`boundary_gate.mjs` derives two populations once per FILE and counted neither.**
`helpers()` and `conduits()` run inside the walk, ninety-nine times each, and every one of
the seven floors above them pins a population derived ONCE for the whole tree:

```
conduits blinded from call 2  ->  judged 185 -> 162, floor 150, `ok`, exit 0
helpers  blinded from call 2  ->  nonthrowing 18 -> 0, judged 185 -> 180, exit 0
```

`HELPER_FLOOR = 350` (measured 511) and `CONDUIT_FLOOR = 15` (measured 24), on their own
line. **`nonthrowing` is not the thing to floor** even though it collapsed hardest: it
counts receivers REFUSED, so honest work on those eighteen drives it toward zero and a floor
there would fire on the fix. What only a working resolver can produce is what it RESOLVED.

🔴 **`tautology_gate.mjs` could classify one leaf of 1605 and print byte-identical output.**
Every number the gate printed counted claim SITES — what the FINDER found. Nothing counted a
CLASSIFICATION, so `classifyLeaf` blinded to `{ kind: "VALUE" }` (the answer a healthy leaf
gives) moved nothing at all, and neither did `leaves` over 1216 calls. A floor cannot sit on
`vacuous`, `every` or `offender` — their healthy value is zero, which is 181 §5's problem —
but `allShape` and `precondition` are healthy, non-zero and unreachable without a working
classifier: `SHAPED_FLOOR = 80` (measured 116), `PRECONDITION_FLOOR = 40` (measured 61).

🟢 **Two greens are structural, and the reason is the finding.** `collapsed()` returns the
answer a healthy tree gives, so a live run says nothing about it. `segments()` is measured,
not assumed: of 258 live cohort rows, **0** reach the cohort through the segment branch
(`hint_only=0 both=252 segments_only=0`) — it is there for camelCase names this surface does
not publish. Both are declared with a reason each rather than a name each, and the gate FAILS
if a declared-green target ever starts reddening.

🔴 **And the axis could be switched off in one line.** The reverse sweep's G15: make `late()`
return the text unmodified and every target files as *not constructible*, no problem is
raised, and the gate prints ok over an axis that measured nothing — the exact defect it was
built to find, in itself. `LATE_CONSTRUCTED_FLOOR = 55` (measured 70).

### Added — `CHECKS_RUN`: a check deleted takes its own errors with it (181 §11.3)

181 §5 closed the report WIRE. The other half stayed open: the twenty-six SCOPE floors count
POPULATIONS, not COMPARISONS, so a check deleted outright leaves every floor holding.
Measured by deleting each of the nineteen check blocks in turn — with 181 §4's discriminator,
because a `NameError` downstream and a violation are both `returncode != 0`:

```
caught_by_CHECKS_RUN=2   caught_other=0   crashed=17   still-green=0   of 19
…and the same two deletions with the counter itself removed:  BOTH STILL GREEN
```

The counter sits at the END of each block, so a check whose header survives while its body
goes is caught too — and the first placement got that wrong: two prose-only `# ---` sections
sit inside check 18/19, so `_ran("18/19")` was left behind by a deletion of its own code and
`measure182f` reported the block gone with ALL HARD CHECKS PASSED. Both halves are asserted:
the roster SET (a check renamed would not move a count) and a literal floor tied to the
roster size (181 §7 — a roster pinned by key is not a roster pinned).

`floor_pin_gate.py` grew a Python half to match: its DISCOVER walk was scoped to the
LANGUAGE rather than the property, so a floor written in Python was outside the gate by
construction and no line said so. 30 targets now, `CHECKS_RUN_FLOOR` among them, with the
three gate-own roster floors exempt with a reason each.

```
MUTATE182 pass=15 fail=0 declared-green=3
INSTRUMENT_GATE_LATE_CONSTRUCTED 70/55 · 0 undeclared green on either axis
BOUNDARY_GATE_PERFILE helper_defs=511/350 conduit_entries=24/15
TAUT_CLASSIFIED shaped=116/80 precondition=61/40
CHECKS_RUN 20/20 · FLOOR_PIN_GATE 30/30 · SCOPE_GATE 0 of 25
TAUT_SELFTEST 108 (was 94) · BOUNDARY_SELFTEST 143 (was 130)
```

## [1.57.0] — 2026-08-03

### Added — the same question put to the four instruments 179's list did not name, and to every floor in the tree

180 answered 179 §11.2 for five instruments and handed over two follow-ups: the same
question for the gates that were *not* on that list, and 180 §11.3 — *every `<` floor in
the tree, asked whether its own value is pinned.* Both were answered the way 180 answered
its own: by **neutralising the step and running it**, not by reading.

**`_png.mjs` is defended, and the reason is structural.** Collapsing its sampling
population can only *lower* `distinct`, so it can only turn the caller's `distinct > 1`
red. A black frame at 1 sampled pixel reads `distinct=1` and fails; a *good* frame at 1
pixel also reads `distinct=1` and fails. 179 §9's narrowing rule, opposite sign — and
saying so is part of the answer.

🔴 **`scope_gate.py` could report `0 of 25` having executed not one contract check.**
Its `run()` returned `p.returncode == 0 and "ALL HARD CHECKS PASSED"`, and every caller
read a `False` as *the check caught the mutant*. A mutant that does not COMPILE also exits
non-zero — Python exits 1 on a `SyntaxError` exactly as `contract_check.py` exits 1 on a
violation. Measured by breaking the injected text so that every mutant was uncompilable:

```
SCOPE_GATE_CONTROL ok — an unmutated copy passes, so a caught mutant means something
SCOPE_GATE_BLIND_COUNT 0 of 25
SCOPE_GATE ok — every derived population collapses LOUDLY        exit 0
```

`TARGET_FLOOR = 25` held. The CONTROL passed — because it covers the *unmutated* path and
the defect is on the mutated one. `run()` returns `(green, executed)` now, keyed on a
marker `contract_check.py` prints only if it reached its report, and that discriminator was
measured before being relied on: `MARKER_ABSENT_ON_A_REAL_CATCH 0 of 25`. A red run without
the marker is a harness failure, not a catch. The three-population verdict moved into
`gate_failed()` with a truth table asserting each reaches the exit code ALONE — 180 §7.1's
`combineFailed`, one file over, for the fourth session running.

🔴 **`contract_check.py`'s twenty-six SCOPE floors are all inputs.** (Twenty-six, not the
twenty-three 180 §11.2 estimated.) Leave every check running and make `errors` unable to
speak, and all twenty-six hold, `ALL HARD CHECKS PASSED`, exit 0. A floor cannot close it —
the healthy value is zero errors, so there is no number to be above — so the wire carries a
canary appended at the top and required to arrive at the report.

🔴 **`_workspace.mjs`: the caller's floor is on the FIRST walk, and there are three.**
`AUTH_SNAPSHOT_FILE_FLOOR = 70` pins `snapshotDir`, which runs before anything connects;
`restoreDir` and `diffDir` each walk again ~120 seconds later. Measured:

```
snapshot=6 (the floor is on THIS) · restore removed=0 · diff clean=true · added=0
…and the artefact was still on disk
```

`instrument_gate.py` blinds `walk` and IS caught — but a *global* blind empties the
snapshot too, so the floor catches that one, and the late blind was never constructible.
The module already holds two independent readings of the same tree: `walk()` enumerates,
`liveHash()` stats each snapshot path by name. They check each other now — *every snapshot
file `liveHash` says is still there must have been enumerated* — with no literal and
nothing to maintain. Lifted out as `blindWalk()` so the collapsed case is constructible
from three arguments (173's move for `ledgerScopeFailures`), and admitted as
`instrument_gate.py`'s seventh blind target for this module.

### Added — `floor_pin_gate.py`, and the six floors it found unpinned

180 §7.3 closed one instance of a defect that had four families. Swept:

```
FLOOR_VALUE_UNPINNED 6 of 25
  FLOORS.test · FLOORS."test-integration" · FLOORS.scripts · FLOORS."."
  _workspace.selftest.mjs SELFTEST_CLAIM_FLOOR · _population.selftest.mjs SELFTEST_CLAIM_FLOOR
```

`tautology_gate.selftest.mjs` pinned that roster's four KEYS — `Object.keys(FLOORS).length
=== 4`, each directory name present — and never a value, so `{ test: 0, "test-integration":
0, scripts: 0, ".": 0 }` satisfied every word of the assertion written to defend it. Those
are the same four floors 180 §4 reported as *held at their shipped values* while the gate
resolved nothing.

The gate has two halves, and the second is the one that would otherwise rot: **mutate**
(zero each floor, run the file that should notice, require red) and **discover** (find
every floor-shaped constant in the shipped tree and fail if one is not in the table). A
sweep whose target list is hand-maintained goes quiet as the tree grows. Five live-probe
floors are exempt with a reason each, not a name each (174 §5). A step in the existing
`host tests` job — no 27th job, EIGHTEENTH session running.

```
MUTATE181 pass=16 fail=0 declared-green=1
FLOOR_PIN_GATE 25 targets, floor 25, unswept 0
SCOPE_GATE 0 of 25 · never-ran 0        INSTRUMENT_GATE _workspace.mjs 0 of 7
WORKSPACE_SELFTEST 58 (was 47) · TAUT_SELFTEST 94 (was 93)
```

## [1.56.0] — 2026-08-03

### Added — the other four instruments asked 179 §11.2's question, and two could not answer it

179 added `JUDGED_FLOOR` and handed over: *six floors pinned this gate's inputs and none
pinned its output — no other instrument in this repo has been asked that question.* The
question was put to all five, by **neutralising each one's resolution step and running
it**, rather than by reading for a `*_FLOOR` constant.

Three answered well. `verdict_gate.mjs` reddens on all three of its axes (`subjects=0`,
`sites=0`, `dirs=1`). `path-cohort.mjs` floors the enumerator's five output populations —
173 did this work already. `_population.mjs` floors `total`, which is the output.

**`tautology_gate.mjs` did not.** `FLOORS` pins claim sites the *finder found*. Between
that and the verdict sits attribution:

```js
const k = c.marker ? `${c.file}::${c.marker}` : c.owner ? … : null;
if (!k) continue;                          // silent — and 473 of 3491 already take it
```

and `vacuous`, the class this gate exists for, is scored over the blocks that survive.
Forcing that `continue` for every claim left **all four directory floors at their shipped
values** and printed

```
TAUT_CLAIM_SITES 3465 across 0 unit(s) — 472 attributed to neither …
TAUT_GATE ok — 3465 claim sites, 0 blocks, none vacuous
```

and exited 0. `UNIT_FLOOR = 1200` (measured 1433) and `ATTRIBUTED_FLOOR = 2500` (measured
3018) — **two numbers, because they are two collapses.** Keeping every unit while each
keeps one claim leaves `units=1408/1200 ok` and takes claims to 1408; one number would
have hidden that behind the other (171 §10.22).

**`_path_ledger.mjs` did not either, and the hole was already written down in it.**
`LEDGER_SCOPE` floors the gate's *own roster* — classes and canaries — and nothing floored
the two sides it *compares*. The file's own prose, above `LEDGER_CANARIES`, says *"a
session that REGENERATED the ledger from a blind enumerator would take both green
together."* It had never been executed. Executed, it is true:

```
live=2 ledger=2 unclassified=0 stale=0 lost=0 scope=0   EVERY CLAIM PASSES
-> the probe prints "all 2 path-like parameters in the live surface are classified"
```

Two of 258. 🔴 **And the floor already existed — in the other caller.**
`scripts/path-cohort.mjs` pins `sum.total >= 250` before calling `comparePathLedger`;
`authoring-plane.integration.mjs` calls the same function with nothing under it. That is
179's own meta-rule word for word — *an instrument enforces its rules where they were
written, not where its population comes from* — so `LEDGER_POPULATION = { live: 220,
ledger: 220 }` lives at the comparison, and both callers inherit it instead of one of them
remembering.

### Fixed — the wire, which the reverse sweep caught after the floors looked finished

`if (scope.failed) failed = true;` inline in `main()`. Mutants that deleted that line, and
that stopped `judgeScope` running at all, **both stayed green** — on a healthy tree
`scope.failed` is already false, so the term it is ORed with is never satisfied apart and
the whole wire deletes invisibly. 174 §8 and 176's G3 for the third time, and exactly why
`verdict_gate.combine()` exists. Extracted as `combineFailed()`, self-tested, and pinned
as a ninth blind target for `instrument_gate.py`.

A third mutant zeroed `_path_ledger.selftest.mjs`'s own `SELFTEST_CLAIM_FLOOR` and the
file stayed green: a `<` floor with nothing asserting its **value** can be zeroed
invisibly. `verdict_gate.selftest.mjs` pins `SUBJECT_FLOOR === 4` for this reason; this
file, three sessions older, never did. It does now.

🔴 **And a floor cannot be covered by the live reverse sweep, for 179 §9's reason
restated.** A floor is reachable only from *below*, and the shipped tree is above it by
construction. So `UNIT_FLOOR = 0` is green live exactly as 179's G25–G28 were, and the
coverage is in the self-tests by construction rather than by accident. `mutate180.py`
gained a sixth field so a mutant can be **declared green by construction** — and fails if
one ever starts reddening, because that means the structure changed.

```
TAUT_ATTRIBUTED units=1433/1200 claims=3018/2500 orphan=473
TAUT_SELFTEST 93 (was 78) · LEDGER_SELFTEST 39 (was 28)
INSTRUMENT_GATE 8 instruments — tautology_gate.mjs 0 of 9 (was 0 of 7)
MUTATE180 pass=16 fail=0 declared-green=1
```

## [1.55.0] — 2026-08-03

### Fixed — the two rules `boundary_gate.mjs` enforced somewhere other than where its population comes from

178 §10.23 said: *`unresolved` is honest, `judged` is not — so audit `judged`.* All 204
members were audited rather than sampled, and 26 of them were not what the gate thought
they were.

**Eighteen claims were judged over a receiver the gate's own premise does not cover.**
This gate exists because `call()` throws on `isError`, so an operation's `_err` paths never
reach a comparison and a hard-wired field is the only value the claim can hold. `raw()`
does not throw. `conduits()` already refused two wrappers over `raw()` for exactly that
reason — and `comparisons()` asked nothing at all about `await raw("runtime_node_add", …)`
spelled directly, judging eighteen of them, every one asserting `.isError === true`. Same
rule, same file, one spelling exempt. The throwing test now runs on the direct callee too,
and the refusals are counted (`nonthrowing=18`) rather than folded into `unresolved`.

**And the binding map was file-scoped and last-declaration-wins.**

```js
for (const spelling of ROOT_SPELLINGS) {
  const r = await raw("runtime_node_add", { type: "Object" });
  assert.equal(r.isError, true, "instantiating Object must still be not_a_node");
}
…
for (const path of leftovers) {
  const r = await rm(path);           // a different tool, a different block
  assert.equal(r.removed, true, …);
}
```

One `Map<name, tool>` per file meant the second declaration overwrote the first, so the
claim about `node_add` above was judged against `_node_remove`. Twenty identifiers in the
tree are declared more than once; nine judged claims rested on one and **six were judged
against an operation other than the one that replied.** Binding is now lexically scoped —
each `r` resolves to the declaration in its own block — with a reassignment (`let r =
await call(A); r = await call(B)`) still refused as `ambiguous`, because scope cannot
answer that one.

**The first fix for the second bug was wrong, and only the reverse sweep could say so.**
Refusing every multiply-declared name is the rule `toolOps()` and `conduits()` already
apply, it is correct, and it made the gate **green** under mutant G19 — which restores one
of the five defects 178 had just fixed, on a `const r` inside a cleanup loop. A narrowing
that is right in principle can still cost real coverage.

### Added — `JUDGED_FLOOR`, the seventh collapse and the first one that pins an output

Six floors pinned this gate's **inputs**: constants found, dispatcher arms read, tools
registered, comparison sites found, reply dicts read, dispatcher files opened. None pinned
the **output**. All six could hold while `comparisons()` resolved not one receiver, and the
gate would print `ok — 0 judged claim(s), none compared against a constant` and exit 0.
178 §10.22 said an instrument's population is the least audited number it prints; `judged`
is that number here, and it was the only population in the file with nothing under it.

`helpers()` is extracted as a ninth blind target for `instrument_gate.py`, and the
self-test grew 104 → 130 claims, including a fixture that drives `run()` end to end and
asserts the printed refusal counts — because every other case for the two new rules drives
`comparisons()` directly, and that is not the wire.

🔴 **And the reverse sweep cannot cover a narrowing at all.** The gate reds on offenders;
a rule that removes candidates from `judged` can only turn a red green. Both new rules were
pointed at the live gate first and both stayed green — measured, not assumed — so their
coverage lives in the self-test, and `mutate179.py` says so where a future session will
read it.

```
BOUNDARY_GATE consts=25/20 ops=177/150 tools=171/150 sites=1868/1500 reads=187/150
              planes=2/2 opaque=9 ambiguous=0 nonthrowing=18 unresolved=1683
              judged=185/150 offenders=0
```

## [1.54.0] — 2026-08-03

### Fixed — five claims on the runtime plane, in the half of the population the gate was not reading

`boundary_gate.mjs` shipped in 1.53.0 reading **one** addon dispatcher, **one** return
spelling and **one** comparison idiom, and printed `judged=78` as though that were the
population. It was not, and the difference held five live tautologies — every one of them
the same defect the gate was written for, sitting in the part of the tree it could not see.

```gdscript
func _node_add(params: Dictionary) -> Dictionary:
	...
	return _ok({"added": true, "path": _path_of(child), "type": child.get_class()})
```
```js
assert.equal(added.added, true, "a successful node_add reports added:true");
```

`call()` throws on `isError`, so every `_err` path escapes before that line: **the claim's
two outcomes were "true" and "never reached."** The two assertions below it — `path`, which
the addon COMPUTES from the node it actually parented, and `type`, which is
`child.get_class()` off the instance it built — were carrying the marker on their own the
whole time. **A dead conjunct beside a live one is invisible to every gate that counts
claims** (177 §10.24), and this is the second session in a row that has been where the
defects were.

Five claims, in `node-lifecycle` (4) and `inject-input` (1), each now a SHAPE claim over a
documented constant with the reason written next to it — the `filesystem_scan` treatment
from 1.53.0. Nothing in the addon changed: `added`, `removed` and `injected` are honest
fields to return, and the defect was never in returning them.

### Added — the four holes in the gate's population, and the three rules that stop widening it from inventing defects

- **It read one dispatcher; the addon has two.** `runtime_bridge.gd` carries its own
  `_dispatch`, its own `_ok`/`_err`, and 22 registered tools resolve into it. Every
  comparison over a runtime reply landed in `unresolved` — printed, and **printed is not
  judged**. Four of the five defects were in there.
- **`"ping": return _ok(_ping())` named the wrapper.** The arm resolved to `_ok`, which is
  truthy, so the claim **counted as judged** and could never be flagged — the worst reading
  an instrument can print, because it is indistinguishable from a clean one. Five arms.
  The same hop on the return side reaches the twelve handlers that build their reply one
  call away (177 §10.2).
- **`assert.equal(x.f, lit)` is the same claim as `x.f === lit`** and is the majority
  idiom in `test-integration/`. Four of the five defects are spelled that way.
- **A conduit is one hop from a comparison to a tool.** 177 §10.18 declined to follow one
  for the verdict finder on a measurement of +3 sites and 0 defects; here it is +1 defect,
  so it is followed.

🔴 **And widening a population is exactly where false positives come from** — 177 §5's
lesson arriving from the other direction. Three rules were added at the same time, and each
one stopped an invented defect before it was written down:

- **Absence is not sameness.** `_compare_images` returns `"reason": "dimension_mismatch"`
  on one `_ok` path and has no `reason` key at all on the other. "Every occurrence is the
  same literal" answered yes; the claim is still falsifiable, because `undefined` is the
  other outcome. A field must be present on **every** reply path.
- **An unreadable return poisons its whole operation.** `_asset_gen_placeholder` returns
  `_ok(desc)`, a dict assembled line by line. "Literal on every path" is unanswerable when
  a path cannot be read, so the operation yields nothing and is counted as `opaque`. So is
  an arm target that yielded no reply dict at all — `_screenshot_diff` ends
  `return _compare_images(...)`, a delegation spelling this reader does not follow, and
  before 178 it fell out of the loop in silence. **An under-reach that is not counted is
  indistinguishable from coverage.** Nine operations, named on demand.
- **A conduit is followed only if it throws.** `raw()` does not throw on `isError`, so
  `r.emitted === true` over a `raw()` receiver really does separate success from failure.
  Two conduits in the tree bottom out in a non-throwing helper; both stay unjudged.

Two new floors, because 177 §10.2 named a hole that no floor could detect: `RETURN_FLOOR`
pins the reply dicts **read** (`CONST_FLOOR` counts fields *found*, so the reader could
quietly stop handling the multi-line spelling and every existing floor stayed green), and
`PLANE_FLOOR` pins that both dispatcher files resolve. The self-test grew 58 → 101 claims
and **caught a real ordering bug while it was being written**: a conduit's first argument
is not a tool name, and `rm("Host/Thing")` was resolving to a tool nothing registers.

```
BOUNDARY_GATE consts=25/20 ops=177/150 tools=171/150 sites=1837/1500 reads=187/150
              planes=2/2 opaque=9 unresolved=1633 judged=204 offenders=0
```

## [1.53.0] — 2026-08-02

### Fixed — four claims compared against a value the addon types by hand

```gdscript
func _filesystem_scan(_params: Dictionary) -> Dictionary:
	EditorInterface.get_resource_filesystem().scan()
	return _ok({"scanning": true})
```
```js
(await call("filesystem_scan")).scanning === true
  ? pass("AUTH_RESOURCE_FS_SCAN") : fail("AUTH_RESOURCE_FS_SCAN");
```

Neither half is wrong on its own, and `tautology_gate.mjs` cannot see it. That gate grades
a claim's **leaves**, and `.scanning` is a property of a value fetched at runtime — the
textbook shape of the VALUE claim it is built to pass. The constant is real, but it is in
GDScript, in another file, on the far side of a JSON hop. **A claim is only as falsifiable
as the widest thing that can vary in it, and nothing in `_filesystem_scan` can vary at
all.**

And `call()` throws on `isError`, which closes the last escape: one could argue
`.scanning === true` at least separates success from failure, and it does not. Every
`_err` path escapes before the comparison is reached, so by the time a hard-wired field is
read the literal the addon typed is the only value it can hold. **The claim's two outcomes
were "true" and "never reached".**

Four live claims, all in `authoring-plane.integration.mjs`, each now asserting something
that can actually fail:

- `AUTH_SIGNAL_EMIT` rested entirely on `em.emitted === true`. It now asserts `path`,
  which `_signal_emit` **computes** from the node it resolved, and drives the refusing
  direction — an undeclared signal must be refused. A `_signal_emit` that ignored its
  `signal` argument entirely satisfied every claim this marker used to make.
- `AUTH_RESOURCE_FS_SCAN` is **pinned rather than fixed**, and the reason is written down.
  The editor's rescan is asynchronous and reports nothing back, so there is no value here
  to verify and inventing one would be a flaky assertion dressed as a strict one. The
  claim is now over the response **shape**, which is the drift a constant field is really
  exposed to. A SHAPE claim over a documented constant is honest; a VALUE claim over one
  is not.
- `AUTH_3D_ENVIRONMENT_CREATE` and `AUTH_3D_ENVIRONMENT_SET_SKY` each kept one real
  conjunct, so neither was vacuous and the population gate could not see them — the dead
  conjunct simply read as evidence and was not. `set_sky` now reads `background_mode` back
  off the saved resource before and after, because "setting a sky switches the background
  mode" is a claim about the `Environment`, not about a string in a reply.

### Added — `boundary_gate.mjs`, and it invented six defects before it caught four

The gate binds every `<receiver>.<field> === <literal>` to the call that **produced** the
receiver, then resolves that tool to a GDScript function through two real lookups —
`registerTool`'s own `call("<op>")` argument, and the addon's dispatcher read out of
`operations.gd`.

🔴 **The first draft skipped both lookups and matched the field by name.** It flagged ten
sites; six were `resource_load(...).type === "Shader"` and its siblings, and
`_resource_load` returns `"type": res.get_class()` — **derived**, and the entire point of
those checks. The name `.type` is hard-wired by `_shader_create` and computed by
`_resource_load`, and nothing about the name can tell those apart. That is 1.51.0's defect,
committed again in 1.52.0's, and committed a third time by the session that had just read
both. **A lesson recorded in a handoff is a lesson about the past tense.**

- **A hard-wired field nobody asserts is not a defect.** `_screenshot.mime` is
  `"image/png"` unconditionally and that is fine — a constant in a response only becomes a
  defect when something dresses it as evidence. The population is the intersection.
- **"Literal on every return path" is the whole test.** An operation with one literal
  `_ok` and one derived `_ok` has a field that can vary, and a claim over it is honest.
- **What the gate could not judge is printed on every run**, green or red: 798 of 876
  comparisons have a receiver that is not a tool call, and silence about that is what
  every session since 170 has been paying for.
- **Four floors, because there are four ways this collapses into a green lie** — the
  constants reader, the dispatcher, the registration reader and the comparison finder each
  going quiet leaves the other three reporting a clean tree.

`boundary_gate.mjs` is the instrument gate's eighth entry (floor 7 → 8), and its self-test
adds 49 known-answer claims. Steps in the existing job, not a 27th job — **fourteenth
session running.**

## [1.52.0] — 2026-08-02

### Fixed — a live probe discarded a verdict and then sealed the claim it was fetched to prove

`inject-input.integration.mjs`'s "leave it pristine" section closes with the check that the
probe did not damage its own fixture — the rule #146 exists for, and the one that stops a
probe's leftovers from contaminating whatever runs next against the same game:

```js
await call("runtime_assert_scene_structure", { expect: [{ path: ".", type: "Node2D" }] });
population.seal("INPUT_LIVE_PRISTINE", `ok … fixture intact`);
```

**The reply is never bound.** `call()` throws only on `isError`, and a structure mismatch
is a *successful* reply carrying `ok: false` — so a fixture that had stopped being a
`Node2D` sealed "fixture intact" anyway, from a string literal, with the measurement
fetched and dropped. That is 1.51.0's `cs_demo_verify_live_gif.mjs` one directory over.
The reply is now bound and asserted.

### Added — `VERDICT_DISCARD`, because the file was the wrong unit

175's verdict gate asks a per-**file** question: does this file read a verdict anywhere,
and can it exit on it? That is right for the host root, whose drivers push every reply
into a recorder and check the whole run at the end. It is the wrong unit for
`test-integration/`, where each reply is checked at its own site by `node:assert` — a
probe making fifty assertions passes the file-level test however many replies it drops.

🔴 **And the first instrument written to ask the call-site question invented seventeen
defects.** Asking "is `.ok` read?" per site flagged 17 in `test-integration`; reading them
showed almost every one was an honest check on a *different* field — `.matches` is the
measurement for `runtime_assert_screen_text` (`min_count` changes the verdict, not the
count), `.isError` is the entire point of the `raw()` error-path cases, and three `boot`
guards read `boot.structuredContent?.ok`, a nested access the test could not see. **That
is 1.51.0's own defect committed by its own follow-up question: matching a check by the
NAME of a field rather than by what the reply does.**

So the gate asks the one question that survives every idiom: **was the reply bound at
all?** A reply that is never bound cannot be read by `node:assert`, by an accumulator, by
a computed exit or by anything else — no field name and no escape convention has to be
guessed, so the false-positive rate is structurally zero rather than merely low. What it
costs is everything it does not catch: a reply that is bound and then ignored is invisible
to this half, and that is the honest trade.

- **No directory roster.** 175 shipped `DIRS = ["."]` in the session that found two
  rosters hiding defects, and this half's own first draft repeated it a third time —
  `[".", "scripts", "test-integration"]` over a recursive walk double-counted every site
  under the last two, reporting 109 sites where there are 61 and the one real defect
  twice. One recursive walk from `host/`, and the only skipped directories carry written
  reasons.
- **Two floors, because they collapse differently.** `DISCARD_SITE_FLOOR` (55, measured at
  61) catches a finder that stopped matching. `DISCARD_DIR_FLOOR` (2) catches a walk that
  stopped descending — the site floor alone stays green on the host root's thirteen sites
  alone, and a passing subset is indistinguishable from a clean tree.
- **`scan()` deliberately stays at the host root**, and the reason is now written down
  rather than inherited. `test-integration`'s five verdict-driving probes are all honest,
  but their honesty is *throw*-shaped; `exitsNonZero` looks for a computed `process.exit`
  on purpose, because a literal `exit(1)` in a crash handler was present in all three of
  1.51.0's broken drivers. Admitting them to that half would redden five healthy files.

### Removed — `verdict_gate.mjs` built a declaration map nothing read

`declarations()` walked the whole AST of every scanned file to populate `inspect()`'s
`decls`, and **nothing consulted it** — not `judge()`, not the self-test, not anywhere.
Measured before removal (172's rule): blinding it stayed green in every headless gate in
the tree, including the scope and instrument gates. It also duplicated
`tautology_gate.mjs`'s own helper of the same name.

### Added — the instrument gate's sixth and seventh entries

`tautology_gate.mjs` and `verdict_gate.mjs`, floor 5 → 7.

**Measured first, and 175 §11.2's premise did not hold:** `BLIND176 0 of 7 STILL GREEN` —
every finder in `tautology_gate.mjs` reddens its own self-test when blinded. It was handed
over as "finders whose silence would be invisible"; their silence is loud, so this entry
is a **pin on coverage that already exists**, not a hole being closed. It earns its line
for the reason `_path_ledger.mjs` went in at 0 of 8: coverage measured once is coverage at
one commit, and the failure this gate exists for is a case list that stops matching what
it names — exactly what 1.51.0 found *inside* this self-test, where `probe()` declared
`const check = (c, m, d) => {};` and nine cases had been proving the classifier against a
stub no probe in the tree resembles.

`verdict_gate.mjs` is where the measurement paid: blinding it is what found the dead
`declarations()`.

### Fixed — three collapse detectors that could be switched off silently

The reverse sweep over this change went `pass=12 fail=3` on its first run, and all three
failures were the same defect in three different files: **a floor read by exactly one
branch and asserted by nothing.**

- **`main()`'s wiring in `verdict_gate.mjs`.** Dropping `|| d.failed` left every gate
  green, because the shipped tree has nothing dropped, so the discard half never fails
  and the term it was ORed with could be deleted invisibly. Two conditions never
  satisfied apart in the live population — 1.48.0's G3 and 1.50.0's H5, a third time.
  `combine(r, d)` is now a separate exported function taking both verdicts as parameters,
  which is what makes the second one reachable at all.
- **`verdict_gate.selftest.mjs`'s claim floor.** `if (ran < 31)` set to `if (ran < 0)`
  left the whole file green. It is now a named `CLAIM_FLOOR` with a claim pinning its
  value — 1.51.0's `SUBJECT_FLOOR` fix, one level up.
- **`instrument_gate.py`'s `INSTRUMENT_FLOOR`.** Setting it to `0` left the gate entirely
  green: seven instruments is not fewer than zero. Pinning the value would be circular,
  so the collapse test is extracted as a pure `scope_collapsed(n, floor)` and a self-check
  asserts that an **emptied** instrument list is a collapse whatever the floor says. With
  the floor at 0 it is not, so the check reddens on exactly that mutant.

## [1.51.0] — 2026-08-02

### Fixed — three live drivers recorded a verdict they never read

`demo_verify_live.mjs`, `cs_demo_verify_live.mjs` and `cs_demo_verify_live_gif.mjs`
called `runtime_assert_node_state` / `runtime_assert_screen_text`, wrote the reply to a
transcript, and called `process.exit(0)` regardless. The word "assert" was in the step
**label**; nothing read `ok`. Their own captures are the proof — `demo_verify_buggy.json`
holds `ok: false` twice, and that run exited 0.

`cs_demo_verify_live_gif.mjs` was the sharpest: it ran both passes, took `{ice, grew,
a1, a2}` back from each, and then printed

> buggy **FAILS both** · fixed **PASSES both** — automation proves the fix

as a string literal, with both measurements in hand and discarded.

All three now read the verdict and exit on it. The expectation is keyed on the
buggy/fixed **label** rather than "any false is a failure": the buggy pass is supposed to
fail both, so a script that reddened on it would break the two-capture workflow *and*
still exit 0 on the day the buggy build quietly stopped being buggy. Captures are
unchanged, and are still written before the exit status is decided.

### Added — `verdict_gate.mjs`, the gate for the absence of a check

A headless gate (a step in the existing `host tests` job — no 27th job, twelfth session
running) asserting that every host-root driver which fetches a verdict-bearing tool reads
that verdict and can change the process exit status on it. Reading `ok` is explicitly not
enough on its own — the gif driver did that and displayed it. A literal `process.exit(1)`
in a `main().catch(...)` crash handler does not count either: every one of the three
broken drivers had one, so counting it would have greened all three.

### Fixed — the tautology gate invented claim sites, and missed three directories

`CHECK_FNS` matched a claim idiom by **callee name alone**. `sweep_editor.mjs` declares
`async function check(name, args)` — a tool invoker — so fifteen tool-argument object
literals were recorded as claims that cannot fail, plus two more from a transcript reader
named `assertOk`: **seventeen of the host root's twenty-four claim sites were fabricated
by the gate**. A gate that invents its own population inflates the very floors meant to
detect a collapse.

A name is now a candidate and `collectFailers` is the test: the callee must resolve to a
declaration that **branches on one of its own parameters** *and* **escapes** — mutates a
binding outside itself, throws, or exits nonzero. Both halves are required; outer
mutation alone re-admits the invoker. Measured before and after: `test` and
`test-integration` are byte-identical at 3141 sites, so the fix costs no coverage.

Three unswept directories were then admitted, each a different spelling of 174's finding
that an exclusion costing nothing to write is one nobody re-reads:

- `host/scripts` — including `tautology_gate.selftest.mjs`, **this gate's own gate**, 67
  claim sites it had never classified
- the **host root** — 11 real sites once the fabricated ones were gone
- `test/helpers` — reachable only because `readdirSync` is not recursive. Deliberately
  *not* rostered, and pinned by an assertion that fails if either fixture grows a claim

Thirteen new `NO_CLAIMS_EXPECTED` entries, each with a written reason.

### Added — `_png.mjs` is the fifth blinded instrument

Measured first: `BLIND175 _png.mjs 2 of 2 STILL GREEN` — both exports replaced with
constants and every headless gate in the tree still passed, because its only importers
are an Xvfb editor probe and a real-GPU script. It decides `AUTH_SHOT_NOT_UNIFORM`, the
check separating a rasterizer that drew something from one that drew nothing (#143).
`_png.selftest.mjs` adds 35 known-answer claims over PNGs built byte by byte, and the
instrument gate's floor goes 4 → 5.

## [1.50.0] — 2026-08-02

### Fixed — `vcs_restore` reported discarding work it had never touched

`restored` was the **request, echoed back**:

```ts
const r = await git(cfg, ["restore", "--", ...rels]);
if (!r.ok) return gitFail(r);
return ok({ restored: rels, count: rels.length });   // <- the argument, not the result
```

`git restore` exits 0 for a path with **nothing to discard**, so asking to discard five
files of which one was dirty reported all five as restored — from a tool that is
DESTRUCTIVE, elicitation-gated, and whose output is the caller's only record of what it
just threw away.

Carried as D5 since 155 §2, described in the probe's own header as "a steer, not a
defect… no assertion here either way". It is the **third confirmed member** of the family
after #181, #183 and #188 (`filesystem_move`'s `.import` sidecar): a report that
describes the *action requested* rather than the *result achieved*.

`restored` is now **measured** — the working-tree-vs-index diff, read before and after,
which is exactly what `git restore` discards. Three outcomes, so one list cannot carry
them:

| | `restored` | `requested` | `stranded` |
|---|---|---|---|
| was dirty, now clean | **✓** | ✓ | |
| nothing to discard | | ✓ | |
| still dirty afterwards | | ✓ | **✓** |

A stranded path is a **partial, not an error** — work *was* discarded for the other
paths, and `_err` would claim nothing happened, which is the same misdescription
pointing the other way (#188's reasoning inverted).

🔴 **The branch had never run anywhere.** Every pre-existing `vcs_restore` test restored
a path that *was* dirty, so no test in the tree had ever put a clean path through it and
the fix would have been unfalsifiable. Two unit cases and a live probe family
(`VCS_LIVE_RESTORE_ECHO`, 9 claims) now cover it; both unit cases go red against the old
echo, while the pre-existing gating test stays green — which is why this survived
nineteen sessions.

## [1.49.0] — 2026-08-02

### Fixed — `filesystem_move` reported that it had moved an `.import` sidecar it had not

`moved_import` was set to `true` whenever the source file **had** a sidecar. The
`rename()` that was supposed to move it had its **return value discarded**:

```gdscript
if is_file and FileAccess.file_exists(from_path + ".import"):
    dir.rename(from_path + ".import", to_path + ".import")   # <- return dropped
    moved_import = true                                       # <- unconditional
```

So the field described the **request** — "there was an `.import` and I called rename" —
rather than the outcome. When that rename failed (destination already occupied, a
permissions refusal, a case-only rename on a case-insensitive filesystem) the asset moved
and its sidecar stayed behind: an orphaned `.import` next to nothing, and a moved asset
that loses its custom import settings on the next scan and is silently re-imported with
defaults. The report said `moved_import: true` throughout. This is the same class as
`scene_get_dependencies` (1.48.0) and `resource_set_import_settings` (1.46.0) — **a
response field that echoes what was asked instead of what happened.**

- **Both flags are now derived from the return code**, and there is a new one. `moved_import`
  is true only when the sidecar's `rename()` returned `OK`; **`import_stranded`** is true
  when a sidecar existed and would not move. Two booleans because there are three
  outcomes: no sidecar, sidecar moved, sidecar left behind — and `moved_import: false`
  alone cannot distinguish the first from the third, which is the difference between an
  asset that never had import settings and one that has just lost them.
- A stranded sidecar is reported as a **partial, not an error**. The move itself succeeded;
  answering `_err` would claim nothing happened, which is the same misdescription pointing
  the other way.

### Fixed — `filesystem_create_dir` echoed the path it was asked for

`created` was the requested path copied back, and `make_dir_recursive_absolute()`
returning `OK` was never confirmed against the filesystem. It is now re-read, so `created`
names a directory that is **there**. Same family, one step milder.

### Added — the two branches nobody had ever exercised are now asserted

Every asset the live probes moved was a `.tres`, which has no sidecar — so the
`moved_import` **true** branch had never once run in CI, in the tree or out of it. The
authoring plane now mints a real imported PNG, moves it, and checks the report against the
**filesystem**: sidecar present at the destination, absent at the source.
`filesystem_create_dir`'s `existed` is asserted in both branches for the same reason — it
is the only field distinguishing "I made this" from "it was already here", and a hard-wired
constant satisfied every reader there was.

### Added — `scripts/instrument_gate.py`, the blinding harness pointed at the JS instruments

Blind each enumerator in turn and assert the run goes red — 1.48.0's `scope_gate.py`,
applied to `_population.mjs`, the new `_path_ledger.mjs` and the path-cohort walk. It found
`reportOrDie()`: the member that turns a failure list into a non-zero exit, the **only** one
eleven of the fourteen live probes call, and one that could `return 0` with the population
self-test entirely green.

The path-cohort **comparison** had no gate at all — it lived inline in a probe that boots
the editor GUI under Xvfb, so no case with a known answer had ever been put through it. It
is now `test-integration/_path_ledger.mjs` with a 28-claim self-test, and
`npm run path-cohort` floors its five counts, checks both blindness canaries by name and
runs the ledger comparison headless.

## [1.48.0] — 2026-08-02

### Fixed — `scene_get_dependencies` returned the one spelling of a dependency that does not load

The tool echoed `ResourceLoader.get_dependencies` verbatim. Measured on Godot 4.7 against
the example project, that array is **heterogeneous**: a dependency with no UID comes back
as `res://demo/demo_snowman.gd`, while one with a UID comes back as
`uid://ccgi4n26nbyku::::res://player.gd` — the engine's internal encoding. Fed straight
back to `resource_load`, the second form answers `not_found`, while **both of its halves
load fine on their own**. A caller doing the obvious thing with a "dependency" hit a wall,
and could not even write a stable parser without already knowing which shape to expect.

This is 1.46.0's defect in a read-only tool: a value echoed from the engine and presented
as an answer nobody had measured. Same fix, and nothing is destroyed:

- **`dependencies` now carries loadable `res://` paths** — what the tool's description has
  always promised.
- **`dependencies_raw` preserves the engine's encoding verbatim**, and **`dependency_uids`
  carries the UID alone (`""` when there is none)**. All three are index-aligned, so a
  caller pairing a path with its UID cannot silently pair the wrong two.
- An entry in a shape the splitter does not recognise is passed through **whole** rather
  than skipped. A splitter that dropped what it did not understand would shrink the
  dependency list and look tidier for it.

### Changed — five assertions that could not fail were replaced with claims that name the reply

1.47.0 found `typeof imp.imported === "boolean"` by hand and named the class: an assertion
green against every reply its tool can produce, sitting in a required context reading as
coverage. This release went looking for its siblings **mechanically** — parsing every claim
site across 68 test files, extracting the condition that guards it, and reporting the ones
whose every leaf is a type-or-presence test. Five survived being run against the specific
failure their own comment names:

- **`AUTH_READ_PATH_LEGAL`** and **`AUTH_NESTED_PATH_LEGAL`** — both introduced by the
  comment *"a guard that refused everything would pass every claim above"*, and both
  vacuous for exactly that guard. `AUTH_READ_PATH_LEGAL` was the sharpest: it asserted
  `typeof count === "number"` against `test_list` on its documented default, and the
  documented default is `res://test` while the example project ships `res://tests`. Its
  reading on a healthy tree was `count: 0` — **byte-identical to the over-refusal it
  existed to detect.** It could never have been anything but green.
- **`AUTH_SCENE_DEPENDENCIES`** — `Array.isArray(deps.dependencies)`, contradicted by the
  comment on its own line naming `res://player.gd`. Replacing it is what found the
  dependency defect above; the correct pattern had been four lines up the whole time.
- **`GD_DAP_ENTRY`** — 1.47.0's tautology verbatim, one plane over. Now a biconditional:
  the reported `stop_on_entry_honored` must agree with whether the session actually stopped.
- **`GD_DAP_CAPS`** — vacuous for `{}`, which is precisely the "answered `initialize`
  without capabilities" build its comment warns about. Its sibling claim was vacuous for
  `{}` too, so an empty handshake passed both with two green ticks over it.

### Added — suites now notice when they get smaller instead of greener

1.47.0 watched a mutation take a suite from `205/205` to a perfectly green `200/200` —
claims leaving the tally instead of failing. The totals that would have shown it were
printed and never compared to anything. Now they are:

- **`authoring-plane`** instruments `family()` itself rather than listing 203 marker names
  (a hand-maintained manifest is the exception table 1.47.0 measured and threw away). Three
  gates: every family must make at least one claim; **no family may throw part way through**
  — the silent case, where a family keeps the claims it made and drops the rest; and a
  family/claim floor, the family count asserted first so a collapsed scope cannot pass.
- **`gdscript-dap-plane`** gets a named family manifest plus a claim floor. A manifest
  rather than a bare total because this probe legitimately takes different arms on 4.3 and
  4.7, so a floor tight enough to catch its smallest family would false-fail elsewhere.
- **the GDScript unit suite** gets a claim floor — and it earned it during this release:
  run against the pre-fix addon, the new dependency assertions went from 13 to 1 and the
  suite reported a perfectly green `206/206`. The cause was a **typed local** (`var deps:
  Array = _rfield(...)`) raising on the null the accessor correctly returned — 1.47.0's
  sentinel lesson in a new costume. Reply arrays now come through `_rarray` / `_at`, which
  compare false instead of raising, so every claim speaks.

## [1.47.0] — 2026-08-02

### Added — the annotation table is now checked for being RIGHT, not just for being complete

The MCP annotation hints already had a two-directional gate: every registered tool has an
entry, and no entry outlives its tool. Neither claim can catch an entry that is simply
**wrong** — every tool has one either way, so a mis-classification contradicts nothing and
the suite stays green. That is 1.45.0's lesson in a new place: completeness is not
correctness, and it is how a public 2026-07 catalog published the wrong risk for
`tilemap_clear` and `navagent_configure`.

- **Two structural gates**, each scoped in the dozens and each at zero disagreements today,
  so they gate future drift without an exception list to rot: an explicitly-named delete is
  `destructive` and never `readOnly` (scope 9), and every `set` / `setup` / `configure` /
  `wire` / `inject` / `apply` mutator is non-`readOnly` (scope 60). Both assert their own
  scope size first — a rule whose scope silently collapses to zero looks green while
  covering nothing.
- **Three named canaries** for the tools whose *correct* annotation contradicts what their
  name suggests, each carrying its reason inline so the decision is inherited rather than
  re-litigated: `tilemap_clear` (destructive **and** idempotent), `anim_remove_key`
  (destructive and **not** idempotent — removing key N shifts the indices, so the identical
  call removes a different key), and `navagent_configure` (reads as a setter, actually
  *adds* a node, therefore non-idempotent and — being purely additive — **not** destructive).

### Fixed — prose that over-generalised what the table actually says

`annotations.ts` documented its idempotency rule as "creators, appenders, steppers, and
undo/redo are false". Measured against the table, **25 creators are idempotent `true`, and
every one of them is right**: a creator writing to a path the *caller* supplied converges,
while one that auto-names its result (`node_add` → `Node2D`, `Node2D2`, …) does not. The
prose was wrong, not the table. The rule now states the split, and a test pins both halves
so neither drifts toward the other.

### A negative result worth recording

A broader gate was tried first and measured out. Modelling "what would a consumer guess from
the tool's name?" and recording every disagreement as a reasoned exception is the path-cohort
ledger applied to annotations — and it disagreed with **149 of 291 tools**, because the model
flagged every LSP reader (`gd_hover`, `cs_definition`). It was measuring the regex, not the
annotations. A 149-row hand-maintained exception table is worse than no table; the narrow
rules above are the subset where the name genuinely does determine the answer.

## [1.46.0] — 2026-08-02

### Fixed — the import-settings pair now reports what actually happened

Two tools answered questions they had not been asked and stayed silent about the one that
mattered. Neither is a containment defect: nothing escaped the project root, nothing was
written that should not have been. Both are **reporting** defects, which are the kind that
survive longest, because a caller acting on the wrong answer looks exactly like a caller
acting on the right one.

- **`resource_get_import_settings` could not tell "not imported" from "not there".** A real
  file with no `.import` sidecar and a path that did not exist returned byte-identical
  replies — `{"imported": false, "importer": "", "settings": {}}`. So did a directory. All
  three now behave the way every sibling read in the group already behaved: a path that is
  not a file answers `not_found`, and `imported: false` means the file is really there and
  really has no sidecar. The vocabulary was not invented for this fix — `resource_load` and
  `resource_get_property` were probed for both cases first, and this joins them.
- **`resource_set_import_settings` reported `reimported: true` when it had changed nothing.**
  `reimported` echoed the request parameter and `settings` listed every key the caller sent,
  so setting a key to the value it already held reported a successful edit with the
  sidecar's bytes provably unmoved. The new **`changed`** field lists only the keys whose
  stored value actually moved. It is a channel, not a behaviour change: `settings: {}` with
  `reimport: true` remains a legitimate force-reimport idiom, so the reimport still runs and
  `reimported` still reports it — what was missing was the ability to say "and nothing moved".
- **`not_imported` no longer describes a file that does not exist.** A missing path was
  refused with "No `.import` metadata for X (not an imported asset)" — a sentence about a
  file that exists and is not imported. It now answers `not_found`, and the two codes name
  two different worlds.

### Changed — the claim that let this survive

The authoring probe's assertion for this tool was `typeof imp.imported === "boolean"`, which
is true of **every reply the tool can produce**, including the one it produced for a file
that did not exist. It passed against the broken tool and it passed against the fixed one.
A tautology inside a green suite is worse than no claim at all, because it reads as
coverage. It is replaced by claims that name the reply they demand, and the addon unit suite
gains **25 assertions** (180 → 205) covering both tools' full answer space.

Three of those assertions exist only because a mutation sweep contradicted the sweep's own
first verdict: deleting the new `changed` field made five claims **disappear from the tally**
rather than fail, taking the suite from 205/205 to a perfectly green 200/200. Reply fields
are now read through null-returning accessors so a missing field fails the claim that names
it, and the sweep itself now compares each mutant's claim total against the baseline —
because a suite that gets smaller is not a suite that got greener.

## [1.45.0] — 2026-08-02

### Added — the path-cohort enumerator is now shipped, unit-tested and gated

1.44.0 corrected an enumerator that had been wrong for three releases and left it in a scratch
directory. This release promotes it and closes the loop that let it go wrong in the first place.

**Why the enumerator was wrong is more useful than the fact that it was.** The line that did the
damage was `if (prop === "path") { pathNamed++; continue; }` — an earlier session's *conclusion*
("I already swept the `path` parameters") compiled into the tool that scoped every later session's
work. When 1.43.0 disproved that conclusion, the tool went on asserting it, because nothing could
notice it had gone stale. It discarded 124 parameters, 15 of which were escaping.

- **`src/path-cohort.ts`** — the corrected walk, exported and covered by 12 unit tests. It recurses
  into nested objects and array items, matches compound names by *segment* rather than exact word,
  handles multi-branch unions, and **excludes nothing**. Over-inclusion costs one question; the
  under-inclusion it replaces cost four releases. Independently re-implemented for this release with
  five further candidate blindnesses closed — the result is a strict superset that loses no row.
- **`npm run path-cohort`** — lists the cohort (291 tools → **258 path-like parameters**: 124 named
  `path`, 128 other top-level, 6 nested). Needs no editor. Replaces the scratch script whose count
  was quoted in three handoffs and two shipped changelogs.
- **`host/path-cohort-ledger.tsv`** — every one of the 258 parameters classified against a real 4.7
  editor *and* a running game, with a reason per row: **117 guarded** (refuse an escaping spelling,
  naming the parameter), **115 node paths** (resolved through the scene tree — measured, not assumed:
  the runtime rows answer `Node not found` for a `res://../` spelling against a live game), 10 on
  do-not-reopen planes, 8 capability-gated ahead of the guard, 6 enumerator over-inclusions, 1
  requiring an absent backend, and 1 stored-only.
- **`AUTH_PATH_LEDGER`** on the existing required `authoring-plane` context — four claims, no 27th CI
  job, no new gate file. It fails when the live surface and the ledger disagree **in either
  direction**: a path parameter that entered the surface unclassified is named in the failure, and a
  ledger entry whose parameter no longer exists fails too. The second half is the point — it is the
  property the old enumerator lacked.

Verified by mutation: nine mutations against the ledger and the compiled enumerator, nine caught,
zero survivors. Two of them matter most. Reintroducing the `path` discard leaves the
"everything is classified" claim **green** — a blind enumerator shrinks the live set, so nothing
reads as unclassified — and is caught only by the stale-entry claim. Reintroducing it *and*
regenerating the ledger to match takes both ledger claims green together, and is caught only by the
named canaries. Both canaries name a specific parameter for a specific historical blindness:
`card_template_create.theme.font_path` (nested, compound name, no description — invisible to a name
test and a description test at once) and `theme_set_font.path` (the cohort that was discarded).

### Audited — no containment escapes, and that is the finding

The 258 rows were re-measured against a real 4.7 editor and a running game to answer whether 1.42.0
and 1.43.0 under-scoped their work by using the blind enumerator. **They did not.** Every escaping
spelling either refuses by reason and names the parameter, or resolves as a node path, or is
accounted for by a recorded decision. No guard changed in this release.

One row is recorded rather than guarded: `project_add_export_preset.export_path` stores an escaping
`res://../…` verbatim into `export_presets.cfg`. The addon writes the string and never resolves it,
and an export target outside the source tree is ordinary Godot usage, so narrowing it would break
callers to prevent nothing. It is classified `stores-only` in the ledger with that reason, which
means the next session inherits the decision instead of rediscovering the row.

## [1.44.0] — 2026-08-01

### Fixed — twenty-four more parameters reached outside the project root, and six of them WROTE there

**This release is a correction, not an extension.** Three releases scoped their path work against a
count of "78 path-like parameters". The enumerator that produced 78 was blind three ways, and every
one of them hid real defects:

1. it walked **top-level** `inputSchema.properties` only, so a path parameter nested one level down
   appeared in no count at all;
2. it **discarded** all 124 parameters literally named `path`, on the standing belief that an earlier
   sweep had already covered them — 1.43.0 had already found two it had not;
3. its name test was an **anchored exact-word list**, so a compound name like `font_path` could only
   ever be found through its *description* — and `card_template_create.theme.font_path` has no
   description, which made it invisible to both tests at once.

Corrected, the enumeration is **258 rows, not 78**.

Re-measured against a real Godot 4.7 editor, **24 parameters reached outside the project root**.
Verdicts came from the filesystem — file hashes and directory snapshots — never from the reply,
because six of these tools answered `ok` while changing bytes outside the project:

| how it escaped | parameters |
|---|---|
| **rewrote a file outside the root** | `theme_set_color.path`, `theme_set_constant.path`, `theme_set_font.path`, `theme_set_stylebox.path`, `resource_set_property.path`, `resource_set_import_settings.path` |
| **created files or directories outside the root** | `filesystem_create_dir.path`, `scene_save_as.path`, `scene_new.path` |
| read or listed outside the root | `resource_load.path`, `resource_get_property.path`, `resource_get_import_settings.path`, `scene_open.path`, `scene_reload.path`, `scene_get_dependencies.path`, `shader_set_code.path`, `environment_set_sky.path`, `project_add_autoload.path`, `project_set_main_scene.path`, `filesystem_list.path`, `project_search.path` |
| **nested one level down — in no previous count** | `board_create.background.art`, `card_template_create.back.art`, `card_template_create.theme.font_path`, `piece_template_create.back.art` |

🔴 **All four `theme_set_*` tools load the Theme at `path` and re-save it, so `path` is a write
target.** `theme_set_font` and `theme_set_stylebox` have guarded their *second* parameter since
1.40.0 and left `path` open the whole time.

🔴 **`project_search` never touches the editor bridge**, so the addon's own `res://` check was never
in front of it. It returned matches from files outside the project root through all three spellings.

Containment logic is unchanged — `resolveInsideProject` and the `path_outside_project` code every
gate pins are untouched. The guards are threaded at the tool layer, run before the confirmation
prompt and before the transport, and rewrite nothing: a legal `res://` spelling still reaches the
addon exactly as the caller typed it. Optional parameters keep their documented defaults — an
omitted `path` on `scene_reload`, `scene_get_dependencies`, `filesystem_list` and `project_search`,
and an omitted `back` / `background` / `theme` object on the tabletop writers, are all still legal.

### Added

- `test/nested_and_path_cohort_guards.test.ts` — 9 tests covering all 24 parameters across three
  spellings, guard-before-prompt ordering, the caller's spelling reaching the wire unmodified, and
  the optional/nested-omission cases an over-eager guard would break (656 → 665).
- `AUTH_NESTED_PATH`, `AUTH_NESTED_PATH_BOTH_PARAMS`, `AUTH_NESTED_PATH_SPELLINGS` and
  `AUTH_NESTED_PATH_LEGAL` claims in the required `authoring-plane` gate. No new CI job; required
  contexts stay at 24.

## [1.43.0] — 2026-08-01

### Fixed — twenty-nine reader parameters loaded, listed, launched and EXECUTED files outside the project root

1.42.0 closed the 24 `to_path` writers and left 54 of the 78 path-like parameters open, naming the
readers as the sharpest remaining cluster. Measured against a real Godot 4.7 editor with the addon
live — and, for the runtime rows, against a game actually hosting the runtime bridge — **29 of 35
measured parameters reached outside the project root**.

A reader writes nothing at the escape target, so 1.42.0's `stat`-the-file verdict does not exist
here. What was measured instead is a **differential**: the same escaping spelling pointed at a file
that exists out there and at one that does not. A tool that answers differently has opened the
outside file; a tool that answers identically never reached the read at all.

| how it escaped | parameters |
|---|---|
| loaded an outside resource | `stream_path` ×2, `theme_path`, `font_path`, `stylebox_path`, `mesh_path`, `material_path`, `texture_path` ×2, `shader_path` ×2, `tileset_path` ×4, `scene_path`, `template_path` ×4, `reference`, `scene` (runtime) |
| **executed** an outside script | `godot_run_headless_script.script_path` |
| launched an outside scene as the game | `godot_run_project.scene`, `godot_run_managed.scene` |
| listed an outside directory's contents | `test_list.dir` |
| stored an outside path into a saved scene | `piece_template_create.art`, `mp_add_spawner.spawnable_scenes` |
| wrote outside (missed by the `to_path` sweep on a naming accident) | `godot_export.output_path` |

🔴 **`godot_run_headless_script` is the sharpest of these: `-s <script_path>` EXECUTES the file.** A
script outside the root ran, proven by a marker file the script itself wrote — its reply reported
`exit_code: 0` for the real script *and* for one that did not exist, so the reply channel carried no
information at all.

Two differences from the writer family. First, **readers escaped through all three spellings**, not
just `res://../`: the addon's `begins_with("res://")` check made a bare relative and an absolute path
self-announcing for writers, and readers never reached it. Second, `mp_add_spawner.spawnable_scenes`
is an **array**, so every element is guarded rather than the first.

The guard is `resolveInsideProject`, unchanged and already shipped. It refuses **before the
confirmation prompt and before the transport** — and, for the launchers, before the runtime port is
claimed, so a scene that can never legally run cannot take the port from one that can. It returns
nothing and rewrites nothing, so the caller's original spelling still reaches the addon.
`runtime_screenshot_diff`'s documented `user://` spelling stays legal and is pinned by a test.

Re-measured after the fix through the same live editor: **93/93 escape rows refused, no legal
spelling stopped working.**

### Added

- `test/reader_path_guards.test.ts` — 11 tests (645 → 656), including the first unit coverage of any
  MCP **task** tool's body: `godot_export` and `godot_run_headless_script` register through
  `experimental.tasks.registerToolTask`, and the existing test stubbed that away and replaced the
  handler, so their bodies had never been asserted.
- `AUTH_READ_PATH` claims in the required `authoring-plane` gate. No 27th CI job; required contexts
  stay at 24.
- `registerRuntimeTools` now throws at registration when its `Config` is missing. Nine
  `test-integration/*.mjs` probes call that registrar directly, where TypeScript cannot see them, so
  adding the parameter compiled clean and failed six CI jobs at runtime with an unattributed
  `Cannot read properties of undefined`. A `.mjs` call site is a call site.

## [1.42.0] — 2026-08-01

### Fixed — twenty-one editor / asset / backend writers created files OUTSIDE the project root

1.41.0 closed `dbg_launch.scene` and left behind an enumeration: 78 path-like parameters that are
not called `path`, of which 24 are the `to_path` writer family. Measured against a real Godot 4.7
editor with the addon live, on a temp project copy with a sibling directory sharing the root's name
prefix — and the verdict taken from the **filesystem**, not from the tools' replies:

| family | tools | `res://../` result before |
|---|---|---|
| `editor` plane | `resource_create`, `resource_save`, `resource_duplicate`, `filesystem_move`, `scene_pack`, `shader_create`, `theme_create`, `tileset_create`, `primitive_mesh_create`, `environment_create`, `audio_set_bus_layout` | wrote outside the root |
| `asset_gen_*` | all six generators | wrote outside the root |
| `backend` scaffolds | `backend_configure`, `leaderboard_scaffold`, `cloudsave_scaffold`, `auth_scaffold` | wrote outside the root |

Every one of the twenty-one answered `ok` and echoed the escaping path straight back, so no reply
could have revealed it. `filesystem_move` was destructive in both directions: it moved a project file
out, and moved a file the project never owned in. The addon's only check is
`to_path.begins_with("res://")` at seventeen call sites, which `res://../` satisfies — a bare
relative and an absolute path were already refused there, so `res://../` was the silent one.

Three source-side parameters on the same call sites escaped too and are guarded with them:
`resource_save.from_path`, `resource_duplicate.path`, `filesystem_move.from_path`.

The guard is `resolveInsideProject`, already shipped and already used by the netcode and tabletop
writers. It refuses **before the confirmation prompt and before the bridge**, so a call that can
never legally write never asks for approval; it returns nothing and rewrites nothing, so the
caller's original spelling still reaches the addon. Re-measured after the fix: 22/22 legal spellings
still write where they name.

**One behaviour change**, pinned by a test: `asset_gen_*` with **no generation backend configured**
and an escaping `to_path` used to answer `no_backend` with a `request` spec — an instruction to the
calling client to write outside the project. It now refuses.

Refusals carry their own `Path error [path_outside_project]` envelope rather than the editor plane's
`Bridge error`, which means "the editor could not be reached" and would send the caller to restart
Godot over a path typo.

### Added

- `test/writer_path_guards.test.ts` — 10 tests (**635 → 645**), including a carried check that
  1.39.0's netcode `to_path` guards are still wired at all three call sites. That gap was found by
  this release's mutation sweep: unwiring all three left the unit suite green, because those guards
  shipped with live-gate coverage only.
- `AUTH_WRITE_PATH` section in the `authoring-plane` gate (a **required** context) — 24 writer
  parameters refused by reason, the envelope, the legal side still writing, and a filesystem check
  that nothing landed outside the root. No new CI job; required contexts stay at 24.

## [1.41.0] — 2026-08-01

### Fixed — `dbg_launch` reported a session as `running` when nothing was going to run
`scene` is a path parameter that is not called `path`, so 1.40.0's sweep — which enumerated tools by
`inputSchema.properties.path` — never reached it. Measured against a real Godot 4.7 debug adapter,
by launching each spelling and reading the game's console back over the DAP `output` event:

| `scene` | what actually ran | session after 6s |
|---|---|---|
| `main`, `current`, `res://demo/demo.tscn`, absolute inside the root, `uid://<known>` | the scene that was asked for | `running` ✅ |
| `res://../evil/x.tscn`, `../evil/x.tscn`, `<root>_evil/x.tscn`, `/elsewhere/x.tscn` | **nothing** | **`running`, with a live sceneless game** |
| `""` | **nothing** — no game process existed at all | **`running`** |
| `/etc/passwd`, `res://NoSuchScene.tscn`, a directory | nothing | `terminated` |

**Nothing ever escaped the project root** — Godot does not run a scene from outside the project it
launched, whichever way the path is spelled. The defect was the *answer*: all of those returned
`ok {"state":"running"}`, and for the four escapes and `""` the caller had no way to find out. A
follow-up `dbg_stack_trace` returned `{"frames":[]}`, which is byte-identical to what a healthy
running session returns.

`dbg_launch` now refuses a scene that escapes the root, does not exist, is a directory, or is empty
— before the port check and before the transport, so the refusal costs no adapter round trip. The
same guard is wired to **`dbg_restart`**, which takes the same `scene` and reached the same adapter.

**`uid://` stays legal, and that is measured rather than assumed:** `uid://<known>` ran its scene, so
requiring a path on disk would have refused a working spelling. A `uid://` the project does *not*
know is the one case still not caught — Godot silently runs the main scene instead, and resolving it
needs the engine's UID map, which the host does not have. Said so in the tool description.

Every spelling that measurably ran a scene still runs the same scene: 6/6 re-verified through the
tool against the same live adapter after the guard landed.

## [1.40.0] — 2026-08-01

### Fixed — `dbg_goto` never guarded its `path`
`dbg_set_breakpoints` has refused a source that escapes the Godot project root, names nothing, or
names a directory since 1.34.0. `dbg_goto` — the **destructive** tool on the same plane, which moves
the program counter — takes the same `path`, resolved it with a bare `toFsPath` and handed the
result to the debug adapter as `source.path`. No containment check, no existence check.

It is not currently reachable on Godot: no Godot build advertises `supportsGotoTargetsRequest`, so
the capability check returns first. That is a capability, not a boundary — it can change under us,
and the tool is the destructive one. `dbg_goto` now applies the same guard as
`dbg_set_breakpoints`, and its description says so.

### Changed — one implementation of the escape check, five call sites
The containment comparison lived in **five** places: `paths.ts` plus a hand-rolled copy in each of
`lsp.ts`, `cslsp.ts`, `dap.ts` and `csdap.ts`. All five now call `escapesProject()`, and the four
planes share `resolveSourceFile()`.

Each plane's refusal **wording is a parameter**, not a constant, because each plane's live gate pins
its own strings by regex — `/outside the Godot project root/`, `/outside the C# project root/`,
`/no such file/`, `/is not a file/`. The consolidation is behaviour-preserving by construction, and
that was verified rather than argued: 310 (tool × spelling) rows were measured through the real
stdio server before and after, and the output is **byte-identical**.

One difference between the planes is **deliberate and was kept**: `cs_dbg_set_breakpoints` root-checks
only project-anchored spellings, leaving an absolute path outside the root legal, because
`cs_dbg_launch` documents debugging a different .NET program whose sources live elsewhere. That is
now expressed as `anchoredOnly` and asserted on both sides.

### Added
- `test/plane_path_guards.test.ts` — six tests, split between proving the helper and proving each
  plane is **wired** to it. A helper that refuses correctly guards nothing until every call site
  calls it, which is how `dbg_goto` stayed unguarded through 1.39.0.
- The LSP plane gate now asserts the escape refusal on **every reachable path-taking tool**, not on
  one of nineteen. The exemption is earned per run: a tool whose provider the connected build does
  not advertise answers "unsupported" before the guard, so it cannot be asserted — on Godot 4.7 that
  is 8 of the 19, and the count is printed so a silent drop to zero is visible.

## [1.39.0] — 2026-08-01

### Fixed — the tabletop and netcode file paths could leave the Godot project root
`card_deck_from_table` read a table from **outside** the project root through all three spellings —
an absolute path, `res://../…`, and a bare `../…` — and answered success. That is not merely a
lenient read: the tool **stamps what it reads into the scene**, so the rows of a file outside the
project became card data inside it. Four scene creators (`card_template_create`,
`piece_template_create`, `board_create`, `board_tile_create`) and the two `interact_*` script
writers had a `startsWith("res://")` pre-guard that `res://../…` satisfies, so they **wrote**
outside the root; measured against a real project, they created seven files there. The four
`mp_*` netcode writers shared the hole, and `mp_wire_rpc` **rewrote** a `.gd` file outside the root.

Every caller-supplied path in these two families is now resolved and refused if it lands outside
the project root (`path_outside_project`). An absolute path that resolves **inside** the root stays
legal, because `table_path` is documented as "res:// or absolute" and narrowing it would break
callers pointing at a real file in their own project. The comparison is against `root + path.sep`,
never a bare `startsWith(root)` — a sibling directory named `<root>_evil` shares the prefix, and
that is the case the gate asserts.

`mp_wire_rpc`'s own `res://` + `.gd` pre-guard already refused an absolute path and a bare `../`,
so only `res://../` reached it — the shared helper did not imply a shared exposure, and the two
families are asserted separately per spelling.

### Fixed — "cannot read table" was the answer to four different questions
`readFileText` returns `""` for every failure, so a **missing** file, a real but **empty** file, a
**directory**, and `""` (which resolves to the project root itself) all produced
`Cannot read table … (does it exist?)`. Three of those four existed. The causes are now distinct:
`not_found` for a genuinely absent file, `not_a_file` for a directory or the project root,
`empty_table` for a real, reachable, zero-byte table, and `path_outside_project` for an escape.
An empty table is a data problem and a missing one is a path problem; they no longer share an error.
`mp_wire_rpc` gains the same separation (`empty_file`).

### Fixed — `overwrite` was declared on four tools, documented, and never read
`card_template_create`, `piece_template_create`, `board_create` and `board_tile_create` all accept
`overwrite` ("Overwrite an existing … at `path` (default false)"). **Nothing in the implementation
looked at it.** A second call against the same path did not overwrite and did not refuse — it
**appended**. Measured: a second `board_create` took a 5-node scene on disk to 9, answered
`saved: true`, and reported the `node_count` it intended rather than the one it had produced.

The mechanism is worth recording because it is not obvious from the host code. The addon's
`scene.new` saves a fresh single-root scene to `path` and then calls
`EditorInterface.open_scene_from_path(path)`; when that scene is **already open**, the editor
switches to the existing tab, whose in-memory tree is the old one, and every `node.add` that
follows lands on top of it.

- With `overwrite` omitted or `false`, an existing `path` is now refused (`exists`).
- With `overwrite: true` the scene is replaced — closing a stale editor tab first when the target
  is open, which is what makes it a replace rather than an append.
- `EditorInterface.close_scene` is Godot 4.4+. Below that, an **open** target is refused
  (`overwrite_unsupported`) rather than appended to. Refusing is the correct answer; appending is
  the defect.

This is the third instance of the same disease in three releases — 1.37.0's `stop_on_entry` and
1.38.0's breakpoint modifiers were both parameters that were accepted and then ignored.

### Added — `tabletop-plane`, a required CI gate for the 14 card / board / piece tools
The family had **no live gate**: 69 unit tests against a mocked bridge, plus six happy-path GDScript
smoke scenes. That is precisely why five consecutive sessions read this code and described it
wrongly in two directions. The new job drives all 14 tools against a real editor and asserts 50
claims — the plane's happy path, every escape spelling per tool, all four read causes, and both
sides of the `overwrite` contract. It runs with **no `continue-on-error`**: every defect it covers
is a silent success, and a job that reports success while failing cannot catch one.

It carries **two oracles with different blind spots**. The probe diffs a sibling directory beside
the project root, which can name a leaked file; a separate CI step then asserts that directory holds
exactly the two seeded fixtures and nothing else, knowing nothing about the probe's own baseline. A
probe that took its baseline at the wrong moment would be wrong twice in the same direction and
still go green — the second oracle does not share that failure mode, and the write escape was found
by it.

## [1.38.0] — 2026-08-01

### Fixed — a breakpoint modifier buffered before launch was silently ignored, not dropped
`dbg_set_breakpoints` feature-detects `conditions` / `hit_conditions` / `log_messages` against the
adapter's advertised capabilities and drops what it cannot honour, because Godot advertises all three
**false** and then IGNORES them — an undropped "conditional" breakpoint halts unconditionally, which
is the opposite of what the caller asked for. That guard ran at **set** time, against capabilities
that are `null` until `initialize` answers. **So it never ran for a breakpoint buffered before a
session — which is the documented and ordinary way to arm one.** Measured live on Godot 4.7:

```
A_PRELAUNCH  capabilities=null     warned=false  unsupported_modifiers=null
             halted_anyway=true    ← the condition "counter < 0" is ALWAYS false
B_POSTLAUNCH capabilities=present  warned=true   unsupported_modifiers=["condition"]
```

Case A asked for a conditional breakpoint, got one that halts every frame, and was told nothing —
1.37.0's `stop_on_entry` defect in a different tool. Detection now happens in `applyBreakpoints`,
where the modifiers actually go on the wire, so it covers the buffered path too:

- `dbg_set_breakpoints` before a session answers `modifier_detection: "deferred"` plus a warning
  saying detection is not yet possible, rather than an unqualified `buffered: true`.
- `dbg_launch` / `dbg_attach` report the `unsupported_modifiers` the handshake actually dropped, and
  append the warning without clobbering `stop_on_entry`'s.
- The record is cleared per session, so a drop cannot leak into a later launch.

Eleven unit tests (593 → **604**), covering both directions: a modifier the adapter DOES advertise is
still forwarded, an all-null modifier array requests nothing, a later call does not inherit an
earlier one's report, and a launch that dropped nothing reports nothing.

### Removed — the experimental `dap-plane` job, whose coverage now lives in the required gate
CI job count **27 → 25**; `host/test-integration/*.mjs` 24 → **22**. `dap-plane` was the last
optional job still describing itself as coverage: two log-only probes under `continue-on-error`,
which is the same "silently optional assertion" shape 1.35.0 and 1.36.0 were about.

🔴 **The premise for deleting it was measured first, and it was wrong.** 159 §8.17 proposed the
deletion on the grounds that the `D_DAP_*` markers "duplicate what the gate logs". Run against one
live 4.7 adapter, the gate exercised **eight** of the fifteen `dbg_*` tools live and the two probes
reached **all fifteen**. Nine things had no counterpart in the gate at all. So they became claims
there BEFORE the job was removed — which is what makes this a subtraction rather than a loss:

- the **adapter's advertised capabilities** (`GD_DAP_CAPS` — a different claim from the existing one,
  which counts fifteen tool *names* in the host surface)
- breakpoint **`verified` flags** on a live session; the gate had only ever asserted the buffered
  answer, which by construction carries none, so nothing proved a breakpoint ever bound
- live `dbg_variables`, `dbg_watch` and `dbg_set_variable` — previously reachable only in the
  no-session refusal case
- `dbg_restart`, never exercised: it now asserts the **capability branch** (native `restart` when the
  adapter advertises `supportsRestartRequest`, `relaunch` otherwise)
- `dbg_goto` / `dbg_data_breakpoints` / `dbg_set_exception_breakpoints` (`GD_DAP_GATED`), each
  asserted to refuse **iff** the adapter lacks the capability — a biconditional, so it holds on 4.3
  and 4.7 alike
- the launched game's **console output**, the proof a launch actually spawned a game
- the **breakpoint modifiers** (`GD_DAP_MODIFIERS`), replacing the deleted modifier probe with a
  claim about the host rather than an observation about the adapter

The gate goes 42 → **66 claims**, verified stable across repeated live runs.

🔴 **One ported assertion was over-eager and the live run caught it.** The first draft claimed that a
scope reference `dbg_scopes` just handed out is one `dbg_variables` accepts. That reads like a host
contract and is not one: on 4.7 the adapter answered `DAP error [variables]: unknown` for the
`Locals` and `Members` refs it had itself just issued while `Globals` worked — 159 §8.16, upstream
and not reproducible on demand. It now asserts what the host owns, the same shape discipline
`dbg_evaluate` gets: self-describing either way, contents logged rather than asserted.

### Verification — 20 mutations, and the first run was wrong about five of them
The sweep (`_to_delete/mutate160.py`) mutates each guard in both directions and asserts the suite
under it goes red. First run: **14 caught, 5 survivors, 1 anchor missing.** Every one was real, and
none was a coverage number that could be talked up:

- **Three were genuine holes in the new tests** and are now closed — a buffered breakpoint with no
  modifiers claiming `deferred` anyway, an all-null modifier array counting as a request, and a
  second `dbg_set_breakpoints` inheriting the previous call's `unsupported_modifiers`.
- **One survivor was right about the code.** The `caps === null` branch of the detection guard is
  unreachable from its only caller: a DAP response body is normalised to `{}` before assignment, and
  the handshake sets capabilities before applying any breakpoint. It is defensive typing, now
  documented as such rather than left looking load-bearing; the reachable case — an adapter that
  answers `initialize` with an empty body and so advertises nothing — got the unit test instead.
- **One survivor was aimed at the wrong layer.** Forcing a `condition` onto every SourceBreakpoint in
  the built client survived the live gate, correctly: the gate observes what the host *answers*, not
  what it puts on the wire, and the wire claim is a unit-level one that N01 already makes. Retired
  with that reason logged, rather than kept as a "gap" inviting socket interception into a gate that
  is right not to have any.
- **The missing anchor was a HARD FAILURE, not a skip** — it pointed at a call this very release
  moved out of the tool layer. A sweep that shrugs at a stale anchor reports coverage it did not earn.

Final: **20 mutations, 20 caught, no survivors, no missing anchors**, probe and unit green afterwards.

## [1.37.0] — 2026-07-31

### Added — the GDScript `dbg_*` plane has a gate, and it is a JOB rather than a step
`host/test-integration/gdscript-dap-plane.integration.mjs` asserts all fifteen `dbg_*` tools against
a real Godot editor Debug Adapter, as a new **required `gdscript-dap-plane` job**. 42 individual
claims, none log-only. CI job count 25 → **27** (the job is a 4.3 / 4.7 matrix).

🔴 **The job/step decision goes the OTHER WAY here, for the reason 1.35.0 gave.** `csharp-plane`
carries no `continue-on-error`, so #164 and #166 could land their gates as *steps* inside it and
reuse its setup. `dap-plane` **does** carry `continue-on-error: true`, by design — it is an
experimental probe of a novel live adapter and must never block a merge. A strict assertion added
there would be silently optional, which is the exact failure the last two releases were about. So
this is its own job, and `dap-plane` keeps its two log-only probes unchanged.

🔴 **The editor is headless; only the game it spawns needs a display.** `godot --headless --editor`
serves the Debug Adapter on 6006 just the same, so this job skips `dap-plane`'s software-rendered
GUI editor boot entirely — **the port opens in ~4 s here against the ~120 s that job budgets**. The
host-side assertions (the refusals, the session guard, the source guard) need no display at all. The
live section does, and **CI taught that**: the first version of this job ran fully headless and the
stop never landed, because the editor spawns the game as a child and a game with no `DISPLAY` exits
first. The step runs under `xvfb-run` for the child's sake — but unlike `dap-plane`, every claim here
is fatal. The editor boots against a **copy** of `example/` in a temp dir, never the checkout: booting `--editor` damages `example/project.godot` two ways, and the escape-guard
assertions need a real file in a sibling directory beside the project root. **Nothing is added to
`example/`** — the tracked-file count does not move and there is no new `.uid` sidecar, the same
call sessions 155–158 made.

### Fixed — `dbg_launch` / `dbg_attach` reported a session that never started, and killed the server
🔴 **Two behaviour changes to shipped tools, and the sharpest defect this project has shipped.**
`dap.ts` carried the same swallowed-handshake shape #166 fixed in `csdap.ts` — but on Godot it is
not latent. Godot rejects the `launch`/`attach` **request itself**: `wrong_path` when the configured
project is not the one the editor has open (trivially reachable — on macOS `/tmp` realpaths to
`/private/tmp`), `not_running` when nothing is running to attach to, which is the most ordinary
caller mistake there is. That rejection lands **during** the handshake, before the old
`startReq.catch(...)` on the last line existed, so it was an **unhandled rejection — and Node
terminates the process for that. Measured twice, exit code 1.** When it did land in time it emitted
on `"error"`, and an unlistened `error` emit on an EventEmitter throws.

The handler is now attached on the same tick the request is created, on the distinct event name
`start_failed`, and a rejected start is reported as a refusal quoting the adapter's own message
instead of `isError:false state:"running"`. The state assignment is guarded on `initialized` rather
than unconditional, so a `stopped` arriving mid-handshake is no longer clobbered — the CI-only race
from #166, pinned here by a unit test that sends the event **before** the response.

### Fixed — eight `dbg_*` tools answered as if a session existed when none did
🔴 **Eight behaviour changes to shipped tools, and one with no C# counterpart.** With no session at
all — never launched, never attached — `dbg_continue` and `dbg_step` answered
`isError:false {"state":"running"}`, `dbg_stack_trace` `{"frames":[]}` and `dbg_scopes`
`{"scopes":[]}`, each indistinguishable from the same call against a real session.
`dbg_variables` / `dbg_evaluate` / `dbg_watch` / `dbg_set_variable` spent a full adapter timeout
each and `dbg_watch` then answered `isError:false`. Exactly one of the fifteen tools —
`dbg_restart` — refused, and only because it happens to read `lastStartMode`.

🔴 **The sharpest half is the side effect.** `resume()` optimistically sets `state = "running"`, so
the *first* such call left the client looking live and every later answer read as a genuine session.
All eight now refuse, by reason, without putting a byte on the wire. On the two elicitation-gated
tools the guard sits **above** the gate: the old order prompted the operator to approve arbitrary
code execution against a session that did not exist.

### Fixed — a breakpoint source that can never bind was accepted like a real script
🔴 **A behaviour change to a shipped tool.** `res://NoSuchFile.gd`, `res://tests` (a **directory**)
and `""` — which resolves to the **project root** — each returned
`{"buffered":true,"breakpoints":[]}` with `isError:false`.

🔴 **The escape check is deliberately WIDER than the `cs_dbg_*` plane's, and the difference is the
point rather than an inconsistency.** #166 kept an outside *absolute* path legal for C# because
`cs_dbg_launch` documents overriding `program` to debug a **different .NET program**. `dbg_launch`
has no such mainline — its `scene` is `'main'`, `'current'` or a `res://` path, and Godot binds
breakpoints only to scripts in the project it runs, so an outside path can never bind however it is
spelled. All three spellings are anchored to the root; an absolute path **inside** the project stays
legal, and over-eager mutations exist to keep it that way. The comparison is against
`root + path.sep`, so a sibling directory merely sharing the root's name prefix cannot pass.

### Fixed — `stop_on_entry` was silently ignored and reported as a bare "running"
🔴 **A behaviour change to a shipped tool.** Godot's adapter does not implement `stopOnEntry` at all
— measured: the game ran to completion and printed its `_ready()` line while the tool answered
`state: "running"`, which reads exactly like a stop that has not landed *yet*. The launch now waits,
bounded, and reports `stop_on_entry_honored` plus a `warning` naming the remedy. An adapter that
does honour it reports `true`, no warning, and `state: "stopped"` — pinned by its own unit test so
the honest answer cannot become a blanket one.

### Fixed — an adapter failure with no message rendered as a bare `DAP error [stackTrace]: `
The `?? String(err)` fallback only covered an **absent** message; an explicitly empty one fell
through to a label and a colon. The `cs_dbg_*` mirror of this shipped in 1.36.0. Refusals raised by
the new guards also render verbatim rather than as `DAP error [...]`, which would send the caller to
debug an adapter that was never asked.

### Note — the sweep found a defect in the gate itself, of the exact shape it guards against
🔴 **The probe printed six `FAIL` lines and exited 0.** Its "no stop landed" bail-out `throw`s rather
than let the frame/scope claims below pass vacuously — and the `uncaughtException` /
`unhandledRejection` listeners installed at the top *to prove the crash is gone* **swallowed that
throw**, making the code that sets the exit code unreachable. A log-only probe inside a required
job, rebuilt by accident inside the tool written to prevent it. Found by an over-eager mutation, not
by reading. The bail-out now lands in a `catch` that counts a failure, and a recorded crash counts as
one too.

### Note — what Godot answers to `dbg_evaluate` is three different things, all upstream
The same `1+1` at a live stop produced `"2"` at a `step` stop on 4.7, `success=false
message="timeout"` after ~5 s at a `breakpoint` stop on 4.7, and **success with an empty result** on
4.3. None is the host's to fix, and an empty string is a legitimate value for an expression to have,
so refusing it would be over-eager. The gate therefore asserts the answer's **shape** — a refusal
carries a non-empty message, a success carries the documented fields — and logs the value rather
than asserting it, so the version difference stays visible in the job log. Left alone on the same
call 158 §13 made about upstream behaviour the host passes through.

### Note — three corrections carried from the handoff
`dbg_*` is **fifteen** tools, not the seventeen the handoff predicted (13 + `dbg_goto` +
`dbg_data_breakpoints`). `dbg_set_exception_breakpoints`, `dbg_goto`, `dbg_data_breakpoints` and
`dbg_set_variable` are **already correctly feature-gated** and needed no change — evidence against
porting #166 mechanically. And a lone apostrophe inside a comment in `schemas.ts` makes
`contract_check.py` swallow every later entry into the one above it (155 §7, hit for real this
session); the file now says so where it matters. And `--headless --editor` **does** serve the DAP —
so `dap-plane`'s GUI editor boot is avoidable, though Xvfb is still needed for the game it spawns.

## [1.36.0] — 2026-07-31

### Added — the `cs_dbg_*` plane has a gate, in the same required job, one step further down
`host/test-integration/cs-dap-plane.integration.mjs` asserts all thirteen `cs_dbg_*` tools against a
real **netcoredbg 3.2.0-1092**, as a new **`C3 GATE`** step inside `csharp-plane`.

🔴 **1.35.0's correction stopped one probe short.** It established that `csharp-plane` is a REQUIRED
gate whose `cs_*` LSP probe could not fail past its handshake. The same shape sat one step below:
`csharp-dap.integration.mjs` is documented in its own header as **"LOG-ONLY beyond the
`C#_DAP_REACHED` gate"**, so all thirteen `cs_dbg_*` tools were unasserted inside that same required
job. Two probes, one job, one blind spot each.

🔴 **This gate does NOT drive Godot, and that is the point.** The diagnostic above it launches the C#
*game* under netcoredbg — and whether the adapter can debug the CoreCLR the Godot native host loads
is precisely the uncertainty that probe was written around. An assertion built on it would be flaky
by construction. This one builds a **throwaway .NET console app** in a temp dir (removed in a
`finally`), so `launch → stop at entry → arm → verify → hit → step → inspect` is deterministic and
needs no display server, no port and no Mono build. **Nothing is added to `example-csharp/`** — the
tracked-file count does not move and there is no new `.uid` sidecar, the same call sessions 155–157
made. It also **refuses to assert against a session that never stopped**: `CS_DAP_LIVE_WARM` exits
non-zero rather than let the frame/scope/variable claims below it pass vacuously.

It is a **step, not a new job**, for the reason 1.35.0 gave: `csharp-plane` carries no
`continue-on-error`, so a step here already blocks a merge and reuses the netcoredbg/SDK setup.
CI job count unchanged at 25.

### Fixed — `cs_dbg_launch` reported a session that never started as `running`
🔴 **A behaviour change to a shipped tool, and the sharpest defect of the family.** Measured against a
real netcoredbg: `program: "/no/such/binary"` produced `launch success=true`, then
`configurationDone success=false — "Failed command 'configurationDone' : 0x80070002"`
(ERROR_FILE_NOT_FOUND). **The adapter does report the failure**, on the one response the handshake
`.catch(() => undefined)`-swallowed immediately before an unconditional `state = "running"`. So the
tool answered `isError:false` for a phantom session and every later `cs_dbg_*` call failed against it
with a bare hex code. The same held for `program: ""` and for `cs_dbg_attach` on a dead pid.

The failure is only fatal when the adapter **advertised** `supportsConfigurationDoneRequest`
(netcoredbg does) — an adapter that never claimed the request may reject it while the session is
perfectly alive, and refusing there would be the over-eager mirror of the bug.

🔴 **A latent crash went with it.** A `launch`/`attach` rejection was routed to
`this.emit("error", err)`, and nothing in the host registers an `error` listener — an unlistened
`error` emit on an EventEmitter **throws**. It is captured now, on a distinct event name.

### Fixed — `stop_on_entry` never reported a stop, and took the stack trace down with it
🔴 **A behaviour change to a shipped tool.** The handshake returned before the entry `stopped` event,
so `cs_dbg_launch({stop_on_entry: true})` answered `state: "running"` and `threadId()` fell back to
`1` while netcoredbg's real thread id is a large integer. `cs_dbg_stack_trace` immediately afterwards
returned `0x80070057` — and the **identical call 1.5 s later succeeded**. Stop-on-entry was
non-functional end to end purely because nothing waited. The wait is bounded, so an adapter that
ignores `stopAtEntry` still reports `running` as before.

### Fixed — a breakpoint source that can never bind was accepted exactly like a real file
🔴 **A behaviour change to a shipped tool.** `res://NoSuchFile.cs`, `res://demo` (a **directory**) and
`""` — which `path.join`s down to the **project root directory** — each returned
`{"buffered":true,"breakpoints":[]}` with `isError:false`, byte-identical to `res://Player.cs`. A
`res://` or relative path resolving outside the project root (`res://../../../etc/passwd` landed in
`~/Downloads/etc/passwd`) is refused too, comparing against `root + path.sep` so a sibling directory
sharing the root's name prefix cannot pass.

🔴 **The escape check is deliberately NARROWER than the `cs_*` LSP plane's, and four over-eager
mutations exist to keep it that way.** `cs_dbg_launch` documents overriding `program` to debug a
different .NET program, whose sources legitimately live outside the Godot project — refusing every
outside path would break the documented mainline. `res://` and relative paths are project-anchored;
an **absolute** path elsewhere stays legal.

### Fixed — `cs_dbg_attach` accepted a process id nothing runs under
🔴 **A behaviour change to a shipped tool.** `process_id` gains `.positive()` — `-1` and `0` are not
process ids and both answered `state: "running"` — and a pid the kernel reports `ESRCH` for is
refused by name before the handshake. `EPERM` (a live process owned by another user) is a legitimate
attach target and is **not** refused.

### Fixed — `cs_dbg_set_exception_breakpoints` forwarded a filter the adapter never advertised
The empty case was validated; membership was not. `["nonsense-filter"]` reached the wire and came
back `Failed command 'setExceptionBreakpoints' : 0x80070057` — a hex code for a question the host
already held `available_filters` to answer. The unknown id is now named, and the real filters listed.

### Fixed — an adapter failure with no message rendered as a bare `C# DAP error [setVariable]: `
netcoredbg advertises `supportsSetVariable: true` and answered a `setVariable` failure with an
**empty** `message`, so the tool's entire answer was a label and a colon. (The client already
substitutes text for an *absent* message; an explicitly empty one fell through.) Refusals from the
new guards also render verbatim rather than as `C# DAP error [...]`, which would send the caller to
debug an adapter that was never asked — the distinction `lsp-common.fail()` already draws for the LSP planes.

### Note — the log-only probes stay, and the workflow comment stops overstating again
`csharp-lsp.integration.mjs` and `csharp-dap.integration.mjs` remain as the diagnostics they always
were. The `csharp-plane` header comment — corrected in 1.35.0 for the LSP probe — is corrected again
for the DAP one, in place rather than left to mislead the next audit.

## [1.35.0] — 2026-07-31

### Added — the `cs_*` plane has a gate, and the job it lives in stops overstating itself
`host/test-integration/cs-lsp-plane.integration.mjs` asserts all ten `cs_*` tools against a real
OmniSharp, as a new **`C2 GATE`** step inside the existing `csharp-plane` job.

🔴 **The plane already had a live probe, and this one sat inside a REQUIRED gate.**
`csharp-lsp.integration.mjs` spawns a real OmniSharp and exercises the `cs_*` tools — but only its
`initialize` handshake can fail. Everything past `if (reached)` is a `try/catch` that
`console.log`s, so `C#_LSP_SEMANTIC_OK: hover=false definition=false` would have printed and the job
would have stayed **green**. The job's own header comment claimed the "OmniSharp `cs_*` LSP probe …
gate[s] the job"; that held for the handshake and nothing after it. The comment is corrected in
place and the old step stays as the diagnostic it always was.

🔴 **It is a STEP, not a new job — and that is the same rule, not a departure from it.** `lsp-plane`
had to be a separate job because `editor-plane` carries `continue-on-error: true` by design, so an
assertion placed there could never fail a merge. `csharp-plane` carries no such flag, so a step here
already blocks the merge *and* reuses the dotnet/OmniSharp/fixture setup rather than paying for it
twice. **Check where an assertion lands before writing it** — the answer just happened to differ.

The capability baseline is derived from the connected server, never pinned; an "unsupported" verdict
on a provider the server *did* advertise must be earned by asking the server for a real `-32601`.
Measured on OmniSharp v1.39.15, no trap fires — unlike Godot's GDScript server, it implements
everything it advertises. The probe also **fails rather than passes vacuously** if OmniSharp's
asynchronous design-time build never finishes: a cold workspace answers empty for everything, which
would make every assertion below it trivially true.

### Fixed — `cs_rename` planned a project-wide rename to a name C# cannot compile
🔴 **A behaviour change to a shipped, destructive tool.** OmniSharp does not validate `new_name`.
Measured live: `"1bad name!"`, `"class"`, `"int"`, `"  "`, `"a\nb"` and `"my-name"` each returned
`isError: false` with a full five-edit plan — and with `apply: true` the host writes C# that does not
compile. The one string OmniSharp itself rejects is `""`, and it rejects it with an internal
assertion failure (`Unexpected true - file Renamer.cs line 151`) rather than a usable validation
error. `new_name` must now be a valid C# identifier and not a reserved keyword, refused **before**
the rename is planned.

🔴 **The check is deliberately narrow, and four of the twelve over-eager mutations exist to keep it
that way.** Contextual keywords (`var`, `value`, `async`, `record`) are not reserved and stay legal;
framework type names (`Console`, `String`, `Task`) are shadowable and stay legal, the same call the
GDScript plane makes for engine classes; Unicode identifiers (`Ångström`) are valid C# and stay
legal; and the verbatim `@` prefix is **accepted specifically because it is what legalizes a
keyword** — `@class` skips the reserved-word check rather than being refused by it.

### Fixed — the `cs_*` tools accepted a path that resolves outside the C# project root
🔴 **A behaviour change to shipped tools.** `toFsPath` joins through `path.join`, which normalizes
`..` away silently. Measured: `res://../../../etc/passwd`, a bare `/etc/passwd` and
`res://../../README.md` each resolved outside the root and were answered with `isError: false`.
Both are now refused by name, and the refusal never reaches the language server. The comparison is
against `root + path.sep`, never a bare `startsWith(root)` — the latter accepts a sibling directory
that merely shares the root's name prefix.

### Fixed — a missing C# script was opened as an EMPTY one
🔴 **A behaviour change to shipped tools, and the sharpest version of this defect the project has
measured.** `readFileText` swallows every read error and returns `""`, so `ensureOpen(uri, "")` told
OmniSharp a missing file existed and was empty. Measured live, `cs_document_symbols` returned
**byte-identical `{"symbols": []}` with `isError: false` for a missing file, for a file that exists
and is genuinely empty, and for a directory** — three different states, one indistinguishable
answer. All three are now told apart: absent and not-a-file are refused by name, and **a file that
exists and is genuinely empty is still served**. The guard is about absence, not size.

### Fixed — a negative `line` or `character` reached OmniSharp and came back as an internal error
🔴 **A behaviour change to shipped tools, with a different symptom than the GDScript plane's.** The
position fields were `z.number().int()` with no lower bound. This did *not* produce the silent
success `gd_*` gave: measured live, a negative position returned
`LSP error [-32603]: Internal Error - System.ArgumentOutOfRangeException` with a .NET stack trace in
the tool's answer, on `cs_hover`, `cs_definition`, `cs_references`, `cs_completion` and
`cs_signature_help` alike. They are now `.min(0)`, refused before the wire. **The bound is one-sided
by necessity** — a line *past the end of the file* produces the same `-32603`, and no input schema
can know the file's length; that case is explicitly not fixed by this.

### Note — the refusal rendering needed no change here
`fail()` lives in the shared `lsp-common.ts`, so the `refusal: true` path added in 1.34.0 covers the
`cs_*` plane for free — but only once something actually refuses. Before this change nothing did, so
there was nothing to dress up. The probe asserts it on every refusal regardless, and an under-eager
mutation that re-breaks the shared helper is caught by the `cs_*` gate too.

## [1.34.0] — 2026-07-31

**Minor. Seven entries, five of them behaviour changes to shipped tools — and the finding that
produced them is not a defect at all, it is that a probe which cannot fail reads on the board
exactly like coverage.**

1.33.0 asked *"which family has never been run against the real thing on a path that fails?"* and
found the `vcs_*` tools. Asking it of the twenty `gd_*` tools returned a worse answer than "no
coverage": **the LSP plane already had a live probe against a real editor on two arms, and every
call in it sat in a `try/catch` that only `console.log`s, inside a job carrying
`continue-on-error`.** A `gd_*` tool returning an error on every single call would have been green,
on both arms, indefinitely — while every audit scored the family as covered. The old probe stays as
the diagnostic it always was; a new `lsp-plane` job is the gate.

On the capability axis all twenty tools were already correct on real 4.3, 4.5 and 4.7. The five
defects were somewhere else entirely: `test/lsp.test.ts` drives a mock language server whose replies
the test itself writes, and every one of them lives in a state that mock cannot produce.

**The design premise this opened on was wrong, and the spike refuted it before a line was written.**
*"Advertised ⇒ the tool must succeed"* fails on 4.3, which advertises `workspaceSymbolProvider` and
then answers `-32601` to the request — so the invariant would have failed CI on a tool degrading
exactly as documented. The baseline is derived from the connected build, and the exemption for that
trap is **earned per run** by issuing the raw LSP request and requiring a real `-32601`, never
hardcoded.

**The `readFileText` finding is a correction.** The nonexistent-file answers were first attributed
to the engine and passed through on that basis. They were not: `readFileText` swallows every read
error and returns `""`, so the host announced a missing file to the language server as one that
exists and is empty. The engine answered honestly about *that*. Traced to the right layer, it was
fixed the same release.

**This is a host-only release. The addon is untouched at 1.9.5**, so no Asset Library trip is
attached and the existing paste card stays valid.

### Added — the LSP plane has a gate, not just a log
`host/test-integration/lsp-plane.integration.mjs` runs in a new **`lsp-plane`** CI job on 4.3 and
4.7. The plane already had a live probe — `editor-lsp.integration.mjs`, against a real editor on two
arms — but every call in it sits in a `try/catch` that only `console.log`s, and the job carries
`continue-on-error`. 🔴 **A `gd_*` tool returning an error on every single call left CI green**, on
both arms, while reading as coverage on the board. The old probe stays as the diagnostic it is; the
new one has no `continue-on-error` and fails the build.

The baseline is **derived from the connected build, never pinned to a table** — the providers Godot
advertises differ per version (measured: **4.7 advertises `documentHighlight` and 4.3 does not; 4.3
advertises `workspaceSymbol` and 4.5/4.7 do not**), so a pinned matrix would need hand maintenance
on every engine bump. Unadvertised providers must return the documented `unsupported` degradation;
advertised ones must succeed — **unless the probe earns the exemption itself** by issuing the raw
LSP request and getting a real `-32601` back. That is Godot's advertise-then-refuse trap, and on 4.3
`gd_workspace_symbols` triggers it live.

Every call is validated **through the tool's own zod `inputSchema` first**: a handler pulled out of
a recording server never sees its schema, so a probe that skips that step cannot observe a
schema-level fix at all.

The job needs **no Xvfb and no software OpenGL** — `--headless --editor` brings both the language
server (`:6005`) and the addon bridge (`:9080`) up in about **8 seconds** rather than up to 120.
`editor-plane` was moved onto the same boot, retiring its `xvfb`/`libgl1-mesa-dri` install.

### Fixed — `gd_rename` planned a project-wide rename to a name GDScript cannot parse
🔴 **A behaviour change to a shipped, destructive tool.** The language server does not validate
`new_name`. Measured on real 4.3 / 4.5 / 4.7: renaming to `""`, `"1bad name!"`, `"func"`, `"  "` or
`"a\nb"` each returned `isError: false` with a full nine-edit plan — and with `apply: true` those
edits **write a file that does not parse**. `new_name` must now be a valid GDScript identifier and
not a reserved word, refused **before** the rename is planned, so no `textDocument/rename` request
is sent at all. Engine class names (`Node`, `Vector2`) are shadowable and stay legal.

### Fixed — the `gd_*` tools accepted a path that resolves outside the project
🔴 **A behaviour change to shipped tools.** `toFsPath` joins through `path.join`, which normalizes
`..` away silently, so `res://../../../etc/passwd` and a bare `/etc/passwd` both resolved outside
the project root and were answered with a success. Nothing leaked — the answer was the same
degenerate one any missing path produces — but nothing refused them either. Both are now refused by
name, and the refusal never reaches the language server.

### Fixed — a negative `line` or `character` was accepted and answered as a success
🔴 **A behaviour change to shipped tools.** The position fields were `z.number().int()` with no
lower bound, so a negative value went to the wire and came back as a *successful* empty result —
indistinguishable from a real miss at a valid position. They are now `.min(0)`.

### Fixed — a missing script was opened as an EMPTY one, so the tools answered about a file that wasn't there
🔴 **A behaviour change to shipped tools, and the host was the cause — not the engine.** `gd_*` path
tools resolved a path and handed it to `LspClient.ensureOpen(uri, readFileText(...))`. `readFileText`
swallows every read error and returns `""`, so **a file that does not exist was announced to the
language server as a file that exists and is empty.** The server then answered honestly about *that*:
measured on real 4.3 / 4.5 / 4.7, `gd_document_symbols("res://no_such_file.gd")` returned a phantom
`{ name: "no_such_file.gd", kind: "class" }` with `isError: false`, and `gd_diagnostics` returned a
real `"(EMPTY_FILE): Empty script file."` warning. **A caller could not distinguish "empty" from
"absent".** A missing path, and a path that is not a regular file, are now refused by name and never
reach the server. `readFileText` itself is unchanged — it is shared with four other tool families and
stays lenient.

🔴 **The guard is about absence, not size:** a file that exists and is genuinely empty is still
served. That is the distinction the old behaviour destroyed, and it carries its own assertion in
both the unit suite and the live probe.

### Fixed — a host refusal was reported as an `LSP error`
`fail()` prefixed every error with `LSP error [code]:`, including refusals the host raised without
ever contacting the server — sending the caller to debug a language server that was never asked.
Refusals now carry their own message verbatim.

## [1.33.0] — 2026-07-31

**Minor, and every fix in it is the shape 1.32.0 shipped one release earlier: a tool answering
success about work the underlying system had refused or never done.** 1.32.0 closed the runtime
coverage plane and left nothing owed. This release exists because the next question asked was not
*"what is left in the runtime plane"* but **"which other family has never been run against the real
thing on a path that fails?"** — and the twelve `vcs_*` tools had exactly that hole. Five defects
came out of it, **four of them behaviour changes to shipped tools**.

The premise the work opened on was wrong, and correcting it is what made the defects findable: this
family was never mock-tested — `test/vcs.test.ts` has driven real git since Group L landed. What it
drove was the **happy path**, and every one of the five defects lives in a repository state that
fixture cannot build.

**This is a host-only release. The addon is untouched at 1.9.5**, so no Asset Library trip is
attached and the existing paste card stays valid.

### Added — the VCS plane is live-covered, on the states a happy path never reaches
`host/test-integration/vcs.integration.mjs` drives the Group L tools against **real throwaway git
repositories** in a new `vcs-plane` CI job. It is the one plane that needs **no Godot** — the tools
shell out to `git` — so the job installs nothing beyond node and runs in seconds.

The premise that this family was mock-tested is **wrong**: `test/vcs.test.ts` already drove real git.
What it drove was the **happy path** — two commits, one staged edit, one unstaged edit, one untracked
file, every call shaped to succeed. The probe covers what that fixture cannot produce: a **staged
rename** (with spaces in both names, exercising the `porcelain=v2` `2 ` field offset), a **conflicted
merge** (the `u ` arm), a repo with **no commits**, a **detached HEAD**, a **real remote**, and the
calls git **refuses**. Five defects were found by reaching those states — every one the same shape
#157 fixed in `runtime_emit_signal`: the tool reported success, or reported nothing, for work git had
refused or never done.

Verified with **18 mutations, 18 caught** — 11 under-eager and **7 over-eager**, per 154 §7's
second-order lesson that a mutation set blind in one direction proves only that direction.

### Fixed — `vcs_blame` failed outright when only one range bound was given
🔴 **A schema-legal call that always failed.** `start` and `end` are independently optional, but an
omitted end was rendered as `$` — `-L 3,$` — which is a `git log -L` form that **`git blame` rejects
with a usage error (exit 129)**. An omitted end must be the *empty* field: `-L 3,` blames from line 3
to end-of-file. `end` alone was unaffected. Measured on git 2.39.

### Fixed — `vcs_branch_create(switch: true)` hid the branch it had just created
🔴 **A behaviour change to a shipped tool.** Create and switch are two git calls and only the second
can fail. When the switch was refused — local changes would be overwritten — the caller got a bare
checkout error for a branch that **now existed**, so the obvious retry produced "already exists"
about a branch they had created themselves. The error now says the branch was created, names it,
and still carries git's own reason.

### Fixed — `vcs_stash push` reported success having stashed nothing
🔴 **A behaviour change to a shipped tool, and the worst shape in the family.** `git stash push`
**exits 0** printing "No local changes to save" when there is nothing to stash. Passed through as
success, it tells a caller their work is safely parked when it is not — and the next thing a caller
does with a "stashed" tree is switch or restore over it. The verdict now comes from **`refs/stash`
moving**, not from git's wording, which is not a stable interface across versions; a no-op push
errors even when a stash entry already exists. Untracked-only trees stash nothing here (no `-u`) and
are treated the same way.

### Fixed — `vcs_branch_list` invented a branch on a detached HEAD, and never flagged a remote
🔴 **Two behaviour changes to one shipped tool.** On a detached HEAD, `git branch` emits a
`(HEAD detached at <sha>)` pseudo-entry; it was listed as a real branch and reported as `current`,
while `vcs_status` reported `branch: null` for the very same repo. The two now agree: `current` is
null, the new **`detached: true`** says why, and no pseudo-entry is listed. Separately the `remote`
flag tested `name.startsWith("remotes/")` against `%(refname:short)` — which is `origin/main`, never
`remotes/…` — so it **could not fire**, and under `remotes: true` (the flag's entire purpose) every
branch came back `remote: false`. Both now discriminate on the full `%(refname)`.

### Fixed — the README claimed a 431-test suite; there are 555, and the number is now derived
🔴 **A front-door claim that had been wrong for fourteen minor releases.** The badge paragraph has
said "431-test suite" since host **1.18.1** — 124 tests stale — with every gate green the whole time,
because nothing derived the figure. Corrected to **555**, and `contract_check.py` gained **check 11c**
so it cannot drift again: the count is parsed out of the declarations `node --test` itself counts, so
a stale claim fails the gate and **no claim can be satisfied by editing a constant**. The check fails
loudly rather than passing vacuously if it can no longer see the suite at all.

## [1.32.0] — 2026-07-31

**Minor, and the reason is one line of GDScript that had been discarding the engine's verdict since
`runtime_emit_signal` was written.** 1.31.0 shipped hours earlier and was itself cut because coverage
started finding defects; this release exists because the *next* probe found the next one immediately.

🔴 **The runtime coverage plane is CLOSED with this release.** Live coverage is **26 of 27**, and the
one remaining tool — `runtime_await_condition` — has **zero** GDScript: it is host-side polling over
`runtime.get_property`, which six probes already exercise. There is no engine-side code left to
point a probe at. Over six sessions the plane went 18 → 26, and **three of the gaps closed came back
with a bug attached** — `inject_input` accepting a nonexistent action, `node_add` leaking, and now
`emit_signal` reporting success for emissions the engine refused.

**The addon moved 1.9.4 → 1.9.5**, so this release carries an Asset Library trip. Unlike 1.31.0, this
one also changes host source (the `runtime_emit_signal` description), so the npm package is not
byte-equivalent to the last one.

### Fixed — `runtime_emit_signal` reported success for an emission the engine refused (addon 1.9.5)
🔴 **A behaviour change to a shipped tool, and the same defect class #155 fixed one release
ago.** `_emit_signal` called `node.callv("emit_signal", …)` and **discarded the `Error` it
returns**, then answered `{"emitted": true}` unconditionally. When the length of `args` does not
match the signal's declared arity, Godot refuses the call: it pushes
`Method expected N argument(s), but called with M` into the **game's** log — not the caller's —
and runs **no** connected callable. Measured against an arity-2 signal: emitting with 0, 1 or 3
arguments each returned `emitted: true` while the handler never executed.

- `_emit_signal` now returns **`emit_failed`**, carrying the engine's own code by name and number
  (`error_string(err)`), plus the argument count that was sent.
- 🔴 **TWO of the engine's codes are non-`OK` and only one is a failure**, measured identically on
  4.3, 4.5 and 4.7: `ERR_METHOD_NOT_FOUND` (37) means a callable IS connected and could not be
  invoked — the defect worth reporting — while `ERR_UNAVAILABLE` (2) means the signal has **no
  connections at all**. Emitting into the void is ordinary and stays a success; the first cut of
  this fix rejected every non-`OK` code and so turned every unheard emission into an error. The
  repo's own `ops_unit_test.gd` (`rb.emit.ok`) caught that before it left the branch.
- 🔴 **Two limits on the guard, both measured and neither fixable here — the docs now say so
  rather than implying a guarantee.** (1) **Arity only:** Godot does not type-check signal
  arguments — `signal typed_sig(n: int)` accepted a `String` and the handler ran with it. (2)
  **Only when something is connected:** with no listener, a *wrong* count also returns
  `ERR_UNAVAILABLE`, because there is no callable whose arity could mismatch — so it is
  indistinguishable from a correct emission. `emitted: true` does not mean a handler ran, and
  `TOOL_CATALOG.md` states that outright.
- Found by pointing the tool at a live signal for the first time (see the coverage entry below).
  The unit tests prove the tool forwards `runtime.emit_signal`; nothing executed the emission.

### Tests — the last two structural runtime tools had no live coverage; the plane is closed
`runtime_get_tree` (~25 lines: `_serialize`, its `depth < max_depth` bound, and the
CanvasItem/Node3D/neither branch on `visible`) and `runtime_emit_signal` (13 lines) were the last
two entries on handoff 153 §2 with GDScript reachable only against a running game. The third,
`runtime_await_condition`, has **zero** — it is host-side polling over `runtime.get_property`,
which is already covered — so live runtime coverage is now **25 of 27, with the remaining two
uncoverable by construction rather than merely uncovered**.

- 🔴 **The fixture question was asked first, and came back no for the FIFTH session running.**
  153 §2 hoped `verify_probe.tscn` "may already be deep enough". It is not — it has more
  *siblings*, not more depth, and **every fixture in the repo is at most one level deep**.
  `_serialize` recurses on `depth < max_depth`, so nothing shallower than depth 3 can show the
  bound truncating in the *middle* of a tree, which is the only place it is observable as a bound
  rather than as an absent root. No fixture held a `Node3D` or a bare `Node` either, leaving two
  of the three `visible` arms with nowhere to run.
- **New fixture `example/tests/tree_probe.tscn` + `tree_probe.gd`** — depth 4, mixing `Node`,
  `Node3D`, `Node2D` and `Label`, with one node hidden. Per #154's discipline the script is
  **inert with respect to tree shape** (it declares signals and records receipts, and never
  touches the tree); the probe holds that to account by asserting the exact tree, node for node,
  *before* it emits anything.
- 🔴 **The load-bearing assertion is a COMPARISON, not a value.** At `max_depth: 2`, `Limb`
  reports `child_count: 1` with **no `children` key**, while `Bare` reports `child_count: 0` with
  no `children` key. Truncation and leafness are otherwise **identical on the wire** — so
  `child_count` is the only field that separates them, and both are checked in the same response.
  A serializer that dropped `child_count` at the bound, or emitted `children: []`, would be
  indistinguishable from a leaf.
- 🔴 **`visible` is asserted ABSENT on the plain `Node`s.** That arm had no fixture anywhere until
  now, and asserting absence rather than skipping it is what catches an implementation that adds
  the key to every node.
- 🔴 **`Codec.decode` is invisible over the wire, so the probe reads `typeof()` instead.** Reading
  the received argument back through `runtime_get_property` re-encodes it to
  `{"__type__":"Vector2",…}` **whether or not** decode ever ran — the wire cannot distinguish a
  real `Vector2` from the `Dictionary` it was sent as. The fixture records `typeof()` at receipt,
  inside the engine, which is the only place the difference exists.
- **New probe `host/test-integration/tree-shape.integration.mjs`**, a **seventh step on the
  existing required `runtime-plane` job** (`:9088`) — no new job, and it inherits the 4.3 / 4.5 /
  4.7 matrix and required-gate status.
- **`probe_lonely` is declared and deliberately never connected**, so the no-listener branch is
  covered rather than trusted to a comment — and the probe asserts the *limit* too: a wrong
  argument count there is NOT reported, because the engine cannot see it.
- 🔴 **Nothing in the fixture is a sub-resource, deliberately.** #153's animation library and
  #155's InputMap key event were both correct only on the arm they were authored on; plain nodes
  have no serialisation that drifts, and this job is what *checks* that on all three arms rather
  than assuming it.

### Docs — `runtime_emit_signal`'s description and catalog entry stated no failure mode
The tool description is the text a model reads when choosing a call, and it said nothing about
arity — so the first sign of a mismatch was a silent no-op. Both it and the `TOOL_CATALOG.md`
entry now name `emit_failed`, the arity rule, and the fact that types are *not* checked.

## [1.31.0] — 2026-07-31

**Minor, not patch, and the reason is that two shipped tools changed how they answer.** The four
sessions before this one added no host code at all — they added *coverage*, and 149 §7.3's standing
rule was not to cut a release for tests and docs alone. That condition stopped holding the moment
the coverage found something: pointing `runtime_inject_input` at a real InputMap for the first time
produced a tool that reported success for actions that do not exist, and the `runtime_node_add`
audit produced a leak. Both are behaviour, both are below, and the addon moved 1.9.2 → 1.9.4 to
carry them.

**Nothing here is a host code change.** Every version field below moves because the release is cut,
not because `host/src` differs from 1.30.0 — the two fixes and the new monitor key are all in the
GDScript addon, which `ping` reports separately as `ADDON_VERSION`. A user who upgrades the npm
package and not the addon gets none of this; the Asset Library trip is the one that matters, and
§7.1 of the session handoff tracks it.

🔴 **The through-line of all five entries is one method, and it is worth stating once at the top:
every defect below was found by pointing a tool at a real running game, and none was found by
reading code.** The runtime plane went from 18 of 27 tools live-covered to 22 of 27 over four
sessions; two of the four gaps closed came back with a bug attached. The remaining three are
enumerated in the handoff, ranked by how much GDScript is reachable only live.


### Fixed — `runtime_inject_input` reported success for an InputMap action that does not exist (addon 1.9.4)
🔴 **A behaviour change to a shipped tool.** `kind: "action"` called `Input.action_press` without
first asking whether the action existed. The engine pushes its own error and returns, so the tool
answered `{"injected": true}` for a typo'd action name and the caller's *next* assertion — the one
checking that something moved — is where the failure surfaced. As far from the cause as it is
possible to get, and invisible unless someone was reading the game's log.

- `_inject_input` now guards with `InputMap.has_action` and returns **`bad_action`**. The guard
  covers both operands: an omitted `action` key arrives as `""` and is rejected by the same branch.
- Found by pointing the tool at a real InputMap for the first time (see the coverage entry below) —
  not by reading the code.

### Fixed — `runtime_node_add`'s `not_a_node` branch leaked one object per call (addon 1.9.4)
`ClassDB.instantiate` hands back an **unowned** instance. The branch returned its error without
freeing it, so every rejected `type:` that instantiated to a non-Node leaked — reported by the engine
only at exit, as `N ObjectDB instances were leaked`, in a log for a backgrounded game nobody reaps.

- 🔴 **Invisible in casual testing precisely because the obvious test case is safe.** `Resource` is
  `RefCounted` and releases itself; a bare `Object` does not. Measured: **51 leaked over 51 calls**
  before, **0** after. The `RefCounted` arm must stay excluded — `free()` on a `RefCounted` is itself
  an engine error.
- **New monitor key `object/count`** (`Performance.OBJECT_COUNT`) on the `runtime_get_monitors` /
  `runtime_assert_perf` allow-list. It is the total live ObjectDB population and the **only** one of
  the three object counters that can see a leaked non-Node, which is what makes the fix
  regression-locked in CI rather than proved once on a laptop: `node-lifecycle.integration.mjs` now
  drives the branch 60 times and asserts the count does not follow. Idle drift headless is zero.

### Tests — `runtime_inject_input` had no live coverage; the largest remaining runtime gap is closed
The tool with the most GDScript unreached by CI: 39 lines, four `kind` branches plus the reject arm,
of which the host unit tests execute exactly zero — they prove the tool *forwards*
`runtime.inject_input` and stop there.

- 🔴 **The fixture question was asked first, and came back no for the FOURTH session running.**
  `example/project.godot` had **no `[input]` section at all**, so the `action` branch had nothing to
  be pointed at. Two actions were added for this probe and nothing else: **`bp_probe_bound`**, whose
  only binding is `KEY_K`, and **`bp_probe_unbound`**, which has no events at all.
- 🔴 **The binding is built in `_ready()`, not serialised into `project.godot` — and that is a
  measured decision, not a preference.** A binding written into the `[input]` section by Godot 4.7
  carries `device: 16`, which matched on 4.7 and **silently did not match on 4.3 or 4.5**: a `key`
  injection reached the listener and never reached the InputMap, so the routing assertion failed on
  two of the three arms. Built at runtime, the binding's device is the default `0` and so is an
  injected event's, so they match **by equality on every version** rather than by whatever each
  engine happens to call "all devices". Same reason `anim_probe.gd` builds its animation library in
  `_ready()`; the actions themselves stay declared in `project.godot`, with no events.
- **New fixture `example/tests/input_probe.tscn` + `input_probe.gd` — an OBSERVER that never
  synthesises input.** Same discipline as #154's scriptless fixture, one step on: that lane's subject
  was the shape of the tree, so its fixture carries no script; this lane's subject is whether an
  event *arrives*, so its fixture may hold a script but that script must not be able to produce one.
- **New probe `host/test-integration/inject-input.integration.mjs`**, a **sixth step on the existing
  required `runtime-plane` job** (`:9087`) — no new job, and it inherits the 4.3 / 4.5 / 4.7 matrix.
- 🔴 **`action` and `key` are observable through different instruments, and the difference is itself
  asserted.** `Input.action_press` generates **no `InputEvent`** (measured at exactly 0), so an
  implementation that faked the action branch by synthesising a key event fails the event-count check
  and nothing else.
- 🔴 **A `key` injection on the BOUND keycode must move both lanes** — arriving as an `InputEvent`
  *and* pressing `bp_probe_bound`. That is the only evidence the event travelled the engine's real
  input pipeline rather than being handed to a listener. The same injection on an unbound keycode
  must move only the first: two operands of one claim, in the shape #154 §4 found the hard way.
- The `position` / `relative` decode guards are reached **separately, in both directions** — a motion
  event carrying only `relative` must leave position at `(0,0)`, and vice versa. `strength` is proved
  forwarded rather than defaulted (pressed at 0.6, reads back 0.6). Five rejection reasons are
  asserted separately and proved **inert**. The event count is **exact, not monotonic**: ten
  injections, ten events, and the per-kind counters must sum to the total.
- **Twelve mutations applied to the live addon, twelve caught**, each for the assertion it was
  aimed at.

### Tests — the node lifecycle had no live coverage; #1 on the ranked gap list is closed (no tool change)
#153's audit left a ranked backlog rather than an unknown, and `runtime_node_add` /
`runtime_node_remove` sat at the top of it: **~44 lines of GDScript with the densest error paths in
the runtime plane**, of which the host unit tests reach exactly zero — they prove the tool *forwards*
`runtime.node_add` with the right params and stop there.

- 🔴 **The fixture question was asked first, and the answer was again no.** Handoff 151 §7.3 made it
  the gate on scoping, because it is what found the last two gaps: what must the tool be pointed at?
  `node_add`'s `scene:` branch needs a `res://` **PackedScene**, and every scene under `example/` is a
  probe fixture whose `_ready()` builds state for its own lane — instantiating one would have mutated
  the very tree the probe asserts on. **Third session running that a missing fixture, not a missing
  test, was the reason a tool had never executed.**
- **New fixture `example/tests/node_probe.tscn`, deliberately SCRIPTLESS** — and that is the design,
  not an omission. The subject of this lane *is* the shape of the tree, so a `_ready()` that touched
  it would compete with the tool under test. With no script, every node that appears beneath the root
  during the run was put there by `node_add` and every one that vanishes was taken by `node_remove`,
  which is the only reason the pristine-restore check at the end means anything.
- **New fixture `example/tests/node_payload.tscn`** — the PackedScene the `scene:` branch
  instantiates: inert, and authored so that its **root name**, its **property values** and its
  **child** are three things a `type:` add cannot fake. `node_payload.gd` sets `ready_ran` in
  `_ready()`, which the engine calls only on entry to the SceneTree — positive evidence that
  `add_child()` really ran, rather than an instantiate whose result was described in the reply and
  dropped.
- **New probe `host/test-integration/node-lifecycle.integration.mjs`**, a fifth step on the existing
  required `runtime-plane` job (`:9086`), inheriting the 4.3 / 4.5 / 4.7 matrix at no new job cost.
  Mutations are read back through tools that are themselves already live-covered
  (`assert_scene_structure`, `assert_node_state`, `get_property`, `call_method` — all #152), never
  through the tools under test.
- 🔴 **Seven rejection reasons are asserted separately, because they are not interchangeable.** The
  split a single spot-check misses: `NoSuchClass9137` fails `ClassDB.class_exists` and `Viewport`
  fails `can_instantiate` — **both `bad_type`, through different operands** — while `Resource`
  instantiates fine and is `not_a_node`. The `scene:` guard has the same shape: a missing path makes
  `load()` return null, a `.gd` path **loads successfully and returns the wrong type**.
- **Removal is proved to take the whole subtree** — the payload's authored child *and* a child added
  afterwards — with siblings untouched, and re-removing the same path is `bad_path` rather than a
  second success. The `cannot_remove_root` guard is attacked through **both** spellings `_resolve`
  maps onto the scene root (`"."` and `""`), and the assertion is not that the call was refused but
  that the root **survived**: a guard that returned the error and freed anyway passes a reply-only
  check and takes the game with it.
- **Documented, because it bounds the claim:** whether removal used `queue_free()` or `free()` is
  **not observable over the socket** — idle frames keep processing between one request and the next,
  the same property that holds during a frozen-clock window. The probe asserts that removal *happens*
  and leaves the mechanism to the GDScript rather than pretending to check it.
- **Noted, not changed:** an unnamed `node_add` returns an engine-generated `@Class@N` path, so a
  caller must use the returned path rather than guessing it. Asserted by shape *and* by resolving it,
  which is the round-trip that matters.
- Verified the standing way: **nine mutations applied to the live addon, nine caught**, each by the
  assertion written for it.

### Tests — a coverage audit of the whole runtime plane, and the largest gap it found (no tool change)
#152 closed the verification family and left an obvious question behind: *which other runtime tools
are unit-test-only?* Nobody had asked. Walking all **27** tools in `host/src/tools/runtime.ts`
against `host/test-integration/` and `.github/workflows/` answers it — **18 are exercised against a
real running game, 9 are not**: the three animation tools, `runtime_node_add` / `runtime_node_remove`,
`runtime_inject_input`, `runtime_get_tree`, `runtime_emit_signal` and `runtime_await_condition`.

- 🔴 **`host/runtime_scenario.mjs` is a third scratch harness**, alongside
  `verify_family_s102_live.mjs` and `verify_shot_editor_live.mjs`. It runs in no workflow and is not
  in `package.json`, yet it references `runtime_emit_signal`, `runtime_get_tree` and
  `runtime_inject_input` — so those three look live-covered to a grep and are not.
- 🔴 **The animation lane had never executed anywhere, for the same reason #152 found:
  no scene in this repository contained an `AnimationPlayer`.** Not `main.tscn`, not
  `render_probe.tscn`, not `frame_step_probe.tscn`, not `peer_converge_probe.tscn`, not
  `verify_probe.tscn`. `_resolve_anim_player`, `_anim_state`, `_anim_play` and `_anim_stop` — about
  sixty lines of GDScript — were reachable only through a mocked bridge that never gets there. The
  authoring plane's `AUTH_ANIM_*` markers are a *different* lane (editor-side authoring) and are what
  makes the gap look covered.
- **New fixture `example/tests/anim_probe.tscn`** — an `AnimationPlayer` whose library is built in
  `_ready()` (sub-resource serialisation drifts across the 4.3 / 4.5 / 4.7 arms), a `Marker` the
  animation actually **moves**, and a `NotAPlayer` `Node2D` so `not_animation_player` is reachable and
  distinguishable from `bad_path`. Two animations differing in length and loop mode, because a
  single-animation fixture cannot tell `length` from a constant.
- **New probe `host/test-integration/animation-lane.integration.mjs`**, a fourth step on the existing
  required `runtime-plane` job (`:9085`), inheriting the 4.3 / 4.5 / 4.7 matrix at no new job cost.
  Every behaviour is asserted in both directions and four are unsatisfiable by a static
  implementation: the animation must **move a node**, read back through `runtime_get_property`;
  `keep_state` is proved by the playhead, since pause must keep it and stop must rewind it;
  `custom_speed` is **measured** over equal windows rather than trusted; and `from_end` is proved on
  the non-looping animation, the only one where starting at the end is observable at all.
- **The cross-version claim in `_anim_stop`'s own comment is now checked.** *"`pause()`/`stop()` with
  no args are stable across Godot 4.2–4.5"* was an assertion about three engine versions, written
  down and never run on any of them. It rides the matrix now.
- **Noted, not changed:** `runtime_anim_play` reports `speed_scale`, which is
  `AnimationPlayer.speed_scale` — `play()`'s `custom_speed` argument does not write to it. Passing
  `custom_speed: 8` therefore reads back `speed_scale: 1` while playback is measurably 8×. The probe
  pins both facts so the asymmetry cannot drift unnoticed.
- Verified the standing way: **seven mutations applied to the live addon, seven caught**, each by the
  assertion written for it.

### Tests — the verification family had no live coverage, and the handoffs said the opposite (no tool change)
Every handoff since 143 carried "**`runtime_screenshot_diff` still has zero automated coverage** …
now the largest untested surface in the repo" forward, through 144, 147 and 149. It stopped being
true at **#141**, which added `runtime-screenshot.integration.mjs` and the `runtime-render-plane`
job. The sentence that kept the item looking alive — *"`verify_family_s102_live.mjs` … runs in no
workflow"* — is true and irrelevant: that is a scratch harness, and the tool it names is covered by a
different file. Four sessions re-read the claim instead of the code.

**What was actually uncovered is the family around it.** `runtime_assert_node_state`,
`runtime_assert_perf`, `runtime_assert_screen_text` and `runtime_state_digest` had host unit tests
against a *mocked* bridge and no live coverage at all; `runtime_assert_scene_structure` appeared live
only as a green premise gate inside the render probe. A mocked test proves the host forwards a
request and parses a reply — it cannot reach the GDScript where every interesting behaviour in this
family lives.

- 🔴 **A positive `assert_screen_text` had never executed anywhere in this repository.** It walks
  `CanvasItem`s reading `text`, and **no scene here contained a single `Control` with a `text`
  property** — `main.tscn` is a Node2D and an untextured Sprite2D, `render_probe.tscn` is a
  `ColorRect`, `frame_step_probe.tscn` is a bare Node2D. Only the *absence* form could run, and
  absence passes trivially against a tool that finds nothing, ever.
- **New fixture `example/tests/verify_probe.tscn`** — a root with `counter`, plus two labels that
  differ in exactly one way: `VisibleLabel` is on screen and its text must be found; `HiddenLabel`
  holds a sentinel string with `visible = false` and its text must **not** be. Against a fixture with
  only a visible label, an implementation that never checked visibility passes everything.
- **New probe `host/test-integration/verification-family.integration.mjs`**, a third step on the
  existing required `runtime-plane` job (`:9084`), so it inherits the 4.3 / 4.5 / 4.7 matrix and
  costs no new job. Every check is made in **both** directions, and three are unsatisfiable by a
  static implementation: `counter` is changed live and the same assertion must flip green → red →
  green (the #146 failure mode); absence and invisibility are told apart, because
  `assert_node_state` proves `HiddenLabel` holds the string `assert_screen_text` must not find; and
  `assert_perf` is driven past the bound as both `higher_better` and `lower_better`, with the
  `direction` override then flipping the verdict on the same numbers.
- Also newly live: all four `_assert_scene_structure` reasons, `bad_path` / `bad_regex` as errors
  rather than quiet zero-match passes, `case_sensitive` / `regex` / `min_count` each with their
  inverse, an unknown monitor key falling to `checked: 0`, digest `fields` **replacing** the defaults
  rather than extending them, and `max_depth` bounded at 0 and 1.
- **Seven mutations were applied to the live addon and all seven were caught**, each by the
  assertion written for it — the visibility filter, the value comparison, the direction override,
  the depth bound, the monitor allow-list, a renamed failure reason, and a no-op `set_property`.

### Docs — post-1.30.0 sweep: the places the gate cannot see (no tool change)
1.30.0 landed two tools and two new gate checks. The contract check enforces every count and
shape it knows about, which is exactly why the stale claims that survive a release are the ones
**outside** its reach — prose numbers in a form its regex does not anchor on, and documentation
of things it has no opinion about at all.

- **`contract_check.py`'s own docstring enumerated checks 1–16.** The script has had **19** since
  1.30.0: 17 and 18 arrived with #145 and 19 with #147, and neither updated the header. All three
  are now listed, including *why* 18 and 19 point in opposite directions.
- **Two bare `146`s in `README.md` and one in `docs/USER_GUIDE.md`** — the pre-1.30.0 `editor`
  toolset size, in running prose (`"is part of that 146"`, `"not the 146 alone"`). Check 13
  anchors on the `` `a` → **N** `` form and correctly did not see these.
- **`screenshot_editor`'s description stated the precondition but not the remedy.** It is the text
  the model reads when choosing a call, so it now says to call `main_screen_set` first — the
  error message has said so since #149, but only *after* the call already failed.
- **`main_screen_*` was missing from the `USER_GUIDE` family list**, and `screenshot_editor`'s
  entry there did not mention the tab requirement at all.
- **`RUNBOOK` step A8 was not deterministic** — `screenshot_editor {viewport:"2d"}`, expecting
  "image returned (2D editor tab active)", with nothing making that true. It is now A8–A11: read
  the tab, watch the capture be refused, switch, watch the same call succeed.
- **`CONTRIBUTING.md`'s "adding a tool" checklist would have walked a contributor into a wall of
  red.** It never mentioned `annotations.ts` — a hard gate — and reduced the count fan-out to
  "keeping the tool count accurate", when it is ~20 files including host-test constants and the
  `timeout-caveat.ts` class sizes, with a global-sed trap on wrapped lines and historical numbers.
  Both fixed, plus a new section on the `.uid` rules, which checks 18/19 will otherwise fail a PR
  for with no documentation anywhere explaining them.

## [1.30.0] — 2026-07-31

**Minor, not patch, and the reason is the first entry below.** `[Unreleased]` opened this session
holding four test/CI/hygiene changes, which would have been a patch. #149 then added **two tools** —
`main_screen_get` and `main_screen_set` — moving the surface 289 → 291 and the secure-default
276 → 278, and changed a shipped tool's error text. New surface is a minor by definition. Following
1.28.0 and 1.29.0, the change that forces the bump is stated at the top of the release rather than
buried inside a section named for something else.

Addon **1.9.2 → 1.9.3** as well, so this release has an Asset Library trip attached to it whenever
you want to make one; 1.9.2 is live and approved, and nothing here is required by anyone waiting.

### Added — `main_screen_get` / `main_screen_set`: the editor tab is now steerable (addon 1.9.3)
Since #139 `screenshot_editor` has refused a viewport under 8px rather than returning Godot's
collapsed 2x2 placeholder as if it were a frame. The guard is right and stays. Its **error was a dead
end**, though: it said *"switch the editor to the 2D tab, then retry"* — and there was no tool that
could switch tabs. A human at the keyboard can click it. The assistant this addon exists to serve
could not, which made a recoverable situation terminal.

Two new tools, taking the surface **289 → 291** (secure-default 276 → 278; privileged still 13):

- **`main_screen_get`** — read-only. Which tab is active, and which exist on this Godot version.
- **`main_screen_set`** — switch tabs, matching the name case-insensitively so `"2d"` works.

`viewport_not_rendered` now also **names the tab that is actually active** and the tool that fixes it:
*"The editor is on the "Script" tab. Call main_screen_set {"name":"2D"} and retry."* That lookup is
best-effort — an addon older than 1.9.3 cannot answer it, so a failure there degrades the message
rather than replacing a useful error with a bridge error.

**What the implementation had to discover.** `EditorInterface.get_editor_main_screen()` returns the
container, but its children are **not** named for the tabs — measured on 4.7, they are
`@CanvasItemEditor@10149`, `@Node3DEditor@10909`, two `@WindowWrapper@…` and `@EditorAssetLibrary@…`,
Godot's auto-generated node names, none of which `set_main_screen_editor` accepts. The name it *does*
accept is the `EditorPlugin`'s, which is not on the control. The first draft returned those raw names
and validated against them, so every real tab name was rejected — caught on the first live run, not
in review. Labels are now derived from the control's **class** (`CanvasItemEditor` → `2D`,
`Node3DEditor` → `3D`, and one level deeper for `Script`/`Game`, which sit inside a `WindowWrapper`
for the make-floating feature).

`main_screen_set` deliberately does **not** reject a name missing from that derived list: the map
cannot spell a third-party plugin's main screen and the engine's own lookup can, so the caller's
string is passed through and the result is **verified by read-back**. `set_main_screen_editor` returns
nothing and silently no-ops on an unknown name, so reading the state back is the only way to tell a
switch from a typo — and it is what makes the pass-through safe.

Both `EditorInterface` calls go through `has_method` + `call()`, per the rule `_scene_close` states: a
literal call to a method the running engine lacks fails at **parse** time and takes the entire addon
down on that version. The guard degrades one tool to `unsupported` instead.

New probe family **`AUTH_MAINSCREEN`** (6 assertions; `AUTH_SUMMARY` 185/185 → **191/191**) walks the
whole loop against a real editor: read the tab, watch `2d` refused at 2x2 with the error naming `3D`,
switch via lower-case `"2d"`, watch **the same call** return a real 2210x1808 frame, then restore the
original tab so the probe stays idempotent the way #146 made it. An unknown tab is asserted to fail
by name and hand back the live list.


### Fixed — the authoring plane's git oracle was a coin flip on a 12-second window (CI only, no tool change)
#144 added an independent `git status --porcelain example/` oracle beside `AUTH_CLEAN`, comparing
before-probe against after-probe. The baseline is captured the moment the addon's bridge port opens
— but the editor's own rewrite of `project.godot` (autoload `res://` → `uid://`, the trade #145
accepted) is **not synchronised with that port**, and the probe's own snapshot happens ~12s later
still. So the rewrite can land in any of three windows, and all three have now been seen on real runs:

| When the editor's rewrite lands | Baseline | After | Old oracle |
|---|---|---|---|
| Before the baseline | dirty | dirty | pass (no delta) |
| After `AUTH_CLEAN`'s snapshot (`restored=1`) | clean | clean | pass (probe restored it) |
| **Between the two** (`restored=0`) | clean | dirty | **failed** |

The third is a false alarm — the probe did nothing wrong — and session 149 hit it on a PR that
touched only `example-csharp/` sidecars and `contract_check.py`. Requiring an empty delta made a
required gate depend on a race.

The oracle now tolerates exactly one path in the delta, `example/project.godot`, and **asserts its
contents**: the only permitted hunk is the `BreakpointRuntimeBridge=` autoload line. Anything else
fails the job and prints the diff. This is strictly *more* than the old form checked, not a
concession — when the rewrite landed before the baseline the file was dirty on both sides and nothing
ever looked inside it, so a probe that scribbled a project setting would have gone unnoticed. Check
17 gates the *committed* form of that line; this gates what a live boot is allowed to do to it.

Verified against real repo states across five cases: no change (pass); the false-alarm ordering
(pass); autoload rewrite plus a stray `config/name` edit (fail, content); a dirty baseline plus a
stray edit — the case the old form was blind to (fail, content); an untracked leftover (fail, paths).
The first draft of the path filter matched nothing, because `diff`'s `> ` prefix plus porcelain's
blank status column yields *two* spaces; the case-2 run caught it.
### Changed — the `.uid` packaging question is decided and gated both ways (no tool change)
Session 148 §7.4 left twelve `.gd` files without `.uid` sidecars deliberately undecided, on the
grounds that whether uids ship to end users is a packaging decision rather than a hygiene one. It is
now decided, and the answer splits by directory, because the two directories are different kinds of
thing:

| Directory | Rule | Gate |
|---|---|---|
| Inside a Godot project this repo opens (`example/`, `example-csharp/`) | the sidecar **must** be committed | check 18, widened |
| The distributable addon (`addons/breakpoint_mcp/`) | no sidecar **may** be committed | check 19, new |

**Why 18 widened.** `example-csharp/` is a real Godot project and CI runs `--import` against it.
Measured: `--headless --path example-csharp --import` minted exactly **four untracked `.uid` files**
under `example-csharp/addons/breakpoint_mcp/` — session 148's problem reproducing itself in a
directory check 18 had explicitly excluded. Those four are now committed, and check 18 covers whole
projects rather than just `example/tests/`. Every `example/` script already complied.

**Why 19 is the opposite rule and not an oversight.** `addons/breakpoint_mcp/` is what
`stage-addon.mjs` copies verbatim into the npm package and what the Asset Library serves. It is not
inside any Godot project here, so nothing ever mints a sidecar in it and the hygiene argument simply
does not apply. On the packaging question the evidence says don't ship them:

- **The addon has zero `uid://` references to its own scripts.** The only `uid://` strings in tracked
  non-`.uid` files are the two `demo.tscn` scene self-uids. A shipped sidecar would resolve nothing a
  path does not already resolve.
- **Fixed uids cost something.** Measured on 4.7 — two copies of one script carrying the same
  committed uid produce `WARNING: UID duplicate detected between res://vendor/… and res://addons/…`
  on every import. Users vendor addons. The control run, same two copies with no sidecars, minted two
  distinct uids and logged nothing.
- **The "ship uids so `uid://` resolves on a cold clone" argument is empirically dead here, and #145
  is the proof.** That failure was `can't load from path: uid://dkyjj7tbsecr0` — and
  `uid://dkyjj7tbsecr0` is exactly the contents of `example/addons/breakpoint_mcp/runtime_bridge.gd.uid`,
  a **tracked** sidecar present on that fresh checkout. It failed anyway, because autoloads resolve
  before the import scan populates the gitignored `.godot/uid_cache.bin`. A committed sidecar does not
  make an early-boot `uid://` reference resolvable.

Check 19 turns today's accident — that directory is sidecar-free only because no editor has ever
imported it — into a stated decision a stray `git add` cannot quietly reverse. Both rules were made
to fail before being trusted: un-tracking one sidecar named it under check 18, and staging a single
`.uid` into `addons/breakpoint_mcp/` named it under check 19.

### Fixed — the authoring probe starts from the committed scene, not from its own last run (no tool change)
#144 made the probe re-runnable against one live editor by snapshotting and restoring `GODOT_PROJECT`
on disk. The edited scene was the other half of that claim, and no disk restore can reach it:
`node_add` and its neighbours mutate the editor's **in-memory** tree, which is never saved, never
appears in the snapshot diff, and dies only with the editor process. Measured after a single run:
**22 leftover `Auth*` nodes** under the scene root, with the editor reporting `main.tscn` unsaved. Run
N started from run N−1's tree.

Nothing was failing, and it is worth being precise about why. Every family asserts against the path a
tool *returned*, so Godot's deduplicated names (`AuthNodeRoot2`, `AuthNodeRoot3`, …) were followed
correctly. That is the same habit that saved the creator call in #144 §3's `AudioServer` bug — and
the same bug is the reason this is not left alone, because there the two calls that addressed the bus
by *literal* name passed while measuring the previous run's object. The distance between latent and
biting is one future family written with a literal name.

The probe now `scene_reload`s from disk immediately after `scene_open`, before anything mutates it —
~120ms, and a no-op on a fresh editor, since the edits it discards were never going to be saved. New
marker **`AUTH_SCENE_PRISTINE`** asserts the result through two oracles that share no machinery with
the reload, per #144 §2: the editor's own unsaved set (`get_unsaved_scenes`, 4.4+, reported as
`unsaved_supported`) and a count of surviving `Auth*` nodes (every version, and the one the families
actually depend on). Where the editor cannot report its dirty set — 4.3, still in this repo's matrix
— "cannot know" is explicitly not treated as "clean" and the footprint oracle carries the check.
`AUTH_SUMMARY` goes 184/184 → **185/185**; `scene_reload` had no probe coverage before this.

Verified by making it fail: with the reload suppressed against an editor that had already served
three runs, `AUTH_SCENE_PRISTINE` failed and named all 22 leftovers with both oracles firing
(`unsaved=true auth_leftovers=22`).

### Fixed — opening `example/` in the editor no longer dirties the tree (no tool change)
Booting the example project in a real Godot editor rewrote `project.godot` and minted three `.uid`
files, every single time. The working tree came back dirty from *looking* at the project, which made
a local editor session indistinguishable from real work in progress — and in #144's own session a
`git add -A` duly swept that dirt into a staged commit it had no business being in. Both halves are
now closed, and both are gated so they cannot come back.

**The comment Godot ate.** Five lines in `[rendering]` explained why the project selects
`gl_compatibility`: a CI runner has no GPU, the default Forward+/Vulkan renderer segfaults on init
there, and the game the DAP plane launches therefore never reached its breakpoint. Godot rewrites
`project.godot` from its in-memory `ConfigFile` on every boot, emitting its own header and **dropping
every other comment**, so that block was destroyed and hand-restored on a loop — a recurring
near-miss that survived only because someone kept noticing. The rationale now lives in
`contract_check.py`, which the editor cannot rewrite, and the **settings themselves are asserted**
rather than explained: new **check 17** fails if either `renderer/rendering_method` key moves off
`gl_compatibility`.

**The autoload rewrite — and the thing that did NOT work.** The editor also rewrites the autoload
from the `res://` path form to `uid://`. Committing that rewrite looked like the tidy fix, since it
would leave a boot with nothing left to change. **CI killed it in ninety seconds:**

```
ERROR: Failed to create an autoload, can't load from path: uid://dkyjj7tbsecr0.
       at: _create_autoload (editor/editor_autoload_settings.cpp:413)
```

The uid→path map lives in `.godot/uid_cache.bin`, which is gitignored and therefore absent on a fresh
checkout — and on 4.3, still in this repo's matrix, script uids do not exist at all. The autoload
resolved to null, the runtime bridge never started, its port never opened, and the runtime and peers
planes timed out against a game that was never listening. So check 17 now **rejects** the uid form
outright and requires the path form, carrying that CI output as the reason. The cost is accepted
deliberately: a local boot still rewrites that one line, undone with
`git checkout -- example/project.godot`, in exchange for an autoload that resolves on every engine
version and on a cold clone.

**The missing sidecars.** `example/tests/{frame_step_mover,peer_converge_mover,status_dock_layout_smoke}.gd`
shipped without their `.uid` files while the other eleven scripts in that directory had them. Nothing
was broken — Godot mints one on import and these are referenced by path from their `.tscn` — but the
sidecar was regenerated as untracked noise on every boot. All three are now committed, and new
**check 18** fails if a tracked `.gd` under `example/tests/` is missing one. Deliberately scoped:
`addons/breakpoint_mcp/` is the distributable addon, and whether uids ship to end users is a
packaging decision rather than a hygiene one.

Verified by negative test — each rule was made to fail on purpose before being trusted: check 18
named exactly the three scripts while they were untracked; check 17 caught `forward_plus`, and caught
the `uid://` autoload that CI had just rejected. A cold editor boot with `example/.godot` deleted first now leaves only the single
expected autoload line in `git status` — down from one modified file plus three untracked ones — and
the authoring probe still returns 184/184 with `AUTH_CLEAN` green.

### Fixed — the authoring probe restores `example/` instead of leaving it dirty (no tool change)
The A–G authoring probe writes roughly thirty real files into `example/` — `_auth_probe_*.tres`, the
`_asset_probe_*` resources, the Group M codegen `.gd` files, `export_presets.cfg`,
`default_bus_layout.tres`, the `.uid` and `.import` siblings the editor mints for each — and it edits
`project.godot`. In CI that costs nothing: the runner is thrown away. On a developer machine it meant
every local run ended in a dirty tree, the next run started from a project the previous one had
polluted, and recovery was a `rm -rf` glob typed by hand out of the file's header comment — narrow
enough, the comment warned, not to delete tracked `.uid` sidecars by accident.

**The glob was also the wrong shape of fix.** It enumerated the artefacts that existed when it was
last edited, so every family added since had to remember to extend it, and nothing ever checked that
it had. `host/test-integration/_workspace.mjs` (new, dependency-free, node builtins only) inverts
that: the probe snapshots `GODOT_PROJECT` **before it connects** and restores it on the way out — on
success, on assertion failure, and from the `FATAL` handler — so the artefact list is *discovered*
rather than maintained, and a family added tomorrow is cleaned up by construction. Because the
snapshot predates every mutation, a file that was already there — including a developer's own
untracked scratch — is not "new" and is never touched; the old glob would have happily matched a real
file named `_auth_probe_*`.

**And then it checks, rather than assuming.** `restoreDir()` reports what it *did*; the new
**`AUTH_CLEAN`** assertion re-walks the tree and re-hashes every snapshotted file to establish what is
actually *true*, failing with the offending paths named if anything survived. A cleanup that merely
runs is the same failure shape as a screenshot assertion that reads the label instead of the pixels
(#143): the step reports success and nothing compares the result against the claim. `AUTH_SUMMARY`
moves 183/183 → **184/184**.

**What the fix then exposed, which is the more interesting half.** With the tree finally stable, the
probe could be run twice back-to-back against one live editor for the first time — and the second run
failed. `AUTH_AUDIO_BUS_ADD` asserted `add.name === "AuthBus"`, but the `AudioServer` is global to the
editor process and nothing removes a bus (there is no `audio_bus_remove` tool, and adding one would be
new tool surface for a test's convenience). On the second run the name is already taken, so Godot
dedupes it to `AuthBus 2` — correct engine behaviour that the assertion rejected. Nobody had ever seen
it, because a re-run previously needed a `git checkout` too, which in practice meant restarting the
editor, which reset the `AudioServer` and hid the collision.

Worse, the two downstream calls addressed the bus by the literal name `"AuthBus"`, so on a re-run they
added a reverb to the bus the *previous* run created and asserted against that — reporting
`effect_count=2` and passing while measuring the wrong object entirely. Both now drive off the name
the tool actually returned; measured `effect_count=1` on every run. Verified across four consecutive
runs against a single editor process with no cleanup of any kind between them: 184/184 on runs 1, 3
and 4, buses deduping to `AuthBus 2/3/4` exactly as the engine intends, and `git` reporting a byte-for-byte
identical `example/` throughout.

A second, deliberately **independent** oracle backs it up in `integration.yml`: a `git status
--porcelain example/` step that fails the job on any residue. `AUTH_CLEAN` compares against the
probe's own snapshot and can name a leftover precisely, but a snapshot taken at the wrong moment
would make the restore and the assertion wrong in the same direction. git knows nothing about when
the snapshot ran or which directories it skips. The two have overlapping but not identical blind
spots — git ignores `*.import` and `.godot/`, the snapshot ignores tracked-ness — and both must be
clean.

`.godot/` is deliberately not restored: it is the engine's own import cache, it is gitignored, and it
churns on editor focus for reasons that have nothing to do with the probe. Neither are the two extra
`AudioServer` buses or the in-memory `ProjectSettings` edits, which are not on disk and die with the
editor process.

### Added — `screenshot_editor` verified on Metal, and the two assertions that finding justified (no tool change)
The `AUTH_SHOT_*` family is `screenshot_editor`'s only live coverage, and it runs under Xvfb + Mesa
llvmpipe — a screen that is always content-scale 1.0. Two properties of the tool were therefore
untestable in CI by construction: whether `Image.get_width()` reports **logical or physical** pixels
on a HiDPI display, and whether `SubViewport.get_texture().get_image()` reads back at all under
**Metal**, which is what every macOS user runs and no CI job touches.

Both were answered on real hardware (M2, Godot 4.7, 2880x1864 Retina): the capture path works, the 3D
viewport returns a genuine frame — grid, three axis gizmos, sky gradient — and the inactive tab's
collapsed placeholder still measures **2x2**, not 4x4. The dims are **logical**, so the
`MIN_RENDERED_VIEWPORT_PX = 8` guard keeps the same 4x headroom it has on an Xvfb screen. That
matches what #141 found for the runtime path; **both pixel paths are now confirmed HiDPI-clean on
hardware, not just under software rendering.**

**The gap the run exposed.** Every assertion in the family read the tool's own *label* — the mimeType,
the first four magic bytes, the `(WxH)` note — and none opened the payload. A correctly-sized,
correctly-labelled, entirely **black** frame satisfied all of them. That is the editor-side twin of
the defect #141 built `render_probe.tscn` to reject on the runtime side, and nothing here would have
caught it. Two assertions close it, backed by a new dependency-free 8-bit PNG reader
(`host/test-integration/_png.mjs`, ~130ms for a 1417x872 RGBA frame):

- **`AUTH_SHOT_IHDR`** — the dims read off the payload's own header must agree with the dims the tool
  reported, crossing the addon's `Marshalls.raw_to_base64` → JSON → stdio path.
- **`AUTH_SHOT_DRAWN`** — the frame must not be a single flat colour. A live 3D viewport measured
  **1106 distinct colours on Metal and 774 under llvmpipe** over a sampled grid; a rasterizer that
  initialised and drew nothing measures 1. Asserts `> 1` rather than a floor near either figure — the
  bar is "the rasterizer drew something", and the two drivers legitimately disagree on the count.

**The two drivers side by side**, which is the point of doing both:

| | Metal (M2, 2880x1864 Retina) | llvmpipe (Xvfb 1280x720) |
|---|---|---|
| 3D viewport | 1417x929 | 850x595 |
| distinct colours | 1106 | 774 |
| inactive placeholder | **2x2** | **2x2** |
| guard headroom | **4.00x** | **4.00x** |

The viewport dims differ because the windows differ. The **placeholder does not** — so the 8px
guard's margin is independent of both display scale and rasterizer, which is the specific claim the
Metal run existed to test.

`AUTH_SUMMARY` moves 181/181 → **183/183**. Also adds `host/verify_shot_editor_live.mjs`, a
**read-only and fully idempotent** scratch harness (unlike the authoring probe, it leaves `example/`
clean and re-runs without a `git checkout`) that makes the same assertions on real hardware from the
same `_png.mjs`, so the Metal run and the llvmpipe run are comparable rather than merely both green.
It logs `AUTH_SHOT_GUARD_MARGIN` / `SHOT_LIVE_GUARD_MARGIN` so the 8px heuristic's headroom is
recorded on every run instead of assumed.

### Added — `runtime-render-plane` CI job: `runtime_screenshot_diff` finally executes (no tool change)
1.29.0's notes closed with "`runtime_screenshot_diff` still has no automated coverage", and the
handoffs carried it as *the one thing CI structurally cannot do* — it needs a running game, not a
`--script` run, so it could not ride on `render-plane`. That premise was wrong in the same way
`RENDER_PATH_COVERAGE_GAP` §2 was wrong before #138 disproved it: what blocks the capture is the
dummy driver `--headless` selects, not the absent GPU. The same Xvfb + llvmpipe rasterizer works just
as well on a **booted game** as on a `--script` run. This job is that correction, executed — the last
of the three pixel-producing tools to gain live coverage.

`host/test-integration/runtime-screenshot.integration.mjs` drives `runtime_screenshot` and
`runtime_screenshot_diff` through the host's own Plane C wiring against a live game: capture a frame,
assert the returned bytes are a PNG whose **own IHDR header** agrees with the dimensions the tool
reported, save it as a reference, then diff. A degraded capture (`no_image` / `no_texture`) is a hard
error here, not the graceful skip it is everywhere else.

**What makes it coverage rather than green.** A diff of a uniform frame against a uniform reference
returns 0 whether or not the comparison ever reads a pixel — and `res://main.tscn` renders exactly
that, since its `Sprite2D` has no texture. So the probe boots a new `res://tests/render_probe.tscn`
(a 400x400 opaque patch, deliberately non-uniform) and toggles the patch's visibility to move a
known, bounded set of pixels: the full frame must then differ at **~0.2143** — 160,000 of 746,496 —
a region inside the patch at **1.0**, and a region in the opposite corner at **0.0**. No constant
satisfies all three, and the last one is the assertion a diff that reports everything as different
cannot pass. Region cropping, `tolerance`, `dimension_mismatch` and `bad_reference` are all covered
on the way through, and the frame is restored to an exact match at the end.

Verified on an Apple M2 (Godot 4.7, Metal, no `--headless`): all ten `RENDER_LIVE_*` markers green,
frame `1152x648` — the logical size again, confirming no HiDPI backing-store discrepancy on the
runtime path either — with `differing=160000` exactly matching the patch. **Negative control:** the
same probe against the same scene booted `--headless` fails with `no_image` and the message *"the
capture path did not execute — this job proved nothing"*, which is what the job is for. Forward+/
Vulkan on real hardware remains outside CI by construction.

## [1.29.0] — 2026-07-30

### Changed — the live screenshot test reported coverage it had never performed (no tool change)
`ops_unit_test.gd`'s `_test_live_screenshot` branched on whether the capture succeeded and scored a
PASS either way. The suite runs under `--headless`, which selects the dummy rasterizer, so
`get_image()` always returned null, the `else` branch was the only one that ever executed, and the
two assertions proving a frame was actually captured — mime type and non-zero dimensions — were dead
code in every run since they were written. `OPS_UNIT_SUMMARY pass=N/N` was green either way, and the
green meant "degraded cleanly", not "captured a frame". As a result `runtime_screenshot`,
`runtime_screenshot_diff` and `screenshot_editor` had no live coverage anywhere: no integration probe
and no workflow exercised a pixel-producing tool.

The test now reports four distinct outcomes instead of two passing ones — **captured** (assert PNG,
measured dimensions, payload size), **degraded** (assert it failed cleanly and record an
`OPS_UNIT_SKIP`, which is not a pass), **demanded** (`BREAKPOINT_TEST_REQUIRE_RENDER=1` turns any
non-capture into a failure, the same contract as `doctor --require-live`), and **impossible** (a live
rasterizer that cannot produce a frame is a defect, not an environment). The capture is taken on
frame 5 rather than frame 1: a viewport has no readable texture until something has been drawn into
it, and probing too early would report "no image" on a perfectly healthy renderer — the same
false-negative that hid this in the first place.

### Added — `render-plane` CI job: the capture path against a rasterizer that draws (no tool change)
Runs the same GDScript suite under Xvfb with Mesa llvmpipe and `--rendering-driver opengl3`, with
`BREAKPOINT_TEST_REQUIRE_RENDER=1`. **No GPU is needed:** llvmpipe is software but is a genuine
rasterizer, and the reason the capture never ran in CI was the dummy driver selected by `--headless`,
not the absent GPU — those are different things, and conflating them is why this went uncovered.
The job asserts its own premise: it fails if `rb.shot.mime` is missing from the log or if the capture
was skipped, so it cannot report green while proving nothing.

Verified on an Apple M2 with no `--headless`: the capture path executes for the first time,
`1152x648` (the logical size — no HiDPI backing-store discrepancy), **182/182, zero skips**. The same
suite under `--headless` reports **180/180 with the capture skipped**, and under `--headless` with
`BREAKPOINT_TEST_REQUIRE_RENDER=1` it **fails as designed**. Forward+/Vulkan on real hardware remains
outside CI by construction; `runtime_screenshot_diff` still has no automated coverage.

### Fixed — `screenshot_editor` returned a 2x2 placeholder as a successful capture
Godot does not tear down the main-screen tab you are not looking at; it collapses that tab's
SubViewport to its minimum size and keeps rendering it. `get_texture().get_image()` therefore still
succeeded, and the tool returned a **valid 2x2 PNG** — correct mime, correct magic bytes, an 81-byte
payload, and a note reading `Captured 2d viewport (2x2)`. Nothing anywhere reported a problem, and an
assistant would then *look at* four pixels and reason about the scene from them.

Measured on Godot 4.7 across four editor boots on real hardware: with the Script or 3D tab active,
`viewport=2d` returned `2x2`/81B; with the 2D tab active it returned `1297x492`/3.6KB. A **fresh
editor with no saved layout — the CI condition — boots on the 3D tab**, and `scene_open` on a `Node2D`
scene does **not** switch it, so the degenerate case is the default rather than the exception.

`screenshot_editor` now refuses any viewport under 8px on either edge with a
`viewport_not_rendered` error naming the measured size and how to fix it, instead of returning the
placeholder frame. Host-side only — no addon change, no schema change, no Asset Library trip.

**Minor, not patch:** a `screenshot_editor` call that used to return `ok` for a viewport Godot had
collapsed now returns an error, and `viewport_not_rendered` is a new code on the tool's surface.
Nothing that genuinely worked stops working — the old success carried four pixels — but the
observable contract of a shipped tool changed, and cutting this as a patch would say it had not.

### Added — `AUTH_SHOT`: the authoring plane now exercises a pixel-producing tool
Until this landed, **no CI job in this repo captured an editor frame at all** — #138 closed the
runtime half (a `SceneTree` root viewport under llvmpipe); this is the editor half, going through
`EditorInterface.get_editor_viewport_3d()` on a booted editor. Five assertions in
`authoring-plane.integration.mjs`: PNG mime, a decoded payload over 1 KB, PNG magic bytes, **measured**
dimensions of at least 64x64 — and that the *inactive* tab returns `viewport_not_rendered` rather
than a placeholder. It captures the **3D** viewport because that is the tab a fresh editor is
actually on; asserting against 2D would have asserted against a collapsed viewport.

The dimension check measures rather than pattern-matches on purpose: the first draft tested
`/\(\d+x\d+\)/`, which passes cheerfully on `(2x2)` and would have certified the exact placeholder
the family exists to reject. Verified on an Apple M2 under the CI condition — **181/181, zero
failures**, `2210x1808` captured, the inactive tab refused; and with the guard disabled as a control,
`AUTH_SHOT_INACTIVE_REFUSED` **fails as designed**.

## [1.28.0] — 2026-07-30

### Removed
- **The `network` capability group**, and with it `BREAKPOINT_PRIVILEGED_GROUPS=network` as a
  meaningful value. Nothing on the surface ever egressed beyond loopback, so the group gated two
  local tools behind a name that promised otherwise — see the Fixed entry below for why that was
  wrong in both directions. The token is now reported as unknown and ignored, and the two tools it
  gated (`backend_detect`, `backend_configure`) register by default, so an existing config keeps
  working and gains a warning rather than losing a capability. **Minor, not patch:** this changes the
  default advertised surface from 274 tools to 276 and retires a documented configuration value.

### Fixed
- **`doctor --require-live` called a squatted port a working bridge.** The check was a bare TCP
  connect, which succeeds for *any* process holding the port and never touches the shared secret. The
  two failures that look most like success were therefore invisible: another process on 9080 (a
  second editor, a stale instance, something unrelated), and a stale secret — the addon mints one into
  `res://.godot/`, so a copied or long-lived config goes quietly wrong. Both reported
  `editor-bridge reachable` and then failed on every real call, which is the worst shape a
  diagnostic can take: green, and wrong.

  The editor and runtime bridges — the two that speak our line protocol — now complete an
  authenticated `ping` using the same secret resolution `index.ts` uses, so the check fails exactly
  when a real call would, and the hint names both causes. The LSP and DAP ports keep the TCP probe:
  those belong to Godot, and anything further would be doctor reimplementing a foreign protocol. The
  failure is per-bridge, not a blanket downgrade.

- **The one number in `contract_check.py` that nothing checked.** Check 15's roster comment states
  that twelve tracked `.mjs`/`.ts` files carry `#!` while correctly committed non-executable (they
  are invoked as `node <file>`). That sentence was accurate and entirely unverified — it would have
  gone stale in silence the first time a thirteenth driver script was added, in the file whose whole
  job is refusing to let claims drift from code. It is now asserted, and reported in the check-15
  summary line.
- **A dropped connection reported "closed" and threw away the reason.** All five clients register
  `socket.once("error")` *inside* `connect()`, where it rejects the connect promise. Once the
  connection is up that handler is still armed, so a mid-flight `ECONNRESET` / `EPIPE` fired it,
  called `reject()` on an **already-settled promise — a silent no-op** — and then the `close` handler
  rejected every pending request with a generic "connection closed". The errno never reached the
  caller, which is exactly the difference between *the editor crashed* and *something else is holding
  that port*: the operator was told the connection closed and left to guess why.

  The last socket error is now recorded and named in the close-path rejection, in `bridge.ts` and in
  the shared `framing.ts` channel — so `lsp`, `cslsp`, `dap` and `csdap` get it too, rather than the
  bridge alone. It is cleared on a successful connect, so a stale errno can never be blamed for a
  later unrelated drop. Error **codes are unchanged** (`bridge_closed`, `closed`); callers and tests
  branch on those, and only the message gains the cause. A clean FIN still reports no cause at all,
  guarded so the fix cannot leave a bare "()" behind.


### Fixed
- **A capability group promised egress that no tool performed.** `capabilities.ts` gated
  `backend_detect` and `backend_configure` behind a default-OFF `network` group described as
  *"egress beyond loopback"*, while `annotations.ts` published `openWorldHint: false` for every tool
  on the surface and a test asserted *"every bridge is loopback-only"*. Both files could not be
  right. **`annotations.ts` was right.** Neither tool leaves the machine: `backend_detect` reads
  which SDKs are installed over the loopback editor bridge, and `backend_configure` writes a
  `res://` script through that same bridge. Group M's principle is *host nothing, scaffold
  everything* — the GENERATED GDScript is what reaches a provider, at game runtime, in a different
  process. There is not one `fetch`/`http`/`net.connect` in the module.

  The mis-tagging misstated the risk in **both** directions: it implied the secure default was
  holding back a network capability that never existed, and it made reading a list of installed
  addons look like opening an outbound path — so an operator who needed `backend_detect` had to opt
  into a group named for egress. `backend_configure` was also the only one of four sibling codegen
  tools (`leaderboard_scaffold`, `cloudsave_scaffold`, `auth_scaffold`) that was privileged, for a
  reason that turned out not to exist.

  The `network` group is **removed** rather than left gating nothing — a group advertised by
  `doctor` and `godot://capabilities` that protects against nothing is the same class of defect.
  `BREAKPOINT_PRIVILEGED_GROUPS=network` now warns as an unknown token and the tools are present
  anyway, which is strictly better than before. A future tool that genuinely egresses must
  re-introduce the group **and** list itself in `OPEN_WORLD`, and two new controls now require the
  two files to agree in both directions — the check that was missing for six releases.

  **Surface change:** the secure default is now **276 tools, not 274**, and the privileged drop is
  **13, not 15**. The full surface is unchanged at 289. Every gated count claim moved with it.


## [1.27.1] — 2026-07-30

### Fixed
- **The status dock could push the bottom panel and the FileSystem dock out of the editor window**
  ([#124](https://github.com/jlivingston-Cipher/godot-breakpoint-mcp/issues/124)). An editor dock
  slot cannot scroll and cannot be shrunk below its content's minimum size, so a dock that reports
  an oversized minimum is not clipped — it raises the minimum size of the whole editor layout, and
  the editor can only satisfy that by pushing whatever sits below out of the window. Measured in a
  real headless editor, this dock demanded **311 x 4015 px** where every built-in dock asks for
  104–125 px of height.

  The height came from three `AUTOWRAP_WORD_SMART` labels. A `Label` with autowrap reports a minimum
  height measured at its *narrowest* possible width — about one glyph — so the pause-state, config
  and footer labels claimed 740, 1328 and 1421 px, and the `VBoxContainer` summed them. Every
  `Control` now lives in a `ScrollContainer`, which decouples the dock's minimum height from its
  content height; this is what `EditorInspector` does for the same reason. The width came from one
  un-trimmed status line measuring 311 px against a 280 px default dock column; the labels that do
  not wrap now trim with an ellipsis and keep the full line as a tooltip. The dock's minimum is now
  **192 x 0 px** — smaller than every built-in dock.

  This also explains the two things that made the report confusing. Under distraction-free mode the
  side docks are hidden, which removed the oversized minimum and made the bottom panel usable again
  — the reporter correctly described that as the inverse of the bug. And resetting the editor layout
  or deleting the *global* `editor_layout.cfg` could never have helped: minimum sizes come from code,
  and since Godot 4.7 the dock layout is stored per project in `.godot/editor/editor_layout.cfg`.

  Guarded by `example/tests/status_dock_layout_smoke.gd`, wired into the `gdscript-unit` CI job. It
  asserts the numbers the editor layout actually reads *and* the structure that keeps them true, so
  it fails on the unfixed addon on a Godot build whose font metrics differ from the measured one:
  9/9 against the fix, 0/9 against `1.9.1`.


## [1.27.0] — 2026-07-29

### Fixed
- **The late-reply fix reached one client out of five, and named the wrong knob on one of those.**
  The ledger shipped in the editor bridge; `lsp.ts`, `cslsp.ts`, `dap.ts` and `csdap.ts` each still
  carried the identical delete-then-drop shape, where the timeout timer removed the pending entry
  and the real response then hit `if (!p) return` and vanished with nothing on stderr. The bridge's
  own justification — the addon polls its socket once per frame, so a frame can outlast any deadline
  — is bridge-specific, but the **drop** is not: a debug adapter answering `setVariable` or
  `evaluate` after its deadline mutated debuggee state while the host reported a failure, which is
  the same duplicate-mutation risk that motivated the original fix. All four now reconcile a late
  response and log the method, the overshoot, and the deadline that would have worked.

  The ledger moved to `host/src/late-reply.ts` and is **shared by all five clients** rather than
  copy-pasted four more times; the bridge's existing late-reply tests were left untouched precisely
  so they serve as the regression proof for the extraction.

  Separately, the deadline knob named in that log line is now per-**instance**. `index.ts` builds two
  `BridgeClient`s and they read different variables, so a late reply on the runtime bridge advised
  raising `BREAKPOINT_BRIDGE_TIMEOUT_MS` when only `BREAKPOINT_RUNTIME_TIMEOUT_MS` could move it —
  advice that cannot work is worse than none. The editor bridge's wording is byte-identical to what
  shipped.

  Scope is unchanged in both directions: the **250 ms floor stays on the two frame-polled deadlines
  only** (`config.ts` is not touched — the ledger is constructed with a knob *name*, never a
  deadline value), and there is no tool-surface change — 289 / 274 / 15 and addon `1.9.1` as before.

- **Eleven timeout env vars are hardened the way the four ports already were.** `1.24.0` added
- **A bridge timeout claimed nothing happened, while the reply proving otherwise was discarded in
  silence.** When a deadline fired, the timer deleted the pending entry, so the addon's real reply —
  a complete, correct `{id, ok, result}` — arrived, found nothing to correlate to, and was dropped
  **without so much as a log line**. Measured against the real client: one stderr line in the whole
  run, and it was `bridge connected`. Meanwhile `bytesWritten=130` on an undestroyed socket at the
  instant of rejection proves the request *had* been delivered — a genuinely unreachable editor
  fails earlier and differently, as `bridge_unavailable`. The host held the evidence that its own
  error was wrong and threw it away.

  The timeout path now records the id before rejecting, so a reply landing afterwards is reconciled
  and logged with the method, the overshoot, and the deadline that would have worked. It cannot
  un-reject a settled promise, and it deliberately does not try to suppress the retry: **that retry
  is the agent's, not the host's** — a fresh MCP tool call with a fresh `randomUUID()`, which no id
  bookkeeping here can recognise as a retry rather than a legitimate repeat. Serving a cached late
  result to a params-matching call was considered and rejected for exactly that reason; it would
  trade a visible duplicate for a silent omission, which is worse.

- **`1.26.0` closed the `NaN` spelling of a too-short deadline, not the class.** `positiveInt`
  rejects `0` on the reasoning that "a deadline of 0 is not a shorter deadline, it is the `NaN`
  failure with a different spelling." That is right and it does not stop at zero:
  `BREAKPOINT_BRIDGE_TIMEOUT_MS=1` was **accepted**, and driven against the real `BridgeClient`
  reproduces the escalation verbatim — `timed out after 1ms` twice, two `Enemy` nodes.

  Deadlines that reach a frame-polled bridge now have a **250 ms floor**, rejected rather than
  clamped, matching how the guard already treats `0`. Both addons poll their socket from `_process`
  and dispatch synchronously, so they cannot answer inside a frame no matter how trivial the
  request; the editor throttles its main loop when idle, so "one frame" is not the 16 ms a running
  game suggests. **The floor covers those two deadlines only.** An early cut applied it to all
  eleven timeouts and broke two `csdap` tests that deliberately set a 200 ms fail-fast — and those
  tests were right: LSP, DAP and the asset-gen backend are ordinary request/response over TCP or
  stdio, nothing frame-polls them, and 200 ms is reasonable there. A justification that stops at the
  frame poll gives a floor that stops at the frame poll. **Input validation guards one cause of a
  premature deadline; it cannot guard the other** — a legitimate 15000 ms deadline fails identically
  the moment a frame outlasts it, which `bridge_server.gd` documents happening on a `scene.save`
  that triggers a rescan/reimport. That is why the ledger above exists as well as this.

  `port()` — rejecting `""`, `"nope"` and `"80a80"` rather than letting them reach `Number.parseInt`
  and become `NaN` — and every timeout kept the `Number.parseInt(x ?? "15000", 10)` pattern that
  function's own docstring condemns, thirteen lines below it. `??` catches only null/undefined, so
  an exported-but-empty `GODOT_LSP_TIMEOUT_MS=""` yielded `NaN`.

  **A NaN deadline is worse than a NaN port, because the request is already on the wire.**
  `setTimeout(cb, NaN)` does not throw — it fires on the next tick, measurably sooner than
  `setTimeout(cb, 1)`, with no Node warning — while the addon polls its socket from `_process`,
  once per frame, so it cannot answer inside ~1 ms. The deadline wins *deterministically*: the host
  reports `timed out after NaNms`, **the addon still executes the mutation**, and the real reply is
  dropped as an unknown id. An agent that retries a reported failure applies it twice — reproduced
  end to end as two `Enemy` nodes after two reported timeouts.

  All eleven now use a new `positiveInt()` mirroring `port()`, which also closes two cases `NaN`
  never covered: `parseInt` stops at the first non-digit, so `"15s"` silently became a 15 ms
  deadline and `"20_000"` became 20 ms; and past `2^31-1` `setTimeout` warns and uses 1 ms, landing
  back in the same near-zero failure from the opposite direction. Zero and negatives fall back
  rather than clamp — a deadline of `0` is not a shorter deadline, it is the `NaN` failure with a
  different spelling.

- **A C# language server installed mid-session is now picked up without restarting the host.**
  `StdioChannel` hooked `exit` to reset itself; a failed spawn emits `error` then `close` and
  **never `exit`** — measured, not inferred. So `closeCb()` never ran, `CsLspClient` never cleared
  the rejected `initialized` promise it had cached, and every later `cs_*` call re-returned the
  original `ENOENT` for the process's whole lifetime: install OmniSharp after the first failed call
  and the host stayed convinced it was missing. The TCP sibling hooks `close` and has always
  self-healed from a refused connection; **the entire difference was one event name.**

  The reset moved to `close`, which is a strict superset — a process that really ran emits
  `spawn` → `exit` → `close`, so the normal path still notifies exactly once. It deliberately did
  **not** move into the `error` handler, where it would fire a turn sooner: `onClose()` rejects
  every pending request with a generic "connection closed", which would have replaced the
  actionable "Install OmniSharp." hint with it. The heal trails the caller's error by one event-loop
  turn, which no real second tool call can observe, and the lateness is now commented as
  load-bearing rather than incidental.

  Also closed alongside it: a synchronous `spawn()` throw (bad options rather than a missing binary)
  nulled `this.starting` **inside the promise executor**, which the assignment on the next line then
  overwrote with the rejected promise — the same cache-the-failure-forever bug on the one path the
  `close` hook cannot reach. Latent today, since every call site passes validated config strings.

- **`card_deck_from_table` no longer reports mapped columns as unmapped when a filter selects no
  rows.** `art_column` and `filter.column` were counted as referenced off the *arguments*, but the
  `column_map` slots were counted off the *rows*, inside the stamping loop — so a filter matching
  nothing skipped the loop entirely and `unmapped_columns` came back naming every column the caller
  had explicitly bound. The asymmetry inside a single output is what made it a bug rather than a
  defensible semantic: over a `name,cost,type,flavor,unused` table mapping `title←{name}`,
  `footer←{name} · {type}` and `points←{cost}`, a filter on `type` that matched no row returned
  `["cost","flavor","name","unused"]` — every mapped column but `type`, which was spared only
  because `filter.column` seeded it. The same call with a filter that matches returns
  `["flavor","unused"]`, and now both do.
  The column-map scan is hoisted out of the loop, and a new pure `columnExprPlaceholders()` reads
  the `{placeholder}` names straight off the expression with no row to resolve against. Both it and
  `resolveColumnExpr` drive one shared scanner, so they cannot drift on what counts as a
  placeholder; malformed placeholders are still raised by `resolveColumnExpr` on the first real row.

- **`contract_check.py` can no longer be blinded by a digit in a tool name.** `registered_tools`,
  `catalog_index_tools` and `catalog_shapes` netted names with `[a-z_]+` while `annotated_tools`
  and `output_schema_shapes` used `[a-z0-9_]+`. A tool following the repo's own
  `recipe_2d_player_controller` convention was therefore **invisible to checks 3, 4, 6 and 11 at
  once** — no catalog row demanded, no MCP risk annotations demanded, no output schema demanded,
  and it moved no count, so the gate's output was **byte-identical to a clean run**. The same tool
  renamed without the digit failed with five separate errors. No shipped tool name contains a
  digit, so this was latent, not live. The bridge-method nets were widened symmetrically (check 1
  compares the two sides, so widening one alone would manufacture a false failure).

### Added
- **`contract_check.py` check 16 — shape parity gets a floor, and the two checks it guards go from
  267/240 comparisons to 289/287.** Checks 6 and 7 compared set **intersections**, and an
  intersection has no floor: a tool the catalog parser could not read dropped out of the comparison
  with no error and no count anyone asserted. Measured on the tree this shipped from, one
  find-and-replace of `"properties"` → `"props"` across the catalog's 651 occurrences drove **both
  checks to `0 checked` while the gate still exited 0** — and the JSON linter, reading the same
  file, still reported `514 (0 invalid)`. A release in which every documented input and output
  shape was wrong would have passed green. Deleting one `**Input**` block, or a whole `###` tool
  section while keeping its index row, passed the same way.

  **The floor is set equality against the registered surface, both directions**: every tool is
  compared, or exempt with a stated reason. That makes "documented by cross-reference" and
  "documentation deleted" different observables for the first time — previously they were the
  same one.

  **The exemption roster ships empty**, because the parser was taught to read the catalog instead
  of the catalog being rewritten to suit the parser. The catalog states a shape in four ways and
  all four are now read: a fenced ` ```json ` block (512); a backticked JSON object inline (4); a
  backticked brace list — `{ ok, checked, failures[] }`, the convention the `runtime_*` assert
  family uses, where the surrounding prose carries meaning a properties block cannot (35); and a
  reference, either to another tool (13) or to one of the three shared family envelopes the
  catalog defines once and refers back to (14). A reference resolves to the **real** shape, so a
  family whose envelope drifts still fails — it is not an exemption wearing a different hat.

  Three parse bugs surfaced and are fixed rather than rostered around. The heading split took only
  the first name from a combined heading (`` ### `dbg_continue` / `dbg_step` ``), hiding
  `dbg_step`, `cs_dbg_step` and `runtime_set_property` entirely — their blocks were written and
  invisible. A schema naming its root through `$ref` into `$defs` (`scene_get_tree`'s recursive
  `SceneNode`) reported no properties. And an empty `"properties": {}` — `dbg_continue` genuinely
  takes no params — was falsy, so a no-param tool read as undocumented; the parser now tests for
  `None`, never truthiness.

  Two more were found by the check failing on its own first run, which is the argument for it.
  `runtime_set_property` inherited from `node_get_property` because both are named in one sentence
  and the first match won — the two differ by exactly the `value` param, so the gate reported a
  real-looking drift that was purely its own choice; a reference now picks the target sharing the
  longest trailing name segment. And the "extra fields" clause swallowed backticked **tool** names
  from the explanation trailing it, reading `runtime_spawn_peers` as a param of
  `runtime_get_property`.

  Verified by eight mutations, each logging evidence it negated something before the gate ran,
  bracketed by clean controls. The four from the audit — delete one Input block, delete a whole
  section keeping its index row, rename `properties` in one block, rename all 651 — every one of
  which **passed** before, now fail. Four more cover the new surface: breaking a shared envelope
  definition, repointing a cross-reference at a tool that does not exist, dropping a field from a
  brace list, and adding an exemption for a tool that is already compared. Three rows of the first
  run mutated nothing because they named a tool that is not registered; the evidence lines caught
  it and they were re-run against a real one.

- **`docs/TOOL_CATALOG.md`: the shared backend scaffold envelope is defined in a fenced block**,
  like the generator and codegen envelopes already were. It was the only one of the three stated
  as prose on the first tool that used it and referred to by the other three, which is why those
  four outputs could not be compared to `schemas.ts`. The fields are lifted unchanged from
  `backendScaffold` there.

- **`contract_check.py` check 15 — file modes. The exec bit is a contract nothing else could
  see.** `1.26.0`'s own release cycle shipped a mode regression and then a fix for it: #125 rewrote
  this script through a mount that reports every file as `0600`, the mode landed as **`100644` in
  the commit** on a file that had been `100755` since the project's first commit, and it merged
  with 20/20 checks green. Every call site spells it `python3 scripts/contract_check.py`, so only
  `./scripts/contract_check.py` broke — and nothing runs it that way. #126 restored the bit by
  hand. Nothing in the repo could have caught either the loss or the restore.

  The subject is the **index** mode, not the working tree's: `core.fileMode`, a umask, a network
  mount or a zip round-trip all change what `ls -l` reports while leaving the committed mode
  untouched, and the committed mode is the one that ships and the one that regressed.

  The assertion is set **equality**, both directions — `{tracked files at 100755} == EXEC_ROSTER` —
  which is why it takes a roster and not a heuristic. "Anything with a shebang is executable" is
  false here: twelve tracked `.mjs`/`.ts` files carry `#!` and are correctly `100644`, because they
  are invoked as `node drive.mjs`. A roster member falling to `100644` is the regression that
  already happened; a non-member climbing to `100755` is the same drift arriving from the other
  side, and is how a data file or a doc ends up executable in a tarball. Roster members must also
  carry an interpreter line — an exec bit on a file the kernel cannot launch is a mode that means
  nothing.

  A second, earlier assertion catches the **unstaged** mode change, which is the state #125
  committed *from*. It asks `git diff --summary` rather than `os.stat` on purpose: git honours
  `core.fileMode`, so the check stays quiet on filesystems that cannot represent an exec bit rather
  than failing every run there. **It fired for real while the check was being written** — the editor
  used to add check 15 rewrote `contract_check.py` and silently dropped it to `0644`, reproducing
  #125's exact mechanism through a different tool, and the half-finished check caught it.

- **`contract_check.py` — three completeness assertions, one per roster that had none.** Each of
  these checks printed a reassuring number that counted what it *could* have compared rather than
  what it did, so each could be reduced to comparing nothing while the gate stayed green. This is
  the same defect check 14's own review found three times inside that one check; these are the
  instances elsewhere in the file.

  - **Check 10 — `RESOURCE_COUNT_REQUIRED`.** The doc half was opt-in: `doc_resource_claims()`
    returns regex hits, so `N doc count(s) checked` was matches *found*, not sites *required*.
    Rewording every "6 MCP resources" to "six MCP resources" produced
    `6 registered · 0 doc count(s) checked` and **passed** — meaning a 7th resource could ship with
    no doc mentioning it. `README.md` and `docs/USER_GUIDE.md` must now state the count in digits.
    This mirrors `RECIPE_ROSTER_REQUIRED` exactly: check 12 closed this same hole for recipes, and
    check 10 had a code-side roster (`EXPECTED_RESOURCE_URIS`) with no doc-side counterpart — **the
    fix already existed in this file, two checks over, and simply had not been applied here.**

  - **Check 1 — `BRIDGE_CALL_SCAN` / `BRIDGE_SCAN_EXEMPT`.** The scan list was a hand-maintained
    roster of 22 modules with 11 unscanned, and nothing asserted it stayed complete: a
    `bridge.call("made.up.method")` added to `tools/knowledge.ts` left `Host bridge calls: 176`
    unchanged and **exited 0**, while the identical line in a scanned module failed the gate. The
    exclusion itself is correct and stays — `tools/dap.ts` and `tools/csdap.ts` drive a `DapClient`
    over the Debug Adapter Protocol, so scanning them would fail the gate on correct code — but a
    new bridge-speaking module must now be filed deliberately into one list or the other instead of
    being silently invisible.

  - **Check 3 — a completeness assertion on the tool-name scanner.** Widening the net
  fixes today's hole; this is what makes the next one fail loudly instead of silently. The gate now
  re-scans every `registerTool` / `registerTaskTool` site with a deliberately permissive literal net
  and **fails, naming file and line**, on any registration whose name the strict net cannot match —
  so it asserts the scanner captured every site rather than trusting the count it produced.


- **Bridge-timeout errors now carry a caveat scaled by the tool's own annotations.**
  `Bridge error [timeout]` reads as *the call did not go through*, which is not what the host knows;
  an agent that believes it retries, and on a mutating, non-idempotent tool that applies the change
  twice. The tool surface now appends, per `annotationsFor(name)`: **nothing** for the read-only
  tools — a stale read is not a hazard, and `peers.ts` deliberately runs a 1 s liveness ping whose
  timeout is routine — *"retrying is safe"* for the mutating-but-idempotent ones, and *"retrying may
  apply it a SECOND time — verify the editor state before you do"* for those that are neither.

  It **appends and never rewrites**: `tools/dap.ts` and `tools/csdap.ts` branch on the
  `timed out after` substring, and `dap.test.ts` asserts it, so the existing sentence is
  load-bearing. It is scoped to the bridge's envelope alone — an LSP or DAP timeout implies no
  editor-side mutation and is left untouched.

  This is the only layer that *can* target it. `bridge.ts` sees a GDScript method string and never a
  tool name, and `makeCall` does not take one; the tool name exists at registration, so the caveat
  rides the same `applyOutputSchemas` → `applyAnnotations` → `applyCapabilities` wrapper idiom,
  slotted between the last two so a tool dropped by a disabled capability group is never wrapped.
  Read-only tools are not wrapped-and-inert — they are **not wrapped**, and keep their exact
  previous handler identity.

- **`contract_check.py` — annotation-class sizes are derived rather than warned about.** The new
  caveat's blast radius is prose that decides user-visible text, so "72 tools" is exactly the kind
  of number this gate exists to distrust. Stating them raised the file's unverified-prose-claim
  count from 0 to 4 — visible, but visible is not verified, and an exemption would have been a lie
  because the numbers *are* derivable.

  A claim now resolves EXACTLY when it names its class in backticks — `` `read-only` 92 tools ``,
  `` `mutating+non-idempotent` 72 tools `` — computed from `annotations.ts` by the same set
  arithmetic the token names. A **bare** count with no class token still warns, deliberately: the
  point is not to bless the number 72, it is to tie a number to the derivation that produces it. If
  `ALL_ANNOTATED` cannot be parsed, a claim is a hard error rather than resolving against an empty
  set and passing blind — check 12's vacuity rule. This is the all-false check generalised, and the
  two now share **one reader** for `annotations.ts`'s name lists rather than two copies of the same
  regex that could disagree about what a list contains.

## [1.26.0] — 2026-07-28

**Gates the release ritual itself, and deletes the version literals that gate found.** The host
version lived in five files and the addon version in five more, nothing compared them, and the
checklist naming them existed only as prose in session handoffs — so `1.24.0` and `1.25.0` both
missed `host/package-lock.json`. Check 14 closes the third member of the drift class checks 10–12
close, and the only one that had already gone wrong twice before anything looked.

It found two stale versions on its way in, one of them shipping since the project's first commit.

The surface is unchanged at **289 / 274 / 15** and the addon at **1.9.1**. A **minor** release: no
tool, resource or recipe count moves, and the only runtime change is that three version strings are
now read from `package.json` instead of being wrong.

### Added
- **`contract_check.py` check 14 — version parity, the release ritual gated.** The third member of
  the drift class checks 10–12 close, and the one that had already gone wrong **twice in consecutive
  releases** before anything looked. The host version lives in five files (six fields —
  `package-lock.json` carries two) and the addon version in five more, nothing compared them, and
  the checklist naming them existed only as prose in session handoffs — so each release re-derived
  the list from memory. `1.24.0` and `1.25.0` both missed `host/package-lock.json`; the first was
  caught by review, the second only because someone went looking. **A checklist that lives in
  append-only history is not a checklist.**

  Both versions are **derived, never typed** — the host's from `package.json` (what npm actually
  publishes), the addon's from the canonical `plugin.cfg` — so no failure can be silenced by editing
  a constant in the script. The roster is explicit, and scanned via `git ls-files` so it covers what
  would actually **ship**: a new *tracked* copy nobody lists fails, while a developer's untracked
  scratch project does not. **Verified to fail 10 ways on values**, one per site, each reverted
  byte-exact, control green either side — plus an unlisted tracked copy, a lockfile with the fields
  missing, and a fresh clone with no build output.

### Fixed
- **`example/addons/breakpoint_mcp/operations.gd` reported `ADDON_VERSION := "1.7.0"` — two addon
  releases stale.** Found by check 14 on its first clean run. Its own `plugin.cfg`, in the same
  folder, said `1.9.1`, and the file was byte-identical to the canonical copy in every other
  respect. `ADDON_VERSION` is what `_ping()` reports to every connected client, so the example
  project had been introducing itself with the wrong version since `1.8.0`.

  Nothing caught it because the test that looks like it covers this —
  `example/tests/ops_unit_test.gd`'s `_eq("ping.version", p["addon_version"], Ops.ADDON_VERSION)` —
  **compares the value to itself** and therefore passes for any value. The assertion is correct at
  its own scope (it proves `_ping()` surfaces the constant) so it is left alone with a note saying
  what it can and cannot prove, following the precedent set for `registration.test.ts` in 1.22.0.

- **`lsp.ts` and `cslsp.ts` announced `clientInfo: { version: "0.2.0" }`** to Godot's language server
  and to OmniSharp — **unchanged since the initial commit**, when the project was 0.4.3. Twenty-odd
  releases went out telling every LSP server this host was version 0.2.0, and nothing noticed,
  because a literal nobody compares to anything cannot go stale loudly. Found by the adversarial
  review of check 14, hunting for version sites the roster missed.

  Fixed by **removing the literals rather than gating them**: a new `host/src/version.ts` exports
  `packageVersion()`, read at runtime, and `cli/tools.ts`'s private copy of that helper is gone.
  The best outcome for a version string is not a gated literal but no literal at all —
  `host/src/index.ts`'s `serverInfo` is now the only one left, and check 14 gates it.

- **`cli/tools.ts` carried a prose release checklist that was wrong**, naming "both `plugin.cfg`s"
  (there are three tracked), omitting `package-lock.json`'s two fields, the README badge and the
  USER_GUIDE stamp, and listing the doctor/init strings, which are runtime reads rather than stamps.
  It was the only copy of the ritual inside the repo and it disagreed with the gate. Removed — the
  check is the checklist now.

### Fixed during review (defects in the change above, found by refuting it)
- **Check 14 crashed on a fresh clone — including the CI job that runs it.** The roster named
  `host/addon/breakpoint_mcp/*`, which is **gitignored build output** that `npm run stage-addon`
  creates by copying `addons/breakpoint_mcp` verbatim. The `contract-check` workflow is checkout +
  `python3` with no node and no build, so the check would have raised `FileNotFoundError` on the
  very gate it was written to protect — and those two sites could never have drifted independently
  anyway. Dropped from the roster, with `_one()` now reporting a missing roster file as an error
  instead of raising.
- **The two `package-lock.json` fields were silently unasserted when absent** — `.get()` returning
  `None` meant no comparison *and* no error, so a lockfileVersion-1 file (no `packages` object)
  passed while claiming a site count that included them. Exactly the bug this check exists to
  prevent, wearing the check's own reassurance. Absent is now a failure.
- **The printed site count over-claimed**, being a roster length rather than a count of comparisons
  actually performed — so it read the same whether ten assertions ran or none did. It now counts
  executed comparisons.
- **The roster scan walked the whole working tree**, so `_to_delete/` scratch or a
  `breakpoint-mcp init --project ./scratch` inside a checkout would have failed the release gate,
  and a checkout under a path containing `node_modules` would have failed with the opposite error.
  Now scanned via `git ls-files`, with the tree walk kept as a fallback for exported trees.

## [1.25.0] — 2026-07-28

**Closes the port-collision class on every path that starts a game.** 1.24.0 gated the two
`godot_run_*` tools and explicitly named the debugger half as still open rather than letting the
class read as shut; this closes it. Four launch paths are now gated and four more are documented as
deliberately *not* gated, each with the reason recorded at its call site.

The surface is unchanged at **289 / 274 / 15** and the addon is untouched at **1.9.1** — every
change here is host-side. A **minor** release: the new `allow_port_conflict` inputs are additive and
optional, and on a free runtime port behaviour is byte-identical to 1.24.0.

Worth reading the *Fixed during review* section below before the rest. The gate shipped with two
defects of its own, one of them pinned in place by a test, and both were found by handing the diff
to a reviewer whose only instruction was to refute it.

### Fixed
- **`dbg_launch` and `cs_dbg_launch` now refuse a held runtime bridge port too — the port-collision
  class is closed on every path that starts a game.** 1.24.0 gated `godot_run_managed` and
  `godot_run_project` and named this half as still open rather than letting the class look shut. The
  debugger path has the identical failure: the editor launches the game, its autoload cannot
  `listen()`, it keeps running bridgeless, and every `runtime_*` call answers from whichever process
  already held the port.

  **The message lists every remedy with the condition it applies under, and asserts nothing about
  which is live.** All the probe learns is *that* the port is held — never by what. The holder may be
  a `godot_run_managed` child (`godot_stop` clears it), a game already under the debugger
  (`dbg_attach` / `cs_dbg_attach` reaches it), or a window the developer opened themselves. The two
  planes contend for the *same* port, so a debugger refusal is often about a run-plane holder.

  **And the override reads differently here, honestly.** A DAP session is addressed by *session*,
  not by port, so with `allow_port_conflict: true` breakpoints, stepping and variable inspection all
  work normally against the second game; only `runtime_*` is corrupted. On this plane the override
  is a reasonable everyday choice rather than a last resort, and the text says so. Over-warning is
  how a check earns the reputation that gets it disabled.

- **`cs_dbg_launch` is gated only when this looks like a Godot launch** — the program's filename
  contains `godot`, or the args carry Godot's `--path` project flag (the default args do). `program`
  exists so netcoredbg can debug an arbitrary .NET program; such a program has no Breakpoint autoload
  and no interest in the runtime port, and gating it would be a check firing when nothing is wrong.
  The gate defaults to *yes* and skips only when the caller has clearly aimed elsewhere.

### Deliberately not gated (recorded so the class is closed knowingly)
- **`dbg_attach` / `cs_dbg_attach`** — attaching to the process that already holds the port is the
  *remedy* the refusal points at. Gating it would close the only exit.
- **`dbg_restart` / `cs_dbg_restart`** — at check time the session's **own** game still holds the
  port and is about to be terminated, so a probe there would fire on the very process it is
  replacing: a guaranteed false positive on the happy path, every restart. If some *third* process
  holds the port the relaunched game lands bridgeless exactly as before; that residue is accepted
  knowingly rather than traded for a check that cries wolf.
- **`godot_launch_editor`** — binds `bridgePort`, not `runtimePort` (unchanged from 1.24.0).
- **`godot_export` / `godot_import` / `godot_run_headless_script`** — run-to-completion tasks that
  nobody addresses through `runtime_*`, so the wrong-process class does not apply to them. If one of
  them does hold the port, the gates above catch it from the other side.

### Tests
- **Eight tests, three verified to fail against a tree with the probe neutralised**, control green
  either side (68/68 with the guard, 65/68 without). Others assert the *absence* of a false
  positive — a genuinely different .NET program launches, the override launches, `dbg_attach` and
  `dbg_restart` stay ungated — and are green either way by design.
- **Two of them exist because an adversarial review found the first version wrong** (see *Fixed
  during review* below): one pins that an explicitly-named Godot Mono binary is gated, one that
  `--path` alone is enough.
- Both DAP harnesses now take an explicit runtime port instead of inheriting the real `9081`.
  Leaving the default in place would have made every launch test depend on whether a game happened
  to be running on the machine — flaky in the direction that teaches people to ignore the suite.
- Host suite **498 → 506**.

### Fixed during review (defects in the change above, found by refuting it)
- **The debugger refusal asserted something the probe cannot know.** It read *"a debugger-launched
  game is owned by the editor, so no tool here can stop it"* and withheld `godot_stop` on that
  basis — false whenever the holder is a `godot_run_managed` child, which is the commonest case,
  since both planes contend for the same port. Worse, a test asserted the message did *not* mention
  `godot_stop`, so the falsehood was pinned. Message rewritten to list every remedy with its
  condition; the assertion is now inverted to pin the honest text.
- **`cs_dbg_launch`'s gate tested the wrong thing.** `resolvedProgram === cfg.csDapProgram` is
  equality against the *default*, not a question about Godot — so explicitly naming the real Mono
  binary, which `config.ts` documents as the way to point at one, skipped the gate on the exact
  mainline path this change exists to cover. Replaced with the filename/`--path` signals above.
- **A control test proved nothing.** It overrode `program` but left `args` at their default, which
  still carry `--path` — an incoherent combination rather than "debugging another program". It now
  overrides both.

## [1.24.0] — 2026-07-28

**This release ends the npm/tag drift `1.23.0` opened.** `breakpoint-mcp@1.23.0` was published from
`main` (`cbe825c`), not from the `v1.23.0` tag (`8ff56fa`), so the published tarball carried two
commits the tag did not — `recipe_multiplayer_scaffold_and_converge` and the `runtime_peers_digest`
catalog reconcile. That is documented history and the tag stays where it is; **do not force-push
`v1.23.0`.** From `v1.24.0` on, `git checkout <tag> && npm run build` reproduces the published
tarball again. Verify the old state any time with:

```
npm pack breakpoint-mcp@1.23.0 && tar xzf breakpoint-mcp-1.23.0.tgz
grep -c recipe_multiplayer_scaffold_and_converge package/dist/recipes.js   # 1 → cut from main
```

Most of what follows was therefore **already on npm as `1.23.0`** and is recorded here against the
version whose *tag* first contains it. The genuinely new work in this release is the port-collision
fix under **Fixed**. Gate-only work (checks 12/13, CI, `.gitignore`) is in **no** tarball — `files`
ships only `dist/**/*.js`, `addon/**/*`, `README.md`, `LICENSE`.

The addon is unchanged at `1.9.1`; every change here is host-side.

### Added
- **A recipe-roster gate in `contract_check.py` (check 12) — the fourth member of the drift class
  checks 10 and 11 close, and the one that had already gone wrong in the wild.** `README.md`'s
  hand-maintained recipe list never listed `recipe_deterministic_playtest`, shipped in **1.21.0**:
  six bullets for seven recipes, across three releases, with every test green the whole time. The
  roster existed as a typed constant and the registrations existed in source; nothing compared
  either against the prose a reader consults first.

  The roster is **derived from the `server.registerPrompt(...)` calls**, never read off
  `RECIPE_NAMES` — the constant is then checked against it, in membership *and order*, so neither a
  recipe registered without being listed nor a name listed without being registered can pass, and
  the gate cannot be satisfied by editing a constant to match a stale doc. Order is compared
  because `recipes.test.ts` asserts registration order equals `RECIPE_NAMES`, and a gate that
  disagreed with the suite would be worse than none.

  Strict by default in both directions: a live doc naming **any** recipe must name **every** recipe
  (the omission that actually happened) and must name no recipe that is not registered (a rename
  leaving a stale mention). `README.md` is additionally on `RECIPE_ROSTER_REQUIRED`, so dropping the
  list entirely fails rather than going quiet — the mention-driven rule alone can only compare a
  list that is still there. Exemptions are an explicit named set, deliberately empty, rather than a
  threshold like "names two or more, so it must be a roster" that a list one entry short slips
  straight under; and a `RECIPE_ROSTER_REQUIRED` entry missing from `RECIPE_DOCS` is itself a
  failure, because a requirement nothing scans is a check that verifies nothing.

  Recipe counts written as digits are gated exactly; counts written as words are **warned** about
  and left for a human, rather than pattern-matched by a regex that would read as verification while
  covering a fraction of the ways prose states a count. Same reasoning that replaced 11b's first
  version. **Verified to fail when broken, eight ways**: a dropped bullet, a renamed mention, the
  list removed wholesale, a wrong digit count, a name in `RECIPE_NAMES` that is never registered,
  `RECIPE_NAMES` in the wrong order, a misfiled required-doc path, and a word count staying visible
  as a warning. Adds no tools and moves no counts — **289 / 274**, host suite **490 / 0**.

- **`recipe_multiplayer_scaffold_and_converge` — an eighth recipe**, pairing the `mp_*` scaffolding
  family with F6 multi-peer convergence: scaffold ENet + spawner / synchronizer / RPC, make the game
  testable (replicated state on the fixed timestep, guarded RNG draws), spawn real headless peers,
  then freeze → equalise → seed → step → `runtime_peers_digest`. Adds **no tools** — the surface
  stays **289 / 274** — because a recipe is an MCP prompt over tools that already exist.

### Fixed
- **`godot_run_managed` and `godot_run_project` no longer start a game whose runtime bridge cannot
  bind — the silent wrong-process class.** Both tools launch a game whose autoload binds
  `BREAKPOINT_RUNTIME_PORT` (`runtime_bridge.gd:74`). When that port was already held — the
  developer's own game running, or a previous managed child still alive — `listen()` returned
  non-OK, the autoload `push_error`d, **and the game kept running without a bridge**, while the
  host's runtime client went on addressing whichever process got there first. Every subsequent
  `runtime_*` call then answered confidently about the wrong game, and `ping` carries no pid or boot
  nonce that could tell them apart, so nothing downstream could detect it. The peer allocator was
  already immune (it seeds `taken` with `runtimePort` and probes every candidate); the default path
  was not. Both tools now probe the port first and **refuse**, naming the risk and the remedies that
  can actually apply — `godot_stop` (only if `godot_run_managed` started it; a detached
  `godot_run_project` game is not stoppable by any tool), quitting the game or ending the debug
  session, `BREAKPOINT_RUNTIME_PORT`, and `runtime_spawn_peers` for driving several games at once.
  Stopping *peers* is deliberately **not** offered: `allocatePorts` seeds `taken` with
  `cfg.runtimePort` and scans from `runtimePort + 1`, so a peer can never be what holds it, and a
  remedy that cannot work is worse than one fewer suggestion.
  A per-call `allow_port_conflict: true` starts anyway for the legitimate case (you want the process
  for its console output or side effects and will not call a `runtime_*` tool against it); it is
  deliberately not sticky. Refusing rather than warning because a determinism feature returning a
  correct-looking answer from the wrong process is worse than one that will not start.
  `godot_launch_editor` is untouched — the editor binds `bridgePort`, so gating it would be a false
  positive, and a check that fires when nothing is wrong is a check someone disables.
  `portFree()` moved from `peers.ts` to a new `host/src/ports.ts` so both planes share one probe
  without closing an import cycle (`peers.ts` already imports `tools/processes.ts`).
  **Not yet covered: `dbg_launch`**, which starts the game through the debug adapter and binds the
  same port. Gating it wants its own decision, so it is named here rather than left to look handled.
- **A port env var that is set but unusable no longer becomes `NaN`.** `?? "9081"` catches only
  null/undefined, so `BREAKPOINT_RUNTIME_PORT=""` — what a shell produces from an unset variable in
  a `.env` file or a CI matrix — reached `Number.parseInt` and yielded NaN, which propagated into
  every dial and bind. Survivable while a bad port merely failed to connect; not survivable once
  these tools began *refusing* on an unbindable port, since `listen(NaN)` throws
  `ERR_SOCKET_BAD_PORT` and the probe cannot tell that apart from "held" — it would have refused to
  start a game that in fact would have worked, citing `127.0.0.1:NaN`. All four ports now fall back
  to their documented defaults. The check mirrors GDScript's `is_valid_int()` rather than using
  `Number.parseInt` alone, which stops at the first non-digit and turns `"80a80"` into port 80 —
  the host would dial 80 while the addon (`runtime_bridge.gd:75`) kept 9081, which is the exact
  host/addon disagreement the guard exists to prevent. Port `0` is still honoured.
- **Two recipes dead-ended on the new refusal and now close their own loop.**
  `recipe_screenshot_regression` ran the game twice and never stopped it, and `recipe_type_safe_edit`
  left it running at step 4; both would have been refused on their second run. They now use
  `godot_run_managed` + `godot_stop` and say why.
- **The two single-game integration probes now receive the F6 peer registry.**
  `runtime-frame-step.integration.mjs` and `runtime-capture.integration.mjs` still called
  `registerRuntimeTools(server, runtime)` with two arguments after F6 added a third. Harmless while
  neither probe passes `peer` — and a `TypeError` waiting for whoever first does. Both now pass a
  registry that throws a named error if a peer path is ever reached from a probe that has no peers.

### Tests
- **Six tests for the port-collision class, three of them verified to fail against the unfixed
  tree** (control green either side; the other three assert the *absence* of a false positive and so
  are green either way, which is the point of having them). The fixtures take the port the kernel
  hands out and hold it, rather than guessing a number, so the collision is a fact of the test and
  not an assumption about the machine.
- **Two tests for the port env guard**, covering `""`, whitespace, non-numeric, `"80a80"`, negative
  and out-of-range — and one asserting port `0` is still honoured, since it is legal and a guard
  that swallowed it would be a new bug. The `"80a80"` case was found *by* the test, against the
  first version of the guard.
- Host suite **490 → 498**.

### Documentation
- **README's recipe list was two entries short.** `recipe_deterministic_playtest` shipped in 1.21.0
  and was never listed; both it and the new recipe are now there.
- **`docs/TOOL_CATALOG.md` documented the pre-F6 `runtime_peers_digest` sequence** — seed before
  freeze — which is the order that does *not* converge, and it described two measured boundaries
  where the tool's own description states four preconditions. Reconciled against the description.
- `runtime_peers_digest`'s description now records that convergence was **re-measured on Godot
  4.7-stable**, not only 4.3.

## [1.23.0] — 2026-07-28

Ships multi-peer deterministic playtesting, and the CI job that holds its central claim to
account. A **minor** release: three additive tools (**286 → 289**, secure-default **272 → 274**),
a new integration plane, and no behaviour change at all for anyone who never passes `peer`.

### Added
- **Multi-peer deterministic playtesting (`runtime_spawn_peers` / `runtime_peer_stop` /
  `runtime_peers_digest`).** Spawn up to **four headless peers** of the project as child processes,
  each on its own loopback runtime port, and assert that independently-driven peers **converge**.
  The surface goes **286 → 289** (secure-default **272 → 274**); `runtime_spawn_peers` is
  `code-execution`-privileged and therefore dropped by default, like `godot_run_managed`.

  This is not a networking suite and is deliberately scoped so it cannot become one: it points the
  existing determinism primitives at more than one process. Seven existing tools — `runtime_seed_rng`,
  `runtime_time_scale`, `runtime_step_frames`, `runtime_get_property`, `runtime_call_method`,
  `runtime_await_condition`, `runtime_get_log` — take an optional `peer` argument instead of the
  feature minting parallel per-peer tools; omit it and behaviour is byte-identical to before. There is
  no generic `call_rpc_runtime` (use `runtime_call_method{peer}`) and no `mp_diagnose` aggregate (use
  `runtime_get_log{peer}`). Spawning local headless children on loopback is *testing*, not hosting, so
  Group M's "host nothing, scaffold everything" line is unmoved: no relay, lobby, or signalling server.

  **The addon needed no change at all.** The runtime autoload already reads `BREAKPOINT_RUNTIME_PORT`
  from its environment and is a TCP server the host dials, and the auth secret is minted per *project*
  rather than per process — so N addressable peers is a per-child env overlay plus a port allocator,
  with no protocol, transport, or handshake change. Confirmed on real Godot 4.3 headless up to four
  simultaneous peers before any of this was written.

  **Two measured boundaries ship in the tool descriptions, not just here.** Convergence is claimed for
  state advanced on the **fixed physics timestep** only — with `kind:"idle"` the per-frame `delta` is
  real elapsed wall-clock time in each process, so two peers given an identical seed draw identical
  random numbers and still diverge (measured: physics byte-equal on 3 seeds of 3, idle divergent on
  3 of 3). And it is a **same-machine** claim; nothing here extends across machines. The host also
  mints the project secret **before** the first spawn, closing a check-then-write race in the addon's
  `load_or_mint()` that N simultaneous cold-start children could otherwise lose silently.

  **`peer` is accepted by every runtime tool that talks to the running game** — all 24 of them — so
  the rule is "if you can do it to the default game, you can do it to one peer", with no subset to
  memorise. It shipped as a seven-tool subset first; validating the build against real Godot 4.3
  showed that insufficient in a way only an engine could reveal, because equalising peer state before
  stepping is mandatory and `runtime_set_property` was not on the list. Any subset has that shape of
  hole.

  **Four preconditions for convergence, all measured on real Godot 4.3** and all stated in
  `runtime_peers_digest`'s own description rather than only in the docs: step the fixed physics
  timestep; let the global RNG be consumed *only* on frames you are stepping; freeze before
  equalising state; same machine only. The second is the one that surprises: `runtime_seed_rng` seeds
  one stream shared by the whole project, and freezing does **not** stop it being drawn — `time_scale
  0` zeroes `delta` but callbacks still fire, so unconditional draws burn the stream at wall-clock
  rate while frozen. With all four honoured, three peers produce byte-equal digests even with a
  deliberate stagger between each peer's seed and step; with any one violated they diverge every time.

- **A warning-only tool-family count pass in `contract_check.py` (11b).** Check 11 gates only claims
  carrying a surface marker, and that stays right — the alternative is an allowlist of bare numbers,
  and every entry in such a list is a hole in the real check. But the family class drifts silently:
  three stale counts were found this release, two of them four releases old. 11b resolves the shape
  the docs actually use — a toolset expression followed by a number — exactly, id by id, and lists
  every other "N tools" phrase for a human. It never fails the build.

  Worth recording how it got there: the first version filtered family counts against every toolset
  subset *sum*, and a negative test showed it swallowed both defects that motivated it. It would have
  reported "0 suspects" while they sat stale. A check that reads as verification and verifies nothing
  is worse than none, so it was replaced rather than tuned.

- **Extensibility boundary written down.** `README.md` and `docs/USER_GUIDE.md` now state that recipes
  are the extension point — they compose typed tools and add none — and that a bring-your-own-tool
  hatch is a deliberate decline rather than an unfinished feature, because an injected tool has no
  frozen output schema, catalog entry, annotation, or capability tag, and `contract_check.py` cannot
  parse it to check for any of those.

- **A CI job that runs the convergence claim on every PR** — `peers-plane` in `integration.yml`,
  driving a new `host/test-integration/runtime-peers.integration.mjs` against a real engine. It is the
  only job in that workflow that boots no game for itself and needs no editor: `runtime_spawn_peers`
  spawns its own three headless children through the shipped `PeerRegistry`, and the probe then
  freezes, equalises, seeds and steps them and asserts `runtime_peers_digest` reports the three
  **byte-equal** — under a deliberately adversarial 250 ms stagger between each peer's seed and its
  step. It is also the only place the **default-on auth handshake** runs end to end in CI: peers are
  host-launched children, so the host mints the project secret and each child authenticates against
  the real `bridge_secret.gd`, rather than the probe disabling auth as every other live job does.

  The four preconditions are now expressed as *code a gate can check*, not only as prose in a tool
  description. The probe scene (`example/tests/peer_converge_probe.tscn`) carries two lanes: a physics
  lane guarded on `delta > 0` that draws from the seeded global stream, and an idle lane on its own
  `RandomNumberGenerator` that writes nothing the digest captures. Delete the guard, or move the idle
  lane onto the global stream, and the job fails — both measured against real Godot 4.3, in both
  directions, before the job was written. The probe also pins the *mechanism* rather than restating
  it: across a frozen window `idle_ticks` must climb while `ticks` holds, which is why precondition 2
  exists at all.

  It carries its own **negative control** — skew one peer at one node, and the digest must report
  `converged:false` with `diverged_at` naming that node and only that node — because a convergence
  check that cannot report divergence verifies nothing. Plus the four-peer ceiling against real
  processes, `runtime_peer_stop` killing a real child, a stopped peer reporting `peer_stopped` rather
  than a generic unreachable-bridge error, and a repeat stop as a no-op.

  **Matrixed across 4.3-stable and 4.7-stable, and convergence is measured on both** — three peers
  byte-equal under the stagger on each — so the claim is not an artefact of the one build it was first
  established on. It is **experimental (`continue-on-error`) anyway**, and the reason is the runner
  rather than the engine: this is the first job to run three simultaneous headless engines on a shared
  runner, and the project's rule for live-engine planes has been to promote on evidence (runtime-plane
  s20, csharp-plane s25, authoring-plane s42) rather than to discover a new job's flake surface by
  blocking merges. Adds no tools and moves no counts.

### Fixed
- `actions/setup-python@v5` → `@v6`, clearing a Node.js 20 runner-deprecation annotation on the
  `contract check` job before GitHub turns it into an error.
- `host/package-lock.json` had said `1.12.0` in both its `version` fields for ten minor releases —
  the same silent-drift class the two count gates close, but reachable by neither. Nothing read it for
  the published version, so nothing was broken.
- Three stale tool-*family* counts in the docs, all predating this release: `BREAKPOINT_TOOLSETS=c`
  was documented as 14 runtime tools (24 since 1.21.0, 27 now), `editor,runtime,vcs` as 172 (182, now
  185), and Plane A as ~145 tools when the editor toolset registers 146. The first two were found by
  hand; the third by the new 11b pass on its first run.

## [1.22.0] — 2026-07-27

Publishes machine-readable risk annotations on the whole surface, ships a static export of it, and
closes the documentation-drift class from both ends. A **minor** release: the annotations and the
`breakpoint-mcp tools` command are additive functionality, not fixes.

### Added
- **MCP tool annotations on all 286 tools.** Every tool now publishes the spec's
  `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` on `tools/list`
  (`host/src/annotations.ts`, injected by `applyAnnotations` alongside `applyOutputSchemas` and
  `applyCapabilities`). **91 read-only**, **87 destructive**, **215 idempotent**, **0 open-world** —
  the last is explicit rather than absent, because every one of the four bridges is loopback-only, the
  asset-gen `command` backend spawns a local argv, and the `backend_*` scaffolds only *write* GDScript
  that would later egress. Absence from a hint list is a published `false`, never "unknown".

  Motivation: we previously published **no** annotations, so MCP clients deciding what to auto-approve —
  and third-party policy catalogs building deny rules — had to infer risk from a tool's *name*. That
  inference fails in both directions on this surface: `tilemap_clear` and `anim_remove_key` read as
  irreversible but are undoable through `EditorUndoRedoManager`, while `navagent_configure` reads as a
  setter and in fact *adds* a node. A public catalog got exactly these wrong in July 2026. Annotations
  are **hints, not enforcement** — the controls remain the default-OFF capability groups, the
  elicitation gate, the per-project bridge secret, and Godot's undo stack.

- **`breakpoint-mcp tools` — a machine-readable export of the tool surface.** Emits every tool with its
  title, description, toolset, capability group, `confirm`-gating, input params, and the four MCP
  annotations — as text or `--json`. `--surface secure-default` (the default) reports the **272** tools
  an untouched install advertises; `--surface full` reports all **286**. Both counts appear in the
  header of either report, so a consumer cannot cite one as the other.

  Same motivation as the annotations: give catalogs, policy gateways, and security reviewers a stable
  artifact to consume instead of running the server or guessing from names. The registry is built
  statically against a recorder — **no Godot install, no server start, no handler invoked** — so it
  works in CI and in a container. Output is deliberately **timestamp-free and name-sorted**, making it
  a pure function of the source tree: two runs of a build are byte-identical and two releases can be
  diffed. Version is read from `package.json` at runtime rather than hardcoded, so this does not become
  another place a release bump can be forgotten.

- **Two drift guards, both verified to fail when broken.** `annotations.test.ts` (8 tests) asserts the
  table is *total* against the real registry — every registered tool annotated, every entry a live tool,
  all four hints present and boolean, no tool both read-only and destructive, and no read-only tool
  carrying the `confirm` gate param. `scripts/contract_check.py` gains a hard check on the same
  invariant, so an unannotated tool cannot pass CI. The roster (`ALL_ANNOTATED`) is listed explicitly
  rather than derived from the four hint lists: 51 tools are all-false, so a derived union would have
  omitted them and made the totality check vacuous.

- **A resource-count gate — the systemic fix for a ten-day documentation drift.** Nothing counted MCP
  resources at the level the server actually assembles them, so `docs/TOOL_CATALOG.md` said "286 tools +
  5 MCP resources" for ten days after `godot://capabilities` made it 6. Every test passed the whole
  time: `registration.test.ts` drives `buildToolsets`, which never wires `applyCapabilities`, so its
  count of 5 was correct *at its scope* — but its title read as a claim about the full runtime surface,
  and the catalog copied that sentence.

  Closed from both ends. `scripts/contract_check.py` gains check 10: it counts every
  `registerResource` in `host/src`, matches the set against an explicit URI roster, and asserts that
  **every resource count stated in the live docs agrees with the code** — `README.md`, `host/README.md`,
  `docs/TOOL_CATALOG.md`, `docs/USER_GUIDE.md`, 8 claims in all. `CHANGELOG.md` is deliberately exempt:
  it is an append-only record and its older "5 MCP resources" lines were correct for the releases they
  describe. A new `resources.test.ts` (4 tests) asserts the wired count — toolsets *plus* the always-on
  `godot://capabilities` — is 6, that each resource sits at its documented URI, that names are unique,
  and that no capability-group combination gates the capabilities resource away.

  Verified to fail when broken, three ways: restoring the catalog's "5" is caught at both sites; a 7th
  resource added to source without the roster and docs trips both errors; deleting a resource from
  source trips the roster check. `registration.test.ts`'s assertion was left alone — it is right — and
  only its title reframed to name its scope, with a comment saying why it must not be "fixed" to 6.

- **A tool-count gate — the other half of the drift class.** The resource gate above closed one half;
  the tool half had already bitten. Three stale `276`s survived in `index.ts` comments for two releases
  after the surface reached 286, with every test green the whole time, and nothing stopped the next one.
  `scripts/contract_check.py` gains **check 11**, mirroring check 10's shape.

  Both numbers are **derived, never typed**: the full surface is the registered tool set, and the
  secure-default surface is that set minus the tools `capabilities.ts` tags with a capability group —
  so no failure here can be silenced by editing a constant to match a stale doc. The check then asserts
  that every full-surface, secure-default, and privileged-drop count stated in the **live docs**, in
  **source prose**, and in the **four host-test count constants** agrees with the code: **78 claims and
  4 constants** across `README.md`, `host/README.md`, `docs/TOOL_CATALOG.md`, `docs/USER_GUIDE.md`,
  `host/src/**` and `host/test/**`. `CHANGELOG.md` stays exempt, extending check 10's rule rather than
  inventing a second one.

  Two nets, deliberately different in shape. The pattern net matches a number only where a *surface
  marker* sits beside it — `full`, `all`, `secure-default`, `N-tool surface`, `(N dropped)`, the
  `286 − 14 = 272` arithmetic — so tool-*family* counts ("roughly 145 tools", the `runtime_*` plane's
  14, a rival's "162-tool ceiling") are correctly invisible: a different and far lower-stakes class.
  The residual net then requires every three-digit integer *sharing a line with a real claim* to itself
  be a surface number, which is what catches README's "…**272 tools an agent can actually call**, not
  286 with a warning label" — a number with no marker of its own. Claims that wrap across a line are
  found by masking JSDoc `*` continuation markers while preserving character offsets, so
  `recipes.ts`'s "(the 286-tool\n * count is unchanged)" is not invisible to the scan.

  **Verified to fail when broken, five ways**, each reverted byte-exact afterwards: a live doc reverted
  to a stale 276; an `index.ts` comment reverted to 276 (the exact F12 defect, previously unguarded); a
  bare "not 276" with no marker of its own, caught only by the residual net; a 15th tool tagged
  privileged in `capabilities.ts`, which named **27 now-stale sites** across six files from that one
  code edit; and a test constant edited past the code.

Host gate **286 / 465 / 0** (443 + 8 annotations + 10 export + 4 resources), contract check **286 · annotated 286 · resources 6 · tool-count claims 78**. No tool-count and no behaviour change; version 1.21.1 → 1.22.0.

## [1.21.1] — 2026-07-24

Hardens the **deterministic-playtesting** primitives shipped in 1.21.0, adds their end-to-end
integration proof, and ships a recipe that ties the loop together. Both fixes were surfaced by the new
headless probe — the point of writing it. Host `1.21.0 → 1.21.1` (`package.json` + `serverInfo`), addon
`1.9.0 → 1.9.1` (`ADDON_VERSION` + both `plugin.cfg`s); tool surface unchanged (**286 / 272** — recipes
add no tools). Host gate **286 / 443 / 0**.

### Fixed
- **Freeze and stepping are driven by `time_scale`, not pause.** `runtime_time_scale{scale:0}` freezes
  the game clock (delta → 0), halting delta-based motion, tweens, timers, and animations, and
  `runtime_step_frames` restores a normal scale for the step and counts real frames off the engine
  counters (`Engine.get_physics_frames()` / `get_process_frames()`) until they move by exactly `frames`.
- **`runtime_step_frames` advances an exact frame count.** Earlier cuts used `get_tree().paused` for the
  freeze and toggled it around the step — but pause is a *per-node processing gate* that desyncs from
  the frame counter by one frame at the step boundary: the live probe on Godot 4.7 measured **29 for a
  requested 30**, with both the toggle-per-await and pause-then-count variants. Gating on `time_scale`
  (delta) instead means the node processes *every* physics frame, so its work is 1:1 with the counter
  and the advance is exact by construction. (Validated by the headless probe — see Tests.)

### Added
- **`recipe_deterministic_playtest`** — an MCP prompt (discoverable via `prompts/list`) that drives the
  full loop: freeze (`runtime_time_scale{scale:0}`) → optional `runtime_seed_rng` → `runtime_step_frames`
  → `runtime_state_digest` / `runtime_assert_node_state` → `runtime_screenshot_diff` against a golden
  frame → thaw. Adds no tools; the recipe count goes 6 → 7.

### Tests
- **Headless-Godot frame-step integration probe** — `host/test-integration/runtime-frame-step.integration.mjs`
  with `example/tests/frame_step_probe.tscn` + `frame_step_mover.gd`, wired into the `runtime-plane` CI
  job (all three Godot arms: 4.3 / 4.5 / 4.7). Boots a deterministic-mover scene headless on a dedicated
  port (`:9082`, coexisting with the D6 capture game on `:9081`), then drives the async step lane
  end-to-end over the socket: freeze holds the delta-gated mover's `ticks` steady, `runtime_step_frames
  {frames:30, kind:physics}` advances it by **exactly 30**, and it stays frozen afterwards. This is the
  only place the `runtime_step_frames` coroutine executes against a real `SceneTree`, and it is what
  caught the pause-boundary off-by-one above (a green run requires the `time_scale`-based stepper).

## [1.21.0] — 2026-07-24

Adds **deterministic playtesting** (finding **F4**) to Plane C — the last high-value gap from the
2026-07 competitive review (`DETERMINISTIC_PLAYTESTING_BUILD_SPEC_2026-07-24.md`), and the capability
`masteryee-labs/Open-Godot-MCP` markets as its headline. Four new runtime tools let an agent freeze the
game, advance an exact number of frames, snapshot state, and seed RNG — turning a flaky "run → screenshot
→ guess" loop into a frame-exact, reproducible one that the `runtime_assert_*` family and
`runtime_screenshot_diff` can assert against. It deepens the W/R/E **R-tier** rather than adding a new
remit. Tool surface **282 → 286** (secure-default **268 → 272**; none of the four are privileged). Static
contract gate green at the new count; host suite **443 / 0**. **Addon-touching** → host `1.20.0 → 1.21.0`
(`package.json` + `serverInfo`) and addon `1.8.0 → 1.9.0` (`ADDON_VERSION` + both `plugin.cfg`s).

### Added
- **`runtime_step_frames`** (gated) — advance the running game by an exact number of frames while
  otherwise frozen (`kind`: `idle` / `physics` / `both`). Runs on a new **async dispatch lane** in
  `runtime_bridge.gd`: because the bridge autoload is `PROCESS_MODE_ALWAYS`, a coroutine can toggle
  `get_tree().paused` around `await process_frame`/`physics_frame` per step while the bridge keeps
  servicing the socket; the id'd response is sent when stepping completes (the host already correlates
  out-of-order responses by id). Restores the caller's prior pause state.
- **`runtime_time_scale`** (gated) — set `Engine.time_scale` (0 = freeze, 1 = normal, N = slow/fast);
  returns `{ previous, current }`. Freeze, then step.
- **`runtime_state_digest`** (read-only) — a compact, stable-ordered snapshot of a subtree's salient
  state (position/rotation/scale/visibility/modulate by default, or a supplied field list) as
  `{ digest, node_count }`; deterministic ordering suits frame-by-frame comparison.
- **`runtime_seed_rng`** (gated) — seed the global RNG (`seed()`) for reproducible runs; documents that
  it does not cover per-instance RNGs or physics determinism.
- Async lane + four dispatch handlers in `addons/breakpoint_mcp/runtime_bridge.gd` (a placeholder
  `runtime.step_frames` case keeps the static contract scan aware of the async method); synced to the
  `example/` and `example-csharp/` addon copies.

### Tests
- `host/test/runtime.test.ts`: gated set 8 → 11 (`runtime_time_scale`, `runtime_step_frames`,
  `runtime_seed_rng`); new happy-path coverage for all four. Count assertions **282 → 286** /
  secure-default **272** across `capabilities.test.ts`, `toolsets.test.ts`, `registration.test.ts`, and
  the doctor/init strings (`cli_capabilities.test.ts`). Host suite **443 / 0**; static contract gate **286**.
- **Engine-side note:** the async frame-step logic executes only against real Godot — validated by the
  headless-Godot integration lane and live runs, not the mocked host unit tests (the plan calls for a
  short pause-toggle spike on Godot 4.2/4.4/4.5).

## [1.20.0] — 2026-07-24

Adds **six runtime-bridge tools** (Plane C) that close the highest-value gaps found in the
2026-07 competitive audit (`RUNTIME_PROBE_AUDIT_2026-07-24.md`) against `yurineko73/Godot-MCP-Native`'s
runtime probe — turning operations that were only reachable via the generic `runtime_call_method`
escape hatch into typed, gated, discoverable tools, and adding a first-class wait primitive. Tool
surface **276 → 282** (secure-default **262 → 268**; none of the six are privileged). The static
contract gate stays green at the new count and the host suite runs **437 / 0**. **Addon-touching**
(`runtime_bridge.gd` gained five dispatch handlers), so this cut bumps **host `1.19.1 → 1.20.0`**
(`package.json` + MCP `serverInfo`) and **addon `1.7.0 → 1.8.0`** (`ADDON_VERSION` + both `plugin.cfg`s),
and refreshes the tool-count refs across `README.md`, `host/README.md`, and `docs/USER_GUIDE.md`.

### Added
- **`runtime_await_condition`** (read-only, ungated) — poll a live node property until it satisfies a
  comparison (`op`: `eq`/`ne` structural, `gt`/`ge`/`lt`/`le` numeric) or a timeout elapses. Implemented
  host-side over `runtime.get_property` (no new bridge method), so it works on every engine build the
  runtime bridge supports; returns `{ met, polls, elapsed_ms, value }`. Pairs with the `runtime_assert_*`
  family: wait for a state, then assert it.
- **`runtime_anim_play` / `runtime_anim_stop`** (gated) and **`runtime_anim_get_state`** (read-only) —
  drive and inspect a live `AnimationPlayer`: play a named (or the assigned) animation with speed /
  from-end, pause-or-stop, and read `{ playing, current_animation, position, length, speed_scale,
  animations[] }`. Closes the runtime-animation gap (the existing `anim_*` tools are edit-time only).
  `pause()`/`stop()` are called with no arguments so behavior is stable across Godot 4.2–4.5.
- **`runtime_node_add` / `runtime_node_remove`** (gated) — spawn a node into the running game from a
  `res://` PackedScene or a ClassDB `type` (optionally named) under a parent, and `queue_free()` a live
  node (refusing the current scene root). Typed replacements for the `runtime_call_method(add_child/…)`
  escape hatch.
- Five new dispatch handlers in `addons/breakpoint_mcp/runtime_bridge.gd` (`runtime.anim_play`,
  `runtime.anim_stop`, `runtime.anim_get_state`, `runtime.node_add`, `runtime.node_remove`); synced to
  the `example/` and `example-csharp/` addon copies. `runtime_await_condition` needs no handler.

### Tests
- `host/test/runtime.test.ts`: the gated set grows from 4 → 8 (adds `runtime_anim_play`,
  `runtime_anim_stop`, `runtime_node_add`, `runtime_node_remove`); new happy-path coverage for
  `await_condition` (first-poll match + fast-timeout), animation play/get-state, and node add/remove.
- Count assertions updated to **282** / secure-default **268** across `capabilities.test.ts`,
  `toolsets.test.ts`, `registration.test.ts`, and the doctor/init capability strings
  (`cli_capabilities.test.ts`). Host suite **437 / 0**; static contract gate **282**.

## [1.19.1] — 2026-07-21

Sanitizes and re-themes the **debugger-led demo** used to record the GDScript and C# preview GIFs. **No shipped code changes** — the addon (`plugin.cfg` `1.7.0`) and the npm tarball (`dist/` + `addon/` + `host/README`) are byte-identical; this is a demo/docs/assets patch. Host `1.19.0` → **`1.19.1`** (cut here, tag-only per the repo's `v1.15`–`v1.18` convention — not published to npm). Tool surface unchanged (**276** / secure-default **262**); MCP `serverInfo` stays **`1.19.0`** since the shipped host binary is unchanged.

Two problems in the recorded demo are fixed: **(1) Privacy** — the GIFs leaked the author's home directory (absolute `/Users/…` paths in the host's startup banner and in the DAP `path`/`source`/`--path` fields). The demo drivers now launch the host with `stderr: "ignore"` (dropping the banner) and carry a `redact()` helper that relativizes absolute paths in printed results and written transcripts (project dir → `res://`, repo → `<project>`, home → `~`); the committed `.cast` recordings + `.json` transcript sidecars were sanitized the same way and the four preview GIFs re-rendered clean with **agg 1.9.0**. **(2) G-rated re-theme** — the demo scene changed from a combat encounter (`hp`/`armor`/`damage`, `"YOU DIED"`) to a **melting snowman** (`ice`/`shade`/`warmth`/`melt`, `"ALL MELTED"`), preserving the identical missing-clamp bug, breakpoint lines (GDScript **17** / C# **22**), and trajectory (`100 → 102 → 87 → 88 → 3` buggy; `100 → 100 → 85 → 85 → 0` fixed).

### Changed
- **Debugger demo re-themed** combat → melting snowman (`example/demo/`, `example-csharp/demo/`): files renamed `demo_combat.gd` → `demo_snowman.gd` and `DemoCombat.cs` → `DemoSnowman.cs` (class `DemoSnowman`, scene root node `Snowman`); identical bug/trajectory, G-rated language throughout.
- **Demo drivers redact absolute paths** (`host/demo_debugger_live.mjs`, `cs_demo_debugger_live.mjs`, `demo_verify_live.mjs`, `cs_demo_verify_live.mjs`): `stderr: "ignore"` on the host spawn plus a `redact()` pass so recordings never expose `/Users/…`.
- **Recordings + preview GIFs regenerated** clean: `host/*.cast`, `host/*_transcript.json`, and the four GIFs (`demo_gdscript_debugger.gif`, `cs_demo_debugger.gif`, `cs_demo_verify_live.gif`, `cs_demo_verify.gif`).
- **README** demo paragraph rewritten to the snowman scene; **README + USER_GUIDE mastheads** bumped to host `1.19.1`.

## [1.19.0] — 2026-07-18

Adds the **human-in-the-loop pause control surface** — a way for a person to hold the agent's actions on demand — in two complementary, precisely-scoped forms, and documents it. **(1) Host signal latch** (`host/src/pause.ts` + `confirm.ts`): `SIGUSR1` pauses / `SIGUSR2` resumes the running host; while paused it **holds ENTRY to a new mutating (gate-passing) action** across the **whole** tool surface until resume or an env-tunable timeout, then **blocks** rather than acting — read-only tools and in-flight ops are never affected (the finer instrument, and the same fail-safe posture `gate()` already takes when a client can't elicit). **(2) Addon "Pause Agent" button** (new): an in-editor status-dock toggle that engages a cross-process latch **both GDScript bridges honor**, so while paused the **editor and runtime bridges reject new commands** on those two planes (a bare `ping` still answers; an op already running finishes) — the visible, one-click companion scoped to the engine-facing planes. Its state is a flag file in the engine-managed, git-ignored `res://.godot/` (the same cross-process mechanism `bridge_secret.gd` uses), because the button lives in the editor while the runtime bridge lives in the **separate game process**. The two controls are layered by coverage (whole-surface vs. editor+runtime) and granularity (mutating-only vs. coarse), each described precisely so neither reads as an "emergency stop." **Per-tool elicitation gating stays the LEAD control** for destructive ops. Adds **no MCP tool** (surface frozen at **276**) and the activity signal stays **gated-only**. Addon-touching (both bridges + dock) → addon `1.6.0` → **`1.7.0`** (`ADDON_VERSION` + `plugin.cfg`); both full `addons/breakpoint_mcp/` copies stay byte-identical and the `example-csharp/` runtime subset carries the same `runtime_bridge.gd` + new `pause_latch.gd`. Host version `1.18.1` → **`1.19.0`** (prototype-to-shipped, cut here); the static contract gate stays green at **276** and the host suite runs **431 / 0**.

### Added
- **Host signal-latch pause** (`host/src/pause.ts`, wired in `confirm.ts` `gate()` and `index.ts` `main()`). A process-wide `PauseLatch` consulted at the destructive-op seam: while paused it holds entry to a new **mutating** action (`awaitResumed`) until an `SIGUSR2` resume or `BREAKPOINT_PAUSE_TIMEOUT_MS`, then returns a clean "paused — held and NOT executed" block; `BREAKPOINT_START_PAUSED=1` starts held. Whole-surface, mutating-only, read-only-safe. Signal handlers are wired only in `main()`, never at import (so importing the module in tests registers no process-level handlers).
- **Addon "Pause Agent" control** — a status-dock toggle plus a cross-process latch (`addons/breakpoint_mcp/pause_latch.gd`) honored by both the editor bridge (`bridge_server.gd`) and the runtime bridge (`runtime_bridge.gd`) at their dispatch seams. While engaged, those two planes reject new agent commands (except a liveness `ping`) with an `ok:false` / `code:"paused"` reply — the caller re-issues after resume (**reject, not queue**, since the bridges are single-threaded and polled from `_process`). The latch is a flag file in `res://.godot/` so the editor toggle reaches the runtime bridge in the separate game process; the plugin clears any stale flag on enable/disable so a session never starts silently paused. Addon `1.6.0` → `1.7.0`.

### Tests
- `host/test/pause.test.ts` (10) covers the host `PauseLatch`: pause/resume/toggle, `awaitResumed` releasing waiters on resume and blocking on timeout, the activity ring, and env configuration. New headless `example/tests/pause_latch_smoke.gd` (12, wired into the `gdscript-unit` CI lane) drives the REAL `bridge_server.gd` over a loopback socket: the `PauseLatch` flag-file round-trip, a command dispatched while running, the same command **held** (not dispatched, `code:"paused"` reply) while paused, `ping` still answering while paused, and dispatch resuming after clear. **Verified live against Godot 4.7 (12/12)**; the auth / re-entrancy / ops-unit smokes stay green (13/13, 7/7, 180/180). Host suite **431 / 0**; static contract gate **276**.

## [1.18.1] — 2026-07-18

Patch release — corrects the capability-group tagging of the six `asset_gen_*` generators (Group J): the anticipatory **`network`** tag is dropped so they are **`code-execution`-only**. They were tagged with *both* groups in 1.18.0 on the expectation of a future external image-gen *provider* backend that is **not implemented** — the only backends are the local `none` / `placeholder` / `command` paths (`command` is a *local* process = `code-execution`), so the `network` tag advertised an egress capability the tools don't have. Removing it applies the same **tag-when-real** discipline used for bridge auth, and `network` now honestly gates only the Group M backend SDK (`backend_configure` / `backend_detect`). **Headline opt-in surface counts are unchanged** — secure-default **262**, `code-execution` **274**, full **276**; only **`network`-alone moves 270 → 264**. `doctor`'s asset-gen hint now fires whenever `code-execution` is off (previously only when *both* groups were off). **Host-only — the addon is untouched** (both `addons/breakpoint_mcp/` copies stay byte-identical at `1.6.0`); the static contract gate stays green at **276** and the host suite runs **421 pass / 0 fail**. Host version `1.18.0` → `1.18.1`. Rationale in `GROUP_J_ASSETGEN_SCOPING_2026-07-18.md`.

### Changed
- **Group J (`asset_gen_*`) is now tagged `code-execution`-only — the anticipatory `network` tag is dropped.** The six asset generators were tagged with **both** capability groups in 1.18.0 on the expectation of a future external image-gen *provider* backend; that backend is **not implemented** (the only backends are the local `none` / `placeholder` / `command` paths, and `command` is a *local* process = `code-execution`). Tagging them `network` advertised an egress capability the tools don't have, so the tag is removed until a real provider backend ships — the same tag-when-real discipline used for bridge auth. The `network` group now honestly gates only the Group M backend SDK (`backend_configure` / `backend_detect`). **Effect on opt-in surface counts:** secure-default **262**, `code-execution` **274**, and full **276** are unchanged; only **`network`-alone moves 270 → 264** (it no longer pulls in the six `asset_gen_*`). `doctor`'s asset-gen hint now fires whenever `code-execution` is off (previously only when *both* groups were off), so a configured backend with `network` alone is correctly reported as not-loaded. Host-only; addon untouched. Rationale in `GROUP_J_ASSETGEN_SCOPING_2026-07-18.md`.

### Tests
- `capabilities.test.ts`: the `asset_gen_*` generators move from the "both groups" set into the code-execution-kept set; the `network`-alone surface expectation is **270 → 264**; the no-stale-tags / dropped-set / secure-default (262) / full (276) invariants are unchanged. `cli_capabilities.test.ts`: the doctor asset-gen signal now also asserts that **`network` alone still flags** a configured backend (asset-gen needs `code-execution`). Host suite stays **421 pass / 0 fail**; static contract gate **276**.

## [1.18.0] — 2026-07-18

Feature release — **capability groups**, a risk-based, default-OFF least-privilege axis over the tool surface, plus a guided trust front door and an always-on capabilities resource. Two groups — `code-execution` and `network` — are **off by default**, and a disabled group's tools are **dropped at registration** (omitted from `tools/list` entirely), so the **secure-default surface is 262 tools** and the **full 276** loads only when opted in via `BREAKPOINT_PRIVILEGED_GROUPS`. `breakpoint-mcp init --trust safe|full` writes the choice into the generated client config and `doctor` reports each group's state and dropped-tool count; the new always-on **`godot://capabilities`** resource (the **6th**) lists every group, its state, and the tools it gates, so a dropped high-trust tool is discoverable rather than a silent gap. **Host-only — the addon is untouched** (both `addons/breakpoint_mcp/` copies stay byte-identical at `1.6.0`); the static contract gate stays green at **276 tools** (the full catalog is unchanged — capability filtering is runtime-only) and the host suite runs **407 → 421 pass / 0 fail**. Host version `1.17.0` → `1.18.0`.

### Added
- **Capability groups — a risk-based, default-OFF least-privilege axis over the tool surface.** Two groups, `code-execution` and `network`, are **off by default**; a disabled group's tools are **dropped at registration** (omitted from `tools/list` entirely — least-privilege by construction, matching `beremaran/godot-agent-loop`), so the **secure-default surface is 262 tools** and the **full 276** loads only when opted in via `BREAKPOINT_PRIVILEGED_GROUPS` (`code-execution`, `network`, or `all`). `code-execution` gates the arbitrary-execution surfaces (`godot_run_headless_script`, `godot_run_managed`, `node_call_method`, `runtime_call_method`, `dbg_evaluate` / `cs_dbg_evaluate`, and the `asset_gen_*` **command** backend); `network` gates egress — today the Group M `backend_*` scaffolding, plus the `asset_gen_*` generators tagged **anticipatorily** (their external image-gen *provider* backend is reserved but **not yet implemented**, so their shipping backends are all local). The six `asset_gen_*` generators are tagged with **both** groups and load when *either* is enabled. Implemented as a second `registerTool` / `registerToolTask` wrapper (mirroring `applyOutputSchemas`) keyed on the new `BREAKPOINT_PRIVILEGED_GROUPS` env — **host-side only, addon untouched**. Defense-in-depth + a legible least-privilege default over an already typed / undoable / schema-frozen / elicitation-gated surface — **not** the closing of an open hole. New `host/src/capabilities.ts`.
- **Always-on `godot://capabilities` resource.** A read-only listing of the two groups, their enabled/disabled state, the tools each gates, the currently-dropped set, and the exact env one-liner to enable them — registered **unconditionally** (not behind the `resources` toolset), so a dropped high-trust tool is never a silent gap: an agent can always discover what exists-but-is-disabled and how to turn it on. Brings the advertised resource count to **6**.
- **Guided front door in `init` / `doctor`.** `breakpoint-mcp init` gains `--trust safe|full` (and the lower-level `--privileged-groups <list>`) which writes `BREAKPOINT_PRIVILEGED_GROUPS` into the generated client config; the default is **safe** and a bare `init` still prints a note explaining the secure default and exactly how to opt in. `breakpoint-mcp doctor` gains a **capability-groups** section reporting each group's on/off state and the dropped-tool count, plus a signal hint when an asset-gen backend is configured while both groups are off (so the "why won't asset-gen run?" gap the drop model can create is surfaced, not silent). Keeps the one-command install simple while making the trust decision discoverable.

### Tests
- New `host/test/capabilities.test.ts` (9 cases): the secure default drops exactly the 14 privileged tools (**276 → 262**); both groups / `all` restore **276**; `code-execution` only = **274**, `network` only = **270**; **no stale capability tags** (every tagged name is a real registered tool, including the `registerToolTask` path); `droppedTools` per group combination; env parse/select with unknown-token reporting + `all` expansion; untagged tools always allowed; and the `capabilities` resource payload (state, dropped set, how-to-enable). New `host/test/cli_capabilities.test.ts` (5 cases): the `init` preset resolver (safe default / `--trust full` / explicit list / unknown-token warning), the `serverEntry` env it produces, and the `doctor` capability-groups section (secure default, full surface, and the asset-gen signal). Host suite **407 → 421 pass / 0 fail**; the static contract gate stays green at **276 tools** (the full catalog is unchanged — capability filtering is runtime-only).

## [1.17.0] — 2026-07-17

Security release — cuts the **loopback-bridge shared-secret handshake** that landed under `[Unreleased]` in `01bc220`. Both bridges (editor `:9080`, runtime `:9081`) now require a per-project secret before they dispatch anything, closing the local-process vector that previously bypassed the host confirmation gate and restoring the gate's integrity. Addon-touching (both bridges) → addon `1.5.0` → **`1.6.0`**; the `ADDON_VERSION` constant in `operations.gd`, which had silently drifted to `1.4.3` (it was never bumped alongside `plugin.cfg` in the 1.15.0 cut), is corrected to **`1.6.0`** so the reported addon version matches `plugin.cfg` again. Host version `1.16.0` → `1.17.0`. Host suite **407 pass / 0 fail**; the static contract gate stays green at **276 tools** (unchanged — the `auth` verb is inline in `_handle_line`, not a registered method/tool).

### Security
- **Loopback-bridge shared-secret handshake (default-on).** Both bridges (editor `:9080`, runtime `:9081`) now require a per-project secret before they dispatch anything. Previously the only access control was the `127.0.0.1` bind, so any *other local process* on a shared machine could drive the bridge — and, because the destructive-op confirmation gate is enforced in the host (`confirm.ts` `gate()`), a direct socket connection **bypassed that gate entirely**. The addon now mints a 64-char hex secret to `res://.godot/breakpoint_mcp.secret` (the `.godot` dir is engine-managed and git-ignored, so it never enters VCS); the Node host reads the same file (env override `BREAKPOINT_BRIDGE_SECRET` / `BREAKPOINT_RUNTIME_SECRET` wins) and sends it as the **first line** on connect. An unauthenticated peer may *only* authenticate: the secret is compared in **constant time**, a bad or missing handshake gets a generic `unauthorized` reply with **no echo** of the received value, the expected secret, the method, or any engine error, and the connection is closed — no op is dispatched. Defense-in-depth (loopback still blocks the network; this closes the local-process vector and restores the gate's integrity), matching the trust posture `beremaran/godot-agent-loop` set. Opt out with `BREAKPOINT_BRIDGE_INSECURE=1`. New shared `addons/breakpoint_mcp/bridge_secret.gd` + `host/src/secret.ts`; **no new tool (still 276)**. Addon-touching (both bridges) → addon `1.5.0` → `1.6.0` (and the drifted `ADDON_VERSION` const corrected `1.4.3` → `1.6.0`).

### Tests
- New `host/test/secret.test.ts` (7 cases): project-secret file read/trim, absent/empty → null, env-override precedence, and the env-then-file resolution order. New handshake cases in `host/test/bridge.test.ts` (2): the client prepends the `auth` line as the FIRST frame when a secret is available, and sends none when it isn't (backward-compatible). Host suite **398 → 407 pass / 0 fail**; the static contract gate stays green at **276 tools**.
- New headless `example/tests/bridge_auth_smoke.gd` (13 checks, wired into the `gdscript-unit` CI lane) drives the REAL `bridge_server.gd` over a loopback socket: a pre-auth request is denied + dropped, a wrong secret is denied + dropped, the correct secret authenticates and its request dispatches, plus `const_time_eq` unit checks. **Verified live against Godot 4.7 (13/13).** The live-boot integration probes (runtime/editor/dap/authoring planes) run with `BREAKPOINT_BRIDGE_INSECURE=1`, so the handshake itself is covered by the dedicated smoke rather than each probe re-authenticating.

## [1.16.0] — 2026-07-17

Feature release — two host-only, additive layers that make the existing **276-tool** surface easier to adopt without changing it. **Plane/group toolsets (`BREAKPOINT_TOOLSETS`)** add an optional env selector that registers only the tool groups a project needs (the A/B/C/D planes already *are* the grouping); unset, the full **276-tool** surface loads byte-identical to before — a menu filter, not a capability cut. **Recipes** add a free, curated task-recipe layer of six discoverable workflows exposed as MCP **prompts** that drive the enforced tools and then *verify* — the same idea as a paid "skill pack", except free (MIT, in the server) and sitting over typed, schema-validated, undoable tools. Both are host-only and additive: **no new tool (still 276)**, no addon change — both `addons/breakpoint_mcp/` copies stay byte-identical and the addon stays `1.5.0`. Combined suite **380 → 398 pass / 0 fail** (+12 toolsets, +6 recipes); the static contract gate stays green at **276 tools**. Host version `1.15.0` → `1.16.0`.

### Added
- **Plane/group toolsets (`BREAKPOINT_TOOLSETS`).** Optional env selector that registers only the tool groups a project needs — the A/B/C/D planes already *are* the grouping. Accepts the plane aliases `a` (editor), `b` (cli), `c` (runtime), `d` (`lsp,cslsp,dap,csdap`), plus `csharp` and `all`, or any concrete group id (`cli editor lsp cslsp dap csdap runtime processes knowledge vcs assetgen netcode backend tabletop resources`). Unset → the full **276-tool** surface, byte-identical to before; unknown tokens are ignored and an all-invalid filter falls back to the full surface, so a typo never yields an empty server. A **menu filter, not a capability cut** — every tool that loads stays typed, schema-validated, and undoable. On Claude Code it complements Tool Search (which already defers the whole catalog for a measured ~86–98% upfront token cut); it's the in-server equivalent for clients that can't defer. Host-only and additive: **no new tool (still 276)**, no addon change, no schema change. New `host/src/toolsets.ts` is the single ordered registry that both `index.ts` and the registration tests drive, so the live surface and the tests cannot drift.
- **Recipes — a free, curated task-recipe layer exposed as MCP prompts.** Six discoverable workflows that drive the enforced tools and then *verify*: `recipe_2d_player_controller`, `recipe_wire_signal_and_assert`, `recipe_debug_inspect_variable`, `recipe_screenshot_regression`, `recipe_type_safe_edit`, and `recipe_csharp_fix_and_debug`. Exposed via the MCP `prompts` capability (auto-advertised; `prompts/list` + `prompts/get`). A recipe is the same idea as a paid "skill pack" with two differences: it's **free** (MIT, in the server) and it sits **over typed, schema-validated, undoable tools**, so the contract is executed by the server rather than described in prose. Adds **no tools** (still **276**) and costs nothing until a client pulls one. New `host/src/recipes.ts`; wired in `index.ts` after tool registration.

### Tests
- New `host/test/toolsets.test.ts` (12 cases): `parseToolsets` / `selectToolsets` normalization, alias expansion, unknown-token reporting, and empty-resolution fallback; a **partition property** proving the toolsets are disjoint and losslessly cover all 276 tools; and concrete subset sizes (`runtime` = 14, plane `d` = 58 > runtime). `registration.test.ts` now builds the surface through `buildToolsets` (the same registry `index.ts` uses).
- New `host/test/recipes.test.ts` (6 cases): recipe set + order, title/description/argsSchema presence, non-empty **interpolated** message bodies (defaults + args), and that every recipe drives a `runtime_assert_*` / `dbg_*` verification step; a live probe confirms `prompts/list` advertises all six and `tools/list` stays at **276**.
- Combined suite **380 (1.15.0) → 398 pass / 0 fail** (+12 toolsets, +6 recipes); the static contract gate stays green at **276 tools**.

## [1.15.0] — 2026-07-15

Feature release — the **runtime verification family**: five read-only runtime-assertion tools that let an assistant *check* a running game the way a test would, paired with the live debugger rather than replacing it. Adds **`runtime_assert_node_state`**, **`runtime_assert_scene_structure`**, **`runtime_assert_perf`**, **`runtime_assert_screen_text`**, and **`runtime_screenshot_diff`** (271 → **276 tools**). Every tool is read-only, **ungated, and stateless** — no `gate()`, no file writes, no in-plugin state — so they compose freely inside a play-test loop. The pixel diff and text scan run **engine-side** (`Image`, `Control.text`), keeping the Node host dependency-free (no OCR, no image libraries). The new dispatch cases and handlers land in the shared `runtime_bridge.gd` autoload, so the addon moves `1.4.3` → **`1.5.0`**; both `addons/breakpoint_mcp/` copies stay byte-identical. Host version `1.14.1` → `1.15.0`. Verified live against a running Godot 4.7 game.

### Added
- **`runtime_assert_node_state`** — assert that a live node's properties equal expected values in the running game's SceneTree, reporting each match and mismatch. Read-only.
- **`runtime_assert_scene_structure`** — assert the live scene tree matches an expected shape (child paths / types) from a chosen root. Read-only.
- **`runtime_assert_perf`** — assert live `Performance` monitors meet a **caller-supplied baseline** within `tolerance`, direction-aware (`time/fps` higher-better, every other monitor lower-better; a `direction` param overrides per key). The baseline is passed **inline** (capture it earlier via `runtime_get_monitors`), so the tool stays stateless with no in-plugin baseline store. Returns `{ ok, checked, regressions[], monitors }`; keys absent from the addon monitor map are skipped (`checked` counts only compared keys).
- **`runtime_assert_screen_text`** — assert visible on-screen text is present or absent by scanning `Control` `text` properties across the live tree (`Label` / `RichTextLabel` / `Button` / `LineEdit` / `TextEdit` / `CheckBox` / `LinkButton` …) — **no OCR**, host stays dep-free. A node matches when it `is_visible_in_tree()` and its `text` contains the needle (substring by default, or `RegEx` with `regex:true`, honoring `case_sensitive`); `min_count` gates the pass. Returns `{ ok, matches, present, samples[] }` (samples capped at 20). Does not see canvas- or texture-drawn text.
- **`runtime_screenshot_diff`** — capture the current frame and compare it to a **reference PNG at a project path**, returning diff **stats only** (so read-only and ungated). The diff is computed engine-side (`Image`): frame and reference are normalized to RGBA8, an optional `region` crops both, per-pixel channel deltas above `per_channel_threshold` are counted, `diff_ratio = differing/total`, and `ok = diff_ratio <= tolerance`. A post-crop dimension mismatch returns `{ ok:false, reason:"dimension_mismatch", … }`. Returns `{ ok, diff_ratio, differing_pixels, total_pixels, width, height, reference, reason? }`.

### Tests
- The verification family adds happy-path behavior coverage for each new tool to `runtime.test.ts`; the suite runs **380 pass / 0 fail**. `EXPECTED_TOOL_COUNT` in `registration.test.ts` moves to **276**, and the "exactly four mutators are gated" invariant confirms the read-only family does **not** gate. The `outputSchemas.length === tools − 2` invariant holds — `runtime_screenshot_diff` returns **data, not an image**, so it carries an output schema and is not in `IMAGE_TOOLS`.

## [1.14.1] — 2026-07-13

Patch release — silences the Godot 4.5+ `UNUSED_PARAMETER` warnings the runtime-compiled `Logger` subclass emitted whenever log capture is installed, by underscore-prefixing the three unused `_log_error()` override parameters. Cosmetic only: no behavior change, **no new tool (still 271)**, no schema change; both `addons/breakpoint_mcp/` copies stay byte-identical. Host version `1.14.0` → `1.14.1`; addon `1.4.2` → `1.4.3` (the deferred addon-version honesty bump rides this addon-touching release). First externally-contributed fix — thanks [@PierreTurnbull](https://github.com/PierreTurnbull) (PR #113).

### Fixed
- **Runtime log capture** — prefix unused `_log_error()` override parameters with underscores in the runtime-compiled `Logger` subclass so Godot 4.5+ no longer emits `UNUSED_PARAMETER` warnings when log capture is installed. ([#113](https://github.com/jlivingston-Cipher/godot-breakpoint-mcp/pull/113) by @PierreTurnbull)

## [1.14.0] — 2026-07-13

Feature release — the `card_instance` **`persist`** save-persistence flag (Finding-A, shipped in `1.13.0`) is extended to the three remaining tabletop composites: **`card_hand_layout`**, **`card_deck_from_table`**, and **`piece_instance`**. Opt-in and default-off — pass `persist: true` to bake bound slot data into the saved scene via Editable Children (reusing the existing `node.set_editable_instance` op) so authored values survive a reload; each result reports a new `persisted` field. Host-only and additive — no addon change, **no new tool (still 271)**, no schema-count change. Host version `1.13.0` → `1.14.0`; addon stays `1.4.2`.

### Added
- **`persist` extended to `card_hand_layout`, `card_deck_from_table`, and `piece_instance`** (default `false`), mirroring the `card_instance` Finding-A save-persistence flag. When set, every instanced card / piece gets "Editable Children" enabled (via the existing `node.set_editable_instance` op) so its bound slot data serializes into the saved scene instead of reverting on reload; each result reports a new `persisted` field. Default behavior is unchanged — instances stay runtime-bound via `set_data` unless `persist: true` is passed. Host-only and additive: **no new tool (still 271)**, no addon change, no schema-count change (the op is reused, not added). For `piece_instance` with `place_on`, the toggle is applied to the piece's final resting path after the reparent.

### Tests
- `tabletop.test.ts` gains four cases (367 → 371): `persist:true` on `card_hand_layout` and `card_deck_from_table` (one editable-children emit per instanced card) and on `piece_instance` (plain + `place_on`, the toggle landing on the final placed path); the existing hand / deck / piece tests gain default `persisted:false` assertions.

## [1.13.0] — 2026-07-13

Finding-A save-persistence — authored `card_instance` slot data can now be baked into the saved scene. Adds **`node_set_editable_instance`** (270 → **271 tools**): toggles "Editable Children" on an instanced sub-scene so property overrides on its internal nodes serialize on save, instead of reverting on reload (a sealed sub-scene otherwise discards them). `card_instance` gains an opt-in **`persist`** flag (default `false`) that enables editable children on the instance so its bound slot data survives a reload; the result reports a new `persisted` field. Default behavior is unchanged — cards stay runtime-bound via `set_data` unless `persist: true` is passed. Both `addons/breakpoint_mcp/` copies stay byte-identical (the new op is added to the shared `operations.gd`). New headless `editable_instance_smoke.gd` (wired into `integration.yml`) proves a sealed instance reverts its override on reload while an editable instance persists it through a pack → save → reload round-trip; verified live against Godot 4.7. Version `1.12.1` → `1.13.0`; addon stays `1.4.2`.

## [1.12.1] — 2026-07-13

Documentation + republish — a human-readable doc cycle stamping everything to the current about-to-be-pushed versions (host `1.12.1`, addon `1.4.2`, **270 tools**), plus a republish so the npm package page reflects it. The 270-tool README / User-Guide landed in `14cd843` *after* the `1.12.0` publish, and npm READMEs are immutable per version — so npmjs.com still showed the pre-Group-L README. No code, tool, schema, or addon change — still **270 tools**; both `addons/breakpoint_mcp/` copies are byte-identical to 1.12.0. Version `1.12.0` → `1.12.1`.

### Documentation
- **README badge** stamped `npm 1.12.0` → `npm 1.12.1` (`addon 1.4.2 · 270 tools + 5 MCP resources` unchanged).
- **User Guide** version stamp corrected `1.0.0` → `host 1.12.1 · addon 1.4.2` (it had never been bumped from the initial release).
- **Compatibility section** — the trailing ellipsis in the MCP-client list (`Cursor, VS Code, Windsurf, …`) is now `… Windsurf, etc.`.
- Swept every human-readable repo doc for currency: tool count (**270**), addon version (**1.4.2**), and the install / registration steps (`npx breakpoint-mcp init` / `doctor`, `npm i -g breakpoint-mcp`, `claude mcp add`) are all current. Republished so `host/README.md` on npmjs.com reflects the 270-tool surface and the Group L `vcs_*` family. Mirrors the `1.2.1` doc-republish precedent.

## [1.12.0] — 2026-07-11

Feature release — **Group L version control (`vcs_*`)**: a net-new host-side tool group that reads the project's git repository and performs safe local git actions, taking the surface from **258 to 270 tools**. The `vcs_*` tools are host-only (no addon change) and fully cloud/CI-verifiable end-to-end. This release also fixes the first Asset Library packaging report (#102) — the addon moves `1.4.1` → `1.4.2`. Host version `1.11.0` → `1.12.0`; **`npm breakpoint-mcp@1.12.0` live as `latest`**.

### Added — Group L version control (git) (12 tools, 258 → 270)
- **New host-side tool group `vcs_*` (Plane B).** Git wrappers over the `git` binary, rooted at the configured project path (`git -C <projectPath>`, explicit argv, **no shell**). Host-side: they need neither the editor nor a language server, so they answer whenever the project is a git work tree — the cloud-verifiable-end-to-end lane the backlog flagged (`BACKLOG.md` §S74, `HANDOFF_SESSION86.md` §3/§4). `git` absent → a clear "not installed" result; path not a work tree → a clear "not a git repository" result; large patch/file output is head-truncated with a `truncated` flag; never a hang.
- **Six read-only tools** (never touch the index or working tree, so none are undoable or gated):
  - **`vcs_status`** — branch, upstream ahead/behind, and the staged / unstaged / untracked / unmerged file lists (parsed from `status --porcelain=v2 --branch`); `clean=true` when nothing is pending.
  - **`vcs_log`** — recent commits newest-first (full+short hash, author, ISO date, subject); optional `path` filter and `max_count` (default 20).
  - **`vcs_diff`** — working-tree (default) or staged (`staged=true`) unified diff, optional `path` scope; returns the patch plus the changed-file list parsed from it.
  - **`vcs_show`** — a commit's metadata + patch, or (with `path`) a file's content at any `ref` (default HEAD).
  - **`vcs_branch_list`** — branches with short object name + current-branch flag; `remotes=true` includes remote-tracking branches.
  - **`vcs_blame`** — per-line last-change attribution (commit, author, ISO date, text) for a file, optional 1-based `[start,end]` range.
  - **`vcs_status`** — branch, upstream ahead/behind, and the staged / unstaged / untracked / unmerged file lists (`status --porcelain=v2 --branch`); `clean=true` when nothing is pending.
  - **`vcs_log`** — recent commits newest-first (full+short hash, author, ISO date, subject); optional `path` filter and `max_count` (default 20).
  - **`vcs_diff`** — working-tree (default) or staged (`staged=true`) unified diff, optional `path` scope; returns the patch plus the changed-file list parsed from it.
  - **`vcs_show`** — a commit's metadata + patch, or (with `path`) a file's content at any `ref` (default HEAD).
  - **`vcs_branch_list`** — branches with short object name + current-branch flag; `remotes=true` includes remote-tracking branches.
  - **`vcs_blame`** — per-line last-change attribution (commit, author, ISO date, text) for a file, optional 1-based `[start,end]` range.
- **Six Tier-A mutating tools — safe local only, no network** (steered this session: Tier A + gate-destructive-only + exclude network). Only ops that lose work or rewrite history are elicitation-gated via `host/src/confirm.ts` `gate()` (honors `confirm:true`, and **blocks** — never runs silently — on a client that can't elicit):
  - **`vcs_add`** — stage `paths` (or all with none); reversible, **ungated**.
  - **`vcs_commit`** — commit the staged changes with a message; reversible (`reset --soft`), **ungated**; signing disabled so it can't block on a passphrase; errors clearly on an empty index.
  - **`vcs_restore`** — discard uncommitted working-tree changes to `paths`; **gated** (data loss).
  - **`vcs_stash`** — `push`/`pop`/`list`/`drop`; only `drop` is **gated**.
  - **`vcs_branch_create`** — create a branch (optional `from`, optional `switch`); reversible, **ungated**.
  - **`vcs_switch`** — switch to an existing branch; no `--force` (git refuses on a dirty conflict), **ungated**.
- **Network ops (push / pull / fetch) intentionally excluded** — the cloud can't reach the private origin and push has irreversible remote effects no CI test can exercise; they remain a Mac-side step. Rationale + the deferred alternatives in `GROUP_L_VCS_SPEC.md`.
- **Paths accept `res://…`** (project-relative) or repo-relative, consistent with the Group K host tools.
- **Same quality bar:** frozen `outputSchema` entries in `host/src/schemas.ts` for all twelve; `docs/TOOL_CATALOG.md` gains a `## Group L` section (per-tool Input/Output blocks) + twelve index rows (the two gated tools carry the destructive marker); registration meta-test `EXPECTED_TOOL_COUNT` 258 → 270; `host/test/vcs.test.ts` adds 12 cases driving the real `git` binary against throwaway repo fixtures (every tool + the not-a-repo error path + the full gate matrix: blocked-without-elicitation / confirm-bypass / accept / decline for `vcs_restore`, and blocked `vcs_stash drop`). `contract_check.py` parity holds at **270 tools**; host suite **354 → 366**.
### Fixed
- **`godot_version` non-zero-exit test made portable.** `host/test/cli.test.ts` hardcoded `/bin/false`, which exists on Linux but **not on macOS** (it lives at `/usr/bin/false`); on macOS the spawn was an `ENOENT`, so the captured exit code was correctly `null` and the assertion (`=== 1`) failed. Switched the test to `/usr/bin/false` (present on both). `runCaptured` was already correct — **no production behavior changed**. (Surfaced running the host suite on macOS + Node 26 for the first time; CI has always been Linux.)

### Packaging
- **`.gitattributes` trims the Asset Library download to the addon** (fixes #102, reported by @Gramps). Export-ignore everything by default, re-include `/addons`, normalize line endings to LF — the generated ZIP drops from **169 files (~855 KB) to 10 files (~51 KB)**, shipping only the plugin (not `host/`, `docs/`, `example/`, or CI). Also bundled a copy of the LICENSE inside `addons/breakpoint_mcp/` (the README was already there), per the Godot submission guidelines. Addon `ADDON_VERSION` + both `plugin.cfg` move `1.4.1` → `1.4.2`.

## [1.11.0] — 2026-07-11

Maintenance release — **Group N first-live-dogfood fixes (Findings A–E)**: the first live exercise of the Group N composite-authoring layer against the real Godot 4.7 editor surfaced five concrete defects (session 83); this release fixes all five, each with a regression test. Unlike `1.6.0`–`1.10.0` (host-only), this release also touches the **addon** (the editor-crash guard, D), so both `addons/breakpoint_mcp/` copies change together and the addon version moves `1.4.0` → `1.4.1`. Tool surface unchanged at **258**. Version `1.10.0` → `1.11.0`. `npm publish` remains deferred (registry stays `1.4.1`).

### Fixed — Group N composite-authoring layer (five live-dogfood findings)
- **D — `scene.save` no longer crashes the editor (addon; highest impact).** A request handler that pumps the editor main loop — `scene.save` triggers a filesystem rescan/reimport — re-entered `bridge_server._process` mid-dispatch. Because a client's line is cleared from its buffer only *after* `_drain_lines` returns, the re-entrant tick re-read and re-dispatched the **same** line, recursing until the stack overflowed (`operations.gd:_scene_save` ↔ `bridge_server._process` / `_drain_lines` / `_handle_line`). `_process` now holds a re-entrancy guard (`_dispatching`): a re-entrant tick returns immediately and the buffered bytes are serviced on the next top-level tick. Regression: `example/tests/bridge_reentrancy_smoke.gd` drives the real `bridge_server` over a loopback socket with a stub op whose `dispatch` re-enters `_process`, and asserts the one queued line dispatches exactly once (it re-dispatches — and the assertion fails — without the guard). Wired into the integration CI lane (`BRIDGE_REENTRANCY_*`, 7/7 on Godot 4.7). Verified live: `card_template_create` + `scene.save` complete and the editor survives.
- **A — `card_instance` / `piece_instance` now bind data at author time (host).** The generated card/piece scripts were not `@tool`, so on an edited-scene instance Godot substitutes a `PlaceholderScriptInstance` whose methods can't be called: `has_method("set_data")` returned true but `callv("set_data", …)` failed with "Method not found", so the composite's edit-time bind silently no-op'd (`bound: []`) and the card rendered slot defaults. `buildCardScript` / `buildPieceScript` now emit `@tool`, so `set_data` / `set_face` run in the editor and the instance renders the supplied data live (verified against the real editor: `bound: [title, body]`, `Face/title.text == "Q3 Review"`). *Nuance:* an instanced card's slot values are instance-internal and, like any sealed sub-scene node, are **not** serialized as overrides on save (a Godot behavior — even `node.set_property` on an internal child does not persist); the game binds them at runtime via `set_data`, and the per-node data that *does* persist (the drag payload) is handled by Finding C's `@export`.
- **B — `interact_make_draggable` composes instead of clobbering (host).** It overwrote the target node's `script`, so pointing it at an authored card replaced the card's `set_data`/`set_face` with the drag script. It now probes the node's existing script (`node.get_property`) and, when present (and not already the target path), generates the drag script as `extends "<that script>"` — the node keeps its behavior and *gains* drag. The result reports new `composed` / `base_script` fields (added to `host/src/schemas.ts` + `docs/TOOL_CATALOG.md`). Verified live: making an instanced card draggable yields `composed: true`, `base_script: …/Card.gd`, and the saved `.tscn` shows the instance carrying the composed script.
- **C — the drag payload is a per-node `@export` (host).** `buildDraggableScript` baked the payload as a literal, so two nodes needing two payloads needed two script files. The payload is now `@export var payload: Dictionary`, written per node via `node.set_property`, so one script serves many draggables — each carrying its own payload, which **persists** in the `.tscn`.
- **E — a drop zone's signal + connection survive a reload (host).** The generated drop-zone script did not declare its `on_drop` signal (`interact_add_drop_zone` added it at runtime via `signal.add_user_signal`, not persisted), and the optional `notify` connection was made with `flags: 0` (no `CONNECT_PERSIST`), so neither survived a scene reload (compounded by D interrupting the connection write). The script now declares `signal <on_drop>(payload)` in-script, and the `notify` connection uses `CONNECT_PERSIST`. Verified live: the saved `.tscn` carries `[connection signal="dropped" from="KeepZone" to="." method="_on_keep"]` and the generated `KeepZone.gd` declares the signal.

### Quality
- Host unit tests updated + added in `host/test/tabletop.test.ts` (compose vs standalone + self-compose guard, per-node payload emit, `@tool` in the card/piece generators, in-script drop signal + persisted-connection flags); `example/tests/interact_build_smoke.gd` gains a composition section (a drag script that `extends` a card keeps `set_data` and gains drag), a per-node-payload override assertion, and in-script-signal assertions (**49/49** on Godot 4.7). All other headless smokes (`OPS_UNIT` 180, `CARD_BUILD` 24, `BOARD_BUILD` 12, `PIECE_BUILD` 28, `CARD_SETFACE` 27, `BOARD_TILE` 16) still pass unchanged, and `contract_check.py` parity holds. The full flow was re-run live against Godot 4.7 from the Cowork bridge (`card_template_create` → `scene.new` → `card_instance` → `interact_make_draggable` → `interact_add_drop_zone` → `scene.save`) with the editor surviving throughout — the clean re-run of the session-83 dogfood.

## [1.10.0] — 2026-07-11

Feature release — **Group N Board-slice fast-follow (tile-backed board cells)**: two composites that add the `TileMapLayer` idiom alongside the marker board — `board_tile_create`, `board_tile_place` — carrying the surface from **256 to 258 tools**. A marker board (`board_create` / `board_place`) addresses cells through per-cell `cell_<id>` anchor nodes; a tile board is a `TileMapLayer` grid whose cells are addressed by integer `[x, y]` tile coordinates, with no per-cell anchor node. Host-only: like the rest of Group N each composite decomposes onto already-audited primitives emitted through the injectable emit-sink, so **no addon method is added** and both `addons/breakpoint_mcp/` copies stay byte-identical. Version `1.9.0` → `1.10.0`.

### Added — Group N tile-backed board cells (2 tools, 256 → 258)
- **`board_tile_create` — build a tile-backed board scene** (writes a scene, and a `TileSet` `.tres` unless one is supplied; elicitation-gated). Stands up a `Node2D` root + a `TileMapLayer` bound to a `TileSet` — a supplied `tileset` `.tres`, or a fresh empty one created at `<scene>_tiles.tres` so the layer has a real `tile_size` (the coordinate frame). `paint` optionally fills the whole `rows`×`cols` grid with one tile from the bound source in a single action; omitted, the cells stay empty and the layer is a coordinate frame only. Emits `scene.new` → (`tileset.create`) → `tilemaplayer.create` → (`tilemap.set_cells_rect`) → `scene.save`.
- **`board_tile_place` — snap a node onto a tile coordinate** (undoable in-scene node authoring; ungated, the `node_*` model). Places a node onto a `TileMapLayer` cell by integer `[x, y]` `coord`, computing the local position host-side from `tile_size` — centre `(coord + 0.5) × tile_size` (default) or corner `coord × tile_size` — matching Godot's `TileMapLayer.map_to_local`, plus an optional `align` offset. With `reparent` (default) the node is moved under the layer so the coordinate is layer-local. Emits `node.reparent` + `node.set_property`.
- **General-purpose by construction.** Cells carry only integer coordinates; no domain vocabulary enters the tool code, schemas, catalog, or tests, and the game-neutrality guard passes with no new bans.
- **Same quality bar:** frozen `outputSchema` entries in `host/src/schemas.ts` for both tools; `contract_check.py` parity (`docs/TOOL_CATALOG.md` gains both sections + index rows; the current-surface tool-count references in `README.md` / `host/README.md` / `docs/USER_GUIDE.md` / `CONTRIBUTING.md` are reconciled 256 → 258); registration meta-test `EXPECTED_TOOL_COUNT` 256 → 258; 7 new op-sequence cases in `host/test/tabletop.test.ts` (frame-only vs supplied-tileset + paint, atlas default, bad-input rejection; centre / corner / align / reparent placement and defaults); and a new headless `example/tests/board_tile_smoke.gd` (build → pack → round-trip a painted tile board, and assert `board_tile_place`'s centre/corner math equals the engine's `map_to_local`, plus the reparent-and-snap move; `BOARD_TILE_*` markers, 16/16 on Godot 4.7) wired into the `gdscript-unit` CI lane. Host-only change — both `addons/breakpoint_mcp/` copies are untouched.

## [1.9.0] — 2026-07-11

Feature release — **Group N Card-slice fast-follow (`card_set_face`)**: one composite that flips an instanced card (or any node exposing `set_face(bool)` — the generated card **and** piece scripts both do) between its face and back, carrying the surface from **255 to 256 tools**. Host-only: like the rest of Group N it decomposes onto already-audited primitives emitted through the injectable emit-sink, so **no addon method is added** and both `addons/breakpoint_mcp/` copies stay byte-identical. Version `1.8.0` → `1.9.0`.

### Added — Group N card_set_face (1 tool, 255 → 256)
- **`card_set_face` — flip a card between its face and back** (undoable in-scene node authoring; ungated, the `node_*` model). **Instant** by default — emits a single `node.call_method(set_face, [face_up])`, so the visible side changes immediately. With **`animate`** it instead authors a reusable **flip clip** under the node from existing Group C `anim_*` primitives — a scale "pinch" on the node's own `scale` (1 → edge-on `(0, 1)` → 1) plus a **method** key that calls the setter at the edge-on midpoint, so playing the clip performs a believable flip and swaps the side exactly when the card is thinnest. Played on demand (like `piece_move`'s pop); the current face is unchanged until it plays. Purely additive — emits only existing `node.*` / `anim.*` ops, never a new engine call.
- **General-purpose by construction.** `set_face` / face / back are generic card terms; no domain vocabulary enters the tool code, schemas, catalog, or tests, and the game-neutrality guard passes with no new bans.
- **Same quality bar:** frozen `outputSchema` in `host/src/schemas.ts`; `contract_check.py` parity (`docs/TOOL_CATALOG.md` gains the `card_set_face` section + index row; the current-surface tool-count references in `README.md` / `host/README.md` / `docs/USER_GUIDE.md` / `CONTRIBUTING.md` are reconciled 255 → 256); registration meta-test `EXPECTED_TOOL_COUNT` 255 → 256; 4 new op-sequence cases in `host/test/tabletop.test.ts` (instant, custom method, animated scale-pinch + method-key additivity, custom player/anim/method names); and a new headless `example/tests/card_setface_smoke.gd` (build → pack → round-trip the flip clip, prove the pinch plays + the method key's read-back call flips the side, `CARD_SETFACE_*` markers, 27/27 on Godot 4.7) wired into the `gdscript-unit` CI lane. Host-only change — both `addons/breakpoint_mcp/` copies are untouched.

## [1.8.0] — 2026-07-11

Feature release — **Group N, fourth increment (the Interaction slice)**: two composites that add the drag-and-drop layer over the card/board/piece structure — `interact_make_draggable`, `interact_add_drop_zone` — carrying the surface from **253 to 255 tools**. Host-only: like the Card, Board, and Piece slices, each composite is a scripted sequence of already-audited editor-bridge primitives (`resource.create` / `node.set_property` / `node.add` / `signal.connect` / `signal.add_user_signal` / `inputmap.add_action` / `inputmap.add_event`) emitted through an injectable emit-sink, so **no addon method is added** and both `addons/breakpoint_mcp/` copies stay byte-identical. Version `1.7.0` → `1.8.0`.

### Added — Group N interaction composites (2 tools, 253 → 255)
- **`interact_make_draggable` — wire a node for drag-and-drop** (writes a behaviour script; elicitation-gated). In `control` mode Godot's built-in Control drag-and-drop picks up the attached script (`_get_drag_data` hands off `{payload, source}`, with an optional translucent preview); in `node2d` mode the script carries the payload and follows the pointer from a button-driven handler, registering a drag input action (`inputmap.add_action` / `add_event`) and connecting the hit area's `input_event` to the handler. Emits `resource.create` → `node.set_property` (+ the input/signal ops for node2d) and returns the wired-node summary.
- **`interact_add_drop_zone` — mark a node as a drop target** (writes a behaviour script; elicitation-gated). Validates an incoming payload with a neutral `key ∈ values` predicate and emits an `on_drop` user signal on a valid drop. `control` mode overrides `_can_drop_data` / `_drop_data`; `node2d` mode builds an `Area2D` + `CollisionShape2D` hit region and exposes a `try_drop(payload)` seam. Adds the `on_drop` user signal (`signal.add_user_signal`) and optionally connects it to a handler (`signal.connect`).
- **General-purpose by construction.** The drag carries a caller-supplied neutral `payload` Dictionary and the accept predicate is `key ∈ values` — no domain concepts in the tool code, schemas, catalog, or tests; the game-neutrality guard test still passes unchanged. Per the plan, Increment 4's *feel* (drag thresholds / snap distance / affordances) is left to a later live-editor pass — the generated scripts are a correct, compile-checked starting point.
- **Same quality bar:** frozen `outputSchema` entries in `host/src/schemas.ts` for both tools; `contract_check.py` parity (`docs/TOOL_CATALOG.md` gains the two interact tools + index rows; the current-surface tool-count references in `README.md` / `host/README.md` / `docs/USER_GUIDE.md` / `CONTRIBUTING.md` are reconciled 253 → 255); registration meta-test `EXPECTED_TOOL_COUNT` 253 → 255; 9 new op-sequence cases in `host/test/tabletop.test.ts` (control vs node2d draggable, preview, custom button/action/hit_area, drop-zone accept/notify, node2d `Area2D` build) plus the `gdDictLiteral` / `gdQuote` literal-builder checks; and a new headless `example/tests/interact_build_smoke.gd` (compile → `res://` script round-trip → behavioural exercise of all four generated scripts, `INTERACT_BUILD_*` markers) wired into the `gdscript-unit` CI lane. Host-only change — both `addons/breakpoint_mcp/` copies are untouched.

## [1.7.0] — 2026-07-11

Feature release — **Group N, third increment (the Piece slice)**: three composites that build the movable tokens the board's cells hold — `piece_template_create`, `piece_instance`, `piece_move` — carrying the surface from **250 to 253 tools**. Host-only: like the Card and Board slices, each composite is a scripted sequence of already-audited editor-bridge primitives (`scene.new` / `node.add` / `node.set_property` / `resource.create` / `node.instantiate_scene` / `node.call_method` / `node.reparent` / `anim.*` / `scene.save`) emitted through an injectable emit-sink, so **no addon method is added** and both `addons/breakpoint_mcp/` copies stay byte-identical. Version `1.6.0` → `1.7.0`.

### Added — Group N piece-authoring composites (3 tools, 250 → 253)
- **`piece_template_create` — build a reusable piece (token) `PackedScene` from a spec** (writes files; elicitation-gated). An `Art` node (`Sprite2D` under a `Node2D` root, `TextureRect` under a `Control` root), an optional `Label`, an optional hit area (`Area2D` + `CollisionShape2D` with a `rectangle`/`circle` shape sized from `size`), and an optional two-sided `Back`, plus a generated script-backed `set_data()` / `set_face()` reusing the Card slice's binding pattern (`set_data` binds the neutral keys `art` / `color` / `label`; `set_face` flips Art+Label vs Back). Emits `scene.new` → `node.add` per node → `resource.create` (shape + GDScript) → `scene.save`, and returns the created-node map.
- **`piece_instance` — instance a piece template and bind data to it** via the template's `set_data()` (undoable node authoring). Optionally `place_on` a board cell in the same call — reusing `board_place` to reparent + snap — and surfaces which data keys bound and which had no matching slot (`bound` / `unbound`).
- **`piece_move` — move a piece onto a cell by id** (undoable node authoring), reparenting + snapping via `board_place` with an optional short scale "pop" authored from the existing Group C `anim_*` primitives (an `AnimationPlayer` under the piece keying its own `scale` 1 → pop → 1). Purely additive — it emits only existing `node.*` / `anim.*` ops, never a new engine call.
- **General-purpose by construction.** The tools build *structure* only — `Art` / `Label` / colour / hit area, no domain concepts; the game-neutrality guard test is extended so no game-specific vocabulary can slip in.
- **Same quality bar:** frozen `outputSchema` entries in `host/src/schemas.ts` for all three tools; `contract_check.py` parity (`docs/TOOL_CATALOG.md` gains the three piece tools + index rows; the current-surface tool-count references in `README.md` / `host/README.md` / `docs/USER_GUIDE.md` / `CONTRIBUTING.md` are reconciled 250 → 253); registration meta-test `EXPECTED_TOOL_COUNT` 250 → 253; 8 new op-sequence cases in `host/test/tabletop.test.ts` (template build across root types / hit-area shapes / two-sided back, instance with and without `place_on`, `piece_move` additivity + the animated pop keys) plus the `buildPieceScript` generator check; and a new headless `example/tests/piece_build_smoke.gd` (build → PackedScene round-trip → setter behaviour → place-on-cell reparent/snap, `PIECE_BUILD_*` markers) wired into the `gdscript-unit` CI lane. Host-only change — both `addons/breakpoint_mcp/` copies are untouched.

## [1.6.0] — 2026-07-11

Feature release — **Group N, second increment (the Board slice)**: two composites that build the spatial frame the card/piece instances sit on — `board_create`, `board_place` — carrying the surface from **248 to 250 tools**. Host-only: like the Card slice, each composite is a scripted sequence of already-audited editor-bridge primitives (`scene.new` / `node.add` / `node.set_property` / `node.add_to_group` / `node.reparent` / `scene.save`) emitted through an injectable emit-sink, so **no addon method is added** and both `addons/breakpoint_mcp/` copies stay byte-identical. Version `1.5.0` → `1.6.0`.

### Added — Group N board-authoring composites (2 tools, 248 → 250)
- **`board_create` — build a board scene with addressable cells from a layout spec** (writes files; elicitation-gated). Cells are `Marker2D` (or `Control`) anchors, each a `cell_<id>` node in the `board_cells` group, laid out by one of three general-purpose modes — `ring{cells:[ids]}` (evenly around a circle), `grid{rows,cols}` (ids `"<row>_<col>"`), or explicit `cells:[{id,x,y}]` — with an optional `background` (solid `color` or a `res://` `art` texture). Emits `scene.new` → background → per-cell `node.add` + `node.set_property(position)` + `node.add_to_group("board_cells")` → `scene.save`, and returns the `cell_id → node_path + position` map.
- **`board_place` — parent/snap an existing node onto a cell by id** (undoable node authoring). Reparents the node under `<board>/cell_<cell>` and sets its local position to the `align` offset (default centred on the anchor); returns the node's new path.
- **General-purpose by construction.** The tools build *structure* only — cells carry nothing but caller-supplied ids; the game-neutrality guard test is extended so no game-specific vocabulary can slip in. `tile`-backed cells (a Group D `TileMapLayer`) are a deferred fast-follow.
- **Same quality bar:** frozen `outputSchema` entries in `host/src/schemas.ts` for both tools; `contract_check.py` parity (`docs/TOOL_CATALOG.md` gains the two board tools + index rows; the current-surface tool-count references in `README.md` / `host/README.md` / `docs/USER_GUIDE.md` / `CONTRIBUTING.md` are reconciled 248 → 250); registration meta-test `EXPECTED_TOOL_COUNT` 248 → 250; 8 new op-sequence cases in `host/test/tabletop.test.ts` (ring / grid / explicit layouts, background ordering, `cell_kind` / `root_type`, duplicate/malformed-id rejection, `board_place` reparent+snap) plus the pure ring/grid math; and a new headless `example/tests/board_build_smoke.gd` (build → PackedScene round-trip → cell group/position survival → `board_place` snap, `BOARD_BUILD_*` markers) wired into the `gdscript-unit` CI lane. Host-only change — both `addons/breakpoint_mcp/` copies are untouched.

## [1.5.0] — 2026-07-11

Feature release — **Group N, the card-authoring composite lane**, first increment (the **Card slice**): four composites that build and data-bind Godot card scenes from a spec — `card_template_create`, `card_instance`, `card_hand_layout`, `card_deck_from_table` — carrying the surface from **244 to 248 tools**. Host-only: each composite is a scripted sequence of already-audited editor-bridge primitives (scene / control / node / theme / resource) emitted through an injectable emit-sink, so **no addon method is added** and both `addons/breakpoint_mcp/` copies stay byte-identical. Version `1.4.1` → `1.5.0`.

### Added — Group N card-authoring composites (4 tools, 244 → 248)
- **`card_template_create` — build a reusable card `PackedScene` from a slot spec** (writes files; elicitation-gated). Named slots (`label` / `rich_text` / `texture` / `panel` / `badge`) become the card's regions, with optional per-slot rect/anchor/align/wrap/font-size, an inline theme (StyleBoxFlat + `theme_*`), and a two-sided card back. Emits `scene.new` → a `Face` container → one node per slot → a generated script-backed `set_data()` / `set_face()` (`resource.create` GDScript + `node.set_property` script) → `scene.save`, and returns the slot→node map.
- **`card_instance` — instance a template into the open scene and bind data to its slots** via the template's `set_data()` (undoable node authoring). Surfaces which data keys bound and which had no matching slot (`bound` / `unbound`).
- **`card_hand_layout` — instance N cards under a container and arrange them** as a `row`, `fan`, `stack`, or `grid`, with `spacing` / `overlap` / `fan_angle` / `columns` / `align` / `origin` knobs. The layout math is pure and unit-tested.
- **`card_deck_from_table` — stamp one card per row of a CSV/JSON table**, binding columns to slots via a `column_map` of bare `{column}` references or composed `"{a} · {b}"` templates, with an optional row `filter`, `limit`, `art_column`, and `layout`. Columns no slot referenced are surfaced (`unmapped_columns`), never silently dropped.
- **General-purpose by construction.** The composites build and data-bind *structure* and invent no game rules, values, or names — all data flows in from the caller. They decompose entirely onto existing, already-audited primitives, so they inherit that verification story and add no engine-facing risk.
- **Same quality bar:** frozen `outputSchema` entries in `host/src/schemas.ts` for all four tools; `contract_check.py` parity (`docs/TOOL_CATALOG.md` gains a `## Group N` section + 4 index rows; the current-surface tool-count references in `README.md` / `host/README.md` / `docs/USER_GUIDE.md` / `CONTRIBUTING.md` are reconciled 244 → 248); registration meta-test `EXPECTED_TOOL_COUNT` 244 → 248; new `host/test/tabletop.test.ts` covering per-tool op-sequences, the `{placeholder}` column resolver (bare / composed / missing → error), the layout math, CSV/JSON parsing, and a game-neutrality guard; and a new headless `example/tests/card_build_smoke.gd` (build → PackedScene round-trip → setter behaviour, `CARD_BUILD_*` markers) wired into the `gdscript-unit` CI lane. Host-only change — both `addons/breakpoint_mcp/` copies are untouched.

## [1.4.1] — 2026-07-10

Patch release — adds the `init --from-github` addon-source escape hatch to the onboarding CLI: `breakpoint-mcp init --from-github [ref]` sources the editor addon from GitHub instead of the copy bundled in the npm tarball (for a missing/corrupt bundle, or to install a different ref than the installed package shipped). Host-CLI only — no addon, schema, catalog, or contract change; still **244 tools**, and the editor addon is byte-identical to 1.4.0 (its `plugin.cfg` / `ADDON_VERSION` stay at 1.4.0). Version `1.4.0` → `1.4.1`.

### Added — `init --from-github` addon-source escape hatch (host CLI; no new tools, still 244)
- **`breakpoint-mcp init --from-github [ref]` fetches the editor addon from GitHub instead of the copy bundled in the npm tarball.** The bundled copy stays the default (offline, version-matched by construction); `--from-github` is the escape hatch for when the bundle is missing/corrupt, or to install a different ref than the installed package shipped — e.g. `--from-github main` for the latest, or `--from-github v1.3.0` for an older addon. Without an explicit ref it defaults to this package's own version tag (`v<version>`), so it mirrors the bundled addon but sourced from GitHub. `--repo <owner/repo>` overrides the source repository (default `jlivingston-Cipher/godot-breakpoint-mcp`) for forks.
- **Dependency-free and offline-testable.** One GitHub `git/trees` API call lists the `addons/breakpoint_mcp/**` blobs at the ref, then each file is downloaded from `raw.githubusercontent.com` (a CDN that does not count against the REST rate limit) into a temp dir that is removed once the addon is installed — so a `--from-github` run costs a single API request. It uses Node 18+'s global `fetch` (no new dependency; the package stays SDK-and-zod-only) behind an injected seam, so the whole path is unit-tested with a fake fetch. It honours `GITHUB_TOKEN` / `GH_TOKEN` when set (higher rate limit / private forks). `--dry-run` prints the plan and makes no network call. Clear errors on a bad repo/ref (404), rate-limiting (403, which hints `GITHUB_TOKEN`), a ref with no addon, or a download failure — each pointing back to the bundled default.
- **No tool-surface or addon change.** Host-CLI only — `EXPECTED_TOOL_COUNT`, `contract_check.py`, the catalog, `schemas.ts`, and both `addons/breakpoint_mcp/` copies are untouched; still **244 tools**. New `host/src/cli/github.ts`; +10 host tests (`host/test/cli_github.test.ts` plus three `runInit --from-github` cases in `cli_init.test.ts`) cover the happy path, byte-exact binary download, the 404 / 403 / no-addon / truncated-tree / failed-download errors, and the dry-run "no network" guarantee.

## [1.4.0] — 2026-07-10

Feature release — the **in-editor status/config dock**: a thin editor panel (the GUI twin of `doctor` + `init`) that reports bridge health across the editor / runtime / GDScript-LSP / DAP planes, shows the ports and project path, and offers a one-click **Copy MCP-client config**. Addon-only — the tool surface is unchanged at **244 tools**, with no configuration or behaviour change to the server or any existing tool. This release also fixes the long-standing cosmetic addon-version drift: `ADDON_VERSION` in `operations.gd` moves `1.0.0` → `1.4.0` to match `plugin.cfg` and the package (surfaced in `editor_ping.addon_version`). Version `1.3.0` → `1.4.0`.

### Added — in-editor status/config dock (Phase-4 adoption; addon-only, still 244 tools)
- **A thin "Breakpoint MCP" editor dock — the in-editor twin of `doctor` + `init`.** Enabling the plugin now adds a compact panel to the editor's right dock that reports the live health of all four bridges — **editor** (read in-process from the bridge server: listening state, port, connected-client count), **runtime**, **GDScript LSP**, and **DAP** (short, non-blocking `StreamPeerTCP` probes on a ~2 s refresh, with the LSP/DAP ports read from `EditorSettings` so the dock reflects the user's actual configuration, not just the defaults) — alongside the project path and a one-click **Copy MCP-client config** button that puts the exact `mcpServers → godot` snippet `breakpoint-mcp init` prints onto the clipboard. It closes the known setup-friction weakness and gives the bundled-UX feel of the chat-style addons *without* becoming a chat app: scope is connection / status / config only; the assistant still runs in the user's MCP client. New `addons/breakpoint_mcp/status_dock.gd` (with pure, editor-free static helpers for the config snippet and status formatting); a read-only `get_status()` added to `bridge_server.gd`; `plugin.gd` adds/removes the dock in `_enter_tree` / `_exit_tree`. No new MCP tools and no dispatcher changes — **still 244 tools**, `contract_check.py` unchanged. +16 assertions in the socket-free GDScript unit suite (`example/tests/ops_unit_test.gd`, now 180) pin the snippet's parity with the host `init` CLI and the status glyph / row formatting; both tracked addon copies stay byte-identical.

## [1.3.0] — 2026-07-10

Feature release — the **LSP-depth tail**: two new read-only GDScript LSP tools (`gd_call_hierarchy`, `gd_semantic_tokens`), carrying the surface from **242 to 244 tools**. No addon logic, configuration, or existing-tool behaviour change; both new tools feature-detect their Godot capability and degrade gracefully, so no client sees a new failure mode. Version `1.2.1` → `1.3.0`.

### Added — LSP-depth tail: call hierarchy + semantic tokens (2 tools, 242 → 244)
- **`gd_call_hierarchy` — find a function's callers or callees over the GDScript language server.** Resolves the symbol at a position with `textDocument/prepareCallHierarchy`, then queries `callHierarchy/incomingCalls` (who calls this — the default `direction`) or `callHierarchy/outgoingCalls` (`direction: "outgoing"`, what this calls), returning each related function (`name`, `kind`, `uri`, position, `detail`) with the call-site `ranges`. Read-only.
- **`gd_semantic_tokens` — the semantic-highlighting tokens for a whole script.** Requests `textDocument/semanticTokens/full` and decodes the LSP packed-integer form (delta-encoded 5-tuples of line/char/length/type/modifiers) through the server's advertised legend into absolute tokens, each with its position, `length`, `type` and `modifiers`. Read-only.
- **Engine reality (the D7 lesson).** Godot's GDScript language server does not advertise `callHierarchyProvider` or `semanticTokensProvider` (observed through 4.7), so both tools **feature-detect the capability and return a clear "unsupported" message** rather than provoking a raw `-32601`, and keep a `-32601` belt-and-suspenders for a build that advertises one but still answers "method not found" — the same graceful-degradation contract as `gd_workspace_symbols` / `gd_code_action`. If a future Godot build implements either provider, the tool un-gates automatically via feature-detection. The experimental editor-plane CI probe (`test-integration/editor-lsp.integration.mjs`) gains a `D7_CAPS3` marker plus two live probes so the per-build truth is recorded across the 4.3 / 4.7 matrix.
- **Same quality bar:** frozen `outputSchema` entries in `host/src/schemas.ts` for both tools; `contract_check.py` parity (`docs/TOOL_CATALOG.md` gains the two detail blocks + 2 index rows; the current-surface tool-count references in `README.md` / `host/README.md` / `docs/USER_GUIDE.md` / `CONTRIBUTING.md` are reconciled 242 → 244); registration meta-test `EXPECTED_TOOL_COUNT` 242 → 244; +7 host tests in `lsp.test.ts` covering the supported incoming/outgoing and packed-token-decode paths and the capability-absent / `-32601` "unsupported" paths, plus representative shape validations in `schemas.test.ts`. Host-only change — both `addons/breakpoint_mcp/` copies are untouched (LSP tools speak to Godot's own language server, not the addon).

## [1.2.1] — 2026-07-10

Patch release — republishes the package so its npm page reflects the `init` / `doctor` onboarding docs. npm READMEs are immutable per published version, so the `host/README.md` parity fix only reaches npmjs.com on a new publish. No code, tool, schema, or configuration change — still **242 tools**; version `1.2.0` → `1.2.1`.

### Documentation
- Brought the npm-published `host/README.md` to parity with the repository README: it now documents the `breakpoint-mcp init` and `doctor` onboarding commands and notes that the editor addon ships **inside the package** (so users who install from npm do not need the repository to get the addon). Also clarified in the root `README.md` that the by-hand "Install the editor addon (manual)" steps are the from-source route, and that npm users can use `init` instead. No code, tool, schema, or version change (still **242 tools** at 1.2.0). The npm package page reflects this on the next publish, since a version's README is immutable once published.

## [1.2.0] — 2026-07-10

Onboarding release — a one-command install (`breakpoint-mcp init`) and a health-check (`breakpoint-mcp doctor`), with the editor addon now shipped inside the npm package so `init` works offline. Host + packaging only: the tool surface is unchanged at **242 tools**, and there is no configuration or behaviour change to the server or any existing tool. Version `1.1.0` → `1.2.0`.

### Added
- **`breakpoint-mcp doctor` — a CLI health-check for an install (the first half of the onboarding/adoption work).** The `bin` now dispatches on the first argument: `breakpoint-mcp doctor` and `breakpoint-mcp --help` are handled, while any other invocation — including no arguments, which is how every MCP client launches the server — falls through to the unchanged stdio MCP server, so the server's launch contract is untouched. `doctor` probes the Godot binary (`GODOT_BIN --version`), the editor addon (installed at `addons/breakpoint_mcp/plugin.cfg` and enabled in `project.godot`), and the four bridges (editor 9080, runtime 9081, GDScript LSP 6005, DAP 6006), printing an aligned status table with actionable hints or, with `--json`, a structured report. The four bridges are informational by default (the editor/game may legitimately not be running when you check an install); `--require-live` promotes them to required, and `--include-csharp` additionally probes OmniSharp / netcoredbg on PATH. The exit code is 0 iff no required check failed, so `doctor` doubles as a pre-flight gate. New host-only files `host/src/cli/args.ts` (a dependency-free flag parser) and `host/src/cli/doctor.ts`; +14 host tests (`cli_args.test.ts`, `cli_doctor.test.ts`) exercising the bridges against loopback TCP stubs and a POSIX shell Godot fixture; a new `ci.yml` build-job smoke runs the built `dist` and asserts the subcommand routes (marker `ONBOARD_DOCTOR_OK`). No new MCP tools — still **242 tools**; `contract_check.py` unchanged. (The `init` installer plus the README / User-Guide onboarding rewrite land next.)
- **`breakpoint-mcp init` — one-command onboarding; the editor addon now ships in the npm tarball.** `breakpoint-mcp init` installs the editor addon into a target project (`addons/breakpoint_mcp/`), enables it in `project.godot` (creating the `[editor_plugins]` section or appending to the existing `enabled=PackedStringArray(...)` without dropping other plugins), and wires the MCP client — printing the `mcpServers` snippet by default, or writing/merging it into a client's config with `--client claude-code|claude-desktop|cursor|windsurf|vscode` (existing configs are backed up to `.bak`; a config that is not valid JSON is left untouched). Idempotent and non-destructive: an already-installed addon is skipped unless `--force`, an already-enabled plugin is a no-op, `--dry-run` previews without writing, and `--project <dir>` targets a specific project. To make `init` work offline from `npx`, the addon — whose source of truth is the repo-root `addons/breakpoint_mcp/`, outside the `host/` package — is staged into `host/addon/` at `prepublishOnly` (new `host/scripts/stage-addon.mjs`, `npm run stage-addon`) and included via `package.json` `files`; `init` resolves the bundled copy in the published package and falls back to the repo-root copy in the dev tree. New `host/src/cli/init.ts` + `host/src/cli/clients.ts`; +14 host tests (`cli_init.test.ts`) covering the `project.godot` edit cases, addon install/skip/overwrite, client-config merge, and the end-to-end command; two new `ci.yml` build-job smokes assert `init` installs + enables into a throwaway project (`ONBOARD_INIT_OK`) and that the addon is present in the packed tarball (`ONBOARD_PACK_OK`). No new MCP tools — still **242 tools**.

## [1.1.0] — 2026-07-10

### Removed
- **Removed the backward-compatible `CLAUDE_*` environment-variable deprecation shim.** The `CLAUDE_*` → `BREAKPOINT_*` rename shipped in `1.0.0` with a one-cycle compatibility fallback: both the host (`envCompat` in `host/src/config.ts`) and the addon (`_env_compat` in `bridge_server.gd` / `runtime_bridge.gd`) read the `BREAKPOINT_*` name first and fell back to a set `CLAUDE_*` with a one-time deprecation warning. That fallback is now gone — the seven overrides (`BREAKPOINT_BRIDGE_{HOST,PORT,TIMEOUT_MS}`, `BREAKPOINT_RUNTIME_{HOST,PORT,TIMEOUT_MS}`, `BREAKPOINT_RESOURCE_COALESCE_MS`) are read directly from the `BREAKPOINT_*` names only, and a set `CLAUDE_*` is now ignored. **Migration:** if you still set any `CLAUDE_*` variable, rename it to its `BREAKPOINT_*` equivalent; `GODOT_*` variables are unaffected. Treated as a **minor** bump rather than a major: the `CLAUDE_*` names were only ever shipped as an already-deprecated compatibility alias (added in `1.0.0` explicitly scheduled for removal after one cycle — `BREAKPOINT_*` has been the canonical, documented interface since `1.0.0`), so their removal does not break the documented public configuration surface. Tests were updated to pin the new behaviour: host `config.test.ts` drops the two compat/precedence cases and adds a regression test asserting a set `CLAUDE_*` is ignored, and the GDScript unit suite drops `_test_runtime_env_compat` (the `_env_compat` helper it exercised no longer exists), moving the suite from **167 → 164 assertions**. Both `addons/breakpoint_mcp/` copies stay byte-identical; still **242 tools**. Version `1.0.0` → `1.1.0`.

### Changed
- **Test-coverage hardening** (no behaviour, tool, schema, or version change): extended the editor-free GDScript unit suite (`example/tests/ops_unit_test.gd`) from 55 to **111 assertions**. New coverage — all still headless, no editor / bridge / GUI: the `variant_json` codec's previously-untested `encode` branches (non-`Resource` `Object` → `{__type__:"Object"}`, `Resource` → `{__type__:"Resource"}`, the `Unsupported` fallback for unhandled Variant types such as `Transform3D`, element-wise packed-array encoding, and `Rect2` tag fields) and its `decode` fallbacks (unknown `__type__` → `null`, `Object` / missing-`Resource` tags → `null`, and the `Color`-alpha / `Quaternion`-`w` / integer-vector `int()` defaults); the pure `operations.gd` helper `_resource_class_ok`; and the FIRST unit coverage of `runtime_bridge.gd`'s editor-free helpers, exercised WITHOUT entering the SceneTree so no TCP server opens — the `{ok}`/`{err}` envelope, `_dispatch`'s `ping` and unknown-method paths, `_get_monitors` key filtering, the `CLAUDE_*` → `BREAKPOINT_*` `_env_compat` shim (including its legacy-fallback deprecation warning), and the `push_log` / `_get_log` ring buffer (`since_seq` + level filtering and `LOG_CAP` eviction). Runs under the existing headless `gdscript-unit` CI job, still gated on the `OPS_UNIT_SUMMARY` / `OPS_UNIT_FAIL` markers (validated locally against Godot 4.7 — 111/111). No addon logic changed and both `addons/breakpoint_mcp/` copies stay byte-identical; still 242 tools at 1.0.0.
- **Test-coverage hardening** (no behaviour, tool, schema, or version change): extended the editor-free GDScript unit suite (`example/tests/ops_unit_test.gd`) from **111 to 153 assertions**. New coverage — still headless, no editor / bridge / GUI: the `_base()`-dependent `runtime_bridge.gd` handlers, reached via a `_FixtureRuntimeBridge` subclass that overrides `_base()` with an in-memory scene fixture so the handlers run WITHOUT entering the live `SceneTree` (an instance added to a real tree would fire `_ready()` and open the runtime TCP server). Covers `_get_tree` (the `no_scene` error, node serialization incl. the `visible` field and `max_depth` truncation), `_resolve` / `_path_of`, `_get_property` / `_set_property` (Variant⇄JSON codec round-trip through the tagged-object form, plus `bad_path`), `_call_method` (`callv` return, `no_method`, `bad_path`), `_emit_signal` (a scripted-signal success with decoded args, plus `no_signal` / `bad_path`), and `_inject_input` (`bad_kind` plus the action / key / mouse-button / mouse-motion paths on a plain instance), each with the matching `_dispatch` routing. Runs under the existing headless `gdscript-unit` CI job, still gated on the `OPS_UNIT_SUMMARY` / `OPS_UNIT_FAIL` markers (validated locally against Godot 4.7 — 153/153). No addon logic changed and both `addons/breakpoint_mcp/` copies stay byte-identical; still 242 tools at 1.0.0.
- **Internal refactor** (no behaviour, tool, schema, or version change): split the ~2,600-line `registerEditorTools` in `host/src/tools/editor.ts` — a single function that registered all **145** Plane A (live-editor) tools — into a new `host/src/tools/editor/` directory of **16 per-domain modules** (`core`, `scene`, `node`, `signal`, `introspection`, `resource`, `filesystem`, `animation`, `tiles`, `physics`, `particles`, `shader`, `audio`, `ui`, `spatial`, `project_input_test`) plus a shared `common.ts` (the `Bridge error` success/`fail` envelope and the `makeCall` bridge-call factory exported as the `EditorCall` type). `editor.ts` is now a 46-line dispatcher that builds the shared `call` helper once and invokes each group **in its original order**, so the registered tool set and registration order are byte-identical — verified independently that the ordered 145-name sequence is unchanged. Each module is a contiguous, verbatim slice of the original `registerTool` blocks: no tool definition, input/output schema, description, or confirmation-gating changed. `scripts/contract_check.py` now discovers tool source recursively (`glob` → `rglob`) and scans the `editor/` directory for host bridge calls. Build + typecheck green, host test suite unchanged, and `contract_check.py` still passes ALL HARD CHECKS (**242 tools · 220 input / 209 output shapes · 436 JSON blocks, 0 invalid**). Both `addons/breakpoint_mcp/` copies are untouched (host-only change). Still 242 tools at 1.0.0.
- **Test-coverage hardening** (no behaviour, tool, schema, or version change): extended the editor-free GDScript unit suite (`example/tests/ops_unit_test.gd`) from **153 to 167 assertions**, closing the last editor-free gaps the session-69 handoff flagged as needing a live `SceneTree`. New hermetic coverage (still in `_initialize`, no editor / bridge / GUI): the pure `operations.gd` `_resource_props` helper (its `PROPERTY_USAGE_EDITOR` filter and result shape, exercised over a scripted `@export`-bearing `Resource`) and `runtime_bridge.gd` `_screenshot`'s `no_viewport` guard (a detached instance short-circuits before the renderer is touched). Plus a small new **live-tree phase** that runs in `_process` on the first frame — where the SceneTree `root` is active so nodes added to it actually enter the tree — reaching branches the hermetic phase cannot: `runtime_bridge._resolve`'s absolute (`/root/…`) branch via `get_node_or_null`, `operations._resolve`'s absolute path through `has_node` / `get_node`, and `_screenshot` with a real viewport (under the headless dummy renderer `get_image()` returns null so it degrades cleanly to `no_image`; on a GPU it returns a PNG). The suite stays **socket-free** despite iterating a frame: `_initialize` frees the example's `BreakpointRuntimeBridge` autoload before that frame (it is parented to `root` but not yet `_ready`), so its runtime TCP server never opens — the hermetic, deterministic, no-socket property the suite guards. Runs under the existing headless `gdscript-unit` CI job, still gated on the `OPS_UNIT_SUMMARY` / `OPS_UNIT_FAIL` markers (validated locally against Godot 4.7 — 167/167). No addon logic changed and both `addons/breakpoint_mcp/` copies stay byte-identical; still 242 tools at 1.0.0.

### Fixed
- `scripts/contract_check.py` now strips `//` line and `/* */` block comments (string/backtick-aware) before extracting an object literal's top-level keys and spreads, so a code comment inside a `host/src/schemas.ts` schema literal can no longer be misread as a pinned output field. The `// D6: …` note inside the `runtime_get_log` `outputSchemas` entry was previously parsed as a phantom `D6` field — harmless while that tool's catalog Output stays an inline code span, but a latent false-positive that would break shape-check #7 ("field pinned in schemas.ts but absent from the catalog Output block") the moment `runtime.ts`'s Output blocks are fenced. No behaviour, tool, schema, or version change (still 242 tools; all hard checks pass, coverage unchanged at 215 input / 204 output shapes).

## [1.0.0] — 2026-07-10

First stable public release. The tool surface — **242 tools + 5 MCP resources** — and all behaviour are identical to the built-but-never-published `0.17.0` tree; this cut only advances the version stamps and consolidates the accumulated `[Unreleased]` history into the 1.0 line. The project now commits to [Semantic Versioning](https://semver.org/): subsequent breaking changes to the tool surface, output schemas, or configuration will bump the major version. The `CLAUDE_*` → `BREAKPOINT_*` environment-variable migration ships with its backward-compatible deprecation shim intact — legacy names are still honoured for one release cycle with a one-time warning.

### Changed
- Documentation and repository-readiness pass for the first public release. Rewrote the README with a self-focused overview and no third-party comparisons; added a full **User Guide** (`docs/USER_GUIDE.md`), a **SECURITY.md** trust model with a private disclosure channel, **CONTRIBUTING.md**, **CODE_OF_CONDUCT.md**, GitHub issue/PR templates, and a **Trademarks** notice. Reconciled tool counts and version references across both READMEs, fixed broken links, scrubbed internal shorthand from shipped text, narrowed the npm `files` glob to drop source maps, hardened `.gitignore`, and removed stale internal planning docs. No tool, schema, or version change (still 242 tools at 0.17.0).
- Trimmed the public `docs/` to what users and contributors need: removed the internal `docs/D4_CSHARP_PLAN.md` (design plan) and `docs/DISTRIBUTION.md` (maintainer publishing steps), leaving the User Guide, Tool Catalog, and validation Runbook. Added `.gitignore` rules so internal design/development artifacts (handoffs, plans, backlogs) can't be committed.
- Internal code hygiene (no behaviour, tool, schema, or version change): de-duplicated the MCP success-envelope helper. Six tool modules that each re-declared an identical `ok()` (`editor`, `csdap`, `dap`, `runtime`) or identically bodied `textResult()` (`processes`, `cli`) now import the single exported `ok()` from `host/src/tools/lsp-common.ts`. Still 242 tools at 0.17.0; host tests 223/223.
- Test-coverage hardening (no behaviour, tool, schema, or version change): added host unit behaviour tests for four previously-untested planes — `editor.ts` (145 tools), `runtime.ts`, `processes.ts`, and `cli.ts`. The editor and runtime suites pin the safety contract: every destructive tool is confirmation-gated (blocks on decline and **never reaches the bridge**, bypasses on `confirm: true`), and an unreachable bridge degrades to a friendly `isError` envelope instead of throwing. The 42 unconditionally-gated editor tools are asserted by name (so adding a destructive tool without a gate fails loudly), and `editorsettings_get_set`'s read-passes / write-gates conditional is pinned. The process suite covers captured stdout/stderr stream + `since_seq` filtering and the 5000-line ring-buffer cap; the CLI suite covers stdout capture, missing-binary and non-zero-exit degradation, and detached launch. Host tests 223 → 246. Still 242 tools at 0.17.0.
- Renamed the GitHub repository slug `jlivingston-Cipher/godot-claude-bridge` → **`jlivingston-Cipher/godot-breakpoint-mcp`** to match the **Breakpoint MCP** brand and improve discoverability against the crowded `godot-mcp` field. GitHub keeps automatic redirects from the old URL, so existing links and clones continue to work. Updated the in-tree `repository` / `homepage` / `bugs` URLs in `host/package.json`, the README and host-README links, and the issue-template contact links to the new slug; historical changelog entries are left as written. No behaviour, tool, schema, or version change (still 242 tools at 0.17.0); the npm package name stays `breakpoint-mcp`.
- **Renamed the `CLAUDE_*` environment variables to `BREAKPOINT_*`** and finished the client-agnostic addon rebrand. The six bridge/runtime overrides (`BREAKPOINT_BRIDGE_{HOST,PORT,TIMEOUT_MS}`, `BREAKPOINT_RUNTIME_{HOST,PORT,TIMEOUT_MS}`) and `BREAKPOINT_RESOURCE_COALESCE_MS` were previously `CLAUDE_*`; the Group J asset-gen vars were already `BREAKPOINT_*`, so this completes the migration. **Backward-compatible via a one-cycle deprecation shim:** both the host (`envCompat` in `config.ts`) and the addon (`_env_compat` in `bridge_server.gd` / `runtime_bridge.gd`) read the new name first and fall back to a set `CLAUDE_*` with a one-time deprecation warning (stderr / `push_warning`); `GODOT_*` variables are unchanged. Also neutralized the remaining "Claude"-as-actor references so the runtime artifacts are client-agnostic: the 68 `create_action("Claude: …")` editor-undo labels → `"Breakpoint: …"`, the `[claude_runtime]` runtime-log prefix → `[breakpoint_runtime]`, the runtime-bridge header, and the "so Claude can see …" screenshot tool descriptions → "so the assistant can see …". Legitimate client references (Claude Desktop / Claude Code setup instructions, "developed and tested with Claude") are kept as written. Updated the README and User Guide configuration tables with a migration note; historical changelog entries left as written. Added host compat + precedence unit tests (host tests 246 → **248**). Both `operations.gd` copies byte-identical. No tool, schema, or version change (still 242 tools at 0.17.0).
- Extended `scripts/contract_check.py` from name-parity to **param/return SHAPE parity** (no behaviour, tool, schema, or version change). Three new static checks run without Godot or Node: (6) every tool the catalog documents with an `**Input**` block has documented params matching its `inputSchema` param names — shared schemas (`inputSchema: posSchema`), `{ ...spread }` composition, and the universal `confirm` gate param are resolved/ignored so there are no false positives; (7) every field a tool pins in `host/src/schemas.ts` `outputSchemas` (inline **and** the shared IIFE-spread envelopes `assetGenResult` / `netcodeScaffold` / `backendScaffold`) appears in that tool's catalog `**Output**` block; (8) `outputSchemas` names no non-existent tool, and any registered tool missing an output schema is surfaced (only the two image tools, `screenshot_editor` / `runtime_screenshot`, are expected). Currently 54 input shapes and 41 output shapes are cross-checked against the catalog with zero drift; the checks were fault-injection-tested to confirm they fail on real drift. Still 242 tools at 0.17.0.
- Added a **GDScript unit-test suite for the addon's editor-free logic** plus a headless CI job to run it (no behaviour, tool, schema, or version change). `example/tests/ops_unit_test.gd` runs directly under `godot --headless --script` — no editor, bridge, or GUI — and covers the parts a live engine is not needed to exercise: the `variant_json` codec's Variant⇄JSON round-trips (Vector2/2i/3/3i/4, Color, Rect2, Quaternion, NodePath, nested containers) and the pure `operations.gd` helpers (the `{ok}`/`{err}` envelope, `_resolve`/`_path_of` node-path resolution, `_serialize_node`/`_descendants` SceneTree serialization incl. `max_depth` truncation, the doc-URL / type-name helpers, and `_ping`). The editor-**coupled** mutators stay covered end-to-end by the authoring-plane probe. 55 assertions; a new headless `gdscript-unit` job in `integration.yml` gates on the `OPS_UNIT_SUMMARY` / `OPS_UNIT_FAIL` markers (validated locally against Godot 4.7). Still 242 tools at 0.17.0.

## [0.17.0] — 2026-07-09

### Added — Group M (second half): backend-SDK integration scaffolding (5 tools, 237 → 242)
- Completes Group M with the plugin-detected backend-SDK family (new `host/src/tools/backend.ts`, `registerBackendTools`), carrying the count to **242**. Same "host nothing, scaffold everything" stance as the `mp_*` half: running a leaderboard DB, a save-store or an auth service is a SaaS, but generating the integration against the game's *installed* SDK — SilentWolf / Nakama / PlayFab / Photon — is in scope. **We host nothing.**
  - **One detection tool** (Plane A / Editor, read-only): **`backend_detect`** reports which of the four known SDKs are installed and how each was found — an enabled autoload, an addon directory under `res://addons`, or a global `class_name` (a new `backend.detect` bridge handler).
  - **Four codegen tools** (Plane A / Editor + host, each writing a `res://…gd`): **`backend_configure`** (an SDK config/bootstrap autoload), **`leaderboard_scaffold`** (submit/fetch), **`cloudsave_scaffold`** (save/load), and **`auth_scaffold`** (login/register/logout). The GDScript is built host-side (so the templates are unit-tested) and written by the editor's `FileAccess` through the existing `mp.write_script` bridge method.
- Every codegen tool is **feature-detected two ways, and never a dead call**: if the SDK provides no such API (Photon is realtime transport — no leaderboard/cloud-save/auth), it degrades to `status: "unsupported_feature"`; if the SDK is not installed in the project, it degrades to `status: "sdk_missing"` ("install <SDK> first"). Both degrades write nothing and are not errors. Only a capable + installed SDK reaches the (elicitation-**gated**) writer.
- Same quality bar: frozen `outputSchema` entries in `host/src/schemas.ts` (a `backend_detect` shape + one shared scaffold envelope validating the `written` / `sdk_missing` / `unsupported_feature` outcomes); contract-check parity (`EXPECTED_TOOL_COUNT` 237 → 242, `contract_check.py` now scans `backend.ts`, `docs/TOOL_CATALOG.md` gains the Group M backend detail blocks + 5 index rows). Both `operations.gd` copies byte-identical (new `backend.detect` handler).
- Unit-tested the host codegen + capability matrix + detect/degrade forwarding in `host/test/backend.test.ts` (per-SDK config/auth/leaderboard/cloud-save templates, the `unsupported_feature` and `sdk_missing` degrades with their exact bridge-call counts, and the installed-SDK write path). Added a live-engine `AUTH_BACKEND` probe family to the authoring-plane integration probe (detect over the clean example, then an in-memory autoload simulates an installed SDK so the real write path + both degrades are exercised against a real editor, with the autoload removed afterward).
- No version bump — feature PRs leave the version stamps equal (a later release cut re-stamps them together). A `0.17.0` cut can now roll both Group M halves (`mp_*` + backend) together.

### Added — Group M: native multiplayer scaffolding (7 tools, 230 → 237)
- Adds the first half of Group M — the "game backend" question resolved as **authoring, not hosting**. Godot 4's built-in high-level multiplayer is a first-class engine feature and a top game-dev request, but running a relay / leaderboard-DB / save-store is a SaaS, not editor control. So the `mp_*` family **hosts nothing and scaffolds everything**: it only adds nodes, scripts, and config, carrying the count to **237**. (The plugin-detected backend-SDK integration tools — `backend_configure` / `leaderboard_scaffold` / … — remain a separate follow-up PR.)
  - **Three node-authoring tools** (Plane A / Editor, undoable via `EditorUndoRedoManager` exactly like every `node_*`): **`mp_add_spawner`** (a `MultiplayerSpawner` with an optional `spawn_path` and registered `spawnable_scenes`), **`mp_add_synchronizer`** (a `MultiplayerSynchronizer`, building a `SceneReplicationConfig` from a property list + replication mode), and **`mp_set_authority`** (`set_multiplayer_authority(peer_id, recursive)`, capturing the prior authority for undo).
  - **Four codegen tools** (Plane A / Editor + host, each writing a `res://…gd`): **`mp_setup_enet_peer`** (an `ENetMultiplayerPeer` host/join helper), **`mp_setup_webrtc_peer`** (a `WebRTCMultiplayerPeer` mesh helper), **`mp_wire_rpc`** (insert/replace an `@rpc(...)` annotation on a function in an existing script, appending a stub when absent), and **`mp_scaffold_lobby`** (a lobby controller with host/join + `peer_connected`/`peer_disconnected` tracking and lobby signals). The GDScript is built host-side (so the templates are unit-tested) and written by the editor's `FileAccess` through a new `mp.write_script` bridge method that rescans the filesystem.
- Same quality bar: frozen `outputSchema` entries in `host/src/schemas.ts` (three node shapes + one shared codegen envelope validating the `written` / `unsupported` outcomes); the three node mutators are **undoable**; every code-writing tool is confirmation-**gated** (writing a `.gd` is destructive, the `resource_create` model); **feature-detection** is first-class — `mp_setup_webrtc_peer` degrades to a clear `unsupported` result (nothing written) when the WebRTC module is absent, never a dead call; contract-check parity (`EXPECTED_TOOL_COUNT` 230 → 237, `contract_check.py` now scans `netcode.ts`, `docs/TOOL_CATALOG.md` gains a Group M family section + 7 index rows). Both `operations.gd` copies byte-identical (new `mp.add_spawner` / `mp.add_synchronizer` / `mp.set_authority` / `mp.write_script` bridge handlers).
- Unit-tested the host codegen + `@rpc` transform + node/degrade forwarding in `host/test/netcode.test.ts` (script templates, annotation formatting, insert-above / replace-existing / append-stub, the WebRTC degrade path, and a real on-disk `mp_wire_rpc` round-trip). Added a live-engine `AUTH_MP` probe family to the authoring-plane integration probe (spawner/synchronizer/authority created + undone/redone against a real editor, ENet/lobby scripts written + loaded back, `@rpc` wired into a real script, and the WebRTC feature-detect).
- No version bump — feature PRs leave the version stamps equal (a later release cut re-stamps them together).

## [0.16.0] — 2026-07-09

### Added — Group J: AI asset generation (7 tools, 223 → 230)
- Adds the asset-generation family, carrying the count to **230**. **MCP-native framing: the server never bundles or calls a model.** Each generator writes an asset to a `res://` path, imports it through the editor bridge, and returns a schema'd result; where the bytes come from is delegated.
  - **`asset_gen_configure`** (Plane B / host) selects the session backend — the feature flag: **`none`** (default) makes the generators **degrade** to a clear "no generation backend configured" result carrying a `request` spec the connected multimodal client can fulfil (no file written, not an error); **`placeholder`** writes deterministic, in-engine procedural stand-ins; **`command`** delegates to a configured local command (argv template with `{kind} {prompt} {output} {width} {height} {format}` tokens substituted per-argument, no shell — the command writes the file, the host imports it). Env-seeded via `BREAKPOINT_ASSETGEN_BACKEND` / `_CMD` / `_PROVIDER` / `_TIMEOUT_MS`; off by default.
  - **`asset_gen_placeholder`** (Plane A / Editor) always mints a deterministic stand-in regardless of the backend, as a native Godot resource (`.tres`) that loads synchronously — a hashed-colour `ImageTexture` (`sprite` / `texture` / `icon`), an `AudioStreamWAV` decaying-sine blip (`audio_sfx`), or a `BoxMesh` / primitive (`model`) — colour / frequency / size derived from a hash of the prompt, so the same prompt always yields the same asset (CI-assertable).
  - **`asset_gen_sprite`** / **`asset_gen_texture`** / **`asset_gen_icon`** / **`asset_gen_audio_sfx`** / **`asset_gen_model`** (Plane A / Editor) are the five typed generators. They branch on the backend (degrade / placeholder / command) and accept `placeholder: true` to force an in-engine stand-in even when a real backend is configured. They share one result envelope validating all three outcomes (`placeholder` / `generated` / `no_backend`).
- Same quality bar: frozen `outputSchema` entries in `host/src/schemas.ts` (a config shape + one shared generator envelope); every file-writing path is confirmation-**gated** (writing a new asset is destructive/irreversible — the `resource_create` model, not scene-undoable); the degrade path writes nothing and is not an error; feature-detection is the default state (no backend → a clear request spec, never a hang); contract-check parity (`EXPECTED_TOOL_COUNT` 223 → 230, `contract_check.py` now scans `assetgen.ts`, `docs/TOOL_CATALOG.md` gains a Group J family section + 7 index rows). Both `operations.gd` copies byte-identical (new `asset.gen_placeholder` / `asset.import` bridge handlers).
- Unit-tested the host branching in `host/test/assetgen.test.ts` (configure get/set/validation, the no-backend degrade, the placeholder bridge call + extension handling, and the command backend running a real fixture generator + importing its output). Added a live-engine `AUTH_ASSETGEN` probe family to the authoring-plane integration probe (placeholder sprite/texture/icon/audio/model minted + imported/loaded against a real editor, the degrade path, and a command-backend round-trip through a fixture generator).
- No version bump — feature PRs leave the version stamps equal (a later release cut re-stamps them together).

## [0.15.0] — 2026-07-09

### Changed — Renamed to Breakpoint MCP
- Rebrands the project from "godot-claude-bridge" / "Claude Bridge" to **Breakpoint MCP** (tagline: *Now Godot waits for you.*) across the host, the addon, and the docs. **No behaviour change** — every tool, schema, bridge method and CI probe is byte-for-byte the same; the surface stays at **223** tools and the version stamps stay `0.14.0` (rename PR, not a release).
  - **Host / npm:** package name `godot-claude-bridge` → `breakpoint-mcp` (+ the `bin` name), MCP `serverInfo.name` → `breakpoint-mcp`, the LSP/DAP `clientInfo`/`clientID` and the stderr log tag `[godot-claude-bridge]` → `[breakpoint-mcp]`.
  - **Addon:** directory `addons/claude_bridge/` → `addons/breakpoint_mcp/` (both the root and the bundled `example/` copy), plugin display name `Claude Bridge` → **Breakpoint MCP**, editor log prefix `[claude_bridge]` → `[breakpoint_mcp]`, internal server node `ClaudeBridgeServer` → `BreakpointBridgeServer`, and the new mark applied to `icon.png`.
  - **Runtime autoload:** `ClaudeRuntimeBridge` → `BreakpointRuntimeBridge` (the `/root/…` singleton the `runtime_*` tools and game code reach); the example `project.godot` autoload + enabled-plugin path and `player.gd`'s lookup were updated to match, so the runtime plane stays wired end-to-end.
  - **Docs:** README (root + host), `TOOL_CATALOG`, `DISTRIBUTION`, `RUNBOOK`, `contract_check.py` and `validate.sh` rebranded; `contract_check`'s addon path follows the move.
- The GitHub repository slug (`jlivingston-Cipher/godot-claude-bridge`) is intentionally **kept** this pass, so every `repository` / `homepage` / `bugs` URL is unchanged; a repo rename can follow as a separate deliberate step. Historical changelog entries below are left as written (they name the paths/identifiers accurate at the time).

### Added — Group K: knowledge & search (6 tools, 217 → 223)
- Adds the read-only "where / what / how" docs-lookup + code-index family, carrying the count to **223**.
  - **Four host-side tools** (Plane B, new `host/src/tools/knowledge.ts` — they read the project files directly, so they answer with nothing running): **`project_search`** (ripgrep-style literal/regex full-text search across the project, res:// paths + 1-based line/column, binary + cache dirs skipped), **`find_symbol`** (project-wide GDScript declaration index — `class_name` / `class` / `func` / `signal` / `enum` / `const` / `var` — the workspace-symbol answer Godot's LSP does not implement, cf. `gd_workspace_symbols` returning *unsupported*), **`find_usages`** (word-boundary identifier occurrences project-wide, the build-independent complement to the position-based `gd_references`), and **`example_snippet`** (curated GDScript idiom lookup — signals, autoload singletons, input, tweens, timers, scene changes, save/load, RNG, groups, state machines, HTTP, `@onready`).
  - **Two ClassDB-backed tools** (Plane A, over the editor bridge): **`class_reference`** (full class reference — method signatures with typed args + return, signal signatures, typed properties — the detailed view `classdb_get_class` summarises as bare names, plus the canonical docs URL; optional `member` filter), and **`docs_search`** (keyword search over the class reference — class names and, unless a `class_name`/`kind` scope narrows it, their members — each hit carrying its canonical online-docs URL; member scan bounded by `limit`).
- Same quality bar: frozen `outputSchema` entries in `host/src/schemas.ts` for all six; read-only, so none are undoable or gated; invalid-regex / not-found / empty-query surface as clear errors; contract-check parity; `EXPECTED_TOOL_COUNT` 217 → 223; `docs/TOOL_CATALOG.md` gains a Group K family section (prose + 6 detail blocks) + 6 index rows. Both `operations.gd` copies byte-identical (new `classdb.reference` / `docs.search` bridge handlers).
- Unit-tested the four host-side tools against a throwaway project fixture in `host/test/knowledge.test.ts` (res:// paths, cache-dir skipping, regex + word-boundary semantics, exact vs substring). Added a live-engine `AUTH_K` probe family to the authoring-plane integration probe (host-side search over the example project + ClassDB `class_reference` / `docs_search` against a real editor).
- No version bump — feature PRs leave the version stamps equal (a later release cut re-stamps them together).

## [0.14.0] — 2026-07-09

### Added — Group I: input, project config & testing (12 tools, 205 → 217)
- Adds input-map, project-configuration, and test-discovery editor tools (bridge namespaces `inputmap.*` / `project.*` / `editorsettings.*` / `test.*`), carrying the count to **217**.
  - **Input (4):** **`inputmap_add_action`** / **`inputmap_add_event`** / **`inputmap_erase_action`** — gated `ProjectSettings` `input/<name>` writers (optional `save`) — plus read-only **`inputmap_list`**. Events are built from a `{ type: key | mouse_button | joy_button | joy_motion, … }` descriptor (`keycode` / `physical_keycode` accept a key name via `OS.find_keycode_from_string` or an int).
  - **Project / config (6):** **`project_add_autoload`** / **`project_remove_autoload`** (`autoload/<name>`; a `*` prefix marks an enabled singleton), **`project_set_main_scene`** (validated `.tscn`/`.scn`), **`project_add_export_preset`** (appends to `export_presets.cfg` via `ConfigFile`), read-only **`project_list_settings`** (keys+values by dotted prefix), and **`editorsettings_get_set`** (read; gated write when `value` is given).
  - **Testing (2):** read-only **`test_detect`** (GUT / GdUnit4 / none) and **`test_list`** (`test_*.gd` / `*_test.gd`).
- Same quality bar: frozen `outputSchema` entries in `host/src/schemas.ts`; a confirm-gate on every writer (the `project_set_setting` model — `ProjectSettings` / editor-config mutations are **not** on the scene `EditorUndoRedoManager` history, so they are gated, not undoable); clear `bad_params`/`not_found` errors; contract-check parity; `EXPECTED_TOOL_COUNT` 205 → 217; `docs/TOOL_CATALOG.md` gains a Group I family section (prose + 12 detail blocks) + 12 index rows. Both `operations.gd` copies byte-identical.
- Added a live-engine `AUTH_GROUPI` probe family (13 assertions) to the authoring-plane integration probe; the 8 gated writers added to its `GATED` set. Authoring probe 125 → 138, live-validated against a real Godot 4.7-stable editor.
- `test_run` / `test_result` deferred on purpose (async / non-deterministic under a headless CI editor; needs a framework-bearing fixture + a maintainer semantics decision), so Group I ships 12 of the plan's ~14 tools. (#54)

### Added — Group H: 3D & navigation (10 tools, 195 → 205)
- Adds 3D and navigation editor tools (bridge namespaces `meshinstance.*` / `mesh.*` / `primitive_mesh.*` / `light.*` / `camera.*` / `csg.*` / `navregion.*` / `navagent.*` / `environment.*`), carrying the count to **205**.
  - **Seven edited-scene 3D mutators** (undoable via `EditorUndoRedoManager`, ungated — the `node_*` model): **`meshinstance_create`** (`MeshInstance3D`; optional `mesh_path` loads + assigns a `Mesh`), **`mesh_set_surface_material`** (`material_override` at surface -1, or a per-surface override slot), **`light_create`** (Directional / Omni / Spot), **`camera_create`** (`Camera3D`, optional current), **`csg_create`** (Box / Sphere / Cylinder / Torus / Polygon / Mesh / Combiner), **`navregion_create`** (`NavigationRegion3D`, seeding a fresh `NavigationMesh`), **`navagent_configure`** (`NavigationAgent3D` + radius / height / max_speed / path + target-distance / avoidance).
  - **Three confirm-gated resource file-writers** (the `resource_*` / `theme_create` model): **`primitive_mesh_create`** (Box/Sphere/Cylinder/Plane/Capsule/Prism/Torus/Quad mesh `.tres`), **`environment_create`** (`Environment` + background mode + optional ambient), **`environment_set_sky`** (attach a Procedural / Physical / Panorama `Sky`, switch background to SKY).
- Same quality bar: frozen `outputSchema` entries; undo for every scene mutator / confirm-gate for every file-writer; `MeshInstance3D` / `Material` / light-kind / CSG-shape / `Environment` type-guards with clear `bad_type`/`bad_params` errors; contract-check parity; `EXPECTED_TOOL_COUNT` 195 → 205; `docs/TOOL_CATALOG.md` gains a Group H family section (prose + 10 detail blocks) + 10 index rows. Both `operations.gd` copies byte-identical.
- Added a live-engine `AUTH_3D` probe family (13 assertions incl. a `meshinstance` undo/redo round-trip); the 3 writers added to its `GATED` set. Authoring probe 112 → 125, live-validated against a real Godot 4.7-stable editor.
- `navmesh_bake` deferred on purpose (async / non-deterministic headless bake; needs a maintainer semantics decision), so Group H ships 10 of the plan's ~11 tools. (#53)

### Added — Group G: UI / Control / theming (11 tools, 184 → 195)
- Adds UI/Control and theming editor tools (bridge namespaces `control.*` / `container.*` / `theme.*`) — the editor-authoring milestone — carrying the count to **195**.
  - **Six edited-scene Control mutators** (undoable via `EditorUndoRedoManager`, ungated — the `node_*` model): **`control_create`** (instance a `Control` subclass; refuses non-`Control`; seeds `text` when present), **`container_add_child`** (add a `Control` child under a `Container`; refuses a non-`Container` parent), **`control_set_anchors`**, **`control_set_layout_preset`** (name or 0..15 int via `set_anchors_and_offsets_preset`, capturing all 8 anchor/offset props for undo), **`control_set_size_flags`**, **`control_set_theme`**.
  - **Five `Theme` `.tres` file-writers** (confirm-gated like `resource_*` / `shader_create`): **`theme_create`**, **`theme_set_color`**, **`theme_set_font`**, **`theme_set_stylebox`**, **`theme_set_constant`**.
- Same quality bar: frozen `outputSchema` entries; undo for every scene mutator / confirm-gate for every file-writer; Control-subclass / `Container` / `Theme` / `Font` / `StyleBox` type-guards with clear `bad_type` errors; contract-check parity; `EXPECTED_TOOL_COUNT` 184 → 195; `docs/TOOL_CATALOG.md` gains a Group G family section (prose + 11 detail blocks) + 11 index rows. Both `operations.gd` copies byte-identical.
- Added a live-engine `AUTH_UI` probe family (13 assertions incl. a control undo/redo round-trip); the 5 theme writers added to its `GATED` set. Authoring probe 99 → 112, live-validated against a real Godot 4.7-stable editor. (#51)

### Added — `editor_undo` / `editor_redo` (2 tools, 182 → 184)
- Adds a programmatic Ctrl-Z / Ctrl-Shift-Z to the editor plane — the capability the `authoring-plane` probe's undo-stack assertion was deferred on (see the entry below). Two A/Editor tools, ungated (the `node_*` model):
  - **`editor_undo`** — step the editor's undo history one action back; **`editor_redo`** — re-apply the most recently undone action. Both default to the **edited scene's** history and take `scope: "scene" | "global"` to target the editor-wide `GLOBAL_HISTORY` instead. Each reports `{ performed, direction, action, has_undo, has_redo, history_id, scope }`; `performed` is `false` (not an error) when the end of the history is reached.
- Mechanism: the `node_*` mutators already commit through `EditorPlugin.get_undo_redo()` (an `EditorUndoRedoManager`); the new `edit.undo` / `edit.redo` bridge actions resolve the edited scene's history with `get_object_history_id(edited_root)` — the same routing those commits use — fetch the concrete `UndoRedo` with `get_history_undo_redo(id)`, and step it (`undo()` / `redo()`). That history-id choice is version-sensitive and was **validated live on Godot 4.7**: `history_id` comes back `1` (the scene history, not `GLOBAL_HISTORY`) and mutate → undo → revert → redo round-trips a real scene mutation.
- Extends **`host/test-integration/authoring-plane.integration.mjs`** with an `AUTH_UNDO` family that rounds-trips each undo archetype on a throwaway node — node creators (`add_do_reference`), scalar property setters (`add_do_property`), and resource assignments — mutate → undo → **revert** → redo → **restore**, plus a 3-deep LIFO stack test and a redo no-op guard. Each cycle touches only the action(s) it just pushed (the top of the scene history), so the forward families are undisturbed. Live-validated **41/41** on a real Godot 4.7 editor (was 32/32); the probe's `AUTH_UNDO_DEFERRED` marker is retired for `AUTH_UNDO_ASSERTED`.
- Handlers in both `addons/claude_bridge/operations.gd` copies (dispatch + `_edit_undo` / `_edit_redo` / `_edit_history_step` / `_history_id_for_scope`), parse-checked against local Godot 4.7; host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`; `registration.test.ts` `EXPECTED_TOOL_COUNT` 182 → 184; `docs/TOOL_CATALOG.md` (detail + index). No version bump — feature PRs leave the version stamps equal (a later release cut re-stamps them together).

### Changed — `authoring-plane` live probe expanded and promoted to a required gate (no tool change)
- The `authoring-plane` live probe was extended to cover the Groups A–D mutators (41 → 99 assertions) (#49), then promoted from experimental to a **required** CI gate — dropping `continue-on-error` (#50). The job was renamed `A-F` → `A-G` to track the live 112/112 probe as Group G landed (#52).

### Added — `authoring-plane` live CI probe for Groups E+F (no tool change)
- Delivers the first installment of the long-tracked **`authoring-plane`** live-verification job (referenced as a follow-up since the Group A batches). Two files, no tool/schema/addon change — the surface stays **182/173**:
  - **`host/test-integration/authoring-plane.integration.mjs`** — spawns the MCP host over stdio, connects to a live editor's addon bridge (`:9080`), opens `res://main.tscn`, and drives all **29 Group E+F mutators** (physics/collision + VFX/audio). Each mutation is asserted **independently** by reading the edited scene back through *separate* read tools — `node_get_children` (creators), `node_get_property` (scalar props, and resource props via `Codec.encode`'s `{__type__:"Resource",class}` tag), `project_get_setting` (`physics_set_gravity`), `resource_load` (the `.gdshader` / `.tres` file writers) — rather than trusting the mutator's own post-commit echo. Grep markers `AUTH_PHYS_*` / `AUTH_VFX_PARTICLES_*` / `AUTH_VFX_SHADER_*` / `AUTH_AUDIO_*`; a trailing `AUTH_SUMMARY pass=N/N` line and non-zero exit on any failure. The probe **mints its own fixtures** — `PlaceholderTexture2D` + `AudioStreamWAV` via `resource_create`, two `.gdshader` via `shader_create` — so no binary fixtures are committed (`.tres` native resources sidestep the import pipeline).
  - **`authoring-plane` job in `.github/workflows/integration.yml`** — mirrors `editor-plane` (Ubuntu + Xvfb + software OpenGL, Godot 4.7-stable): boots the editor, waits for `:9080`, runs the probe. Single newest-stable arm (E+F are version-stable engine features, unlike the LSP/DAP planes that matrix 4.3/4.7 for capability divergence). `continue-on-error: true` while GUI-boot timing is proven on real runners; promote to a required gate once green across a few runs (the `runtime-plane` / `csharp-plane` pattern).
- Live-validated **32/32** against a real Godot 4.7 editor and **green on the CI runner** on merge. **Undo-stack assertion is deferred**: no bridge action triggers an editor undo over `:9080` (and `contract_check`'s orphan scan forbids a caller-less bridge method), so the probe asserts **forward mutation only** (`AUTH_UNDO_DEFERRED` marker). An `editor_undo` capability that would let the probe assert mutate → undo → revert is the tracked follow-up. (#47)

## [0.13.0] — 2026-07-09

### Added — Group F (batch 3): Audio (6 tools, 176 → 182)
- Completes **Group F (VFX & audio)** with the **audio** subgroup, carrying the tool count to **182**. Six tools split across the two established models:
  - **`audio_player_create`** — add an `AudioStreamPlayer` / `AudioStreamPlayer2D` / `AudioStreamPlayer3D` node under a parent in the edited scene (`dim` selects `none` default / `2d` / `3d`), optionally seeding `stream_path` (a `res://` `AudioStream`), `autoplay`, `volume_db`, `bus`. Undoable via `EditorUndoRedoManager` and **ungated** (the `node_*` model); the node rides `add_do_reference`, the stream is a persisted disk resource (no inline reference).
  - **`audio_set_stream`** — load an `AudioStream` from a `res://` path and assign it as `stream` on an `AudioStreamPlayer/2D/3D` (undoable, ungated; feature-detects the player type, degrading to a clear `bad_type` otherwise — the `particles_set_texture` pattern).
  - **`audio_bus_add`** — add a bus to the global `AudioServer` layout (optional `name`, `at_position`, `send`). Project-wide (not scene-undoable), so **gated** by confirmation like `physics_set_gravity`.
  - **`audio_bus_add_effect`** — instantiate an `AudioEffect` subclass by class name (validated via `ClassDB.can_instantiate` + `is_parent_class("AudioEffect")`) and add it to a named bus. **Gated** (project-wide).
  - **`audio_bus_set_volume`** — set a named bus's `volume_db` on the `AudioServer`. **Gated** (project-wide).
  - **`audio_set_bus_layout`** — persist the current `AudioServer` bus layout (buses, effects, volumes) to a `.tres` on disk (default `res://default_bus_layout.tres`) via `generate_bus_layout` + `ResourceSaver.save`. **Gated** (writes a file).
- Same quality bar: the `AudioServer` bus API (`add_bus` / `set_bus_name` / `get_bus_index` / `set_bus_send` / `set_bus_volume_db` / `add_bus_effect` / `get_bus_effect_count` / `generate_bus_layout` / `set_bus_layout`), the `AudioEffect` `ClassDB` instantiation, and the player `stream` / `autoplay` / `volume_db` / `bus` props were probed live on Godot 4.7 (set + read-back on typed locals — no `get_property_list` / RefCounted `.free()`), and an `AudioStreamPlayer` carrying an external `AudioStream` (`autoplay` / `volume_db` / `bus` set) survives a `.tscn` save + fresh reload. Handlers in both `addons/claude_bridge/operations.gd` copies (dispatch + `_audio_player_create` / `_audio_set_stream` / `_audio_bus_add` / `_audio_bus_add_effect` / `_audio_bus_set_volume` / `_audio_set_bus_layout`, plus the `_is_audio_player` helper), statically parse-checked against local Godot 4.7; host registrations in `host/src/tools/editor.ts` (the four `AudioServer` tools reuse the `gate` confirm pattern); output schemas in `host/src/schemas.ts`; `registration.test.ts` `EXPECTED_TOOL_COUNT` 176 → 182; `docs/TOOL_CATALOG.md` (Group F header + detail + index). No version bump — the E+F release cut re-stamps all five version stamps together.

### Added — Group F (batch 2): Shaders (5 tools, 171 → 176)
- Continues **Group F (VFX & audio)** with the **shaders** subgroup. Five tools split across the two established models:
  - **`shader_create`** — create a `Shader` with optional initial GDShader `code` and save it as a `.gdshader` resource at a `res://` path. Writes a file, so **gated** by confirmation (the `resource_*` / `tileset_*` model), not the in-scene model.
  - **`shader_set_code`** — replace the source of an existing `.gdshader` and re-save. **Gated** (writes a file); feature-checks that the target loads as a `Shader`.
  - **`shadermaterial_create`** — create a `ShaderMaterial` and assign it to a node's material slot in the edited scene, undoable via `EditorUndoRedoManager` and **ungated**. Feature-detects the slot: `CanvasItem.material` (2D / Control) vs `GeometryInstance3D.material_override` (3D); a node with neither degrades to a clear `unsupported`. Optionally binds a `Shader` loaded from a `res://` path (rides `add_do_property` + `add_do_reference`).
  - **`shadermaterial_set_shader`** — load a `Shader` from a `res://` path and assign it to an existing `ShaderMaterial` on the node's slot (undoable). No `add_do_reference` — the shader is a persisted disk resource (the `particles_set_texture` pattern).
  - **`shadermaterial_set_param`** — set a shader uniform through the `shader_parameter/<name>` property path (undoable via `add_do_property` / `add_undo_property`); the value uses the tagged-Variant convention (`Codec.decode` in, `Codec.encode` out).
- Quality bar held: `Shader` / `ShaderMaterial` / `set_shader_parameter` and the `shader_parameter/<name>` property-path form were probed live on Godot 4.7 (set + read-back on typed locals — no `get_property_list` / RefCounted `.free()`), and a `Sprite2D` carrying a `ShaderMaterial` (external `.gdshader` + a `shader_parameter` override) survives a `.tscn` save + fresh reload. Handlers in both `addons/claude_bridge/operations.gd` copies (dispatch + `_shader_create` / `_shader_set_code` / `_shadermaterial_create` / `_shadermaterial_set_shader` / `_shadermaterial_set_param`, plus the `_material_prop` helper), statically parse-checked against local Godot 4.7; host registrations in `host/src/tools/editor.ts` (the two `shader_*` writers reuse the `gate` confirm pattern); output schemas in `host/src/schemas.ts`; `registration.test.ts` `EXPECTED_TOOL_COUNT` 171 → 176; `docs/TOOL_CATALOG.md` (Group F header + detail + index). No version bump — the E+F release cut re-stamps all five version stamps together.

### Added — Group F (batch 1): GPU particles (6 tools, 165 → 171)
- Starts **Group F (VFX & audio)** from the editor-authoring roadmap with the **GPU particles** subgroup. Six A/Editor
  tools, all mutating the edited scene, undoable via `EditorUndoRedoManager`, and **ungated** (the `node_*` model):
  - **`particles_create`** — add a `GPUParticles2D`/`GPUParticles3D` node (`dim` 2d default / 3d), optionally seeding `amount` (> 0), `lifetime` (> 0), `emitting`.
  - **`particles_set_process_material`** — create a `ParticleProcessMaterial` and assign it as `process_material` (GPU particles need one to emit): `gravity`/`direction` (Vector3), `spread`, `initial_velocity_min`/`_max`, `scale_min`/`_max`, `color`.
  - **`particles_set_amount`** — set `amount` (> 0).
  - **`particles_set_lifetime`** — set `lifetime` in seconds (> 0).
  - **`particles_set_emitting`** — toggle `emitting`.
  - **`particles_set_texture`** — load a `Texture2D` from a `res://` path onto a `GPUParticles2D`'s `texture`. Feature-detects: `GPUParticles3D` has no `texture` (it draws meshes) and degrades to a clear `unsupported`.
- Same quality bar as the earlier groups: node authoring uses the `node_add` do/undo-reference pattern; the new
  `ParticleProcessMaterial` rides along via `add_do_reference`; property mutators use `add_do_property` /
  `add_undo_property`. The `GPUParticles2D/3D` property surface (`amount`/`lifetime`/`emitting`/`process_material`, and
  the **2D-only** `texture`) and the `ParticleProcessMaterial` knobs were probed live on Godot 4.7 before design.
  Handlers in both `addons/claude_bridge/operations.gd` copies (dispatch + `_particles_create` /
  `_particles_set_process_material` / `_particles_set_amount` / `_particles_set_lifetime` / `_particles_set_emitting` /
  `_particles_set_texture`, plus `_is_particles` / `_to_color` helpers), statically parse-checked against local Godot
  4.7; host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`;
  `registration.test.ts` `EXPECTED_TOOL_COUNT` 165 → 171; `docs/TOOL_CATALOG.md` (new Group F section + index). No
  version bump — the E+F release cut re-stamps all five version stamps together.

### Added — Group E (batch 2): Areas, joints, collision polygons, rigidbody & material tuning (8 tools, 157 → 165)
- Completes **Group E (Physics & collision)** from the editor-authoring roadmap — batch 2 carries the tool count past
  godot-mcp-pro's 162-tool ceiling to **165**. Eight A/Editor tools: seven mutate the edited scene, are undoable via
  `EditorUndoRedoManager`, and **ungated** (the `node_*` model); one writes ProjectSettings and is **gated** like
  `project_set_setting`:
  - **`area_set_monitoring`** — set `monitoring` / `monitorable` on an `Area2D/3D`.
  - **`area_set_gravity`** — set an `Area2D/3D`'s local gravity override: `space_override`, magnitude, direction, point.
  - **`joint_create`** — add a joint node via `type` × `dim` (2D: `PinJoint2D`/`GrooveJoint2D`/`DampedSpringJoint2D`; 3D: `PinJoint3D`/`HingeJoint3D`/`SliderJoint3D`/`ConeTwistJoint3D`/`Generic6DOFJoint3D`), optionally wiring `node_a`/`node_b`.
  - **`joint_set_bodies`** — set `node_a` / `node_b` on an existing `Joint2D/3D`.
  - **`collisionpolygon_add`** — add a `CollisionPolygon2D/3D` from a 2D outline (3D extruded by `depth`; 2D `build_mode`).
  - **`rigidbody_set_properties`** — tune a `RigidBody2D/3D`: `mass` (> 0), `gravity_scale`, `linear_damp`, `angular_damp`.
  - **`body_set_physics_material`** — create a `PhysicsMaterial` and assign it as `physics_material_override` on a StaticBody/RigidBody (2D/3D): `friction`, `bounce`, `rough`, `absorbent`.
  - **`physics_set_gravity`** — write project `physics/{2d,3d}/default_gravity` (+ `default_gravity_vector`); `save` persists to `project.godot`. Gated.
- Same quality bar as the earlier groups: in-scene node authoring uses the `node_add` do/undo-reference pattern; property
  mutators use `add_do_property` / `add_undo_property`; the new `PhysicsMaterial` rides along via `add_do_reference`.
  The eight joint classes (2D+3D), Area `monitoring`/`monitorable` + gravity props, RigidBody props, `CollisionPolygon2D/3D`
  (`polygon` is a `PackedVector2Array` for both dims), `PhysicsMaterial` + `physics_material_override`, and the four
  `physics/{2d,3d}/default_gravity(_vector)` ProjectSettings keys were probed live on Godot 4.7 before design; the real
  `operations.gd` helpers were unit-exercised, and a `Root → StaticBody2D(PhysicsMaterial) + PinJoint2D(node_a/node_b) +
  CollisionPolygon2D` scene was packed to a `.tscn`, saved, and reloaded — the joint NodePaths, the inline material
  (friction/bounce), and the polygon all survive the round-trip. Handlers in both `addons/claude_bridge/operations.gd`
  copies (dispatch + `_area_set_monitoring` / `_area_set_gravity` / `_joint_create` / `_joint_set_bodies` /
  `_collisionpolygon_add` / `_rigidbody_set_properties` / `_body_set_physics_material` / `_physics_set_gravity`),
  statically parse-checked against local Godot 4.7; host registrations in `host/src/tools/editor.ts`
  (`physics_set_gravity` gated); output schemas in `host/src/schemas.ts`; `registration.test.ts` `EXPECTED_TOOL_COUNT`
  157 → 165; `docs/TOOL_CATALOG.md` (Group E section + index). `contract_check` 165; host tests 173. No version bump —
  the E+F release cut re-stamps all five version stamps together.

### Added — Group E (batch 1): Physics bodies & collision shapes (4 tools, 153 → 157)
- Starts **Group E (Physics & collision)** from the editor-authoring roadmap — the group that crosses
  godot-mcp-pro's 162-tool ceiling (at ~166 once the group lands). Four A/Editor tools that author physics
  nodes in the edited scene, all in-scene, undoable via `EditorUndoRedoManager`, and **ungated** (the
  `node_*` / `tilemap_*` model, not the disk-writing gated `tileset_*` model):
  - **`body_create`** — add a `StaticBody` / `RigidBody` / `CharacterBody` / `Area` node (2D or 3D via `dim`) under a parent.
  - **`collisionshape_add`** — add a `CollisionShape2D` / `CollisionShape3D` carrying a shape resource: `rect` (Rectangle/Box), `circle` (Circle/Sphere), `capsule` (Capsule 2D/3D), or `polygon` (ConvexPolygon 2D/3D).
  - **`body_set_collision_layer`** / **`body_set_collision_mask`** — set the `collision_layer` / `collision_mask` bitmask on any body or area (`CollisionObject2D/3D`).
- Same quality bar as Groups A–D: bodies/shapes go through the `node_add` do/undo reference pattern, layer/mask
  through `add_do_property` / `add_undo_property`. The `StaticBody/RigidBody/CharacterBody/Area` (2D+3D),
  `CollisionShape2D/3D`, and `RectangleShape2D / CircleShape2D / CapsuleShape2D / ConvexPolygonShape2D` +
  `BoxShape3D / SphereShape3D / CapsuleShape3D / ConvexPolygonShape3D` APIs were probed live on Godot 4.7
  before design, and a `Node2D → StaticBody2D → CollisionShape2D(RectangleShape2D)` scene was packed to a
  `.tscn`, saved, and reloaded — the body's `collision_layer` and the shape (type + `size`) survive the
  round-trip; the shape-building helpers were unit-exercised against a live `operations.gd` instance. Handlers
  in both `addons/claude_bridge/operations.gd` copies (dispatch + `_body_create` / `_collisionshape_add` /
  `_body_set_collision_layer` / `_body_set_collision_mask`), statically parse-checked against local Godot 4.7;
  host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`;
  `registration.test.ts` `EXPECTED_TOOL_COUNT` 153 → 157; `docs/TOOL_CATALOG.md` (Group E section + index).
  `contract_check` 157; host tests 173. No version bump — Group E completes across batches, then the E+F release cut.

## [0.12.0] — 2026-07-08

### Added — Group D (batch 2): TileMapLayer + cell painting (5 tools, 148 → 153)
- Completes **Group D (TileMap/TileSet)** from the editor-authoring roadmap. Five D/Editor tools that author a
  `TileMapLayer` node in the edited scene and paint its cells — the in-scene counterpart to batch 1's disk-backed
  `tileset_*` writers:
  - **`tilemaplayer_create`** — add a `TileMapLayer` node under a parent, optionally binding a TileSet `.tres` (e.g. from `tileset_create`) as its `tile_set`.
  - **`tilemap_set_cell`** — paint (or erase, with `source_id` -1) a single cell by `coords`, `source_id`, `atlas_coords`, `alternative`.
  - **`tilemap_set_cells_rect`** — fill a rectangular region `[x, y, w, h]` with one tile in a single undoable action (capped at 65536 cells).
  - **`tilemap_get_cell`** — read a cell; an empty cell reports `source_id` -1 / `atlas_coords` [-1, -1] / `alternative` 0 (`empty: true`).
  - **`tilemap_clear`** — remove every painted cell; undo restores the prior cells.
- Same quality bar as the rest of Groups A–C: every mutator goes through `EditorUndoRedoManager` (undoable) and is
  **ungated** — an in-scene mutation like `node_*` / `anim_*`, not the disk-writing gated model of `tileset_*`.
  `set_cell`/`set_cells_rect`/`clear` capture the prior per-cell state (source/atlas/alternative) for exact undo.
  The `TileMapLayer` API (`set_cell` / `get_cell_source_id` / `get_cell_atlas_coords` / `get_cell_alternative_tile`
  / `clear` / `get_used_cells`) was probed live on Godot 4.7 before design, and the create → set_cell → get_cell →
  clear chain (plus a `.tscn` save/reload round-trip of the painted cells) was verified end-to-end. Handlers in both
  `addons/claude_bridge/operations.gd` copies (dispatch + `_tilemaplayer_create` / `_tilemap_*`), statically
  parse-checked against local Godot 4.7; host registrations in `host/src/tools/editor.ts`; output schemas in
  `host/src/schemas.ts`; `registration.test.ts` `EXPECTED_TOOL_COUNT` 148 → 153; `docs/TOOL_CATALOG.md`
  (detail + index). `contract_check` 153; host tests 173. `TileMapLayer` supersedes the deprecated `TileMap` node in
  Godot 4.x. Group D is now complete; the Group C+D release cut follows.

### Added — Group D (batch 1): TileSet authoring — TileSet / atlas source / tile / collision (4 tools, 144 → 148)
- First family of **Group D (TileMap/TileSet)** from the editor-authoring roadmap (unblocked by Group B —
  `TileSet` is a Resource). Four D/Editor `tileset_*` tools over the editor bridge, schema-enforced, that author
  a disk-backed `.tres` `TileSet` (load → mutate → re-save; no scene needs to be open):
  - **`tileset_create`** — instantiate a `TileSet` and save it as a new `.tres`; optional base `tile_size` (default 16×16 px).
  - **`tileset_add_source`** — add a `TileSetAtlasSource` backed by a `Texture2D`; `texture_region_size` defaults to the tile size, `source_id` -1 auto-assigns; optional atlas `margins` / `separation`.
  - **`tileset_add_tile`** — create a tile at `atlas_coords` (in cells) in an atlas source; optional multi-cell `size` (default 1×1).
  - **`tileset_set_tile_collision`** — add a collision polygon (≥3 tile-local points) to a tile on a numbered physics layer (created on demand); optional `one_way`.
- All four are **file-writing → elicitation-gated** (the disk-writing `resource_*` / `filesystem_*` precedent,
  not the in-scene undoable `node_*` / `anim_*` model). The `TileSet` / `TileSetAtlasSource` / `TileData` API
  surface was probed live on Godot 4.7 before design, and the create → add_source → add_tile → set_collision
  chain was verified end-to-end through a `.tres` save/reload round-trip. Handlers in both
  `addons/claude_bridge/operations.gd` copies (dispatch + `_tileset_*`), statically parse-checked against local
  Godot 4.7; host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`;
  `registration.test.ts` `EXPECTED_TOOL_COUNT` 144 → 148; `docs/TOOL_CATALOG.md` (detail + index).
  `contract_check` 148; host tests 173. Group D batch 2 (`tilemaplayer_create` + `tilemap_*`) is next, then the
  Group C+D release cut.

### Added — Group C (batch 2): animation state machines — AnimationTree + StateMachine (4 tools, 140 → 144)
- Completes **Group C (Animation)** from the editor-authoring roadmap. Four C/Editor `anim_*` tools that author an
  `AnimationTree` node and its `tree_root` graph, schema-enforced and undoable:
  - **`anim_tree_create`** — add an `AnimationTree` node with a fresh `tree_root` (`AnimationNodeBlendTree` or `AnimationNodeStateMachine`); created inactive, optionally wired to an `AnimationPlayer` via `anim_player`.
  - **`anim_tree_add_node`** — add any `AnimationNode` subclass to the tree_root graph (blend tree or state machine); binds a clip for `AnimationNodeAnimation`.
  - **`anim_statemachine_add_state`** — add a state (default `AnimationNodeAnimation`) to a state machine — the `tree_root`, or a nested state-machine node.
  - **`anim_statemachine_add_transition`** — connect two states with an `AnimationNodeStateMachineTransition` (xfade time, switch mode, advance mode/condition, priority).
- Same quality bar as batch 1: every mutation goes through `EditorUndoRedoManager` (undoable; nothing written to
  disk), ungated (in-scene mutation, like `node_*`). The `AnimationTree` / `AnimationNode*` API surface was probed
  live on Godot 4.7 before design. Handlers in both `addons/claude_bridge/operations.gd` copies (dispatch +
  `_anim_tree_*` / `_anim_statemachine_*`), statically parse-checked against local Godot 4.7; host registrations in
  `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`; `registration.test.ts`
  `EXPECTED_TOOL_COUNT` 140 → 144; `docs/TOOL_CATALOG.md` (detail + index). `contract_check` 144; host tests 173.
  Group C complete; a release cut follows after Group D.

### Added — Group C (batch 1): animation authoring — AnimationPlayer + Animation (10 tools, 130 → 140)
- First family of **Group C (Animation)** from the editor-authoring roadmap (unblocked by Group B — animations
  are Resources). Ten C/Editor `anim_*` tools over the editor bridge, schema-enforced, authoring an in-scene
  `AnimationPlayer` (animations live in its `AnimationLibrary` resources, addressed as `animation` within a
  `library`, default `""`):
  - **`anim_player_create`** — add an `AnimationPlayer` node (undoable); seeds an empty default library so `anim_create` works immediately.
  - **`anim_create`** / **`anim_delete`** — create / remove a named `Animation` in a library (undoable; delete is elicitation-gated).
  - **`anim_add_track`** — add a track (value / position_3d / rotation_3d / scale_3d / blend_shape / method / bezier / audio / animation) and set its target path; returns the new track index.
  - **`anim_insert_key`** / **`anim_remove_key`** — insert / remove keyframes (Variant values through the JSON codec).
  - **`anim_set_length`** / **`anim_set_loop`** — set an animation's length and loop mode (none / linear / pingpong).
  - **`anim_get_track_keys`** / **`anim_list`** — read a track's keyframes / list a player's animations across libraries. Read-only.
- Every mutation goes through `EditorUndoRedoManager` (undoable; nothing written to disk) — the `node_*`
  precedent, not the disk-writing `resource_*` / `filesystem_*` gating. Only `anim_delete` is elicitation-gated
  (it discards an animation, like `node_delete`). Handlers in both `addons/claude_bridge/operations.gd` copies
  (dispatch + `_anim_*`), statically parse-checked against local Godot 4.7; host registrations in
  `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`; `registration.test.ts`
  `EXPECTED_TOOL_COUNT` 130 → 140; `docs/TOOL_CATALOG.md` (detail + index). `contract_check` 140; host tests
  173. First of Group C; the `AnimationTree` / state-machine family follows, then a release cut after Group D.

### Fixed
- **Editor bridge loads on Godot 4.3 again.** `_scene_list_open` and `_scene_close` (added in #33) called
  `EditorInterface.get_unsaved_scenes()` and `EditorInterface.close_scene()` — both Godot 4.4+ APIs. Because a
  literal call is resolved at *parse* time, their presence made the entire `operations.gd` addon fail to compile
  on Godot 4.3, taking the whole editor plane down (not just those two tools). Both call sites are now
  feature-detected via `EditorInterface.has_method(...)` and invoked dynamically via `EditorInterface.call(...)`
  — the same idiom `runtime_bridge.gd` already uses for the 4.5+ logger APIs. On Godot 4.3: `scene_list_open`
  returns `unsaved: []` plus a new `unsaved_supported: false` flag; `scene_close` returns an `unsupported`
  error. Godot 4.4+ behavior is unchanged and no tools were added or removed (still 130). Un-reds the
  experimental `editor-plane` Godot 4.3 job.

## [0.11.0] — 2026-07-08

Lands **Group B of the editor-authoring roadmap** — the Resources & FileSystem layer that unblocks Groups
C–F (animation, tilesets, shaders, and audio are all Resources). Two families since 0.10.0: `resource_*`
(#35) and `filesystem_*` (#36). Tool count **118 → 130** (new `resource_*` family of 8, new `filesystem_*`
family of 4); host tests **173**; `scripts/contract_check.py` green at **130**. Every file-writing op is
elicitation-gated — matching the `scene_pack`/`scene_save_as` precedent for disk mutations that fall
outside `EditorUndoRedoManager` — while reads stay ungated; the import tools feature-detect the `.import`
sidecar. Every version stamp (`host/package.json` + lockfile, `index.ts` serverInfo, both `plugin.cfg`,
both `operations.gd` `ADDON_VERSION`) is now **0.11.0** — a minor bump (new tool surface, no breaking
changes). The live `authoring-plane` CI probe for the Group A/B mutators remains a tracked follow-up.

### Added — Group B (batch 2): filesystem (4 tools, 126 → 130)
- Completes **Group B (Resources & FileSystem)** with the `filesystem_*` family. Four A/Editor tools,
  schema-enforced, in lockstep with `scripts/contract_check.py` (130), `registration.test.ts`
  (`EXPECTED_TOOL_COUNT` 126 → 130), and `docs/TOOL_CATALOG.md`:
  - **`filesystem_list`** — list a project directory's subdirectories and files (hidden entries like `.godot` skipped). Read-only.
  - **`filesystem_scan`** — trigger an editor rescan so newly added or externally-changed files are picked up.
  - **`filesystem_move`** — move or rename a file/directory (carrying its `.import` sidecar) and rescan; **destructive** (moves on disk; does not remap references in other resources), elicitation-gated.
  - **`filesystem_create_dir`** — create a directory recursively and rescan; no-op if it already exists.
- Handlers in both `addons/claude_bridge/operations.gd` copies (dispatch + `_filesystem_*`), statically parse-checked against local Godot 4.7; host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`. Built on `DirAccess`, `FileAccess`, and `EditorInterface.get_resource_filesystem()`. Lands Group B; a minor release cut follows.

### Added — Group B (batch 1): resources (8 tools, 118 → 126)
- First family of **Group B (Resources & FileSystem)** from the editor-authoring roadmap — the layer that
  unblocks Groups C–F (animation/tileset/shader/audio are all Resources). Eight A/Editor tools,
  schema-enforced, in lockstep with `scripts/contract_check.py` (126), `registration.test.ts`
  (`EXPECTED_TOOL_COUNT` 118 → 126), and `docs/TOOL_CATALOG.md`:
  - **`resource_create`** — instantiate a Resource subclass (with optional initial properties) and save it as a new file; **destructive** (writes a file), elicitation-gated.
  - **`resource_load`** — load a resource and return its class, `resource_name`, and inspector-visible property list. Read-only.
  - **`resource_save`** — load and (re-)save a resource, optionally to a new path and with `ResourceSaver` flags; **destructive** (writes a file), elicitation-gated.
  - **`resource_duplicate`** — duplicate a resource (optionally deep, cloning subresources) to a new path; **destructive** (writes a file), elicitation-gated.
  - **`resource_get_property`** / **`resource_set_property`** — read or write a single resource property by name (tagged-Variant values). Set is **destructive** (writes a file), elicitation-gated.
  - **`resource_get_import_settings`** / **`resource_set_import_settings`** — read an asset's `.import` metadata (importer + params), or update those params and reimport. Set is **destructive** (rewrites metadata + reimports), elicitation-gated; both feature-detect the `.import` sidecar.
- Handlers added to both `addons/claude_bridge/operations.gd` copies (dispatch + `_resource_*`), statically parse-checked against local Godot 4.7; host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`. Built on `ResourceLoader`/`ResourceSaver`, `ClassDB`, and `ConfigFile` for import metadata. File-writing ops are elicitation-gated rather than `EditorUndoRedoManager`-undoable (they mutate disk, like `scene_pack`/`scene_save_as`).

## [0.10.0] — 2026-07-08

Lands **Group A of the editor-authoring roadmap** — the full scene-graph authoring foundation, the biggest
single authoring jump in the project. Four batches of A/Editor tools since 0.9.0: node-graph depth
(#31), node-depth authoring (#32), scene depth (#33), and signals (#34), plus the `csharp-plane` release-pinning hardening (#30). Tool count **93 → 118** (`node_*` 6 → 13, `scene_*`
4 → 10, new `signal_*` family of 6); host tests **173**; `scripts/contract_check.py` green at **118**.
Every mutator is undoable via `EditorUndoRedoManager` and every destructive op elicitation-gated, holding
the same undo-and-gating discipline across the new surface. Every version stamp (`host/package.json` + lockfile,
`index.ts` serverInfo, both `plugin.cfg`, both `operations.gd` `ADDON_VERSION`) is now **0.10.0** — a
minor bump (new tool surface, no breaking changes). The live `authoring-plane` CI probe for the Group A
mutators remains a tracked follow-up.

### Added — Group A (batch 4): signals (6 tools, 112 → 118)
- New `signal_*` family from the editor-authoring roadmap — completing Group A's authoring surface. Six
  A/Editor tools, schema-enforced and (where they mutate) undoable via `EditorUndoRedoManager`, in
  lockstep with `scripts/contract_check.py` (118), `registration.test.ts` (`EXPECTED_TOOL_COUNT`
  112 → 118), and `docs/TOOL_CATALOG.md`:
  - **`signal_list`** / **`signal_list_connections`** — enumerate a node's signals (names + argument names), or its outgoing connections (signal, target path, method, flags). Read-only.
  - **`signal_connect`** / **`signal_disconnect`** — wire a source signal to a target method, or unwire it (undoable). Connections default to `CONNECT_PERSIST` (flags=2) so they save into the scene; disconnect restores the original flags on undo.
  - **`signal_add_user_signal`** — declare a new user signal with optional typed arguments (undoable via `remove_user_signal`); errors if it already exists.
  - **`signal_emit`** — emit a signal at edit-time, firing connected callables now; **destructive** (edit-time side effects), elicitation-gated.
- Handlers added to both `addons/claude_bridge/operations.gd` copies (dispatch + `_signal_*`); host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`. Built on Godot 4.7 `Object` signal APIs (`get_signal_list`, `get_signal_connection_list`, `connect`/`disconnect`, `add_user_signal`/`remove_user_signal`, `emit_signal`). This lands the last of Group A; a minor release cut follows.

### Added — Group A (batch 3): scene depth (6 tools, 106 → 112)
- Extends the `scene_*` family from the editor-authoring roadmap. Six A/Editor tools, schema-enforced,
  in lockstep with `scripts/contract_check.py` (112), `registration.test.ts` (`EXPECTED_TOOL_COUNT`
  106 → 112), and `docs/TOOL_CATALOG.md`:
  - **`scene_list_open`** — list open scene paths, the current one, and which have unsaved changes (read-only).
  - **`scene_reload`** — reload a scene from disk; **destructive** (discards unsaved changes), elicitation-gated.
  - **`scene_close`** — close the current scene tab; **destructive** (discards unsaved changes), elicitation-gated (only the current scene closes; an optional `path` asserts which).
  - **`scene_pack`** — save a node branch as a new `PackedScene` file (editor "Save Branch as Scene"); **destructive** (writes a file), elicitation-gated. Packs a detached duplicate, so the edited scene is never mutated.
  - **`scene_get_dependencies`** — list a scene file's external resource dependencies (read-only).
  - **`scene_save_as`** — save the current scene to a new res:// path (Save As); **destructive** (writes a file), elicitation-gated.
- Handlers added to both `addons/claude_bridge/operations.gd` copies (dispatch + `_scene_*`); host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`. `scene_close`/`scene_reload` use Godot 4.7 `EditorInterface.close_scene()` / `reload_scene_from_path()`. No release cut.

### Added — Group A (batch 2): node-depth authoring (7 tools, 99 → 106)
- Completes the `node_*` depth surface from the editor-authoring roadmap. Seven A/Editor tools, all
  schema-enforced and — where they mutate — undoable via `EditorUndoRedoManager`, in lockstep with
  `scripts/contract_check.py` (106), `registration.test.ts` (`EXPECTED_TOOL_COUNT` 99 → 106), and
  `docs/TOOL_CATALOG.md`:
  - **`node_instantiate_scene`** — instance an external `PackedScene` as an editable child of a parent (undoable; instanced with `GEN_EDIT_STATE_INSTANCE`).
  - **`node_move_child`** — reorder a node among its siblings by index (undoable; negative indices count from the end).
  - **`node_change_type`** — replace a node with a different class via `Node.replace_by`, carrying over compatible storage properties, children, and groups (undoable; refuses the scene root).
  - **`node_set_owner`** — set a node's owner ancestor (undoable); ownership decides which scene a node saves into.
  - **`node_call_method`** — invoke a method on an edited-scene node; **destructive** (arbitrary invocation, not undoable), elicitation-gated.
  - **`node_get_path`** / **`node_list_properties`** — read a node's path/index/parent metadata, or its inspector-visible property list (name, Variant type, class_name, usage). Read-only.
- Handlers added to both `addons/claude_bridge/operations.gd` copies (dispatch + `_node_*`); host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`. No release cut; the live `authoring-plane` CI probe for the Group A mutators remains a tracked follow-up.

### Added — Group A (batch 1): node-graph authoring depth (6 tools, 93 → 99)
- First installment of the editor-authoring roadmap (Group A). Six A/Editor authoring tools, all
  schema-enforced and — where they mutate — undoable via `EditorUndoRedoManager`, in lockstep with
  `scripts/contract_check.py` (99), `registration.test.ts` (`EXPECTED_TOOL_COUNT` 93 → 99), and
  `docs/TOOL_CATALOG.md`:
  - **`node_duplicate`** — duplicate a node and its subtree under the same parent (undoable; child owners re-set so the copy persists on save).
  - **`node_get_children`** / **`node_find`** — list a node's direct children, or search descendants by class (`is_class`) and/or a case-insensitive name substring.
  - **`node_list_groups`** / **`node_add_to_group`** / **`node_remove_from_group`** — read and edit a node's group membership (add/remove undoable, persistent; no-op when already/not a member).
- Handlers added to both `addons/claude_bridge/operations.gd` copies (dispatch + `_node_*`); host registrations in `host/src/tools/editor.ts`; output schemas in `host/src/schemas.ts`. No release cut; a live `authoring-plane` CI probe for the new mutators is tracked as a follow-up.

### Changed — `csharp-plane` pins OmniSharp / netcoredbg to known-good releases (CI hardening, no tool change)
- The required `csharp-plane` gate installed OmniSharp and netcoredbg from `releases/latest/download/…`.
  As a **required** gate that left the job hostage to upstream: an asset rename — or a bad `latest` —
  would block **every** merge. Both are now pinned via job-level env vars to the tags green on the gate
  as of the 0.9.0 cut — **OmniSharp `v1.39.15`** and **netcoredbg `3.2.0-1092`** — which is exactly what
  `releases/latest` resolved to, so behavior is unchanged today while merges are insulated from upstream
  churn. Bump the pins deliberately after a green run. The binaries still resolve via `find`, so a rename
  even at a pinned tag still fails loudly (empty-var) rather than silently. CI-only; no tool/host change,
  `scripts/contract_check.py` unaffected at 93.

## [0.9.0] — 2026-07-07

Folds the two C#/.NET-plane surfaces cut since 0.8.0 into a release: the **C# LSP mutators** (`cs_rename`
/ `cs_code_action`, #27) and the **C# debugging extras** (`cs_dbg_watch` / `cs_dbg_set_exception_breakpoints`
/ `cs_dbg_restart`, #29). Tool count **88 → 93**; host tests **160 → 173**; `scripts/contract_check.py`
green at **93**. This cycle also **promoted the `csharp-plane` integration job to a required gate** (#28),
so a live C#/.NET regression now blocks a merge. Every version stamp (`host/package.json` + lockfile,
`index.ts` serverInfo, both `plugin.cfg`, both `operations.gd` `ADDON_VERSION`) is now **0.9.0** — a minor
bump per `docs/D4_CSHARP_PLAN.md` (new tool surface, no breaking changes).

### Added — D4 C# debugging extras (`cs_dbg_watch`, `cs_dbg_set_exception_breakpoints`, `cs_dbg_restart`)
- The `cs_dbg_*` plane gains the three GDScript `dbg_*` extras that **netcoredbg actually backs**,
  mirroring the read/inspect surface it already had. Tool count **90 → 93**.
- **`cs_dbg_watch`** — manage a persistent set of C# watch expressions and re-evaluate them in the
  current stopped frame (DAP `watch` context, side-effect-free, so **not** gated). Each expression's
  `evaluate` is bounded by `GODOT_CSDAP_EVALUATE_TIMEOUT_MS`, so a stalling watch fails fast on its own
  entry instead of hanging the stop — the same discipline as `cs_dbg_evaluate` and the GDScript plane.
- **`cs_dbg_set_exception_breakpoints`** — enable (replace) exception breakpoint filters so execution
  halts on a thrown .NET exception (DAP `setExceptionBreakpoints`). netcoredbg advertises `all` and
  `user-unhandled`; the result echoes the active `filters` and the `available_filters`. Not gated;
  feature-detected — on an adapter advertising no `exceptionBreakpointFilters` it returns a clear
  "unsupported" message without sending anything.
- **`cs_dbg_restart`** — restart the session, using the DAP `restart` request when advertised and
  otherwise `terminate` + a fresh handshake. netcoredbg advertises no `supportsRestartRequest`, so the
  relaunch path runs; `method` reports which ran. Reuses the last launch/attach params (`stop_on_entry`
  / `program` / `args` override). C# sessions have no scene, so — unlike `dbg_restart` — there is no
  `scene` field.
- **Deliberately not ported:** `dbg_goto` and `dbg_data_breakpoints`. netcoredbg advertises neither
  `supportsGotoTargetsRequest` nor `supportsDataBreakpoints`, so `cs_dbg_goto` / `cs_dbg_data_breakpoints`
  would only ever return "unsupported" — dead surface, so they are left out. Confirmed from the live
  `C#_DAP_REACHED` capability dump in the `csharp-plane` CI probe.
- **Client additions.** `CsDapClient` gains the watch-set methods (`addWatches` / `removeWatches` /
  `clearWatches` / `evaluateWatches`, reusing the exported `WatchResult`) and a `restart()` (terminate +
  relaunch fallback), mirroring the GDScript `DapClient`; exception breakpoints need no client method
  (the tool drives `request` + capabilities directly).
- **Contract kept in lockstep.** `schemas.ts` (frozen `outputSchema` for the three tools),
  `host/test/registration.test.ts` (`EXPECTED_TOOL_COUNT` 90 → 93) and `docs/TOOL_CATALOG.md` (three
  detail entries + three index rows + updated plane header) all updated in the same change;
  `scripts/contract_check.py` green at **93↔93**. Host tests **166 → 173** (`host/test/csdap.test.ts`:
  watch add/error/remove/clear, exception-breakpoints enable + unsupported-feature-detect, restart
  relaunch-fallback / native-restart / no-session).

### Added — D4 C# LSP mutators (`cs_rename`, `cs_code_action`)
- The last deferred C#-plane surface from the D4 C2 plan: the two OmniSharp LSP **mutators**, mirroring
  the GDScript `gd_rename` / `gd_code_action`. Tool count **88 → 90**.
- **`cs_rename`** — rename a C# symbol project-wide via OmniSharp `textDocument/rename`. Returns the
  planned edit by default (dry run); `apply: true` writes the edits to disk and is **elicitation-gated**
  (with a `confirm: true` override and a safe block on clients that can't prompt), exactly like
  `gd_rename`. Handles both WorkspaceEdit encodings — the legacy `changes` map **and** OmniSharp's
  `documentChanges` (versioned `TextDocumentEdit[]`) — via a shared `normalizeWorkspaceEdit` helper.
- **`cs_code_action`** — list the code actions (quick fixes / refactors) OmniSharp offers for a range,
  read-only (returns `title` / `kind` / `has_edit` / `command` without applying). Unlike Godot's
  GDScript server (which advertises `codeActionProvider: false`), OmniSharp implements code actions, so
  this returns real results; still feature-detected with a `-32601` belt-and-suspenders.
- **Shared edit-application helpers.** `offsetOf` / `applyTextEdits` moved from `tools/lsp.ts` to
  `tools/lsp-common.ts` (its stated home for protocol-generic LSP helpers), joined by the new
  `normalizeWorkspaceEdit` (a `changes` + `documentChanges` → `uri → edits` normalizer) that `cs_rename`
  uses. `gd_rename` / `gd_formatting` now import them; no behavior change.
- **Contract kept in lockstep.** `schemas.ts` (frozen `outputSchema` for both tools),
  `host/test/registration.test.ts` (`EXPECTED_TOOL_COUNT` 88 → 90) and `docs/TOOL_CATALOG.md` (two
  detail entries + two index rows + gate-list update) all updated in the same change;
  `scripts/contract_check.py` green at **90↔90**. Host tests **160 → 166** (`host/test/cslsp.test.ts`:
  `cs_rename` dry-run / apply / `documentChanges` / declined-gate-blocks-write, `cs_code_action`
  list + unsupported feature-detect).

## [0.8.0] — 2026-07-07

Releases the D4 C3 **C# debugging plane** (`cs_dbg_*` via netcoredbg), completing the C#/.NET half of
Plane D — C1 fixture/CI + C2 semantic (`cs_*` via OmniSharp) + C3 debugging. C3 adds new tool surface
(78 → 88 tools), so this is a minor bump per `docs/D4_CSHARP_PLAN.md`. Every version stamp
(`host/package.json` + lockfile, `index.ts` serverInfo, both `plugin.cfg`, both `operations.gd`
`ADDON_VERSION`) is now **0.8.0**. No functional code change since the C3 merge; contract check green
(88 tools), 160 host tests.

### Added — D4 C3: the C# debugging plane (`cs_dbg_*` via netcoredbg)
- The C#/.NET debugging plane — the debugger analogue of the C2 semantic plane, and the mirror of the
  GDScript `dbg_*` DAP plane. **Ten read/inspect `cs_dbg_*` tools** driven by **netcoredbg** (Samsung,
  MIT — DAP-compatible, redistributable; **not** Microsoft `vsdbg`, whose licence forbids third-party
  hosts): `cs_dbg_launch` / `cs_dbg_attach`, `cs_dbg_set_breakpoints`, `cs_dbg_continue` /
  `cs_dbg_step`, `cs_dbg_stack_trace`, `cs_dbg_scopes`, `cs_dbg_variables`, and the gated
  `cs_dbg_evaluate` / `cs_dbg_set_variable`. The richer GDScript extras (watch / restart / goto /
  exception & data breakpoints) are deferred to a later cut, exactly as the C2 LSP mutators were.
- **`host/src/csdap.ts`** — `CsDapClient`, a **transport-agnostic sibling** of `DapClient` (injected
  `JsonRpcChannel`, `coreclr` adapterID). netcoredbg is a **spawned stdio** debug adapter (like
  OmniSharp, unlike Godot's TCP DAP), so it reuses the C2 `StdioChannel` / framing; its protocol logic
  is unit-tested over the *same* loopback-TCP mock the `dbg_*` tests use, while running over stdio in
  production. Matches the one-client-per-protocol precedent (dap.ts / lsp.ts / cslsp.ts) and reuses
  `DapError` / `DapState`.
- **Lazy spawn.** netcoredbg is launched on the **first `cs_dbg_*` call**, so a host without it
  installed starts and runs every other plane unaffected. New config, all env-overridable:
  `GODOT_CSDAP_CMD` (default `netcoredbg`), `GODOT_CSDAP_ARGS` (default `--interpreter=vscode`),
  `GODOT_CSHARP_BIN` (the program `cs_dbg_launch` launches by default — the Mono/.NET Godot binary),
  and the `GODOT_CSDAP_*_TIMEOUT_MS` bounds.
- **Same disciplines as the GDScript plane.** `cs_dbg_evaluate` / `cs_dbg_set_variable` are
  elicitation-gated (with a `confirm: true` override and a safe block on clients that can't prompt);
  both carry the F1 short bounded deadline so a non-answering adapter fails fast with a clear message
  instead of hanging the full DAP timeout, and `cs_dbg_set_variable` feature-detects
  `supportsSetVariable: false` (clear "unsupported", no prompt). `cs_dbg_set_breakpoints`
  feature-detects `supportsConditionalBreakpoints` — dropping the `conditions` modifier with a
  `warning` on an adapter that lacks it. Adapter absent → the lazy stdio spawn fails with an
  actionable hint, never a hang.
- **Contract kept in lockstep.** Tool count **78 → 88**; `schemas.ts` (frozen `outputSchema` per
  tool), `host/test/registration.test.ts` (`EXPECTED_TOOL_COUNT` 78→88), and `docs/TOOL_CATALOG.md`
  (new "Plane D — C# Debugging (netcoredbg DAP)" section + 10 index rows) all updated in the same
  change; `scripts/contract_check.py` green at 88↔88. Host tests **139 → 160** (`host/test/csdap.test.ts`:
  the ten tools + client protocol behaviors over a TCP mock — breakpoint/stack/scopes/variables/evaluate,
  the gated + fail-fast mutators, condition feature-detect — **plus** an end-to-end pass through a real
  spawned `StdioChannel` and a spawn-failure path).
- **CI.** The experimental `csharp-plane` job (still `continue-on-error`, non-required) installs
  **netcoredbg** and runs a live `cs_dbg_*` probe (`host/test-integration/csharp-dap.integration.mjs`,
  markers **`C#_DAP_*`**): an `initialize` handshake against real netcoredbg is the gate, then a
  best-effort, **log-only** launch-to-breakpoint flow over the `example-csharp` fixture. The
  netcoredbg + Godot native-host attach story under headless CI is the least-certain piece of D4
  (see `docs/D4_CSHARP_PLAN.md`), so only the gate is fatal — proven end-to-end by the mock unit suite.
- **Released in 0.8.0** — per the D4 plan, a version is cut when a chunk lands new surface; this cut
  folds the C3 tools into a minor. Versions unified at **0.8.0**; npm still 0.4.8 (publish pending).

## [0.7.0] — 2026-07-07

Releases the D4 C#/.NET work and unifies the version stamps, which had drifted (host at 0.6.0, addon
at 0.6.1). **C2 — the C# semantic plane (`cs_*` via OmniSharp)** adds new tool surface (70 → 78
tools), so this is a minor bump per the D4 plan; it also promotes the D4 C1 fixture/CI scaffold and
the Godot 4.3/4.4 runtime-bridge fix + runtime-plane CI probe below. Every version stamp
(`host/package.json` + lockfile, `index.ts` serverInfo, both `plugin.cfg`, both `operations.gd`
`ADDON_VERSION`) is now **0.7.0**.

### Fixed — runtime bridge failed to load on Godot 4.3/4.4 (D6 regression)
- `runtime_bridge.gd` called the 4.5+ `OS.add_logger()` / `OS.remove_logger()` **directly**. GDScript
  resolves those at parse time, so on Godot 4.3/4.4 (where the methods don't exist) the whole script
  failed to compile and the runtime autoload never loaded — taking **all of Plane C** down, not just
  D6 capture, despite the `ClassDB.class_has_method` runtime guard (which never got the chance to run).
  They are now invoked dynamically via `OS.call("add_logger"/"remove_logger", …)`, so the script
  compiles on 4.3/4.4 and capture stays a clean no-op there while working on 4.5+. Surfaced by the new
  runtime-plane CI probe below.
- The example's `project.godot` referenced the runtime autoload by UID (`uid://…`), which Godot 4.3
  cannot resolve, so the autoload failed to instantiate even once the parse error was fixed. It now
  uses the `res://addons/claude_bridge/runtime_bridge.gd` path — exactly what `plugin.gd`'s
  `add_autoload_singleton` writes for real installs (so this only ever affected the bundled example,
  never users who enable the plugin), and which resolves on every Godot 4.x.
- `ADDON_VERSION` (and both `plugin.cfg`) **0.6.0 → 0.6.1**. No host/tool changes (still **70 tools**,
  **124 host tests**).

### Added — runtime-plane CI probe (live D6 zero-config console capture)
- New `runtime-plane` job in `.github/workflows/integration.yml` boots the example **game**
  headless (no editor / no GUI) and drives Plane C against the in-game `ClaudeRuntimeBridge`
  autoload (`:9081`), asserting the D6 contract against a LIVE engine: a real `print()` is captured
  into `runtime_get_log` via the scriptable `Logger`. This gives D6 a live regression guard rather
  than proving it only by a local one-off probe.
- Runs as a matrix across **4.3** (below the capture floor — the probe asserts the documented no-op:
  the bridge loads, `capture` is false, the `print()` is absent, and `push_log` entries are still
  served), **4.5** (the floor where `OS.add_logger` was introduced) and the newest stable **4.7** (on
  4.5/4.7 the live `print()` must be captured). The probe
  (`host/test-integration/runtime-capture.integration.mjs`) drives the host's own runtime tools
  (`runtime_get_log` / `runtime_call_method`) against the live game — the CLI-plane pattern, extended
  to Plane C — reads the `capture` flag, and is version-aware, asserting the correct behavior on each
  side of the 4.5 boundary. (The 4.3 arm depends on the runtime-bridge fix above.)
- Headless and deterministic (no Xvfb / GPU, unlike the editor/dap planes); a **required gate** like
  cli-plane — all three arms (4.3/4.5/4.7) must pass, and the three contexts are added to `main`'s
  branch-protection required checks. **No host/addon code, tool, resource, or version changes** —
  CI + test-only (tool count still **70**, host suite still **124**).

### Added — D4 C#/.NET plane scaffold (C1, experimental)
- First chunk of the **D4 C#/.NET language plane** (`DEFERRED_TRACKS_PLAN.md` Group C). New
  `example-csharp/` fixture — a minimal C# Godot project mirroring `example/` (`Player.cs` with
  `Counter` / `_Ready` / `_Process` / `TakeDamage`; `Godot.NET.Sdk/4.7.0`, `net8.0`). No
  `claude_bridge` addon by design (the C# plane uses OmniSharp / the Mono debugger, and it avoids a
  third `ADDON_VERSION` copy under `contract_check.py`).
- New experimental **`csharp-plane`** job in `integration.yml` (`continue-on-error`, never blocks a
  merge, like editor/dap-plane): downloads a Mono/.NET Godot build + the .NET 8 SDK, `dotnet build`s
  the fixture, imports + `--build-solutions`, and boots it headless asserting the C# `_Ready()` ran
  (`C#_PLANE_BOOT_OK`; markers `C#_PLANE_*`). Validated live on macOS **and** green on a real Linux
  CI runner (PR #24).
- Companion plan `docs/D4_CSHARP_PLAN.md` — chunked **C1 → C2** (OmniSharp `cs_*` LSP tools) **→ C3**
  (netcoredbg DAP), with version-alignment rules and a `gd_*`→`cs_*` mirror table. **Additive only —
  no host/tool/resource/version change** (still **70 tools**, **124 host tests**; contract check green).

### Added — D4 C2: C# semantic plane (`cs_*` via OmniSharp)
- Eight read-only **`cs_*`** tools mirroring the read-only `gd_*` LSP surface, driven by **OmniSharp**:
  `cs_completion`, `cs_hover`, `cs_definition`, `cs_references`, `cs_document_symbols`,
  `cs_workspace_symbols`, `cs_signature_help`, `cs_diagnostics`. Mutators (`cs_rename` /
  `cs_code_action`) are deferred to a later cut, exactly as the GDScript mutators were. Each tool is
  capability-gated with a `-32601` belt-and-suspenders, degrading to a clear "unsupported" message
  rather than a hang — the same discipline as the GDScript plane. (Unlike Godot's GDScript server,
  OmniSharp actually implements `workspace/symbol`, so `cs_workspace_symbols` returns real results.)
- **New stdio transport.** OmniSharp is a spawned stdio language server (not a TCP one like Godot's),
  so `host/src/stdio.ts` adds a `StdioChannel` that speaks LSP `Content-Length` framing over a child
  process. The framing primitives (`encodeFrame` / `FrameDecoder`) and the `JsonRpcChannel` interface
  are factored out of `framing.ts` and shared by both the TCP (`FramedConnection`) and stdio
  transports; the LSP tool reshaping helpers are factored into `tools/lsp-common.ts` and shared by the
  `gd_*` and `cs_*` planes. The C# client (`host/src/cslsp.ts`) is a transport-agnostic sibling of the
  GDScript `LspClient` (injected channel), so its protocol logic is unit-tested over the same loopback
  TCP mock harness while running over stdio in production. OmniSharp is spawned **lazily** on the first
  `cs_*` call, so a host without it installed starts and runs every other plane unaffected. New config
  (all env-overridable): `GODOT_CSLSP_CMD` (default `OmniSharp`), `GODOT_CSLSP_ARGS` (default `-lsp`),
  `GODOT_CSHARP_PROJECT` (the C# project root), `GODOT_CSLSP_TIMEOUT_MS` (default 30000).
- **Tool count 70 → 78**; `contract_check.py` + `registration.test.ts` updated in lockstep, and each
  new tool has a frozen `outputSchema` (`schemas.ts`) and a `docs/TOOL_CATALOG.md` entry. Host tests
  **124 → 139** (new `cslsp.test.ts`: the eight tools + client protocol behaviors over a TCP mock,
  **plus** an end-to-end pass through a real spawned `StdioChannel`, which also asserts a spawn failure
  surfaces a clear error instead of hanging).
- **CI.** The experimental `csharp-plane` job (still `continue-on-error`) gains a live `cs_*` probe:
  it installs OmniSharp, builds the host, and runs `csharp-lsp.integration.mjs` against a real
  OmniSharp over the `example-csharp` fixture, logging grep-able **`C#_LSP_*`** markers
  (`C#_LSP_REACHED`, `C#_LSP_CAPS`, per-tool `PROBE …`). No new required check — the plane stays
  non-blocking until proven green across a few runs, the way `runtime-plane` was promoted.

## [0.6.0] — 2026-07-06

### Added — D6: zero-config console capture in the runtime bridge (Godot 4.5+)
- The in-game runtime autoload (`runtime_bridge.gd`) now registers a scriptable `Logger`
  (`OS.add_logger`, Godot 4.5+) that funnels every `print()`, `push_warning`, `push_error`, and
  engine message into the same ring buffer `runtime_get_log` reads — so the host gets the game's full
  console with **no managed parent process** (`godot_run_managed` is no longer required just to see
  `print()` output; launch the game any way, incl. the editor's Play button, and read
  `godot://runtime/log`). The `Logger` subclass is **compiled at runtime**, so its `extends Logger`
  source is only ever parsed where the class exists — the addon stays parse-clean on Godot 4.3/4.4,
  where capture is simply absent (only explicit `push_log` entries appear, unchanged behavior).
- Captured log lines mark the log resource dirty; `godot://runtime/log` is pushed to subscribers
  (coalesced to one per frame), tying D6 into the D3 subscription path. `runtime.get_log` now returns
  a `capture` flag (host output schema updated, optional) so a client can feature-detect whether the
  zero-config hook is active and fall back to `godot_run_managed` when it isn't.
- Per the "GDScript now, native later" decision, the native GDExtension logger the plan originally
  scoped (godot-cpp / scons) is **deferred** — the 4.5 `Logger` API is scriptable and delivers the
  same capability with no native toolchain. See `BACKLOG.md`.
- `ADDON_VERSION` (and both `plugin.cfg`) go **0.5.1 → 0.5.2**. Tool count unchanged (**still 70
  tools**); the host suite goes **123 → 124 tests** (the `godot://runtime/log` subscription push).

### Added — D3 follow-ups: runtime-side resource change events + host-side coalescing
- **Runtime SceneTree subscriptions.** The in-game runtime autoload (`runtime_bridge.gd`) now emits a
  `resource.changed` for `godot://runtime/tree` when the running game's live SceneTree gains, loses, or
  renames a node, so a subscriber is pushed `notifications/resources/updated` and re-reads the live
  tree. Emission is collapsed to at most one push per frame via a dirty flag, so a burst of node
  adds/removes in a single frame is a single event. The host side was already wired (the runtime
  `BridgeClient`'s `onResourceChanged` + `ensureConnected`); this adds the missing addon emitter,
  mirroring the editor `broadcast_event`. `ADDON_VERSION` (and both `plugin.cfg`) go **0.5.0 → 0.5.1**
  (host `package.json` unchanged until the next release cut).
- **Host-side coalescing.** `registerResourceSubscriptions` now throttles rapid `resources/updated`
  pushes per URI with a leading-edge + trailing-flush window: the first change pushes immediately, then
  further changes inside the window (default 50 ms, override via `CLAUDE_RESOURCE_COALESCE_MS`; `0`
  disables) collapse into at most one trailing push. This applies to every subscribed URI — editor and
  runtime — so a noisy source (e.g. continuous SceneTree churn) can't fan out as a flood. Multiple
  `updated` are spec-harmless (the client just re-reads), so this only trims volume.
- Tool count unchanged (**still 70 tools**); the host suite goes **121 → 123 tests** — a burst of rapid
  changes collapses to leading + one trailing push, and `coalesceMs = 0` restores one-push-per-change.

## [0.5.0] — 2026-07-06

### Added — resource subscriptions with live `notifications/resources/updated` (D3)
- Clients can now `resources/subscribe` / `resources/unsubscribe` to any `godot://…` resource and
  receive a `notifications/resources/updated` push when it changes. The change signal originates in
  the editor addon — `EditorSelection.selection_changed` and the `EditorPlugin` `scene_changed`
  signal broadcast a compact `{"event":"resource.changed","uri":…}` line over the existing bridge
  socket (no `id`, so it never collides with a request/response) — and the host fans it out with
  `server.server.sendResourceUpdated`, but only for URIs a client actually subscribed to.
  Non-subscribers keep the unchanged pull-only behavior. Selection / edited-scene changes map to
  `godot://editor-state` (plus `godot://scene-tree` when the edited scene changes).
- **Host** (`host/src/`): the server now also advertises the `resources.subscribe` capability; a new
  `host/src/subscriptions.ts` holds a `ResourceSubscriptions` registry, installs the
  subscribe/unsubscribe request handlers on the low-level server, keeps the relevant bridge
  connected so pushes flow, and routes `resource.changed` events to `notifications/resources/updated`.
  `BridgeClient` gained an `onResourceChanged` event path plus `ensureConnected()` with transparent
  re-dial so the push channel survives an editor restart.
- **Addon** (`bridge_server.gd` / `plugin.gd`, both copies): `broadcast_event(uri)` pushes the change
  line to every connected client; `plugin.gd` connects the selection / scene-changed signals on
  enable and disconnects them on disable. `ADDON_VERSION` (and both `plugin.cfg`) go
  **0.4.16 → 0.4.17** (host `package.json` unchanged; the version cut lands with the Group-A
  release). Tool count unchanged (**still 70 tools**); the host suite goes **115 → 121 tests** —
  subscribe→push→exactly-one-`updated`, un-subscribed URI ignored, unsubscribe silences, the
  runtime-bridge path, and a registry unit check.
- **CI**: the experimental `editor-plane` job gained a live probe
  (`test-integration/editor-subscriptions.integration.mjs`, `D3_SUB_*` markers) that subscribes,
  drives a real selection change over the addon bridge, and asserts a `resources/updated` push; it
  runs under `continue-on-error`, so live-engine timing never blocks a merge.

### Added — long jobs now use the formal MCP task-execution model (D2)
- `godot_export`, `godot_import`, and `godot_run_headless_script` — the three run-to-completion
  headless jobs — now register under the spec's **task model** (`server.experimental.tasks`,
  `@modelcontextprotocol/sdk@1.29.0`) instead of emitting ad-hoc `notifications/progress`. A
  task-aware client gets a handle immediately and drives the job with `tasks/get` (poll),
  `tasks/result` (await), and `tasks/cancel` (stop — which actually **kills the headless Godot
  process** via an `AbortController` wired into the store). Plain clients are unchanged: with
  `taskSupport: 'optional'` the SDK auto-creates a task, polls it to completion, and returns the
  result synchronously. The server now advertises the `tasks` capability and is constructed with a
  `GodotTaskStore` (extends the SDK `InMemoryTaskStore`, adding the cancel→abort hook); a new
  `host/src/tasks.ts` holds the store plus a `registerTaskTool` helper that re-applies the B1
  frozen output-schema check the SDK skips for task results. The ad-hoc `startProgress` helper is
  removed. No addon/schema change and the tool count is unchanged (**still 70 tools**); the host
  suite goes **109 → 115 tests** — a full create→poll→await→cancel lifecycle over an in-memory
  transport, the synchronous non-task path, a failed-worker path, plus cancel-abort and
  schema-injection unit checks.

### Added — CI: the editor/LSP-plane probe now runs against the newest stable (4.7) too — D7 resolved
- The experimental `editor-plane` job gained the same Godot-version matrix (`4.3-stable` +
  `4.7-stable`), so the D7 LSP probe (`D7_CAPS` / `D7_WS_RAW` / `D7_CAPS2`) characterizes both.
  Findings: **`workspace/symbol` still replies `-32601` through 4.7** — 4.3 advertised
  `workspaceSymbolProvider: true` yet failed every query; 4.7 honestly advertises it `false` and
  likewise replies `-32601`, so `gd_workspace_symbols` stays gated (D7 resolved: the
  "unsupported through 4.x" framing holds through 4.7). Bonus: **`gd_document_highlight` lights
  up on 4.7** — `documentHighlightProvider` flips `false → true` and the tool returns results
  live (3 highlights); it un-gates automatically via feature-detection, no code change.
  `type-definition`, `implementation`, `folding-ranges`, `formatting`, `document-color`, and
  `code-action` remain advertised-`false` / unsupported through 4.7; `signature-help`,
  `declaration`, and `document-link` work on both. CI-only; no tool/schema/host change (still
  **70 tools / 109 tests**).

### Added — CI: the DAP-plane probe now runs against the newest stable (4.7) too
- The experimental `dap-plane` integration job gained a Godot-version matrix (`4.3-stable` +
  `4.7-stable`), so the live D_DAP_* capability probe characterizes both the baseline and the
  newest stable in one run (4.7 is also the version the maintainer runs locally). Findings:
  **`dbg_evaluate` gains full expression evaluation on 4.7** (`counter + 1` → `101`; on 4.3 it
  does bare-name lookup only and returns empty for a compound expression), while
  **`dbg_set_variable` stays advertised-but-unanswered even on 4.7** (`supportsSetVariable=true`
  yet no reply) — the ~8 s fail-fast bound from `[0.4.16]` fires cleanly on 4.7, confirming it as
  permanent behavior rather than a 4.3-only workaround. The conditional / hit-count / logpoint
  breakpoint modifiers remain advertised-unsupported and ignored through 4.7. CI-only; no tool /
  schema / host change (still **70 tools / 109 tests**).

## [0.4.16] — 2026-07-06

### Changed — `dbg_watch` bounds its watch evaluate so a stalling watch fails fast
- `dbg_watch` re-evaluates its whole watch set at every stop via `DapClient.evaluateWatches`,
  which previously sent each `evaluate` with the full 20 s `dapTimeoutMs`. A single watch
  expression the adapter never answers (the advertised-but-unimplemented gap the `[0.4.15]` fix
  addressed for `dbg_evaluate` / `dbg_set_variable`) would therefore hang the full 20 s at
  **every stop**. The watch `evaluate` is now bounded by `dapEvaluateTimeoutMs` (default 8 s,
  `GODOT_DAP_EVALUATE_TIMEOUT_MS`), so a non-answering watch **fails fast on that entry** — its
  `error` carries the timeout — while the other watches still resolve. No tool/schema/addon
  change (still **70 tools**); host suite **108 → 109 tests**.

## [0.4.15] — 2026-07-06

### Changed — `dbg_set_variable` / `dbg_evaluate` fail fast on a non-answering adapter
- `dbg_set_variable` and `dbg_evaluate` now send their `setVariable` / `evaluate` request with a
  **short bounded deadline** (default 8 s, `GODOT_DAP_SETVAR_TIMEOUT_MS` /
  `GODOT_DAP_EVALUATE_TIMEOUT_MS`) instead of the full 20 s `dapTimeoutMs`. On timeout the tool
  returns a **clear message** — for `dbg_set_variable`, that the build advertises
  `supportsSetVariable` but does not implement it and **no change was made** — rather than a
  generic DAP timeout. This directly addresses the Godot 4.3 finding below: 4.3 advertises
  `supportsSetVariable=true` (so the capability short-circuit can't catch it) yet never answers
  the request. No tool/schema/addon change (still **70 tools**); host suite **106 → 108 tests**.

### Confirmed live — the mutating/gated DAP tools on Godot 4.3 (dap-plane probe)
- Extended `host/test-integration/editor-dap.integration.mjs` to drive the three
  gated/mutating DAP tools end-to-end against a live, **stopped** Godot 4.3 game
  (`confirm:true` bypasses the probe's auto-decline elicit stub). Test-infra only — no
  tool/schema/addon change (still **70 tools / 106 tests**). Ground truth from the CI log:
  - **`dbg_restart` works** via the native DAP restart path (`method="restart"`): it re-runs
    the scene and re-hits a buffered breakpoint (`D_DAP_RESTART` / `D_DAP_RESTART_REHIT`).
  - **`dbg_evaluate` resolves bare variable names** (`counter` → `100`, with or without a
    frame) **but returns empty for a compound expression** (`counter + 1`) — 4.3's
    repl-context evaluate does name lookup, not expression evaluation
    (`D_DAP_EVAL[name|name+frame|expr]`).
  - **`dbg_set_variable` is advertised but unimplemented on 4.3**: it advertises
    `supportsSetVariable=true` yet never answers the `setVariable` request (20 s timeout) and
    the value is unchanged (`D_DAP_SETVAR` / `D_DAP_SETVAR_READBACK counter=100`) — another
    advertised-but-unimplemented gap, like the 4.3 breakpoint modifiers. Corrects the earlier
    note that 4.3 offered a working live set-variable.

## [0.4.14] — 2026-07-06

### Changed — `dbg_set_breakpoints` feature-detects per-line modifiers
- `dbg_set_breakpoints` now **feature-detects** the `condition` / `hitCondition` /
  `logMessage` per-line modifiers: they are sent only when the connected adapter advertises
  `supportsConditionalBreakpoints` / `supportsHitConditionalBreakpoints` / `supportsLogPoints`.
  On an adapter that advertises them unsupported the modifier is **dropped** and the result
  carries `unsupported_modifiers` + a `warning`, so a "conditional" breakpoint can no longer
  silently halt unconditionally. Mirrors the `dbg_set_exception_breakpoints` / `dbg_goto` /
  `dbg_data_breakpoints` advertised-vs-implemented discipline. No surface change (still
  **70 tools**); host suite **105 → 106 tests**.

### Confirmed live — Godot 4.3 ignores breakpoint modifiers (new dap-plane probe)
- Added `host/test-integration/editor-dap-breakpoints.integration.mjs`, a second `dap-plane`
  probe that empirically settled the open question from the capability dump: Godot 4.3's
  adapter advertises the three modifier caps **false** AND **ignores** the fields —
  `D_DAP_MODIFIERS: condition=IGNORED hitCondition=IGNORED logMessage=IGNORED` (a breakpoint
  carrying any of them halts every time). This motivated the feature-detect above.

### Added — the dap-plane now lands a REAL debugger stop
- Reworked `host/test-integration/editor-dap.integration.mjs` and forced the example project
  onto the OpenGL (`gl_compatibility`) renderer so the game the debug adapter launches runs on
  GPU-less CI runners (the default Forward+/Vulkan renderer segfaulted on init). The `dap-plane`
  now lands a genuine breakpoint stop and exercises the full live surface — `dbg_stack_trace` /
  `dbg_scopes` / `dbg_variables` (`counter=100`) / `dbg_watch` / `dbg_step` / `dbg_continue` —
  the first time the DAP inspection tools have run against a live, stopped Godot game.
  `continue-on-error` / not a required check; no tool/schema change.

## [0.4.13] — 2026-07-06

### Added — DAP-plane CI smoke (infra, no tool change)
- New **experimental `dap-plane` integration job** (`.github/workflows/integration.yml`)
  and probe (`host/test-integration/editor-dap.integration.mjs`) that boots the real
  Godot editor under Xvfb and connects to its built-in **Debug Adapter (DAP, :6006)** —
  the first time any of the 15 `dbg_*` tools run against a live adapter. It runs the
  `initialize` handshake (the gate), then dumps the adapter's advertised capabilities
  (grep-able `D_DAP_CAPS` / `D_DAP_FILTERS` markers) so we finally learn which of
  `supportsRestartRequest` / `supportsGotoTargetsRequest` / `supportsDataBreakpoints` /
  `supportsSetVariable` / `exceptionBreakpointFilters` Godot 4.3 actually advertises —
  i.e. which of `dbg_restart` / `dbg_goto` / `dbg_data_breakpoints` / `dbg_set_variable`
  light up live vs. degrade to "unsupported". A best-effort scenario launches the
  example scene to a breakpoint in `_ready()` and reads stack / scopes / variables.
- Mirrors the LSP `editor-plane`: `continue-on-error` (never blocks a merge) and **not**
  a required check while live-adapter timing is new. No tool/schema change —
  surface stays **70 tools**; `contract_check.py` parity unchanged (70 ↔ 70).

### Confirmed live — first DAP ground truth (Godot 4.3-stable, from the new plane)
- The job's first run dumped the adapter's advertised capabilities:
  **`supportsRestartRequest=true`** (so `dbg_restart` uses the native DAP `restart`
  path rather than the terminate+relaunch fallback) and **`supportsSetVariable=true`**
  (`dbg_set_variable` is usable live), while **`supportsGotoTargetsRequest=false`** and
  **`supportsDataBreakpoints=false`** — so `dbg_goto` and `dbg_data_breakpoints`
  correctly degrade to "unsupported" on 4.3, exactly the advertised-vs-implemented
  discipline they were built with.
- Exception breakpoints are effectively unavailable on 4.3: the adapter advertises
  **`exceptionBreakpointFilters=[]`** and does **not respond to `setExceptionBreakpoints`**
  (the request times out). `dbg_set_exception_breakpoints` therefore has no filters to
  offer and currently blocks until timeout on this build — a candidate for a
  short-circuit feature-detect (advertise-none → return "unsupported" without sending).
- The best-effort launch→breakpoint scenario did **not** settle under CI software
  rendering (`D_DAP_STOP: breakpoint_hit=false`), so live stack/scopes/variables remain
  unproven; the capability dump is the confirmed result. Getting the launched game to
  reliably reach a breakpoint under Xvfb is the next increment.

### Fixed — `dbg_set_exception_breakpoints` short-circuit (motivated by the live probe)
- `dbg_set_exception_breakpoints` now **feature-detects**: when the connected adapter
  advertises no `exceptionBreakpointFilters`, it returns a clear "unsupported" message
  **without** sending `setExceptionBreakpoints`. On Godot 4.3 that request is never
  answered (it timed out after 20 s in the DAP-plane probe), so the tool previously
  hung until timeout — it now returns instantly. Matches the advertised-vs-implemented
  discipline already used by `dbg_goto` / `dbg_data_breakpoints` / `dbg_set_variable`.
  No output-schema change; **+1 loopback test (104 → 105)**; `contract_check` still 70 ↔ 70.

## [0.4.12] — 2026-07-06

### Added — DAP debugger-depth track (three tools)
- **`dbg_restart`** — restart the current debug session. Uses the DAP `restart`
  request when the adapter advertises `supportsRestartRequest`, otherwise falls
  back to `terminate` + a fresh launch/attach handshake, so it works on **every**
  adapter regardless of the advertised capability. Reuses the last
  `dbg_launch`/`dbg_attach` parameters; `scene` / `stop_on_entry` override them for
  a launched session. The result's `method` reports which path ran
  (`restart` vs `relaunch`).
- **`dbg_goto`** — 'set next statement': move the program counter within the
  current stopped frame (DAP `gotoTargets` + `goto`). Called with `path` + `line`
  it lists the valid goto targets; with a single target (or an explicit
  `target_id`) it jumps. **Destructive** (skips/repeats code) → elicitation-gated.
  Feature-detected on `supportsGotoTargetsRequest`: an adapter that does not
  advertise it gets a clear "unsupported" message **without prompting**.
- **`dbg_data_breakpoints`** — set (replace) data breakpoints / watchpoints that
  halt when a variable's value changes (DAP `dataBreakpointInfo` +
  `setDataBreakpoints`). Resolves each requested variable to a `dataId`, arms all
  resolvable ones in one call, and reports the armed `breakpoints` plus any
  `unresolved` variables. Not gated (it only configures the debugger).
  Feature-detected on `supportsDataBreakpoints`.
- Surface **67 → 70 tools** (DAP 12 → 15). Frozen output schemas (B1), the
  registration meta-test (→ 70), `docs/TOOL_CATALOG.md` (entries + index + summary)
  and `README.md` updated in lockstep. **+10 loopback mock-server tests → 104
  total.** `contract_check.py` green (70 ↔ 70).
- Same **advertised ≠ implemented** discipline as the LSP-depth tools: `dbg_goto`
  and `dbg_data_breakpoints` degrade to "unsupported" where Godot's adapter does
  not advertise the capability (not live-probed this session — DAP-plane CI smoke
  is still pending), while `dbg_restart` is useful on every adapter via its
  terminate+relaunch fallback.

## [0.4.11] — 2026-07-06

### Added
- **`gd_document_color`** — a read-only LSP tool wrapping `textDocument/documentColor`:
  the color literals the GDScript language server recognizes in a script (the
  `Color(...)` values an editor draws an inline swatch for), each with its source
  range, RGBA components (floats 0..1) and a convenience `#RRGGBBAA` hex (Godot's
  `Color.to_html()` ordering). Same feature-detect + `-32601` belt-and-suspenders
  as the other Phase-1 LSP-depth tools, so an advertised-but-unimplemented build
  degrades to a clear "unsupported" message rather than a raw JSON-RPC error.
- Surface **66 → 67 tools** (LSP 17 → 18). Frozen output schema (B1), the
  registration meta-test (→ 67), `docs/TOOL_CATALOG.md` (entry + index + summary)
  and `README.md` updated in lockstep. **+3 loopback mock-server tests → 94 total.**
  `contract_check.py` green (67 ↔ 67, 57 catalog JSON blocks).

### Validated (live editor CI — the D7 probe, extended to gd_document_color)
- Against real **Godot 4.3-stable**: `colorProvider` appears among the `initialize`
  capability keys but with the value **`false`** (`D7_CAPS2 → color=false`), so
  `gd_document_color` correctly returns "unsupported" — joining
  `gd_document_highlight` / `gd_type_definition` / `gd_implementation` /
  `gd_folding_ranges` / `gd_formatting` in the advertised-but-not-honoured group
  (`gd_declaration` + `gd_document_link` remain the only read-only providers that
  return live on 4.3). Validates the feature-detect + `-32601` design once more.

### Note
- No functional addon (GDScript) change since v0.4.8 — only the `ADDON_VERSION`
  stamp bumps; any of v0.4.8–v0.4.11 is a coherent *addon* release. The npm publish
  (needs 2FA) and the Asset Library submission remain maintainer actions.

## [0.4.10] — 2026-07-06

### Added
- **Phase 1 LSP-depth — seven read-only navigation/inspection tools.** Each wraps
  a provider Godot's GDScript language server lists in its `initialize`
  capabilities, feature-detecting the capability and keeping a `-32601`
  belt-and-suspenders so an advertised-but-unimplemented provider degrades to a
  clear "unsupported" message instead of a raw JSON-RPC error:
  - `gd_document_highlight` — occurrences of the symbol at a position within one
    file, tagged read / write / text (`textDocument/documentHighlight`).
  - `gd_type_definition` — the type of the symbol at a position
    (`textDocument/typeDefinition`).
  - `gd_implementation` — implementation location(s) (`textDocument/implementation`).
  - `gd_declaration` — declaration location(s) (`textDocument/declaration`).
  - `gd_folding_ranges` — foldable regions of a script (`textDocument/foldingRange`).
  - `gd_document_link` — links embedded in a script with targets
    (`textDocument/documentLink`).
  - `gd_formatting` — a **read-only** whole-file format *preview*: returns the
    formatted text, never writes to disk (`textDocument/formatting`).
- Surface **59 → 66 tools** (LSP 10 → 17). Frozen output schemas (B1), the
  registration meta-test (→ 66), `docs/TOOL_CATALOG.md` (entries + index + summary)
  and `README.md` updated in lockstep. **+11 loopback mock-server tests → 91 total.**
  `contract_check.py` green (66 ↔ 66, 56 catalog JSON blocks).

### Validated (live editor CI — the D7 probe, extended to the new tools)
- Against real **Godot 4.3-stable**: `gd_declaration` returns a location and
  `gd_document_link` is implemented (empty list for a link-free file). The other
  five — `gd_document_highlight`, `gd_type_definition`, `gd_implementation`,
  `gd_folding_ranges`, `gd_formatting` — are advertised **`false`** on 4.3 and
  correctly return "unsupported", validating the feature-detect + `-32601` design
  end-to-end. The probe logs `D7_CAPS2` / `PROBE …` markers so a future Godot's
  real behavior is captured in CI.

### Note
- The **addon (GDScript) is unchanged** since v0.4.8; this is a host-only release.
  npm publish of the host still needs the maintainer's 2FA.

## [0.4.9] — 2026-07-05

### Added
- **Phase 1 LSP-depth — two new semantic tools.**
  - `gd_signature_help` — call-signature / active-parameter hints at a position
    (`textDocument/signatureHelp`), resolving `[start,end]` parameter labels
    against the signature label. **Confirmed returning signatures live in CI**
    against a real Godot 4.3-stable editor.
  - `gd_code_action` — the lightbulb menu (`textDocument/codeAction`): quick
    fixes / refactors for a range, listed read-only with a `has_edit` flag and
    any attached `command` (both CodeAction and bare Command shapes normalized).
- **Phase 1 debugger-depth — two new DAP tools.**
  - `dbg_set_exception_breakpoints` — enable/replace the adapter's exception
    breakpoint filters (`setExceptionBreakpoints`) and report the
    `available_filters` it advertises. Config-only, not gated.
  - `dbg_set_variable` — change a variable's value in a stopped frame
    (`setVariable`). **Elicitation-gated** (destructive) and feature-detected:
    returns a clear "unsupported" message without prompting when the adapter
    advertises `supportsSetVariable: false`.
- **Live D7 probe in the editor-plane integration job.** Reports, against a real
  editor, whether `workspace/symbol` returns results and smokes the new LSP
  tools (grep-able `D7_CAPS` / `D7_WS_RAW` / `PROBE` markers; log-only, never
  gates a merge).

### Changed
- **`gd_code_action` degrades gracefully (D7 finding).** The CI probe showed
  Godot 4.3-stable advertises `codeActionProvider: false` and replies `-32601`,
  so the tool now feature-detects (mirroring `gd_workspace_symbols`) and returns
  a clear "unsupported" message instead of leaking a raw JSON-RPC error.
- **`gd_workspace_symbols` framing re-confirmed (D7).** The same probe showed 4.3
  advertises `workspaceSymbolProvider: true` yet still replies `-32601` to every
  query — validating the existing "unsupported" handling and its
  belt-and-suspenders `-32601` catch. Documented in `README.md` /
  `docs/TOOL_CATALOG.md`.
- Surface **55 → 59 tools** (8 → 10 LSP, 10 → 12 DAP). The registration meta-test,
  frozen output schemas, `docs/TOOL_CATALOG.md` (entries + index + gating list),
  and `README.md` were updated in lockstep; `contract_check.py` stays green
  (59 ↔ 59, 52 catalog JSON blocks). +8 loopback mock-server tests (**80 total**).
- Version realigned to **0.4.9** across `host/package.json` (+ lockfile), both
  `plugin.cfg`s, and both `ADDON_VERSION`s (canonical + `example/` vendored copy).

## [0.4.8] — 2026-07-05

### Added
- **Plugin icon shipped inside the addon (`addons/claude_bridge/icon.png`).** A
  128×128 icon (a Godot-blue node bridged to a Claude-terracotta node) added for
  the Godot Asset Library listing. It was committed to `main` after the `v0.4.7`
  tag, so it was absent from the `v0.4.7` tag tree; this release tags it in-tree
  so an Asset Library install now drops the icon into a user's
  `res://addons/claude_bridge/` alongside the addon. Non-functional asset — no
  code or tool behavior changes.

### Changed
- Version realigned to **0.4.8** across `host/package.json` (+ lockfile), both
  `plugin.cfg`s, and both `ADDON_VERSION`s (canonical + `example/` vendored copy).
  This is the tag the Asset Library submission should reference.

## [0.4.7] — 2026-07-05

### Changed
- **Asset Library layout (D5, option A).** Moved the canonical addon from the
  nested `addon/addons/claude_bridge/` to **`addons/claude_bridge/`** at the repo
  root (`git mv addon/addons addons`; the empty `addon/` was removed). This is the
  layout the Godot Asset Library installer expects, so an AssetLib "install" now
  drops `addons/claude_bridge/` into a user's `res://addons/` with no manual step.
  Every path reference was updated to match: `scripts/contract_check.py`,
  `scripts/validate.sh`, `README.md` (layout + setup), and `docs/DISTRIBUTION.md`
  (which now records option A as resolved). `contract_check.py` stays green
  (54 tools, 47/47 catalog JSON) and the real SDK build + `npm pack --dry-run`
  (37-file tarball) are unaffected. The `example/addons/claude_bridge/` vendored
  copy is unchanged in place.
- Version realigned to **0.4.7** across `host/package.json` (+ lockfile), both
  `plugin.cfg`s, and both `ADDON_VERSION`s (canonical + `example/` vendored copy).

## [0.4.6] — 2026-07-05

### Changed
- **npm publish-prep for the host.** Renamed the package
  `godot-claude-bridge-host` → **`godot-claude-bridge`** (the `bin` command was
  already `godot-claude-bridge`; the name was confirmed free on npm), added
  `license`/`repository`/`homepage`/`bugs`/`keywords`/`author` metadata, a
  `prepublishOnly: npm run build` guard so a publish can never ship stale `dist/`,
  and bundled `LICENSE` + a package `README.md` (`files` now lists them). Verified
  with `npm pack --dry-run`. The `npm publish` itself is intentionally left to the
  maintainer (needs npm auth).
- **Root README freshness pass.** Dropped the "Phases 0–4" title and the stale
  "0.4.1 pre-live-run / reference scaffold / not exercised in CI / validated by
  inspection" framing — the project is live-validated with CI running the real
  build. Reworked the Verification, Validating, and Status sections accordingly,
  documented the `gd_workspace_symbols` engine gap, and pointed install at the
  npm package.
- Version realigned to **0.4.6** across `host/package.json`, both `plugin.cfg`s,
  and both `ADDON_VERSION`s (canonical + `example/` vendored copy).

## [0.4.5] — 2026-07-05

### Changed
- **`gd_workspace_symbols` now degrades gracefully.** Godot's GDScript language
  server (through 4.7) has no `workspace/symbol` method and replies
  `-32601 Method not found`, which the tool previously surfaced as a raw
  `LSP error [-32601]: …`. The host now feature-detects the gap: `LspClient`
  captures the server's advertised capabilities from the `initialize` handshake
  (`getServerCapabilities()`), and the tool skips the request when
  `workspaceSymbolProvider` is absent — still catching a `-32601` (or "method not
  found") from builds that advertise the capability but don't honour it — and
  returns an explicit `isError` message pointing at `gd_document_symbols` as the
  working alternative. The success-path `symbols` output shape is unchanged, so
  the tool will start returning results unmodified on a future Godot build that
  implements the method. Output-schema enforcement is unaffected (the MCP SDK
  exempts `isError` results from `outputSchema` validation).

- **Aligned addon version metadata for distribution.** `addon/…/plugin.cfg` was
  still `version="0.1.0"` with a "Phase 0-1 scaffold" description (the file the
  Asset Library and the Godot plugin list actually read), while
  `operations.gd`'s `ADDON_VERSION` said `0.4.3`. Bumped both to **0.4.5** and
  rewrote the stale plugin/README descriptions to the shipped four-plane reality,
  so a plugin-list entry and an Asset Library submission read correctly. Repo-wide
  tags mean host and addon share the one repo version at each tag.

### Added
- **D5 — distribution guide (`docs/DISTRIBUTION.md`).** Documents publishing the
  host to npm and the addon to the Godot Asset Library, and states the remote
  caveat honestly: a cloud sandbox cannot see a local editor and frame capture
  needs a GPU/Xvfb, so a remote deployment is a degraded subset without a local
  relay. No code depends on this; it captures the decisions and steps.

## [0.4.4] — 2026-07-05

### Changed
- **D1 — pinned the SDK floor.** Raised `@modelcontextprotocol/sdk` from
  `^1.10.0` to `^1.17.0` so a lockfile-less `npm install` can no longer resolve a
  pre-elicitation SDK. The confirmation gate needs `server.server.elicitInput`
  and the tools need `registerTool({ inputSchema, outputSchema })`; verified that
  1.17.0 exposes both. The committed lockfile still pins the live-validated
  **1.29.0**, so `npm ci` (and CI) resolve exactly as before — this only tightens
  the floor for fresh, lockfile-less installs.

## [0.4.3] — 2026-07-05

First live-validated **and** hardened build. Exercised end-to-end against a real
Godot 4.7 editor and a real npm-installed `@modelcontextprotocol/sdk@1.29.0`
(resolved from `^1.10.0`); the full Go/No-Go checklist is GO
(see `LIVE_VALIDATION_SIGNOFF.md`). 54 tools + 5 resources across all four planes.

### Added
- **B1 — enforced output schemas.** `host/src/schemas.ts` freezes the
  `structuredContent` shape of every data tool (52 tools) and
  `applyOutputSchemas()` injects each as the tool's `outputSchema`, so the MCP
  SDK now validates every success result at runtime. Shapes were frozen from the
  v0.4.2 live run (47 exercised live, 0 mismatches). Image tools
  (`screenshot_editor`, `runtime_screenshot`) are intentionally excluded.
- **B2 — CI.** `.github/workflows/ci.yml` runs the real
  `npm ci && npm run build && npm run typecheck` plus `scripts/contract_check.py`
  on Node 18/20/22, and asserts the SDK resolves to a 1.x line.
  `.github/workflows/sdk-drift.yml` is a weekly early-warning for SDK major bumps.
- `CHANGELOG.md` (this file).

### Changed
- **B3 — TOOL_CATALOG doc-drift cleanup.** Reconciled `docs/TOOL_CATALOG.md`
  against the shipped code and the now-enforced `schemas.ts`:
  - `runtime_inject_input` input now documents `strength`, `button`, and
    `relative` (host schema and GDScript handler already supported them);
    output documents `kind`.
  - `dbg_evaluate` output documents `variables_ref`.
  - `gd_diagnostics` input documents `wait_ms` and marks `path` required; output
    corrected to a top-level `uri` (was shown per-diagnostic).
  - `gd_rename` input documents `apply`/`confirm`; output documents
    `applied`/`written`.
  - `gd_references` input corrected `includeDeclaration` → `include_declaration`.
  - `dbg_launch`/`dbg_attach`/`dbg_set_breakpoints`/`dbg_stack_trace`/
    `runtime_get_log` schemas reconciled to the shipped shapes.
  - Design note updated to reflect that output schemas are now enforced (B1).
- `ADDON_VERSION` bumped `0.1.0` → `0.4.3` in `operations.gd` (addon and example
  copies) so `editor_ping.addon_version` is meaningful.
- `host/package-lock.json` refreshed after the version bump so `npm ci` is
  deterministic (records `@modelcontextprotocol/sdk@1.29.0`).

### Known limitations
- `gd_workspace_symbols` is non-functional against Godot 4.7: the GDScript
  language server replies `-32601 Method not found` to `workspace/symbol`. The
  gap is in the engine, not the host; the tool's contract is correct and it is
  retained for forward compatibility. (Backlog: feature-detect and hide, or
  return a clearer "unsupported" message.)
- `godot_launch_editor` (detached) does not start Godot's LSP (6005) / DAP (6006)
  servers; use a foreground `godot --editor --path …` when those planes are
  needed.

## [0.4.2] — 2026-07-05

First live-validated build. Gate 0 (the real SDK build, which no static authoring
environment could run) surfaced exactly one real defect, now fixed.

### Fixed
- **`ToolResult` type (`host/src/confirm.ts`).** The confirmation-gate result
  typed `content` as optional/untyped, which compiled against the modeled SDK
  shims but broke against SDK 1.29's `registerTool`, producing nine `TS2345`
  errors across the nine elicitation-gated tools (`dap.ts`, `editor.ts`,
  `lsp.ts`, `runtime.ts`). Retyped `content` as a required
  `Array<{ type: "text"; text: string }>` with an index signature to satisfy
  `CallToolResult`. No logic changed; rebuild clean.

## [0.4.1] — 2026-07-04

Pre-live scaffold with two fixes later confirmed working during the live run.

### Fixed
- **Diagnostics URI key (`host/src/lsp.ts`).** `gd_diagnostics` now matches
  published diagnostics by a normalized `diagKey`, so a diagnostic published
  under a `%20`-encoded `file://` URI is still matched to the opened document
  instead of silently returning empty after the timeout.
- **DAP step/continue await-the-stop (`host/src/tools/dap.ts`).** `dbg_step` and
  `dbg_continue` now wait for the next `stopped`/`terminated` event and return
  the real resulting state, instead of returning an instant `running` reply that
  the caller had to poll.

[0.4.4]: #044--2026-07-05
[0.4.3]: #043--2026-07-05
[0.4.2]: #042--2026-07-05
[0.4.1]: #041--2026-07-04
