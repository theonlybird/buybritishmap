const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Fix map sidebar HTML classes so cat-chips & tier-chips exist on both sidebars
html = html.replace('<div class="chips" id="catChips">', '<div class="chips cat-chips" id="catChips">');
html = html.replace('<div class="chips" id="tierChips">', '<div class="chips tier-chips" id="tierChips">');

// 2. Update CSS for Grid container to max 4 columns & btn-sort top right
const oldGridCss = `.grid-container { width: 100%; max-width: none; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }`;
const newGridCss = `.grid-container { width: 100%; max-width: none; margin: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .btn-sort { border: 1px solid var(--line); background: #fff; border-radius: 9px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: var(--navy); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.03); transition: .15s; white-space: nowrap; align-self: center; }
  .btn-sort:hover { border-color: var(--navy); background: var(--bg); }

  @media (max-width: 1400px) {
    .grid-container { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 1020px) {
    .grid-container { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .grid-container { grid-template-columns: 1fr; }
  }`;

html = html.replace(oldGridCss, newGridCss);

// 3. Move A-Z Sort button to top right of grid-header above grid
const gridHeaderOld = `<div class="grid-header">
          <div class="ai-banner" id="gridAiBanner">
            Here are some UK businesses we think you&rsquo;ll love
          </div>
        </div>`;

const gridHeaderNew = `<div class="grid-header">
          <div class="ai-banner" id="gridAiBanner">
            Here are some UK businesses we think you&rsquo;ll love
          </div>
          <button id="gridSortBtn" class="btn-sort sortBtn" title="Sort alphabetically">A–Z ↓</button>
        </div>`;

html = html.replace(gridHeaderOld, gridHeaderNew);

// Remove duplicate sort button from grid sidebar bottom countrow
const gridSidebarBottomOld = `<div class="countrow" style="margin-top:16px; padding:10px 0 0 0; border-top:1px solid var(--line); background:transparent;">
          <div class="count" id="gridCount"></div>
          <button class="sortBtn" title="Sort alphabetically">A–Z ↓</button>
        </div>`;

const gridSidebarBottomNew = `<div class="countrow" style="margin-top:16px; padding:10px 0 0 0; border-top:1px solid var(--line); background:transparent;">
          <div class="count" id="gridCount"></div>
        </div>`;

html = html.replace(gridSidebarBottomOld, gridSidebarBottomNew);

// 4. Update JS logic for chip click events, map list rendering, and sort buttons
const jsOldBlock = `function bindChipEvents() {
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
}`;

const jsNewBlock = `function bindChipEvents() {
  document.querySelectorAll('.cat-chips .chip').forEach(c => {
    c.addEventListener('click', () => {
      if (c.classList.contains('disabled')) return;
      chipClick(state.cats, ALL_CATS, c.dataset.cat);
      syncChips();
      renderMapList();
      renderGrid();
    });
  });

  document.querySelectorAll('.tier-chips .chip').forEach(c => {
    c.addEventListener('click', () => {
      if (c.classList.contains('disabled')) return;
      chipClick(state.tiers, ALL_TIERS, c.dataset.tier);
      syncChips();
      renderMapList();
      renderGrid();
    });
  });
}`;

html = html.replace(jsOldBlock, jsNewBlock);

fs.writeFileSync(indexPath, html);
console.log('Successfully updated map filters, max 4-column grid, and top-right A-Z sort button in index.html');
