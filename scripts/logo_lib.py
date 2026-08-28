"""Shared logo classification for the Grown and Made map.

Logos render in a 40-48px square tile with object-fit:contain on white
(see logoHtml() in index.html), so the tests here are about how a file
behaves at that size, not about how it looks at full resolution.
"""
import os
from collections import Counter
from PIL import Image

# How a file's pixel dimensions betray where it was taken from.
OG_SIZES = {(1200, 628), (1200, 630), (1200, 675), (1920, 1005)}
ICON_EDGES = {16, 32, 48, 57, 64, 76, 96, 114, 120, 128, 152, 167, 180, 192, 256, 512}


def provenance(w, h, fmt):
    if fmt == 'SVG':
        return 'vector'
    if (w, h) in OG_SIZES:
        return 'og-banner'
    if w == h and w in ICON_EDGES:
        return 'favicon'
    return 'logofile'


def measure(path):
    """Return (verdict, info). Verdict is one of:
    OK, VECTOR, EMPTY, INVISIBLE_ON_WHITE, DARK_BOX, PHOTO, TINY, UNREADABLE.
    """
    kb = max(1, os.path.getsize(path) // 1024)
    # Pillow can't open SVG, and plenty of files here are SVG behind a .png
    # extension (browsers sniff content, so they render fine). Sniff first.
    head = open(path, 'rb').read(400).lstrip()
    if head[:4] == b'<svg' or (head[:5] == b'<?xml' and b'<svg' in head):
        return 'VECTOR', {'fmt': 'SVG', 'w': 0, 'h': 0, 'kb': kb, 'prov': 'vector'}

    try:
        im = Image.open(path)
    except Exception as e:
        return 'UNREADABLE', {'err': str(e)[:60], 'kb': kb}

    fmt = im.format
    w, h = im.size
    info = {'fmt': fmt, 'w': w, 'h': h, 'kb': kb, 'prov': provenance(w, h, fmt)}

    im2 = im.convert('RGBA')
    if max(w, h) > 320:                     # sample, don't grind
        s = 320 / max(w, h)
        im2 = im2.resize((max(1, int(w * s)), max(1, int(h * s))))
    px = list(im2.getdata())
    n = len(px)
    opaque = [p for p in px if p[3] > 128]
    if not opaque:
        return 'EMPTY', info

    lum = [0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] for p in opaque]
    mean_lum = sum(lum) / len(lum)
    transparent = sum(1 for p in px if p[3] < 128) / n
    # Share of the tile that reads as blank once transparency is composited on white.
    white = sum(1 for p in px if p[3] < 128 or (p[0] > 238 and p[1] > 238 and p[2] > 238)) / n
    q = Counter((p[0] // 24, p[1] // 24, p[2] // 24) for p in opaque)
    colours = len(q)
    dom = q.most_common(1)[0][1] / len(opaque)
    info.update(lum=int(mean_lum), transparent=round(transparent, 2),
                white=round(white, 2), colours=colours, dom=round(dom, 2))

    if max(w, h) < 60:
        return 'TINY', info
    if transparent > 0.30 and mean_lum > 200:
        return 'INVISIBLE_ON_WHITE', info
    if transparent < 0.05 and white < 0.10 and mean_lum < 110:
        return 'DARK_BOX', info
    if colours > 380 and white < 0.25 and dom < 0.22:
        return 'PHOTO', info
    if colours > 700 and white < 0.45:
        return 'PHOTO', info
    return 'OK', info


BAD = {'MISSING', 'PLACEHOLDER', 'EMPTY', 'INVISIBLE_ON_WHITE', 'PHOTO', 'TINY', 'UNREADABLE'}


def score(verdict, info, source_rank):
    """Higher is better. source_rank: 0 = declared logo, 4 = og:image."""
    if verdict in ('UNREADABLE', 'EMPTY'):
        return -100
    s = 100.0
    s -= source_rank * 12                       # trust where it came from
    if verdict == 'VECTOR':
        return s + 45                           # nothing beats vector at 48px
    w, h = info['w'], info['h']
    if verdict == 'PHOTO':
        s -= 60
    if verdict == 'TINY':
        s -= 40
    if verdict == 'INVISIBLE_ON_WHITE':
        s -= 25          # usable on a dark tile, but a dark-on-light version is better
    if verdict == 'DARK_BOX':
        s -= 6
    if info.get('prov') == 'og-banner':
        s -= 35
    if info.get('prov') == 'favicon':
        s -= 8
    long_edge = max(w, h)
    if long_edge < 100:
        s -= 25
    elif long_edge < 200:
        s -= 8
    elif long_edge > 2400:
        s -= 4                                  # needless weight
    ratio = long_edge / max(1, min(w, h))
    if ratio > 6:
        s -= 20                                 # illegible in a square tile
    elif ratio > 4:
        s -= 8
    s += min(info.get('white', 0), 0.75) * 20   # real marks carry whitespace
    if info.get('transparent', 0) > 0.2:
        s += 8
    if info.get('colours', 0) > 300:
        s -= 12
    return round(s, 1)
