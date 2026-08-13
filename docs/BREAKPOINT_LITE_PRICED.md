# Breakpoint Lite — priced, not decided

> **Session 242.** Queue row `breakpoint-lite`, opened 226, deferred fifteen sessions,
> scheduled 242. 241 §6 asked for a steer before anything was built and got one: **price
> it, do not build it.** This document is the price. It takes no decision and recommends
> no build; it exists so that the next session electing this row is electing a shape with
> a number on it, and so that a session electing NOT to build it is refusing something
> specific.
>
> 🔴 **THIS DOCUMENT IS TRACKED, FOR 238 §2's REASON.** `.gitignore` carries `HANDOFF*.md`,
> so a price that lives only in a handoff is unreadable in CI and in a fresh clone. Every
> number below is either measured from this tree at `1.74.0` / addon `1.9.9` and
> reproducible by the command named beside it, or explicitly marked INHERITED.

---

## §1 — What the row actually asks, and the two questions inside it

"Breakpoint Lite, zero install" has been carried as one phrase since 226. Measured
against the tree, it is two questions that have different answers:

1. **Is the install too long?** — a question about the first-run path.
2. **Could the product work without the Godot editor?** — a question about the surface.

They have been travelling together because "zero install" sounds like it answers both. It
does not. §2 prices the first and §3 prices the second, and the finding is that **the
first is nearly spent and the second is structural.**

---

## §2 — The first-run path, measured

Reproduce: read `README.md` §Quick start, `host/src/cli/init.ts`, `host/src/cli/doctor.ts`.

**Quick start, from zero to a breakpoint: eight steps.**

| # | step | class | automatable? |
|---|---|---|---|
| 1 | Install Node ≥ 18 | software install | no |
| 2 | Install Godot 4.2+ (4.4+ recommended) | software install | no |
| 3 | `cd` to the Godot project | — | — |
| 4 | `npx breakpoint-mcp init` | one command; installs the addon, enables it in `project.godot`, writes the client config | **already automated** |
| 5 | Open the project in the Godot editor | GUI launch | no |
| 6 | Register with the MCP client | `init --client <id>` merges it | **already automated** |
| 7 | Restart or refresh the MCP client | app restart | no |
| 8 | `npx breakpoint-mcp doctor --require-live` | one command | **already automated** |

**The manual path is twelve actions**, including a Project → Project Settings → Plugins
toggle and two absolute paths typed into a JSON file.

🔴 **THE ONBOARDING BUDGET IS LARGELY ALREADY SPENT, AND THAT IS THE FINDING.** Measured:
`host/src/cli/init.ts` is 328 lines, `host/src/cli/doctor.ts` is 417, the in-editor status
dock is 393, and `breakpoint_doctor` exposes the same eleven checks as an MCP tool so an
assistant can look when the user cannot. That is roughly **1,138 lines of onboarding
already shipped**, against an install whose remaining friction is *steps 1, 2, 5 and 7* —
two software installs, a GUI launch and a client restart. **None of the four is
automatable by anything this project can ship**, because each is an action in somebody
else's process.

🟢 **AND THE PARTS THAT COULD HAVE BEEN BAD ARE NOT.** No `postinstall`, no `prepare`, no
`prepack`: the npm package is inert until `init` is run. Two runtime dependencies. 253 kB
packed. **No user ever types a token** — the addon mints a per-project secret into
`res://.godot/` and the host reads the same file, so authentication is zero-configuration
in both directions.

🔴 **ONE UNDOCUMENTED TRAP, FOUND WHILE PRICING.** `init` writes `[editor_plugins]` into
`project.godot`; Godot does not hot-reload that file, so running `init` against an
already-open editor silently leaves the plugin disabled. Nothing in `README.md` or
`docs/USER_GUIDE.md` says to reopen the project. **This is a one-line documentation fix and
it is worth more per word than anything else in this document.**

---

## §3 — The surface, measured, and the structural blocker

Reproduce: `cd host && node dist/index.js tools --json --surface full`.

**292 tools** (279 in the secure default, 13 privileged and off by default). By what each
one needs to be alive:

| requirement | tools | share |
|---|---:|---:|
| a **live Godot editor** — the addon bridge on 9080, or Godot's built-in LSP/DAP on 6005/6006 | **216** | 74% |
| a **running game** — the autoload bridge on 9081, editor not required | 27 | 9% |
| **neither** — host-side or a child process | 49 | 17% |

The 49 that need no Godot editor are `vcs` (12), `knowledge` (4), `processes` (3), `cli`
(7), `cslsp` (10) and `csdap` (13). Strip the two C# planes, which spawn OmniSharp and
netcodebg over stdio and are their own install story, and **19 tools need nothing but Node
and a project folder.**

🔴 **AND THE DEBUGGER IS NOT AMONG THEM, WHICH IS THE WHOLE PROBLEM.** The fifteen `dbg_*`
tools ride Godot's built-in Debug Adapter on port 6006. That adapter **exists only while
the editor is open**. `README.md` leads with the debugger — it is the differentiator and
the product's name — so:

> **A zero-install Breakpoint cannot set a breakpoint.**

That sentence is the price of this row, and it did not need a build to find. Any "Lite"
variant is a *different product with the same name*: nineteen tools of version control,
code search and process management, none of which is why anybody would install a Godot MCP.

---

## §4 — The four things "zero install" could mean, each priced

| # | reading | what it removes | what it costs | what it buys |
|---|---|---|---|---|
| **A** | **`npx` with no addon** — run the host, get the 19 no-Godot tools | steps 4–7 | ~0. It already works: `npx -y breakpoint-mcp` with no project is a valid MCP server today | nothing anybody wants. Ships the product without its subject |
| **B** | **Addon auto-install on first tool call** — the host writes the addon and enables it when a tool needs it | step 4 | small: the code exists in `host/src/cli/init.ts`, needs a call site and a confirmation gate | **half a step**, and it makes an editor restart mandatory rather than merely likely. Net worse |
| **C** | **A one-file addon** — collapse the eight `.gd` files into a single script a user pastes | step 4's file copy | large. `addons/breakpoint_mcp/operations.gd` is 4,849 lines of the 6,901; a paste target is not a maintainable source | a shorter README and an unmaintainable second copy |
| **D** | **Godot Asset Library listing** — the addon installs from inside the editor | the copy, the enable toggle, and one context switch | **submission and review, plus a release step per version.** The addon already has `plugin.cfg`, `icon.png` and a LICENSE; the packaging work is small and the process work is recurring | 🟢 **the only one that reaches users who are not already at a terminal**, and the only one that produces a number this project has never had |

🔴 **A, B AND C ARE ALL PRICED AT LESS THAN A SESSION AND ALL BUY LESS THAN NOTHING.**
D is the only reading of this row that touches the actual constraint, and D is **not a
"Lite" variant at all** — it is a distribution channel for the product that already exists.

---

## §5 — The premise this row rests on, and what would falsify it

The row exists because nobody has measured whether a first-time user reaches a breakpoint.
That is still true. What can be said:

* **INHERITED from 241** (the registry endpoint is not reachable from the build container;
  not re-measured here): **3,667 downloads in thirty days, 908 in seven, zero open issues,
  zero open PRs, zero external signal of any kind.**
* **Measured here:** sixteen merged PRs have changed zero files under `host/src/` or
  `addons/`. The product has not moved in sixteen merges; the instruments have.

🔴 **THE PREMISE IS THAT INSTALL FRICTION IS WHAT SEPARATES 3,667 DOWNLOADS FROM ZERO
FEEDBACK, AND NOTHING IN THIS TREE SUPPORTS IT.** Two other readings fit the same data
exactly as well:

1. **The downloads are not people.** A package with zero issues and zero PRs at that volume
   is consistent with mirrors, scanners and CI caches. Nobody has checked.
2. **The install works and the product is not wanted.** 74% of the surface requires a live
   editor and a live editor requires a human already deep in Godot — a much smaller
   population than "people who install MCP servers".

**Both are cheaper to test than any build in §4.** Reading 1 is answerable by the registry's
own per-version and per-day series. Reading 2 is answerable by shipping D and watching
whether an in-editor channel converts better than a terminal one.

---

## §6 — What a session electing this row should elect

Not a recommendation — the steer belongs to the same place the last one did. What the
measurement supports:

1. 🟢 **The `project.godot` reopen trap** (§2). One line of `README.md`. Do it in whatever
   session touches the docs next, regardless of this row.
2. 🟡 **Ask what the downloads are before building anything for the people making them.**
   Cheap, bounded, and it decides whether §5's premise survives.
3. 🟡 **D, on its merits as distribution**, not as "Lite". It is the only option that
   reaches a user who is not already at a terminal, and it is the only one whose cost is
   mostly recurring rather than upfront.
4. 🔴 **KILL "Breakpoint Lite" AS A PRODUCT SHAPE.** A, B and C are the three ways to build
   it and each of them ships a Godot debugger that cannot debug. If the row survives, it
   should survive under a name that says what it is — and the queue is the place where that
   decision goes, with a reason, whichever way it lands.
