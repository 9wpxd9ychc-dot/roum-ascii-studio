# Roum ASCII Studio

A browser-based video-to-ASCII studio. Video files are processed locally in the browser and are never uploaded by the app.

## Render engines

- **Worker Engine** — uses a dedicated Web Worker for pixel analysis so that part of the work does not block the page's main thread.
- **Compatibility Engine** — performs the same pixel analysis on the main thread for browsers where Workers are unavailable or problematic.

Both engines use the same selected resolution, character density, frame rate, and color profile. The app does not silently lower mobile settings. High resolution, dense characters, and high FPS can still exceed a device's real-time rendering capacity; choose a lower setting yourself if the browser becomes unresponsive.

## Saving on iPhone

Use **Save to Photos** to open the iOS share sheet when the browser supports sharing video files. Select **Save Video** there. If direct file sharing is unsupported, use **Download video**, then save the downloaded video from Files. A website cannot silently write a video into Photos.

## Important limitation

There is no server-side/cloud video renderer in this zero-cost setup. A Cloudflare Worker without object storage or a durable job store cannot reliably accept, retain, and render larger videos in the background. The two available engines are local browser engines; neither promises background rendering after Safari is minimized or the device is locked.

## Deploy

Published with GitHub Pages using `.github/workflows/deploy-pages.yml`.

## Current input limits

- Input video: 50 MB maximum
- Duration: 30 seconds maximum
- Output format depends on the browser's MediaRecorder support (MP4 where available, otherwise WebM)
- Actual render speed and supported recording formats depend on the device and browser
