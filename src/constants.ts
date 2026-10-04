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

/** Label shown by the OpenCode `/connect` key prompt. */
export const API_KEY_LABEL = "Hawiyat API key"

/**
 * The single integration this plugin registers and links the provider to.
 * It is the id shown in `/connect` and accepted by `opencode auth login`.
 */
export const INTEGRATION_ID = "hawiyat"

/**
 * Legacy auth-store id that may still hold a previously stored gateway key.
 * `hawiyat-ai` is the id used by the earlier V1/pi setup. It is retained
 * read-only so an existing install keeps resolving its key without
 * re-authenticating; this plugin never writes it.
 */
export const LEGACY_AUTH_INTEGRATION_IDS = ["hawiyat-ai"] as const

/** Auth-store ids probed for a stored key, current id first. */
export const AUTH_STORE_INTEGRATION_IDS = [INTEGRATION_ID, ...LEGACY_AUTH_INTEGRATION_IDS] as const

/** Fallback model limits when the gateway does not report them. */
export const DEFAULT_CONTEXT_WINDOW = 128_000
export const DEFAULT_MAX_TOKENS = 16_384
