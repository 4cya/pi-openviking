import { describe, test, expect, vi } from "vitest";
import { createClient } from "../../src/_legacy/ov-client/client";
import type { OpenVikingConfig } from "../../src/_legacy/shared/config";

const defaultConfig: OpenVikingConfig = {
  endpoint: "http://localhost:1933",
  timeout: 5000,
  commitTimeout: 60000,
  apiKey: "dev",
  account: "default",
  user: "default",
  healthPath: "/health",
};

function mockTransport() {
  return {
    request: vi.fn(async () => ({})),
  };
}

describe("getTaskStatus", () => {
  test("returns task status from GET /api/v1/tasks/{taskId}", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({
      task_id: "task-1",
      status: "completed",
      result: { archive_uri: "viking://archived/sess-1" },
    });

    const client = createClient(defaultConfig, transport);
    const result = await client.session.getTaskStatus("task-1");

    expect(transport.request).toHaveBeenCalledWith(
      "getTaskStatus",
      "/api/v1/tasks/task-1",
      undefined,
      undefined,
    );
    expect(result.task_id).toBe("task-1");
    expect(result.status).toBe("completed");
  });

  test("returns running status when task still processing", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({
      task_id: "task-2",
      status: "running",
    });

    const client = createClient(defaultConfig, transport);
    const result = await client.session.getTaskStatus("task-2");
    expect(result.status).toBe("running");
  });

  test("returns failed status with error", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({
      task_id: "task-3",
      status: "failed",
      error: "extraction failed",
    });

    const client = createClient(defaultConfig, transport);
    const result = await client.session.getTaskStatus("task-3");
    expect(result.status).toBe("failed");
    expect(result.error).toBe("extraction failed");
  });

  test("passes abort signal", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({ task_id: "t", status: "completed" });

    const controller = new AbortController();
    const client = createClient(defaultConfig, transport);
    await client.session.getTaskStatus("task-1", controller.signal);
    expect(transport.request).toHaveBeenCalledWith(
      "getTaskStatus",
      "/api/v1/tasks/task-1",
      undefined,
      controller.signal,
    );
  });

  test("throws on transport error", async () => {
    const transport = mockTransport();
    transport.request.mockRejectedValue(
      new Error("OpenViking getTaskStatus failed: not found (HTTP 404)"),
    );

    const client = createClient(defaultConfig, transport);
    await expect(client.session.getTaskStatus("bad-id")).rejects.toThrow("not found");
  });
});
