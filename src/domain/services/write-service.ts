import type { FsStore, WriteResult } from "../ports/fs-store";
import type { WriteMode } from "../common/write-mode";
import { Uri } from "../common/uri";

export class WriteService {
  constructor(private readonly fsStore: FsStore) {}

  async save(uri: string, content: string, mode?: WriteMode, signal?: AbortSignal): Promise<WriteResult> {
    return this.fsStore.write(new Uri(uri), content, mode, signal);
  }

  async mkdir(uri: string, signal?: AbortSignal): Promise<void> {
    return this.fsStore.mkdir(new Uri(uri), signal);
  }

  async mv(from: string, to: string, signal?: AbortSignal): Promise<void> {
    return this.fsStore.mv(new Uri(from), new Uri(to), signal);
  }
}
