import { describe, test, expect, vi } from "vitest";
import { readOp } from "../src/operations/read";
import { createMockClient } from "./mocks";

describe("readOp", () => {
  test("reads content at explicit level", async () => {
    const { fs } = createMockClient({
      fs: {
        read: vi.fn(async () => ({ content: "# Hello\n\nWorld" })),
      },
    });

    const result = await readOp(fs, "viking://docs/readme.md", { level: "read" });
    expect(fs.read).toHaveBeenCalledWith("viking://docs/readme.md", "read", undefined);
    expect(result.content).toBe("# Hello\n\nWorld");
  });

  test("auto-level resolves to read for files", async () => {
    const { fs } = createMockClient({
      fs: {
        fsStat: vi.fn(async () => ({
          uri: "viking://docs/readme.md",
          children: [{ uri: "viking://docs/readme.md", type: "file" }],
        })),
        read: vi.fn(async () => ({ content: "file content" })),
      },
    });

    const result = await readOp(fs, "viking://docs/readme.md", { level: "auto" });
    expect(fs.fsStat).toHaveBeenCalledWith("viking://docs/readme.md", undefined);
    expect(fs.read).toHaveBeenCalledWith("viking://docs/readme.md", "read", undefined);
    expect(result.content).toBe("file content");
  });

  test("auto-level resolves to overview for directories", async () => {
    const { fs } = createMockClient({
      fs: {
        fsStat: vi.fn(async () => ({
          uri: "viking://docs/",
          children: [{ uri: "viking://docs/", type: "directory" }],
        })),
        read: vi.fn(async () => ({ content: "dir overview" })),
      },
    });

    const result = await readOp(fs, "viking://docs/", { level: "auto" });
    expect(fs.fsStat).toHaveBeenCalledWith("viking://docs/", undefined);
    expect(fs.read).toHaveBeenCalledWith("viking://docs/", "overview", undefined);
    expect(result.content).toBe("dir overview");
  });

  test("auto-level handles fsStat with no children (defaults to read)", async () => {
    const { fs } = createMockClient({
      fs: {
        fsStat: vi.fn(async () => ({
          uri: "viking://unknown",
          children: [],
        })),
        read: vi.fn(async () => ({ content: "content" })),
      },
    });

    const result = await readOp(fs, "viking://unknown", { level: "auto" });
    expect(fs.read).toHaveBeenCalledWith("viking://unknown", "read", undefined);
    expect(result.content).toBe("content");
  });

  test("defaults to auto level when no opts provided", async () => {
    const { fs } = createMockClient({
      fs: {
        fsStat: vi.fn(async () => ({
          uri: "viking://docs/readme.md",
          children: [{ uri: "viking://docs/readme.md", type: "file" }],
        })),
        read: vi.fn(async () => ({ content: "content" })),
      },
    });

    const result = await readOp(fs, "viking://docs/readme.md");
    expect(fs.fsStat).toHaveBeenCalled();
    expect(result.content).toBe("content");
  });

  test("forwards AbortSignal to fs calls", async () => {
    const signal = new AbortController().signal;
    const { fs } = createMockClient({
      fs: {
        read: vi.fn(async () => ({ content: "content" })),
      },
    });

    await readOp(fs, "viking://doc.md", { level: "read" }, signal);
    expect(fs.read).toHaveBeenCalledWith("viking://doc.md", "read", signal);
  });

  test("propagates fsStat error", async () => {
    const { fs } = createMockClient({
      fs: {
        fsStat: vi.fn(async () => { throw new Error("stat failed"); }),
      },
    });

    await expect(readOp(fs, "viking://bad", { level: "auto" })).rejects.toThrow("stat failed");
  });

  test("propagates read error", async () => {
    const { fs } = createMockClient({
      fs: {
        read: vi.fn(async () => { throw new Error("read failed"); }),
      },
    });

    await expect(readOp(fs, "viking://bad", { level: "read" })).rejects.toThrow("read failed");
  });
});
