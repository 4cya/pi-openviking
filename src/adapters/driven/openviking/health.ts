export interface HealthStatus {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export class HealthCheck {
  private readonly baseUrl: string;

  constructor(endpoint: string) {
    this.baseUrl = endpoint.replace(/\/+$/, "");
  }

  async check(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/ready`, {
        method: "GET",
      });
      const latencyMs = Date.now() - start;
      if (response.ok) {
        return { ok: true, latencyMs };
      }
      return { ok: false, latencyMs, error: `OV /ready returned ${response.status}` };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      return { ok: false, latencyMs, error: (err as Error).message };
    }
  }
}
