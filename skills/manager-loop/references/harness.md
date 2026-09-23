# Spawning and resuming the worker

The loop is independent of the harness. What matters:
- **New task:** start a fresh worker session with the standing instructions from `worker-prompt.md` plus the brief.
- **Redirect:** resume the same session if the harness supports it (the cache is warm and the worker already knows the files). Otherwise start fresh with the original brief plus the "What was wrong" delta.
- **Restart:** always a fresh session.

Check your harness version's docs for the exact flags. The ones below may change.

## Claude Code: subagent

Create `.claude/agents/worker.md`:

```markdown
---
name: worker
description: Executes one manager-loop brief and returns a report with evidence.
model: sonnet        # or haiku for cheaper, simpler tasks
tools: Read, Write, Edit, Bash, Glob, Grep
---
<paste references/worker-prompt.md here>
```

The manager (main session, stronger model) passes the self-contained brief in the subagent prompt. Each new task starts with a clean context. If your version supports resuming a subagent, use that for redirects; otherwise re-brief.

Ask for a concise report in the subagent's final response with paths to evidence in its normal location. For unusually large reports, arrange a task file outside memory explicitly in the brief.

## Claude Code: headless worker process

If the chosen harness permits a headless worker process, pass the same standing instructions and self-contained brief. Keep process records and large logs in the project's ordinary run/output area or external scratch, not the memory inbox. Use the harness's own resume mechanism if available. In Pi, do **not** shell-spawn a second agent: use the `Agent` tool instead.

## Pi: subagent (Agent tool)

Spawn the worker with the `Agent` tool: pick the worker role (e.g. `worker-luna` for cheap execution), and pass `references/worker-prompt.md` plus the self-contained brief as the prompt. Use `run_in_background: true` for asynchronous work, and accept the terminal subagent result as its report. Each spawn starts with a clean context.

Resume is **not supported** — verified by test: a worker told to memorize a code word, then "resumed" by a second spawn whose prompt never contained the word, reported no memory of the session. The `Agent` tool takes no session handle (`agent` / `prompt` / `run_in_background` / `worktree_path` only), so redirects and restarts are always a fresh worker with the original brief plus the "What was wrong" delta. Keep briefs self-contained and include relevant decisions (especially ruled-out approaches) in every delta brief, since the new worker inherits nothing.

For long unattended jobs, continue on the completion notification instead of polling. The worker returns a terminal report, but the manager still verifies its claims against the referenced artifacts.

## Raw API

Keep one `messages` list per worker session. For a new task, create a new list. For a redirect, append the delta as a user turn. The manager is a separate conversation that checks the worker's returned report and evidence; it never shares the worker's message list.

## Other vendors' CLIs as worker

Where permitted by the host harness, pass the same prompt plus brief and collect the returned report. Keep large process logs outside memory. The verification rules don't change with the vendor; Pi sessions use `Agent`, not shell-spawned agent CLIs.
