# Gap 09 — Observabilidade / Stats + Observer

## Definição

O OpenViking expõe endpoints de observabilidade:

**Stats:**
- `GET /api/v1/stats/memories` — estatísticas das memórias (total por categoria, tamanho, etc.)
- `GET /api/v1/stats/sessions/{session_id}` — estatísticas de uma sessão (tokens, mensagens, etc.)

**Observer (monitoramento interno do servidor):**
- `GET /api/v1/observer/filesystem` — estado do filesystem viking://
- `GET /api/v1/observer/lock` — locks ativos
- `GET /api/v1/observer/models` — modelos de IA carregados
- `GET /api/v1/observer/queue` — fila de processamento
- `GET /api/v1/observer/retrieval` — estatísticas de retrieval (embeddings, busca)
- `GET /api/v1/observer/system` — recursos do sistema (CPU, memória, disco)
- `GET /api/v1/observer/vikingdb` — estado interno do banco vetorial

**Console:**
- `GET /api/v1/console/audit` — logs de auditoria
- `GET /api/v1/console/context-commits` — histórico de commits
- `GET /api/v1/console/dashboard/summary` — resumo do dashboard
- `GET /api/v1/console/tokens` — série temporal de tokens

O pi-openviking **não expõe nenhum destes endpoints**. Não há como
o usuário ou agente obter métricas de saúde, uso ou desempenho do OV.

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Diagnóstico** | "Quantas memórias eu tenho?" ou "O OV está lento?" |
| **Capacidade** | "Quanto do espaço está sendo usado?" |
| **Debug de retrieval** | "Por que essa busca não achou o recurso X?" |
| **Monitoramento** | Opção `ov-status` no status bar do Pi com contagem de memórias |
| **Auditoria** | "Quem importou esse recurso?" (quando multi-usuário) |
| **Performance** | Verificar latência de queries de embedding |

## Importância e Impacto da Correção

### 🟢 Baixo — Informacional, não operacional

Stats e observer são úteis para diagnóstico e monitoramento, mas não
desbloqueiam novos padrões de uso do OV. Servem mais para o
desenvolvedor da extensão e para debugging.

### Impactos específicos:

1. **Caixa preta** — Se a busca não retorna resultados, não há como
   saber se é problema de embedding, de query, ou de dados.

2. **Sem métricas** — Não dá para medir quantas memórias foram criadas,
   quantos tokens consumidos, qual o hit rate do auto-recall.

3. **Debug difícil** — Problemas de performance (queries lentas) não
   têm visibilidade.

4. **Dashboard cego** — O console OV tem dashboard, mas o plugin não
   permite acessá-lo.

### Esforço estimado de implementação

```
Baixo (~2h)
├── src/operations/stats.ts      → statsOp(), observerOp()
├── src/commands/stats.ts        → /ov-stats (memórias), /ov-status (sistema)
├── src/ov-client/client.ts      → add stats + observer methods
├── src/shared/health.ts         → enriquecer health check com stats
└── src/bootstrap/register.ts    → registrar
```

### API OV necessária

```http
# Stats de memórias
GET /api/v1/stats/memories
Response: {
  "total_memories": 142,
  "by_category": { "events": 89, "preferences": 34, "entities": 19 },
  "total_resources": 27,
  "total_skills": 5,
  "storage_bytes": 245890
}

# Observer — sistema
GET /api/v1/observer/system
Response: {
  "cpu_usage": 0.23,
  "memory_mb": 456,
  "disk_mb": 1234,
  "uptime_seconds": 3600
}
```
