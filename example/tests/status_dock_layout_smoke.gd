extends SceneTree
## Headless regression for issue #124 — the status dock must fit in a dock slot.
##
## An editor dock slot cannot scroll and cannot be shrunk below its content's
## minimum size, so a dock that reports a huge minimum is NOT clipped: it raises
## the minimum size of the whole editor layout, and the editor satisfies that by
## pushing the bottom panel and the lower-left docks out of the window. The
## reporter saw exactly that — no bottom panel, no FileSystem dock, and the
## inverse under distraction-free mode (hiding the side docks removed the
## oversized minimum, so the bottom panel came back).
##
## Measured in a real headless editor before the fix / after it:
##
##   dock          before            after      built-in docks for scale
##   Breakpoint    311 x 4015 px     192 x 0    Inspector 208x104, Signals 100x125
##
## The 4015 px came from three AUTOWRAP_WORD_SMART Labels: a Label with autowrap
## reports a minimum height measured at its NARROWEST possible width (~17 px, one
## glyph), so they claimed 740 + 1328 + 1421 px and the VBoxContainer summed them.
## The 311 px width came from one un-trimmed status line, against a 280 px default
## dock column.
##
## Both halves are asserted twice over — once as the NUMBER that actually
## constrains the editor, and once as the STRUCTURE that keeps the number true, so
## this still fails on the unfixed addon on a Godot build whose fonts differ from
## the one the numbers were measured on.
##
## Prints DOCK_LAYOUT_PASS/FAIL per assertion + a final DOCK_LAYOUT_SUMMARY
## pass=<n>/<total>; quits non-zero on any failure. Run:
##   godot --headless --path example --script res://tests/status_dock_layout_smoke.gd

const Dock := preload("res://addons/breakpoint_mcp/status_dock.gd")

## The widest a dock may be and still fit the editor's default right-hand dock
## column (editor_layout.cfg writes `dock_hsplit_3=-280` for a default layout).
const SLOT_WIDTH_PX := 280.0

## Generous ceiling on minimum height: every built-in dock sits at 104-125 px, and
## the fix takes this dock to 0 (the ScrollContainer absorbs content height). The
## unfixed addon reports 529 px here and 4015 px in a real editor.
const MAX_MIN_HEIGHT_PX := 200.0

## A realistic long project path — _refresh() puts one in the Config label, and it
## is the autowrap Label that claimed the most height (1328 px) in the editor.
const SAMPLE_PATH := "C:/Users/SomeDeveloper/Documents/Godot Projects/MyGame"

var _pass := 0
var _fail := 0
var _dock: Control = null


## Builds the real UI but skips _ready()'s _refresh(), which reaches for
## EditorInterface and cannot run outside an editor. _build_ui() is the method
## under test — it is what decides the dock's minimum size.
class _UiOnlyDock extends Dock:
	func _ready() -> void:
		_build_ui()


func _check(label: String, cond: bool, detail: String = "") -> void:
	if cond:
		_pass += 1
		print("DOCK_LAYOUT_PASS %s" % label)
	else:
		_fail += 1
		print("DOCK_LAYOUT_FAIL %s%s" % [label, ("  " + detail) if detail != "" else ""])


## The dock's content container, or null. Guarded with `in` rather than accessed
## directly so that an addon WITHOUT the fix fails these assertions cleanly
## instead of aborting the run on a missing property.
func _body_node() -> Node:
	if not ("_body" in _dock):
		return null
	return _dock._body


func _autowrap_labels() -> Array:
	var out: Array = []
	var body := _body_node()
	if body == null:
		return out
	for c in body.get_children():
		var l := c as Label
		if l != null and l.autowrap_mode != TextServer.AUTOWRAP_OFF:
			out.append(l)
	return out


func _initialize() -> void:
	_dock = _UiOnlyDock.new()
	root.add_child(_dock)
	# NB: _ready() has NOT run yet here, so the widgets do not exist and the text
	# below cannot be installed until _process. Setting it here silently failed on
	# a Nil base and left every autowrap Label empty — i.e. measuring nothing.


## Reproduce the text _refresh() would install, so the autowrap Labels carry the
## same content they do in a live editor. Their minimum height is what exploded,
## and it is a function of that text, so an empty dock measures nothing.
func _populate() -> void:
	_dock._config_label.text = "project  %s\neditor 9080 · runtime 9081 · lsp 6005 · dap 6006" % SAMPLE_PATH
	_dock._set_plane("editor", "ok", "127.0.0.1:9080 · 1 client")
	_dock._set_plane("runtime", "fail", "127.0.0.1:9081 unreachable")
	_dock._set_plane("lsp", "ok", "127.0.0.1:6005 reachable")
	_dock._set_plane("dap", "fail", "127.0.0.1:6006 no response")
	_dock._update_pause_ui()


func _process(_delta: float) -> bool:
	# One frame in: _ready() has built the UI and the containers have sorted once.
	_populate()
	_run()
	print("DOCK_LAYOUT_SUMMARY pass=%d/%d" % [_pass, _pass + _fail])
	quit(1 if _fail > 0 else 0)
	return true


func _run() -> void:
	# --- A. the numbers the editor layout actually reads ---------------------
	var minimum: Vector2 = _dock.get_combined_minimum_size()
	print("DOCK_LAYOUT_INFO min=%s" % minimum)
	_check("min_width_fits_default_slot", minimum.x <= SLOT_WIDTH_PX,
		"min width %.0f px > %.0f px slot" % [minimum.x, SLOT_WIDTH_PX])
	_check("min_height_in_builtin_league", minimum.y <= MAX_MIN_HEIGHT_PX,
		"min height %.0f px > %.0f px budget" % [minimum.y, MAX_MIN_HEIGHT_PX])

	# --- B. the structure that keeps those numbers true ---------------------
	# Height: no Control may hang off the dock root, or it bypasses the scroll
	# view and puts its own minimum height straight into the editor's layout.
	# (The four status rows were added to the root by mistake mid-fix; this is
	# the assertion that caught it.)
	var root_controls: Array = []
	var scrolls := 0
	for c in _dock.get_children():
		if c is ScrollContainer:
			scrolls += 1
		elif c is Control:
			root_controls.append((c as Control).get_class())
	_check("single_scrollcontainer_at_root", scrolls == 1, "found %d" % scrolls)
	_check("no_control_bypasses_the_scrollview", root_controls.is_empty(),
		"parented to the dock root: %s" % str(root_controls))
	var body := _body_node()
	_check("body_holds_every_widget", body != null and body.get_child_count() >= 15,
		"body child count %d" % (body.get_child_count() if body != null else -1))

	# Width: a Label that does not wrap reports its whole text width as a
	# minimum, so each one must trim instead of widening the dock.
	var untrimmed: Array = []
	for c in (body.get_children() if body != null else _dock.get_children()):
		var l := c as Label
		if l != null and l.autowrap_mode == TextServer.AUTOWRAP_OFF:
			if l.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
				untrimmed.append(l.text)
	_check("every_fixed_label_trims", untrimmed.is_empty(), "untrimmed: %s" % str(untrimmed))

	# Trimming must not destroy the reading: the full line stays in the tooltip.
	var rows_ok := true
	for key in ["editor", "runtime", "lsp", "dap"]:
		var row: Label = _dock._rows.get(key)
		if row == null or row.tooltip_text != row.text or row.text == "":
			rows_ok = false
	_check("trimmed_rows_keep_full_text_in_tooltip", rows_ok)

	# --- C. the pathological condition, reproduced --------------------------
	# In a real editor the autowrap Labels get laid out ~17 px wide and their
	# minimum height explodes. Force that and require the budget to still hold —
	# this is the assertion that maps to the reported 4015 px.
	var wrapped: Array = _autowrap_labels()
	_check("autowrap_labels_present", wrapped.size() >= 3, "found %d" % wrapped.size())
	for l in wrapped:
		(l as Label).size = Vector2(17, 10)
	var squeezed: Vector2 = _dock.get_combined_minimum_size()
	print("DOCK_LAYOUT_INFO min_when_labels_squeezed=%s" % squeezed)
	_check("min_height_survives_narrow_autowrap", squeezed.y <= MAX_MIN_HEIGHT_PX,
		"min height %.0f px > %.0f px budget once autowrap labels are narrow" % [squeezed.y, MAX_MIN_HEIGHT_PX])
