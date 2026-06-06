---
name: ov-update
description: Update OpenViking Docker image to latest release and refresh OV documentation as project resources. Use when upgrading OV server version, after a new OV GitHub release, or when user mentions "update ov", "upgrade openviking", "refresh ov docs", "new ov version".
---

# ov-update: OpenViking Update & Doc Refresh

Update `pi-openviking` container to latest OV release, then re-import official docs as OV resources.

## Workflow

### 1. Determine Target Version & Doc Source

#### 1a. Check latest release tag

Scrape GitHub releases to find latest tag:

```
firecrawl_scrape url="https://github.com/volcengine/OpenViking/releases/latest"
```

Extract version tag (e.g. `v0.3.23`) from page URL (`/releases/tag/{tag}`).

#### 1b. Check if `main` has newer docs

Compare with the current installed version (check `version.md` resource):
- If the latest release tag **matches** the current version, check whether `main` has doc commits since that tag:
  ```
  firecrawl_scrape url="https://github.com/volcengine/OpenViking/compare/{tag}...main" onlyMainContent=true
  ```
  Search for `docs/en/` file changes. If `main` has doc changes → use `main` as the doc source (bleeding-edge docs).
- If the latest release tag **differs** from current → update to the new release. Use the release tag as the doc source.
- If same tag **and** no doc changes on `main` → stop (nothing to do).

Set `$DOC_SOURCE` to either `main` or `{tag}` for subsequent steps.

#### 1c. Compare semver for container update

If release tag > current version → proceed with Docker update (steps 2-4).
Otherwise skip steps 2-4 (only docs refresh needed).

### 2. Check Changelog for Breaking Changes

Scrape the release page for the new version to find any API-breaking changes or config migration needed:

```
firecrawl_scrape url="https://github.com/volcengine/OpenViking/releases/tag/{tag}"
```

Pay attention to:
- Config format changes (`ov.conf`)
- API endpoint changes
- Docker image/env changes
- Storage format migrations

### 3. Update Docker Image

```bash
# Pull latest image
docker compose pull

# Or specify tag explicitly (if not using :latest)
docker pull ghcr.io/volcengine/openviking:{tag}
```

Confirm image was pulled with new tag.

### 4. Restart Container

```bash
docker compose up -d
# Verify it's healthy
sleep 5
docker ps --filter name=pi-openviking --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker logs pi-openviking --tail 10
```

Wait for health check to pass (container says `(healthy)`). If health check fails, check logs for config migration issues.

### 5. Discover Any New Docs on GitHub

Before deleting old resources, check if OV added/removed docs since last import.

Use `$DOC_SOURCE` determined in step 1 (either `{tag}` or `main`).

Scrape the GitHub tree for both directories:

```
firecrawl_scrape url="https://github.com/volcengine/OpenViking/tree/{DOC_SOURCE}/docs/en/concepts" onlyMainContent=true formats=["links"]
firecrawl_scrape url="https://github.com/volcengine/OpenViking/tree/{DOC_SOURCE}/docs/en/api" onlyMainContent=true formats=["links"]
```

Extract `.md` file links (not `../`). Compare with REFERENCE.md list:

- **New files found** → add to REFERENCE.md (they need importing too)
- **Files missing** (removed upstream) → remove from REFERENCE.md
- **Same set** → proceed

This ensures the import stays in sync with upstream, not just the last known snapshot.

### 6. Delete Old OV Docs Resources

```bash
ov_delete uri="viking://resources/pi-openviking/docs-ov/" recursive=true
```

### 7. Re-import OV Docs from GitHub

⚠️ Do NOT use `ov_import` — OV's ResourceStore (POST /api/v1/resources) parses markdown headings
into directory trees. Files become directories (size 0). Use `ov_write` (FsStore.write) instead
with raw content fetched from GitHub.

For each doc URL from [REFERENCE.md](REFERENCE.md), substituting `$DOC_SOURCE`:

1. Fetch raw markdown from GitHub raw URL
2. Write to OV via `ov_write` with `mode: "create"` (or `"replace"` if re-importing)

Use `ov_write` with:
- `uri`: the OV target path (`viking://resources/pi-openviking/docs-ov/...`)
- `content`: the raw markdown body (read from fetched file)
- `mode`: `"create"` for first import, `"replace"` for updates

**Batch script template:**

```python
import json, subprocess

AUTH = ["-H", "X-API-Key: dev", "-H", "X-OpenViking-Account: default",
        "-H", "X-OpenViking-User: default", "-H", "X-OpenViking-Agent: pi"]

docs = [
    # (gh_rel_path, ov_rel_path)  — see REFERENCE.md for full list
    ("docs/en/concepts/01-architecture.md", "concepts/01-architecture.md"),
    # ...
]

for gh_path, ov_path in docs:
    gh_url = f"https://raw.githubusercontent.com/volcengine/OpenViking/{DOC_SOURCE}/{gh_path}"
    ov_uri = f"viking://resources/pi-openviking/docs-ov/{ov_path}"
    
    subprocess.run(["curl", "-s", "-o", "/tmp/doc.md", gh_url])
    content = open("/tmp/doc.md").read()
    
    body = json.dumps({"uri": ov_uri, "content": content, "mode": "create"})
    subprocess.run(["curl", "-s",
        "http://localhost:1933/api/v1/content/write",
        "-H", "Content-Type: application/json"] + AUTH + ["-d", body])
```

If a file already exists (e.g. on re-import), replace `"mode": "create"` with `"mode": "replace"`
or use a try-create-then-replace strategy.

### 8. Write Version Marker

After all imports succeed:

```bash
ov_write uri="viking://resources/pi-openviking/docs-ov/version.md" content="# OV Docs Version\n\n**Version:** {tag}\n**Import date:** $(date +%Y-%m-%d)\n**Doc source:** {DOC_SOURCE}\n**Source:** https://github.com/volcengine/OpenViking/tree/{DOC_SOURCE}" mode="replace"
```

### 9. Verify

```
ov_search query="OpenViking session memory"
```

Should return results from the freshly imported docs.

## Why ov_write not ov_import

OV has two distinct APIs for writing content:

| API | Endpoint | Behavior |
|-----|----------|----------|
| **ResourceStore** (`ov_import`) | `POST /api/v1/resources` | Parses markdown headings → directory tree. Use for importing external URLs as structured **resources** with L0/L1/L2 extraction. |
| **FsStore** (`ov_write`) | `POST /api/v1/content/write` | Writes raw content as a flat file. Use for docs, reference files, any content that should stay **intact**. |

`ov_import` is designed for URLs that OV should parse, extract, and index semantically (HTML pages, PDFs, articles with structure).
For plain markdown docs that should remain as-is on disk, use `ov_write` with `mode: create|replace`.

## Notes

- Container is `pi-openviking` (production), not `pi-openviking-test` (CI only)
- `docker-compose.yml` uses `pull_policy: always` → `docker compose pull` always fetches latest `:latest` tag
- OV docs at `main` branch are ahead of the latest release by some commits. By default the skill uses the **release tag** for URLs (version-locked), but if `main` has doc changes since the release, it switches to `main` for docs import (bleeding-edge). This ensures we always get the latest docs even between releases.
- Docs import is async on OV side (VLM generates L0/L1 in background). Search may not work immediately after import — wait a few seconds
- If any `ov_import` fails (HTTP 404), the doc was renamed/removed in new version — check the GitHub tree and update REFERENCE.md URLs accordingly
