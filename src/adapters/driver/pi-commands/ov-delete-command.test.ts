import { describe, it, expect, vi } from "vitest";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { createOvDeleteCommand } from "./ov-delete-command";
import type { FsStore } from "../../../domain/ports/fs-store";

function mockCtx(overrides?: Partial<ExtensionCommandContext>): ExtensionCommandContext {
  return {
    ui: { notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) } as any,
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
    ...overrides,
  };
}

describe("ov-delete command", () => {
  it("calls fsStore.delete after user confirms", async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.fn().mockResolvedValue(true);
    const cmd = createOvDeleteCommand({ delete: del } as unknown as FsStore);
    const ctx = mockCtx({ ui: { notify: vi.fn(), confirm } as any });

    await cmd.handler("viking://docs/old.md", ctx);

    expect(confirm).toHaveBeenCalled();
    const calledUri = del.mock.calls[0][0];
    expect(calledUri.toString()).toBe("viking://docs/old.md");
    expect((ctx.ui as any).notify).toHaveBeenCalledWith(
      "Deleted: viking://docs/old.md",
      "info",
    );
  });

  it("does not delete when user cancels", async () => {
    const del = vi.fn();
    const confirm = vi.fn().mockResolvedValue(false);
    const cmd = createOvDeleteCommand({ delete: del } as unknown as FsStore);
    const ctx = mockCtx({ ui: { notify: vi.fn(), confirm } as any });

    await cmd.handler("viking://docs/safe.md", ctx);

    expect(del).not.toHaveBeenCalled();
    expect((ctx.ui as any).notify).toHaveBeenCalledWith("Delete cancelled.", "info");
  });

  it("shows usage for empty URI", async () => {
    const del = vi.fn();
    const cmd = createOvDeleteCommand({ delete: del } as unknown as FsStore);
    const ctx = mockCtx();

    await cmd.handler("  ", ctx);

    expect(del).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith("Usage: /ov-delete <uri>", "warning");
  });

  it("rejects invalid URI", async () => {
    const del = vi.fn();
    const cmd = createOvDeleteCommand({ delete: del } as unknown as FsStore);
    const ctx = mockCtx();

    await cmd.handler("not-a-uri", ctx);

    expect(del).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("Invalid URI"),
      "warning",
    );
  });

  it("handles delete error", async () => {
    const del = vi.fn().mockRejectedValue(new Error("permission denied"));
    const confirm = vi.fn().mockResolvedValue(true);
    const cmd = createOvDeleteCommand({ delete: del } as unknown as FsStore);
    const ctx = mockCtx({ ui: { notify: vi.fn(), confirm } as any });

    await cmd.handler("viking://docs/protected.md", ctx);

    expect((ctx.ui as any).notify).toHaveBeenCalledWith(
      expect.stringContaining("permission denied"),
      "error",
    );
  });
});
