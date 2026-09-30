/**
 * @hawiyat/opencode-extension
 *
 * One OpenCode v2 plugin bundling four Hawiyat capabilities ported from
 * Hawiyat-Org/pi-extension:
 *
 *   1. hawiyat provider  — key-scoped LiteLLM catalog + non-standard SSE fix
 *   2. usage stats       — `/stats` command + `usage_stats` tool
 *   3. bundled subagents — scout / researcher / worker
 *   4. web fetch         — Readability + Turndown + unpdf + Jina fallback
 *
 * Each domain lives in its own module; this file only wires them together and
 * returns a single cleanup function.
 */

import { Plugin } from "@opencode/plugin"
import type { Context } from "@opencode/plugin/promise/plugin"
import { setupHawiyat, type Cleanup } from "./hawiyat"
import { setupStats } from "./stats"
import { setupAgents } from "./agents"
import { setupWebfetch } from "./webfetch"

const PLUGIN_ID = "hawiyat.opencode-extension"

export default Plugin.define({
  id: PLUGIN_ID,
  async setup(ctx: Context) {
    const cleanups: Cleanup[] = []

    const domains: Array<[string, () => Promise<unknown>]> = [
      ["hawiyat", () => setupHawiyat(ctx, cleanups)],
      ["stats", () => setupStats(ctx)],
      ["agents", () => setupAgents(ctx)],
      ["webfetch", () => setupWebfetch(ctx)],
    ]

    for (const [name, register] of domains) {
      try {
        await register()
      } catch (error) {
        // A single failing domain must not take down the rest of the bundle.
        console.error(`[${PLUGIN_ID}] failed to set up ${name}:`, error)
      }
    }

    return async () => {
      for (const cleanup of [...cleanups].reverse()) {
        try {
          await cleanup()
        } catch {
          // Cleanup is best-effort.
        }
      }
    }
  },
})
