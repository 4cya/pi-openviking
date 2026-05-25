import { z } from "zod";

// ── Logger config ────────────────────────────────────────────────────────────

const LoggerConfigSchema = z.object({
  path: z.string().default("~/.pi/agent/pi-openviking.log"),
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  maxSize: z.number().positive().default(10 * 1024 * 1024),
  maxFiles: z.number().int().positive().default(5),
  maxAge: z.number().positive().default(7 * 24 * 60 * 60 * 1000),
});

export type LoggerConfig = z.infer<typeof LoggerConfigSchema>;

// ── Profile config ───────────────────────────────────────────────────────────

const ProfileConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;

// ── Built-in profiles ────────────────────────────────────────────────────────

export const BUILTIN_PROFILES: Record<string, ProfileConfig> = {
  default: {
    name: "default",
    description: "Perfil padrão — equilibrado",
  },
  "web-dev": {
    name: "web-dev",
    description: "Desenvolvimento web — contexto focado",
  },
  docs: {
    name: "docs",
    description: "Documentação — busca ampla",
  },
  learning: {
    name: "learning",
    description: "Aprendizado — captura tudo",
  },
};

// ── Profile section ──────────────────────────────────────────────────────────

const ProfileSectionSchema = z.object({
  activeProfile: z.string().default("default"),
  profiles: z.record(z.string(), ProfileConfigSchema).default(BUILTIN_PROFILES),
});

// ── Root config ──────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  logger: LoggerConfigSchema.default(() => LoggerConfigSchema.parse({})),
  profile: ProfileSectionSchema.default(() => ProfileSectionSchema.parse({})),
});

export type PiOVConfig = z.infer<typeof ConfigSchema>;

// ── Default config ───────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: PiOVConfig = ConfigSchema.parse({});
