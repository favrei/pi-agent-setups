# pi-agent-setups

A portable, reproducible setup for the [pi coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent): extensions, sub-agent roles, and working-method skills — packaged so a fresh machine can be brought up by handing this repo to an agent and saying "set this up".

This repo is **public**. Everything in it is deliberately generic. See [What this repo will never contain](#what-this-repo-will-never-contain).

---

## Who this is for

**If you're me:** this is the drop-in. On a new box, say `/my-pi-setup` and what you want — the skill knows where this repo lives and does the rest. The parts that are machine-specific or private are *not* here by design; you re-add them locally, and they stay local.

**If you're a visitor:** this is a worked example of a pi configuration that delegates bulk output to cheap sub-agents when it genuinely helps and keeps judgment in the session model. The `economy-team` skill is the interesting part; the rest is plumbing. Take what's useful, none of it depends on anything private.

---

## Quick start

**There is no installer script.** The agent is the installer, via the bundled [`my-pi-setup`](skills/my-pi-setup/SKILL.md) skill. Put that skill where your agent can see it, then just say what you want:

```text
/my-pi-setup install this on this machine
/my-pi-setup disable worker-luna here and upstream
/my-pi-setup what's different between this box and upstream?
```

`/my-pi-setup` isn't a command with subcommands — it names *the upstream repo*, and the sentence around it is the instruction. The skill fetches the repo itself, so it works from any directory, with or without a local clone.

What it guarantees, whatever you ask: it compares before writing and skips identical files, backs up anything it's about to change to `<file>.bak-<UTC timestamp>`, **merges** `settings.json` rather than overwriting it, and never deletes anything this repo doesn't ship. It never touches `auth.json` and never logs in.

If you'd rather do it by hand, the mapping is the whole spec:

```text
agents/            9 sub-agent role definitions -> ~/.pi/agent/agents/
skills/            4 portable skills            -> ~/.agents/skills/ (or their existing skills root)
extensions/        2 local pi extensions        -> ~/.pi/agent/extensions/
patches/           third-party package fixes  -> ~/.pi/agent/patches/  (copied, NOT run)
config/
  AGENTS.md           copied to ~/.pi/agent/AGENTS.md
  settings.json       MERGED into ~/.pi/agent/settings.json
  subagents-lite.json copied to ~/.pi/agent/subagents-lite.json
pi/
  web-search.json     copied to ~/.pi/web-search.json
```

Note the two distinct roots. `config/` installs into `~/.pi/agent/`; `pi/` installs one level up into `~/.pi/`, which is where `pi-web-access` reads its own config from. Putting `web-search.json` under `config/` would land it in `~/.pi/agent/`, where the extension never looks — it would appear installed and silently do nothing.

**After install, you still have to do these yourself — the installer deliberately won't:**

1. **Log in.** Launch pi and authenticate each provider you actually use. Nothing here touches credentials — the skill is explicitly instructed to stop and hand back rather than attempt auth.
2. **Confirm the model IDs** in `config/subagents-lite.json` still exist. Providers rename and retire models constantly, and a stale ID fails at sub-agent spawn time — not at install time, so the installer cannot catch it for you.
3. **Re-add private, machine-specific skills** (see [Local-only skills](#local-only-skills)) and, optionally, the third-party skills this repo doesn't vendor.
4. **Run the local patches.** `patches/` is copied, never executed by the installer. Until you run it, the shipped fix is present as a file and absent as a fix — see [Local patches](#local-patches).

---

## What's in the box

### pi extensions

Declared in `settings.json` under `packages[]`. All but one are published to the public npm registry.

| Package | Publisher (npm maintainer) | What it gives you |
| --- | --- | --- |
| `pi-meta-oauth` | `blockedredemption` | Meta Model API OAuth provider + Muse video/audio/file analysis tools |
| `@narumitw/pi-goal` | `narumitw` | Actively maintained autonomous goals with guarded continuation, explicit completion/blocker/wait states, and safety limits |
| `pi-subagents-lite` | `alexparamonov` | Sub-agents with isolated sessions and per-role models — the `Agent` tool |
| `pi-background-tasks` | `ismailsaleekh` | `bg_run`, `bg_delegate`, attested Pi runs, and the `fusion_*` multi-model workflows |
| `pi-claude-auth` | `pankajudhas81` | Reuses existing Claude Code credentials — no separate login |
| `pi-web-access` | `nicobailon` | `web_search`, `fetch_content`, GitHub/PDF/YouTube handling — routed Codex-first, see [Search routing](#search-routing) |
| `pi-codex-search` | `133cha31` | `codex_search` — web search through an existing ChatGPT Plus/Pro Codex subscription |
| `pi-mcp-adapter` | `nicobailon` | MCP gateway (`mcp`) and batch scripting (`mcpScript`) |
| `pi-ssh` | `favrei` fork of `HCAHOI` (GitHub) | `ssh_*` tools and `/ssh` — read, edit, grep, and run commands on an already-authorized remote over one reused connection; `ssh_process` for long jobs, `ssh_push`/`ssh_pull`, `ssh_tunnel`, `ssh_secret_write` |

All MIT except `pi-background-tasks` (ISC). None are first-party to pi itself — this is a community stack.

**Package versions are unpinned by design.** Every npm entry in `packages[]` is a bare name, so a fresh install takes the current release and an existing one is free to move. The earlier pins were snapshots of whatever happened to be installed the day they were written, and they rotted — `pi-meta-oauth` sat at `0.3.0` while upstream shipped `0.4.4`, which is a stale auth extension rather than a conservative one. Reproducibility here is not worth a standing manual upgrade chore across machines. If you need a build frozen, pin it locally in `~/.pi/agent/settings.json`; that stays out of this repo.

`pi-ssh` uses the owner's fork, `git:github.com/favrei/pi-ssh`, with no commit, tag, or branch pin. The owner decides which version the fork provides. Do not substitute `HCAHOI/pi-ssh` or automatically add a version pin. Review changes when updating, and use `/reload` to load changed extension code into an already-running Pi process.

One install caveat, because it will look like a broken install rather than a known one: `pi-ssh`'s committed `package-lock.json` embeds its author's absolute paths, so npm produces dangling `node_modules` symlinks for `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox`. Delete those three links after install or upgrade and re-point them at the paths under your own pi installation. Nothing in this repo automates it.

### Search routing

`pi/web-search.json` pins `web_search` to an explicit provider order instead of leaving it on the extension's automatic chain:

```json
{
  "searchRouting": {
    "providers": ["openai", "exa"],
    "fallbackOn": ["transient", "quota", "network", "invalid-response", "unsupported"]
  }
}
```

OpenAI search here means **Codex-backed**: `pi-web-access` resolves credentials from Pi's own model providers in the order `["openai-codex", "openai"]`, so an existing Codex subscription is reused and no separate API key is configured. Exa is the keyless fallback, and it is reached only on the listed typed failures — not on a genuine empty result, which stays a real answer.

Left unconfigured, the automatic chain prefers Exa *unless* the active model happens to be `openai-codex`, which makes search quality depend on which model you are currently driving. Pinning the order removes that coupling.

This file contains no credentials — only provider names and failure classes — which is why it is safe to ship here while `auth.json` never is.

`pi-codex-search` is the second, independent Codex search path. It registers its own `codex_search` tool rather than replacing `web_search`, so the two coexist: `web_search` gives you the routed multi-provider chain with the curator UI, `codex_search` goes straight to the Codex Responses API and can batch up to 32 queries in one call. Both reuse the same `openai-codex` OAuth credential, so neither needs an API key. Its optional `codex_standalone_web` tool (open/find/click/screenshot) is off unless enabled. Config, if you want to change defaults, is `~/.pi/pi-codex-search.json` — the same `~/.pi/` root as `web-search.json`, not `~/.pi/agent/`. Nothing is shipped here, since the defaults are fine.

### Local extension

- `extensions/tool-pair-repair.ts` — repairs Anthropic `tool_use`/`tool_result` pairing at the last gate before the HTTP request. Without it, an interrupted tool call can wedge a session into an unrecoverable `400: tool_use ids were found without tool_result blocks`. Unpublished, self-contained, ~150 lines.

### Local patches

`patches/` holds fixes for **third-party packages this repo does not own** — code under `~/.pi/agent/npm/node_modules/`, which `pi update --extensions` replaces wholesale. Installing this repo copies the scripts to `~/.pi/agent/patches/`; **it does not run them.** Each is a standalone Python 3 script, safe to re-run, and refuses to touch a version it wasn't written for.

- `pi-background-tasks-2.6.2-transcript-context.py` — pi 0.86 changed what a provider is handed. The context is now a normalized transcript whose `role: "system"` messages carry the system prompt and tool declarations, instead of separate `context.systemPrompt` and `context.tools` fields. `pi-background-tasks` 2.6.2 still assumes the old shape: its Anthropic transport doesn't recognise the new role, falls through into a branch that assumes `toolResult`, and spins there forever — 100% of a core, unresponsive to SIGTERM — and would have dropped the prompt and tools even if it hadn't hung. **Symptom:** a background task routed to an Anthropic model (a `bg_delegate` on Opus, for instance) never starts, pins a CPU, and only dies on SIGKILL. The patch folds the transcript back into the legacy shape and converts that infinite loop into a thrown error, so an unknown role fails loudly instead of hanging. Tracking [`pi-background-tasks` #27](https://github.com/ismailsaleekh/pi-background-tasks/issues/27) (fix PR #28, unmerged at time of writing).

Apply it after install, and again after any `pi update --extensions`, then `/reload`:

```bash
python3 ~/.pi/agent/patches/pi-background-tasks-2.6.2-transcript-context.py
```

It prints the backup path it made, or `already patched`, or refuses with the version it found. Delete the file once upstream ships a release that fixes the bug — the version guard means a stale patch fails loudly rather than quietly mangling a package it no longer matches.

- `pi-background-tasks-2.6.2-2.6.3-opus-5-5-policy.py` — setup commit `358d036` selected Opus 5.5 before `pi-background-tasks` added it to its explicit Claude Code model-policy list. The result is `Anthropic attribution has no Claude Code model policy for claude-opus-5-5` on the first prompt. This script adds the 5.5 entry using Opus 5's existing 200K subscription/adaptive-effort policy. That compatibility assumption removes the *local policy lookup* error, but cannot guarantee Anthropic accepts the request; report a later HTTP/provider error separately. It guards the package version (2.6.2 or 2.6.3), backs up the JS file, and skips an already-patched file. It does not replace the transcript-context patch above. Run it yourself after install or package updates, then `/reload`:

```bash
python3 ~/.pi/agent/patches/pi-background-tasks-2.6.2-2.6.3-opus-5-5-policy.py
```

- `pi-background-tasks-2.6.2-2.6.3-claude-code-2.1.280.py` — after the Opus 5.5 model-policy fix, Anthropic can reject the request with `claude_code_version_too_old`: the extension still independently reports Claude Code 2.1.251, even if the installed `claude` command says 2.1.280. This patch changes the transport's **version constant and User-Agent together** to 2.1.280; billing fingerprints and the conversation hash derive from the constant. It backs up the file, is idempotent, and only accepts package versions 2.6.2/2.6.3. This clears the known version gate but cannot guarantee the next request has no other incompatibility. Run after the other required patches and `/reload`:

```bash
python3 ~/.pi/agent/patches/pi-background-tasks-2.6.2-2.6.3-claude-code-2.1.280.py
```

On Windows, if `python` and `python3` resolve to Microsoft Store aliases rather than installed Python, use `uv run --no-project --python 3.12 <script-path>` (or an explicit Python executable). Do not apply these scripts to a later package version without reviewing that release first.

### Sub-agent roles

One Markdown file per role in `agents/`, plus a model mapping in `subagents-lite.json`. The split is the whole point:

**Workers** — bounded implementation. They type; they don't decide.

| Role | Notes |
| --- | --- |
| `worker-luna` | General implementation |
| `worker-muse` | Implementation, accepts images |
| `worker-deepseek` | Implementation, accepts images — tracks the floating `deepseek-flash` alias |
| `worker-glm` | Implementation, accepts images — cheapest input rate in the roster |

All four accept text and images. That is an input-capability claim only — it does *not* move visual judgment to a worker: workers capture the screenshot, the analyst decides whether it's right. Video, audio, and PDF stay in the foreground unless a given worker has actually been verified on that input for the task at hand.

`worker-glm` and `analyst-glm` are different models on the same family name — `glm-5.3-flash` at worker prices versus `glm-5.3` at analyst prices, roughly an order of magnitude apart. Read the role name, not the family. They also share one `opencode-go` concurrency slot with `analyst-kimi` and `analyst-qwen`, so two of them cannot run in parallel at the shipped cap of 1.

**Analysts** — escalation only, for a genuinely large review that needs a second model family.

| Role | Notes |
| --- | --- |
| `analyst-qwen` | Accepts images |
| `analyst-kimi` | Accepts images |
| `analyst-glm` | **Text-only** |
| `analyst-opus` | Cross-family independent review (Anthropic) |
| `analyst-astra` | Hard reasoning inside the OpenAI family — the expensive one; ships at `thinking: medium` |

`analyst-opus` and `analyst-astra` are the two elite seats, and they are not interchangeable: Opus buys a different model family, Astra buys more depth in the same family as the session model. Pick by which one the disagreement actually needs. Both cost real money — "more eyes" is not a reason to spawn either.

Model IDs appear in two places — the `agent` map in `subagents-lite.json` and each role file's `model:` line — so retargeting a role means changing both and confirming they agree. Provider concurrency caps live in `subagents-lite.json` only — worth keeping low for any provider that rate-limits aggressively, and higher only where the account tolerates it (`meta` and `deepseek` are raised here; `opencode-go` stays at 1).

`outputTranscript` ships `true`: every run streams to `/tmp/pi-agent-outputs/<agentId>.log`. A background spawn's ack carries the full agent ID, so the parent can check progress on demand by reading that file with a line limit — no full-context injection, read at breakpoints rather than polling.

### Skills

**Scope: skills about driving an agent and writing code.** Nothing else ships, even when it's harmless.

| Skill | What it does |
| --- | --- |
| `economy-team` | Run the session as an analyst that delegates genuinely independent, bounded work to cheaper workers when it benefits — precise briefs, cheap verification, breakpoint audits — while design, visual verdicts, integration, and the foreground itself stay undelegated |
| `manager-loop` | Run one long or unattended job as manager over exactly one cheap worker — acceptance contract first, one self-contained brief per task, and every worker claim sorted into verified / evidenced / claimed so an unchecked result cannot reach the user |
| `speak-human` | One-off decode pass over dense machine-written output — coding-agent hand-offs, eval logs, benchmark reports — defining every term and reconstructing the baselines the original skipped |
| `my-pi-setup` | Resolves explicit my-pi-setup mentions to this repo's upstream for install, sync, publishing, and drift comparison; generic setup talk and ordinary local audits do not trigger it or fetch anything |

All four are about the agent loop itself: how work gets delegated, how an unattended job is supervised and verified, how its output gets made legible, and how the setup itself is carried between machines. A skill has to earn its place by that standard, not by being useful in general.

**Deliberately not shipped:**

- **Third-party skills** — `skill-creator`, `skill-installer`, `imagegen`, `openai-docs`, `plugin-creator` (Apache-2.0, from OpenAI's skills repo). In scope, but not mine to vendor. The installer fetches them via `skill-installer`, so upstream fixes reach you and this repo doesn't become a stale mirror of someone else's work.
- **Skills that depend on a system this repo doesn't ship** — e.g. a memory-consolidation skill that encodes the conventions of a repo-local memory system. Not secret, just incoherent alone: without the system it belongs to, it's a fragment that half-configures whoever installs it. It travels with that system or not at all.
- **Out-of-scope skills** — anything whose subject is a workflow, a domain, or a personal habit rather than agent operation or code.

---

## The idea behind it

Output tokens cost several times more than input tokens on the same model, and the gap between an analyst-tier model and a worker-tier model is larger still. **Reading is cheap. Writing is not.**

So the session model reads, decides, and writes *briefs* when a piece of work genuinely benefits. A cheap worker emits the artifact. The session model then verifies with the cheapest signal that would actually fail — run the command, read the diff — rather than trusting a worker's summary of its own work.

Delegation is **optional and benefit-based, not mandatory**. Long predictable output and mechanical repetition are good candidates; small, subtle, or session-coupled work stays solo, and workers may run focused tests and debugging within a briefed scope. Cost is only half of it: **wall-clock time is the second objective**, and a split that saves tokens but finishes later than doing the work solo is a loss, not a win.

Two guardrails matter more than they look:

- **The foreground is never delegated.** The live session is who the user is talking to and who supervises the workers. Hand it off and you lose both at once.
- **Visual judgment is never delegated.** Workers that accept images routinely describe what the code *should* have drawn instead of what the pixels show. They capture the screenshot; you look at it.

Full reasoning is in `skills/economy-team/SKILL.md`.

### Global agent policy

`config/AGENTS.md` supplies the setup-wide model and worker-selection policy. Its
**Elite Team Mode** keeps the foreground analyst in charge while the user is
present: quality outranks quota savings, judgment and verification remain with
the session analyst, and escalation runs through configured named roles rather
than invented tool parameters. Delegation there is optional and benefit-based,
and every delegated task must have a completion wake-up and bounded timeout.
The `economy-team` skill still governs routine bulk-output delegation underneath
those interactive-session overrides.

---

## What this repo will never contain

The rule is one line: **ship the mechanism, not the inventory.**

Config *shape*, role definitions, package names, and working methods describe **how** the setup operates — they're safe in public. Anything that names **a specific resource I own or can reach** is not, because it's an asset map for anyone reading.

**Excluded, permanently:**

- Credentials of any kind — `auth.json`, API keys, OAuth tokens, `.env` files.
- Session transcripts (`~/.pi/agent/sessions/`). These are verbatim records of real work and leak everything below without anyone deciding to publish it.
- Internal hostnames, SSH aliases, IPs, remote usernames, network topology.
- Absolute paths that embed a username or reveal a directory layout.
- Storage locations — Drive folders, buckets, shares, mount points.
- Project names, client names, dataset names, model-artifact names.
- Machine and hardware inventory.

**Concrete casualty:** a working file-transfer skill (safe rsync/ssh mirroring between two machines, with pre-overwrite comparison) is excluded. The logic is generic, but it hardcodes an SSH alias, a specific home path, and a remote account name — that's infrastructure disclosure wearing a skill costume. If it ever ships, it ships as a generic `ssh-mirror-transfer` reading its host from local config that stays out of git.

Note that even the *name* of that skill is omitted above, because the name was the alias. Describing what you removed can leak what you were trying to hide.

**The test for anything new:** *if a stranger read only this file, would they learn the name or location of something I own?* If yes, it stays local. Redacting a value is not enough when the surrounding text still identifies what was redacted.

### Three filters, in order

Everything proposed for this repo passes all three, or it doesn't ship:

1. **Private?** Does it name a resource I own or can reach — host, path, dataset, project, credential? → stays local.
2. **Self-contained?** Does it depend on a system this repo doesn't ship? → travels with that system instead. A fragment that silently assumes missing conventions is worse than an absence.
3. **In scope?** Is it about operating an agent or writing code? → if not, it's someone else's repo, however good it is.

Filter 1 is about safety. Filters 2 and 3 are about the repo staying a coherent, droppable unit instead of drifting into a dotfiles dump.

### Skills from other agent CLIs (retired)

`extensions/foreign-skills.ts` is a retired no-op stub. It previously let pi discover skills kept by other agent CLIs (Muse/Codex/Claude), searched after pi's own roots (project `.pi/skills` and `.agents/skills`, then `~/.pi/agent/skills`, then `~/.agents/skills`). Retired 2026-09-23: the Muse bundle produced startup warnings under pi's stricter parsing and proved useless, so pi now loads only its own roots. The stub ships (rather than deleting the file) so sync overwrites and disables the old loader on every machine.

### Local-only skills

Private skills live in `~/.agents/skills/` and are simply never copied here. Keeping them out of the repo — rather than in it behind a `.gitignore` — means a careless `git add -f` can't leak them, and nothing needs a scrubbing pass before push.

---

## Maintenance

- **Package versions are unpinned by design.** See [pi extensions](#pi-extensions). An install takes current npm releases; verify provider auth still works after any bump that touches it. `pi-ssh` follows the owner's `favrei/pi-ssh` fork without a version pin. Check its `node_modules` symlinks after updates and reload extension code before testing.
- **Model IDs rot.** Providers rename and retire models on short notice. When a role stops spawning, check `subagents-lite.json` against the live model list first — that's almost always the cause. Removing a retired model means editing three places: the model store entry, the `subagents-lite.json` mapping, and any skill prose that names it.
- **One role follows a floating alias.** `worker-deepseek` targets `deepseek/deepseek-flash`, which resolves to the vendor's current flash release rather than a fixed build, so the role can shift behaviour with no change on your side. It replaced an earlier `-exp` pin. If the alias itself stops resolving, name a concrete flash model ID in `subagents-lite.json`.
- **Sub-agent extensions and skills are on.** Every role sets `extensions: true` and `skills: true`, so a spawned role starts with the same extension tools and skills as the session. What keeps a role narrow is its `tools:` list, not the extension switch: `pi-ssh/*` and `pi-web-access/*` are granted, while `pi-goal`, `pi-background-tasks`, and `pi-mcp-adapter` are pinned to `/none`. Widen a role there, deliberately, rather than by turning extensions off and on.
- **Patches don't survive package updates.** `pi update --extensions` reinstalls `node_modules` and silently removes anything in `patches/` that had been applied to it. Re-run the patch scripts after any update — see [Local patches](#local-patches).

## License

MIT for the contents of this repo. Bundled third-party skills, where any are added, retain their own licenses.
