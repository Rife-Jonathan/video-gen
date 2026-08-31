# SOP — Bikin Video Review Aplikasi dengan AI

Prosedur baku untuk repo ini. Semua angka, perintah, dan kegagalan di bawah ini
**benar-benar terjadi di mesin ini**, bukan salinan dokumentasi.

Terakhir diperbarui: 31 Agustus 2026.

---

## 0. Peta singkat

```
riset produk  →  naskah  →  VO (Chrome)  →  transkripsi  →  rekam layar  →  komposisi  →  gate  →  render
   WebFetch      SOP §2    AI Studio        faster-whisper   Playwright      HyperFrames   check    MP4
```

Yang mengerjakan: **agent**, kecuali langkah VO — itu manual di browser karena
Google AI Studio tidak punya API gratis untuk suara ini.

---

## 1. Perkakas — status di mesin ini

Cek semuanya sekaligus:

```powershell
hyperframes doctor
```

| Perkakas | Status per 31 Agu 2026 | Catatan |
|---|---|---|
| `hyperframes` | 0.8.20 | `npm i -g hyperframes` |
| Node.js | v24.9.0 | |
| FFmpeg / FFprobe | 7.1 | path-nya nyeleneh (`roop-unleashed-main/...`) tapi ke-resolve |
| Chrome (Puppeteer cache) | 150.0.7871.24 | dipakai untuk screenshot |
| Playwright | 1.62.1 | dipakai untuk **video** |
| `faster-whisper` | venv `.venv-asr` | untuk timing caption |
| whisper-cpp | ❌ tidak ada | butuh cmake — **tidak** terpasang |
| cmake / winget / choco | ❌ tidak ada | ini alasan kita pakai faster-whisper |
| Docker | terpasang, tidak jalan | opsional, tidak dipakai render lokal |

### Skill HyperFrames

Terpasang di `C:\Users\RIFE\.claude\skills\`. **Bukan plugin global** — salinan lokal,
jadi tetap ada walau ditarik dari katalog.

| Skill | Untuk |
|---|---|
| `/hyperframes` | pintu masuk wajib, memilih workflow |
| `/product-launch-video` | review/showcase aplikasi dari URL ← **ini yang kita pakai** |
| `/hyperframes-core` | kontrak `data-*`, klip, track, media |
| `/hyperframes-keyframes` | zoom, punch-in, Ken Burns, camera move |
| `/hyperframes-audio` | SFX, ducking, crossfade, automation |
| `/media-use` | cari/bikin SFX, BGM, ikon, TTS |
| `/hyperframes-cli` | init, check, snapshot, render, publish |

Refresh: `npx hyperframes skills update <nama>`

---

## 2. Naskah

1. Baca halaman produk dengan WebFetch. **Ambil klaim persis seperti tertulis.**
   Contoh nyata: situs menulis *"Siap terhubung SATUSEHAT"* — bukan *"sudah terhubung"*.
   Naskah harus ikut kata aslinya.
2. Panjang: **±140 kata per menit** untuk bahasa Indonesia. Video 60 detik ≈ 115–120 kata.
3. Pecah jadi 5–7 scene. Tiap scene tulis empat baris: **VO / Visual / Efek / SFX**.
4. Tulis dua berkas:
   - `naskah-<produk>.md` — versi lengkap dengan mapping visual, untuk agent.
   - `vo-paste.txt` — **teks polos saja**, paragraf dipisah baris kosong, untuk di-paste.

Aturan menulis teks VO supaya TTS tidak salah baca:
- Angka jadi kata: `Rp 1.250.000` → "satu juta dua ratus lima puluh ribu".
- Buang tanda hubung dan tanda kurung.
- Hindari singkatan yang dibaca huruf per huruf kalau tidak diinginkan.

---

## 3. VO — Google AI Studio di Chrome

Manual. Tidak ada API gratis untuk model ini.

1. Buka <https://aistudio.google.com/> → **Playground** → mode **Text**.
2. Panel kanan → pilih model **Gemini 2.5 Pro Preview TTS** (`gemini-2.5-pro-preview-tts`).
3. Isi tiga kolom:

   | Kolom | Isi |
   |---|---|
   | **Scene** | Suasana. Contoh: `Ruang kerja klinik yang tenang dan profesional.` |
   | **Sample Context** | Cara bicara. Contoh: `Tenang, jelas, dan meyakinkan. Tempo sedang, tidak terburu-buru.` |
   | **Text** | Isi `vo-paste.txt` — **paste sekali, semua paragraf** |

4. **Speaker settings** → pilih suara. Aoede = breezy, middle pitch.
5. Generate, unduh WAV-nya, simpan ke `video-gen\hasil.wav`.

### Kenapa satu file, bukan per scene

Awalnya SOP ini menyuruh generate 6 kali terpisah supaya durasi tiap berkas = durasi scene.
Itu merepotkan. Sekarang: **satu file, batas scene diambil dari transkripsi** (§4).
Jaga baris kosong antar paragraf — di situ TTS memberi jeda.

### Uji satu scene dulu

Sebelum generate semuanya, generate **scene terpanjang** saja dan dengarkan. Kalau ada
kata yang dibaca salah (`odontogram`, `SATUSEHAT`), tulis fonetis: `satu sehat`.

---

## 4. Transkripsi — dari mana timing caption datang

**Jangan tebak timing dari deteksi hening.** Sudah dicoba, gagal:
`ffmpeg silencedetect` menemukan 14 jeda, tapi memetakannya ke kalimat menghasilkan
segmen 8,58 detik untuk kalimat 5 kata dan 0,78 detik untuk kalimat 8 kata. Mustahil.
Jeda TTS jatuh di koma, bukan hanya di titik.

Pakai ASR sungguhan:

```powershell
uv venv .venv-asr
uv pip install --python .venv-asr\Scripts\python.exe faster-whisper
..\..\.venv-asr\Scripts\python.exe ..\..\tools\asr.py <audio.wav> small
```

Keluaran: `vo.srt` + `vo-transcript.json` (word-level).

**faster-whisper, bukan whisper-cpp**, karena whisper-cpp butuh cmake dan mesin ini tidak
punya cmake/winget/choco. faster-whisper memakai wheel CTranslate2 — tanpa compiler.

Model `small`, `language="id"`, CPU int8. Audio 52 detik selesai dalam hitungan menit.

> **Penting:** pakai **timing** dari ASR, tapi **teks** dari naskah. ASR salah dengar
> "antrean pasien" → "antrian pasian", "Kemenkes" → "kemences", "interaktif" →
> "interactive". Caption yang tayang harus ejaan naskah.

---

## 5. Rekam layar — Playwright

Rig-nya `record.js`. Pola wajib: `login()`, `hideChrome()`, `glide()`, `clip()`.

### Kenapa Playwright, bukan yang lain

`recordVideo` merekam di level **browser context**, bukan capture layar desktop. Tidak ada
frame drop, tidak terganggu jendela lain, dan jalan headless. Puppeteer harus pakai CDP
screencast manual yang lebih rawan.

### Enam jebakan yang sudah menggigit

| Masalah | Sebab | Perbaikan |
|---|---|---|
| Banner demo balik terus | JS hide kalah oleh React re-render | Suntik **CSS**: `div.bg-amber-50.border-b{display:none!important}` |
| Penyembunyi mati total | `addInitScript` jalan sebelum `document.body` ada → `observe(document.body)` melempar | Jangan pakai init script untuk ini; pakai `page.addStyleTag` |
| Banner balik setelah pindah halaman | `page.goto` penuh membuang stylesheet yang disuntik | Panggil `hideChrome(page)` lagi **setiap habis `goto`** |
| Klip kependekan untuk slot-nya | Bagian login ±8 detik terbuang di awal | Skrip **melaporkan sendiri** `content starts at ~Xs`; jangan menebak |
| Angka masih `Rp 0` / "Memuat..." | Data belum termuat saat direkam | `page.waitForFunction` sampai angka muncul, baru mulai dwell |
| Toast "Login berhasil!" ikut terekam | Mulai konten terlalu cepat | Tunggu ±1,8 detik setelah login sebelum menandai `contentStart` |
| Banner muncul 1,5–2,5 detik di awal **setiap** klip | Menyuntik CSS sekali per navigasi masih menyisakan celah: `goto`/`goBack` membuang `<style>` sebelum suntikan berikutnya | Suntik ulang pakai `setInterval(..., 400)` selama klip berjalan, bersihkan di `finally` |

> **Jangan percaya "sudah bersih" tanpa mengukur.** Pemeriksaan pertama mengambil sampel di
> `contentStart + 2` dan melaporkan 23 dari 24 klip bersih. Salah. Banner hilang tepat
> sebelum detik ke-2 di sebagian besar klip, jadi sampelnya kebetulan lolos. Setelah diukur
> per 0,5 detik di seluruh jendela, **semua 24 klip** ternyata punya banner di awal, dan
> `patients-visits` punya banner di 13 dari 21 detiknya. Pakai `verify-lib.py`.

### `verify-lib.py` — gerbang untuk pustaka footage

```powershell
..\..\.venv-asr\Scripts\python.exe ..\..\tools\verify-lib.py
```

Memindai strip tipis tempat banner berada, setiap 0,5 detik, sepanjang jendela konten tiap
klip. Menulis dua kolom baru ke `manifest.json`:

- `safeStart` — detik pertama yang benar-benar bersih. **Ini yang dipakai sebagai
  `data-media-start`, bukan `contentStart`.**
- `usable` — berapa detik bersih yang tersedia.

Kesalahan logika yang sempat terjadi: mencari frame bersih **pertama**. Itu salah, karena
frame pertama sering masih halaman sebelumnya yang memang bersih — banner baru muncul
setelah navigasi mendarat. Yang benar: cari frame **terakhir** yang masih ada bannernya,
lalu mulai setelah itu.

### Kursor harus terlihat manusiawi

Jangan `page.mouse.move` lompat. Pakai `glide()` — gerak bertahap dengan easing
`easeInOutQuad`, 16ms per langkah.

### Login demo

Aplikasi demo punya tombol **quick login** per peran (Admin / FO / Dokter). Tombolnya
mengisi form sendiri; agent tidak pernah mengetik password. Peran menentukan tampilan:
`admin` → `/dashboard` sidebar penuh; `dokter` → `/queue` sidebar pendek.

### Screenshot untuk zoom

Untuk punch-in dalam (>1,8x), **jangan zoom video 1080p** — buram. Ambil screenshot
`deviceScaleFactor: 2` (hasil 3840x2160) lalu zoom di still itu. Teks kecil tetap terbaca.

---

### Mendelegasikan sapuan footage ke CLI eksternal

Merekam 24 fitur itu pekerjaan besar tapi hasilnya kecil (berkas + manifest). Cocok
didelegasikan supaya tidak menghabiskan context window.

```bash
bash ~/.claude/skills/spawn-cli/scripts/spawn.sh opencode \
  "Your working directory is C:/Users/RIFE/Downloads/video-gen and it is NOT a git repository.
   Read the file C:/Users/RIFE/Downloads/video-gen/prompts/asset-sweep.md and execute it
   completely. Do NOT search any drive." \
  --model muse-free
```

Aturan yang benar-benar menentukan berhasil atau tidak:

1. **Tulis prompt ke berkas, kirim path absolutnya.** Jangan menaruh instruksi panjang di
   baris perintah.
2. **Sebutkan working directory secara eksplisit** dan tambahkan "Do NOT search any drive".
3. **Sebutkan berkas rujukan yang sudah bekerja** (`record.js`) supaya dia menyalin pola,
   bukan mengarang sendiri.
4. **Tulis daftar jebakan yang sudah kamu tahu** di dalam prompt. Yang tidak kamu tulis,
   akan dia ulangi.
5. **Minta manifest berisi angka hasil ukurannya sendiri**, bukan perkiraan.

> **Laporan agent adalah klaim, bukan fakta.** Exit code 0 dan ringkasan yang meyakinkan
> tidak membuktikan apa pun. Verifikasi sendiri: hitung berkas, bandingkan durasi berkas
> dengan `contentEnd` di manifest, lalu jalankan `verify-lib.py`. Pada sapuan pertama,
> laporannya benar soal jumlah dan ukuran, tapi **semua 24 klip** ternyata punya banner
> di awal — dan itu tidak disebut sama sekali.

Catatan model: `muse-free` = `opencode/muse-spark-1.2-contributor-free`, tier **Zen gratis**.
Pemakaian tier ini kemungkinan tidak muncul di dashboard langganan **Go**.

## 6. Komposisi HyperFrames

```powershell
hyperframes init <nama> --non-interactive --example blank --resolution landscape --skill product-launch-video
```

Aset masuk ke `<nama>/public/{footage,audio,shots}/`.

### Kontrak yang wajib dipatuhi

- Root `<div>` butuh `data-composition-id`, `data-width`, `data-height`, dan ukuran px eksplisit.
- Satu timeline GSAP `paused: true`, didaftarkan ke `window.__timelines["<id>"]`.
- Setiap `<video>`/`<audio>` **wajib punya `id`**. `<audio>` tanpa id tidak ikut mixer →
  render bisu tanpa peringatan.
- `<video>` diberi `muted` + `playsinline`; audio ditaruh di elemen `<audio>` terpisah.
- **Jangan** taruh `data-start` di `<video>` sekaligus di elemen pembungkusnya.
- **Jangan** pasang `crossorigin` di media — lint menolak.
- Gerakan kamera (zoom/pan) menyasar **pembungkus `.inner`**, bukan elemen klip bertimingnya.
- Jangan gabungkan `transform` CSS awal dengan tween GSAP pada properti yang sama.

### Potong sumber

```html
data-start="16.68"      <!-- posisi di timeline -->
data-duration="5.60"    <!-- panjang tayang -->
data-media-start="13.0" <!-- mulai dari detik ke berapa di berkas sumber -->
```

Pakai `contentStart` dari laporan skrip rekam sebagai `data-media-start`.

### Aturan editing — supaya tidak terasa mengulang

Ini pelajaran dari revisi pertama. Video terasa *looping* karena empat klip terlihat mirip
dan setiap scene diberi gerakan kamera.

1. **Zoom hanya saat menjelaskan fitur itu.** Kalau VO tidak sedang menyorot detail,
   biarkan diam. Gerakan di semua scene = tidak ada scene yang terasa penting.
2. **Satu fitur satu klip.** Jangan pakai ulang halaman yang sama untuk dua scene.
3. **Tunjukkan interaksi, bukan halaman diam.** Buka baris tabel, ganti tab, filter tanggal,
   scroll, hover sampai tooltip muncul.
4. Crossfade **0,4 detik** antar scene. Lebih panjang terasa lambat.
5. Caption: pil gelap di bawah, muncul/hilang 0,16 detik.

---

## 6b. Video panjang (3+ menit) — komposisi dibangkitkan, bukan ditulis tangan

Video 52 detik boleh ditulis tangan. Video 6 menit punya ~45 potongan dan ~84 caption —
di situlah salah ketik bersembunyi. Pola yang dipakai:

```
voice_asli.wav
   │
   ├─ asr.py            → voice_asli-transcript.json (timing per kata)
   ├─ plan-longform.py  → petakan bagian narasi ke footage, laporkan kekurangan
   ├─ record-longform.js→ rekam yang kurang, durasi dari kebutuhan narasi
   ├─ verify-lib.py     → hitung ulang safeStart
   └─ build-longform.py + longform-template.html → brands/<brand>/project/index.html
```

**Edit-nya adalah data, HTML-nya dibangkitkan.** Di `build-longform.py` ada tabel `EDIT`
berisi `(mulai, selesai, klip, rate, offset, kamera)`. Ubah tabelnya, jalankan ulang.
Skrip itu juga **menolak** potongan yang meminta sumber lebih panjang dari yang tersedia —
jadi tidak mungkin diam-diam menampilkan frame kosong.

### Potong tepat di kata, bukan di angka bulat

Untuk kalimat yang menyebut daftar, ambil timing per kata dari transcript dan potong di
situ. Contoh nyata: narasi menyebut delapan hal dalam 6,4 detik —

```
"antrean"@20.72  "rekam medis"@21.50  "tindakan"@22.46  "stok obat"@23.24
"transaksi"@24.16  "komisi dokter"@25.04  "laporan klinik"@26.02
```

Delapan layar berbeda dipotong pada detik-detik itu. Ini yang membuat pembuka terasa
hidup, bukan daftar menu.

### Pembuka dipercepat

53 detik pertama (opening + empathy + problem + promise) tidak punya satu layar yang
jelas. Isi dengan **rekaman layar dipercepat** memakai `data-playback-rate` (nilai sah
0,1–5,0, konstan — bukan ramp). Dipakai di sini: 3,0 untuk sapuan, 4,0 untuk kilasan
di bawah satu detik, lalu turun ke 1,0 tepat saat narasi bilang "kita langsung lihat".
Penonton melihat seluruh produk alih-alih menunggu.

### Caption: timing dari ASR, teks dikoreksi

Tidak ada naskah tertulis untuk VO ini — sumbernya suara. Jadi teks caption berasal dari
ASR dan **harus dikoreksi**. Yang salah dengar di sini: `memperkenahkan`, `jatual`,
`pasian`, `doktor`, `antrian`, `eksel`, `feviken`, `dikrik`, `tertip`, `ENV`,
`seluran akar`, `Matakuang`, `bagel`. Semua ada di peta `CAPTION_FIX`.

### Jarak antar caption harus melebihi durasi fade

`check` menandai `content_overlap` ketika caption yang keluar masih tergambar saat yang
berikutnya masuk. Fade-nya 0,14 detik, jadi jarak 0,10 detik **tidak cukup** — dipakai
0,30 detik. Gejalanya halus: gate tetap "passed" karena ini temuan info, bukan error.

## 7. Gate dan render

```powershell
hyperframes check                          # lint + runtime + layout + motion + kontras
hyperframes snapshot --at "3,12,19,25.5"   # WAJIB kutip — PowerShell memecah koma
hyperframes render -o out.mp4
```

`check` harus **0 error**. Kalau lint error, audit layout dan kontras **tidak jalan** dan
laporan `0 sample(s)` terlihat seperti bersih padahal tidak ada yang diperiksa.

Selalu lihat snapshot dengan mata sendiri sebelum render — gate tidak tahu kalau zoom
mendarat di tempat yang salah.

### Patokan kecepatan di mesin ini

Ryzen 5 3400G, 8 core, GTX 1050 Ti:

| Video | Frame | Waktu render |
|---|---|---|
| 10 detik | 300 | 28 detik |
| 52 detik | 1562 | 1 menit 47 detik |

Kira-kira **2–3x durasi video**.

### Batas kirim berkas

Master 52 detik = 34,2 MB, di atas batas kirim 30 MB. Bikin versi preview:

```powershell
ffmpeg -i out.mp4 -c:v libx264 -crf 26 -preset medium -c:a aac -b:a 128k out-kecil.mp4
```

34,2 MB → 7,7 MB.

---

## 8. Etika rekaman

- Banner "MODE DEMO AKTIF" disembunyikan karena itu artefak lingkungan demo, bukan bagian
  produk. **Ini keputusan sadar, bukan menutupi cacat.**
- Naskah tidak boleh mengklaim lebih dari yang situs produk klaim. Kalau situs bilang
  "siap terhubung", naskah tidak boleh bilang "sudah terhubung".
- Kalau fitur tidak bisa didemokan karena mode demo memblokir penyimpanan, tunjukkan
  tampilan datanya — jangan berpura-pura menyimpan.

---

## 9. Berkas di repo ini

> Struktur folder dan aturan tetap ada di `CLAUDE.md` — baca itu dulu.
> Semua alat dijalankan dari dalam `brands/<brand>/`.


| Berkas | Isi |
|---|---|
| `SOP.md` | dokumen ini |
| `naskah-dental-care.md` | naskah + mapping visual per scene |
| `vo-paste.txt` | teks polos untuk di-paste ke AI Studio |
| `hasil.wav` | VO hasil generate |
| `asr.py` | transkripsi → `vo.srt` + `vo-transcript.json` |
| `record.js` | rig rekam layar (s1, s2, s4) |
| `record-s3.js` | scene odontogram + still resolusi tinggi |
| `record-library.js` | sapuan seluruh fitur → `footage/`. Terima nama klip sebagai argumen: `node ../../tools/record-library.js examination` merekam ulang satu saja dan **menggabung** ke manifest, tidak menimpa |
| `verify-lib.py` | gerbang pustaka footage — hitung `safeStart` + `usable` per klip |
| `record-longform.js` | rekam klip berdurasi panjang + halaman login & landing publik |
| `plan-longform.py` | petakan bagian narasi ke footage, laporkan yang kurang |
| `build-longform.py` | bangkitkan komposisi 6 menit dari tabel `EDIT` + transkrip |
| `longform-template.html` | kerangka HTML yang diisi oleh `build-longform.py` |
| `voice_asli.wav` | VO walkthrough 6 menit (rekaman asli, bukan TTS) |
| `voice_asli.srt`, `voice_asli-transcript.json` | transkrip word-level VO panjang |
| `prompts/asset-sweep.md` | prompt yang dipakai untuk mendelegasikan sapuan ke CLI eksternal |
| `capture.js` | screenshot semua halaman → `shots/` |
| `probe*.js` | skrip diagnosa (rute, DOM banner) |
| `prompts/` | prompt untuk agent CLI eksternal |
| `brands/<brand>/project/` | proyek HyperFrames |
| `footage/`, `footage/`, `shots/` | bahan mentah |

---

## 10. Daftar periksa

- [ ] `hyperframes doctor` — inti hijau
- [ ] Naskah dibuat dari halaman produk yang benar-benar dibaca
- [ ] `vo-paste.txt` — angka jadi kata, tanpa tanda hubung
- [ ] VO digenerate, disimpan sebagai `hasil.wav`
- [ ] `asr.py` jalan → `vo-transcript.json` ada
- [ ] Caption pakai timing ASR + teks naskah
- [ ] Tiap klip melaporkan `contentStart`
- [ ] `verify-lib.py` jalan → `bermasalah: tidak ada`
- [ ] Komposisi memakai `safeStart`, bukan `contentStart`
- [ ] Banner dan toast tidak masuk frame — **diukur, bukan diasumsikan**
- [ ] Zoom hanya di scene yang sedang menjelaskan fitur itu
- [ ] `hyperframes check` — 0 error
- [ ] Snapshot dilihat satu per satu
- [ ] Render, lalu bikin versi kompres untuk dikirim
