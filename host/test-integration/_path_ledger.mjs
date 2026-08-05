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
 *
 * 🆕 200 §12.2 — AND ITS NAME NOW SAYS IT IS A FLOOR. `floor_pin_gate.py`'s discovery
 * half can only ask about names it can recognise, and `LEDGER_SCOPE_FLOORS` was one of two
 * constants in TARGETS that no name-scoped walk could ever reach (199 §9). Renamed
 * rather than taught-to-guess: a gate that finds floors by name cannot be taught to find
 * one that does not say it is a floor.
 */
export const LEDGER_SCOPE_FLOORS = Object.freeze({ classes: 7, canaries: 2 });

/**
 * 🔴 AND THE POPULATION THIS FILE COMPARES, WHICH UNTIL 180 IT DID NOT FLOOR AT ALL.
 *
 * 179 §11.2 asked five instruments whether every floor they hold can hold while the
 * number they exist to produce goes to zero. `LEDGER_SCOPE_FLOORS` floors this gate's OWN
 * roster — its classes and its canaries — and that is what 173 built. It says nothing
 * about `liveCount` or `ledgerCount`, which are the two sides of the comparison.
 *
 * The hole was already written down, thirty lines up: *"a session that REGENERATED the
 * ledger from a blind enumerator would take both green together."* It had never been
 * RUN. Session 180 ran it (`_to_delete/measure180d.mjs`), and the sentence is true:
 *
 *     live=2 ledger=2 unclassified=0 stale=0 lost=0 scope=0   EVERY CLAIM PASSES
 *     -> the probe prints "all 2 path-like parameters in the live surface are classified"
 *
 * Two of 258. The canaries defend only a blindness that happens to drop one of THEM;
 * they are two named rows, not a floor.
 *
 * 🔴 AND THE FLOOR EXISTED — IN THE OTHER CALLER. `scripts/path-cohort.mjs` pins
 * `sum.total >= 250` before it calls this function. `authoring-plane.integration.mjs`
 * calls the same function with nothing under it. That is 179's meta-rule word for word:
 * AN INSTRUMENT ENFORCES ITS RULES WHERE THEY WERE WRITTEN, NOT WHERE ITS POPULATION
 * COMES FROM. So the floor moves HERE, where the comparison is, and both callers
 * inherit it instead of one of them remembering.
 *
 * `>=`, not exact, and below the shipped 258/258 with headroom: both sides grow.
 *
 * 🆕 200 §12.2 — RENAMED for the reason above it, and the two are renamed SEPARATELY
 * rather than as one edit because they are two literals under one complaint (194 §33).
 */
export const LEDGER_POPULATION_FLOORS = Object.freeze({ live: 220, ledger: 220 });

/**
 * 🆕 200 §12.2 — THE FIVE COHORT FLOORS, MOVED HERE FROM `scripts/path-cohort.mjs`.
 *
 * 🔴 THEY WERE FOUND BY GOING TO DO THE RENAME ABOVE. 199 §12.2 priced this session's
 * work as "rename two constants so the discovery half can see them". Measuring first
 * (`_to_delete/discover200.py`) said the rename is NECESSARY BUT NOT SUFFICIENT —
 * `Object.freeze(` is neither a digit nor `{`, so `DISCOVER_RE`'s VALUE half rejects the
 * renamed constant anyway — and dropping that value half found ONE more constant in the
 * whole walked tree: `const FLOORS = [` in `scripts/path-cohort.mjs`. Five literal
 * floors, in a script CI runs on every push, named in NO table of `floor_pin_gate.py` —
 * not swept, not exempt, not declared. 199 §32, one session later, on 199's own item.
 *
 * 🔴 THEY MOVE HERE RATHER THAN BEING SWEPT WHERE THEY LAY, and the argument is already
 * written forty lines up in this file: AN INSTRUMENT ENFORCES ITS RULES WHERE THEY WERE
 * WRITTEN, NOT WHERE ITS POPULATION COMES FROM (179). `path-cohort.mjs` is a top-level
 * script that opens an MCP transport at import, so nothing can import it to assert its
 * literals — which is *why* they were unpinnable, not an accident of where they sat.
 * Here they are importable, so the self-test pins every one of the five by value and
 * `floor_pin_gate.py` sweeps five new rows against it.
 *
 * `>=`, not exact, and each one naming what its collapse would mean (172 §6). Measured
 * on the full surface (`BREAKPOINT_PRIVILEGED_GROUPS=all`), session 173: 291/124/128/6/258.
 */
export const COHORT_FLOORS = Object.freeze({
  tools: 285,
  topLevelNamedPath: 120,
  topLevelOther: 124,
  nested: 6,
  total: 250,
});

/** Why each cohort floor exists — prose a reviewer has to disagree with in words (174 §5). */
export const COHORT_FLOOR_WHY = Object.freeze({
  tools: "the tool list itself came back short — every count below is scoped to a surface that is not the real one",
  topLevelNamedPath: "the cohort enum163 DISCARDED. 15 of these were escaping when it was measured",
  topLevelOther: "the compound names an exact-word test cannot match (`font_path`, `to_path`)",
  nested: "the cohort enum163 could not see AT ALL — a top-level-only walk reports zero of these and looks healthy",
  total: "the number the handoffs quote. It was wrong by 180 rows once already",
});

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
export function ledgerScopeFailures(canaries = LEDGER_CANARIES, classes = LEDGER_CLASSES, live = null, ledger = null, pop = LEDGER_POPULATION_FLOORS) {
  const failures = [];
  // 🔴 180 — THE TWO SIDES OF THE COMPARISON, floored HERE so both callers inherit it.
  // `null` means "not offered", which is how `ledgerScopeFailures()` keeps its 173
  // signature meaningful when called with no population at all; `comparePathLedger`
  // always offers both.
  if (live !== null && live < pop.live) {
    failures.push(
      `the LIVE cohort holds ${live} row(s), floor is ${pop.live} — a blind ` +
      `enumerator SHRINKS the live set, so nothing reads as unclassified; if the ledger was ` +
      `regenerated from it, nothing reads as stale either, and the gate prints "all ${live} ` +
      `path-like parameters in the live surface are classified"`,
    );
  }
  if (ledger !== null && ledger < pop.ledger) {
    failures.push(
      `the LEDGER holds ${ledger} entr(ies), floor is ${pop.ledger} — a ledger ` +
      `regenerated from a blind enumerator agrees with it perfectly. Two lists that agree ` +
      `are not two measurements`,
    );
  }
  if (classes.length < LEDGER_SCOPE_FLOORS.classes) {
    failures.push(
      `LEDGER_CLASSES holds ${classes.length} class(es), floor is ${LEDGER_SCOPE_FLOORS.classes} — ` +
      `an emptied class list sends every entry to badClass, which is loud, but a THINNED one ` +
      `silently rejects rows that were correctly classified`,
    );
  }
  if (canaries.length < LEDGER_SCOPE_FLOORS.canaries) {
    failures.push(
      `LEDGER_CANARIES holds ${canaries.length} canar(ies), floor is ${LEDGER_SCOPE_FLOORS.canaries} — ` +
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
export function comparePathLedger(liveRows, ledgerText, pop = LEDGER_POPULATION_FLOORS) {
  const rows = Array.isArray(liveRows) ? liveRows : [];
  const { entries, badClass } = parsePathLedger(ledgerText);
  const liveKeys = new Set(rows.map((r) => ledgerKey(r.tool, r.param)));

  const unclassified = [...liveKeys].filter((k) => !entries.has(k));
  const stale = [...entries.keys()].filter((k) => !liveKeys.has(k));
  const lost = LEDGER_CANARIES.filter(([t, p]) => !rows.some((r) => r.tool === t && r.param === p));

  // 🔴 ONE LINE PER POPULATION, NOT A SUM (172 §10.22). Two scope floors that shared a
  // total would let either collapse while the other covered for it. 180 makes it four:
  // the gate's own roster AND the two sides it compares, offered from here so that every
  // caller is defended rather than the one that remembered to floor its input.
  //
  // 🔴 AND `pop` IS A PARAMETER FOR THE MIRROR OF 173's REASON. 173 made the ROSTER a
  // parameter so the COLLAPSED case was constructible; 180 makes the population floor
  // one so the HEALTHY case still is. Every fixture in the self-test is three rows —
  // adding a 220-row floor with no way to lower it would have turned twenty-eight
  // passing fixture cases red and the honest fix would have looked like weakening the
  // floor. Shipped default, overridable by a fixture, and the default is itself asserted.
  const scope = ledgerScopeFailures(LEDGER_CANARIES, LEDGER_CLASSES, rows.length, entries.size, pop);

  return {
    unclassified, stale, badClass, lost, scope,
    liveCount: rows.length,
    ledgerCount: entries.size,
    canaryCount: LEDGER_CANARIES.length,
  };
}
