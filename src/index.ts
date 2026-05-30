import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { init } from "./infrastructure/lifecycle";
import { Pipeline } from "./domain/pipeline/pipeline";
import { loggingMiddleware } from "./domain/pipeline/logging-middleware";
import { SearchService } from "./domain/services/search-service";
import { WriteService } from "./domain/services/write-service";
import { ReadService } from "./domain/services/read-service";
import { createOvSearchTool } from "./adapters/driver/pi-tools/ov-search";
import { createOvGlobTool } from "./adapters/driver/pi-tools/ov-glob";
import { createOvGrepTool } from "./adapters/driver/pi-tools/ov-grep";
import { createOvWriteTool } from "./adapters/driver/pi-tools/ov-write";
import { createOvReadTool } from "./adapters/driver/pi-tools/ov-read";
import { createOvRecallTool } from "./adapters/driver/pi-tools/ov-recall";
import type { KnowledgeBase } from "./domain/ports/knowledge-base";
import type { FsStore } from "./domain/ports/fs-store";
import type { Content } from "./domain/ports/fs-store";
import type { SearchResult } from "./domain/knowledge/model/search-result";
import type { GlobResult, GrepResult } from "./domain/ports/knowledge-base";
import type { Logger } from "./domain/ports/logger";
import { RecallService, type RecallResult } from "./domain/recall/recall-service";
import { RecallCurator } from "./domain/recall/recall-curator";

export default async function openVikingExtension(pi: ExtensionAPI): Promise<void> {
  pi.on("session_start", async (_event, ctx) => {
    const { config, logger, container } = await init(ctx.cwd);

    const kb = container.resolve<KnowledgeBase>("knowledgeBase");
    const typedLogger = container.resolve<Logger>("logger");
    const searchService = new SearchService(kb, config.recall, typedLogger);

    const fsStore = container.resolve<FsStore>("fsStore");
    const writeService = new WriteService(fsStore);
    const readService = new ReadService(fsStore);

    // Pipelines per tool type
    const searchPipeline = new Pipeline<SearchResult>();
    searchPipeline.use(loggingMiddleware("search", typedLogger));

    const globPipeline = new Pipeline<GlobResult>();
    globPipeline.use(loggingMiddleware("glob", typedLogger));

    const grepPipeline = new Pipeline<GrepResult>();
    grepPipeline.use(loggingMiddleware("grep", typedLogger));

    // Write/read pipelines
    const writePipeline = new Pipeline<unknown>();
    writePipeline.use(loggingMiddleware("write", typedLogger));

    const readPipeline = new Pipeline<Content>();
    readPipeline.use(loggingMiddleware("read", typedLogger));

    // Register tools
    pi.registerTool(createOvSearchTool(searchService, searchPipeline));
    pi.registerTool(createOvGlobTool(searchService, globPipeline));
    pi.registerTool(createOvGrepTool(searchService, grepPipeline));
    pi.registerTool(createOvWriteTool(writeService, writePipeline));
    pi.registerTool(createOvReadTool(readService, readPipeline));

    // Recall pipeline
    const curator = new RecallCurator(config.recall, [], typedLogger);
    const recallService = new RecallService(kb, curator, config.recall, typedLogger, true);
    const recallPipeline = new Pipeline<RecallResult>();
    recallPipeline.use(loggingMiddleware("recall", typedLogger));
    pi.registerTool(createOvRecallTool(recallService, recallPipeline));
  });
}
