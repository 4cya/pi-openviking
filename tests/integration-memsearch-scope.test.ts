import { describe, test, expect, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "../src/ov-client/client";
import { getTestConfig, isTestServerUp } from "./test-config";

const config = getTestConfig();
const client = createClient(config);

let serverUp = false;
let sessionId: string;

beforeAll(async () => {
  serverUp = await isTestServerUp(config);
  if (!serverUp) return;
  try {
    sessionId = await client.createSession();
  } catch {
    serverUp = false;
  }
});

async function deleteWithRetry(uri: string, maxRetries = 5): Promise<{ uri: string }> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.delete(uri);
    } catch (err: any) {
      const isProcessing = err.message?.includes("being processed") || err.message?.includes("409");
      if (isProcessing && i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("deleteWithRetry exhausted retries");
}

/**
 * Poll search until resource is indexed or maxWait expires.
 * Returns search results once resource is found, or throws.
 */
async function waitForIndex(
  keyword: string,
  expectedPrefix: string,
  maxWaitMs = 60_000,
): Promise<ReturnType<typeof client.search>> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const results = await client.search(sessionId, keyword, 10, "fast");
    const found = results.resources.some((r) => r.uri.startsWith(expectedPrefix));
    if (found) return results;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(
    `Resource with keyword "${keyword}" not indexed within ${maxWaitMs}ms (prefix: ${expectedPrefix})`,
  );
}

describe("memsearch target_uri scoping integration", () => {
  test("scoped search finds resource under target_uri and excludes from wrong scope", async () => {
    if (!serverUp) return;

    const tmpDir = mkdtempSync(join(tmpdir(), "ov-scope-"));
    const filePath = join(tmpDir, "scoped-resource.md");
    const uniqueKeyword = `ov-scope-${Date.now()}`;
    const content = `# Scoped Resource\n\nKeyword: ${uniqueKeyword}`;
    writeFileSync(filePath, content);

    let importedUri: string | undefined;

    try {
      const body = new TextEncoder().encode(content);
      const upload = await client.tempUpload(body, "scoped-resource.md");
      const result = await client.addResource({ temp_file_id: upload.temp_file_id });
      importedUri = result.root_uri;

      // Wait for indexing — fail if it never arrives
      await waitForIndex(uniqueKeyword, importedUri);
      console.log("indexed at:", importedUri);

      // Scoped to resources/ — MUST find it
      const scopedResources = await client.search(sessionId, uniqueKeyword, 10, "fast", "viking://resources/");
      const foundResources = scopedResources.resources.some((r) => r.uri.startsWith(importedUri!));
      expect(foundResources).toBe(true);
      console.log("scoped to resources/ — found:", foundResources);

      // Scoped to wrong scope — MUST NOT find it
      const scopedSkills = await client.search(sessionId, uniqueKeyword, 10, "fast", "viking://agent/skills/");
      const foundSkills = scopedSkills.resources.some((r) => r.uri.startsWith(importedUri!));
      expect(foundSkills).toBe(false);
      console.log("scoped to skills/ — found:", foundSkills);
    } finally {
      if (importedUri) {
        try { await deleteWithRetry(importedUri); } catch (e: any) { console.log("cleanup:", e.message); }
      }
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 120_000);
});
