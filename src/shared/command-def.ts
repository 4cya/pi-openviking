import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { HealthChecker } from "./health";
import { logger } from "./logger";

// ── Result types ──

export type CommandResult =
  | { type: "notify"; message: string; level: "info" | "warning" | "error" }
  | {
      type: "steer";
      customType: string;
      text: string;
      details?: Record<string, unknown>;
    };

// ── Deps ──

export type CommandDeps = Record<string, unknown>;

// ── Definition ──

export interface CommandDef<D extends CommandDeps = CommandDeps> {
  name: string;
  label: string;
  description: string;
  healthChecker?: HealthChecker;
  execute: (
    args: string,
    ctx: ExtensionCommandContext,
    deps: D,
  ) => Promise<CommandResult>;
}

// ── Register ──

export function defineCommand<D extends CommandDeps>(
  pi: ExtensionAPI,
  deps: D,
  def: CommandDef<D>,
): void {
  pi.registerCommand(def.name, {
    description: def.description,
    handler: async (args, ctx) => {
      try {
        // On-demand health recovery before execution
        if (def.healthChecker && !def.healthChecker.isAvailable()) {
          const recovered = await def.healthChecker.check();
          if (!recovered) {
            ctx.ui.notify("OpenViking server is unavailable. Try again later.", "error");
            return;
          }
        }

        const result = await def.execute(args, ctx, deps);

        switch (result.type) {
          case "notify":
            ctx.ui.notify(result.message, result.level);
            break;
          case "steer":
            pi.sendMessage(
              {
                customType: result.customType,
                content: [{ type: "text", text: result.text }],
                display: true,
                details: result.details ?? {},
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
            break;
          default: {
            const _exhaustive: never = result;
            throw new Error(`Unknown command result type: ${(_exhaustive as any)?.type}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`${def.name} command failed:`, msg);
        ctx.ui.notify(`✗ ${def.label} failed: ${msg}`, "error");
      }
    },
  });
}
