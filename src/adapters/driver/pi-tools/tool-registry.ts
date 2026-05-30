import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Pipeline } from "../../../domain/pipeline/pipeline";
import { loggingMiddleware } from "../../../domain/pipeline/logging-middleware";
import { createOvSearchTool } from "./ov-search";
import { createOvGlobTool } from "./ov-glob";
import { createOvGrepTool } from "./ov-grep";
import { createOvWriteTool } from "./ov-write";
import { createOvReadTool } from "./ov-read";
import { createOvRecallTool } from "./ov-recall";
import type { SearchService } from "../../../domain/services/search-service";
import type { WriteService } from "../../../domain/services/write-service";
import type { ReadService } from "../../../domain/services/read-service";
import type { RecallService } from "../../../domain/recall/recall-service";
import type { Logger } from "../../../domain/ports/logger";

export interface ToolServices {
  searchService: SearchService;
  writeService: WriteService;
  readService: ReadService;
  recallService: RecallService;
}

export function registerAllTools(pi: ExtensionAPI, svcs: ToolServices, logger: Logger): void {
  const searchPipeline = new Pipeline();
  searchPipeline.use(loggingMiddleware("search", logger));
  pi.registerTool(createOvSearchTool(svcs.searchService, searchPipeline as any));

  const globPipeline = new Pipeline();
  globPipeline.use(loggingMiddleware("glob", logger));
  pi.registerTool(createOvGlobTool(svcs.searchService, globPipeline as any));

  const grepPipeline = new Pipeline();
  grepPipeline.use(loggingMiddleware("grep", logger));
  pi.registerTool(createOvGrepTool(svcs.searchService, grepPipeline as any));

  const writePipeline = new Pipeline();
  writePipeline.use(loggingMiddleware("write", logger));
  pi.registerTool(createOvWriteTool(svcs.writeService, writePipeline as any));

  const readPipeline = new Pipeline();
  readPipeline.use(loggingMiddleware("read", logger));
  pi.registerTool(createOvReadTool(svcs.readService, readPipeline as any));

  const recallPipeline = new Pipeline();
  recallPipeline.use(loggingMiddleware("recall", logger));
  pi.registerTool(createOvRecallTool(svcs.recallService, recallPipeline as any));
}
