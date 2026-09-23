// foreign-skills: RETIRED (2026-09-23).
//
// Previously discovered skills installed by other agent CLIs (Muse Code
// bundled skills, ~/.claude/skills, ~/.codex/skills). Retired because the
// Muse bundle produced startup warnings (YAML frontmatter / description
// length) and proved useless under pi — pi loads only its own roots
// (project .pi/.agents skills, ~/.pi/agent/skills, ~/.agents/skills).
// This stub ships so sync overwrites and disables the old loader on
// every machine; deleting the file would leave stale copies behind
// (the installer never deletes what the repo doesn't ship).

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (_pi: ExtensionAPI) {
	// No-op: foreign skill auto-loading is off.
}
