import type { OVAdapterConfig } from "../../../infrastructure/config/schema";
import { toDomainError } from "./mappers/error-mapper";
import { ConnectionError } from "../../../domain/errors/connection-error";
import { DomainError } from "../../../domain/errors/domain-error";
import type { Logger } from "../../../domain/ports/logger";
import {
  createCircuitBreaker,
  circuitBreakerReducer,
  allowsRequest,
  type CircuitBreakerState,
} from "./circuit-breaker";

export interface RequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Token-bucket rate limiter.
 * When maxTokens = 0 (disabled), acquire() resolves immediately.
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly intervalMs: number;

  constructor(maxPerSecond: number) {
    this.maxTokens = maxPerSecond > 0 ? maxPerSecond : 0;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.intervalMs = maxPerSecond > 0 ? Math.ceil(1000 / maxPerSecond) : 0;
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    if (this.maxTokens === 0) return;

    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      // Wait for next token
      try {
        await sleepWithSignal(this.intervalMs, signal);
      } catch {
        // Abort propagated
        throw new DOMException("Aborted", "AbortError");
      }
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.maxTokens);
    this.lastRefill = now;
  }
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
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
  private readonly logger?: Logger;
  private readonly rateLimiter: TokenBucket;
  private cb: CircuitBreakerState | null;

  constructor(config: OVAdapterConfig, logger?: Logger) {
    this.baseUrl = config.endpoint.replace(/\/+$/, "");
    this.defaults = {
      apiKey: config.apiKey,
      account: config.account,
      user: config.user,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    };
    this.logger = logger;
    this.rateLimiter = new TokenBucket(config.rateLimitPerSecond ?? 0);
    this.cb = config.circuitBreaker
      ? createCircuitBreaker(config.circuitBreaker.threshold, config.circuitBreaker.resetTimeoutMs)
      : null;
  }

  async request<T>(
    methodLabel: string,
    path: string,
    opts?: RequestOptions,
    signal?: AbortSignal,
  ): Promise<T> {
    const startTime = Date.now();
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
    const requestTimeout = opts?.timeout ?? this.defaults.timeout;
    let lastError: Error | null = null;
    let status: number | null = null;

    // Circuit breaker check — reject fast if OPEN
    if (this.cb && !allowsRequest(this.cb)) {
      this.logger?.debug(
        `[${methodLabel}] ${method} ${path} -> REJECTED (circuit breaker OPEN)`,
      );
      throw new ConnectionError(
        `[${methodLabel}] Circuit breaker OPEN — request rejected`,
      );
    }

    // Acquire rate-limit token before sending
    await this.rateLimiter.acquire(signal);

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const abortController = new AbortController();
          const timeoutId = setTimeout(
            () => abortController.abort(new DOMException("Timeout", "TimeoutError")),
            requestTimeout,
          );

          let combinedSignal: AbortSignal;
          if (signal) {
            if (signal.aborted) {
              abortController.abort(signal.reason);
            } else {
              const onAbort = () => {
                abortController.abort(signal.reason);
                signal.removeEventListener("abort", onAbort);
              };
              signal.addEventListener("abort", onAbort, { once: true });
            }
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
          status = response.status;

          if (!response.ok) {
            let responseBody: unknown;
            try {
              responseBody = await response.json();
            } catch {
              responseBody = { message: await response.text().catch(() => "") };
            }

            if (response.status >= 400 && response.status < 500) {
              // 4xx — client error, don't feed to CB
              throw toDomainError(response.status, responseBody, methodLabel);
            }

            // 5xx — feed to CB
            if (this.cb) {
              this.cb = circuitBreakerReducer(this.cb, { type: "RECORD_FAILURE", now: Date.now() });
            }

            if (attempt < maxRetries) {
              lastError = toDomainError(response.status, responseBody, methodLabel);
              await sleep(Math.pow(2, attempt) * 1000);
              continue;
            }

            throw toDomainError(response.status, responseBody, methodLabel);
          }

          // Success — reset CB fail count
          if (this.cb) {
            this.cb = circuitBreakerReducer(this.cb, { type: "RECORD_SUCCESS" });
          }

          const text = await response.text();
          if (!text) return undefined as T;
          return JSON.parse(text) as T;
        } catch (err: unknown) {
          if (err instanceof DOMException || (err instanceof Error && err.name === "AbortError")) {
            if (err.name === "TimeoutError" || (err as Error).message === "Timeout") {
              // Timeout — feed to CB
              if (this.cb) {
                this.cb = circuitBreakerReducer(this.cb, { type: "RECORD_FAILURE", now: Date.now() });
              }
              if (attempt < maxRetries) {
                lastError = err as Error;
                await sleep(Math.pow(2, attempt) * 1000);
                continue;
              }
              throw toDomainError(503, { message: `Timeout after ${requestTimeout}ms` }, methodLabel);
            }
            throw err;
          }

          if (
            err instanceof TypeError ||
            (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ECONNREFUSED")
          ) {
            // Network error — feed to CB
            if (this.cb) {
              this.cb = circuitBreakerReducer(this.cb, { type: "RECORD_FAILURE", now: Date.now() });
            }
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

          // Unknown error — feed to CB
          if (this.cb) {
            this.cb = circuitBreakerReducer(this.cb, { type: "RECORD_FAILURE", now: Date.now() });
          }
          if (attempt < maxRetries) {
            lastError = err as Error;
            await sleep(Math.pow(2, attempt) * 1000);
            continue;
          }
          throw new ConnectionError(`[${methodLabel}] Unexpected error — ${(err as Error).message}`);
        }
      }

      throw lastError ?? new ConnectionError(`[${methodLabel}] Request failed`);
    } finally {
      this.logger?.debug(
        `[${methodLabel}] ${method} ${path} -> ${status ?? "ERROR"} ${Date.now() - startTime}ms`,
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
