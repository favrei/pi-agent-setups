#!/usr/bin/env python3
"""Let pi-subagents 0.74.0 start background children on Pi 1.0.0.

Pi 1.0.0's @earendil-works/pi-agent-core no longer exports "./node", but
pi-subagents 0.74.0 requires that alias before launching any background child,
so every async `subagent` launch fails with:

    ... does not provide @earendil-works/pi-agent-core/node.

Upstream fixed this in nicobailon/pi-subagents PR #2634 (merged 2026-10-01) by
marking the alias optional. This script backports exactly that change into the
installed compiled file. Remove it once a pi-subagents release containing #2634
is installed; the version guard refuses anything but 0.74.0.

After running it, fully restart Pi (quit and relaunch). `/reload` keeps the old
module in memory. `pi update --extensions` reverts the patch.
"""
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

pkg = Path(os.environ.get(
    "PI_SUBAGENTS_PACKAGE_DIR",
    Path.home() / ".pi/agent/npm/node_modules/pi-subagents",
))
target = pkg / "src/runs/background/runner-aliases.js"
version = json.loads((pkg / "package.json").read_text(encoding="utf-8"))["version"]
if version != "0.74.0":
    sys.exit(f"pi-subagents is {version}, not 0.74.0: not patching")

src = target.read_text(encoding="utf-8")
alias_old = '{ specifier: "@earendil-works/pi-agent-core/node", pkg: "@earendil-works/pi-agent-core", subpath: "./node" },'
alias_new = '{ specifier: "@earendil-works/pi-agent-core/node", pkg: "@earendil-works/pi-agent-core", subpath: "./node", optional: true },'
loop_old = "    for (const { specifier, pkg, subpath } of required) {"
loop_new = "    for (const { specifier, pkg, subpath, optional } of required) {"
target_line = "        const target = packageDir ? resolvePackageSubpath(packageDir, subpath) : undefined;\n"
skip_line = "        if (optional && packageDir && target === undefined) continue;\n"

if alias_new in src and loop_new in src and skip_line in src:
    print("already patched")
    sys.exit(0)
if src.count(alias_old) != 1 or src.count(loop_old) != 1 or src.count(target_line) != 1:
    sys.exit("anchors changed or only partially patched: not patching")

backup = target.with_name(target.name + datetime.now(timezone.utc).strftime(".bak-%Y%m%dT%H%M%SZ"))
if backup.exists():
    sys.exit(f"backup already exists: {backup}")
shutil.copy2(target, backup)
try:
    updated = src.replace(alias_old, alias_new, 1)
    updated = updated.replace(loop_old, loop_new, 1)
    updated = updated.replace(target_line, target_line + skip_line, 1)
    target.write_text(updated, encoding="utf-8")
except Exception:
    shutil.copy2(backup, target)
    raise
print("backup:", backup)
print("patched:", target)
print("Now fully restart Pi (quit and relaunch); /reload is not enough.")
