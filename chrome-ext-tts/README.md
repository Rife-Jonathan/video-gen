# AI Studio TTS Batch

Ekstensi Chrome untuk generate banyak voice-over sekaligus di Google AI Studio, lalu
mengunduh tiap potongan dengan nama berurutan — supaya produksi video bisa massal.

## Pasang

1. Buka `chrome://extensions`
2. Nyalakan **Developer mode** (pojok kanan atas)
3. **Load unpacked** → pilih folder `chrome-ext-tts`
4. Sematkan ikonnya di toolbar

## Pakai

1. Buka <https://aistudio.google.com/generate-speech>
2. Pilih salah satu preset (misalnya *The Ad Voiceover*) supaya form Scene / Sample
   Context / Text muncul
3. **Pilih suara** lewat tombol *Speaker* secara manual — ekstensi tidak mengubah ini
4. Klik ikon ekstensi → panel samping terbuka
5. Isi Scene dan Sample Context (dipakai untuk semua blok)
6. Tempel naskah dengan format blok, lalu **Mulai**

### Format naskah

```
=== s01
Klinik gigi masih catat rekam medis di kertas?
Ini DentalCare Studio.

=== s02
Tujuh belas modul, satu aplikasi.
```

Nama sesudah `===` menjadi nama berkas: `s01` → `s01.wav`.
Baris kosong di dalam blok ikut terkirim sebagai jeda.

Berkas masuk ke folder unduhan Chrome, di subfolder yang kamu isi (default `tts`).

## Cara kerjanya

Selektor di `content.js` dibaca langsung dari DOM AI Studio pada 31 Agustus 2026,
bukan ditebak:

| Elemen | Selektor |
|---|---|
| Scene | `textarea[aria-label="Scene"]` |
| Sample Context | `textarea[aria-label="Sample Context"]` |
| Teks | `textarea[aria-label="Speech block text"]` |
| Download | `button[aria-label="Download"]` |
| Run | tidak punya `aria-label` — dicocokkan lewat teksnya |

Dua hal yang membuat ini bekerja:

1. **Menulis `el.value` saja tidak cukup.** Halaman itu Angular; nilainya dilacak lewat
   property setter, jadi assignment biasa tidak terlihat oleh framework. Semua penulisan
   lewat `setNative()` + event `input` dan `change`.

2. **Selesainya dideteksi dari elemen `<audio>`, bukan dari waktu tetap.** Setiap
   generate mengganti `src` audio. Menunggu jeda tetap akan memotong take panjang atau
   membuang waktu pada take pendek. Ekstensi menunggu `src` berubah, lalu menunggu
   sekali lagi sampai stabil (player sempat menukar `src` dua kali saat inisialisasi).

Unduhan tidak memakai tombol Download bawaan, melainkan `fetch(audio.src)` → data URL →
`chrome.downloads`. Alasannya nama berkas: tombol bawaan memakai penamaan AI Studio,
sedangkan produksi massal butuh `s01.wav`, `s02.wav`, dan seterusnya. Jalur data URL juga
bekerja apa pun bentuk `src`-nya — `blob:`, `https:`, atau `data:`.

## Batas dan catatan jujur

- **Belum diuji end-to-end.** Selektor, pembacaan state, dan alur unduh ditulis dari DOM
  yang benar-benar dibuka di sesi ini, tapi satu putaran generate penuh belum dijalankan —
  itu memakai kuota akunmu. Jalankan dulu dengan **satu blok** sebelum sebatch penuh.
- **Suara tidak diatur oleh ekstensi.** Pilih Speaker manual sekali di halaman.
- **AI Studio bisa berubah sewaktu-waktu.** Kalau panel bilang kolom teks tidak ketemu,
  selektor di `content.js` yang perlu diperbarui.
- **Jeda antar item ada gunanya.** Default 4 detik supaya tidak menghantam layanan.
  Naikkan bila kena pembatasan. Otomasi UI dalam jumlah besar bisa bersinggungan dengan
  ketentuan layanan Google — pakai untuk akun dan naskahmu sendiri secukupnya.
- Panel menyimpan isian ke `chrome.storage.local`, jadi naskah tidak hilang saat panel
  tertutup.

## Berkas

| Berkas | Isi |
|---|---|
| `manifest.json` | MV3, izin `downloads` / `storage` / `sidePanel` |
| `content.js` | semua interaksi DOM di halaman AI Studio |
| `background.js` | service worker: unduhan + membuka panel |
| `panel.html` / `panel.js` | antarmuka batch, parser naskah, retry, log |
