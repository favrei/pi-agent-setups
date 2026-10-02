import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { InMemoryCredentialStore, createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { routeCompaction } from "../src/index.js";
import { resolveConfig } from "../src/config.js";

async function setup(mode: "primary-auth-fail" | "both-auth-fail" | "primary-success" | "hang" | "overflow-once" = "primary-auth-fail", activeContextWindow = 1000000) {
  const cwd = mkdtempSync(join(tmpdir(), "pi-compaction-fallback-test-"));
  const runtime = await ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const calls: string[] = [], hookReasons: string[] = [];
  let overflowReturned = false;
  for (const provider of ["fixture-primary", "fixture-backup", "fixture-active"]) {
    runtime.registerProvider(provider, {
      api: "openai-completions", baseUrl: "https://example.invalid", apiKey: "synthetic-test-key-not-a-real-credential",
      models: [{ id: "summary", name: provider, reasoning: true, input: ["text"], contextWindow: provider === "fixture-active" ? activeContextWindow : 1000000, maxTokens: 8192, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
      streamSimple(model, context) {
        calls.push(provider);
        const stream = createAssistantMessageEventStream();
        if (mode === "hang" && provider === "fixture-primary") return stream;
        if (mode === "overflow-once" && provider === "fixture-active" && !overflowReturned && !JSON.stringify(context.messages).includes("<conversation>")) {
          overflowReturned = true;
          const error: AssistantMessage = { role: "assistant", content: [], api: model.api, provider, model: model.id, stopReason: "error", errorMessage: "maximum context length exceeded", timestamp: Date.now(), usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
          stream.push({ type: "error", reason: "error", error });return stream;
        }
        const message: AssistantMessage = { role: "assistant", content: [{ type: "text", text: `## Goal\nNative ${provider} summary; restore remains unfinished.` }], api: model.api, provider: model.provider, model: model.id, stopReason: "stop", timestamp: Date.now(), usage: { input: 200, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 220, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
        stream.push({ type: "done", reason: "stop", message });return stream;
      },
    });
  }
  const settings = SettingsManager.inMemory({ compaction: { enabled: true, reserveTokens: 128, keepRecentTokens: 50 }, retry: { enabled: false, maxRetries: 0 } });
  const manager = SessionManager.inMemory(cwd);
  manager.appendMessage({ role: "user", content: "Inspect original files, then preserve their history", timestamp: 0 });
  manager.appendMessage({ role: "assistant", content: [{ type: "toolCall", id: "read-old", name: "read", arguments: { path: "old-only-read.ts" } }, { type: "toolCall", id: "edit-old", name: "edit", arguments: { path: "old-modified.ts", oldText: "old", newText: "new" } }], api: "openai-completions", provider: "fixture-active", model: "summary", stopReason: "toolUse", timestamp: 0, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });
  for (const [id, name] of [["read-old", "read"], ["edit-old", "edit"]]) manager.appendMessage({ role: "toolResult", toolCallId: id!, toolName: name!, content: [{ type: "text", text: "Complete" }], isError: false, timestamp: 0 });
  for (let i = 0; i < 4; i++) manager.appendMessage({ role: "user", content: "Existing local project state; no push, restore unfinished. ".repeat(60), timestamp: i });
  const loader = new DefaultResourceLoader({ cwd, agentDir: cwd, settingsManager: settings, noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
    extensionFactories: [(pi) => {
      pi.on("session_before_compact", (event, ctx) => {
        hookReasons.push(event.reason);
        const registry = new Proxy(ctx.modelRegistry, { get(target, property) {
          if (property === "getApiKeyAndHeaders") return (model: any) => {
            if ((mode === "primary-auth-fail" || mode === "both-auth-fail" || mode === "overflow-once") && model.provider === "fixture-primary" || mode === "both-auth-fail" && model.provider === "fixture-backup") return Promise.resolve({ ok: false, error: "injected expired login" });
            return target.getApiKeyAndHeaders(model);
          };
          const value = Reflect.get(target, property, target);return typeof value === "function" ? value.bind(target) : value;
        } });
        return routeCompaction(event, { ...ctx, modelRegistry: registry } as ExtensionContext, resolveConfig({ compactionModel: { model: "fixture-primary/summary", thinkingLevel: "minimal", fallbacks: [{ model: "fixture-backup/summary", thinkingLevel: "off" }], timeoutMs: 1000 } }, {}));
      });
    }],
  });
  await loader.reload();assert.deepEqual(loader.getExtensions().errors, []);
  const selected = runtime.getModel("fixture-active", "summary");assert.ok(selected);
  const { session } = await createAgentSession({ cwd, agentDir: cwd, modelRuntime: runtime, model: selected, thinkingLevel: "off", tools: [], sessionManager: manager, settingsManager: settings, resourceLoader: loader });
  await session.bindExtensions({});
  const dispose = () => { session.dispose();rmSync(cwd, { recursive: true, force: true }); };
  return { session, manager, calls, hookReasons, dispose, setMode: (value: typeof mode) => { mode = value; } };
}

for (const reason of ["manual", "threshold", "overflow"] as const) {
  for (const mode of ["primary-success", "primary-auth-fail", "both-auth-fail"] as const) {
    test(`actual AgentSession ${reason}: ${mode} persists one valid checkpoint`, async () => {
      const s = await setup(mode);
      try {
        const old = s.manager.getEntries().map(e => ({ id: e.id, json: JSON.stringify(e) }));
        if (reason === "manual") await s.session.compact("Preserve no-push constraint");
        else await (s.session as any)._runAutoCompaction(reason, reason === "overflow");
        const compactions = s.manager.getEntries().filter(e => e.type === "compaction");assert.equal(compactions.length, 1);
        const entry = compactions[0]!;assert.equal(entry.type, "compaction");
        const expected = mode === "primary-success" ? "fixture-primary" : mode === "primary-auth-fail" ? "fixture-backup" : "fixture-active";
        assert.deepEqual(s.calls, [expected]);assert.ok(entry.summary.includes(expected));
        assert.equal(entry.fromHook, mode !== "both-auth-fail");assert.deepEqual(s.hookReasons, [reason]);
        for (const before of old) assert.equal(JSON.stringify(s.manager.getEntries().find(e => e.id === before.id)), before.json, "Original transcript mutated");
        assert.equal(s.session.model?.provider, "fixture-active");
      } finally { s.dispose(); }
    });
  }
}
test("actual manual cancellation writes no checkpoint and does not fail over", async () => {
  const s = await setup("hang");
  try {
    const promise = s.session.compact();setTimeout(() => s.session.abortCompaction(), 20);
    await assert.rejects(promise, /cancel|abort/i);
    assert.equal(s.manager.getEntries().filter(e => e.type === "compaction").length, 0);
    assert.deepEqual(s.calls, ["fixture-primary"]);
  } finally { s.dispose(); }
});
test("organic SDK threshold crossing compacts with backup then continues coding", async () => {
  const s = await setup("primary-auth-fail", 3000);
  try {
    await s.session.prompt("Continue local work without publication");
    assert.ok(s.hookReasons.includes("threshold"));
    assert.ok(s.calls.includes("fixture-backup"));assert.equal(s.calls.at(-1), "fixture-active");
    assert.equal(s.manager.getEntries().filter(e => e.type === "compaction").length, 1);
    assert.equal(s.session.isStreaming, false);
  } finally { s.dispose(); }
});
test("injected provider context overflow compacts with backup and retries coding once", async () => {
  const s = await setup("overflow-once");
  try {
    await s.session.prompt("Continue local work without publication");
    assert.ok(s.hookReasons.includes("overflow"));
    // Overflow lands mid-turn: native compact issues two summary requests (history +
    // split-turn prefix), both on the selected backup. One route attempt, not a retry.
    assert.deepEqual(s.calls, ["fixture-active", "fixture-backup", "fixture-backup", "fixture-active"]);
    const compactions = s.manager.getEntries().filter(e => e.type === "compaction");
    assert.equal(compactions.length, 1);
    assert.ok(compactions[0]!.type === "compaction" && compactions[0]!.summary.includes("Turn Context (split turn)"));
    assert.equal((compactions[0] as any).details.compactionModel.model, "fixture-backup/summary");
    assert.equal(s.session.isStreaming, false);
  } finally { s.dispose(); }
});
test("iterative extension compaction then native fallback retains cumulative file lists", async () => {
  const s = await setup("primary-auth-fail");
  try {
    await s.session.compact();
    s.manager.appendMessage({ role: "user", content: "New retained work ".repeat(300), timestamp: Date.now() });
    s.setMode("both-auth-fail");
    await s.session.compact();
    const entries = s.manager.getEntries().filter(e => e.type === "compaction");
    assert.equal(entries.length, 2);assert.equal(entries[0]!.fromHook, true);assert.equal(entries[1]!.fromHook, false);
    for (const e of entries) {
      assert.deepEqual((e.details as any).readFiles, ["old-only-read.ts"]);
      assert.deepEqual((e.details as any).modifiedFiles, ["old-modified.ts"]);
    }
  } finally { s.dispose(); }
});
// These use real SDK lifecycle paths with fake in-memory providers. CLI/TUI
// launcher extension loading and live-server authentication remain rollout checks.
