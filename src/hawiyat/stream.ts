/**
 * Hawiyat streaming normalization.
 *
 * The gateway emits reasoning as JSON chunks but plain content as raw
 * `data: <token>` records, where a token may contain literal newlines. The
 * OpenAI-compatible runtime only accepts OpenAI JSON chunks, so this module
 * re-encodes raw tokens into `chat.completion.chunk` deltas.
 *
 * Records are separated by the literal `\n\ndata:` boundary, and the final
 * record is terminated by `\n\n`.
 *
 * Ported from Hawiyat-Org/pi-extension (MIT), `hawiyat-provider/index.ts`.
 */

export type FetchLike = typeof globalThis.fetch

export function isOpenAIChunk(payload: string): boolean {
  if (!payload.startsWith("{")) return false
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>
    return Array.isArray(parsed.choices) || parsed.error !== undefined
  } catch {
    return false
  }
}

/** Rewrite a streaming Response body so raw `data: <token>` SSE becomes OpenAI chunks. */
export function normalizeSSEResponse(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? ""
  if (!response.body || !contentType.includes("text/event-stream")) return response

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const created = Math.floor(Date.now() / 1000)
  let buffer = ""
  let seq = 0

  const drain = (controller: TransformStreamDefaultController<Uint8Array>, final: boolean): void => {
    while (true) {
      const start = buffer.indexOf("data:")
      if (start === -1) {
        if (final) buffer = ""
        return
      }
      if (start > 0) buffer = buffer.slice(start)

      const offset = buffer.startsWith("data: ") ? 6 : 5
      const end = buffer.indexOf("\n\ndata:", offset)
      const payload =
        end === -1 ? (final ? buffer.slice(offset).replace(/\n\n$/, "") : undefined) : buffer.slice(offset, end)
      if (payload === undefined) return
      buffer = end === -1 ? "" : buffer.slice(end + 2)
      if (payload.length === 0) continue

      if (payload !== "[DONE]" && !isOpenAIChunk(payload)) {
        seq += 1
        const chunk = JSON.stringify({
          id: `hawiyat-${seq}`,
          object: "chat.completion.chunk",
          created,
          choices: [{ index: 0, delta: { content: payload } }],
        })
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
      } else {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
      }
    }
  }

  const transformed = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n")
      drain(controller, false)
    },
    flush(controller) {
      buffer += decoder.decode()
      drain(controller, true)
    },
  })

  const headers = new Headers(response.headers)
  headers.delete("content-encoding")
  headers.delete("content-length")
  headers.delete("transfer-encoding")
  return new Response(response.body.pipeThrough(transformed), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/** Wrap a fetch implementation so raw `data: <token>` SSE becomes OpenAI chunks. */
export function normalizeStreamingFetch(inner: FetchLike | undefined): FetchLike {
  const base = inner ?? globalThis.fetch
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return normalizeSSEResponse(await base(input, init))
  }
}
