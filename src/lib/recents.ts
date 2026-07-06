// Track recently-viewed asset ids in localStorage (most-recent first).
const KEY = 'fountain_recent_assets';
const MAX = 24;

export function pushRecent(id: string) {
  try {
    const cur = getRecents().filter((x) => x !== id);
    cur.unshift(id);
    localStorage.setItem(KEY, JSON.stringify(cur.slice(0, MAX)));
  } catch { /* ignore */ }
}
export function getRecents(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
