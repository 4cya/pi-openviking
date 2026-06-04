import { describe, it, expect, vi } from "vitest";
import type { ResourceStore, ResourceImportResult } from "../ports/resource-store";
import { ResourceService } from "./resource-service";

function makeStore(overrides?: Partial<ResourceStore>): ResourceStore {
  return {
    importUrl: vi.fn().mockResolvedValue({
      status: "success",
      rootUri: "viking://resources/doc.md",
      sourcePath: "https://example.com/doc.md",
    }),
    ...overrides,
  };
}

describe("ResourceService", () => {
  it("delegates importUrl to store", async () => {
    const store = makeStore();
    const svc = new ResourceService(store);

    const result = await svc.importUrl("https://example.com/doc.md");

    expect(store.importUrl).toHaveBeenCalledWith(
      "https://example.com/doc.md",
      undefined,
      undefined,
    );
    expect(result.status).toBe("success");
    expect(result.rootUri).toBe("viking://resources/doc.md");
  });

  it("passes options through", async () => {
    const store = makeStore();
    const svc = new ResourceService(store);

    await svc.importUrl("https://example.com/doc.md", {
      targetUri: "viking://resources/custom.md",
      reason: "docs",
      wait: true,
    });

    expect(store.importUrl).toHaveBeenCalledWith(
      "https://example.com/doc.md",
      { targetUri: "viking://resources/custom.md", reason: "docs", wait: true },
      undefined,
    );
  });

  it("returns result from store", async () => {
    const expected: ResourceImportResult = {
      status: "success",
      rootUri: "viking://resources/guide.md",
      sourcePath: "https://example.com/guide.md",
    };
    const store = makeStore({ importUrl: vi.fn().mockResolvedValue(expected) });
    const svc = new ResourceService(store);

    const result = await svc.importUrl("https://example.com/guide.md");

    expect(result).toBe(expected);
  });

  it("forwards errors from store", async () => {
    const store = makeStore({ importUrl: vi.fn().mockRejectedValue(new Error("fail")) });
    const svc = new ResourceService(store);

    await expect(svc.importUrl("https://example.com/doc.md")).rejects.toThrow("fail");
  });
});
