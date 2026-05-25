import { loadConfig, loadAutoRecallConfig } from "./shared/config";
export { COMMANDS } from "./bootstrap/register";
import { createRuntime } from "./bootstrap/runtime";
import { registerAll } from "./bootstrap/register";
import { wireHooks } from "./bootstrap/hooks";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { HealthChecker } from "./shared/health";
import type { SessionSync } from "./session-sync/session";

export interface BootstrapContext {
  cwd: string;
  sessionManager: {
    getSessionFile(): string | undefined;
    getBranch(): Array<{ type: string; customType?: string; data?: unknown }>;
  };
  setStatus?: (key: string, text: string | undefined) => void;
}

export interface BootstrapResult {
  sessionSync: SessionSync;
  healthChecker: HealthChecker;
  fs: import("./ov-client/types").FsClient;
}

export async function bootstrapExtension(
  pi: ExtensionAPI,
  ctx: BootstrapContext,
  transport?: import("./ov-client/transport").Transport,
): Promise<BootstrapResult> {
  const config = loadConfig(ctx.cwd);
  const recallConfig = loadAutoRecallConfig(ctx.cwd);

  const runtime = await createRuntime({
    config,
    recallConfig,
    transport,
    setStatus: ctx.setStatus,
    getSessionFile: () => ctx.sessionManager.getSessionFile(),
    getBranch: () => ctx.sessionManager.getBranch(),
    appendEntry: (type, data) => pi.appendEntry(type, data),
  });

  registerAll(pi, runtime);
  wireHooks(pi, runtime, ctx);

  return { sessionSync: runtime.sessionSync, healthChecker: runtime.healthChecker, fs: runtime.client.fs };
}
