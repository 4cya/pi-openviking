# Adaptive auto-recall token budget via context usage

Status: accepted

Auto-recall token budget scales with context window usage instead of being fixed at 700 tokens. Uses `ctx.getContextUsage()` (available in `before_agent_start`) to estimate current context consumption as a ratio, then applies stepped thresholds:

- Context <50% used → 1000 token budget
- Context 50-80% used → 700 token budget (previous fixed default)
- Context >80% used → 300 token budget

Stepped thresholds chosen over linear scaling because they're debuggable (three obvious states), don't require model contextWindow lookup (only ratios), and avoid floating-point budget values that make testing harder.

The previous fixed budget of 700 tokens was ~0.35% of a 200k window but ~2.3% of a 32k window. On smaller context models, 700 tokens of auto-recall could consume disproportionate context. On large context models, it was conservative to the point of under-utilization.

**Considered options:**
- Fixed 700 tokens (status quo) — one-size-fits-all, wastes large windows, strains small ones
- Linear scaling `budget = base * (1 - usage)` — requires contextWindow value, floating-point budgets, harder to test
- Stepped thresholds — chosen. Simple, ratio-based, testable, no model metadata needed.

**Consequences:**
- Recall Curator receives a dynamic budget instead of the fixed 700. The `curate()` function signature changes to accept an explicit budget parameter.
- `DEFAULT_CURATE_OPTIONS.tokenBudget` (700) becomes the fallback when `getContextUsage()` returns null (e.g., print mode, no UI).
- Tests that currently assert 700-token budgets need updating to parameterized budgets.
