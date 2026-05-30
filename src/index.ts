import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { init } from "./infrastructure/lifecycle";
import { Pipeline } from "./domain/pipeline/pipeline";
import { loggingMiddleware } from "./domain/pipeline/logging-middleware";
import { SearchService } from "./domain/services/search-service";
import { createOvSearchTool } from "./adapters/driver/pi-tools/ov-search";
import { createOvGlobTool } from "./adapters/driver/pi-tools/ov-glob";
import { createOvGrepTool } from "./adapters/driver/pi-tools/ov-grep";
import type { KnowledgeBase } from "./domain/ports/knowledge-base";
import type { SearchResult } from "./domain/knowledge/model/search-result";
import type { GlobResult, GrepResult } from "./domain/ports/knowledge-base";
import type { Logger } from "./domain/ports/logger";

export default async function openVikingExtension(pi: ExtensionAPI): Promise<void> {
  pi.on("session_start", async (_event, ctx) => {
    const { config, logger, container } = await init(ctx.cwd);

    const kb = container.resolve<KnowledgeBase>("knowledgeBase");
    const typedLogger = container.resolve<Logger>("logger");
    const searchService = new SearchService(kb, config.recall, typedLogger);

    // Pipelines per tool type
    const searchPipeline = new Pipeline<SearchResult>();
    searchPipeline.use(loggingMiddleware("search", typedLogger));

    const globPipeline = new Pipeline<GlobResult>();
    globPipeline.use(loggingMiddleware("glob", typedLogger));

    const grepPipeline = new Pipeline<GrepResult>();
    grepPipeline.use(loggingMiddleware("grep", typedLogger));

    // Register tools
    pi.registerTool(createOvSearchTool(searchService, searchPipeline));
    pi.registerTool(createOvGlobTool(searchService, globPipeline));
    pi.registerTool(createOvGrepTool(searchService, grepPipeline));
  });
}
