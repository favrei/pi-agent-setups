---
name: manager-loop
description: Run a task as a Manager Loop — you (the expensive, careful model) act as manager who owns the user relationship, the acceptance contract and all verification, while exactly one cheap, durable worker model does the execution. Use this whenever the user asks to "manage", "supervise", "delegate to a worker", "run a manager loop", hand off a long multi-step job to a cheaper model, or wants a job done unattended with a quality bar ("have it ready when I'm back", "make sure everything I asked is covered"). Especially use it for research and experiment work (ML training runs, visual/image-quality comparisons, benchmarks) where a cheap model may report results it never actually produced.
---

# Manager Loop

One manager, one worker. The manager talks to the user, writes the contract, briefs the worker, verifies everything, and delivers. The worker executes and reports. Nothing else.

## Why it is shaped this way

- **Exactly one worker.** Parallel writers make conflicting implicit decisions, and every extra worker costs manager attention, which is the scarce resource. Parallelism is not worth it here.
- **The worker is assumed to be unreliable, not malicious.** Cheap models skip steps, reuse stale outputs, describe images they never opened, and write "all tests pass" without running them. The loop is built so that a false claim cannot reach the user: the manager accepts artifacts it has checked, never statements.
- **Fresh worker per task.** Long contexts make cheap models drift and anchor on their own failed approaches. Continuity lives in files the manager owns, not in the worker's memory.

## Roles

**Manager (you)**
- Owns the contract with the user and is the only one who talks to the user.
- Decomposes the work into milestones and writes one brief per task.
- Verifies each report against evidence, then accepts, redirects, or restarts.
- Keeps the ledger (decisions, ruled-out approaches, known risks).
- Does not do the worker's job. The exceptions are verification work and fixes of a few lines that are cheaper than a round trip.

**Worker**
- Executes one brief at a time inside its assigned scope.
- Returns a report in the fixed format (see `references/templates.md`), with an artifact path for every claim.
- Says "could not do X" or "not verified" instead of guessing. The worker prompt tells it explicitly that this is acceptable. A worker that believes it must report success will fabricate success.

## State files

Keep all loop state flat in the project's memory inbox (`.agents/memory/inbox/` — the sole writable memory path during ordinary work; `cells/` and `current.md` stay read-only), so any fresh worker or a resumed manager can pick up from it. Everything lives flat directly in the inbox — no subdirectories, no root-level `.manager-loop/` directory (it conflicts with the cell-first memory layout):

```
.agents/memory/inbox/
├── contract.md      # what the owner wants to see on return (the acceptance contract)
├── plan.md          # milestones, status, acceptance check per milestone
├── ledger.md        # decisions made, approaches ruled out and why, open risks
├── brief-NN-*.md   # one brief per worker task
├── report-NN-*.md  # worker's report per task
├── evidence-NN-*   # artifacts the manager checked (grids, logs, metric outputs)
├── run-NN.json      # worker run records (headless harness runs)
└── YYYY-MM-DD-*.md # ordinary staged notes (untouched by the loop)
```

`$dream-agent-memory` consolidation ignores the loop control files (`contract.md`, `plan.md`, `ledger.md`, `brief-*`, `report-*`, `evidence-*`, `run-*`) — they are working state, not staged notes. Log meaningful progress separately as tiny dated inbox notes (`YYYY-MM-DD-<slug>.md`, one topic per file) per Agent Law; never let dreaming absorb or delete the loop files.

The worker may read `contract.md`, `plan.md` and `ledger.md` in the inbox. The worker writes only to its own `report-NN-*.md` file and inside the scope its brief grants.

## Phase 0 — Contract (with the user, before any work)

Write `contract.md` using the template in `references/templates.md`. It must answer the following:

1. **Return picture.** What does the owner see when they come back? Name concrete files, numbers and figures.
2. **Acceptance criteria.** Each criterion must be checkable by the manager. "Better quality" is not checkable. "PSNR on the 50-image val set ≥ baseline + 0.3 dB, plus a 6-crop side-by-side grid" is.
3. **Non-goals.** List what not to touch or spend effort on.
4. **Constraints.** Budget (time, compute, tokens), environments, and files or systems that are off-limits.
5. **Known risks.** List what could go wrong, and how each risk will be prevented or detected.
6. **Escalation triggers.** Define when to stop and ask the user instead of deciding.

Show the contract to the user once and resolve ambiguities now. A fuzzy criterion discovered at delivery time is the most expensive failure in this loop. If the user said "just go", draft the contract anyway, state your assumptions in it, and proceed.

## Phase 1 — Plan

Break the contract into milestones in `plan.md`. Each milestone gets:
- a deliverable (a file or result),
- an acceptance check (how *you* will verify it, not how the worker will),
- a checkpoint (git commit or a copy) so the milestone can be rolled back.

Order the milestones to surface risk early. If one assumption would sink the whole plan, test it in milestone 1.

## Phase 2 — The loop (per task)

```
brief → worker runs → report → VERIFY → accept | redirect | restart
```

### Brief

Write `brief-NN-name.md` from the template. A good brief is self-contained, because the worker starts fresh. It includes:
- the goal and why it matters,
- the scope (files and dirs it may change),
- the exact commands or entry points if known,
- relevant ledger entries, especially **approaches already ruled out**, so the worker doesn't repeat them,
- the definition of done and the evidence required,
- the stop conditions ("if X fails twice, stop and report; do not work around it").

### Spawn

Start a new worker for each new task. Give it `references/worker-prompt.md` as its standing instructions, plus the brief. How to spawn depends on the harness. See `references/harness.md`.

### Verify: the core of the skill

Sort every claim in the report into one of three classes:

| Class | Meaning | Treatment |
|---|---|---|
| **VERIFIED** | You checked the artifact yourself (opened the image, re-ran the command, read the diff) | May go to the user |
| **EVIDENCED** | An artifact exists but you have not checked it | Spot-check before accepting the milestone |
| **CLAIMED** | No artifact | Treat as false. Never forward to the user |

Minimum verification before accepting a milestone:
- **Existence and freshness.** Artifacts exist, their timestamps fall inside this task's run, and they aren't byte-identical to older outputs (compare hashes).
- **Reproduce one thing.** Re-run the cheapest command that confirms the key claim (a test, a metric script on a subset, a build).
- **Look at it yourself.** For any visual claim, open the images. See `references/visual-research.md`. This is non-negotiable for image and video work.
- **Diff review.** Read the diff for scope violations: files outside the scope, disabled tests, loosened thresholds, hard-coded outputs, or silently changed eval data.

Signs of fabrication or corner-cutting include:
- round numbers,
- metrics that improve on every axis at once,
- evidence paths that don't exist,
- "verified visually" with no image path,
- identical numbers across runs that should differ,
- a report much longer than the actual diff,
- success claims with no command output,
- a missing "problems encountered" section on a hard task.

### Decide

- **Accept.** Mark the milestone done in `plan.md`, rename the checked artifacts flat into the inbox as `evidence-NN-…` files, record any decision in `ledger.md`, and commit a checkpoint.
- **Redirect** (small, specific fix). Resume the same worker if the harness supports it; otherwise start a fresh one with a delta brief. State exactly what was wrong and what evidence you need.
- **Restart.** After **2 failed redirects on the same task**, drop the worker. Write the failure mode into `ledger.md` under "ruled out", then brief a fresh worker. Consider splitting the task, since repeated failure usually means the brief was too big or too vague.
- **Escalate.** Stop and ask the user if a contract criterion looks unachievable, a constraint must be broken, the plan's key assumption failed, or the budget is 70% spent with less than half the milestones done.

## Risk control (proactive)

- **Destructive or irreversible actions require your explicit approval in the brief.** This covers deleting data, force-pushing, overwriting checkpoints, spending money, and external API calls with side effects. The worker must stop and ask rather than improvise.
- **Protect the eval.** The worker must never modify eval data, metric code, or thresholds unless the brief says so. The most common way a cheap model "passes" is by moving the goalposts.
- **Checkpoint before each milestone**, so any milestone can be rolled back cheaply.
- **Watch the budget.** Track worker runs and wall-clock time in `plan.md`.

## Delivery (Phase 3)

Return to the user with a report shaped by `contract.md`, not by the chronology of the work:

1. For each acceptance criterion: **met / partially met / not met**, with the evidence path.
2. The return picture: the files, figures and numbers they asked to see.
3. What was ruled out and why (one line each, from the ledger).
4. Known gaps and residual risks, stated plainly.

Only VERIFIED claims appear in the delivery. If something important is only EVIDENCED, say so explicitly ("not independently checked"). The user prefers an honest partial result to a polished false one.

## References

- `references/templates.md`: contract, brief, and worker report templates. Read in Phase 0.
- `references/worker-prompt.md`: standing instructions to give every worker.
- `references/visual-research.md`: verification rules for image, video, and super-resolution work. Read whenever claims involve visual quality.
- `references/harness.md`: how to spawn and resume workers in Claude Code, over the API, or with other CLIs.
- `scripts/compare_grid.py`: deterministic side-by-side crop grid, full-reference metrics, and file hashes. Use it to produce visual evidence instead of trusting worker descriptions.
