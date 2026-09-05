extends SceneTree
## Headless unit tests for the PURE, editor-independent logic in the Breakpoint
## MCP addon — the parts a real editor is NOT needed to exercise:
##   * the Variant <-> JSON codec (variant_json.gd), including the tagged-object
##     branches (Object/Resource/Unsupported/packed arrays) and decode fallbacks,
##   * the pure helpers in operations.gd: the {ok}/{err} envelope, node-path
##     resolution (_resolve/_path_of), SceneTree serialization (_serialize_node,
##     _descendants), the doc-URL / type-name helpers, _resource_class_ok, and _ping,
##   * the pure helpers in runtime_bridge.gd exercised WITHOUT entering the tree
##     (so no TCP socket opens): the {ok}/{err} envelope, _dispatch's ping /
##     unknown-method paths, _get_monitors key filtering, and the push_log /
##     _get_log ring buffer,
##   * the _base()-dependent runtime_bridge.gd handlers (get_tree / resolve /
##     path_of / serialize / get_property / set_property / call_method /
##     emit_signal) via a subclass that overrides _base() with an in-memory
##     scene fixture, so they run with no real SceneTree and no TCP socket, plus
##     inject_input (bad kind + action / key / mouse) on a plain instance.
##
## The editor-COUPLED handlers (every mutator that drives EditorInterface /
## EditorUndoRedoManager) are already covered end-to-end by the authoring-plane
## integration probe. This suite needs no editor and no bridge:
##   `godot --headless --path example --script res://tests/ops_unit_test.gd`
##
## ...with ONE documented exception. The live _screenshot capture needs a real
## rasterizer, and --headless selects the dummy one. Run WITHOUT --headless (a
## GUI session, or Xvfb + --rendering-driver opengl3) and the capture assertions
## execute; run with it and they are reported as OPS_UNIT_SKIP, never as passes.
## Set BREAKPOINT_TEST_REQUIRE_RENDER=1 to turn any non-capture into a hard fail —
## that is what the render-plane CI job does.
##
## Prints `OPS_UNIT_PASS` / `OPS_UNIT_FAIL` per assertion and a final
## `OPS_UNIT_SUMMARY pass=<n>/<total>` line, and quits non-zero if anything fails
## so a CI step can gate on it.
##
## A small LIVE-TREE phase runs in _process (frame 1, after _initialize): it needs
## a running SceneTree so `root` is active — nodes then actually enter the tree, so
## get_viewport() and absolute `/root/...` paths resolve, reaching branches the
## hermetic phase cannot (runtime_bridge._resolve's absolute branch + _screenshot).
## To keep the suite SOCKET-FREE anyway, _initialize frees the example's
## BreakpointRuntimeBridge autoload before that first frame (it is parented to root
## but not yet _ready), so its runtime TCP server never opens. The pure
## operations._resource_props helper and the _screenshot no_viewport guard stay in
## the hermetic _initialize phase.

const Ops := preload("res://addons/breakpoint_mcp/operations.gd")
const Codec := preload("res://addons/breakpoint_mcp/variant_json.gd")
const RB := preload("res://addons/breakpoint_mcp/runtime_bridge.gd")
const Dock := preload("res://addons/breakpoint_mcp/status_dock.gd")

## A runtime_bridge subclass whose _base() returns a caller-set in-memory
## fixture root instead of get_tree().current_scene, so the _base()-dependent
## handlers (_get_tree / _resolve / _path_of / _serialize / _get_property /
## _set_property / _call_method / _emit_signal) run WITHOUT entering the live
## SceneTree — an RB.new() added to a real tree would fire _ready() and open the
## runtime TCP server. Only editor-free logic is exercised.
class _FixtureRuntimeBridge extends RB:
	var fixture_base: Node = null
	func _base() -> Node:
		return fixture_base

## A runtime_bridge subclass whose _ready() is a no-op, so it can be added to the
## LIVE SceneTree (to exercise get_viewport() and absolute-path resolution) WITHOUT
## opening the TCP socket that RB._ready() normally would. Used only by _process.
class _LiveRuntimeBridge extends RB:
	func _ready() -> void:
		pass

var _pass := 0
var _fail := 0
var _skip := 0
var _frame := 0

## The frame by which any live rasterizer has drawn into the root viewport.
## A viewport has no readable texture until something has actually been rendered
## into it, so probing on frame 1 would report "no image" on a perfectly healthy
## renderer — and we would be right back to a test that cannot tell a dummy
## driver from a real one, which is the whole bug being fixed here.
const _SHOT_FRAME := 5


func _initialize() -> void:
	# Free the example's BreakpointRuntimeBridge autoload BEFORE the first frame.
	# It is parented to `root` but not yet inside the active tree (its _ready has
	# not run), so freeing it now stops _ready() opening the runtime TCP socket
	# once the live-tree phase (_process) iterates a frame — keeping this suite
	# socket-free, the hermetic property it guards.
	var autoload := root.get_node_or_null("BreakpointRuntimeBridge")
	if autoload:
		autoload.free()
	var ops = Ops.new()  # untyped: only editor-free helpers are called (no setup(plugin))
	_test_codec()
	_test_codec_edges()
	_test_envelope(ops)
	_test_resolve_and_path(ops)
	_test_serialize(ops)
	_test_descendants(ops)
	_test_doc_helpers(ops)
	_test_resource_class_ok(ops)
	_test_ping(ops)
	_test_status_dock()                # pure dock helpers: config snippet + status text (hermetic)
	_test_runtime_envelope_and_dispatch()
	_test_runtime_log()
	_test_runtime_tree_handlers()
	_test_runtime_property_method_signal()
	_test_runtime_inject_input()
	_test_resource_props(ops)          # pure resource-property listing (hermetic)
	_test_import_settings_reporting(ops)  # import-settings REPORTING pair, 166 D3/D4 (hermetic)
	_test_scene_dependency_shape(ops)  # scene_get_dependencies split, 169 §5 (hermetic)
	_test_screenshot_no_viewport()     # runtime screenshot guard, detached (hermetic)
	_test_screenshot_window_guard()    # 311: the editor plane's window-drawing guard (hermetic)
	# Summary + quit are emitted from _process, after the live-tree phase runs.


func _process(_delta: float) -> bool:
	# LIVE-TREE phase, spread across a few frames. On the first real frame `root`
	# is active, so nodes added to it enter the tree (get_viewport / absolute
	# `/root/...` paths resolve) — reaching branches the hermetic phase cannot.
	# The runtime-bridge autoload was freed in _initialize, so no socket opens.
	#
	# The screenshot waits until _SHOT_FRAME on purpose: see that constant. Under
	# --headless the extra frames cost microseconds; under a real rasterizer they
	# are the difference between a meaningful result and a false negative.
	_frame += 1
	if _frame == 1:
		_test_live_resolve_absolute()
		return false
	if _frame < _SHOT_FRAME:
		return false
	_test_live_screenshot()

	# ── 🔴 THE POPULATION FLOOR (169 §6; 168 §8.5 asked for it, this suite earned it) ──
	#
	# This suite counted passes and failures and never counted CLAIMS. A GDScript runtime
	# error inside a test function aborts that function and the runner carries on: the
	# claims it had not yet reached leave the tally, `_fail` never moves, and the summary
	# prints a SMALLER total with a perfect pass rate.
	#
	# 🔴 THAT IS NOT HYPOTHETICAL — IT HAPPENED WHILE WRITING 169's OWN TESTS. Run against
	# the pre-fix addon, the thirteen new dependency assertions became one: the suite went
	# from 218/218 to a perfectly green 206/206. Twelve claims vanished, zero failed, and
	# the only thing that looked different was a number nobody was comparing to anything.
	#
	# The accessors were fixed so the claims speak (see `_rarray`). This is the backstop
	# for the next accessor nobody has thought about yet.
	#
	# 🔴 WHEN YOU ADD ASSERTIONS, RAISE THIS. A floor nobody maintains is a floor that
	# stopped measuring — and the failure message says so, because a floor that fails
	# without explaining itself gets deleted rather than updated.
	var total := _pass + _fail
	if total < OPS_UNIT_CLAIM_FLOOR:
		_fail += 1
		print("OPS_UNIT_FAIL population — only %d claim(s) ran, floor is %d. A SUITE THAT GOT SMALLER IS NOT A SUITE THAT GOT GREENER: assertions left the tally instead of failing (168 §5). If you deliberately removed assertions, lower OPS_UNIT_CLAIM_FLOOR in the same commit." % [total, OPS_UNIT_CLAIM_FLOOR])
		total = _pass + _fail

	print("OPS_UNIT_SUMMARY pass=%d/%d skip=%d floor=%d" % [_pass, total, _skip, OPS_UNIT_CLAIM_FLOOR])
	quit(0 if _fail == 0 else 1)
	return true


## The measured claim count of a complete run, session 169: 232 (was 205 at 1.9.6, plus
## the twenty-seven dependency assertions — fourteen against live scenes, thirteen against
## the splitter's own branches on synthetic input, every one of them added because a
## mutation survived without it (169 §7).
##
## 🔴 SET TWO BELOW THE MEASUREMENT, NOT AT IT. `skip` moves a claim out of pass/fail on
## a rasterizer that cannot capture, so a floor pinned exactly at the measurement would
## false-fail on a legitimate environment — and a floor that cries wolf is a floor
## somebody deletes.
##
## 🆕 311 — AND THE MEASUREMENT NOW DIFFERS BY ENVIRONMENT, SO THE FLOOR TAKES THE
## SMALLER ONE. The window-drawing guard splits this suite along the predicate it
## asserts: measured **243** under `--headless` (the refusal arms run — four on the
## editor plane, two on the runtime plane — and the capture is skipped) and **240**
## under Xvfb with a live rasterizer (those six do not run, the three capture
## assertions do). Both are complete runs. A floor is a claim about the SMALLER one,
## so it is two below 240 rather than two below 243 — pinning it to the headless
## reading would turn `render-plane` red for doing exactly what it exists to do.
const OPS_UNIT_CLAIM_FLOOR := 238


func _check(label: String, cond: bool) -> void:
	if cond:
		_pass += 1
		print("OPS_UNIT_PASS %s" % label)
	else:
		_fail += 1
		print("OPS_UNIT_FAIL %s" % label)


## A SKIP IS NOT A PASS. It exists so an environment that cannot exercise a path
## says so out loud, instead of banking a green check for the degradation branch
## and letting `pass=N/N` read as coverage. That substitution is precisely how the
## screenshot capture path went unexercised across seventeen releases.
func _skip_check(label: String, why: String) -> void:
	_skip += 1
	print("OPS_UNIT_SKIP %s (%s)" % [label, why])


## What the engine is actually rasterizing with, as the capture path experiences it.
##
## "dummy" is the --headless rasterizer: a viewport and a texture both exist, but
## get_image() yields null because nothing was ever drawn. It is the ONLY backend
## for which an empty capture is correct behaviour rather than a defect.
##
## Every other backend is expected to hand back a real frame — including Mesa
## llvmpipe under Xvfb, which is software but is a genuine rasterizer. Treating
## "software" and "cannot capture" as synonyms is the mistake that kept this
## uncovered; the dividing line is the dummy driver, not the absence of a GPU.
func _render_backend() -> String:
	if DisplayServer.get_name() == "headless":
		return "dummy"
	var adapter := RenderingServer.get_video_adapter_name()
	return adapter if adapter != "" else "unknown"


func _eq(label: String, got: Variant, want: Variant) -> void:
	_check("%s (got=%s want=%s)" % [label, str(got), str(want)], got == want)


func _roundtrip(label: String, v: Variant) -> void:
	_eq("codec.roundtrip.%s" % label, Codec.decode(Codec.encode(v)), v)


# --- status_dock.gd (pure helpers: MCP-client config snippet + status text) -
# Editor-free, socket-free: only the static helpers are called, so no Control is
# instantiated and no EditorInterface / clipboard / TCP is touched. Guards that
# the dock's copy-config snippet stays byte-compatible with the host `init` CLI.
func _test_status_dock() -> void:
	# Glyph vocabulary mirrors doctor's ✓ / ✗ / – (unknown states degrade to –).
	_eq("dock.glyph.ok", Dock.plane_glyph("ok"), "✓")
	_eq("dock.glyph.fail", Dock.plane_glyph("fail"), "✗")
	_eq("dock.glyph.pending", Dock.plane_glyph("pending"), "–")
	_eq("dock.glyph.unknown", Dock.plane_glyph("whatever"), "–")
	# Row text is "<glyph> <name>  <detail>" (two spaces before the detail).
	_eq("dock.line", Dock.plane_line("editor-bridge", "ok", "127.0.0.1:9080"), "✓ editor-bridge  127.0.0.1:9080")

	# The stdio server entry matches the host clients.ts serverEntry() default:
	# npx launcher, no GODOT_BIN (default), GODOT_PROJECT pointing at the project.
	var entry: Dictionary = Dock.server_entry("/tmp/proj")
	_eq("dock.entry.command", entry.get("command"), "npx")
	_eq("dock.entry.args.len", (entry.get("args") as Array).size(), 2)
	_eq("dock.entry.args0", entry["args"][0], "-y")
	_eq("dock.entry.args1", entry["args"][1], "breakpoint-mcp")
	_eq("dock.entry.project", (entry.get("env") as Dictionary).get("GODOT_PROJECT"), "/tmp/proj")
	_check("dock.entry.no_godot_bin", not (entry.get("env") as Dictionary).has("GODOT_BIN"))

	# The copy-pasteable snippet is valid JSON with the mcpServers → godot shape.
	var text: String = Dock.client_snippet("/tmp/proj")
	var parsed: Variant = JSON.parse_string(text)
	_check("dock.snippet.is_dict", typeof(parsed) == TYPE_DICTIONARY)
	if typeof(parsed) == TYPE_DICTIONARY:
		var servers: Dictionary = (parsed as Dictionary).get("mcpServers", {})
		_check("dock.snippet.has_godot", servers.has("godot"))
		var g: Dictionary = servers.get("godot", {})
		_eq("dock.snippet.command", g.get("command"), "npx")
		_eq("dock.snippet.args0", (g.get("args") as Array)[0], "-y")
		_eq("dock.snippet.project", (g.get("env") as Dictionary).get("GODOT_PROJECT"), "/tmp/proj")


# --- variant_json.gd -------------------------------------------------------
func _test_codec() -> void:
	# scalars pass straight through
	_eq("codec.int", Codec.encode(42), 42)
	_eq("codec.float", Codec.encode(1.5), 1.5)
	_eq("codec.bool", Codec.encode(true), true)
	_eq("codec.string", Codec.encode("hi"), "hi")
	_eq("codec.null", Codec.encode(null), null)
	_eq("codec.stringname", Codec.encode(&"foo"), "foo")
	# rich types encode to a tagged object
	var v3e: Variant = Codec.encode(Vector3(1, 2, 3))
	_eq("codec.vec3.tag", v3e.get("__type__"), "Vector3")
	_eq("codec.vec3.x", v3e.get("x"), 1)
	# lossless round-trips (values chosen to be exact in float32)
	_roundtrip("vec2", Vector2(3, 4))
	_roundtrip("vec2i", Vector2i(3, 4))
	_roundtrip("vec3", Vector3(1, 2, 3))
	_roundtrip("vec3i", Vector3i(1, 2, 3))
	_roundtrip("vec4", Vector4(1, 2, 3, 4))
	_roundtrip("color", Color(0.5, 0.25, 0.75, 1.0))
	_roundtrip("rect2", Rect2(1, 2, 3, 4))
	_roundtrip("quat", Quaternion(0, 0, 0, 1))
	_roundtrip("nodepath", NodePath("Player/Sprite2D"))
	# nested containers recurse
	var dec: Variant = Codec.decode(Codec.encode({"pos": Vector2(5, 6), "tags": [Vector2i(1, 1), "x"]}))
	_eq("codec.nested.pos", dec["pos"], Vector2(5, 6))
	_eq("codec.nested.tags0", dec["tags"][0], Vector2i(1, 1))
	_eq("codec.nested.tags1", dec["tags"][1], "x")


# --- operations.gd envelope ------------------------------------------------
func _test_envelope(ops) -> void:
	var okd: Dictionary = ops._ok({"a": 1})
	_eq("ok.ok", okd["ok"], true)
	_eq("ok.result", okd["result"]["a"], 1)
	var errd: Dictionary = ops._err("bad", "nope")
	_eq("err.ok", errd["ok"], false)
	_eq("err.code", errd["error"]["code"], "bad")
	_eq("err.msg", errd["error"]["message"], "nope")
	# 254 — a code with no remedy carries NO key, so the host renders what it always
	# rendered. contract_check check 28 proves the shipped vocabulary is covered; what
	# this proves is the shape of the miss, which is the half a source check cannot see.
	_check("err.no_remedy_key", not (errd["error"] as Dictionary).has("remedy"))
	# …and a code the table does know arrives with the next action attached, at the one
	# place every editor-plane failure passes through.
	var errd2: Dictionary = ops._err("no_scene", "No scene is open")
	_eq("err.remedy.msg_unchanged", errd2["error"]["message"], "No scene is open")
	_check("err.remedy_present", String((errd2["error"] as Dictionary).get("remedy", "")).begins_with("Open a scene first"))


# --- operations.gd node-path resolution ------------------------------------
func _test_resolve_and_path(ops) -> void:
	var root := Node.new()
	root.name = "Root"
	var player := Node.new()
	player.name = "Player"
	var sprite := Node.new()
	sprite.name = "Sprite2D"
	player.add_child(sprite)
	root.add_child(player)
	_check("resolve.empty->root", ops._resolve(root, "") == root)
	_check("resolve.dot->root", ops._resolve(root, ".") == root)
	_check("resolve.slashroot->root", ops._resolve(root, "/root") == root)
	_check("resolve.nested", ops._resolve(root, "Player/Sprite2D") == sprite)
	_check("resolve.missing->null", ops._resolve(root, "Nope") == null)
	_check("resolve.nullroot->null", ops._resolve(null, "x") == null)
	_eq("path.root", ops._path_of(root, root), ".")
	_eq("path.nested", ops._path_of(root, sprite), "Player/Sprite2D")
	root.free()


# --- operations.gd SceneTree serialization ---------------------------------
func _test_serialize(ops) -> void:
	var root := Node.new()
	root.name = "Root"
	var a := Node.new()
	a.name = "A"
	var a1 := Node.new()
	a1.name = "A1"
	var b := Node.new()
	b.name = "B"
	a.add_child(a1)
	root.add_child(a)
	root.add_child(b)
	var full: Dictionary = ops._serialize_node(root, root, 0, 64)
	_eq("ser.name", full["name"], "Root")
	_eq("ser.path", full["path"], ".")
	_eq("ser.child_count", full["child_count"], 2)
	_eq("ser.script_null", full["script"], null)
	_check("ser.has_children", full.has("children"))
	_eq("ser.children_len", (full["children"] as Array).size(), 2)
	var child_a: Dictionary = full["children"][0]
	_eq("ser.childA.name", child_a["name"], "A")
	_eq("ser.childA.path", child_a["path"], "A")
	_eq("ser.childA.child_count", child_a["child_count"], 1)
	_eq("ser.grandchild.path", child_a["children"][0]["path"], "A/A1")
	# max_depth truncation: at depth 0 with max_depth 0, children are omitted
	var shallow: Dictionary = ops._serialize_node(root, root, 0, 0)
	_check("ser.truncate.no_children_key", not shallow.has("children"))
	_eq("ser.truncate.child_count", shallow["child_count"], 2)
	root.free()


# --- operations.gd descendants ---------------------------------------------
func _test_descendants(ops) -> void:
	var root := Node.new()
	root.name = "Root"
	var a := Node.new()
	a.name = "A"
	var a1 := Node.new()
	a1.name = "A1"
	a.add_child(a1)
	root.add_child(a)
	_eq("descendants.count", (ops._descendants(root) as Array).size(), 2)
	root.free()


# --- operations.gd doc-URL / type-name helpers -----------------------------
func _test_doc_helpers(ops) -> void:
	_eq("type_name.class", ops._type_name({"class_name": "Sprite2D"}), "Sprite2D")
	_eq("type_name.nil", ops._type_name({"type": TYPE_NIL}), "Variant")
	_eq("type_name.int", ops._type_name({"type": TYPE_INT}), type_string(TYPE_INT))
	var base := "https://docs.godotengine.org/en/stable/classes/class_node.html"
	_eq("doc_url", ops._doc_url("Node"), base)
	_eq("doc_member_url", ops._doc_member_url("Node", "method", "add_child"), "%s#class-node-method-add-child" % base)
	_eq("doc_member_url.empty", ops._doc_member_url("Node", "method", ""), base)


# --- operations.gd _ping ---------------------------------------------------
func _test_ping(ops) -> void:
	var p: Dictionary = ops._ping()
	_eq("ping.pong", p["pong"], true)
	# Scope note: this proves _ping() SURFACES the constant, not that the constant
	# is current — it compares the value to itself and passes for any value. It sat
	# green while this copy's ADDON_VERSION was two releases stale. Staleness is
	# gated by contract_check.py check 14; do not "strengthen" this line to a
	# literal, which would just move the stale string somewhere else.
	_eq("ping.version", p["addon_version"], Ops.ADDON_VERSION)
	_check("ping.godot_nonempty", String(p["godot"]) != "")


# --- variant_json.gd tagged-object + decode-fallback branches --------------
func _test_codec_edges() -> void:
	# non-Resource Object -> {__type__:"Object", class:<class>}
	var n := Node.new()
	var ne: Variant = Codec.encode(n)
	_eq("codec.object.tag", ne.get("__type__"), "Object")
	_eq("codec.object.class", ne.get("class"), "Node")
	n.free()
	# Resource -> {__type__:"Resource", class, path}
	var r := Resource.new()
	var re: Variant = Codec.encode(r)
	_eq("codec.resource.tag", re.get("__type__"), "Resource")
	_eq("codec.resource.class", re.get("class"), "Resource")
	_eq("codec.resource.path_empty", re.get("path"), "")
	# an unhandled Variant type -> {__type__:"Unsupported", repr, type_id}
	var ue: Variant = Codec.encode(Transform3D())
	_eq("codec.unsupported.tag", ue.get("__type__"), "Unsupported")
	_eq("codec.unsupported.type_id", ue.get("type_id"), TYPE_TRANSFORM3D)
	_check("codec.unsupported.has_repr", ue.has("repr"))
	# Rect2 tagged fields
	var r2: Variant = Codec.encode(Rect2(1, 2, 3, 4))
	_eq("codec.rect2.tag", r2.get("__type__"), "Rect2")
	_eq("codec.rect2.x", r2.get("x"), 1)
	_eq("codec.rect2.y", r2.get("y"), 2)
	_eq("codec.rect2.w", r2.get("w"), 3)
	_eq("codec.rect2.h", r2.get("h"), 4)
	# packed arrays encode element-wise to a plain JSON array
	var pi: Variant = Codec.encode(PackedInt32Array([1, 2, 3]))
	_check("codec.packed_int.is_array", pi is Array)
	_eq("codec.packed_int.vals", pi, [1, 2, 3])
	_eq("codec.packed_string.vals", Codec.encode(PackedStringArray(["a", "b"])), ["a", "b"])
	var pv: Variant = Codec.encode(PackedVector2Array([Vector2(1, 2)]))
	_eq("codec.packed_vec2.tag", pv[0].get("__type__"), "Vector2")
	_eq("codec.packed_vec2.x", pv[0].get("x"), 1)
	# decode fallbacks all resolve to null
	_check("codec.decode.unknown_tag_null", Codec.decode({"__type__": "Bogus"}) == null)
	_check("codec.decode.object_tag_null", Codec.decode({"__type__": "Object", "class": "Node"}) == null)
	_check("codec.decode.resource_missing_null", Codec.decode({"__type__": "Resource", "path": "res://__nope__.tres"}) == null)
	# decode defaults: Color alpha -> 1.0, Quaternion w -> 1.0
	_eq("codec.decode.color_default_a", Codec.decode({"__type__": "Color", "r": 0.5, "g": 0.25, "b": 0.75}), Color(0.5, 0.25, 0.75, 1.0))
	_eq("codec.decode.quat_default_w", Codec.decode({"__type__": "Quaternion"}), Quaternion(0, 0, 0, 1))
	# decode int-casts Vector2i / Vector3i components
	_eq("codec.decode.vec2i", Codec.decode({"__type__": "Vector2i", "x": 3, "y": 4}), Vector2i(3, 4))
	_eq("codec.decode.vec3i", Codec.decode({"__type__": "Vector3i", "x": 1, "y": 2, "z": 3}), Vector3i(1, 2, 3))


# --- operations.gd _resource_class_ok --------------------------------------
func _test_resource_class_ok(ops) -> void:
	_check("rclass.image_true", ops._resource_class_ok("Image") == true)
	_check("rclass.node_false", ops._resource_class_ok("Node") == false)
	_check("rclass.missing_false", ops._resource_class_ok("NotAClass_123") == false)


# --- runtime_bridge.gd envelope + dispatch (no tree, no socket) -------------
func _test_runtime_envelope_and_dispatch() -> void:
	var rb = RB.new()  # NOT added to the tree: _ready() never runs, so no TCP server opens
	var okd: Dictionary = rb._ok({"a": 1})
	_eq("rb.ok.ok", okd["ok"], true)
	_eq("rb.ok.result", okd["result"]["a"], 1)
	var errd: Dictionary = rb._err("bad", "nope")
	_eq("rb.err.ok", errd["ok"], false)
	_eq("rb.err.code", errd["error"]["code"], "bad")
	_eq("rb.err.msg", errd["error"]["message"], "nope")
	_check("rb.err.no_remedy_key", not (errd["error"] as Dictionary).has("remedy"))
	# 254 — and the RUNTIME table, not the editor one: the same code answers with the
	# tool that exists in the running game. A single shared table would have had to be
	# wrong on one plane, which is why there are two and why this asserts the difference.
	var rerr: Dictionary = rb._err("bad_path", "Node not found: /root/x")
	_check("rb.err.remedy_runtime", String((rerr["error"] as Dictionary).get("remedy", "")).contains("runtime_get_tree"))
	var eerr: Dictionary = Ops.new()._err("bad_path", "Node not found: /root/x")
	_check("rb.err.remedy_planes_differ", String((eerr["error"] as Dictionary).get("remedy", "")).contains("scene_get_tree"))
	var pong: Dictionary = rb._dispatch("ping", {})
	_eq("rb.ping.ok", pong["ok"], true)
	_eq("rb.ping.pong", pong["result"]["pong"], true)
	_eq("rb.ping.runtime", pong["result"]["runtime"], true)
	_eq("rb.ping.capture_false", pong["result"]["log_capture"], false)
	_check("rb.ping.godot_nonempty", String(pong["result"]["godot"]) != "")
	var un: Dictionary = rb._dispatch("does.not.exist", {})
	_eq("rb.unknown.ok", un["ok"], false)
	_eq("rb.unknown.code", un["error"]["code"], "unknown_method")
	var mon: Dictionary = rb._get_monitors({"keys": ["time/fps"]})
	_check("rb.monitors.has_fps", (mon["result"]["monitors"] as Dictionary).has("time/fps"))
	var mon2: Dictionary = rb._get_monitors({"keys": ["bogus/nope"]})
	_eq("rb.monitors.unknown_empty", (mon2["result"]["monitors"] as Dictionary).size(), 0)
	rb.free()


# --- runtime_bridge.gd push_log / _get_log ring buffer ---------------------
func _test_runtime_log() -> void:
	var rb = RB.new()
	rb.push_log("info", "first")
	rb.push_log("warning", "second")
	rb.push_log("error", "third")
	var all: Dictionary = rb._get_log({})
	_eq("rb.log.count", (all["result"]["entries"] as Array).size(), 3)
	_eq("rb.log.latest_seq", all["result"]["latest_seq"], 3)
	_eq("rb.log.capture_false", all["result"]["capture"], false)
	_eq("rb.log.first_msg", all["result"]["entries"][0]["message"], "first")
	# since_seq filter: only entries with seq > since
	var since: Dictionary = rb._get_log({"since_seq": 2})
	_eq("rb.log.since.count", (since["result"]["entries"] as Array).size(), 1)
	_eq("rb.log.since.seq", since["result"]["entries"][0]["seq"], 3)
	# levels filter
	var lvl: Dictionary = rb._get_log({"levels": ["error"]})
	_eq("rb.log.levels.count", (lvl["result"]["entries"] as Array).size(), 1)
	_eq("rb.log.levels.msg", lvl["result"]["entries"][0]["message"], "third")
	rb.free()
	# ring buffer evicts oldest past LOG_CAP; latest_seq keeps counting
	var rb2 = RB.new()
	var total := RB.LOG_CAP + 5
	for i in range(total):
		rb2.push_log("info", "m%d" % i)
	var cap: Dictionary = rb2._get_log({})
	_eq("rb.log.cap.size", (cap["result"]["entries"] as Array).size(), RB.LOG_CAP)
	_eq("rb.log.cap.latest_seq", cap["result"]["latest_seq"], total)
	_eq("rb.log.cap.oldest_seq", cap["result"]["entries"][0]["seq"], total - RB.LOG_CAP + 1)
	rb2.free()


# --- runtime_bridge.gd _base()-dependent handlers (in-memory fixture) -------
func _test_runtime_tree_handlers() -> void:
	# In-memory fixture: Node2D "Root" -> Node2D "Child" -> Node "GC". A subclass
	# overrides _base() so the tree handlers run with no real SceneTree and no
	# socket (an RB.new() entering a tree would fire _ready() -> open the server).
	var root := Node2D.new()
	root.name = "Root"
	var child := Node2D.new()
	child.name = "Child"
	var gc := Node.new()
	gc.name = "GC"
	child.add_child(gc)
	root.add_child(child)
	var rb := _FixtureRuntimeBridge.new()
	# _get_tree with no current scene -> no_scene error
	rb.fixture_base = null
	var ns: Dictionary = rb._get_tree({})
	_eq("rb.tree.no_scene.ok", ns["ok"], false)
	_eq("rb.tree.no_scene.code", ns["error"]["code"], "no_scene")
	# _get_tree against the fixture -> serialized root
	rb.fixture_base = root
	var t: Dictionary = rb._get_tree({})
	var d: Dictionary = t["result"]
	_eq("rb.tree.ok", t["ok"], true)
	_eq("rb.tree.name", d["name"], "Root")
	_eq("rb.tree.type", d["type"], "Node2D")
	_eq("rb.tree.path", d["path"], ".")
	_eq("rb.tree.child_count", d["child_count"], 1)
	_eq("rb.tree.visible", d["visible"], true)  # Node2D is a CanvasItem
	_eq("rb.tree.children_len", (d["children"] as Array).size(), 1)
	_eq("rb.tree.grandchild_path", d["children"][0]["children"][0]["path"], "Child/GC")
	# max_depth 0 omits the children key
	var shallow: Dictionary = rb._get_tree({"max_depth": 0})
	_check("rb.tree.truncate", not (shallow["result"] as Dictionary).has("children"))
	# _resolve
	_check("rb.resolve.empty", rb._resolve("") == root)
	_check("rb.resolve.dot", rb._resolve(".") == root)
	_check("rb.resolve.nested", rb._resolve("Child/GC") == gc)
	_check("rb.resolve.missing", rb._resolve("Nope") == null)
	rb.fixture_base = null
	_check("rb.resolve.null_base", rb._resolve("x") == null)
	rb.fixture_base = root
	# _path_of
	_eq("rb.path_of.root", rb._path_of(root), ".")
	_eq("rb.path_of.nested", rb._path_of(gc), "Child/GC")
	# _dispatch routes to the tree handler
	_eq("rb.dispatch.get_tree", rb._dispatch("runtime.get_tree", {})["ok"], true)
	rb.free()
	root.free()


# --- runtime_bridge.gd get/set property, call, emit (in-memory fixture) -----
func _test_runtime_property_method_signal() -> void:
	var root := Node2D.new()
	root.name = "Root"
	var child := Node2D.new()
	child.name = "Child"
	root.add_child(child)
	var rb := _FixtureRuntimeBridge.new()
	rb.fixture_base = root
	# _get_property codec-encodes the value (Vector2 -> tagged object); bad path errors
	var gp: Dictionary = rb._get_property({"path": "Child", "property": "position"})
	_eq("rb.get_prop.ok", gp["ok"], true)
	_eq("rb.get_prop.tag", gp["result"]["value"]["__type__"], "Vector2")
	var gpb: Dictionary = rb._get_property({"path": "Nope", "property": "x"})
	_eq("rb.get_prop.bad_path", gpb["error"]["code"], "bad_path")
	# _set_property decodes the tagged value, applies it, re-encodes the readback
	var enc := {"__type__": "Vector2", "x": 10, "y": 20}
	var sp: Dictionary = rb._set_property({"path": "Child", "property": "position", "value": enc})
	_eq("rb.set_prop.ok", sp["ok"], true)
	_eq("rb.set_prop.readback_x", sp["result"]["value"]["x"], 10)
	_check("rb.set_prop.applied", child.position == Vector2(10, 20))
	var spb: Dictionary = rb._set_property({"path": "Nope", "property": "position", "value": enc})
	_eq("rb.set_prop.bad_path", spb["error"]["code"], "bad_path")
	# _call_method callv + codec-encoded return; unknown method + bad path error
	var cm: Dictionary = rb._call_method({"path": "", "method": "get_child_count", "args": []})
	_eq("rb.call.ok", cm["ok"], true)
	_eq("rb.call.return", cm["result"]["return"], 1)
	var cmn: Dictionary = rb._call_method({"path": "", "method": "no_such_method", "args": []})
	_eq("rb.call.no_method", cmn["error"]["code"], "no_method")
	var cmb: Dictionary = rb._call_method({"path": "Nope", "method": "get_child_count"})
	_eq("rb.call.bad_path", cmb["error"]["code"], "bad_path")
	# _emit_signal error paths, then a scripted-signal success (args decoded)
	var esn: Dictionary = rb._emit_signal({"path": "Child", "signal": "no_such_signal"})
	_eq("rb.emit.no_signal", esn["error"]["code"], "no_signal")
	var esb: Dictionary = rb._emit_signal({"path": "Nope", "signal": "x"})
	_eq("rb.emit.bad_path", esb["error"]["code"], "bad_path")
	var scr := GDScript.new()
	scr.source_code = "extends Node\nsignal ut_sig(x)\n"
	scr.reload()
	var sig_node: Node = scr.new()
	sig_node.name = "Sig"
	root.add_child(sig_node)
	var es: Dictionary = rb._emit_signal({"path": "Sig", "signal": "ut_sig", "args": [7]})
	_eq("rb.emit.ok", es["ok"], true)
	_eq("rb.emit.emitted", es["result"]["emitted"], true)
	# _dispatch routes to the property handler
	_eq("rb.dispatch.get_property", rb._dispatch("runtime.get_property", {"path": "Child", "property": "position"})["ok"], true)
	rb.free()
	root.free()


# --- runtime_bridge.gd _inject_input (no tree/base needed) -------------------
func _test_runtime_inject_input() -> void:
	var rb := RB.new()
	var bad: Dictionary = rb._inject_input({"event": {"kind": "bogus"}})
	_eq("rb.inject.bad_kind", bad["error"]["code"], "bad_kind")
	# action press/release — register the action first so no "unknown action" error
	if not InputMap.has_action("bp_unittest_action"):
		InputMap.add_action("bp_unittest_action")
	var ia: Dictionary = rb._inject_input({"event": {"kind": "action", "action": "bp_unittest_action", "pressed": true}})
	_eq("rb.inject.action", ia["result"]["injected"], true)
	var iar: Dictionary = rb._inject_input({"event": {"kind": "action", "action": "bp_unittest_action", "pressed": false}})
	_eq("rb.inject.action_release", iar["ok"], true)
	InputMap.erase_action("bp_unittest_action")
	# key / mouse_button / mouse_motion build InputEvent* and echo the kind
	var ik: Dictionary = rb._inject_input({"event": {"kind": "key", "keycode": KEY_A, "pressed": true}})
	_eq("rb.inject.key", ik["result"]["kind"], "key")
	var imb: Dictionary = rb._inject_input({"event": {"kind": "mouse_button", "button": 1, "pressed": true, "position": {"__type__": "Vector2", "x": 5, "y": 6}}})
	_eq("rb.inject.mouse_button", imb["result"]["kind"], "mouse_button")
	var imm: Dictionary = rb._inject_input({"event": {"kind": "mouse_motion", "position": {"__type__": "Vector2", "x": 1, "y": 2}, "relative": {"__type__": "Vector2", "x": 3, "y": 4}}})
	_eq("rb.inject.mouse_motion", imm["result"]["kind"], "mouse_motion")
	# _dispatch routes to inject_input (bad kind still routes, returns not-ok)
	_eq("rb.dispatch.inject_input", rb._dispatch("runtime.inject_input", {"event": {"kind": "bogus"}})["ok"], false)
	rb.free()


# --- operations.gd _resource_props (pure; editor-usage filter) --------------
func _test_resource_props(ops) -> void:
	# A tiny scripted Resource with two @export vars — @export forces
	# PROPERTY_USAGE_EDITOR, so both must appear; the built-in resource_* props are
	# editor-visible too. Verifies the usage filter keeps editor props and the shape.
	var scr := GDScript.new()
	scr.source_code = "extends Resource\n@export var hp: int = 3\n@export var label: String = \"x\"\n"
	scr.reload()
	var res: Resource = scr.new()
	var props: Array = ops._resource_props(res)
	var by_name := {}
	for p in props:
		by_name[String(p.get("name", ""))] = p
	_check("rprops.has_hp", by_name.has("hp"))
	_check("rprops.has_label", by_name.has("label"))
	if by_name.has("hp"):
		_eq("rprops.hp_type", by_name["hp"]["type"], TYPE_INT)
	if by_name.has("label"):
		_eq("rprops.label_type", by_name["label"]["type"], TYPE_STRING)
	# every returned prop passed the PROPERTY_USAGE_EDITOR filter and is non-nil
	var all_editor := true
	var all_typed := true
	for p in props:
		if (int(p.get("usage", 0)) & PROPERTY_USAGE_EDITOR) == 0:
			all_editor = false
		if int(p.get("type", TYPE_NIL)) == TYPE_NIL:
			all_typed = false
	_check("rprops.all_editor_usage", all_editor)
	_check("rprops.no_nil_types", all_typed)




## Reply-field readers that CANNOT abort the suite when the field is missing.
##
## 🔴 MEASURED, 168: deleting `changed` from the reply made `s1["result"]["changed"]`
## raise "Invalid access to property or key" — a SCRIPT ERROR that killed the run after
## the first failing claim, so 24 later assertions never executed and the mutation sweep
## classified a caught mutant as BROKEN. Same shape as the AUTH_RESOURCE_THREW problem in
## the authoring probe: a claim that cannot fail BY NAME reports nothing useful, and a
## suite that stops early reports a smaller universe rather than a failure. Both are
## 167 §4 — an assertion aimed at the wrong channel manufactures a verdict.
## 🔴 THE SENTINEL IS `null` AND THAT IS THE WHOLE POINT. The first version of these
## returned a descriptive String like "<no result.changed>", which read better in a log
## and was WRONG: comparing a String to the expected Array raises "Invalid operands" INSIDE
## the `_eq` argument list, so `_check` was never reached and the claim vanished from the
## tally instead of failing. Measured — deleting `changed` from the reply took the suite
## from 205/205 to a GREEN 200/200. That is 167 §7 exactly one level down: the population
## shrank, so coverage stayed 100%. `null` compares false against every expected value
## without raising, so a missing field FAILS THE CLAIM THAT NAMES IT.
func _rfield(reply: Variant, section: String, key: String) -> Variant:
	if not (reply is Dictionary) or not reply.has(section):
		return null
	var inner: Variant = reply[section]
	if not (inner is Dictionary) or not inner.has(key):
		return null
	return inner[key]


func _rok(reply: Variant) -> Variant:
	return reply["ok"] if (reply is Dictionary and reply.has("ok")) else null


## 🔴 A MISSING ARRAY FIELD MUST COMPARE FALSE, NOT RAISE (168 §5, re-earned in 169 §6).
##
## `_rfield` already returns null for an absent field — that fix is a session old. What
## bit anyway was the CALL SITE: `var deps: Array = _rfield(...)` is a TYPED assignment,
## and a typed assignment raises on null exactly like the descriptive-String sentinel
## 168 replaced. Measured: running 169's thirteen new dependency assertions against the
## PRE-FIX addon took this suite from 218/218 to a perfectly green 206/206 — twelve
## claims left the tally instead of failing, and the pass rate stayed 100%.
##
## So reach for reply arrays through here. An absent or wrongly-typed field yields an
## EMPTY ARRAY, every downstream claim still speaks, and it speaks the word FAIL.
func _rarray(reply: Variant, section: String, key: String) -> Array:
	var v: Variant = _rfield(reply, section, key)
	return v if v is Array else []


## Same rule for indexing: an out-of-range read answers "" rather than raising, so a
## claim about element 0 of an array that came back empty FAILS BY NAME.
func _at(arr: Array, i: int) -> String:
	return String(arr[i]) if i < arr.size() else ""

# --- operations.gd import-settings REPORTING (166 §5 D3/D4, fixed 1.46.0) ---
#
# 🔴 EVERY ASSERTION HERE IS POSITIVE AND DISCRIMINATING. The claim these replace was
# `typeof imp.imported === "boolean"` in the authoring probe — a shape that passes for
# every possible way of being wrong, which is exactly how both defects survived to be
# found by hand. 167 §4's lesson: an assertion aimed at the wrong channel manufactures a
# verdict. So each check below names the specific reply it demands.
#
# Hermetic: the `set` half builds its own asset + sidecar under user:// and passes
# `reimport: false`, so EditorInterface is never touched and the project tree is never
# written. The `get` half reads files the example project already ships.
func _test_import_settings_reporting(ops) -> void:
	# ---- D3: is "no sidecar" distinguishable from "no such file"? -------------
	# Before 1.46.0 these two returned byte-identical results and this was unanswerable.
	var absent: Dictionary = ops._resource_get_import_settings({"path": "res://g168_no_such_file_qwerty.png"})
	_eq("imp.get.absent.ok", _rok(absent), false)
	_eq("imp.get.absent.code", _rfield(absent, "error", "code"), "not_found")

	# A DIRECTORY exists but is not a file. Measured against resource_load first: it
	# answers not_found for a directory too, so this joins that convention.
	var adir: Dictionary = ops._resource_get_import_settings({"path": "res://addons"})
	_eq("imp.get.dir.ok", _rok(adir), false)
	_eq("imp.get.dir.code", _rfield(adir, "error", "code"), "not_found")

	# A REAL file with no .import sidecar still succeeds with imported=false. This is the
	# degrade path, and keeping it is the whole point: the fix must not turn a legitimate
	# "not imported" into an error.
	var plain: Dictionary = ops._resource_get_import_settings({"path": "res://player.gd"})
	_eq("imp.get.plain.ok", _rok(plain), true)
	_eq("imp.get.plain.imported", _rfield(plain, "result", "imported"), false)

	# 🔴 THE CLAIM ITSELF, stated as one assertion so it cannot be satisfied by accident.
	_check("imp.get.distinguishable", _rok(plain) != _rok(absent))

	# Control: a real imported asset still reports its importer and params. If this goes
	# red the fixture is wrong, not the tool (167 §7).
	var real: Dictionary = ops._resource_get_import_settings({"path": "res://addons/breakpoint_mcp/icon.png"})
	_eq("imp.get.control.ok", _rok(real), true)
	_eq("imp.get.control.imported", _rfield(real, "result", "imported"), true)
	_check("imp.get.control.importer", String(_rfield(real, "result", "importer")) != "")

	# ---- D4: does `changed` separate a real edit from a ceremonial one? -------
	var asset := "user://g168_asset.png"
	var sidecar := asset + ".import"
	var f := FileAccess.open(asset, FileAccess.WRITE)
	f.store_string("not really a png, and nothing here loads it")
	f.close()
	var seed := ConfigFile.new()
	seed.set_value("remap", "importer", "texture")
	seed.set_value("params", "compress/mode", 0)
	seed.save(sidecar)

	# A REAL change: the key exists and the value moves.
	var s1: Dictionary = ops._resource_set_import_settings({"path": asset, "settings": {"compress/mode": 1}, "reimport": false})
	_eq("imp.set.real.ok", _rok(s1), true)
	_eq("imp.set.real.applied", _rfield(s1, "result", "settings"), ["compress/mode"])
	_eq("imp.set.real.changed", _rfield(s1, "result", "changed"), ["compress/mode"])

	# 🔴 THE D4 CLAIM: the same value again. `settings` still echoes the key — the call
	# did set it — but `changed` is empty, which is the channel that did not exist before.
	var s2: Dictionary = ops._resource_set_import_settings({"path": asset, "settings": {"compress/mode": 1}, "reimport": false})
	_eq("imp.set.noop.ok", _rok(s2), true)
	_eq("imp.set.noop.applied", _rfield(s2, "result", "settings"), ["compress/mode"])
	_eq("imp.set.noop.changed", _rfield(s2, "result", "changed"), [])

	# An EMPTY settings map asks for nothing. Both lists are empty; `reimported` stays
	# honest about the force-reimport idiom rather than being suppressed.
	var s3: Dictionary = ops._resource_set_import_settings({"path": asset, "settings": {}, "reimport": false})
	_eq("imp.set.empty.applied", _rfield(s3, "result", "settings"), [])
	_eq("imp.set.empty.changed", _rfield(s3, "result", "changed"), [])

	# A key that was never in the file at all counts as changed — `not had` is a distinct
	# branch from `old != new` and a test that only flipped values would never reach it.
	var s4: Dictionary = ops._resource_set_import_settings({"path": asset, "settings": {"compress/g168_brand_new": 7}, "reimport": false})
	_eq("imp.set.newkey.changed", _rfield(s4, "result", "changed"), ["compress/g168_brand_new"])

	# 🔴 `not had` is a DISTINCT branch from `old_value != new_value`, and ONLY a new key
	# carrying null reaches it — for any other new key `null != value` already fires. A
	# mutation sweep proved the point: deleting `not had` survived every other case here.
	# An unasserted clause is one that looks redundant to the next person to read it.
	var s5: Dictionary = ops._resource_set_import_settings({"path": asset, "settings": {"compress/g168_null_key": null}, "reimport": false})
	_eq("imp.set.newkey_null.changed", _rfield(s5, "result", "changed"), ["compress/g168_null_key"])

	# The write really reached the file — otherwise every `changed` above could be
	# bookkeeping that never touched disk. Verdict from the sidecar's bytes (167 §3).
	var back := ConfigFile.new()
	back.load(sidecar)
	_eq("imp.set.persisted", back.get_value("params", "compress/mode"), 1)
	_eq("imp.set.persisted_newkey", back.get_value("params", "compress/g168_brand_new"), 7)

	# `not_found` vs `not_imported` are now different sentences about different worlds.
	var sAbsent: Dictionary = ops._resource_set_import_settings({"path": "user://g168_no_such_asset.png", "settings": {"compress/mode": 1}, "reimport": false})
	_eq("imp.set.absent.code", _rfield(sAbsent, "error", "code"), "not_found")

	var bare := "user://g168_bare.txt"
	var bf := FileAccess.open(bare, FileAccess.WRITE)
	bf.store_string("a real file with no sidecar")
	bf.close()
	var sBare: Dictionary = ops._resource_set_import_settings({"path": bare, "settings": {"compress/mode": 1}, "reimport": false})
	_eq("imp.set.bare.code", _rfield(sBare, "error", "code"), "not_imported")
	_check("imp.set.codes_differ", String(_rfield(sAbsent, "error", "code")) != String(_rfield(sBare, "error", "code")))

	DirAccess.remove_absolute(ProjectSettings.globalize_path(sidecar))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(asset))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(bare))

# --- runtime_bridge.gd _screenshot guard (no viewport; hermetic) ------------
# ── 169 §5: scene_get_dependencies handed out the one spelling that does not load ──
#
# The tool echoed ResourceLoader.get_dependencies verbatim. Measured on 4.7 against the
# example project, the entry shape is HETEROGENEOUS — `res://demo/demo_snowman.gd` for a
# dependency with no UID sidecar, `uid://ccgi4n26nbyku::::res://player.gd` for one with —
# and the second form answers `not_found` from resource_load while BOTH of its halves
# load fine on their own.
#
# 🔴 THESE ASSERTIONS ARE ON THE SPLITTER, NOT ON A LIVE SCENE. The live behaviour is
# covered by the authoring probe's AUTH_SCENE_DEPENDENCIES against a real editor; what a
# unit test can pin — cheaply, hermetically and on every push — is that each SHAPE maps
# to the right answer. The shapes below are quoted from the measurement, not invented.
func _test_scene_dependency_shape(ops) -> void:
	# The real scene in this project: one dependency, UID-prefixed. This is the row the
	# defect was found on.
	var r: Dictionary = ops._scene_get_dependencies({"path": "res://main.tscn"})
	_eq("dep.ok", _rok(r), true)
	# 🔴 _rarray / _at, NOT typed locals. Against the PRE-FIX addon these fields do not
	# exist, and `var deps: Array = _rfield(...)` raised — taking twelve of the thirteen
	# claims below out of the tally and leaving a perfectly green 206/206. See _rarray.
	var deps: Array = _rarray(r, "result", "dependencies")
	var raw: Array = _rarray(r, "result", "dependencies_raw")
	var uids: Array = _rarray(r, "result", "dependency_uids")

	# 🔴 THE CLAIM THE TAUTOLOGY REPLACED. `Array.isArray(deps)` was green for every one
	# of these; naming the content is what makes it a claim.
	_check("dep.named", deps.has("res://player.gd"))
	_check("dep.loadable", _at(deps, 0) != "" and not _at(deps, 0).contains("::::"))

	# The three arrays describe the same dependencies and must stay index-aligned, or a
	# caller pairing a path with its UID silently pairs the wrong two.
	_eq("dep.aligned.raw", raw.size(), deps.size())
	_eq("dep.aligned.uids", uids.size(), deps.size())
	# …and the population is non-empty, so the two alignment claims above cannot be
	# satisfied by three empty arrays agreeing with each other (0 == 0 == 0).
	_check("dep.nonempty", deps.size() > 0)

	# 🔴 NOTHING IS DESTROYED. The engine's own encoding is still there verbatim — this
	# is the half of #181's lesson that says a fix must not remove a capability.
	_check("dep.raw.preserved", _at(raw, 0).contains("res://player.gd"))

	# 🔴 A BICONDITIONAL, BECAUSE THE ENTRY'S SHAPE IS ENVIRONMENT-DEPENDENT AND CI
	# TAUGHT THAT THE HARD WAY. The first cut asserted `uids[0].begins_with("uid://")`
	# and a fixed roundtrip — measured true on a local fixture that had been `--import`ed,
	# and FALSE on CI, where the same scene's dependency comes back as a bare
	# `res://player.gd`. The two-segment form appears only once the UID cache is
	# populated, so pinning it was asserting the environment, not the tool.
	#
	# That heterogeneity is the defect's own shape (see this function's header) and it
	# makes the tool WORSE for a caller, not better — but a claim about it has to hold on
	# both arms. What is invariant is that the halves RECONSTRUCT the raw entry: with a
	# UID the compound reassembles, without one the path IS the raw entry and the uid is
	# empty. Neither arm can be satisfied by the other.
	#
	# The uid-extraction branch itself is not left uncovered — it is pinned exactly, and
	# environment-independently, by the synthetic `dep.split.*` rows below. That is what
	# extracting the splitter bought.
	if _at(raw, 0).contains("::::"):
		_check("dep.uid.consistent", _at(uids, 0).begins_with("uid://"))
		_eq("dep.roundtrip", _at(uids, 0) + "::::" + _at(deps, 0), _at(raw, 0))
	else:
		_eq("dep.uid.consistent", _at(uids, 0), "")
		_eq("dep.roundtrip", _at(deps, 0), _at(raw, 0))

	# A scene whose dependency has NO uid prefix takes the one-segment arm. Measured:
	# res://demo/demo.tscn -> "res://demo/demo_snowman.gd", 1 segment.
	var r2: Dictionary = ops._scene_get_dependencies({"path": "res://demo/demo.tscn"})
	_eq("dep.nouid.ok", _rok(r2), true)
	var deps2: Array = _rarray(r2, "result", "dependencies")
	var uids2: Array = _rarray(r2, "result", "dependency_uids")
	_check("dep.nouid.named", deps2.has("res://demo/demo_snowman.gd"))
	# 🔴 "" NOT null, and NOT omitted: the arrays stay index-aligned even when a
	# dependency has no UID. An omitted entry would shift every later pairing by one.
	_eq("dep.nouid.blank", _at(uids2, 0), "")

	# Control: a scene that does not exist is still refused rather than answered with an
	# empty list. If this goes red the fixture is wrong, not the tool (168 §1).
	var absent: Dictionary = ops._scene_get_dependencies({"path": "res://g169_no_such_scene.tscn"})
	_eq("dep.absent.ok", _rok(absent), false)
	_eq("dep.absent.code", _rfield(absent, "error", "code"), "not_found")

	# ── the splitter's own branches, on SYNTHETIC input ───────────────────────
	#
	# 🔴 THESE EXIST BECAUSE A MUTATION SWEEP SAID THEY HAD TO (169 §7). Two mutants —
	# a splitter that DROPS unrecognised entries, and a UID prefix matched as loosely as
	# `begins_with("u")` — both SURVIVED the live-scene assertions above with the suite
	# fully green, because nothing this project contains produces an entry that reaches
	# either branch. A branch no fixture can reach is covered by nothing, however many
	# green claims sit next to it.
	var split_uid: Dictionary = ops.split_dependency_entry("uid://abc123::::res://player.gd")
	_eq("dep.split.uid.path", split_uid["path"], "res://player.gd")
	_eq("dep.split.uid.uid", split_uid["uid"], "uid://abc123")

	var split_plain: Dictionary = ops.split_dependency_entry("res://demo/demo_snowman.gd")
	_eq("dep.split.plain.path", split_plain["path"], "res://demo/demo_snowman.gd")
	_eq("dep.split.plain.uid", split_plain["uid"], "")

	# user:// is a legal resource path and must be read as a PATH, not mistaken for a uid
	# — the exact confusion the loose-prefix mutant introduced.
	var split_user: Dictionary = ops.split_dependency_entry("uid://xyz::::user://saved.tres")
	_eq("dep.split.user.path", split_user["path"], "user://saved.tres")
	_eq("dep.split.user.uid", split_user["uid"], "uid://xyz")

	# 🔴 THE FALLBACK, ASSERTED RATHER THAN COMMENTED. An entry with no recognisable path
	# segment comes back WHOLE. A splitter that dropped it would shrink the dependency
	# list and look cleaner for it.
	var split_odd: Dictionary = ops.split_dependency_entry("something::::we::::have::::not::::seen")
	_eq("dep.split.unknown.kept", split_odd["path"], "something::::we::::have::::not::::seen")
	_eq("dep.split.unknown.uid", split_odd["uid"], "")

	# A trailing type segment (a shape other Godot versions emit) must not be mistaken
	# for the path.
	var split_typed: Dictionary = ops.split_dependency_entry("uid://q::::res://a.tres::::Texture2D")
	_eq("dep.split.typed.path", split_typed["path"], "res://a.tres")
	_eq("dep.split.typed.uid", split_typed["uid"], "uid://q")

	# 🔴 THE LAST TWO ROWS EXIST BECAUSE THE SWEEP'S SECOND RUN STILL HAD SURVIVORS, AND
	# EACH SURVIVOR NAMED THE INPUT NOBODY HAD WRITTEN. Neither is a hypothetical: each
	# is the smallest entry that separates the real rule from a mutant of it.

	# 'FIRST path segment wins' — needs TWO path segments to mean anything. With only one,
	# a splitter that took the LAST would agree with one that took the first, and the
	# mutation survived on exactly that.
	var split_two: Dictionary = ops.split_dependency_entry("uid://q::::res://first.tres::::res://second.tres")
	_eq("dep.split.two.path", split_two["path"], "res://first.tres")

	# A non-uid segment that merely STARTS with "u" must not be read as a UID. Every
	# earlier row let a prefix as loose as `begins_with("u")` pass, because `user://`
	# is caught by the path branch first and nothing else in them began with a u.
	var split_loose: Dictionary = ops.split_dependency_entry("unknown_thing::::res://a.tres")
	_eq("dep.split.loose.uid", split_loose["uid"], "")
	_eq("dep.split.loose.path", split_loose["path"], "res://a.tres")


func _test_screenshot_no_viewport() -> void:
	# A _LiveRuntimeBridge NOT in the tree has no viewport, so _screenshot must
	# short-circuit to the no_viewport error without touching the renderer.
	var rb := _LiveRuntimeBridge.new()
	var shot: Dictionary = rb._screenshot()
	_eq("rb.shot.no_viewport.ok", shot["ok"], false)
	_eq("rb.shot.no_viewport.code", shot["error"]["code"], "no_viewport")
	rb.free()


# --- 311: the window-drawing guard, on the EDITOR plane, hermetic ------------
func _test_screenshot_window_guard() -> void:
	# 🔴 THE GUARD 310 MEASURED THE NEED FOR, ASSERTED IN BOTH DIRECTIONS BY TWO JOBS
	# THAT ALREADY EXIST, AGAINST THE ENGINE RATHER THAN A MOCK.
	#   gdscript-unit  --headless  -> the headless DisplayServer answers
	#                  window_can_draw() FALSE, so the REFUSAL arm runs here, live.
	#   render-plane   Xvfb+llvmpipe -> the X11 DisplayServer answers TRUE unless the
	#                  window is minimised, so the guard must NOT fire, and the runtime
	#                  plane's capture assertions in _test_live_screenshot run instead.
	# Neither job needed a new step, and neither arm is simulated.
	#
	# 🔵 THE EDITOR PLANE IS SAFE TO CALL HERE ONLY ON THE REFUSING SIDE, and that is
	# the guard's own doing: it returns BEFORE `EditorInterface` is touched, which is
	# exactly where a precondition about the whole engine belongs. With a drawing
	# window there is no editor in this process to capture, so the positive direction
	# is left to the authoring-plane probe, which drives a real editor under Xvfb.
	var can_draw := DisplayServer.window_can_draw()
	print("OPS_UNIT_WINDOW can_draw=%s display=%s" % [str(can_draw), DisplayServer.get_name()])
	if can_draw:
		_skip_check("ops.shot.window_guard", "window is drawing — the refusal cannot be reached, and the editor plane needs a real editor")
		return
	var ops = Ops.new()
	var shot: Dictionary = ops._screenshot({"viewport": "3d"})
	_eq("ops.shot.window.ok", shot["ok"], false)
	_eq("ops.shot.window.code", shot["error"]["code"], "window_not_drawing")
	# The message must name the state, and the remedy must name the act. 254's split.
	_check("ops.shot.window.message", String(shot["error"]["message"]).contains("not drawing"))
	_check("ops.shot.window.remedy", String(shot["error"].get("remedy", "")).begins_with("Make the editor window visible"))


# --- LIVE tree: _resolve absolute (/...) branch — rb + operations -----------
func _test_live_resolve_absolute() -> void:
	# Build a real scene under the now-active root: /root/Scene/Kid.
	var scene := Node2D.new()
	scene.name = "Scene"
	var kid := Node.new()
	kid.name = "Kid"
	scene.add_child(kid)
	root.add_child(scene)
	var rb := _LiveRuntimeBridge.new()
	rb.name = "LiveRB"
	root.add_child(rb)
	_check("rb.live.in_tree", kid.is_inside_tree())
	# runtime_bridge._resolve: the begins_with("/") branch -> get_node_or_null
	_check("rb.resolve.abs_hit", rb._resolve("/root/Scene/Kid") == kid)
	_check("rb.resolve.abs_miss", rb._resolve("/root/Nope/Nope") == null)
	# operations._resolve: an absolute path through has_node/get_node on a live tree
	var ops = Ops.new()
	_check("ops.resolve.abs_hit", ops._resolve(scene, "/root/Scene/Kid") == kid)
	rb.free()
	scene.free()


# --- LIVE tree: _screenshot with a real viewport ----------------------------
func _test_live_screenshot() -> void:
	# In-tree, get_viewport() is non-null — the precondition the hermetic guard
	# cannot reach. Whether the CAPTURE can then run depends on the rasterizer, so
	# this reports FOUR distinct outcomes where it used to report two passing ones:
	#
	#   captured  — assert it is a real PNG with real dimensions and a real payload
	#   degraded  — assert it failed CLEANLY, and SKIP the capture assertions
	#   demanded  — BREAKPOINT_TEST_REQUIRE_RENDER=1 turns a degrade into a FAIL
	#   impossible— a LIVE backend that cannot capture is a bug, not an environment
	#
	# The last two are the point. Before this, `else` swallowed every non-capture
	# into one green check, so a real rasterizer silently failing to produce a frame
	# looked exactly like headless working as designed.
	var host := Node.new()
	host.name = "ShotHost"
	root.add_child(host)
	var rb := _LiveRuntimeBridge.new()
	host.add_child(rb)
	_check("rb.live.has_viewport", rb.get_viewport() != null)

	var backend := _render_backend()
	var require := OS.get_environment("BREAKPOINT_TEST_REQUIRE_RENDER") == "1"
	# Emitted unconditionally so a CI log always answers "what was it drawing with?"
	print("OPS_UNIT_RENDER backend=%s require=%s frame=%d" % [backend, str(require), _frame])

	var shot: Dictionary = rb._screenshot()
	if shot["ok"]:
		# THE CAPTURE PATH. Until this edit landed, nothing in this repo had ever
		# executed the three assertions below — not once, in any run, anywhere.
		var r: Dictionary = shot["result"]
		_eq("rb.shot.mime", r["mime"], "image/png")
		# Report the MEASURED size, not just "positive": on a HiDPI/Retina backing
		# store these may not be the logical size an agent asked about, and a bare
		# pass would hide that. The number belongs in the log where it can be read.
		_check("rb.shot.dims (%dx%d)" % [int(r["width"]), int(r["height"])], int(r["width"]) > 0 and int(r["height"]) > 0)
		# A real PNG is never a handful of bytes. An empty buffer is the shape a
		# dead rasterizer returns, and it must not read as a successful capture.
		_check("rb.shot.payload", String(r["base64"]).length() > 512)
	elif require:
		# Asked for a real frame and did not get one. Whatever the reason, that is
		# a failure — the same contract as doctor --require-live (#136).
		_check("rb.shot.required (backend=%s code=%s)" % [backend, str(shot["error"]["code"])], false)
	elif backend == "dummy":
		# --headless: nothing was drawn, so no frame is the CORRECT outcome. Assert
		# it degraded cleanly — that is real coverage of a real guard — but do NOT
		# bank it as capture coverage. Hence the skip alongside the pass.
		# 🆕 311 — AND THE CODE IT DEGRADES TO IS BETTER NOW, WHICH IS THE POINT OF THE
		# CHANGE RATHER THAN A SIDE EFFECT. The headless DisplayServer answers
		# `window_can_draw()` FALSE, so the runtime plane's own window guard is what
		# answers here, and it names a state a caller can act on. The old codes said
		# *could not read frame* and their remedies said *advance a frame and call
		# again* — advice that could never work, because no number of frames produces a
		# picture from a rasterizer that draws nothing. `no_image` / `no_texture` stay
		# legal below for a DisplayServer that reports it CAN draw and still yields no
		# texture, which is the different failure they were written for.
		_check("rb.shot.degrades", shot["error"]["code"] in ["window_not_drawing", "no_image", "no_texture"])
		if not DisplayServer.window_can_draw():
			_eq("rb.shot.degrades.names_the_window", shot["error"]["code"], "window_not_drawing")
		else:
			_skip_check("rb.shot.degrades.names_the_window", "the display server reports it CAN draw, so the window guard is not the arm this run is testing")
		_skip_check("rb.shot.capture", "dummy rasterizer — drop --headless to exercise it")
	else:
		# A live rasterizer that cannot produce a frame is a defect in the capture
		# path, not a property of the environment. Fail, and name what it was using.
		_check("rb.shot.live_backend_captures (backend=%s code=%s)" % [backend, str(shot["error"]["code"])], false)
	rb.free()
	host.free()
