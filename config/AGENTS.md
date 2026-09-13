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
- Apply capability filtering before randomness. `worker-deepseek` is text-only
  and must never receive image, screenshot, video, audio, or other visual-input
  work. `worker-luna`, `worker-muse`, and `worker-glm` can handle
  image/screenshot input.
- For text-only work, draw once with
  `node -e "console.log(require('crypto').randomInt(4))"`: `0` selects
  `worker-luna`, `1` selects `worker-deepseek`, `2` selects `worker-muse`, and
  `3` selects `worker-glm`.
- For image/screenshot work, draw once with
  `node -e "console.log(require('crypto').randomInt(3))"`: `0` selects
  `worker-luna`, `1` selects `worker-muse`, and `2` selects `worker-glm`.
- `worker-glm` (`opencode-go/glm-5.3-flash`) is a worker and is unrelated to
  `analyst-glm` (`opencode-go/glm-5.3`), which stays escalation-only. Do not
  substitute one for the other because the names look alike.
- `opencode-go` provider concurrency is 1, so `worker-glm` and any
  `analyst-glm` / `analyst-kimi` / `analyst-qwen` contend for the same slot.
  Do not plan a parallel lane that needs two `opencode-go` agents at once.
- Keep video, audio, PDF, or uncertain multimodal analysis in the parent using
  the available media/file tools unless the selected worker's actual input and
  tool capabilities have been verified for that task.
- Provider availability, concurrency, task-specific suitability, independent
  review diversity, or an explicit user choice may override the random draw.
  If the selected worker is unavailable, use another eligible worker.

## One Scheduler Per Job

Background execution and sub-agent delegation are separate mechanisms. Never
stack them to create a second agent path.

- Use the `Agent` tool for implementation or review sub-agents. When it should
  run asynchronously, set `run_in_background: true` on that same `Agent` call so
  its terminal result returns through the sub-agent protocol.
- Use `bg_delegate` only for its intended inspect-only, context-seeded
  investigation, then retrieve the verified result with `bg_result`.
- Use Fusion tools only for their named fixed-purpose workflows.
- Use `bg_run` only for non-agent shell processes such as tests, builds, servers,
  training jobs, and audit timers. In this setup, always set `isAgent: false`.
- Never launch `pi -p`, `pi --print`, `pi --mode json`, another LLM CLI/API, or
  a wrapper script that launches one through `bash` or `bg_run`. That is a
  shell-spawned pseudo-agent: the parent receives a process log instead of the
  real sub-agent result and lifecycle.
- `bg_run_pi_attested` is the sole exception, and only when the user explicitly
  requests an attested evidence-producing Pi run. It is not a delegation
  fallback.

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
- **Responsive by default.** Sub-agents use `Agent` with
  `run_in_background: true`; long shell calls use `bg_run` with a timeout and
  `isAgent: false`. Poll artifacts (diffs, timestamps), never status. Kill
  wrong-direction workers early and re-brief with the loophole closed.
- **Delegation is optional, not mandatory.** Delegate when genuinely
  independent, bounded work benefits; small or subtle jobs stay solo. If a
  delegated split would finish later than doing the work solo, do it solo.
  Workers may implement and run focused tests and debugging within their
  briefed scope; design, high-risk decisions, visual verdicts, and integration
  stay with the foreground.
- **Delegation contract: end notification + timeout.** Every sub-agent or
  delegate must wake the foreground on completion and be bounded by a timeout.
  For `bg_delegate`, wake defaults are on and `timeoutSeconds` defaults to 1200.
  For `Agent` + `run_in_background: true`, the wake is built in
  (`subagent-result` + `triggerTurn`), but the only timeout is the session
  watchdog (`toolTimeoutMinutes` / `idleTimeoutMinutes`) — confirm those
  thresholds before dispatching; there is no per-call timeout. Non-agent
  `bg_run` shell jobs separately require `timeoutSeconds` because absent means
  no timeout.
- **No sleeping, no soaking.** Never run `sleep N; echo ready` or any poll loop
  merely to wait for a delegated task, and never hand the live session itself
  to a sub-agent. The completion notification is the wake-up path: do
  independent foreground work if there is any; otherwise end the turn and let
  the notification wake you. Audit long-running workers at useful breakpoints
  in your own work, roughly every 5–10 minutes — there is no forced audit
  timer and no busywork requirement.
