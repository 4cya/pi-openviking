import { describe, it, expect } from "vitest";
import { SessionId } from "./session-id";

describe("SessionId", () => {
  it("accepts non-empty string", () => {
    const sid = new SessionId("sess_abc123");
    expect(sid).toBeInstanceOf(SessionId);
  });

  it("throws on empty string", () => {
    expect(() => new SessionId("")).toThrow("SessionId cannot be empty");
  });

  it("toString() returns raw value", () => {
    const sid = new SessionId("sess_test");
    expect(sid.toString()).toBe("sess_test");
  });
});
