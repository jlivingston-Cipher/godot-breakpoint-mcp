@tool
extends RefCounted
## Variant <-> JSON codec.
##
## JSON can only carry null/bool/number/string/array/object. Godot's rich value
## types (Vector*, Color, Rect2, NodePath, Quaternion, ...) are encoded as tagged
## objects: {"__type__": "Vector3", "x": .., "y": .., "z": ..}. `decode()` turns
## those tags back into real Variants so property set/get round-trips correctly.


static func encode(v: Variant) -> Variant:
	var t := typeof(v)
	match t:
		TYPE_NIL, TYPE_BOOL, TYPE_INT, TYPE_FLOAT:
			return v
		TYPE_STRING:
			return v
		TYPE_STRING_NAME:
			return String(v)
		TYPE_NODE_PATH:
			return {"__type__": "NodePath", "path": String(v)}
		TYPE_VECTOR2:
			return {"__type__": "Vector2", "x": v.x, "y": v.y}
		TYPE_VECTOR2I:
			return {"__type__": "Vector2i", "x": v.x, "y": v.y}
		TYPE_VECTOR3:
			return {"__type__": "Vector3", "x": v.x, "y": v.y, "z": v.z}
		TYPE_VECTOR3I:
			return {"__type__": "Vector3i", "x": v.x, "y": v.y, "z": v.z}
		TYPE_VECTOR4:
			return {"__type__": "Vector4", "x": v.x, "y": v.y, "z": v.z, "w": v.w}
		TYPE_COLOR:
			return {"__type__": "Color", "r": v.r, "g": v.g, "b": v.b, "a": v.a}
		TYPE_RECT2:
			return {
				"__type__": "Rect2",
				"x": v.position.x, "y": v.position.y,
				"w": v.size.x, "h": v.size.y,
			}
		TYPE_QUATERNION:
			return {"__type__": "Quaternion", "x": v.x, "y": v.y, "z": v.z, "w": v.w}
		TYPE_DICTIONARY:
			var out := {}
			for k in v:
				out[String(k)] = encode(v[k])
			return out
		TYPE_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_INT64_ARRAY, \
		TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_FLOAT64_ARRAY, \
		TYPE_PACKED_STRING_ARRAY, TYPE_PACKED_VECTOR2_ARRAY, \
		TYPE_PACKED_VECTOR3_ARRAY, TYPE_PACKED_COLOR_ARRAY:
			var arr := []
			for item in v:
				arr.append(encode(item))
			return arr
		TYPE_OBJECT:
			if v == null:
				return null
			if v is Resource:
				return {
					"__type__": "Resource",
					"class": v.get_class(),
					"path": v.resource_path,
				}
			return {"__type__": "Object", "class": v.get_class()}
		_:
			# Fallback: best-effort string representation for unhandled types.
			return {"__type__": "Unsupported", "repr": str(v), "type_id": t}


static func decode(j: Variant) -> Variant:
	if typeof(j) == TYPE_DICTIONARY:
		if j.has("__type__"):
			match String(j["__type__"]):
				"NodePath":
					return NodePath(String(j.get("path", "")))
				"Vector2":
					return Vector2(j.get("x", 0.0), j.get("y", 0.0))
				"Vector2i":
					return Vector2i(int(j.get("x", 0)), int(j.get("y", 0)))
				"Vector3":
					return Vector3(j.get("x", 0.0), j.get("y", 0.0), j.get("z", 0.0))
				"Vector3i":
					return Vector3i(int(j.get("x", 0)), int(j.get("y", 0)), int(j.get("z", 0)))
				"Vector4":
					return Vector4(j.get("x", 0.0), j.get("y", 0.0), j.get("z", 0.0), j.get("w", 0.0))
				"Color":
					return Color(j.get("r", 0.0), j.get("g", 0.0), j.get("b", 0.0), j.get("a", 1.0))
				"Rect2":
					return Rect2(j.get("x", 0.0), j.get("y", 0.0), j.get("w", 0.0), j.get("h", 0.0))
				"Quaternion":
					return Quaternion(j.get("x", 0.0), j.get("y", 0.0), j.get("z", 0.0), j.get("w", 1.0))
				"Resource":
					var path := String(j.get("path", ""))
					if path != "" and ResourceLoader.exists(path):
						return ResourceLoader.load(path)
					return null
				_:
					return null
		var out := {}
		for k in j:
			out[k] = decode(j[k])
		return out
	elif typeof(j) == TYPE_ARRAY:
		var arr := []
		for item in j:
			arr.append(decode(item))
		return arr
	return j


## 🔴 WHY THE FOUR MEMBERS BELOW EXIST — issue #327, and the reporter's own diagnosis
## was wrong in a way worth writing down. They read *vectors dropped, falsy scalars
## dropped, indexed paths null* as one truthiness guard in this file's decode path.
## Measured live on Godot 4.7, both sides of the wire driven separately: real `false`,
## `0` and `0.0` round-trip correctly and always have. What they actually hit was a
## String reaching a bool property — Godot coerces any non-empty String to `true`, so
## `"false"` reads back as `true` — and `set_property` had no way to notice, because it
## answered with a FRESH READ-BACK it never compared to what was asked.
##
## 🔴 SO THE REPAIR IS A COMPARISON AND NOT A GUARD. A guard has to enumerate the ways
## a write can fail to land; a comparison asks the only question that matters — is the
## value the caller asked for the value the engine now holds — and is therefore correct
## for the failure modes nobody has met yet.


## True when `prop` names a SUB-property rather than a property: `position:x`,
## `material_override:shader_parameter/albedo`.
##
## 🔴 THE COLON FORM IS `get_indexed`'s VOCABULARY, NOT `get`'s, and the two are
## different methods rather than two spellings of one. `Object.get("position:x")`
## answers `null` — not an error, not a warning — which is why #327 read this as the
## property being unreadable rather than as the wrong method being called.
static func is_indexed(prop: String) -> bool:
	return prop.contains(":")


## Read a property that may or may not be indexed.
static func read_property(o: Object, prop: String) -> Variant:
	if is_indexed(prop):
		return o.get_indexed(NodePath(prop))
	return o.get(prop)


## Write a property that may or may not be indexed.
static func write_property(o: Object, prop: String, v: Variant) -> void:
	if is_indexed(prop):
		o.set_indexed(NodePath(prop), v)
	else:
		o.set(prop, v)


## Could a value of type `asked` ever be what the engine STORED as type `got`?
##
## 🔴 THIS IS THE LINE BETWEEN A COERCION AND A MISTAKE, and it is drawn at the type
## rather than at the value on purpose. A setter that clamps, snaps or normalises
## stores a DIFFERENT VALUE OF THE SAME TYPE and is doing its job — refusing that
## would break every `Range.value` in every project. A String that lands in a bool,
## or a Dictionary that lands in a Vector2, is a different kind of event: nothing the
## caller wrote survived, and the engine says nothing about it.
##
## The three promotions below are Godot's own and are never mistakes: int <-> float,
## String <-> StringName, and a plain Array into any of the packed array types (JSON
## has one array and the engine has ten).
static func types_compatible(asked: int, got: int) -> bool:
	if asked == got:
		return true
	if _is_numeric(asked) and _is_numeric(got):
		return true
	if _is_stringy(asked) and _is_stringy(got):
		return true
	if asked == TYPE_ARRAY and _is_packed_array(got):
		return true
	return false


static func _is_numeric(t: int) -> bool:
	return t == TYPE_INT or t == TYPE_FLOAT


static func _is_stringy(t: int) -> bool:
	return t == TYPE_STRING or t == TYPE_STRING_NAME


static func _is_packed_array(t: int) -> bool:
	return t in [
		TYPE_PACKED_BYTE_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_INT64_ARRAY,
		TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_FLOAT64_ARRAY, TYPE_PACKED_STRING_ARRAY,
		TYPE_PACKED_VECTOR2_ARRAY, TYPE_PACKED_VECTOR3_ARRAY, TYPE_PACKED_COLOR_ARRAY,
	]


## Did the engine store the value that was asked for? Numeric pairs are compared
## approximately, because an int asked of a float property stores a float and the two
## are the same answer.
static func values_equal(asked: Variant, got: Variant) -> bool:
	if _is_numeric(typeof(asked)) and _is_numeric(typeof(got)):
		return is_equal_approx(float(asked), float(got))
	return asked == got
