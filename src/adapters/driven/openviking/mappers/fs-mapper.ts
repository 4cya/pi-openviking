import { Uri } from "../../../../domain/common/uri";
import type { FsEntry, WriteResult } from "../../../../domain/ports/fs-store";
import { getRecord, safeOptionalString, safeNumber } from "./mapper-utils";

export function toWriteResult(raw: unknown, expectedUri: string): WriteResult {
  const r = getRecord(raw);
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

export function toFsEntry(raw: unknown, fallbackUri?: string): FsEntry {
  const r = getRecord(raw);

  // OV returns `uri` (ls/tree) or `name` (stat) for the identifier
  const uriStr = typeof r.uri === "string" && r.uri
    ? r.uri
    : typeof r.name === "string" && r.name
      ? (fallbackUri ?? r.name)
      : undefined;

  if (!uriStr) {
    throw new Error("FsEntry missing required field: uri");
  }

  // OV returns `isDir` (boolean); fallback to `type` string for backward compat
  const type = typeof r.isDir === "boolean"
    ? (r.isDir ? ("directory" as const) : ("file" as const))
    : typeof r.type === "string"
      ? (assertValidType(r.type), r.type)
      : ("file" as const);

  return {
    uri: new Uri(uriStr),
    type,
    size: safeNumber(r.size),
    modTime: safeOptionalString(r.modTime),
  };
}

export function toFsEntries(raw: unknown): FsEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => toFsEntry(item));
}
