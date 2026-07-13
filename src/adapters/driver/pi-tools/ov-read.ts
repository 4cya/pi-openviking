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
          details: { fullLength: result.body.length, lineCount: result.body.split("\n").length, uri: params.uri },
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

      const render = (width: number): string[] => {
        if (lines.length <= MAX_PREVIEW) {
          return lines.flatMap((l) => wrapLine(l, width));
        }
        const preview = lines.slice(0, MAX_PREVIEW);
        const output: string[] = [];
        for (const l of preview) {
          output.push(...wrapLine(l, width));
        }
        output.push("");
        output.push(`\x1b[2m┌─────────────────────────────────────────────┐\x1b[0m`);
        output.push(`\x1b[2m│ 预览模式 — 显示前 ${MAX_PREVIEW} 行，共 ${lineCount} 行\x1b[0m`.padEnd(width));
        output.push(`\x1b[2m│ LLM 已获取完整内容\x1b[0m`.padEnd(width));
        output.push(`\x1b[2m│ 使用 ov_read(uri, limit:N) 分页查看更多\x1b[0m`.padEnd(width));
        output.push(`\x1b[2m└─────────────────────────────────────────────┘\x1b[0m`);
        return output;
      };

      return { render };
    },
  });
}

function wrapLine(line: string, width: number): string[] {
  if (!line || width <= 0) return [line];
  const result: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    result.push(remaining.slice(0, width));
    remaining = remaining.slice(width);
  }
  if (remaining.length > 0) result.push(remaining);
  return result;
}
