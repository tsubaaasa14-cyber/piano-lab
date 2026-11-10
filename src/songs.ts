import raw from './data/songs.json';
import type { MelodyNote, Song, SongOrigin } from './types';
import { isPitch } from './pitch';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function parseOrigin(value: unknown, label: string): SongOrigin {
  if (!isRecord(value)) throw new Error(`${label} needs an origin`);
  const type = value.type;
  if (type !== 'builtin' && type !== 'search' && type !== 'extraction') {
    throw new Error(`${label} origin.type is invalid`);
  }
  const origin: SongOrigin = { type };
  if (value.label !== undefined) origin.label = requireString(value.label, `${label} origin.label`);
  if (value.sourceUrl !== undefined) origin.sourceUrl = requireString(value.sourceUrl, `${label} origin.sourceUrl`);
  return origin;
}

function parseNote(value: unknown, label: string): MelodyNote {
  if (!isRecord(value)) throw new Error(`${label} is not a note`);
  const beats = value.beats;
  if (typeof beats !== 'number' || !Number.isFinite(beats) || beats <= 0 || beats > 8) {
    throw new Error(`${label} beats must be between 0 and 8`);
  }
  if (value.pitch === null) return { pitch: null, beats };
  if (typeof value.pitch !== 'string' || !isPitch(value.pitch)) {
    throw new Error(`${label} pitch must look like C4 or F#4`);
  }
  return { pitch: value.pitch, beats };
}

function parseSong(value: unknown, index: number): Song {
  const label = `songs[${index}]`;
  if (!isRecord(value)) throw new Error(`${label} is not an object`);
  const id = requireString(value.id, `${label}.id`);
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`${label}.id must be lowercase`);
  const accent = requireString(value.accent, `${label}.accent`);
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) throw new Error(`${label}.accent must be #RRGGBB`);
  const bpm = value.bpm;
  if (typeof bpm !== 'number' || bpm < 40 || bpm > 200) throw new Error(`${label}.bpm out of range`);
  if (!Array.isArray(value.meter) || value.meter.length !== 2) throw new Error(`${label}.meter is invalid`);
  const [beatsPerBar, unit] = value.meter;
  if (typeof beatsPerBar !== 'number' || typeof unit !== 'number') throw new Error(`${label}.meter is invalid`);
  if (![1, 2, 4, 8, 16].includes(unit) || beatsPerBar < 1 || beatsPerBar > 16) {
    throw new Error(`${label}.meter is invalid`);
  }
  if (!Array.isArray(value.melody) || value.melody.length === 0 || value.melody.length > 512) {
    throw new Error(`${label}.melody must have 1–512 notes`);
  }
  let youtubeId: string | undefined;
  if (value.youtubeId !== undefined) {
    youtubeId = requireString(value.youtubeId, `${label}.youtubeId`);
    if (!/^[A-Za-z0-9_-]{6,16}$/.test(youtubeId)) throw new Error(`${label}.youtubeId is invalid`);
  }
  let startSec: number | undefined;
  if (value.startSec !== undefined) {
    if (typeof value.startSec !== 'number' || !Number.isFinite(value.startSec) || value.startSec < 0 || value.startSec > 1800) {
      throw new Error(`${label}.startSec is invalid`);
    }
    startSec = value.startSec;
  }
  if (youtubeId && startSec === undefined) throw new Error(`${label} with youtubeId needs startSec`);
  const aliases = value.aliases === undefined ? [] : value.aliases;
  if (!Array.isArray(aliases) || aliases.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`${label}.aliases must be non-empty strings`);
  }
  return {
    id,
    title: requireString(value.title, `${label}.title`),
    reading: requireString(value.reading, `${label}.reading`),
    romaji: requireString(value.romaji, `${label}.romaji`),
    aliases,
    emoji: requireString(value.emoji, `${label}.emoji`),
    picture: requireString(value.picture, `${label}.picture`),
    accent,
    bpm,
    meter: [beatsPerBar, unit],
    melody: value.melody.map((note, noteIndex) => parseNote(note, `${label}.melody[${noteIndex}]`)),
    origin: parseOrigin(value.origin, label),
    ...(youtubeId ? { youtubeId, startSec } : {}),
  };
}

export function loadSongs(data: unknown): Song[] {
  if (!Array.isArray(data) || data.length === 0) throw new Error('songs.json must be a non-empty array');
  const songs = data.map((item, index) => parseSong(item, index));
  const ids = new Set<string>();
  for (const song of songs) {
    if (ids.has(song.id)) throw new Error(`Duplicate song id ${song.id}`);
    ids.add(song.id);
  }
  return songs;
}

export const songs: Song[] = loadSongs(raw);

export function songById(id: string): Song | undefined {
  return songs.find((song) => song.id === id);
}
