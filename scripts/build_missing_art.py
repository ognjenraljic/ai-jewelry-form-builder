#!/usr/bin/env python3
"""Slike za sve što forma nudi pri dodavanju (public/option-suggestions.js), a nije imalo sliku.
Stilovi idu u public/library/<komad>/<slug>.webp, komadi u public/library/pieces/, izbori u public/library/options/<kategorija>/.
Generiše Codex preko pretplate (Ignis tools/codex_parallel_images.py), po 8 odjednom; postojeće slike preskače.

  python3 scripts/build_missing_art.py          # van sandboxa
  python3 scripts/build_missing_art.py --count
  python3 scripts/build_option_index.py         # poslije svakog dodavanja
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/library'
TOOL = Path.home() / 'Documents/Ignis/tools/codex_parallel_images.py'

SHAPE = (' Polished white gold, front or three-quarter view (whichever shows the shape best), centered, the piece fills about 70% of the square frame, seamless dark charcoal background, '
         'soft studio lighting, photorealistic, sharp detail. Square image. No people, no hands, no props, no watermark, no logos, no text.')
PHOTO = (' Professional studio jewelry product photograph, one subject centered with generous space around it, plain matte deep charcoal gray background, soft studio light, subtle shadow, '
         'sharp focus, photorealistic. Square image. No text unless asked, no logo, no watermark, no hands, no people, no props.')

SHAPES = {
    'ring/cluster': 'a cluster ring: many small round diamonds grouped tightly into one flower-like head on a plain band',
    'ring/vintage': 'a vintage art deco engagement ring with milgrain edges, fine filigree and a round center diamond',
    'ring/stackable': 'three thin stackable bands stacked together: one plain, one pavé, one with a fine twisted texture',
    'ring/championship': 'a large heavy championship ring with a big flat diamond-set top and thick sculpted shoulders, no text and no emblem',
    'chain/figaro': 'a Figaro chain: a repeating pattern of three short flat curb links followed by one long oval link, plain polished metal',
    'chain/box': 'a box chain: small square links joined into a smooth square tube, plain polished metal',
    'chain/herringbone': 'a herringbone chain: flat slanted links laid in a tight V pattern forming a smooth flat ribbon, plain polished metal',
    'chain/snake': 'a snake chain: tightly joined plates forming one smooth flexible round tube like snake skin, plain polished metal',
    'chain/mariner': 'a mariner anchor chain: oval links each with a straight bar across the middle, plain polished metal',
    'chain/curb': 'a curb chain: uniform flat twisted links that lie flat when laid down, plain polished metal',
    'chain/wheat': 'a wheat spiga chain: small oval links braided so they look like a stalk of wheat, plain polished metal',
    'chain/byzantine': 'a Byzantine chain: intricate woven links forming a thick textured ropelike pattern, plain polished metal',
    'chain/paperclip': 'a paperclip chain: long flat elongated rectangular links, plain polished metal',
    'chain/singapore': 'a Singapore chain: fine twisted diamond cut links that sparkle and flow like liquid, plain polished metal',
    'chain/bead': 'a bead ball chain: a row of small round polished metal beads on a fine strand',
    'pendant/initial': 'a single capital letter initial pendant on a thin chain, the letter A, diamond set',
    'pendant/name-plate': 'a flat rectangular bar name plate pendant on a chain, blank polished surface, no text',
    'pendant/portrait': 'a round photo portrait memorial pendant with a diamond border and a blank smooth center, on a chain',
    'pendant/logo': 'a custom shaped emblem pendant, an abstract geometric shield shape set with diamonds, no letters and no real brand, on a chain',
    'pendant/religious': 'a religious medal pendant with a raised praying angel relief, on a chain',
    'pendant/heart': 'a puffed polished heart pendant on a thin chain',
    'pendant/locket': 'an oval hinged locket pendant, closed, with a fine engraved border, on a chain',
    'bracelet/cuff': 'a wide open cuff bracelet with a smooth rounded surface and an opening at the back',
    'bracelet/charm': 'a link charm bracelet with several small charms hanging from it: a heart, a star, a key',
    'bracelet/figaro': 'a Figaro bracelet with a pattern of three short links and one long link, clasped and lying in an oval, plain polished metal',
    'bracelet/beaded': 'a beaded bracelet of round polished metal beads on a stretch cord, lying in a circle',
    'bracelet/id': 'an ID bracelet with a flat rectangular blank plate at the center on a curb link chain, no text',
    'bracelet/curb': 'a curb link bracelet, flat twisted links, clasped and lying in an oval, plain polished metal',
    'bracelet/rope': 'a rope bracelet, links twisted like rope, clasped and lying in an oval, plain polished metal',
    'bracelet/franco': 'a Franco link bracelet, the tight V pattern of the links forming a square profile, lying in an oval',
    'bracelet/mariner': 'a mariner anchor link bracelet, oval links with a bar across the middle, lying in an oval',
    'bracelet/paperclip': 'a paperclip link bracelet, long flat rectangular links, lying in an oval',
    'bracelet/byzantine': 'a Byzantine link bracelet, intricate woven links, lying in an oval',
    'earrings/huggies': 'a pair of small thick huggie hoop earrings that hug the earlobe, a line of small diamonds on the front',
    'earrings/chandelier': 'a pair of long ornate chandelier earrings with cascading tiers of diamonds',
    'earrings/climbers': 'a pair of ear climber earrings, a curved line of diamonds that rises up the ear shape, displayed on their own',
    'earrings/clusters': 'a pair of cluster stud earrings, small diamonds grouped tightly like a flower',
    'watch/dress': 'a slim elegant dress watch with a thin round case, a plain dial with simple stick markers, on a leather strap, no brand name',
    'watch/diver': 'a diver watch with a rotating ceramic bezel, luminous markers and a link bracelet, no brand name and no numbers',
    'watch/chronograph': 'a chronograph watch with three small sub-dials, pushers on the side of the case and a link bracelet, no brand name',
    'watch/skeleton': 'a skeleton watch with an open dial showing the gears of the movement, no brand name',
    'grillz/bottom-6': 'a dental grill covering six lower front teeth, displayed on its own, no mouth, front view',
    'grillz/single-cap': 'one single polished gold-style cap shaped like a slim upper front incisor tooth, small in the frame, standing on its own, no mouth',
    'grillz/window': 'an open face window dental grill covering six upper teeth, each tooth is an open polished frame with an empty center, displayed on its own, no mouth',
    'pieces/anklet': 'a delicate anklet chain with a small charm, lying in a loose curve',
    'pieces/brooch': 'a floral brooch set with diamonds',
    'pieces/cufflinks': 'a pair of round polished cufflinks with a fine diamond edge',
    'pieces/charm': 'a single small heart charm on a jump ring',
    'pieces/nose-ring': 'a tiny thin nose ring hoop with one small diamond',
    'pieces/belly-ring': 'a curved belly ring barbell with a diamond at each end',
    'pieces/tie-clip': 'a slim polished tie clip bar',
    'pieces/belt-buckle': 'a polished rectangular belt buckle with a diamond set border and a blank center',
    'pieces/body-chain': 'a fine body chain with a center ring and draping strands, laid flat',
    'pieces/crown': 'a small tiara crown set with diamonds',
}
def gem(s): return f'A single loose {s}, resting at a slight angle, sharply lit so its color and facets are clear.'
def stamp(mark, m): return f'Extreme macro of the inner surface of a polished {m} ring band, with a small crisp hallmark stamp that reads exactly "{mark}" and nothing else. Only that stamp may contain text.'
def finish(s): return f'A wide plain gold band ring with a {s} surface, seen close, showing the texture of the metal clearly.'
def setting(s): return f'A close view of a gold ring showing {s}.'
def clasp(s): return f'A {s} on the end of a fine gold chain, closed, seen close.'
def color(s): return f'A single loose round brilliant cut {s} diamond seen from above, sharply lit.'
PHOTOS = {
    'options/metal/palladium': 'A plain polished band ring in palladium, cool and slightly gray, three-quarter view.',
    'options/metal/titanium': 'A plain brushed band ring in dark gray titanium, three-quarter view.',
    'options/karat/9k': stamp('9K', 'yellow gold'),
    'options/karat/950-platinum': stamp('950', 'platinum'),
    'options/stones/colored-diamonds': 'Three loose round fancy colored diamonds side by side: one yellow, one pink, one blue, sharply lit.',
    'options/stones/aquamarine': gem('oval pale blue aquamarine'),
    'options/stones/amethyst': gem('oval deep purple amethyst'),
    'options/stones/tanzanite': gem('oval violet blue tanzanite'),
    'options/stones/opal': gem('oval polished white opal with rainbow play of color, smooth cabochon'),
    'options/stones/pearl': 'A single round lustrous white pearl, soft reflections on its surface.',
    'options/stones/morganite': gem('oval soft peach pink morganite'),
    'options/center-shape/asscher': 'A single loose Asscher cut diamond seen from the top at a slight angle, showing its exact square stepped outline.',
    'options/center-shape/heart': 'A single loose heart cut diamond seen from the top at a slight angle, showing its exact outline.',
    'options/size/large': 'A pair of large gold drop earrings, front view.',
    'options/finish/polished': finish('mirror polished'),
    'options/finish/matte': finish('soft matte satin'),
    'options/finish/brushed': finish('fine straight brushed'),
    'options/finish/hammered': finish('hand hammered'),
    'options/setting/prong': setting('a round diamond held by six thin metal prongs'),
    'options/setting/bezel': setting('a round diamond fully surrounded by a smooth metal rim, a bezel setting'),
    'options/setting/pave': setting('many tiny diamonds set closely together in small metal beads, a pavé setting'),
    'options/setting/channel': setting('a row of square diamonds set side by side between two metal walls, a channel setting'),
    'options/clasp/lobster': clasp('lobster claw clasp'),
    'options/clasp/box': clasp('rectangular box clasp with a safety catch'),
    'options/clasp/toggle': clasp('toggle clasp: a round ring with a straight bar through it'),
    'options/clasp/magnetic': clasp('smooth cylindrical magnetic clasp'),
    'options/stone-color/colorless': color('colorless'),
    'options/stone-color/yellow': color('fancy yellow'),
    'options/stone-color/pink': color('fancy pink'),
    'options/stone-color/blue': color('fancy blue'),
    'options/stone-color/black': color('black'),
    'options/engraving/no-engraving': 'The clean plain polished inner surface of a gold ring band, no engraving at all, seen close.',
    'options/engraving/initials': 'The polished inner surface of a gold ring band with engraved initials reading exactly "A & J" and nothing else. Only that text.',
    'options/engraving/date': 'The polished inner surface of a gold ring band with an engraved date reading exactly "06.14.2024" and nothing else. Only that text.',
    'options/engraving/short-message': 'The polished inner surface of a gold ring band with a short engraved message in fine script reading exactly "Always" and nothing else. Only that text.',
}

parser = argparse.ArgumentParser()
parser.add_argument('--count', action='store_true')
args = parser.parse_args()
all_jobs = {**{k: f'Reference product photograph for a jewelry configurator: {v}.{SHAPE}' for k, v in SHAPES.items()}, **{k: v + PHOTO for k, v in PHOTOS.items()}}
todo = [(k, v) for k, v in all_jobs.items() if not (OUT / f'{k}.webp').exists()]
print(len(todo), 'za generisanje')
if args.count:
    raise SystemExit
for i in range(0, len(todo), 8):
    group = todo[i:i + 8]
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'spec.json'
        path.write_text(json.dumps([{'name': k.replace('/', '__'), 'prompt': v, 'variants': 1} for k, v in group]))
        subprocess.run(['python3', str(TOOL), '--spec', str(path), '--out', tmp], check=False)
        for k, _ in group:
            src = Path(tmp) / f"{k.replace('/', '__')}.jpg"
            if not src.exists():
                print('FALI', k, flush=True)
                continue
            dst = OUT / f'{k}.webp'
            dst.parent.mkdir(parents=True, exist_ok=True)
            Image.open(src).convert('RGB').resize((768, 768), Image.LANCZOS).save(dst, 'WEBP', quality=82, method=6)
            print('OK', k, dst.stat().st_size // 1024, 'KB', flush=True)
