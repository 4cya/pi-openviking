# Arquitetura do pi-openviking

> **Arquitetura Hexagonal (Ports & Adapters).**
> Domínio puro no centro. Adaptadores na periferia.
> Inversão de dependência: o núcleo não importa nada externo.

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
        PI_BRIDGE["Pi Event Bridge\nTraduz Pi events → EventBus"]
        TOOL_REGISTRY["Tool Registry\nMCP tool → Application Service"]
        CMD_REGISTRY["Command Registry\nCLI /ov-* → Application Service"]
        TUI_RENDER["TUI Renderers\nStatus bar + Result displays"]
    end

    subgraph Ports["🚪 Portas (Interfaces)"]
        direction TB
        PORT_KB["KnowledgeBase\nsearch / write / graph / ..."]
        PORT_SESSION["SessionStore\ncreate / send / commit / ..."]
        PORT_FS["FsStore\nlist / read / write / mkdir / ..."]
        PORT_CACHE["CacheStore\nget / set / invalidate"]
        PORT_LOGGER["Logger\ndebug / info / warn / error"]
        PORT_EVENTS["EventBus\npublish / subscribe"]
    end

    subgraph Domain["🧠 Domínio"]
        direction TB
        DOMAIN_ENT["Value Objects\nKnowledgeItem, SessionId,\nUri, RecallItem, Relation"]
        DOMAIN_INTENT["Intent Detection\nChain of Responsibility"]
        DOMAIN_CURATOR["Recall Curator\nScoring + Dedup + Budget"]
    end

    subgraph App["⚙️ Aplicação"]
        direction TB
        APP_SVC["Application Services\nsearch.service, write.service,\nsession.service, recall.service"]
        APP_MW["Middleware Pipeline\nLogging → Cache → Metrics"]
        APP_EVENTS["Event Handlers\nauto-save, auto-commit,\nstatus-bar, metrics"]
    end

    subgraph Impl["🔌 Adaptadores (Driven)"]
        direction TB
        OV_ADAPTER["OpenVikingAdapter\nImplementa KnowledgeBase\n+ SessionStore + FsStore"]
        OV_TRANSPORT["Transport\nHTTP + Auth + Retry + RateLimit"]
        CACHE_IMPL["CacheImpl\nInMemoryCache\n(Redis opcional)"]
        LOG_IMPL["LoggerImpl\nStructuredLogger (JSON)"]
        DI["DI Container\nAwilix / Manual"]
    end

    PI --> PI_BRIDGE
    PI --> TOOL_REGISTRY
    USER --> CMD_REGISTRY
    USER --> TUI_RENDER

    PI_BRIDGE --> PORT_EVENTS
    TOOL_REGISTRY --> APP_SVC
    CMD_REGISTRY --> APP_SVC

    APP_SVC --> DOMAIN_INTENT
    APP_SVC --> DOMAIN_CURATOR
    APP_SVC --> DOMAIN_ENT
    APP_SVC -.-> APP_MW
    APP_SVC -.-> APP_EVENTS

    APP_SVC --> PORT_KB
    APP_SVC --> PORT_SESSION
    APP_SVC --> PORT_FS
    APP_SVC --> PORT_CACHE
    APP_SVC --> PORT_LOGGER
    APP_SVC --> PORT_EVENTS

    OV_ADAPTER --> PORT_KB
    OV_ADAPTER --> PORT_SESSION
    OV_ADAPTER --> PORT_FS
    OV_ADAPTER --> OV_TRANSPORT
    OV_TRANSPORT -->|HTTP| OV

    CACHE_IMPL --> PORT_CACHE
    LOG_IMPL --> PORT_LOGGER
    DI --> OV_ADAPTER
    DI --> CACHE_IMPL
    DI --> LOG_IMPL
    DI --> APP_SVC
```

---

## 2. Ports (Interfaces do Domínio)

### KnowledgeBase

```typescript
interface KnowledgeBase {
  search(query: SearchQuery): Promise<SearchResult>;
  glob(pattern: string, limit?: number): Promise<GlobResult>;
  grep(pattern: string, opts?: GrepOptions): Promise<GrepResult>;
  write(uri: Uri, content: Content): Promise<WriteResult>;
  download(uri: Uri): Promise<Buffer>;
  reindex(uri: Uri, recursive?: boolean): Promise<TaskRef>;
  // Grafo
  link(source: Uri, target: Uri, predicate?: string): Promise<LinkResult>;
  unlink(source: Uri, target: Uri): Promise<void>;
  graph(uri: Uri, depth?: number): Promise<GraphResult>;
}
```

### SessionStore

```typescript
interface SessionStore {
  create(): Promise<SessionId>;
  sendMessage(sessionId: SessionId, role: string, content: Part[]): Promise<void>;
  commit(sessionId: SessionId): Promise<CommitResult>;
  getTaskStatus(taskId: string): Promise<TaskStatus>;
  sessionUsed(sessionId: SessionId, contexts: Uri[]): Promise<void>;
}
```

### FsStore

```typescript
interface FsStore {
  read(uri: Uri, level?: ContentLevel): Promise<Content>;
  list(uri: Uri, recursive?: boolean): Promise<FsEntry[]>;
  tree(uri: Uri): Promise<FsEntry[]>;
  stat(uri: Uri): Promise<FsEntry>;
  mkdir(uri: Uri): Promise<void>;
  mv(from: Uri, to: Uri): Promise<void>;
}
```

### EventBus

```typescript
type DomainEvent =
  | { type: 'SESSION_STARTED'; sessionId: string; cwd: string }
  | { type: 'SESSION_ENDED'; sessionId: string }
  | { type: 'MESSAGE_PROCESSED'; sessionId: string; role: string }
  | { type: 'MEMORY_SAVED'; uri: string }
  | { type: 'INTENT_DETECTED'; category: string; confidence: number }
  | { type: 'RECALL_EXECUTED'; itemsCount: number; durationMs: number }
  | { type: 'ERROR'; source: string; error: string };

interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(type: string, handler: Function): () => void;
}
```

---

## 3. Design Patterns

### 3.1 Command Pattern — Toda ação é um comando

```typescript
interface Command<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}

class SearchKnowledgeCommand implements Command<SearchInput, SearchOutput> {
  constructor(
    private knowledge: KnowledgeBase,
    private intentDetector: IntentDetector,
    private curator: RecallCurator,
  ) {}

  async execute(input: SearchInput): Promise<SearchOutput> {
    if (!this.intentDetector.shouldRecall(input.query)) {
      return { items: [], total: 0 };
    }
    const results = await this.knowledge.search(input.toQuery());
    return {
      items: this.curator.curate(results, input.query),
      total: results.total,
    };
  }
}
```

### 3.2 Chain of Responsibility — Intent Detection

```
ContinuationHandler → ComplexQueryHandler → SimpleQueryHandler → LearnedRejectionHandler

Cada handler:
  1. Tenta classificar o prompt
  2. Se confidence >= threshold, retorna
  3. Se não, passa para o próximo
  4. Se nenhum match, default conservador (recall off)
```

### 3.3 Middleware Pipeline — Cross-cutting concerns

```
Request → LoggingMiddleware → CacheMiddleware → MetricsMiddleware → Handler → Response
                                    │
                           CacheStore (get/set)
```

### 3.4 Event Bus — Desacopla reações

```
PiEventBridge → publish(SESSION_STARTED) → AutoCommitHandler
                                          → StatusBarHandler
                                          → ProfileDetectHandler
```

---

## 4. Fluxos Principais

### 4.1 Auto-Recall

```mermaid
flowchart TD
    A["before_agent_start"] --> B{"OV healthy?"}
    B -->|"nao"| C["skip"]
    B -->|"sim"| D["intentDetector.shouldRecall()"]
    D -->|"nao"| E["skip (economia de tokens)"]
    D -->|"sim"| F["profileManager.resolve()"]
    F --> G["knowledge.search(query, targetUri, mode, limit)"]
    G --> H["curator.curate(score, dedup, budget)"]
    H --> I{"expandGraph?"}
    I -->|"sim"| J["knowledge.graph(seed) + merge"]
    J --> K["inject <relevant-memories> into prompt"]
    I -->|"nao"| K
```

### 4.2 Session Sync

```mermaid
sequenceDiagram
    participant Pi as Pi Agent
    participant Bridge as PiEventBridge
    participant Bus as EventBus
    participant Svc as SessionService
    participant OV as OpenViking

    Pi->>Bridge: message_end
    Bridge->>Bus: publish(MESSAGE_PROCESSED)
    Bus->>Svc: handle(event)
    Svc->>OV: sendMessage(sessionId, parts)
    OV-->>Svc: 200
    Svc->>Bus: publish(MESSAGE_SENT)
```

### 4.3 Auto-Action (Propositivo)

```mermaid
sequenceDiagram
    participant Bus as EventBus
    participant Detector as Detector
    participant Proposer as Proposer
    participant Executor as Executor
    participant OV as OpenViking

    Bus->>Detector: MESSAGE_PROCESSED
    Detector->>Detector: analisa padrões
    Detector->>Proposer: Signal{decision, 0.85}
    Proposer->>OV: search(query)
    OV-->>Proposer: related resources
    Proposer-->>User: "Salvar decisão?"
    User->>Executor: Confirmar
    Executor->>OV: POST /content/write
    Executor->>OV: POST /relations/link
```

---

## 5. Estrutura de Diretórios

```
src/
├── domain/                    # Pure TS. Sem imports externos.
│   ├── entities/              # KnowledgeItem, SessionId, Uri, RecallItem
│   ├── ports/                 # KnowledgeBase, SessionStore, FsStore, EventBus
│   ├── intent/                # Chain of Responsibility handlers
│   ├── curator/               # Scoring, dedup, budget trim
│   └── errors/                # DomainError hierarchy
│
├── application/               # Casos de uso
│   ├── services/              # search, write, session, recall, backup
│   ├── commands/              # Command handlers
│   ├── middleware/            # Pipeline + middlewares
│   └── event-handlers/        # Reações a DomainEvents
│
├── adapters/
│   ├── driving/               # Entram no sistema
│   │   ├── pi/                # PiEventBridge, ToolRegistry, CommandRegistry
│   │   └── tui/               # Renderers
│   └── driven/                # Saem do sistema
│       ├── openviking/        # Adapter + Transport + Mappers
│       ├── cache/             # InMemoryCache / RedisCache
│       ├── config/            # Zod schema + loader
│       └── logger/            # StructuredLogger
│
├── infrastructure/            # DI container, lifecycle
│   └── di/                    # Container + modules
│
├── _legacy/                   # Código original (referência)
├── index.ts                   # Entry point
└── bootstrap.ts               # Startup wiring
```

---

## 6. Princípios Arquiteturais

1. **Domain pure** — Núcleo não importa Pi, OV, HTTP, nada externo
2. **Ports > Implementations** — Interfaces primeiro, implements depois
3. **Event-driven** — Reações desacopladas via EventBus
4. **Autonomia progressiva** — off → propose → auto
5. **Silent by default** — Nunca pergunte o que pode ser inferido
6. **Graceful degradation** — OV offline não quebra o Pi
7. **Pipeline de middlewares** — Cross-cutting concerns empilháveis
8. **Cascading config** — Default → env → file → profile → inline
