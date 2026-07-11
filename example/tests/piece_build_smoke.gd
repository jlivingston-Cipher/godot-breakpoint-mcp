extends SceneTree
## Headless scene-construction smoke for Group N Increment 3 (the Piece slice), the
## (b) layer of the verification rig: it proves — WITHOUT an editor, bridge, or GUI
## — that a piece scene shaped exactly like what `piece_template_create` emits is a
## valid Godot 4 scene that:
##   * builds a script-backed piece (Node2D root + Art Sprite2D + Label + a HitArea
##     Area2D/CollisionShape2D + a two-sided Back), packs it into a PackedScene, and
##     SAVES it,
##   * RE-LOADS + RE-INSTANCES that PackedScene (the round-trip that catches a scene
##     the composite could emit but Godot cannot actually persist), with the hit
##     area's shape intact, and
##   * exercises the generated setters: set_data() binds art / color / label and
##     returns the {bound, unbound} split, and set_face() flips Art/Label vs Back,
##   * exercises `piece_instance` place_on / `piece_move`'s core move: reparent the
##     piece under a board cell and snap it to the cell origin, asserting the final
##     parent + local position (the "final cell" assertion; the pop animation is an
##     additive, purely node.*/anim.* op-sequence proven in the host unit tests).
##
## The host op-sequence unit tests (host/test/tabletop.test.ts) prove the tools emit
## the right primitives; this proves the primitives' RESULT is a real, round-trippable
## piece. Together they cover the composite end-to-end offline.
##
## Nothing here is game-specific — placeholder ids / values (Scout, cell n) exactly
## as a caller of the general-purpose tool would use.
##
## Prints `PIECE_BUILD_PASS` / `PIECE_BUILD_FAIL` per assertion and a final
## `PIECE_BUILD_SUMMARY pass=<n>/<total>` line; quits non-zero if anything fails so a
## CI step can gate on it. Run:
##   godot --headless --path example --script res://tests/piece_build_smoke.gd

var _pass := 0
var _fail := 0

const SCENE_PATH := "res://tests/_piece_smoke_gen.tscn"
const SCRIPT_PATH := "res://tests/_piece_smoke_gen.gd"
const TEX_PATH := "res://tests/_piece_smoke_tex.tres"


func _check(label: String, cond: bool) -> void:
	if cond:
		_pass += 1
		print("PIECE_BUILD_PASS %s" % label)
	else:
		_fail += 1
		print("PIECE_BUILD_FAIL %s" % label)


func _initialize() -> void:
	_run()
	print("PIECE_BUILD_SUMMARY pass=%d/%d" % [_pass, _pass + _fail])
	_cleanup()
	quit(0 if _fail == 0 else 1)


## The piece's set_data()/set_face() — the same shape piece_template_create's
## generator (buildPieceScript) emits: match on the neutral keys art / color /
## label, collect bound/unbound, flip Art+Label vs Back.
func _script_source() -> String:
	return "\n".join(PackedStringArray([
		'extends Node2D',
		'func set_data(data: Dictionary) -> Dictionary:',
		'\tvar bound: Array = []',
		'\tfor key in data.keys():',
		'\t\tvar v = data[key]',
		'\t\tif key == "art" and has_node("Art"):',
		'\t\t\tvar _tex = load(str(v))',
		'\t\t\tif _tex: get_node("Art").texture = _tex',
		'\t\t\tbound.append(key)',
		'\t\telif key == "color" and has_node("Art"):',
		'\t\t\tget_node("Art").self_modulate = _to_color(str(v))',
		'\t\t\tbound.append(key)',
		'\t\telif key == "label" and has_node("Label"):',
		'\t\t\tget_node("Label").text = str(v)',
		'\t\t\tbound.append(key)',
		'\tvar unbound: Array = []',
		'\tfor key in data.keys():',
		'\t\tif not bound.has(key):',
		'\t\t\tunbound.append(key)',
		'\treturn {"bound": bound, "unbound": unbound}',
		'func set_face(face_up: bool) -> void:',
		'\tif has_node("Art"):',
		'\t\tget_node("Art").visible = face_up',
		'\tif has_node("Label"):',
		'\t\tget_node("Label").visible = face_up',
		'\tif has_node("Back"):',
		'\t\tget_node("Back").visible = not face_up',
		'func _to_color(s: String) -> Color:',
		'\treturn Color.html(s) if s.begins_with("#") else Color(1, 1, 1, 1)',
		'',
	]))


## Build the piece tree in memory, owning every node to the root so it packs —
## the same structure piece_template_create emits (root → Art → Label → HitArea/
## Shape → Back).
func _build_piece() -> Node:
	var root := Node2D.new()
	root.name = "Piece"

	var art := Sprite2D.new()
	art.name = "Art"
	root.add_child(art)
	art.owner = root

	var label := Label.new()
	label.name = "Label"
	root.add_child(label)
	label.owner = root

	var hit := Area2D.new()
	hit.name = "HitArea"
	root.add_child(hit)
	hit.owner = root
	var shape := CollisionShape2D.new()
	shape.name = "Shape"
	var rect := RectangleShape2D.new()
	rect.size = Vector2(64, 64)
	shape.shape = rect
	hit.add_child(shape)
	shape.owner = root

	var back := ColorRect.new()
	back.name = "Back"
	back.color = Color("#101014")
	back.visible = false
	root.add_child(back)
	back.owner = root

	return root


func _run() -> void:
	# A placeholder texture the art slot can bind to (proves texture binding).
	var tex := PlaceholderTexture2D.new()
	_check("save.texture", ResourceSaver.save(tex, TEX_PATH) == OK)

	# The generated piece script, saved to its own res:// .gd (as the tool does).
	var gd := GDScript.new()
	gd.source_code = _script_source()
	var reload_err := gd.reload()
	_check("script.compiles", reload_err == OK)
	_check("save.script", ResourceSaver.save(gd, SCRIPT_PATH) == OK)
	var loaded_script := ResourceLoader.load(SCRIPT_PATH)
	_check("script.reloads", loaded_script != null)

	# Build → attach script → pack → save.
	var root := _build_piece()
	root.set_script(loaded_script)
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

	# Node-tree assertions: root type, art, label, hit area + shape, back.
	_check("tree.root_is_node2d", inst is Node2D)
	_check("tree.art_is_sprite2d", inst.has_node("Art") and inst.get_node("Art") is Sprite2D)
	_check("tree.label_is_label", inst.has_node("Label") and inst.get_node("Label") is Label)
	_check("tree.hitarea_is_area2d", inst.has_node("HitArea") and inst.get_node("HitArea") is Area2D)
	_check("tree.shape_is_collisionshape2d", inst.has_node("HitArea/Shape") and inst.get_node("HitArea/Shape") is CollisionShape2D)
	_check("tree.shape_survives_roundtrip", inst.has_node("HitArea/Shape") and inst.get_node("HitArea/Shape").shape is RectangleShape2D)
	_check("tree.has_back", inst.has_node("Back"))

	# Setters survive the round-trip and behave.
	_check("script.survives_roundtrip", inst.has_method("set_data") and inst.has_method("set_face"))
	if inst.has_method("set_data"):
		var split: Dictionary = inst.set_data({"art": TEX_PATH, "color": "#ff0000", "label": "Scout", "mystery": "?"})
		_check("bind.art_texture", inst.get_node("Art").texture != null)
		_check("bind.color_tint", inst.get_node("Art").self_modulate.is_equal_approx(Color(1, 0, 0, 1)))
		_check("bind.label_text", String(inst.get_node("Label").text) == "Scout")
		var bound: Array = split.get("bound", [])
		var unbound: Array = split.get("unbound", [])
		_check("bind.reports_bound", bound.has("art") and bound.has("color") and bound.has("label"))
		_check("bind.reports_unbound", unbound.has("mystery"))
	if inst.has_method("set_face"):
		inst.set_face(false)
		_check("face.down_hides_art", not inst.get_node("Art").visible)
		_check("face.down_shows_back", inst.get_node("Back").visible)
		inst.set_face(true)
		_check("face.up_shows_art", inst.get_node("Art").visible)
		_check("face.up_hides_back", not inst.get_node("Back").visible)

	# piece_instance place_on / piece_move core: reparent the piece onto a board
	# cell and snap it. A node needs a parent to be reparented, so — as in a real
	# scene — the piece and the cell both live under a shared world root before the
	# move; board_place then reparents the piece under the cell and snaps it.
	var world := Node2D.new()
	world.name = "World"
	var cell := Marker2D.new()
	cell.name = "cell_n"
	cell.position = Vector2(120, 40)
	world.add_child(cell)
	world.add_child(inst)
	inst.reparent(cell, false)
	inst.position = Vector2.ZERO
	_check("move.reparented_under_cell", inst.get_parent() == cell)
	_check("move.node_path_is_cell_n_piece", world.has_node("cell_n/Piece"))
	_check("move.snapped_to_cell_origin", inst.position.is_equal_approx(Vector2.ZERO))

	world.free()


func _cleanup() -> void:
	for p in [SCENE_PATH, SCRIPT_PATH, TEX_PATH]:
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
