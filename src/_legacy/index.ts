import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { bootstrapExtension } from "./bootstrap";
import type { SessionSync } from "./session-sync/session";
import { createAutocompleteProvider, invalidateCache, parentUri } from "./autocomplete/autocomplete";

export default async function openVikingExtension(pi: ExtensionAPI) {
  let bootstrapPromise: ReturnType<typeof bootstrapExtension> | undefined;
  let sessionSync: SessionSync | undefined;
  let autocompleteRegistered = false;
  let invalidationRegistered = false;

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

    // Register autocomplete provider once
    if (!autocompleteRegistered) {
      const result = await bootstrapPromise;
      if (result.fs) {
        ctx.ui.addAutocompleteProvider(createAutocompleteProvider(result.fs));
        autocompleteRegistered = true;
      }
    }

    // Wire cache invalidation on memimport/memdelete completion once
    if (!invalidationRegistered) {
      pi.on("tool_result", (event) => {
        if (event.isError) return;

        if (event.toolName === "memdelete") {
          const uri = event.input?.uri as string | undefined;
          if (uri) {
            invalidateCache(parentUri(uri));
          }
        }

        if (event.toolName === "memimport") {
          // The import tool returns details with root_uri
          const rootUri = (event.details as Record<string, unknown> | undefined)?.root_uri as string | undefined;
          if (rootUri) {
            invalidateCache(parentUri(rootUri));
          }
        }
      });
      invalidationRegistered = true;
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
