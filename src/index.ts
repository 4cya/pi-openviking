import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { bootstrapExtension } from "./bootstrap";
import type { SessionSync } from "./session-sync/session";

export default async function openVikingExtension(pi: ExtensionAPI) {
  let bootstrapPromise: ReturnType<typeof bootstrapExtension> | undefined;
  let sessionSync: SessionSync | undefined;

  pi.on("session_start", async (_event, ctx) => {
    if (!bootstrapPromise) {
      bootstrapPromise = bootstrapExtension(pi, {
        cwd: ctx.cwd,
        sessionManager: ctx.sessionManager,
        setStatus: ctx.ui.setStatus,
      });
    }
    if (!sessionSync) {
      const result = await bootstrapPromise;
      sessionSync = result.sessionSync;
    }

    sessionSync.onSessionStart();
  });

  pi.on("message_end", (event) => {
    sessionSync?.onMessageEnd(event.message);
  });

  pi.on("session_shutdown", () => {
    sessionSync?.onShutdown();
    sessionSync = undefined;
  });
}
