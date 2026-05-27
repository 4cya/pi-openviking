import { describe, it, expect } from "vitest";
import type { RecallItem } from "./recall-item";

describe("RecallItem", () => {
  it("accepts search source", () => {
    const item: RecallItem = {
      item: { uri: "viking://doc", text: "content" },
      score: 0.85,
      source: "search",
    };
    expect(item.source).toBe("search");
    expect(item.score).toBe(0.85);
    expect(item.item.uri).toBe("viking://doc");
  });

  it("accepts graph source", () => {
    const item: RecallItem = {
      item: { uri: "viking://related", text: "related" },
      score: 0.6,
      source: "graph",
    };
    expect(item.source).toBe("graph");
  });
});
