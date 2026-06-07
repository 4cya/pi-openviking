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
import { createOvSessionTool } from "./ov-session";
import type { SearchResult } from "../../../domain/knowledge/model/search-result";
import type { GlobResult, GrepResult } from "../../../domain/ports/knowledge-base";
import type { Content, FsEntry } from "../../../domain/ports/fs-store";
import type { RecallResult } from "../../../domain/recall/recall-service";
import type { AddSkillResult } from "../../../domain/ports/skill-store";
import type { SearchService } from "../../../domain/services/search-service";
import type { FsStoreService } from "../../../domain/services/fs-store-service";
import type { RecallService } from "../../../domain/recall/recall-service";
import type { ResourceService } from "../../../domain/services/resource-service";
import type { SkillService } from "../../../domain/services/skill-service";
import type { SessionService } from "../../../domain/services/session-service";
import type { SessionInfo } from "../../../domain/ports/session-store";
import type { Logger } from "../../../domain/ports/logger";

export interface ToolServices {
  searchService: SearchService;
  fsStoreService: FsStoreService;
  recallService: RecallService;
  resourceService: ResourceService;
  skillService: SkillService;
  sessionService: SessionService;
}

export function registerAllTools(pi: ExtensionAPI, svcs: ToolServices, logger: Logger): void {
  const searchPipeline = new Pipeline<SearchResult>();
  searchPipeline.use(loggingMiddleware("search", logger));
  pi.registerTool(createOvSearchTool(svcs.searchService, searchPipeline));

  const globPipeline = new Pipeline<GlobResult>();
  globPipeline.use(loggingMiddleware("glob", logger));
  pi.registerTool(createOvGlobTool(svcs.searchService, globPipeline));

  const grepPipeline = new Pipeline<GrepResult>();
  grepPipeline.use(loggingMiddleware("grep", logger));
  pi.registerTool(createOvGrepTool(svcs.searchService, grepPipeline));

  const writePipeline = new Pipeline<unknown>();
  writePipeline.use(loggingMiddleware("write", logger));
  pi.registerTool(createOvWriteTool(svcs.fsStoreService, writePipeline));

  const readPipeline = new Pipeline<Content>();
  readPipeline.use(loggingMiddleware("read", logger));
  pi.registerTool(createOvReadTool(svcs.fsStoreService, readPipeline));

  const recallPipeline = new Pipeline<RecallResult>();
  recallPipeline.use(loggingMiddleware("recall", logger));
  pi.registerTool(createOvRecallTool(svcs.recallService, recallPipeline));

  const listPipeline = new Pipeline<FsEntry[]>();
  listPipeline.use(loggingMiddleware("list", logger));
  pi.registerTool(createOvListTool(svcs.fsStoreService, listPipeline));

  const treePipeline = new Pipeline<FsEntry[]>();
  treePipeline.use(loggingMiddleware("tree", logger));
  pi.registerTool(createOvTreeTool(svcs.fsStoreService, treePipeline));

  const statPipeline = new Pipeline<FsEntry>();
  statPipeline.use(loggingMiddleware("stat", logger));
  pi.registerTool(createOvStatTool(svcs.fsStoreService, statPipeline));

  const deletePipeline = new Pipeline<void>();
  deletePipeline.use(loggingMiddleware("delete", logger));
  pi.registerTool(createOvDeleteTool(svcs.fsStoreService, deletePipeline));

  const resourcePipeline = new Pipeline<unknown>();
  resourcePipeline.use(loggingMiddleware("resource", logger));
  pi.registerTool(createOvResourceTool(svcs.fsStoreService, resourcePipeline));

  const skillPipeline = new Pipeline<AddSkillResult>();
  skillPipeline.use(loggingMiddleware("skill", logger));
  pi.registerTool(createOvSkillTool(svcs.skillService, skillPipeline));

  const importPipeline = new Pipeline<unknown>();
  importPipeline.use(loggingMiddleware("import", logger));
  pi.registerTool(createOvImportTool(svcs.resourceService, importPipeline));

  const sessionPipeline = new Pipeline<SessionInfo>();
  sessionPipeline.use(loggingMiddleware("session", logger));
  pi.registerTool(createOvSessionTool(svcs.sessionService, sessionPipeline));
}
