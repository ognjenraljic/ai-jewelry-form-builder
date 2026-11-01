#!/usr/bin/env python3
"""Exact diagrams for measured choices (chain length, width, ring size...): an AI photo cannot show 18" vs 20" truthfully.
Writes public/library/options/<category>/<slug>.svg; the slug is slugOf(option label), see src/option-art.js."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'public/library/options'
BG, GOLD, SOFT, INK = '#22282b', '#e2b04a', '#6f7d80', '#eef6f5'


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def svg(body, caption):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="{BG}"/>{body}'
            f'<text x="256" y="474" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="44" font-weight="600" fill="{INK}">{caption}</text></svg>')


def write(cat, label, body):
    path = ROOT / cat / f'{slug(label)}.svg'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(svg(body, label.replace('"', '&quot;')))


# Bust silhouette; the chain drops lower as it gets longer (16" collar to 30" navel area).
def necklace(inches):
    drop = 96 + (inches - 16) * 15
    bust = f'<path d="M206 62c-2 34-4 50-22 62-34 18-96 26-116 66-12 26-18 120-20 210h416c-2-90-8-184-20-210-20-40-82-48-116-66-18-12-20-28-22-62" fill="none" stroke="{SOFT}" stroke-width="5"/>'
    chain = f'<path d="M190 118C200 {118 + drop} 312 {118 + drop} 322 118" fill="none" stroke="{GOLD}" stroke-width="7" stroke-linecap="round"/>'
    return bust + chain


# Wrist seen from above; the band sits looser on the wrist as the size grows.
def wrist(inches):
    r = 72 + (inches - 6.5) * 26
    return (f'<path d="M150 0v420M362 0v420" stroke="{SOFT}" stroke-width="5"/>'
            f'<ellipse cx="256" cy="210" rx="{r + 54}" ry="{(r + 54) * 0.42}" fill="none" stroke="{GOLD}" stroke-width="10"/>')


def thickness(mm):
    return f'<rect x="96" y="{210 - mm * 7}" width="320" height="{mm * 14}" rx="{mm * 2}" fill="{GOLD}"/><path d="M96 330h320M96 322v16M416 322v16" stroke="{SOFT}" stroke-width="4"/>'


def tall(inches):
    h = inches * 92
    return f'<rect x="196" y="{215 - h / 2}" width="120" height="{h}" rx="16" fill="none" stroke="{GOLD}" stroke-width="9"/><path d="M360 {215 - h / 2}v{h}M348 {215 - h / 2}h24M348 {215 + h / 2}h24" stroke="{SOFT}" stroke-width="4"/>'


def ring(size):
    r = 58 + (min(size, 13) - 4) * 11
    return f'<circle cx="256" cy="212" r="{r}" fill="none" stroke="{GOLD}" stroke-width="16"/>'


def case(mm):
    r = 54 + (mm - 36) * 7
    return f'<rect x="222" y="0" width="68" height="420" fill="none" stroke="{SOFT}" stroke-width="4"/><circle cx="256" cy="210" r="{r}" fill="{BG}" stroke="{GOLD}" stroke-width="10"/>'


for n in (16, 18, 20, 22, 24, 26, 30):
    write('length', f'{n}"', necklace(n))
for n in (6.5, 7, 7.5, 8, 8.5):
    write('length', f'{n:g}"', wrist(n))
for label, mm in (('3 mm', 3), ('5 mm', 5), ('8 mm', 8), ('10 mm', 10), ('12 mm+', 12)):
    write('width', label, thickness(mm))
for label, n in (('1"', 1), ('1.5"', 1.5), ('2"', 2), ('2.5"', 2.5), ('3"+', 3)):
    write('size', label, tall(n))
for label, n in (('4', 4), ('5', 5), ('6', 6), ('7', 7), ('8', 8), ('9', 9), ('10', 10), ('11', 11), ('12+', 12)):
    write('ring-size', label, ring(n))
for label, mm in (('36 mm', 36), ('40 mm', 40), ('42 mm', 42), ('44 mm+', 44)):
    write('case-size', label, case(mm))
print('ok')
