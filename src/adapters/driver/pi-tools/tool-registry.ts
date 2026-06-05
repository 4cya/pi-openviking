import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Pipeline } from "../../../domain/pipeline/pipeline";
import { loggingMiddleware } from "../../../domain/pipeline/logging-middleware";
import { createOvSearchTool } from "./ov-search";
import { createOvGlobTool } from "./ov-glob";
import { createOvGrepTool } from "./ov-grep";
import { createOvWriteTool } from "./ov-write";
import { createOvReadTool } from "./ov-read";
import { createOvRecallTool } from "./ov-recall";
import { createOvListTool } from "./ov-list";
import { createOvTreeTool } from "./ov-tree";
import { createOvStatTool } from "./ov-stat";
import { createOvDeleteTool } from "./ov-delete";
import { createOvResourceTool } from "./ov-resource";
import { createOvSkillTool } from "./ov-skill";
import { createOvImportTool } from "./ov-import";
import type { SearchService } from "../../../domain/services/search-service";
import type { FsStoreService } from "../../../domain/services/fs-store-service";
import type { RecallService } from "../../../domain/recall/recall-service";
import type { ResourceService } from "../../../domain/services/resource-service";
import type { Logger } from "../../../domain/ports/logger";

export interface ToolServices {
  searchService: SearchService;
  fsStoreService: FsStoreService;
  recallService: RecallService;
  resourceService: ResourceService;
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
  pi.registerTool(createOvWriteTool(svcs.fsStoreService, writePipeline as any));

  const readPipeline = new Pipeline();
  readPipeline.use(loggingMiddleware("read", logger));
  pi.registerTool(createOvReadTool(svcs.fsStoreService, readPipeline as any));

  const recallPipeline = new Pipeline();
  recallPipeline.use(loggingMiddleware("recall", logger));
  pi.registerTool(createOvRecallTool(svcs.recallService, recallPipeline as any));

  const listPipeline = new Pipeline();
  listPipeline.use(loggingMiddleware("list", logger));
  pi.registerTool(createOvListTool(svcs.fsStoreService, listPipeline as any));

  const treePipeline = new Pipeline();
  treePipeline.use(loggingMiddleware("tree", logger));
  pi.registerTool(createOvTreeTool(svcs.fsStoreService, treePipeline as any));

  const statPipeline = new Pipeline();
  statPipeline.use(loggingMiddleware("stat", logger));
  pi.registerTool(createOvStatTool(svcs.fsStoreService, statPipeline as any));

  const deletePipeline = new Pipeline();
  deletePipeline.use(loggingMiddleware("delete", logger));
  pi.registerTool(createOvDeleteTool(svcs.fsStoreService, deletePipeline as any));

  const resourcePipeline = new Pipeline();
  resourcePipeline.use(loggingMiddleware("resource", logger));
  pi.registerTool(createOvResourceTool(svcs.fsStoreService, resourcePipeline as any));

  const skillPipeline = new Pipeline();
  skillPipeline.use(loggingMiddleware("skill", logger));
  pi.registerTool(createOvSkillTool(svcs.fsStoreService, skillPipeline as any));

  const importPipeline = new Pipeline();
  importPipeline.use(loggingMiddleware("import", logger));
  pi.registerTool(createOvImportTool(svcs.resourceService, importPipeline as any));
}
