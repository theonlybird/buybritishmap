const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Replace Grid CSS rules with full-width, 4-column desktop layout & mobile toggleable drawer
const oldCss = `  /* Grid Layout with Left Filter Sidebar */
  #gridView { position: absolute; inset: 0; background: var(--bg); overflow-y: auto; z-index: 900; display: none; padding: 24px; }
  .grid-layout { max-width: 1400px; margin: 0 auto; display: flex; gap: 24px; align-items: flex-start; }
  .grid-sidebar { width: 280px; min-width: 280px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); position: sticky; top: 0; }
  .grid-main { flex: 1; min-width: 0; }
  .grid-header { margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }

  @media (max-width: 860px) {
    .grid-layout { flex-direction: column; }
    .grid-sidebar { width: 100%; min-width: 0; position: static; }
  }`;

const newCss = `  /* Grid Layout with Left Filter Sidebar - Full Width 4-Column */
  #gridView { position: absolute; inset: 0; background: var(--bg); overflow-y: auto; z-index: 900; display: none; padding: 20px 24px; }
  .grid-layout { width: 100%; max-width: none; margin: 0; display: flex; gap: 20px; align-items: flex-start; }
  .grid-sidebar { width: 240px; min-width: 240px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); position: sticky; top: 0; }
  .grid-main { flex: 1; min-width: 0; }
  .grid-header { margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .grid-container { width: 100%; max-width: none; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }

  .mobile-filter-toggle { display: none; width: 100%; padding: 10px 14px; background: #fff; border: 1px solid var(--line); border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--navy); cursor: pointer; text-align: left; align-items: center; justify-content: space-between; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
  .mobile-filter-toggle svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; transition: transform 0.2s; }

  @media (max-width: 860px) {
    #gridView { padding: 14px; }
    .grid-layout { flex-direction: column; gap: 12px; }
    .grid-sidebar { width: 100%; min-width: 0; position: static; display: none; margin-bottom: 8px; }
    .grid-sidebar.open { display: block; }
    .mobile-filter-toggle { display: flex; }
  }`;

html = html.replace(oldCss, newCss);

// 2. Add mobile filter button above grid-header in grid-main
const mainOld = `<main class="grid-main">
        <div class="grid-header">`;

const mainNew = `<main class="grid-main">
        <button id="mobileFilterToggle" type="button" class="mobile-filter-toggle">
          <span>Filters &amp; Sort ⚙️</span>
          <svg viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="grid-header">`;

html = html.replace(mainOld, mainNew);

// 3. Add JS for mobile filter toggle
if (!html.includes('mobileFilterToggle')) {
  const jsToggle = `
// Mobile Grid Filter Toggle
const mobileFilterToggle = document.getElementById('mobileFilterToggle');
const gridSidebarEl = document.getElementById('gridSidebar');
if (mobileFilterToggle && gridSidebarEl) {
  mobileFilterToggle.addEventListener('click', () => {
    gridSidebarEl.classList.toggle('open');
    const isOpen = gridSidebarEl.classList.contains('open');
    const svg = mobileFilterToggle.querySelector('svg');
    if (svg) svg.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  });
}
`;
  html = html.replace('bindChipEvents();', `bindChipEvents();\n${jsToggle}`);
}

fs.writeFileSync(indexPath, html);
console.log('Successfully updated grid layout & mobile filter drawer in index.html');
