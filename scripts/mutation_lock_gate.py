#!/usr/bin/env python3
"""Every gate that rewrites this tree takes the mutation lock — derived, not rostered.

🔴 224 §6.6 IS THE DEFECT. Two mutating gates run at once rewrote each other's files and
produced a red that was entirely the harness. `_gate_lock.py` is the fix. **This file is
the reason the fix cannot rot**, and it exists because 224 §7.6 named the shape one
instrument over: `SCANNED` in `spec_conformance.py` is a curated file set, and nothing
measures whether the five entries are the right five.

🔴 AND 224's OWN ROSTER WAS WRONG IN BOTH DIRECTIONS, which is the argument for deriving
this population rather than writing it down. 224 §6.6 named `instrument_gate.py`,
`control_gate.py` and `scope_gate.py`. Measured against the tree:

  * `floor_pin_gate.py` was OMITTED, and it rewrites FIVE tracked files — including
    `scripts/contract_check.py`, which `control_gate.py` also rewrites. **The one pair
    that collides on a single file is the pair the roster left out.**
  * `scope_gate.py` was INCLUDED, and it mutates nothing tracked — it writes only
    `scripts/_scope_gate_mutant.py`, a scratch copy. It still belongs under the lock, but
    for a different reason: it RUNS `contract_check.py` against the working tree, so a
    concurrent mutation by one of the other three makes its verdict a claim about a tree
    it did not construct.

A prose roster cannot tell those two cases apart because nobody re-derives prose. So the
population here is derived from the source: **every `scripts/*.py` carrying a write-shaped
call is a candidate**, and a candidate leaves the population only by being provably
confined to a `tempfile` directory — never by saying so.

THE EXCLUDED SCOPE IS PRINTED EVERY RUN, which is 223 §2's idiom and 222 §22's before it:
a gate that does not say what it declines to cover is a gate whose coverage nobody can
check. Two numbers here do that job — the scripts with no write at all, and the writes
proved to land in a temporary directory.

WHAT THIS GATE DOES NOT COVER. Node instruments under `host/scripts/` mutate nothing:
`instrument_gate.py` does the rewriting on their behalf and is itself in the population.
That is a claim about today's tree, so it is asserted rather than assumed — see
`_no_js_mutators()`.
"""

from __future__ import annotations

import ast
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _gate_lock import (MUTATING, MUTATING_EXIT, REFUSAL,  # noqa: E402,F401
                        REFUSAL_EXIT, acquire, run_and_settle)

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

# Governed by floor_pin_gate's SIZE_LEDGER. Raised deliberately when a mutator is added;
# a collapse here means the deriver stopped finding writes, not that the tree got safer.
GUARDED_FLOOR = 5

WRITE_CALLS = {"write_text", "write_bytes"}
# 🔴 THESE ARE MODULE FUNCTIONS AND THE MODULE IS PART OF THE MATCH. The first draft keyed
# on the attribute alone and reported sixteen `str.replace(old, new)` calls as filesystem
# mutations — `control_gate.py` came back with thirteen "unconfined write(s)" that were all
# string surgery. A finder that cannot tell `os.replace` from `"a".replace` reports the
# files it is loudest about, not the files that mutate.
MOVE_CALLS = {"move", "replace", "copy", "copy2", "copyfile", "rmtree"}
MOVE_MODULES = {"os", "shutil"}
TEMP_FACTORIES = {"mkdtemp", "TemporaryDirectory", "NamedTemporaryFile", "mkstemp"}


# ── the deriver ────────────────────────────────────────────────────────────────────────

def _base_name(node: ast.AST) -> str | None:
    """The root identifier a Path expression hangs off. `tmp / "src" / "a.js"` -> `tmp`.

    Deliberately shallow: it walks `/` operators and attribute access and stops. Anything
    it cannot resolve returns None and is treated as NOT temp-confined, which is the safe
    direction — an unresolvable write is reported as a mutator and a human looks at it.
    """
    while True:
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
            node = node.left
            continue
        if isinstance(node, ast.Call):
            node = node.func
            continue
        if isinstance(node, ast.Attribute):
            node = node.value
            continue
        return None


def _temp_roots(fn: ast.AST) -> set[str]:
    """Names inside one function that hold a temporary directory, or derive from one.

    Two hops, applied to a fixed point so `tmp = mkdtemp(); src = tmp / "src"` resolves.
    """
    roots: set[str] = set()
    for _ in range(4):                      # a fixed point; four is far past any real nesting
        grew = False
        for node in ast.walk(fn):
            if not isinstance(node, ast.Assign) or len(node.targets) != 1:
                continue
            tgt = node.targets[0]
            if not isinstance(tgt, ast.Name):
                continue
            names = {n.attr for n in ast.walk(node.value) if isinstance(n, ast.Attribute)}
            names |= {n.id for n in ast.walk(node.value) if isinstance(n, ast.Name)}
            if names & TEMP_FACTORIES or (names & roots):
                if tgt.id not in roots:
                    roots.add(tgt.id)
                    grew = True
        if not grew:
            break
    return roots


def write_sites(path: Path) -> tuple[list[str], list[str]]:
    """(unconfined, temp_confined) — one label per write-shaped call in the file."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    scopes: list[ast.AST] = [n for n in ast.walk(tree)
                             if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    scopes.append(tree)
    unconfined: list[str] = []
    confined: list[str] = []
    seen: set[int] = set()
    for scope in scopes:
        roots = _temp_roots(scope)
        for node in ast.walk(scope):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                continue
            attr = node.func.attr
            if attr in WRITE_CALLS:
                recv = node.func.value
            elif (attr in MOVE_CALLS and node.args
                  and _base_name(node.func.value) in MOVE_MODULES):
                recv = node.args[-1] if attr in {"move", "replace"} else node.args[0]
            else:
                continue
            if id(node) in seen:
                continue
            seen.add(id(node))
            base = _base_name(recv)
            label = f"{path.name}:{node.lineno} {attr}"
            (confined if base in roots else unconfined).append(label)
    return unconfined, confined


def calls(path: Path, name: str) -> bool:
    """The file calls `name(...)`. Read from the AST rather than by substring so a
    mention in a docstring or a comment cannot satisfy it — a gate whose evidence is a
    word in prose is the class 224 §3.2 deleted."""
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == name:
            return True
    return False


def acquires(path: Path) -> bool:
    return calls(path, "acquire")


def settles(path: Path) -> bool:
    """🆕 228 — the OTHER half of taking the lock, and it is derived for the same reason
    the first half is. `acquire()` opens a mutation record; `run_and_settle()` is what
    closes it, and a gate that opens one and never closes it leaves every LATER run
    comparing itself against a baseline nobody retired. A prose note asking the next
    author to remember is 224 §7.6's roster with a smaller population."""
    return calls(path, "run_and_settle")


def classify() -> tuple[dict[str, list[str]], int, int]:
    """Partition `scripts/*.py` into guarded / unguarded / temp-only, plus two scope numbers."""
    out: dict[str, list[str]] = {"guarded": [], "unguarded": [], "temp_only": []}
    no_write = 0
    temp_writes = 0
    for path in sorted(SCRIPTS.glob("*.py")):
        if path.name.startswith("_gate_lock"):
            continue                        # the lock itself writes only the lock file
        unconfined, confined = write_sites(path)
        temp_writes += len(confined)
        if not unconfined and not confined:
            no_write += 1
            continue
        if not unconfined:
            out["temp_only"].append(f"{path.name} — {len(confined)} write(s), all under tempfile")
            continue
        (out["guarded"] if acquires(path) else out["unguarded"]).append(
            f"{path.name} — {len(unconfined)} unconfined write(s): {', '.join(unconfined[:3])}"
            + (" …" if len(unconfined) > 3 else "")
        )
    return out, no_write, temp_writes


# ── the controls ───────────────────────────────────────────────────────────────────────

# 🆕 228 — HOW A MEMBER OF THE POPULATION IS INVOKED, WHICH IS NOT THE POPULATION.
# `tree_quiet.py` is guarded because `--recover` rewrites tracked files; run with no
# arguments it is a READER and refuses with a reader's marker. Spawning it bare and
# demanding `GATE_LOCK_HELD` measures the wrong entry point — 🔴 and it went red exactly
# that way before this table existed, which is why the table is a table and not a
# comment. Keys are checked against the derived population below, so a stale entry
# cannot make the roster look complete over a file that has left it.
MUTATING_ARGV: dict[str, list[str]] = {"tree_quiet.py": ["--recover"]}


def refuses_under_lock(script: Path) -> tuple[bool, str]:
    """Run it while this process holds the lock. It must refuse, fast, with the marker.

    This is the half a static read cannot do. `acquires()` proves the call is written;
    this proves it is REACHED — 197 §4's distinction, and the reason `_call_wiring` exists
    in three of the four gates below.
    """
    argv = MUTATING_ARGV.get(script.name, [])
    p = subprocess.run([sys.executable, str(script), *argv], capture_output=True,
                       text=True, cwd=str(ROOT), timeout=120)
    if p.returncode != REFUSAL_EXIT:
        return False, f"exit {p.returncode}, wanted {REFUSAL_EXIT} — it did not refuse"
    if REFUSAL not in p.stdout:
        return False, "refused without the marker — the exit code alone does not say why"
    return True, "refused" + (f" ({' '.join(argv)})" if argv else "")


def negative_control(script: Path, token: str = "acquire(",
                     predicate=None) -> tuple[bool, str]:
    """Delete the call line from a COPY and assert the classifier notices.

    🔴 Without this, `acquires()` returning True for every file — a predicate stuck on —
    would produce a fully green gate over a tree with no lock in it at all. That is the
    shape `positive_control_gate.mjs` exists for, asked of this file's own predicate.

    🆕 228 — PARAMETERISED, BECAUSE THE SECOND PREDICATE IS A SECOND PREDICATE. `settles`
    is as capable of being stuck on as `acquires` was, and a control that covers one of
    two identical readers covers one of two identical readers (196 §4).

    🔴 228 — AND THE MUTATION IS A RENAME NOW, NOT A DELETION, BECAUSE THE DELETION DID
    NOT COMPILE. `run_and_settle(...)` is the only statement in its `if __name__` block;
    dropping the line left a bare `if` and `ast.parse` raised. `calls()` would have had to
    swallow that to return an answer, and a swallowed SyntaxError is a classifier saying
    "no call here" about a file that is not a file — 181's `executed` distinction, in the
    control rather than in the subject. A rename keeps the mutant PARSEABLE, so a False
    from the predicate can only mean the predicate looked and did not find it.
    """
    predicate = predicate or acquires
    src = script.read_text(encoding="utf-8")
    renamed = src.replace(token, "NOT_" + token)
    if renamed == src:
        return False, f"no `{token}` call to rename — the mutation is not a mutation"
    tmp = Path(tempfile.mkdtemp(prefix="mutlock_neg_")) / script.name
    tmp.write_text(renamed, encoding="utf-8")
    try:
        still = predicate(tmp)
    except SyntaxError as exc:
        return False, f"the mutant did not parse ({exc.lineno}) — this row measures the harness"
    return (not still), ("classifier still reads the call — it is not reading the call"
                         if still else "classifier stops reading it, as it must")


# ── 🆕 228 — the READER's side, and it is a live control or it is nothing ───────────────

def reader_refuses_under_lock() -> tuple[bool, str]:
    """Spawn `tree_quiet.py` while THIS process holds the lock. It must refuse.

    🔴 THIS IS THE ROW 227 §15 IS ABOUT. `tree_quiet.py --selftest` proves the comparison
    can classify fixtures; that is a claim about the READER. This proves that on THIS
    tree, at this moment, with a real mutator holding the real lock, a real reader says
    no — which is a claim about the SUBJECT, and it is the only one of the two that would
    have stopped 227 §7.2.
    """
    p = subprocess.run([sys.executable, str(SCRIPTS / "tree_quiet.py")],
                       capture_output=True, text=True, cwd=str(ROOT), timeout=120)
    if p.returncode != MUTATING_EXIT:
        return False, f"exit {p.returncode}, wanted {MUTATING_EXIT} — it did not refuse"
    if MUTATING not in p.stdout:
        return False, "refused without the marker — the exit code alone does not say why"
    return True, "refused while a mutator held the lock"


def hook_refuses_under_lock() -> tuple[bool, str]:
    """And the hook, not just the script it calls. 🔴 A HOOK THAT SWALLOWS THE EXIT CODE
    IS A HOOK THAT PRINTS A WARNING, and the two are one `set -e` apart."""
    hook = ROOT / ".githooks" / "pre-commit"
    if not hook.exists():
        return False, "no .githooks/pre-commit — the one reader a human walks into is gone"
    if not os.access(hook, os.X_OK):
        return False, "the hook is not executable, so git would skip it silently"
    p = subprocess.run([str(hook)], capture_output=True, text=True, cwd=str(ROOT),
                       timeout=120)
    if p.returncode == 0:
        return False, "the hook exited 0 while the lock was HELD — it swallows the refusal"
    return True, f"refused with exit {p.returncode}"


def _js_mutators() -> tuple[list[str], int]:
    """The docstring claims no `host/scripts/*.mjs` rewrites the tree. Assert it, with the
    same rule the Python deriver uses — a write is confined when its ROOT identifier was
    assigned from a temp-directory factory.

    🔴 The first draft asked whether the word `tmpdir` appeared within 400 characters above
    the write. That reported `boundary_gate.selftest.mjs`, whose twelve writes all land
    under three `mkdtempSync` roots declared far above them. **Proximity is not derivation**,
    and a gate that reads distance between two strings is 222 §20's fitted check wearing a
    filesystem costume.
    """
    bad: list[str] = []
    confined = 0
    import re as _re
    for p in sorted((ROOT / "host" / "scripts").glob("*.mjs")):
        text = p.read_text(encoding="utf-8")
        roots = set(_re.findall(r"(?:const|let|var)\s+(\w+)\s*=\s*mkdtempSync", text))
        for _ in range(3):                  # `const a = mkdtempSync(); const b = join(a, …)`
            roots |= {m for m, rhs in _re.findall(r"(?:const|let|var)\s+(\w+)\s*=\s*([^\n;]+)", text)
                      if any(_re.search(rf"\b{r}\b", rhs) for r in roots)}
        for i, line in enumerate(text.splitlines(), 1):
            m = _re.search(r"writeFileSync\(\s*(?:join\(\s*)?(\w+)", line)
            if not m:
                continue
            if m.group(1) in roots:
                confined += 1
            else:
                bad.append(f"{p.name}:{i} writes to `{m.group(1)}`, which is not a temp root — "
                           f"the docstring's claim that no JS instrument mutates the tree has expired")
    return bad, confined


def _selftest() -> int:
    """The deriver's refusals, proved on fixtures rather than on the tree it guards."""
    print("MUTATION_LOCK selftest — the deriver's classifications, on fixtures")
    cases = [
        ("a bare tracked write is unconfined",
         "from pathlib import Path\nROOT = Path('.')\n(ROOT / 'a.py').write_text('x')\n", 1, 0),
        ("a write under mkdtemp is confined",
         "import tempfile\nfrom pathlib import Path\n"
         "def f():\n    tmp = Path(tempfile.mkdtemp())\n    (tmp / 'a.py').write_text('x')\n", 0, 1),
        ("two hops from mkdtemp is still confined",
         "import tempfile\nfrom pathlib import Path\n"
         "def f():\n    tmp = Path(tempfile.mkdtemp())\n    src = tmp / 'src'\n"
         "    (src / 'dist' / 'a.js').write_text('x')\n", 0, 1),
        ("shutil.move onto a tracked path is unconfined",
         "import shutil\nfrom pathlib import Path\nROOT = Path('.')\n"
         "shutil.move('a', ROOT / 'b')\n", 1, 0),
        ("a reader with no write at all is neither",
         "from pathlib import Path\nprint(Path('a').read_text())\n", 0, 0),
    ]
    bad = 0
    d = Path(tempfile.mkdtemp(prefix="mutlock_self_"))
    for i, (name, src, want_unconf, want_conf) in enumerate(cases):
        f = d / f"case{i}.py"
        f.write_text(src, encoding="utf-8")
        unconf, conf = write_sites(f)
        ok = len(unconf) == want_unconf and len(conf) == want_conf
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {name:<48} unconfined={len(unconf)} confined={len(conf)}")
        # 🆕 245 §2 — the countable spelling. This file's reds were `🔴 <name> unconfined=…`
        # and `failure_lines` read a blast of zero over every blind of it.
        if not ok:
            print(f"  FAIL MUTATION_LOCK_SELFTEST {name}")
    # And the `acquires` predicate, both ways.
    for name, src, want in [("acquire() in code is read", "acquire('x.py')\n", True),
                            ("acquire in a COMMENT is not", "# acquire('x.py')\n", False),
                            ("acquire in a DOCSTRING is not", "'''acquire(\"x.py\")'''\n", False)]:
        f = d / "acq.py"
        f.write_text(src, encoding="utf-8")
        got = acquires(f)
        ok = got == want
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {name:<48} acquires={got}")
        if not ok:
            print(f"  FAIL MUTATION_LOCK_SELFTEST {name}")
    # 🆕 245 §1 — 🔴 `settles` WAS NOT CALLED BY THIS SELF-TEST AT ALL, and the sweep is
    # what said so: blinded to a constant `True` the whole file stayed GREEN, because the
    # only reader of the predicate is `classify()` on the live path. `acquires` above has
    # had three cases since 228 and its twin — the half that CLOSES the mutation record —
    # had none. Both directions, on the same fixtures, so a predicate stuck on either
    # answer fails one of them.
    for name, src, want in [("run_and_settle() in code is read", "run_and_settle(p)\n", True),
                            ("run_and_settle in a COMMENT is not", "# run_and_settle(p)\n", False),
                            ("a file that only acquires does NOT settle", "acquire('x.py')\n", False)]:
        f = d / "settle.py"
        f.write_text(src, encoding="utf-8")
        got = settles(f)
        ok = got == want
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {name:<48} settles={got}")
        if not ok:
            print(f"  FAIL MUTATION_LOCK_SELFTEST {name}")
    # 🔴 THE FLOOR, DRIVEN FROM BOTH SIDES. `floor_pin_gate.py` moves `GUARDED_FLOOR` off
    # its shipped value and requires this file to redden — and zeroing a floor whose only
    # use is `len(guarded) < GUARDED_FLOOR` would otherwise make the gate MORE permissive,
    # which is a mutation nothing catches. Asserting the literal here is what pins it.
    live = len(classify()[0]["guarded"])
    ok = GUARDED_FLOOR == live
    bad += 0 if ok else 1
    print(f"  {'🟢' if ok else '🔴'} {'GUARDED_FLOOR equals the guarded gates in the tree':<48} "
          f"floor={GUARDED_FLOOR} live={live}")
    if not ok:
        print("  FAIL MUTATION_LOCK_SELFTEST GUARDED_FLOOR")
    # 🆕 245 §1 — a DISTINCT end token; see p0_comments.py for why the header line cannot
    # be the marker (198 §3's draft 1: a string printed first survives a crash).
    print(f"MUTATION_LOCK_SELFTEST_DONE {'ok' if not bad else f'🔴 {bad} FAILED'} — {len(cases) + 7} case(s)")
    return 1 if bad else 0


def main() -> int:
    if "--selftest" in sys.argv:
        return _selftest()

    # 🔴 THIS GATE TAKES THE LOCK TOO, and for a reason that is not symmetry: its controls
    # SPAWN the four mutators. Without the lock held here those children would find it free
    # and start rewriting the tree — the gate against 224 §6.6 would BE 224 §6.6.
    acquire("mutation_lock_gate.py")

    bad = 0
    groups, no_write, temp_writes = classify()
    total = len(list(SCRIPTS.glob("*.py")))
    print(f"MUTATION_LOCK guarded={len(groups['guarded'])} floor={GUARDED_FLOOR} "
          f"unguarded={len(groups['unguarded'])} temp-only={len(groups['temp_only'])}")

    for line in groups["guarded"]:
        print(f"  🟢 guarded    {line}")
    for line in groups["temp_only"]:
        print(f"  ·  temp-only  {line}")
    for line in groups["unguarded"]:
        bad += 1
        print(f"  🔴 UNGUARDED  {line}")
        print(f"  FAIL MUTATION_LOCK_UNGUARDED {line[:90]}")
    if groups["unguarded"]:
        print("🔴 MUTATION_LOCK_UNGUARDED — the file(s) above rewrite tracked files without\n"
              "   taking the lock. Add `acquire(\"<name>.py\")` at the top of main(). Two\n"
              "   mutators at once produce a red that means nothing (224 §6.6).")

    # ── the gate's own scope, said out loud ────────────────────────────────────────────
    print(f"   …not covered: {no_write} of {total} scripts/*.py have no write-shaped call, "
          f"and {temp_writes} write(s) were proved to land under a tempfile directory")

    if len(groups["guarded"]) < GUARDED_FLOOR:
        bad += 1
        # 🔴 229 §7.4 — THE OBSERVATION, THEN THE CAUSES, AND NOT ONE OF THEM ASSERTED.
        # This sentence used to read "the deriver stopped finding mutators. That is this
        # gate going blind, NOT the tree getting safer" — a refusal that fires correctly
        # and then denies a live alternative. `len(groups["guarded"])` is a COUNT. Delete
        # a mutating gate on purpose and it drops for the other reason, and the message
        # would have been false on the commit that did it. 228 §7.17: the comparison knows
        # less than the message claims, and that gap is where every wrong cause comes from.
        print(f"🔴 MUTATION_LOCK_COLLAPSE {len(groups['guarded'])} < {GUARDED_FLOOR} — fewer "
              f"guarded mutators than when this floor was measured. Either a mutating gate "
              f"was deleted (lower the floor in the same commit and name it), or the "
              f"write-shaped-call finder stopped recognising a write. This line cannot tell "
              f"them apart — both arrive as the same number — and the second is the "
              f"dangerous half: every file it stopped reading is then 'guarded' by never "
              f"having been looked at.")
        print(f"  FAIL MUTATION_LOCK_COLLAPSE {len(groups['guarded'])} < {GUARDED_FLOOR}")

    js_bad, js_confined = _js_mutators()
    for problem in js_bad:
        bad += 1
        print(f"🔴 MUTATION_LOCK_JS {problem}")
        print(f"  FAIL MUTATION_LOCK_JS {problem[:90]}")
    print(f"   …and {js_confined} host/scripts/*.mjs write(s) traced to a mkdtempSync root, "
          f"which is why no JS instrument is in the population above")

    # ── the live controls: written is not reached ─────────────────────────────────────
    guarded_names = [line.split(" ")[0] for line in groups["guarded"]]
    for name in sorted(set(MUTATING_ARGV) - set(guarded_names)):
        bad += 1
        print(f"🔴 MUTATION_LOCK_ARGV {name!r} has an entry in MUTATING_ARGV and is not in "
              f"the derived\n   population — a stale row makes the control roster look "
              f"complete over a file that left it.")
        print(f"  FAIL MUTATION_LOCK_ARGV {name}")
    print("MUTATION_LOCK controls — each guarded gate, spawned while the lock is HELD")
    for name in guarded_names:
        ok, why = refuses_under_lock(SCRIPTS / name)
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {name:<24} {why}")
        if not ok:
            print(f"  FAIL MUTATION_LOCK_CONTROL {name}")

    # ── 🆕 228 — OPENING A RECORD AND CLOSING ONE ARE TWO CALLS ────────────────────────
    # The population is every file that takes the lock, derived exactly as `guarded` is —
    # and it is NOT the same set: `mutation_lock_gate.py` acquires and mutates nothing, so
    # it is temp-only above and in here. A gate that acquires without settling leaves a
    # baseline behind that the NEXT gate compares itself against.
    openers = sorted(p.name for p in SCRIPTS.glob("*.py")
                     if not p.name.startswith("_gate_lock") and acquires(p))
    unsettled = [n for n in openers if not settles(SCRIPTS / n)]
    print(f"MUTATION_LOCK record — {len(openers)} file(s) take the lock, "
          f"{len(openers) - len(unsettled)} close their record")
    for name in unsettled:
        bad += 1
        print(f"  🔴 UNSETTLED  {name} calls acquire() and never run_and_settle(). Its "
              f"mutation record\n"
              f"                stays open after a CLEAN exit, so the next gate reads a "
              f"baseline that\n"
              f"                expired — and a SIGKILL's real damage becomes "
              f"indistinguishable from it.")
        print(f"  FAIL MUTATION_LOCK_UNSETTLED {name}")

    print("MUTATION_LOCK reader controls — the lock is HELD; what does a READER say?")
    for label, fn in (("tree_quiet.py", reader_refuses_under_lock),
                      (".githooks/pre-commit", hook_refuses_under_lock)):
        ok, why = fn()
        bad += 0 if ok else 1
        print(f"  {'🟢' if ok else '🔴'} {label:<24} {why}")
        if not ok:
            print(f"  FAIL MUTATION_LOCK_READER {label}")

    print("MUTATION_LOCK negative control — the classifier reads the CALL, not the file")
    if groups["guarded"]:
        first = groups["guarded"][0].split(" ")[0]
        for token, predicate in (("acquire(", acquires), ("run_and_settle(", settles)):
            ok, why = negative_control(SCRIPTS / first, token, predicate)
            bad += 0 if ok else 1
            print(f"  {'🟢' if ok else '🔴'} {first + ' ' + token:<24} {why}")
            if not ok:
                print(f"  FAIL MUTATION_LOCK_NEGATIVE {token}")

    print(f"MUTATION_LOCK {'ok — every tree mutator refuses to run beside another, closes its record, and every reader refuses beside one' if not bad else f'🔴 FAILED ({bad})'}")
    return 1 if bad else 0


if __name__ == "__main__":
    # 🆕 228 — `run_and_settle` and not `main`: the mutation record has to close on
    # EVERY exit path, and this file has more than one. See _gate_lock.run_and_settle.
    sys.exit(run_and_settle("mutation_lock_gate.py", main))
