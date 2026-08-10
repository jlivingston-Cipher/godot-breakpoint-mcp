import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gate } from "../../confirm.js";
import type { EditorCall, PathGuard } from "./common.js";

/**
 * Resource (.tres/.res) create / load / save / property / import ops.
 *
 * 🔴 THE GUARD RUNS BEFORE `gate()`, deliberately (163 §3's shape): a call that can
 * never legally write must not first ask the user to approve writing. It also means
 * the refusal needs no editor at all, which is what makes the unit tests cheap.
 */
export function registerResourceTools(server: McpServer, call: EditorCall, guard: PathGuard): void {
  server.registerTool(
    "resource_create",
    {
      title: "Create resource",
      description:
        "Instantiate a Resource subclass and save it as a new file. DESTRUCTIVE (writes a file) — gated by confirmation. Optional initial properties use the tagged-Variant convention.",
      inputSchema: {
        class_name: z.string().describe("Resource subclass to instantiate, e.g. StyleBoxFlat, Theme, GDScript"),
        to_path: z.string().describe("Destination res:// path, e.g. res://styles/panel.tres"),
        properties: z.record(z.string(), z.any()).optional().describe("Initial property values (JSON scalars or __type__-tagged Variants)"),
        confirm: z.boolean().optional().describe("Auto-approve this destructive action (skip the confirmation prompt)"),
      },
    },
    async ({ class_name, to_path, properties, confirm }) => {
      const escaped = guard(to_path, "to_path");
      if (escaped) return escaped;
      const blocked = await gate(server, confirm, `Create ${class_name} resource at ${to_path}`);
      if (blocked) return blocked;
      return call("resource.create", properties !== undefined ? { class_name, to_path, properties } : { class_name, to_path });
    },
  );

  server.registerTool(
    "resource_load",
    {
      title: "Load resource",
      description: "Load a resource file and return its class, resource_name, and inspector-visible property list. Read-only.",
      inputSchema: { path: z.string().describe("Resource res:// path") },
    },
    async ({ path }) => {
      const escaped = guard(path, "path");
      if (escaped) return escaped;
      return call("resource.load", { path });
    },
  );

  server.registerTool(
    "resource_save",
    {
      title: "Save resource",
      description:
        "Load a resource and (re-)save it, optionally to a new path and with ResourceSaver flags. DESTRUCTIVE (writes a file) — gated by confirmation. Shares subresources by reference; use resource_duplicate for an independent copy.",
      inputSchema: {
        from_path: z.string().describe("Source resource res:// path"),
        to_path: z.string().optional().describe("Destination res:// path (default: overwrite from_path)"),
        flags: z.number().int().optional().describe("ResourceSaver.SaverFlags bitmask (e.g. 32 = FLAG_COMPRESS)"),
        confirm: z.boolean().optional().describe("Auto-approve this destructive action (skip the confirmation prompt)"),
      },
    },
    async ({ from_path, to_path, flags, confirm }) => {
      // 🔴 BOTH parameters. Measured: `from_path: res://../…` LOADED a resource from
      // outside the root and saved a copy inside it. Guarding only the destination
      // would leave this tool half-wired — the failure mode 161, 162 and 163 each
      // re-learned on a different plane.
      const escaped = guard(from_path, "from_path") ?? guard(to_path, "to_path");
      if (escaped) return escaped;
      const blocked = await gate(server, confirm, `Save resource ${from_path}${to_path ? ` to ${to_path}` : ""}`);
      if (blocked) return blocked;
      const params: Record<string, unknown> = { from_path };
      if (to_path !== undefined) params.to_path = to_path;
      if (flags !== undefined) params.flags = flags;
      return call("resource.save", params);
    },
  );

  server.registerTool(
    "resource_duplicate",
    {
      title: "Duplicate resource",
      description:
        "Load a resource, duplicate it (optionally deep, cloning subresources), and save the copy to a new path. DESTRUCTIVE (writes a file) — gated by confirmation.",
      inputSchema: {
        path: z.string().describe("Source resource res:// path"),
        to_path: z.string().describe("Destination res:// path for the copy"),
        deep: z.boolean().optional().describe("Deep-duplicate subresources (default false)"),
        confirm: z.boolean().optional().describe("Auto-approve this destructive action (skip the confirmation prompt)"),
      },
    },
    async ({ path, to_path, deep, confirm }) => {
      const escaped = guard(path, "path") ?? guard(to_path, "to_path");
      if (escaped) return escaped;
      const blocked = await gate(server, confirm, `Duplicate resource ${path} to ${to_path}`);
      if (blocked) return blocked;
      return call("resource.duplicate", deep !== undefined ? { path, to_path, deep } : { path, to_path });
    },
  );

  server.registerTool(
    "resource_get_property",
    {
      title: "Get resource property",
      description: "Read a single property of a resource file by name. Read-only. The value comes back tagged (Variant convention).",
      inputSchema: {
        path: z.string().describe("Resource res:// path"),
        property: z.string().describe("Property name"),
      },
    },
    async ({ path, property }) => {
      const escaped = guard(path, "path");
      if (escaped) return escaped;
      return call("resource.get_property", { path, property });
    },
  );

  server.registerTool(
    "resource_set_property",
    {
      title: "Set resource property",
      description:
        "Set a single property on a resource file and save it. DESTRUCTIVE (writes a file) — gated by confirmation. The value uses the tagged-Variant convention.",
      inputSchema: {
        path: z.string().describe("Resource res:// path"),
        property: z.string().describe("Property name"),
        value: z.any().describe("New value (JSON scalar or __type__-tagged Variant)"),
        confirm: z.boolean().optional().describe("Auto-approve this destructive action (skip the confirmation prompt)"),
      },
    },
    async ({ path, property, value, confirm }) => {
      // 🔴 MEASURED AGAINST A LIVE 4.7 EDITOR: `res://../example_evil/x.tres` had its
      // BYTES REWRITTEN outside the project root, and the reply reported `ok`. The
      // verdict came from the file's hash, not the reply.
      const escaped = guard(path, "path");
      if (escaped) return escaped;
      const blocked = await gate(server, confirm, `Set ${property} on ${path}`);
      if (blocked) return blocked;
      return call("resource.set_property", { path, property, value });
    },
  );

  server.registerTool(
    "resource_get_import_settings",
    {
      title: "Get import settings",
      description:
        "Read an asset's import metadata (.import): the importer and its parameters. Read-only. Returns imported=false when the file exists but has no .import sidecar; errors not_found when the path is not a file (matching resource_load).",
      inputSchema: { path: z.string().describe("Asset res:// path (e.g. res://icon.png)") },
    },
    async ({ path }) => {
      const escaped = guard(path, "path");
      if (escaped) return escaped;
      return call("resource.get_import_settings", { path });
    },
  );

  server.registerTool(
    "resource_set_import_settings",
    {
      title: "Set import settings",
      description:
        "Update import parameters in an asset's .import metadata and trigger a reimport. DESTRUCTIVE (rewrites metadata + reimports) — gated by confirmation. Errors not_found when the path is not a file, not_imported when the file has no .import sidecar. `settings` echoes every key set; `changed` lists only those whose stored value actually moved, so a no-op is distinguishable from a real edit.",
      inputSchema: {
        path: z.string().describe("Asset res:// path"),
        settings: z.record(z.string(), z.any()).describe("Import params to set (name -> JSON scalar or __type__-tagged Variant)"),
        reimport: z.boolean().optional().describe("Reimport after writing (default true)"),
        confirm: z.boolean().optional().describe("Auto-approve this destructive action (skip the confirmation prompt)"),
      },
    },
    async ({ path, settings, reimport, confirm }) => {
      // 🔴 MEASURED: `res://../example_evil/g166_icon.png` had its `.import` SIDECAR
      // REWRITTEN outside the project root — verdict from the sidecar's hash. The other
      // two spellings answered `reimported: true` while changing nothing out there,
      // which is a separate reporting problem and is NOT what this guard is for.
      const escaped = guard(path, "path");
      if (escaped) return escaped;
      const blocked = await gate(server, confirm, `Set import settings on ${path} and reimport`);
      if (blocked) return blocked;
      return call("resource.set_import_settings", reimport !== undefined ? { path, settings, reimport } : { path, settings });
    },
  );
}
