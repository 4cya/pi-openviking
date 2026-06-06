/**
 * Mapper for OV resource import endpoint.
 *
 * See OV 02-resources.md.
 */
import type { ResourceImportResult } from "../../../../domain/ports/resource-store";
import type { OVResourceImportResponse } from "../types/ov-resource";

export function toResourceImportResult(raw: OVResourceImportResponse): ResourceImportResult {
  const errors = Array.isArray(raw.errors)
    ? raw.errors.filter((e): e is string => typeof e === "string")
    : undefined;

  return {
    status: raw.status,
    rootUri: raw.root_uri,
    sourcePath: raw.source_path,
    errors: errors?.length ? errors : undefined,
  };
}
