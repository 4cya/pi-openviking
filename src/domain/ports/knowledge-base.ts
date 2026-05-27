import type { SearchQuery } from "../common/search-query";
import type { SearchResult } from "../knowledge/model/search-result";

export interface GlobResult {
  entries: string[];
  total: number;
}

export interface GrepOptions {
  pattern: string;
  caseSensitive?: boolean;
  maxResults?: number;
}

export interface GrepResult {
  matches: { uri: string; lineNumber?: number; line: string }[];
  total: number;
}

export interface KnowledgeBase {
  search(query: SearchQuery): Promise<SearchResult>;
  glob(pattern: string, uri?: string, limit?: number): Promise<GlobResult>;
  grep(pattern: string, opts?: GrepOptions): Promise<GrepResult>;
}
