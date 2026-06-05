import type { Content } from "../../../../domain/ports/fs-store";
import type { ContentLevel } from "../../../../domain/common/content-level";
import { Uri } from "../../../../domain/common/uri";
import { getRecord, safeString } from "./mapper-utils";

function extractBody(raw: unknown): string {
  const r = getRecord(raw);
  return safeString(r.body);
}

export function toContent(raw: unknown, uri: Uri, level?: ContentLevel): Content {
  const body = extractBody(raw);
  return {
    uri,
    body,
    level,
  };
}
