import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { RecallService } from "../../../domain/recall/recall-service";

export function createOvRecallCommand(svc: RecallService) {
  return {
    description: "Enable or disable automatic recall. Usage: /ov-recall on|off",
    getArgumentCompletions: (prefix: string) => {
      const opts = ["on", "off"];
      const filtered = opts.filter((o) => o.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((v) => ({ value: v, label: v })) : null;
    },
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const trimmed = args.trim();
      if (trimmed !== "on" && trimmed !== "off") {
        ctx.ui.notify("Usage: /ov-recall on|off", "warning");
        return;
      }
      svc.setEnabled(trimmed === "on");
      ctx.ui.notify(`Recall ${trimmed === "on" ? "enabled" : "disabled"}`, "info");
    },
  };
}
