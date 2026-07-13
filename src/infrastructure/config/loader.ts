import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export function readSettings(cwd: string, namespace?: string): Record<string, unknown> {
  // Standalone config file ~/.pi/agent/pi-openviking.json (highest priority)
  const standalonePath = join(homedir(), ".pi", "agent", "pi-openviking.json");
  if (existsSync(standalonePath)) {
    try {
      return JSON.parse(readFileSync(standalonePath, "utf-8")) as Record<string, unknown>;
    } catch {
      // Parse error — fall through to next candidates
    }
  }

  // Try cwd first, then fall back to home directory .pi/settings.json
  const candidates = [
    join(cwd, ".pi", "settings.json"),
    join(homedir(), ".pi", "settings.json"),
  ];

  for (const filePath of candidates) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const all = JSON.parse(raw) as Record<string, unknown>;
      if (namespace) {
        const ns = all[namespace];
        if (typeof ns === "object" && ns !== null && !Array.isArray(ns)) {
          return ns as Record<string, unknown>;
        }
        // Namespace not found in this file, try next candidate
        continue;
      }
      return all;
    } catch {
      // File not found or parse error, try next candidate
    }
  }

  return {};
}
