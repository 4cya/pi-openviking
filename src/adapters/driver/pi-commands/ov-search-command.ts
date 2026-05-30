import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { SearchService } from "../../../domain/services/search-service";

export function createOvSearchCommand(searchService: SearchService) {
  return {
    description: "Search the OV knowledge base. Usage: /ov-search <query>",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const query = args.trim();
      if (!query) {
        ctx.ui.notify("Usage: /ov-search <query>", "warning");
        return;
      }

      try {
        const result = await searchService.search({ query, mode: "fast" });
        if (result.total === 0) {
          ctx.ui.notify("No results found.", "info");
          return;
        }

        const lines: string[] = [];
        for (const item of result.memories) {
          const score = item.score != null ? item.score.toFixed(3) : "-";
          const abstract = item.abstract ?? "";
          lines.push(`URI: ${item.uri}  Score: ${score}  ${abstract}`);
        }
        for (const item of result.resources) {
          const score = item.score != null ? item.score.toFixed(3) : "-";
          const abstract = item.abstract ?? "";
          lines.push(`URI: ${item.uri}  Score: ${score}  ${abstract}`);
        }
        for (const item of result.skills) {
          const score = item.score != null ? item.score.toFixed(3) : "-";
          const abstract = item.abstract ?? "";
          lines.push(`URI: ${item.uri}  Score: ${score}  ${abstract}`);
        }

        ctx.ui.notify(`Results (${result.total}):\n${lines.join("\n")}`, "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Search failed: ${msg}`, "error");
      }
    },
  };
}
