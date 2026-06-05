import { describe, it, expect, vi } from "vitest";
import type { FsStore, Content, FsEntry, WriteResult } from "../ports/fs-store";
import type { Uri } from "../common/uri";
import { FsStoreService } from "./fs-store-service";

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
    reindex: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("FsStoreService", () => {
  describe("read", () => {
    it("delegates to fsStore.read with uri and defaults", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.read("viking://docs/a.md");

      expect(store.read).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/a.md" }),
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it("passes level, offset, and limit to fsStore.read", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.read("viking://docs/a.md", "read", 10, 50);

      expect(store.read).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/a.md" }),
        "read",
        10,
        50,
        undefined,
      );
    });

    it("returns Content from store", async () => {
      const expected: Content = { uri: { value: "viking://docs/a.md" } as Uri, body: "file content", level: "read" };
      const store = makeFsStore({ read: vi.fn().mockResolvedValue(expected) });
      const svc = new FsStoreService(store);

      const result = await svc.read("viking://docs/a.md", "read");

      expect(result).toBe(expected);
    });
  });

  describe("save", () => {
    it("delegates to fsStore.write with uri, content, and mode", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

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
      const svc = new FsStoreService(store);

      const result = await svc.save("viking://docs/a.md", "content");

      expect(result).toBe(expected);
    });
  });

  describe("mkdir", () => {
    it("delegates to fsStore.mkdir", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

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
      const svc = new FsStoreService(store);

      await svc.mv("viking://docs/a.md", "viking://docs/b.md");

      expect(store.mv).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/a.md" }),
        expect.objectContaining({ value: "viking://docs/b.md" }),
        undefined,
      );
    });
  });

  describe("list", () => {
    it("delegates to fsStore.list with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.list("viking://docs");

      expect(store.list).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs" }),
        undefined,
        undefined,
      );
    });

    it("passes recursive flag", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.list("viking://docs", true);

      expect(store.list).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs" }),
        true,
        undefined,
      );
    });

    it("returns FsEntry[] from store", async () => {
      const expected: FsEntry[] = [
        { uri: { value: "viking://docs/a.md" } as Uri, type: "file" },
      ];
      const store = makeFsStore({ list: vi.fn().mockResolvedValue(expected) });
      const svc = new FsStoreService(store);

      const result = await svc.list("viking://docs");

      expect(result).toBe(expected);
    });
  });

  describe("tree", () => {
    it("delegates to fsStore.tree with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.tree("viking://");

      expect(store.tree).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://" }),
        undefined,
      );
    });
  });

  describe("stat", () => {
    it("delegates to fsStore.stat with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.stat("viking://docs/a.md");

      expect(store.stat).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/a.md" }),
        undefined,
      );
    });
  });

  describe("delete", () => {
    it("delegates to fsStore.delete with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.delete("viking://docs/a.md");

      expect(store.delete).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/a.md" }),
        undefined,
        undefined,
      );
    });

    it("passes recursive flag", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.delete("viking://docs", true);

      expect(store.delete).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs" }),
        true,
        undefined,
      );
    });
  });

  describe("reindex", () => {
    it("delegates to fsStore.reindex with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.reindex("viking://resources/test.md");

      expect(store.reindex).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://resources/test.md" }),
        undefined,
        undefined,
      );
    });

    it("passes reindex mode", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);

      await svc.reindex("viking://resources/test.md", "full");

      expect(store.reindex).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://resources/test.md" }),
        "full",
        undefined,
      );
    });

    it("passes AbortSignal", async () => {
      const store = makeFsStore();
      const svc = new FsStoreService(store);
      const ac = new AbortController();

      await svc.reindex("viking://resources/test.md", "vectors_only", ac.signal);

      expect(store.reindex).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://resources/test.md" }),
        "vectors_only",
        ac.signal,
      );
    });
  });
});
