#!/usr/bin/env python3
"""Re-normalise logo files that are heavier than the 48px tile can justify.

    python3 scripts/renormalise-logos.py [--min-kb 100] [--dry-run] [--deadline 0]

apply-logo-choices.py normalises every logo it adopts (trim, long edge <=512px,
optimised PNG). Files that predate that step -- or were dropped into
assets/logos/ by hand -- never went through it, so assets/logos/ carries several
megabyte-scale PNGs that render at 46 pixels. This pass applies the same
normalisation to files already in place.

Two deliberate differences from apply-logo-choices.py:

  * Alpha is preserved whenever the source actually uses it, rather than being
    flattened onto white when logo_bg is unset. Flattening is a sound choice
    when first adopting a candidate; re-running it over live files would change
    how they composite, and this pass is only meant to remove weight.
  * SVG is skipped, including SVG hiding behind a .png extension (browsers sniff
    content, so those render fine and Pillow cannot open them anyway).

businesses.json is never touched: filenames and logo_bg stay as they are.
"""
import argparse, importlib.util, io, os, sys, time
from PIL import Image

# apply-logo-choices.py owns the trim: reuse it rather than keeping a second
# copy that can drift. The hyphens in its name stop a plain import.
_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    'apply_logo_choices', os.path.join(_HERE, 'apply-logo-choices.py'))
_alc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_alc)
trim, MAXDIM = _alc.trim, _alc.MAXDIM

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGOS = os.path.join(ROOT, 'assets', 'logos')


def is_svg(path):
    head = open(path, 'rb').read(400).lstrip()
    return head[:4] == b'<svg' or (head[:5] == b'<?xml' and b'<svg' in head)


def has_real_alpha(im):
    if im.mode not in ('RGBA', 'LA', 'P'):
        return False
    im = im.convert('RGBA')
    return min(im.split()[-1].getdata()) < 250


def encode(im):
    """PNG bytes, smallest of the lossless options.

    Metadata is dropped deliberately. Several files here are JPEGs behind a
    .png name and carry Photoshop/EXIF/ICC baggage -- william-lockie.png was a
    CMYK JPEG whose embedded colour profile alone was 639KB, against 211x110
    pixels of actual logo. None of it survives being drawn in a 46px tile.
    """
    im.info = {}
    out = io.BytesIO()
    im.save(out, 'PNG', optimize=True)
    best = out.getvalue()

    # A flat mark with <=256 distinct colours palettes losslessly, which is
    # usually a good deal smaller than truecolour. Gradients keep more than
    # 256 and are left alone rather than risking banding.
    if im.getcolors(maxcolors=256) is not None:
        try:
            pal = im.convert('P', palette=Image.ADAPTIVE, colors=256)
            pal.info = {}
            alt = io.BytesIO()
            if im.mode == 'RGBA':
                pal.save(alt, 'PNG', optimize=True, transparency=0)
            else:
                pal.save(alt, 'PNG', optimize=True)
            if len(alt.getvalue()) < len(best):
                best = alt.getvalue()
        except Exception:
            pass
    return best


def renormalise(path, dry_run=False):
    """Returns (before_kb, after_kb, note) or None if skipped."""
    before = os.path.getsize(path)
    if is_svg(path):
        return None
    if not path.lower().endswith('.png'):
        # businesses.json references these by name, so renaming them is a
        # separate job. Report rather than write PNG bytes into a .webp.
        return (before, before, 'skipped: not a .png filename')
    try:
        src = Image.open(path)
        src.load()
    except Exception as e:
        return (before, before, 'UNREADABLE: %s' % str(e)[:40])

    keep_alpha = has_real_alpha(src)
    im = src.convert('RGBA')
    im = trim(im)
    if not keep_alpha:
        im = im.convert('RGB')
    if max(im.size) > MAXDIM:
        s = MAXDIM / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))),
                       Image.LANCZOS)

    # Encode to memory and overwrite in place. No temp file: the FUSE mount
    # these folders arrive on refuses unlink, so a .tmp beside the original
    # could be written but never cleaned up.
    data = encode(im)
    after = len(data)

    if after >= before:
        return (before, before, 'already minimal, left alone')
    if not dry_run:
        with open(path, 'wb') as fh:
            fh.write(data)
    return (before, after, '%dx%d%s' % (im.width, im.height,
                                        ', alpha kept' if keep_alpha else ''))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--min-kb', type=int, default=100,
                    help='only touch files at least this large (default 100)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--deadline', type=float, default=0,
                    help='stop cleanly after N seconds (0 = no limit)')
    args = ap.parse_args()

    started = time.time()
    names = sorted(os.listdir(LOGOS))
    todo = [n for n in names
            if os.path.getsize(os.path.join(LOGOS, n)) >= args.min_kb * 1024]

    saved = done = skipped = 0
    for n in todo:
        if args.deadline and time.time() - started > args.deadline:
            print('-- deadline reached, %d of %d done' % (done, len(todo)))
            break
        r = renormalise(os.path.join(LOGOS, n), args.dry_run)
        if r is None:
            skipped += 1
            continue
        before, after, note = r
        done += 1
        saved += before - after
        if after < before:
            print('%-42s %6dKB -> %5dKB  %s'
                  % (n, before // 1024, after // 1024, note))
        else:
            print('%-42s %6dKB    --      %s' % (n, before // 1024, note))

    print('\n%d files rewritten, %d SVG skipped, %.1fMB saved%s'
          % (done, skipped, saved / 1048576, ' (dry run)' if args.dry_run else ''))


if __name__ == '__main__':
    main()
