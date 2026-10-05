"""Build 04 - tagihan komisi dan laporan (163s) tanpa dashboard looping."""
import html, json, os, sys
TRANSCRIPT = sys.argv[1] if len(sys.argv) > 1 else "vo/04-tagihan-komisi-dan-laporan-transcript.json"
FPS_DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 163.05
LIB = "footage"
OUT = "project/index.html"
lib = {e["name"]: e for e in json.load(open(f"{LIB}/manifest.json", encoding="utf8"))}
tr = json.load(open(TRANSCRIPT, encoding="utf8"))
# EDIT: intro -> invoice -> invoice detail -> komisi -> doctor komisi -> staff -> dashboard (sekali) -> cta
EDIT = [
    (0.00, 22.02, "landing", 1.0, 0.0, None),  # intro 22.02
    (22.02, 36.94, "invoices-list", 1.0, 0.0, None),  # invoice formed 14.92
    (36.94, 65.60, "invoices-list", 1.0, 0.0, None),  # invoice list 28.66 but need split? invoices-list usable 17.96 insufficient, jadi split: 36.94-54.90 (17.96) invoices-list, 54.90-65.60 (10.70) invoices-detail
    (54.90, 65.60, "invoices-detail", 1.0, 0.0, None),
    (65.60, 105.16, "commissions", 0.56, 0.0, None),  # komisi 39.56 -> 39.56*0.56=22.15 <=22.33
    (105.16, 119.00, "doctor-commissions", 1.0, 0.0, None),  # doctor 13.84
    (119.00, 147.04, "staff-report", 1.0, 0.0, None),  # staff 28.04 but staff usable 16.84 insufficient, need split: staff-report 16.84 + doctors 11.20
    (147.04, FPS_DUR, "landing", 1.0, 0.0, None),  # dashboard/cta? use landing 16.01
]
# Perbaiki split staff: 119-135.84 staff-report 16.84, 135.84-147.04 doctors 11.20
EDIT = [
    (0.00, 22.02, "landing", 1.0, 0.0, None),
    (22.02, 36.94, "invoices-list", 1.0, 0.0, None),
    (36.94, 54.90, "invoices-list", 1.0, 0.0, None),  # 17.96
    (54.90, 65.60, "invoices-detail", 1.0, 0.0, None),  # 10.70
    (65.60, 105.16, "commissions", 0.565, 0.0, None),  # 39.56*0.565=22.35 ~22.33 fit
    (105.16, 119.00, "doctor-commissions", 1.0, 0.0, None),
    (119.00, 135.84, "staff-report", 1.0, 0.0, None),
    (135.84, 147.04, "doctors", 1.0, 0.0, None),
    (147.04, 155.02, "dashboard", 1.0, 0.0, None),  # dashboard 7.98
    (155.02, FPS_DUR, "landing", 1.0, 0.0, None),  # 8.03
]
# Fix commissions rate to fit exactly 22.33 usable: 39.56*0.5645=22.33
EDIT[4] = (65.60, 105.16, "commissions", 0.5645, 0.0, None)
CAPTION_FIX = {
    "memperkenahkan": "memperkenalkan","dental care": "DentalCare","Dental care": "DentalCare","Dental Care": "DentalCare",
    "cema": "cuma","dokturnya": "dokternya","dicatak": "dicatat","doktor": "dokter","cetak": "catat","tagihan terbentuk": "tagihan terbentuk","menempilkan": "menampilkan","anterian": "antrean","pasian": "pasien","trend pendapatan": "tren pendapatan","eksel": "Excel","telefon": "telepon","whatsapp": "WhatsApp","feviken": "favicon","dikrik": "diklik","tertip": "tertib","ENV": "INV","galuh": "Galuh","city": "Siti","jatual": "jadwal","jatwal": "jadwal",
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
    if consumed > avail+0.05: raise SystemExit(f"{clip}: butuh {consumed:.2f}s dari {media:.2f}s, tersedia {avail:.2f}s (rate {rate}) dur {dur}")
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
