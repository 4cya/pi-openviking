import { describe, it, expect } from "vitest";
import { toSearchResult, toGlobResult, toGrepResult } from "./search-mapper";

describe("toSearchResult", () => {
  it("maps full search response with all fields", () => {
    const raw = {
      memories: [
        { uri: "viking://mem/1", text: "memory text", abstract: "mem abs", score: 0.9, category: "docs", level: 1, modTime: "2026-01-01T00:00:00Z" },
      ],
      resources: [
        { uri: "viking://res/1", score: 0.8, abstract: "res abs" },
      ],
      skills: [
        { uri: "viking://skill/1", score: 0.7, abstract: "skill abs" },
      ],
      total: 3,
      queryPlan: "semantic search",
    };

    const result = toSearchResult(raw);
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].uri).toBe("viking://mem/1");
    expect(result.memories[0].category).toBe("docs");
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].abstract).toBe("res abs");
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].uri).toBe("viking://skill/1");
    expect(result.total).toBe(3);
    expect(result.queryPlan).toBe("semantic search");
  });

  it("handles empty arrays", () => {
    const raw = { memories: [], resources: [], skills: [], total: 0 };
    const result = toSearchResult(raw);
    expect(result.memories).toHaveLength(0);
    expect(result.resources).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("handles missing optional fields inside items", () => {
    const raw = {
      memories: [{ uri: "viking://mem/1", text: "no abstract" }],
      resources: [{ uri: "viking://res/1" }],
      skills: [],
      total: 1,
    };
    const result = toSearchResult(raw);
    expect(result.memories[0].abstract).toBeUndefined();
    expect(result.resources[0].score).toBeUndefined();
  });

  it("handles null/undefined raw gracefully", () => {
    const empty = toSearchResult(null);
    expect(empty.memories).toHaveLength(0);
    expect(empty.total).toBe(0);

    const empty2 = toSearchResult(undefined);
    expect(empty2.memories).toHaveLength(0);
  });

  it("handles missing queryPlan", () => {
    const raw = { memories: [], resources: [], skills: [], total: 0 };
    const result = toSearchResult(raw);
    expect(result.queryPlan).toBeUndefined();
  });

  it("handles item with missing text field", () => {
    const raw = {
      memories: [{ uri: "viking://mem/1" }],
      resources: [],
      skills: [],
      total: 1,
    };
    const result = toSearchResult(raw);
    expect(result.memories[0].text).toBe("");
  });
});

describe("toGlobResult", () => {
  it("maps glob response", () => {
    const raw = {
      entries: ["viking://docs/a.md", "viking://docs/b.md"],
      total: 2,
    };
    const result = toGlobResult(raw);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toBe("viking://docs/a.md");
    expect(result.total).toBe(2);
  });

  it("handles empty entries", () => {
    const result = toGlobResult({ entries: [], total: 0 });
    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("handles null/undefined", () => {
    expect(toGlobResult(null).entries).toHaveLength(0);
    expect(toGlobResult(undefined).entries).toHaveLength(0);
  });
});

describe("toGrepResult", () => {
  it("maps grep response with line numbers", () => {
    const raw = {
      matches: [
        { uri: "viking://docs/a.md", lineNumber: 10, line: "function foo()" },
        { uri: "viking://docs/a.md", lineNumber: 20, line: "function bar()" },
      ],
      total: 2,
    };
    const result = toGrepResult(raw);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].lineNumber).toBe(10);
    expect(result.matches[0].line).toBe("function foo()");
    expect(result.total).toBe(2);
  });

  it("handles matches without line numbers", () => {
    const raw = {
      matches: [{ uri: "viking://docs/a.md", line: "content" }],
      total: 1,
    };
    const result = toGrepResult(raw);
    expect(result.matches[0].lineNumber).toBeUndefined();
  });

  it("handles empty matches", () => {
    const result = toGrepResult({ matches: [], total: 0 });
    expect(result.matches).toHaveLength(0);
  });

  it("handles null/undefined", () => {
    expect(toGrepResult(null).matches).toHaveLength(0);
    expect(toGrepResult(undefined).matches).toHaveLength(0);
  });
});
