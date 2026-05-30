import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { FsStore } from "../../../domain/ports/fs-store";
import { Uri } from "../../../domain/common/uri";

export function createOvDeleteCommand(fsStore: FsStore) {
  return {
    description: "Delete a resource from OV. Usage: /ov-delete <uri>",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const uriStr = args.trim();
      if (!uriStr) {
        ctx.ui.notify("Usage: /ov-delete <uri>", "warning");
        return;
      }

      let uri: Uri;
      try {
        uri = new Uri(uriStr);
      } catch {
        ctx.ui.notify(`Invalid URI: ${uriStr}`, "warning");
        return;
      }

      const confirmed = await ctx.ui.confirm("Confirm Delete", `Delete ${uriStr}?`);
      if (!confirmed) {
        ctx.ui.notify("Delete cancelled.", "info");
        return;
      }

      try {
        await fsStore.delete(uri);
        ctx.ui.notify(`Deleted: ${uriStr}`, "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Delete failed: ${msg}`, "error");
      }
    },
  };
}
