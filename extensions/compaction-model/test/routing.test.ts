import { test } from "node:test";
import assert from "node:assert/strict";
import { compact, SessionManager, type ExtensionContext, type SessionBeforeCompactEvent } from "@earendil-works/pi-coding-agent";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Not a public SDK export; tests load the installed native implementation directly.
const sdkDist = dirname(fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent")));
const { prepareCompaction } = await import(pathToFileURL(join(sdkDist, "core", "compaction", "compaction.js")).href) as {
  prepareCompaction: (entries: unknown[], settings: { enabled: boolean; reserveTokens: number; keepRecentTokens: number }) => SessionBeforeCompactEvent["preparation"] | undefined;
};
import { createAssistantMessageEventStream, type AssistantMessage, type Model, type Api } from "@earendil-works/pi-ai";
import { routeCompaction, estimatedRequestFits } from "../src/index.js";
import { resolveConfig, type CompactionModelConfig } from "../src/config.js";

const usage = { input: 100, output: 10, cacheRead: 0, cacheWrite: 0, totalTokens: 110, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
function model(provider: string, contextWindow = 1000000): Model<Api> {
  return { id: "summary", provider, api: "openai-completions", baseUrl: "https://example.invalid", name: provider, reasoning: true, input: ["text"], contextWindow, maxTokens: 8192, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
}
function response(m: Model<Api>, mode = "success"): AssistantMessage {
  return { role: "assistant", content: [{ type: "text", text: mode === "empty" ? "" : `## Goal\nSummary from ${m.provider}` }], api: m.api, provider: m.provider, model: m.id, usage, stopReason: mode === "length" ? "length" : mode === "401" ? "error" : "stop", ...(mode === "401" ? { errorMessage: "401 Bearer synthetic-private-never-log" } : {}), timestamp: Date.now() };
}
export function fixture(reason: "manual" | "threshold" | "overflow" = "manual") {
  const manager = SessionManager.inMemory(process.cwd());
  for (let i = 0; i < 3; i++) {
    manager.appendMessage({ role: "user", content: `Work item ${i}: ` + "bounded buffer and open restore work. ".repeat(100), timestamp: i });
    manager.appendMessage(response(model("fixture")));
  }
  manager.appendMessage({ role: "user", content: "Current work: " + "retain this recent turn. ".repeat(100), timestamp: 9 });
  const branchEntries = manager.getBranch();
  const preparation = prepareCompaction(branchEntries, { enabled: true, reserveTokens: 128, keepRecentTokens: 50 });
  assert.ok(preparation);assert.equal(preparation.isSplitTurn, false);
  const controller = new AbortController();
  const event: SessionBeforeCompactEvent = { type: "session_before_compact", preparation, branchEntries, reason, willRetry: reason === "overflow", signal: controller.signal, customInstructions: "Preserve restore as unresolved" };
  return { event, controller, manager };
}
function config(timeoutMs = 1000): CompactionModelConfig {
  return resolveConfig({ compactionModel: { model: "primary/summary", thinkingLevel: "minimal", fallbacks: [{ model: "backup/summary", thinkingLevel: "off" }], timeoutMs } }, {})!;
}
function harness(modes: Record<string, string> = {}, onStream?: (provider: string) => void) {
  const auth: string[] = [], streams: string[] = [], options: any[] = [];
  const ctx = { model: model("active"), modelRegistry: {
    find(provider: string) { return modes[provider] === "missing" ? undefined : model(provider, modes[provider] === "small" ? 1000 : 1000000); },
    async getApiKeyAndHeaders(m: Model<Api>) {
      auth.push(m.provider);
      if (modes[m.provider] === "auth-hang") return new Promise<any>(() => {});
      if (modes[m.provider] === "auth-throw") throw new Error("sk-synthetic-private-never-log");
      return modes[m.provider] === "auth-fail" ? { ok: false, error: "sk-synthetic-private-never-log" } : { ok: true, apiKey: "synthetic-key", headers: {}, env: {} };
    },
    streamSimple(m: Model<Api>, context: any, opts: any) {
      streams.push(m.provider);options.push(opts);onStream?.(m.provider);
      assert.ok(JSON.stringify(context.messages).includes("Preserve restore as unresolved"));
      const stream = createAssistantMessageEventStream();
      const mode = modes[m.provider];
      if (mode !== "stream-hang") {
        const r = response(m, mode);
        stream.push(r.stopReason === "error" ? { type: "error", reason: "error", error: r } : { type: "done", reason: r.stopReason as "stop" | "length", message: r });
      }
      return stream;
    },
  } } as unknown as ExtensionContext;
  return { ctx, auth, streams, options };
}
function selected(result: Awaited<ReturnType<typeof routeCompaction>>) {
  return (result?.compaction?.details as any)?.compactionModel?.model;
}

test("primary succeeds with native prompts/cut/usage and per-route effort", async () => {
  const f = fixture(), h = harness();
  const r = await routeCompaction(f.event, h.ctx, config());
  assert.equal(selected(r), "primary/summary");assert.deepEqual(h.streams, ["primary"]);
  assert.equal(r?.compaction?.firstKeptEntryId, f.event.preparation.firstKeptEntryId);
  assert.equal(r?.compaction?.tokensBefore, f.event.preparation.tokensBefore);
  assert.equal(r?.compaction?.usage?.input, 100);
  assert.equal(h.options[0].reasoning, "minimal");assert.equal(h.options[0].maxRetries, 0);
});
for (const failure of ["missing", "auth-fail", "auth-throw", "401", "empty", "length", "small"]) {
  test(`${failure} primary advances once to backup without changing active model`, async () => {
    const f = fixture(), h = harness({ primary: failure });
    const r = await routeCompaction(f.event, h.ctx, config());
    assert.equal(selected(r), "backup/summary");assert.equal(h.ctx.model?.provider, "active");
    assert.equal(h.streams.filter(p => p === "backup").length, 1);
    assert.equal(h.options.at(-1).reasoning, "off"); // Must override native compact's omitted off explicitly.
    assert.ok((r?.compaction?.details as any).compactionModel.attempts.length >= 2);
  });
}
for (const failure of ["auth-hang", "stream-hang"]) {
  test(`${failure} is bounded and cancelled before fallback`, async () => {
    const f = fixture(), h = harness({ primary: failure });const start = Date.now();
    const r = await routeCompaction(f.event, h.ctx, config(30));
    assert.equal(selected(r), "backup/summary");assert.ok(Date.now() - start < 1500);
    if (failure === "stream-hang") assert.equal(h.options[0].signal.aborted, true);
  });
}
test("both dedicated auth failures decline to native active-model fallback", async () => {
  const f = fixture(), h = harness({ primary: "auth-fail", backup: "auth-fail" });
  assert.equal(await routeCompaction(f.event, h.ctx, config()), undefined);
  assert.deepEqual(h.auth, ["primary", "backup"]);assert.deepEqual(h.streams, []);
  const native = await compact(f.event.preparation, model("active"), "synthetic", {}, f.event.customInstructions, f.event.signal, "off", h.ctx.modelRegistry.streamSimple.bind(h.ctx.modelRegistry));
  assert.ok(native.summary.includes("Summary from active"));
});
test("user cancellation before attempt does not advance or invoke native fallback", async () => {
  const f = fixture(), h = harness();f.controller.abort();
  assert.deepEqual(await routeCompaction(f.event, h.ctx, config()), { cancel: true });assert.deepEqual(h.auth, []);
});
test("user cancellation during auth or request stops chain", async () => {
  for (const mode of ["auth-hang", "stream-hang"]) {
    const f = fixture(), h = harness({ primary: mode });
    const promise = routeCompaction(f.event, h.ctx, config());
    setTimeout(() => f.controller.abort(), 10);
    assert.deepEqual(await promise, { cancel: true });assert.deepEqual(h.auth, ["primary"]);
  }
});
test("provider failure does not leak credentials into warnings", async () => {
  const warnings: string[] = [], original = console.warn;console.warn = (...a) => warnings.push(a.join(" "));
  try { await routeCompaction(fixture().event, harness({ primary: "auth-throw", backup: "401" }).ctx, config()); }
  finally { console.warn = original; }
  assert.ok(warnings.length > 0);assert.ok(warnings.every(s => !s.includes("synthetic-private") && !s.includes("Bearer")));
});
test("restores previous hook file metadata on disabled/excluded/auth-failure paths", async () => {
  for (const c of [null, { ...config(), reasons: [] }, config()]) {
    const f = fixture(), h = harness({ primary: "auth-fail", backup: "auth-fail" });
    f.event.branchEntries.push({ type: "compaction", id: "previous", parentId: null, timestamp: new Date().toISOString(), summary: "older", firstKeptEntryId: "old", tokensBefore: 99, fromHook: true, details: { readFiles: ["old-read.ts", "old-read.ts", 123], modifiedFiles: ["old-edit.ts"] } });
    await routeCompaction(f.event, h.ctx, c);
    assert.ok(f.event.preparation.fileOps.read.has("old-read.ts"));assert.ok(f.event.preparation.fileOps.edited.has("old-edit.ts"));
  }
});
test("all three reason hooks use same ordered selection", async () => {
  for (const reason of ["manual", "threshold", "overflow"] as const) {
    const f = fixture(reason), h = harness({ primary: "auth-fail" });
    assert.equal(selected(await routeCompaction(f.event, h.ctx, config())), "backup/summary");
  }
});
test("active model candidate is deferred, not requested twice", async () => {
  const f = fixture(), h = harness();
  assert.equal(await routeCompaction(f.event, h.ctx, { ...config(), model: "active/summary", fallbacks: [] }), undefined);
  assert.deepEqual(h.auth, []);
});
test("budget eligibility rejects undersized context without changing retention", () => {
  assert.equal(estimatedRequestFits(1000000, 13107, 272000), false);
  assert.equal(estimatedRequestFits(1000000, 13107, 1048576), true);
  assert.equal(estimatedRequestFits(1000000, 13107, NaN), false);
});
