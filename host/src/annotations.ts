/**
 * MCP tool annotations — the machine-readable risk/behaviour hints the spec
 * defines on `tools/list` (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
 * `openWorldHint`). Until 1.22.0 we published NONE of them, which left every
 * consumer — MCP clients deciding what to auto-approve, and third-party policy
 * catalogs building deny/allow rules — to infer risk from a tool's NAME. That
 * inference is unreliable in both directions: `tilemap_clear` and
 * `anim_remove_key` read as irreversible but are undoable through Godot's
 * EditorUndoRedoManager, while `navagent_configure` reads as a setter and in
 * fact ADDS a node. A public 2026-07 catalog got both wrong. Annotations make
 * the honest answer machine-readable instead of guessable.
 *
 * These are HINTS, not enforcement. The real controls stay where they were:
 * default-OFF capability groups (`capabilities.ts`), elicitation-gated
 * destructive ops (`confirm.ts`), the per-project bridge secret, loopback-only
 * sockets, and Godot's undo stack. Annotations describe that posture; they do
 * not implement it. Per spec, a client MUST NOT treat them as a security
 * guarantee from an untrusted server.
 *
 * Classification rules (applied per tool against its handler + the GDScript
 * operation it calls, not against its name):
 *   • readOnlyHint    — the call mutates NOTHING: no scene/resource/project
 *     write, no file write, no process spawn, no debugger/runtime state change.
 *     Screenshot tools that return an in-memory buffer count as read-only;
 *     anything that writes a path does not.
 *   • destructiveHint — the call may overwrite or discard state the caller did
 *     not supply (delete, clear, in-place overwrite, unconditional
 *     `ResourceSaver.save` to an existing path, arbitrary invocation). Purely
 *     additive mutators are false even when confirmation-gated. Undoability does
 *     NOT make a tool non-destructive — the hint describes the call, and undo is
 *     a separate recovery path.
 *   • idempotentHint  — repeating the call with identical arguments adds no
 *     further effect (absolute setters and converging deletes are true;
 *     creators, appenders, steppers, and undo/redo are false).
 *   • openWorldHint   — the call reaches an entity outside this machine + this
 *     project. FALSE for every tool today: all four bridges are loopback, the
 *     asset-gen `command` backend spawns a LOCAL argv, and the backend_*
 *     scaffolds only WRITE GDScript that would later egress. Kept explicit so a
 *     future networked tool has to opt in here deliberately.
 *
 * Asserted total-and-correct against the registered surface by
 * `annotations.test.ts`, and re-checked in `scripts/contract_check.py` — a new
 * tool cannot ship unannotated.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Shape of the `annotations` block the SDK forwards onto `tools/list`. */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** Tools that mutate nothing. */
const READ_ONLY: readonly string[] = [
  "anim_get_track_keys", "anim_list", "backend_detect", "class_reference", "classdb_get_class", "cs_code_action",
  "cs_completion", "cs_dbg_scopes", "cs_dbg_stack_trace", "cs_dbg_variables", "cs_definition", "cs_diagnostics",
  "cs_document_symbols", "cs_hover", "cs_references", "cs_signature_help", "cs_workspace_symbols", "dbg_scopes",
  "dbg_stack_trace", "dbg_variables", "docs_search", "editor_get_state", "editor_ping", "example_snippet",
  "filesystem_list", "find_symbol", "find_usages", "gd_call_hierarchy", "gd_code_action", "gd_completion",
  "gd_declaration", "gd_definition", "gd_diagnostics", "gd_document_color", "gd_document_highlight",
  "gd_document_link", "gd_document_symbols", "gd_folding_ranges", "gd_formatting", "gd_hover", "gd_implementation",
  "gd_references", "gd_semantic_tokens", "gd_signature_help", "gd_type_definition", "gd_workspace_symbols",
  "godot_output", "godot_version", "inputmap_list", "main_screen_get", "node_find", "node_get_children", "node_get_path",
  "node_get_property", "node_list_groups", "node_list_properties", "project_get_info", "project_get_setting",
  "project_list_settings", "project_search", "resource_get_import_settings", "resource_get_property",
  "resource_load", "runtime_anim_get_state", "runtime_assert_node_state", "runtime_assert_perf",
  "runtime_assert_scene_structure", "runtime_assert_screen_text", "runtime_await_condition", "runtime_get_log",
  "runtime_get_monitors", "runtime_get_property", "runtime_get_tree", "runtime_screenshot",
  "runtime_peers_digest", "runtime_screenshot_diff", "runtime_state_digest", "scene_get_dependencies",
  "scene_get_tree", "scene_list_open", "screenshot_editor", "selection_get", "signal_list",
  "signal_list_connections", "test_detect", "test_list", "tilemap_get_cell", "vcs_blame", "vcs_branch_list",
  "vcs_diff", "vcs_log", "vcs_show", "vcs_status",
];

/** Tools that may overwrite or discard state the caller did not supply. */
const DESTRUCTIVE: readonly string[] = [
  "anim_delete", "anim_remove_key", "asset_gen_audio_sfx", "asset_gen_icon", "asset_gen_model",
  "asset_gen_placeholder", "asset_gen_sprite", "asset_gen_texture", "audio_bus_set_volume", "audio_set_bus_layout",
  "auth_scaffold", "backend_configure", "board_create", "board_tile_create", "card_template_create",
  "cloudsave_scaffold", "cs_dbg_evaluate", "cs_dbg_set_variable", "cs_rename", "dbg_evaluate", "dbg_goto",
  "dbg_set_variable", "editorsettings_get_set", "environment_create", "environment_set_sky", "filesystem_move",
  "gd_rename", "godot_run_headless_script", "godot_stop", "inputmap_add_action", "inputmap_erase_action",
  "interact_add_drop_zone", "interact_make_draggable", "leaderboard_scaffold", "mp_scaffold_lobby",
  "mp_setup_enet_peer", "mp_setup_webrtc_peer", "mp_wire_rpc", "node_call_method", "node_change_type",
  "node_delete", "node_remove_from_group", "physics_set_gravity", "piece_template_create", "primitive_mesh_create",
  "project_add_autoload", "project_remove_autoload", "project_set_main_scene", "project_set_setting",
  "resource_create", "resource_duplicate", "resource_save", "resource_set_import_settings",
  "resource_set_property", "runtime_anim_play", "runtime_anim_stop", "runtime_call_method", "runtime_emit_signal",
  "runtime_inject_input", "runtime_node_remove", "runtime_peer_stop", "runtime_seed_rng", "runtime_set_property",
  "runtime_step_frames", "runtime_time_scale", "scene_close", "scene_new", "scene_pack", "scene_reload", "scene_save_as", "shader_create",
  "shader_set_code", "shadermaterial_create", "shadermaterial_set_param", "shadermaterial_set_shader",
  "signal_disconnect", "signal_emit", "theme_create", "theme_set_color", "theme_set_constant", "theme_set_font",
  "theme_set_stylebox", "tilemap_clear", "tilemap_set_cell", "tilemap_set_cells_rect", "tileset_create",
  "vcs_restore", "vcs_stash",
];

/** Tools where a repeat call with identical arguments adds no further effect. */
const IDEMPOTENT: readonly string[] = [
  "anim_create", "anim_delete", "anim_get_track_keys", "anim_insert_key", "anim_list", "anim_set_length",
  "anim_set_loop", "anim_statemachine_add_state", "anim_statemachine_add_transition", "anim_tree_add_node",
  "area_set_gravity", "area_set_monitoring", "asset_gen_configure", "asset_gen_placeholder",
  "audio_bus_set_volume", "audio_set_bus_layout", "audio_set_stream", "auth_scaffold", "backend_configure",
  "backend_detect", "board_create", "board_place", "board_tile_create", "board_tile_place",
  "body_set_collision_layer", "body_set_collision_mask", "body_set_physics_material", "card_template_create",
  "class_reference", "classdb_get_class", "cloudsave_scaffold", "control_set_anchors", "control_set_layout_preset",
  "control_set_size_flags", "control_set_theme", "cs_code_action", "cs_completion", "cs_dbg_attach",
  "cs_dbg_scopes", "cs_dbg_set_breakpoints", "cs_dbg_set_exception_breakpoints", "cs_dbg_set_variable",
  "cs_dbg_stack_trace", "cs_dbg_variables", "cs_dbg_watch", "cs_definition", "cs_diagnostics",
  "cs_document_symbols", "cs_hover", "cs_references", "cs_rename", "cs_signature_help", "cs_workspace_symbols",
  "dbg_attach", "dbg_data_breakpoints", "dbg_goto", "dbg_scopes", "dbg_set_breakpoints",
  "dbg_set_exception_breakpoints", "dbg_set_variable", "dbg_stack_trace", "dbg_variables", "dbg_watch",
  "docs_search", "editor_get_state", "editor_ping", "editorsettings_get_set", "environment_create",
  "environment_set_sky", "example_snippet", "filesystem_create_dir", "filesystem_list", "filesystem_move",
  "filesystem_scan", "find_symbol", "find_usages", "gd_call_hierarchy", "gd_code_action", "gd_completion",
  "gd_declaration", "gd_definition", "gd_diagnostics", "gd_document_color", "gd_document_highlight",
  "gd_document_link", "gd_document_symbols", "gd_folding_ranges", "gd_formatting", "gd_hover", "gd_implementation",
  "gd_references", "gd_rename", "gd_semantic_tokens", "gd_signature_help", "gd_type_definition",
  "gd_workspace_symbols", "godot_export", "godot_import", "godot_output", "godot_stop", "godot_version",
  "inputmap_add_action", "inputmap_erase_action", "inputmap_list", "joint_set_bodies", "leaderboard_scaffold",
  "main_screen_get", "main_screen_set", "mesh_set_surface_material", "mp_scaffold_lobby", "mp_set_authority", "mp_setup_enet_peer",
  "mp_setup_webrtc_peer", "mp_wire_rpc", "node_add_to_group", "node_change_type", "node_delete", "node_find",
  "node_get_children", "node_get_path", "node_get_property", "node_list_groups", "node_list_properties",
  "node_move_child", "node_remove_from_group", "node_rename", "node_reparent", "node_set_editable_instance",
  "node_set_owner", "node_set_property", "particles_set_amount", "particles_set_emitting",
  "particles_set_lifetime", "particles_set_process_material", "particles_set_texture", "physics_set_gravity",
  "piece_template_create", "primitive_mesh_create", "project_add_autoload", "project_get_info",
  "project_get_setting", "project_list_settings", "project_remove_autoload", "project_search",
  "project_set_main_scene", "project_set_setting", "resource_create", "resource_duplicate",
  "resource_get_import_settings", "resource_get_property", "resource_load", "resource_save",
  "resource_set_import_settings", "resource_set_property", "rigidbody_set_properties", "runtime_anim_get_state",
  "runtime_anim_stop", "runtime_assert_node_state", "runtime_assert_perf", "runtime_assert_scene_structure",
  "runtime_assert_screen_text", "runtime_await_condition", "runtime_get_log", "runtime_get_monitors",
  "runtime_get_property", "runtime_get_tree", "runtime_node_remove", "runtime_peer_stop", "runtime_peers_digest",
  "runtime_screenshot", "runtime_screenshot_diff", "runtime_seed_rng", "runtime_set_property",
  "runtime_state_digest", "runtime_time_scale", "scene_get_dependencies", "scene_get_tree", "scene_list_open", "scene_new", "scene_open",
  "scene_pack", "scene_reload", "scene_save", "scene_save_as", "screenshot_editor", "selection_get",
  "selection_set", "shader_create", "shader_set_code", "shadermaterial_create", "shadermaterial_set_param",
  "shadermaterial_set_shader", "signal_add_user_signal", "signal_connect", "signal_disconnect", "signal_list",
  "signal_list_connections", "test_detect", "test_list", "theme_create", "theme_set_color", "theme_set_constant",
  "theme_set_font", "theme_set_stylebox", "tilemap_clear", "tilemap_get_cell", "tilemap_set_cell",
  "tilemap_set_cells_rect", "tileset_add_tile", "tileset_create", "vcs_add", "vcs_blame", "vcs_branch_list",
  "vcs_diff", "vcs_log", "vcs_restore", "vcs_show", "vcs_status", "vcs_switch",
];

/**
 * Tools that reach outside this machine + this project. Empty by design — every
 * bridge is loopback-only. A future networked tool must be listed here.
 */
const OPEN_WORLD: readonly string[] = [];

/**
 * The complete annotated roster — every registered tool, listed explicitly.
 *
 * This CANNOT be derived as the union of the four lists above: 52 tools are
 * all-false (mutating, non-destructive, non-idempotent, local — e.g. `node_add`,
 * `dbg_step`, `vcs_commit`), so a derived union would silently omit them and the
 * totality check below would pass while they shipped unannotated. Listing the
 * roster explicitly is what makes "every tool is annotated" an assertion rather
 * than a tautology.
 */
export const ALL_ANNOTATED: readonly string[] = [
  "anim_add_track", "anim_create", "anim_delete", "anim_get_track_keys", "anim_insert_key", "anim_list",
  "anim_player_create", "anim_remove_key", "anim_set_length", "anim_set_loop", "anim_statemachine_add_state",
  "anim_statemachine_add_transition", "anim_tree_add_node", "anim_tree_create", "area_set_gravity",
  "area_set_monitoring", "asset_gen_audio_sfx", "asset_gen_configure", "asset_gen_icon", "asset_gen_model",
  "asset_gen_placeholder", "asset_gen_sprite", "asset_gen_texture", "audio_bus_add", "audio_bus_add_effect",
  "audio_bus_set_volume", "audio_player_create", "audio_set_bus_layout", "audio_set_stream", "auth_scaffold",
  "backend_configure", "backend_detect", "board_create", "board_place", "board_tile_create", "board_tile_place",
  "body_create", "body_set_collision_layer", "body_set_collision_mask", "body_set_physics_material",
  "camera_create", "card_deck_from_table", "card_hand_layout", "card_instance", "card_set_face",
  "card_template_create", "class_reference", "classdb_get_class", "cloudsave_scaffold", "collisionpolygon_add",
  "collisionshape_add", "container_add_child", "control_create", "control_set_anchors",
  "control_set_layout_preset", "control_set_size_flags", "control_set_theme", "cs_code_action", "cs_completion",
  "cs_dbg_attach", "cs_dbg_continue", "cs_dbg_evaluate", "cs_dbg_launch", "cs_dbg_restart", "cs_dbg_scopes",
  "cs_dbg_set_breakpoints", "cs_dbg_set_exception_breakpoints", "cs_dbg_set_variable", "cs_dbg_stack_trace",
  "cs_dbg_step", "cs_dbg_variables", "cs_dbg_watch", "cs_definition", "cs_diagnostics", "cs_document_symbols",
  "cs_hover", "cs_references", "cs_rename", "cs_signature_help", "cs_workspace_symbols", "csg_create",
  "dbg_attach", "dbg_continue", "dbg_data_breakpoints", "dbg_evaluate", "dbg_goto", "dbg_launch", "dbg_restart",
  "dbg_scopes", "dbg_set_breakpoints", "dbg_set_exception_breakpoints", "dbg_set_variable", "dbg_stack_trace",
  "dbg_step", "dbg_variables", "dbg_watch", "docs_search", "editor_get_state", "editor_ping", "editor_redo",
  "editor_undo", "editorsettings_get_set", "environment_create", "environment_set_sky", "example_snippet",
  "filesystem_create_dir", "filesystem_list", "filesystem_move", "filesystem_scan", "find_symbol", "find_usages",
  "gd_call_hierarchy", "gd_code_action", "gd_completion", "gd_declaration", "gd_definition", "gd_diagnostics",
  "gd_document_color", "gd_document_highlight", "gd_document_link", "gd_document_symbols", "gd_folding_ranges",
  "gd_formatting", "gd_hover", "gd_implementation", "gd_references", "gd_rename", "gd_semantic_tokens",
  "gd_signature_help", "gd_type_definition", "gd_workspace_symbols", "godot_export", "godot_import",
  "godot_launch_editor", "godot_output", "godot_run_headless_script", "godot_run_managed", "godot_run_project",
  "godot_stop", "godot_version", "inputmap_add_action", "inputmap_add_event", "inputmap_erase_action",
  "inputmap_list", "interact_add_drop_zone", "interact_make_draggable", "joint_create", "joint_set_bodies",
  "leaderboard_scaffold", "light_create", "main_screen_get", "main_screen_set", "mesh_set_surface_material", "meshinstance_create", "mp_add_spawner",
  "mp_add_synchronizer", "mp_scaffold_lobby", "mp_set_authority", "mp_setup_enet_peer", "mp_setup_webrtc_peer",
  "mp_wire_rpc", "navagent_configure", "navregion_create", "node_add", "node_add_to_group", "node_call_method",
  "node_change_type", "node_delete", "node_duplicate", "node_find", "node_get_children", "node_get_path",
  "node_get_property", "node_instantiate_scene", "node_list_groups", "node_list_properties", "node_move_child",
  "node_remove_from_group", "node_rename", "node_reparent", "node_set_editable_instance", "node_set_owner",
  "node_set_property", "particles_create", "particles_set_amount", "particles_set_emitting",
  "particles_set_lifetime", "particles_set_process_material", "particles_set_texture", "physics_set_gravity",
  "piece_instance", "piece_move", "piece_template_create", "primitive_mesh_create", "project_add_autoload",
  "project_add_export_preset", "project_get_info", "project_get_setting", "project_list_settings",
  "project_remove_autoload", "project_search", "project_set_main_scene", "project_set_setting", "resource_create",
  "resource_duplicate", "resource_get_import_settings", "resource_get_property", "resource_load", "resource_save",
  "resource_set_import_settings", "resource_set_property", "rigidbody_set_properties", "runtime_anim_get_state",
  "runtime_anim_play", "runtime_anim_stop", "runtime_assert_node_state", "runtime_assert_perf",
  "runtime_assert_scene_structure", "runtime_assert_screen_text", "runtime_await_condition", "runtime_call_method",
  "runtime_emit_signal", "runtime_get_log", "runtime_get_monitors", "runtime_get_property", "runtime_get_tree",
  "runtime_inject_input", "runtime_node_add", "runtime_node_remove", "runtime_peer_stop", "runtime_peers_digest",
  "runtime_screenshot", "runtime_screenshot_diff", "runtime_seed_rng", "runtime_set_property",
  "runtime_spawn_peers", "runtime_state_digest", "runtime_step_frames", "runtime_time_scale", "scene_close",
  "scene_get_dependencies", "scene_get_tree",
  "scene_list_open", "scene_new", "scene_open", "scene_pack", "scene_reload", "scene_save", "scene_save_as",
  "screenshot_editor", "selection_get", "selection_set", "shader_create", "shader_set_code",
  "shadermaterial_create", "shadermaterial_set_param", "shadermaterial_set_shader", "signal_add_user_signal",
  "signal_connect", "signal_disconnect", "signal_emit", "signal_list", "signal_list_connections", "test_detect",
  "test_list", "theme_create", "theme_set_color", "theme_set_constant", "theme_set_font", "theme_set_stylebox",
  "tilemap_clear", "tilemap_get_cell", "tilemap_set_cell", "tilemap_set_cells_rect", "tilemaplayer_create",
  "tileset_add_source", "tileset_add_tile", "tileset_create", "tileset_set_tile_collision", "vcs_add", "vcs_blame",
  "vcs_branch_create", "vcs_branch_list", "vcs_commit", "vcs_diff", "vcs_log", "vcs_restore", "vcs_show",
  "vcs_stash", "vcs_status", "vcs_switch",
];

const readOnly = new Set(READ_ONLY);
const destructive = new Set(DESTRUCTIVE);
const idempotent = new Set(IDEMPOTENT);
const openWorld = new Set(OPEN_WORLD);

/**
 * Guard the one way this table can rot silently: a name typo'd into READ_ONLY /
 * DESTRUCTIVE / IDEMPOTENT that is not on the roster would otherwise annotate
 * nothing and fail no test. Throwing at module load turns that into an
 * immediate, obvious failure in every consumer, tests included.
 */
{
  const roster = new Set(ALL_ANNOTATED);
  const orphans = [...new Set([...READ_ONLY, ...DESTRUCTIVE, ...IDEMPOTENT, ...OPEN_WORLD])]
    .filter((n) => !roster.has(n))
    .sort();
  if (orphans.length) {
    throw new Error(`annotations.ts: name(s) in a hint list but absent from ALL_ANNOTATED: ${orphans.join(", ")}`);
  }
}


/** Every tool name carrying an annotation entry — the totality set for the tests. */
export const ANNOTATED_TOOLS: readonly string[] = Object.freeze([...ALL_ANNOTATED].sort());

/**
 * The four hints for one tool. Every registered tool resolves to a complete
 * block: absence from a list is a positive "false", never "unknown", so a
 * consumer never has to fall back to guessing from the name.
 */
export function annotationsFor(name: string): ToolAnnotations {
  return {
    readOnlyHint: readOnly.has(name),
    destructiveHint: destructive.has(name),
    idempotentHint: idempotent.has(name),
    openWorldHint: openWorld.has(name),
  };
}

/**
 * Wrap `server.registerTool` to inject the annotations block at registration.
 * Mirrors `applyOutputSchemas` / `applyCapabilities`; call once, after
 * `applyOutputSchemas` and before any `register*Tools()`. An explicit
 * `annotations` already on the config wins, so a call site can override.
 *
 * `title` is left alone — the SDK already promotes the top-level `title` to the
 * annotation of the same name, and duplicating it here would fight that.
 */
export function applyAnnotations(server: McpServer): void {
  const inject =
    (raw: (name: string, config: unknown, handler: unknown) => unknown) =>
    (name: string, config: unknown, handler: unknown) => {
      const cfg = config as Record<string, unknown> | undefined;
      if (cfg && cfg.annotations === undefined) {
        config = { ...cfg, annotations: annotationsFor(name) };
      }
      return raw(name, config, handler);
    };

  const s = server as unknown as {
    registerTool: (name: string, config: unknown, handler: unknown) => unknown;
    experimental?: { tasks?: { registerToolTask?: (name: string, config: unknown, handler: unknown) => unknown } };
  };

  s.registerTool = inject(s.registerTool.bind(server) as never);

  // D2 task-model tools (godot_export / godot_import / godot_run_headless_script)
  // register through experimental.tasks.registerToolTask, not registerTool —
  // annotate that path too or three tools ship hint-less.
  const tasks = s.experimental?.tasks;
  if (tasks?.registerToolTask) {
    tasks.registerToolTask = inject(tasks.registerToolTask.bind(tasks) as never);
  }
}
