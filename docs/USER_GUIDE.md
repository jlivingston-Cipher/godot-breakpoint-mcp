# Breakpoint MCP — User Guide

Welcome. This guide walks you, start to finish, through installing and using
**Breakpoint MCP** — a bridge that lets an AI assistant work inside the Godot game engine.
It is written for a Godot developer who has never seen the tool before. No prior
knowledge of the Model Context Protocol (MCP) is assumed.

- **Version:** host 1.77.0 · addon 1.11.0
- **License:** MIT
- **What it exposes:** full 292 tools (secure-default 279 with the privileged group off) + 6 MCP resources
- **Requires:** Node.js ≥ 18 and Godot 4.2+ (4.4+ recommended)

---

## Table of contents

1. [Introduction — what it is and who it's for](#1-introduction)
2. [Requirements](#2-requirements)
3. [Installation](#3-installation)
4. [Registering with an MCP client](#4-registering-with-an-mcp-client)
5. [Configuration (environment variables)](#5-configuration)
6. [Concepts: the four planes, the addon vs. the host, and MCP resources](#6-concepts)
7. [Quick start: your first end-to-end session](#7-quick-start)
8. [Tool reference by family](#8-tool-reference-by-family)
9. [The safety and trust model](#9-the-safety-and-trust-model)
10. [Typical workflows](#10-typical-workflows)
11. [Troubleshooting](#11-troubleshooting)
12. [FAQ](#12-faq)
13. [Further reference](#13-further-reference)

---

## 1. Introduction

Breakpoint MCP is a **Model Context Protocol (MCP) server** that connects an
MCP-compatible AI assistant to a live Godot project. With it, your assistant can move
past writing snippets you paste by hand and instead work the way you do: author scenes,
write type-checked GDScript, run the project, inspect and debug it, and drive the running
game directly.

It is developed and tested with **Claude** (Claude Code or Claude Desktop), which is the
primary supported client. Because MCP is an open protocol, other clients — such as Cursor,
VS Code, and Windsurf — can connect too; those combinations are not yet tested. Section 4
covers how to configure each one, and we'd love for you to report how it goes.

It has two pieces that work together:

- A **TypeScript host** (the npm package `breakpoint-mcp`). Your MCP client launches this
  and talks to it over stdio. The host is the MCP server; it holds all the tool
  definitions and speaks to Godot on your behalf.
- A **Godot editor addon** (`addons/breakpoint_mcp/`) that you drop into your project.
  When enabled, it opens small local servers that the host connects to — one inside the
  editor, and one inside the running game.

Everything runs on your machine. All sockets bind to loopback (`127.0.0.1`), and every
edit the AI makes in the editor goes through Godot's own undo system, so a single
**Ctrl-Z** reverts it.

### Who it's for

- **Godot developers** who want an AI assistant that can actually operate the editor
  and the debugger, not just suggest code.
- **GDScript** users get the fullest experience: type-aware code intelligence and a real
  step-debugger. There is also a **C#/.NET** plane (semantic analysis and debugging) for
  projects that use Mono.
- Anyone who prefers a **local-only, undoable, confirmation-gated** setup where the AI
  asks before doing anything destructive.

### What it can do

- Read and edit scenes and nodes with full undo/redo.
- Write GDScript with completion, hover, go-to-definition, references, rename, and
  diagnostics — using Godot's own language server.
- Set breakpoints, step through code, and read live stack frames, scopes, and variables.
- Launch the project, capture its console output, and export or import it headlessly.
- Reach into the *running* game to read and set properties, call methods, inject input,
  read performance monitors, and grab in-game screenshots.

---

## 2. Requirements

| Requirement | Notes |
|---|---|
| **Node.js ≥ 18** | Runs the host. Node 18, 20, and 22 are all exercised in CI. |
| **Godot 4.2+** | Minimum supported editor. **4.4+ is recommended** — several editor tools use APIs added in 4.4. |
| **A desktop with a display / GPU** | The editor bridge, viewport screenshots, and the running game need a real display. This is a developer-machine tool, not a headless-server tool. |
| **An MCP client** | Claude Code or Claude Desktop are the tested clients; other MCP clients can also connect. |

A few capabilities are **version-gated** and light up only on newer Godot builds. These
degrade gracefully — if your Godot build does not support one, the tool returns a clear
"unsupported" message rather than erroring. Notable examples:

- **Godot 4.4+** — enumerating unsaved scenes (`scene_list_open`), closing a scene
  (`scene_close`).
- **Godot 4.5+** — zero-configuration capture of the *running game's* console
  (`print()`, warnings, errors) through the runtime bridge.
- Some semantic/debug features are feature-detected per Godot build and per language
  server, and become available automatically once your engine implements them.

For **C# support** you also need the relevant tooling installed and on your `PATH`:
OmniSharp (for the C# language server) and netcoredbg (for the C# debugger). Both are
launched lazily — if you do not use the C# tools, nothing is spawned and you pay nothing.

---

## 3. Installation

There are two halves to install: the **editor addon** into your Godot project, and the
**host** that your MCP client runs.

### 3.0 Quick start (one command)

If you just want the fastest path, run this from your project folder — it installs and
enables the addon and prints your MCP-client config:

```bash
npx breakpoint-mcp init
```

Then open the project in Godot and check everything is wired up:

```bash
npx breakpoint-mcp doctor
```

`breakpoint-mcp --version` prints the installed host version on one line — that is the
number the bug-report template asks for, and it is worth quoting in any issue you file.

> **If the project was already open in Godot when you ran `init`, reopen it.** `init`
> enables the plugin by writing `[editor_plugins]` into `project.godot`, and Godot reads
> that file at project load — it does not hot-reload it. An editor that was already
> running keeps the plugin disabled, the editor bridge never starts, and `doctor
> --require-live` reports it as down. Closing the project and opening it again is the fix.

> **When you upgrade the host, re-run `init --force`.** The addon ships *inside* the host
> package and moves on its own version line, so upgrading `breakpoint-mcp` puts a newer addon
> in the package and changes nothing in your project. Plain `init` **skips** an addon that is
> already installed — that is what makes it safe to re-run — so the upgrade needs `--force`,
> and Godot loads addon scripts at project load, so close and reopen the project afterwards.
> `doctor` reports the comparison directly: `addon-version` for the copy on disk and
> `addon-running-editor` / `addon-running-runtime` for the copy each live plane is actually
> running, which is the one that diverges after a `--force` you have not reopened for yet.

`init` copies the addon into `addons/breakpoint_mcp/`, enables it in `project.godot`, and
prints the client config snippet — pass `--client claude-desktop|cursor|windsurf|vscode` to
write it directly, or `--client claude-code` for the CLI command; `--dry-run` previews and
`--force` overwrites an existing addon. `doctor` verifies the Godot binary, the addon, and
the four bridges — add `--require-live` once the editor is open (that requires the three
the editor brings up; the runtime bridge only exists while the game is running, so
`--require-live=all` is the one that demands all four), or `--json` for a machine-readable
report. The sections below explain each step in full if you would rather do
it by hand or understand what `init` did.

### 3.1 Install the editor addon into your project

1. Copy the `addons/breakpoint_mcp/` folder into your project's `addons/` directory
   (or symlink it during development).
2. Open your project in the Godot editor.
3. Enable the plugin: **Project → Project Settings → Plugins → Breakpoint MCP**.

On enable, the addon:

- Opens the **editor bridge** on `127.0.0.1:9080`. Confirm it in the **Output** panel:

  ```
  [breakpoint_mcp] listening on 127.0.0.1:9080
  ```

- Auto-registers the **runtime autoload** (`BreakpointRuntimeBridge`) so the in-game
  tools work the moment you run the project — no manual autoload setup needed. When the
  game runs, its Output shows:

  ```
  BreakpointRuntimeBridge listening on 127.0.0.1:9081
  ```

- Adds a **Breakpoint MCP** dock to the editor (right side). It reports the live health of
  the editor / runtime / LSP / DAP bridges, shows the ports and project path, and has a
  one-click **Copy MCP-client config** button — the in-editor twin of `doctor` + `init`.
  Status/config only: the AI assistant runs in your MCP client, not the editor.

Godot's **language server** (LSP, port 6005) and **debug adapter** (DAP, port 6006) are
built into the editor and enabled by default while it is open. The semantic (`gd_*`) and
debugging (`dbg_*`) tools use them directly — no addon required for those. You can review
or change their ports under **Editor → Editor Settings → Network → Language Server** and
**Debug Adapter**.

> Disabling the plugin removes the runtime autoload entry it added, cleanly reverting your
> project to its prior state.

### 3.2 Get the host

The host is published to npm as **`breakpoint-mcp`**. The simplest option is to let your
MCP client run it with `npx` (no separate install step):

```bash
npx breakpoint-mcp
```

Or install it explicitly:

```bash
npm install -g breakpoint-mcp
```

**Building from source** (if you cloned the repository):

```bash
cd host
npm install      # needs npm registry access
npm run build    # compiles TypeScript to dist/
```

That produces `host/dist/index.js`, the entry point your MCP client runs.

---

## 4. Registering with an MCP client

Point your MCP client at the host. You can name the server anything; the examples use
`godot`. **Claude (Claude Code and Claude Desktop) is the primary, tested client.** MCP is
an open protocol, so the other clients below should work with the same command and
environment variables — but they are not yet tested with this server, and we'd welcome a
report of how it goes. Every client runs the host the same way (`npx breakpoint-mcp`, or
`node …/dist/index.js` for a local build); only the config file and the wrapper key differ.

### Claude Code

Using the published package:

```bash
claude mcp add godot -- npx breakpoint-mcp
```

Or a local build:

```bash
claude mcp add godot -- node /abs/path/to/host/dist/index.js
```

Pass configuration with `--env` (see [Configuration](#5-configuration)):

```bash
claude mcp add godot \
  --env GODOT_BIN=/abs/path/to/Godot \
  --env GODOT_PROJECT=/abs/path/to/your/project \
  -- npx breakpoint-mcp
```

**If either path contains a space, quote the whole `KEY=value` word** — `--env 'GODOT_PROJECT=/Users/you/Godot Projects/My Game'`. Unquoted, the shell hands `claude mcp add` a path truncated at the first space plus two stray arguments, and nothing complains: the server is configured, pointing at a directory that does not exist. `breakpoint-mcp init --client claude-code` prints this line already quoted for you.

### Claude Desktop

Add an entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["breakpoint-mcp"],
      "env": {
        "GODOT_BIN": "/abs/path/to/Godot",
        "GODOT_PROJECT": "/abs/path/to/your/project",
        "BREAKPOINT_BRIDGE_PORT": "9080"
      }
    }
  }
}
```

If you built from source, use `"command": "node"` and
`"args": ["/abs/path/to/host/dist/index.js"]` instead.

### Other MCP clients

These are untested with Breakpoint MCP but use the same host command. The configuration
formats below follow each client's own documentation (as of mid-2026); if something has
moved, check your client's current MCP docs.

**Cursor** — add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project root),
using the same shape as Claude Desktop:

```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["breakpoint-mcp"],
      "env": {
        "GODOT_BIN": "/abs/path/to/Godot",
        "GODOT_PROJECT": "/abs/path/to/your/project"
      }
    }
  }
}
```

**VS Code** (Copilot agent mode) — add to `.vscode/mcp.json`. Note the top-level key is
`servers` (not `mcpServers`), and each entry declares its transport `type`:

```json
{
  "servers": {
    "godot": {
      "type": "stdio",
      "command": "npx",
      "args": ["breakpoint-mcp"],
      "env": {
        "GODOT_BIN": "/abs/path/to/Godot",
        "GODOT_PROJECT": "/abs/path/to/your/project"
      }
    }
  }
}
```

**Windsurf** (Cascade) — add to `~/.codeium/windsurf/mcp_config.json`, using the same
`mcpServers` shape as Cursor / Claude Desktop.

**Any other MCP client** — configure a local **stdio** server whose command is
`npx breakpoint-mcp` (or `node /abs/path/to/host/dist/index.js`) and pass the environment
variables from [Configuration](#5-configuration). Consult your client's MCP docs for the
exact file location and JSON shape.

Because the tool descriptions were written and tuned with Claude, a different model may
choose or sequence the tools differently. If you hit rough edges with a specific client or
model, an issue with the details helps us make it better for everyone.

Restart or refresh the client so it picks up the new server. The client should then see the
`godot_*`, `editor_*`, `scene_*`, `node_*`, `gd_*`, `dbg_*`, `runtime_*` (and other) tools
plus the `godot://…` resources.

---

## 5. Configuration

All configuration is by environment variable, so the same host works across projects and
machines with no code changes. Every value has a sensible default — a minimal setup only
needs `GODOT_BIN` and `GODOT_PROJECT`. These names come straight from the host's
`config.ts`.

### Core

| Variable | Default | Meaning |
|---|---|---|
| `GODOT_BIN` | `godot` | Path to the Godot editor binary. |
| `GODOT_PROJECT` | current working dir | Project directory (the folder containing `project.godot`). |

### Editor bridge (Plane A)

| Variable | Default | Meaning |
|---|---|---|
| `BREAKPOINT_BRIDGE_HOST` | `127.0.0.1` | Editor-bridge host. |
| `BREAKPOINT_BRIDGE_PORT` | `9080` | Editor-bridge port. Must match the addon. |
| `BREAKPOINT_BRIDGE_TIMEOUT_MS` | `15000` | Per-request timeout for editor tools. |

### GDScript language server + debug adapter (Plane D — GDScript)

| Variable | Default | Meaning |
|---|---|---|
| `GODOT_LSP_HOST` | `127.0.0.1` | GDScript language server host. |
| `GODOT_LSP_PORT` | `6005` | GDScript language server port. |
| `GODOT_LSP_TIMEOUT_MS` | `15000` | Language server request timeout. |
| `GODOT_DAP_HOST` | `127.0.0.1` | Debug adapter host. |
| `GODOT_DAP_PORT` | `6006` | Debug adapter port. |
| `GODOT_DAP_TIMEOUT_MS` | `20000` | Debug adapter request timeout. |
| `GODOT_DAP_SETVAR_TIMEOUT_MS` | `8000` | Shorter bound for `dbg_set_variable` (fails fast if an adapter never answers). |
| `GODOT_DAP_EVALUATE_TIMEOUT_MS` | `8000` | Shorter bound for `dbg_evaluate`. |

### C#/.NET semantic + debugging (Plane D — C#)

The C# language server (OmniSharp) and .NET debugger (netcoredbg) are **spawned by the
host over stdio** — so they are a command + args + working directory, not a host/port.
Both launch lazily on first use.

| Variable | Default | Meaning |
|---|---|---|
| `GODOT_CSHARP_PROJECT` | value of `GODOT_PROJECT` | C# project root (often a dedicated C# project). |
| `GODOT_CSLSP_CMD` | `OmniSharp` | Command to launch the C# language server. |
| `GODOT_CSLSP_ARGS` | `-lsp` | Arguments for that command. |
| `GODOT_CSLSP_TIMEOUT_MS` | `30000` | C# language server timeout. |
| `GODOT_CSDAP_CMD` | `netcoredbg` | Command to launch the .NET debug adapter. |
| `GODOT_CSDAP_ARGS` | `--interpreter=vscode` | Arguments for that command. |
| `GODOT_CSHARP_BIN` | falls back to `GODOT_BIN` | Program `cs_dbg_launch` launches by default (the Mono/.NET Godot binary). |
| `GODOT_CSDAP_TIMEOUT_MS` | `20000` | C# debug adapter timeout. |
| `GODOT_CSDAP_SETVAR_TIMEOUT_MS` | `8000` | Shorter bound for `cs_dbg_set_variable`. |
| `GODOT_CSDAP_EVALUATE_TIMEOUT_MS` | `8000` | Shorter bound for `cs_dbg_evaluate`. |

### Runtime bridge (Plane C)

| Variable | Default | Meaning |
|---|---|---|
| `BREAKPOINT_RUNTIME_HOST` | `127.0.0.1` | In-game runtime-bridge host. |
| `BREAKPOINT_RUNTIME_PORT` | `9081` | In-game runtime-bridge port. Must match the autoload. |
| `BREAKPOINT_RUNTIME_TIMEOUT_MS` | `15000` | Runtime request timeout. |

### Capability groups (least-privilege, opt-in)

Two **default-OFF** capability groups gate the higher-blast tools; with both off, those tools are
**dropped at registration** (never listed), giving a **secure-default surface of 279 tools**. Opt in
to load the **full 292**. `breakpoint-mcp init --trust full` sets this for you, and
`breakpoint-mcp doctor` reports each group's state. See
[The safety and trust model](#9-the-safety-and-trust-model).

| Variable | Default | Meaning |
|---|---|---|
| `BREAKPOINT_PRIVILEGED_GROUPS` | *(empty → none)* | Comma/space list of groups to enable: `code-execution` (runs GDScript / invokes arbitrary methods / paused-frame `evaluate` / the local asset-gen `command` backend), or `all`. There is no `network` group: nothing on the surface egresses beyond loopback. |

### AI asset generation (opt-in)

Asset generation is **off by default**. See
[The safety and trust model](#9-the-safety-and-trust-model) before enabling the
`command` backend.

| Variable | Default | Meaning |
|---|---|---|
| `BREAKPOINT_ASSETGEN_BACKEND` | `none` | One of `none`, `placeholder`, or `command`. |
| `BREAKPOINT_ASSETGEN_CMD` | *(empty)* | Argv template for the `command` backend; tokens `{kind} {prompt} {output} {width} {height} {format}` are substituted per-argument (no shell). |
| `BREAKPOINT_ASSETGEN_PROVIDER` | *(empty)* | Optional provider hint. |
| `BREAKPOINT_ASSETGEN_TIMEOUT_MS` | `120000` | Timeout for a generation call. |

### Resource subscriptions

| Variable | Default | Meaning |
|---|---|---|
| `BREAKPOINT_RESOURCE_COALESCE_MS` | `50` | Coalescing window for pushed resource updates. `0` disables coalescing. |

> **Renamed from `CLAUDE_*`:** the `BREAKPOINT_*`-prefixed variables (`BREAKPOINT_BRIDGE_*`,
> `BREAKPOINT_RUNTIME_*`, `BREAKPOINT_RESOURCE_COALESCE_MS`) were named `CLAUDE_*` in earlier
> versions. The legacy `CLAUDE_*` names were honoured with a one-time deprecation warning in
> `1.0.0` and **removed in `1.1.0`** — use the `BREAKPOINT_*` names above. `GODOT_*` variables
> are unaffected.

**Ports at a glance:** `9080` editor bridge · `9081` runtime bridge · `6005` GDScript
language server · `6006` debug adapter. If any is already in use, override the matching
variable — and if you change the bridge or runtime port, set it **both** on the host and
before launching Godot so the addon binds the same port.

---

## 6. Concepts

Breakpoint MCP organizes its tools into **four planes**, each corresponding to a distinct
way of reaching into Godot. Understanding them makes it clear which tools work when.

### The host and the addon

- The **host** is the MCP server your client runs. It owns every tool and speaks four
  different protocols out to Godot.
- The **addon** is a Godot `EditorPlugin` in your project. When enabled, it opens the
  editor bridge (in the editor) and registers the runtime bridge (in the running game).

Some planes need only the host and the Godot binary (they shell out to Godot on the
command line). Others need the editor open with the addon enabled, or the game running.

```
┌───────────────── MCP client (Claude Code / Desktop, …) ─────────────────┐
│                            MCP over stdio                                │
└──────────────────────────────────┬──────────────────────────────────────┘
                          host (TypeScript MCP server)
   ┌─────────────┬──────────────┬───────────────┬─────────────┬────────────┐
 spawn Godot   TCP :9080      TCP :9081       TCP :6005     TCP :6006
 (headless)    editor addon   in-game         GDScript LSP  Godot DAP
 Plane B       Plane A        autoload        Plane D       Plane D
               scenes/nodes   Plane C         completion,   breakpoints,
               /undo/redo     live SceneTree  diagnostics   stepping, eval
```

### Plane A — Live Editor Bridge (toolset `a` → 148 tools)

The largest plane. It drives the editor through the addon's loopback server on
`127.0.0.1:9080`, so it **requires the editor open with the plugin enabled**. It covers
scene, node, and resource CRUD with **full undo/redo**, project settings, `ClassDB`
introspection, selection, and editor screenshots — plus a broad set of authoring
families: animation, tilemaps, physics/collision, particles and audio, UI/Control and
theming, 3D and navigation, the input map, native multiplayer authoring, backend-SDK
scaffolding, AI asset generation, and read-only knowledge/lookup tools. Every mutation
here is wrapped in Godot's undo system.

Four sibling toolsets ride the same bridge and are counted separately: `netcode` → 7,
`backend` → 5, `assetgen` → 7, and `tabletop` → 14 (multiplayer authoring, backend-SDK
scaffolding, AI asset generation, and card/board/piece authoring). So
`a,netcode,backend,assetgen,tabletop` → 181 tools require the editor open, not the 148
above alone.

### Plane B — Headless CLI (`godot_*`)

Runs the Godot binary on the command line. **Works with no editor open.** Use it to check
the version, launch the editor, run the project, export or import, and run headless
scripts or test suites. It also includes **managed-process capture**
(`godot_run_managed` / `godot_output` / `godot_stop`) so the assistant can read the game's full
`print()` / error console.

Long-running jobs — `godot_export`, `godot_import`, and `godot_run_headless_script` — run
on the formal **MCP task model**: a task-aware client creates the job and then polls it,
or cancels it while it runs. A plain
client still gets the blocking result, exactly as before.

### Plane C — Runtime Bridge (`runtime_*`, 27 tools)

An autoload (`BreakpointRuntimeBridge`) that lives inside the **running game** and listens
on `127.0.0.1:9081`. Through it, the assistant can read the live SceneTree, get and set runtime
properties, call methods, emit signals, inject input for play-testing, read performance
monitors, and capture in-game frames. It also runs a family of **read-only runtime
assertions** — node state, scene structure, on-screen text, performance baselines, and
screenshot diffs — for checking a running game the way a test would. It also carries the
**deterministic playtesting** primitives — freeze time, step an exact number of frames, seed the
global RNG, and take a stable-ordered state digest — and can point all four at **several headless
peers at once** (see below). On **Godot 4.5+** it additionally captures the
game's console (`print()`, warnings, errors) with zero configuration.

### Plane D — Semantic and Debugging

Two protocols Godot already speaks:

- **GDScript language server** (`gd_*`, port 6005): completion, hover, definition and
  references, rename, document symbols, diagnostics, and signature help.
- **Godot debug adapter** (`dbg_*`, port 6006): real breakpoints, stepping, stack traces,
  scopes and variables, watch expressions, and expression evaluation. The per-line
  **modifiers** — conditional, hit-count and logpoint — are accepted and **feature-detected**:
  Godot's adapter advertises all three unsupported and ignores them outright, so on such a
  build they are **dropped and reported** rather than sent. That matters because an ignored
  condition does not make the breakpoint inert, it makes it halt *every time* — the opposite
  of the request. See `dbg_set_breakpoints` in the tool catalog for what the result carries.

There is also a **C# plane**: `cs_*` (semantic, via OmniSharp) and `cs_dbg_*` (debugging,
via netcoredbg). Many capabilities across this plane are **feature-detected** per Godot
build and per adapter; where a capability is not implemented, the tool returns a clear
"unsupported" message instead of hanging or erroring.

### The 6 MCP resources

Alongside tools, the host exposes six **resources** — read-mostly context the assistant can pull
on demand:

| URI | Source |
|---|---|
| `godot://scene-tree` | The edited scene tree (editor bridge). |
| `godot://editor-state` | Edited scene + current selection (editor bridge). |
| `godot://runtime/tree` | The running game's live SceneTree (runtime bridge). |
| `godot://runtime/log` | The running game's log buffer (runtime bridge). |
| `godot://class/{name}` | `ClassDB` docs for a class (editor bridge; URI template). |
| `godot://capabilities` | The capability groups, their enabled/disabled state, and the tools each gates (host; **always on** — registered unconditionally, even when the `resources` toolset is filtered out, so a dropped high-trust tool is never a silent gap). |

Clients can **subscribe** to a resource and be pushed a
`notifications/resources/updated` when a subscribed resource changes — for example when the
editor selection or edited scene changes, or when the running game's SceneTree gains,
loses, or renames a node. Rapid changes are coalesced per URI (see
`BREAKPOINT_RESOURCE_COALESCE_MS`). Each resource degrades to
`{ "available": false, "note": "..." }` when the editor or game is not reachable.

---

## 7. Quick start

This is a first end-to-end session that touches every plane. Ask your assistant to perform these
steps in order; the tool names show what happens under the hood. It assumes you have the
addon enabled and the host registered (Sections 3–4).

**1. Open the editor and confirm the bridge is live.**

- `godot_launch_editor` (or just open the project yourself).
- `editor_ping` → expect `{ pong: true, addon_version: …, godot: "4.x" }`.

**2. Inspect the scene and the API.**

- `editor_get_state` → confirms a scene is open and shows the root type and selection.
- `scene_get_tree` → the node tree.
- `classdb_get_class` (e.g. `AudioStreamPlayer3D`) → its methods, properties, and signals.

**3. Make an undoable change.**

- `node_add` `{ parent_path: ".", type: "AudioStreamPlayer3D", name: "SFX" }`.
- `node_set_property` `{ path: "Sprite2D", property: "position",
  value: { "__type__": "Vector2", "x": 10, "y": 20 } }`.
- Press **Ctrl-Z** in the editor — the change reverts. (Or call `editor_undo`.)

**4. Write and check GDScript.**

- `gd_completion` while editing a script → type-aware suggestions.
- `gd_diagnostics` on the script → catch errors *before* running. Introduce a typo and
  re-run to see it flagged.

**5. Run the project and see it.**

- `godot_run_project` (or `godot_run_managed` to also capture console output). Both wait until
  the game's runtime bridge answers and report `bridge_ready`, so the next `runtime_*` call has
  something to reach; both refuse if the runtime bridge port is already held by another game —
  see Troubleshooting.
- `main_screen_set` then `screenshot_editor` → let the assistant see the editor viewport. The
  matching tab must be active; a fresh editor is on 3D and opening a scene does not switch it.

**6. Debug a live bug from real state.**

- `dbg_set_breakpoints` `{ path: "res://player.gd", lines: [38] }`.
- `dbg_launch` → the game starts under the debugger.
- Trigger the code path, then `dbg_stack_trace` → `dbg_scopes` → `dbg_variables` to read
  locals; `dbg_evaluate` to evaluate an expression (this one asks you to confirm first).
- `dbg_continue` to resume.

**7. Drive the running game.**

- `runtime_get_tree` → the live SceneTree.
- `runtime_get_property` `{ path: ".", property: "counter" }` → read live state.
- `runtime_call_method` `{ path: ".", method: "take_damage", args: [10] }` → invoke a
  method (asks you to confirm first).
- `runtime_get_monitors`, `runtime_screenshot` → observe performance and grab a frame.

**8. Run tests headlessly.**

- `godot_run_headless_script` on your test runner script → captured exit code and output.

> **`dbg_evaluate`, `runtime_call_method` and `godot_run_headless_script` are not loaded on a
> default install.** They belong to the `code-execution` capability group, which is OFF unless
> you asked for it — so on the secure default these three steps are the ones a fresh setup
> cannot run, and the server will say so by name. Turn the group on with
> `breakpoint-mcp init --trust full`, or set `BREAKPOINT_PRIVILEGED_GROUPS=code-execution` in
> the server's env, then restart the server. Read `godot://capabilities` for the full list of
> what is withheld and why.

That is the full loop: inspect → change (undoable) → write and check code → run → debug →
drive the live game → test.

---

## 8. Tool reference by family

There are **292 tools** in total (the secure-default surface is **279** with the privileged capability group off — see [The safety and trust model](#9-the-safety-and-trust-model)). This section summarizes them by family so you know what
exists and where to look; for the exhaustive per-tool input/output JSON Schemas, see
[`docs/TOOL_CATALOG.md`](TOOL_CATALOG.md). Tools marked **destructive** are
confirmation-gated (Section 9).

### Plane A — Editor bridge

Requires the editor open with the plugin enabled. Every mutation is undoable via Godot's
undo system unless noted.

- **`editor_*`** — `editor_ping`, `editor_get_state`, and programmatic
  `editor_undo` / `editor_redo` (step the editor's undo history).
- **`project_*`** — read project info and settings; set settings *(destructive)*; manage
  autoloads, export presets, the main scene, and list all settings.
- **`scene_*`** — get the tree; open, save, save-as, create, reload, close, pack, and list
  open scenes; read dependencies.
- **`node_*`** — add, delete, rename, reparent, duplicate, move, change type, set owner,
  set editable-instance; get/set/list properties; find nodes; manage groups; instantiate
  scenes; call methods *(destructive)*.
- **`signal_*`** — list signals and connections; connect, disconnect, add user signals,
  and emit *(emit is destructive)*.
- **`selection_*`** — get and set the editor selection.
- **`main_screen_*`** — read and switch the editor's main-screen tab (2D / 3D / Script /
  Game / AssetLib). Names are matched case-insensitively and the result is read back from
  the editor, not echoed.
- **`classdb_get_class`** — `ClassDB` introspection: methods, properties, signals.
- **`screenshot_editor`** — capture the 2D or 3D editor viewport as an image. The matching
  tab must be active — Godot collapses the inactive one to a few pixels, and this tool
  refuses that placeholder rather than returning it. A fresh editor is on **3D** and
  opening a scene does not switch it, so pair it with `main_screen_set`.
- **`resource_*`** — create, load, save, duplicate, get/set properties, and get/set import
  settings for resources *(writes are destructive)*.
- **`filesystem_*`** — list, scan, create directories, and move files
  *(move is destructive)*.
- **Animation (`anim_*`)** — author an `AnimationPlayer` and its libraries: create players
  and animations, add tracks, insert/remove keys, set length and loop mode, list; plus
  `AnimationTree` / state-machine authoring (`anim_tree_*`, `anim_statemachine_*`).
- **TileMap / TileSet (`tileset_*`, `tilemap_*`, `tilemaplayer_*`)** — build tilesets and
  paint cells.
- **Physics and collision (`body_*`, `collisionshape_*`, `joint_*`, `area_*`,
  `rigidbody_*`, `physics_*`, …)** — bodies, collision shapes and polygons, layers/masks,
  joints, areas, and physics materials.
- **VFX and audio (`particles_*`, `shader_*`, `shadermaterial_*`, `audio_*`)** — particle
  systems, shaders and shader materials, audio players and buses.
- **UI / Control and theming (`control_*`, `container_*`, `theme_*`)** — controls,
  containers, anchors and layout presets, size flags, and themes.
- **3D and navigation (`meshinstance_*`, `mesh_*`, `primitive_mesh_*`, `light_*`,
  `camera_*`, `csg_*`, `navregion_*`, `navagent_*`, `environment_*`)** — meshes and
  materials, lights and cameras, CSG, navigation, and environments.
- **Input, project config, and testing (`inputmap_*`, `project_add_autoload`,
  `test_detect`, `test_list`, …)** — input actions and events, project wiring, and test
  discovery.
- **Native multiplayer authoring (`mp_*`, 7 tools)** — add spawners and synchronizers, set
  multiplayer authority, set up ENet/WebRTC peers, wire RPCs, and scaffold a lobby.
- **Backend-SDK scaffolding (`backend_detect`, `backend_configure`,
  `leaderboard_scaffold`, `cloudsave_scaffold`, `auth_scaffold`, 5 tools)** — detect which
  known SDKs are installed and generate integration GDScript against them. Breakpoint MCP
  hosts no service itself; it only scaffolds code against the SDK *already installed* in
  your project, and each generator degrades cleanly (`sdk_missing` /
  `unsupported_feature`) when that does not apply.
- **AI asset generation (`asset_gen_*`, 7 tools)** — configure a backend, and generate
  placeholders, sprites, textures, icons, sound effects, and models. Off by default; see
  Section 9.
- **Knowledge / lookup (6 tools)** — read-only project and docs search: `project_search`,
  `find_symbol`, `find_usages`, `example_snippet` (host-side), plus `class_reference` and
  `docs_search` (editor-side, `ClassDB`-backed).
- **Version control (`vcs_*`, 12 tools)** — host-side git, works whenever the project is a
  git work tree. Read: `vcs_status`, `vcs_log`, `vcs_diff`, `vcs_show`, `vcs_branch_list`,
  `vcs_blame`. Safe local mutations: `vcs_add`, `vcs_commit`, `vcs_restore`, `vcs_stash`,
  `vcs_branch_create`, `vcs_switch`. Only ops that lose work or rewrite history are
  confirmation-gated (`vcs_restore`, `vcs_stash op=drop`); network operations
  (push/pull/fetch) are intentionally not exposed.

### Plane B — Headless CLI and managed process (`godot_*`)

Works without the editor open.

- **`godot_version`** — the configured binary's version string.
- **`godot_launch_editor`** — open the editor for the project (prerequisite for `editor_*`).
- **`godot_run_project`** — run the project (detached), optionally from a chosen scene. Waits
  for the game's runtime bridge and reports `bridge_ready`; `wait_timeout_ms: 0` opts out.
- **`godot_export`** *(task, destructive)* — headless export via a preset.
- **`godot_import`** *(task)* — headless (re)import of project assets.
- **`godot_run_headless_script`** *(task, higher-trust — runs GDScript)* — run a script
  headlessly; ideal for GdUnit4 / GUT test runners and batch tools.
- **`godot_run_managed`** / **`godot_output`** / **`godot_stop`** — run the game as a
  managed child process with captured stdout/stderr, read that console output, and stop it.

### Plane C — Runtime bridge (`runtime_*`, 27 tools)

Requires the game running. `runtime_get_tree`, `runtime_get_property`,
`runtime_set_property` *(destructive)*, `runtime_call_method` *(destructive)*,
`runtime_emit_signal` *(destructive)*, `runtime_inject_input` *(destructive)*,
`runtime_get_monitors`, `runtime_screenshot`, and `runtime_get_log`. Plus a read-only
verification family: `runtime_assert_node_state`, `runtime_assert_scene_structure`,
`runtime_assert_perf`, `runtime_assert_screen_text`, and `runtime_screenshot_diff` (all
non-destructive — they check the running game without changing it), node editing
(`runtime_node_add` / `runtime_node_remove`), animation control (`runtime_anim_play` /
`runtime_anim_stop` / `runtime_anim_get_state`), and `runtime_await_condition`.

**Deterministic playtesting.** `runtime_time_scale` freezes the clock, `runtime_step_frames`
advances an exact number of frames, `runtime_seed_rng` seeds the global RNG, and
`runtime_state_digest` takes a stable-ordered snapshot of a subtree — so a playtest is
frame-exact rather than wall-clock.

**Across several processes.** `runtime_spawn_peers` (higher-trust: `code-execution`) starts up to
four **headless** peers of the project, each on its own loopback port; `runtime_peer_stop` ends
them; and `runtime_peers_digest` reads the same digest from two or more of them and reports whether
they **converged**. **Every** runtime tool that talks to the running game takes an optional `peer`
argument — the rule is "if you can do it to the default game, you can do it to one peer" — so there
is no subset to memorise. Omit `peer` and you address the default running game exactly as before.
Each peer gets `BREAKPOINT_PEER_ID`, `BREAKPOINT_PEER_INDEX` and (when you pass `role`)
`BREAKPOINT_PEER_ROLE` in its environment, so game code can branch on which peer it is with
`OS.get_environment()`.

This spawns local headless children on loopback for testing — it hosts no relay, lobby or
signalling server, which stays out of scope deliberately.

#### Making peers actually converge

Convergence is a real claim with real preconditions, all four measured against Godot 4.3 rather
than reasoned about. They ship in `runtime_peers_digest`'s own tool description too, so an
assistant reads them at call time; this is the longer version.

1. **Step the fixed physics timestep.** Pass `kind:"physics"` to `runtime_step_frames`. State
   advanced on the idle lane uses the variable per-frame `delta`, which is real elapsed wall-clock
   time in that process — no seed makes it reproducible.
2. **Let the global RNG be consumed only on frames you are stepping.** This is the one that catches
   people. `runtime_seed_rng` seeds *one* stream shared by the whole project, and freezing does not
   stop it being drawn: `time_scale 0` zeroes `delta` but `_process` and `_physics_process` still
   fire, so an unconditional `randf()` burns the stream at wall-clock rate *while frozen* — including
   in the gap between your seed call and your step call. Idle-frame draws do the same during the
   step. Guard draws on `delta > 0`, and give idle-frame code its own `RandomNumberGenerator`.
3. **Freeze first, then equalise.** Peers free-run between spawning and freezing for slightly
   different durations, so their state differs before you start. Freeze every peer with
   `runtime_time_scale{scale:0, peer}`, *then* bring them to an identical starting state with
   `runtime_set_property{peer}`.
4. **Same machine only.** Peers here share one OS and one engine build. Nothing about this extends
   to convergence across machines, and Breakpoint does not claim it.

With all four, three peers produce byte-equal digests even with a deliberate stagger between each
peer's seed and step. With any one violated, they diverge every time. The working order is:

```
runtime_spawn_peers{count:3}
  → per peer: runtime_time_scale{scale:0, peer}          # freeze FIRST
  → per peer: runtime_set_property{peer, ...}            # equalise the starting state
  → per peer: runtime_seed_rng{seed:12345, peer}         # same seed
  → per peer: runtime_step_frames{frames:30, kind:"physics", peer}
  → runtime_peers_digest{root:"./Thing"}                 # converged / diverged_at
```

### Plane D — Semantic and debugging

- **GDScript language server (`gd_*`)** — `gd_completion`, `gd_hover`, `gd_definition`,
  `gd_references`, `gd_rename` *(destructive; edits multiple files)*, `gd_document_symbols`,
  `gd_diagnostics`, `gd_signature_help`, plus navigation/inspection tools
  (`gd_declaration`, `gd_document_link`, `gd_document_highlight`, `gd_type_definition`,
  `gd_implementation`, `gd_folding_ranges`, `gd_formatting`, `gd_document_color`,
  `gd_workspace_symbols`, `gd_code_action`, `gd_call_hierarchy`,
  `gd_semantic_tokens`). Several of the latter are feature-detected and
  return "unsupported" on builds that do not implement them.
- **C# language server (`cs_*`)** — the same shape for C#: completion, hover, definition,
  references, rename *(destructive)*, document and workspace symbols, signature help,
  diagnostics, and code actions (via OmniSharp).
- **Godot debug adapter (`dbg_*`)** — `dbg_launch`, `dbg_attach`, `dbg_set_breakpoints`,
  `dbg_continue`, `dbg_step`, `dbg_stack_trace`, `dbg_scopes`, `dbg_variables`,
  `dbg_watch`, `dbg_set_exception_breakpoints`, `dbg_restart`, and the higher-trust
  `dbg_evaluate` / `dbg_set_variable` / `dbg_goto` *(destructive)*, plus
  `dbg_data_breakpoints`.
- **C# debug adapter (`cs_dbg_*`)** — the equivalent set for .NET via netcoredbg
  (launch, attach, breakpoints, stepping, stack/scopes/variables, watch, evaluate,
  set-variable, exception breakpoints, restart).

### MCP resources

The six resources listed in [Concepts](#6-concepts): `godot://scene-tree`,
`godot://editor-state`, `godot://runtime/tree`, `godot://runtime/log`,
`godot://class/{name}`, and `godot://capabilities`.

---

## 9. The safety and trust model

Breakpoint MCP is built to be safe to hand to an AI assistant. Please read this section —
it explains exactly what the AI can and cannot do without your say-so.

### Foundations

- **Everything the AI edits in the editor is undoable.** Every edit-time mutation is
  wrapped in Godot's `EditorUndoRedoManager`, so a single **Ctrl-Z** reverts anything the
  AI did. Mutations go through the editor API (preserving UIDs and references), not raw
  file writes.
- **Loopback only.** Every socket — editor bridge, runtime bridge, language server, and
  debug adapter — binds to `127.0.0.1`. Nothing is exposed to your network.
- **Main-thread handlers.** Editor bridge handlers run on the editor's main thread (polled
  from `_process`), so there are no threading hazards.

### Confirmation gating (elicitation)

**Destructive tools are elicitation-gated.** Before a destructive tool runs, the host asks
your MCP client to confirm. On accept it proceeds; on decline it returns a non-error
"cancelled" result and changes nothing. You can pass **`confirm: true`** to auto-approve a
call. If your client cannot show a prompt, the tool **blocks** and tells you to re-invoke
with `confirm: true` — so a destructive operation is **never executed silently**.

Gated tools include (among others): `node_delete`, `project_set_setting`, `scene_new`,
`gd_rename` (when applying), `cs_rename` (when applying), `dbg_evaluate`,
`dbg_set_variable`, `dbg_goto`, and the runtime mutators `runtime_set_property`,
`runtime_call_method`, `runtime_emit_signal`, and `runtime_inject_input`. Scene, resource,
filesystem, and asset writers are gated too. The authoritative per-tool list of what is
destructive is in [`docs/TOOL_CATALOG.md`](TOOL_CATALOG.md).

### Bridge authentication (shared secret)

**Both loopback bridges require a per-project shared secret** (default-on since **1.17.0**).
On enable, the addon mints a 64-char hex secret into the engine-managed, git-ignored
`res://.godot/`, and the host sends it as the first line on connect — so another local process
on a shared machine can neither drive a bridge nor bypass the confirmation gate. The secret is
compared in constant time and a bad handshake is refused without echoing it. Opt out (not
recommended) with `BREAKPOINT_BRIDGE_INSECURE=1`.

### Pausing the agent

Two layered controls let a person hold the agent on demand. In the editor, the **Breakpoint MCP**
dock has a **"Pause Agent"** toggle: while engaged, the editor and runtime bridges reject new
commands on those two planes (an op already running finishes; a bare liveness `ping` still
answers). Headless or scripted, the host also honors **`SIGUSR1`** (pause) / **`SIGUSR2`**
(resume) — a finer latch that holds only *mutating* actions but across the **whole** tool
surface, with `BREAKPOINT_START_PAUSED=1` to start held. Neither is an "emergency stop": both
hold *entry* to a new action and never interrupt one already in flight, and the per-tool
confirmation above stays the primary control for destructive ops.

### Higher-trust surfaces (point them only at trusted code)

Two surfaces execute code or shell out to a command you configure. Both are opt-in and/or
gated, and should only be pointed at code you trust:

- **`godot_run_headless_script` and `godot_run_managed`** execute GDScript in your project
  via the Godot binary. Treat them as you would running that script yourself.
- **The `asset_generate` "command" backend** runs an operator-configured local command
  (`BREAKPOINT_ASSETGEN_CMD`). It is **off by default** (`BREAKPOINT_ASSETGEN_BACKEND=none`),
  and the argv template is substituted per-argument with no shell involved. Only enable it
  with a command you trust.

### Extending Breakpoint — recipes, and what is deliberately declined

Breakpoint has no "bring-your-own-tool" API, and that is a design position rather than an
unfinished feature. The extension shape it does have is the **recipe**: a curated workflow
exposed as an MCP prompt, which drives tools that already exist and adds none of its own.
Breakpoint ships 8 recipes today.

The reason the distinction matters is that every safety property described in this section is
attached to a *tool*: the frozen output schema, the catalog entry, the risk annotation, the
capability tag, the confirmation gate. A recipe inherits all of them, because it is a saved
prompt over tools the caller could already have invoked by hand — it is strictly **less**
privileged than the assistant reading it. It cannot skip a confirmation prompt, cannot reach a
tool that a disabled capability group dropped, and cannot add a name to `tools/list`.

A tool-injection hatch would invert that. An injected tool arrives with no schema to enforce, no
annotation for your client to reason about, and no capability group to gate it — and
`scripts/contract_check.py`, which is what makes the rest of this document checkable rather than
merely stated, cannot see it at all. The guarantees would not be weakened so much as quietly
made inapplicable, for precisely the tools with the least provenance.

If you need a workflow Breakpoint doesn't ship, the answer is a recipe (or an issue asking for
one), not a plugin slot. Loading **user-authored** recipes from a project directory is the one
extension we would consider building, and it would still add no tools.

---

## 10. Typical workflows

A few worked recipes. Each is something you can ask your assistant to do; the tool names show the
underlying steps.

> **Five of the tools named below are not loaded on a default install.**
> `godot_run_managed`, `godot_run_headless_script`, `runtime_call_method`, `dbg_evaluate` and
> `runtime_spawn_peers` (§11) belong to the `code-execution` group, which is OFF unless you asked
> for it — so recipe **D** cannot start at all on a default setup and recipe **C** stops at its
> first step. Turn the group on with `breakpoint-mcp init --trust full`, or set
> `BREAKPOINT_PRIVILEGED_GROUPS=code-execution` in the server's env, and restart the server. The
> steps that need it are marked **(higher-trust)** below. See §5 and `godot://capabilities`.

### A. Scene authoring

1. `editor_ping` and `scene_get_tree` to orient.
2. `classdb_get_class` on a type you plan to add, to learn its properties.
3. `node_add`, then `node_set_property` for each field (Variant values like `Vector2` /
   `Color` are tagged — see `docs/TOOL_CATALOG.md`).
4. `node_instantiate_scene` to drop in prefabs; `signal_connect` to wire behavior.
5. `main_screen_set` `{name:"2D"}` then `screenshot_editor` **`{viewport:"2d"}`** so the assistant
   can see the result, then adjust. **Pass the viewport — the default is `3d`, so switching the
   tab alone captures the tab you just left.** Both halves matter: a hidden tab collapses to a
   placeholder before its first visit and freezes at its last drawn frame after it, so a capture
   of the tab that is not on screen is either refused or stale, so the tool refuses that case
   outright with `viewport_not_active` rather than handing back a frame of the past.
6. `scene_save`. Anything you dislike reverts with **Ctrl-Z** or `editor_undo`.

### B. Debugging a bug

1. Reproduce the failing path once so you know roughly where it is.
2. `gd_diagnostics` on the suspect script to rule out static errors.
3. `dbg_set_breakpoints` on the relevant lines.
4. `dbg_launch` (or `dbg_attach` to a running session).
5. Trigger the code path — play the game, `runtime_inject_input` to drive it, or call the
   method directly with `runtime_call_method` from Plane C **(higher-trust)**.
   🔴 **A direct call that hits your breakpoint will not return.** The addon answers
   `runtime_*` from the game's `_process`, so halting inside the method being called halts
   the very frame that owes the reply: the call reports a timeout while the breakpoint is
   hit and waiting for you. That is expected — read the stop with the `dbg_*` tools below
   and release it with `dbg_continue`; the timed-out call's return value is lost, nothing
   else is. `runtime_inject_input` and playing the game by hand have no such interaction.
6. On the stop: `dbg_stack_trace` → `dbg_scopes` → `dbg_variables` to read real state;
   `dbg_watch` for an expression across stops; `dbg_evaluate` **(higher-trust)** to probe a
   value (confirm when prompted).
   **These need the program actually stopped.** A launched-but-running program is refused
   with `not_stopped` naming the state, rather than answered with the empty frame list it
   used to return — the one exception is `dbg_watch`, which still updates the watch set and
   reports why the values are missing, so you can arm watches before the first stop.
7. `dbg_step` / `dbg_continue` to walk through, then fix the code and re-run. Both also
   require a stop: there is nothing to resume in a program that is already running.

### C. Play-testing the live game

1. `godot_run_managed` **(higher-trust)** so the console is captured. It returns an `id` —
   **every later call about that process takes it**: `godot_output {id}` to read the console,
   `godot_stop {id}` to end it. Both fail validation without one.
2. `runtime_get_tree` to see the live scene.
3. `runtime_inject_input` to simulate button presses and movement (one `event` per call).
4. `runtime_get_property` / `runtime_set_property` and `runtime_call_method` **(higher-trust)**
   to probe and nudge state (mutators ask to confirm).
5. `runtime_get_monitors` for FPS and other performance counters; `runtime_screenshot`
   for a frame.
6. `godot_stop {id}` when done.

### D. Running headless tests

1. Point `godot_run_headless_script` **(higher-trust)** at your test-runner script (GdUnit4,
   GUT, or a custom batch script), passing any `args`. They are appended **after** the script
   path and no `--` separator is inserted, so the script reads them from
   `OS.get_cmdline_args()` — which is where GdUnit4 and GUT look. A custom runner using
   `OS.get_cmdline_user_args()` sees an empty list, because that accessor returns only what
   follows `--`.
2. Because it runs on the task model, a task-aware client can poll or await a long run and
   cancel it if needed; a plain client simply waits for the result.
3. Read the captured `exit_code`, `stdout`, and `stderr` from the result.

---

## 11. Troubleshooting

Most problems are a plane that is not reachable yet, or a port mismatch. Work from the
plane you are using.

### `editor_ping` fails / editor tools do nothing

- The editor may not be open, or the plugin not enabled. Enable it under
  **Project → Project Settings → Plugins → Breakpoint MCP** and confirm the Output line
  `[breakpoint_mcp] listening on 127.0.0.1:9080`.
- Port `9080` may be taken. Set `BREAKPOINT_BRIDGE_PORT` **both** in the host env **and**
  before launching Godot, so the addon binds the same port.

### `gd_*` (GDScript intelligence) fail

- The language server may be off or on a different port. Check
  **Editor → Editor Settings → Network → Language Server** (default 6005) and set
  `GODOT_LSP_PORT` to match.

### `dbg_*` (debugging) fail

- The debug adapter may be disabled or on a different port. Check
  **Editor → Editor Settings → Network → Debug Adapter** (default 6006) and set
  `GODOT_DAP_PORT`.
- Some debugger features are version-gated per Godot build. An unsupported feature comes
  back as an error result whose text names the capability the adapter did not advertise —
  `dbg_goto`, `dbg_data_breakpoints` and `dbg_set_exception_breakpoints` all do this on
  current builds. It is a refusal that tells you why, not a fault in the tool, and no
  request is sent.
- **`dbg_set_variable` does not work on any current Godot build.** The GDScript adapter
  advertises `supportsSetVariable` and then never answers the request — measured
  unanswered on 4.3 and on 4.7, at a real stop — so the tool reports that rather than
  hanging. Read state with `dbg_variables` / `dbg_evaluate`.
- **"needs the program stopped at a breakpoint" is not a fault either.** A debug session
  being live is not the same as the program being halted: while it runs there is no frame
  to read a stack, a scope or a variable from. Arm a line with `dbg_set_breakpoints`,
  trigger that path, and read the stop.

### `runtime_*` (in-game) fail

- The game may not be running, or the autoload did not register. Re-enable the plugin and
  confirm the game's Output shows `BreakpointRuntimeBridge listening on 127.0.0.1:9081`.
- Port `9081` may be taken; set `BREAKPOINT_RUNTIME_PORT` (host and addon must agree).
- **A second game cannot share the port, and this used to fail silently.** The autoload's
  `listen()` returns non-OK, it logs `could not listen on 127.0.0.1:9081`, and the game keeps
  running *without a bridge* — while the host, which dials one fixed port, carries on talking to
  whichever process got there first. `ping` reports no pid, so `runtime_*` calls look healthy
  while answering about the wrong game. **Every tool that starts a game now refuses when that port is
  already held** — `godot_run_managed` **(higher-trust)**, `godot_run_project`, `dbg_launch` and
  `cs_dbg_launch` — each
  with `allow_port_conflict: true` to proceed anyway. Which remedy clears it depends on what the
  holder is — `godot_stop` for a `godot_run_managed` child, **`dbg_attach`** if it is already
  running under the debugger, otherwise quit the window yourself; the refusal lists all of them,
  because the probe only learns *that* the port is held. Note that with the override, `dbg_*` works
  perfectly (a DAP session is addressed by session, not by port) while `runtime_*` would talk to the
  other process. `dbg_attach` and `dbg_restart` are deliberately not gated — attach is the remedy,
  and at restart time the session's own game still holds the port. **To drive more than one game at
  once, use `runtime_spawn_peers`** **(higher-trust)** — it allocates a distinct port per peer, and
  every runtime tool takes a `peer` argument.
- Zero-config console capture (`runtime_get_log`) needs **Godot 4.5+**. On 4.3 the bridge
  still loads and serves any explicit log entries, but automatic capture is a documented
  no-op. For captured console output on older builds, use `godot_run_managed` +
  `godot_output`.

### A tool fails with "No such method"

- **The addon in your project is older than the host.** They version separately and `init`
  skips an addon that is already installed, so upgrading the host alone leaves the old addon
  in place — see the upgrade note in §3.0. Run `breakpoint-mcp init --force`, then close and
  reopen the project in Godot.
- `breakpoint-mcp doctor` names both halves: `addon-version` compares the copy on disk to the
  one this host ships, and `addon-running-editor` / `addon-running-runtime` report what each
  live plane actually loaded. They are informational — they never fail the exit code — so
  read the lines, not just the status.

### Screenshots come back blank

- The matching editor tab (2D or 3D) must be active and rendered, and the machine needs a
  real display/GPU. Headless environments have no GPU and cannot produce viewport images.

### A tool times out

- Long jobs (`godot_export`, `godot_import`, `godot_run_headless_script` **(higher-trust)**) are
  expected to take a while — a task-aware client can await or cancel them.
- The `dbg_set_variable` / `dbg_evaluate` **(higher-trust)** requests are bounded by their own
  short timeouts
  (`GODOT_DAP_SETVAR_TIMEOUT_MS` / `GODOT_DAP_EVALUATE_TIMEOUT_MS`, default 8 s each), so a
  non-answering adapter fails fast with a clear message instead of hanging. Adjust the
  broader `*_TIMEOUT_MS` variables if your machine is slow.

### Build error mentioning SDK imports

- The host targets the stable `@modelcontextprotocol/sdk` 1.x high-level API. If you have
  installed a newer SDK major version, adjust the imports as described in the repository
  `README.md` (SDK version note). The tool logic is unchanged.

For a structured, plane-by-plane validation walkthrough against the bundled `example/`
project, follow [`docs/RUNBOOK.md`](RUNBOOK.md).

---

## 12. FAQ

**Do I have to keep the Godot editor open?**
Only for Plane A (editor bridge) and the editor-side tools that depend on it, and for the
GDScript language server and debug adapter (which the editor hosts). Plane B (headless CLI)
works with nothing open. Plane C (runtime bridge) needs the game running.

**Does the AI change my files behind my back?**
No. Editor mutations go through Godot's undo system (revert with Ctrl-Z), and every
destructive tool asks you to confirm first — or blocks if it cannot ask. Read-only tools
never change anything.

**Is anything exposed to the network?**
No. All sockets bind to loopback (`127.0.0.1`) only.

**Which Godot versions work?**
4.2+ is the minimum; 4.4+ is recommended. A few features need 4.4+, 4.5+, or newer. Where
your build lacks a capability, the tool says so clearly rather than failing.

**Do I need C# tooling?**
Only if you use the C# tools. OmniSharp and netcoredbg are launched lazily on first use; if
you never call the `cs_*` / `cs_dbg_*` tools, nothing is spawned.

**Is AI asset generation on by default?**
No — `BREAKPOINT_ASSETGEN_BACKEND` defaults to `none`. The `placeholder` backend produces
deterministic in-engine stand-ins with no external model; the `command` backend runs a
command you configure and should only point at trusted code.

**How many tools are there, and where's the full list?**
292 tools (secure-default 279) and 6 resources. The exhaustive per-tool schemas are in
[`docs/TOOL_CATALOG.md`](TOOL_CATALOG.md).

**What are those `{ "__type__": ... }` values I see in tool arguments?**
JSON cannot express Godot's rich types (`Vector3`, `Color`, `NodePath`, and so on), so
those values are encoded as tagged objects. The encoding is documented in
`docs/TOOL_CATALOG.md`.

---

## 13. Further reference

- **`README.md`** — architecture overview and setup summary.
- **`docs/TOOL_CATALOG.md`** — the authoritative catalog: every tool with its plane,
  destructive flag, and input/output JSON Schemas, plus the resource list and the tagged
  Variant encoding.
- **`docs/RUNBOOK.md`** — a step-by-step, plane-by-plane live validation walkthrough
  against the bundled `example/` project.
- **`CHANGELOG.md`** — release history and per-version details.
- **`host/README.md`** — host packaging and publishing notes.
- **The repository** — source for the host (`host/`) and the editor addon
  (`addons/breakpoint_mcp/`), plus the `example/` and `example-csharp/` projects.

Thanks for trying Breakpoint MCP. If something here is unclear or wrong, an issue or a pull
request is always welcome.
