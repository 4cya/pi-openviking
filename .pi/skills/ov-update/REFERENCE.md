# OV Doc URLs Reference

All URLs use `main` branch. When importing for a specific release, replace `main` with the tag (e.g. `v0.3.23`).

## README

| File | URL |
|------|-----|
| README.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/README.md` |

## Concepts (13 docs)

| # | Path | URL |
|---|------|-----|
| 1 | concepts/01-architecture.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/01-architecture.md` |
| 2 | concepts/02-context-types.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/02-context-types.md` |
| 3 | concepts/03-context-layers.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/03-context-layers.md` |
| 4 | concepts/04-viking-uri.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/04-viking-uri.md` |
| 5 | concepts/05-storage.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/05-storage.md` |
| 6 | concepts/06-extraction.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/06-extraction.md` |
| 7 | concepts/07-retrieval.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/07-retrieval.md` |
| 8 | concepts/08-session.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/08-session.md` |
| 9 | concepts/09-transaction.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/09-transaction.md` |
| 10 | concepts/10-encryption.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/10-encryption.md` |
| 11 | concepts/11-multi-tenant.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/11-multi-tenant.md` |
| 12 | concepts/12-metrics.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/12-metrics.md` |
| 13 | concepts/13-privacy.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/concepts/13-privacy.md` |

## API Reference (11 docs)

| # | Path | URL |
|---|------|-----|
| 1 | api/01-overview.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/01-overview.md` |
| 2 | api/02-resources.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/02-resources.md` |
| 3 | api/03-filesystem.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/03-filesystem.md` |
| 4 | api/04-skills.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/04-skills.md` |
| 5 | api/05-sessions.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/05-sessions.md` |
| 6 | api/06-retrieval.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/06-retrieval.md` |
| 7 | api/07-system.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/07-system.md` |
| 8 | api/08-admin.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/08-admin.md` |
| 9 | api/09-metrics.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/09-metrics.md` |
| 10 | api/10-privacy.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/10-privacy.md` |
| 11 | api/99-api-doc-writing-guide.md | `https://raw.githubusercontent.com/volcengine/OpenViking/main/docs/en/api/99-api-doc-writing-guide.md` |

## Target URIs in OV

All docs go under:

```
viking://resources/pi-openviking/docs-ov/{path}
```

Example: `concepts/08-session.md` → `viking://resources/pi-openviking/docs-ov/concepts/08-session.md`

## Import Command Template

```bash
ov_import url="https://raw.githubusercontent.com/volcengine/OpenViking/{tag}/docs/en/concepts/08-session.md" \
  targetUri="viking://resources/pi-openviking/docs-ov/concepts/08-session.md" \
  reason="OV session docs (v{tag})"
```

Where `{tag}` is the release tag (e.g. `v0.3.23`) and the path comes from the table above.
