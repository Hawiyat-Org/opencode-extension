# @hawiyat/opencode-extension

Hawiyat's collection of [OpenCode](https://opencode.ai) extensions, packaged as
a single installable plugin. It is a port of
[Hawiyat-Org/pi-extension](https://github.com/Hawiyat-Org/pi-extension) onto the
OpenCode **v2** plugin API.

| Capability | What it adds |
|------------|--------------|
| [hawiyat provider](#hawiyat-provider) | `hawiyat` model provider for the LiteLLM gateway at `https://ai.hawiyat.cloud` |
| [usage stats](#usage-stats) | `/stats` command + `usage_stats` tool for tokens/cost/models/projects |
| [web fetch](#web-fetch) | Overrides the built-in `webfetch` with Readability + Turndown + unpdf + Jina fallback |
| [subagents](#subagents) | Bundles the `scout`, `researcher`, and `worker` subagents |

Everything is one plugin id (`hawiyat.opencode-extension`) and one `setup()` that
registers every domain and returns a single cleanup function.

## Install

### Global plugin directory (local development / vendored)

```bash
git clone https://github.com/Hawiyat-Org/opencode-extension.git
cd opencode-extension && bun install
ln -s "$PWD" ~/.config/opencode/plugins/opencode-extension
```

OpenCode discovers immediate plugin package directories under
`~/.config/opencode/plugins/`.

### Configured package

Install from the repository with the OpenCode CLI (the package is not published
to a public registry):

```bash
opencode plugin add github:Hawiyat-Org/opencode-extension
```

Or add it to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@hawiyat/opencode-extension"]
}
```

V2 uses the plural `plugins` key. V1 used `plugin`; both are accepted by the
loader for compatibility, but new configuration should use `plugins`.

### Credentials

On first load the plugin **registers a `hawiyat` integration** with OpenCode, so
the provider appears in the `/connect` picker (and `opencode auth login hawiyat`)
with a **Hawiyat API key** prompt and a `HAWIYAT_API_KEY` environment method. The
key prompt is OpenCode's built-in one for `key` methods — the plugin declares no
custom `form` (a `hidden` + `required` field with no `default` fails validation).
The provider is linked to that integration via `integrationID`, and OpenCode
injects the stored credential into each request at call time.

The plugin resolves a key only to fetch the model catalog, in this order:

1. plugin option `apiKey`
2. environment variable `HAWIYAT_API_KEY`
3. the OpenCode integration connection for `hawiyat`
4. the OpenCode auth store (`<data>/opencode/auth.json`), for legacy setups

Only `hawiyat` is registered. The legacy `hawiyat-ai` id from the earlier
V1/pi setup is still read from the auth store so an existing install keeps
resolving its stored key without re-authenticating; the plugin never writes it.

No key is ever written to the repository or to plugin settings. Connect once:

```bash
opencode auth login hawiyat   # interactive key prompt
# or, in the TUI:  /connect  ->  Hawiyat
```

### Options

Pass options with the object form in `plugins`:

```jsonc
{
  "plugins": [
    {
      "package": "@hawiyat/opencode-extension",
      "options": {
        "apiKey": "…optional, prefer env…",
        "agentModel": "hawiyat/hawiyat-composer",
        "agentsDir": "/home/me/.config/opencode/agents",
        "installAgents": true
      }
    }
  ]
}
```

| Option | Default | Purpose |
|--------|---------|---------|
| `apiKey` | – | Gateway key override (use `HAWIYAT_API_KEY` instead when possible) |
| `agentModel` | inherit caller | Model reference (`provider/model`) for the bundled subagents |
| `agentsDir` | `<config>/opencode/agents` | Where bundled agent Markdown is installed |
| `installAgents` | `true` | Set `false` to skip installing agent files |

## Capability → mechanism mapping

OpenCode v2 replaced the V1 hook bag with domain **transforms** and **hooks**.
Each capability maps to a host-native mechanism:

| Capability | Mechanism | Exact API |
|------------|-----------|-----------|
| hawiyat provider | provider transform | `ctx.provider.transform(editor => editor.add({ info, models }))` with `Provider.Info.empty(id)` and `package: "@opencode/ai/providers/openai-compatible"`, `settings.baseURL` |
| provider models | provider transform (same edit) | `editor.add({ models })`, built with `Model.Info.default(providerID, id)` |
| gateway SSE fix | session HTTP response hook, scoped by provider | `ctx.session.hook("http.response", event => { event.response = normalizeSSEResponse(event.response) }, { providerID: "hawiyat" })` |
| gateway API key | `/connect` integration + provider link | `ctx.integration.transform(e => { e.update(id, i => …); e.method.update({ integrationID, method: { type: "key", label } }) })` — no `form`: the built-in key prompt collects the credential, and `method.update` is keyed by type so reloads replace; provider `info.integrationID = id` |
| model catalog | runtime fetch + on-disk cache + periodic refresh | `fetch("/v1/models")`, `fetch("/model_group/info")`, `ctx.provider.reload()` |
| `/stats` command | command transform | `ctx.command.transform(editor => editor.add({ name, execute }))` |
| `usage_stats` tool | tool transform | `ctx.tool.transform(editor => editor.add({ name, input, execute }))` |
| stats aggregation | host session store (read-only) | `bun:sqlite` over `<data>/opencode/opencode.db` (`session`, `message`, `part`) |
| subagents | global agent Markdown + agent transform | write `<config>/opencode/agents/*.md`; `ctx.agent.transform(editor => editor.update(id, agent => …))` |
| web fetch | tool transform (override built-in) | `ctx.tool.transform(editor => editor.update("webfetch", tool => { … }))` |
| cleanup | `setup()` return value | return a function that clears the catalog refresh timer |

The full research notes, including the exact type paths and the deviations where
the v2 API could not express something, live in [NOTES.md](NOTES.md).

## hawiyat provider

Models are collected at runtime from the customer's own key via `/v1/models`,
enriched with `/model_group/info` (mode, vision, reasoning, cost, limits), and
cached at `$XDG_CACHE_HOME/opencode/hawiyat-models.json` (warm starts reuse the
cache; the provider refreshes every 10 minutes). A cold, key-less start shows
no models until `/connect` — the first successful `/v1/models` fetch populates
the picker. Gateway-internal routing/leaf names are filtered by
`isCustomerFacingModelId` as a backstop on the live refresh. Models whose price
is unknown carry no cost tier (rendered as "no pricing", never `$0`).

The gateway streams reasoning as OpenAI JSON chunks but plain content as raw
`data: <token>` records (which may contain literal newlines). OpenCode's native
OpenAI-compatible runtime parses SSE inside its own driver, so the plugin
rewrites the response body at the `http.response` session hook, re-encoding those
records into `chat.completion.chunk` deltas, exactly like the pi implementation.

## usage stats

`/stats [today|7d|30d|90d|all]` renders a report as a synthetic message, and the
`usage_stats` tool returns the same report as text or JSON (`format: "json"`).
The report covers sessions, subagents, messages, tokens, cost, models, projects,
daily activity, and tool calls.

**Deviation:** OpenCode v2 tracks these numbers natively (`opencode stats`,
the server `session.stats` operation), but the v2 plugin context does not expose
`session.list` or `session.stats`. The plugin therefore reads the host's own
SQLite session store read-only instead of re-implementing telemetry. This is the
one place the port cannot use a first-class plugin API; see NOTES.md.

## web fetch

The built-in `webfetch` tool is overridden in place. HTML is reduced with
Readability and converted to Markdown with Turndown; PDFs are extracted with
unpdf (up to 100 pages); plain text is passed through; pages Readability cannot
parse fall back to a Next.js RSC extractor and then Jina Reader. `format: "text"`
or `"html"` returns the raw body. Response size (5 MB HTML / 20 MB PDF) and
timeout (30 s) limits match the pi implementation.

## subagents

`scout` (read-only recon), `researcher` (web research), and `worker`
(implementation, may dispatch `scout`/`researcher`) are installed as OpenCode
subagents with least-privilege permissions.

**Deviation:** the v2 `AgentEditor` has no `add`, so agents cannot be created
purely through `ctx.agent.transform`. Bundled agents are written as managed
Markdown files into the global agents directory (OpenCode discovers and watches
it natively); `ctx.agent.transform` then enforces subagent mode and permissions.
A same-named file without the managed marker is treated as a user override.

## Verification

```bash
bun install
bun run typecheck
bun test
```

Then load into a real OpenCode and check:

```bash
opencode plugin list          # shows the extension
opencode debug agents         # lists scout / researcher / worker
opencode models               # lists hawiyat/<model>
opencode debug config         # provider settings
```

See NOTES.md for the exact commands and observed output captured during the
port, including which capabilities were exercised end to end.

## Attribution

This package is a port of [Hawiyat-Org/pi-extension](https://github.com/Hawiyat-Org/pi-extension)
(MIT). The bundled subagent roles derive from
[HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents)
(MIT, Copyright (c) 2026 HazAT). Runtime dependencies retain their own licenses:
Readability (Apache-2.0), linkedom (MIT), Turndown (MIT), unpdf (MIT). See
[LICENSE](LICENSE).

## License

MIT © Hawiyat.
