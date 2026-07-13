import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition, type ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
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

const PREVIEW_LINES = 10;

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
          details: { lineCount: result.body.split("\n").length, uri: params.uri },
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Read failed: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },
    renderResult(result, options: ToolRenderResultOptions, _theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      const output = result.content?.[0]?.text ?? "";
      const lines = output.split("\n");
      const lineCount = result.details?.lineCount ?? lines.length;

      const maxLines = options.expanded ? lines.length : PREVIEW_LINES;
      const displayLines = lines.slice(0, maxLines);
      const remaining = lines.length - maxLines;

      let display = displayLines.join("\n");
      if (remaining > 0) {
        display += `\n\n... (${remaining} more lines, Ctrl+O to expand) — LLM received full ${lineCount} lines`;
      }

      text.setText(display);
      return text;
    },
  });
}
