#!/usr/bin/env python3
"""Local bridge fix for pi-background-tasks 2.6.2 on pi >= 0.86.

Bug: pi >= 0.86 passes providers a transcript whose role:"system" messages carry the
prompt and tools. The package's Anthropic transport loops forever on that role (100% CPU,
ignores SIGTERM) and would otherwise drop the prompt and tools.
Upstream: https://github.com/ismailsaleekh/pi-background-tasks/issues/27 (fix PR #28, unmerged).

Remove this once an upstream release fixes #27; `pi update --extensions` replaces the
package and drops the patch. Safe to re-run: it only touches 2.6.2 and only once.
Usage: python3 pi-background-tasks-2.6.2-transcript-context.py
"""
import json, os, shutil, sys, time
PKG = os.path.expanduser("~/.pi/agent/npm/node_modules/pi-background-tasks")
TARGET = os.path.join(PKG, "dist/src/core/anthropic-attribution.js")
MARKER = "LOCAL PATCH (pi >= 0.86)"
version = json.load(open(os.path.join(PKG, "package.json")))["version"]
if version != "2.6.2":
    sys.exit(f"pi-background-tasks is {version}, not 2.6.2: not patching (check whether upstream fixed #27)")
if MARKER in open(TARGET).read():
    sys.exit("already patched")
backup = TARGET + time.strftime(".bak-%Y%m%dT%H%M%SZ", time.gmtime())
shutil.copy2(TARGET, backup)
print("backup:", backup)
sys.argv = [sys.argv[0], TARGET]
import pathlib
p = pathlib.Path(sys.argv[1])
src = p.read_text()

helper = '''// LOCAL PATCH (pi >= 0.86): the provider context is a normalized transcript whose
// role:"system" messages carry the prompt and tool declarations; context.systemPrompt
// and context.tools are no longer set. Fold them back into the legacy shape this
// module was written against, mirroring pi-ai's collapseSystemMessages() replay.
function legacyContextFromTranscript(context) {
    const messages = context.messages ?? [];
    if (!messages.some((message) => message?.role === 'system'))
        return context;
    const content = [];
    const sections = new Map();
    const tools = new Map();
    for (const message of messages) {
        if (message?.role !== 'system')
            continue;
        const text = typeof message.content === 'string'
            ? message.content
            : (message.content ?? []).filter((block) => block.type === 'text').map((block) => block.text).join('\\n');
        if (text.length > 0)
            content.push(text);
        for (const [name, value] of Object.entries(message.sections ?? {})) {
            if (value === null)
                sections.delete(name);
            else
                sections.set(name, value);
        }
        for (const tool of message.toolsRemoved ?? [])
            tools.delete(tool.name);
        for (const tool of message.toolsAdded ?? [])
            tools.set(tool.name, tool);
    }
    const systemPrompt = [content.join('\\n\\n'), ...sections.values()].filter((part) => part.length > 0).join('\\n\\n');
    return {
        ...context,
        systemPrompt: systemPrompt.length > 0 ? systemPrompt : context.systemPrompt,
        tools: tools.size > 0 ? [...tools.values()] : context.tools,
        messages: messages.filter((message) => message?.role !== 'system'),
    };
}
'''

edits = [
    # 1. helper before convertMessages
    ("function convertMessages(model, messages, conversationStaticSha256,",
     helper + "function convertMessages(model, messages, conversationStaticSha256,"),
    # 2. never spin on an unknown role: the fall-through branch assumes toolResult
    ("""        const toolResults = [];
        let lookahead = index;""",
     """        if (message.role !== 'toolResult')
            throw new Error(`Anthropic attribution encountered unsupported message role ${JSON.stringify(message.role)}`);
        const toolResults = [];
        let lookahead = index;"""),
    # 3. exported builder
    ("""export function buildAnthropicRequestParams(model, context, options) {
    return buildAnthropicRequest(model, context, options).params;""",
     """export function buildAnthropicRequestParams(model, context, options) {
    return buildAnthropicRequest(model, legacyContextFromTranscript(context), options).params;"""),
    # 4. provider entry (parent + child registrations both route here)
    ("""        return forwardToBuiltInAnthropic(model, context, options, dependencies);
    }
    const stream = createAssistantMessageEventStream();""",
     """        return forwardToBuiltInAnthropic(model, context, options, dependencies);
    }
    context = legacyContextFromTranscript(context);
    const stream = createAssistantMessageEventStream();"""),
]
for old, new in edits:
    n = src.count(old)
    if n != 1:
        sys.exit(f"anchor matched {n} times: {old[:60]!r}")
    src = src.replace(old, new)
p.write_text(src)
print("patched", p)

