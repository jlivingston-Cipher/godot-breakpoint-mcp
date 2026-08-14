import { ok, failPath } from "../lsp-common.js";
import { resolveInsideProject } from "../../paths.js";
import type { BridgeClient, BridgeError } from "../../bridge.js";
import { remedyClause } from "../../bridge.js";

/**
 * MCP error envelope for a failed editor-bridge call (never throws to the
 * caller). Distinct from lsp-common's `fail` (which labels errors "LSP error");
 * this one labels them "Bridge error".
 */
export function fail(err: unknown) {
  const be = err as Partial<BridgeError> & { message?: string };
  const code = be?.code ?? "error";
  const message = be?.message ?? String(err);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `Bridge error [${code}]: ${message}${remedyClause(err)}` }],
  };
}

/**
 * Build the shared bridge-call helper used by every editor tool group: forward
 * a method to the in-editor addon over TCP and wrap the result in the standard
 * MCP success envelope, or a friendly Bridge-error envelope when unreachable.
 */
export function makeCall(bridge: BridgeClient) {
  return async (method: string, params: Record<string, unknown> = {}) => {
    try {
      return ok(await bridge.request(method, params));
    } catch (err) {
      return fail(err);
    }
  };
}

export type EditorCall = ReturnType<typeof makeCall>;

// ------------------------------------------------------------ path guard ----
//
// MEASURED, session 164, against a real 4.7 editor with the addon live, on a temp
// project copy at /private/tmp/g164 with a prefix-sharing sibling `example_evil/`:
// ELEVEN editor writers created files OUTSIDE the project root through `res://../`,
// and `filesystem_move` MOVED one out. Every one answered `ok` and echoed the
// escaping path straight back. The verdict came from `stat`, not from the reply —
// 163 §1's lesson, which is that an ACCEPTANCE is only measured by asking a channel
// the tool does not control.
//
// 🔴 THE ADDON'S ONLY CHECK IS `to_path.begins_with("res://")`, at seventeen call
// sites in operations.gd, and `res://../` satisfies it. That is why a bare relative
// and an absolute path are already refused (self-announcing) while `res://../` was
// silent. This guard closes the silent one; it does not touch the other two.

/**
 * Build the containment guard the editor writers share. Returns `null` when the
 * path is legal and a ready-to-return error envelope when it escapes, so a call
 * site reads as one line and cannot forget the `return`.
 *
 * 🔴 IT RETURNS NOTHING AND REWRITES NOTHING. The caller's ORIGINAL spelling still
 * goes on the wire, so `res://foo.tres` reaches the addon exactly as before and the
 * guard is provably inert on every path that already worked — the same property
 * 163's `guardScene` was built for, and an over-eager mutation keeps it that way.
 */
export function makePathGuard(projectPath: string) {
  return (p: string | undefined, label: string) => {
    if (p === undefined) return null; // an absent optional param has nothing to escape
    try {
      resolveInsideProject(p, projectPath, label);
      return null;
    } catch (err) {
      return failPath(err);
    }
  };
}

export type PathGuard = ReturnType<typeof makePathGuard>;
