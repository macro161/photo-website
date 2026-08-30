# Photography website

A self-hosted gallery for 35mm film photography. Plain React (Vite) — no CMS,
no database, no monthly bill. Photos live in a Cloudflare R2 bucket and the
repo holds only code plus a small index, so adding photos never grows it.

The front page shows one cover card per catalog; opening a catalog gives a
masonry grid with a full-screen lightbox and keyboard navigation.

## Adding photos and catalogs

Each top-level folder in the `photos-web` bucket is a catalog. **Creating a
folder creates a catalog** — nothing in the code needs to know its name.

```
photos-web/
  London 2026/   -> catalog "London 2026"
  Swiss/         -> catalog "Swiss"
```

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
  "covers": { "London 2026": "MATAS PORTRA400 6740.webp" },
  "captions": {
    "London 2026/0042.jpg": { "description": "Rue de Rivoli", "date": "2026-05-05" }
  }
}
```

`covers` takes a filename; `captions` takes the full key including the catalog
folder. Catalogs you don't list simply follow, so this never needs updating
when you add one.

Captions and dates can also come from the filename, using `@` as a separator:
`0042@Rue de Rivoli@2026-05-05.jpg`. A leading capital `X` on a file or folder
hides it.

---

First-time setup (R2 buckets, rclone credentials, custom domain) and hosting
are in **[DEPLOY.md](DEPLOY.md)**.
