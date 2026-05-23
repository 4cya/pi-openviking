# Auditoria: pi-openviking vs. OpenViking Oficial

**Data:** 2026-05-22
**Versão auditada:** pi-openviking 0.1.0 / OpenViking 0.1.18
**Referência oficial:** https://github.com/volcengine/OpenViking

---

## 1. Cobertura de Objetivos

### O que o OpenViking se propõe a resolver

OpenViking é um **context database para AI Agents** com 5 pilares:

1. **Filesystem Management Paradigm** — Context unificado via `viking://` URI (memories, resources, skills)
2. **Tiered Context Loading** — L0 (abstract ~100 tok), L1 (overview ~2k tok), L2 (full content)
3. **Directory Recursive Retrieval** — Busca semântica + navegação filesystem combinadas
4. **Observable Context** — Query plan, retrieval trajectory visualization
5. **Automatic Session Management** — Commit → archive → summary → memory extraction (self-iteration)

### Resposta do plugin

| Pilar | Cobertura | Status |
|-------|-----------|--------|
| Filesystem paradigm | Navegação completa (ls/tree/stat), URI-based | ✅ Total |
| Tiered loading (L0/L1/L2) | memread com auto/abstract/overview/read | ✅ Total |
| Semantic search + fs | find + search (fast/deep), target_uri scoping | ✅ Total |
| Observable context | `query_plan` retornado mas não formatado | ⚠️ Parcial |
| Session → memory extraction | commit → task_id → poll → extraction | ✅ Total |

**Veredito:** O plugin resolve o problema central. Cada pilar principal está coberto. Gaps são em features secundárias (observabilidade, tracking de uso, watches).

---

## 2. Funcionalidades Documentadas — Comparação API

### 2.1 Endpoints REST: Alinhamento ✅

| Endpoint OV Oficial | pi-openviking | Status |
|---------------------|---------------|--------|
| `POST /api/v1/sessions` | `session-ops.ts → createSession()` | ✅ |
| `POST /api/v1/sessions/{id}/messages` | `session-ops.ts → sendMessage()` | ✅ |
| `POST /api/v1/sessions/{id}/commit` | `session-ops.ts → commit()` | ✅ |
| `GET /api/v1/tasks/{id}` | `client.ts → getTaskStatus()` | ✅ |
| `POST /api/v1/search/find` | `client.ts → search()` (fast mode) | ✅ |
| `POST /api/v1/search/search` | `client.ts → search()` (deep mode) | ✅ |
| `GET /api/v1/content/{level}?uri=` | `client.ts → read()` | ✅ |
| `GET /api/v1/fs/ls?uri=` | `fs-ops.ts → fsList()` | ✅ |
| `GET /api/v1/fs/tree?uri=` | `fs-ops.ts → fsTree()` | ✅ |
| `GET /api/v1/fs/stat?uri=` | `fs-ops.ts → fsStat()` | ✅ |
| `DELETE /api/v1/fs?uri=` | `client.ts → deleteWithRecursiveFallback()` | ✅ |
| `POST /api/v1/resources` | `client.ts → addResource()` | ✅ |
| `POST /api/v1/skills` | `client.ts → addResource()` (kind=skill) | ✅ |
| `POST /api/v1/resources/temp_upload` | `client.ts → tempUpload()` | ✅ |
| `GET /health` | `health.ts → check()` | ✅ |

### 2.2 Headers: Alinhamento ✅

| Header OV | Transport | Status |
|-----------|-----------|--------|
| `X-API-Key` | `transport.ts` — sempre enviado | ✅ |
| `X-OpenViking-Account` | `transport.ts` — sempre enviado | ✅ |
| `X-OpenViking-User` | `transport.ts` — sempre enviado | ✅ |
| `Content-Type: application/json` | Auto para JSON, omitido para FormData/Binary | ✅ |

---

## 3. Gaps — Funcionalidades Ausentes ou Incompletas

### GAP-1: `session_used()` — Tracking de Contexto Consumido (Médio)

**Doc oficial:** `await client.session_used(session_id, contexts=[ctx.uri])` — registra quais contextos/skills o agente efetivamente usou.

**Plugin:** Não implementado. Nenhum rastreamento de quais recursos foram consumidos pelo agente.

**Impacto:** OV não sabe quais recursos foram realmente úteis → qualidade de ranking futura degradada. O mecanismo de self-improvement do OV fica cego.

**Arquivos afetados:** `src/session-sync/session.ts`, `src/ov-client/session-ops.ts`

---

### GAP-2: `grep` / Busca Léxica (Baixo)

**Doc oficial:** CLI `ov grep "term" --uri viking://path` — busca léxica em conteúdo.

**Plugin:** Não implementado. Apenas busca semântica (find/search).

**Impacto:** Baixo — busca semântica cobre maioria dos casos. Mas para buscas exatas (nomes de função, erros específicos), grep seria mais preciso.

---

### GAP-3: `Watch` / Monitoramento de Recursos (Baixo)

**Doc oficial:** `add_resource(path, watch_interval=N)` → OV re-importa periodicamente. CRUD via `/api/v1/watches`.

**Plugin:** Não implementado. Imports são one-shot.

**Impacto:** Baixo — watch é feature avançada, útil para documentação que muda frequentemente.

---

### GAP-4: `ContextPart` em Mensagens de Sessão (Médio)

**Doc oficial:** Part types suportados: `TextPart`, `ContextPart` (URI + abstract), `ToolPart` (input + output).

**Plugin:** Apenas `TextPart` (`type: "text"`) e `ToolPart` (`type: "tool_use"`) são enviados. `ContextPart` nunca é enviado — o plugin não rastreia quais recursos OV foram usados na resposta.

**Localização:**
- `src/session-sync/session.ts:serializeContent()` — só mapeia `text` e `toolCall`
- `src/ov-client/types.ts` — `Part = TextPart | ToolPart` (sem ContextPart)

**Comportamento esperado:** Quando o agente usa dados de um recurso OV na resposta, enviar `ContextPart` com a URI e abstract. Isso melhora a qualidade de memória extraída pelo OV.

---

### GAP-5: Query Plan Visibility (Baixo)

**Doc oficial:** Search retorna `query_plan` e `query_results` com detalhes do plano de busca.

**Plugin:** `query_plan` é retornado no JSON do `memsearch` mas:
- Não é formatado para leitura humana
- Não é exposto no `/ov-search` command
- Auto-recall ignora completamente

**Localização:** `src/tools/search.ts` — payload inclui `query_plan` se presente, mas é JSON cru.

---

### GAP-6: Reranking Server-Side (Informativo — Decisão Intencional)

**Doc oficial:** OV suporta reranking via API (THINKING mode).

**Plugin:** Confia no scoring do OV + curadoria local multi-fator (`recall-curator.ts`). Sem reranking server-side.

**Avaliação:** Decisão documentada e justificável. O curator local (multi-factor scoring com lexical overlap, leaf boost, temporal boost, preference boost) é adequado para o caso de uso do Pi.

---

### GAP-7: Auto-Commit (Informativo — Decisão Intencional)

**Doc oficial (OpenClaw plugin):** Auto-commit threshold-based quando sessão cresce.

**Plugin:** Commit é exclusivamente manual (`/ov-commit` ou `memcommit`).

**Avaliação:** Decisão documentada. Pi owns session history → auto-commit não é necessário.

---

## 4. Incoerências Funcionais

### INC-1: `toolResult` Enviado como String, Não como Part[]

**Localização:** `src/session-sync/session.ts:serializeToolResult()`

**Comportamento atual:**
```typescript
serialized = this.serializeToolResult(message as unknown as ToolResultMessage);
// Retorna string: "[tool: search, error: false]\ncontent..."
```

**Comportamento esperado pela API OV:**
```json
{
  "role": "assistant",
  "parts": [
    {"type": "tool", "tool_id": "call_123", "tool_name": "search", "tool_input": {...}, "tool_output": "..."}
  ]
}
```

**Problema:** Tool results são serializados como string truncada (500 chars) com formato ad-hoc `[tool: name, error: bool]\ncontent`. OV recebe isso como `content` simples, não como `parts` estruturado. OV perde a capacidade de entender estrutura de tool calls na memória extraída.

**Severidade:** Média. A extração de memória do OV trabalha com dados menos estruturados.

---

### INC-2: `ToolPart` Usa `type: "tool_use"` em Vez de `type: "tool"`

**Localização:** `src/ov-client/types.ts`
```typescript
export interface ToolPart {
  type: "tool_use";  // ← pi-openviking
  id: string;
  name: string;
  input: Record<string, unknown>;
}
```

**Doc oficial OV:**
```json
{"type": "tool", "tool_id": "call_123", "tool_name": "search", "tool_input": {...}}
```

**Divergências:**
| Campo | pi-openviking | OV Oficial |
|-------|---------------|------------|
| `type` | `"tool_use"` | `"tool"` |
| `id` | `"id"` | `"tool_id"` |
| `name` | `"name"` | `"tool_name"` |
| `input` | `"input"` | `"tool_input"` |
| `output` | ausente | `"tool_output"` |
| `status` | ausente | `"tool_status"` |

**Severidade:** Alta. O servidor OV pode não reconhecer `type: "tool_use"` como um part de tool. Isso significa que tool calls NUNCA são corretamente parseados pelo OV server. Mensagens com `parts: [{type: "tool_use", ...}]` podem ser rejeitadas ou ignoradas.

**NOTA:** O session-sync tem fallback — quando só há text parts, envia como string simples (`content: "..."`). O `type: "tool_use"` só é usado quando há tool calls misturados com texto. Em muitos casos, o fallback de string mascara este bug.

---

### INC-3: `role: "toolResult"` Não Deveria Ser Enviado ao OV

**Localização:** `src/session-sync/session.ts:onMessageEnd()`
```typescript
if (message.role !== "user" && message.role !== "assistant" && message.role !== "toolResult") return;
```

**Doc oficial OV:** Roles suportados: `"user"`, `"assistant"`. Tool results são modelados como parts dentro de mensagens assistant, não como roles separados.

**Problema:** O plugin envia `role: "toolResult"` com conteúdo serializado como string. OV pode rejeitar ou interpretar incorretamente.

**Severidade:** Média. Depende de como o OV server lida com roles desconhecidos — pode ignorar silenciosamente ou causar erro.

---

### INC-4: `fsStat` Retorna `abstract: raw.name` em Vez do Abstract Real

**Localização:** `src/ov-client/fs-ops.ts:fsStat()`
```typescript
return {
  uri,
  children: [{ uri, type: entryType, abstract: raw.name }], // ← usa `name` como abstract
};
```

**Problema:** `abstract` é preenchido com `raw.name` (o nome do arquivo/diretório), não com o abstract L0 real do recurso. Quando `memread` com `level: "auto"` chama `fsStat` para determinar se é diretório, recebe um "abstract" inútil.

**Severidade:** Baixa. O abstract do fsStat só é usado internamente pelo memread para decidir nível. O conteúdo real vem da chamada `/api/v1/content/{level}`.

---

### INC-5: `memread` Auto-Detect Level Via `stat.children[0]`

**Localização:** `src/tools/read.ts`
```typescript
if (resolvedLevel === "auto") {
  const stat = await deps.fs.fsStat(params.uri, signal);
  const entry = stat.children?.[0];
  resolvedLevel = entry?.type === "directory" ? "overview" : "read";
}
```

**Problema:** `fsStat` retorna sempre exatamente 1 child (a própria entrada). A lógica está correta funcionalmente, mas é frágil — depende de um contrato não documentado de que `children[0]` existe e representa a entrada consultada.

**Severidade:** Baixa. Funciona na prática.

---

### INC-6: `sendMessage` Envia `role` Incluindo `"toolResult"`

**Localização:** `src/session-sync/session.ts:onMessageEnd()` → `client.sendMessage(sessionId, role, contentToSend)`

**API OV espera:** role = `"user"` | `"assistant"`.

**Plugin envia:** role = `"user"` | `"assistant"` | `"toolResult"`.

**Severidade:** Média. Pode causar erros 400 ou armazenamento incorreto no OV.

---

## 5. Qualidade de Implementação — Pontos Fortes

| Aspecto | Avaliação |
|---------|-----------|
| **Arquitetura em camadas** | Excelente. Operations → Tools/Commands → OV Client → Transport. Separação limpa. |
| **Graceful degradation** | Health check com recovery automático. Circuit breaker em session sync. |
| **Auto-recall** | Multi-factor scoring robusto (relevance + leaf + temporal + preference + lexical). |
| **Import** | Suporta URL, arquivo local, diretório (zip automático). |
| **Config cascade** | Settings → env → defaults. Bem estruturado. |
| **Transport** | Timeout duplo (config + por-request), abort signal propagation, FormData/binary support. |
| **Session sync** | Fire-and-forget com queue serial, circuit breaker, recovery. |
| **Delete verification** | Verifica se recurso ainda aparece em search pós-delete. |

---

## 6. Tabela Resumo de Severidade

| ID | Descrição | Severidade | Tipo |
|----|-----------|------------|------|
| INC-2 | ToolPart: type/tool_id/tool_name/tool_input divergem da API OV | **Alta** | Incoerência |
| INC-1 | toolResult enviado como string truncada, não como Part estruturado | **Média** | Incoerência |
| INC-3 | role "toolResult" enviado ao OV (não documentado) | **Média** | Incoerência |
| INC-6 | Mesmo que INC-3 (role não-POV) | **Média** | Incoerência |
| GAP-1 | session_used() não implementado | **Média** | Gap |
| GAP-4 | ContextPart nunca enviado | **Média** | Gap |
| GAP-5 | query_plan não formatado | **Baixa** | Gap |
| INC-4 | fsStat usa name como abstract | **Baixa** | Incoerência |
| GAP-2 | grep/lexical search ausente | **Baixa** | Gap |
| GAP-3 | Watches não implementado | **Baixa** | Gap |
| GAP-6 | Sem reranking server-side | **Info** | Decisão |
| GAP-7 | Sem auto-commit | **Info** | Decisão |

---

## 7. Recomendações Priorizadas

### P0 — Corrigir Imediatamente

1. **INC-2: Alinhar ToolPart com API oficial**
   - `types.ts`: Mudar `type: "tool_use"` → `type: "tool"`, renomear campos
   - Adicionar `tool_output` e `tool_status` ao ToolPart
   - Testar com OV server para confirmar parse correto

### P1 — Próximo Sprint

2. **INC-1/INC-3: Reformular envio de tool results**
   - Tool results devem ser enviados como `parts` na mensagem assistant, não como role separado
   - Incluir tool_output completo (ou com truncation maior que 500 chars)

3. **GAP-1: Implementar `session_used()`**
   - Adicionar tracking de quais recursos foram consumidos pelo agente
   - Chamar após cada auto-recall ou memread efetivo

4. **GAP-4: Implementar ContextPart**
   - Quando auto-recall injeta recursos e o agente os usa na resposta, enviar ContextPart

### P2 — Backlog

5. **GAP-5: Formatar query_plan no output**
6. **INC-4: Corrigir fsStat abstract**
7. **GAP-2: grep léxico (se houver demanda)**
8. **GAP-3: Watches (se houver demanda)**
