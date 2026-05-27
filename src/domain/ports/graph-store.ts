import type { Uri } from "../common/uri";
import type { Relation } from "../knowledge/model/relation";

export interface LinkResult {
  source: Uri;
  targets: Uri[];
  reason?: string;
}

export interface GraphStore {
  link(source: Uri, targets: Uri | Uri[], reason?: string): Promise<LinkResult>;
  unlink(source: Uri, target: Uri): Promise<void>;
  graph(uri: Uri): Promise<Relation[]>;
}
