# video-gen — aturan kerja

Repo produksi video review aplikasi dengan AI. Dipakai untuk **banyak brand**.
Prosedur lengkap ada di `SOP.md`; berkas ini aturan yang tidak boleh dilanggar.

**Berkas ini berlaku untuk agent mana pun** — Claude Code, opencode, pi, agy.
`CLAUDE.md` hanya mengimpor berkas ini, jangan diisi aturan sendiri supaya tidak
bercabang. Urutan baca saat mulai sesi: `AGENTS.md` (ini) → `HANDOFF.md` (keadaan
terakhir) → `SOP.md` (prosedur, dibaca saat butuh).

## Aturan bukti (berlaku untuk semua agent)

- **Jangan bilang "sudah jalan" / "tes lulus" / "sudah diperbaiki"** kecuali perintahnya
  benar-benar dijalankan di sesi ini dan outputnya terlihat. Kalau belum:
  "Belum diuji — jalankan `<perintah>` untuk konfirmasi."
- **Jangan mengarang output.** Pesan error, stack trace, nomor baris, nama paket,
  opsi CLI — tidak terlihat di sesi ini, tidak boleh dikutip.
- **Klaim ketiadaan wajib dicari dulu.** "Tidak ada X" hanya setelah grep/glob
  dijalankan. Belum dicari → tulis "belum saya temukan di `<lingkup>`".
- **Sebut path = wajib buka.** Dilarang menyimpulkan isi berkas dari namanya.
- **Boleh tidak tahu.** "Saya belum verifikasi" itu jawaban yang benar.

## Kredensial

Kredensial hosting, SSH, database, dan token API ada di
`C:\Users\RIFE\.claude\SECRETS.local.md`. Baca berkas itu, **jangan minta user
mengirim ulang password**, dan **jangan tampilkan nilainya** ke chat.

---

## Struktur folder

```
video-gen/
├── CLAUDE.md              ← berkas ini
├── SOP.md                 ← prosedur lengkap + troubleshooting
├── tools/                 ← alat, dipakai SEMUA brand, jangan digandakan per brand
│   ├── record.js              rekam layar (rig dasar)
│   ├── record-library.js      sapuan seluruh fitur → footage/
│   ├── record-longform.js     klip durasi panjang + login + landing publik
│   ├── capture.js             screenshot semua halaman → shots/
│   ├── asr.py                 transkripsi word-level
│   ├── verify-lib.py          gerbang footage: hitung safeStart + usable
│   ├── plan-longform.py       petakan narasi ke footage, laporkan kekurangan
│   ├── build-longform.py      bangkitkan komposisi dari tabel EDIT
│   ├── longform-template.html kerangka HTML
│   └── probes/                skrip diagnosa sekali pakai
├── chrome-ext-tts/        ← ekstensi Chrome untuk TTS massal
└── brands/
    └── <brand>/
        ├── naskah/        *.txt — SATU berkas = SATU suara
        ├── vo/            hasil suara + transkrip
        ├── footage/       rekaman layar + manifest.json
        ├── shots/         screenshot resolusi tinggi
        ├── project/       proyek HyperFrames
        │   ├── index.html     dibangkitkan build-longform.py, JANGAN diedit tangan
        │   ├── public/        aset yang dipakai komposisi
        │   ├── snapshots/     hasil hyperframes snapshot
        │   └── out/           hasil render, diberi nomor urut
        └── arsip/         naskah lama yang sudah tidak dipakai
```

Penamaan hasil render: `NN-<deskripsi>-<durasi>.mp4`, plus `-preview` untuk versi
kompres. Contoh: `03-walkthrough-6m.mp4` dan `03-walkthrough-6m-preview.mp4`.

**Semua alat dijalankan dari dalam folder brand**, bukan dari root:

```bash
cd brands/dental-care
node ../../tools/record-library.js
../../.venv-asr/Scripts/python.exe ../../tools/verify-lib.py
../../.venv-asr/Scripts/python.exe ../../tools/build-longform.py vo/<nama>-transcript.json <durasi>
```

Alat memakai `process.cwd()` / path relatif, bukan lokasi skripnya. Brand baru cukup
`mkdir -p brands/<nama>/{naskah,vo,footage,shots,project}`.

---

## Aturan naskah

1. **Naskah selalu plain teks.** Tanpa markdown, tanpa heading, tanpa `>`, tanpa penanda
   `===`. Isinya kalimat yang akan dibaca, titik.
2. **Satu berkas `.txt` = satu video utuh = satu request TTS.** Nama berkas jadi nama
   `.wav`. Contoh: `naskah/01-walkthrough-lengkap.txt` → `01-walkthrough-lengkap.wav`.
   JANGAN memecah satu video jadi banyak `.txt` — kuota request Google AI Studio yang
   mengikat, bukan panjang naskah. Satu folder `naskah/` berisi N berkas = N video.
3. **Angka ditulis sebagai kata.** `Rp 1.250.000` → "satu juta dua ratus lima puluh ribu".
   Buang tanda hubung dan tanda kurung — TTS membacanya aneh.
4. **±140 kata per menit** untuk bahasa Indonesia. Hitung durasi dari jumlah kata.
5. **Jangan mengklaim lebih dari yang situs produk klaim.** Kalau situs menulis
   "siap terhubung", naskah tidak boleh menulis "sudah terhubung".
6. **Jangan menyebut fitur yang tidak bisa ditunjukkan di layar.** Kalau integrasinya
   mati di demo, sebutkan di deskripsi video, bukan di narasi.
7. Harga sebaiknya tidak masuk badan naskah — bikin video cepat basi.

---

## Aturan editing

1. **Zoom hanya saat narasi menjelaskan hal itu.** Kalau semua scene bergerak, tidak ada
   scene yang terasa penting. Patokan: maksimal 2–3 gerakan kamera per video.
2. **Satu kalimat = satu visual baru.** Ini yang membunuh kesan mengulang.
3. **Kalimat yang menyebut daftar dipotong per item**, tepat di katanya — ambil timing
   dari transkrip word-level, bukan angka bulat.
4. **Tunjukkan interaksi, bukan halaman diam.** Buka baris tabel, ganti tab, filter,
   scroll, hover sampai tooltip muncul.
5. **Crossfade 0,40 detik** antar bagian; **0,10 detik** di dalam potongan cepat.
6. **Zoom dalam (>1,8x) pakai screenshot 4K**, bukan video 1080p — video jadi buram.
7. Pembuka yang tidak punya layar jelas diisi **rekaman dipercepat**
   (`data-playback-rate`, sah 0,1–5,0 konstan), bukan kartu teks.

---

## Aturan bukti — yang paling sering dilanggar

1. **`safeStart`, bukan `contentStart`.** `contentStart` dicatat sebelum badan klip jalan;
   navigasi di dalamnya masih memunculkan banner. Selalu jalankan `verify-lib.py` dan
   pakai `safeStart` sebagai `data-media-start`.
2. **Sampel satu frame tidak membuktikan apa pun.** Pemeriksaan pertama pernah melaporkan
   "23 dari 24 klip bersih" karena kebetulan menyampel setelah banner hilang. Setelah
   dipindai per 0,5 detik, ternyata **semua 24** ada bannernya.
3. **Laporan agent eksternal adalah klaim.** Exit code 0 dan ringkasan meyakinkan tidak
   membuktikan apa pun. Hitung berkasnya, bandingkan durasi dengan manifest, jalankan
   `verify-lib.py`.
4. **`hyperframes check` bisa "passed" padahal ada masalah.** Temuan `info` (mis.
   `content_overlap`) tidak menggagalkan gate. Baca sampai bawah.
5. **Teks caption dari naskah, timing dari ASR.** ASR salah dengar nama dan istilah
   (`pasian`, `antrian`, `doktor`, `feviken`, `dikrik`). Kalau tidak ada naskah tertulis,
   koreksi manual lewat peta di `build-longform.py`.
6. **Lihat snapshot dengan mata sendiri** sebelum render. Gate tidak tahu kalau zoom
   mendarat di tempat yang salah.

---

## Jebakan Playwright yang sudah menggigit

| Gejala | Sebab | Perbaikan |
|---|---|---|
| Banner demo balik terus | JS hide kalah oleh React re-render | Suntik CSS, bukan manipulasi DOM |
| Penyembunyi mati total | `addInitScript` jalan sebelum `document.body` ada | Pakai `page.addStyleTag`, bukan init script |
| Banner muncul 1,5–2,5 detik di awal tiap klip | `goto`/`goBack` membuang `<style>` yang disuntik | `setInterval(hideChrome, 400)` selama klip |
| Klip kependekan | Bagian login ±8 detik terbuang | Skrip melaporkan sendiri `content starts at ~Xs` |
| Angka masih Rp 0 / "Memuat…" | Data belum termuat | `page.waitForFunction` sampai angka muncul |
| Kursor lompat, tidak manusiawi | `page.mouse.move` langsung | Pakai `glide()` dengan easing |

---

## Ekstensi TTS

`chrome-ext-tts/` — generate suara massal di Google AI Studio.

- Naskah diimpor **per folder**: pilih `brands/<brand>/naskah/`, tiap `.txt` jadi satu `.wav`.
- Ekstensi otomatis membuka `generate-speech?model=gemini-2.5-pro-preview-tts`, keluar
  dari galeri preset, lalu **memaksa mode Text** sebelum menempel.
- **Mode Text dan Composer memakai `aria-label` berbeda** untuk kolom utama:
  Text = `Enter a prompt`, Composer = `Speech block text`. Salah pilih → teks tidak masuk
  dan Run mengulang take sebelumnya tanpa error.
- Halaman itu Angular: menulis `el.value` saja tidak terlihat oleh framework. Harus lewat
  native setter + event `input`/`change`.
- Selesainya dideteksi dari `src` elemen `<audio>` yang berubah, bukan jeda tetap.
- Suara dipilih manual sekali lewat tombol Speaker; ekstensi tidak mengubahnya.

---

## Yang tidak boleh dilakukan

- Menaruh alat di dalam folder brand — alat tinggal di `tools/`, satu salinan.
- Menulis naskah dalam markdown.
- Menebak selektor DOM. Buka halamannya, dump DOM-nya.
- Menebak `data-media-start`. Ambil dari manifest.
- Bilang "sudah jalan" tanpa menjalankan perintahnya di sesi ini.
