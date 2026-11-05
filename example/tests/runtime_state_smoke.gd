extends SceneTree
## Headless regression for runtime.read_state (BP-0037 part D): the state a GAME chooses to
## expose, read as JSON from Engine metadata "breakpoint_state" — a Dictionary of
## name -> Callable the game writes from its own debug-only code, with no reference to the
## addon folder. Drives the SHIPPED runtime_bridge.gd's _dispatch directly: the bridge is
## never added to the tree, so it never listens and nothing here needs a socket.
##
## BP-0025 (addon 1.21.0) adds the two other ways a game shows its state: the performance
## monitors it registers with Performance.add_custom_monitor, read and asserted beside the
## built-ins, and a method called on an object a node HOLDS (`Synth:patch`). The second needs a
## live tree, so it runs on the first frame, on a bridge whose listen policy says no.
##
## Prints RUNTIME_STATE_PASS/FAIL per assertion + RUNTIME_STATE_SUMMARY pass=<n>/<total>;
## quits non-zero on any failure. Run:
##   godot --headless --path example --script res://tests/runtime_state_smoke.gd

const RuntimeBridge := preload("res://addons/breakpoint_mcp/runtime_bridge.gd")
const META := &"breakpoint_state"
## Every check above the completion check. A runtime error aborts only the function it
## occurs in, so a suite cut short would otherwise print a clean summary over fewer checks.
const EXPECTED_CHECKS := 39

var _pass := 0
var _fail := 0


## A game object exposing a reader, so a freed object can be told apart from a live one.
class Mixer extends Object:
	var level := 0.5

	func state() -> Dictionary:
		return {"level": level, "pan": Vector2(0.25, -1.0)}


## BP-0025 — what a node holds. Patch is a RefCounted, not a Resource, on purpose:
## Node.get_node_and_resource stops at the first thing that is not a Resource, and this walk
## must not. Synth has a method of the SAME name, so a path whose colon was dropped calls the
## wrong object and says so in the return value.
class Lfo extends Resource:
	var rate := 1.0

	func double_rate() -> float:
		rate *= 2.0
		return rate


class Patch extends RefCounted:
	var cutoff := 0.5
	var lfo := Lfo.new()

	func set_cutoff(v: float) -> String:
		cutoff = v
		return "patch"


class Synth extends Node:
	var patch := Patch.new()
	var level := 0.75
	var nothing: Object = null
	var gone: Object = null

	func set_cutoff(_v: float) -> String:
		return "synth"


## A bridge whose listen policy says no, so it can stand in a live tree without a socket.
class InertBridge extends RuntimeBridge:
	func _policy_facts() -> Dictionary:
		return {"editor_build": false, "debug_build": true, "exported_optin": "", "env_secret": "", "strict": false, "switch": false}


func _check(label: String, cond: bool) -> void:
	if cond:
		_pass += 1
		print("RUNTIME_STATE_PASS %s" % label)
	else:
		_fail += 1
		print("RUNTIME_STATE_FAIL %s" % label)


func _read(rb: Node, params: Dictionary) -> Dictionary:
	return rb._dispatch("runtime.read_state", params)


func _code(r: Dictionary) -> String:
	return String(r.get("error", {}).get("code", "")) if not bool(r.get("ok", false)) else ""


func _initialize() -> void:
	var rb: Node = RuntimeBridge.new()
	if Engine.has_meta(META):
		Engine.remove_meta(META)

	# 1. Nothing registered: a named refusal with its next action, not an empty answer.
	var none := _read(rb, {})
	_check("no_registry.refused", _code(none) == "no_state_registry")
	_check("no_registry.carries_a_remedy", String(none.get("error", {}).get("remedy", "")).contains("breakpoint_state"))
	Engine.set_meta(META, 5)
	_check("registry_not_a_dictionary.refused", _code(_read(rb, {})) == "no_state_registry")

	# 2. A registry with four readers, one of them keyed by StringName.
	var mixer := Mixer.new()
	var reg := {
		"counter": func() -> int: return 42,
		"sum": func(a: int, b: int) -> int: return a + b,
		"mixer": Callable(mixer, "state"),
		&"echo_x": func(v: Vector2) -> float: return v.x,
	}
	Engine.set_meta(META, reg)
	var listed := _read(rb, {})
	_check("list.ok", bool(listed.get("ok", false)))
	_check("list.sorted_names", listed.get("result", {}).get("names", []) == ["counter", "echo_x", "mixer", "sum"])
	var counter := _read(rb, {"name": "counter"})
	_check("read.scalar", bool(counter.get("ok", false)) and counter["result"]["name"] == "counter" and int(counter["result"]["value"]) == 42)
	var m := _read(rb, {"name": "mixer"})
	var pan: Variant = m.get("result", {}).get("value", {}).get("pan", {})
	_check("read.godot_types_tagged", typeof(pan) == TYPE_DICTIONARY and pan.get("__type__", "") == "Vector2" and is_equal_approx(float(pan.get("x", 0)), 0.25))
	_check("read.json_native_unchanged", is_equal_approx(float(m.get("result", {}).get("value", {}).get("level", 0)), 0.5))
	_check("read.args_passed", int(_read(rb, {"name": "sum", "args": [2, 3]}).get("result", {}).get("value", 0)) == 5)
	_check("read.tagged_args_decoded", is_equal_approx(float(_read(rb, {"name": "echo_x", "args": [{"__type__": "Vector2", "x": 7.5, "y": 1}]}).get("result", {}).get("value", 0)), 7.5))
	_check("read.stringname_key_by_string", bool(_read(rb, {"name": "echo_x", "args": [Vector2(1, 1)]}).get("ok", false)))

	# 3. A name nobody registered: refused, and the refusal lists what IS registered.
	var unknown := _read(rb, {"name": "nope"})
	_check("unknown.refused", _code(unknown) == "unknown_state")
	_check("unknown.lists_the_names", String(unknown.get("error", {}).get("message", "")).contains("counter, echo_x, mixer, sum"))

	# 4. The object behind a reader was freed: refused as gone, not called.
	mixer.free()
	_check("freed.refused_as_gone", _code(_read(rb, {"name": "mixer"})) == "state_reader_gone")

	# 5. Read-only: the registry the game wrote is the registry it still has.
	_check("registry_untouched", (Engine.get_meta(META) as Dictionary).size() == 4)

	Engine.remove_meta(META)

	# 6. BP-0025: the monitors a game registers, read and asserted beside the built-ins.
	Performance.add_custom_monitor(&"bp_smoke/voices", func() -> int: return 7)
	Performance.add_custom_monitor(&"bp_smoke/text", func() -> String: return "loud")
	var by_key: Dictionary = _mon(rb, {"keys": ["bp_smoke/voices"]})
	_check("monitors.custom_by_key", int(by_key.get("monitors", {}).get("bp_smoke/voices", -1)) == 7 and not by_key.has("unknown"))
	var every: Dictionary = _mon(rb, {})
	_check("monitors.custom_in_a_no_keys_read", every.get("monitors", {}).has("bp_smoke/voices") and every.get("monitors", {}).has("time/fps"))
	var typo: Dictionary = _mon(rb, {"keys": ["bp_smoke/voice", "time/fps"]})
	_check("monitors.unknown_key_named", typo.get("unknown", []) == ["bp_smoke/voice"] and typo.get("monitors", {}).has("time/fps"))
	_check("monitors.non_number_passed_as_read", _mon(rb, {"keys": ["bp_smoke/text"]}).get("monitors", {}).get("bp_smoke/text", null) == "loud")
	var within: Dictionary = _perf(rb, {"baseline": {"bp_smoke/voices": 10}})
	_check("assert_perf.custom_checked", int(within.get("checked", 0)) == 1 and bool(within.get("ok", false)))
	var over: Dictionary = _perf(rb, {"baseline": {"bp_smoke/voices": 5}})
	_check("assert_perf.custom_regression", not bool(over.get("ok", true)) and (over.get("regressions", []) as Array).size() == 1)
	var wordy: Dictionary = _perf(rb, {"baseline": {"bp_smoke/text": 1, "bp_smoke/voices": 10}})
	_check("assert_perf.non_number_not_compared", int(wordy.get("checked", 0)) == 1 and wordy.get("monitors", {}).get("bp_smoke/text", null) == "loud")
	var misspelt: Dictionary = _perf(rb, {"baseline": {"bp_smoke/voice": 10}})
	_check("assert_perf.unknown_key_named", int(misspelt.get("checked", -1)) == 0 and misspelt.get("unknown", []) == ["bp_smoke/voice"])
	Performance.remove_custom_monitor(&"bp_smoke/voices")
	Performance.remove_custom_monitor(&"bp_smoke/text")
	_check("monitors.removed_becomes_unknown", _mon(rb, {"keys": ["bp_smoke/voices"]}).get("unknown", []) == ["bp_smoke/voices"])
	_check("monitors.builtins_unchanged", _mon(rb, {}).get("monitors", {}).size() == RuntimeBridge.MONITORS.size())
	rb.free()


## BP-0025: a method on what a node holds needs a live tree — `_resolve` reads the current
## scene — and during _initialize `root` is not inside the tree yet.
func _process(_delta: float) -> bool:
	var synth := Synth.new()
	synth.name = "Synth"
	root.add_child(synth)
	current_scene = synth
	var rb := InertBridge.new()
	root.add_child(rb)
	var gone := Object.new()
	synth.gone = gone
	gone.free()
	var held := _call(rb, ":patch", "set_cutoff", [0.25])
	_check("held.method_runs_on_the_held_object", held.get("result", {}).get("return", "") == "patch" and is_equal_approx(synth.patch.cutoff, 0.25))
	_check("held.no_colon_still_the_node", _call(rb, ".", "set_cutoff", [0.1]).get("result", {}).get("return", "") == "synth")
	_check("held.absolute_path_with_colon", _call(rb, "/root/Synth:patch", "set_cutoff", [0.75]).get("result", {}).get("return", "") == "patch" and is_equal_approx(synth.patch.cutoff, 0.75))
	_check("held.two_steps_through_a_refcounted", is_equal_approx(float(_call(rb, ":patch:lfo", "double_rate", []).get("result", {}).get("return", 0.0)), 2.0))
	var missing := _call(rb, ":nope", "set_cutoff", [0.1])
	_check("held.missing_property_refused", _code(missing) == "bad_held_path" and String(missing.get("error", {}).get("message", "")).contains("nope"))
	_check("held.refusal_has_a_remedy", String(missing.get("error", {}).get("remedy", "")).contains("runtime_get_property"))
	_check("held.value_refused", _code(_call(rb, ":level", "abs", [])) == "bad_held_path")
	var null_held := _call(rb, ":nothing", "free", [])
	_check("held.null_refused", _code(null_held) == "bad_held_path" and String(null_held.get("error", {}).get("message", "")).contains("no live object"))
	var freed_held := _call(rb, ":gone", "free", [])
	_check("held.freed_refused", _code(freed_held) == "bad_held_path" and String(freed_held.get("error", {}).get("message", "")).contains("no live object"))
	var value_held := _call(rb, ":level", "abs", [])
	_check("held.value_message_says_value", String(value_held.get("error", {}).get("message", "")).contains("a value, not an object"))
	# Every OTHER tool takes a node: a colon path is refused, never quietly cut back to the node.
	var removed := rb._dispatch("runtime.node_remove", {"path": "/root/Synth:patch"})
	_check("colon.node_remove_refused_and_synth_kept", _code(removed) == "bad_path" and String(removed.get("error", {}).get("message", "")).contains("names a property") and is_instance_valid(synth) and not synth.is_queued_for_deletion())
	_check("colon.get_property_refused", _code(rb._dispatch("runtime.get_property", {"path": ":patch", "property": "cutoff"})) == "bad_path")
	_check("colon.plain_miss_keeps_its_message", String(rb._dispatch("runtime.get_property", {"path": "Nope", "property": "x"}).get("error", {}).get("message", "")) == "Node not found: Nope")
	var no_method := _call(rb, ":patch", "nope", [])
	_check("held.no_method_names_the_held_class", _code(no_method) == "no_method" and String(no_method.get("error", {}).get("message", "")).contains("RefCounted"))
	rb.queue_free()
	synth.queue_free()
	var total := _pass + _fail
	_check("completion.every_check_ran", total == EXPECTED_CHECKS)
	print("RUNTIME_STATE_SUMMARY pass=%d/%d" % [_pass, _pass + _fail])
	quit(1 if _fail > 0 else 0)
	return true


func _mon(rb: Node, params: Dictionary) -> Dictionary:
	return rb._dispatch("runtime.get_monitors", params).get("result", {})


func _perf(rb: Node, params: Dictionary) -> Dictionary:
	return rb._dispatch("runtime.assert_perf", params).get("result", {})


func _call(rb: Node, path: String, method: String, args: Array) -> Dictionary:
	return rb._dispatch("runtime.call_method", {"path": path, "method": method, "args": args})
