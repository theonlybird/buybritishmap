const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Update renderGrid to sort vis when not in AI search mode
const renderGridOld = `function renderGrid(){
  const vis = visible();
  if (state.aiActive) {`;

const renderGridNew = `function renderGrid(){
  const vis = visible();
  if (!state.aiActive) {
    vis.sort((a,b)=> state.sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  }
  if (state.aiActive) {`;

html = html.replace(renderGridOld, renderGridNew);

// 2. Remove legacy standalone sortBtn listener around line 788
const legacySortOld = `// Controls listeners
document.getElementById('sortBtn').addEventListener('click', () => {
  state.sortAsc = !state.sortAsc;
  document.getElementById('sortBtn').textContent = state.sortAsc ? 'A–Z ↓' : 'Z–A ↑';
  if (state.currentView === 'grid') renderGrid(); else renderMapList();
});`;

html = html.replace(legacySortOld, '// Controls listeners');

// 3. Update unified sort button listener
const sortSyncOld = `// Sort buttons sync
document.querySelectorAll('#sortBtn, .sortBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.sortAsc = !state.sortAsc;
    document.querySelectorAll('#sortBtn, .sortBtn').forEach(b => {
      b.textContent = state.sortAsc ? 'A–Z ↓' : 'Z–A ↑';
    });
    if (state.currentView === 'grid') renderGrid(); else renderMapList();
  });
});`;

const sortSyncNew = `// Sort buttons sync
document.querySelectorAll('#sortBtn, #gridSortBtn, .sortBtn, .btn-sort').forEach(btn => {
  btn.addEventListener('click', () => {
    state.sortAsc = !state.sortAsc;
    document.querySelectorAll('#sortBtn, #gridSortBtn, .sortBtn, .btn-sort').forEach(b => {
      b.textContent = state.sortAsc ? 'A–Z ↓' : 'Z–A ↑';
    });
    renderGrid();
    renderMapList();
  });
});`;

html = html.replace(sortSyncOld, sortSyncNew);

fs.writeFileSync(indexPath, html);
console.log('Successfully fixed Grid View A-Z sorting in index.html');
