import type { KnowledgeBase, GlobResult, GrepResult } from "../ports/knowledge-base";
import type { SearchResult } from "../knowledge/model/search-result";
import type { RecallConfig } from "../common/recall-config";
import type { Logger } from "../ports/logger";
import { Uri } from "../common/uri";

interface SearchParams {
  query: string;
  mode: "auto" | "find" | "search";
  limit?: number;
  targetUri?: string;
}

export class SearchService {
  constructor(
    private readonly kb: KnowledgeBase,
    private readonly config: RecallConfig,
    private readonly logger: Logger,
  ) {}

  async search(params: SearchParams, signal?: AbortSignal): Promise<SearchResult> {
    const mode = params.mode === "auto" ? this.config.searchMode : params.mode;
    const targetUri = params.targetUri ? new Uri(params.targetUri) : undefined;

    if (mode === "find") {
      return this.kb.find({ query: params.query, limit: params.limit, targetUri }, signal);
    }
    return this.kb.search({ query: params.query, limit: params.limit, targetUri, sessionId: undefined }, signal);
  }

  async glob(pattern: string, uri?: string, limit?: number, signal?: AbortSignal): Promise<GlobResult> {
    return this.kb.glob(pattern, uri, limit, signal);
  }

  async grep(pattern: string, opts?: Parameters<KnowledgeBase["grep"]>[1], signal?: AbortSignal): Promise<GrepResult> {
    return this.kb.grep(pattern, opts, signal);
  }
}
