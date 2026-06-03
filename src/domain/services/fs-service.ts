import type { FsStore, FsEntry } from "../ports/fs-store";
import { Uri } from "../common/uri";

export class FsService {
  constructor(private readonly fsStore: FsStore) {}

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
}
