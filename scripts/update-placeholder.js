const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Expand search-wrapper max-width to 680px and font-size to 13px
html = html.replace(
  '.search-wrapper{position:relative;flex:1;max-width:560px;margin:0 16px}',
  '.search-wrapper{position:relative;flex:1;max-width:680px;margin:0 16px}'
);

html = html.replace(
  '#search { width: 100%; padding: 11px 85px 11px 42px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; outline: none; background: #fcfdfe; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: .2s; }',
  '#search { width: 100%; padding: 11px 82px 11px 38px; border: 1px solid var(--line); border-radius: 10px; font-size: 13px; outline: none; background: #fcfdfe; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: .2s; }'
);

// 2. Update placeholder text
const oldPlaceholder = `placeholder="Search makers, towns, or ask AI (e.g. 'woolen jumper from Scotland')..."`;
const newPlaceholder = `placeholder="Search makers, towns or whatever you're after (e.g. 'woolen jumper from Scotland')..."`;

html = html.replace(oldPlaceholder, newPlaceholder);

fs.writeFileSync(indexPath, html);
console.log('Successfully updated search input placeholder and width in index.html');
