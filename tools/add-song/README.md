# Add a song

`add_song.py` turns a recording into one right-hand melody for the app: Demucs vocals, then Basic Pitch, torchcrepe, and librosa pyin (the strongest track is kept), then a librosa beat grid. Notes are one at a time, quantized to the quarter, and merged into quarter, half, and whole notes. The repeated chorus is kept (16–32 notes), then transposed into C4–E5 with as few black keys as possible.

Audio files and `cookies.txt` are gitignored. Do not commit them.

Setup once:

```bash
python3 -m venv tools/add-song/.venv
tools/add-song/.venv/bin/pip install -r tools/add-song/requirements.txt
tools/add-song/.venv/bin/pip install 'basic-pitch==0.4.0' --no-deps
```

Basic Pitch 0.4 pins an old TensorFlow that has no Python 3.12 wheel, so it is installed with `--no-deps` after TensorFlow itself.

Add the next song:

```bash
tools/add-song/.venv/bin/python tools/add-song/add_song.py --audio <file> --youtube-id <id> --title "曲名"
```

A search or a YouTube URL works in place of `--audio`. Pass `--cookies cookies.txt` when yt-dlp needs a logged-in session. The new song is written to `src/data/extracted.json`, and `scripts/library.mjs` rebuilds `src/data/songs.json`.

## Touch (MAZZEL)

Source file: the official MV audio, YouTube id `DN5JpXHDrLk`. Demucs `htdemucs` separated the vocals. Pitch was tracked three ways and scored for a stable sung line:

| tracker | score |
| --- | --- |
| torchcrepe | 0.647 |
| Basic Pitch (ONNX) | 0.615 |
| librosa pyin | 0.594 |

The TensorFlow copy of Basic Pitch does not load on TensorFlow 2.21, so the script uses the ONNX model shipped in the package. librosa’s beat tracker locked to 103.4 BPM (grid 103.36), which matches the recording. The sung notes are in G major. Transposing up 5 semitones puts that scale on the white keys, inside C4–E5.

The chorus is the phrase that returns intact: it starts at 37.7 seconds and again just after 1:40. The entry keeps the first one (`startSec` 37.686), 32 beats, 24 notes after merging.

Before the hand fixes, torchcrepe and Basic Pitch agreed within a semitone on 84% of those beats. Three beats were clearly wrong and were changed:

1. At 40.6s torchcrepe left a rest. Basic Pitch and pyin both had E4, so the rest became that note (A4 after the transpose, between C4 and G4).
2. At 47.0s torchcrepe spiked to D4 in a run of A3s. The other two trackers stayed on A3, so the spike was removed (the transposed G4 became another D4).
3. At 54.5s only torchcrepe heard a low E3. The other two were silent, so that beat is a rest instead of the A4 the range fit had produced.

The last two beats were an octave low in torchcrepe (D3 against D4). Folding them into C4–E5 had already put them on G4, so the keys did not change. A few other beats differed from Basic Pitch by an octave while pyin was silent; those stayed with torchcrepe. Running the script again overwrites this hand edit.
