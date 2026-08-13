/* GENERATED FILE — do not edit by hand.
   Rebuild with: node scripts/update-search-api.js
   Source: scripts/lib/query-expand.js + scripts/lib/product-vocab.js */
(function (root) {
  var QUERY_LEXICON = {"version":5,"vocab":[["mugs","\\b(mug|beaker)s?\\b","i","ceramics"],["bowls","\\b(bowls?|dish(es)?)\\b","i","ceramics"],["plates","\\b(plate|platter|charger)s?\\b","i","ceramics"],["tableware","\\b(tableware|dinner ?sets?|teapots?|jugs?|cup and saucer)\\b","i","ceramics"],["pottery","\\b(pottery|ceramic|stoneware|porcelain|earthenware)","i","ceramics"],["vases","\\b(vase|urn)s?\\b","i","ceramics"],["tins & storage","\\b(storage tin|bread bin|caddy|canister)s?\\b","i","homeware"],["candles & holders","\\b(candle|candlestick|candle ?holder)s?\\b","i","homeware"],["cushions & throws","\\b(cushion|throw pillow)s?\\b","i","textiles"],["flowerpots","\\b(flower ?pot|planter|garden pot|terracotta pot)s?\\b","i","garden"],["knitwear","\\b(jumper|sweater|knitwear|cardigan|pullover|knit)s?\\b","i","clothing"],["cashmere & merino","\\b(cashmere|merino|lambswool)\\b","i","clothing"],["vests & waistcoats","\\b(waistcoat|gilet|body ?warmer|vest)s?\\b","i","clothing"],["coats & jackets","\\b(coat|jacket|parka|anorak|mac|smock)s?\\b","i","clothing"],["shirts","\\b(shirt)s?\\b","i","clothing"],["suits & trousers","\\b(suit|trouser|chino|blazer)s?\\b","i","clothing"],["jeans & denim","\\b(jean|denim)s?\\b","i","clothing"],["socks","\\b(sock|hosiery)s?\\b","i","clothing"],["underwear & nightwear","\\b(boxer|underwear|pyjama|nightwear|loungewear|dressing gown|brief)s?\\b","i","clothing"],["activewear","\\b(activewear|sportswear|base ?layer|legging)s?\\b","i","clothing"],["dresses","\\b(dress(?!ing\\b|\\s*stud|\\s*shirt)(es)?\\b|frock|ball ?gown|wedding gown)","i","clothing"],["womenswear","\\b(womens?|women's|ladies'?|blouses?|skirts?)\\b","i","clothing"],["childrenswear","\\b(child(ren)?s?wear|kids ?wear|babygrows?|rompers?|toddler|infant)\\b|\\bbaby(?! ?(leaf|leaves|potato|carrot|corn|beet|spinach|kale|gem|plum|new))","i","clothing"],["workwear & aprons","\\b(apron|workwear|overall|dungaree|boiler ?suit)s?\\b","i","clothing"],["tweed & woven goods","\\b(tweed|tartan|blanket|throw|woven|cloth by the metre)s?\\b","i","textiles"],["hats & caps","\\b(hat|cap|beanie|beret)s?\\b","i","accessories"],["scarves & accessories","\\b(scarf|scarves|shawl|glove|mitten|tie|pocket ?square|wrap)s?\\b","i","accessories"],["braces & belts","\\b(brace|belt|suspender)s?\\b","i","accessories"],["umbrellas","\\b(umbrella)s?\\b","i","accessories"],["glasses","\\b(glasses|sunglasses|eyeglasses|spectacles|eyewear|optical frames?|reading glasses)\\b","i","accessories"],["bags & leather goods","\\b(bag|satchel|rucksack|backpack|holdall|wallet|purse|luggage)s?\\b","i","bags"],["footwear & boots","\\b(shoe|boot|slipper|sandal|trainer|sneaker|loafer|brogue)s?\\b","i","footwear"],["jewellery","\\b(ring|necklace|pendant|earring|bracelet|brooch|jewel)","i","jewellery"],["cufflinks & signets","\\b(cufflink|signet)s?\\b","i","jewellery"],["silverware","\\b(silverware|sterling silver|hallmark)","i","silverware"],["watches","\\b(watch|chronometer|timepiece)(es)?\\b","i","watches"],["cutlery & knives","\\b(knife|knive|cutlery|blade|cleaver)s?\\b","i","cutlery"],["cookware","\\b(pan|skillet|casserole|stockpot|frying ?pan|wok)s?\\b","i","cookware"],["boards & blocks","\\b(chopping ?board|serving ?board|knife ?block)s?\\b","i","cookware"],["drinks & spirits","\\b(gin|whisky|whiskey|beer|ale|cider|wine|rum|vodka|liqueur)s?\\b","i","drink"],["bread & bakery","\\b(bread|loaf|loaves|cake|pastry|pastries|bakery|scone)s?\\b","i","food"],["dairy & cheese","\\b(cheese|butter|milk|yoghurt)s?\\b","i","food"],["beef","\\b(beef|brisket|sirloin|ribeye|rib-eye)\\b","i","food"],["lamb","\\b(lamb|mutton|hogget)\\b","i","food"],["pork & bacon","\\b(pork|bacon|sausage|gammon|ham)s?\\b","i","food"],["poultry","\\b(chicken|turkey|duck|goose|poultry)s?\\b","i","food"],["game & venison","\\b(venison|game|pheasant|partridge|rabbit)s?\\b","i","food"],["fruit & veg","\\b(vegetable|veg box|fruit|potato|apple|salad)(e?s)?\\b","i","food"],["eggs","\\b(egg)s?\\b","i","food"],["preserves & honey","\\b(jam|marmalade|chutney|preserve|honey)s?\\b","i","food"],["flour & grain","\\b(flours?|grains?|spelt|wholemeal|porridge oats|rolled oats|pearl barley)\\b","i","food"]],"extra":[["pork & bacon","\\b(banger|chipolata|salami|chorizo|charcuterie|cured meat|pancetta|prosciutto|pig|hog roast|pork pie|scratching)s?\\b","i","food"],["beef","\\b(steak|mince|burger|joint of beef|topside|silverside|braising steak|ox ?tail|bone broth|cow|cattle|bullock)s?\\b","i","food"],["lamb","\\b(chop|shank|sheep|ewe|shoulder of lamb)s?\\b","i","food"],["poultry","\\b(free ?range chicken|christmas turkey|bird|drumstick|thigh|wing)s?\\b","i","food"],["game & venison","\\b(wild meat|grouse|woodcock|hare|wild boar)s?\\b","i","food"],["pork & bacon","\\b(butcher|butchery|butchers'?)\\b","i","food"],["fruit & veg","\\b(spud|tattie|greens|veggie|veg|produce|seasonal veg|root veg|leek|carrot|onion|cabbage|kale|tomato|strawberr|raspberr|asparagus|pumpkin|squash|sprout|bean|pea|beetroot|parsnip|rhubarb|plum|pear|cherr|berr)(y|ies|e?s)?\\b","i","food"],["fruit & veg","\\b(p\\.?y\\.?o\\.?|pick your own|pick-your-own|greengrocer|market garden)\\b","i","food"],["dairy & cheese","\\b(raw milk|milk vending|milk station|cheddar|brie|stilton|wensleydale|cheesemonger|creamery|dairy|cream|ice ?cream|kefir|curd)s?\\b","i","food"],["bread & bakery","\\b(sourdough|baker|bakehouse|bun|roll|pie|tart|croissant|doughnut|donut|biscuit|shortbread|flapjack|brownie|crumpet)s?\\b","i","food"],["eggs","\\b(free ?range egg|duck egg|egg box|dozen eggs)s?\\b","i","food"],["preserves & honey","\\b(pickle|relish|conserve|curd|marmite|beeswax|beekeep|apiar)(y|ies|e?s)?\\b","i","food"],["flour & grain","\\b(oat|oatmeal|porridge|granola|muesli|rye|mill|milled|stoneground|stone ?ground|pasta|rice|lentil|pulse)s?\\b","i","food"],["dairy & cheese","\\b(deli|delicatessen|farm ?shop|food hall|farm ?gate|farmers'? market)\\b","i","food"],["drinks & spirits","\\b(perry|mead|cordial|juice|squash drink|lager|stout|bitter|real ale|craft beer|brewer|brewery|distiller|distillery|cider ?press|orchard|vineyard|kombucha|tonic)(y|ies|e?s)?\\b","i","drink"],["knitwear","\\b(knitted|knitting|hand ?knit|woolly|woollen|wool jumper|aran|fair ?isle|guernsey|gansey)s?\\b","i","clothing"],["bags & leather goods","\\b(glasses case|spectacle case|phone case|pencil case|wash ?bag|dopp kit|card holder|key ?fob)s?\\b","i","bags"],["footwear & boots","\\b(wellie|wellington|welly|footwear|cobbler|shoemaker)s?\\b","i","footwear"],["cutlery & knives","\\b(cutler|penknife|pocket ?knife|chef'?s knife|kitchen knife|sharpen)(y|ies|e?s)?\\b","i","cutlery"],["bags & leather goods","\\b(leather ?goods|leatherwork|saddler|tote)s?\\b","i","bags"],["jewellery","\\b(engagement|wedding band|goldsmith|silversmith|jeweller)s?\\b","i","jewellery"],["pottery","\\b(potter|kiln|thrown|wheel ?thrown|studio pottery)s?\\b","i","ceramics"]],"objectNouns":["tin","bin","jar","knife","knives","board","bowl","dish","plate","platter","mug","cup","saucer","jug","pot","stand","dome","cloth","towel","napkin","apron","sock","shirt","t-shirt","tee","jumper","sweater","hat","cap","bag","cushion","throw","blanket","print","card","candle","soap","tray","coaster","spoon","fork","server","slice","tester","holder","cover","case","pouch","sleeve","chain","cord","strap","stand","lanyard","loop","scarf","tie","ring","necklace","earring","charm","pendant","brooch"],"motifProne":["drinks & spirits","bread & bakery","dairy & cheese","beef","lamb","pork & bacon","poultry","game & venison","fruit & veg","eggs","preserves & honey","flour & grain","glasses"],"groupCategories":{"clothing":["clothing"],"textiles":["clothing"],"accessories":["clothing"],"footwear":["clothing"],"bags":["clothing"],"ceramics":["ceramics"],"homeware":["ceramics","cutlery"],"garden":["ceramics"],"jewellery":["jewellery"],"watches":["jewellery"],"silverware":["jewellery"],"cutlery":["cutlery"],"cookware":["cutlery"],"food":["farm"],"drink":["farm"]},"foodTags":["drinks & spirits","bread & bakery","dairy & cheese","beef","lamb","pork & bacon","poultry","game & venison","fruit & veg","eggs","preserves & honey","flour & grain"]};

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
      'is', 'do', 'does', 'find', 'looking', 'near', 'me', 'my', 'best', 'good',
      'any', 'some', 'from', 'british', 'britain', 'uk', 'english', 'local',
    ]);

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
      const tokens = qClean.split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));

      return {
        tags: [...tags],
        groups: [...groups],
        categories: [...categories],
        tokens,
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
        q.tokens.forEach(t => {
          const w = ' ' + t + ' ';
          if ((' ' + ptList.join(' ') + ' ').replace(/[^a-z0-9]+/g, ' ').includes(w)) score += 10;
          if ((' ' + String(item.t).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ').includes(w)) score += 8;
          if ((' ' + String(item.c).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ').includes(w)) score += 8;
          if ((' ' + String(item.s).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ').includes(w)) score += 6;
          if ((' ' + String(item.n).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ').includes(w)) score += 6;
          if ((' ' + String(item.d).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ').includes(w)) score += 3;
        });

        return { item, score };
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

  var api = createQueryExpander(QUERY_LEXICON);
  root.BBQueryExpand = { expandQuery: api.expandQuery, lexiconVersion: QUERY_LEXICON.version };
})(typeof window !== 'undefined' ? window : this);
