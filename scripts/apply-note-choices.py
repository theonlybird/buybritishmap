#!/usr/bin/env python3
"""Write approved public tier reasons into businesses.json.

    python3 scripts/apply-note-choices.py ~/Downloads/public-notes.json [--dry-run]

Adds two fields per record:
    public_note    the outward-facing reason, shown on the update portal
    tier_question  the one question that would move them to Gold (Silver only)

evidence_note is never touched. The internal reasoning and the sentence the
business reads are separate records of separate things, and conflating them is
how a working note ends up in front of 474 people.

json.dumps(indent=2, ensure_ascii=False) round-trips this file byte-for-byte,
so the diff shows only the fields actually added.
"""
import argparse, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', 'businesses.json')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('choices')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    chosen = json.load(open(args.choices))
    data = json.load(open(DATA))
    by_id = {r['id']: r for r in data}

    applied = skipped = unknown = 0
    for bid, vals in chosen.items():
        r = by_id.get(bid)
        if not r:
            print('  ? unknown id, skipped: %s' % bid)
            unknown += 1
            continue
        note = (vals.get('public_note') or '').strip()
        if not note:
            skipped += 1
            continue
        changed = r.get('public_note') != note
        r['public_note'] = note
        q = (vals.get('tier_question') or '').strip()
        if q and r['tier'] == 'silver':
            changed = changed or r.get('tier_question') != q
            r['tier_question'] = q
        applied += changed

    print('%d records updated, %d blank and skipped, %d unknown ids'
          % (applied, skipped, unknown))
    with_note = sum(1 for r in data if r.get('public_note'))
    print('%d of %d records now carry a public_note' % (with_note, len(data)))

    if args.dry_run:
        print('(dry run — nothing written)')
        return
    with open(DATA, 'w') as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write('\n')
    print('written to data/businesses.json')


if __name__ == '__main__':
    main()
