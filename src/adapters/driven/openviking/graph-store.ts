import type { Transport } from "./transport";
import { toLinkResult, toRelations } from "./mappers/relation-mapper";
import type { GraphStore, LinkResult } from "../../../domain/ports/graph-store";
import type { Relation } from "../../../domain/knowledge/model/relation";
import type { Uri } from "../../../domain/common/uri";

export class GraphStoreAdapter implements GraphStore {
  constructor(private readonly transport: Transport) {}

  async link(source: Uri, targets: Uri | Uri[], reason?: string): Promise<LinkResult> {
    const targetArray = Array.isArray(targets) ? targets : [targets];
    const body = JSON.stringify({
      from_uri: source.value,
      to_uris: targetArray.map((u) => u.value),
      ...(reason !== undefined ? { reason } : {}),
    });

    const raw = await this.transport.request<Record<string, unknown>>(
      "GraphStore.link",
      "/api/v1/relations/link",
      { method: "POST", body },
    );

    return toLinkResult(raw, source, targetArray, reason);
  }

  async unlink(source: Uri, target: Uri): Promise<void> {
    const body = JSON.stringify({
      from_uri: source.value,
      to_uri: target.value,
    });
    await this.transport.request<unknown>(
      "GraphStore.unlink",
      "/api/v1/relations/link",
      { method: "DELETE", body },
    );
  }

  async graph(uri: Uri): Promise<Relation[]> {
    const raw = await this.transport.request<Record<string, unknown>>(
      "GraphStore.graph",
      `/api/v1/relations?uri=${encodeURIComponent(uri.value)}`,
    );
    return toRelations(raw);
  }
}
