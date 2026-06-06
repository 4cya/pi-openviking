import type { Content } from "../../../../domain/ports/fs-store";
import type { ContentLevel } from "../../../../domain/common/content-level";
import { Uri } from "../../../../domain/common/uri";
import { getRecord, safeString } from "./mapper-utils";

function extractBody(raw: unknown): string {
  // OV v0.3.x returns result as a direct string (markdown text)
  // e.g. {"status":"ok","result":"# Content..."}
  // The Transport unwraps the envelope, so raw may be a string.
  if (typeof raw === "string") return raw;

  // Fallback: object with body field (backward compat / test mocks)
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
