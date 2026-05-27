import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readSettings(cwd: string, namespace?: string): Record<string, unknown> {
  try {
    const raw = readFileSync(join(cwd, ".pi", "settings.json"), "utf-8");
    const all = JSON.parse(raw) as Record<string, unknown>;
    if (namespace) {
      const ns = all[namespace];
      return typeof ns === "object" && ns !== null && !Array.isArray(ns)
        ? ns as Record<string, unknown>
        : {};
    }
    return all;
  } catch {
    return {};
  }
}
