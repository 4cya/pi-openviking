import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Pipeline } from "../../../domain/pipeline/pipeline";
import type { SearchService } from "../../../domain/services/search-service";
import type { SearchResult } from "../../../domain/knowledge/model/search-result";

const SearchSchema = Type.Object({
  query: Type.String({ description: "Search query" }),
  mode: Type.Optional(
    Type.Union(
      [Type.Literal("auto"), Type.Literal("find"), Type.Literal("search")],
      { description: 'Search mode: "auto" uses config default, "find" for simple semantic search, "search" for deep intent-aware search' },
    ),
  ),
  limit: Type.Optional(Type.Number({ description: "Maximum results" })),
  targetUri: Type.Optional(Type.String({ description: "Target URI scope" })),
  peerId: Type.Optional(Type.String({ description: "Stable interaction peer ID. When set, search includes memories from this peer" })),
});

export function createOvSearchTool(
  svc: SearchService,
  pipeline: Pipeline<SearchResult>,
): ToolDefinition<typeof SearchSchema> {
  return defineTool({
    name: "ov_search",
    label: "Search Knowledge",
    description: "Primary knowledge base for project memories, decisions, and patterns. ALWAYS check here first before using generic search tools. Supports fast (semantic find) and deep (intent-aware search) modes.",
    promptSnippet: "ov_search(query, mode?, limit?, targetUri?) — search knowledge base",
    parameters: SearchSchema,
    async execute(_toolCallId, params, signal) {
      try {
        const result = await pipeline.execute(
          () => svc.search({
            query: params.query!,
            mode: params.mode ?? "auto",
            limit: params.limit,
            targetUri: params.targetUri,
            peerId: params.peerId,
          }, signal ?? undefined),
          signal ?? undefined,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: undefined,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Search failed: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },
  });
}
