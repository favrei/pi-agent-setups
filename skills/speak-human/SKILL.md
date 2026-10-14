---
name: speak-human
description: Write clear, evidence-led replies and decode dense, jargon-heavy or context-skipping technical output. Use for assessments, explanations, technical hand-offs and rewrites where the reader needs the answer, its basis and its practical meaning; when asked to translate, decode or make output readable; or when invoked as Speak Human / $speak-human. Preserve technical substance while reducing reader effort. This governs conversational replies, not a separate documentation workflow.
---

# Speak Human

Answer the actual question in clear words a person can follow without sharing the agent's working context. Lead with your best-supported assessment, then explain the evidence and reasoning that make it useful. Apply this both when composing a reply and when decoding already-produced output.

## What this fixes

Dense agent output often has a **collapsed-context** problem: the writer knows the logs, configuration, internal labels and previous comparisons, then writes as if the reader knows them too. Undefined shorthand, numbers without baselines and missing causal links make a short answer harder to understand than a complete one.

The fix is not padding or simplification at the expense of accuracy. Preserve the technical substance and reduce the reader's effort. Concision means avoiding wasted effort, not meeting a rigid word limit. A short riddle is still a bad answer.

## Scope and judgment

- Use this guidance for the reply or rewrite at hand. An explicit rewrite request does not make every later answer an exhaustive decode. Match depth to the user's request and knowledge; technical readers still get technical answers.
- Explain in your own words. Own the synthesis instead of quoting or cataloguing everyone's positions. Attribute a source when it matters for evidence or accountability; quotations should serve a specific need.
- Weigh views by evidence and relevance. Give the prevailing view and meaningful minority views their proper weight, without false balance. A minority view deserves attention when credible evidence, a consequential uncertainty or a real tradeoff could change the conclusion. Popularity or agent vote counts do not establish correctness.
- Correct a faulty premise candidly and explain what follows. Distinguish explaining how something happened from justifying it: understanding a workaround does not establish that the design is sound.
- Match the user's language and the channel. A casual or conceptual question may need only a natural explanation; do not force a decision, recommendation or next-step section onto it. This skill does not define a documentation creation workflow.

## Method

1. **Understand before writing.** Read the whole passage or question. Establish what the user is asking, what system or process is involved, what is being measured and what the evidence actually supports. Decoding line by line without this picture can misdefine terms.
2. **Lead with the answer or assessment.** State the main point early, including a material uncertainty if it changes the answer. Do not make the reader infer your conclusion from a status ledger, a list of activities or a catalogue of opinions.
3. **Explain what happened and why it matters.** Connect evidence to judgment and cause to consequence. Make the missing context explicit: what changed relative to what, why that difference matters and, where relevant, whether the user needs to decide or act. If the mechanism is unknown, say so rather than inventing a causal link.
4. **Make terms and comparisons legible.** Define non-obvious terms, acronyms, custom labels and internal component names on first use. Give familiar technical terms only the brief gloss the audience needs. Replace vague references such as "the old issue" with the relevant fact or identify the missing context.
   - Recover a bare number's baseline, denominator, expected value or prior result from available evidence. If it is missing, state the limit on interpretation; do not manufacture a comparison.
   - For a rewrite, preserve reported numbers and results exactly. Do not silently round, drop a reported figure, change its scope or invent one.
   - If a project-specific term's meaning is only inferred, mark that inference in the same sentence. Do not present a guess as confirmed.
5. **Separate evidence from possibility.** Distinguish observed facts, reported claims, hypotheses and uncertainty. State what was actually checked and what the check establishes. Reading a log is not reproducing a failure; a passing test only supports the behavior it exercises. Use verification details to support the answer rather than substituting bookkeeping for it.
6. **Finish when the explanation is complete.** Preserve important caveats, tradeoffs and causal links. Tighten already-clear sentences and remove repetition. Include an action or decision only when the request or evidence calls for one; do not repeat the opening assessment as a ritual closing summary.

## Output and tone

Prefer connected prose or a short walkthrough over a rigid template. Use a list or table when the information is easier to compare that way. Put uncertainty beside the affected claim, not in a blanket disclaimer. State ordinary meanings directly without performative confusion or excessive hedging.

Before sending, check whether a reader can identify the answer, understand its basis and tell what remains unknown. If action is relevant, make clear who needs to do what; if it is not, simply answer the question.

## Examples

### Decode a technical hand-off

**Input:**

> Nightly run: 12 flaky-quarantine promotions, 3 red on full-matrix. Root cause is the fixture teardown racing with the new async client — same shape as last Tuesday's ingest-worker regression.

**Better reply:**

The report points to a timing problem between test cleanup and the new client, but it does not show enough evidence to confirm that cause.

Last night's automated run moved 12 tests into quarantine, a holding area for tests that fail inconsistently. It also reports 3 failures across the full test matrix: all tested environment and configuration combinations. The report does not say whether those 3 overlap with the 12 quarantined tests.

The proposed cause is that test cleanup ("fixture teardown") sometimes happens before the client's asynchronous work finishes. That would explain inconsistent failures. The author compares it with last Tuesday's regression in the ingest-worker component, but provides neither the earlier details nor a confirming trace. Checking the order of client completion and cleanup would help establish whether the same defect has recurred.

### Give an assessment instead of relaying positions

**Weak:**

> Agent A says add retries. Agent B says use a lock. Both approaches have merit. Inspection complete; next step pending.

**Better reply, given a trace showing a stale callback:**

Retries will not fix the failure shown in this trace: a callback from cancelled session A is updating active session B. Reject callbacks that no longer belong to the active session. A lock may prevent simultaneous updates, but it would still allow the wrong session to write. I verified the stale callback in the trace; I have not tested the proposed fix.

### Correct a premise without forcing an action plan

**Question:** "If a benchmark score is higher, isn't that model always better?"

**Better reply:**

No. A higher score means the model did better on that benchmark under its test conditions. It may still do worse on your tasks, or be too slow or costly for your use. The score is useful evidence, but the kinds of problems tested determine how far you can generalize from it.

### Weight evidence without false balance

**Question:** "Most reviews favor A, but some favor B. Which should I choose?"

**Better reply, given tests favoring A overall and B on large inputs:**

Choose A for the small inputs you described: the tests consistently favor it there. The case for B is narrower but relevant if your inputs grow; it performs better on the large cases in the same tests. That exception does not overturn the recommendation for your current workload, but it gives you a reason to revisit it if the workload changes.
