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

Photos are **not** stored in Git. The repo holds code plus a 40 KB
`manifest.json`; the images themselves live in Cloudflare R2, which has no
egress charge and a 10 GB free tier (the whole library is well under 1 GB).

| Bucket | Access | Holds |
|--------|--------|-------|
| `photos-originals` | private | full-resolution scans — your offsite backup |
| `photos-web` | public, via `img.matassavickis.com` | the generated WebP the site links to |

### One-time setup

1. **Create both buckets.** Dashboard -> R2 -> Create bucket.
2. **Make `photos-web` public.** Bucket -> Settings -> Public access ->
   *Custom Domains* -> Connect Domain -> `img.matassavickis.com`. DNS and the
   certificate are issued automatically. (The *R2.dev subdomain* toggle in the
   same panel is a different thing: it is rate-limited and not CDN-cached, so
   use it only for testing.)
3. **Create an API token.** R2 -> Manage API Tokens -> Create, with
   Object Read & Write. Note the access key, secret, and the endpoint
   `https://<account-id>.r2.cloudflarestorage.com`.
4. **Configure rclone.**

   ```bash
   sudo apt install rclone     # or: brew install rclone
   rclone config
   ```

   Choose `n` (new remote), name it **`r2`**, storage type `s3`, provider
   `Cloudflare R2`, then paste the access key, secret, and endpoint. Leave
   region blank. Verify with `rclone lsd r2:`.
5. **Point the site at the bucket.** `imageBaseUrl` in
   [`site.config.json`](site.config.json).

   > **Currently set to the `pub-*.r2.dev` development URL.** That URL works,
   > but Cloudflare rate-limits it and does not CDN-cache it — and this
   > gallery loads ~187 thumbnails per visit, which is exactly the traffic
   > shape it handles worst. Connect `img.matassavickis.com` (step 2) and
   > change this value before treating the site as live.

### Publishing photos

```bash
# add
cp ~/scans/*.jpg "photos/batch 3/"
npm run sync

# remove
rm "photos/batch 1/0002_2A@London@2026.jpg"
npm run sync
```

`npm run sync` resizes anything new (cached by size + mtime, so re-runs are
fast), mirrors `public/generated/` into `photos-web`, and mirrors `photos/`
into `photos-originals`. Because it uses `rclone sync` rather than `copy`,
deleting a file locally deletes it from R2 too.

Then commit the manifest — text only, a few KB:

```bash
git add src/generated/manifest.json && git commit -m "Add batch 3" && git push
```

Pages rebuilds in about a minute. The images are already live the moment
`npm run sync` finishes.

### How the URLs work

`manifest.json` stores site-relative paths (`/generated/foo.webp`).
[`src/imageUrl.js`](src/imageUrl.js) prefixes them with `imageBaseUrl` in a
production build, and leaves them alone during `npm run dev` so local photos
are served straight off your disk. Set `VITE_IMAGE_BASE` to override either
default — useful for testing against the `r2.dev` URL before the custom
domain is connected.

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

> **Note on photo size.** This workflow stores your original photos in the
> Git repo. That's fine for a normal film library (hundreds of MB to a couple
> of GB). GitHub rejects any **single file over 100 MB**, so keep individual
> scans under that (JPEG exports are typically 2–15 MB — no problem). If you
> expect a very large library, use **Option B** instead, which keeps originals
> off the internet entirely.

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
# add a photo
cp ~/scans/new-frame.jpg "photos/"
git add . && git commit -m "Add new frame" && git push

# remove a photo
git rm "photos/old-frame.jpg"
git commit -m "Remove frame" && git push
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
Adding/removing a photo = edit the `photos/` folder, then run those two
commands again.

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

- **Build fails on `sharp`.** Make sure `NODE_VERSION` is `20`. Cloudflare's
  Linux build image installs `sharp`'s prebuilt binary automatically.
- **Photos didn't update.** Confirm the file is actually in `photos/` and was
  committed/pushed (Option A) or that you re-ran `npm run build` before
  deploying (Option B).
- **A photo is rotated wrong.** The build auto-orients using EXIF. If a scan
  has no orientation tag, rotate the source file and re-deploy.
- **Want a different look.** Colors and layout live in
  [`src/index.css`](src/index.css); text and links in
  [`site.config.json`](site.config.json).
