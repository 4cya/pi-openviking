import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { CommandRegisterDeps } from "./types";
import type { CommandResult } from "../shared/command-def";
import { defineCommand } from "../shared/command-def";
import { parseArgs } from "../shared/parse-args";
import { formatBrowse } from "../shared/format-browse";
import { browseOp } from "../operations/browse";

export function registerBrowseCommand(pi: ExtensionAPI, deps: CommandRegisterDeps): void {
  defineCommand(pi, deps, {
    name: "ov-ls",
    label: "Browse",
    description: "Browse the OpenViking filesystem",
    healthChecker: deps.healthChecker,

    async execute(args, _ctx, d): Promise<CommandResult> {
      const booleans = new Set(["tree", "stat", "recursive", "simple"]);
      const parsed = parseArgs(args, booleans);
      const uri = parsed.positional[0] || "viking://";
      const view = "tree" in parsed.flags ? "tree" : "stat" in parsed.flags ? "stat" : "list";
      const recursive = "recursive" in parsed.flags || undefined;
      const simple = "simple" in parsed.flags || undefined;

      const result = await browseOp(d.fs, { uri, view, recursive, simple });
      const text = formatBrowse(result, view);
      return { type: "steer", customType: "ov-ls", text, details: { uri } };
    },
  });
}
