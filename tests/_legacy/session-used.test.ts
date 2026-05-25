import { describe, test, expect, vi } from "vitest";
import type { Transport } from "../../src/_legacy/ov-client/transport";
import { createSessionOps } from "../../src/_legacy/ov-client/session-ops";

function createMockTransport(): Transport & { calls: Array<{ label: string; path: string; opts: any }> } {
  const calls: Array<{ label: string; path: string; opts: any }> = [];
  return {
    calls,
    async request(label, path, opts) {
      calls.push({ label, path, opts });
    },
  };
}

describe("sessionUsed", () => {
  test("sends POST with contexts array", async () => {
    const t = createMockTransport();
    const ops = createSessionOps(t, 30000);

    await ops.sessionUsed("sess-42", [
      "viking://resources/docs/api.md",
      "viking://memories/m1",
    ]);

    expect(t.calls).toHaveLength(1);
    expect(t.calls[0]).toEqual({
      label: "sessionUsed",
      path: "/api/v1/sessions/sess-42/used",
      opts: {
        body: { contexts: ["viking://resources/docs/api.md", "viking://memories/m1"] },
        httpMethod: "POST",
      },
    });
  });

  test("handles transport error without throwing", async () => {
    const t: Transport = {
      async request() {
        throw new Error("network down");
      },
    };
    const ops = createSessionOps(t, 30000);

    // Should not throw — errors are swallowed silently
    await expect(ops.sessionUsed("sess-1", ["viking://x"])).resolves.toBeUndefined();
  });
});
