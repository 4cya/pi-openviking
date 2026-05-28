# PROTOTYPE — F4 Orchestration

## Question
Does the IntentDetector → KnowledgeBase → Curator → RecallService pipeline hold up under real-ish inputs?

## Status: ✅ VALIDATED

All 6 test scenarios from the handoff pass:

| # | Scenario | Result |
|---|----------|--------|
| 1 | Continuation detection | `shouldRecall=false` ✓ |
| 2 | Simple query → find mode | 5 items, mode=find ✓ |
| 3 | Complex query → search mode | 2 items, mode=search ✓ |
| 4 | Scorer stacking (relevance+temporal) | Score boosted from ~0.9 → 1.545 ✓ |
| 5 | targetUri filter | Only `viking://auth/*` items returned ✓ |
| 6 | Graceful degradation (ConnectionError) | Empty result, degraded=true ✓ |

## Verdict

The F4 design is sound. Key findings:

1. **IntentDetector CoR pipeline** works cleanly. Handler priority (Continuation → SimpleQuery → ComplexQuery → Default) produces correct results.
2. **Scorer stacking** via `curateWithScorers()` wrapper over `curate()` — scores sum, re-sort works, threshold re-applied. Decision 4 validated.
3. **RecallConfig scope** via `targetUri` prefix filter works. KB mock filters before curation.
4. **Graceful degradation** catches ConnectionError, returns empty. Decision 8 validated.
5. **Token budget trimming** in curate() works — items dropped when budget exceeded.

## Design note for real implementation

- `curateWithScorers()` should become part of the real `CurateOpts` (add `scorers?: Scorer[]`).
- IntentDetector handlers should be injectable for testing.
- The prototype's mock KB scoring (keyword overlap) is obviously simplified — real OV scoring comes from the server.

## Files
- `prototype/f4-logic.ts` — Pure logic module (portable to real codebase)
- `prototype/f4-tui.ts` — TUI shell (throwaway)

## Run
```bash
bun run prototype:f4
```
