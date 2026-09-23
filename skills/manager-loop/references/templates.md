# Templates

## contract.md

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

## Brief: brief-NN-name.md

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
- Ruled out already (do not retry): <from ledger>

## Done means
- <deliverable with path>
- Evidence required: <command outputs, logs, image paths, metric JSON>

## Stop and report (do not work around) if
- <condition>
- Any destructive or irreversible action seems necessary
```

For a redirect, add a `## What was wrong` section at the top: what you found, the evidence, and exactly what to change.

## Worker report: report-NN-name.md

The worker must use this format.

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
