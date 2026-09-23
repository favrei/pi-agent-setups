# Example structures (not required formats)

Borrow whatever helps for a given task. Contracts and briefs normally live in the conversation and worker prompt; reports normally come back as subagent results. For long resumable work, use the project's temporary planning area rather than memory.

## Acceptance contract

```markdown
# Contract: <task name>
Owner: <user>   Created: <date>   Status: draft | confirmed

## Return picture
When the owner comes back, they will see:
- <concrete artifact 1, with path>
- <concrete number/figure 2>

## Acceptance criteria
| # | Criterion (checkable) | How the manager verifies it |
|---|---|---|
| A1 | ... | ... |

## Non-goals
- ...

## Constraints
- Budget: <time / GPU-hours / worker runs>
- Off-limits: <files, data, systems>
- Environment: <machine, framework versions>

## Known risks → mitigation
- <risk> → <how prevented or detected>

## Escalate to owner if
- ...

## Assumptions (if owner said "just go")
- ...
```

## Worker brief (prompt)

```markdown
# Brief NN: <name>
Milestone: <M#>   Attempt: 1 | redirect-1 | restart-1

## Goal
<one paragraph: what and why>

## Scope
May modify: <paths>
Must NOT modify: <eval data, metric code, anything else>

## Context you need
- <facts, paths, commands>
- Ruled out already (do not retry): <relevant prior decisions>

## Done means
- <deliverable with path>
- Evidence required: <command outputs, logs, image paths, metric JSON>

## Stop and report (do not work around) if
- <condition>
- Any destructive or irreversible action seems necessary
```

A redirect should say what was wrong and what evidence would resolve it.

## Worker report (subagent response by default)

A report may use this structure when it helps:

```markdown
# Report NN: <name>
Status: done | partial | blocked

## What I did
- <step> → evidence: <path or command output>

## Results
| Claim | Evidence (path / command) | Did I check it myself? (yes/no) |
|---|---|---|

## Not done / not verified
- <item and why>

## Problems encountered
- <including anything I worked around>

## Files changed
- <path>: <one line>
```
