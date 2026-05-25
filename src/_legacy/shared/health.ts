import type { Transport } from "../ov-client/transport";

export interface HealthCheckerOptions {
  onChange?: (available: boolean) => void;
}

export interface HealthChecker {
  check(signal?: AbortSignal): Promise<boolean>;
  isAvailable(): boolean;
}

export function createHealthChecker(
  transport: Transport,
  healthPath = "/health",
  options?: HealthCheckerOptions,
): HealthChecker {
  let available = false;
  const onChange = options?.onChange;

  return {
    async check(signal?: AbortSignal): Promise<boolean> {
      try {
        await transport.request("healthCheck", healthPath, undefined, signal);
        if (!available && onChange) onChange(true);
        available = true;
        return true;
      } catch {
        if (available && onChange) onChange(false);
        available = false;
        return false;
      }
    },

    isAvailable(): boolean {
      return available;
    },
  };
}
