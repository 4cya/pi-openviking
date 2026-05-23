import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { CommandRegisterDeps } from "./types";
import type { CommandResult } from "../shared/command-def";
import { defineCommand } from "../shared/command-def";
import { parseArgs } from "../shared/parse-args";

export function registerDeleteCommand(pi: ExtensionAPI, deps: CommandRegisterDeps): void {
  defineCommand(pi, deps, {
    name: "ov-delete",
    label: "Delete",
    description: "Delete a resource or directory from OpenViking by URI",
    healthChecker: deps.healthChecker,

    async execute(args, _ctx, d): Promise<CommandResult> {
      const parsed = parseArgs(args);
      const uri = parsed.positional[0];
      if (!uri) {
        return { type: "notify", message: "Usage: /ov-delete <viking://uri>", level: "error" };
      }

      const result = await d.knowledge.verifiedDelete(uri);
      const message = result.verified
        ? `✓ Deleted: ${result.uri}`
        : `✓ Deleted: ${result.uri} (warning: resource may still appear in search due to async index sync)`;
      return { type: "notify", message, level: "info" };
    },
  });
}
