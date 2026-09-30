/**
 * Hawiyat model catalog.
 *
 * The LiteLLM gateway exposes a different model list per API key, so the
 * catalog is fetched from `/v1/models` (key-scoped) and enriched with
 * `/model_group/info` (mode, vision, reasoning, cost). The last good catalog is
 * cached on disk for startup and offline use.
 *
 * Ported from Hawiyat-Org/pi-extension (MIT), `hawiyat-provider/index.ts`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import {
  BASE_URL,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  ORIGIN,
} from "../constants"

export interface CatalogModel {
  id: string
  name: string
  reasoning: boolean
  input: Array<"text" | "image">
  contextWindow: number
  maxTokens: number
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
}

interface CacheFile {
  version: 1
  checkedAt: number
  models: CatalogModel[]
}

const CACHE_VERSION = 1

function cachePath(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache")
  return join(base, "opencode", "hawiyat-models.json")
}

const NON_CHAT_MODES = new Set([
  "embedding",
  "image_generation",
  "image_edit",
  "audio_transcription",
  "audio_speech",
  "moderation",
  "rerank",
  "video_generation",
])

/** Fallback filter for entries whose mode is unknown. */
const NON_CHAT_ID = /(^text-embedding|^tts-|whisper|transcribe|^gpt-image|dall-e|moderation|rerank)/i

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined
}

/** Per-token price -> per-million-token price. */
function perMillion(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Number((value * 1_000_000).toFixed(4))
    : 0
}

function toModel(
  id: string,
  entry: Record<string, unknown>,
  info: Record<string, unknown> | undefined,
): CatalogModel | undefined {
  const mode = asString(info?.mode)?.toLowerCase()
  if (mode ? NON_CHAT_MODES.has(mode) : NON_CHAT_ID.test(id)) return undefined

  return {
    id,
    name: id,
    reasoning: info?.supports_reasoning === true,
    input: info?.supports_vision === true ? ["text", "image"] : ["text"],
    cost: {
      input: perMillion(info?.input_cost_per_token),
      output: perMillion(info?.output_cost_per_token),
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow:
      asPositiveNumber(entry.max_input_tokens) ??
      asPositiveNumber(info?.max_input_tokens) ??
      DEFAULT_CONTEXT_WINDOW,
    maxTokens:
      asPositiveNumber(entry.max_output_tokens) ??
      asPositiveNumber(info?.max_output_tokens) ??
      DEFAULT_MAX_TOKENS,
  }
}

export async function fetchModels(apiKey: string, signal: AbortSignal): Promise<CatalogModel[]> {
  const headers = { Authorization: `Bearer ${apiKey}` }
  const response = await fetch(`${BASE_URL}/models`, { headers, signal })
  if (!response.ok) {
    throw new Error(`Hawiyat model list failed (${response.status} ${response.statusText})`)
  }

  const info = new Map<string, Record<string, unknown>>()
  try {
    const infoResponse = await fetch(`${ORIGIN}/model_group/info`, { headers, signal })
    const infoPayload = infoResponse.ok
      ? ((await infoResponse.json()) as { data?: unknown })
      : undefined
    if (Array.isArray(infoPayload?.data)) {
      for (const raw of infoPayload.data) {
        const name = asString((raw as Record<string, unknown>)?.model_group)
        if (name) info.set(name, raw as Record<string, unknown>)
      }
    }
  } catch {
    // Enrichment is optional.
  }

  const payload = (await response.json()) as { data?: unknown }
  const entries = Array.isArray(payload.data) ? payload.data : []
  const models: CatalogModel[] = []
  const seen = new Set<string>()
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue
    const entry = raw as Record<string, unknown>
    const id = asString(entry.id)
    if (!id || seen.has(id)) continue
    const model = toModel(id, entry, info.get(id))
    if (!model) continue
    seen.add(id)
    models.push(model)
  }
  return models.sort((a, b) => a.id.localeCompare(b.id))
}

export function readCache(): CatalogModel[] {
  try {
    const parsed = JSON.parse(readFileSync(cachePath(), "utf8")) as Partial<CacheFile>
    return parsed?.version === CACHE_VERSION && Array.isArray(parsed.models) ? parsed.models : []
  } catch {
    return []
  }
}

export function writeCache(models: CatalogModel[]): void {
  try {
    const path = cachePath()
    mkdirSync(dirname(path), { recursive: true })
    const payload: CacheFile = { version: CACHE_VERSION, checkedAt: Date.now(), models }
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`)
  } catch {
    // Best-effort cache.
  }
}

export function cacheFilePath(): string {
  return cachePath()
}
