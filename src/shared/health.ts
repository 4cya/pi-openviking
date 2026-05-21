import type { Transport } from "../ov-client/transport";

export interface HealthChecker {
  check(signal?: AbortSignal): Promise<boolean>;
  isAvailable(): boolean;
}

export function createHealthChecker(
  transport: Transport,
  healthPath = "/health",
): HealthChecker {
  let available = false;

  return {
    async check(signal?: AbortSignal): Promise<boolean> {
      try {
        await transport.request("healthCheck", healthPath, undefined, signal);
        available = true;
        return true;
      } catch {
        available = false;
        return false;
      }
    },

    isAvailable(): boolean {
      return available;
    },
  };
}
