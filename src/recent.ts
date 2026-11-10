const KEY = 'piano-lab-recent';
const MAX = 8;

export function recentIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function rememberSong(id: string): void {
  const next = [id, ...recentIds().filter((item) => item !== id)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode or a full disk */
  }
}
