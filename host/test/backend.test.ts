import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerBackendTools,
  buildConfigScript,
  buildAuthScript,
  buildLeaderboardScript,
  buildCloudSaveScript,
  hasCapability,
  supportersOf,
  BACKEND_SDKS,
} from "../src/tools/backend.js";
import type { Config } from "../src/config.js";

type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
}>;

interface BridgeCall {
  method: string;
  params: Record<string, unknown>;
}

/** A recording fake bridge whose responses are canned per method. */
function fakeBridge(responses: Record<string, Record<string, unknown>>) {
  const calls: BridgeCall[] = [];
  const bridge = {
    async request(method: string, params: Record<string, unknown> = {}) {
      calls.push({ method, params });
      if (method in responses) return responses[method];
      throw new Error(`unexpected bridge method ${method}`);
    },
  };
  return { bridge, calls };
}

/** Register the backend family against a recorder + fake bridge. */
function setup(responses: Record<string, Record<string, unknown>> = {}) {
  const handlers: Record<string, Handler> = {};
  const server = {
    registerTool(name: string, _config: unknown, handler: Handler) { handlers[name] = handler; },
    // Auto-accept any elicitation so gated writers proceed under test.
    server: { elicitInput: async () => ({ action: "accept", content: { proceed: true } }) },
  };
  const { bridge, calls } = fakeBridge(responses);
  const cfg: Config = { projectPath: "/tmp/nonexistent" } as Config;
  registerBackendTools(
    server as unknown as Parameters<typeof registerBackendTools>[0],
    bridge as unknown as Parameters<typeof registerBackendTools>[1],
    cfg,
  );
  return { handlers, calls };
}

// A backend.detect result reporting a given set of installed SDK ids.
function detectResult(installed: string[]) {
  const backends = BACKEND_SDKS.map((sdk) => ({
    sdk,
    installed: installed.includes(sdk),
    method: installed.includes(sdk) ? "autoload" : null,
    autoload: installed.includes(sdk) ? "Stub" : null,
    addon_dir: null,
    class_name: null,
  }));
  return { "backend.detect": { backends, detected: installed } };
}
const WRITTEN = { "mp.write_script": { status: "written", path: null as string | null, bytes: 120, created: true } };

// ------------------------------------------------------- capability matrix ----

test("capability matrix: the three BaaS SDKs are full; Photon is configure-only", () => {
  for (const sdk of ["silentwolf", "nakama", "playfab"] as const) {
    assert.ok(hasCapability(sdk, "auth") && hasCapability(sdk, "leaderboard") && hasCapability(sdk, "cloudsave"));
  }
  assert.ok(hasCapability("photon", "configure"));
  assert.ok(!hasCapability("photon", "auth") && !hasCapability("photon", "leaderboard") && !hasCapability("photon", "cloudsave"));
});

test("supportersOf lists exactly the SDKs that provide a feature", () => {
  assert.deepEqual(supportersOf("leaderboard"), ["SilentWolf", "Nakama", "PlayFab"]);
  assert.deepEqual(supportersOf("configure"), ["SilentWolf", "Nakama", "PlayFab", "Photon"]);
});

// --------------------------------------------------------------- templates ----

const tabsOnly = (src: string) => assert.ok(!/^ +\S/m.test(src), "no space-indented lines");

test("buildConfigScript emits an SDK-specific bootstrap for every SDK (tabs only)", () => {
  const sw = buildConfigScript("silentwolf", { apiKey: "K", gameId: "G" });
  assert.match(sw, /^extends Node/m);
  assert.match(sw, /const API_KEY := "K"/);
  assert.match(sw, /const GAME_ID := "G"/);
  assert.match(sw, /SilentWolf\.configure\(/);
  tabsOnly(sw);

  const nk = buildConfigScript("nakama", { host: "example.com", port: 1234, serverKey: "sk" });
  assert.match(nk, /const HOST := "example.com"/);
  assert.match(nk, /const PORT := 1234/);
  assert.match(nk, /const SERVER_KEY := "sk"/);
  assert.match(nk, /Nakama\.create_client\(SERVER_KEY, HOST, PORT, SCHEME\)/);
  tabsOnly(nk);

  const pf = buildConfigScript("playfab", { titleId: "ABCDE" });
  assert.match(pf, /const TITLE_ID := "ABCDE"/);
  assert.match(pf, /PlayFabManager\.settings\.title_id = TITLE_ID/);
  tabsOnly(pf);

  const ph = buildConfigScript("photon", { appId: "app1", region: "eu" });
  assert.match(ph, /const APP_ID := "app1"/);
  assert.match(ph, /const REGION := "eu"/);
  tabsOnly(ph);
});

test("buildConfigScript falls back to clearly-marked placeholders when values are omitted", () => {
  const sw = buildConfigScript("silentwolf");
  assert.match(sw, /YOUR_SILENTWOLF_API_KEY/);
  assert.match(sw, /YOUR_SILENTWOLF_GAME_ID/);
  const nk = buildConfigScript("nakama");
  assert.match(nk, /const PORT := 7350/);
  assert.match(nk, /const SERVER_KEY := "defaultkey"/);
});

test("buildAuthScript targets each SDK's auth API (tabs only)", () => {
  const sw = buildAuthScript("silentwolf");
  assert.match(sw, /SilentWolf\.Auth\.register_player/);
  assert.match(sw, /SilentWolf\.Auth\.login_player/);
  assert.match(sw, /SilentWolf\.Auth\.logout_player/);
  tabsOnly(sw);
  const nk = buildAuthScript("nakama");
  assert.match(nk, /authenticate_email_async/);
  tabsOnly(nk);
  const pf = buildAuthScript("playfab");
  assert.match(pf, /LoginWithEmailAddress/);
  assert.match(pf, /RegisterPlayFabUser/);
  tabsOnly(pf);
});

test("buildAuthScript throws for Photon (guarded upstream by hasCapability)", () => {
  assert.throws(() => buildAuthScript("photon"), /Photon/);
});

test("buildLeaderboardScript bakes the board name and targets each submit/fetch API", () => {
  const sw = buildLeaderboardScript("silentwolf", { leaderboard: "weekly" });
  assert.match(sw, /const LEADERBOARD := "weekly"/);
  assert.match(sw, /SilentWolf\.Scores\.save_score/);
  assert.match(sw, /SilentWolf\.Scores\.get_scores/);
  tabsOnly(sw);
  const nk = buildLeaderboardScript("nakama", { leaderboard: "global" });
  assert.match(nk, /const LEADERBOARD_ID := "global"/);
  assert.match(nk, /write_leaderboard_record_async/);
  assert.match(nk, /list_leaderboard_records_async/);
  tabsOnly(nk);
  const pf = buildLeaderboardScript("playfab", { leaderboard: "HighScore" });
  assert.match(pf, /const STATISTIC := "HighScore"/);
  assert.match(pf, /UpdatePlayerStatistics/);
  assert.match(pf, /GetLeaderboard/);
  tabsOnly(pf);
});

test("buildCloudSaveScript targets each save/load API (tabs only)", () => {
  const sw = buildCloudSaveScript("silentwolf");
  assert.match(sw, /SilentWolf\.Players\.save_player_data/);
  assert.match(sw, /SilentWolf\.Players\.get_player_data/);
  tabsOnly(sw);
  const nk = buildCloudSaveScript("nakama");
  assert.match(nk, /write_storage_objects_async/);
  assert.match(nk, /read_storage_objects_async/);
  tabsOnly(nk);
  const pf = buildCloudSaveScript("playfab");
  assert.match(pf, /UpdateUserData/);
  assert.match(pf, /GetUserData/);
  tabsOnly(pf);
});

// --------------------------------------------------------- backend_detect ----

test("backend_detect reports all four SDKs and the detected subset", async () => {
  const { handlers, calls } = setup(detectResult(["nakama"]));
  const r = await handlers.backend_detect({});
  const s = r.structuredContent!;
  assert.deepEqual(s.detected, ["nakama"]);
  assert.equal((s.backends as unknown[]).length, 4);
  assert.equal(calls[0].method, "backend.detect");
  assert.match(String(s.message), /Nakama/);
});

test("backend_detect focuses on a single SDK when asked", async () => {
  const { handlers } = setup(detectResult(["nakama", "playfab"]));
  const r = await handlers.backend_detect({ sdk: "playfab" });
  const s = r.structuredContent!;
  assert.deepEqual(s.detected, ["playfab"]);
  assert.equal((s.backends as Array<{ sdk: string }>).length, 1);
  assert.equal((s.backends as Array<{ sdk: string }>)[0].sdk, "playfab");
});

// ------------------------------------------------------ codegen: write path ----

test("backend_configure writes the config script through mp.write_script when the SDK is installed", async () => {
  const { handlers, calls } = setup({ ...detectResult(["silentwolf"]), ...WRITTEN });
  const r = await handlers.backend_configure({ sdk: "silentwolf", api_key: "K", game_id: "G", confirm: true });
  const s = r.structuredContent!;
  assert.equal(s.status, "written");
  assert.equal(s.sdk, "silentwolf");
  assert.equal(s.kind, "config");
  // detect first, then write
  assert.equal(calls[0].method, "backend.detect");
  assert.equal(calls[1].method, "mp.write_script");
  assert.equal(calls[1].params.to_path, "res://backend/silentwolf_config.gd");
  assert.match(String(calls[1].params.content), /const API_KEY := "K"/);
});

test("leaderboard_scaffold writes for an installed SDK, baking the leaderboard name", async () => {
  const { handlers, calls } = setup({ ...detectResult(["nakama"]), ...WRITTEN });
  const r = await handlers.leaderboard_scaffold({ sdk: "nakama", leaderboard_name: "global", confirm: true });
  assert.equal(r.structuredContent!.status, "written");
  assert.equal(r.structuredContent!.kind, "leaderboard");
  assert.match(String(calls[1].params.content), /const LEADERBOARD_ID := "global"/);
});

// ------------------------------------------------ codegen: degrade paths ----

test("leaderboard_scaffold DEGRADES to 'unsupported_feature' for Photon — no bridge call at all", async () => {
  const { handlers, calls } = setup({ ...detectResult(["photon"]), ...WRITTEN });
  const r = await handlers.leaderboard_scaffold({ sdk: "photon", confirm: true });
  const s = r.structuredContent!;
  assert.equal(s.status, "unsupported_feature");
  assert.equal(s.path, null);
  assert.match(String(s.message), /Photon/);
  assert.match(String(s.message), /SilentWolf, Nakama, PlayFab/);
  // Intrinsic to the SDK — decided host-side, so the editor is never asked.
  assert.equal(calls.length, 0);
});

test("auth_scaffold DEGRADES to 'sdk_missing' when the SDK is not installed — detect but no write", async () => {
  const { handlers, calls } = setup({ ...detectResult([]), ...WRITTEN });
  const r = await handlers.auth_scaffold({ sdk: "silentwolf", confirm: true });
  const s = r.structuredContent!;
  assert.equal(s.status, "sdk_missing");
  assert.equal(s.path, null);
  assert.match(String(s.message), /SilentWolf/);
  // It asked the editor (detect) but never wrote.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "backend.detect");
});

test("cloudsave_scaffold rejects a non-.gd path with no bridge call", async () => {
  const { handlers, calls } = setup({ ...detectResult(["nakama"]), ...WRITTEN });
  const r = await handlers.cloudsave_scaffold({ sdk: "nakama", to_path: "res://backend/save.txt", confirm: true });
  assert.equal(r.isError, true);
  assert.equal(calls.length, 0);
});

test("backend_configure is supported for Photon (configure is universal) and writes when installed", async () => {
  const { handlers, calls } = setup({ ...detectResult(["photon"]), ...WRITTEN });
  const r = await handlers.backend_configure({ sdk: "photon", app_id: "app1", region: "eu", confirm: true });
  assert.equal(r.structuredContent!.status, "written");
  assert.match(String(calls[1].params.content), /const APP_ID := "app1"/);
});
