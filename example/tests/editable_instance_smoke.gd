extends SceneTree
## Headless proof for Finding-A save-persistence — the "Editable Children"
## mechanism behind `card_instance persist:true` and the `node_set_editable_instance`
## tool. Without an editor, bridge, or GUI it demonstrates the exact behaviour the
## tool relies on:
##   * a SEALED sub-scene instance does NOT serialize property overrides on its
##     internal nodes — they revert to the template default on reload (this is the
##     Finding-A baseline: card_instance data binds live but reverts on save), and
##   * enabling editable-instance (Node.set_editable_instance) DOES serialize those
##     overrides, so the authored value survives a pack -> save -> reload round-trip.
##
## `set_editable_instance` / `is_editable_instance` are runtime Node methods (they
## "also work in release builds"), and PackedScene.pack() honours the flag, so this
## round-trip reproduces what the editor does on save. It is the automated guard for
## the mechanism; the live-editor pass then only has to confirm the card_instance
## tool path end-to-end against a real .tscn.
##
## Mirrors the card_build_smoke.gd rig (build -> pack -> save -> reload). Prints
## EDITABLE_INSTANCE_PASS / EDITABLE_INSTANCE_FAIL per assertion and a final
## EDITABLE_INSTANCE_SUMMARY pass=<n>/<total>; quits non-zero if anything fails so a
## CI step can gate on it. Run:
##   godot --headless --path example --script res://tests/editable_instance_smoke.gd

var _pass := 0
var _fail := 0

const TEMPLATE_PATH := "res://tests/_ei_template.tscn"
const SEALED_PATH := "res://tests/_ei_sealed.tscn"
const EDITABLE_PATH := "res://tests/_ei_editable.tscn"
const DEFAULT_TEXT := "DEFAULT_TITLE"
const OVERRIDE_TEXT := "Q3 Review"


func _initialize() -> void:
	_run()
	print("EDITABLE_INSTANCE_SUMMARY pass=%d/%d" % [_pass, _pass + _fail])
	_cleanup()
	quit(0 if _fail == 0 else 1)


func _check(label: String, cond: bool) -> void:
	if cond:
		_pass += 1
		print("EDITABLE_INSTANCE_PASS %s" % label)
	else:
		_fail += 1
		print("EDITABLE_INSTANCE_FAIL %s" % label)


## A minimal card-shaped template: root Control "Card" with a Label "title" whose
## default text stands in for a slot default.
func _build_template() -> void:
	var card := Control.new()
	card.name = "Card"
	var title := Label.new()
	title.name = "title"
	title.text = DEFAULT_TEXT
	card.add_child(title)
	title.owner = card
	var ps := PackedScene.new()
	_check("template.packs", ps.pack(card) == OK)
	_check("template.saves", ResourceSaver.save(ps, TEMPLATE_PATH) == OK)
	card.free()


## Instance the template under a fresh root, mutate its internal slot (what
## set_data does at author time), optionally enable editable-instance, then
## pack + save the parent scene. Returns nothing; asserts along the way.
func _make_parent(editable: bool, save_path: String) -> void:
	var template := ResourceLoader.load(TEMPLATE_PATH) as PackedScene
	var root := Node.new()
	root.name = "Root"
	# GEN_EDIT_STATE_INSTANCE keeps the instance linkage so pack() records it as a
	# sub-scene instance (the same state the addon's node.instantiate_scene uses).
	var inst := template.instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)
	inst.name = "Card1"
	root.add_child(inst)
	inst.owner = root
	var title := inst.get_node("title") as Label
	title.text = OVERRIDE_TEXT
	if editable:
		root.set_editable_instance(inst, true)
		_check("is_editable_instance.true_after_enable", root.is_editable_instance(inst))
	var ps := PackedScene.new()
	_check("parent.packs.editable_%s" % editable, ps.pack(root) == OK)
	_check("parent.saves.editable_%s" % editable, ResourceSaver.save(ps, save_path) == OK)
	root.free()


## Reload the saved parent scene FROM DISK (ignore the resource cache so we read
## the serialized bytes, not the in-memory PackedScene) and return the card title.
func _reload_title_text(path: String) -> String:
	var scn := ResourceLoader.load(path, "", ResourceLoader.CACHE_MODE_IGNORE) as PackedScene
	var root := scn.instantiate()
	var text := String((root.get_node("Card1/title") as Label).text)
	root.free()
	return text


func _run() -> void:
	_build_template()
	_make_parent(false, SEALED_PATH)
	_make_parent(true, EDITABLE_PATH)

	# Baseline (the Finding-A bug): a sealed instance's override is NOT serialized,
	# so the reloaded card reverts to the template default.
	var sealed_text := _reload_title_text(SEALED_PATH)
	_check("sealed.reverts_to_default_on_reload", sealed_text == DEFAULT_TEXT)

	# The fix: with editable-instance enabled, the override IS serialized, so the
	# authored value survives the round-trip.
	var editable_text := _reload_title_text(EDITABLE_PATH)
	_check("editable.persists_override_on_reload", editable_text == OVERRIDE_TEXT)


func _cleanup() -> void:
	for p in [TEMPLATE_PATH, SEALED_PATH, EDITABLE_PATH]:
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
