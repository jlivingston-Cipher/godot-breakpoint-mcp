import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { loadConfig, MIN_TIMEOUT_MS } from "../src/config.js";

/** Keys loadConfig reads, so each test can restore the environment cleanly.
 *  The CLAUDE_* names are listed only so withEnv() saves/clears/restores them —
 *  loadConfig no longer reads them (the compat shim was removed in 1.1.0); the
 *  regression test below asserts a set CLAUDE_* is ignored. */
const ENV_KEYS = [
  "GODOT_PROJECT", "GODOT_BIN",
  "BREAKPOINT_BRIDGE_HOST", "BREAKPOINT_BRIDGE_PORT", "BREAKPOINT_BRIDGE_TIMEOUT_MS",
  "CLAUDE_BRIDGE_HOST", "CLAUDE_BRIDGE_PORT", "CLAUDE_BRIDGE_TIMEOUT_MS",
  "GODOT_LSP_HOST", "GODOT_LSP_PORT", "GODOT_LSP_TIMEOUT_MS",
  "GODOT_DAP_HOST", "GODOT_DAP_PORT", "GODOT_DAP_TIMEOUT_MS",
  "BREAKPOINT_RUNTIME_HOST", "BREAKPOINT_RUNTIME_PORT", "BREAKPOINT_RUNTIME_TIMEOUT_MS",
  "CLAUDE_RUNTIME_HOST", "CLAUDE_RUNTIME_PORT", "CLAUDE_RUNTIME_TIMEOUT_MS",
  // The remaining six of the eleven timeouts in TIMEOUT_ENV_DEFAULTS. They were
  // absent, so a test that set them left them set for the tests after it —
  // harmless while every such test also set what it asserted, but the floor
  // tests below set several and assert one, which is exactly the shape that
  // would eventually read a value it did not choose.
  "GODOT_CSLSP_TIMEOUT_MS",
  "GODOT_DAP_SETVAR_TIMEOUT_MS", "GODOT_DAP_EVALUATE_TIMEOUT_MS",
  "GODOT_CSDAP_TIMEOUT_MS", "GODOT_CSDAP_SETVAR_TIMEOUT_MS", "GODOT_CSDAP_EVALUATE_TIMEOUT_MS",
  "BREAKPOINT_ASSETGEN_TIMEOUT_MS",
];

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  try {
    for (const k of ENV_KEYS) delete process.env[k];
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("loadConfig applies documented defaults when no env is set", () => {
  withEnv({ GODOT_PROJECT: "/tmp/proj" }, () => {
    const c = loadConfig();
    assert.equal(c.godotBin, "godot");
    assert.equal(c.projectPath, "/tmp/proj");
    assert.equal(c.bridgeHost, "127.0.0.1");
    assert.equal(c.bridgePort, 9080);
    assert.equal(c.bridgeTimeoutMs, 15000);
    assert.equal(c.lspHost, "127.0.0.1");
    assert.equal(c.lspPort, 6005);
    assert.equal(c.lspTimeoutMs, 15000);
    assert.equal(c.dapHost, "127.0.0.1");
    assert.equal(c.dapPort, 6006);
    assert.equal(c.dapTimeoutMs, 20000);
    assert.equal(c.runtimeHost, "127.0.0.1");
    assert.equal(c.runtimePort, 9081);
    assert.equal(c.runtimeTimeoutMs, 15000);
  });
});

test("projectUri is derived from projectPath as a file:// URI", () => {
  withEnv({ GODOT_PROJECT: "/tmp/My Proj" }, () => {
    const c = loadConfig();
    assert.equal(c.projectUri, pathToFileURL("/tmp/My Proj").href);
    assert.ok(c.projectUri.includes("%20"));
  });
});

test("ports and timeouts are parsed as integers from the environment", () => {
  withEnv(
    {
      GODOT_PROJECT: "/tmp/proj",
      GODOT_BIN: "/opt/homebrew/bin/godot",
      BREAKPOINT_BRIDGE_HOST: "0.0.0.0",
      BREAKPOINT_BRIDGE_PORT: "19080",
      BREAKPOINT_BRIDGE_TIMEOUT_MS: "5000",
      GODOT_LSP_PORT: "16005",
      GODOT_DAP_PORT: "16006",
      BREAKPOINT_RUNTIME_PORT: "19081",
    },
    () => {
      const c = loadConfig();
      assert.equal(c.godotBin, "/opt/homebrew/bin/godot");
      assert.equal(c.bridgeHost, "0.0.0.0");
      assert.equal(c.bridgePort, 19080);
      assert.strictEqual(typeof c.bridgePort, "number");
      assert.equal(c.bridgeTimeoutMs, 5000);
      assert.equal(c.lspPort, 16005);
      assert.equal(c.dapPort, 16006);
      assert.equal(c.runtimePort, 19081);
    },
  );
});

/**
 * A port env var that is set but unusable must fall back to the default, not
 * become `NaN`.
 *
 * `?? "9081"` only catches null/undefined, so `BREAKPOINT_RUNTIME_PORT=""` — the
 * shape a shell produces from an unset variable in a `.env` file or a CI matrix
 * — reached `Number.parseInt` and yielded NaN. That was survivable while a bad
 * port merely failed to connect. It stopped being survivable once
 * `godot_run_managed` began refusing on an unbindable port: `listen(NaN)` throws
 * `ERR_SOCKET_BAD_PORT`, the probe cannot distinguish that from "held", and the
 * tool would refuse to start a game that in fact would have worked — the addon
 * guards this on its own side (`runtime_bridge.gd:75` requires `is_valid_int()`)
 * and keeps the default. The host now matches the addon.
 */
test("a set-but-unusable port env var falls back to the default instead of NaN", () => {
  for (const bad of ["", "   ", "nope", "80a80", "-1", "65536", "99999999"]) {
    withEnv(
      {
        GODOT_PROJECT: "/tmp/proj",
        BREAKPOINT_BRIDGE_PORT: bad,
        GODOT_LSP_PORT: bad,
        GODOT_DAP_PORT: bad,
        BREAKPOINT_RUNTIME_PORT: bad,
      },
      () => {
        const c = loadConfig();
        for (const [name, got, want] of [
          ["bridgePort", c.bridgePort, 9080],
          ["lspPort", c.lspPort, 6005],
          ["dapPort", c.dapPort, 6006],
          ["runtimePort", c.runtimePort, 9081],
        ] as Array<[string, number, number]>) {
          assert.ok(Number.isInteger(got), `${name} must stay an integer for ${JSON.stringify(bad)}, got ${got}`);
          assert.equal(got, want, `${name} must fall back to ${want} for ${JSON.stringify(bad)}`);
        }
      },
    );
  }
});

// 0 is a legal port number (bind-any), so it must NOT be swallowed by the guard.
test("port 0 is honoured, not treated as unset", () => {
  withEnv({ GODOT_PROJECT: "/tmp/proj", BREAKPOINT_RUNTIME_PORT: "0" }, () => {
    assert.equal(loadConfig().runtimePort, 0);
  });
});

/**
 * Every TIMEOUT env var, under the same hostile values the port test above uses.
 *
 * The port guard shipped alone: four ports went through `port()` while eleven
 * timeouts kept `Number.parseInt(x ?? "15000", 10)` — the exact pattern that
 * function's docstring condemns — thirteen lines below it. The test named
 * "ports *and timeouts* are parsed as integers from the environment" fed
 * timeouts nothing but `"5000"`, so the gap read as covered.
 *
 * A NaN deadline is worse than a NaN port, because the request is already on
 * the wire. `setTimeout(cb, NaN)` does not throw — it fires on the next tick,
 * sooner than `setTimeout(cb, 1)` — while the addon polls its socket once per
 * frame and cannot answer inside ~1 ms. The host reports "timed out after
 * NaNms", the addon still executes the mutation, and the real reply is dropped
 * as an unknown id, so an agent that retries applies the mutation twice.
 *
 * Note the values beyond `""`: `parseInt` stops at the first non-digit, so
 * "15s" silently became 15 ms; and past 2^31-1 setTimeout warns and uses 1 ms,
 * landing back in the same near-zero failure from the opposite direction.
 */
const TIMEOUT_ENV_DEFAULTS: Array<[string, keyof ReturnType<typeof loadConfig>, number]> = [
  ["BREAKPOINT_BRIDGE_TIMEOUT_MS", "bridgeTimeoutMs", 15000],
  ["GODOT_LSP_TIMEOUT_MS", "lspTimeoutMs", 15000],
  ["GODOT_CSLSP_TIMEOUT_MS", "csLspTimeoutMs", 30000],
  ["GODOT_DAP_TIMEOUT_MS", "dapTimeoutMs", 20000],
  ["GODOT_DAP_SETVAR_TIMEOUT_MS", "dapSetVarTimeoutMs", 8000],
  ["GODOT_DAP_EVALUATE_TIMEOUT_MS", "dapEvaluateTimeoutMs", 8000],
  ["GODOT_CSDAP_TIMEOUT_MS", "csDapTimeoutMs", 20000],
  ["GODOT_CSDAP_SETVAR_TIMEOUT_MS", "csDapSetVarTimeoutMs", 8000],
  ["GODOT_CSDAP_EVALUATE_TIMEOUT_MS", "csDapEvaluateTimeoutMs", 8000],
  ["BREAKPOINT_RUNTIME_TIMEOUT_MS", "runtimeTimeoutMs", 15000],
  ["BREAKPOINT_ASSETGEN_TIMEOUT_MS", "assetGenTimeoutMs", 120000],
];

test("a set-but-unusable timeout env var falls back to the default instead of NaN", () => {
  for (const bad of ["", "   ", "nope", "15s", "20_000", "0x3e8", "1e4", "0", "-1", "3000000000"]) {
    const env: Record<string, string> = { GODOT_PROJECT: "/tmp/proj" };
    for (const [name] of TIMEOUT_ENV_DEFAULTS) env[name] = bad;
    withEnv(env, () => {
      const c = loadConfig();
      for (const [name, field, want] of TIMEOUT_ENV_DEFAULTS) {
        const got = c[field] as number;
        assert.ok(
          Number.isSafeInteger(got) && got > 0,
          `${name} must stay a usable positive integer for ${JSON.stringify(bad)}, got ${got}`,
        );
        assert.equal(got, want, `${name} must fall back to ${want} for ${JSON.stringify(bad)}`);
      }
    });
  }
});

// The other half of the negative control: a VALID value must still be honoured
// on every one of the eleven, or the guard above would pass by rejecting
// everything. Deliberately green either way is the point — this half proves the
// absence of a false positive, and it fails if a field is wired to the wrong
// env var or the wrong default.
test("every timeout env var is honoured when it is valid", () => {
  for (const [i, [name, field]] of TIMEOUT_ENV_DEFAULTS.entries()) {
    const want = 1234 + i; // distinct per field, so a crossed wire fails
    withEnv({ GODOT_PROJECT: "/tmp/proj", [name]: String(want) }, () => {
      assert.equal(loadConfig()[field] as number, want, `${name} must set ${String(field)}`);
    });
  }
});

test("deprecated CLAUDE_* env vars are ignored (compat shim removed in 1.1.0)", () => {
  withEnv(
    {
      GODOT_PROJECT: "/tmp/proj",
      CLAUDE_BRIDGE_HOST: "10.0.0.1",
      CLAUDE_BRIDGE_PORT: "18080",
      CLAUDE_BRIDGE_TIMEOUT_MS: "4000",
      CLAUDE_RUNTIME_HOST: "10.0.0.2",
      CLAUDE_RUNTIME_PORT: "18081",
      CLAUDE_RUNTIME_TIMEOUT_MS: "4200",
    },
    () => {
      const c = loadConfig();
      // BREAKPOINT_* is unset, so a set CLAUDE_* must NOT leak in: every value
      // falls back to the documented default now that the shim is gone.
      assert.equal(c.bridgeHost, "127.0.0.1");
      assert.equal(c.bridgePort, 9080);
      assert.equal(c.bridgeTimeoutMs, 15000);
      assert.equal(c.runtimeHost, "127.0.0.1");
      assert.equal(c.runtimePort, 9081);
      assert.equal(c.runtimeTimeoutMs, 15000);
    },
  );
});

/**
 * The floor, and why rejecting `0` was not far enough.
 *
 * `positiveInt` rejects zero on the reasoning that "a deadline of 0 is not a
 * shorter deadline, it is the NaN failure with a different spelling." That is
 * right, and it does not stop at zero: `BREAKPOINT_BRIDGE_TIMEOUT_MS=1` was
 * ACCEPTED by the shipped guard and reproduces the NaN escalation verbatim —
 * driven against the real BridgeClient, "timed out after 1ms" twice and two
 * `Enemy` nodes. Both addons poll their socket from `_process` and dispatch
 * synchronously, so a deadline shorter than a frame cannot be met NO MATTER WHAT
 * the editor is doing. That is premature by construction, not by luck.
 *
 * Below the floor we fall back rather than clamp, matching how the guard already
 * treats 0 and negatives. The floor covers the two BRIDGE deadlines only — see
 * the scope control below for why that boundary is where it is.
 */
/** The two deadlines that reach a frame-polled BridgeClient — and only these. */
const FLOORED: Array<[string, "bridgeTimeoutMs" | "runtimeTimeoutMs", number]> = [
  ["BREAKPOINT_BRIDGE_TIMEOUT_MS", "bridgeTimeoutMs", 15000],
  ["BREAKPOINT_RUNTIME_TIMEOUT_MS", "runtimeTimeoutMs", 15000],
];

test("a below-floor BRIDGE timeout falls back to the default instead of being honoured", () => {
  for (const tooShort of ["1", "5", "33", "60", "100", "249"]) {
    const env: Record<string, string> = { GODOT_PROJECT: "/tmp/proj" };
    for (const [name] of FLOORED) env[name] = tooShort;
    withEnv(env, () => {
      const c = loadConfig();
      for (const [name, field, want] of FLOORED) {
        assert.equal(
          c[field] as number,
          want,
          `${name}=${tooShort} is below the floor and must fall back to ${want}, not be honoured`,
        );
      }
    });
  }
});

/**
 * The boundary, and the mistake it caught.
 *
 * The first cut of this floor applied it to all eleven timeouts, and two csdap
 * tests failed — `csdap.test.ts:301` sets `GODOT_CSDAP_EVALUATE_TIMEOUT_MS=200`
 * to prove a hung adapter fails fast, and got 8000 instead. **The tests were
 * right.** The floor's justification is that both addons poll their socket from
 * `_process`, so they cannot answer inside a frame. LSP, DAP and the asset-gen
 * backend are ordinary request/response over TCP or stdio; nothing frame-polls
 * them, and 200 ms is a reasonable deadline there. A justification that stops at
 * the frame poll gives a floor that stops at the frame poll.
 */
test("the floor does NOT touch the non-bridge timeouts — the scope control", () => {
  const floored = new Set(FLOORED.map(([name]) => name));
  const unfloored = TIMEOUT_ENV_DEFAULTS.filter(([name]) => !floored.has(name));
  assert.equal(unfloored.length, 9, "eleven timeouts, two floored, nine not");
  for (const [name, field] of unfloored) {
    withEnv({ GODOT_PROJECT: "/tmp/proj", [name]: "200" }, () => {
      assert.equal(
        loadConfig()[field] as number,
        200,
        `${name}=200 is a legitimate fail-fast deadline on a transport nothing frame-polls`,
      );
    });
  }
});

// The other half of the control: the floor itself is usable, and above it is
// too. Without this, the test above would pass with an absurdly high floor that
// swallowed every configured value.
test("a bridge timeout at or above the floor is honoured", () => {
  for (const [i, [name, field]] of FLOORED.entries()) {
    const want = MIN_TIMEOUT_MS + i; // distinct per field, so a crossed wire fails
    withEnv({ GODOT_PROJECT: "/tmp/proj", [name]: String(want) }, () => {
      assert.equal(loadConfig()[field] as number, want, `${name}=${want} is at/above the floor and must be honoured`);
    });
  }
});

test("the floor is 250ms, and the boundary is inclusive", () => {
  assert.equal(MIN_TIMEOUT_MS, 250);
  withEnv({ GODOT_PROJECT: "/tmp/proj", BREAKPOINT_BRIDGE_TIMEOUT_MS: "250" }, () => {
    assert.equal(loadConfig().bridgeTimeoutMs, 250, "exactly the floor is usable");
  });
  withEnv({ GODOT_PROJECT: "/tmp/proj", BREAKPOINT_BRIDGE_TIMEOUT_MS: "249" }, () => {
    assert.equal(loadConfig().bridgeTimeoutMs, 15000, "one below the floor falls back");
  });
});
