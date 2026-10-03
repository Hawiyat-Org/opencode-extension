# NOTES — porting pi-extension to OpenCode v2

This file records the Phase 0 research, the capability → mechanism mapping with
exact APIs, the places where the v2 plugin API could not express something, and
the verification evidence captured while loading the package into a real
OpenCode.

## Environment studied

| Thing | Version / path |
|-------|----------------|
| OpenCode | `2.0.16` (`opencode --version`), binary at `~/.opencode/bin/opencode` |
| Plugin API (runtime) | `@opencode/plugin@2.0.14`, `~/.config/opencode/node_modules/@opencode/plugin/dist/promise/*.d.ts` |
| Plugin API (repo dev dep) | `@opencode/plugin@2.0.20` |
| Classic API | `@opencode-ai/plugin@1.18.23` — **not supported by 2.0.16** (see deviation 4) |
| Schema | `@opencode/schema@2.0.14` (`~/.config/opencode/node_modules/@opencode/schema/dist/*.d.ts`) |
| Reference v2 plugin | `~/.config/opencode/plugins/rtk.ts` (`Plugin.define` + `ctx.tool.hook`) |
| Session store | SQLite at `~/.local/share/opencode/opencode.db` |
| pi reference package | installed pieces under `~/.pi/agent/extensions/{hawiyat-provider,pi-stats,web-fetch,pi-interactive-subagents}` |

Docs consulted (source of truth for v2):

- <https://opencode.ai/v2/docs/build/plugins/>
- <https://opencode.ai/v2/docs/build/plugins/migrate-v1/>
- <https://opencode.ai/v2/docs/plugins/>
- <https://opencode.ai/v2/docs/providers/>
- <https://opencode.ai/v2/docs/agents/>
- <https://opencode.ai/v2/docs/tools/>
- <https://opencode.ai/v2/llms.txt>

Key type paths:

- `@opencode/plugin/promise/plugin` → `Plugin.define({ id, setup })`, `Context`
- `@opencode/plugin/promise/provider` → `ProviderEditor`, `ProviderDomain`
- `@opencode/plugin/promise/model` → `ModelEditor`, `ModelDomain`
- `@opencode/plugin/promise/agent` → `AgentEditor`, `AgentDomain`
- `@opencode/plugin/promise/command` → `CommandEditor`, `CommandDomain`
- `@opencode/plugin/promise/tool` → `ToolEditor`, `ToolDomain`, `ToolHooks`
- `@opencode/plugin/promise/session` → `SessionHooks` (`http.response`, …)
- `@opencode/plugin/promise/aisdk` → `AISDKHooks` (`sdk`, `language`)
- `@opencode/plugin/promise/integration` → `IntegrationEditor`, `connection.resolve`
- `@opencode/plugin/promise/storage` → `StorageDomain.scan`
- `@opencode/schema/{provider,model,agent,tool,token-usage,credential,connection}`

## Capability → mechanism → exact API

| Capability | Mechanism | Exact API | Type path |
|------------|-----------|-----------|-----------|
| hawiyat provider | provider transform | `ctx.provider.transform(e => e.add({ info, models }))` with `Provider.Info.empty(id)`, `package`, `settings` | `@opencode/plugin/promise/provider`, `@opencode/schema/provider` |
| provider models | build with defaults | `Model.Info.default(providerID, id)` then set `name`, `cost[]`, `limit`, `capabilities`, `compatibility` | `@opencode/schema/model` |
| model catalog | network + cache | `GET /v1/models`, `GET /model_group/info`, `$XDG_CACHE_HOME/opencode/hawiyat-models.json`, `ctx.provider.reload()` | – |
| gateway key | provider settings | `settings.apiKey` resolved from options → `HAWIYAT_API_KEY` → `ctx.integration.connection.resolve` → `auth.json` | `@opencode/plugin/promise/integration` |
| gateway SSE | session response hook | `ctx.session.hook("http.response", event => { event.response = normalizeSSEResponse(event.response) }, { providerID: "hawiyat" })` | `@opencode/plugin/promise/session`, `@opencode/schema/session` |
| `/stats` | command transform | `ctx.command.transform(e => e.add({ name: "stats", execute }))`; output via `ctx.session.synthetic({ sessionID, text })` | `@opencode/plugin/promise/command` |
| `usage_stats` | tool transform | `ctx.tool.transform(e => e.add({ name, description, input, execute }))` | `@opencode/plugin/promise/tool`, `@opencode/schema/tool` |
| stats data | host SQLite (read-only) | `bun:sqlite` `Database(path, { readonly: true })` over `session`, `message`, `part` | – |
| subagents | agent Markdown + transform | write `<config>/opencode/agents/{scout,researcher,worker}.md`; `ctx.agent.transform(e => e.update(id, a => …))` | `@opencode/plugin/promise/agent`, `@opencode/schema/agent` |
| webfetch | tool transform (override) | `ctx.tool.transform(e => e.update("webfetch", t => { t.input = …; t.execute = …; t.output = undefined }))` | `@opencode/plugin/promise/tool` |
| cleanup | `setup()` return | return an async function clearing the refresh timer | `@opencode/plugin/promise/plugin` |

## Deviations (and why)

### 1. SSE normalization uses the session HTTP hook, not an AISDK hook

The task suggested `ctx.aisdk.hook("language", …, { providerID })`. Empirically,
**neither `sdk` nor `language` AISDK hooks fire** in `2.0.16` for providers using
the native `@opencode/ai/providers/openai-compatible` package (they did not fire
for the built-in `opencode-go` provider either). Since the native runtime parses
SSE inside its own driver before a `LanguageModelV3` exists, the correct native
hook is `ctx.session.hook("http.response", …)`, which is documented for exactly
this ("Modify native provider requests or responses"). It fires once per model
request and lets the plugin replace the response body. This was verified
end-to-end (see below).

`normalizeStreamingFetch` still exists and is unit-tested; it is the fetch-level
form of the same transform, kept for reuse and for runtimes that expose `fetch`.

### 2. Agents cannot be created through `ctx.agent.transform`

`AgentEditor` exposes `list/get/update/remove/default` but **no `add`** (checked
against the installed `.d.ts` and at runtime via `Object.getOwnPropertyNames`).
`ctx.agent.transform` can only update agents that already exist. Therefore the
bundled agents are installed as managed Markdown files in the global agents
directory (`~/.config/opencode/agents/`), which OpenCode discovers and watches
natively. `ctx.agent.transform` is still used to enforce `mode: subagent` and
least-privilege permissions on registrations. A same-named file without the
`<!-- managed by @hawiyat/opencode-extension -->` marker is left untouched, so a
user override always wins.

### 3. Stats reads the host session store

The v2 plugin `SessionDomain` is
`Pick<SessionApi, "create" | "get" | "switchAgent" | "switchModel" | "prompt" |
"generate" | "command" | "synthetic" | "interrupt" | "update" | "move" | "wait" |
"context">` — it exposes **no `list` and no `stats`**, and the plugin-scoped
`ctx.storage` is key/value, not session data (`ctx.storage.scan({ prefix:
"session" })` returns zero entries). OpenCode does track these numbers natively
(the server `session.stats` operation and `opencode stats`), but there is no
plugin-facing enumeration of sessions. The plugin therefore reads the host's own
SQLite session store read-only and aggregates `session`/`message`/`part`. This
is the one capability that cannot use a first-class plugin API; it is documented
as such in the README.

### 4. V1 plugin entrypoints are rejected

`2.0.16` requires a default export object with an `id` and a `setup` (or effect)
function. A classic `@opencode-ai/plugin` function export fails to load with:

```
PluginModule.LoadError: Plugin must export a default definition with an id and
an effect or setup function. (cause: SchemaError(Expected object at ["default"]))
```

### 5. Configuration spelling is V2

V2 uses `plugins` (plural) and `providers` (plural). The machine's
`~/.config/opencode/opencode.json` is V1-shaped (`provider` singular,
`options.baseURL`); it is left untouched. The plugin registers its provider with
`ctx.provider.transform`, so no config edit is required.

### 6. `/model_group/info` may be forbidden

With the working key the gateway returns `403` for `/model_group/info`, so model
enrichment (mode/vision/reasoning/cost) is skipped and defaults apply, exactly
as the pi implementation already tolerates.

## Verification (exact commands, observed results)

### Static

```bash
$ bun install          # 291 packages
$ bun run typecheck    # tsc --noEmit, clean
$ bun test             # 7 pass, 0 fail
```

### Loaded into a real OpenCode 2.0.16

```bash
$ ln -sfn ~/workspace/opencode-extension ~/.config/opencode/plugins/opencode-extension
$ opencode plugin list
ID                          VERSION  SOURCE
hawiyat.opencode-extension  local    /home/morta/workspace/opencode-extension/index.ts
rtk                         local    /home/morta/.config/opencode/plugins/rtk.ts

$ opencode debug agents     # (filtered)
[('researcher','subagent'), ('scout','subagent'), ('worker','subagent')]

$ opencode models | grep hawiyat
hawiyat/claude-opus-5
hawiyat/claude-opus-hawiyat-composer
hawiyat/claude-opus-hawiyat-cowork
hawiyat/claude-sonnet-hawiyat-cowork-codex
hawiyat/hawiyat-composer
hawiyat/hawiyat-composer-codex
hawiyat/hawiyat-tornado
```

The Code Mode tool catalog in the running server also lists `usage_stats`.

### hawiyat provider + streaming, end to end

```bash
$ HAWIYAT_API_KEY=… opencode run --standalone --model hawiyat/hawiyat-composer "Reply with exactly: HAWIYAT_OK"
HAWIYAT_FINAL_OK
```

The gateway really does mix formats. Captured from `POST /v1/chat/completions`
(`hawiyat-composer`, `stream: true`):

```
data: {"…","delta":{"reasoning_content":"The"}}      <- JSON chunk (reasoning)
data: 1                                                <- raw token (content)
data:  
data: 2
…
data: {"…","choices":[{"delta":{},"finish_reason":"stop"}]}
data: [DONE]
```

`normalizeSSEResponse` reconstructs `"1 2 3 4 5"` from that capture, and the real
OpenCode run succeeded because `http.response` replaced the body before the
driver parsed it.

### usage_stats tool

Invoked from the running server's Code Mode catalog:

```
tools.usage_stats({ range: "all", format: "json" })
→ totals: sessions 323, subagents 259, messages 21790,
          tokens 3,831,144,097, cost $44.7056, activeDays 44,
          models top: opencode-go/deepseek-v4-flash ($26.36),
          projects top: ~/workspace/hawiyat-ai-gateway ($19.01),
          tools top: bash (13666)
```

`/stats all` and `/stats 30d` also returned the same real numbers.

### webfetch

- Override is registered (`ctx.tool.transform` update of the built-in).
- Real session: `opencode run --standalone … "Use the webfetch tool on
  https://opencode.ai/v2/docs/"` returned `# Intro | OpenCode`.
- Direct extraction: Wikipedia `OpenAI` page → title `OpenAI`, 250,693 chars of
  Markdown; `https://pdfobject.com/pdf/sample.pdf` → title `sample`, 2,949 chars.

## Open risks

1. **Gateway streaming format.** The rewrite wraps every `data:` payload that is
   not an OpenAI JSON chunk or `[DONE]`. If the gateway later emits raw payloads
   for non-content channels, they would be wrapped as content. The heuristic
   matches the observed protocol (reasoning = JSON, content = raw).
2. **Reasoning field.** The gateway emits `reasoning_content`; models are
   published with `compatibility.reasoningField = "reasoning_content"` so
   OpenCode surfaces it. Untested against a model that does not emit it.
3. **Session-store coupling.** Stats depends on the SQLite schema
   (`session.cost`/`tokens_*`, `message.data.tokens`, `part.data.tool`). A future
   OpenCode could change it; the failure mode is an empty/incorrect report, not
   a crash.
4. **Agent installation writes to the config directory.** Bundled agents are
   files under `~/.config/opencode/agents/`; set `installAgents: false` to opt
   out. Uninstalling the plugin leaves the managed files behind (they are marked
   and safe to delete).
5. **Credential ordering.** The OpenCode auth store on this machine holds a
   stale `hawiyat-ai` key that returns `401`; `HAWIYAT_API_KEY` (or the plugin
   `apiKey` option) is checked first, so set one of those. The integration
   connection is tried before `auth.json`.
6. **Model aliasing.** The gateway resolves aliases (requesting
   `hawiyat-composer` streamed frames labelled `claude-opus-5`) and one catalog
   model (`hawiyat-tornado`) returned an internal error in testing. Provider
   behaviour is upstream.

## Overhaul — auto `/connect` + catalog fallback (2026-10-03)

Re-verified against `opencode 2.0.12` (the binary installed on the review
machine), with `@opencode/plugin` 2.0.20 type definitions.

### The `/connect` key prompt is a plugin-registered integration
`IntegrationEditor` has no `add`, but **`editor.update(id, fn)` is an upsert**:
passing an unknown id creates the integration. Together with
`editor.method.update({ integrationID, method: { type: "key", label, form } })`
and `{ type: "env", names }`, this registers a first-class `/connect` entry.
Observed via `opencode api GET /api/integration`:

```json
{"id":"hawiyat","name":"Hawiyat","methods":[
  {"type":"key","label":"Hawiyat API key","form":[{"key":"key","type":"string","hidden":true,"required":true}]},
  {"type":"env","names":["HAWIYAT_API_KEY"]}]}
```

### OpenCode injects the integration credential at request time
A provider registered with `info.integrationID` and **no** `settings.apiKey`
still authenticated: after connecting a credential to the integration, a request
reached the gateway (failing only on the raw-SSE parse, pre-fix), while
`GET /api/provider` showed just `{ baseURL }`. Therefore the key must **not** be
baked into `settings`; the plugin resolves a key only to fetch the catalog.

### Bundled fallback catalog
`src/hawiyat/fallback-models.ts` seeds ~69 ids captured from a live key. It is
used only before the first successful `/v1/models` refresh, so a cold, key-less
install still shows selectable models.

### End-to-end evidence (`opencode 2.0.12`)

| Check | Result |
|-------|--------|
| `opencode plugin list` | `hawiyat.opencode-extension` |
| `/api/integration` | hawiyat + key form + `HAWIYAT_API_KEY` env method |
| `/api/provider` | hawiyat, `integrationID: hawiyat`, settings `{ baseURL }` |
| `opencode models` | 77 `hawiyat/*` |
| `opencode run -m hawiyat/hawiyat-composer` | `EXT_OK` (streaming via `http.response`) |
| `opencode debug agents` | scout / researcher / worker |
| `/stats` command | registered |

This replaces the earlier hand-rolled setup (a `provider` block in
`~/.config/opencode/opencode.json` plus a separate loopback proxy plugin), both
of which were removed once parity was proven.
