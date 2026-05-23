# ToolPart Canonical Shape + Buffer-and-Merge

## Status

accepted

## Context

pi-openviking enviava tool calls com `{ type: "tool_use", id, name, input }` e tool results como `role: "toolResult"` com string serializada. OV's `from_dict()` não reconhece `type: "tool_use"` nem `role: "toolResult"` — ambos caem no fallback string. Resultado: extração de memória perde TODA a estrutura de tool calls. Bug silencioso — servidor aceita, dados degradam.

Empirical test confirmou: servidor retorna 200 OK para qualquer shape. Dano é na extração de memória, não na ingestão.

## Decisions

### D1: ToolPart fields alinhados 1:1 com OV canonical shape

Renomear todos os campos para match exato com `openviking/message/part.py`:

| Antes | Depois |
|-------|--------|
| `type: "tool_use"` | `type: "tool"` |
| `id` | `tool_id` |
| `name` | `tool_name` |
| `input` | `tool_input` |

Campos adicionados (populated onde disponível, default vazio otherwise):

- `tool_output: string` — resultado do tool
- `tool_status: string` — "success" \| "error"
- `tool_output_truncated: boolean` — true quando resultado excedeu truncation
- `tool_uri: string` — session tool file URI (vazio por enquanto)
- `skill_uri: string` — skill URI reference (vazio por enquanto)
- `duration_ms: number | null`
- `prompt_tokens: number | null`
- `completion_tokens: number | null`
- `tool_output_ref: string` — externalization ref (deferido)

Rationale: custo zero em adicionar campos com defaults. Future-proof para `session.used()` e externalização.

### D2: Buffer-and-merge para tool calls + results

#### Incomplete buffer flush

Quando nova assistant message chega enquanto buffer ainda tem tool calls pendentes (resultados não recebidos):
1. Sintetiza `ToolPart(tool_status: "error", tool_output: "[interrompido - resultado não recebido]")` para cada call pendente
2. Flushed mensagem inteira — ToolParts com resultados reais + sintéticos — como única `sendMessage(role: "assistant")`
3. `logger.warn("flushing incomplete buffer: ${pendingIds}")` para observabilidade
4. Inicia novo buffer para nova assistant message

Rationale: pi-core garante call-result pairing (sempre emite ToolResultMessage real ou sintético para erro/block). Cenário de buffer incompleto é raro (crash, edge case do agent loop). Mas foco em não perder conteúdo — dados parciais que já temos são preservados, calls pendentes ficam com status explícito de interrupção. OV extractor sempre vê arcos completos call→result, nunca status "pending" em dados persisted.

Quando `onMessageEnd` recebe assistant message com tool calls:
1. Buffer a message (parts + tool call IDs)
2. Quando `toolResult` chega (match por tool call ID), adiciona `ToolPart(tool_output, tool_status)` ao buffer
3. Quando todos os tool calls pendentes têm resultados, envia única `sendMessage(role: "assistant", Part[])` com calls + results

Elimina `role: "toolResult"`. OV só vê `assistant` + `user`.

Rationale: OV memory extraction trabalha por mensagem. Tool call + resultado na mesma mensagem = arco ação→resultado completo para o extractor.

Trade-off: introduz estado (pending tool calls), potencial perda em crash. Aceitável — sync já é best-effort e async.

### D3: Truncation híbrido — 2000 chars + truncated flag

Aumentar truncation de 500 → 2000 chars. Quando excedido, set `tool_output_truncated: true`. Externalização completa via `tool_output_ref` deferida.

Rationale: 500 chars corta resultados significativos. 2000 cobre maioria dos casos. Flag sinaliza perda. Externalização pode ser adicionada quando API for documentada.

### D4: ContextPart + session.used() deferidos

ContextPart (`type: "context"`) e `session.used()` resolvem o mesmo problema (tracking de consumo de recursos). Implementar juntos como feature coesa. Detectar quais recursos injetados o agente usou requer heurística (scan de response para URI/abstract matches) ou solução simples (enviar todos injetados). Decisão de detection strategy fica para a implementação dessa feature.

### D5: Sessões existentes — não migrar

Sessões OV existentes com formato `tool_use` já perderam estrutura (stored como string). Dano já feito. Sem API interna do OV para reescrever. Fix going forward only.

### D6: Sempre `Part[]` — user e assistant

Todas as mensagens enviadas como `Part[]`, sem exceção. User messages → `Part[TextPart]`. Assistant messages → `Part[TextPart, ToolPart, ...]`. Elimina `string | Part[]` branching em `sendMessage`. Consistência para OV extractor. Future-proof para ContextPart.

### D7: `sendMessage` narrowed para `content: Part[]` apenas

`SessionClient.sendMessage(sessionId, role, content: Part[], signal?)` — string eliminada do tipo. Impossível enviar formato errado.

### D8: Buffer único

Um slot: `pendingBuffer: { parts: Part[], pendingToolIds: Set<string> } | null`. Agente pi é sequencial por turno — nunca duas assistant messages em buffer simultaneamente. Se buffer ocupado quando nova assistant chega, dispara incomplete flush (D2) e substitui.

### D9: Orphan tool results descartados

`toolResult` com buffer vazio → descartar + `logger.warn`. Sem buffer, não temos `tool_input` para construir ToolPart completo. Pi-core garante call-result pairing — órfãos são bugs, não fluxo normal.

### D10: Thinking descartado (unchanged from ADR-003)

Metacognição não é ação. Infla sessão com ruído.

### D11: `tool_status` values

- `isError: false` → `"success"`
- `isError: true` → `"error"`
- Synthetic (missing result) → `"error"` + `"[interrompido - resultado não recebido]"`
- `"pending"` nunca enviado — default only, always overwritten

### D12: Ordem natural dos Parts

Parts preservados em ordem de aparição no `AssistantMessage.content`. TextParts e ToolCalls já intercalados. Resultos merged nos ToolParts existentes. Sem reordering.

### D13: Apenas `message_end` processado

Buffer opera em `message_end` apenas. `message_start` e `message_update` ignorados. Streaming deltas são parciais — buffer precisa mensagem completa.

### D14: `duration_ms`, `prompt_tokens`, `completion_tokens` sempre null

Extrair `duration_ms` requereria hook em `tool_execution_start`/`tool_execution_end` (novo event listener). Token counts requerem provider-level access. Deferido — revisit se OV extractor usar estes campos.

## Considered Options

- **Tool result como mensagem separada com role "toolResult"** → rejeitado: OV não tem esse role, fallback string
- **Tool result como role "user"** → rejeitado: OV atribuiria ações de ferramenta ao usuário
- **Truncation 500 chars** → rejeitado: corta resultados significativos
- **Externalização completa agora** → rejeitado: API não documentada, complexidade alta
- **ContextPart sem session.used()** → rejeitado: meia-solução, melhor implementar juntos
- **Migração de sessões antigas** → rejeitado: sem API, dano já feito

## Consequences

- Tool calls + results agora preservam estrutura completa → extração de memória significativamente melhor
- `types.ts` `ToolPart` interface muda radicalmente — breaking change interna
- `session.ts` `serializeContent` e `serializeToolResult` são reescritos — `serializeToolResult` deixa de existir, lógica mergeia no buffer
- Novo estado: mapa de tool call IDs pendentes em `SessionSync`
- `TOOL_RESULT_MAX_CHARS` sobe de 500 → 2000
- Sessões existentes em OV ficam em formato antigo — sem migração
