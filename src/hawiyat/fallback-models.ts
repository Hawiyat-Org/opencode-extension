/**
 * Bundled fallback model catalog.
 *
 * Seeded from a live capture of the Hawiyat gateway (LiteLLM) taken with a real
 * key during development. The gateway exposes a *per-key* model list, so this is
 * only a cold-start fallback shown before the first successful `/v1/models`
 * refresh (which replaces it). Entries are intentionally not filtered by
 * capability; unknown/unsupported ids simply fail upstream.
 */
import type { CatalogModel } from "./catalog"

export const FALLBACK_MODELS: CatalogModel[] = [
  {
    "id": "Analyzer",
    "name": "Analyzer",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-4-7-opus-20251022",
    "name": "claude-4-7-opus-20251022",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-fable-5.1",
    "name": "claude-fable-5.1",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxTokens": 131072,
    "cost": {
      "input": 0.8077,
      "output": 4.8465,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-fable-hawiyat-cowork",
    "name": "claude-fable-hawiyat-cowork",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-h-astra",
    "name": "claude-h-astra",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxTokens": 128000,
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-h-d41-flash",
    "name": "claude-h-d41-flash",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxTokens": 393216,
    "cost": {
      "input": 0.11,
      "output": 0.33,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-h-g53-flash",
    "name": "claude-h-g53-flash",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxTokens": 128000,
    "cost": {
      "input": 0.015,
      "output": 0.05,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-h-o55",
    "name": "claude-h-o55",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxTokens": 32000,
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-h-o55f",
    "name": "claude-h-o55f",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxTokens": 32000,
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-h-o55tr",
    "name": "claude-h-o55tr",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxTokens": 32000,
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-h-sol6-f",
    "name": "claude-h-sol6-f",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxTokens": 32000,
    "cost": {
      "input": 2,
      "output": 10,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-opus-5",
    "name": "claude-opus-5",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1050000,
    "maxTokens": 128000,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-opus-5.5-af",
    "name": "claude-opus-5.5-af",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxTokens": 32000,
    "cost": {
      "input": 4,
      "output": 20,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-opus-hawiyat-composer",
    "name": "claude-opus-hawiyat-composer",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1050000,
    "maxTokens": 128000,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-opus-hawiyat-cowork",
    "name": "claude-opus-hawiyat-cowork",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-opus-hawiyat-theo",
    "name": "claude-opus-hawiyat-theo",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 991800,
    "maxTokens": 65536,
    "cost": {
      "input": 0.4,
      "output": 1.6,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-opus-router",
    "name": "claude-opus-router",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.1,
      "output": 0.1,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-sonnet-5",
    "name": "claude-sonnet-5",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxTokens": 128000,
    "cost": {
      "input": 0.4685,
      "output": 0.937,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-sonnet-hawiyat-cowork",
    "name": "claude-sonnet-hawiyat-cowork",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.1508,
      "output": 0.3016,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "claude-sonnet-hawiyat-cowork-codex",
    "name": "claude-sonnet-hawiyat-cowork-codex",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1050000,
    "maxTokens": 128000,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "gemini-2.5-flash",
    "name": "gemini-2.5-flash",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxTokens": 65535,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "gpt-4.1-mini",
    "name": "gpt-4.1-mini",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1047576,
    "maxTokens": 32768,
    "cost": {
      "input": 0.4,
      "output": 1.6,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "gpt-4o-mini",
    "name": "gpt-4o-mini",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "gpt-5.5",
    "name": "gpt-5.5",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1050000,
    "maxTokens": 128000,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "gpt-5.6-luna",
    "name": "gpt-5.6-luna",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 512000,
    "maxTokens": 106384,
    "cost": {
      "input": 0.2,
      "output": 1.2,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "gpt-5.6-terra",
    "name": "gpt-5.6-terra",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxTokens": 128000,
    "cost": {
      "input": 2,
      "output": 12,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "gpt-6-astra",
    "name": "gpt-6-astra",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 922000,
    "maxTokens": 128000,
    "cost": {
      "input": 10,
      "output": 50,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "gpt-audio-mini",
    "name": "gpt-audio-mini",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.6,
      "output": 2.4,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-d4-fast",
    "name": "h-d4-fast",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxTokens": 393216,
    "cost": {
      "input": 0.3,
      "output": 1.2,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-d4-fast-apifun",
    "name": "h-d4-fast-apifun",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.33,
      "output": 0.99,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-d4-nube",
    "name": "h-d4-nube",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxTokens": 393216,
    "cost": {
      "input": 0.33,
      "output": 0.99,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-d4-pro",
    "name": "h-d4-pro",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1000000,
    "maxTokens": 393216,
    "cost": {
      "input": 1.32,
      "output": 3.96,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-d4-pro-apifun",
    "name": "h-d4-pro-apifun",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.99,
      "output": 2.97,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-deepseek-v4-flash",
    "name": "h-deepseek-v4-flash",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.132,
      "output": 0.396,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-g52",
    "name": "h-g52",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 1.4,
      "output": 4.4,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-gemini-38-flash",
    "name": "h-gemini-38-flash",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxTokens": 16384,
    "cost": {
      "input": 0.75,
      "output": 3.75,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-mi-v2.5",
    "name": "h-mi-v2.5",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.14,
      "output": 0.28,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-mm3",
    "name": "h-mm3",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-nw-g52-s",
    "name": "h-nw-g52-s",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 1,
      "output": 3,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-nw-k26",
    "name": "h-nw-k26",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.69,
      "output": 3.22,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-nw-k26-fast",
    "name": "h-nw-k26-fast",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.69,
      "output": 3.22,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-ri-d4-f",
    "name": "h-ri-d4-f",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.14,
      "output": 0.28,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-ri-d4-p",
    "name": "h-ri-d4-p",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.0435,
      "output": 0.087,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-ri-g46",
    "name": "h-ri-g46",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.1,
      "output": 0.3,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-ri-luna",
    "name": "h-ri-luna",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 922000,
    "maxTokens": 128000,
    "cost": {
      "input": 0.2,
      "output": 1.2,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-tr-d4-f",
    "name": "h-tr-d4-f",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.14,
      "output": 0.41,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-tr-d4-v",
    "name": "h-tr-d4-v",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.11,
      "output": 0.33,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "h-tr-g46",
    "name": "h-tr-g46",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.2,
      "output": 0.6,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-alpha",
    "name": "hawiyat-alpha",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-astra",
    "name": "hawiyat-astra",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1050000,
    "maxTokens": 128000,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-astra-flash",
    "name": "hawiyat-astra-flash",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1050000,
    "maxTokens": 128000,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-atlas",
    "name": "hawiyat-atlas",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-chatbot",
    "name": "hawiyat-chatbot",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1048576,
    "maxTokens": 65535,
    "cost": {
      "input": 0.1,
      "output": 0.4,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-code-ds",
    "name": "hawiyat-code-ds",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.14,
      "output": 0.28,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-composer",
    "name": "hawiyat-composer",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1050000,
    "maxTokens": 128000,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-composer-codex",
    "name": "hawiyat-composer-codex",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1050000,
    "maxTokens": 128000,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-composer-new",
    "name": "hawiyat-composer-new",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0.1508,
      "output": 0.3016,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-composer-nextgen",
    "name": "hawiyat-composer-nextgen",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-composer-pro",
    "name": "hawiyat-composer-pro",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-cozy",
    "name": "hawiyat-cozy",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-deepseek-4.1-flash",
    "name": "hawiyat-deepseek-4.1-flash",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxTokens": 384000,
    "cost": {
      "input": 0.15,
      "output": 0.6,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-glm5.3-flash",
    "name": "hawiyat-glm5.3-flash",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxTokens": 131072,
    "cost": {
      "input": 0.075,
      "output": 0.25,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-pablo",
    "name": "hawiyat-pablo",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-tornado",
    "name": "hawiyat-tornado",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxTokens": 32000,
    "cost": {
      "input": 3,
      "output": 12,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-zero",
    "name": "hawiyat-zero",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxTokens": 128000,
    "cost": {
      "input": 0.4685,
      "output": 0.937,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat-zero-flash",
    "name": "hawiyat-zero-flash",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxTokens": 128000,
    "cost": {
      "input": 0.1508,
      "output": 0.3016,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "hawiyat_auto_router",
    "name": "hawiyat_auto_router",
    "reasoning": false,
    "input": [
      "text"
    ],
    "contextWindow": 128000,
    "maxTokens": 16384,
    "cost": {
      "input": 0,
      "output": 0,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "openai/gpt-4.1-nano",
    "name": "openai/gpt-4.1-nano",
    "reasoning": false,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1047576,
    "maxTokens": 32768,
    "cost": {
      "input": 0.1,
      "output": 0.4,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  },
  {
    "id": "openai/gpt-5.4-nano",
    "name": "openai/gpt-5.4-nano",
    "reasoning": true,
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 272000,
    "maxTokens": 128000,
    "cost": {
      "input": 0.2,
      "output": 1.25,
      "cacheRead": 0,
      "cacheWrite": 0
    }
  }
]
