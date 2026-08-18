// Shared, protocol-generic helpers for the LSP tool wrappers. Both the GDScript
// plane (tools/lsp.ts) and the C#/OmniSharp plane (tools/cslsp.ts) reshape the
// same standard LSP result types (Location, SymbolKind, CompletionItemKind,
// MarkupContent), so these live once here rather than being duplicated per plane.
// The generic MCP success-envelope helper `ok()` is the single shared envelope
// shape and is imported by the other tool modules too, not only the LSP planes.

import { remedyClause } from "../bridge.js";

export interface Position { line: number; character: number }
export interface Range { start?: Position; end?: Position }
export interface Location { uri?: string; targetUri?: string; range?: Range; targetSelectionRange?: Range }

// LSP CompletionItemKind numeric -> readable name.
export const COMPLETION_KIND: Record<number, string> = {
  1: "text", 2: "method", 3: "function", 4: "constructor", 5: "field", 6: "variable",
  7: "class", 8: "interface", 9: "module", 10: "property", 11: "unit", 12: "value",
  13: "enum", 14: "keyword", 15: "snippet", 16: "color", 17: "file", 18: "reference",
  19: "folder", 20: "enumMember", 21: "constant", 22: "struct", 23: "event", 24: "operator", 25: "typeParameter",
};

// LSP SymbolKind numeric -> readable name.
export const SYMBOL_KIND: Record<number, string> = {
  1: "file", 2: "module", 3: "namespace", 4: "package", 5: "class", 6: "method", 7: "property",
  8: "field", 9: "constructor", 10: "enum", 11: "interface", 12: "function", 13: "variable",
  14: "constant", 15: "string", 16: "number", 17: "boolean", 18: "array", 19: "object",
  20: "key", 21: "null", 22: "enumMember", 23: "struct", 24: "event", 25: "operator", 26: "typeParameter",
};

/**
 * The default ceiling on a completion list, and the only reason there is one.
 *
 * 🔴 MEASURED: ONE `gd_completion` RETURNED 342,116 B (249) — 99.6% of the whole
 * 279-tool `tools/list` surface, in a single result, and pretty-printed and shipped
 * twice by `ok()` below. Completion is the one language-server verb whose result size
 * is a function of PROJECT scope rather than of the cursor: at most positions it is
 * every global class, every autoload and every in-scope built-in. `gd_hover`,
 * `gd_definition` and their C# twins are bounded by the thing under the cursor and are
 * not in this population.
 *
 * 200 is the knowledge family's shipped default — `knowledge.ts` caps grep, symbols and
 * usages there and returns a `truncated` flag beside them. The same number, because a
 * second convention would be a second thing to keep true.
 */
export const COMPLETION_LIMIT = 200;

/**
 * Cap a list and say so. The flag is the whole point: a silently short list reads as a
 * complete one, which is the failure `knowledge.ts` avoided the same way.
 */
export function capList<T>(items: T[], max: number): { items: T[]; truncated: boolean } {
  return items.length > max ? { items: items.slice(0, max), truncated: true } : { items, truncated: false };
}

/** MCP success envelope: human-readable JSON text plus the structured content. */
export function ok(obj: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
    structuredContent: obj as Record<string, unknown>,
  };
}

/** MCP error envelope for a failed LSP call (never throws to the caller). */
export function fail(err: unknown) {
  const e = err as { code?: number | string; message?: string; refusal?: boolean };
  // A REFUSAL is the host declining the call, not the language server failing
  // one. Rendering it as "LSP error [...]" sent the caller to debug a server
  // that was never asked. Refusals carry their own message verbatim.
  if (e?.refusal) {
    return {
      isError: true as const,
      content: [{ type: "text" as const, text: `${e.message ?? String(err)}${remedyClause(err)}` }],
    };
  }
  // 🆕 267 — see `tools/dap.ts`. `LspError` gained a `remedy` field this release; this is
  // the one place both LSP planes render, so both get the clause from one edit.
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `LSP error [${e.code ?? "error"}]: ${e.message ?? String(err)}${remedyClause(err)}` }],
  };
}

/**
 * MCP error envelope for a PATH REFUSAL — the host declining a call before it
 * touches any backend. Lives here, beside `ok`/`fail`, because it belongs to no
 * single plane: the editor writers and the asset generators both raise it.
 *
 * 🔴 DELIBERATELY NOT the editor plane's `fail()`, which labels everything
 * "Bridge error" — that means "the editor could not be reached" and sends the
 * caller to restart Godot over a typo in their own path. The distinction is the
 * one `fail()` above already draws for LSP refusals, applied to the writers.
 *
 * The refusal's own message and `path_outside_project` code carry through
 * unchanged, which is what every gate in the tree actually pins.
 */
export function failPath(err: unknown) {
  const be = err as { code?: string; message?: string };
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `Path error [${be?.code ?? "error"}]: ${be?.message ?? String(err)}${remedyClause(err)}` }],
  };
}

/**
 * Normalize an LSP documentation / MarkupContent field (a plain string, a
 * `{ kind, value }` MarkupContent, or an array of either) down to a single
 * string. Used by hover-style and signature-help results.
 */
export function markupToString(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x === "string" ? x : (x as { value?: string })?.value ?? "")).join("\n");
  if (c && typeof c === "object") return (c as { value?: string }).value ?? "";
  return "";
}

/** True for a JSON-RPC "method not found" (-32601) or an equivalent message. */
export function isMethodNotFound(err: unknown): boolean {
  const e = err as { code?: number | string; message?: string };
  return e.code === -32601 || /method not found/i.test(e.message ?? "");
}

/** Reshape one-or-many LSP Location / LocationLink results into a flat list. */
export function normalizeLocations(result: unknown): Array<{ uri: string; line: number; character: number }> {
  if (!result) return [];
  const arr = Array.isArray(result) ? result : [result];
  return arr.map((l) => {
    const loc = l as Location;
    const uri = loc.uri ?? loc.targetUri ?? "";
    const range = loc.range ?? loc.targetSelectionRange ?? {};
    return { uri, line: range.start?.line ?? 0, character: range.start?.character ?? 0 };
  });
}

// ---- WorkspaceEdit application (shared by the gd_* and cs_* rename mutators) --
// Applying an LSP edit to a file needs a (line, character) -> absolute offset map
// and then splicing edits back-to-front so earlier edits don't shift later ones.
// These live here (rather than in one plane's tool file) because the GDScript and
// C#/OmniSharp rename tools apply identical edit math.

/** Absolute character offset of a (0-based line, 0-based character) in `text`. */
export function offsetOf(text: string, line: number, character: number): number {
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) offset += lines[i].length + 1;
  return offset + character;
}

/** Apply LSP TextEdits to a string, splicing back-to-front so ranges stay valid. */
export function applyTextEdits(text: string, edits: Array<{ range: Range; newText: string }>): string {
  const sorted = [...edits].sort((a, b) => {
    const la = a.range.start?.line ?? 0, lb = b.range.start?.line ?? 0;
    if (la !== lb) return lb - la;
    return (b.range.start?.character ?? 0) - (a.range.start?.character ?? 0);
  });
  let out = text;
  for (const e of sorted) {
    const start = offsetOf(out, e.range.start?.line ?? 0, e.range.start?.character ?? 0);
    const end = offsetOf(out, e.range.end?.line ?? 0, e.range.end?.character ?? 0);
    out = out.slice(0, start) + e.newText + out.slice(end);
  }
  return out;
}

/**
 * Normalize an LSP WorkspaceEdit into a plain `uri -> TextEdit[]` map. Handles
 * BOTH encodings a server may return: the legacy `changes` object AND the
 * versioned `documentChanges` array of `TextDocumentEdit`s (what OmniSharp emits
 * for a rename). File resource operations (create/rename/delete) inside
 * `documentChanges` carry no `edits` and are skipped.
 */
export function normalizeWorkspaceEdit(edit: unknown): Record<string, Array<{ range: Range; newText: string }>> {
  const out: Record<string, Array<{ range: Range; newText: string }>> = {};
  const e = edit as {
    changes?: Record<string, Array<{ range: Range; newText: string }>>;
    documentChanges?: Array<{ textDocument?: { uri?: string }; edits?: Array<{ range: Range; newText: string }> }>;
  } | null;
  if (!e) return out;
  if (e.changes) {
    for (const [uri, edits] of Object.entries(e.changes)) out[uri] = [...(out[uri] ?? []), ...(edits ?? [])];
  }
  if (Array.isArray(e.documentChanges)) {
    for (const dc of e.documentChanges) {
      const uri = dc?.textDocument?.uri;
      if (uri && Array.isArray(dc.edits)) out[uri] = [...(out[uri] ?? []), ...dc.edits];
    }
  }
  return out;
}
