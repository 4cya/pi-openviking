import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readSettings } from "./loader";

function withTempDir(fn: (dir: string) => void) {
  const dir = join(tmpdir(), `ov-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  try {
    fn(dir);
  } finally {
    // cleanup not needed for tests
  }
}

describe("readSettings", () => {
  it("returns {} when no .pi/settings.json exists", () => {
    const result = readSettings("/tmp/nonexistent-dir-12345");
    expect(result).toEqual({});
  });

  it("returns {} on invalid JSON", () => {
    withTempDir((dir) => {
      const dir2 = join(dir, ".pi");
      mkdirSync(dir2, { recursive: true });
      writeFileSync(join(dir2, "settings.json"), "not valid json");
      const result = readSettings(dir);
      expect(result).toEqual({});
    });
  });

  it("returns parsed JSON when file is valid", () => {
    withTempDir((dir) => {
      const dir2 = join(dir, ".pi");
      mkdirSync(dir2, { recursive: true });
      writeFileSync(join(dir2, "settings.json"), JSON.stringify({ logLevel: "warn", customKey: 42 }));
      const result = readSettings(dir);
      expect(result).toEqual({ logLevel: "warn", customKey: 42 });
    });
  });
});
