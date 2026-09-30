/**
 * web fetch tool.
 *
 * OpenCode ships a built-in `webfetch` tool, so this domain overrides it in
 * place with the pi web-fetch logic via `ctx.tool.transform`: Readability +
 * Turndown for HTML, unpdf for PDFs, and a Jina Reader fallback for
 * JavaScript-rendered pages.
 *
 * Ported from Hawiyat-Org/pi-extension (MIT), `web-fetch/index.ts`.
 */

import type { Context } from "@opencode/plugin/promise/plugin"
import { fetchAndExtract, fetchRaw } from "./extract"

const DESCRIPTION =
  "Fetch a web page and extract readable content as clean markdown. Uses Readability + Turndown for HTML→markdown, " +
  "extracts PDFs, and falls back to Jina Reader for JS-rendered pages. Set format to 'text' or 'html' for the raw body."

const INPUT = {
  type: "object",
  properties: {
    url: { type: "string", description: "URL to fetch" },
    format: { type: "string", description: "'markdown' (default), 'text', or 'html'" },
  },
  required: ["url"],
  additionalProperties: false,
}

export async function setupWebfetch(ctx: Context): Promise<void> {
  await ctx.tool.transform((editor) => {
    const execute = async (
      input: unknown,
      context: { signal: AbortSignal },
    ): Promise<{ content: string; metadata: Record<string, unknown> }> => {
      const params = (input ?? {}) as { url?: string; format?: string }
      const url = params.url
      if (!url) throw new Error("webfetch: url is required")
      const format = (params.format ?? "markdown").toLowerCase()
      const result =
        format === "markdown"
          ? await fetchAndExtract(url, context.signal)
          : await fetchRaw(url, format === "html" ? "html" : "text", context.signal)
      if (result.error) throw new Error(`webfetch ${url}: ${result.error}`)
      const header = result.title ? `# ${result.title}\n\nSource: ${result.url}\n\n---\n\n` : ""
      return {
        content: header + result.content,
        metadata: { url: result.url, title: result.title, chars: result.content.length },
      }
    }

    const definition = {
      name: "webfetch",
      description: DESCRIPTION,
      input: INPUT,
      // The built-in tool declares an output schema; clearing it lets our
      // executor return plain content instead of a typed output value.
      output: undefined,
      execute,
    }

    if (editor.get("webfetch")) {
      editor.update("webfetch", (tool) => {
        Object.assign(tool as object, definition as object)
        ;(tool as { output?: unknown }).output = undefined
      })
    } else {
      editor.add(definition as never)
    }
  })
}
