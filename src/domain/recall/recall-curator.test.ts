import { describe, it, expect, vi } from "vitest";
import { RecallCurator } from "./recall-curator";
import type { Scorer } from "./curate";
import type { SearchResult } from "../knowledge/model/search-result";
import type { RecallConfig } from "../../infrastructure/config/schema";
import type { Logger } from "../ports/logger";

function makeConfig(overrides?: Partial<RecallConfig>): RecallConfig {
  return {
    topN: 5,
    scoreThreshold: 0,
    maxTokens: 10000,
    expandGraph: false,
    searchMode: "find",
    ...overrides,
  };
}

function makeLogger(): Logger & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    info: vi.fn((msg: string) => messages.push(msg)),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(true),
  };
}

const sampleResult: SearchResult = {
  memories: [
    { uri: "viking://a", text: "AAA", abstract: "aaa", score: 0.9 },
    { uri: "viking://b", text: "BBB", abstract: "bbb", score: 0.5 },
  ],
  resources: [
    { uri: "viking://r1", score: 0.8, abstract: "resource one" },
  ],
  skills: [],
  total: 3,
};

describe("RecallCurator", () => {
  it("curates results using opts from config", () => {
    const config = makeConfig({ topN: 2, scoreThreshold: 0.6, maxTokens: 5000 });
    const logger = makeLogger();
    const curator = new RecallCurator(config, [], logger);

    const result = curator.curate(sampleResult);

    // topN=2, threshold=0.6: only a(0.9) and r1(0.8) pass threshold, limited to 2
    expect(result.items).toHaveLength(2);
    expect(result.items[0].uri).toBe("viking://a");
    expect(result.items[1].uri).toBe("viking://r1");
  });

  it("passes scorers from constructor into curate opts", () => {
    const boostScorer: Scorer = (_item, _query) => 10;
    const config = makeConfig();
    const logger = makeLogger();
    const curator = new RecallCurator(config, [boostScorer], logger);

    const result = curator.curate(sampleResult);

    // boostScorer adds 10 to every item → all well above threshold
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].score).toBeGreaterThanOrEqual(10);
  });

  it("emits log line with item count and tokens", () => {
    const config = makeConfig();
    const logger = makeLogger();
    const curator = new RecallCurator(config, [], logger);

    const result = curator.curate(sampleResult);

    expect(logger.info).toHaveBeenCalledWith(
      `curated ${sampleResult.total} items → ${result.items.length} items, ${result.tokens} tokens`,
    );
  });

  it("returns empty for empty results", () => {
    const config = makeConfig();
    const logger = makeLogger();
    const curator = new RecallCurator(config, [], logger);

    const empty: SearchResult = { memories: [], resources: [], skills: [], total: 0 };
    const result = curator.curate(empty);

    expect(result.items).toHaveLength(0);
    expect(result.tokens).toBe(0);
    expect(result.dropped).toBe(0);
  });

  it("returns empty when all results below threshold", () => {
    const config = makeConfig({ scoreThreshold: 0.99 });
    const logger = makeLogger();
    const curator = new RecallCurator(config, [], logger);

    const result = curator.curate(sampleResult);

    expect(result.items).toHaveLength(0);
  });

  it("returns empty when maxTokens is zero budget", () => {
    const config = makeConfig({ maxTokens: 1 });
    const logger = makeLogger();
    const curator = new RecallCurator(config, [], logger);

    const result = curator.curate(sampleResult);

    // maxTokens=1 is too small for any item (each needs ~130+ overhead)
    expect(result.items).toHaveLength(0);
  });
});
