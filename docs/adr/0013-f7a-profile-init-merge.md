# ADR-013: F7a Profiles — init merge, deferred injection

ProfileBehavior (6 fields: targetUri, topN, scoreThreshold, searchMode, expandGraph, autoRecall) overrides RecallConfig. The merge happens in `init()` after `loadConfig()`, not inside the cascade. ProfileManager is not injected into services until F7b.

## Context

The PLANO defines ProfileBehavior as 6 fields that override RecallConfig. The PROFILES.md doc proposed a richer schema (12+ fields in 4 groups). Two architectural questions emerged: (1) where does the merge happen (inside `loadConfig()` or in `init()`), and (2) when does ProfileManager get injected into services (F7a or F7b).

## Decision

1. **Merge in `init()`, not `loadConfig()`.** `loadConfig()` stays pure: defaults → env vars → `.pi/settings.json` → Zod validate. `init()` then creates `ProfileManager`, calls `resolve(activeProfile)`, deep-merges the result into `PiOVConfig.recall`. Services are constructed with the merged config — they never know profiles exist.

2. **6 fields, not 12+.** ProfileBehavior carries only the 6 fields that override RecallConfig. The richer schema from PROFILES.md (autoSaveMode, autoLinkMode, forceRecall, thresholdOverride, expandGraphDepth, tokenBudget, preferAbstract, targetUriFallback) is deferred: automation fields to F8, intent fields removed entirely (no intent detection), graph depth to F8 with GraphExpander, tokenBudget/preferAbstract to when RecallCurator supports them.

3. **ProfileManager not injected in F7a.** Services receive merged config at construction. ProfileManager is registered as container singleton but only `init()` uses it in F7a. In F7b, `/ov-profile apply` requires runtime mutation, so ProfileManager gets injected into services that read profile-overridable fields (RecallService, RecallCurator, SearchService).

4. **`autoRecall` entered RecallConfigSchema.** Not a separate concept. It's the 7th field of RecallConfig, default `true`. ProfileBehavior overrides it the same way it overrides `topN` or `searchMode`. This keeps the merge symmetrical: every profile field maps to a `recall.*` path.

## Why not alternatives

- **Merge inside `loadConfig()`** would make it stateful (creates ProfileManager) and break the current validation-before-merge pattern. `loadConfig()` currently validates `activeProfile` exists — merging after validation keeps error messages clean.
- **Full ProfileManager injection in F7a** would change 3 service constructors before any runtime consumer exists. Since `/ov-profile apply` is F7b, there's zero benefit to injecting earlier.
- **Rich schema (12+ fields)** would add fields with no consumers in F7a. autoSaveMode/autoLinkMode need F8 auto-actions. expandGraphDepth is meaningless without GraphExpander (F8). Deferred fields are cleaner than dead config.
- **autoRecall as separate concept** (e.g., `profile.behavior.autoRecall` mapped to a non-`recall.*` path) would break the 1:1 symmetry and force `init()` to have special-case logic for one field.

## Consequences

- ProfileManager is registered in the DI container from F7a but only resolved by service constructors in F7b. The container has a dangling singleton for one phase — acceptable cost.
- If a new service reads profile-overridable fields in the future, it must either receive merged config (if created in init) or receive ProfileManager (if runtime mutation matters).
- The `autoRecall` env var override was not added to cascade.ts env table in F7a — only `activeProfile` is env-configurable for now.
