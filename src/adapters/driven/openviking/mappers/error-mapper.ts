/**
 * Mapper for OV error responses.
 *
 * See OV 01-overview.md (error response format).
 */
import { ConnectionError, NotFoundError, ValidationError, DomainError } from "../../../../domain/errors/domain-error";
import type { OVErrorBody } from "../types/ov-common";

function extractMessage(body: OVErrorBody | Record<string, unknown> | null | undefined): string {
  if (!body) return "";
  if (typeof body.message === "string") return body.message;
  // OVErrorBody only has code/message; check error/detail via Record fallback
  const r = body as Record<string, unknown>;
  if (typeof r.error === "string") return r.error;
  if (typeof r.detail === "string") return r.detail;
  return "";
}

export function toDomainError(
  httpStatus: number,
  body: OVErrorBody | Record<string, unknown> | null | undefined,
  methodLabel: string,
): DomainError {
  const msg = extractMessage(body);
  const prefix = `[${methodLabel}]`;

  if (httpStatus === 401) {
    return new ConnectionError(`${prefix} Authentication failed — ${msg || "check API key"}`);
  }
  if (httpStatus === 403) {
    return new ConnectionError(`${prefix} Access denied — ${msg || "check account/user permissions"}`);
  }
  if (httpStatus === 404) {
    return new NotFoundError(`${prefix} Resource not found — ${msg || "URI does not exist"}`);
  }
  if (httpStatus === 409) {
    return new ValidationError(`${prefix} Conflict — ${msg || "resource already exists"}`);
  }
  if (httpStatus === 422) {
    return new ValidationError(
      `${prefix} Validation failed — ${msg || "invalid request"}`,
      body && typeof body === "object" ? (body as Record<string, unknown>) : undefined,
    );
  }
  if (httpStatus === 503) {
    return new ConnectionError(`${prefix} Service unavailable — ${msg || "OV is overloaded"}`);
  }
  if (httpStatus >= 500) {
    return new ConnectionError(`${prefix} OV server error (${httpStatus}) — ${msg || "unknown"}`);
  }
  // Catch-all for other 4xx
  return new ValidationError(`${prefix} Request failed (${httpStatus}) — ${msg || "unknown"}`);
}
