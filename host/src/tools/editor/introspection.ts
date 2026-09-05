import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BridgeClient } from "../../bridge.js";
import { fail, type EditorCall } from "./common.js";

/**
 * Smallest edge, in pixels, a captured editor viewport may have and still be a
 * frame rather than a placeholder.
 *
 * Godot does not tear down the main-screen tab you are not looking at — it
 * collapses that tab's SubViewport to its minimum size and keeps rendering it.
 * `get_texture().get_image()` therefore still succeeds, and the capture returns
 * a real, valid, **2x2** PNG: correct magic bytes, correct mime, an 81-byte
 * payload, and a note reading "Captured 2d viewport (2x2)". Every layer above
 * reports success, and an assistant then *looks at* four pixels and reasons
 * about the scene from them.
 *
 * Measured on Godot 4.7 (session 144), four editor boots, real Metal hardware:
 * with the Script or 3D tab active, `viewport=2d` returned 2x2/81B; with the 2D
 * tab active it returned 1297x492/3.6KB. A fresh editor with no saved layout —
 * the CI condition — boots on the **3D** tab, and opening a `Node2D` scene does
 * not switch it. So the degenerate case is the DEFAULT, not the exception.
 *
 * 8px is deliberately far below any real viewport and far above the collapsed
 * one: it separates the two populations without guessing at a "reasonable" size.
 *
 * Since 1.30.0 the refusal is RECOVERABLE rather than terminal: `main_screen_set`
 * switches the tab, so the error names the tab that is actually active and the
 * call that fixes it, and a caller can act on that instead of giving up. The
 * guard itself is unchanged — this threshold still decides what counts as a
 * frame; the tab tools only give the caller somewhere to go when it bites.
 */
const MIN_RENDERED_VIEWPORT_PX = 8;

/**
 * 🔴 261 — THE SIZE GUARD ABOVE FIRES ONCE PER EDITOR SESSION AND THEN NEVER AGAIN,
 * AND WHAT IT STOPS PROTECTING AGAINST IS WORSE THAN WHAT IT CATCHES.
 *
 * Measured at 261 on Godot 4.7, driving the published `breakpoint-mcp@1.76.0` as a
 * client against a live editor. Godot collapses a main-screen tab's viewport to 2x2
 * only while that tab has **never been activated**. Visit it once — which is step 5
 * of the User Guide's own scene-authoring recipe — and the viewport keeps its full
 * size for the rest of the session while it is hidden. It also stops updating:
 *
 *   tab 2D, capture 2d  -> 2214x1809  md5 4dcacd9ac2ce
 *   tab 3D, capture 2d  -> 2214x1809  md5 4dcacd9ac2ce   (same frame, now hidden)
 *   add a 900x700 magenta ColorRect to the scene, still on the 3D tab
 *   tab 3D, capture 2d  -> 2214x1809  md5 4dcacd9ac2ce   🔴 UNCHANGED — frozen
 *   tab 2D, capture 2d  -> 2214x1809  md5 b2075a8606e7   the rect is there
 *
 * So after the first tab switch every capture of the inactive viewport is a
 * SUCCESS carrying a stale frame, and `MIN_RENDERED_VIEWPORT_PX` cannot see it,
 * because the size is the one thing that did not change. An assistant reads that
 * image as the current scene and edits against a picture of the past.
 *
 * The size threshold is a proxy for a question the editor can answer directly —
 * *is the viewport I am capturing the one that is on screen?* — so ask that
 * instead, and keep the size check underneath it as the second line for the
 * never-visited case that reaches this code with a matching tab.
 *
 * 🔴 THE UNIT TEST THAT PINS THE SIZE GUARD FEEDS A MOCKED 2x2 THROUGH A FAKE
 * BRIDGE. It is a true test of the branch and it is structurally unable to observe
 * the engine behaviour the branch is a model of — which is why this survived from
 * 1.30.0 to 1.76.0 with a green suite over it the whole way.
 *
 * Best-effort by construction: an addon too old to answer `main_screen.get`
 * (pre-1.9.3) degrades to the size check alone rather than losing the capture.
 */
const VIEWPORT_TAB: Record<string, string> = { "2d": "2D", "3d": "3D" };

/** Editor selection, ClassDB / docs lookups, and viewport screenshot. */
export function registerIntrospectionTools(server: McpServer, call: EditorCall, bridge: BridgeClient): void {
  server.registerTool(
    "selection_get",
    { title: "Get selection", description: "Return the paths of the nodes currently selected in the editor.", inputSchema: {} },
    async () => call("selection.get"),
  );

  server.registerTool(
    "selection_set",
    {
      title: "Set selection",
      description: "Replace the editor's node selection with the given node paths.",
      inputSchema: { paths: z.array(z.string()).describe("Node paths relative to the scene root") },
    },
    async ({ paths }) => call("selection.set", { paths }),
  );

  server.registerTool(
    "main_screen_get",
    {
      title: "Get the active main-screen tab",
      description:
        "Report which main-screen editor tab is active (2D / 3D / Script / …) and which are available. " +
        "Read-only. The active tab decides which viewport screenshot_editor can actually capture: Godot " +
        "collapses the inactive tab's viewport to a few pixels.",
      inputSchema: {},
    },
    async () => call("main_screen.get"),
  );

  server.registerTool(
    "main_screen_set",
    {
      title: "Switch the main-screen tab",
      description:
        "Switch the editor's main-screen tab (2D / 3D / Script / …), matching the name case-insensitively. " +
        "Use this before screenshot_editor to make the viewport you want to capture the active one — opening " +
        "a scene does NOT switch the tab. Returns the resulting state, read back from the editor rather than " +
        "echoed. An unknown name comes back with the live list of available tabs.",
      inputSchema: {
        name: z.string().describe('Tab name as the editor reports it, case-insensitive — e.g. "2D", "3D", "Script"'),
      },
    },
    async ({ name }) => call("main_screen.set", { name }),
  );

  server.registerTool(
    "classdb_get_class",
    {
      title: "Introspect class",
      description: "Return the parent class, methods, properties, and signals of an engine class via ClassDB.",
      inputSchema: {
        class_name: z.string().describe("Engine class name, e.g. AudioStreamPlayer3D"),
        include_inherited: z.boolean().optional().describe("Include inherited members (default false)"),
      },
    },
    async ({ class_name, include_inherited }) =>
      call("classdb.get_class", { class_name, include_inherited: include_inherited ?? false }),
  );

  server.registerTool(
    "class_reference",
    {
      title: "Class reference",
      description:
        "Full engine-class reference via ClassDB: method SIGNATURES (return type + typed args), signal " +
        "signatures, and typed properties — the detailed view classdb_get_class summarises as bare names. " +
        "Read-only. Includes the canonical online docs URL. Pass member to filter to a single method/property/signal.",
      inputSchema: {
        class_name: z.string().describe("Engine class name, e.g. AudioStreamPlayer3D"),
        include_inherited: z.boolean().optional().describe("Include inherited members (default false)"),
        member: z.string().optional().describe("Only return members whose name contains this substring"),
      },
    },
    async ({ class_name, include_inherited, member }) =>
      call("classdb.reference", {
        class_name,
        include_inherited: include_inherited ?? false,
        member: member ?? "",
      }),
  );

  server.registerTool(
    "docs_search",
    {
      title: "Search the class reference",
      description:
        "Search the Godot class reference (ClassDB) by keyword — matching class names and, unless a scope narrows " +
        "it, their methods/properties/signals — and return each hit with its canonical docs URL. Read-only. " +
        "Use kind to restrict to one member type, class_name to scope to a single class, and limit to bound results.",
      inputSchema: {
        query: z.string().describe("Case-insensitive substring to match against class / member names"),
        kind: z.enum(["any", "class", "method", "property", "signal"]).optional().describe("Restrict to one result kind (default any)"),
        class_name: z.string().optional().describe("Scope the member search to a single class (still returns class-name matches project-wide)"),
        limit: z.number().int().positive().optional().describe("Max results before truncation (default 40)"),
        deep: z.boolean().optional().describe("Also scan members, not just class names (default true)"),
      },
    },
    async ({ query, kind, class_name, limit, deep }) =>
      call("docs.search", {
        query,
        kind: kind ?? "any",
        class_name: class_name ?? "",
        limit: limit ?? 40,
        deep: deep ?? true,
      }),
  );

  server.registerTool(
    "screenshot_editor",
    {
      title: "Screenshot editor viewport",
      // 🔴 311 — THE NEW REFUSAL IS NAMED IN ONE CLAUSE AND PAID FOR OUT OF THIS
      // DESCRIPTION'S OWN PROSE, NOT OUT OF THE BUDGET. `BYTES_CEILING` sits exactly on
      // the shipped surface and its reason forbids a raise that buys a description, so
      // the clause below is funded by compressing 261's two-case explanation of a hidden
      // tab — which said at length what its own last eleven words say. Measured after:
      // the surface is SMALLER than it was. This is the tool whose whole job is letting
      // the assistant see, so it is the one description that earns the words.
      description:
        "Capture the 2D or 3D editor viewport as a PNG as image content so the assistant can see the scene. " +
        "The requested viewport's tab must be the ACTIVE main-screen tab, and this tool refuses with " +
        "viewport_not_active when it is not: a hidden tab's viewport is either a few pixels or a full-size " +
        "stale frame that looks exactly like a good capture. It also refuses with window_not_drawing when the " +
        "editor window is off screen or headless: Godot draws nothing then. " +
        'A fresh editor is on the 3D tab and opening a scene does NOT switch it, so to capture 2d call ' +
        'main_screen_set {"name":"2D"} first AND pass {"viewport":"2d"} — the default is 3d, so switching the tab ' +
        "alone captures the tab you just left. main_screen_get reports which tab is active.",
      inputSchema: { viewport: z.enum(["2d", "3d"]).optional().describe("Which viewport (default 3d)") },
    },
    async ({ viewport }) => {
      try {
        const want = viewport ?? "3d";
        // 🔴 261 — ASK THE EDITOR WHICH TAB IS ON SCREEN BEFORE READING A TEXTURE.
        // The size check below cannot separate "hidden and frozen" from "visible and
        // unchanged", because after a tab's first visit those two states have the same
        // dimensions. This one can, and it is the question the caller actually means.
        // Degrades on an addon too old to answer, rather than refusing the capture.
        let activeTab: string | undefined;
        try {
          const s = (await bridge.request("main_screen.get", {})) as { active?: string | null };
          if (s?.active) activeTab = s.active;
        } catch { /* pre-1.9.3 addon — fall through to the size check alone */ }
        if (activeTab && VIEWPORT_TAB[want] && activeTab.toUpperCase() !== VIEWPORT_TAB[want]) {
          return fail({
            code: "viewport_not_active",
            message:
              `The ${want} editor viewport is not on screen — the editor is on the "${activeTab}" tab. Godot keeps a ` +
              `hidden tab's viewport alive but stops drawing to it, so capturing it now returns the frame it held when ` +
              `it was hidden, at full size and with no sign that it is stale. Call main_screen_set ` +
              `{"name":"${VIEWPORT_TAB[want]}"} and retry, or capture the active tab with ` +
              `screenshot_editor {"viewport":"${activeTab.toLowerCase()}"}.`,
          });
        }
        const r = (await bridge.request("screenshot.editor_viewport", { viewport: want })) as {
          base64: string;
          mime: string;
          width: number;
          height: number;
          viewport: string;
        };
        if (r.width < MIN_RENDERED_VIEWPORT_PX || r.height < MIN_RENDERED_VIEWPORT_PX) {
          // Name the tab that is ACTUALLY active rather than leaving the caller to infer
          // it from a 2x2. 261: the read now happens ABOVE, before the capture, so this
          // arm reuses it — an addon too old to answer leaves it undefined and the message
          // degrades exactly as it did before.
          const active = activeTab;
          return fail({
            code: "viewport_not_rendered",
            message:
              `The ${r.viewport} editor viewport measured ${r.width}x${r.height} — a collapsed viewport, not a rendered ` +
              `frame. Godot keeps the inactive main-screen tab's viewport alive at its minimum size, so the capture ` +
              `"succeeds" and returns a placeholder image. ` +
              (active
                ? `The editor is on the "${active}" tab. Call main_screen_set {"name":"${r.viewport.toUpperCase()}"} `
                : `Switch the editor to the ${r.viewport.toUpperCase()} tab with main_screen_set (opening a scene does NOT switch it) `) +
              `and retry — or capture the viewport whose tab is active.`,
          });
        }
        return {
          content: [
            { type: "image" as const, data: r.base64, mimeType: r.mime },
            { type: "text" as const, text: `Captured ${r.viewport} viewport (${r.width}x${r.height}).` },
          ],
        };
      } catch (err) {
        return fail(err);
      }
    },
  );
}
