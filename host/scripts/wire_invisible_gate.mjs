#!/usr/bin/env node
// wire_invisible_gate.mjs — THE RULE NEITHER EMISSION CARRIES.
//
// 230 §4 priced a GDScript port of the schema surface and found the schema half is a
// generator: every fact in a hand-written dictionary was already in the `tools/list`
// bytes. Every fact but one. `z.number().finite()` emits `{"type":"number"}`, byte for
// byte identical to a bare `z.number()`, which is exactly what 226 §2 relied on when it
// added the refinement without moving the wire. A port driven from the wire reproduces
// the schema exactly and silently drops the refusal.
//
// 🔴 AND `wire_diff.mjs` WOULD CALL THAT PORT IDENTICAL. It is the strongest instrument
// in this tree for the class it covers, and this fact is structurally outside it: a gate
// that compares two emissions cannot see a rule that neither emission carries.
//
// 🔴 SO THIS READS THE ZOD AND NOT THE WIRE, and it is the only reader here that does.
// It walks the same `buildToolsets` surface `cli/tools.ts` records, collects every
// refinement the declarations carry, and then asks the WIRE, per class, whether that
// refinement survives the emitter.
//
// ── WHAT IS ROSTERED, AND WHY IT IS NOT A COUNT ──────────────────────────────────────
//
// 230 NEXT 3 asked for "a roster plus a floor" and priced the population at three, from
// `grep -rooF '.finite()' src/ --include=*.ts | wc -l`. Measured off the zod objects
// instead of off the source text, the live population is ONE: the other two occurrences
// are COMMENTS ABOUT that one. A floor of three would have pinned two comments — delete
// one and the gate reddens over nothing; add a fourth real refinement while deleting a
// comment and the total is still three and the gate stays GREEN.
//
// That is 230 §2's own argument (a population that can collapse for more than one reason
// cannot be governed by its sum) arriving inside the item that same handoff wrote to
// apply it, which makes it the second session running that the argument had to be
// re-derived at the site rather than carried to it. So the roster names SITES —
// tool, side, path — and a moved site reddens at an unchanged count.
//
// ── WHY THE VISIBILITY IS MEASURED AND NOT TABULATED ─────────────────────────────────
//
// A hand-written table of "which refinements emit" is a claim about somebody else's
// software (`zod-to-json-schema`, reached through the SDK) that would be true when typed
// and silently wrong after a dependency bump inside the declared caret range — #256's
// shape exactly. So each class is measured by taking a REAL live node carrying it,
// stripping that one check off a clone, and listing both through the SDK.
//
// 🔴 BOTH WAYS THAT MEASUREMENT CAN GO BLIND FAIL LOUD, WHICH IS WHY IT IS A COMPARISON.
// If `stripCheck` stopped removing anything, every class would compare equal, every class
// would read INVISIBLE, and every one of them would redden as undeclared. If the
// comparison stopped seeing equal bytes, `.finite()` would read visible and its roster
// row would redden as a claim the wire refutes. There is no blinding of this instrument
// that reports a quiet pass — which is 181 §5's requirement, stated at the input.
//
// Run:  node scripts/wire_invisible_gate.mjs          (needs dist/ — run `npm run build`)
//       node scripts/wire_invisible_gate.selftest.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOST_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 🔴 THE FLOORS, AND THEY ARE BOTH ABOUT THE SAME SILENCE. A surface that failed to build
// reads zero tools, declares zero refinements, finds zero invisible classes and agrees
// with its roster about nothing — the exact quiet pass `scope_gate.py` exists to refuse
// and `wire_diff.mjs` floors with `SURFACE_FLOOR`. Two floors rather than one because the
// two collapses are different: a surface can register every tool and still walk no
// declarations if the walker stops descending, which is 211 §4 one file over.
export const TOOL_FLOOR = 200;   // live 292
export const FACT_FLOOR = 200;   // live 310

// ── THE ROSTER ───────────────────────────────────────────────────────────────────────
//
// 🔴 A ROW IS A CLASS, A REASON AND THE EXACT SITES IT SHIPPED AT. The reason is required
// and checked, for `MEASURED_CAUSE`'s argument: a population pinned without a cause is a
// number somebody will later raise because it was in the way.
export const WIRE_INVISIBLE = {
  "ZodNumber.finite": {
    reason:
      "226 §2 narrowed runtime_assert_perf's `baseline` to `z.number().finite()` so `1e999` "
      + "could not reach `float(baseline[key])` in runtime_bridge.gd as `inf`. The emitter "
      + "renders `.finite()` and a bare `z.number()` the same, which is what let that ship as "
      + "a MINOR — and is why any consumer reading this surface off the wire loses the refusal.",
    sites: ["runtime_assert_perf inputSchema baseline<val>"],
  },
};

export const siteKey = (f) => `${f.tool} ${f.io} ${f.path}`;

// ── the walk: every refinement the DECLARATIONS carry ────────────────────────────────
// Wrappers are descended through rather than reported, because `.optional()` on a refined
// number does not change what the refinement is; containers extend the path so a site
// names the leaf and not the parameter it hides under.
export function walkNode(node, tool, io, nodePath, out, depth = 0) {
  if (!node || typeof node !== "object" || depth > 40) return out;
  const def = node._def;
  if (!def) return out;
  const tn = def.typeName;
  if (Array.isArray(def.checks)) {
    for (const c of def.checks) out.push({ cls: `${tn}.${c.kind}`, kind: c.kind, node, tool, io, path: nodePath });
  }
  const go = (n, p = nodePath) => walkNode(n, tool, io, p, out, depth + 1);
  switch (tn) {
    case "ZodOptional": case "ZodNullable": case "ZodDefault":
    case "ZodCatch": case "ZodReadonly":       return go(def.innerType);
    case "ZodEffects":                          return go(def.schema);
    case "ZodBranded":                          return go(def.type);
    case "ZodPipeline":                         go(def.in); return go(def.out);
    case "ZodLazy": { let inner; try { inner = def.getter(); } catch { return out; } return go(inner); }
    case "ZodArray":                            return go(def.type, `${nodePath}[]`);
    case "ZodSet":                              return go(def.valueType, `${nodePath}{}`);
    case "ZodRecord": case "ZodMap":
      go(def.keyType, `${nodePath}<key>`);      return go(def.valueType, `${nodePath}<val>`);
    case "ZodIntersection":                     go(def.left); return go(def.right);
    case "ZodObject": {
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      for (const [k, v] of Object.entries(shape || {})) go(v, nodePath ? `${nodePath}.${k}` : k);
      return out;
    }
    case "ZodUnion":
      (def.options || []).forEach((o, i) => go(o, `${nodePath}|${i}`));
      return out;
    case "ZodDiscriminatedUnion": {
      const opts = def.options instanceof Map ? [...def.options.values()] : (def.options || []);
      opts.forEach((o, i) => go(o, `${nodePath}|${i}`));
      return out;
    }
    case "ZodTuple":
      (def.items || []).forEach((o, i) => go(o, `${nodePath}[${i}]`));
      return out;
    default: return out;
  }
}

export function walkSurface(recorded) {
  const out = [];
  for (const { name, config } of recorded) {
    for (const io of ["inputSchema", "outputSchema"]) {
      const shape = config && config[io];
      if (!shape) continue;
      if (shape._def) { walkNode(shape, name, io, "", out); continue; }
      for (const [k, v] of Object.entries(shape)) walkNode(v, name, io, k, out);
    }
  }
  return out;
}

// 🔴 ONE CHECK OFF A CLONE OF THE REAL NODE. Rebuilding a stand-in `z.number().finite()`
// here would measure a schema this repository does not ship; the live node is the subject.
export function stripCheck(node, kind) {
  const clone = Object.create(Object.getPrototypeOf(node));
  Object.assign(clone, node);
  let dropped = false;
  clone._def = {
    ...node._def,
    checks: (node._def.checks || []).filter((c) => {
      if (!dropped && c.kind === kind) { dropped = true; return false; }
      return true;
    }),
  };
  return clone;
}

// ── THE RULES ────────────────────────────────────────────────────────────────────────
//
// PURE, and it takes the measurement as an argument rather than performing it, so the
// self-test drives every refusal with no server, no build and no dependency on what the
// emitter happens to do this week.
export function audit({ toolCount, facts, invisible, roster }) {
  const problems = [];
  const say = (code, text) => problems.push({ code, text });

  if (toolCount < TOOL_FLOOR) {
    say("SURFACE_FLOOR",
      `${toolCount} tool(s) recorded, floor ${TOOL_FLOOR} — a surface that failed to build `
      + `declares no refinements and agrees with this roster about nothing.`);
  }
  if (facts.length < FACT_FLOOR) {
    say("FACT_FLOOR",
      `${facts.length} refinement(s) walked, floor ${FACT_FLOOR} — a walk that stops descending `
      + `reads a fully registered surface as carrying no rules at all.`);
  }

  const live = new Map();          // cls -> Set(siteKey)
  for (const f of facts) {
    if (!live.has(f.cls)) live.set(f.cls, new Set());
    live.get(f.cls).add(siteKey(f));
  }

  // 1 — a refinement the wire cannot carry, that nobody declared
  for (const cls of [...invisible].sort()) {
    if (roster[cls]) continue;
    const sites = [...(live.get(cls) || [])].sort();
    say("UNDECLARED",
      `${cls} does not survive the emitter and is not in WIRE_INVISIBLE. `
      + `${sites.length} site(s): ${sites.join(", ") || "none"}. Either declare it with the reason `
      + `it is enforced at the door, or move the rule somewhere the wire can carry it.`);
  }

  for (const [cls, row] of Object.entries(roster).sort()) {
    const sites = [...(live.get(cls) || [])].sort();
    const declared = [...(row.sites || [])].sort();

    // 2 — a row with no cause is a number waiting to be raised by whoever it blocks
    if (!row.reason || !String(row.reason).trim()) {
      say("NO_REASON", `${cls} is rostered with no reason. MEASURED_CAUSE's rule: what a row `
        + `pins has to say why, or the next session deletes it as noise.`);
    }

    // 3 — an exemption outliving its subject (174 §5), and the shape `stale-exempt` refuses
    if (sites.length === 0) {
      say("STALE_ROW", `${cls} is rostered and the tree carries no site for it. A roster row `
        + `over nothing is an exemption outliving its subject; delete the row with the refinement.`);
      continue;
    }

    // 4 — the roster claims the wire drops this and the wire is carrying it
    if (!invisible.has(cls)) {
      say("NOW_VISIBLE", `${cls} is rostered as invisible and the emitter now RENDERS it. `
        + `A consumer reading this surface off the wire no longer loses the rule — which is good `
        + `news and a roster that is lying. Re-measure and delete the row.`);
    }

    // 5 — the sites, and NOT their count. Same number, different place, still red.
    const added = sites.filter((s) => !declared.includes(s));
    const gone = declared.filter((s) => !sites.includes(s));
    if (added.length || gone.length) {
      say("SITES_MOVED", `${cls}: ${sites.length} live site(s) against ${declared.length} declared`
        + (added.length ? `\n      + ${added.join("\n      + ")}` : "")
        + (gone.length ? `\n      - ${gone.join("\n      - ")}` : "")
        + `\n      Each added site is a validation fact a wire-driven consumer silently drops. `
        + `Carry it by hand on the far side, then declare it here.`);
    }
  }
  return problems;
}

// ── the live half ────────────────────────────────────────────────────────────────────
//
// 🔴 THE SURFACE IS RECORDED THE WAY `cli/tools.ts` RECORDS IT — `applyOutputSchemas` →
// `applyAnnotations` → every `register*Tools` against a recorder — because that is the
// path that produces the zod this gate is about. Reading `tools/list` instead would be
// reading the emission, which is the one thing that cannot answer this question.
export async function recordSurface() {
  const dist = (p) => import(pathToFileURL(path.join(HOST_DIR, "dist", p)).href);
  const { buildToolsets } = await dist("toolsets.js");
  const { applyOutputSchemas } = await dist("schemas.js");
  const { applyAnnotations } = await dist("annotations.js");
  const { loadConfig } = await dist("config.js");

  const recorded = [];
  const push = (name, config) => { recorded.push({ name, config }); return { name }; };
  const server = {
    registerTool: (n, c) => push(n, c),
    registerResource: () => {},
    experimental: { tasks: { registerToolTask: (n, c) => push(n, c) } },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };
  applyOutputSchemas(server);
  applyAnnotations(server);
  const stub = {};
  for (const ts of buildToolsets({
    server, bridge: stub, runtime: stub, lsp: stub, csLsp: stub, dap: stub, csDap: stub,
    config: loadConfig(),
  })) ts.run();
  return recorded;
}

// Two schemas, side by side, listed through the SDK and compared as bytes — the same
// projection `finiteness.test.ts` asserts one refinement against, asked of every class.
export async function emitPair(withIt, withoutIt) {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
  const server = new McpServer({ name: "wire-invisible-probe", version: "0" });
  server.registerTool("with_it", { description: "d", inputSchema: { p: withIt } }, async () => ({ content: [] }));
  server.registerTool("without_it", { description: "d", inputSchema: { p: withoutIt } }, async () => ({ content: [] }));
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "wire-invisible-gate", version: "0" });
  await Promise.all([server.connect(b), client.connect(a)]);
  const listed = (await client.listTools()).tools;
  await client.close();
  const by = Object.fromEntries(listed.map((t) => [t.name, JSON.stringify(t.inputSchema)]));
  return { with: by.with_it, without: by.without_it };
}

export async function measureVisibility(facts) {
  const first = new Map();
  for (const f of facts) if (!first.has(f.cls)) first.set(f.cls, f);
  const invisible = new Set();
  const rows = [];
  for (const [cls, f] of [...first].sort()) {
    const seen = await emitPair(f.node, stripCheck(f.node, f.kind));
    const same = seen.with === seen.without;
    if (same) invisible.add(cls);
    rows.push({ cls, same, at: siteKey(f), emitted: seen.with });
  }
  return { invisible, rows };
}

async function main() {
  let recorded;
  try {
    recorded = await recordSurface();
  } catch (e) {
    // 🔴 UNREACHABLE IS RED, NOT SKIPPED — `registry_lag.py`'s reason and `wire_diff.mjs`'s:
    // a surface that will not load is not evidence that the tree carries no hidden rule.
    console.log("🔴 WIRE_INVISIBLE_UNREACHABLE — could not record the surface from dist/.\n"
      + "   Run `npm run build` first. A gate that cannot read its population must not pass it.\n"
      + `   ${String((e && e.message) || e)}`);
    return 1;
  }

  const facts = walkSurface(recorded);
  const { invisible, rows } = await measureVisibility(facts);

  const classes = new Map();
  for (const f of facts) classes.set(f.cls, (classes.get(f.cls) || 0) + 1);
  console.log(`WIRE_INVISIBLE_SURFACE ${recorded.length} tool(s) · ${facts.length} refinement(s) `
    + `· ${classes.size} class(es) · floors ${TOOL_FLOOR}/${FACT_FLOOR}`);
  for (const r of rows) {
    console.log(`  ${r.same ? "🔴 the wire drops it " : "🟢 on the wire      "}`
      + `${r.cls.padEnd(20)} ${String(classes.get(r.cls)).padStart(4)} site(s)   e.g. ${r.at}`);
  }

  const problems = audit({ toolCount: recorded.length, facts, invisible, roster: WIRE_INVISIBLE });
  for (const p of problems) console.log(`🔴 WIRE_INVISIBLE_${p.code} ${p.text}`);
  if (problems.length) {
    console.log(`WIRE_INVISIBLE_GATE ${problems.length} problem(s)`);
    return 1;
  }
  const rostered = Object.values(WIRE_INVISIBLE).reduce((n, r) => n + r.sites.length, 0);
  console.log(`WIRE_INVISIBLE_GATE ok — every refinement the emitter drops is rostered at the exact `
    + `site it shipped at (${rostered}), every rostered row still has a subject and still fails to `
    + `reach the wire, and ${classes.size - invisible.size} class(es) were measured onto it.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; });
}
