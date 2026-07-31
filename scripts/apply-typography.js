const fs = require('fs');
const path = require('path');

const fontsLink = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />`;

const files = ['index.html', 'about.html', 'faqs.html', 'contact.html', 'submit.html'];

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Inject Google Fonts links into head if missing
  if (!html.includes('family=Cormorant+Garamond')) {
    html = html.replace('</head>', `${fontsLink}\n</head>`);
  }

  // 2. Update CSS Variables & typography
  if (!html.includes('--racing-green')) {
    html = html.replace(
      ':root{',
      `:root{\n    --racing-green:#004225; --font-heading:'Cormorant Garamond',Georgia,serif; --font-body:'Plus Jakarta Sans',-apple-system,sans-serif;\n    `
    );
  }

  html = html.replace(
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;',
    'font-family:var(--font-body);'
  );

  // Add heading font overrides if not present
  if (!html.includes('.brand-logo')) {
    const brandCss = `
  h1,h2,h3,.brand-logo,.g-title,.pop h3{font-family:var(--font-heading)}
  .brand-logo{font-family:var(--font-heading);font-size:25px;font-weight:700;color:var(--racing-green);letter-spacing:.2px;text-decoration:none;line-height:1;white-space:nowrap}
`;
    html = html.replace('</style>', `${brandCss}\n</style>`);
  }

  // 3. Replace Union Jack flag and old titles in header
  if (file === 'index.html') {
    // Replace flag-container
    const flagContainerRegex = /<div class="flag-container">[\s\S]*?<\/div>\s*<\/div>/;
    html = html.replace(flagContainerRegex, `<a href="index.html" class="brand-logo">Grown and Made UK</a>`);
  } else {
    // Replace flag div + site-title in subpages
    const subFlagRegex = /<div class="flag" aria-hidden="true">[\s\S]*?<\/div>/;
    html = html.replace(subFlagRegex, '');

    const subTitleRegex = /<h1 class="site-title"><a href="index.html">BUY <span>BRITISH<\/span><\/a><\/h1>/;
    html = html.replace(subTitleRegex, `<a href="index.html" class="brand-logo">Grown and Made UK</a>`);
  }

  fs.writeFileSync(filePath, html);
  console.log(`Successfully updated ${file}`);
});
