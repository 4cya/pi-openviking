# PRD F3 — OV Adapter

## Problem Statement

O plugin pi-openviking tem toda a fundação (F1) e o domínio puro com ports (F2) implementados, mas não consegue se comunicar com o servidor OpenViking. As seis port interfaces (KnowledgeBase, FsStore, GraphStore, SessionStore, CacheStore, Logger) existem como contratos — sem implementação concreta.

O código legado em `src/_legacy/ov-client/` tem um cliente HTTP funcional mas está acoplado a tipos planos, sem mapeamento para os value objects do domínio (Uri, SessionId, Part), sem retry, sem rate limiting, sem tratamento de erro estruturado. Não pode ser reaproveitado como está.

Sem o OV Adapter, as fases seguintes (F4 Operations, F5 Tools + Commands, F6 Auto-Recall) não têm como persistir ou recuperar dados. O plugin existe mas não faz nada.

## Solution

Implementar o **OV Adapter** — a camada driven da arquitetura hexagonal que traduz chamadas das port interfaces em requisições HTTP para o servidor OpenViking v3.

O adapter é composto por três módulos profundos:

1. **Transport** — cliente HTTP reutilizável com autenticação, retry, rate limiting, timeout e aborto
2. **Mappers** — funções puras que traduzem respostas JSON da OV API para tipos do domínio (Uri, SessionId, SearchResult, FsEntry, etc.)
3. **Adapter** — fábrica que recebe um Transport, instancia os mappers, e retorna implementações concretas de cada port

A estratégia de teste usa um **mock server OV in-memory** (Fastify/Express leve) em vez de Docker — cada teste sobe e derruba o mock, sem dependência externa.

## User Stories

1. As a plugin developer, I want a `Transport` that wraps HTTP fetch with retry and timeout, so that transient OV failures don't crash the plugin
2. As a plugin developer, I want `Transport` to send `X-API-Key`, `X-OpenViking-Account`, and `X-OpenViking-User` headers on every request, so that OV authentication works
3. As a plugin developer, I want `Transport.request()` to accept an `AbortSignal`, so that the caller can cancel in-flight requests (e.g. on Pi shutdown)
4. As a plugin developer, I want error mappers that translate OV HTTP 4xx/5xx into typed DomainError subtypes (NotFoundError, ConnectionError, ValidationError), so that callers can handle failures by type
5. As a plugin developer, I want search mappers that convert OV `POST /api/v1/search/find` responses into domain `SearchResult`, so that KnowledgeBase.find() returns typed data
6. As a plugin developer, I want search mappers that convert OV `POST /api/v1/search/search` responses into domain `SearchResult`, so that KnowledgeBase.search() returns typed data
7. As a plugin developer, I want glob mappers that convert OV `POST /api/v1/search/glob` responses into domain `GlobResult`, so that KnowledgeBase.glob() returns typed data
8. As a plugin developer, I want grep mappers that convert OV `POST /api/v1/search/grep` responses into domain `GrepResult`, so that KnowledgeBase.grep() returns typed data
9. As a plugin developer, I want content mappers that convert OV `GET /api/v1/content/{read|abstract|overview}` responses into domain `Content`, so that FsStore.read() returns typed data
10. As a plugin developer, I want the content mapper to pass `offset` and `limit` query params when present, so that large files are paginated
11. As a plugin developer, I want FsStore.write() to call `POST /api/v1/content/write` with `wait: true` and a configurable timeout, so that writes complete before the promise resolves
12. As a plugin developer, I want fs mappers that convert OV `GET /api/v1/fs/{ls|tree|stat}` responses into domain `FsEntry[]`, so that FsStore.list()/tree()/stat() return typed data
13. As a plugin developer, I want FsStore.mkdir() to call `POST /api/v1/fs/mkdir`, so that directories are created on OV
14. As a plugin developer, I want FsStore.mv() to call `POST /api/v1/fs/mv`, so that files/directories are moved/renamed on OV
15. As a plugin developer, I want FsStore.delete() to call `DELETE /api/v1/fs` with automatic recursive fallback, so that both files and non-empty directories can be deleted
16. As a plugin developer, I want session mappers that convert OV `POST /api/v1/sessions` responses into domain `SessionId`, so that SessionStore.create() returns typed data
17. As a plugin developer, I want SessionStore.sendMessage() to call `POST /api/v1/sessions/{id}/messages` with typed Part[], so that messages are sent to OV
18. As a plugin developer, I want SessionStore.sendMessages() to call `POST /api/v1/sessions/{id}/messages/batch`, so that multiple messages are sent in one HTTP request
19. As a plugin developer, I want SessionStore.commit() to call `POST /api/v1/sessions/{id}/commit` with `keep_recent_count` mapped from CommitOptions, so that recent messages stay live after commit
20. As a plugin developer, I want SessionStore.getTaskStatus() to call `GET /api/v1/tasks/{id}`, so that background task completion can be polled
21. As a plugin developer, I want SessionStore.listTasks() to call `GET /api/v1/tasks` with filter params, so that tasks can be queried in bulk
22. As a plugin developer, I want SessionStore.sessionUsed() to call `POST /api/v1/sessions/{id}/used`, so that used contexts are recorded for memory extraction
23. As a plugin developer, I want SessionStore.deleteSession() to call `DELETE /api/v1/sessions/{id}`, so that sessions can be cleaned up
24. As a plugin developer, I want relation mappers that convert OV `POST /api/v1/relations/link` into domain `LinkResult`, so that GraphStore.link() returns typed data
25. As a plugin developer, I want GraphStore.unlink() to call `DELETE /api/v1/relations/link`, so that relations are removed
26. As a plugin developer, I want GraphStore.graph() to call `GET /api/v1/relations?uri=`, so that relations for a URI are retrieved
27. As a plugin developer, I want the adapter to be registered in the DI container, so that application services (F4+) can resolve port implementations
28. As a plugin developer, I want every adapter method to accept an optional AbortSignal, so that long requests can be cancelled
29. As a plugin developer, I want the adapter to log every OV API call (method, URI, duration, status) at debug level, so that OV interactions are observable
30. As a plugin developer, I want the adapter to degrade gracefully when OV is unreachable (ConnectionError instead of crash), so that F4+ can implement offline mode

## Implementation Decisions

### Module: Transport (`adapters/driven/openviking/transport.ts`)

Deep module — encapsulates HTTP, auth, retry, timeout, abort coordination.

- **Constructor** receives `TransportConfig` (endpoint, apiKey, account, user, timeout, maxRetries)
- Uses native `fetch()` — no axios/node-fetch dependency
- Implements exponential backoff retry (3 attempts, 1s/2s/4s) for 5xx and network errors
- Maps HTTP 4xx/5xx to typed errors via shared error codes
- All methods accept optional `AbortSignal` for cancellation
- Sends `Content-Type: application/json` (except FormData), `X-API-Key`, `X-OpenViking-Account`, `X-OpenViking-User` headers
- Single method: `request<T>(methodLabel, path, opts?, signal?): Promise<T>`

### Module: Mappers (`adapters/driven/openviking/mappers/`)

Six deep modules, each a set of pure functions — no side effects, no class instances, max testability.

- **`search-mapper.ts`** — `toSearchResult(raw): SearchResult`, `toGlobResult(raw): GlobResult`, `toGrepResult(raw): GrepResult`
- **`content-mapper.ts`** — `toContent(raw, uri, level): Content`, `toWriteResult(raw): WriteResult`
- **`fs-mapper.ts`** — `toFsEntry(raw): FsEntry`, `toFsEntries(raw): FsEntry[]`
- **`session-mapper.ts`** — `toSessionId(raw): SessionId`, `toCommitResult(raw): CommitResult`, `toTaskStatus(raw): TaskStatus`
- **`relation-mapper.ts`** — `toLinkResult(raw): LinkResult`, `toRelations(raw): Relation[]`
- **`error-mapper.ts`** — `toDomainError(httpStatus, body, methodLabel): DomainError`

Each mapper is a standalone export (not a class). Domain types are imported from `domain/ports/` or `domain/common/`.

### Module: Adapter (`adapters/driven/openviking/adapter.ts`)

Factory function that ties Transport + Mappers into port implementations.

```typescript
export interface OVAdapterConfig {
  endpoint: string;
  apiKey: string;
  account: string;
  user: string;
  timeout: number;        // default 30_000
  commitTimeout: number;  // default 120_000 (commit can be slow)
  maxRetries: number;     // default 3
}

export function createOVAdapter(
  config: OVAdapterConfig,
  logger?: Logger,
): {
  knowledgeBase: KnowledgeBase;
  fsStore: FsStore;
  graphStore: GraphStore;
  sessionStore: SessionStore;
};
```

Internal wiring:
- Creates a single Transport instance from config
- Each port method: serialize domain params → transport.request() → mapper → return domain result
- Wraps every call in try/catch: errors go through error-mapper, transport errors become ConnectionError
- Logs every call at debug level

### Config Schema Extension (`infrastructure/config/schema.ts`)

Add OV server connection fields to `PiOVConfig`:

```typescript
export const OVAdapterConfigSchema = z.object({
  endpoint: z.string().url().default("http://localhost:1933"),
  apiKey: z.string().default(""),
  account: z.string().default("pi"),
  user: z.string().default("default"),
  timeout: z.number().positive().default(30_000),
  commitTimeout: z.number().positive().default(120_000),
  maxRetries: z.number().int().min(0).default(3),
});
```

### API Contract: Endpoint Mapping

Cada método da port mapeia para exatamente um endpoint OV:

| Port Method | OV Endpoint | Notes |
|---|---|---|
| `KnowledgeBase.find()` | `POST /api/v1/search/find` | Sem sessão, sem intent analysis |
| `KnowledgeBase.search()` | `POST /api/v1/search/search` | Com sessionId → intent analysis |
| `KnowledgeBase.glob()` | `POST /api/v1/search/glob` | pattern + uri root scope |
| `KnowledgeBase.grep()` | `POST /api/v1/search/grep` | uri + pattern + filters |
| `FsStore.read()` | `GET /api/v1/content/{read\|abstract\|overview}` | offset/limit p/ arquivos grandes |
| `FsStore.write()` | `POST /api/v1/content/write` | wait: true + timeout |
| `FsStore.list()` | `GET /api/v1/fs/ls` | |
| `FsStore.tree()` | `GET /api/v1/fs/tree` | |
| `FsStore.stat()` | `GET /api/v1/fs/stat` | |
| `FsStore.mkdir()` | `POST /api/v1/fs/mkdir` | |
| `FsStore.mv()` | `POST /api/v1/fs/mv` | |
| `FsStore.delete()` | `DELETE /api/v1/fs` | Retry com recursive=true se falhar |
| `GraphStore.link()` | `POST /api/v1/relations/link` | from_uri + to_uris + reason |
| `GraphStore.unlink()` | `DELETE /api/v1/relations/link` | from_uri + to_uri |
| `GraphStore.graph()` | `GET /api/v1/relations?uri=` | |
| `SessionStore.create()` | `POST /api/v1/sessions` | |
| `SessionStore.sendMessage()` | `POST /api/v1/sessions/{id}/messages` | |
| `SessionStore.sendMessages()` | `POST /api/v1/sessions/{id}/messages/batch` | max 100 |
| `SessionStore.commit()` | `POST /api/v1/sessions/{id}/commit` | keep_recent_count from opts |
| `SessionStore.getTaskStatus()` | `GET /api/v1/tasks/{id}` | |
| `SessionStore.listTasks()` | `GET /api/v1/tasks` | Filtros opcionais |
| `SessionStore.sessionUsed()` | `POST /api/v1/sessions/{id}/used` | |
| `SessionStore.deleteSession()` | `DELETE /api/v1/sessions/{id}` | |

### Part Serialization

`Part` (domain discriminated union) serializa para o formato esperado pela OV API:

| Part Type | Domain Fields | OV JSON Fields |
|---|---|---|
| `TextPart` | `{ type, text }` | `{ type: "text", text }` |
| `ToolPart` | `{ type, toolId, toolName, toolInput, toolOutput, toolStatus, toolUri, skillUri, durationMs, promptTokens, completionTokens, toolOutputRef, toolOutputTruncated }` | `{ type: "tool", tool_id, tool_name, tool_input, tool_output, tool_status, tool_uri, skill_uri, duration_ms, prompt_tokens, completion_tokens, tool_output_ref, tool_output_truncated }` |
| `ContextPart` | `{ type, uri, contextType, abstract }` | `{ type: "context", uri, context_type, abstract }` |

### DI Registration

Adapter registrado no container em `lifecycle.ts` (F5 passa a consumir). Até lá, `init()` cria o adapter e registra como singleton:

```typescript
const adapter = createOVAdapter(config.ov, logger);
container.register("knowledgeBase", () => adapter.knowledgeBase, true);
container.register("fsStore", () => adapter.fsStore, true);
container.register("graphStore", () => adapter.graphStore, true);
container.register("sessionStore", () => adapter.sessionStore, true);
```

## Testing Decisions

### What makes a good test

- Teste o comportamento externo, não implementação interna
- Cada mapper testado isoladamente com JSON de exemplo (capturado do OV real)
- Transport testado contra mock HTTP server (Fastify/Express leve), não contra OV real
- Adapter testado com Transport mockado — verifica que chama o endpoint certo com os params certos
- Casos de erro: timeout, 401, 404, 500, rede off, abort signal

### Modules to test

| Module | Test Strategy | File |
|---|---|---|
| `transport.ts` | Mock HTTP server (Fastify rápido), testar retry, timeout, abort, headers, error mapping | `transport.test.ts` |
| `mappers/search-mapper.ts` | Pure function tests com fixtures JSON | `search-mapper.test.ts` |
| `mappers/content-mapper.ts` | Pure function tests | `content-mapper.test.ts` |
| `mappers/fs-mapper.ts` | Pure function tests | `fs-mapper.test.ts` |
| `mappers/session-mapper.ts` | Pure function tests | `session-mapper.test.ts` |
| `mappers/relation-mapper.ts` | Pure function tests | `relation-mapper.test.ts` |
| `mappers/error-mapper.ts` | Testar cada código HTTP → DomainError subtype | `error-mapper.test.ts` |
| `adapter.ts` | Mock Transport, verificar chamadas corretas | `adapter.test.ts` |

### Prior art

- `infrastructure/config/cascade.test.ts` — tests that verify config loading with fixtures
- `infrastructure/event-bus/in-memory.test.ts` — tests that verify event pub/sub with typed contracts
- `_legacy/ov-client/transport.ts` — legacy transport patterns (reference for HTTP behavior, not code reuse)

## Out of Scope

- **Cache adapter** (`adapters/driven/cache/`) — deferido para F3+ (após adapter OV estável)
- **Reindex endpoint** — existe no OV mas não faz parte das ports; uso normal refresca vectors via write()
- **MCP server export** (F8.7)
- **Webhook handler** (F8.8)
- **Add resource/skill endpoints** (`POST /api/v1/resources`, `POST /api/v1/skills`) — estes são operações de ingestion que pertencem a um domínio de ResourceService (F4+), não às ports base
- **Auto-recall e session sync** (F6)
- **Profile integration** (F7a/b)

## Further Notes

- O código legado em `src/_legacy/ov-client/` é mantido como referência até o fim de F3. Quando o adapter estiver completo e testado, o legacy pode ser removido.
- O adapter não sabe da existência do Pi ou do EventBus. Ele implementa ports — quem orquestra são os Application Services (F4).
- O endpoint mapping foi revisado contra a OV API real (v0.3.20, maio/2026). Os endpoints `/api/v1/content/` (não `/api/v1/fs/`) foram confirmados no source `openviking/server/routers/content.py`.
- O adapter precisa ser resiliente a OV offline — todo método retorna `Promise.reject(ConnectionError)` em vez de lançar exceptions não-tipadas.
