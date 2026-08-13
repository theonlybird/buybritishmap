/**
 * Query expansion and candidate scoring.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT: the whole of this file is inlined verbatim into api/ai-search.js
 * by scripts/update-search-api.js. It must stay dependency-free and must not
 * reference anything outside the `lexicon` object handed to it. Everything
 * below the EXPORTS marker is stripped during that copy.
 * ---------------------------------------------------------------------------
 *
 * Why this exists
 *
 * The tagging side has always had a careful vocabulary: `sausage` is a
 * `pork & bacon` product, `cider` is `drinks & spirits`. The search side had
 * none. It compared the user's words against the tag LABELS, so a search for
 * "sausages" never met the tag "pork & bacon" and scored zero — the query then
 * fell through to a padded shortlist of whatever sat first in the file, and the
 * model quite reasonably reported no results.
 *
 * So: run the query through the same lexicon that produced the tags, and match
 * canonical tag against canonical tag.
 *
 * Three deliberate differences from tagging:
 *
 *   1. NO NOISE STRIPPING. NOISE exists because "Whiskey Nubuck" is a colour
 *      and "Honey Cream" is a polish — problems that only arise in a shop's own
 *      product titles. A person who types "honey" means honey. Stripping the
 *      query would delete the search term.
 *
 *   2. HEAD-NOUN SUPPRESSION IS KEPT. "cake tin" is still a tin when someone
 *      searches for it, so the modifier rule earns its place on both sides.
 *
 *   3. QUERY_EXTRA IS ADDED. Kitchen-table words ("bangers", "spuds", "a joint
 *      of beef") never appear in a product feed, so they must not influence
 *      tagging — but they are exactly what people type.
 */

function createQueryExpander(lexicon) {
  const build = ([tag, source, flags, group]) => [tag, new RegExp(source, flags), group];
  const VOCAB = lexicon.vocab.map(build);
  const EXTRA = lexicon.extra.map(build);
  const ALL = VOCAB.concat(EXTRA);
  const MOTIF_PRONE = new Set(lexicon.motifProne);
  const FOOD_TAGS = new Set(lexicon.foodTags);
  const GROUP_CATEGORIES = lexicon.groupCategories;
  const TAG_GROUP = new Map(ALL.map(([tag, , group]) => [tag, group]));
  const OBJECT_AFTER = new RegExp('\\b(?:' + lexicon.objectNouns.join('|') + ')s?\\b', 'i');

  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'of', 'with',
    'who', 'sell', 'sells', 'selling', 'sold', 'buy', 'buying', 'make', 'makes',
    'maker', 'makers', 'making', 'made', 'which', 'what', 'where', 'can', 'are',
    'is', 'do', 'does', 'find', 'looking', 'near', 'me', 'my',
    'any', 'some', 'from', 'british', 'britain', 'uk', 'english', 'local',

    // Judgement words. Scoring on these would mean the map deciding which
    // businesses are more sustainable, more ethical or nicer than the others,
    // which it has no evidence for. "sustainable" appears in enough
    // descriptions to be a real search term, so it was quietly ranking on
    // whose marketing copy used the word. "sustainable jumper" must return
    // exactly what "jumper" returns.
    //
    // Not here, deliberately: "organic", "handmade", "traditional",
    // "heritage" — checkable claims about how something is made, not opinions
    // about whether it is good.
    'nice', 'good', 'great', 'lovely', 'beautiful', 'pretty', 'cool', 'stylish',
    'smart', 'best', 'better', 'finest', 'top', 'favourite', 'decent', 'proper',
    'amazing', 'sustainable', 'sustainably', 'ethical', 'ethically', 'eco',
    'ecofriendly', 'conscious', 'responsible', 'responsibly', 'green', 'planet',
    'friendly', 'natural', 'quality', 'luxury', 'luxurious', 'premium',
    'exclusive', 'artisan', 'artisanal', 'affordable', 'cheap', 'budget',
    'expensive', 'value', 'reasonable', 'something', 'anything', 'really',
    'very', 'quite', 'lots', 'bit',
  ]);

  // Qualifiers: checkable claims about HOW something is made. Kept, and they
  // do count — but only as a boost on a business that already makes the thing
  // asked for. A qualifier can never make a business eligible on its own.
  //
  // "handmade bowl" was returning Hurdwick Handmade Bag Company, Alex Monroe
  // and Drakes, none of whom make bowls, purely on the word appearing in their
  // name or copy. "organic beef" is unaffected: organic farms match "beef"
  // too, so they stay eligible and still take the boost.
  const QUALIFIER_WORDS = new Set([
    'organic', 'organics', 'handmade', 'handcrafted', 'handwoven', 'handstitched',
    'handthrown', 'traditional', 'traditionally', 'heritage', 'bespoke', 'custom',
    'vintage', 'artisanal', 'small', 'batch', 'local', 'locally', 'seasonal',
    'free', 'range', 'grass', 'fed', 'wild',
  ]);

  // Adjectival forms of the nations. Each business carries its nation in the
  // place field, so mapping the adjective onto the noun is all that is needed.
  const NATION_WORDS = {
    scottish: 'scotland', scots: 'scotland',
    welsh: 'wales', cymru: 'wales',
    english: 'england',
    irish: 'northern ireland', ulster: 'northern ireland',
  };

  /** Is the matched word modifying something else? "cake tin" is a tin. */
  function isModifier(text, matchIndex, matchLength) {
    const after = String(text).slice(matchIndex + matchLength, matchIndex + matchLength + 40);
    const words = after.trim().split(/\s+/).slice(0, 3).join(' ');
    return OBJECT_AFTER.test(words);
  }

  /**
   * Map a user's query to canonical product tags.
   * Returns { tags: [...], groups: [...], categories: [...], tokens: [...] }
   */
  function expandQuery(query) {
    const raw = String(query || '');
    const tags = new Set();

    for (const [tag, re, group] of ALL) {
      const m = raw.match(re);
      if (!m) continue;
      if (MOTIF_PRONE.has(tag) && isModifier(raw, m.index, m[0].length)) continue;
      tags.add(tag);
    }

    const groups = new Set();
    for (const tag of tags) {
      const g = TAG_GROUP.get(tag);
      if (g) groups.add(g);
    }

    // Which slices of the map could plausibly answer this. Used only for the
    // fallback: a food query should fall back to farm shops, not to whatever
    // happens to sit at the top of the file.
    const categories = new Set();
    for (const g of groups) {
      for (const c of (GROUP_CATEGORIES[g] || [])) categories.add(c);
    }

    const qClean = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const all = qClean.split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));

    // "handmade bowl" is a bowl search qualified by handmade. Split them so
    // eligibility can rest on the noun. If everything they typed was a
    // qualifier there is no noun to fall back on, so let them act as one.
    const core = all.filter(t => !QUALIFIER_WORDS.has(t));
    const tokens = core.length ? core : all;
    const qualifiers = core.length ? all.filter(t => QUALIFIER_WORDS.has(t)) : [];

    return {
      tags: [...tags],
      groups: [...groups],
      categories: [...categories],
      tokens,
      qualifiers,
      qClean,
      isFood: [...tags].some(t => FOOD_TAGS.has(t)),
    };
  }

  /**
   * Stage one of two-stage retrieval: narrow the catalogue to a shortlist the
   * model can rank cheaply.
   */
  function stageOneFilter(query, catalog, maxCandidates) {
    const limit = maxCandidates || 40;
    if (!query || typeof query !== 'string') return catalog.slice(0, limit);

    const q = expandQuery(query);
    if (!q.qClean) return catalog.slice(0, limit);

    const queryTags = new Set(q.tags);

    const scored = catalog.map(item => {
      let score = 0;
      const fields = [item.n, item.c, item.s, item.t, item.d];
      const textNorm = ' ' + fields.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
      const ptList = (item.pt || []).map(p => String(p).toLowerCase());

      // Whole-query phrase hit, e.g. "sheffield steel".
      if (q.qClean.length >= 3 && textNorm.includes(' ' + q.qClean + ' ')) score += 20;

      // The important one: canonical tag against canonical tag. This is what
      // connects "sausages" to a business tagged `pork & bacon`.
      ptList.forEach(pt => {
        if (queryTags.has(pt)) score += 18;
      });

      // Literal word matches, as a backstop for anything the lexicon missed
      // (place names, maker names, materials). Word-boundary matched: the old
      // substring test scored "ale" against "Kels*ale*" and "wholes*ale*".
      const wordIn = (field, t) =>
        (' ' + String(field).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ').includes(' ' + t + ' ');

      q.tokens.forEach(t => {
        if (wordIn(ptList.join(' '), t)) score += 10;
        // "scottish" has to reach a business filed under Scotland.
        if (NATION_WORDS[t] && wordIn(item.t, NATION_WORDS[t])) score += 8;
        if (wordIn(item.t, t)) score += 8;
        if (wordIn(item.c, t)) score += 8;
        if (wordIn(item.s, t)) score += 6;
        if (wordIn(item.n, t)) score += 6;
        if (wordIn(item.d, t)) score += 3;
      });

      // Qualifiers rank but never admit, so they are added only once the
      // business has already scored on the product itself.
      let boost = 0;
      if (score > 0) {
        q.qualifiers.forEach(t => {
          if (wordIn(ptList.join(' '), t) || wordIn(item.s, t) || wordIn(item.c, t)) boost += 4;
          else if (wordIn(item.n, t) || wordIn(item.d, t)) boost += 2;
        });
      }

      return { item, score: score + boost };
    });

    scored.sort((a, b) => b.score - a.score);
    const matched = scored.filter(s => s.score > 0).map(s => s.item);

    if (matched.length >= limit) return matched.slice(0, limit);

    // Fallback. The old version padded with the first N businesses in file
    // order, which for a food query meant handing the model forty clothing
    // brands and letting it conclude that nobody in Britain sells sausages.
    //
    // Pad from the categories the query actually implies instead. For food
    // that means farm shops, where near-total recall is the right behaviour:
    // almost any farm shop sells vegetables, and "here are the farm shops
    // near you" beats "no results" every time.
    const matchedIds = new Set(matched.map(m => m.i));
    const wanted = new Set(q.categories);
    const inCategory = wanted.size
      ? catalog.filter(c => !matchedIds.has(c.i) && wanted.has(c.c))
      : [];

    let out = [...matched, ...inCategory].slice(0, limit);

    // Only if we still have nothing to show does catalogue order come back,
    // and never for a query we understood well enough to categorise.
    if (!out.length) {
      out = catalog.slice(0, limit);
    }
    return out;
  }

  return { expandQuery, stageOneFilter };
}

// --- EXPORTS (stripped when inlined into the API) ---
module.exports = { createQueryExpander };
