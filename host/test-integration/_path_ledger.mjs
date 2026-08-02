// _path_ledger.mjs — THE PATH-COHORT LEDGER COMPARISON, LIFTED OUT OF THE PROBE.
//
// 172 §10.2 asked the blinding question of two instruments it had not reached:
// `_population.mjs`'s manifests and `host/scripts/path-cohort.mjs`. Measured in 173,
// the answer for the cohort was not a blind finder. `src/path-cohort.ts` is covered by
// twelve unit tests and every one of its eight functions goes RED when blinded.
//
// 🔴 THE HOLE WAS ONE LEVEL OUT: THE COMPARISON THAT USES IT HAD NO GATE TO BLIND.
// The four claims that decide whether the live surface and the ledger agree lived
// inside `authoring-plane.integration.mjs` — a probe that boots the Godot editor GUI
// under Xvfb — and existed nowhere else. There was no case anywhere in the tree whose
// right answer had been written down before the code ran, which is the exact discipline
// `_population.selftest.mjs`'s own header cites 169 §2 for. An instrument with no gate
// to point a blinding harness at is not a passing instrument; it is an untested one.
//
// So the comparison is a pure function here, `authoring-plane` formats its verdicts,
// and `_path_ledger.selftest.mjs` runs it against cases with known answers — headless,
// no editor, no ports, no deps.
//
// Dependency-free (node builtins only), same as `_population.mjs` and `_png.mjs`.

/**
 * The classifications a ledger row may carry. A row outside this set is malformed, not
 * merely unusual: an unknown class is a parameter nobody actually decided about.
 */
export const LEDGER_CLASSES = Object.freeze([
  "guarded", "node-path", "not-a-path", "capability-gated", "do-not-reopen", "backend-absent", "stores-only",
]);

/**
 * 🔴 ONE CANARY PER HISTORICAL BLINDNESS, NAMED, BECAUSE THE COUNT CANNOT SEE THEM.
 *
 * A blind enumerator SHRINKS the live set, so nothing reads as unclassified and
 * `unclassified` stays empty. `stale` catches that today only because the ledger still
 * holds the rows the enumerator lost — a session that REGENERATED the ledger from a
 * blind enumerator would take both green together, which is 162's failure mode one
 * level up. These rows name specific parameters, so they survive a regeneration.
 */
export const LEDGER_CANARIES = Object.freeze([
  // nested, compound name, NO description: invisible to an exact-word name test and to
  // a description test simultaneously. enum163's blindnesses 1 + 3.
  Object.freeze(["card_template_create", "theme.font_path", "nested, compound name, no description"]),
  // the parameter that survived FOUR releases because the enumerator discarded every
  // name equal to `path`. Blindness 2.
  Object.freeze(["theme_set_font", "path", "literally named `path` — the discarded cohort"]),
]);

/**
 * 🔴 THE GATE'S OWN SCOPE, AS LITERALS, FOR THE REASON `_population.mjs` TAKES `scope`
 * AS A SEPARATE ARGUMENT: `canaries.length >= canaries.length` is a tautology, and a
 * `.filter()` over an emptied list returns nothing and reads as "all canaries present".
 *
 * Measured in 173 against the shipped gate: emptying `LEDGER_CANARIES` left
 * AUTH_PATH_LEDGER_CANARY printing *"both blindness canaries are still enumerated"* —
 * a canary that had itself gone silent, in the one claim written to survive a blind
 * enumerator. `>=`, not exact: both lists are supposed to grow.
 */
export const LEDGER_SCOPE = Object.freeze({ classes: 7, canaries: 2 });

/** `tool\tparam` — the key both sides of the comparison are addressed by. */
export const ledgerKey = (tool, param) => `${tool}\t${param}`;

/**
 * Parse the ledger file. Blank lines and `#` comments are skipped; anything else must
 * carry a known class AND a reason, because a classification with no reason is a
 * classification nobody has to defend.
 *
 * @param text raw `path-cohort-ledger.tsv`
 * @returns `{ entries: Map<key, class>, badClass: string[] }`
 */
export function parsePathLedger(text) {
  const entries = new Map();
  const badClass = [];
  for (const line of String(text ?? "").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [tool, param, cls, ...reason] = line.split("\t");
    if (!LEDGER_CLASSES.includes(cls)) { badClass.push(`${tool}.${param} -> ${cls}`); continue; }
    if (!reason.join(" ").trim()) { badClass.push(`${tool}.${param} -> no reason given`); continue; }
    entries.set(ledgerKey(tool, param), cls);
  }
  return { entries, badClass };
}

/**
 * 🔴 THE GATE'S OWN SCOPE CHECK, AS A FUNCTION THAT CAN BE CALLED WITH A COLLAPSED
 * POPULATION — because the version that could not be was itself untestable.
 *
 * 173's reverse sweep caught this in the code written to fix 173: with the check inlined
 * in `comparePathLedger` and the two lists frozen module constants, the only case any
 * test could construct was the healthy one, so `scope` was a collector asserted EMPTY
 * and never once proved to collect. Deleting the check outright left every gate green.
 * A collector only ever asserted empty is a collector nobody has proved collects — 169's
 * tautology with the polarity reversed.
 *
 * The populations are parameters, so the collapse case is one call away.
 *
 * @param canaries the canary list to floor (defaults to the shipped one)
 * @param classes  the class list to floor (defaults to the shipped one)
 * @returns one failure string per collapsed population — never a sum (172 §6)
 */
export function ledgerScopeFailures(canaries = LEDGER_CANARIES, classes = LEDGER_CLASSES) {
  const failures = [];
  if (classes.length < LEDGER_SCOPE.classes) {
    failures.push(
      `LEDGER_CLASSES holds ${classes.length} class(es), floor is ${LEDGER_SCOPE.classes} — ` +
      `an emptied class list sends every entry to badClass, which is loud, but a THINNED one ` +
      `silently rejects rows that were correctly classified`,
    );
  }
  if (canaries.length < LEDGER_SCOPE.canaries) {
    failures.push(
      `LEDGER_CANARIES holds ${canaries.length} canar(ies), floor is ${LEDGER_SCOPE.canaries} — ` +
      `a filter over an emptied list returns nothing and reads as "all canaries present", ` +
      `so the one claim that survives a blind enumerator would itself have gone blind`,
    );
  }
  return failures;
}

/**
 * Compare the live cohort against the ledger IN BOTH DIRECTIONS, and check the two
 * canaries and this gate's own scope.
 *
 * @param liveRows   rows from `enumeratePathCohort` (needs `.tool` and `.param` only)
 * @param ledgerText raw `path-cohort-ledger.tsv`
 * @returns every population this gate derives, each addressable on its own line —
 *   `unclassified` a parameter entered the surface nobody classified;
 *   `stale`        a classification outlived the thing it classified;
 *   `badClass`     an entry with an unknown class or no reason;
 *   `lost`         a canary the enumerator can no longer see;
 *   `scope`        the gate's own two populations, against LITERAL floors.
 */
export function comparePathLedger(liveRows, ledgerText) {
  const rows = Array.isArray(liveRows) ? liveRows : [];
  const { entries, badClass } = parsePathLedger(ledgerText);
  const liveKeys = new Set(rows.map((r) => ledgerKey(r.tool, r.param)));

  const unclassified = [...liveKeys].filter((k) => !entries.has(k));
  const stale = [...entries.keys()].filter((k) => !liveKeys.has(k));
  const lost = LEDGER_CANARIES.filter(([t, p]) => !rows.some((r) => r.tool === t && r.param === p));

  // 🔴 ONE LINE PER POPULATION, NOT A SUM (172 §10.22). Two scope floors that shared a
  // total would let either collapse while the other covered for it.
  const scope = ledgerScopeFailures();

  return {
    unclassified, stale, badClass, lost, scope,
    liveCount: rows.length,
    ledgerCount: entries.size,
    canaryCount: LEDGER_CANARIES.length,
  };
}
