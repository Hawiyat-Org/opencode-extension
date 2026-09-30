/**
 * Usage aggregation for the `/stats` command and `usage_stats` tool.
 *
 * OpenCode v2's plugin context exposes session reads but not session
 * enumeration or the native `session.stats` operation, so this domain reads the
 * host's own session store directly: the SQLite database OpenCode already
 * uses (`<data>/opencode/opencode.db`). Only read-only queries are issued.
 *
 * Schema touched (stable across OpenCode v2):
 *   - `session`  : directory/title/lineage and lifetime tokens/cost.
 *   - `message`  : per-message `data` JSON with `tokens`, `cost`, model refs.
 *   - `part`     : per-part `data` JSON; `$.tool` names tool calls.
 */

import { homedir } from "node:os"
import { join } from "node:path"

export interface ModelRow {
  key: string
  requests: number
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  tokens: number
  cost: number
}

export interface ProjectRow {
  directory: string
  sessions: number
  messages: number
  tokens: number
  cost: number
}

export interface DayRow {
  date: string
  messages: number
  tokens: number
  cost: number
}

export interface ToolRow {
  name: string
  count: number
}

export interface SessionRow {
  id: string
  title: string
  directory: string
  isSubagent: boolean
  created: number
  updated: number
  messages: number
  tokens: number
  cost: number
  models: string[]
}

export interface UsageTotals {
  sessions: number
  subagents: number
  messages: number
  userMessages: number
  assistantMessages: number
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  tokens: number
  cost: number
  activeDays: number
  first: number
  last: number
}

export interface UsageReport {
  label: string
  sinceMs: number | null
  generatedAt: number
  totals: UsageTotals
  models: ModelRow[]
  projects: ProjectRow[]
  days: DayRow[]
  tools: ToolRow[]
  sessions: SessionRow[]
}

export function databasePath(): string {
  if (process.env.OPENCODE_DB) return process.env.OPENCODE_DB
  const base = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share")
  return join(base, "opencode", "opencode.db")
}

interface DayAcc {
  messages: number
  tokens: number
  cost: number
}

interface SessionAcc {
  messages: number
  user: number
  assistant: number
  tokens: number
  cost: number
  models: Set<string>
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

export function dayKey(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function isoDayKey(value: unknown): string {
  const text = str(value)
  const parsed = Date.parse(text)
  return Number.isFinite(parsed) ? dayKey(parsed) : text.slice(0, 10)
}

export async function loadUsage(sinceMs: number | null, label: string): Promise<UsageReport> {
  const { Database } = (await import("bun:sqlite")) as unknown as {
    Database: new (path: string, options?: { readonly?: boolean }) => {
      query(sql: string): { all(...params: unknown[]): unknown[] }
      close(): void
    }
  }

  const db = new Database(databasePath(), { readonly: true })
  try {
    const cutoff = sinceMs ?? 0
    const where = sinceMs === null ? "" : "where time_created >= ?"
    const params: unknown[] = sinceMs === null ? [] : [cutoff]

    // Session metadata for directory/title/lineage lookups.
    const sessionMeta = new Map<
      string,
      { directory: string; title: string; isSubagent: boolean; created: number; updated: number }
    >()
    for (const raw of db
      .query("select id, directory, title, parent_id, time_created, time_updated from session")
      .all() as Array<Record<string, unknown>>) {
      sessionMeta.set(str(raw.id), {
        directory: str(raw.directory),
        title: str(raw.title),
        isSubagent: raw.parent_id !== null && raw.parent_id !== undefined,
        created: num(raw.time_created),
        updated: num(raw.time_updated),
      })
    }

    const models = new Map<string, ModelRow>()
    const days = new Map<string, DayAcc>()
    const sessions = new Map<string, SessionAcc>()
    const tools = new Map<string, number>()
    const totals = {
      messages: 0,
      userMessages: 0,
      assistantMessages: 0,
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      tokens: 0,
      cost: 0,
      first: 0,
      last: 0,
    }

    const sessionAcc = (id: string): SessionAcc => {
      let acc = sessions.get(id)
      if (!acc) {
        acc = { messages: 0, user: 0, assistant: 0, tokens: 0, cost: 0, models: new Set() }
        sessions.set(id, acc)
      }
      return acc
    }

    for (const raw of db
      .query(`select session_id, time_created, data from message ${where}`)
      .all(...params) as Array<Record<string, unknown>>) {
      const sessionID = str(raw.session_id)
      const at = num(raw.time_created)
      let message: Record<string, unknown>
      try {
        message = JSON.parse(str(raw.data)) as Record<string, unknown>
      } catch {
        continue
      }
      const role = str(message.role)
      if (role !== "user" && role !== "assistant") continue

      const date = dayKey(at)
      const day = days.get(date) ?? { messages: 0, tokens: 0, cost: 0 }
      day.messages += 1
      days.set(date, day)

      const acc = sessionAcc(sessionID)
      acc.messages += 1
      totals.messages += 1
      if (at) {
        if (!totals.first || at < totals.first) totals.first = at
        if (at > totals.last) totals.last = at
      }

      if (role === "user") {
        totals.userMessages += 1
        acc.user += 1
        continue
      }

      totals.assistantMessages += 1
      acc.assistant += 1

      const tokens = (message.tokens ?? {}) as Record<string, unknown>
      const cache = (tokens.cache ?? {}) as Record<string, unknown>
      const input = num(tokens.input)
      const output = num(tokens.output)
      const reasoning = num(tokens.reasoning)
      const cacheRead = num(cache.read)
      const cacheWrite = num(cache.write)
      const cost = num(message.cost)
      const tokenSum = input + output + reasoning + cacheRead + cacheWrite

      totals.input += input
      totals.output += output
      totals.reasoning += reasoning
      totals.cacheRead += cacheRead
      totals.cacheWrite += cacheWrite
      totals.tokens += tokenSum
      totals.cost += cost
      day.tokens += tokenSum
      day.cost += cost
      acc.tokens += tokenSum
      acc.cost += cost

      const key = `${str(message.providerID, "?")}/${str(message.modelID, "?")}`
      acc.models.add(key)
      const model = models.get(key) ?? {
        key,
        requests: 0,
        input: 0,
        output: 0,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        tokens: 0,
        cost: 0,
      }
      model.requests += 1
      model.input += input
      model.output += output
      model.reasoning += reasoning
      model.cacheRead += cacheRead
      model.cacheWrite += cacheWrite
      model.tokens += tokenSum
      model.cost += cost
      models.set(key, model)
    }

    const toolWhere = sinceMs === null ? "" : "and time_created >= ?"
    for (const raw of db
      .query(
        `select json_extract(data, '$.tool') as name, count(*) as count
         from part
         where json_extract(data, '$.type') = 'tool' ${toolWhere}
         group by name`,
      )
      .all(...params) as Array<Record<string, unknown>>) {
      const name = str(raw.name, "unknown") || "unknown"
      tools.set(name, (tools.get(name) ?? 0) + num(raw.count))
    }

    const sessionRows: SessionRow[] = []
    for (const [id, acc] of sessions) {
      const meta = sessionMeta.get(id)
      sessionRows.push({
        id,
        title: meta?.title ?? "",
        directory: meta?.directory ?? "(unknown)",
        isSubagent: meta?.isSubagent ?? false,
        created: meta?.created ?? 0,
        updated: meta?.updated ?? 0,
        messages: acc.messages,
        tokens: acc.tokens,
        cost: acc.cost,
        models: Array.from(acc.models),
      })
    }
    sessionRows.sort((a, b) => b.cost - a.cost || b.updated - a.updated)

    const projects = new Map<string, ProjectRow>()
    for (const row of sessionRows) {
      const key = row.directory || "(unknown)"
      const project = projects.get(key) ?? { directory: key, sessions: 0, messages: 0, tokens: 0, cost: 0 }
      project.sessions += 1
      project.messages += row.messages
      project.tokens += row.tokens
      project.cost += row.cost
      projects.set(key, project)
    }

    const dayRows: DayRow[] = Array.from(days, ([date, acc]) => ({
      date,
      messages: acc.messages,
      tokens: acc.tokens,
      cost: acc.cost,
    })).sort((a, b) => (a.date < b.date ? -1 : 1))

    return {
      label,
      sinceMs,
      generatedAt: Date.now(),
      totals: {
        sessions: sessionRows.length,
        subagents: sessionRows.filter((s) => s.isSubagent).length,
        messages: totals.messages,
        userMessages: totals.userMessages,
        assistantMessages: totals.assistantMessages,
        input: totals.input,
        output: totals.output,
        reasoning: totals.reasoning,
        cacheRead: totals.cacheRead,
        cacheWrite: totals.cacheWrite,
        tokens: totals.tokens,
        cost: totals.cost,
        activeDays: dayRows.length,
        first: totals.first,
        last: totals.last,
      },
      models: Array.from(models.values()).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens),
      projects: Array.from(projects.values()).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens),
      days: dayRows,
      tools: Array.from(tools, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      sessions: sessionRows,
    }
  } finally {
    db.close()
  }
}
