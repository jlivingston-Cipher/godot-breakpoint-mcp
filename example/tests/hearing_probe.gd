extends Node
## Fixture for BP-0026, the hearing plane — a sound whose every number is known in advance.
##
## A 1 kHz sine at amplitude 0.25 (-12.04 dBFS sample peak, -15.05 dBFS RMS), built here
## as a looping 16-bit AudioStreamWAV so the fixture ships no audio asset. Played on the
## Master bus from the first frame. Recorded under Movie Maker (`godot_record`), it lets a
## driver assert the measurement against arithmetic rather than against an earlier run.
##
## One user argument changes it: `-- --hearing-gain-db=<dB>` sets the player's volume_db,
## so the same scene recorded at +18 dB clips (0.25 x 7.94 > 1) — the "after" of a
## before/after comparison, made by the engine's own mixer rather than by the fixture.

const RATE := 48000
const FREQ := 1000.0
const AMP := 0.25


func _ready() -> void:
	var gain_db := 0.0
	for a: String in OS.get_cmdline_user_args():
		if a.begins_with("--hearing-gain-db="):
			gain_db = a.get_slice("=", 1).to_float()
	var pcm := PackedByteArray()
	pcm.resize(RATE * 2)
	for i: int in RATE:
		var s := sin(TAU * FREQ * float(i) / float(RATE)) * AMP
		pcm.encode_s16(i * 2, int(round(s * 32767.0)))
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = RATE
	wav.stereo = false
	wav.data = pcm
	wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
	wav.loop_begin = 0
	wav.loop_end = RATE
	var p := AudioStreamPlayer.new()
	p.stream = wav
	p.volume_db = gain_db
	add_child(p)
	p.play()
