import { describe, it, expect } from "vitest";
import { SearchService } from "./search-service";
import type { KnowledgeBase, GlobResult, GrepResult } from "../ports/knowledge-base";
import type { SearchResult } from "../knowledge/model/search-result";
import type { RecallConfig } from "../common/recall-config";
import type { Logger } from "../ports/logger";
import { Uri } from "../common/uri";

const emptyResult: SearchResult = { memories: [], resources: [], skills: [], total: 0 };

function makeKB(overrides?: Partial<KnowledgeBase>): KnowledgeBase {
  return {
    find: async () => emptyResult,
    search: async () => emptyResult,
    glob: async () => ({ entries: [], total: 0 } satisfies GlobResult),
    grep: async () => ({ matches: [], total: 0 } satisfies GrepResult),
    ...overrides,
  };
}

function makeLogger(): Logger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    isEnabled: () => true,
  };
}

describe("SearchService", () => {
  it("search with mode=fast delegates to kb.find()", async () => {
    const findCalls: unknown[] = [];
    const kb = makeKB({
      find: async (q) => { findCalls.push(q); return emptyResult; },
    });
    const svc = new SearchService(kb, { searchMode: "find" } as RecallConfig, makeLogger());
    await svc.search({ query: "test", mode: "find" });
    expect(findCalls).toHaveLength(1);
    expect(findCalls[0]).toEqual({ query: "test", limit: undefined, targetUri: undefined });
  });

  it("search with mode=deep delegates to kb.search()", async () => {
    const searchCalls: unknown[] = [];
    const kb = makeKB({
      search: async (r) => { searchCalls.push(r); return emptyResult; },
    });
    const svc = new SearchService(kb, { searchMode: "find" } as RecallConfig, makeLogger());
    await svc.search({ query: "deep query", mode: "search" });
    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0]).toMatchObject({ query: "deep query" });
  });

  it("search with mode=auto uses config.searchMode", async () => {
    const findCalls: unknown[] = [];
    const kb = makeKB({
      find: async (q) => { findCalls.push(q); return emptyResult; },
    });
    const svc = new SearchService(kb, { searchMode: "find" } as RecallConfig, makeLogger());
    await svc.search({ query: "auto query", mode: "auto" });
    expect(findCalls).toHaveLength(1);
  });

  it("search with mode=auto and config.searchMode=search delegates to kb.search()", async () => {
    const searchCalls: unknown[] = [];
    const kb = makeKB({
      search: async (r) => { searchCalls.push(r); return emptyResult; },
    });
    const svc = new SearchService(kb, { searchMode: "search" } as RecallConfig, makeLogger());
    await svc.search({ query: "auto query", mode: "auto" });
    expect(searchCalls).toHaveLength(1);
  });

  it("search passes limit and targetUri through", async () => {
    const findCalls: unknown[] = [];
    const kb = makeKB({
      find: async (q) => { findCalls.push(q); return emptyResult; },
    });
    const svc = new SearchService(kb, { searchMode: "find" } as RecallConfig, makeLogger());
    await svc.search({ query: "test", mode: "find", limit: 10, targetUri: "viking://kb/test" });
    expect(findCalls[0]).toEqual({ query: "test", limit: 10, targetUri: new Uri("viking://kb/test") });
  });

  it("glob delegates to kb.glob()", async () => {
    const globCalls: unknown[] = [];
    const expected: GlobResult = { entries: ["viking://a", "viking://b"], total: 2 };
    const kb = makeKB({
      glob: async (...args) => { globCalls.push(args); return expected; },
    });
    const svc = new SearchService(kb, { searchMode: "find" } as RecallConfig, makeLogger());
    const result = await svc.glob("viking://**/*.md");
    expect(result).toBe(expected);
    expect(globCalls).toHaveLength(1);
    expect((globCalls[0] as any[]).slice(0, 3)).toEqual(["viking://**/*.md", undefined, undefined]);
  });

  it("search passes SearchOptions through to kb.find()", async () => {
    let callOpts: unknown = undefined;
    const kb = makeKB({
      find: async (_q, opts) => { callOpts = opts; return emptyResult; },
    });
    const svc = new SearchService(kb, { searchMode: "find" } as RecallConfig, makeLogger());
    await svc.search({
      query: "test",
      mode: "find",
      scoreThreshold: 0.7,
      since: "2026-01-01",
      until: "2026-06-01",
      timeField: "created_at",
      level: 2,
      includeProvenance: true,
    });
    expect(callOpts).toEqual({
      scoreThreshold: 0.7,
      since: "2026-01-01",
      until: "2026-06-01",
      timeField: "created_at",
      level: 2,
      includeProvenance: true,
    });
  });

  it("search passes SearchOptions through to kb.search()", async () => {
    let callOpts: unknown = undefined;
    const kb = makeKB({
      search: async (_r, opts) => { callOpts = opts; return emptyResult; },
    });
    const svc = new SearchService(kb, { searchMode: "search" } as RecallConfig, makeLogger());
    await svc.search({
      query: "test",
      mode: "search",
      scoreThreshold: 0.5,
    });
    expect(callOpts).toEqual({
      scoreThreshold: 0.5,
      since: undefined,
      until: undefined,
      timeField: undefined,
      level: undefined,
      includeProvenance: undefined,
    });
  });

  it("search with no SearchOptions passes undefined opts", async () => {
    let callOpts: unknown = "sentinel";
    const kb = makeKB({
      find: async (_q, opts) => { callOpts = opts; return emptyResult; },
    });
    const svc = new SearchService(kb, { searchMode: "find" } as RecallConfig, makeLogger());
    await svc.search({ query: "test", mode: "find" });
    expect(callOpts).toEqual({
      scoreThreshold: undefined,
      since: undefined,
      until: undefined,
      timeField: undefined,
      level: undefined,
      includeProvenance: undefined,
    });
  });

  it("grep delegates to kb.grep()", async () => {
    const grepCalls: unknown[] = [];
    const expected: GrepResult = { matches: [{ uri: "viking://a", line: "hello" }], total: 1 };
    const kb = makeKB({
      grep: async (...args) => { grepCalls.push(args); return expected; },
    });
    const svc = new SearchService(kb, { searchMode: "find" } as RecallConfig, makeLogger());
    const result = await svc.grep("hello", { uri: "viking://", caseInsensitive: true });
    expect(result).toBe(expected);
    expect(grepCalls).toHaveLength(1);
    expect((grepCalls[0] as any[])[0]).toBe("hello");
  });
});
