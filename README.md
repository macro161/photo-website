# Photography website

A self-hosted gallery for 35mm film photography. Plain React (Vite) — no
CMS, no database, no monthly bill. You own all of it.

- **Add a photo** → drop an image file in [`photos/`](photos/)
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

Open the URL it prints (usually http://localhost:5173). It ships with three
placeholder sample images — delete them from `photos/` whenever you like.

```bash
npm run build    # produce the deployable site in dist/
npm run preview  # preview that production build locally
```

## Personalize it

Edit [`site.config.json`](site.config.json) — your name, tagline, the About
text, social links, and gallery sort order. No code required.

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
| [`photos/`](photos/) | Your library. The source of truth. |
| [`scripts/generate.mjs`](scripts/generate.mjs) | Build step: makes WebP thumbnails + large versions, parses caption/date from filenames, writes the manifest, deletes orphaned images. Runs automatically before `dev`/`build`. |
| [`src/`](src/) | The React app — gallery grid + lightbox. |
| `src/generated/manifest.json` | Auto-generated list of photos. Don't edit by hand. |
| `public/generated/` | Auto-generated web images. Git-ignored; rebuilt on every deploy. |
| [`site.config.json`](site.config.json) | Your text and links. |
