import { describe, it, expect } from "vitest";
import type { KnowledgeBase, GlobResult, GrepOptions, GrepResult } from "./knowledge-base";
import type { SearchQuery, SearchMode } from "../common/search-query";
import type { SearchResult } from "../knowledge/model/search-result";

describe("KnowledgeBase interface", () => {
  it("can be satisfied by a mock", () => {
    const mock: KnowledgeBase = {
      search: async () => ({ memories: [], resources: [], skills: [], total: 0 }),
      glob: async () => ({ entries: [], total: 0 }),
      grep: async () => ({ matches: [], total: 0 }),
    };
    expect(typeof mock.search).toBe("function");
    expect(typeof mock.glob).toBe("function");
    expect(typeof mock.grep).toBe("function");
  });

  it("search accepts SearchQuery and returns SearchResult", async () => {
    const mock: KnowledgeBase = {
      search: async (_q: SearchQuery) => ({ memories: [], resources: [], skills: [], total: 0 }),
      glob: async () => ({ entries: [], total: 0 }),
      grep: async () => ({ matches: [], total: 0 }),
    };
    const result = await mock.search({ query: "test", mode: "auto" as SearchMode });
    expect(result.total).toBe(0);
  });
});

describe("GlobResult", () => {
  it("has entries and total", () => {
    const r: GlobResult = { entries: ["viking://a", "viking://b"], total: 2 };
    expect(r.entries).toHaveLength(2);
    expect(r.total).toBe(2);
  });
});

describe("GrepOptions", () => {
  it("accepts optional fields", () => {
    const opts: GrepOptions = { pattern: "TODO", caseSensitive: false, maxResults: 10 };
    expect(opts.pattern).toBe("TODO");
  });
});

describe("GrepResult", () => {
  it("has matches and total", () => {
    const r: GrepResult = {
      matches: [{ uri: "viking://f", lineNumber: 5, line: "TODO: fix" }],
      total: 1,
    };
    expect(r.matches[0].line).toBe("TODO: fix");
  });
});
