# Photography website

A self-hosted gallery for 35mm film photography. Plain React (Vite) — no
CMS, no database, no monthly bill. You own all of it.

- **Add a catalog** → make a folder in [`photos/`](photos/), e.g. `London 2026`
- **Add a photo** → drop an image file into one of those folders
- **Remove a photo** → delete it from [`photos/`](photos/)
- **Display** → a responsive masonry gallery with a full-screen lightbox and
  keyboard navigation
- **Describe** → put the caption and date right in the filename with `@`
  (e.g. `roll3@Rue de Rivoli@2026-05-05.jpg`) — see [photos/README.md](photos/README.md)

A build step automatically creates fast, optimized web versions of every
photo. You upload full-resolution scans; visitors get small WebP images. You
never touch a list of files or write any code.

---

## Run it locally

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install      # once
npm run dev      # start the dev server (processes photos, then serves)
```

Open the URL it prints (usually http://localhost:5173). During `npm run dev`
photos are served from your own disk, so the gallery works offline and shows
photos before you've uploaded them.

```bash
npm run build    # produce the deployable site in dist/
npm run preview  # preview that production build locally
```

## Personalize it

Edit [`site.config.json`](site.config.json) — your name, tagline, the About
text, social links, and gallery sort order. No code required.

## Catalogs

Each top-level folder in `photos/` is a catalog with its own page:

```
photos/
  London 2026/   -> catalog "London 2026"
  Swiss/         -> catalog "Swiss"
  Lithuania/     -> catalog "Lithuania"
```

The site's front page lists one cover card per catalog; clicking a card opens
that catalog's grid. Nothing in the code knows these names — **creating a
folder creates a catalog**, and it appears on the next `npm run generate`.

Catalogs are ordered newest-photo-first, and the cover is the catalog's first
photo. Override either in [`site.config.json`](site.config.json):

```json
"gallery": {
  "catalogOrder": ["London 2026", "Swiss"],
  "covers": { "Swiss": "0042.jpg" }
}
```

Catalogs you don't list simply follow, so the config never needs updating when
you add one. Photos left loose in `photos/` land in a catalog called "Other",
and folders nested deeper (`Swiss/day 2/`) are yours to organise — only the
first level names the catalog.

## Add a caption and date (optional)

Captions and dates come from the **filename**, using `@` as a separator:

- `0042.jpg` → no caption
- `0042@Rue de Rivoli.jpg` → caption "Rue de Rivoli"
- `0042@Rue de Rivoli@2026-05-05.jpg` → caption + date

Full details in [photos/README.md](photos/README.md).

## Deploy it

See **[DEPLOY.md](DEPLOY.md)** — free hosting on Cloudflare Pages, two ways:
push to GitHub for automatic rebuilds, or one-command direct upload.

---

## How it's wired (for the curious)

| Path | What it is |
|------|------------|
| [`photos/`](photos/) | Your library — one folder per catalog. The source of truth. Git-ignored; lives in Cloudflare R2. |
| [`src/catalogs.js`](src/catalogs.js) | Groups the manifest into catalogs, applies ordering and covers. |
| [`src/imageUrl.js`](src/imageUrl.js) | Points images at R2 in production, at your disk during `npm run dev`. |
| [`scripts/generate.mjs`](scripts/generate.mjs) | Build step: makes WebP thumbnails + large versions, parses caption/date from filenames, writes the manifest, deletes orphaned images. Runs automatically before `dev`/`build`. |
| [`src/`](src/) | The React app — gallery grid + lightbox. |
| `src/generated/manifest.json` | Auto-generated list of photos. Don't edit by hand. |
| `public/generated/` | Auto-generated web images. Git-ignored; uploaded to R2 by `npm run sync`. |
| [`site.config.json`](site.config.json) | Your text and links. |
