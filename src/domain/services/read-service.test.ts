import { describe, it, expect, vi } from "vitest";
import type { FsStore, Content } from "../ports/fs-store";
import type { Uri } from "../common/uri";
import { ReadService } from "./read-service";

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

describe("ReadService", () => {
  it("delegates to fsStore.read with uri and defaults", async () => {
    const store = makeFsStore();
    const svc = new ReadService(store);

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
    const svc = new ReadService(store);

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
    const svc = new ReadService(store);

    const result = await svc.read("viking://docs/a.md", "read");

    expect(result).toBe(expected);
  });
});
