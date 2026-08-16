/**
 * The addon's version, read from the artifact rather than believed.
 *
 * 🔴 WHY THIS FILE EXISTS, MEASURED BEFORE IT WAS WRITTEN (session 258 §2). The
 * addon is the half of this product npm cannot version — `registry_bytes.py` says
 * so in its own comment: *the only name npm has for that artifact is the HOST
 * version*. It ships inside the host tarball, it moves on its own cadence, and
 * until this file nothing anywhere compared the copy a user is RUNNING to the copy
 * their host SHIPPED. Four things compounded:
 *
 *   1. `installAddon` tested `fs.existsSync(dest/plugin.cfg)` and skipped. The
 *      destination's `version=` was never opened, so upgrading the host and
 *      re-running `init` printed `addon: skipped` and pinned the old addon
 *      FOREVER. Walked live at 258: install 1.74.1 → addon 1.9.9; upgrade the
 *      host to 1.75.0, whose bundled addon is 1.10.0; `init` → still 1.9.9.
 *   2. `doctor` regexed the version out of `plugin.cfg`, interpolated it into a
 *      display string and hardcoded `status: "ok"` — a green line carrying the
 *      number that proves it should be red.
 *   3. Nothing crossed the wire. `operations.gd`'s `ping` put `addon_version` in
 *      its reply and all four consumers discarded it; the runtime plane's `ping`
 *      did not carry one at all.
 *   4. The remedy that names this failure shipped only in the addon that is not
 *      stale — `error_remedies.gd` was ADDED in 1.10.0.
 *
 * So the comparison is spelled ONCE, here, and the three readers that need it —
 * `init` on skip, `doctor` on both pairs, and the host's own fallback remedy —
 * import it rather than each growing a regex. A version comparison written three
 * times is two of them wrong the first time the format changes.
 */
import fs from "node:fs";
import path from "node:path";

/** Where the addon lives inside a Godot project, relative to the project root. */
export const ADDON_REL = "addons/breakpoint_mcp";

/**
 * The one sentence that turns a skew into an instruction, spelled once because
 * four places print it: `doctor`'s on-disk check, `doctor`'s running-addon check,
 * `init`'s warning when it skips, and the host's fallback remedy for a stale
 * addon's `unknown_method`.
 *
 * 🔴 IT NAMES `--force` AND THAT IS THE WHOLE POINT. `installAddon` skips a
 * destination that already has a `plugin.cfg`, so a remedy that says re-run
 * `breakpoint-mcp init` is an instruction that does nothing in the one state it
 * is ever read in — the addon is already there, which is why it is stale. Two
 * rows in `error_remedies.gd` said exactly that from the day the table shipped:
 * 254's rule joined every backticked TOOL NAME in a remedy to the live registry,
 * and nobody joined `init` to what `init` does.
 *
 * 🔴 AND IT SAYS RESTART. Godot reads the enabled-plugin list and the addon
 * scripts at project load, so overwriting the files changes nothing in a session
 * that is already open — a remedy stopping at `--force` sends a user to a command
 * that appears not to have worked.
 */
export const ADDON_SKEW_HINT =
  "Run 'breakpoint-mcp init --force' to overwrite it with the addon this host ships, then close and reopen the project in Godot. Plain 'init' skips an addon that is already installed, which is why the old one persisted.";

/**
 * The `version="…"` line of a `plugin.cfg`, or null if the file or the key is
 * unreadable.
 *
 * Null and not `"unknown"`: a caller comparing two versions must be able to tell
 * *I could not read this* from *this is a version that happens to differ*, and a
 * sentinel string collapses those into a false skew report.
 */
export function readAddonVersion(addonDir: string): string | null {
  try {
    const text = fs.readFileSync(path.join(addonDir, "plugin.cfg"), "utf8");
    const m = /^\s*version\s*=\s*"([^"]*)"/m.exec(text);
    return m && m[1] !== "" ? m[1] : null;
  } catch {
    return null;
  }
}

/** The addon installed in `projectPath`, or null if there isn't one. */
export function installedAddonVersion(projectPath: string): string | null {
  return readAddonVersion(path.join(projectPath, ADDON_REL));
}

/** How an installed (or running) addon relates to the one this host ships. */
export type AddonSkew = "same" | "older" | "newer" | "unknown";

/**
 * Compare two addon versions the way a user would need them compared.
 *
 * Dotted numeric segments, compared left to right, missing segments read as 0 —
 * enough for a `MAJOR.MINOR.PATCH` line that has never carried a pre-release
 * suffix. Anything that does not parse as digits is `"unknown"` rather than a
 * guess: 254's rule is that a remedy is an instruction somebody will execute, and
 * *your addon is older* is an instruction. Being wrong about the direction sends
 * a user to overwrite a newer addon with an older one.
 */
export function compareAddonVersions(installed: string | null, bundled: string | null): AddonSkew {
  if (installed === null || bundled === null) return "unknown";
  const parse = (v: string): number[] | null => {
    const parts = v.split(".");
    const out: number[] = [];
    for (const p of parts) {
      if (!/^\d+$/.test(p)) return null;
      out.push(Number(p));
    }
    return out.length > 0 ? out : null;
  };
  const a = parse(installed);
  const b = parse(bundled);
  if (a === null || b === null) return "unknown";
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return "older";
    if (x > y) return "newer";
  }
  return "same";
}
