# ADR-014: F8 scope reduction — 5 tasks eliminated, 3 kept

Grill 2026-06-01. Revisão de F8 contra a documentação real do OV v3 e o estado do codebase (F1-F7a implementados). 5 de 9 tarefas originais foram eliminadas ou reduzidas.

## Escopo original vs realidade OV

| Tarefa | Decisão | Motivo |
|--------|---------|--------|
| F8.1 Auto-actions | ✅ Mantido | Analyzer (regex heurístico) + Proposer + Executor. Fallback agent namespace. |
| F8.2 GraphExpander | ✅ Mantido | Lê abstract de cada relation. Depth=1. Max 20% do budget. Score decaído 0.8×. |
| F8.3 Glob+Grep expand | ❌ Eliminado | Já implementado em F5.1. Todos parâmetros OV expostos. |
| F8.4 Batch delete | ✅ Reduzido | `/ov-delete <glob>` — expandir comando existente via glob. |
| F8.5 Pack export/import | ❌ Eliminado | OV CLI já suporta (`ov export`, `ov backup`). REST API não expõe. |
| F8.6 Watch operations | ❌ Eliminado | OV expõe watch só via MCP (`watch_interval`, `list_watches`). REST não tem. Documentar uso de OV CLI. |
| F8.7 MCP server export | ❌ Eliminado | OV já tem endpoint `/mcp` nativo com 15+ tools. Extensão não precisa implementar. |
| F8.8 Webhook handler | ❌ Eliminado | OV não tem webhooks (URL 404). Sem suporte no servidor. |
| F8.9 E2E + docs | ✅ Mantido | E2E tests + documentação de usuário. |

## Duração revisada

F8 original: 19 dias. Revisado: 15 dias (F8.1=5, F8.2=4, F8.4=1, F8.9=3, buffer=2).

## Dependência

F7b (7d) → F8 (15d). Auto-actions usam profile targetUri quando disponível; fallback agent namespace quando não.

## Consequências

- F8.7 (MCP) e F8.6 (Watch) são servidos nativamente pelo OV via seu endpoint `/mcp`. Clientes Pi podem conectar direto sem passar pela extensão.
- F8.5 (Pack) e F8.8 (Webhook) exigiriam mudanças no servidor OV — fora do escopo da extensão.
- F8.3 (Glob+Grep) já está completo desde F5. Manter no plano criaria confusão.
