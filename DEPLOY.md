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

## Build settings (used by both options)

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
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

## Custom domain (optional, either option)

In the Pages project → **Custom domains** → **Set up a domain**. If your domain
is on Cloudflare, it's automatic. If it's elsewhere, Cloudflare shows you the
DNS records to add. HTTPS is provisioned for you.

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
