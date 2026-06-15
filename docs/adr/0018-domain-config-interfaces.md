# ADR-018: Domain-facing config interfaces in domain/common/

Config types (`RecallConfig`, `ProfileConfig`, `ProfileBehavior`) were defined in
`infrastructure/config/` via `z.infer` from Zod schemas. Domain services imported
them directly, creating a hidden dependency from domain to infrastructure and
typing the domain to Zod-inferred shapes rather than to its own contract.

**Decision:** Define canonical config interfaces in `domain/common/` as plain
TypeScript interfaces with `readonly` fields. Infra Zod schemas keep their names
(`RecallConfigSchema`) and export inferred types under distinct names
(`RecallConfigSchemaType`). Domain services and adapters import from
`domain/common/`. Infra code (`cascade.ts`, `lifecycle.ts`) imports the Zod
schema types.

Pattern per file:
- `domain/common/recall-config.ts` → `RecallConfig` interface (all fields except
  `targetUri` required — Zod applies defaults before domain receives the config)
- `domain/common/profile-config.ts` → `ProfileBehavior` (derived as
  `Partial<Pick<RecallConfig, 6 overridable fields>>`) + `ProfileConfig`
  interface (name, description, behavior)
- `infrastructure/config/schema.ts` → drops `export type { RecallConfig }`,
  exports `RecallConfigSchemaType`
- `infrastructure/config/profile-schema.ts` → exports
  `ProfileConfigSchemaType`, `ProfileBehaviorSchemaType`

## Considered Options

- **Single config port in `domain/ports/config.ts`** — rejected because config is
  data, not behaviour. Ports are interfaces that adapters implement; config is
  a value object consumed by domain services.
- **Per-consumer config files in `domain/ports/`** — same objection: ports are
  the wrong layer for data types.
- **Keep types in infra, use `import type` only** — `import type` erases at
  compile time but the conceptual dependency remains. Domain should declare
  the shape it expects, not import what infra decided.
- **Split `RecallConfig` into per-service views** (e.g. `RecallServiceConfig`,
  `RecallCuratorConfig`) — rejected as premature. One canonical shape covers
  all current consumers; split when a consumer truly diverges.

## Consequences

- 2 new files in `domain/common/`, 11 import changes across domain and adapters.
- Zod schema can evolve independently (add fields, change defaults) without
  touching domain types — as long as the inferred type is structurally
  assignable to the domain interface.
- ProfileBehavior fields are locked to a subset of RecallConfig via
  `Partial<Pick<...>>`. Adding a new overridable field requires updating both
  the Zod schema and the type literal union in `domain/common/profile-config.ts`.
