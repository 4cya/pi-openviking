import type { Transport } from "./transport";
import { toResourceImportResult } from "./mappers/resource-mapper";
import type { ResourceStore, ResourceImportResult, ImportOptions } from "../../../domain/ports/resource-store";

export class ResourceStoreAdapter implements ResourceStore {
  constructor(private readonly transport: Transport) {}

  async importUrl(url: string, options?: ImportOptions, signal?: AbortSignal): Promise<ResourceImportResult> {
    const body: Record<string, unknown> = { path: url };

    if (options?.targetUri) body.to = options.targetUri;
    if (options?.reason) body.reason = options.reason;
    if (options?.wait) body.wait = true;

    const raw = await this.transport.request<Record<string, unknown>>(
      "ResourceStore.importUrl",
      "/api/v1/resources",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    );

    return toResourceImportResult(raw);
  }
}
