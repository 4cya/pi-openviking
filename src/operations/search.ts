import type { KnowledgeClient, SearchResult } from "../ov-client/client";

export interface SearchOpOpts {
  sessionId?: string;
  query: string;
  limit?: number;
  mode?: "auto" | "fast" | "deep";
  uri?: string;
}

export async function searchOp(
  knowledge: KnowledgeClient,
  opts: SearchOpOpts,
  signal?: AbortSignal,
): Promise<SearchResult> {
  return knowledge.search(
    opts.sessionId,
    opts.query,
    opts.limit ?? 10,
    opts.mode ?? "auto",
    opts.uri,
    signal,
  );
}
