# Roum ASCII Studio

A browser-based video-to-ASCII animation studio. Video processing happens locally in the visitor's browser; files are not uploaded to a server.

## Deploy

Published with GitHub Pages using `.github/workflows/deploy-pages.yml`.

## Limits

- Input video: 20 MB maximum
- Duration: 30 seconds maximum
- Preview and rendering use browser APIs
- MP4 encoding uses FFmpeg.wasm loaded from jsDelivr; if unavailable, the browser-recorded WebM is offered instead.

No Cloudflare account, API token, Worker, database, or server-side video storage is required.