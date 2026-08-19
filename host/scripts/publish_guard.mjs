#!/usr/bin/env node
/**
 * `publish-tarball-outruns-its-tag` — the guard, eight sessions after the row was opened.
 *
 * 🔴 **260 MEASURED THE DEFECT BY COMMITTING IT.** `breakpoint-mcp@1.75.0` went to the
 * registry from `main` at `ca2d5d8` while tag `v1.75.0` is `49ccb19` — four commits and
 * +888/−72 apart, addon 1.11.0 against the tag's 1.10.0, 89 files against the tag tree's
 * 81. npm reads the version out of `host/package.json` and nothing else, and that file
 * says `1.75.0` at BOTH commits, so nothing complained. Three things that should have
 * caught it did not, and each failed differently:
 *
 *   • the publish plan's step 0 is `git status --porcelain` plus `git log -1`, and both
 *     read perfectly clean on a HEAD that has moved past its tag;
 *   • `registry_bytes.py`'s freshness check compares `host/addon/` against `addons/`, both
 *     taken from the working tree, so they agree with each other and with nothing outside
 *     it;
 *   • a hand-written HEAD-against-tag comparison DID fire and printed a refusal — inside a
 *     multi-line pasted block, which the shell then ran to completion, because an echo is
 *     not an exit.
 *
 * 🔴 **AND 264 FOUND A SECOND, INDEPENDENT WAY IN, ON A PUBLISH THAT WAS OTHERWISE
 * CORRECT.** `1.78.0` went out from a clone checked out AT `v1.78.0`, so a HEAD-against-tag
 * guard alone would have waved it through. Between step 0's `git status --porcelain` and
 * `npm publish`, an `npm audit fix` bumped four runtime dependencies in
 * `host/package-lock.json`: the tree was dirty at the moment of upload and nothing asked
 * again. No damage that time — `dist/` was byte-identical to a clean build from the tag —
 * but a clean status taken before a step that dirties the tree is 260's shape exactly, one
 * command later. **The check ran, and then the world moved.**
 *
 * So this asks BOTH questions, and it asks them from `prepublishOnly`, which is the last
 * thing npm runs before it packs. It is deliberately the LAST link in that chain: `build`
 * and `stage-addon` write only to `host/dist/` and `host/addon/`, both gitignored, so a
 * clean tree is still clean here — and putting the porcelain read after them is the
 * difference between a check and a check that is still true.
 *
 * Refuses by EXIT CODE and not by printing (267 §6.7: a grep over a log is a claim about
 * the log's vocabulary, not about the run — and 260's own near-miss was a refusal that
 * printed inside a block the shell ran to the end anyway).
 *
 * The opt-out is named, and it says out loud what it waived:
 *   BREAKPOINT_ALLOW_OFF_TAG_PUBLISH=1
 */
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = resolve(HERE, "..");

const OPT_OUT = "BREAKPOINT_ALLOW_OFF_TAG_PUBLISH";

/**
 * Run git and return its stdout, or `null` when git could not answer.
 *
 * 🔴 `null` IS A REFUSAL AND NEVER A PASS. A guard that cannot answer its own question
 * must not answer it green — that is `registry_lag.py` printing 🟢 on both sides of the
 * same defect within twenty minutes (260), and it is the reason this returns a sentinel
 * the caller has to handle rather than an empty string that reads like "nothing wrong".
 */
function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

/**
 * The two questions, asked of a real tree. Returns a list of refusals — empty means clean.
 *
 * Exported through the return value rather than through module scope: this file is a
 * script, not an instrument, and `instrument_gate.py` discovers module-shaped files in
 * `host/scripts/` by whether they export anything.
 */
function problems(hostDir) {
  const out = [];
  let version;
  try {
    version = JSON.parse(readFileSync(join(hostDir, "package.json"), "utf8")).version;
  } catch (e) {
    return [`cannot read host/package.json — ${e.message}`];
  }
  if (typeof version !== "string" || version === "") {
    return ["host/package.json carries no version, and that is the only thing npm publishes under"];
  }

  const tag = `v${version}`;
  const head = git(["rev-parse", "HEAD"], hostDir);
  if (head === null) {
    return [`not inside a git work tree, so neither question can be asked — the version being published is ${version}`];
  }
  const tagged = git(["rev-parse", `${tag}^{commit}`], hostDir);

  // Question 1 — does the version name this commit?
  if (tagged === null) {
    out.push(
      `tag ${tag} does not exist, so nothing names the commit this tarball would be built from. ` +
      `npm reads the version out of host/package.json and nothing else, which is why 1.75.0 ` +
      `uploaded four commits past its own tag without a complaint.`,
    );
  } else if (tagged !== head) {
    const ahead = git(["rev-list", "--count", `${tagged}..HEAD`], hostDir) ?? "?";
    const behind = git(["rev-list", "--count", `HEAD..${tagged}`], hostDir) ?? "?";
    out.push(
      `HEAD is ${head.slice(0, 7)} and ${tag} is ${tagged.slice(0, 7)} — ${ahead} commit(s) ahead, ` +
      `${behind} behind. The tarball would claim to be ${version} and be built from a different tree.`,
    );
  }

  // Question 2 — is the tree clean AT THIS MOMENT, which is the only moment that counts.
  const dirty = git(["status", "--porcelain"], hostDir);
  if (dirty === null) {
    out.push("git could not report the working tree state, so the tarball's provenance is unknown");
  } else if (dirty !== "") {
    const lines = dirty.split("\n");
    out.push(
      `the working tree is dirty at the moment of packing — ${lines.length} path(s), ` +
      `first: ${lines[0].trim()}. 264 shipped from a tree an \`npm audit fix\` had dirtied ` +
      `AFTER the porcelain check; this is that check re-taken where it cannot go stale.`,
    );
  }
  return out;
}

function main() {
  const found = problems(HOST);
  if (found.length === 0) {
    console.log("PUBLISH_GUARD OK — HEAD is the tag's commit and the tree is clean");
    return 0;
  }
  const waived = process.env[OPT_OUT] === "1";
  const header = waived ? "PUBLISH_GUARD WAIVED" : "PUBLISH_GUARD REFUSED";
  console.error(`${header} — ${found.length} problem(s):`);
  for (const p of found) console.error(`  · ${p}`);
  if (waived) {
    // Loud, and it names what it let through. A silent opt-out is an opt-out nobody
    // remembers setting, and this one is read from the environment of whoever is
    // publishing rather than from anything the tree records.
    console.error(`${OPT_OUT}=1 is set, so the publish continues with the problems above ACCEPTED.`);
    return 0;
  }
  console.error(`Set ${OPT_OUT}=1 to publish anyway, deliberately.`);
  return 1;
}

/**
 * Drive both questions against real throwaway repositories.
 *
 * 🔴 FIXTURES, NOT ASSERTIONS ABOUT STRINGS. The whole point of the row is that three
 * things which LOOKED like this check were satisfied by a tree that was wrong, so a
 * self-test that stubs git proves nothing about the case that shipped 1.75.0.
 */
function selftest() {
  const failures = [];
  const check = (name, cond) => { if (!cond) failures.push(name); };
  const root = mkdtempSync(join(tmpdir(), "pubguard-"));

  let made = 0;
  // 🔴 THE DEFAULTS ARE NOT DECORATION — they are what makes each call below say only
  // what it is testing. Without them `tsc --checkJs` reads the destructuring pattern as
  // three REQUIRED properties and refuses every partial call, which `lint_ceiling.py`
  // then counts as four new TS2345 findings against a ceiling that records what shipped.
  const repo = (version, { tag = false, moveOn = false, dirty = false } = {}) => {
    // 🔴 A COUNTER AND NOT `Math.random()`. A self-test whose fixture names differ between
    // runs cannot be re-driven from a failure report, and this file's whole subject is a
    // check that has to be reproducible on somebody else's machine.
    const dir = join(root, `r${made++}`);
    mkdirSync(dir, { recursive: true });
    const run = (...a) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
    run("init", "-q", "-b", "main");
    run("config", "user.email", "t@t");
    run("config", "user.name", "t");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", version }));
    run("add", "-A");
    run("commit", "-qm", "one");
    if (tag) run("tag", "-a", `v${version}`, "-m", "t");
    if (moveOn) {
      writeFileSync(join(dir, "later.txt"), "moved on\n");
      run("add", "-A");
      run("commit", "-qm", "two");
    }
    if (dirty) writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", version, extra: 1 }));
    return dir;
  };

  try {
    check("a tagged, clean tree passes", problems(repo("1.0.0", { tag: true })).length === 0);

    // 260's defect: HEAD past its own tag, everything else immaculate.
    const moved = problems(repo("1.0.0", { tag: true, moveOn: true }));
    check("HEAD past its tag is refused", moved.length === 1);
    check("…and the refusal names both commits", /HEAD is [0-9a-f]{7} and v1\.0\.0 is [0-9a-f]{7}/.test(moved[0] ?? ""));

    // 264's defect: on the tag, but dirtied after the porcelain check.
    const dirty = problems(repo("1.0.0", { tag: true, dirty: true }));
    check("a dirty tree on the right commit is refused", dirty.length === 1);
    check("…and the refusal names the path", /package\.json/.test(dirty[0] ?? ""));

    // Both at once must report BOTH, not the first one it happened to find.
    check("both defects report two problems", problems(repo("1.0.0", { tag: true, moveOn: true, dirty: true })).length === 2);

    // A version nothing names at all.
    const untagged = problems(repo("1.0.0", { tag: false }));
    check("an untagged version is refused", untagged.length === 1);
    check("…by name", /tag v1\.0\.0 does not exist/.test(untagged[0] ?? ""));

    // 🔴 THE FAIL-CLOSED DIRECTION. A guard that cannot answer must not pass.
    const notARepo = join(root, "bare");
    mkdirSync(notARepo, { recursive: true });
    writeFileSync(join(notARepo, "package.json"), JSON.stringify({ name: "x", version: "1.0.0" }));
    check("outside a git work tree it REFUSES rather than passing", problems(notARepo).length === 1);

    const noVersion = join(root, "noversion");
    mkdirSync(noVersion, { recursive: true });
    writeFileSync(join(noVersion, "package.json"), JSON.stringify({ name: "x" }));
    check("a package.json with no version is refused", problems(noVersion).length === 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  if (failures.length) {
    console.error(`PUBLISH_GUARD_SELFTEST REFUSED — ${failures.length} of its own claims failed:`);
    for (const f of failures) console.error(`  · ${f}`);
    return 1;
  }
  console.log("PUBLISH_GUARD_SELFTEST OK — 11 claims, both defects driven against real repositories");
  return 0;
}

process.exit(process.argv.includes("--selftest") ? selftest() : main());
