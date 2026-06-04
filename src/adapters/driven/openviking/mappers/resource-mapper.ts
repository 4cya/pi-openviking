import type { ResourceImportResult } from "../../../../domain/ports/resource-store";

export function toResourceImportResult(raw: unknown): ResourceImportResult {
  const r = (raw ?? {}) as Record<string, unknown>;

  const status = typeof r.status === "string" ? r.status : "unknown";
  const rootUri = typeof r.root_uri === "string" ? r.root_uri : "";
  const sourcePath = typeof r.source_path === "string" ? r.source_path : "";
  const errorsRaw = r.errors;
  const errors = Array.isArray(errorsRaw)
    ? errorsRaw.filter((e): e is string => typeof e === "string")
    : undefined;

  return { status, rootUri, sourcePath, errors: errors?.length ? errors : undefined };
}
