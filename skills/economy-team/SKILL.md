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

## Roles

**Analyst — the session model, and any `analyst-*` sub-agent**

- Audit: read the code, find the real problem, name the constraint.
- Plan: decide the design, the file layout, the acceptance test.
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

`worker-muse`, `worker-deepseek`, `worker-luna`. Treat them as interchangeable for
routine implementation and take the lucky draw: rotate rather than always
reaching for the same one. Different families fail differently, and spreading the
work surfaces that instead of hiding it.

Two hard filters before the draw:

1. **Modality.** Confirm the worker can actually take the input the task needs.
   Never assume from the role name — model assignments change. `~/.pi/agent/AGENTS.md`
   carries the current per-worker modality; that file wins over anything here.
2. **Availability.** Read `~/.pi/agent/AGENTS.md` before dispatching — it carries
   the current provider blocks (quota exhausted, auth broken) and the rotation
   policy. That file wins over anything here.

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
- Long jobs: `run_in_background: true`, then keep doing your own reading instead
  of waiting.

## Audit running workers — every 5–10 minutes

Cheap models are aggressive models. Left unsupervised, a worker will happily
spend thirty minutes solving the wrong problem and come back with nothing. A
dispatch is a **lease**, not a hand-off: while a background worker runs, you
audit it on a clock.

- **Cadence: every 5–10 minutes, chosen by task type.** Mechanical edits and
  anything touching fragile or shared files: check at the ~5 minute end. Bulk
  generation (docs, decks, test suites): ~10 minutes is acceptable for the first
  look. The supervisor — you — makes this call per dispatch.
- **Wake yourself deliberately.** Use whatever timer or scheduled wake-up the
  harness provides; if none is available, structure your own work so a natural
  pause lands inside the window. The worker's completion notification is a
  terminal report, not a substitute for mid-flight audits.
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
- **Foreground merge.** Folding the live session into a sub-agent. The user
  loses their interlocutor and the workers lose their supervisor in one move.
