const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Fix the broken countEl ternary line in index.html
html = html.replace(
  "countEl.innerHTML = `Found <b>${vis.length}</b> AI matching makers` : `Showing <b>${vis.length}</b> of ${BUSINESSES.length} businesses`;",
  "const countMsg = state.aiActive ? `Found <b>${vis.length}</b> AI matching makers` : `Showing <b>${vis.length}</b> of ${BUSINESSES.length} businesses`;\n  countEl.innerHTML = countMsg;\n  const gridCountEl = document.getElementById('gridCount');\n  if (gridCountEl) gridCountEl.innerHTML = countMsg;"
);

fs.writeFileSync(indexPath, html);
console.log('Fixed countEl ternary in index.html');
