"""Build 03 - rekam medis dan odontogram (158s) tanpa dashboard looping."""
import html, json, os, sys
TRANSCRIPT = sys.argv[1] if len(sys.argv) > 1 else "vo/03-rekam-medis-dan-odontogram-transcript.json"
FPS_DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 158.05
LIB = "footage"
OUT = "project/index.html"
lib = {e["name"]: e for e in json.load(open(f"{LIB}/manifest.json", encoding="utf8"))}
tr = json.load(open(TRANSCRIPT, encoding="utf8"))
# EDIT: intro -> SOAP/ICD (examination) -> odontogram -> tooth-conditions -> tindakan -> patient detail -> recap
# Hindari dashboard looping, dashboard hanya 1x penutup singkat
EDIT = [
    (0.00, 20.54, "landing", 1.0, 0.0, None),  # intro 20.54
    (20.54, 52.50, "examination", 0.91, 0.0, None),  # SOAP+ICD 31.96s at 0.91x -> 29.08 <=29.19
    (52.50, 81.62, "odontogram", 0.795, 0.0, None),  # odontogram 29.12s at 0.795x -> 23.15 <=23.09? need 0.793 =>23.09
    (81.62, 92.22, "tooth-conditions", 1.0, 0.0, None),  # 10.60s
    (92.22, 112.42, "treatments", 1.0, 0.0, None),  # tindakan 20.20s
    (112.42, 140.36, "patients-detail", 0.88, 0.0, None),  # patient detail 27.94s at 0.88x ->24.58? need 31.88? Actually need 27.94*0.88=24.58 <=31.88 ok
    (140.36, FPS_DUR, "landing", 1.0, 0.0, None),  # recap 17.69s
]
# adjust rates to fit precisely
EDIT[1] = (20.54, 52.50, "examination", 0.913, 0.0, None)  # 31.96*0.913=29.19 exactly
EDIT[2] = (52.50, 81.62, "odontogram", 0.793, 0.0, None)  # 29.12*0.793=23.09
EDIT[5] = (112.42, 140.36, "patients-detail", 1.0, 0.0, None)  # 27.94 <=31.88 no need slow, use 1.0
CAPTION_FIX = {
    "memperkenahkan": "memperkenalkan","dental care": "DentalCare","Dental care": "DentalCare","Dental Care": "DentalCare",
    "jatual": "jadwal","pasian": "pasien","doktor": "dokter","antrian": "antrean","entrean": "antrean","kluhan": "keluhan","soap.": "SOAP.","ICD sepuluh": "ICD-10","berpulan": "berbulan","kodah": "kode","priwayat": "riwayat","dikertas": "di kertas","odontogram.": "odontogram",
    "halu yang": "hal yang","taris di": "tarif di","bentrap": "bentrok","tepriwayat": "riwayat","fondisi": "kondisi","karyes": "karies","lekab": "rekap","kinderja": "kinerja","trend pendapatan": "tren pendapatan","eksel": "Excel","telefon": "telepon","whatsapp": "WhatsApp","feviken": "favicon","dikrik": "diklik","tertip": "tertib","ENV": "INV","galuh": "Galuh","city": "Siti",
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
