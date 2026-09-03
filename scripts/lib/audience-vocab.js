/**
 * Who a clothing business dresses — the shared vocabulary.
 *
 * Used by scripts/harvest-audience.js (to read the evidence) and by
 * index.html (to read the query). Kept here so the two can never drift:
 * if "gents" means men on one side it has to mean men on the other.
 *
 * Three audiences only — men, women, children. Everything else a shop might
 * segment by (petite, tall, plus) is a size, not an audience.
 *
 * EXPLICIT words say who a garment is for in so many words. IMPLIED words are
 * garments only one audience wears. Implied evidence is deliberately weaker:
 * a shop selling skirts almost certainly dresses women, but a shop selling
 * boxers might still be unisex head to toe.
 */

// (?<![a-z]) rather than \b, because \bmen\b matches the "men" inside
// "women" is false — but "women's" is normalised to "women s" below, and a
// plain \b would then be fine. The lookbehind is belt and braces, and it is
// what stops "womenswear" registering as menswear.
const EXPLICIT = {
  men:      /(?<![a-z])(mens?|menswear|gents?|gentlemens?|gentleman|blokes?)(?![a-z])/g,
  women:    /(?<![a-z])(womens?|womans?|womenswear|ladies|ladys?)(?![a-z])/g,
  // A baker boy cap is a hat for adults, "boyfriend" is a fit, and Baby Blue
  // is a colour. Each of those put grown-up shops in a children's search on the
  // first pass, so the exceptions are part of the word list, not an afterthought.
  children: /(?<![a-z])(kids?|childs?|childrens?|childrenswear|babys?(?!\s*(blue|pink|lilac|yellow|green|camel))|babies|toddlers?|infants?|juniors?|newborns?|(?<!baker\s)(?<!bakers\s)(?<!news)(?<!cow)(?<!tom)boys?(?!friend)|girls?(?!friend))(?![a-z])/g
};

// Garments worn by one audience often enough to count as evidence.
// "dress" is matched exactly so that "dressing gown" (unisex) stays out.
const IMPLIED = {
  // Only the plural. A singular "dress" is almost always an adjective in
  // menswear — dress shirt, dress trousers, dress sneakers, dress bow ties,
  // black-tie dress sets — and each of those filed a menswear shop as
  // womenswear on an earlier pass.
  women:    /(?<![a-z])(skirts?|dresses(?!\s*up)|blouses?|leggings|camisoles?|bras?|bralettes?|kaftans?|jumpsuits?|playsuits?|pinafores?|nighties)(?![a-z])/g,
  men:      /(?<![a-z])(boxers?|y-fronts?|tuxedos?|cummerbunds?|morning suits?|dinner jackets?)(?![a-z])/g,
  children: /(?<![a-z])(rompers?|babygrows?|onesies?|sleepsuits?|prams?)(?![a-z])/g
};

// Words that look gendered but are not evidence of who the shop dresses:
// a "Gifts for Her" edit is a gift guide, and every shop has one.
const NOT_EVIDENCE = /(gift|present|valentine|mother|father|christmas|birthday|wedding|bride|groom)/;

function normalise(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")     // curly apostrophes
    .replace(/'s\b/g, 's')                     // men's -> mens, women's -> womens
    .replace(/[^a-z0-9 ]+/g, ' ')   // hyphens included: a handle like
                                    // "berets-and-baker-boys" has to read as
                                    // words, or "baker boys" slips past the
                                    // exception for it
    .replace(/\s+/g, ' ')
    .trim();
}

// Which audiences does this one string name?
// Returns { explicit: { men: 'mens' }, implied: { women: 'skirts' } } — kept
// apart because the caller trusts them differently: an implied garment is
// always one strength weaker than the source it was found in.
function readAudience(text, { implied = true } = {}) {
  const s = normalise(text);
  const out = { explicit: {}, implied: {} };
  if (!s) return out;
  if (!NOT_EVIDENCE.test(s)) {
    for (const [who, rx] of Object.entries(EXPLICIT)) {
      rx.lastIndex = 0;
      const m = rx.exec(s);
      if (m) out.explicit[who] = m[0];
    }
  }
  if (implied) {
    for (const [who, rx] of Object.entries(IMPLIED)) {
      if (out.explicit[who]) continue;
      rx.lastIndex = 0;
      const m = rx.exec(s);
      if (m) out.implied[who] = m[0];
    }
  }
  return out;
}

const AUDIENCES = ['men', 'women', 'children'];

module.exports = { EXPLICIT, IMPLIED, AUDIENCES, normalise, readAudience };
