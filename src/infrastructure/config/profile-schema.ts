import { z } from "zod";

// ── ProfileBehavior ───────────────────────────────────────────────────────────

export const ProfileBehaviorSchema = z.object({
  targetUri: z.string().optional(),
  topN: z.number().int().positive().optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
  searchMode: z.enum(["find", "search"]).optional(),
  expandGraph: z.boolean().optional(),
  autoRecall: z.boolean().optional(),
});

export type ProfileBehavior = z.infer<typeof ProfileBehaviorSchema>;

// ── ProfileConfig ─────────────────────────────────────────────────────────────

export const ProfileConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  behavior: ProfileBehaviorSchema.default({}),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;

export const BUILTIN_PROFILES: Record<string, ProfileConfig> = {
  default: {
    name: "default",
    description: "Perfil padrão — equilibrado",
    behavior: {
      topN: 3,
      scoreThreshold: 0.5,
      searchMode: "search",
      autoRecall: true,
    },
  },
  "web-dev": {
    name: "web-dev",
    description: "Desenvolvimento web — contexto focado",
    behavior: {
      topN: 3,
      scoreThreshold: 0.5,
      searchMode: "search",
      autoRecall: true,
    },
  },
  docs: {
    name: "docs",
    description: "Documentação — busca ampla",
    behavior: {
      topN: 5,
      scoreThreshold: 0.3,
      searchMode: "search",
      autoRecall: true,
    },
  },
  learning: {
    name: "learning",
    description: "Aprendizado — captura tudo",
    behavior: {
      topN: 8,
      scoreThreshold: 0.2,
      searchMode: "search",
      autoRecall: true,
    },
  },
};

export const ProfileSectionSchema = z.object({
  activeProfile: z.string().default("default"),
  profiles: z.record(z.string(), ProfileConfigSchema).default(BUILTIN_PROFILES),
  autoDetectRules: z.record(z.string(), z.string()).default({}),
});

type ProfileSectionConfig = z.infer<typeof ProfileSectionSchema>;
