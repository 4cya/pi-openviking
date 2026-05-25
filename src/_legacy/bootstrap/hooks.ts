import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Runtime } from "./runtime";
import type { BootstrapContext } from "../bootstrap";
import { resolveBudget } from "../auto-recall/resolve-budget";
import { formatStatus } from "./runtime";
import { logger } from "../shared/logger";

/**
 * Wire lifecycle hooks: before_agent_start (health recovery + auto-recall),
 * tool_call (memdelete confirmation).
 */
export function wireHooks(
  pi: ExtensionAPI,
  runtime: Runtime,
  ctx: BootstrapContext,
): void {
  const { healthChecker, sessionSync, autoRecall, autoRecallState } = runtime;
  const updateStatus = ctx.setStatus;

  // ── before_agent_start: health recovery + auto-recall ──
  pi.on("before_agent_start", async (event, ctx) => {
    // On-demand recovery: re-check health if previously unavailable
    if (!healthChecker.isAvailable()) {
      const recovered = await healthChecker.check();
      if (recovered) {
        logger.debug("health check recovered");
        sessionSync.recover();
      }
    }

    if (!healthChecker.isAvailable()) {
      ctx?.ui?.setStatus("ov-status", formatStatus(false));
      return;
    }

    const usage = ctx?.getContextUsage?.();
    const tokenBudget = resolveBudget(usage);
    const result = await autoRecall({ ...event, tokenBudget });
    autoRecallState.lastInjectedItems = result.injectedItems ?? [];

    // Update status with recall count
    const count = result.injectedItems?.length ?? 0;
    ctx?.ui?.setStatus("ov-status", formatStatus(true, count));

    return result;
  });

  // ── tool_call: memdelete confirmation gate ──
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "memdelete") {
      const ok = await ctx.ui.confirm("Delete from OpenViking?", String(event.input.uri));
      if (!ok) return { block: true, reason: "Cancelled by user" };
    }
  });
}
