extends Node2D
## Deterministic convergence probe for the F6 multi-peer integration job.
##
## TWO LANES, deliberately, because runtime_peers_digest's convergence claim is a statement
## about both of them:
##
##   * The PHYSICS lane advances on the FIXED timestep, is guarded on `delta > 0.0`, and is the
##     only lane that draws from the GLOBAL RNG stream runtime_seed_rng seeds. It writes the
##     transform properties runtime_state_digest captures, so it is the lane the digest observes
##     and the only lane that may converge.
##   * The IDLE lane runs at WALL-CLOCK rate — it keeps firing while the game is frozen, because
##     time_scale 0 zeroes `delta` and does not stop callbacks — draws only from its OWN
##     RandomNumberGenerator, and writes only plain vars no digest field captures. It exists to
##     prove a freely-running idle lane does NOT break convergence.
##
## Those two properties are runtime_peers_digest's precondition 2, expressed as code a gate can
## check. Deleting the `delta > 0.0` guard, or moving the idle lane onto the global stream, makes
## the peers-plane CI job fail — which is the entire point of it existing. Measured on real Godot
## 4.3-stable: with both, three peers converge byte-equal even under a deliberate stagger between
## each peer's seed and step; with either violated, they diverge every time.
##
## Driven over the loopback runtime bridge, one instance per headless peer, by
## host/test-integration/runtime-peers.integration.mjs. Not a @tool: it runs in the game.

## Physics frames actually advanced (delta > 0). The driver equalises this to 0 after freezing,
## then asserts it advanced by EXACTLY the stepped frame count in every peer.
var ticks: int = 0

## Idle frames seen. Deliberately NOT equalised and NOT part of the digest: it is wall-clock, so
## it differs per process by construction. The driver reads it across a frozen window to assert
## the idle lane is still firing while `ticks` holds — the mechanism behind precondition 2.
var idle_ticks: int = 0

var _idle_rng := RandomNumberGenerator.new()
var _idle_value: float = 0.0
var _marker: Node2D = null


func _ready() -> void:
	# A fixed per-instance seed. The idle lane must be reproducible in isolation and must NEVER
	# touch the global stream, whose consumption order is the thing under test.
	_idle_rng.seed = 987654321
	_marker = get_node_or_null(^"Marker") as Node2D
	# Peers free-run between spawn and freeze for different durations (precondition 3), so nothing
	# set here survives as a common starting state — the driver freezes first, then equalises
	# `position` / `ticks` explicitly through runtime_set_property{peer}.
	position = Vector2.ZERO


func _process(_delta: float) -> void:
	# Wall-clock lane. Its own RNG, and no digest-visible writes.
	idle_ticks += 1
	_idle_value = _idle_rng.randf()


func _physics_process(delta: float) -> void:
	# PRECONDITION 2, in one line. runtime_time_scale{scale:0} zeroes `delta` but does NOT stop
	# this callback firing, so an unguarded draw would burn the global stream at wall-clock rate
	# while frozen — including in the gap between the seed call and the step call, which differs
	# per peer — and desynchronise the peers before the step even begins.
	if delta <= 0.0:
		return
	ticks += 1
	position.x += randf() * 10.0
	position.y += randf() * 10.0
	rotation += randf() * 0.01
	if _marker != null:
		_marker.position.x += randf() * 4.0
