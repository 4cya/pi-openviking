# ADR-010: Manual DI container over Awilix

Use a hand-rolled DI container (21 lines, `register(token, factory, singleton)` + `resolve<T>(token)`) instead of Awilix.

**Context:** Current init() registers 17 singletons: config, logger, adapter, knowledgeBase, fsStore, graphStore, sessionStore, resourceStore, skillStore, profileManager, graphExpander (conditional), recallCurator, sessionService, recallService, searchService, fsStoreService, repoContext (F1–F7b). At ADR writing (F1–F4) there were 10. No circular dependencies exist and none are expected.

**Considered Options:**

- **Awilix** — 25KB bundle, class-based resolution, lifetime scopes, complex error messages. Adds a dependency (even if transitive through `@earendil-works/pi-ai`) that the domain shouldn't know about.
- **Manual container (chosen)** — zero external deps, 21 lines, trivial to debug (`throw new Error('missing token')` is the only failure mode). 4 tests cover registration, singleton, factory, and missing-token.
- **No DI at all** — modules import constructors directly. Works for 5 modules, but fails at ~8+ when construction order and test isolation become manual burden.

**Consequences:** Manual container lacks lifecycle scopes (transient/request). Not a problem until OV adapter needs per-request caching — revisit with Awilix if registration count exceeds 15 or circular deps appear.
