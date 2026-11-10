import { midiToFreq, pitchToMidi } from './pitch';

type Owner = 'song' | 'tap';

interface Voice {
  owner: Owner;
  stop: (when?: number) => void;
}

const PARTIALS = [
  { ratio: 1, gain: 0.62, decay: 1.7 },
  { ratio: 2, gain: 0.32, decay: 1.25 },
  { ratio: 3, gain: 0.16, decay: 0.85 },
  { ratio: 4, gain: 0.08, decay: 0.5 },
  { ratio: 5, gain: 0.045, decay: 0.32 },
];

type AudioSessionLike = { type: string };

/**
 * One second of almost-silent PCM. A media element on the playback route is
 * what moves iOS Web Audio off the ringer channel when audioSession is missing.
 * A few non-zero samples keep the file from being dropped as empty.
 */
function quietWavBlob(): Blob {
  const sampleRate = 8000;
  const samples = sampleRate;
  const dataBytes = samples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < 8; i += 1) view.setInt16(44 + i * 2, i % 2 === 0 ? 8 : -8, true);
  return new Blob([buffer], { type: 'audio/wav' });
}

function audioSession(): AudioSessionLike | null {
  const nav = navigator as Navigator & { audioSession?: AudioSessionLike };
  return nav.audioSession ?? null;
}

/**
 * Safari's default session type is ambient, so the iPhone silent switch and
 * iPad silent mode mute Web Audio. `playback` uses the media route instead.
 * Set it as early as possible, and again inside the tap that starts sound.
 */
export function routeToPlayback(): void {
  const session = audioSession();
  if (!session) return;
  try {
    session.type = 'playback';
  } catch (error) {
    console.error(error);
  }
}

/**
 * Small piano-like synth.
 * Call `unlockSync` synchronously from click or touchend. pointerdown alone
 * is not a reliable user activation on every iOS version, and preventDefault
 * on that event can drop the activation.
 */
export class PianoAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private keeper: HTMLAudioElement | null = null;
  private touched = false;
  private voices: Voice[] = [];
  private statusListeners = new Set<() => void>();

  constructor() {
    routeToPlayback();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !this.touched) return;
      routeToPlayback();
      if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
      this.keepAlive();
      this.emitStatus();
    });
  }

  get context(): AudioContext {
    return this.ensure();
  }

  /** `running` means the context is open. The silent switch is handled separately. */
  outputReady(): boolean {
    return this.ctx?.state === 'running';
  }

  stateName(): string {
    return this.ctx?.state ?? 'idle';
  }

  onStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio is not available');
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.85;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 5200;
    filter.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    master.connect(filter);
    filter.connect(comp);
    comp.connect(ctx.destination);
    ctx.addEventListener('statechange', () => this.emitStatus());
    this.ctx = ctx;
    this.master = master;
    this.emitStatus();
    return ctx;
  }

  /**
   * Call synchronously from a user gesture (click or touchend).
   * Safe to call on every tap. Also recovers `interrupted` after backgrounding.
   */
  unlockSync(): void {
    this.touched = true;
    routeToPlayback();
    const ctx = this.ensure();
    this.keepAlive();
    if (ctx.state !== 'running') void ctx.resume();
    this.emitStatus();
  }

  play(pitch: string, when: number, duration: number, owner: Owner): void {
    const ctx = this.ensure();
    const dest = this.master;
    if (!dest) return;
    const freq = midiToFreq(pitchToMidi(pitch));
    const start = Math.max(when, ctx.currentTime + 0.005);
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(1, start);
    voiceGain.connect(dest);

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.Q.value = 0.6;
    tone.frequency.setValueAtTime(Math.min(4800, freq * 7), start);
    tone.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 2.2), start + Math.min(0.45, duration));
    tone.connect(voiceGain);

    const stopAt = start + duration + 0.45;
    for (const partial of PARTIALS) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const inharm = 1 + partial.ratio * partial.ratio * 0.00012;
      osc.frequency.setValueAtTime(freq * partial.ratio * inharm, start);
      const gain = ctx.createGain();
      const peak = Math.max(0.0001, partial.gain * 0.28);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(peak * 0.45, start + 0.09);
      const release = Math.max(0.18, Math.min(partial.decay, duration + 0.35));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + release);
      osc.connect(gain);
      gain.connect(tone);
      osc.start(start);
      osc.stop(stopAt);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = Math.min(3200, freq * 3);
    band.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.18, start + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
    noise.connect(band);
    band.connect(noiseGain);
    noiseGain.connect(voiceGain);
    noise.start(start);
    noise.stop(start + 0.06);

    const voice: Voice = {
      owner,
      stop: (at?: number) => {
        const t = Math.max(at ?? ctx.currentTime, ctx.currentTime);
        try {
          voiceGain.gain.cancelScheduledValues(t);
          const current = Math.max(voiceGain.gain.value, 0.0001);
          voiceGain.gain.setValueAtTime(current, t);
          voiceGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        } catch {
          /* node already closed */
        }
      },
    };
    this.voices.push(voice);
    const aliveMs = (stopAt - ctx.currentTime) * 1000 + 80;
    window.setTimeout(() => {
      this.voices = this.voices.filter((item) => item !== voice);
    }, Math.max(0, aliveMs));
    this.trim();
  }

  stopOwner(owner: Owner): void {
    for (const voice of this.voices) {
      if (voice.owner === owner) voice.stop();
    }
    this.voices = this.voices.filter((voice) => voice.owner !== owner);
  }

  private trim(): void {
    const taps = this.voices.filter((voice) => voice.owner === 'tap');
    const extra = taps.length - 10;
    if (extra <= 0) return;
    for (const voice of taps.slice(0, extra)) voice.stop();
  }

  private keepAlive(): void {
    if (!this.keeper) {
      const el = document.createElement('audio');
      el.className = 'ios-keep-alive';
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.loop = true;
      el.preload = 'auto';
      el.src = URL.createObjectURL(quietWavBlob());
      document.body.append(el);
      this.keeper = el;
    }
    this.keeper.volume = 0.01;
    const pending = this.keeper.play();
    if (pending) pending.catch(() => {});
  }

  private emitStatus(): void {
    for (const listener of this.statusListeners) listener();
  }

  private noiseBuffer(): AudioBuffer {
    const ctx = this.ensure();
    if (this.noise) return this.noise;
    const length = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }
}
