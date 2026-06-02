# Auditoria Completa: pi-openviking vs OpenViking Oficial

**Data:** 2026-06-02
**Plugin:** pi-openviking v0.1.0
**Referência:** OpenViking `main` (volcengine/OpenViking)

---

## Sumário Executivo

| Aspecto | Nota | Status |
|---------|------|--------|
| Funcionalidades implementadas vs documentadas | 7/10 | 🟡 Gaps moderados |
| API / Endpoints mapeados | 8/10 | 🟡 Alguns endpoints ausentes |
| Correção dos headers/convenções | 6/10 | 🔴 `X-OpenViking-Agent` ausente |
| Message sync para sessões | 4/10 | 🔴 Tool calls perdidos |
| README vs implementação real | 5/10 | 🔴 Contradições e defaults errados |
| Testes | 9/10 | 🟢 Cobertura excelente |
| Tratamento de erros / resiliência | 8/10 | 🟢 Circuit breaker, retry, rate limit |

**Nota geral: 7/10** — Base sólida, gaps críticos em message sync e documentação.

---

## 1. Premissa Fundamental

OpenViking **não é** ferramenta de analytics (navegação, replay, eventos, performance).  
É **Context Database for AI Agents** — memória de longo prazo com filesystem paradigm (`viking://`), L0/L1/L2 tiers, semantic search, session commit, archive extraction.

✅ Nosso plugin está alinhado com o propósito real da biblioteca.  
❌ Premissa original do usuário (captura de navegação, replay, analytics) é incorreta.

---

## 2. Funcionalidades: Implementado vs Documentado

### 2.1 Tools (agente) — 6/6 implementados ✅

| Tool | Endpoint OV | Plugin | Status |
|------|------------|--------|--------|
| `ov_search` | `POST /api/v1/search/find` + `/search` | ✅ `find()` / `search()` | ✅ |
| `ov_glob` | `POST /api/v1/search/glob` | ✅ `glob()` | ✅ |
| `ov_grep` | `POST /api/v1/search/grep` | ✅ `grep()` | ✅ |
| `ov_read` | `GET /api/v1/content/{abstract,overview,read}` | ✅ L0/L1/L2 | ✅ |
| `ov_write` | `POST /api/v1/content/write`, `/fs/mkdir`, `/fs/mv` | ✅ save/mkdir/mv | ✅ |
| `ov_recall` | `find`/`search` + curator pipeline | ✅ multi-scorer, graph expander | ✅ |

### 2.2 Commands (usuário) — 8/8 implementados ✅

| Command | Status |
|---------|--------|
| `/ov-recall` | ✅ Toggle auto-recall |
| `/ov-status` | ✅ Config + health summary |
| `/ov-tree` (ov-ls) | ✅ Browse filesystem |
| `/ov-commit` | ✅ Commit session |
| `/ov-search` | ✅ Search formatado |
| `/ov-delete` | ✅ Delete entry |
| `/ov-profile` | ✅ Profile manager |
| `/ov-start` | ✅ Create session |

### 2.3 Missing vs OpenClaw (referência) 🔴

| Feature | OpenClaw | pi-openviking | Impacto |
|---------|----------|---------------|---------|
| `ov_archive_expand` | ✅ | ❌ | Não pode reconstruir archives |
| `ov_archive_search` | ✅ | ❌ | Não busca em archives |
| `memory_store` (explicit fact) | ✅ | ❌ | Só via session commit |
| `memory_forget` | ✅ | ❌ | Só via `ov_delete` genérico |
| `add_resource` (import doc/URL) | ✅ | ❌ | Só via `/ov-import` command |
| `add_skill` | ✅ | ❌ | Não exposto como tool |
| `openviking_tool_result_*` | ✅ | ❌ | Três tools de resultado |
| Multi-namespace search | ✅ | ❌ | User + agent namespace separados |
| Auto-commit threshold | ✅ | ❌ | Só manual ou session_shutdown |
| X-OpenViking-Agent header | ✅ | ❌ | Perde roteamento multi-agent |

---

## 3. API Endpoints: Mapeamento vs OV Docs

### 3.1 Implementados ✅

| Endpoint OV | Plugin | Notas |
|-------------|--------|-------|
| `POST /api/v1/sessions` | `sessionStore.create()` | ✅ |
| `POST /api/v1/sessions/{id}/messages` | `sessionStore.sendMessage()` | ✅ |
| `POST /api/v1/sessions/{id}/commit` | `sessionStore.commit()` | ✅ |
| `GET /api/v1/tasks/{taskId}` | `sessionStore.getTaskStatus()` | ✅ |
| `GET /api/v1/tasks` | `sessionStore.listTasks()` | ✅ |
| `POST /api/v1/sessions/{id}/used` | `sessionStore.sessionUsed()` | ✅ |
| `DELETE /api/v1/sessions/{id}` | `sessionStore.deleteSession()` | ✅ |
| `POST /api/v1/search/find` | `knowledgeBase.find()` | ✅ |
| `POST /api/v1/search/search` | `knowledgeBase.search()` | ✅ |
| `POST /api/v1/search/glob` | `knowledgeBase.glob()` | ✅ |
| `POST /api/v1/search/grep` | `knowledgeBase.grep()` | ✅ |
| `GET /api/v1/content/{abstract,overview,read}` | `fsStore.read()` | ✅ |
| `POST /api/v1/content/write` | `fsStore.write()` | ✅ |
| `GET /api/v1/fs/ls` | `fsStore.list()` | ✅ |
| `GET /api/v1/fs/tree` | `fsStore.tree()` | ✅ |
| `GET /api/v1/fs/stat` | `fsStore.stat()` | ✅ |
| `POST /api/v1/fs/mkdir` | `fsStore.mkdir()` | ✅ |
| `POST /api/v1/fs/mv` | `fsStore.mv()` | ✅ |
| `DELETE /api/v1/fs` | `fsStore.delete()` | ✅ |
| `GET /ready` | `healthCheck.check()` | ✅ |

### 3.2 Não Implementados 🔴

| Endpoint OV | Uso | Prioridade |
|-------------|-----|------------|
| `POST /api/v1/sessions/{id}/messages/batch` | Batch append de mensagens | 🔴 ALTA — performance |
| `GET /api/v1/sessions/{id}/context` | Obter contexto montado da sessão | 🟡 MÉDIA |
| `GET /api/v1/sessions/{id}/archives/{archive_id}` | Ler archive específico | 🟡 MÉDIA |
| `POST /api/v1/sessions/{id}/extract` | Extrair memórias sem commit | 🟡 MÉDIA |
| `GET /api/v1/content/download` | Download raw de arquivo | 🟢 BAIXA |
| `POST /api/v1/content/reindex` | Rebuild de índice semântico | 🟢 BAIXA |
| `GET /api/v1/system/status` | Status do servidor | 🟢 BAIXA |
| `POST /api/v1/system/wait` | Aguardar processamento | 🟢 BAIXA |
| `POST /api/v1/system/consistency` | Verificar consistência FS/vector | 🟢 BAIXA |
| `GET /health` | Health check (sem auth) | 🟢 BAIXA (já tem `/ready`) |

---

## 4. Headers e Convenções 🔴

### 4.1 Enviados ✅

| Header | No Transport | Status |
|--------|-------------|--------|
| `X-API-Key` | ✅ | Correto |
| `X-OpenViking-Account` | ✅ | Correto |
| `X-OpenViking-User` | ✅ | Correto |
| `Content-Type: application/json` | ✅ | Correto |

### 4.2 Ausentes ❌

| Header | OV Docs Exige | Plugin | Impacto |
|--------|---------------|--------|---------|
| `X-OpenViking-Agent` | ✅ Routing multi-agent | ❌ **Ausente** | 🔴 Perde identificação do agente |
| `Authorization: Bearer` | ✅ Método alternativo | ❌ | Usa X-API-Key (também válido) |

### 4.3 Config schema: `agent_id` ausente

```typescript
// Atual (schema.ts)
export const OVAdapterConfigSchema = z.object({
  endpoint, apiKey, account, user, timeout, commitTimeout,
  maxRetries, rateLimitPerSecond, circuitBreaker,
  // ❌ agent_id não existe
});

// Deveria incluir:
// agent_id: z.string().default("pi-coding-agent"),
```

---

## 5. GAP CRÍTICO: Message Sync 🔴🔴🔴

### 5.1 `agentMessageToParts()` só extrai texto

```typescript
// message-mapper.ts — atual
export function agentMessageToParts(msg: MessageInput): Part[] {
  if (msg.role !== "user" && msg.role !== "assistant") return [];

  const parts: Part[] = [];
  if (typeof msg.content === "string") {
    if (msg.content.trim().length > 0) {
      parts.push({ type: "text", text: msg.content });
    }
  } else if (Array.isArray(msg.content)) {
    for (const item of msg.content) {
      if (item.type === "text" && item.text?.trim().length > 0) {
        parts.push({ type: "text", text: item.text });
      }
    }
  }
  return parts;
}
```

### 5.2 Domain `Part` model suporta tudo, mas mapper ignora

```typescript
// part.ts — domain model completo
export interface ToolPart {
  type: "tool";
  toolId: string; toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: string; toolStatus: string;
  toolOutputTruncated: boolean;
  toolUri: string; skillUri: string;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  toolOutputRef: string;
}

export interface ContextPart {
  type: "context";
  uri: string;
  contextType: "memory" | "resource" | "skill";
  abstract: string;
}
```

### 5.3 Impacto

- ❌ **Tool calls** (tool_use/tool_result) são silenciosamente descartados
- ❌ **Context parts** (memories, resources injected) são perdidos
- ❌ Session no OV fica incompleta — só texto
- ❌ Memory extraction prejudicada — contexto rico perdido
- ❌ Archive reconstruction incompleta

### 5.4 Testes confirmam o gap

```typescript
// message-mapper.test.ts
it("returns empty array for tool messages", () => {
  // ✅ tool role retorna vazio — mas deveria extrair ToolPart!
  const parts = agentMessageToParts({ role: "tool", content: "some tool output" });
  expect(parts).toHaveLength(0);
});
```

---

## 6. GAP: Batch Messages 🔴

```typescript
// session-store.ts
async sendMessages(sessionId, messages, signal) {
  // ❌ Comentário admite: "No batch endpoint — send individually"
  for (const msg of messages) {
    await this.sendMessage(sessionId, msg.role, msg.content, signal);
  }
}
```

OV docs mostram `POST /api/v1/sessions/{id}/messages/batch` — endpoint existe.  
Plugin envia N requests individuais em série.

---

## 7. Contradições README vs Código 🔴

| Afirmação no README | Real (código) | Quem está certo? |
|---------------------|---------------|------------------|
| Health check usa `/health` | `health.ts` usa `/ready` | **Código** (`/ready` é readiness probe) |
| `onShutdown()` faz zero I/O | `session_shutdown` hook chama `commit()` | **README** desatualizado |
| `openVikingCommitTimeout` default `60000` | Schema default `120_000` | **Código** |
| `openVikingHealthPath` existe | Não está no schema | **README** inventa setting |
| `openVikingAutoRecallTokenBudget` default `700` | `recall.maxTokens` default `4000` | **Schema** |
| "Operations layer: `src/operations/`" | Diretório não existe (vazio) | **README** desatualizado |

---

## 8. Comparação Detalhada: OpenClaw vs pi-openviking

### 8.1 O que o OpenClaw tem que o pi-openviking não tem

| Funcionalidade | OpenClaw | pi-ov | Nota |
|---------------|----------|-------|------|
| `assemble()` context engine | ✅ | ❌ | Pi é source of truth (deliberado) |
| `compact()` handler | ✅ | ❌ | Pi gerencia próprio histórico |
| Threshold auto-commit | ✅ | ❌ | Só manual ou shutdown |
| `ov_archive_expand` | ✅ | ❌ | Pode ser útil p/ debug |
| `ov_archive_search` | ✅ | ❌ | Busca em archives comprimidos |
| `memory_store` tool | ✅ | ❌ | Persistência explícita de fato |
| `memory_forget` tool | ✅ | ❌ | Só `ov_delete` (mais genérico) |
| `add_resource` tool | ✅ | ❌ | Só via `/ov-import` command |
| `add_skill` tool | ✅ | ❌ | Não exposto |
| Tool result tools (3) | ✅ | ❌ | Read/search/list resultados |
| Multi-namespace search | ✅ | ❌ | Namespace único |
| X-OpenViking-Agent | ✅ | ❌ | Single agent (deliberado) |

### 8.2 O que pi-openviking tem que OpenClaw não tem

| Funcionalidade | pi-ov | OpenClaw | Nota |
|---------------|-------|----------|------|
| Profile manager + auto-detect | ✅ | ❌ | Detecta workspace → profile |
| Multi-scorer curation pipeline | ✅ | ❌ | relevance + temporal + leaf boost |
| Graph expander | ✅ | ❌ | Expande via relações semânticas |
| Circuit breaker | ✅ | ❌ | Protege contra OV offline |
| Token bucket rate limiter | ✅ | ❌ | Evita throttling |
| Pipeline + middleware logging | ✅ | ❌ | Log estruturado por camada |
| Content cascade config | ✅ | ❌ | JSON + env + default |
| Zod validation schema | ✅ | ❌ | Type-safe config |

---

## 9. Oportunidades de Melhoria

### 9.1 🔴 Críticas (corrigir imediatamente)

| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 1 | **Fix `agentMessageToParts`** para extrair ToolPart e ContextPart | Médio | 🔴 Session rica perdida |
| 2 | **Adicionar `X-OpenViking-Agent`** header + `agent_id` config | Pequeno | 🔴 Roteamento |
| 3 | **Corrigir README** — `/ready` vs `/health`, `commitTimeout`, `onShutdown` | Pequeno | 🔴 Documentação enganosa |
| 4 | **Implementar batch messages** (`POST .../messages/batch`) | Pequeno | 🔴 Performance |

### 9.2 🟡 Médias (próximo ciclo)

| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 5 | Adicionar `GET /api/v1/sessions/{id}/context` ao SessionStore | Pequeno | 🟡 Visibilidade sessão |
| 6 | Adicionar `GET /api/v1/sessions/{id}/archives/{id}` | Pequeno | 🟡 Leitura archives |
| 7 | Adicionar `POST /api/v1/sessions/{id}/extract` | Pequeno | 🟡 Extração sem commit |
| 8 | Tool `ov_archive_expand` + `ov_archive_search` | Médio | 🟡 Paridade OpenClaw |
| 9 | Tool `memory_store` para fatos explícitos | Médio | 🟡 Experiência usuário |

### 9.3 🟢 Baixas (nice to have)

| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 10 | Tool `add_resource` para agent importar docs/URLs | Médio | 🟢 Paridade |
| 11 | `GET /api/v1/system/status` no `/ov-status` | Pequeno | 🟢 Diagnóstico |
| 12 | `POST /api/v1/system/consistency` tool | Pequeno | 🟢 Debug |
| 13 | `GET /api/v1/content/download` | Pequeno | 🟢 Download raw |
| 14 | `POST /api/v1/content/reindex` tool | Pequeno | 🟢 Manutenção |

---

## 10. Riscos e Issues Técnicas

### 10.1 `sendMessages` serial = risco de performance

Se session sync envia múltiplas mensagens no startup/resume, cada uma é um request HTTP individual. Com N mensagens = N round-trips.

**Fix:** Implementar batch endpoint (`POST .../messages/batch`).

### 10.2 Session shutdown fire-and-forget

```typescript
pi.on("session_shutdown", () => {
  const active = sessionService.getActive();
  if (!active) return;
  sessionService.commit(active).catch((err) => {
    logger?.warn("session_shutdown: failed to commit session", ...);
  });
});
```

Se Pi termina antes do commit completar, memórias da sessão são perdidas.  
README diz "no auto-commit on shutdown — zero I/O" — contradição com código.

**Fix:** Sincronizar commit no shutdown, ou aceitar trade-off e corrigir README.

### 10.3 Auto-recall budget default conservador

| Config | Atual | Sugerido | Motivo |
|--------|-------|----------|--------|
| `maxTokens` | 4000 | 4000 | ✅ OK |
| `topN` | 5 | 8-10 | OpenClaw usa mais |
| `scoreThreshold` | 0.5 | 0.3 | Muito conteúdo útil tem score < 0.5 |

### 10.4 Sem mecanismo de health check recovery ativo

Health check só roda no startup. Se OV cai durante sessão, plugin só descobre na próxima chamada que falha → circuit breaker → probe recovery.

**Sugestão:** Health check periódico (ex: a cada 30s) para reativar auto-recall mais rápido.

---

## 11. Cobertura de Testes 🟢

**58 arquivos de teste** — cobertura excelente.

| Camada | Testes | Status |
|--------|--------|--------|
| Domain models | ✅ part, uri, session-id, types | 🟢 |
| Domain services | ✅ search, read, write, session | 🟢 |
| Recall | ✅ curator, graph-expander, recall-service | 🟢 |
| Config | ✅ schema, cascade, loader, profile | 🟢 |
| Adapters (driven) | ✅ transport, fs-store, kb, session-store, graph-store, health, mappers | 🟢 |
| Adapters (driver) | ✅ tools (6), commands (7), widget, message-mapper | 🟢 |
| Infrastructure | ✅ lifecycle, di, path-resolver | 🟢 |

**Gap:** `message-mapper.test.ts` testa que tool messages retornam vazio — testa o comportamento atual, não o desejado. Precisa ser atualizado quando o fix for implementado.

---

## 12. Plano de Ação Recomendado

### Sprint 1 — Correções Críticas (1-2 dias)

1. **Fix `agentMessageToParts`** — extrair ToolPart + ContextPart
   - Novo teste: mensagens com tool_use → ToolPart
   - Novo teste: mensagens com tool_result → ToolPart
   - Novo teste: content blocks mistos (text + tool + context)
2. **Adicionar `X-OpenViking-Agent`** header no Transport
   - Adicionar `agentId` ao `OVAdapterConfigSchema`
   - Enviar `X-OpenViking-Agent` header em todos requests
3. **Corrigir README**
   - `/ready` em vez de `/health`
   - `commitTimeout` default 120_000
   - Session shutdown faz commit (contradição)
   - Remover `openVikingHealthPath` (não existe)
   - `maxTokens` default 4000 (não 700)
   - Remover referência a `src/operations/` (não existe)
4. **Implementar batch messages** no SessionStoreAdapter

### Sprint 2 — Paridade OpenClaw (2-3 dias)

5. Adicionar `sessionStore.getContext()` → `GET .../sessions/{id}/context`
6. Adicionar `sessionStore.getArchive()` → `GET .../sessions/{id}/archives/{id}`
7. Adicionar `sessionStore.extractMemories()` → `POST .../sessions/{id}/extract`
8. Adicionar tools `ov_archive_expand` + `ov_archive_search`

### Sprint 3 — Melhorias (2-3 dias)

9. Adicionar tool `memory_store` para persistência explícita
10. Adicionar `systemStore` endpoint status/wait/consistency
11. Health check periódico (30s interval)
12. Ajustar defaults recall: `topN: 8`, `scoreThreshold: 0.3`

---

## Apêndice A: Referências

- OpenViking Docs: https://github.com/volcengine/OpenViking/tree/main/docs
- OpenViking API: `/docs/en/api/01-overview.md`
- OpenClaw Plugin Example: `examples/openclaw-plugin/README.md`
- Claude Code Plugin Example: `examples/claude-code-memory-plugin/README.md`
- Codex Plugin Example: `examples/codex-memory-plugin/README.md`
- Basic Usage Example: `examples/basic-usage/README.md`

## Apêndice B: Comandos Úteis para Verificação

```bash
# Verificar headers enviados
grep -rn "X-OpenViking\|X-API-Key\|Authorization" src/adapters/driven/openviking/transport.ts

# Verificar message mapper
cat src/adapters/driver/pi-session-sync/message-mapper.ts

# Verificar batch endpoint
grep -rn "batch\|messages/batch" src/

# Verificar agent_id
grep -rn "agent_id\|agentId\|Agent" src/ --include='*.ts' | grep -v node_modules | grep -v ".test.ts"

# Verificar health endpoint usado
grep -rn "health\|/ready\|/health" src/adapters/driven/openviking/health.ts

# Verificar default commitTimeout
grep -n "commitTimeout\|120000\|60000" src/infrastructure/config/schema.ts
```

---

*Auditoria gerada por pi-coding-agent em 2026-06-02. Documentação oficial do OpenViking consultada via GitHub raw. Código fonte do plugin analisado integralmente.*

---

## Apêndice C: Decisões da Grill (2026-06-02)

Sessão de grill com skill `grill-with-docs`. Decisões tomadas após entrevista estruturada:

| # | Item | Decisão | Registro |
|---|------|---------|----------|
| 1 | `agentMessageToParts` + ToolPart | Implementar — extrair ToolCall + ToolResult como ToolPart | CONTEXT.md atualizado |
| 2 | Mapeamento Pi → ToolPart | Por mensagem: assistant → text + toolCall, toolResult → tool | CONTEXT.md atualizado |
| 3 | `X-OpenViking-Agent` header | Adicionar `agentId: z.string().default("pi")` no schema + header no Transport | CONTEXT.md atualizado |
| 4 | Batch messages endpoint | Implementar `POST /sessions/{id}/messages/batch` | Débito técnico |
| 5 | Session context/archive/extract | **Não implementar.** ADR-016. Só documentar para revisão futura. | `docs/adr/0016-session-context-archive-deferred.md` |
| 6 | `memory_store` tool | Não implementar. Session commit + `ov_write` cobrem. | Documentado na auditoria |
| 7 | `ov_archive_expand` / `_search` | Não implementar. Pi não reassembla histórico do OV. | ADR-016 |
| 8 | Health check periódico | Como está — sem polling. Circuit breaker resolve. | — |
| 9 | Recall defaults | Só `topN`: 5 → 8. `scoreThreshold`: 0.5 mantém. | — |

### Sprint 1 (implementar agora)

1. **Fix `agentMessageToParts`** — extrair ToolPart de assistant.toolCall[] e toolResult messages
2. **Adicionar `agentId` ao `OVAdapterConfigSchema`** + `X-OpenViking-Agent` no Transport
3. **Implementar batch messages** — `POST /api/v1/sessions/{id}/messages/batch`
4. **Corrigir README** — `/ready` vs `/health`, `commitTimeout` 120s, `maxTokens` 4000, remover `openVikingHealthPath`

### Postergado (documentado, sem implementação)

- Session context endpoints (ADR-016)
- Archive endpoints (ADR-016)
- Extract-only endpoint (ADR-016)
- `memory_store` tool
- `add_resource` tool
- `ov_archive_expand` / `ov_archive_search`
- Health check polling
- `scoreThreshold` ajuste

### Referências

- CONTEXT.md — glossário atualizado com ToolPart sync + agentId + X-OpenViking-Agent
- `docs/adr/0016-session-context-archive-deferred.md` — decisão de não implementar endpoints de sessão
- `docs/AUDITORIA_COMPLETA.md` — este documento
