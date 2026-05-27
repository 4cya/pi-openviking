import { describe, it, expect } from "vitest";
import { toFsEntry, toFsEntries, toWriteResult } from "./fs-mapper";

describe("toWriteResult", () => {
  it("maps write response with success flag", () => {
    const raw = { uri: "viking://docs/file.md", success: true };
    const result = toWriteResult(raw, "viking://docs/file.md");
    expect(result.uri.value).toBe("viking://docs/file.md");
    expect(result.success).toBe(true);
  });

  it("maps write response with success=false", () => {
    const raw = { uri: "viking://docs/file.md", success: false };
    const result = toWriteResult(raw, "viking://docs/file.md");
    expect(result.success).toBe(false);
  });

  it("infers success from status field when no success flag", () => {
    const result = toWriteResult({ uri: "viking://docs/file.md", status: "ok" }, "viking://docs/file.md");
    expect(result.success).toBe(true);
  });

  it("returns success=false when status is not ok", () => {
    const result = toWriteResult({ uri: "viking://docs/file.md", status: "error" }, "viking://docs/file.md");
    expect(result.success).toBe(false);
  });

  it("uses the provided URI over raw uri", () => {
    const raw = { uri: "viking://raw.md", success: true };
    const result = toWriteResult(raw, "viking://explicit.md");
    expect(result.uri.value).toBe("viking://explicit.md");
  });
});

describe("toFsEntry", () => {
  it("maps file entry", () => {
    const raw = { uri: "viking://docs/file.md", type: "file", size: 1234, modTime: "2026-01-01T00:00:00Z" };
    const entry = toFsEntry(raw);
    expect(entry.uri.value).toBe("viking://docs/file.md");
    expect(entry.type).toBe("file");
    expect(entry.size).toBe(1234);
    expect(entry.modTime).toBe("2026-01-01T00:00:00Z");
  });

  it("maps directory entry", () => {
    const raw = { uri: "viking://docs/", type: "directory" };
    const entry = toFsEntry(raw);
    expect(entry.type).toBe("directory");
  });

  it("handles missing optional fields", () => {
    const raw = { uri: "viking://docs/file.md", type: "file" };
    const entry = toFsEntry(raw);
    expect(entry.size).toBeUndefined();
    expect(entry.modTime).toBeUndefined();
  });

  it("throws on invalid type", () => {
    const raw = { uri: "viking://x", type: "symlink" };
    expect(() => toFsEntry(raw)).toThrow();
  });

  it("throws on missing type", () => {
    const raw = { uri: "viking://x" };
    expect(() => toFsEntry(raw)).toThrow();
  });

  it("throws on missing uri", () => {
    const raw = { type: "file" };
    expect(() => toFsEntry(raw)).toThrow();
  });
});

describe("toFsEntries", () => {
  it("maps array of entries", () => {
    const raw = [
      { uri: "viking://a.md", type: "file", size: 100 },
      { uri: "viking://b.md", type: "file", size: 200 },
    ];
    const entries = toFsEntries(raw);
    expect(entries).toHaveLength(2);
    expect(entries[0].uri.value).toBe("viking://a.md");
    expect(entries[1].size).toBe(200);
  });

  it("returns empty array for empty input", () => {
    expect(toFsEntries([])).toHaveLength(0);
  });

  it("throws if any entry is invalid", () => {
    const raw = [
      { uri: "viking://a.md", type: "file" },
      { uri: "viking://b.md", type: "unknown" },
    ];
    expect(() => toFsEntries(raw)).toThrow();
  });

  it("handles null/undefined by returning empty array", () => {
    expect(toFsEntries(null)).toHaveLength(0);
    expect(toFsEntries(undefined)).toHaveLength(0);
  });
});
