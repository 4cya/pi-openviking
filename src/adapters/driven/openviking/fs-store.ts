/**
 * Adapter for OV filesystem endpoints (read, write, ls, tree, stat, mkdir, mv, delete, reindex).
 *
 * See OV 03-filesystem.md.
 */
import type { Transport } from "./transport";
import { toContent } from "./mappers/content-mapper";
import { toWriteResult, toFsEntries, toFsEntry } from "./mappers/fs-mapper";
import type { Uri } from "../../../domain/common/uri";
import type { ContentLevel } from "../../../domain/common/content-level";
import type { WriteMode } from "../../../domain/common/write-mode";
import type { Content, FsStore, FsEntry, WriteResult, ReindexMode } from "../../../domain/ports/fs-store";
import { ValidationError } from "../../../domain/errors/validation-error";
import { NotFoundError } from "../../../domain/errors/not-found-error";
import type { OVWriteResponse, OVFsEntry } from "./types/ov-fs";

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

/**
 * OV v0.3.x only has /api/v1/content/read — there are no
 * separate /abstract or /overview path segments.
 *
 * For level="read":     GET /api/v1/content/read?uri=X&offset=Y&limit=Z
 * For level="abstract":  GET /api/v1/content/read?uri=X/.abstract.md
 * For level="overview":  GET /api/v1/content/read?uri=X/.overview.md
 *
 * The dotfiles exist only for directories; for files the server
 * returns 404 NOT_FOUND, which callers should handle gracefully.
 */
function buildReadPath(
  uri: Uri,
  level?: ContentLevel,
  offset?: number,
  limit?: number,
): string {
  if (level === "abstract") {
    return `/api/v1/content/read?uri=${encodeURIComponent(uri.value)}/.abstract.md`;
  }
  if (level === "overview") {
    return `/api/v1/content/read?uri=${encodeURIComponent(uri.value)}/.overview.md`;
  }
  // level === "read" or undefined
  const query = buildQuery(uri, offset, limit);
  return `/api/v1/content/read?${query}`;
}

export class FsStoreAdapter implements FsStore {
  constructor(private readonly transport: Transport) {}

  async read(
    uri: Uri,
    level?: ContentLevel,
    offset?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<Content> {
    const path = buildReadPath(uri, level, offset, limit);

    try {
      // For abstract/overview, the transport returns a string (markdown text).
      // For level=read, offset/limit paginate the full content.
      const raw = await this.transport.request<string>(
        "FsStore.read",
        path,
        undefined,
        signal,
      );

      return toContent(raw, uri, level);
    } catch (err: unknown) {
      // Abstract/overview dotfiles only exist for directories.
      // If the target is a file, OV returns 404 — return empty gracefully.
      if (
        err instanceof NotFoundError &&
        level !== undefined &&
        level !== "read"
      ) {
        return { uri, body: "", level };
      }
      throw err;
    }
  }

  async write(uri: Uri, content: string, mode?: WriteMode, signal?: AbortSignal): Promise<WriteResult> {
    const body = JSON.stringify({
      uri: uri.value,
      content,
      mode,
      wait: false,
    });

    const raw = await this.transport.request<OVWriteResponse>(
      "FsStore.write",
      "/api/v1/content/write",
      { method: "POST", body },
      signal,
    );

    return toWriteResult(raw, uri.value);
  }

  async list(uri: Uri, recursive?: boolean, signal?: AbortSignal): Promise<FsEntry[]> {
    const query = recursive ? `uri=${encodeURIComponent(uri.value)}&recursive=true` : uriQuery(uri);
    const raw = await this.transport.request<OVFsEntry[]>(
      "FsStore.list",
      `/api/v1/fs/ls?${query}`,
      undefined,
      signal,
    );
    return toFsEntries(raw);
  }

  async tree(uri: Uri, signal?: AbortSignal): Promise<FsEntry[]> {
    const raw = await this.transport.request<OVFsEntry[]>(
      "FsStore.tree",
      `/api/v1/fs/tree?${uriQuery(uri)}`,
      undefined,
      signal,
    );
    return toFsEntries(raw);
  }

  async stat(uri: Uri, signal?: AbortSignal): Promise<FsEntry> {
    const raw = await this.transport.request<OVFsEntry>(
      "FsStore.stat",
      `/api/v1/fs/stat?${uriQuery(uri)}`,
      undefined,
      signal,
    );
    return toFsEntry(raw, uri.value);
  }

  async mkdir(uri: Uri, signal?: AbortSignal): Promise<void> {
    const body = JSON.stringify({ uri: uri.value });
    await this.transport.request<unknown>(
      "FsStore.mkdir",
      "/api/v1/fs/mkdir",
      { method: "POST", body },
      signal,
    );
  }

  async mv(from: Uri, to: Uri, signal?: AbortSignal): Promise<void> {
    const body = JSON.stringify({ from_uri: from.value, to_uri: to.value });
    await this.transport.request<unknown>(
      "FsStore.mv",
      "/api/v1/fs/mv",
      { method: "POST", body },
      signal,
    );
  }

  async reindex(uri: Uri, mode: ReindexMode = "vectors_only", signal?: AbortSignal): Promise<void> {
    const body = JSON.stringify({ uri: uri.value, mode });
    await this.transport.request<unknown>(
      "FsStore.reindex",
      "/api/v1/content/reindex",
      { method: "POST", body },
      signal,
    );
  }

  async delete(uri: Uri, recursive?: boolean, signal?: AbortSignal): Promise<void> {
    const query = recursive
      ? `uri=${encodeURIComponent(uri.value)}&recursive=true`
      : uriQuery(uri);

    try {
      await this.transport.request<unknown>(
        "FsStore.delete",
        `/api/v1/fs?${query}`,
        { method: "DELETE" },
        signal,
      );
    } catch (err: unknown) {
      // If recursive required and we haven't tried with recursive, retry
      if (
        !recursive &&
        err instanceof ValidationError &&
        err.message.toLowerCase().includes("recursive")
      ) {
        await this.transport.request<unknown>(
          "FsStore.delete",
          `/api/v1/fs?${uriQuery(uri)}&recursive=true`,
          { method: "DELETE" },
          signal,
        );
        return;
      }
      throw err;
    }
  }
}
