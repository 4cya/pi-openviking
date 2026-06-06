---
name: ov-update
description: Update OpenViking Docker image to latest release and refresh OV documentation as project resources. Use when upgrading OV server version, after a new OV GitHub release, or when user mentions "update ov", "upgrade openviking", "refresh ov docs", "new ov version".
---

# ov-update: OpenViking Update & Doc Refresh

Update `pi-openviking` container to latest OV release, then re-import official docs as OV resources.

## Workflow

### 1. Check Latest OV Release

Scrape GitHub releases to find latest tag:

```
firecrawl_scrape url="https://github.com/volcengine/OpenViking/releases/latest"
```

Extract version tag (e.g. `v0.3.23`) from page. Compare with current running version (check `version.md` resource). If same → stop.

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

Scrape the GitHub tree for both directories:

```
firecrawl_scrape url="https://github.com/volcengine/OpenViking/tree/{tag}/docs/en/concepts" onlyMainContent=true formats=["links"]
firecrawl_scrape url="https://github.com/volcengine/OpenViking/tree/{tag}/docs/en/api" onlyMainContent=true formats=["links"]
```

Extract `.md` file links (not `../`). Compare with REFERENCE.md list:

- **New files found** → add to REFERENCE.md (they need importing too)
- **Files missing** (removed upstream) → remove from REFERENCE.md
- **Same set** → proceed

This ensures the import stays in sync with upstream, not just the last known snapshot.

### 7. Delete Old OV Docs Resources

```bash
# Remove entire docs-ov tree from OV
ov_delete --recursive viking://resources/pi-openviking/docs-ov/
```

### 8. Re-import OV Docs from GitHub

Use `ov_import` for each doc URL from [REFERENCE.md](REFERENCE.md), substituting the tag into URLs:

- Replace `main` with the release `{tag}` in all URLs (e.g. `main` → `v0.3.23`)
- Import concepts/, api/, and README
- Import order does not matter — OV processes async

Use `ov_import` with:
- `url`: the raw GitHub URL
- `targetUri`: the corresponding `viking://resources/pi-openviking/docs-ov/...` path
- `reason`: brief description

### 9. Write Version Marker

After all imports succeed:

```bash
ov_write action="save" uri="viking://resources/pi-openviking/docs-ov/version.md" content="# OV Docs Version\n\n**Version:** {tag}\n**Import date:** $(date +%Y-%m-%d)\n**Source:** https://github.com/volcengine/OpenViking/tree/{tag}"
```

### 10. Verify

```
ov_search query="OpenViking session memory" source="docs-ov"
```

Should return results from the freshly imported docs.

## Notes

- Container is `pi-openviking` (production), not `pi-openviking-test` (CI only)
- `docker-compose.yml` uses `pull_policy: always` → `docker compose pull` always fetches latest `:latest` tag
- OV docs at `main` branch are ahead of the latest release by some commits — use the **release tag** for URLs to stay version-locked
- Docs import is async on OV side (VLM generates L0/L1 in background). Search may not work immediately after import — wait a few seconds
- If any `ov_import` fails (HTTP 404), the doc was renamed/removed in new version — check the GitHub tree and update REFERENCE.md URLs accordingly
