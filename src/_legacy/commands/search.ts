import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { CommandResult } from "../shared/command-def";
import { defineCommand } from "../shared/command-def";
import { parseArgs } from "../shared/parse-args";
import { formatSearch } from "../shared/format-search";
import { searchOp } from "../operations/search";
import { RuntimeDeps } from "../bootstrap/runtime";

export function registerSearchCommand(pi: ExtensionAPI, deps: RuntimeDeps): void {
  defineCommand(pi, deps, {
    name: "ov-search",
    label: "Search",
    description: "Search OpenViking memories and resources",
    healthChecker: deps.healthChecker,

    async execute(args, _ctx, d): Promise<CommandResult> {
      const booleans = new Set(["deep", "fast"]);
      const parsed = parseArgs(args, booleans);
      const query = parsed.positional.join(" ") || "";
      if (!query) {
        return { type: "notify", message: "Usage: /ov-search [--deep|--fast] [--limit N] [--uri <uri>] <query>", level: "error" };
      }

      const rawLimit = parseInt(parsed.flags.limit ?? "", 10);
      const limit = Number.isFinite(rawLimit) ? rawLimit : 10;
      const mode = "deep" in parsed.flags ? "deep" : "fast" in parsed.flags ? "fast" : "auto";
      const uri = parsed.flags.uri;
      const sessionId = d.sync.getOvSessionId();

      const results = await searchOp(d.knowledge, { sessionId, query, limit, mode, uri });
      const text = formatSearch(results, query);

      return { type: "steer", customType: "ov-search", text, details: { total: results.total } };
    },
  });
}
