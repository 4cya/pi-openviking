import { describe, it, expect } from "vitest";
import type { ContentLevel } from "./content-level";
import type { WriteMode } from "./write-mode";
import type { FindQuery, SearchRequest } from "./search-query";
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

describe("FindQuery", () => {
  it("accepts all optional fields", () => {
    const q: FindQuery = {
      query: "test",
      limit: 10,
      targetUri: new Uri("viking://test"),
    };
    expect(q.query).toBe("test");
    expect(q.limit).toBe(10);
    expect(q.targetUri?.toString()).toBe("viking://test");
  });

  it("works with only required field", () => {
    const q: FindQuery = { query: "just query" };
    expect(q.query).toBe("just query");
    expect(q.limit).toBeUndefined();
    expect(q.targetUri).toBeUndefined();
  });
});

describe("SearchRequest", () => {
  it("accepts sessionId", () => {
    const r: SearchRequest = {
      query: "complex task",
      sessionId: new SessionId("sess_1"),
    };
    expect(r.query).toBe("complex task");
    expect(r.sessionId?.toString()).toBe("sess_1");
  });
});
