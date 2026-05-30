import type { FsStore, Content } from "../ports/fs-store";
import type { ContentLevel } from "../common/content-level";
import { Uri } from "../common/uri";

export class ReadService {
  constructor(private readonly fsStore: FsStore) {}

  async read(uri: string, level?: ContentLevel, offset?: number, limit?: number, signal?: AbortSignal): Promise<Content> {
    return this.fsStore.read(new Uri(uri), level, offset, limit, signal);
  }
}
