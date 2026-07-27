import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolsReport } from "../src/cli/tools.js";
import { annotationsFor, ANNOTATED_TOOLS } from "../src/annotations.js";
import { TOOL_CAPABILITIES } from "../src/capabilities.js";

const FULL = 289;
const SECURE_DEFAULT = 274;

test("the full surface report covers every registered tool exactly once", () => {
  const r = buildToolsReport("full");
  assert.equal(r.counts.full, FULL);
  assert.equal(r.tools.length, FULL);
  const names = r.tools.map((t) => t.name);
  assert.deepEqual(
    names.filter((n, i) => names.indexOf(n) !== i),
    [],
    "duplicate tool in the export",
  );
  assert.deepEqual([...names].sort(), [...ANNOTATED_TOOLS].sort());
});

test("the secure-default surface drops exactly the privileged tools", () => {
  const r = buildToolsReport("secure-default");
  assert.equal(r.counts.secureDefault, SECURE_DEFAULT);
  assert.equal(r.tools.length, SECURE_DEFAULT);
  assert.equal(r.counts.privileged, FULL - SECURE_DEFAULT);

  // Nothing privileged survives, and nothing unprivileged was dropped.
  assert.deepEqual(r.tools.filter((t) => t.privileged).map((t) => t.name), []);
  const shown = new Set(r.tools.map((t) => t.name));
  const missing = Object.keys(TOOL_CAPABILITIES).filter((n) => shown.has(n));
  assert.deepEqual(missing, [], `privileged tool(s) leaked into the default surface: ${missing.join(", ")}`);
});

test("both surfaces report the same total/secure counts in the header", () => {
  for (const surface of ["full", "secure-default"] as const) {
    const r = buildToolsReport(surface);
    assert.equal(r.counts.full, FULL, `${surface}: counts.full`);
    assert.equal(r.counts.secureDefault, SECURE_DEFAULT, `${surface}: counts.secureDefault`);
  }
});

test("exported annotations agree with annotationsFor() for every tool", () => {
  for (const t of buildToolsReport("full").tools) {
    assert.deepEqual(t.annotations, annotationsFor(t.name), `annotations drifted for ${t.name}`);
  }
});

test("the headline counts are derived, not hardcoded — they match the tools array", () => {
  for (const surface of ["full", "secure-default"] as const) {
    const r = buildToolsReport(surface);
    const c = r.counts;
    assert.equal(c.readOnly, r.tools.filter((t) => t.annotations.readOnlyHint).length, `${surface}: readOnly`);
    assert.equal(c.destructive, r.tools.filter((t) => t.annotations.destructiveHint).length, `${surface}: destructive`);
    assert.equal(c.idempotent, r.tools.filter((t) => t.annotations.idempotentHint).length, `${surface}: idempotent`);
    assert.equal(c.openWorld, r.tools.filter((t) => t.annotations.openWorldHint).length, `${surface}: openWorld`);
    assert.equal(
      c.confirmationGated,
      r.tools.filter((t) => t.confirmationGated).length,
      `${surface}: confirmationGated`,
    );
  }
});

test("every tool carries a name, title, description, toolset and param list", () => {
  const bad = buildToolsReport("full")
    .tools.filter(
      (t) =>
        !t.name ||
        typeof t.title !== "string" ||
        typeof t.description !== "string" ||
        !t.toolset ||
        !Array.isArray(t.params),
    )
    .map((t) => t.name);
  assert.deepEqual(bad, [], `incomplete export entries: ${bad.join(", ")}`);
});

test("confirmationGated reflects the actual `confirm` input param", () => {
  const r = buildToolsReport("full");
  const mismatched = r.tools.filter((t) => t.confirmationGated !== t.params.includes("confirm")).map((t) => t.name);
  assert.deepEqual(mismatched, []);
  // Sanity floor: the gate is real and broad. If this ever drops sharply, the
  // elicitation gate has been removed from tools rather than the export breaking.
  assert.ok(r.counts.confirmationGated > 50, `only ${r.counts.confirmationGated} tools gated — did the gate regress?`);
});

test("no confirmation-gated tool is marked read-only", () => {
  const bad = buildToolsReport("full")
    .tools.filter((t) => t.confirmationGated && t.annotations.readOnlyHint)
    .map((t) => t.name);
  assert.deepEqual(bad, []);
});

test("the capability-group block lists both groups as default-off with their tools", () => {
  const r = buildToolsReport("full");
  assert.deepEqual(r.capabilityGroups.map((g) => g.id), ["code-execution", "network"]);
  for (const g of r.capabilityGroups) {
    assert.equal(g.defaultEnabled, false);
    assert.ok(g.describe.length > 0);
    assert.ok(g.tools.length > 0);
    for (const name of g.tools) {
      assert.ok(TOOL_CAPABILITIES[name]?.includes(g.id as never), `${name} listed under ${g.id} but not tagged`);
    }
  }
  const listed = r.capabilityGroups.flatMap((g) => g.tools).sort();
  assert.deepEqual(listed, Object.keys(TOOL_CAPABILITIES).sort());
});

test("the report is deterministic — no timestamp, stable ordering, byte-identical across builds", () => {
  const a = buildToolsReport("full");
  const b = buildToolsReport("full");
  assert.equal(a.generatedAt, null, "a timestamp would make releases undiffable");
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const names = a.tools.map((t) => t.name);
  assert.deepEqual(names, [...names].sort((x, y) => x.localeCompare(y)), "tools must be name-sorted");
});
