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
      description:
        "Capture the 2D or 3D editor viewport as a PNG and return it as image content so the assistant can see the scene. " +
        "Requires the matching editor tab (2D/3D) to be active: Godot collapses the inactive tab's viewport to a few " +
        "pixels, and this tool returns a viewport_not_rendered error rather than that placeholder frame. " +
        "A fresh editor is on the 3D tab and opening a scene does NOT switch it, so to capture 2d reliably call " +
        'main_screen_set {"name":"2D"} first — or main_screen_get to see which tab is active.',
      inputSchema: { viewport: z.enum(["2d", "3d"]).optional().describe("Which viewport (default 3d)") },
    },
    async ({ viewport }) => {
      try {
        const r = (await bridge.request("screenshot.editor_viewport", { viewport: viewport ?? "3d" })) as {
          base64: string;
          mime: string;
          width: number;
          height: number;
          viewport: string;
        };
        if (r.width < MIN_RENDERED_VIEWPORT_PX || r.height < MIN_RENDERED_VIEWPORT_PX) {
          // Name the tab that is ACTUALLY active rather than leaving the caller to infer
          // it from a 2x2. Best-effort: this error must survive an addon too old to answer
          // (main_screen.* is 1.9.3+), so a failure here degrades the message instead of
          // replacing a useful "not rendered" error with an unrelated bridge error.
          let active: string | undefined;
          try {
            const s = (await bridge.request("main_screen.get", {})) as { active?: string | null };
            if (s?.active) active = s.active;
          } catch { /* older addon, or no main-screen container — fall through */ }
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
