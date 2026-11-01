#!/usr/bin/env python3
"""Makro kadrovi za čekanje rendera: public/library/details/<komad ili shared>/<kategorija>/<slug>[-<boja>].webp.
Generiše Codex preko pretplate (Ignis tools/codex_parallel_images.py), po 8 odjednom; postojeće slike preskače.

  python3 scripts/build_details.py --only ring,shared      # van sandboxa
  python3 scripts/build_details.py --count
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/library/details'
TOOL = Path.home() / 'Documents/Ignis/tools/codex_parallel_images.py'

STYLE = (' Luxury jewelry macro photograph, extreme close-up that fills the frame, very shallow depth of field, soft directional studio light, deep charcoal background '
         'falling to near black, rich natural metal reflections, sharp focus on the subject, photorealistic. Wide landscape 3:2 image. No text unless asked, no logo, no watermark, no hands, no people, no props.')
FAMILY = {'yellow': 'warm yellow gold', 'white': 'bright white gold', 'rose': 'warm rose gold'}
METALS = {'yellow-gold': 'warm yellow gold', 'white-gold': 'bright white gold', 'rose-gold': 'warm rose gold', 'platinum': 'cool platinum', 'two-tone': 'two-tone yellow and white gold',
          'stainless-steel': 'brushed stainless steel', 'sterling-silver': 'sterling silver', 'black-gold': 'dark glossy black rhodium plated gold'}

# Šta je "metal" kadar za svaki komad.
SURFACE = {'ring': 'the smooth polished curved surface of a {m} ring band, long soft highlights gliding along the curve of the metal, no stones',
           'pendant': 'the polished edge of a round {m} pendant where it meets the bail and a fine chain, no stones',
           'chain': 'a few interlocking polished {m} Cuban chain links, no stones',
           'bracelet': 'polished {m} curb bracelet links meeting at the clasp, no stones',
           'earrings': 'the smooth polished curve of a {m} hoop earring, no stones',
           'watch': 'the polished case edge and first bracelet link of a {m} luxury watch, no brand and no dial text',
           'grillz': 'three neighboring mirror polished {m} teeth of a dental grill side by side, displayed on their own, no mouth, no stones'}
# Šta je "pokrivenost" kadar za svaki komad.
ICE = {'ring': 'a wide {m} ring band', 'chain': 'a Miami Cuban link chain in {m}', 'bracelet': 'a Cuban link bracelet in {m}', 'earrings': 'a {m} hoop earring',
       'watch': 'a {m} luxury watch case, no brand and no dial text', 'grillz': 'a {m} dental grill, displayed on its own, no mouth'}
LEVEL = {'accents': 'plain polished metal with only a few small diamonds set as accents', 'half-iced': 'pavé diamonds cover half of the surface and stop in a clean line, the other half plain polished metal',
         'fully-iced': 'completely covered in pavé diamonds in tiny beads, no plain metal visible'}
STYLES = {'ring/solitaire': 'a six-prong solitaire ring head in {m} holding one round brilliant diamond, seen slightly from above, the claws and shoulders of the band visible',
          'ring/halo': 'a {m} halo ring, a round center diamond framed by a ring of tiny diamonds, seen slightly from above',
          'ring/three-stone': 'a {m} three-stone ring, three round diamonds side by side in prongs, seen slightly from above',
          'ring/eternity': 'a {m} eternity band, a continuous row of round diamonds running around the ring',
          'ring/signet': 'the flat oval polished face of a {m} signet ring, blank, no engraving',
          'pendant/script': 'one flowing cursive curve of a {m} script name pendant with fine diamonds along the stroke, framed so close that no letter or word can be recognized',
          'pendant/block': 'one thick straight stroke and corner of a chunky {m} block letter pendant with diamonds set on its face, framed so close that no letter can be recognized',
          'pendant/medallion': 'a round {m} medallion pendant with a fine diamond edge and a smooth center',
          'pendant/cross': 'a {m} cross pendant set with diamonds, the center where the arms meet',
          'chain/cuban': 'thick interlocking Miami Cuban links in {m}, polished, side view',
          'chain/rope': 'a twisted rope chain in {m}, the spiral of the strands',
          'chain/tennis': 'a tennis chain in {m}, a line of round diamonds each in its own setting',
          'chain/franco': 'a Franco chain in {m}, the tight V pattern of the links',
          'grillz/top6': 'a {m} grill over six upper front teeth, displayed on its own, no mouth, polished tooth shapes',
          'grillz/top8': 'a {m} grill over eight upper front teeth, displayed on its own, no mouth, polished tooth shapes',
          'grillz/set': 'matching upper and lower {m} grills, displayed on their own, no mouth',
          'grillz/fangs': 'a pair of {m} canine fang caps, displayed on their own, no mouth',
          'bracelet/cuban': 'thick Cuban bracelet links in {m} at the box clasp',
          'bracelet/tennis': 'a tennis bracelet in {m}, a line of round diamonds in prong settings',
          'bracelet/bangle': 'the smooth rounded edge of a solid {m} bangle',
          'earrings/studs': 'a diamond stud earring in {m}, the four prongs holding the stone',
          'earrings/drops': 'a {m} drop earring, the join where the drop hangs from the top stone',
          'earrings/hoops': 'a {m} hoop earring, the curve and the hinge of the back',
          'watch/iced': 'a fully iced {m} watch case and bezel covered in pavé diamonds, no brand and no dial text',
          'watch/bezel': 'a {m} watch bezel set with one ring of diamonds, the polished case below it, no brand and no dial text'}
STONES = {'natural-diamonds': 'a round brilliant cut natural diamond seen from above, colorless, bright, crisp facets and table', 'lab-grown-diamonds': 'a round brilliant cut lab-grown diamond seen from above, crisp and icy white',
          'moissanite': 'a round moissanite seen from above with strong rainbow fire in the facets', 'cubic-zirconia': 'a round cubic zirconia seen from above, very bright facets', 'ruby': 'an oval deep red ruby seen from above',
          'sapphire': 'an oval deep blue sapphire seen from above', 'emerald': 'an emerald cut green emerald seen from above, step facets', 'black-diamonds': 'a round black diamond seen from above, opaque and glossy'}
CLARITY = {'si': 'with a small natural inclusion visible near one edge, the rest clean', 'vs': 'with only a very tiny pinpoint inclusion', 'vvs': 'perfectly clean interior, sharp mirrored facet pattern', 'flawless': 'absolutely flawless, pure sharp arrows pattern'}


def spec():
    a = {}
    for key, text in STYLES.items():
        piece, style = key.split('/')
        for fam, m in FAMILY.items():
            a[f'{piece}/style/{style}-{fam}'] = text.format(m=m)
    for piece, text in SURFACE.items():
        for key, m in METALS.items():
            a[f'{piece}/metal/{key}'] = text.format(m=m)
    for piece, text in ICE.items():
        for key, level in LEVEL.items():
            for fam, m in FAMILY.items():
                a[f'{piece}/coverage/{key}-{fam}'] = f'{text.format(m=m)}, {level}'
    for k, s in (('10k', '10K'), ('14k', '14K'), ('18k', '18K')):
        for fam, m in FAMILY.items():
            a[f'shared/karat/{k}-{fam}'] = f'the inside of a polished {m} ring band, with a small crisp hallmark stamped into the metal reading exactly "{s}" and nothing else. Only the text {s}'
    for k, s, m in (('22k', '22K', 'deep yellow gold'), ('24k', '24K', 'deep rich yellow gold'), ('925-silver', '925', 'sterling silver')):
        a[f'shared/karat/{k}'] = f'the inside of a polished {m} ring band, with a small crisp hallmark stamped into the metal reading exactly "{s}" and nothing else. Only the text {s}'
    tag = 'a tiny polished {m} oval tag on a fine clasp, with a crisp hallmark stamped into it reading exactly "{s}" and nothing else. Only the text {s}'
    for k, s in (('10k', '10K'), ('14k', '14K'), ('18k', '18K')):
        for fam, m in FAMILY.items():
            a[f'tag/karat/{k}-{fam}'] = tag.format(m=m, s=s)
    for k, s, m in (('22k', '22K', 'deep yellow gold'), ('24k', '24K', 'deep rich yellow gold'), ('925-silver', '925', 'sterling silver')):
        a[f'tag/karat/{k}'] = tag.format(m=m, s=s)
    for key, text in STONES.items():
        a[f'shared/stones/{key}'] = f'{text}, thin prongs only at the very edge of the frame'
    for key, text in CLARITY.items():
        a[f'shared/clarity/{key}'] = f'looking deep inside one colorless diamond through its table, {text}, as seen through a jeweler loupe, nothing else in frame'
    return a


parser = argparse.ArgumentParser()
parser.add_argument('--only', default='', help='npr. ring,shared')
parser.add_argument('--count', action='store_true')
args = parser.parse_args()
only = [x for x in args.only.split(',') if x]
todo = {k: v for k, v in spec().items() if (not only or k.split('/')[0] in only) and not (OUT / f'{k}.webp').exists()}
print(len(todo), 'za generisanje')
if args.count:
    raise SystemExit
items = list(todo.items())
for i in range(0, len(items), 8):
    group = items[i:i + 8]
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'spec.json'
        path.write_text(json.dumps([{'name': k.replace('/', '__'), 'prompt': v[0].upper() + v[1:] + '.' + STYLE, 'variants': 1} for k, v in group]))
        subprocess.run(['python3', str(TOOL), '--spec', str(path), '--out', tmp], check=False)
        for k, _ in group:
            src = Path(tmp) / f"{k.replace('/', '__')}.jpg"
            if not src.exists():
                print('FALI', k, flush=True)
                continue
            dst = OUT / f'{k}.webp'
            dst.parent.mkdir(parents=True, exist_ok=True)
            Image.open(src).convert('RGB').save(dst, 'WEBP', quality=80, method=6)
            print('OK', k, dst.stat().st_size // 1024, 'KB', flush=True)
