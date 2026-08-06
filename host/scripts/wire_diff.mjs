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
export function typeName(v) {
  if (!v || typeof v !== "object") return "unknown";
  if (v.type !== undefined) {
    return Array.isArray(v.type) ? [...v.type].sort().join("|") : String(v.type);
  }
  if (Array.isArray(v.enum)) return `enum(${v.enum.length})`;
  if (v.const !== undefined) return "const";
  if (Array.isArray(v.anyOf)) return `anyOf(${v.anyOf.length})`;
  if (Array.isArray(v.oneOf)) return `oneOf(${v.oneOf.length})`;
  if (typeof v.$ref === "string") return `ref:${v.$ref}`;
  return "unknown";
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

  const verdict = major.length ? "MAJOR" : minor.length ? "MINOR" : "PATCH";
  return {
    verdict, major, minor, patch,
    moved: major.length + minor.length + patch.length,
    counts: { before: b.size, after: a.size },
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
