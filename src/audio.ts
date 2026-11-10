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

/**
 * Small piano-like synth. iOS Safari will not make sound until `unlockSync`
 * runs inside a tap, so the app calls it on every pointerdown.
 */
export class PianoAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private primed = false;
  private voices: Voice[] = [];

  get context(): AudioContext {
    return this.ensure();
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
    this.ctx = ctx;
    this.master = master;
    return ctx;
  }

  /** Call synchronously from a user gesture. Safe to call often. */
  unlockSync(): void {
    const ctx = this.ensure();
    if (ctx.state !== 'running') void ctx.resume();
    if (this.primed) return;
    this.primed = true;
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    try {
      src.start(0);
    } catch {
      /* ignore */
    }
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
