import { test } from "node:test";
import assert from "node:assert/strict";
import { registerCliTools } from "../src/tools/cli.js";
import { applyOutputSchemas, outputSchemas } from "../src/schemas.js";
import { annotationsFor, ALL_ANNOTATED } from "../src/annotations.js";
import { loadConfig } from "../src/config.js";

/**
 * D4 — `breakpoint_doctor`, the diagnostic reachable from inside the session.
 *
 * The CLI it wraps has its own coverage in `cli_doctor.test.ts` (TCP fixtures, a fake
 * `godot` on PATH, env snapshot/restore). This file asserts the part that is NEW: that
 * the tool exists, that it is annotated and schema-frozen like everything else, that it
 * runs against a project that does not exist without throwing — the state a broken setup
 * is actually in — and that it reports rather than raises.
 */

type Handler = (args: Record<string, unknown>) => Promise<{
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}>;

function registerCli() {
  const calls = new Map<string, { config: Record<string, unknown>; handler: Handler }>();
  const server = {
    registerTool(name: string, config: Record<string, unknown>, handler: Handler) {
      calls.set(name, { config, handler });
      return { name };
    },
    experimental: {
      tasks: {
        registerToolTask(name: string, config: Record<string, unknown>, handler: Handler) {
          calls.set(name, { config, handler });
          return { name };
        },
      },
    },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };
  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  applyOutputSchemas(mcp);
  registerCliTools(mcp as never, loadConfig());
  return calls;
}

test("breakpoint_doctor is registered on the CLI plane", () => {
  assert.ok(registerCli().has("breakpoint_doctor"));
});

test("breakpoint_doctor is schema-frozen and annotated like every other tool", () => {
  const entry = registerCli().get("breakpoint_doctor");
  assert.ok(entry, "registered");
  // applyOutputSchemas injects it; a tool with no frozen output is a tool whose
  // result a client cannot validate, and registration.test.ts refuses that globally.
  assert.ok(entry.config.outputSchema, "outputSchema injected");
  assert.ok(outputSchemas.breakpoint_doctor, "declared in schemas.ts");
  assert.ok(ALL_ANNOTATED.includes("breakpoint_doctor"), "on the annotation roster");
  const ann = annotationsFor("breakpoint_doctor");
  assert.equal(ann.readOnlyHint, true, "a diagnostic reads; it must never write");
  assert.equal(ann.idempotentHint, true);
  assert.equal(ann.destructiveHint, false);
  // 🔴 It probes loopback ports and spawns the local Godot binary — nothing beyond
  // this machine. openWorldHint true would tell a client this reaches the internet.
  assert.equal(ann.openWorldHint, false);
});

test("its input is optional in every field — a user in trouble types nothing", () => {
  const entry = registerCli().get("breakpoint_doctor");
  const shape = entry!.config.inputSchema as Record<string, { isOptional?: () => boolean }>;
  assert.deepEqual(Object.keys(shape).sort(), ["include_csharp", "require_live", "timeout_ms"]);
  for (const [k, v] of Object.entries(shape)) {
    assert.equal(v.isOptional?.(), true, `${k} must be optional`);
  }
});

test("🔴 it REPORTS a broken setup instead of throwing on one", async () => {
  // The state the tool exists for: no Godot binary, no addon, no bridge, no project.
  // A diagnostic that raises when the thing it diagnoses is broken is worse than none,
  // because the caller sees a tool error and learns nothing about which part is wrong.
  const prev = { ...process.env };
  process.env.GODOT_PROJECT = "/nonexistent/breakpoint-doctor-fixture";
  process.env.GODOT_BIN = "definitely-not-a-real-godot-binary";
  try {
    const entry = registerCli().get("breakpoint_doctor");
    const res = await entry!.handler({ timeout_ms: 250 });
    const out = res.structuredContent as { ok: boolean; failed: number; checks: unknown[] };
    assert.ok(Array.isArray(out.checks) && out.checks.length > 0, "it answered with checks");
    assert.equal(typeof out.ok, "boolean");
    assert.equal(typeof out.failed, "number");
    assert.notEqual(res.isError, true, "a broken setup is a REPORT, not a tool error");
    // 🔴 AND IT NAMES THE LAYER, WHICH IS THE WHOLE POINT. Against a project path
    // that does not exist it reports `project` as failed and does not pretend to have
    // an opinion about the addon inside it — the caller learns WHERE to look, which is
    // exactly what a connect error from some editor_* tool never tells them.
    const checks = out.checks as Array<{ name: string; status: string; hint?: string }>;
    const names = checks.map((c) => c.name);
    assert.ok(names.includes("project"), `project check present: ${names.join(", ")}`);
    assert.ok(names.includes("godot-binary"), "the binary is checked too");
    const project = checks.find((c) => c.name === "project")!;
    assert.equal(project.status, "skip", "no project.godot is a skip, not a claim about an addon");
    assert.ok(project.hint, "and it carries a hint — a status with no next step is a shrug");
    // `godot-binary` is severity:required, so a missing binary is what makes ok false.
    const bin = checks.find((c) => c.name === "godot-binary")!;
    assert.equal(bin.status, "fail");
    assert.equal(out.ok, false, "a required check failed, so the summary says so");
    assert.equal(out.failed, checks.filter((c) => c.status === "fail").length,
      "the count we report is the count that is there");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in prev)) delete process.env[k];
    Object.assign(process.env, prev);
  }
});

test("🔴 it does not reconfigure the live server underneath the other tools", async () => {
  // `runDoctor` (the CLI entry) sets process.env.GODOT_PROJECT before loadConfig().
  // Doing that inside a tool handler would repoint every other tool in the session at
  // whatever project the last doctor call named. The tool takes the already-loaded
  // Config instead, and this test is the only thing that would notice if that changed.
  const prev = { ...process.env };
  process.env.GODOT_PROJECT = "/nonexistent/breakpoint-doctor-fixture";
  process.env.GODOT_BIN = "definitely-not-a-real-godot-binary";
  try {
    const before = process.env.GODOT_PROJECT;
    const entry = registerCli().get("breakpoint_doctor");
    await entry!.handler({ timeout_ms: 250, require_live: true, include_csharp: false });
    assert.equal(process.env.GODOT_PROJECT, before, "env untouched by the handler");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in prev)) delete process.env[k];
    Object.assign(process.env, prev);
  }
});
