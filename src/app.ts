import { backIcon, mascotSvg, playIcon, rotateHintSvg, speakerOffIcon, speakerOnIcon, stopIcon } from './art';
import { PianoAudio } from './audio';
import { buildKeyboard, KEYBOARD_END, KEYBOARD_START, keyboardPitch } from './pitch';
import { Player } from './player';
import { recentIds, rememberSong } from './recent';
import { renderScore, centerNote } from './score';
import { filterSongs } from './search';
import { songs } from './songs';
import type { Song } from './types';
import { OriginalVideo } from './youtube';

const keys = buildKeyboard();
const keyPitches = new Set(keys.map((key) => key.pitch));

function warnOutOfRange(song: Song): void {
  if (!import.meta.env.DEV) return;
  for (const note of song.melody) {
    if (note.pitch && !keyPitches.has(note.pitch)) {
      console.warn(`${song.id}: ${note.pitch} is outside the keyboard ${KEYBOARD_START}–${KEYBOARD_END}`);
    }
  }
}

function html(parent: HTMLElement, markup: string): void {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  const node = holder.firstElementChild;
  if (node) parent.append(node);
}

export function mount(root: HTMLElement): void {
  const audio = new PianoAudio();
  const player = new Player(audio);
  let query = '';
  let screen: { name: 'home' } | { name: 'practice'; song: Song } = { name: 'home' };
  let shown: number | null = null;
  let playing = false;
  let mode: 'piano' | 'original' = 'piano';
  let video: OriginalVideo | null = null;

  const unlock = () => {
    try {
      audio.unlockSync();
    } catch (error) {
      console.error(error);
    }
  };
  // click and touchend are the gestures iOS treats as activation. pointerdown
  // is included too, but it must not be the only one, and it must not cancel the click.
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click'] as const) {
    root.addEventListener(type, unlock, { capture: true });
  }

  const refreshSound = () => {
    const ready = audio.outputReady();
    const state = audio.stateName();
    for (const button of root.querySelectorAll<HTMLButtonElement>('.sound')) {
      button.classList.toggle('is-ready', ready);
      button.dataset.state = state;
      button.setAttribute('aria-label', ready ? 'おんがく' : 'おとをだす');
    }
  };
  audio.onStatus(refreshSound);

  function applyHighlight(index: number | null): void {
    const practice = root.querySelector('.practice');
    if (!(practice instanceof HTMLElement)) return;
    if (index == null) delete practice.dataset.noteIndex;
    else practice.dataset.noteIndex = String(index);
    practice.classList.toggle('is-playing', playing);

    for (const note of practice.querySelectorAll('.note')) {
      const noteIndex = Number(note.getAttribute('data-index'));
      note.classList.toggle('is-current', index !== null && noteIndex === index);
      note.classList.toggle('is-past', index !== null && noteIndex < index);
    }

    const pitch = index == null || screen.name !== 'practice' ? null : screen.song.melody[index]?.pitch;
    const lit = pitch ? keyboardPitch(pitch) : null;
    for (const key of practice.querySelectorAll('.key')) {
      if (!(key instanceof HTMLElement)) continue;
      const on = !!lit && key.dataset.pitch === lit;
      if (on && key.classList.contains('is-current')) {
        key.classList.remove('is-current');
        void key.offsetWidth;
      }
      key.classList.toggle('is-current', on);
    }
  }

  function scrollTo(index: number): void {
    const scroller = root.querySelector('.score-scroll');
    if (scroller instanceof HTMLElement) centerNote(scroller, index);
  }

  function setPlaying(next: boolean): void {
    playing = next;
    const practice = root.querySelector('.practice');
    const button = root.querySelector('[data-action="play"]');
    practice?.classList.toggle('is-playing', next);
    button?.classList.toggle('is-playing', next);
    if (button instanceof HTMLButtonElement) {
      button.setAttribute('aria-label', next ? 'とめる' : 'うたをならす');
      button.setAttribute('aria-pressed', next ? 'true' : 'false');
    }
  }

  function showIndex(index: number | null): void {
    if (index === shown) return;
    shown = index;
    applyHighlight(index);
    scrollTo(index ?? 0);
  }

  function setMode(next: 'piano' | 'original'): void {
    player.stop();
    video?.pause();
    mode = next;
    const practice = root.querySelector('.practice');
    if (practice instanceof HTMLElement) {
      practice.classList.toggle('is-original', next === 'original');
      practice.dataset.mode = next;
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('.mode-switch button')) {
      const on = button.dataset.action === (next === 'original' ? 'mode-original' : 'mode-piano');
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  player.onIndex = (index) => {
    if (mode !== 'piano') return;
    showIndex(index);
  };

  player.onState = (next) => {
    if (mode !== 'piano') return;
    setPlaying(next);
  };

  function songCard(song: Song): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'song-card';
    button.dataset.songId = song.id;
    button.style.setProperty('--card', song.accent);
    button.setAttribute('aria-label', song.title);
    const art = document.createElement('span');
    art.className = 'song-emoji';
    art.textContent = song.emoji;
    art.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'song-name';
    name.textContent = song.title;
    button.append(art, name);
    if (song.youtubeId) {
      const mark = document.createElement('span');
      mark.className = 'yt-mark';
      mark.textContent = '✨';
      mark.setAttribute('aria-hidden', 'true');
      button.append(mark);
    }
    return button;
  }

  function showHome(): void {
    player.stop();
    video?.destroy();
    video = null;
    mode = 'piano';
    playing = false;
    shown = null;
    screen = { name: 'home' };
    root.replaceChildren();
    const home = document.createElement('section');
    home.className = 'home picker';

    const top = document.createElement('div');
    top.className = 'picker-top';
    const brand = document.createElement('div');
    brand.className = 'home-top';
    const mascot = document.createElement('div');
    mascot.className = 'mascot';
    mascot.innerHTML = mascotSvg();
    const title = document.createElement('h1');
    title.className = 'home-title';
    title.textContent = 'ぴあの';
    brand.append(mascot, title);

    const search = document.createElement('label');
    search.className = 'search';
    const field = document.createElement('input');
    field.className = 'search-input';
    field.type = 'text';
    field.enterKeyHint = 'search';
    field.autocomplete = 'off';
    field.autocapitalize = 'off';
    field.spellcheck = false;
    field.placeholder = 'うた、かえる、kaeru';
    field.setAttribute('aria-label', 'うたをさがす');
    field.value = query;
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'search-clear';
    clear.dataset.action = 'clear';
    clear.setAttribute('aria-label', 'けす');
    clear.textContent = '×';
    search.append(field, clear);
    top.append(brand, search);

    const scroller = document.createElement('div');
    scroller.className = 'picker-scroll';
    home.append(top, scroller);
    root.append(home, soundButton(), turnHint());
    refreshSound();

    const paint = () => {
      query = field.value;
      clear.hidden = query.length === 0;
      scroller.replaceChildren();
      const needle = query.trim();
      if (!needle) {
        const recentSongs = recentIds().flatMap((id) => {
          const song = songs.find((item) => item.id === id);
          return song ? [song] : [];
        });
        if (recentSongs.length > 0) {
          const block = document.createElement('div');
          block.className = 'recent';
          const heading = document.createElement('h2');
          heading.className = 'recent-title';
          heading.textContent = 'このまえ';
          const row = document.createElement('div');
          row.className = 'recent-scroll';
          for (const song of recentSongs) row.append(songCard(song));
          block.append(heading, row);
          scroller.append(block);
        }
      }
      const found = filterSongs(songs, query);
      if (found.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.innerHTML = mascotSvg();
        const message = document.createElement('p');
        message.className = 'empty-text';
        message.textContent = 'みつからない';
        empty.append(message);
        scroller.append(empty);
        return;
      }
      const grid = document.createElement('div');
      grid.className = 'song-grid';
      for (const song of found) grid.append(songCard(song));
      scroller.append(grid);
    };
    field.addEventListener('input', paint);
    paint();
  }

  function showPractice(song: Song): void {
    player.stop();
    video?.destroy();
    video = null;
    mode = 'piano';
    playing = false;
    shown = null;
    screen = { name: 'practice', song };
    rememberSong(song.id);
    warnOutOfRange(song);
    root.replaceChildren();

    const practice = document.createElement('section');
    practice.className = 'practice';

    const top = document.createElement('header');
    top.className = 'topbar';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'back';
    back.dataset.action = 'back';
    back.setAttribute('aria-label', 'もどる');
    back.innerHTML = backIcon();
    const now = document.createElement('div');
    now.className = 'now-playing';
    const mini = document.createElement('div');
    mini.className = 'mini-art';
    const face = document.createElement('span');
    face.className = 'emoji-art';
    face.textContent = song.emoji;
    face.setAttribute('aria-hidden', 'true');
    mini.append(face);
    const heading = document.createElement('h2');
    heading.className = 'now-title';
    heading.textContent = song.title;
    now.append(mini, heading);
    top.append(back, now);
    if (song.youtubeId) {
      practice.classList.add('has-youtube');
      practice.dataset.mode = 'piano';
      const modes = document.createElement('div');
      modes.className = 'mode-switch';
      modes.append(modeButton('piano only', 'mode-piano', true), modeButton('with original', 'mode-original', false));
      top.append(modes);
    }

    const scoreWrap = document.createElement('div');
    scoreWrap.className = 'score-wrap';
    const scroller = document.createElement('div');
    scroller.className = 'score-scroll';
    scroller.append(renderScore(song));
    const playhead = document.createElement('div');
    playhead.className = 'playhead';
    playhead.setAttribute('aria-hidden', 'true');
    playhead.innerHTML = mascotSvg();
    scoreWrap.append(scroller, playhead);

    const stage = document.createElement('div');
    stage.className = 'stage';
    let host: HTMLDivElement | null = null;
    if (song.youtubeId) {
      const frame = document.createElement('div');
      frame.className = 'yt-frame';
      host = document.createElement('div');
      host.className = 'yt-host';
      frame.append(host);
      stage.append(frame);
    }
    stage.append(scoreWrap);

    const piano = document.createElement('div');
    piano.className = 'piano';
    const fallboard = document.createElement('div');
    fallboard.className = 'fallboard';
    const frame = document.createElement('div');
    frame.className = 'keys-frame';
    const row = document.createElement('div');
    const whiteCount = keys.filter((key) => !key.black).length;
    row.className = 'keys';
    row.style.setProperty('--white-count', String(whiteCount));

    for (const spec of keys.filter((key) => !key.black)) {
      row.append(keyButton(spec, false));
    }
    for (const spec of keys.filter((key) => key.black)) {
      const button = keyButton(spec, true);
      button.style.setProperty('--after', String(spec.after ?? 0));
      row.append(button);
    }
    frame.append(row);
    piano.append(fallboard, frame);

    const dock = document.createElement('footer');
    dock.className = 'dock';
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'play';
    play.dataset.action = 'play';
    play.setAttribute('aria-label', 'うたをならす');
    play.setAttribute('aria-pressed', 'false');
    html(play, playIcon());
    html(play, stopIcon());
    dock.append(play);

    practice.append(top, stage, piano, dock);
    root.append(practice, soundButton(), turnHint());
    if (host) {
      video = new OriginalVideo(host, song);
      video.onIndex = (index) => {
        if (mode !== 'original') return;
        showIndex(index);
      };
      video.onState = (next) => {
        if (mode !== 'original') return;
        setPlaying(next);
      };
      video.load();
    }
    refreshSound();
    requestAnimationFrame(() => scrollTo(0));
  }

  function modeButton(label: string, action: string, on: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.textContent = label;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    return button;
  }

  function keyButton(spec: (typeof keys)[number], black: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = black ? 'key black-key' : 'key white-key';
    button.dataset.pitch = spec.pitch;
    button.style.setProperty('--key', spec.color);
    button.style.setProperty('--ink', spec.ink);
    button.setAttribute('aria-label', spec.label);
    const gem = document.createElement('span');
    gem.className = [...spec.label].length > 1 ? 'gem gem-wide' : 'gem';
    gem.textContent = black ? '' : spec.label;
    if (black) gem.setAttribute('aria-hidden', 'true');
    button.append(gem);
    const release = () => button.classList.remove('is-pressed');
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    // No preventDefault here: cancelling pointerdown/touchstart drops iOS user activation.
    button.addEventListener('pointerdown', (event) => {
      if (event.button > 0) return;
      button.classList.add('is-pressed');
      soundKey(spec.pitch);
    });
    button.addEventListener('touchend', () => soundKey(spec.pitch));
    button.addEventListener('click', () => soundKey(spec.pitch));
    button.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      soundKey(spec.pitch);
    });
    return button;
  }

  let lastKey: { pitch: string; at: number } | null = null;
  function soundKey(pitch: string): void {
    const now = performance.now();
    if (lastKey && lastKey.pitch === pitch && now - lastKey.at < 280) return;
    let ctx: AudioContext;
    try {
      audio.unlockSync();
      ctx = audio.context;
    } catch (error) {
      console.error(error);
      return;
    }
    const fire = () => {
      if (ctx.state !== 'running') return;
      const at = performance.now();
      if (lastKey && lastKey.pitch === pitch && at - lastKey.at < 280) return;
      lastKey = { pitch, at };
      audio.play(pitch, ctx.currentTime + 0.03, 0.55, 'tap');
    };
    if (ctx.state === 'running') fire();
    else void ctx.resume().then(fire);
  }

  let lastUi: { key: string; at: number } | null = null;
  function onActivate(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const songButton = target.closest('[data-song-id]');
    const action = target.closest('[data-action]');
    if (!songButton && !action) return;
    const key = songButton instanceof HTMLElement && songButton.dataset.songId
      ? `song:${songButton.dataset.songId}`
      : action instanceof HTMLElement
        ? `action:${action.dataset.action}`
        : '';
    const now = performance.now();
    // Ignore the click that follows touchend once sound is actually running.
    // If the context is still suspended, let the later click try again.
    // The original-video play button is the exception: one tap must seek once.
    const videoGesture = key === 'action:play' && mode === 'original';
    if (lastUi && lastUi.key === key && now - lastUi.at < 450 && (audio.outputReady() || videoGesture)) return;
    lastUi = { key, at: now };
    const navigates = Boolean(songButton) || (action instanceof HTMLElement && action.dataset.action === 'back');
    if (navigates && event.type === 'touchend' && event.cancelable) event.preventDefault();
    if (songButton instanceof HTMLElement && songButton.dataset.songId) {
      const song = songs.find((item) => item.id === songButton.dataset.songId);
      if (song) showPractice(song);
      return;
    }
    if (!(action instanceof HTMLElement)) return;
    if (action.dataset.action === 'clear') {
      const field = root.querySelector('.search-input');
      if (field instanceof HTMLInputElement) {
        field.value = '';
        field.dispatchEvent(new Event('input'));
        field.focus();
      }
      return;
    }
    if (action.dataset.action === 'sound') {
      unlock();
      return;
    }
    if (action.dataset.action === 'back') {
      showHome();
      return;
    }
    if (action.dataset.action === 'mode-piano' || action.dataset.action === 'mode-original') {
      setMode(action.dataset.action === 'mode-original' ? 'original' : 'piano');
      return;
    }
    if (action.dataset.action === 'play' && screen.name === 'practice') {
      unlock();
      if (playing) {
        player.stop();
        video?.pause();
        return;
      }
      shown = null;
      if (mode === 'original' && video) {
        player.stop();
        video.playFromGesture();
        return;
      }
      video?.pause();
      player.start(screen.song);
    }
  }
  root.addEventListener('touchend', onActivate);
  root.addEventListener('click', onActivate);

  window.addEventListener('resize', () => {
    if (screen.name !== 'practice') return;
    scrollTo(shown ?? 0);
  });

  showHome();
}

function soundButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound';
  button.dataset.action = 'sound';
  button.dataset.state = 'idle';
  button.setAttribute('aria-label', 'おとをだす');
  const on = document.createElement('span');
  on.innerHTML = speakerOnIcon();
  const off = document.createElement('span');
  off.innerHTML = speakerOffIcon();
  button.append(on, off);
  return button;
}

function turnHint(): HTMLElement {
  const hint = document.createElement('div');
  hint.className = 'turn';
  hint.innerHTML = rotateHintSvg();
  return hint;
}
