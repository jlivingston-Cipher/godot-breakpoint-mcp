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
  // `root + path.sep`, never a bare startsWith(root): a SIBLING directory named
  // `<root>_evil` shares the prefix and would otherwise pass. That is the exact
  // spelling the measurement used, and the trap 160 §7 records as carried.
  if (fsPath !== root && !fsPath.startsWith(root + path.sep)) {
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
