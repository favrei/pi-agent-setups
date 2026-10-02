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

If the chosen harness permits a headless worker process, pass the same standing instructions and self-contained brief. Keep process records and large logs in the project's ordinary run/output area or external scratch, not the memory inbox. Use the harness's own resume mechanism if available. In Pi, do **not** shell-spawn a second agent: use the `subagent` tool instead.

## Pi: subagent (`pi-subagents` `subagent` tool)

Spawn the worker with `subagent({ agent: "<worker role>", task: "<prompt>" })`: pick the worker role from the global random draw (e.g. `worker-luna`), and pass `references/worker-prompt.md` plus the self-contained brief as the task. It runs in the background by default and notifies the manager natively on completion; accept that terminal result as its report. Keep the run ID from the launch receipt.

Resume **is supported** with the same run ID:
- **Watch:** `subagent({ action: "status", id, view: "transcript", lines: 80 })` — one bounded tail per breakpoint.
- **Redirect while running:** `subagent({ action: "steer", id, message })`.
- **Pause and inspect:** `subagent({ action: "interrupt", id })`, wait for status `paused`, inspect the artifacts, then continue.
- **Redirect after a report (or after a pause/failure):** `subagent({ action: "resume", id, message: "<What was wrong delta>" })`. The worker keeps its conversation, model, and tools, so send only the delta. Each resume may return a new run ID; continue from the latest.
- **Restart:** `subagent({ action: "stop", id })` (terminal, not resumable), then a fresh worker with the original brief plus the delta and any ruled-out approaches.

Count the worker against the provider concurrency caps in `~/.pi/agent/AGENTS.md` before launching; a paused worker still holds its slot. For long unattended jobs, continue on the completion notification instead of polling. The manager still verifies the worker's claims against the referenced artifacts.

## Raw API

Keep one `messages` list per worker session. For a new task, create a new list. For a redirect, append the delta as a user turn. The manager is a separate conversation that checks the worker's returned report and evidence; it never shares the worker's message list.

## Other vendors' CLIs as worker

Where permitted by the host harness, pass the same prompt plus brief and collect the returned report. Keep large process logs outside memory. The verification rules don't change with the vendor; Pi sessions use `subagent`, not shell-spawned agent CLIs.
