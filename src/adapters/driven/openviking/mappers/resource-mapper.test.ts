import { describe, it, expect } from "vitest";
import { toResourceImportResult } from "./resource-mapper";
import type { OVResourceImportResponse } from "../types/ov-resource";

describe("toResourceImportResult", () => {
  it("extracts status, rootUri, sourcePath from full response", () => {
    const raw: OVResourceImportResponse = {
      status: "success",
      root_uri: "viking://resources/guide.md",
      source_path: "https://example.com/guide.md",
    };
    const result = toResourceImportResult(raw);
    expect(result.status).toBe("success");
    expect(result.rootUri).toBe("viking://resources/guide.md");
    expect(result.sourcePath).toBe("https://example.com/guide.md");
    expect(result.errors).toBeUndefined();
  });

  it("extracts errors array when present", () => {
    const raw: OVResourceImportResponse = {
      status: "error",
      root_uri: "",
      source_path: "https://example.com/bad.pdf",
      errors: ["File too large", "Unsupported format"],
    };
    const result = toResourceImportResult(raw);
    expect(result.status).toBe("error");
    expect(result.errors).toEqual(["File too large", "Unsupported format"]);
  });

  it("handles missing errors", () => {
    const raw: OVResourceImportResponse = {
      status: "success",
      root_uri: "viking://resources/guide.md",
      source_path: "https://example.com/guide.md",
    };
    const result = toResourceImportResult(raw);
    expect(result.errors).toBeUndefined();
  });

  it("filters non-string errors", () => {
    const raw: OVResourceImportResponse = {
      status: "error",
      root_uri: "",
      source_path: "",
      errors: ["real error", 42 as unknown as string, "another error"],
    };
    const result = toResourceImportResult(raw);
    expect(result.errors).toEqual(["real error", "another error"]);
  });
});
