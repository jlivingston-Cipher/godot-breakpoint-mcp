import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { registerCliTools } from "../src/tools/cli.js";
import { applyOutputSchemas, outputSchemas } from "../src/schemas.js";
import { annotationsFor, ALL_ANNOTATED } from "../src/annotations.js";
import { loadConfig, type Config } from "../src/config.js";
import { readPorts, type PortRow } from "../src/ports.js";
import { readHolder } from "../src/port-holder.js";
import { structured } from "./helpers/structured.js";

/**
 * 318 — `breakpoint_ports`, the same holder reading the refusals now carry, on demand.
 *
 * `port_holder.test.ts` owns the reader's families and the sentences. This file asserts what
 * is new at the tool: that it is registered, annotated read-only and schema-frozen like every
 * other tool, that a port this process holds reads as held BY this process, that a closed port
 * reads as free, and that a host naming another machine is `unknown` rather than a guess.
 */

type Handler = (args: Record<string, unknown>) => Promise<{
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}>;

function registerCli(cfg: Config = loadConfig()) {
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
  registerCliTools(mcp as never, cfg);
  return calls;
}

const listen = (): Promise<net.Server> =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => resolve(s));
  });

test("breakpoint_ports is registered on the CLI plane, read-only, schema-frozen, and takes no input", () => {
  const entry = registerCli().get("breakpoint_ports");
  assert.ok(entry, "registered");
  assert.ok(entry.config.outputSchema, "outputSchema injected");
  assert.ok(outputSchemas.breakpoint_ports, "declared in schemas.ts");
  assert.ok(ALL_ANNOTATED.includes("breakpoint_ports"), "on the annotation roster");
  const ann = annotationsFor("breakpoint_ports");
  assert.equal(ann.readOnlyHint, true, "it reads a table; it must never write");
  assert.equal(ann.idempotentHint, true);
  assert.equal(ann.destructiveHint, false);
  // lsof reads this machine's kernel table and nothing past it.
  assert.equal(ann.openWorldHint, false);
  assert.deepEqual(Object.keys(entry.config.inputSchema as Record<string, unknown>), []);
});

test("318: a port this process holds is held BY this process; the same port closed is free", async (t) => {
  const srv = await listen();
  const port = (srv.address() as net.AddressInfo).port;
  const cfg: Config = { ...loadConfig(), runtimeHost: "127.0.0.1", runtimePort: port };
  let closed = false;
  try {
    const res = await registerCli(cfg).get("breakpoint_ports")!.handler({});
    assert.notEqual(res.isError, true);
    const rows = structured<{ ports: PortRow[] }>(res).ports;
    assert.deepEqual(rows.slice(0, 4).map((r) => r.name), ["editor-bridge", "runtime-bridge", "gdscript-lsp", "gdscript-dap"]);
    const runtime = rows.find((r) => r.name === "runtime-bridge")!;
    assert.equal(runtime.port, port);
    assert.equal(runtime.state, "held", "a bound port is never reported free, whichever reader answered");
    if ((await readHolder("127.0.0.1", port)).kind === "unavailable") {
      assert.deepEqual(runtime.holders, []);
      assert.match(String(runtime.note), /^the holder could not be named: lsof is not installed$/);
      t.diagnostic("lsof is not on this runner; the holder arm is covered by port_holder.test.ts's injected output");
    } else {
      assert.equal(runtime.holders.length, 1);
      assert.equal(runtime.holders[0].pid, process.pid);
      assert.equal(runtime.holders[0].owner, "this_server");
      assert.equal(runtime.holders[0].id, null);
      assert.deepEqual(runtime.holders[0].addresses, [`127.0.0.1:${port}`]);
      assert.equal(runtime.note, null);
    }
    await new Promise<void>((r) => srv.close(() => r()));
    closed = true;
    const after = (await readPorts(cfg)).find((r) => r.name === "runtime-bridge")!;
    assert.equal(after.state, "free");
    assert.deepEqual(after.holders, []);
  } finally {
    if (!closed) srv.close();
  }
});

test("318: a host that is not this machine is unknown — nothing local can read another machine's listeners", async () => {
  const cfg: Config = { ...loadConfig(), lspHost: "192.0.2.10" };
  const lsp = (await readPorts(cfg)).find((r) => r.name === "gdscript-lsp")!;
  assert.equal(lsp.state, "unknown");
  assert.deepEqual(lsp.holders, []);
  assert.match(String(lsp.note), /192\.0\.2\.10 is not this machine's loopback/);
});
