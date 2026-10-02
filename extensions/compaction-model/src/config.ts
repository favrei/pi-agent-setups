import {
  getAgentDir,
  SettingsManager,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";

export const COMPACTION_REASONS = ["manual", "threshold", "overflow"] as const;
export type CompactionReason = (typeof COMPACTION_REASONS)[number];

export const THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export interface CompactionModelChoice {
  model: string;
  thinkingLevel?: ThinkingLevel;
}

export interface CompactionModelConfig extends CompactionModelChoice {
  fallbacks: CompactionModelChoice[];
  timeoutMs: number;
  reasons: CompactionReason[];
}

type UnknownRecord = Record<string, unknown>;
type Warn = (message: string) => void;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function section(settings: unknown): unknown {
  return isRecord(settings) ? settings.compactionModel : undefined;
}

export function resolveConfig(
  globalSettings: unknown,
  projectSettings: unknown,
  warn: Warn = (message) => console.warn(`[pi-compaction-model] ${message}`),
): CompactionModelConfig | null {
  const globalSection = section(globalSettings);
  const projectSection = section(projectSettings);

  if (projectSection === false) return null;
  if (globalSection === false && projectSection === undefined) return null;

  const raw: UnknownRecord = {
    ...(isRecord(globalSection) ? globalSection : {}),
    ...(isRecord(projectSection) ? projectSection : {}),
  };

  if (raw.enabled === false) return null;

  if (typeof raw.model !== "string" || !raw.model.trim()) {
    if (globalSection !== undefined || projectSection !== undefined) {
      warn("compactionModel.model must be a non-empty provider/model string; using Pi's active model.");
    }
    return null;
  }

  let thinkingLevel: ThinkingLevel | undefined;
  if (raw.thinkingLevel !== undefined && raw.thinkingLevel !== null) {
    if (
      typeof raw.thinkingLevel === "string" &&
      (THINKING_LEVELS as readonly string[]).includes(raw.thinkingLevel)
    ) {
      thinkingLevel = raw.thinkingLevel as ThinkingLevel;
    } else {
      warn(`Invalid thinkingLevel '${String(raw.thinkingLevel)}'; using the provider default.`);
    }
  }

  const fallbacks: CompactionModelChoice[] = [];
  const seen = new Set([raw.model.trim()]);
  if (raw.fallbacks !== undefined) {
    if (!Array.isArray(raw.fallbacks) || raw.fallbacks.length > 4) {
      warn("fallbacks must be an array of at most four model objects; ignoring backups.");
    } else {
      for (const entry of raw.fallbacks) {
        if (!isRecord(entry) || typeof entry.model !== "string" || !parseModelReference(entry.model.trim())) {
          warn("Ignoring invalid fallback model; expected { model: 'provider/model' }.");
          continue;
        }
        const model = entry.model.trim();
        if (seen.has(model)) continue;
        seen.add(model);
        let level: ThinkingLevel | undefined;
        if (entry.thinkingLevel !== undefined && entry.thinkingLevel !== null) {
          if (typeof entry.thinkingLevel === "string" && (THINKING_LEVELS as readonly string[]).includes(entry.thinkingLevel)) {
            level = entry.thinkingLevel as ThinkingLevel;
          } else {
            warn("Invalid fallback thinkingLevel; using the provider default.");
          }
        }
        fallbacks.push({ model, thinkingLevel: level });
      }
    }
  }
  let timeoutMs = 90000;
  if (raw.timeoutMs !== undefined) {
    if (Number.isSafeInteger(raw.timeoutMs) && (raw.timeoutMs as number) > 0 && (raw.timeoutMs as number) <= 600000) {
      timeoutMs = raw.timeoutMs as number;
    } else {
      warn("timeoutMs must be a positive integer no greater than600000; using90000.");
    }
  }

  let reasons: CompactionReason[] = [...COMPACTION_REASONS];
  if (raw.reasons !== undefined) {
    if (
      Array.isArray(raw.reasons) &&
      raw.reasons.every(
        (reason) =>
          typeof reason === "string" &&
          (COMPACTION_REASONS as readonly string[]).includes(reason),
      )
    ) {
      reasons = [...new Set(raw.reasons)] as CompactionReason[];
    } else {
      warn("reasons must contain only manual, threshold, or overflow; handling all reasons.");
    }
  }

  return {
    model: raw.model.trim(),
    thinkingLevel,
    fallbacks,
    timeoutMs,
    reasons,
  };
}

export function loadConfig(ctx: ExtensionContext): CompactionModelConfig | null {
  const settings = SettingsManager.create(ctx.cwd, getAgentDir(), {
    projectTrusted: ctx.isProjectTrusted(),
  });

  return resolveConfig(
    settings.getGlobalSettings(),
    ctx.isProjectTrusted() ? settings.getProjectSettings() : undefined,
  );
}

export function parseModelReference(reference: string): { provider: string; modelId: string } | null {
  const separator = reference.indexOf("/");
  if (separator <= 0 || separator === reference.length - 1) return null;

  const provider = reference.slice(0, separator).trim();
  const modelId = reference.slice(separator + 1).trim();
  return provider && modelId ? { provider, modelId } : null;
}
