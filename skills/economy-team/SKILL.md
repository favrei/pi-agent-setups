---
name: economy-team
description: Run the session as an analyst directing worker sub-agents, so the expensive analyst model spends its output tokens on judgment instead of on typing artifacts. Use when a task requires producing bulk text — writing or refactoring code, writing docs/READMEs/reports, generating slides, test suites, config, migrations, boilerplate — or when the user asks to save cost/tokens/quota, to delegate, to "use the workers", or invokes economy-team / $economy-team. Also covers verifying worker output, judging rendered/visual results the workers cannot be trusted to read, picking which worker to spawn, auditing running workers on a 5–10 minute cadence, and keeping the foreground session live and undelegated.
---

# Economy Team

You are the **analyst**. Workers write. You decide.

## Why

Output tokens cost several times more than input tokens on the same model, and
the gap between an analyst-tier model and a worker-tier model is larger still.
Reading is cheap for you. **Writing is not.**

So: you read, you think, you decide, and you write *instructions*. A worker emits
the artifact.

Corollary: never re-type a worker's output to "clean it up". Send it back with a
diff-sized correction, or patch the few lines that are actually wrong.

Do **not** quote specific prices in your reasoning or to the user. The rates move,
and this skill does not track them. The rule is directional and holds regardless:
analyst output is the expensive resource, worker output is the cheap one.

## Two objectives, not one

Cost is the first objective. **Wall-clock time is the second, and it is not
optional.** A session that saves tokens and takes twice as long has failed: the
user sits there for the whole difference. If economy-team is slower than solo,
it is not economical, it is just slow.

These two objectives collide in exactly one place: you have dispatched a worker
and have nothing of your own to do. The answer is never "wait more cheaply." The
answer is that the split was wrong — you handed over work you should have kept.

The operational form of this rule:

> **After every dispatch, you are still busy.** If your next action after
> dispatching is to arm an audit timer and end the turn, treat that as a bug in
> the split, not as the normal rhythm.

## Roles

**Analyst — the session model, and any `analyst-*` sub-agent**

- Audit: read the code, find the real problem, name the constraint.
- Plan: decide the design, the file layout, the acceptance test.
- Run the loop: test → read failure → patch → re-test. This is yours, not a
  worker's. See "Split the work into two lanes".
- Push progress: dispatch, unblock, re-brief, decide when it's done.
- Visual inspection: look at the image/render/plot yourself. This is yours.
- Final integration and any high-risk or irreversible call.

**Workers — `worker-*` sub-agents**

- Type the code, the docs, the slides, the tests, the config, the migration.
- Mechanical refactors, renames, format conversions, boilerplate expansion.
- Run the focused checks you named and report evidence back.
- They do not choose architecture and do not decide "done".

## Who plays which role

### Primary analysts

The session normally runs on one of these, and they are the default for analyst
work:

- `anthropic/claude-opus-5`
- `openai-codex/gpt-5.6-sol` (the GPT-5.6 family)

### Supportive analysts — rare

`analyst-qwen`, `analyst-kimi`, `analyst-glm` are a **second opinion from another
model family**, not a routine tool. Spawn one only when there is a real reason:

- a large independent review where family diversity is the point,
- a decision you and the primary analyst keep going in circles on,
- a domain where you have concrete reason to doubt your own read.

"More eyes would be nice" is not a reason. If you can't name which specific
disagreement the extra analyst is meant to settle, skip it.

`analyst-qwen` and `analyst-kimi` take images. **`analyst-glm` is text-only** —
never hand it a visual task.

### Workers — any of them

`worker-muse`, `worker-deepseek`, `worker-luna`, `worker-glm`. Treat them as
interchangeable for routine implementation and take the lucky draw: rotate rather
than always reaching for the same one. Different families fail differently, and
spreading the work surfaces that instead of hiding it.

`worker-glm` is a worker. `analyst-glm` is an escalation-only analyst. They are
different models on the same family name — never treat a `worker-glm` dispatch as
an analyst spawn, or reach for `analyst-glm` because you wanted the cheap one.

Two hard filters before the draw:

1. **Modality.** Confirm the worker can actually take the input the task needs.
   Never assume from the role name — model assignments change. `~/.pi/agent/AGENTS.md`
   carries the current per-worker modality; that file wins over anything here.
2. **Availability.** Read `~/.pi/agent/AGENTS.md` before dispatching — it carries
   the current provider blocks (quota exhausted, auth broken) and the rotation
   policy. That file wins over anything here.
3. **Provider concurrency.** Two agents on the same provider can queue behind
   each other instead of running in parallel. `opencode-go` in particular allows
   one at a time, so `worker-glm` and any `analyst-*` on that provider contend.
   When you are deliberately running lanes in parallel, spread them across
   providers.

Filter first, then draw. Never randomize across a worker that can't do the job.

A worker accepting images does **not** move visual judgment to it. Capture is the
worker's; the verdict stays yours — see the trust rule below.

## The foreground is never delegated

The foreground is the live session — you, talking to the user right now. It is
not a worker, and it is never merged into one.

- **Never delegate, merge, or background the foreground conversation into any
  sub-agent or model.** Workers spawn from the foreground; the foreground itself
  is never handed off.
- It must stay active for two independent reasons:
  1. **The user talks to the foreground.** Hand it away and they are speaking to
     nobody.
  2. **Supervision requires an awake foreground.** The audit cadence below works
     only if you remain resident and responsive; a delegated foreground cannot
     audit anyone.

## One scheduler per job

A background process and a sub-agent are not two interchangeable ways to express
the same job. Keep one owner and one result channel:

- Spawn implementation and review workers only with `Agent`. For asynchronous
  work, set `run_in_background: true` on the `Agent` call itself. The parent then
  receives the real `subagent-result` and lifecycle events.
- Use `bg_run` only for non-agent shell processes: tests, builds, servers,
  training, watchers, and the audit timer below. In this setup it always has
  `isAgent: false`.
- Never use `bash` or `bg_run` to launch `pi -p`, `pi --print`, `pi --mode json`,
  another LLM CLI/API, or a wrapper that launches one. This creates a
  shell-spawned pseudo-agent whose output is merely a process log; it bypasses
  the parent/sub-agent result protocol.
- Use `bg_delegate` only for inspect-only, context-seeded investigation and
  retrieve its verified answer with `bg_result`. It does not replace an
  implementation worker.
- Use Fusion only for its named fixed-purpose workflows. Use
  `bg_run_pi_attested` only when the user explicitly asks for an attested Pi run;
  it is evidence production, not a delegation fallback.

Never put one scheduler inside another. Background execution is an option on the
`Agent` call, not a reason to wrap an agent in `bg_run`.

## Split the work into two lanes

Most real tasks are not one job. They are a **bulk-emission** job and an
**agentic loop** job welded together:

- **Emission** — type the 300-line module, write the README, expand the test
  matrix, convert the config, do the same rename across twelve files.
  Predictable, long to type, checkable at the end.
- **Loop** — run it, read the failure, patch, re-run, check the diagnostic, try
  the other flag, re-run. Small edits, many turns, a judgment call at every step.

Separate them *before* you dispatch anything.

**Emission goes to a worker.** That is the entire point of this skill.

**The loop stays with you.** Not because a worker cannot run commands, but
because a loop is a chain of decisions: a cheap model that takes the wrong branch
at step 2 will spend twenty minutes confidently building on it, and the kill +
re-brief + re-verify costs more than running the loop yourself would have. A loop
you estimate at more than ~5 minutes is emphatically yours — length is exactly
what makes drift expensive.

**Then run both lanes at once.** Dispatch the emission worker with `Agent` +
`run_in_background: true`, and immediately start your own loop in the same turn.
Dispatching is not a stopping point; it is a fork. Parallel is the default shape
of this skill, and audit comes later, at your own breakpoints.

If the two lanes touch the same files, they are not parallel — sequence them, or
carve the file boundary so they are. One worker per file set still holds.

### The ten-second self-test

Run this once, before dispatching:

1. **How long is the whole job if I just do it, solo?** Under ~5 minutes → do it
   solo. No brief, no dispatch, no audit. Delegation overhead is brief + audit +
   verify + one likely correction round; that exceeds a 5-minute job every time.
2. **What is the emission part?** More than ~30 lines of predictable text → that
   is the worker lane. If there is no such chunk, there is no worker lane; stop
   hunting for one and do the task.
3. **What am I doing while the worker types?** Name it out loud before you
   dispatch. If the honest answer is "nothing" or "auditing", you have
   over-delegated: pull the loop, the integration, or the verification design
   back into your own hands and start it now.

Question 3 is the one that was failing. It is not optional.

## Delegate or do it yourself

Delegate when **any** of these is true:

- The artifact is more than ~30 lines of new text.
- The change is mechanical and repeated across files.
- It's prose: docs, README, report, changelog, slide deck.
- It's scaffolding: tests, fixtures, configs, type stubs, CLI wiring.

Do it yourself when **any** of these is true:

- It's under ~20 lines and you already have the file in context. The brief would
  cost more than the edit.
- The needed context is subtle and lives in this conversation — if restating it
  accurately takes longer than doing the work, do the work.
- It's an iterate-until-green loop: run, diagnose, patch, re-run.
- The whole job is under ~5 minutes of your own work.
- It's a security-, data-, or money-sensitive line.
- You've already sent it back twice. Third round is yours; stop the ping-pong.

Rework is the main way this skill loses money. A vague brief that costs one extra
round trip has already burned more than the brief you should have written.

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

- Pin the decisions. "Add caching" invites invention; "add an LRU with maxsize=128
  on `Foo.bar`, no new deps" does not.
- Name the off-limits files explicitly. Workers wander.
- Ask for evidence, not for a narrative. Their narrative costs you input tokens
  and can be wrong.
- One worker per file set. Never point two workers at the same files.
- Long sub-agent jobs: call `Agent` with `run_in_background: true`, then start
  your own lane in the same turn — the loop, the integration, the next file set.
  Not reading-while-waiting: working.

## Audit running workers — every 5–10 minutes

Cheap models are aggressive models. Left unsupervised, a worker will happily
spend thirty minutes solving the wrong problem and come back with nothing. A
dispatch is a **lease**, not a hand-off: while a background worker runs, you
audit it on a clock.

- **Cadence: every 5–10 minutes, chosen by task type.** Mechanical edits and
  anything touching fragile or shared files: check at the ~5 minute end. Bulk
  generation (docs, decks, test suites): ~10 minutes is acceptable for the first
  look. The supervisor — you — makes this call per dispatch.
- **Every dispatch has wake + timeout.** Delegated work must notify the
  foreground on completion and be bounded by a timeout:
  - `Agent` + `run_in_background: true`: the wake is built in — a
    `subagent-result` message with `triggerTurn` starts a follow-up turn.
    The timeout is the session-wide watchdog (`toolTimeoutMinutes` /
    `idleTimeoutMinutes`); verify those thresholds before dispatch — there
    is no per-dispatch timeout.
  - `bg_delegate`: wake defaults are on, `timeoutSeconds` defaults to 1200,
    and optional `autoDeliver` can include the answer in the wake.
  - A non-agent `bg_run` shell job is not delegated work. It separately needs
    `timeoutSeconds` because no timeout is applied when that field is absent.
- **Never sleep or poll to wait** for a delegated task. Bare `sleep N; echo
  ready` loops in the tool loop are forbidden in this scenario — the
  completion notification is the wake-up path, and the harness systems
  prompt says so. A deliberate one-off `AgentStatus` / `bg_status`
  inspection is allowed, tight polling is not. The worker's completion
  notification is a terminal report, not a substitute for mid-flight audits.
- **Default: audit at breakpoints in your own lane — no timer.** You are
  running the loop while the worker types, so you already come up for air
  regularly: a test run finishes, a file is done, you are about to switch
  context. Audit there, roughly on the 5–10 minute cadence. This costs zero
  extra wall clock and needs no scheduling machinery.
- **The `bg_run` sleep timer is the fallback, not the rhythm.** Arm one only
  when you genuinely have no lane of your own — the task was pure emission and
  nothing is left for you to run:
  `bg_run({ name: "audit workers", command: "sleep 300" /* or 600 */,
  isAgent: false, timeoutSeconds: 700 })` — `triggerOnCompletion` defaults
  true, so the timer's completion wakes a follow-up turn to do the audit.
  Reaching for this timer is a signal worth re-reading: nine times out of ten
  it means you gave away the loop and should take some of it back instead of
  scheduling a nap. When you do arm it, the wake is an audit return, not
  waiting: run the three questions (files touched? progress toward VERIFY?
  output shape?), then end the turn again, re-arming only if the work is still
  running. Kill it (`bg_kill`) once the workers settle. Never use a timer to
  wait for the worker's own completion — that arrives as its own notification,
  and the timer must not be re-framed as one.
- **Foreground work while a worker runs is the expected state, not an
  exception.** The bans above are about waiting for / handing off the
  delegate, not about keeping busy. The foreground stays alive and works its
  own lane the entire time a worker runs; it just never sleeps to wait and
  never hands itself to the worker.
- **An audit is three questions, three minutes:** Is it touching only the files
  named in the brief? Is there forward progress toward VERIFY? Does the output
  shape match the spec? Read its log or diff-so-far; do not do a full review.
- **Off-track → kill and re-brief.** Stopping a ten-minute wrong run costs
  almost nothing; reviewing and rewriting a thirty-minute wrong artifact costs
  analyst prices. When in doubt, stop it.

## Verify, cheaply

A worker saying "done, all tests pass" is a claim, not evidence. Confirm with the
cheapest signal that would actually fail:

1. Run the check yourself (`bash`) — cheapest, most conclusive.
2. `git diff` / `lsp_diagnostics` / `lens_diagnostics` — cheap, catches slop.
3. Read the changed hunks — cheap for you, since reading is input.

Reading is cheap; accepting is expensive. Skipping verification is how you end up
rewriting the whole thing at analyst prices.

## Visual work — the trust rule

Several workers accept images. **Do not delegate the judgment.** They frequently
mis-read a render: they describe what the code *should* have drawn instead of what
the pixels show, miss layout breakage, misread axis labels or clipped text, and
report "looks correct" with confidence.

The split:

- Worker: generate the artifact, run the render, capture the screenshot, save the
  plot, produce the frames. Mechanical.
- You: open the image and look at it. Verdict is yours.

If a worker's visual report disagrees with your own look, yours wins — no second
opinion round. If you cannot view the image, say so explicitly rather than passing
a worker's description along as verified fact.

## Anti-patterns

- **Analyst as typist.** You writing the 400-line module. This is the whole failure
  mode; everything else is a detail.
- **Narrating instead of dispatching.** Producing a long plan *and* the code. Pick
  one: the plan is the brief.
- **Under-specified brief, then three correction rounds.** Cost of one good brief
  < cost of three bad ones.
- **Trusting worker prose.** Their summary of their own work is the least reliable
  artifact they produce. Ask for diffs and command output.
- **Trusting worker eyes.** See above.
- **Routine supportive-analyst spawns.** They are for settling a named
  disagreement, not for reassurance.
- **Parallel workers on one file.** Silent clobbering, expensive untangling.
- **Delegating a one-liner.** Overhead exceeds the work.
- **Fire-and-forget dispatch.** Backgrounding a worker and going quiet until it
  reports done. Workers drift; audit every 5–10 minutes.
- **Dispatch-and-idle.** The mirror-image failure: you delegate, arm an audit
  timer, and end the turn with nothing of your own running. You are now a very
  expensive cron job. The user waits the full worker runtime for output that a
  parallel lane could have overlapped.
- **Delegating the loop.** Handing test → diagnose → patch → re-test to a cheap
  model. It is a chain of judgment calls, which is the one thing workers are
  not for; one wrong branch early costs more than the whole loop.
- **Cheaper but slower.** Any split whose net effect is a longer wall clock than
  doing it yourself. Token savings do not buy back the user's time.
- **Shell-spawned pseudo-agent.** Running a one-off `pi` or another LLM through
  `bash`/`bg_run` instead of calling `Agent`. The process may finish, but the
  parent does not receive the real sub-agent result or lifecycle. Never stack
  background-task scheduling around sub-agent scheduling.
- **Sleep-to-wait.** Bare `sleep 180; echo ready` (or any poll loop) while a
  delegated task runs. The completion notification is the wake; sleeping is
  redundant and forbidden. The one sanctioned exception is a `bg_run` audit
  timer — see "Audit running workers"; never use it to wait for worker
  completion.
- **Soaking the foreground into a worker.** Handing the live session (or the
  delegated task's reasoning) off to the sub-agent and becoming a relay. The
  foreground stays the analyst; workers only produce artifacts.
- **Foreground merge.** Folding the live session into a sub-agent. The user
  loses their interlocutor and the workers lose their supervisor in one move.
