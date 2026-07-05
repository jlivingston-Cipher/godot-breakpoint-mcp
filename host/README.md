# godot-claude-bridge

The MCP **host** for [godot-claude-bridge](https://github.com/jlivingston-Cipher/godot-claude-bridge) —
a Model Context Protocol server that exposes the Godot game engine to Claude
across four planes: headless CLI, the live editor, Godot's own LSP + DAP, and a
runtime bridge inside the running game. **54 tools + 5 MCP resources**,
live-validated against a real Godot 4.7 editor.

This package is the TypeScript host that Claude talks to over stdio. It needs the
companion **Godot editor addon** (`claude_bridge`) installed in your project to
reach anything beyond the headless-CLI plane — see the repository for the addon
and the full architecture.

## Install

```bash
npx godot-claude-bridge          # run on demand
# or
npm i -g godot-claude-bridge     # install the `godot-claude-bridge` command
```

Requires **Node ≥ 18**. The host pins `@modelcontextprotocol/sdk` to the `1.x`
line (the `registerTool({ inputSchema, outputSchema })` + elicitation surface).

## Register with Claude

**Claude Code:**

```bash
claude mcp add godot -- npx -y godot-claude-bridge
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["-y", "godot-claude-bridge"],
      "env": {
        "GODOT_BIN": "/abs/path/to/Godot",
        "GODOT_PROJECT": "/abs/path/to/your/project"
      }
    }
  }
}
```

Set `GODOT_BIN` if `godot` isn't on your `PATH`. The full environment-variable
table (bridge/LSP/DAP/runtime hosts, ports, and timeouts) is in the
[repository README](https://github.com/jlivingston-Cipher/godot-claude-bridge#configuration-environment-variables).

## The addon (required for the editor / runtime planes)

Install the `claude_bridge` editor addon into your Godot project (drop
`addons/claude_bridge/` in and enable it under Project Settings → Plugins). It
opens the loopback servers this host connects to and auto-registers the in-game
runtime bridge. Without it, only the headless-CLI (`godot_*`) plane works.

## Remote / Cowork note

This bridge is a **local** co-development tool: all four planes talk to
`127.0.0.1`, and screenshots render real frames. A cloud/remote deployment can't
see a local editor and is a degraded, headless subset without a local relay —
run the host on the same machine as Godot. See
[`docs/DISTRIBUTION.md`](https://github.com/jlivingston-Cipher/godot-claude-bridge/blob/main/docs/DISTRIBUTION.md).

## License

MIT — see [LICENSE](./LICENSE).
