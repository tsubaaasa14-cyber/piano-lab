/**
 * Song data is plain JSON so a later step can drop in melodies from search
 * or audio extraction without changing the player.
 *
 * Rules for generated songs:
 * - One hand, one note at a time (no chords). Put a rest (`pitch: null`) instead of harmony.
 * - `beats` is always in quarter-note lengths, whatever `meter` says.
 * - Stay near middle C. The on-screen keyboard is C4–E5; other pitches still
 *   play and show on the staff, but no key lights up.
 */
export interface MelodyNote {
  /** Scientific pitch such as "C4", "F#4", or "Bb4". Null is a rest. */
  pitch: string | null;
  /** Duration in quarter notes. 1 quarter, 2 half, 1.5 dotted quarter, 3 dotted half, 4 whole. */
  beats: number;
}

export interface SongOrigin {
  /** `builtin` for the songs shipped here. Later: `search` or `extraction`. */
  type: 'builtin' | 'search' | 'extraction';
  /** Search query, file name, or a short source label. */
  label?: string;
  sourceUrl?: string;
}

export interface Song {
  id: string;
  /** Shown for a parent. Children pick the picture, not the words. */
  title: string;
  /**
   * Built-in picture id: "star", "frog", or "tulip".
   * Anything else falls back to the star, so generated songs still render.
   */
  picture: string;
  /** Card color as a #RRGGBB hex. */
  accent: string;
  /** Quarter-note tempo. */
  bpm: number;
  /** [beats per bar, beat unit]. Beat unit 4 = quarter note, as in 4/4. */
  meter: [number, number];
  melody: MelodyNote[];
  origin: SongOrigin;
}
