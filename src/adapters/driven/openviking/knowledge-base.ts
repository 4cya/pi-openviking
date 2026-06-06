import type { Transport } from "./transport";
import { toSearchResult, toGlobResult, toGrepResult } from "./mappers/search-mapper";
import type { KnowledgeBase } from "../../../domain/ports/knowledge-base";
import type { FindQuery, SearchRequest } from "../../../domain/common/search-query";
import type { GrepOptions } from "../../../domain/ports/knowledge-base";
import type { SearchResult } from "../../../domain/knowledge/model/search-result";
import type { GlobResult, GrepResult } from "../../../domain/ports/knowledge-base";

export class KnowledgeBaseAdapter implements KnowledgeBase {
  constructor(private readonly transport: Transport) {}

  async find(query: FindQuery, signal?: AbortSignal): Promise<SearchResult> {
    const body: Record<string, unknown> = { query: query.query };
    if (query.limit !== undefined) body.node_limit = query.limit;
    if (query.targetUri) body.target_uri = query.targetUri.value;

    const raw = await this.transport.request<Record<string, unknown>>(
      "KnowledgeBase.find",
      "/api/v1/search/find",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    );

    return toSearchResult(raw);
  }

  async search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResult> {
    const body: Record<string, unknown> = { query: request.query };
    if (request.limit !== undefined) body.node_limit = request.limit;
    if (request.sessionId) body.session_id = request.sessionId.value;
    if (request.targetUri) body.target_uri = request.targetUri.value;

    const raw = await this.transport.request<Record<string, unknown>>(
      "KnowledgeBase.search",
      "/api/v1/search/search",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    );

    return toSearchResult(raw);
  }

  async glob(pattern: string, uri?: string, limit?: number, signal?: AbortSignal): Promise<GlobResult> {
    const body: Record<string, unknown> = { pattern };
    if (uri !== undefined) body.uri = uri;
    if (limit !== undefined) body.node_limit = limit;

    const raw = await this.transport.request<Record<string, unknown>>(
      "KnowledgeBase.glob",
      "/api/v1/search/glob",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    );

    return toGlobResult(raw);
  }

  async grep(pattern: string, opts?: GrepOptions, signal?: AbortSignal): Promise<GrepResult> {
    const body: Record<string, unknown> = {
      pattern,
      uri: opts?.uri ?? "",
    };
    if (opts?.caseInsensitive !== undefined) body.case_insensitive = opts.caseInsensitive;
    if (opts?.excludeUri !== undefined) body.exclude_uri = opts.excludeUri;
    if (opts?.levelLimit !== undefined) body.level_limit = opts.levelLimit;
    if (opts?.nodeLimit !== undefined) body.node_limit = opts.nodeLimit;

    const raw = await this.transport.request<Record<string, unknown>>(
      "KnowledgeBase.grep",
      "/api/v1/search/grep",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    );

    return toGrepResult(raw);
  }
}
