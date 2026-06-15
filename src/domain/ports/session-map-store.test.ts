import { describe, it, expect } from "vitest";
import type { SessionMapStore, SessionMeta } from "./session-map-store";

describe("SessionMapStore interface", () => {
  it("can be satisfied by a mock", () => {
    const mock: SessionMapStore = {
      load: async () => ({}),
      save: async () => {},
    };
    expect(typeof mock.load).toBe("function");
    expect(typeof mock.save).toBe("function");
  });

  it("load returns record keyed by session path", async () => {
    const mock: SessionMapStore = {
      load: async () => ({
        "/path/to/session.jsonl": {
          ovSessionId: "ov-sess-123",
          syncedMessageKeys: ["msg-1", "msg-2"],
          lastCommitTime: 1717000000000,
        },
      }),
      save: async () => {},
    };
    const map = await mock.load();
    expect(map["/path/to/session.jsonl"]).toBeDefined();
    expect(map["/path/to/session.jsonl"].ovSessionId).toBe("ov-sess-123");
    expect(map["/path/to/session.jsonl"].syncedMessageKeys).toEqual(["msg-1", "msg-2"]);
    expect(map["/path/to/session.jsonl"].lastCommitTime).toBe(1717000000000);
  });

  it("SessionMeta allows optional commitInFlight", () => {
    const meta: SessionMeta = {
      ovSessionId: "ov-sess-456",
      syncedMessageKeys: [],
      commitInFlight: true,
    };
    expect(meta.commitInFlight).toBe(true);
  });

  it("load returns empty object when no map exists", async () => {
    const mock: SessionMapStore = {
      load: async () => ({}),
      save: async () => {},
    };
    const map = await mock.load();
    expect(Object.keys(map)).toHaveLength(0);
  });

  it("save writes record and subsequent load reads it back", async () => {
    let stored: Record<string, SessionMeta> = {};
    const mock: SessionMapStore = {
      load: async () => stored,
      save: async (map) => { stored = map; },
    };

    const map = { "/sessions/test.jsonl": { ovSessionId: "ov-999", syncedMessageKeys: ["k1"] } };
    await mock.save(map);
    const loaded = await mock.load();
    expect(loaded["/sessions/test.jsonl"].ovSessionId).toBe("ov-999");
  });
});
