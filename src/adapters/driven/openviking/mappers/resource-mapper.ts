import type { ResourceImportResult } from "../../../../domain/ports/resource-store";
import { getRecord, safeString } from "./mapper-utils";

export function toResourceImportResult(raw: unknown): ResourceImportResult {
  const r = getRecord(raw);

  const status = typeof r.status === "string" ? r.status : "unknown";
  const rootUri = safeString(r.root_uri);
  const sourcePath = safeString(r.source_path);
  const errorsRaw = r.errors;
  const errors = Array.isArray(errorsRaw)
    ? errorsRaw.filter((e): e is string => typeof e === "string")
    : undefined;

  return { status, rootUri, sourcePath, errors: errors?.length ? errors : undefined };
}
