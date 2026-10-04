import { afterAll, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Keep the plugin away from the real caches/config while testing.
const sandbox = mkdtempSync(join(tmpdir(), "hawiyat-ext-"))
process.env.XDG_CACHE_HOME = join(sandbox, "cache")
process.env.XDG_DATA_HOME = join(sandbox, "data")

const agentsDir = join(sandbox, "agents")

// A real key in the developer's shell would turn the "key-less" tests into
// live-network tests (cold start awaits refresh() up to 10s). Force key-less.
const savedKey = process.env.HAWIYAT_API_KEY
delete process.env.HAWIYAT_API_KEY

import plugin from "../src/index"
import {
  cacheFilePath,
  fetchModels,
  isCustomerFacingModelId,
  writeCache,
  type CatalogModel,
} from "../src/hawiyat/catalog"
import { BASE_URL, ORIGIN } from "../src/constants"
import { normalizeStreamingFetch, isOpenAIChunk } from "../src/hawiyat/stream"

interface Calls {
  providerAdds: number
  modelAdds: number
  providerInfos: Array<Record<string, unknown>>
  providerModels: Array<Record<string, unknown>>
  toolAdds: string[]
  toolUpdates: string[]
  commands: string[]
  hooks: string[]
  agentUpdates: string[]
  integrationUpdates: string[]
  keyMethods: Array<Record<string, unknown>>
  envMethods: Array<ReadonlyArray<string>>
}

function makeFakeContext(calls: Calls): unknown {
  const registration = { dispose: async () => {} }
  const providerTransform = (cb: (editor: never) => void) => {
    cb(makeProviderEditor(calls) as never)
    return Promise.resolve(registration)
  }
  const toolTransform = (cb: (editor: never) => void) => {
    cb(makeToolEditor(calls) as never)
    return Promise.resolve(registration)
  }
  const commandTransform = (cb: (editor: never) => void) => {
    cb(makeCommandEditor(calls) as never)
    return Promise.resolve(registration)
  }
  const agentTransform = (cb: (editor: never) => void) => {
    cb(makeAgentEditor(calls) as never)
    return Promise.resolve(registration)
  }
  const integrationTransform = (cb: (editor: never) => void) => {
    cb(makeIntegrationEditor(calls) as never)
    return Promise.resolve(registration)
  }
  return {
    app: { name: "test", version: "0.0.0", channel: "test" },
    location: { directory: sandbox, project: { id: "test", directory: sandbox, canonical: sandbox } },
    options: { agentsDir },
    provider: { transform: providerTransform, reload: async () => {} },
    model: { transform: providerTransform, reload: async () => {} },
    tool: { transform: toolTransform, list: async () => [], reload: async () => {} },
    command: { transform: commandTransform, list: async () => [], reload: async () => {} },
    agent: { transform: agentTransform, list: async () => [], get: async () => undefined, reload: async () => {} },
    aisdk: {
      hook: (_name: string, _cb: unknown, _opts?: unknown) => {
        calls.hooks.push(String(_name))
        return Promise.resolve(registration)
      },
    },
    integration: {
      transform: integrationTransform,
      reload: async () => {},
      connection: {
        active: async () => undefined,
        resolve: async () => undefined,
      },
    },
    session: {
      hook: (name: string, _cb: unknown, _opts?: unknown) => {
        calls.hooks.push("session:" + name)
        return Promise.resolve(registration)
      },
      synthetic: async () => ({}),
    },
  }
}

function makeProviderEditor(calls: Calls): unknown {
  return {
    add: (input: { info?: Record<string, unknown>; models?: Array<Record<string, unknown>> }) => {
      calls.providerAdds += 1
      calls.modelAdds += input.models?.length ?? 0
      if (input.info) calls.providerInfos.push(input.info)
      if (input.models) calls.providerModels.push(...input.models)
    },
    list: () => [],
    get: () => undefined,
    remove: () => {},
    models: { set: () => {}, update: () => {}, remove: () => {} },
  }
}

function makeToolEditor(calls: Calls): unknown {
  return {
    list: () => [],
    get: (id: string) =>
      id === "webfetch" ? { id, name: "webfetch", description: "", input: {}, execute: async () => ({}) } : undefined,
    add: (tool: { name: string }) => calls.toolAdds.push(tool.name),
    update: (id: string) => calls.toolUpdates.push(id),
    remove: () => {},
    namespace: () => {},
  }
}

function makeCommandEditor(calls: Calls): unknown {
  return {
    add: (definition: { name: string }) => calls.commands.push(definition.name),
  }
}

function makeAgentEditor(calls: Calls): unknown {
  return {
    list: () => [],
    get: () => undefined,
    default: () => {},
    remove: () => {},
    update: (id: string, update?: (value: unknown) => void) => {
      calls.agentUpdates.push(id)
      update?.({ permissions: [] })
    },
  }
}

function makeIntegrationEditor(calls: Calls): unknown {
  return {
    list: () => [],
    get: () => undefined,
    update: (id: string) => { calls.integrationUpdates.push(id) },
    remove: () => {},
    method: {
      list: () => [],
      update: (input: { integrationID: string; method: Record<string, unknown> }) => {
        calls.integrationUpdates.push(input.integrationID)
        if (input.method.type === "key") calls.keyMethods.push(input.method)
        if (input.method.type === "env") calls.envMethods.push(input.method.names as ReadonlyArray<string>)
      },
      remove: () => {},
    },
  }
}

function newCalls(): Calls {
  return {
    providerAdds: 0,
    modelAdds: 0,
    providerInfos: [],
    providerModels: [],
    toolAdds: [],
    toolUpdates: [],
    commands: [],
    hooks: [],
    agentUpdates: [],
    integrationUpdates: [],
    keyMethods: [],
    envMethods: [],
  }
}

const calls: Calls = newCalls()

async function runSetup() {
  const fresh = newCalls()
  const cleanup = await plugin.setup(makeFakeContext(fresh) as never)
  return { fresh, cleanup }
}

describe("plugin setup", () => {
  test("registers every domain without throwing", async () => {
    const cleanup = await plugin.setup(makeFakeContext(calls) as never)
    expect(typeof cleanup === "function" || cleanup === undefined).toBe(true)
    if (typeof cleanup === "function") await cleanup()
  })

  test("registers the hawiyat provider and stream-normalizing session hook", () => {
    expect(calls.providerAdds).toBe(1)
    expect(calls.hooks).toContain("session:http.response")
  })

  test("registers the /connect integration with key + env methods", () => {
    expect(calls.integrationUpdates).toContain("hawiyat")
    expect(calls.keyMethods).toHaveLength(1)
    // A `key` method carries OpenCode's built-in API-key prompt; no custom form
    // may be declared (a hidden+required field with no default fails validation).
    const key = calls.keyMethods[0] as { type: string; label: string; form?: unknown }
    expect(key.type).toBe("key")
    expect(key.label).toBe("Hawiyat API key")
    expect(key.form).toBeUndefined()
    expect(calls.envMethods.flat()).toContain("HAWIYAT_API_KEY")
  })

  test("links the provider to the integration and does not bake in the key", () => {
    const info = calls.providerInfos[0] as { integrationID?: string; settings?: Record<string, unknown> }
    expect(info.integrationID).toBe("hawiyat")
    expect(info.settings?.baseURL).toBe("https://ai.hawiyat.cloud/v1")
    expect(info.settings?.apiKey).toBeUndefined()
  })

  test("registers the provider with zero models on a key-less cold start (no bundle)", () => {
    // No cache and no credentials in the sandbox -> empty state. The provider
    // is still registered (with its /connect integration link) and populates
    // on the first successful /v1/models fetch.
    expect(calls.providerAdds).toBe(1)
    expect(calls.modelAdds).toBe(0)
    expect(calls.providerModels).toEqual([])
  })

  test("hydrates the provider from the on-disk cache and renders cost honestly", async () => {
    const zeroCost: CatalogModel = {
      id: "test-unknown-cost",
      name: "test-unknown-cost",
      reasoning: false,
      input: ["text"],
      contextWindow: 128_000,
      maxTokens: 16_384,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }
    const priced: CatalogModel = {
      id: "test-priced",
      name: "test-priced",
      reasoning: false,
      input: ["text"],
      contextWindow: 128_000,
      maxTokens: 16_384,
      cost: { input: 5, output: 15, cacheRead: 0, cacheWrite: 0 },
    }
    writeCache([zeroCost, priced])
    try {
      const { fresh, cleanup } = await runSetup()
      try {
        expect(fresh.modelAdds).toBe(2)
        const byId = new Map(fresh.providerModels.map((m) => [m.id, m]))
        // Gateway reports null prices as 0; OpenCode would render a zeroed
        // tier as "$0", so no tier at all ("no pricing") is emitted instead.
        expect((byId.get("test-unknown-cost") as { cost?: unknown[] }).cost).toEqual([])
        const known = byId.get("test-priced") as { cost?: Array<{ input: number }> }
        expect(known?.cost).toHaveLength(1)
        expect(known?.cost?.[0]?.input).toBeGreaterThan(0)
      } finally {
        if (typeof cleanup === "function") await cleanup()
      }
    } finally {
      // Keep scenarios independent: no later setup call may observe this fixture.
      rmSync(join(process.env.XDG_CACHE_HOME!, "opencode", "hawiyat-models.json"), { force: true })
    }
  })

  test("drops internal ids inherited from a stale cache", async () => {
    const internal: CatalogModel = {
      id: "claude-h-d41-flash",
      name: "claude-h-d41-flash",
      reasoning: false,
      input: ["text"],
      contextWindow: 128_000,
      maxTokens: 16_384,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }
    const clean: CatalogModel = {
      id: "test-clean",
      name: "test-clean",
      reasoning: false,
      input: ["text"],
      contextWindow: 128_000,
      maxTokens: 16_384,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }
    writeCache([internal, clean])
    try {
      const { fresh, cleanup } = await runSetup()
      try {
        const ids = fresh.providerModels.map((m) => m.id)
        expect(ids).toEqual(["test-clean"])
      } finally {
        if (typeof cleanup === "function") await cleanup()
      }
    } finally {
      rmSync(join(process.env.XDG_CACHE_HOME!, "opencode", "hawiyat-models.json"), { force: true })
    }
  })

  test("ignores caches written by older versions", async () => {
    const clean: CatalogModel = {
      id: "test-clean",
      name: "test-clean",
      reasoning: false,
      input: ["text"],
      contextWindow: 128_000,
      maxTokens: 16_384,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }
    writeFileSync(cacheFilePath(), `${JSON.stringify({ version: 1, checkedAt: Date.now(), models: [clean] })}\n`)
    try {
      const { fresh, cleanup } = await runSetup()
      try {
        expect(fresh.providerModels).toEqual([])
      } finally {
        if (typeof cleanup === "function") await cleanup()
      }
    } finally {
      rmSync(join(process.env.XDG_CACHE_HOME!, "opencode", "hawiyat-models.json"), { force: true })
    }
  })

  test("rejects known-internal model ids", () => {
    // Hard-coded fixture, deliberately independent of isCustomerFacingModelId:
    // it must fail when the filter is too weak, not just when it changes.
    const KNOWN_INTERNAL_IDS = [
      // bare h- leaf namespace
      "h-d4-fast",
      "h-mm3",
      "h-nw-k26-fast",
      "h-ri-d4-p",
      "h-tr-d4-v",
      // -h- leaf infix
      "claude-h-astra",
      "claude-h-d41-flash",
      "claude-h-g53-flash",
      "claude-h-o55",
      "claude-h-o55f",
      "claude-h-o55tr",
      "claude-h-sol6-f",
      // provider tag
      "claude-opus-5.5-af",
      // routers / components
      "Analyzer",
      "hawiyat_auto_router",
      "claude-opus-router",
      // upstream-named / lab ids
      "h-d4-fast-apifun",
      "h-d4-pro-apifun",
      "tmp-oc-router",
      "tmp-glm53-leaf",
      "hawiyat-composer-demo",
    ]
    for (const id of KNOWN_INTERNAL_IDS) expect(isCustomerFacingModelId(id)).toBe(false)
  })

  test("drops internal ids on the live fetch path", async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: unknown) => {
      const target = String(url)
      if (target === `${ORIGIN}/model_group/info`) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (target === `${BASE_URL}/models`) {
        return new Response(
          JSON.stringify({
            data: [{ id: "claude-fable-5.1" }, { id: "hawiyat_auto_router" }, { id: "h-d4-fast" }],
          }),
          { status: 200 },
        )
      }
      throw new Error(`unexpected fetch: ${target}`)
    }) as typeof fetch
    try {
      const models = await fetchModels("test-key", AbortSignal.timeout(5_000))
      expect(models.map((m) => m.id)).toEqual(["claude-fable-5.1"])
    } finally {
      globalThis.fetch = realFetch
    }
  })

  test("registers the stats command and usage_stats tool", () => {
    expect(calls.commands).toContain("stats")
    expect(calls.toolAdds).toContain("usage_stats")
  })

  test("overrides the built-in webfetch tool", () => {
    expect(calls.toolUpdates).toContain("webfetch")
  })

  test("updates the bundled subagents and installs their files", () => {
    expect(calls.agentUpdates).toEqual(expect.arrayContaining(["scout", "researcher", "worker"]))
    expect(existsSync(join(agentsDir, "scout.md"))).toBe(true)
    expect(existsSync(join(agentsDir, "worker.md"))).toBe(true)
  })
})

describe("hawiyat stream normalization", () => {
  test("recognizes OpenAI chunks", () => {
    expect(isOpenAIChunk('{"choices":[]}')).toBe(true)
    expect(isOpenAIChunk("plain token")).toBe(false)
  })

  test("re-encodes raw tokens as chat.completion.chunk deltas", async () => {
    const source = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(
            encoder.encode(
              'data: {"id":"x","object":"chat.completion.chunk","choices":[{"delta":{"reasoning_content":"The"}}]}\n\n' +
                "data: 1\n\ndata:  \n\ndata: 2\n\n" +
                'data: {"id":"x","object":"chat.completion.chunk","choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
                "data: [DONE]\n\n",
            ),
          )
          controller.close()
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    )

    const fetchImpl = normalizeStreamingFetch(async () => source)
    const response = await fetchImpl("https://example.test/v1/chat/completions")
    const text = await response.text()

    expect(text).toContain('"object":"chat.completion.chunk"')
    expect(text).toContain('"content":"1"')
    expect(text).toContain('"content":" "')
    expect(text).toContain('"content":"2"')
    expect(text).toContain('"reasoning_content":"The"')
    expect(text).toContain("data: [DONE]")
  })
})

afterAll(() => {
  if (savedKey !== undefined) process.env.HAWIYAT_API_KEY = savedKey
  rmSync(sandbox, { recursive: true, force: true })
})
