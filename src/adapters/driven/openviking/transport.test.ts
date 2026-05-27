import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import { Transport } from "./transport";
import { NotFoundError } from "../../../domain/errors/not-found-error";
import { ConnectionError } from "../../../domain/errors/connection-error";
import { ValidationError } from "../../../domain/errors/validation-error";

let server: http.Server;
let port: number;
let lastRequest: { method: string; path: string; headers: Record<string, string>; body?: unknown };
const requestCounts = new Map<string, number>();

beforeAll(async () => {
  server = http.createServer((req, res) => {
    // Collect request data for assertions
    lastRequest = {
      method: req.method ?? "GET",
      path: req.url ?? "/",
      headers: req.headers as Record<string, string>,
    };

    // Parse body
    let bodyStr = "";
    req.on("data", (chunk) => { bodyStr += chunk; });
    req.on("end", () => {
      if (bodyStr) {
        try { lastRequest.body = JSON.parse(bodyStr); } catch { lastRequest.body = bodyStr; }
      }

      // Route-based response control
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (url.pathname === "/api/v1/success") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (url.pathname === "/api/v1/not-found") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "resource missing" }));
        return;
      }

      if (url.pathname === "/api/v1/unauthorized") {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "bad key" }));
        return;
      }

      if (url.pathname === "/api/v1/validation-error") {
        res.writeHead(422, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "invalid input" }));
        return;
      }

      if (url.pathname === "/api/v1/server-error") {
        const attempts = requestCounts.get("/api/v1/server-error") ?? 0;
        requestCounts.set("/api/v1/server-error", attempts + 1);
        if (attempts < 2) {
          // Fail first two times, succeed on third
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "server error" }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok after retry" }));
        }
        return;
      }

      if (url.pathname === "/api/v1/always-500") {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "always fails" }));
        return;
      }

      if (url.pathname === "/api/v1/delayed") {
        const delayMs = parseInt(url.searchParams.get("ms") ?? "100", 10);
        setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "delayed ok" }));
        }, delayMs);
        return;
      }

      // Default: 200
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "default" }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

function makeTransport(opts?: Partial<{
  timeout: number;
  maxRetries: number;
}>) {
  return new Transport({
    endpoint: `http://127.0.0.1:${port}`,
    apiKey: "test-key",
    account: "test-account",
    user: "test-user",
    timeout: opts?.timeout ?? 5000,
    commitTimeout: 120_000,
    maxRetries: opts?.maxRetries ?? 2,
  });
}

describe("Transport", () => {
  it("sends auth headers on every request", async () => {
    const t = makeTransport();
    await t.request("test", "/api/v1/success");
    expect(lastRequest.headers["x-api-key"]).toBe("test-key");
    expect(lastRequest.headers["x-openviking-account"]).toBe("test-account");
    expect(lastRequest.headers["x-openviking-user"]).toBe("test-user");
  });

  it("sends Content-Type: application/json", async () => {
    const t = makeTransport();
    await t.request("test", "/api/v1/success");
    expect(lastRequest.headers["content-type"]).toBe("application/json");
  });

  it("returns parsed JSON on success", async () => {
    const t = makeTransport();
    const result = await t.request<{ status: string }>("test", "/api/v1/success");
    expect(result.status).toBe("ok");
  });

  it("maps 404 to NotFoundError", async () => {
    const t = makeTransport();
    await expect(t.request("test", "/api/v1/not-found")).rejects.toThrow(NotFoundError);
  });

  it("maps 401 to ConnectionError", async () => {
    const t = makeTransport();
    await expect(t.request("test", "/api/v1/unauthorized")).rejects.toThrow(ConnectionError);
  });

  it("maps 422 to ValidationError", async () => {
    const t = makeTransport();
    await expect(t.request("test", "/api/v1/validation-error")).rejects.toThrow(ValidationError);
  });

  it("retries on 5xx up to maxRetries", async () => {
    // Server-error route: fails first 2 calls, succeeds on 3rd
    // maxRetries=2 means 3 total attempts (initial + 2 retries)
    const t = makeTransport({ maxRetries: 2 });
    const result = await t.request<{ status: string }>("test", "/api/v1/server-error");
    expect(result.status).toBe("ok after retry");
  });

  it("throws ConnectionError after exhausting 5xx retries", async () => {
    const t = makeTransport({ maxRetries: 2 });
    await expect(t.request("test", "/api/v1/always-500")).rejects.toThrow(ConnectionError);
  });

  it("does NOT retry on 4xx errors", async () => {
    // Track call count
    let callCount = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      callCount++;
      return new Response(JSON.stringify({ message: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const t = makeTransport();
      await expect(t.request("test", "/api/v1/anything")).rejects.toThrow(NotFoundError);
      expect(callCount).toBe(1); // No retry
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("respects AbortSignal", async () => {
    const t = makeTransport({ timeout: 5000 });
    const controller = new AbortController();
    // Delay of 200ms, abort immediately
    const promise = t.request("test", `/api/v1/delayed?ms=200`, undefined, controller.signal);
    controller.abort(new DOMException("Aborted", "AbortError"));

    await expect(promise).rejects.toThrow();
  });

  it("times out after configured timeout", async () => {
    const t = makeTransport({ timeout: 50 }); // 50ms timeout
    // Server delays 200ms — longer than timeout
    await expect(t.request("test", "/api/v1/delayed?ms=200")).rejects.toThrow();
  });

  it("sends POST body as JSON", async () => {
    const t = makeTransport();
    const body = { query: "hello", limit: 10 };
    await t.request("test", "/api/v1/success", {
      method: "POST",
      body: JSON.stringify(body),
    });
    expect(lastRequest.method).toBe("POST");
    expect(lastRequest.body).toEqual(body);
  });

  it("sends GET request by default", async () => {
    const t = makeTransport();
    await t.request("test", "/api/v1/success");
    expect(lastRequest.method).toBe("GET");
  });
});
