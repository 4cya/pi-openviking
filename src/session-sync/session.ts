import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { TextContent, ImageContent, ThinkingContent, ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import type { CommitResult, OpenVikingClient } from "../ov-client/client";
import type { Part } from "../ov-client/types";
import { logger } from "../shared/logger";

const TOOL_RESULT_MAX_CHARS = 500;

export interface SessionSyncOpts {
  getSessionFile: () => string | undefined;
  getBranch: () => Array<{ type: string; customType?: string; data?: unknown }>;
  appendEntry: (type: string, data: unknown) => void;
  maxConsecutiveFailures?: number;
}

export interface SessionSyncLike {
  getOvSessionId(): string | undefined;
  flush(): Promise<void>;
  commit(): Promise<import("../ov-client/client").CommitResult>;
  recover(): void;
}

export class SessionSync implements SessionSyncLike {
  private client: OpenVikingClient;
  private opts: SessionSyncOpts;
  private ovSessionId: string | undefined;
  private pendingChain: Promise<void> = Promise.resolve();
  private consecutiveFailures = 0;
  private readonly maxFailures: number;

  constructor(client: OpenVikingClient, opts: SessionSyncOpts) {
    this.client = client;
    this.opts = opts;
    this.maxFailures = opts.maxConsecutiveFailures ?? 3;
  }

  onSessionStart(): void {
    // Walk branch leaf-to-root to find persisted ov-session mapping
    const branch = this.opts.getBranch();
    for (let i = branch.length - 1; i >= 0; i--) {
      const entry = branch[i];
      if (entry.type === "custom" && (entry as any).customType === "ov-session") {
        this.ovSessionId = (entry as any).data?.ovSessionId as string;
        return;
      }
    }
  }

  onMessageEnd(message: AgentMessage): void {
    if (message.role !== "user" && message.role !== "assistant" && message.role !== "toolResult") return;

    // Circuit breaker: skip if too many consecutive failures
    if (this.consecutiveFailures >= this.maxFailures) return;

    let serialized: string | Part[] | undefined;
    if (message.role === "toolResult") {
      serialized = this.serializeToolResult(message as unknown as ToolResultMessage);
    } else {
      if (!("content" in message)) return;
      serialized = this.serializeContent(message.content);
    }
    if (!serialized) return;

    const role = message.role;
    const contentToSend = serialized;
    void this.enqueue(async () => {
      try {
        if (!this.ovSessionId) {
          this.ovSessionId = await this.client.createSession();
          logger.debug("session created:", this.ovSessionId);
          if (this.opts.getSessionFile() != null) {
            this.opts.appendEntry("ov-session", { ovSessionId: this.ovSessionId });
          }
        }
        await this.client.sendMessage(this.ovSessionId!, role, contentToSend);
        const len = typeof contentToSend === "string" ? contentToSend.length : JSON.stringify(contentToSend).length;
        logger.debug("message sent:", role, len);
        this.consecutiveFailures = 0;
      } catch (err) {
        this.consecutiveFailures++;
        // OV server down — silently drop to avoid crashing Pi
        logger.error("message send failed:", (err as Error).message);
      }
    });
  }

  getOvSessionId(): string | undefined {
    return this.ovSessionId;
  }

  async commit(): Promise<CommitResult> {
    if (!this.ovSessionId) {
      throw new Error("No OpenViking session mapped");
    }
    const result = await this.client.commit(this.ovSessionId);
    logger.debug("commit:", this.ovSessionId, result.task_id);
    return result;
  }

  flush(): Promise<void> {
    return this.pendingChain;
  }

  recover(): void {
    this.consecutiveFailures = 0;
  }

  onShutdown(): Promise<void> {
    this.pendingChain = Promise.resolve();
    this.ovSessionId = undefined;
    this.consecutiveFailures = 0;
    return Promise.resolve();
  }

  private serializeContent(content: string | (TextContent | ImageContent | ThinkingContent | ToolCall)[]): string | Part[] | undefined {
    if (typeof content === "string") return content || undefined;

    const parts: Part[] = [];
    for (const block of content) {
      if (block.type === "text" && typeof (block as TextContent).text === "string") {
        parts.push({ type: "text", text: (block as TextContent).text });
      } else if (block.type === "toolCall") {
        const tc = block as ToolCall;
        parts.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      // Skip thinking, image
    }

    if (parts.length === 0) return undefined;

    // If no tool calls, return joined string for backward compat
    const hasToolUse = parts.some((p) => p.type === "tool_use");
    if (!hasToolUse) {
      const joined = parts.map((p) => (p as { type: "text"; text: string }).text).join("");
      return joined || undefined;
    }

    return parts;
  }

  private serializeToolResult(message: ToolResultMessage): string | undefined {
    const toolName = message.toolName;
    const isError = message.isError;
    const textParts = message.content
      .filter((b: TextContent | ImageContent): b is TextContent => b.type === "text" && typeof b.text === "string")
      .map((b: TextContent) => b.text);
    const content = textParts.join("");
    if (!content) return undefined;
    const truncated = content.length > TOOL_RESULT_MAX_CHARS ? content.slice(0, TOOL_RESULT_MAX_CHARS) : content;
    return `[tool: ${toolName}, error: ${isError}]\n${truncated}`;
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.pendingChain = this.pendingChain.then(fn, fn);
    return this.pendingChain;
  }
}
