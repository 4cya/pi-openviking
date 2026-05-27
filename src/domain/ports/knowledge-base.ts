import type { FindQuery, SearchRequest } from "../common/search-query";
import type { SearchResult } from "../knowledge/model/search-result";

export interface GlobResult {
  entries: string[];
  total: number;
}

export interface GrepOptions {
  pattern: string;
  caseInsensitive?: boolean;
  excludeUri?: string;
  levelLimit?: number;
  nodeLimit?: number;
}

export interface GrepResult {
  matches: { uri: string; lineNumber?: number; line: string }[];
  total: number;
}

export interface KnowledgeBase {
  /** Simple semantic search, no session context. POST /api/v1/search/find */
  find(query: FindQuery): Promise<SearchResult>;
  /** Deep search with session + intent analysis. POST /api/v1/search/search */
  search(request: SearchRequest): Promise<SearchResult>;
  glob(pattern: string, uri?: string, limit?: number): Promise<GlobResult>;
  grep(pattern: string, opts?: GrepOptions): Promise<GrepResult>;
}
