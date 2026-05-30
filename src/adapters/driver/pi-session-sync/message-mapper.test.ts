import { describe, it, expect } from "vitest";
import { agentMessageToParts } from "./message-mapper";

describe("agentMessageToParts", () => {
  it("extracts text from user message with string content", () => {
    const parts = agentMessageToParts({
      role: "user",
      content: "hello world",
    });
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: "text", text: "hello world" });
  });

  it("extracts text from assistant message with TextContent array", () => {
    const parts = agentMessageToParts({
      role: "assistant",
      content: [
        { type: "text", text: "Here is some " },
        { type: "text", text: "formatted text" },
      ],
    });
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: "text", text: "Here is some " });
    expect(parts[1]).toEqual({ type: "text", text: "formatted text" });
  });

  it("returns empty array for tool messages", () => {
    const parts = agentMessageToParts({
      role: "tool",
      content: "some tool output",
    });
    expect(parts).toHaveLength(0);
  });

  it("returns empty array for custom messages", () => {
    const parts = agentMessageToParts({
      role: "custom",
      content: "custom payload",
    });
    expect(parts).toHaveLength(0);
  });

  it("returns empty array for empty string content", () => {
    const parts = agentMessageToParts({
      role: "user",
      content: "",
    });
    expect(parts).toHaveLength(0);
  });

  it("returns empty array for whitespace-only content", () => {
    const parts = agentMessageToParts({
      role: "user",
      content: "   ",
    });
    expect(parts).toHaveLength(0);
  });

  it("returns empty array for undefined content", () => {
    const parts = agentMessageToParts({ role: "user" });
    expect(parts).toHaveLength(0);
  });

  it("ignores ImageContent items in user messages", () => {
    const parts = agentMessageToParts({
      role: "user",
      content: [
        { type: "text", text: "See this image:" },
        { type: "image", data: "base64...", mimeType: "image/png" },
        { type: "text", text: "end of message" },
      ],
    });
    expect(parts).toHaveLength(2);
    expect(parts[0].text).toBe("See this image:");
    expect(parts[1].text).toBe("end of message");
  });

  it("returns empty array for null content", () => {
    const parts = agentMessageToParts({
      role: "assistant",
      content: null as any,
    });
    expect(parts).toHaveLength(0);
  });
});
