#!/usr/bin/env node
// boundary_gate.selftest.mjs — session 177.
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
  dispatchMap, hardwired, toolOps, comparisons, judge, collapsed, run, report,
  CONST_FLOOR, OP_FLOOR, TOOL_FLOOR, SITE_FLOOR, BOUNDARY_SKIP,
} from "./boundary_gate.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
// 🔴 NAMED AND PINNED — 176 §8's G11. A bare `if (ran < 42)` is a floor read by one branch
// and asserted by nothing, so it can be set to zero and this whole file goes green while
// still printing a passing line. The floor that protects the floors.
const CLAIM_FLOOR = 55;

const said = (r, needle) => r.lines.some((l) => l.includes(needle));
const POP = { consts: 99, ops: 999, tools: 999, sites: 9999, judged: 99, unresolved: 0 };

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
claim(hardwired(ONE).get("_filesystem_scan")?.get("scanning") === "true",
  "a field that is a literal on the only return path is hard-wired");

const DERIVED = `
func _resource_load(params: Dictionary) -> Dictionary:
	return _ok({"type": res.get_class()})
`;
claim(hardwired(DERIVED).has("_resource_load") === false,
  "🔴 a field computed from the engine is NOT hard-wired — this is the six false positives");

const MIXED = `
func _thing(params: Dictionary) -> Dictionary:
	if params.get("x"):
		return _ok({"state": "on"})
	return _ok({"state": mode})
`;
claim(hardwired(MIXED).has("_thing") === false,
  "🔴 a field that is literal on ONE path and derived on another CAN vary — not hard-wired");

const TWO_SAME = `
func _thing(params: Dictionary) -> Dictionary:
	if params.get("x"):
		return _ok({"state": "on"})
	return _ok({"state": "on"})
`;
claim(hardwired(TWO_SAME).get("_thing")?.get("state") === '"on"',
  "the same literal on every path is still one value nothing can change");

const TWO_DIFF = `
func _thing(params: Dictionary) -> Dictionary:
	if params.get("x"):
		return _ok({"state": "on"})
	return _ok({"state": "off"})
`;
claim(hardwired(TWO_DIFF).has("_thing") === false,
  "two DIFFERENT literals are a value that varies — a claim over it can fail");

const ERRPATH = `
func _thing(params: Dictionary) -> Dictionary:
	if not ok:
		return _err("bad_params", "no")
	return _ok({"done": true})
`;
claim(hardwired(ERRPATH).get("_thing")?.get("done") === "true",
  "🔴 an _err path does not rescue the field — call() throws before the comparison is reached");

const MULTILINE = `
func _thing(params: Dictionary) -> Dictionary:
	return _ok({
		"path": path,
		"type": "Environment",
	})
`;
claim(hardwired(MULTILINE).get("_thing")?.get("type") === '"Environment"',
  "the multi-line dict spelling is read too — one shape of the same return");
claim(hardwired(MULTILINE).get("_thing")?.has("path") === false,
  "and its derived sibling in the same dict is left alone");
claim(hardwired(`func _thing(p): pass\n`).size === 0, "an operation with no _ok() contributes nothing");

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
claim(said(judge({ ...POP, judged: 5 }, []), "5 judged claim(s)"), "the ok line reports how many claims it actually judged");
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
claim(judge({ consts: 1, ops: 1, tools: 1, sites: 1, judged: 0, unresolved: 0 }, []).failed === true,
  "🔴 all four at once is still four separate failures, not one — a partial collapse is the dangerous one");

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
claim(CONST_FLOOR > 0 && OP_FLOOR > 0 && TOOL_FLOOR > 0 && SITE_FLOOR > 0,
  "every floor is a positive number — a floor of zero is not a floor");
claim(CONST_FLOOR < 17 && OP_FLOOR < 155 && TOOL_FLOOR < 171 && SITE_FLOOR < 876,
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

// ── the floor on this file's own population ──────────────────────────────────────────
// 🔴 PINNED, BECAUSE AN UNPINNED CLAIM FLOOR IS A SWITCH — 176 §8's G11, which found this
// exact literal deletable in `verdict_gate.selftest.mjs`. `if (ran < CLAIM_FLOOR)` is one
// branch reading one constant, and nothing else in the file mentions it: setting it to 0
// left every case green while the file still printed a passing line.
claim(CLAIM_FLOOR >= 46, "🔴 the claim floor is pinned — setting it to zero reddens HERE, not silently");
if (ran < CLAIM_FLOOR) {
  console.log(`🔴 BOUNDARY_SELFTEST_COLLAPSE ${ran} < ${CLAIM_FLOOR} — cases went missing rather than failing.`);
  bad++;
}
console.log(`BOUNDARY_SELFTEST ${ran} claim(s), ${bad} failed`);
process.exit(bad ? 1 : 0);
