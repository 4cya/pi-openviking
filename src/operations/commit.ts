import type { CommitResult, OpenVikingClient } from "../ov-client/client";
import type { SessionSyncLike } from "../session-sync/session";

export interface CommitOpResult {
  session_id: string;
  task_id: string;
  archive_uri: string;
  archived: boolean;
  trace_id: string;
  /** "committed" | "completed" | "failed" | "running" | "timeout" */
  status: string;
  error?: string;
}

export interface CommitOpOpts {
  client: OpenVikingClient;
  wait?: boolean;
  pollInterval?: number;
  timeout?: number;
  signal?: AbortSignal;
}

const DEFAULT_POLL_INTERVAL = 1000;
const DEFAULT_TIMEOUT = 15000;

export async function commitOp(
  sync: SessionSyncLike,
  opts?: CommitOpOpts,
): Promise<CommitOpResult> {
  await sync.flush();
  const result = await sync.commit();

  const base: CommitOpResult = {
    session_id: result.session_id,
    task_id: result.task_id,
    archive_uri: result.archive_uri,
    archived: result.archived,
    trace_id: result.trace_id,
    status: result.status,
  };

  if (!opts?.wait) return base;

  const interval = opts.pollInterval ?? DEFAULT_POLL_INTERVAL;
  const deadline = Date.now() + (opts.timeout ?? DEFAULT_TIMEOUT);

  while (Date.now() < deadline) {
    const task = await opts.client.getTaskStatus(result.task_id, opts.signal);
    if (task.status === "completed" || task.status === "failed") {
      return { ...base, status: task.status, error: task.error };
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  return { ...base, status: "timeout" };
}
