# pi-openviking

Pi extension for [OpenViking](https://github.com/openviking) — long-term memory and context database for AI coding agents.

## What it does

Pi coding agent is stateless between sessions. pi-openviking gives it persistent memory:

- **Remembers context across sessions** — conversations are committed to OpenViking, which extracts memories (preferences, patterns, decisions).
- **Auto-recalls relevant memories** — before each agent turn, relevant memories are injected into the prompt automatically.
- **Stores reusable knowledge** — import documentation, code, skills, and resources into a `viking://` filesystem.
- **Semantic search** — find memories, resources, and skills by meaning, not just keywords.

## Who benefits

| Persona | Benefit |
|---------|---------|
| **Developers using Pi** | Persistent context between coding sessions. No re-explaining project structure, preferences, or past decisions. |
| **AI Agents (Pi)** | Access to imported skills, project documentation, and user preferences stored in OpenViking. |
| **Extension developers** | Reference adapter pattern — see `src/adapters/` for port implementations and `src/domain/ports/` for extension points. |

## Features

### Tools (agent-facing)

| Tool | Action |
|------|--------|
| `ov_search` | Semantic search across memories, resources, and skills. Modes: `fast` (simple), `deep` (context-aware), `auto` (decides based on query complexity). |
| `ov_recall` | Explicit recall trigger — inject curated memories relevant to current context into the prompt. Wraps `RecallService.recall()`. |
| `ov_glob` | Discover URIs by glob pattern (e.g. `viking://**/*.md`). |
| `ov_grep` | Regex content search across stored knowledge. |
| `ov_read` | Read content at a `viking://` URI with tiered loading (L0 abstract, L1 overview, L2 full content). |
| `ov_write` | Save, create directories, or move resources in the `viking://` filesystem. Single tool with `action` enum (`save`/`mkdir`/`mv`). |

### Commands (user-facing)

| Command | Action |
|---------|--------|
| `/ov-search <query>` | Semantic search, formatted for human reading. |
| `/ov-ls [path]` | Browse `viking://` filesystem, tree view. |
| `/ov-import <source>` | Import a URL or file into OpenViking. |
| `/ov-delete <uri>` | Delete entry at `viking://` URI. |
| `/ov-recall` | Toggle auto-recall on/off for current session. |
| `/ov-commit` | Commit session to OpenViking (triggers memory extraction). |

### Auto-recall

Before each agent turn, the plugin:

1. Searches OpenViking with the user's prompt.
2. Ranks results with multi-factor scoring (relevance + leaf boost + temporal + preference + lexical overlap).
3. Deduplicates and trims to token budget.
4. Injects top results as `<relevant-memories>` XML block into the system prompt.

Uses **deep** mode for complex queries (questions, long prompts, ≥8 words) when an OV session exists, **fast** mode for simple queries or when no session exists.

## Content Levels (L0 / L1 / L2)

OpenViking uses tiered content loading to manage context window budget:

| Level | Name | Size | Use case |
|-------|------|------|----------|
| L0 | Abstract | ~100 tokens | Quick scan — decide if content is relevant. |
| L1 | Overview | ~2k tokens | Summary — understand without loading full content. |
| L2 | Read | Full content | Deep read — retrieve complete document. |

`memread` defaults to `auto` level: directories → L1 overview, files → L2 full content. Override with `level` parameter (`auto`, `abstract`, `overview`, `read`).

## Configuration

All settings cascade: **`.pi/settings.json` → environment variables → defaults**.

### `.pi/settings.json`

```json
{
  "openVikingEndpoint": "http://localhost:1933",
  "openVikingApiKey": "dev",
  "openVikingAutoRecall": true,
  "openVikingAutoRecallLimit": 10,
  "openVikingAutoRecallTimeout": 5000,
  "openVikingAutoRecallTopN": 5,
  "openVikingAutoRecallTokenBudget": 4000
  // ...see full settings reference below
}
```

### Full settings reference

| Setting | Env Variable | Default | Description |
|---------|-------------|---------|-------------|
| `openVikingEndpoint` | `OPENVIKING_ENDPOINT` | `http://localhost:1933` | OpenViking server URL |
| `openVikingApiKey` | `OPENVIKING_API_KEY` | `dev` | API key for authentication |
| `openVikingAccount` | `OPENVIKING_ACCOUNT` | `default` | Account namespace |
| `openVikingUser` | `OPENVIKING_USER` | `default` | User namespace |
| `openVikingTimeout` | `OPENVIKING_TIMEOUT` | `30000` | HTTP timeout (ms) for general requests |
| `openVikingCommitTimeout` | `OPENVIKING_COMMIT_TIMEOUT` | `120000` | HTTP timeout (ms) for commit operations |
| `openVikingAutoRecall` | `OPENVIKING_AUTO_RECALL` | `true` | Enable/disable auto-recall |
| `openVikingAutoRecallLimit` | `OPENVIKING_AUTO_RECALL_LIMIT` | `10` | Max search results from OV |
| `openVikingAutoRecallTimeout` | `OPENVIKING_AUTO_RECALL_TIMEOUT` | `5000` | Auto-recall timeout (ms) |
| `openVikingAutoRecallTopN` | `OPENVIKING_AUTO_RECALL_TOPN` | `5` | Max memories injected into prompt |
| `openVikingAutoRecallTokenBudget` | `OPENVIKING_AUTO_RECALL_TOKEN_BUDGET` | `4000` | Token budget for auto-recall block |
| `openVikingAutoRecallScoreThreshold` | `OPENVIKING_AUTO_RECALL_SCORE_THRESHOLD` | `0.15` | Minimum relevance score |
| `openVikingAutoRecallMaxContentChars` | `OPENVIKING_AUTO_RECALL_MAX_CONTENT_CHARS` | `500` | Max chars per recalled item |
| `openVikingAutoRecallPreferAbstract` | `OPENVIKING_AUTO_RECALL_PREFER_ABSTRACT` | `true` | Prefer L0 abstract over full content |
| — | `OV_LOG_FILE` | `~/.pi/agent/pi-openviking.log` | Log file path |
| — | `OV_DEBUG` | `true` | Enable/disable debug logging |

## Design Decisions

### Pi owns session history

Pi maintains its own session history. OpenViking does **not** reassemble it. There is no `assemble()` or `compact()` — Pi is the source of truth for conversation history. OpenViking is the source of truth for **extracted memories**.

### Commit on session shutdown

When a Pi session ends (`session_shutdown`), the plugin auto-commits to OV to trigger memory extraction. Errors are logged but don't block Pi exit.

Users can also commit explicitly via `/ov-commit`.

### Health check with graceful degradation

On startup, the plugin probes `GET /ready`. If OpenViking is unreachable, all tools and commands still register, but auto-recall is disabled. Recovery is on-demand — the next tool call or auto-recall attempt retries the health check.

### Circuit breaker

The Transport layer has a configurable circuit breaker that protects against OV unavailability. States: **CLOSED** (normal) → `threshold` consecutive failures → **OPEN** (rejects instantly with `ConnectionError`, no HTTP call) → `resetTimeoutMs` → **HALF_OPEN** (allows 1 probe request) → success = back to CLOSED, failure = back to OPEN with `resetTimeoutMs × 2`. Driven by real request failures (5xx/network/timeout), not health check. Config via `OVAdapterConfig.circuitBreaker`, env vars `OV_CIRCUIT_BREAKER_THRESHOLD` and `OV_CIRCUIT_BREAKER_RESET_TIMEOUT`.

### Fire-and-forget async operations

`memcommit` and `memimport` return immediately with a `task_id`. Memory extraction and import happen server-side. Use `memcommit` with `wait: true` to poll until extraction completes (timeout 15s).

## Differences from OpenClaw Plugin

OpenViking ships an official OpenClaw (Claude) plugin. Key differences:

| Feature | OpenClaw | pi-openviking |
|---------|----------|---------------|
| Session history | OpenClaw reassembles from OV (`assemble`/`compact`) | Pi is source of truth. No reassembly. |
| Auto-commit | Threshold-based auto-commit when session grows | On session shutdown via `session_shutdown` hook |
| Archive expansion | Reconstructs messages from compressed archives | Not needed — Pi keeps full history |
| Multi-agent header | Sends `X-OpenViking-Agent` for routing | Sends `X-OpenViking-Agent: pi` header |
| Multi-namespace search | Parallel search across user + agent memories | Single global search (OV ranks across namespaces) |
| Tool call sync | Preserves tool calls in session sync | Structured `Part[]` sync (ADR-003) |
| Reranking | Server-side reranking via API | Trusts OV's internal pipeline + local curator |

## Local Development Server (Docker)

### Prerequisites

1. **Docker Engine** + **Docker Model Runner** CLI plugin
2. Pull the models:

```bash
docker model pull ai/nomic-embed-text-v1.5
docker model pull ai/gemma4
```

3. Verify Model Runner is running:

```bash
docker model status
```

4. Load models in the background:

```bash
docker model run ai/nomic-embed-text-v1.5 -d
docker model run ai/gemma4 -d
```

### Start OpenViking

```bash
docker compose up
```

OpenViking starts on `http://localhost:1933`.

### Verify

```bash
curl http://localhost:1933/ready
# → 200 OK

curl -X POST http://localhost:1933/api/v1/sessions
# → { "status": "ok", "result": { "session_id": "..." } }
```

### Stop

```bash
docker compose down
```

Data persists in `~/.openviking/data` on the host and survives `down`/`up` cycles.

### Architecture

```
host
├── Docker Model Runner (port 12434, OpenAI-compatible API)
│   ├── ai/nomic-embed-text-v1.5 (embedding, 768d)
│   └── ai/gemma4 (VLM)
│
└── docker-compose (network_mode: host)
    └── openviking (ports 1933 + 8020)
        consumes Model Runner via http://localhost:12434/v1
        config: ~/.openviking/ov.conf → /app/ov.conf
        data:   ~/.openviking/data   → /app/data
```

## Troubleshooting

### Check server health

```bash
curl http://localhost:1933/ready
```

If unreachable, the plugin disables auto-recall and retries on next tool call.

### View logs

```bash
tail -f ~/.pi/agent/pi-openviking.log
```

Or set custom log path:

```bash
export OV_LOG_FILE=/tmp/pi-ov.log
```

Enable debug logging:

```bash
export OV_DEBUG=true
```

### Auto-recall not working

1. Check `openVikingAutoRecall` is not set to `false` in `.pi/settings.json`.
2. Verify server is healthy (`/ready` returns 200).
3. Check logs for `"auto-recall failed"` messages.
4. Use `/ov-recall` to toggle or check state.

### Requests being rejected

If the circuit breaker is OPEN (3 consecutive failures by default), requests are rejected instantly with `ConnectionError`. Check:

1. Server connectivity (`/ready`).
2. Logs for `"circuit breaker OPEN"` messages.
3. Recovery happens automatically after `resetTimeoutMs` (30s default) — next request acts as probe.
4. Each probe failure doubles the reset timeout.

### Commit seems to do nothing

`memcommit` is fire-and-forget — it returns a `task_id` immediately. Memory extraction happens server-side. To wait for completion:

```
memcommit with wait: true
```

This polls until extraction finishes (timeout 15s).

### Import fails for directory

Directory imports require zipping. The plugin handles this automatically. Ensure:

1. The directory path exists and is readable.
2. Sufficient disk space for the temp zip.
3. OpenViking's `temp_upload` endpoint is reachable.
