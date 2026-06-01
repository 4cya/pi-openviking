# pi-openviking — Índice de Documentação

> Projeto: Extensão Pi para OpenViking (motor de memória persistente)
> Arquitetura: Hexagonal (Ports & Adapters)
> Estratégia: Rewrite do zero. Código legado (`src/_legacy/`) removido em F3 (2026-05-27).

## Documentos ativos

| # | Documento | Conteúdo | Para que serve |
|---|-----------|----------|----------------|
| 00 | `00-VISAO.md` | O que é o projeto, propósito, conceitos básicos | Onboarding rápido |
| 01 | `01-ARQUITETURA.md` | Arquitetura hexagonal: camadas, ports, patterns, módulos, fluxos | Implementar o sistema |
| 02 | `02-PLANO.md` | 8 fases de implementação, tarefas, dependências, milestones | Organizar o trabalho |
| 03 | `03-PROFILES.md` | Sistema de profiles: schema, resolução, auto-detect, consumo | Implementar profiles |
| [CONTEXT.md](../CONTEXT.md) | Glossário do domínio (termos e definições) | ✅ Purificado (só glossário) |
| `docs/adr/` | Decisões arquiteturais | ✅ ADR-002, ADR-008, ADR-010 criados |

## Features F8 (GraphExpander + /ov-delete glob)

### GraphExpander (`src/domain/recall/graph-expander.ts`)

Optional expansion layer injetado no `RecallCurator`. Quando ativado via config `expandGraph: true`, percorre relações OV a partir dos seeds do recall para injetar recursos relacionados no contexto.

**Comportamento:**
- Depth = 1 (vizinhos diretos via `graphStore.graph(uri)`)
- Top-3 seeds com score >= `expandGraphMinSeedScore` (default 0.4)
- Score decaído: `seed.score × 0.8`
- Budget: max `expandGraphMaxRatio` (default 20%) do budget original
- Dedup: pula relations que já são seeds
- Prioridade: relations com `reason` mais longo primeiro quando budget insuficiente
- Merge: graph items são mesclados aos seeds, ordenados por score desc

**Config:**
```
expandGraph: boolean          # default false
expandGraphDepth: 1           # literal 1 (vizinho direto)
expandGraphMaxRatio: 0.2      # max 20% do budget
expandGraphMinSeedScore: 0.4  # score mínimo para seed
expandGraphMaxRatio: number
```

### /ov-delete com glob (`src/adapters/driver/pi-commands/ov-delete-command.ts`)

O comando `/ov-delete` aceita glob patterns:
- `/ov-delete viking://resources/temp/*` → lista matches, confirma contagem, deleta cada um
- Comportamento literal (URI exata) preservado
- Glob detectado automaticamente por wildcards (`*`, `?`, `[`)

## Documentos arquivados (`_archive/`)

> Documentos do plugin antigo mantidos como referência histórica.
> Não refletem a nova arquitetura.

| Documento | Motivo do arquivamento |
|-----------|------------------------|
| `gaps/` (13 arquivos) | Análise de deficiências do plugin legado. Não aplica ao rewrite. |
| `MANUAL_COMPLETO.md` | Visão hipotética do plugin completo. Útil como inspiração, não como especificação. |
| `ARQUITETURA_PLANO_IMPLEMENTACAO.md` | Misturava análise legada + proposta + plano. Substituído por 01+02+03. |
| `adr-legacy/` (7 ADRs) | Decisões do plugin antigo. Não aplicam ao rewrite. |

## Workflow de implementação

```
1. GRILL-WITH-DOCS → Valida arquitetura, cria CONTEXT.md + ADRs
2. TO-PRD         → Converte decisões validadas em PRD
3. TO-ISSUES      → Quebra PRD em issues implementáveis
4. TDD            → Implementa cada issue (red-green-refactor)
```
