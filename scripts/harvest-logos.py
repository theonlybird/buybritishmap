#!/usr/bin/env python3
"""Harvest logo candidates from each listed business's own website.

    python3 scripts/harvest-logos.py                 # all records
    python3 scripts/harvest-logos.py --limit 20      # trial run
    python3 scripts/harvest-logos.py --only id1,id2

Writes .logo-harvest/ (gitignored): downloaded candidates plus candidates.json.
Re-running skips businesses already harvested unless --refresh is passed.

Why the business's own site and not an image search: it is the canonical
mark, it carries no stock-agency or third-party rights problem, and it is
the same source the listing's evidence_note is built from. Nothing here is
applied automatically -- build-logo-review.py turns the results into a sheet
for a human to approve, because a wrong logo is a factual error on a site
whose whole pitch is that it checks things.
"""
import argparse, concurrent.futures as cf, hashlib, json, os, random, re, sys, time
import urllib.request, urllib.parse, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo_lib import measure, score

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '.logo-harvest')
IMG = os.path.join(OUT, 'img')
UA = ('Mozilla/5.0 (compatible; GrownAndMadeBot/1.0; '
      '+https://grownandmade.uk/about.html) logo lookup for a free UK maker directory')
PAGE_CAP = 3_000_000
IMG_CAP = 6_000_000
MAX_CANDIDATES = 4

# Images that live in a footer or a payment strip and happen to have "logo"
# in the filename. Without this, every Shopify store nominates Visa.
DENY = re.compile(r'(?:^|[/_.-])(?:visa|mastercard|maestro|amex|american.?express|'
                  r'paypal|klarna|clearpay|laybuy|applepay|google.?pay|shop.?pay|'
                  r'unionpay|discover|diners|stripe|card_|payment|checkout|'
                  r'facebook|instagram|twitter|x-logo|tiktok|pinterest|youtube|'
                  r'linkedin|whatsapp|trustpilot|feefo|reviews?.?io|'
                  r'placeholder|spinner|loader|sprite|arrow|chevron|burger|'
                  r'cookie|gdpr|badge|award|as.?seen|klaviyo|mailchimp)', re.I)

# Store platforms serve a site's own assets from these, so they are not
# "third party" for the purposes of the cross-domain penalty below.
OWN_CDN = re.compile(r'(?:cdn\.shopify|cdn/shop/|squarespace-cdn|wixstatic|'
                     r'ecommercedns|wp-content|wp\.com|bigcommerce|cdn\.website-files|'
                     r'webflow|cloudfront|imgix|shopifycdn|myshopify)', re.I)

# Lower rank = more trustworthy as "this is our logo".
RANK = {'jsonld': 0, 'header-img': 1, 'logo-img': 1, 'touch-icon': 2,
        'shopify': 2, 'icon': 3, 'og': 4}


def get(url, cap, tries=4):
    """Fetch with backoff. 429s here usually come from the network path in
    front of us rather than the site itself, so retry rather than give up."""
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Language': 'en-GB,en;q=0.9',
    })
    delay = 1.5
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.read(cap), r.headers.get('Content-Type', ''), r.geturl()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < tries - 1:
                time.sleep(delay + random.random())
                delay *= 2
                continue
            raise
        except (TimeoutError, urllib.error.URLError) as e:
            if attempt < tries - 1 and isinstance(getattr(e, 'reason', None), TimeoutError):
                time.sleep(delay)
                delay *= 2
                continue
            raise


def absolutise(base, src):
    if not src:
        return None
    src = src.strip().replace('&amp;', '&')
    if src.startswith('data:'):
        return None
    if src.startswith('//'):
        return 'https:' + src
    return urllib.parse.urljoin(base, src)


def biggest_srcset(v):
    """Take the widest entry from a srcset attribute."""
    best, bestw = None, -1
    for part in v.split(','):
        bits = part.strip().split()
        if not bits:
            continue
        w = 0
        if len(bits) > 1 and bits[1].endswith('w'):
            try:
                w = int(bits[1][:-1])
            except ValueError:
                w = 0
        if w >= bestw:
            best, bestw = bits[0], w
    return best


def walk_jsonld(node, found):
    if isinstance(node, dict):
        for k, v in node.items():
            if k.lower() == 'logo':
                if isinstance(v, str):
                    found.append(v)
                elif isinstance(v, dict) and isinstance(v.get('url'), str):
                    found.append(v['url'])
            else:
                walk_jsonld(v, found)
    elif isinstance(node, list):
        for v in node:
            walk_jsonld(v, found)


def extract(html, base):
    """Return [(url, source)] in no particular order; ranked later."""
    out = []

    def add(u, src):
        u = absolutise(base, u)
        if u:
            out.append((u, src))

    # 1. schema.org Organization.logo -- an explicit machine-readable declaration
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>',
                         html, re.S | re.I):
        try:
            walkfound = []
            walk_jsonld(json.loads(m.group(1).strip()), walkfound)
            for u in walkfound:
                add(u, 'jsonld')
        except Exception:
            continue

    # 2. <img> that calls itself a logo, or sits in the masthead
    header = ''
    hm = re.search(r'<header[^>]*>(.*?)</header>', html, re.S | re.I)
    if hm:
        header = hm.group(1)
    for tag in re.findall(r'<img\b[^>]*>', html, re.I):
        attrs = tag.lower()
        srcset = re.search(r'srcset\s*=\s*["\']([^"\']+)["\']', tag, re.I)
        src = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', tag, re.I)
        url = biggest_srcset(srcset.group(1)) if srcset else (src.group(1) if src else None)
        if not url:
            continue
        if 'logo' in attrs:
            add(url, 'logo-img')
        elif tag in header:
            add(url, 'header-img')

    # 3. apple-touch-icon / icon links
    for tag in re.findall(r'<link\b[^>]*>', html, re.I):
        rel = re.search(r'rel\s*=\s*["\']([^"\']+)["\']', tag, re.I)
        href = re.search(r'href\s*=\s*["\']([^"\']+)["\']', tag, re.I)
        if not rel or not href:
            continue
        rl = rel.group(1).lower()
        if 'apple-touch-icon' in rl:
            add(href.group(1), 'touch-icon')
        elif 'icon' in rl and 'mask' not in rl:
            add(href.group(1), 'icon')

    # 4. Shopify stores keep the mark at a predictable path
    for m in re.finditer(r'["\'](//[^"\']*cdn/shop/(?:files|t/\d+/assets)/[^"\']*logo[^"\']*)["\']',
                         html, re.I):
        add(m.group(1), 'shopify')

    # 5. og:image -- last resort, usually a 1200x628 social banner, not a mark
    for m in re.finditer(r'<meta\b[^>]*(?:property|name)\s*=\s*["\']og:image["\'][^>]*>',
                         html, re.I):
        c = re.search(r'content\s*=\s*["\']([^"\']+)["\']', m.group(0), re.I)
        if c:
            add(c.group(1), 'og')

    seen, uniq = set(), []
    for u, s in sorted(out, key=lambda x: RANK.get(x[1], 9)):
        key = u.split('?')[0]
        if key in seen or DENY.search(key.rsplit('/', 1)[-1]) or DENY.search(key):
            continue
        seen.add(key)
        uniq.append((u, s))
    return uniq[:MAX_CANDIDATES]


def ext_for(fmt, ctype, url):
    if fmt == 'SVG' or 'svg' in (ctype or '') or url.split('?')[0].lower().endswith('.svg'):
        return '.svg'
    return {'PNG': '.png', 'JPEG': '.jpg', 'WEBP': '.webp', 'GIF': '.gif'}.get(fmt, '.bin')


def harvest(rec):
    site = (rec.get('website') or '').strip()
    result = {'id': rec['id'], 'name': rec['name'], 'website': site, 'candidates': []}
    if not site:
        result['error'] = 'no website'
        return result
    if not site.startswith('http'):
        site = 'https://' + site
    try:
        raw, ctype, final = get(site, PAGE_CAP)
    except Exception as e:
        result['error'] = '%s: %s' % (type(e).__name__, str(e)[:70])
        return result
    html = raw.decode('utf-8', 'replace')
    for url, source in extract(html, final):
        try:
            blob, ct, _ = get(url, IMG_CAP)
        except Exception:
            continue
        if len(blob) < 120:
            continue
        name = hashlib.sha1(url.encode()).hexdigest()[:16]
        tmp = os.path.join(IMG, name)
        with open(tmp, 'wb') as f:
            f.write(blob)
        verdict, info = measure(tmp)
        if verdict == 'UNREADABLE':
            os.remove(tmp)
            continue
        path = tmp + ext_for(info.get('fmt'), ct, url)
        os.replace(tmp, path)
        offsite = (urllib.parse.urlparse(url).netloc.split(':')[0].lstrip('www.')
                   not in urllib.parse.urlparse(final).netloc and
                   not OWN_CDN.search(url))
        result['candidates'].append({
            'url': url, 'source': source, 'file': os.path.relpath(path, ROOT),
            'verdict': verdict, 'info': info, 'offsite': offsite,
            'score': score(verdict, info, RANK.get(source, 9)) - (18 if offsite else 0),
        })
    result['candidates'].sort(key=lambda c: -c['score'])
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int)
    ap.add_argument('--only')
    ap.add_argument('--refresh', action='store_true')
    ap.add_argument('--retry-errors', action='store_true',
                    help='re-attempt businesses whose last run errored')
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--deadline', type=float, default=0,
                    help='stop cleanly after N seconds (for chunked runs)')
    a = ap.parse_args()

    os.makedirs(IMG, exist_ok=True)
    data = json.load(open(os.path.join(ROOT, 'data/businesses.json'), encoding='utf-8'))
    recs = data if isinstance(data, list) else data['businesses']
    if a.only:
        want = set(a.only.split(','))
        recs = [r for r in recs if r['id'] in want]

    store = os.path.join(OUT, 'candidates.json')
    done = {}
    if os.path.exists(store) and not a.refresh:
        done = {d['id']: d for d in json.load(open(store))}
        if a.retry_errors:
            done = {k: v for k, v in done.items() if not v.get('error')}
    todo = [r for r in recs if r['id'] not in done]
    if a.limit:
        todo = todo[:a.limit]

    print('%d already harvested, %d to fetch' % (len(done), len(todo)), flush=True)
    t0 = time.time()
    # as_completed, not map: a single slow site must not hold up saving
    # everything behind it, because chunked runs resume from what was saved.
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futures = {ex.submit(harvest, r): r['id'] for r in todo}
        i = 0
        for fut in cf.as_completed(futures):
            i += 1
            try:
                res = fut.result()
            except Exception as e:
                res = {'id': futures[fut], 'name': '', 'candidates': [],
                       'error': 'crash: %s' % str(e)[:60]}
            done[res['id']] = res
            if i % 10 == 0 or i == len(todo):
                json.dump(list(done.values()), open(store, 'w'), indent=1)
                print('  %d/%d  %.0fs  with candidates: %d'
                      % (i, len(todo), time.time() - t0,
                         sum(1 for d in done.values() if d.get('candidates'))), flush=True)
            if a.deadline and time.time() - t0 > a.deadline:
                print('  deadline reached — saving and stopping', flush=True)
                for f in futures:
                    f.cancel()
                break
    json.dump(list(done.values()), open(store, 'w'), indent=1)

    err = [d for d in done.values() if d.get('error')]
    none = [d for d in done.values() if not d.get('error') and not d['candidates']]
    print('\nharvested %d businesses' % len(done))
    print('  fetch failed      %d' % len(err))
    print('  no candidates     %d' % len(none))
    print('  usable            %d' % sum(1 for d in done.values() if d.get('candidates')))


if __name__ == '__main__':
    main()
