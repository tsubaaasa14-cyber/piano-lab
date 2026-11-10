#!/usr/bin/env python3
"""Turn a recording into one right-hand kids' melody and add it to the library.

The melody is monophonic, quantized to the beat, and trimmed to the chorus
(16–32 notes inside C4–E5). Songs land in src/data/extracted.json. Regenerating
src/data/songs.json with scripts/library.mjs keeps them.

Examples
--------
tools/add-song/.venv/bin/python tools/add-song/add_song.py \\
  --audio uploads/touch_audio.mp4 --youtube-id DN5JpXHDrLk --title Touch

tools/add-song/.venv/bin/python tools/add-song/add_song.py \\
  "MAZZEL Touch official" --youtube-id VIDEO_ID --cookies cookies.txt
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
LOW_MIDI = 60  # C4
HIGH_MIDI = 76  # E5
BLACK = {1, 3, 6, 8, 10}
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
URL_ID = (
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
    re.compile(r"[?&]v=([A-Za-z0-9_-]{11})"),
    re.compile(r"/embed/([A-Za-z0-9_-]{11})"),
    re.compile(r"/shorts/([A-Za-z0-9_-]{11})"),
)


def midi_to_hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def hz_to_midi(hz: np.ndarray) -> np.ndarray:
    safe = np.maximum(np.asarray(hz, dtype=float), 1e-6)
    return 69.0 + 12.0 * np.log2(safe / 440.0)


def midi_name(midi: int) -> str:
    return f"{NAMES[midi % 12]}{midi // 12 - 1}"


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.check_call(cmd)


def ffmpeg_wav(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return
    run(["ffmpeg", "-y", "-i", str(src), "-ac", "2", "-ar", "44100", str(dest)])


def download_query(query: str, work: Path, cookies: Path | None) -> Path:
    out = work / "download.%(ext)s"
    cmd = [
        sys.executable,
        "-m",
        "yt_dlp",
        "-f",
        "bestaudio/best",
        "--no-playlist",
        "-o",
        str(out),
        "--print",
        "after_move:filepath",
    ]
    if cookies:
        cmd += ["--cookies", str(cookies)]
    cmd.append(query if query.startswith("http") else f"ytsearch1:{query}")
    print("+ yt-dlp", query, flush=True)
    completed = subprocess.run(cmd, check=True, capture_output=True, text=True)
    paths = [line.strip() for line in completed.stdout.splitlines() if line.strip()]
    if not paths:
        raise SystemExit("yt-dlp did not print a downloaded file")
    return Path(paths[-1])


def separate_vocals(mix: Path, out_dir: Path) -> Path:
    """Demucs htdemucs vocals. Saved with soundfile because this torchaudio build cannot write wavs."""
    vocals_path = out_dir / "htdemucs" / mix.stem / "vocals.wav"
    if vocals_path.exists() and vocals_path.stat().st_size > 0:
        print(f"reusing {vocals_path}", flush=True)
        return vocals_path
    import soundfile as sf
    import torch
    from demucs.apply import apply_model
    from demucs.pretrained import get_model
    from demucs.separate import load_track

    model = get_model("htdemucs")
    model.cpu()
    model.eval()
    wav = load_track(mix, model.audio_channels, model.samplerate)
    ref = wav.mean(0)
    wav = wav - ref.mean()
    wav = wav / ref.std()
    print("separating vocals with Demucs htdemucs", flush=True)
    with torch.no_grad():
        sources = apply_model(
            model,
            wav[None],
            device="cpu",
            shifts=1,
            split=True,
            overlap=0.25,
            progress=True,
            num_workers=1,
        )[0]
    sources = sources * ref.std() + ref.mean()
    vocals = sources[model.sources.index("vocals")].detach().cpu().numpy().T
    vocals_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(vocals_path), vocals, model.samplerate)
    return vocals_path


def load_mono(path: Path, sr: int) -> tuple[np.ndarray, int]:
    import librosa

    audio, rate = librosa.load(path, sr=sr, mono=True)
    return audio.astype(np.float32), rate


def cached_track(work: Path, name: str, builder) -> "Track":
    path = work / f"track-{name}.npz"
    if path.exists():
        data = np.load(path)
        print(f"reusing {path.name}", flush=True)
        return Track(name, data["times"], data["midi"], data["confidence"])
    track = builder()
    np.savez(path, times=track.times, midi=track.midi, confidence=track.confidence)
    return track


class Track:
    def __init__(self, name: str, times: np.ndarray, midi: np.ndarray, confidence: np.ndarray):
        self.name = name
        self.times = times
        self.midi = midi
        self.confidence = confidence

    def score(self) -> float:
        voiced = self.confidence > 0.45
        fraction = float(voiced.mean()) if len(voiced) else 0.0
        if fraction < 0.08 or fraction > 0.92:
            return -1.0
        midi = self.midi[voiced]
        if len(midi) < 20:
            return -1.0
        steps = np.abs(np.diff(midi))
        # Tracker octave flips and noise both make large steps.
        leap_penalty = float(np.mean(steps > 7))
        span = float(np.percentile(midi, 95) - np.percentile(midi, 5))
        span_score = 1.0 if 5 <= span <= 28 else 0.35
        conf = float(self.confidence[voiced].mean())
        coverage = 1.0 - abs(fraction - 0.45)
        return coverage * span_score * conf * (1.0 - 0.7 * leap_penalty)


def track_pyin(audio: np.ndarray, sr: int) -> Track:
    import librosa

    f0, _voiced, probs = librosa.pyin(
        audio,
        fmin=librosa.note_to_hz("A2"),
        fmax=librosa.note_to_hz("C6"),
        sr=sr,
        frame_length=2048,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=512)
    midi = np.zeros_like(f0, dtype=float)
    conf = np.nan_to_num(probs, nan=0.0)
    good = np.isfinite(f0)
    midi[good] = hz_to_midi(f0[good])
    conf = np.where(good, conf, 0.0)
    return Track("pyin", times, midi, conf)


def track_torchcrepe(audio: np.ndarray, sr: int) -> Track:
    import torch
    import torchcrepe

    hop = int(round(sr * 0.01))
    wav = torch.tensor(audio, dtype=torch.float32).unsqueeze(0)
    pitch, periodicity = torchcrepe.predict(
        wav,
        sr,
        hop_length=hop,
        fmin=80.0,
        fmax=1100.0,
        model="full",
        return_periodicity=True,
        batch_size=128,
        device="cpu",
    )
    pitch = pitch.squeeze(0).cpu().numpy()
    periodicity = periodicity.squeeze(0).cpu().numpy()
    times = np.arange(len(pitch)) * (hop / sr)
    midi = np.zeros_like(pitch)
    good = np.isfinite(pitch) & (pitch > 0)
    midi[good] = hz_to_midi(pitch[good])
    conf = np.where(good, periodicity, 0.0)
    return Track("torchcrepe", times, midi, conf)


def track_basic_pitch(vocals: Path, duration: float) -> Track:
    # The TensorFlow saved model does not load on current Keras. The ONNX file shipped
    # in the package does, once onnxruntime is installed.
    from basic_pitch import FilenameSuffix, build_icassp_2022_model_path
    from basic_pitch.inference import Model, predict

    model = Model(build_icassp_2022_model_path(FilenameSuffix.onnx))
    _model, _midi, notes = predict(str(vocals), model_or_model_path=model, melodia_trick=True)
    hop = 0.02
    times = np.arange(0, duration, hop)
    midi = np.zeros_like(times)
    conf = np.zeros_like(times)
    for start, end, pitch, amplitude, _bends in notes:
        mask = (times >= start) & (times < end)
        amp = float(amplitude)
        better = amp >= conf[mask]
        midi_mask = midi[mask]
        midi_mask[better] = float(pitch)
        midi[mask] = midi_mask
        conf[mask] = np.maximum(conf[mask], amp)
    return Track("basic-pitch", times, midi, conf)


def beat_grid(mix: np.ndarray, sr: int) -> tuple[np.ndarray, float]:
    import librosa

    tempo, beats = librosa.beat.beat_track(y=mix, sr=sr, units="time", trim=False)
    beat_times = np.asarray(beats, dtype=float).reshape(-1)
    tempo_value = float(np.atleast_1d(tempo)[0])
    if len(beat_times) < 8:
        raise SystemExit("beat tracker found too few beats")
    interval = float(np.median(np.diff(beat_times)))
    bpm = 60.0 / interval
    # R&B at this tempo is often reported an octave high or low.
    if bpm < 72:
        bpm *= 2
        interval /= 2
    elif bpm > 160:
        bpm /= 2
        interval *= 2
    print(f"beat tracker tempo {tempo_value:.1f}, grid bpm {bpm:.2f}", flush=True)
    phase = float(beat_times[0])
    duration = len(mix) / sr
    count = int((duration - phase) / interval) + 2
    grid = phase + np.arange(count) * interval
    return grid, bpm


def dominant_pitch(track: Track, start: float, end: float) -> tuple[int | None, float]:
    mask = (track.times >= start) & (track.times < end) & (track.confidence > 0.45)
    if int(mask.sum()) < 2:
        return None, 0.0
    midis = np.rint(track.midi[mask]).astype(int)
    weights = track.confidence[mask]
    bins: dict[int, float] = {}
    for midi, weight in zip(midis, weights):
        bins[int(midi)] = bins.get(int(midi), 0.0) + float(weight)
    ranking = sorted(bins.items(), key=lambda item: item[1], reverse=True)
    chosen, weight = ranking[0]
    if len(ranking) > 1 and abs(ranking[1][0] - chosen) == 1:
        weight += ranking[1][1]
    total = float(weights.sum())
    window = (track.times >= start) & (track.times < end)
    voiced_fraction = float(mask.sum()) / max(1, int(window.sum()))
    # Vibrato splits a note across two MIDI bins, so the bar for "this beat is sung" stays low.
    if voiced_fraction < 0.18 or weight < 0.34 * total:
        return None, weight / total if total else 0.0
    return chosen, weight / total


def fold_octaves(seq: list[int | None]) -> list[int | None]:
    out: list[int | None] = []
    last: int | None = None
    for midi in seq:
        if midi is None:
            out.append(None)
            continue
        note = midi
        if last is not None and abs(note - last) >= 10:
            alt = note - 12 if note > last else note + 12
            if abs(alt - last) < abs(note - last):
                note = alt
        out.append(note)
        last = note
    return out


def despike(seq: list[int | None], conf: list[float]) -> list[int | None]:
    out = list(seq)
    for index in range(1, len(out) - 1):
        left, note, right = out[index - 1], out[index], out[index + 1]
        if left is None or note is None or right is None or left != right or note == left:
            continue
        if abs(note - left) <= 2 and conf[index] <= conf[index - 1] and conf[index] <= conf[index + 1]:
            out[index] = left
    return out


def quarters_from_track(track: Track, grid: np.ndarray) -> tuple[list[int | None], list[float]]:
    pitches: list[int | None] = []
    conf: list[float] = []
    for start, end in zip(grid[:-1], grid[1:]):
        midi, weight = dominant_pitch(track, float(start), float(end))
        pitches.append(midi)
        conf.append(weight)
    pitches = fold_octaves(pitches)
    pitches = despike(pitches, conf)
    return pitches, conf


def similarity(left: list[int | None], right: list[int | None]) -> float:
    compared = 0
    matched = 0
    for a, b in zip(left, right):
        if a is None and b is None:
            continue
        compared += 1
        if a is None or b is None:
            continue
        distance = abs(a - b) % 12
        distance = min(distance, 12 - distance)
        if distance <= 1:
            matched += 1
    if compared < 8:
        return 0.0
    return matched / compared


def merge_notes(pitches: list[int | None]) -> list[dict]:
    events: list[dict] = []
    for pitch in pitches:
        if events and events[-1]["pitch"] == pitch:
            events[-1]["beats"] += 1
        else:
            events.append({"pitch": pitch, "beats": 1})
    split: list[dict] = []
    for event in events:
        remaining = int(event["beats"])
        while remaining > 0:
            if remaining >= 4:
                take = 4
            elif remaining >= 2:
                take = 2
            else:
                take = 1
            split.append({"pitch": event["pitch"], "beats": take})
            remaining -= take
    while split and split[0]["pitch"] is None:
        split.pop(0)
    while split and split[-1]["pitch"] is None:
        split.pop()
    return split


def place_in_range(midis: list[int]) -> tuple[list[int], int]:
    best: tuple[tuple[int, int, int], list[int]] | None = None
    for octave in range(-3, 4):
        shifted = [midi + 12 * octave for midi in midis]
        folded: list[int] = []
        damage = 0
        folds = 0
        previous_raw: int | None = None
        previous: int | None = None
        for raw in shifted:
            note = raw
            while note > HIGH_MIDI:
                note -= 12
            while note < LOW_MIDI:
                note += 12
            if note != raw:
                folds += 1
            if previous is not None and previous_raw is not None:
                if abs((note - previous) - (raw - previous_raw)) > 6:
                    damage += 1
            folded.append(note)
            previous_raw = raw
            previous = note
        key = (damage, folds, abs(octave))
        if best is None or key < best[0]:
            best = (key, folded)
    assert best is not None
    return best[1], best[0][0]


def transpose_fewest_black(midis: list[int]) -> tuple[list[int], int, int]:
    best: tuple[tuple[int, int, int], list[int], int] | None = None
    for semi in range(12):
        shifted = [midi + semi for midi in midis]
        black = sum(1 for midi in shifted if midi % 12 in BLACK)
        placed, damage = place_in_range(shifted)
        key = (black, damage, min(semi, 12 - semi))
        if best is None or key < best[0]:
            best = (key, placed, semi)
    assert best is not None
    return best[1], best[2], best[0][0]


def find_chorus(
    pitches: list[int | None], energy: np.ndarray, grid: np.ndarray
) -> tuple[int, int]:
    length_choices = list(range(16, 49, 4))
    candidates: list[tuple[float, int, int, int, float]] = []
    total = len(pitches)
    for length in length_choices:
        starts = range(0, total - length, 2)
        windows = [(start, pitches[start : start + length]) for start in starts]
        for start, window in windows:
            sounded = sum(pitch is not None for pitch in window)
            if sounded < length * 0.4:
                continue
            repeats = 0
            best_sim = 0.0
            for other, other_window in windows:
                if abs(other - start) < length:
                    continue
                sim = similarity(window, other_window)
                best_sim = max(best_sim, sim)
                # A loose match counts as "sort of the same". A chorus comes back intact.
                if sim >= 0.75:
                    repeats += 1
            if repeats < 1:
                continue
            merged = merge_notes(window)
            note_count = len(merged)
            loud = float(np.mean(energy[start : start + length])) if len(energy) else 1.0
            score = best_sim * (1 + repeats) * (0.4 + loud) * (sounded / length)
            if 16 <= note_count <= 32:
                score *= 1.15
            else:
                score *= 0.7
            # Keep a long repeated phrase when it still fits in 32 notes.
            score *= 0.65 + 0.35 * (length / 48)
            # The intro is rarely the chorus, even when a riff repeats.
            if grid[start] < 18:
                score *= 0.65
            candidates.append((score, start, length, repeats, best_sim))
    if not candidates:
        raise SystemExit("could not find a repeated chorus")
    candidates.sort(key=lambda item: item[0], reverse=True)
    print("chorus candidates:", flush=True)
    for score, start, length, repeats, sim in candidates[:6]:
        print(
            f"  t={grid[start]:6.2f}s beats={length:2d} repeats={repeats} sim={sim:.2f} score={score:.3f}",
            flush=True,
        )
    _score, start, length, _repeats, _sim = candidates[0]
    return start, length


def fit_note_count(pitches: list[int | None], start: int, length: int) -> tuple[int, int, list[dict]]:
    """Grow or trim by bars until the merged melody has 16–32 notes."""
    end = start + length
    notes = merge_notes(pitches[start:end])
    while len(notes) < 16 and end + 4 <= len(pitches):
        end += 4
        notes = merge_notes(pitches[start:end])
    while len(notes) > 32 and end - start > 16:
        end -= 4
        notes = merge_notes(pitches[start:end])
        if len(notes) < 16:
            end += 4
            notes = merge_notes(pitches[start:end])
            break
    if len(notes) > 32:
        # Drop notes from the end, keeping a whole number of beats when possible.
        trimmed: list[dict] = []
        for note in notes:
            trimmed.append(note)
            if len(trimmed) >= 32:
                break
        notes = trimmed
    if len(notes) < 16:
        raise SystemExit(f"chorus simplified to {len(notes)} notes, need 16–32")
    return start, end, notes


def to_song_notes(raw: list[dict], transpose_index: list[int]) -> list[dict]:
    """raw pitches are original-key MIDI or None. transpose_index aligns with sounded notes."""
    sounded = [note["pitch"] for note in raw if note["pitch"] is not None]
    if len(sounded) != len(transpose_index):
        raise SystemExit("transpose length does not match sounded notes")
    cursor = 0
    melody = []
    for note in raw:
        if note["pitch"] is None:
            melody.append({"pitch": None, "beats": note["beats"]})
            continue
        midi = transpose_index[cursor]
        cursor += 1
        if midi < LOW_MIDI or midi > HIGH_MIDI:
            raise SystemExit(f"{midi_name(midi)} fell outside C4–E5")
        melody.append({"pitch": midi_name(midi), "beats": note["beats"]})
    return melody


def vocal_energy(audio: np.ndarray, sr: int, grid: np.ndarray) -> np.ndarray:
    energy = np.zeros(len(grid) - 1)
    for index, (start, end) in enumerate(zip(grid[:-1], grid[1:])):
        a = max(0, int(start * sr))
        b = min(len(audio), int(end * sr))
        if b <= a:
            continue
        energy[index] = float(np.sqrt(np.mean(np.square(audio[a:b]))))
    peak = float(energy.max()) or 1.0
    return energy / peak


def choose_track(tracks: list[Track]) -> Track:
    ranked = sorted(tracks, key=lambda track: track.score(), reverse=True)
    print("pitch scores:", flush=True)
    for track in ranked:
        print(f"  {track.name:12s} {track.score():.3f}", flush=True)
    if ranked[0].score() < 0:
        raise SystemExit("every pitch tracker failed")
    return ranked[0]


def agreement(reference: list[int | None], other: list[int | None]) -> float:
    compared = 0
    close = 0
    for left, right in zip(reference, other):
        if left is None:
            continue
        compared += 1
        if right is None:
            continue
        distance = abs(left - right) % 12
        distance = min(distance, 12 - distance)
        if distance <= 1:
            close += 1
    return close / compared if compared else 0.0


def save_spectrogram(
    vocals: np.ndarray,
    sr: int,
    tracks: list[Track],
    chosen: str,
    grid: np.ndarray,
    start: int,
    end: int,
    pitches: list[int | None],
    dest: Path,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    t0 = float(grid[start])
    t1 = float(grid[end])
    a = max(0, int((t0 - 0.3) * sr))
    b = min(len(vocals), int((t1 + 0.3) * sr))
    clip = vocals[a:b]
    fig, ax = plt.subplots(figsize=(14, 5))
    ax.specgram(clip, NFFT=2048, Fs=sr, noverlap=1536, cmap="magma", scale="dB")
    colors = {"pyin": "#7fd1ff", "torchcrepe": "#b8ff7a", "basic-pitch": "#ffd36b"}
    for track in tracks:
        mask = (track.times >= t0) & (track.times <= t1) & (track.confidence > 0.45)
        if not np.any(mask):
            continue
        width = 2.4 if track.name == chosen else 1.0
        alpha = 0.95 if track.name == chosen else 0.45
        ax.plot(track.times[mask] - a / sr, midi_to_hz(track.midi[mask]), color=colors.get(track.name, "white"), lw=width, alpha=alpha, label=track.name)
    for index in range(start, end):
        pitch = pitches[index]
        if pitch is None:
            continue
        ax.hlines(midi_to_hz(pitch), grid[index] - a / sr, grid[index + 1] - a / sr, color="white", lw=2.0)
    ax.set_ylim(80, 1200)
    ax.set_xlim(0, (b - a) / sr)
    ax.set_ylabel("Hz")
    ax.set_xlabel("seconds into chorus window")
    ax.legend(loc="upper right")
    fig.tight_layout()
    dest.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(dest, dpi=110)
    plt.close(fig)


def slug(text: str) -> str:
    folded = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return folded or "song"


def upsert(path: Path, song: dict) -> None:
    songs = []
    if path.exists():
        songs = json.loads(path.read_text())
        if not isinstance(songs, list):
            raise SystemExit(f"{path} is not a list")
    songs = [item for item in songs if item.get("id") != song["id"]]
    songs.append(song)
    path.write_text(json.dumps(songs, ensure_ascii=False, indent=2) + "\n")


def build_song(args: argparse.Namespace, melody: list[dict], bpm: float, start_sec: float, method: str) -> dict:
    aliases = [part.strip() for part in args.aliases.split(",") if part.strip()] if args.aliases else []
    title = args.title or args.query or args.youtube_id
    return {
        "id": args.id or slug(title),
        "title": title,
        "reading": args.reading or title,
        "romaji": args.romaji or slug(title).replace("-", ""),
        "aliases": aliases,
        "emoji": args.emoji,
        "picture": "emoji",
        "accent": args.accent,
        "bpm": round(bpm, 2),
        "meter": [4, 4],
        "youtubeId": args.youtube_id,
        "startSec": round(start_sec, 3),
        "melody": melody,
        "origin": {
            "type": "extraction",
            "label": (
                f"Chorus of the official video, simplified to one hand. "
                f"Demucs vocals, {method} pitch, librosa beat, transposed into C4–E5."
            ),
            "sourceUrl": f"https://www.youtube.com/watch?v={args.youtube_id}",
        },
    }


def check_youtube_id(query: str | None, youtube_id: str) -> None:
    if not YOUTUBE_ID.match(youtube_id):
        raise SystemExit("--youtube-id must be an 11-character YouTube id")
    if not query:
        return
    for pattern in URL_ID:
        found = pattern.search(query)
        if found and found.group(1) != youtube_id:
            raise SystemExit(f"URL id {found.group(1)} does not match --youtube-id {youtube_id}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Add a YouTube song as a kids' melody")
    parser.add_argument("query", nargs="?", help="YouTube URL or search text, used when --audio is omitted")
    parser.add_argument("--audio", type=Path, help="Local audio or video file")
    parser.add_argument("--youtube-id", required=True)
    parser.add_argument("--cookies", type=Path, help="Optional cookies.txt for yt-dlp. Never commit this file.")
    parser.add_argument("--id")
    parser.add_argument("--title")
    parser.add_argument("--reading")
    parser.add_argument("--romaji")
    parser.add_argument("--emoji", default="🎵")
    parser.add_argument("--aliases", help="Comma-separated search aliases")
    parser.add_argument("--accent", default="#7A4DFF")
    parser.add_argument("--work", type=Path, default=REPO / "tools" / "add-song" / "work")
    parser.add_argument("--extracted", type=Path, default=REPO / "src" / "data" / "extracted.json")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    check_youtube_id(args.query, args.youtube_id)
    if args.cookies and not args.cookies.exists():
        raise SystemExit(f"cookies file not found: {args.cookies}")
    work = args.work
    work.mkdir(parents=True, exist_ok=True)
    if args.audio:
        source = args.audio if args.audio.is_absolute() else REPO / args.audio
        if not source.exists():
            raise SystemExit(f"audio not found: {source}")
    elif args.query:
        source = download_query(args.query, work, args.cookies)
    else:
        raise SystemExit("pass --audio or a search query / URL")

    mix = work / "mix.wav"
    ffmpeg_wav(source, mix)
    vocals_path = separate_vocals(mix, work / "demucs")
    mix_audio, sr = load_mono(mix, 22050)
    vocal_audio, vocal_sr = load_mono(vocals_path, 22050)
    duration = len(vocal_audio) / vocal_sr
    grid, bpm = beat_grid(mix_audio, sr)
    energy = vocal_energy(vocal_audio, vocal_sr, grid)

    tracks: list[Track] = []
    errors: list[str] = []
    for name, maker in (
        ("basic-pitch", lambda: track_basic_pitch(vocals_path, duration)),
        ("torchcrepe", lambda: track_torchcrepe(vocal_audio, vocal_sr)),
        ("pyin", lambda: track_pyin(vocal_audio, vocal_sr)),
    ):
        try:
            tracks.append(cached_track(work, name, maker))
            print(f"tracked {tracks[-1].name}", flush=True)
        except Exception as error:  # a missing model should not hide the others
            errors.append(str(error))
            print(f"pitch tracker failed: {error}", flush=True)
    if not tracks:
        raise SystemExit("no pitch tracker ran: " + "; ".join(errors))
    chosen = choose_track(tracks)
    pitches, _conf = quarters_from_track(chosen, grid)
    by_name = {track.name: quarters_from_track(track, grid)[0] for track in tracks}
    start, length = find_chorus(pitches, energy, grid)
    start, end, merged = fit_note_count(pitches, start, length)
    sounded = [note["pitch"] for note in merged if note["pitch"] is not None]
    black_before = sum(1 for midi in sounded if midi % 12 in BLACK)
    placed, semi, _black = transpose_fewest_black(sounded)
    black_after = sum(1 for midi in placed if midi % 12 in BLACK)
    melody = to_song_notes(merged, placed)
    # Leading rests were removed, so the first event starts on its grid beat.
    raw_slice = pitches[start:end]
    first_sound = next(index for index, pitch in enumerate(raw_slice) if pitch is not None)
    # merge_notes drops leading rests, and fit_note_count may also trim the end.
    # Walk the slice until the merged notes are consumed so startSec matches melody[0].
    consumed = 0
    melody_beats = sum(note["beats"] for note in melody)
    for index, pitch in enumerate(raw_slice):
        if consumed == 0 and pitch is None:
            first_sound = index + 1
            continue
        consumed += 1
        if consumed >= melody_beats:
            break
    start_sec = float(grid[start + first_sound])
    song = build_song(args, melody, bpm, start_sec, chosen.name)
    others = {name: agreement(pitches[start:end], other[start:end]) for name, other in by_name.items() if name != chosen.name}
    report = {
        "method": chosen.name,
        "scores": {track.name: round(track.score(), 3) for track in tracks},
        "agreementWithChosen": {name: round(value, 3) for name, value in others.items()},
        "bpm": song["bpm"],
        "startSec": song["startSec"],
        "beats": [start, end],
        "blackBefore": black_before,
        "blackAfter": black_after,
        "semitoneShift": semi,
        "noteCount": len(melody),
        "melody": melody,
        "rawChorusMidi": pitches[start:end],
        "otherChorusMidi": {
            name: other[start:end] for name, other in by_name.items() if name != chosen.name
        },
        "errors": errors,
    }
    (work / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    save_spectrogram(
        vocal_audio,
        vocal_sr,
        tracks,
        chosen.name,
        grid,
        start,
        min(end, len(grid) - 1),
        pitches,
        work / "chorus.png",
    )
    upsert(args.extracted, song)
    library = REPO / "scripts" / "library.mjs"
    run(["node", str(library)])
    spelled = " ".join(
        ("z" if note["pitch"] is None else note["pitch"]) + (f"*{note['beats']}" if note["beats"] != 1 else "")
        for note in melody
    )
    print("melody", spelled, flush=True)
    print(json.dumps({"id": song["id"], "bpm": song["bpm"], "startSec": song["startSec"], "notes": len(melody), "method": chosen.name, "blackAfter": black_after}, indent=2))


if __name__ == "__main__":
    main()
