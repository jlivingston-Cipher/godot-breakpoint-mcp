import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The package version, read at runtime rather than hardcoded.
 *
 * Every literal version string in the source is a place a release can forget,
 * and `contract_check.py` check 14 exists because two consecutive releases did.
 * The best outcome is not a gated literal but no literal at all — so anything
 * that merely needs to *report* the version should call this instead of being
 * added to the roster.
 *
 * This was not academic. `lsp.ts` and `cslsp.ts` announced
 * `clientInfo: { version: "0.2.0" }` to Godot's language server and to
 * OmniSharp from the initial commit until 1.26.0 — the project shipped
 * twenty-odd releases telling every LSP server it was 0.2.0, and nothing
 * noticed, because a literal nobody compares to anything cannot go stale
 * loudly.
 *
 * `package.json` ships in the npm tarball, so the read is safe in an installed
 * package; if it ever isn't, an unknown version is better than a stale one.
 */
export function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")).version ?? "unknown";
  } catch {
    return "unknown";
  }
}
