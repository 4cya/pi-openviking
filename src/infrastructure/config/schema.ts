import { LoggerConfigSchema } from "./logger-schema";
import { ProfileSectionSchema } from "./profile-schema";
import { z } from "zod";

export { LoggerConfig } from "./logger-schema";
export { ProfileConfig, ProfileSectionConfig, BUILTIN_PROFILES } from "./profile-schema";

// ── Root config ──────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  logger: LoggerConfigSchema.default(() => LoggerConfigSchema.parse({})),
  profile: ProfileSectionSchema.default(() => ProfileSectionSchema.parse({})),
});

export type PiOVConfig = z.infer<typeof ConfigSchema>;

// ── Default config ───────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: PiOVConfig = ConfigSchema.parse({});
