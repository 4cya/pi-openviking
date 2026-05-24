import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ToolRegisterDeps } from "../shared/tool-def";
import { defineTool } from "../shared/tool-def";
import { renderGenericCall, renderGenericResult } from "../shared/render";
import { browseOp } from "../operations/browse";
import { formatBrowse } from "../shared/format-browse";

const MEMBROWSE_PARAMS = Type.Object({
  uri: Type.String({ description: "viking:// URI to browse" }),
  view: Type.Optional(Type.Union([
    Type.Literal("list"),
    Type.Literal("tree"),
    Type.Literal("stat"),
  ], { description: "Browse view", default: "list" })),
  recursive: Type.Optional(Type.Boolean({ description: "List all descendants recursively" })),
  simple: Type.Optional(Type.Boolean({ description: "Return URI-only output" })),
});

export function registerMembrowseTool(pi: ExtensionAPI, deps: ToolRegisterDeps) {
  defineTool(pi, deps, {
    name: "membrowse",
    label: "Memory Browse",
    description:
      "Browse the OpenViking filesystem at a viking:// URI. " +
      "Use after memsearch to explore directories or inspect file metadata.",
    promptSnippet: "Browse the OpenViking filesystem at a viking:// URI",
    parameters: MEMBROWSE_PARAMS,
    validateUri: true,
    renderCall: (args: any, theme: any) => renderGenericCall("membrowse", args, theme),
    renderResult: renderGenericResult as any,

    async execute({ params, deps, signal }) {
      const result = await browseOp(deps.fs, {
        uri: params.uri,
        view: params.view ?? "list",
        recursive: params.recursive,
        simple: params.simple,
      }, signal);

      const text = formatBrowse(result, params.view ?? "list");
      return { text };
    },
  });
}
