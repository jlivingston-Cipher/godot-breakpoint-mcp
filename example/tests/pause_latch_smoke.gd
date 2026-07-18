extends SceneTree
## Headless regression for the "Pause Agent" latch (addon control surface).
##
## Two layers:
##   A. PauseLatch helpers — set/clear round-trips through the res://.godot flag
##      file and is_paused() reflects it (the cross-process source of truth the
##      runtime bridge, in the separate game process, also reads).
##   B. The editor bridge honors the latch at its dispatch seam: while paused it
##      HOLDS every new command except a liveness `ping` (rejects, no dispatch,
##      ok:false/code:paused), and resuming lets commands through again. Drives the
##      REAL bridge_server.gd over a loopback socket with a RecordingOps stub (no
##      editor needed) — the same harness bridge_auth_smoke.gd uses.
##
## Prints PAUSE_LATCH_PASS/FAIL per assertion + a final PAUSE_LATCH_SUMMARY
## pass=<n>/<total>; quits non-zero on any failure. Run:
##   godot --headless --path example --script res://tests/pause_latch_smoke.gd

const PauseLatch := preload("res://addons/breakpoint_mcp/pause_latch.gd")
const BridgeServer := preload("res://addons/breakpoint_mcp/bridge_server.gd")
const Operations := preload("res://addons/breakpoint_mcp/operations.gd")
const FLAG_PATH := "res://.godot/breakpoint_mcp.pause"
const TEST_PORT := 59094

var _pass := 0
var _fail := 0


func _check(label: String, cond: bool) -> void:
	if cond:
		_pass += 1
		print("PAUSE_LATCH_PASS %s" % label)
	else:
		_fail += 1
		print("PAUSE_LATCH_FAIL %s" % label)


## Overrides Operations so no EditorPlugin is needed (mirrors the auth smoke).
class RecordingOps extends Operations:
	var calls: Array = []

	func dispatch(method: String, params: Dictionary) -> Dictionary:
		calls.append(method)
		return {"ok": true, "result": {"echo": method}}


func _initialize() -> void:
	_run()
	print("PAUSE_LATCH_SUMMARY pass=%d/%d" % [_pass, _pass + _fail])
	quit(0 if _fail == 0 else 1)


func _connect_client() -> StreamPeerTCP:
	var client := StreamPeerTCP.new()
	client.connect_to_host("127.0.0.1", TEST_PORT)
	return client


func _pump(server: Node, client: StreamPeerTCP, ticks := 60) -> void:
	for i in range(ticks):
		client.poll()
		server._process(0.0)
		OS.delay_msec(3)


func _send_line(client: StreamPeerTCP, obj: Dictionary) -> void:
	client.put_data((JSON.stringify(obj) + "\n").to_utf8_buffer())


## Read + JSON-parse the first pending reply line from the client socket.
func _read_reply(client: StreamPeerTCP) -> Dictionary:
	client.poll()
	var n := client.get_available_bytes()
	if n <= 0:
		return {}
	var chunk := client.get_data(n)
	if chunk[0] != OK:
		return {}
	var text: String = (chunk[1] as PackedByteArray).get_string_from_utf8()
	var line := text.split("\n")[0].strip_edges()
	var parsed: Variant = JSON.parse_string(line)
	return parsed if typeof(parsed) == TYPE_DICTIONARY else {}


func _run() -> void:
	# --- A. PauseLatch helpers (pure, flag-file round-trip) --------------------
	PauseLatch.set_paused(false)
	_check("starts_unpaused", not PauseLatch.is_paused())
	PauseLatch.set_paused(true)
	_check("engages", PauseLatch.is_paused())
	_check("flag_file_written", FileAccess.file_exists(FLAG_PATH))
	PauseLatch.set_paused(false)
	_check("clears", not PauseLatch.is_paused())
	_check("flag_file_removed", not FileAccess.file_exists(FLAG_PATH))

	# --- B. The editor bridge honors the latch at the dispatch seam ------------
	OS.set_environment("BREAKPOINT_BRIDGE_INSECURE", "1")  # focus on pause, not auth
	OS.set_environment("BREAKPOINT_BRIDGE_PORT", str(TEST_PORT))
	PauseLatch.set_paused(false)
	var server: Node = BridgeServer.new()
	server._ready()
	_check("server.listening", bool(server.get_status().get("listening", false)))
	var ops := RecordingOps.new()
	server._ops = ops

	# Not paused: a normal command dispatches.
	var c1 := _connect_client()
	_pump(server, c1)
	_send_line(c1, {"id": "1", "method": "scene.save", "params": {}})
	_pump(server, c1)
	_check("running_dispatches", ops.calls.has("scene.save"))
	c1.disconnect_from_host()

	# Paused: the same command is HELD (not dispatched); reply is a paused error.
	PauseLatch.set_paused(true)
	ops.calls.clear()
	var c2 := _connect_client()
	_pump(server, c2)
	_send_line(c2, {"id": "2", "method": "scene.save", "params": {}})
	_pump(server, c2)
	_check("paused_holds_command", not ops.calls.has("scene.save"))
	_check("paused_dispatched_nothing", ops.calls.size() == 0)
	var reply := _read_reply(c2)
	_check("paused_reply_is_error",
		reply.get("ok", true) == false and String(reply.get("error", {}).get("code", "")) == "paused")
	# A bare ping still answers while paused (liveness).
	_send_line(c2, {"id": "3", "method": "ping", "params": {}})
	_pump(server, c2)
	_check("paused_ping_still_dispatches", ops.calls.has("ping"))
	c2.disconnect_from_host()

	# Resume: commands flow again.
	PauseLatch.set_paused(false)
	ops.calls.clear()
	var c3 := _connect_client()
	_pump(server, c3)
	_send_line(c3, {"id": "4", "method": "scene.save", "params": {}})
	_pump(server, c3)
	_check("resume_dispatches", ops.calls.has("scene.save"))
	c3.disconnect_from_host()

	server.shutdown()
	server.free()
	PauseLatch.set_paused(false)  # leave the example project clean
