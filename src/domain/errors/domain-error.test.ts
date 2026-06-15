import { describe, it, expect } from "vitest";
import { DomainError, NotFoundError, ConnectionError, ValidationError } from "./domain-error";

describe("DomainError", () => {
  it("extends Error", () => {
    const e = new DomainError("something failed");
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("something failed");
  });

  it("has name set to constructor name", () => {
    const e = new DomainError("test");
    expect(e.name).toBe("DomainError");
  });

  it("accepts optional code", () => {
    const e = new DomainError("not found", "NOT_FOUND");
    expect(e.code).toBe("NOT_FOUND");
  });

  it("code is undefined when not provided", () => {
    const e = new DomainError("generic");
    expect(e.code).toBeUndefined();
  });
});

describe("NotFoundError", () => {
  it("extends DomainError", () => {
    const e = new NotFoundError("resource not found");
    expect(e).toBeInstanceOf(DomainError);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("resource not found");
    expect(e.name).toBe("NotFoundError");
  });

  it("accepts optional code", () => {
    const e = new NotFoundError("missing", "ERR_MISSING");
    expect(e.code).toBe("ERR_MISSING");
  });
});

describe("ConnectionError", () => {
  it("extends DomainError", () => {
    const e = new ConnectionError("OV unreachable");
    expect(e).toBeInstanceOf(DomainError);
    expect(e.message).toBe("OV unreachable");
    expect(e.name).toBe("ConnectionError");
  });

  it("accepts optional code", () => {
    const e = new ConnectionError("timeout", "ERR_TIMEOUT");
    expect(e.code).toBe("ERR_TIMEOUT");
  });
});

describe("ValidationError", () => {
  it("extends DomainError", () => {
    const e = new ValidationError("invalid Uri");
    expect(e).toBeInstanceOf(DomainError);
    expect(e.message).toBe("invalid Uri");
    expect(e.name).toBe("ValidationError");
  });

  it("carries additional details", () => {
    const e = new ValidationError("invalid Uri", { uri: "bad://" });
    expect(e.message).toBe("invalid Uri");
    expect(e.details).toEqual({ uri: "bad://" });
  });

  it("accepts optional code after details", () => {
    const e = new ValidationError("bad", { field: "x" }, "ERR_VALIDATION");
    expect(e.code).toBe("ERR_VALIDATION");
    expect(e.details).toEqual({ field: "x" });
  });

  it("code is undefined when omitted", () => {
    const e = new ValidationError("bad", { field: "x" });
    expect(e.code).toBeUndefined();
  });
});
