import { Uri } from "./uri";
import { SessionId } from "./session-id";

export type SearchMode = "auto" | "fast" | "deep";

export interface SearchQuery {
  query: string;
  limit?: number;
  mode?: SearchMode;
  targetUri?: Uri;
  sessionId?: SessionId;
}
