import type { Transport } from "./transport";
import type { CommitResult, Part } from "./types";

export function createSessionOps(t: Transport, commitTimeout: number) {
  return {
    async createSession(signal?: AbortSignal): Promise<string> {
      const result = (await t.request("createSession", "/api/v1/sessions", { httpMethod: "POST" }, signal)) as { session_id: string };
      return result.session_id;
    },

    async sendMessage(sessionId: string, role: string, content: Part[], signal?: AbortSignal): Promise<void> {
      const body: Record<string, unknown> = { role, parts: content };
      await t.request(
        "sendMessage",
        `/api/v1/sessions/${sessionId}/messages`,
        { body },
        signal,
      );
    },

    async sessionUsed(sessionId: string, contexts: string[], signal?: AbortSignal): Promise<void> {
      try {
        await t.request(
          "sessionUsed",
          `/api/v1/sessions/${sessionId}/used`,
          { body: { contexts }, httpMethod: "POST" },
          signal,
        );
      } catch (err) {
        const { logger } = await import("../shared/logger");
        logger.error("sessionUsed failed:", (err as Error).message);
      }
    },

    async commit(sessionId: string, signal?: AbortSignal): Promise<CommitResult> {
      const result = (await t.request(
        "commit",
        `/api/v1/sessions/${sessionId}/commit`,
        { body: {}, timeout: commitTimeout },
        signal,
      )) as CommitResult;
      const { logger } = await import("../shared/logger");
      logger.debug("commit:", sessionId, result);
      return result;
    },
  };
}
