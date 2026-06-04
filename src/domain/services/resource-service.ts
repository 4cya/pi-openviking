import type { ResourceStore, ResourceImportResult, ImportOptions } from "../ports/resource-store";

export class ResourceService {
  constructor(private readonly store: ResourceStore) {}

  async importUrl(url: string, options?: ImportOptions, signal?: AbortSignal): Promise<ResourceImportResult> {
    return this.store.importUrl(url, options, signal);
  }
}
