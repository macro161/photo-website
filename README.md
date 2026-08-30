# Photography website

A self-hosted gallery for 35mm film photography. Plain React (Vite) — no
CMS, no database, no monthly bill. Photos live in a Cloudflare R2 bucket;
the repo holds only code and a small index.

- **Add a catalog** → create a folder in the `photos-web` R2 bucket
- **Add a photo** → upload a web-sized export into that folder
- **Publish** → `npm run index`, then commit and push
- **Display** → catalog cards on the front page, each opening a masonry grid
  with a full-screen lightbox and keyboard navigation

Nothing is resized for you: upload images already sized for the web (around
2000px on the long edge is plenty). The index reads each photo's dimensions
straight from the bucket so the grid can reserve space without jumping.

---

## Run it locally

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install      # once
npm run index    # list the R2 bucket, write src/generated/manifest.json
npm run dev      # start the dev server
```

Open the URL it prints (usually http://localhost:5173). Photos load from R2
in both dev and production, so you need `npm run index` to have run at least
once (and an internet connection).

```bash
npm run build    # produce the deployable site in dist/
npm run preview  # preview that production build locally
```

## Personalize it

Edit [`site.config.json`](site.config.json) — your name, tagline, the About
text, social links, and gallery sort order. No code required.

## Catalogs

Each top-level folder in the `photos-web` bucket is a catalog with its own
page:

```
photos-web/
  London 2026/   -> catalog "London 2026"
  Swiss/         -> catalog "Swiss"
  Lithuania/     -> catalog "Lithuania"
```

The front page lists one cover card per catalog; clicking a card opens that
catalog's grid. Nothing in the code knows these names — **creating a folder
creates a catalog**, and it appears on the next `npm run index`.

Catalogs are ordered newest-photo-first and the cover is the catalog's first
photo. Override either in [`site.config.json`](site.config.json):

```json
"gallery": {
  "catalogOrder": ["London 2026", "Swiss"],
  "covers": { "London 2026": "MATAS PORTRA400 6740.webp" },
  "captions": {
    "London 2026/0042.jpg": { "description": "Rue de Rivoli", "date": "2026-05-05" }
  }
}
```

`covers` takes a filename; `captions` takes the full key including the
catalog folder. Catalogs you don't list simply follow, so the config never
needs updating when you add one. Photos uploaded to the bucket root land in a
catalog called "Other", and folders nested deeper (`Swiss/day 2/`) are yours
to organise — only the first level names the catalog.

A leading capital `X` on a file or folder hides it (`XSwiss/`, `X0042.jpg`).

## Captions and dates from the filename

As an alternative to the `captions` config, `@` in the filename still works:

- `0042.jpg` → no caption
- `0042@Rue de Rivoli.jpg` → caption "Rue de Rivoli"
- `0042@Rue de Rivoli@2026-05-05.jpg` → caption + date

## Deploy it

See **[DEPLOY.md](DEPLOY.md)** — free hosting on Cloudflare Pages, two ways:
push to GitHub for automatic rebuilds, or one-command direct upload.

---

## How it's wired (for the curious)

| Path | What it is |
|------|------------|
| `photos-web` R2 bucket | Your library, one folder per catalog. The source of truth. |
| [`scripts/index.mjs`](scripts/index.mjs) | Lists the bucket, reads each photo's dimensions with a ranged request, writes the manifest. Never downloads whole photos except as a fallback. |
| [`src/catalogs.js`](src/catalogs.js) | Groups the manifest into catalogs, applies ordering and covers. |
| [`src/imageUrl.js`](src/imageUrl.js) | Prefixes manifest paths with `imageBaseUrl`. |
| [`src/`](src/) | The React app — catalog index, grid, lightbox. |
| `src/generated/manifest.json` | Auto-generated photo index. Don't edit by hand. |
| [`site.config.json`](site.config.json) | Your text, links, catalog order, covers, captions. |

Listing the bucket needs credentials, so `npm run index` requires rclone to be
configured — see [DEPLOY.md](DEPLOY.md). Reading photos does not: they are
public.
