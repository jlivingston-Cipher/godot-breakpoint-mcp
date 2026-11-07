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

/**
 * A `dbg_launch`, `cs_dbg_launch` or `cs_dbg_attach` that has to have started a session
 * before the test reads anything else. Throws, naming the reply, when it did not.
 *
 * 🔴 BP-0069 (337) — FORTY-ONE TESTS LAUNCHED A SESSION AND THREW THE REPLY AWAY, so a
 * refused launch surfaced as whatever the NEXT line happened to read. On #441's
 * post-merge run that was `true !== false` on `buffered`, a sentence about breakpoints
 * from a test whose launch had been refused as a port conflict and which said nothing of
 * it. Worse, a test that expects the next tool to REFUSE (a declined confirmation, a
 * running program) passes on a refused launch for the wrong reason. A throw, not an
 * assertion, for 285's reason: this is a precondition, not a claim.
 */
export function started(r: unknown, where: string): void {
  const res = r as (HasStructuredContent & { isError?: boolean }) | undefined;
  if (!res || res.isError === true) {
    throw new Error(`${where} did not start a session — ${JSON.stringify(r).slice(0, 400)}`);
  }
  structured(res, where);
}
