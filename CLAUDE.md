# Photo website

React + Vite gallery for 35mm film scans. Photos are served from the Cloudflare R2 bucket `photos-web`.
Catalogs and albums come from the bucket's folder structure. Run `npm run index` to regenerate
`src/generated/manifest.json`. Covers and captions are set in `site.config.json`. See README.md.

## Ongoing work

- **Photo categorization (current):** sorting the film scans in Google Drive → `Film photos`
  by trip or place. Progress, folder IDs, roll identifications and the Drive
  connector's limits (it can't move files, so we copy them instead) are in [PHOTO_CONTEXT.md](PHOTO_CONTEXT.md).
  Read it before touching Drive, and update it after each roll you sort.
- **Planned:** AllTrails links and map links for the hike albums (see the end of PHOTO_CONTEXT.md).

## Decisions (2026-11-21)

- **Barrhorn full-res:** dropped for good. The album stays at its 1544×1024 Drive source; don't ask about it again.
- **Album dates:** accepted as they are, including the approximate ones. Don't revisit.
- **SEO:** deliberately not a goal. The owner doesn't want strangers discovering the site. No SEO work, and no active de-indexing either.
- **Toubkal 1 Nov GPX (track 2):** +49 m is correct, it was a descent day.
