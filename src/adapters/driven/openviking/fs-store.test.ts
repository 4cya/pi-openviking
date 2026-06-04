import { describe, it, expect, vi } from "vitest";
import { FsStoreAdapter } from "./fs-store";
import { Uri } from "../../../domain/common/uri";
import { ValidationError } from "../../../domain/errors/validation-error";
import type { Transport } from "./transport";

function mockTransport(): Transport {
  return {
    request: vi.fn(),
  } as unknown as Transport;
}

describe("FsStoreAdapter.read", () => {
  const uri = new Uri("viking://docs/architecture.md");

  it("calls /api/v1/content/read for level=read", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/architecture.md",
      body: "# Architecture\n\ncontent",
    });

    const fs = new FsStoreAdapter(transport);
    const result = await fs.read(uri, "read");

    expect(transport.request).toHaveBeenCalledTimes(1);
    const [label, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("FsStore.read");
    expect(path).toContain("/api/v1/content/read");
    expect(result.body).toBe("# Architecture\n\ncontent");
    expect(result.uri).toEqual(uri);
    expect(result.level).toBe("read");
  });

  it("calls /api/v1/content/abstract for level=abstract", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/architecture.md",
      body: "Hexagonal architecture overview",
    });

    const fs = new FsStoreAdapter(transport);
    const result = await fs.read(uri, "abstract");

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain("/api/v1/content/abstract");
    expect(result.body).toBe("Hexagonal architecture overview");
    expect(result.level).toBe("abstract");
  });

  it("calls /api/v1/content/overview for level=overview", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/architecture.md",
      body: "File: architecture.md",
    });

    const fs = new FsStoreAdapter(transport);
    const result = await fs.read(uri, "overview");

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain("/api/v1/content/overview");
    expect(result.body).toBe("File: architecture.md");
    expect(result.level).toBe("overview");
  });

  it("defaults to read level when level is undefined", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/architecture.md",
      body: "full content",
    });

    const fs = new FsStoreAdapter(transport);
    const result = await fs.read(uri);

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain("/api/v1/content/read");
    expect(result.body).toBe("full content");
    expect(result.level).toBeUndefined();
  });

  it("appends uri query param with encoded value", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/architecture.md",
      body: "content",
    });

    const fs = new FsStoreAdapter(transport);
    await fs.read(uri, "read");

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain("uri=");
    expect(path).toContain(encodeURIComponent("viking://docs/architecture.md"));
  });

  it("appends offset query param when provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/architecture.md",
      body: "content",
    });

    const fs = new FsStoreAdapter(transport);
    await fs.read(uri, "read", 100);

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain("offset=100");
  });

  it("appends limit query param when provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/architecture.md",
      body: "content",
    });

    const fs = new FsStoreAdapter(transport);
    await fs.read(uri, "read", undefined, 50);

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain("limit=50");
  });
});

describe("FsStoreAdapter.write", () => {
  const uri = new Uri("viking://docs/new.md");

  it("calls POST /api/v1/content/write with correct body", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/new.md",
      success: true,
    });

    const fs = new FsStoreAdapter(transport);
    const result = await fs.write(uri, "# New content", "replace");

    expect(transport.request).toHaveBeenCalledTimes(1);
    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("FsStore.write");
    expect(path).toBe("/api/v1/content/write");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.uri).toBe("viking://docs/new.md");
    expect(body.content).toBe("# New content");
    expect(body.mode).toBe("replace");
    expect(body.wait).toBe(false);

    expect(result.uri).toEqual(uri);
    expect(result.success).toBe(true);
  });

  it("defaults mode to undefined when not provided", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/new.md",
      success: true,
    });

    const fs = new FsStoreAdapter(transport);
    await fs.write(uri, "content");

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.mode).toBeUndefined();
  });

  it("defaults method to POST", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/new.md",
      success: true,
    });

    const fs = new FsStoreAdapter(transport);
    await fs.write(uri, "content");

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.method).toBe("POST");
  });
});

describe("FsStoreAdapter.list", () => {
  const uri = new Uri("viking://docs/");

  it("calls GET /api/v1/fs/ls with uri param", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue([
      { uri: "viking://docs/a.md", type: "file", size: 100 },
    ]);

    const fs = new FsStoreAdapter(transport);
    const result = await fs.list(uri);

    const [label, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("FsStore.list");
    expect(path).toContain("/api/v1/fs/ls");
    expect(path).toContain(encodeURIComponent("viking://docs/"));
    expect(result).toHaveLength(1);
    expect(result[0].uri.value).toBe("viking://docs/a.md");
  });

  it("appends recursive=true when recursive flag is set", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const fs = new FsStoreAdapter(transport);
    await fs.list(uri, true);

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain("recursive=true");
  });

  it("omits recursive param when not set", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const fs = new FsStoreAdapter(transport);
    await fs.list(uri);

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).not.toContain("recursive");
  });
});

describe("FsStoreAdapter.tree", () => {
  const uri = new Uri("viking://docs/");

  it("calls GET /api/v1/fs/tree with uri param", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue([
      { uri: "viking://docs/a.md", type: "file" },
      { uri: "viking://docs/sub/", type: "directory" },
    ]);

    const fs = new FsStoreAdapter(transport);
    const result = await fs.tree(uri);

    const [label, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("FsStore.tree");
    expect(path).toContain("/api/v1/fs/tree");
    expect(result).toHaveLength(2);
    expect(result[1].type).toBe("directory");
  });
});

describe("FsStoreAdapter.stat", () => {
  const uri = new Uri("viking://docs/architecture.md");

  it("calls GET /api/v1/fs/stat with uri param", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "viking://docs/architecture.md",
      type: "file",
      size: 4096,
      modTime: "2026-01-01T00:00:00Z",
    });

    const fs = new FsStoreAdapter(transport);
    const result = await fs.stat(uri);

    const [label, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("FsStore.stat");
    expect(path).toContain("/api/v1/fs/stat");
    expect(path).toContain(encodeURIComponent("viking://docs/architecture.md"));
    expect(result.uri).toEqual(uri);
    expect(result.type).toBe("file");
    expect(result.size).toBe(4096);
  });
});

describe("FsStoreAdapter.mkdir", () => {
  const uri = new Uri("viking://docs/new-folder/");

  it("calls POST /api/v1/fs/mkdir with uri body", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const fs = new FsStoreAdapter(transport);
    await fs.mkdir(uri);

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("FsStore.mkdir");
    expect(path).toBe("/api/v1/fs/mkdir");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.uri).toBe("viking://docs/new-folder/");
  });
});

describe("FsStoreAdapter.mv", () => {
  const from = new Uri("viking://docs/old.md");
  const to = new Uri("viking://docs/new.md");

  it("calls POST /api/v1/fs/mv with from_uri and to_uri", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const fs = new FsStoreAdapter(transport);
    await fs.mv(from, to);

    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("FsStore.mv");
    expect(path).toBe("/api/v1/fs/mv");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.from_uri).toBe("viking://docs/old.md");
    expect(body.to_uri).toBe("viking://docs/new.md");
  });
});

describe("FsStoreAdapter.delete", () => {
  const uri = new Uri("viking://docs/old.md");

  it("calls DELETE /api/v1/fs with uri param", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const fs = new FsStoreAdapter(transport);
    await fs.delete(uri);

    const [label, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("FsStore.delete");
    expect(path).toContain("/api/v1/fs");
    expect(path).toContain(encodeURIComponent("viking://docs/old.md"));
  });

  it("appends recursive=true when recursive flag is set", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const fs = new FsStoreAdapter(transport);
    await fs.delete(uri, true);

    const [, path] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain("recursive=true");
  });

  it("retries with recursive=true on recursive-required error", async () => {
    const transport = mockTransport();
    const mock = transport.request as ReturnType<typeof vi.fn>;
    // First call fails, second succeeds
    mock.mockRejectedValueOnce(new ValidationError("recursive required"));
    mock.mockResolvedValueOnce({});

    const fs = new FsStoreAdapter(transport);
    await fs.delete(uri);

    expect(mock).toHaveBeenCalledTimes(2);
    const [, path1] = mock.mock.calls[0];
    const [, path2] = mock.mock.calls[1];
    // First call: no recursive
    expect(path1).not.toContain("recursive");
    // Second call: with recursive=true
    expect(path2).toContain("recursive=true");
  });

  it("does not retry on non-recursive errors", async () => {
    const transport = mockTransport();
    const mock = transport.request as ReturnType<typeof vi.fn>;
    mock.mockRejectedValue(new Error("unauthorized"));

    const fs = new FsStoreAdapter(transport);
    await expect(fs.delete(uri)).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("does not retry twice when recursive already set", async () => {
    const transport = mockTransport();
    const mock = transport.request as ReturnType<typeof vi.fn>;
    mock.mockRejectedValue(new Error("some error"));

    const fs = new FsStoreAdapter(transport);
    await expect(fs.delete(uri, true)).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe("FsStoreAdapter.reindex", () => {
  const uri = new Uri("viking://resources/test.md");

  it("calls POST /api/v1/content/reindex with vectors_only by default", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const fs = new FsStoreAdapter(transport);
    await fs.reindex(uri);

    expect(transport.request).toHaveBeenCalledTimes(1);
    const [label, path, opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe("FsStore.reindex");
    expect(path).toBe("/api/v1/content/reindex");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string);
    expect(body.uri).toBe("viking://resources/test.md");
    expect(body.mode).toBe("vectors_only");
  });

  it("passes mode=full when specified", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const fs = new FsStoreAdapter(transport);
    await fs.reindex(uri, "full");

    const [, , opts] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body as string);
    expect(body.mode).toBe("full");
  });

  it("passes AbortSignal", async () => {
    const transport = mockTransport();
    (transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const ac = new AbortController();

    const fs = new FsStoreAdapter(transport);
    await fs.reindex(uri, "vectors_only", ac.signal);

    const [, , opts, signal] = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(signal).toBe(ac.signal);
  });
});
