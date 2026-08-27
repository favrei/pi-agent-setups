# Global Pi Instructions

## Model Selection

- Use `openai-codex/gpt-5.6-sol` as the main model for routine work and normal
  review.
- Do not use `opencode-go` models for routine work. Use one only when the task
  genuinely needs a larger independent review, and state why before invoking
  it. Otherwise use Sol.

## Worker Selection

- For bounded implementation work, choose randomly among eligible workers rather
  than always preferring one provider.
- Apply capability filtering before randomness. `worker-deepseek` is text-only
  and must never receive image, screenshot, video, audio, or other visual-input
  work. `worker-luna` and `worker-muse` can handle image/screenshot input.
- For text-only work, draw once with
  `node -e "console.log(require('crypto').randomInt(3))"`: `0` selects
  `worker-luna`, `1` selects `worker-deepseek`, and `2` selects `worker-muse`.
- For image/screenshot work, draw once with
  `node -e "console.log(require('crypto').randomInt(2))"`: `0` selects
  `worker-luna` and `1` selects `worker-muse`.
- Keep video, audio, PDF, or uncertain multimodal analysis in the parent using
  the available media/file tools unless the selected worker's actual input and
  tool capabilities have been verified for that task.
- Provider availability, concurrency, task-specific suitability, independent
  review diversity, or an explicit user choice may override the random draw.
  If the selected worker is unavailable, use another eligible worker.

## Elite Team Mode (user present)

When the user is actively in the session, quality and responsiveness outrank
quota savings. The `economy-team` skill still applies, with these overrides:

- **Mama agent leads.** The session analyst owns audit, design decisions,
  integration, visual verdicts, and verification itself. It writes short or
  in-context artifacts directly instead of paying briefing overhead, and it
  never delegates a judgment call.
- **Same-model escalation.** When bulk output genuinely needs elite-class
  judgment, dispatch a sub-agent on the session model or another primary-tier
  model (`openai-codex/gpt-5.6-sol`, `anthropic/claude-opus-5`,
  `opencode-go/ox-alpha-free`) via the sub-agent tool's `model` override,
  instead of forcing economy-tier workers. Use it for hard implementation or
  review lanes, not routine typing.
- **Analyst discussion.** For a named disagreement, a high-risk call, or an
  independent review where family diversity is the point, spawn another
  analyst: `analyst-opus` for elite second opinion, `analyst-qwen` /
  `analyst-kimi` for cross-family diversity. Name the disagreement in the
  brief. `analyst-glm` is text-only and never gets visual work. "More eyes"
  alone is not a reason.
- **Responsive by default.** Every dispatch sets the background flag; long
  shell calls get timeouts. Poll artifacts (diffs, timestamps), never status.
  Kill wrong-direction workers early and re-brief with the loophole closed.
- **Delegation contract: end notification + timeout.** Every task delegated
  to a background task or sub-agent must wake the foreground on completion
  and be bounded by a timeout. For `bg_run` / `bg_run_pi_attested`:
  `timeoutSeconds` (absent on `bg_run` means no timeout, so set it). For
  `bg_delegate`: wake defaults are on and `timeoutSeconds` defaults to 1200.
  For `Agent` + `run_in_background: true`: the wake is built in
  (`subagent-result` + `triggerTurn`), but the only timeout is the session
  watchdog (`toolTimeoutMinutes` / `idleTimeoutMinutes`) — confirm those
  thresholds before dispatching; there is no per-dispatch timeout.
- **No sleeping, no soaking — in the delegated scenario.** When a task has
  been handed to the background or a sub-agent, the foreground agent must
  never run `sleep N; echo ready` or any poll loop to wait for it, and must
  never delegate/merge/background the foreground conversation itself into
  the sub-agent. The completion notification is the wake-up path; do
  independent foreground work or end the turn. The one sanctioned exception
  is the audit timer: a `bg_run` with `command: "sleep 300"` (or 600),
  `isAgent: false`, and default `triggerOnCompletion`, which wakes a
  follow-up turn to audit the workers on the 5–10 minute cadence — an audit
  return, never a wait for the delegated task's own completion. Doing
  foreground tasks while a delegated task runs is a separate, allowed
  scenario — these bans are about waiting for / handing off the delegate,
  not about keeping busy.
