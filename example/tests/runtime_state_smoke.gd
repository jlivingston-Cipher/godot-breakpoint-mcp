extends SceneTree
## Headless regression for runtime.read_state (BP-0037 part D): the state a GAME chooses to
## expose, read as JSON from Engine metadata "breakpoint_state" — a Dictionary of
## name -> Callable the game writes from its own debug-only code, with no reference to the
## addon folder. Drives the SHIPPED runtime_bridge.gd's _dispatch directly: the bridge is
## never added to the tree, so it never listens and nothing here needs a socket.
##
## Prints RUNTIME_STATE_PASS/FAIL per assertion + RUNTIME_STATE_SUMMARY pass=<n>/<total>;
## quits non-zero on any failure. Run:
##   godot --headless --path example --script res://tests/runtime_state_smoke.gd

const RuntimeBridge := preload("res://addons/breakpoint_mcp/runtime_bridge.gd")
const META := &"breakpoint_state"
## Every check above the completion check. A runtime error aborts only the function it
## occurs in, so a suite cut short would otherwise print a clean summary over fewer checks.
const EXPECTED_CHECKS := 15

var _pass := 0
var _fail := 0


## A game object exposing a reader, so a freed object can be told apart from a live one.
class Mixer extends Object:
	var level := 0.5

	func state() -> Dictionary:
		return {"level": level, "pan": Vector2(0.25, -1.0)}


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
	rb.free()
	var total := _pass + _fail
	_check("completion.every_check_ran", total == EXPECTED_CHECKS)
	print("RUNTIME_STATE_SUMMARY pass=%d/%d" % [_pass, _pass + _fail])
	quit(1 if _fail > 0 else 0)
