import { describe, it, expect, vi } from "vitest";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { createOvReindexCommand } from "./ov-reindex-command";
import type { FsStore } from "../../../domain/ports/fs-store";
import type { Uri } from "../../../domain/common/uri";

function makeFsStore(overrides?: Partial<FsStore>): FsStore {
  const reindex = vi.fn().mockResolvedValue(undefined);
  return {
    read: vi.fn(),
    write: vi.fn(),
    list: vi.fn(),
    tree: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    mv: vi.fn(),
    delete: vi.fn(),
    reindex,
    ...overrides,
  } as unknown as FsStore;
}

function mockCtx(): ExtensionCommandContext {
  return {
    ui: { notify: vi.fn(), confirm: vi.fn() } as any,
    cwd: "/test",
    hasUI: false,
    sessionManager: {} as any,
    modelRegistry: {} as any,
    model: undefined,
    isIdle: () => true,
    signal: undefined as any,
    abort: vi.fn(),
    hasPendingMessages: () => false,
    shutdown: vi.fn(),
    getContextUsage: () => undefined,
    compact: vi.fn(),
    getSystemPrompt: () => "",
    waitForIdle: vi.fn(),
    newSession: vi.fn() as any,
    fork: vi.fn() as any,
    navigateTree: vi.fn() as any,
    switchSession: vi.fn() as any,
    reload: vi.fn() as any,
  };
}

describe("ov-reindex command", () => {
  it("reindexes a URI with default mode", async () => {
    const store = makeFsStore();
    const cmd = createOvReindexCommand(store);
    const ctx = mockCtx();

    await cmd.handler("viking://resources/test.md", ctx);

    expect(store.reindex).toHaveBeenCalledWith(
      expect.objectContaining({ value: "viking://resources/test.md" }),
      "vectors_only",
      undefined,
    );
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("Reindexed"),
      expect.any(String),
    );
  });

  it("passes --mode full flag", async () => {
    const store = makeFsStore();
    const cmd = createOvReindexCommand(store);
    const ctx = mockCtx();

    await cmd.handler("viking://resources/test.md --mode full", ctx);

    expect(store.reindex).toHaveBeenCalledWith(
      expect.objectContaining({ value: "viking://resources/test.md" }),
      "full",
      undefined,
    );
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("full"),
      expect.any(String),
    );
  });

  it("shows usage when no URI provided", async () => {
    const store = makeFsStore();
    const cmd = createOvReindexCommand(store);
    const ctx = mockCtx();

    await cmd.handler("", ctx);

    expect(store.reindex).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("Usage"),
      "warning",
    );
  });

  it("validates URI", async () => {
    const store = makeFsStore();
    const cmd = createOvReindexCommand(store);
    const ctx = mockCtx();

    await cmd.handler("not-a-valid-uri", ctx);

    expect(store.reindex).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("Invalid URI"),
      "warning",
    );
  });

  it("handles error", async () => {
    const store = makeFsStore({
      reindex: vi.fn().mockRejectedValue(new Error("OV unreachable")),
    });
    const cmd = createOvReindexCommand(store);
    const ctx = mockCtx();

    await cmd.handler("viking://resources/test.md", ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("OV unreachable"),
      "error",
    );
  });
});
