import { createTransport, type Transport } from "../ov-client/transport";
import { createClient, type ClientAdapters } from "../ov-client/client";
import { createHealthChecker, type HealthChecker } from "../shared/health";
import { SessionSync, type SessionSyncLike } from "../session-sync/session";
import { createAutoRecall, type AutoRecallConfig, type AutoRecallState } from "../auto-recall/auto-recall";
import type { OpenVikingConfig } from "../shared/config";
import type { SessionClient, FsClient, KnowledgeClient } from "../ov-client/client";
import { logger } from "../shared/logger";
import type { CommandDeps } from "../shared/command-def";

// ── Unified deps for tools and commands ──

export interface RuntimeDeps extends CommandDeps {
  session: SessionClient;
  fs: FsClient;
  knowledge: KnowledgeClient;
  sync: SessionSyncLike;
  healthChecker?: HealthChecker;
  autoRecallState: AutoRecallState;
}

// ── Runtime object ──

export interface Runtime {
  transport: Transport;
  client: ClientAdapters;
  healthChecker: HealthChecker;
  sessionSync: SessionSync;
  autoRecall: ReturnType<typeof createAutoRecall>;
  autoRecallState: AutoRecallState;
}

export interface CreateRuntimeOptions {
  config: OpenVikingConfig;
  recallConfig: AutoRecallConfig;
  transport?: Transport;
  setStatus?: (key: string, text: string | undefined) => void;
  getSessionFile: () => string | undefined;
  getBranch: () => Array<{ type: string; customType?: string; data?: unknown }>;
  appendEntry: (type: string, data: unknown) => void;
}

// ── Status formatter ──

export function formatStatus(available: boolean, recallCount?: number): string {
  const icon = available ? "\u25cf" : "\u25cb";
  let text = `${icon} OV`;
  if (available && recallCount && recallCount > 0) {
    text += ` \u00b7 ${recallCount} recalled`;
  }
  return text;
}

// ── Factory ──

export async function createRuntime(opts: CreateRuntimeOptions): Promise<Runtime> {
  const { config, recallConfig, transport, setStatus, getSessionFile, getBranch, appendEntry } = opts;

  const t = transport ?? createTransport(config);
  const client = createClient(config, t);
  const { session: sessionClient } = client;

  // Health checker with status callback
  const healthChecker = createHealthChecker(t, config.healthPath, {
    onChange(available) {
      setStatus?.("ov-status", formatStatus(available));
    },
  });

  // Initial health check with 2-second timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const ok = await healthChecker.check(controller.signal);
    setStatus?.("ov-status", formatStatus(ok));
    logger.debug("initial health check:", ok ? "available" : "unavailable");
  } finally {
    clearTimeout(timeout);
  }

  // Auto-recall shared state
  const autoRecallState: AutoRecallState = { ...recallConfig, lastInjectedItems: [] };

  // Session sync
  const sessionSync = new SessionSync(sessionClient, {
    getSessionFile,
    getBranch,
    appendEntry,
    autoRecallState,
  });
  logger.debug("session sync created");

  // Auto-recall
  const autoRecall = createAutoRecall(client.knowledge, sessionSync, recallConfig);

  return {
    transport: t,
    client,
    healthChecker,
    sessionSync,
    autoRecall,
    autoRecallState,
  };
}
