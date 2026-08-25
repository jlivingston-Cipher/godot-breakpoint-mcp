import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePrivilegedGroups } from "../src/cli/init.js";
import { serverEntry } from "../src/cli/clients.js";
import { INIT_USAGE, TRUST_LEVELS, TRUST_ALIASES } from "../src/cli/usage.js";
import { checkCapabilities } from "../src/cli/doctor.js";
import { loadConfig } from "../src/config.js";

/**
 * The guided-front-door pieces for capability groups: the init preset resolver,
 * the serverEntry env it produces, and the doctor capability-groups section.
 */

test("resolvePrivilegedGroups: safe default, --trust presets, explicit list, unknown token", () => {
  assert.deepEqual(resolvePrivilegedGroups({}), { value: "" });
  assert.deepEqual(resolvePrivilegedGroups({ trust: "safe" }), { value: "" });
  assert.deepEqual(resolvePrivilegedGroups({ trust: "full" }), { value: "code-execution" });
  assert.deepEqual(resolvePrivilegedGroups({ "privileged-groups": "code-execution" }), { value: "code-execution" });
  assert.deepEqual(resolvePrivilegedGroups({ "privileged-groups": "all" }), { value: "code-execution" });

  // `network` is no longer a group, so it warns exactly like a typo does.
  const bad = resolvePrivilegedGroups({ "privileged-groups": "code-execution, network, bogus" });
  assert.equal(bad.value, "code-execution");
  assert.match(bad.warn ?? "", /bogus/);
  assert.match(bad.warn ?? "", /network/);
});

test("EVERY --trust level the help documents is a level the parser accepts", () => {
  // 🔴 THE MEASURED DEFECT, AND IT WAS ON THE FLAG THAT SETS THE SECURITY POSTURE.
  // The published 1.82.1 documented `--trust <level>  secure | full` and its alias
  // map spelled the safe preset `safe`, with no `secure` key. So the value the
  // help names FIRST, and names as the default, fell through to the
  // `--privileged-groups` parser and printed *ignoring unknown trust group(s):
  // secure (valid: code-execution, all)* — the wrong next action, in a different
  // flag's vocabulary — and EXITED 0.
  //
  // The help line is rendered from `TRUST_LEVELS` now, so this reads the shipped
  // help text back and drives every token it offers. A documented value that the
  // parser rejects is not a test somebody has to remember to add.
  const line = INIT_USAGE.find((l) => l.includes("--trust"))!;
  const documented = line.split("--trust <level>")[1].split(".")[0].split("|").map((s) => s.trim());
  assert.deepEqual(documented.sort(), Object.keys(TRUST_LEVELS).sort(),
    "the help's own alternatives ARE the parser's keys");
  for (const level of documented) {
    const r = resolvePrivilegedGroups({ trust: level });
    assert.equal(r.error, undefined, `--trust ${level} is documented and must be accepted`);
    assert.equal(r.warn, undefined, `--trust ${level} must not warn`);
  }
  assert.deepEqual(resolvePrivilegedGroups({ trust: "secure" }), { value: "" });
  assert.deepEqual(resolvePrivilegedGroups({ trust: "SECURE" }), { value: "" }, "case-insensitive, as before");
});

test("an unknown --trust level is REFUSED in its own vocabulary, not another flag's", () => {
  const r = resolvePrivilegedGroups({ trust: "bogus" });
  assert.match(r.error ?? "", /unknown level "bogus"/);
  assert.match(r.error ?? "", /secure \| full/, "the valid TRUST levels, not the group names");
  assert.match(r.error ?? "", /--privileged-groups/, "and the other flag is offered, not conflated");
});

test("the undocumented back-compat spellings still work and are still undocumented", () => {
  // Removing them would break a working command line; documenting them would
  // offer four names for two states.
  for (const alias of Object.keys(TRUST_ALIASES)) {
    assert.equal(resolvePrivilegedGroups({ trust: alias }).error, undefined, `${alias} must still resolve`);
  }
  const line = INIT_USAGE.find((l) => l.includes("--trust"))!;
  for (const alias of Object.keys(TRUST_ALIASES)) {
    assert.equal(line.includes(` ${alias} `), false, `${alias} is a back-compat alias and must stay unadvertised`);
  }
});

test("serverEntry adds BREAKPOINT_PRIVILEGED_GROUPS only when opted in", () => {
  const safe = serverEntry("/proj", "godot", false) as { env: Record<string, string> };
  assert.equal(safe.env.BREAKPOINT_PRIVILEGED_GROUPS, undefined);
  const full = serverEntry("/proj", "godot", false, "code-execution") as { env: Record<string, string> };
  assert.equal(full.env.BREAKPOINT_PRIVILEGED_GROUPS, "code-execution");
});

test("doctor checkCapabilities reports the secure default (13 dropped) + how-to-enable hint", () => {
  const cfg = { ...loadConfig(), privilegedGroups: null };
  const main = checkCapabilities(cfg).find((c) => c.name === "capability-groups");
  assert.ok(main);
  assert.equal(main.severity, "info");
  assert.match(main.detail, /code-execution off/);
  assert.match(main.detail, /13 higher-trust tool/);
  assert.match(main.hint ?? "", /BREAKPOINT_PRIVILEGED_GROUPS/);
});

test("doctor checkCapabilities reports the full surface when the group is on", () => {
  const cfg = { ...loadConfig(), privilegedGroups: ["all"] };
  const main = checkCapabilities(cfg).find((c) => c.name === "capability-groups");
  assert.ok(main);
  assert.match(main.detail, /full 292-tool surface/);
  assert.equal(main.hint, undefined);
});

test("doctor flags a configured asset-gen backend unless code-execution is on", () => {
  const off = { ...loadConfig(), privilegedGroups: null, assetGenBackend: "command", assetGenCommand: "/bin/echo" };
  assert.ok(checkCapabilities(off).some((c) => c.name === "capability-assetgen"));

  // An unrecognized group token does NOT load the asset_gen_* tools — their only
  // privileged path is the local command backend (code-execution), so the hint
  // still fires. `network` is such a token now: it names no group at all.
  const net = { ...off, privilegedGroups: ["network"] };
  assert.ok(checkCapabilities(net).some((c) => c.name === "capability-assetgen"));

  const on = { ...off, privilegedGroups: ["code-execution"] };
  assert.ok(!checkCapabilities(on).some((c) => c.name === "capability-assetgen"));
});
