import { describe, it, expect, vi } from "vitest";
import { KnowledgeBaseAdapter } from "./knowledge-base";
import { Uri } from "../../../domain/common/uri";
import { SessionId } from "../../../domain/common/session-id";
import type { Transport } from "./transport";
import type { FindQuery, SearchRequest } from "../../../domain/common/search-query";

function mockTransport(): Transport {
  return {
    request: vi.fn(),
  } as unknown as Transport;
}

describe("KnowledgeBaseAdapter.find", () => {
  it("calls POST /api/v1/search/find with query body", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      memories: [],
      resources: [],
      skills: [],
      total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    const query: FindQuery = { query: "architecture" };
    await kb.find(query);

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("KnowledgeBase.find");
    expect(path).toBe("/api/v1/search/find");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.query).toBe("architecture");
  });

  it("includes limit when provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      memories: [], resources: [], skills: [], total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    await kb.find({ query: "test", limit: 5 });

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.node_limit).toBe(5);
  });

  it("includes target_uri when targetUri provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      memories: [], resources: [], skills: [], total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    await kb.find({ query: "test", targetUri: new Uri("viking://docs/") });

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.target_uri).toBe("viking://docs/");
  });

  it("maps response via SearchResult", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      memories: [{ uri: "viking://mem/1", text: "found it" }],
      resources: [],
      skills: [],
      total: 1,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    const result = await kb.find({ query: "test" });
    expect(result.total).toBe(1);
    expect(result.memories[0].text).toBe("found it");
  });
});

describe("KnowledgeBaseAdapter.search", () => {
  it("calls POST /api/v1/search/search with query", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      memories: [], resources: [], skills: [], total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    const req: SearchRequest = { query: "deep search" };
    await kb.search(req);

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("KnowledgeBase.search");
    expect(path).toBe("/api/v1/search/search");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.query).toBe("deep search");
  });

  it("includes session_id when sessionId provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      memories: [], resources: [], skills: [], total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    await kb.search({ query: "test", sessionId: new SessionId("sess-123") });

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.session_id).toBe("sess-123");
  });

  it("includes target_uri and limit when provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      memories: [], resources: [], skills: [], total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    await kb.search({
      query: "test",
      limit: 10,
      targetUri: new Uri("viking://docs/"),
    });

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.node_limit).toBe(10);
    expect(body.target_uri).toBe("viking://docs/");
  });

  it("omits session_id when not provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      memories: [], resources: [], skills: [], total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    await kb.search({ query: "test" });

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.session_id).toBeUndefined();
  });
});

describe("KnowledgeBaseAdapter.glob", () => {
  it("calls POST /api/v1/search/glob with pattern", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      entries: ["viking://docs/a.md", "viking://docs/b.md"],
      total: 2,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    const result = await kb.glob("**/*.md");

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("KnowledgeBase.glob");
    expect(path).toBe("/api/v1/search/glob");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.pattern).toBe("**/*.md");
    expect(result.entries).toHaveLength(2);
  });

  it("includes uri and limit when provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      entries: [], total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    await kb.glob("*.ts", "viking://src/", 50);

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.uri).toBe("viking://src/");
    expect(body.node_limit).toBe(50);
  });
});

describe("KnowledgeBaseAdapter.grep", () => {
  it("calls POST /api/v1/search/grep with pattern and uri", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      matches: [{ uri: "viking://src/a.ts", lineNumber: 5, line: "import" }],
      total: 1,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    const result = await kb.grep("import");

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("KnowledgeBase.grep");
    expect(path).toBe("/api/v1/search/grep");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.pattern).toBe("import");
    expect(result.matches).toHaveLength(1);
  });

  it("passes uri and all filter opts", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      matches: [], total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    await kb.grep("function", {
      caseInsensitive: true,
      excludeUri: "viking://node_modules/",
      levelLimit: 3,
      nodeLimit: 100,
    });

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.case_insensitive).toBe(true);
    expect(body.exclude_uri).toBe("viking://node_modules/");
    expect(body.level_limit).toBe(3);
    expect(body.node_limit).toBe(100);
  });

  it("works with required fields only", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      matches: [], total: 0,
    });

    const kb = new KnowledgeBaseAdapter(transport);
    await kb.grep("todo");

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.pattern).toBe("todo");
    expect(body.case_insensitive).toBeUndefined();
  });
});
