import type { SessionClient, FsClient, KnowledgeClient } from "../ov-client/client";
import type { SessionSyncLike } from "../session-sync/session";
import type { AutoRecallState } from "../auto-recall/auto-recall";
import type { HealthChecker } from "../shared/health";
import type { CommandDeps } from "../shared/command-def";

export interface CommandRegisterDeps extends CommandDeps {
  session: SessionClient;
  fs: FsClient;
  knowledge: KnowledgeClient;
  sync: SessionSyncLike;
  autoRecallState: AutoRecallState;
  healthChecker?: HealthChecker;
}
