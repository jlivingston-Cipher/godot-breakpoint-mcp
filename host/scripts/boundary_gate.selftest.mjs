#!/usr/bin/env node
// boundary_gate.selftest.mjs — session 177, widened in 178.
//
// 173's rule: an instrument with no gate is not a passing instrument. `boundary_gate.mjs`
// finds a claim compared against a value the ADDON hard-wires — a tautology no JS
// instrument can see, because the constant is in GDScript on the other side of a JSON hop.
// It shipped having reddened four live claims and it will spend most of its life green, so
// the only thing standing between it and silence is this file.
//
// Every case drives the exported pure functions with source text directly: no engine, no
// addon, no fixture files, no compile step. Both the CATCHES and the DISMISSALS are pinned
// — a gate that reds on everything constrains nothing, and this one's first draft reddened
// six honest claims (177 §5).
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  dispatchMap, hardwired, toolOps, comparisons, conduits, helpers, judge, collapsed, run, report,
  CONST_FLOOR, OP_FLOOR, TOOL_FLOOR, SITE_FLOOR, RETURN_FLOOR, PLANE_FLOOR, JUDGED_FLOOR,
  BOUNDARY_SKIP, PLANES,
} from "./boundary_gate.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
// 🔴 NAMED AND PINNED — 176 §8's G11. A bare `if (ran < 42)` is a floor read by one branch
// and asserted by nothing, so it can be set to zero and this whole file goes green while
// still printing a passing line. The floor that protects the floors.
const CLAIM_FLOOR = 120;   // measured 130 (was 104 in 178, floor 95)

const said = (r, needle) => r.lines.some((l) => l.includes(needle));
const POP = { consts: 99, ops: 999, tools: 999, sites: 9999, reads: 999, planes: 9,
  opaque: 0, judged: 999, unresolved: 0, ambiguous: 0, nonthrowing: 0 };

// ── 1. THE ADDON'S DISPATCHER, READ RATHER THAN RE-SPELLED ───────────────────────────
const DISPATCH = `
	match op:
		"filesystem.scan":
			return _filesystem_scan(params)
		"signal.emit":
			return _signal_emit(params)
`;
claim(dispatchMap(DISPATCH).get("filesystem.scan") === "_filesystem_scan",
  "an op string resolves to the function the addon's own match arm names");
claim(dispatchMap(DISPATCH).size === 2, "two arms are two entries");
claim(dispatchMap(`"filesystem.scan":\n\tvar x = 1\n`).size === 0,
  "an arm that does not return a handler resolves to nothing — no guessing from the name");

// ── 2. WHAT MAKES A FIELD HARD-WIRED, AND WHAT DOES NOT ──────────────────────────────
// 🔴 THE CENTRAL DISTINCTION OF THE WHOLE FILE. `_resource_load` returns
// `"type": res.get_class()` and `_shader_create` returns `"type": "Shader"`. Same field
// name, opposite meanings — and matching on the NAME flagged six honest claims in this
// gate's first draft (177 §5, which is 175 §3 and 176 §5 committed a third time).
const ONE = `
func _filesystem_scan(_params: Dictionary) -> Dictionary:
	return _ok({"scanning": true})
`;
claim(hardwired(ONE).fields.get("_filesystem_scan")?.get("scanning") === "true",
  "a field that is a literal on the only return path is hard-wired");

const DERIVED = `
func _resource_load(params: Dictionary) -> Dictionary:
	return _ok({"type": res.get_class()})
`;
claim(hardwired(DERIVED).fields.has("_resource_load") === false,
  "🔴 a field computed from the engine is NOT hard-wired — this is the six false positives");

const MIXED = `
func _thing(params: Dictionary) -> Dictionary:
	if params.get("x"):
		return _ok({"state": "on"})
	return _ok({"state": mode})
`;
claim(hardwired(MIXED).fields.has("_thing") === false,
  "🔴 a field that is literal on ONE path and derived on another CAN vary — not hard-wired");

const TWO_SAME = `
func _thing(params: Dictionary) -> Dictionary:
	if params.get("x"):
		return _ok({"state": "on"})
	return _ok({"state": "on"})
`;
claim(hardwired(TWO_SAME).fields.get("_thing")?.get("state") === '"on"',
  "the same literal on every path is still one value nothing can change");

const TWO_DIFF = `
func _thing(params: Dictionary) -> Dictionary:
	if params.get("x"):
		return _ok({"state": "on"})
	return _ok({"state": "off"})
`;
claim(hardwired(TWO_DIFF).fields.has("_thing") === false,
  "two DIFFERENT literals are a value that varies — a claim over it can fail");

const ERRPATH = `
func _thing(params: Dictionary) -> Dictionary:
	if not ok:
		return _err("bad_params", "no")
	return _ok({"done": true})
`;
claim(hardwired(ERRPATH).fields.get("_thing")?.get("done") === "true",
  "🔴 an _err path does not rescue the field — call() throws before the comparison is reached");

const MULTILINE = `
func _thing(params: Dictionary) -> Dictionary:
	return _ok({
		"path": path,
		"type": "Environment",
	})
`;
claim(hardwired(MULTILINE).fields.get("_thing")?.get("type") === '"Environment"',
  "the multi-line dict spelling is read too — one shape of the same return");
claim(hardwired(MULTILINE).fields.get("_thing")?.has("path") === false,
  "and its derived sibling in the same dict is left alone");
claim(hardwired(`func _thing(p): pass\n`).fields.size === 0, "an operation with no _ok() contributes nothing");

// ── 3. THE HOST'S REGISTRATION, AND THE AMBIGUOUS ONE IT REFUSES ─────────────────────
const REG = [["f.ts", `
  server.registerTool("filesystem_scan", { title: "x" }, async () => call("filesystem.scan"));
`]];
claim(toolOps(REG).get("filesystem_scan") === "filesystem.scan",
  "a tool resolves to the operation its own handler names");

const AMBIG = [["f.ts", `
  server.registerTool("thing", { title: "x" }, async () => {
    await call("a.one");
    return call("b.two");
  });
`]];
claim(toolOps(AMBIG).has("thing") === false,
  "🔴 a handler reaching TWO operations is left unresolved — a guess here is the defect this file exists for");

const NOOP = [["f.ts", `server.registerTool("pure", { title: "x" }, async () => ({ ok: true }));`]];
claim(toolOps(NOOP).has("pure") === false, "a tool that calls no operation resolves to nothing");

// ── 4. BINDING A COMPARISON TO THE CALL THAT PRODUCED ITS RECEIVER ───────────────────
const inline = comparisons("p.mjs", `(await call("filesystem_scan")).scanning === true;`);
claim(inline.length === 1 && inline[0].tool === "filesystem_scan" && inline[0].field === "scanning" && inline[0].lit === "true",
  "the inline spelling resolves through await and parentheses");

const bound = comparisons("p.mjs", `const em = await call("signal_emit", { path: a });\nem.emitted === true;`);
claim(bound.length === 1 && bound[0].tool === "signal_emit",
  "a reply bound to a const and read on a later line resolves to the same tool");

const foreign = comparisons("p.mjs", `const r = await other();\nr.ok === true;`);
claim(foreign.length === 1 && foreign[0].tool === null,
  "🔴 a receiver that is not a tool call resolves to NOTHING and is reported unjudged, not assumed clean");

claim(comparisons("p.mjs", `x.field === y.other;`).length === 0,
  "a comparison against another expression is not a literal comparison");
claim(comparisons("p.mjs", `(await call("t")).n === 3;`)[0].lit === "3", "numeric literals count");
claim(comparisons("p.mjs", `true === (await call("t")).flag;`)[0].field === "flag",
  "the reversed spelling — literal on the left — is the same claim");
claim(comparisons("p.mjs", `(await call("t")).s == "x";`)[0].lit === "x", "loose equality counts too");
claim(comparisons("p.mjs", `if ((await call("t")).ok !== true) fail();`).length === 0,
  "!== is not this gate's shape — it is a refutation, and refuting a constant is a different defect");

// ── 5. THE JUDGEMENT: BOTH THE CATCH AND THE DISMISSAL ───────────────────────────────
const OFF = {
  file: "p.mjs", line: 7, text: `x.scanning === true`, tool: "filesystem_scan",
  op: "filesystem.scan", gd: "_filesystem_scan", field: "scanning", lit: "true",
};
const caught = judge(POP, [OFF]);
claim(caught.failed === true, "a claim compared against a hard-wired field FAILS the gate");
claim(said(caught, "BOUNDARY_TAUTOLOGY p.mjs:7"), "and the offender is named with its file and line");
claim(said(caught, "_filesystem_scan"), "and the GDScript function that hard-wired it is named too");
claim(judge(POP, []).failed === false, "a tree with no such claim passes");
claim(said(judge(POP, []), "78") === false, "the ok line reports its own population, not a hard-coded number");
claim(said(judge({ ...POP, judged: 555 }, []), "555 judged claim(s)"), "the ok line reports how many claims it actually judged");
claim(said(judge({ ...POP, unresolved: 12 }, []), "unresolved=12"),
  "🔴 what the gate COULD NOT SEE is printed on every run, green or red");

// ── 6. THE FOUR COLLAPSES, EACH ONE PROVEN TO BITE ───────────────────────────────────
// 🔴 EACH OF THESE ALONE LEAVES THE OTHER THREE REPORTING A CLEAN TREE. A gate whose
// finder went quiet reports zero offenders out of zero population and prints "ok" — 170
// §4, and the shape every instrument in this repo is an instance of.
claim(judge({ ...POP, consts: 0 }, []).failed === true, "no hard-wired field found at all is a collapse, not a clean addon");
claim(said(judge({ ...POP, consts: 0 }, []), "BOUNDARY_CONSTS_COLLAPSE"), "and it says which half went quiet");
claim(judge({ ...POP, ops: 0 }, []).failed === true, "a dispatcher that stopped resolving is a collapse");
claim(said(judge({ ...POP, ops: 0 }, []), "BOUNDARY_OPS_COLLAPSE"), "named separately, because it fails for a different reason");
claim(judge({ ...POP, tools: 0 }, []).failed === true, "registerTool that stopped resolving is a collapse");
claim(said(judge({ ...POP, tools: 0 }, []), "BOUNDARY_TOOLS_COLLAPSE"), "also named separately");
claim(judge({ ...POP, sites: 0 }, []).failed === true, "no comparison found anywhere is a collapse");
claim(said(judge({ ...POP, sites: 0 }, []), "BOUNDARY_SITES_COLLAPSE"), "and so is this one");
claim(judge({ consts: 1, ops: 1, tools: 1, sites: 1, reads: 1, planes: 0, opaque: 0, judged: 0, unresolved: 0 }, []).failed === true,
  "🔴 all six at once is still six separate failures, not one — a partial collapse is the dangerous one");

// 🆕 178's TWO NEW COLLAPSES. Neither is visible to any floor 177 shipped: the reply-dict
// reader can go quiet while every field it already found stays counted, and a whole
// dispatcher file can stop resolving while the other one keeps the OPS floor satisfied.
claim(judge({ ...POP, reads: 0 }, []).failed === true,
  "🔴 a reply-dict reader that read NOTHING is a collapse — 177 §10.2's unfloored hole");
claim(said(judge({ ...POP, reads: 0 }, []), "BOUNDARY_RETURNS_COLLAPSE"), "and it is named separately");
claim(judge({ ...POP, planes: 1 }, []).failed === true,
  "🔴 reading ONE dispatcher when there are two is a collapse — which is what 177 shipped");
claim(said(judge({ ...POP, planes: 1 }, []), "BOUNDARY_PLANES_COLLAPSE"), "and it says so by name");
claim(judge({ ...POP, planes: 2 }, []).failed === false, "…and reading both is not");

// 🔴 THE SEVENTH, AND THE ONE THAT WAS MISSING FOR TWO SESSIONS (179). Every floor above
// pins an INPUT — constants, arms, tools, sites, returns, planes. None pinned the OUTPUT.
// All six could hold while `comparisons()` resolved not one receiver, and the gate would
// print `ok — 0 judged claim(s), none compared against a constant` and exit 0. 178 §10.22
// said an instrument's population is the least audited number it prints; `judged` IS that
// number here, and it was the only population in the file with nothing under it.
claim(judge({ ...POP, judged: 0 }, []).failed === true,
  "🔴 a gate that resolved ZERO claims is a collapse, not a clean tree — and until 179 it printed `ok`");
claim(said(judge({ ...POP, judged: 0 }, []), "BOUNDARY_JUDGED_COLLAPSE"), "and it is named separately from the six input floors");
claim(judge({ ...POP, judged: JUDGED_FLOOR - 1 }, []).failed === true, "one below the floor reddens");
claim(judge({ ...POP, judged: JUDGED_FLOOR }, []).failed === false, "…and exactly at it does not");
claim(JUDGED_FLOOR >= 100,
  "🔴 the judged floor is PINNED — setting it to zero reddens HERE rather than silently re-permitting the collapse it exists for");
claim(said(judge(POP, []), "ambiguous=") && said(judge(POP, []), "nonthrowing="),
  "🔴 both 179 refusals print on every run, green or red — an exclusion that is not counted is indistinguishable from coverage");
claim(said(judge({ ...POP, ambiguous: 21, nonthrowing: 17 }, []), "ambiguous=21 nonthrowing=17"),
  "…and they report their own numbers rather than a hard-coded pair");
claim(said(judge({ ...POP, opaque: 4 }, []), "opaque=4"),
  "🔴 the operations whose replies could NOT be read are printed on every run, green or red");

// 🔴 THE FLOORS THEMSELVES, WITHOUT CIRCULARITY — 176 §8's G12. Asserting `CONST_FLOOR
// === 14` reads the constant it is checking and proves nothing; setting the floor to 0
// would leave such a claim green. What is NOT circular is that an EMPTIED population is a
// collapse whatever the floor says, so a floor set to zero reddens right here.
claim(collapsed(0, 0) === true, "🔴 an EMPTIED population is a collapse even at floor 0 — this is what makes the floors falsifiable");
claim(collapsed(0, 14) === true, "and at any other floor");
claim(collapsed(13, 14) === true, "below the floor is a collapse");
claim(collapsed(14, 14) === false, "at the floor is not");
claim(collapsed(99, 14) === false, "above it is not");
claim(judge({ ...POP, consts: 0 }, []).failed === true && CONST_FLOOR >= 0,
  "so setting any floor to 0 does not switch its branch off");

// ── 7. THE FLOORS ARE BELOW THE MEASUREMENT, AND THE SKIP LIST COSTS PROSE ───────────
claim(CONST_FLOOR > 0 && OP_FLOOR > 0 && TOOL_FLOOR > 0 && SITE_FLOOR > 0
  && RETURN_FLOOR > 0 && PLANE_FLOOR > 0,
  "every floor is a positive number — a floor of zero is not a floor");
claim(CONST_FLOOR < 25 && OP_FLOOR < 177 && TOOL_FLOOR < 171 && SITE_FLOOR < 1812
  && RETURN_FLOOR < 187 && PLANE_FLOOR <= PLANES.length,
  "🔴 and every floor sits BELOW the tree's own reading — a floor at the measurement reds on the next honest edit");
claim(Object.values(BOUNDARY_SKIP).every((v) => typeof v === "string" && v.length > 20),
  "🔴 every skipped directory carries a written reason (174 §5) — an exclusion that costs nothing is one nobody re-reads");
claim(Object.hasOwn(BOUNDARY_SKIP, "dist") && Object.hasOwn(BOUNDARY_SKIP, "node_modules"),
  "the compiled output and the third-party tree are both out of scope");

// ── 8. THE WIRING, END TO END, AGAINST A FIXTURE THAT CONTAINS A REAL OFFENDER ───────
// 🔴 THE REVERSE SWEEP COULD NOT REACH `main()`, AND THAT IS THE FIFTH TIME. On a healthy
// tree `offenders` is empty, so `judge(pop, offenders)` could be written `judge(pop, [])`
// and every gate in the repo stays green — 173's G3, 174's H5, 175's G3, 176's G10. These
// three files are the smallest tree that contains one real defect: a GDScript operation
// that hard-wires a field, a dispatcher arm naming it, a registration binding a tool to
// that operation, and a probe asserting the constant. If any link in the chain is dropped,
// `run()` stops reporting it and this case reddens.
const root = mkdtempSync(join(tmpdir(), "boundary177-"));
mkdirSync(join(root, "host", "src"), { recursive: true });
mkdirSync(join(root, "addons", "breakpoint_mcp"), { recursive: true });
writeFileSync(join(root, "addons", "breakpoint_mcp", "operations.gd"), [
  "func _dispatch(op, params):",
  "\tmatch op:",
  '\t\t"widget.poke":',
  "\t\t\treturn _widget_poke(params)",
  "",
  "func _widget_poke(params: Dictionary) -> Dictionary:",
  '\tif not params.has("id"):',
  '\t\treturn _err("bad_params", "no id")',
  '\treturn _ok({"poked": true, "id": params.get("id")})',
  "",
].join("\n"));
writeFileSync(join(root, "host", "src", "widget.ts"),
  'server.registerTool("widget_poke", { title: "x" }, async (a) => call("widget.poke", a));\n');
writeFileSync(join(root, "host", "probe.mjs"), [
  'const r = await call("widget_poke", { id: 3 });',
  "r.poked === true ? pass('W') : fail('W');",     // the offender: hard-wired
  "r.id === 3 ? pass('I') : fail('I');",           // honest: `id` is echoed from params, derived
  "",
].join("\n"));

const live = run(join(root, "host"), join(root, "addons", "breakpoint_mcp", "operations.gd"));
claim(live.failed === true, "🔴 run() against a fixture holding one real offender FAILS — the wiring is reachable");
claim(said(live, "BOUNDARY_TAUTOLOGY"), "and it names the tautology rather than only a collapse");
claim(said(live, "_widget_poke"), "and traces tool -> op -> the GDScript function that hard-wired the field");
claim(said(live, "probe.mjs:2"), "🔴 the OFFENDING line, not the honest one two lines down");
claim(said(live, "probe.mjs:3") === false,
  "🔴 and `r.id === 3` is NOT flagged — `id` is built from the request, so that claim can fail");

// 🔴 THE EXIT-CODE MAPPING, WHICH IS THE OTHER HALF OF WHAT `main()` USED TO HIDE.
const quiet = () => {};
claim(report({ lines: [], failed: true }, quiet) === 1, "a failed verdict maps to a nonzero exit");
claim(report({ lines: [], failed: false }, quiet) === 0, "a clean verdict maps to zero");
claim(report({ lines: ["x"], failed: true }, quiet) === 1, "and the lines do not change the code");

// ── 9. 🆕 178: THE ONE HOP, ON BOTH SIDES OF THE DISPATCHER ──────────────────────────
// 🔴 `"ping": return _ok(_ping())` NAMES THE WRAPPER. 177 recorded `_ok` as the handler:
// truthy, so the claim counted as JUDGED, and `_ok` has no fields, so it could never be
// flagged. Judged-but-unjudgeable is the worst reading an instrument can print — it is
// indistinguishable from a clean judgement in every number the gate reported.
const HOP = `
	match op:
		"ping":
			return _ok(_ping())
		"scene.save":
			return _scene_save()

func _ping() -> Dictionary:
	return {
		"pong": true,
		"godot": Engine.get_version_info(),
	}
`;
claim(dispatchMap(HOP).get("ping") === "_ping",
  "🔴 an arm spelled `return _ok(_handler())` resolves to the HANDLER, not to the wrapper");
claim(dispatchMap(HOP).get("ping") !== "_ok", "and specifically not to `_ok` — 177's silent hole");
claim(dispatchMap(HOP).get("scene.save") === "_scene_save", "the ordinary spelling is unchanged");
claim(dispatchMap(`\t\t"x":\n\t\t\treturn _ok({"a": 1})\n`).size === 0,
  "🔴 `return _ok({…})` inline names no handler at all — the arm resolves to NOTHING, not to a guess");
claim(dispatchMap(`\t\t"x":\n\t\t\treturn _err("bad", "no")\n`).size === 0,
  "an arm that only errors is not a reply builder");
claim(hardwired(HOP).fields.get("_ping")?.get("pong") === "true",
  "🔴 and the builder's own plain `return {…}` IS the operation's reply — read through the hop");
claim(hardwired(HOP).fields.get("_ping")?.has("godot") === false,
  "its derived sibling in the same dict is still left alone");

const DELEGATE = `
	match op:
		"main_screen.get":
			return _main_screen_get(params)

func _main_screen_get(params: Dictionary) -> Dictionary:
	return _ok(_main_screen_state())

func _main_screen_state() -> Dictionary:
	return {"active": null, "mode": "editor"}
`;
claim(hardwired(DELEGATE).fields.get("_main_screen_get")?.get("mode") === '"editor"',
  "🔴 a handler that returns `_ok(<builder>())` delegates — the builder's dict is the reply (177 §10.2's twelve)");

// ── 10. 🆕 ABSENCE IS NOT SAMENESS, AND AN UNREADABLE RETURN POISONS ITS OPERATION ───
// 🔴 BOTH OF THESE INVENTED A DEFECT BEFORE THEY WERE WRITTEN DOWN. Widening a population
// is exactly where false positives come from, which is 177 §5's lesson arriving from the
// other direction: the first draft over-reached by NAME, this one by SCOPE.
const ABSENT = `
func _compare(params: Dictionary) -> Dictionary:
	if w != b:
		return _ok({"kind": "diff", "reason": "dimension_mismatch"})
	return _ok({"kind": "diff", "diff_ratio": ratio})
`;
claim(hardwired(ABSENT).fields.get("_compare")?.get("kind") === '"diff"',
  "a field that IS on every reply path with one literal is still hard-wired — the operation is in the map");
claim(hardwired(ABSENT).fields.get("_compare")?.has("reason") === false,
  "🔴 …but a key present on ONE reply path and ABSENT from another is not a constant — `undefined` is the other outcome");

const OPAQUE = `
	match op:
		"asset.gen":
			return _asset_gen(params)

func _asset_gen(params: Dictionary) -> Dictionary:
	if bad:
		return _ok({"format": "ImageTexture", "kind": kind})
	var desc := _build(params)
	return _ok(desc)
`;
claim(hardwired(OPAQUE).fields.has("_asset_gen") === false,
  "🔴 an operation with a return this reader CANNOT read yields NOTHING — 'every path' is unanswerable");
claim(hardwired(OPAQUE).opaque.includes("_asset_gen"),
  "…and it is NAMED in `opaque` rather than silently skipped");
claim(hardwired(HOP).opaque.length === 0, "a fully readable operation is not opaque");
// 🔴 THE THIRD DELEGATION SPELLING, WHICH THIS READER DOES NOT FOLLOW. `_screenshot_diff`
// ends `return _compare_images(...)` — already wrapped, so there is no `_ok({…})` and no
// plain `return {…}` to read. Before 178 it fell out of the loop in SILENCE and its reply
// fields simply did not exist in any number the gate printed. An under-reach that is not
// counted is indistinguishable from coverage, which is 170 §4 in one line.
const UNFOLLOWED = `
	match op:
		"runtime.screenshot_diff":
			return _screenshot_diff(params)

func _screenshot_diff(params: Dictionary) -> Dictionary:
	if vp == null:
		return _err("no_viewport", "no")
	return _compare_images(img, ref, params, reference)
`;
claim(hardwired(UNFOLLOWED).fields.has("_screenshot_diff") === false,
  "an arm target whose reply is built by a spelling this reader cannot follow yields no fields");
claim(hardwired(UNFOLLOWED).opaque.includes("_screenshot_diff"),
  "🔴 …and is COUNTED as opaque rather than skipped in silence");
claim(hardwired(`func _helper(p):\n\treturn {"a": 1}\n`).opaque.length === 0,
  "a function no dispatcher arm names is not opaque — it is simply not an operation");
claim(hardwired(DELEGATE).reads > 0, "`reads` counts the reply dicts actually read — what RETURN_FLOOR pins");
claim(hardwired(`func _x(p): pass\n`).reads === 0, "and a source with no replies reads nothing");

// ── 11. 🆕 THE SECOND COMPARISON IDIOM, WHICH IS WHERE FOUR OF FIVE DEFECTS WERE ─────
// 🔴 177 SHIPPED READING `===` ONLY AND PRINTED THE RESULT AS THE POPULATION.
// `test-integration/` writes `assert.equal(x.f, lit)` about as often, and it is the same
// claim about the same reply. Four of 178's five live tautologies are spelled that way.
const AEQ = comparisons("p.mjs", `const r = await call("runtime_node_add", { type: "Timer" });\nassert.equal(r.added, true, "reports added:true");`);
claim(AEQ.length === 1 && AEQ[0].tool === "runtime_node_add" && AEQ[0].field === "added" && AEQ[0].lit === "true",
  "🔴 `assert.equal(x.f, lit)` is the SAME claim as `x.f === lit` and is found");
claim(AEQ[0].idiom === "assert", "…and is labelled by idiom, so the two populations stay countable apart");
claim(comparisons("p.mjs", `(await call("t")).f === true;`)[0].idiom === "===", "the original idiom keeps its label");
claim(comparisons("p.mjs", `assert.strictEqual((await call("t")).f, 3);`).length === 1, "strictEqual too");
claim(comparisons("p.mjs", `assert.deepEqual((await call("t")).f, { a: 1 });`).length === 0,
  "🔴 deepEqual against an OBJECT is not a literal comparison — this gate's shape is a scalar");
claim(comparisons("p.mjs", `assert.equal(await read("ticks"), 3);`).length === 0,
  "a call result that is not a property access is not a field claim");
claim(comparisons("p.mjs", `assert.equal(r.a, b.c);`).length === 0, "and neither is a comparison against another expression");

// The host envelope is not a field the addon wrote.
const ENV = comparisons("p.mjs", `const r = await call("signal_emit", {});\nassert.equal(r.structuredContent?.emitted, true);`);
claim(ENV.length === 1 && ENV[0].tool === "signal_emit" && ENV[0].field === "emitted",
  "🔴 `r.structuredContent?.emitted` is the same claim as `r.emitted` — the envelope is stripped, optional chaining and all");

// ── 12. 🆕 CONDUITS, AND THE ONE THAT MUST NOT BE FOLLOWED ───────────────────────────
// 🔴 THE SAFETY ARGUMENT IS THE THROW, NOT THE HOP. The tautology exists because `call()`
// throws on isError, so the error paths never reach the comparison. `raw()` does not
// throw, so `r.emitted === true` over a raw() receiver DOES separate success from failure
// and flagging it would be an invented defect. 177 §3's 42 false positives came from a
// "structural" resolution that stopped one hop short; this is the same trap, mirrored.
const CONDUIT_SRC = `
const call = async (name, args = {}) => { const res = await h(name, args); if (res.isError) throw new Error("x"); return res.structuredContent; };
const raw = async (name, args = {}) => h(name, args);
const inject = (event) => call("runtime_inject_input", { event, confirm: true });
const emit = (signal) => raw("runtime_emit_signal", { signal });
const both = (a) => { call("one.thing", a); call("two.thing", a); };
`;
const CD = conduits("p.mjs", CONDUIT_SRC);
claim(CD.get("inject") === "runtime_inject_input", "🔴 a one-expression helper over a THROWING call is followed");
claim(CD.has("emit") === false, "🔴 …and one over `raw()`, which does NOT throw, is NOT — that claim can still fail");
claim(CD.has("both") === false, "a helper reaching two tools is dropped, like an ambiguous registration");
claim(CD.has("call") === false && CD.has("raw") === false, "the base helpers are not conduits to themselves");
const VIA = comparisons("p.mjs", CONDUIT_SRC + `\nconst pressed = await inject({ kind: "action" });\nassert.equal(pressed.injected, true);`, CD);
claim(VIA.some((c) => c.tool === "runtime_inject_input" && c.field === "injected"),
  "🔴 and a receiver bound through the conduit resolves to the tool — 178's fifth defect");
claim(comparisons("p.mjs", `const x = await inject({});\nx.injected === true;`).every((c) => c.tool === null),
  "…while the SAME source with no conduit map resolves to nothing, rather than guessing");

// ── 13. 🆕 179: THE THROWING RULE, ON THE DIRECT SPELLING ────────────────────────────
// 🔴 §12 ABOVE REFUSES `emit`, A WRAPPER OVER `raw()`. 178 SHIPPED WITH THE SAME RECEIVER
// SPELLED OUT — `const r = await raw("runtime_node_add", …)` — RESOLVING FINE, AND JUDGED
// SEVENTEEN OF THEM, every one asserting `.isError === true`. The premise this whole gate
// rests on is "call() throws, so the _err paths never reach the comparison"; over a raw()
// receiver that premise is FALSE and the claim really can fail. Same rule, same file, one
// spelling exempt and the other not.
const H = helpers("p.mjs", CONDUIT_SRC);
claim(H.throwers.has("call") === true && H.throwers.has("raw") === false,
  "🔴 `helpers()` separates the helper that throws on isError from the one that does not — the single fact both rules rest on");
claim(H.defined.has("raw") && H.defined.has("emit") && H.defined.has("h") === false,
  "…and reports only what is DEFINED here: `h` is called but never declared, so nothing is claimed about it");
claim(helpers("p.mjs", `const call = async (n) => { const r = await go(n); if (r.bad) throw new Error("x"); return r; };`).throwers.size === 0,
  "🔴 a helper that throws on something OTHER than isError is not a thrower for this purpose — the premise is about the error envelope, not about throwing");

const RAWSRC = CONDUIT_SRC + `\nconst bad = await raw("runtime_node_add", { type: "Nope" });\nassert.equal(bad.isError, true, "must be an error");`;
const RAWD = comparisons("p.mjs", RAWSRC, conduits("p.mjs", RAWSRC));
claim(RAWD.length === 1 && RAWD[0].tool === null,
  "🔴 a receiver from a DIRECT non-throwing helper resolves to nothing — the rule §12 applies to the hop, applied to the call");
claim(RAWD[0].drop === "nonthrowing", "…and the refusal carries its reason, so it can be counted rather than vanish into `unresolved`");
claim(RAWD[0].wouldBe === "runtime_node_add",
  "🔴 …and what it WOULD have said, because a refusal count is useless without knowing whether it took a real tool away");
const THRSRC = CONDUIT_SRC + `\nconst good = await call("runtime_node_add", { type: "Timer" });\nassert.equal(good.added, true, "reports added");`;
claim(comparisons("p.mjs", THRSRC, conduits("p.mjs", THRSRC)).some((c) => c.tool === "runtime_node_add" && c.drop === null),
  "…and the THROWING helper beside it in the same source still resolves — the rule is inert on everything it should be");
claim(comparisons("p.mjs", `const r = await call("t", {});\nassert.equal(r.f, true);`).some((c) => c.tool === "t"),
  "🔴 and an IMPORTED helper is not refused — refusing what cannot be read is a guess in the other direction");

// ── 14. 🆕 179: THE BINDING MAP IS LEXICALLY SCOPED ──────────────────────────────────
// 🔴 IT WAS ONE FLAT `Map<name, tool>` FOR A WHOLE FILE, AND LAST DECLARATION WON. Twenty
// identifiers in the shipped tree are declared more than once — `r` in six files — nine
// judged claims rested on one, and SIX were judged against an operation other than the one
// that replied: `assert.equal(r.isError, true, "instantiating Object must still be
// not_a_node")` was judged against `_node_remove`.
//
// 🔴 AND THE FIRST FIX WAS TO REFUSE EVERY REUSED NAME — the rule `toolOps()` and
// `conduits()` already apply. The reverse sweep killed it: mutant G19 restores one of the
// five defects 178 fixed, on a `const r` inside a cleanup loop, and the refusal made the
// gate GREEN under it. A correct narrowing can still cost real coverage, and nothing but
// the sweep could have said so.
const TWOBLOCKS = comparisons("p.mjs", [
  `for (const a of xs) {`,
  `  const r = await call("runtime_node_add", { type: "Timer" });`,
  `  assert.equal(r.added, true, "the add reply");`,
  `}`,
  `for (const b of ys) {`,
  `  const r = await call("runtime_node_remove", { path: "y" });`,
  `  assert.equal(r.removed, true, "the remove reply");`,
  `}`,
].join("\n"));
claim(TWOBLOCKS.length === 2,
  "two blocks, two declarations of `r`, two claims");
claim(TWOBLOCKS.find((c) => c.field === "added")?.tool === "runtime_node_add"
   && TWOBLOCKS.find((c) => c.field === "removed")?.tool === "runtime_node_remove",
  "🔴 each `r` resolves to the declaration in ITS OWN block — before 179 both resolved to whichever was read last");
const SHADOW = comparisons("p.mjs", [
  `const r = await call("runtime_node_add", { type: "Timer" });`,
  `{`,
  `  const r = await call("runtime_node_remove", { path: "y" });`,
  `  assert.equal(r.removed, true, "the inner one");`,
  `}`,
  `assert.equal(r.added, true, "the outer one");`,
].join("\n"));
claim(SHADOW.find((c) => c.field === "removed")?.tool === "runtime_node_remove"
   && SHADOW.find((c) => c.field === "added")?.tool === "runtime_node_add",
  "🔴 an inner declaration shadows the outer INSIDE its block and not outside it — the walk goes outward from the use site, not forward from the top of the file");
const OUTER = comparisons("p.mjs", [
  `const r = await call("runtime_node_add", { type: "Timer" });`,
  `for (const a of xs) { assert.equal(r.added, true, "no inner declaration"); }`,
].join("\n"));
claim(OUTER.length === 1 && OUTER[0].tool === "runtime_node_add",
  "…and a use with no declaration in its own scope still finds the enclosing one");

// 🔴 A REASSIGNMENT IS THE ONE AMBIGUITY SCOPE CANNOT RESOLVE. Two `const`s of a name in
// one block is a syntax error, so after scope resolution the ambiguity rule would be dead
// code — except here, where nothing in the source says which reply the later claim is
// about. This is what `ambiguous` counts, and it is 0 in the shipped tree.
const REASSIGN = comparisons("p.mjs", [
  `let r = await call("runtime_node_add", { type: "Timer" });`,
  `r = await call("runtime_node_remove", { path: "y" });`,
  `assert.equal(r.added, true, "which reply is this about?");`,
].join("\n"));
claim(REASSIGN.length === 1 && REASSIGN[0].tool === null && REASSIGN[0].drop === "ambiguous",
  "🔴 a `let` reassigned to a SECOND tool in the same scope resolves to NEITHER, and says why");
const MIX = comparisons("p.mjs", CONDUIT_SRC + [
  ``,
  `let r = await call("runtime_node_add", { type: "Timer" });`,
  `r = await raw("runtime_node_add", { type: "Nope" });`,
  `assert.equal(r.added, true, "the add reply");`,
].join("\n"), conduits("p.mjs", CONDUIT_SRC));
claim(MIX.some((c) => c.field === "added" && c.tool === null && c.drop === "ambiguous"),
  "🔴 …and a name bound to a tool AND to a refused receiver is as ambiguous as two tools — the two rules compose rather than race");

// ── 15. 🆕 BOTH PLANES, END TO END ───────────────────────────────────────────────────
// 🔴 THE HOLE THAT HELD FOUR OF THE FIVE. `runtime_bridge.gd` has its own `_dispatch`,
// its own `_ok`/`_err`, and 22 registered tools resolve into it. 177 read `operations.gd`
// and printed `judged=78` as the population.
claim(PLANES.length === 2 && PLANES.includes("runtime_bridge.gd"),
  "🔴 both addon dispatchers are named — reading one and calling it the population is what 177 did");
const root2 = mkdtempSync(join(tmpdir(), "boundary178-"));
mkdirSync(join(root2, "host", "src"), { recursive: true });
mkdirSync(join(root2, "addons", "breakpoint_mcp"), { recursive: true });
writeFileSync(join(root2, "addons", "breakpoint_mcp", "operations.gd"),
  'func _dispatch(op, params):\n\tmatch op:\n\t\t"editor.noop":\n\t\t\treturn _editor_noop(params)\n\nfunc _editor_noop(params: Dictionary) -> Dictionary:\n\treturn _ok({"seen": params.get("x")})\n');
writeFileSync(join(root2, "addons", "breakpoint_mcp", "runtime_bridge.gd"),
  'func _dispatch(op, params):\n\tmatch op:\n\t\t"runtime.node_remove":\n\t\t\treturn _node_remove(params)\n\nfunc _node_remove(params: Dictionary) -> Dictionary:\n\tif node == null:\n\t\treturn _err("bad_path", "no")\n\treturn _ok({"removed": true, "path": p})\n');
writeFileSync(join(root2, "host", "src", "rt.ts"),
  'server.registerTool("runtime_node_remove", { title: "x" }, async (a) => call("runtime.node_remove", a));\n');
writeFileSync(join(root2, "host", "probe.mjs"), [
  'const call = async (n, a) => { const r = await h(n, a); if (r.isError) throw new Error("x"); return r.structuredContent; };',
  'const rm = (path) => call("runtime_node_remove", { path, confirm: true });',
  'const r = await rm("Host/Thing");',
  'assert.equal(r.removed, true, "a successful node_remove reports removed:true");',
  'assert.equal(r.path, "Host/Thing", "the reply echoes the path removed");',
  "",
].join("\n"));
const live2 = run(join(root2, "host"), [
  join(root2, "addons", "breakpoint_mcp", "operations.gd"),
  join(root2, "addons", "breakpoint_mcp", "runtime_bridge.gd"),
]);
claim(live2.failed === true,
  "🔴 all four of 178's holes at once — second plane, assert idiom, conduit hop, envelope — and run() still reddens");
claim(said(live2, "BOUNDARY_TAUTOLOGY"),
  "🔴 and it reddens on the TAUTOLOGY, not merely on the fixture's small population");
claim(said(live2, "probe.mjs:4"), "the offending line is named");
claim(said(live2, "runtime_bridge.gd"), "🔴 and the PLANE it came from, because 177 could not have said this");
claim(said(live2, "probe.mjs:5") === false,
  "🔴 and `r.path` two lines down is NOT flagged — `path` is computed by the addon, so that claim can fail");
claim(said(live2, "planes=2/"), "the population line reports both planes were read");
claim(run(join(root2, "host"), join(root2, "addons", "breakpoint_mcp", "operations.gd")).failed === true,
  "🔴 and pointing it at ONE plane reddens on the PLANES floor rather than reporting a clean tree");

// ── 16. 🆕 179: BOTH NEW REFUSALS, END TO END THROUGH run() ──────────────────────────
// 🔴 EVERY CLAIM IN §13 AND §14 DRIVES `comparisons()` DIRECTLY, AND THAT IS NOT THE WIRE.
// The refusal has to survive `scan()` — which is where the `wouldBe` filter lives — and
// reach the population line `judge()` prints. 178's own lesson (G9/G10): a term only ever
// exercised one level below the composition is a term the composition can drop.
const root3 = mkdtempSync(join(tmpdir(), "boundary179-"));
mkdirSync(join(root3, "host", "src"), { recursive: true });
mkdirSync(join(root3, "addons", "breakpoint_mcp"), { recursive: true });
writeFileSync(join(root3, "addons", "breakpoint_mcp", "operations.gd"),
  'func _dispatch(op, params):\n\tmatch op:\n\t\t"editor.noop":\n\t\t\treturn _editor_noop(params)\n\nfunc _editor_noop(params: Dictionary) -> Dictionary:\n\treturn _ok({"seen": params.get("x")})\n');
writeFileSync(join(root3, "addons", "breakpoint_mcp", "runtime_bridge.gd"),
  'func _dispatch(op, params):\n\tmatch op:\n\t\t"runtime.node_add":\n\t\t\treturn _node_add(params)\n\t\t"runtime.node_remove":\n\t\t\treturn _node_remove(params)\n\nfunc _node_add(params: Dictionary) -> Dictionary:\n\tif bad:\n\t\treturn _err("x", "y")\n\treturn _ok({"added": true, "path": p})\n\nfunc _node_remove(params: Dictionary) -> Dictionary:\n\treturn _ok({"removed": true, "path": p})\n');
writeFileSync(join(root3, "host", "src", "rt.ts"), [
  'server.registerTool("runtime_node_add", { title: "x" }, async (a) => call("runtime.node_add", a));',
  'server.registerTool("runtime_node_remove", { title: "x" }, async (a) => call("runtime.node_remove", a));',
  "",
].join("\n"));
writeFileSync(join(root3, "host", "probe.mjs"), [
  'const call = async (n, a) => { const r = await h(n, a); if (r.isError) throw new Error("x"); return r.structuredContent; };',
  'const raw = async (n, a) => h(n, a);',
  'const parseLedger = (src) => src.split("\\n");',
  // (1) a raw() receiver naming a REGISTERED tool over a HARD-WIRED field. Without the
  //     throwing rule this is a BOUNDARY_TAUTOLOGY; with it, one `nonthrowing` refusal.
  'const bad = await raw("runtime_node_add", { type: "Nope" });',
  'assert.equal(bad.added, true, "would be a tautology if raw() were followed");',
  // (2) a non-throwing helper whose string argument was never a tool. Refused for the same
  //     reason and counted for NEITHER — this is the pair that pins the `wouldBe` filter.
  'const led = parseLedger("tool\\tpath");',
  'assert.equal(led.length, 1, "not a bridge reply at all");',
  // (3) one identifier REASSIGNED to a second tool in the same scope, over a field the
  //     first operation hard-wires. Scope resolution cannot help here and must not guess.
  'let amb = await call("runtime_node_add", { type: "Timer" });',
  'amb = await call("runtime_node_remove", { path: "x" });',
  'assert.equal(amb.added, true, "which reply is this about?");',
  "",
].join("\n"));
const live3 = run(join(root3, "host"), [
  join(root3, "addons", "breakpoint_mcp", "operations.gd"),
  join(root3, "addons", "breakpoint_mcp", "runtime_bridge.gd"),
]);
claim(live3.lines.some((l) => /nonthrowing=1\b/.test(l)),
  "🔴 the raw() refusal survives scan() and prints — and the `parseLedger` refusal beside it does NOT, because its string was never a registered tool");
claim(live3.lines.some((l) => /ambiguous=1\b/.test(l)),
  "🔴 and the REASSIGNED identifier is refused and counted, rather than judged against whichever binding was read last");
claim(live3.lines.some((l) => /judged=0\//.test(l)),
  "…and with both refusals applied this fixture resolves NOTHING — every receiver in it is one of the two shapes");
claim(live3.failed === true && live3.lines.some((l) => l.includes("BOUNDARY_JUDGED_COLLAPSE")),
  "🔴 which reddens on the JUDGED floor rather than printing `ok — 0 judged claim(s)`, as it would have before 179");
claim(live3.lines.some((l) => l.includes("BOUNDARY_TAUTOLOGY")) === false,
  "🔴 and NOT on a tautology — `bad.added === true` over a raw() receiver really can fail, and inventing a defect there is 177 §5 again");

// ── the floor on this file's own population ──────────────────────────────────────────
// 🔴 PINNED, BECAUSE AN UNPINNED CLAIM FLOOR IS A SWITCH — 176 §8's G11, which found this
// exact literal deletable in `verdict_gate.selftest.mjs`. `if (ran < CLAIM_FLOOR)` is one
// branch reading one constant, and nothing else in the file mentions it: setting it to 0
// left every case green while the file still printed a passing line.
claim(CLAIM_FLOOR >= 118, "🔴 the claim floor is pinned — setting it to zero reddens HERE, not silently");
if (ran < CLAIM_FLOOR) {
  console.log(`🔴 BOUNDARY_SELFTEST_COLLAPSE ${ran} < ${CLAIM_FLOOR} — cases went missing rather than failing.`);
  bad++;
}
console.log(`BOUNDARY_SELFTEST ${ran} claim(s), ${bad} failed`);
process.exit(bad ? 1 : 0);
