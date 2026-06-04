import type { KnowledgeBase } from "../../../domain/ports/knowledge-base";
import type { FsStore } from "../../../domain/ports/fs-store";
import type { GraphStore } from "../../../domain/ports/graph-store";
import type { SessionStore } from "../../../domain/ports/session-store";
import type { ResourceStore } from "../../../domain/ports/resource-store";
import type { OVAdapterConfig } from "../../../infrastructure/config/schema";
import type { Logger } from "../../../domain/ports/logger";
import { Transport } from "./transport";
import { FsStoreAdapter } from "./fs-store";
import { KnowledgeBaseAdapter } from "./knowledge-base";
import { SessionStoreAdapter } from "./session-store";
import { GraphStoreAdapter } from "./graph-store";
import { ResourceStoreAdapter } from "./resource-store";

export interface OVAdapter {
  knowledgeBase: KnowledgeBase;
  fsStore: FsStore;
  graphStore: GraphStore;
  sessionStore: SessionStore;
  resourceStore: ResourceStore;
  /** True when the circuit breaker is OPEN — fast fail for recall guard */
  readonly circuitBreakerOpen: boolean;
}

export function createOVAdapter(config: OVAdapterConfig, logger?: Logger): OVAdapter {
  const transport = new Transport(config, logger);

  return {
    knowledgeBase: new KnowledgeBaseAdapter(transport),
    fsStore: new FsStoreAdapter(transport),
    graphStore: new GraphStoreAdapter(transport),
    sessionStore: new SessionStoreAdapter(transport, config.commitTimeout),
    resourceStore: new ResourceStoreAdapter(transport),
    get circuitBreakerOpen() { return transport.isCircuitBreakerOpen(); },
  };
}
