import { describe, it, expect, vi } from "vitest";
import type { FsStore, WriteResult } from "../ports/fs-store";
import type { Uri } from "../common/uri";
import { WriteService } from "./write-service";

function makeFsStore(overrides?: Partial<FsStore>): FsStore {
  return {
    read: vi.fn().mockResolvedValue({ uri: { value: "viking://a" } as Uri, body: "" }),
    write: vi.fn().mockResolvedValue({ uri: { value: "viking://a" } as Uri, success: true }),
    list: vi.fn().mockResolvedValue([]),
    tree: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ uri: { value: "viking://a" } as Uri, type: "file" }),
    mkdir: vi.fn().mockResolvedValue(undefined),
    mv: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("WriteService", () => {
  describe("save", () => {
    it("delegates to fsStore.write with uri, content, and mode", async () => {
      const store = makeFsStore();
      const svc = new WriteService(store);

      await svc.save("viking://docs/a.md", "hello world", "replace");

      expect(store.write).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/a.md" }),
        "hello world",
        "replace",
        undefined,
      );
    });

    it("returns WriteResult from store", async () => {
      const expected: WriteResult = { uri: { value: "viking://docs/a.md" } as Uri, success: true };
      const store = makeFsStore({ write: vi.fn().mockResolvedValue(expected) });
      const svc = new WriteService(store);

      const result = await svc.save("viking://docs/a.md", "content");

      expect(result).toBe(expected);
    });
  });

  describe("mkdir", () => {
    it("delegates to fsStore.mkdir", async () => {
      const store = makeFsStore();
      const svc = new WriteService(store);

      await svc.mkdir("viking://docs/new-dir");

      expect(store.mkdir).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/new-dir" }),
        undefined,
      );
    });
  });

  describe("mv", () => {
    it("delegates to fsStore.mv with from and to uris", async () => {
      const store = makeFsStore();
      const svc = new WriteService(store);

      await svc.mv("viking://docs/a.md", "viking://docs/b.md");

      expect(store.mv).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/a.md" }),
        expect.objectContaining({ value: "viking://docs/b.md" }),
        undefined,
      );
    });
  });
});
