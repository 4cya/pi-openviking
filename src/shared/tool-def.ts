import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { TSchema, Static } from "typebox";
import type { SessionClient, FsClient, KnowledgeClient } from "../ov-client/client";
import type { SessionSyncLike } from "../session-sync/session";
import type { HealthChecker } from "../shared/health";
import { notifyOnce } from "../shared/notify";

export interface ToolRegisterDeps {
  session: SessionClient;
  fs: FsClient;
  knowledge: KnowledgeClient;
  sync: SessionSyncLike;
  healthChecker?: HealthChecker;
}

export type ToolDeps = ToolRegisterDeps;

export interface ExecuteArgs<P extends TSchema> {
  params: Static<P>;
  deps: ToolRegisterDeps;
  signal?: AbortSignal;
  onUpdate?: ((result: any) => void);
  ctx?: unknown;
}

export interface ToolDef<P extends TSchema> {
  name: string;
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines?: string[];
  parameters: P;
  validateUri?: boolean;
  execute: (args: ExecuteArgs<P>) => Promise<{
    text: string;
    details?: Record<string, unknown>;
    isError?: boolean;
  }>;
}

export function defineTool<P extends TSchema>(
  pi: ExtensionAPI,
  deps: ToolRegisterDeps,
  def: ToolDef<P>,
): void {
  pi.registerTool({
    name: def.name,
    label: def.label,
    description: def.description,
    promptSnippet: def.promptSnippet,
    promptGuidelines: def.promptGuidelines,
    parameters: def.parameters,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      try {
        // On-demand health recovery before tool execution
        const hc = deps.healthChecker;
        if (hc && !hc.isAvailable()) {
          const recovered = await hc.check();
          if (!recovered) {
            return {
              content: [{ type: "text", text: "OpenViking server is unavailable. Try again later." }],
              details: {},
              isError: true,
            };
          }
        }

        if (def.validateUri) {
          const uri = (params as Record<string, unknown>).uri as string | undefined;
          if (!uri || !uri.startsWith("viking://")) {
            return {
              content: [{ type: "text", text: "Invalid URI: must start with viking://" }],
              details: {},
              isError: true,
            };
          }
        }

        const result = await def.execute({
          params: params as Static<P>,
          deps,
          signal,
          onUpdate: onUpdate as any,
          ctx,
        });

        return {
          content: [{ type: "text", text: result.text }],
          details: result.details ?? {},
          isError: result.isError,
        };
      } catch (err) {
        const msg = (err as Error).message;
        notifyOnce(ctx, `OpenViking error: ${msg}`, "error");
        return {
          content: [{ type: "text", text: msg }],
          details: {},
          isError: true,
        };
      }
    },
  });
}
