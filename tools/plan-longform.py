"""Map the 6-minute narration onto the footage library and report the gaps.

The narration follows the user's framework:
  OPENING -> EMPATHY -> PROBLEM -> PROMISE -> DEMO WORKFLOW -> RECAP -> POSITIONING -> CTA

Section boundaries below are read off voice_asli-transcript.json by hand: each is the
start time of the sentence that opens that section. The point of this script is to say,
per section, whether the library already has enough usable footage or whether that clip
must be re-recorded with a longer dwell.
"""

import json

SECTIONS = [
    # (start, label, clip needed, note)
    (0.00, "opening", None, "intro — kartu judul / landing page"),
    (9.82, "empathy", None, "montase masalah"),
    (27.78, "problem", None, "eskalasi"),
    (38.08, "promise", None, "janji + 'kita langsung lihat'"),
    (53.56, "login", "login", "BARU — belum ada di pustaka"),
    (72.90, "dashboard", "dashboard", ""),
    (107.58, "patients", "patients-list", ""),
    (127.72, "appointments", "appointments", ""),
    (144.32, "queue", "queue", ""),
    (164.34, "treatments", "treatments", ""),
    (181.30, "tooth-conditions", "tooth-conditions", ""),
    (194.56, "medicines", "medicines", ""),
    (209.70, "invoices", "invoices-list", ""),
    (224.74, "commissions", "commissions", ""),
    (243.86, "staff-report", "staff-report", ""),
    (253.86, "team", "doctors", "boleh dipotong ke nurses / front-offices"),
    (267.06, "settings", "settings", ""),
    (286.10, "home-edit", "home-edit", ""),
    (329.02, "landing", "landing", "BARU — situs publik, belum direkam"),
    (352.18, "recap-cta", None, "kartu penutup"),
]
TOTAL = 365.49

lib = {e["name"]: e for e in json.load(open("footage/manifest.json", encoding="utf8"))}

print(f"{'bagian':18} {'mulai':>7} {'durasi':>7} {'punya':>7}  status")
gaps = []
for i, (start, label, clip, note) in enumerate(SECTIONS):
    end = SECTIONS[i + 1][0] if i + 1 < len(SECTIONS) else TOTAL
    need = round(end - start, 2)

    if clip is None:
        print(f"{label:18} {start:7.2f} {need:7.2f} {'-':>7}  kartu/montase — {note}")
        continue

    if clip not in lib:
        print(f"{label:18} {start:7.2f} {need:7.2f} {'0':>7}  REKAM BARU — {note}")
        gaps.append((clip, need, "baru"))
        continue

    have = lib[clip]["usable"]
    if have >= need:
        print(f"{label:18} {start:7.2f} {need:7.2f} {have:7.2f}  cukup")
    else:
        short = round(need - have, 2)
        print(f"{label:18} {start:7.2f} {need:7.2f} {have:7.2f}  KURANG {short}s")
        gaps.append((clip, need, f"kurang {short}s"))

print("\nyang perlu direkam ulang / baru:")
for clip, need, why in gaps:
    print(f"  {clip:20} butuh >= {need:6.2f}s  ({why})")
if not gaps:
    print("  tidak ada")
