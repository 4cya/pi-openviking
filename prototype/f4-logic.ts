/**
 * PROTOTYPE — F4 Orchestration Validation
 *
 * Question: Does the IntentDetector → KnowledgeBase → Curator → RecallService
 * pipeline hold up under real-ish inputs?
 *
 * This module is pure logic — no I/O, no terminal code.
 * The TUI shell (f4-tui.ts) imports and drives it.
 */
import { curate, estimateTokens } from "../src/domain/recall/curate";
import type { CuratedItem, CurateOpts, CuratedResult } from "../src/domain/recall/curate";
import type { SearchResult, KnowledgeItem, ResourceItem } from "../src/domain/knowledge/model/search-result";
import type { SkillItem } from "../src/domain/knowledge/model/skill-item";
import { ConnectionError } from "../src/domain/errors/connection-error";
import { SessionId } from "../src/domain/common/session-id";

// ─── RecallConfig (Decision 6: 5 fields born in F4) ───────────────────────

export interface RecallConfig {
  targetUri: string | null;
  topN: number;
  scoreThreshold: number;
  expandGraph: boolean;
  searchMode: "find" | "search";
}

export const DEFAULT_RECALL_CONFIG: RecallConfig = {
  targetUri: null,
  topN: 5,
  scoreThreshold: 0.5,
  expandGraph: false,
  searchMode: "find",
};

// ─── Scorer interface (Decision 4) ─────────────────────────────────────────

export type Scorer = (item: CuratedItem, query: string) => number;

/** Keyword overlap bonus. Max +0.5 */
export const relevanceScorer: Scorer = (item, query) => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;
  const text = (item.text + " " + item.uri).toLowerCase();
  let hits = 0;
  for (const t of terms) if (text.includes(t)) hits++;
  return (hits / terms.length) * 0.5;
};

/** Small bonus proportional to existing score (simulates temporal freshness). */
export const temporalScorer: Scorer = (item) => {
  return (item.score ?? 0) * 0.1;
};

// ─── curateWithScorers (Decision 4: scorers refine, not replace) ──────────

export function curateWithScorers(
  results: SearchResult,
  opts: CurateOpts,
  scorers: Scorer[],
  query: string,
): CuratedResult {
  const base = curate(results, opts);
  if (scorers.length === 0) return base;

  const scored = base.items.map((item) => {
    let bonus = 0;
    for (const s of scorers) bonus += s(item, query);
    return { ...item, score: item.score + bonus };
  });

  scored.sort((a, b) => b.score - a.score);

  const above = scored.filter((i) => i.score >= opts.scoreThreshold);
  const top = above.slice(0, opts.topN);

  let tokens = 0;
  const trimmed: CuratedItem[] = [];
  for (const item of top) {
    const t = estimateTokens(item.text) + 60;
    if (tokens + t + 130 > opts.maxTokens) break;
    tokens += t;
    trimmed.push(item);
  }

  return {
    items: trimmed,
    tokens,
    dropped: (results.memories.length + results.resources.length) - trimmed.length,
  };
}

// ─── IntentDetector (Decision 7: CoR pipeline) ────────────────────────────

export interface IntentResult {
  shouldRecall: boolean;
  searchMode: "find" | "search";
  query: string;
  handler: string;
}

interface IntentHandler {
  name: string;
  detect(prompt: string): IntentResult | null;
}

const continuationHandler: IntentHandler = {
  name: "Continuation",
  detect(prompt) {
    const t = prompt.trim().toLowerCase();
    if (/^(continue|go on|keep going|and then|more|yes|no|ok|sure|right|uh huh|mm)$/.test(t)) {
      return { shouldRecall: false, searchMode: "find", query: prompt, handler: "Continuation" };
    }
    return null;
  },
};

const simpleQueryHandler: IntentHandler = {
  name: "SimpleQuery",
  detect(prompt) {
    const t = prompt.trim();
    if (/^(what is|what's|define|who is|when is|where is)\s/i.test(t) && t.length < 80) {
      return { shouldRecall: true, searchMode: "find", query: prompt, handler: "SimpleQuery" };
    }
    return null;
  },
};

const complexQueryHandler: IntentHandler = {
  name: "ComplexQuery",
  detect(prompt) {
    if (/how does|how do|explain|architecture|design|implement|compare|difference|project|system/i.test(prompt)) {
      return { shouldRecall: true, searchMode: "search", query: prompt, handler: "ComplexQuery" };
    }
    return null;
  },
};

export class IntentDetector {
  private handlers: IntentHandler[] = [
    continuationHandler,
    simpleQueryHandler,
    complexQueryHandler,
  ];

  detect(prompt: string): IntentResult {
    for (const h of this.handlers) {
      const r = h.detect(prompt);
      if (r) return r;
    }
    return { shouldRecall: true, searchMode: "find", query: prompt, handler: "Default" };
  }
}

// ─── Mock KnowledgeBase ────────────────────────────────────────────────────

const MOCK_MEMORIES: KnowledgeItem[] = [
  { uri: "viking://auth/jwt.md", text: "JWT authentication uses HS256 signing with configurable expiry. Tokens are issued at login and refreshed via /auth/refresh endpoint.", score: 0.9, category: "auth", modTime: "2026-05-27T10:00:00Z" },
  { uri: "viking://auth/middleware.md", text: "Auth middleware validates JWT tokens on every request. Checks expiry, signature, and scopes. Returns 401 on invalid tokens.", score: 0.85, category: "auth", modTime: "2026-05-26T10:00:00Z" },
  { uri: "viking://api/rest.md", text: "REST API follows OpenAPI 3.0 spec. All endpoints return JSON. Error responses use RFC 7807 format with type, title, detail fields.", score: 0.8, category: "api", modTime: "2026-05-25T10:00:00Z" },
  { uri: "viking://api/routes.md", text: "API routes are organized by domain: /auth/*, /users/*, /sessions/*. Each route module exports a router instance.", score: 0.75, category: "api", modTime: "2026-05-24T10:00:00Z" },
  { uri: "viking://db/migrations.md", text: "Database migrations use versioned SQL files. Each migration has up() and down(). Applied atomically within a transaction.", score: 0.7, category: "database", modTime: "2026-05-23T10:00:00Z" },
  { uri: "viking://db/schema.md", text: "Database schema: users table has id, email, created_at. Sessions table has id, user_id, token, expires_at. Indexed on user_id and token.", score: 0.65, category: "database", modTime: "2026-05-22T10:00:00Z" },
  { uri: "viking://config/env.md", text: "Configuration uses environment variables with .env file fallback. Required vars: DATABASE_URL, JWT_SECRET, PORT. Optional: LOG_LEVEL, CACHE_TTL.", score: 0.6, category: "config", modTime: "2026-05-21T10:00:00Z" },
  { uri: "viking://testing/unit.md", text: "Unit tests use vitest with describe/it blocks. Coverage target is 90%. Mock external dependencies. Integration tests use test database.", score: 0.55, category: "testing", modTime: "2026-05-20T10:00:00Z" },
  { uri: "viking://auth/oauth.md", text: "OAuth2 integration supports Google and GitHub providers. Authorization code flow with PKCE. Tokens stored encrypted in database.", score: 0.5, category: "auth", modTime: "2026-05-19T10:00:00Z" },
  { uri: "viking://scoring/algorithm.md", text: "Scoring algorithm combines relevance (TF-IDF cosine similarity) with temporal decay (exponential, half-life 7 days) and user preference signals.", score: 0.45, category: "scoring", modTime: "2026-05-18T10:00:00Z" },
];

const MOCK_RESOURCES: ResourceItem[] = [
  { uri: "viking://docs/architecture.md", abstract: "System architecture overview: monorepo with hexagonal layers. Domain core has zero external dependencies.", score: 0.7 },
  { uri: "viking://docs/deployment.md", abstract: "Deployment uses Docker containers on Kubernetes. CI/CD via GitHub Actions. Staging mirrors production.", score: 0.5 },
];

export class MockKnowledgeBase {
  private memories: KnowledgeItem[];
  private resources: ResourceItem[];
  simulateConnectionError = false;

  constructor(memories?: KnowledgeItem[], resources?: ResourceItem[]) {
    this.memories = memories ?? MOCK_MEMORIES;
    this.resources = resources ?? MOCK_RESOURCES;
  }

  async find(query: string, targetUri?: string | null, limit?: number): Promise<SearchResult> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    let scored = this.memories.map((m) => {
      const text = (m.text + " " + m.uri + " " + (m.category ?? "")).toLowerCase();
      let s = (m.score ?? 0) * 0.5;
      let hits = 0;
      for (const t of terms) if (text.includes(t)) hits++;
      s += (terms.length > 0 ? (hits / terms.length) : 0) * 0.5;
      return { ...m, score: s };
    });
    if (targetUri) scored = scored.filter((m) => m.uri.startsWith(targetUri));
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (limit) scored = scored.slice(0, limit);
    return {
      memories: scored,
      resources: targetUri ? this.resources.filter((r) => r.uri.startsWith(targetUri)) : [...this.resources],
      skills: [] as SkillItem[],
      total: scored.length,
    };
  }

  async search(query: string, targetUri?: string | null, limit?: number): Promise<SearchResult> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    let scored = this.memories.map((m) => {
      const text = (m.text + " " + m.uri + " " + (m.category ?? "")).toLowerCase();
      let s = (m.score ?? 0) * 0.3;
      let hits = 0;
      for (const t of terms) if (text.includes(t)) hits++;
      s += (terms.length > 0 ? (hits / terms.length) : 0) * 0.7;
      return { ...m, score: s };
    });
    if (targetUri) scored = scored.filter((m) => m.uri.startsWith(targetUri));
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (limit) scored = scored.slice(0, limit);
    return {
      memories: scored,
      resources: targetUri ? this.resources.filter((r) => r.uri.startsWith(targetUri)) : [...this.resources],
      skills: [] as SkillItem[],
      total: scored.length,
    };
  }
}

// ─── RecallService (orchestrator) ──────────────────────────────────────────

export interface RecallResult {
  items: CuratedItem[];
  tokens: number;
  formatted: string;
  intent: IntentResult;
  rawCount: number;
  dropped: number;
  degraded: boolean;
}

export class RecallService {
  private intentDetector = new IntentDetector();
  private kb: MockKnowledgeBase;
  private config: RecallConfig;
  private scorers: Scorer[];
  private _sessionId: SessionId | null = null;

  constructor(kb: MockKnowledgeBase, config?: Partial<RecallConfig>, scorers?: Scorer[]) {
    this.kb = kb;
    this.config = { ...DEFAULT_RECALL_CONFIG, ...config };
    this.scorers = scorers ?? [];
  }

  get sessionId() { return this._sessionId; }
  setSession(id: SessionId | null) { this._sessionId = id; }
  getConfig() { return { ...this.config }; }
  updateConfig(patch: Partial<RecallConfig>) { this.config = { ...this.config, ...patch }; }
  setScorers(s: Scorer[]) { this.scorers = s; }
  getScorers() { return [...this.scorers]; }

  async recall(prompt: string): Promise<RecallResult> {
    const intent = this.intentDetector.detect(prompt);
    if (!intent.shouldRecall) {
      return { items: [], tokens: 0, formatted: "", intent, rawCount: 0, dropped: 0, degraded: false };
    }

    let results: SearchResult;
    const mode = intent.searchMode;
    const limit = this.config.topN * 3;

    try {
      if (this.kb.simulateConnectionError) throw new ConnectionError("OV unreachable (simulated)");
      results = mode === "search"
        ? await this.kb.search(intent.query, this.config.targetUri, limit)
        : await this.kb.find(intent.query, this.config.targetUri, limit);
    } catch (e) {
      if (e instanceof ConnectionError) {
        return { items: [], tokens: 0, formatted: "", intent, rawCount: 0, dropped: 0, degraded: true };
      }
      throw e;
    }

    const curateOpts: CurateOpts = {
      topN: this.config.topN,
      scoreThreshold: this.config.scoreThreshold,
      maxTokens: 2000,
    };
    const curated = curateWithScorers(results, curateOpts, this.scorers, intent.query);

    const formatted = curated.items
      .map((item, i) => `[${i + 1}] (${item.source}) ${item.uri}\n    score: ${item.score.toFixed(3)}\n    ${item.text.length > 120 ? item.text.slice(0, 120) + "…" : item.text}`)
      .join("\n\n");

    return {
      items: curated.items,
      tokens: curated.tokens,
      formatted,
      intent,
      rawCount: results.memories.length + results.resources.length,
      dropped: curated.dropped,
      degraded: false,
    };
  }
}
