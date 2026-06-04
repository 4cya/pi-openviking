import { Type } from "@sinclair/typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Pipeline } from "../../../domain/pipeline/pipeline";
import type { ResourceService } from "../../../domain/services/resource-service";

const ImportSchema = Type.Object({
  url: Type.String({ description: "URL to import (e.g. https://example.com/doc.md)" }),
  targetUri: Type.Optional(Type.String({ description: 'Optional target URI in OpenViking (e.g. viking://resources/guide.md)' })),
  reason: Type.Optional(Type.String({ description: "Optional reason for importing (e.g. 'User guide documentation')" })),
  wait: Type.Optional(Type.Boolean({ description: "Wait for server-side processing to complete (default: false)" })),
});

export function createOvImportTool(
  svc: ResourceService,
  pipeline: Pipeline<unknown>,
): ToolDefinition<typeof ImportSchema> {
  return defineTool({
    name: "ov_import",
    label: "Import External Resource",
    description: "Import a URL, document, or Git repository into the OpenViking knowledge base as a resource. OpenViking parses Markdown, PDF, HTML, Word, images, and more. Returns the imported resource URI.",
    promptSnippet: "ov_import(url, targetUri?, reason?, wait?) — import external resource",
    parameters: ImportSchema,
    async execute(_toolCallId, params, signal) {
      try {
        const result = await pipeline.execute(
          () => svc.importUrl(
            params.url!,
            {
              targetUri: params.targetUri ?? undefined,
              reason: params.reason ?? undefined,
              wait: params.wait ?? undefined,
            },
            signal ?? undefined,
          ),
          signal ?? undefined,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: undefined,
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Import failed: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },
  });
}
