// _population.mjs — THE CLAIM POPULATION, COUNTED, for the live probes.
//
// 169 §4 found that six of the plane probes ended with `…_ALL ok every claim held`
// having counted nothing — a sentence that is literally true of the empty set. The
// two probes fixed there each grew their own gate: `authoring-plane` instrumented
// its `family()` wrapper, `gdscript-dap-plane` wrote a named family manifest. This
// file is that pattern extracted once so the remaining probes do not each grow a
// third variant of it.
//
// 🔴 THE ENUMERATION IN 169 §10 ITEM 2 WAS WRONG IN BOTH DIRECTIONS (session 170,
// measured). Two of its six — `csharp-lsp` and `csharp-dap` — have ZERO claim sites:
// they are documented LOG-ONLY diagnostics whose only gate is reachability, so there
// is nothing in them to count. And it omitted seven probes in exactly the state it
// describes, including `verification-family`, whose 100 assertions were the LARGEST
// uncounted population in the tree. 166's rule, again: read an enumerator's filters
// before trusting its count.
//
// Dependency-free (node builtins only), same as `_png.mjs` and `_workspace.mjs`.
import nodeAssert from "node:assert/strict";

// The three shapes the probes actually have, all fed into one manifest:
//
//   1. TALLY probes (`lsp-plane`, `cs-lsp-plane`) keep a `check(cond, marker, …)`
//      helper and a `failures` counter. They call `claim(marker)` from inside it.
//   2. HEADER-FIRST probes (`cs-dap-plane`) print `-- section --` before the claims
//      it covers. They call `open(label)`.
//   3. FAIL-FAST probes (`tree-shape`, `vcs`, `verification-family`, `animation-lane`,
//      `inject-input`, `node-lifecycle`, `runtime-peers`, `runtime-screenshot`) use
//      bare `node:assert` inside one try/catch and print a NAMED marker at the END of
//      each section. They swap `assert` for the counting proxy and call `seal(marker)`
//      where they already console.log that marker.
//
// 🔴 `seal()` IS WHY THIS PORT IS NOT A REWRITE. The marker lines already exist, are
// already grep-ed by the CI job logs, and already sit exactly at each section's close.
// Attributing every claim made since the previous seal to the marker that closes it
// makes the manifest maintain itself — 169 §4's reason for instrumenting `family()`
// rather than hand-listing 203 marker names, applied to a probe shape that has no
// `family()` to instrument.

export class Population {
  /**
   * @param prefix   marker prefix, e.g. "TREE_LIVE" -> TREE_LIVE_POPULATION
   * @param families the manifest: every family that MUST speak on a complete run
   * @param scope    a literal floor on the manifest's own length (168 §6). Passed
   *                 separately and on purpose: `families.length >= families.length`
   *                 is a tautology, and this file exists because of those.
   * @param claims   the coarse claim floor, measured, not guessed (169 §3)
   */
  constructor(prefix, { families, scope, claims: claimFloor }) {
    if (!prefix) throw new Error("Population: a marker prefix is required");
    if (!Array.isArray(families) || families.length === 0) throw new Error("Population: a family manifest is required");
    if (!Number.isInteger(scope) || !Number.isInteger(claimFloor)) throw new Error("Population: scope and claims floors must be integers");
    this.prefix = prefix;
    this.families = families;
    this.scopeFloor = scope;
    this.claimFloor = claimFloor;
    this.total = 0;
    this.pending = 0;
    this.current = null;
    this.seen = new Map();
    this.vacuous = [];
    this.partial = [];
    this._assert = null;
    this._wrapped = new Map();
  }

  /**
   * Count one claim.
   *
   * With an explicit `family` (the TALLY shape) it is attributed immediately and
   * `pending` is left alone. With none (the SEAL shape) it is held until the marker
   * that closes its section names it. A probe uses one shape or the other; mixing
   * them would attribute the same claim twice.
   */
  claim(family) {
    this.total++;
    if (family) this.seen.set(family, (this.seen.get(family) ?? 0) + 1);
    else if (this.current) this.seen.set(this.current, (this.seen.get(this.current) ?? 0) + 1);
    else this.pending++;
    return true;
  }

  /** HEADER-FIRST: open a named section. Claims count into it until the next open. */
  open(label) {
    this._closeOpen();
    this.current = label;
    if (!this.seen.has(label)) this.seen.set(label, 0);
    return label;
  }

  _closeOpen() {
    if (this.current !== null && (this.seen.get(this.current) ?? 0) === 0) this.vacuous.push(this.current);
    this.current = null;
  }

  /**
   * WRAPPED: run one family whose body may throw without aborting the others — the
   * shape `authoring-plane` proved in 169 §4 and `tabletop-plane` already had.
   *
   * 🔴 THE PARTIAL CASE IS THE SILENT ONE. A family that throws on its FIRST call
   * files one `_THREW` and nothing else, which reads as a single failure. A family
   * that throws HALFWAY keeps the claims it already made and drops every one it had
   * not reached yet — the suite gets smaller and the pass rate stays 100%. Measured
   * in 168: one family throwing early took a total from 207 to 189 with nothing
   * saying so.
   *
   * `onThrow` files the probe's own failure marker; the claim it makes is deliberately
   * counted AFTER `made`, so "claims the body actually made" stays honest.
   */
  async family(label, fn, onThrow) {
    this.open(label);
    const before = this.seen.get(label) ?? 0;
    let threw = null;
    try {
      await fn();
    } catch (e) {
      threw = String(e?.message || e).slice(0, 200);
    }
    const made = (this.seen.get(label) ?? 0) - before;
    // 🔴 CLOSE THE FAMILY *BEFORE* `onThrow` RUNS. Measured, session 170: the probe's
    // own `_THREW` marker is itself a claim, and while the family was still open it
    // landed on the family — so a family that threw before asserting ANYTHING read as
    // having spoken once, and the vacuity gate stayed quiet. That is authoring-plane's
    // "-1 for the _THREW claim itself" (169 §4) as a structural fix rather than an
    // arithmetic one: the marker is real, it is counted, and it belongs to no family.
    this.current = null;
    if (made === 0) this.vacuous.push(label);
    if (threw) {
      if (made > 0) this.partial.push({ label, made, threw });
      onThrow?.(label, threw);
    }
    return { made, threw };
  }

  /**
   * FAIL-FAST: close the section this marker describes, printing it exactly as the
   * probe did before, and attribute every claim made since the previous seal.
   *
   * 🔴 A SEAL THAT DRAINS NOTHING IS THE STRUCTURAL FORM OF 169's TAUTOLOGY. The
   * marker says "ok" and the reader counts it as coverage; if every assertion under
   * it were deleted the line would still print, unchanged, on a green run. `vacuous`
   * is the gate neither existing pattern has, because neither existing pattern has
   * markers that can outlive their own claims.
   */
  seal(marker, detail = "") {
    const made = this.pending;
    this.pending = 0;
    this.seen.set(marker, (this.seen.get(marker) ?? 0) + made);
    if (made === 0) this.vacuous.push(marker);
    console.log(detail ? `${marker} ${detail}` : marker);
    return made;
  }

  /**
   * A counting proxy over `node:assert/strict`, drop-in for the probes that already
   * import it. Every call counts one claim; the call itself is untouched, so a red
   * assertion still throws exactly where and how it did before.
   *
   * Counting at the CALL rather than the source line is deliberate: an assertion
   * inside a helper that runs once per tool is a claim per tool, and the population
   * this gate defends is the runtime one. That is the number 168 §5 watched collapse
   * from 205 to a green 200.
   */
  get assert() {
    if (this._assert) return this._assert;
    const bump = () => this.claim();
    this._assert = new Proxy(nodeAssert, {
      apply: (target, thisArg, args) => { bump(); return Reflect.apply(target, thisArg, args); },
      get: (target, prop, recv) => {
        const value = Reflect.get(target, prop, recv);
        if (typeof value !== "function") return value;
        // 🔴 174: A CLASS IS NOT AN ASSERTION METHOD, SO IT IS PASSED THROUGH WHOLE.
        // Measured across every function-valued property of node:assert: exactly one —
        // `AssertionError` — has a NON-WRITABLE `prototype`, which is what a class has
        // and what none of the twenty assertion methods has. Structural, so it does not
        // depend on reading source text. Wrapping it is what broke `new` and identity;
        // not wrapping it is also just correct, because constructing an error is not a
        // claim and must not touch the counter.
        const proto = Object.getOwnPropertyDescriptor(value, "prototype");
        if (proto && proto.writable === false) return value;
        if (!this._wrapped.has(prop)) {
          // Memoised so `assert.ok !== assert.ok` never becomes a source of confusion.
          //
          // 🔴 174: A PROXY, NOT AN ARROW. The arrow this replaced wrapped EVERY
          // function-valued property, and `nodeAssert.AssertionError` is a CLASS. An
          // arrow cannot be constructed, so `new assert.AssertionError(...)` threw
          // "is not a constructor" and `e instanceof assert.AssertionError` was
          // meaningless — while the claim guarding it, `typeof assert.AssertionError
          // === "function"`, stayed green, because the wrapper that WAS the defect is
          // itself a function. That claim lived in `_population.selftest.mjs`, which
          // the tautology gate's `_`-prefix filter had never once swept.
          //
          // `apply` counts, because a call to an assertion method is a claim.
          // `construct` does NOT, because building an error object is not a claim.
          this._wrapped.set(prop, new Proxy(value, {
            apply: (t, thisArg, args) => { bump(); return Reflect.apply(t, target, args); },
            construct: (t, args, newTarget) => Reflect.construct(t, args, newTarget),
          }));
        }
        return this._wrapped.get(prop);
      },
    });
    return this._assert;
  }

  /**
   * Print the population line and return the failures, cheapest gate first, each
   * catching a shrink the previous one cannot see (169 §4's three-gate shape, plus
   * the vacuity gate this shape makes possible).
   *
   * Returns an array of human-readable failure strings — empty on a healthy run.
   * Callers with their own `failures` counter fold the length in; fail-fast callers
   * use `reportOrDie()`.
   */
  report() {
    this._closeOpen();
    // Claims made after the last seal belong to no section. Counted in the total —
    // they are real assertions — but never allowed to satisfy a family.
    const trailing = this.pending;
    this.pending = 0;
    const failures = [];

    const roster = [...this.seen].map(([m, n]) => `${m}=${n}`).join(" ");
    console.log(
      `\n${this.prefix}_POPULATION claims=${this.total}/${this.claimFloor} ` +
      `families=${this.seen.size}/${this.families.length} vacuous=${this.vacuous.length} ` +
      `partial=${this.partial.length}${trailing ? ` unsealed=${trailing}` : ""}${roster ? ` : ${roster}` : ""}`,
    );

    // 1. THE GATE'S OWN SCOPE (168 §6). A manifest silently emptied to nothing passes
    //    every check below it while covering nothing at all.
    if (this.families.length < this.scopeFloor) {
      failures.push(`${this.prefix}_POPULATION_SCOPE — the manifest itself holds ${this.families.length} entr(ies), floor is ${this.scopeFloor}: a gate whose scope collapsed passes while covering nothing`);
    }

    // 2. EVERY FAMILY MUST SPEAK. A section skipped by a conditional, or never reached
    //    because an earlier one threw, leaves no marker and no failure — it simply is
    //    not there, and the run still reads "every claim held".
    const silent = this.families.filter((f) => !this.seen.has(f));
    if (silent.length) {
      failures.push(`${this.prefix}_POPULATION_SILENT — ${silent.length} famil(ies) never made a claim: ${silent.join(", ")} — they went MISSING rather than failed`);
    }

    // 3. 🔴 AND NO FAMILY MAY SPEAK WITHOUT ASSERTING. The marker prints "ok" either
    //    way; only the count can tell a section that held from one that was emptied.
    if (this.vacuous.length) {
      failures.push(`${this.prefix}_POPULATION_VACUOUS — ${this.vacuous.length} famil(ies) reported ok having asserted NOTHING: ${this.vacuous.join(", ")}`);
    }

    // 4. 🔴 THE ONE THAT WOULD HAVE CAUGHT 168's 207 -> 189. A family that throws PART
    //    WAY through keeps the claims it already made, drops the rest, and leaves one
    //    failure standing in for however many claims went missing.
    if (this.partial.length) {
      failures.push(`${this.prefix}_POPULATION_PARTIAL — ${this.partial.length} famil(ies) threw AFTER claiming, so claims were DROPPED rather than failed: ${this.partial.map((p) => `${p.label}(made ${p.made}, then threw: ${p.threw.slice(0, 60)})`).join(" | ")}`);
    }

    // 5. the coarse backstop: it catches a family that shrank from twenty claims to
    //    one, which the manifest alone cannot see.
    if (this.total < this.claimFloor) {
      failures.push(`${this.prefix}_POPULATION_FLOOR — THE SUITE GOT SMALLER, NOT GREENER: ${this.total} claim(s) ran, floor is ${this.claimFloor}`);
    }

    for (const f of failures) console.log(`  FAIL ${f}`);
    return failures;
  }

  /** For the fail-fast probes: report, and exit non-zero if the population shrank. */
  reportOrDie() {
    const failures = this.report();
    if (failures.length) {
      console.error(`::error::${this.prefix} population gate failed — ${failures.length} gate(s): ${failures.map((f) => f.split(" — ")[0]).join(", ")}`);
      process.exit(1);
    }
    return this.total;
  }
}
