# Drive -> website sync plan (read-only inventory, 2026-11-21)

Nothing was uploaded, copied, deleted or changed in Drive, R2 or the repo. Only this file was written.

## Method and caveats

- Drive folder ids and structure: Drive `search_files` (all sub-folder ids were listed) plus PHOTO_CONTEXT.md. Image counts per folder come from the local zip copies of the same rolls (they match the counts in PHOTO_CONTEXT.md); the Drive file lists were NOT re-enumerated (paging is unreliable and the response is ~700 bytes per file). One folder (`London 2026 B&W`, 10 JPG) was spot-checked in Drive and matches.
- On-site test: the site holds the scanner JPGs essentially unchanged (3601x2433, 3-6 MB), so a Drive/zip frame counts as ON SITE if a manifest `file` has the same size, or the same basename (ci, no extension) with size within 2%. Exact byte matches are rare because the site copies were re-saved (a few KB difference). For generic names (`0017_17.jpg`, `image_9.jpg`) the 2% rule can give false "on site" hits, so "missing" counts for those rolls are a lower bound.
- The site is a curated selection: typically 60-80% of each roll is published, the rest are probably deliberate culls (blurry, light-leaked, duplicates). "Not on site" is therefore not "forgotten": the owner should look before publishing.
- File names collide across rolls (`image_N.jpg`, `0017_17.jpg`): R2 keys are `<Catalog>/<Album>/<file>` and a same-name upload would silently overwrite another photo. Prefix generic names with the roll/date (e.g. `20260515-3_image_5.jpg`) on upload.
- Not viewed: no photos were viewed; content judgments come from PHOTO_CONTEXT.md.

## Per-folder table

Status key: group A = destination is clear, B = blocked on naming/splitting decision, C = privacy/mixed content, owner must select.

| Drive folder | id | #images | on site | not on site (MB) | status | proposed R2 prefix | local source | group / flags |
|---|---|---|---|---|---|---|---|---|
| 2026-01-25 Winter - La Montagnette + Col du Mollendruz | `1ufGhrlY1Q0063DA8f4wd1p9o3LSkwg_e` | 36 | 24 | 12 (36 MB) | PARTIAL | Swiss/La Montagnette and Swiss/Col de Mollendruz (existing) | 00001610.zip | **A** Frames 1-11 and 22-36 mix two hikes + train shots; boundary La Montagnette/Mollendruz not located. Existing albums use names like 0012_12.jpg, which collide with other rolls: rename on upload (e.g. prefix `1610-`). |
| 2026-03-01 - Mont Pèlerin + Dent de Jaman + Le Chasseron | `1bkYIqLM8OIFfyBs7gfOZyqEoau0A--2k` | 37 | 24 | 13 (42 MB) | PARTIAL | Swiss/Mont Pèlerin, Swiss/Dent du Jaman Winter(failed), Swiss/Le Chasseron, Swiss/Hasenmatt (existing) | 00001611.zip | **A** Three hikes in one roll, frame boundaries unknown; owner must assign frames to albums (or accept one new album). Rename generic names on upload. |
| 2026-02-15 - Netherlands Breda Carnaval 2026 | `1dw6go8IBfg9b0UkPXkDYuVfrPv7iN0Hc` | 37 | 22 | 15 (41 MB) | PARTIAL | Netherlands Breda 2026 (existing catalog) | 00001612.zip | **A** Not viewed. Carnival frames probably show people: owner should cull. Rename generic names. |
| 2026-05-15 London 2026 B&W | `10FjXsV0Uf7EiWYXyfIbIQjjsdHtBRaAq` | 10 | 4 | 6 (36 MB) | PARTIAL | London 2026 (existing), optionally album `B&W` | images.zip | **A** Drive-verified: 10 JPG image_2..image_11. image_1.jpg in the zip is an 11 KB stub, ignore. B&W: owner decides if mixing is ok. Names image_N collide with London 2026 (95 files): rename. |
| 2026-05-15 Swiss cow fights 2026 + London 2026 (+subfolders Swiss cow fights 2026 `1VEvAvq26obytajl9v62FW64W-fo4vFEz`, London 2026 `123muLoBVHis4PREfDMU_BY8sBQZ_9vXN`) | `12okTG1vGFjEFHaDBqP69-o-ZlywLkNZZ` | 37 | 25 | 12 (68 MB) | PARTIAL | image_2-12 -> Swiss/Cow fights; image_13-38 -> London 2026 | images (1).zip | **A** images (2).zip is a byte-identical duplicate. Duplicate cow-fight folders exist in Drive (open question in PHOTO_CONTEXT). Rename on upload: image_N collides with every other 2026-05-15 roll. |
| 2026-05-15 Swiss Lucerne Bürgenstock 2026 + cow fights 2026 | `1yXID4QGQyEBUY2DsdsvmfeJg5-oxMfJY` | 36 | 30 | 6 (35 MB) | PARTIAL | image_2-26 -> Swiss/Bürgenstock; image_27-37 -> Swiss/Cow fights | images (3).zip | **A** Same collision caveat. Frame 26 snowy peak from station; bench with "Josephine" plaque is a memorial: owner may prefer to skip. |
| 2026-05-15 London 2026 (id inferred by name and count, not Drive-listed) | `1hOju2nULBOJxZZeI1KmUK8Ra823PIl_T` | 36 | 28 | 8 (43 MB) | PARTIAL | London 2026 (existing) | images (4).zip | **A** Mapping from local zip (36 JPG) to this Drive folder is inferred; not viewed. |
| 2026-05-18 London (inferred) | `1UaVdIrwg86EmcjQSg1UNbmrGvk6_d1Uf` | 37 | 29 | 8 (23 MB) | PARTIAL | London 2026 (existing) | 00005222.zip | **A** Inferred mapping. Names 0001_0A.jpg style collide: rename. |
| 2026-05-18 London Stonehedge (inferred) | `1FvFDfbgzeNSDUphUuRGh6eZvZ932HYlL` | 34 | 26 | 8 (25 MB) | PARTIAL | London 2026 or new album `Stonehenge` (note Drive spelling "Stonehedge" is a typo; official: Stonehenge) | 00005223.zip | **A** Stonehenge is not London: suggest catalog `England 2026` / album Stonehenge or keep under London 2026 with album. Owner decision on catalog. |
| 2026 Dent du Jaman Summer + SQ Party Summer + Dent du Mayen Summer | `18MWnE-5BlvhZs_OXONRtFD3VqGA3OX3x` | 36 | 29 | 7 (29 MB) | PARTIAL | Swiss/Dent du Jaman Summer, Swiss/Les Paccots (existing; roll R1-04886) | myairbridge-76vVAlY49Fq.zip > 20260703_000001 | **A** "SQ Party" frames probably show people: cull. Owner-given names "Dent du Mayen" vs site "Tour du Mayan": check spelling. |
| 2026 Les Grammot + Random Lausanne shots | `17w8T1Bzr-F-bRyv2ws6_pVwndLubIizW` | 36 | 16 | 20 (83 MB) | PARTIAL | Swiss/Le Grammot (existing); Lausanne frames -> Swiss/Random or new Swiss/Lausanne | myairbridge-76vVAlY49Fq.zip > 20260703_000002 | **A** Site album is spelled "Le Grammot"; owner to confirm the official spelling. |
| 2026 Les Paccots + Ukraine | `1MVkqKq8jHUYROeiA0Uctvk9Jh-oNyEqH` | 37 | 32 | 5 (24 MB) | PARTIAL | Swiss/Les Paccots; Ukraine (existing) | myairbridge-76vVAlY49Fq.zip > 20260703_000003 | **A**  |
| 2026 Pointe de Bellevue | `19jbCDX9eJPcNyF0T-rFPqrTE3_uYOVUN` | 37 | 25 | 12 (59 MB) | PARTIAL | Swiss/Pointe de Bellevue; some frames already filed in Dent du Jaman Summer (existing) | myairbridge-76vVAlY49Fq.zip > 20260703_000004 | **A**  |
| 2026 Random Swiss/Lithuania/Šiauliai | `1Nr-fn-e5EfXzWNRNfemZjLHEp23lw9Ul` | 37 | 25 | 12 (64 MB) | PARTIAL | Lithuania (loose, R1-04890 already there) and Swiss/Random | myairbridge-76vVAlY49Fq.zip > 20260703_000005 | **A** Mixed countries; frames need splitting (Šiauliai is Lithuania). |
| 2026 Ukraine + Tour du Mayan Spring(failed) | `1icMxURNyg615e5imLT0knpy3sqT3ycll` | 36 | 27 | 9 (44 MB) | PARTIAL | Ukraine; Swiss/Tour du Mayan Spring(failed) (existing) | myairbridge-76vVAlY49Fq.zip > 20260703_000006 | **A**  |
| 2026 Tour du Mayan + Tour d'Ai | `10ba9PUdvrhZyA8cmmajjwm8qM6gUMSPT` | 36 | 28 | 8 (36 MB) | PARTIAL | Swiss/Tour du Mayan + Tour d'Ai (existing) | myairbridge-76vVAlY49Fq.zip > 20260703_000007 | **A**  |
| 2026-07-26 Wedding + Cabane Brunet 2026 | `19yqyOZPASTl8u5RSL7JDVuFGhiyO_rN_` | 37 | 18 | 19 (58 MB) | PARTIAL | Swiss/Cabane Brunet (new album, hut name official: Cabane Brunet, Val de Bagnes); wedding frames: do not publish | Film photos-20260830T121706Z-1-001.zip > Film photos/2026-07-26 | **C** MIXED: wedding (people, private) + hut hike, not split. 18 of these frames are already on site (possibly the Swiss/Mauvoisin album, same 0039_E.jpg file-name style). Owner must pick the hut frames; Drive file names like 0002_0.jpg. NOT safe to publish blindly. |
| 2026 Eclipse (in Eclipse + Spain Rolls) | `19fed26zjyW6pNQ5MVchs-cDUfkz5AxSi` | 28 | 22 | 6 (40 MB) | PARTIAL | Eclipse (existing catalog) | Smash.zip > MATAS PORTRA400 | **A** Smash.zip scans are already ~4570 px wide, large (up to ~6 MB): resize. Has desktop.ini in Drive (junk). |
| 2026 Spain (in Eclipse + Spain Rolls) | `1cXIQTeUnW-tfxUbDdtssB5ft2cEBsf2R` | 35 | 31 | 4 (7 MB) | PARTIAL | Spain 2026 (existing); place unconfirmed (Mallorca-like) | Smash.zip > MATAS EKTAR100 | **A** Place not confirmed; scans 2433 px, fine as is. |
| 2026 Spain Night Photography | `1KpWIPvGPBKaoBI4TdrXDDiHPPcacuGml` | 37 | 32 | 5 (15 MB) | PARTIAL | Spain 2026/Night Life Madrid (existing) | Film photos-20260830T121706Z-1-002.zip > Film photos/2026-08-23 2/Frontier/Roll4496 | **A**  |
| 2026 Spain (Madrid by day) | `1whbE5HiqyY1j9aWAFcepT1pxoc3_WWgf` | 38 | 25 | 13 (34 MB) | PARTIAL | Spain 2026 (existing) | Film photos-20260830T121706Z-1-002.zip > Film photos/2026-08-23 2/Frontier/Roll4497 | **A**  |
| 2026 Cabane de Valsorey | `1NJwu7cl0CsECS5thU6qMn07cr1uYtEGY` | 38 | 24 | 14 (30 MB) | PARTIAL | Swiss/Cabane de Valsorey (existing) | Film photos-20260830T121706Z-1-002.zip > Film photos/2026-08-23 2/Frontier/Roll4498 | **A**  |
| 2026-09-23 / Tour de l'Argentine + Lavaux Vineyard Terraces (R1-07693) | `1FbkHGJHiH8WAkxuH3Ux_f-DA1RyyF1PP` | 36 | 0 | 36 (185 MB) | NOT ON SITE | Swiss/Tour de l'Argentine + Swiss/Lavaux Vineyard Terraces (new) | myairbridge-QBbEVnDpPCL.zip > Matas juostos ir scanas/20260921_000674 | **B** 0 on site. Blocked by the Tour de l'Argentine naming conflict and unsplit two outings; roll->folder mapping by file name. |
| 30th Birthday 1 | `1ZUTsie27nvPL8ntui02yemXr7DtVCaVG` | 25 | 21 | 4 (17 MB) | PARTIAL | 30th Birthday (existing) | myairbridge-QBbEVnDpPCL.zip > Matas juostos ir scanas/20260921_000675 | **A** Mostly published. |
| 30th Birthday 2 | `1iVSEoFS3KnoMahk6N4DJQeVxWbPmOvdu` | 26 | 23 | 3 (21 MB) | PARTIAL | 30th Birthday (existing) | myairbridge-QBbEVnDpPCL.zip > Matas juostos ir scanas/20260921_000676 | **A** Leftovers are probably deliberate culls of people portraits. |
| 30th Birthday 3 | `1KzjQkpE-W6LcKN9v5pxRua57sOsNh3dS` | 23 | 21 | 2 (12 MB) | PARTIAL | 30th Birthday (existing) | myairbridge-QBbEVnDpPCL.zip > Matas juostos ir scanas/20260921_000677 | **A** Mostly published. |
| Spain + Tour de l'Argentine (R1-07733) | `1ZCvPmrIsAPidleXZR1gCUYZpXVK7r4WA` | 32 | 0 | 32 (135 MB) | NOT ON SITE | Spain 2026 (Spanish north coast frames 0001-0015), Lausanne terrace frames 020A-036A -> Swiss/Random?  | myairbridge-QBbEVnDpPCL.zip > Matas juostos ir scanas/20260922_000001 | **B** BLOCKED: Argentine naming conflict; roll is Spain + Lausanne, boundary around frame 0015/020A. Owner decision. |
| Rochers de Naye + Tour de l'Argentine (R1-07734) | `1vUt6GYFc_1TGbJzNHRyFF_ABsmNwwFX_` | 35 | 0 | 35 (163 MB) | NOT ON SITE | Unknown: Swiss/Rochers de Naye and/or Spain 2026 (Picos?) | myairbridge-QBbEVnDpPCL.zip > Matas juostos ir scanas/20260922_000002 | **B** BLOCKED: Argentine naming conflict; sampled frames look Spanish, not Vaud. Content unidentified. |
| Spain + Picos de Europa (R1-07737) | `1D_hvpz1ZoF7tKzw1MbF1yXGTrHQlSD5O` | 33 | 0 | 33 (173 MB) | NOT ON SITE | Spain 2026/Picos de Europa (new album) | myairbridge-QBbEVnDpPCL.zip > Matas juostos ir scanas/20260922_000880 | **A** 0 on site; name matches AllTrails Canal del Texu (14 Aug 2026). Candidate to publish first. |
| Germany Black Forest ... + Cabane de Valsorey (R1-07736) | `1T3BUnXxvvIbEB3emRJ40T46Jq1-Mm-oA` | 34 | 0 | 34 (150 MB) | NOT ON SITE | Germany/Black Forest Schnapsbrunnenweg (new catalog Germany) for ~frames 1-20; Swiss/Cabane de Valsorey for the rest | myairbridge-QBbEVnDpPCL.zip > Matas juostos ir scanas/20260922_000881 | **B** Boundary unverified (about 020A). 0 on site. Owner to confirm the split. |
| 2025-12-30 - Lithuania Winter 2025 - 1 | `1zdJxowOiSkzmzKahpeCc0KGpFOFtDsoh` | 37 | 3 | 34 (183 MB) | PARTIAL | Lithuania/Winter 2025 (existing album) | Film photos-20260618T190438Z-3-001.zip > Film photos/myairbridge-3yfRbbe9Xtx/20251230_008707 | **C** Indoor/home evening shots: private; only 3 on site. Owner must pick which to show. Drive copy has 37 files (adds 000A/001A/002A etc.). |
| 2025-12-30 - Lithuania Winter 2025 - 2 | `1NSXFL02yi_DjbdKxEt7XIsdj3f--mmc4` | 23 | 0 | 23 (116 MB) | NOT ON SITE | Lithuania/Winter 2025 | Film photos-20260618T190438Z-3-001.zip > Film photos/myairbridge-3yfRbbe9Xtx/20251230_008708 | **C** Indoor, blurred portraits: private. Recommend do not publish blindly. |
| 2026-01-02 - Winter Vilnius 2025/2026 | `1RD_Y_DpHj3pfM1CRMzy-qEbrJLEZVzp0` | 25 | 0 | 25 (135 MB) | NOT ON SITE | Lithuania/Vilnius Winter 2025-2026 (new album; folder name has a slash, avoid it in R2) | Film photos-20260618T190438Z-3-001.zip > Film photos/myairbridge-AdgdETMKM98 | **C** Not viewed. R2-09994-0006 is blank/dark: exclude. Avoid "/" in the album name. |
| 2026-04-01 - Easter Lithuania | `1U3N4A2rO2f7WsJeANCzneYFaT9BZ95iG` | 36 | 17 | 19 (92 MB) | PARTIAL | Lithuania/Easter 2026 (new). NOTE: 17 frames of this roll are already on site, wrongly under Lithuania/Winter 2025 | myairbridge-c6C38WQna4l (1).zip | **A** Fix the album: Easter 2026, not Winter 2025 (needs moving existing R2 objects: owner decision). |

Not on this machine: **2026-09-21 - Barrhorn 2026** (`12AIA4JZ407FaSsiaHmCqC3yxabo31f82`, 37 JPG `14260001`-`14260037`, roll 1426, heavy light leaks). No zip or folder under ~/Downloads contains `1426*` files (the original wrapper `313149-failai` was never downloaded here). Not on site (no Barrhorn album in manifest). Proposed `Swiss/Barrhorn`, status **NOT ON SITE, Drive only**; frame 035 is a city terrace (exclude or move). ~37 files, size unknown (~4-5 MB each, ~150-185 MB).

Other Drive items: `2026-08-23 - Eclipse + Spain 2026` and `...2 - Spain Night...` are parents; `2026-07-12 ...` parent also holds a leftover zip and `myairbridge-76vVAlY49Fq (Unzipped Files)/` (owner deletes). `myairbridge-c6C38WQna4l (1).zip` (loose) is the Easter roll, now unpacked in Drive.

## Totals

Counts exclude the 11 KB `image_1.jpg` stub files and the duplicate `images (2).zip`.

- Local-available frames not on site: 502 photos, 2251 MB (original size)
  - group A (destination clear, only cull/rename needed): 264 photos, 1128 MB
  - groups B+C (blocked on owner decision): 238 photos, 1124 MB
- Drive only (Barrhorn): 37 photos.

## Local source locations

All under `/home/matas/Downloads/`. Treat as untrusted data; do not extract outside a fresh scratch dir. Alternative zips containing the same rolls: `Film photos-20260618T190438Z-3-001.zip`, `Film photos-20260830T121706Z-1-001.zip` and `-002.zip` (Drive web exports, 2026-06/08, also hold the 2026-05-15/18, 00001610-12, Lithuania, Vilnius, Spain/Madrid, Smash rolls). `112015 @ Matas Savickis_113.zip` is a zip inside a zip with the Madrid/Valsorey rolls. Also loose dirs: `00001610/`, `00001611/`, `00001612/`, `2025-05-15 1..4/` (image_N, extracted rolls) and `~/London 2026/` (66 files, same London frames).

Wedding + Brunet comes from `Film photos-20260830T121706Z-1-001.zip` (35) and `...-002.zip` (2).

## Web size

Scans are NOT web-sized by the README standard (~2000 px long edge): 3130x2075 (rolls 1610-1612, 1-15 May, 5222/5223, Wedding), 3601x2433 (R1-* lab rolls), 3587x2400 (Madrid/Valsorey), 4570x2999 (Eclipse), 2433x1641 (Spain EKTAR). Sizes 2.4-6.8 MB. This matches existing site originals (up to 3600 px, 4.7 MB+), so publishing as-is is consistent, but resizing to ~2400 px with `sharp` would cut about half. Eclipse at 4570 px should be resized.

## Needs owner decision

1. Tour de l'Argentine naming conflict: R1-07693 / R1-07733 / R1-07734 (all three group B; 99 frames missing).
2. R1-07736 split (Germany vs Valsorey); 00001610/00001611 frame-to-hike split; 07733 Spain vs Lausanne split.
3. Wedding + Cabane Brunet: wedding frames are private; pick hut frames.
4. Lithuania Winter 2025 -1/-2 (indoor/blurred portraits) and Vilnius (not viewed, one blank frame): publish at all?
5. Easter roll frames already live in album `Lithuania/Winter 2025`: move to `Lithuania/Easter 2026`?
6. Stonehenge: belongs under London 2026 or its own catalog; spelling "Stonehedge" in Drive is a typo.
7. Breda carnival and 30th Birthday leftovers: people photos, owner culls.
8. Duplicate Swiss cow-fight folders in Drive.

## Getting the Drive-only files here

Only Barrhorn is Drive-only. Practical way: in the browser open the folder in Drive, select all, Download (Drive zips it), save into ~/Downloads. rclone with a Drive remote needs interactive OAuth (not attempted); the Drive connector cannot export bulk without returning base64 into context.

## Appendix: missing frames per local roll (not on site)

- **2026-01-25 Winter - La Montagnette + Col du Mollendruz** (12): 0002_2, 0004_4, 0005_5, 0006_6, 0007_7, 0009_9, 0010_10, 0024_24, 0026_26, 0032_32, 0034_34, 0035_35
- **2026-03-01 - Mont Pèlerin + Dent de Jaman + Le Chasseron** (13): 0001_1, 0002_2, 0006_6, 0008_8, 0009_9, 0012_12, 0016_16, 0023_23, 0024_24, 0029_29, 0031_31, 0036_36, 0037_E
- **2026-02-15 - Netherlands Breda Carnaval 2026** (15): 0001_1, 0002_2, 0003_3, 0004_4, 0005_5, 0015_15, 0019_19, 0021_21, 0025_25, 0027_26A, 0030_29A, 0033_32A, 0034_33A, 0035_34A, 0036_35A
- **2026-05-15 London 2026 B&W** (6): image_11, image_2, image_5, image_7, image_8, image_9
- **2026-05-15 Swiss cow fights 2026 + London 2026** (12): image_13, image_15, image_17, image_19, image_22, image_23, image_24, image_25, image_28, image_33, image_35, image_36
- **2026-05-15 Swiss Lucerne Bürgenstock 2026 + cow fights 2026** (6): image_10, image_17, image_3, image_33, image_36, image_4
- **2026-05-15 London 2026** (8): image_16, image_20, image_3, image_30, image_34, image_37, image_5, image_6
- **2026-05-18 London** (8): 0006_5A, 0007_6A, 0014_13A, 0015_14A, 0021_20A, 0022_21A, 0026_25A, 0033_32A
- **2026-05-18 London Stonehedge** (8): 0007_7A, 0008_8A, 0009_9A, 0012_12A, 0020_20A, 0021_21A, 0026_26A, 0028_28A
- **2026 Dent du Jaman Summer + SQ Party Summer + Dent du Mayen Summer** (7): R1-04886-0002, R1-04886-0025, R1-04886-0026, R1-04886-0027, R1-04886-0028, R1-04886-0029, R1-04886-0030
- **2026 Les Grammot + Random Lausanne shots** (20): R1-04887-002A, R1-04887-003A, R1-04887-004A, R1-04887-005A, R1-04887-012A, R1-04887-013A, R1-04887-014A, R1-04887-015A, R1-04887-017A, R1-04887-018A, R1-04887-021A, R1-04887-022A, R1-04887-027A, R1-04887-029A, R1-04887-030A, R1-04887-031A, R1-04887-033A, R1-04887-034A, R1-04887-035A, R1-04887-036A
- **2026 Les Paccots + Ukraine** (5): R1-04888-001A, R1-04888-011A, R1-04888-013A, R1-04888-014A, R1-04888-016A
- **2026 Pointe de Bellevue** (12): R1-04889-0006, R1-04889-0008, R1-04889-0016, R1-04889-0022, R1-04889-0024, R1-04889-0025, R1-04889-0026, R1-04889-0027, R1-04889-0029, R1-04889-0030, R1-04889-0032, R1-04889-0033
- **2026 Random Swiss/Lithuania/Šiauliai** (12): R1-04890-0003, R1-04890-0004, R1-04890-0005, R1-04890-0011, R1-04890-0013, R1-04890-0015, R1-04890-0016, R1-04890-0017, R1-04890-0022, R1-04890-0025, R1-04890-0033, R1-04890-0035
- **2026 Ukraine + Tour du Mayan Spring(failed)** (9): R1-04891-002A, R1-04891-005A, R1-04891-009A, R1-04891-017A, R1-04891-028A, R1-04891-030A, R1-04891-031A, R1-04891-034A, R1-04891-035A
- **2026 Tour du Mayan + Tour d'Ai** (8): R1-04892-003A, R1-04892-005A, R1-04892-013A, R1-04892-014A, R1-04892-026A, R1-04892-027A, R1-04892-029A, R1-04892-031A
- **2026-07-26 Wedding + Cabane Brunet 2026** (19): 0002_0, 0003_1, 0004_2, 0005_3, 0006_4, 0007_5, 0008_6, 0009_7, 0010_8, 0011_9, 0013_11, 0014_12, 0015_13, 0016_14, 0030_28, 0034_32, 0038_36
- **2026 Eclipse** (6): MATAS PORTRA400 6740, MATAS PORTRA400 6740_1, MATAS PORTRA400 6740_2, MATAS PORTRA400 6740_25, MATAS PORTRA400 6740_26, MATAS PORTRA400 6740_27
- **2026 Spain** (4): MATAS EKTAR100 6741_11, MATAS EKTAR100 6741_18, MATAS EKTAR100 6741_19, MATAS EKTAR100 6741_23
- **2026 Spain Night Photography** (5): 10_08_2026_0001, 10_08_2026_0002, 10_08_2026_0004, 10_08_2026_0010, 10_08_2026_0035
- **2026 Spain** (13): 10_08_2026_0038, 10_08_2026_0039, 10_08_2026_0040, 10_08_2026_0042, 10_08_2026_0044, 10_08_2026_0049, 10_08_2026_0053, 10_08_2026_0063, 10_08_2026_0068, 10_08_2026_0069, 10_08_2026_0070, 10_08_2026_0071, 10_08_2026_0075
- **2026 Cabane de Valsorey** (14): 10_08_2026_0076, 10_08_2026_0077, 10_08_2026_0088, 10_08_2026_0089, 10_08_2026_0091, 10_08_2026_0093, 10_08_2026_0096, 10_08_2026_0098, 10_08_2026_0101, 10_08_2026_0102, 10_08_2026_0104, 10_08_2026_0105, 10_08_2026_0106, 10_08_2026_0107
- **2026-09-23 / Tour de l'Argentine + Lavaux Vineyard Terraces** (36): R1-07693-001A, R1-07693-002A, R1-07693-003A, R1-07693-004A, R1-07693-005A, R1-07693-006A, R1-07693-007A, R1-07693-008A, R1-07693-009A, R1-07693-010A, R1-07693-011A, R1-07693-012A, R1-07693-013A, R1-07693-014A, R1-07693-015A, R1-07693-016A, R1-07693-017A, R1-07693-018A, R1-07693-019A, R1-07693-020A, R1-07693-021A, R1-07693-022A, R1-07693-023A, R1-07693-024A, R1-07693-025A, R1-07693-026A, R1-07693-027A, R1-07693-028A, R1-07693-029A, R1-07693-030A, R1-07693-031A, R1-07693-032A, R1-07693-033A, R1-07693-034A, R1-07693-035A, R1-07693-036A
- **30th Birthday 1** (4): R1-07694-002A, R1-07694-004A, R1-07694-011A, R1-07694-024A
- **30th Birthday 2** (3): R1-07695-001A, R1-07695-002A, R1-07695-003A
- **30th Birthday 3** (2): R1-07696-002A, R1-07696-003A
- **Spain + Tour de l'Argentine** (32): R1-07733-0001, R1-07733-0002, R1-07733-0003, R1-07733-0004, R1-07733-0005, R1-07733-0006, R1-07733-0007, R1-07733-0008, R1-07733-0009, R1-07733-0010, R1-07733-0011, R1-07733-0012, R1-07733-0013, R1-07733-0014, R1-07733-0015, R1-07733-020A, R1-07733-021A, R1-07733-022A, R1-07733-023A, R1-07733-024A, R1-07733-025A, R1-07733-026A, R1-07733-027A, R1-07733-028A, R1-07733-029A, R1-07733-030A, R1-07733-031A, R1-07733-032A, R1-07733-033A, R1-07733-034A, R1-07733-035A, R1-07733-036A
- **Rochers de Naye + Tour de l'Argentine** (35): R1-07734-001A, R1-07734-002A, R1-07734-003A, R1-07734-004A, R1-07734-005A, R1-07734-006A, R1-07734-007A, R1-07734-008A, R1-07734-009A, R1-07734-010A, R1-07734-011A, R1-07734-012A, R1-07734-013A, R1-07734-014A, R1-07734-015A, R1-07734-017A, R1-07734-018A, R1-07734-019A, R1-07734-020A, R1-07734-021A, R1-07734-022A, R1-07734-023A, R1-07734-024A, R1-07734-025A, R1-07734-026A, R1-07734-027A, R1-07734-028A, R1-07734-029A, R1-07734-030A, R1-07734-031A, R1-07734-032A, R1-07734-033A, R1-07734-034A, R1-07734-035A, R1-07734-036A
- **Spain + Picos de Europa** (33): R1-07737-001A, R1-07737-002A, R1-07737-003A, R1-07737-004A, R1-07737-005A, R1-07737-006A, R1-07737-007A, R1-07737-008A, R1-07737-009A, R1-07737-011A, R1-07737-012A, R1-07737-013A, R1-07737-014A, R1-07737-015A, R1-07737-016A, R1-07737-017A, R1-07737-018A, R1-07737-019A, R1-07737-020A, R1-07737-023A, R1-07737-024A, R1-07737-025A, R1-07737-026A, R1-07737-027A, R1-07737-028A, R1-07737-029A, R1-07737-030A, R1-07737-031A, R1-07737-032A, R1-07737-033A, R1-07737-034A, R1-07737-035A, R1-07737-036A
- **Germany Black Forest ... + Cabane de Valsorey** (34): R1-07736-001A, R1-07736-002A, R1-07736-003A, R1-07736-004A, R1-07736-005A, R1-07736-006A, R1-07736-007A, R1-07736-010A, R1-07736-011A, R1-07736-012A, R1-07736-013A, R1-07736-014A, R1-07736-015A, R1-07736-016A, R1-07736-017A, R1-07736-018A, R1-07736-019A, R1-07736-020A, R1-07736-021A, R1-07736-022A, R1-07736-023A, R1-07736-024A, R1-07736-025A, R1-07736-026A, R1-07736-027A, R1-07736-028A, R1-07736-029A, R1-07736-030A, R1-07736-031A, R1-07736-032A, R1-07736-033A, R1-07736-034A, R1-07736-035A, R1-07736-036A
- **2025-12-30 - Lithuania Winter 2025 - 1** (34): R1-09922-0004, R1-09922-0005, R1-09922-0007, R1-09922-0008, R1-09922-0009, R1-09922-000A, R1-09922-000A_0001, R1-09922-0010, R1-09922-0011, R1-09922-0012, R1-09922-0013, R1-09922-0014, R1-09922-0015, R1-09922-0016, R1-09922-0018, R1-09922-0019, R1-09922-001A, R1-09922-0020, R1-09922-0021, R1-09922-0022, R1-09922-0024, R1-09922-0025, R1-09922-0026, R1-09922-0027, R1-09922-0028, R1-09922-0029, R1-09922-002A, R1-09922-0030, R1-09922-0031, R1-09922-0032, R1-09922-0033, R1-09922-0034, R1-09922-0035, R1-09922-0036
- **2025-12-30 - Lithuania Winter 2025 - 2** (23): R1-09923-0004, R1-09923-0005, R1-09923-0006, R1-09923-0007, R1-09923-0008, R1-09923-0009, R1-09923-000A, R1-09923-0010, R1-09923-0011, R1-09923-0012, R1-09923-0013, R1-09923-0014, R1-09923-0015, R1-09923-0016, R1-09923-0017, R1-09923-0018, R1-09923-0019, R1-09923-001A, R1-09923-0020, R1-09923-0021, R1-09923-0022, R1-09923-0023, R1-09923-002A
- **2026-01-02 - Winter Vilnius 2025/2026** (25): R1-09993-0015, R1-09993-0016, R1-09993-0017, R1-09993-0018, R1-09993-0019, R1-09993-0020, R1-09993-0021, R1-09993-0022, R1-09993-0023, R1-09993-0024, R1-09993-0025, R1-09993-013A, R2-09994-0000, R2-09994-0000_0001, R2-09994-0001, R2-09994-0002, R2-09994-0003, R2-09994-0004, R2-09994-0005, R2-09994-0006, R2-09994-0007, R2-09994-0008, R2-09994-0009, R2-09994-0010, R2-09994-0011
- **2026-04-01 - Easter Lithuania** (19): R1-02185-0003, R1-02185-0004, R1-02185-0006, R1-02185-0007, R1-02185-0008, R1-02185-0010, R1-02185-0013, R1-02185-0015, R1-02185-0016, R1-02185-0019, R1-02185-0020, R1-02185-0023, R1-02185-0024, R1-02185-0025, R1-02185-0026, R1-02185-0027, R1-02185-0028, R1-02185-0029, R1-02185-0032
