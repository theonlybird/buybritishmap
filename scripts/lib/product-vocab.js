/**
 * Shared controlled vocabulary for product tagging.
 *
 * Used by both scripts/harvest-shopify.js (live harvest) and
 * scripts/rescore-product-index.js (offline re-scoring), so the rules can
 * never drift between the two.
 *
 * Three defences against false positives, in order of how much work they do:
 *
 *   1. CATEGORY GATING  — a tag is only allowed if its group is plausible for
 *      the business's category. A Stoke pottery cannot be tagged "fruit & veg"
 *      no matter what its product titles say. This alone removes the great
 *      majority of bad tags.
 *
 *   2. HEAD-NOUN SUPPRESSION — in English the thing being sold is the last
 *      noun. "Cake Tins" are tins, "bread knife" is a knife, "Fruit Salad
 *      Socks" are socks. When a food word is followed by an object noun, the
 *      food word is a decoration or a modifier, not the product.
 *
 *   3. NOISE STRIPPING — colours, materials and care products are removed
 *      before matching, because "Shoe Cream" is not dairy and "Whiskey
 *      Nubuck" is not a spirit.
 *
 * Confidence: a tag derived from a shop's own product_type taxonomy is
 * "strong"; one derived only from a free-text product title is "weak".
 */

// ---------------------------------------------------------------------------
// Tag groups. Every vocab entry belongs to exactly one.
// ---------------------------------------------------------------------------
const GROUPS = {
  CLOTHING: 'clothing',
  TEXTILES: 'textiles',
  ACCESSORIES: 'accessories',
  FOOTWEAR: 'footwear',
  BAGS: 'bags',
  JEWELLERY: 'jewellery',
  WATCHES: 'watches',
  SILVERWARE: 'silverware',
  CERAMICS: 'ceramics',
  HOMEWARE: 'homeware',
  COOKWARE: 'cookware',
  CUTLERY: 'cutlery',
  GARDEN: 'garden',
  FOOD: 'food',
  DRINK: 'drink',
};

// Which groups are plausible for each business category on the map.
// Deliberately tight. A clothing brand that also stocks someone else's watches
// is not a watchmaker, and the map's claim is about what a business MAKES.
const CATEGORY_ALLOWS = {
  clothing: [GROUPS.CLOTHING, GROUPS.TEXTILES, GROUPS.ACCESSORIES, GROUPS.FOOTWEAR, GROUPS.BAGS],
  ceramics: [GROUPS.CERAMICS, GROUPS.HOMEWARE, GROUPS.GARDEN],
  jewellery: [GROUPS.JEWELLERY, GROUPS.WATCHES, GROUPS.SILVERWARE],
  cutlery: [GROUPS.CUTLERY, GROUPS.COOKWARE, GROUPS.HOMEWARE],
  farm: [GROUPS.FOOD, GROUPS.DRINK],
};

// ---------------------------------------------------------------------------
// Vocabulary: [tag, regex, group]
// ---------------------------------------------------------------------------
const VOCAB = [
  // --- ceramics & homeware ---
  ['mugs',                  /\b(mug|beaker)s?\b/i,                                    GROUPS.CERAMICS],
  ['bowls',                 /\b(bowls?|dish(es)?)\b/i,                                GROUPS.CERAMICS],
  ['plates',                /\b(plate|platter|charger)s?\b/i,                          GROUPS.CERAMICS],
  ['tableware',             /\b(tableware|dinner ?sets?|teapots?|jugs?|cup and saucer)\b/i, GROUPS.CERAMICS],
  ['pottery',               /\b(pottery|ceramic|stoneware|porcelain|earthenware)/i,    GROUPS.CERAMICS],
  ['vases',                 /\b(vase|urn)s?\b/i,                                       GROUPS.CERAMICS],
  ['tins & storage',        /\b(storage tin|bread bin|caddy|canister)s?\b/i,            GROUPS.HOMEWARE],
  ['candles & holders',     /\b(candle|candlestick|candle ?holder)s?\b/i,               GROUPS.HOMEWARE],
  ['cushions & throws',     /\b(cushion|throw pillow)s?\b/i,                            GROUPS.TEXTILES],
  ['flowerpots',            /\b(flower ?pot|planter|garden pot|terracotta pot)s?\b/i,   GROUPS.GARDEN],

  // --- clothing ---
  ['knitwear',              /\b(jumper|sweater|knitwear|cardigan|pullover|knit)s?\b/i,  GROUPS.CLOTHING],
  ['cashmere & merino',     /\b(cashmere|merino|lambswool)\b/i,                         GROUPS.CLOTHING],
  ['vests & waistcoats',    /\b(waistcoat|gilet|body ?warmer|vest)s?\b/i,               GROUPS.CLOTHING],
  ['coats & jackets',       /\b(coat|jacket|parka|anorak|mac|smock)s?\b/i,              GROUPS.CLOTHING],
  ['shirts',                /\b(shirt)s?\b/i,                                           GROUPS.CLOTHING],
  ['suits & trousers',      /\b(suit|trouser|chino|blazer)s?\b/i,                       GROUPS.CLOTHING],
  ['jeans & denim',         /\b(jean|denim)s?\b/i,                                      GROUPS.CLOTHING],
  ['socks',                 /\b(sock|hosiery)s?\b/i,                                    GROUPS.CLOTHING],
  ['underwear & nightwear', /\b(boxer|underwear|pyjama|nightwear|loungewear|dressing gown|brief)s?\b/i, GROUPS.CLOTHING],
  ['activewear',            /\b(activewear|sportswear|base ?layer|legging)s?\b/i,       GROUPS.CLOTHING],
  ['dresses',               /\b(dress(?!ing\b|\s*stud|\s*shirt)(es)?\b|frock|ball ?gown|wedding gown)/i, GROUPS.CLOTHING],
  ['womenswear',            /\b(womens?|women's|ladies'?|blouses?|skirts?)\b/i,         GROUPS.CLOTHING],
  ['childrenswear',         /\b(child(ren)?s?wear|kids ?wear|babygrows?|rompers?|toddler|infant)\b|\bbaby(?! ?(leaf|leaves|potato|carrot|corn|beet|spinach|kale|gem|plum|new))/i, GROUPS.CLOTHING],
  ['workwear & aprons',     /\b(apron|workwear|overall|dungaree|boiler ?suit)s?\b/i,    GROUPS.CLOTHING],
  ['tweed & woven goods',   /\b(tweed|tartan|blanket|throw|woven|cloth by the metre)s?\b/i, GROUPS.TEXTILES],
  ['hats & caps',           /\b(hat|cap|beanie|beret)s?\b/i,                            GROUPS.ACCESSORIES],
  ['scarves & accessories', /\b(scarf|scarves|shawl|glove|mitten|tie|pocket ?square|wrap)s?\b/i, GROUPS.ACCESSORIES],
  ['braces & belts',        /\b(brace|belt|suspender)s?\b/i,                            GROUPS.ACCESSORIES],
  ['umbrellas',             /\b(umbrella)s?\b/i,                                        GROUPS.ACCESSORIES],
  // "glasses" is what people actually search for; sunglasses and spectacles
  // are what shops write. Drinking glassware is stripped as noise before this
  // runs, so the bare word is safe.
  ['glasses',               /\b(glasses|sunglasses|eyeglasses|spectacles|eyewear|optical frames?|reading glasses)\b/i, GROUPS.ACCESSORIES],
  ['bags & leather goods',  /\b(bag|satchel|rucksack|backpack|holdall|wallet|purse|luggage)s?\b/i, GROUPS.BAGS],
  ['footwear & boots',      /\b(shoe|boot|slipper|sandal|trainer|sneaker|loafer|brogue)s?\b/i, GROUPS.FOOTWEAR],

  // --- jewellery & metal ---
  ['jewellery',             /\b(ring|necklace|pendant|earring|bracelet|brooch|jewel)/i, GROUPS.JEWELLERY],
  ['cufflinks & signets',   /\b(cufflink|signet)s?\b/i,                                 GROUPS.JEWELLERY],
  ['silverware',            /\b(silverware|sterling silver|hallmark)/i,                 GROUPS.SILVERWARE],
  ['watches',              /\b(watch|chronometer|timepiece)(es)?\b/i,                   GROUPS.WATCHES],

  // --- cutlery & cookware ---
  ['cutlery & knives',      /\b(knife|knive|cutlery|blade|cleaver)s?\b/i,               GROUPS.CUTLERY],
  ['cookware',              /\b(pan|skillet|casserole|stockpot|frying ?pan|wok)s?\b/i,  GROUPS.COOKWARE],
  ['boards & blocks',       /\b(chopping ?board|serving ?board|knife ?block)s?\b/i,     GROUPS.COOKWARE],

  // --- food & drink (farm only) ---
  ['drinks & spirits',      /\b(gin|whisky|whiskey|beer|ale|cider|wine|rum|vodka|liqueur)s?\b/i, GROUPS.DRINK],
  ['bread & bakery',        /\b(bread|loaf|loaves|cake|pastry|pastries|bakery|scone)s?\b/i, GROUPS.FOOD],
  ['dairy & cheese',        /\b(cheese|butter|milk|yoghurt)s?\b/i,                      GROUPS.FOOD],
  ['beef',                  /\b(beef|brisket|sirloin|ribeye|rib-eye)\b/i,               GROUPS.FOOD],
  ['lamb',                  /\b(lamb|mutton|hogget)\b/i,                                GROUPS.FOOD],
  ['pork & bacon',          /\b(pork|bacon|sausage|gammon|ham)s?\b/i,                   GROUPS.FOOD],
  ['poultry',               /\b(chicken|turkey|duck|goose|poultry)s?\b/i,               GROUPS.FOOD],
  ['game & venison',        /\b(venison|game|pheasant|partridge|rabbit)s?\b/i,          GROUPS.FOOD],
  ['fruit & veg',           /\b(vegetable|veg box|fruit|potato|apple|salad)(e?s)?\b/i,  GROUPS.FOOD],
  ['eggs',                  /\b(egg)s?\b/i,                                             GROUPS.FOOD],
  ['preserves & honey',     /\b(jam|marmalade|chutney|preserve|honey)s?\b/i,            GROUPS.FOOD],
  ['flour & grain',         /\b(flours?|grains?|spelt|wholemeal|porridge oats|rolled oats|pearl barley)\b/i, GROUPS.FOOD],
];

const TAG_GROUP = new Map(VOCAB.map(([tag, , group]) => [tag, group]));
const FOOD_TAGS = new Set(
  VOCAB.filter(([, , g]) => g === GROUPS.FOOD || g === GROUPS.DRINK).map(([t]) => t)
);

// Tags whose words commonly appear as decoration or as a modifier rather than
// as the product itself, so the head-noun rule is applied to them. Food and
// drink are the worst offenders ("Fruit Salad Socks"), but eyewear has the
// same problem via the very common "glasses case".
const MOTIF_PRONE = new Set([...FOOD_TAGS, 'glasses']);

// ---------------------------------------------------------------------------
// Noise: colours, materials, care products. Stripped before matching.
// ---------------------------------------------------------------------------
const NOISE = new RegExp('\\b(' + [
  // Drinking glassware — MUST come first, so that "wine glasses" is removed
  // whole rather than "wine" being stripped and a bare "glasses" surviving to
  // be read as eyewear. Alternation is leftmost-first, so order matters here.
  'wine glasses', 'wine glass', 'water glasses', 'water glass',
  'drinking glasses', 'drinking glass', 'pint glasses', 'pint glass',
  'champagne glasses', 'champagne glass', 'champagne flutes?', 'shot glasses',
  'shot glass', 'beer glasses', 'beer glass', 'whisky glasses', 'whisky glass',
  'whiskey glasses', 'whiskey glass', 'glass tumblers?', 'stemware',
  // Food words inside the name of a thing that is not that food. All found in
  // the live harvest: "Big Green Egg" is a barbecue, "Duck Fat Yorkshire
  // Puddings" are not poultry, and whipped tallow butter is a skin balm.
  // Multi-word entries are matched whole, so the bare noun never survives.
  'big green eggs?', 'green eggs?', 'duck fat', 'goose fat', 'beef dripping',
  'tallow butter', 'body butter', 'shea butter', 'cocoa butter', 'peanut butter',
  'nut butter', 'apple brandy', 'butter dish(es)?', 'egg cups?', 'egg timers?',
  // colours & finishes
  'cream', 'whiskey', 'whisky', 'wine', 'burgundy', 'port', 'chocolate', 'coffee', 'honey',
  'oatmeal', 'biscuit', 'caramel', 'mustard', 'olive', 'plum', 'cherry', 'peach', 'oxblood',
  'chestnut', 'walnut', 'almond', 'butterscotch', 'champagne', 'sand', 'stone', 'ivory',
  'charcoal', 'navy', 'tan', 'natural', 'black', 'brown', 'green', 'blue', 'red', 'grey', 'gray',
  'duck egg', 'eggshell', 'apple green', 'sage', 'rose', 'lemon', 'mint',
  // leather / material words that collide with food or product tags
  'calf', 'kid', 'kidskin', 'buck', 'doe', 'hide', 'suede', 'nubuck', 'shell', 'cordovan',
  'duck cotton', 'moleskin', 'corduroy',
  // care products, gifting & extras
  'polish', 'polishing', 'wax', 'cream cleaner', 'shoe tree', 'gift card', 'gift voucher',
  'sample', 'swatch', 'care kit', 'conditioner', 'spare', 'refill', 'repair', 'gift set',
].join('|') + ')\\b', 'gi');

// ---------------------------------------------------------------------------
// Object nouns. If a food or drink word is followed by one of these, the food
// word is a motif or a modifier and the product is the object.
//   "Cake Tins" -> tins    "bread knife" -> knife    "Fruit Salad Socks" -> socks
// ---------------------------------------------------------------------------
const OBJECT_NOUNS = [
  'tin', 'bin', 'jar', 'knife', 'knives', 'board', 'bowl', 'dish', 'plate', 'platter',
  'mug', 'cup', 'saucer', 'jug', 'pot', 'stand', 'dome', 'cloth', 'towel', 'napkin',
  'apron', 'sock', 'shirt', 't-shirt', 'tee', 'jumper', 'sweater', 'hat', 'cap', 'bag',
  'cushion', 'throw', 'blanket', 'print', 'card', 'candle', 'soap', 'tray', 'coaster',
  // NB: 'box' and 'basket' are deliberately absent — "beef box" and "veg box"
  // are how farm shops actually sell food, not motifs on an object.
  'spoon', 'fork', 'server', 'slice', 'tester', 'holder', 'cover',
  // "glasses case" is a case; a leather workshop that makes them is not an
  // optician. Same trap as "cake tin".
  'case', 'pouch', 'sleeve', 'chain', 'cord', 'strap', 'stand', 'lanyard', 'loop',
  'scarf', 'tie', 'ring', 'necklace', 'earring', 'charm', 'pendant', 'brooch',
];
const OBJECT_AFTER = new RegExp(
  '\\b(?:' + OBJECT_NOUNS.join('|') + ')s?\\b', 'i'
);

/**
 * True when `word` appears in `text` followed (within 3 words) by an object
 * noun — i.e. the food word is modifying something else.
 */
function isModifier(text, matchIndex, matchLength) {
  const after = String(text).slice(matchIndex + matchLength, matchIndex + matchLength + 40);
  const words = after.trim().split(/\s+/).slice(0, 3).join(' ');
  return OBJECT_AFTER.test(words);
}

/**
 * Map a single string to tags, with the evidence that produced each one.
 * Returns [{ tag, group, evidence, suppressed }]
 */
function mapWithEvidence(text) {
  const raw = String(text || '');
  const cleaned = raw.replace(NOISE, ' ');
  const out = [];
  for (const [tag, re, group] of VOCAB) {
    const m = cleaned.match(re);
    if (!m) continue;
    // Head-noun rule applies to food and drink, where motif-vs-product
    // confusion is both common and most damaging to credibility.
    if (MOTIF_PRONE.has(tag) && isModifier(cleaned, m.index, m[0].length)) {
      out.push({ tag, group, evidence: raw.trim().slice(0, 70), suppressed: 'modifier' });
      continue;
    }
    out.push({ tag, group, evidence: raw.trim().slice(0, 70), suppressed: null });
  }
  return out;
}

/** Plain tag list for a string, with suppressed tags already removed. */
function mapToVocab(text) {
  return [...new Set(mapWithEvidence(text).filter(r => !r.suppressed).map(r => r.tag))];
}

/** Is this tag plausible for a business in this category? */
function isTagAllowed(tag, category) {
  const group = TAG_GROUP.get(tag);
  if (!group) return false;
  const allowed = CATEGORY_ALLOWS[String(category || '').toLowerCase()];
  if (!allowed) return true; // unknown category: don't silently drop everything
  return allowed.includes(group);
}

// Bump whenever the word lists or rules change, so the harvester can tell
// which stored entries predate the current vocabulary and need re-reading.
// NB: only the TAGGING rules matter here. QUERY_EXTRA below never touches a
// stored tag, so adding search words to it does not invalidate the harvest.
const VOCAB_VERSION = 5;

// ---------------------------------------------------------------------------
// Query-side vocabulary.
//
// VOCAB above is written in SHOP language — the words that appear in product
// titles and a shop's own taxonomy. People search in KITCHEN-TABLE language:
// "bangers", "spuds", "a joint of beef". Those words never appear in a product
// feed, so they have no business in VOCAB (they would only add false positives
// when tagging), but they are exactly what search has to understand.
//
// So this is a second list, used only when interpreting a query, never when
// tagging a business. Both map to the SAME canonical tags, which is what keeps
// the two sides in step.
// ---------------------------------------------------------------------------
const QUERY_EXTRA = [
  // --- meat, as ordered at a counter rather than as listed in a feed ---
  ['pork & bacon',      /\b(banger|chipolata|salami|chorizo|charcuterie|cured meat|pancetta|prosciutto|pig|hog roast|pork pie|scratching)s?\b/i, GROUPS.FOOD],
  ['beef',              /\b(steak|mince|burger|joint of beef|topside|silverside|braising steak|ox ?tail|bone broth|cow|cattle|bullock)s?\b/i,     GROUPS.FOOD],
  ['lamb',              /\b(chop|shank|sheep|ewe|shoulder of lamb)s?\b/i,                                                                          GROUPS.FOOD],
  ['poultry',           /\b(free ?range chicken|christmas turkey|bird|drumstick|thigh|wing)s?\b/i,                                                 GROUPS.FOOD],
  ['game & venison',    /\b(wild meat|grouse|woodcock|hare|wild boar)s?\b/i,                                                                       GROUPS.FOOD],
  // A butcher's counter is the single most useful thing to be able to search
  // for, and it is how farm shops describe themselves.
  ['pork & bacon',      /\b(butcher|butchery|butchers'?)\b/i,                                                                                      GROUPS.FOOD],

  // --- fruit & veg ---
  ['fruit & veg',       /\b(spud|tattie|greens|veggie|veg|produce|seasonal veg|root veg|leek|carrot|onion|cabbage|kale|tomato|strawberr|raspberr|asparagus|pumpkin|squash|sprout|bean|pea|beetroot|parsnip|rhubarb|plum|pear|cherr|berr)(y|ies|e?s)?\b/i, GROUPS.FOOD],
  ['fruit & veg',       /\b(p\.?y\.?o\.?|pick your own|pick-your-own|greengrocer|market garden)\b/i,                                               GROUPS.FOOD],

  // --- dairy ---
  ['dairy & cheese',    /\b(raw milk|milk vending|milk station|cheddar|brie|stilton|wensleydale|cheesemonger|creamery|dairy|cream|ice ?cream|kefir|curd)s?\b/i, GROUPS.FOOD],

  // --- bakery ---
  ['bread & bakery',    /\b(sourdough|baker|bakehouse|bun|roll|pie|tart|croissant|doughnut|donut|biscuit|shortbread|flapjack|brownie|crumpet)s?\b/i, GROUPS.FOOD],

  // --- eggs, preserves, store cupboard ---
  ['eggs',              /\b(free ?range egg|duck egg|egg box|dozen eggs)s?\b/i,                                                                     GROUPS.FOOD],
  ['preserves & honey', /\b(pickle|relish|conserve|curd|marmite|beeswax|beekeep|apiar)(y|ies|e?s)?\b/i,                                             GROUPS.FOOD],
  ['flour & grain',     /\b(oat|oatmeal|porridge|granola|muesli|rye|mill|milled|stoneground|stone ?ground|pasta|rice|lentil|pulse)s?\b/i,           GROUPS.FOOD],
  // Deli counters sell cheese and cured meat; both are worth returning.
  ['dairy & cheese',    /\b(deli|delicatessen|farm ?shop|food hall|farm ?gate|farmers'? market)\b/i,                                                GROUPS.FOOD],

  // --- drink ---
  ['drinks & spirits',  /\b(perry|mead|cordial|juice|squash drink|lager|stout|bitter|real ale|craft beer|brewer|brewery|distiller|distillery|cider ?press|orchard|vineyard|kombucha|tonic)(y|ies|e?s)?\b/i, GROUPS.DRINK],

  // --- a few non-food gaps in everyday search language ---
  // "knitted" is how people search; "knit" is how shops write. The tagging
  // regex only has the latter, so "knitted vests" found waistcoats but not
  // knitwear.
  ['knitwear',          /\b(knitted|knitting|hand ?knit|woolly|woollen|wool jumper|aran|fair ?isle|guernsey|gansey)s?\b/i,                          GROUPS.CLOTHING],
  // A glasses case is a case, and the head-noun rule correctly refuses to read
  // it as eyewear — which left the query matching nothing at all. It is a
  // leather good, so say so.
  ['bags & leather goods', /\b(glasses case|spectacle case|phone case|pencil case|wash ?bag|dopp kit|card holder|key ?fob)s?\b/i,                    GROUPS.BAGS],
  ['footwear & boots',  /\b(wellie|wellington|welly|footwear|cobbler|shoemaker)s?\b/i,                                                              GROUPS.FOOTWEAR],
  ['cutlery & knives',  /\b(cutler|penknife|pocket ?knife|chef'?s knife|kitchen knife|sharpen)(y|ies|e?s)?\b/i,                                     GROUPS.CUTLERY],
  ['bags & leather goods', /\b(leather ?goods|leatherwork|saddler|tote)s?\b/i,                                                                      GROUPS.BAGS],
  ['jewellery',         /\b(engagement|wedding band|goldsmith|silversmith|jeweller)s?\b/i,                                                          GROUPS.JEWELLERY],
  ['pottery',           /\b(potter|kiln|thrown|wheel ?thrown|studio pottery)s?\b/i,                                                                 GROUPS.CERAMICS],
];

// Which map categories a tag group can plausibly live in. The inverse of
// CATEGORY_ALLOWS, computed so the two can never disagree. Used by search to
// decide which slice of the map to fall back to when nothing scores.
const GROUP_CATEGORIES = {};
for (const [category, groups] of Object.entries(CATEGORY_ALLOWS)) {
  for (const g of groups) {
    (GROUP_CATEGORIES[g] = GROUP_CATEGORIES[g] || []).push(category);
  }
}

/**
 * Everything the query expander needs, in a form that survives JSON.stringify.
 *
 * The search API is a single generated file with no imports, so the lexicon is
 * inlined into it at build time rather than required at runtime. Serialising
 * from here — instead of retyping the words in the API — is what stops the two
 * sides drifting apart, which is the whole reason this file exists.
 */
function serializeLexicon() {
  const pack = ([tag, re, group]) => [tag, re.source, re.flags, group];
  return {
    version: VOCAB_VERSION,
    vocab: VOCAB.map(pack),
    extra: QUERY_EXTRA.map(pack),
    objectNouns: OBJECT_NOUNS,
    motifProne: [...MOTIF_PRONE],
    groupCategories: GROUP_CATEGORIES,
    foodTags: [...FOOD_TAGS],
  };
}

module.exports = {
  VOCAB_VERSION,
  VOCAB, QUERY_EXTRA, GROUPS, CATEGORY_ALLOWS, GROUP_CATEGORIES,
  TAG_GROUP, FOOD_TAGS, MOTIF_PRONE,
  NOISE, OBJECT_NOUNS,
  mapWithEvidence, mapToVocab, isTagAllowed, serializeLexicon,
};
