/**
 * Range parsing and formatting for the stats domain.
 *
 * Ported in spirit from Hawiyat-Org/pi-extension (MIT), `pi-stats/report.ts`.
 */

import type { UsageReport } from "./db"

export interface RangeDef {
  arg: string
  label: string
  sinceMs: number | null
}

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function daysAgo(n: number): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (n - 1))
  return d.getTime()
}

export function rangeDefs(): RangeDef[] {
  return [
    { arg: "today", label: "today", sinceMs: startOfToday() },
    { arg: "7d", label: "7 days", sinceMs: daysAgo(7) },
    { arg: "30d", label: "30 days", sinceMs: daysAgo(30) },
    { arg: "90d", label: "90 days", sinceMs: daysAgo(90) },
    { arg: "all", label: "all time", sinceMs: null },
  ]
}

export const DEFAULT_RANGE = "all"

export function parseRange(input: string | undefined): RangeDef {
  const defs = rangeDefs()
  const value = (input ?? "").trim().toLowerCase()
  if (!value) return defs[defs.length - 1]!
  if (value === "today" || value === "d") return defs[0]!
  if (value === "7d" || value === "7" || value === "week" || value === "w") return defs[1]!
  if (value === "30d" || value === "30" || value === "month" || value === "m") return defs[2]!
  if (value === "90d" || value === "90" || value === "quarter" || value === "q") return defs[3]!
  return defs[defs.length - 1]!
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

export function fmtCost(n: number): string {
  if (!n || !Number.isFinite(n)) return "$0.00"
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`
  if (Math.abs(n) < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

export function fmtDate(ms: number): string {
  if (!ms) return "—"
  const d = new Date(ms)
  const p = (x: number) => String(x).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function renderText(report: UsageReport, limit = 8): string {
  const t = report.totals
  const lines: string[] = []
  lines.push(`hawiyat usage · ${report.label} · ${fmtDate(t.first)} → ${fmtDate(t.last)}`)
  lines.push(
    `${fmtInt(t.sessions)} sessions (${fmtInt(t.subagents)} subagents) · ${fmtInt(t.messages)} messages (user ${fmtInt(
      t.userMessages,
    )} · assistant ${fmtInt(t.assistantMessages)})`,
  )
  lines.push(
    `tokens ${fmtCompact(t.tokens)} (in ${fmtCompact(t.input)} · out ${fmtCompact(t.output)} · cache-r ${fmtCompact(
      t.cacheRead,
    )} · cache-w ${fmtCompact(t.cacheWrite)} · reasoning ${fmtCompact(t.reasoning)})`,
  )
  lines.push(
    `cost ${fmtCost(t.cost)} · avg/session ${fmtCost(t.sessions ? t.cost / t.sessions : 0)} · ${fmtInt(
      t.activeDays,
    )} active days`,
  )

  if (report.models.length) {
    lines.push("top models:")
    for (const m of report.models.slice(0, limit)) {
      const pct = t.cost > 0 ? ` (${Math.round((m.cost / t.cost) * 100)}%)` : ""
      lines.push(`  ${m.key}  ${fmtCost(m.cost)}${pct}  ${fmtInt(m.requests)} req`)
    }
  }
  if (report.projects.length) {
    lines.push("top projects:")
    for (const p of report.projects.slice(0, limit)) {
      lines.push(`  ${p.directory}  ${fmtCost(p.cost)}  ${fmtInt(p.tokens)} tokens · ${fmtInt(p.sessions)} sessions`)
    }
  }
  if (report.tools.length) {
    lines.push("top tools:")
    for (const tool of report.tools.slice(0, limit)) {
      lines.push(`  ${tool.name}  ${fmtInt(tool.count)}`)
    }
  }
  lines.push(`[store ${report.sessions.length} sessions in range]`)
  return lines.join("\n")
}

export function renderJson(report: UsageReport): string {
  return JSON.stringify(
    {
      range: report.label,
      generatedAt: report.generatedAt,
      totals: report.totals,
      models: report.models.slice(0, 30),
      projects: report.projects.slice(0, 30),
      days: report.days.slice(-30),
      tools: report.tools.slice(0, 30),
      sessions: report.sessions.slice(0, 30).map((s) => ({
        id: s.id,
        title: s.title,
        directory: s.directory,
        subagent: s.isSubagent,
        messages: s.messages,
        tokens: s.tokens,
        cost: s.cost,
      })),
    },
    null,
    2,
  )
}
