import type { Content } from "../../../../domain/ports/fs-store";
import type { ContentLevel } from "../../../../domain/common/content-level";
import { Uri } from "../../../../domain/common/uri";

function extractBody(raw: unknown): string {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.body === "string") return r.body;
  }
  return "";
}

export function toContent(raw: unknown, uri: Uri, level?: ContentLevel): Content {
  const body = extractBody(raw);
  return {
    uri,
    body,
    level,
  };
}
