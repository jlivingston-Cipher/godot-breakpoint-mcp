extends Node2D
## Observer-only fixture for the runtime_inject_input live probe (session 153).
##
## THIS SCRIPT NEVER SYNTHESISES INPUT. It only records what arrives. That is the same
## discipline node_probe.tscn applies by being scriptless: the subject of this lane is
## whether the TOOL delivers an event, so a fixture that could produce one of its own
## would make every count below ambiguous after a failure. Every number here moves only
## because something outside this process asked the engine to move it.
##
## It DOES build one thing at boot: bp_probe_bound's key binding. That is fixture setup,
## not input — no InputEvent is produced, and the distinction is what the total_events
## check at the end of the probe holds it to. The reason it lives here rather than in
## project.godot is anim_probe.gd's, verbatim: SERIALISED SUB-RESOURCES DRIFT ACROSS THE
## MATRIX. A binding written into project.godot's [input] section by Godot 4.7 carries
## `device: 16` and matched there, but NOT on 4.3 or 4.5, where a key injection reached
## the listener and never reached the InputMap — measured on all three arms, and the exact
## failure that made this the runtime way round. Built here, the binding's device is the
## default 0 and so is an injected event's, so they match by equality on every version
## rather than by whatever each engine happens to call "all devices".
##
## Two instruments, because the branches are observable in two different ways:
##
##   * key / mouse_button / mouse_motion arrive as real InputEvents, so _input records
##     them and the probe reads the counters back with runtime_get_property.
##   * `action` does NOT. Input.action_press writes InputMap state directly and
##     generates no InputEvent at all (measured: 0 events across a press/release pair),
##     so the action lane is polled in _process instead. total_events is what makes
##     that difference assertable rather than assumed.

# --- InputEvent lane: what actually arrived -----------------------------------
var total_events := 0
var key_count := 0
var last_keycode := 0
var last_key_pressed := false
var button_count := 0
var last_button := 0
var last_button_pressed := false
var last_button_position := Vector2.ZERO
var motion_count := 0
var last_motion_position := Vector2.ZERO
var last_motion_relative := Vector2.ZERO

# --- InputMap lane: action state, sampled every frame -------------------------
# Both actions are declared in project.godot with no events; _bind_probe_action() below
# gives bp_probe_bound exactly one (KEY_K) and leaves bp_probe_unbound with none. The pair
# is the point: a key event on the bound keycode must reach BOTH lanes, and nothing the
# probe sends may ever move the unbound one.
var bound_pressed := false
var bound_strength := 0.0
var bound_press_edges := 0
var unbound_pressed := false
var unbound_strength := 0.0

## How many events bp_probe_bound ended up bound to. The probe asserts this is 1 before it
## asserts anything else, so a binding that failed to build says so by name instead of
## surfacing later as "the tool did not route a key to the InputMap".
var bound_event_count := 0

## The keycode bp_probe_bound is bound to. Read by the probe over runtime_get_property
## rather than duplicated there, so the fixture and the probe cannot drift apart silently.
## A var rather than a const deliberately: Object.get() resolves properties, not script
## constants, so a const here would read back as null through the tool.
var bound_keycode := KEY_K


func _ready() -> void:
	set_process_input(true)
	set_process(true)
	_bind_probe_action()


func _bind_probe_action() -> void:
	# project.godot declares bp_probe_bound with NO events (see the header for why the
	# binding is not serialised there). Device is left at its default 0, which is what an
	# injected InputEventKey also carries — equality, rather than a per-version
	# "all devices" sentinel.
	if not InputMap.has_action("bp_probe_bound"):
		push_error("[input_probe] bp_probe_bound is missing from the project's InputMap")
		return
	var ev := InputEventKey.new()
	ev.keycode = bound_keycode
	ev.physical_keycode = 0
	ev.pressed = false
	InputMap.action_erase_events("bp_probe_bound")
	InputMap.action_add_event("bp_probe_bound", ev)
	bound_event_count = InputMap.action_get_events("bp_probe_bound").size()


func _input(event: InputEvent) -> void:
	total_events += 1
	if event is InputEventKey:
		var k := event as InputEventKey
		key_count += 1
		last_keycode = k.keycode
		last_key_pressed = k.pressed
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		button_count += 1
		last_button = mb.button_index
		last_button_pressed = mb.pressed
		last_button_position = mb.position
	elif event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		motion_count += 1
		last_motion_position = mm.position
		last_motion_relative = mm.relative


func _process(_delta: float) -> void:
	# Sampled rather than latched: action state is a level, not an edge, and the probe
	# drives it from the far side of a socket with whole frames in between.
	bound_pressed = Input.is_action_pressed("bp_probe_bound")
	bound_strength = Input.get_action_strength("bp_probe_bound")
	unbound_pressed = Input.is_action_pressed("bp_probe_unbound")
	unbound_strength = Input.get_action_strength("bp_probe_unbound")
	# The one edge that IS counted. A press/release pair that never became pressed at
	# all would still leave bound_pressed false at every sample the probe happens to
	# take; this cannot be missed the same way.
	if Input.is_action_just_pressed("bp_probe_bound"):
		bound_press_edges += 1
