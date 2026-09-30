/**
 * Bundled subagents (scout / researcher / worker).
 *
 * OpenCode already has native subagents plus the `subagent` task tool, so this
 * domain does not reimplement spawning. The V2 `ctx.agent.transform` editor can
 * update, remove, or select existing agents but cannot *create* them (there is
 * no `add`), so bundled agents are installed as Markdown definitions in the
 * global agents directory, which OpenCode discovers and watches natively:
 *
 *   ~/.config/opencode/agents/<id>.md
 *
 * Files carrying the managed marker are refreshed on upgrade; a same-named file
 * without the marker is treated as a user override and left alone.
 *
 * Ported from Hawiyat-Org/pi-extension (MIT),
 * `pi-interactive-subagents/agents/*`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Context } from "@opencode/plugin/promise/plugin"

export const MANAGED_MARKER = "<!-- managed by @hawiyat/opencode-extension -->"

interface Permission {
  action: string
  resource: string
  effect: "allow" | "ask" | "deny"
}

interface AgentSpec {
  id: string
  name: string
  description: string
  system: string
  extra: Permission[]
}

const SCOUT_SYSTEM = `You are a scout agent. Quickly investigate a codebase and return structured findings.

You operate in an isolated context with no knowledge of any prior conversation. All necessary context is in the task description. You are read-only: never build, test, or modify anything.

Thoroughness (infer from task, default medium):
- Quick: Targeted lookups, key files only
- Medium: Follow imports, read critical sections
- Thorough: Trace all dependencies, check tests/types

Strategy:
1. glob/grep to locate relevant code
2. Read key sections (not entire files)
3. Identify types, interfaces, key functions
4. Note dependencies between files

Your FINAL assistant message is your entire deliverable — it must stand alone, using this format:

## Files Found
List with exact line ranges:
1. \`path/to/file.ts\` (lines 10-50) — Description

## Key Code
Critical types, interfaces, or functions with actual code snippets.

## Architecture
Brief explanation of how the pieces connect.

## Start Here
Which file to look at first and why.`

const RESEARCHER_SYSTEM = `You are a research specialist. Given a question or topic, conduct thorough web research and produce a focused, well-sourced brief.

You operate in an isolated context with no knowledge of any prior conversation. All necessary context is in the task description.

Process:
1. Break the question into 2-4 searchable facets
2. Search with \`websearch\` using varied angles
3. Read the answers. Identify what is well-covered and what has gaps.
4. For the 2-3 most promising source URLs, use \`webfetch\` to get full page content
5. Synthesize everything into a brief that directly answers the question

Evaluation — keep primary sources over blogs; recent over stale; directly relevant over tangential. Drop SEO filler and outdated material.

Your FINAL assistant message is your entire deliverable — it must stand alone, using this format:

## Summary
2-3 sentence direct answer.

## Findings
Numbered findings with inline source citations:
1. **Finding** — explanation. [Source](url)

## Sources
- Kept: Source Title (url) — why relevant
- Dropped: Source Title — why excluded

## Gaps
What could not be answered. Suggested next steps.`

const WORKER_SYSTEM = `You are a worker agent. You operate in an isolated context — you have no knowledge of any prior conversation. All necessary context will be provided in the task description.

Work autonomously to complete the assigned task. When you are finished, write your final summary message and stop.

Guidelines:
- Read files before editing to understand existing code
- Make targeted edits, not wholesale rewrites
- Use \`shell\` for running commands (tests, builds, installs)
- If something fails, diagnose and fix it
- Your FINAL assistant message should summarize what you did and what changed

## Delegation — protecting your context window

Your context is finite. You may dispatch \`scout\` (read-only recon) and \`researcher\` (web research) via the native \`subagent\` tool. Their context is separate from yours; you only receive their summary.

Dispatch a scout when the brief names an area but not specific files, or when you would need to grep and read five or more files just to orient. Read directly when the brief already gives you exact file paths.

A good rhythm: scout to find, read to edit. Scouting returns summaries, so re-read the one to three files you actually edit.

## Output format when done

## Changes Made
- \`path/to/file.ts\` — what changed and why

## Verification
How you verified the changes work (tests run, build succeeded, etc.)

## Notes
Any caveats, follow-up items, or decisions made.`

const SCOUT_SPEC: AgentSpec = {
  id: "scout",
  name: "Scout",
  description: "Fast codebase recon — explores files, finds patterns, maps architecture",
  system: SCOUT_SYSTEM,
  extra: [
    { action: "edit", resource: "*", effect: "deny" },
    { action: "shell", resource: "*", effect: "deny" },
    { action: "webfetch", resource: "*", effect: "deny" },
    { action: "websearch", resource: "*", effect: "deny" },
    { action: "subagent", resource: "*", effect: "deny" },
  ],
}

const RESEARCHER_SPEC: AgentSpec = {
  id: "researcher",
  name: "Researcher",
  description: "Web researcher — searches the web and synthesizes a sourced brief",
  system: RESEARCHER_SYSTEM,
  extra: [
    { action: "edit", resource: "*", effect: "deny" },
    { action: "shell", resource: "*", effect: "deny" },
    { action: "subagent", resource: "*", effect: "deny" },
  ],
}

const WORKER_SPEC: AgentSpec = {
  id: "worker",
  name: "Worker",
  description: "General-purpose implementer — reads, writes, and edits code; may dispatch scout and researcher",
  system: WORKER_SYSTEM,
  extra: [
    { action: "subagent", resource: "*", effect: "deny" },
    { action: "subagent", resource: "scout", effect: "allow" },
    { action: "subagent", resource: "researcher", effect: "allow" },
  ],
}

export const AGENT_SPECS: AgentSpec[] = [SCOUT_SPEC, RESEARCHER_SPEC, WORKER_SPEC]

function yaml(value: string): string {
  return JSON.stringify(value)
}

/** Render one agent as an OpenCode Markdown agent definition. */
export function renderAgentMarkdown(spec: AgentSpec, model?: string): string {
  const lines = [
    "---",
    `description: ${yaml(spec.description)}`,
    "mode: subagent",
  ]
  if (model) lines.push(`model: ${model}`)
  lines.push(`permissions: ${JSON.stringify(spec.extra, null, 2)}`)
  lines.push("---", "", MANAGED_MARKER, "", spec.system, "")
  return lines.join("\n")
}

function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(base, "opencode")
}

function agentsDir(ctx: Context): string {
  const configured = (ctx.options as Record<string, unknown>).agentsDir
  if (typeof configured === "string" && configured.trim()) return configured
  const override = process.env.OPENCODE_AGENTS_DIR?.trim()
  if (override) return override
  return join(configDir(), "agents")
}

/** Write managed agent files. User-owned files are never overwritten. */
function installAgents(ctx: Context, model: string | undefined): string[] {
  const dir = agentsDir(ctx)
  mkdirSync(dir, { recursive: true })
  const written: string[] = []
  for (const spec of AGENT_SPECS) {
    const path = join(dir, `${spec.id}.md`)
    const content = renderAgentMarkdown(spec, model)
    try {
      if (existsSync(path)) {
        const existing = readFileSync(path, "utf8")
        if (!existing.includes(MANAGED_MARKER)) continue
        if (existing === content) continue
      }
      writeFileSync(path, content)
      written.push(path)
    } catch {
      // Best-effort; a read-only config dir just means agents are not installed.
    }
  }
  return written
}

export async function setupAgents(ctx: Context): Promise<void> {
  const options = ctx.options as Record<string, unknown>
  const configured = options.agentModel
  const model = typeof configured === "string" && configured.includes("/") ? configured : undefined

  if (options.installAgents !== false) installAgents(ctx, model)

  // If the agents already exist (for example when a user copied the bundled
  // definitions), enforce the subagent mode and least-privilege permissions
  // natively, without a file write.
  await ctx.agent.transform((editor) => {
    for (const spec of AGENT_SPECS) {
      editor.update(spec.id, (agent) => {
        const target = agent as unknown as {
          mode: string
          permissions: Permission[]
        }
        target.mode = "subagent"
        target.permissions = [...(target.permissions ?? []), ...spec.extra]
      })
    }
  })
}
