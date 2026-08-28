#!/usr/bin/env python3
"""Turn the harvest into one page a human can approve at a glance.

    python3 scripts/build-logo-review.py
    open .logo-harvest/review.html

Every candidate is shown at the 48px it will actually be rendered at, on
both a white and a dark tile, next to the logo currently in use. Pick one
per business (or keep the current one), then download choices.json and run:

    python3 scripts/apply-logo-choices.py .logo-harvest/choices.json

Rows are ordered worst-first, so stopping half way still leaves the map
better than it was.
"""
import html, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo_lib import measure

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '.logo-harvest')
SHOW = 6

# Worst first: the rows where the map is visibly broken come before the
# rows where it is merely improvable.
PRIORITY = {'MISSING': 0, 'PLACEHOLDER': 0, 'EMPTY': 0, 'INVISIBLE_ON_WHITE': 1,
            'PHOTO': 2, 'TINY': 3, 'UNREADABLE': 3, 'DARK_BOX': 5, 'OK': 6, 'VECTOR': 7}
SOURCE_LABEL = {'jsonld': 'declared logo', 'logo-img': 'header “logo” image',
                'header-img': 'masthead image', 'touch-icon': 'touch icon',
                'shopify': 'store CDN', 'icon': 'favicon', 'og': 'social banner'}


def current_of(rec):
    rel = rec.get('logo') or 'assets/logos/%s.png' % rec['id']
    if 'placeholder' in rel:
        return None, 'PLACEHOLDER', {}
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        return None, 'MISSING', {}
    v, i = measure(p)
    return os.path.relpath(p, OUT), v, i


def tile(src, dark=False):
    bg = '#20262b' if dark else '#ffffff'
    return ('<span class="tile" style="background:%s"><img src="%s" alt=""></span>' % (bg, src))


def main():
    data = json.load(open(os.path.join(ROOT, 'data/businesses.json'), encoding='utf-8'))
    recs = {r['id']: r for r in (data if isinstance(data, list) else data['businesses'])}
    harvest = {d['id']: d for d in json.load(open(os.path.join(OUT, 'candidates.json')))}

    rows = []
    for rid, rec in recs.items():
        cur_src, cur_verdict, cur_info = current_of(rec)
        h = harvest.get(rid, {})
        cands = [c for c in h.get('candidates', []) if c['score'] > -20][:SHOW]
        prio = PRIORITY.get(cur_verdict, 6)
        if cur_info.get('prov') == 'og-banner':
            prio = min(prio, 4)
        rows.append({'id': rid, 'name': rec['name'],
                     'town': rec.get('town', ''), 'website': rec.get('website', ''),
                     'cur': cur_src, 'verdict': cur_verdict,
                     'cur_dim': ('%sx%s' % (cur_info.get('w'), cur_info.get('h'))
                                 if cur_info.get('w') else ''),
                     'prio': prio, 'error': h.get('error', ''),
                     'cands': cands})
    rows.sort(key=lambda r: (r['prio'], -len(r['cands']), r['name'].lower()))

    parts = []
    for r in rows:
        cur = (tile(r['cur']) if r['cur'] else
               '<span class="tile empty">none</span>')
        cards = []
        for n, c in enumerate(r['cands']):
            i = c['info']
            src = os.path.relpath(os.path.join(ROOT, c['file']), OUT)
            flags = []
            if c['verdict'] == 'INVISIBLE_ON_WHITE':
                flags.append('<b class="warn">white artwork</b>')
            if c['verdict'] == 'PHOTO':
                flags.append('<b class="warn">photo</b>')
            if i.get('prov') == 'og-banner':
                flags.append('<b class="warn">social banner</b>')
            if c.get('offsite'):
                flags.append('<b class="warn">off-site</b>')
            if c['verdict'] == 'VECTOR':
                flags.append('<b class="good">vector</b>')
            cards.append(
                '<label class="cand"><input type="radio" name="%s" value="%s">'
                '<span class="card">%s%s'
                '<span class="full"><img src="%s" alt=""></span>'
                '<span class="meta">%s · %s%s</span></span></label>'
                % (r['id'], html.escape(c['file']), tile(src), tile(src, True), src,
                   SOURCE_LABEL.get(c['source'], c['source']),
                   'vector' if c['verdict'] == 'VECTOR' else '%s×%s' % (i.get('w'), i.get('h')),
                   (' · ' + ' '.join(flags)) if flags else ''))
        if not cards:
            cards.append('<p class="none">No candidates found%s — needs a manual look.</p>'
                         % (' (%s)' % html.escape(r['error']) if r['error'] else ''))
        parts.append(
            '<section class="row" data-id="%s" data-prio="%d">'
            '<div class="head"><h2>%s</h2>'
            '<span class="sub">%s%s</span>'
            '<span class="tag t%d">%s</span>'
            '<a href="%s" target="_blank" rel="noopener">site ↗</a></div>'
            '<div class="strip"><div class="cur"><span class="lab">now</span>%s'
            '<span class="dim">%s</span></div>'
            '<div class="cands">%s</div>'
            '<label class="keep"><input type="radio" name="%s" value="" checked>keep</label>'
            '</div></section>'
            % (r['id'], r['prio'], html.escape(r['name']),
               html.escape(r['town']), (' · ' + html.escape(r['website'][:52])) if r['website'] else '',
               r['prio'], r['verdict'].replace('_', ' ').lower(),
               html.escape(r['website'] or '#'), cur, r['cur_dim'],
               ''.join(cards), r['id']))

    doc = TEMPLATE.replace('{{ROWS}}', '\n'.join(parts)).replace('{{COUNT}}', str(len(rows)))
    path = os.path.join(OUT, 'review.html')
    open(path, 'w', encoding='utf-8').write(doc)
    print('wrote %s  (%d businesses, %d with candidates)'
          % (path, len(rows), sum(1 for r in rows if r['cands'])))


TEMPLATE = r"""<!doctype html>
<meta charset="utf-8"><title>Logo review — Grown and Made UK</title>
<style>
:root{--paper:#FAF6EE;--line:#e2ddd2;--ink:#1C2620;--green:#004225;--warn:#a03a1e}
*{box-sizing:border-box}
body{margin:0;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;
     background:var(--paper);color:var(--ink);padding-bottom:78px}
header.top{position:sticky;top:0;z-index:5;background:var(--paper);
     border-bottom:1px solid var(--line);padding:12px 18px;display:flex;
     gap:14px;align-items:center;flex-wrap:wrap}
h1{font-size:16px;margin:0;font-weight:600;color:var(--green)}
.row{border-bottom:1px solid var(--line);padding:12px 18px}
.head{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
h2{font-size:15px;margin:0;font-weight:600}
.sub{color:#6b6b63;font-size:12px}
.head a{font-size:12px;color:var(--green)}
.tag{font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;
     border-radius:3px;background:#ececea;color:#55554e}
.t0,.t1{background:#f6dfd7;color:#8e3418}.t2,.t3{background:#f7eeda;color:#7a5a12}
.t4,.t5{background:#e9eef2;color:#39505f}
.strip{display:flex;gap:14px;align-items:flex-start;margin-top:9px;flex-wrap:wrap}
.cur{text-align:center;flex:0 0 auto}
.lab,.dim{display:block;font-size:10px;color:#8a8a80;letter-spacing:.05em}
.cands{display:flex;gap:9px;flex-wrap:wrap;flex:1 1 420px}
.tile{width:48px;height:48px;border:1px solid var(--line);border-radius:4px;
      display:inline-flex;align-items:center;justify-content:center;overflow:hidden;
      margin:1px}
.tile img{width:100%;height:100%;object-fit:contain}
.tile.empty{background:#fff;color:#c0bcb2;font-size:9px}
.cand input{position:absolute;opacity:0}
.card{display:block;border:1px solid var(--line);border-radius:6px;padding:6px;
      background:#fff;cursor:pointer;text-align:center;min-width:112px}
.cand input:checked + .card{border-color:var(--green);box-shadow:0 0 0 2px rgba(0,66,37,.18)}
.full{display:block;height:52px;margin:5px 0;background:#fff;border-top:1px dashed var(--line);
      padding-top:5px}
.full img{max-width:150px;height:46px;width:auto;object-fit:contain}
.meta{display:block;font-size:10px;color:#77776e;max-width:170px}
.warn{color:var(--warn);font-weight:600}
.good{color:var(--green);font-weight:600}
.none{color:#8a8a80;font-size:12px;margin:6px 0}
.keep{align-self:center;font-size:12px;color:#6b6b63;cursor:pointer;white-space:nowrap}
footer{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--line);
       padding:11px 18px;display:flex;gap:12px;align-items:center;font-size:13px}
button{font:inherit;padding:7px 13px;border-radius:5px;border:1px solid var(--green);
       background:var(--green);color:#fff;cursor:pointer}
button.ghost{background:#fff;color:var(--green)}
#count{font-variant-numeric:tabular-nums;font-weight:600}
label.f{font-size:12px;color:#55554e}
</style>
<header class="top">
  <h1>Logo review — {{COUNT}} businesses</h1>
  <label class="f"><input type="checkbox" id="onlyBad" checked> only rows needing work</label>
  <label class="f"><input type="checkbox" id="hideDone"> hide ones I've chosen</label>
</header>
{{ROWS}}
<footer>
  <span><span id="count">0</span> chosen</span>
  <button id="save">Download choices.json</button>
  <button class="ghost" id="clear">Reset</button>
  <span class="f">Then: <code>python3 scripts/apply-logo-choices.py .logo-harvest/choices.json</code></span>
</footer>
<script>
const KEY='gm-logo-choices';
let picks={};
try{picks=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){picks={}}

function refresh(){
  document.getElementById('count').textContent=Object.keys(picks).length;
  const onlyBad=document.getElementById('onlyBad').checked;
  const hideDone=document.getElementById('hideDone').checked;
  document.querySelectorAll('.row').forEach(r=>{
    const bad=+r.dataset.prio<=4, done=!!picks[r.dataset.id];
    r.style.display=((onlyBad&&!bad)||(hideDone&&done))?'none':'';
  });
}
document.querySelectorAll('input[type=radio]').forEach(i=>{
  if(picks[i.name]===i.value) i.checked=true;
  i.addEventListener('change',()=>{
    if(i.value) picks[i.name]=i.value; else delete picks[i.name];
    try{localStorage.setItem(KEY,JSON.stringify(picks))}catch(e){}
    refresh();
  });
});
document.getElementById('onlyBad').addEventListener('change',refresh);
document.getElementById('hideDone').addEventListener('change',refresh);
document.getElementById('clear').addEventListener('click',()=>{
  picks={};try{localStorage.removeItem(KEY)}catch(e){}
  document.querySelectorAll('input[value=""]').forEach(i=>i.checked=true);refresh();
});
document.getElementById('save').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(picks,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='choices.json';a.click();
});
refresh();
</script>
"""

if __name__ == '__main__':
    main()
