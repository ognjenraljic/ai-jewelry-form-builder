"""Pravi početnu biblioteku referentnih slika za stilove iz src/library.json.

Svaka slika: neutralna fotografija oblika (bijelo zlato, tamna pozadina), 768 px webp,
u public/library/<tip>/<stil>.webp. Ključ čita iz .dev.vars (GEMINI_API_KEY).

  python3 scripts/build_library.py              # samo one koje fale
  python3 scripts/build_library.py --only grillz/top8,chain/cuban --force
  python3 scripts/build_library.py --model gemini-2.5-flash-image

Zlatar kasnije može zamijeniti bilo koju sliku fotografijom svog komada (isto ime fajla).
"""
import argparse
import base64
import http.client
import io
import json
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LIB = json.loads((ROOT / 'src/library.json').read_text())
OUT = ROOT / 'public/library'

# Cijena po slici je procjena iz tokena (vidi MODELS u src/worker.js).
PRICE = {'gemini-3-pro-image-preview': 0.155, 'gemini-2.5-flash-image': 0.039}


def api_key():
    for line in (ROOT / '.dev.vars').read_text().splitlines():
        if line.startswith('GEMINI_API_KEY='):
            return line.split('=', 1)[1].strip().strip('"\'')
    raise SystemExit('GEMINI_API_KEY nije u .dev.vars (pokreni ./set-key.sh)')


def prompt_for(item):
    return (
        f"Reference product photograph for a jewelry configurator: {item['ref']}. "
        'Polished white gold, front or three-quarter view (whichever shows the shape best), centered, '
        'the piece fills about 70% of the square frame, seamless dark charcoal background, soft studio lighting, '
        'photorealistic, sharp detail. No people, no hands, no props, no watermark, no logos, '
        'no text except letters explicitly described.'
    )


def generate(key, model, item):
    body = {
        'contents': [{'role': 'user', 'parts': [{'text': prompt_for(item)}]}],
        'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'], 'imageConfig': {'aspectRatio': '1:1'}},
    }
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        data=json.dumps(body).encode(),
        headers={'content-type': 'application/json', 'x-goog-api-key': key},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.load(r)
    for part in data.get('candidates', [{}])[0].get('content', {}).get('parts', []):
        d = part.get('inlineData') or part.get('inline_data')
        if d:
            return base64.b64decode(d['data'])
    raise RuntimeError('model nije vratio sliku')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='lista tip/stil, zarezom')
    ap.add_argument('--force', action='store_true', help='prepiši postojeće')
    ap.add_argument('--model', default='gemini-3-pro-image-preview')
    ap.add_argument('--workers', type=int, default=4)
    args = ap.parse_args()
    only = set(args.only.split(',')) if args.only else None

    jobs = []
    for typ, items in LIB.items():
        if typ.startswith('_'):
            continue
        for item in items:
            name = f"{typ}/{item['value']}"
            path = OUT / typ / f"{item['value']}.webp"
            if only and name not in only:
                continue
            if path.exists() and not args.force:
                continue
            jobs.append((name, path, item))
    if not jobs:
        print('Ništa za generisanje.')
        return
    print(f"Generišem {len(jobs)} slika sa {args.model} (~${len(jobs) * PRICE.get(args.model, 0.15):.2f})")
    key = api_key()

    def run(job):
        name, path, item = job
        t0 = time.time()
        for attempt in range(3):
            try:
                raw = generate(key, args.model, item)
                img = Image.open(io.BytesIO(raw)).convert('RGB')
                img.thumbnail((768, 768))
                path.parent.mkdir(parents=True, exist_ok=True)
                img.save(path, 'WEBP', quality=85)
                return f'OK   {name} ({time.time() - t0:.0f} s, {path.stat().st_size // 1024} KB)'
            except (urllib.error.HTTPError, urllib.error.URLError, http.client.HTTPException, RuntimeError, TimeoutError) as e:
                msg = e.read().decode()[:200] if isinstance(e, urllib.error.HTTPError) else str(e)
                if attempt == 2:
                    return f'FAIL {name}: {msg}'
                time.sleep(3 * (attempt + 1))

    with ThreadPoolExecutor(args.workers) as ex:
        for line in ex.map(run, jobs):
            print(line, flush=True)


if __name__ == '__main__':
    main()
