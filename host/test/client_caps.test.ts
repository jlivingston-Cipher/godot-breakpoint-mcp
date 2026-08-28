/**
 * The pin under the published presets — 289, Rank 1(d).
 *
 * 🔴 A PRESET IS A PROMISE THAT DECAYS ON ITS OWN. `README.md` now tells a user
 * of a capped client that `BREAKPOINT_TOOLSETS=d` fits inside a cap of 100.
 * Nothing about adding a tool to `lsp`, `dap`, `cli` or `runtime` knows that
 * sentence exists, so without a reader the preset grows past the cap and the
 * documentation becomes false with nothing going red — the same shape 224 §7.15
 * recorded for every figure nobody re-derives. This file re-derives them: each
 * published preset is resolved through the SAME `selectToolsets` the server uses,
 * registered against a recorder, and counted.
 *
 * 🔴 AND IT PINS THE DOC AGAINST THE CODE IN BOTH DIRECTIONS. A cap the module
 * carries but the table omits is a client we know about and do not warn for; a
 * table row the module does not carry is a number a user acts on that no reader
 * owns. Both fail here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildToolsets } from "../src/toolsets.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { loadConfig, parseToolsets, selectToolsets } from "../src/config.js";
import {
  CLIENT_TOOL_CAPS,
  PUBLISHED_FITTING_PRESETS,
  SMALLEST_CLIENT_CAP,
  capAdvice,
} from "../src/client-caps.js";
import { installToolCensus } from "../src/tool-census.js";

const README = fileURLToPath(new URL("../../../README.md", import.meta.url));
const readme = () => readFileSync(README, "utf8");

/** A recording server that captures registered tool names (toolsets.test.ts's, shared shape). */
function recorder() {
  const calls: string[] = [];
  const server = {
    registerTool(name: string, _config: Record<string, unknown>) { calls.push(name); return { name }; },
    registerResource(_name: string) {},
    experimental: {
      tasks: {
        registerToolTask(name: string, _config: Record<string, unknown>) { calls.push(name); return { name }; },
      },
    },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };
  return { calls, server };
}

function build(rec: ReturnType<typeof recorder>) {
  const mcp = rec.server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;
  applyOutputSchemas(mcp);
  return buildToolsets({
    server: mcp, bridge: stub, runtime: stub, lsp: stub, csLsp: stub, dap: stub, csDap: stub, config: loadConfig(),
  });
}

/** How many tools a `BREAKPOINT_TOOLSETS` value registers, resolved exactly as the server does. */
function sizeOfPreset(value: string): number {
  const rec = recorder();
  const sets = build(rec);
  const enabled = selectToolsets(sets.map((t) => t.id), parseToolsets(value));
  for (const ts of sets) if (enabled.has(ts.id)) ts.run();
  return rec.calls.length;
}

// --- the pin ----------------------------------------------------------------
test("every published preset fits under the smallest client cap", () => {
  assert.ok(PUBLISHED_FITTING_PRESETS.length > 0, "publishing no fitting preset is not an option");
  for (const preset of PUBLISHED_FITTING_PRESETS) {
    const n = sizeOfPreset(preset);
    assert.ok(n > 0, `preset '${preset}' resolves to an empty surface`);
    assert.ok(
      n <= SMALLEST_CLIENT_CAP,
      `BREAKPOINT_TOOLSETS=${preset} registers ${n} tools, over the smallest published client ` +
        `cap of ${SMALLEST_CLIENT_CAP}. README.md offers this preset to users of a client that ` +
        `refuses the whole server past that number — either shrink the preset or stop publishing it.`,
    );
  }
});

test("README publishes each fitting preset with the size the code registers", () => {
  const text = readme();
  for (const preset of PUBLISHED_FITTING_PRESETS) {
    const n = sizeOfPreset(preset);
    const row = new RegExp(
      "`BREAKPOINT_TOOLSETS=" + preset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "`[^\\n]{0,40}?→\\s*\\*\\*(\\d+)\\*\\*",
    ).exec(text);
    assert.ok(row, `README.md publishes no size for BREAKPOINT_TOOLSETS=${preset}`);
    assert.equal(
      Number(row[1]), n,
      `README.md says BREAKPOINT_TOOLSETS=${preset} is ${row[1]} tools; the registry says ${n}`,
    );
  }
});

test("README's tool-limit table names every capped client the code knows about", () => {
  const text = readme();
  for (const cap of CLIENT_TOOL_CAPS) {
    const row = new RegExp(
      "\\|\\s*" + cap.client.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\|\\s*(\\d+)\\s*\\|",
    ).exec(text);
    assert.ok(row, `README.md's tool-limit table does not name ${cap.client}`);
    assert.equal(
      Number(row[1]), cap.limit,
      `README.md caps ${cap.client} at ${row[1]}; client-caps.ts says ${cap.limit}`,
    );
  }
  // 🔴 The other direction: a table row nobody's module owns is a number a user
  // acts on that no reader re-checks. Count the rows between the header and the
  // blank line that ends the table, and refuse a table wider than the module.
  const table = /\| Client \| Cap \| What you see \|\n\|[-| ]+\|\n((?:\|[^\n]*\|\n)+)/.exec(text);
  assert.ok(table, "README.md no longer carries a `| Client | Cap | What you see |` table");
  assert.equal(
    table[1].trimEnd().split("\n").length, CLIENT_TOOL_CAPS.length,
    "README.md's tool-limit table and client-caps.ts disagree about how many clients cap",
  );
});

test("every cap row carries the symptom text a user would search for", () => {
  const text = readme();
  for (const cap of CLIENT_TOOL_CAPS) {
    assert.ok(cap.symptom.length > 0 && cap.source.length > 0, `${cap.client} row is unsourced`);
  }
  // The quotable one is the point of the section: the error string must be in the
  // document verbatim, or searching it lands nowhere.
  assert.ok(
    text.includes("enabled tools would exceed max limit of 100"),
    "README.md no longer quotes Antigravity's refusal verbatim — the searchable string IS the fix",
  );
});

// --- the advice clause ------------------------------------------------------
test("capAdvice is silent under the cap and names a fitting preset over it", () => {
  assert.equal(capAdvice(SMALLEST_CLIENT_CAP), "");
  assert.equal(capAdvice(1), "");
  const over = capAdvice(SMALLEST_CLIENT_CAP + 1);
  assert.match(over, /BREAKPOINT_TOOLSETS/);
  assert.ok(
    over.includes(`BREAKPOINT_TOOLSETS=${PUBLISHED_FITTING_PRESETS[0]}`),
    "the advice must name a preset that fits, not merely the variable",
  );
  for (const cap of CLIENT_TOOL_CAPS) assert.ok(over.includes(String(cap.limit)));
});

// --- the census -------------------------------------------------------------
test("the census counts what reached the SDK, on the full surface and a filtered one", () => {
  const rec = recorder();
  const census = installToolCensus(rec.server);
  const sets = build(rec);
  for (const ts of sets) ts.run();
  assert.equal(census(), rec.calls.length, "census disagreed with the recorder on the full surface");

  const rec2 = recorder();
  const census2 = installToolCensus(rec2.server);
  const sets2 = build(rec2);
  const enabled = selectToolsets(sets2.map((t) => t.id), parseToolsets("d"));
  for (const ts of sets2) if (enabled.has(ts.id)) ts.run();
  assert.equal(census2(), rec2.calls.length);
  assert.ok(census2() < census(), "a filtered surface must census smaller than the full one");
});

test("the census counts task-model registrations too", () => {
  const rec = recorder();
  const census = installToolCensus(rec.server);
  rec.server.registerTool("a", {});
  rec.server.experimental.tasks.registerToolTask("b", {});
  assert.equal(census(), 2, "a task-model tool that is not counted is a surface reported short");
});

test("a wrapper installed OUTSIDE the census still counts through it", () => {
  // The ordering claim `index.ts` relies on: the census is installed first, so a
  // later wrapper that DROPS a tool (as applyCapabilities does) never reaches it.
  const rec = recorder();
  const census = installToolCensus(rec.server);
  const inner = rec.server.registerTool.bind(rec.server);
  rec.server.registerTool = ((name: string, config: Record<string, unknown>) =>
    name === "dropped" ? { name } : inner(name, config)) as typeof rec.server.registerTool;
  rec.server.registerTool("kept", {});
  rec.server.registerTool("dropped", {});
  assert.equal(census(), 1, "the census must count the surface that survives the drops, not the attempts");
});
