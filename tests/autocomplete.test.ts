import { describe, test, expect, vi, beforeEach } from "vitest";
import { createAutocompleteProvider, invalidateCache, parentUri } from "../src/autocomplete/autocomplete";
import type { FsClient } from "../src/ov-client/types";

function createMockFsClient(): FsClient {
  return {
    read: vi.fn(),
    fsList: vi.fn(),
    fsTree: vi.fn(),
    fsStat: vi.fn(),
  } as unknown as FsClient;
}

function createMockCurrent() {
  return {
    getSuggestions: vi.fn(async () => null),
    applyCompletion: vi.fn((lines: string[], line: number, col: number, item: any, prefix: string) => ({
      lines,
      cursorLine: line,
      cursorCol: col,
    })),
    shouldTriggerFileCompletion: vi.fn(() => true),
  };
}

beforeEach(() => {
  // Clear module-level cache between tests
  invalidateCache();
});

describe("parentUri", () => {
  test("strips file from nested URI", () => {
    expect(parentUri("viking://user/memories/file.md")).toBe("viking://user/memories");
  });

  test("strips trailing slash", () => {
    expect(parentUri("viking://user/memories/")).toBe("viking://user");
  });

  test("returns root for top-level URI", () => {
    expect(parentUri("viking://user")).toBe("viking://");
  });

  test("returns root for single-segment slash", () => {
    expect(parentUri("viking://user/")).toBe("viking://");
  });

  test("handles deep nesting", () => {
    expect(parentUri("viking://a/b/c/d/e")).toBe("viking://a/b/c/d");
  });
});

describe("viking:// autocomplete", () => {
  describe("prefix matching", () => {
    test("matches viking:// prefix and returns fsList children", async () => {
      const fsClient = createMockFsClient();
      const mockFsList = fsClient.fsList as ReturnType<typeof vi.fn>;
      mockFsList.mockResolvedValue({
        uri: "viking://",
        children: [
          { uri: "viking://user", type: "directory" },
          { uri: "viking://agent", type: "directory" },
        ],
      });

      const factory = createAutocompleteProvider(fsClient);
      const current = createMockCurrent();
      const provider = factory(current);

      const lines = ["viking://"];
      const result = await provider.getSuggestions(lines, 0, 9, {
        signal: new AbortController().signal,
      });

      expect(mockFsList).toHaveBeenCalledWith("viking://", expect.any(AbortSignal));
      expect(result).toEqual({
        prefix: "viking://",
        items: [
          { value: "viking://user", label: "viking://user", description: "directory" },
          { value: "viking://agent", label: "viking://agent", description: "directory" },
        ],
      });
    });

    test("returns filtered suggestions when partial path is typed", async () => {
      const fsClient = createMockFsClient();
      const mockFsList = fsClient.fsList as ReturnType<typeof vi.fn>;
      mockFsList.mockResolvedValue({
        uri: "viking://",
        children: [
          { uri: "viking://user", type: "directory" },
          { uri: "viking://agent", type: "directory" },
        ],
      });

      const factory = createAutocompleteProvider(fsClient);
      const provider = factory(createMockCurrent());

      const lines = ["viking://us"];
      const result = await provider.getSuggestions(lines, 0, 11, {
        signal: new AbortController().signal,
      });

      expect(result).toEqual({
        prefix: "viking://us",
        items: [
          { value: "viking://user", label: "viking://user", description: "directory" },
        ],
      });
    });

    test("delegates to current provider when no viking:// match", async () => {
      const fsClient = createMockFsClient();
      const factory = createAutocompleteProvider(fsClient);
      const current = createMockCurrent();
      (current.getSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue({
        prefix: "hel",
        items: [{ value: "hello", label: "hello", description: "greeting" }],
      });
      const provider = factory(current);

      const lines = ["hello world"];
      const result = await provider.getSuggestions(lines, 0, 5, {
        signal: new AbortController().signal,
      });

      expect(fsClient.fsList).not.toHaveBeenCalled();
      expect(current.getSuggestions).toHaveBeenCalled();
      expect(result).toEqual({
        prefix: "hel",
        items: [{ value: "hello", label: "hello", description: "greeting" }],
      });
    });
  });

  describe("recursive path segments", () => {
    test("traverses into subdirectory when path contains slash", async () => {
      const fsClient = createMockFsClient();
      const mockFsList = fsClient.fsList as ReturnType<typeof vi.fn>;
      mockFsList.mockResolvedValue({
        uri: "viking://user",
        children: [
          { uri: "viking://user/memories", type: "directory", abstract: "User memories" },
          { uri: "viking://user/resources", type: "directory", abstract: "User resources" },
        ],
      });

      const factory = createAutocompleteProvider(fsClient);
      const provider = factory(createMockCurrent());

      const lines = ["viking://user/"];
      const result = await provider.getSuggestions(lines, 0, 15, {
        signal: new AbortController().signal,
      });

      expect(mockFsList).toHaveBeenCalledWith("viking://user", expect.any(AbortSignal));
      expect(result).toEqual({
        prefix: "viking://user/",
        items: [
          { value: "viking://user/memories", label: "viking://user/memories", description: "directory" },
          { value: "viking://user/resources", label: "viking://user/resources", description: "directory" },
        ],
      });
    });

    test("filters children in subdirectory by partial prefix", async () => {
      const fsClient = createMockFsClient();
      const mockFsList = fsClient.fsList as ReturnType<typeof vi.fn>;
      mockFsList.mockResolvedValue({
        uri: "viking://user",
        children: [
          { uri: "viking://user/memories", type: "directory", abstract: "User memories" },
          { uri: "viking://user/resources", type: "directory", abstract: "User resources" },
        ],
      });

      const factory = createAutocompleteProvider(fsClient);
      const provider = factory(createMockCurrent());

      const lines = ["viking://user/memo"];
      const result = await provider.getSuggestions(lines, 0, 19, {
        signal: new AbortController().signal,
      });

      expect(mockFsList).toHaveBeenCalledWith("viking://user", expect.any(AbortSignal));
      expect(result).toEqual({
        prefix: "viking://user/memo",
        items: [
          { value: "viking://user/memories", label: "viking://user/memories", description: "directory" },
        ],
      });
    });
  });

  describe("cache", () => {
    test("returns cached results without calling fsList again within TTL", async () => {
      const fsClient = createMockFsClient();
      const mockFsList = fsClient.fsList as ReturnType<typeof vi.fn>;
      mockFsList.mockResolvedValue({
        uri: "viking://",
        children: [
          { uri: "viking://user", type: "directory" },
        ],
      });

      const factory = createAutocompleteProvider(fsClient);
      const provider = factory(createMockCurrent());

      // First call — populates cache
      await provider.getSuggestions(["viking://"], 0, 9, {
        signal: new AbortController().signal,
      });
      expect(mockFsList).toHaveBeenCalledTimes(1);

      // Second call — should use cache
      mockFsList.mockClear();
      const result = await provider.getSuggestions(["viking://"], 0, 9, {
        signal: new AbortController().signal,
      });
      expect(mockFsList).not.toHaveBeenCalled();
      expect(result).toEqual({
        prefix: "viking://",
        items: [{ value: "viking://user", label: "viking://user", description: "directory" }],
      });
    });

    test("re-fetches after TTL expiry via fake timers", async () => {
      vi.useFakeTimers();

      const fsClient = createMockFsClient();
      const mockFsList = fsClient.fsList as ReturnType<typeof vi.fn>;
      mockFsList.mockResolvedValue({
        uri: "viking://",
        children: [{ uri: "viking://user", type: "directory" }],
      });

      const factory = createAutocompleteProvider(fsClient);
      const provider = factory(createMockCurrent());

      // First call — populates cache
      await provider.getSuggestions(["viking://"], 0, 9, {
        signal: new AbortController().signal,
      });
      expect(mockFsList).toHaveBeenCalledTimes(1);

      // Advance past TTL (30s)
      mockFsList.mockClear();
      await vi.advanceTimersByTimeAsync(30001);

      // Second call — should refetch
      mockFsList.mockResolvedValue({
        uri: "viking://",
        children: [
          { uri: "viking://user", type: "directory" },
          { uri: "viking://agent", type: "directory" },
        ],
      });
      const result = await provider.getSuggestions(["viking://"], 0, 9, {
        signal: new AbortController().signal,
      });

      expect(mockFsList).toHaveBeenCalledTimes(1);
      expect(result?.items).toHaveLength(2);

      vi.useRealTimers();
    });
  });

  describe("invalidateCache", () => {
    test("invalidates specific path entry", async () => {
      const fsClient = createMockFsClient();
      const mockFsList = fsClient.fsList as ReturnType<typeof vi.fn>;
      mockFsList.mockResolvedValue({
        uri: "viking://",
        children: [{ uri: "viking://user", type: "directory" }],
      });

      const factory = createAutocompleteProvider(fsClient);
      const provider = factory(createMockCurrent());

      // Populate cache for two paths
      mockFsList.mockResolvedValueOnce({
        uri: "viking://",
        children: [{ uri: "viking://user", type: "directory" }],
      });
      mockFsList.mockResolvedValueOnce({
        uri: "viking://user",
        children: [{ uri: "viking://user/memories", type: "directory" }],
      });

      await provider.getSuggestions(["viking://"], 0, 9, { signal: new AbortController().signal });
      await provider.getSuggestions(["viking://user/"], 0, 15, { signal: new AbortController().signal });

      expect(mockFsList).toHaveBeenCalledTimes(2);

      // Invalidate only viking://user
      invalidateCache("viking://user");
      mockFsList.mockClear();

      // viking:// should still be cached
      await provider.getSuggestions(["viking://"], 0, 9, { signal: new AbortController().signal });
      expect(mockFsList).not.toHaveBeenCalled();

      // viking://user should refetch
      mockFsList.mockResolvedValue({
        uri: "viking://user",
        children: [{ uri: "viking://user/resources", type: "directory" }],
      });
      await provider.getSuggestions(["viking://user/"], 0, 15, { signal: new AbortController().signal });
      expect(mockFsList).toHaveBeenCalledTimes(1);
    });

    test("invalidates entire cache when called without path", async () => {
      const fsClient = createMockFsClient();
      const mockFsList = fsClient.fsList as ReturnType<typeof vi.fn>;
      mockFsList.mockResolvedValue({
        uri: "viking://",
        children: [{ uri: "viking://user", type: "directory" }],
      });

      const factory = createAutocompleteProvider(fsClient);
      const provider = factory(createMockCurrent());

      await provider.getSuggestions(["viking://"], 0, 9, { signal: new AbortController().signal });
      expect(mockFsList).toHaveBeenCalledTimes(1);

      invalidateCache(); // Clear all
      mockFsList.mockClear();

      await provider.getSuggestions(["viking://"], 0, 9, { signal: new AbortController().signal });
      expect(mockFsList).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    test("returns null when fsList throws", async () => {
      const fsClient = createMockFsClient();
      const mockFsList = fsClient.fsList as ReturnType<typeof vi.fn>;
      mockFsList.mockRejectedValue(new Error("Network error"));

      const factory = createAutocompleteProvider(fsClient);
      const provider = factory(createMockCurrent());

      const result = await provider.getSuggestions(["viking://"], 0, 9, {
        signal: new AbortController().signal,
      });

      expect(result).toBeNull();
    });

    test("returns null when options signal is aborted", async () => {
      const fsClient = createMockFsClient();
      const factory = createAutocompleteProvider(fsClient);
      const provider = factory(createMockCurrent());

      const controller = new AbortController();
      controller.abort();

      const result = await provider.getSuggestions(["viking://"], 0, 9, {
        signal: controller.signal,
      });

      expect(result).toBeNull();
      expect(fsClient.fsList).not.toHaveBeenCalled();
    });

    test("delegates to current on empty fsList response", async () => {
      const fsClient = createMockFsClient();
      (fsClient.fsList as ReturnType<typeof vi.fn>).mockResolvedValue({
        uri: "viking://",
        children: [],
      });

      const factory = createAutocompleteProvider(fsClient);
      const current = createMockCurrent();
      (current.getSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const provider = factory(current);

      const result = await provider.getSuggestions(["viking://"], 0, 9, {
        signal: new AbortController().signal,
      });

      // Empty children should return empty items, not null
      expect(result).toEqual({
        prefix: "viking://",
        items: [],
      });
    });
  });

  describe("applyCompletion", () => {
    test("delegates to current provider", async () => {
      const fsClient = createMockFsClient();
      const factory = createAutocompleteProvider(fsClient);
      const current = createMockCurrent();
      const provider = factory(current);

      const lines = ["viking://"];
      const item = { value: "viking://user", label: "viking://user", description: "directory" };
      const result = provider.applyCompletion(lines, 0, 9, item, "viking://");

      expect(current.applyCompletion).toHaveBeenCalledWith(lines, 0, 9, item, "viking://");
      expect(result).toEqual({ lines, cursorLine: 0, cursorCol: 9 });
    });
  });

  describe("shouldTriggerFileCompletion", () => {
    test("delegates to current provider", async () => {
      const fsClient = createMockFsClient();
      const factory = createAutocompleteProvider(fsClient);
      const current = createMockCurrent();
      const provider = factory(current);

      const result = provider.shouldTriggerFileCompletion!(["viking://"], 0, 9);

      expect(current.shouldTriggerFileCompletion).toHaveBeenCalledWith(["viking://"], 0, 9);
      expect(result).toBe(true);
    });
  });
});
