import type { KnowledgeClient } from "../ov-client/client";
import type { SessionSyncLike } from "../session-sync/session";
import { logger } from "../shared/logger";
import { curate, DEFAULT_CURATE_OPTIONS, type CurateOptions, type RecallItem } from "./recall-curator";

export interface AutoRecallState {
  enabled: boolean;
  lastInjectedItems?: RecallItem[];
}

export interface AutoRecallConfig {
  enabled: boolean;
  limit: number;
  timeout: number;
  curator: CurateOptions;
}

export const DEFAULT_AUTO_RECALL_CONFIG: AutoRecallConfig = {
  enabled: true,
  limit: 10,
  timeout: 5000,
  curator: DEFAULT_CURATE_OPTIONS,
};

export interface AutoRecallEvent {
  prompt: string;
  systemPrompt: string;
  tokenBudget?: number;
}

export function createAutoRecall(
  client: KnowledgeClient,
  sessionSync: SessionSyncLike,
  config: AutoRecallConfig,
): (event: AutoRecallEvent) => Promise<{ systemPrompt?: string; injectedItems: RecallItem[] }> {
  const limit = config.limit;
  const timeoutMs = config.timeout;
  const curateOptions = config.curator;

  return async function autoRecall(event: AutoRecallEvent): Promise<{ systemPrompt?: string; injectedItems: RecallItem[] }> {
    if (!config.enabled) return { injectedItems: [] };

    const sessionId = sessionSync.getOvSessionId();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const results = await client.search(sessionId, event.prompt, limit, "auto", undefined, controller.signal);
      const items = curate(results, event.prompt, curateOptions, event.tokenBudget);
      if (items.length === 0) return { injectedItems: [] };
      const block = renderBlock(items);
      return { systemPrompt: `${event.systemPrompt}\n\n${block}`, injectedItems: items };
    } catch (err) {
      logger.error("auto-recall failed:", (err as Error).message);
      return { injectedItems: [] };
    } finally {
      clearTimeout(timeout);
    }
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBlock(items: RecallItem[]): string {
  const lines: string[] = ["<relevant-memories>"];
  for (const item of items) {
    if (item.type === "memory") {
      lines.push(`<memory score="${item.score.toFixed(2)}">${escapeXml(item.text)}</memory>`);
    } else {
      const attr = `score="${item.score.toFixed(2)}" uri="${escapeXml(item.uri ?? "")}"`;
      lines.push(`<resource ${attr}>${escapeXml(item.text)}</resource>`);
    }
  }
  lines.push("</relevant-memories>");
  lines.push("");
  lines.push("Use the memread tool to retrieve full content of discovered resources.");
  return lines.join("\n");
}
