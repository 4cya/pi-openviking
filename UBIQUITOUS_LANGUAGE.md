# Ubiquitous Language

> Glossário da arquitetura Reborn (Fase 1+). Termos legado em `src/_legacy/` foram omitidos — este documento reflete apenas o novo design hexagonal.

## Systems & Actors

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Pi** | The coding agent harness that owns session history, prompt orchestration, and tool execution | pi-coding-agent, harness |
| **OpenViking** | The long-term memory server providing semantic search, resource storage, and memory extraction | OV, the server |
| **Agent** | The LLM instance orchestrated by Pi that uses tools and produces responses | model, LLM |
| **Extension** | A Pi plugin that registers tools and hooks into session lifecycle events | plugin, add-on |

## Architecture Layers

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Domain** | The innermost layer containing enterprise logic and port interfaces. Zero external dependencies. Lives under `src/domain/` | core, business layer |
| **Port** | An interface declared in the domain layer that an adapter must implement. Examples: `Logger`, `KnowledgeBase`, `SessionStore` | contract, interface |
| **Adapter** | An implementation of a **Port**, living in `src/adapters/`. **Driven** adapters implement domain ports (e.g. `FileLogger`); **Driver** adapters call domain ports (not yet present in Fase 1) | implementation, plugin |
| **Infrastructure** | Cross-cutting concerns: config loading, DI container, lifecycle wiring. Lives under `src/infrastructure/` | framework, wiring layer |

## Foundation (Config & DI)

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Config Schema** | The Zod schema that defines, validates, and provides defaults for all plugin configuration | schema, config definition |
| **Config Cascade** | Config resolution order: compiled defaults → env vars (`OV_*`) → `.pi/settings.json` → active **Profile**. Each source overrides the previous via shallow merge | merge, resolution chain |
| **Profile** | A named config preset containing `name` and `description` in Fase 1 (no OV-specific fields until Fase 4). One is always active | config profile, named preset |
| **Built-in Profile** | One of 4 shipped profiles: `default`, `web-dev`, `docs`, `learning` | stock profile, system profile |
| **Logger** | Interface in `domain/ports/logger.ts` with methods `info`, `warn`, `error`, `debug`. Implemented by `FileLogger` in `adapters/driven/logger/` | log, console |
| **File Logger** | Outputs JSON lines via `appendFileSync`. Rotates by size (10MB) and age (7 days), keeps up to 5 gzipped historical files | file logging, persistent logger |
| **DI Container** | Manual dependency injection container (21 lines). Registers dependencies by `string` token; supports singleton and factory lifetime. Throws clear error on unregistered token. 4 tests at `container.test.ts` | container, ioc |
| **Lifecycle** | The `init()` (async, creates logger+container+wires everything) and `shutdown()` (sync, resets state) entry points for the Foundation layer | bootstrap lifecycle, module lifecycle |
| **Bootstrap** | One-time startup that runs **Config Cascade**, creates **Logger**, instantiates **DI Container**, registers all dependencies, and returns a ready extension handle | init, startup |

## Relationships

- The **Config Cascade** resolves config in order: defaults → env vars → `.pi/settings.json` → active **Profile**
- A **Profile** is a named preset in the **Config Schema**'s `profiles` record; exactly one is selected via `activeProfile`
- The **DI Container** is created during **Bootstrap** after **Config Cascade** resolves the final config
- The **Logger** interface lives in `domain/ports/`; the **File Logger** implementation lives in `adapters/driven/logger/`
- The **File Logger** is registered in the **DI Container** as a singleton and consumed by all layers through its **Port** interface
- The **Config Schema** exports `PiOVConfig` type (inferred via `z.infer`) and `DEFAULT_CONFIG` constant — these are used by the **Config Cascade** as the base layer

## Example dialogue

> **Dev:** "How does **Config Cascade** work at startup?"
>
> **Domain expert:** "The **Bootstrap** resolves config in order: compiled defaults → env vars like `OV_LOG_LEVEL` → `.pi/settings.json` → active **Profile**. The **Config Schema** validates the final merged object with Zod. An invalid field like `level: "verbose"` throws a `ZodError` at bootstrap time, not silently at runtime."
>
> **Dev:** "So if I add a new config field, I only touch the **Config Schema**?"
>
> **Domain expert:** "The **Config Schema** is the single source of truth. Update the Zod definition, and the `PiOVConfig` type updates automatically via `z.infer`. The **DI Container** then resolves the validated config as a singleton — every module receives config through the container, not by importing it directly."
>
> **Dev:** "Can I swap the **File Logger** for a different implementation?"
>
> **Domain expert:** "Yes — that's the point of the **Port** interface. The domain code depends only on `Logger` (the interface). As long as the new implementation satisfies that contract, register it in the **DI Container** and the rest of the system doesn't change."
>
> **Dev:** "Where does rotation logic live?"
>
> **Domain expert:** "Inside the **File Logger** — behind the `Logger` interface. The domain layer has zero awareness of rotation, JSON format, or `appendFileSync`. That's what makes the architecture hexagonal: infrastructure details are sealed behind ports."

## Flagged ambiguities

- **"Profile"** is overloaded three ways: (1) **Profile** — a named config preset in the Foundation layer (default, web-dev, docs, learning), (2) OV's internal `cProfile` concept (the server's own profiling mode), (3) a memory category extracted from sessions ("category: profile"). Use **Config Profile** for the Foundation concept, **OV cProfile** for the server concept, and **Memory Profile** for extracted user preferences.
- **"Logger"** can refer either to the `Logger` interface in `domain/ports/` or the `FileLogger` implementation in `adapters/driven/`. Prefer **Logger Interface** vs **File Logger** when disambiguation matters.
- **"Config"** without qualification refers to the plugin's configuration managed by the **Config Schema**. Not to be confused with Pi's own settings (`.pi/settings.json`) or OV's server configuration.
