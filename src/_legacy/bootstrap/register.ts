import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Runtime, RuntimeDeps } from "./runtime";
import { registerMemsearchTool } from "../tools/search";
import { registerMemreadTool } from "../tools/read";
import { registerMembrowseTool } from "../tools/browse";
import { registerMemcommitTool } from "../tools/commit";
import { registerMemdeleteTool } from "../tools/delete";
import { registerMemimportTool } from "../tools/import";
import { registerSearchCommand } from "../commands/search";
import { registerBrowseCommand } from "../commands/browse";
import { registerImportCommand } from "../commands/import";
import { registerDeleteCommand } from "../commands/delete";
import { registerRecallCommand } from "../commands/recall";
import { registerCommitCommand } from "../commands/commit";

export const TOOLS = [
  registerMemsearchTool,
  registerMemreadTool,
  registerMembrowseTool,
  registerMemcommitTool,
  registerMemdeleteTool,
  registerMemimportTool,
];

export const COMMANDS = [
  registerSearchCommand,
  registerBrowseCommand,
  registerImportCommand,
  registerDeleteCommand,
  registerRecallCommand,
  registerCommitCommand,
];

/**
 * Register all 6 tools and 6 commands with the Pi API.
 * Uses unified RuntimeDeps derived from Runtime.
 */
export function registerAll(pi: ExtensionAPI, runtime: Runtime): void {
  const deps: RuntimeDeps = {
    session: runtime.client.session,
    fs: runtime.client.fs,
    knowledge: runtime.client.knowledge,
    sync: runtime.sessionSync,
    healthChecker: runtime.healthChecker,
    autoRecallState: runtime.autoRecallState,
  };

  for (const register of TOOLS) register(pi, deps);
  for (const register of COMMANDS) register(pi, deps);
}
