/**
 * Mapper for OV content read endpoint.
 *
 * See OV 03-filesystem.md.
 */
import type { Content } from "../../../../domain/ports/fs-store";
import type { ContentLevel } from "../../../../domain/common/content-level";
import { Uri } from "../../../../domain/common/uri";
import type { OVContentReadResponse } from "../types/ov-common";

function extractBody(raw: OVContentReadResponse): string {
  // OV v0.3.x returns result as a direct string (markdown text)
  if (typeof raw === "string") return raw;

  // Object with body field (backward compat / test mocks)
  return raw?.body ?? "";
}

export function toContent(raw: OVContentReadResponse, uri: Uri, level?: ContentLevel): Content {
  const body = extractBody(raw);
  return {
    uri,
    body,
    level,
  };
}
