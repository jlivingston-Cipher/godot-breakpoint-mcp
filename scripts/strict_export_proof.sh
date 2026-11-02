#!/usr/bin/env bash
# strict_export_proof.sh — BP-0037 part A: the export proof for STRICT MODE.
#
# Strict mode (`breakpoint_mcp/runtime/strict=true`, opt-in through 1.x) is what lets an
# export preset leave `addons/breakpoint_mcp/` out cleanly. Without it the plugin's autoload
# entry survives in the exported project.binary and the game boots with three errors
# (Unrecognized UID / Resource file not found / Failed to instantiate an autoload) — measured
# at 327 on Godot 4.7. This script proves the strict path on a COPY of example/:
#
#   1. the copy is switched to strict: the BreakpointRuntimeBridge autoload removed, the
#      setting added, and the bridge attached by path from the game's own debug-only code
#      (an autoload the GAME owns, outside the addon folder);
#   2. two packs are exported with --export-pack (no export templates needed): KEEP holds
#      the folder, LEAVE has exclude_filter="addons/breakpoint_mcp/*";
#   3. the plugin, enabled during both exports, added no autoload back (it neither adds nor
#      removes it under strict);
#   4. KEEP holds >= 1 entry under the folder, LEAVE holds 0;
#   5. booted with the editor binary and --main-pack, with the switch (BREAKPOINT_RUNTIME=1):
#      KEEP's bridge answers on 127.0.0.1 (the positive control for every "no port" below);
#      LEAVE prints no error and opens no port;
#   6. KEEP without the switch opens no port.
#
# Packs are written as .zip so the listing is a plain zip directory, not a parse of the
# .pck format. Prints STRICT_EXPORT_PASS/FAIL per check and STRICT_EXPORT_SUMMARY; exits
# non-zero on any failure.
#
# USAGE: GODOT_BIN=/path/to/godot scripts/strict_export_proof.sh [port]
set -uo pipefail

GODOT="${GODOT_BIN:-godot}"
PORT="${1:-59188}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/bp_strict_export.XXXXXX")"
PROJ="$WORK/strict_example"
PASS=0
FAIL=0
GAME_PID=""

check() {  # check <label> <0=pass|1=fail> [detail]
  if [ "$2" -eq 0 ]; then PASS=$((PASS + 1)); echo "STRICT_EXPORT_PASS $1";
  else FAIL=$((FAIL + 1)); echo "STRICT_EXPORT_FAIL $1 ${3:-}"; fi
}
cleanup() { [ -n "$GAME_PID" ] && kill "$GAME_PID" 2>/dev/null; wait 2>/dev/null; }
trap cleanup EXIT

# probe <answer|open>: "open" = a TCP connect to 127.0.0.1:PORT succeeds; "answer" = it also
# replies to a ping with a JSON line carrying our id (unauthenticated, so the reply is the
# bridge's `unauthorized` error — which is an answer, and proves auth is on).
probe() {
  python3 - "$1" "$PORT" <<'PY'
import json, socket, sys, time
mode, port = sys.argv[1], int(sys.argv[2])
try:
    s = socket.create_connection(("127.0.0.1", port), timeout=1.0)
except OSError:
    sys.exit(1)
if mode == "open":
    sys.exit(0)
s.sendall(b'{"id": 7, "method": "ping"}\n')
buf, end = b"", time.time() + 3.0
while time.time() < end and b"\n" not in buf:
    try:
        chunk = s.recv(4096)
    except socket.timeout:
        continue
    if not chunk:
        break
    buf += chunk
for line in buf.split(b"\n"):
    try:
        if "ok" in json.loads(line):   # the bridge's envelope; unauthenticated, it is `unauthorized`
            print(line.decode()[:200]); sys.exit(0)
    except Exception:
        pass
sys.exit(1)
PY
}

# authed_ping <secret file>: the handshake with the secret the game minted, then a ping that
# must come back ok — the bridge answering as itself, not just a socket that accepts.
authed_ping() {
  python3 - "$1" "$PORT" <<'PY'
import json, socket, sys, time
secret = open(sys.argv[1]).read().strip()
s = socket.create_connection(("127.0.0.1", int(sys.argv[2])), timeout=2.0)
s.sendall((json.dumps({"id": 1, "method": "auth", "params": {"secret": secret}}) + "\n" +
           json.dumps({"id": 2, "method": "ping"}) + "\n").encode())
buf, end = b"", time.time() + 4.0
while time.time() < end and buf.count(b"\n") < 2:
    try:
        chunk = s.recv(4096)
    except socket.timeout:
        continue
    if not chunk:
        break
    buf += chunk
for line in buf.split(b"\n"):
    try:
        msg = json.loads(line)
    except Exception:
        continue
    if msg.get("id") == 2 and msg.get("ok"):
        print(line.decode()[:200]); sys.exit(0)
sys.exit(1)
PY
}

wait_marker() {  # wait_marker <log> <seconds>
  local i=0
  while [ "$i" -lt $(( $2 * 10 )) ]; do
    grep -q "STRICT_PROOF_GAME_READY" "$1" 2>/dev/null && return 0
    sleep 0.1; i=$((i + 1))
  done
  return 1
}

boot() {  # boot <pack> <switch 0|1> <log>: start the game in the background
  local run="$WORK/run_$(basename "$3" .log)"
  mkdir -p "$run"
  if [ "$2" -eq 1 ]; then
    (cd "$run" && exec env BREAKPOINT_RUNTIME=1 BREAKPOINT_RUNTIME_PORT="$PORT" \
      "$GODOT" --headless --main-pack "$1") > "$3" 2>&1 &
  else
    (cd "$run" && exec env -u BREAKPOINT_RUNTIME BREAKPOINT_RUNTIME_PORT="$PORT" \
      "$GODOT" --headless --main-pack "$1") > "$3" 2>&1 &
  fi
  GAME_PID=$!
}

stop_game() { [ -n "$GAME_PID" ] && kill "$GAME_PID" 2>/dev/null; wait "$GAME_PID" 2>/dev/null; GAME_PID=""; }

no_port_for() {  # no_port_for <seconds>: 0 if 127.0.0.1:PORT never accepts a connection
  local i=0
  while [ "$i" -lt $(( $1 * 4 )) ]; do
    probe open && return 1
    sleep 0.25; i=$((i + 1))
  done
  return 0
}

errors_in() { grep -nE "ERROR|Unrecognized UID|Failed to instantiate|Resource file not found" "$1" | head -5; }

# ── 1. the strict copy ─────────────────────────────────────────────────────────────
cp -R "$REPO/example" "$PROJ"
rm -rf "$PROJ/.godot" "$PROJ/_to_delete" "$PROJ/tests"   # the game, not the repo's test harness
cat > "$PROJ/debug_attach.gd" <<'GD'
extends Node
## The GAME's own debug-only code: attaches Breakpoint's runtime bridge by path, so no
## autoload, preload or class name points into addons/breakpoint_mcp/ (BP-0037).
const BP := "res://addons/breakpoint_mcp/runtime_bridge.gd"


func _ready() -> void:
	if OS.is_debug_build() and ResourceLoader.exists(BP):
		var bridge: Node = load(BP).new()
		bridge.name = "BreakpointRuntimeBridge"
		get_tree().root.add_child.call_deferred(bridge)
	print("STRICT_PROOF_GAME_READY")
GD
python3 - "$PROJ/project.godot" <<'PY'
import sys
p = sys.argv[1]
lines = open(p, encoding="utf-8").read().splitlines()
out = []
for ln in lines:
    if ln.startswith("BreakpointRuntimeBridge="):
        out.append('DebugAttach="*res://debug_attach.gd"')
        continue
    out.append(ln)
out += ["", "[breakpoint_mcp]", "", "runtime/strict=true", ""]
open(p, "w", encoding="utf-8").write("\n".join(out))
PY
preset() {  # preset <index> <name> <exclude_filter>
  printf '[preset.%s]\n\nname="%s"\nplatform="Linux"\nrunnable=false\ndedicated_server=false\ncustom_features=""\nexport_filter="all_resources"\ninclude_filter=""\nexclude_filter="%s"\nexport_path=""\nencryption_include_filters=""\nencryption_exclude_filters=""\nencrypt_pck=false\nencrypt_directory=false\n\n[preset.%s.options]\n\n' "$1" "$2" "$3" "$1"
}
{ preset 0 keep ""; preset 1 leave "addons/breakpoint_mcp/*"; } > "$PROJ/export_presets.cfg"
grep -q '^BreakpointRuntimeBridge=' "$PROJ/project.godot"; check "copy.autoload_removed" $(( $? == 0 ))
grep -q '^runtime/strict=true' "$PROJ/project.godot"; check "copy.strict_set" $?

# ── 2-3. import, export both packs, and the plugin left the autoload alone ───────────
"$GODOT" --headless --path "$PROJ" --import > "$WORK/import.log" 2>&1 || true
for name in keep leave; do
  "$GODOT" --headless --path "$PROJ" --export-pack "$name" "$WORK/$name.zip" > "$WORK/export_$name.log" 2>&1 || true
  [ -s "$WORK/$name.zip" ]; check "export.$name.written" $? "$(tail -3 "$WORK/export_$name.log" | tr '\n' ' ')"
done
grep -q 'BreakpointRuntimeBridge' "$PROJ/project.godot"; check "plugin.added_no_autoload_under_strict" $(( $? == 0 ))
# The same zero read MID-SESSION, with its control. A live editor on a copy that starts
# with no autoload: not strict, the plugin writes the entry to project.godot soon after
# "plugin enabled"; strict, the same 8 s wait sees nothing. Read while the editor runs,
# because what a `--quit` session leaves in the file is not what the plugin wrote.
session_writes_autoload() {  # <project> <log> -> 0 written, 1 not written, 2 plugin never enabled
  ( cd "$1" && exec "$GODOT" --headless --editor --path . ) > "$2" 2>&1 &
  local pid=$! i=0 rc=2
  while [ "$i" -lt 600 ]; do grep -q "\[breakpoint_mcp\] plugin enabled" "$2" && { rc=1; break; }; sleep 0.1; i=$((i + 1)); done
  i=0
  while [ "$rc" -eq 1 ] && [ "$i" -lt 80 ]; do
    grep -q '^BreakpointRuntimeBridge=' "$1/project.godot" && rc=0
    sleep 0.1; i=$((i + 1))
  done
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  return "$rc"
}
CTRL_A="$WORK/control_not_strict"
cp -R "$PROJ" "$CTRL_A"
grep -v '^runtime/strict=true' "$PROJ/project.godot" > "$CTRL_A/project.godot"
session_writes_autoload "$CTRL_A" "$WORK/control_not_strict.log"; check "control.not_strict_plugin_writes_the_autoload" $?
STRICT_ED="$WORK/strict_editor_session"
cp -R "$PROJ" "$STRICT_ED"
session_writes_autoload "$STRICT_ED" "$WORK/strict_editor_session.log"; R=$?
[ "$R" -eq 1 ]; check "strict.plugin_writes_no_autoload_mid_session" $? "(rc $R; 2 = plugin never enabled)"
# And a strict project that still registers the autoload is told so, in the strict branch.
CTRL_B="$WORK/strict_with_autoload"
cp -R "$PROJ" "$CTRL_B"
{ cat "$REPO/example/project.godot"; printf '\n[breakpoint_mcp]\n\nruntime/strict=true\n'; } > "$CTRL_B/project.godot"
"$GODOT" --headless --editor --quit --path "$CTRL_B" > "$WORK/strict_with_autoload.log" 2>&1 || true
grep -q 'strict mode is on but project.godot still registers' "$WORK/strict_with_autoload.log"; check "strict.plugin_warns_about_an_existing_autoload" $?

# ── 4. what each pack holds ──────────────────────────────────────────────────────────
count_addon() {
  python3 - "$1" <<'PY'
import sys, zipfile
try:
    names = zipfile.ZipFile(sys.argv[1]).namelist()
except Exception:
    print(-1); sys.exit()
print(sum(1 for n in names if n.startswith("addons/breakpoint_mcp/")))
PY
}
KEEP_N="$(count_addon "$WORK/keep.zip")"
LEAVE_N="$(count_addon "$WORK/leave.zip")"
echo "STRICT_EXPORT_INFO keep holds $KEEP_N entries under addons/breakpoint_mcp/, leave holds $LEAVE_N"
[ "$KEEP_N" -ge 1 ]; check "pack.keep_holds_the_folder" $? "($KEEP_N)"
[ "$LEAVE_N" -eq 0 ]; check "pack.leave_holds_none_of_it" $? "($LEAVE_N)"

# ── 5. boots with the switch ───────────────────────────────────────────────────────────
boot "$WORK/keep.zip" 1 "$WORK/boot_keep_switch.log"
wait_marker "$WORK/boot_keep_switch.log" 30; check "boot.keep_switch.game_ran" $?
ANSWER=""
for _ in $(seq 1 40); do ANSWER="$(probe answer)" && break; ANSWER=""; sleep 0.25; done
[ -n "$ANSWER" ]; check "boot.keep_switch.bridge_answers_on_127.0.0.1" $? "(no reply on :$PORT)"
echo "STRICT_EXPORT_INFO reply: $ANSWER"
SECRET_FILE="$(find "$WORK/run_boot_keep_switch" -name breakpoint_mcp.secret | head -1)"
AUTHED=""
[ -n "$SECRET_FILE" ] && AUTHED="$(authed_ping "$SECRET_FILE")"
[ -n "$AUTHED" ]; check "boot.keep_switch.authenticated_ping_ok" $? "(secret file: ${SECRET_FILE:-none})"
echo "STRICT_EXPORT_INFO authed reply: $AUTHED"
stop_game
E="$(errors_in "$WORK/boot_keep_switch.log")"; [ -z "$E" ]; check "boot.keep_switch.no_errors" $? "$E"

boot "$WORK/leave.zip" 1 "$WORK/boot_leave_switch.log"
wait_marker "$WORK/boot_leave_switch.log" 30; check "boot.leave_switch.game_ran" $?
no_port_for 4; check "boot.leave_switch.opens_no_port" $?
stop_game
E="$(errors_in "$WORK/boot_leave_switch.log")"; [ -z "$E" ]; check "boot.leave_switch.no_errors" $? "$E"

# ── 6. the pack that holds the bridge, WITHOUT the switch ─────────────────────────────
boot "$WORK/keep.zip" 0 "$WORK/boot_keep_noswitch.log"
wait_marker "$WORK/boot_keep_noswitch.log" 30; check "boot.keep_noswitch.game_ran" $?
no_port_for 4; check "boot.keep_noswitch.opens_no_port" $?
stop_game
E="$(errors_in "$WORK/boot_keep_noswitch.log")"; [ -z "$E" ]; check "boot.keep_noswitch.no_errors" $? "$E"

TOTAL=$((PASS + FAIL))
echo "STRICT_EXPORT_SUMMARY pass=$PASS/$TOTAL (work dir $WORK)"
[ "$FAIL" -eq 0 ] && [ "$TOTAL" -eq 20 ]
