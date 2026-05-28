#!/usr/bin/env bun
/**
 * PROTOTYPE — F4 Orchestration TUI
 *
 * Interactive terminal app to stress-test the F4 data flow:
 *   Prompt → IntentDetector → KB.search/find → Curator → RecallService
 *
 * Run:  bun run prototype:f4
 */
import * as readline from "readline";
import {
  RecallService, MockKnowledgeBase,
  relevanceScorer, temporalScorer,
  DEFAULT_RECALL_CONFIG,
  type RecallConfig, type Scorer, type RecallResult,
} from "./f4-logic";

// ─── ANSI helpers ──────────────────────────────────────────────────────────
const B = "\x1b[1m";
const D = "\x1b[2m";
const R = "\x1b[0m";
const G = "\x1b[32m";
const Y = "\x1b[33m";
const C = "\x1b[36m";
const RED = "\x1b[31m";

function clear() { process.stdout.write("\x1b[2J\x1b[H"); }

// ─── State ─────────────────────────────────────────────────────────────────
const kb = new MockKnowledgeBase();
const service = new RecallService(kb);
let lastResult: RecallResult | null = null;
let history: string[] = [];
let errorSim = false;

// ─── Render ────────────────────────────────────────────────────────────────

function render() {
  clear();
  const cfg = service.getConfig();
  const scorers = service.getScorers();
  const sess = service.sessionId;

  console.log(`${B}╔══════════════════════════════════════════════════════════╗${R}`);
  console.log(`${B}║  PROTOTYPE: F4 Orchestration — IntentDetector → Recall  ║${R}`);
  console.log(`${B}╚══════════════════════════════════════════════════════════╝${R}`);
  console.log();

  // Config block
  console.log(`${C}${B}Config${R}`);
  console.log(`  topN:          ${cfg.topN}`);
  console.log(`  scoreThreshold:${cfg.scoreThreshold}`);
  console.log(`  targetUri:     ${cfg.targetUri ?? D + "(global)" + R}`);
  console.log(`  searchMode:    ${cfg.searchMode}`);
  console.log(`  expandGraph:   ${cfg.expandGraph}`);
  console.log(`  session:       ${sess ? sess.value : D + "(none)" + R}`);
  console.log(`  scorers:       ${scorers.length === 0 ? D + "(none)" + R : scorers.map(s => s === relevanceScorer ? "relevance" : s === temporalScorer ? "temporal" : "?").join(", ")}`);
  console.log(`  error sim:     ${errorSim ? RED + "ON" + R : D + "off" + R}`);
  console.log();

  // Last result
  if (lastResult) {
    const r = lastResult;
    console.log(`${C}${B}Last Result${R}`);
    console.log(`  intent:   ${Y}${r.intent.handler}${R} → shouldRecall=${r.intent.shouldRecall} searchMode=${r.intent.searchMode}`);
    console.log(`  query:    "${r.intent.query}"`);
    if (r.degraded) {
      console.log(`  ${RED}⚠ DEGRADED — ConnectionError caught, returned empty${R}`);
    } else if (!r.intent.shouldRecall) {
      console.log(`  ${D}(skipped — continuation detected)${R}`);
    } else {
      console.log(`  rawCount: ${r.rawCount}  →  curated: ${r.items.length}  dropped: ${r.dropped}`);
      console.log(`  tokens:   ${r.tokens} / 2000`);
      console.log();
      if (r.items.length > 0) {
        console.log(`${B}Items:${R}`);
        for (const item of r.items) {
          console.log(`  ${G}●${R} ${item.uri}`);
          console.log(`    score: ${item.score.toFixed(3)}  source: ${item.source}${item.category ? `  cat: ${item.category}` : ""}`);
          console.log(`    ${D}${item.text.length > 100 ? item.text.slice(0, 100) + "…" : item.text}${R}`);
        }
      }
    }
    console.log();
  }

  // History
  if (history.length > 0) {
    console.log(`${D}History:${R}`);
    for (const h of history.slice(-5)) {
      console.log(`  ${D}→ ${h}${R}`);
    }
    console.log();
  }

  // Commands
  console.log(`${B}Commands:${R}`);
  console.log(`  ${G}<text>${R}    send prompt through the pipeline`);
  console.log(`  ${G}/n ${D}N${R}       set topN (default 5)`);
  console.log(`  ${G}/t ${D}T${R}       set scoreThreshold (default 0.5)`);
  console.log(`  ${G}/u ${D}URI${R}     set targetUri prefix (or ${G}/u off${R} for global)`);
  console.log(`  ${G}/s${R}         toggle scorers (none → relevance → +temporal)`);
  console.log(`  ${G}/e${R}         simulate ConnectionError toggle`);
  console.log(`  ${G}/session${R}   create mock session`);
  console.log(`  ${G}/q${R}         quit`);
  console.log();
  process.stdout.write(`${B}>${R} `);
}

// ─── Input handling ────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on("line", async (line) => {
  const input = line.trim();
  if (!input) { render(); return; }

  if (input === "/q" || input === "/quit") {
    console.log("Bye.");
    process.exit(0);
  }

  if (input.startsWith("/n ")) {
    const val = parseInt(input.slice(3), 10);
    if (val > 0) service.updateConfig({ topN: val });
    render(); return;
  }

  if (input.startsWith("/t ")) {
    const val = parseFloat(input.slice(3));
    if (val >= 0 && val <= 1) service.updateConfig({ scoreThreshold: val });
    render(); return;
  }

  if (input.startsWith("/u ")) {
    const uri = input.slice(3).trim();
    service.updateConfig({ targetUri: uri === "off" ? null : uri });
    render(); return;
  }

  if (input === "/s") {
    const current = service.getScorers();
    if (current.length === 0) {
      service.setScorers([relevanceScorer]);
    } else if (current.length === 1) {
      service.setScorers([relevanceScorer, temporalScorer]);
    } else {
      service.setScorers([]);
    }
    render(); return;
  }

  if (input === "/e") {
    errorSim = !errorSim;
    kb.simulateConnectionError = errorSim;
    render(); return;
  }

  if (input === "/session") {
    const { SessionId } = await import("../src/domain/common/session-id");
    service.setSession(new SessionId(`proto-${Date.now()}`));
    render(); return;
  }

  // Treat as prompt
  history.push(input);
  try {
    lastResult = await service.recall(input);
  } catch (e) {
    lastResult = {
      items: [], tokens: 0, formatted: "",
      intent: { shouldRecall: false, searchMode: "find", query: input, handler: "ERROR" },
      rawCount: 0, dropped: 0, degraded: false,
    };
    console.log(`${RED}Error: ${e}${R}`);
  }
  render();
});

// ─── Start ─────────────────────────────────────────────────────────────────
render();
