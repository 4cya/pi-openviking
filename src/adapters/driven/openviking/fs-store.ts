import type { Transport } from "./transport";
import { toContent } from "./mappers/content-mapper";
import type { Uri } from "../../../domain/common/uri";
import type { ContentLevel } from "../../../domain/common/content-level";
import type { Content, FsStore } from "../../../domain/ports/fs-store";

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

  // Stub methods for remaining FsStore operations (F3.x will implement)
  async write(): Promise<never> { throw new Error("FsStore.write not implemented yet"); }
  async list(): Promise<never> { throw new Error("FsStore.list not implemented yet"); }
  async tree(): Promise<never> { throw new Error("FsStore.tree not implemented yet"); }
  async stat(): Promise<never> { throw new Error("FsStore.stat not implemented yet"); }
  async mkdir(): Promise<never> { throw new Error("FsStore.mkdir not implemented yet"); }
  async mv(): Promise<never> { throw new Error("FsStore.mv not implemented yet"); }
  async delete(): Promise<never> { throw new Error("FsStore.delete not implemented yet"); }
}
