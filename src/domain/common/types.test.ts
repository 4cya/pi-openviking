import { describe, it, expect } from "vitest";
import type { ContentLevel } from "./content-level";
import type { WriteMode } from "./write-mode";
import type { SearchQuery, SearchMode } from "./search-query";
import { Uri } from "./uri";
import { SessionId } from "./session-id";

describe("ContentLevel", () => {
  it("accepts all three literals", () => {
    const a: ContentLevel = "abstract";
    const b: ContentLevel = "overview";
    const c: ContentLevel = "read";
    expect([a, b, c]).toHaveLength(3);
  });
});

describe("WriteMode", () => {
  it("accepts all three literals", () => {
    const a: WriteMode = "replace";
    const b: WriteMode = "append";
    const c: WriteMode = "create";
    expect([a, b, c]).toHaveLength(3);
  });
});

describe("SearchMode", () => {
  it("accepts all three literals", () => {
    const a: SearchMode = "auto";
    const b: SearchMode = "fast";
    const c: SearchMode = "deep";
    expect([a, b, c]).toHaveLength(3);
  });
});

describe("SearchQuery", () => {
  it("accepts all optional fields", () => {
    const q: SearchQuery = {
      query: "test",
      limit: 10,
      mode: "deep",
      targetUri: new Uri("viking://test"),
      sessionId: new SessionId("sess_1"),
    };
    expect(q.query).toBe("test");
    expect(q.limit).toBe(10);
    expect(q.mode).toBe("deep");
    expect(q.targetUri?.toString()).toBe("viking://test");
    expect(q.sessionId?.toString()).toBe("sess_1");
  });

  it("works with only required field", () => {
    const q: SearchQuery = { query: "just query" };
    expect(q.query).toBe("just query");
    expect(q.limit).toBeUndefined();
    expect(q.mode).toBeUndefined();
    expect(q.targetUri).toBeUndefined();
    expect(q.sessionId).toBeUndefined();
  });
});
