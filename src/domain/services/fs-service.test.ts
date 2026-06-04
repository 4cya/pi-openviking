import { describe, it, expect, vi } from "vitest";
import type { FsStore, FsEntry } from "../ports/fs-store";
import type { Uri } from "../common/uri";
import { FsService } from "./fs-service";

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

describe("FsService", () => {
  describe("list", () => {
    it("delegates to fsStore.list with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsService(store);

      await svc.list("viking://docs");

      expect(store.list).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs" }),
        undefined,
        undefined,
      );
    });

    it("passes recursive flag", async () => {
      const store = makeFsStore();
      const svc = new FsService(store);

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
      const svc = new FsService(store);

      const result = await svc.list("viking://docs");

      expect(result).toBe(expected);
    });
  });

  describe("tree", () => {
    it("delegates to fsStore.tree with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsService(store);

      await svc.tree("viking://");

      expect(store.tree).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://" }),
        undefined,
      );
    });

    it("returns FsEntry[] from store", async () => {
      const expected: FsEntry[] = [
        { uri: { value: "viking://docs" } as Uri, type: "directory" },
        { uri: { value: "viking://docs/a.md" } as Uri, type: "file" },
      ];
      const store = makeFsStore({ tree: vi.fn().mockResolvedValue(expected) });
      const svc = new FsService(store);

      const result = await svc.tree("viking://");

      expect(result).toBe(expected);
    });
  });

  describe("stat", () => {
    it("delegates to fsStore.stat with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsService(store);

      await svc.stat("viking://docs/a.md");

      expect(store.stat).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/a.md" }),
        undefined,
      );
    });

    it("returns FsEntry from store", async () => {
      const expected: FsEntry = { uri: { value: "viking://docs/a.md" } as Uri, type: "file", size: 1024 };
      const store = makeFsStore({ stat: vi.fn().mockResolvedValue(expected) });
      const svc = new FsService(store);

      const result = await svc.stat("viking://docs/a.md");

      expect(result).toBe(expected);
    });
  });

  describe("reindex", () => {
    it("delegates to fsStore.reindex with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsService(store);

      await svc.reindex("viking://resources/test.md");

      expect(store.reindex).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://resources/test.md" }),
        undefined,
        undefined,
      );
    });

    it("passes reindex mode", async () => {
      const store = makeFsStore();
      const svc = new FsService(store);

      await svc.reindex("viking://resources/test.md", "full");

      expect(store.reindex).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://resources/test.md" }),
        "full",
        undefined,
      );
    });

    it("passes AbortSignal", async () => {
      const store = makeFsStore();
      const svc = new FsService(store);
      const ac = new AbortController();

      await svc.reindex("viking://resources/test.md", "vectors_only", ac.signal);

      expect(store.reindex).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://resources/test.md" }),
        "vectors_only",
        ac.signal,
      );
    });
  });

  describe("delete", () => {
    it("delegates to fsStore.delete with parsed uri", async () => {
      const store = makeFsStore();
      const svc = new FsService(store);

      await svc.delete("viking://docs/a.md");

      expect(store.delete).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs/a.md" }),
        undefined,
        undefined,
      );
    });

    it("passes recursive flag", async () => {
      const store = makeFsStore();
      const svc = new FsService(store);

      await svc.delete("viking://docs", true);

      expect(store.delete).toHaveBeenCalledWith(
        expect.objectContaining({ value: "viking://docs" }),
        true,
        undefined,
      );
    });
  });
});
