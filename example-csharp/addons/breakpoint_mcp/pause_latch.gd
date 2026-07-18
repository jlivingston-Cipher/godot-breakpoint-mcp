@tool
extends RefCounted
## Shared "Pause Agent" latch — the addon's human-facing control surface.
##
## The in-editor status dock's "Pause Agent" toggle engages this latch; both the
## editor bridge (bridge_server.gd) and the runtime bridge (runtime_bridge.gd)
## honor it. While paused they REJECT new agent commands on the editor + runtime
## planes; an op already running finishes, and a bare `ping` still answers so the
## host can see the bridge is alive. It is the visible companion to the host-side
## signal latch (SIGUSR1/SIGUSR2): the host latch is the finer instrument (it
## holds only MUTATING actions, across the WHOLE surface); this addon latch is the
## coarse, one-click stop scoped to the two engine-facing bridges.
##
## Cross-process by design. The toggle lives in the EDITOR while the runtime bridge
## lives in the RUNNING GAME (a separate OS process), so an in-memory flag can't be
## shared. State is a flag FILE in the engine-managed, git-ignored res://.godot/ —
## the same directory and the same reason bridge_secret.gd uses one: it is the one
## place both the editor and an editor-launched game can reach. File present =
## paused. Only the editor writes it; both bridges read it.
##
## NOT an emergency stop: it holds ENTRY to a new command and never interrupts an
## in-flight op, and (unlike the queuing host latch) it does not hold the caller —
## it rejects, so the host re-issues after resume.

const FLAG_PATH := "res://.godot/breakpoint_mcp.pause"


## True while the agent is paused (the flag file exists). One stat per call —
## cheap enough for the dispatch seam — and always reflects the latest state
## written by the editor, even from the separate game process.
static func is_paused() -> bool:
	return FileAccess.file_exists(FLAG_PATH)


## Engage (paused=true) or clear (paused=false) the latch. Engaging writes a tiny
## JSON marker (for legibility — presence is what the bridges read); clearing
## removes the file. Best-effort: a failed write/remove logs a warning rather than
## throwing, so the toggle can never brick the editor (mirrors bridge_secret's
## mint-or-warn posture). Called only in the editor process, where res:// is
## writable; the runtime bridge only ever reads via is_paused().
static func set_paused(paused: bool) -> void:
	if paused:
		var f := FileAccess.open(FLAG_PATH, FileAccess.WRITE)
		if f == null:
			push_warning("[breakpoint_mcp] could not write pause flag %s" % FLAG_PATH)
			return
		f.store_string(JSON.stringify({"paused": true, "at": int(Time.get_unix_time_from_system())}))
		f.close()
	elif FileAccess.file_exists(FLAG_PATH):
		var err := DirAccess.remove_absolute(ProjectSettings.globalize_path(FLAG_PATH))
		if err != OK:
			push_warning("[breakpoint_mcp] could not clear pause flag %s" % FLAG_PATH)


## The standard "held" response a bridge returns for a command received while
## paused — no dispatch happened. Mirrors the host confirm.ts blocking wording so
## the agent gets a clear, actionable reason instead of a silent drop.
static func held_response(method: String) -> Dictionary:
	return {
		"ok": false,
		"error": {
			"code": "paused",
			"message": "Agent paused from the Breakpoint editor dock — \"%s\" was held and NOT executed. Resume from the dock, then re-issue." % method,
		},
	}
