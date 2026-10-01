extends SceneTree
## Headless regression for the loopback-bridge auth handshake (default-on).
##
## Drives the REAL bridge_server.gd over a loopback socket and asserts the three
## security invariants of the shared-secret handshake:
##   1. a request sent BEFORE authenticating is denied and NOT dispatched — the
##      destructive-op gate now has teeth at the addon, so a direct socket can't
##      bypass the host-side elicitation gate;
##   2. a WRONG secret is denied and still dispatches nothing;
##   3. the CORRECT secret authenticates, after which a request dispatches.
## Plus unit checks on BridgeSecret.const_time_eq (the constant-time compare).
##
## And (325, BP-0023) the RUNTIME bridge's listen policy: the decision table, then the
## shipped runtime_bridge.gd stood up as an exported release build (no server, the port
## refuses), as an opted-in debug export with no secret (refused), and as one with its
## secret (listens, demands that secret, and BREAKPOINT_BRIDGE_INSECURE cannot turn it off).
##
## Prints BRIDGE_AUTH_PASS/FAIL per assertion and a final BRIDGE_AUTH_SUMMARY
## pass=<n>/<total>; quits non-zero on any failure. Run:
##   godot --headless --path example --script res://tests/bridge_auth_smoke.gd

const BridgeServer := preload("res://addons/breakpoint_mcp/bridge_server.gd")
const BridgeSecret := preload("res://addons/breakpoint_mcp/bridge_secret.gd")
const Operations := preload("res://addons/breakpoint_mcp/operations.gd")
const RuntimeBridge := preload("res://addons/breakpoint_mcp/runtime_bridge.gd")
const TEST_PORT := 59093
const RUNTIME_TEST_PORT := 59094
## Every check above the completion check itself. A GDScript runtime error aborts only the
## function it occurs in and the run carries on, so a suite cut short prints a clean
## summary over FEWER checks and the CI step (which greps for FAIL) passes it. Measured at
## 325: this suite against the 1.16.0 runtime bridge stopped at `_policy_facts()` and
## printed pass=25/25. Raise this when a check is added; never lower it to make a run pass.
const EXPECTED_CHECKS := 36

var _pass := 0
var _fail := 0


func _check(label: String, cond: bool) -> void:
	if cond:
		_pass += 1
		print("BRIDGE_AUTH_PASS %s" % label)
	else:
		_fail += 1
		print("BRIDGE_AUTH_FAIL %s" % label)


## Records dispatched methods without touching the editor; overrides Operations
## so no EditorPlugin is needed (mirrors the reentrancy smoke's stub ops).
class RecordingOps extends Operations:
	var calls: Array = []

	func dispatch(method: String, params: Dictionary) -> Dictionary:
		calls.append(method)
		return {"ok": true, "result": {"echo": method}}


## 325 (BP-0023): a runtime bridge told it is an EXPORTED build. Only the four policy
## facts are overridden — the _ready(), _setup_auth() and _process() under test are the
## shipped ones — because the editor binary that runs this suite answers
## OS.has_feature("editor") true and no export template is available to CI.
class ExportedRuntimeBridge extends RuntimeBridge:
	var facts: Dictionary = {}

	func _policy_facts() -> Dictionary:
		return facts


func _initialize() -> void:
	_run()


## 325: the runtime cases need a LIVE tree — an autoload's _ready() fires when it enters
## one, and during _initialize `root` is not inside the tree yet — so they run on the
## first frame, and the summary moves here with them.
func _process(_delta: float) -> bool:
	_run_runtime_policy()
	_check("suite_ran_to_completion", _pass + _fail >= EXPECTED_CHECKS)
	print("BRIDGE_AUTH_SUMMARY pass=%d/%d" % [_pass, _pass + _fail])
	quit(0 if _fail == 0 else 1)
	return true


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


func _run() -> void:
	# --- const_time_eq unit checks (pure, no socket) ---------------------------
	_check("cteq_equal", BridgeSecret.const_time_eq("abc123", "abc123"))
	_check("cteq_diff_same_len", not BridgeSecret.const_time_eq("abc123", "abc124"))
	_check("cteq_diff_len", not BridgeSecret.const_time_eq("abc", "abcd"))
	_check("cteq_empty_vs_nonempty", not BridgeSecret.const_time_eq("", "x"))

	# Force default-on (clear any inherited insecure flag) and a hermetic port.
	OS.set_environment("BREAKPOINT_BRIDGE_INSECURE", "")
	OS.set_environment("BREAKPOINT_BRIDGE_PORT", str(TEST_PORT))
	var server: Node = BridgeServer.new()
	server._ready()  # mints/loads the secret + binds the loopback port
	_check("server.listening", bool(server.get_status().get("listening", false)))
	var secret: String = server._secret
	_check("secret_minted_nonempty", secret.length() > 0)
	_check("auth_required", bool(server._auth_required))

	var ops := RecordingOps.new()
	server._ops = ops

	# --- Case 1: a request BEFORE auth is denied and NOT dispatched. -----------
	var c1 := _connect_client()
	_pump(server, c1)  # accept the connection
	_send_line(c1, {"id": "1", "method": "scene.save", "params": {}})
	_pump(server, c1)
	_check("preauth_request_not_dispatched", ops.calls.size() == 0)
	# Authoritative closure check: the server drops the unauthenticated peer (a
	# client-side status read can lag the server's disconnect, so assert the
	# server's own client list emptied rather than the client's socket status).
	_check("preauth_dropped_by_server", server._clients.size() == 0)
	c1.disconnect_from_host()

	# --- Case 2: a WRONG secret is denied; still nothing dispatched. -----------
	var c2 := _connect_client()
	_pump(server, c2)
	_send_line(c2, {"id": "a", "method": "auth", "params": {"secret": "not-the-secret"}})
	_pump(server, c2)
	_check("wrong_secret_dropped_by_server", server._clients.size() == 0)
	_send_line(c2, {"id": "b", "method": "scene.save", "params": {}})
	_pump(server, c2)
	_check("wrong_secret_not_dispatched", ops.calls.size() == 0)
	c2.disconnect_from_host()

	# --- Case 3: the CORRECT secret authenticates; requests dispatch. ----------
	var c3 := _connect_client()
	_pump(server, c3)
	_send_line(c3, {"id": "x", "method": "auth", "params": {"secret": secret}})
	_pump(server, c3)
	_send_line(c3, {"id": "y", "method": "editor.ping", "params": {}})
	_pump(server, c3)
	_check("authed_request_dispatched", ops.calls.has("editor.ping"))
	_check("only_the_authed_request_dispatched", ops.calls.size() == 1)
	c3.disconnect_from_host()

	server.shutdown()
	server.free()


# --- 325 (BP-0023): the runtime bridge stays closed in an exported game -------------

func _policy(editor_build: bool, debug_build: bool, optin: String, secret: String) -> Dictionary:
	return BridgeSecret.runtime_listen_policy(editor_build, debug_build, optin, secret)


func _read_lines(client: StreamPeerTCP) -> Array:
	var out: Array = []
	client.poll()
	var n := client.get_available_bytes()
	if n <= 0:
		return out
	var chunk := client.get_data(n)
	if chunk[0] != OK:
		return out
	var text: String = (chunk[1] as PackedByteArray).get_string_from_utf8()
	for line in text.split("\n", false):
		var parsed: Variant = JSON.parse_string(line)
		if typeof(parsed) == TYPE_DICTIONARY:
			out.append(parsed)
	return out


func _pump_rt(rb: Node, client: StreamPeerTCP, ticks := 60) -> void:
	for i in range(ticks):
		client.poll()
		if rb.is_processing():
			rb._process(0.0)
		OS.delay_msec(3)


func _exported_bridge(facts: Dictionary) -> Node:
	var rb := ExportedRuntimeBridge.new()
	rb.facts = facts
	root.add_child(rb)  # root is live (first frame): _ready() runs now, as an autoload's would
	return rb


func _drop_bridge(rb: Node) -> void:
	root.remove_child(rb)  # _exit_tree() stops any server
	rb.free()


func _run_runtime_policy() -> void:
	var good := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	# The decision table — pure, no socket.
	var dev := _policy(true, true, "", "")
	_check("policy.dev_run_listens", bool(dev["listen"]) and dev["secret_source"] == "project")
	_check("policy.dev_run_ignores_optin_vars", bool(_policy(true, false, "1", good)["listen"]) and _policy(true, false, "1", good)["secret_source"] == "project")
	var rel := _policy(false, false, "", "")
	_check("policy.release_export_silent", not bool(rel["listen"]) and not bool(rel["warn"]))
	_check("policy.debug_export_silent", not bool(_policy(false, true, "", "")["listen"]) and not bool(_policy(false, true, "", "")["warn"]))
	var rel_opt := _policy(false, false, "1", good)
	_check("policy.release_export_refuses_optin", not bool(rel_opt["listen"]) and bool(rel_opt["warn"]))
	var no_secret := _policy(false, true, "1", "")
	_check("policy.optin_without_secret_refused", not bool(no_secret["listen"]) and bool(no_secret["warn"]))
	_check("policy.optin_short_secret_refused", not bool(_policy(false, true, "true", "short")["listen"]))
	var opted := _policy(false, true, " TRUE ", good)
	_check("policy.debug_export_optin_listens_on_env_secret", bool(opted["listen"]) and opted["secret_source"] == "env")
	_check("policy.validated_secret_travels_in_the_decision", String(opted.get("secret", "")) == good)
	# What counts as a development build: "editor" AND NOT "template". The spoof case is the
	# one that matters — custom features can add "editor" to a template, never remove "template".
	_check("devbuild.editor_binary", BridgeSecret.is_development_build(true, false))
	_check("devbuild.template_spoofing_editor_refused", not BridgeSecret.is_development_build(true, true))
	_check("devbuild.plain_template_refused", not BridgeSecret.is_development_build(false, true))
	# And the REAL facts, read by the shipped _policy_facts() on the binary running this
	# suite — an editor binary — so the override seam below is not the only thing tested.
	var real := RuntimeBridge.new()
	var real_facts: Dictionary = real._policy_facts()
	_check("real_facts.this_editor_binary_is_a_development_run", bool(real_facts["editor_build"]))
	real.free()
	_check("policy.optin_zero_is_not_optin", not bool(_policy(false, true, "0", good)["listen"]))

	OS.set_environment("BREAKPOINT_RUNTIME_PORT", str(RUNTIME_TEST_PORT))

	# Live 1: a release export. No server, no processing, nothing answers the port.
	var rb1 := _exported_bridge({"editor_build": false, "debug_build": false, "exported_optin": "", "env_secret": ""})
	_check("release_export.no_server", rb1._server == null)
	_check("release_export.not_processing", not rb1.is_processing())
	var c1 := StreamPeerTCP.new()
	c1.connect_to_host("127.0.0.1", RUNTIME_TEST_PORT)
	_pump_rt(rb1, c1)
	_check("release_export.port_refuses", c1.get_status() == StreamPeerTCP.STATUS_ERROR)
	c1.disconnect_from_host()
	# push_log is public API game code may call; it must keep working while inert.
	rb1.push_log("info", "still callable")
	_check("release_export.push_log_still_works", rb1._log.size() >= 1)
	_drop_bridge(rb1)

	# Live 2: a debug export that asked for the bridge but supplied no secret: refused.
	var rb2 := _exported_bridge({"editor_build": false, "debug_build": true, "exported_optin": "1", "env_secret": ""})
	_check("optin_no_secret.no_server", rb2._server == null)
	_drop_bridge(rb2)

	# Live 3: an opted-in debug export with its secret. It listens, demands THAT secret,
	# and BREAKPOINT_BRIDGE_INSECURE cannot switch its auth off.
	OS.set_environment("BREAKPOINT_BRIDGE_INSECURE", "1")
	var rb3 := _exported_bridge({"editor_build": false, "debug_build": true, "exported_optin": "1", "env_secret": good})
	_check("optin.listening", rb3._server != null and rb3._server.is_listening())
	_check("optin.auth_required_despite_insecure", bool(rb3._auth_required) and rb3._secret == good)
	var c3 := StreamPeerTCP.new()
	c3.connect_to_host("127.0.0.1", RUNTIME_TEST_PORT)
	_pump_rt(rb3, c3)
	_send_line(c3, {"id": 1, "method": "ping"})
	_pump_rt(rb3, c3)
	var r3 := _read_lines(c3)
	_check("optin.unauthenticated_ping_denied", r3.size() >= 1 and r3[0].get("error", {}).get("code", "") == "unauthorized")
	c3.disconnect_from_host()
	var c4 := StreamPeerTCP.new()
	c4.connect_to_host("127.0.0.1", RUNTIME_TEST_PORT)
	_pump_rt(rb3, c4)
	_send_line(c4, {"id": 2, "method": "auth", "params": {"secret": good}})
	_send_line(c4, {"id": 3, "method": "ping"})
	_pump_rt(rb3, c4)
	var r4 := _read_lines(c4)
	_check("optin.env_secret_authenticates", r4.size() >= 2 and bool(r4[0].get("ok", false)) and bool(r4[1].get("ok", false)))
	c4.disconnect_from_host()
	_drop_bridge(rb3)
	OS.set_environment("BREAKPOINT_BRIDGE_INSECURE", "")

