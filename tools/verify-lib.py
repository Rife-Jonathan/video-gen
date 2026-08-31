"""Verify the footage library and compute a trustworthy start time per clip.

Why this exists
---------------
`contentStart` in manifest.json is measured by the recorder BEFORE each clip's body
runs. But most bodies begin with a `page.goto`, and the CSS that hides the sandbox
banner is injected only AFTER that navigation lands. So the first seconds of the
"content" window can still show the banner. Verified on `examination`: banner
present at contentStart+1 and +2, gone from +3 onward.

This script samples a thin strip where the amber banner sits and finds the first
moment each clip is actually clean. It writes that back as `safeStart`, which is
what the composition should use for `data-media-start`.

Usage:  .venv-asr\\Scripts\\python.exe verify-lib.py        (or any python)
"""

import json
import os
import subprocess

FF = (r"C:/Users/RIFE/Downloads/roop-unleashed-main/roop-unleashed-main"
      r"/installer/installer_files/ffmpeg/bin")
LIB = "footage"
MANIFEST = os.path.join(LIB, "manifest.json")

# The banner renders as a full-width amber strip just under the top bar.
CROP = "crop=1400:24:400:92,scale=1:1"
STEP = 0.5           # scan resolution, seconds
MIN_USABLE = 10.0    # a clip needs at least this much clean content to be worth cutting


def strip_rgb(path, t):
    """Average colour of the banner strip at time t, or None if the frame is unreadable."""
    r = subprocess.run(
        [FF + "/ffmpeg.exe", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.2f}",
         "-i", path, "-frames:v", "1", "-vf", CROP,
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True,
    )
    if len(r.stdout) < 3:
        return None
    return r.stdout[0], r.stdout[1], r.stdout[2]


def has_banner(rgb):
    """Amber tint: clearly warm and bright. Normal page there is neutral (~249,251,252)."""
    if rgb is None:
        return False
    R, G, B = rgb
    return (R - B) >= 8 and R > 230


def duration(path):
    out = subprocess.run(
        [FF + "/ffprobe.exe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True,
    ).stdout.strip()
    return float(out) if out else 0.0


def main():
    manifest = json.load(open(MANIFEST, encoding="utf8"))
    problems = []

    print(f"{'clip':22} {'cStart':>7} {'safe':>7} {'usable':>7}  status")
    for e in manifest:
        path = os.path.join(LIB, os.path.basename(e["file"]))
        if not os.path.exists(path):
            problems.append(f"{e['name']}: berkas hilang")
            print(f"{e['name']:22} {'':>7} {'':>7} {'':>7}  BERKAS HILANG")
            continue

        dur = duration(path)
        end = min(e["contentEnd"], dur)

        # Find the LAST frame that still shows the banner, not the first clean one.
        # The first frame of a clip's content window is often the PREVIOUS route, which
        # is already clean — the banner appears a moment later, once the goto lands.
        # Taking the first clean frame therefore passes clips that are not clean at all.
        last_banner = None
        t = e["contentStart"]
        while t < end:
            if has_banner(strip_rgb(path, t)):
                last_banner = t
            t += STEP

        safe = round(e["contentStart"] if last_banner is None else last_banner + STEP, 2)

        if safe >= end:
            problems.append(f"{e['name']}: banner sampai akhir klip")
            print(f"{e['name']:22} {e['contentStart']:7.2f} {'-':>7} {'-':>7}  BANNER SAMPAI AKHIR")
            continue

        usable = round(end - safe, 2)
        status = "ok"
        if usable < MIN_USABLE:
            status = f"PENDEK ({usable}s)"
            problems.append(f"{e['name']}: hanya {usable}s bersih")
        elif safe > e["contentStart"] + 0.01:
            status = f"digeser +{round(safe - e['contentStart'], 2)}s"

        e["safeStart"] = safe
        e["usable"] = usable
        print(f"{e['name']:22} {e['contentStart']:7.2f} {safe:7.2f} {usable:7.2f}  {status}")

    json.dump(manifest, open(MANIFEST, "w", encoding="utf8"),
              ensure_ascii=False, indent=2)
    print(f"\nmanifest diperbarui: {len(manifest)} entri, kini punya safeStart + usable")
    print("bermasalah:", problems or "tidak ada")


if __name__ == "__main__":
    main()
