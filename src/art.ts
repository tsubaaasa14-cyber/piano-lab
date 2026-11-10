function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `${parts.join(' ')} Z`;
}

function starFace(cx: number, cy: number, radius: number): string {
  const eyeY = cy - radius * 0.02;
  const eyeX = radius * 0.22;
  const eyeR = Math.max(2.5, radius * 0.085);
  const stroke = Math.max(2, radius * 0.055);
  return `
    <path d="${starPath(cx, cy, radius, radius * 0.46)}" fill="#FFD84A" stroke="#F0A020" stroke-width="${(radius * 0.045).toFixed(1)}" stroke-linejoin="round"/>
    <circle cx="${(cx - eyeX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeR.toFixed(1)}" fill="#4A3428"/>
    <circle cx="${(cx + eyeX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeR.toFixed(1)}" fill="#4A3428"/>
    <circle cx="${(cx - eyeX + eyeR * 0.35).toFixed(1)}" cy="${(eyeY - eyeR * 0.35).toFixed(1)}" r="${(eyeR * 0.35).toFixed(1)}" fill="#fff"/>
    <circle cx="${(cx + eyeX + eyeR * 0.35).toFixed(1)}" cy="${(eyeY - eyeR * 0.35).toFixed(1)}" r="${(eyeR * 0.35).toFixed(1)}" fill="#fff"/>
    <path d="M ${(cx - radius * 0.2).toFixed(1)} ${(cy + radius * 0.16).toFixed(1)} Q ${cx.toFixed(1)} ${(cy + radius * 0.4).toFixed(1)} ${(cx + radius * 0.2).toFixed(1)} ${(cy + radius * 0.16).toFixed(1)}" fill="none" stroke="#4A3428" stroke-width="${stroke.toFixed(1)}" stroke-linecap="round"/>
    <circle cx="${(cx - radius * 0.38).toFixed(1)}" cy="${(cy + radius * 0.12).toFixed(1)}" r="${(radius * 0.09).toFixed(1)}" fill="#FF8AA8" opacity="0.9"/>
    <circle cx="${(cx + radius * 0.38).toFixed(1)}" cy="${(cy + radius * 0.12).toFixed(1)}" r="${(radius * 0.09).toFixed(1)}" fill="#FF8AA8" opacity="0.9"/>
  `;
}

function spark(cx: number, cy: number, r: number): string {
  return `<path d="${starPath(cx, cy, r, r * 0.42)}" fill="#FFE9A0"/>`;
}

export function starSvg(): string {
  return `<svg class="art-svg" viewBox="0 0 220 300" aria-hidden="true">
    <circle cx="40" cy="42" r="18" fill="#FFE7A8" opacity="0.95"/>
    ${spark(176, 36, 14)}
    ${spark(34, 118, 9)}
    ${spark(190, 150, 11)}
    ${spark(28, 210, 8)}
    ${spark(186, 230, 8)}
    ${starFace(112, 158, 92)}
  </svg>`;
}

export function frogSvg(): string {
  return `<svg class="art-svg" viewBox="0 0 220 300" aria-hidden="true">
    <ellipse cx="110" cy="248" rx="92" ry="28" fill="#146B38"/>
    <ellipse cx="110" cy="240" rx="80" ry="20" fill="#1F8A48"/>
    <ellipse cx="70" cy="232" rx="18" ry="8" fill="#7DDE6A" opacity="0.75"/>
    <ellipse cx="110" cy="168" rx="72" ry="52" fill="#8BE56F"/>
    <ellipse cx="110" cy="180" rx="42" ry="30" fill="#F3FFD4"/>
    <circle cx="74" cy="118" r="28" fill="#8BE56F"/>
    <circle cx="146" cy="118" r="28" fill="#8BE56F"/>
    <circle cx="74" cy="118" r="15" fill="#fff"/>
    <circle cx="146" cy="118" r="15" fill="#fff"/>
    <circle cx="78" cy="122" r="7.5" fill="#2C2A28"/>
    <circle cx="150" cy="122" r="7.5" fill="#2C2A28"/>
    <circle cx="80" cy="119" r="2.5" fill="#fff"/>
    <circle cx="152" cy="119" r="2.5" fill="#fff"/>
    <path d="M82 176 Q110 200 138 176" fill="none" stroke="#2E6B3C" stroke-width="6" stroke-linecap="round"/>
    <circle cx="58" cy="168" r="10" fill="#FF8AA8" opacity="0.9"/>
    <circle cx="162" cy="168" r="10" fill="#FF8AA8" opacity="0.9"/>
  </svg>`;
}

function tulipBloom(x: number, y: number, fill: string, stroke: string): string {
  return `<g transform="translate(${x} ${y})">
    <path d="M0 78 C -8 48 -6 28 0 8" stroke="#1F8A48" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M0 52 C 22 46 34 30 28 12" stroke="#1F8A48" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="26" cy="20" rx="12" ry="7" fill="#3CB371" transform="rotate(-28 26 20)"/>
    <path d="M0 16 C -18 16 -28 -2 -16 -30 C -8 -16 -4 -6 0 0 C 4 -6 8 -16 16 -30 C 28 -2 18 16 0 16 Z" fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M0 12 C -6 4 -6 -8 0 -16 C 6 -8 6 4 0 12 Z" fill="#fff" opacity="0.35"/>
  </g>`;
}

export function tulipSvg(): string {
  return `<svg class="art-svg" viewBox="0 0 220 300" aria-hidden="true">
    <ellipse cx="110" cy="262" rx="96" ry="20" fill="#C6F0B0"/>
    <g transform="translate(110 168) scale(1.28) translate(-110 -120)">
      ${tulipBloom(58, 78, '#FF5D7A', '#E24568')}
      ${tulipBloom(110, 64, '#FFFDFC', '#F3B4C4')}
      ${tulipBloom(162, 82, '#FFD23C', '#E0A820')}
    </g>
  </svg>`;
}

export function mascotSvg(): string {
  return `<svg class="art-svg" viewBox="0 0 120 120" aria-hidden="true">${starFace(60, 62, 50)}</svg>`;
}

const ART: Record<string, () => string> = {
  star: starSvg,
  frog: frogSvg,
  tulip: tulipSvg,
};

export function artFor(picture: string): string {
  return (ART[picture] ?? starSvg)();
}

export function backIcon(): string {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 10 L16 24 L30 38" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function playIcon(): string {
  return `<svg class="icon-play" viewBox="0 0 48 48" aria-hidden="true"><path d="M16 10 L38 24 L16 38 Z" fill="#fff"/></svg>`;
}

export function stopIcon(): string {
  return `<svg class="icon-stop" viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="13" width="22" height="22" rx="5" fill="#fff"/></svg>`;
}

export function rotateHintSvg(): string {
  return `<svg viewBox="0 0 340 230" aria-hidden="true">
    <path d="M86 36 A 58 58 0 1 0 86 168" fill="none" stroke="#2E96FF" stroke-width="14" stroke-linecap="round"/>
    <path d="M86 168 L58 142 L112 138 Z" fill="#2E96FF"/>
    <rect x="168" y="24" width="128" height="176" rx="18" fill="#fff" stroke="#FF7A4A" stroke-width="8"/>
    <rect x="184" y="42" width="96" height="120" rx="10" fill="#FFE7C4"/>
    ${starFace(232, 102, 36)}
  </svg>`;
}
