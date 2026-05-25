import { readSettings } from "./loader";
import { ConfigSchema, DEFAULT_CONFIG } from "./schema";
import type { PiOVConfig } from "./schema";

export function loadConfig(cwd: string): PiOVConfig {
  // 1. Start with defaults
  const config: Record<string, unknown> = structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;

  // 2. Overlay env vars — tabela declarativa
  const ENV_TO_PATH: Record<string, { path: string; parse?: (v: string) => unknown }> = {
    OV_LOG_PATH:       { path: "logger.path" },
    OV_LOG_LEVEL:      { path: "logger.level" },
    OV_LOG_MAX_SIZE:   { path: "logger.maxSize", parse: Number },
    OV_LOG_MAX_FILES:  { path: "logger.maxFiles", parse: Number },
    OV_LOG_MAX_AGE:    { path: "logger.maxAge", parse: Number },
    OV_ACTIVE_PROFILE: { path: "profile.activeProfile" },
  };

  for (const [envKey, { path, parse }] of Object.entries(ENV_TO_PATH)) {
    const val = process.env[envKey];
    if (val !== undefined) {
      setNested(config, path, parse ? parse(val) : val);
    }
  }

  // 3. Overlay file settings
  const fileSettings = readSettings(cwd);
  mergeShallow(config, fileSettings);

  // 4. Overlay profile settings (future — no profile-specific fields yet)
  // Profiles only carry name+description in Fase 1, nothing to overlay

  // 5. Validate with Zod
  const parsed = ConfigSchema.parse(config);

  // 6. Verify activeProfile exists in profiles registry
  if (!parsed.profile.profiles[parsed.profile.activeProfile]) {
    throw new Error(`Config: activeProfile "${parsed.profile.activeProfile}" not found in profiles registry`);
  }

  return parsed;
}

function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) current[keys[i]] = {};
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

function mergeShallow(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    target[key] = source[key];
  }
}
