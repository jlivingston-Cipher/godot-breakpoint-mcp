#!/usr/bin/env node
// wire_diff.mjs — CHECK 8, AND IT IS THE PROJECTION NO RELEASE CHECK HAD.
//
// THE STANDING QUESTION, carried verbatim through nine release cuts: "what does this
// reader PROJECT its population onto, and what is invisible in that projection?"
//
// The tenth asking, and it did not need a level down or a level out — it needed the
// question pointed at all seven readers AT ONCE. Checks 1-7 project onto, in order:
// a CONSTANT ROSTER in the changelog text (1), `git diff -- host/src` (2), the
// tarball's ROOTS (3), its ENTRY NAMES in both directions (4, 5), its ENTRY BYTES (6),
// and the PUBLISHED package (7).
//
// 🔴 EVERY ONE OF THEM PROJECTS ONTO A FILE. Not one projects onto the WIRE — the
// `tools/list` payload, which is the entire public API of an MCP server and the only
// thing the MINOR/PATCH question is actually about.
//
// THE PROXY FOR IT IS CHECK 2, AND A PROXY IS WHAT IT IS. `git diff -- host/src` is
// empty exactly when no code shipped; on any release that contains work it goes red and
// hands the question back to a human. Measured over the 33 release windows from v1.40.0,
// building every tag and reading its live surface:
//
//     v1.48.0..v1.49.0   check 2 RED    wire MOVED       agree
//     v1.49.0..v1.50.0   check 2 RED    wire MOVED       agree
//     v1.50.0..v1.72.8   check 2 GREEN  wire IDENTICAL   agree   (32 windows, byte-for-byte)
//     v1.72.8..HEAD      check 2 RED    wire UNMOVED     🔴 DISAGREE
//
// A disagreement population of one is thin, and it is NOT the reason this ships. The
// reason is structural and #256 is the proof of it: 🔴 CHECK 2's POPULATION IS SOURCE
// THIS REPOSITORY AUTHORED, AND THE WIRE CARRIES BYTES IT DID NOT. `$schema: draft-07`
// rode the wire for fifty releases, nobody here wrote it, and no check could see it,
// because the byte was the SDK's. An SDK bump inside the declared caret range moves every
// schema on the wire and leaves all seven checks green — check 3 reads
// `host/package.json`, and a caret range does not move when the resolution inside it does.
//
// SO THIS READS THE WIRE ITSELF, at a baseline ref and at HEAD, and CLASSIFIES the
// difference. It does not decide the release: it answers MINOR/PATCH/MAJOR from the
// public API and leaves the assertion to the caller, the same split registry_lag.py uses.
// 🔴 Unreachable is RED — a baseline that will not build is not evidence of anything.
//
// Run:  node scripts/wire_diff.mjs [--baseline <ref>] [--summary]
//       node scripts/wire_diff.selftest.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOST_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = path.dirname(HOST_DIR);

// 🔴 THE FLOOR, AND IT IS THE ONLY NUMBER IN THIS FILE. A classifier over two empty
// surfaces reports "nothing moved" and passes — the exact silence scope_gate.py exists
// to refuse. Two servers that failed to start agree perfectly.
export const SURFACE_FLOOR = 200;

// 🆕 211 §4 — AND IT WAS NOT THE ONLY NUMBER THIS FILE NEEDED. The caption above says
// "THE ONLY NUMBER IN THIS FILE" and it was a boast about the thing that was missing:
// `SURFACE_FLOOR` floors the TOOL NAMES. Nothing floored the SCHEMA PATHS.
//
// 🔴 MEASURED, `probe211.mjs`: blind `shapeOf` on BOTH sides — which is the realistic
// failure, because it is ONE function applied to both surfaces — and `os`/`ns` are empty
// for every tool, both loops iterate zero times, `major` and `minor` stay empty, the
// verdict is PATCH and the exit code is 0. `SURFACE_FLOOR` is fully satisfied by 291
// tool NAMES. "The wire did not move" and "I read no schema" are the SAME OUTPUT — and
// `release<N>.py` asserts `WIRE_VERDICT == BUMP` against that output.
//
// A one-sided collapse is loud: it reads as mass removal and classifies MAJOR. The
// SYMMETRIC one is silent, and it is the one an SDK upgrade produces — `properties`
// relocating under `$defs`, a wrapper envelope, a `$ref` indirection this walker does
// not follow. `boundary_gate.mjs` ships `JUDGED_FLOOR` for exactly this shape and says
// why: every other floor there pins an INPUT, and none of them pins the OUTPUT.
//
// Measured 2,451 paths on the DEFAULT surface (278 tools) and 2,576 privileged. Floored
// from below against the smaller of the two, because the default is the one most clients
// pay and the one this check must not stop reading first.
export const SHAPE_FLOOR = 2000;

// ── normalisation: what this repository AUTHORED, and nothing else ───────────────────
// 🔴 `execution` IS NORMALISED, NOT DROPPED, AND THE DIFFERENCE IS THE POINT. The spec
// makes an ABSENT `execution` mean `taskSupport: "forbidden"`, so absence and the
// explicit default are the same wire meaning and #256's removal of 288 of them is
// invisible here — correctly. A tool going "optional" -> "forbidden" is NOT invisible,
// and dropping the key wholesale would have hidden it.
export const effectiveTaskSupport = (tool) =>
  tool?.execution?.taskSupport ?? "forbidden";

// 🔴 AND THERE IS NO `$schema` STRIP, WHICH IS 208 §3 ARRIVING INSIDE THE FILE WRITTEN
// TO HONOUR IT. The first draft of this function walked the whole tool object deleting
// every key named `$schema` at any depth, so that #256's removal would not read as a
// change. Two things were wrong with it and the second is the one that matters:
//
//   DEAD — `classify` compares SHAPES (through `shapeOf`, which descends `properties`)
//          and PROSE. It never compares a raw schema object, so a dialect declaration
//          cannot reach a comparison whether it is stripped or not. The strip changed
//          no verdict this file can produce.
//   WORSE — a tool whose own input carries a property NAMED `$schema` would have had it
//          deleted before `shapeOf` ever saw it, and removing that property in a later
//          release would have classified as PATCH. A blind spot, bought with a
//          transform that was buying nothing.
//
// That is exactly 208 §3's `scene_get_dependencies` finding: a walker that cannot tell
// an author's vocabulary from the protocol's. It was found here by asking what blinding
// the function would redden — nothing — which is the instrument gate's question, asked
// before the gate could ask it.
export function normalise(tool) {
  const { execution, ...rest } = tool ?? {};
  return { ...rest, taskSupport: effectiveTaskSupport(tool) };
}

// ── the shape a client codes against ─────────────────────────────────────────────────
// 🔴 A STRING, NOT THE SUBTREE. Comparing schema subtrees verbatim makes every
// description edit a type change, and a reader that calls everything a change tells you
// nothing. This names the one property of a field a caller cannot ignore.
// 🆕 211 §3 — AND THE VALUE IS PART OF THE TYPE WHEN THE VALUE IS ALL THERE IS.
// The three lines this block replaces read `enum(${v.enum.length})`, `"const"` and
// `anyOf(${v.anyOf.length})` — a COUNT of the branches and, for `const`, not even that.
// Measured (`probe211.mjs`): `const:"v1"` -> `const:"v2"` and `enum:["a","b"]` ->
// `enum:["x","y"]` both produce IDENTICAL shape maps, zero diffs, verdict PATCH, exit 0.
// Every one of those breaks a validating caller, and `major` could not contain them.
//
// 🔴 THIS IS 210 §16's RULE POINTED AT CHECK 8 ITSELF. The reader's population was
// "which JSON Schema keyword names this field", and the answer "the accepted values
// changed" was not in it — by construction, and it looked like a clean PATCH rather
// than an error. The one reader in the release that projects onto what a client
// consumes could not see the narrowest thing a client consumes.
//
// A DIGEST rather than the members, and that is the same argument as the function's
// original one: comparing subtrees verbatim makes every edit a change. A digest is
// stable, bounded, and moves on exactly the event a caller cares about.
const digest = (v) => {
  const s = JSON.stringify(v);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

// 🔴 THE CONSTRAINT KEYWORDS ARE THE SAME FINDING ONE KEYWORD OVER. `{type:"string"}`
// answers `"string"` whether or not a `pattern` narrowed it, so TIGHTENING a live field
// — `minimum` 0 -> 99, a new `pattern`, `maxLength` halved — classified as PATCH. These
// are appended rather than replacing the type, so a widening still reads as the same
// base type with a different constraint fingerprint and lands in `major` for a human.
const CONSTRAINTS = ["pattern", "format", "minimum", "maximum", "exclusiveMinimum",
  "exclusiveMaximum", "minLength", "maxLength", "minItems", "maxItems", "multipleOf",
  "additionalProperties", "uniqueItems"];

export function typeName(v) {
  if (!v || typeof v !== "object") return "unknown";
  const narrowed = CONSTRAINTS.filter((k) => v[k] !== undefined);
  const suffix = narrowed.length
    ? `+${digest(Object.fromEntries(narrowed.map((k) => [k, v[k]])))}`
    : "";
  if (v.type !== undefined) {
    const base = Array.isArray(v.type) ? [...v.type].sort().join("|") : String(v.type);
    return base + suffix;
  }
  if (Array.isArray(v.enum)) return `enum(${v.enum.length}:${digest([...v.enum].sort())})${suffix}`;
  if (v.const !== undefined) return `const(${digest(v.const)})${suffix}`;
  if (Array.isArray(v.anyOf)) return `anyOf(${v.anyOf.length}:${digest(v.anyOf.map(typeName))})${suffix}`;
  if (Array.isArray(v.oneOf)) return `oneOf(${v.oneOf.length}:${digest(v.oneOf.map(typeName))})${suffix}`;
  if (typeof v.$ref === "string") return `ref:${v.$ref}${suffix}`;
  return "unknown" + suffix;
}

// path -> { type, required }. Nested objects and array items are walked, because a
// caller codes against `{a: {b: string}}` exactly as much as against `{a: object}`.
export function shapeOf(schema, prefix = "", out = new Map()) {
  if (!schema || typeof schema !== "object") return out;
  const props = schema.properties;
  if (props && typeof props === "object") {
    const req = new Set(Array.isArray(schema.required) ? schema.required : []);
    for (const [k, v] of Object.entries(props)) {
      const p = prefix ? `${prefix}.${k}` : k;
      out.set(p, { type: typeName(v), required: req.has(k) });
      shapeOf(v, p, out);
      if (v && typeof v === "object" && v.items) shapeOf(v.items, `${p}[]`, out);
    }
  }
  return out;
}

// ══ 🆕 233 — THE DISCOVER HALF, AND `CONSTRAINTS` IS THE ROSTER IT IS ABOUT ══════════
//
// 🔴 A KEYWORD THIS LIST DOES NOT NAME MAKES TWO DIFFERENT SCHEMAS PRODUCE THE SAME NAME.
// `typeName` narrows on `CONSTRAINTS` and on nothing else, so `{type:"object",
// minProperties:1}` and `{type:"object", minProperties:9}` are one string to it — and
// `classify` compares STRINGS. The failure is not "a constraint goes unreported": it is
// **`WIRE_VERDICT PATCH` over a change that breaks callers**, printed by the one reader
// in this repository whose whole subject is the public API. Every other roster here fails
// loud; this one fails by agreeing with itself.
//
// 🔴 MEASURED OVER THE LIVE WIRE BEFORE A LINE OF THIS WAS WRITTEN — 279 tools, 3,282
// schema nodes, 17 distinct keys, and **zero** that `typeName` cannot read. So the live
// population is EMPTY and the rule is proved on fixtures rather than on a population,
// which is `instrument_gate.py`'s U1 lesson arriving in a fourth file. An empty answer
// from a healthy tree is the one result that says nothing about the reader.
//
// 🔴 AND EVERY KEY IS IN EXACTLY ONE OF THREE TABLES, because "the rest" is not a
// category a reader can argue with. Read for identity, read for structure, or declared
// not to constrain a value — with the reason, per row.
export const NOT_A_CONSTRAINT = {
  description: "prose. It moves what a MODEL sees, which is real and is why PATCH exists as "
    + "a verdict at all, but it breaks no caller — the split this whole file is about",
  title: "prose, the same class as description",
  $comment: "prose, and not emitted to clients by any conformant reader",
  $schema: "the dialect declaration. #256 is the reason it is named rather than ignored: it "
    + "rode the wire for fifty releases and nobody here wrote it, so it is the SDK's byte "
    + "and a change to it is an SDK event this reader must not attribute to us",
  default: "advisory. A caller that omits the property gets the server's behaviour either "
    + "way; the schema stating it does not change what the server accepts",
  examples: "documentation, carried alongside the schema and read by no validator",
  deprecated: "an annotation. It marks a member for future removal; the removal is the "
    + "caller-visible event and `shapeOf` reports it as one when it happens",
  readOnly: "an annotation about direction, not about the values accepted",
  writeOnly: "an annotation about direction, not about the values accepted",
};
// Read by `typeName` for IDENTITY rather than for narrowing, and by `shapeOf` for the walk.
export const STRUCTURAL = ["type", "enum", "const", "anyOf", "oneOf", "$ref",
  "properties", "required", "items"];
// 🔴 TWO FLOORS, NEVER A SUM (172 §6). A surface that fails to start yields zero nodes and
// every key is trivially accounted for; a surface that still yields 3,282 nodes while the
// key walk stops descending into `properties` reads seventeen keys off the top level only,
// and the node count cannot see it. Floored from BELOW (198 §36).
export const KEY_FLOOR = 10;
export const NODE_FLOOR = 1500;

/** Every key on every schema node reachable from the wire, with how often it occurs. */
export function schemaKeys(tools) {
  const keys = new Map();
  let nodes = 0;
  const visit = (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return;
    nodes++;
    for (const k of Object.keys(v)) keys.set(k, (keys.get(k) ?? 0) + 1);
    for (const [k, c] of Object.entries(v)) {
      if (k === "properties" && c && typeof c === "object") Object.values(c).forEach(visit);
      else if (["items", "additionalProperties", "not", "if", "then", "else",
        "contains", "propertyNames"].includes(k)) visit(c);
      else if (["anyOf", "oneOf", "allOf", "prefixItems"].includes(k) && Array.isArray(c)) c.forEach(visit);
    }
  };
  for (const t of tools ?? []) { visit(t?.inputSchema); visit(t?.outputSchema); }
  return { keys, nodes };
}

/**
 * PURE over its inputs (174 §8), so the self-test can hand it a wire that cannot exist.
 * On a healthy tree every list below is empty, which is exactly when a collector's filter
 * deletes invisibly.
 */
export function keyProblems({ keys, nodes }, constraints = CONSTRAINTS, structural = STRUCTURAL, excused = NOT_A_CONSTRAINT, keyFloor = KEY_FLOOR, nodeFloor = NODE_FLOOR, name = typeName) {
  const problems = [];
  const read = new Set([...constraints, ...structural]);
  for (const k of [...keys.keys()].sort()) {
    if (read.has(k) || k in excused) continue;
    problems.push(`WIRE_DIFF_KEY UNREAD ${JSON.stringify(k)} — it appears on ${keys.get(k)} `
      + `schema node(s) and typeName() narrows on none of it, so two schemas differing ONLY `
      + `in it produce the same name and classify() reports PATCH over a change a caller `
      + `can feel. Add it to CONSTRAINTS, or a row to NOT_A_CONSTRAINT saying why it cannot `
      + `narrow what the server accepts`);
  }
  for (const k of Object.keys(excused).sort()) {
    if (read.has(k)) {
      problems.push(`WIRE_DIFF_KEY BOTH ${JSON.stringify(k)} — declared not to constrain a `
        + `value AND read as one. One of the two is wrong and this file cannot decide which`);
    }
  }
  // 🔴 THE POSITIVE CONTROL ON THE ROSTER ITSELF, which is what makes the list above a
  // claim rather than a hope: every declared constraint must actually MOVE the name when
  // its value moves. A row nobody proved is a row `typeName` may already be ignoring.
  for (const k of constraints) {
    if (name({ type: "object", [k]: 1 }) === name({ type: "object", [k]: 99 })) {
      problems.push(`WIRE_DIFF_KEY UNPROVED ${JSON.stringify(k)} — CONSTRAINTS names it and `
        + `typeName() gives the SAME name to two schemas that differ in it. The roster says `
        + `this keyword is read and the reader does not read it`);
    }
  }
  if (nodes < nodeFloor) {
    // 🔴 THE OBSERVATION, NOT A CAUSE (228 §7.17): the surface may have shrunk, or the
    // walk may have stopped descending, and a count cannot separate those.
    problems.push(`WIRE_DIFF_KEY NODE_FLOOR ${nodes} < ${nodeFloor} — fewer schema nodes than `
      + `the floor. The surface may have shrunk or this walk may have stopped descending into `
      + `it; either way every key above is read off a population too small to contain the one `
      + `that matters`);
  }
  if (keys.size < keyFloor) {
    problems.push(`WIRE_DIFF_KEY KEY_FLOOR ${keys.size} < ${keyFloor} distinct key(s) over `
      + `${nodes} node(s) — the walk may be reading fewer kinds of node, or Object.keys may `
      + `be reaching none of them, and the node count above cannot see the second`);
  }
  return problems;
}

// ── the classification ───────────────────────────────────────────────────────────────
// MAJOR — a caller that worked against the baseline can now fail: something it reads or
//         sends is gone, changed type, or became mandatory.
// MINOR — new surface a caller may use and could not before. Additive, in both schemas.
// PATCH — prose only, or nothing at all. Descriptions and titles move what a MODEL sees,
//         which is real, but it breaks no caller and it is not a version-number event.
export function classify(before, after) {
  const b = new Map((before ?? []).map((t) => [t?.name, normalise(t)]));
  const a = new Map((after ?? []).map((t) => [t?.name, normalise(t)]));

  // 🔴 THE COLLAPSE, REFUSED LOUDLY AND BEFORE ANY COMPARISON. Two servers that never
  // answered produce two empty maps and a clean bill of health.
  if (b.size < SURFACE_FLOOR || a.size < SURFACE_FLOOR) {
    throw new Error(
      `WIRE_DIFF POPULATION COLLAPSED — baseline ${b.size} tool(s), current ${a.size}, `
      + `floor ${SURFACE_FLOOR}. A surface this small is a server that did not start or a `
      + `read that stopped working, NOT a release that removed everything. Read both `
      + `tools/list payloads by hand before touching this floor.`);
  }

  const major = [], minor = [], patch = [];
  let pathsBefore = 0, pathsAfter = 0;
  for (const n of b.keys()) if (!a.has(n)) major.push(`TOOL REMOVED  ${n}`);
  for (const n of a.keys()) if (!b.has(n)) minor.push(`TOOL ADDED  ${n}`);

  for (const [n, t] of a) {
    const o = b.get(n);
    if (!o) continue;
    for (const key of ["inputSchema", "outputSchema"]) {
      if (o[key] !== undefined && t[key] === undefined) {
        major.push(`${n}: ${key} REMOVED`);
        continue;
      }
      if (o[key] === undefined && t[key] !== undefined) {
        minor.push(`${n}: ${key} ADDED`);
        continue;
      }
      const os = shapeOf(o[key]), ns = shapeOf(t[key]);
      pathsBefore += os.size;
      pathsAfter += ns.size;
      for (const [p, ov] of os) {
        const nv = ns.get(p);
        if (!nv) { major.push(`${n}: ${key}.${p} REMOVED`); continue; }
        if (nv.type !== ov.type) major.push(`${n}: ${key}.${p} type ${ov.type} -> ${nv.type}`);
        if (nv.required && !ov.required) major.push(`${n}: ${key}.${p} became REQUIRED`);
        if (!nv.required && ov.required) minor.push(`${n}: ${key}.${p} no longer required`);
      }
      for (const p of ns.keys()) if (!os.has(p)) minor.push(`${n}: ${key}.${p} ADDED`);
    }
    if (o.taskSupport !== t.taskSupport) {
      minor.push(`${n}: taskSupport ${o.taskSupport} -> ${t.taskSupport}`);
    }
    if (JSON.stringify(o.annotations) !== JSON.stringify(t.annotations)) {
      minor.push(`${n}: annotations moved`);
    }
    if (o.description !== t.description) patch.push(`${n}: description moved`);
    if (o.title !== t.title) patch.push(`${n}: title moved`);
  }

  // 🆕 211 §4 — THE FLOOR ON WHAT WAS READ, NOT ON WHAT WAS FOUND. Placed AFTER the
  // comparison because the count is a by-product of it, and refused as a THROW for the
  // same reason `SURFACE_FLOOR` is: a reader that read nothing has not answered the
  // question, and "PATCH" is an answer. 🔴 BOTH SIDES, because a symmetric collapse is
  // the silent one — see the constant's own note.
  if (pathsBefore < SHAPE_FLOOR || pathsAfter < SHAPE_FLOOR) {
    throw new Error(
      `WIRE_DIFF SHAPE POPULATION COLLAPSED — baseline read ${pathsBefore} schema path(s), `
      + `current ${pathsAfter}, floor ${SHAPE_FLOOR}, across ${a.size} tool(s) that passed `
      + `SURFACE_FLOOR. \`shapeOf\` descends \`properties\` and array \`items\` and nothing `
      + `else: an SDK that relocates schemas under \`$defs\`, wraps them in an envelope, or `
      + `moves to \`$ref\` indirection empties this population on BOTH sides at once and `
      + `every comparison below silently becomes a no-op returning PATCH. Read one `
      + `tools/list payload by hand and fix \`shapeOf\` before touching this floor — the `
      + `verdict this file produces is what \`release<N>.py\` pins the bump to.`);
  }

  const verdict = major.length ? "MAJOR" : minor.length ? "MINOR" : "PATCH";
  return {
    verdict, major, minor, patch,
    moved: major.length + minor.length + patch.length,
    counts: { before: b.size, after: a.size },
    paths: { before: pathsBefore, after: pathsAfter, floor: SHAPE_FLOOR },
  };
}

// ── live read ────────────────────────────────────────────────────────────────────────
// 🔴 THE BASELINE IS BUILT, NOT ASSUMED. A tag's `dist/` is not in the repository and the
// published tarball is not the tag, so the only honest baseline is the ref compiled here,
// now, and driven over stdio exactly the way a client drives it.
export async function surface(entry, env) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } =
    await import("@modelcontextprotocol/sdk/client/stdio.js");
  const transport = new StdioClientTransport({
    command: "node", args: [entry], cwd: path.dirname(path.dirname(entry)),
    env: { ...process.env, ...env }, stderr: "ignore",
  });
  const client = new Client({ name: "wire-diff", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  const tools = [];
  let cursor;
  do {
    const page = await client.listTools(cursor ? { cursor } : {});
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  await client.close();
  return tools;
}

const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: "utf8" });

function buildBaseline(ref) {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), "wire_diff_"));
  fs.rmSync(wt, { recursive: true, force: true });   // git wants the path absent
  const add = run("git", ["worktree", "add", "--detach", wt, ref], REPO_DIR);
  if (add.status !== 0) {
    throw new Error(`could not check out baseline ${ref}: ${add.stderr || add.stdout}`);
  }
  // 🔴 THE CURRENT node_modules, DELIBERATELY. `npm ci` in the worktree would resolve the
  // baseline's caret ranges against today's registry, so the two surfaces would differ by
  // whatever the SDK shipped since — a dependency diff wearing an API diff's clothes.
  // One toolchain, two sources, is the only comparison that isolates OUR change.
  fs.symlinkSync(path.join(HOST_DIR, "node_modules"), path.join(wt, "host", "node_modules"));
  const tsc = run("npx", ["tsc"], path.join(wt, "host"));
  const entry = path.join(wt, "host", "dist", "index.js");
  if (!fs.existsSync(entry)) {
    throw new Error(`baseline ${ref} did not build: tsc exited ${tsc.status}\n`
      + `${tsc.stdout}${tsc.stderr}`);
  }
  return { entry, cleanup: () => run("git", ["worktree", "remove", "--force", wt], REPO_DIR) };
}

const IS_MAIN = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (IS_MAIN) await main();

async function main() {
  const argv = process.argv.slice(2);
  // 🆕 233 — THE DISCOVER MODE, AND IT NEEDS NO BASELINE. It asks about the wire that is
  // here now, not about a difference, so it costs one server start rather than a worktree
  // and a compile. That is why it can be a CI step where the classifier cannot be — and
  // why this instrument now has a [B:live] axis (instrument_gate.py's LATE_LIVE).
  if (argv.includes("--discover")) {
    const here = path.join(HOST_DIR, "dist", "index.js");
    if (!fs.existsSync(here)) {
      console.error(`🔴 WIRE_DIFF_KEY UNREACHABLE — no build at ${here}; run \`npm run build\``);
      process.exit(2);
    }
    const tools = await surface(here, { BREAKPOINT_PRIVILEGED_GROUPS: "all" });
    const read = schemaKeys(tools);
    const problems = keyProblems(read);
    // 🔴 AND THE CLASSIFIER ITSELF, OVER THE ONE BASELINE THAT IS ALWAYS AVAILABLE: this
    // surface. A reader compared with itself must answer PATCH, move nothing, and clear
    // both of its own collapse floors — and a `classify`, `shapeOf` or `normalise` that
    // went quiet cannot do all three. That is what makes this step a live axis for the
    // classifier and not only for the key roster (232 §5.6's argument, paid rather than
    // declared). `effectiveTaskSupport` is the one member a SYMMETRIC comparison cannot
    // reach — both sides forbid identically — and it carries the declared-green row.
    let self;
    try {
      self = classify(tools, tools);
      if (self.verdict !== "PATCH" || self.moved !== 0) {
        problems.push(`WIRE_DIFF_KEY SELF ${self.verdict} moved=${self.moved} — the classifier `
          + `reports a CHANGE between this surface and itself. Nothing moved; the reader did`);
      }
      if (!(self.paths?.after >= SHAPE_FLOOR) || self.paths.before !== self.paths.after) {
        problems.push(`WIRE_DIFF_KEY SELF_PATHS ${self.paths?.after} schema path(s), floor `
          + `${SHAPE_FLOOR} — the shape walk went quiet over a surface of ${tools.length} `
          + `tool(s). A classifier that reads no paths compares nothing and reports PATCH`);
      }
    } catch (e) {
      problems.push(`WIRE_DIFF_KEY SELF threw over its own surface — ${e.message}`);
    }
    console.log(`WIRE_DIFF_KEY ${tools.length} tool(s) · ${read.nodes} schema node(s) · `
      + `${read.keys.size} distinct key(s) · ${CONSTRAINTS.length} narrowed · `
      + `${Object.keys(NOT_A_CONSTRAINT).length} excused · ${problems.length} problem(s) `
      + `(floors ${NODE_FLOOR}/${KEY_FLOOR}) · self ${self?.verdict ?? "THREW"} `
      + `moved=${self?.moved ?? "-"} paths=${self?.paths?.after ?? 0}/${SHAPE_FLOOR}`);
    for (const m of problems) console.log(`🔴 ${m}.`);
    console.log(problems.length
      ? "WIRE_DIFF_KEY 🔴 FAILED"
      : "WIRE_DIFF_KEY ok — every key on the wire is one typeName narrows on, one shapeOf "
        + "walks, or one declared unable to constrain a value");
    process.exit(problems.length ? 1 : 0);
  }
  const bi = argv.indexOf("--baseline");
  const described = run("git", ["describe", "--tags", "--abbrev=0"], REPO_DIR);
  const ref = bi >= 0 ? argv[bi + 1] : described.stdout.trim();
  if (!ref) {
    console.error("🔴 WIRE_DIFF UNREACHABLE — no baseline ref and `git describe` found no tag");
    process.exit(2);
  }

  let built, out;
  try {
    built = buildBaseline(ref);
    const here = path.join(HOST_DIR, "dist", "index.js");
    if (!fs.existsSync(here)) {
      throw new Error(`no current build at ${here} — run \`npm run build\` first`);
    }
    // BOTH privilege levels. The secure default is what most callers see; `all` is the
    // only view in which a privileged tool's schema is on the wire at all.
    out = [];
    for (const [label, value] of [["secure-default", ""], ["privileged", "all"]]) {
      const env = { BREAKPOINT_PRIVILEGED_GROUPS: value };
      out.push([label, classify(await surface(built.entry, env), await surface(here, env))]);
    }
  } catch (e) {
    console.error(`🔴 WIRE_DIFF UNREACHABLE — ${e.message}`);
    console.error("   Unreachable is RED, not a skip: a baseline that will not build is "
      + "not evidence that the public API held still.");
    if (built) built.cleanup();
    process.exit(2);
  }
  built.cleanup();

  // 🔴 THE WORST OF THE TWO VIEWS IS THE VERDICT. A tool added only under `all` is still
  // a tool added.
  const rank = { PATCH: 0, MINOR: 1, MAJOR: 2 };
  const worst = out.reduce((w, [, r]) => (rank[r.verdict] > rank[w] ? r.verdict : w), "PATCH");

  console.log(`WIRE_DIFF  ${ref} -> working tree`);
  for (const [label, r] of out) {
    console.log(`  ${label.padEnd(15)} ${String(r.counts.before).padStart(4)} -> `
      + `${String(r.counts.after).padStart(4)} tools   ${r.verdict}`
      + `   major ${r.major.length} · minor ${r.minor.length} · patch ${r.patch.length}`);
    if (!argv.includes("--summary")) {
      for (const kind of ["major", "minor", "patch"]) {
        for (const line of r[kind].slice(0, 20)) console.log(`      ${kind.toUpperCase()}  ${line}`);
        if (r[kind].length > 20) console.log(`      … and ${r[kind].length - 20} more ${kind}`);
      }
    }
  }
  console.log(`WIRE_VERDICT ${worst}`);
  console.log("  🔴 THIS DOES NOT DECIDE THE RELEASE. It answers what the PUBLIC API did; "
    + "the caller asserts that against the bump it is making.");
}
