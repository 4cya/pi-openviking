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
  it("maps file entry from OV ls/tree response (isDir=false)", () => {
    const raw = { uri: "viking://docs/file.md", isDir: false, size: 1234, modTime: "2026-01-01T00:00:00Z" };
    const entry = toFsEntry(raw);
    expect(entry.uri.value).toBe("viking://docs/file.md");
    expect(entry.type).toBe("file");
    expect(entry.size).toBe(1234);
    expect(entry.modTime).toBe("2026-01-01T00:00:00Z");
  });

  it("maps directory entry from OV ls/tree response (isDir=true)", () => {
    const raw = { uri: "viking://docs/", isDir: true };
    const entry = toFsEntry(raw);
    expect(entry.type).toBe("directory");
  });

  it("maps stat response using name + fallbackUri", () => {
    const raw = { name: "INDEX.md", isDir: false, size: 2295, modTime: "2026-06-05T05:05:41Z" };
    const entry = toFsEntry(raw, "viking://resources/docs-ov/INDEX.md");
    expect(entry.uri.value).toBe("viking://resources/docs-ov/INDEX.md");
    expect(entry.type).toBe("file");
    expect(entry.size).toBe(2295);
  });

  it("handles missing optional fields", () => {
    const raw = { uri: "viking://docs/file.md", isDir: false };
    const entry = toFsEntry(raw);
    expect(entry.size).toBeUndefined();
    expect(entry.modTime).toBeUndefined();
  });

  it("still accepts legacy type field (backward compat)", () => {
    const raw = { uri: "viking://docs/file.md", type: "file", size: 100 };
    const entry = toFsEntry(raw);
    expect(entry.type).toBe("file");
    expect(entry.size).toBe(100);
  });

  it("throws on invalid type when no isDir", () => {
    const raw = { uri: "viking://x", type: "symlink" };
    expect(() => toFsEntry(raw)).toThrow();
  });

  it("throws on missing uri and no fallbackUri", () => {
    const raw = { name: "file.md", isDir: false };
    expect(() => toFsEntry(raw)).toThrow();
  });

  it("does not accept bare name without fallbackUri (not a valid viking:// URI)", () => {
    const raw = { name: "file.md", isDir: false };
    expect(() => toFsEntry(raw)).toThrow(/viking/);
  });
});

describe("toFsEntries", () => {
  it("maps array of entries (OV format)", () => {
    const raw = [
      { uri: "viking://a.md", isDir: false, size: 100 },
      { uri: "viking://b.md", isDir: false, size: 200 },
    ];
    const entries = toFsEntries(raw);
    expect(entries).toHaveLength(2);
    expect(entries[0].uri.value).toBe("viking://a.md");
    expect(entries[1].size).toBe(200);
  });

  it("returns empty array for empty input", () => {
    expect(toFsEntries([])).toHaveLength(0);
  });

  it("handles null/undefined by returning empty array", () => {
    expect(toFsEntries(null)).toHaveLength(0);
    expect(toFsEntries(undefined)).toHaveLength(0);
  });
});
