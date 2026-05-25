# Logging file-based (Reformulado para Foundation)

Status: accepted (carried forward from legacy)

## Context

O plugin precisa de logging persistente e estruturado. O legado usava `appendFileSync` direto — sem interface, sem rotação, sem schema. A Fase 1 do Reborn introduz uma interface `Logger` no domínio e uma implementação `FileLogger` no adapter, mantendo a estratégia de escrita síncrona.

## Decision

- `Logger` interface em `domain/ports/logger.ts` com métodos `info`, `warn`, `error`, `debug` e parâmetro `ctx` opcional para dados estruturados
- `FileLogger` em `adapters/driven/logger/file-logger.ts` escreve JSON lines via `appendFileSync`
- Cada linha é um JSON object: `{"ts":"ISO","level":"info","msg":"...","ctx":{...}}`
- Rotação por tamanho (10MB) e idade (7 dias), até 5 arquivos de histórico (.log.1.gz, .log.2.gz, etc.)
- Nível configurável via `ConfigSchema.logger.level` (enum: debug, info, warn, error)
- Path configurável via `ConfigSchema.logger.path` (default: `~/.pi/agent/pi-openviking.log`)
- Nenhum `console.*` em `src/` — a interface `Logger` é o único meio de emitir logs

## Consequences

- Positivo: domínio não depende de implementação concreta — qualquer adapter que implemente `Logger` pode ser injetado
- Positivo: rotação evita consumo ilimitado de disco
- Positivo: JSON lines permitem parse por LLMs, grep e agregadores
- Negativo: `appendFileSync` é síncrono — bloqueia o event loop em cada escrita. Aceitável para logging de baixa frequência
