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
| **Extension developers** | Reusable operation layer (`src/operations/`) — add new surfaces (MCP, HTTP) without duplicating business logic. |

## Features

### Tools (agent-facing)

| Tool | Action |
|------|--------|
| `memsearch` | Semantic search across memories, resources, and skills. Modes: `fast` (simple), `deep` (context-aware), `auto` (decides based on query complexity). |
| `memread` | Read content at a `viking://` URI with tiered loading (L0 abstract, L1 overview, L2 full content). |
| `membrowse` | Browse the `viking://` filesystem — list, tree, or stat entries. |
| `memcommit` | Commit current session to OpenViking. Triggers async memory extraction. Returns `task_id`. |
| `memimport` | Import URL, local file, or directory (zipped) as a resource or skill. |
| `memdelete` | Delete a resource, skill, or memory by `viking://` URI. |

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
2. Ranks results with multi-factor scoring (relevance + recency + preference + lexical overlap).
3. Deduplicates and trims to token budget.
4. Injects top results as `<relevant-memories>` XML block into the system prompt.

Uses **deep** mode when an OV session exists, **fast** mode otherwise.

## Content Levels (L0 / L1 / L2)

OpenViking uses tiered content loading to manage context window budget:

| Level | Name | Size | Use case |
|-------|------|------|----------|
| L0 | Abstract | ~100 tokens | Quick scan — decide if content is relevant. |
| L1 | Overview | ~2k tokens | Summary — understand without loading full content. |
| L2 | Read | Full content | Deep read — retrieve complete document. |

`memread` auto-detects level: directories → L1 overview, files → L2 full content. Override with `level` parameter.

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
  "openVikingAutoRecallTokenBudget": 500
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
| `openVikingCommitTimeout` | `OPENVIKING_COMMIT_TIMEOUT` | `60000` | HTTP timeout (ms) for commit operations |
| `openVikingHealthPath` | `OPENVIKING_HEALTH_PATH` | `/health` | Server health check endpoint |
| `openVikingAutoRecall` | — | `true` | Enable/disable auto-recall |
| `openVikingAutoRecallLimit` | — | `10` | Max search results from OV |
| `openVikingAutoRecallTimeout` | — | `5000` | Auto-recall timeout (ms) |
| `openVikingAutoRecallTopN` | — | `5` | Max memories injected into prompt |
| `openVikingAutoRecallTokenBudget` | — | `500` | Token budget for auto-recall block |
| `openVikingAutoRecallScoreThreshold` | — | `0.15` | Minimum relevance score |
| `openVikingAutoRecallMaxContentChars` | — | `500` | Max chars per recalled item |
| `openVikingAutoRecallPreferAbstract` | — | `true` | Prefer L0 abstract over full content |
| — | `OV_LOG_FILE` | `~/.pi/agent/pi-openviking.log` | Log file path |

## Design Decisions

### Pi owns session history

Pi maintains its own session history. OpenViking does **not** reassemble it. There is no `assemble()` or `compact()` — Pi is the source of truth for conversation history. OpenViking is the source of truth for **extracted memories**.

### Commit is explicit

Sessions are committed only when the user (or agent) explicitly calls `/ov-commit` or `memcommit`. No auto-commit on shutdown — `onShutdown()` is synchronous with zero I/O to avoid blocking Pi exit.

### Health check with graceful degradation

On startup, the plugin probes `GET /health`. If OpenViking is unreachable, all tools and commands still register, but auto-recall is disabled. Recovery is on-demand — the next tool call or auto-recall attempt retries the health check. Session sync has a circuit breaker: 3 consecutive failures → stop trying until recovery.

### Fire-and-forget async operations

`memcommit` and `memimport` return immediately with a `task_id`. Memory extraction and import happen server-side. Use `memcommit` with `wait: true` to poll until extraction completes (timeout 15s).

### Operations layer

Business logic lives in `src/operations/` — written once, called by both tools (JSON for agent) and commands (human-readable text). This is the seam for adding new surfaces without duplication.

## Differences from OpenClaw Plugin

OpenViking ships an official OpenClaw (Claude) plugin. Key differences:

| Feature | OpenClaw | pi-openviking |
|---------|----------|---------------|
| Session history | OpenClaw reassembles from OV (`assemble`/`compact`) | Pi is source of truth. No reassembly. |
| Auto-commit | Threshold-based auto-commit when session grows | Manual-only via `/ov-commit` or `memcommit` |
| Archive expansion | Reconstructs messages from compressed archives | Not needed — Pi keeps full history |
| Multi-agent header | Sends `X-OpenViking-Agent` for routing | Not applicable — single agent |
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
curl http://localhost:1933/health
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
curl http://localhost:1933/health
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

### Auto-recall not working

1. Check `openVikingAutoRecall` is not set to `false` in `.pi/settings.json`.
2. Verify server is healthy (`/health` returns 200).
3. Check logs for `"auto-recall failed"` messages.
4. Use `/ov-recall` to toggle or check state.

### Session not syncing

Session sync has a circuit breaker — after 3 consecutive failures, it stops trying. Check:

1. Server connectivity (`/health`).
2. Logs for `"session sync"` errors.
3. Recovery happens automatically on next successful tool call.

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
