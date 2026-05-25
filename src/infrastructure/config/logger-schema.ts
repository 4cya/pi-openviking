import { z } from "zod";

export const LoggerConfigSchema = z.object({
  path: z.string().default("~/.pi/agent/pi-openviking.log"),
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  maxSize: z.number().positive().default(10 * 1024 * 1024),
  maxFiles: z.number().int().positive().default(5),
  maxAge: z.number().positive().default(7 * 24 * 60 * 60 * 1000),
});

export type LoggerConfig = z.infer<typeof LoggerConfigSchema>;
