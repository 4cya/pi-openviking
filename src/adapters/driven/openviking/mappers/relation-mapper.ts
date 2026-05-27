import { Uri } from "../../../../domain/common/uri";
import type { LinkResult } from "../../../../domain/ports/graph-store";
import type { Relation } from "../../../../domain/knowledge/model/relation";

function toRelationItem(raw: unknown): Relation {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    uri: typeof r.uri === "string" ? r.uri : "",
    reason: typeof r.reason === "string" ? r.reason : undefined,
  };
}

export function toLinkResult(
  raw: unknown,
  source: Uri,
  targets: Uri[],
  reason?: string,
): LinkResult {
  return {
    source,
    targets,
    reason,
  };
}

export function toRelations(raw: unknown): Relation[] {
  if (raw === null || raw === undefined) return [];
  const r = raw as Record<string, unknown>;
  const items = Array.isArray(raw) ? raw : (Array.isArray(r.relations) ? r.relations : []);
  return items.map(toRelationItem);
}
