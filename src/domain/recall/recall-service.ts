import type { KnowledgeBase } from "../ports/knowledge-base";
import type { RecallCurator } from "./recall-curator";
import type { CuratedItem, CuratedResult } from "./curate";
import type { RecallConfig } from "../../infrastructure/config/schema";
import type { Logger } from "../ports/logger";
import { ConnectionError } from "../errors/connection-error";
import { Uri } from "../common/uri";
import type { SessionId } from "../common/session-id";

export interface RecallResult {
  items: CuratedItem[];
  tokens: number;
  formatted: string;
  total: number;
}

export class RecallService {
  constructor(
    private readonly kb: KnowledgeBase,
    private readonly curator: RecallCurator,
    private readonly config: RecallConfig,
    private readonly logger: Logger,
    private enabled: boolean,
  ) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(`recall ${enabled ? "enabled" : "disabled"}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async recall(prompt: string, sessionId?: SessionId): Promise<RecallResult> {
    if (!this.enabled) {
      return { items: [], tokens: 0, formatted: "", total: 0 };
    }

    try {
      const targetUri = this.config.targetUri ? new Uri(this.config.targetUri) : undefined;
      const result = this.config.searchMode === "find"
        ? await this.kb.find({ query: prompt, limit: this.config.topN, targetUri })
        : await this.kb.search({ query: prompt, limit: this.config.topN, sessionId, targetUri });

      const curated: CuratedResult = await this.curator.curate(result);
      return {
        items: curated.items,
        tokens: curated.tokens,
        formatted: this.formatItems(curated.items),
        total: curated.items.length,
      };
    } catch (err) {
      if (err instanceof ConnectionError) {
        this.logger.warn(`OV unavailable, skipping recall`);
        return { items: [], tokens: 0, formatted: "", total: 0 };
      }
      throw err;
    }
  }

  private formatItems(items: CuratedItem[]): string {
    if (items.length === 0) return "";
    const header = "📋 OpenViking found relevant memories. Use `ov_search` to explore deeper or `ov_recall` for targeted search on a specific topic.";
    const body = items.map(i => `[${i.source}] ${i.uri}\n${i.text}`).join("\n\n");
    return `${header}\n---\n${body}`;
  }
}
