import { ConnectionError } from "../../../../domain/errors/connection-error";
import { NotFoundError } from "../../../../domain/errors/not-found-error";
import { ValidationError } from "../../../../domain/errors/validation-error";
import { DomainError } from "../../../../domain/errors/domain-error";
import { getRecord } from "./mapper-utils";

function extractMessage(body: unknown): string {
  const b = getRecord(body);
  if (typeof b.message === "string") return b.message;
  if (typeof b.error === "string") return b.error;
  if (typeof b.detail === "string") return b.detail;
  return "";
}

export function toDomainError(
  httpStatus: number,
  body: unknown,
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
