# pi-openviking — Índice de Documentação

> Projeto: Extensão Pi para OpenViking (motor de memória persistente)
> Arquitetura: Hexagonal (Ports & Adapters)
> Estratégia: Rewrite do zero. Código legado em `src/_legacy/`.

## Documentos ativos

| # | Documento | Conteúdo | Para que serve |
|---|-----------|----------|----------------|
| 00 | `00-VISAO.md` | O que é o projeto, propósito, conceitos básicos | Onboarding rápido |
| 01 | `01-ARQUITETURA.md` | Arquitetura hexagonal: camadas, ports, patterns, módulos, fluxos | Implementar o sistema |
| 02 | `02-PLANO.md` | 8 fases de implementação, tarefas, dependências, milestones | Organizar o trabalho |
| 03 | `03-PROFILES.md` | Sistema de profiles: schema, resolução, auto-detect, consumo | Implementar profiles |
| — | `CONTEXT.md` | Glossário do domínio (termos e definições) | **Será criado pelo grill-with-docs** |
| — | `adr/` | Decisões arquiteturais (ADR-0010 em diante) | **Serão criados pelo grill-with-docs** |

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
