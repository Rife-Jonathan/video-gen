# Task: record a rich screen-recording library of the DentalCare Studio demo app

Your working directory is `C:/Users/RIFE/Downloads/video-gen`.
It is NOT a git repository. Do not run any `git` command.
Every path you need is inside that folder. Do NOT search any drive.

## What already exists (read these first)

- `C:/Users/RIFE/Downloads/video-gen/record.js` — a WORKING Playwright recording rig.
  Copy its patterns; do not reinvent them. In particular reuse verbatim:
  - `login(page, role)` — clicks the demo quick-login card then submits. Roles: `admin`
    (admin@klinik.com) and `dokter` (arina@klinik.com). No password is typed by you;
    the demo app fills the form itself.
  - `hideChrome(page)` — injects `div.bg-amber-50.border-b { display:none !important }`.
    This hides the sandbox banner. A JS/DOM hide does NOT survive React re-renders; the
    stylesheet does. **Re-inject after every full `page.goto`** — a real navigation drops
    the injected stylesheet.
  - `glide(page, fx, fy, tx, ty, steps)` — eased mouse movement so the cursor reads as
    human on camera. Never use a bare `page.mouse.move` jump.
  - The `clip(name, role, body)` wrapper — one browser context per clip, 1920x1080,
    `recordVideo`, then rename the random webm to `<name>.webm`.
- `C:/Users/RIFE/Downloads/video-gen/package.json` — `playwright` is already installed.
  Run scripts with `node <file>.js` from the working directory.

## The app

Base URL: `https://demo-dokter-gigi.nusawebsite.com`

Confirmed client-side routes (read out of the app's own JS bundle — these are real):

```
/dashboard            /patients             /patients/:id         /patients/:id/visits
/appointments         /queue                /treatments           /promo-codes
/tooth-conditions     /medicines            /invoices             /invoices/:id
/commissions          /staff-report         /doctors              /nurses
/front-offices        /home-edit            /settings             /profile
/odontogram/:patientId                      /examination/:id
/satusehat-logs       /doctor/my-commissions               /reserve-appointment
```

Role notes, already verified:
- `admin` lands on `/dashboard` and sees the full sidebar.
- `dokter` lands on `/queue` and sees a SHORT sidebar (Data Pasien, Appointment, Antrean,
  Komisi Dokter, Profil Saya). The odontogram is doctor-only: the app string is
  "Hanya Dokter yang dapat edit Odontogram". Record `/odontogram/1` as `dokter`.
- The demo blocks writes ("MODE DEMO AKTIF — Tombol Hapus, Tambah, Edit, dan Simpan
  Pengaturan sengaja dinonaktifkan"). So: **open, filter, switch tabs, scroll, hover,
  expand — but never expect a save to succeed.** Do not click Hapus/Tambah/Edit/Simpan.
- Some pages load data slowly. `/commissions` needs ~6s before the figures populate;
  recording earlier captures "Memuat..." and `Rp 0`. Where a page has numbers, wait for
  them with `page.waitForFunction` before recording the dwell.

## What to build

Write `C:/Users/RIFE/Downloads/video-gen/record-library.js`.

It must produce **at least 18 separate clips** into
`C:/Users/RIFE/Downloads/video-gen/footage-lib/` — one clip per feature, each showing that
feature actually being USED, not just loaded. Cover every route above that renders content.

Each clip must:
1. Log in with the correct role for that feature.
2. Call `hideChrome(page)` after login AND after every `page.goto`.
3. Wait until the page's real content is on screen (rows present, figures non-zero, chart
   drawn) before the dwell begins.
4. Perform **real interaction** — this is the point of the task. Pick what fits the page:
   - open a table row / detail view, then come back
   - switch tabs (e.g. patient detail has "Info Pasien" / "Riwayat Kunjungan" /
     "Riwayat Perubahan"; the queue has "Antrian Aktif" / "Riwayat Antrian")
   - change a date filter or a dropdown
   - type into a search box
   - scroll a long table with `page.mouse.wheel`, slowly, in two or three steps
   - hover rows, buttons and chart points so tooltips appear
   - expand/collapse anything expandable
5. Hold long enough to be usable: **each clip needs at least 12 seconds of usable content
   AFTER login**, and login takes about 8 seconds, so most clips will be ~20-25s long.
6. Print, per clip, the same self-reported markers `record.js` prints:
   `content starts at ~<x>s` and `clip content ends at ~<y>s`.

## Required output: a manifest

Also write `C:/Users/RIFE/Downloads/video-gen/footage-lib/manifest.json`, an array where
each entry is:

```json
{
  "name": "patients-detail",
  "file": "footage-lib/patients-detail.webm",
  "role": "admin",
  "route": "/patients/1",
  "feature": "Detail pasien + tab riwayat kunjungan",
  "contentStart": 8.1,
  "contentEnd": 24.6,
  "actions": ["open row 1", "tab Riwayat Kunjungan", "scroll", "back to list"]
}
```

`contentStart`/`contentEnd` are the numbers your own script measured, in seconds from the
start of that clip's video file. They matter more than anything else here: the editor uses
them to pick `data-media-start`, and a wrong value puts the login screen in the final video.

## Rules

- Write files as **UTF-8 without BOM, with LF line endings**. Verify before you finish.
- Do not run `git`. Do not commit anything.
- Do not modify `record.js`, `record-s3.js`, `index.html`, or anything under
  `dental-review/`. Create new files only, plus `footage-lib/`.
- Do not add new npm dependencies.
- Run the script yourself and confirm every clip file actually exists and is non-empty.
  If a route 404s or renders nothing, drop it from the manifest and say so in your summary
  — do not invent an entry.
- Finish with a short summary: how many clips, total size, and any route you skipped and
  why.
