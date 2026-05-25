# pi-openviking — Context (Reborn)

> Arquitetura hexagonal. Rewrite do zero. Código legado em `src/_legacy/` mantido como referência.

## Purpose

Pi extension that integrates OpenViking as a **long-term memory and resource backend** for coding agents. Not a generic OV client — a focused memory plugin.

Pi owns session history, prompt orchestration, and tool execution. OpenViking owns long-term memory retrieval, resource storage, and memory extraction.

## Implementação atual

Fase 1 (Foundation) em andamento. Módulos entregues:

| Módulo | Status | Localização |
|--------|--------|-------------|
| Config Schema (Zod) — facade | ✅ Entregue | `src/infrastructure/config/schema.ts` |
| Logger Config Schema | ✅ Entregue | `src/infrastructure/config/logger-schema.ts` |
| Profile Config Schema | ✅ Entregue | `src/infrastructure/config/profile-schema.ts` |
| Config Schema tests | ✅ Entregue | `src/infrastructure/config/schema.test.ts` |
| Config Cascade + Loader | ⬜ Pendente | `src/infrastructure/config/cascade.ts`, `loader.ts` |
| Logger Interface + LogLevel type | ✅ Entregue | `src/domain/ports/logger.ts` |
| Logger Interface tests | ✅ Entregue | `src/domain/ports/logger.test.ts` |
| File Logger | ✅ Entregue | `src/adapters/driven/logger/file-logger.ts` |
| File Logger tests | ✅ Entregue | `src/adapters/driven/logger/file-logger.test.ts` |
| DI Container | ✅ Entregue | `src/infrastructure/di/container.ts` |
| Lifecycle + Bootstrap | ⬜ Pendente | `src/infrastructure/lifecycle.ts`, `src/bootstrap.ts` |

Próximas fases: Domain Ports (2), OV Adapter (3), Operations (4), Tools+Commands (5), Auto-Recall (6), Profiles (7), Features (8).

## Architecture

```
src/
├── domain/                    # Enterprise logic + port interfaces
│   └── ports/                 # Interfaces (Logger, KnowledgeBase, etc.)
│       ├── logger.ts              # ✅ Logger interface
│       └── logger.test.ts         # ✅ 5 tests
├── adapters/
│   └── driven/                # Implementações de portas
│       └── logger/
│           ├── file-logger.ts          # ✅ FileLogger com rotação + gzip
│           └── file-logger.test.ts     # ✅ 8 testes
├── infrastructure/            # Config, DI, lifecycle
│   ├── config/
│   │   ├── schema.ts              # ✅ Facade — compõe logger + profile
│   │   ├── logger-schema.ts       # ✅ Zod schema + LoggerConfig type
│   │   ├── profile-schema.ts      # ✅ Zod schema + ProfileConfig + built-ins
│   │   ├── cascade.ts             # ⬜ default → env → settings.json → profile
│   │   ├── loader.ts              # ⬜ safeParse, erro claro
│   │   ├── schema.test.ts         # ✅ 13 testes
│   │   ├── cascade.test.ts        # ⬜
│   │   └── loader.test.ts         # ⬜
│   ├── path-resolver.ts           # ✅ resolveHome() — shared utility
│   ├── path-resolver.test.ts      # ✅ 3 testes
│   ├── di/
│   │   ├── container.ts       # ✅ DI container manual (21 linhas)
│   │   └── container.test.ts  # ✅ 4 testes
│   └── lifecycle.ts           # ⬜ init() + shutdown()
├── bootstrap.ts               # ⬜ orquestra init()
├── index.ts                   # entry point
└── _legacy/                   # Código original intacto
tests/
├── global-setup.ts            # Infra compartilhada (docker compose OV test)
└── _legacy/                   # Testes do código legado
```

## Core Glossary

| Term | Meaning |
|------|---------|
| **Pi** | Coding agent harness (session manager, tools, prompt builder) |
| **OV** | OpenViking server — context database with filesystem paradigm |
| **Config Schema** | Zod schema que define, valida e fornece defaults para toda config do plugin. Fonte única de verdade. Exporta tipo `PiOVConfig` inferido via `z.infer` |
| **Config Cascade** | Ordem de resolução: defaults compilados → env vars (`OV_*`) → `.pi/settings.json` → perfil ativo. Merge raso encadeado |
| **Profile** | Preset nomeado de config. 4 built-in: `default`, `web-dev`, `docs`, `learning`. Apenas `name` + `description` na Fase 1 |
| **Logger** | Interface em `domain/ports/` com métodos `info`, `warn`, `error`, `debug`, `isEnabled` + `ctx` opcional. `LogLevel` type (`"debug"|"info"|"warn"|"error"`) definido no domínio |
| **File Logger** | Implementação em `adapters/driven/logger/`. JSON lines via `appendFileSync`. Rotação por tamanho (10MB) e idade (7 dias), até 5 arquivos |
| **DI Container** | Container manual (21 linhas, 4 testes). Registro por string token. Suporte a singleton e factory. Erro claro se token não registrado |
| **Lifecycle** | `init()` async (cria logger, container, registra tudo) e `shutdown()` sync (reseta estado, zero I/O) |

## Design Decisions (Foundation)

- **Config Schema** é a única fonte de verdade para tipos de config. `ConfigSchema.parse({})` preenche todos os defaults. Tipos TS são inferidos via `z.infer` — zero duplicação manual.
- **Config Cascade** usa merge raso encadeado (Object.assign). Cada fonte sobrescreve chaves da anterior. Zod valida o resultado final.
- **Perfis** são extensíveis por design — campos OV-specific (endpoint, target_uri, etc.) entram na Fase 4 sem quebrar o schema.
- **Logger interface** em domain/ports garante que o core nunca dependa de implementação concreta. A interface é pura — zero dependências externas.
- **File Logger** mantém a estratégia de `appendFileSync` do ADR-002, mas agora por trás da interface Logger. Rotação por tamanho + idade. Gzip de arquivos antigos.
- **DI Container** é manual (21 linhas, 4 testes) e sem dependências externas. Substituível por Awilix se a complexidade crescer (decidir depois da Fase 5).
- **Bootstrap** (`init()`) é async (prepara para health check na Fase 2/3). `shutdown()` é sync (ADR-001 — zero I/O no shutdown).
- **Zod v4** usado (versão do peer dependency `@earendil-works/pi-ai`). Atenção: `z.record()` exige 2 argumentos (key + value schema). `.default({})` em schemas aninhados não resolve defaults recursivos — usar factory `default(() => ChildSchema.parse({}))`.
- **ADR-002** (file-based logging) respeitado e reformulado: agora com interface + implementação + rotação.
- **ADR-008** (init async) preparado: `init()` é async para health check futuro.
- **Distribuição**: git-only via `pi install git:github.com/dslara/pi-openviking`. Pre-alpha (`0.1.0`).

## Architecture Decision Records

- **ADR-002**: File-based logging com interface `Logger` + `FileLogger` com rotação
- **ADR-008**: Init assíncrono com timeout (prepara health check futuro)

ADRs legados (0001, 0003-0007, 0009) movidos para `docs/adr/_legacy/` — descrevem o sistema anterior em `src/_legacy/`.
