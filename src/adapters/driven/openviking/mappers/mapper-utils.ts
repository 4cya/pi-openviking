/** Cast unknown to Record -- null/undefined become {}. */
export function getRecord(raw: unknown): Record<string, unknown> {
  return (raw ?? {}) as Record<string, unknown>;
}

/** Required string: non-string -> "". */
export function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Optional string: non-string -> undefined. */
export function safeOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Optional number: non-number -> undefined. */
export function safeNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

/** Array guard: non-array -> []. */
export function toArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}
