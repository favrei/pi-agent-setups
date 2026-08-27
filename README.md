# pi-agent-setups

A portable, reproducible setup for the [pi coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent): extensions, sub-agent roles, and working-method skills — packaged so a fresh machine can be brought up by handing this repo to an agent and saying "set this up".

This repo is **public**. Everything in it is deliberately generic. See [What this repo will never contain](#what-this-repo-will-never-contain).

---

## Who this is for

**If you're me:** this is the drop-in. On a new box, say `/my-pi-setup` and what you want — the skill knows where this repo lives and does the rest. The parts that are machine-specific or private are *not* here by design; you re-add them locally, and they stay local.

**If you're a visitor:** this is a worked example of a pi configuration that leans on cheap sub-agents for bulk output and reserves the expensive model for judgment. The `economy-team` skill is the interesting part; the rest is plumbing. Take what's useful, none of it depends on anything private.

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
agents/            7 sub-agent role definitions -> ~/.pi/agent/agents/
skills/            3 skills                     -> ~/.pi/agent/skills/
extensions/        1 local pi extension         -> ~/.pi/agent/extensions/
config/
  settings.json      MERGED into ~/.pi/agent/settings.json
  subagents-lite.json copied to ~/.pi/agent/subagents-lite.json
```

**After install, you still have to do these yourself — the installer deliberately won't:**

1. **Log in.** Launch pi and authenticate each provider you actually use. Nothing here touches credentials — the skill is explicitly instructed to stop and hand back rather than attempt auth.
2. **Confirm the model IDs** in `config/subagents-lite.json` still exist. Providers rename and retire models constantly, and a stale ID fails at sub-agent spawn time — not at install time, so the installer cannot catch it for you.
3. **Re-add private, machine-specific skills** (see [Local-only skills](#local-only-skills)) and, optionally, the third-party skills this repo doesn't vendor.

---

## What's in the box

### pi extensions (npm packages)

Declared in `settings.json` under `packages[]`. All published to the public npm registry.

| Package | Publisher (npm maintainer) | What it gives you |
| --- | --- | --- |
| `pi-meta-oauth` | `blockedredemption` | Meta Model API OAuth provider + Muse video/audio/file analysis tools |
| `@narumitw/pi-goal` | `narumitw` | Actively maintained autonomous goals with guarded continuation, explicit completion/blocker/wait states, and safety limits |
| `pi-subagents-lite` | `alexparamonov` | Sub-agents with isolated sessions and per-role models — the `Agent` tool |
| `pi-background-tasks` | `ismailsaleekh` | `bg_run`, `bg_delegate`, attested Pi runs, and the `fusion_*` multi-model workflows |
| `pi-claude-auth` | `pankajudhas81` | Reuses existing Claude Code credentials — no separate login |
| `pi-lens` | `apmantza` | LSP diagnostics, ast-grep, symbol/module/project reports |
| `pi-web-access` | `nicobailon` | `web_search`, `fetch_content`, GitHub/PDF/YouTube handling |
| `pi-mcp-adapter` | `nicobailon` | MCP gateway (`mcp`) and batch scripting (`mcpScript`) |

All MIT except `pi-background-tasks` (ISC). None are first-party to pi itself — this is a community stack, so pin versions if you care about reproducibility, and read the diff before bumping anything that touches auth.

### Local extension

- `extensions/tool-pair-repair.ts` — repairs Anthropic `tool_use`/`tool_result` pairing at the last gate before the HTTP request. Without it, an interrupted tool call can wedge a session into an unrecoverable `400: tool_use ids were found without tool_result blocks`. Unpublished, self-contained, ~150 lines.

### Sub-agent roles

One Markdown file per role in `agents/`, plus a model mapping in `subagents-lite.json`. The split is the whole point:

**Workers** — bounded implementation. They type; they don't decide.

| Role | Notes |
| --- | --- |
| `worker-luna` | General implementation |
| `worker-muse` | Implementation, accepts images |
| `worker-deepseek` | Implementation, accepts images — pinned to an **experimental** model ID |

All three accept images, so modality no longer constrains the rotation. That does *not* move visual judgment to them: workers capture the screenshot, the analyst decides whether it's right.

**Analysts** — escalation only, for a genuinely large review that needs a second model family.

| Role | Notes |
| --- | --- |
| `analyst-qwen` | Accepts images |
| `analyst-kimi` | Accepts images |
| `analyst-glm` | **Text-only** |
| `analyst-opus` | Independent review; ships `hidden: true` and disabled by default |

Model IDs live in `subagents-lite.json`, not in the role files, so retargeting a role is a one-line change. Provider concurrency caps live there too — worth keeping low for any provider that rate-limits aggressively.

### Skills

**Scope: skills about driving an agent and writing code.** Nothing else ships, even when it's harmless.

| Skill | What it does |
| --- | --- |
| `economy-team` | Run the session as an analyst directing workers: delegate bulk output, verify cheaply, audit running workers every 5–10 min, never delegate the foreground or visual judgment |
| `speak-human` | One-off decode pass over dense machine-written output — coding-agent hand-offs, eval logs, benchmark reports — defining every term and reconstructing the baselines the original skipped |
| `my-pi-setup` | Resolves "my pi setup" to this repo's upstream and acts on it: install it here, change a role locally and push that change up, or report drift between this machine and upstream |

All three are about the agent loop itself: how work gets delegated, how its output gets made legible, and how the setup itself is carried between machines. A skill has to earn its place by that standard, not by being useful in general.

**Deliberately not shipped:**

- **Third-party skills** — `skill-creator`, `skill-installer`, `imagegen`, `openai-docs`, `plugin-creator` (Apache-2.0, from OpenAI's skills repo). In scope, but not mine to vendor. The installer fetches them via `skill-installer`, so upstream fixes reach you and this repo doesn't become a stale mirror of someone else's work.
- **Skills that depend on a system this repo doesn't ship** — e.g. a memory-consolidation skill that encodes the conventions of a repo-local memory system. Not secret, just incoherent alone: without the system it belongs to, it's a fragment that half-configures whoever installs it. It travels with that system or not at all.
- **Out-of-scope skills** — anything whose subject is a workflow, a domain, or a personal habit rather than agent operation or code.

---

## The idea behind it

Output tokens cost several times more than input tokens on the same model, and the gap between an analyst-tier model and a worker-tier model is larger still. **Reading is cheap. Writing is not.**

So the expensive model reads, decides, and writes *briefs*. A cheap worker emits the artifact. The expensive model then verifies with the cheapest signal that would actually fail — run the command, read the diff — rather than trusting a worker's summary of its own work.

Two guardrails matter more than they look:

- **The foreground is never delegated.** The live session is who the user is talking to and who supervises the workers. Hand it off and you lose both at once.
- **Visual judgment is never delegated.** Workers that accept images routinely describe what the code *should* have drawn instead of what the pixels show. They capture the screenshot; you look at it.

Full reasoning is in `skills/economy-team/SKILL.md`.

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

### Local-only skills

Private skills live in `~/.agents/skills/` and are simply never copied here. Keeping them out of the repo — rather than in it behind a `.gitignore` — means a careless `git add -f` can't leak them, and nothing needs a scrubbing pass before push.

---

## Maintenance

- **`pi-meta-oauth` is behind**: pinned at `0.3.0`, upstream is at `0.4.4`. Verify the OAuth flow before bumping, since it touches provider auth.
- **Model IDs rot.** Providers rename and retire models on short notice. When a role stops spawning, check `subagents-lite.json` against the live model list first — that's almost always the cause. Removing a retired model means editing three places: the model store entry, the `subagents-lite.json` mapping, and any skill prose that names it.
- **One role is pinned to an experimental model.** `worker-deepseek` uses a vendor `-exp` model ID, which buys image support at the same price as the text-only variant but can be renamed or withdrawn without notice. It is the first thing to suspect when that worker stops spawning, and the non-`exp` variant of the same model is a drop-in fallback. Verified working when pinned; "experimental" is a stability claim, not a quality one.
- **Sub-agent extensions are opt-in.** Every role sets `extensions: false` except `worker-muse`, which needs `[meta]` for the Muse tools. Left on by default, sub-agents load the full extension stack and get slow and expensive for no benefit.

## License

MIT for the contents of this repo. Bundled third-party skills, where any are added, retain their own licenses.
