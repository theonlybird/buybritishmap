#!/usr/bin/env python3
"""Generate one tokenised update link per business, plus the mail-merge sheet.

    export UPDATE_LINK_SECRET="$(python3 -c 'import secrets;print(secrets.token_hex(32))')"
    python3 scripts/make-update-links.py

Writes .outreach/update-links.csv -- one row per business, ready for a mail
merge, carrying the link, the contact address, and the single thing we most
want from that business so the email can ask for it by name.

The token is HMAC-SHA256(secret, id) truncated to 10 hex characters. It is not
authentication and is not pretending to be: every submission is reviewed before
anything changes. What it does is stop someone walking the list of 474 ids and
editing arbitrary businesses, and make possession of the email the thing that
opens the record. api/update-listing.js recomputes it with the same secret.

UPDATE_LINK_SECRET must be set here and in Vercel, and must never be committed.
Regenerating it invalidates every link already sent.
"""
import argparse, csv, hashlib, hmac, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '.outreach')
POSTCODE = re.compile(r'[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}', re.I)


def token(secret, bid):
    return hmac.new(secret.encode(), bid.encode(), hashlib.sha256).hexdigest()[:10]


def primary_ask(r, contact):
    """The one thing worth asking this business for, most valuable first."""
    logo = r.get('logo') or ''
    if not logo or 'placeholder' in logo:
        return 'logo', 'We have no logo for you'
    if r.get('listing_type') in ('shop', 'both') and not POSTCODE.search(r.get('address') or ''):
        return 'postcode', 'We need your full address including postcode'
    if r.get('tier') == 'silver' and r.get('tier_confidence') == 'medium':
        return 'tier-evidence', r.get('tier_question') or 'We may have your tier wrong'
    if not r.get('instagram'):
        return 'instagram', 'We have no Instagram for you'
    return 'confirm', 'Just confirm your details are right'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='https://grownandmade.uk')
    args = ap.parse_args()

    secret = os.environ.get('UPDATE_LINK_SECRET', '')
    if not secret:
        sys.exit('UPDATE_LINK_SECRET is not set. Generate one with:\n'
                 "    python3 -c 'import secrets;print(secrets.token_hex(32))'\n"
                 'then export it here and add it to the Vercel project.')

    data = json.load(open(os.path.join(ROOT, 'data', 'businesses.json')))
    contacts = {}
    cpath = os.path.join(ROOT, 'data', 'business-contacts.json')
    if os.path.exists(cpath):
        contacts = {c['id']: c for c in json.load(open(cpath))}

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'update-links.csv')
    counts = {}
    with open(path, 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['id', 'name', 'email', 'contact_route', 'tier', 'category',
                    'town', 'ask_type', 'ask_text', 'update_link'])
        for r in data:
            c = contacts.get(r['id'], {})
            email = c.get('primary_email', '')
            route = 'email' if email else (
                'contact_form' if c.get('contact_form_url') else
                'instagram' if r.get('instagram') else 'none')
            kind, text = primary_ask(r, c)
            counts[kind] = counts.get(kind, 0) + 1
            counts['route:' + route] = counts.get('route:' + route, 0) + 1
            link = '%s/update?b=%s&k=%s' % (args.base, r['id'], token(secret, r['id']))
            w.writerow([r['id'], r['name'], email, route, r['tier'], r['category'],
                        r.get('town', ''), kind, text, link])

    print(path)
    print('%d rows\n' % len(data))
    for k in sorted(counts):
        print('  %-22s %3d' % (k, counts[k]))


if __name__ == '__main__':
    main()
