# Grown and Made UK — Illustration brief

A standalone commission brief for the drawn assets. Use this on its own when the job is *producing artwork*; use `DESIGN-BRIEF.md` when the job is layout, palette and system. This document repeats the small amount of context it needs so it can be pasted alone.

---

## Context in one paragraph

Grown and Made UK is a map and directory of 472 British makers and growers — clothing, farms, ceramics, jewellery and watches, cutlery — each verified as genuinely made or grown in the British Isles. It must feel sophisticated and quietly British without ever reading as nationalist: no bulldogs, no bunting, no red-white-blue. Britishness comes from cartography and heritage print, not from patriotism.

---

## House style — applies to every asset

- **Idiom:** Victorian trade-catalogue engraving. Cross-hatched line-work, the register of a 19th-century tool catalogue or an Ordnance Survey sheet.
- **Colour:** line-work only, in racing green `#004225` or near-black `#1C2620`, on warm paper `#FAF6EE`. No fills, no shading blocks, no gradients. Backgrounds transparent.
- **One-accent rule:** if a piece needs a single point of colour, it is brass `#C8A24A` and it appears exactly once.
- **Hatching:** consistent angle and density across the whole set — pick one hatch angle and hold it. The set must read as one hand, one sitting.
- **Line weight:** two weights only — a contour weight and a hatch weight, roughly 2:1.
- **No faces.** Hands, tools and materials only. This keeps the focus on the work and avoids the casting problem entirely.
- **Action, not still life.** A tool mid-cut, a hand mid-throw. Not a product photographed against white.
- **Draw for 24px first.** Every piece must survive as a filter-chip mark at 24px and still hold up at 400px. If it turns to mud when you shrink it, it is over-hatched.

---

## Asset 1 — the five trade engravings

One per category. These carry the most weight: they become category filter marks, empty-state art, section dividers, and the reveal layer for the cursor effect.

| Category | Listings | Subject (pick one, alternates in brackets) |
| --- | --- | --- |
| Clothing | 294 | A cobbler's hands working a shoe on a last (or: a shuttle crossing a loom; a tailor's tape across a shoulder) |
| Farms | 70 | A wheel of cheese with a wire drawn through it (or: pigs at a trough; a hand pulling leeks) |
| Ceramics | 63 | Hands on clay mid-throw at the wheel (or: a kiln door; a glaze pour) |
| Jewellery & watches | 38 | A ring on a mandrel under a raised hammer (or: a movement under tweezers) |
| Cutlery | 7 | A blade held to a grinding wheel (or: a bone handle being pinned) |

Deliver each at two crops: a **detail crop** for the 24px mark (the tool and the hand, nothing else) and a **full scene** for page art.

---

## Asset 2 — the recoloured flag

A Union Jack, and the recolouring is the entire point.

- Full flag geometry — saltires, cross, fimbriations, correct proportions and the off-centre diagonals. Get the geometry right; a wrong Union Jack is worse than none.
- **Recoloured into the heritage palette:** racing green `#004225` where the blue sits, deep oxblood or moss where the red sits, warm ecru `#F2ECE0` where the white sits. Do not desaturate the real flag to grey — recolour it, so it reads as a deliberate brand artefact rather than a washed-out flag.
- **Rendered as cloth, not as a graphic.** Soft folds, light catching a ridge and falling into a trough, the weight of real fabric. A flat vector version reads as clip art and as politics; dyed cloth in motion reads as material, which is the subject of the site.
- Deliver a **seamless loop** (~6s, webm/mp4, muted) plus a **static poster frame** for mobile and reduced-motion.
- It will be used behind content at **6–8% opacity only**. Design it to survive that: strong fold structure, generous scale, no small detail. If it is noticeable, it has failed.

---

## Asset 3 — the engraved British Isles

For the cursor-reveal on the landing page: move the mouse, graphite line-work appears in the trail.

- The British Isles in the Ordnance Survey / Admiralty chart idiom — coastline, contour lines, hachured hills, a faint graticule.
- Include Shetland, Orkney and the Hebrides. The site has listings on all of them.
- Must work under `mix-blend-mode: multiply` at low opacity — so, real line-work with clean transparency, not a flattened raster with a white background.
- SVG strongly preferred here, since it will be masked and scaled.

---

## Asset 4 — printer's ornaments

Small, functional, and the place the site earns its charm.

- A **manicule** — the Victorian pointing hand — for "show me on the map". Engraved, with a cuff.
- A **compass rose** for the map's locate control.
- A **wax-seal roundel** that can hold the Gold or Silver mark.

These are already British print vernacular, which is exactly why they work: they say heritage without saying nation.

---

## Output requirements

- **SVG preferred** for everything except the flag. Transparent background, no embedded raster, no clipping masks that break on scale.
- PNG fallback at 2× where SVG isn't possible.
- Filenames: `trade-clothing.svg`, `trade-farm.svg`, `trade-ceramics.svg`, `trade-jewellery.svg`, `trade-cutlery.svg`, `flag-heritage.webm`, `flag-heritage.jpg`, `isles-engraved.svg`, `ornament-manicule.svg`, `ornament-compass.svg`, `ornament-seal.svg`.
- Destination: `assets/illustration/`.
- Also deliver a short **style spec** — hatch angle, hatch spacing, the two line weights, crop conventions — so more can be commissioned later that match.

## Acceptance tests

1. Shrink any trade engraving to 24px. Is it still legible as its trade?
2. Put all five side by side. Do they look like one hand, or five?
3. Show any of them to someone and ask what country this is for. If they say "Britain" you've won; if they say "England" or hesitate, the cartography needs to do more.
4. Drop the flag to 7% opacity behind a paragraph. Can you still read the paragraph comfortably, and does the flag read as texture rather than as a flag?

---

## How to actually source these

The spec asks for 19th-century trade-catalogue engraving. That is not a coincidence to work around — **it is the cheapest route to the result**, because the source material is out of copyright.

**Preferred route: one catalogue, twenty-four drawings.** Find a single scanned Victorian trade catalogue — an ironmonger's, an agricultural implement maker's, a seedsman's — and pull as many of the 24 subjects as possible from that one volume. Everything drawn by one engraver for one publisher in one year is automatically "one hand," which is the hardest requirement in this brief and the one that AI generation fails at. Then vectorise (trace, clean, restroke to the three weights above).

Search Internet Archive for terms like `illustrated catalogue ironmonger 1880`, `agricultural implements catalogue engravings`, `seed catalogue 1890 illustrated`, and filter to full-view items.

**Gaps that won't exist in a Victorian catalogue.** Roughly six of the 24 are modern: the stack of folded t-shirts, the wristwatch with a leather strap, the high-heeled shoe, the pint glass in its current form, the dog bowl, the flat cap as we'd draw it now. These need to be drawn or generated *to match the sourced set* — which is much easier than establishing a style from nothing, because you'll have twenty reference drawings by then.

**If generating instead of sourcing:** produce the calibration drawing first, then feed it back as a style reference for every subsequent one. Never generate twenty-four independently; you will get twenty-four hands.

**Licensing:** verify each source individually. UK copyright in an engraving expires 70 years after the engraver's death, so genuine 1880s catalogue work is safe, but a modern *digitisation* may carry its own claimed rights depending on the institution. The CC0 collections below sidestep that question entirely.

---

## Paste-ready prompt

> I need a set of illustrations for a British makers directory. The full brief is attached. Work in the house style in section 2 — Victorian trade-catalogue engraving, cross-hatched line-work in racing green on warm paper, no faces, no fills.
>
> Start with **Asset 1 only**: the five trade engravings. Give me the clothing one first, in three variations, so I can choose the line weight and hatch density before you commit the rest of the set. Once I approve one, produce the other four to match exactly, then write the style spec.
>
> Do not start the flag or the ornaments yet.

Do the trade engravings first and get one right before generating the rest — the whole value of the set is that it looks like one hand, and that only happens if the first one sets the rules.
