import type { Song } from './types';
import { noteIndexAt } from './timeline';

/** YouTube's IFrame player reports this while the video is actually playing. */
const YT_PLAYING = 1;
const YT_ENDED = 0;

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  destroy: () => void;
}

interface YTPlayerOptions {
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: Element, options: YTPlayerOptions) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube API failed to load'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

function embedSrc(id: string, autoplay: boolean, start: number): string {
  const origin = window.location.origin;
  const params = new URLSearchParams({
    enablejsapi: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    fs: '0',
    origin,
  });
  if (autoplay) {
    params.set('autoplay', '1');
    params.set('start', String(Math.floor(start)));
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

function makeIframe(song: Song, autoplay: boolean, start: number): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.title = song.title;
  iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
  iframe.setAttribute('playsinline', '1');
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.src = embedSrc(song.youtubeId ?? '', autoplay, start);
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  return iframe;
}

/**
 * Official video for one song.
 * The iframe is created up front. Playback starts only from a tap, with
 * playsinline set so iPad Safari stays in the page instead of going fullscreen.
 * Highlights read player.getCurrentTime() rather than the Web Audio clock.
 */
export class OriginalVideo {
  private player: YTPlayer | null = null;
  private ready = false;
  private generation = 0;
  private raf = 0;
  private followToken = 0;

  onIndex: (index: number | null) => void = () => {};
  onState: (playing: boolean) => void = () => {};

  constructor(
    private host: HTMLElement,
    private song: Song,
  ) {}

  load(): void {
    const id = this.song.youtubeId;
    if (!id) return;
    const generation = ++this.generation;
    this.ready = false;
    const iframe = makeIframe(this.song, false, this.song.startSec ?? 0);
    this.host.replaceChildren(iframe);
    void this.attach(iframe, generation, false);
  }

  /**
   * Start at the chorus. Call this directly inside touchend or click.
   * If the API is not ready, the iframe src is set to autoplay during this
   * same turn, which is the gesture iPad Safari will honor.
   */
  playFromGesture(): void {
    const start = this.song.startSec ?? 0;
    if (!this.ready || !this.can('seekTo') || !this.can('playVideo')) {
      this.playByReloading(start);
      return;
    }
    try {
      this.player?.seekTo(start, true);
      this.player?.playVideo();
    } catch (error) {
      console.error(error);
      this.playByReloading(start);
      return;
    }
    this.onState(true);
    this.follow();
  }

  pause(): void {
    this.followToken += 1;
    cancelAnimationFrame(this.raf);
    if (this.can('pauseVideo')) {
      try {
        this.player?.pauseVideo();
      } catch (error) {
        console.error(error);
      }
    }
    this.onIndex(null);
    this.onState(false);
  }

  destroy(): void {
    this.followToken += 1;
    cancelAnimationFrame(this.raf);
    this.generation += 1;
    if (this.can('destroy')) {
      try {
        this.player?.destroy();
      } catch (error) {
        console.error(error);
      }
    }
    this.player = null;
    this.ready = false;
    this.host.replaceChildren();
  }

  private can(method: keyof YTPlayer): boolean {
    const player = this.player as YTPlayer | null;
    return !!player && typeof player[method] === 'function';
  }

  private playByReloading(start: number): void {
    const generation = ++this.generation;
    this.ready = false;
    try {
      this.player?.destroy();
    } catch (error) {
      console.error(error);
    }
    this.player = null;
    const iframe = makeIframe(this.song, true, start);
    this.host.replaceChildren(iframe);
    this.onState(true);
    void this.attach(iframe, generation, true);
  }

  private async attach(iframe: HTMLIFrameElement, generation: number, seek: boolean): Promise<void> {
    try {
      await loadYouTubeApi();
    } catch (error) {
      console.error(error);
      return;
    }
    if (generation !== this.generation || !window.YT || !iframe.isConnected) return;
    const start = this.song.startSec ?? 0;
    this.player = new window.YT.Player(iframe, {
      events: {
        onReady: (event) => {
          if (generation !== this.generation) return;
          this.player = event.target;
          this.ready = true;
          if (!seek) return;
          const slipped = start - Math.floor(start);
          if (slipped > 0.05 && typeof event.target.seekTo === 'function') event.target.seekTo(start, true);
          this.follow();
        },
        onError: () => {
          if (generation !== this.generation) return;
          this.followToken += 1;
          cancelAnimationFrame(this.raf);
          this.onIndex(null);
          this.onState(false);
        },
        onStateChange: (event) => {
          if (generation !== this.generation) return;
          if (event.data === YT_ENDED) {
            this.followToken += 1;
            cancelAnimationFrame(this.raf);
            this.onIndex(null);
            this.onState(false);
            return;
          }
          const playing = event.data === YT_PLAYING;
          this.onState(playing);
          if (playing) this.follow();
        },
      },
    });
  }

  private follow(): void {
    const token = ++this.followToken;
    const loop = () => {
      if (token !== this.followToken) return;
      let time = Number.NaN;
      try {
        time = this.player?.getCurrentTime() ?? Number.NaN;
      } catch {
        time = Number.NaN;
      }
      if (Number.isFinite(time)) this.onIndex(noteIndexAt(this.song, time));
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }
}
