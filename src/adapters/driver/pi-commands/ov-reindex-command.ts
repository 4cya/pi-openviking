import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { FsStore, ReindexMode } from "../../../domain/ports/fs-store";
import { Uri } from "../../../domain/common/uri";

export function createOvReindexCommand(fsStore: FsStore) {
  return {
    description: "Reindex a resource or skill in OpenViking. Usage: /ov-reindex <uri> [--mode vectors_only|full]",
    getArgumentCompletions: (prefix: string) => {
      if (prefix.startsWith("--mode ")) return [];
      if (prefix.includes("--mode")) {
        return [
          { label: "vectors_only", description: "Rebuild vector embeddings only (default)" },
          { label: "full", description: "Rebuild both scalar and vector indexes" },
        ];
      }
      return [
        { label: "--mode", description: "Reindex mode: vectors_only (default) or full" },
      ];
    },
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const trimmed = args.trim();
      if (!trimmed) {
        ctx.ui.notify("Usage: /ov-reindex <uri> [--mode vectors_only|full]", "warning");
        return;
      }

      // Parse mode flag from args
      let uriStr = trimmed;
      let mode: ReindexMode = "vectors_only";
      const modeMatch = trimmed.match(/^(.*?)\s+--mode\s+(vectors_only|full)$/);
      if (modeMatch) {
        uriStr = modeMatch[1].trim();
        mode = modeMatch[2] as ReindexMode;
      }

      let uri: Uri;
      try {
        uri = new Uri(uriStr);
      } catch {
        ctx.ui.notify(`Invalid URI: ${uriStr}`, "warning");
        return;
      }

      try {
        await fsStore.reindex(uri, mode, ctx.signal);
        ctx.ui.notify(`Reindexed: ${uriStr} (${mode})`, "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Reindex failed: ${msg}`, "error");
      }
    },
  };
}
