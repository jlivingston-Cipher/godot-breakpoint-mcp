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
 * `"baseline": 1e999` to `runtime_assert_perf` round-trips through the addon as `inf`.
 *
 * 🔴 226 §2 — AND THE FIRST CONTAINMENT WAS SCOPED TO A ROSTER OF TWO. Session 225 put
 * this walk at the single `JSON.parse` in `bridge.ts`, which is the right place, and then
 * widened exactly the two schemas it had been thinking about. Measured off the shipped
 * wire rather than the roster:
 *
 *     bridge-routed tools carrying >=1 non-nullable number field    93
 *     their non-nullable number field paths                        243
 *     of those, declaring `non_finite`                                2
 *
 * Replacing a non-finite reading with `null` on the other 91 turns a silent wrong value
 * into a HARD SCHEMA REFUSAL whose message blames the shape — `current: Expected number,
 * received null` — and the `non_finite` roster that would have explained it is destroyed
 * by the very parse that fails, because those 91 schemas do not declare the key. That is
 * 225 §5's own finding one layer out: a coherent, specific message about the wrong cause.
 *
 * SO THE POLICY IS SPLIT, AND BOTH HALVES ARE DERIVED RATHER THAN CHOSEN:
 *
 *  - DEFAULT — REFUSE, NAMING THE PATH AND THE VALUE. A non-finite number anywhere in a
 *    bridge reply rejects the call with code `non_finite` and a message that says which
 *    dotted path carried it and what it was. Loud, accurate, and — because no schema
 *    moves — invisible to `tools/list`. This is a strictly better failure than either
 *    1.73.4 (silent `null` on the wire) or the first containment (a shape complaint).
 *
 *  - TOLERANT — PRUNE AND ROSTER, for the tools whose whole job is a partial reading.
 *    `NON_FINITE_TOLERANT` below is the only place that set is written down, and
 *    `finiteness.test.ts` asserts it equals the set of shipped schemas declaring
 *    `non_finite`, in BOTH directions. A tool cannot join one without joining the other.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: widen a number to `number | null`. 225's note said
 * "the numeric contract is not redefined … older clients are unaffected"; `wire_diff.mjs`
 * classified that same change MAJOR at four field paths. The prose and the classifier
 * disagreed and the classifier was right. Nothing here moves a declared type — every
 * shipped `outputSchema` is byte-identical to v1.73.4 except for the OPTIONAL
 * `non_finite` roster added to the two tolerant tools, which is what took the cut's
 * classification from MAJOR back to MINOR.
 */

/** The key a tolerant reply carries when something was pruned. Optional in the schemas. */
export const NON_FINITE_KEY = "non_finite";

/**
 * The tools that report a PARTIAL reading rather than refusing, keyed to the addon method
 * `bridge.ts` matches on.
 *
 * 🔴 THIS IS THE ONLY WRITTEN-DOWN COPY OF THAT SET. `finiteness.test.ts` asserts, both
 * ways, that its keys are exactly the shipped schemas declaring `non_finite` and that
 * every method value is actually called by `tools/runtime.ts` — so the set cannot drift
 * from the wire, and a rename cannot orphan an entry. 225 §9's carried finding is that
 * every scope is prose until something derives it; this one is asserted against two
 * independent readers.
 */
export const NON_FINITE_TOLERANT: ReadonlyMap<string, string> = new Map([
  ["runtime_get_monitors", "runtime.get_monitors"],
  ["runtime_assert_perf", "runtime.assert_perf"],
]);

/** The addon methods whose replies are pruned instead of refused. */
export const TOLERANT_METHODS: ReadonlySet<string> = new Set(NON_FINITE_TOLERANT.values());

/** How deep the walk goes. Bridge replies are shallow; the cap is a runaway guard, and it
 *  is asserted rather than assumed — see `finiteness.test.ts`'s depth case. */
const MAX_DEPTH = 64;

/** One non-finite number, and where it was. */
export interface NonFiniteHit {
  /** Dotted path from the reply root, e.g. `monitors.time/fps` or `regressions[0].current`. */
  path: string;
  /** `Infinity`, `-Infinity` or `NaN` — the value as a client-readable word. */
  value: string;
}

/** `Infinity` / `-Infinity` / `NaN` as a word. `String(NaN)` is already "NaN". */
function word(n: number): string {
  return Number.isNaN(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity";
}

/**
 * Every non-finite number in `value`, in encounter order. Pure: allocates one array and
 * never copies the input, so the normal path — which is every real reply — costs one walk
 * and returns the empty list.
 */
export function findNonFinite(value: unknown): NonFiniteHit[] {
  const hits: NonFiniteHit[] = [];

  const walk = (v: unknown, path: string, depth: number): void => {
    if (typeof v === "number") {
      if (!Number.isFinite(v)) hits.push({ path: path || "(root)", value: word(v) });
      return;
    }
    if (v === null || typeof v !== "object" || depth >= MAX_DEPTH) return;
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [k, item] of Object.entries(v as Record<string, unknown>)) {
      walk(item, path ? `${path}.${k}` : k, depth + 1);
    }
  };

  walk(value, "", 0);
  return hits;
}

/**
 * The refusal message. It names the paths and the values, because the whole point of
 * refusing here rather than at the schema is that the schema cannot say either.
 * Capped so a pathological reply cannot produce an unbounded error string; the cap is
 * asserted in `finiteness.test.ts` rather than trusted.
 */
export const MESSAGE_CAP = 8;

export function describeNonFinite(hits: readonly NonFiniteHit[]): string {
  const shown = hits.slice(0, MESSAGE_CAP).map((h) => `${h.path}=${h.value}`).join(", ");
  const rest = hits.length > MESSAGE_CAP ? ` (+${hits.length - MESSAGE_CAP} more)` : "";
  return (
    `The engine returned ${hits.length} non-finite number(s) this reply: ${shown}${rest}. ` +
    `JSON cannot carry them — Godot stringifies INF as 1e99999 and NAN as null — so the ` +
    `call is refused rather than reported as a success with the value silently missing.`
  );
}

/**
 * Drop every non-finite value from a flat monitor record, returning what survived and the
 * keys that did not. The declared type of the record does not move: a reading that is not
 * a number is ABSENT, not `null`, and `non_finite` is where it says so.
 */
export function pruneRecord(rec: unknown): { kept: Record<string, number>; dropped: string[] } {
  const kept: Record<string, number> = {};
  const dropped: string[] = [];
  if (rec === null || typeof rec !== "object" || Array.isArray(rec)) return { kept, dropped };
  for (const [k, v] of Object.entries(rec as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) kept[k] = v;
    else dropped.push(k);
  }
  return { kept, dropped };
}

/**
 * The tolerant policy for the two partial-reading tools: prune `monitors`, drop any
 * comparison row that cannot be compared, and roster every key that left.
 *
 * 🔴 A DROPPED COMPARISON IS NOT A PASSED ONE. `ok` and `checked` are left exactly as the
 * addon computed them — this host does not re-decide the assertion — but a key that could
 * not be read appears in `non_finite`, so a caller reading `ok: true` alongside a
 * non-empty roster can see that the two statements are about different key sets.
 */
export function tolerate(result: unknown): unknown {
  if (result === null || typeof result !== "object" || Array.isArray(result)) return result;
  const src = result as Record<string, unknown>;
  const roster = new Set<string>();
  const out: Record<string, unknown> = { ...src };

  if ("monitors" in src) {
    const { kept, dropped } = pruneRecord(src.monitors);
    if (dropped.length) {
      out.monitors = kept;
      dropped.forEach((k) => roster.add(k));
    }
  }

  if (Array.isArray(src.regressions)) {
    const rows = src.regressions as Array<Record<string, unknown>>;
    const survivors = rows.filter((row) => {
      const bad = ["baseline", "current"].some(
        (f) => typeof row?.[f] === "number" && !Number.isFinite(row[f] as number),
      );
      if (bad) roster.add(typeof row?.key === "string" ? row.key : "(unnamed)");
      return !bad;
    });
    if (survivors.length !== rows.length) out.regressions = survivors;
  }

  if (roster.size === 0) return result;
  return { ...out, [NON_FINITE_KEY]: [...roster] };
}
