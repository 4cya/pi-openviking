import { Uri } from "../../../../domain/common/uri";
import type { FsEntry, WriteResult } from "../../../../domain/ports/fs-store";

export function toWriteResult(raw: unknown, expectedUri: string): WriteResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  // Trust explicit `success` field if present.
  // Fall back to `status === "ok"` if status field present (envelope unwrapped).
  // Default true — HTTP 2xx already confirms the write succeeded.
  const success = typeof r.success === "boolean"
    ? r.success
    : typeof r.status === "string"
      ? r.status === "ok"
      : true;
  return {
    uri: new Uri(expectedUri),
    success,
  };
}

const VALID_TYPES = new Set(["file", "directory"]);

function assertValidType(t: unknown): asserts t is "file" | "directory" {
  if (!VALID_TYPES.has(t as string)) {
    throw new Error(`Invalid FsEntry type: "${String(t)}" — must be "file" or "directory"`);
  }
}

export function toFsEntry(raw: unknown): FsEntry {
  const r = (raw ?? {}) as Record<string, unknown>;

  if (typeof r.uri !== "string" || !r.uri) {
    throw new Error("FsEntry missing required field: uri");
  }
  if (!r.type) {
    throw new Error("FsEntry missing required field: type");
  }

  assertValidType(r.type);

  return {
    uri: new Uri(r.uri),
    type: r.type,
    size: typeof r.size === "number" ? r.size : undefined,
    modTime: typeof r.modTime === "string" ? r.modTime : undefined,
  };
}

export function toFsEntries(raw: unknown): FsEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toFsEntry);
}
