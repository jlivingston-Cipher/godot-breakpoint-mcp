extends Node2D

var ice: int = 100
var shade: int = 5
var grew_ever: bool = false   # verification hook: did the ice ever GROW on a warm moment?

@onready var _label: Label = $Label

func _ready() -> void:
	print("[demo] sunshine start, ice=%d" % ice)
	for w in [3, 20, 4, 90]:
		apply_warmth(w)

func apply_warmth(warmth: int) -> int:
	var melt := warmth - shade               # BUG: no clamp -> mild warmth goes negative -> ice grows (fix: maxi(0, ...))
	var before := ice
	ice -= melt                              # <-- BREAKPOINT HERE (line 17)
	if ice > before:
		grew_ever = true
	print("[demo] warmth %d (melt %d), ice now %d" % [warmth, melt, ice])
	if ice <= 0:
		_label.text = "ALL MELTED"
		print("[demo] ALL MELTED")
	return ice
