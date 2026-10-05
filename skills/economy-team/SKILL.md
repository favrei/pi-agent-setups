---
name: economy-team
description: Delegate genuinely independent, bounded implementation work to cheaper worker sub-agents when it benefits, while the foreground session keeps judgment, design, visual verdicts, integration, and final verification. Use when the user asks to save cost/tokens/quota, to delegate, to "use the workers", or invokes economy-team / $economy-team, or when a bounded piece of work clearly benefits from an independent brief-and-verify lane. Not an automatic rule for every artifact — small, subtle, or session-coupled work stays in the foreground.
---

# Economy Team

You are the **analyst** in the foreground. Workers are optional leverage, not a
mandatory assembly line.

## Why

Output tokens cost several times more than input tokens on the same model, and
the gap between an analyst-tier model and a worker-tier model is larger still.
Reading is cheap for you; writing bulk predictable text is not.

So when a piece of work genuinely benefits, you read, think, decide, and write
*instructions*, and a worker emits the artifact. When it does not benefit, do
the work yourself — no brief is cheaper than a bad one. Never re-type a
worker's output to "clean it up": send it back with a diff-sized correction,
or patch the few lines that are actually wrong.

Do **not** quote specific prices. The rates move, and this skill does not track
them; the rule is directional and holds regardless: analyst output is the
expensive resource, worker output is the cheap one.

## When to delegate

Delegate when a **genuinely independent, bounded** piece of work benefits:

- long, predictable output (a module, a doc, a test matrix, a migration),
- mechanical repetition across files,
- an independent lane you can brief precisely and verify cheaply.

Do it yourself when:

- the change is small and the brief would cost more than the edit,
- the needed context is subtle and lives in this conversation — if restating
  it accurately takes longer than doing the work, do the work,
- the work is security-, data-, or money-sensitive,
- you have already sent it back twice — the third round is yours,
- a split would finish later than doing it solo. Wall clock is the second
  objective; saving tokens while doubling elapsed time is a loss.

## Division of responsibility

**The foreground owns:** design and architecture, high-risk or irreversible
decisions, visual verdicts, integration, and final verification.

**Workers may:** implement to the brief, run the focused checks named in it,
and debug within their scope — reporting evidence, not narratives. They do not
choose architecture and do not decide "done".

Visual work follows the trust rule: a worker may generate and capture a
screenshot, render, or plot, but the verdict is yours. Workers that accept
images routinely describe what the code *should* have drawn instead of what
the pixels show. If a worker's report disagrees with your own look, yours
wins. If you cannot view the image, say so rather than passing a worker's
description along as verified fact.

## The brief

A worker starts with a **clean context**. It cannot see this conversation, your
tool output, or your reasoning. Anything you don't restate does not exist.

```
GOAL: one sentence, the end state.

FILES: exact paths to create/modify. Say which ones are off-limits.

SPEC:
- concrete requirement 1
- concrete requirement 2
(include the exact signature/schema/naming you already decided)

CONTEXT YOU NEED: facts from my session the worker cannot discover by reading —
prior decisions, why the obvious approach fails, the failing command output.

VERIFY: the exact command to run, and what passing looks like.

REPORT: unified diff summary + verify output. Do not summarize prose back to me.
```

Rules:

- Pin the decisions. "Add caching" invites invention; "add an LRU with
  maxsize=128 on `Foo.bar`, no new deps" does not.
- Name the off-limits files explicitly. Workers wander.
- Ask for evidence, not for a narrative.
- One worker per file set. Never point two workers at the same files.

Rework is the main way this skill loses money. A vague brief that costs one
extra round trip has already burned more than the brief you should have
written.

## One scheduler per job

Need a delegated subtask -> use the subagent plugin. Need a background
process -> use the background plugin. Do not combine the two launch paths:

- Spawn every delegated agent, including read-only investigators and reviewers,
  only with `subagent({ agent, task })`. Its native async execution and
  completion notification belong to the subagent plugin, not the background
  plugin. Never wrap it in `bg_run`, `/bg`, or a shell script.
- Use `bg_run` only for non-agent shell processes: tests, builds, servers,
  training, watchers. In this setup it always has `isAgent: false` and needs an
  explicit `timeoutSeconds`.
- Never use `bash` or `bg_run` to launch `pi -p`, `pi --print`, `pi --mode
  json`, another LLM CLI/API, or a wrapper that launches one. That is a
  shell-spawned pseudo-agent: the parent receives a process log instead of the
  real sub-agent result and lifecycle.
- Do not use `bg_delegate`, even for inspect-only or context-seeded work.
  Use a read-only `subagent` with a self-contained brief or supported fork
  context instead. Read-only scope is not an exception to plugin separation.
- Fusion and `bg_run_pi_attested` require an explicit request for that named
  workflow or attested evidence run. Neither is a launcher or fallback for
  ordinary delegated subtasks.
- The foreground is never delegated, merged, or backgrounded into any
  sub-agent. Workers spawn from it; it is never handed off.

## Verification and supervision

- A worker saying "done, all tests pass" is a claim, not evidence. Confirm with
  the cheapest signal that would actually fail: run the check yourself, inspect
  `git diff`, read the changed hunks. Reading is cheap; accepting is expensive.
- When reports disagree (worker vs reviewer, or two analysts), you own the
  synthesis: name what the disagreement is actually about, decide by evidence
  rather than majority, and report your judgment, not a transcript of
  positions. Agreement built on one shared untested premise is not extra
  evidence.
- Every subagent wakes the foreground on completion and is bounded by a
  timeout. Its native async runs notify without the background plugin; the
  global config sets a 2-hour run deadline (with a checkpoint steer 5 minutes
  before it) and a 45-minute per-tool-call limit. Pass a shorter per-call
  `timeoutMs` for small briefs.
- Audit a long-running worker at useful breakpoints in your own work, roughly
  every 5–10 minutes, by reading one bounded transcript tail:
  `subagent({ action: "status", id, view: "transcript", lines: 80 })`. An
  audit is three questions: touching only the named files? forward progress
  toward VERIFY? output shape matches the spec?
- Act on the audit through the same run, not a new one: `steer` a drifting
  worker; `interrupt` it when you need to inspect before it continues, then
  `resume` it with a diff-sized correction. Sending corrections to the same
  worker keeps its warm context, so prefer `resume` over a fresh re-brief. Use
  `stop` (terminal) and a fresh worker only when the direction is wrong enough
  that its context is a liability.
- Never sleep or poll merely to wait for a delegated task; the completion
  notification is the wake-up path. If you have no useful independent work,
  end the turn and let the notification wake you — no forced busywork and no
  mandatory audit timer.

## Roster and concurrency caps

Per-worker modality, availability, provider concurrency, worker rotation, and
escalation/analyst names are owned by the global policy
(`~/.pi/agent/AGENTS.md`); that file wins over anything here. Filter
capability and availability before choosing a worker, and spread deliberately
parallel lanes across providers.

The subagent tool does **not** enforce provider limits, so this skill does.
Before every launch, count this session's active runs on the target provider
with `subagent({ action: "status" })` and respect the caps table in
`~/.pi/agent/AGENTS.md` (`opencode-go`: 1, `openai-codex`: 2, `anthropic`: 2,
`deepseek`: 4, `meta`: 6; at most 4 active background sub-agents overall).
Paused workers still hold their slot. At a cap, wait for a completion or
re-draw onto another provider — never exceed it to go faster.

## Anti-patterns

- **Under-specified brief, then three correction rounds.** One good brief
  costs less than three bad ones.
- **Trusting worker prose.** A summary of their own work is the least reliable
  artifact a worker produces; ask for diffs and command output.
- **Trusting worker eyes.** See the trust rule above.
- **Parallel workers on one file set.** Silent clobbering, expensive untangling.
- **Cheaper but slower.** Token savings do not buy back the user's time.
- **Combined launch paths** — `bg_delegate`, background-wrapped `subagent`,
  or shell-spawned agents via `bash`/`bg_run` instead of native `subagent`.
- **Cap overrun** — launching past a provider cap because the tool allowed it.
- **Sleep-to-wait** — bare `sleep N; echo ready` or any poll loop while a
  delegate runs; the completion notification is the wake.
- **Foreground merge or hand-off** — folding the live session into a
  sub-agent. The user loses their interlocutor and the workers lose their
  supervisor in one move.
