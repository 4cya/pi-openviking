# Init assíncrono com timeout

Status: accepted (carried forward from legacy)

## Context

A Fase 1 do Reborn precisa de um `init()` assíncrono que carregue config, crie logger, instancie o DI container e registre dependências. O `shutdown()` permanece síncrono e zero I/O.

Fases futuras (3+) vão adicionar health check contra o OV server — o `init()` async prepara esse caminho.

## Decision

- `init(config?)` é `async` — retorna `Promise<void>`
- Carrega config via `Config Cascade`, cria `FileLogger`, instancia `DIContainer`, registra tudo
- `shutdown()` é `sync` — reseta estado apenas, sem I/O
- Entry point (`index.ts`) chama `await init()` e exporta handle

## Consequences

- Positivo: bootstrap não bloqueia startup do Pi (se usado com async registration)
- Positivo: health check futuro (Fase 3+) pode ser `await` dentro do `init()` com timeout
- Negativo: módulo precisa de async handling no ponto de entrada
