import { LoggerConfigSchema } from "./logger-schema";
import { ProfileSectionSchema } from "./profile-schema";
import { z } from "zod";

export { LoggerConfig } from "./logger-schema";
export { ProfileConfig, ProfileSectionConfig, BUILTIN_PROFILES } from "./profile-schema";

// ── Root config ──────────────────────────────────────────────────────────────

// ── OV Adapter config ─────────────────────────────────────────────────────────

export const OVAdapterConfigSchema = z.object({
  endpoint: z.string().url().default("http://localhost:1933"),
  apiKey: z.string().default(""),
  account: z.string().default("pi"),
  user: z.string().default("default"),
  timeout: z.number().positive().default(30_000),
  commitTimeout: z.number().positive().default(120_000),
  maxRetries: z.number().int().min(0).default(3),
  rateLimitPerSecond: z.number().min(0).default(0),
});

export type OVAdapterConfig = z.infer<typeof OVAdapterConfigSchema>;

export const ConfigSchema = z.object({
  logger: LoggerConfigSchema.default(() => LoggerConfigSchema.parse({})),
  profile: ProfileSectionSchema.default(() => ProfileSectionSchema.parse({})),
  ov: OVAdapterConfigSchema.default(() => OVAdapterConfigSchema.parse({})),
});

export type PiOVConfig = z.infer<typeof ConfigSchema>;

// ── Default config ───────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: PiOVConfig = ConfigSchema.parse({});
