# Contributing to Breakpoint MCP

Thank you for your interest in improving Breakpoint MCP! Contributions of every
kind are welcome — bug reports, documentation fixes, new tools, test coverage,
or just questions that help us make things clearer. This guide explains how the
project is laid out and how to get a change from your machine into a pull
request with confidence.

Breakpoint MCP is a [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes the Godot game engine to Claude. It currently ships **276
tools** across the editor, runtime, and language/debug surfaces. The codebase is
released under the [MIT License](LICENSE); by contributing you agree that your
work is offered under the same terms.

## Code of Conduct

This project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By taking
part you agree to help keep the community welcoming and respectful. Please give
it a read before you jump in.

## Prerequisites

- **Node.js ≥ 18** (CI exercises Node 18, 20, and 22).
- **Godot 4.2+** (4.4+ recommended) if you want to run the addon or the
  live-editor checks. Many changes can be built and unit-tested without Godot at
  all.
- **Python 3** to run the static contract check.

## Repository layout

| Path | What lives here |
| --- | --- |
| `host/` | The TypeScript MCP host — the server, tool definitions (`host/src/tools/`), schemas, and the unit/integration test suite (`host/test/`). |
| `addons/breakpoint_mcp/` | The GDScript editor/runtime addon that runs inside Godot (`operations.gd`, `runtime_bridge.gd`, and friends). |
| `example/addons/breakpoint_mcp/` | A **byte-identical mirror** of the addon, bundled with the example project so it can be enabled and driven directly. This copy must always match `addons/breakpoint_mcp/` exactly. |
| `docs/` | Documentation, including `docs/TOOL_CATALOG.md` (the authoritative tool catalog) and `docs/RUNBOOK.md` (the interactive per-plane validation steps). |
| `scripts/` | Helper scripts: `contract_check.py` (static parity check) and `validate.sh` (a smoke/setup helper). |

## Setting up and building

All host work happens inside `host/`:

```bash
cd host
npm ci          # reproducible install against the pinned lockfile
npm run build   # tsc -> host/dist
npm run typecheck
npm test        # compiles the suite and runs it with node --test
```

`npm test` compiles the test project and runs the unit and loopback-socket
integration tests through Node's built-in test runner — no Godot editor
required. If all four steps pass locally, you have run the same core checks CI
runs on every push.

### The static contract check

From the repository root:

```bash
python3 scripts/contract_check.py
```

This verifies, without launching Godot or Node, that the three layers agree:

- every bridge method the host calls has a GDScript handler,
- every registered MCP tool name is unique,
- the tool catalog (`docs/TOOL_CATALOG.md`) lists exactly the registered tools, and
- every fenced JSON block in the catalog is valid JSON.

Keeping this green is a hard requirement for any change that touches tools,
bridge methods, or the catalog. See "Adding or changing tools" below.

### Checks that need a real Godot editor

Some behavior can only be validated against a live engine — the addon's editor
and runtime bridges, the built-in LSP and DAP surfaces, and the authoring
mutators. These run as separate integration jobs in CI against real Godot
builds, and are documented for local use in `docs/RUNBOOK.md` (with
`scripts/validate.sh` automating the non-interactive setup). You do **not** need
to run these to open a pull request — but if your change touches the addon or a
plane that only a live engine exercises, please describe how you tested it.

## Coding conventions

Match the style that is already in the files you touch:

- **TypeScript (`host/`):** strict TypeScript. The build (`npm run build`) and
  `npm run typecheck` must pass with zero errors. Prefer explicit types on tool
  boundaries and keep tool output covered by the frozen schemas in
  `host/src/schemas.ts`.
- **GDScript (`addons/`):** `snake_case` for functions and variables, following
  the existing dispatch structure in `operations.gd` and `runtime_bridge.gd`.
- Keep new code consistent with its neighbors rather than introducing a new
  style in one file.

## Adding or changing tools

New and changed tools must keep **host ↔ addon ↔ catalog parity** green. In
practice that means:

1. Register the tool in the appropriate file under `host/src/tools/`.
2. Add or update its GDScript bridge handler in `operations.gd` (editor) or
   `runtime_bridge.gd` (runtime) as needed — and mirror it into
   `example/addons/breakpoint_mcp/` (see below).
3. Add the tool's frozen `outputSchema` entry in `host/src/schemas.ts`.
4. **Annotate it in `host/src/annotations.ts`.** Every registered tool must
   appear on `ALL_ANNOTATED`, plus whichever of `READ_ONLY` / `DESTRUCTIVE` /
   `IDEMPOTENT` / `OPEN_WORLD` apply. This is a hard gate, not a nicety — an
   unannotated tool fails the check outright.
5. Document it in `docs/TOOL_CATALOG.md` — **both** the index row and a detail
   block with `Input` and `Output` shapes. A tool the catalog parser cannot read
   drops out of shape parity silently, so the gate asserts every tool is
   compared or explicitly exempt.
6. **Re-stamp the counts.** Adding a tool moves the full / secure-default totals
   and the toolset-subset arithmetic, and they are claimed in *many* places:
   `README.md`, `docs/USER_GUIDE.md`, `docs/TOOL_CATALOG.md`, several
   `host/src/` prose comments, the `timeout-caveat.ts` annotation-class sizes,
   and around half a dozen host-test constants. **Do not try to find them by
   hand and do not global-sed a number** — some claims wrap across a line break
   (`the full\n * 291-tool surface`), and some numbers in the docs are
   *historical* and must not move. Run the contract check and fix exactly the
   sites it names, one pass at a time, until it is green.
7. Add unit tests under `host/test/`, and cover live behavior with an
   integration probe where the change can only be exercised against a real
   editor. If you add probe assertions, update the `AUTH_SUMMARY pass=N/N`
   claims in `.github/workflows/integration.yml` (two sites).
8. Run `python3 scripts/contract_check.py` and make sure it reports all hard
   checks passing. Check `$?` directly — **do not pipe it through `tail`**, or
   you will read `tail`'s exit code instead of the gate's.

### Keep the addon copies byte-identical

If you edit anything under `addons/breakpoint_mcp/`, apply the **exact same
change** to `example/addons/breakpoint_mcp/` so the two copies stay
byte-identical. The addon's behavior is validated by the live integration jobs
rather than by unit tests, so this parity matters.

### `.uid` sidecars: committed inside the projects, never in the distributable

Godot 4.4+ mints a `.uid` file next to every script it imports. The contract
check gates where those may live, and the rule differs by directory *on purpose*:

| If you add a `.gd` under… | Do this | Gate |
|---|---|---|
| `example/` or `example-csharp/` | open or `--import` the project once and **commit the generated `.uid` alongside the script** | check 18 |
| `addons/breakpoint_mcp/` | **do not commit a `.uid`** — delete it if the editor made one | check 19 |

The two rules point opposite ways because the directories are different kinds of
thing. `example/` and `example-csharp/` are real projects that CI opens, so a
missing sidecar gets minted on every boot and sits in `git status` forever
looking like uncommitted work. `addons/breakpoint_mcp/` is the **distributable** —
copied verbatim into the npm package and the Asset Library zip — so a committed
sidecar would pin one uid onto every install worldwide. It buys nothing (the
addon has no `uid://` references of its own) and costs a
`WARNING: UID duplicate detected` for anyone who ends up with two copies in one
project.

If a boot leaves `example/project.godot` modified, that one autoload line is a
known and accepted rewrite — `git checkout -- example/project.godot`. Check
`git status` before `git add -A` after running anything against a real editor.

## Proposing a change

1. **Fork** the repository and create a topic branch off `main` (for example,
   `fix/runtime-log-coalesce` or `tool/mp-add-relay`).
2. Keep pull requests **focused** — one logical change per PR is much easier to
   review than a large mixed bag.
3. **Update the changelog.** Add an entry under the `## [Unreleased]` section of
   `CHANGELOG.md` describing what changed and why.
4. **Do not bump version stamps in a feature PR.** Feature and fix PRs leave the
   version numbers (in `host/package.json`, `addons/breakpoint_mcp/plugin.cfg`,
   and elsewhere) unchanged; a maintainer re-stamps them when a release is cut.

   Two versions ship from this repository and they move on **different cadences**.
   The host version moves at every cut. The **addon** version in
   `addons/breakpoint_mcp/plugin.cfg` moves only when the addon itself changes —
   so a release that touches no GDScript leaves it alone, on purpose.

   **An addon re-stamp is always carried by a host cut.** That is not a convention;
   it is what the artifact makes true, and it was measured rather than assumed. The
   addon ships *inside* the npm package — `host/package.json` lists `addon/**/*` in
   `files`, `prepublishOnly` runs `stage-addon`, and `host/scripts/stage-addon.mjs`
   copies `addons/breakpoint_mcp/` into the package verbatim. Confirmed against the
   registry: the published `breakpoint-mcp@1.73.2` tarball carries
   `version="1.9.8"` in its own `plugin.cfg`.

   So every addon change is a change to the published artifact, and the only name
   npm has for that artifact is the **host** version. Two things follow, and they
   point opposite ways:

   - Re-stamping the addon *without* a host bump, on a tree whose host version is
     already published, puts two different addons under one npm name.
   - Leaving the host version alone means the addon change never reaches npm users
     at all.

   The **Asset Library** is the half that genuinely has its own cadence: it serves
   whatever commit a submission named, so re-stamping does not change what already
   installed users have until a new submission names a new commit.

   That difference is why `scripts/release_names.py --assert-addon` exists.
   `scripts/contract_check.py` asserts that every *copy* of the addon version
   agrees with the canonical `plugin.cfg`; it has nothing to say about whether the
   version **moved when the addon did**. Check 4 asks that question, and the
   release ritual refuses a cut whose addon version has stopped naming the addon's
   tree. If your PR changes anything under `addons/breakpoint_mcp/`, expect the
   next cut to re-stamp that version — flag it in the PR description so the
   maintainer does not have to rediscover it.

   Check 4 reads the tree. **Check 5 reads the artifact** —
   `scripts/registry_bytes.py` compares the addon *inside the published tarball*
   against the addon at the commit that version was cut from. It is the only reader
   that opens what users installed and the commit they installed it under, and it
   runs after `npm publish` and before `git tag`.
5. Make sure the core checks pass locally: `npm run build`, `npm run typecheck`,
   `npm test`, and `python3 scripts/contract_check.py`.
6. Open the pull request using the provided template, fill in the checklist, and
   describe how you tested — especially any live-Godot verification.

## Reporting bugs and requesting features

Please use the issue templates:

- **Bug report** — include your OS, Godot version, Node version, Breakpoint MCP
  version, the plane/tool involved, clear repro steps, expected vs. actual
  behavior, and any relevant logs.
- **Feature request** — describe the problem you are trying to solve, the tool
  or behavior you have in mind, and any alternatives you considered.

## Questions

If you are unsure where to start or how something is meant to work, open an
issue or start a discussion. We would rather answer a question early than have
you stuck. Thanks again for helping make Breakpoint MCP better!
