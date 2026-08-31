#!/usr/bin/env python3
"""Render every drafted public tier reason for review.

    python3 scripts/build-note-review.py
    open .note-review/review.html

evidence_note is internal reasoning; the update portal shows the business its
own reason, so each one needs an outward-facing version Theo has actually read.
note_draft.py produces a mechanical first pass -- this page is where the
judgement happens.

Edit in place, mark each Approved, then Export. The file it downloads is
public-notes.json, which apply-note-choices.py writes into businesses.json as
a new `public_note` field. evidence_note is never modified: the internal
reasoning and the published sentence stay separate records of separate things.

Progress lives in localStorage, so the page survives being closed.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from note_draft import draft

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '.note-review')

rows = []
for r in json.load(open(os.path.join(ROOT, 'data', 'businesses.json'))):
    d = draft(r)
    rows.append({
        'id': r['id'], 'name': r['name'], 'tier': r['tier'],
        'cat': r.get('category', ''), 'conf': r.get('tier_confidence', ''),
        'internal': r.get('evidence_note', ''),
        'public': d['public'], 'ask': d['ask'], 'flags': d['flags'],
    })
rows.sort(key=lambda x: (not x['flags'], x['tier'] != 'silver', x['name']))

HTML = """<!doctype html><html><head><meta charset="utf-8">
<title>Tier reasons — review</title>
<style>
:root{--paper:#FAF7F0;--surface:#fff;--ink:#1E2621;--muted:#57544B;--line:#E4DCCB;
--green:#004225;--gold-bg:#F4EBD4;--gold-mark:#7D5F22;--silver-bg:#E7E9E6;--silver-mark:#3F4744;
--flag:#8C1D2C;--flag-bg:#F9EAEC;--brass:#8A6C2E}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
font:15px/1.55 Karla,-apple-system,system-ui,sans-serif}
header{position:sticky;top:0;background:var(--paper);border-bottom:1px solid var(--line);
padding:14px 22px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;z-index:5}
h1{font:500 21px/1.2 'Cormorant Garamond',Georgia,serif;margin:0 14px 0 0}
.count{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
button{font:600 13px Karla,sans-serif;padding:7px 14px;border:1px solid var(--line);
background:var(--surface);color:var(--ink);border-radius:3px;cursor:pointer}
button.primary{background:var(--green);color:#fff;border-color:var(--green)}
button.on{background:var(--green);color:#fff;border-color:var(--green)}
main{max-width:900px;margin:0 auto;padding:20px 22px 120px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:4px;
padding:16px 18px;margin-bottom:13px}
.card.done{opacity:.5}
.top{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-bottom:11px}
.nm{font-weight:700;font-size:15.5px}
.chip{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
padding:2px 8px;border-radius:2px}
.gold{background:var(--gold-bg);color:var(--gold-mark)}
.silver{background:var(--silver-bg);color:var(--silver-mark)}
.meta{font-size:12px;color:var(--muted)}
.flag{background:var(--flag-bg);color:var(--flag);font-size:10.5px;font-weight:700;
padding:2px 8px;border-radius:2px}
.lab{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--brass);
font-weight:700;margin:11px 0 5px}
.internal{font-size:13.5px;color:var(--muted);font-style:italic;line-height:1.5;
background:var(--paper);border-left:2px solid var(--line);padding:8px 11px}
textarea{width:100%;font:15px/1.5 Karla,sans-serif;color:var(--ink);background:var(--paper);
border:1px solid var(--line);border-radius:3px;padding:9px 11px;resize:vertical}
textarea.ask{font-size:14px}
.acts{display:flex;gap:8px;margin-top:12px;align-items:center}
.saved{font-size:12px;color:var(--green);font-weight:600}
</style></head><body>
<header>
  <h1>Tier reasons</h1>
  <span class="count" id="count"></span>
  <button id="f-all" class="on">All</button>
  <button id="f-flag">Needs a look</button>
  <button id="f-todo">Not yet approved</button>
  <button id="f-silver">Silver only</button>
  <span style="flex:1"></span>
  <button class="primary" id="export">Export public-notes.json</button>
</header>
<main id="list"></main>
<script>
const ROWS = __DATA__;
const KEY = 'gm-note-review-v1';
let state = JSON.parse(localStorage.getItem(KEY) || '{}');
let filter = 'all';

function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function cur(r){ return state[r.id] || {public:r.public, ask:r.ask, done:false}; }

function visible(){
  return ROWS.filter(r=>{
    const s = cur(r);
    if(filter==='flag')   return r.flags.length;
    if(filter==='todo')   return !s.done;
    if(filter==='silver') return r.tier==='silver';
    return true;
  });
}

function render(){
  const list = document.getElementById('list');
  list.innerHTML = '';
  for(const r of visible()){
    const s = cur(r);
    const el = document.createElement('div');
    el.className = 'card' + (s.done?' done':'');
    el.innerHTML =
      '<div class="top"><span class="nm"></span>'
      + '<span class="chip '+r.tier+'">'+r.tier+'</span>'
      + '<span class="meta">'+r.cat+' &middot; '+r.conf+'</span>'
      + r.flags.map(f=>'<span class="flag"></span>').join('')
      + '</div>'
      + '<div class="lab">Your internal note</div><div class="internal"></div>'
      + '<div class="lab">What the business will see</div>'
      + '<textarea rows="3" class="pub"></textarea>'
      + (r.tier==='silver'
          ? '<div class="lab">The question we ask them</div><textarea rows="2" class="ask"></textarea>'
          : '')
      + '<div class="acts"><button class="ok">'+(s.done?'Approved':'Approve')+'</button>'
      + '<button class="reset">Reset to draft</button><span class="saved"></span></div>';
    el.querySelector('.nm').textContent = r.name;
    el.querySelector('.internal').textContent = r.internal;
    el.querySelectorAll('.flag').forEach((n,i)=>n.textContent = r.flags[i]);
    const pub = el.querySelector('.pub'); pub.value = s.public;
    const ask = el.querySelector('textarea.ask'); if(ask) ask.value = s.ask || '';
    const note = el.querySelector('.saved');
    function touch(){
      state[r.id] = {public:pub.value, ask:ask?ask.value:'', done:(state[r.id]||{}).done||false};
      save(); note.textContent = 'saved'; setTimeout(()=>note.textContent='',900);
    }
    pub.addEventListener('input', touch);
    if(ask) ask.addEventListener('input', touch);
    el.querySelector('.ok').addEventListener('click',()=>{
      state[r.id] = {public:pub.value, ask:ask?ask.value:'', done:!s.done};
      save(); render();
    });
    el.querySelector('.reset').addEventListener('click',()=>{
      state[r.id] = {public:r.public, ask:r.ask, done:false}; save(); render();
    });
    list.appendChild(el);
  }
  const done = ROWS.filter(r=>cur(r).done).length;
  document.getElementById('count').textContent =
    done+' of '+ROWS.length+' approved  ·  '+ROWS.filter(r=>r.flags.length).length+' need a look';
}

for(const [id,f] of [['f-all','all'],['f-flag','flag'],['f-todo','todo'],['f-silver','silver']]){
  document.getElementById(id).addEventListener('click',e=>{
    filter=f;
    document.querySelectorAll('header button').forEach(b=>b.classList.remove('on'));
    e.target.classList.add('on'); render();
  });
}
document.getElementById('export').addEventListener('click',()=>{
  const out = {};
  for(const r of ROWS){ const s=cur(r); if(s.done) out[r.id]={public_note:s.public, tier_question:s.ask||''}; }
  const n = Object.keys(out).length;
  if(!n){ alert('Nothing approved yet.'); return; }
  const b = new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href=URL.createObjectURL(b); a.download='public-notes.json'; a.click();
});
render();
</script></body></html>"""

os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, 'review.html')
open(path, 'w').write(HTML.replace('__DATA__', json.dumps(rows, ensure_ascii=False)))
flagged = sum(1 for r in rows if r['flags'])
print('%s\n%d records, %d flagged for attention, %d clean'
      % (path, len(rows), flagged, len(rows) - flagged))
