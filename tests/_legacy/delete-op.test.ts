import { describe, test, expect, vi } from "vitest";
import { deleteOp } from "../../src/_legacy/operations/delete";
import type { DeleteResult } from "../../src/_legacy/ov-client/client";
import { createMockClient } from "./mocks";

describe("deleteOp", () => {
  test("deletes a viking:// URI and returns result", async () => {
    const verifiedDelete = vi.fn(async () => ({
      uri: "viking://resources/temp.txt",
      verified: true,
    } as DeleteResult));

    const { knowledge } = createMockClient({ knowledge: { verifiedDelete } as any });

    const result = await deleteOp(knowledge, { uri: "viking://resources/temp.txt" });
    expect(verifiedDelete).toHaveBeenCalledWith("viking://resources/temp.txt", undefined);
    expect(result.uri).toBe("viking://resources/temp.txt");
    expect(result.verified).toBe(true);
  });

  test("returns verified false when delete is not confirmed", async () => {
    const verifiedDelete = vi.fn(async () => ({
      uri: "viking://resources/stale.md",
      verified: false,
    } as DeleteResult));

    const { knowledge } = createMockClient({ knowledge: { verifiedDelete } as any });

    const result = await deleteOp(knowledge, { uri: "viking://resources/stale.md" });
    expect(result.verified).toBe(false);
  });

  test("forwards AbortSignal", async () => {
    const verifiedDelete = vi.fn(async () => ({
      uri: "viking://r",
      verified: true,
    } as DeleteResult));

    const { knowledge } = createMockClient({ knowledge: { verifiedDelete } as any });
    const signal = new AbortController().signal;

    await deleteOp(knowledge, { uri: "viking://r" }, signal);
    expect(verifiedDelete).toHaveBeenCalledWith("viking://r", signal);
  });

  test("propagates error", async () => {
    const verifiedDelete = vi.fn(async () => { throw new Error("delete failed"); });
    const { knowledge } = createMockClient({ knowledge: { verifiedDelete } as any });

    await expect(deleteOp(knowledge, { uri: "viking://bad" })).rejects.toThrow("delete failed");
  });
});
