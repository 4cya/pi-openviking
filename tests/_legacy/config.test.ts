import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, loadAutoRecallConfig } from "../../src/_legacy/shared/config";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalEnv = { ...process.env };

describe("loadConfig", () => {
  let testDir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    testDir = join(tmpdir(), `ov-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(testDir, { recursive: true, force: true });
  });

  function writeSettings(settings: Record<string, unknown>) {
    mkdirSync(join(testDir, ".pi"), { recursive: true });
    writeFileSync(join(testDir, ".pi", "settings.json"), JSON.stringify(settings));
  }

  test("returns defaults when no settings file or env", () => {
    delete process.env.OPENVIKING_ENDPOINT;
    delete process.env.OPENVIKING_TIMEOUT;
    delete process.env.OPENVIKING_COMMIT_TIMEOUT;
    delete process.env.OPENVIKING_API_KEY;
    delete process.env.OPENVIKING_ACCOUNT;
    delete process.env.OPENVIKING_USER;

    const config = loadConfig(testDir);

    expect(config).toEqual({
      endpoint: "http://localhost:1933",
      timeout: 30000,
      commitTimeout: 60000,
      apiKey: "dev",
      account: "default",
      user: "default",
      healthPath: "/health",
    });
  });

  test("merges .pi/settings.json values over defaults", () => {
    writeSettings({
      openVikingEndpoint: "http://custom:1933",
      openVikingTimeout: 10000,
      openVikingCommitTimeout: 120000,
      openVikingApiKey: "my-key",
      openVikingAccount: "acme",
      openVikingUser: "alice",
      openVikingAutoRecallLimit: 20,
      openVikingAutoRecallTimeout: 10000,
      openVikingAutoRecallTopN: 3,
    });

    const config = loadConfig(testDir);

    expect(config).toEqual({
      endpoint: "http://custom:1933",
      timeout: 10000,
      commitTimeout: 120000,
      apiKey: "my-key",
      account: "acme",
      user: "alice",
      healthPath: "/health",
    });
  });

  test("settings.json overrides env vars", () => {
    writeSettings({
      openVikingEndpoint: "http://custom:1933",
      openVikingTimeout: 10000,
      openVikingCommitTimeout: 120000,
      openVikingApiKey: "my-key",
      openVikingAccount: "acme",
      openVikingUser: "alice",
    });
    process.env.OPENVIKING_ENDPOINT = "http://env:1933";
    process.env.OPENVIKING_TIMEOUT = "5000";
    process.env.OPENVIKING_COMMIT_TIMEOUT = "30000";
    process.env.OPENVIKING_API_KEY = "env-key";
    process.env.OPENVIKING_ACCOUNT = "env-acct";
    process.env.OPENVIKING_USER = "env-user";

    const config = loadConfig(testDir);

    expect(config).toEqual({
      endpoint: "http://custom:1933",
      timeout: 10000,
      commitTimeout: 120000,
      apiKey: "my-key",
      account: "acme",
      user: "alice",
      healthPath: "/health",
    });
  });

  test("env vars work without settings.json", () => {
    process.env.OPENVIKING_ENDPOINT = "http://env-only:1933";
    delete process.env.OPENVIKING_TIMEOUT;

    const config = loadConfig(testDir);

    expect(config.endpoint).toBe("http://env-only:1933");
    expect(config.timeout).toBe(30000);
  });
});

describe("loadAutoRecallConfig", () => {
  let testDir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    testDir = join(tmpdir(), `ov-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(testDir, { recursive: true, force: true });
  });

  function writeSettings(settings: Record<string, unknown>) {
    mkdirSync(join(testDir, ".pi"), { recursive: true });
    writeFileSync(join(testDir, ".pi", "settings.json"), JSON.stringify(settings));
  }

  test("returns defaults when no settings file or env", () => {
    delete process.env.OPENVIKING_AUTO_RECALL;

    const config = loadAutoRecallConfig(testDir);

    expect(config.enabled).toBe(true);
    expect(config.limit).toBe(10);
    expect(config.timeout).toBe(5000);
    expect(config.curator.topN).toBe(5);
    expect(config.curator.maxTokens).toBe(700);
    expect(config.curator.maxContentChars).toBe(500);
    expect(config.curator.scoreThreshold).toBe(0.15);
    expect(config.curator.preferAbstract).toBe(true);
  });

  test("merges .pi/settings.json values over defaults", () => {
    writeSettings({
      openVikingAutoRecall: false,
      openVikingAutoRecallLimit: 25,
      openVikingAutoRecallTimeout: 20000,
      openVikingAutoRecallTopN: 3,
      openVikingAutoRecallTokenBudget: 1000,
      openVikingAutoRecallScoreThreshold: 0.3,
    });

    const config = loadAutoRecallConfig(testDir);

    expect(config.enabled).toBe(false);
    expect(config.limit).toBe(25);
    expect(config.timeout).toBe(20000);
    expect(config.curator.topN).toBe(3);
    expect(config.curator.maxTokens).toBe(1000);
    expect(config.curator.scoreThreshold).toBe(0.3);
    expect(config.curator.maxContentChars).toBe(500); // not set in settings
  });

  test("settings.json overrides env vars", () => {
    writeSettings({ openVikingAutoRecallLimit: 20 });
    process.env.OPENVIKING_AUTO_RECALL_LIMIT = "99";

    const config = loadAutoRecallConfig(testDir);

    expect(config.limit).toBe(20); // settings > env
  });

  test("env vars work without settings.json", () => {
    process.env.OPENVIKING_AUTO_RECALL_LIMIT = "20";
    process.env.OPENVIKING_AUTO_RECALL_TIMEOUT = "10000";
    process.env.OPENVIKING_AUTO_RECALL_TOPN = "3";

    const config = loadAutoRecallConfig(testDir);

    expect(config.limit).toBe(20);
    expect(config.timeout).toBe(10000);
    expect(config.curator.topN).toBe(3);
  });

  test("openVikingAutoRecall setting can be disabled", () => {
    writeSettings({ openVikingAutoRecall: false });

    const config = loadAutoRecallConfig(testDir);
    expect(config.enabled).toBe(false);
  });

  test("env var OPENVIKING_AUTO_RECALL overrides default", () => {
    process.env.OPENVIKING_AUTO_RECALL = "false";

    const config = loadAutoRecallConfig(testDir);
    expect(config.enabled).toBe(false);
  });
});
