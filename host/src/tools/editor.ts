import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BridgeClient } from "../bridge.js";
import type { Config } from "../config.js";
import { makeCall, makePathGuard } from "./editor/common.js";
import { registerCoreTools } from "./editor/core.js";
import { registerSceneTools } from "./editor/scene.js";
import { registerNodeTools } from "./editor/node.js";
import { registerSignalTools } from "./editor/signal.js";
import { registerIntrospectionTools } from "./editor/introspection.js";
import { registerResourceTools } from "./editor/resource.js";
import { registerFilesystemTools } from "./editor/filesystem.js";
import { registerAnimationTools } from "./editor/animation.js";
import { registerTileTools } from "./editor/tiles.js";
import { registerPhysicsTools } from "./editor/physics.js";
import { registerParticleTools } from "./editor/particles.js";
import { registerShaderTools } from "./editor/shader.js";
import { registerAudioTools } from "./editor/audio.js";
import { registerUiTools } from "./editor/ui.js";
import { registerSpatialTools } from "./editor/spatial.js";
import { registerProjectInputTestTools } from "./editor/project_input_test.js";

/**
 * Editor-bridge tools (Plane A): live-editor operations that forward to the
 * in-editor addon over TCP. Historically one ~2,600-line function; now split by
 * domain into ./editor/* modules. This thin entry builds the shared bridge-call
 * helper and registers each group in its original order, so the registered tool
 * set and its order are unchanged.
 */
export function registerEditorTools(server: McpServer, bridge: BridgeClient, config: Config): void {
  const call = makeCall(bridge);
  // 🔴 THE GUARD IS THREADED, NOT INSTALLED IN `makeCall`. Wrapping the shared bridge
  // helper would have been one line, but it serves ~150 editor tools whose params are
  // node paths, property names and class names — a helper that has to GUESS which
  // string is a filesystem path is a guess on every one of them. The writers (164)
  // and READERS (165) that were MEASURED escaping take it explicitly instead, so the
  // blast radius of this change is exactly the set that was measured.
  const guard = makePathGuard(config.projectPath);
  registerCoreTools(server, call);
  registerSceneTools(server, call, guard);
  registerNodeTools(server, call, guard);
  registerSignalTools(server, call);
  registerIntrospectionTools(server, call, bridge);
  registerResourceTools(server, call, guard);
  registerFilesystemTools(server, call, guard);
  registerAnimationTools(server, call);
  registerTileTools(server, call, guard);
  registerPhysicsTools(server, call);
  registerParticleTools(server, call, guard);
  registerShaderTools(server, call, guard);
  registerAudioTools(server, call, guard);
  registerUiTools(server, call, guard);
  registerSpatialTools(server, call, guard);
  registerProjectInputTestTools(server, call, guard);
}
