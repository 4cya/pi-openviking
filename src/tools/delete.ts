import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ToolRegisterDeps } from "../shared/tool-def";
import { defineTool } from "../shared/tool-def";

const MEMDELETE_PARAMS = Type.Object({
  uri: Type.String({ description: "viking:// URI to delete" }),
});

export function registerMemdeleteTool(pi: ExtensionAPI, deps: ToolRegisterDeps) {
  defineTool(pi, deps, {
    name: "memdelete",
    label: "Memory Delete",
    description:
      "Delete a resource or directory from the OpenViking knowledge base by viking:// URI. " +
      "OV rm is idempotent — calling again on the same URI succeeds silently.",
    promptSnippet: "Delete a resource from OpenViking by viking:// URI",
    parameters: MEMDELETE_PARAMS,
    validateUri: true,

    async execute({ params, deps, signal }) {
      const result = await deps.knowledge.verifiedDelete(params.uri, signal);
      const text = result.verified
        ? `Deleted: ${result.uri}`
        : `Deleted: ${result.uri} (warning: resource may still appear in search due to async index sync)`;
      return { text, details: { uri: result.uri, verified: result.verified } };
    },
  });
}
