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
  version: 2
  checkedAt: number
  models: CatalogModel[]
}

const CACHE_VERSION = 2

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

/**
 * Gateway-internal / leaf / provider-routing ids that must never surface to a
 * customer. OpenAI-compatible ids use [a-z0-9./-]; a bare `h-` leaf namespace,
 * a `-h-` leaf infix (`claude-h-*`), `tmp-`/`demo`, `apifun`, an `-af`
 * provider tag, or a router/leaf/auto_router name marks an internal entry.
 *
 * Deliberately NOT a bare-underscore match: the live catalog is filtered with
 * this predicate too, and a legitimate future id containing `_` must not
 * silently vanish from a paying customer's picker.
 */
const INTERNAL_MODEL_ID =
  /(^h-|-h-|^tmp[-_]|^Analyzer$|[-_]demo|[-_]router$|[-_]leaf$|[-_]apifun$|[-_]af$|auto_router)/i

export function isCustomerFacingModelId(id: string): boolean {
  return !INTERNAL_MODEL_ID.test(id)
}

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
  if (!isCustomerFacingModelId(id)) return undefined

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
  const skippedInternal: string[] = []
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue
    const entry = raw as Record<string, unknown>
    const id = asString(entry.id)
    if (!id || seen.has(id)) continue
    if (!isCustomerFacingModelId(id)) {
      skippedInternal.push(id)
      continue
    }
    const model = toModel(id, entry, info.get(id))
    if (!model) continue
    seen.add(id)
    models.push(model)
  }
  if (skippedInternal.length > 0) {
    // Debug-level so a future over-filter is visible in the field without
    // spamming normal logs: a legit id landing here means the predicate above
    // needs narrowing.
    console.debug(
      `[hawiyat] filtered ${skippedInternal.length} internal model ids: ${skippedInternal.join(", ")}`,
    )
  }
  return models.sort((a, b) => a.id.localeCompare(b.id))
}

export function readCache(): CatalogModel[] {
  try {
    const parsed = JSON.parse(readFileSync(cachePath(), "utf8")) as Partial<CacheFile>
    if (parsed?.version !== CACHE_VERSION || !Array.isArray(parsed.models)) return []
    return parsed.models.filter((m) => typeof m?.id === "string" && isCustomerFacingModelId(m.id))
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
