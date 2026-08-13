# Food & farm-shop search — diagnosis and plan

*13 August 2026. Question: why does "sausages" return nothing, and how do we make
food search accurate without re-scraping the whole catalogue every quarter?*

> **Status: steps 1–3 shipped 13 Aug 2026.** See "What was built" at the foot of
> this file. Steps 4–5 (department extraction for the 39 feedless farm shops, and
> the monthly change-detection job) are still to do.

## What's actually broken

Four separate faults, only one of which is a data problem.

### 1. The query side has no vocabulary at all

`scripts/lib/product-vocab.js` contains a careful lexicon — `sausage` is already
in the `pork & bacon` regex, `cider` and `ale` are already in `drinks & spirits`.
That lexicon runs **only when tagging**. `stageOneFilter` in `api/ai-search.js`
does raw token matching against the tag *labels*, so the user's word has to
literally appear in the tag string. "sausages" never meets "pork & bacon", so it
scores zero.

Measured against the live catalogue today:

| Query | Top 5 returned |
|---|---|
| `sausages` | seh-kelly, united-overalls, private-white-vc, community-clothing, maquien — all clothing |
| `british cider` | british-sheepskin, the-british-belt-company, british-boxers — matched on the word "British" in the *name* |
| `ale` | maple-farm-**kels*ale***, hiut-denim — substring noise |

The lexicon needed to fix this already exists. It's just never pointed at the query.

### 2. Substring matching, not word matching

Line 35: `item.d.toLowerCase().includes(t)`. No word boundaries. "ale" matches
"wholesale", "Kelsale", "sale". "veg" matches "Vegas". Every other field has the
same bug. The tagging side is boundary-safe; the search side isn't.

### 3. The fallback invents a shortlist, then blames the model

When fewer than 15 businesses score above zero, stage one pads the shortlist with
the *first 40 businesses in catalogue order* (lines 45–51). For "sausages" that's
40 clothing brands. The model is then asked to rank them, correctly finds nothing
relevant, and says "no results" — which reads to the user as "no farm shop in
Britain sells sausages". The failure looks like a data gap but is a padding bug.

### 4. The harvested data isn't being shipped

`data/product-index.json` is better than what search sees. Pipers Farm has **12**
harvested tags in the index and ships **one** (`fresh meat`). Gazegill has 12,
ships 3. Eversfield has 8, ships 2. The index was built and then only partially
merged into `businesses.json`.

## The real coverage gap

71 farm shops. Only **32** returned a machine-readable product feed. The other
**39** — Daylesford, Ludlow Food Centre, Chatsworth, Keelham, Cannon Hall,
Goodwood, Trevaskis, Secretts — have no feed at all, because they are physical
shops with brochure websites. No amount of query fixing reaches them.

These are also, on average, the *biggest* farm shops. The gap is not in the tail.

## Proposal

Four layers, cheapest and highest-yield first. Layers 1–3 need no new data.

### Layer 1 — invert the existing lexicon (no new data)

Run the query through `product-vocab.js` before scoring, mapping it to canonical
tags rather than matching text to text.

```
"sausages"       -> pork & bacon
"british cider"  -> drinks & spirits
"vegetables"     -> fruit & veg
```

Then score against tags. Deterministic, sub-millisecond, auditable, and it uses
the same rules that produced the tags, so the two can never disagree.

While there, add the search words the tagging side never needed: *bangers, spuds,
greens, veg box, raw milk, PYO, ale, perry, cordial, sourdough, charcuterie*. Tagging
sees shop language; search gets kitchen-table language. They are different vocabularies.

Also fix the word-boundary bug in the same pass.

### Layer 2 — merge the harvested index into the shipped catalogue

Ship what's already been harvested. This roughly triples the tags on the 32 farm
shops that have feeds, for the cost of a rebuild.

### Layer 3 — departments, not produce, for the 39 with no feed

This is the important design call, and it's where the accuracy comes from.

Don't try to learn what a farm shop *stocks*. Learn what **counters and
departments** it has, which its website states plainly in prose:

```
ludlow-food-centre: [butchery, bakery, deli, cheese counter, greengrocer, dairy]
chatsworth:         [butchery, bakery, deli, kitchen]
```

Then a small, hand-written inference table does the rest:

| Department | Implies |
|---|---|
| butchery | sausages, bacon, mince, joints, steak, burgers |
| bakery | bread, sourdough, cakes, pastries, pies |
| greengrocer | seasonal veg, fruit, potatoes, salad |
| deli / cheese counter | cheese, cured meats, olives, pâté |
| dairy or vending | milk, raw milk, cream, butter, eggs |

A farm shop with a butchery counter sells sausages. That is true by construction
and stays true — which is exactly what a shop's current stock list is not. This is
the single highest-accuracy move available, and it costs one extraction pass over
39 sites.

The existing evidence text already supports it: 31 of the 71 farm shops mention a
butcher, 15 a deli, 14 cheese, 6 a bakery — before anyone fetches a page.

**Display discipline.** Match on inference; never *claim* on inference.

- feed-derived: "Sells: beef, lamb, eggs — checked Aug 2026"
- department-derived: "Has its own butchery counter"
- never: "Sells sausages" when nobody verified a sausage

That keeps the search recall high while leaving the shown claim as defensible as
the tier and evidence note.

### Layer 4 — an honest fallback

If the query maps to any food or drink concept and still scores nothing, shortlist
**farm shops by geography** rather than the first 40 businesses in the file. For
food, near-total recall is the correct behaviour: almost any farm shop sells
vegetables, and "here are the farm shops near you" is a far better answer than
"no results".

## On re-checking every couple of months

Short answer: **no — and a calendar re-check is the wrong instrument anyway.**
Facts age at wildly different rates, so one cadence is either wasteful or useless.

| Fact | Ages over | Cadence |
|---|---|---|
| Has a butchery / bakery / deli counter | years | annual |
| Category tag (beef, cheese, veg) | 1–3 years | annual |
| Seasonal produce (asparagus, strawberries) | weeks | **don't store as a fact** — store the season window, which is stable year to year |
| Named products, prices | days | never store |

Layer 3 is deliberately built out of the slowest-ageing facts available, which is
what makes an annual cadence defensible.

Instead of blind re-checking, use **change detection**:

1. Monthly, fetch the shop page and compare a content hash (or `ETag` /
   `Last-Modified` where offered). Costs nothing, no model call.
2. Re-run extraction only where the hash moved. In practice that's a small
   fraction of sites each month.
3. Re-pull Shopify/Woo feeds monthly regardless — they're free and structured.
4. Full re-extraction annually, whether or not anything changed.
5. Drop tags older than ~18 months rather than showing them undated.

The monthly hash check pays for itself on a different problem: it catches **dead
sites and closures**, which damage the map's credibility far more than a stale
sausage does.

Two free sources make the whole cycle lighter: the submission form should ask
"which counters do you have?" as well as "what do you sell", and the planned email
campaign can ask the same. Self-reported department data is better than anything
scraped and arrives maintained.

## Honest limits

- No index can tell anyone whether the sausages are on the counter *today*. Phrasing
  should point at the counter, not the product.
- Farm shops that are purely seasonal (PYO-only) will look thin year-round. Flag
  them by season rather than tagging them sparsely.
- The department inference table is a judgement, not a measurement. It should live
  in one readable file, be short enough to audit in a sitting, and stay conservative
  — "butchery implies sausages" is safe, "butchery implies venison" is not.

## Suggested order

| Step | Work | Effect |
|---|---|---|
| 1 | Invert lexicon for queries + fix word boundaries | "sausages", "cider", "ale" start working on the 32 shops with feeds |
| 2 | Merge the harvested index into the shipped catalogue | ~3× the tags on those 32 |
| 3 | Replace the padding fallback with a geographic farm-shop fallback | No more false "no results" for food |
| 4 | Department extraction over the 39 feedless shops + inference table | The other 55% of farm shops become findable |
| 5 | Monthly hash check, annual re-extraction, `checked` dates on display | Self-maintaining, and catches closures |

Steps 1–3 are a few hours' work on existing data and fix most of what you noticed.

---

## What was built (13 August 2026)

### One lexicon, three consumers

`scripts/lib/product-vocab.js` gained a `QUERY_EXTRA` list and
`serializeLexicon()`. `scripts/lib/query-expand.js` is the single implementation
of query expansion and stage-one scoring. `scripts/update-search-api.js` copies
it verbatim into two generated files:

- `api/ai-search.js` — the serverless search function
- `assets/query-expand.js` — the browser build, loaded by `index.html`

Nothing is retyped anywhere, which is what stops the tagging side and the search
side drifting apart again. Rebuild both with `node scripts/update-search-api.js`.

`QUERY_EXTRA` is separate from `VOCAB` on purpose. `VOCAB` is shop language and
must stay tight, because every word in it can create a tag. `QUERY_EXTRA` is
kitchen-table language — *bangers, spuds, a joint of beef, somewhere with a
butcher* — which never appears in a product feed and so must never influence
tagging, but is exactly what people type.

### The browser had the same bug, and it was the one you were seeing

`index.html` runs its own local search whenever the API is slow, rate-limited or
down. It decided whether it had "understood" a query by checking the word against
a vocabulary built from the catalogue's own text — so "sausages", which no listing
spells, came back *not understood*, and the page printed "No results for
sausages" while the map was full of butchers. It now also asks the shared lexicon,
and counts a query as understood when it knows what the query **means**.

If `assets/query-expand.js` fails to load, `expandToTags()` returns `[]` and
search degrades to exactly its previous behaviour rather than throwing.

### Data

`scripts/merge-product-index.js` merges the harvest into `businesses.json`:
**128 tags added across 23 farm shops**, and a `products_checked` date stamped on
each. Rules are documented in the file header — hand tags are never dropped,
strong tags are taken as they come, weak tags need three supporting products
**and** must survive a re-read of their own stored evidence under today's noise
rules.

That last rule earned its place immediately. Four tags failed it:

| Business | Tag | Evidence |
|---|---|---|
| Macknade | eggs | "Big Green Egg - XL" — a barbecue |
| Stansted Park | eggs | "Big Green Egg Course" |
| Ardross Farm | dairy & cheese | "Whipped Tallow Butter – Aloe & Prickly Pear" — a skin balm |
| Weetons | poultry | "Duck Fat Yorkshire Puddings" |

### Two things found along the way

**The merge is scoped to food and drink, deliberately.** Running it across every
group would have added ~1,350 clothing and ceramics tags, and spot-checking them
showed the harvest records what a shop **stocks**, not what it **makes**: Sub Zero
picked up "bags & leather goods" from a Lifeventure boot bag, Budd would have
gained "dresses" and "umbrellas", Campbell's of Beauly "childrenswear" off a baby
balm. The map's claim is about making, so those need your eye before they ship —
`--all-groups` runs it when you want to review them. For a farm shop the
distinction doesn't arise: stocking cheese is precisely what makes it the right
answer to "where can I buy cheese".

**Ten pre-existing false tags were pruned.** Food and drink tags had been shipped
on non-farm businesses, all of them misread trade vocabulary: *veg tan* leather
became `fruit & veg` (Barnes & Moore, Cherchbi, Everbound), *duck cotton* became
`poultry` (Blackhorse Lane, Paul Brown, The Cotton London, Palava, Carradice), and
a slate cheeseboard became `dairy & cheese`. A shirtmaker tagged poultry costs
more trust than it wins searches. The prune is narrow on purpose — it does *not*
remove every tag that fails category gating, because some cross-craft tags are
true: Anta really does weave tweed as well as throw pots, and David Mellor really
does make tableware.

### Verification

`node scripts/test-search.js` — 18 cases, run against the **generated** API file
rather than the library, so the inlining step is covered too. It asserts on the
shortlist handed to the model, not on the model's ranking, because the fault was
never in the ranking: the right businesses never reached it.

Before and after, on the live catalogue:

| Query | Before | After |
|---|---|---|
| `sausages` | seh-kelly, united-overalls, private-white-vc *(all clothing)* | knepp-wild-range, gazegill-organics, eversfield-organic |
| `british cider` | british-sheepskin, the-british-belt-company *(matched "British")* | darts-farm, gazegill-organics, pipers-farm |
| `ale` | maple-farm-**kels*ale***, hiut-denim | gazegill-organics, pipers-farm, daylesford |
| `bangers` | nothing | knepp-wild-range, gazegill-organics, eversfield-organic |

The non-food controls — `pottery yorkshire`, `leather bag cornwall`,
`kitchen knife`, `tweed jacket`, `silver ring` — return byte-identical results
before and after, which was the point of testing them.

### One thing not fixed

`pottery yorkshire` puts Glosters (Wales) and Grayshott (Surrey) above any
Yorkshire pottery in the *local* search. That predates this change and is
unaffected by it — the local scorer weights product above place by design, and
the AI path normally handles ordering. Worth a look separately.
