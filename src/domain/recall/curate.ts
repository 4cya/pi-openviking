import type { SearchResult } from "../knowledge/model/search-result";

export interface CuratedItem {
  uri: string;
  text: string;
  score: number;
  source: "memory" | "resource";
  category?: string;
}

export interface CurateOpts {
  topN: number;
  scoreThreshold: number;
  maxTokens: number;
}

export interface CuratedResult {
  items: CuratedItem[];
  tokens: number;
  dropped: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function merge(results: SearchResult): CuratedItem[] {
  const items: CuratedItem[] = [];
  for (const m of results.memories) {
    items.push({ uri: m.uri, text: m.abstract ?? m.text, score: m.score ?? 0, source: "memory", category: m.category });
  }
  for (const r of results.resources) {
    items.push({ uri: r.uri, text: r.abstract ?? "", score: r.score ?? 0, source: "resource" });
  }
  return items;
}

function dedup(items: CuratedItem[]): CuratedItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.uri;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function curate(results: SearchResult, opts: CurateOpts): CuratedResult {
  const merged = merge(results);
  const deduped = dedup(merged);
  const sorted = deduped.sort((a, b) => b.score - a.score);
  const aboveThreshold = sorted.filter(i => i.score >= opts.scoreThreshold);
  const selected = aboveThreshold.slice(0, opts.topN);

  // Trim to budget
  let tokens = 0;
  const trimmed: CuratedItem[] = [];
  const overhead = 130;
  for (const item of selected) {
    const itemTokens = estimateTokens(item.text) + 60;
    if (tokens + itemTokens + overhead > opts.maxTokens) break;
    tokens += itemTokens;
    trimmed.push(item);
  }

  return {
    items: trimmed,
    tokens,
    dropped: merged.length - trimmed.length,
  };
}
