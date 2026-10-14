---
name: write-clear-documents
description: Plan, draft and revise standalone documents so readers understand the main takeaway, reasoning and useful detail. Use for technical designs, evaluation reports, proposals, handoff documents and explanatory documentation, or when asked to improve a document's argument, structure or readability. Governs editorial reasoning and narrative; cooperate with applicable format, storage and rendering skills. Use Speak Human for ordinary conversational replies rather than invoking this document workflow.
---

# Write Clear Documents

Do the thinking, then make it easy for the reader to understand. Build a coherent explanation or argument around the document's purpose, supported by evidence. Preserve the technical conditions that make the conclusion true; remove the work the reader would otherwise have to do to reconstruct the point.

## Scope and cooperation

This skill governs editorial choices for standalone documents, including documents drafted in chat. Speak Human governs conversational replies and one-off decoding. Shared clarity principles do not require loading both skills for every task.

Use applicable document, research, format, template, storage and rendering skills for their own procedures. This skill neither selects a destination nor changes their required tool order or validation steps. Respect the requested language, format, length and existing document conventions. A narrow correction does not call for restructuring the whole document.

## Working method

### Establish the reader's job

Determine the audience, purpose, assumed knowledge and what the reader should understand or be able to do afterward. Infer these from the request and supplied material where possible; ask only when the missing answer would materially change the document. This is an authoring decision, not a mandatory audience/purpose box in every output.

Find the main takeaway before drafting the body. Open with that takeaway and enough context to explain why the subject matters. Establish why before how, while keeping procedural documents easy to use: a brief purpose and prerequisites can precede the steps. Do not force an executive summary or decision request onto every document.

### Synthesize before arranging

Read the available material as evidence for the reader's question. Work out which claims are established, which are interpretations, which are hypotheses and which are proposals. Resolve apparent disagreements where the evidence permits; otherwise explain the unresolved difference and its consequence.

Organize around the explanation, argument or reader task. Do not substitute a chronological account of the author's work or a source-by-source digest. Chronology is appropriate when the sequence itself explains causation, as in an incident analysis.

Use evidence to support your synthesis. Weigh competing interpretations by evidence and relevance rather than giving every source equal space. Explain causal links; when only correlation or a plausible mechanism is known, say so. Do not invent opinions, commitments, approval, owners or deadlines on the user's behalf. Mark suggestions and illustrative examples as such.

### Choose a useful structure

These are adaptable patterns, not required headings or exhaustive templates:

| Document | Reader's central need | Useful progression |
|---|---|---|
| Technical design | Understand the problem and evaluate the approach | Problem and constraints; proposed behavior and mechanism; meaningful alternatives and tradeoffs; failure cases; validation and open questions |
| Evaluation or report | Understand what the evidence establishes | Finding; comparison and test conditions; decisive results; interpretation and limitations; implications justified by the evidence |
| Proposal | Judge whether an intervention is worth pursuing | Need and desired outcome; proposed change and why it should help; supporting evidence; costs, risks and alternatives; decision requested if applicable |
| Handoff | Continue the work without reconstructing the session | Current state; verified behavior and unresolved issues; next decisions or actions; reproducible pointers and known prerequisites |
| Explanatory document | Build an accurate mental model | Main idea and why it matters; concepts in dependency order; mechanism or worked example; boundaries and common misunderstandings |

For evaluations, preserve baseline, denominator, units, dataset or workload, configuration, versions and measurement method where they affect the comparison. Distinguish observations from broader claims. Missing conditions limit the conclusion; do not fill them in by guessing.

For handoffs, distinguish completed, verified, proposed and blocked work. Supply actual paths, identifiers, commands or source links needed to resume or reproduce it, with prerequisites and expected results when known. Verify pointers when access permits; flag those not checked. A list of activities alone is not a usable handoff.

### Write the narrative and layer the detail

Use informative headings that communicate each section's point, such as "The timeout starts before the queue drains" rather than "Analysis" when the evidence supports that claim. Define unfamiliar terms at first use. Add a concrete example when it explains an abstraction more efficiently than another definition.

Connect paragraphs so the reader can follow what happened, why it happened or might have happened, and why it matters. Keep the conditions that qualify the main takeaway beside it. Put lengthy logs, derivations, comprehensive result tables and reference material in appendices or linked sections, with clear pointers from the narrative. Layering detail must not hide a caveat that changes the conclusion.

Concision is not a fixed short length. Preserve necessary technical depth, causal links and conditions; cut repetitions, unsupported marketing claims, jargon and detail that serves no reader need. Avoid making the reader chase vague references such as "the previous approach" or decode unexplained labels.

### Use visuals only when they reduce mental work

Choose a visual for a specific explanatory job: a flow diagram for sequence or responsibility, a chart for a measured comparison, or a table for parallel alternatives. Prefer a few meaningful groups and clear labels. Do not turn the entire document into a crowded architecture diagram or use decoration as evidence.

Keep visuals consistent with the text and identify hypothetical flows or illustrative data. Supply units, comparison conditions and a useful caption where needed. Follow the relevant rendering skill for implementation and visual inspection; a diagram is optional when a sentence would communicate the point more clearly.

## Quality check before delivery

- Can the intended reader find the takeaway early and understand why it matters?
- Does the structure follow the reader's question, rather than the author's work history or source order?
- Do facts, interpretations, hypotheses and proposals remain distinguishable? Are claims no stronger than the evidence and actual verification?
- Are necessary comparisons, causal explanations, definitions and limitations present? Are numbers and references faithful to the source?
- Is deeper detail reachable without cluttering the narrative or hiding decisive caveats?
- Do examples and visuals reduce mental effort? Are headings informative and references specific?
- Does the document respect the requested language, format, length and scope, with no invented user commitments?
- For a handoff, can the next person continue from its state and pointers? For a report, can they tell what was compared and how far the result generalizes?

Revise what fails these checks. Report rendering, link or reproduction checks only if performed; editorial review alone does not verify the underlying claims.

## Representative before and after

The following examples use hypothetical evidence to demonstrate structure, not facts about the user's work.

### Evaluation: keep the finding and its limit together

**Before:** "We ran A, discussed B, reran the benchmark and checked logs. B scored 94% and A scored 91%. B is clearly superior."

**After, given one run on 100 held-out examples:** "B answered 94 of 100 held-out examples correctly, compared with A's 91 on the same examples. That is a three-percentage-point advantage in this run. It supports further evaluation of B, but one run does not establish that B will perform better across other workloads. The appendix records the model versions, prompts and item-level results so the comparison can be checked."

Only include that appendix sentence when those records actually exist. Do not transform missing provenance into a polished claim of reproducibility.

### Design: explain the mechanism before the inventory

**Before:** "The solution uses a queue, worker, retry layer and idempotency mechanism for a robust, scalable architecture."

**After:** "The proposal lets the request return after its job is queued, so the caller does not wait for processing. A worker processes the queued job. Because retrying can deliver the same job more than once, the worker records completed job IDs and skips repeats. This prevents duplicate effects only if recording completion and applying the effect succeed together; the design still needs to specify that guarantee."

A small request-to-queue-to-worker diagram could clarify this flow. A box for every implementation component would obscure the responsibility being explained.

### Handoff: replace activity with usable state

**Before:** "Refactor done. Tests green. Config issue remains. See above."

**After, given this evidence:** "The parser refactor is implemented and its unit tests pass. Startup still fails when the configuration omits the timeout value; that path was not covered by those tests. The next decision is whether timeout should be required or have a default. The handoff should then point to the failing configuration, exact reproduction command and test result, so the next person can confirm the failure before changing behavior."

In a real handoff, supply those verified pointers instead of leaving the final sentence as an instruction to the reader.
