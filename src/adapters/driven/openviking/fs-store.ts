import type { Transport } from "./transport";
import { toContent } from "./mappers/content-mapper";
import { toWriteResult, toFsEntries, toFsEntry } from "./mappers/fs-mapper";
import type { Uri } from "../../../domain/common/uri";
import type { ContentLevel } from "../../../domain/common/content-level";
import type { WriteMode } from "../../../domain/common/write-mode";
import type { Content, FsStore, FsEntry, WriteResult } from "../../../domain/ports/fs-store";

function levelPath(level?: ContentLevel): string {
  return level ?? "read";
}

function buildQuery(
  uri: Uri,
  offset?: number,
  limit?: number,
): string {
  const params = new URLSearchParams();
  params.set("uri", uri.value);
  if (offset !== undefined) params.set("offset", String(offset));
  if (limit !== undefined) params.set("limit", String(limit));
  return params.toString();
}

function uriQuery(uri: Uri): string {
  return `uri=${encodeURIComponent(uri.value)}`;
}

export class FsStoreAdapter implements FsStore {
  constructor(private readonly transport: Transport) {}

  async read(
    uri: Uri,
    level?: ContentLevel,
    offset?: number,
    limit?: number,
  ): Promise<Content> {
    const segment = levelPath(level);
    const query = buildQuery(uri, offset, limit);
    const path = `/api/v1/content/${segment}?${query}`;

    const raw = await this.transport.request<Record<string, unknown>>(
      "FsStore.read",
      path,
    );

    return toContent(raw, uri, level);
  }

  async write(uri: Uri, content: string, mode?: WriteMode): Promise<WriteResult> {
    const body = JSON.stringify({
      uri: uri.value,
      content,
      mode,
      wait: true,
    });

    const raw = await this.transport.request<Record<string, unknown>>(
      "FsStore.write",
      "/api/v1/content/write",
      { method: "POST", body },
    );

    return toWriteResult(raw, uri.value);
  }

  async list(uri: Uri, recursive?: boolean): Promise<FsEntry[]> {
    const query = recursive ? `uri=${encodeURIComponent(uri.value)}&recursive=true` : uriQuery(uri);
    const raw = await this.transport.request<unknown>(
      "FsStore.list",
      `/api/v1/fs/ls?${query}`,
    );
    return toFsEntries(raw);
  }

  async tree(uri: Uri): Promise<FsEntry[]> {
    const raw = await this.transport.request<unknown>(
      "FsStore.tree",
      `/api/v1/fs/tree?${uriQuery(uri)}`,
    );
    return toFsEntries(raw);
  }

  async stat(uri: Uri): Promise<FsEntry> {
    const raw = await this.transport.request<Record<string, unknown>>(
      "FsStore.stat",
      `/api/v1/fs/stat?${uriQuery(uri)}`,
    );
    return toFsEntry(raw);
  }

  async mkdir(uri: Uri): Promise<void> {
    const body = JSON.stringify({ uri: uri.value });
    await this.transport.request<unknown>(
      "FsStore.mkdir",
      "/api/v1/fs/mkdir",
      { method: "POST", body },
    );
  }

  async mv(from: Uri, to: Uri): Promise<void> {
    const body = JSON.stringify({ from_uri: from.value, to_uri: to.value });
    await this.transport.request<unknown>(
      "FsStore.mv",
      "/api/v1/fs/mv",
      { method: "POST", body },
    );
  }

  async delete(uri: Uri, recursive?: boolean): Promise<void> {
    const query = recursive
      ? `uri=${encodeURIComponent(uri.value)}&recursive=true`
      : uriQuery(uri);

    try {
      await this.transport.request<unknown>(
        "FsStore.delete",
        `/api/v1/fs?${query}`,
        { method: "DELETE" },
      );
    } catch (err: unknown) {
      // If recursive required and we haven't tried with recursive, retry
      if (
        !recursive &&
        err instanceof Error &&
        err.message.toLowerCase().includes("recursive")
      ) {
        await this.transport.request<unknown>(
          "FsStore.delete",
          `/api/v1/fs?${uriQuery(uri)}&recursive=true`,
          { method: "DELETE" },
        );
        return;
      }
      throw err;
    }
  }
}
