# Plano de Implementação — pi-openviking Reborn

> Aprovado em 2026-05-24.
> Rewrite do zero. Código atual em `src/_legacy/`. Nova arquitetura hexagonal.

## Fases

| # | Nome | Entrega |
|---|------|---------|
| **1** | **Foundation** | Config (Zod schema + cascade + built-in profiles). DI container. Logger. Zero OV dependency. |
| **2** | **Domain + Ports** | Interfaces (`KnowledgeBase`, `SessionStore`, `FsStore`). Domain value objects. Sem HTTP. |
| **3** | **OV Adapter** | Transport. `OpenVikingAdapter` implements Ports. Testável com mock OV. |
| **4** | **Operations** | `searchOp`, `readOp`, `browseOp`, `commitOp`, `importOp`, `deleteOp` via Ports. |
| **5** | **Tools + Commands** | 6 MCP tools + 6 CLI commands thin. Pi extension entry. Bootstrap wiring. **Primeiro momento verdade.** |
| **6** | **Auto-Recall + Session Sync** | Recall pipeline. Session sync. Health check + graceful degradation. |
| **7** | **Profiles + Context Detection** | ContextProfiler, auto-detect per workspace, `/ov-profile` cmd. |
| **8** | **Features** | Intent detection, auto-actions, graph, glob/grep, backup, etc. |

## Decisões

- Rewrite from scratch, `src/_legacy/` mantido como referência
- Config com Zod schema + cascade (env → settings.json → profile)
- 4 perfis built-in: `default`, `web-dev`, `docs`, `learning`
- Ports & Adapters hexagonal explícitos (interfaces + implementations)
- DI container manual ou Awilix (decidir na Fase 1)
- Pi events conectados via bridge adapter

## Critério de avanço

Cada fase funcional + testável antes de iniciar próxima.
