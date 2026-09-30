/**
 * pi-stats port: `/stats` command + `usage_stats` tool.
 *
 * Mechanism mapping (see NOTES.md):
 *   - `ctx.command.transform` registers `/stats [today|7d|30d|90d|all]`.
 *   - `ctx.tool.transform` registers `usage_stats`.
 *   - Aggregation reads the host's SQLite session store read-only and caches
 *     the last report in memory for the process lifetime.
 */

import type { Context } from "@opencode/plugin/promise/plugin"
import { loadUsage, type UsageReport } from "./db"
import { parseRange, renderJson, renderText } from "./report"

interface CacheEntry {
  at: number
  report: UsageReport
}

const CACHE_TTL_MS = 30_000
const cache = new Map<string, CacheEntry>()

async function report(rangeArg: string | undefined): Promise<UsageReport> {
  const def = parseRange(rangeArg)
  const key = def.arg
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.report
  const fresh = await loadUsage(def.sinceMs, def.label)
  cache.set(key, { at: Date.now(), report: fresh })
  return fresh
}

function rangeFromPrompt(text: string): string | undefined {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  return tokens.length ? tokens[tokens.length - 1] : undefined
}

export async function setupStats(ctx: Context): Promise<void> {
  await ctx.command.transform((editor) => {
    editor.add({
      name: "stats",
      description: "Usage report across all OpenCode sessions (tokens, cost, models, projects)",
      execute: async ({ sessionID, prompt }) => {
        let text: string
        try {
          const result = await report(rangeFromPrompt(prompt.text ?? ""))
          text = renderText(result)
        } catch (error) {
          text = `usage stats unavailable: ${error instanceof Error ? error.message : String(error)}`
        }
        await ctx.session.synthetic({ sessionID, text, description: "usage stats" } as never)
      },
    })
  })

  await ctx.tool.transform((editor) => {
    editor.add({
      name: "usage_stats",
      description:
        "Report the user's OpenCode usage: sessions, messages, tokens, cost, models, projects and daily activity. " +
        "Use when the user asks about their usage, spend, token consumption, or which models they use.",
      input: {
        type: "object",
        properties: {
          range: { type: "string", description: "today, 7d, 30d, 90d, or all. Default: all." },
          format: { type: "string", description: "'text' (default) or 'json' for structured data." },
        },
        additionalProperties: false,
      },
      execute: async (input: unknown) => {
        const params = (input ?? {}) as { range?: string; format?: string }
        const result = await report(params.range)
        const asJson = String(params.format ?? "").toLowerCase() === "json"
        return {
          content: asJson ? renderJson(result) : renderText(result),
          metadata: {
            range: result.label,
            sessions: result.totals.sessions,
            tokens: result.totals.tokens,
            cost: result.totals.cost,
          },
        }
      },
    } as never)
  })
}
