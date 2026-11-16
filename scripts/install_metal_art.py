#!/usr/bin/env python3
"""Ubacuje slike izbora po boji metala u biblioteku: public/library/options/<kategorija>/<komad>/<yellow|white|rose>/<slug>.webp.
Forma pokazuje onu koja odgovara metalu koji je kupac izabrao (option-art.js metalArt). Ulaz: folder sa <slug>--<porodica>.jpg
(npr. iz Codexa), i mapa slug -> kategorija.

  python3 scripts/install_metal_art.py ~/Desktop/jewelrylead-katalog/district-grillz/out --piece grillz
  python3 scripts/install_metal_art.py ~/Desktop/jewelrylead-katalog/district-grillz/out-light --piece grillz --light
  python3 scripts/build_option_index.py
"""
import argparse
from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / 'public'
CATEGORY = {
    'polished': 'cut', 'open-face': 'cut', 'diamond-cut': 'cut', 'diamond-cut-n-dust': 'cut', 'nugget-cut': 'cut', 'rose-cut': 'cut',
    'perm-cut': 'cut', 'weed-cut': 'cut', 'pineapple-cut': 'cut', 'starburst-cut': 'cut',
    'pave': 'setting', 'straight': 'setting', 'invisible': 'setting', 'jumbo': 'setting', 'mosaic': 'setting',
}
ALIASES = {'polished': ['solid']}  # isti izbor pod drugim imenom (šablon zove polirani rez "Solid")

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('--piece', required=True)
ap.add_argument('--size', type=int, default=768)
ap.add_argument('--light', action='store_true', help='Studio Light par: public/library-light/ (iste putanje)')
args = ap.parse_args()
ROOT = PUBLIC / ('library-light' if args.light else 'library') / 'options'
n = 0
for f in sorted(Path(args.src).expanduser().glob('*--*.jpg')):
    slug, fam = f.stem.split('--')
    if slug not in CATEGORY or fam not in ('yellow', 'white', 'rose'):
        print('preskačem', f.name); continue
    im = Image.open(f).convert('RGB')
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).resize((args.size, args.size), Image.LANCZOS)
    for name in [slug, *ALIASES.get(slug, [])]:
        out = ROOT / CATEGORY[slug] / args.piece / fam / f'{name}.webp'
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, 'WEBP', quality=86, method=6)
        n += 1
print(n, 'slika')
