# Global Pi Instructions

## Model Selection

- The foreground model is whatever model the user selected for the session.
  Respect it; do not substitute a different default.
- Do not use the expensive `opencode-go` analyst models (`glm-5.3`, `kimi-k3`,
  `qwen3.8-max`) for routine work. Use one only when the task genuinely needs a
  larger independent review, and state why before invoking it. This restriction
  is about those analyst-tier models, not the `opencode-go` provider as such:
  `opencode-go/glm-5.3-flash` is a cheap worker-tier model and is routine
  implementation work — see `worker-glm`.

## Worker Selection

- For bounded implementation work, choose randomly among eligible workers rather
  than always preferring one provider.
- All four workers (`worker-luna`, `worker-deepseek`, `worker-muse`,
  `worker-glm`) handle text and image/screenshot input. Keep video, audio,
  or PDF analysis in the parent unless a worker's actual input capabilities
  have been verified for that task.
- For implementation work, draw once with
  `node -e "console.log(require('crypto').randomInt(4))"`: `0` selects
  `worker-luna`, `1` selects `worker-deepseek`, `2` selects `worker-muse`, and
  `3` selects `worker-glm`.
- `worker-glm` (`opencode-go/glm-5.3-flash`) is a worker and is unrelated to
  `analyst-glm` (`opencode-go/glm-5.3`), which stays escalation-only. Do not
  substitute one for the other because the names look alike.
- `opencode-go` provider concurrency is 1, so `worker-glm` and any
  `analyst-glm` / `analyst-kimi` / `analyst-qwen` contend for the same slot.
  Do not plan a parallel lane that needs two `opencode-go` agents at once.

## Concurrency Caps (policy-enforced)

`pi-subagents` has no per-provider scheduler, so these caps are enforced by
you, not by the tool. They bind in both `economy-team` and Elite Team Mode.

| Provider | Roles | Max active sub-agents |
|---|---|---|
| `opencode-go` | `worker-glm`, `analyst-glm`, `analyst-kimi`, `analyst-qwen` | **1** |
| `openai-codex` | `worker-luna`, `analyst-astra`, built-ins (`scout`, `reviewer`, `oracle`, `delegate`, …) | 2 |
| `anthropic` | `analyst-opus`, `analyst-sonnet` | 2 |
| `deepseek` | `worker-deepseek` | 4 |
| `meta` | `worker-muse` | 6 |

- Before every launch, count this session's active runs for that provider with
  `subagent({ action: "status" })`. Queued, running, paused, and
  needs-attention runs all occupy a slot; a paused (interrupted) worker you
  intend to resume still holds its slot.
- At the cap, wait for a completion notification or pick a worker on another
  provider. Never exceed a cap to save wall-clock time.
- Keep at most 4 active background sub-agents per session overall unless the
  user asks for a wider fan-out.
- A provider rate-limit or concurrency error from a child means a cap was
  wrong or exceeded: stop launching on that provider and report it.
- Provider availability, concurrency, task-specific suitability, independent
  review diversity, or an explicit user choice may override the random draw.
  If the selected worker is unavailable, use another eligible worker.
- Built-in `pi-subagents` roles run on `openai-codex/gpt-6.1-sol` (low
  thinking): `scout` for read-only recon (formerly `Explore`), `delegate` for
  a parent-like general helper (formerly `general-purpose`), plus `reviewer`,
  `oracle`, `researcher`, `evidence-auditor`. The generic built-in `worker` is
  disabled; implementation always goes through the random draw above.

## One Scheduler Per Job

Need a delegated subtask -> use the `subagent` plugin. Need a background
process -> use the background plugin. Do not combine the two launch paths.
The subagent plugin's native async execution is not a background-plugin task.

- Use the `subagent` tool (`pi-subagents`) for every delegated agent subtask,
  including read-only investigation, research, implementation, and review:
  `subagent({ agent: "worker-luna", task: "<brief>" })`. Children run in native
  async mode by default and notify the parent natively on
  completion; do not pass `async: false` for named roles (foreground children
  lose ambient extensions such as `pi-ssh` and web access).
- Never use the external-CLI runner agents (`claude-code*`, `codex-exec*`,
  `cursor-agent*`); they are disabled and would be shell-spawned agents.
- Do not use `bg_delegate`, even for inspect-only or context-seeded work.
  Read-only agents are still subagents; use `subagent` with a self-contained
  brief or its supported fork context. Do not wrap a `subagent` call or an
  agent-launching script in `bg_run`, `/bg`, or another background task.
- Fusion is only for an explicitly requested named Fusion workflow, never an
  alternative launcher for a delegated subtask.
- Use `bg_run` only for non-agent shell processes such as tests, builds, servers,
  training jobs, and audit timers. In this setup, always set `isAgent: false`.
- Never launch `pi -p`, `pi --print`, `pi --mode json`, another LLM CLI/API, or
  a wrapper script that launches one through `bash` or `bg_run`. That is a
  shell-spawned pseudo-agent: the parent receives a process log instead of the
  real sub-agent result and lifecycle.
- `bg_run_pi_attested` is only for an explicitly requested attested evidence
  run, never a delegated subtask or a fallback. Tool availability, generic
  plugin guidance, and a desire to run asynchronously do not override this
  separation.

## Elite Team Mode (user present)

When the user is actively in the session, quality and responsiveness outrank
quota savings. The `economy-team` skill still applies, with these overrides:

- **Foreground leads.** The session analyst owns audit, design decisions,
  integration, visual verdicts, and verification itself, and never delegates a
  judgment call. Short or in-context artifacts are written directly instead of
  paying briefing overhead.
- **Escalation via named roles.** When work genuinely needs elite-class
  judgment, dispatch it to an available configured named role suited to the
  work. If no configured role fits, keep the work in the foreground or ask the
  user about configuration; never invent a `model` override or any field the
  tool does not support.
- **Analyst discussion.** For a named disagreement, a high-risk call, or an
  independent review where family diversity is the point, spawn another
  analyst: `analyst-astra` (GPT-6 Astra) or `analyst-opus` for an elite second
  opinion, `analyst-qwen` / `analyst-kimi` for cross-family diversity. Name the
  disagreement in the brief. `analyst-glm` is text-only and never gets visual
  work. "More eyes" alone is not a reason.
- **Caps still bind.** Quality-over-quota does not lift the Concurrency Caps
  above: `opencode-go` stays at 1 and every launch is counted first.
- **Responsive by default.** Sub-agents use `subagent` (background by
  default); long shell calls use `bg_run` with a timeout and `isAgent: false`.
  At useful breakpoints, inspect the worker's live transcript (below) and work
  artifacts; do not poll status to wait. Correct a drifting worker with
  `steer`; stop a wrong-direction worker early and re-brief with the loophole
  closed.
- **Delegation is optional, not mandatory.** Delegate when genuinely
  independent, bounded work benefits; small or subtle jobs stay solo. If a
  delegated split would finish later than doing the work solo, do it solo.
  Workers may implement and run focused tests and debugging within their
  briefed scope; design, high-risk decisions, visual verdicts, and integration
  stay with the foreground.
- **Delegation contract: end notification + timeout.** Every subagent must
  wake the foreground on completion and be bounded by a timeout.
  For `subagent` native async runs, the completion notification is native, and
  `~/.pi/agent/extensions/subagent/config.json` sets the bounds: a 2-hour
  run deadline (`timeoutMs`) with a checkpoint-and-stop steer 5 minutes
  before it, and a 45-minute hard limit per tool call (`toolTimeoutMs`).
  Pass a shorter per-call `timeoutMs` when the brief is small. Non-agent
  `bg_run` shell jobs separately require `timeoutSeconds` because absent means
  no timeout.
- **Supervise through the tool, not the filesystem.** Use the run ID from the
  launch receipt:
  - read progress: `subagent({ action: "status", id, view: "transcript", lines: 80 })`
    — a **bounded tail once** per breakpoint (max 500 lines);
  - correct a running worker: `subagent({ action: "steer", id, message })`;
  - pause to inspect: `subagent({ action: "interrupt", id })`, then check
    status until it reports paused;
  - continue the same conversation (paused, completed, or failed):
    `subagent({ action: "resume", id, message })` — it keeps the worker's
    context, model, and tools; prefer it over a fresh re-brief for redirects;
  - end for good: `subagent({ action: "stop", id })` (not resumable).
  Never search all Pi sessions to discover progress or confuse a transcript
  with a `bg_run` process log; protect sensitive prompt/log contents.
- **No sleeping, no soaking.** Never run `sleep N; echo ready`, a poll loop,
  or an open-ended `tail -f` merely to wait for a delegated task, and never
  hand the live session itself to a sub-agent. The completion notification is
  the wake-up path: do independent foreground work if there is any; otherwise
  end the turn and let the notification wake you. Audit long-running workers
  at useful breakpoints, roughly every 5–10 minutes — there is no forced
  audit timer and no busywork requirement.
