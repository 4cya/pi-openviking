import { describe, test, expect, vi } from "vitest";
import { COMMANDS } from "../src/bootstrap";
import type { CommandRegisterDeps } from "../src/commands/types";
import { createMockClient, createMockSessionSync } from "./mocks";

function createMockPi() {
  const commands: Record<string, { description?: string; handler: (...args: any[]) => any }> = {};
  const messages: any[] = [];

  return {
    registerCommand: vi.fn((name: string, options: { description?: string; handler: (...args: any[]) => any }) => {
      commands[name] = options;
    }),
    sendMessage: vi.fn((msg: any, opts?: any) => {
      messages.push({ msg, opts });
    }),
    getCommand: (name: string) => commands[name],
    getMessages: () => messages,
  };
}

function createMockCmdCtx() {
  return {
    ui: { notify: vi.fn() },
    hasUI: true,
  };
}

function registerAll(pi: ReturnType<typeof createMockPi>, overrides?: {
  session?: Record<string, unknown>;
  fs?: Record<string, unknown>;
  knowledge?: Record<string, unknown>;
  sync?: ReturnType<typeof createMockSessionSync>;
  autoRecallState?: { enabled: boolean };
}) {
  const { session, fs, knowledge } = createMockClient(
    overrides
      ? { session: overrides.session as any, fs: overrides.fs as any, knowledge: overrides.knowledge as any }
      : undefined,
  );
  const sync = overrides?.sync ?? createMockSessionSync();
  const autoRecallState = overrides?.autoRecallState ?? { enabled: true };

  const deps: CommandRegisterDeps = { session, fs, knowledge, sync, autoRecallState };
  for (const register of COMMANDS) register(pi as any, deps);

  return { pi, session, fs, knowledge, sync, autoRecallState };
}

function makeDeps(overrides?: {
  session?: Record<string, unknown>;
  fs?: Record<string, unknown>;
  knowledge?: Record<string, unknown>;
  sync?: ReturnType<typeof createMockSessionSync>;
  autoRecallState?: { enabled: boolean };
}) {
  const pi = createMockPi();
  return registerAll(pi, overrides);
}

describe("COMMANDS registry", () => {
  test("registers 6 commands", () => {
    const { pi } = makeDeps();
    expect(pi.registerCommand).toHaveBeenCalledTimes(6);
    expect(pi.getCommand("ov-search")).toBeDefined();
    expect(pi.getCommand("ov-ls")).toBeDefined();
    expect(pi.getCommand("ov-import")).toBeDefined();
    expect(pi.getCommand("ov-delete")).toBeDefined();
    expect(pi.getCommand("ov-recall")).toBeDefined();
    expect(pi.getCommand("ov-commit")).toBeDefined();
  });

  describe("/ov-search", () => {
    test("searches and injects message", async () => {
      const search = vi.fn(async () => ({
        memories: [],
        resources: [{ uri: "viking://doc", score: 0.9, abstract: "doc" }],
        skills: [],
        total: 1,
      }));
      const { pi } = makeDeps({ knowledge: { search } as any });
      const cmd = pi.getCommand("ov-search");
      const ctx = createMockCmdCtx();

      await cmd.handler("how does auth work", ctx);
      expect(search).toHaveBeenCalledWith("ov-sess-1", "how does auth work", 10, "auto", undefined, undefined);
      expect(pi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ customType: "ov-search", display: true }),
        expect.objectContaining({ triggerTurn: true, deliverAs: "steer" }),
      );
    });

    test("parses flags", async () => {
      const search = vi.fn(async () => ({ memories: [], resources: [], skills: [], total: 0 }));
      const { pi } = makeDeps({ knowledge: { search } as any });
      const cmd = pi.getCommand("ov-search");
      const ctx = createMockCmdCtx();

      await cmd.handler("--deep --limit 20 --uri viking://docs auth flow", ctx);
      expect(search).toHaveBeenCalledWith("ov-sess-1", "auth flow", 20, "deep", "viking://docs", undefined);
    });

    test("notifies on missing query", async () => {
      const { pi } = makeDeps();
      const cmd = pi.getCommand("ov-search");
      const ctx = createMockCmdCtx();

      await cmd.handler("", ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Usage:"), "error");
      expect(pi.sendMessage).not.toHaveBeenCalled();
    });

    test("notifies on error", async () => {
      const search = vi.fn(async () => { throw new Error("search boom"); });
      const { pi } = makeDeps({ knowledge: { search } as any });
      const cmd = pi.getCommand("ov-search");
      const ctx = createMockCmdCtx();

      await cmd.handler("hello", ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith("✗ Search failed: search boom", "error");
    });
  });

  describe("/ov-ls", () => {
    test("lists and injects message", async () => {
      const fsList = vi.fn(async () => ({ uri: "viking://resources", children: [] }));
      const { pi } = makeDeps({ fs: { fsList } as any });
      const cmd = pi.getCommand("ov-ls");
      const ctx = createMockCmdCtx();

      await cmd.handler("viking://resources", ctx);
      expect(fsList).toHaveBeenCalledWith("viking://resources", undefined, undefined, undefined);
      expect(pi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ customType: "ov-ls", display: true }),
        expect.objectContaining({ triggerTurn: true, deliverAs: "steer" }),
      );
    });

    test("uses tree flag", async () => {
      const fsTree = vi.fn(async () => ({ uri: "viking://resources", children: [] }));
      const { pi } = makeDeps({ fs: { fsTree } as any });
      const cmd = pi.getCommand("ov-ls");
      const ctx = createMockCmdCtx();

      await cmd.handler("--tree viking://resources", ctx);
      expect(fsTree).toHaveBeenCalledWith("viking://resources", undefined);
    });

    test("uses stat flag", async () => {
      const fsStat = vi.fn(async () => ({ uri: "viking://resources/file.md", children: [] }));
      const { pi } = makeDeps({ fs: { fsStat } as any });
      const cmd = pi.getCommand("ov-ls");
      const ctx = createMockCmdCtx();

      await cmd.handler("--stat viking://resources/file.md", ctx);
      expect(fsStat).toHaveBeenCalledWith("viking://resources/file.md", undefined);
    });

    test("defaults to viking://", async () => {
      const fsList = vi.fn(async () => ({ uri: "viking://", children: [] }));
      const { pi } = makeDeps({ fs: { fsList } as any });
      const cmd = pi.getCommand("ov-ls");
      const ctx = createMockCmdCtx();

      await cmd.handler("", ctx);
      expect(fsList).toHaveBeenCalledWith("viking://", undefined, undefined, undefined);
    });
  });

  describe("/ov-import", () => {
    test("imports URL and notifies", async () => {
      const addResource = vi.fn(async () => ({ root_uri: "viking://resources/doc", status: "success", errors: [] }));
      const { pi } = makeDeps({ knowledge: { addResource } as any });
      const cmd = pi.getCommand("ov-import");
      const ctx = createMockCmdCtx();

      await cmd.handler("https://example.com/docs", ctx);
      expect(addResource).toHaveBeenCalled();
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("✓ Imported:"), "info");
    });

    test("notifies on missing source", async () => {
      const { pi } = makeDeps();
      const cmd = pi.getCommand("ov-import");
      const ctx = createMockCmdCtx();

      await cmd.handler("", ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Usage:"), "error");
    });
  });

  describe("/ov-delete", () => {
    test("deletes and notifies", async () => {
      const verifiedDelete = vi.fn(async () => ({ uri: "viking://resources/old", verified: true }));
      const { pi } = makeDeps({ knowledge: { verifiedDelete } as any });
      const cmd = pi.getCommand("ov-delete");
      const ctx = createMockCmdCtx();

      await cmd.handler("viking://resources/old", ctx);
      expect(verifiedDelete).toHaveBeenCalledWith("viking://resources/old", undefined);
      expect(ctx.ui.notify).toHaveBeenCalledWith("✓ Deleted: viking://resources/old", "info");
    });

    test("notifies on missing uri", async () => {
      const { pi } = makeDeps();
      const cmd = pi.getCommand("ov-delete");
      const ctx = createMockCmdCtx();

      await cmd.handler("", ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Usage:"), "error");
    });
  });

  describe("/ov-recall", () => {
    test("toggles state", async () => {
      const autoRecallState = { enabled: true };
      const pi = createMockPi();
      registerAll(pi, { autoRecallState });
      const cmd = pi.getCommand("ov-recall");
      const ctx = createMockCmdCtx();

      expect(autoRecallState.enabled).toBe(true);
      await cmd.handler("", ctx);
      expect(autoRecallState.enabled).toBe(false);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("disabled"), "info");
    });

    test("shows status", async () => {
      const autoRecallState = { enabled: false };
      const pi = createMockPi();
      registerAll(pi, { autoRecallState });
      const cmd = pi.getCommand("ov-recall");
      const ctx = createMockCmdCtx();

      await cmd.handler("--status", ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("disabled"), "info");
    });
  });

  describe("/ov-commit", () => {
    test("commits and notifies success", async () => {
      const sync = createMockSessionSync();
      const { pi } = makeDeps({ sync });
      const cmd = pi.getCommand("ov-commit");
      const ctx = createMockCmdCtx();

      await cmd.handler("", ctx);
      expect(sync.flush).toHaveBeenCalled();
      expect(sync.commit).toHaveBeenCalled();
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("✓ Session committed. Task:"), "info");
    });

    test("notifies error", async () => {
      const sync = createMockSessionSync({
        commit: vi.fn(async () => { throw new Error("no session"); }),
      });
      const { pi } = makeDeps({ sync });
      const cmd = pi.getCommand("ov-commit");
      const ctx = createMockCmdCtx();

      await cmd.handler("", ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith("✗ Commit failed: no session", "error");
    });
  });
});
