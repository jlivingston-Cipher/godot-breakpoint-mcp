extends Node2D
## Deterministic fixture for the runtime ANIMATION-LANE integration probe.
##
## runtime_anim_play / runtime_anim_stop / runtime_anim_get_state had host unit tests
## against a MOCKED bridge and no live coverage at all. The §6.5 audit that followed
## #152 found why it was never noticed: NO SCENE IN THIS REPOSITORY CONTAINS AN
## AnimationPlayer. main.tscn is a Node2D and an untextured Sprite2D; render_probe is a
## ColorRect; frame_step_probe and peer_converge_probe are bare movers; verify_probe is
## two labels. So _resolve_anim_player, _anim_state, _anim_play and _anim_stop — about
## sixty lines of GDScript on the far side of the socket — had never executed anywhere,
## on any machine. Exactly the hole #152 found in _assert_screen_text's positive path.
##
## The authoring plane's AUTH_ANIM_* markers are a DIFFERENT lane: they drive the
## editor-side animation authoring tools against an edited scene. They are what makes
## this gap look covered to a grep.
##
## WHY THE ANIMATIONS ARE BUILT HERE RATHER THAN EMBEDDED IN THE .tscn
## Embedded Animation/AnimationLibrary sub-resources are serialised differently across
## the 4.3 / 4.5 / 4.7 arms this fixture runs on (the library dictionary key gained a
## StringName prefix mid-4.x). Building them through the runtime API — add_track /
## track_insert_key / add_animation_library — is stable across all three and, more to
## the point, puts the fixture's contract in readable code instead of in a keyframe blob.
##
## THE TWO ANIMATIONS DIFFER IN THE WAYS THE PROBE ASSERTS ON:
##   * drift — 8 s, LOOPING, drives Marker:position:x from 0 to 800. Long enough that a
##     sub-second probe window never wraps, looping so that `from_end` has somewhere to
##     go instead of finishing on arrival. It MOVES A NODE, which is what separates
##     "the player reports playing:true" from "the animation is actually running".
##   * still — 4 s, NON-looping, drives a rotation from 0 to 0 so nothing observable
##     changes. Its only job is to have a DIFFERENT length, so `length` and
##     `current_animation` are read from the animation actually assigned rather than
##     returned as a constant that happens to match drift.
##
## NotAPlayer is a Node2D that exists solely so _resolve_anim_player's
## `not_animation_player` branch has a real node to reject — distinct from bad_path,
## which is the branch a missing node takes.
##
## Driven headless by the runtime-plane CI job; see
## host/test-integration/animation-lane.integration.mjs.
## Not a @tool: it runs in the game, not the editor.

const DRIFT := "drift"
const STILL := "still"
const DRIFT_LENGTH := 8.0
const STILL_LENGTH := 4.0
const DRIFT_TRAVEL := 800.0


func _ready() -> void:
	var ap: AnimationPlayer = $Anim
	var lib := AnimationLibrary.new()
	lib.add_animation(DRIFT, _make_drift())
	lib.add_animation(STILL, _make_still())
	# The empty name is the default library: get_animation_list() then reports the bare
	# animation names, which is what runtime_anim_get_state surfaces and the probe asserts.
	ap.add_animation_library("", lib)
	print("[anim_probe] ready; animations=%s" % [ap.get_animation_list()])


## 8 s, looping, moves Marker along x. The probe reads Marker.position through
## runtime_get_property to prove the animation drives the SCENE, not just a flag.
func _make_drift() -> Animation:
	var a := Animation.new()
	a.length = DRIFT_LENGTH
	a.loop_mode = Animation.LOOP_LINEAR
	var t := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(t, NodePath("Marker:position:x"))
	a.value_track_set_update_mode(t, Animation.UPDATE_CONTINUOUS)
	a.track_insert_key(t, 0.0, 0.0)
	a.track_insert_key(t, DRIFT_LENGTH, DRIFT_TRAVEL)
	return a


## 4 s, non-looping, deliberately inert: same shape, different length. Playing it must
## change `current_animation` and `length` and must NOT move Marker.
func _make_still() -> Animation:
	var a := Animation.new()
	a.length = STILL_LENGTH
	a.loop_mode = Animation.LOOP_NONE
	var t := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(t, NodePath("Marker:rotation"))
	a.value_track_set_update_mode(t, Animation.UPDATE_CONTINUOUS)
	a.track_insert_key(t, 0.0, 0.0)
	a.track_insert_key(t, STILL_LENGTH, 0.0)
	return a
