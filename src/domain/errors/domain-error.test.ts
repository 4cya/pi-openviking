import { describe, it, expect } from "vitest";
import { DomainError } from "./domain-error";
import { NotFoundError } from "./not-found-error";
import { ConnectionError } from "./connection-error";
import { ValidationError } from "./validation-error";

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
});

describe("NotFoundError", () => {
  it("extends DomainError", () => {
    const e = new NotFoundError("resource not found");
    expect(e).toBeInstanceOf(DomainError);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("resource not found");
    expect(e.name).toBe("NotFoundError");
  });
});

describe("ConnectionError", () => {
  it("extends DomainError", () => {
    const e = new ConnectionError("OV unreachable");
    expect(e).toBeInstanceOf(DomainError);
    expect(e.message).toBe("OV unreachable");
    expect(e.name).toBe("ConnectionError");
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
});
