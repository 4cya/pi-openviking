import { vi } from "vitest";
import type { SessionClient, FsClient, KnowledgeClient, SearchResult, Part } from "../src/ov-client/client";
import type { SessionSyncLike } from "../src/session-sync/session";

function defaultSessionClient(): SessionClient {
  return {
    createSession: vi.fn(async () => "ov-sess-1"),
    sendMessage: vi.fn(async (_sessionId: string, _role: string, _content: string | Part[]) => {}),
    commit: vi.fn(async () => ({ session_id: "sess-1", status: "committed", task_id: "task-1", archive_uri: "viking://archived/sess-1", archived: true, trace_id: "trace-1" })),
    getTaskStatus: vi.fn(async () => ({ task_id: "task-1", status: "completed" })),
  };
}

function defaultFsClient(): FsClient {
  return {
    read: vi.fn(async () => ({ content: "" })),
    fsList: vi.fn(async () => ({ uri: "", children: [] })),
    fsTree: vi.fn(async () => ({ uri: "", children: [] })),
    fsStat: vi.fn(async () => ({ uri: "", children: [] })),
  };
}

function defaultKnowledgeClient(): KnowledgeClient {
  return {
    search: vi.fn(async () => ({
      memories: [],
      resources: [],
      skills: [],
      total: 0,
    } as SearchResult)),
    delete: vi.fn(async () => ({ uri: "" })),
    verifiedDelete: vi.fn(async () => ({ uri: "", verified: true })),
    addResource: vi.fn(async () => ({ root_uri: "viking://resources/imported.md", status: "success", errors: [] })),
    tempUpload: vi.fn(async () => ({ temp_file_id: "tmp-1" })),
  };
}

export function createMockClient(overrides?: {
  session?: Partial<SessionClient>;
  fs?: Partial<FsClient>;
  knowledge?: Partial<KnowledgeClient>;
}): { session: SessionClient; fs: FsClient; knowledge: KnowledgeClient } {
  const sessionBase = defaultSessionClient();
  const fsBase = defaultFsClient();
  const knowledgeBase = defaultKnowledgeClient();

  return {
    session: { ...sessionBase, ...overrides?.session },
    fs: { ...fsBase, ...overrides?.fs },
    knowledge: { ...knowledgeBase, ...overrides?.knowledge },
  };
}

export function createMockSessionSync(
  overrides: Partial<SessionSyncLike> = {},
): SessionSyncLike {
  return {
    getOvSessionId: vi.fn(() => "ov-sess-1"),
    flush: vi.fn(async () => {}),
    commit: vi.fn(async () => ({ session_id: "sess-1", status: "committed", task_id: "task-1", archive_uri: "viking://archived/sess-1", archived: true, trace_id: "trace-1" })),
    recover: vi.fn(),
    ...overrides,
  };
}
