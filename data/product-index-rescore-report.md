# Product index — rescore report

*Generated 2026-09-01 by `scripts/rescore-product-index.js`. Offline pass over the existing harvest — no sites were re-fetched.*

```
Rescore summary
---------------
index entries              471
  of which harvested       336
tags before                2232
tags after                 2230  (100% retained)

dropped: category-gated    7
dropped: modifier/head-noun   0
dropped: no longer matches 0
added from product_type    0
businesses left with none  0
```

## What changed

Three rules were added: category gating, head-noun suppression for food and drink words, and an expanded noise list. Tags are now also marked **strong** (from the shop's own `product_type` taxonomy) or **weak** (from a free-text product title only).

### Dropped — implausible for the business category (7)

A tag whose group does not belong to the business's category on the map.

| Business | Category | Tag | Evidence |
|---|---|---|---|
| barnes-and-moore | clothing | watches | nato watch band deep honey |
| norman-walsh | clothing | dairy & cheese | Dorset - Ecru Milk Tea 25ssensign Hot sales lifestyle NEW |
| chris-keenan | ceramics | drinks & spirits | the rum kitchen |
| chris-keenan | ceramics | coats & jackets | fur coat no knickers |
| chris-keenan | ceramics | jeans & denim | pepe jeans london |
| chris-keenan | ceramics | jewellery | joy everley fine jewellers |
| chris-keenan | ceramics | footwear & boots | boots |

### Dropped — food word was modifying an object (0)

The food word is a motif or a modifier; the product is the object that follows it.

_None._

### Dropped — no longer matches the corrected rules (0)

Usually a noise word (colour, material, care product) that now gets stripped.

_None._

### Added from the shop's own product_type (0)

These were missed before because the old rules only read product titles.


## Still to do before merging

- Tags marked **weak** rest on a single product title. Consider requiring
  two or more supporting products, which needs per-tag counts from a fresh
  harvest — the current index does not store them.
- 0 businesses came out of this pass with no tags at all.
- Nothing has been written to `businesses.json`.
