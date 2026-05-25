# Gaps do pi-openviking — Sumário

> Estado atual: servidor OV v0.3.19 rodando, ~18/85 endpoints mapeados.
> 12 gaps documentadas: 2 críticas, 4 médias, 6 baixas.

## Matriz de Prioridade

| # | Gap | Prioridade | Esforço | Tipo |
|---|-----|-----------|---------|------|
| 01 | **memsave** — Write-back de conteúdo | 🔴 Crítico | ~2h | Nova funcionalidade |
| 03 | **memlink** — Grafo de relações | 🔴 Crítico | ~6h | Nova funcionalidade |
| 02 | **memmkdir + memmv** — Operações de diretório | 🟡 Médio | ~2h | Nova funcionalidade |
| 04 | **memglob + memgrep** — Busca por padrão/conteúdo | 🟡 Médio | ~2h | Nova funcionalidade |
| 05 | **Auto-recall sem escopo** (target_uri) | 🟡 Médio | ~1.5h | Melhoria existente |
| 12 | **Config não otimizada** | 🟡 Médio | ~0.5h | Ajuste |
| 07 | **ov-pack** — Backup e restore | 🟡 Médio | ~2h | Nova funcionalidade |
| 06 | **memdownload** | 🟢 Baixo | ~0.5h | Nova funcionalidade |
| 08 | **Watches** | 🟢 Baixo | ~3h | Nova funcionalidade |
| 09 | **Stats + Observer** | 🟢 Baixo | ~2h | Nova funcionalidade |
| 10 | **Batch operations** | 🟢 Baixo | ~2h | Melhoria existente |
| 11 | **memreindex** | 🟢 Baixo | ~0.5h | Nova funcionalidade |

## Mapa de Endpoints OV vs Implementação

```
Usado (18)    │  Não usado (67)  
──────────────┼──────────────────────────────
/health       │  /content/write        ← gap 01
/sessions     │  /content/reindex      ← gap 11
/messages     │  /content/download     ← gap 06
/commit       │  /fs/mkdir             ← gap 02
/tasks        │  /fs/mv                ← gap 02
/used         │  /relations/*          ← gap 03
/content/abstract  │  /search/glob     ← gap 04
/content/overview  │  /search/grep     ← gap 04
/content/read │  /pack/*               ← gap 07
/fs/ls        │  /watches/*            ← gap 08
/fs/tree      │  /stats/*              ← gap 09
/fs/stat      │  /observer/*           ← gap 09
/fs (DELETE)  │  /console/*            ← gap 09
/search/find  │  /admin/*              ← (admin)
/search/search│  /privacy-configs/*    ← gap (futuro)
/resources    │  /webdav/*             ← (nicho)
/resources/temp_upload │ /bot/*        ← (n/a)
/skills       │  /debug/*              ← (dev)
              │  /system/*             ← gap 09
              │  /relations/*          ← gap 03
```

## Links para Documentos Individuais

- [Gap 01 — memsave / Write-Back](docs/gaps/01-memsave-write-content.md)
- [Gap 02 — memmkdir + memmv](docs/gaps/02-memmkdir-memmv.md)
- [Gap 03 — memlink / Grafo de Relações](docs/gaps/03-memlink-graph.md)
- [Gap 04 — memglob + memgrep](docs/gaps/04-memglob-memgrep.md)
- [Gap 05 — Auto-recall sem escopo](docs/gaps/05-auto-recall-target-uri.md)
- [Gap 06 — memdownload](docs/gaps/06-memdownload.md)
- [Gap 07 — ov-pack / Backup](docs/gaps/07-ov-pack-backup.md)
- [Gap 08 — Watches](docs/gaps/08-watches.md)
- [Gap 09 — Stats / Observer](docs/gaps/09-stats-observer.md)
- [Gap 10 — Batch Operations](docs/gaps/10-batch-operations.md)
- [Gap 11 — memreindex](docs/gaps/11-memreindex.md)
- [Gap 12 — Config Otimizada](docs/gaps/12-config-optimization.md)
