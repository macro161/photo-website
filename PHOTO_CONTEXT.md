# Photo categorization context

Working notes for organizing the film scans in Google Drive and getting them
onto this site. Started 2026-11-20. Keep this file updated as rolls get
identified and sorted.

**Goal, phase 1 (now):** work out what is on each roll in Drive → `Film photos`,
name the folders after the place or event, and split rolls that cover several trips.
**Goal, phase 2 (later):** improve the website by adding AllTrails trail links, map
links and location info to catalogs and albums (see "Future: site enrichment").

## How we work with Drive

- Access goes through the claude.ai Google Drive connector (`mcp__claude_ai_Google_Drive__*`).
- To identify photos, `download_file_content` on a JPG returns the image so it
  can be viewed. `read_file_content` returns nothing useful for photos.
- **The connector cannot move or delete the scans.** `update_file` with
  `parentId` fails with "The caller does not have permission to move this
  file", even after the connector was re-authorized (tried 2026-11-20). It *can*
  rename and create folders, and copy files.
- Workaround in use: create the subfolders, then **copy** each photo into them
  (`copy_file` with `title` set to the original name, so there is no "Copy of" prefix). The
  owner then deletes the loose originals by hand in Drive.
- Frame numbers (`image_N.jpg`) follow shooting order, so a roll that covers
  two trips splits at one frame. Find that frame by bisecting (look at the first, last and middle frames,
  then narrow down).
- **Always follow `nextPageToken` until it's gone.** The first page of `search_files` often returns only ~5 items even with a big `pageSize`. Missing this once caused 5 of 7 rolls in `2026-07-12` to be skipped.
- Full file listings are large. Page through `search_files` with
  `'<folderId>' in ancestors` and process the saved JSON with jq or python.

## Drive layout

`Film photos` folder id: `18KGX8Y9eVhOcKThr1nnJF7lv5lYuhyYL` (in My Drive).
As of 2026-11-20 it held about 915 files (5.2 GB) plus two zips that are still packed.

| Folder | Content | Status |
|---|---|---|
| `00001610` (`1ufGhrlY1Q0063DA8f4wd1p9o3LSkwg_e`), `00001611` (`1bkYIqLM8OIFfyBs7gfOZyqEoau0A--2k`) | 36–37 JPG each (`0001_1.jpg`…), already flat → nothing to move | Sampled 2026-11-20 (not named yet). 1610: frames 12/17 = snowy Valais-looking peaks above larch forest, 33 = snowy Jura meadow. 1611: frame 10 = white chapel above Lake Geneva (Montreux/Vevey side), 28 = summit trig frame in fog, 37 = fog over Rhône plain. Both look like **Swiss winter/early-spring hikes, several outings per roll**. File names (`0017_17.jpg`…) collide with other site albums, so manifest matching is unreliable; suggestions: 1610 → La Montagnette / Col de Mollendruz, 1611 → Mont Pèlerin / Le Chasseron |
| `2026-02-15 to 17 - Netherlands Breda Carnaval 2026` (was `00001612`; id `1dw6go8IBfg9b0UkPXkDYuVfrPv7iN0Hc`) | 36–37 JPG | renamed by owner request 2026-11-20 (not viewed). Spelling fixed to Dutch "Carnaval"; Breda's carnival goes by "'t Kielegat" ("Carnaval in ut Kielegat"). Matches site catalog "Netherlands Breda 2026" |
| `2026-05-15 1` | 10 JPG | not yet identified |
| **`2026-05-15 2 - Swiss cow fights 2026 + London 2026`** (`12okTG1vGFjEFHaDBqP69-o-ZlywLkNZZ`) | 37 JPG | **sorted**, see below |
| **`2026-05-15 3 - Swiss Lucerne Bürgenstock 2026 + cow fights 2026`** (`1yXID4QGQyEBUY2DsdsvmfeJg5-oxMfJY`) | 36 JPG | **sorted**, see below |
| `2026-05-15 4` | 36 JPG | not yet identified |
| `2026-05-18 1`, `2026-05-18 2` | 37 / 34 JPG | not yet identified |
| `2026-07-12 - Swiss Hikes + Ukraine + Random Shots 2026` (renamed 2026-11-20; id `1bTqSbHVkagZqVCbtWGVQaB0eLxDwjK8H`) | unzipped by owner → flattened 2026-11-20: 7 roll folders `20260703_000001`…`000007` (000001 renamed by owner to "04886 Dent du Jaman Summer + SQ Party Summer + Dent du Mayen Summer", id `18MWnE-5BlvhZs_OXONRtFD3VqGA3OX3x`; not split into subfolders yet) (R1-04886…R1-04892, 255 photos total) sit directly in it. Leftover zip + `myairbridge-76vVAlY49Fq (Unzipped Files)/` = **owner deletes** | Folders renamed by owner 2026-11-20 (naming rule: NO roll numbers in folder names, prefer "2026 <places>"): 000002 → "2026 Les Grammot + Random Lausanne shots"; 000003 → "2026 Les Paccots + Ukraine"; 000004 → "2026 Pointe de Bellevue"; 000005 → "2026 Random Swiss/Lithuania/Šiauliai"; 000006 → "2026 Ukraine + Tour du Mayan Spring(failed)"; 000007 → "2026 Tour du Mayan + Tour d'Ai". 000001 keeps its earlier "04886 …" name (owner said no roll numbers *going forward*). Names are the owner's; contents not yet viewed/split |
| `2026-07-26 - Wedding + Cabane Brunet 2026` (`19yqyOZPASTl8u5RSL7JDVuFGhiyO_rN_`) | 37 JPG (`0002_0.jpg`…`0039_E.jpg`) | named by owner 2026-11-20; not split into subfolders yet. Cabane (Marcel) Brunet, 2,103 m, Val de Bagnes above Fionnay (46.030, 7.274). AllTrails candidates: "Cabane Brunet via Barmasse", "Cabane Brunet - Cabane Panossière", "Cabane Brunet - Le Châble" |
| `2026-08-23 - Eclipse + Spain 2026` (`15mGfCug0_gUjjpj7ZUIWV5uJXJk5ko8F`) → `Eclipse + Spain Rolls` (was "Smash") → `2026 Eclipse` (was PORTRA400 6740, 28 JPG; total solar eclipse, 12 Aug 2026; site catalog "Eclipse") and `2026 Spain` (was EKTAR100 6741, 35 JPG; hiking boots on a rock in a stone village, turquoise coast cliffs — looks Mediterranean/Mallorca-like, **place not confirmed**). Renamed by owner request 2026-11-20. Each roll still has a `desktop.ini` junk file for the owner to delete |
| `2026-08-23 2 - Spain Night Photography + Spain + Cabane de Valsorey 2026` (`18T9-3S2f1IMIf02ZV4dF22mYPBp4tHe8`) → `Spain + Cabane de Valsorey Rolls` (was "Frontier") → `2026 Spain Night Photography` (was Roll4496 Cine800, 37 JPG, `10_08_2026_0001–0037`; Madrid at night, e.g. Teatro La Latina — site album "Spain 2026/Night Life Madrid"), `2026 Spain` (was Roll4497 Ek100, 38 JPG, `…0038–0075`; Madrid by day, e.g. Palacio Real) and `2026 Cabane de Valsorey` (was Roll4498 Cine800, 38 JPG, `…0076–0113`; alpine cairn with prayer flags in fog — site album "Swiss/Cabane de Valsorey"). Renamed 2026-11-20. Official hut name is **Cabane de Valsorey** (SAC, ~3,030 m, Valais, south of Bourg-St-Pierre); "Refuge du Valsorey" is not an official name |
| `2026-09-21 - Barrhorn 2026` (`12AIA4JZ407FaSsiaHmCqC3yxabo31f82`) | 37 JPG (`14260001`–`14260037`, roll 1426, scanned 4 Sep 2026, heavy light leaks), **copied up 2026-11-20 so they sit directly in the folder**; the wrapper `313149-failai (Unzipped Files)/` still holds the originals → **owner deletes it**. Name set by owner (Barrhorn hike; glacier/Alps frames; frame 035 is a city terrace) |
| `2026-09-23 - 30th Birthday + Spain + Black Forest + Swiss Hikes 2026` (id 13uhErP6DF50_nQNeK97uZUHymRecnQBR) | 8 lab rolls flattened 2026-11-20 by copying into roll folders R1-07693 (36 JPG), R1-07694 (23), R1-07695 (26), R1-07696 (20), R1-07733 (32), R1-07734 (35), R1-07736 (34), R1-07737 (33) directly under 2026-09-23; the 8 wrapper folders 20260921_000674..000677, 20260922_000001/000002/000880 (+ 8th wrapper id 10b7lsdSEswImg1DxlvNlaR5bT0vgo_SY) with their `Export JPG 16Base` subfolders are leftovers -> owner deletes | roll folders are named by lab roll number only because contents are not identified yet (folder names are placeholders) |
| `myairbridge-3yfRbbe9Xtx/` (`1g1tA2BMuNk4GHFakp229yyE6VLioCFMb`) | wrappers `20251230_008707/Export JPG 16Base` (R1-09922) and `20251230_008708/Export JPG 16Base` (R1-09923), + `2025-12-30` duplicate | **copied out 2026-11-20** → `2025-12-30 - Lithuania Winter 2025 - 1` (`1zdJxowOiSkzmzKahpeCc0KGpFOFtDsoh`, 37 JPG from R1-09922: frames 0004–0036 + 000A, 000A_0001, 001A, 002A; indoor/home evening shots; R1-09922 files already on site under `Lithuania/Winter 2025`) and `... - 2` (`1NSXFL02yi_DjbdKxEt7XIsdj3f--mmc4`, 23 JPG from R1-09923: 0004–0023 + 000A/001A/002A; indoor, blurred portraits). Originals + wrappers + `2025-12-30` duplicate → owner deletes. Names are suggestions |
| `myairbridge-AdgdETMKM98/` (`1PdI1ISEAZoHInP916ps-AXGwLrVf7JsU`) | `20260102_008747/Export JPG 16Base`: R2-09994 (13 JPG, frame 0006 is blank/dark) + R1-09993 (12 JPG: 0015–0025, 013A) | **copied out 2026-11-20** → `2026-01-02 - Winter Vilnius 2025/2026` (`1RD_Y_DpHj3pfM1CRMzy-qEbrJLEZVzp0`, 25 JPG; renamed by owner, contents not viewed by me); originals + wrappers → owner deletes |
| `myairbridge-c6C38WQna4l (1).zip` | loose 173 MB zip in the root folder | not unzipped |

Folder dates are **upload** dates, not shooting dates.

## Sorted rolls

### `2026-05-15 2` → Swiss cow fights + London (done 2026-11-20)
- `Swiss cow fights 2026/` (`1VEvAvq26obytajl9v62FW64W-fo4vFEz`): image_2–12 (11).
  Hérens cow fight arena (Valais), Euseigne earth pyramids, Valais valley and
  vineyards, mountain waterfall.
- `London 2026/` (`123muLoBVHis4PREfDMU_BY8sBQZ_9vXN`): image_13–38 (26).
  Regent's Canal, Camden Market, Cyberdog, railway bridge, Tower of London
  (Traitors' Gate, Jewel House, Royal Armouries, ravens), Tower Bridge (including the glass
  floor), City skyline with the Gherkin, view along the Thames.
- 37 originals are still loose in the parent folder; the **owner needs to delete them**.

### `2026-05-15 3` → Lucerne/Bürgenstock + cow fights (done 2026-11-20)
- `Swiss Lucerne Bürgenstock 2026/` (`108KzaZUuVuYwrsroF62a5v47tz-dma43`):
  image_2–26 (25). Train through a Jura valley, Bürgenstock cliff walk and
  Hammetschwand lift, views over Lake Lucerne and the city, a forest bench with a
  "Josephine" plaque, a snowy peak seen from a railway station (frame 26).
- `Swiss cow fights 2026/` (`1pCy43qvIwOU8g-VpQyjoihvGWLLy-urv`): image_27–37 (11).
  The same Hérens arena (EPINEY / Race d'Hérens banners).
- 36 originals are still loose in the parent folder; the **owner needs to delete them**.

**Open question:** there are now two "Swiss cow fights 2026" folders in Drive (one in
each 2026-05-15 roll). Consider merging them; the site already has a single
`Swiss/Cow fights` album (16 photos).

## How Drive maps to the website

The site's catalogs and albums come from top-level folders and subfolders in the R2 bucket `photos-web`
(see README). As of 2026-11-20 the manifest has 620 photos:

- Catalogs: 30th Birthday, Eclipse, Lithuania (+ Winter 2025), London 2026,
  Netherlands Breda 2026, Spain 2026 (+ Night Life Madrid), Swiss, Ukraine.
- `Swiss/` albums: Bisse de Lentine, Bürgenstock, Cabane de Valsorey, Col de
  Mollendruz, Cow fights, Dent du Jaman Summer, Dent du Jaman Winter(failed),
  Hasenmatt, La Montagnette, Le Chasseron, Le Grammot, Les Paccots, Mauvoisin,
  Mont Pèlerin, Pointe de Bellevue, Random, Tour du Mayan + Tour d'Ai, Tour du
  Mayan Spring(failed).

So many Drive rolls are already published under these names. When identifying a
Drive roll, check the manifest (`src/generated/manifest.json`, which has the `file` names)
for the same file names; this is the quickest way to put a name to a roll.

## Future: site enrichment (phase 2, not started)

Ideas the owner mentioned:
- An AllTrails link for each hike album. The AllTrails connector
  (`mcp__claude_ai_AllTrails__*`: search by name or location, trail details) is
  available. Most `Swiss/*` albums are hikes or summits and are good candidates.
- A map link or embedded map for each album/catalog (summit or trailhead coordinates).
- This probably needs per-album metadata in `site.config.json` (only `covers` and
  `captions` exist so far) and UI in `src/components`.

## AllTrails catalog

The owner's AllTrails activities (43, Jun 2025 → Nov 2026) are catalogued in [ALLTRAILS_ACTIVITIES.md](ALLTRAILS_ACTIVITIES.md) for cross-referencing with Drive rolls and site albums. Read via Chrome from https://www.alltrails.com/members/savickis-matas/recordings (lazy-loaded, virtualized list: scroll in steps and read page text at each step).

## 2026-09-23 renames (2026-11-20)

Owner: rolls R1-07694, R1-07695, R1-07696 are the **30th Birthday** (site catalog "30th Birthday"). Renamed in `2026-09-23`: `R1-07694` → `30th Birthday 1` (`1ZUTsie27nvPL8ntui02yemXr7DtVCaVG`, 23 JPG), `R1-07695` → `30th Birthday 2` (`1iVSEoFS3KnoMahk6N4DJQeVxWbPmOvdu`, 26 JPG), `R1-07696` → `30th Birthday 3` (`1KzjQkpE-W6LcKN9v5pxRua57sOsNh3dS`, 20 JPG). Photo file names still carry the lab roll IDs. Remaining unnamed: R1-07693, 07733, 07734, 07736, 07737.

Owner 2026-11-20: roll R1-07737 → renamed `Spain + Picos de Europa` (`1D_hvpz1ZoF7tKzw1MbF1yXGTrHQlSD5O`, 33 JPG) in `2026-09-23`. Matches AllTrails 14 Aug 2026 Canal del Texu Trail (Picos de Europa). Still unnamed: R1-07693, 07733, 07734, 07736.

Owner 2026-11-20: roll R1-07736 → renamed `Germany Black Forest Sasbachwalden Schnapsbrunnenweg + Cabane de Valsorey` (`1T3BUnXxvvIbEB3emRJ40T46Jq1-Mm-oA`, 34 JPG) in `2026-09-23`. Sampled frames: 001A = sun disc (start), 012A = Rhine-plain vineyards (Schnapsbrunnenweg 1, Sasbachwalden, Ortenau; AllTrails 25 Jul 2026), 026A = mountain waterfall with pink alpine flowers, 036A = glacier valley (Valsorey area; AllTrails 1–2 Aug 2026). Official hut name is Cabane de Valsorey, not "Refuge du Valsurey". Roll is two outings, not split yet (Germany ≈ frames 1–~20, Valsorey ≈ ~20–36, boundary unverified). Still unnamed: R1-07693, 07733, 07734.

Owner 2026-11-20: roll R1-07734 → renamed `Rochers de Naye + Tour de l'Argentine` (`1vUt6GYFc_1TGbJzNHRyFF_ABsmNwwFX_`, 35 JPG) in `2026-09-23`. Spelling checked against AllTrails titles: "Rochers de Naye" (22 Aug 2026, via Dent de Jaman) and "Tour de l'Argentine" (6 Sep 2026); owner wrote "Tour du Argentine". Frames not viewed; two outings, not split. Still unnamed: R1-07693, 07733.

Owner 2026-11-20: roll R1-07733 → renamed `Spain + Tour de l'Argentine` (`1ZCvPmrIsAPidleXZR1gCUYZpXVK7r4WA`, 32 JPG: 0001–0015 + 020A–036A) in `2026-09-23`. Sampled: 0008 = rocky islet in a grey sea (Spanish north coast), 033A = Lausanne rooftop terrace with Palais de Rumine (so the roll also ends in Lausanne). CONFLICT to resolve: owner also named R1-07734 `Rochers de Naye + Tour de l'Argentine`; sampled R1-07734 frames 003A = summit with prayer flags, 021A/036A = limestone alpine pasture with cows and a hut (look Spanish/Pyrenean-Picos-like, not Vaud). Tour de l'Argentine is probably only in one of the two rolls; unverified. Still unnamed: R1-07693.

Owner 2026-11-20: roll R1-07693 → renamed `Tour de l'Argentine + Lavaux Vineyard Terraces` (`1FbkHGJHiH8WAkxuH3Ux_f-DA1RyyF1PP`, 36 JPG) in `2026-09-23`. Lavaux = UNESCO World Heritage "Lavaux, Vineyard Terraces" (AllTrails: "Lavaux Vineyard Terraces: St-Saphorin - Lutry", 12 Sep 2026; Argentine 6 Sep 2026). All eight rolls in 2026-09-23 now have names, BUT Tour de l'Argentine is also in the names of R1-07733 and R1-07734 (owner-given); owner says the Argentine is in R1-07693, so those two names need revisiting.

2026-11-20: top folder `2026-09-23` renamed to `2026-09-23 - 30th Birthday + Spain + Black Forest + Swiss Hikes 2026` (name proposed by Claude, owner asked for a suggestion). Contents: 30th Birthday 1–3, Spain + Picos de Europa, Germany Black Forest Sasbachwalden Schnapsbrunnenweg + Cabane de Valsorey, Spain + Tour de l'Argentine, Rochers de Naye + Tour de l'Argentine, Tour de l'Argentine + Lavaux Vineyard Terraces.

Suggestion 2026-11-20 (NOT applied, owner asked for a suggestion): `00001610` (`1ufGhrlY1Q0063DA8f4wd1p9o3LSkwg_e`) looks like two 2026 winter hikes: La Montagnette (AllTrails 18 Jan 2026 "Montagnetta trail: Pierre d'Avoin - La Montagnetta - L'Irette", 4.9 km) and Col du Mollendruz (probably AllTrails 25 Jan 2026 untitled 9.2 km Jura loop). Evidence: frames 0012/0017/0018 share names with site album `Swiss/La Montagnette`, 0027/0031/0033 with `Swiss/Col de Mollendruz`; frame 9 = Rhône valley with snowy range, 22/30/33 = snowy Jura spruce forest, hiker car park and stone wall; 3 and 36 = train window shots (journey). Proposed folder name: `2026 Winter - La Montagnette + Col du Mollendruz`.

Owner confirmed 2026-11-20: `00001610` renamed to `2026 Winter - La Montagnette + Col du Mollendruz` (same id `1ufGhrlY1Q0063DA8f4wd1p9o3LSkwg_e`). Not split into subfolders. Remaining unnamed in Film photos root: `00001611`, 2026-05-15 1 and 4, 2026-05-18 1/2, 2026-09-23 lab-roll leftovers (resolved), myairbridge-c6C38WQna4l zip.

- Owner confirmed 2026-11-20: `00001611` renamed to `2026-03-01 - Mont Pèlerin + Dent de Jaman + Le Chasseron` (id `1bkYIqLM8OIFfyBs7gfOZyqEoau0A--2k`). Three March 2026 hikes (1, 8, 15 Mar); the 1 Mar and 8 Mar activities were logged as snowshoeing in AllTrails by mistake, they were hikes. Single date prefix 2026-03-01 for naming consistency. The 21 Mar untitled hike is not in this roll. Not split into subfolders; frame-to-hike boundaries not located.

- 2026-11-20: `20260403_009766` (id `1qtjR42lf6KLzh9SZix412cY-umEwyDvX`, wrapper chain `20260403_009766` > `Export JPG 16Base`) flattened by copying 36 frames (`R1-02185-0001`..`0036.JPG`) into new top-level folder `2026-04-01 - Easter Lithuania` (id `1U3N4A2rO2f7WsJeANCzneYFaT9BZ95iG`). Name given by owner ("2026-04-01 Easter Lithuania"); I added the " - " separator to match the other folders. Owner can delete the old `20260403_009766` wrapper.

---
## SNAPSHOT 2026-11-20 (end of session) - read this first when resuming

Drive `Film photos` (id `18KGX8Y9eVhOcKThr1nnJF7lv5lYuhyYL`) was re-listed at the end of this session. It holds 19 folders (listing by `mimeType = folder`, pageSize 100, two pages, the last had no further token). The old wrapper folders (`myairbridge-*`, `20260403_009766`, `00001xxx` numbers) no longer appear in the root, so the owner has presumably deleted them. All names are the current Drive names.

| Folder (current Drive name) | id |
|---|---|
| 2025-12-30 - Lithuania Winter 2025 - 1 | `1zdJxowOiSkzmzKahpeCc0KGpFOFtDsoh` |
| 2025-12-30 - Lithuania Winter 2025 - 2 | `1NSXFL02yi_DjbdKxEt7XIsdj3f--mmc4` |
| 2026-01-02 - Winter Vilnius 2025/2026 | `1RD_Y_DpHj3pfM1CRMzy-qEbrJLEZVzp0` |
| 2026-01-25 Winter - La Montagnette + Col du Mollendruz (owner added the date prefix after my rename; was 00001610) | `1ufGhrlY1Q0063DA8f4wd1p9o3LSkwg_e` |
| 2026-02-15 - Netherlands Breda Carnaval 2026 | `1dw6go8IBfg9b0UkPXkDYuVfrPv7iN0Hc` |
| 2026-03-01 - Mont Pèlerin + Dent de Jaman + Le Chasseron (was 00001611; hikes 1, 8, 15 Mar) | `1bkYIqLM8OIFfyBs7gfOZyqEoau0A--2k` |
| 2026-04-01 - Easter Lithuania (new, 36 frames copied from 20260403_009766) | `1U3N4A2rO2f7WsJeANCzneYFaT9BZ95iG` |
| 2026-05-15 London 2026 B&W | `10FjXsV0Uf7EiWYXyfIbIQjjsdHtBRaAq` |
| 2026-05-15 Swiss cow fights 2026 + London 2026 | `12okTG1vGFjEFHaDBqP69-o-ZlywLkNZZ` |
| 2026-05-15 Swiss Lucerne Bürgenstock 2026 + cow fights 2026 | `1yXID4QGQyEBUY2DsdsvmfeJg5-oxMfJY` |
| 2026-05-15 London 2026 | `1hOju2nULBOJxZZeI1KmUK8Ra823PIl_T` |
| 2026-05-18 London | `1UaVdIrwg86EmcjQSg1UNbmrGvk6_d1Uf` |
| 2026-05-18 London Stonehedge | `1FvFDfbgzeNSDUphUuRGh6eZvZ932HYlL` |
| 2026-07-12 - Swiss Hikes + Ukraine + Random Shots 2026 | `1bTqSbHVkagZqVCbtWGVQaB0eLxDwjK8H` |
| 2026-07-26 Wedding + Cabane Brunet 2026 | `19yqyOZPASTl8u5RSL7JDVuFGhiyO_rN_` |
| 2026-08-23 - Eclipse + Spain 2026 | `15mGfCug0_gUjjpj7ZUIWV5uJXJk5ko8F` |
| 2026-08-23 2 - Spain Night Photography + Spain + Cabane de Valsorey 2026 | `18T9-3S2f1IMIf02ZV4dF22mYPBp4tHe8` |
| 2026-09-21 - Barrhorn 2026 | `12AIA4JZ407FaSsiaHmCqC3yxabo31f82` |
| 2026-09-23 - 30th Birthday + Spain + Black Forest + Swiss Hikes 2026 (8 roll subfolders, see earlier section) | `13uhErP6DF50_nQNeK97uZUHymRecnQBR` |

(Folders named `2026-05-15 ...` and `2026-05-18 ...` were named earlier in the session and are NOT yet checked against AllTrails.)

### Open items for the next session
1. **"Tour de l'Argentine" naming conflict:** roll folders `Spain + Tour de l'Argentine` (R1-07733, `1ZCvPmrIsAPidleXZR1gCUYZpXVK7r4WA`) and `Rochers de Naye + Tour de l'Argentine` (R1-07734, `1vUt6GYFc_1TGbJzNHRyFF_ABsmNwwFX_`) both carry that name, while the owner says the Argentine hike is in R1-07693 (`Tour de l'Argentine + Lavaux Vineyard Terraces`, `1FbkHGJHiH8WAkxuH3Ux_f-DA1RyyF1PP`). Ask the owner for new names (07733 probably `Spain`; 07734 `Rochers de Naye` + other content). Frames of 07734 look more Spanish/Pyrenean than Vaud (unverified).
2. Germany/Valsorey roll (R1-07736) has two outings, boundary not located. 00001610-folder and 2026-03-01 folder are not split into per-hike subfolders. Splitting is optional.
3. AllTrails cross-check: `ALLTRAILS_ACTIVITIES.md` lists 43 activities. 21 Mar 2026 untitled hike, 1 Feb 2026 Molard Trail, and others have no film match yet. Rolls dated 2026-05-15/18 (London, cow fights, Bürgenstock) should be matched to the 18 Apr / 26 Apr rows.
4. Duplicate-ish cow-fight folders: `2026-05-15 Swiss cow fights 2026 + London 2026` and `2026-05-15 Swiss Lucerne Bürgenstock 2026 + cow fights 2026`. Consider merging or clarifying names.
5. `2026-07-26 Wedding + Cabane Brunet 2026` mixes two events; split if wanted.
6. The 2026-04-01 folder used " - " separator; some older folders (`2026-07-26 Wedding...`, `2026-05-15 ...`) lack it. Decide whether to normalise.
7. Phase 2 (website): add AllTrails trail URLs, coordinates and map links per hike album in `site.config.json` (and upload sorted folders to R2 bucket `photos-web` via the existing index flow). Not started.

### Reminders on tooling
- Drive connector: `update_file` renames only, cannot move or delete user files; flatten with `copy_file(fileId, title=<original>, parentId)`. `search_files` returns ~5 per page and paging is unreliable; use exact-title OR queries (<=7 names) or `pageSize` 100 with a mimeType filter. Empty `{}` means none.
- AllTrails activity list is virtualized; scroll in steps and read at each step.
- Naming: no roll numbers; `YYYY-MM-DD - <places>`; verify official place names.
