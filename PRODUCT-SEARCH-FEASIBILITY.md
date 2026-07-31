# Product-level search — feasibility

*31 July 2026. Question: can search answer "which ceramic makers sell pet food
bowls?" or "which tailors sell knitted vests?" — and would it be too slow?*

## Verdict

Feasible, worth doing, and **it would make search faster than it is today** —
but only if the architecture changes at the same time. Bolting product data
onto the current design is what would make it slow.

Two things need separating:

- **The speed problem** is caused by the current design sending the *entire*
  catalogue to the model on every search. That's already ~26k tokens.
- **The data problem** is getting product information at all.

Fix the first and the second becomes cheap.

## Why "store the list in the code" would be slow

Measured, today: 472 businesses = 105,457 characters ≈ **26,400 tokens** sent
on *every single search*. Descriptions alone are 38% of that.

Add product data to the same blob:

| Product tags per business | Total prompt | Effect |
|---|---|---|
| none (today) | ~26k tokens | 3–6s |
| 20 tags | ~55k tokens | roughly 2× slower |
| 40 tags | ~83k tokens | roughly 3× slower |

And that's *tags*. Actual product listings — names, variants, prices — would be
300k+ tokens and cost real money per search.

So your instinct is right: done naively, it kills the feature.

## The fix: stop sending everything

Two-stage retrieval, which is how every real search system works:

1. **Narrow locally.** A prebuilt index maps product terms to business IDs.
   Runs in the browser or the function in ~1ms, costs nothing. 472 → ~40
   candidates.
2. **Let the model rank those 40.** Prompt drops from 26k to ~3k tokens.

Net effect: **more data stored, less data sent.** Searches should land under
two seconds, and cost per search falls by roughly 90% — today every query bills
~26k input tokens whether the user asked about socks or slate.

## What to store — taxonomy, not catalogue

This is the important design call. Don't mirror their shops. Store a
**controlled vocabulary of product types** per business:

```
emma-bridgewater: [mugs, bowls, plates, platters, pet bowls, tins, tableware]
oubas:            [jumpers, cardigans, waistcoats, hats, scarves]
```

Advantages over scraping full catalogues:

- **Small.** ~20 tags ≈ 200 chars per business; the whole index is ~95KB,
  comparable to what you already ship.
- **Ages slowly.** A pottery that makes pet bowls will still make them next
  year. Individual SKUs and prices change weekly; product *types* don't.
- **No copyright exposure.** You're storing derived facts, not their
  marketing copy or images.
- **Answers the actual questions.** "Pet food bowls" and "knitted vests" are
  type-level queries, not SKU-level ones.

Use a fixed vocabulary (a few hundred terms) rather than free text, so that
"jumper", "sweater" and "pullover" collapse to one tag and the index stays
searchable.

## Getting the data

**Shopify is the unlock.** Tested 12 sites from the current data: 6 returned a
complete structured product feed at `/products.json` — free, official, no
HTML parsing. The other 6 failed on browser CORS, which server-side fetching
avoids, so the true rate is higher. Small UK makers are heavily Shopify,
Squarespace and WooCommerce, all of which expose structured product data or a
clean `/sitemap.xml`.

Suggested cascade per business:
1. `/products.json` (Shopify) — structured, complete.
2. `/sitemap.xml` → product URLs → titles.
3. Fallback: fetch the shop/collections page and have a cheap model extract
   product types from the HTML.
4. Give up gracefully and leave the business untagged rather than guess.

**Cost is negligible.** ~472 sites × a small extraction call ≈ **£1–2 per full
refresh** on a Haiku/Flash-lite class model. Quarterly refreshes are pocket
change. The cost here is engineering time and breakage, not tokens.

**Etiquette and legality:** respect `robots.txt`, rate-limit to a request every
second or two, set a real User-Agent identifying the project with a contact
address, and cache aggressively. Storing derived tags is defensible;
republishing their descriptions or images is not.

## The real risk: staleness, not speed

Given this project's history, the honest warning is that **wrong product data
is worse than no product data.** Telling someone a pottery sells pet bowls when
it stopped two years ago is the same credibility failure as an invented
listing — and at product level it's far harder to spot.

Mitigations:
- Store a `products_checked` date per business and show it, exactly as you do
  with evidence notes.
- Phrase results honestly: "listed as making…" not "sells".
- Never let product tags *override* the map's core claim. A tag is a
  discovery aid; the tier and evidence note remain the verified content.
- Re-run extraction quarterly; drop tags older than ~12 months.

## Two free sources you already have

1. **The submission form.** Add "what do you make?" — self-reported, accurate,
   and maintained by the person who knows. Every new listing arrives tagged.
2. **The email campaign** already planned for clay sources and logos. Ask the
   same question. Businesses are motivated to be findable.

These are better data than scraping, and cost nothing.

## Honest limits

- **Precision.** Type-level tags can answer "tailors who do knitwear"; they
  cannot reliably answer "tailors who do *knitted vests* in lambswool". Tag
  conservatively and let the model hedge rather than over-claim.
- **Bespoke makers.** Many of the best listings are made-to-order and have no
  product catalogue at all. They'd stay untagged, and shouldn't be penalised
  in ranking for it.
- **Farm shops** change stock seasonally — tag categories (veg boxes, own
  beef, raw milk), never specific produce.

## Suggested phasing

| Phase | Work | Outcome |
|---|---|---|
| 1 | Two-stage retrieval on *existing* data — local prefilter, send a shortlist | Search gets faster immediately; no new data needed |
| 2 | Controlled vocabulary + Shopify feed harvest for the easy ~50% | Product search live for half the catalogue |
| 3 | Sitemap + LLM extraction for the remainder; add `products_checked` dates | Full coverage, dated |
| 4 | Embeddings for semantic matching ("vest" → waistcoat, gilet) | Handles vocabulary the tags missed |
| 5 | Form + email capture; quarterly refresh job | Self-maintaining |

Phase 1 is worth doing regardless of whether you ever add product data — it
makes today's search faster and cheaper on its own.
