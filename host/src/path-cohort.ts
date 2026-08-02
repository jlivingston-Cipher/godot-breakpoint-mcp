/**
 * THE PATH-LIKE PARAMETER COHORT — the enumeration every containment session scopes
 * its work with, promoted out of scratch and into the shipped surface.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * 🔴 WHY THIS FILE EXISTS AND WHY IT IS NOT A SCRATCH SCRIPT
 *
 * Sessions 163–165 scoped their path work against "78 path-like parameters". That
 * number came from a twelve-line loop in `_to_delete/enum163.mjs` that nobody read.
 * The loop was blind THREE ways, and each blindness hid real defects:
 *
 *   1. it walked TOP-LEVEL `inputSchema.properties` only, so a nested parameter
 *      appeared in no count at all;
 *   2. 🔴 it DISCARDED every parameter literally named `path` —
 *      `if (prop === "path") { pathNamed++; continue; }` — because session 162 had
 *      concluded "I already swept those". That line is not a bug. It is a FINDING
 *      COMPILED INTO THE MEASURING INSTRUMENT, and it kept asserting itself for
 *      three sessions after 165 disproved it. It threw away 124 rows, 15 of which
 *      were escaping;
 *   3. its name test was an ANCHORED EXACT-WORD list, so a compound name like
 *      `font_path` could only ever be found through its DESCRIPTION — and
 *      `card_template_create.theme.font_path` has no description, which made it
 *      invisible to both tests at once.
 *
 * Corrected, the enumeration is 258 rows, not 78. Session 167 re-implemented the
 * corrected rules independently, with FIVE further candidate blindnesses closed
 * (multi-branch unions, non-object array items, camelCase boundaries, identity-based
 * dedupe, additionalProperties containers) and confirmed the same 258: a strict
 * superset that loses nothing and adds one false positive. The instrument is sound.
 *
 * 🔴 THE RULE THIS FILE ENCODES: **a measurement's conclusion must never become the
 * next measurement's filter.** So this enumerator EXCLUDES NOTHING. Over-inclusion is
 * cheap — a row you ask about once and clear. Under-inclusion cost four releases.
 * ─────────────────────────────────────────────────────────────────────────────────
 */

/** One path-like parameter, addressed by its dotted trail from the tool's root. */
export interface PathCohortRow {
  /** Tool name, e.g. `card_template_create`. */
  tool: string;
  /** Dotted parameter trail, e.g. `theme.font_path`. */
  param: string;
  /** Nesting depth; 0 is a top-level parameter. */
  depth: number;
  /** Which hint matched: `name`, `desc`, or `name+desc`. */
  why: string;
  /** The parameter's description, collapsed to one line (often empty — that is the point). */
  desc: string;
  /** True when the leaf is literally named `path` — the cohort enum163 discarded. */
  named: boolean;
}

/**
 * Name segments that make a parameter path-like. Deliberately broad: a name only has
 * to CONTAIN one of these as a segment, so `font_path`, `to_path` and `theme_path`
 * all match where an exact-word test saw nothing.
 */
const NAME_SEG =
  "(path|paths|file|files|scene|scenes|program|uri|url|source|src|dest|destination|target|to|from|dir|" +
  "directory|out|output|input|script|scripts|asset|assets|resource|template|config|cwd|exe|binary|bin|art|" +
  "texture|image|icon|font|sound|audio|mesh|material|shader|theme|tileset|tres|pck|glb|obj|sprite|atlas)";

const NAME_HINT = new RegExp(`(^|_)${NAME_SEG}(_|$)`, "i");
const SEG_EXACT = new RegExp(`^${NAME_SEG}$`, "i");
const DESC_HINT =
  /res:\/\/|user:\/\/|file path|path to|filesystem|absolute path|\.tscn|\.gd\b|\.cs\b|\.tres|\.png|directory/i;

/** Split a name on underscores AND camelCase/digit boundaries, so `toPath` segments. */
function segments(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .split(/[_\-.\s]+/)
    .filter(Boolean);
}

function nameLooksPathLike(name: string): boolean {
  return NAME_HINT.test(name) || segments(name).some((s) => SEG_EXACT.test(s));
}

type Node = Record<string, unknown> | null | undefined;

/**
 * Every non-null branch of a union, or the node itself. enum166 unwrapped ONLY when a
 * single branch survived, so a `string | string[]` parameter fell off the end of its
 * loop — matched neither the stringy test nor the container test.
 */
function branchesOf(node: Node): Node[] {
  const n = node as { anyOf?: Node[]; oneOf?: Node[] } | null | undefined;
  const b = n?.anyOf ?? n?.oneOf;
  if (!b) return [node];
  const nonNull = b.filter((x) => x && (x as { type?: string }).type !== "null");
  return nonNull.length ? nonNull : [node];
}

/** A node is stringy if it, or any branch, is a string or an array of strings. */
function isStringy(node: Node): boolean {
  for (const br of branchesOf(node)) {
    const b = br as { type?: string; items?: Node } | null | undefined;
    if (b?.type === "string") return true;
    if (b?.type === "array") {
      for (const it of branchesOf(b.items)) {
        if ((it as { type?: string } | null)?.type === "string") return true;
      }
    }
  }
  return false;
}

/** Every child property-map reachable from a node: objects, array items, maps. */
function childMaps(node: Node): Record<string, Node>[] {
  const out: Record<string, Node>[] = [];
  for (const br of branchesOf(node)) {
    const b = br as {
      properties?: Record<string, Node>;
      items?: Node;
      type?: string;
      additionalProperties?: { properties?: Record<string, Node> } | boolean;
      patternProperties?: Record<string, { properties?: Record<string, Node> }>;
    } | null | undefined;
    if (!b || typeof b !== "object") continue;
    if (b.properties) out.push(b.properties);
    if (b.type === "array" || b.items) {
      for (const it of branchesOf(b.items)) {
        const i = it as { properties?: Record<string, Node> } | null;
        if (i?.properties) out.push(i.properties);
      }
    }
    if (b.additionalProperties && typeof b.additionalProperties === "object" && b.additionalProperties.properties) {
      out.push(b.additionalProperties.properties);
    }
    if (b.patternProperties) {
      for (const sub of Object.values(b.patternProperties)) if (sub?.properties) out.push(sub.properties);
    }
  }
  return out;
}

function describe(schema: Node): string {
  const own = (schema as { description?: string } | null)?.description;
  if (own) return own;
  for (const br of branchesOf(schema)) {
    const d = (br as { description?: string } | null)?.description;
    if (d) return d;
  }
  return "";
}

const MAX_DEPTH = 6;

function walk(
  tool: string,
  props: Record<string, Node> | undefined,
  trail: string,
  depth: number,
  seen: Set<string>,
  sink: Map<string, PathCohortRow>,
): void {
  for (const [prop, schema] of Object.entries(props ?? {})) {
    if (!schema || typeof schema !== "object") continue;
    const dotted = trail ? `${trail}.${prop}` : prop;
    // dedupe by TRAIL, not by object identity: two parameters may share one schema
    // object, and identity-dedupe silently drops the second.
    if (seen.has(dotted)) continue;
    seen.add(dotted);

    if (isStringy(schema)) {
      const desc = describe(schema);
      const byName = nameLooksPathLike(prop);
      const byDesc = DESC_HINT.test(desc);
      if (byName || byDesc) {
        sink.set(`${tool}\t${dotted}`, {
          tool,
          param: dotted,
          depth,
          why: `${byName ? "name" : ""}${byName && byDesc ? "+" : ""}${byDesc ? "desc" : ""}`,
          desc: desc.replace(/\s+/g, " ").trim(),
          named: prop.toLowerCase() === "path",
        });
      }
      // deliberately NO `continue`: a union can be stringy AND a container at once.
    }
    if (depth < MAX_DEPTH) {
      for (const child of childMaps(schema)) walk(tool, child, dotted, depth + 1, seen, sink);
    }
  }
}

/** A tool as the MCP tool list presents it — only the fields this walk reads. */
export interface ToolLike {
  name: string;
  inputSchema?: { properties?: Record<string, Node> } | undefined;
}

/**
 * Enumerate every path-like parameter across a tool list, nested ones included,
 * sorted by tool then parameter so two runs are diffable.
 */
export function enumeratePathCohort(tools: readonly ToolLike[]): PathCohortRow[] {
  const sink = new Map<string, PathCohortRow>();
  for (const t of [...tools].sort((a, b) => a.name.localeCompare(b.name))) {
    walk(t.name, t.inputSchema?.properties, "", 0, new Set<string>(), sink);
  }
  return [...sink.values()].sort((a, b) => a.tool.localeCompare(b.tool) || a.param.localeCompare(b.param));
}

/** Cohort sizes, kept comparable to the numbers the handoffs quote. */
export function summarisePathCohort(rows: readonly PathCohortRow[]): {
  total: number;
  topLevelNamedPath: number;
  topLevelOther: number;
  nested: number;
} {
  return {
    total: rows.length,
    topLevelNamedPath: rows.filter((r) => r.depth === 0 && r.named).length,
    topLevelOther: rows.filter((r) => r.depth === 0 && !r.named).length,
    nested: rows.filter((r) => r.depth > 0).length,
  };
}
