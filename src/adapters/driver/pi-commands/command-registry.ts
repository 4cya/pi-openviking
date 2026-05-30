import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { RecallService } from "../../../domain/recall/recall-service";
import type { SessionService } from "../../../domain/services/session-service";
import type { SearchService } from "../../../domain/services/search-service";
import type { FsStore } from "../../../domain/ports/fs-store";
import type { OVAdapterConfig, RecallConfig } from "../../../infrastructure/config/schema";
import { createOvRecallCommand } from "./ov-recall-command";
import { createOvStatusCommand } from "./ov-status-command";
import { createOvTreeCommand } from "./ov-tree-command";
import { createOvCommitCommand } from "./ov-commit-command";
import { createOvSearchCommand } from "./ov-search-command";
import { createOvDeleteCommand } from "./ov-delete-command";

export interface CommandServices {
  recallService: RecallService;
  sessionService: SessionService;
  searchService: SearchService;
  fsStore: FsStore;
  ovConfig: OVAdapterConfig;
  recallConfig: RecallConfig;
}

export function registerAllCommands(pi: ExtensionAPI, svcs: CommandServices): void {
  pi.registerCommand("ov-recall", createOvRecallCommand(svcs.recallService));
  pi.registerCommand("ov-status", createOvStatusCommand(svcs.ovConfig, svcs.sessionService, svcs.recallService, svcs.recallConfig));
  pi.registerCommand("ov-tree", createOvTreeCommand(svcs.fsStore));
  pi.registerCommand("ov-commit", createOvCommitCommand(svcs.sessionService));
  pi.registerCommand("ov-search", createOvSearchCommand(svcs.searchService));
  pi.registerCommand("ov-delete", createOvDeleteCommand(svcs.fsStore));
}
