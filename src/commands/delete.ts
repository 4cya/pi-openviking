import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { CommandResult } from "../shared/command-def";
import { defineCommand } from "../shared/command-def";
import { parseArgs } from "../shared/parse-args";
import { deleteOp } from "../operations/delete";
import { RuntimeDeps } from "../bootstrap/runtime";

export function registerDeleteCommand(pi: ExtensionAPI, deps: RuntimeDeps): void {
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

      const result = await deleteOp(d.knowledge, { uri });
      const message = result.verified
        ? `✓ Deleted: ${result.uri}`
        : `✓ Deleted: ${result.uri} (warning: resource may still appear in search due to async index sync)`;
      return { type: "notify", message, level: "info" };
    },
  });
}
