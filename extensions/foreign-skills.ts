// foreign-skills: discover skills installed by other agent CLIs.
//
// Search order after pi's own roots (project .pi/.agents skills, ~/.pi/agent/skills,
// ~/.agents/skills), earlier wins on a name clash:
//   1. Muse Code bundled skills  -- shown to Muse models only
//   2. Claude Code (~/.claude/skills)
//   3. Codex (~/.codex/skills, then ~/.codex/skills/.system; pi's scan skips dot-dirs)
//
// Muse skills are loaded for every session but removed from the system prompt on
// each turn unless the current model is a Muse model, so switching models
// mid-session needs no /reload. Missing roots are skipped.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const HOME = homedir();
const MUSE_ROOT = join(HOME, ".local", "share", "muse", "skills", "bundled", "muse-core", "skills");
const ROOTS = [
	MUSE_ROOT,
	join(HOME, ".claude", "skills"),
	join(HOME, ".codex", "skills"),
	join(HOME, ".codex", "skills", ".system"),
];

function isMuse(model: { provider?: string; id?: string } | undefined): boolean {
	return !!model && (model.provider === "meta" || /^muse[-_]/i.test(model.id ?? ""));
}

export default function (pi: ExtensionAPI) {
	pi.on("resources_discover", () => {
		const skillPaths = ROOTS.filter((p) => existsSync(p));
		return skillPaths.length > 0 ? { skillPaths } : undefined;
	});

	pi.on("before_agent_start", (event, ctx) => {
		if (isMuse(ctx.model)) return;
		const opts = event.systemPromptOptions;
		if (!opts.skills) return;
		opts.skills = opts.skills.filter((s) => !s.filePath.startsWith(MUSE_ROOT + "/"));
	});
}
