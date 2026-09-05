# Live Validation Runbook

Exercises all four planes end-to-end against the `example/` project. Run this in an environment with **Node 18+ (npm registry access)** and **Godot 4.4+ with a real display/GL** — a developer machine (the bridge's intended home), not a headless CI box (screenshots and the editor GUI need a display).

Estimated time: ~15 minutes.

## 0. Prerequisites
- Godot 4.4+ installed; note its path (or put it on `PATH` as `godot`).
- Node 18+ and npm.
- Ports free: **9080** (editor bridge), **9081** (runtime bridge), **6005** (LSP), **6006** (DAP).
- Claude Code (or Claude Desktop) configured for MCP.

## 1. Automated setup
```bash
export GODOT_BIN=/path/to/godot        # if not on PATH
bash scripts/validate.sh
```
This runs the static contract check, copies the addon into `example/addons/`, builds the host (`host/dist/index.js`), and imports the project. Fix anything it flags before continuing.

## 2. Start the editor + bridge
1. Open the `example/` project in the Godot editor.
2. **Project → Project Settings → Plugins →** enable **Breakpoint MCP**.
3. In the **Output** panel confirm: `[breakpoint_mcp] listening on 127.0.0.1:9080`.
4. Confirm the language server and debug adapter are on under **Editor → Editor Settings → Network → Language Server** (6005) and **Debug Adapter** (6006). They're on by default.

## 3. Register the MCP host with Claude
```bash
claude mcp add godot -- node "$(pwd)/host/dist/index.js"
```
Set env for the server (Claude Code: `--env`, or the Desktop JSON block):
`GODOT_BIN=/path/to/godot`, `GODOT_PROJECT=$(pwd)/example`.

Restart/refresh so Claude sees the `godot_*`, `editor_*`, `scene_*`, `node_*`, `gd_*`, `dbg_*`, `runtime_*` tools and `godot://…` resources.

## 4. Per-plane checklist
Ask Claude to run each; mark pass/fail.

> **Rows marked (higher-trust) need the `code-execution` group.** Thirteen tools are not
> loaded on a default install — see `BREAKPOINT_PRIVILEGED_GROUPS` in `USER_GUIDE.md` §
> Environment, and read `godot://capabilities` for the live list. Calling one anyway is
> answered with a message naming the policy, never with `not found`, so a row that refuses
> that way on a default install is **a pass, not a failure**. Run this checklist with
> `BREAKPOINT_PRIVILEGED_GROUPS=code-execution` (or `breakpoint-mcp init --trust full`) to
> drive every row. Where a default-surface substitute exists it is named in the row.

### Plane B — CLI (editor not required)
| # | Tool call | Expected |
|---|---|---|
| B1 | `godot_version` | version string like `4.x.stable` |
| B2 | `godot_run_headless_script` **(higher-trust)** on a trivial script | exit_code 0, stdout captured |

### Plane A — Editor bridge (editor open, plugin enabled)
| # | Tool call | Expected |
|---|---|---|
| A1 | `editor_ping` | `{ pong: true, godot: "4.x" }` |
| A2 | `editor_get_state` | `has_open_scene: true`, root type `Node2D` |
| A3 | `scene_get_tree` | tree with `Main` → `Sprite2D` |
| A4 | `classdb_get_class` `AudioStreamPlayer3D` | methods/properties/signals listed |
| A5 | `node_add` `{parent_path:".", type:"AudioStreamPlayer3D", name:"SFX"}` | new node path `SFX`; appears in editor |
| A6 | `node_set_property` `{path:"Sprite2D", property:"position", value:{"__type__":"Vector2","x":10,"y":20}}` | position updates; **Ctrl-Z reverts it** |
| A7 | `node_delete` `{path:"SFX"}` | elicitation prompt → accept → node removed |
| A8 | `main_screen_get` | `active` names the current tab; `available` lists `2D, 3D, Script, Game, AssetLib` |
| A9 | `screenshot_editor` `{viewport:"2d"}` *(before switching)* | if the editor is not on 2D: `viewport_not_active`, naming the active tab and pointing at `main_screen_set` — **this is the expected result, not a failure**. The tab is read before the texture, so this holds whether or not the 2D tab has been visited yet this session; `viewport_not_rendered` is the older, size-based refusal and now only reaches an addon too old to report the tab. 🔴 **Run this step with the editor window actually on screen.** From addon 1.16.0 a window that is minimised, off the active Space or fully covered refuses with `window_not_drawing` before either tab check is reached — Godot presents no frames at all in that state, so the refusal is correct and the runbook step proves nothing until the window is visible |
| A10 | `main_screen_set` `{name:"2d"}` | `active: "2D"` (lower case in, engine spelling out) |
| A11 | `screenshot_editor` `{viewport:"2d"}` *(after switching)* | image returned — the same call that was refused at A9 now succeeds |
| A12 | `card_deck_from_table` `{table_path:"res://../anything.csv", …}` | refused `path_outside_project`, naming the resolved path. **The refusal is the pass.** `res://../` clears a `res://` prefix test but leaves the project root, and this tool stamps what it reads into the scene |
| A13 | `card_deck_from_table` against a real but **empty** table | refused `empty_table` — *not* `not_found`. A directory or `""` (the project root) answers `not_a_file`; only a genuinely absent file answers `not_found` |
| A14 | `board_create` twice at the same `path`, no `overwrite` | first call `saved: true`; **second call refused `exists`** and the scene on disk is byte-identical. Before 1.39.0 the second call appended to the first board and reported success |
| A15 | `board_create` again with `overwrite: true` | scene REPLACED, node count back to the fresh value (not doubled). If that scene is open in the editor on Godot < 4.4 the call is refused `overwrite_unsupported` — refusing is correct, appending is the bug |

### Plane D — LSP (semantic)
| # | Tool call | Expected |
|---|---|---|
| D1 | `gd_completion` in `player.gd` inside `take_damage` (e.g. after `count`) | suggests `counter` |
| D2 | `gd_hover` on `counter` | shows `int` type |
| D3 | `gd_definition` on `take_damage` usage | resolves to its declaration line |
| D4 | `gd_diagnostics` `player.gd` | empty (or expected) diagnostics; introduce a typo and re-run to see an error |

### Plane D — DAP (debugging)
| # | Tool call | Expected |
|---|---|---|
| E1 | `dbg_set_breakpoints` `{path:"res://player.gd", lines:[38]}` (the `counter -= amount` line) | breakpoint buffered/verified |
| E2 | `dbg_launch` | game starts; session running |
| E3 | trigger `take_damage` (via `runtime_call_method` **(higher-trust)**, see C-plane) | `stopped` at the breakpoint. Measured on 4.7: the call itself then reports `timeout` while the game is halted, and says why — the addon answers `runtime_*` from `_process`, so the frame owing the reply cannot run until `dbg_continue`. **The timeout is the expected reading**, and the late reply is logged when it lands |
| E4 | `dbg_stack_trace` → `dbg_scopes` → `dbg_variables` | see `amount`, `counter` locals — but see the note below |
| E5 | `dbg_evaluate` **(higher-trust)** `{expression:"counter"}` | elicitation → accept → returns value. On a default install `dbg_watch` `{add:["counter"]}` reads the same value and is not privileged |
| E6 | `dbg_continue` | resumes |
| E7 | `dbg_set_breakpoints` `{…, conditions:["counter < 0"]}` **before** `dbg_launch`, then `dbg_launch` | set → `modifier_detection: "deferred"` + warning; launch → `unsupported_modifiers` naming what was dropped |

> **E4 — `dbg_variables` may refuse a reference `dbg_scopes` just handed out.** Measured on
> Godot 4.7 at a breakpoint stop: `DAP error [variables]: unknown` for the `Locals` and
> `Members` refs the adapter itself issued, while `Globals` answered. Upstream, and not
> reproducible on demand — the same stop worked minutes earlier. A self-describing refusal
> here is the expected behaviour, not a regression; `dbg_watch` is the reliable way to read
> a single value at a stop. Re-measured on 4.7 at a real `take_damage` stop: `Locals`
> answered `amount` and `bridge`, so the refusal is intermittent in both directions and the
> note stands as written rather than being narrowed to a version.
>
> **E7 — an ignored modifier is not a no-op.** Godot advertises conditional / hit-count /
> logpoint breakpoints as unsupported and ignores them if sent, so an undropped condition
> makes the breakpoint halt **every time** — the opposite of what was asked. The host
> feature-detects when the breakpoints are *applied*, which is why E7 sets them before the
> launch: that is the ordinary path, and it is the one that used to go unreported.

### Plane C — Runtime bridge (game running)
| # | Tool call | Expected |
|---|---|---|
| C1 | `godot_run_managed` **(higher-trust)** | returns a process `id`; game window opens. On a default install use `godot_run_project` instead — it opens the same window and reports `bridge_ready`, but it is **detached**: it returns an OS `pid` and no `id`, so C2 and C9 have nothing to address and the game is quit in its own window |
| C2 | `godot_output` `{id}` **(needs C1's `godot_run_managed`)** | includes `[example] player ready`. On a default install this can only answer `No managed process with id …`, and it says why: the one tool that mints an `id` is withheld. **That refusal is the pass** |
| C3 | `runtime_get_tree` | live tree with `Main` |
| C4 | `runtime_get_property` `{path:".", property:"counter"}` | `100` |
| C5 | `runtime_call_method` **(higher-trust)** `{path:".", method:"take_damage", args:[10]}` | elicitation → accept → returns `90`. No default-surface substitute: invoking an arbitrary method IS the `code-execution` group |
| C6 | `runtime_get_monitors` `{keys:["time/fps","audio/output_latency"]}` | numeric values |
| C7 | `runtime_screenshot` | game frame image |
| C8 | `runtime_get_log` | includes the `push_log` entries |
| C9 | `godot_stop` `{id}` **(needs C1's `godot_run_managed`)** | process terminates. Same as C2 on a default install — a detached `godot_run_project` game is not stoppable by any tool, which the port-conflict refusal and this tool's own refusal both say |

### Resources
| # | Read resource | Expected |
|---|---|---|
| R1 | `godot://scene-tree` | edited scene JSON |
| R2 | `godot://class/AudioStreamPlayer3D` | ClassDB JSON |
| R3 | `godot://runtime/log` (while running) | log entries |

### Safety (elicitation)
| # | Check | Expected |
|---|---|---|
| S1 | Call a gated tool (e.g. `node_delete`) and **decline** the prompt | returns "cancelled", no change |
| S2 | Call it again with `{confirm:true}` | proceeds without a prompt |
| S3 | On a client without elicitation | tool blocks and asks for `confirm:true` |

## 5. Teardown
- `godot_stop` any managed processes; `dbg_continue` to let a debug session finish.
- Disable the plugin (this removes the runtime autoload entry it added).
- `claude mcp remove godot` if desired.

## Troubleshooting
- **`editor_ping` fails** — plugin not enabled, or port 9080 taken (set `BREAKPOINT_BRIDGE_PORT` before launching Godot **and** `BREAKPOINT_BRIDGE_PORT` in the host env).
- **`gd_*` fail** — LSP not running or wrong port; check Editor Settings → Network → Language Server, set `GODOT_LSP_PORT`.
- **`dbg_*` fail** — Debug Adapter disabled or port mismatch; set `GODOT_DAP_PORT`. `stepOut` may be unsupported on older Godot.
- **`runtime_*` fail** — game not running, or the autoload didn't register (re-enable the plugin, confirm `BreakpointRuntimeBridge listening on 127.0.0.1:9081` in the game's Output).
- **Screenshots blank** — the matching editor tab (2D/3D) must be active and rendered; headless has no GPU.
- **SDK type/API mismatch at build** — if on SDK v2, adjust the three imports per `README.md` (SDK version note).
