import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { defineTool } from "../shared/tool-def";
import { renderGenericCall, renderGenericResult } from "../shared/render";
import { deleteOp } from "../operations/delete";
import { RuntimeDeps } from "../bootstrap/runtime";

const MEMDELETE_PARAMS = Type.Object({
  uri: Type.String({ description: "viking:// URI to delete" }),
});

export function registerMemdeleteTool(pi: ExtensionAPI, deps: RuntimeDeps) {
  defineTool(pi, deps, {
    name: "memdelete",
    label: "Memory Delete",
    description:
      "Delete a resource or directory from the OpenViking knowledge base by viking:// URI. " +
      "OV rm is idempotent — calling again on the same URI succeeds silently.",
    promptSnippet: "Delete a resource from OpenViking by viking:// URI",
    parameters: MEMDELETE_PARAMS,
    validateUri: true,
    renderCall: (args: any, theme: any) => renderGenericCall("memdelete", args, theme),
    renderResult: renderGenericResult as any,

    async execute({ params, deps, signal }) {
      const result = await deleteOp(deps.knowledge, { uri: params.uri }, signal);
      const text = result.verified
        ? `Deleted: ${result.uri}`
        : `Deleted: ${result.uri} (warning: resource may still appear in search due to async index sync)`;
      return { text, details: { uri: result.uri, verified: result.verified } };
    },
  });
}
