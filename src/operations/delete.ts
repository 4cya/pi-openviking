import type { KnowledgeClient, DeleteResult } from "../ov-client/client";

export interface DeleteOpOpts {
  uri: string;
}

export async function deleteOp(
  knowledge: KnowledgeClient,
  opts: DeleteOpOpts,
  signal?: AbortSignal,
): Promise<DeleteResult> {
  return knowledge.verifiedDelete(opts.uri, signal);
}
