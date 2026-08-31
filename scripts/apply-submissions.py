#!/usr/bin/env python3
"""Apply approved listing updates to businesses.json.

    python3 scripts/apply-submissions.py ~/Downloads/approved-submissions.json [--dry-run]

The admin page approves; this applies. Keeping them apart means every change to
the dataset still arrives as a git diff you can read and revert, rather than a
web form writing to the live data.

Only allow-listed fields are written, and only where the record still holds the
value the business was shown. If someone edited that field in between, the
change is reported as a conflict and skipped rather than silently overwriting
newer work.

Tier appeals are never applied automatically -- they are listed for you to
judge against the rulebook, which is the whole point of keeping Gold
non-discretionary. Removals are listed too, since deleting a record is not
something a script should decide.
"""
import argparse, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', 'businesses.json')
APPLY = {'name', 'website', 'instagram', 'address', 'town', 'description'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('approved')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    subs = json.load(open(args.approved))
    data = json.load(open(DATA))
    by_id = {r['id']: r for r in data}

    applied, conflicts, appeals, removals, missing = 0, [], [], [], []

    for s in subs:
        r = by_id.get(s['business_id'])
        if not r:
            missing.append(s['business_id'])
            continue
        if s.get('appeal'):
            appeals.append(s)
        if s.get('removal'):
            removals.append(s)
        for field, ch in (s.get('changes') or {}).items():
            if field not in APPLY:
                continue
            current = (r.get(field) or '').strip()
            was = (ch.get('from') or '').strip()
            if current != was:
                conflicts.append((s['business_name'], field, was, current))
                continue
            if not args.dry_run:
                r[field] = ch['to']
            applied += 1
            print('  %-28s %-12s -> %s' % (s['business_name'][:28], field, ch['to']))

    print('\n%d field%s applied' % (applied, '' if applied == 1 else 's'))

    if conflicts:
        print('\n%d CONFLICT%s — the record changed since they were shown it, skipped:'
              % (len(conflicts), '' if len(conflicts) == 1 else 'S'))
        for name, field, was, current in conflicts:
            print('  %s / %s\n      they saw: %s\n      now:      %s' % (name, field, was or '(empty)', current or '(empty)'))

    if appeals:
        print('\n%d TIER APPEAL%s — decide these by hand against gold-and-silver.html:'
              % (len(appeals), '' if len(appeals) == 1 else 'S'))
        for s in appeals:
            a = s['appeal']
            print('  %s (%s, currently %s)' % (s['business_name'], s['category'], s['tier']))
            print('      Q: %s' % a.get('question', ''))
            print('      A: %s' % (a.get('answer') or '(none)'))
            if a.get('link'):
                print('      %s' % a['link'])

    if removals:
        print('\n%d REMOVAL REQUEST%s — delete these by hand:'
              % (len(removals), '' if len(removals) == 1 else 'S'))
        for s in removals:
            print('  %s (%s)%s' % (s['business_name'], s['business_id'],
                                   ' — "%s"' % s['notes'] if s.get('notes') else ''))

    if missing:
        print('\n%d submission%s for ids no longer in the data: %s'
              % (len(missing), '' if len(missing) == 1 else 's', ', '.join(missing)))

    if args.dry_run:
        print('\n(dry run — nothing written)')
        return
    if applied:
        with open(DATA, 'w') as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write('\n')
        print('\nwritten to data/businesses.json — check the diff before committing')


if __name__ == '__main__':
    main()
