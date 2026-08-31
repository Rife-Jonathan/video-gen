# video-gen

Pipeline produksi video review aplikasi: naskah → suara → rekam layar → edit → render.
Dipakai untuk banyak brand dari satu set alat.

Video keluaran dibangun sebagai komposisi HTML ([HyperFrames](https://hyperframes.dev)),
bukan diedit di timeline. Artinya komposisinya dibangkitkan skrip dari transkrip
word-level, jadi potongan jatuh tepat di kata yang diucapkan.

## Alur

```
naskah/*.txt  ──[ekstensi Chrome TTS]──▶  vo/*.wav
                                            │
                        [faster-whisper]────┤
                                            ▼
                                   transkrip word-level
                                            │
footage/*.webm ──[verify-lib.py]──▶ manifest.json (safeStart, usable)
                                            │
                                            ▼
                              [build-longform.py] ──▶ project/index.html
                                            │
                                            ▼
                                  [hyperframes render] ──▶ out/NN-*.mp4
```

## Isi

| Folder | Isi |
|---|---|
| `tools/` | Semua alat, satu salinan, dipakai semua brand |
| `chrome-ext-tts/` | Ekstensi Chrome untuk generate voice-over massal di Google AI Studio |
| `brands/<nama>/` | Aset per brand: naskah, VO, footage, proyek, hasil render |
| `AGENTS.md` | Aturan kerja yang tidak boleh dilanggar (dibaca Claude Code & opencode) |
| `SOP.md` | Prosedur lengkap + troubleshooting |
| `HANDOFF.md` | Keadaan terakhir proyek, untuk melanjutkan sesi |

### Alat di `tools/`

| Berkas | Fungsi |
|---|---|
| `record-library.js` | Sapuan seluruh fitur aplikasi → `footage/` |
| `record-longform.js` | Klip durasi panjang, termasuk login dan landing publik |
| `capture.js` | Screenshot resolusi tinggi semua halaman → `shots/` |
| `asr.py` | Transkripsi word-level (faster-whisper) |
| `verify-lib.py` | Gerbang footage: hitung `safeStart` dan durasi terpakai |
| `plan-longform.py` | Petakan narasi ke footage, laporkan kekurangan |
| `build-longform.py` | Bangkitkan komposisi HyperFrames dari tabel `EDIT` |

## Menjalankan

Semua alat dijalankan **dari dalam folder brand**, bukan dari root — alat memakai
`process.cwd()`.

```bash
cd brands/dental-care

node ../../tools/record-library.js                          # rekam semua fitur
../../.venv-asr/Scripts/python.exe ../../tools/verify-lib.py  # gerbang footage
../../.venv-asr/Scripts/python.exe ../../tools/asr.py vo/01-walkthrough-lengkap.wav small
../../.venv-asr/Scripts/python.exe ../../tools/build-longform.py \
    vo/01-walkthrough-lengkap-transcript.json 347

cd project && hyperframes check && hyperframes render -o out/04-hasil.mp4
```

Brand baru:

```bash
mkdir -p brands/<nama>/{naskah,vo,footage,shots,project}
```

## Yang tidak masuk repo

Footage mentah (`*.webm`), voice-over (`*.wav`), dan screenshot sengaja diabaikan —
semuanya bisa dibangkitkan ulang dari naskah dan skrip perekam. Yang ikut:
`footage/manifest.json` (peta `safeStart` yang mahal dibuat), transkrip ASR, dan
hasil render di `project/out/`.

## Prasyarat

- Node 20+ dan Playwright (Chromium)
- `hyperframes` CLI
- FFmpeg
- Python 3 dengan `faster-whisper` (repo ini memakai venv `.venv-asr/`)

## Catatan

Repo ini ditulis untuk dikerjakan bersama coding agent. `AGENTS.md` memuat aturan yang
lahir dari kesalahan nyata — kenapa banner demo harus disembunyikan lewat CSS dan bukan
JS, kenapa `safeStart` dan bukan `contentStart`, kenapa satu sampel frame tidak
membuktikan klip bersih. Baca berkas itu sebelum mengubah apa pun.
