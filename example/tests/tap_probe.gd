extends Node
## Fixture for BP-0070, the startup tap: a game holding what a rebuilt bus would break.
##
## The Fx bus (res://default_bus_layout.tres) carries a SpectrumAnalyzer and an AudioEffectRecord
## when the game starts, so the runtime bridge puts its switched-off capture tap at the end of it.
## Instanced into the running game by `runtime_node_add`, then driven by `runtime_call_method`:
##   arm()      adds an Amplify AFTER the tap (the add rebuilds Fx, so it comes before anything is
##              held), starts the Record effect recording, holds the spectrum instance, and plays
##              the hearing fixture's tone (1 kHz at 0.25, -12.04 dBFS) on Fx.
##   state()    whether the recording still runs, whether the spectrum instance is still the one
##              the bus runs, and whether the tap is switched off again.
##   late_bus() adds a bus with a reverb after the game started: it has no tap.
##   disarm()   stops all of it and takes the Amplify and the late bus off.

const RATE := 48000
var _spectrum: AudioEffectInstance
var _record: AudioEffectRecord
var _player: AudioStreamPlayer


func arm() -> Dictionary:
	var fx := AudioServer.get_bus_index("Fx")
	AudioServer.add_bus_effect(fx, AudioEffectAmplify.new())
	_record = AudioServer.get_bus_effect(fx, 1) as AudioEffectRecord
	_record.set_recording_active(true)
	_spectrum = AudioServer.get_bus_effect_instance(fx, 0)
	var pcm := PackedByteArray()
	pcm.resize(RATE * 2)
	for i: int in RATE:
		pcm.encode_s16(i * 2, int(round(sin(TAU * 1000.0 * float(i) / float(RATE)) * 0.25 * 32767.0)))
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = RATE
	wav.data = pcm
	wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
	wav.loop_end = RATE
	_player = AudioStreamPlayer.new()
	_player.stream = wav
	_player.bus = &"Fx"
	add_child(_player)
	_player.play()
	return {"effects": AudioServer.get_bus_effect_count(fx), "recording": _record.is_recording_active()}


func state() -> Dictionary:
	var fx := AudioServer.get_bus_index("Fx")
	var tap_on := false
	for i: int in AudioServer.get_bus_effect_count(fx):
		var e := AudioServer.get_bus_effect(fx, i)
		if e is AudioEffectCapture and AudioServer.is_bus_effect_enabled(fx, i):
			tap_on = true
	return {
		"recording": _record.is_recording_active(),
		"same_spectrum": AudioServer.get_bus_effect_instance(fx, 0) == _spectrum,
		"tap_on": tap_on,
		"effects": AudioServer.get_bus_effect_count(fx),
	}


func late_bus() -> String:
	AudioServer.add_bus()
	var b := AudioServer.bus_count - 1
	AudioServer.set_bus_name(b, "Late")
	AudioServer.add_bus_effect(b, AudioEffectReverb.new())
	return AudioServer.get_bus_name(b)


func disarm() -> int:
	if _record != null:
		_record.set_recording_active(false)
	if _player != null:
		_player.stop()
	var fx := AudioServer.get_bus_index("Fx")
	for i: int in range(AudioServer.get_bus_effect_count(fx) - 1, -1, -1):
		if AudioServer.get_bus_effect(fx, i) is AudioEffectAmplify:
			AudioServer.remove_bus_effect(fx, i)
	var late := AudioServer.get_bus_index("Late")
	if late >= 0:
		AudioServer.remove_bus(late)
	return AudioServer.bus_count
