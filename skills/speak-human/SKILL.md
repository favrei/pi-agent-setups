---
name: speak-human
description: Rewrite dense, jargon-heavy, or context-skipping technical output — coding-agent hand-offs, ML/experiment logs, benchmark or eval reports, and other AI/model output — into something a reader coming in cold can follow. Defines every non-obvious term, label, or acronym on first use, reconstructs the baseline or comparison a bare number implies, and states the plain-language bottom line the original left out. Use whenever the user pastes text that reads like a machine talking to itself — terse status updates, undefined internal labels/codes, results with no stated expectation — or invokes speak-human / $speak-human, or asks to "translate," "decode," or "make this readable."
---

# Speak Human

Rewrite text written by (or for) a machine so that a person who was **not** already inside that context can understand it without asking follow-up questions.

## The failure this fixes

This is not a bad-writing problem, it is a **collapsed-context** problem. The model that produced the original was reasoning against its own working state — logs, configs, code, an internal label scheme — then handed over a "summary" as if the reader had been sitting beside it the whole time. It uses category names and abbreviations it never defines, reports numbers with no baseline or expectation, and skips the "so what" that would make the result actionable. Reading it feels like overhearing one side of a phone call.

The fix is **not** fluff or flowery prose. Match the original's density — just make every piece of it stand on its own.

## Scope: a one-off decode, not a new default voice

This skill applies to the specific text handed over, **once**. It is a single translation pass over already-produced output, not a standing change to how you communicate for the rest of the conversation.

- **Don't let "explain everything, assume nothing" become your new voice.** After the decode is delivered, go back to normal. A technical audience still gets technical answers in later messages — don't pre-emptively over-explain, hedge, or pad because this skill fired once.
- **This governs the explanation, not the underlying work.** If the text carries real technical content — a design decision, a diagnosis, an actual result — make that content *legible*, don't weaken it. Don't flatten a genuine tradeoff into a tidy sentence, drop a caveat that mattered, or let precision erode in translation. The packaging changes; the substance does not.

## Method

1. **Read the whole passage before rewriting anything.** Work out what system or pipeline produced it, what is actually being measured, and what the overall point is. Decoding line by line without that picture will misdefine terms.
2. **Find every term that is not self-explanatory to an outsider** — custom label/category names, acronyms, internal tool or module names, and any number stated with no baseline or expected value. Gloss each one in plain English the first time it appears.
   - Standard technical vocabulary for a plausibly technical reader ("validation set," "false positive") needs only a brief gloss — don't over-explain or condescend.
   - Project-specific shorthand whose exact meaning is not recoverable from the surrounding text: say what it *most likely* means from context, and **flag that as an inference, not a fact**. Never present a guess as confirmed.
3. **Reconstruct the comparison every bare number implies.** "105 errors," "94%," "up 3x" mean nothing without what they are measured against — a baseline, an ideal/ground-truth value, a prior run. State that comparison out loud even when the original left it implicit.
4. **Preserve every number and result exactly.** Never round unusually, drop a reported figure, or invent one not in the source.
5. **End with the bottom line** — one or two plain sentences: what this means in practice, and, if the text shows it, what it implies should happen next. This is usually the most important part of the rewrite and the part the original skips most.
6. **Don't pad.** The goal is fully self-contained, not longer. If a sentence was already clear, tighten it or leave it — don't restate the obvious.

## Output shape

A short walkthrough usually beats a rigid template:

- Decode the terms that need it, in the order they appear or grouped by concept — whichever reads more naturally.
- Close with the plain-language bottom line, stated once, clearly.
- When inferring a project-specific term's meaning, flag it in the same breath — not as a disclaimer bolted on at the end.

## Tone

State the plain meaning directly — don't perform confusion or over-hedge ("I think this might possibly mean…"). Reserve the "this is inferred" flag for genuine project-specific unknowns, not for ordinary technical vocabulary you are confident about.

## Example

**Input** (a typical agent hand-off):

> Nightly run: 12 flaky-quarantine promotions, 3 red on full-matrix. Root cause is the fixture teardown racing with the new async client — same shape as last Tuesday's ingest-worker regression.

**Output:**

Last night's automated test run flagged 12 tests as "flaky" and moved them into quarantine — a holding area for tests that fail inconsistently, so they don't block other work while someone investigates. Separately, 3 tests failed outright ("went red") when run against the full test matrix — the complete set of environments/configs the suite covers, as opposed to a quick subset.

Suspected cause: a race condition. The test cleanup step (fixture teardown) is running at the same time as calls from the new async client instead of waiting for it to finish, so cleanup sometimes happens before the client is done. This looks like the same underlying bug behind a similar failure in the ingest-worker component last Tuesday.

**Bottom line:** this is probably one timing bug surfacing in many tests, not 15 separate problems — and it has recurred in a different component before, so it is worth fixing at the root (the teardown/async ordering) rather than patching each failing test individually.
