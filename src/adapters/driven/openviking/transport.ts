import type { OVAdapterConfig } from "../../../infrastructure/config/schema";
import { toDomainError } from "./mappers/error-mapper";
import { ConnectionError } from "../../../domain/errors/connection-error";
import { DomainError } from "../../../domain/errors/domain-error";

export interface RequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

export class Transport {
  private readonly baseUrl: string;
  private readonly defaults: {
    apiKey: string;
    account: string;
    user: string;
    timeout: number;
    maxRetries: number;
  };

  constructor(config: OVAdapterConfig) {
    this.baseUrl = config.endpoint.replace(/\/+$/, "");
    this.defaults = {
      apiKey: config.apiKey,
      account: config.account,
      user: config.user,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    };
  }

  async request<T>(
    methodLabel: string,
    path: string,
    opts?: RequestOptions,
    signal?: AbortSignal,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const method = opts?.method ?? "GET";
    const body = opts?.body;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": this.defaults.apiKey,
      "X-OpenViking-Account": this.defaults.account,
      "X-OpenViking-User": this.defaults.user,
      ...opts?.headers,
    };

    const maxRetries = this.defaults.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(
          () => abortController.abort(new DOMException("Timeout", "TimeoutError")),
          this.defaults.timeout,
        );

        let combinedSignal: AbortSignal;
        if (signal) {
          const onAbort = () => {
            abortController.abort(signal.reason);
            signal.removeEventListener("abort", onAbort);
          };
          signal.addEventListener("abort", onAbort, { once: true });
          combinedSignal = abortController.signal;
        } else {
          combinedSignal = abortController.signal;
        }

        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: combinedSignal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let responseBody: unknown;
          try {
            responseBody = await response.json();
          } catch {
            responseBody = { message: await response.text().catch(() => "") };
          }

          if (response.status >= 400 && response.status < 500) {
            throw toDomainError(response.status, responseBody, methodLabel);
          }

          if (attempt < maxRetries) {
            lastError = toDomainError(response.status, responseBody, methodLabel);
            await sleep(Math.pow(2, attempt) * 1000);
            continue;
          }

          throw toDomainError(response.status, responseBody, methodLabel);
        }

        const text = await response.text();
        if (!text) return undefined as T;
        return JSON.parse(text) as T;
      } catch (err: unknown) {
        if (err instanceof DOMException || (err instanceof Error && err.name === "AbortError")) {
          if (err.name === "TimeoutError" || (err as Error).message === "Timeout") {
            if (attempt < maxRetries) {
              lastError = err as Error;
              await sleep(Math.pow(2, attempt) * 1000);
              continue;
            }
            throw toDomainError(503, { message: `Timeout after ${this.defaults.timeout}ms` }, methodLabel);
          }
          throw err;
        }

        if (
          err instanceof TypeError ||
          (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ECONNREFUSED")
        ) {
          if (attempt < maxRetries) {
            lastError = new ConnectionError(`Network error — ${(err as Error).message}`);
            await sleep(Math.pow(2, attempt) * 1000);
            continue;
          }
          throw new ConnectionError(
            `[${methodLabel}] Cannot reach OV at ${this.baseUrl} — ${(err as Error).message}`,
          );
        }

        // Already a typed DomainError — propagate immediately
        if (err instanceof DomainError) {
          throw err;
        }

        // Unknown error — retryable
        if (attempt < maxRetries) {
          lastError = err as Error;
          await sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
        throw new ConnectionError(`[${methodLabel}] Unexpected error — ${(err as Error).message}`);
      }
    }

    throw lastError ?? new ConnectionError(`[${methodLabel}] Request failed`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
