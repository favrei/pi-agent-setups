import {
  compact,
  type ExtensionAPI,
  type ExtensionContext,
  type SessionBeforeCompactEvent,
  type SessionBeforeCompactResult,
} from "@earendil-works/pi-coding-agent";
import { loadConfig, parseModelReference, type CompactionModelConfig } from "./config.js";

function warn(message: string): void {
  // Never log raw provider errors, authentication objects, headers or prompts.
  console.warn(`[pi-compaction-model] ${message}`);
}

/** Preserve cumulative native metadata, including when routing declines/fails. */
export function restorePreviousFileOperations(
  preparation: { fileOps: { read: Set<string>; edited: Set<string> } },
  entries: Array<{ type: string; details?: unknown }>,
): void {
  const previous = [...entries].reverse().find((entry) => entry.type === "compaction");
  if (!previous || typeof previous.details !== "object" || previous.details === null) return;
  const details = previous.details as { readFiles?: unknown; modifiedFiles?: unknown };
  if (Array.isArray(details.readFiles)) {
    for (const path of details.readFiles) if (typeof path === "string") preparation.fileOps.read.add(path);
  }
  if (Array.isArray(details.modifiedFiles)) {
    for (const path of details.modifiedFiles) if (typeof path === "string") preparation.fileOps.edited.add(path);
  }
}

/** Includes serialized native prompts, previous summaries and split-turn prompts. */
export function estimatedRequestFits(chars: number, outputTokens: number, contextWindow: number): boolean {
  // Heuristic with 10% input cushion +2048tokens, NOT a provider tokenizer proof.
  // Provider context errors still advance the chain; never truncate history to fit.
  return Number.isFinite(contextWindow) && contextWindow > 0 &&
    Math.ceil(chars / 4 * 1.1) + outputTokens + 2048 <= contextWindow;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason ?? new Error("Compaction cancelled"));
    signal.addEventListener("abort", aborted, { once: true });
    // Observe the operation even if it finishes after timeout (no unhandled rejection).
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
    if (signal.aborted) aborted();
  });
}

/** Exported for real native compact() tests with a deterministic fake registry. */
export async function routeCompaction(
  event: SessionBeforeCompactEvent,
  ctx: ExtensionContext,
  config: CompactionModelConfig | null,
): Promise<SessionBeforeCompactResult | undefined> {
  restorePreviousFileOperations(event.preparation, event.branchEntries);
  if (event.signal.aborted) return { cancel: true };
  if (!config || !config.reasons.includes(event.reason)) return;

  const attempts: Array<{ model: string; outcome: string }> = [];
  const choices = [{ model: config.model, thinkingLevel: config.thinkingLevel }, ...config.fallbacks];
  for (const choice of choices) {
    if (event.signal.aborted) return { cancel: true };
    const reference = parseModelReference(choice.model);
    const model = reference ? ctx.modelRegistry.find(reference.provider, reference.modelId) : undefined;
    if (!model) {
      attempts.push({ model: choice.model, outcome: "model unavailable" });
      warn(`${choice.model}: model unavailable; trying next route.`);
      continue;
    }
    // Do not try the active model twice. The native last resort owns its routing,
    // reasoning, retries and authentication; candidate-specific effort stays local.
    if (ctx.model?.provider === model.provider && ctx.model.id === model.id) {
      attempts.push({ model: choice.model, outcome: "deferred to native active-model fallback" });
      continue;
    }
    const controller = new AbortController();
    const cancel = () => controller.abort(event.signal.reason);
    event.signal.addEventListener("abort", cancel, { once: true });
    if (event.signal.aborted) cancel();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("Dedicated compaction attempt timed out"));
    }, config.timeoutMs);
    let stage = "authentication";
    try {
      const auth = await abortable(ctx.modelRegistry.getApiKeyAndHeaders(model), controller.signal);
      controller.signal.throwIfAborted();
      if (!auth.ok) {
        attempts.push({ model: choice.model, outcome: "authentication unavailable" });
        warn(`${choice.model}: authentication unavailable; trying next route.`);
        continue;
      }
      // Match Pi's native handling: a null header value means "delete this header".
      const headers = auth.headers
        ? Object.fromEntries(Object.entries(auth.headers).filter((pair): pair is [string, string] => pair[1] !== null))
        : undefined;
      stage = "provider request";
      const stream: NonNullable<Parameters<typeof compact>[7]> = (candidate, context, options) => {
        controller.signal.throwIfAborted();
        const chars = context.messages.reduce((total, message) => total +
          (typeof message.content === "string" ? message.content.length : message.content.reduce((n, block) =>
            n + (block.type === "text" ? block.text.length : 0), 0)), 0);
        if (!estimatedRequestFits(chars, options?.maxTokens ?? 0, candidate.contextWindow)) {
          stage = "estimated context capacity";
          throw new Error("Summary input and output estimate exceeds candidate context");
        }
        return ctx.modelRegistry.streamSimple(candidate, context, {
          ...options,
          signal: controller.signal,
          // Native compact omits 'off'; pass it explicitly so providers do not apply
          // their own default thinking. Pi1.0 runtime accepts 'off' here (verified
          // live: DeepSeek thinking disabled, Luna reasoning none), although the
          // public SimpleStreamOptions type omits it.
          reasoning: (choice.thinkingLevel ?? options?.reasoning) as NonNullable<typeof options>["reasoning"],
          maxRetries: 0,
          timeoutMs: config.timeoutMs,
          maxRetryDelayMs: 0,
        });
      };
      const result = await abortable(compact(
        event.preparation, model, auth.apiKey, headers, event.customInstructions,
        controller.signal, choice.thinkingLevel, stream, auth.env,
        { enabled: false, maxRetries: 0, baseDelayMs: 0, maxAgentDelayMs: 0 },
      ), controller.signal);
      controller.signal.throwIfAborted();
      if (!result.summary.trim()) throw new Error("Empty compaction result");
      attempts.push({ model: choice.model, outcome: "success" });
      const routed = {
        ...result,
        details: {
          ...(result.details as Record<string, unknown> | undefined),
          compactionModel: { model: choice.model, thinkingLevel: choice.thinkingLevel ?? null, attempts },
        },
      };
      if (attempts.length > 1) warn(`Fallback succeeded with ${choice.model}.`);
      return { compaction: routed };
    } catch {
      if (event.signal.aborted) return { cancel: true };
      const outcome = timedOut ? "attempt timed out" : `${stage} failed`;
      attempts.push({ model: choice.model, outcome });
      warn(`${choice.model}: ${outcome}; trying next route.`);
    } finally {
      clearTimeout(timer);
      event.signal.removeEventListener("abort", cancel);
      controller.abort(); // Abort any outstanding split-turn sibling request.
    }
  }
  if (event.signal.aborted) return { cancel: true };
  warn(`Dedicated routes unavailable; using Pi's active model ${ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "(not selected)"}.`);
  // No fabricated/partial summary and no session write: Pi owns the final fallback.
  return;
}

export default function compactionModel(pi: ExtensionAPI): void {
  pi.on("session_before_compact", (event, ctx) => routeCompaction(event, ctx, loadConfig(ctx)));
}

export {
  COMPACTION_REASONS, THINKING_LEVELS, parseModelReference, resolveConfig,
  type CompactionModelConfig, type CompactionModelChoice, type CompactionReason, type ThinkingLevel,
} from "./config.js";
