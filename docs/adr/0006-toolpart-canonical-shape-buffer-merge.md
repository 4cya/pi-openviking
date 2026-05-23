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
