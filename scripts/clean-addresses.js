const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/businesses.json');
const businesses = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const counties = [
  "Gloucestershire", "East Sussex", "West Sussex", "Sussex", "North Yorkshire", "West Yorkshire", "South Yorkshire", "Yorkshire", "East Riding of Yorkshire", "West Midlands", "Suffolk", "Warwickshire", "Devon", "North Devon", "South Devon", "Cornwall", "Surrey", "Cambridgeshire", "Northumberland", "Somerset", "Dorset", "Cumbria", "Lancashire", "Moray", "Scottish Borders", "Carmarthenshire", "Ceredigion", "Fife", "Shropshire", "Denbighshire", "Buckinghamshire", "Nottinghamshire", "Leicestershire", "Oxfordshire", "Berkshire", "Kent", "Essex", "Wiltshire", "Hampshire", "Hertfordshire", "Northamptonshire", "Staffordshire", "Worcestershire", "Lincolnshire", "Norfolk", "Angus", "Aberdeenshire", "Dumfries & Galloway", "Dumfries and Galloway", "Perthshire", "Ross-shire", "Inverness-shire", "Isle of Lewis", "Isle of Wight", "Conwy", "Vale of Glamorgan", "Flintshire", "Powys", "Co. Antrim", "Co. Down", "Stockton-on-Tees", "Gwynedd", "Orkney", "Anglesey", "Peak District", "Cheshire", "Derbyshire", "Greater Manchester", "Merseyside", "Tyne & Wear", "Tyne and Wear", "Pembrokeshire", "Monmouthshire", "Highland", "Midlothian", "East Lothian", "West Lothian", "Stirlingshire", "Argyll & Bute", "Argyll and Bute", "Argyll", "Borders", "Clackmannanshire", "Renfrewshire", "Ayrshire", "North Ayrshire", "South Ayrshire", "East Ayrshire", "Lanarkshire", "South Lanarkshire", "North Lanarkshire", "Fermanagh", "Londonderry", "Tyrone", "Armagh", "Antrim", "Down", "Glamorgan", "County Durham"
];

function cleanAddressString(addr) {
  if (!addr) return "";
  let clean = addr;

  // 1. Remove bracketed text like (approximate), (online only), (manufacturing), etc.
  clean = clean.replace(/\([^)]*\)/gi, "").trim();

  // 2. Remove "Made in "
  clean = clean.replace(/^made in\s+/gi, "").trim();

  // 3. Remove UK full postcodes (e.g., E2 7JD, SW3 6HH, GL8 8JG, etc.)
  clean = clean.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "").trim();

  // 4. Clean trailing/leading commas, semicolons, dashes, and extra spaces
  clean = clean.replace(/^[,\s;\-]+|[,\s;\-]+$/g, "").replace(/,\s*,/g, ",");

  // 5. Split by comma or semicolon and clean parts
  let parts = clean.split(/[,;]/).map(p => p.trim()).filter(Boolean);

  // Filter out standalone postcode outcodes (like "N16", "SW1A", "WV2", "E1 6QR") from parts
  parts = parts.map(p => p.replace(/\b[A-Z]{1,2}\d[A-Z\d]?$/gi, "").trim()).filter(Boolean);

  // If we have multiple parts, filter out county names unless county is the ONLY part left
  if (parts.length > 1) {
    const nonCountyParts = parts.filter(p => {
      return !counties.some(c => c.toLowerCase() === p.toLowerCase());
    });
    if (nonCountyParts.length > 0) {
      parts = nonCountyParts;
    }
  }

  // Also remove "Scotland", "England", "Wales" if at the end of multi-part address
  if (parts.length > 1 && ["scotland", "england", "wales"].includes(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }

  return parts.join(", ").trim();
}

let modifiedCount = 0;
const results = businesses.map(b => {
  const oldAddr = b.address;
  const newAddr = cleanAddressString(oldAddr);
  if (oldAddr !== newAddr) {
    modifiedCount++;
    console.log(`[${b.id}]\n  BEFORE: "${oldAddr}"\n  AFTER:  "${newAddr}"`);
  }
  return { ...b, address: newAddr };
});

fs.writeFileSync(dataPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
console.log(`\nSuccessfully updated data/businesses.json. Modified ${modifiedCount} out of ${businesses.length} addresses.`);

