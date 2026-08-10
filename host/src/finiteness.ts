/**
 * Non-finite engine floats, contained at the one place they enter the host.
 *
 * 🔴 224 §7.3 ASKED WHETHER GODOT'S PERFORMANCE MONITORS CAN EMIT `INF` THROUGH
 * `runtime_get_monitors`, and called it "the only item that can break a working tool
 * silently in production rather than loudly in CI". Measured on Godot 4.7 headless in
 * session 225, every hop:
 *
 *   Godot `JSON.stringify(INF)`  ->  `1e99999`   — VALID JSON, so `JSON.parse` gives Infinity
 *   Godot `JSON.stringify(NAN)`  ->  `null`      — plus a one-shot engine warning
 *   zod 3 `z.number()`           ->  ACCEPTS ±Infinity, REJECTS NaN
 *   zod 4 `z.number()`           ->  REJECTS both
 *   host -> MCP client           ->  `JSON.stringify(Infinity)` is `null`
 *
 * The answer is yes, and it needs no engine edge case at all: a client sending
 * `"baseline": 1e999` to `runtime_assert_perf` round-trips through the addon as `inf` and
 * comes back on the wire as `1e99999`. Three defects follow, and only the first is the
 * question that was asked:
 *
 *  1. Under zod 4, `runtime_get_monitors` would start REFUSING a response whose reading
 *     happened to be non-finite — the silent-in-production break, confirmed.
 *  2. NaN is a LIVE defect under zod 3 today: it arrives as `null`, and `z.number()`
 *     refuses `null` under both majors, so one bad key kills the whole response.
 *  3. 🔴 The worst of the three is neither. When zod 3 ACCEPTS `Infinity`, the host
 *     re-serialises its own result to the MCP client, and `JSON.stringify(Infinity)` is
 *     `null`. **The tool reports success and hands back `null` where a number belongs.**
 *     Validation passed and the value is gone — the reporting-honesty class 224 §6 named.
 *
 * WHY THE FIX IS HERE AND NOT IN `schemas.ts`. A schema that accepted non-finite values
 * would have to be written with `z.custom`, which carries no JSON Schema representation —
 * the emitted `outputSchema` a client validates against would degrade from "number" to
 * "anything", trading a host-side refusal for a client-side one. Normalising at the single
 * `JSON.parse` boundary in `bridge.ts` leaves every shipped schema a plain
 * `z.number().nullable()`: representable, and byte-identical in meaning under zod 3 and
 * zod 4. **That is the property the migration turns on, so `finiteness.test.ts` asserts it
 * against both majors rather than assuming it.**
 *
 * WHAT IS DELIBERATELY NOT DONE. The numeric contract is not redefined. A reading stays a
 * number or `null` — which is what the addon already emits — so arithmetic on these fields
 * keeps working and older clients are unaffected. What changes is that a value lost to
 * non-finiteness now SAYS SO, in `non_finite`, instead of being indistinguishable from a
 * monitor that genuinely read zero-or-absent.
 */

/** The key a normalised reply carries when something was replaced. Optional in the schemas. */
export const NON_FINITE_KEY = "non_finite";

/** How deep the walk goes. Bridge replies are shallow; the cap is a runaway guard, and it
 *  is asserted rather than assumed — see `finiteness.test.ts`'s depth case. */
const MAX_DEPTH = 64;

export interface Normalised {
  /** The value with every non-finite number replaced by `null`. */
  value: unknown;
  /** Dotted paths of what was replaced, in encounter order. Empty on the normal path. */
  nonFinite: string[];
}

/**
 * Replace every non-finite number with `null`, recording where. Returns the input
 * unchanged (and an empty list) when there is nothing to do, which is every real reply —
 * so the normal path allocates nothing and the cost is one walk.
 */
export function normaliseNonFinite(value: unknown): Normalised {
  const nonFinite: string[] = [];

  const walk = (v: unknown, path: string, depth: number): unknown => {
    if (typeof v === "number") {
      if (Number.isFinite(v)) return v;
      nonFinite.push(path || "(root)");
      return null;
    }
    if (v === null || typeof v !== "object" || depth >= MAX_DEPTH) return v;
    if (Array.isArray(v)) {
      let changed = false;
      const out = v.map((item, i) => {
        const next = walk(item, `${path}[${i}]`, depth + 1);
        if (next !== item) changed = true;
        return next;
      });
      return changed ? out : v;
    }
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, item] of Object.entries(v as Record<string, unknown>)) {
      const next = walk(item, path ? `${path}.${k}` : k, depth + 1);
      if (next !== item) changed = true;
      out[k] = next;
    }
    return changed ? out : v;
  };

  const normalised = walk(value, "", 0);
  return { value: normalised, nonFinite };
}

/**
 * Normalise a bridge reply's `result` and, when anything was replaced, attach the
 * `non_finite` roster to it.
 *
 * 🔴 THE ROSTER IS ONLY ATTACHED WHEN IT IS NON-EMPTY. An always-present empty array
 * would be a new required field on every shipped tool for a case that never fires; an
 * absent one is `undefined`, which is what `.optional()` means. And it is attached to the
 * RESULT rather than reported out of band because a caller that cannot see which key was
 * lost is in exactly the position defect 3 above put them.
 */
export function containNonFinite(result: unknown): unknown {
  const { value, nonFinite } = normaliseNonFinite(result);
  if (nonFinite.length === 0) return result;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  return { ...(value as Record<string, unknown>), [NON_FINITE_KEY]: nonFinite };
}
