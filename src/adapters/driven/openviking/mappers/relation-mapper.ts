import { Uri } from "../../../../domain/common/uri";
import type { LinkResult } from "../../../../domain/ports/graph-store";
import type { Relation } from "../../../../domain/knowledge/model/relation";
import { getRecord, safeOptionalString, safeString } from "./mapper-utils";

function toRelationItem(raw: unknown): Relation {
  const r = getRecord(raw);
  return {
    uri: safeString(r.uri),
    reason: safeOptionalString(r.reason),
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
  const r = getRecord(raw);
  const items = Array.isArray(raw) ? raw : (Array.isArray(r.relations) ? r.relations : []);
  return items.map(toRelationItem);
}
