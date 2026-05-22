import { describe, test, expect, vi } from "vitest";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { KnowledgeClient } from "../src/ov-client/client";
import { uploadDirectory } from "../src/importer/uploader";
import { createMockClient } from "./mocks";

describe("uploadDirectory", () => {
  test("zips files and calls tempUpload + addResource", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "ov-upload-"));
    writeFileSync(join(tmpDir, "a.txt"), "hello");
    writeFileSync(join(tmpDir, "b.txt"), "world");

    const client = createMockClient({
      knowledge: {
        addResource: vi.fn(async () => ({ root_uri: "viking://resources/dir", status: "success", errors: [] })),
      } as any,
    });
    const kc: KnowledgeClient = client.knowledge;

    try {
      const result = await uploadDirectory(kc, tmpDir);
      expect(kc.tempUpload).toHaveBeenCalledOnce();
      const [body, filename] = (kc.tempUpload as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(body).toBeInstanceOf(Uint8Array);
      expect(body.length).toBeGreaterThan(0);
      expect(filename).toMatch(/\.zip$/);
      expect(result.root_uri).toBe("viking://resources/dir");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("excludes .git and node_modules from zip", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "ov-upload-"));
    mkdirSync(join(tmpDir, ".git"));
    mkdirSync(join(tmpDir, "node_modules"));
    mkdirSync(join(tmpDir, "src"));
    writeFileSync(join(tmpDir, ".git", "config"), "git config");
    writeFileSync(join(tmpDir, "node_modules", "mod.txt"), "module");
    writeFileSync(join(tmpDir, "src", "code.ts"), "code");
    writeFileSync(join(tmpDir, "readme.md"), "readme");

    const client = createMockClient({
      knowledge: {
        addResource: vi.fn(async () => ({ root_uri: "viking://resources/dir", status: "success", errors: [] })),
      } as any,
    });
    const kc: KnowledgeClient = client.knowledge;

    try {
      await uploadDirectory(kc, tmpDir);
      const [body] = (kc.tempUpload as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(body).toBeInstanceOf(Uint8Array);
      expect(kc.tempUpload).toHaveBeenCalledOnce();
      expect(kc.addResource).toHaveBeenCalledOnce();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("passes options to addResource", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "ov-upload-"));
    writeFileSync(join(tmpDir, "x.txt"), "x");

    const client = createMockClient({
      knowledge: {
        addResource: vi.fn(async () => ({ root_uri: "viking://agent/skills/dir", status: "success", errors: [] })),
      } as any,
    });
    const kc: KnowledgeClient = client.knowledge;

    try {
      await uploadDirectory(kc, tmpDir, {
        kind: "skill",
        reason: "test",
        parent: "viking://agent/skills/",
      });
      expect(kc.addResource).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "skill",
          reason: "test",
          parent: "viking://agent/skills/",
        }),
        undefined,
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
