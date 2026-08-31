# HANDOFF — video-gen

Sesi terakhir: **31 Agustus 2026**. Baca `AGENTS.md` dulu (aturan kerja), lalu berkas ini.

Berlaku untuk agent mana pun. `CLAUDE.md` cuma mengimpor `AGENTS.md`; opencode membaca
`AGENTS.md` langsung. Jangan menulis aturan ke `CLAUDE.md`.

---

## Goal

Bikin video review aplikasi secara otomatis: naskah → suara → rekam layar → edit → render.
Ke depan dipakai untuk **banyak brand**, jadi alat dan aset sudah dipisah.

Brand pertama: **DentalCare Studio** (klinik gigi), demo di
`https://demo-dokter-gigi.nusawebsite.com`, halaman produk
`https://www.nusawebsite.com/dental-care/`.

---

## Current Progress

### Sudah jadi dan terverifikasi

| Hasil | Lokasi | Catatan |
|---|---|---|
| Video review 52 detik | `brands/dental-care/project/out/01-review-52s.mp4` | versi pertama, ditolak user: terasa mengulang |
| Video review 52 detik v2 | `.../out/02-review-52s-v2.mp4` | 15 visual berbeda, zoom cuma 2 tempat — **diterima** |
| Walkthrough 6 menit | `.../out/03-walkthrough-6m.mp4` | 79 MB, pakai VO asli user, render 17m58s |
| Pustaka footage | `brands/dental-care/footage/` | **26 klip**, semua terverifikasi bebas banner |
| Naskah framework | `brands/dental-care/naskah-framework.txt` | plain teks, 16 paragraf, 707 kata, ±5 menit |
| Naskah per video | `brands/dental-care/naskah/` | 4 `.txt`, **1 txt = 1 video = 1 request TTS** |
| VO walkthrough | `brands/dental-care/vo/01-walkthrough-lengkap.wav` | 5m47s, gabungan 16 potongan TTS, jeda 0,35s |
| Ekstensi Chrome TTS | `chrome-ext-tts/` | **terbukti jalan** — 16/16 `.wav` berhasil di sesi 31 Agu |
| SOP | `SOP.md` | 10 bagian + §6b khusus video panjang |
| Aturan kerja | `AGENTS.md` | wajib dibaca tiap sesi, semua agent |

### Toolchain (terverifikasi di mesin ini)

- `hyperframes` 0.8.20, Node v24.9.0, Playwright 1.62.1
- FFmpeg 7.1 di `C:\Users\RIFE\Downloads\roop-unleashed-main\...\ffmpeg\bin\`
- `faster-whisper` di venv `.venv-asr`
- **Tidak ada** cmake / winget / choco → whisper-cpp tidak bisa dibangun

---

## What Worked

1. **HyperFrames** untuk komposisi. Skill sudah terpasang lokal di
   `C:\Users\RIFE\.claude\skills\`. Gate `hyperframes check` menangkap masalah nyata
   (kontras, caption bertumpuk) yang tidak terlihat mata.
2. **Playwright `recordVideo`** untuk rekam layar — level browser context, tanpa frame drop.
3. **faster-whisper** untuk timing caption. Wheel CTranslate2, tanpa compiler.
4. **Komposisi dibangkitkan skrip**, bukan ditulis tangan. Tabel `EDIT` di
   `tools/build-longform.py` + `tools/longform-template.html`. Skripnya menolak potongan
   yang meminta sumber lebih panjang dari yang tersedia.
5. **Potong tepat di kata** untuk kalimat berisi daftar — ambil timing dari transkrip
   word-level. Ini yang membuat pembuka terasa hidup.
6. **Pembuka dipercepat** (`data-playback-rate` 3–4x) alih-alih kartu teks.
7. **Delegasi ke opencode** (`spawn.sh opencode --model muse-free`) untuk sapuan 24 klip.
   Berhasil, tapi lihat catatan di bawah.

---

## What Didn't Work

Jangan diulangi.

1. **`video-edit-cli` (computerlovetech)** — dievaluasi, tidak cocok. Schema edit-plan-nya
   cuma `source/in/out/crop statis/gain`. Tidak ada zoom beranimasi, transisi, efek, atau
   layer teks. 0 stars, backend transkripsi hanya `mlx_whisper` (Apple Silicon).
2. **`mcp-video` (studiomeyer)** — paket npm `mcp-video` **bukan milik repo itu**. Yang di
   npm versi 0.0.1, placeholder orang lain. Badge di README menyesatkan.
3. **Deteksi hening untuk batas scene** — gagal total. `ffmpeg silencedetect` menemukan
   jeda di koma, bukan hanya titik. Pemetaannya menghasilkan segmen 8,58 detik untuk
   kalimat 5 kata. Pakai ASR.
4. **Menyembunyikan banner demo dengan JS** — kalah oleh React re-render. Harus CSS.
5. **`addInitScript` untuk menyembunyikan banner** — jalan sebelum `document.body` ada,
   `observe(document.body)` melempar, seluruh skrip mati diam-diam.
6. **Menyuntik CSS sekali per navigasi** — masih menyisakan 1,5–2,5 detik banner di awal
   **setiap** klip. Harus `setInterval(hideChrome, 400)` selama klip berjalan.
7. **Menyampel satu frame untuk memastikan klip bersih** — pernah melaporkan "23 dari 24
   bersih", padahal semuanya kotor. Kebetulan menyampel setelah banner hilang.
8. **Mencari frame bersih pertama** di `verify-lib.py` — salah. Frame pertama sering masih
   halaman sebelumnya yang memang bersih. Harus cari frame **ber-banner terakhir**.
9. **Zoom di semua scene** — user menolak: terasa mengulang dan tidak ada scene yang
   terasa penting. Maksimal 2–3 gerakan per video.
10. **Naskah dalam markdown** — user menegur dua kali. Naskah selalu plain teks.
11. **Jarak caption 0,10 detik** — masih bertumpuk karena fade keluar 0,14 detik.
    Harus 0,30.

---

## Next Steps

### 1. Generate VO untuk 3 naskah baru

Ekstensi sudah terbukti jalan (16/16 berhasil, suara Zephyr). Prasyarat sekali seumur
hidup: **"Ask where to save each file" di `chrome://settings/downloads` harus MATI**,
kalau tidak tiap unduhan memunculkan dialog Save As dan antrean berhenti — sudah
dimatikan 31 Agu.

Alur: buka `https://aistudio.google.com/generate-speech` → pilih Speaker manual →
impor folder `brands/dental-care/naskah/` → Mulai dari awal. Hasil `.wav` mendarat di
`C:\Users\RIFE\Downloads\tts\`, pindahkan ke `brands/<brand>/vo/`.

**Yang belum diverifikasi:** apakah satu Run sanggup naskah 707 kata (±5 menit).
Kalau `01-walkthrough-lengkap.wav` terpotong di tengah, berarti ada batas panjang per
request — itu menentukan durasi maksimal semua video berikutnya. Cek kalimat
terakhirnya ("...tautan di deskripsi") kebaca atau tidak.

Kalau gagal, yang paling mungkin salah:
- Selektor berubah → cek `content.js`, semua selektor ada di komentar paling atas
- Mode Text vs Composer → kolom utamanya beda `aria-label`
  (`Enter a prompt` vs `Speech block text`)

Menggabung beberapa `.wav` jadi satu VO (kalau perlu), pakai concat demuxer ffmpeg.
Catatan: daftar berkasnya harus memakai path gaya Windows (`C:/...`), bukan `/c/...`,
kalau tidak ffmpeg menyambungnya jadi `C:/c/...` dan gagal.

### 2. Produksi video dari naskah framework

Setelah 16 `.wav` jadi:
```bash
cd brands/dental-care
# gabung jadi satu VO, atau pakai per-berkas
../../.venv-asr/Scripts/python.exe ../../tools/asr.py vo/<hasil>.wav small
../../.venv-asr/Scripts/python.exe ../../tools/plan-longform.py
../../.venv-asr/Scripts/python.exe ../../tools/build-longform.py vo/<hasil>-transcript.json <durasi>
cd project && hyperframes check && hyperframes snapshot --at "..." && hyperframes render -o out/04-....mp4
```

Catatan: `tools/plan-longform.py` masih berisi peta bagian narasi untuk VO **lama**
(6 menit, `voice_asli.wav`). Untuk naskah baru, tabel `SECTIONS` di dalamnya harus
disesuaikan.

### 3. Yang belum pernah dikerjakan sama sekali

- **Efek suara (SFX).** Diminta user sejak awal, belum pernah masuk ke video mana pun.
  Rencana: whoosh di pergantian bagian, tick di potongan cepat, stinger penutup.
  Skill `/hyperframes-audio` dan `/media-use` untuk ini.
- **Upload YouTube.** Belum disentuh.
- **Brand kedua.** Struktur sudah siap, tinggal
  `mkdir -p brands/<nama>/{naskah,vo,footage,shots,project}`.

---

## Catatan penting untuk agent berikutnya

- **Alat dijalankan dari dalam `brands/<brand>/`**, bukan dari root. Path memakai
  `process.cwd()`.
- **`safeStart`, bukan `contentStart`**, untuk `data-media-start`. Jalankan
  `verify-lib.py` setiap habis merekam.
- **Teks caption dari naskah, timing dari ASR.** ASR salah dengar banyak nama dan istilah;
  peta koreksinya ada di `tools/build-longform.py` (`CAPTION_FIX`).
- **`hyperframes check` bisa bilang "passed" padahal ada temuan `info`.** Baca sampai bawah.
- **1 `.txt` = 1 video = 1 request TTS.** Jangan memecah satu video jadi banyak `.txt` —
  kuota request Google AI Studio yang mengikat, bukan panjang naskah. Rencana user:
  ±100 keyword, masing-masing jadi satu video yang menjawab sebagian besar keyword itu
  (sengaja tidak dibuat satu video berisi semua fitur, supaya penonton lanjut ke video lain).
- Kredensial demo dan hosting ada di `C:\Users\RIFE\.claude\SECRETS.local.md` — jangan
  minta user mengirim ulang.
- Situs demo punya **quick login per peran** (Admin / FO / Dokter), tanpa password.
  Odontogram hanya terlihat sebagai **Dokter**.
- Mode demo memblokir semua request non-GET, jadi tidak ada aksi simpan yang berhasil.
