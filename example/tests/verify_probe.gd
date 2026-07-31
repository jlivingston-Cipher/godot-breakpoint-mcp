extends Node2D
## Deterministic fixture for the verification-family integration probe.
##
## The five verification tools (runtime_assert_node_state / _scene_structure / _perf /
## _screen_text, and runtime_state_digest) had host unit tests against a MOCKED bridge
## and no live coverage against a real running game. #141 closed that gap for
## runtime_screenshot_diff and for nothing else; the handoffs then carried
## "runtime_screenshot_diff has zero coverage" forward for four sessions while the
## family around it stayed genuinely untested.
##
## res://main.tscn cannot serve as the fixture: it contains no Control with a `text`
## property at all, so _assert_screen_text's positive path — the SceneTree walk, the
## visibility filter, the regex and case options — has never executed anywhere in this
## repository, on any machine.
##
## Two labels, and the DIFFERENCE between them is the point:
##   * VisibleLabel — on screen, so its text MUST be found.
##   * HiddenLabel  — in the tree, with the same shape and `visible = false`, so its
##     text MUST NOT be found. _assert_screen_text skips nodes that fail
##     is_visible_in_tree(); against a fixture with only a visible label, an
##     implementation that never checks visibility at all passes just as well.
##
## `counter` mirrors example/player.gd so the node-state assertions read a plain int
## the probe can also drive through runtime_set_property — which is what proves the
## assert reads LIVE state rather than a value captured when the socket opened. That
## is the same class of bug #146 found in the authoring probe.
##
## Deliberately no _process / _physics_process: every value here is stable unless the
## probe changes it, so object/node_count is a legitimate tolerance-0 perf baseline
## and a failing assertion means the tool, not the clock.
##
## Driven headless by the runtime-plane CI job; see
## host/test-integration/verification-family.integration.mjs.
## Not a @tool: it runs in the game, not the editor.

var counter: int = 100


func _ready() -> void:
	print("[verify_probe] ready; counter=%d" % counter)
