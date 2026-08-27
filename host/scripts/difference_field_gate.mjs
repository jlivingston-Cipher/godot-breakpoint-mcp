#!/usr/bin/env node
// difference_field_gate.mjs — session 285. A DIFFERENCE FIELD IS AN OPTIONAL NAME.
//
// 🔴 WHY THIS EXISTS, AND WHAT IT DELIBERATELY IS NOT. 284 §7 NEXT #2 asked for a gate
// that calls a tool twice and asks whether the second answer is honest about the first.
// `SECOND_CALL_GATE_DESIGN_2026-08-27.md` §6 settled the assertion shape and told the
// implementer to READ THE DECLARED-DIFFERENCE FIELD FROM THE REGISTRY rather than carry
// a list of "fields that count" inside the gate — because a gate holding its own list
// drifts from the tools and wins the argument silently.
//
// That instruction is right and it is UNDER-SPECIFIED, and this file is what measuring
// it produced. THIS IS NOT THE SECOND-CALL GATE. It makes no second call, it observes no
// world, and it cannot see a tool that destroys a file. It governs the PRECONDITION the
// second-call gate reads: that the population is derivable, that the answers stay
// regular, and that a field name means ONE thing.
//
// ── 🔴 THE MEASUREMENT THAT MADE THIS A SEPARATE FILE ────────────────────────────────
//
// Measured on the wire at 5233a71, with `BREAKPOINT_PRIVILEGED_GROUPS=all`:
//
//     replaced    optional 23   required 0
//     coerced     optional 25   required 0
//     requested   optional 25   required 2   <- main_screen_set, vcs_restore
//     existed     optional  0   required 1   <- filesystem_create_dir
//
// On the twenty-five, `requested` is `.optional()` and PRESENCE IS THE SIGNAL: the field
// appears only when the engine stored something other than what the caller asked for. On
// `main_screen_set` and `vcs_restore` the identical name is REQUIRED — always present,
// a plain echo of the argument, where `active` and `restored` carry the measurement.
// `restored` IS MEASURED, NOT ECHOED (155 §2, D5) is written in `schemas.ts` about the
// very tool that makes the name ambiguous.
//
// 🔴 SO A GATE THAT KEYS ON THE NAME READS AN ECHO AS A MEASUREMENT, TWICE OUT OF
// TWENTY-SEVEN. That is 284 §2.3 — ONE SHAPE FOR TWO JOBS MAKES A SYMMETRY CLAIM
// UNFALSIFIABLE — arriving on the second envelope one session after `mp_wire_rpc`, and
// found by writing the gate rather than by an engine pass. The discriminator was on the
// wire the whole time, in the output schema's `required` array.
//
// Two honest kinds, and the design brief's §6 table conflates them:
//
//   PRESENCE — an OPTIONAL field that appears only when something differed. Absence is
//              itself an answer. `replaced`, `coerced`, the envelope's `requested`.
//   VALUE    — a REQUIRED field always present, whose VALUE carries the difference.
//              `existed` on `filesystem_create_dir`. Read by value or not at all.
//
// A second-call gate may key on a PRESENCE field. It may NOT key on a VALUE field, and
// it must never key on a name that is both without being told which tools are which.
//
// ── 🔴 AND THE POPULATION IS 28, NOT THE 26 THE BRIEF PRICED ─────────────────────────
//
// The brief measured `overwrite:` DECLARATION SITES in `src/tools/` — 26, because
// `imageInput` is one literal shared by three tools. The REGISTERED population is 28.
// 282 §2.3 (a guarantee is false until something derives its population) says the sites
// are the wrong unit, and this gate reads the wire.
//
// 🔴 AND THE DEFAULT WIRE IS NOT THE POPULATION. Five of the twenty-eight sit in the
// default-off `code-execution` capability group and are ABSENT from `tools/list` for an
// ordinary client. The unit suite cannot see this: `destination_overwrite.test.ts` walks
// `buildToolsets` through a STUB that never applies the capability wrapper, so it
// records all 292 registrations and is right to. THE LIVE PLANE IS WHERE THE GAP OPENS,
// and the live plane is where the second-call gate goes. A gate deriving DRIVEN from a
// default-configured client would drive 23 of 28 and report a clean green — 284 §1.3's
// defect exactly, where blinding `queue_head` to (0, "") made the requirement
// `range(233, 0)`, empty, therefore clean. UNREAD IS NOT GREEN (281 §1.2).
//
// So the gap is DECLARED here, per tool and with a reason, and an undeclared one
// refuses. A future second-call gate reads `defaultOffDeclared()` and says out loud
// which five it is not driving, rather than discovering them by their absence.
//
// ── WHAT THIS GATE CANNOT SEE, STATED SO NOBODY MISTAKES ITS GREEN ───────────────────
//
// It reads schemas. It does not call a tool, does not touch a file, does not start an
// engine. Every defect 284 found was invisible to a schema and obvious on a second call.
// A green here means the ANSWERS ARE REGULAR AND THE NAMES ARE UNAMBIGUOUS; it means
// nothing whatsoever about whether a tool tells the truth. That sentence is the gate's
// declared reach and it is asserted, not just written: see `REACH` below.
//
// Run:  node scripts/difference_field_gate.mjs
//       node scripts/difference_field_gate.mjs --selftest
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOST = path.resolve(HERE, "..");
const ENTRY = path.join(HOST, "dist", "index.js");

/** The gate's declared reach, asserted by the selftest so it cannot rot into prose. */
export const REACH = {
  reads: ["tools/list input schemas", "tools/list output schemas", "the required arrays"],
  cannotSee: ["a second call", "the filesystem", "a running engine", "whether a reply is true"],
};

/**
 * 🔴 THE FLOOR IS A FLOOR, NOT AN EQUALITY. 285 measured 28 and pins 24: a population
 * that GROWS is the tree working, and one that shrinks by five is the capability wrapper
 * or the derivation breaking. An equality would redden on every new writer and would be
 * edited to shut it up, which is how a floor becomes a transcription of the present.
 */
export const POPULATION_FLOOR = 24;

/**
 * The five that a default-configured client cannot see, DECLARED with the reason, per
 * tool. 183 §7's rule: an exemption costs a written sentence somebody can disagree with,
 * not a count. This table is what a later second-call gate must print as its unreached
 * set — the alternative is a green over a population five short of the one it names.
 */
/** @type {Record<string, string>} */
export const DEFAULT_OFF = {
  asset_gen_sprite: "capability group `code-execution`, OFF by default",
  asset_gen_texture: "capability group `code-execution`, OFF by default",
  asset_gen_icon: "capability group `code-execution`, OFF by default",
  asset_gen_audio_sfx: "capability group `code-execution`, OFF by default",
  asset_gen_model: "capability group `code-execution`, OFF by default",
};

/**
 * A field name whose sense is NOT uniform across the surface, declared per tool.
 *
 * 🔴 THIS TABLE IS THE FINDING, AND IT IS DELIBERATELY NOT A FIX. `requested` means two
 * things and both are defensible: on the coercion envelope it is the name you asked for,
 * present only when the engine gave you a different one; on `main_screen_set` and
 * `vcs_restore` it is the argument echoed beside a measured result. Renaming either is a
 * wire change with a `wire_diff` cost and a `BYTES_CEILING` cost, and it is not this
 * session's to spend. What IS this session's is that the ambiguity stops being invisible:
 * a reader keying on the name gets a refusal here rather than a wrong answer later.
 */
/** @type {Record<string, Record<string, string>>} */
export const DUAL_SENSE = {
  requested: {
    main_screen_set: "REQUIRED: echoes the requested main-screen tab beside the MEASURED `active`",
    vcs_restore: "REQUIRED: echoes the requested path list beside the MEASURED `restored` (155 §2, D5)",
  },
};

/** Names read by VALUE — always present, never a presence signal. */
/** @type {Record<string, Record<string, string>>} */
export const VALUE_KIND = {
  existed: {
    filesystem_create_dir: "REQUIRED boolean: the operation is a directory, and `existed` answers it by value",
  },
};

/** The input flag that marks a caller-named destination this surface can be told to keep. */
const GATE_INPUT = "overwrite";
/** The presence-kind field that says the destination was taken. */
const GATE_OUTPUT = "replaced";

const props = (s) => Object.keys(s?.properties ?? {});
const required = (s) => new Set(s?.required ?? []);

/**
 * Read one wire. Separated from `judge` so the selftest can drive the judgement over
 * fixtures without spawning a server, and so a failure to READ is never a green.
 */
/**
 * @param {Record<string, string>} [env]
 * @returns {Promise<Array<{name: string, input: Set<string>, output: Set<string>, outputRequired: Set<string>}>>}
 */
export async function readWire(env = {}) {
  const { surface } = await import("./wire_diff.mjs");
  const tools = await surface(ENTRY, { GODOT_PROJECT: process.env.GODOT_PROJECT ?? path.join(HOST, "..", "example"), ...env });
  return tools.map((t) => ({
    name: t.name,
    input: new Set(props(t.inputSchema)),
    output: new Set(props(t.outputSchema)),
    outputRequired: required(t.outputSchema),
  }));
}

/**
 * 🔴 EVERY CLAIM RUNS. None short-circuits another (175's rule) — a gate that stops at
 * its first failure reports one defect and hides the population behind it.
 */
/**
 * @param {Array<{name: string, input: Set<string>, output: Set<string>, outputRequired: Set<string>}>} full
 * @param {Array<{name: string, input: Set<string>, output: Set<string>, outputRequired: Set<string>}>} dflt
 * @param {{populationFloor?: number, defaultOff?: Record<string, string>,
 *          dualSense?: Record<string, Record<string, string>>,
 *          valueKind?: Record<string, Record<string, string>>}} [opts]
 */
export function judge(full, dflt, { populationFloor = POPULATION_FLOOR, defaultOff = DEFAULT_OFF, dualSense = DUAL_SENSE, valueKind = VALUE_KIND } = {}) {
  /** @type {string[]} */ const lines = [];
  /** @type {string[]} */ const bad = [];
  const name = (rows, f, side = "input") => rows.filter((r) => r[side].has(f)).map((r) => r.name).sort();

  // ── DF_POPULATION ── derived, floored, never empty ─────────────────────────────────
  const takes = name(full, GATE_INPUT);
  const says = name(full, GATE_OUTPUT, "output");
  lines.push(`  · DF_POPULATION ${takes.length} tool(s) take \`${GATE_INPUT}\` · ${says.length} declare \`${GATE_OUTPUT}\` · floor ${populationFloor}`);
  if (takes.length < populationFloor) {
    bad.push(`🔴 DF_POPULATION only ${takes.length} tool(s) take \`${GATE_INPUT}\` against a floor of ${populationFloor}. `
      + `A population that collapses makes every claim below vacuously true — two empty sets are equal (284 §1.3).`);
  }

  // ── DF_SYMMETRY ── on the WIRE, which the unit stub cannot reach ───────────────────
  const onlyIn = takes.filter((n) => !says.includes(n));
  const onlyOut = says.filter((n) => !takes.includes(n));
  if (onlyIn.length) {
    bad.push(`🔴 DF_SYMMETRY tool(s) that accept \`${GATE_INPUT}\` and cannot say they used it: ${onlyIn.join(", ")}`);
  }
  if (onlyOut.length) {
    bad.push(`🔴 DF_SYMMETRY tool(s) that declare \`${GATE_OUTPUT}\` with no way for the caller to ask: ${onlyOut.join(", ")}`);
  }
  if (!onlyIn.length && !onlyOut.length) lines.push(`  · DF_SYMMETRY exact — \`${GATE_INPUT}\` and \`${GATE_OUTPUT}\` name the same ${takes.length} tool(s) ON THE WIRE`);

  // ── DF_DEFAULT_REACH ── the gap a live gate would silently not drive ───────────────
  const visible = new Set(dflt.map((r) => r.name));
  const unreached = takes.filter((n) => !visible.has(n));
  const undeclared = unreached.filter((n) => !defaultOff[n]);
  const stale = Object.keys(defaultOff).filter((n) => !unreached.includes(n));
  lines.push(`  · DF_DEFAULT_REACH default wire ${dflt.length} tool(s) · full ${full.length} · ${unreached.length} of the population unreachable by an ordinary client, ${Object.keys(defaultOff).length} declared`);
  if (undeclared.length) {
    bad.push(`🔴 DF_DEFAULT_REACH ${undeclared.length} tool(s) in the population are absent from the default wire and DECLARED NOWHERE: ${undeclared.join(", ")}. `
      + `A live gate deriving its population from a default client would drive ${takes.length - unreached.length} of ${takes.length} and call it complete.`);
  }
  if (stale.length) {
    bad.push(`🔴 DF_DEFAULT_REACH ${stale.length} declared exemption(s) no longer describe the wire: ${stale.join(", ")}. `
      + `An exemption nobody re-derives is prose (233 §18).`);
  }

  // ── DF_KIND ── presence vs value, and the name that is both ────────────────────────
  /** @type {Map<string, {presence: string[], value: string[]}>} */ const kinds = new Map();
  for (const r of full) {
    for (const f of r.output) {
      if (!kinds.has(f)) kinds.set(f, { presence: [], value: [] });
      kinds.get(f)[r.outputRequired.has(f) ? "value" : "presence"].push(r.name);
    }
  }
  for (const f of [GATE_OUTPUT, "coerced", "requested", "existed"]) {
    const k = kinds.get(f);
    if (!k) { bad.push(`🔴 DF_KIND \`${f}\` is on no tool's output schema — the reader has gone blind or the field is gone`); continue; }
    lines.push(`  · DF_KIND ${f}: presence ${k.presence.length} · value ${k.value.length}`);
    const split = k.presence.length > 0 && k.value.length > 0;
    if (!split) continue;
    const declared = dualSense[f] ?? {};
    const bothUndeclared = k.value.filter((n) => !declared[n] && !(valueKind[f] ?? {})[n]);
    if (bothUndeclared.length) {
      bad.push(`🔴 DF_KIND \`${f}\` is PRESENCE on ${k.presence.length} tool(s) and REQUIRED on ${k.value.length} (${k.value.join(", ")}); ${bothUndeclared.join(", ")} declare(s) no reason. `
        + `One shape for two jobs makes a symmetry claim unfalsifiable (284 §2.3) — a reader keying on the NAME reads an echo as a measurement.`);
    }
  }
  // a declared VALUE-kind name that has quietly become optional is the reverse rot
  for (const [f, tools] of Object.entries(valueKind)) {
    const k = kinds.get(f);
    for (const t of Object.keys(tools)) {
      if (k && !k.value.includes(t)) bad.push(`🔴 DF_KIND \`${f}\` is declared VALUE-kind on ${t} and is no longer required there`);
    }
  }

  // ── DF_UNDECLARED ── takes a destination, declares no presence-kind difference ─────
  const mute = takes.filter((n) => {
    const r = full.find((x) => x.name === n);
    return !r.output.has(GATE_OUTPUT) || r.outputRequired.has(GATE_OUTPUT);
  });
  if (mute.length) {
    bad.push(`🔴 DF_UNDECLARED ${mute.join(", ")} take(s) a caller-named destination and declares no PRESENCE-kind difference field. `
      + `A required \`${GATE_OUTPUT}\` is always present and therefore signals nothing.`);
  } else {
    lines.push(`  · DF_UNDECLARED 0 — every tool in the population signals by PRESENCE`);
  }

  lines.push(`DIFFERENCE_FIELD ${takes.length} in population · ${unreached.length} unreachable by default (${Object.keys(defaultOff).length} declared) · `
    + `${[...kinds.keys()].length} output field name(s) classified · reads ${REACH.reads.length}, cannot see ${REACH.cannotSee.length}`);
  return { lines, bad };
}

export async function main() {
  // 🔴 BEFORE ANY VERDICT BRANCH (233's draft-3 rule): a marker printed only on the green
  // path cannot tell a caught mutant from a crashed gate.
  console.log(`DIFFERENCE_FIELD_BEGIN reads ${REACH.reads.length} · cannot see ${REACH.cannotSee.length}`);
  const full = await readWire({ BREAKPOINT_PRIVILEGED_GROUPS: "all" });
  const dflt = await readWire({ BREAKPOINT_PRIVILEGED_GROUPS: "" });
  const { lines, bad } = judge(full, dflt);
  // 🔴 A JUDGEMENT THAT PRODUCED NO READINGS AT ALL IS NOT A CLEAN TREE, and without this
  // the live axis is strictly weaker than the self-test: a `judge` blinded to
  // `{lines: [], bad: []}` prints nothing, exits 0, and reads exactly like a green run.
  // 284 §1.3 is the same sentence about `range(233, 0)`.
  if (!lines.length) {
    console.log("  FAIL DF_NO_READINGS 🔴 the judgement produced no readings at all — it "
      + "measured nothing, and an empty verdict is not the same observation as a clean one.");
    process.exit(1);
  }
  for (const l of lines) console.log(l);
  // 🔴 PRINTED IN THIS TREE'S OWN SELF-TEST DIALECT (`A_FAIL`), NOT ONLY IN PROSE.
  // `instrument_gate`'s late-live blast is a COUNT of reported failures, and a command
  // that reports by prose alone lands in `LATE_LIVE_BLAST_UNCOUNTABLE` — a table whose own
  // header says the way to leave it is to give the command a `FAIL <NAME>` line. The
  // judgement's shape is unchanged; only the printing is.
  for (const b of bad) console.log(b.replace(/^🔴 (DF_[A-Z_]+)/, "  FAIL $1 🔴"));
  if (bad.length) {
    console.log(`🔴 DIFFERENCE_FIELD refused — ${bad.length} problem(s).`);
    process.exit(1);
  }
  console.log("🟢 DIFFERENCE_FIELD ok — the population derives, the two spellings are symmetric on the wire, "
    + "the default-wire gap is declared per tool, and no difference-field name is silently used in both senses. "
    + "🔴 THIS SAYS NOTHING ABOUT WHETHER A TOOL TELLS THE TRUTH ON A SECOND CALL.");
}

if (process.argv[1]?.endsWith("difference_field_gate.mjs") && !process.argv.includes("--selftest")) main();
