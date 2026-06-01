import { describe, it, expect, vi } from "vitest";
import { RecallService } from "./recall-service";
import type { KnowledgeBase } from "../ports/knowledge-base";
import type { RecallCurator } from "./recall-curator";
import type { RecallConfig } from "../../infrastructure/config/schema";
import type { Logger } from "../ports/logger";
import type { SearchResult } from "../knowledge/model/search-result";
import { Uri } from "../common/uri";
import { ConnectionError } from "../errors/connection-error";
import { ValidationError } from "../errors/validation-error";

function makeConfig(overrides?: Partial<RecallConfig>): RecallConfig {
  return {
    topN: 5,
    scoreThreshold: 0.5,
    maxTokens: 4000,
    expandGraph: false,
    expandGraphDepth: 1 as const,
    expandGraphMaxRatio: 0.2,
    expandGraphMinSeedScore: 0.4,
    searchMode: "find",
    autoRecall: true,
    ...overrides,
  };
}

function makeLogger(): Logger & { warns: string[] } {
  const warns: string[] = [];
  return {
    warns,
    info: vi.fn(),
    warn: vi.fn((msg: string) => warns.push(msg)),
    error: vi.fn(),
    debug: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(true),
  };
}

function makeKB(): KnowledgeBase {
  return {
    find: vi.fn(),
    search: vi.fn(),
    glob: vi.fn(),
    grep: vi.fn(),
  };
}

function makeCurator(result?: Partial<import("./curate").CuratedResult>) {
  return {
    curate: vi.fn().mockResolvedValue({
      items: [],
      tokens: 0,
      dropped: 0,
      ...result,
    }),
  } as unknown as RecallCurator;
}

const sampleKBResult: SearchResult = {
  memories: [{ uri: "viking://a", text: "alpha", score: 0.9 }],
  resources: [],
  skills: [],
  total: 1,
};

describe("RecallService", () => {
  it("returns empty result when recall is disabled, without calling KB", async () => {
    const config = makeConfig();
    const kb = makeKB();
    const curator = makeCurator();
    const logger = makeLogger();

    const service = new RecallService(kb, curator, config, logger, false);
    const result = await service.recall("test prompt");

    expect(result).toEqual({
      items: [],
      tokens: 0,
      formatted: "",
      total: 0,
    });
    expect(kb.find).not.toHaveBeenCalled();
    expect(kb.search).not.toHaveBeenCalled();
  });

  it("calls kb.find() and returns curated result when searchMode is find", async () => {
    const config = makeConfig({ searchMode: "find", topN: 3, targetUri: "viking://proj" });
    const kb = makeKB();
    (kb.find as ReturnType<typeof vi.fn>).mockResolvedValue(sampleKBResult);
    const curator = makeCurator({
      items: [{ uri: "viking://a", text: "alpha", score: 0.9, source: "memory" as const }],
      tokens: 50,
    });
    const logger = makeLogger();

    const service = new RecallService(kb, curator, config, logger, true);
    const result = await service.recall("test query");

    const findCalls = (kb.find as ReturnType<typeof vi.fn>).mock.calls;
    expect(findCalls).toHaveLength(1);
    const [arg, signal] = findCalls[0];
    expect(arg.query).toBe("test query");
    expect(arg.limit).toBe(3);
    expect(arg.targetUri.value).toBe("viking://proj");
    expect(signal).toBeUndefined();
    expect(kb.search).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.tokens).toBe(50);
    expect(result.formatted).toContain("viking://a");
  });

  it("calls kb.search() when searchMode is search, without sessionId", async () => {
    const config = makeConfig({ searchMode: "search" });
    const kb = makeKB();
    (kb.search as ReturnType<typeof vi.fn>).mockResolvedValue(sampleKBResult);
    const curator = makeCurator({
      items: [{ uri: "viking://a", text: "alpha", score: 0.9, source: "memory" as const }],
      tokens: 40,
    });
    const logger = makeLogger();

    const service = new RecallService(kb, curator, config, logger, true);
    const result = await service.recall("deep query");

    expect(kb.find).not.toHaveBeenCalled();
    const searchCalls = (kb.search as ReturnType<typeof vi.fn>).mock.calls;
    expect(searchCalls).toHaveLength(1);
    const [arg] = searchCalls[0];
    expect(arg.query).toBe("deep query");
    expect(arg.limit).toBe(5);
    expect(arg.sessionId).toBeUndefined();
    expect(result.items).toHaveLength(1);
    expect(result.formatted).toContain("viking://a");
  });

  it("forwards sessionId to kb.search() when provided", async () => {
    const config = makeConfig({ searchMode: "search" });
    const kb = makeKB();
    (kb.search as ReturnType<typeof vi.fn>).mockResolvedValue(sampleKBResult);
    const curator = makeCurator();
    const logger = makeLogger();
    const sid = { toString: () => "sess-123" } as any;

    const service = new RecallService(kb, curator, config, logger, true);
    await service.recall("with session", sid);

    const searchCalls = (kb.search as ReturnType<typeof vi.fn>).mock.calls;
    expect(searchCalls).toHaveLength(1);
    const [arg] = searchCalls[0];
    expect(arg.sessionId).toBe(sid);
  });

  it("ignores sessionId when searchMode is find", async () => {
    const config = makeConfig({ searchMode: "find" });
    const kb = makeKB();
    (kb.find as ReturnType<typeof vi.fn>).mockResolvedValue(sampleKBResult);
    const curator = makeCurator();
    const logger = makeLogger();
    const sid = { toString: () => "sess-456" } as any;

    const service = new RecallService(kb, curator, config, logger, true);
    await service.recall("find with session", sid);

    const findCalls = (kb.find as ReturnType<typeof vi.fn>).mock.calls;
    expect(findCalls).toHaveLength(1);
    // find() does not receive sessionId
    const [arg] = findCalls[0];
    expect(arg.sessionId).toBeUndefined();
    expect(kb.search).not.toHaveBeenCalled();
  });

  it("returns empty result and logs warn on ConnectionError", async () => {
    const config = makeConfig();
    const kb = makeKB();
    (kb.find as ReturnType<typeof vi.fn>).mockRejectedValue(new ConnectionError("ECONNREFUSED"));
    const curator = makeCurator();
    const logger = makeLogger();

    const service = new RecallService(kb, curator, config, logger, true);
    const result = await service.recall("any prompt");

    expect(result).toEqual({ items: [], tokens: 0, formatted: "", total: 0 });
    expect(logger.warns).toContain("OV unavailable, skipping recall");
  });

  it("propagates ValidationError from KB without catching", async () => {
    const config = makeConfig();
    const kb = makeKB();
    (kb.find as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ValidationError("bad input", { field: "query" }),
    );
    const curator = makeCurator();
    const logger = makeLogger();

    const service = new RecallService(kb, curator, config, logger, true);

    await expect(service.recall("any prompt")).rejects.toThrow(ValidationError);
  });
});
