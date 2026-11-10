import type { PianoAudio } from './audio';
import type { Song } from './types';

export interface ScheduledNote {
  index: number;
  pitch: string | null;
  start: number;
  end: number;
}

/**
 * Plays a monophonic melody on the audio clock and reports which note is current.
 * Highlights stay locked to the sound, not to setTimeout.
 */
export class Player {
  private token = 0;
  private raf = 0;
  private timeline: ScheduledNote[] = [];

  onIndex: (index: number | null) => void = () => {};
  onState: (playing: boolean) => void = () => {};

  constructor(private audio: PianoAudio) {}

  start(song: Song): void {
    this.stop();
    let ctx: AudioContext;
    try {
      // resume() has to start on this stack, before any await.
      this.audio.unlockSync();
      ctx = this.audio.context;
    } catch (error) {
      console.error(error);
      return;
    }

    const token = ++this.token;
    const begin = () => {
      if (token !== this.token || ctx.state !== 'running') return;
      const beat = 60 / song.bpm;
      const start = ctx.currentTime + 0.12;
      let time = start;
      this.timeline = song.melody.map((note, index) => {
        const dur = note.beats * beat;
        if (note.pitch) {
          const sound = Math.max(0.12, dur - 0.05);
          this.audio.play(note.pitch, time, sound, 'song');
        }
        const item = { index, pitch: note.pitch, start: time, end: time + dur };
        time += dur;
        return item;
      });
      const end = time;
      this.onState(true);

      const loop = () => {
        if (token !== this.token) return;
        const now = ctx.currentTime;
        let current: number | null = null;
        for (const item of this.timeline) {
          if (now >= item.start && now < item.end) {
            current = item.index;
            break;
          }
        }
        this.onIndex(current);
        if (ctx.state !== 'running') {
          this.raf = requestAnimationFrame(loop);
          return;
        }
        if (now < end + 0.02) {
          this.raf = requestAnimationFrame(loop);
          return;
        }
        this.token += 1;
        this.onIndex(null);
        this.onState(false);
      };
      this.raf = requestAnimationFrame(loop);
    };

    if (ctx.state === 'running') begin();
    else void ctx.resume().then(begin);
  }

  stop(): void {
    this.token += 1;
    cancelAnimationFrame(this.raf);
    this.audio.stopOwner('song');
    this.timeline = [];
    this.onIndex(null);
    this.onState(false);
  }
}
