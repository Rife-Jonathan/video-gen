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
    # ---------- OPENING: 0-67.60 — fast tour, synced to new TTS word timings ----------
    (0.00, 11.86, "landing", 3.0, 0.0, None),  # intro
    (11.86, 22.52, "examination", 1.0, 0.0, None),  # "Sebagai dokter gigi..."
    # list "jadwal dan antrean, rekam medis, stok obat, tagihan, komisi, laporan" — per-item fast cuts
    (22.52, 23.64, "appointments", 4.0, 0.0, None),  # "jadwal"
    (23.64, 24.64, "queue", 4.0, 0.0, None),  # "antrean"
    (24.64, 25.70, "patients-detail", 4.0, 0.0, None),  # "rekam medis"
    (25.70, 26.34, "medicines", 4.0, 0.0, None),  # "stok obat"
    (26.34, 27.62, "invoices-list", 4.0, 0.0, None),  # "Tagihan"
    (27.62, 28.56, "commissions", 4.0, 0.0, None),  # "komisi"
    (28.56, 30.78, "staff-report", 4.0, 0.0, None),  # "laporan bulanan"
    # problem — scattered management
    (30.78, 46.48, "patients-list", 1.0, 0.0, None),
    # promise — workflow chain sped up
    (46.48, 55.00, "dashboard", 2.0, 0.0, None),
    (55.00, 67.60, "landing", 2.0, 0.0, None),

    # ---------- WALKTHROUGH: real time, per-paragraph ----------
    (67.60, 86.23, "appointments", 1.0, 0.0, ((1.18, "22% 26%"), 75.0, 6.0)),  # appointment 18.63s
    (86.23, 96.64, "reserve-appointment", 1.0, 0.0, None),  # appointment continuation 10.41s
    (96.64, 122.14, "queue", 1.0, 0.0, None),  # antrean 25.50s
    (122.14, 136.01, "examination", 1.0, 0.0, None),  # pemeriksaan part1 13.87s
    (136.01, 151.94, "odontogram", 1.0, 0.0, None),  # pemeriksaan part2 15.93s
    (151.94, 155.36, "tooth-conditions", 1.0, 0.0, None),  # pemeriksaan part3 3.42s
    (155.36, 175.92, "treatments", 1.0, 0.0, None),  # tindakan 20.56s
    (175.92, 196.90, "medicines", 0.85, 0.0, None),  # obat 20.98s at 0.85x to fit 18.22 usable
    (196.90, 214.86, "invoices-list", 1.0, 0.0, None),  # invoice part1 17.96s
    (214.86, 222.66, "invoices-detail", 1.0, 0.0, None),  # invoice part2 7.80s
    (222.66, 244.99, "commissions", 1.0, 0.0, ((1.20, "26% 40%"), 230.0, 5.0)),  # komisi part1 22.33s
    (244.99, 249.88, "doctor-commissions", 1.0, 0.0, None),  # komisi part2 4.89s
    (249.88, 266.72, "staff-report", 1.0, 0.0, None),  # staff part1 16.84s
    (266.72, 279.24, "doctors", 1.0, 0.0, None),  # staff part2 12.52s
    (279.24, 311.08, "home-edit", 1.0, 0.0, None),  # homepage 31.84s
    (311.08, 324.38, "dashboard", 1.0, 0.0, None),  # recap 13.30s
    (324.38, 338.08, "settings", 1.0, 0.0, None),  # positioning 13.70s
    (338.08, FPS_DUR, "landing", 1.0, 0.0, None),  # cta 8.50s to end
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
    "entrean": "antrean",
    "Antrean": "Antrean",
    "entrian": "antrean",
    "edis,": "medis,",
    "edis di": "medis di",
    "halu yang": "hal yang",
    "taris di": "tarif di",
    "bentrap": "bentrok",
    "tepriwayat": "riwayat",
    "fondisi": "kondisi",
    "karyes": "karies",
    "lekab": "rekap",
    "lekap staff": "rekap staff",
    "kinderja": "kinerja",
    "anterian": "antrean",
    "trend pendapatan": "tren pendapatan",
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
