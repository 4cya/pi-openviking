import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { FsStore } from "../../../domain/ports/fs-store";
import type { KnowledgeBase } from "../../../domain/ports/knowledge-base";
import { Uri } from "../../../domain/common/uri";

function isGlobPattern(s: string): boolean {
  return /[*?[]/.test(s);
}

export function createOvDeleteCommand(fsStore: FsStore, kb: KnowledgeBase) {
  return {
    description:
      "Delete a resource from OV. Usage: /ov-delete <uri>. Supports glob patterns: /ov-delete viking://path/*",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const input = args.trim();
      if (!input) {
        ctx.ui.notify("Usage: /ov-delete <uri>", "warning");
        return;
      }

      // Glob path
      if (isGlobPattern(input)) {
        const globResult = await kb.glob(input);
        if (globResult.total === 0) {
          ctx.ui.notify(`No resources match ${input}`, "warning");
          return;
        }

        const confirmed = await ctx.ui.confirm(
          "Confirm Delete",
          `This will delete ${globResult.total} resources. Continue?`,
        );
        if (!confirmed) {
          ctx.ui.notify("Delete cancelled.", "info");
          return;
        }

        let failures = 0;
        for (const entry of globResult.entries) {
          try {
            await fsStore.delete(new Uri(entry));
          } catch {
            failures++;
          }
        }

        if (failures === 0) {
          ctx.ui.notify(`Deleted ${globResult.total} resources matching ${input}`, "info");
        } else {
          ctx.ui.notify(
            `Deleted ${globResult.total - failures} of ${globResult.total} resources matching ${input}`,
            "warning",
          );
        }
        return;
      }

      // Literal URI path
      let uri: Uri;
      try {
        uri = new Uri(input);
      } catch {
        ctx.ui.notify(`Invalid URI: ${input}`, "warning");
        return;
      }

      const confirmed = await ctx.ui.confirm("Confirm Delete", `Delete ${input}?`);
      if (!confirmed) {
        ctx.ui.notify("Delete cancelled.", "info");
        return;
      }

      try {
        await fsStore.delete(uri);
        ctx.ui.notify(`Deleted: ${input}`, "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Delete failed: ${msg}`, "error");
      }
    },
  };
}
