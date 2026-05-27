import type { SearchResult } from "../../../../domain/knowledge/model/search-result";
import type { KnowledgeItem } from "../../../../domain/knowledge/model/knowledge-item";
import type { ResourceItem } from "../../../../domain/knowledge/model/resource-item";
import type { SkillItem } from "../../../../domain/knowledge/model/skill-item";
import type { GlobResult, GrepResult } from "../../../../domain/ports/knowledge-base";

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function toKnowledgeItem(raw: unknown): KnowledgeItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    uri: safeString(r.uri),
    text: safeString(r.text),
    abstract: typeof r.abstract === "string" ? r.abstract : undefined,
    overview: typeof r.overview === "string" ? r.overview : undefined,
    score: safeNumber(r.score),
    category: typeof r.category === "string" ? r.category : undefined,
    level: safeNumber(r.level),
    modTime: typeof r.modTime === "string" ? r.modTime : undefined,
  };
}

function toResourceItem(raw: unknown): ResourceItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    uri: safeString(r.uri),
    score: safeNumber(r.score),
    abstract: typeof r.abstract === "string" ? r.abstract : undefined,
  };
}

function toSkillItem(raw: unknown): SkillItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    uri: safeString(r.uri),
    score: safeNumber(r.score),
    abstract: typeof r.abstract === "string" ? r.abstract : undefined,
  };
}

function toArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

export function toSearchResult(raw: unknown): SearchResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    memories: toArray(r.memories).map(toKnowledgeItem),
    resources: toArray(r.resources).map(toResourceItem),
    skills: toArray(r.skills).map(toSkillItem),
    total: typeof r.total === "number" ? r.total : 0,
    queryPlan: typeof r.queryPlan === "string" ? r.queryPlan : undefined,
  };
}

export function toGlobResult(raw: unknown): GlobResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    entries: Array.isArray(r.entries) ? r.entries.map(String) : [],
    total: typeof r.total === "number" ? r.total : 0,
  };
}

export function toGrepResult(raw: unknown): GrepResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const matches = Array.isArray(r.matches)
    ? r.matches.map((m: unknown) => {
        const match = (m ?? {}) as Record<string, unknown>;
        return {
          uri: safeString(match.uri),
          lineNumber: safeNumber(match.lineNumber),
          line: safeString(match.line),
        };
      })
    : [];
  return {
    matches,
    total: typeof r.total === "number" ? r.total : 0,
  };
}
