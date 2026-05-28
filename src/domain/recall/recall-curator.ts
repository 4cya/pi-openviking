import { curate } from "./curate";
import type { CuratedResult, Scorer } from "./curate";
import type { SearchResult } from "../knowledge/model/search-result";
import type { RecallConfig } from "../../infrastructure/config/schema";
import type { Logger } from "../ports/logger";

export class RecallCurator {
  constructor(
    private readonly config: RecallConfig,
    private readonly scorers: Scorer[],
    private readonly logger: Logger,
  ) {}

  curate(results: SearchResult): CuratedResult {
    const curated = curate(results, {
      topN: this.config.topN,
      scoreThreshold: this.config.scoreThreshold,
      maxTokens: this.config.maxTokens,
      scorers: this.scorers.length > 0 ? this.scorers : undefined,
    });

    this.logger.info(
      `curated ${results.total} items → ${curated.items.length} items, ${curated.tokens} tokens`,
    );

    return curated;
  }
}
