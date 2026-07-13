import { LoggerConfigSchema } from "./logger-schema";
import { ProfileSectionSchema } from "./profile-schema";
import { z } from "zod";

export { BUILTIN_PROFILES } from "./profile-schema";

// ── UI config ────────────────────────────────────────────────────────────────

const UIConfigSchema = z.object({
  showWidget: z.boolean().default(true),
});

export type UIConfig = z.infer<typeof UIConfigSchema>;

// ── OV Adapter config ─────────────────────────────────────────────────────────

const CircuitBreakerConfigSchema = z.object({
  threshold: z.coerce.number().int().min(1).default(3),
  resetTimeoutMs: z.coerce.number().int().positive().default(30_000),
  maxResetTimeoutMs: z.coerce.number().int().positive().default(300_000),
});

const OVAdapterConfigSchema = z.object({
  endpoint: z.string().url().default("http://localhost:1933"),
  apiKey: z.string().default(""),
  account: z.string().default("default"),
  user: z.string().default("default"),
  agentId: z.string().default("pi"),
  timeout: z.number().positive().default(30_000),
  commitTimeout: z.number().positive().default(15_000),
  maxRetries: z.number().int().min(0).default(3),
  rateLimitPerSecond: z.number().min(0).default(0),
  autoCommitIntervalMs: z.number().min(0).default(300_000),
  circuitBreaker: CircuitBreakerConfigSchema.optional(),
});

export type OVAdapterConfig = z.infer<typeof OVAdapterConfigSchema>;

// ── Recall config ────────────────────────────────────────────────────────────

const RecallConfigSchema = z.object({
  targetUri: z.string().optional(),
  topN: z.number().int().positive().default(8),
  scoreThreshold: z.number().min(0).max(1).default(0.5),
  maxTokens: z.number().int().positive().default(4000),
  expandGraph: z.boolean().default(true),
  expandGraphDepth: z.literal(1).default(1),
  expandGraphMaxRatio: z.number().min(0).max(1).default(0.2),
  expandGraphMinSeedScore: z.number().min(0).max(1).default(0.4),
  searchMode: z.enum(["find", "search"]).default("search"),
  recallSearchTimeout: z.number().positive().default(60_000),
  autoRecall: z.boolean().default(true),
});

export type RecallConfigSchemaType = z.infer<typeof RecallConfigSchema>;

export const ConfigSchema = z.object({
  ui: UIConfigSchema.default(() => UIConfigSchema.parse({})),
  logger: LoggerConfigSchema.default(() => LoggerConfigSchema.parse({})),
  profile: ProfileSectionSchema.default(() => ProfileSectionSchema.parse({})),
  ov: OVAdapterConfigSchema.default(() => OVAdapterConfigSchema.parse({})),
  recall: RecallConfigSchema.default(() => RecallConfigSchema.parse({})),
});

export type PiOVConfig = z.infer<typeof ConfigSchema>;

// ── Default config ───────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: PiOVConfig = ConfigSchema.parse({});
