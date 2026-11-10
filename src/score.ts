import { measureQuarterBeats, noteLabel, parsePitch, solfege, staffStepFromE4 } from './pitch';
import type { Song } from './types';

const NS = 'http://www.w3.org/2000/svg';

const LINE_GAP = 18;
const BOTTOM_LINE = 132;
const BEAT_WIDTH = 62;
const HEIGHT = 236;
const LEFT = 78;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function appendClef(svg: SVGSVGElement): void {
  // The lower curl sits on the G line. Tuned against the staff in this file.
  const clef = svgEl('path', {
    class: 'clef',
    d: 'M26 134 C 10 130 8 108 22 100 C 38 90 50 106 40 118 C 30 130 16 120 24 106 C 34 88 54 70 46 46 C 40 28 24 24 26 40 C 28 54 44 48 38 34',
    fill: 'none',
    stroke: '#8A5A42',
    'stroke-width': 5.5,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  svg.append(clef);
}

function ledgerSteps(step: number): number[] {
  const steps: number[] = [];
  if (step <= -2) {
    for (let cursor = -2; cursor >= step; cursor -= 2) steps.push(cursor);
  }
  if (step >= 10) {
    for (let cursor = 10; cursor <= step; cursor += 2) steps.push(cursor);
  }
  return steps;
}

export function renderScore(song: Song): SVGSVGElement {
  const measureBeats = measureQuarterBeats(song.meter);
  let cursor = LEFT;
  const placed = song.melody.map((note, index) => {
    const width = Math.max(note.beats, 0.5) * BEAT_WIDTH;
    const start = cursor;
    const x = cursor + width / 2;
    cursor += width;
    return { note, index, x, width, start, end: cursor };
  });
  const width = Math.ceil(cursor + 28);
  const svg = svgEl('svg', {
    class: 'score',
    width,
    height: HEIGHT,
    viewBox: `0 0 ${width} ${HEIGHT}`,
  });
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', song.title);

  let consumed = 0;
  let measureStart = LEFT;
  let measureIndex = 0;
  for (const item of placed) {
    consumed += item.note.beats;
    if (consumed >= measureBeats - 1e-6) {
      svg.append(
        svgEl('rect', {
          class: 'measure',
          x: measureStart,
          y: BOTTOM_LINE - LINE_GAP * 4 - 14,
          width: item.end - measureStart,
          height: LINE_GAP * 4 + 32,
          fill: measureIndex % 2 === 0 ? '#fff6ea' : '#ffeef3',
        }),
      );
      measureStart = item.end;
      consumed = 0;
      measureIndex += 1;
    }
  }

  for (let line = 0; line < 5; line += 1) {
    const y = BOTTOM_LINE - line * LINE_GAP;
    svg.append(
      svgEl('line', {
        class: 'staff-line',
        x1: 8,
        x2: width - 8,
        y1: y,
        y2: y,
        stroke: '#e0b08a',
        'stroke-width': 2,
      }),
    );
  }

  appendClef(svg);

  let beatSum = 0;
  for (const item of placed) {
    beatSum += item.note.beats;
    const atBar = beatSum >= measureBeats - 1e-6;
    if (atBar) beatSum = 0;
    if (!atBar) continue;
    const bar = svgEl('line', {
      class: 'barline',
      x1: item.end,
      x2: item.end,
      y1: BOTTOM_LINE - LINE_GAP * 4,
      y2: BOTTOM_LINE,
      stroke: '#d7a888',
      'stroke-width': 2,
    });
    svg.append(bar);
  }
  const endX = placed[placed.length - 1]?.end ?? LEFT;
  svg.append(
    svgEl('line', {
      class: 'barline barline-end',
      x1: endX + 8,
      x2: endX + 8,
      y1: BOTTOM_LINE - LINE_GAP * 4,
      y2: BOTTOM_LINE,
      stroke: '#c4896a',
      'stroke-width': 5,
    }),
  );

  for (const item of placed) {
    const group = svgEl('g', { class: 'note', 'data-index': item.index });
    if (item.note.pitch) group.setAttribute('data-pitch', item.note.pitch);

    if (!item.note.pitch) {
      group.append(
        svgEl('rect', {
          x: item.x - 8,
          y: BOTTOM_LINE - LINE_GAP * 2 - 6,
          width: 16,
          height: 12,
          rx: 4,
          fill: '#d9c3b2',
        }),
      );
      svg.append(group);
      continue;
    }

    const step = staffStepFromE4(item.note.pitch);
    const y = BOTTOM_LINE - step * (LINE_GAP / 2);
    const parts = parsePitch(item.note.pitch);
    const tone = solfege(parts.letter);
    const held = item.note.beats >= 2;
    const label = noteLabel(item.note.pitch);
    const wide = [...label].length > 1;

    group.append(
      svgEl('circle', {
        class: 'halo',
        cx: item.x,
        cy: y,
        r: 24,
        fill: 'none',
        stroke: '#ffbf1a',
        'stroke-width': 5,
        opacity: 0,
      }),
    );

    for (const ledger of ledgerSteps(step)) {
      const ledgerY = BOTTOM_LINE - ledger * (LINE_GAP / 2);
      group.append(
        svgEl('line', {
          class: 'ledger',
          x1: item.x - 22,
          x2: item.x + 22,
          y1: ledgerY,
          y2: ledgerY,
          stroke: '#e0b08a',
          'stroke-width': 2,
        }),
      );
    }

    const stemUp = step < 4;
    const stemX = stemUp ? item.x + 13 : item.x - 13;
    const stemEnd = stemUp ? y - LINE_GAP * 3.15 : y + LINE_GAP * 3.15;
    group.append(
      svgEl('line', {
        class: 'stem',
        x1: stemX,
        x2: stemX,
        y1: y,
        y2: stemEnd,
        stroke: '#6b4a38',
        'stroke-width': 2.5,
      }),
    );

    group.append(
      svgEl('ellipse', {
        class: 'head',
        cx: item.x,
        cy: y,
        rx: 14,
        ry: 11,
        fill: held ? '#fffdf8' : tone.color,
        stroke: tone.color,
        'stroke-width': held ? 4 : 2.5,
      }),
    );

    const dotted = Math.abs((item.note.beats % 1) - 0.5) < 0.05 || item.note.beats === 3;
    if (dotted) {
      group.append(svgEl('circle', { class: 'dot', cx: item.x + 24, cy: y - 8, r: 3.5, fill: tone.color }));
    }

    const chipW = wide ? 64 : 44;
    const chipY = 186;
    group.append(
      svgEl('rect', {
        class: 'label-bg',
        x: item.x - chipW / 2,
        y: chipY,
        width: chipW,
        height: 34,
        rx: 17,
        fill: tone.color,
      }),
    );
    const text = svgEl('text', {
      class: 'solfege',
      x: item.x,
      y: chipY + 17,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      fill: tone.ink,
      'font-size': wide ? 16 : 20,
      'font-family': 'M PLUS Rounded, sans-serif',
      'font-weight': 800,
    });
    text.textContent = label;
    group.append(text);
    svg.append(group);
  }

  return svg;
}

export function centerNote(scroller: HTMLElement, index: number): void {
  const note = scroller.querySelector(`.note[data-index="${index}"]`);
  if (!(note instanceof SVGGraphicsElement)) return;
  const noteBox = note.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  const delta = noteBox.left + noteBox.width / 2 - (box.left + box.width / 2);
  scroller.scrollBy({ left: delta, behavior: 'auto' });
}
