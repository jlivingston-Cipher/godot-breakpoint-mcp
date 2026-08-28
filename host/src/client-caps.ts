/**
 * Client tool-count caps — the numbers that decide whether this server loads at
 * all, transcribed from the clients that enforce them.
 *
 * 🔴 WHY A MODULE AND NOT A PARAGRAPH. A client that caps its tool list does not
 * degrade when the cap is exceeded: it refuses the whole server, before any code
 * here runs. Google's Antigravity answers `enabled tools would exceed max limit
 * of 100` and loads nothing; VS Code blocks agent mode at 128 across every server
 * a session has enabled. Breakpoint's default surface is roughly three times the
 * smallest of those, so on those clients it does not appear, does not warn, and
 * prints nothing a user could search for. `BREAKPOINT_TOOLSETS` has been the
 * remedy since 214 — the failure is that nobody who hits the wall can find it,
 * because the wall names a limit rather than a remedy.
 *
 * 🔴 THESE ARE SOMEBODY ELSE'S NUMBERS AND THIS FILE SAYS SO. Nothing in this
 * repository derives them; each row carries the issue it was read from and the
 * date it was read, so a reader can re-check the claim at its source rather than
 * trusting a figure that has been copied forward. What this tree DOES own is the
 * relation between them and our own surface: `client_caps.test.ts` measures every
 * preset published in `README.md` against `SMALLEST_CLIENT_CAP` and reddens when a
 * new tool pushes one over — the documentation cannot go quietly false as the
 * surface grows, which is the whole reason a published preset is worth publishing.
 */

/** One client's hard limit on the length of a server's tool list. */
export interface ClientToolCap {
  /** The client, spelled the way its own documentation spells it. */
  client: string;
  /** The largest tool list it will accept. */
  limit: number;
  /** What the user sees when the limit is exceeded — the string they will search for. */
  symptom: string;
  /** Where the limit was read, and when. */
  source: string;
}

/**
 * Ordered smallest cap first, because the smallest is the one a preset has to fit.
 *
 * 🔵 GEMINI CLI IS DELIBERATELY ABSENT. Its own limit is under an open request to
 * raise it (google-gemini/gemini-cli #21823) and a number that is being argued
 * about is not a number to publish a preset against; the two rows below are
 * enforced today and their error text is quotable.
 */
export const CLIENT_TOOL_CAPS: readonly ClientToolCap[] = [
  {
    client: "Google Antigravity",
    limit: 100,
    symptom: "enabled tools would exceed max limit of 100",
    source: "google-gemini/gemini-cli issue #26678, filed 2026-05-07 — read 2026-08-27",
  },
  {
    client: "VS Code (agent mode)",
    limit: 128,
    symptom: "agent mode is blocked once the tools enabled across all servers exceed 128",
    source: "microsoft/vscode issue #290356 — read 2026-08-27",
  },
];

/**
 * The cap a preset has to fit under to fit everywhere.
 *
 * 🔴 DERIVED, NEVER TYPED. A second literal saying 100 is a second thing to
 * update, and the one that goes stale is always the one no reader compares.
 */
export const SMALLEST_CLIENT_CAP: number = Math.min(...CLIENT_TOOL_CAPS.map((c) => c.limit));

/**
 * The presets `README.md` publishes as fitting under every cap above, by the
 * `BREAKPOINT_TOOLSETS` value that selects each one.
 *
 * 🔴 THIS LIST IS THE PIN'S POPULATION, WHICH IS WHY IT IS HERE AND NOT IN THE
 * TEST. A guard whose population lives beside the guard is a guard over the cases
 * somebody remembered; this list is what the documentation actually offers, so
 * publishing a preset and pinning it are the same act. `client_caps.test.ts`
 * resolves each value through `selectToolsets`, counts the tools it registers, and
 * refuses a count over `SMALLEST_CLIENT_CAP` — so a tool added to `lsp`, `dap`,
 * `cli` or `runtime` reddens here rather than in a user's editor.
 */
export const PUBLISHED_FITTING_PRESETS: readonly string[] = ["d", "b,c,d"];

/** The startup line's advice clause, spelled once so the log and the docs agree. */
export function capAdvice(registered: number): string {
  if (registered <= SMALLEST_CLIENT_CAP) return "";
  const names = CLIENT_TOOL_CAPS.map((c) => `${c.client} ${c.limit}`).join(", ");
  return (
    ` · over some clients' tool-list caps (${names}) — if your client refuses to load this ` +
    `server, set BREAKPOINT_TOOLSETS (see "Tool limits" in README.md; ` +
    `BREAKPOINT_TOOLSETS=${PUBLISHED_FITTING_PRESETS[0]} fits every cap above)`
  );
}
