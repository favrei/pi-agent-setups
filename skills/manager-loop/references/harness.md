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
description: Executes one manager-loop brief and writes a report with evidence.
model: sonnet        # or haiku for cheaper, simpler tasks
tools: Read, Write, Edit, Bash, Glob, Grep
---
<paste references/worker-prompt.md here>
```

The manager (main session, stronger model) delegates with a message such as: "Use the worker subagent. Brief: `.manager-loop/briefs/03-train-kd.md`." Each delegation starts with a clean context. If your version supports resuming a subagent, use that for redirects; otherwise re-brief.

Keep subagent output short. Tell the worker to put details in its report file and return only the status plus the report path, so the manager's context doesn't fill up.

## Claude Code: headless worker process

Good for long runs such as training jobs, where the manager checks in periodically:

```bash
claude -p "$(cat .manager-loop/worker-prompt.md .manager-loop/briefs/03-train-kd.md)" \
  --model sonnet --output-format json > .manager-loop/runs/03.json
# redirect: resume that session with the delta
claude -p "$(cat .manager-loop/briefs/03-redirect-1.md)" --resume <session_id> --model sonnet
```

## Pi: subagent (Agent tool)

Spawn the worker with the `Agent` tool: pick the worker role (e.g. `worker-luna` for cheap execution), and pass `references/worker-prompt.md` plus the brief as the prompt. Each spawn starts with a clean context.

Resume is **not supported** — verified by test: a worker told to memorize a code word, then "resumed" by a second spawn whose prompt never contained the word, reported no memory of the session. The `Agent` tool takes no session handle (`agent` / `prompt` / `run_in_background` / `worktree_path` only), so redirects and restarts are always a fresh worker with the original brief plus the "What was wrong" delta. Keep briefs self-contained and paste the relevant ledger entries (especially ruled-out approaches) into every delta brief, since the new worker inherits nothing.

For long unattended jobs, spawn with `run_in_background: true` and continue on the completion notification; the worker still returns only its terminal report, so verification against artifacts works the same way.

## Raw API

Keep one `messages` list per worker session. For a new task, create a new list. For a redirect, append the delta as a user turn. The manager is a separate conversation that reads report files and never shares the worker's message list.

## Other vendors' CLIs as worker

Any agentic CLI with a non-interactive mode works. Pass it the same prompt plus brief, and require it to write the report file. The verification rules don't change with the vendor.
