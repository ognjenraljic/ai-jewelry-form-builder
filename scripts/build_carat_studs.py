#!/usr/bin/env python3
"""Veličina kamena na minđušama: jedan kadar, skaliran po stvarnom prečniku okruglog dijamanta, jer AI ne pokazuje 3 ct naspram 4 ct tačno."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

DIR = Path(__file__).resolve().parent.parent / 'public/library/options/carat/earrings'
MM = {1: 6.5, 2: 8.1, 3: 9.3, 4: 10.2, 5: 11.0, 6: 11.7}
source = DIR / 'source.png'
if not source.exists():
    Image.open(DIR / '5-ct.webp').convert('RGB').save(source)
base = Image.open(source)
size = base.size[0]
fill = Image.new('RGB', base.size, base.getpixel((8, size // 2)))
for ct, mm in MM.items():
    scale = mm / MM[5]
    side = round(size * scale)
    shot = base.resize((side, side), Image.LANCZOS)
    canvas = fill.copy()
    if side <= size:
        mask = Image.new('L', (side, side), 0)
        ImageDraw.Draw(mask).rounded_rectangle((30, 30, side - 30, side - 30), 60, fill=255)
        canvas.paste(shot, ((size - side) // 2, (size - side) // 2), mask.filter(ImageFilter.GaussianBlur(24)))
    else:
        cut = (side - size) // 2
        canvas = shot.crop((cut, cut, cut + size, cut + size))
    canvas.save(DIR / f'{ct}-ct.webp', 'WEBP', quality=82, method=6)
    print(ct, 'ct', round(scale, 2))
source.unlink()
