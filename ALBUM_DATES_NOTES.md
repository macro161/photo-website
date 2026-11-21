# Album dates: sources and doubts

`src/albumDates.json` has one entry per catalog and per catalog/album key in the manifest (28 keys).

Sources, best first: AllTrails activities (`src/lab/activities.json`), then Drive `Film photos` folder names, then roll/frame order and file-name evidence.
Drive folder dates are upload dates, not shooting dates, so they were only used as bounds.
`src/lab/hikeAlbums.json` was checked. Changes: `les-paccots` now also maps #21 (approx), and `col-de-mollendruz` is approx (probable match only).

## Doubtful (please confirm)
- `30th-birthday` 13-21 Sep 2026: inferred from the roll sequence only.
- `london-2026` 27 Apr-16 May 2026: only bounded by the activity gap and upload dates.
- `ukraine` 17-30 May 2026: inferred from roll order.
- `swiss/cow-fights` 18 Apr-15 May 2026: bounded only.
- `swiss/hasenmatt` 16-31 Mar 2026: after the Chasseron frames on the same roll; maybe the 21 Mar untitled hike.
- `spain-2026` and `night-life-madrid` early Aug 2026: file prefix `10_08_2026` is read as a scan date. The eclipse is 12 Aug 2026.
- `lithuania/winter-2025` mixes Dec 2025 frames with Easter 2026 frames (R1-02185); consider splitting. Loose roll R1-04890 (Lithuania/Šiauliai) could not be dated.
- `swiss/random` is unknown (nulls).
- `swiss/col-de-mollendruz` is the untitled 25 Jan activity (probable).
