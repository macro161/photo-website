# Deploying to Cloudflare Pages

Cloudflare Pages hosts the site for **free** (unlimited bandwidth, custom
domain, automatic HTTPS). At your scale you will not pay anything.

There are two ways to deploy. Pick one.

- **Option A — Connect GitHub (recommended).** Push your code; Cloudflare
  rebuilds automatically every time you add or remove a photo. This is the
  "drop a file, commit, done" workflow.
- **Option B — Direct upload.** One command from your computer, no GitHub
  account, and your full-resolution originals never leave your machine. Best
  if your photo library is large.

---

## Photo storage: Cloudflare R2

Photos are **not** stored in Git. The repo holds code plus a small
`manifest.json`; the photos themselves live in Cloudflare R2, which has no
egress charge and a 10 GB free tier.

| Bucket | Access | Holds |
|--------|--------|-------|
| `photos-web` | public, via the r2.dev URL (or a custom domain) | your photos, one folder per catalog |
| `photos-originals` | private | archive of full-resolution scans; the site never reads it |

### Publishing photos

1. **Upload** web-sized exports into `photos-web`, one folder per catalog,
   using the Cloudflare dashboard or rclone:

   ```bash
   rclone copy ~/exports/london r2:"photos-web/London 2026" --progress
   ```

   Use `<Catalog>/<file>.jpg`, or `<Catalog>/<Album>/<file>.jpg` to group a
   catalog into albums. No extra prefix — a key like
   `photos/London 2026/x.jpg` would create a catalog called "photos".

   Nothing resizes these. Export around 2000px on the long edge; a 7 MB scan
   is a 7 MB download for every visitor.

2. **Index and publish:**

   ```bash
   npm run index
   git add src/generated/manifest.json && git commit -m "Add London 2026" && git push
   ```

`npm run index` lists the bucket and records each photo's catalog, caption,
date and pixel dimensions. Dimensions come from a ranged request that reads
only the file header, and are cached by size + modified time, so re-runs are
fast and cheap.

**Deleting** a photo is the reverse: remove it from the bucket, re-run
`npm run index`, commit and push.

### One-time setup

`npm run index` lists the bucket, which needs credentials (reading photos does
not — they're public).

1. **Create an API token.** R2 → Manage API Tokens → Create, with
   Object Read & Write. Note the access key, secret, and the endpoint
   `https://<account-id>.r2.cloudflarestorage.com`.
2. **Configure rclone.**

   ```bash
   sudo apt install rclone     # or: brew install rclone
   rclone config create r2 s3 \
     provider=Cloudflare \
     access_key_id=YOUR_KEY \
     secret_access_key=YOUR_SECRET \
     endpoint=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com \
     acl=private
   ```

   Verify with `rclone lsd r2:`. The remote name is set by `r2Remote` in
   [`site.config.json`](site.config.json).
3. **Make `photos-web` public.** Bucket → Settings → Public access →
   *Custom Domains* → Connect Domain → `img.matassavickis.com`, and set
   `imageBaseUrl` in [`site.config.json`](site.config.json) to match.

   > **Currently set to the `pub-*.r2.dev` development URL.** That works, but
   > Cloudflare rate-limits it and does not CDN-cache it. Connect the custom
   > domain before treating the site as live.

---

## Build settings (used by both options)

| Setting | Value |
|---------|-------|
| Build command | `npm run build` (= `vite build`; photos are processed locally, not in CI) |
| Build output directory | `dist` |
| Node version | `20` (set env var `NODE_VERSION` = `20`) |

---

## Option A — Connect a GitHub repo (auto-rebuild)

### 1. Put this project on GitHub

This folder isn't a git repo yet. From the project folder:

```bash
git init
git add .
git commit -m "My photography site"
```

Create an empty repository on https://github.com/new (no README), then:

```bash
git remote add origin https://github.com/<your-username>/<repo>.git
git branch -M main
git push -u origin main
```

> **Note.** Photos are not in this repo — they live in the `photos-web` R2
> bucket (see above). Only code and a small `manifest.json` are pushed, so the
> repo stays small no matter how large your library gets.

### 2. Create the Pages project

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers &
   Pages** → **Create** → **Pages** → **Connect to Git**.
   (Create a free Cloudflare account if you don't have one.)
2. Authorize GitHub and pick your repository.
3. Set the build configuration:
   - **Framework preset:** `Vite` (or `None`)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Expand **Environment variables** and add:
   - `NODE_VERSION` = `20`
5. Click **Save and Deploy**. The first build takes a minute or two; then your
   site is live at `https://<project>.pages.dev`.

### 3. From now on

```bash
# upload photos to the bucket (dashboard or rclone), then:
npm run index
git add src/generated/manifest.json && git commit -m "Add photos" && git push
```

Each push triggers an automatic rebuild. Your changes are live in ~1–2 minutes.

---

## Option B — Direct upload with Wrangler (no GitHub)

Your originals stay on your computer; only the optimized site is uploaded.

### One-time setup

```bash
npm install -g wrangler   # Cloudflare's CLI
wrangler login            # opens a browser to authorize
```

### Every time you want to publish

```bash
npm run build
wrangler pages deploy dist --project-name=photography
```

The first run creates the project and prints your live `*.pages.dev` URL.
Adding/removing a photo = change the `photos-web` bucket, run
`npm run index`, then run those two commands again.

---

## Custom domain

If the site deployed as a **Worker** (its URL ends in `*.workers.dev`):

1. Dashboard → **Workers & Pages** → open your worker.
2. **Settings** → **Domains & Routes** → **Add** → **Custom Domain**.
3. Enter your domain (e.g. `matassavickis.com`); add `www.` too if you want both.
4. If the domain is in the same Cloudflare account, DNS + HTTPS are set up
   automatically in a minute or two. Optionally disable the `*.workers.dev`
   route here so the site is only served from your domain.

If it deployed as a **Pages** project (its URL ends in `*.pages.dev`):

- Pages project → **Custom domains** → **Set up a domain**. Same automatic
  DNS + HTTPS when the domain is on Cloudflare.

---

## Troubleshooting

- **`npm run index` says it cannot list the bucket.** rclone isn't configured,
  or the remote name doesn't match `r2Remote` in `site.config.json`. Check
  with `rclone lsd r2:`.
- **A photo doesn't appear.** Confirm it's in the bucket under
  `<Catalog>/<file>`, that you re-ran `npm run index`, and that the updated
  `manifest.json` was committed and pushed. Files or folders starting with a
  capital `X` are hidden on purpose.
- **A catalog called "photos" or similar appeared.** Something was uploaded
  with an extra prefix; the first folder level always names the catalog.
- **The page jumps around as photos load.** `npm run index` couldn't read
  those files' dimensions — it prints which ones. Usually an unusual or
  truncated file; re-export and re-upload.
- **A photo is rotated wrong.** The index honours EXIF orientation when it can
  read it. If a scan has no orientation tag, rotate the file and re-upload.
- **Photos load slowly.** Nothing resizes them for you — check what you
  uploaded. Around 2000px on the long edge is plenty for the web.
- **Want a different look.** Colors and layout live in
  [`src/index.css`](src/index.css); text and links in
  [`site.config.json`](site.config.json).
