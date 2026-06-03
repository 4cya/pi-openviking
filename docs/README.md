# pi-openviking — Documentação

> Projeto: Extensão Pi para OpenViking (motor de memória persistente)
> Arquitetura: Hexagonal (Ports & Adapters)
> Status: F1–F7b completos, F8 parcial

## Documentos ativos

| # | Documento | Conteúdo | Público |
|---|-----------|----------|---------|
| — | [`README.md`](../README.md) | Visão geral, features, configuração, uso, troubleshooting | Usuários |
| — | [`CONTEXT.md`](../CONTEXT.md) | Glossário do domínio (termos e definições) | Desenvolvedores |
| — | [`UBIQUITOUS_LANGUAGE.md`](../UBIQUITOUS_LANGUAGE.md) | Glossário expandido com exemplos e ambiguidades | Desenvolvedores |
| 00 | [`00-VISAO.md`](./00-VISAO.md) | O que é o projeto, propósito, conceitos básicos | Onboarding rápido |
| 01 | [`01-ARQUITETURA.md`](./01-ARQUITETURA.md) | Arquitetura hexagonal: camadas, ports, patterns, módulos, fluxos | Implementar o sistema |
| 02 | [`02-PLANO.md`](./02-PLANO.md) | Histórico de implementação — 8 fases, tarefas, milestones | Referência histórica |
| ADR | [`docs/adr/`](./adr/) | Decisões arquiteturais (7 ADRs ativos) | Desenvolvedores |

## Documentos arquivados

Documentos mantidos como referência histórica em [`docs/_archive/`](./_archive/):

| Documento | Motivo do arquivamento |
|-----------|------------------------|
| `03-PROFILES.md` | Schema rico proposto NÃO implementado. O real (6 campos + ProfileManager) está em ADR-013 + código |
| `DEFERRED.md` | Todos os itens resolvidos. ProfileManager implementado em F7a |
| `prd/03-ov-adapter.md` | PRD da fase F3 — fase concluída |
| `prd/05-tools-and-commands.md` | PRD da fase F5 — fase concluída |

## Workflow de desenvolvimento

```
1. GRILL-WITH-DOCS → Valida arquitetura, cria CONTEXT.md + ADRs
2. TO-ISSUES      → Quebra em issues implementáveis
3. TDD            → Implementa cada issue (red-green-refactor)
```
