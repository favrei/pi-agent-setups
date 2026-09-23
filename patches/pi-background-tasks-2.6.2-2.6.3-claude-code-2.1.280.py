#!/usr/bin/env python3
"""Update the Claude Code version reported by pi-background-tasks 2.6.2/2.6.3.

These releases hard-code 2.1.251 in their attribution/billing metadata and User-Agent.
Opus 5.5 currently rejects requests below 2.1.280. This changes both literals
in the compiled transport; the billing fingerprint and conversation hash derive
from the version constant automatically. The machine's Claude Code CLI is not
used by this transport. This fixes the known version gate, not any other
potential protocol incompatibilities. Reapply after pi update --extensions.
"""
import json
import os
from pathlib import Path
import shutil
import sys
from datetime import datetime, timezone

pkg = Path(os.environ.get(
    "PI_BACKGROUND_TASKS_PACKAGE_DIR",
    Path.home() / ".pi/agent/npm/node_modules/pi-background-tasks",
))
target = pkg / "dist/src/core/anthropic-attribution.js"
version = json.loads((pkg / "package.json").read_text(encoding="utf-8"))["version"]
if version not in ("2.6.2", "2.6.3"):
    sys.exit(f"pi-background-tasks is {version}, not 2.6.2/2.6.3: not patching")

src = target.read_text(encoding="utf-8")
old = (
    "const CLAUDE_CODE_VERSION = '2.1.251';",
    "const CLAUDE_CODE_USER_AGENT = 'claude-cli/2.1.251 (external, sdk-cli)';",
)
new = (
    "const CLAUDE_CODE_VERSION = '2.1.280';",
    "const CLAUDE_CODE_USER_AGENT = 'claude-cli/2.1.280 (external, sdk-cli)';",
)
if all(src.count(line) == 1 for line in new) and not any(line in src for line in old):
    print("already patched")
    sys.exit(0)
if any(src.count(line) != 1 for line in old) or any(line in src for line in new):
    sys.exit("version anchors changed or only partially updated: not patching")

backup = target.with_name(target.name + datetime.now(timezone.utc).strftime(".bak-%Y%m%dT%H%M%SZ"))
if backup.exists():
    sys.exit(f"backup already exists: {backup}")
shutil.copy2(target, backup)
try:
    updated = src
    for before, after in zip(old, new):
        updated = updated.replace(before, after, 1)
    target.write_text(updated, encoding="utf-8")
except Exception:
    shutil.copy2(backup, target)
    raise
print("backup:", backup)
print("patched:", target)
