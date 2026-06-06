/**
 * Domain-facing recall configuration interface.
 *
 * Canonical shape for all recall configuration data flowing through
 * domain services. Infra Zod schema (RecallConfigSchema) produces
 * a structurally compatible type; the binding layer (init/lifecycle)
 * validates assignability at construction time.
 *
 * All fields except targetUri are required — defaults are applied
 * by the Zod schema before the config reaches domain code.
 *
 * recallSearchTimeout: Max wait for OV search (ms). Default 10000 (10s).
 * After a timeout, RecallService enters a 3-turn cooldown to avoid
 * hammering a saturated OV server.
 */
export interface RecallConfig {
  readonly targetUri?: string;
  readonly topN: number;
  readonly scoreThreshold: number;
  readonly maxTokens: number;
  readonly expandGraph: boolean;
  readonly expandGraphDepth: 1;
  readonly expandGraphMaxRatio: number;
  readonly expandGraphMinSeedScore: number;
  readonly searchMode: "find" | "search";
  readonly recallSearchTimeout: number;
  readonly autoRecall: boolean;
}
