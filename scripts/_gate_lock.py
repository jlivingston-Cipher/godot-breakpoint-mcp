"""The one lock every tree-mutating gate takes before it rewrites anything.

🔴 224 §6.6 — WHAT THIS EXISTS FOR. Two mutating gates were run at once and
corrupted each other's tree, producing a `verdict_gate.mjs: CONTROL FAILED`
that was entirely the harness. A sequential re-run was clean. **That failure
looks exactly like a real finding**, which is the expensive kind: the cost is
not the red, it is the hour spent believing it.

WHY `flock` AND NOT A LOCKFILE. Every gate here restores the tree in a
`finally` and an `atexit`. Neither runs for `SIGKILL`, and a lockfile written
by hand outlives the process that wrote it — so the next run would refuse
against a holder that no longer exists, and a human would delete the file to
get moving. **A guard that trains its own user to remove it is worse than no
guard.** `flock` is released by the kernel when the fd closes, and the fd
closes when the process dies, however it dies. A stale holder is not
representable, so there is no recovery step to learn.

WHY THERE IS NO OPT-OUT. An earlier draft of this module read
`BREAKPOINT_GATE_NOLOCK`. It was deleted for 224 §3.2's reason, which that
session applied to a gate's exemption comment and applies here unchanged: **an
exemption a gate cannot verify is a promise.** There is no environment in which
running two of these concurrently is correct — CI runs them sequentially inside
one job, and the developer path is where 224 lost the hour.

WHAT IT DELIBERATELY DOES NOT DO. It does not serialise *reads*. A gate that
only reads the tree (`contract_check.py`, `spec_conformance.py`,
`assetlib_sweep.py`) is free to run alongside anything; blocking those would
make the guard expensive enough to route around, and routing around it is the
failure mode this file is trying to remove.
"""

from __future__ import annotations

import fcntl
import json
import os
import signal
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCK_PATH = ROOT / ".gate_mutation.lock"

# 🔴 THE REFUSAL MARKER IS PART OF THE CONTRACT, not decoration. `mutation_lock_gate.py`
# discriminates "refused because the lock was held" from "crashed for some other reason"
# on this exact string, the way scope_gate.py's REPORT_MARKER discriminates a catch from
# a harness failure (scope_gate §_mutant_verdict). Changing it without changing that gate
# turns every control there into a green line about nothing.
REFUSAL = "🔴 GATE_LOCK_HELD"
REFUSAL_EXIT = 2          # not 1: a lock refusal is not a finding, and CI must not read it as one

# Held for the lifetime of the process. Never closed explicitly — see the module docstring:
# the kernel's release on exit is the whole reason this is an flock and not a file.
_FD: int | None = None


def _arm_restore_on_signal() -> None:
    """Make a killed gate still restore the tree.

    🔴 THIS SESSION FELL INTO THE HOLE WHILE BUILDING THE GUARD FOR ITS SIBLING, which is
    the only reason it is here. `floor_pin_gate.py` was run under a two-minute harness
    timeout, the harness sent SIGTERM, and Python's default SIGTERM disposition terminates
    the process WITHOUT running `atexit`. The gate had `CHECKS_RUN_FLOOR = 23` mutated to
    `0` at the time, so the restore never happened and the mutant was left in the tree.

    🔴 AND IT PRESENTED AS A FINDING, NOT AS DAMAGE. The next `contract_check.py` run said
    "CHECKS_RUN_FLOOR is 0 but CHECKS_EXPECTED names 23 check(s)" — a coherent, specific,
    entirely fictitious defect, in the same shape 224 §6.6 described for the concurrent
    case. `git add -A` then staged it. The lock two functions down stops TWO gates
    colliding; it does nothing about ONE gate being killed, and that is a different hole in
    the same wall.

    `sys.exit()` from the handler raises SystemExit in the main thread, which unwinds
    through every `finally` and then runs `atexit` — so the restores the gates already
    have start working for the signals that actually arrive. Handlers are only installed
    for signals whose default is to terminate, and never over one a caller has already set
    (a gate under a supervisor keeps the supervisor's disposition).
    """
    for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        try:
            if signal.getsignal(sig) in (signal.SIG_DFL, signal.default_int_handler):
                signal.signal(sig, lambda s, _f: sys.exit(128 + s))
        except (ValueError, OSError):
            pass                          # not the main thread, or the platform has no SIGHUP


def _holder(fd: int) -> str:
    """Who has it, read from the record the holder wrote. Best-effort by construction:
    the answer is for a human, and the refusal does not depend on it being parseable."""
    try:
        raw = os.pread(fd, 4096, 0).decode("utf-8", "replace").strip()
        rec = json.loads(raw)
        age = max(0, int(time.time()) - int(rec.get("started", 0)))
        return f"{rec.get('gate', '?')} (pid {rec.get('pid', '?')}, {age}s ago)"
    except Exception:
        return "another mutating gate"


def acquire(gate: str) -> None:
    """Take the tree-mutation lock or refuse. Called by every gate that rewrites a
    TRACKED file, before it rewrites one.

    The call goes at the TOP of `main()`, above the self-check. A gate's self-check
    reads the tree, and under a concurrent mutation it would be reading somebody else's
    mutant — so a self-check that ran first could report a defect in this file that is
    really a defect in the scheduling.
    """
    global _FD
    if _FD is not None:                       # idempotent: a gate importing another's helpers
        return
    _arm_restore_on_signal()
    fd = os.open(LOCK_PATH, os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        who = _holder(fd)
        os.close(fd)
        print(f"{REFUSAL} {gate} refused to start — {who} is already rewriting tracked "
              f"files in this tree.")
        print("   Two mutating gates at once rewrite each other's files and produce a red "
              "that means nothing (224 §6.6).")
        print("   Run them one at a time. Nothing was touched.")
        sys.exit(REFUSAL_EXIT)
    os.ftruncate(fd, 0)
    os.write(fd, json.dumps(
        {"gate": gate, "pid": os.getpid(), "started": int(time.time())}
    ).encode("utf-8"))
    _FD = fd
