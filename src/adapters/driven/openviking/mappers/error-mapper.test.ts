import { describe, it, expect } from "vitest";
import { toDomainError } from "./error-mapper";
import { ConnectionError, NotFoundError, ValidationError } from "../../../../domain/errors/domain-error";

describe("toDomainError", () => {
  const label = "KnowledgeBase.find";

  it("maps 401 to ConnectionError", () => {
    const err = toDomainError(401, { message: "unauthorized" }, label);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.message).toContain("Authentication failed");
    expect(err.message).toContain(label);
  });

  it("maps 403 to ConnectionError", () => {
    const err = toDomainError(403, { message: "forbidden" }, label);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.message).toContain("Access denied");
  });

  it("maps 404 to NotFoundError", () => {
    const err = toDomainError(404, { message: "not found" }, label);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.message).toContain("Resource not found");
    expect(err.message).toContain(label);
  });

  it("maps 409 to ValidationError", () => {
    const err = toDomainError(409, { message: "conflict" }, label);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain("Conflict");
  });

  it("maps 422 to ValidationError", () => {
    const err = toDomainError(422, { details: "invalid" }, label);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain("Validation failed");
    expect((err as ValidationError).details).toEqual({ details: "invalid" });
  });

  it("maps unknown 4xx to ValidationError", () => {
    const err = toDomainError(418, { message: "teapot" }, label);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain("418");
  });

  it("maps 5xx to ConnectionError", () => {
    const err = toDomainError(500, { message: "internal error" }, label);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.message).toContain("OV server error");
  });

  it("maps 502 to ConnectionError", () => {
    const err = toDomainError(502, null, label);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.message).toContain("OV server error");
  });

  it("maps 503 to ConnectionError", () => {
    const err = toDomainError(503, { message: "overloaded" }, label);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.message).toContain("Service unavailable");
  });

  it("includes method label in error message", () => {
    const err = toDomainError(404, null, "FsStore.read");
    expect(err.message).toContain("FsStore.read");
  });

  it("handles null/undefined body gracefully", () => {
    const err1 = toDomainError(500, null, label);
    expect(err1).toBeInstanceOf(ConnectionError);

    const err2 = toDomainError(422, undefined, label);
    expect(err2).toBeInstanceOf(ValidationError);
  });
});
