import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ToolRegisterDeps } from "../shared/tool-def";
import { defineTool } from "../shared/tool-def";
import { commitOp } from "../operations/commit";
import { renderGenericCall, renderGenericResult } from "../shared/render";

export function registerMemcommitTool(
  pi: ExtensionAPI,
  deps: ToolRegisterDeps,
) {
  defineTool(pi, deps, {
    name: "memcommit",
    label: "Memory Commit",
    description:
      "Commit the current conversation to OpenViking long-term memory. " +
      "Flushes pending messages and triggers background memory extraction. " +
      "Set wait=true to poll until memory extraction completes (timeout 15s).",
    promptSnippet: "Commit conversation to OpenViking memory",
    promptGuidelines: [
      "Use memcommit when the user explicitly asks to save the conversation to memory.",
      "memcommit requires an active OpenViking session. If no session exists, inform the user to start a conversation first.",
    ],
    parameters: Type.Object({
      wait: Type.Optional(Type.Boolean({ description: "Poll until extraction completes (default: false)" })),
    }),
    renderCall: (args: any, theme: any) => renderGenericCall("memcommit", args, theme),
    renderResult: renderGenericResult as any,

    async execute({ deps, params, onUpdate, signal }) {
      try {
        const wait = params.wait ?? false;
        onUpdate?.({ content: [{ type: "text", text: wait ? "Committing and waiting for extraction..." : "Committing session to OpenViking..." }], details: {} });
        const result = await commitOp(deps.sync, wait ? { client: deps.session, wait: true, signal } : undefined);
        const statusSuffix = result.status === "timeout" ? " (timed out)" : result.status === "failed" ? ` (failed: ${result.error})` : "";
        return {
          text: `Committed to OpenViking. Task: ${result.task_id}, Status: ${result.status}${statusSuffix}`,
          details: {
            task_id: result.task_id,
            status: result.status,
          },
        };
      } catch (err) {
        return {
          text: (err as Error).message,
          isError: true,
        };
      }
    },
  });
}
