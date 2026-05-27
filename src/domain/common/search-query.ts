import { Uri } from "./uri";
import { SessionId } from "./session-id";

/**
 * FindQuery: simple semantic search without session context.
 * Maps to OV POST /api/v1/search/find.
 */
export interface FindQuery {
  query: string;
  limit?: number;
  targetUri?: Uri;
}

/**
 * SearchRequest: deep search with optional session context for intent analysis.
 * Maps to OV POST /api/v1/search/search.
 */
export interface SearchRequest {
  query: string;
  limit?: number;
  sessionId?: SessionId;
  targetUri?: Uri;
}
