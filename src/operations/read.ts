import type { FsClient } from "../ov-client/client";

export interface ReadOpOpts {
  level?: "auto" | "abstract" | "overview" | "read";
}

export async function readOp(
  fs: FsClient,
  uri: string,
  opts?: ReadOpOpts,
  signal?: AbortSignal,
): Promise<{ content: string }> {
  const level = opts?.level ?? "auto";

  let resolvedLevel = level;
  if (resolvedLevel === "auto") {
    const stat = await fs.fsStat(uri, signal);
    const entry = stat.children?.[0];
    resolvedLevel = entry?.type === "directory" ? "overview" : "read";
  }
  const result = await fs.read(uri, resolvedLevel as "abstract" | "overview" | "read", signal);
  return { content: result.content };
}
