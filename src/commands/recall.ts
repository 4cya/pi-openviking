import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { CommandRegisterDeps } from "./types";
import type { CommandResult } from "../shared/command-def";
import { defineCommand } from "../shared/command-def";
import { parseArgs } from "../shared/parse-args";

export function registerRecallCommand(pi: ExtensionAPI, deps: CommandRegisterDeps): void {
  defineCommand(pi, deps, {
    name: "ov-recall",
    label: "Recall",
    description: "Toggle auto-recall on or off for the current session",

    async execute(args, _ctx, d): Promise<CommandResult> {
      const booleans = new Set(["status"]);
      const parsed = parseArgs(args, booleans);

      if ("status" in parsed.flags) {
        const status = d.autoRecallState.enabled ? "enabled" : "disabled";
        return { type: "notify", message: `Auto-recall is ${status} (session-only)`, level: "info" };
      }

      d.autoRecallState.enabled = !d.autoRecallState.enabled;
      const status = d.autoRecallState.enabled ? "enabled" : "disabled";
      return { type: "notify", message: `Auto-recall ${status} for this session. Resets on reload.`, level: "info" };
    },
  });
}
