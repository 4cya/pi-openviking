# Embedding `max_input_tokens` no OV Server Config

Mensagens grandes (>8192 tokens) enviadas ao OV server causavam loop infinito no circuit breaker: Docker Model Runner (bge-m3-q8_0) rejeita input que excede batch size 8192 → OV abre circuit breaker → re-enqueue → retry → loop. Aconteceu em 2026-05-10 e 2026-05-22.

Causa raiz: `ov.conf` não tinha `embedding.max_input_tokens`. Sem esse campo, OV envia texto completo ao embedding provider sem truncamento.

Decisão: adicionar `"max_input_tokens": 7168` no `embedding` block do `ov.conf`. OV trunca internamente antes de embeddar. Conteúdo completo fica preservado no session (usado pela VLM na extração de memória). Perda só no vetor de embedding — aceitável para busca semântica.

**Status**: accepted

**Considered Options**:
- Truncar client-side no `serializeContent` → rejeitado: OV perde conteúdo completo, extração de memória fica pior. ADR-003 (enriched session sync) é sobre preservar mais contexto.
- `max_input_tokens: 8192` (max exato do modelo) → rejeitado: OV estima tokens, não conta com tokenizer exato. Estimativa off-by-one pode causar o mesmo loop.
- `max_input_tokens: 4096` (default OV) → rejeitado: margem excessiva, desperdiça capacidade do modelo.
- `max_input_tokens: 7168` → escolhido: 1024 tokens de margem contra estimativa imprecisa, captura ~87% da capacidade do modelo.

**Consequences**:
- Circuit breaker não dispara mais por oversized embedding input
- Conteúdo completo preservado no session (VLM usa tudo na extração)
- Vetores de embedding perdem conteúdo após ~7168 tokens — aceitável para busca
- Fix é server-side config only — zero mudança de código no pi-openviking

**Operational Note — Queue Cleanup**:
OV persiste a fila de embedding em SQLite (`~/.openviking/data/_system/queue/queue.db`). Se o circuit breaker abrir antes do fix ser aplicado, mensagens problemáticas ficam presas na fila — OV re-enqueue em loop infinito. OV não tem garbage collection para a fila.

Workaround (requer parar o container):
```bash
docker stop pi-openviking
docker run --rm -v ~/.openviking/data/_system/queue:/queue alpine:latest sh -c "rm -rf /queue/*"
docker start pi-openviking
```

Após `max_input_tokens: 7168` no config, novas mensagens não causam o problema. Mas se a fila já contiver mensagens oversized de antes do fix, limpeza manual é necessária.
