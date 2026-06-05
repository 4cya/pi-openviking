import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { SessionService } from "../../../domain/services/session-service";
import type { RecallService } from "../../../domain/recall/recall-service";
import type { OVAdapterConfig } from "../../../infrastructure/config/schema";
import type { RecallConfig } from "../../../domain/common/recall-config";

export function createOvStatusCommand(
  ovConfig: OVAdapterConfig,
  sessionService: SessionService,
  recallService: RecallService,
  recallConfig: RecallConfig,
) {
  return {
    description: "Show OpenViking connection state, active session, recall toggle, and target scope",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const endpoint = ovConfig.endpoint;
      const active = sessionService.getActive();
      const activeStr = active ? active.toString() : "none";
      const recallOn = recallService.isEnabled() ? "on" : "off";
      const targetScope = recallConfig.targetUri ?? "(global)";
      const searchMode = recallConfig.searchMode;

      const lines = [
        `Endpoint: ${endpoint}`,
        `Active Session: ${activeStr}`,
        `Recall: ${recallOn}`,
        `Target Scope: ${targetScope}`,
        `Search Mode: ${searchMode}`,
      ];

      ctx.ui.notify(lines.join("\n"), "info");
    },
  };
}
