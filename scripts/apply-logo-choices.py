#!/usr/bin/env python3
"""Apply the logos chosen in review.html.

    python3 scripts/apply-logo-choices.py .logo-harvest/choices.json [--dry-run]

choices.json maps a business id to the harvested candidate file to adopt.
Each winner is normalised the way the map wants it: whitespace trimmed,
long edge capped at 512px, saved as a real PNG (SVG is kept as SVG, since
vector stays crisp in the 48px tile). White-on-transparent artwork keeps
its transparency and gets logo_bg:"dark" so index.html gives it a dark
tile instead of hiding it on a white one.

businesses.json is rewritten with json.dumps(indent=2), which round-trips
the existing file byte-for-byte, so the diff shows only real changes.
"""
import argparse, json, os, shutil, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo_lib import measure

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXDIM = 512


def trim(im, tol=8):
    import numpy
    a = numpy.array(im.convert('RGB')).astype(int)
    alpha = numpy.array(im.split()[-1]) if im.mode == 'RGBA' else None
    nonwhite = (255 - a).max(2) > tol
    if alpha is not None:
        nonwhite &= alpha > 24
    ys, xs = numpy.nonzero(nonwhite)
    if len(xs) == 0:
        return im
    pad = 2
    return im.crop((max(int(xs.min()) - pad, 0), max(int(ys.min()) - pad, 0),
                    min(int(xs.max()) + 1 + pad, im.width),
                    min(int(ys.max()) + 1 + pad, im.height)))


def normalise(src, dest, keep_alpha):
    im = Image.open(src).convert('RGBA')
    if keep_alpha:
        im = trim(im)
    else:
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        im = trim(Image.alpha_composite(bg, im))
        im = im.convert('RGB')
    if max(im.size) > MAXDIM:
        s = MAXDIM / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))),
                       Image.LANCZOS)
    im.save(dest, 'PNG', optimize=True)
    return im.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('choices')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    choices = json.load(open(a.choices))
    bpath = os.path.join(ROOT, 'data/businesses.json')
    data = json.load(open(bpath, encoding='utf-8'))
    recs = data if isinstance(data, list) else data['businesses']
    by_id = {r['id']: r for r in recs}

    applied, skipped = 0, []
    for rid, rel in choices.items():
        if not rel or rid not in by_id:
            skipped.append((rid, 'unknown id' if rel else 'no choice'))
            continue
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            skipped.append((rid, 'candidate file missing'))
            continue
        verdict, info = measure(src)
        rec = by_id[rid]

        if verdict == 'VECTOR':
            dest_rel = 'assets/logos/%s.svg' % rid
            if not a.dry_run:
                shutil.copyfile(src, os.path.join(ROOT, dest_rel))
            note = 'svg'
            rec.pop('logo_bg', None)
        else:
            keep_alpha = verdict == 'INVISIBLE_ON_WHITE'
            dest_rel = 'assets/logos/%s.png' % rid
            if a.dry_run:
                note = '%sx%s' % (info.get('w'), info.get('h'))
            else:
                w, h = normalise(src, os.path.join(ROOT, dest_rel), keep_alpha)
                note = '%sx%s' % (w, h)
            if keep_alpha:
                rec['logo_bg'] = 'dark'
                note += ' (white artwork → dark tile)'
            else:
                rec.pop('logo_bg', None)
        rec['logo'] = dest_rel
        applied += 1
        print('  %-34s %s  %s' % (rec['name'][:34], dest_rel, note))

    if not a.dry_run and applied:
        out = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
        open(bpath, 'w', encoding='utf-8').write(out)

    print('\napplied %d%s' % (applied, '  (dry run — nothing written)' if a.dry_run else ''))
    for rid, why in skipped:
        print('  skipped %s: %s' % (rid, why))


if __name__ == '__main__':
    main()
