import type { Song } from './types';

/**
 * Which melody note is sounding at `videoTime` seconds on the YouTube clock.
 * Note i starts at startSec + (sum of earlier beats) * (60 / bpm).
 */
export function noteIndexAt(song: Song, videoTime: number): number | null {
  if (song.startSec === undefined || !Number.isFinite(videoTime)) return null;
  const elapsed = videoTime - song.startSec;
  if (elapsed < 0) return null;
  const beat = 60 / song.bpm;
  let cursor = 0;
  for (let index = 0; index < song.melody.length; index += 1) {
    const dur = song.melody[index].beats * beat;
    if (elapsed < cursor + dur) return index;
    cursor += dur;
  }
  return null;
}
