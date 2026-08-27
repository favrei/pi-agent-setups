---
name: my-pi-setup
description: Resolves "my pi setup" to the user's upstream pi-configuration repository on GitHub and carries out whatever the user asks against it — pulling the setup onto this machine, adding or changing anything it holds, pushing a fix upstream so the user's other pi agents pick it up, inspecting what is configured, or reporting drift between this machine and upstream. Use whenever the user says my-pi-setup, /my-pi-setup, or $my-pi-setup, or otherwise refers to their pi setup, their agent setup, or their setup repo, from any working directory and whether or not a local clone exists.
---

# My Pi Setup

`/my-pi-setup` is not a command and has no subcommands. It names a place:

```text
git@github.com:favrei/pi-agent-setups.git   (branch: main)
```

Read it as "the upstream of my pi setup". Whatever the user says around it is the
request. Carry that request out against this repo using the rules below. Do not
demand a particular phrasing, do not offer a menu, and do not narrow the request
to something you have seen before.

The request can be anything: install this setup here, add a plugin or extension,
change a model, fix something and send the fix upstream, check what is configured,
update this machine, compare it against upstream. Treat the list of things people
ask for as open.

This works from **any** directory. Never assume the current directory is a clone,
and never assume a clone exists at all.

## Reaching upstream

1. Use the canonical SSH remote for every Git operation:
   `git@github.com:favrei/pi-agent-setups.git`. Clone, fetch, and push over SSH;
   never silently substitute HTTPS or open an HTTPS credential flow.
2. If the current directory is inside a clone of this repo and it is clean, use
   it. Confirm by the remote URL, not the directory name, and restore the
   canonical SSH URL before fetching.
3. Otherwise clone into a fresh temp directory and work there. Never create a
   clone inside the user's project.
4. Always fetch first and work from current `origin/main`. Never act on a working
   copy of unknown age.
5. If SSH authentication or the remote is unavailable, stop and say so. Do not
   log in, switch transports, fall back to a stale local copy, or guess what the
   repo contains.

## How the repo maps onto a machine

The repo mirrors `~/.pi/agent/`. A top-level directory installs into the
directory of the same name; files under `config/` install at the root of
`~/.pi/agent/`.

```text
<repo>/agents/…      ->  ~/.pi/agent/agents/…
<repo>/skills/…      ->  a skills root, see below
<repo>/extensions/…  ->  ~/.pi/agent/extensions/…
<repo>/config/X      ->  ~/.pi/agent/X
```

Derive the mapping from what the repo actually contains at the time you run, not
from a memorised list. New directories may appear; apply the same rule to them.
`README.md` and repo metadata are documentation and do not install anywhere.

Anything else under `~/.pi/agent/` belongs to the user, not to this repo.

### Two skills roots

Skills live in one of two places, and the choice is not cosmetic:

| Root | For |
| --- | --- |
| `~/.pi/agent/skills/` | pi-specific skills |
| `~/.agents/skills/` | portable skills shared with other agent tools |

Before installing a skill, check whether it already exists in either root and
keep it where it is. For a skill that is new to the machine, judge by content: if
it only makes sense inside pi, use the pi root; if any agent could use it, use the
shared root. When it is genuinely ambiguous, ask.

Installing the same skill into both roots is a bug — it produces two copies that
drift apart.

## Invariants

These hold for every request, whatever it is.

1. **Compare, then back up, then write.** Skip files already identical and say so.
   Back up anything you are about to overwrite to `<file>.bak-<UTC timestamp>` and
   report the path. Running the same request twice must change nothing the second
   time.
2. **Merge JSON that the repo only partly owns.** For a file like
   `config/settings.json`, write only the keys the repo defines and leave every
   other key exactly as found. Replace whole array values rather than merging them
   element-wise. Losing an unmanaged key is a failure even if everything else
   looks right.
3. **Never delete what the repo does not ship.** This is an overlay. Other skills,
   roles, extensions, and settings on the machine must survive untouched.
4. **Local first, upstream second.** Apply a change to `~/.pi/agent/` before
   pushing it. The local edit is immediate and reversible; the push is shared
   state.
5. **Ask before pushing, not before editing locally.** Show the diff first.
6. **If a write fails, report the resulting split.** Say which side is ahead —
   this machine or upstream. Never report success.
7. **If the file will not parse, stop.** Back it up, report the error, ask. Never
   overwrite a broken file to clear it.

## Requests that reach the user's other machines

You cannot touch the user's other pi agents. Upstream is the rendezvous: push the
change to `main`, and other machines pick it up next time they pull.

So when the user asks to send a hotfix out, or to update their other agents, the
work is: apply it here, push it upstream, then tell the user plainly that other
machines receive it when they next sync — and that you have not contacted them.
Do not imply a fan-out that did not happen.

## Requests you have not seen before

Adding something new to the setup — a plugin, an extension, a config file, a whole
new category — is normal. Follow the repo's existing shape rather than inventing
one:

1. Put it where the mirror rule says it goes.
2. Match the conventions of the files already there.
3. Install it locally and verify it before pushing.
4. If it needs a README entry to make sense to a stranger, add one.

If the request genuinely does not fit the repo's shape, say what you would do and
ask, rather than improvising a new layout and pushing it.

## Never

- Never read, write, or move `~/.pi/agent/auth.json`.
- Never log in, and never invent, guess, or ask for credentials or tokens.
  Authentication is the user's; hand back.
- Never commit anything private: credentials, session transcripts, internal
  hostnames or SSH aliases, absolute paths containing a username, storage
  locations, or project, client, and dataset names. **This repo is public.** If a
  change would carry any of these, stop and say so rather than redacting and
  pushing anyway.
- Never force-push, rewrite history, or resolve a conflict by discarding the
  user's upstream work.

## Report evidence, not success

- What changed, what was skipped as identical, every backup path.
- Any JSON touched still parses, and unmanaged keys survived.
- Nothing outside the mapping was added, changed, or removed.
- For a push: the commit, and that `main` now has it.
- Whether this machine and upstream now agree. If not, which is ahead.

Two things only the user can finish, worth saying after a fresh install:
authentication, and confirming model IDs still exist — providers rename and retire
them, and a stale ID fails when an agent is spawned, not when it is installed.

## Troubleshooting

| Symptom | Cause and response |
| --- | --- |
| Remote unreachable | SSH key or network. Stop; do not use a stale copy. |
| A role fails only when spawned | Model ID renamed or retired. Check against the provider's current list. |
| `worker-deepseek` fails to spawn | Pinned to an experimental `-exp` model ID. The non-`exp` variant of the same model is the drop-in fallback, losing image support. |
| Live JSON will not parse | Back up, report, ask. Never overwrite to clear the error. |
| Something the user runs is missing after install | Expected. This repo is an overlay and does not ship everything on the machine. |
