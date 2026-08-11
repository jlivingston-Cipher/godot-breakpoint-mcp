#!/usr/bin/env python3
"""tree_quiet.py — session 228. THE QUESTION A READER OF THIS TREE HAD NO WAY TO ASK.

227 §7.2 is the defect. `control_gate.py` was mid-sweep in the container when a session
cut its patch with `git diff`, and the patch carried `npm 0.0.0` in the README badge — a
live control, in flight, inside a deliverable that went to a device. It was caught by a
human noticing the patch had NINE files in it and not eight. That is not a control; that
is somebody counting.

`_gate_lock.py` had the answer the whole time. `mutation_lock_gate.py` derives every gate
that MUTATES this tree and proves each one refuses to start beside another — and the
population it governs is mutators. A `git diff`, a `git add`, a patch cut, a release cut:
every one of them reads a tree that a gate may be halfway through rewriting, and until
this file none of them had a question to put to the lock.

🔴 SO THE MECHANISM IS NOT NEW AND THAT IS THE POINT. 227's closing finding was that a
green self-test is a claim about the READER and reads like a claim about the SUBJECT.
This file's twin failure would be a `--selftest` that proves the comparison works, run in
CI, believed to mean "readers are safe" — while no reader calls it. The controls in
`mutation_lock_gate.py` spawn this file for real against a real held lock, and
`.githooks/pre-commit` is where a human's own `git commit` walks into it.

── WHAT IT MUST STILL ADMIT ───────────────────────────────────────────────────────────

🔴 WRITTEN BEFORE THE CODE, FOR 227 §17's REASON. The test for a fix is not "does it
catch the thing that went wrong" — it is "does it still admit the thing that must go
right", and 227's MAJOR arm would have refused the release it existed to unblock because
that table was written after. Every row below is a case in `_selftest`.

  ADMIT   a fresh clone — no lock file has ever been written
  ADMIT   a settled record — the last gate finished and closed it
  ADMIT   a developer's ordinary uncommitted work, with no gate involved
  ADMIT   an OPEN record whose baseline still matches the tree (killed between mutations)
  ADMIT   a file the developer dirtied that was ALREADY dirty when the gate started
  REFUSE  an open record with a path that does not match its baseline      [UNRESTORED]
  REFUSE  a tree whose lock is held by a live mutator right now            [MUTATING]
  NEITHER an open record with no baseline behind it — no claim, said out loud

🔴 THE THIRD ROW IS THE ONE THAT KILLS THE OBVIOUS IMPLEMENTATION. "Refuse while the tree
is dirty" catches 227 §7.2 perfectly and refuses every session in which anybody is
working. It would last a week, and the week after that it would have a `--force`.

── RECOVERY IS A RESTORE, NEVER A DELETION ────────────────────────────────────────────

`_gate_lock.py`'s docstring rules out any guard whose escape is "remove the file", so
`--recover` puts the bytes back: from `.gate_mutation.d` for files that were already
dirty when the gate started, and from git for the ones that were clean. `--accept`
exists for the case the comparison cannot distinguish — you edited something yourself
while a gate was running — and it re-baselines rather than clearing, after printing every
path it is about to stop asking about.

🔴 AND `--recover` COPIES BEFORE IT WRITES. The comparison knows a path moved; it does
not know WHO moved it, and this session's own tree was the counterexample within the hour
(see `recover()`). So everything it is about to overwrite lands in `.gate_mutation.undo/`
first. A repair that can destroy the thing it was run to protect is not a repair.

Run:  python3 scripts/tree_quiet.py             # 🟢 / 🔴, exit 0 / 2 / 3
      python3 scripts/tree_quiet.py --recover
      python3 scripts/tree_quiet.py --selftest
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _gate_lock  # noqa: E402
from _gate_lock import (  # noqa: E402
    LOCK_PATH, MUTATING, MUTATING_EXIT, QUIET, ROOT, STASH_DIR, UNRESTORED,
    UNDO_DIR, UNRESTORED_EXIT, acquire, diverged, inspect, read_record,
    run_and_settle,
)

EXIT = {QUIET: 0, MUTATING: MUTATING_EXIT, UNRESTORED: UNRESTORED_EXIT}


# ── recovery ───────────────────────────────────────────────────────────────────────────

def recover() -> int:
    """🔴 THIS FUNCTION IS A TREE MUTATOR AND `mutation_lock_gate.py` SAID SO FIRST. The
    deriver classified this file UNGUARDED the moment it existed — eight unconfined
    writes, no `acquire`. It was right twice over: `--recover` rewrites tracked files,
    and a recovery running beside a live gate would put back the very bytes that gate is
    mid-mutation on, destroying its own restore. The lock is taken in `repairing` mode
    (see `_gate_lock.acquire`) — more exclusion, not less."""
    # 🔴 THE LOCK COMES BEFORE THE QUESTION, NOT AFTER IT. The first draft asked
    # `inspect()` first and returned 0 when a mutator was live — a recovery that declines
    # for the right reason and reports success, and a pre-check that is a race rather
    # than an exclusion. `acquire` IS the exclusion, and while any gate is running the
    # record is open by construction, so this path always reaches it.
    rec = read_record()
    if rec is None or rec.get("settled", True):
        print(f"TREE_QUIET --recover  ·  nothing to recover — {inspect()[1]}")
        return 0
    acquire("tree_quiet.py --recover", repairing=True)
    rec = read_record() or {}                 # re-read under the lock
    stash = rec.get("stash") or {}
    damage = diverged(rec.get("baseline"))
    if not damage:
        print("TREE_QUIET --recover  ·  nothing to recover — the record is open but the "
              "tree already matches the baseline it was taken against")
        return 0
    # 🔴 RECOVERY IS NOT ALLOWED TO BE THE DESTRUCTIVE STEP, and the first draft was. It
    # `git checkout --`s any path with no stash entry, on the theory that such a path was
    # clean when the gate started and therefore holds only the gate's mutation. That
    # theory failed on this session's own tree: two files were edited BY HAND while a gate
    # held the lock, and `--recover` would have discarded that work to undo a mutation
    # nobody had made. The comparison cannot tell the two apart (see
    # `_gate_lock._unrestored_report`), so the current bytes are copied aside FIRST and
    # every recovery is reversible.
    saved: dict[str, Path] = {}
    try:
        UNDO_DIR.mkdir(parents=True, exist_ok=True)
        for rel in damage:
            live = ROOT / rel
            if live.is_file():
                dst = UNDO_DIR / rel.replace("/", "%2F")
                dst.write_bytes(live.read_bytes())
                saved[rel] = dst
    except OSError:
        pass

    from_git, restored, failed = [], [], []
    for rel in damage:
        name = stash.get(rel)
        src = STASH_DIR / name if name else None
        if src is not None and src.is_file():
            try:
                (ROOT / rel).write_bytes(src.read_bytes())
                restored.append(rel)
            except OSError as exc:
                failed.append(f"{rel}: {exc}")
        else:
            from_git.append(rel)
    if from_git:
        p = subprocess.run(["git", "checkout", "--", *from_git], cwd=str(ROOT),
                           capture_output=True, text=True)
        (restored if p.returncode == 0 else failed).extend(
            from_git if p.returncode == 0 else [f"git checkout: {p.stderr.strip()}"])
    for rel in sorted(restored):
        print(f"  🟢 restored  {rel}")
    for line in failed:
        print(f"  🔴 FAILED    {line}")
    # 🔴 RE-ASK RATHER THAN ASSUME. A recovery that reports success without re-reading
    # the tree is the same claim-about-the-reader this whole file is about. 🔴 AND IT
    # RE-DERIVES rather than calling `inspect()`: we hold the lock, so `inspect()` would
    # answer about the holder instead of about the tree.
    if saved:
        print(f"   what was there before this ran is copied in {UNDO_DIR.name}/ — "
              f"nothing here is one-way")
    left = diverged(rec.get("baseline"))
    print(f"TREE_QUIET --recover  ·  {UNRESTORED if left else QUIET}")
    if left:
        print(f"   still off the baseline: {', '.join(left)}")
        return UNRESTORED_EXIT
    print("   the tree matches the baseline the gate was measured against")
    return 0


def accept() -> int:
    marker, _ = inspect()
    if marker != UNRESTORED:
        print("TREE_QUIET --accept  ·  nothing is being refused; there is nothing to accept")
        return 0
    rec = read_record() or {}
    damage = diverged(rec.get("baseline"))
    acquire("tree_quiet.py --accept", repairing=True)
    print("TREE_QUIET --accept  ·  these path(s) stop being treated as a killed gate's "
          "damage. Nothing is restored and nothing is deleted:")
    for rel in damage:
        print(f"     {rel}")
    # 🔴 RE-BASELINE, NOT `settled = True` OVER THE OLD ONE. Closing the record while its
    # baseline still describes a tree that no longer exists leaves the next comparison
    # reading a claim about the past — and `settled()` would immediately re-open it. What
    # the human accepted is the tree AS IT IS, so that is what gets written down.
    rec = {"gate": rec.get("gate", "?") + " (accepted by hand)", "pid": os.getpid(),
           "settled": True, "baseline": _gate_lock._dirty(), "stash": {}}
    LOCK_PATH.write_text(json.dumps(rec), encoding="utf-8")
    print("   Record re-baselined and closed. If one of these WAS a gate's mutation, it "
          "is now yours.")
    return 0


# ── the hook installer, and the one thing this repository cannot gate ──────────────────

HOOK_DIR = ROOT / ".githooks"


def hook_state() -> tuple[bool, str]:
    """Is the tracked hook the one git would run? A local fact, and not one CI can check.

    🔴 THIS IS THE DECLARED GAP AND IT IS PRINTED RATHER THAN ASSUMED. `core.hooksPath`
    lives in `.git/config`, which is not tracked and cannot be shipped; a fresh clone runs
    no hook until somebody says so. So the hook's CORRECTNESS is proved by a control in
    `mutation_lock_gate.py` — it is spawned against a real held lock and must refuse —
    and its INSTALLATION is reported every time a mutator takes the lock. 224 §3.2's rule
    is that an exemption a gate cannot verify is a promise; the honest reading here is
    that this half is a promise, so it is labelled one instead of counted as coverage.
    """
    p = subprocess.run(["git", "config", "--get", "core.hooksPath"], cwd=str(ROOT),
                       capture_output=True, text=True)
    got = p.stdout.strip()
    if got == ".githooks":
        return True, "core.hooksPath is .githooks — `git commit` consults this reader"
    return False, (f"core.hooksPath is {got or 'unset'} — `git commit` does NOT consult "
                   f"this reader. Install: python3 scripts/tree_quiet.py --install-hook")


def install_hook() -> int:
    if not (HOOK_DIR / "pre-commit").exists():
        print("🔴 TREE_QUIET --install-hook  ·  .githooks/pre-commit is not in the tree")
        return 1
    p = subprocess.run(["git", "config", "core.hooksPath", ".githooks"], cwd=str(ROOT),
                       capture_output=True, text=True)
    if p.returncode != 0:
        print(f"🔴 TREE_QUIET --install-hook  ·  {p.stderr.strip()}")
        return 1
    ok, why = hook_state()
    print(f"TREE_QUIET --install-hook  ·  {'🟢' if ok else '🔴'} {why}")
    return 0 if ok else 1


# ── the selftest: the table above, every row ───────────────────────────────────────────

def _probe(tree: Path, args: list[str] | None = None) -> tuple[int, str]:
    """Run this file inside a throwaway repository. 🔴 A SUBPROCESS AND NOT AN IMPORT:
    `_gate_lock.ROOT` is resolved at import time, so an in-process fixture would be
    asking about THIS tree while claiming to ask about that one."""
    env = dict(os.environ, GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_SYSTEM="/dev/null")
    p = subprocess.run([sys.executable, str(tree / "scripts" / "tree_quiet.py"),
                        *(args or [])], capture_output=True, text=True, timeout=120, env=env)
    return p.returncode, p.stdout + p.stderr


def _fixture(dirty: dict[str, str] | None = None,
             record: dict | None = None) -> Path:
    """A real git repository with this reader in it, one commit deep."""
    d = Path(tempfile.mkdtemp(prefix="tree_quiet_"))
    (d / "scripts").mkdir()
    for name in ("_gate_lock.py", "tree_quiet.py"):
        (d / "scripts" / name).write_bytes((ROOT / "scripts" / name).read_bytes())
    (d / "a.txt").write_text("committed\n")
    (d / "b.txt").write_text("committed\n")
    # 🔴 THE FIXTURE CARRIES THE REAL TREE'S IGNORES, and the first draft did not. Without
    # them the lock file itself shows up in `git status` as an untracked path, every row
    # diverges from its own baseline, and the table goes red for a reason that has nothing
    # to do with the rule under test — a harness failure wearing a finding's clothes
    # (181's `executed`, one layer out). Read from the tree so the two cannot drift.
    (d / ".gitignore").write_text("\n".join(
        ln for ln in (ROOT / ".gitignore").read_text().splitlines()
        if ln.strip().startswith(".gate_mutation")) + "\n")
    env = dict(os.environ, GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_SYSTEM="/dev/null",
               GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t",
               GIT_COMMITTER_EMAIL="t@t")
    for cmd in (["init", "-q"], ["add", "-A"], ["commit", "-qm", "base"]):
        subprocess.run(["git", *cmd], cwd=str(d), capture_output=True, env=env)
    for rel, text in (dirty or {}).items():
        (d / rel).write_text(text)
    if record is not None:
        (d / ".gate_mutation.lock").write_text(json.dumps(record))
    return d


def _baseline_of(tree: Path) -> dict[str, str]:
    """What `_gate_lock._dirty()` would say about a fixture, computed by the real code
    against that fixture's root — not re-implemented here, for 216's reason: a second
    spelling of a rule is a second rule."""
    src = ("import sys, json; sys.path.insert(0, 'scripts'); import _gate_lock as g; "
           "print(json.dumps(g._dirty()))")
    p = subprocess.run([sys.executable, "-c", src], cwd=str(tree),
                       capture_output=True, text=True)
    return json.loads(p.stdout)


def _selftest() -> int:
    print("TREE_QUIET selftest — the ADMIT/REFUSE table, each row on a real repository")
    rows: list[tuple[str, Path, str, int]] = []

    t = _fixture()
    rows.append(("a fresh clone, no lock file ever written", t, QUIET, 0))

    t = _fixture(record={"gate": "g", "pid": 1, "settled": True, "baseline": {}})
    rows.append(("a SETTLED record — the last gate closed it", t, QUIET, 0))

    t = _fixture(dirty={"a.txt": "my own work\n"})
    rows.append(("ordinary uncommitted work, no gate involved", t, QUIET, 0))

    # An OPEN record whose baseline was taken with the tree exactly as it is now.
    t = _fixture(dirty={"a.txt": "my own work\n"})
    (t / ".gate_mutation.lock").write_text(json.dumps(
        {"gate": "control_gate.py", "pid": 999999, "settled": False,
         "baseline": _baseline_of(t), "stash": {}}))
    rows.append(("an OPEN record whose baseline still matches", t, QUIET, 0))

    # The defect: a gate mutated b.txt and was killed before restoring it.
    t = _fixture(dirty={"a.txt": "my own work\n"})
    base = _baseline_of(t)
    (t / "b.txt").write_text("npm 0.0.0\n")
    (t / ".gate_mutation.lock").write_text(json.dumps(
        {"gate": "control_gate.py", "pid": 999999, "settled": False,
         "baseline": base, "stash": {}}))
    rows.append(("an OPEN record with a path off its baseline", t, UNRESTORED,
                 UNRESTORED_EXIT))

    # 🔴 THE ROW THE DIRTY-TREE IMPLEMENTATION FAILS. The developer's own file is dirty
    # in the baseline AND dirty now, with the same bytes. It must not be damage.
    t = _fixture(dirty={"a.txt": "my own work\n", "b.txt": "also mine\n"})
    (t / ".gate_mutation.lock").write_text(json.dumps(
        {"gate": "control_gate.py", "pid": 999999, "settled": False,
         "baseline": _baseline_of(t), "stash": {}}))
    rows.append(("two files dirty BEFORE the gate started", t, QUIET, 0))

    t = _fixture(record={"gate": "g", "pid": 1, "settled": False, "baseline": None})
    rows.append(("an OPEN record with no baseline — no claim", t, QUIET, 0))

    bad = 0
    for name, tree, want_marker, want_exit in rows:
        code, out = _probe(tree)
        ok = want_marker in out and code == want_exit
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {name:<52} exit={code} "
              f"{'' if ok else f'wanted {want_marker} / {want_exit} — got: ' + out.strip()[:200]}")

    # ── the live half: a HELD lock, from a process that is not us ──────────────────────
    t = _fixture()
    holder = subprocess.Popen(
        [sys.executable, "-c",
         "import sys, time; sys.path.insert(0, 'scripts'); import _gate_lock as g; "
         "g.acquire('fixture_gate.py'); time.sleep(30)"],
        cwd=str(t), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        for _ in range(100):                  # the child has to reach `acquire`
            if (t / ".gate_mutation.lock").exists() and _probe(t)[0] != 0:
                break
            __import__("time").sleep(0.05)
        code, out = _probe(t)
        ok = MUTATING in out and code == MUTATING_EXIT
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {'a lock HELD by a live mutator':<52} exit={code}")
    finally:
        holder.kill()
        holder.wait(timeout=30)

    # 🔴 AND THE SAME TREE, ONE INSTANT LATER. The holder was SIGKILLed above with the
    # tree untouched, so the record is open and the baseline still matches: the reader
    # must go back to green ON ITS OWN. This is the row that proves the marker is a
    # comparison and not a flag — a boolean would still be refusing here, and the only
    # way out a human could see would be deleting the lock file.
    code, out = _probe(t)
    ok = QUIET in out and code == 0
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'the same tree after the holder was SIGKILLed':<52} "
          f"exit={code}")

    # ── recovery puts bytes back, and it is checked by re-reading the tree ─────────────
    t = _fixture(dirty={"a.txt": "my own work\n"})
    base = _baseline_of(t)
    (t / "b.txt").write_text("npm 0.0.0\n")
    (t / ".gate_mutation.lock").write_text(json.dumps(
        {"gate": "control_gate.py", "pid": 999999, "settled": False,
         "baseline": base, "stash": {}}))
    code, out = _probe(t, ["--recover"])
    ok = (code == 0 and (t / "b.txt").read_text() == "committed\n"
          and (t / "a.txt").read_text() == "my own work\n")
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'--recover restores the mutant, not the developer':<52} "
          f"exit={code}")

    # 🔴 THE HALF `git checkout --` CANNOT DO. The gate mutated a file that was ALREADY
    # carrying the developer's uncommitted work. Today those bytes are gone with the
    # process; the stash is the only copy, and this row is the whole argument for it.
    t = _fixture(dirty={"a.txt": "my own work\n"})
    src = ("import sys; sys.path.insert(0, 'scripts'); import _gate_lock as g; "
           "g.acquire('fixture_gate.py'); "
           "open('a.txt', 'w').write('MUTANT\\n'); "
           "import os; os._exit(9)")               # SIGKILL's shape: no finally, no atexit
    subprocess.run([sys.executable, "-c", src], cwd=str(t), capture_output=True,
                   env=dict(os.environ, GIT_CONFIG_GLOBAL="/dev/null"))
    code, out = _probe(t, ["--recover"])
    ok = code == 0 and (t / "a.txt").read_text() == "my own work\n"
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'--recover returns UNCOMMITTED work a gate ate':<52} "
          f"exit={code} a.txt={(t / 'a.txt').read_text().strip()!r}")

    # 🔴 `repairing` IS MORE EXCLUSION AND NOT LESS, AND THIS IS THE ROW THAT SAYS SO.
    # `--recover` skips the unrestored refusal; if it also skipped the LOCK it would put
    # bytes back underneath a gate that is mid-mutation and destroy that gate's own
    # restore — the flag would have become the opt-out `_gate_lock` deleted in 224.
    t = _fixture()
    holder = subprocess.Popen(
        [sys.executable, "-c",
         "import sys, time; sys.path.insert(0, 'scripts'); import _gate_lock as g; "
         "g.acquire('fixture_gate.py'); time.sleep(30)"],
        cwd=str(t), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        for _ in range(100):
            if (t / ".gate_mutation.lock").exists() and _probe(t)[0] != 0:
                break
            __import__("time").sleep(0.05)
        code, out = _probe(t, ["--recover"])
        ok = code == MUTATING_EXIT and "GATE_LOCK_HELD" in out
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {'--recover REFUSES beside a live mutator':<52} "
              f"exit={code}")
    finally:
        holder.kill()
        holder.wait(timeout=30)

    # --accept: the record closes, nothing is restored, and the reader goes quiet.
    t = _fixture(dirty={"a.txt": "my own work\n"})
    base = _baseline_of(t)
    (t / "b.txt").write_text("mine too, after the kill\n")
    (t / ".gate_mutation.lock").write_text(json.dumps(
        {"gate": "control_gate.py", "pid": 999999, "settled": False,
         "baseline": base, "stash": {}}))
    code, _ = _probe(t, ["--accept"])
    after, out = _probe(t)
    ok = (code == 0 and after == 0 and QUIET in out
          and (t / "b.txt").read_text() == "mine too, after the kill\n")
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'--accept re-baselines and restores nothing':<52} "
          f"exit={code} then={after}")

    print(f"TREE_QUIET selftest {'ok' if not bad else f'🔴 {bad} FAILED'} — "
          f"{len(rows) + 6} case(s)")
    return 1 if bad else 0


def main() -> int:
    if "--selftest" in sys.argv:
        return _selftest()
    if "--install-hook" in sys.argv:
        return install_hook()
    if "--recover" in sys.argv:
        return recover()
    if "--accept" in sys.argv:
        return accept()

    marker, detail = inspect()
    quiet_hook = "--hook" in sys.argv
    print(f"TREE_QUIET  {marker}")
    print(f"            {detail}")
    if marker == QUIET and not quiet_hook:
        ok, why = hook_state()
        print(f"            {'🟢' if ok else '🟡'} {why}")
    return EXIT[marker]


if __name__ == "__main__":
    # 🆕 228 — the reader's two MUTATING paths take the lock, so this file closes a record
    # like any other lock-taker. On the read path `acquire` was never called and
    # `run_and_settle` is a no-op — see `_gate_lock.settled`'s first line.
    raise SystemExit(run_and_settle("tree_quiet.py", main))
