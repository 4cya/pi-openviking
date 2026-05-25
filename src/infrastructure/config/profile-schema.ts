import { z } from "zod";

const ProfileConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;

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

export const ProfileSectionSchema = z.object({
  activeProfile: z.string().default("default"),
  profiles: z.record(z.string(), ProfileConfigSchema).default(BUILTIN_PROFILES),
});

export type ProfileSectionConfig = z.infer<typeof ProfileSectionSchema>;
