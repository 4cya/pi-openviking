import { describe, it, expect, vi } from "vitest";
import { FsStoreAdapter } from "./fs-store";
import { Uri } from "../../../domain/common/uri";
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
