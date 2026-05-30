# Itens Deferidos

Decisões de arquitetura ou débitos técnicos identificados durante F1 Review,
postergados para fases futuras intencionalmente.

---

## F1.8 — ProfileManager (esqueleto)

| Campo | Valor |
|-------|-------|
| **Deferido de** | F1 |
| **Deferido para** | F7a |
| **Motivo** | Profile = value object (não aggregate root). Sem consumidor até F7a (quando recall e intent consomem profile). Esqueleto não criado em F2. |
| **Referência** | `docs/02-PLANO.md` — tarefa F1.8 original dizia "Perfil como aggregate root". Sessão 2 do Grill redefiniu Profile como value object. Esqueleto não criado. |
| **Artefato esperado** | `domain/profile/service/ProfileManager.ts` |
| **Arquitetura decidida** | Grill Session 2: Profile = value object. ProfileManager recebe `ResolvedConfig` injetado, não importa outros contexts. |
| **Status** | Pendente |

---

## ~~`index.ts` — `init()` retorno descartado~~ **RESOLVIDO em F5.1**

| Campo | Valor |
|-------|-------|
| **Deferido de** | F1 |
| **Resolvido em** | F5.1 (issue #68) |
| **Motivo** | Nenhum consumidor do container/config/logger até F5. |
| **Arquivo** | `src/index.ts` |
| **Problema** | `await init(ctx.cwd)` retorna `{ config, logger, container }` mas o valor era descartado. |
| **Fix aplicado** | `session_start` handler captura `{ config, logger, container }`, resolve KB via `container.resolve<KnowledgeBase>()`, cria pipelines tipados com LoggingMiddleware, instancia SearchService, registra tools via `pi.registerTool()`. 11 singletons no container. |
| **Status** | **RESOLVIDO** |

---

## ~~Legado: `src/_legacy/` + `tests/_legacy/`~~ **RESOLVIDO**

Removido em F3 Review (2026-05-27). Cobertura integral migrada para `src/`.
`src/_legacy/` e `tests/_legacy/` deletados.
