extends SceneTree
## Headless scene-construction smoke for Group N Increment 2 (the Board slice), the
## (b) layer of the verification rig: it proves — WITHOUT an editor, bridge, or GUI
## — that a board scene shaped exactly like what `board_create` emits is a valid
## Godot 4 scene that:
##   * builds a board (Node2D root + a Background + N cell_<id> Marker2D anchors,
##     each in the `board_cells` group, positioned by the layout math), packs it
##     into a PackedScene, and SAVES it,
##   * RE-LOADS + RE-INSTANCES that PackedScene (the round-trip that catches a
##     scene the composite could emit but Godot cannot actually persist) with cell
##     positions + group membership intact, and
##   * exercises `board_place`'s move: reparent a node under a cell and snap it to
##     the cell origin, asserting the final parent + local position.
##
## The host op-sequence unit tests (host/test/tabletop.test.ts) prove the tools
## emit the right primitives; this proves the primitives' RESULT is a real,
## round-trippable board. Together they cover the composite end-to-end offline.
##
## Nothing here is game-specific — cells use placeholder ids (n / e / s / w)
## exactly as a caller of the general-purpose tool would.
##
## Prints `BOARD_BUILD_PASS` / `BOARD_BUILD_FAIL` per assertion and a final
## `BOARD_BUILD_SUMMARY pass=<n>/<total>` line; quits non-zero if anything fails so
## a CI step can gate on it. Run:
##   godot --headless --path example --script res://tests/board_build_smoke.gd

var _pass := 0
var _fail := 0

const SCENE_PATH := "res://tests/_board_smoke_gen.tscn"

# Four ring cells at the positions computeRingCells(radius=100) yields: the first
# at the top, then clockwise (y is down in Godot 2D).
const CELLS := {
	"n": Vector2(0, -100),
	"e": Vector2(100, 0),
	"s": Vector2(0, 100),
	"w": Vector2(-100, 0),
}


func _check(label: String, cond: bool) -> void:
	if cond:
		_pass += 1
		print("BOARD_BUILD_PASS %s" % label)
	else:
		_fail += 1
		print("BOARD_BUILD_FAIL %s" % label)


func _initialize() -> void:
	_run()
	print("BOARD_BUILD_SUMMARY pass=%d/%d" % [_pass, _pass + _fail])
	_cleanup()
	quit(0 if _fail == 0 else 1)


## Build the board tree in memory, owning every node to the root so it packs —
## the same structure board_create emits (root → Background → cell_<id> anchors).
func _build_board() -> Node:
	var root := Node2D.new()
	root.name = "Board"

	var bg := ColorRect.new()
	bg.name = "Background"
	bg.color = Color("#101014")
	bg.size = Vector2(400, 400)
	root.add_child(bg)
	bg.owner = root

	for id in CELLS.keys():
		var cell := Marker2D.new()
		cell.name = "cell_%s" % id
		cell.position = CELLS[id]
		root.add_child(cell)
		cell.owner = root
		cell.add_to_group("board_cells", true)

	return root


func _run() -> void:
	# Build → pack → save.
	var root := _build_board()
	var packed := PackedScene.new()
	_check("pack.ok", packed.pack(root) == OK)
	_check("save.scene", ResourceSaver.save(packed, SCENE_PATH) == OK)
	root.free()

	# Re-load + re-instance the saved PackedScene (the round-trip).
	var reloaded := ResourceLoader.load(SCENE_PATH) as PackedScene
	_check("scene.reloads", reloaded != null)
	if reloaded == null:
		return
	var inst := reloaded.instantiate()
	_check("scene.instantiates", inst != null)

	# Node-tree assertions: root type, background, addressable cells + group.
	_check("tree.root_is_node2d", inst is Node2D)
	_check("tree.has_background", inst.has_node("Background"))
	var all_cells := true
	var right_pos := true
	var grouped := true
	for id in CELLS.keys():
		var node_name := "cell_%s" % id
		if not inst.has_node(node_name):
			all_cells = false
			continue
		var cell: Node = inst.get_node(node_name)
		if not (cell is Marker2D):
			all_cells = false
		if not cell.position.is_equal_approx(CELLS[id]):
			right_pos = false
		if not cell.is_in_group("board_cells"):
			grouped = false
	_check("tree.all_cells_present", all_cells)
	_check("tree.cell_positions_survive_roundtrip", right_pos)
	_check("tree.cells_in_board_cells_group", grouped)

	# board_place: reparent a node onto a cell and snap it to the cell origin.
	var token := Marker2D.new()
	token.name = "Token"
	token.position = Vector2(999, 999)
	inst.add_child(token)
	token.owner = inst
	var target := inst.get_node("cell_n")
	token.reparent(target, false)
	token.position = Vector2.ZERO
	_check("place.reparented_under_cell", token.get_parent() == target)
	_check("place.node_path_is_cell_n_token", inst.has_node("cell_n/Token"))
	_check("place.snapped_to_cell_origin", token.position.is_equal_approx(Vector2.ZERO))

	inst.free()


func _cleanup() -> void:
	if FileAccess.file_exists(SCENE_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SCENE_PATH))
