import type { Song } from './types';

/** Katakana (except the long-vowel mark) to hiragana, then drop spaces and punctuation. */
export function normalizeQuery(input: string): string {
  const folded = input.normalize('NFKC').toLowerCase();
  const hiragana = folded.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  return hiragana.replace(/[\s\u3000\-ー・'’]/g, '');
}

function haystack(song: Song): string {
  return normalizeQuery([song.title, song.reading, song.romaji, ...song.aliases].join(' '));
}

export function filterSongs(songs: Song[], query: string): Song[] {
  const needle = normalizeQuery(query);
  if (!needle) return songs;
  return songs.filter((song) => haystack(song).includes(needle));
}
