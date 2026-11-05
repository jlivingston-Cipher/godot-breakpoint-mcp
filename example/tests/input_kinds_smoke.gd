extends SceneTree
## Headless regression for BP-0041 (addon 1.19.0): the runtime_inject_input kinds and fields
## added for TG-1026, the pointer's validation and button bookkeeping, and the viewport block's
## shape. BP-0047 (addon 1.20.0): a key carries all three codes, filled from the one given, and
## so matches an Input Map binding stored either way. Drives the SHIPPED runtime_bridge.gd directly; the bridge is never added to the tree,
## so it never listens, and with no viewport the frame-to-window mapping is the identity — the
## mapping itself is measured windowed (see pointer_probe.tscn), because a headless display
## draws nothing.
##
## Prints INPUT_KINDS_PASS/FAIL per assertion + INPUT_KINDS_SUMMARY pass=<n>/<total>;
## quits non-zero on any failure. Run:
##   godot --headless --path example --script res://tests/input_kinds_smoke.gd

const RuntimeBridge := preload("res://addons/breakpoint_mcp/runtime_bridge.gd")
## Every check above the completion check (a runtime error aborts only its function).
const EXPECTED_CHECKS := 29

var _pass := 0
var _fail := 0


func _check(label: String, cond: bool) -> void:
	if cond:
		_pass += 1
		print("INPUT_KINDS_PASS %s" % label)
	else:
		_fail += 1
		print("INPUT_KINDS_FAIL %s" % label)


func _code(r: Dictionary) -> String:
	return String(r.get("error", {}).get("code", "")) if not bool(r.get("ok", false)) else ""


func _inject(rb: Node, ev: Dictionary) -> Dictionary:
	return rb._dispatch("runtime.inject_input", {"event": ev})


func _initialize() -> void:
	var rb: Node = RuntimeBridge.new()

	# 1. key: the three codes, and none of them is a refusal rather than KEY_NONE.
	_check("key.no_code_refused", _code(_inject(rb, {"kind": "key"})) == "bad_event")
	_check("key.no_code_has_remedy", String(_inject(rb, {"kind": "key"}).get("error", {}).get("remedy", "")).contains("runtime_inject_input"))
	_check("key.physical_keycode_only", bool(_inject(rb, {"kind": "key", "physical_keycode": KEY_K}).get("ok", false)))
	_check("key.with_modifiers", bool(_inject(rb, {"kind": "key", "keycode": KEY_A, "key_label": KEY_A, "unicode": 97, "echo": true, "shift": true, "ctrl": true, "alt": true, "meta": true}).get("ok", false)))
	_check("key.keycode_only_unchanged", bool(_inject(rb, {"kind": "key", "keycode": KEY_K}).get("ok", false)))

	# 1b. BP-0047: the codes a real key carries. A code left out is filled from the first non-zero
	# one given (keycode, physical_keycode, key_label); a code passed, 0 included, is sent as given.
	var from_physical: InputEventKey = RuntimeBridge._key_event({"physical_keycode": KEY_K})
	_check("key.physical_only_fills_keycode_and_label", from_physical.keycode == KEY_K and from_physical.physical_keycode == KEY_K and from_physical.key_label == KEY_K)
	var from_keycode: InputEventKey = RuntimeBridge._key_event({"keycode": KEY_J})
	_check("key.keycode_only_fills_physical_and_label", from_keycode.keycode == KEY_J and from_keycode.physical_keycode == KEY_J and from_keycode.key_label == KEY_J)
	var from_label: InputEventKey = RuntimeBridge._key_event({"key_label": KEY_L})
	_check("key.label_only_fills_both_codes", from_label.keycode == KEY_L and from_label.physical_keycode == KEY_L and from_label.key_label == KEY_L)
	var both: InputEventKey = RuntimeBridge._key_event({"keycode": KEY_A, "physical_keycode": KEY_Q})
	_check("key.given_codes_sent_as_given", both.keycode == KEY_A and both.physical_keycode == KEY_Q and both.key_label == KEY_A)
	var zero_kept: InputEventKey = RuntimeBridge._key_event({"keycode": 0, "physical_keycode": KEY_K})
	_check("key.explicit_zero_kept", zero_kept.keycode == KEY_NONE and zero_kept.physical_keycode == KEY_K and zero_kept.key_label == KEY_K)
	var codes: Dictionary = _inject(rb, {"kind": "key", "physical_keycode": KEY_K}).get("result", {}).get("codes", {})
	_check("key.reply_names_the_codes_sent", int(codes.get("keycode", -1)) == KEY_K and int(codes.get("physical_keycode", -1)) == KEY_K and int(codes.get("key_label", -1)) == KEY_K)
	var by_keycode := InputEventKey.new()
	by_keycode.keycode = KEY_K
	var by_physical := InputEventKey.new()
	by_physical.physical_keycode = KEY_K
	InputMap.add_action(&"bp_smoke_by_keycode")
	InputMap.action_add_event(&"bp_smoke_by_keycode", by_keycode)
	InputMap.add_action(&"bp_smoke_by_physical")
	InputMap.action_add_event(&"bp_smoke_by_physical", by_physical)
	_check("key.physical_only_matches_a_keycode_binding", InputMap.event_is_action(from_physical, &"bp_smoke_by_keycode"))
	_check("key.keycode_only_matches_a_physical_binding", InputMap.event_is_action(RuntimeBridge._key_event({"keycode": KEY_K}), &"bp_smoke_by_physical"))
	InputMap.erase_action(&"bp_smoke_by_keycode")
	InputMap.erase_action(&"bp_smoke_by_physical")

	# 2. mouse: double_click, button_mask, frame space (identity with no viewport).
	_check("mouse_button.double_click", bool(_inject(rb, {"kind": "mouse_button", "button": 1, "double_click": true, "space": "frame", "position": {"__type__": "Vector2", "x": 4, "y": 5}}).get("ok", false)))
	_check("mouse_motion.button_mask", bool(_inject(rb, {"kind": "mouse_motion", "button_mask": 1, "position": {"__type__": "Vector2", "x": 6, "y": 7}}).get("ok", false)))
	_check("mouse.untagged_position_still_refused", _code(_inject(rb, {"kind": "mouse_button", "position": {"x": 1, "y": 2}})) == "bad_event_field")

	# 3. joypad.
	_check("joypad_button.ok", bool(_inject(rb, {"kind": "joypad_button", "button": JOY_BUTTON_A}).get("ok", false)))
	_check("joypad_button.needs_button", _code(_inject(rb, {"kind": "joypad_button"})) == "bad_event")
	_check("joypad_motion.ok", bool(_inject(rb, {"kind": "joypad_motion", "axis": JOY_AXIS_LEFT_X, "value": -0.5}).get("ok", false)))
	_check("joypad_motion.needs_axis", _code(_inject(rb, {"kind": "joypad_motion", "value": 1.0})) == "bad_event")

	# 4. bad_kind lists the kinds; the pointer is routed to the async lane, and only it.
	_check("bad_kind.lists_the_kinds", String(_inject(rb, {"kind": "nope"}).get("error", {}).get("message", "")).contains("pointer"))
	_check("pointer.routed_async", RuntimeBridge._is_pointer("runtime.inject_input", {"event": {"kind": "pointer"}}))
	_check("pointer.only_pointer_routed", not RuntimeBridge._is_pointer("runtime.inject_input", {"event": {"kind": "key"}}) and not RuntimeBridge._is_pointer("runtime.step_frames", {}))

	# 5. pointer validation and button bookkeeping (press / move / release need no frames).
	_check("pointer.bad_action", _code(await rb._inject_pointer({"kind": "pointer", "action": "swipe", "x": 1, "y": 1})) == "bad_event")
	_check("pointer.needs_xy", _code(await rb._inject_pointer({"kind": "pointer", "action": "tap"})) == "bad_event")
	_check("pointer.drag_needs_to", _code(await rb._inject_pointer({"kind": "pointer", "action": "drag", "x": 1, "y": 1})) == "bad_event")
	var press: Dictionary = await rb._inject_pointer({"kind": "pointer", "action": "press", "x": 10, "y": 20, "button": MOUSE_BUTTON_RIGHT})
	_check("pointer.press_answers_points", JSON.stringify(press.get("result", {}).get("window_points", [])) == JSON.stringify([[10.0, 20.0]]) and int(rb._pointer_mask) == MOUSE_BUTTON_MASK_RIGHT)
	await rb._inject_pointer({"kind": "pointer", "action": "move", "x": 15, "y": 20})
	_check("pointer.move_tracks_position", rb._pointer_at == Vector2(15, 20))
	await rb._inject_pointer({"kind": "pointer", "action": "release", "x": 15, "y": 20, "button": MOUSE_BUTTON_RIGHT})
	_check("pointer.release_clears_mask", int(rb._pointer_mask) == 0)

	_check("completion.every_check_ran", _pass + _fail == EXPECTED_CHECKS)
	print("INPUT_KINDS_SUMMARY pass=%d/%d" % [_pass, _pass + _fail])
	rb.free()
	quit(1 if _fail > 0 else 0)
