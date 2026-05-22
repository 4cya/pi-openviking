import type { OpenVikingConfig } from "../shared/config";
import { createTransport, OpenVikingError } from "./transport";
import type { Transport } from "./transport";
import type { SessionClient, FsClient, KnowledgeClient, SearchResult, ReadResult, TaskStatus, DeleteResult } from "./types";
import { createFsOps } from "./fs-ops";
import { createSessionOps } from "./session-ops";
import { resolveSearchMode } from "../shared/search-mode";

function resourceNameFromUri(uri: string): string {
  const parts = uri.replace("viking://", "").split("/");
  return parts[parts.length - 1] || "";
}

async function deleteWithRecursiveFallback(t: Transport, uri: string, signal?: AbortSignal): Promise<{ uri: string }> {
  try {
    return (await t.request(
      "delete",
      `/api/v1/fs?uri=${encodeURIComponent(uri)}`,
      { httpMethod: "DELETE" },
      signal,
    )) as { uri: string };
  } catch (err) {
    const msg = (err as Error).message ?? "";
    const isDirectory = msg.includes("recursive") || msg.includes("directory");
    if (!isDirectory) throw err;
    return (await t.request(
      "delete",
      `/api/v1/fs?uri=${encodeURIComponent(uri)}&recursive=true`,
      { httpMethod: "DELETE" },
      signal,
    )) as { uri: string };
  }
}

export { OpenVikingError };
export type {
  OpenVikingClient,
  SessionClient,
  FsClient,
  KnowledgeClient,
  SearchResult,
  ReadResult,
  BrowseResult,
  CommitResult,
  DeleteResult,
  MemorySearchItem,
  ResourceSearchItem,
  SkillSearchItem,
  TextPart,
  ToolPart,
  Part,
  TaskStatus,
} from "./types";

export interface ClientAdapters {
  session: SessionClient;
  fs: FsClient;
  knowledge: KnowledgeClient;
}

export function createClient(config: OpenVikingConfig, transport?: Transport): ClientAdapters {
  const t = transport ?? createTransport(config);
  const fs = createFsOps(t);
  const session = createSessionOps(t, config.commitTimeout);

  const knowledge: KnowledgeClient = {
    async search(sessionId, query, limit = 10, mode = "auto", target_uri, signal?) {
      const resolvedMode = resolveSearchMode(mode, query ?? "", sessionId);
      const useDeep = resolvedMode === "deep" && !!sessionId;
      const path = useDeep ? "/api/v1/search/search" : "/api/v1/search/find";
      const body: Record<string, unknown> = { query, limit };
      if (sessionId) body.session_id = sessionId;
      if (useDeep) body.mode = "deep";
      if (target_uri) body.target_uri = target_uri;
      return (await t.request("search", path, { body }, signal)) as SearchResult;
    },

    async delete(uri, signal?) {
      return deleteWithRecursiveFallback(t, uri, signal);
    },

    async verifiedDelete(uri, signal?): Promise<DeleteResult> {
      const { uri: delUri } = await deleteWithRecursiveFallback(t, uri, signal);

      try {
        const name = resourceNameFromUri(delUri);
        if (name) {
          const results = (await t.request(
            "search",
            "/api/v1/search/find",
            { body: { query: name, limit: 5 } },
            signal,
          )) as SearchResult;
          if (results.resources.some((r) => r.uri === delUri)) {
            return { uri: delUri, verified: false };
          }
        }
      } catch {
        // Verification best-effort
      }

      return { uri: delUri, verified: true };
    },

    async addResource(params, signal?) {
      const endpoint = params.kind === "skill" ? "/api/v1/skills" : "/api/v1/resources";
      const { kind: _kind, ...body } = params;
      if (endpoint === "/api/v1/skills" && "reason" in body) {
        delete (body as any).reason;
      }
      const result = (await t.request(
        "addResource",
        endpoint,
        { body },
        signal,
      )) as { root_uri: string; status: string; errors: string[] };
      return result;
    },

    async tempUpload(fileBody, filename, signal?) {
      const form = new FormData();
      form.append("file", new Blob([fileBody]), filename);
      const result = (await t.request(
        "tempUpload",
        "/api/v1/resources/temp_upload",
        { body: form },
        signal,
      )) as { temp_file_id: string };
      return result;
    },
  };

  return {
    session: {
      ...session,

      async getTaskStatus(taskId, signal?) {
        return (await t.request(
          "getTaskStatus",
          `/api/v1/tasks/${taskId}`,
          undefined,
          signal,
        )) as TaskStatus;
      },
    },
    fs: {
      ...fs,

      async read(uri, level = "read", signal?) {
        const params = new URLSearchParams({ uri });
        const result = (await t.request(
          "read",
          `/api/v1/content/${level}?${params.toString()}`,
          undefined,
          signal,
        )) as string;
        return { content: result };
      },
    },
    knowledge,
  };
}
