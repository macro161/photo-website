#!/usr/bin/env python3
"""
Re-creates public/fonts/*.woff2 from the full Fontsource variable fonts (latin subset): keeps the same characters, drops hinting and
layout features the site does not use, and narrows the weight axis to the weights the CSS uses (Inter 400-600, Fraunces 300-500).
    pip install fonttools brotli
    python3 scripts/subset-fonts.py <inter-latin-wght-normal.woff2> <fraunces-latin-wght-normal.woff2>
The originals come from the @fontsource-variable/inter and @fontsource-variable/fraunces packages.
"""
import io, sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

UNICODES = (list(range(0x0000, 0x0100)) + [0x0131, 0x0152, 0x0153, 0x02BB, 0x02BC, 0x02C6, 0x02DA, 0x02DC]
            + list(range(0x2000, 0x2070)) + [0x2074, 0x20AC, 0x2122, 0x2191, 0x2193, 0x2212, 0x2215, 0xFEFF, 0xFFFD])
JOBS = {'inter': ((400, 600), ['kern', 'tnum', 'pnum', 'ccmp', 'locl', 'calt']), 'fraunces': ((300, 500), ['kern', 'liga', 'rvrn'])}

def build(src, name, out_dir):
    rng, feats = JOBS[name]
    f = TTFont(src); f.flavor = None
    buf = io.BytesIO(); f.save(buf); buf.seek(0); f = TTFont(buf)
    o = subset.Options(); o.layout_features = feats; o.hinting = False; o.desubroutinize = True
    o.name_IDs = []; o.notdef_outline = False; o.glyph_names = False
    s = subset.Subsetter(o); s.populate(unicodes=UNICODES); s.subset(f)
    buf = io.BytesIO(); f.save(buf); buf.seek(0); f = TTFont(buf)
    f = instancer.instantiateVariableFont(f, {'wght': rng})
    f.flavor = 'woff2'
    out = os.path.join(out_dir, f'{name}-latin-wght-normal.woff2')
    f.save(out)
    print(name, rng, os.path.getsize(src), '->', os.path.getsize(out))

if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts')
    build(sys.argv[1], 'inter', out_dir)
    build(sys.argv[2], 'fraunces', out_dir)
