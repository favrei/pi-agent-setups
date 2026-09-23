#!/usr/bin/env python3
"""Add the missing Opus 5.5 policy to pi-background-tasks 2.6.2/2.6.3.

These releases have an explicit Claude Code model-policy allowlist ending at Opus 5,
while this setup defaults to Opus 5.5. Treat 5.5 like 5 for the existing 200K
subscription/adaptive-effort policy. This is a local compatibility assumption,
not a guarantee that Anthropic accepts every resulting request. Remove once the
package ships its own tested 5.5 policy. Reapply after pi update --extensions.

Usage: python ~/.pi/agent/patches/pi-background-tasks-2.6.2-2.6.3-opus-5-5-policy.py
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
old = "    'claude-opus-5': claudeCode200KSubscriptionPolicy('claude-opus-5', CLAUDE_CODE_ADAPTIVE_200K_BETA, 'adaptive-effort'),"
new = old + "\n    'claude-opus-5-5': claudeCode200KSubscriptionPolicy('claude-opus-5-5', CLAUDE_CODE_ADAPTIVE_200K_BETA, 'adaptive-effort'), // LOCAL PATCH: Opus 5.5"
if new in src:
    print("already patched")
    sys.exit(0)
if src.count(old) != 1 or "'claude-opus-5-5':" in src:
    sys.exit("policy anchor changed or 5.5 is already defined: not patching")

backup = target.with_name(target.name + datetime.now(timezone.utc).strftime(".bak-%Y%m%dT%H%M%SZ"))
if backup.exists():
    sys.exit(f"backup already exists: {backup}")
shutil.copy2(target, backup)
try:
    target.write_text(src.replace(old, new, 1), encoding="utf-8")
except Exception:
    shutil.copy2(backup, target)
    raise
print("backup:", backup)
print("patched:", target)
