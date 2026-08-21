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

🆕 228 — AND THAT LAST PARAGRAPH WAS THE HOLE. Not serialising reads is still
right; leaving a reader with no way to ASK was not. 227 §7.2: `control_gate.py`
was mid-sweep when a session cut a patch with `git diff`, and the patch carried
`npm 0.0.0` in the README badge — a live control, mid-flight, inside a
deliverable. `mutation_lock_gate.py` proves every MUTATOR refuses to run beside
another; nothing told the READER anything at all. The lock was held, the answer
existed, and no reader had a question to put to it. **A guard that only the
guarded population can consult governs half the tree it is named after.**

🆕 228 — THE SECOND HOLE IS THE ONE `flock` CANNOT REACH. The kernel releases
the lock however the holder dies, which is why a stale HOLDER is not
representable — but a stale MUTANT is. `SIGKILL` runs no `finally` and no
`atexit`, so the tree keeps the mutation and the next gate acquires a free lock
over somebody else's corpse. 225 item 4 and 226 item 6 carried this; the fix is
that the lock file outlives the flock, so the RECORD in it can carry what the
flock cannot.

WHAT THE RECORD CLAIMS, AND WHY IT IS NOT A BOOLEAN. The obvious marker — a
`mutating: true` the next acquirer reads — reproduces this file's own worst
case. A boolean that nothing can clear from the inside refuses a tree that is
perfectly clean, and the only way out a human can see is to delete the lock
file: **the guard that trains its own user to remove it**, four paragraphs up,
arriving inside the code written to extend it. So the record carries a
BASELINE — what `git status` said at the moment the lock was taken — and the
refusal is a comparison, not a flag. A holder killed between mutations leaves a
tree that matches its own baseline, and that costs nobody a keystroke. The
marker clears itself by the tree being right, which is a condition no human can
be tempted to fake.
"""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCK_PATH = ROOT / ".gate_mutation.lock"
# 🆕 228 — the baseline bytes of files that were ALREADY dirty when a gate started.
# Gitignored, beside the lock, for `scripts/_scope_gate_mutant.py`'s reason one line
# further on in `.gitignore`: belt-and-braces for a run killed between two statements.
# 🔴 IT EXISTS BECAUSE `git checkout --` IS NOT A RECOVERY FOR EVERY FILE. A gate
# mutates TRACKED files; a tracked file may carry the developer's own uncommitted work,
# and today a SIGKILL mid-sweep destroys that work with no copy anywhere — the
# originals lived in the dead process's `ORIGINALS` dict. Clean-at-baseline files are
# recoverable from git and are not copied here.
STASH_DIR = ROOT / ".gate_mutation.d"
# 🆕 228 — and what `tree_quiet.py --recover` found immediately BEFORE it put anything
# back. A separate directory rather than a subdirectory of the stash, because `_stash`
# and `settled` both clear that one and a safety net a later run deletes is not one.
UNDO_DIR = ROOT / ".gate_mutation.undo"

# 🔴 THE REFUSAL MARKER IS PART OF THE CONTRACT, not decoration. `mutation_lock_gate.py`
# discriminates "refused because the lock was held" from "crashed for some other reason"
# on this exact string, the way scope_gate.py's REPORT_MARKER discriminates a catch from
# a harness failure (scope_gate §_mutant_verdict). Changing it without changing that gate
# turns every control there into a green line about nothing.
REFUSAL = "🔴 GATE_LOCK_HELD"
REFUSAL_EXIT = 2          # not 1: a lock refusal is not a finding, and CI must not read it as one

# 🆕 228 — THE SECOND AND THIRD MARKERS, AND THEY ARE NOT THE FIRST ONE REUSED.
# `GATE_LOCK_HELD` means *somebody else is mutating right now*; these two mean *the last
# mutator never finished* and *a reader looked while one was in flight*. Three causes,
# three strings, three exit codes — 181's `executed` distinction applied to a refusal
# rather than to a mutant: a caller that cannot tell them apart reports the first when
# it means the third, and `mutation_lock_gate.py` discriminates its controls on exactly
# these tokens.
UNRESTORED = "🔴 GATE_TREE_UNRESTORED"
UNRESTORED_EXIT = 3
MUTATING = "🔴 GATE_TREE_MUTATING"
MUTATING_EXIT = 2         # the reader's refusal is the lock's refusal, seen from outside

QUIET = "🟢 GATE_TREE_QUIET"

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


# ── the baseline: what `git status` said before anybody mutated anything ───────────────

def _git(*args: str) -> str | None:
    """git, or None when there is no usable repository. 🔴 THE `None` IS A THIRD ANSWER
    AND IT IS PRINTED, not folded into 'clean'. The npm tarball has no `.git`, and a
    reader that silently calls an unmeasurable tree quiet is 217 §20's shape — a question
    nobody can answer and a question answered 'fine' look identical in a green run."""
    try:
        p = subprocess.run(("git",) + args, cwd=str(ROOT), capture_output=True,
                           text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    return p.stdout if p.returncode == 0 else None


def _digest(rel: str) -> str:
    """The file's content, or a token for its absence. A gate's `rename` control MOVES a
    tracked path aside, so 'not there' is a state this has to be able to name."""
    p = ROOT / rel
    try:
        return hashlib.sha256(p.read_bytes()).hexdigest()[:16]
    except (OSError, IsADirectoryError):
        return "-absent-"


def _dirty() -> dict[str, str] | None:
    """{path: digest} for everything `git status` is not silent about. None if unmeasurable.

    🔴 PORCELAIN AND NOT A TRACKED-FILE SWEEP, for cost and for precision. Hashing all
    349 tracked files at every acquire buys nothing: a file git calls unmodified cannot
    be the damage, because the damage is by definition a difference git can see.
    """
    out = _git("status", "--porcelain", "-z", "--no-renames")
    if out is None:
        return None
    seen: dict[str, str] = {}
    for entry in out.split("\0"):
        if len(entry) < 4:
            continue
        seen[entry[3:]] = _digest(entry[3:])
    return seen


def diverged(baseline: dict[str, str] | None) -> list[str]:
    """What changed since the baseline was taken. The whole refusal is this comparison.

    🔴 A PATH IS DAMAGE WHEN THE BASELINE DOES NOT ALREADY ACCOUNT FOR IT, and that is
    strictly narrower than 'the tree is dirty'. The dirty-tree version of this check
    refuses every session in which anybody is working, which is every session — so it
    would be turned off in a week, and a guard that gets turned off is 227 §2's skip
    flag with a different name.
    """
    if baseline is None:
        return []
    now = _dirty()
    if now is None:
        return []
    return sorted(p for p, d in now.items() if baseline.get(p) != d)


def _stash(paths: dict[str, str]) -> dict[str, str]:
    """Copy the bytes of already-dirty files aside. {path: stash filename}.

    Only the dirty ones: a file git calls unmodified is recoverable from git, and copying
    the whole tree at every gate run is the kind of cost that gets a guard removed.

    ── 🆕 277 §4 — THE CLEAR CAME FIRST, AND THE STASH IS THE ONLY COPY ───────────────
    🔴 THIS FUNCTION USED TO `rmtree(STASH_DIR)` BEFORE COPYING ANYTHING INTO IT. Between
    that call and the last `copyfile` the only copy of a previously-dirty file's bytes did
    not exist, and the record naming it had already been truncated one frame up. A kill in
    that window takes a developer's uncommitted work with it and leaves `--recover` nothing
    to put back — `git checkout --` restores the COMMITTED bytes, which is precisely not
    what those files hold. This module's own docstring says the sentence three hundred
    lines down (*it must not re-stash, because `_stash` clears `STASH_DIR` and the stash is
    the only copy of the bytes*) and says it about `--recover` rather than about here.
    🔴 IT IS ALSO THE ONLY SUCH WINDOW IN THIS MACHINERY, WHICH IS WHY THE ROW IT CLOSES
    IS NOT THE ROW THAT WAS OPEN. `mutating-gate-writes-not-atomic` (272) priced a torn
    MUTANT, and a torn mutant is recoverable byte-for-byte on both routes today — from git
    if the file was clean when the lock was taken, from this stash if it was not, and
    `tree_quiet.py --selftest` drives both. Per-file atomicity there buys no recoverability
    and costs signal: a half-written file does not parse and an atomically-written one is a
    valid module that behaves like a blinded instrument.
    🔴 THE FIX IS AN ORDERING AND NOT A MECHANISM. Copy first, sweep the stale entries
    after, so at every instant the bytes exist under one name or the other. A name is the
    sha256 of the path, so a re-stash of the same path OVERWRITES its own entry rather
    than colliding — and `copyfile` truncating its destination is the one write here that
    genuinely wants to be atomic, because that destination IS the only copy.
    """
    keep: dict[str, str] = {}
    try:
        STASH_DIR.mkdir(parents=True, exist_ok=True)
    except OSError:
        return keep
    wanted = {hashlib.sha256(rel.encode("utf-8")).hexdigest()[:24] for rel in paths}
    for rel in paths:
        src = ROOT / rel
        if not src.is_file():
            continue
        name = hashlib.sha256(rel.encode("utf-8")).hexdigest()[:24]
        tmp = STASH_DIR / f"{name}.new"
        try:
            shutil.copyfile(str(src), str(tmp))
            os.replace(str(tmp), str(STASH_DIR / name))
        except OSError:
            continue
        keep[rel] = name
    # 🔴 THE SWEEP IS LAST, AND IT IS SCOPED TO THE POPULATION RATHER THAN TO `keep`. The
    # first draft swept everything not in `keep.values()` and its own fixture refused it:
    # when a copy FAILS, that path is absent from `keep`, so the sweep deleted the previous
    # holder's copy of exactly the file the copy had just failed to replace — the window
    # this function is being edited to close, re-opened four lines below the comment
    # explaining it. What is stale is an entry for a path this run is not tracking at all.
    try:
        for f in STASH_DIR.iterdir():
            if f.name not in wanted:
                f.unlink(missing_ok=True)
    except OSError:
        pass
    return keep


def read_record() -> dict | None:
    """The record as the last acquirer left it, or None. Never raises — a lock file that
    is empty, truncated or half-written is 'no claim', which is the same answer a fresh
    clone gives and needs no separate branch."""
    try:
        rec = json.loads(LOCK_PATH.read_text(encoding="utf-8", errors="replace").strip())
        return rec if isinstance(rec, dict) else None
    except (OSError, ValueError):
        return None


def _unrestored_report(rec: dict, damage: list[str]) -> str:
    """🔴 IT REPORTS THE COMPARISON AND NOT A CAUSE, AND THE FIRST DRAFT DID NOT.

    That draft said "it was killed mid-sweep". Then it fired on this session's own tree,
    where `instrument_gate.py` had run to completion and the author had edited two
    unrelated files while it held the lock — a refusal with exactly the right shape,
    naming a cause that had not happened. 226 §3's finding, for the third session running,
    inside the code written to close 227 §7.2.

    What the evidence actually supports is *these paths moved while a gate held the lock*.
    Which of the two writers moved them is not knowable from here, and BOTH are the
    hazard: anything cut out of this tree now is cut out of a tree that changed under a
    mutating gate. So the report names the observation and lists the causes.
    """
    who = f"{rec.get('gate', '?')} (pid {rec.get('pid', '?')})"
    stash = rec.get("stash") or {}
    lines = [f"{UNRESTORED} {len(damage)} path(s) moved while {who} held the lock, and "
             f"they are not what it found when it started:"]
    for rel in damage:
        how = ("your version is copied in .gate_mutation.d — `--recover` restores that"
               if rel in stash else "it was unmodified when the gate started — "
                                    "`--recover` checks it out of git")
        lines.append(f"     {rel}   ({how})")
    lines.append("   Either the gate was killed before it could put them back, or "
                 "something else wrote to")
    lines.append("   the tree while it ran. Both make anything you cut out of this tree "
                 "untrustworthy (227 §7.2),")
    lines.append("   and a gate's mutation left behind reads as a FINDING rather than as "
                 "damage (224 §6.6).")
    lines.append("   Look first:  git diff -- " + " ".join(damage[:4])
                 + (" …" if len(damage) > 4 else ""))
    lines.append("   Put back:    python3 scripts/tree_quiet.py --recover")
    lines.append("   Keep, and stop asking:  python3 scripts/tree_quiet.py --accept")
    return "\n".join(lines)


def acquire(gate: str, repairing: bool = False) -> None:
    """Take the tree-mutation lock or refuse. Called by every gate that rewrites a
    TRACKED file, before it rewrites one.

    The call goes at the TOP of `main()`, above the self-check. A gate's self-check
    reads the tree, and under a concurrent mutation it would be reading somebody else's
    mutant — so a self-check that ran first could report a defect in this file that is
    really a defect in the scheduling.

    🆕 228 — AND IT NOW READS THE PREVIOUS RECORD BEFORE IT OVERWRITES ITS OWN. The
    order is the whole point: `os.ftruncate` two paragraphs down is what destroyed the
    only evidence a killed predecessor ever left.

    🆕 228 — `repairing=True` IS ONE CALLER AND IT IS NOT AN OPT-OUT. `tree_quiet.py
    --recover` rewrites tracked files, so it must hold the lock like any other mutator —
    but it is the one caller that cannot pass through the three steps below. It must not
    REFUSE on the unrestored record, because repairing that record is why it was run; it
    must not OVERWRITE the record, because the record names the damage; and it must not
    re-stash, because `_stash` clears `STASH_DIR` and the stash is the only copy of the
    bytes it is about to put back. So `repairing` takes the flock and nothing else. The
    difference from `BREAKPOINT_GATE_NOLOCK`, deleted three paragraphs into this module,
    is that this path takes MORE lock and less licence: it cannot run beside a mutator,
    and every other caller's refusal is untouched.
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

    if repairing:
        _FD = fd
        return

    # 🆕 228 — the predecessor's claim, read while we hold the lock and BEFORE the
    # truncate. An open record whose baseline still matches the tree is a holder that
    # died with its hands empty; it costs nobody anything and is not mentioned.
    prior = read_record()
    if prior is not None and not prior.get("settled", True):
        damage = diverged(prior.get("baseline"))
        if damage:
            os.close(fd)                      # releases the flock — we are not starting
            print(_unrestored_report(prior, damage))
            sys.exit(UNRESTORED_EXIT)

    baseline = _dirty()
    os.ftruncate(fd, 0)
    os.write(fd, json.dumps({
        "gate": gate, "pid": os.getpid(), "started": int(time.time()),
        "settled": False,
        "baseline": baseline,
        "stash": _stash(baseline) if baseline else {},
    }).encode("utf-8"))
    os.fsync(fd)
    _FD = fd


def settled(gate: str) -> list[str]:
    """Close the record, and refuse to close it over a tree that moved. Returns the
    divergence — empty on the healthy path.

    🔴 THIS IS A LINE AT THE END OF `main()` AND NOT AN `atexit`, and the reason is
    ordering rather than taste. Every mutating gate registers its own `_restore` at
    import time; an `atexit` registered here inside `acquire()` runs BEFORE that one
    (LIFO), so it would close the record over a tree the gate had not put back yet, and
    a kill landing in between would leave a settled record beside a live mutant — the
    exact state this function exists to make impossible.

    🔴 AND IT VERIFIES RATHER THAN ASSERTS. A gate that reaches its last line having
    left the tree changed has still left the tree changed; `control_gate.py` already
    computes that list for itself under `CONTROL_GATE_UNRESTORED`, and this is the same
    question asked from the lock's side, where the answer survives the process.
    """
    if _FD is None:
        return []
    rec = read_record() or {}
    damage = diverged(rec.get("baseline"))
    if damage:
        # 🔴 A DIFFERENT SENTENCE FROM `_unrestored_report`'s, BECAUSE MORE IS KNOWN HERE.
        # At this line the gate DID reach its own end, so "killed mid-sweep" is not one of
        # the two causes — it either failed to restore, or something else wrote to the
        # tree while it ran. Reusing the acquire-side wording would name a cause this
        # caller can rule out.
        print(f"{UNRESTORED} {gate} reached its own end with {len(damage)} path(s) moved "
              f"since it started: {', '.join(damage)}")
        print("   It was NOT killed — so either its restore is incomplete, or something "
              "else wrote to the")
        print("   tree while it held the lock. The record stays OPEN on purpose: the next "
              "gate must not")
        print("   acquire a free lock over a tree nobody has explained.")
        return damage
    rec["settled"] = True
    try:
        os.ftruncate(_FD, 0)
        os.pwrite(_FD, json.dumps(rec).encode("utf-8"), 0)
        os.fsync(_FD)
        shutil.rmtree(STASH_DIR, ignore_errors=True)
    except OSError:
        pass
    return []


def run_and_settle(gate: str, main) -> int:
    """`sys.exit(run_and_settle("x_gate.py", main))` — the one line every locking gate ends on.

    🔴 A WRAPPER AND NOT A CALL AT THE BOTTOM OF `main()`, because `main()` has between two
    and six `return` statements in each of these files and a line at the bottom of one is a
    line the early refusals walk past. The record would then close on the green path only —
    open records piling up behind exactly the runs that went wrong.

    🔴 AND IT RAISES THE EXIT CODE. A gate that finishes having left the tree changed has
    produced a measurement nobody should trust, and reporting that in prose beside `exit 0`
    is 227 §15 again: a real signal, answering a smaller question than the reader thinks.
    """
    code = 1                       # an exception on the way out is not a pass
    try:
        code = main()
        return code
    finally:
        if settled(gate) and code == 0:
            print(f"   ({gate} returned 0, and this is why that is not the answer.)")
            sys.exit(1)            # a raise in `finally` beats the `return` above it


# ── the reader's side: the question 227 §7.2 had no way to ask ─────────────────────────

def inspect() -> tuple[str, str]:
    """(marker, detail) for a reader that is about to read the tree. Takes no lock, holds
    nothing, mutates nothing — it must be safe to call from inside a git hook while four
    gates are queued behind it.

    🔴 IT PROBES THE FLOCK AND RELEASES IT IN THE SAME BREATH. Acquiring to ask whether
    the lock is free would make every reader a writer of the record, and a reader that
    can starve a gate is worse than the gate running unobserved.
    """
    if not LOCK_PATH.exists():
        return QUIET, "no gate has ever taken the lock in this tree"
    if _FD is not None:
        # 🔴 WE ARE THE HOLDER, AND THE PROBE CANNOT TELL. `flock` conflicts are per OPEN
        # FILE DESCRIPTION, not per process: a second `open()` here takes LOCK_SH against
        # our OWN LOCK_EX and fails, so the naive probe reports `tree_quiet.py --recover`
        # as an intruder mid-recovery — a refusal with the right shape naming the wrong
        # process, which is 226 §3's finding for the third session running. Asked from
        # inside the holder, the honest answer is that the holder is us.
        return QUIET, "this process is the one holding the lock"
    try:
        fd = os.open(LOCK_PATH, os.O_RDWR)
    except OSError:
        return QUIET, "the lock file is unreadable, so no gate can be holding it"
    held = False
    try:
        # 🔴 SHARED AND NOT EXCLUSIVE. A shared probe fails exactly when a MUTATOR holds
        # the exclusive lock, and succeeds when another READER is probing at the same
        # instant. An exclusive probe would have two readers refusing each other, which
        # is a red about the observers and not about the tree.
        fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
        fcntl.flock(fd, fcntl.LOCK_UN)
    except OSError:
        held = True
    who = _holder(fd) if held else ""
    os.close(fd)
    if held:
        return MUTATING, (f"{who} is rewriting tracked files RIGHT NOW. Anything you read "
                          f"out of this tree — a diff, a patch, an `add` — can carry its "
                          f"mutation into a deliverable (227 §7.2).")
    rec = read_record()
    if rec is None or rec.get("settled", True):
        return QUIET, "no mutation is in flight and the last one closed its record"
    if rec.get("baseline") is None:
        # 🔴 THE THIRD ANSWER, SAID OUT LOUD. An open record with no baseline behind it
        # cannot be compared to anything, and calling that QUIET would be this file
        # claiming a tree it never measured.
        return QUIET, (f"{rec.get('gate', 'a gate')} left its record open and there was no "
                       f"usable git repository to take a baseline from — this reader has "
                       f"NO CLAIM about the tree, rather than a clean one")
    damage = diverged(rec.get("baseline"))
    if damage:
        return UNRESTORED, _unrestored_report(rec, damage)
    return QUIET, (f"{rec.get('gate', 'a gate')} was killed before it could close its "
                   f"record, but the tree still matches what it found — nothing to do")
