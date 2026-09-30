import { afterAll, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Keep the plugin away from the real caches/config while testing.
const sandbox = mkdtempSync(join(tmpdir(), "hawiyat-ext-"))
process.env.XDG_CACHE_HOME = join(sandbox, "cache")

const agentsDir = join(sandbox, "agents")

import plugin from "../src/index"
import { normalizeStreamingFetch, isOpenAIChunk } from "../src/hawiyat/stream"

interface Calls {
  providerAdds: number
  modelAdds: number
  toolAdds: string[]
  toolUpdates: string[]
  commands: string[]
  hooks: string[]
  agentUpdates: string[]
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
    add: (input: { models?: unknown[] }) => {
      calls.providerAdds += 1
      calls.modelAdds += input.models?.length ?? 0
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

const calls: Calls = {
  providerAdds: 0,
  modelAdds: 0,
  toolAdds: [],
  toolUpdates: [],
  commands: [],
  hooks: [],
  agentUpdates: [],
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
  rmSync(sandbox, { recursive: true, force: true })
})
