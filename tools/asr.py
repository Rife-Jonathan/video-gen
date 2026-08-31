"""Word-level transcription of the Indonesian VO -> SRT + JSON.

No compiler needed: faster-whisper ships CTranslate2 wheels for Windows CPU.
"""
import json
import sys
from faster_whisper import WhisperModel

AUDIO = sys.argv[1] if len(sys.argv) > 1 else "hasil.wav"
MODEL = sys.argv[2] if len(sys.argv) > 2 else "small"
STEM = AUDIO.rsplit(".", 1)[0]

print(f"loading model: {MODEL} (cpu, int8)")
model = WhisperModel(MODEL, device="cpu", compute_type="int8")

segments, info = model.transcribe(
    AUDIO,
    language="id",
    word_timestamps=True,
    vad_filter=False,
)
print(f"detected language: {info.language} (p={info.language_probability:.2f}), "
      f"duration={info.duration:.2f}s")


def ts(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}".replace(".", ",")


segs = []
words = []
for s in segments:
    segs.append({"start": s.start, "end": s.end, "text": s.text.strip()})
    for w in (s.words or []):
        words.append({"start": w.start, "end": w.end, "word": w.word.strip()})
    print(f"[{s.start:6.2f} -> {s.end:6.2f}] {s.text.strip()}")

with open(STEM + "-transcript.json", "w", encoding="utf8") as f:
    json.dump({"segments": segs, "words": words}, f, ensure_ascii=False, indent=1)

with open(STEM + ".srt", "w", encoding="utf8") as f:
    for i, s in enumerate(segs, 1):
        f.write(f"{i}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['text']}\n\n")

print(f"\nwrote vo.srt ({len(segs)} cues) and vo-transcript.json ({len(words)} words)")
