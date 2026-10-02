# Dedicated compaction with ordered fallbacks

Portable local fork of [JMHSV/pi-compaction-model](https://github.com/JMHSV/pi-compaction-model), based on upstream commit `83bd7bc5a54f1b750497f6d1f66e25f5c3519e46` (0.1.0). Original MIT license and attribution are in `LICENSE`. The ordered fallback implementation is vendored here, not provided by the stock npm release. Requires Pi 1.0.0 or newer; verification used Pi 1.0.0.

## Install and sync

Copy this directory to `~/.pi/agent/extensions/compaction-model/`, and merge the `compactionModel` section from `settings.example.json` into `~/.pi/agent/settings.json`. `/my-pi-setup` does this using its ordinary overlay rules. Restart Pi or `/reload` afterward. No runtime npm installation is needed: Pi discovers `package.json`'s `pi.extensions` and supplies its SDK.

Install the handler only once. Do not also install `npm:pi-compaction-model`, or load another compaction handler for the same reasons; another handler can override the result.

## Default chain

```json
{
  "compactionModel": {
    "model": "meta/muse-spark-1.3-contributor",
    "thinkingLevel": "minimal",
    "fallbacks": [
      { "model": "deepseek/deepseek-flash", "thinkingLevel": "off" }
    ],
    "timeoutMs": 90000,
    "reasons": ["manual", "threshold", "overflow"]
  }
}
```

Muse minimal is the quality-first route. Direct DeepSeek (not OpenCode's DeepSeek) is the speed-first backup. `deepseek-flash` is a floating latest-Flash alias, not a verified fixed-version identity. Missing model/authentication, provider errors, empty or length-limited results, timeout, or estimated context-capacity failure advance once to the next route. Exhaustion returns control to Pi's native active-coding-model compaction. Cancellation stops the chain and writes no checkpoint.

The extension calls native `compact()` through the model registry. Native prompts, cut points, recent-history retention, previous summaries, split-turn handling, file lists, output budgeting, and `/compact` focus instructions are retained. It never shrinks the coding model's window or silently truncates history to fit a backup. Cumulative file metadata is restored even when the extension declines routing or falls back to native compaction.

- `fallbacks`: at most four `{model, thinkingLevel?}` choices; duplicates are ignored. Backups do not inherit primary thinking.
- `timeoutMs`: positive integer up to 600000; default 90000 per dedicated attempt, including authentication and both split-turn requests. Providers receive cancellation on timeout; non-cooperative underlying work may finish later but cannot supply a checkpoint. The final native fallback retains Pi's own deadlines/retries.
- `reasons`: any subset of `manual`, `threshold`, `overflow`. An empty array disables routing. `enabled: false` also disables it.
- Thinking: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`; omit for provider default. Explicit `off` is passed to registry streaming rather than dropped by native compaction.
- Trusted project `.pi/settings.json` fields shallow-merge over the global section; project fallback arrays replace global arrays. `compactionModel: false` disables routing. Untrusted project configuration is ignored.
- Input capacity uses serialized text characters / 4, plus 10% and 2048 tokens of headroom, plus reserved output. This is a heuristic, not a tokenizer guarantee. Provider context errors also advance the chain.
- Warnings report route decisions without raw authentication/provider errors, credentials, headers or prompts. Successful checkpoints include `details.compactionModel`: configured route, requested thinking, and attempt outcomes.

## Coverage and limits

The handler serves manual `/compact`, automatic threshold compaction, and overflow recovery **only where extensions are loaded**. Normal Pi sessions and ambient-extension workers can load it. Isolated launchers, extension-denying profiles, foreground children, and some background/Fusion lanes can bypass it and keep native active-model compaction. Do not weaken their isolation to force this handler in.

A working dedicated provider can compact without working active-model summarization auth on Pi 1.0.0, but ordinary coding still needs the coding provider's login. This is not coding-provider failover. If every route fails, compaction still fails; there is no fabricated success.

Quality choice came from one synthetic long-history comparison, one request per model/effort combination; it is not full-window reliability certification. Small live SDK tests demonstrated Muse success and injected Muse auth failure followed by real direct DeepSeek success. Fake-provider SDK tests exercise actual manual/automatic lifecycle persistence, cancellation, organic threshold continuation, and overflow retry. They do not attest live server login failures, interactive TUI behavior, or universal launcher coverage. After syncing, reload and check `/compact` on a disposable session on that machine.

## Tests

Development dependencies are needed only to run the bundled tests:

```sh
npm ci --ignore-scripts
npm run check
```

41 tests cover configuration, routing failures, cancellation, context checks, split-turn overflow, continued coding, and cumulative file metadata. Test providers and credentials are synthetic and in-memory. `node_modules/` and `dist/` are local build outputs, not shipped.
