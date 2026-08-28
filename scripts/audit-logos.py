#!/usr/bin/env python3
"""Classify every logo the map will actually render.

    python3 scripts/audit-logos.py            # summary + per-category lists
    python3 scripts/audit-logos.py --json     # machine-readable, for the harvester

Logos are drawn in a 40-48px tile on white, so this reports how each file
behaves there: invisible white-on-transparent art, dark tiles, photographs
and social-share banners grabbed in place of a mark, and files too small to
stay sharp.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo_lib import measure

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDER = ['MISSING', 'PLACEHOLDER', 'UNREADABLE', 'EMPTY', 'INVISIBLE_ON_WHITE',
         'PHOTO', 'TINY', 'DARK_BOX', 'VECTOR', 'OK']


def audit():
    data = json.load(open(os.path.join(ROOT, 'data/businesses.json'), encoding='utf-8'))
    recs = data if isinstance(data, list) else data['businesses']
    out = {}
    for r in recs:
        rel = r.get('logo') or 'assets/logos/%s.png' % r['id']
        if 'placeholder' in rel:
            out.setdefault('PLACEHOLDER', []).append((r['id'], r['name'], {}))
            continue
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            out.setdefault('MISSING', []).append((r['id'], r['name'], {}))
            continue
        verdict, info = measure(path)
        out.setdefault(verdict, []).append((r['id'], r['name'], info))
    return recs, out


def main():
    recs, buckets = audit()
    if '--json' in sys.argv:
        print(json.dumps({k: [i for i, _, _ in v] for k, v in buckets.items()}, indent=1))
        return
    print('%d records\n' % len(recs))
    for k in ORDER:
        if buckets.get(k):
            print('%-22s %d' % (k, len(buckets[k])))
    print()
    for k in ORDER:
        v = buckets.get(k)
        if not v or k in ('OK', 'VECTOR'):
            continue
        print('===== %s (%d) =====' % (k, len(v)))
        for lid, name, info in sorted(v, key=lambda x: x[1].lower()):
            tail = ''
            if info:
                tail = '  [%s %sx%s %s]' % (info.get('fmt'), info.get('w'),
                                            info.get('h'), info.get('prov', ''))
            print('  %-36s %s%s' % (name, lid, tail))
        print()


if __name__ == '__main__':
    main()
