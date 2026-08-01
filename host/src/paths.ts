import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Resolve a project path that may be given as `res://...`, an absolute path, or
 * a path relative to the project root, into an absolute filesystem path.
 */
export function toFsPath(p: string, projectPath: string): string {
  if (p.startsWith("res://")) return path.join(projectPath, p.slice("res://".length));
  if (path.isAbsolute(p)) return p;
  return path.join(projectPath, p);
}

/** Same resolution as toFsPath, returned as a `file://` URI (for LSP). */
export function toFileUri(p: string, projectPath: string): string {
  return pathToFileURL(toFsPath(p, projectPath)).href;
}

/** Read a project file's text, or return "" if it cannot be read. */
export function readFileText(absPath: string): string {
  try {
    return fs.readFileSync(absPath, "utf8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------- guards ----
//
// `toFsPath` normalizes `..` away through path.join and `readFileText` swallows
// every read error, and BOTH are deliberately left that way: they are shared by
// eight tool families, so tightening them here would change behaviour on planes
// this change never measured. The guards below are additive and opt-in — a
// caller that wants the refusal asks for it.
//
// Measured, session 161, against a real editor and a sibling directory beside
// the project root: `card_deck_from_table` read a file OUTSIDE the root through
// all three spellings (absolute, `res://../`, bare `../`) and stamped its
// contents into the scene, and four tabletop writers plus four netcode writers
// created files outside the root through `res://../` — which satisfies a
// `startsWith("res://")` pre-guard. See TT_READ_ESCAPE / TT_WRITE_ESCAPE in the
// tabletop plane gate.

/** A refusal that names WHY a path was rejected. `fail()` renders code+message. */
export interface PathRefusal extends Error {
  refusal: true;
  code: string;
}

function refuse(code: string, message: string): never {
  throw Object.assign(new Error(message), { refusal: true as const, code });
}

/**
 * THE containment test. One implementation, and every guard in the codebase calls it.
 *
 * 🔴 `root + path.sep`, never a bare `startsWith(root)`: a SIBLING directory named
 * `<root>_evil` shares the prefix and would otherwise pass. That is the exact spelling
 * every measurement uses, and the trap 160 §7 records as carried.
 *
 * Before 1.40.0 this comparison existed FIVE times — here, and hand-rolled in lsp.ts,
 * cslsp.ts, dap.ts and csdap.ts. Four copies of a security-relevant check is three too
 * many; 161 §8 item 5 said so, and said to measure the four before folding them.
 */
export function escapesProject(fsPath: string, root: string): boolean {
  return fsPath !== root && !fsPath.startsWith(root + path.sep);
}

/**
 * Resolve a caller-supplied path and REFUSE one that escapes the project root.
 * Returns the resolved absolute path.
 *
 * An absolute path that lands INSIDE the root stays legal — several tools
 * document `table_path` and friends as "res:// or absolute", and narrowing that
 * would break callers who pass a full path to a file in their own project.
 * What is refused is the resolved location, not the spelling.
 */
export function resolveInsideProject(p: string, projectPath: string, label = "path"): string {
  const fsPath = path.resolve(toFsPath(p, projectPath));
  const root = path.resolve(projectPath);
  if (escapesProject(fsPath, root)) {
    refuse(
      "path_outside_project",
      `Refusing ${label} ${JSON.stringify(p)}: it resolves to ${fsPath}, which is outside ` +
      `the Godot project root (${root}). Pass a res:// path, or a path inside the project.`,
    );
  }
  return fsPath;
}

/**
 * `resolveInsideProject`, and the target must already exist AS A REGULAR FILE.
 *
 * This is what separates the four causes `readFileText`'s "" used to conflate.
 * Measured: a missing file, a real but EMPTY file, a DIRECTORY, and `""` (which
 * resolves to the project root itself) all produced the identical
 * "…(does it exist?)" refusal, and three of those four DID exist. Existence and
 * emptiness are different answers and the caller has to be able to tell them
 * apart — an empty table is a data problem, a missing one is a path problem.
 */
export function resolveExistingFile(p: string, projectPath: string, label = "path"): string {
  const fsPath = resolveInsideProject(p, projectPath, label);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(fsPath);
  } catch {
    refuse("not_found", `Refusing ${label} ${JSON.stringify(p)}: no such file (${fsPath}).`);
  }
  if (stat.isDirectory()) {
    refuse(
      "not_a_file",
      `Refusing ${label} ${JSON.stringify(p)}: ${fsPath} is a directory, not a file` +
      `${p === "" ? " — an empty path resolves to the project root itself" : ""}.`,
    );
  }
  if (!stat.isFile()) {
    refuse("not_a_file", `Refusing ${label} ${JSON.stringify(p)}: ${fsPath} is not a regular file.`);
  }
  return fsPath;
}

/**
 * `resolveInsideProject` for a WRITE target, honouring an `overwrite` flag.
 *
 * Returns `{ fsPath, exists }` so the caller can decide what an existing target
 * needs beyond permission to replace it — the tabletop scene creators have to
 * close a stale editor tab first, because the editor reuses an already-open
 * scene rather than re-reading the fresh root the addon just saved.
 */
export function resolveWriteTarget(
  p: string,
  projectPath: string,
  opts: { overwrite?: boolean; label?: string } = {},
): { fsPath: string; exists: boolean } {
  const label = opts.label ?? "path";
  const fsPath = resolveInsideProject(p, projectPath, label);
  const exists = fs.existsSync(fsPath);
  if (exists && !opts.overwrite) {
    refuse(
      "exists",
      `Refusing to write ${label} ${JSON.stringify(p)}: ${fsPath} already exists. ` +
      `Pass overwrite:true to replace it, or choose another path.`,
    );
  }
  return { fsPath, exists };
}

// ------------------------------------------- the four language/debug planes ----
//
// MEASURED, session 162, through the REAL stdio server against a temp project copy
// with a sibling `<root>_evil/` beside it: 310 (tool × spelling) rows across
// lsp.ts (19 path-taking tools), cslsp.ts (9), dap.ts (2) and csdap.ts (1).
//
// 🔴 The observation that made the two cs_* planes measurable on a Mac with no Mono
// build, no OmniSharp and no netcoredbg: every one of the four guards refuses BEFORE
// it touches its transport, so a refusal needs no backend at all.
//
// What the measurement settled, and why the wording below is a PARAMETER rather than
// a constant:
//
//   · lsp.ts / cslsp.ts / dap.ts refuse EVERY escaping spelling — `res://..`, a bare
//     relative `..`, and an absolute path elsewhere.
//   · 🔴 csdap.ts refuses only PROJECT-ANCHORED spellings, and that difference is
//     LOAD-BEARING, not an oversight. `cs_dbg_launch` documents debugging a different
//     .NET program whose sources live outside the Godot C# project, so an absolute
//     path elsewhere has to stay legal. Measured, not assumed: `<csroot>_evil/…` and
//     `elsewhere/…` both answered ok, and the cs-dap gate depends on it — its own
//     fixture source is exactly that case. This is the difference 161 §8 item 5
//     predicted might exist and told this session to find before folding anything.
//   · Each plane's refusal TEXT is pinned by its live gate — /outside the Godot
//     project root/, /outside the C# project root/, /no such file/, /is not a file/,
//     and cs-dap additionally asserts the refusal is NOT dressed as an adapter error.
//     So this helper is behaviour-preserving BY CONSTRUCTION: identical strings, one
//     implementation. Nothing about what any plane answers changes.

/** Per-plane wording and anchoring for `resolveSourceFile`. */
export interface PlaneWording {
  /** Names the root in an escape refusal, e.g. "the Godot project root". */
  root: string;
  /** Sentence closing an escape refusal — each plane names its own way out. */
  escapeHint: string;
  /** Sentence closing a not-found refusal — each plane names what used to happen. */
  missingHint: string;
  /** Appended to a not-a-file refusal when the path was `""`. */
  emptyNote?: string;
  /**
   * 🔴 csdap.ts only: root-check ONLY project-anchored spellings, leaving an absolute
   * path elsewhere legal. See the note above; do not set this anywhere else without
   * measuring that plane first.
   */
  anchoredOnly?: boolean;
}

/**
 * The guard the four language/debug planes share: refuse a source that escapes the
 * project root, names nothing, or names something that is not a regular file.
 *
 * Separate from `resolveExistingFile` on purpose. That one serves tabletop/netcode,
 * whose refusals are worded around READING A TABLE and whose gate pins "is a
 * directory, not a file"; these four are worded around A BREAKPOINT THAT CANNOT BIND
 * and their gates pin "is not a file". Same check, two shipped vocabularies — folding
 * the vocabularies together would change answers this session did not measure.
 */
export function resolveSourceFile(p: string, projectPath: string, w: PlaneWording): string {
  const fsPath = path.resolve(toFsPath(p, projectPath));
  const root = path.resolve(projectPath);
  const anchored = !w.anchoredOnly || !path.isAbsolute(p);
  if (anchored && escapesProject(fsPath, root)) {
    refuse(
      "path_outside_project",
      `Refusing ${JSON.stringify(p)}: it resolves to ${fsPath}, which is outside ${w.root} ` +
      `(${root}). ${w.escapeHint}`,
    );
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(fsPath);
  } catch {
    refuse("file_not_found", `Refusing ${JSON.stringify(p)}: no such file (${fsPath}). ${w.missingHint}`);
  }
  if (!stat.isFile()) {
    refuse("not_a_file", `Refusing ${JSON.stringify(p)}: ${fsPath} is not a file${p === "" ? w.emptyNote ?? "" : ""}.`);
  }
  return fsPath;
}
