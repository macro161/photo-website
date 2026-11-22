# GPX recordings

`gpx/NN_date_name.gpx` are the AllTrails recordings (NN = activity number in `src/lab/activities.json`).

**The files in this folder are cleaned.** AllTrails records raw GPS fixes: after the phone has slept for minutes, the first fixes can be hundreds of metres
to kilometres off and then converge back (that is what drew spikes and triangles on the route maps, and inflated the distance by up to 5 km on some hikes).
`scripts/clean-gpx.mjs` removes those points and leaves everything else alone. The untouched originals are in `gpx/original/`.

    node scripts/clean-gpx.mjs --dry            report per recording (points removed, km/gain before and after, vehicle stretches)
    node scripts/clean-gpx.mjs                  write cleaned files into gpx/ (always from gpx/original/, so re-running is deterministic)
    node scripts/clean-gpx.mjs 11 24            only these activity numbers
    node scripts/clean-gpx.mjs --smooth         also apply the optional mild smoothing (off by default)

After cleaning, regenerate what is derived from the GPX (none of this re-bakes terrain):

    for f in gpx/[0-9]*.gpx; do n=$(basename $f | cut -c1-2); node scripts/gpx-to-json.mjs $f $((10#$n)); done   # src/lab/tracks/
    node scripts/build-routes.mjs --detail-only                                                                  # src/route/<slug>/detail.json

What is deliberately left alone: long straight stretches across a recording gap (the phone logged nothing for 10-40 minutes, so there is no data to
fix), sparse sampling of switchbacks, and fast steady stretches that are real vehicle or lift rides (the report lists them: activity 12 has a 4.4 km
car or bus stretch, 16 and 23 have short ones). Distances and gains in the route view therefore come out lower than AllTrails' own figures wherever the
raw file contained jumps.
