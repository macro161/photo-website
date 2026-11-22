# Photography website

A self-hosted gallery for 35mm film photography. Plain React (Vite) — no CMS,
no database, no monthly bill. Photos live in a Cloudflare R2 bucket and the
repo holds only code plus a small index, so adding photos never grows it.

The front page shows one cover card per catalog; opening a catalog gives a
masonry grid with a full-screen lightbox and keyboard navigation.

## Adding photos and catalogs

Each top-level folder in the `photos-web` bucket is a catalog, and a folder
inside one is an album. **Creating a folder creates a catalog or album** —
nothing in the code needs to know its name.

```
photos-web/
  London 2026/               -> catalog "London 2026", opens to its grid
  Swiss/
    Le Chasseron/            -> catalog "Swiss" -> album "Le Chasseron"
    Mont Pèlerin/            -> catalog "Swiss" -> album "Mont Pèlerin"
```

A catalog with albums shows album cards; one without opens straight to its
photos. A catalog can have both — loose photos appear below its album cards.
Folders deeper than two levels are yours to organise and don't affect the
site.

**1. Upload** web-sized exports into a catalog folder, via the Cloudflare
dashboard or rclone:

```bash
rclone copy ~/exports/london r2:"photos-web/London 2026" --progress
```

Use `<Catalog>/<file>` with no extra prefix — a key like
`photos/London 2026/x.jpg` would create a catalog called "photos".

Nothing resizes these for you. Export around 2000px on the long edge; a 7 MB
scan is a 7 MB download for every visitor.

**2. Index and publish:**

```bash
npm run index
git add src/generated/manifest.json && git commit -m "Add London 2026" && git push
```

`npm run index` lists the bucket and records each photo's catalog, caption,
date and dimensions. Cloudflare Pages rebuilds on push, and the site is live
in a minute or two.

**Removing** a photo is the reverse: delete it from the bucket, re-run
`npm run index`, commit and push.

### Optional: covers, order, captions

Catalogs are ordered newest-photo-first and the cover is the catalog's first
photo. Override any of that in [`site.config.json`](site.config.json):

```json
"gallery": {
  "catalogOrder": ["London 2026", "Swiss"],
  "covers": {
    "London 2026": "image_9.jpg",
    "Swiss/Le Chasseron": "0025_25.jpg"
  },
  "captions": {
    "London 2026/0042.jpg": { "description": "Rue de Rivoli", "date": "2026-05-05" }
  }
}
```

`covers` takes a filename, keyed by catalog name or `Catalog/Album`;
`captions` takes the full key including folders. Catalogs and albums you don't
list simply follow, so this never needs updating when you add one.

Captions and dates can also come from the filename, using `@` as a separator:
`0042@Rue de Rivoli@2026-05-05.jpg`. A leading capital `X` on a file or folder
hides it.

---

First-time setup (R2 buckets, rclone credentials, custom domain) and hosting
are in **[DEPLOY.md](DEPLOY.md)**.

## Film roll info

`src/rolls.json` holds optional roll details (all fields optional): `film`, `camera`, `lens`, `iso`, `lab`, `notes`.
Keys are a catalog slug (`swiss`), `catalogSlug/albumSlug` (`swiss/barrhorn`) or a photo id; more specific
keys override less specific ones. Whatever is filled in shows quietly in the album header and in the lightbox;
with no entry nothing is shown. Keys starting with `_` are ignored (the shipped example uses one).

```json
"swiss/barrhorn": { "film": "Kodak Portra 400", "camera": "Nikon FM2", "iso": 400 }
```

## Hike links

Hike albums (listed in `src/lab/hikeAlbums.json`) have the route feature on their normal album page: the terrain and the GPS
route sit faintly behind the photos, and a Photos / Route switch under the title brings the map forward with stats and an
elevation profile (code in `src/route/`, loaded only for those albums). The relief is baked from swisstopo's swissALTI3D (2 m LiDAR
terrain model, free geodata: use and processing allowed with the source credit "© swisstopo", shown under the map) at about 7–8 m cells,
with AWS Terrain Tiles filling anything outside Switzerland; it is shaded per pixel from a full-resolution detail texture (multi-directional
hillshade, slope, curvature, openness) on a decimated mesh of at most ~400k triangles. OpenStreetMap buildings (ODbL) within 1.8 km of the
route are drawn as small light-grey blocks (`public/route/<album>/buildings.bin`). Per album `dem.bin` is 0.4–0.95 MB and everything is
fetched only on that album's page; downloaded swissALTI3D tiles are cached in `~/.cache/photo-website-terrain/swissalti3d`. Per-album data comes from
`node scripts/build-routes.mjs <slug>` (needs the GPX in `gpx/` and network for the terrain bake). AllTrails links come from
[`src/albumLinks.json`](src/albumLinks.json), keyed by `catalog/album`: `alltrails` is a list of recording page URLs. They are
plain outbound links; nothing third-party loads with the page. The old `#/lab/route/<album>` URLs redirect to the album page.

## Swiss map

The Swiss catalog page (`#/c/swiss`) has an Albums / Map switch. The map is a grey relief of Switzerland (low-resolution elevation baked by
`node scripts/bake-swiss.mjs`, with the national border and a few city and peak names from OpenStreetMap, ODbL) with one pin per album
that has a verified place, linking to the album. Pins live in [`src/swissPlaces.json`](src/swissPlaces.json), generated by
`node scripts/build-swiss-places.mjs` (hike albums at their track start; other albums listed by hand in that script). All of it loads only
on that page; without WebGL (or on low-power devices) a flat outline map is used.
