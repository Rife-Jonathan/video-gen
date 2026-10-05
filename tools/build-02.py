"""Build 02 - antrean dan appointment (188s) tanpa dashboard looping."""
import html, json, os, sys
TRANSCRIPT = sys.argv[1] if len(sys.argv) > 1 else "vo/02-antrean-dan-appointment-transcript.json"
FPS_DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 188.85
LIB = "footage"
OUT = "project/index.html"
lib = {e["name"]: e for e in json.load(open(f"{LIB}/manifest.json", encoding="utf8"))}
tr = json.load(open(TRANSCRIPT, encoding="utf8"))
# EDIT tanpa dashboard looping — hanya landing 1x intro, reserve/appointments/queue/patients-detail, landing penutup
EDIT = [
    (0.00, 27.86, "landing", 1.0, 0.0, None),  # intro
    (27.86, 48.04, "reserve-appointment", 1.0, 0.0, None),  # form reservasi 20.18s
    (48.04, 86.70, "appointments", 0.91, 0.0, None),  # appointment 38.66s at 0.91x -> 35.18 <=35.15 (fit)
    (86.70, 138.88, "queue", 0.752, 0.0, None),  # queue 52.18s at 0.752x -> 39.24
    (138.88, 152.40, "patients-detail", 1.0, 0.0, None),  # patient 13.52s
    (152.40, FPS_DUR, "landing", 0.99, 0.0, None),  # recap 36.45s at 0.99x -> 36.08 <=35.75? 36.45*0.99=36.08 slightly over, need 0.98 =>35.72
]
# adjust last to fit: gunakan 0.98
EDIT[-1] = (152.40, FPS_DUR, "landing", 0.98, 0.0, None)
CAPTION_FIX = {
    "memperkenahkan": "memperkenalkan","dental care": "DentalCare","Dental care": "DentalCare","Dental Care": "DentalCare",
    "jatual": "jadwal","jatwal": "jadwal","pasian": "pasien","doktor": "dokter","antrian": "antrean","entrean": "antrean","entrian": "antrean","anterian": "antrean","edsel": "medis,",
    "edis,": "medis,","halu yang": "hal yang","taris di": "tarif di","bentrap": "bentrok","tepriwayat": "riwayat","tep riwayat": "riwayat","fondisi": "kondisi","karyes": "karies","lekab": "rekap","kinderja": "kinerja","trend pendapatan": "tren pendapatan","eksel": "Excel","telefon": "telepon","whatsapp": "WhatsApp","feviken": "favicon","dikrik": "diklik","tertip": "tertib","ENV": "INV","galuh": "Galuh","city": "Siti","diatas": "di atas","ketauan": "ketahuan","bagel": "behel","kehitung": "dihitung",
}
def fix(text):
    for k in sorted(CAPTION_FIX, key=len, reverse=True):
        text=text.replace(k,CAPTION_FIX[k])
    return text
def esc(s): return html.escape(s, quote=False)
vids,tweens,scenes=[],[],[]
for i,(start,end,clip,rate,off,cam) in enumerate(EDIT):
    if clip not in lib: raise SystemExit(f"klip tidak ada: {clip}")
    e=lib[clip]; dur=round(end-start,3); media=round(e["safeStart"]+off,2); consumed=dur*rate; avail=e["safeStart"]+e["usable"]-media
    if consumed > avail+0.05: raise SystemExit(f"{clip}: butuh {consumed:.2f}s dari {media:.2f}s, tersedia {avail:.2f}s (rate {rate})")
    vid=f"v{i}"; rate_attr=f' data-playback-rate="{rate}"' if rate!=1.0 else ""
    vids.append(f'      <div id="{vid}" class="inner">\n        <video id="m{i}" src="public/footage/{clip}.webm"\n          data-start="{start:.2f}" data-duration="{dur:.2f}" data-media-start="{media:.2f}"{rate_attr}\n          data-track-index="{i}" muted playsinline></video>\n      </div>')
    scenes.append((vid,start))
    if cam:
        (scale,origin),at,cdur=cam
        tweens.append(f'      tl.set("#{vid}", {{ transformOrigin: "{origin}" }}, 0);')
        tweens.append(f'      tl.fromTo("#{vid}", {{ scale: 1.0 }}, {{ scale: {scale}, duration: {cdur}, ease: "power1.inOut" }}, {at});')
cues,cue_js=[],[]
segs=tr["segments"]; GAP=0.30
for i,s in enumerate(segs):
    txt=fix(s["text"]).strip()
    if not txt: continue
    end=min(s["end"],FPS_DUR-0.1)
    if i+1<len(segs): end=min(end,segs[i+1]["start"]-GAP)
    end=max(end,s["start"]+0.35)
    cues.append(f'        <div class="cue" id="q{i}">{esc(txt)}</div>')
    cue_js.append(f'        ["#q{i}", {s["start"]:.2f}, {end:.2f}],')
handoff=[]
for i,(vid,at) in enumerate(scenes):
    if i==0: handoff.append(f'      tl.set("#{vid}", {{ autoAlpha: 1 }}, 0);'); continue
    prev=scenes[i-1][0]; gap=at-scenes[i-1][1]; xf=0.10 if gap<2.5 else 0.40; t=round(at-xf/2,3)
    handoff.append(f'      tl.set("#{vid}", {{ autoAlpha: 0 }}, 0);')
    handoff.append(f'      tl.to("#{vid}", {{ autoAlpha: 1, duration: {xf}, ease: "power2.inOut" }}, {t});')
    handoff.append(f'      tl.to("#{prev}", {{ autoAlpha: 0, duration: {xf}, ease: "power2.inOut" }}, {t});')
TPL=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"longform-template.html"),encoding="utf8").read()
out=(TPL.replace("{{DURATION}}",f"{FPS_DUR:.2f}").replace("{{VIDEOS}}","\n".join(vids)).replace("{{CUES}}","\n".join(cues)).replace("{{HANDOFF}}","\n".join(handoff)).replace("{{TWEENS}}","\n".join(tweens)).replace("{{CUE_JS}}","\n".join(cue_js)))
os.makedirs(os.path.dirname(OUT),exist_ok=True)
open(OUT,"w",encoding="utf8",newline="\n").write(out)
print(f"tulis {OUT}"); print(f"  {len(EDIT)} potongan, {len(cues)} caption, durasi {FPS_DUR:.2f}s"); used=sorted({c for _,_,c,_,_,_ in EDIT}); print(f"  {len(used)} klip dipakai: {', '.join(used)}")
