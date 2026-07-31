const fs = require('fs');
const path = require('path');

const faviconLink = `<link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />`;

const pageTitles = {
  'index.html': 'Grown and Made UK',
  'about.html': 'About — Grown and Made UK',
  'faqs.html': 'FAQs — Grown and Made UK',
  'contact.html': 'Contact — Grown and Made UK',
  'submit.html': 'Suggest a Business — Grown and Made UK'
};

Object.entries(pageTitles).forEach(([file, newTitle]) => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // Replace title tag
  html = html.replace(/<title>.*?<\/title>/i, `<title>${newTitle}</title>`);

  // Add favicon link if not present
  if (!html.includes('assets/favicon.svg')) {
    html = html.replace('<head>', `<head>\n<link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />`);
  }

  fs.writeFileSync(filePath, html);
  console.log(`Updated ${file} -> Title: "${newTitle}" & favicon link`);
});
