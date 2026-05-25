import { describe, test, expect, vi } from "vitest";
import { searchOp } from "../../src/_legacy/operations/search";
import type { SearchResult } from "../../src/_legacy/ov-client/client";
import { createMockClient } from "./mocks";

describe("searchOp", () => {
  test("calls knowledge.search with query and returns results", async () => {
    const search = vi.fn(async () => ({
      memories: [{ text: "hello", score: 0.95, uri: "viking://test" }],
      resources: [],
      skills: [],
      total: 1,
    } as SearchResult));

    const { knowledge } = createMockClient({ knowledge: { search } as any });

    const result = await searchOp(knowledge, { query: "hello" });
    expect(search).toHaveBeenCalledWith(undefined, "hello", 10, "auto", undefined, undefined);
    expect(result.total).toBe(1);
    expect(result.memories[0].text).toBe("hello");
  });

  test("passes sessionId when provided", async () => {
    const search = vi.fn(async () => ({
      memories: [], resources: [], skills: [], total: 0,
    } as SearchResult));

    const { knowledge } = createMockClient({ knowledge: { search } as any });

    await searchOp(knowledge, { sessionId: "ov-sess-1", query: "hello" });
    expect(search).toHaveBeenCalledWith("ov-sess-1", "hello", 10, "auto", undefined, undefined);
  });

  test("passes uri when provided", async () => {
    const search = vi.fn(async () => ({
      memories: [], resources: [{ uri: "viking://docs/", score: 0.9 }], skills: [], total: 1,
    } as SearchResult));

    const { knowledge } = createMockClient({ knowledge: { search } as any });

    await searchOp(knowledge, { query: "hello", uri: "viking://resources/" });
    expect(search).toHaveBeenCalledWith(undefined, "hello", 10, "auto", "viking://resources/", undefined);
  });

  test("forwards limit and mode", async () => {
    const search = vi.fn(async () => ({
      memories: [], resources: [], skills: [], total: 0,
    } as SearchResult));

    const { knowledge } = createMockClient({ knowledge: { search } as any });

    await searchOp(knowledge, { query: "test", limit: 5, mode: "deep" });
    expect(search).toHaveBeenCalledWith(undefined, "test", 5, "deep", undefined, undefined);
  });

  test("forwards AbortSignal", async () => {
    const search = vi.fn(async () => ({
      memories: [], resources: [], skills: [], total: 0,
    } as SearchResult));

    const { knowledge } = createMockClient({ knowledge: { search } as any });
    const signal = new AbortController().signal;

    await searchOp(knowledge, { query: "test" }, signal);
    expect(search).toHaveBeenCalledWith(undefined, "test", 10, "auto", undefined, signal);
  });

  test("propagates error from knowledge.search", async () => {
    const search = vi.fn(async () => { throw new Error("search failed"); });
    const { knowledge } = createMockClient({ knowledge: { search } as any });

    await expect(searchOp(knowledge, { query: "bad" })).rejects.toThrow("search failed");
  });

  test("returns raw SearchResult with query_plan when present", async () => {
    const search = vi.fn(async () => ({
      memories: [{ text: "m1", score: 0.9, uri: "viking://m1" }],
      resources: [],
      skills: [],
      total: 1,
      query_plan: "deep search on namespace",
    } as SearchResult));

    const { knowledge } = createMockClient({ knowledge: { search } as any });

    const result = await searchOp(knowledge, { query: "test" });
    expect(result.query_plan).toBe("deep search on namespace");
  });
});
