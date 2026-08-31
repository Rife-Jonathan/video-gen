"""Generate the 6-minute long-form composition from the transcript + footage manifest.

Hand-writing ~40 cuts and 84 caption cues is where mistakes live, so the edit is data
here and the HTML is generated. Change EDIT / CAPTION_FIX below and re-run.

Two rules this file encodes:

  1. Every data-media-start comes from the clip's measured `safeStart` (verify-lib.py),
     never a guess. safeStart is the first frame proven free of the demo banner.

  2. Cuts in the opening land on WORDS, not on round numbers. The times in EDIT for
     0-53.5s were read off voice_asli-transcript.json word timings, so "antrean" cuts
     to the queue screen on the syllable.
"""

import html
import json
import os

# Per-brand inputs. Run this from inside brands/<brand>/.
#   python ../../tools/build-longform.py [transcript.json] [durasi_detik]
import sys
TRANSCRIPT = sys.argv[1] if len(sys.argv) > 1 else "vo/voice_asli-transcript.json"
FPS_DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 365.49
LIB = "footage"
OUT = "project/index.html"

lib = {e["name"]: e for e in json.load(open(f"{LIB}/manifest.json", encoding="utf8"))}
tr = json.load(open(TRANSCRIPT, encoding="utf8"))

# --------------------------------------------------------------------------
# The edit. (start, end, clip, rate, offset, camera)
#   rate   — data-playback-rate. 1.0 = real time. The opening runs fast so the
#            viewer sees the whole product instead of waiting through the intro.
#   offset — seconds added to the clip's safeStart, to land on activity.
#   camera — None, or (scale_to, origin) for a push. Used sparingly: only where
#            the narration is pointing at something specific.
# --------------------------------------------------------------------------
EDIT = [
    # ---------- OPENING: sped-up tour, cut on words ----------
    (0.00, 9.82, "landing", 3.0, 0.5, None),

    # empathy — the clinical work itself
    (9.82, 14.48, "examination", 2.0, 0.5, None),
    (14.48, 19.12, "odontogram", 2.0, 0.5, None),

    # the eight things a clinic juggles — one screen per spoken item
    (19.12, 20.72, "appointments", 3.0, 1.0, None),      # "jadwal pasien"
    (20.72, 21.50, "queue", 4.0, 1.0, None),             # "antrean"
    (21.50, 22.46, "patients-detail", 4.0, 1.0, None),   # "rekam medis"
    (22.46, 23.24, "treatments", 4.0, 1.0, None),        # "tindakan"
    (23.24, 24.16, "medicines", 4.0, 1.0, None),         # "stok obat"
    (24.16, 25.04, "invoices-list", 4.0, 1.0, None),     # "transaksi"
    (25.04, 26.02, "commissions", 4.0, 1.0, None),       # "komisi dokter"
    (26.02, 27.78, "staff-report", 3.0, 1.0, None),      # "laporan klinik"

    # problem — "dikelola di banyak tempat yang berbeda": many places, fast
    (27.78, 29.08, "patients-list", 4.0, 1.0, None),
    (29.08, 30.38, "tooth-conditions", 4.0, 1.0, None),
    (30.38, 31.68, "doctors", 4.0, 1.0, None),
    (31.68, 32.98, "nurses", 4.0, 1.0, None),
    (32.98, 34.28, "front-offices", 4.0, 1.0, None),
    (34.28, 35.58, "profile", 4.0, 1.0, None),
    (35.58, 36.88, "doctor-commissions", 4.0, 1.0, None),
    (36.88, 38.08, "reserve-appointment", 4.0, 1.0, None),

    # promise — the workflow chain, cut on each stage the narration names
    (38.08, 40.22, "settings", 3.0, 1.0, None),
    (40.22, 42.92, "dashboard", 3.0, 1.0, None),         # "Dengan DentalCare"
    (42.92, 43.76, "reserve-appointment", 3.0, 4.0, None),  # "booking"
    (43.76, 44.74, "queue", 3.0, 4.0, None),             # "datang ke klinik"
    (44.74, 45.66, "examination", 3.0, 4.0, None),       # "pemeriksaan"
    (45.66, 46.46, "invoices-list", 3.0, 4.0, None),     # "transaksi"
    (46.46, 48.22, "commissions", 3.0, 4.0, None),       # "laporan untuk pemilik"

    # settle to real time on "kita langsung lihat bagaimana aplikasinya bekerja"
    (48.22, 53.56, "dashboard", 1.0, 6.0, None),

    # ---------- WALKTHROUGH: real time ----------
    (53.56, 72.90, "login", 1.0, 0.0, None),
    (72.90, 107.58, "dashboard", 1.0, 0.0, ((1.18, "22% 26%"), 74.0, 6.0)),
    (107.58, 127.72, "patients-list", 1.0, 0.0, None),
    (127.72, 144.32, "appointments", 1.0, 0.0, None),
    (144.32, 164.34, "queue", 1.0, 0.0, None),
    (164.34, 181.30, "treatments", 1.0, 0.0, None),
    (181.30, 194.56, "tooth-conditions", 1.0, 0.0, None),
    (194.56, 209.70, "medicines", 1.0, 0.0, None),
    (209.70, 224.74, "invoices-list", 1.0, 0.0, None),
    (224.74, 243.86, "commissions", 1.0, 0.0, ((1.20, "26% 40%"), 238.0, 5.0)),
    (243.86, 253.86, "staff-report", 1.0, 0.0, None),
    (253.86, 258.60, "doctors", 1.0, 0.0, None),
    (258.60, 262.60, "nurses", 1.0, 0.0, None),
    (262.60, 267.06, "front-offices", 1.0, 0.0, None),
    (267.06, 286.10, "settings", 1.0, 0.0, None),
    (286.10, 329.02, "home-edit", 1.0, 0.0, None),
    (329.02, 352.18, "landing", 1.0, 0.0, None),
    (352.18, FPS_DUR, "dashboard", 1.0, 20.0, None),
]

# --------------------------------------------------------------------------
# Caption text. Whisper heard Indonesian well but misspelled names and terms;
# captions must read correctly, so fix them here. Longest keys first so
# multi-word fixes win over single-word ones.
# --------------------------------------------------------------------------
CAPTION_FIX = {
    "memperkenahkan": "memperkenalkan",
    "dental care": "DentalCare",
    "Dental care": "DentalCare",
    "Dental Care": "DentalCare",
    "tulis antangan": "tulisan tangan",
    "seluran akar": "saluran akar",
    "Matakuang": "Mata uang",
    "management dokter": "manajemen dokter",
    "Check management": "Cek manajemen",
    "dipertanggung jawabkan": "dipertanggungjawabkan",
    "permakasari": "Permatasari",
    "home page editor": "homepage editor",
    "landing page": "landing page",
    "jatual": "jadwal",
    "jatwal": "jadwal",
    "pasian": "pasien",
    "doktor": "dokter",
    "antrian": "antrean",
    "eksel": "Excel",
    "recap": "rekap",
    "telefon": "telepon",
    "whatsapp": "WhatsApp",
    "feviken": "favicon",
    "synchron": "sinkron",
    "dikrik": "diklik",
    "tertip": "tertib",
    "ENV": "INV",
    "galuh": "Galuh",
    "city": "Siti",
    "diatas": "di atas",
    "Diatas": "Di atas",
    "dibawanya": "di bawahnya",
    "Dibawanya": "Di bawahnya",
    "Dibawah": "Di bawah",
    "ketauan": "ketahuan",
    "bagel": "behel",
    "kehitung": "dihitung",
    "sepuluh": "10",
}


def fix(text):
    for k in sorted(CAPTION_FIX, key=len, reverse=True):
        text = text.replace(k, CAPTION_FIX[k])
    return text


def esc(s):
    return html.escape(s, quote=False)


# ---- build clip elements -------------------------------------------------
vids, tweens, scenes = [], [], []
for i, (start, end, clip, rate, off, cam) in enumerate(EDIT):
    if clip not in lib:
        raise SystemExit(f"klip tidak ada di manifest: {clip}")
    e = lib[clip]
    dur = round(end - start, 3)
    media = round(e["safeStart"] + off, 2)
    consumed = dur * rate
    avail = e["safeStart"] + e["usable"] - media
    if consumed > avail + 0.05:
        raise SystemExit(
            f"{clip}: butuh {consumed:.2f}s sumber dari {media:.2f}s, "
            f"tersedia {avail:.2f}s (rate {rate})"
        )

    vid = f"v{i}"
    rate_attr = f' data-playback-rate="{rate}"' if rate != 1.0 else ""
    vids.append(
        f'      <div id="{vid}" class="inner">\n'
        f'        <video id="m{i}" src="public/footage/{clip}.webm"\n'
        f'          data-start="{start:.2f}" data-duration="{dur:.2f}"'
        f' data-media-start="{media:.2f}"{rate_attr}\n'
        f'          data-track-index="{i}" muted playsinline></video>\n'
        f"      </div>"
    )
    scenes.append((vid, start))

    if cam:
        (scale, origin), at, cdur = cam
        tweens.append(f'      tl.set("#{vid}", {{ transformOrigin: "{origin}" }}, 0);')
        tweens.append(
            f'      tl.fromTo("#{vid}", {{ scale: 1.0 }}, '
            f'{{ scale: {scale}, duration: {cdur}, ease: "power1.inOut" }}, {at});'
        )

# ---- captions ------------------------------------------------------------
cues, cue_js = [], []
segs = tr["segments"]
GAP = 0.30  # ASR often ends one sentence exactly where the next begins. The gap must
            # exceed the cue's 0.14s fade-out, or the outgoing cue is still painting
            # when the next one appears — `check` catches that as content_overlap.
for i, s in enumerate(segs):
    txt = fix(s["text"]).strip()
    if not txt:
        continue
    end = min(s["end"], FPS_DUR - 0.1)
    if i + 1 < len(segs):
        end = min(end, segs[i + 1]["start"] - GAP)
    end = max(end, s["start"] + 0.35)  # never collapse a cue to nothing
    cues.append(f'        <div class="cue" id="q{i}">{esc(txt)}</div>')
    cue_js.append(f'        ["#q{i}", {s["start"]:.2f}, {end:.2f}],')

# ---- handoffs ------------------------------------------------------------
handoff = []
for i, (vid, at) in enumerate(scenes):
    if i == 0:
        handoff.append(f'      tl.set("#{vid}", {{ autoAlpha: 1 }}, 0);')
        continue
    prev = scenes[i - 1][0]
    gap = at - scenes[i - 1][1]
    xf = 0.10 if gap < 2.5 else 0.40   # near-cut inside fast bursts, fade between sections
    t = round(at - xf / 2, 3)
    handoff.append(f'      tl.set("#{vid}", {{ autoAlpha: 0 }}, 0);')
    handoff.append(
        f'      tl.to("#{vid}", {{ autoAlpha: 1, duration: {xf}, '
        f'ease: "power2.inOut" }}, {t});'
    )
    handoff.append(
        f'      tl.to("#{prev}", {{ autoAlpha: 0, duration: {xf}, '
        f'ease: "power2.inOut" }}, {t});'
    )

TPL = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "longform-template.html"), encoding="utf8").read()
out = (TPL
       .replace("{{DURATION}}", f"{FPS_DUR:.2f}")
       .replace("{{VIDEOS}}", "\n".join(vids))
       .replace("{{CUES}}", "\n".join(cues))
       .replace("{{HANDOFF}}", "\n".join(handoff))
       .replace("{{TWEENS}}", "\n".join(tweens))
       .replace("{{CUE_JS}}", "\n".join(cue_js)))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf8", newline="\n").write(out)
print(f"tulis {OUT}")
print(f"  {len(EDIT)} potongan, {len(cues)} caption, durasi {FPS_DUR:.2f}s")
used = sorted({c for _, _, c, _, _, _ in EDIT})
print(f"  {len(used)} klip dipakai: {', '.join(used)}")
