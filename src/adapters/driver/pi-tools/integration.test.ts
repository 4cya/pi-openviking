import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import { Transport } from "../../driven/openviking/transport";
import { KnowledgeBaseAdapter } from "../../driven/openviking/knowledge-base";
import { SearchService } from "../../../domain/services/search-service";
import { Pipeline } from "../../../domain/pipeline/pipeline";
import { loggingMiddleware } from "../../../domain/pipeline/logging-middleware";
import { createOvSearchTool } from "./ov-search";
import { createOvGlobTool } from "./ov-glob";
import { createOvGrepTool } from "./ov-grep";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { OVAdapterConfig } from "../../../infrastructure/config/schema";
import type { SearchResult } from "../../../domain/knowledge/model/search-result";
import type { GlobResult, GrepResult } from "../../../domain/ports/knowledge-base";

let server: http.Server;
let port: number;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let bodyStr = "";
    req.on("data", (chunk) => { bodyStr += chunk; });
    req.on("end", () => {
      const url = new URL(req.url ?? "/", `http://localhost`);

      if (url.pathname === "/api/v1/search/find") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          memories: [{ uri: "viking://kb/test", text: "found content", score: 0.9 }],
          resources: [],
          skills: [],
          total: 1,
        }));
        return;
      }

      if (url.pathname === "/api/v1/search/search") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          memories: [{ uri: "viking://kb/deep", text: "deep content", score: 0.95 }],
          resources: [],
          skills: [],
          total: 1,
          queryPlan: "deep plan",
        }));
        return;
      }

      if (url.pathname === "/api/v1/search/glob") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          entries: ["viking://docs/a.md", "viking://docs/b.md"],
          total: 2,
        }));
        return;
      }

      if (url.pathname === "/api/v1/search/grep") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          matches: [{ uri: "viking://docs/a.md", line: "hello world", line_number: 5 }],
          total: 1,
        }));
        return;
      }

      res.writeHead(404);
      res.end("not found");
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(() => { server?.close(); });

function makeToolCtx() {
  return {
    cwd: "/test",
    hasUI: false,
    ui: {} as any,
    sessionManager: {} as any,
    modelRegistry: {} as any,
    model: undefined,
    isIdle: () => true,
    signal: undefined as AbortSignal | undefined,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "",
  } as any;
}

function wireStack() {
  const ovConfig: OVAdapterConfig = {
    endpoint: `http://127.0.0.1:${port}`,
    apiKey: "test-key",
    account: "test-account",
    user: "test-user",
    timeout: 5000,
    commitTimeout: 120_000,
    maxRetries: 0,
    rateLimitPerSecond: 0,
  };
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, isEnabled: () => true };
  const transport = new Transport(ovConfig);
  const kb = new KnowledgeBaseAdapter(transport);
  const svc = new SearchService(kb, { searchMode: "find" } as any, logger as any);

  const searchPipeline = new Pipeline<SearchResult>();
  searchPipeline.use(loggingMiddleware("search", logger as any));
  const globPipeline = new Pipeline<GlobResult>();
  globPipeline.use(loggingMiddleware("glob", logger as any));
  const grepPipeline = new Pipeline<GrepResult>();
  grepPipeline.use(loggingMiddleware("grep", logger as any));

  return {
    searchTool: createOvSearchTool(svc, searchPipeline),
    globTool: createOvGlobTool(svc, globPipeline),
    grepTool: createOvGrepTool(svc, grepPipeline),
  };
}

async function exec(tool: ToolDefinition<any>, params: Record<string, unknown>) {
  return tool.execute("test-call", params as any, undefined, undefined, makeToolCtx());
}

function resultText(r: any): string {
  return r.content[0].text as string;
}

describe("Tools integration (mock HTTP)", () => {
  it("ov_search calls /api/v1/search/find and returns results", async () => {
    const { searchTool } = wireStack();
    const result = await exec(searchTool, { query: "test", mode: "fast" });
    expect(resultText(result)).toContain("viking://kb/test");
  });

  it("ov_search calls /api/v1/search/search with mode=deep", async () => {
    const { searchTool } = wireStack();
    const result = await exec(searchTool, { query: "deep test", mode: "deep" });
    expect(resultText(result)).toContain("viking://kb/deep");
  });

  it("ov_glob calls /api/v1/search/glob and returns entries", async () => {
    const { globTool } = wireStack();
    const result = await exec(globTool, { pattern: "viking://docs/**" });
    const text = resultText(result);
    expect(text).toContain("viking://docs/a.md");
    expect(text).toContain("viking://docs/b.md");
  });

  it("ov_grep calls /api/v1/search/grep and returns matches", async () => {
    const { grepTool } = wireStack();
    const result = await exec(grepTool, { pattern: "hello" });
    expect(resultText(result)).toContain("hello world");
  });
});
