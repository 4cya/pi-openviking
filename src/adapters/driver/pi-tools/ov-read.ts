import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Pipeline } from "../../../domain/pipeline/pipeline";
import type { FsStoreService } from "../../../domain/services/fs-store-service";
import type { Content } from "../../../domain/ports/fs-store";

const ReadSchema = Type.Object({
  uri: Type.String({ description: "URI to read (viking://...)" }),
  level: Type.Optional(
    Type.Union(
      [Type.Literal("abstract"), Type.Literal("overview"), Type.Literal("read")],
      { description: 'Content depth: "abstract" (L0), "overview" (L1), "read" (L2 full)' },
    ),
  ),
  offset: Type.Optional(Type.Number({ description: "Line offset for L2 pagination" })),
  limit: Type.Optional(Type.Number({ description: "Max lines for L2 pagination" })),
});

export function createOvReadTool(
  svc: FsStoreService,
  pipeline: Pipeline<Content>,
): ToolDefinition<typeof ReadSchema> {
  return defineTool({
    name: "ov_read",
    label: "Read Content",
    description: "Read content from the OpenViking knowledge base at L0 (abstract), L1 (overview), or L2 (full read) with optional pagination.",
    promptSnippet: "ov_read(uri, level?, offset?, limit?) — read content at abstract/overview/read level",
    parameters: ReadSchema,
    async execute(_toolCallId, params, signal) {
      try {
        const result = await pipeline.execute(
          () => svc.read(params.uri!, params.level, params.offset, params.limit, signal ?? undefined),
          signal ?? undefined,
        );
        return {
          content: [{ type: "text" as const, text: result.body }],
          details: { fullLength: result.body.length, lineCount: result.body.split("\n").length },
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Read failed: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },
    renderResult: (result, _options, _theme, _context) => {
      const text = result.content?.[0]?.text ?? "";
      const lines = text.split("\n");
      const lineCount = result.details?.lineCount ?? lines.length;
      const MAX_PREVIEW = 15;

      if (lines.length <= MAX_PREVIEW) {
        // Short enough — show all
        return {
          type: "text",
          text: text,
        } as any;
      }

      // Long — show preview + stats
      const preview = lines.slice(0, MAX_PREVIEW).join("\n");
      return {
        type: "text",
        text: `${preview}\n\n┌─────────────────────────────────────────────┐\n│ 预览模式 — 显示前 ${MAX_PREVIEW} 行，共 ${lineCount} 行           │\n│ LLM 已获取完整内容                              │\n│ 使用 ov_read(uri, limit:N) 分页查看更多          │\n└─────────────────────────────────────────────┘`,
      } as any;
    },
  });
}
