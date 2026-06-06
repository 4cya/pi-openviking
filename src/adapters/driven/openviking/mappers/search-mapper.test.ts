import { describe, it, expect } from "vitest";
import { toSearchResult, toGlobResult, toGrepResult } from "./search-mapper";

describe("toSearchResult", () => {
  it("maps full search response with all fields", () => {
    const raw = {
      memories: [
        { uri: "viking://mem/1", abstract: "mem abs", score: 0.9, category: "docs", level: 1, modTime: "2026-01-01T00:00:00Z" },
      ],
      resources: [
        { uri: "viking://res/1", score: 0.8, abstract: "res abs" },
      ],
      skills: [
        { uri: "viking://skill/1", score: 0.7, abstract: "skill abs" },
      ],
      total: 3,
      query_plan: { reasoning: "deep search", queries: [] },
    };

    const result = toSearchResult(raw);
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].uri).toBe("viking://mem/1");
    expect(result.memories[0].category).toBe("docs");
    // text falls back to abstract since OV doesn't return a text field
    expect(result.memories[0].text).toBe("mem abs");
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].abstract).toBe("res abs");
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].uri).toBe("viking://skill/1");
    expect(result.total).toBe(3);
    expect(result.queryPlan).toBe('{"reasoning":"deep search","queries":[]}');
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
      memories: [{ uri: "viking://mem/1", abstract: "has abstract" }],
      resources: [{ uri: "viking://res/1" }],
      skills: [],
      total: 1,
    };
    const result = toSearchResult(raw);
    expect(result.memories[0].text).toBe("has abstract");
    expect(result.resources[0].score).toBeUndefined();
  });

  it("handles null/undefined raw gracefully", () => {
    const empty = toSearchResult(null);
    expect(empty.memories).toHaveLength(0);
    expect(empty.total).toBe(0);

    const empty2 = toSearchResult(undefined);
    expect(empty2.memories).toHaveLength(0);
  });

  it("handles missing query_plan", () => {
    const raw = { memories: [], resources: [], skills: [], total: 0 };
    const result = toSearchResult(raw);
    expect(result.queryPlan).toBeUndefined();
  });

  it("handles query_plan as string", () => {
    const raw = {
      memories: [], resources: [], skills: [], total: 0,
      query_plan: "simple plan",
    };
    const result = toSearchResult(raw);
    expect(result.queryPlan).toBe("simple plan");
  });

  it("falls back text to abstract when no text field", () => {
    const raw = {
      memories: [{ uri: "viking://mem/1", abstract: "fallback abstract" }],
      resources: [],
      skills: [],
      total: 1,
    };
    const result = toSearchResult(raw);
    expect(result.memories[0].text).toBe("fallback abstract");
  });

  it("returns empty text when neither text nor abstract present", () => {
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
  it("maps grep response in OV format (line, content, count)", () => {
    const raw = {
      matches: [
        { uri: "viking://docs/a.md", line: 15, content: "function foo()" },
        { uri: "viking://docs/a.md", line: 25, content: "function bar()" },
      ],
      count: 2,
    };
    const result = toGrepResult(raw);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].lineNumber).toBe(15);
    expect(result.matches[0].line).toBe("function foo()");
    expect(result.total).toBe(2);
    expect(result.matches[1].lineNumber).toBe(25);
    expect(result.matches[1].line).toBe("function bar()");
  });

  it("handles legacy format (lineNumber, line, total) for backward compat", () => {
    const raw = {
      matches: [
        { uri: "viking://docs/a.md", lineNumber: 10, line: "legacy content" },
      ],
      total: 1,
    };
    const result = toGrepResult(raw);
    expect(result.matches[0].lineNumber).toBe(10);
    expect(result.matches[0].line).toBe("legacy content");
    expect(result.total).toBe(1);
  });

  it("handles matches without line numbers", () => {
    const raw = {
      matches: [{ uri: "viking://docs/a.md", content: "content" }],
      count: 1,
    };
    const result = toGrepResult(raw);
    expect(result.matches[0].lineNumber).toBeUndefined();
    expect(result.matches[0].line).toBe("content");
  });

  it("handles empty matches", () => {
    const result = toGrepResult({ matches: [], count: 0 });
    expect(result.matches).toHaveLength(0);
  });

  it("handles null/undefined", () => {
    expect(toGrepResult(null).matches).toHaveLength(0);
    expect(toGrepResult(undefined).matches).toHaveLength(0);
  });
});
