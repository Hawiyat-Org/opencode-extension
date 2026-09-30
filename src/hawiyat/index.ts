/**
 * Hawiyat provider registration for OpenCode v2.
 *
 * Mechanism mapping (see NOTES.md):
 *   - `ctx.provider.transform` adds the `hawiyat` provider backed by OpenCode's
 *     built-in OpenAI-compatible runtime, including its key-scoped models.
 *   - `ctx.session.hook("http.response", …, { providerID })` rewrites the
 *     gateway's non-standard SSE into OpenAI chunks before the driver parses it.
 *
 * The catalog is cached on disk. The gateway key is resolved from (in order):
 * plugin options, `HAWIYAT_API_KEY`, the OpenCode integration connection, and
 * the OpenCode auth store. No secret is ever written to the repository.
 */

import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Context } from "@opencode/plugin/promise/plugin"
import type { Registration } from "@opencode/plugin/promise/registration"
import { Provider } from "@opencode/plugin"
import {
  API_KEY_ENV,
  BASE_URL,
  INTEGRATION_IDS,
  PROVIDER_ID,
  PROVIDER_NAME,
  PROVIDER_PACKAGE,
} from "../constants"
import { fetchModels, readCache, writeCache, type CatalogModel } from "./catalog"
import { normalizeSSEResponse } from "./stream"

export type Cleanup = () => void | Promise<void>

function extractKey(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["key", "apiKey", "api_key", "token"]) {
      const candidate = record[key]
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
    }
    if (record.value !== undefined) return extractKey(record.value)
  }
  return undefined
}

/** Best-effort read of the OpenCode auth store (never committed). */
function readAuthKey(): string | undefined {
  const base = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share")
  try {
    const raw = JSON.parse(readFileSync(join(base, "opencode", "auth.json"), "utf8")) as Record<string, unknown>
    for (const id of INTEGRATION_IDS) {
      const key = extractKey(raw?.[id])
      if (key) return key
    }
  } catch {
    // No auth store: caller falls back to env/options.
  }
  return undefined
}

interface KeyResolver {
  resolve(): Promise<string | undefined>
}

function makeKeyResolver(ctx: Context): KeyResolver {
  let cached: string | undefined
  let integrationPromise: Promise<string | undefined> | undefined

  const fromIntegration = (): Promise<string | undefined> => {
    integrationPromise ??= (async () => {
      for (const id of INTEGRATION_IDS) {
        try {
          const connection = await ctx.integration.connection.active(id)
          if (!connection) continue
          const value = await ctx.integration.connection.resolve(connection)
          const key = extractKey(value)
          if (key) return key
        } catch {
          // Try the next integration id.
        }
      }
      return undefined
    })()
    return integrationPromise
  }

  return {
    async resolve(): Promise<string | undefined> {
      const fromOptions = extractKey((ctx.options as Record<string, unknown>).apiKey)
      if (fromOptions) return fromOptions
      const fromEnv = process.env[API_KEY_ENV]?.trim()
      if (fromEnv) return fromEnv
      if (cached) return cached
      const fromIntegrationKey = await fromIntegration()
      if (fromIntegrationKey) {
        cached = fromIntegrationKey
        return cached
      }
      const fromAuth = readAuthKey()
      if (fromAuth) {
        cached = fromAuth
        return cached
      }
      return undefined
    },
  }
}

/** Convert a catalog entry into the OpenCode model shape. */
function toModelInfo(model: CatalogModel): unknown {
  return {
    id: model.id,
    modelID: model.id,
    providerID: PROVIDER_ID,
    name: model.name,
    capabilities: { tools: true, input: model.input, output: ["text"] },
    variants: [],
    time: { released: 0 },
    cost: [
      {
        input: model.cost.input,
        output: model.cost.output,
        cache: { read: model.cost.cacheRead, write: model.cost.cacheWrite },
      },
    ],
    status: "active",
    enabled: true,
    limit: { context: model.contextWindow, output: model.maxTokens },
    compatibility: {
      supportsPromptCacheKey: false,
      // The gateway streams reasoning as `reasoning_content` deltas.
      reasoningField: "reasoning_content",
    },
  }
}

export async function setupHawiyat(ctx: Context, cleanups: Cleanup[]): Promise<Registration[]> {
  const registrations: Registration[] = []
  const state: { models: CatalogModel[]; apiKey?: string } = { models: readCache() }
  const keys = makeKeyResolver(ctx)

  const refresh = async (): Promise<void> => {
    const key = await keys.resolve()
    if (!key) return
    state.apiKey = key
    try {
      const fetched = await fetchModels(key, AbortSignal.timeout(10_000))
      if (fetched.length === 0) return
      state.models = fetched
      writeCache(fetched)
      await ctx.provider.reload()
    } catch {
      // Keep the last good catalog (cache or in-memory).
    }
  }

  // Resolve the credential up front so it can be attached to the provider
  // settings; the runtime needs it at provider construction time.
  state.apiKey = await keys.resolve()

  // On a cold start with no cache, try once so models are selectable
  // immediately. A warm start refreshes in the background.
  if (state.models.length === 0) {
    await refresh()
  } else {
    void refresh()
  }

  registrations.push(
    await ctx.provider.transform((editor) => {
      const settings: Record<string, unknown> = { baseURL: BASE_URL }
      if (state.apiKey) settings.apiKey = state.apiKey
      const info = {
        ...Provider.Info.empty(PROVIDER_ID as never),
        name: PROVIDER_NAME,
        activation: "enabled" as const,
        package: PROVIDER_PACKAGE,
        settings,
      }
      editor.add({
        info: info as never,
        models: state.models.map(toModelInfo) as never,
      })
    }),
  )

  // The SSE rewrite lives on the native HTTP response hook: OpenCode's
  // OpenAI-compatible runtime parses SSE inside its own driver, before any
  // LanguageModelV3 exists, and the `aisdk` hooks do not fire for native
  // provider packages. `http.response` is the documented hook for exactly this.
  registrations.push(
    await ctx.session.hook(
      "http.response",
      (event) => {
        const contentType = event.response.headers.get("content-type") ?? ""
        if (!contentType.includes("text/event-stream")) return
        event.response = normalizeSSEResponse(event.response)
      },
      { providerID: PROVIDER_ID },
    ),
  )

  const timer = setInterval(() => {
    void refresh()
  }, 10 * 60 * 1000)
  ;(timer as { unref?: () => void }).unref?.()
  cleanups.push(() => clearInterval(timer))

  return registrations
}
