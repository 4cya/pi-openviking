import type { FsClient, BrowseResult } from "../ov-client/client";

export interface BrowseOpOpts {
  uri: string;
  view?: "list" | "tree" | "stat";
  recursive?: boolean;
  simple?: boolean;
}

export async function browseOp(
  fs: FsClient,
  opts: BrowseOpOpts,
  signal?: AbortSignal,
): Promise<BrowseResult> {
  switch (opts.view ?? "list") {
    case "tree":
      return fs.fsTree(opts.uri, signal);
    case "stat":
      return fs.fsStat(opts.uri, signal);
    default:
      return fs.fsList(opts.uri, signal, opts.recursive, opts.simple);
  }
}
