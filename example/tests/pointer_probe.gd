extends Node2D
## Observer-only fixture for BP-0041's pointer kind — the frame-to-window mapping.
##
## THIS SCRIPT NEVER SYNTHESISES INPUT, for input_probe.gd's reason: the subject is
## whether the TOOL lands an event where the frame shows its target, so a fixture that
## could produce one of its own would make every reading below ambiguous after a miss.
##
## Two targets at fixed CANVAS coordinates (this scene has no camera, so canvas and
## viewport coordinates are the same space): `Target` (magenta) and `Drop` (cyan). A
## driver finds them BY COLOUR in the frame `runtime_screenshot` returns, sends a
## `pointer` tap or drag at those frame pixels, and reads what arrived back through
## `runtime_read_state {name: "pointer_probe"}` — so the measurement crosses every layer:
## frame pixels, the addon's mapping, the engine's own input transform, the GUI.
##
## The driver switches the root window's stretch (content_scale_mode / _aspect / _size)
## with runtime_set_property on /root between readings; nothing here changes it.
##
## The state reader is registered the way any game would (Engine metadata
## "breakpoint_state", from debug-only code), with no reference to Breakpoint's folder.

var presses := 0
var releases := 0
var last_press := Vector2.ZERO      # viewport coordinates, from _input
var last_release := Vector2.ZERO
var masked_motions := 0             # motion events that arrived with the left button held
var last_motion_mask := 0
var target_presses := 0             # what the GUI routed to Target
var target_last_local := Vector2.ZERO


func _ready() -> void:
	set_process_input(true)
	$Target.gui_input.connect(_on_target_input)
	if OS.is_debug_build():
		var reg: Dictionary = Engine.get_meta(&"breakpoint_state", {})
		reg["pointer_probe"] = _state
		Engine.set_meta(&"breakpoint_state", reg)


func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed:
			presses += 1
			last_press = mb.position
		else:
			releases += 1
			last_release = mb.position
	elif event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		last_motion_mask = int(mm.button_mask)
		if mm.button_mask & MOUSE_BUTTON_MASK_LEFT:
			masked_motions += 1


func _on_target_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		target_presses += 1
		target_last_local = (event as InputEventMouseButton).position


func _state() -> Dictionary:
	var t: ColorRect = $Target
	var d: ColorRect = $Drop
	return {
		"presses": presses,
		"releases": releases,
		"last_press": last_press,
		"last_release": last_release,
		"masked_motions": masked_motions,
		"last_motion_mask": last_motion_mask,
		"target_presses": target_presses,
		"target_last_local": target_last_local,
		"target_center": t.position + t.size / 2.0,
		"drop_center": d.position + d.size / 2.0,
		"visible_rect_size": get_viewport().get_visible_rect().size,
	}
