/**
 * Builds src/data/songs.json.
 * Melodies are right-hand, one note at a time, simplified to quarters and halves.
 * Pitches stay inside C4–E5. Sources are traditional / public-domain tunes.
 * ぞうさん and いぬのおまわりさん are still in copyright, so they are not included.
 * うみ is omitted for the same reason (often credited to 井上武士).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOW = midi('C4');
const HIGH = midi('E5');

function midi(pitch) {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(pitch);
  if (!match) throw new Error(`bad pitch ${pitch}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
  const acc = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + base + acc;
}

function melody(spec) {
  return spec
    .trim()
    .split(/\s+/)
    .map((token) => {
      const match = /^([A-G](?:#|b)?\d)(?:\*([0-9.]+))?$/.exec(token);
      if (!match) throw new Error(`bad token ${token}`);
      const pitch = match[1];
      const beats = match[2] ? Number(match[2]) : 1;
      const value = midi(pitch);
      if (value < LOW || value > HIGH) throw new Error(`${pitch} out of C4–E5`);
      return { pitch, beats };
    });
}

function tune(entry) {
  return {
    picture: 'emoji',
    meter: [4, 4],
    origin: { type: 'builtin', label: entry.source, sourceUrl: entry.url },
    melody: melody(entry.notes),
    ...entry,
    notes: undefined,
    source: undefined,
    url: undefined,
  };
}

const songs = [
  tune({
    id: 'twinkle',
    title: 'きらきら星',
    emoji: '⭐',
    reading: 'きらきらぼし',
    romaji: 'kirakiraboshi',
    aliases: ['星', 'twinkle', 'little star'],
    accent: '#3B49C9',
    bpm: 88,
    picture: 'star',
    source: 'French folk tune (Ah! vous dirai-je, maman), same melody as Twinkle, Twinkle, Little Star. Full tune, quarter and half notes.',
    url: 'https://en.wikipedia.org/wiki/Twinkle,_Twinkle,_Little_Star',
    notes: `
      C4 C4 G4 G4 A4 A4 G4*2
      F4 F4 E4 E4 D4 D4 C4*2
      G4 G4 F4 F4 E4 E4 D4*2
      G4 G4 F4 F4 E4 E4 D4*2
      C4 C4 G4 G4 A4 A4 G4*2
      F4 F4 E4 E4 D4 D4 C4*2
    `,
  }),
  tune({
    id: 'frog',
    title: 'かえるのうた',
    emoji: '🐸',
    reading: 'かえるのうた',
    romaji: 'kaerunouta',
    aliases: ['蛙', 'かえる', 'frog'],
    accent: '#1E9D57',
    bpm: 100,
    picture: 'frog',
    source: 'Traditional Japanese round. One statement of the tune; the croaks are eight even C notes.',
    url: 'https://ja.wikipedia.org/wiki/%E3%81%8B%E3%81%88%E3%82%8B%E3%81%AE%E5%90%88%E5%94%B1',
    notes: `
      C4 D4 E4 F4 E4 D4 C4*2
      E4 F4 G4 A4 G4 F4 E4*2
      C4 C4 C4 C4 C4 C4 C4 C4
      C4 D4 E4 F4 E4 D4 C4*2
    `,
  }),
  tune({
    id: 'tulip',
    title: 'チューリップ',
    emoji: '🌷',
    reading: 'ちゅーりっぷ',
    romaji: 'churippu',
    aliases: ['郁金香', 'tulip'],
    accent: '#E84B73',
    bpm: 84,
    picture: 'tulip',
    source: 'School song as commonly sung in C (ドレミ ドレミ ソミレド). Held notes stand in for rests. Often credited to 井上武士.',
    url: 'https://ja.wikipedia.org/wiki/%E3%83%81%E3%83%A5%E3%83%BC%E3%83%AA%E3%83%83%E3%83%97_(%E6%AD%8C)',
    notes: `
      C4 D4 E4*2 C4 D4 E4*2
      G4 E4 D4 C4 D4 E4 D4*2
      C4 D4 E4*2 C4 D4 E4*2
      G4 E4 D4 C4 D4 C4*3
    `,
  }),
  tune({
    id: 'bee',
    title: 'ぶんぶんぶん',
    emoji: '🐝',
    reading: 'ぶんぶんぶん',
    romaji: 'bunbunbun',
    aliases: ['蜂', 'bee'],
    accent: '#F0A202',
    bpm: 96,
    source: 'Folk tune (Bohemian/German) used for ぶんぶんぶん. Even quarters; the hook is ソファミレ ミファレド.',
    url: 'https://ja.wikipedia.org/wiki/%E3%81%B6%E3%82%93%E3%81%B6%E3%82%93%E3%81%B6%E3%82%93',
    notes: `
      G4 F4 E4 D4 E4 F4 D4 C4*2
      E4 F4 G4 E4 D4 E4 F4 D4*2
      E4 F4 G4 E4 D4 E4 F4 D4*2
      G4 F4 E4 D4 E4 F4 D4 C4*2
    `,
  }),
  tune({
    id: 'snail',
    title: 'かたつむり',
    emoji: '🐌',
    reading: 'かたつむり',
    romaji: 'katatsumuri',
    aliases: ['蝸牛', 'でんでんむし'],
    accent: '#7A8F3A',
    bpm: 92,
    source: '文部省唱歌. Solfege from the school song (ソソソミ ドドドレ…, then ソドドソ with the higher do). Dotted rhythm evened to quarters.',
    url: 'https://ja.wikipedia.org/wiki/%E3%81%8B%E3%81%9F%E3%81%A4%E3%82%80%E3%82%8A_(%E5%94%B1%E6%AD%8C)',
    notes: `
      G4 G4 G4 E4 C4 C4 C4 D4 E4 E4 D4 C4 D4*2
      E4 F4 G4 A4 G4 G4 G4 E4 D4 D4 C4 D4 E4*2
      G4 C5 C5 G4 E4 G4 G4 E4 C4 E4 E4 D4 C4*2
    `,
  }),
  tune({
    id: 'acorn',
    title: 'どんぐりころころ',
    emoji: '🌰',
    reading: 'どんぐりころころ',
    romaji: 'dongurikorokoro',
    aliases: ['団栗', 'donguri'],
    accent: '#C47B2B',
    bpm: 96,
    source: '青木存義 / 梁田貞, 1921. Public domain (Wikipedia: 国内の保護期間は満了). Solfege ソミミファミレド. Dotted rhythm evened to quarters.',
    url: 'https://ja.wikipedia.org/wiki/%E3%81%A9%E3%82%93%E3%81%90%E3%82%8A%E3%81%93%E3%82%8D%E3%81%93%E3%82%8D',
    notes: `
      G4 E4 E4 F4 E4 D4 C4*2
      G4 E4 E4 D4*2
      E4 E4 G4 G4 A4 A4 A4 C5 E4 E4 G4*2
      G4 G4 E4 E4 F4 E4 D4 C4
      G4 E4 E4 D4*2
      G4 E4 A4 G4 G4 A4 A4 B4 B4 C5*2
    `,
  }),
  tune({
    id: 'butterfly',
    title: 'ちょうちょう',
    emoji: '🦋',
    reading: 'ちょうちょう',
    romaji: 'chouchou',
    aliases: ['蝶', '蝶々', 'butterfly'],
    accent: '#F25C8A',
    bpm: 92,
    source: 'Folk tune (long thought Spanish, now usually given as German). Opening ソミミ ファレレ ドレミファソソソ. Eighths evened to quarters.',
    url: 'https://ja.wikipedia.org/wiki/%E3%81%A1%E3%82%87%E3%81%86%E3%81%A1%E3%82%87%E3%81%86',
    notes: `
      G4 E4 E4*2 F4 D4 D4*2 C4 D4 E4 F4 G4 G4 G4*2
      G4 E4 E4 E4 F4 D4 D4 D4 C4 E4 G4 G4 E4 E4 E4*2
    `,
  }),
  tune({
    id: 'mary',
    title: 'メリーさんのひつじ',
    emoji: '🐑',
    reading: 'めりーさんのひつじ',
    romaji: 'merisannohitsuji',
    aliases: ['羊', 'mary', 'little lamb'],
    accent: '#8D7355',
    bpm: 100,
    source: 'American folk song Mary Had a Little Lamb. Quarter notes, phrase ends held.',
    url: 'https://en.wikipedia.org/wiki/Mary_Had_a_Little_Lamb',
    notes: `
      E4 D4 C4 D4 E4 E4 E4*2
      D4 D4 D4*2 E4 G4 G4*2
      E4 D4 C4 D4 E4 E4 E4*2
      D4 D4 E4 D4 C4*2
    `,
  }),
  tune({
    id: 'london',
    title: 'ロンドン橋',
    emoji: '🌉',
    reading: 'ろんどんばし',
    romaji: 'rondonbashi',
    aliases: ['橋', 'london', 'london bridge'],
    accent: '#3D7EA6',
    bpm: 104,
    source: 'English folk song London Bridge Is Falling Down, in C. Phrase ends held.',
    url: 'https://en.wikipedia.org/wiki/London_Bridge_Is_Falling_Down',
    notes: `
      G4 A4 G4 F4 E4 F4 G4*2
      D4 E4 F4*2 E4 F4 G4*2
      G4 A4 G4 F4 E4 F4 G4*2
      D4 G4 E4*2 C4*2
    `,
  }),
  tune({
    id: 'open-shut',
    title: 'むすんでひらいて',
    emoji: '👐',
    reading: 'むすんでひらいて',
    romaji: 'musundehiraite',
    aliases: ['結んで開いて', 'musunde'],
    accent: '#F28C28',
    bpm: 88,
    source: 'Same French folk tune as きらきら星, but only the open-and-shut section (no middle phrase).',
    url: 'https://en.wikipedia.org/wiki/Ah!_vous_dirai-je,_maman',
    notes: `
      C4 C4 G4 G4 A4 A4 G4*2
      F4 F4 E4 E4 D4 D4 C4*2
      C4 C4 G4 G4 A4 A4 G4*2
      F4 F4 E4 E4 D4 D4 C4*2
    `,
  }),
  tune({
    id: 'chestnut',
    title: '大きな栗の木の下で',
    emoji: '🌳',
    reading: 'おおきなくりのきのしたで',
    romaji: 'ookinakurinokinoshitade',
    aliases: ['栗', 'chestnut'],
    accent: '#2E7D4F',
    bpm: 96,
    source: 'English folk song Under the Spreading Chestnut Tree, in C. Shortened and evened.',
    url: 'https://en.wikipedia.org/wiki/The_Chestnut_Tree',
    notes: `
      C4 E4 G4 G4 C5 A4 G4 E4 C4*2
      G4 G4 A4 G4 E4*2
      C4 E4 G4 G4 C5 A4 G4 E4 D4 C4*2
    `,
  }),
  tune({
    id: 'pigeon',
    title: 'はとぽっぽ',
    emoji: '🕊️',
    reading: 'はとぽっぽ',
    romaji: 'hatopoppo',
    aliases: ['鳩', 'hato', 'pigeon'],
    accent: '#8E9AAF',
    bpm: 96,
    source: 'Traditional children\'s song (はとぽっぽ). Opening ミソソソミ ドドラソミ. Rhythm evened.',
    url: 'https://ja.wikipedia.org/wiki/%E9%B3%A9%E3%81%BD%E3%81%A3%E3%81%BD',
    notes: `
      E4 G4 G4 G4 E4*2
      C5 C5 A4 G4 E4*2
      G4 G4 E4 G4 A4 G4*2
      E4 D4 C4*2
    `,
  }),
  tune({
    id: 'bear',
    title: '森のくまさん',
    emoji: '🐻',
    reading: 'もりくまさん',
    romaji: 'morinokumasan',
    aliases: ['熊', 'bear'],
    accent: '#8B5A2B',
    bpm: 108,
    source: 'American folk tune For He\'s a Jolly Good Fellow / The Bear Went Over the Mountain. Even quarters, in C.',
    url: 'https://en.wikipedia.org/wiki/For_He%27s_a_Jolly_Good_Fellow',
    notes: `
      C4 C4 D4 E4 E4 D4 C4 E4 D4 D4 C4*2
      C4 C4 D4 E4 E4 D4 C4 E4 D4 C4*3
      G4 G4 G4 E4 D4 E4 F4*2 E4 D4 C4*2
    `,
  }),
  tune({
    id: 'happy-clap',
    title: 'しあわせなら手をたたこう',
    emoji: '👏',
    reading: 'しあわせならてをたたこう',
    romaji: 'shiawasenaratewotatakou',
    aliases: ['幸せ', 'happy', 'clap'],
    accent: '#E23B4A',
    bpm: 108,
    source: 'Traditional clapping song If You\'re Happy and You Know It. Four even phrases in C.',
    url: 'https://en.wikipedia.org/wiki/If_You%27re_Happy_and_You_Know_It',
    notes: `
      C4 C4 F4 F4 F4 E4 D4 C4
      C4 C4 G4 G4 G4 F4 E4 D4
      C4 C4 A4 A4 A4 G4 F4 E4
      D4 D4 G4 G4 F4 E4 D4 C4
    `,
  }),
  tune({
    id: 'birthday',
    title: 'ハッピーバースデー',
    emoji: '🎂',
    reading: 'はっぴーばーすでー',
    romaji: 'happibasude',
    aliases: ['誕生日', 'birthday', 'happy birthday'],
    accent: '#FF7A4A',
    bpm: 92,
    meter: [3, 4],
    source: 'Happy Birthday to You (Patty and Mildred Hill). Public domain. Eighth pickups evened to quarters. The B-flat is written A#4 so the black key lights up.',
    url: 'https://en.wikipedia.org/wiki/Happy_Birthday_to_You',
    notes: `
      C4 C4 D4 C4 F4 E4*2
      C4 C4 D4 C4 G4 F4*2
      C4 C4 C5 A4 F4 E4 D4*2
      A#4 A#4 A4 F4 G4 F4*2
    `,
  }),
  tune({
    id: 'jingle',
    title: 'ジングルベル',
    emoji: '🔔',
    reading: 'じんぐるべる',
    romaji: 'jinguruberu',
    aliases: ['鈴', 'jingle', 'jingle bells'],
    accent: '#C62828',
    bpm: 108,
    source: 'James Pierpont, Jingle Bells (1857), chorus only, in C. Eighths evened to quarters.',
    url: 'https://en.wikipedia.org/wiki/Jingle_Bells',
    notes: `
      E4 E4 E4*2 E4 E4 E4*2 E4 G4 C5 D4 E4*4
      F4 F4 F4 F4 F4 E4 E4 E4 E4 D4 D4 E4 D4*2
      E4 E4 E4*2 E4 E4 E4*2 E4 G4 C5 D4 E4*4
      F4 F4 F4 F4 F4 E4 E4 E4 G4 G4 F4 D4 C4*4
    `,
  }),
  tune({
    id: 'cuckoo',
    title: 'かっこう',
    emoji: '🐦',
    reading: 'かっこう',
    romaji: 'kakkou',
    aliases: ['郭公', 'cuckoo'],
    accent: '#5C8A4E',
    bpm: 100,
    source: 'German folk cuckoo song. School form ソミソミ レドレド, which stays inside C4–E5 (no low B).',
    url: 'https://ja.wikipedia.org/wiki/%E3%81%8B%E3%81%A3%E3%81%93%E3%81%86',
    notes: `
      G4 E4 G4 E4 D4 C4 D4 C4
      D4 D4 E4 F4 D4 E4 E4 F4 G4 E4
      G4 E4 G4 E4 F4 E4 D4 C4*2
    `,
  }),
  tune({
    id: 'furusato',
    title: 'ふるさと',
    emoji: '⛰️',
    reading: 'ふるさと',
    romaji: 'furusato',
    aliases: ['故郷', 'hometown'],
    accent: '#3E6B4F',
    bpm: 84,
    source: '岡野貞一 / 高野辰之, 文部省唱歌 (public domain). Opening ミソソ ラソミ only, rhythm evened, later phrases left out.',
    url: 'https://ja.wikipedia.org/wiki/%E3%81%B5%E3%82%8B%E3%81%95%E3%81%A8_(%E5%94%B1%E6%AD%8C)',
    notes: `
      E4 G4 G4 A4 G4 E4*2
      D4 C4 D4 E4*2
      C4 E4 E4 D4 C4 D4 E4 G4 E4 C4*2
      E4 G4 G4 A4 G4 E4*2
      D4 C4 D4 C4*2
    `,
  }),
  tune({
    id: 'rabbit',
    title: 'うさぎ',
    emoji: '🐰',
    reading: 'うさぎ',
    romaji: 'usagi',
    aliases: ['兎', 'rabbit'],
    accent: '#F4A3B5',
    bpm: 100,
    source: 'Japanese warabeuta. Common pentatonic version, rhythm evened to quarters.',
    url: 'https://ja.wikipedia.org/wiki/%E3%81%86%E3%81%95%E3%81%8E_(%E3%82%8F%E3%82%89%E3%81%B9%E3%81%86%E3%81%9F)',
    notes: `
      E4 G4 G4 A4 G4 E4*2
      G4 G4 E4 G4 A4 G4 E4*2
      C5 E4 G4 A4 G4 E4*2
      D4 C4 E4 D4 C4*2
    `,
  }),
  tune({
    id: 'sakura',
    title: 'さくらさくら',
    emoji: '🌸',
    reading: 'さくらさくら',
    romaji: 'sakurasakura',
    aliases: ['桜', 'cherry'],
    accent: '#E86A92',
    bpm: 72,
    source: 'Traditional Japanese song さくらさくら, in-sen / pentatonic form on A. No sharps.',
    url: 'https://en.wikipedia.org/wiki/Sakura_Sakura',
    notes: `
      A4 A4 B4 A4 C5 B4 A4*2
      A4 A4 B4 A4 E4 A4*2
      C5 C5 D5 C5 B4 A4 B4*2
      A4 A4 B4 A4 E4 A4*2
    `,
  }),
].map((song) => {
  const { notes, source, url, ...rest } = song;
  return rest;
});

if (songs.length < 20) throw new Error(`expected about 20 songs, got ${songs.length}`);

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/songs.json');
writeFileSync(file, `${JSON.stringify(songs, null, 2)}\n`);
console.log(`wrote ${songs.length} songs`);
