# Photo website

React + Vite gallery for 35mm film scans. Photos are served from the Cloudflare R2 bucket `photos-web`.
Catalogs and albums come from the bucket's folder structure. Run `npm run index` to regenerate
`src/generated/manifest.json`. Covers and captions are set in `site.config.json`. See README.md.

## Ongoing work

- **Done (2026-11-22): photo categorization.** The Drive `Film photos` folder is sorted and named by trip or place.
  Notes, folder IDs and the Drive connector's limits (it can't move files, so we copy them) are in
  [PHOTO_CONTEXT.md](PHOTO_CONTEXT.md); only optional leftovers remain, listed there. Read it before touching Drive again.
- **Done:** the route feature (3D terrain + GPS route behind the photos, Photos/Route switch, stats) lives on the album page of the 15 hike albums; it is no longer in the Lab (`src/route/`, data from `scripts/build-routes.mjs`). AllTrails links for them are in `src/albumLinks.json`. Albums added to `hikeAlbums.json` later need an entry there too (recording URLs are in `gpx/CHECKLIST.md`).
- **TODO: album splitting.** Some albums mix several hikes or trips (Tour de l'Argentine + Lavaux, Rochers de Naye,
  Black Forest + Valsorey, Barrhorn, Picos de Europa, Spain + Tour de l'Argentine...). Split them so each album has
  one GPX recording (two at most). Then add each new album to `src/lab/hikeAlbums.json` and run
  `node scripts/build-routes.mjs <slug>` and an entry in `src/albumLinks.json`; the album page then gets the route feature. It exists today for the 15
  albums already listed in `hikeAlbums.json`.

## Decisions (2026-11-21)

- **Barrhorn full-res:** dropped for good. The album stays at its 1544×1024 Drive source; don't ask about it again.
- **Album dates:** accepted as they are, including the approximate ones. Don't revisit.
- **SEO:** deliberately not a goal. The owner doesn't want strangers discovering the site. No SEO work, and no active de-indexing either.
- **Toubkal 1 Nov GPX (track 2):** +49 m is correct, it was a descent day.
