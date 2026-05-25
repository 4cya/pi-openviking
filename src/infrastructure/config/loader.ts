import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readSettings(cwd: string): Record<string, unknown> {
  try {
    const raw = readFileSync(join(cwd, ".pi", "settings.json"), "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
