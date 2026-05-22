import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { CommandRegisterDeps } from "./types";
import type { CommandResult } from "../shared/command-def";
import { defineCommand } from "../shared/command-def";
import { commitOp } from "../operations/commit";

export function registerCommitCommand(pi: ExtensionAPI, deps: CommandRegisterDeps): void {
  defineCommand(pi, deps, {
    name: "ov-commit",
    label: "Commit",
    description: "Commit the current conversation to OpenViking",
    healthChecker: deps.healthChecker,

    async execute(_args, _ctx, d): Promise<CommandResult> {
      const result = await commitOp(d.sync);
      return { type: "notify", message: `✓ Session committed. Task: ${result.task_id}`, level: "info" };
    },
  });
}
