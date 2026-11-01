#!/usr/bin/env python3
"""Spec for the AI photos of form choices (public/library/options/<category>/<slug>.webp).
Writes scripts/option_art_spec.json for Ignis tools/gemini_image.py (--spec). The slug is slugOf(option label),
see src/option-art.js. Sizes and lengths are exact diagrams instead: scripts/build_option_diagrams.py."""
import json
from pathlib import Path

STYLE = (' Professional studio jewelry product photograph, one subject centered with generous space around it, plain matte deep charcoal gray '
         'background, soft studio light, subtle shadow, sharp focus, photorealistic. No text, no logo, no watermark, no hands, no people, no props.')
def link(metal): return f'A short curved section of a heavy Miami Cuban link chain in polished {metal}, seen at a three-quarter angle, showing the true color of the metal.'
def stamp(mark, metal): return f'Extreme macro of the inner surface of a polished {metal} ring band, with a small crisp hallmark stamp that reads exactly "{mark}" and nothing else. Only that stamp may contain text.'
def gem(what): return f'A single loose {what}, resting on its pavilion at a slight angle, sharply lit so the facets and fire are clear.'
def bars(n, s): return f'{s} polished gold bullion ingots stacked neatly in a small pile, exactly {n} {"bar" if n == 1 else "bars"}, plain with no engraving.'
def ice(s): return f'A bold cross pendant in yellow gold, {s}, front view on a thin chain.'
def clarity(s): return f'Extreme jeweler loupe macro of a single round brilliant diamond seen from the top, {s}.'
def shape(s): return f'A single loose {s} cut diamond seen from the top at a slight angle, showing its exact outline.'
def carat(ct, s): return f'A white gold solitaire ring with a {s} round diamond of about {ct} carat, three-quarter view. Show the stone in true proportion to the band.'

A = {
  'metal/yellow-gold': link('14K yellow gold'), 'metal/white-gold': link('white gold, bright and rhodium plated'), 'metal/rose-gold': link('warm rose gold'),
  'metal/platinum': link('platinum, cool and slightly gray'), 'metal/two-tone': link('alternating yellow gold and white gold links, two-tone'),
  'metal/stainless-steel': link('brushed stainless steel'), 'metal/dental-gold': 'A single polished dental gold tooth crown and a small dental alloy ingot side by side, warm deep gold color.',
  'metal/sterling-silver': link('sterling silver'), 'metal/black-gold': link('black rhodium plated gold, dark and glossy'),
  'karat/10k': stamp('10K', 'pale yellow gold'), 'karat/14k': stamp('14K', 'yellow gold'), 'karat/18k': stamp('18K', 'rich yellow gold'),
  'karat/22k': stamp('22K', 'deep yellow gold'), 'karat/24k': stamp('24K', 'very deep pure gold'), 'karat/925-silver': stamp('925', 'sterling silver'),
  'stones/no-stones': 'A plain polished yellow gold signet ring with no stones at all, three-quarter view.',
  'stones/moissanite': gem('round moissanite with strong rainbow fire'), 'stones/lab-grown-diamonds': gem('round lab-grown diamond, crisp and icy white, sitting on a thin glass laboratory dish'),
  'stones/natural-diamonds': 'A single loose round natural diamond, colorless and bright white, resting at a slight angle beside a small piece of pale rough diamond crystal.',
  'stones/cubic-zirconia': gem('round cubic zirconia, very bright and clean'), 'stones/ruby': gem('oval ruby in deep red'), 'stones/sapphire': gem('oval blue sapphire'),
  'stones/emerald': gem('emerald-cut green emerald'), 'stones/black-diamonds': gem('round black diamond, opaque and glossy'),
  'coverage/accents': ice('plain polished metal with only a few small diamonds as accents at the center'),
  'coverage/half-iced': ice('with diamonds set along only one half of the surface, the other half plain polished metal'),
  'coverage/fully-iced': ice('completely covered in pavé diamonds, no plain metal visible'),
  'clarity/si': 'Extreme jeweler loupe macro of a single round brilliant diamond seen from the top, with several small dark crystal inclusions and a tiny white feather clearly visible inside the stone through the table.', 'clarity/vs': clarity('one very tiny inclusion barely visible'),
  'clarity/vvs': clarity('extremely clean, almost no visible inclusion'), 'clarity/flawless': clarity('perfectly clean and flawless, maximum brilliance'),
  'budget/tier-1': bars(1, 'One small'), 'budget/tier-2': bars(2, 'Two small'), 'budget/tier-3': bars(3, 'Three'), 'budget/tier-4': bars(5, 'Five'), 'budget/tier-5': bars(8, 'Eight'),
  'budget/tier-6': 'A large, rich pile of many polished gold bullion ingots, plain with no engraving.',
  'cut/solid': 'A dental grill covering six upper front teeth in plain solid polished yellow gold, displayed on its own, front view, no mouth.',
  'cut/open-face': 'A dental grill covering six upper front teeth in yellow gold where only the outline of each tooth is metal and the center of each tooth is open, displayed on its own, front view, no mouth.',
  'cut/diamond-cut': 'A dental grill covering six upper front teeth in yellow gold with a faceted, sparkling diamond-cut engraved metal surface, no stones, displayed on its own, front view, no mouth.',
  'mold/yes': 'A white dental plaster teeth mold of an upper arch, front three-quarter view.',
  'mold/no': 'An unopened small dental impression kit: a plain white tray and a small soft putty block, no packaging text.',
  'center-shape/round': shape('round brilliant'), 'center-shape/oval': shape('oval'), 'center-shape/princess': shape('princess'), 'center-shape/emerald': shape('emerald'),
  'center-shape/pear': shape('pear'), 'center-shape/cushion': shape('cushion'), 'center-shape/marquise': shape('marquise'), 'center-shape/radiant': shape('radiant'),
  'carat/0-5-ct': carat('0.5', 'small'), 'carat/1-ct': carat('1', 'medium'), 'carat/1-5-ct': carat('1.5', 'generous'), 'carat/2-ct': carat('2', 'large'), 'carat/3-ct': carat('3', 'very large'),
  'band/plain': 'A plain polished yellow gold wedding band without stones, three-quarter view.', 'band/pave': 'A white gold ring band with a row of small pavé diamonds along the top, three-quarter view.',
  'band/split-shank': 'An empty white gold ring whose band splits into two strands near the top, three-quarter view.',
  'band/metal-bracelet': 'A luxury wristwatch with a polished metal link bracelet, flat lay, no brand name, blank dial without numbers.',
  'band/leather-strap': 'A luxury wristwatch with a brown leather strap, flat lay, no brand name, blank dial without numbers.',
  'band/rubber-strap': 'A luxury wristwatch with a black rubber strap, flat lay, no brand name, blank dial without numbers.',
  'chain/yes': 'A gold round medallion pendant hanging on a matching gold chain, front view.', 'chain/no': 'A gold round medallion pendant on its own with only its bail, no chain, front view.',
  'size/small': 'A pair of small delicate gold stud earrings, front view.', 'size/medium': 'A pair of medium gold drop earrings, front view.', 'size/statement': 'A pair of large bold gold statement earrings, front view.',
  'backs/push-back': 'One gold stud earring seen from the side showing its simple push back butterfly clutch.', 'backs/screw-back': 'One gold stud earring seen from the side showing its threaded screw back.',
  'backs/hinged-huggie': 'One small gold huggie hoop earring, slightly open at its hinge.',
}
out = [{'name': k.replace('/', '__'), 'prompt': v + STYLE, 'aspect': '1:1'} for k, v in A.items()]
Path(__file__).with_suffix('.json').write_text(json.dumps(out, indent=1))
print(len(out))
