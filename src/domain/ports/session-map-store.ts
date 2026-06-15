/**
 * SessionMapStore port.
 *
 * Persists the Pi↔OV session mapping across restarts.
 * Stores a JSON object keyed by Pi session identifier (e.g. session file path),
 * with per-session metadata including OV session ID, synced message keys,
 * last commit time, and in-flight commit status.
 */
export interface SessionMeta {
  ovSessionId: string;
  syncedMessageKeys: string[];
  lastCommitTime?: number;
  commitInFlight?: boolean;
}

export interface SessionMapStore {
  load(): Promise<Record<string, SessionMeta>>;
  save(map: Record<string, SessionMeta>): Promise<void>;
}
