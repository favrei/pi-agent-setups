---
name: manager-loop
description: Run a task as a Manager Loop — one manager owns the user relationship, acceptance criteria, and independent verification while one worker executes. Use when the user asks to manage or supervise a worker, hand off a long multi-step job, or have work ready unattended with a quality bar. Especially useful for experiments, benchmarks, and visual research where a worker's claims need checking.
---

# Manager Loop

One manager, one worker at a time. The worker does the task; the manager decides what counts as done and checks the result before telling the user. This is a way to supervise ordinary project work, not a separate filing system or a ceremony to run on every small task.

## Manager's responsibilities

- Agree with the user on the intended result, constraints, and what would count as success. Make important ambiguities explicit; do not demand a contract file.
- Give the worker a bounded, self-contained brief: goal, allowed scope, relevant context, evidence expected, and when to stop and ask. Carry forward important failed approaches when re-briefing.
- Examine the actual work and independently check the claims that matter. A worker's confidence, report, or self-check is not verification. Choose checks proportionate to the risk and cost; inspect visual outputs yourself when visual quality matters.
- Decide whether to accept, redirect, try a fresh worker, or escalate to the user. Use judgment rather than a fixed number of retries or a mandatory milestone ritual. Do not let a worker quietly change evaluation criteria or take destructive, irreversible, or costly actions without authorization.
- Tell the user what is verified, what remains uncertain, and where the results are. An honest partial result is better than an unsupported success claim.

The manager can do verification and small fixes directly. Use a worker when handing off execution helps; do not delegate judgment about acceptance.

## Work and memory

Work as a normal agent would. Keep briefs and working decisions in the conversation and worker prompts unless a long task genuinely needs a temporary plan or handoff in the project's usual planning area (for example, `.agents/plans/` if the project uses it). Prefer the subagent's returned report to a report file.

Keep code, deliverables, figures, evidence, run records, and large logs in their natural project/output locations or external scratch. Reference evidence where it is; do not copy it into memory to satisfy this skill. Stage only meaningful findings, verified outcomes, and lessons as small dated notes in `.agents/memory/inbox/`, following the project's Agent Law. Do not edit `cells/` or `current.md` during ordinary work. Do not silently move or delete live task state left by an earlier workflow.

## Optional references

Read only what the task needs:
- `references/worker-prompt.md` — short worker instructions to adapt in the brief.
- `references/templates.md` — examples of contract, brief, and report structures; none requires a file or exact format.
- `references/harness.md` — harness-specific worker spawning; in Pi use `Agent`, not a shell-spawned agent.
- `references/visual-research.md` and `scripts/compare_grid.py` — visual comparisons when relevant.
