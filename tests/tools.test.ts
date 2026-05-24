import { describe, test, expect, vi, beforeEach } from "vitest";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SearchResult } from "../src/ov-client/client";
import { registerMemsearchTool } from "../src/tools/search";
import { registerMemreadTool } from "../src/tools/read";
import { registerMembrowseTool } from "../src/tools/browse";
import { registerMemcommitTool } from "../src/tools/commit";
import { registerMemdeleteTool } from "../src/tools/delete";
import { registerMemimportTool } from "../src/tools/import";
import { createMockClient, createMockSessionSync } from "./mocks";

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  details: Record<string, unknown>;
  isError?: boolean;
}

interface ToolDef {
  name: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters?: unknown;
  execute: (id: string, params: Record<string, unknown>, signal?: AbortSignal, onUpdate?: unknown, ctx?: unknown) => Promise<ToolResult>;
}

function createMockPi() {
  const tools: ToolDef[] = [];
  return {
    registerTool: vi.fn((def: ToolDef) => {
      tools.push(def);
    }),
    get tools() {
      return tools;
    },
  };
}

function makeDeps(overrides?: {
  session?: Record<string, unknown>;
  fs?: Record<string, unknown>;
  knowledge?: Record<string, unknown>;
  sync?: ReturnType<typeof createMockSessionSync>;
  healthChecker?: { check: () => Promise<boolean>; isAvailable: () => boolean };
}) {
  const { session, fs, knowledge } = createMockClient(
    overrides
      ? {
          session: overrides.session as any,
          fs: overrides.fs as any,
          knowledge: overrides.knowledge as any,
        }
      : undefined,
  );
  const sync = overrides?.sync ?? createMockSessionSync();
  const hc = overrides?.healthChecker;
  return { session, fs, knowledge, sync, healthChecker: hc };
}

describe("memsearch tool", () => {
  let pi: ReturnType<typeof createMockPi>;

  beforeEach(() => {
    pi = createMockPi();
  });

  test("registers with promptSnippet and promptGuidelines", () => {
    const deps = makeDeps();
    registerMemsearchTool(pi as any, deps);

    expect(pi.registerTool).toHaveBeenCalledOnce();
    const tool = pi.tools[0];
    expect(tool.name).toBe("memsearch");
    expect(tool.promptSnippet).toBeDefined();
    expect(tool.promptGuidelines).toBeDefined();
    expect(tool.promptGuidelines!.length).toBeGreaterThan(0);
    for (const g of tool.promptGuidelines!) {
      expect(g).toContain("memsearch");
    }
  });

  test("uses sync session and calls search", async () => {
    const search = vi.fn(async () => ({
      memories: [{ text: "hello world", score: 0.95, uri: "viking://test" }],
      resources: [],
      skills: [],
      total: 1,
    } as SearchResult));
    const deps = makeDeps({ knowledge: { search } as any, sync: createMockSessionSync({ getOvSessionId: () => "ov-sess-1" }) });
    registerMemsearchTool(pi as any, deps);
    const tool = pi.tools[0];

    const result = await tool.execute("tc-1", { query: "hello" });
    expect(deps.session.createSession).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledWith("ov-sess-1", "hello", 10, "auto", undefined, undefined);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.memories[0].text).toBe("hello world");
  });

  test("passes uri as target_uri when provided", async () => {
    const search = vi.fn(async () => ({
      memories: [],
      resources: [{ uri: "viking://resources/doc.md", score: 0.9 }],
      skills: [],
      total: 1,
    } as SearchResult));
    const deps = makeDeps({ knowledge: { search } as any, sync: createMockSessionSync({ getOvSessionId: () => "ov-sess-1" }) });
    registerMemsearchTool(pi as any, deps);
    const tool = pi.tools[0];

    await tool.execute("tc-1", { query: "hello", uri: "viking://resources/" });
    expect(search).toHaveBeenCalledWith("ov-sess-1", "hello", 10, "auto", "viking://resources/", undefined);
  });

  test("returns 'No results found' when empty", async () => {
    const deps = makeDeps();
    registerMemsearchTool(pi as any, deps);
    const tool = pi.tools[0];

    const result = await tool.execute("tc-1", { query: "nothing" });
    expect(result.content[0].text).toBe("No results found.");
  });

  test("returns isError on client failure", async () => {
    const search = vi.fn(async () => { throw new Error("OpenViking search failed: server error (HTTP 500)"); });
    const deps = makeDeps({ knowledge: { search } as any });
    registerMemsearchTool(pi as any, deps);
    const tool = pi.tools[0];

    const result = await tool.execute("tc-1", { query: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HTTP 500");
  });

  test("notifies on first failure when ctx.hasUI is true", async () => {
    const search = vi.fn(async () => { throw new Error("OpenViking search failed: server error (HTTP 500)"); });
    const deps = makeDeps({ knowledge: { search } as any });
    registerMemsearchTool(pi as any, deps);
    const tool = pi.tools[0];
    const notify = vi.fn();
    const ctx = { hasUI: true, ui: { notify } } as any;

    await tool.execute("tc-1", { query: "test" }, undefined, undefined, ctx);
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0][0]).toContain("HTTP 500");

    await tool.execute("tc-2", { query: "test2" }, undefined, undefined, ctx);
    expect(notify).toHaveBeenCalledOnce();
  });

  test("skips notification when ctx.hasUI is false", async () => {
    const search = vi.fn(async () => { throw new Error("OpenViking search failed: server error (HTTP 500)"); });
    const deps = makeDeps({ knowledge: { search } as any });
    registerMemsearchTool(pi as any, deps);
    const tool = pi.tools[0];
    const ctx = { hasUI: false, ui: { notify: vi.fn() } } as any;

    await tool.execute("tc-1", { query: "test" }, undefined, undefined, ctx);
    expect(ctx.ui.notify).not.toHaveBeenCalled();
  });

  test("passes auto mode to knowledge.search for resolution", async () => {
    const search = vi.fn(async () => ({ memories: [], resources: [], skills: [], total: 0 } as SearchResult));
    const deps = makeDeps({ knowledge: { search } as any, sync: createMockSessionSync({ getOvSessionId: () => "ov-sess-1" }) });
    registerMemsearchTool(pi as any, deps);
    const tool = pi.tools[0];

    await tool.execute("tc-1", { query: "test", mode: "auto" });
    expect(search).toHaveBeenCalledWith("ov-sess-1", "test", 10, "auto", undefined, undefined);
  });

  test("passes explicit deep mode to knowledge.search", async () => {
    const search = vi.fn(async () => ({ memories: [], resources: [], skills: [], total: 0 } as SearchResult));
    const deps = makeDeps({ knowledge: { search } as any, sync: createMockSessionSync({ getOvSessionId: () => undefined }) });
    registerMemsearchTool(pi as any, deps);
    const tool = pi.tools[0];

    await tool.execute("tc-1", { query: "test", mode: "deep" });
    expect(search).toHaveBeenCalledWith(undefined, "test", 10, "deep", undefined, undefined);
  });
});

describe("memread tool", () => {
  let pi: ReturnType<typeof createMockPi>;

  beforeEach(() => {
    pi = createMockPi();
  });

  test("registers with promptSnippet and no promptGuidelines", () => {
    registerMemreadTool(pi as any, makeDeps());
    const tool = pi.tools.find((t) => t.name === "memread");
    expect(tool).toBeDefined();
    expect(tool!.promptSnippet).toBeDefined();
    expect(tool!.promptGuidelines).toBeUndefined();
  });

  test("reads content at explicit read level", async () => {
    const read = vi.fn(async () => ({ content: "# Hello\n\nWorld" }));
    const deps = makeDeps({ fs: { read } as any });
    registerMemreadTool(pi as any, deps);
    const tool = pi.tools.find((t) => t.name === "memread")!;

    const result = await tool.execute("tc-1", { uri: "viking://docs/readme.md", level: "read" });
    expect(read).toHaveBeenCalledWith("viking://docs/readme.md", "read", undefined);
    expect(result.content[0].text).toBe("# Hello\n\nWorld");
  });

  test("auto-level resolves to read for files", async () => {
    const fsStat = vi.fn(async () => ({ uri: "viking://docs/readme.md", children: [{ uri: "viking://docs/readme.md", type: "file" }] }));
    const read = vi.fn(async () => ({ content: "file content" }));
    const deps = makeDeps({ fs: { fsStat, read } as any });
    registerMemreadTool(pi as any, deps);
    const tool = pi.tools.find((t) => t.name === "memread")!;

    const result = await tool.execute("tc-1", { uri: "viking://docs/readme.md", level: "auto" });
    expect(fsStat).toHaveBeenCalledWith("viking://docs/readme.md", undefined);
    expect(read).toHaveBeenCalledWith("viking://docs/readme.md", "read", undefined);
    expect(result.content[0].text).toBe("file content");
  });

  test("auto-level resolves to overview for directories", async () => {
    const fsStat = vi.fn(async () => ({ uri: "viking://docs/", children: [{ uri: "viking://docs/", type: "directory" }] }));
    const read = vi.fn(async () => ({ content: "dir overview" }));
    const deps = makeDeps({ fs: { fsStat, read } as any });
    registerMemreadTool(pi as any, deps);
    const tool = pi.tools.find((t) => t.name === "memread")!;

    const result = await tool.execute("tc-1", { uri: "viking://docs/", level: "auto" });
    expect(fsStat).toHaveBeenCalledWith("viking://docs/", undefined);
    expect(read).toHaveBeenCalledWith("viking://docs/", "overview", undefined);
    expect(result.content[0].text).toBe("dir overview");
  });

  test("returns error for invalid URI prefix", async () => {
    registerMemreadTool(pi as any, makeDeps());
    const tool = pi.tools.find((t) => t.name === "memread")!;
    const result = await tool.execute("tc-1", { uri: "https://example.com", level: "read" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("viking://");
  });
});

describe("memcommit tool", () => {
  let pi: ReturnType<typeof createMockPi>;

  beforeEach(() => {
    pi = createMockPi();
  });

  test("registers with promptSnippet and promptGuidelines", () => {
    registerMemcommitTool(pi as any, makeDeps());
    const tool = pi.tools.find((t) => t.name === "memcommit");
    expect(tool).toBeDefined();
    expect(tool!.promptSnippet).toBeDefined();
    expect(tool!.promptGuidelines).toBeDefined();
    expect(tool!.promptGuidelines!.length).toBeGreaterThan(0);
    expect(tool!.parameters).toBeDefined();
  });

  test("returns error when no session mapped", async () => {
    const sync = createMockSessionSync({
      getOvSessionId: () => undefined,
      commit: vi.fn(async () => { throw new Error("No OpenViking session mapped"); }),
    });
    registerMemcommitTool(pi as any, makeDeps({ sync }));
    const tool = pi.tools.find((t) => t.name === "memcommit")!;

    const result = await tool.execute("tc-1", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No OpenViking session mapped");
  });

  test("flushes pending messages and calls commit via sync", async () => {
    const sync = createMockSessionSync({
      getOvSessionId: () => "ov-sess-123",
      commit: vi.fn(async () => ({ session_id: "sess-1", status: "committed", task_id: "task-abc", archive_uri: "viking://archived/sess-1", archived: true, trace_id: "trace-1" })),
    });
    registerMemcommitTool(pi as any, makeDeps({ sync }));
    const tool = pi.tools.find((t) => t.name === "memcommit")!;
    const onUpdate = vi.fn();

    const result = await tool.execute("tc-1", {}, undefined, onUpdate);
    expect(sync.flush).toHaveBeenCalledTimes(1);
    expect(sync.commit).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ content: [{ type: "text", text: "Committing session to OpenViking..." }], details: {} });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("task-abc");
    expect(result.content[0].text).toContain("Status: committed");
  });
});

describe("membrowse tool", () => {
  let pi: ReturnType<typeof createMockPi>;

  beforeEach(() => {
    pi = createMockPi();
  });

  test("registers with promptSnippet and no promptGuidelines", () => {
    registerMembrowseTool(pi as any, makeDeps());
    const tool = pi.tools.find((t) => t.name === "membrowse");
    expect(tool).toBeDefined();
    expect(tool!.promptSnippet).toBeDefined();
    expect(tool!.promptGuidelines).toBeUndefined();
  });

  test("lists directory contents", async () => {
    const fsList = vi.fn(async () => ({
      uri: "viking://resources/docs/",
      children: [
        { uri: "viking://resources/docs/api.md", type: "file", abstract: "API ref" },
        { uri: "viking://resources/docs/guides/", type: "directory" },
      ],
    }));
    registerMembrowseTool(pi as any, makeDeps({ fs: { fsList } as any }));
    const tool = pi.tools.find((t) => t.name === "membrowse")!;

    const result = await tool.execute("tc-1", { uri: "viking://resources/docs/", view: "list" });
    expect(fsList).toHaveBeenCalledWith("viking://resources/docs/", undefined, undefined, undefined);
    expect(result.content[0].text).toContain("api.md");
    expect(result.content[0].text).toContain("guides/");
  });

  test("returns tree view", async () => {
    const fsTree = vi.fn(async () => ({
      uri: "viking://resources/",
      children: [
        { uri: "viking://resources/docs/", type: "directory" },
        { uri: "viking://resources/README.md", type: "file" },
      ],
    }));
    registerMembrowseTool(pi as any, makeDeps({ fs: { fsTree } as any }));
    const tool = pi.tools.find((t) => t.name === "membrowse")!;

    const result = await tool.execute("tc-1", { uri: "viking://resources/", view: "tree" });
    expect(fsTree).toHaveBeenCalledWith("viking://resources/", undefined);
    expect(result.content[0].text).toContain("README.md");
  });

  test("returns stat view", async () => {
    const fsStat = vi.fn(async () => ({
      uri: "viking://resources/file.md",
      children: [{ uri: "viking://resources/file.md", type: "file" }],
    }));
    registerMembrowseTool(pi as any, makeDeps({ fs: { fsStat } as any }));
    const tool = pi.tools.find((t) => t.name === "membrowse")!;

    const result = await tool.execute("tc-1", { uri: "viking://resources/file.md", view: "stat" });
    expect(fsStat).toHaveBeenCalledWith("viking://resources/file.md", undefined);
    expect(result.content[0].text).toContain("file");
  });

  test.each([
    { name: "recursive", params: { recursive: true }, expected: [undefined, true, undefined] },
    { name: "simple", params: { simple: true }, expected: [undefined, undefined, true] },
    { name: "both recursive and simple", params: { recursive: true, simple: true }, expected: [undefined, true, true] },
    { name: "neither (default)", params: {}, expected: [undefined, undefined, undefined] },
  ])("passes $name to fsList", async ({ params, expected }) => {
    const fsList = vi.fn(async () => ({ uri: "viking://resources/", children: [] }));
    registerMembrowseTool(pi as any, makeDeps({ fs: { fsList } as any }));
    const tool = pi.tools.find((t) => t.name === "membrowse")!;

    await tool.execute("tc-1", { uri: "viking://resources/", view: "list", ...params });
    expect(fsList).toHaveBeenCalledWith("viking://resources/", ...expected);
  });

  test("returns error for invalid URI prefix", async () => {
    registerMembrowseTool(pi as any, makeDeps());
    const tool = pi.tools.find((t) => t.name === "membrowse")!;
    const result = await tool.execute("tc-1", { uri: "http://example.com", view: "list" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("viking://");
  });
});

describe("memdelete tool", () => {
  let pi: ReturnType<typeof createMockPi>;

  beforeEach(() => {
    pi = createMockPi();
  });

  test("registers with promptSnippet and no promptGuidelines", () => {
    registerMemdeleteTool(pi as any, makeDeps());
    const tool = pi.tools.find((t) => t.name === "memdelete");
    expect(tool).toBeDefined();
    expect(tool!.promptSnippet).toBeDefined();
    expect(tool!.promptGuidelines).toBeUndefined();
  });

  test("deletes a viking:// URI and returns confirmation", async () => {
    const verifiedDelete = vi.fn(async () => ({ uri: "viking://resources/temp.txt", verified: true }));
    registerMemdeleteTool(pi as any, makeDeps({ knowledge: { verifiedDelete } as any }));
    const tool = pi.tools.find((t) => t.name === "memdelete")!;

    const result = await tool.execute("tc-1", { uri: "viking://resources/temp.txt" });
    expect(verifiedDelete).toHaveBeenCalledWith("viking://resources/temp.txt", undefined);
    expect(result.content[0].text).toBe("Deleted: viking://resources/temp.txt");
    expect(result.isError).toBeUndefined();
  });

  test("returns error for invalid URI prefix", async () => {
    registerMemdeleteTool(pi as any, makeDeps());
    const tool = pi.tools.find((t) => t.name === "memdelete")!;
    const result = await tool.execute("tc-1", { uri: "file:///etc/passwd" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Invalid URI: must start with viking://");
  });

  test("returns isError on client failure", async () => {
    const verifiedDelete = vi.fn(async () => { throw new Error("OpenViking delete failed: not found (HTTP 404)"); });
    registerMemdeleteTool(pi as any, makeDeps({ knowledge: { verifiedDelete } as any }));
    const tool = pi.tools.find((t) => t.name === "memdelete")!;

    const result = await tool.execute("tc-1", { uri: "viking://resources/missing.txt" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HTTP 404");
  });

  test("warns when verifiedDelete reports not verified", async () => {
    const verifiedDelete = vi.fn(async () => ({ uri: "viking://resources/stale.md", verified: false }));
    registerMemdeleteTool(pi as any, makeDeps({ knowledge: { verifiedDelete } as any }));
    const tool = pi.tools.find((t) => t.name === "memdelete")!;

    const result = await tool.execute("tc-1", { uri: "viking://resources/stale.md" });
    expect(result.content[0].text).toContain("warning");
    expect(result.content[0].text).toContain("async index sync");
    expect(result.details).toEqual({ uri: "viking://resources/stale.md", verified: false });
  });
});

describe("memimport tool", () => {
  let pi: ReturnType<typeof createMockPi>;

  beforeEach(() => {
    pi = createMockPi();
  });

  test("registers with promptSnippet and no promptGuidelines", () => {
    registerMemimportTool(pi as any, makeDeps());
    const tool = pi.tools.find((t) => t.name === "memimport");
    expect(tool).toBeDefined();
    expect(tool!.promptSnippet).toBeDefined();
    expect(tool!.promptGuidelines).toBeUndefined();
  });

  test("imports URL source via path with defaults", async () => {
    const addResource = vi.fn(async () => ({ root_uri: "viking://resources/github.md", status: "success", errors: [] }));
    registerMemimportTool(pi as any, makeDeps({ knowledge: { addResource } as any }));
    const tool = pi.tools.find((t) => t.name === "memimport")!;

    const result = await tool.execute("tc-1", { source: "https://example.com/doc.md" });
    expect(addResource).toHaveBeenCalledWith({ path: "https://example.com/doc.md", kind: "resource" }, undefined);
    expect(result.content[0].text).toBe("Imported: viking://resources/github.md (status: success)");
    expect(result.details).toEqual({ root_uri: "viking://resources/github.md" });
  });

  test("forwards kind=skill, reason, and to params", async () => {
    const addResource = vi.fn(async () => ({ root_uri: "viking://agent/skills/test.md", status: "success", errors: [] }));
    registerMemimportTool(pi as any, makeDeps({ knowledge: { addResource } as any }));
    const tool = pi.tools.find((t) => t.name === "memimport")!;

    const result = await tool.execute("tc-1", {
      source: "https://example.com/skill.md",
      kind: "skill",
      reason: "test import",
      to: "viking://agent/skills/",
    });
    expect(addResource).toHaveBeenCalledWith(
      { path: "https://example.com/skill.md", kind: "skill", reason: "test import", parent: "viking://agent/skills/" },
      undefined,
    );
    expect(result.content[0].text).toBe("Imported: viking://agent/skills/test.md (status: success)");
  });

  test("forwards reason and to for local file", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "ov-import-"));
    const filePath = join(tmpDir, "local.md");
    writeFileSync(filePath, "# local test");

    try {
      const addResource = vi.fn(async () => ({ root_uri: "viking://resources/local.md", status: "success", errors: [] }));
      registerMemimportTool(pi as any, makeDeps({ knowledge: { addResource } as any }));
      const tool = pi.tools.find((t) => t.name === "memimport")!;

      const result = await tool.execute("tc-1", {
        source: filePath,
        kind: "resource",
        reason: "local test",
        to: "viking://resources/docs/",
      });
      expect(addResource).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "resource", reason: "local test", parent: "viking://resources/docs/" }),
        undefined,
      );
      expect(result.content[0].text).toBe("Imported: viking://resources/local.md (status: success)");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("returns isError on client failure", async () => {
    const addResource = vi.fn(async () => { throw new Error("OpenViking addResource failed: bad request (HTTP 400)"); });
    registerMemimportTool(pi as any, makeDeps({ knowledge: { addResource } as any }));
    const tool = pi.tools.find((t) => t.name === "memimport")!;

    const result = await tool.execute("tc-1", { source: "https://bad.url" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HTTP 400");
  });

  test("imports local directory via uploadDirectory", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "ov-import-dir-"));
    mkdirSync(join(tmpDir, "sub"));
    writeFileSync(join(tmpDir, "a.txt"), "hello");
    writeFileSync(join(tmpDir, "sub", "b.txt"), "world");

    try {
      const tempUpload = vi.fn(async () => ({ temp_file_id: "tmp-1" }));
      const addResource = vi.fn(async () => ({ root_uri: "viking://resources/mydir", status: "success", errors: [] }));
      registerMemimportTool(pi as any, makeDeps({ knowledge: { tempUpload, addResource } as any }));
      const tool = pi.tools.find((t) => t.name === "memimport")!;

      const result = await tool.execute("tc-1", { source: tmpDir });
      expect(tempUpload).toHaveBeenCalledOnce();
      const uploadedBody = (tempUpload as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const uploadedName = (tempUpload as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(uploadedBody).toBeInstanceOf(Uint8Array);
      expect(uploadedBody.length).toBeGreaterThan(0);
      expect(uploadedName).toMatch(/\.zip$/);
      expect(addResource).toHaveBeenCalledWith(expect.objectContaining({ kind: "resource" }), undefined);
      expect(result.content[0].text).toBe("Imported: viking://resources/mydir (status: success)");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("tool health guard", () => {
  let pi: ReturnType<typeof createMockPi>;

  beforeEach(() => {
    pi = createMockPi();
  });

  function healthChecker(available: boolean, recovers: boolean = false) {
    return {
      check: vi.fn(async () => recovers),
      isAvailable: vi.fn(() => available),
    };
  }

  test("returns unavailable error when healthChecker says server down", async () => {
    registerMemsearchTool(pi as any, makeDeps({ healthChecker: healthChecker(false) }));
    const tool = pi.tools.find((t) => t.name === "memsearch")!;
    const result = await tool.execute("tc-1", { query: "test" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unavailable");
  });

  test("proceeds when healthChecker says server is up", async () => {
    const search = vi.fn(async () => ({ memories: [], resources: [], skills: [], total: 0 } as SearchResult));
    registerMemsearchTool(pi as any, makeDeps({ knowledge: { search } as any, healthChecker: healthChecker(true) }));
    const tool = pi.tools.find((t) => t.name === "memsearch")!;

    const result = await tool.execute("tc-1", { query: "test" });
    expect(result.isError).toBeUndefined();
    expect(search).toHaveBeenCalled();
  });

  test("recovers and proceeds when healthChecker was down but recovers", async () => {
    const search = vi.fn(async () => ({ memories: [], resources: [], skills: [], total: 0 } as SearchResult));
    const hc = healthChecker(false, true);
    registerMemsearchTool(pi as any, makeDeps({ knowledge: { search } as any, healthChecker: hc }));
    const tool = pi.tools.find((t) => t.name === "memsearch")!;

    const result = await tool.execute("tc-1", { query: "test" });
    expect(result.isError).toBeUndefined();
    expect(hc.check).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalled();
  });

  test("skips health check when no healthChecker provided", async () => {
    const search = vi.fn(async () => ({ memories: [], resources: [], skills: [], total: 0 } as SearchResult));
    registerMemsearchTool(pi as any, makeDeps({ knowledge: { search } as any }));
    const tool = pi.tools.find((t) => t.name === "memsearch")!;

    const result = await tool.execute("tc-1", { query: "test" });
    expect(result.isError).toBeUndefined();
    expect(search).toHaveBeenCalled();
  });
});
