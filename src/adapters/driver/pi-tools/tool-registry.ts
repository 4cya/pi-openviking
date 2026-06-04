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
import type { WriteService } from "../../../domain/services/write-service";
import type { ReadService } from "../../../domain/services/read-service";
import type { RecallService } from "../../../domain/recall/recall-service";
import type { FsService } from "../../../domain/services/fs-service";
import type { ResourceService } from "../../../domain/services/resource-service";
import type { Logger } from "../../../domain/ports/logger";

export interface ToolServices {
  searchService: SearchService;
  writeService: WriteService;
  readService: ReadService;
  recallService: RecallService;
  fsService: FsService;
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
  pi.registerTool(createOvWriteTool(svcs.writeService, writePipeline as any));

  const readPipeline = new Pipeline();
  readPipeline.use(loggingMiddleware("read", logger));
  pi.registerTool(createOvReadTool(svcs.readService, readPipeline as any));

  const recallPipeline = new Pipeline();
  recallPipeline.use(loggingMiddleware("recall", logger));
  pi.registerTool(createOvRecallTool(svcs.recallService, recallPipeline as any));

  const listPipeline = new Pipeline();
  listPipeline.use(loggingMiddleware("list", logger));
  pi.registerTool(createOvListTool(svcs.fsService, listPipeline as any));

  const treePipeline = new Pipeline();
  treePipeline.use(loggingMiddleware("tree", logger));
  pi.registerTool(createOvTreeTool(svcs.fsService, treePipeline as any));

  const statPipeline = new Pipeline();
  statPipeline.use(loggingMiddleware("stat", logger));
  pi.registerTool(createOvStatTool(svcs.fsService, statPipeline as any));

  const deletePipeline = new Pipeline();
  deletePipeline.use(loggingMiddleware("delete", logger));
  pi.registerTool(createOvDeleteTool(svcs.fsService, deletePipeline as any));

  const resourcePipeline = new Pipeline();
  resourcePipeline.use(loggingMiddleware("resource", logger));
  pi.registerTool(createOvResourceTool(svcs.writeService, resourcePipeline as any));

  const skillPipeline = new Pipeline();
  skillPipeline.use(loggingMiddleware("skill", logger));
  pi.registerTool(createOvSkillTool(svcs.writeService, skillPipeline as any));

  const importPipeline = new Pipeline();
  importPipeline.use(loggingMiddleware("import", logger));
  pi.registerTool(createOvImportTool(svcs.resourceService, importPipeline as any));
}
