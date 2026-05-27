import type { Uri } from "../common/uri";
import type { ContentLevel } from "../common/content-level";
import type { WriteMode } from "../common/write-mode";

export interface Content {
  uri: Uri;
  body: string;
  level?: ContentLevel;
}

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
  read(uri: Uri, level?: ContentLevel): Promise<Content>;
  write(uri: Uri, content: string, mode?: WriteMode): Promise<WriteResult>;
  list(uri: Uri, recursive?: boolean): Promise<FsEntry[]>;
  tree(uri: Uri): Promise<FsEntry[]>;
  stat(uri: Uri): Promise<FsEntry>;
  mkdir(uri: Uri): Promise<void>;
  mv(from: Uri, to: Uri): Promise<void>;
  delete(uri: Uri, recursive?: boolean): Promise<void>;
}
