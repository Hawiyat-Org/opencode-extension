/** Shared constants for the Hawiyat OpenCode extension. */

/** OpenCode provider id. Model references are `hawiyat/<modelID>`. */
export const PROVIDER_ID = "hawiyat"

/** Human-readable provider name shown in `/models`. */
export const PROVIDER_NAME = "Hawiyat"

/** LiteLLM gateway origin. */
export const ORIGIN = "https://ai.hawiyat.cloud"

/** OpenAI-compatible base URL. */
export const BASE_URL = `${ORIGIN}/v1`

/**
 * OpenCode's built-in OpenAI-compatible runtime package. Native beats
 * re-importing `@ai-sdk/openai-compatible` ourselves.
 */
export const PROVIDER_PACKAGE = "@opencode/ai/providers/openai-compatible"

/** Environment variable consulted for the gateway API key. */
export const API_KEY_ENV = "HAWIYAT_API_KEY"

/** Integration / auth-store ids that may hold the gateway key. */
export const INTEGRATION_IDS = ["hawiyat", "hawiyat-ai"] as const

/** Fallback model limits when the gateway does not report them. */
export const DEFAULT_CONTEXT_WINDOW = 128_000
export const DEFAULT_MAX_TOKENS = 16_384
