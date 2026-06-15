import { describe, it, expect } from "vitest";
import type { KnowledgeBase, GlobResult, GrepResult, GrepOptions } from "./knowledge-base";
import type { FindQuery, SearchRequest } from "../common/search-query";
import type { SearchResult } from "../knowledge/model/search-result";

describe("KnowledgeBase interface", () => {
  it("can be satisfied by a mock", () => {
    const mock: KnowledgeBase = {
      find: async () => ({ memories: [], resources: [], skills: [], total: 0 }),
      search: async () => ({ memories: [], resources: [], skills: [], total: 0 }),
      glob: async () => ({ entries: [], total: 0 }),
      grep: async () => ({ matches: [], total: 0 }),
    };
    expect(typeof mock.find).toBe("function");
    expect(typeof mock.search).toBe("function");
    expect(typeof mock.glob).toBe("function");
    expect(typeof mock.grep).toBe("function");
  });

  it("find accepts FindQuery and returns SearchResult", async () => {
    const mock: KnowledgeBase = {
      find: async (_q: FindQuery) => ({ memories: [], resources: [], skills: [], total: 0 }),
      search: async () => ({ memories: [], resources: [], skills: [], total: 0 }),
      glob: async () => ({ entries: [], total: 0 }),
      grep: async () => ({ matches: [], total: 0 }),
    };
    const result = await mock.find({ query: "test" });
    expect(result.total).toBe(0);
  });

  it("search accepts SearchRequest and returns SearchResult", async () => {
    const mock: KnowledgeBase = {
      find: async () => ({ memories: [], resources: [], skills: [], total: 0 }),
      search: async (_r: SearchRequest) => ({ memories: [], resources: [], skills: [], total: 0 }),
      glob: async () => ({ entries: [], total: 0 }),
      grep: async () => ({ matches: [], total: 0 }),
    };
    const result = await mock.search({ query: "test" });
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
  it("accepts required uri and optional fields", () => {
    const opts: GrepOptions = { uri: "viking://", caseInsensitive: true, nodeLimit: 10 };
    expect(opts.uri).toBe("viking://");
    expect(opts.caseInsensitive).toBe(true);
    expect(opts.nodeLimit).toBe(10);
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
