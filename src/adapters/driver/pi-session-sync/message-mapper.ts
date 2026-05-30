import type { Part } from "../../../domain/common/part";

export interface MessageInput {
  role: string;
  content?: string | Array<{ type: string; text?: string }>;
}

export function agentMessageToParts(msg: MessageInput): Part[] {
  // Only user and assistant roles are synced
  if (msg.role !== "user" && msg.role !== "assistant") {
    return [];
  }

  const parts: Part[] = [];

  if (typeof msg.content === "string") {
    if (msg.content.trim().length > 0) {
      parts.push({ type: "text", text: msg.content });
    }
  } else if (Array.isArray(msg.content)) {
    for (const item of msg.content) {
      if (item.type === "text" && item.text && item.text.trim().length > 0) {
        parts.push({ type: "text", text: item.text });
      }
    }
  }

  return parts;
}
