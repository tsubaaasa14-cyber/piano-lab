/** On-screen keyboard. Big keys for small fingers: one octave plus a bit. */
export const KEYBOARD_START = 'C4';
export const KEYBOARD_END = 'E5';

const SEMI: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface PitchParts {
  letter: string;
  accidental: '' | '#' | 'b';
  octave: number;
}

/** Kindergarten solfege colors: ド赤 レ橙 ミ黄 ファ緑 ソ青 ラ藍 シ紫. */
const SOLFEGE: Record<string, { kana: string; color: string; ink: string }> = {
  C: { kana: 'ド', color: '#FF4B4B', ink: '#ffffff' },
  D: { kana: 'レ', color: '#FF8A1E', ink: '#ffffff' },
  E: { kana: 'ミ', color: '#FFD23C', ink: '#5A3800' },
  F: { kana: 'ファ', color: '#2FBF6A', ink: '#ffffff' },
  G: { kana: 'ソ', color: '#2E96FF', ink: '#ffffff' },
  A: { kana: 'ラ', color: '#6A5CFF', ink: '#ffffff' },
  B: { kana: 'シ', color: '#C44BFF', ink: '#ffffff' },
};

const PITCH_RE = /^([A-G])([#b]?)(-?\d)$/;

export function parsePitch(pitch: string): PitchParts {
  const match = PITCH_RE.exec(pitch);
  if (!match) throw new Error(`Bad pitch: ${pitch}`);
  return {
    letter: match[1],
    accidental: (match[2] as PitchParts['accidental']) || '',
    octave: Number(match[3]),
  };
}

export function isPitch(value: string): boolean {
  return PITCH_RE.test(value);
}

export function pitchToMidi(pitch: string): number {
  const { letter, accidental, octave } = parsePitch(pitch);
  let semi = SEMI[letter];
  if (accidental === '#') semi += 1;
  if (accidental === 'b') semi -= 1;
  return (octave + 1) * 12 + semi;
}

/** Name used on the keyboard, so Bb4 lights the same key as A#4. */
export function keyboardPitch(pitch: string): string {
  return midiToPitch(pitchToMidi(pitch));
}

export function midiToPitch(midi: number): string {
  const name = NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function solfege(letter: string): { kana: string; color: string; ink: string } {
  return SOLFEGE[letter] ?? { kana: letter, color: '#8A7A70', ink: '#ffffff' };
}

export function noteLabel(pitch: string): string {
  const { letter, accidental } = parsePitch(pitch);
  const mark = accidental === '#' ? '♯' : accidental === 'b' ? '♭' : '';
  return solfege(letter).kana + mark;
}

/** Diatonic steps above the treble staff's bottom line (E4). Middle C is -2. */
export function staffStepFromE4(pitch: string): number {
  const { letter, octave } = parsePitch(pitch);
  const letterIndex = 'CDEFGAB'.indexOf(letter);
  const fromC4 = (octave - 4) * 7 + letterIndex;
  return fromC4 - 2;
}

export interface KeySpec {
  pitch: string;
  midi: number;
  letter: string;
  accidental: '' | '#' | 'b';
  label: string;
  color: string;
  ink: string;
  black: boolean;
  /** White-key index this black key sits after. Only set for black keys. */
  after?: number;
}

export function buildKeyboard(start = KEYBOARD_START, end = KEYBOARD_END): KeySpec[] {
  const from = pitchToMidi(start);
  const to = pitchToMidi(end);
  const specs: KeySpec[] = [];
  for (let midi = from; midi <= to; midi += 1) {
    const pitch = midiToPitch(midi);
    const parts = parsePitch(pitch);
    const tone = solfege(parts.letter);
    specs.push({
      pitch,
      midi,
      letter: parts.letter,
      accidental: parts.accidental,
      label: noteLabel(pitch),
      color: tone.color,
      ink: tone.ink,
      black: parts.accidental === '#',
    });
  }
  const whites = specs.filter((key) => !key.black);
  for (const key of specs) {
    if (!key.black) continue;
    let below = key.midi - 1;
    while (NAMES[below % 12].includes('#')) below -= 1;
    key.after = whites.findIndex((white) => white.midi === below);
  }
  return specs;
}

export function measureQuarterBeats(meter: [number, number]): number {
  return meter[0] * (4 / meter[1]);
}
