#!/usr/bin/env python3
"""Spec for choice photos that depend on the piece: public/library/options/<category>/<piece>/<slug>.webp.
Generated with Codex (Ignis tools/codex_parallel_images.py). A piece without its own photo uses the general one in <category>/."""
import json
import sys
from pathlib import Path

STYLE = (' Professional studio jewelry product photograph, one subject centered with generous space around it, plain matte deep charcoal gray '
         'background, soft studio light, subtle shadow, sharp focus, photorealistic, square image. No text, no logo, no watermark, no hands, no people, no props.')
METALS = {'yellow-gold': '14K yellow gold', 'white-gold': 'bright rhodium plated white gold', 'rose-gold': 'warm rose gold', 'platinum': 'platinum, cool and slightly gray',
          'two-tone': 'two-tone yellow gold and white gold', 'stainless-steel': 'brushed stainless steel', 'sterling-silver': 'sterling silver', 'black-gold': 'black rhodium plated gold, dark and glossy'}
SHOW = {'ring': lambda m: f'A plain polished band ring in {m}, without stones, three-quarter view.',
        'pendant': lambda m: f'A plain round polished medallion pendant in {m} on a matching thin chain, front view.',
        'bracelet': lambda m: f'A polished curb link bracelet in {m}, clasped and lying in an oval.',
        'earrings': lambda m: f'A pair of plain polished hoop earrings in {m}, front view.',
        'watch': lambda m: f'A luxury wristwatch with case and link bracelet in {m}, blank dial without numbers or brand name, flat lay.',
        'grillz': lambda m: f'A dental grill covering six upper front teeth in polished {m}, no stones, displayed on its own, front view, no mouth.'}
ICE = {'ring': 'A wide gold band ring', 'chain': 'A short curved section of a Miami Cuban link chain in gold', 'bracelet': 'A gold Cuban link bracelet', 'earrings': 'A pair of gold hoop earrings',
       'watch': 'A gold luxury wristwatch with blank dial and no brand name', 'grillz': 'A gold dental grill covering six upper front teeth, displayed on its own, no mouth'}
LEVEL = {'accents': 'plain polished metal with only a few small diamonds as accents', 'half-iced': 'with diamonds set on only about half of the surface, the rest plain polished metal', 'fully-iced': 'completely covered in pavé diamonds, no plain metal visible'}
STONE = {'moissanite': 'a round moissanite with strong rainbow fire', 'lab-grown-diamonds': 'a round lab-grown diamond, crisp and icy white', 'natural-diamonds': 'a round natural diamond, colorless and bright',
         'cubic-zirconia': 'a round cubic zirconia, very bright', 'ruby': 'an oval deep red ruby', 'sapphire': 'an oval blue sapphire', 'emerald': 'an emerald-cut green emerald', 'black-diamonds': 'a round black diamond, opaque and glossy'}
TIER = {1: 'a slim plain band with one tiny diamond', 2: 'a simple solitaire with a small diamond', 3: 'a solitaire with a medium diamond', 4: 'a halo ring with a large center diamond',
        5: 'a three-stone ring with large diamonds', 6: 'a very large statement ring, huge center diamond surrounded by a diamond halo and a pavé band'}

A = {}
for piece, show in SHOW.items():
    for key, metal in METALS.items():
        A[f'metal/{piece}/{key}'] = show(metal)
A['metal/grillz/dental-gold'] = SHOW['grillz']('warm deep dental gold')
for piece, base in ICE.items():
    for key, level in LEVEL.items():
        A[f'coverage/{piece}/{key}'] = f'{base}, {level}.'
for key, stone in STONE.items():
    A[f'stones/ring/{key}'] = f'A white gold solitaire ring with {stone} as the center stone, three-quarter view.'
A['stones/ring/no-stones'] = 'A plain polished yellow gold band ring with no stones at all, three-quarter view.'
for n, what in TIER.items():
    A[f'budget/ring/tier-{n}'] = f'A white gold ring: {what}, three-quarter view.'
for label, slug in (('4', '4'), ('5', '5'), ('6', '6'), ('7', '7'), ('8', '8'), ('9', '9'), ('10', '10'), ('11', '11'), ('12+', '12')):
    A[f'ring-size/ring/{slug}'] = f'A single steel ring sizer gauge band lying flat, with the number "{label}" clearly stamped on its top surface, and no other text.'

only = sys.argv[1] if len(sys.argv) > 1 else ''
out = [{'name': k.replace('/', '__'), 'prompt': v + STYLE, 'variants': 1} for k, v in A.items() if ('/ring/' in k) == (only == 'ring') or not only]
Path(__file__).with_name(f'option_art_pieces_{only or "all"}.json').write_text(json.dumps(out, indent=1))
print(len(out))
