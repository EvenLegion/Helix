// Simple in-memory cache for page-specific display names per session and reviewer
// Keyed by `${sessionId}:${page}` with a map of userId -> displayName

const cache = new Map<string, Map<string, string>>();

export function setPageNames(sessionId: number, page: number, names: Map<string, string>) {
  cache.set(`${sessionId}:${page}`, new Map(names));
}

export function getPageNames(sessionId: number, page: number): Map<string, string> | undefined {
  const v = cache.get(`${sessionId}:${page}`);
  return v ? new Map(v) : undefined;
}

export function clearNamesForSession(sessionId: number) {
  const prefix = `${sessionId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
