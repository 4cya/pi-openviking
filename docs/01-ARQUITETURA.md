# Arquitetura do pi-openviking

> **Arquitetura Hexagonal (Ports & Adapters).**
> Domínio puro no centro. Adaptadores na periferia.
> Inversão de dependência: o núcleo não importa nada externo.

---

## Estado Atual

| Fase | Status | Artefatos |
|------|--------|-----------|
| **F1 Foundation** | ✅ Completo | ConfigSchema, Cascade, Loader, DI Container, Logger (interface + FileLogger + NullLogger), Lifecycle, PathResolver |
| **F2 Domain + Ports** | ✅ Completo | `domain/common/` ✅ · `domain/errors/` ✅ · `domain/knowledge/model/` ✅ · `domain/recall/model/` ✅ · 6 port interfaces ✅ · `infrastructure/event-bus/in-memory.ts` (InMemoryEventBus) ✅ · `domain/recall/curate.ts` (curation) ✅ · Prototype deleted ✅ |
| **F3 OV Adapter** | ✅ Completo | Transport + 6 mappers + 4 port implementations (FsStore, KnowledgeBase, SessionStore, GraphStore) + adapter factory + DI wiring + smoke test. Ver `02-PLANO.md`. |
| **F4 Operations** | ✅ Completo | RecallConfig schema + scorers + curate pipeline + RecallCurator + RecallService + SessionService + lifecycle wiring (3 F4 singletons) + smoke tests. 10 singletons total no container. Ver `02-PLANO.md`. |
| **F5 Tools + Commands** | ✅ Completo (F5.1–F5.5 ✅) | F5.1 ✅: Pipeline + SearchService + 3 search tools. F5.2 ✅: FsStoreService (merged former WriteService + ReadService + FsService) + ov_write + ov_read. F5.3 ✅: ov_recall tool. F5.4 ✅: 6 slash commands. F5.5 ✅: Wiring (guard pattern + tool/command barrels) + OVWidget. 6 tools + 6 commands + widget operacionais. Pendente: status bar. Ver `02-PLANO.md`. |

> Este documento descreve a **arquitetura alvo**. Componentes marcados como (futuro) ainda não existem.
> Para o estado atual do código, consulte a seção [6. Estrutura de Diretórios](#6-estrutura-de-diretórios).
> Para tipos compartilhados já implementados (`domain/common/`), veja [2. F2 — Ordem de Implementação](#2-f2--ordem-de-implementação).

---

## 1. Diagrama de Camadas

```mermaid
flowchart TB
    subgraph External["🌍 Mundo Externo"]
        PI["Pi Agent (MCP/CLI)"]
        OV["OpenViking Server :1933"]
        USER["Usuário (TUI)"]
    end

    subgraph Adapters["🔌 Adaptadores (Driving)"]
        direction TB
        TOOL_REGISTRY["Tool Registry\nregisterTool() → App Service"]
        CMD_REGISTRY["Command Registry\nregisterCommand() → App Service"]
        UI_HOOKS["UI Hooks\nsetStatus, autocomplete,\nnotify — registra no Pi"]
    end

    subgraph Ports["🚪 Portas (Interfaces)"]
        direction TB
        PORT_KB["KnowledgeBase\nfind / search / glob / grep"]
        PORT_FS["FsStore\nread / write / list / tree / stat\nmkdir / mv / delete / reindex"]
        PORT_GRAPH["GraphStore\nlink / unlink / graph"]
        PORT_SESSION["SessionStore\ncreate / send / commit / ..."]
        PORT_LOGGER["Logger\ndebug / info / warn / error"]
    end

    subgraph Domain["🧠 Domínio (3 Bounded Contexts)"]
        direction TB
        DOMAIN_KNOW["Knowledge Context\nKnowledgeItem, Resource,\nUri, SessionId"]
        DOMAIN_RECALL["Recall Context\nRecallItem, TokenBudget,\nRecallCurator, RecallService,\nGraphExpander"]
        DOMAIN_PROFILE["Profile Context\nProfileConfig (value object),\nProfileManager, AutoDetect"]
    end

    subgraph DomainSvc["🎯 Domain Services (F4)"]
        direction TB
        RECALL_SVC["RecallService\ntoggle → KB → curator → result"]
        SESSION_SVC["SessionService\nactive session + commit + poll"]
    end

    subgraph App["⚙️ Aplicação"]
        direction TB
        APP_SVC["Application Services\nsearch, write, session,\nrecall"]
        APP_MW["Middleware Pipeline\nLogging (cache adiado → F3+)"]
    end

    subgraph Impl["🔌 Adaptadores (Driven)"]
        direction TB
        OV_ADAPTER["OpenVikingAdapter\nImplementa KnowledgeBase\n+ FsStore + GraphStore\n+ SessionStore"]
        OV_TRANSPORT["Transport\nHTTP + Auth + Retry + RateLimit"]
        CACHE_IMPL["CacheImpl\nInMemoryCache\n(Redis opcional)"]
        LOG_IMPL["FileLogger\nJSON lines + rotação"]
        EVENT_IMPL["InMemoryEventBus\nImplementa EventBus port"]
    end

    subgraph Infra["🏗️ Infraestrutura"]
        direction TB
        DI["DI Container\nManual (21 linhas)"]
        CONFIG["Config Cascade\ndefaults → env → file → profile"]
        LIFECYCLE["Lifecycle\ninit() / shutdown()"]
    end

    PI --> TOOL_REGISTRY
    PI -->|pi.on()| APP_SVC
    USER --> CMD_REGISTRY
    USER --> UI_HOOKS

    TOOL_REGISTRY --> APP_SVC
    CMD_REGISTRY --> APP_SVC
    UI_HOOKS --> APP_SVC

    APP_SVC --> DOMAIN_KNOW
    APP_SVC --> DOMAIN_RECALL
    APP_SVC --> DOMAIN_PROFILE
    APP_SVC -.-> APP_MW

    RECALL_SVC --> PORT_KB
    RECALL_SVC --> DOMAIN_RECALL
    SESSION_SVC --> PORT_SESSION

    APP_SVC --> PORT_KB
    APP_SVC --> PORT_FS
    APP_SVC --> PORT_GRAPH
    APP_SVC --> PORT_SESSION
    APP_SVC --> PORT_CACHE
    APP_SVC --> PORT_LOGGER
    APP_SVC --> PORT_EVENTS

    OV_ADAPTER --> PORT_KB
    OV_ADAPTER --> PORT_FS
    OV_ADAPTER --> PORT_GRAPH
    OV_ADAPTER --> PORT_SESSION
    OV_ADAPTER --> OV_TRANSPORT
    OV_TRANSPORT -->|HTTP| OV

    CACHE_IMPL --> PORT_CACHE
    LOG_IMPL --> PORT_LOGGER
    EVENT_IMPL --> PORT_EVENTS

    DI --> OV_ADAPTER
    DI --> CACHE_IMPL
    DI --> LOG_IMPL
    DI --> EVENT_IMPL
    DI --> RECALL_SVC
    DI --> SESSION_SVC
    DI --> APP_SVC
    LIFECYCLE --> DI
    CONFIG --> DI
```

> **Nota sobre PiEventBridge:** não existe `pi-event-bridge.ts` como adaptador separado.
> Pi emite eventos de infra (session_start, message_end) via `pi.on()` diretamente para
> Application Services. O EventBus de domínio só transporta eventos de domínio
> (MEMORY_SAVED, RELATION_LINKED, RECALL_EXECUTED, etc.) — ver ADR-011.
> Ver [seção 4.4](#44-event-bus--domínio-puro) para detalhes.
>
> **Nota sobre Widget:** OVWidget usa `ctx.ui.setWidget()` com info rica em 2 linhas:
> status de conexão, recall toggle, sessão ativa, escopo, métricas do último recall.
> Não há `status-bar.ts` separado — o widget é registrado em `index.ts` e atualizado
> por eventos.

---

## 2. F2 — Ordem de Implementação

A ordem de criação dos artefatos de domínio segue dependências entre eles:

| Passo | Artefato | Depende |
|-------|----------|---------|
| 1 | `domain/common/` — Uri (class), SessionId (class), ContentLevel, WriteMode, FindQuery + SearchRequest (interfaces), Part (discriminated union) | — |
| 2 | `domain/errors/` — DomainError class + subtipos (NotFoundError, ConnectionError, etc.) | — |
| 3 | `domain/{knowledge,recall,profile}/model/` — value objects + aggregates | common, errors |
| 4 | `domain/ports/` — KnowledgeBase, FsStore, GraphStore, SessionStore, Logger | models (tipos de retorno) |
| 5 | `domain/recall/curate.ts` — curate pipeline (pure function) | domain models |

ProfileManager implementado em F7a. ProfileBehavior (6 campos) + AutoDetect em F7b.

---

## 3. Ports (Interfaces do Domínio)

Todas as ports ficam em `domain/ports/`. Adaptadores concretos em `adapters/driven/`.

### KnowledgeBase — busca semântica e lexical

Dois endpoints de busca OV:
- `POST /api/v1/search/find` — find(), sem sessão, sem intent analysis, baixa latência
- `POST /api/v1/search/search` — search(), com sessão + intent analysis server-side, alta latência
- `POST /api/v1/search/glob` (pattern, uri root scope, node_limit)
- `POST /api/v1/search/grep` (uri, pattern, case_insensitive, exclude_uri, level_limit, node_limit)

```typescript
interface KnowledgeBase {
  /** Simple semantic search, no session context. POST /api/v1/search/find */
  find(query: FindQuery, signal?: AbortSignal): Promise<SearchResult>;
  /** Deep search with session + intent analysis. POST /api/v1/search/search */
  search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResult>;
  /** URI pattern discovery. POST /api/v1/search/glob */
  glob(pattern: string, uri?: string, limit?: number, signal?: AbortSignal): Promise<GlobResult>;
  /** Content regex search. POST /api/v1/search/grep */
  grep(pattern: string, opts?: GrepOptions, signal?: AbortSignal): Promise<GrepResult>;
}
```

**GrepOptions:**
- `pattern` — padrão de busca
- `caseInsensitive?` — case insensitive match
- `excludeUri?` — URI a excluir
- `levelLimit?` — profundidade máxima (níveis de diretório)
- `nodeLimit?` — max resultados

OV: `POST /api/v1/search/grep {uri, pattern, case_insensitive, exclude_uri, level_limit, node_limit}`

### GraphStore — navegação de relações

Mapeamento OV: `POST /api/v1/relations/link`, `DELETE /api/v1/relations/link`, `GET /api/v1/relations?uri=`.

```typescript
interface GraphStore {
  link(source: Uri, targets: Uri | Uri[], reason?: string, signal?: AbortSignal): Promise<LinkResult>;
  unlink(source: Uri, target: Uri, signal?: AbortSignal): Promise<void>;
  graph(uri: Uri, signal?: AbortSignal): Promise<Relation[]>;
}
```

### SessionStore — ciclo de vida de sessão OV

Mapeamento OV:
- `POST /api/v1/sessions` — create
- `POST /api/v1/sessions/{id}/messages` — sendMessage (1 mensagem)
- `POST /api/v1/sessions/{id}/messages/batch` — sendMessages (max 100)
- `POST /api/v1/sessions/{id}/commit` — commit (com `keep_recent_count`)
- `POST /api/v1/sessions/{id}/used` — sessionUsed
- `GET /api/v1/tasks/{id}` — getTaskStatus
- `GET /api/v1/tasks` (com filtros) — listTasks
- `DELETE /api/v1/sessions/{id}` — deleteSession

```typescript
interface SessionStore {
  create(signal?: AbortSignal): Promise<SessionId>;
  sendMessage(sessionId: SessionId, role: string, content: Part[], signal?: AbortSignal): Promise<void>;
  sendMessages(sessionId: SessionId, messages: { role: string; content: Part[] }[], signal?: AbortSignal): Promise<void>;
  commit(sessionId: SessionId, options?: CommitOptions, signal?: AbortSignal): Promise<CommitResult>;
  getTaskStatus(taskId: string, signal?: AbortSignal): Promise<TaskStatus>;
  listTasks(filter?: TaskFilter, signal?: AbortSignal): Promise<TaskStatus[]>;
  sessionUsed(sessionId: SessionId, contexts: Uri[], signal?: AbortSignal): Promise<void>;
  deleteSession(sessionId: SessionId, signal?: AbortSignal): Promise<void>;
}
```

### FsStore — operações no filesystem OV (ContentStore fundida)

Port única para ler, escrever, navegar e gerenciar o filesystem virtual do OpenViking.
ContentStore foi fundida nesta port — OV trata content e fs como o mesmo sistema.

Mapeamento OV:
- Leitura: `GET /api/v1/content/{read|abstract|overview}?uri=&offset=&limit=`
- Escrita: `POST /api/v1/content/write` (mode: replace|append|create, wait, timeout)
- Navegação: `GET /api/v1/fs/ls`, `GET /api/v1/fs/tree`, `GET /api/v1/fs/stat`
- Mutação: `POST /api/v1/fs/mkdir`, `POST /api/v1/fs/mv`, `DELETE /api/v1/fs`

```typescript
interface FsStore {
  read(uri: Uri, level?: ContentLevel, offset?: number, limit?: number, signal?: AbortSignal): Promise<Content>;
  write(uri: Uri, content: string, mode?: WriteMode, signal?: AbortSignal): Promise<WriteResult>;
  list(uri: Uri, recursive?: boolean, signal?: AbortSignal): Promise<FsEntry[]>;
  tree(uri: Uri, signal?: AbortSignal): Promise<FsEntry[]>;
  stat(uri: Uri, signal?: AbortSignal): Promise<FsEntry>;
  mkdir(uri: Uri, signal?: AbortSignal): Promise<void>;
  mv(from: Uri, to: Uri, signal?: AbortSignal): Promise<void>;
  delete(uri: Uri, recursive?: boolean, signal?: AbortSignal): Promise<void>;
  reindex(uri: Uri, mode?: "vectors_only" | "full", signal?: AbortSignal): Promise<void>;
}
```

> **ReindexMode**: `"vectors_only" | "full"`. Default `"vectors_only"` rebuilds vector embeddings; `"full"` rebuilds both scalar and vector indexes. Maps to OV `POST /api/v1/content/reindex {uri, mode}`.

> `read()` aceita `level` que mapeia para as camadas L0/L1/L2 do OV:
> - `"abstract"` → L0 (~100 tokens, vetor de busca). OV: `GET /api/v1/content/abstract?uri=`
> - `"overview"` → L1 (~2k tokens, resumo intermediário). OV: `GET /api/v1/content/overview?uri=`
> - `"read"` → L2 (conteúdo completo). OV: `GET /api/v1/content/read?uri=&offset=&limit=`
>
> `offset` (linha inicial, default 0) e `limit` (linhas, default -1) aplicam-se apenas ao nível `"read"`.
>
> `write()` não expõe `wait` no domínio — espera síncrona é detalhe de transporte OV,
> resolvido no adapter (F3) via `wait: true` com timeout default de 30s.
> Domínio não sabe de async processing. OV `POST /api/v1/content/write` aceita
> `wait: bool` e `timeout: float`.
>
> **Nota sobre scopes OV:** OV organiza conteúdo em 4 scopes públicos sob `viking://`:
> `resources/` (documentos), `user/{user_id}/` (memórias de usuário), `agent/{agent_id}/` (memórias/experiências do agent),
> `session/{user_space}/{session_id}/` (dados de sessão). O extension mapeia Pi sessions → OV sessions.
> Scopes `temp/` e `queue/` são internos, não acessíveis via API pública.

**Tipos de suporte (definidos em `domain/common/`):**

```typescript
// domain/common/content-level.ts
// Mapeia para camadas OV: L0 (abstract, ~100 tokens) / L1 (overview, ~2k tokens) / L2 (read, full)
type ContentLevel = "abstract" | "overview" | "read";

// domain/common/write-mode.ts
type WriteMode = "replace" | "append" | "create";

// domain/common/search-query.ts
// Dois types separados — OV tem endpoints distintos (ver decisão F2 em CONTEXT.md).
// SearchMode removido: KnowledgeBase.find() vs KnowledgeBase.search() resolve o mode.
interface FindQuery {
  query: string;
  limit?: number;
  targetUri?: Uri;
}
interface SearchRequest {
  query: string;
  limit?: number;
  sessionId?: SessionId;
  targetUri?: Uri;
}

// domain/common/part.ts
interface TextPart { type: "text"; text: string }
interface ToolPart {
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
interface ContextPart { type: "context"; uri: string; contextType: "memory" | "resource" | "skill"; abstract: string }
type Part = TextPart | ToolPart | ContextPart;
```

> **Nota:** `ResourceKind` e `SearchMode` foram removidos — escrita de conteúdo textual é via `write()`,
> adição de resources via `POST /api/v1/resources` (adaptador OV, não port).
> OV v3 não possui endpoint `reindex`. `write()` sempre atualiza semântica/vectors automaticamente.
> `FindQuery`/`SearchRequest` e `Part` vivem em `domain/common/` por serem consumidos por múltiplas ports
> e adaptadores. Não são private de port nenhuma.

### Logger — logging estruturado

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  debug(msg: string, ctx?: Record<string, unknown>): void;
  isEnabled(level: LogLevel): boolean;
}
```

> Logger é síncrono por design — não precisa de `AbortSignal`.

### EventBus — eventos de domínio entre bounded contexts (ADR-011)

```typescript
type DomainEvent =
  | { type: 'MEMORY_SAVED'; uri: string; source: string }
  | { type: 'RELATION_LINKED'; source: string; target: string; predicate: string }
  | { type: 'RECALL_EXECUTED'; itemsCount: number; durationMs: number }
  | { type: 'BUDGET_EXCEEDED'; budget: number; attempted: number };

interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(type: string, handler: (event: DomainEvent) => void): () => void;
}
```

> **Eventos excluídos (não são de domínio):**
> - `PROFILE_CHANGED` — Profile é value object (substituído, não mutado). Mudanças de config são notificação de infra, não evento de domínio.
> - `ERROR` — não é conceito de domínio. Erros são diagnóstico.
> - `SESSION_STARTED`, `MESSAGE_PROCESSED` — infra. Tratados por `pi.on()` diretamente.
>   (Per ADR-011 e ADR-008 async init.)
```

---

## 4. Design Patterns

### 4.1 Command Pattern — Toda ação é um comando

```typescript
class RecallService {
  constructor(
    private knowledge: KnowledgeBase,
    private curator: RecallCurator,
    private config: RecallConfig,
  ) {}

  async recall(prompt: string): Promise<RecallResult> {
    const mode = this.config.searchMode; // 'find' | 'search', from RecallConfig
    const results = mode === 'search'
      ? await this.knowledge.search({ query: prompt, ... })
      : await this.knowledge.find({ query: prompt, ... });
    return {
      items: this.curator.curate(results, prompt),
      total: results.total,
    };
  }
}
```

### 4.2 Recall Toggle — User control

Recall is controlled by a toggle command (`/ov recall on` / `/ov recall off`).
No intent detection — user decides when recall fires.
`searchMode` comes from `RecallConfig` (default `'find'`), overridable via profile.

### 4.3 Middleware Pipeline — Cross-cutting concerns

Pipeline genérico (`Pipeline<T>`) empilhando middlewares em tool-handler level.
Services não sabem de middleware — tool handler chama `pipeline.execute(() => service.method())`.

```
Request → LoggingMiddleware → Handler → Response

# Cache middleware: adiado. Implementar após OV adapter (F3+) quando cache existir.
```

**Design (F5):**
- `Pipeline` recebe handler assíncrono e aplica middlewares em cadeia
- Logging middleware: mede duração, loga tool executada
- ToolContext (estado compartilhado entre middlewares) **não criado em F5** — adicionado quando cache middleware precisar interceptar chamadas idempotentes
- Uso nas tools: `pipeline.execute(() => searchService.search(params))`

**Arquivo:** `domain/pipeline/pipeline.ts` + `domain/pipeline/logging-middleware.ts`

### 4.4 Event Bus — REMOVIDO

EventBus de domínio foi removido em F5 Review — dead code sem subscribers, sem publisher,
e sem API de eventos no OV. Eventos de infra (session_start, message_end, etc.)
são tratados diretamente por `pi.on()` em `index.ts`. Não existe PiEventBridge separado.

---

## 5. Fluxos Principais

### 5.1 Auto-Recall (visão completa — F5–F8)

Diagrama mostra fluxo completo incluindo componentes futuros (profileManager em F7, expandGraph em F8).
Em F5, apenas o caminho `before_agent_start → recall toggle → KB.find/search → curator → inject` existe.

```mermaid
flowchart TD
    A["before_agent_start"] --> B{"OV healthy?"}
    B -->|"nao"| C["skip"]
    B -->|"sim"| D{"recall toggle on?"}
    D -->|"nao"| E["skip"]
    D -->|"sim"| F["profileManager.resolve()"]
    F --> G["knowledge.search(query, targetUri, mode, limit)"]
    G --> H["curator.curate(score, dedup, budget)"]
    H --> I{"expandGraph?"}
    I -->|"sim"| J["knowledge.graph(seed) + merge"]
    J --> K["inject <relevant-memories> into prompt"]
    I -->|"nao"| K
```

### 5.2 Session Sync

Evento `message_end` chega via `pi.on()` e chama SessionService direto.
EventBus de domínio não transporta eventos de infra.

```mermaid
sequenceDiagram
    participant Pi as Pi Agent
    participant Index as index.ts
    participant Svc as SessionService
    participant Bus as EventBus
    participant OV as OpenViking

    Pi->>Index: pi.on("message_end")
    Index->>Svc: sessionService.sendMessage(sessionId, parts)
    Svc->>OV: sendMessage(sessionId, parts)
    OV-->>Svc: 200
    Svc->>Bus: publish(MEMORY_SAVED)
```

---

## 6. Estrutura de Diretórios

```
src/
├── domain/                    # Pure TS. Sem imports externos.
│   ├── common/                # ✅ Shared kernel: Uri, SessionId, ContentLevel, WriteMode, FindQuery, SearchRequest, Part
│   ├── knowledge/             # (futuro F2) Contexto: armazenamento e busca
│   │   ├── model/             # ✅ KnowledgeItem, ResourceItem, SkillItem, SearchResult, Relation
│   │   └── service/           # (futuro) SemanticSearch
│   ├── recall/                # ✅ Contexto: curadoria
│   │   ├── model/             # ✅ RecallItem, TokenBudget
│   │   ├── curate.ts          # ✅ Curation pipeline + scorers + Scorer type
│   │   ├── recall-curator.ts  # ✅ RecallCurator wrapper over curate()
│   │   └── recall-service.ts  # ✅ RecallService: toggle → KB → curator → RecallResult
│   ├── services/              # ✅ Domain services com estado
│   │   ├── session-service.ts  # ✅ SessionService: active session + commit + polling
│   │   ├── search-service.ts  # ✅ SearchService: find/search/glob/grep delegation
│   │   └── fs-store-service.ts # ✅ FsStoreService: read/save/mkdir/mv/list/tree/stat/delete/reindex → FsStore
│   ├── profile/               # (futuro F7) Contexto: perfis de comportamento
│   │   ├── model/             # ProfileConfig, AutoDetectRule
│   │   └── service/           # ProfileManager, ProfileResolver, AutoDetect
│   ├── ports/                 # ✅ Interfaces planas (todas implementadas)
│   │   ├── logger.ts          # ✅ Logger
│   │   ├── knowledge-base.ts  # ✅ KnowledgeBase + GlobResult, GrepOptions, GrepResult
│   │   ├── fs-store.ts        # ✅ FsStore + Content, WriteResult, FsEntry
│   │   ├── graph-store.ts     # ✅ GraphStore + LinkResult
│   │   └── session-store.ts   # ✅ SessionStore + CommitResult, TaskStatus
│   └── errors/                # ✅ DomainError, NotFoundError, ConnectionError, ValidationError
│
├── application/               # (não utilizado — SearchService em domain/services/, Pipeline em domain/pipeline/)
│
├── adapters/
│   ├── driver/pi-tools/       # ✅ F5.1–F5.6: 12 tools registradas
│   │   ├── ov-search.ts       # ✅ ov_search tool + TypeBox schema
│   │   ├── ov-search.test.ts  # ✅ 3 unit tests
│   │   ├── ov-glob.ts         # ✅ ov_glob tool
│   │   ├── ov-glob.test.ts    # ✅ 2 unit tests
│   │   ├── ov-grep.ts         # ✅ ov_grep tool
│   │   ├── ov-grep.test.ts    # ✅ 2 unit tests
│   │   ├── ov-write.ts        # ✅ ov_write tool (action: save|mkdir|mv)
│   │   ├── ov-write.test.ts   # ✅ 6 unit tests
│   │   ├── ov-read.ts         # ✅ ov_read tool (level: abstract|overview|read)
│   │   ├── ov-read.test.ts    # ✅ 4 unit tests
│   │   ├── ov-resource.ts     # ✅ ov_resource tool (validates viking://resources/)
│   │   ├── ov-resource.test.ts # ✅ 6 unit tests
│   │   ├── ov-skill.ts        # ✅ ov_skill tool (validates viking://skills/)
│   │   ├── ov-skill.test.ts   # ✅ 4 unit tests
│   │   └── integration.test.ts # ✅ 8 integration tests (mock HTTP server)
│   ├── driver/pi-commands/    # ✅ F5.4: 9 slash commands
│   │   ├── ov-recall-command.ts  # ✅ /ov-recall on|off
│   │   ├── ov-status-command.ts  # ✅ /ov-status
│   │   ├── ov-tree-command.ts    # ✅ /ov-tree [uri]
│   │   ├── ov-commit-command.ts  # ✅ /ov-commit [--wait]
│   │   ├── ov-search-command.ts  # ✅ /ov-search <query>
│   │   ├── ov-delete-command.ts  # ✅ /ov-delete <uri>
│   │   ├── ov-profile-command.ts # ✅ /ov-profile {apply,list,show,detect}
│   │   ├── ov-start-command.ts   # ✅ /ov-start
│   │   ├── ov-reindex-command.ts # ✅ /ov-reindex <uri> [--mode]
│   │   └── command-registry.ts   # ✅ registerAllCommands() barrel
│   ├── driver/pi-session-sync/ # ✅ F6: MessageMapper
│   │   ├── message-mapper.ts   # ✅ agentMessageToParts() — 9 tests
│   │   └── message-mapper.test.ts # ✅ 9 tests (user/assistant/tool/empty/null/ImageContent)
│   ├── driver/pi-tools/         # ✅ F5.1–F5.5: 6 tools + barrel
│   │   ├── tool-registry.ts     # ✅ registerAllTools() barrel
│   └── driven/
│       ├── openviking/        # ✅ F3: Transport + 4 adapters + 6 mappers + factory
│       │   ├── circuit-breaker.ts # ✅ Pure state machine: CLOSED→OPEN→HALF_OPEN (8 tests)
│       │   ├── circuit-breaker.test.ts # ✅ 8 reducer tests + 3 integration tests
│       │   ├── health.ts          # ✅ HealthCheck adapter: /ready probe (bypasses CB)
│       │   ├── health.test.ts     # ✅ 4 tests (200, 503, latency, connection error)
│       │   ├── transport.ts       # ✅ HTTP client c/ auth, retry, timeout, abort, CB decorator (3 integration tests)
│       │   ├── fs-store.ts        # ✅ FsStoreAdapter (read/write/list/tree/stat/mkdir/mv/delete/reindex)
│       │   ├── knowledge-base.ts  # ✅ KnowledgeBaseAdapter (find/search/glob/grep)
│       │   ├── session-store.ts   # ✅ SessionStoreAdapter (create/send/commit/tasks/lifecycle)
│       │   ├── graph-store.ts     # ✅ GraphStoreAdapter (link/unlink/graph)
│       │   └── mappers/
│       │       ├── error-mapper.ts    # ✅ toDomainError()
│       │       ├── content-mapper.ts  # ✅ toContent()
│       │       ├── fs-mapper.ts       # ✅ toFsEntry/toFsEntries/toWriteResult
│       │       ├── search-mapper.ts   # ✅ toSearchResult/toGlobResult/toGrepResult
│       │       ├── session-mapper.ts  # ✅ toSessionId/toCommitResult/toTaskStatus + PartSerializer
│       │       └── relation-mapper.ts # ✅ toLinkResult/toRelations
│       ├── cache/             # (futuro F3+) InMemoryCache / RedisCache
│       └── logger/
│           ├── file-logger.ts # ✅ FileLogger (JSON lines + rotação)
│           └── null-logger.ts # ✅ NullLogger (testes/silent mode)
│
├── infrastructure/
│   ├── config/
│   │   ├── schema.ts          # ✅ ConfigSchema raiz (Zod) + RecallConfigSchema (F4)
│   │   ├── logger-schema.ts   # ✅ LoggerConfigSchema
│   │   ├── cascade.ts         # ✅ Config Cascade: defaults → env → file → profile
│   │   ├── loader.ts          # ✅ Leitor .pi/settings.json
│   │   └── profile-schema.ts  # ✅ ProfileSchema (só name+description em F1)
│   ├── di/
│   │   └── container.ts       # ✅ DI Container manual (21 linhas, 15 singletons)
│   ├── lifecycle.ts           # ✅ init() + shutdown() — wires F1–F7b (15 singletons)
│   ├── lifecycle.test.ts      # ✅ 16 smoke tests (F1–F3 adapters + F4 services)
│   └── path-resolver.ts       # ✅ PathResolver utilitário
│
├── _legacy/                   # (removido em F3 — 2026-05-27)
├── index.ts                   # ✅ F5: init → resolve → registerAll → listen
                               # Guard initialized, bootstrap único,
                               # tools + commands registrados uma vez.
├── adapters/driver/ov-widget.ts  # ✅ OVWidget — 2-line status widget via setWidget()
```

**Legenda:** ✅ existe agora | 🔧 F5 (em planejamento/implementação) | (futuro) ainda não implementado

> F2 — domain/common/ (#47), domain/errors/ + knowledge/recall models (#48), 6 port interfaces (#49) implementados 2026-05-27.
> F3 ✅ — Issues #52–#58: Transport + 6 mappers + 4 port implementations + adapter factory + DI wiring + smoke test concluídos 2026-05-27.
> F4 ✅ — Issues #61–#66: RecallConfig + scorers + curate pipeline + RecallCurator + RecallService + SessionService + lifecycle wiring concluídos 2026-05-29.
> F5 ✅ — F5.1 ✅ (issue #68): Pipeline + SearchService + 3 search tools + index.ts wiring. F5.2 ✅ (issue #69): FsStoreService (merged WriteService + ReadService + FsService) + ov_write + ov_read. F5.3 ✅ (issue #70): ov_recall tool. F5.4 ✅ (issue #71): 6 slash commands. F5.5 ✅ (issue #72): Wiring (guard pattern + barrels) + OVWidget. Pendente: status bar.

---

## 7. Princípios Arquiteturais

1. **Domain pure** — Núcleo não importa Pi, OV, HTTP, nada externo
2. **Ports > Implementations** — Interfaces primeiro, implements depois
3. **Autonomia progressiva** — off → propose → auto
4. **Silent by default** — Nunca pergunte o que pode ser inferido
5. **Graceful degradation** — OV offline não quebra o Pi
6. **Pipeline de middlewares** — Cross-cutting concerns empilháveis
7. **Cascading config** — Default → env → file → profile → inline
