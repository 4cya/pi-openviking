import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AutoRecallConfig } from "../auto-recall/auto-recall";
import { DEFAULT_AUTO_RECALL_CONFIG } from "../auto-recall/auto-recall";

export interface OpenVikingConfig {
  endpoint: string;
  timeout: number;
  commitTimeout: number;
  apiKey: string;
  account: string;
  user: string;
  healthPath: string;
}

interface PiSettings {
  openVikingEndpoint?: string;
  openVikingTimeout?: number;
  openVikingCommitTimeout?: number;
  openVikingApiKey?: string;
  openVikingAccount?: string;
  openVikingUser?: string;
  openVikingAutoRecallLimit?: number;
  openVikingAutoRecallTimeout?: number;
  openVikingAutoRecallTopN?: number;
  openVikingAutoRecall?: boolean;
  openVikingAutoRecallScoreThreshold?: number;
  openVikingAutoRecallMaxContentChars?: number;
  openVikingAutoRecallPreferAbstract?: boolean;
  openVikingAutoRecallTokenBudget?: number;
  [key: string]: unknown;
}

function readPiSettings(cwd: string): PiSettings {
  try {
    const raw = readFileSync(join(cwd, ".pi", "settings.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function cascade<T>(
  settings: PiSettings,
  settingKey: string,
  envKey: string,
  fallback: T,
  parse?: (raw: string) => T,
): T {
  if (settings[settingKey] !== undefined) return settings[settingKey] as T;
  const envVal = process.env[envKey];
  if (envVal !== undefined) return parse ? parse(envVal) : (envVal as unknown as T);
  return fallback;
}

export function loadConfig(cwd: string): OpenVikingConfig {
  const s = readPiSettings(cwd);
  return {
    endpoint: cascade(s, "openVikingEndpoint", "OPENVIKING_ENDPOINT", "http://localhost:1933"),
    timeout: cascade(s, "openVikingTimeout", "OPENVIKING_TIMEOUT", 30000, Number),
    commitTimeout: cascade(s, "openVikingCommitTimeout", "OPENVIKING_COMMIT_TIMEOUT", 60000, Number),
    apiKey: cascade(s, "openVikingApiKey", "OPENVIKING_API_KEY", "dev"),
    account: cascade(s, "openVikingAccount", "OPENVIKING_ACCOUNT", "default"),
    user: cascade(s, "openVikingUser", "OPENVIKING_USER", "default"),
    healthPath: cascade(s, "openVikingHealthPath", "OPENVIKING_HEALTH_PATH", "/health"),
  };
}

export function loadAutoRecallConfig(cwd: string): AutoRecallConfig {
  const s = readPiSettings(cwd);
  return {
    enabled: cascade(s, "openVikingAutoRecall", "OPENVIKING_AUTO_RECALL", true, v => v === "true"),
    limit: cascade(s, "openVikingAutoRecallLimit", "OPENVIKING_AUTO_RECALL_LIMIT", DEFAULT_AUTO_RECALL_CONFIG.limit, Number),
    timeout: cascade(s, "openVikingAutoRecallTimeout", "OPENVIKING_AUTO_RECALL_TIMEOUT", DEFAULT_AUTO_RECALL_CONFIG.timeout, Number),
    curator: {
      topN: cascade(s, "openVikingAutoRecallTopN", "OPENVIKING_AUTO_RECALL_TOPN", DEFAULT_AUTO_RECALL_CONFIG.curator.topN, Number),
      maxTokens: cascade(s, "openVikingAutoRecallTokenBudget", "OPENVIKING_AUTO_RECALL_TOKEN_BUDGET", DEFAULT_AUTO_RECALL_CONFIG.curator.maxTokens, Number),
      maxContentChars: cascade(s, "openVikingAutoRecallMaxContentChars", "OPENVIKING_AUTO_RECALL_MAX_CONTENT_CHARS", DEFAULT_AUTO_RECALL_CONFIG.curator.maxContentChars, Number),
      scoreThreshold: cascade(s, "openVikingAutoRecallScoreThreshold", "OPENVIKING_AUTO_RECALL_SCORE_THRESHOLD", DEFAULT_AUTO_RECALL_CONFIG.curator.scoreThreshold, Number),
      preferAbstract: cascade(s, "openVikingAutoRecallPreferAbstract", "OPENVIKING_AUTO_RECALL_PREFER_ABSTRACT", DEFAULT_AUTO_RECALL_CONFIG.curator.preferAbstract, v => v === "true"),
    },
  };
}
