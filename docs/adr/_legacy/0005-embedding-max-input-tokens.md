# Embedding `max_input_tokens` no OV Server Config

Mensagens grandes (>8192 tokens) enviadas ao OV server causavam loop infinito no circuit breaker: Docker Model Runner (bge-m3-q8_0) rejeita input que excede batch size 8192 → OV abre circuit breaker → re-enqueue → retry → loop. Aconteceu em 2026-05-10 e 2026-05-22.

Causa raiz: `ov.conf` não tinha `embedding.max_input_tokens`. Sem esse campo, OV envia texto completo ao embedding provider sem truncamento.

Decisão: adicionar `"max_input_tokens": 7168` no `embedding` block do `ov.conf`. OV trunca internamente antes de embeddar. Conteúdo completo fica preservado no session (usado pela VLM na extração de memória). Perda só no vetor de embedding — aceitável para busca semântica.

**Status**: superseded by Qwen3-Embedding migration (2026-05-22)

**Why superseded:** bge-m3 has 8192 token limit. `max_input_tokens: 7168` worked for file embedding (`embedding_utils.py`) but NOT for queue-based embedding (`TextEmbeddingHandler.on_dequeue`). The circuit breaker persisted because the queue path called `embed_compat(embedding_msg.message)` without truncation, regardless of config.

**Fix:** Migrated from bge-m3 (8192 tokens) to **Qwen3-Embedding 4B** (40960 tokens context, dim 2560, MTEB 69.45 vs 59.56). Model pulled via `docker model pull ai/qwen3-embedding:latest`. Config:
```json
"dense": {
    "model": "docker.io/ai/qwen3-embedding:latest",
    "dimension": 2560
}
```

Changes applied to `ov.conf` (2026-05-22):
- `max_input_tokens: 7168 → 32768` (guardrail, Qwen3 aguenta 41K)
- `max_concurrent: 4 → 2` (modelo 4B local, evitar sobrecarga)
- Added `"text_source": "summary_first"` (prioriza resumo se disponível)
- `dimension: 1024 → 2560` (Qwen3)
- `model: bge-m3 → qwen3-embedding:latest`

**Operation**: vector database rebuilt via `POST /api/v1/content/reindex` — 1774 records re-embedded with Qwen3, zero circuit breaker errors. 102 records failed due to RocksDB 65535-byte field limit (separate issue).

**Considered Options** (original ADR):
- Truncar client-side no `serializeContent` → rejeitado: OV perde conteúdo completo, extração de memória fica pior. ADR-003 (enriched session sync) é sobre preservar mais contexto.
- `max_input_tokens: 8192` (max exato do modelo) → rejeitado: OV estima tokens, não conta com tokenizer exato. Estimativa off-by-one pode causar o mesmo loop.
- `max_input_tokens: 4096` (default OV) → rejeitado: margem excessiva, desperdiça capacidade do modelo.
- `max_input_tokens: 7168` → rejeitado (retrospectivamente): não funcionava no queue path, circuit breaker continuava.

**Additional models tested:**
- `nomic-embed-text-v2-moe` — rejeitado: 512 token context, inviável
- `embeddinggemma` — não testado: mesmo limite 8192 do bge-m3

**Consequences** (após migração):
OV persiste a fila de embedding em SQLite (`~/.openviking/data/_system/queue/queue.db`). Se o circuit breaker abrir antes do fix ser aplicado, mensagens problemáticas ficam presas na fila — OV re-enqueue em loop infinito. OV não tem garbage collection para a fila.

Workaround (requer parar o container):
```bash
docker stop pi-openviking
docker run --rm -v ~/.openviking/data/_system/queue:/queue alpine:latest sh -c "rm -rf /queue/*"
docker start pi-openviking
```

Após migração para Qwen3, novas mensagens não causam circuit breaker (contexto 41K). Queue cleanup manual ainda necessária se fila contiver mensagens de épocas anteriores.
