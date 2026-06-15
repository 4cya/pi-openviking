import type { Uri } from "../common/uri";
import type { ContentLevel } from "../common/content-level";
import type { WriteMode } from "../common/write-mode";

export interface Content {
  uri: Uri;
  body: string;
  level?: ContentLevel;
}

export type ReindexMode = "vectors_only" | "full";

export interface WriteResult {
  uri: Uri;
  success: boolean;
}

export interface FsEntry {
  uri: Uri;
  type: "file" | "directory";
  size?: number;
  modTime?: string;
}

export interface FsStore {
  read(uri: Uri, level?: ContentLevel, offset?: number, limit?: number, signal?: AbortSignal): Promise<Content>;
  write(uri: Uri, content: string, mode?: WriteMode, signal?: AbortSignal): Promise<WriteResult>;
  list(uri: Uri, recursive?: boolean, signal?: AbortSignal): Promise<FsEntry[]>;
  tree(uri: Uri, signal?: AbortSignal): Promise<FsEntry[]>;
  stat(uri: Uri, signal?: AbortSignal): Promise<FsEntry>;
  mkdir(uri: Uri, signal?: AbortSignal): Promise<void>;
  mv(from: Uri, to: Uri, signal?: AbortSignal): Promise<void>;
  delete(uri: Uri, recursive?: boolean, signal?: AbortSignal): Promise<void>;
  reindex(uri: Uri, mode?: ReindexMode, signal?: AbortSignal): Promise<void>;
}
