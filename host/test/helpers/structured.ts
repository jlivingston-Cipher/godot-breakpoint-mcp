/**
 * `shape-before-field-uncounted` (285) — the guard, in ONE place.
 *
 * 🔴 275 SHIPPED THE RULE AT THE SITE ITS FLAKE HAPPENED AND NOWHERE ELSE. A tool that
 * answers with no `structuredContent` used to surface as `Cannot read properties of
 * undefined (reading 'bridge_ready')` — a TypeError one line after the defect, naming a
 * field instead of the missing envelope, in a test that had already passed the assertion
 * it was about. `processes.test.ts` wrote the local version of this helper at 285 and its
 * comment states the whole argument: one line here guards every call site in the file,
 * where an inline cast has to be guarded one at a time.
 *
 * 🔴 IT THROWS AND DOES NOT ASSERT, BECAUSE A GUARD IN A HELPER IS A PRECONDITION, NOT A
 * CLAIM (285 §8.5). An `assert` here would be a claim the test never wrote, counted in
 * nobody's total, and green on the run where it never executed. A throw carries the
 * envelope it was handed, so the failure names what was actually returned.
 *
 * 🔴 AND IT IS GENERIC BECAUSE THE CASTS ARE. A helper returning `Record<string, unknown>`
 * would guard every site and silently un-type two thirds of them: `sc.matches[0].symbol`
 * does not compile against an index signature, so the sweep would have had to widen the
 * assertions it was supposed to leave alone.
 */
export interface HasStructuredContent {
  structuredContent?: unknown;
}

/**
 * The tool result's `structuredContent`, asserted present and cast once.
 *
 * `where` is an optional label for the call site — a tool name, a step — because a
 * throw from a helper is otherwise identical from all 94 of them.
 */
export function structured<T>(r: HasStructuredContent, where = ""): T {
  if (!r.structuredContent) {
    throw new Error(
      `the tool returned no structuredContent${where ? ` (${where})` : ""} — ` +
      `${JSON.stringify(r).slice(0, 400)}`,
    );
  }
  return r.structuredContent as T;
}
