extends Node2D
## The PackedScene payload that runtime_node_add's `scene:` branch instantiates.
##
## _node_add has TWO instantiation branches and they share nothing but the tail of the
## function: `scene:` goes through load() + PackedScene.instantiate(), `type:` through
## ClassDB.class_exists / can_instantiate / instantiate. The §2 audit in handoff 151
## ranked this pair the largest remaining runtime gap — ~44 lines of GDScript with dense
## error paths, none of it reachable from a mocked host test, which can only prove that
## `runtime.node_add` was forwarded with the right params.
##
## WHY A DEDICATED SCENE RATHER THAN AN EXISTING ONE
## Every other scene in example/tests/ is a probe fixture with a script whose _ready()
## builds state for ITS lane (anim_probe registers an animation library, frame_step_probe
## starts a mover). Instantiating one of those inside the running node-lifecycle probe
## would run that side effect inside the tree the probe is asserting on. This scene is
## deliberately inert: it moves nothing, starts nothing, and touches no node but itself.
##
## WHAT MAKES IT PROVE THE `scene:` BRANCH RATHER THAN DECORATE IT
## A bare ClassDB.instantiate("Node2D") also produces a Node2D. What it CANNOT produce is
## this scene's authored shape, so the probe asserts on the three things only a real
## PackedScene instantiation can deliver:
##
##   * the authored ROOT NAME — "Payload", used when node_add is given no `name`
##   * the authored SUBTREE — a child at Payload/Cargo, which a type: add has no way to
##     bring with it
##   * the authored PROPERTY VALUES — non-default positions on both nodes, so the scene's
##     serialised state is proved to have been applied and not just its class
##
## And `ready_ran` is the fourth: _ready() only fires when a node ENTERS THE TREE, so a
## true reading is positive evidence that parent.add_child(child) actually ran, rather
## than an instantiate whose result was described in the reply and never parented.
##
## Read back through runtime_get_property / runtime_assert_node_state /
## runtime_assert_scene_structure — all three already live-covered by #152, so this lane
## asserts through instruments that are themselves verified rather than through the tools
## under test.
##
## Driven headless by the runtime-plane CI job; see
## host/test-integration/node-lifecycle.integration.mjs.
## Not a @tool: it runs in the game, not the editor.

## Set by _ready(), which the engine calls only on entry to the SceneTree. The probe reads
## this through runtime_get_property to prove the instantiated node was really parented.
var ready_ran := false


func _ready() -> void:
	ready_ran = true
