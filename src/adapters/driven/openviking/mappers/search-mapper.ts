import type { SearchResult } from "../../../../domain/knowledge/model/search-result";
import type { KnowledgeItem } from "../../../../domain/knowledge/model/knowledge-item";
import type { ResourceItem } from "../../../../domain/knowledge/model/resource-item";
import type { SkillItem } from "../../../../domain/knowledge/model/skill-item";
import type { GlobResult, GrepResult } from "../../../../domain/ports/knowledge-base";
import { getRecord, safeOptionalString, safeNumber, safeString, toArray } from "./mapper-utils";

function toKnowledgeItem(raw: unknown): KnowledgeItem {
  const r = getRecord(raw);
  return {
    uri: safeString(r.uri),
    text: safeString(r.text) || safeString(r.abstract) || "",
    abstract: safeOptionalString(r.abstract),
    overview: safeOptionalString(r.overview),
    score: safeNumber(r.score),
    category: safeOptionalString(r.category),
    level: safeNumber(r.level),
    modTime: safeOptionalString(r.modTime),
  };
}

function toResourceItem(raw: unknown): ResourceItem {
  const r = getRecord(raw);
  return {
    uri: safeString(r.uri),
    score: safeNumber(r.score),
    abstract: safeOptionalString(r.abstract),
  };
}

function toSkillItem(raw: unknown): SkillItem {
  const r = getRecord(raw);
  return {
    uri: safeString(r.uri),
    score: safeNumber(r.score),
    abstract: safeOptionalString(r.abstract),
  };
}

export function toSearchResult(raw: unknown): SearchResult {
  const r = getRecord(raw);

  // OV returns `query_plan` (snake_case) as object with reasoning/queries
  let queryPlan: string | undefined;
  const qp = r.query_plan;
  if (typeof qp === "string") {
    queryPlan = qp;
  } else if (qp && typeof qp === "object") {
    queryPlan = JSON.stringify(qp);
  }

  return {
    memories: toArray(r.memories).map(toKnowledgeItem),
    resources: toArray(r.resources).map(toResourceItem),
    skills: toArray(r.skills).map(toSkillItem),
    total: typeof r.total === "number" ? r.total : 0,
    queryPlan,
  };
}

export function toGlobResult(raw: unknown): GlobResult {
  const r = getRecord(raw);
  return {
    entries: Array.isArray(r.entries) ? r.entries.map(String) : [],
    total: typeof r.total === "number" ? r.total : 0,
  };
}

export function toGrepResult(raw: unknown): GrepResult {
  const r = getRecord(raw);
  const matches = Array.isArray(r.matches)
    ? r.matches.map((m: unknown) => {
        const match = getRecord(m);
        // OV returns: line (number), content (string), uri (string)
        return {
          uri: safeString(match.uri),
          lineNumber: safeNumber(match.line) ?? safeNumber(match.lineNumber),
          line: safeString(match.content) || safeString(match.line) || "",
        };
      })
    : [];
  return {
    matches,
    total: typeof r.count === "number" ? r.count : (typeof r.total === "number" ? r.total : 0),
  };
}
