import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Loopback-bridge shared secret (host side).
 *
 * The editor addon / runtime autoload mint a per-project secret to
 * <projectPath>/.godot/breakpoint_mcp.secret (see addons/breakpoint_mcp/
 * bridge_secret.gd). Reading the same file lets the host authenticate to the
 * loopback bridges with ZERO configuration. An env override wins for advanced /
 * host-launched-child cases. When no material is available (an insecure or
 * not-yet-provisioned bridge) the resolver returns null and the client connects
 * without an auth line — backward-compatible with a bridge that isn't enforcing.
 */

/** Read the minted project secret, or null if absent/empty/unreadable. */
export function readProjectSecret(projectPath: string): string | null {
  try {
    const p = path.join(projectPath, ".godot", "breakpoint_mcp.secret");
    const s = fs.readFileSync(p, "utf8").trim();
    return s.length ? s : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the bridge secret: the first non-empty env var in `envNames` wins,
 * else the minted project-secret file. Read lazily per connect so a secret that
 * appears after startup (the editor launched later) is picked up on reconnect.
 */
export function resolveBridgeSecret(projectPath: string, envNames: string[]): string | null {
  for (const name of envNames) {
    const v = process.env[name];
    if (v && v.trim()) return v.trim();
  }
  return readProjectSecret(projectPath);
}

/**
 * Mint the per-project secret if it does not exist yet, and return it (or the
 * existing one). Returns null if the file can neither be read nor written — the
 * caller then proceeds exactly as before, with the child minting its own.
 *
 * Why the HOST mints it, ahead of spawning peers (F6 spike, constraint 2):
 * `BridgeSecret.load_or_mint()` in the addon is a check-then-write with no lock
 * — `file_exists → read` ELSE `mint → write`. F6 spawns N children through one
 * funnel, so on a COLD project every child can reach the mint branch before any
 * of them has written. Two peers minting different secrets, each holding its own
 * in memory while the last writer wins on disk, is a peer the host can never
 * authenticate against — and it presents as a flaky spawn, not a clear error.
 * Measured 6/6 clean at 3 simultaneous peers, but that is Godot's ~200 ms init
 * versus a sub-millisecond mint, i.e. timing, not a guarantee; the window is
 * structurally open and would surface on someone else's slower machine.
 *
 * Writing the file first closes it by construction: every child then takes the
 * `file_exists` path (verified 4/4 in the spike, with the file untouched after).
 * An EXISTING secret is never overwritten — the editor may have minted it, and
 * all three parties must agree on one value.
 *
 * Format matches `addons/breakpoint_mcp/bridge_secret.gd` exactly: 32 random
 * bytes, hex-encoded to 64 characters, at `<projectPath>/.godot/breakpoint_mcp.secret`.
 * Note the addon's `_setup_auth()` does NOT read the env overrides — they are
 * host-side only — so the FILE is the mechanism for a host-launched child.
 */
export function ensureProjectSecret(projectPath: string): string | null {
  const existing = readProjectSecret(projectPath);
  if (existing) return existing;
  try {
    const dir = path.join(projectPath, ".godot");
    fs.mkdirSync(dir, { recursive: true });
    const secret = randomBytes(32).toString("hex");
    // wx: never clobber a secret another process minted between the read above
    // and this write — losing that race must be a no-op, not an overwrite.
    try {
      fs.writeFileSync(path.join(dir, "breakpoint_mcp.secret"), secret, { encoding: "utf8", flag: "wx", mode: 0o600 });
      return secret;
    } catch {
      return readProjectSecret(projectPath);
    }
  } catch {
    return null;
  }
}
