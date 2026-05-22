import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { CommandRegisterDeps } from "./types";
import type { CommandResult } from "../shared/command-def";
import { defineCommand } from "../shared/command-def";
import { parseArgs } from "../shared/parse-args";
import { importOp } from "../operations/import";

export function registerImportCommand(pi: ExtensionAPI, deps: CommandRegisterDeps): void {
  defineCommand(pi, deps, {
    name: "ov-import",
    label: "Import",
    description: "Import a URL or local file into OpenViking",
    healthChecker: deps.healthChecker,

    async execute(args, _ctx, d): Promise<CommandResult> {
      const parsed = parseArgs(args);
      const source = parsed.positional[0];
      if (!source) {
        return { type: "notify", message: "Usage: /ov-import [--kind resource|skill] [--to <uri>] [--reason <text>] <source>", level: "error" };
      }

      const rawKind = parsed.flags.kind;
      const kind: "resource" | "skill" = rawKind === "skill" ? "skill" : "resource";
      const to = parsed.flags.to;
      const reason = parsed.flags.reason;

      const result = await importOp(d.knowledge, { source, kind, reason, to });
      return { type: "notify", message: `✓ Imported: ${result.root_uri}`, level: "info" };
    },
  });
}
