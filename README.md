# pi-openviking

Pi extension for [OpenViking](https://github.com/openviking) — long-term memory and context database for AI coding agents.

> **Status:** Production-ready. Active development.

## What it does

Pi is stateless between sessions. pi-openviking gives it persistent memory:

- **Auto-recall** — before each agent turn, relevant OV memories are injected into the prompt automatically.
- **Session sync** — messages are forwarded to an OV session in real time. On session shutdown, OV extracts memories (preferences, patterns, decisions).
- **Knowledge store** — save documentation, code, and notes into a `viking://` virtual filesystem.
- **Semantic search** — find memories and resources by meaning.
- **Profiles** — switch between `web-dev`, `docs`, `learning` to tune recall behavior.

## Install

```bash
pi install git:github.com/4cya/pi-openviking
```

Then `/reload` if pi is already running.

## Quick Start

```bash
# 1. Create standalone config file
mkdir -p ~/.pi/agent
cat > ~/.pi/agent/pi-openviking.json << 'EOF'
{
  "ov": {
    "endpoint": "http://localhost:1933",
    "apiKey": "your-api-key-here"
  }
}
EOF

# 2. Start pi and verify
pi
# In pi: /ov-status
```

## Configuration

Config loads in this cascade (first match wins):

```
1. ~/.pi/agent/pi-openviking.json     ← Standalone file (recommended)
2. Env vars (OV_API_KEY, OV_TOP_N, ...)
3. ~/.pi/settings.json  (under "pi-openviking" key)
4. <project>/.pi/settings.json (under "pi-openviking" key)
5. Built-in defaults
6. Active Profile behavior merge
```

### Method 1: Standalone file (recommended)

Create `~/.pi/agent/pi-openviking.json`. Only specify what you need to override — defaults fill the rest:

```json
{
  "ov": {
    "endpoint": "http://your-server:1933",
    "apiKey": "your-api-key",
    "agentId": "pi-termux"
  },
  "recall": {
    "topN": 8,
    "scoreThreshold": 0.5,
    "autoRecall": true
  },
  "logger": {
    "level": "info",
    "path": "~/.pi/agent/pi-openviking.log"
  }
}
```

### Method 2: pi settings.json (legacy, still supported)

```json
{
  "pi-openviking": {
    "ov": {
      "endpoint": "http://localhost:1933",
      "apiKey": "dev"
    }
  }
}
```

### Method 3: Environment variables

| Env | Config path | Default | Description |
|-----|-------------|---------|-------------|
| `OV_API_KEY` | `ov.apiKey` | `""` | API key |
| `OV_ENDPOINT` | `ov.endpoint` | `"http://localhost:1933"` | Server URL |
| `OV_TOP_N` | `recall.topN` | `8` | Max recall items |
| `OV_SCORE_THRESHOLD` | `recall.scoreThreshold` | `0.5` | Min relevance score |
| `OV_TARGET_URI` | `recall.targetUri` | — | Scope recall to a URI subtree |
| `OV_EXPAND_GRAPH` | `recall.expandGraph` | `true` | Enable GraphExpander |
| `OV_SEARCH_MODE` | `recall.searchMode` | `"search"` | `"find"` or `"search"` |
| `OV_ACTIVE_PROFILE` | `profile.activeProfile` | `"default"` | Active profile |
| `OV_LOG_LEVEL` | `logger.level` | `"info"` | Log level |
| `OV_WIDGET` | `ui.showWidget` | `true` | Show OV status bar above input |

> **Note:** The standalone config file is NOT auto-created. You create it manually when you want to override defaults. This prevents accidental overwrites and keeps the installation clean.

## Tools (agent-facing)

| Tool | Action |
|------|--------|
| `ov_search` | Semantic search across memories, resources, skills. Modes: `fast`, `deep`, `auto`. |
| `ov_glob` | Discover URIs by glob pattern (e.g. `viking://**/*.md`). |
| `ov_grep` | Regex content search across stored knowledge. |
| `ov_read` | Read content at a `viking://` URI. Levels: L0 abstract, L1 overview, L2 full. |
| `ov_write` | Save, mkdir, or mv resources in the `viking://` filesystem. |
| `ov_recall` | Explicit recall — inject curated memories into the prompt on demand. |
| `ov_list` | Flat directory listing of `viking://` URIs. |
| `ov_tree` | Recursive tree listing of `viking://` URIs. |
| `ov_stat` | Get metadata (type, size, modTime) for a `viking://` URI. |
| `ov_delete` | Delete a resource at a `viking://` URI (no confirmation). |
| `ov_resource` | Save a resource document (`viking://resources/...`). |
| `ov_skill` | Save a skill definition (`viking://skills/...`). |
| `ov_import` | Import an external URL as an OV resource (HTML, PDF, Markdown, etc.). |
| `ov_session` | Query OV session metadata (message count, commit count, memories). |

## Commands (user-facing)

| Command | Action |
|---------|--------|
| `/ov-start` | Create a new OV session. |
| `/ov-reindex <uri> [--mode vectors_only\|full]` | Rebuild vector embeddings for a URI (e.g. after delete). |
| `/ov-commit [--wait]` | Commit session to OV (triggers memory extraction). `--wait` polls until done. |
| `/ov-search <query>` | Semantic search, human-readable. |
| `/ov-tree [uri]` | Browse `viking://` filesystem as a tree. |
| `/ov-delete <uri>` | Delete a `viking://` entry. |
| `/ov-recall <on\|off>` | Toggle auto-recall. |
| `/ov-status` | Show connection, session, recall toggle, profile, scope. |
| `/ov-profile {show\|list\|apply <name>\|detect}` | Manage behavioral profiles. |

## Auto-recall

Before each LLM call (via the `context` lifecycle hook), the plugin runs a guard chain:

1. **Toggle** — if auto-recall is off (`/ov-recall off`), skip.
2. **Circuit breaker** — if OV is unreachable, skip.
3. **Session** — auto-create a session if none exists.
4. **Recall** — search OV → curate → expand via GraphExpander → inject as hidden `<relevant-memories>` block.

## Profiles

4 built-in profiles tune recall behavior:

| Profile | topN | Threshold | Use case |
|---------|------|-----------|----------|
| `default` | 3 | 0.5 | General purpose |
| `web-dev` | 3 | 0.5 | Focused project context (no graph expansion) |
| `docs` | 5 | 0.3 | Broad documentation search |
| `learning` | 8 | 0.2 | Maximum capture |

Switch via `/ov-profile apply <name>`. Custom profiles can be defined in `.pi/settings.json` under `profile.profiles`. When `activeProfile = "auto"`, the plugin detects the profile from your workspace path.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Auto-recall not working | `/ov-recall` is on? Server healthy? Logs at `~/.pi/agent/pi-openviking.log` |
| Requests rejected | Circuit breaker OPEN — wait 30s for auto-recovery or restart OV |
| Commit does nothing | Fire-and-forget by design. Use `/ov-commit --wait` to poll |
| Server unreachable | `curl http://localhost:1933/ready` |
| Config not loaded | Check `~/.pi/agent/pi-openviking.json` exists and is valid JSON |

## Related docs

| Doc | Contents |
|-----|----------|
| [`CONTEXT.md`](./CONTEXT.md) | Domain glossary and architecture decisions |
| [`UBIQUITOUS_LANGUAGE.md`](./UBIQUITOUS_LANGUAGE.md) | Expanded domain glossary |
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records |
| [`LICENSE`](./LICENSE) | License |
