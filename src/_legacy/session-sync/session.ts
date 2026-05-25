import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { TextContent, ImageContent, ThinkingContent, ToolCall, ToolResultMessage } from "@earendil-works/pi-ai";
import type { SessionClient, CommitResult } from "../ov-client/client";
import type { ContextPart, Part } from "../ov-client/types";
import type { RecallItem } from "../auto-recall/recall-curator";
import { logger } from "../shared/logger";

const TOOL_RESULT_MAX_CHARS = 2000;

export interface SessionSyncOpts {
  getSessionFile: () => string | undefined;
  getBranch: () => Array<{ type: string; customType?: string; data?: unknown }>;
  appendEntry: (type: string, data: unknown) => void;
  maxConsecutiveFailures?: number;
  autoRecallState?: { enabled: boolean; lastInjectedItems: RecallItem[] };
}

export interface SessionSyncLike {
  getOvSessionId(): string | undefined;
  flush(): Promise<void>;
  commit(): Promise<import("../ov-client/client").CommitResult>;
  recover(): void;
}

export class SessionSync implements SessionSyncLike {
  private client: SessionClient;
  private opts: SessionSyncOpts;
  private ovSessionId: string | undefined;
  private pendingChain: Promise<void> = Promise.resolve();
  private consecutiveFailures = 0;
  private readonly maxFailures: number;
  private pendingBuffer: { parts: Part[]; pendingToolIds: Set<string> } | null = null;
  private trackingState?: { enabled: boolean; lastInjectedItems: RecallItem[] };

  constructor(client: SessionClient, opts: SessionSyncOpts) {
    this.client = client;
    this.opts = opts;
    this.maxFailures = opts.maxConsecutiveFailures ?? 3;
    this.trackingState = opts.autoRecallState;
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
    // Circuit breaker: skip if too many consecutive failures
    if (this.consecutiveFailures >= this.maxFailures) return;

    if (message.role === "user" || (message.role === "assistant" && !this.hasToolCalls(message))) {
      // Text-only: flush any pending buffer first, then send immediately
      if (this.pendingBuffer) {
        this.flushIncomplete();
      }
      if (!("content" in message)) return;
      const parts = this.serializeContent(message.content);
      if (!parts) return;
      this.sendOrBuffer(parts, message.role);
      return;
    }

    if (message.role === "assistant" && this.hasToolCalls(message)) {
      if (!("content" in message)) return;
      const parts = this.serializeContent(message.content);
      if (!parts) return;

      // Check for buffer conflict — incomplete flush if buffer occupied
      if (this.pendingBuffer) {
        this.flushIncomplete();
      }

      // Buffer this message
      const toolIds = new Set<string>();
      for (const p of parts) {
        if (p.type === "tool") {
          toolIds.add(p.tool_id);
        }
      }
      this.pendingBuffer = { parts, pendingToolIds: toolIds };

      // If no tool calls (shouldn't happen here but just in case), flush immediately
      if (toolIds.size === 0) {
        this.flushBuffer();
      }
      return;
    }

    if (message.role === "toolResult") {
      const tr = message as unknown as ToolResultMessage;
      if (!this.pendingBuffer) {
        // Orphan tool result — discard
        logger.warn("orphan toolResult discarded (no buffer):", tr.toolCallId, tr.toolName);
        return;
      }

      if (!this.pendingBuffer.pendingToolIds.has(tr.toolCallId)) {
        // Unknown tool call ID — discard
        logger.warn("orphan toolResult discarded (unknown toolCallId):", tr.toolCallId, tr.toolName);
        return;
      }

      // Merge result into buffered ToolPart
      const textContent = tr.content
        .filter((b: TextContent | ImageContent): b is TextContent => b.type === "text" && typeof b.text === "string")
        .map((b: TextContent) => b.text)
        .join("");

      for (const p of this.pendingBuffer.parts) {
        if (p.type === "tool" && p.tool_id === tr.toolCallId) {
          const truncated = textContent.length > TOOL_RESULT_MAX_CHARS
            ? textContent.slice(0, TOOL_RESULT_MAX_CHARS)
            : textContent;
          p.tool_output = truncated;
          p.tool_output_truncated = textContent.length > TOOL_RESULT_MAX_CHARS;
          p.tool_status = tr.isError ? "error" : "success";
          break;
        }
      }

      this.pendingBuffer.pendingToolIds.delete(tr.toolCallId);

      // If all results received, flush
      if (this.pendingBuffer.pendingToolIds.size === 0) {
        this.flushBuffer();
      }
      return;
    }
  }

  private hasToolCalls(message: AgentMessage): boolean {
    if (!("content" in message)) return false;
    if (typeof (message as any).content === "string") return false;
    const content = (message as any).content as any[];
    return Array.isArray(content) && content.some(
      (b: any) => b?.type === "toolCall",
    );
  }

  private sendOrBuffer(parts: Part[], role: string): void {
    void this.enqueue(async () => {
      try {
        if (!this.ovSessionId) {
          this.ovSessionId = await this.client.createSession();
          logger.debug("session created:", this.ovSessionId);
          if (this.opts.getSessionFile() != null) {
            this.opts.appendEntry("ov-session", { ovSessionId: this.ovSessionId });
          }
        }
        // Consume tracking state before send (only for assistant)
        let enriched = parts;
        let consumed: RecallItem[] = [];
        if (role === "assistant") {
          const tracking = this.consumeAndClear();
          consumed = tracking.items;
          enriched = [...parts, ...tracking.contextParts];
        }
        await this.client.sendMessage(this.ovSessionId!, role, enriched);
        const len = JSON.stringify(enriched).length;
        logger.debug("message sent:", role, len);
        this.consecutiveFailures = 0;
        // Fire-and-forget sessionUsed
        if (consumed.length > 0) void this.reportUsage(consumed);
      } catch (err) {
        this.consecutiveFailures++;
        // OV server down — silently drop to avoid crashing Pi
        logger.error("message send failed:", (err as Error).message);
      }
    });
  }

  private flushBuffer(): void {
    if (!this.pendingBuffer) return;
    const { parts } = this.pendingBuffer;
    this.pendingBuffer = null;
    // Consume tracking state
    const tracking = this.consumeAndClear();
    const enriched = [...parts, ...tracking.contextParts];
    const consumed = tracking.items;
    void this.enqueue(async () => {
      try {
        if (!this.ovSessionId) {
          this.ovSessionId = await this.client.createSession();
          logger.debug("session created:", this.ovSessionId);
          if (this.opts.getSessionFile() != null) {
            this.opts.appendEntry("ov-session", { ovSessionId: this.ovSessionId });
          }
        }
        await this.client.sendMessage(this.ovSessionId!, "assistant", enriched);
        const len = JSON.stringify(enriched).length;
        logger.debug("buffer flushed:", len);
        this.consecutiveFailures = 0;
        if (consumed.length > 0) void this.reportUsage(consumed);
      } catch (err) {
        this.consecutiveFailures++;
        logger.error("buffer flush failed:", (err as Error).message);
      }
    });
  }

  private flushIncomplete(): void {
    if (!this.pendingBuffer) return;
    const pendingIds = [...this.pendingBuffer.pendingToolIds];
    logger.warn("flushing incomplete buffer:", pendingIds.join(","));

    // Synthesize error parts for pending tool calls
    for (const p of this.pendingBuffer.parts) {
      if (p.type === "tool" && p.tool_status === "pending") {
        p.tool_status = "error";
        p.tool_output = "[interrompido - resultado não recebido]";
      }
    }

    const { parts } = this.pendingBuffer;
    this.pendingBuffer = null;
    // Consume tracking state
    const tracking = this.consumeAndClear();
    const enriched = [...parts, ...tracking.contextParts];
    const consumed = tracking.items;
    void this.enqueue(async () => {
      try {
        if (!this.ovSessionId) {
          this.ovSessionId = await this.client.createSession();
          logger.debug("session created:", this.ovSessionId);
          if (this.opts.getSessionFile() != null) {
            this.opts.appendEntry("ov-session", { ovSessionId: this.ovSessionId });
          }
        }
        await this.client.sendMessage(this.ovSessionId!, "assistant", enriched);
        const len = JSON.stringify(enriched).length;
        logger.debug("incomplete buffer flushed:", len);
        this.consecutiveFailures = 0;
        if (consumed.length > 0) void this.reportUsage(consumed);
      } catch (err) {
        this.consecutiveFailures++;
        logger.error("incomplete buffer flush failed:", (err as Error).message);
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

  onShutdown(): void {
    this.pendingChain = Promise.resolve();
    this.ovSessionId = undefined;
    this.consecutiveFailures = 0;
  }

  private serializeContent(content: string | (TextContent | ImageContent | ThinkingContent | ToolCall)[]): Part[] | undefined {
    if (typeof content === "string") {
      return content ? [{ type: "text", text: content }] : undefined;
    }

    const parts: Part[] = [];
    for (const block of content) {
      if (block.type === "text" && typeof (block as TextContent).text === "string" && (block as TextContent).text.length > 0) {
        parts.push({ type: "text", text: (block as TextContent).text });
      } else if (block.type === "toolCall") {
        const tc = block as ToolCall;
        parts.push({
          type: "tool",
          tool_id: tc.id,
          tool_name: tc.name,
          tool_input: tc.arguments,
          tool_output: "",
          tool_status: "pending",
          tool_output_truncated: false,
          tool_uri: "",
          skill_uri: "",
          duration_ms: null,
          prompt_tokens: null,
          completion_tokens: null,
          tool_output_ref: "",
        });
      }
      // Skip thinking, image
    }

    if (parts.length === 0) return undefined;
    return parts;
  }



  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.pendingChain = this.pendingChain.then(fn, fn);
    return this.pendingChain;
  }

  private resolveAbstract(item: RecallItem): string {
    return item.abstract ?? item.overview ?? item.text;
  }

  private buildContextParts(items: RecallItem[]): ContextPart[] {
    return items.map(item => ({
      type: "context" as const,
      uri: item.uri,
      context_type: item.type === "memory" ? "memory" as const : "resource" as const,
      abstract: this.resolveAbstract(item),
    }));
  }

  private consumeAndClear(): { items: RecallItem[]; contextParts: ContextPart[] } {
    if (!this.trackingState || this.trackingState.lastInjectedItems.length === 0) {
      return { items: [], contextParts: [] };
    }
    const items = [...this.trackingState.lastInjectedItems];
    const contextParts = this.buildContextParts(items);
    this.trackingState.lastInjectedItems = [];
    return { items, contextParts };
  }

  private async reportUsage(items: RecallItem[]): Promise<void> {
    if (items.length === 0 || !this.ovSessionId) return;
    try {
      await this.client.sessionUsed(this.ovSessionId, items.map(i => i.uri));
    } catch (err) {
      logger.error("sessionUsed failed:", (err as Error).message);
    }
  }
}
