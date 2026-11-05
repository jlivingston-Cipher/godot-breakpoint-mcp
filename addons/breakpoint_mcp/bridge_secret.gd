@tool
extends RefCounted
## Shared loopback-bridge auth: a per-project secret + a constant-time compare.
##
## The secret is a 64-char hex string minted once per project and stored at
## res://.godot/breakpoint_mcp.secret. The .godot dir is engine-managed and, by
## Godot convention, git-ignored — so the secret never lands in version control.
## Both bridges in a project (the editor bridge_server and the runtime autoload)
## read the SAME file, and the Node host reads it too, from
## <projectPath>/.godot/breakpoint_mcp.secret — so all three agree with ZERO user
## configuration. Host-side an env override (BREAKPOINT_BRIDGE_SECRET /
## BREAKPOINT_RUNTIME_SECRET) wins, for advanced / host-launched-child cases.
##
## Why: the loopback bind (127.0.0.1) is the only access control otherwise, so any
## OTHER local process on a shared machine could drive the bridge — including the
## destructive editor ops that are elicitation-gated in the HOST. A direct socket
## bypasses that host gate; requiring this handshake moves the gate's teeth to the
## addon. Defense-in-depth, not a remote-RCE fix (loopback already blocks the net).

const SECRET_PATH := "res://.godot/breakpoint_mcp.secret"
## The shortest BREAKPOINT_RUNTIME_SECRET an opted-in debug export accepts (see
## runtime_listen_policy). The minted secret is 64 hex characters.
const EXPORT_SECRET_MIN_LEN := 32
## 🆕 BP-0037 — the project setting that turns strict mode on (default false, opt-in through
## 1.x). Under it the plugin registers no autoload, the game attaches runtime_bridge.gd
## itself from its own debug-only code, and the bridge listens only with the switch.
const STRICT_SETTING := "breakpoint_mcp/runtime/strict"
## 🆕 BP-0037 — the developer switch: this environment variable set to 1/true, or this user
## argument after `--` on the game's command line.
const SWITCH_ENV := "BREAKPOINT_RUNTIME"
const SWITCH_ARG := "--breakpoint-runtime"


## Return the shared secret, minting + persisting a fresh one if none exists.
## Returns "" ONLY on an unrecoverable IO error — the caller then runs WITHOUT
## auth (logging a warning) rather than bricking the bridge.
static func load_or_mint() -> String:
	if FileAccess.file_exists(SECRET_PATH):
		var rf := FileAccess.open(SECRET_PATH, FileAccess.READ)
		if rf != null:
			var existing := rf.get_as_text().strip_edges()
			rf = null
			if existing.length() > 0:
				return existing
	# Mint 32 cryptographically-random bytes -> 64 hex chars.
	var crypto := Crypto.new()
	var hex := crypto.generate_random_bytes(32).hex_encode()
	var godot_dir := ProjectSettings.globalize_path("res://.godot")
	if not DirAccess.dir_exists_absolute(godot_dir):
		DirAccess.make_dir_recursive_absolute(godot_dir)
	var wf := FileAccess.open(SECRET_PATH, FileAccess.WRITE)
	if wf == null:
		return ""
	wf.store_string(hex)
	wf = null
	return hex


## 🔴 325 (BP-0023) — WHETHER THE RUNTIME BRIDGE MAY LISTEN AT ALL, decided before any
## socket is opened or any file is touched. The plugin registers runtime_bridge.gd as an
## autoload, and an autoload ships inside every export: a game built with this addon
## switched on opened 127.0.0.1:9081 on every launch. Measured on macOS against the
## official 4.7 release template (325): from an app bundle the game cannot write to — a
## quarantined download, an App Store or administrator install — the mint fails and the
## bridge ran with NO authentication, answering `runtime.call_method`; from a bundle it
## can write to, it minted a secret INTO Contents/Resources/.godot/, a file written inside
## the player's copy of a shipped app.
##
## The rule: listen only in a development run — a game started by an EDITOR build (the
## editor's Run buttons, Breakpoint's own launchers, CI): see is_development_build for why
## that is "editor" AND NOT "template". An exported DEBUG build may opt in with
## BREAKPOINT_RUNTIME_EXPORTED=1, and only with its secret supplied in
## BREAKPOINT_RUNTIME_SECRET (the same variable the host reads): an export never mints, so
## it never writes into its own install and never runs open. A RELEASE export never
## listens, whatever its environment says.
##
## Pure — no OS calls, no files — so the decision is unit-tested headless; the caller
## passes the four facts in. `warn` is true only when someone ASKED for an exported
## bridge and is being refused; a plain shipped game stays silent.
##
## 🆕 BP-0037 — TWO MORE FACTS, AND ONE TEST MOVED TO THE FRONT. `debug_build` is now read
## FIRST, ahead of every other test: a build where OS.is_debug_build() is false never
## listens, whatever else is true of it (the only such build that reaches here is a release
## export, which already never listened, so nothing changes for a project that does not
## opt in). `strict` is the project setting `breakpoint_mcp/runtime/strict` (STRICT_SETTING,
## default false); when it is true the bridge listens only with the developer switch —
## BREAKPOINT_RUNTIME=1 in the environment or `--breakpoint-runtime` after `--` — which
## Breakpoint's own game launchers set (runtime_switch_on). Strict is opt-in through 1.x.
static func runtime_listen_policy(editor_build: bool, debug_build: bool, exported_optin: String, env_secret: String, strict: bool = false, switch_on: bool = false) -> Dictionary:
	var optin := exported_optin.strip_edges().to_lower()
	var asked := optin == "1" or optin == "true" or (strict and switch_on)
	if not debug_build:
		return {"listen": false, "secret_source": "", "warn": asked, "reason": "not a debug build (OS.is_debug_build() is false): the runtime bridge never listens in a release build, whatever its environment says"}
	if strict and not switch_on:
		return {"listen": false, "secret_source": "", "warn": optin == "1" or optin == "true", "reason": "strict mode (%s=true): the runtime bridge listens only with BREAKPOINT_RUNTIME=1 or --breakpoint-runtime" % STRICT_SETTING}
	if editor_build:
		return {"listen": true, "secret_source": "project", "warn": false, "reason": "development run (editor build)"}
	if not (optin == "1" or optin == "true"):
		return {"listen": false, "secret_source": "", "warn": false, "reason": "exported build: the runtime bridge listens only in development runs"}
	if env_secret.strip_edges().length() < EXPORT_SECRET_MIN_LEN:
		return {"listen": false, "secret_source": "", "warn": true, "reason": "BREAKPOINT_RUNTIME_EXPORTED=1 needs BREAKPOINT_RUNTIME_SECRET of at least %d characters; an exported build never mints its own" % EXPORT_SECRET_MIN_LEN}
	# The validated secret travels IN the decision, so nothing downstream re-reads the
	# environment and could see a different value from the one checked here.
	return {"listen": true, "secret_source": "env", "secret": env_secret.strip_edges(), "warn": false, "reason": "debug export, opted in with BREAKPOINT_RUNTIME_EXPORTED"}


## 🆕 BP-0037 — whether the developer switch is set. Pure, like the policy: the caller passes
## OS.get_environment(SWITCH_ENV) and OS.get_cmdline_user_args().
static func runtime_switch_on(env_value: String, user_args: PackedStringArray) -> bool:
	var v := env_value.strip_edges().to_lower()
	return v == "1" or v == "true" or user_args.has(SWITCH_ARG)


## 🆕 BP-0037 — whether this project is in strict mode. Strict only on a real `true`: a
## missing setting, or any other value, is the 1.x default (not strict).
static func runtime_strict(setting_value: Variant) -> bool:
	if typeof(setting_value) != TYPE_BOOL:
		return false
	var on: bool = setting_value  # a bool already: BP-0025's strict-typing form of bool(setting_value)
	return on


## A development run is an EDITOR build that is NOT an export TEMPLATE. Both are compiled-in
## feature tags, and the second condition is what makes the first trustworthy: custom
## features — an export preset's list, or `_custom_features` in an override.cfg, which the
## official templates read from beside the game by default — can ADD "editor" to a
## template's tags but can never remove "template" (325, review finding 1). Pure, so both
## halves are unit-tested; runtime_bridge.gd passes OS.has_feature() for each.
static func is_development_build(has_editor: bool, has_template: bool) -> bool:
	return has_editor and not has_template


## Constant-time equality over the UTF-8 bytes of two strings. Folds any length
## difference into the result and always scans the longer input, so it never
## short-circuits on the first differing byte (no timing side channel on the
## secret's content). The secret's length is fixed (64) and not itself sensitive.
static func const_time_eq(a: String, b: String) -> bool:
	var ab := a.to_utf8_buffer()
	var bb := b.to_utf8_buffer()
	var diff: int = ab.size() ^ bb.size()
	var n: int = ab.size() if ab.size() > bb.size() else bb.size()
	for i in n:
		var x: int = ab[i] if i < ab.size() else 0
		var y: int = bb[i] if i < bb.size() else 0
		diff |= x ^ y
	return diff == 0
