/**
 * UK nations and counties, derived from the address text already on record.
 *
 * Why not coordinates
 *
 * Every listing has lat/lng, so classifying by latitude looks like the obvious
 * route. It isn't: the borders are where it matters and where it fails.
 * Carlisle (54.88), Hawick (55.42) and Bardon Mill in Northumberland (54.98)
 * interleave, so no latitude separates Cumbria from the Scottish Borders.
 * Shropshire and Powys have the same problem. A rule that confidently files a
 * Cumbrian maker under Scotland is exactly the sort of quiet error this
 * directory cannot afford.
 *
 * County names, by contrast, are unambiguous and already written down —
 * "Tibbermore, Perthshire", "Sarnau, Ceredigion", "Downpatrick, Co. Down". So
 * the county is read from the text and the nation follows from the county.
 * Coordinates are kept, but only as a CROSS-CHECK: if the text says England and
 * the point is north of the Highland line, that is a gap in this table and it
 * gets reported rather than silently accepted.
 *
 * Order matters within each list only for multi-word entries, which must
 * precede any shorter entry they contain.
 */

// Longest / most specific first, so "north wales" is not shadowed by "wales"
// and "co. down" is not matched as part of another word.
const COUNTIES = {
  'Northern Ireland': [
    'co. antrim', 'co antrim', 'county antrim', 'antrim',
    'co. armagh', 'co armagh', 'county armagh', 'armagh',
    'co. down', 'co down', 'county down',
    'co. fermanagh', 'co fermanagh', 'fermanagh',
    'co. londonderry', 'co londonderry', 'londonderry', 'derry',
    'co. tyrone', 'co tyrone', 'tyrone',
    'belfast', 'northern ireland',
  ],
  Scotland: [
    'aberdeenshire', 'aberdeen', 'angus', 'argyll and bute', 'argyll',
    'ayrshire', 'banffshire', 'berwickshire', 'caithness',
    'clackmannanshire', 'dumfries and galloway', 'dumfries & galloway',
    'dumfriesshire', 'dumfries', 'galloway', 'dunbartonshire', 'dundee',
    'east lothian', 'west lothian', 'midlothian', 'lothian', 'edinburgh',
    'falkirk', 'fife', 'glasgow', 'inverness-shire', 'inverness',
    'highlands', 'highland', 'kincardineshire', 'kinross', 'kirkcudbrightshire',
    'lanarkshire', 'cumbernauld', 'moray', 'nairnshire', 'orkney',
    'peeblesshire', 'perthshire', 'perth and kinross', 'renfrewshire',
    'ross-shire', 'roxburghshire', 'scottish borders', 'selkirkshire',
    'shetland', 'stirlingshire', 'stirling', 'sutherland', 'wigtownshire',
    'isle of skye', 'skye', 'outer hebrides', 'western isles', 'hebrides',
    'north uist', 'south uist', 'uist', 'isle of harris', 'isle of lewis',
    'harris', 'lewis', 'isle of arran', 'arran', 'islay', 'isle of mull',
    'iona', 'scotland',
    // Towns that give no county in their address. Kept deliberately short and
    // limited to names with no English counterpart — the cross-check below is
    // what finds the next gap, rather than trying to pre-empt every town.
    'ayr', 'hawick', 'perth', 'melrose', 'selkirk', 'galashiels', 'peebles',
    'kelso', 'jedburgh', 'st andrews', 'oban', 'fort william', 'aviemore',
    'elgin', 'forres', 'kirkwall', 'lerwick', 'stornoway', 'portree',
    'campbeltown', 'kilmarnock', 'paisley', 'greenock', 'dunfermline',
    'kirkcaldy', 'arbroath', 'montrose', 'forfar', 'blairgowrie', 'pitlochry',
    'crieff', 'aberfeldy', 'peterhead', 'fraserburgh', 'stonehaven', 'thurso',
    'ullapool', 'portsoy', 'biggar', 'lanark', 'dunblane', 'auchtermuchty',
  ],
  Wales: [
    'isle of anglesey', 'anglesey', 'blaenau gwent', 'bridgend', 'caerphilly',
    'cardiff', 'carmarthenshire', 'ceredigion', 'conwy', 'denbighshire',
    'flintshire', 'gwynedd', 'merthyr tydfil', 'monmouthshire',
    'neath port talbot', 'newport', 'pembrokeshire', 'powys',
    'rhondda cynon taf', 'swansea', 'torfaen', 'vale of glamorgan',
    'wrexham', 'gower', 'north wales', 'south wales', 'mid wales', 'west wales',
    'snowdonia', 'eryri', 'clwyd', 'dyfed', 'gwent', 'glamorgan', 'wales',
    // As above: Welsh towns that name no county, avoiding any that share a
    // name with a town elsewhere in the UK (Bangor and Newport are both, so
    // they are left to the county rules).
    'aberystwyth', 'caernarfon', 'llandudno', 'llandeilo', 'llanelli',
    'machynlleth', 'dolgellau', 'porthmadog', 'pwllheli', 'harlech',
    'aberaeron', 'lampeter', 'brecon', 'crickhowell', 'corwen', 'denbigh',
    'ammanford', 'narberth', 'fishguard', 'tenby', 'aberdare', 'merthyr',
  ],
};

// Counties that share a name with, or sit next to, a border county elsewhere.
// Listed so the cross-check knows they are expected to look ambiguous.
const BORDER_COUNTIES = new Set([
  'cumbria', 'northumberland', 'shropshire', 'herefordshire', 'cheshire',
  'scottish borders', 'dumfries and galloway', 'powys', 'monmouthshire',
  'wrexham', 'flintshire',
]);

// English counties, used to name the county rather than to pick the nation —
// anything not matched above is England by elimination.
const ENGLISH_COUNTIES = [
  'bedfordshire', 'berkshire', 'bristol', 'buckinghamshire', 'cambridgeshire',
  'cheshire', 'cornwall', 'cumbria', 'derbyshire', 'devon', 'dorset', 'durham',
  'east sussex', 'west sussex', 'sussex', 'east yorkshire', 'north yorkshire',
  'south yorkshire', 'west yorkshire', 'yorkshire', 'essex', 'gloucestershire',
  'greater manchester', 'manchester', 'hampshire', 'herefordshire',
  'hertfordshire', 'isle of wight', 'kent', 'lancashire', 'leicestershire',
  'lincolnshire', 'london', 'merseyside', 'liverpool', 'norfolk',
  'northamptonshire', 'northumberland', 'nottinghamshire', 'oxfordshire',
  'rutland', 'shropshire', 'somerset', 'staffordshire', 'suffolk', 'surrey',
  'tyne and wear', 'warwickshire', 'west midlands', 'wiltshire',
  'worcestershire', 'isles of scilly',
];

const TITLE_EXCEPTIONS = {
  'co. antrim': 'Co. Antrim', 'co antrim': 'Co. Antrim', 'antrim': 'Co. Antrim',
  'co. down': 'Co. Down', 'co down': 'Co. Down', 'county down': 'Co. Down',
  'co. armagh': 'Co. Armagh', 'co armagh': 'Co. Armagh', 'armagh': 'Co. Armagh',
  'co. tyrone': 'Co. Tyrone', 'co tyrone': 'Co. Tyrone', 'tyrone': 'Co. Tyrone',
  'co. fermanagh': 'Co. Fermanagh', 'fermanagh': 'Co. Fermanagh',
  'co. londonderry': 'Co. Londonderry', 'londonderry': 'Co. Londonderry',
  'dumfries & galloway': 'Dumfries & Galloway',
  'dumfries and galloway': 'Dumfries & Galloway',
  'rhondda cynon taf': 'Rhondda Cynon Taf',
  'vale of glamorgan': 'Vale of Glamorgan',
  'isle of wight': 'Isle of Wight', 'isle of skye': 'Isle of Skye',
  'isle of arran': 'Isle of Arran', 'isle of mull': 'Isle of Mull',
  'isle of harris': 'Isle of Harris', 'isle of lewis': 'Isle of Lewis',
  'isle of anglesey': 'Isle of Anglesey', 'isles of scilly': 'Isles of Scilly',
};

function titleCase(name) {
  if (TITLE_EXCEPTIONS[name]) return TITLE_EXCEPTIONS[name];
  return name.split(' ').map(w =>
    w === 'and' || w === 'of' ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}

/**
 * Whole-word-ish match, so "derry" does not fire inside "Londonderry" — and not
 * a street name, so Portmeirion on London Road in Stoke-on-Trent is not filed
 * under London. Three businesses had been given a county from the street they
 * are on, which put them in the results for a city 150 miles away.
 */
const STREET_SUFFIX = '(?!\\s+(road|rd|street|st|lane|ln|way|avenue|ave|close|drive|crescent|terrace|mews|parade|walk)\\b)';
function mentions(text, name) {
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z])' + safe + STREET_SUFFIX + '([^a-z]|$)', 'i').test(text);
}

/**
 * Nation and county for a business, from its town and address.
 * Returns { nation, county, matched } — `matched` is the phrase that decided it.
 */
function classify(business) {
  const text = [business.town, business.address].filter(Boolean).join(', ').toLowerCase();

  for (const nation of ['Northern Ireland', 'Scotland', 'Wales']) {
    for (const county of COUNTIES[nation]) {
      if (mentions(text, county)) {
        const named = county === nation.toLowerCase() || /^(north|south|mid|west) wales$/.test(county);
        return { nation, county: named ? null : titleCase(county), matched: county };
      }
    }
  }

  for (const county of ENGLISH_COUNTIES) {
    if (mentions(text, county)) {
      return { nation: 'England', county: titleCase(county), matched: county };
    }
  }

  return { nation: 'England', county: null, matched: null };
}

/**
 * Does the coordinate agree with the nation the text gave us? Returns null when
 * it does, or a message when it does not. Deliberately loose — it is a smoke
 * alarm for gaps in the table above, not a second classifier.
 */
function crossCheck(business, nation) {
  const { lat, lng } = business;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const county = (business.town + ' ' + (business.address || '')).toLowerCase();
  const nearBorder = [...BORDER_COUNTIES].some(c => county.includes(c));
  if (nearBorder) return null;

  // 55.3N is the tightest line that still sits above every English town in the
  // catalogue once the border counties are excluded — Northumberland reaches
  // 55.31 and Cumbria 54.88, and both are excluded above. It is what found
  // Ayr, Hawick and Perth, all of which name no county in their address.
  if (nation !== 'Scotland' && lat > 55.3) return `north of 55.3N but filed as ${nation}`;
  if (nation === 'Scotland' && lat < 54.6) return 'filed as Scotland but south of 54.6N';
  // Wales sits west of about 2.65W below the Dee. Border counties are excluded,
  // so anything left here is either a gap in the table or a bad coordinate.
  if (nation === 'England' && lng < -2.9 && lng > -4.7 && lat > 51.4 && lat < 53.35) {
    return `at Welsh coordinates (${lat.toFixed(2)}, ${lng.toFixed(2)}) but filed as England`;
  }
  if (nation === 'Northern Ireland' && lng > -5.3) return 'filed as Northern Ireland but east of 5.3W';
  if (nation !== 'Northern Ireland' && lng < -5.5 && lat > 54 && lat < 55.4) {
    return `west of 5.5W in Irish latitudes but filed as ${nation}`;
  }
  return null;
}

module.exports = { COUNTIES, ENGLISH_COUNTIES, classify, crossCheck, titleCase };
