import { describe, test, expect, vi } from "vitest";
import { browseOp } from "../src/operations/browse";
import { createMockClient } from "./mocks";

describe("browseOp", () => {
  test("lists directory contents (default view)", async () => {
    const { fs } = createMockClient({
      fs: {
        fsList: vi.fn(async () => ({
          uri: "viking://resources/docs/",
          children: [
            { uri: "viking://resources/docs/api.md", type: "file", abstract: "API ref" },
            { uri: "viking://resources/docs/guides/", type: "directory" },
          ],
        })),
      },
    });

    const result = await browseOp(fs, { uri: "viking://resources/docs/" });
    expect(fs.fsList).toHaveBeenCalledWith("viking://resources/docs/", undefined, undefined, undefined);
    expect(result.uri).toBe("viking://resources/docs/");
    expect(result.children).toHaveLength(2);
  });

  test("returns tree view", async () => {
    const { fs } = createMockClient({
      fs: {
        fsTree: vi.fn(async () => ({
          uri: "viking://resources/",
          children: [
            { uri: "viking://resources/docs/", type: "directory" },
            { uri: "viking://resources/README.md", type: "file" },
          ],
        })),
      },
    });

    const result = await browseOp(fs, { uri: "viking://resources/", view: "tree" });
    expect(fs.fsTree).toHaveBeenCalledWith("viking://resources/", undefined);
    expect(result.children).toHaveLength(2);
  });

  test("returns stat view", async () => {
    const { fs } = createMockClient({
      fs: {
        fsStat: vi.fn(async () => ({
          uri: "viking://resources/file.md",
          children: [{ uri: "viking://resources/file.md", type: "file" }],
        })),
      },
    });

    const result = await browseOp(fs, { uri: "viking://resources/file.md", view: "stat" });
    expect(fs.fsStat).toHaveBeenCalledWith("viking://resources/file.md", undefined);
    expect(result.children[0].type).toBe("file");
  });

  test.each([
    { name: "recursive", opts: { recursive: true }, expected: [undefined, true, undefined] },
    { name: "simple", opts: { simple: true }, expected: [undefined, undefined, true] },
    { name: "both", opts: { recursive: true, simple: true }, expected: [undefined, true, true] },
  ])("passes $name to fsList", async ({ opts, expected }) => {
    const { fs } = createMockClient({
      fs: {
        fsList: vi.fn(async () => ({ uri: "viking://resources/", children: [] })),
      },
    });

    await browseOp(fs, { uri: "viking://resources/", view: "list", ...opts });
    expect(fs.fsList).toHaveBeenCalledWith("viking://resources/", ...expected);
  });

  test("forwards AbortSignal", async () => {
    const signal = new AbortController().signal;
    const { fs } = createMockClient({
      fs: {
        fsList: vi.fn(async () => ({ uri: "viking://", children: [] })),
      },
    });

    await browseOp(fs, { uri: "viking://" }, signal);
    expect(fs.fsList).toHaveBeenCalledWith("viking://", signal, undefined, undefined);
  });

  test("propagates fsTree error", async () => {
    const { fs } = createMockClient({
      fs: {
        fsTree: vi.fn(async () => { throw new Error("tree failed"); }),
      },
    });

    await expect(browseOp(fs, { uri: "viking://", view: "tree" })).rejects.toThrow("tree failed");
  });

  test("propagates fsList error", async () => {
    const { fs } = createMockClient({
      fs: {
        fsList: vi.fn(async () => { throw new Error("list failed"); }),
      },
    });

    await expect(browseOp(fs, { uri: "viking://", view: "list" })).rejects.toThrow("list failed");
  });

  test("propagates fsStat error", async () => {
    const { fs } = createMockClient({
      fs: {
        fsStat: vi.fn(async () => { throw new Error("stat failed"); }),
      },
    });

    await expect(browseOp(fs, { uri: "viking://", view: "stat" })).rejects.toThrow("stat failed");
  });
});
