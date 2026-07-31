extends Node2D

## Observer for the tree-shape plane (res://tests/tree_probe.tscn).
##
## INERT WITH RESPECT TO TREE SHAPE. This lane's subject is what runtime_get_tree
## reports, so this script must not compete with the tool under test: it never adds,
## removes, renames or reparents a node, and _ready() touches nothing but its own
## signal connections. The probe holds that to account by asserting the exact tree --
## node for node, at full depth -- BEFORE it emits anything.
##
## THE SIGNAL SIDE. runtime_emit_signal had no live coverage either, and its two
## interesting behaviours cannot be observed from the tool's own reply:
##
##   * ARITY. Godot's emit_signal returns an Error the tool used to discard, so a
##     wrong `args` count answered {"emitted": true} while no callable ran. `two_seen`
##     is the instrument: it moves only when a handler actually executed.
##
##   * DECODE. Codec.decode turns {"__type__":"Vector2",...} into a real Vector2 --
##     but reading `two_a` back through runtime_get_property RE-ENCODES it to exactly
##     that same JSON, so the wire cannot tell a decoded Vector2 from an undecoded
##     Dictionary. `two_a_type` records typeof() at receipt, INSIDE the engine, which
##     is the only place the difference exists. TYPE_VECTOR2 == 5, TYPE_DICTIONARY == 27.
##
## Every counter is a `var`, never a `const`: Object.get() does not resolve script
## constants and runtime_get_property would read them back as null (#155 §7).

## Two required arguments -- the arity the emit guard is checked against.
signal probe_two(a: Variant, b: Variant)

## Zero arguments -- the control. Proves the guard rejects a MISMATCH rather than
## rejecting every emission that carries no args.
signal probe_none()

## DECLARED AND DELIBERATELY NEVER CONNECTED. emit_signal returns ERR_UNAVAILABLE (2)
## for a signal with no connections, which is NOT a failure -- emitting into the void is
## what a game does constantly, and a guard that rejected every non-OK code turned all of
## it into an error. That regression shipped in this PR's first commit and the repo's own
## ops_unit_test.gd caught it, so the branch is now covered here rather than trusted.
##
## It is also the honest limit of the arity check: with nothing connected, a WRONG
## argument count returns ERR_UNAVAILABLE too, because there is no callable whose arity
## could mismatch. The probe asserts exactly that and claims nothing more.
signal probe_lonely(x: Variant)

var two_seen: int = 0
var two_a: Variant = null
var two_b: Variant = null
var two_a_type: int = -1
var none_seen: int = 0

func _ready() -> void:
	probe_two.connect(_on_probe_two)
	probe_none.connect(_on_probe_none)
	# probe_lonely is NOT connected here, and that is the point. Do not "fix" it.
	print("TREE_PROBE_READY children=", get_child_count())


func _on_probe_two(a: Variant, b: Variant) -> void:
	two_seen += 1
	two_a = a
	two_b = b
	two_a_type = typeof(a)


func _on_probe_none() -> void:
	none_seen += 1
