/**
 * Adaptive auto-recall token budget based on context window usage.
 *
 * Stepped thresholds:
 *   <50%  → 1000 tokens (plenty of room)
 *   50-80% → 700 tokens (default)
 *   >80%  → 300 tokens (conserve space)
 *   null  → 700 (fallback — no usage data available)
 *
 * @see docs/adr/0009-adaptive-auto-recall-budget.md
 */

interface ContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

const FALLBACK_BUDGET = 700;

export function resolveBudget(usage: ContextUsage | undefined): number {
  if (!usage || usage.percent === null) return FALLBACK_BUDGET;
  const ratio = usage.percent / 100;
  if (ratio < 0) return FALLBACK_BUDGET;
  if (ratio < 0.5) return 1000;
  if (ratio <= 0.8) return 700;
  return 300;
}
