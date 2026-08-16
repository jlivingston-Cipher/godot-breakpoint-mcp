import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  enablePlugin,
  installAddon,
  runInit,
  shellQuote,
} from "../src/cli/init.js";
import { mergeClientConfig, serverEntry } from "../src/cli/clients.js";
import type { FetchLike, HttpResponse } from "../src/cli/github.js";

/**
 * Tests for `breakpoint-mcp init`. The addon source is a tiny fixture (pointed at
 * via BREAKPOINT_ADDON_SRC), and every write goes to a temp project — nothing
 * touches the real user home. Client-config writing is tested through the
 * project-scoped VS Code target so no home-dir config is created.
 */

let dir: string;
let addonSrc: string;

const ENABLED_RES = "res://addons/breakpoint_mcp/plugin.cfg";

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "bpmcp-init-"));
  addonSrc = path.join(dir, "addon-src");
  fs.mkdirSync(addonSrc, { recursive: true });
  fs.writeFileSync(path.join(addonSrc, "plugin.cfg"), '[plugin]\nname="Breakpoint MCP"\nversion="9.9.9"\nscript="plugin.gd"\n');
  fs.writeFileSync(path.join(addonSrc, "plugin.gd"), "extends EditorPlugin\n");
});

after(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

function makeProject(godotBody = 'config_version=5\n\n[application]\n\nconfig/name="fix"\n'): string {
  const p = fs.mkdtempSync(path.join(dir, "proj-"));
  fs.writeFileSync(path.join(p, "project.godot"), godotBody);
  return p;
}

// ---- enablePlugin (pure) --------------------------------------------------

test("enablePlugin creates the [editor_plugins] section when absent", () => {
  const r = enablePlugin('config_version=5\n\n[application]\n\nconfig/name="x"\n');
  assert.equal(r.changed, true);
  assert.equal(r.alreadyEnabled, false);
  assert.match(r.text, /\[editor_plugins\]/);
  assert.ok(r.text.includes(ENABLED_RES));
});

test("enablePlugin fills an empty PackedStringArray", () => {
  const r = enablePlugin("[editor_plugins]\n\nenabled=PackedStringArray()\n");
  assert.equal(r.changed, true);
  assert.equal(r.text.includes(`PackedStringArray("${ENABLED_RES}")`), true);
});

test("enablePlugin appends without dropping an existing plugin", () => {
  const r = enablePlugin('[editor_plugins]\n\nenabled=PackedStringArray("res://addons/other/plugin.cfg")\n');
  assert.equal(r.changed, true);
  assert.ok(r.text.includes("res://addons/other/plugin.cfg"));
  assert.ok(r.text.includes(ENABLED_RES));
  assert.match(r.text, /PackedStringArray\("res:\/\/addons\/other\/plugin\.cfg", "res:\/\/addons\/breakpoint_mcp\/plugin\.cfg"\)/);
});

test("enablePlugin is a no-op when already enabled", () => {
  const src = `[editor_plugins]\n\nenabled=PackedStringArray("${ENABLED_RES}")\n`;
  const r = enablePlugin(src);
  assert.equal(r.changed, false);
  assert.equal(r.alreadyEnabled, true);
  assert.equal(r.text, src);
});

test("enablePlugin adds an enabled line to an existing empty section", () => {
  const r = enablePlugin("[editor_plugins]\n");
  assert.equal(r.changed, true);
  assert.ok(r.text.includes(`enabled=PackedStringArray("${ENABLED_RES}")`));
});

// ---- installAddon ---------------------------------------------------------

test("installAddon copies the addon into the project", () => {
  const proj = makeProject();
  const r = installAddon(addonSrc, proj, { force: false });
  assert.equal(r.action, "installed");
  assert.ok(fs.existsSync(path.join(proj, "addons", "breakpoint_mcp", "plugin.cfg")));
});

test("installAddon skips an existing addon without --force, overwrites with it", () => {
  const proj = makeProject();
  installAddon(addonSrc, proj, { force: false });
  const skipped = installAddon(addonSrc, proj, { force: false });
  assert.equal(skipped.action, "skipped");
  const forced = installAddon(addonSrc, proj, { force: true });
  assert.equal(forced.action, "overwritten");
});

// ---- client config merge --------------------------------------------------

test("mergeClientConfig preserves sibling servers", () => {
  const existing = JSON.stringify({ mcpServers: { other: { command: "x" } } });
  const entry = serverEntry("/p", "godot", false);
  const merged = JSON.parse(mergeClientConfig(existing, "mcpServers", "godot", entry)) as {
    mcpServers: Record<string, unknown>;
  };
  // 🔴 PRESERVED, NOT MERELY PRESENT. This read `assert.ok(merged.mcpServers.other)`
  // until 171 — and `{}` is truthy, so a merge that clobbered every sibling to an empty
  // object passed a test whose own name is "preserves sibling servers". Measured, not
  // supposed: `mutate171.sh` M2 made the merge do exactly that and this test stayed
  // green. A presence check cannot tell "kept" from "replaced with something".
  assert.deepEqual(merged.mcpServers.other, { command: "x" }, "the sibling server is preserved INTACT");
  assert.deepEqual(merged.mcpServers.godot, entry, "the new server is written as given");
});

test("serverEntry omits GODOT_BIN when default, includes it when custom, and adds type for vscode", () => {
  const def = serverEntry("/p", "godot", false) as { env: Record<string, string>; type?: string };
  assert.equal(def.env.GODOT_BIN, undefined);
  assert.equal(def.env.GODOT_PROJECT, "/p");
  assert.equal(def.type, undefined);
  const custom = serverEntry("/p", "/opt/godot", true) as { env: Record<string, string>; type?: string };
  assert.equal(custom.env.GODOT_BIN, "/opt/godot");
  assert.equal(custom.type, "stdio");
});

test("mergeClientConfig throws on invalid existing JSON (so init refuses to clobber)", () => {
  assert.throws(() => mergeClientConfig("{ not json", "mcpServers", "godot", {}));
});

// ---- runInit (end to end, via the fixture addon + temp project) -----------

async function capture(fn: () => Promise<number>): Promise<{ code: number; out: string }> {
  const orig = process.stdout.write.bind(process.stdout);
  let out = "";
  (process.stdout as unknown as { write: (c: string | Uint8Array) => boolean }).write = (
    c: string | Uint8Array,
  ) => {
    out += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
    return true;
  };
  try {
    const code = await fn();
    return { code, out };
  } finally {
    (process.stdout as unknown as { write: typeof orig }).write = orig;
  }
}

test("runInit installs, enables, and prints the snippet (default client)", async () => {
  const proj = makeProject();
  const savedSrc = process.env.BREAKPOINT_ADDON_SRC;
  const savedProj = process.env.GODOT_PROJECT;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc;
    delete process.env.GODOT_PROJECT;
    const { code, out } = await capture(() => runInit(["--project", proj, "--client", "none"]));
    assert.equal(code, 0);
    assert.ok(fs.existsSync(path.join(proj, "addons", "breakpoint_mcp", "plugin.cfg")));
    assert.ok(fs.readFileSync(path.join(proj, "project.godot"), "utf8").includes(ENABLED_RES));
    assert.match(out, /mcpServers/);
  } finally {
    if (savedSrc === undefined) delete process.env.BREAKPOINT_ADDON_SRC;
    else process.env.BREAKPOINT_ADDON_SRC = savedSrc;
    if (savedProj === undefined) delete process.env.GODOT_PROJECT;
    else process.env.GODOT_PROJECT = savedProj;
  }
});

// 🔴 THE REOPEN TRAP, AND ITS NEGATIVE CONTROL. `init` writes [editor_plugins] into
// project.godot; Godot reads that section at project load and never reloads it, so an
// editor that was already open when init ran keeps the plugin disabled and nothing on
// screen says why. The warning is worth nothing without the second claim: a run that
// changed no plugin state must NOT print it, or it degrades into text every user learns
// to skip — and the first assertion alone would still pass on a version that printed it
// unconditionally, which is the version that teaches people to stop reading.
test("runInit warns to reopen an already-open editor when it enabled the plugin", async () => {
  const proj = makeProject();
  const savedSrc = process.env.BREAKPOINT_ADDON_SRC;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc;
    const { code, out } = await capture(() => runInit(["--project", proj, "--client", "none"]));
    assert.equal(code, 0);
    assert.match(out, /ALREADY OPEN, close and reopen it/);
    assert.match(out, /does not reload/);
  } finally {
    if (savedSrc === undefined) delete process.env.BREAKPOINT_ADDON_SRC;
    else process.env.BREAKPOINT_ADDON_SRC = savedSrc;
  }
});

test("runInit does NOT warn to reopen when the plugin was already enabled", async () => {
  const proj = makeProject(
    'config_version=5\n\n[application]\n\nconfig/name="fix"\n\n[editor_plugins]\n\n' +
      `enabled=PackedStringArray("${ENABLED_RES}")\n`,
  );
  const savedSrc = process.env.BREAKPOINT_ADDON_SRC;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc;
    const { code, out } = await capture(() => runInit(["--project", proj, "--client", "none"]));
    assert.equal(code, 0);
    assert.match(out, /plugin: already enabled/);
    assert.equal(/ALREADY OPEN/.test(out), false, "no reopen warning when nothing changed");
    assert.match(out, /Next: open the project in Godot, then run/);
  } finally {
    if (savedSrc === undefined) delete process.env.BREAKPOINT_ADDON_SRC;
    else process.env.BREAKPOINT_ADDON_SRC = savedSrc;
  }
});

test("runInit --client vscode writes a project-scoped .vscode/mcp.json", async () => {
  const proj = makeProject();
  const savedSrc = process.env.BREAKPOINT_ADDON_SRC;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc;
    const { code } = await capture(() => runInit(["--project", proj, "--client", "vscode"]));
    assert.equal(code, 0);
    const cfgPath = path.join(proj, ".vscode", "mcp.json");
    assert.ok(fs.existsSync(cfgPath), "vscode config written");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as {
      servers: { godot: { type: string } };
    };
    assert.equal(cfg.servers.godot.type, "stdio");
  } finally {
    if (savedSrc === undefined) delete process.env.BREAKPOINT_ADDON_SRC;
    else process.env.BREAKPOINT_ADDON_SRC = savedSrc;
  }
});

// ---- the printed `claude mcp add` line, parsed by a shell ------------------
//
// 🔴 THE ASSERTION IS MADE BY /bin/sh, NOT BY A REGEX. What the defect was about is
// what a shell does with the line after the user pastes it, and a test that
// re-implements word-splitting is asserting against a copy of the thing it is
// supposed to be checking. `set --` splits and `printf` prints; nothing runs.
function shellWords(line: string): string[] {
  const out = execFileSync("/bin/sh", ["-c", `set -- ${line}; printf '%s\\0' "$@"`], {
    encoding: "utf8",
  });
  return out.split("\0").slice(0, -1);
}

function emittedAddLine(out: string): string {
  const line = out.split("\n").find((l) => l.includes("claude mcp add"));
  assert.ok(line, "init printed a `claude mcp add` line");
  return line.trim();
}

test("the printed `claude mcp add` line survives a shell when the project path has a space", async () => {
  const proj = fs.mkdtempSync(path.join(dir, "pro j-"));
  fs.writeFileSync(path.join(proj, "project.godot"), 'config_version=5\n\n[application]\n\nconfig/name="fix"\n');
  assert.ok(proj.includes(" "), "fixture path really does contain a space");
  const savedSrc = process.env.BREAKPOINT_ADDON_SRC;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc;
    const { code, out } = await capture(() => runInit(["--project", proj, "--client", "claude-code"]));
    assert.equal(code, 0);
    const words = shellWords(emittedAddLine(out));
    assert.deepEqual(words.slice(0, 3), ["claude", "mcp", "add"]);
    // The whole KEY=value is ONE word and the value is the WHOLE path.
    assert.equal(words[words.indexOf("--env") + 1], `GODOT_PROJECT=${proj}`);
    // And nothing was left over: the tail is exactly the server command.
    assert.deepEqual(words.slice(-4), ["--", "npx", "-y", "breakpoint-mcp"]);
  } finally {
    if (savedSrc === undefined) delete process.env.BREAKPOINT_ADDON_SRC;
    else process.env.BREAKPOINT_ADDON_SRC = savedSrc;
  }
});

// 🔴 AND ITS POSITIVE CONTROL, WHICH IS THE LINE AS IT SHIPPED THROUGH 250. A shell
// splitter that could not tell the two apart would pass the test above for the same
// reason a correct one does — 250 §6.3's rule, applied to a parser instead of a
// reader. This is the exact string `claudeCodeCommand` used to build, and the
// splitter must report the truncation: `--env` gets a path cut at the first space,
// and the remainder arrives as stray positionals `claude mcp add` never asked for.
test("the pre-251 unquoted line DOES misparse — the splitter can tell the difference", () => {
  const projectPath = "/Users/x/Godot Projects/My Game";
  const before = `claude mcp add godot --env GODOT_PROJECT=${projectPath} -- npx -y breakpoint-mcp`;
  const words = shellWords(before);
  assert.equal(words[words.indexOf("--env") + 1], "GODOT_PROJECT=/Users/x/Godot");
  assert.ok(words.includes("Projects/My"), "the rest of the path became a stray argument");
  assert.ok(words.includes("Game"), "and so did the rest of it");
  assert.equal(
    words.includes(`GODOT_PROJECT=${projectPath}`),
    false,
    "the intended value never reaches the shell",
  );
});

test("an ordinary project path is NOT quoted — the safe set stays readable", async () => {
  const proj = makeProject();
  assert.equal(/[^A-Za-z0-9_@%+=:,./-]/.test(proj), false, "fixture path is in the safe set");
  const savedSrc = process.env.BREAKPOINT_ADDON_SRC;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc;
    const { code, out } = await capture(() => runInit(["--project", proj, "--client", "claude-code"]));
    assert.equal(code, 0);
    assert.match(emittedAddLine(out), new RegExp(`--env GODOT_PROJECT=${proj} --`));
  } finally {
    if (savedSrc === undefined) delete process.env.BREAKPOINT_ADDON_SRC;
    else process.env.BREAKPOINT_ADDON_SRC = savedSrc;
  }
});

test("shellQuote carries an apostrophe through a shell intact", () => {
  const nasty = `/Users/x/Player's Game/a b`;
  assert.deepEqual(shellWords(`printf-placeholder ${shellQuote(nasty)}`).slice(1), [nasty]);
  // The characters a shell would otherwise eat, one round trip each.
  for (const word of [`a b`, `a'b`, `a"b`, `a$b`, `a;b`, `a\`b`, `a*b`, `a\\b`, `a|b`, ``]) {
    assert.deepEqual(shellWords(`x ${shellQuote(word)}`).slice(1), [word], `round trip: ${JSON.stringify(word)}`);
  }
});

test("runInit --dry-run writes nothing", async () => {
  const proj = makeProject();
  const savedSrc = process.env.BREAKPOINT_ADDON_SRC;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc;
    const { code } = await capture(() => runInit(["--project", proj, "--dry-run", "--client", "none"]));
    assert.equal(code, 0);
    assert.equal(fs.existsSync(path.join(proj, "addons", "breakpoint_mcp")), false);
    assert.equal(fs.readFileSync(path.join(proj, "project.godot"), "utf8").includes(ENABLED_RES), false);
  } finally {
    if (savedSrc === undefined) delete process.env.BREAKPOINT_ADDON_SRC;
    else process.env.BREAKPOINT_ADDON_SRC = savedSrc;
  }
});

test("runInit fails clearly when the target has no project.godot", async () => {
  const empty = fs.mkdtempSync(path.join(dir, "empty-"));
  const savedSrc = process.env.BREAKPOINT_ADDON_SRC;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc;
    const { code } = await capture(() => runInit(["--project", empty]));
    assert.equal(code, 1);
  } finally {
    if (savedSrc === undefined) delete process.env.BREAKPOINT_ADDON_SRC;
    else process.env.BREAKPOINT_ADDON_SRC = savedSrc;
  }
});

// ---- runInit --from-github (injected fetch) -------------------------------

/** A fake GitHub fetch: git/trees lists the given files, raw serves their bodies. */
function ghFetch(files: Record<string, string>): FetchLike {
  const tree = {
    truncated: false,
    tree: Object.keys(files).map((f) => ({ path: `addons/breakpoint_mcp/${f}`, type: "blob" })),
  };
  return async (url: string): Promise<HttpResponse> => {
    if (url.includes("/git/trees/")) {
      return { ok: true, status: 200, json: async () => tree, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    const name = url.split("/breakpoint_mcp/")[1] ?? "";
    const body = files[name];
    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
    }
    const bytes = Uint8Array.from(new TextEncoder().encode(body));
    return { ok: true, status: 200, json: async () => ({}), arrayBuffer: async () => bytes.buffer };
  };
}

test("runInit --from-github installs the fetched addon", async () => {
  const proj = makeProject();
  const fetchFn = ghFetch({
    "plugin.cfg": '[plugin]\nname="Breakpoint MCP"\nversion="9.9.9"\nscript="plugin.gd"\n',
    "plugin.gd": "extends EditorPlugin\n",
  });
  const { code, out } = await capture(() =>
    runInit(["--project", proj, "--from-github", "main", "--client", "none"], { fetchFn }),
  );
  assert.equal(code, 0);
  assert.ok(fs.existsSync(path.join(proj, "addons", "breakpoint_mcp", "plugin.cfg")));
  assert.ok(fs.readFileSync(path.join(proj, "project.godot"), "utf8").includes(ENABLED_RES));
  assert.match(out, /from GitHub/);
});

test("runInit --from-github --dry-run fetches nothing and writes nothing", async () => {
  const proj = makeProject();
  let called = false;
  const fetchFn: FetchLike = async () => {
    called = true;
    return { ok: false, status: 500, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const { code, out } = await capture(() =>
    runInit(["--project", proj, "--from-github", "--dry-run", "--client", "none"], { fetchFn }),
  );
  assert.equal(code, 0);
  assert.equal(called, false, "dry-run must not hit the network");
  assert.equal(fs.existsSync(path.join(proj, "addons", "breakpoint_mcp")), false);
  assert.match(out, /would fetch/);
});

test("runInit --from-github returns 1 and installs nothing when the fetch fails", async () => {
  const proj = makeProject();
  const fetchFn: FetchLike = async () => ({
    ok: false,
    status: 404,
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  });
  const { code } = await capture(() => runInit(["--project", proj, "--from-github", "main"], { fetchFn }));
  assert.equal(code, 1);
  assert.equal(fs.existsSync(path.join(proj, "addons", "breakpoint_mcp")), false);
});

/**
 * 🔴 THE COMMAND THAT PINNED THE SKEW AND SAID `skipped` (258 §2). `installAddon`
 * tested `fs.existsSync(dest/plugin.cfg)` and returned — the destination file was
 * located and never opened — so a user upgrading the host and re-running `init`,
 * which is exactly what the docs tell them to do, kept their old addon forever and
 * was told nothing. The transcript for a correct re-run and a permanently broken
 * one were the same six characters.
 */
test("init warns on stderr when it skips an addon OLDER than the bundled one", async () => {
  const proj = makeProject();
  const oldAddon = path.join(proj, "addons", "breakpoint_mcp");
  fs.mkdirSync(oldAddon, { recursive: true });
  fs.writeFileSync(path.join(oldAddon, "plugin.cfg"), '[plugin]\nname="Breakpoint MCP"\nversion="1.1.0"\n');

  const errs: string[] = [];
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    errs.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc; // version 9.9.9 — newer than 1.1.0
    await runInit(["--project", proj, "--client", "none"]);
  } finally {
    process.stderr.write = write;
    delete process.env.BREAKPOINT_ADDON_SRC;
  }
  const stderr = errs.join("");
  assert.match(stderr, /OLDER than the one this host ships/);
  assert.match(stderr, /1\.1\.0 vs 9\.9\.9/, "both sides of the pair, not just a verdict");
  assert.match(stderr, /--force/, "the flag plain `init` needed and the remedy never said");
  // And it really did leave the old one — the warning is about a thing that happened.
  assert.match(fs.readFileSync(path.join(oldAddon, "plugin.cfg"), "utf8"), /version="1\.1\.0"/);
});

test("init stays quiet when the skip was over an addon that is already current", async () => {
  const proj = makeProject();
  const cur = path.join(proj, "addons", "breakpoint_mcp");
  fs.mkdirSync(cur, { recursive: true });
  fs.writeFileSync(path.join(cur, "plugin.cfg"), '[plugin]\nname="Breakpoint MCP"\nversion="9.9.9"\n');

  const errs: string[] = [];
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    errs.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    process.env.BREAKPOINT_ADDON_SRC = addonSrc;
    await runInit(["--project", proj, "--client", "none"]);
  } finally {
    process.stderr.write = write;
    delete process.env.BREAKPOINT_ADDON_SRC;
  }
  // 🔴 THE NEGATIVE CONTROL, AND IT IS NOT DECORATION. `init` is documented as
  // idempotent and re-running it is the normal thing to do; a warning on every skip
  // is noise on the correct path, and noise on the correct path is how a warning
  // stops being read on the wrong one.
  assert.doesNotMatch(errs.join(""), /OLDER than/);
});
