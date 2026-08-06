import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolsets } from "../src/toolsets.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { loadConfig } from "../src/config.js";
import { ANNOTATED_TOOLS, annotationsFor, applyAnnotations, type ToolAnnotations } from "../src/annotations.js";

const EXPECTED_TOOL_COUNT = 291;

/**
 * Register the whole surface against a recorder exactly as index.ts does —
 * applyOutputSchemas, then applyAnnotations, then every register*Tools — so the
 * annotations assertions run against the REAL registry rather than a fixture.
 * Mirrors registration.test.ts / capabilities.test.ts. Handlers are never
 * invoked, so stub clients are fine.
 */
function registerAll() {
  const calls: Array<{ name: string; config: Record<string, unknown> }> = [];
  const server = {
    registerTool(name: string, config: Record<string, unknown>) { calls.push({ name, config }); return { name }; },
    registerResource() {},
    experimental: {
      tasks: {
        registerToolTask(name: string, config: Record<string, unknown>) { calls.push({ name, config }); return { name }; },
      },
    },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };

  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;

  applyOutputSchemas(mcp);
  applyAnnotations(mcp);

  const toolsets = buildToolsets({
    server: mcp,
    bridge: stub,
    runtime: stub,
    lsp: stub,
    csLsp: stub,
    dap: stub,
    csDap: stub,
    config: loadConfig(),
  });
  for (const ts of toolsets) ts.run();

  return calls;
}

type Ann = { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
const annOf = (c: { config: Record<string, unknown> }) => c.config.annotations as Ann | undefined;

test("the annotation table is total: every registered tool has an entry, and every entry is a real tool", () => {
  const calls = registerAll();
  assert.equal(calls.length, EXPECTED_TOOL_COUNT);

  const registered = new Set(calls.map((c) => c.name));
  const annotated = new Set(ANNOTATED_TOOLS);

  const missing = [...registered].filter((n) => !annotated.has(n)).sort();
  const stale = [...annotated].filter((n) => !registered.has(n)).sort();

  assert.deepEqual(missing, [], `tools with no annotation entry: ${missing.join(", ")}`);
  assert.deepEqual(stale, [], `annotation entries for tools that no longer exist: ${stale.join(", ")}`);
});

test("every registered tool ships all four hints — absence is an explicit false, never 'unknown'", () => {
  const calls = registerAll();
  const bad = calls
    .filter((c) => {
      const a = annOf(c);
      return (
        a === undefined ||
        typeof a.readOnlyHint !== "boolean" ||
        typeof a.destructiveHint !== "boolean" ||
        typeof a.idempotentHint !== "boolean" ||
        typeof a.openWorldHint !== "boolean"
      );
    })
    .map((c) => c.name);
  assert.deepEqual(bad, [], `tools with missing/partial annotations: ${bad.join(", ")}`);
});

test("the injected annotations match annotationsFor() for every tool", () => {
  for (const c of registerAll()) {
    assert.deepEqual(annOf(c), annotationsFor(c.name), `annotations drifted for ${c.name}`);
  }
});

test("no tool is both read-only and destructive, and no read-only tool claims openWorld", () => {
  const contradictory: string[] = [];
  const egressing: string[] = [];
  const calls = registerAll();
  // 🔴 214 §7.5 named this claim as one that could copy plane_path_guards:196. It cannot.
  // `contradictory` and `egressing` are initialised to [] and can only ever fill when a
  // real bug exists, so NEITHER can carry a positive control of its own — forcing one
  // would mean asserting the defect this test exists to deny. What CAN go vacuous here is
  // the POPULATION and each half of the conjunction: an empty registry, or a hint that
  // stopped being set anywhere, leaves both assertions below green having compared [] to
  // []. Those are the floors, and they are deliberately not the same floor.
  assert.equal(calls.length, EXPECTED_TOOL_COUNT);
  assert.ok(
    calls.some((c) => annOf(c)!.readOnlyHint),
    "no tool is marked read-only — both predicates below are unreachable and prove nothing",
  );
  assert.ok(
    calls.some((c) => annOf(c)!.destructiveHint),
    "no tool is marked destructive — `contradictory` could not fill even if the rule were broken",
  );
  // 🔴 openWorldHint deliberately gets NO non-emptiness floor, and the asymmetry is the
  // point: the surface is loopback-only and the last test in this file asserts the hint is
  // false EVERYWHERE, so `some(openWorldHint)` would be a claim this codebase must refuse.
  // `egressing`'s floor is that the field is a real boolean on every tool — which is
  // exactly what the "ships all four hints" test above already proves.
  for (const c of calls) {
    const a = annOf(c)!;
    if (a.readOnlyHint && a.destructiveHint) contradictory.push(c.name);
    if (a.readOnlyHint && a.openWorldHint) egressing.push(c.name);
  }
  assert.deepEqual(contradictory, [], `read-only AND destructive: ${contradictory.join(", ")}`);
  assert.deepEqual(egressing, [], `read-only AND openWorld: ${egressing.join(", ")}`);
});

test("every read-only tool is genuinely non-mutating: none is confirmation-gated", () => {
  // gate()-ed tools take an optional `confirm` input. A read-only tool must never
  // have one — if it does, either the hint or the gating is wrong.
  const bad: string[] = [];
  const calls = registerAll();
  const isGated = (c: { config: Record<string, unknown> }) => {
    const shape = c.config.inputSchema as Record<string, unknown> | undefined;
    return shape !== undefined && Object.prototype.hasOwnProperty.call(shape, "confirm");
  };
  // 🔴 Same shape as the test above, and the same reason it is not plane_path_guards:196:
  // `bad` is an INTERSECTION, and an empty intersection is only evidence when BOTH sets are
  // known non-empty. Floor them separately — a registry with no read-only tools left, or
  // one that stopped emitting `confirm` inputs, would otherwise report "none is
  // confirmation-gated" having intersected two empty sets.
  assert.equal(calls.length, EXPECTED_TOOL_COUNT);
  assert.ok(calls.some((c) => annOf(c)!.readOnlyHint), "no tool is marked read-only — the left half of the intersection is empty");
  assert.ok(calls.some(isGated), "no tool takes a `confirm` input — this probe reads a field nothing sets");
  for (const c of calls) {
    const a = annOf(c)!;
    if (a.readOnlyHint && isGated(c)) bad.push(c.name);
  }
  assert.deepEqual(bad, [], `tools marked read-only but confirmation-gated: ${bad.join(", ")}`);
});

test("openWorldHint is false across the whole surface — every bridge is loopback-only", () => {
  const egress = registerAll()
    .filter((c) => annOf(c)!.openWorldHint)
    .map((c) => c.name);
  assert.deepEqual(
    egress,
    [],
    `tool(s) now claim egress beyond loopback: ${egress.join(", ")} — if intended, update annotations.ts OPEN_WORLD and this test together`,
  );
});

test("an explicit annotations block on a call site wins over the injected one", () => {
  const calls: Array<{ name: string; config: Record<string, unknown> }> = [];
  const server = {
    registerTool(name: string, config: Record<string, unknown>) { calls.push({ name, config }); return { name }; },
  };
  const mcp = server as unknown as Parameters<typeof applyAnnotations>[0];
  applyAnnotations(mcp);

  const override = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
  (mcp as unknown as { registerTool: (n: string, c: unknown, h: unknown) => unknown }).registerTool(
    "node_delete",
    { title: "x", description: "y", inputSchema: {}, annotations: override },
    () => {},
  );

  assert.deepEqual(calls[0].config.annotations, override);
});

test("annotationsFor() returns an all-false block for an unknown tool name", () => {
  assert.deepEqual(annotationsFor("definitely_not_a_tool"), {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
});

// --- 168: structural gates + named canaries ---------------------------------
//
// The four tests above prove the table is TOTAL, NON-STALE and INTERNALLY CONSISTENT.
// None of them can catch a classification that is simply WRONG: every tool has an entry
// either way, and a wrong entry contradicts nothing. That is the same shape as 1.45.0's
// coverage claim — it stays green because the population is complete, not because it is
// correct — and it is exactly how a public 2026-07 catalog published the wrong risk for
// `tilemap_clear` and `navagent_configure`.
//
// 🔴 A BROADER GATE WAS TRIED FIRST AND MEASURED OUT. Modelling "what would a consumer
// guess from the name?" and recording every disagreement as a reasoned exception sounds
// like the path-cohort ledger applied to annotations. Measured: 149 of 291 tools
// disagreed, because the model flagged every LSP reader (`gd_hover`, `cs_definition`) —
// it was measuring the regex, not the annotations. A 149-row hand-maintained exception
// table is worse than no table. The rules below are the narrow, high-precision subset
// where the name genuinely does determine the answer: each has a scope in the dozens and
// ZERO disagreements today, so they gate future drift without an exception list to rot.

test("168: an explicit delete is destructive and never read-only", () => {
  const deletes = ANNOTATED_TOOLS.filter((n) => /(^|_)(remove|delete|clear|erase|close|kill|discard)(_|$)/.test(n));
  // A rule with an empty scope proves nothing while looking green — name the size.
  assert.ok(deletes.length >= 8, `delete-word scope collapsed to ${deletes.length}; the rule stopped covering anything`);
  const notDestructive = deletes.filter((n) => annotationsFor(n).destructiveHint !== true);
  const readOnly = deletes.filter((n) => annotationsFor(n).readOnlyHint !== false);
  assert.deepEqual(notDestructive, [], `named as a delete but not destructiveHint: ${notDestructive.join(", ")}`);
  assert.deepEqual(readOnly, [], `named as a delete but readOnlyHint: ${readOnly.join(", ")}`);
});

test("168: every setter / setup / configure mutator is non-read-only", () => {
  const setters = ANNOTATED_TOOLS.filter((n) => /(^|_)(set|setup|configure|wire|inject|apply)(_|$)/.test(n));
  assert.ok(setters.length >= 50, `setter scope collapsed to ${setters.length}`);
  const bad = setters.filter((n) => annotationsFor(n).readOnlyHint !== false);
  assert.deepEqual(bad, [], `named as a mutator but marked read-only: ${bad.join(", ")}`);
});

test("168 CANARY: the three classifications a public catalog got wrong are still correct", () => {
  // 🔴 NAMED, NOT COUNTED. 1.45.0's lesson: a count survives regeneration, a name does
  // not. Each of these is a tool whose CORRECT annotation contradicts what its name
  // suggests, which is precisely the row a future "tidy-up" would silently flip back.
  // The reason lives beside the expectation so it is inherited, not re-litigated.
  const canaries: Array<[string, Partial<ToolAnnotations>, string]> = [
    [
      "tilemap_clear",
      { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      "reads as irreversible and IS destructive — but it is also idempotent (clearing a " +
        "cleared layer adds nothing) and undoable through EditorUndoRedoManager. " +
        "Undoability does NOT make it non-destructive: the hint describes the call.",
    ],
    [
      "anim_remove_key",
      { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      "destructive AND non-idempotent — removing key N shifts the indices, so repeating " +
        "the identical call removes a DIFFERENT key. The contrast with tilemap_clear is " +
        "the point: two deletes, two different idempotency answers.",
    ],
    [
      "navagent_configure",
      { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      "reads as a setter and in fact ADDS a NavigationAgent node — so it is a creator, " +
        "which makes it non-idempotent, and purely additive, which makes it NOT " +
        "destructive even though it mutates. The 2026-07 catalog got this one backwards.",
    ],
  ];
  for (const [name, expected, why] of canaries) {
    const got = annotationsFor(name);
    for (const [hint, want] of Object.entries(expected)) {
      assert.equal(
        got[hint as keyof ToolAnnotations],
        want,
        `${name}.${hint} is ${got[hint as keyof ToolAnnotations]}, expected ${want} — ${why}`,
      );
    }
  }
});

test("168: a caller-supplied destination makes a creator idempotent, and the table says so", () => {
  // The header's shorthand once read "creators ... are false". Measured against the
  // table, 25 creators are idempotent TRUE and every one of them is right: a creator
  // that writes to a path the CALLER supplies converges, while one that auto-names
  // (node_add -> Node2D, Node2D2, ...) does not. The prose was over-generalising, not
  // the table. This pins both halves so neither can drift back toward the other.
  const convergent = ["resource_create", "theme_create", "board_create", "vcs_add", "node_add_to_group"];
  const divergent = ["node_add", "anim_remove_key", "editor_undo", "editor_redo"];
  for (const n of convergent) {
    assert.equal(annotationsFor(n).idempotentHint, true, `${n} writes to a caller-supplied target and should converge`);
  }
  for (const n of divergent) {
    assert.equal(annotationsFor(n).idempotentHint, false, `${n} adds a further effect each time and must not claim idempotency`);
  }
});
