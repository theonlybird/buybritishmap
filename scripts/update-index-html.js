const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Update CSS: search input padding, btn-reset, chip disabled, grid-layout & grid-sidebar
const cssToInsert = `
  .search-input-box { position: relative; display: flex; align-items: center; }
  #search { width: 100%; padding: 11px 85px 11px 42px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; outline: none; background: #fcfdfe; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: .2s; }
  .btn-reset { position: absolute; right: 6px; background: var(--navy); color: #fff; border: none; padding: 6px 11px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: .15s; z-index: 2; }
  .btn-reset:hover { background: var(--red); }
  .chip.disabled { opacity: 0.35; pointer-events: none; filter: grayscale(0.85); cursor: not-allowed; }

  /* Grid Layout with Left Filter Sidebar */
  #gridView { position: absolute; inset: 0; background: var(--bg); overflow-y: auto; z-index: 900; display: none; padding: 24px; }
  .grid-layout { max-width: 1400px; margin: 0 auto; display: flex; gap: 24px; align-items: flex-start; }
  .grid-sidebar { width: 280px; min-width: 280px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); position: sticky; top: 0; }
  .grid-main { flex: 1; min-width: 0; }
  .grid-header { margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }

  @media (max-width: 860px) {
    .grid-layout { flex-direction: column; }
    .grid-sidebar { width: 100%; min-width: 0; position: static; }
  }
`;

// Replace CSS definitions in <style>
html = html.replace(/#search\{width:100%;padding:11px 14px 11px 42px;[^}]+\}/, '#search{width:100%;padding:11px 85px 11px 42px;border:1px solid var(--line);border-radius:10px;font-size:14px;outline:none;background:#fcfdfe;box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:.2s}');

if (!html.includes('.btn-reset')) {
  html = html.replace('</style>', `${cssToInsert}\n</style>`);
}

// 2. Add Reset Button inside search-input-box
const searchBoxOld = `<div class="search-input-box">
      <svg viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input id="search" type="text" placeholder="Search makers, towns, or ask AI (e.g. 'woolen jumper from Scotland')..." autocomplete="off" />
    </div>`;

const searchBoxNew = `<div class="search-input-box">
      <svg viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input id="search" type="text" placeholder="Search makers, towns, or ask AI (e.g. 'woolen jumper from Scotland')..." autocomplete="off" />
      <button id="resetBtn" type="button" class="btn-reset" title="Reset search & filters">✕ Reset</button>
    </div>`;

html = html.replace(searchBoxOld, searchBoxNew);

// 3. Update Grid View markup to include Left Sidebar
const gridViewOld = `  <!-- Full Page Grid Results View -->
  <div id="gridView">
    <div class="grid-header">
      <div class="ai-banner" id="gridAiBanner">
        Here are some UK businesses we think you&rsquo;ll love
      </div>
    </div>
    <div class="grid-container" id="gridCards"></div>
  </div>`;

const gridViewNew = `  <!-- Full Page Grid Results View -->
  <div id="gridView">
    <div class="grid-layout">
      <aside id="gridSidebar" class="grid-sidebar">
        <div class="controls" style="padding:0; border-bottom:none;">
          <div class="filter-group">
            <div class="lbl">Category</div>
            <div class="chips cat-chips" id="gridCatChips">
              <span class="chip active" data-cat="farm"><span class="dot" style="background:var(--farm)"></span>Farm shops</span>
              <span class="chip active" data-cat="clothing"><span class="dot" style="background:var(--clothing)"></span>Clothing</span>
              <span class="chip active" data-cat="ceramics"><span class="dot" style="background:var(--ceramics)"></span>Ceramics</span>
              <span class="chip active" data-cat="jewellery"><span class="dot" style="background:var(--jewellery)"></span>Jewellery &amp; Watches</span>
              <span class="chip active" data-cat="cutlery"><span class="dot" style="background:var(--cutlery)"></span>Cutlery &amp; Cookware</span>
            </div>
          </div>
          <div class="filter-group" style="margin-top:14px;">
            <div class="lbl">Standard</div>
            <div class="chips tier-chips" id="gridTierChips">
              <span class="chip tier-gold active" data-tier="gold"><span class="dot" style="background:var(--gold)"></span>Gold</span>
              <span class="chip tier-silver active" data-tier="silver"><span class="dot" style="background:var(--silver)"></span>Silver</span>
            </div>
          </div>
        </div>
        <div class="countrow" style="margin-top:16px; padding:10px 0 0 0; border-top:1px solid var(--line); background:transparent;">
          <div class="count" id="gridCount"></div>
          <button class="sortBtn" title="Sort alphabetically">A–Z ↓</button>
        </div>
      </aside>
      <main class="grid-main">
        <div class="grid-header">
          <div class="ai-banner" id="gridAiBanner">
            Here are some UK businesses we think you&rsquo;ll love
          </div>
        </div>
        <div class="grid-container" id="gridCards"></div>
      </main>
    </div>
  </div>`;

html = html.replace(gridViewOld, gridViewNew);

// 4. Update JS logic for chip click, syncChips, greying out, and reset button
const jsOld = `const ALL_CATS = ['farm','clothing','ceramics','jewellery','cutlery'];
const ALL_TIERS = ['gold','silver'];
function chipClick(set, all, key){
  if (state.aiActive) clearAiSearch();
  if (set.size === all.length) { set.clear(); set.add(key); }
  else if (set.has(key)) { set.delete(key); if (set.size === 0) all.forEach(k => set.add(k)); }
  else { set.add(key); }
}
function syncChips(){
  document.querySelectorAll('#catChips .chip').forEach(c => c.classList.toggle('active', state.cats.has(c.dataset.cat)));
  document.querySelectorAll('#tierChips .chip').forEach(c => c.classList.toggle('active', state.tiers.has(c.dataset.tier)));
}
document.querySelectorAll('#catChips .chip').forEach(c => c.addEventListener('click', () => {
  chipClick(state.cats, ALL_CATS, c.dataset.cat); syncChips(); if (state.currentView==='grid') renderGrid(); else renderMapList();
}));
document.querySelectorAll('#tierChips .chip').forEach(c => c.addEventListener('click', () => {
  chipClick(state.tiers, ALL_TIERS, c.dataset.tier); syncChips(); if (state.currentView==='grid') renderGrid(); else renderMapList();
}));`;

const jsNew = `const ALL_CATS = ['farm','clothing','ceramics','jewellery','cutlery'];
const ALL_TIERS = ['gold','silver'];

function chipClick(set, all, key){
  if (set.size === all.length) { set.clear(); set.add(key); }
  else if (set.has(key)) { set.delete(key); if (set.size === 0) all.forEach(k => set.add(k)); }
  else { set.add(key); }
}

function syncChips(){
  // Determine relevant categories & tiers from search matches if search is active
  let relevantCats = null;
  let relevantTiers = null;

  const searchIsActive = Boolean(state.q.trim() || state.aiActive);
  if (searchIsActive) {
    let pool = [];
    if (state.aiActive) {
      pool = BUSINESSES.filter(b => state.aiMatches.has(b.id));
    } else {
      const q = state.q.trim().toLowerCase();
      pool = BUSINESSES.filter(b => (b.name+' '+b.town+' '+(b.subcategory||'')+' '+b.category+' '+(b.description||'')).toLowerCase().includes(q));
    }
    relevantCats = new Set(pool.map(b => b.category));
    relevantTiers = new Set(pool.map(b => b.tier));
  }

  document.querySelectorAll('.cat-chips .chip').forEach(c => {
    const cat = c.dataset.cat;
    c.classList.toggle('active', state.cats.has(cat));
    if (searchIsActive && relevantCats && !relevantCats.has(cat)) {
      c.classList.add('disabled');
    } else {
      c.classList.remove('disabled');
    }
  });

  document.querySelectorAll('.tier-chips .chip').forEach(c => {
    const tier = c.dataset.tier;
    c.classList.toggle('active', state.tiers.has(tier));
    if (searchIsActive && relevantTiers && !relevantTiers.has(tier)) {
      c.classList.add('disabled');
    } else {
      c.classList.remove('disabled');
    }
  });
}

function bindChipEvents() {
  document.querySelectorAll('.cat-chips .chip').forEach(c => {
    c.addEventListener('click', () => {
      if (c.classList.contains('disabled')) return;
      chipClick(state.cats, ALL_CATS, c.dataset.cat);
      syncChips();
      if (state.currentView === 'grid') renderGrid(); else renderMapList();
    });
  });

  document.querySelectorAll('.tier-chips .chip').forEach(c => {
    c.addEventListener('click', () => {
      if (c.classList.contains('disabled')) return;
      chipClick(state.tiers, ALL_TIERS, c.dataset.tier);
      syncChips();
      if (state.currentView === 'grid') renderGrid(); else renderMapList();
    });
  });
}
bindChipEvents();

// Sort buttons sync
document.querySelectorAll('#sortBtn, .sortBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.sortAsc = !state.sortAsc;
    document.querySelectorAll('#sortBtn, .sortBtn').forEach(b => {
      b.textContent = state.sortAsc ? 'A–Z ↓' : 'Z–A ↑';
    });
    if (state.currentView === 'grid') renderGrid(); else renderMapList();
  });
});

// Reset Button Handler
const resetBtn = document.getElementById('resetBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', resetSearchAndShowGrid);
}

function resetSearchAndShowGrid() {
  searchInput.value = '';
  state.q = '';
  state.aiActive = false;
  state.aiMatches.clear();
  state.aiHeadline = '';
  state.cats = new Set(ALL_CATS);
  state.tiers = new Set(ALL_TIERS);
  state.sortAsc = true;

  document.querySelectorAll('#sortBtn, .sortBtn').forEach(b => {
    b.textContent = 'A–Z ↓';
  });

  syncChips();
  toggleView('grid');
  renderGrid();
  renderMapList();
}`;

html = html.replace(jsOld, jsNew);

// 5. Update renderMapList and renderGrid count elements
html = html.replace("countEl.innerHTML = state.aiActive ?", `syncChips();
  const gridCountEl = document.getElementById('gridCount');
  const countText = state.aiActive ? \`Found <b>\${vis.length}</b> AI matching makers\` : \`Showing <b>\${vis.length}</b> of \${BUSINESSES.length} businesses\`;
  if (gridCountEl) gridCountEl.innerHTML = countText;
  countEl.innerHTML =`);

fs.writeFileSync(indexPath, html);
console.log('Successfully updated index.html');
