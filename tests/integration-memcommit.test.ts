import { describe, test, expect, beforeAll, vi } from "vitest";
import { createClient } from "../src/ov-client/client";
import { SessionSync } from "../src/session-sync/session";
import { registerMemcommitTool } from "../src/tools/commit";
import { getTestConfig, isTestServerUp } from "./test-config";

const config = getTestConfig();
const client = createClient(config);

let serverUp = false;
let sessionId: string;

beforeAll(async () => {
  serverUp = await isTestServerUp(config);
  if (!serverUp) return;
  try {
    sessionId = await client.session.createSession();
    await client.session.sendMessage(sessionId, "user", [{ type: "text", text: "hello from integration test" }]);
  } catch {
    serverUp = false;
  }
});

describe("memcommit integration", () => {
  test("commits session successfully via tool interface", async () => {
    if (!serverUp) return;

    const sync = new SessionSync(client.session, {
      getSessionFile: () => "test.session",
      getBranch: () => [],
      appendEntry: () => {},
    });
    (sync as any).ovSessionId = sessionId;

    // Proper mock pi that captures tool defs (like tools.test.ts)
    const tools: unknown[] = [];
    const pi = {
      registerTool: vi.fn((def: unknown) => { tools.push(def); }),
      get tools() { return tools; },
    };
    registerMemcommitTool(pi as any, { session: client.session, fs: client.fs, knowledge: client.knowledge, sync, autoRecallState: { enabled: true, lastInjectedItems: [] } });

    const toolDef = pi.tools[0] as any;
    expect(toolDef).toBeDefined();
    expect(toolDef.name).toBe("memcommit");

    const result = await toolDef.execute("tc-1", {}, undefined, () => {});

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Committed to OpenViking");
    expect(result.content[0].text).toContain("Task:");
    expect(result.details).toHaveProperty("task_id");
    console.log("memcommit result:", result.content[0].text);
  });
});
