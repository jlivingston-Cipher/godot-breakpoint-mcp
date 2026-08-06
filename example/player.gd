extends Node2D
## Tiny script that gives every bridge plane something concrete to exercise:
##  - print() output           -> godot_output / captured console
##  - push_log()               -> runtime_get_log
##  - `counter` property       -> runtime_get_property / runtime_set_property
##  - take_damage()            -> runtime_call_method, and a good breakpoint line
##  - typed members            -> gd_completion / gd_hover / gd_diagnostics

var counter: int = 100


func _ready() -> void:
	print("[example] player ready")
	var bridge := get_node_or_null("/root/BreakpointRuntimeBridge")
	if bridge:
		bridge.push_log("info", "example scene started; counter=%d" % counter)


func _process(_delta: float) -> void:
	# Cheap activity so monitors (FPS, etc.) have something to report.
	counter += 0


## D1a: a deliberate ENGINE error, on demand. `push_error` goes through Godot's
## own error path — not through the bridge's push_log — so it reaches the runtime
## log ring only where the scriptable Logger exists (4.5+). That makes it the one
## provocation that can tell the two engine arms apart: on 4.5+ the caller's own
## response carries it in `engine_log`; on 4.3/4.4 there is nothing to carry.
## The method still RETURNS NORMALLY, which is the other half of the point —
## `isError` must stay false while `engine_log` says something went wrong.
func provoke_engine_error() -> String:
	push_error("[example] deliberate engine error for the D1a echo")
	return "provoked"


func take_damage(amount: int) -> int:
	# Put a breakpoint on the next line to validate the DAP plane.
	counter -= amount
	print("[example] took %d damage, counter now %d" % [amount, counter])
	var bridge := get_node_or_null("/root/BreakpointRuntimeBridge")
	if bridge:
		bridge.push_log("warning", "took %d damage" % amount)
	return counter
