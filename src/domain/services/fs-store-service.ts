import type { FsStore, Content, FsEntry, WriteResult, ReindexMode } from "../ports/fs-store";
import type { ContentLevel } from "../common/content-level";
import type { WriteMode } from "../common/write-mode";
import { Uri } from "../common/uri";

export class FsStoreService {
  constructor(private readonly fsStore: FsStore) {}

  async read(uri: string, level?: ContentLevel, offset?: number, limit?: number, signal?: AbortSignal): Promise<Content> {
    return this.fsStore.read(new Uri(uri), level, offset, limit, signal);
  }

  async save(uri: string, content: string, mode?: WriteMode, signal?: AbortSignal): Promise<WriteResult> {
    return this.fsStore.write(new Uri(uri), content, mode, signal);
  }

  async mkdir(uri: string, signal?: AbortSignal): Promise<void> {
    return this.fsStore.mkdir(new Uri(uri), signal);
  }

  async mv(from: string, to: string, signal?: AbortSignal): Promise<void> {
    return this.fsStore.mv(new Uri(from), new Uri(to), signal);
  }

  async list(uri: string, recursive?: boolean, signal?: AbortSignal): Promise<FsEntry[]> {
    return this.fsStore.list(new Uri(uri), recursive, signal);
  }

  async tree(uri: string, signal?: AbortSignal): Promise<FsEntry[]> {
    return this.fsStore.tree(new Uri(uri), signal);
  }

  async stat(uri: string, signal?: AbortSignal): Promise<FsEntry> {
    return this.fsStore.stat(new Uri(uri), signal);
  }

  async delete(uri: string, recursive?: boolean, signal?: AbortSignal): Promise<void> {
    return this.fsStore.delete(new Uri(uri), recursive, signal);
  }

  async reindex(uri: string, mode?: ReindexMode, signal?: AbortSignal): Promise<void> {
    return this.fsStore.reindex(new Uri(uri), mode, signal);
  }
}
