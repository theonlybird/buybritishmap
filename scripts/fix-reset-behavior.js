const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const resetOld = `function resetSearchAndShowGrid() {
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

const resetNew = `function resetSearchAndShowGrid() {
  searchInput.value = '';
  state.q = '';
  state.aiActive = false;
  state.aiMatches.clear();
  state.aiHeadline = '';
  state.cats = new Set(ALL_CATS);
  state.tiers = new Set(ALL_TIERS);
  state.sortAsc = true;

  document.querySelectorAll('#sortBtn, #gridSortBtn, .sortBtn, .btn-sort').forEach(b => {
    b.textContent = 'A–Z ↓';
  });

  syncChips();
  toggleView(state.currentView);
  renderGrid();
  renderMapList();
}`;

html = html.replace(resetOld, resetNew);
fs.writeFileSync(indexPath, html);
console.log('Successfully updated Reset button behavior to preserve current view');
