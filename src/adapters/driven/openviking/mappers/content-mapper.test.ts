import { describe, it, expect } from "vitest";
import { toContent } from "./content-mapper";
import { Uri } from "../../../../domain/common/uri";

describe("toContent", () => {
  const uri = new Uri("viking://docs/architecture.md");

  it("maps read-level response with body", () => {
    const raw = { uri: "viking://docs/architecture.md", body: "# Architecture\n\nHexagonal design." };
    const result = toContent(raw, uri, "read");
    expect(result.uri).toEqual(uri);
    expect(result.body).toBe("# Architecture\n\nHexagonal design.");
    expect(result.level).toBe("read");
  });

  it("maps abstract-level response", () => {
    const raw = { uri: "viking://docs/architecture.md", body: "Hexagonal architecture overview" };
    const result = toContent(raw, uri, "abstract");
    expect(result.body).toBe("Hexagonal architecture overview");
    expect(result.level).toBe("abstract");
  });

  it("maps overview-level response", () => {
    const raw = { uri: "viking://docs/architecture.md", body: "File: architecture.md — Hexagonal design document" };
    const result = toContent(raw, uri, "overview");
    expect(result.body).toBe("File: architecture.md — Hexagonal design document");
    expect(result.level).toBe("overview");
  });

  it("defaults level to undefined when not provided", () => {
    const raw = { uri: "viking://docs/architecture.md", body: "content" };
    const result = toContent(raw, uri);
    expect(result.level).toBeUndefined();
  });

  it("uses the provided Uri object, not raw.uri string", () => {
    const raw = { uri: "viking://some/other.md", body: "data" };
    // Uri arg is authoritative; raw.uri is ignored for the domain object
    const result = toContent(raw, new Uri("viking://authoritative/path.md"), "read");
    expect(result.uri.value).toBe("viking://authoritative/path.md");
  });

  it("handles empty body", () => {
    const raw = { uri: "viking://empty.md", body: "" };
    const result = toContent(raw, uri, "read");
    expect(result.body).toBe("");
  });

  it("handles null body from OV", () => {
    const raw = { uri: "viking://null.md", body: null };
    const result = toContent(raw, uri, "read");
    expect(result.body).toBe("");
  });

  it("handles raw with extra fields (OV may return metadata)", () => {
    const raw = {
      uri: "viking:/docs/extra.md",
      body: "content with metadata",
      modTime: "2026-01-01T00:00:00Z",
      size: 1234,
    };
    const result = toContent(raw, uri, "read");
    expect(result.body).toBe("content with metadata");
    expect(result.level).toBe("read");
  });
});
