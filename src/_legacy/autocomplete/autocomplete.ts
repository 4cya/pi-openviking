import type { FsClient, BrowseResult } from "../ov-client/types";

interface CacheEntry {
  children: BrowseResult["children"];
  expiry: number;
}

const CACHE_TTL_MS = 30_000;

/**
 * Compute the parent URI by stripping the last path segment.
 * Returns "viking://" for root-level URIs.
 */
export function parentUri(uri: string): string {
  const trimmed = uri.replace(/\/+$/, "");
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash <= "viking://".length) {
    return "viking://";
  }
  return trimmed.slice(0, lastSlash);
}
const cache = new Map<string, CacheEntry>();

/**
 * Invalidate cached entries.
 * @param path - Specific URI path to invalidate, or omit to clear all.
 */
export function invalidateCache(path?: string): void {
  if (path === undefined) {
    cache.clear();
  } else {
    cache.delete(path);
  }
}

/**
 * Extract the URI path from text before cursor.
 * Returns null if no viking:// pattern is found.
 */
function extractVikingUri(textBeforeCursor: string): string | null {
  const match = textBeforeCursor.match(/(?:^|[ \t])viking:\/\/([^\s]*)$/);
  if (!match) return null;
  // Return the full match starting from viking://
  const fullMatch = match[0].trimStart();
  return fullMatch;
}

/**
 * Given a full viking:// URI input (e.g. "viking://user/memo"),
 * determine the parent URI to list and the partial name for filtering.
 */
function parseUriPath(input: string): { parentUri: string; partialName: string } {
  // Strip the "viking://" prefix to work with the path part
  const path = input.startsWith("viking://") ? input.slice("viking://".length) : input;

  // Find the last slash in the path
  const lastSlashIndex = path.lastIndexOf("/");

  if (lastSlashIndex === -1) {
    // No slash — we're at the root level, filtering by partial name
    return {
      parentUri: "viking://",
      partialName: path,
    };
  }

  // Has a slash — everything before the last slash is the parent dir
  // The part after the last slash is the partial name (may be empty if ends with /)
  const parentPath = path.slice(0, lastSlashIndex);
  const partialName = path.slice(lastSlashIndex + 1);

  return {
    parentUri: `viking://${parentPath}`,
    partialName,
  };
}

/**
 * Check if a URI is a child URI of a parent directory.
 * e.g., "viking://user/memories" is a child of "viking://user"
 */
function isChildOf(childUri: string, parentUri: string): boolean {
  if (childUri === parentUri) return false;
  // childUri starts with parentUri + "/" (or just parentUri + / for root)
  const prefix = parentUri.endsWith("/") ? parentUri : `${parentUri}/`;
  return childUri.startsWith(prefix);
}

/**
 * Get the last segment of a viking:// URI for display/filtering.
 */
function lastSegment(uri: string): string {
  const trimmed = uri.replace(/\/$/, "");
  const parts = trimmed.split("/");
  return parts[parts.length - 1] ?? "";
}

/**
 * Create an autocomplete provider stacked on top of the built-in Pi provider.
 * Triggers on `viking://` URI input and recursively enumerates path segments.
 *
 * @param fsClient - The OV filesystem client for listing directories.
 * @returns A factory function that wraps the current built-in provider.
 */
export function createAutocompleteProvider(
  fsClient: FsClient,
): (current: import("@earendil-works/pi-tui").AutocompleteProvider) => import("@earendil-works/pi-tui").AutocompleteProvider {
  return (current) => ({
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const line = lines[cursorLine] ?? "";
      const textBeforeCursor = line.slice(0, cursorCol);

      const vikingInput = extractVikingUri(textBeforeCursor);
      if (!vikingInput) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      if (options.signal.aborted) return null;

      const { parentUri, partialName } = parseUriPath(vikingInput);

      // Check cache
      const cached = cache.get(parentUri);
      let children: BrowseResult["children"];
      if (cached && cached.expiry > Date.now()) {
        children = cached.children;
      } else {
        try {
          const result = await fsClient.fsList(parentUri, options.signal);
          if (options.signal.aborted) return null;
          children = result.children;
          cache.set(parentUri, {
            children,
            expiry: Date.now() + CACHE_TTL_MS,
          });
        } catch {
          return null;
        }
      }

      // Filter children by partial name
      const matched = children.filter((child) => {
        const name = lastSegment(child.uri);
        return name.startsWith(partialName);
      });

      const items = matched.map((child) => ({
        value: child.uri,
        label: child.uri,
        description: child.type ?? "unknown",
      }));

      return {
        prefix: vikingInput,
        items,
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  });
}
