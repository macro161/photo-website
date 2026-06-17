# Your photos go here

This folder is your photo library. **The website is built from whatever is in here.**

## Add a photo
Copy an image file into this folder. Any image type works: `.jpg` `.jpeg`
`.png` `.webp` `.tif` `.tiff`.

## Remove a photo
Delete the file from this folder.

## Hide a photo (without deleting it)
Put a capital **`X`** at the very start of the filename and it won't appear on
the site. For example, rename `0042@Paris.jpg` to `X0042@Paris.jpg` to hide it,
then remove the `X` to show it again.

That's it. On the next `npm run dev` or deploy, the site creates fast,
optimized web versions automatically and rebuilds the gallery. You never edit
code or a list of photos.

## Naming: add a description and date with "@"

The text in the **filename** controls what's shown under a photo. Use the `@`
symbol to separate the parts. The part before the first `@` is ignored — name
it however you like (e.g. your scan number).

| Filename | Shows |
|----------|-------|
| `0042.jpg` | nothing — just the photo |
| `0042@Rue de Rivoli.jpg` | description: **Rue de Rivoli** |
| `0042@Rue de Rivoli@2026-05-05.jpg` | description **Rue de Rivoli** + date **2026-05-05** |

Notes:
- The description and date are shown **exactly as you write them** — any text works.
- For correct newest-first ordering, write dates as `YYYY-MM-DD` (e.g. `2026-05-05`).
- Photos are ordered newest-date-first by default (change in `site.config.json`).
