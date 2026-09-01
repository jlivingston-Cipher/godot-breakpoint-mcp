# Godot–Breakpoint MCP — MCP Tool-Schema Catalog

Complete tool contract for the bridge — **292 tools + 6 MCP resources, all implemented (Phases 0–4)**. Each tool lists its **plane**, **status** (`✅ implemented`), a **destructive** flag (destructive tools are elicitation-gated and accept a `confirm` argument — see "Destructive-action gating" below), and its **input** and **output** JSON Schemas (draft 2020-12).

> Design note: as of **v0.4.3 (track B1)** these output schemas are **enforced at runtime**. `host/src/schemas.ts` freezes the `structuredContent` shape of every data tool and `applyOutputSchemas()` injects it as that tool's `outputSchema`, which the MCP SDK validates on every success result (`isError` results are exempt). The shapes were frozen from the v0.4.2 live-validation run, so the documented contract below **is** the enforced contract. `z.object` is non-strict, so a tool may still return *extra* fields without failing validation (the schema pins the required envelope, not an exhaustive field list).

---

## Conventions

**Reading a tool's heading.** A section heading is the tool's name, then **✔** if the tool
carries the MCP `destructiveHint` annotation — *may overwrite or discard state the caller did
not supply* — then its implementation status, then any note. The ✔ is derived from
`host/src/annotations.ts`, not typed here: `contract_check.py`'s check 4c refuses a heading
this file and that file disagree about, in either direction, and refuses a registered tool
with no section at all. The words after `·` are a note about **what** the tool writes and
carry no flag. That marker used to be the free-form word *destructive* inside the note,
read by nothing, and it disagreed with the wire on dozens of sections — most of them silent
about a tool the wire calls destructive.

**Tool result envelope.** Every tool returns MCP `content` (a human-readable `text` item, plus an `image` item for screenshots) and, for data tools, a `structuredContent` object matching the output schema below. On failure a tool returns `{ "isError": true, "content": [{ "type": "text", "text": "..." }] }` rather than throwing.

**Node paths.** All editor/runtime node paths are **relative to the scene root**; `"."` (or `""`) denotes the root itself. Example: `"Player/Camera3D"`.

**The name a new node actually got (`coerced` / `requested`).** Every tool that adds a node
to a scene — the 22 editor-plane authoring tools, `node_add` and `node_duplicate` through
`light_create`, `body_create` and `mp_add_spawner`, plus `runtime_node_add` on the live
game — answers with `path` and `name`, and with
`coerced: true` plus `requested` whenever the engine's name differs from the one asked for.
Godot resolves a name collision itself, the way the editor's own **Add Node** does: ask for
`SFX` when a sibling already holds it and the node is created as `SFX2`. Since **1.83.0**
that difference is reported rather than left for the caller to notice by diffing, using the
same two field names `node_set_property` has carried since 1.82.0 — one convention for *the
engine stored something other than what you asked for*, not two. **Address the node by the
returned `name`, never by the requested one.** Before 1.83.0 these tools passed Godot's
`force_readable_name: false`, so a collision produced the machine form `@Type@N` — and
`node_duplicate`, which always collides with its source, produced it every time.

**Writing to a destination that is already taken (`overwrite` / `replaced`).** Every tool
that saves a resource to a path the caller NAMED — `resource_create`, `resource_save`,
`resource_duplicate`, `scene_new`, `scene_pack`, `theme_create`, `shader_create`,
`tileset_create`, `primitive_mesh_create`, `environment_create`, `audio_set_bus_layout`
and the six `asset_gen_*` generators — **refuses** an occupied destination with the error
code `exists` and takes an optional `overwrite: true` to proceed anyway. When it does
proceed over an existing file the reply carries `replaced: true`, and carries nothing when
the destination was free. That is the same shape as `coerced` / `requested` above and as
`node_set_property` since 1.82.0: one convention for *what happened is not quite what you
asked for*, present only when it happened.

Before **1.83.0** these tools destroyed whatever was at the path and answered exactly as
they answer a fresh create — the same `created` / `saved` / `packed` reply, with no error,
no flag and no field. Measured against a live Godot 4.7: nine resources were created, a
sentinel line appended to each on disk, and each tool called a second time with identical
arguments; all nine sentinels were gone. `resource_create` reset an `Environment` that had
been configured, and turned it into a `StandardMaterial3D` when asked for one at the same
path, so anything referencing it by type then held the wrong one.

The same two fields now cover the scaffolding writers — `mp_setup_enet_peer`,
`mp_setup_webrtc_peer`, `mp_scaffold_lobby`, `auth_scaffold`, `backend_configure`,
`cloudsave_scaffold`, `leaderboard_scaffold` — and the four tabletop template writers,
which already refused a collision but had no way to say when they had accepted one.
`mp_wire_rpc` deliberately has neither field: it edits an annotation inside a script that
already exists and has no destination to collide with. Tools that write a resource **back
to its own path** — every `*_set_property`, `theme_set_*`, `tileset_add_*`,
`shader_set_code`, `environment_set_sky` — are unaffected: overwriting there is the
operation, not a hazard, and refusing it would break the tool.

**Tagged Variants (`$defs.Variant`).** JSON cannot express Godot's rich value types, so any property value that isn't a plain scalar/array/object is encoded as a tagged object. This applies to `node_set_property` / `node_get_property` values and `project_*_setting` values.

```json
{
  "$defs": {
    "Variant": {
      "description": "A plain JSON scalar/array/object, OR a tagged Godot value.",
      "oneOf": [
        { "type": ["null", "boolean", "number", "string", "array", "object"] },
        { "type": "object", "required": ["__type__"], "properties": {
          "__type__": { "enum": ["NodePath","Vector2","Vector2i","Vector3","Vector3i","Vector4","Color","Rect2","Quaternion","Resource","Object"] }
        }}
      ],
      "examples": [
        42, "hello", true,
        { "__type__": "Vector3", "x": 1.0, "y": 0.0, "z": 2.5 },
        { "__type__": "Color", "r": 1, "g": 0.5, "b": 0, "a": 1 },
        { "__type__": "NodePath", "path": "Player/Sprite2D" },
        { "__type__": "Resource", "class": "Texture2D", "path": "res://icon.svg" }
      ]
    }
  }
}
```

**Standard error object** (transport-level result from the in-editor bridge, surfaced in the tool's error text):

```json
{ "type": "object", "required": ["code", "message"],
  "properties": { "code": { "type": "string" }, "message": { "type": "string" } } }
```

---

# Plane B — Headless CLI  (✅ implemented; works without the editor running)

### `breakpoint_doctor` ✅
Check this setup end to end — the Godot binary, the editor addon's install and enable state, the capability groups in force, and the editor/runtime/LSP/DAP bridges. Returns a per-check status with a hint for anything wrong. The same `runDoctorChecks` the `breakpoint-mcp doctor` CLI drives, so the two can never disagree — but reachable from inside the session, which is where the person who needs it actually is. `require_live: true` means the three bridges OPENING THE EDITOR brings up; the runtime bridge lives inside the running game and is required only by `live_level: "runtime"` or `"all"`. `failed` counts every ✗ and `!`; `required_failed` is the one that decides `ok`.
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "require_live": { "type": "boolean" },
    "live_level": { "enum": ["none", "editor", "runtime", "all"] },
    "include_csharp": { "type": "boolean" },
    "timeout_ms": { "type": "integer" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["ok", "failed", "checks"],
  "properties": {
    "ok": { "type": "boolean" },
    "failed": { "type": "number" },
    "required_failed": { "type": "number" },
    "informational_failed": { "type": "number" },
    "checks": { "type": "array", "items": { "type": "object",
      "required": ["name", "status", "severity", "detail"],
      "properties": {
        "name": { "type": "string" },
        "status": { "type": "string" },
        "severity": { "type": "string" },
        "detail": { "type": "string" },
        "hint": { "type": "string" }
      } } }
  } }
```

### `godot_version` ✅
Return the version string of the configured Godot binary.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["version"],
  "properties": {
    "version": { "type": "string" },
    "raw": { "type": "object" }
  } }
```

### `godot_launch_editor` ✅
Open the Godot editor for the project (detached). Prerequisite for every `editor_*` tool.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["launched", "pid", "project"],
  "properties": {
    "launched": { "type": "boolean" },
    "pid": { "type": ["integer", "null"] },
    "project": { "type": "string" }
  } }
```

### `godot_run_project` ✅
Run the project (detached), optionally from a specific scene. **Waits until the game's runtime bridge answers `ping`** and reports `bridge_ready` — the game needs roughly half a second to three seconds to bind it, and no `runtime_*` tool is reachable before it does. **Refuses when the runtime bridge port is already bound** — the new game's autoload could not `listen()`, and the host's runtime client would go on addressing whichever process already holds the port. Override with `allow_port_conflict`; use `runtime_spawn_peers` to drive more than one game at once.
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "scene": { "type": "string", "description": "res:// scene to run" },
    "allow_port_conflict": { "type": "boolean", "default": false, "description": "start even though the runtime bridge port is bound; the new game's bridge will be unreachable" },
    "wait_timeout_ms": { "type": "integer", "minimum": 0, "default": 15000, "description": "how long to wait for the runtime bridge to answer ping; 0 returns as soon as the process is spawned" } } }
```
- **Output**
```json
{ "type": "object", "required": ["running", "pid", "bridge_ready"],
  "properties": {
    "running": { "type": "boolean" },
    "pid": { "type": ["integer", "null"] },
    "scene": { "type": ["string", "null"] },
    "bridge_ready": { "type": "boolean" },
    "bridge_wait_ms": { "type": "integer" },
    "bridge_note": { "type": ["string", "null"] }
  } }
```
> `running` says the process was spawned; `bridge_ready` says the runtime bridge answered. Before this pair existed only the first was reported, and callers read it as the second — for 0.5–3.2s it was not. `bridge_wait_ms` of 0 with `bridge_ready` false means *not waited* — `wait_timeout_ms: 0` — which is a different fact from *waited and lost*, and `bridge_note` says which.

### `godot_export` ✅ · writes build artifacts
Headless export via an export preset. Runs to completion; can be slow. Exposed as an MCP task (D2): a task-aware client polls or cancels it while it runs; plain clients still get a synchronous result.
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "required": ["preset", "output_path"],
  "properties": {
    "preset": { "type": "string" },
    "output_path": { "type": "string" },
    "debug": { "type": "boolean", "default": false },
    "timeout_ms": { "type": "integer", "minimum": 1, "default": 600000 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["preset", "output_path", "exit_code"],
  "properties": {
    "preset": { "type": "string" },
    "output_path": { "type": "string" },
    "exit_code": { "type": ["integer", "null"] },
    "timed_out": { "type": "boolean" },
    "stdout": { "type": "string" },
    "stderr": { "type": "string" }
  } }
```

### `godot_import` ✅
Headless (re)import of project assets. Exposed as an MCP task (D2): a task-aware client polls or cancels it while it runs; plain clients still get a synchronous result.
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": { "timeout_ms": { "type": "integer", "minimum": 1, "default": 600000 } } }
```
- **Output**
```json
{ "type": "object", "required": ["exit_code"],
  "properties": {
    "exit_code": { "type": ["integer", "null"] },
    "timed_out": { "type": "boolean" },
    "stdout": { "type": "string" },
    "stderr": { "type": "string" }
  } }
```

### `godot_run_headless_script` ✔ ✅
Run a GDScript headless (`godot --headless -s <script>`). Use for GdUnit4/GUT test runners or batch tools. Exposed as an MCP task (D2): a long test run can be polled or cancelled while it is in flight; plain clients still get a synchronous result.
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "required": ["script_path"],
  "properties": {
    "script_path": { "type": "string" },
    "args": { "type": "array", "items": { "type": "string" } },
    "timeout_ms": { "type": "integer", "minimum": 1, "default": 600000 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["script_path", "exit_code"],
  "properties": {
    "script_path": { "type": "string" },
    "exit_code": { "type": ["integer", "null"] },
    "timed_out": { "type": "boolean" },
    "stdout": { "type": "string" },
    "stderr": { "type": "string" }
  } }
```

---

# Plane A — Editor Bridge  (✅ implemented; requires the editor open with the plugin enabled)

### `editor_ping` ✅
- **Input**
```json
{ "type": "object", "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["pong", "addon_version", "godot"],
  "properties": {
    "pong": { "type": "boolean" },
    "addon_version": { "type": "string" },
    "godot": { "type": "string" }
  } }
```

### `editor_get_state` ✅
- **Input**
```json
{ "type": "object", "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["has_open_scene"],
  "properties": {
    "has_open_scene": { "type": "boolean" },
    "edited_scene_root": { "type": ["string", "null"] },
    "edited_scene_path": { "type": ["string", "null"] },
    "root_type": { "type": ["string", "null"] },
    "selection": { "type": "array", "items": { "type": "string" } },
    "godot": { "type": "string" }
  } }
```

### `editor_undo` ✅ (steps the undo history)
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": { "scope": { "type": "string", "enum": ["scene", "global"], "default": "scene" } } }
```
- **Output**
```json
{ "type": "object", "required": ["performed", "direction", "has_undo", "has_redo", "history_id", "scope"],
  "properties": {
    "performed": { "type": "boolean" },
    "direction": { "type": "string" },
    "action": { "type": "string" },
    "has_undo": { "type": "boolean" },
    "has_redo": { "type": "boolean" },
    "history_id": { "type": "integer" },
    "scope": { "type": "string" }
  } }
```
- Programmatic Ctrl-Z. Steps the editor's undo history one action back via `EditorUndoRedoManager.get_history_undo_redo(get_object_history_id(edited_root)).undo()` — the same history the `node_*` mutators commit into. `scope: "global"` targets `GLOBAL_HISTORY` instead of the edited scene. Ungated (the `node_*` model). `performed` is `false` when the history is already at its oldest state; `action` is the name of the undone action (empty when nothing was undone).

### `editor_redo` ✅ (steps the undo history)
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": { "scope": { "type": "string", "enum": ["scene", "global"], "default": "scene" } } }
```
- **Output**
```json
{ "type": "object", "required": ["performed", "direction", "has_undo", "has_redo", "history_id", "scope"],
  "properties": {
    "performed": { "type": "boolean" },
    "direction": { "type": "string" },
    "action": { "type": "string" },
    "has_undo": { "type": "boolean" },
    "has_redo": { "type": "boolean" },
    "history_id": { "type": "integer" },
    "scope": { "type": "string" }
  } }
```
- Programmatic Ctrl-Shift-Z. Re-applies the most recently undone action on the same history. `performed` is `false` when there is nothing to redo.

### `project_get_info` ✅
- **Input**
```json
{ "type": "object", "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["name", "project_root"],
  "properties": {
    "name": { "type": "string" },
    "main_scene": { "type": "string" },
    "project_root": { "type": "string" },
    "godot": { "type": "string" },
    "features": { "type": "array", "items": { "type": "string" } }
  } }
```

### `project_get_setting` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name"],
  "properties": { "name": { "type": "string", "description": "dotted ProjectSettings key" } } }
```
- **Output**
```json
{ "type": "object", "required": ["name", "value"],
  "properties": { "name": { "type": "string" }, "value": { "$ref": "#/$defs/Variant" } } }
```

### `project_set_setting` ✔ ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name", "value"],
  "properties": {
    "name": { "type": "string" },
    "value": { "$ref": "#/$defs/Variant" },
    "save": { "type": "boolean", "default": false }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["name", "saved"],
  "properties": { "name": { "type": "string" }, "saved": { "type": "boolean" } } }
```

### `scene_get_tree` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": { "max_depth": { "type": "integer", "minimum": 1, "default": 64 } } }
```
- **Output** (recursive node)
```json
{ "$ref": "#/$defs/SceneNode",
  "$defs": { "SceneNode": {
    "type": "object", "required": ["name", "type", "path", "child_count"],
    "properties": {
      "name": { "type": "string" },
      "type": { "type": "string" },
      "path": { "type": "string" },
      "script": { "type": ["string", "null"] },
      "child_count": { "type": "integer" },
      "children": { "type": "array", "items": { "$ref": "#/$defs/SceneNode" } }
    } } } }
```

### `scene_open` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"],
  "properties": { "path": { "type": "string", "pattern": "^res://" } } }
```
- **Output**
```json
{ "type": "object", "required": ["opened"], "properties": { "opened": { "type": "string" } } }
```

### `scene_save` ✅
- **Input**
```json
{ "type": "object", "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["saved"], "properties": { "saved": { "type": "string" } } }
```

### `scene_new` ✔ ✅ · writes a new file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["root_type", "path"],
  "properties": {
    "root_type": { "type": "string", "default": "Node" },
    "path": { "type": "string", "pattern": "^res://" },
    "name": { "type": "string" },
    "overwrite": { "type": "boolean" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["created", "root_type"], "properties": { "created": { "type": "string" }, "root_type": { "type": "string" } } }
```

### `scene_list_open` ✅
- **Input**
```json
{ "type": "object", "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["scenes", "current", "unsaved", "unsaved_supported"], "properties": { "scenes": { "type": "array", "items": { "type": "string" } }, "current": { "type": ["string", "null"] }, "unsaved": { "type": "array", "items": { "type": "string" } }, "unsaved_supported": { "type": "boolean" } } }
```
- **Note** `unsaved` enumeration uses `EditorInterface.get_unsaved_scenes()` (Godot 4.4+). On Godot 4.3 that API is absent, so `unsaved` comes back empty and `unsaved_supported` is `false`; `scenes` and `current` are unaffected.

### `scene_reload` ✔ ✅ · discards unsaved changes
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": { "path": { "type": "string", "description": "omitted = current scene" } } }
```
- **Output**
```json
{ "type": "object", "required": ["reloaded"], "properties": { "reloaded": { "type": "string" } } }
```

### `scene_close` ✔ ✅ · discards unsaved changes
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": { "path": { "type": "string", "description": "optional assertion of the current scene path" } } }
```
- **Output**
```json
{ "type": "object", "required": ["closed"], "properties": { "closed": { "type": "string" } } }
```
- **Note** Requires Godot 4.4+ (`EditorInterface.close_scene()`); on Godot 4.3 the tool returns an `unsupported` error instead of closing.

### `scene_pack` ✔ ✅ · writes a new file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "to_path"], "properties": { "path": { "type": "string" }, "to_path": { "type": "string", "pattern": "^res://" }, "overwrite": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["packed", "branch"], "properties": { "packed": { "type": "string" }, "branch": { "type": "string" } } }
```

### `scene_get_dependencies` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": { "path": { "type": "string", "description": "omitted = current scene" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "dependencies", "dependencies_raw", "dependency_uids"], "properties": { "path": { "type": "string" }, "dependencies": { "type": "array", "items": { "type": "string" } }, "dependencies_raw": { "type": "array", "items": { "type": "string" } }, "dependency_uids": { "type": "array", "items": { "type": "string" } } } }
```

### `scene_save_as` ✔ ✅ · writes a new file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string", "pattern": "^res://" } } }
```
- **Output**
```json
{ "type": "object", "required": ["saved_as"], "properties": { "saved_as": { "type": "string" } } }
```

### `node_add` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path", "type"],
  "properties": {
    "parent_path": { "type": "string", "description": "'.' for root" },
    "type": { "type": "string", "description": "engine class, e.g. AudioStreamPlayer3D" },
    "name": { "type": "string" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" },
  "coerced": { "type": "boolean" }, "requested": { "type": "string" } } }
```

### `node_delete` ✔ ✅ · undoable
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["deleted"], "properties": { "deleted": { "type": "string" } } }
```

### `node_rename` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "new_name"],
  "properties": { "path": { "type": "string" }, "new_name": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name"], "properties": { "path": { "type": "string" }, "name": { "type": "string" } } }
```

### `node_reparent` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "new_parent_path"],
  "properties": {
    "path": { "type": "string" },
    "new_parent_path": { "type": "string" },
    "keep_global_transform": { "type": "boolean", "default": true }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["path"], "properties": { "path": { "type": "string" } } }
```

### `node_set_property` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "property", "value"],
  "properties": {
    "path": { "type": "string" },
    "property": { "type": "string" },
    "value": { "$ref": "#/$defs/Variant" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "property", "value"],
  "properties": { "path": { "type": "string" }, "property": { "type": "string" }, "value": { "$ref": "#/$defs/Variant" },
    "coerced": { "type": "boolean" }, "requested": { "$ref": "#/$defs/Variant" } } }
```
`value` is read back from the engine AFTER the write and compared to what was asked for. A write that did not land is an **error** — `set_ignored` when the property is unchanged, `set_mismatch` when the engine stored an incompatible type — rather than a success carrying the old value. `coerced` and `requested` appear together, and only when the write landed and the engine then changed it (a setter that clamps, snaps or normalises), so a caller can tell *your value, stored* from *a value like yours, stored*.

### `node_get_property` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "property"], "properties": { "path": { "type": "string" }, "property": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "property", "value"],
  "properties": { "path": { "type": "string" }, "property": { "type": "string" }, "value": { "$ref": "#/$defs/Variant" } } }
```

### `node_duplicate` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "name": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" } } }
```

### `node_get_children` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "children"], "properties": { "path": { "type": "string" }, "children": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "type": { "type": "string" }, "path": { "type": "string" } } } } } }
```

### `node_find` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": { "root_path": { "type": "string" }, "type": { "type": "string" }, "name_contains": { "type": "string" }, "limit": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["matches", "count"], "properties": { "matches": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "type": { "type": "string" }, "path": { "type": "string" } } } }, "count": { "type": "integer" } } }
```

### `node_list_groups` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "groups"], "properties": { "path": { "type": "string" }, "groups": { "type": "array", "items": { "type": "string" } } } }
```

### `node_add_to_group` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "group"], "properties": { "path": { "type": "string" }, "group": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "group", "added"], "properties": { "path": { "type": "string" }, "group": { "type": "string" }, "added": { "type": "boolean" } } }
```

### `node_remove_from_group` ✔ ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "group"], "properties": { "path": { "type": "string" }, "group": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "group", "removed"], "properties": { "path": { "type": "string" }, "group": { "type": "string" }, "removed": { "type": "boolean" } } }
```

### `node_instantiate_scene` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path", "scene_path"], "properties": { "parent_path": { "type": "string", "description": "'.' for root" }, "scene_path": { "type": "string", "pattern": "^res://" }, "name": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "scene"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "scene": { "type": "string" } } }
```

### `node_move_child` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "to_index"], "properties": { "path": { "type": "string" }, "to_index": { "type": "integer", "description": "0-based; negative counts from the end" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "index"], "properties": { "path": { "type": "string" }, "index": { "type": "integer" } } }
```

### `node_change_type` ✔ ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "type"], "properties": { "path": { "type": "string" }, "type": { "type": "string", "description": "new engine class" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "old_type"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "old_type": { "type": "string" } } }
```

### `node_set_owner` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "owner_path": { "type": "string", "description": "'.' or omitted = scene root" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "owner"], "properties": { "path": { "type": "string" }, "owner": { "type": ["string", "null"] } } }
```

### `node_set_editable_instance` ✅ (undoable)
Toggle "Editable Children" on an instanced sub-scene. When enabled, property overrides on the instance's internal nodes serialize into the saved scene (otherwise the sub-scene is sealed and its internals revert on reload). Lets author-time edits — e.g. `card_instance` slot data — be baked into the `.tscn`.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "editable": { "type": "boolean", "description": "enable (true, default) or disable editable children" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "editable", "owner"], "properties": { "path": { "type": "string" }, "editable": { "type": "boolean" }, "owner": { "type": "string" } } }
```

### `node_call_method` ✔ ✅ · arbitrary invocation, edit-time
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "method"], "properties": { "path": { "type": "string" }, "method": { "type": "string" }, "args": { "type": "array", "items": { "$ref": "#/$defs/Variant" } } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "method", "result"], "properties": { "path": { "type": "string" }, "method": { "type": "string" }, "result": { "$ref": "#/$defs/Variant" } } }
```

### `node_get_path` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "index", "child_count"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "index": { "type": "integer" }, "parent": { "type": ["string", "null"] }, "child_count": { "type": "integer" } } }
```

### `node_list_properties` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "properties"], "properties": { "path": { "type": "string" }, "properties": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "type": { "type": "integer" }, "class_name": { "type": "string" }, "usage": { "type": "integer" } } } } } }
```

### `signal_list` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "signals"], "properties": { "path": { "type": "string" }, "signals": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "args": { "type": "array", "items": { "type": "string" } } } } } } }
```

### `signal_list_connections` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "signal": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "connections"], "properties": { "path": { "type": "string" }, "connections": { "type": "array", "items": { "type": "object", "properties": { "signal": { "type": "string" }, "target": { "type": ["string", "null"] }, "method": { "type": "string" }, "flags": { "type": "integer" } } } } } }
```

### `signal_connect` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "signal", "target_path", "method"], "properties": { "path": { "type": "string" }, "signal": { "type": "string" }, "target_path": { "type": "string" }, "method": { "type": "string" }, "flags": { "type": "integer", "default": 2 } } }
```
- **Output**
```json
{ "type": "object", "required": ["signal", "source", "target", "method", "flags", "connected"], "properties": { "signal": { "type": "string" }, "source": { "type": "string" }, "target": { "type": "string" }, "method": { "type": "string" }, "flags": { "type": "integer" }, "connected": { "type": "boolean" } } }
```

### `signal_disconnect` ✔ ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "signal", "target_path", "method"], "properties": { "path": { "type": "string" }, "signal": { "type": "string" }, "target_path": { "type": "string" }, "method": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["signal", "source", "target", "method", "disconnected"], "properties": { "signal": { "type": "string" }, "source": { "type": "string" }, "target": { "type": "string" }, "method": { "type": "string" }, "disconnected": { "type": "boolean" } } }
```

### `signal_add_user_signal` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "signal"], "properties": { "path": { "type": "string" }, "signal": { "type": "string" }, "args": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "type": { "type": "integer" } } } } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "signal", "added"], "properties": { "path": { "type": "string" }, "signal": { "type": "string" }, "added": { "type": "boolean" } } }
```

### `signal_emit` ✔ ✅ · edit-time side effects
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "signal"], "properties": { "path": { "type": "string" }, "signal": { "type": "string" }, "args": { "type": "array", "items": { "$ref": "#/$defs/Variant" } } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "signal", "emitted"], "properties": { "path": { "type": "string" }, "signal": { "type": "string" }, "emitted": { "type": "boolean" } } }
```

### `selection_get` ✅
- **Input**
```json
{ "type": "object", "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["selection"], "properties": { "selection": { "type": "array", "items": { "type": "string" } } } }
```

### `selection_set` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["paths"], "properties": { "paths": { "type": "array", "items": { "type": "string" } } } }
```
- **Output**
```json
{ "type": "object", "required": ["selection"], "properties": { "selection": { "type": "array", "items": { "type": "string" } } } }
```

### `main_screen_get` ✅ · read-only
Which main-screen editor tab is active, and which exist on this Godot version. The active tab decides
what `screenshot_editor` can capture: Godot collapses the inactive tab's viewport to a few pixels, so
a capture of the wrong one "succeeds" with a placeholder frame. `available` is read from the engine,
not hardcoded — the list differs by version.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["active", "available"], "properties": { "active": { "type": ["string", "null"] }, "available": { "type": "array", "items": { "type": "string" } } } }
```

### `main_screen_set` ✅ · idempotent
Switch the main-screen tab. The name is matched case-insensitively against what the editor reports,
so `"2d"` works as well as `"2D"`; an unknown name returns `not_found` carrying the live list. The
result is read back from the editor rather than echoed, because the caller's next move is usually a
capture and it should act on what the editor actually did. Pair with `screenshot_editor`: opening a
scene does **not** switch the tab.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name"], "properties": { "name": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["active", "available", "requested"], "properties": { "active": { "type": ["string", "null"] }, "available": { "type": "array", "items": { "type": "string" } }, "requested": { "type": "string" } } }
```

### `classdb_get_class` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["class_name"],
  "properties": {
    "class_name": { "type": "string" },
    "include_inherited": { "type": "boolean", "default": false }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["class", "parent", "methods", "properties", "signals"],
  "properties": {
    "class": { "type": "string" },
    "parent": { "type": "string" },
    "can_instantiate": { "type": "boolean" },
    "methods": { "type": "array", "items": { "type": "string" } },
    "properties": { "type": "array", "items": { "type": "string" } },
    "signals": { "type": "array", "items": { "type": "string" } }
  } }
```

### `screenshot_editor` ✅ (returns MCP image content)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": { "viewport": { "enum": ["2d", "3d"], "default": "3d" } } }
```
- **Output** — MCP `content: [{ type: "image", data, mimeType }, { type: "text" }]`. Bridge payload:
```json
{ "type": "object", "required": ["base64", "mime", "width", "height", "viewport"],
  "properties": {
    "base64": { "type": "string" }, "mime": { "const": "image/png" },
    "width": { "type": "integer" }, "height": { "type": "integer" },
    "viewport": { "enum": ["2d", "3d"] }
  } }
```

### `resource_create` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["class_name", "to_path"], "properties": { "class_name": { "type": "string" }, "to_path": { "type": "string", "pattern": "^res://" }, "properties": { "type": "object" }, "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["created", "type"], "properties": { "created": { "type": "string" }, "type": { "type": "string" } } }
```

### `resource_load` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "type", "resource_name", "properties"], "properties": { "path": { "type": "string" }, "type": { "type": "string" }, "resource_name": { "type": "string" }, "properties": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "type": { "type": "integer" }, "class_name": { "type": "string" }, "usage": { "type": "integer" } } } } } }
```

### `resource_save` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["from_path"], "properties": { "from_path": { "type": "string" }, "to_path": { "type": "string", "pattern": "^res://" }, "flags": { "type": "integer" }, "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["saved", "from"], "properties": { "saved": { "type": "string" }, "from": { "type": "string" } } }
```

### `resource_duplicate` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "to_path"], "properties": { "path": { "type": "string" }, "to_path": { "type": "string", "pattern": "^res://" }, "deep": { "type": "boolean" }, "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["duplicated", "from", "deep"], "properties": { "duplicated": { "type": "string" }, "from": { "type": "string" }, "deep": { "type": "boolean" } } }
```

### `resource_get_property` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "property"], "properties": { "path": { "type": "string" }, "property": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "property", "value"], "properties": { "path": { "type": "string" }, "property": { "type": "string" }, "value": {} } }
```

### `resource_set_property` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "property", "value"], "properties": { "path": { "type": "string" }, "property": { "type": "string" }, "value": {}, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "property", "value"], "properties": { "path": { "type": "string" }, "property": { "type": "string" }, "value": {} } }
```

### `resource_get_import_settings` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "imported", "importer", "settings"], "properties": { "path": { "type": "string" }, "imported": { "type": "boolean" }, "importer": { "type": "string" }, "settings": { "type": "object" } } }
```

### `resource_set_import_settings` ✔ ✅ · rewrites metadata + reimports
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "settings"], "properties": { "path": { "type": "string" }, "settings": { "type": "object" }, "reimport": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "reimported", "settings", "changed"], "properties": { "path": { "type": "string" }, "reimported": { "type": "boolean" }, "settings": { "type": "array", "items": { "type": "string" } }, "changed": { "type": "array", "items": { "type": "string" } } } }
```

### `filesystem_list` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": { "path": { "type": "string", "description": "default res://" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "dirs", "files"], "properties": { "path": { "type": "string" }, "dirs": { "type": "array", "items": { "type": "string" } }, "files": { "type": "array", "items": { "type": "string" } } } }
```

### `filesystem_scan` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["scanning"], "properties": { "scanning": { "type": "boolean" } } }
```

### `filesystem_move` ✔ ✅ · moves on disk; no reference remap
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["from_path", "to_path"], "properties": { "from_path": { "type": "string", "pattern": "^res://" }, "to_path": { "type": "string", "pattern": "^res://" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["moved", "from", "moved_import", "import_stranded"], "properties": { "moved": { "type": "string" }, "from": { "type": "string" }, "moved_import": { "type": "boolean" }, "import_stranded": { "type": "boolean" } } }
```

### `filesystem_create_dir` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string", "pattern": "^res://" } } }
```
- **Output**
```json
{ "type": "object", "required": ["created", "existed"], "properties": { "created": { "type": "string" }, "existed": { "type": "boolean" } } }
```

## Group C — Animation (Plane A / Editor)

Authoring over an in-scene `AnimationPlayer`; animations live in its `AnimationLibrary` resources. Every mutation goes through `EditorUndoRedoManager` (undoable, nothing written to disk). Names are addressed as `animation` within a `library` (default `""`).

Batch 2 (`anim_tree_*`, `anim_statemachine_*`) authors an `AnimationTree` node and its `tree_root` graph — an `AnimationNodeBlendTree` or `AnimationNodeStateMachine` — adding graph nodes, state-machine states, and transitions. Same model: undoable via `EditorUndoRedoManager`, ungated, nothing written to disk.

### `anim_player_create` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "name": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" } } }
```

### `anim_create` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["player_path", "name"], "properties": { "player_path": { "type": "string" }, "name": { "type": "string" }, "library": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["player", "library", "name"], "properties": { "player": { "type": "string" }, "library": { "type": "string" }, "name": { "type": "string" } } }
```

### `anim_delete` ✔ ✅ · removes an animation; gated
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["player_path", "name"], "properties": { "player_path": { "type": "string" }, "name": { "type": "string" }, "library": { "type": "string" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["player", "library", "deleted"], "properties": { "player": { "type": "string" }, "library": { "type": "string" }, "deleted": { "type": "string" } } }
```

### `anim_add_track` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["player_path", "name", "path"], "properties": { "player_path": { "type": "string" }, "name": { "type": "string" }, "path": { "type": "string", "description": "node path or Node:property" }, "type": { "type": "string", "enum": ["value", "position_3d", "rotation_3d", "scale_3d", "blend_shape", "method", "bezier", "audio", "animation"] }, "library": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["track", "type", "path"], "properties": { "track": { "type": "integer" }, "type": { "type": "string" }, "path": { "type": "string" } } }
```

### `anim_insert_key` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["player_path", "name", "track", "time", "value"], "properties": { "player_path": { "type": "string" }, "name": { "type": "string" }, "track": { "type": "integer" }, "time": { "type": "number" }, "value": { "description": "Variant matching the track type" }, "transition": { "type": "number" }, "library": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["track", "time", "key_count"], "properties": { "track": { "type": "integer" }, "time": { "type": "number" }, "key_count": { "type": "integer" } } }
```

### `anim_remove_key` ✔ ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["player_path", "name", "track", "key"], "properties": { "player_path": { "type": "string" }, "name": { "type": "string" }, "track": { "type": "integer" }, "key": { "type": "integer" }, "library": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["track", "removed_key", "time"], "properties": { "track": { "type": "integer" }, "removed_key": { "type": "integer" }, "time": { "type": "number" } } }
```

### `anim_set_length` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["player_path", "name", "length"], "properties": { "player_path": { "type": "string" }, "name": { "type": "string" }, "length": { "type": "number" }, "library": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["length", "previous"], "properties": { "length": { "type": "number" }, "previous": { "type": "number" } } }
```

### `anim_set_loop` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["player_path", "name", "mode"], "properties": { "player_path": { "type": "string" }, "name": { "type": "string" }, "mode": { "type": "string", "enum": ["none", "linear", "pingpong"] }, "library": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["mode", "previous"], "properties": { "mode": { "type": "string" }, "previous": { "type": "string" } } }
```

### `anim_get_track_keys` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["player_path", "name", "track"], "properties": { "player_path": { "type": "string" }, "name": { "type": "string" }, "track": { "type": "integer" }, "library": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["track", "type", "path", "keys"], "properties": { "track": { "type": "integer" }, "type": { "type": "string" }, "path": { "type": "string" }, "keys": { "type": "array", "items": { "type": "object", "properties": { "index": { "type": "integer" }, "time": { "type": "number" }, "value": {}, "transition": { "type": "number" } } } } } }
```

### `anim_list` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["player_path"], "properties": { "player_path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["player", "animations"], "properties": { "player": { "type": "string" }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "library": { "type": "string" }, "animation": { "type": "string" }, "length": { "type": "number" }, "loop_mode": { "type": "string" }, "track_count": { "type": "integer" } } } } } }
```

### `anim_tree_create` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "name": { "type": "string" }, "root_type": { "type": "string", "enum": ["blend_tree", "state_machine"] }, "anim_player_path": { "type": "string" }, "active": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "root_type", "anim_player", "active"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "root_type": { "type": "string" }, "anim_player": { "type": "string" }, "active": { "type": "boolean" } } }
```

### `anim_tree_add_node` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["tree_path", "node_name", "node_type"], "properties": { "tree_path": { "type": "string" }, "node_name": { "type": "string" }, "node_type": { "type": "string" }, "animation": { "type": "string" }, "position": { "type": "array", "items": { "type": "number" } } } }
```
- **Output**
```json
{ "type": "object", "required": ["tree", "node_name", "node_type", "position"], "properties": { "tree": { "type": "string" }, "node_name": { "type": "string" }, "node_type": { "type": "string" }, "position": { "type": "array", "items": { "type": "number" } } } }
```

### `anim_statemachine_add_state` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["tree_path", "state_name"], "properties": { "tree_path": { "type": "string" }, "state_name": { "type": "string" }, "animation": { "type": "string" }, "node_type": { "type": "string" }, "state_machine": { "type": "string" }, "position": { "type": "array", "items": { "type": "number" } } } }
```
- **Output**
```json
{ "type": "object", "required": ["tree", "state_machine", "state_name", "node_type", "animation", "position"], "properties": { "tree": { "type": "string" }, "state_machine": { "type": "string" }, "state_name": { "type": "string" }, "node_type": { "type": "string" }, "animation": { "type": "string" }, "position": { "type": "array", "items": { "type": "number" } } } }
```

### `anim_statemachine_add_transition` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["tree_path", "from_state", "to_state"], "properties": { "tree_path": { "type": "string" }, "from_state": { "type": "string" }, "to_state": { "type": "string" }, "state_machine": { "type": "string" }, "xfade_time": { "type": "number" }, "switch_mode": { "type": "string", "enum": ["immediate", "sync", "at_end"] }, "advance_mode": { "type": "string", "enum": ["disabled", "enabled", "auto"] }, "advance_condition": { "type": "string" }, "priority": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["tree", "state_machine", "from_state", "to_state", "xfade_time", "switch_mode", "advance_mode", "transition_count"], "properties": { "tree": { "type": "string" }, "state_machine": { "type": "string" }, "from_state": { "type": "string" }, "to_state": { "type": "string" }, "xfade_time": { "type": "number" }, "switch_mode": { "type": "string" }, "advance_mode": { "type": "string" }, "transition_count": { "type": "integer" } } }
```

## Group D — TileMap/TileSet (Plane A / Editor)

Disk-backed TileSet authoring: each tool loads a `.tres` `TileSet`, mutates it, and re-saves — so all four are file-writing and **gated** by confirmation, and none need a scene open. Sources are `TileSetAtlasSource` (a texture carved into a grid); tiles are addressed by `atlas_coords` in cells; per-tile collision polygons live on `TileData` under numbered physics layers (created on demand). `tilemaplayer_create` and the `tilemap_*` cell painters (Group D batch 2) consume the TileSet produced here.

Batch 2 (`tilemaplayer_create`, `tilemap_*`) is the other half: it authors a `TileMapLayer` **node in the edited scene** and paints its cells. Unlike the disk-backed writers above, these mutate the open scene and are **undoable** via `EditorUndoRedoManager` and **ungated** (the in-scene `node_*` model). `tilemaplayer_create` optionally binds a TileSet `.tres` as the layer's `tile_set`; cells are addressed by integer `coords` and painted with a `source_id` + `atlas_coords` (+ `alternative`). `set_cell` with `source_id` -1 erases; `set_cells_rect` fills a region in one undoable action (capped at 65536 cells); an empty cell reads back as `source_id` -1 / `atlas_coords` [-1, -1] / `alternative` 0. `TileMapLayer` supersedes the deprecated `TileMap` node in Godot 4.x.

### `tileset_create` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["to_path"], "properties": { "to_path": { "type": "string", "pattern": "^res://" }, "tile_size": { "type": "array", "items": { "type": "integer" } }, "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["created", "tile_size"], "properties": { "created": { "type": "string" }, "tile_size": { "type": "array", "items": { "type": "integer" } } } }
```

### `tileset_add_source` ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["tileset_path", "texture_path"], "properties": { "tileset_path": { "type": "string" }, "texture_path": { "type": "string" }, "texture_region_size": { "type": "array", "items": { "type": "integer" } }, "source_id": { "type": "integer" }, "margins": { "type": "array", "items": { "type": "integer" } }, "separation": { "type": "array", "items": { "type": "integer" } }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["tileset", "source_id", "texture", "texture_region_size", "source_count"], "properties": { "tileset": { "type": "string" }, "source_id": { "type": "integer" }, "texture": { "type": "string" }, "texture_region_size": { "type": "array", "items": { "type": "integer" } }, "source_count": { "type": "integer" } } }
```

### `tileset_add_tile` ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["tileset_path", "source_id", "atlas_coords"], "properties": { "tileset_path": { "type": "string" }, "source_id": { "type": "integer" }, "atlas_coords": { "type": "array", "items": { "type": "integer" } }, "size": { "type": "array", "items": { "type": "integer" } }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["tileset", "source_id", "atlas_coords", "size", "tiles_count"], "properties": { "tileset": { "type": "string" }, "source_id": { "type": "integer" }, "atlas_coords": { "type": "array", "items": { "type": "integer" } }, "size": { "type": "array", "items": { "type": "integer" } }, "tiles_count": { "type": "integer" } } }
```

### `tileset_set_tile_collision` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["tileset_path", "source_id", "atlas_coords", "polygon"], "properties": { "tileset_path": { "type": "string" }, "source_id": { "type": "integer" }, "atlas_coords": { "type": "array", "items": { "type": "integer" } }, "polygon": { "type": "array", "items": { "type": "array", "items": { "type": "number" } } }, "physics_layer": { "type": "integer" }, "one_way": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["tileset", "source_id", "atlas_coords", "physics_layer", "polygon_index", "points", "one_way"], "properties": { "tileset": { "type": "string" }, "source_id": { "type": "integer" }, "atlas_coords": { "type": "array", "items": { "type": "integer" } }, "physics_layer": { "type": "integer" }, "polygon_index": { "type": "integer" }, "points": { "type": "integer" }, "one_way": { "type": "boolean" } } }
```

### `tilemaplayer_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "name": { "type": "string" }, "tileset_path": { "type": "string", "pattern": "^res://" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "tile_set"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "tile_set": { "type": "string" } } }
```

### `tilemap_set_cell` ✔ ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "coords"], "properties": { "path": { "type": "string" }, "coords": { "type": "array", "items": { "type": "integer" } }, "source_id": { "type": "integer" }, "atlas_coords": { "type": "array", "items": { "type": "integer" } }, "alternative": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "coords", "source_id", "atlas_coords", "alternative", "erased"], "properties": { "path": { "type": "string" }, "coords": { "type": "array", "items": { "type": "integer" } }, "source_id": { "type": "integer" }, "atlas_coords": { "type": "array", "items": { "type": "integer" } }, "alternative": { "type": "integer" }, "erased": { "type": "boolean" } } }
```

### `tilemap_set_cells_rect` ✔ ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "rect"], "properties": { "path": { "type": "string" }, "rect": { "type": "array", "items": { "type": "integer" }, "minItems": 4, "description": "[x, y, width, height] in cells" }, "source_id": { "type": "integer" }, "atlas_coords": { "type": "array", "items": { "type": "integer" } }, "alternative": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "rect", "cells", "source_id", "atlas_coords", "alternative", "erased"], "properties": { "path": { "type": "string" }, "rect": { "type": "array", "items": { "type": "integer" } }, "cells": { "type": "integer" }, "source_id": { "type": "integer" }, "atlas_coords": { "type": "array", "items": { "type": "integer" } }, "alternative": { "type": "integer" }, "erased": { "type": "boolean" } } }
```

### `tilemap_get_cell` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "coords"], "properties": { "path": { "type": "string" }, "coords": { "type": "array", "items": { "type": "integer" } } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "coords", "source_id", "atlas_coords", "alternative", "empty"], "properties": { "path": { "type": "string" }, "coords": { "type": "array", "items": { "type": "integer" } }, "source_id": { "type": "integer" }, "atlas_coords": { "type": "array", "items": { "type": "integer" } }, "alternative": { "type": "integer" }, "empty": { "type": "boolean" } } }
```

### `tilemap_clear` ✔ ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "cleared_cells"], "properties": { "path": { "type": "string" }, "cleared_cells": { "type": "integer" } } }
```

## Group E — Physics & collision (Plane A / Editor)

In-scene physics authoring. Every tool mutates the **edited scene** and is **undoable** via `EditorUndoRedoManager` and **ungated** — the `node_*` / `tilemap_*` model, not the disk-writing gated `tileset_*` model. `body_create` adds a `StaticBody`/`RigidBody`/`CharacterBody`/`Area` node; `collisionshape_add` adds a `CollisionShape2D`/`CollisionShape3D` carrying a shape resource (`rect`→Rectangle/Box, `circle`→Circle/Sphere, `capsule`→Capsule 2D/3D, `polygon`→ConvexPolygon 2D/3D); `body_set_collision_layer` / `body_set_collision_mask` set the bitmasks on any body or area (`CollisionObject2D/3D`). `dim` selects 2D (default) or 3D. The API surface (bodies + `CollisionShape2D/3D` + the six shape resources) was probed live on Godot 4.7, and a `StaticBody2D → CollisionShape2D(RectangleShape2D)` scene was packed to a `.tscn`, saved, and reloaded — body `collision_layer` and the shape (type + `size`) survive the round-trip. This is the group that crosses godot-mcp-pro's 162-tool ceiling. Batch 1 added bodies, collision shapes, and layer/mask; **batch 2 completes the group**: `area_set_monitoring` / `area_set_gravity` (Area monitoring + gravity zones), `joint_create` / `joint_set_bodies` (2D `PinJoint2D`/`GrooveJoint2D`/`DampedSpringJoint2D`, 3D `PinJoint3D`/`HingeJoint3D`/`SliderJoint3D`/`ConeTwistJoint3D`/`Generic6DOFJoint3D`), `collisionpolygon_add` (`CollisionPolygon2D/3D`), `rigidbody_set_properties`, `body_set_physics_material` (a `PhysicsMaterial` override), and the gated `physics_set_gravity` (project `default_gravity`). All node/property mutators are undoable and ungated; `physics_set_gravity` writes ProjectSettings and is gated like `project_set_setting`. Every joint/area/rigidbody/polygon/material API was probed live on Godot 4.7 before design.

### `body_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path", "type"], "properties": { "parent_path": { "type": "string" }, "type": { "type": "string", "enum": ["static", "rigid", "character", "area"] }, "dim": { "type": "string", "enum": ["2d", "3d"] }, "name": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "body", "dim"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "body": { "type": "string" }, "dim": { "type": "string" } } }
```

### `collisionshape_add` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path", "shape"], "properties": { "parent_path": { "type": "string" }, "shape": { "type": "string", "enum": ["rect", "circle", "capsule", "polygon"] }, "dim": { "type": "string", "enum": ["2d", "3d"] }, "name": { "type": "string" }, "size": { "type": "array", "items": { "type": "number" } }, "radius": { "type": "number" }, "height": { "type": "number" }, "points": { "type": "array", "items": { "type": "array", "items": { "type": "number" } } } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "shape", "shape_class", "dim"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "shape": { "type": "string" }, "shape_class": { "type": "string" }, "dim": { "type": "string" } } }
```

### `body_set_collision_layer` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "layer"], "properties": { "path": { "type": "string" }, "layer": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "collision_layer"], "properties": { "path": { "type": "string" }, "collision_layer": { "type": "integer" } } }
```

### `body_set_collision_mask` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "mask"], "properties": { "path": { "type": "string" }, "mask": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "collision_mask"], "properties": { "path": { "type": "string" }, "collision_mask": { "type": "integer" } } }
```

### `area_set_monitoring` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "monitoring": { "type": "boolean" }, "monitorable": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "monitoring", "monitorable"], "properties": { "path": { "type": "string" }, "monitoring": { "type": "boolean" }, "monitorable": { "type": "boolean" } } }
```

### `area_set_gravity` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "space_override": { "type": "string", "enum": ["disabled", "combine", "combine_replace", "replace", "replace_combine"] }, "gravity": { "type": "number" }, "direction": { "type": "array", "items": { "type": "number" } }, "point": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "space_override", "gravity", "direction", "gravity_point", "dim"], "properties": { "path": { "type": "string" }, "space_override": { "type": "string" }, "gravity": { "type": "number" }, "direction": { "type": "array", "items": { "type": "number" } }, "gravity_point": { "type": "boolean" }, "dim": { "type": "string" } } }
```

### `joint_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path", "type"], "properties": { "parent_path": { "type": "string" }, "type": { "type": "string", "enum": ["pin", "groove", "spring", "hinge", "slider", "cone_twist", "generic6dof"] }, "dim": { "type": "string", "enum": ["2d", "3d"] }, "name": { "type": "string" }, "node_a": { "type": "string" }, "node_b": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "joint", "dim", "node_a", "node_b"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "joint": { "type": "string" }, "dim": { "type": "string" }, "node_a": { "type": "string" }, "node_b": { "type": "string" } } }
```

### `joint_set_bodies` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "node_a": { "type": "string" }, "node_b": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "node_a", "node_b"], "properties": { "path": { "type": "string" }, "node_a": { "type": "string" }, "node_b": { "type": "string" } } }
```

### `collisionpolygon_add` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path", "points"], "properties": { "parent_path": { "type": "string" }, "points": { "type": "array", "items": { "type": "array", "items": { "type": "number" } } }, "dim": { "type": "string", "enum": ["2d", "3d"] }, "name": { "type": "string" }, "build_mode": { "type": "string", "enum": ["solids", "segments"] }, "depth": { "type": "number" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "dim", "points"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "dim": { "type": "string" }, "points": { "type": "integer" } } }
```

### `rigidbody_set_properties` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "mass": { "type": "number" }, "gravity_scale": { "type": "number" }, "linear_damp": { "type": "number" }, "angular_damp": { "type": "number" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "mass", "gravity_scale", "linear_damp", "angular_damp"], "properties": { "path": { "type": "string" }, "mass": { "type": "number" }, "gravity_scale": { "type": "number" }, "linear_damp": { "type": "number" }, "angular_damp": { "type": "number" } } }
```

### `body_set_physics_material` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "friction": { "type": "number" }, "bounce": { "type": "number" }, "rough": { "type": "boolean" }, "absorbent": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "friction", "bounce", "rough", "absorbent"], "properties": { "path": { "type": "string" }, "friction": { "type": "number" }, "bounce": { "type": "number" }, "rough": { "type": "boolean" }, "absorbent": { "type": "boolean" } } }
```

### `physics_set_gravity` ✔ ✅ (gated)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": { "dim": { "type": "string", "enum": ["2d", "3d"] }, "magnitude": { "type": "number" }, "direction": { "type": "array", "items": { "type": "number" } }, "save": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["dim", "magnitude", "direction", "saved"], "properties": { "dim": { "type": "string" }, "magnitude": { "type": "number" }, "direction": { "type": "array", "items": { "type": "number" } }, "saved": { "type": "boolean" } } }
```

## Group F — VFX & audio (Plane A / Editor)

In-scene VFX authoring. Every tool mutates the **edited scene** and is **undoable** via `EditorUndoRedoManager` and **ungated** — the `node_*` model. Batch 1 covers **GPU particles**: `particles_create` adds a `GPUParticles2D`/`GPUParticles3D` (`dim` selects 2D default or 3D), optionally seeding `amount`/`lifetime`/`emitting`; `particles_set_process_material` creates a `ParticleProcessMaterial` and assigns it as `process_material` (GPU particles need one to emit), exposing `gravity`/`direction` (Vector3), `spread`, `initial_velocity_min`/`_max`, `scale_min`/`_max`, and `color`; `particles_set_amount` / `particles_set_lifetime` / `particles_set_emitting` tune the headline knobs individually; `particles_set_texture` loads a `Texture2D` from a `res://` path onto a `GPUParticles2D` — GPUParticles3D draws meshes and has no texture, so it degrades to a clear `unsupported` that **names the offending node and the class to pass instead** (this is the SHAPE kind of `unsupported`, not a statement about the engine build — see check 24). The particle + `ParticleProcessMaterial` API surface (properties present per dim, the 2D-only `texture`) was probed live on Godot 4.7 before design. **Batch 2 adds shaders**: `shader_create` and `shader_set_code` author a `Shader` (`.gdshader`) resource on disk — initial or replacement GDShader source — and, because they write files, are **gated** by confirmation like the `resource_*` / `tileset_*` writers (not the in-scene model); `shadermaterial_create` creates a `ShaderMaterial` and assigns it to a node's material slot — `CanvasItem.material` (2D / Control) or `GeometryInstance3D.material_override` (3D), degrading to a clear `unsupported` for a node with neither — and that refusal **names the node and both classes that do have a slot**, because it is the SHAPE kind of `unsupported` (the caller picked the wrong node) and not the CAPABILITY kind (this Godot build cannot) — optionally binding a `Shader` loaded from a `res://` path; `shadermaterial_set_shader` swaps the shader on an existing `ShaderMaterial`; `shadermaterial_set_param` sets a uniform through the `shader_parameter/<name>` property path (values use the tagged-Variant convention). The three `shadermaterial_*` tools mutate the edited scene and are **undoable** and **ungated**. `Shader` / `ShaderMaterial` / `set_shader_parameter` and the `shader_parameter/<name>` property-path form were probed live on Godot 4.7, and a `Sprite2D` carrying a `ShaderMaterial` (external `.gdshader` + a `shader_parameter` override) survives a `.tscn` save + fresh reload. **Batch 3 completes Group F with audio**: `audio_player_create` adds an `AudioStreamPlayer` / `AudioStreamPlayer2D` / `AudioStreamPlayer3D` (`dim` selects `none` default / `2d` / `3d`), optionally seeding `stream_path` (a `res://` `AudioStream`), `autoplay`, `volume_db`, `bus`; `audio_set_stream` loads an `AudioStream` from a `res://` path onto a player — both mutate the edited scene and are **undoable** / **ungated** (the `node_*` model). The remaining four drive the **global `AudioServer`** (project-wide, not scene-undoable) and are **gated** like `physics_set_gravity`: `audio_bus_add` adds a bus (optional name / position / send), `audio_bus_add_effect` instantiates an `AudioEffect` subclass by name onto a named bus, `audio_bus_set_volume` sets a bus's `volume_db`, and `audio_set_bus_layout` persists the current layout to a `.tres` on disk (`generate_bus_layout` + `ResourceSaver.save`; a file-writer). The `AudioServer` bus API and the player `stream` / `autoplay` / `volume_db` / `bus` props were probed live on Godot 4.7, and an `AudioStreamPlayer` carrying an external stream survives a `.tscn` save + fresh reload.

### `particles_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "dim": { "type": "string", "enum": ["2d", "3d"] }, "name": { "type": "string" }, "amount": { "type": "number" }, "lifetime": { "type": "number" }, "emitting": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "dim", "amount", "lifetime", "emitting"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "dim": { "type": "string" }, "amount": { "type": "number" }, "lifetime": { "type": "number" }, "emitting": { "type": "boolean" } } }
```

### `particles_set_process_material` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "gravity": { "type": "array", "items": { "type": "number" } }, "direction": { "type": "array", "items": { "type": "number" } }, "spread": { "type": "number" }, "initial_velocity_min": { "type": "number" }, "initial_velocity_max": { "type": "number" }, "scale_min": { "type": "number" }, "scale_max": { "type": "number" }, "color": { "type": "array", "items": { "type": "number" } } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "gravity", "direction", "spread", "initial_velocity_min", "initial_velocity_max", "scale_min", "scale_max", "color"], "properties": { "path": { "type": "string" }, "gravity": { "type": "array", "items": { "type": "number" } }, "direction": { "type": "array", "items": { "type": "number" } }, "spread": { "type": "number" }, "initial_velocity_min": { "type": "number" }, "initial_velocity_max": { "type": "number" }, "scale_min": { "type": "number" }, "scale_max": { "type": "number" }, "color": { "type": "array", "items": { "type": "number" } } } }
```

### `particles_set_amount` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "amount"], "properties": { "path": { "type": "string" }, "amount": { "type": "number" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "amount"], "properties": { "path": { "type": "string" }, "amount": { "type": "number" } } }
```

### `particles_set_lifetime` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "lifetime"], "properties": { "path": { "type": "string" }, "lifetime": { "type": "number" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "lifetime"], "properties": { "path": { "type": "string" }, "lifetime": { "type": "number" } } }
```

### `particles_set_emitting` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "emitting"], "properties": { "path": { "type": "string" }, "emitting": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "emitting"], "properties": { "path": { "type": "string" }, "emitting": { "type": "boolean" } } }
```

### `particles_set_texture` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "texture_path"], "properties": { "path": { "type": "string" }, "texture_path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "texture_path"], "properties": { "path": { "type": "string" }, "texture_path": { "type": "string" } } }
```

### `shader_create` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["to_path"], "properties": { "to_path": { "type": "string" }, "code": { "type": "string" }, "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["created", "type", "code_length"], "properties": { "created": { "type": "string" }, "type": { "type": "string" }, "code_length": { "type": "number" } } }
```

### `shader_set_code` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "code"], "properties": { "path": { "type": "string" }, "code": { "type": "string" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "code_length"], "properties": { "path": { "type": "string" }, "code_length": { "type": "number" } } }
```

### `shadermaterial_create` ✔ ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "shader_path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "target_property", "type", "shader_path"], "properties": { "path": { "type": "string" }, "target_property": { "type": "string" }, "type": { "type": "string" }, "shader_path": { "type": "string" } } }
```

### `shadermaterial_set_shader` ✔ ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "shader_path"], "properties": { "path": { "type": "string" }, "shader_path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "shader_path"], "properties": { "path": { "type": "string" }, "shader_path": { "type": "string" } } }
```

### `shadermaterial_set_param` ✔ ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "param", "value"], "properties": { "path": { "type": "string" }, "param": { "type": "string" }, "value": {} } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "param", "value"], "properties": { "path": { "type": "string" }, "param": { "type": "string" }, "value": {} } }
```

### `audio_player_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "dim": { "type": "string", "enum": ["none", "2d", "3d"] }, "name": { "type": "string" }, "stream_path": { "type": "string" }, "autoplay": { "type": "boolean" }, "volume_db": { "type": "number" }, "bus": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "dim", "autoplay", "volume_db", "bus", "stream_path"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "dim": { "type": "string" }, "autoplay": { "type": "boolean" }, "volume_db": { "type": "number" }, "bus": { "type": "string" }, "stream_path": { "type": "string" } } }
```

### `audio_set_stream` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "stream_path"], "properties": { "path": { "type": "string" }, "stream_path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "stream_path"], "properties": { "path": { "type": "string" }, "stream_path": { "type": "string" } } }
```

### `audio_bus_add` ✅ · project-wide audio state
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": [], "properties": { "name": { "type": "string" }, "at_position": { "type": "number" }, "send": { "type": "string" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["index", "name", "send", "count"], "properties": { "index": { "type": "number" }, "name": { "type": "string" }, "send": { "type": "string" }, "count": { "type": "number" } } }
```

### `audio_bus_add_effect` ✅ · project-wide audio state
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["bus", "effect"], "properties": { "bus": { "type": "string" }, "effect": { "type": "string" }, "at_position": { "type": "number" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["bus", "bus_index", "effect", "effect_count"], "properties": { "bus": { "type": "string" }, "bus_index": { "type": "number" }, "effect": { "type": "string" }, "effect_count": { "type": "number" } } }
```

### `audio_bus_set_volume` ✔ ✅ · project-wide audio state
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["bus", "volume_db"], "properties": { "bus": { "type": "string" }, "volume_db": { "type": "number" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["bus", "bus_index", "volume_db"], "properties": { "bus": { "type": "string" }, "bus_index": { "type": "number" }, "volume_db": { "type": "number" } } }
```

### `audio_set_bus_layout` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": [], "properties": { "to_path": { "type": "string" }, "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["saved", "bus_count"], "properties": { "saved": { "type": "string" }, "bus_count": { "type": "number" } } }
```

## Group G — UI / Control / theming (Plane A / Editor)

The user-interface authoring surface. `control_create` and `container_add_child` add a **Control**-derived node (Button / Label / Panel / any `Container` / TextureRect / …) to the **edited scene** — both refuse a non-Control class, and `container_add_child` additionally refuses a non-`Container` parent so the child lands in a real layout container; `control_create` also seeds `text` on controls that expose it. `control_set_anchors` sets any of the four anchors (`left`/`top`/`right`/`bottom`, 0..1) directly; `control_set_layout_preset` applies a `LayoutPreset` (by name — `full_rect`, `center`, `top_left`, `hcenter_wide`, … — or the 0..15 integer) via `set_anchors_and_offsets_preset`, capturing all eight anchor/offset properties for a clean undo; `control_set_size_flags` sets the container `size_flags_horizontal` / `size_flags_vertical` bitmasks and/or `size_flags_stretch_ratio`; `control_set_theme` assigns (or clears) a `Theme` on a Control's `theme` property. All six mutate the edited scene and are **undoable** via `EditorUndoRedoManager` and **ungated** — the `node_*` model. The five `theme_*` tools author a **`Theme` resource on disk**: `theme_create` writes a new empty Theme, and `theme_set_color` / `theme_set_font` / `theme_set_stylebox` / `theme_set_constant` load a Theme, set one typed item (a `Color`, a `Font`/`StyleBox` loaded from a `res://` path, or an integer constant) for a given theme type, and re-save — so, like the `resource_*` / `shader_create` writers, they are **gated** by confirmation (not scene-undoable). The Control anchor / preset / size-flag / `theme` API and `Theme.set_color` / `set_font` / `set_stylebox` / `set_constant` were probed live on Godot 4.7 before design, and a `Button` carrying anchors + a `Theme` override survives a `.tscn` save + fresh reload.

### `control_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path", "type"], "properties": { "parent_path": { "type": "string" }, "type": { "type": "string" }, "name": { "type": "string" }, "text": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" } } }
```

### `container_add_child` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["container_path", "type"], "properties": { "container_path": { "type": "string" }, "type": { "type": "string" }, "name": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "container"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "container": { "type": "string" } } }
```

### `control_set_anchors` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "left": { "type": "number" }, "top": { "type": "number" }, "right": { "type": "number" }, "bottom": { "type": "number" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "anchors"], "properties": { "path": { "type": "string" }, "anchors": { "type": "object", "required": ["left", "top", "right", "bottom"], "properties": { "left": { "type": "number" }, "top": { "type": "number" }, "right": { "type": "number" }, "bottom": { "type": "number" } } } } }
```

### `control_set_layout_preset` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "preset"], "properties": { "path": { "type": "string" }, "preset": { "type": ["string", "integer"] }, "resize_mode": { "type": "integer" }, "margin": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "preset", "preset_name"], "properties": { "path": { "type": "string" }, "preset": { "type": "number" }, "preset_name": { "type": "string" } } }
```

### `control_set_size_flags` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "horizontal": { "type": "integer" }, "vertical": { "type": "integer" }, "stretch_ratio": { "type": "number" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "horizontal", "vertical", "stretch_ratio"], "properties": { "path": { "type": "string" }, "horizontal": { "type": "number" }, "vertical": { "type": "number" }, "stretch_ratio": { "type": "number" } } }
```

### `control_set_theme` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "theme_path"], "properties": { "path": { "type": "string" }, "theme_path": { "type": "string", "description": "Theme res:// path, or \"\" to clear" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "theme_path"], "properties": { "path": { "type": "string" }, "theme_path": { "type": "string" } } }
```

### `theme_create` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["to_path"], "properties": { "to_path": { "type": "string" }, "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["created", "type"], "properties": { "created": { "type": "string" }, "type": { "type": "string" } } }
```

### `theme_set_color` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "name", "theme_type", "color"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "theme_type": { "type": "string" }, "color": { "type": "array", "items": { "type": "number" } }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "theme_type", "color"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "theme_type": { "type": "string" }, "color": { "type": "array", "items": { "type": "number" } } } }
```

### `theme_set_font` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "name", "theme_type", "font_path"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "theme_type": { "type": "string" }, "font_path": { "type": "string" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "theme_type", "font_path"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "theme_type": { "type": "string" }, "font_path": { "type": "string" } } }
```

### `theme_set_stylebox` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "name", "theme_type", "stylebox_path"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "theme_type": { "type": "string" }, "stylebox_path": { "type": "string" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "theme_type", "stylebox_path"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "theme_type": { "type": "string" }, "stylebox_path": { "type": "string" } } }
```

### `theme_set_constant` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "name", "theme_type", "value"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "theme_type": { "type": "string" }, "value": { "type": "integer" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "theme_type", "value"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "theme_type": { "type": "string" }, "value": { "type": "number" } } }
```

## Group H — 3D & navigation (Plane A / Editor)

The 3D authoring surface. `meshinstance_create` adds a **MeshInstance3D** — optionally assigning a Mesh loaded from a `res://` path (e.g. a `primitive_mesh_create` output); `mesh_set_surface_material` assigns a `Material` (res:// path) to a MeshInstance3D, either the whole-instance `material_override` (default surface `-1`) or a specific surface's override slot, refusing a non-MeshInstance3D node or a non-`Material` resource; `light_create` adds a `DirectionalLight3D` / `OmniLight3D` / `SpotLight3D` (`kind` = dir/omni/spot); `camera_create` adds a `Camera3D` (optionally made `current`); `csg_create` adds a CSG primitive (`CSGBox3D` / `CSGSphere3D` / `CSGCylinder3D` / `CSGTorus3D` / `CSGPolygon3D` / `CSGMesh3D` / `CSGCombiner3D`); `navregion_create` adds a `NavigationRegion3D`, seeding a fresh empty `NavigationMesh` by default; `navagent_configure` adds a `NavigationAgent3D` and sets its steering/avoidance properties (radius, height, max_speed, path/target desired distances, avoidance_enabled). All seven mutate the edited scene and are **undoable** via `EditorUndoRedoManager` and **ungated** — the `node_*` model. Two families author a **resource on disk**: `primitive_mesh_create` writes a `PrimitiveMesh` (box/sphere/cylinder/plane/capsule/prism/torus/quad), and `environment_create` / `environment_set_sky` write and update an `Environment` (background mode + ambient light; attach a `Sky` with a Procedural / Physical / Panorama material and switch the background to SKY) — so, like the `resource_*` / `theme_*` writers, they are **gated** by confirmation. `navmesh_bake` is intentionally **deferred** — a real geometry bake is async and non-deterministic under a headless CI editor and awaits a maintainer semantics decision (like `scene_set_root`). The `MeshInstance3D` / `Light3D` / `Camera3D` / CSG / `NavigationRegion3D` / `NavigationAgent3D` and the `PrimitiveMesh` / `Environment` / `Sky` APIs were probed live on Godot 4.7 before design, and a `MeshInstance3D` carrying a primitive mesh + a `material_override` survives a `.tscn` save + fresh reload.

### `meshinstance_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "name": { "type": "string" }, "mesh_path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "mesh_path"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "mesh_path": { "type": "string" } } }
```

### `mesh_set_surface_material` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "material_path"], "properties": { "path": { "type": "string" }, "material_path": { "type": "string" }, "surface": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "material_path", "surface"], "properties": { "path": { "type": "string" }, "material_path": { "type": "string" }, "surface": { "type": "number" } } }
```

### `primitive_mesh_create` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["to_path"], "properties": { "to_path": { "type": "string" }, "shape": { "type": "string" }, "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["created", "type", "shape"], "properties": { "created": { "type": "string" }, "type": { "type": "string" }, "shape": { "type": "string" } } }
```

### `light_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "kind": { "type": "string", "enum": ["dir", "directional", "omni", "spot"] }, "name": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "kind"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "kind": { "type": "string" } } }
```

### `camera_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "name": { "type": "string" }, "current": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "current"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "current": { "type": "boolean" } } }
```

### `csg_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "shape": { "type": "string" }, "name": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "shape"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "shape": { "type": "string" } } }
```

### `navregion_create` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "name": { "type": "string" }, "with_navmesh": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "has_navmesh"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "has_navmesh": { "type": "boolean" } } }
```

### `navagent_configure` ✅ (undoable)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"], "properties": { "parent_path": { "type": "string" }, "name": { "type": "string" }, "radius": { "type": "number" }, "height": { "type": "number" }, "max_speed": { "type": "number" }, "path_desired_distance": { "type": "number" }, "target_desired_distance": { "type": "number" }, "avoidance_enabled": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "config"], "properties": { "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" }, "config": { "type": "object", "required": ["radius", "height", "max_speed", "path_desired_distance", "target_desired_distance", "avoidance_enabled"], "properties": { "radius": { "type": "number" }, "height": { "type": "number" }, "max_speed": { "type": "number" }, "path_desired_distance": { "type": "number" }, "target_desired_distance": { "type": "number" }, "avoidance_enabled": { "type": "boolean" } } } } }
```

### `environment_create` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["to_path"], "properties": { "to_path": { "type": "string" }, "background": { "type": "string" }, "ambient_color": { "type": "array", "items": { "type": "number" } }, "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["created", "type", "background_mode"], "properties": { "created": { "type": "string" }, "type": { "type": "string" }, "background_mode": { "type": "string" } } }
```

### `environment_set_sky` ✔ ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "sky_material": { "type": "string", "enum": ["procedural", "physical", "panorama"] }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "background_mode", "sky_material"], "properties": { "path": { "type": "string" }, "background_mode": { "type": "string" }, "sky_material": { "type": "string" } } }
```

## Group I — Input, project config & testing (Plane A / Editor)

The project-authoring surface. Four `inputmap_*` tools author the project's input actions in `ProjectSettings` (`input/<name>`): `inputmap_add_action` defines an action (deadzone + empty event list), `inputmap_add_event` appends an `InputEventKey` / `InputEventMouseButton` / `InputEventJoypadButton` / `InputEventJoypadMotion` built from a descriptor (`keycode`/`physical_keycode` accept a name like `"A"` via `OS.find_keycode_from_string` or an int), `inputmap_erase_action` removes one, and `inputmap_list` reads them all back (deadzone + each event's class and `as_text()`). Six project/editor-config tools follow: `project_add_autoload` / `project_remove_autoload` write `autoload/<name>` (a leading `*` marks an enabled global singleton) after checking the target `res://` path exists; `project_set_main_scene` writes `application/run/main_scene` (validated to be an existing `.tscn`/`.scn`); `project_list_settings` reads `ProjectSettings` keys+values filtered by a dotted prefix; `project_add_export_preset` appends a preset to `res://export_presets.cfg` via `ConfigFile`; and `editorsettings_get_set` reads an `EditorSettings` value, or writes it when a `value` is supplied. Two testing tools round out the family: `test_detect` reports an installed GUT / GdUnit4 framework (or `none`), and `test_list` enumerates `test_*.gd` / `*_test.gd` scripts under a directory. Every mutator that touches `ProjectSettings` or the editor config is **confirmation-gated** (the `project_set_setting` model, not the scene `EditorUndoRedoManager` history) and takes an optional `save` flag to persist to `project.godot`; the read-only `inputmap_list` / `project_list_settings` / `test_detect` / `test_list` are ungated. `test_run` and `test_result` are intentionally **deferred** — actually executing a framework's suite is async and non-deterministic under a headless CI editor and awaits a framework-bearing fixture project + a maintainer semantics decision (the same posture as `navmesh_bake` / `scene_set_root`). The `ProjectSettings` input/autoload/main-scene round-trips, `ConfigFile` export-preset write, and `EditorSettings` get/set were probed live on Godot 4.7.

### `inputmap_add_action` ✔ ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name"], "properties": { "name": { "type": "string" }, "deadzone": { "type": "number" }, "save": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["action", "deadzone", "saved"], "properties": { "action": { "type": "string" }, "deadzone": { "type": "number" }, "saved": { "type": "boolean" } } }
```

### `inputmap_add_event` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name", "event"], "properties": { "name": { "type": "string" }, "event": { "type": "object", "required": ["type"], "properties": { "type": { "type": "string", "enum": ["key", "mouse_button", "joy_button", "joy_motion"] }, "keycode": { "type": ["string", "number"] }, "physical_keycode": { "type": ["string", "number"] }, "button_index": { "type": "number" }, "axis": { "type": "number" }, "axis_value": { "type": "number" } } }, "save": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["action", "event_count", "event_class", "saved"], "properties": { "action": { "type": "string" }, "event_count": { "type": "number" }, "event_class": { "type": "string" }, "saved": { "type": "boolean" } } }
```

### `inputmap_list` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["count", "actions"], "properties": { "count": { "type": "number" }, "actions": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "deadzone": { "type": "number" }, "events": { "type": "array", "items": { "type": "object", "properties": { "class": { "type": "string" }, "text": { "type": "string" } } } } } } } } }
```

### `inputmap_erase_action` ✔ ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name"], "properties": { "name": { "type": "string" }, "save": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["erased", "action", "saved"], "properties": { "erased": { "type": "boolean" }, "action": { "type": "string" }, "saved": { "type": "boolean" } } }
```

### `project_add_autoload` ✔ ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name", "path"], "properties": { "name": { "type": "string" }, "path": { "type": "string" }, "enabled": { "type": "boolean" }, "save": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["autoload", "path", "enabled", "saved"], "properties": { "autoload": { "type": "string" }, "path": { "type": "string" }, "enabled": { "type": "boolean" }, "saved": { "type": "boolean" } } }
```

### `project_remove_autoload` ✔ ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name"], "properties": { "name": { "type": "string" }, "save": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["removed", "autoload", "saved"], "properties": { "removed": { "type": "boolean" }, "autoload": { "type": "string" }, "saved": { "type": "boolean" } } }
```

### `project_add_export_preset` ✅ · writes a file
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name", "platform"], "properties": { "name": { "type": "string" }, "platform": { "type": "string" }, "runnable": { "type": "boolean" }, "export_path": { "type": "string" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["preset", "platform", "index", "path"], "properties": { "preset": { "type": "string" }, "platform": { "type": "string" }, "index": { "type": "number" }, "path": { "type": "string" } } }
```

### `project_set_main_scene` ✔ ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "save": { "type": "boolean" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["main_scene", "saved"], "properties": { "main_scene": { "type": "string" }, "saved": { "type": "boolean" } } }
```

### `project_list_settings` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": { "prefix": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["prefix", "count", "settings"], "properties": { "prefix": { "type": "string" }, "count": { "type": "number" }, "settings": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "value": {} } } } } }
```

### `editorsettings_get_set` ✔ ✅ · on set
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name"], "properties": { "name": { "type": "string" }, "value": {}, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["name", "value", "mode"], "properties": { "name": { "type": "string" }, "value": {}, "mode": { "type": "string" } } }
```

### `test_detect` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["framework", "path", "version"], "properties": { "framework": { "type": "string" }, "path": { "type": "string" }, "version": { "type": "string" } } }
```

### `test_list` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "properties": { "dir": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["dir", "count", "tests"], "properties": { "dir": { "type": "string" }, "count": { "type": "number" }, "tests": { "type": "array", "items": { "type": "string" } } } }
```

---

# Plane D — Semantic (LSP)  (✅ implemented — Phase 2; raw TCP + LSP `Content-Length` framing to Godot's GDScript language server, default `127.0.0.1:6005`)

### `gd_completion` ✅
Returns a capped list — see `max_results` — and sets `truncated` when the language server offered more. **Completion is the one language-server verb whose result size is a function of PROJECT scope rather than of the cursor**: at most positions it is every global class, every autoload and every in-scope built-in, and a single call has been measured returning more bytes than the whole tool catalogue does. `gd_hover` and `gd_definition` are bounded by the thing under the cursor and are not capped.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "line", "character"],
  "properties": {
    "path": { "type": "string", "pattern": "^res://" },
    "line": { "type": "integer", "minimum": 0 },
    "character": { "type": "integer", "minimum": 0 },
    "max_results": { "type": "integer", "minimum": 1, "default": 200 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["items", "truncated"],
  "properties": { "items": { "type": "array", "items": {
    "type": "object", "properties": {
      "label": { "type": "string" }, "kind": { "type": "string" },
      "detail": { "type": "string" }, "insertText": { "type": "string" }
    } } },
    "truncated": { "type": "boolean" } } }
```

### `gd_hover` ✅
- **Input** same `{ path, line, character }` as `gd_completion`.
- **Output**
```json
{ "type": "object", "properties": { "contents": { "type": "string" }, "range": { "type": "object" } } }
```

### `gd_definition` ✅
- **Input** same `{ path, line, character }`.
- **Output**
```json
{ "type": "object", "required": ["locations"],
  "properties": { "locations": { "type": "array", "items": {
    "type": "object", "properties": {
      "uri": { "type": "string" }, "line": { "type": "integer" }, "character": { "type": "integer" } } } } } }
```

### `gd_references` ✅
- **Input** `{ path, line, character, include_declaration?: boolean }`.
- **Output** same `locations` array shape as `gd_definition`.

### `gd_rename` ✔ ✅ · edits multiple files
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "line", "character", "new_name"],
  "properties": {
    "path": { "type": "string" }, "line": { "type": "integer" },
    "character": { "type": "integer" }, "new_name": { "type": "string" },
    "apply": { "type": "boolean", "default": false, "description": "Write edits to disk (default false = dry run returning the planned edit)" },
    "confirm": { "type": "boolean", "description": "Auto-approve writing edits (skip the elicitation prompt); only relevant with apply=true" } } }
```
- **Output**
```json
{ "type": "object", "required": ["changed_files", "edit_count", "applied", "written"],
  "properties": {
    "changed_files": { "type": "array", "items": { "type": "string" } },
    "edit_count": { "type": "integer" },
    "applied": { "type": "boolean" },
    "written": { "type": "array", "items": { "type": "string" }, "description": "Absolute paths actually written (empty on a dry run)" } } }
```

`new_name` must be a **valid GDScript identifier** (`[A-Za-z_][A-Za-z0-9_]*`) and must not be a
reserved word. The language server does **not** validate it: measured on real 4.3 / 4.5 / 4.7, a
rename to `""`, `"1bad name!"`, `"func"` or a name containing a newline each came back with a full
project-wide edit plan and no error — and with `apply: true` those edits write a file GDScript
cannot parse. The refusal therefore happens host-side, **before** the rename is planned, and no
`textDocument/rename` request is sent. Engine class names (`Node`, `Vector2`) are shadowable and
remain legal.

`line` and `character` are **0-based and non-negative** on every `gd_*` tool that takes a position.
A negative value is rejected by the input schema; it used to reach the wire and come back as a
success with empty contents, indistinguishable from a real miss.

Every `gd_*` tool that takes a `path` **refuses one that resolves outside the Godot project root**
— including a `res://` path that walks out through `..` — and **refuses a path that does not exist**
or is not a regular file. The refusal names the resolved path and is reported as a host refusal, not
as an `LSP error [...]`, so the caller is not sent to debug a language server that was never asked.

A missing script used to be **opened as an empty document**: `readFileText` returns `""` for any read
failure, so the language server was told the file existed and was empty, and answered about that.
Measured on real 4.3 / 4.5 / 4.7, `gd_document_symbols` on a missing path returned a phantom
`{ "name": "<file>.gd", "kind": "class" }` and `gd_diagnostics` returned an `"(EMPTY_FILE): Empty
script file."` warning — both with `isError: false`. **A file that exists and is genuinely empty is
still served**; the guard is about absence, not size.

### `gd_document_symbols` ✅
- **Input**
```json
{ "type": "object", "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["symbols"], "properties": { "symbols": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "kind": { "type": "string" }, "line": { "type": "integer" } } } } } }
```

### `gd_workspace_symbols` ⚠️ · unsupported by Godot ≤ 4.7 (handled gracefully)
> **Engine limitation (found in live validation):** Godot 4.7's GDScript language server replies `-32601 Method not found` to `workspace/symbol` (confirmed in CI on both 4.3-stable and 4.7-stable: 4.3 advertises `workspaceSymbolProvider: true` yet still replies `-32601` to every query, and 4.7 honestly advertises it `false` and likewise replies `-32601` — exactly why the tool keeps a belt-and-suspenders `-32601` catch). The gap is in the engine, not the host — the input/output contract below is correct and the tool is retained for forward compatibility (it will start returning results on a Godot build that implements the method). **As of v0.4.5** the host feature-detects this: it checks the server's advertised `workspaceSymbolProvider` capability (and still catches a `-32601` from builds that advertise it but don't honour it), returning an explicit `isError` "unsupported by the connected Godot build — use gd_document_symbols instead" message rather than leaking a raw JSON-RPC error. On the success path (a future capable build) the `symbols` output shape below is unchanged.
- **Input**
```json
{ "type": "object", "required": ["query"], "properties": { "query": { "type": "string" } } }
```
- **Output** same `symbols` shape as `gd_document_symbols`, each with an added `uri`.

### `gd_diagnostics` ✅ (also exposed as a subscribable `diagnostics://` resource)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"],
  "properties": {
    "path": { "type": "string", "description": "Script path (res://..., absolute, or project-relative)" },
    "wait_ms": { "type": "integer", "minimum": 1, "default": 1500, "description": "Max time to wait for the server's first diagnostics publish" } } }
```
- **Output** (`uri` is top-level — the `file://` URI the server published under — not per-diagnostic)
```json
{ "type": "object", "required": ["uri", "diagnostics"],
  "properties": {
    "uri": { "type": "string" },
    "diagnostics": { "type": "array", "items": {
      "type": "object", "properties": {
        "severity": { "enum": ["error","warning","info","hint"] },
        "message": { "type": "string" }, "line": { "type": "integer" }, "character": { "type": "integer" } } } } } }
```

### `gd_signature_help` ✅
Call-signature hints (the parameter popup shown inside a call) at a position. Godot's GDScript language server advertises `signatureHelpProvider`; **confirmed returning signatures live in CI on 4.3-stable.**
- **Input** same `{ path, line, character }` as `gd_completion`.
- **Output**
```json
{ "type": "object", "required": ["signatures", "active_signature", "active_parameter"], "properties": { "signatures": { "type": "array", "items": { "type": "object", "properties": { "label": { "type": "string" }, "documentation": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "label": { "type": "string" }, "documentation": { "type": "string" } } } } } } }, "active_signature": { "type": "integer" }, "active_parameter": { "type": "integer" } } }
```

### `gd_code_action` ⚠️ · engine-dependent (handled)
List the code actions (quick fixes / refactors) the language server offers for a range — the lightbulb menu. Read-only: returns the available actions without applying any (`has_edit` flags those carrying a `WorkspaceEdit`; `command` names any attached command; both a CodeAction and a bare Command are normalized). **Engine-gated:** Godot's GDScript LSP advertises `codeActionProvider: false` on current builds (confirmed in CI on 4.3-stable) and replies `-32601`, so on those builds the tool feature-detects and returns a clear "unsupported" message (same contract as `gd_workspace_symbols`); it will return results unchanged on a build that implements code actions.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "start_line", "start_character"], "properties": { "path": { "type": "string" }, "start_line": { "type": "integer", "minimum": 0 }, "start_character": { "type": "integer", "minimum": 0 }, "end_line": { "type": "integer", "minimum": 0, "description": "default = start_line" }, "end_character": { "type": "integer", "minimum": 0, "description": "default = start_character" }, "only": { "type": "array", "items": { "type": "string" }, "description": "Restrict to these CodeActionKind prefixes, e.g. 'quickfix', 'refactor'" } } }
```
- **Output**
```json
{ "type": "object", "required": ["actions"], "properties": { "actions": { "type": "array", "items": { "type": "object", "properties": { "title": { "type": "string" }, "kind": { "type": "string" }, "has_edit": { "type": "boolean" }, "command": { "type": ["string", "null"] } } } } } }
```

### `gd_document_highlight` ✅ on Godot 4.7 · ⚠️ advertised `false` on Godot 4.3 (handled)
Highlight every occurrence of the symbol at a position **within the same file**, tagged read / write / text (the shading an editor shows for a variable's uses when the caret is on it). Read-only. **Live-verified in CI: Godot 4.7 advertises `documentHighlightProvider: true` and the tool returns results (3 highlights); on Godot 4.3-stable it advertises `documentHighlightProvider: false`,** so on 4.3 the tool returns "unsupported" there; it feature-detects the capability and keeps a `-32601` belt-and-suspenders, returning a clear "unsupported" message on a build that advertises but doesn't honour it (the D7 lesson).
- **Input** same `{ path, line, character }` as `gd_completion`.
- **Output**
```json
{ "type": "object", "required": ["highlights"], "properties": { "highlights": { "type": "array", "items": {
  "type": "object", "properties": {
    "line": { "type": "integer" }, "character": { "type": "integer" },
    "end_line": { "type": "integer" }, "end_character": { "type": "integer" },
    "kind": { "enum": ["text", "read", "write"] } } } } } }
```

### `gd_type_definition` ⚠️ · advertised `false` on Godot 4.3-stable (handled)
Resolve the location of the **type** of the symbol at a position (jump to the class of a typed variable), as opposed to the symbol's own definition. Godot 4.3-stable advertises `typeDefinitionProvider: false` (confirmed live in CI), so the tool returns "unsupported" there; feature-detected with a `-32601` fallback for a future build that implements it.
- **Input** same `{ path, line, character }` as `gd_completion`.
- **Output** same `locations` array shape as `gd_definition`.

### `gd_implementation` ⚠️ · advertised `false` on Godot 4.3-stable (handled)
Resolve the implementation location(s) of the symbol at a position (e.g. the concrete override of a method). Godot 4.3-stable advertises `implementationProvider: false` (confirmed live in CI), so the tool returns "unsupported" there; feature-detected with a `-32601` fallback for a future build that implements it.
- **Input** same `{ path, line, character }`.
- **Output** same `locations` array shape as `gd_definition`.

### `gd_declaration` ✅ confirmed live on Godot 4.3-stable · ⚠️ handled if a build advertises no `declarationProvider`
Resolve the declaration location(s) of the symbol at a position (coincides with the definition for most symbols; differs for forward-declared / re-exported names). Advertises `declarationProvider`; feature-detected with a `-32601` fallback. **Confirmed returning a location live in CI on 4.3-stable.**
- **Input** same `{ path, line, character }`.
- **Output** same `locations` array shape as `gd_definition`.

### `gd_folding_ranges` ⚠️ · advertised `false` on Godot 4.3-stable (handled)
List the foldable regions of a script (functions, blocks, comment/region markers) — the ranges an editor's fold gutter offers. Read-only. Godot 4.3-stable advertises `foldingRangeProvider: false` (confirmed live in CI), so the tool returns "unsupported" there; feature-detected with a `-32601` fallback for a future build that implements it.
- **Input**
```json
{ "type": "object", "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["ranges"], "properties": { "ranges": { "type": "array", "items": {
  "type": "object", "properties": {
    "start_line": { "type": "integer" }, "end_line": { "type": "integer" }, "kind": { "type": "string" } } } } } }
```

### `gd_document_link` ✅ confirmed live on Godot 4.3-stable · ⚠️ handled if a build advertises no `documentLinkProvider`
List the links embedded in a script (res:// paths or URLs the language server recognizes) with their source ranges and targets. Read-only. Advertises `documentLinkProvider`; feature-detected with a `-32601` fallback. **Confirmed implemented live in CI on 4.3-stable (empty list for a link-free file).**
- **Input**
```json
{ "type": "object", "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["links"], "properties": { "links": { "type": "array", "items": {
  "type": "object", "properties": {
    "line": { "type": "integer" }, "character": { "type": "integer" },
    "end_line": { "type": "integer" }, "end_character": { "type": "integer" },
    "target": { "type": "string" } } } } } }
```

### `gd_formatting` ⚠️ · advertised `false` on Godot 4.3-stable (handled)
Compute how the language server would reformat a whole script and return the formatted **text** — **without writing anything to disk** (read-only preview; apply it yourself with a file write). Godot 4.3-stable advertises `documentFormattingProvider: false` (confirmed live in CI; `documentRangeFormattingProvider` likewise), so the tool returns "unsupported" there; feature-detected with a `-32601` fallback for a future build that implements it.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": {
  "path": { "type": "string" },
  "tab_size": { "type": "integer", "minimum": 1, "default": 4 },
  "insert_spaces": { "type": "boolean", "default": false, "description": "Indent with spaces instead of tabs (Godot uses tabs)" } } }
```
- **Output**
```json
{ "type": "object", "required": ["edit_count", "formatted"], "properties": { "edit_count": { "type": "integer" }, "formatted": { "type": "string" } } }
```

### `gd_document_color` ⚠️ · advertised `false` on Godot 4.3-stable (handled)
List the color literals the language server recognizes in a script — the `Color(...)` values an editor draws an inline swatch for — with each one's source range, its RGBA components (floats 0..1) and a convenience `#RRGGBBAA` hex (Godot's `Color.to_html()` ordering). Read-only. Godot 4.3-stable lists `colorProvider` among its `initialize` capability keys but with the value **`false`** (confirmed live in CI: `D7_CAPS2 … color=false`, tool returns "unsupported"), so it joins `document-highlight`/`type-definition`/`implementation`/`folding-ranges`/`formatting` in the advertised-but-not-honoured group; the tool feature-detects and returns a clear "unsupported" message there, and keeps a `-32601` belt-and-suspenders for a future build that implements it (the D7 lesson: advertised ≠ implemented).
- **Input**
```json
{ "type": "object", "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["colors"], "properties": { "colors": { "type": "array", "items": {
  "type": "object", "properties": {
    "line": { "type": "integer" }, "character": { "type": "integer" },
    "end_line": { "type": "integer" }, "end_character": { "type": "integer" },
    "red": { "type": "number" }, "green": { "type": "number" }, "blue": { "type": "number" }, "alpha": { "type": "number" },
    "hex": { "type": "string" } } } } } }
```

### `gd_call_hierarchy` ⚠️ · engine-missing through Godot 4.7 (handled)
Find the callers (`direction: "incoming"`, the default) or callees (`direction: "outgoing"`) of the function at a position — resolved with `textDocument/prepareCallHierarchy`, then `callHierarchy/incomingCalls` / `outgoingCalls`. Each related function is returned with its `name`, `kind`, `uri`, position and `detail`, plus the call-site `ranges`. Read-only. Godot's GDScript language server does not advertise `callHierarchyProvider` (observed through 4.7), so the tool feature-detects and returns a clear "unsupported" message, keeping a `-32601` belt-and-suspenders for a future build that implements it.
- **Input**
```json
{ "type": "object", "required": ["path", "line", "character"], "properties": {
  "path": { "type": "string" },
  "line": { "type": "integer" },
  "character": { "type": "integer" },
  "direction": { "type": "string", "enum": ["incoming", "outgoing"], "default": "incoming" } } }
```
- **Output**
```json
{
  "type": "object",
  "required": ["direction", "items"],
  "properties": {
    "direction": { "type": "string" },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "kind": { "type": "string" },
          "uri": { "type": "string" },
          "line": { "type": "integer" },
          "character": { "type": "integer" },
          "detail": { "type": "string" },
          "calls": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "kind": { "type": "string" },
                "uri": { "type": "string" },
                "line": { "type": "integer" },
                "character": { "type": "integer" },
                "detail": { "type": "string" },
                "ranges": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "line": { "type": "integer" },
                      "character": { "type": "integer" },
                      "end_line": { "type": "integer" },
                      "end_character": { "type": "integer" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### `gd_semantic_tokens` ⚠️ · engine-missing through Godot 4.7 (handled)
Return the semantic-highlighting tokens for a whole script — each token's position, `length`, `type` (e.g. `function`, `variable`, `keyword`) and `modifiers` — decoded from the LSP packed-integer form (`textDocument/semanticTokens/full`) through the server's advertised legend. Read-only. Godot's GDScript language server does not advertise `semanticTokensProvider` (observed through 4.7), so the tool feature-detects and returns a clear "unsupported" message, keeping a `-32601` belt-and-suspenders for a future build that implements it.
- **Input**
```json
{ "type": "object", "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{
  "type": "object",
  "required": ["token_count", "tokens"],
  "properties": {
    "token_count": { "type": "integer" },
    "tokens": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "line": { "type": "integer" },
          "character": { "type": "integer" },
          "length": { "type": "integer" },
          "type": { "type": "string" },
          "modifiers": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

---

# Plane D — C# Semantic (OmniSharp LSP)  (✅ implemented — D4 C2; the C#/.NET mirror of the GDScript LSP plane. OmniSharp is spawned by the host over **stdio** (lazily, on the first `cs_*` call) and driven against a C# Godot project — e.g. the `example-csharp/` fixture — set via `GODOT_CSHARP_PROJECT`. The read-only `cs_*` tools mirror the read-only `gd_*` surface; the two mutators — `cs_rename` (elicitation-gated on `apply=true`) and the read-only `cs_code_action` listing — mirror the GDScript `gd_rename` / `gd_code_action`. Feature-detected the same way: a method the server never advertised, or a `-32601` from one that lied about it, degrades to a clear "unsupported" message rather than a hang.)

### `cs_completion` ✅
`gd_completion`'s twin, capped for the reason measured on that one: `max_results` bounds the list and `truncated` says when OmniSharp offered more.
- **Input** `{ path, line, character, max_results }` (path resolves against the C# project root; 0-based line/character; `max_results` carries the same default as `gd_completion`).
- **Output**
```json
{ "type": "object", "required": ["items", "truncated"], "properties": { "items": { "type": "array", "items": {
  "type": "object", "properties": {
    "label": { "type": "string" }, "kind": { "type": "string" },
    "detail": { "type": "string" }, "insertText": { "type": "string" } } } },
  "truncated": { "type": "boolean" } } }
```

### `cs_hover` ✅
- **Input** same `{ path, line, character }`.
- **Output**
```json
{ "type": "object", "required": ["contents"], "properties": { "contents": { "type": "string" } } }
```

### `cs_definition` ✅
- **Input** same `{ path, line, character }`.
- **Output** same `locations` array shape as `gd_definition` — `{ "locations": [{ "uri", "line", "character" }] }`.

### `cs_references` ✅
- **Input** `{ path, line, character, include_declaration?: boolean }`.
- **Output** same `locations` array shape as `cs_definition`.

### `cs_rename` ✔ ✅ · edits multiple files
Rename a C# symbol project-wide via OmniSharp `textDocument/rename`. Returns the planned edit by default (dry run); `apply=true` writes the edits to disk and is **elicitation-gated** (with a `confirm: true` override and a safe block on clients that can't prompt), exactly like `gd_rename`. OmniSharp returns the WorkspaceEdit as `documentChanges` (versioned `TextDocumentEdit[]`); the host normalizes that and the legacy `changes` map identically before applying.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "line", "character", "new_name"],
  "properties": {
    "path": { "type": "string" }, "line": { "type": "integer", "minimum": 0 },
    "character": { "type": "integer", "minimum": 0 }, "new_name": { "type": "string" },
    "apply": { "type": "boolean", "default": false, "description": "Write edits to disk (default false = dry run returning the planned edit)" },
    "confirm": { "type": "boolean", "description": "Auto-approve writing edits (skip the elicitation prompt); only relevant with apply=true" } } }
```
- **Output** same shape as `gd_rename`: `{ "changed_files": [string], "edit_count": integer, "applied": boolean, "written": [string] }` (`written` = absolute paths actually written, empty on a dry run).

`new_name` must be a **valid C# identifier** and must not be a reserved keyword. OmniSharp does
**not** validate it: measured against a real OmniSharp v1.39.15, a rename to `"1bad name!"`,
`"class"`, `"int"`, `"  "`, `"a\nb"` or `"my-name"` each came back with a full five-edit plan and
`isError: false` — and with `apply: true` those edits write C# that does not compile. The one string
OmniSharp itself rejects is `""`, and it rejects it with an internal assertion failure
(`Unexpected true - file Renamer.cs line 151`) rather than a usable validation error, so the host
refuses that too. The refusal happens **before** the rename is planned and no `textDocument/rename`
request is sent.

The check is deliberately narrow. **Contextual keywords** (`var`, `value`, `async`, `await`,
`yield`, `nameof`, `record`, `when`) are not reserved and stay legal; **framework type names**
(`Console`, `String`, `Task`) are shadowable and stay legal, the same call the GDScript plane makes
for engine classes; **Unicode identifiers** (`Ångström`) are valid C# and stay legal; and the
**verbatim `@` prefix** is accepted precisely because it is what legalizes a keyword — `@class` is a
valid identifier, so it skips the reserved-word check rather than being refused by it.

`line` and `character` are **0-based and non-negative** on every `cs_*` tool that takes a position.
A negative value is rejected by the input schema. Note the symptom here differed from the GDScript
plane: rather than a silent success, a negative position reached OmniSharp and came back as
`LSP error [-32603]: Internal Error - System.ArgumentOutOfRangeException` with a .NET stack trace in
the tool's answer, on `cs_hover`, `cs_definition`, `cs_references`, `cs_completion` and
`cs_signature_help` alike. The bound is one-sided by necessity — a line *past the end of the file*
produces the same `-32603`, and no input schema can know the file's length.

Every `cs_*` tool that takes a `path` **refuses one that resolves outside the C# project root** —
including a `res://` path that walks out through `..` — and **refuses a path that does not exist**
or is not a regular file. The refusal names the resolved path and is reported as a host refusal, not
as an `LSP error [...]`.

A missing C# script used to be **opened as an empty document**, the same `readFileText` shape the
GDScript plane had, and here it erased the distinction completely: measured live,
`cs_document_symbols` returned byte-identical `{"symbols": []}` with `isError: false` for a **missing
file**, for a file that **exists and is genuinely empty**, and for a **directory** — three different
states, one indistinguishable answer. **A file that exists and is genuinely empty is still served**;
the guard is about absence, not size.

### `cs_document_symbols` ✅
- **Input**
```json
{ "type": "object", "required": ["path"], "properties": { "path": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["symbols"], "properties": { "symbols": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "kind": { "type": "string" }, "line": { "type": "integer" } } } } } }
```

### `cs_workspace_symbols` ✅ · ⚠️ handled if the C# server advertises no `workspaceSymbolProvider`
Unlike Godot's GDScript server, OmniSharp implements LSP `workspace/symbol`, so this returns real project-wide results; it stays feature-detected (advertised `workspaceSymbolProvider` capability plus a `-32601` belt-and-suspenders) so a server lacking it degrades to an explicit "unsupported" message rather than a raw JSON-RPC error.
- **Input**
```json
{ "type": "object", "required": ["query"], "properties": { "query": { "type": "string" } } }
```
- **Output** same `symbols` shape as `cs_document_symbols`, each with an added `uri`.

### `cs_signature_help` ✅
- **Input** same `{ path, line, character }`.
- **Output**
```json
{ "type": "object", "required": ["signatures", "active_signature", "active_parameter"],
  "properties": {
    "signatures": { "type": "array", "items": { "type": "object", "properties": {
      "label": { "type": "string" }, "documentation": { "type": "string" },
      "parameters": { "type": "array", "items": { "type": "object", "properties": {
        "label": { "type": "string" }, "documentation": { "type": "string" } } } } } } },
    "active_signature": { "type": "integer" }, "active_parameter": { "type": "integer" } } }
```

### `cs_diagnostics` ✅
- **Input**
```json
{ "type": "object", "required": ["path"], "properties": { "path": { "type": "string" }, "wait_ms": { "type": "integer", "description": "Max time to wait for the first publish (default 2000; OmniSharp's first analysis can be slow)" } } }
```
- **Output**
```json
{ "type": "object", "required": ["uri", "diagnostics"],
  "properties": {
    "uri": { "type": "string" },
    "diagnostics": { "type": "array", "items": { "type": "object", "properties": {
      "severity": { "type": "string" }, "message": { "type": "string" },
      "line": { "type": "integer", "minimum": 0 }, "character": { "type": "integer", "minimum": 0 } } } } } }
```

### `cs_code_action` ✅ OmniSharp implements it · ⚠️ handled if a server advertises no `codeActionProvider`
List the code actions (quick fixes / refactors) OmniSharp offers for a range — the lightbulb menu. Read-only: returns the available actions without applying any (`has_edit` flags those carrying a `WorkspaceEdit`; `command` names any attached command; both a CodeAction and a bare Command are normalized). Unlike Godot's GDScript server (which advertises `codeActionProvider: false`), OmniSharp implements code actions, so this returns real results; still feature-detected with a `-32601` belt-and-suspenders. `end_line`/`end_character` default to the start position (a caret, not a selection).
- **Input** same shape as `gd_code_action`: `{ path, start_line, start_character, end_line?, end_character?, only?: string[] }`.
- **Output** same `actions` shape as `gd_code_action`: `{ "actions": [{ "title", "kind", "has_edit", "command": string|null }] }`.

---

# Plane D — Debugging (DAP)  (✅ implemented — Phase 2; raw TCP + DAP `Content-Length` framing to Godot's debug adapter, default `127.0.0.1:6006`)

### `dbg_launch` ✅
🔴 **A scene that can never run is refused — the same shape as `dbg_set_breakpoints` below, one tool over.** `scene` is a path parameter that is not called `path`, so 1.40.0's sweep never reached it. Measured against a real 4.7 adapter by launching each spelling and reading the game's console back over the DAP `output` event: `res://../evil/x.tscn`, a bare `../`, `<root>_evil/x.tscn`, `/elsewhere/x.tscn` and `""` all answered `ok {"state":"running"}` and **nothing ran** — the four escapes left a live *sceneless* game whose `dbg_stack_trace` then returned `{"frames":[]}`, byte-identical to a healthy session, and `""` had no game process at all. **Nothing ever escaped the project root**; Godot does not run a scene from outside the project it launched. The defect was the answer, and it is now a refusal that names which guard fired — raised *before* the port check and before the transport, so it costs no adapter round trip. `dbg_restart` takes the same `scene` and is wired to the same guard.

🔴 **`uid://` stays legal, and that is measured rather than assumed.** `uid://<known>` ran the scene it names, so requiring a path on disk would have refused a working spelling. A `uid://` the project does **not** know is the one case still not caught: Godot silently runs the main scene instead, and resolving it needs the engine's UID map, which the host does not have. A real file inside the root that is not a scene (`res://player.gd`) also stays legal — nothing runs, but the session terminates, so it announces itself.

🔴 **A launch the adapter itself rejects is an error, not a session.** Godot answers `wrong_path` to the `launch` request when `project` is not the project the editor has open — trivially reachable, e.g. on macOS where `/tmp` realpaths to `/private/tmp` — and that rejection used to be swallowed: the tool answered `isError:false state:"running"` for a session that never started, **and the unhandled rejection terminated the MCP server process**. Both are fixed; the refusal quotes the adapter's own message.

🔴 **`stop_on_entry` says which it is.** Godot's adapter does not implement `stopOnEntry` — the game runs to completion — so the result carries `stop_on_entry_honored: false` plus a `warning` naming the remedy (set a breakpoint before launching), instead of a bare `running` that reads exactly like a stop that has not landed *yet*. An adapter that does honour it reports `true` and no warning.

**Refuses when the runtime bridge port is already bound** — the launched game's autoload could not `listen()`, so `runtime_*` would keep addressing whichever process already holds the port. The refusal lists every remedy with the condition it applies under (`godot_stop` for a managed child, `dbg_attach` if the holder is already under the debugger, otherwise quit it) because the probe learns only *that* the port is held, never by what. Or override with `allow_port_conflict`: a DAP session is addressed by session rather than by port, so breakpoints and stepping are unaffected either way — only `runtime_*` is. `dbg_attach` and `dbg_restart` are deliberately **not** gated (attach is the remedy; restart's own game still holds the port at check time, so a probe there would false-positive every time).
- **Input**
```json
{ "type": "object", "properties": { "scene": { "type": "string", "description": "'main' (default), 'current', a res:// or absolute scene inside the project, or a uid:// reference" }, "stop_on_entry": { "type": "boolean", "default": false }, "allow_port_conflict": { "type": "boolean", "default": false, "description": "launch even though the runtime bridge port is bound; dbg_* still works, runtime_* would address the other process" } } }
```
- **Output**
```json
{ "type": "object", "required": ["session_id", "state", "scene", "initialized_seen"], "properties": { "session_id": { "type": "string" }, "state": { "type": "string" }, "scene": { "type": "string" }, "initialized_seen": { "type": "boolean", "description": "whether the adapter emitted its initialized event before breakpoints were applied; false means the handshake ran out of the order DAP specifies" }, "stop_on_entry_honored": { "type": "boolean", "description": "present only when stop_on_entry was requested: whether an entry stop actually landed" }, "unsupported_modifiers": { "type": "array", "items": { "type": "string" }, "description": "breakpoint modifiers dropped when this handshake applied the buffered breakpoints" }, "warning": { "type": "string", "description": "present when stop_on_entry was requested and the adapter ignored it, and/or when buffered modifiers were dropped" } } }
```
🔴 **It reports what the handshake dropped.** Breakpoint modifiers buffered before a session cannot be feature-detected until the adapter advertises its capabilities, so `dbg_set_breakpoints` can only say `modifier_detection: "deferred"`. This is where the caller learns the outcome — see `dbg_set_breakpoints` below.

### `dbg_attach` ✅
Attach to an already-running Godot debug session. 🔴 **An attach the adapter rejects is refused** — Godot answers `not_running` when nothing is running, the most ordinary caller mistake there is; it previously answered `isError:false state:"running"` and took the server process down with an unhandled rejection.
- **Input**
```json
{ "type": "object", "properties": { "address": { "type": "string", "default": "127.0.0.1" }, "port": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["session_id", "state", "initialized_seen"], "properties": { "session_id": { "type": "string" }, "state": { "type": "string" }, "initialized_seen": { "type": "boolean", "description": "whether the adapter emitted its initialized event before breakpoints were applied; false means the handshake ran out of the order DAP specifies" }, "unsupported_modifiers": { "type": "array", "items": { "type": "string" }, "description": "breakpoint modifiers dropped when this handshake applied the buffered breakpoints" }, "warning": { "type": "string" } } }
```

### `dbg_set_breakpoints` ✅
🔴 **A source that can never bind is refused, and the refusal names which guard fired.** A missing script, a **directory**, and `""` — which resolves to the project root — each previously answered `{"buffered":true,"breakpoints":[]}` with `isError:false`, so a caller could not tell an armed breakpoint from one that can never bind.

🔴 **The escape check is deliberately WIDER than the `cs_dbg_*` plane's, and the difference is the point.** `cs_dbg_launch` documents overriding `program` to debug a *different* .NET program, whose sources legitimately live outside the Godot project, so there an absolute path elsewhere stays legal. `dbg_launch` has no such mainline — its `scene` is `'main'`, `'current'` or a `res://` path, and Godot binds breakpoints only to scripts in the project it runs. So **all three spellings** (`res://`, relative and absolute) are anchored to the project root here; an absolute path *inside* the project stays legal. The comparison is against `root + path.sep`, so a sibling directory merely sharing the root's name prefix cannot pass.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "lines"],
  "properties": {
    "path": { "type": "string" },
    "lines": { "type": "array", "items": { "type": "integer", "minimum": 1 } },
    "conditions": { "type": "array", "items": { "type": ["string", "null"] } },
    "hit_conditions": { "type": "array", "items": { "type": ["string", "null"] }, "description": "Per-line hit expressions aligned to lines, e.g. '>3' or '%5'" },
    "log_messages": { "type": "array", "items": { "type": ["string", "null"] }, "description": "Per-line log messages aligned to lines; makes that breakpoint a logpoint (logs, never halts)" } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "buffered", "breakpoints"], "properties": { "path": { "type": "string" }, "buffered": { "type": "boolean" }, "breakpoints": { "type": "array", "items": { "type": "object", "properties": { "line": { "type": "integer" }, "verified": { "type": "boolean" } } } }, "unsupported_modifiers": { "type": "array", "items": { "type": "string" } }, "modifier_detection": { "type": "string" }, "warning": { "type": "string" } } }
```
- **Feature-detect:** `conditions` / `hit_conditions` / `log_messages` are sent only when the connected adapter advertises `supportsConditionalBreakpoints` / `supportsHitConditionalBreakpoints` / `supportsLogPoints`. Godot advertises all three **false** and ignores them — a conditional breakpoint would halt unconditionally — so there they are dropped and the result carries `unsupported_modifiers` + a `warning`.
- **Buffered modifiers are detected too, and this is where a real defect was.** Detection happens when the breakpoints are **applied**, not when they are set. An adapter advertises nothing until `initialize` answers, so a breakpoint buffered *before* a session — the ordinary way to arm one — could not be feature-detected at set time and previously had its modifiers forwarded verbatim, silently: measured live, a pre-launch `conditions: ["counter < 0"]` (always false) produced no warning and the breakpoint halted on the first frame anyway. Now a buffered modifier returns `modifier_detection: "deferred"` plus a warning, and the `dbg_launch` / `dbg_attach` that applies it reports the `unsupported_modifiers` actually dropped.

### `dbg_continue` / `dbg_step` ✅
- **Input (`dbg_step`)** `{ "type": "object", "required": ["kind"], "properties": { "kind": { "enum": ["in", "over", "out"] } } }`
- **Input (`dbg_continue`)** `{ "type": "object", "properties": {} }`
- **Output**
```json
{ "type": "object", "required": ["state"], "properties": { "state": { "enum": ["running", "stopped", "terminated"] }, "stopped_reason": { "type": ["string", "null"] } } }
```

### `dbg_stack_trace` ✅
- **Input**
```json
{ "type": "object", "properties": { "levels": { "type": "integer", "minimum": 1, "default": 20, "description": "Max frames" } } }
```
- **Output**
```json
{ "type": "object", "required": ["frames"], "properties": { "frames": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "integer" }, "name": { "type": "string" }, "source": { "type": "string" }, "line": { "type": "integer" } } } } } }
```

### `dbg_scopes` ✅
- **Input**
```json
{ "type": "object", "required": ["frame_id"], "properties": { "frame_id": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["scopes"], "properties": { "scopes": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "variables_ref": { "type": "integer" } } } } } }
```

### `dbg_variables` ✅
- **Input**
```json
{ "type": "object", "required": ["variables_ref"], "properties": { "variables_ref": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["variables"], "properties": { "variables": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "value": { "type": "string" }, "type": { "type": "string" }, "variables_ref": { "type": "integer" } } } } } }
```

### `dbg_evaluate` ✔ ✅ · arbitrary code execution — gate hard
Evaluate an expression in the current stopped frame (DAP `evaluate`, repl context). **Live-verified in CI:** Godot 4.3 does bare-name lookup only (a compound expression like `counter + 1` returns empty), while **Godot 4.7 performs full expression evaluation** (`counter + 1` → `101`). The request is bounded by `GODOT_DAP_EVALUATE_TIMEOUT_MS` (~8 s) so a non-answering adapter fails fast rather than hanging the full DAP timeout.
- **Input**
```json
{ "type": "object", "required": ["expression"], "properties": { "expression": { "type": "string" }, "frame_id": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["result"], "properties": { "result": { "type": "string" }, "type": { "type": "string" }, "variables_ref": { "type": "integer" } } }
```

### `dbg_watch` ✅
Manage a persistent set of watch expressions and re-evaluate them in the current stopped frame. Evaluated in DAP `watch` context (side-effect-free), so it is **not** gated. **The set is managed whether or not the program is stopped** — arming a watch before the first stop is the documented workflow — but values arrive only at a stop: while the program runs, each entry comes back with an empty `value` and an `error` naming the state that was read, at no round-trip cost. (It previously reported the adapter's hex failure code as the per-expression reason.) 🔴 **The one reader on this plane that a running program does not refuse, and that is deliberate rather than an omission.** Every other `dbg_*` reader now raises `not_stopped` when the session is live but the program is not halted — measured, they used to answer `{"frames":[]}`, `{"scopes":[]}`, or a fabricated `error:"timeout"` after five seconds. `dbg_watch` is two tools in one: it MANAGES the set and it evaluates it, and USER_GUIDE §10 B's documented use is to arm a watch before the first stop. So the set change is applied and each entry reports `not stopped` as its own reason instead of a value it does not have — at the cost of no adapter round trip.
- **Input**
```json
{ "type": "object",
  "properties": {
    "add": { "type": "array", "items": { "type": "string" }, "description": "Expressions to add to the watch set" },
    "remove": { "type": "array", "items": { "type": "string" }, "description": "Expressions to remove" },
    "clear": { "type": "boolean", "description": "Clear all watches before applying add" },
    "frame_id": { "type": "integer", "description": "Frame id from dbg_stack_trace; omit for the top frame" } } }
```
- **Output**
```json
{ "type": "object", "required": ["watches"], "properties": { "watches": { "type": "array", "items": { "type": "object", "required": ["expression", "value", "type", "error"], "properties": { "expression": { "type": "string" }, "value": { "type": "string" }, "type": { "type": "string" }, "error": { "type": ["string", "null"] } } } } } }
```

### `dbg_set_exception_breakpoints` ⚠️ · Godot 4.3 advertises no exception filters (handled)
Enable (replace) the debugger's exception breakpoint filters so execution halts when a matching error is thrown (DAP `setExceptionBreakpoints`). Pass filter IDs to enable; call with no filters (or `[]`) to clear. The result echoes the active `filters` and reports `available_filters` — the exception filters the connected adapter advertises. Requires a running session; **not** gated (it only configures the debugger). Feature-detected: on an adapter that advertises no `exceptionBreakpointFilters` (e.g. Godot 4.3, which also does not answer the request — it would otherwise time out) it returns a clear "unsupported" message **without sending anything**.
- **Input**
```json
{ "type": "object", "properties": { "filters": { "type": "array", "items": { "type": "string" }, "description": "Exception filter IDs to enable (default none = clear); choose from available_filters" } } }
```
- **Output**
```json
{ "type": "object", "required": ["filters", "available_filters", "breakpoints"], "properties": { "filters": { "type": "array", "items": { "type": "string" } }, "available_filters": { "type": "array", "items": { "type": "object", "properties": { "filter": { "type": "string" }, "label": { "type": "string" } } } }, "breakpoints": { "type": "array", "items": { "type": "object", "properties": { "verified": { "type": "boolean" } } } } } }
```

### `dbg_set_variable` ✔ ✅ · mutates live program state — gate hard · ⚠️ handled on an adapter advertising no `supportsSetVariable`
🔴 **It does not work on any current Godot build, and the tool now says which side that is.** The GDScript adapter advertises `supportsSetVariable` and never answers the request — measured unanswered on 4.3 and, at a REAL stop, on **4.7**. The shipped message read *"this Godot build (e.g. 4.3) does not implement setVariable"*, written when 4.3 was the build in hand, so the only sentence this tool has ever emitted told a current-build reader they were behind. It names the adapter now: there is nothing for the reader to upgrade to.
Change a variable's value in a stopped frame (DAP `setVariable`). `variables_ref` is the container's `variablesReference` (from `dbg_scopes`, or a complex `dbg_variables` entry), `name` is the variable within it, `value` is a GDScript literal/expression. Feature-detected: on an adapter that advertises `supportsSetVariable: false` it returns a clear "unsupported" message **without prompting**.
- **Input**
```json
{ "type": "object", "required": ["variables_ref", "name", "value"], "properties": { "variables_ref": { "type": "integer" }, "name": { "type": "string" }, "value": { "type": "string" }, "confirm": { "type": "boolean", "description": "Auto-approve this mutation (skip the elicitation prompt)" } } }
```
- **Output**
```json
{ "type": "object", "required": ["name", "value", "variables_ref"], "properties": { "name": { "type": "string" }, "value": { "type": "string" }, "type": { "type": "string" }, "variables_ref": { "type": "integer" } } }
```

### `dbg_restart` ✅
Restart the current debug session. Uses the DAP `restart` request when the adapter advertises `supportsRestartRequest`; otherwise falls back to `terminate` + a fresh launch/attach handshake, so it works on every adapter. Reuses the last `dbg_launch`/`dbg_attach` params; `scene` / `stop_on_entry` override them for a launched session. `method` reports which path ran (`restart` = native DAP restart, `relaunch` = terminate + fresh handshake). 🔴 **`scene` is held to `dbg_launch`'s rule — the second call site of the same parameter.** Measured unguarded, a restart onto `res://../evil/x.tscn` answered `ok {"method":"restart","state":"running"}` exactly like the launch did; guarding only `dbg_launch` would have left the plane guarded in name only. The scene is checked before the session check, so a typo'd scene is named rather than hidden behind "no debug session".
- **Input**
```json
{ "type": "object", "properties": { "scene": { "type": "string", "description": "Override scene for a launched session: 'main', 'current', res://scene.tscn, or uid://…" }, "stop_on_entry": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["session_id", "method", "state"], "properties": { "session_id": { "type": "string" }, "method": { "enum": ["restart", "relaunch"] }, "state": { "type": "string" }, "scene": { "type": ["string", "null"] } } }
```

### `dbg_goto` ✔ ⚠️ · moves execution — gate hard · no Godot build advertises `supportsGotoTargetsRequest` (handled)
Move the program counter within the current stopped frame — 'set next statement' (DAP `gotoTargets` + `goto`). Call with `path` + `line` to list the valid goto targets on that line; when the line has exactly one target (or you pass `target_id`) it jumps there. Feature-detected: on an adapter that does not advertise `supportsGotoTargetsRequest` it returns a clear "unsupported" message **without prompting**. Refuses a source that can never carry a target — a missing file, a directory, an empty path (which resolves to the project root), or a path resolving outside the Godot project root — the same guard `dbg_set_breakpoints` applies. Only meaningful while stopped at a breakpoint.

Until 1.40.0 this tool resolved `path` with a bare `toFsPath` and handed the result to the adapter as `source.path` with **no** containment or existence check — the one path-taking tool on this plane that was never wired to the guard. It was unreachable in practice (no Godot build advertises `supportsGotoTargetsRequest`, so the capability check returns first), but that is a capability rather than a boundary, and this is the destructive tool on the plane.
- **Input**
```json
{ "type": "object", "required": ["path", "line"], "properties": { "path": { "type": "string" }, "line": { "type": "integer", "minimum": 1 }, "target_id": { "type": "integer", "description": "A specific target id from a prior listing; omit to auto-pick when the line has a single target" }, "confirm": { "type": "boolean", "description": "Auto-approve the jump (skip the elicitation prompt)" } } }
```
- **Output**
```json
{ "type": "object", "required": ["targets", "jumped", "target_id"], "properties": { "targets": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "integer" }, "label": { "type": "string" }, "line": { "type": "integer" } } } }, "jumped": { "type": "boolean" }, "target_id": { "type": ["integer", "null"] } } }
```

### `dbg_data_breakpoints` ⚠️ · handled on an adapter advertising no `supportsDataBreakpoints`
Set (replace) data breakpoints — 'watchpoints' that halt when a variable's value changes (DAP `dataBreakpointInfo` + `setDataBreakpoints`). Each `watch` entry `{ name, variables_ref?, access_type? }` is resolved to a dataId, then every resolvable id is armed in one `setDataBreakpoints` call. Call with no `watch` (or `[]`) to clear all data breakpoints. The result reports the armed `breakpoints` (with `data_id` + `verified`) and any `unresolved` variables the adapter cannot watch. Requires a running session; **not** gated. Feature-detected on `supportsDataBreakpoints`.
- **Input**
```json
{ "type": "object", "properties": { "watch": { "type": "array", "items": { "type": "object", "required": ["name"], "properties": { "name": { "type": "string" }, "variables_ref": { "type": "integer" }, "access_type": { "enum": ["read", "write", "readWrite"] } } }, "description": "Variables to watch; omit or [] to clear all data breakpoints" } } }
```
- **Output**
```json
{ "type": "object", "required": ["breakpoints", "unresolved"], "properties": { "breakpoints": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "data_id": { "type": "string" }, "verified": { "type": "boolean" } } } }, "unresolved": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "reason": { "type": "string" } } } } } }
```

---

# Plane D — C# Debugging (netcoredbg DAP)  (✅ implemented — D4 C3; the C#/.NET mirror of the GDScript debugging plane. **netcoredbg** (Samsung, MIT) is spawned by the host over **stdio** (lazily, on the first `cs_dbg_*` call) and driven against a C# Godot game — launching it (`cs_dbg_launch`) or attaching to a running .NET process (`cs_dbg_attach`) — instead of Godot's built-in TCP debug adapter. Configured via `GODOT_CSDAP_CMD` (default `netcoredbg`), `GODOT_CSDAP_ARGS` (default `--interpreter=vscode`), `GODOT_CSHARP_BIN` (the program `cs_dbg_launch` launches by default) and `GODOT_CSHARP_PROJECT`. On top of read/inspect + a gated `cs_dbg_set_variable`, it carries the GDScript extras netcoredbg actually backs: `cs_dbg_watch`, `cs_dbg_set_exception_breakpoints` (netcoredbg advertises the `all` / `user-unhandled` filters) and `cs_dbg_restart` (terminate + relaunch, since netcoredbg advertises no `supportsRestartRequest`). `dbg_goto` / `dbg_data_breakpoints` are intentionally **not** mirrored here — netcoredbg advertises neither `supportsGotoTargetsRequest` nor `supportsDataBreakpoints`, so those tools would be dead surface. Adapter absent → the lazy stdio spawn fails with an actionable hint, never a hang. **Every reader on this plane refuses before the adapter round trip when there is no session, and again when the session is live but the program is not at a stop** — see the shared note under `cs_dbg_stack_trace`.)

### `cs_dbg_launch` ✅ · runs code
Launch a C# Godot game under netcoredbg. `program` defaults to the configured Mono/.NET Godot binary and `args` to `['--path', <C# project>]`; override either to debug a different .NET program. Buffered breakpoints are applied during the handshake. **Refuses when the runtime bridge port is already bound — but only when this looks like a Godot launch**, meaning the program's filename contains `godot` *or* the args carry Godot's `--path` project flag (the default args do). Pointing `program` and `args` at some other .NET program is never gated: it has no Breakpoint autoload and no interest in the runtime port, so refusing there would be a check firing when nothing is wrong. The first version of this gate tested `program === <configured default>`, which let an explicitly-named Mono binary — the documented way to point at one — through ungated.

**A launch the adapter REJECTED is reported as an error rather than as a running session.** Measured against a real netcoredbg 3.2.0-1092: `program: "/no/such/binary"` (and `""`) got `launch success=true` followed by `configurationDone success=false — "Failed command 'configurationDone' : 0x80070002"` (ERROR_FILE_NOT_FOUND). That response used to be swallowed immediately before an unconditional `state: "running"`, so the tool answered `isError:false` for a session that never existed and every later `cs_dbg_*` call failed with a bare hex code against a phantom session. The failure is only treated as fatal when the adapter **advertised** `supportsConfigurationDoneRequest` — one that never claimed the request may reject it while the session is alive.

**With `stop_on_entry` the call waits for the entry stop**, so it returns `state: "stopped"` with a usable thread. It used to return first: the tool said `running`, the thread id fell back to `1` while netcoredbg's is a large integer, and `cs_dbg_stack_trace` answered `0x80070057` — while the identical call 1.5 s later succeeded.
- **Input**
```json
{ "type": "object", "properties": { "program": { "type": "string" }, "args": { "type": "array", "items": { "type": "string" } }, "stop_on_entry": { "type": "boolean", "default": false }, "just_my_code": { "type": "boolean", "default": true }, "allow_port_conflict": { "type": "boolean", "default": false, "description": "launch the Godot binary even though the runtime bridge port is bound; ignored when debugging another program" } } }
```
- **Output**
```json
{ "type": "object", "required": ["session_id", "state", "initialized_seen"], "properties": { "session_id": { "type": "string" }, "state": { "type": "string" }, "initialized_seen": { "type": "boolean", "description": "whether the adapter emitted its initialized event before breakpoints were applied; false means the handshake ran out of the order DAP specifies" }, "warning": { "type": "string", "description": "present when the adapter never emitted initialized" } } }
```

### `cs_dbg_attach` ✅
Attach netcoredbg to an already-running .NET process (e.g. a C# Godot game launched separately) by its OS process id. **A pid nothing is running under is refused before the handshake** — `-1` and `0` are rejected by the schema, and a pid the kernel reports `ESRCH` for is refused by name; all three previously answered `isError:false state:"running"`. `EPERM` — a live process owned by another user — is a legitimate attach target and is **not** refused. Like `cs_dbg_launch`, an attach the adapter itself rejects is now an error rather than a running session.
- **Input**
```json
{ "type": "object", "required": ["process_id"], "properties": { "process_id": { "type": "integer", "minimum": 1 } } }
```
- **Output**
```json
{ "type": "object", "required": ["session_id", "state", "initialized_seen"], "properties": { "session_id": { "type": "string" }, "state": { "type": "string" }, "initialized_seen": { "type": "boolean", "description": "whether the adapter emitted its initialized event before breakpoints were applied; false means the handshake ran out of the order DAP specifies" }, "warning": { "type": "string", "description": "present when the adapter never emitted initialized" } } }
```

### `cs_dbg_set_breakpoints` ✅
Set (replace) the breakpoints for a C# source file. Applied immediately if a session is running, else buffered until launch/attach. Feature-detected: the per-line `conditions` modifier is only sent when the connected adapter advertises `supportsConditionalBreakpoints` (netcoredbg does); on an adapter that advertises it unsupported the modifier is dropped and the result carries `unsupported_modifiers` + a `warning`.

**A source that cannot carry a breakpoint is refused.** Measured: `res://NoSuchFile.cs`, `res://demo` (a **directory**) and `""` (which `path.join`s down to the **project root directory**) each returned `{"buffered":true,"breakpoints":[]}` with `isError:false` — byte-identical to a real file, so the caller could not tell an armed breakpoint from one that can never bind. A `res://` or relative path resolving **outside** the C# project root is refused too (compared against `root + path.sep`, never a bare `startsWith`, so a sibling directory sharing the root's name prefix does not pass).

🔴 **The escape check is deliberately narrower than the `cs_*` LSP plane's.** `cs_dbg_launch` documents overriding `program` to debug a **different .NET program**, whose sources legitimately live outside the Godot project — refusing every outside path would break that documented mainline. So `res://` and relative paths are project-anchored and refused on escape; an **absolute** path elsewhere is the caller explicitly naming a file outside, and stays legal.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "lines"], "properties": { "path": { "type": "string" }, "lines": { "type": "array", "items": { "type": "integer", "minimum": 1 } }, "conditions": { "type": "array", "items": { "type": ["string", "null"] } } } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "buffered", "breakpoints"], "properties": { "path": { "type": "string" }, "buffered": { "type": "boolean" }, "breakpoints": { "type": "array", "items": { "type": "object", "properties": { "line": { "type": "integer" }, "verified": { "type": "boolean" } } } }, "unsupported_modifiers": { "type": "array", "items": { "type": "string" } }, "warning": { "type": "string" } } }
```

### `cs_dbg_continue` / `cs_dbg_step` ✅
Resume execution and wait for the program to settle again (next breakpoint or termination). `cs_dbg_step` takes a `kind`; `cs_dbg_continue` takes no input.
- **Input (`cs_dbg_step`)** `{ "type": "object", "required": ["kind"], "properties": { "kind": { "enum": ["in", "over", "out"] } } }`
- **Input (`cs_dbg_continue`)** `{ "type": "object", "properties": {} }`
- **Output**
```json
{ "type": "object", "required": ["state"], "properties": { "state": { "enum": ["running", "stopped", "terminated"] }, "stopped_reason": { "type": ["string", "null"] } } }
```

### `cs_dbg_stack_trace` ✅
🔴 **The two guards every reader on this plane carries, and what they replace.** `cs_dbg_continue`, `cs_dbg_step`, `cs_dbg_stack_trace`, `cs_dbg_scopes`, `cs_dbg_variables`, `cs_dbg_evaluate` and `cs_dbg_set_variable` refuse — **before anything is sent to netcoredbg** — when no session has been opened, and again when a session is live but the program is still running. Measured against a real netcoredbg 3.2.0-1092 before the guards existed: with no session, seven of the readers answered with the adapter's raw hex (`Failed command 'stackTrace' : 0x80004005`, `0x80070057`) and only `cs_dbg_restart` refused; with the program merely running, the same, plus `cs_dbg_continue` waiting the full fifteen seconds to report `state: "running"`. A session existing is not a frame existing, and the refusal names the state it actually read. `cs_dbg_watch` and `cs_dbg_set_exception_breakpoints` are session-guarded but deliberately **not** stop-guarded — see their entries.

- **Input**
```json
{ "type": "object", "properties": { "levels": { "type": "integer", "minimum": 1, "default": 20 } } }
```
- **Output**
```json
{ "type": "object", "required": ["frames"], "properties": { "frames": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "integer" }, "name": { "type": "string" }, "source": { "type": "string" }, "line": { "type": "integer" } } } } } }
```

### `cs_dbg_scopes` ✅
- **Input**
```json
{ "type": "object", "required": ["frame_id"], "properties": { "frame_id": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["scopes"], "properties": { "scopes": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "variables_ref": { "type": "integer" } } } } } }
```

### `cs_dbg_variables` ✅
- **Input**
```json
{ "type": "object", "required": ["variables_ref"], "properties": { "variables_ref": { "type": "integer" } } }
```
- **Output**
```json
{ "type": "object", "required": ["variables"], "properties": { "variables": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "value": { "type": "string" }, "type": { "type": "string" }, "variables_ref": { "type": "integer" } } } } } }
```

### `cs_dbg_evaluate` ✔ ✅ · arbitrary code execution — gate hard
Evaluate a C# expression in the current stopped frame (DAP `evaluate`, repl context). Bounded by `GODOT_CSDAP_EVALUATE_TIMEOUT_MS` (~8 s) so a non-answering adapter fails fast rather than hanging the full DAP timeout.
- **Input**
```json
{ "type": "object", "required": ["expression"], "properties": { "expression": { "type": "string" }, "frame_id": { "type": "integer" }, "confirm": { "type": "boolean", "description": "Auto-approve this arbitrary-code evaluation (skip the elicitation prompt)" } } }
```
- **Output**
```json
{ "type": "object", "required": ["result"], "properties": { "result": { "type": "string" }, "type": { "type": "string" }, "variables_ref": { "type": "integer" } } }
```

### `cs_dbg_set_variable` ✔ ✅ · mutates live program state — gate hard · ⚠️ handled on an adapter advertising no `supportsSetVariable`
Change a variable's value in a stopped C# frame (DAP `setVariable`). `variables_ref` is the container's `variablesReference` (from `cs_dbg_scopes`, or a complex `cs_dbg_variables` entry), `name` is the variable within it, `value` is a C# literal/expression. Feature-detected: on an adapter that advertises `supportsSetVariable: false` it returns a clear "unsupported" message **without prompting**; otherwise a bounded deadline (`GODOT_CSDAP_SETVAR_TIMEOUT_MS`) turns a non-answering adapter into a clear message rather than a hang.
- **Input**
```json
{ "type": "object", "required": ["variables_ref", "name", "value"], "properties": { "variables_ref": { "type": "integer" }, "name": { "type": "string" }, "value": { "type": "string" }, "confirm": { "type": "boolean" } } }
```
- **Output**
```json
{ "type": "object", "required": ["name", "value", "variables_ref"], "properties": { "name": { "type": "string" }, "value": { "type": "string" }, "type": { "type": "string" }, "variables_ref": { "type": "integer" } } }
```

### `cs_dbg_watch` ✅
Manage a persistent set of C# watch expressions and re-evaluate them in the current stopped frame. Evaluated in DAP `watch` context (side-effect-free), so it is **not** gated. Results are only meaningful while stopped at a breakpoint. Each watch's `evaluate` is bounded by `GODOT_CSDAP_EVALUATE_TIMEOUT_MS` so a stalling expression fails fast on that entry.
- **Input**
```json
{ "type": "object",
  "properties": {
    "add": { "type": "array", "items": { "type": "string" }, "description": "Expressions to add to the watch set" },
    "remove": { "type": "array", "items": { "type": "string" }, "description": "Expressions to remove" },
    "clear": { "type": "boolean", "description": "Clear all watches before applying add" },
    "frame_id": { "type": "integer", "description": "Frame id from cs_dbg_stack_trace; omit for the top frame" } } }
```
- **Output**
```json
{ "type": "object", "required": ["watches"], "properties": { "watches": { "type": "array", "items": { "type": "object", "required": ["expression", "value", "type", "error"], "properties": { "expression": { "type": "string" }, "value": { "type": "string" }, "type": { "type": "string" }, "error": { "type": ["string", "null"] } } } } } }
```

### `cs_dbg_set_exception_breakpoints` ✅ · ⚠️ handled on an adapter advertising no exception filters
Enable (replace) the debugger's exception breakpoint filters so execution halts when a matching .NET exception is thrown (DAP `setExceptionBreakpoints`). Pass filter IDs to enable; call with no filters (or `[]`) to clear. The result echoes the active `filters` and reports `available_filters` — the exception filters the connected adapter advertises (**netcoredbg exposes `all` and `user-unhandled`**). Requires a session but **not** a stop — exception filters are armed for the future, so a live running program is a legitimate caller. **Not** gated (it only configures the debugger). Feature-detected: on an adapter that advertises no `exceptionBreakpointFilters` it returns a clear "unsupported" message **without sending anything** — but only once a session exists. With no session that read found a null `capabilities` and the tool told the caller their debugger advertises no exception filters, about an adapter it had never spoken to; it names the missing session instead. **A filter id the adapter never advertised is refused by name, listing the real ones** — the empty case was validated but membership was not, so an unknown id went to the wire and came back `Failed command 'setExceptionBreakpoints' : 0x80070057`: a hex code for a question the host already had `available_filters` to answer.
- **Input**
```json
{ "type": "object", "properties": { "filters": { "type": "array", "items": { "type": "string" }, "description": "Exception filter IDs to enable (default none = clear); choose from available_filters" } } }
```
- **Output**
```json
{ "type": "object", "required": ["filters", "available_filters", "breakpoints"], "properties": { "filters": { "type": "array", "items": { "type": "string" } }, "available_filters": { "type": "array", "items": { "type": "object", "properties": { "filter": { "type": "string" }, "label": { "type": "string" } } } }, "breakpoints": { "type": "array", "items": { "type": "object", "properties": { "verified": { "type": "boolean" } } } } } }
```

### `cs_dbg_restart` ✅
Restart the current C# debug session. Uses the DAP `restart` request when the adapter advertises `supportsRestartRequest`; otherwise falls back to `terminate` + a fresh launch/attach handshake, so it works on every adapter (**netcoredbg advertises none, so the relaunch path runs**). Reuses the last `cs_dbg_launch`/`cs_dbg_attach` params; `stop_on_entry` / `program` / `args` override them for a launched session. `method` reports which path ran (`restart` = native DAP restart, `relaunch` = terminate + fresh handshake). C# sessions have no scene, so there is no `scene` field.
- **Input**
```json
{ "type": "object", "properties": { "stop_on_entry": { "type": "boolean" }, "program": { "type": "string" }, "args": { "type": "array", "items": { "type": "string" } } } }
```
- **Output**
```json
{ "type": "object", "required": ["session_id", "method", "state"], "properties": { "session_id": { "type": "string" }, "method": { "enum": ["restart", "relaunch"] }, "state": { "type": "string" } } }
```

---

# Plane C — Runtime Bridge  (✅ implemented — Phase 3; in-game autoload `BreakpointRuntimeBridge` over loopback TCP :9081, same JSON protocol as the editor bridge)

### `runtime_get_tree` ✅
- **Input**
```json
{ "type": "object", "properties": { "max_depth": { "type": "integer", "default": 64 }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ name, type, path, child_count, visible?, children?, engine_log? }` — the recursive `SceneNode` shape `scene_get_tree` returns, over the LIVE tree, plus the engine-error echo (D1a).

### The engine-error echo (`engine_log`) — D1a

Every runtime tool whose reply is the bridge's verbatim result carries an optional
`engine_log` when — and only when — the engine emitted an **error** or **warning**
*during that call*. The bridge reads its log ring's sequence number either side of the
dispatch, so attribution is structural rather than a guess: everything appended in
between belongs to this call and nothing else does.

```json
{ "engine_log": { "entries": [ { "seq": 41, "level": "error", "message": "Invalid access to property or key 'hp' (player.gd:12)" } ],
                  "total": 1, "since_seq": 40 } }
```

- **`isError` is untouched.** A `push_error` during a call that returned what it was
  asked for is a diagnostic, not a failed call.
- **Absent, not empty.** Nothing to report means the field is not sent at all.
- **`entries` is capped at 20; `total` is not.** A caller reading twenty cannot otherwise
  tell twenty from two hundred.
- 🔴 **Godot 4.5+ for engine messages.** The zero-config capture registers a scriptable
  `Logger` via `OS.add_logger`, which does not exist before 4.5. On 4.3/4.4 the ring — and
  therefore the echo — carries only what game code routes through `push_log` itself, so a
  4.3 caller sees the field absent rather than wrong.
- The five runtime tools that do **not** carry it — `runtime_screenshot`,
  `runtime_await_condition`, `runtime_spawn_peers`, `runtime_peer_stop`,
  `runtime_peers_digest` — build their reply rather than forwarding one, so there is no
  single dispatch to attribute a log line to.

### `runtime_get_property` / `runtime_set_property` ✔ ✅
- **Input** identical to `node_get_property` / `node_set_property` (paths resolved against the live `SceneTree`), plus an optional `peer` string on `runtime_get_property` (a peer id from `runtime_spawn_peers`; omit for the default running game).
- **Output** `{ path, property, value, coerced?, requested?, engine_log? }` — the `node_set_property` shape plus the engine-error echo (D1a). Same read-back comparison: `set_ignored` and `set_mismatch` are errors, and `coerced` marks a write the engine landed and then changed.

### `runtime_call_method` ✔ ✅ · arbitrary invocation
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "method"],
  "properties": {
    "path": { "type": "string" }, "method": { "type": "string" },
    "args": { "type": "array", "items": { "$ref": "#/$defs/Variant" } },
    "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output**
```json
{ "type": "object", "required": ["return"], "properties": { "engine_log": { "type": "object", "description": "D1a: error/warning ring entries appended during THIS call" }, "return": { "$ref": "#/$defs/Variant" } } }
```

### `runtime_emit_signal` ✔ ✅
- **Input**
```json
{ "type": "object", "required": ["path", "signal"], "properties": { "path": { "type": "string" }, "signal": { "type": "string" }, "args": { "type": "array", "items": { "$ref": "#/$defs/Variant" } }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output**
```json
{ "type": "object", "properties": { "engine_log": { "type": "object", "description": "D1a: error/warning ring entries appended during THIS call" }, "emitted": { "type": "boolean" } } }
```
- Errors: `bad_path` (no node at `path`) / `no_signal` (the node declares no such signal — including an omitted `signal`, which arrives as `""`) / `emit_failed` (a **connected** callable could not be invoked; the message carries the engine's own code by name and number). `emit_failed` means the length of `args` does not match the arity of a connected callable: Godot pushes `Method expected N argument(s), but called with M` into the *game's* log and that callable never runs, so before this was checked the tool answered `{"emitted": true}` for an emission that never reached anyone.
- 🔴 **Two caveats on `emit_failed`, both measured on 4.3/4.5/4.7 and neither fixable here.** (1) **Arity only** — Godot does *not* type-check signal arguments, so an argument of the wrong type emits successfully and arrives as sent. (2) **Only when something is connected** — a signal with no connections returns `ERR_UNAVAILABLE`, which this tool reports as **success**, because emitting into the void is ordinary. A *wrong* argument count on an unconnected signal returns `ERR_UNAVAILABLE` too (there is no callable whose arity could mismatch), so it is indistinguishable from a correct emission and is **not** reported. Do not read `emitted: true` as "a handler ran".
- `args` entries are decoded through the `Variant` envelope, so `{"__type__":"Vector2","x":3,"y":4}` reaches the handler as a real `Vector2`.

### `runtime_inject_input` ✔ ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["event"],
  "properties": { "event": { "type": "object", "description": "InputEvent descriptor", "required": ["kind"],
    "properties": {
      "kind": { "enum": ["action", "key", "mouse_button", "mouse_motion"] },
      "action": { "type": "string", "description": "action name (kind=action)" },
      "strength": { "type": "number", "description": "action strength 0..1 (kind=action)" },
      "keycode": { "type": "integer", "description": "key code (kind=key)" },
      "button": { "type": "integer", "description": "mouse button index (kind=mouse_button)" },
      "pressed": { "type": "boolean" },
      "position": { "$ref": "#/$defs/Variant" },
      "relative": { "$ref": "#/$defs/Variant", "description": "relative motion (kind=mouse_motion)" } } }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output**
```json
{ "type": "object", "required": ["injected", "kind"], "properties": { "engine_log": { "type": "object", "description": "D1a: error/warning ring entries appended during THIS call" }, "injected": { "type": "boolean" }, "kind": { "type": "string" } } }
```
- Errors: `bad_action` (kind=action naming an action the project's InputMap does not define — including an omitted `action`) / `bad_kind` (an unrecognised or absent `kind`; unreachable through this tool, whose schema is an enum, but reachable by any client writing to the runtime socket directly). `kind=action` sets **InputMap state** and produces no `InputEvent`; the other three kinds go through `Input.parse_input_event` and are delivered as real events, so an action bound to the injected key **will** fire.

### `runtime_get_monitors` ✅
- **Input**
```json
{ "type": "object", "properties": { "keys": { "type": "array", "items": { "type": "string" }, "description": "e.g. time/fps, render/total_draw_calls_in_frame, audio/*" }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output**
```json
{ "type": "object", "required": ["monitors"], "properties": { "engine_log": { "type": "object", "description": "D1a: error/warning ring entries appended during THIS call" }, "monitors": { "type": "object", "additionalProperties": { "type": ["number", "null"] } }, "non_finite": { "type": "array", "items": { "type": "string" }, "description": "keys whose reading was non-finite and was normalised to null" } } }
```
- Allow-listed keys: `time/fps`, `time/process`, `time/physics_process`, `memory/static`, `object/count`, `object/node_count`, `object/resource_count`, `render/total_objects_drawn`, `render/total_draw_calls`, `render/video_mem_used`, `physics_3d/active_objects`, `physics_2d/active_objects`, `audio/output_latency`. Anything else is **skipped, not invented** — `runtime_assert_perf` reports it as `checked: 0` rather than as a passing comparison. `object/count` is the total live ObjectDB population, and the only one of the three object counters that can see a leaked non-Node.

### `runtime_screenshot` ✅ (returns MCP image content)
- **Input**
```json
{ "type": "object", "properties": { "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** same PNG bridge payload as `screenshot_editor`.

### `runtime_get_log` ✅ (also a subscribable `godot://runtime/log` resource)
- **Input**
```json
{ "type": "object", "properties": { "since_seq": { "type": "integer", "default": 0 }, "levels": { "type": "array", "items": { "enum": ["info", "warning", "error"] } }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output**
```json
{ "type": "object", "required": ["entries", "latest_seq"], "properties": { "engine_log": { "type": "object", "description": "D1a: error/warning ring entries appended during THIS call" }, "entries": { "type": "array", "items": { "type": "object", "properties": { "seq": { "type": "integer" }, "level": { "type": "string" }, "message": { "type": "string" } } } }, "latest_seq": { "type": "integer" }, "capture": { "type": "boolean" } } }
```
- **D6 zero-config capture (Godot 4.5+):** on 4.5 and newer the runtime bridge auto-registers a scriptable `Logger` (`OS.add_logger`) that funnels every `print()` / `push_warning` / `push_error` and engine message into this ring buffer — so the host reads the game's console with **no managed parent process**. Levels are `info` / `warning` / `error`. `capture` reports whether that hook is active; on Godot < 4.5 it is `false` and only explicit `BreakpointRuntimeBridge.push_log(...)` entries appear (unchanged behavior). Changes to the buffer push `godot://runtime/log` to subscribers (coalesced, one per frame).

### `runtime_assert_node_state` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "expect"], "properties": { "path": { "type": "string" }, "expect": { "type": "object", "description": "property name -> expected value (tagged-Variant JSON for complex types)" }, "tolerance": { "type": "number", "minimum": 0, "default": 0 }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ path, ok, checked, mismatches[], engine_log? }` — read-only. `ok` is true when every checked property matched (numeric fields within `tolerance`); each mismatch is `{ property, expected, actual }` with values in the tagged-Variant encoding.

### `runtime_assert_scene_structure` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["expect"], "properties": { "expect": { "type": "array", "items": { "type": "object", "required": ["path"], "properties": { "path": { "type": "string" }, "type": { "type": "string" }, "absent": { "type": "boolean" } } } }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ ok, checked, failures[], engine_log? }` — read-only. `ok` is true when every expectation held; each failure is `{ path, reason, expected?, actual? }` where `reason` is one of `missing` / `type_mismatch` / `expected_absent_but_present`.

### `runtime_assert_perf` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["baseline"], "properties": { "baseline": { "type": "object", "additionalProperties": { "type": "number" }, "description": "monitor key -> baseline value (captured earlier via runtime_get_monitors)" }, "tolerance": { "type": "number", "minimum": 0, "default": 0 }, "direction": { "type": "object", "additionalProperties": { "enum": ["higher_better", "lower_better"] } }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ ok, checked, regressions[], monitors, non_finite?, engine_log? }` — read-only. `ok` is true when every checked monitor met its baseline within `tolerance`; each regression is `{ key, baseline, current, direction }`, and `monitors` maps every checked key to its current value. Direction defaults to `time/fps` higher-better and every other monitor lower-better, overridable per key. The baseline is supplied **inline** (capture it earlier via `runtime_get_monitors`), so the tool stays stateless and read-only — no in-plugin baseline store, no file writes.

### `runtime_assert_screen_text` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["text"], "properties": { "text": { "type": "string" }, "present": { "type": "boolean", "default": true }, "regex": { "type": "boolean", "default": false }, "case_sensitive": { "type": "boolean", "default": false }, "min_count": { "type": "integer", "minimum": 1 }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ ok, matches, present, samples[], engine_log? }` — read-only. Scans visible `Control` text in the live scene tree (no OCR): a node counts as a match when it is `visible_in_tree()` and its `text` property contains `text` (substring by default, or a regular expression when `regex:true`; `case_sensitive` defaults false). `ok` is true when the text is present (`present:true`, default) or absent (`present:false`); if `min_count` is given, `ok` requires at least that many matches. `matches` is the total count; `samples` lists up to 20 matching `{ path, text }`. Sees text on `Label` / `RichTextLabel` / `Button` / `LineEdit` / `TextEdit` / `CheckBox` / `LinkButton` and similar; does **not** see text drawn directly to the canvas or baked into textures.

### `runtime_screenshot_diff` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["reference"], "properties": { "reference": { "type": "string", "description": "res:// or user:// path to the reference PNG" }, "tolerance": { "type": "number", "minimum": 0, "maximum": 1, "default": 0 }, "per_channel_threshold": { "type": "integer", "minimum": 0, "maximum": 255, "default": 0 }, "region": { "type": "object", "properties": { "x": { "type": "integer" }, "y": { "type": "integer" }, "w": { "type": "integer" }, "h": { "type": "integer" } } }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ ok, diff_ratio, differing_pixels, total_pixels, width, height, reference, reason?, engine_log? }` — read-only, **stats only**. Captures the current frame, loads `reference`, normalizes both to RGBA8, optionally crops both to `region`, then counts pixels whose per-channel delta exceeds `per_channel_threshold`. `diff_ratio` = differing / total; `ok` is true when `diff_ratio <= tolerance`. If the (post-crop) dimensions differ, returns `ok:false` with `reason:"dimension_mismatch"`. The diff is computed **engine-side** (`Image`), so the host stays dependency-free. Establish a reference by capturing `runtime_screenshot` and saving it as a project asset. **Future (gated):** an optional `write_diff` to save a highlighted diff image would be a file write — kept out of v1 to stay read-only.

### `runtime_await_condition` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "property", "value"],
  "properties": {
    "path": { "type": "string" },
    "property": { "type": "string" },
    "value": { "$ref": "#/$defs/Variant", "description": "value to compare against (tagged-Variant form for complex types)" },
    "op": { "enum": ["eq", "ne", "gt", "ge", "lt", "le"], "default": "eq" },
    "timeout_ms": { "type": "integer", "minimum": 1, "default": 5000 },
    "poll_interval_ms": { "type": "integer", "minimum": 1, "default": 100 },
    "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ met, polls, elapsed_ms, value }` — read-only. Polls `runtime_get_property` on `path`.`property` every `poll_interval_ms` until it satisfies `value` under `op` (`eq`/`ne` are structural; `gt`/`ge`/`lt`/`le` are numeric and false unless both sides are numbers), or `timeout_ms` elapses. `met` is true only if the condition held before timeout; `value` is the last-read value, `polls` the number of reads, `elapsed_ms` the wall-clock wait. Implemented host-side over the runtime bridge, so it works on every engine build the bridge supports; it never mutates the game, so it is **not** gated. Pair it with the `runtime_assert_*` family to wait for a state, then assert it.

### `runtime_anim_play` ✔ ✅ · drives the running game
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"],
  "properties": {
    "path": { "type": "string", "description": "an AnimationPlayer node in the running scene" },
    "animation": { "type": "string", "description": "animation name (default: the current/assigned one)" },
    "custom_speed": { "type": "number", "default": 1.0 },
    "from_end": { "type": "boolean", "default": false }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ playing, current_animation, speed_scale, engine_log? }` — plays `animation` (or the currently-assigned one when omitted) on the live `AnimationPlayer`. Errors `not_animation_player` when `path` is another class and `no_animation` when the name is unknown.

### `runtime_anim_stop` ✔ ✅ · drives the running game
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"],
  "properties": {
    "path": { "type": "string", "description": "an AnimationPlayer node in the running scene" },
    "keep_state": { "type": "boolean", "default": false, "description": "pause in place instead of stopping" }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ playing, current_animation, position, engine_log? }` — `keep_state:true` pauses in place (`AnimationPlayer.pause()`), otherwise stops (`stop()`). `pause()`/`stop()` with no arguments are used so the tool is stable across Godot 4.2–4.5.

### `runtime_anim_get_state` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string", "description": "an AnimationPlayer node in the running scene" }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ playing, current_animation, position, length, speed_scale, animations[], engine_log? }` — read-only snapshot of a live `AnimationPlayer`; `animations` lists the available animation names.

### `runtime_node_add` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent"],
  "properties": {
    "parent": { "type": "string", "description": "parent node in the running scene" },
    "type": { "type": "string", "description": "ClassDB class to instantiate (mutually exclusive with scene)" },
    "scene": { "type": "string", "description": "res:// PackedScene to instantiate (mutually exclusive with type)" },
    "name": { "type": "string" }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ added, path, name, type, coerced?, requested?, engine_log? }` — instantiates `scene` (a `PackedScene`) or `type` (a ClassDB class that `can_instantiate`), optionally renames it to `name`, and adds it under `parent`; `path` is the new node's live path. **`name` is new in 1.83.0 and so is the naming convention above** — this reply used to carry `path` and `type` only, so a node the engine renamed on a collision could not be seen to have been renamed at all. Errors: `bad_scene` / `bad_type` / `not_a_node` / `bad_args` (neither `scene` nor `type` given).

### `runtime_node_remove` ✔ ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "type": "string" }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ removed, path, engine_log? }` — `queue_free()`s the node. Refuses to remove the current scene root (`cannot_remove_root`).

### `runtime_time_scale` ✔ ✅ · alters the running game's clock
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["scale"], "properties": { "scale": { "type": "number", "minimum": 0, "description": "0 = freeze, 1 = normal, N = slow/fast" }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ previous, current, engine_log? }` — sets `Engine.time_scale` (negative clamped to 0) and reports the prior and new values. Freeze with `scale:0`, then `runtime_step_frames` to advance deterministically.

### `runtime_step_frames` ✔ ✅ · drives the running game
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["frames"], "properties": { "frames": { "type": "integer", "minimum": 1 }, "kind": { "enum": ["idle", "physics", "both"], "default": "idle" }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ frames_advanced, frame_index, engine_log? }` — advances the game by exactly `frames` frames while otherwise frozen, ticking the idle loop (default), the physics loop, or both each step. Dispatched on the runtime bridge's **async lane** (it awaits engine frame signals; the bridge stays responsive because its autoload is `PROCESS_MODE_ALWAYS`) and restores the caller's prior pause state when done. `frame_index` is `Engine.get_process_frames()` after stepping. Pair with `runtime_time_scale{scale:0}` to freeze, then assert.

### `runtime_state_digest` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["root"], "properties": { "root": { "type": "string" }, "fields": { "type": "array", "items": { "type": "string" } }, "max_depth": { "type": "integer", "minimum": 0, "default": 8 }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ digest, node_count, engine_log? }` — read-only. Walks the subtree at `root` (to `max_depth`, default 8) and emits `digest` as a stable-ordered map of node path → `{ field: value }`. Default fields are `position` / `global_position` / `rotation` / `scale` / `visible` / `modulate` (only those present on each node); pass `fields` to capture a specific set. Deterministic ordering makes it ideal for frame-by-frame comparison alongside `runtime_step_frames`.

### `runtime_seed_rng` ✔ ✅ · changes RNG state
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["seed"], "properties": { "seed": { "type": "integer" }, "peer": { "type": "string", "description": "peer id from runtime_spawn_peers; omit for the default running game" } } }
```
- **Output** `{ seed, engine_log? }` — seeds the running game's **global** RNG via GDScript `seed()` so a playtest is reproducible. Note: affects only the global RNG (`randi`/`randf`), not per-instance `RandomNumberGenerator`s or physics determinism.

### `runtime_spawn_peers` ✅ · higher-trust (`code-execution`, dropped by default)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["count"],
  "properties": {
    "count": { "type": "integer", "minimum": 1, "maximum": 4 },
    "scene": { "type": "string", "description": "res:// scene each peer runs (default: the project's main scene)" },
    "args": { "type": "array", "items": { "type": "string" }, "description": "extra command-line arguments passed to every peer" },
    "role": { "type": "string", "description": "label echoed back per peer and exported as BREAKPOINT_PEER_ROLE" },
    "timeout_ms": { "type": "integer", "minimum": 1, "default": 15000 } } }
```
- **Output**
```json
{ "type": "object", "required": ["peers", "count"],
  "properties": {
    "peers": { "type": "array", "items": { "type": "object", "required": ["id", "port", "pid", "role", "ready"],
      "properties": { "id": { "type": "string" }, "port": { "type": "integer" }, "pid": { "type": ["integer", "null"] },
                      "role": { "type": ["string", "null"] }, "ready": { "type": "boolean" } } } },
    "count": { "type": "integer" } } }
```
Spawns 1–4 **headless** Godot children of this project, each with `BREAKPOINT_RUNTIME_PORT` set to a free loopback port the host allocated, and **waits until every one answers on its bridge** before returning — a tool that returned early would hand the caller peers its next call cannot reach. The returned `id`s are what the `peer` argument on `runtime_seed_rng` / `runtime_time_scale` / `runtime_step_frames` / `runtime_get_property` / `runtime_call_method` / `runtime_await_condition` / `runtime_get_log` accepts. Each child also receives `BREAKPOINT_PEER_ID` and `BREAKPOINT_PEER_INDEX` (and `BREAKPOINT_PEER_ROLE` when `role` is given), readable in game code via `OS.get_environment()`.

Four live peers is a hard ceiling: four headless instances is already a heavy CI runner, the convergence cases that matter are covered at four, and every extra one multiplies the flake surface of the feature whose whole point is not flaking. The host mints the per-project auth secret **before** the first spawn, so every child takes the read path rather than racing the addon's unlocked mint. This is **local loopback testing** — it hosts no relay, lobby or signalling server. Requires the Breakpoint MCP addon enabled in the project (it registers the runtime autoload).

### `runtime_peer_stop` ✔ ✅ · terminates a child process
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": { "id": { "type": "string" }, "all": { "type": "boolean", "default": false } } }
```
- **Output** `{ stopped }` — the ids terminated. Pass `id`, or `all:true` for every peer this server spawned. Stopping an already-stopped peer is a no-op, so repeating the call is safe. Peers are also killed when the server shuts down, so they never outlive it.

### `runtime_peers_digest` ✅
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["root"],
  "properties": {
    "root": { "type": "string", "description": "root node path to digest in each peer (the same path on every peer)" },
    "peers": { "type": "array", "items": { "type": "string" }, "description": "peer ids to compare (default: every live peer; at least two required)" },
    "fields": { "type": "array", "items": { "type": "string" } },
    "max_depth": { "type": "integer", "minimum": 0, "default": 8 } } }
```
- **Output**
```json
{ "type": "object", "required": ["digests", "converged", "diverged_at"],
  "properties": {
    "digests": { "type": "array", "items": { "type": "object", "required": ["id", "digest", "node_count"],
      "properties": { "id": { "type": "string" }, "digest": { "type": "object" }, "node_count": { "type": "integer" } } } },
    "converged": { "type": "boolean" },
    "diverged_at": { "type": ["array", "null"], "items": { "type": "string" } } } }
```
Read-only. Takes `runtime_state_digest` on two or more peers over the same root and field set and reports whether they agree. `converged` is true when every peer's digest is byte-equal; otherwise `diverged_at` lists the node paths that disagree. Comparison sorts object keys at every level, so convergence is a property of the content rather than of key ordering. The sequence that actually converges, in this order: `runtime_spawn_peers` → `runtime_time_scale{scale:0}` on each (**freeze first**) → `runtime_set_property{peer}` to equalise the starting state → `runtime_seed_rng{seed}` on each → `runtime_step_frames{frames:K, kind:"physics"}` on each → this.

**Four preconditions, every one measured, and every one stated in the tool's own description rather than only here.** First, convergence is claimed for state advanced on the **fixed physics timestep** only: with `kind:"idle"` the per-frame `delta` is real elapsed wall-clock time in each process, so two peers given the identical seed draw identical random numbers and still diverge — measured across three seeds, physics byte-equal 3/3, idle divergent 3/3. Second, the global RNG stream must be consumed **only on the frames you step**: `runtime_seed_rng` seeds one stream shared by the whole project, and `time_scale 0` zeroes `delta` without stopping callbacks, so an unguarded draw burns that stream at wall-clock rate while frozen — guard draws on `delta > 0` and give idle-frame code its own `RandomNumberGenerator`. Third, peers free-run for different durations between spawn and freeze, so their state already differs before you begin: freeze first, then equalise with `runtime_set_property{peer}`. Fourth, this is a **same-machine** claim: peers share one OS and one engine build here, and nothing about that extends to convergence across machines.

---

---

## Group K — Knowledge & search

Read-only "where / what / how" tools. Four are **host-side** (Plane B — they read the project files directly, no editor or language server needed, so they answer even when nothing is running) and two are **ClassDB-backed** (Plane A — over the editor bridge). None mutate, so none are undoable or gated. `find_symbol` is the project-wide declaration index Godot's language server does not provide (`gd_workspace_symbols` returns *unsupported*); `find_usages` is the build-independent complement to the position-based `gd_references`. Markers `AUTH_K_*` in the authoring-plane probe.

### `project_search` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["query"],
  "properties": {
    "query": { "type": "string" },
    "regex": { "type": "boolean", "default": false },
    "ignore_case": { "type": "boolean", "default": false },
    "extensions": { "type": "array", "items": { "type": "string" } },
    "path": { "type": "string" },
    "max_results": { "type": "integer", "minimum": 1, "default": 200 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["query", "regex", "matches", "count", "truncated"],
  "properties": {
    "query": { "type": "string" },
    "regex": { "type": "boolean" },
    "matches": { "type": "array", "items": { "type": "object", "required": ["file", "line", "column", "text"],
      "properties": { "file": { "type": "string" }, "line": { "type": "integer" }, "column": { "type": "integer" }, "text": { "type": "string" } } } },
    "count": { "type": "integer" },
    "truncated": { "type": "boolean" }
  } }
```

### `find_symbol` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name"],
  "properties": {
    "name": { "type": "string" },
    "exact": { "type": "boolean", "default": false },
    "kinds": { "type": "array", "items": { "enum": ["class_name", "class", "func", "signal", "enum", "const", "var"] } },
    "max_results": { "type": "integer", "minimum": 1, "default": 200 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["name", "matches", "count", "truncated"],
  "properties": {
    "name": { "type": "string" },
    "matches": { "type": "array", "items": { "type": "object", "required": ["file", "line", "kind", "symbol", "text"],
      "properties": { "file": { "type": "string" }, "line": { "type": "integer" }, "kind": { "type": "string" }, "symbol": { "type": "string" }, "text": { "type": "string" } } } },
    "count": { "type": "integer" },
    "truncated": { "type": "boolean" }
  } }
```

### `find_usages` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name"],
  "properties": {
    "name": { "type": "string" },
    "extensions": { "type": "array", "items": { "type": "string" } },
    "ignore_case": { "type": "boolean", "default": false },
    "max_results": { "type": "integer", "minimum": 1, "default": 200 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["name", "usages", "count", "truncated"],
  "properties": {
    "name": { "type": "string" },
    "usages": { "type": "array", "items": { "type": "object", "required": ["file", "line", "column", "text"],
      "properties": { "file": { "type": "string" }, "line": { "type": "integer" }, "column": { "type": "integer" }, "text": { "type": "string" } } } },
    "count": { "type": "integer" },
    "truncated": { "type": "boolean" }
  } }
```

### `example_snippet` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "query": { "type": "string" },
    "limit": { "type": "integer", "minimum": 1, "default": 5 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["query", "count", "snippets", "available"],
  "properties": {
    "query": { "type": ["string", "null"] },
    "count": { "type": "integer" },
    "snippets": { "type": "array", "items": { "type": "object", "required": ["id", "title", "tags", "code", "explanation", "docs_url"],
      "properties": { "id": { "type": "string" }, "title": { "type": "string" }, "tags": { "type": "array", "items": { "type": "string" } },
        "code": { "type": "string" }, "explanation": { "type": "string" }, "docs_url": { "type": "string" } } } },
    "available": { "type": "array", "items": { "type": "string" } }
  } }
```

### `class_reference` ✅ (Plane A / Editor)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["class_name"],
  "properties": {
    "class_name": { "type": "string" },
    "include_inherited": { "type": "boolean", "default": false },
    "member": { "type": "string" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["class", "parent", "can_instantiate", "docs_url", "methods", "signals", "properties"],
  "properties": {
    "class": { "type": "string" },
    "parent": { "type": "string" },
    "can_instantiate": { "type": "boolean" },
    "docs_url": { "type": "string" },
    "methods": { "type": "array", "items": { "type": "object", "required": ["name", "return_type", "args"],
      "properties": { "name": { "type": "string" }, "return_type": { "type": "string" },
        "args": { "type": "array", "items": { "type": "object", "required": ["name", "type"],
          "properties": { "name": { "type": "string" }, "type": { "type": "string" } } } } } } },
    "signals": { "type": "array", "items": { "type": "object", "required": ["name", "args"],
      "properties": { "name": { "type": "string" },
        "args": { "type": "array", "items": { "type": "object", "required": ["name", "type"],
          "properties": { "name": { "type": "string" }, "type": { "type": "string" } } } } } } },
    "properties": { "type": "array", "items": { "type": "object", "required": ["name", "type", "class_name"],
      "properties": { "name": { "type": "string" }, "type": { "type": "string" }, "class_name": { "type": "string" } } } }
  } }
```

### `docs_search` ✅ (Plane A / Editor)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["query"],
  "properties": {
    "query": { "type": "string" },
    "kind": { "enum": ["any", "class", "method", "property", "signal"], "default": "any" },
    "class_name": { "type": "string" },
    "limit": { "type": "integer", "minimum": 1, "default": 40 },
    "deep": { "type": "boolean", "default": true }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["query", "count", "truncated", "results"],
  "properties": {
    "query": { "type": "string" },
    "count": { "type": "integer" },
    "truncated": { "type": "boolean" },
    "results": { "type": "array", "items": { "type": "object", "required": ["class", "member", "kind", "docs_url"],
      "properties": { "class": { "type": "string" }, "member": { "type": "string" }, "kind": { "type": "string" }, "docs_url": { "type": "string" } } } }
  } }
```

---

## Group L — Version control (git) (Plane B / host)

Git wrappers over the `git` binary, rooted at the configured project path (`git -C <projectPath>`, explicit argv, no shell). Host-side (Plane B): they need neither the editor nor a language server, so they answer whenever the project is a git work tree — the cloud-verifiable-end-to-end lane. `git` absent → a clear "not installed" result; path not a work tree → a clear "not a git repository" result; never a hang. Paths accept `res://…` or the same path without the scheme — **project-relative, always, in and out**; large patch/file output is head-truncated with a `truncated` flag. 🔴 **THIS SENTENCE USED TO SAY "or repo-relative", AND THAT WAS THE ONE SPELLING THAT DOES NOT WORK.** `git` is spawned with `-C <projectPath>`, so a pathspec resolves against the project: with the project at `<repo>/example`, `example/player.gd` reached git as `example/example/player.gd`. `vcs_blame`/`vcs_add`/`vcs_restore` refused that loudly; `vcs_log` and `vcs_diff` answered an **empty list**, which reads as *this file has no history* about a file that has one — measured on this repository's own `example/`. Both now refuse and name the root they resolved against, and `vcs_diff`/`vcs_show`/`vcs_restore` print project-relative paths so no reader in the family disagrees with another about the name of a file. Two tiers: **six read-only** tools (`vcs_status`/`log`/`diff`/`show`/`branch_list`/`blame`) that never touch the index or working tree, and **six Tier-A mutating** tools (`vcs_add`/`commit`/`restore`/`stash`/`branch_create`/`switch`) — safe local only, **no network** (push/pull/fetch stay Mac-side). Mutation posture: only ops that lose work or rewrite history are **elicitation-gated** — `vcs_restore`, `vcs_stash op=push` and `vcs_stash op=drop` reuse the `gate()` in `host/src/confirm.ts` (confirm:true bypasses, and a non-eliciting client is blocked, never run silently); the reversible ops (`add`/`commit`/`branch_create`/`switch`) and `vcs_stash op=pop`/`list` are ungated. `op=push` was ungated until it was measured reverting a whole working tree unattended: recoverable with `pop` is not the same as not done. Markers `AUTH_L_*` in the authoring-plane probe.

### `vcs_status` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "properties": {} }
```
- **Output**
```json
{ "type": "object", "required": ["branch", "oid", "upstream", "ahead", "behind", "staged", "unstaged", "untracked", "unmerged", "clean", "outside_project"],
  "properties": {
    "branch": { "type": ["string", "null"] },
    "oid": { "type": ["string", "null"] },
    "upstream": { "type": ["string", "null"] },
    "ahead": { "type": "integer" },
    "behind": { "type": "integer" },
    "staged": { "type": "array", "items": { "type": "object", "required": ["path", "status"], "properties": { "path": { "type": "string" }, "status": { "type": "string" } } } },
    "unstaged": { "type": "array", "items": { "type": "object", "required": ["path", "status"], "properties": { "path": { "type": "string" }, "status": { "type": "string" } } } },
    "untracked": { "type": "array", "items": { "type": "string" } },
    "unmerged": { "type": "array", "items": { "type": "string" } },
    "clean": { "type": "boolean" },
    "outside_project": { "type": "array", "items": { "type": "string" } }
  } }
```
The four file lists are **project-relative** — the `res://` spelling with the scheme dropped — which is what every `path`/`paths` argument in this family means, so status output feeds straight back in. `outside_project` carries changes elsewhere in the repository when the project is a subdirectory of it, **repo-root-relative and in its own field**: they used to arrive in the lists above spelled `../docs/notes.md`, a spelling no input here accepts, beside members that were project-relative. They are named rather than hidden because `vcs_add` with no paths still stages them and `vcs_commit` still commits them. `clean` describes the project's own four lists.

### `vcs_log` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "max_count": { "type": "integer", "minimum": 1, "maximum": 1000, "default": 20 },
    "path": { "type": "string" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["commits", "count"],
  "properties": {
    "commits": { "type": "array", "items": { "type": "object", "required": ["hash", "short", "author", "date", "subject"],
      "properties": { "hash": { "type": "string" }, "short": { "type": "string" }, "author": { "type": "string" }, "date": { "type": "string" }, "subject": { "type": "string" } } } },
    "count": { "type": "integer" }
  } }
```

### `vcs_diff` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "staged": { "type": "boolean", "default": false },
    "path": { "type": "string" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["staged", "path", "files", "patch", "truncated"],
  "properties": {
    "staged": { "type": "boolean" },
    "path": { "type": ["string", "null"] },
    "files": { "type": "array", "items": { "type": "string" } },
    "patch": { "type": "string" },
    "truncated": { "type": "boolean" }
  } }
```

### `vcs_show` ✅ (Plane B / host)
Two modes: with no `path`, returns commit metadata + patch; with a `path`, returns that file's content at `<ref>`. Only `ref` and `truncated` are always present; the other fields are populated per mode.
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "ref": { "type": "string", "default": "HEAD" },
    "path": { "type": "string" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["ref", "truncated"],
  "properties": {
    "ref": { "type": "string" },
    "hash": { "type": "string" },
    "short": { "type": "string" },
    "author": { "type": "string" },
    "date": { "type": "string" },
    "subject": { "type": "string" },
    "body": { "type": "string" },
    "patch": { "type": "string" },
    "path": { "type": "string" },
    "content": { "type": "string" },
    "truncated": { "type": "boolean" }
  } }
```

### `vcs_branch_list` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "remotes": { "type": "boolean", "default": false }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["current", "branches", "count", "detached"],
  "properties": {
    "current": { "type": ["string", "null"] },
    "branches": { "type": "array", "items": { "type": "object", "required": ["name", "short_sha", "current", "remote"],
      "properties": { "name": { "type": "string" }, "short_sha": { "type": "string" }, "current": { "type": "boolean" }, "remote": { "type": "boolean" } } } },
    "count": { "type": "integer" },
    "detached": { "type": "boolean" }
  } }
```
`current` is `null` on a detached HEAD (`detached: true`), matching `vcs_status`'s `branch`;
git's `(HEAD detached at <sha>)` pseudo-entry is never listed as a branch. `remote` is true
only for entries under `refs/remotes/`, which `remotes: true` adds.

### `vcs_blame` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path"],
  "properties": {
    "path": { "type": "string" },
    "start": { "type": "integer", "minimum": 1 },
    "end": { "type": "integer", "minimum": 1 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "lines", "count", "truncated"],
  "properties": {
    "path": { "type": "string" },
    "lines": { "type": "array", "items": { "type": "object", "required": ["line", "commit", "author", "date", "text"],
      "properties": { "line": { "type": "integer" }, "commit": { "type": "string" }, "author": { "type": "string" }, "date": { "type": "string" }, "text": { "type": "string" } } } },
    "count": { "type": "integer" },
    "truncated": { "type": "boolean" }
  } }
```

### `vcs_add` ✅ (Plane B / host) — mutating (ungated)
Stage changes for the next commit. Reversible (`git restore --staged`), so ungated.
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "paths": { "type": "array", "items": { "type": "string" }, "description": "Paths to stage; omit to stage all (-A)" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["staged", "count"],
  "properties": {
    "staged": { "type": "array", "items": { "type": "object", "required": ["path", "status"], "properties": { "path": { "type": "string" }, "status": { "type": "string" } } } },
    "count": { "type": "integer" }
  } }
```

### `vcs_commit` ✅ (Plane B / host) — mutating (ungated)
Commit the staged changes. Reversible (`git reset --soft HEAD~1`), loses nothing, so ungated. Commit signing is disabled for the call so it can never block on a passphrase prompt.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["message"],
  "properties": {
    "message": { "type": "string", "minLength": 1 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["committed", "hash", "short", "summary"],
  "properties": {
    "committed": { "type": "boolean" },
    "hash": { "type": "string" },
    "short": { "type": "string" },
    "summary": { "type": "string" }
  } }
```

### `vcs_restore` ✔ ✅ (Plane B / host) — mutating (**gated**)
Discard uncommitted working-tree changes to the given paths (`git restore -- <paths>`). DESTRUCTIVE — the discarded edits are unrecoverable — so elicitation-gated (`confirm:true` bypasses).

🔴 **`restored` is MEASURED, not echoed.** `git restore` exits 0 for a path with nothing to discard, so until 1.50.0 this returned the *requested* paths and a caller asking about five files of which one was dirty was told all five had been discarded. `restored` now lists only the paths git actually changed (the working-tree-vs-index diff, read before and after), `requested` carries what was asked for, and `stranded` names any path still dirty afterwards — a **partial, not an error**, because work was discarded for the other paths.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["paths"],
  "properties": {
    "paths": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "confirm": { "type": "boolean", "description": "Skip the confirmation prompt" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["restored", "count", "requested", "stranded"],
  "properties": {
    "restored": { "type": "array", "items": { "type": "string" } },
    "count": { "type": "integer" },
    "requested": { "type": "array", "items": { "type": "string" } },
    "stranded": { "type": "array", "items": { "type": "string" } }
  } }
```

### `vcs_stash` ✔ ✅ (Plane B / host) — mutating (**push and drop gated**)
Manage stashes. `push` saves + reverts working changes; `pop` re-applies the latest; `list` returns the entries; `drop` deletes an entry. `push` and `drop` are gated — one reverts every uncommitted change in the working tree, the other deletes an entry unrecoverably; `pop` and `list` are not.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["op"],
  "properties": {
    "op": { "enum": ["push", "pop", "list", "drop"] },
    "message": { "type": "string", "description": "Message for op=push" },
    "ref": { "type": "string", "description": "Stash ref for op=drop/pop, e.g. stash@{1}" },
    "confirm": { "type": "boolean", "description": "Skip the confirmation prompt (op=push / op=drop)" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["op", "message", "stashes"],
  "properties": {
    "op": { "type": "string" },
    "message": { "type": "string" },
    "stashes": { "type": "array", "items": { "type": "object", "required": ["ref", "description"], "properties": { "ref": { "type": "string" }, "description": { "type": "string" } } } }
  } }
```

### `vcs_branch_create` ✅ (Plane B / host) — mutating (ungated)
Create a branch, optionally from a ref (default HEAD) and optionally switch to it. Reversible (`git branch -d`), so ungated.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["name"],
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "from": { "type": "string", "description": "Start point (default HEAD)" },
    "switch": { "type": "boolean", "description": "Switch to the new branch (default false)" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["created", "name", "from", "switched"],
  "properties": {
    "created": { "type": "boolean" },
    "name": { "type": "string" },
    "from": { "type": ["string", "null"] },
    "switched": { "type": "boolean" }
  } }
```

### `vcs_switch` ✅ (Plane B / host) — mutating (ungated)
Switch to an existing branch (`git switch <branch>`). No `--force`: git refuses on a dirty conflict and its message is returned unchanged — nothing is clobbered — so ungated.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["branch"],
  "properties": {
    "branch": { "type": "string", "minLength": 1 }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["switched", "branch"],
  "properties": {
    "switched": { "type": "boolean" },
    "branch": { "type": "string" }
  } }
```

---

## Group J — AI asset generation

MCP-native asset generation: the server never bundles or calls a model. Each generator writes an asset to a `res://` path, imports it through the editor bridge, and returns a schema'd result — but the pixels / samples are **delegated**. `asset_gen_configure` picks the session backend (the feature flag): **`none`** (default) makes the five typed generators **degrade** to a clear "no generation backend configured" result carrying a `request` spec the connected multimodal client can fulfil (no file written; not an error); **`placeholder`** writes deterministic, in-engine procedural stand-ins as native Godot resources (`.tres`) that load synchronously — a hashed-colour `ImageTexture` (sprite / texture / icon), an `AudioStreamWAV` blip, a `BoxMesh` / primitive; **`command`** delegates to a configured local command (an argv template with `{kind} {prompt} {output} {width} {height} {format}` tokens substituted per-argument, no shell — the command writes the file, in any format, and the host imports it through the editor). `asset_gen_placeholder` always mints a deterministic stand-in regardless of the backend, and any typed generator accepts `placeholder: true` to force one. The file-writing paths are **destructive** (elicitation-gated); the degrade path writes nothing. The five typed generators share one result envelope (below), which validates all three outcomes — `placeholder` / `generated` / `no_backend`. Markers `AUTH_ASSETGEN_*` in the authoring-plane probe.

The shared generator result envelope (`asset_gen_placeholder` and the five typed generators):
```json
{ "type": "object", "required": ["status", "kind", "backend", "path", "prompt", "message"],
  "properties": {
    "status": { "enum": ["placeholder", "generated", "no_backend"] },
    "kind": { "type": "string" },
    "backend": { "type": "string" },
    "path": { "type": ["string", "null"] },
    "prompt": { "type": ["string", "null"] },
    "imported_type": { "type": ["string", "null"] },
    "width": { "type": "integer" },
    "height": { "type": "integer" },
    "bytes": { "type": "integer" },
    "format": { "type": "string" },
    "provider": { "type": ["string", "null"] },
    "request": { "type": "object" },
    "message": { "type": "string" }
  } }
```

### `asset_gen_configure` ✅ (Plane B / host)
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "backend": { "enum": ["none", "placeholder", "command"] },
    "command": { "type": "string" },
    "provider": { "type": "string" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["backend", "provider", "command", "configured", "supported_kinds", "note"],
  "properties": {
    "backend": { "type": "string" },
    "provider": { "type": ["string", "null"] },
    "command": { "type": ["string", "null"] },
    "configured": { "type": "boolean" },
    "supported_kinds": { "type": "array", "items": { "type": "string" } },
    "note": { "type": "string" }
  } }
```

### `asset_gen_placeholder` ✔ ✅ (Plane A / Editor) · writes file (gated)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["kind", "to_path"],
  "properties": {
    "kind": { "enum": ["sprite", "texture", "icon", "audio_sfx", "model"] },
    "to_path": { "type": "string" },
    "prompt": { "type": "string" },
    "width": { "type": "integer", "minimum": 1 },
    "height": { "type": "integer", "minimum": 1 },
    "duration_ms": { "type": "integer", "minimum": 1 },
    "shape": { "enum": ["box", "sphere", "cylinder", "prism"] },
    "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared generator result envelope above (`status: "placeholder"`).

### `asset_gen_sprite` ✔ ✅ (Plane A / Editor) · writes file (gated)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["prompt", "to_path"],
  "properties": {
    "prompt": { "type": "string" },
    "to_path": { "type": "string" },
    "width": { "type": "integer", "minimum": 1 },
    "height": { "type": "integer", "minimum": 1 },
    "placeholder": { "type": "boolean" },
    "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared generator result envelope above.

### `asset_gen_texture` ✔ ✅ (Plane A / Editor) · writes file (gated)
- **Input** — same as `asset_gen_sprite`.
- **Output** — the shared generator result envelope above.

### `asset_gen_icon` ✔ ✅ (Plane A / Editor) · writes file (gated)
- **Input** — same as `asset_gen_sprite`.
- **Output** — the shared generator result envelope above.

### `asset_gen_audio_sfx` ✔ ✅ (Plane A / Editor) · writes file (gated)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["prompt", "to_path"],
  "properties": {
    "prompt": { "type": "string" },
    "to_path": { "type": "string" },
    "duration_ms": { "type": "integer", "minimum": 1 },
    "placeholder": { "type": "boolean" },
    "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared generator result envelope above.

### `asset_gen_model` ✔ ✅ (Plane A / Editor) · writes file (gated)
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["prompt", "to_path"],
  "properties": {
    "prompt": { "type": "string" },
    "to_path": { "type": "string" },
    "shape": { "enum": ["box", "sphere", "cylinder", "prism"] },
    "placeholder": { "type": "boolean" },
    "overwrite": { "type": "boolean" }, "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared generator result envelope above.

---

## Group M — Netcode & backend scaffolding (Plane A / Editor + host)

The "game backend" question, resolved as **authoring, not hosting**. Godot 4's built-in high-level multiplayer is a first-class engine feature, and multiplayer is a top game-dev request — but running a relay / leaderboard-DB / save-store is a SaaS, not editor control. So this family **hosts nothing and scaffolds everything**: it only adds nodes, scripts, and config to the project. Three tools author multiplayer nodes over the editor bridge (undoable via `EditorUndoRedoManager`, like every `node_*`); four generate GDScript. The generated code is built host-side (so the templates are unit-tested) and written by the editor's `FileAccess` through the `mp.write_script` bridge method, which triggers a filesystem rescan. Every code-writing tool is **destructive** (elicitation-gated — the `resource_create` model). `mp_setup_webrtc_peer` is **feature-detected**: if the WebRTC module/extension is absent from the build, it degrades to a clear `unsupported` result and writes nothing (never a dead call). Markers `AUTH_MP_*` in the authoring-plane probe.

### `mp_add_spawner` ✅ (Plane A / Editor) · undoable
Add a `MultiplayerSpawner` (server-spawned nodes replicate to clients). `spawn_path` is the node whose children auto-replicate; `spawnable_scenes` are `res://` scenes it may instantiate.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"],
  "properties": {
    "parent_path": { "type": "string" },
    "name": { "type": "string" },
    "spawn_path": { "type": "string" },
    "spawnable_scenes": { "type": "array", "items": { "type": "string" } }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "spawn_path", "spawnable_scenes"],
  "properties": {
    "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" },
    "spawn_path": { "type": "string" },
    "spawnable_scenes": { "type": "array", "items": { "type": "string" } }
  } }
```

### `mp_add_synchronizer` ✅ (Plane A / Editor) · undoable
Add a `MultiplayerSynchronizer` and, when `properties` are given, build a `SceneReplicationConfig` replicating them. `root_path` is the node the property NodePaths are relative to (default `..`); property paths look like `.:position`.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["parent_path"],
  "properties": {
    "parent_path": { "type": "string" },
    "name": { "type": "string" },
    "root_path": { "type": "string" },
    "properties": { "type": "array", "items": { "type": "string" } },
    "replication_mode": { "enum": ["always", "on_change", "never"] }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "name", "type", "root_path", "properties"],
  "properties": {
    "path": { "type": "string" }, "name": { "type": "string" }, "type": { "type": "string" },
    "root_path": { "type": "string" },
    "properties": { "type": "array", "items": { "type": "string" } }
  } }
```

### `mp_set_authority` ✅ (Plane A / Editor) · undoable
Set a node's multiplayer authority (`set_multiplayer_authority`) to a peer id (1 = server). The authority peer is the one allowed to push `authority`-mode RPCs / synchronizer state for that node.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "peer_id"],
  "properties": {
    "path": { "type": "string" },
    "peer_id": { "type": "integer" },
    "recursive": { "type": "boolean" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["path", "peer_id", "previous", "recursive"],
  "properties": {
    "path": { "type": "string" }, "peer_id": { "type": "integer" },
    "previous": { "type": "integer" }, "recursive": { "type": "boolean" }
  } }
```

The four codegen tools share one result envelope (validates the `written` and — WebRTC only — `unsupported` outcomes; tool-specific extras like `bytes` / `created` / `function` / `annotation` / `stub_created` are additional):
```json
{ "type": "object", "required": ["status", "kind", "path", "message"],
  "properties": {
    "status": { "enum": ["written", "unsupported"] },
    "kind": { "type": "string" },
    "path": { "type": ["string", "null"] },
    "message": { "type": "string" }
  } }
```

### `mp_setup_enet_peer` ✔ ✅ (Plane A / Editor + host) · writes file (gated)
Generate an `ENetMultiplayerPeer` host/join helper script (`host_game` / `join_game` / `close`) and assign `multiplayer.multiplayer_peer`. Godot's default, always-available transport.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["to_path"],
  "properties": {
    "to_path": { "type": "string" },
    "port": { "type": "integer", "minimum": 1 },
    "max_clients": { "type": "integer", "minimum": 1 },
    "class_name": { "type": "string" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared codegen envelope above (`status: "written"`).

### `mp_setup_webrtc_peer` ✔ ✅ (Plane A / Editor + host) · writes file (gated) · feature-detected
Generate a `WebRTCMultiplayerPeer` mesh helper. If the WebRTC module/extension is absent, degrades to `status: "unsupported"` and writes nothing.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["to_path"],
  "properties": {
    "to_path": { "type": "string" },
    "class_name": { "type": "string" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared codegen envelope above (`status: "written"` or `"unsupported"`).

### `mp_wire_rpc` ✔ ✅ (Plane A / Editor + host) · writes file (gated)
Insert (or replace) an `@rpc(...)` annotation above a function in an existing `res://` script; appends a stub when the function is absent. Operates on the on-disk file (save unsaved editor changes first).
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "function"],
  "properties": {
    "path": { "type": "string" },
    "function": { "type": "string" },
    "mode": { "enum": ["authority", "any_peer"] },
    "transfer_mode": { "enum": ["unreliable", "unreliable_ordered", "reliable"] },
    "call_local": { "type": "boolean" },
    "channel": { "type": "integer", "minimum": 0 },
    "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared codegen envelope above, plus `function`, `annotation`, `stub_created`.

### `mp_scaffold_lobby` ✔ ✅ (Plane A / Editor + host) · writes file (gated)
Generate a lobby controller GDScript: ENet host/join plus `peer_connected` / `peer_disconnected` tracking with `player_joined` / `player_left` / `server_started` / `join_succeeded` / `join_failed` signals.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["to_path"],
  "properties": {
    "to_path": { "type": "string" },
    "port": { "type": "integer", "minimum": 1 },
    "max_players": { "type": "integer", "minimum": 1 },
    "class_name": { "type": "string" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared codegen envelope above (`status: "written"`).

The **second half** of Group M is backend-SDK integration scaffolding (`backend_detect` + the four `*_scaffold` codegen tools). Same "host nothing, scaffold everything" stance: we never run a leaderboard DB, save-store or auth service — we generate the integration against the game's *installed* SDK (SilentWolf / Nakama / PlayFab / Photon). Every codegen tool is **feature-detected twice, and never a dead call**: if the SDK provides no such API (Photon is realtime transport, so it has no leaderboard/cloud-save/auth), it degrades to `status: "unsupported_feature"`; if the SDK is not installed in the project, it degrades to `status: "sdk_missing"` ("install <SDK> first"). Detection (via `backend_detect` → the `backend.detect` bridge method) keys off an enabled autoload, an addon directory under `res://addons`, or a global `class_name`. Only a capable + installed SDK reaches the (gated) writer; the generated GDScript is built host-side and written through the shared `mp.write_script` bridge method. Markers `AUTH_BACKEND_*` in the authoring-plane probe.

### `backend_detect` ✅ (Plane A / Editor) · read-only
Report which known backend SDKs (SilentWolf / Nakama / PlayFab / Photon) are installed in the project and how each was found (an enabled autoload, an addon directory, or a global `class_name`). Read-only — nothing is written.
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "sdk": { "enum": ["silentwolf", "nakama", "playfab", "photon"] }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["detected", "backends", "message"], "properties": { "detected": { "type": "array", "items": { "type": "string" } }, "backends": { "type": "array", "items": { "type": "object", "required": ["sdk", "installed"], "properties": { "sdk": { "type": "string" }, "installed": { "type": "boolean" }, "method": { "type": ["string", "null"] }, "autoload": { "type": ["string", "null"] }, "addon_dir": { "type": ["string", "null"] }, "class_name": { "type": ["string", "null"] } } } }, "message": { "type": "string" } } }
```

The shared backend scaffold envelope (the four backend tools below; `status` distinguishes a real write from the two degrade paths, and `path` is null on both of them):
```json
{ "type": "object", "required": ["status", "sdk", "kind", "path", "message"],
  "properties": {
    "status": { "enum": ["written", "sdk_missing", "unsupported_feature"] },
    "sdk": { "type": "string" },
    "kind": { "type": "string" },
    "path": { "type": ["string", "null"] },
    "message": { "type": "string" }
  } }
```

### `backend_configure` ✔ ✅ (Plane A / Editor + host) · writes file (gated) · feature-detected
Generate a config/bootstrap GDScript for a backend SDK — constants (API key / game id / host / title id / app id) plus a `configure()` you register as an autoload. If the SDK is not installed, degrades to `status: "sdk_missing"` and writes nothing.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["sdk"],
  "properties": {
    "sdk": { "enum": ["silentwolf", "nakama", "playfab", "photon"] },
    "to_path": { "type": "string" },
    "api_key": { "type": "string" },
    "game_id": { "type": "string" },
    "title_id": { "type": "string" },
    "app_id": { "type": "string" },
    "host": { "type": "string" },
    "port": { "type": "integer", "minimum": 1 },
    "server_key": { "type": "string" },
    "region": { "type": "string" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared backend scaffold envelope above.

### `leaderboard_scaffold` ✔ ✅ (Plane A / Editor + host) · writes file (gated) · feature-detected
Generate submit/fetch leaderboard helpers against the installed SDK. Degrades to `unsupported_feature` (Photon has no leaderboard API) or `sdk_missing` (not installed); neither writes.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["sdk"],
  "properties": {
    "sdk": { "enum": ["silentwolf", "nakama", "playfab", "photon"] },
    "to_path": { "type": "string" },
    "leaderboard_name": { "type": "string" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared backend scaffold envelope above.

### `cloudsave_scaffold` ✔ ✅ (Plane A / Editor + host) · writes file (gated) · feature-detected
Generate save/load cloud-save helpers against the installed SDK. Degrades to `unsupported_feature` (Photon has no cloud-save API) or `sdk_missing` (not installed); neither writes.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["sdk"],
  "properties": {
    "sdk": { "enum": ["silentwolf", "nakama", "playfab", "photon"] },
    "to_path": { "type": "string" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared backend scaffold envelope above.

### `auth_scaffold` ✔ ✅ (Plane A / Editor + host) · writes file (gated) · feature-detected
Generate login/register/logout helpers against the installed SDK. Degrades to `unsupported_feature` (Photon has no auth API) or `sdk_missing` (not installed); neither writes.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["sdk"],
  "properties": {
    "sdk": { "enum": ["silentwolf", "nakama", "playfab", "photon"] },
    "to_path": { "type": "string" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output** — the shared backend scaffold envelope above.

---

## Group N — Card / board / piece authoring composites (Plane A / Editor + host)

Composite authoring **on top of** the existing primitives. Each `card_*` / `board_*` / `piece_*` / `interact_*` tool is a host-side scripted sequence of already-audited editor-bridge ops (`scene.new`, `control.create`, `node.add`, `node.set_property`, `resource.create`, `theme.*`, `node.instantiate_scene`, `node.call_method`, `node.add_to_group`, `node.reparent`, `anim.*`, `signal.*`, `inputmap.*`) — it adds **no** addon method, so the host↔addon contract is unchanged. The composites build **structure** (scenes, nodes, a small script-backed `set_data()` / `set_face()`, and drag/drop behaviour scripts) and bind data a caller passes in; they never invent card values, names, or rules. Increment 1 is the **Card slice** (4 tools, plus the `card_set_face` fast-follow); Increment 2 is the **Board slice** (2 tools: `board_create`, `board_place`, plus the tile-backed fast-follow `board_tile_create` / `board_tile_place`); Increment 3 is the **Piece slice** (3 tools: `piece_template_create`, `piece_instance`, `piece_move`); Increment 4 is the **Interaction slice** (2 tools: `interact_make_draggable`, `interact_add_drop_zone`). `card_template_create`, `board_create`, `board_tile_create`, `piece_template_create`, and the two `interact_*` tools write files (a scene / behaviour script / TileSet) and are **destructive** (elicitation-gated); the rest are undoable node authoring in the open scene (ungated, the `node_*` model). `piece_instance` can `place_on` a cell and `piece_move` reparents onto a cell — both reuse `board_place`; `piece_move`'s optional pop and `card_set_face`'s optional flip clip are authored from existing Group C `anim_*` primitives, so they stay purely additive. `card_set_face` flips a card between its face and back — instantly, or via an authored flip clip whose `method` key swaps the side at the edge-on midpoint. The Interaction tools wire drag-and-drop in two general-purpose modes (`control` = Godot's built-in Control DnD; `node2d` = an Area2D hit region + pointer handler); a drop zone validates a neutral `payload` with a `key∈values` predicate and emits an `on_drop` signal. Because every op is an existing primitive, the whole surface is unit-tested offline against an injected emit-sink. Everything here is **general-purpose** — the tools carry no game-specific vocabulary; a guardrail test fails CI if any appears.

### `card_template_create` ✔ ✅ (Plane A / Editor + host) · writes files (gated)
Build a reusable card `PackedScene` from a slot spec, with a generated script-backed `set_data()` / `set_face()`. Named slots (`label` / `rich_text` / `texture` / `panel` / `badge`) become the card's regions; optional inline theme and a two-sided card back.

`path` must resolve INSIDE the Godot project root. `res://../…` satisfies a `res://` prefix test but escapes the root, and is refused with `path_outside_project` — measured in session 161, four creators wrote seven files outside a real project this way. `overwrite` is now honoured: with it omitted or false an existing `path` is refused (`exists`) instead of written. Until 1.39.0 the flag was declared and never read, so a second call APPENDED to the existing scene and still answered `saved: true` with the node_count it intended rather than the one on disk.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "size", "slots"],
  "properties": {
    "path": { "type": "string", "pattern": "^res://.*\\.tscn$" },
    "size": { "type": "object", "required": ["width", "height"],
      "properties": { "width": { "type": "integer", "minimum": 1 }, "height": { "type": "integer", "minimum": 1 } } },
    "root_type": { "enum": ["PanelContainer", "Panel", "Control"] },
    "slots": { "type": "array", "minItems": 1, "items": {
      "type": "object", "required": ["name", "kind"],
      "properties": {
        "name": { "type": "string" },
        "kind": { "enum": ["label", "rich_text", "texture", "panel", "badge"] },
        "rect": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" }, "w": { "type": "number" }, "h": { "type": "number" } } },
        "anchor_preset": { "type": "integer", "minimum": 0, "maximum": 15 },
        "font_size": { "type": "integer", "minimum": 1 },
        "align": { "enum": ["left", "center", "right"] },
        "wrap": { "type": "boolean" },
        "color_by": { "type": "string" },
        "default_text": { "type": "string" }
      } } },
    "face": { "type": "array", "items": { "type": "string" } },
    "back": { "type": "object", "properties": {
      "art": { "type": "string" },
      "color": { "type": "string", "pattern": "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" } } },
    "theme_path": { "type": "string" },
    "theme": { "type": "object", "properties": {
      "base_color": { "type": "string" }, "accent_color": { "type": "string" },
      "font_path": { "type": "string" }, "font_size": { "type": "integer", "minimum": 1 },
      "panel_stylebox": { "type": "object", "properties": {
        "bg_color": { "type": "string" }, "corner_radius": { "type": "integer", "minimum": 0 },
        "border_width": { "type": "integer", "minimum": 0 }, "border_color": { "type": "string" } } } } },
    "script_path": { "type": "string", "pattern": "^res://.*\\.gd$" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["scene_path", "slots", "saved"],
  "properties": {
    "scene_path": { "type": "string" },
    "script_path": { "type": "string" },
    "root_type": { "type": "string" },
    "has_back": { "type": "boolean" },
    "node_count": { "type": "integer" },
    "saved": { "type": "boolean" },
    "slots": { "type": "array", "items": {
      "type": "object", "required": ["name", "node_path", "kind"],
      "properties": { "name": { "type": "string" }, "node_path": { "type": "string" }, "kind": { "type": "string" } } } }
  } }
```

### `card_instance` ✅ (Plane A / Editor) · undoable
Instance a card template into the open scene and bind data to its slots via the template's `set_data()`. Reports which data keys bound and which had no matching slot.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["template_path", "parent", "data"],
  "properties": {
    "template_path": { "type": "string", "pattern": "^res://.*\\.tscn$" },
    "parent": { "type": "string" },
    "data": { "type": "object", "additionalProperties": { "type": ["string", "number", "boolean"] } },
    "position": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } },
    "face_up": { "type": "boolean" },
    "name": { "type": "string" },
    "persist": { "type": "boolean", "description": "bake the bound slot data into the saved scene via Editable Children (default false = runtime-bound, reverts on reload)" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["instance_path", "face_up"],
  "properties": {
    "instance_path": { "type": "string" },
    "face_up": { "type": "boolean" },
    "bound": { "type": "array", "items": { "type": "string" } },
    "unbound": { "type": "array", "items": { "type": "string" } },
    "persisted": { "type": "boolean" }
  } }
```

### `card_hand_layout` ✅ (Plane A / Editor) · undoable
Instance N cards under a container and arrange them as a `row`, `fan`, `stack`, or `grid`. Each card carries its own data and face state.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["template_path", "parent", "cards", "mode"],
  "properties": {
    "template_path": { "type": "string", "pattern": "^res://.*\\.tscn$" },
    "parent": { "type": "string" },
    "cards": { "type": "array", "minItems": 1, "items": {
      "type": "object", "required": ["data"],
      "properties": {
        "data": { "type": "object", "additionalProperties": { "type": ["string", "number", "boolean"] } },
        "face_up": { "type": "boolean" } } } },
    "mode": { "enum": ["row", "fan", "stack", "grid"] },
    "spacing": { "type": "number" },
    "overlap": { "type": "number" },
    "fan_angle": { "type": "number" },
    "columns": { "type": "integer", "minimum": 1 },
    "align": { "enum": ["start", "center", "end"] },
    "origin": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } },
    "persist": { "type": "boolean", "description": "bake each card's bound slot data into the saved scene via Editable Children on every instanced card (default false = runtime-bound, reverts on reload)" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["container_path", "mode", "count", "instances"],
  "properties": {
    "container_path": { "type": "string" },
    "mode": { "type": "string" },
    "count": { "type": "integer" },
    "persisted": { "type": "boolean" },
    "instances": { "type": "array", "items": {
      "type": "object", "required": ["index", "instance_path"],
      "properties": { "index": { "type": "integer" }, "instance_path": { "type": "string" } } } }
  } }
```

### `card_deck_from_table` ✅ (Plane A / Editor + host) · undoable
Read a CSV or JSON table and stamp one card per row, binding columns to slots via a column map. `column_map` values are bare `{column}` references or composed templates like `"{name} · {role}"`; an optional `filter` selects rows and an optional `layout` arranges them. Table columns no slot referenced are surfaced (never silently dropped).

`table_path` may be `res://…`, project-relative, or absolute — but it must RESOLVE INSIDE the project root. A path that escapes it (including `res://../…`, which is not the same string test) is refused with `path_outside_project`. This is not a formality: the rows this tool reads are stamped into the scene, so an escaped read puts content from outside the project into your game. The refusal also distinguishes the causes that a bare "cannot read" used to merge — `not_found` (no such file), `not_a_file` (a directory, or the project root, which is what `""` resolves to), and `empty_table` (a real, reachable, zero-byte file). An empty table is a data problem; a missing one is a path problem, and they no longer share an error.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["template_path", "parent", "table_path", "column_map"],
  "properties": {
    "template_path": { "type": "string", "pattern": "^res://.*\\.tscn$" },
    "parent": { "type": "string" },
    "table_path": { "type": "string" },
    "format": { "enum": ["csv", "json"] },
    "column_map": { "type": "object", "additionalProperties": { "type": "string" } },
    "filter": { "type": "object", "required": ["column", "equals"],
      "properties": { "column": { "type": "string" }, "equals": { "type": ["string", "number", "boolean"] } } },
    "art_column": { "type": "string" },
    "limit": { "type": "integer", "minimum": 1 },
    "face_up": { "type": "boolean" },
    "layout": { "type": "object", "properties": {
      "mode": { "enum": ["row", "fan", "stack", "grid"] },
      "spacing": { "type": "number" }, "overlap": { "type": "number" }, "fan_angle": { "type": "number" },
      "columns": { "type": "integer", "minimum": 1 },
      "align": { "enum": ["start", "center", "end"] },
      "origin": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } } } },
    "persist": { "type": "boolean", "description": "bake each stamped card's bound slot data into the saved scene via Editable Children on every card (default false = runtime-bound, reverts on reload)" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["deck_container", "count", "rows_read"],
  "properties": {
    "deck_container": { "type": "string" },
    "count": { "type": "integer" },
    "rows_read": { "type": "integer" },
    "rows_skipped": { "type": "integer" },
    "unmapped_columns": { "type": "array", "items": { "type": "string" } },
    "persisted": { "type": "boolean" },
    "instances": { "type": "array", "items": {
      "type": "object", "required": ["row_index", "instance_path"],
      "properties": { "row_index": { "type": "integer" }, "instance_path": { "type": "string" } } } }
  } }
```

### `card_set_face` ✅ (Plane A / Editor) · undoable
Flip an instanced card (or any node exposing `set_face(bool)` — the generated card **and** piece scripts both do) between its face and back. **Instant** by default: calls the setter now, so the visible side changes immediately. With `animate`, instead authors a reusable **flip clip** under the node from Group C `anim_*` primitives — a horizontal "pinch" on the node's own `scale` (1 → edge-on `(0, 1)` → 1) plus a **method** key that calls the setter at the edge-on midpoint, so playing the clip performs a believable flip and swaps the side exactly when the card is thinnest. Purely additive — it emits only existing `node.*` / `anim.*` ops, never a new engine call; the clip is played on demand (the current face is unchanged until it plays). Returns the target state and any authored player / anim.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["node", "face_up"],
  "properties": {
    "node": { "type": "string" },
    "face_up": { "type": "boolean" },
    "method": { "type": "string" },
    "animate": { "type": "object", "properties": {
      "duration": { "type": "number", "exclusiveMinimum": 0 },
      "player": { "type": "string" },
      "anim": { "type": "string" },
      "transition": { "type": "number" } } }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["node_path", "face_up", "method", "animated"],
  "properties": {
    "node_path": { "type": "string" },
    "face_up": { "type": "boolean" },
    "method": { "type": "string" },
    "animated": { "type": "boolean" },
    "player_path": { "type": ["string", "null"] },
    "anim": { "type": ["string", "null"] }
  } }
```

### `board_create` ✔ ✅ (Plane A / Editor + host) · writes files (gated)
Build a board scene whose children are addressable **cells** — each a `cell_<id>` node in the `board_cells` group — from one of three general-purpose layouts: a `ring` of ids, a `grid` of `rows`×`cols` (ids `"<row>_<col>"`), or an explicit `cells` list of `{id, x, y}`. Cells are `Marker2D` (or `Control`) anchors positioned by pure ring/grid math; an optional `background` (solid `color` or a `res://` `art` texture) is drawn behind them. Adds **no** addon method — decomposes onto `scene.new` → `node.add` → `node.set_property` → `node.add_to_group` → `scene.save`. **Destructive** (writes a scene) — elicitation-gated. Returns the `cell_id → node_path + position` map. For `tile`-backed cells (a `TileMapLayer` grid addressed by `[x, y]` coordinates) see `board_tile_create` / `board_tile_place`.

`path` must resolve INSIDE the Godot project root. `res://../…` satisfies a `res://` prefix test but escapes the root, and is refused with `path_outside_project` — measured in session 161, four creators wrote seven files outside a real project this way. `overwrite` is now honoured: with it omitted or false an existing `path` is refused (`exists`) instead of written. Until 1.39.0 the flag was declared and never read, so a second call APPENDED to the existing scene and still answered `saved: true` with the node_count it intended rather than the one on disk.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "layout"],
  "properties": {
    "path": { "type": "string", "pattern": "^res://.*\\.tscn$" },
    "layout": { "oneOf": [
      { "type": "object", "required": ["mode", "cells"], "properties": {
        "mode": { "const": "ring" },
        "cells": { "type": "array", "minItems": 1, "items": { "type": "string" } },
        "radius": { "type": "number", "exclusiveMinimum": 0 },
        "start_deg": { "type": "number" },
        "clockwise": { "type": "boolean" },
        "center": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } } } },
      { "type": "object", "required": ["mode", "rows", "cols"], "properties": {
        "mode": { "const": "grid" },
        "rows": { "type": "integer", "minimum": 1 },
        "cols": { "type": "integer", "minimum": 1 } } },
      { "type": "object", "required": ["mode", "cells"], "properties": {
        "mode": { "const": "cells" },
        "cells": { "type": "array", "minItems": 1, "items": {
          "type": "object", "required": ["id", "x", "y"],
          "properties": { "id": { "type": "string" }, "x": { "type": "number" }, "y": { "type": "number" } } } } } }
    ] },
    "cell_size": { "type": "number", "exclusiveMinimum": 0 },
    "cell_kind": { "enum": ["marker", "control"] },
    "root_type": { "enum": ["Node2D", "Control"] },
    "background": { "type": "object", "properties": {
      "color": { "type": "string", "pattern": "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
      "art": { "type": "string" },
      "size": { "type": "object", "properties": { "w": { "type": "number" }, "h": { "type": "number" } } } } },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["scene_path", "cells", "saved"],
  "properties": {
    "scene_path": { "type": "string" },
    "root_type": { "type": "string" },
    "cell_kind": { "type": "string" },
    "layout_mode": { "type": "string" },
    "cell_count": { "type": "integer" },
    "node_count": { "type": "integer" },
    "saved": { "type": "boolean" },
    "cells": { "type": "array", "items": {
      "type": "object", "required": ["id", "node_path", "x", "y"],
      "properties": { "id": { "type": "string" }, "node_path": { "type": "string" }, "x": { "type": "number" }, "y": { "type": "number" } } } }
  } }
```

### `board_place` ✅ (Plane A / Editor) · undoable
Reparent an existing node (a card or piece instance) onto a board cell by id and snap it to the cell anchor. The target cell is `<board>/cell_<cell>`; `align` offsets the node from the cell origin (default centred). Decomposes onto `node.reparent` + `node.set_property`. Returns the node's new path.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["board", "cell", "node"],
  "properties": {
    "board": { "type": "string" },
    "cell": { "type": "string" },
    "node": { "type": "string" },
    "align": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["placed", "cell", "node_path"],
  "properties": {
    "placed": { "type": "boolean" },
    "cell": { "type": "string" },
    "cell_path": { "type": "string" },
    "node_path": { "type": "string" },
    "align": { "type": "object", "required": ["x", "y"], "properties": { "x": { "type": "number" }, "y": { "type": "number" } } }
  } }
```

### `board_tile_create` ✔ ✅ (Plane A / Editor + host) · writes files (gated)
Build a **tile-backed** board scene: a `TileMapLayer` grid whose cells are addressable by integer `[x, y]` tile coordinates (`cols` wide × `rows` tall) — the other Group D idiom to `board_create`'s per-cell `Marker2D` anchors. The layer binds a `TileSet`: a supplied `tileset` `.tres`, or a fresh empty one created at `<scene>_tiles.tres`, so the layer has a real `tile_size` (the coordinate frame `board_tile_place` snaps to). `paint` optionally fills the whole grid with one tile from the bound tileset in a single action; omitted, the cells stay empty and the layer is a coordinate frame only. Adds **no** addon method — decomposes onto `scene.new` → `tileset.create` → `tilemaplayer.create` → `tilemap.set_cells_rect` → `scene.save`. **Destructive** (writes a scene, and a `TileSet` `.tres` unless `tileset` is supplied) — elicitation-gated. General-purpose — cells carry only coordinates. Returns the layer path + grid dimensions + tile size.

`path` must resolve INSIDE the Godot project root. `res://../…` satisfies a `res://` prefix test but escapes the root, and is refused with `path_outside_project` — measured in session 161, four creators wrote seven files outside a real project this way. `overwrite` is now honoured: with it omitted or false an existing `path` is refused (`exists`) instead of written. Until 1.39.0 the flag was declared and never read, so a second call APPENDED to the existing scene and still answered `saved: true` with the node_count it intended rather than the one on disk.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "rows", "cols"],
  "properties": {
    "path": { "type": "string", "pattern": "^res://.*\\.tscn$" },
    "rows": { "type": "integer", "minimum": 1 },
    "cols": { "type": "integer", "minimum": 1 },
    "tile_size": { "type": "array", "items": { "type": "integer", "minimum": 1 }, "minItems": 2, "maxItems": 2 },
    "tileset": { "type": "string", "pattern": "^res://.*\\.tres$" },
    "paint": { "type": "object", "required": ["source_id"], "properties": {
      "source_id": { "type": "integer", "minimum": 0 },
      "atlas_coords": { "type": "array", "items": { "type": "integer" }, "minItems": 2, "maxItems": 2 } } },
    "layer_name": { "type": "string" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["scene_path", "layer_path", "rows", "cols", "tile_size", "saved"],
  "properties": {
    "scene_path": { "type": "string" },
    "layer_path": { "type": "string" },
    "layer_name": { "type": "string" },
    "rows": { "type": "integer" },
    "cols": { "type": "integer" },
    "tile_size": { "type": "array", "items": { "type": "integer" } },
    "tileset_path": { "type": "string" },
    "tileset_created": { "type": "boolean" },
    "cell_count": { "type": "integer" },
    "painted": { "type": "boolean" },
    "node_count": { "type": "integer" },
    "saved": { "type": "boolean" }
  } }
```

### `board_tile_place` ✅ (Plane A / Editor) · undoable
Snap an existing node (a card or piece instance) onto a `TileMapLayer` cell by integer `[x, y]` tile `coord`. The cell's local position is computed from `tile_size` — centre `(coord + 0.5) × tile_size` (default `anchor`) or corner `coord × tile_size` — matching Godot's `TileMapLayer.map_to_local`, plus an optional `align` offset. With `reparent` (default `true`) the node is moved under the layer so the coordinate is layer-local; with `false` its `position` is set in place. Decomposes onto `node.reparent` + `node.set_property`. Returns the node's new path and local position.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["layer", "node", "coord"],
  "properties": {
    "layer": { "type": "string" },
    "node": { "type": "string" },
    "coord": { "type": "array", "items": { "type": "integer" }, "minItems": 2, "maxItems": 2 },
    "tile_size": { "type": "array", "items": { "type": "integer", "minimum": 1 }, "minItems": 2, "maxItems": 2 },
    "anchor": { "enum": ["center", "corner"] },
    "align": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } },
    "reparent": { "type": "boolean" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["placed", "coord", "node_path", "local_pos"],
  "properties": {
    "placed": { "type": "boolean" },
    "coord": { "type": "array", "items": { "type": "integer" } },
    "layer_path": { "type": "string" },
    "node_path": { "type": "string" },
    "local_pos": { "type": "object", "required": ["x", "y"], "properties": { "x": { "type": "number" }, "y": { "type": "number" } } },
    "tile_size": { "type": "array", "items": { "type": "integer" } },
    "anchor": { "type": "string" },
    "align": { "type": "object", "required": ["x", "y"], "properties": { "x": { "type": "number" }, "y": { "type": "number" } } },
    "reparented": { "type": "boolean" }
  } }
```

### `piece_template_create` ✔ ✅ (Plane A / Editor + host) · writes files (gated)
Build a reusable piece (token) `PackedScene` from a spec: an `Art` node (`Sprite2D` under a `Node2D` root, `TextureRect` under a `Control` root), an optional `Label`, an optional hit area (`Area2D` + `CollisionShape2D` with a `rectangle`/`circle` shape sized from `size`), and an optional two-sided `Back`, plus a generated script-backed `set_data()` / `set_face()`. `set_data` binds the neutral keys `art` (texture) / `color` (Art tint) / `label` (text); `set_face` flips Art+Label vs Back. Adds **no** addon method — decomposes onto `scene.new` → `node.add` → `node.set_property` → `resource.create` → `scene.save`. **Destructive** (writes a scene + script) — elicitation-gated. Returns the scene path + created-node map.

`path` must resolve INSIDE the Godot project root. `res://../…` satisfies a `res://` prefix test but escapes the root, and is refused with `path_outside_project` — measured in session 161, four creators wrote seven files outside a real project this way. `overwrite` is now honoured: with it omitted or false an existing `path` is refused (`exists`) instead of written. Until 1.39.0 the flag was declared and never read, so a second call APPENDED to the existing scene and still answered `saved: true` with the node_count it intended rather than the one on disk.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["path", "size"],
  "properties": {
    "path": { "type": "string", "pattern": "^res://.*\\.tscn$" },
    "size": { "type": "object", "required": ["width", "height"],
      "properties": { "width": { "type": "integer", "minimum": 1 }, "height": { "type": "integer", "minimum": 1 } } },
    "root_type": { "enum": ["Node2D", "Control"] },
    "art": { "type": "string" },
    "color": { "type": "string", "pattern": "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
    "label": { "type": "boolean" },
    "label_text": { "type": "string" },
    "hit_area": { "type": "object", "properties": { "shape": { "enum": ["rectangle", "circle"] } } },
    "back": { "type": "object", "properties": {
      "art": { "type": "string" },
      "color": { "type": "string", "pattern": "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" } } },
    "script_path": { "type": "string", "pattern": "^res://.*\\.gd$" },
    "overwrite": { "type": "boolean" },
    "confirm": { "type": "boolean" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["scene_path", "nodes", "saved"],
  "properties": {
    "scene_path": { "type": "string" },
    "script_path": { "type": "string" },
    "root_type": { "type": "string" },
    "has_label": { "type": "boolean" },
    "has_hit_area": { "type": "boolean" },
    "has_back": { "type": "boolean" },
    "node_count": { "type": "integer" },
    "saved": { "type": "boolean" },
    "nodes": { "type": "array", "items": {
      "type": "object", "required": ["name", "node_path", "type"],
      "properties": { "name": { "type": "string" }, "node_path": { "type": "string" }, "type": { "type": "string" } } } }
  } }
```

### `piece_instance` ✅ (Plane A / Editor) · undoable
Instance a piece template into the open scene and bind data (`art` / `color` / `label`) via the template's `set_data()`. Optionally `place_on` a board cell in the same call (reparent + snap via `board_place`). Reports which data keys bound and which had no matching slot.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["template_path", "parent", "data"],
  "properties": {
    "template_path": { "type": "string", "pattern": "^res://.*\\.tscn$" },
    "parent": { "type": "string" },
    "data": { "type": "object", "additionalProperties": { "type": ["string", "number", "boolean"] } },
    "position": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } },
    "face_up": { "type": "boolean" },
    "name": { "type": "string" },
    "place_on": { "type": "object", "required": ["board", "cell"], "properties": {
      "board": { "type": "string" },
      "cell": { "type": "string" },
      "align": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } } } },
    "persist": { "type": "boolean", "description": "bake the bound data into the saved scene via Editable Children on the instance (default false = runtime-bound, reverts on reload)" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["instance_path", "face_up", "placed"],
  "properties": {
    "instance_path": { "type": "string" },
    "face_up": { "type": "boolean" },
    "bound": { "type": "array", "items": { "type": "string" } },
    "unbound": { "type": "array", "items": { "type": "string" } },
    "placed": { "type": "boolean" },
    "cell": { "type": ["string", "null"] },
    "persisted": { "type": "boolean" }
  } }
```

### `piece_move` ✅ (Plane A / Editor) · undoable
Move a piece onto a board cell by id (reparent + snap via `board_place`), optionally with a short scale "pop" animation authored from Group C `anim_*` primitives (an `AnimationPlayer` under the piece keying its own `scale` 1 → pop → 1). Purely additive — it emits only existing `node.*` / `anim.*` ops, never a new engine call. Returns the piece's new path.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["board", "node", "to"],
  "properties": {
    "board": { "type": "string" },
    "node": { "type": "string" },
    "to": { "type": "string" },
    "from": { "type": "string" },
    "align": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } },
    "animate": { "type": "object", "properties": {
      "duration": { "type": "number", "exclusiveMinimum": 0 },
      "pop_scale": { "type": "number", "exclusiveMinimum": 0 },
      "player": { "type": "string" },
      "anim": { "type": "string" },
      "transition": { "type": "number" } } }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["moved", "to", "node_path", "animated"],
  "properties": {
    "moved": { "type": "boolean" },
    "from": { "type": ["string", "null"] },
    "to": { "type": "string" },
    "node_path": { "type": "string" },
    "animated": { "type": "boolean" }
  } }
```

### `interact_make_draggable` ✔ ✅ (Plane A / Editor + host) · writes files (gated)
Wire an existing node for drag-and-drop by attaching a generated reusable drag script. **Composes** with the node's existing script: when it already has one, the drag script `extends` it, so an authored card keeps its `set_data`/`set_face` and merely *gains* drag (the script is never overwritten — `composed`/`base_script` report what happened). `control` mode uses Godot's built-in Control drag-and-drop (`_get_drag_data` hands off `{payload, source}`, with an optional translucent preview); `node2d` mode carries the payload and follows the pointer from a button-driven handler, registering a drag input action (`inputmap_add_action` / `add_event`) and connecting the hit area's `input_event` to the handler. General-purpose — the drag carries a caller-supplied neutral `payload` Dictionary, written as a **per-node `@export`** so one script serves many draggables. Decomposes onto `node.get_property` → `resource.create` → `node.set_property` (script + payload) (+ the input/signal ops for node2d); no addon method is added. Destructive (writes a script) — gated.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["node", "script_path", "mode"],
  "properties": {
    "node": { "type": "string" },
    "script_path": { "type": "string", "pattern": "^res://.*\\.gd$" },
    "mode": { "type": "string", "enum": ["control", "node2d"] },
    "payload": { "type": "object", "additionalProperties": { "type": ["string", "number", "boolean"] } },
    "preview": { "type": "boolean" },
    "button": { "type": "integer", "minimum": 0 },
    "action": { "type": "string" },
    "hit_area": { "type": "string" }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["node_path", "mode", "script_path", "connected", "composed", "base_script"],
  "properties": {
    "node_path": { "type": "string" },
    "mode": { "type": "string" },
    "script_path": { "type": "string" },
    "payload_keys": { "type": "array", "items": { "type": "string" } },
    "action": { "type": ["string", "null"] },
    "connected": { "type": "boolean" },
    "composed": { "type": "boolean" },
    "base_script": { "type": ["string", "null"] }
  } }
```

### `interact_add_drop_zone` ✔ ✅ (Plane A / Editor + host) · writes files (gated)
Mark a node as a drop target that validates an incoming payload and emits a signal on a valid drop. Attaches a generated validator/acceptor script that **declares the `on_drop` signal in-script** (so it survives a scene reload — no runtime-only `add_user_signal`), and — for `node2d` — builds an `Area2D` + `CollisionShape2D` hit region; optionally connects `on_drop` to a handler with a **persisted** connection (`signal_connect`, `CONNECT_PERSIST`, written into the `.tscn`). `accepts` is the neutral predicate `{key, values}` — accept any payload when omitted, else accept when `payload[key]` is one of `values`. `control` mode overrides `_can_drop_data` / `_drop_data`; `node2d` exposes a `try_drop(payload)` seam. General-purpose — no domain vocabulary. Destructive (writes a script) — gated.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["node", "script_path", "mode"],
  "properties": {
    "node": { "type": "string" },
    "script_path": { "type": "string", "pattern": "^res://.*\\.gd$" },
    "mode": { "type": "string", "enum": ["control", "node2d"] },
    "accepts": { "type": "object", "properties": {
      "key": { "type": "string" },
      "values": { "type": "array", "items": { "type": "string" } } } },
    "on_drop": { "type": "string" },
    "notify": { "type": "object", "required": ["target", "method"], "properties": {
      "target": { "type": "string" },
      "method": { "type": "string" } } },
    "size": { "type": "object", "properties": { "width": { "type": "integer", "exclusiveMinimum": 0 }, "height": { "type": "integer", "exclusiveMinimum": 0 } } },
    "shape": { "type": "string", "enum": ["rectangle", "circle"] }
  } }
```
- **Output**
```json
{ "type": "object", "required": ["node_path", "mode", "script_path", "on_drop", "notified"],
  "properties": {
    "node_path": { "type": "string" },
    "mode": { "type": "string" },
    "script_path": { "type": "string" },
    "on_drop": { "type": "string" },
    "accepts_key": { "type": "string" },
    "accepts_values": { "type": "array", "items": { "type": "string" } },
    "notified": { "type": "boolean" },
    "area_path": { "type": ["string", "null"] }
  } }
```

---

## Destructive-action gating (elicitation) — Phase 4

Every tool flagged **destructive** accepts an optional `confirm: boolean`. When it is omitted, the host issues an MCP **elicitation** (a client-side confirmation prompt) before executing: on *accept* it proceeds; on *decline/cancel* it returns a non-error "cancelled" result. If the client does not support elicitation, the tool blocks and instructs the caller to re-invoke with `confirm: true` — so a destructive op is never executed silently. **The gated set is DERIVED from the `destructiveHint` annotation this document's own tables publish, not enumerated here**: at registration, every tool annotated destructive that does not already declare `confirm` is given the parameter and the gate, so the two sets cannot drift apart and a partial list cannot go stale. Two shapes sit outside the prompt and say so in the reply: a call refused **before** the gate because it can never legally succeed (`resolveInsideProject` on a path outside the project), and `asset_gen_*` with no backend configured, which returns `no_backend` having written nothing.

The long-running tools (`godot_export`, `godot_import`, `godot_run_headless_script`) run under the formal MCP **task-execution model** (D2), registered with `taskSupport: 'optional'`. A task-aware client calls the tool with a `task` augmentation to get a task handle back immediately, then drives it with the task methods its negotiated revision defines — polling status, and cancelling to stop the run, which aborts the underlying headless Godot process. The verbs are the client’s side of the wire and they move between revisions, so this page names the capability rather than the RPC. A plain client that omits the `task` augmentation is unaffected: the host auto-creates a task, polls it to completion, and returns the result synchronously, exactly as before.

---

# Plane B — Managed Process & Console Capture  (✅ implemented — Phase 4; host-side piped stdio for transparent `print()`/error capture)

### `godot_run_managed` ✅
Run the project as a managed child process with captured stdout/stderr (unlike `godot_run_project`, whose output is not captured). **Waits for the runtime bridge and reports `bridge_ready`**, exactly as `godot_run_project` does. **Refuses when the runtime bridge port is already bound**, for the same reason as `godot_run_project` — and note the managed child's own `push_error("could not listen…")` lands in `godot_output`, so the failure is legible after the fact but only if someone reads for it.
- **Input**
```json
{ "type": "object", "additionalProperties": false,
  "properties": {
    "scene": { "type": "string", "description": "optional res:// scene" },
    "allow_port_conflict": { "type": "boolean", "default": false, "description": "start even though the runtime bridge port is bound; the new game's bridge will be unreachable" },
    "wait_timeout_ms": { "type": "integer", "minimum": 0, "default": 15000, "description": "how long to wait for the runtime bridge to answer ping; 0 returns as soon as the process is spawned" } } }
```
- **Output**
```json
{ "type": "object", "required": ["id", "running", "bridge_ready"],
  "properties": {
    "id": { "type": "string" }, "pid": { "type": ["integer", "null"] },
    "running": { "type": "boolean" }, "scene": { "type": ["string", "null"] },
    "bridge_ready": { "type": "boolean" }, "bridge_wait_ms": { "type": "integer" },
    "bridge_note": { "type": ["string", "null"] } } }
```
> The twin's readiness fields mean what they mean on `godot_run_project`. The row `run-project-returns-before-bridge` named only that tool; this one had the same defect with nothing naming it, which is why check 30 finds launchers by the spawn rather than by a list.

### `godot_output` ✅
Read captured console output for a managed process.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["id"],
  "properties": {
    "id": { "type": "string" },
    "since_seq": { "type": "integer", "default": 0 },
    "stream": { "enum": ["stdout", "stderr", "both"], "default": "both" } } }
```
- **Output**
```json
{ "type": "object", "required": ["id", "lines"],
  "properties": {
    "id": { "type": "string" }, "exited": { "type": "boolean" },
    "exit_code": { "type": ["integer", "null"] },
    "signal": { "type": ["string", "null"], "description": "the signal that ended the child (e.g. SIGKILL), null otherwise" },
    "latest_seq": { "type": "integer" },
    "lines": { "type": "array", "items": { "type": "object", "properties": {
      "seq": { "type": "integer" }, "stream": { "enum": ["stdout", "stderr"] }, "text": { "type": "string" } } } } } }
```

### `godot_stop` ✔ ✅
Terminate a managed process.
- **Input**
```json
{ "type": "object", "additionalProperties": false, "required": ["id"], "properties": { "id": { "type": "string" } } }
```
- **Output**
```json
{ "type": "object", "required": ["id", "stopped"], "properties": { "id": { "type": "string" }, "stopped": { "type": "boolean" } } }
```

---

# MCP Resources  (✅ implemented — Phase 4)

Read-mostly context Claude can pull on demand (clients may subscribe). Each degrades to `{ "available": false, "note": "..." }` when the editor/game isn't reachable.

| URI | mimeType | Source |
|---|---|---|
| `godot://scene-tree` | application/json | editor bridge — edited scene tree |
| `godot://editor-state` | application/json | editor bridge — edited scene + selection |
| `godot://runtime/tree` | application/json | runtime bridge — live SceneTree |
| `godot://runtime/log` | application/json | runtime bridge — log ring buffer |
| `godot://class/{name}` | application/json | editor bridge — ClassDB docs (URI template) |

## Resource subscriptions (D3)

The server advertises the `resources.subscribe` capability. A client may subscribe to (and unsubscribe
from) any of the URIs above; the host then pushes `notifications/resources/updated`
for a URI when its underlying source changes, so a subscriber re-reads only when needed instead of
polling. Change signals come from two sources. The **editor addon**: changing the node selection
updates `godot://editor-state`, and switching the edited scene updates both `godot://editor-state`
and `godot://scene-tree`. The **in-game runtime autoload**: when the running game's live SceneTree
gains, loses, or renames a node, it updates `godot://runtime/tree` (coalesced to at most one push per
frame regardless of how many nodes changed that frame). Non-subscribers are unaffected — the
pull-on-demand reads above behave exactly as before. The push travels over the same bridge socket as
an unsolicited `{"event":"resource.changed","uri":…}` line (no request `id`, so it never collides
with a request/response); only URIs a client has actually subscribed to are forwarded to that client.

The host also **coalesces** rapid updates per URI with a leading-edge + trailing-flush throttle: the
first change pushes immediately, then further changes inside a short window (default 50 ms, override
via `BREAKPOINT_RESOURCE_COALESCE_MS`; `0` disables it) collapse into at most one trailing push. Multiple
`updated` notifications are spec-harmless — the client just re-reads — so this only trims volume.

## Tool Index

**Reading the `Plane` column.** The backticked id is the tool's **toolset** — the exact string you put in `BREAKPOINT_TOOLSETS` to load it — derived from `host/src/toolsets.ts`, not typed here: `contract_check.py`'s check 4d refuses a cell naming a different group than the one the tool is registered in, a cell with no id at all, and an id `toolsets.ts` does not define. The letter after it is the authoring **group** this document is navigated by, and it stays prose: the two vocabularies are deliberately different shapes, since the one `editor` toolset spans groups A and C–K while group M is two toolsets — `netcode` and `backend`. Before the id was here the groups were verified by COUNT alone, and a tool moving between toolsets left every number in the tree green.

**Reading the `Destructive` column.** The **✔** is the tool's MCP `destructiveHint` annotation, exactly as it crosses the wire — *may overwrite or discard state the caller did not supply* — and it is derived from `host/src/annotations.ts`, not typed here: `contract_check.py`'s check 4 refuses a ✔ this file and that file disagree about, in either direction — and check 4c holds the same ✔ on each tool's own section heading to the same roster, so the table and the page cannot drift apart either. The words beside it say **what** the tool writes and are a note, not a flag. The two are different questions and this column used to conflate them: `undoable` describes how you get your work back, and a tool can be undoable and destructive at once.

**Reading the `Status` column.** The **⚠️** means the tool can answer *“<tool> is unsupported by the connected …”* instead of a result: it feature-detects a capability the connected engine, language server or debug adapter may not have, and returns a clear handled message rather than leaking a raw error. It is derived from `host/src/tools/*.ts`, not typed here — `contract_check.py`'s check 4e refuses a ⚠️ this file and that code disagree about, in either direction, and holds the same ⚠️ on each tool's own section heading to the same roster so the table and the page cannot drift apart. The **✅** and the words beside either glyph are prose and say *what* was observed on *which* build; a cell may carry both, because “works on 4.7” and “handled if the build lacks it” are two different facts. This was the last of the four columns to get a predicate: for its whole life it carried a glyph with no stated rule and nothing in the code to disagree with, and it said ✅ about every degrading tool outside the GDScript LSP plane — `dbg_goto` among them, whose own section below says no Godot build advertises the capability it needs.

| Tool | Plane | Status | Destructive |
|---|---|---|---|
| `breakpoint_doctor` | `cli` · B / CLI | ✅ | – |
| `godot_version` | `cli` · B / CLI | ✅ | – |
| `godot_launch_editor` | `cli` · B / CLI | ✅ | – |
| `godot_run_project` | `cli` · B / CLI | ✅ | – |
| `godot_export` | `cli` · B / CLI | ✅ | writes artifacts |
| `godot_import` | `cli` · B / CLI | ✅ | – |
| `godot_run_headless_script` | `cli` · B / CLI | ✅ | ✔ runs code |
| `editor_ping` | `editor` · A / Editor | ✅ | – |
| `editor_get_state` | `editor` · A / Editor | ✅ | – |
| `editor_undo` | `editor` · A / Editor | ✅ | – |
| `editor_redo` | `editor` · A / Editor | ✅ | – |
| `project_get_info` | `editor` · A / Editor | ✅ | – |
| `project_get_setting` | `editor` · A / Editor | ✅ | – |
| `project_set_setting` | `editor` · A / Editor | ✅ | ✔ |
| `scene_get_tree` | `editor` · A / Editor | ✅ | – |
| `scene_open` | `editor` · A / Editor | ✅ | – |
| `scene_save` | `editor` · A / Editor | ✅ | writes file |
| `scene_new` | `editor` · A / Editor | ✅ | ✔ writes file |
| `scene_list_open` | `editor` · A / Editor | ✅ | – |
| `scene_reload` | `editor` · A / Editor | ✅ | ✔ |
| `scene_close` | `editor` · A / Editor | ✅ | ✔ |
| `scene_pack` | `editor` · A / Editor | ✅ | ✔ writes file |
| `scene_get_dependencies` | `editor` · A / Editor | ✅ | – |
| `scene_save_as` | `editor` · A / Editor | ✅ | ✔ writes file |
| `node_add` | `editor` · A / Editor | ✅ | undoable |
| `node_delete` | `editor` · A / Editor | ✅ | ✔ undoable |
| `node_rename` | `editor` · A / Editor | ✅ | undoable |
| `node_reparent` | `editor` · A / Editor | ✅ | undoable |
| `node_set_property` | `editor` · A / Editor | ✅ | undoable |
| `node_get_property` | `editor` · A / Editor | ✅ | – |
| `node_duplicate` | `editor` · A / Editor | ✅ | undoable |
| `node_get_children` | `editor` · A / Editor | ✅ | – |
| `node_find` | `editor` · A / Editor | ✅ | – |
| `node_list_groups` | `editor` · A / Editor | ✅ | – |
| `node_add_to_group` | `editor` · A / Editor | ✅ | undoable |
| `node_remove_from_group` | `editor` · A / Editor | ✅ | ✔ undoable |
| `node_instantiate_scene` | `editor` · A / Editor | ✅ | undoable |
| `node_move_child` | `editor` · A / Editor | ✅ | undoable |
| `node_change_type` | `editor` · A / Editor | ✅ | ✔ undoable |
| `node_set_owner` | `editor` · A / Editor | ✅ | undoable |
| `node_set_editable_instance` | `editor` · A / Editor | ✅ | undoable |
| `node_call_method` | `editor` · A / Editor | ✅ | ✔ |
| `node_get_path` | `editor` · A / Editor | ✅ | – |
| `node_list_properties` | `editor` · A / Editor | ✅ | – |
| `signal_list` | `editor` · A / Editor | ✅ | – |
| `signal_list_connections` | `editor` · A / Editor | ✅ | – |
| `signal_connect` | `editor` · A / Editor | ✅ | undoable |
| `signal_disconnect` | `editor` · A / Editor | ✅ | ✔ undoable |
| `signal_add_user_signal` | `editor` · A / Editor | ✅ | undoable |
| `signal_emit` | `editor` · A / Editor | ✅ | ✔ |
| `selection_get` | `editor` · A / Editor | ✅ | – |
| `selection_set` | `editor` · A / Editor | ✅ | – |
| `main_screen_get` | `editor` · A / Editor | ✅ | – |
| `main_screen_set` | `editor` · A / Editor | ✅ | – |
| `classdb_get_class` | `editor` · A / Editor | ✅ | – |
| `screenshot_editor` | `editor` · A / Editor | ✅ | – |
| `resource_create` | `editor` · A / Editor | ✅ | ✔ writes file |
| `resource_load` | `editor` · A / Editor | ✅ | – |
| `resource_save` | `editor` · A / Editor | ✅ | ✔ writes file |
| `resource_duplicate` | `editor` · A / Editor | ✅ | ✔ writes file |
| `resource_get_property` | `editor` · A / Editor | ✅ | – |
| `resource_set_property` | `editor` · A / Editor | ✅ | ✔ writes file |
| `resource_get_import_settings` | `editor` · A / Editor | ✅ | – |
| `resource_set_import_settings` | `editor` · A / Editor | ✅ | ✔ reimports |
| `filesystem_list` | `editor` · A / Editor | ✅ | – |
| `filesystem_scan` | `editor` · A / Editor | ✅ | – |
| `filesystem_move` | `editor` · A / Editor | ✅ | ✔ moves file |
| `filesystem_create_dir` | `editor` · A / Editor | ✅ | writes dir |
| `anim_player_create` | `editor` · C / Editor | ✅ | – |
| `anim_create` | `editor` · C / Editor | ✅ | – |
| `anim_delete` | `editor` · C / Editor | ✅ | ✔ gated |
| `anim_add_track` | `editor` · C / Editor | ✅ | – |
| `anim_insert_key` | `editor` · C / Editor | ✅ | – |
| `anim_remove_key` | `editor` · C / Editor | ✅ | ✔ removes key |
| `anim_set_length` | `editor` · C / Editor | ✅ | – |
| `anim_set_loop` | `editor` · C / Editor | ✅ | – |
| `anim_get_track_keys` | `editor` · C / Editor | ✅ | – |
| `anim_list` | `editor` · C / Editor | ✅ | – |
| `anim_tree_create` | `editor` · C / Editor | ✅ | – |
| `anim_tree_add_node` | `editor` · C / Editor | ✅ | – |
| `anim_statemachine_add_state` | `editor` · C / Editor | ✅ | – |
| `anim_statemachine_add_transition` | `editor` · C / Editor | ✅ | – |
| `tileset_create` | `editor` · D / Editor | ✅ | ✔ writes file |
| `tileset_add_source` | `editor` · D / Editor | ✅ | writes file |
| `tileset_add_tile` | `editor` · D / Editor | ✅ | writes file |
| `tileset_set_tile_collision` | `editor` · D / Editor | ✅ | ✔ writes file |
| `tilemaplayer_create` | `editor` · D / Editor | ✅ | undoable |
| `tilemap_set_cell` | `editor` · D / Editor | ✅ | ✔ undoable |
| `tilemap_set_cells_rect` | `editor` · D / Editor | ✅ | ✔ undoable |
| `tilemap_get_cell` | `editor` · D / Editor | ✅ | – |
| `tilemap_clear` | `editor` · D / Editor | ✅ | ✔ undoable |
| `body_create` | `editor` · E / Editor | ✅ | undoable |
| `collisionshape_add` | `editor` · E / Editor | ✅ | undoable |
| `body_set_collision_layer` | `editor` · E / Editor | ✅ | undoable |
| `body_set_collision_mask` | `editor` · E / Editor | ✅ | undoable |
| `area_set_monitoring` | `editor` · E / Editor | ✅ | undoable |
| `area_set_gravity` | `editor` · E / Editor | ✅ | undoable |
| `joint_create` | `editor` · E / Editor | ✅ | undoable |
| `joint_set_bodies` | `editor` · E / Editor | ✅ | undoable |
| `collisionpolygon_add` | `editor` · E / Editor | ✅ | undoable |
| `rigidbody_set_properties` | `editor` · E / Editor | ✅ | undoable |
| `body_set_physics_material` | `editor` · E / Editor | ✅ | undoable |
| `physics_set_gravity` | `editor` · E / Editor | ✅ | ✔ writes setting |
| `particles_create` | `editor` · F / Editor | ✅ | undoable |
| `particles_set_process_material` | `editor` · F / Editor | ✅ | undoable |
| `particles_set_amount` | `editor` · F / Editor | ✅ | undoable |
| `particles_set_lifetime` | `editor` · F / Editor | ✅ | undoable |
| `particles_set_emitting` | `editor` · F / Editor | ✅ | undoable |
| `particles_set_texture` | `editor` · F / Editor | ✅ | undoable |
| `shader_create` | `editor` · F / Editor | ✅ | ✔ writes file |
| `shader_set_code` | `editor` · F / Editor | ✅ | ✔ writes file |
| `shadermaterial_create` | `editor` · F / Editor | ✅ | ✔ undoable |
| `shadermaterial_set_shader` | `editor` · F / Editor | ✅ | ✔ undoable |
| `shadermaterial_set_param` | `editor` · F / Editor | ✅ | ✔ undoable |
| `audio_player_create` | `editor` · F / Editor | ✅ | undoable |
| `audio_set_stream` | `editor` · F / Editor | ✅ | undoable |
| `audio_bus_add` | `editor` · F / Editor | ✅ | project-wide |
| `audio_bus_add_effect` | `editor` · F / Editor | ✅ | project-wide |
| `audio_bus_set_volume` | `editor` · F / Editor | ✅ | ✔ project-wide |
| `audio_set_bus_layout` | `editor` · F / Editor | ✅ | ✔ writes file |
| `control_create` | `editor` · G / Editor | ✅ | undoable |
| `container_add_child` | `editor` · G / Editor | ✅ | undoable |
| `control_set_anchors` | `editor` · G / Editor | ✅ | undoable |
| `control_set_layout_preset` | `editor` · G / Editor | ✅ | undoable |
| `control_set_size_flags` | `editor` · G / Editor | ✅ | undoable |
| `control_set_theme` | `editor` · G / Editor | ✅ | undoable |
| `theme_create` | `editor` · G / Editor | ✅ | ✔ writes file |
| `theme_set_color` | `editor` · G / Editor | ✅ | ✔ writes file |
| `theme_set_font` | `editor` · G / Editor | ✅ | ✔ writes file |
| `theme_set_stylebox` | `editor` · G / Editor | ✅ | ✔ writes file |
| `theme_set_constant` | `editor` · G / Editor | ✅ | ✔ writes file |
| `meshinstance_create` | `editor` · H / Editor | ✅ | undoable |
| `mesh_set_surface_material` | `editor` · H / Editor | ✅ | undoable |
| `primitive_mesh_create` | `editor` · H / Editor | ✅ | ✔ writes file |
| `light_create` | `editor` · H / Editor | ✅ | undoable |
| `camera_create` | `editor` · H / Editor | ✅ | undoable |
| `csg_create` | `editor` · H / Editor | ✅ | undoable |
| `navregion_create` | `editor` · H / Editor | ✅ | undoable |
| `navagent_configure` | `editor` · H / Editor | ✅ | undoable |
| `environment_create` | `editor` · H / Editor | ✅ | ✔ writes file |
| `environment_set_sky` | `editor` · H / Editor | ✅ | ✔ writes file |
| `inputmap_add_action` | `editor` · I / Editor | ✅ | ✔ writes setting |
| `inputmap_add_event` | `editor` · I / Editor | ✅ | writes setting |
| `inputmap_list` | `editor` · I / Editor | ✅ | – |
| `inputmap_erase_action` | `editor` · I / Editor | ✅ | ✔ writes setting |
| `project_add_autoload` | `editor` · I / Editor | ✅ | ✔ writes setting |
| `project_remove_autoload` | `editor` · I / Editor | ✅ | ✔ writes setting |
| `project_add_export_preset` | `editor` · I / Editor | ✅ | writes file |
| `project_set_main_scene` | `editor` · I / Editor | ✅ | ✔ writes setting |
| `project_list_settings` | `editor` · I / Editor | ✅ | – |
| `editorsettings_get_set` | `editor` · I / Editor | ✅ | ✔ on set |
| `test_detect` | `editor` · I / Editor | ✅ | – |
| `test_list` | `editor` · I / Editor | ✅ | – |
| `gd_completion` | `lsp` · D / LSP | ✅ | – |
| `gd_hover` | `lsp` · D / LSP | ✅ | – |
| `gd_definition` | `lsp` · D / LSP | ✅ | – |
| `gd_references` | `lsp` · D / LSP | ✅ | – |
| `gd_rename` | `lsp` · D / LSP | ✅ | ✔ |
| `gd_document_symbols` | `lsp` · D / LSP | ✅ | – |
| `gd_workspace_symbols` | `lsp` · D / LSP | ⚠️ engine-missing (handled) | – |
| `gd_diagnostics` | `lsp` · D / LSP | ✅ | – |
| `gd_signature_help` | `lsp` · D / LSP | ✅ | – |
| `gd_code_action` | `lsp` · D / LSP | ⚠️ engine-dependent (handled) | – |
| `gd_document_highlight` | `lsp` · D / LSP | ⚠️ 4.3 advertises false (handled) | – |
| `gd_type_definition` | `lsp` · D / LSP | ⚠️ 4.3 advertises false (handled) | – |
| `gd_implementation` | `lsp` · D / LSP | ⚠️ 4.3 advertises false (handled) | – |
| `gd_declaration` | `lsp` · D / LSP | ⚠️ confirmed live (4.3); handled if absent | – |
| `gd_folding_ranges` | `lsp` · D / LSP | ⚠️ 4.3 advertises false (handled) | – |
| `gd_document_link` | `lsp` · D / LSP | ⚠️ confirmed live (4.3); handled if absent | – |
| `gd_formatting` | `lsp` · D / LSP | ⚠️ 4.3 advertises false (handled) | – |
| `gd_document_color` | `lsp` · D / LSP | ⚠️ 4.3 advertises false (handled) | – |
| `gd_call_hierarchy` | `lsp` · D / LSP | ⚠️ engine-missing through 4.7 (handled) | – |
| `gd_semantic_tokens` | `lsp` · D / LSP | ⚠️ engine-missing through 4.7 (handled) | – |
| `cs_completion` | `cslsp` · D / C# LSP | ✅ | – |
| `cs_hover` | `cslsp` · D / C# LSP | ✅ | – |
| `cs_definition` | `cslsp` · D / C# LSP | ✅ | – |
| `cs_references` | `cslsp` · D / C# LSP | ✅ | – |
| `cs_rename` | `cslsp` · D / C# LSP | ✅ | ✔ |
| `cs_document_symbols` | `cslsp` · D / C# LSP | ✅ | – |
| `cs_workspace_symbols` | `cslsp` · D / C# LSP | ⚠️ OmniSharp implements it; handled if absent | – |
| `cs_signature_help` | `cslsp` · D / C# LSP | ✅ | – |
| `cs_diagnostics` | `cslsp` · D / C# LSP | ✅ | – |
| `cs_code_action` | `cslsp` · D / C# LSP | ⚠️ OmniSharp implements it; handled if absent | – |
| `dbg_launch` | `dap` · D / DAP | ✅ | runs code |
| `dbg_attach` | `dap` · D / DAP | ✅ | – |
| `dbg_set_breakpoints` | `dap` · D / DAP | ✅ | – |
| `dbg_continue` | `dap` · D / DAP | ✅ | – |
| `dbg_step` | `dap` · D / DAP | ✅ | – |
| `dbg_stack_trace` | `dap` · D / DAP | ✅ | – |
| `dbg_scopes` | `dap` · D / DAP | ✅ | – |
| `dbg_variables` | `dap` · D / DAP | ✅ | – |
| `dbg_evaluate` | `dap` · D / DAP | ✅ | ✔ arbitrary code |
| `dbg_watch` | `dap` · D / DAP | ✅ | – |
| `dbg_set_exception_breakpoints` | `dap` · D / DAP | ⚠️ no filters on Godot 4.3 (handled) | – |
| `dbg_set_variable` | `dap` · D / DAP | ⚠️ adapter-dependent (handled) | ✔ mutates state |
| `dbg_restart` | `dap` · D / DAP | ✅ | – |
| `dbg_goto` | `dap` · D / DAP | ⚠️ no Godot build advertises it (handled) | ✔ moves execution |
| `dbg_data_breakpoints` | `dap` · D / DAP | ⚠️ adapter-dependent (handled) | – |
| `cs_dbg_launch` | `csdap` · D / C# DAP | ✅ | runs code |
| `cs_dbg_attach` | `csdap` · D / C# DAP | ✅ | – |
| `cs_dbg_set_breakpoints` | `csdap` · D / C# DAP | ✅ | – |
| `cs_dbg_continue` | `csdap` · D / C# DAP | ✅ | – |
| `cs_dbg_step` | `csdap` · D / C# DAP | ✅ | – |
| `cs_dbg_stack_trace` | `csdap` · D / C# DAP | ✅ | – |
| `cs_dbg_scopes` | `csdap` · D / C# DAP | ✅ | – |
| `cs_dbg_variables` | `csdap` · D / C# DAP | ✅ | – |
| `cs_dbg_evaluate` | `csdap` · D / C# DAP | ✅ | ✔ arbitrary code |
| `cs_dbg_set_variable` | `csdap` · D / C# DAP | ⚠️ adapter-dependent (handled) | ✔ mutates state |
| `cs_dbg_watch` | `csdap` · D / C# DAP | ✅ | – |
| `cs_dbg_set_exception_breakpoints` | `csdap` · D / C# DAP | ⚠️ adapter-dependent (handled) | – |
| `cs_dbg_restart` | `csdap` · D / C# DAP | ✅ | – |
| `runtime_get_tree` | `runtime` · C / Runtime | ✅ | – |
| `runtime_get_property` | `runtime` · C / Runtime | ✅ | – |
| `runtime_set_property` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_call_method` | `runtime` · C / Runtime | ✅ | ✔ arbitrary invocation |
| `runtime_emit_signal` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_inject_input` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_get_monitors` | `runtime` · C / Runtime | ✅ | – |
| `runtime_screenshot` | `runtime` · C / Runtime | ✅ | – |
| `runtime_get_log` | `runtime` · C / Runtime | ✅ | – |
| `runtime_assert_node_state` | `runtime` · C / Runtime | ✅ | – |
| `runtime_assert_scene_structure` | `runtime` · C / Runtime | ✅ | – |
| `runtime_assert_perf` | `runtime` · C / Runtime | ✅ | – |
| `runtime_assert_screen_text` | `runtime` · C / Runtime | ✅ | – |
| `runtime_screenshot_diff` | `runtime` · C / Runtime | ✅ | – |
| `runtime_await_condition` | `runtime` · C / Runtime | ✅ | – |
| `runtime_anim_play` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_anim_stop` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_anim_get_state` | `runtime` · C / Runtime | ✅ | – |
| `runtime_node_add` | `runtime` · C / Runtime | ✅ | adds node |
| `runtime_node_remove` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_time_scale` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_step_frames` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_state_digest` | `runtime` · C / Runtime | ✅ | – |
| `runtime_seed_rng` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_spawn_peers` | `runtime` · C / Runtime | ✅ | – *(higher-trust: `code-execution`)* |
| `runtime_peer_stop` | `runtime` · C / Runtime | ✅ | ✔ |
| `runtime_peers_digest` | `runtime` · C / Runtime | ✅ | – |

| `godot_run_managed` | `processes` · B / Process | ✅ | – |
| `godot_output` | `processes` · B / Process | ✅ | – |
| `godot_stop` | `processes` · B / Process | ✅ | ✔ kills the running project |

| `project_search` | `knowledge` · K / Host | ✅ | – |
| `find_symbol` | `knowledge` · K / Host | ✅ | – |
| `find_usages` | `knowledge` · K / Host | ✅ | – |
| `example_snippet` | `knowledge` · K / Host | ✅ | – |
| `class_reference` | `editor` · K / Editor | ✅ | – |
| `docs_search` | `editor` · K / Editor | ✅ | – |

| `vcs_status` | `vcs` · L / Host | ✅ | – |
| `vcs_log` | `vcs` · L / Host | ✅ | – |
| `vcs_diff` | `vcs` · L / Host | ✅ | – |
| `vcs_show` | `vcs` · L / Host | ✅ | – |
| `vcs_branch_list` | `vcs` · L / Host | ✅ | – |
| `vcs_blame` | `vcs` · L / Host | ✅ | – |
| `vcs_add` | `vcs` · L / Host | ✅ | – |
| `vcs_commit` | `vcs` · L / Host | ✅ | – |
| `vcs_restore` | `vcs` · L / Host | ✅ | ✔ discards changes |
| `vcs_stash` | `vcs` · L / Host | ✅ | ✔ push + drop |
| `vcs_branch_create` | `vcs` · L / Host | ✅ | – |
| `vcs_switch` | `vcs` · L / Host | ✅ | – |

| `asset_gen_configure` | `assetgen` · J / Host | ✅ | – |
| `asset_gen_placeholder` | `assetgen` · J / Editor | ✅ | ✔ writes file |
| `asset_gen_sprite` | `assetgen` · J / Editor | ✅ | ✔ writes file |
| `asset_gen_texture` | `assetgen` · J / Editor | ✅ | ✔ writes file |
| `asset_gen_icon` | `assetgen` · J / Editor | ✅ | ✔ writes file |
| `asset_gen_audio_sfx` | `assetgen` · J / Editor | ✅ | ✔ writes file |
| `asset_gen_model` | `assetgen` · J / Editor | ✅ | ✔ writes file |

| `mp_add_spawner` | `netcode` · M / Editor | ✅ | undoable |
| `mp_add_synchronizer` | `netcode` · M / Editor | ✅ | undoable |
| `mp_set_authority` | `netcode` · M / Editor | ✅ | undoable |
| `mp_setup_enet_peer` | `netcode` · M / Editor | ✅ | ✔ writes file |
| `mp_setup_webrtc_peer` | `netcode` · M / Editor | ✅ | ✔ writes file |
| `mp_wire_rpc` | `netcode` · M / Editor | ✅ | ✔ writes file |
| `mp_scaffold_lobby` | `netcode` · M / Editor | ✅ | ✔ writes file |
| `backend_detect` | `backend` · M / Editor | ✅ | – |
| `backend_configure` | `backend` · M / Editor | ✅ | ✔ writes file |
| `leaderboard_scaffold` | `backend` · M / Editor | ✅ | ✔ writes file |
| `cloudsave_scaffold` | `backend` · M / Editor | ✅ | ✔ writes file |
| `auth_scaffold` | `backend` · M / Editor | ✅ | ✔ writes file |
| `card_template_create` | `tabletop` · N / Editor | ✅ | ✔ writes files |
| `card_instance` | `tabletop` · N / Editor | ✅ | – |
| `card_hand_layout` | `tabletop` · N / Editor | ✅ | – |
| `card_deck_from_table` | `tabletop` · N / Editor | ✅ | – |
| `card_set_face` | `tabletop` · N / Editor | ✅ | – |
| `board_create` | `tabletop` · N / Editor | ✅ | ✔ writes files |
| `board_place` | `tabletop` · N / Editor | ✅ | – |
| `board_tile_create` | `tabletop` · N / Editor | ✅ | ✔ writes files |
| `board_tile_place` | `tabletop` · N / Editor | ✅ | – |
| `piece_template_create` | `tabletop` · N / Editor | ✅ | ✔ writes files |
| `piece_instance` | `tabletop` · N / Editor | ✅ | – |
| `piece_move` | `tabletop` · N / Editor | ✅ | – |
| `interact_make_draggable` | `tabletop` · N / Editor | ✅ | ✔ writes files |
| `interact_add_drop_zone` | `tabletop` · N / Editor | ✅ | ✔ writes files |

**292 tools + 6 MCP resources implemented across Phases 0–4, spanning all four planes — headless CLI + host-side tools (`godot_*`, knowledge/search, and version control `vcs_*`), the live editor bridge (Groups A–N), semantic (LSP) + debugging (DAP) for both GDScript and C#, and the runtime bridge. Destructive tools are elicitation-gated; long jobs run on the MCP task model. All four planes live.**
