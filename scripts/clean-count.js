const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const oldBlock = `  syncChips();
  const gridCountEl = document.getElementById('gridCount');
  const countText = state.aiActive ? \`Found <b>\${vis.length}</b> AI matching makers\` : \`Showing <b>\${vis.length}</b> of \${BUSINESSES.length} businesses\`;
  if (gridCountEl) gridCountEl.innerHTML = countText;
  const countMsg = state.aiActive ? \`Found <b>\${vis.length}</b> AI matching makers\` : \`Showing <b>\${vis.length}</b> of \${BUSINESSES.length} businesses\`;
  countEl.innerHTML = countMsg;
  const gridCountEl = document.getElementById('gridCount');
  if (gridCountEl) gridCountEl.innerHTML = countMsg;`;

const newBlock = `  syncChips();
  const countText = state.aiActive ? \`Found <b>\${vis.length}</b> AI matching makers\` : \`Showing <b>\${vis.length}</b> of \${BUSINESSES.length} businesses\`;
  countEl.innerHTML = countText;
  const gridCountEl = document.getElementById('gridCount');
  if (gridCountEl) gridCountEl.innerHTML = countText;`;

html = html.replace(oldBlock, newBlock);
fs.writeFileSync(indexPath, html);
console.log('Successfully cleaned index.html');
