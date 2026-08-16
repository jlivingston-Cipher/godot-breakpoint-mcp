@tool
extends RefCounted
## The next action, keyed by the error code the bridge already returns.
##
## 🔴 WHAT THIS FILE EXISTS TO FIX, MEASURED BEFORE IT WAS WRITTEN (session 254):
## 525 `_err()` sites across the two engine-facing planes emitted 216 distinct
## message templates, and 451 of those sites named NO next action. The three most
## emitted messages in the addon were "No scene is open" (90 sites), "Node not
## found: %s" (53) and "ResourceSaver.save() returned %d" (35) — a state report, a
## rejection with no way to discover the legal values, and a bare engine return
## code. Every one is a true sentence and none of them tells the reader what to do,
## which is the whole of what a failing tool owes an agent that cannot see the
## editor.
##
## 🔴 WHY THE REMEDY HANGS OFF THE CODE AND NOT THE MESSAGE. 216 message templates
## would be 216 hand-written remedies to keep true; the code vocabulary is 50, it is
## already machine-owned (contract_check reads it on both sides of the wire), and it
## is the axis the message VARIES within — every "X not found: %s" is one `not_found`
## with the same next action. So the remedy is attached where the join is checkable
## and the message keeps carrying the particulars.
##
## 🔴 AND THE TWO PLANES DO NOT SHARE ONE TABLE, DELIBERATELY. `bad_path` on the
## editor plane is answered by `scene_get_tree`; on the runtime plane by
## `runtime_get_tree`. A single table with a fallback would have to be wrong on one
## plane or vague on both, and the exact per-plane join is what lets the gate refuse
## a code with no remedy and a remedy no code raises — in both directions, per file.
##
## Every tool name written here is compared to the live `registerTool(..)` surface by
## contract_check check 28: a remedy naming a tool that was renamed or never existed
## is a dead instruction, and it is the failure this table would otherwise invite.

const EDITOR := "editor"
const RUNTIME := "runtime"

## operations.gd — the editor plane. Keys are exactly the codes `_err()` raises there.
const EDITOR_REMEDIES := {
	"bad_params": "Fix the parameter named above and call again — the message carries the accepted shape.",
	"no_scene": "Open a scene first: call `scene_open` with a res:// .tscn path, or `scene_list_open` to see what the editor already has open.",
	"bad_path": "Call `scene_get_tree` for the live node paths — they are relative to the open scene root — or `node_find` to search by name.",
	"not_found": "Check the name or res:// path exists: `filesystem_list` for files, `scene_get_tree` for nodes in the open scene.",
	"bad_type": "Pass a node or resource of the type named above — `scene_get_tree` reports each node's class and `classdb_get_class` describes it.",
	"save_failed": "Check the target path is inside the project and writable, then call again; the number is a Godot Error code.",
	"refused": "Act on a different node — this is refused by design, the message names the invariant, and no flag lifts it.",
	"unsupported": "Check the engine version with `godot_version` — this Godot build does not expose the API the tool needs.",
	"exists": "Choose a different name, or remove the existing one first.",
	"load_failed": "Call `filesystem_scan` to re-import, then call again — the path exists but did not load.",
	"no_signal": "Call `signal_list` for the signals the node actually declares.",
	"bad_track": "Call `anim_get_track_keys` for the animation's tracks and their indices.",
	"bad_root": "Create the right root first — `anim_tree_create` builds a blend tree or a state machine to add nodes to.",
	"no_history": "Make an edit through the bridge first — undo history exists per scope only once something has been recorded into it.",
	"pack_failed": "Call `node_set_owner` on the strays, then call again — every node in the branch must be owned by the scene root.",
	"no_method": "Call `classdb_get_class` for the methods the node's class declares.",
	"duplicate_failed": "Duplicate a node that is saved into the open scene, or call `resource_save` on the resource first.",
	"create_failed": "Check the parent and the name in the message, then call again.",
	"mkdir_failed": "Check the parent directory is inside the project and writable; `filesystem_create_dir` creates intermediate directories, and the number is a Godot Error code.",
	"bad_source": "Create an atlas source first with `tileset_add_source`; the id above is not one.",
	"unknown_method": "Re-run `breakpoint-mcp init --force`, then reopen the project — the addon installed here is older than the host and plain `init` skips an addon that is already present.",
	"bad_request": "Send the request again with the field the message names — it was empty or unparseable.",
	"no_viewport": "Switch the editor to the tab that owns that viewport with `main_screen_set`, then call again.",
	"no_texture": "Call `main_screen_set` to open the matching editor tab and let it draw, then call again.",
	"no_image": "Open the matching editor tab with `main_screen_set` so a frame is drawn, then call again.",
	"instantiate_failed": "Call `classdb_get_class` to check the class is instantiable before constructing it.",
	"bad_index": "Pass an index inside the range the message carries.",
	"not_current": "Call `scene_open` on the scene you mean first — only the current scene can be closed.",
	"bad_class": "Call `classdb_get_class` to check the class exists and is an instantiable Resource.",
	"not_imported": "Call `filesystem_scan` and try again with an asset the editor imported — only imported assets carry .import metadata.",
	"fs_error": "Check the project path is intact, then call `filesystem_scan` — the project filesystem could not be read.",
	"move_failed": "Check the destination directory exists and nothing is already at the target path; the number is a Godot Error code.",
	"bad_key": "Call `anim_get_track_keys` for the keys the track actually has.",
	"bad_texture": "Pass a res:// path that loads as a Texture2D — `resource_load` reports what a path loads as.",
	"no_tile_data": "Create the tile first with `tileset_add_tile`; there is none at that coordinate.",
	"too_large": "Split the call into smaller regions — the message carries the limit.",
	"write_failed": "Check the target path is inside the project and not read-only; the number is a Godot Error code.",
}

## runtime_bridge.gd — the running game. Keys are exactly the codes `_err()` raises
## there; the tools named are the `runtime_*` ones, because the editor's are answered
## by a different process.
const RUNTIME_REMEDIES := {
	"bad_path": "Call `runtime_get_tree` for the live node paths — they are relative to the running scene root.",
	"async_only": "Call this one through the async lane; `runtime_step_frames` and `runtime_await_condition` are dispatched there.",
	"no_viewport": "Call `godot_run_project`, then wait for `runtime_get_tree` to answer before capturing — the game has no viewport yet.",
	"no_texture": "Call `runtime_step_frames` to advance at least one frame, then call again.",
	"no_image": "Call `runtime_step_frames` to advance a frame, then call again — nothing has been rendered to read back.",
	"unknown_method": "Re-run `breakpoint-mcp init --force`, then relaunch the project — the addon running in the game is older than the host and plain `init` skips an addon that is already present.",
	"no_scene": "Set a main scene with `project_set_main_scene`, then run the project again — it is running with no current scene.",
	"no_method": "Call `runtime_get_property` or `godot://class` for what the running node's class declares.",
	"no_signal": "Call `runtime_get_tree` for the node, then `godot://class` for the signals its class declares.",
	"emit_failed": "Check the argument count and types against the signal's declaration, then emit again.",
	"bad_action": "Call `inputmap_list` for the actions the project declares before injecting one.",
	"bad_kind": "Pass one of the kinds the message lists to `runtime_inject_input`.",
	"bad_regex": "Simplify the pattern and call again — it did not compile as a Godot RegEx.",
	"bad_reference": "Pass a reference image the project can load — `runtime_screenshot` writes one you can diff against later.",
	"not_animation_player": "Call `runtime_get_tree` and pass the path of an AnimationPlayer node.",
	"no_animation": "Call `runtime_anim_get_state` for the animations the player actually holds.",
	"bad_scene": "Pass a res:// .tscn path that loads in the running project; `scene_get_dependencies` reports what a scene needs.",
	"bad_args": "Send the arguments the message names and call again.",
	"bad_type": "Pass a node of the type named above — `runtime_get_tree` reports each running node's class.",
	"not_a_node": "Call `runtime_get_tree` for the node paths — the one passed resolves to something that is not a Node.",
	"instantiate_failed": "Check the class or scene loads in the editor first — it would not instantiate in the running game.",
	"cannot_remove_root": "Call `runtime_node_remove` on a child instead, or `godot_stop` to end the run — the running scene root cannot be removed.",
	"no_tree": "Call `godot_run_project` and wait for it to bind, then call again — the game is not running.",
}


## The next action for `code` on `plane`, or "" when the plane raises no such code.
##
## Returning "" rather than a placeholder is deliberate: `_err` omits the field
## entirely when there is nothing to say, so a remedy that never arrives is visible
## as an absent key rather than as an empty instruction a reader has to judge.
static func remedy(code: String, plane: String) -> String:
	var table: Dictionary = RUNTIME_REMEDIES if plane == RUNTIME else EDITOR_REMEDIES
	return table.get(code, "")
