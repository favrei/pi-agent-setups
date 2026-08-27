import { appendFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Repairs Anthropic tool_use / tool_result pairing at the last gate before the
 * HTTP request, preventing the unrecoverable 400:
 *
 *   messages.N: `tool_use` ids were found without `tool_result` blocks
 *   immediately after: toolu_xxx
 *
 * Rules enforced (Anthropic Messages API contract):
 *   1. Every tool_use gets a tool_result in the IMMEDIATELY following message.
 *   2. Every tool_result refers to a tool_use in the IMMEDIATELY preceding one.
 *   3. tool_result blocks come first in their message's content array.
 */

const SYNTHETIC_RESULT_TEXT =
	"Tool call was interrupted and produced no result.";

type Block = {
	type: string;
	id?: string;
	tool_use_id?: string;
	[k: string]: unknown;
};
type Msg = { role: string; content: unknown; [k: string]: unknown };

const blocksOf = (msg: Msg): Block[] | null =>
	Array.isArray(msg.content) ? (msg.content as Block[]) : null;

function looksLikeAnthropicPayload(
	payload: unknown,
): payload is { messages: Msg[] } {
	if (!payload || typeof payload !== "object") return false;
	const messages = (payload as { messages?: unknown }).messages;
	if (!Array.isArray(messages)) return false;
	return messages.every(
		(m) => m && typeof m === "object" && typeof (m as Msg).role === "string",
	);
}

export function repairToolPairs(payload: unknown): {
	payload: unknown;
	repairs: string[];
} {
	const repairs: string[] = [];
	if (!looksLikeAnthropicPayload(payload)) return { payload, repairs };

	const input = payload.messages;
	const out: Msg[] = [];

	for (let i = 0; i < input.length; i++) {
		const msg = input[i];
		const blocks = blocksOf(msg);

		// --- Assistant turn: guarantee results for every tool_use it emits. ---
		if (msg.role === "assistant" && blocks) {
			const toolUseIds = blocks
				.filter((b) => b.type === "tool_use" && b.id)
				.map((b) => b.id as string);
			out.push(msg);
			if (toolUseIds.length === 0) continue;

			const wanted = new Set(toolUseIds);
			const present = new Map<string, Block>();
			const trailing: Block[] = [];

			// Scan forward across consecutive user messages until every tool_use is
			// answered. This hoists a real tool_result that got displaced by an
			// interleaved user/custom message instead of discarding it.
			let consumed = i;
			let scan = i + 1;
			let sawResultMessage = false;
			while (scan < input.length && present.size < wanted.size) {
				const cand = input[scan];
				if (cand.role !== "user") break;
				const candBlocks = blocksOf(cand);
				if (!candBlocks) break;

				for (const b of candBlocks) {
					if (b.type === "tool_result") {
						const id = b.tool_use_id;
						if (typeof id === "string" && wanted.has(id) && !present.has(id)) {
							present.set(id, b);
							if (scan > i + 1) {
								repairs.push(
									`hoisted displaced tool_result ${id} from message ${scan}`,
								);
							}
						} else {
							repairs.push(
								`dropped orphan tool_result ${String(id)} at message ${scan}`,
							);
						}
						sawResultMessage = true;
					} else {
						trailing.push(b);
					}
				}
				consumed = scan;
				scan++;
			}

			const resultBlocks: Block[] = toolUseIds.map((id) => {
				const found = present.get(id);
				if (found) return found;
				repairs.push(`synthesized tool_result for ${id} after message ${i}`);
				return {
					type: "tool_result",
					tool_use_id: id,
					content: [{ type: "text", text: SYNTHETIC_RESULT_TEXT }],
					is_error: true,
				};
			});

			if (consumed > i) {
				const merged: Msg = {
					...input[consumed],
					role: "user",
					content: [...resultBlocks, ...trailing],
				};
				// Ordering matters: tool_result blocks must lead the message.
				const original = blocksOf(input[i + 1]);
				if (
					consumed === i + 1 &&
					original &&
					original.some(
						(b, idx) =>
							b.type === "tool_result" &&
							original.slice(0, idx).some((x) => x.type !== "tool_result"),
					)
				) {
					repairs.push(`reordered tool_result blocks to lead message ${i + 1}`);
				}
				out.push(merged);
				i = consumed; // consumed
			} else {
				// No usable adjacent user message: insert one carrying only results.
				void sawResultMessage;
				out.push({ role: "user", content: resultBlocks });
			}
			continue;
		}

		// --- User turn not following tool_use: any tool_result here is an orphan. ---
		if (msg.role === "user" && blocks) {
			const kept = blocks.filter((b) => b.type !== "tool_result");
			if (kept.length !== blocks.length) {
				for (const b of blocks) {
					if (b.type === "tool_result") {
						repairs.push(
							`dropped orphan tool_result ${String(b.tool_use_id)} at message ${i}`,
						);
					}
				}
				// Never emit an empty content array; the API rejects it.
				out.push({
					...msg,
					content:
						kept.length > 0
							? kept
							: [{ type: "text", text: "(removed unpaired tool result)" }],
				});
				continue;
			}
		}

		out.push(msg);
	}

	if (repairs.length === 0) return { payload, repairs };
	return { payload: { ...payload, messages: out }, repairs };
}

export default function (pi: ExtensionAPI) {
	pi.on("before_provider_request", (event, ctx) => {
		const { payload, repairs } = repairToolPairs(event.payload);
		if (repairs.length === 0) return undefined;

		const summary = `repaired ${repairs.length} tool pairing issue(s)`;
		try {
			appendFileSync(
				join(ctx.cwd, ".pi", "tool-pair-repair.log"),
				`${new Date().toISOString()} ${summary}\n${repairs.map((r) => `  - ${r}`).join("\n")}\n`,
				"utf8",
			);
		} catch {
			// Logging must never break the request.
		}
		ctx.ui?.notify?.(`tool-pair-repair: ${summary}`, "warning");
		return payload;
	});
}
