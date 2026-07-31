# Data integrity audit — 31 July 2026

Triggered by a review of the 259 records added since commit `3049b5a`.
**Finding: a cluster of listings appear to be fabricated — real-sounding
businesses that do not exist.** They must be removed or evidenced before the
site is promoted, because "every listing carries public evidence" is the
entire proposition.

## How they were spotted

Four signals appearing together:

1. **Uniform naming pattern** — `Placename + Craft + Category noun`
   ("Glasgow Knife Co", "Belfast Silver Cutlery Studio", "Mull Iron Works
   Kitchenware", "Rhosmeirch Pottery").
2. **Convenient geographic gap-filling** — they appear exactly where the map
   had holes (Glasgow, Edinburgh, Belfast, Mull, Highlands, Mid Wales,
   Anglesey, Isle of Wight), which is what you'd generate if asked to spread a
   category around the UK.
3. **Plausible but non-existent domains** — `glasgowknifeco.co.uk`,
   `belfastcutlery.co.uk`, `mulliron.co.uk`, `wynnstayforge.co.uk`.
4. **All marked `gold` / `high` confidence** with short, generic evidence
   notes ("Hand-forged in X workshop using British steel") — the opposite of
   this project's default-to-Silver-when-unproven discipline.

Web searches for each returned nothing, while returning *real* makers in the
same niche and place — which is the tell. Real Portland Works knifemakers are
Michael May and Stuart Mitchell, not "Chavant" or "Iovene". Real Skye potteries
are Uig, Skio and Edinbane (we already have Edinbane), not "Skye Pottery".

## Suspected fabrications — DELETE unless evidence is produced

### Cutlery (10 of the 20 in the category)

| id | name | note |
|---|---|---|
| glasgow-knife-co | Glasgow Knife Co | no trace; real Glasgow-area smiths exist (Flett Forge, Iron Haggis) |
| edinburgh-silver-cutlery | Edinburgh Silver Cutlery Studio | no trace |
| belfast-silver-cutlery | Belfast Silver Cutlery Studio | no trace; a real "Belfast Knife Co" exists but is a different thing |
| mull-iron-works | Mull Iron Works Kitchenware | no trace |
| wynnstay-ironware | Wynnstay Forge Kitchenware | no trace; "Wynnstay" is an agricultural supplier, not a forge |
| highland-custom-knives | Highland Custom Knives | no trace |
| welsh-ironmongery-studio | Welsh Ironmongery & Blacksmiths | no trace |
| castlescreen-ironware | Castlescreen Forge Kitchenware | shares a domain with the (real) Castlescreen Farm Shop — looks like an invented second listing on a real farm's URL |
| iovene-knives | Iovene Custom Cutlery | no trace at Portland Works |
| chavant-knives | Chavant Knives | no trace at Portland Works |

**Genuine and worth keeping:** David Mellor, Netherton Foundry, Samuel Groves,
Savernake Knives, Robert Welch, Taylor's Eye Witness, Inigo Jones Slate Works,
Glosters, Crane Cookware. (Samuel Staniforth is a real historic Sheffield firm
but the attached URL `smithfieldknives.co.uk` should be checked.)

### Ceramics (8 suspected)

Skye Pottery · Borve Pottery · Rhosmeirch Pottery · Movilla Pottery ·
Fife Pottery · Pembrokeshire Pottery · Isle of Wight Pottery ·
Hornsea Studio Pottery

**Genuine in the same batch:** Griselda Hill (Wemyss Ware), Ewenny Pottery,
Winchcombe Pottery, Grayshott Pottery, Pottery West, Reiko Kaneko, Dartington
Pottery, Cotswold Pottery, Tain Pottery, Glosters, Middleport Clay Studio.

### Farm & clothing — spot-checks passed

The 25 new farm shops and 173 new clothing brands sampled as **real**
(Craigies, Kilnford, Gloagburn, Bodnant, Hawarden, Broughgammon, Welbeck,
Goat Shed, Darts Farm; Arbon Socks, Alison Moore Designs, ELWIN). These came
from real source lists (the britishmadeclothing.co.uk queue), which is why
they held up. **The fabrications cluster in the two categories built without
a source list** — cutlery and the regional-fill ceramics.

## Recommended actions

1. Delete the 18 suspected records (or move to a `pending-verification` file).
2. Re-run the ~10 genuine cutlery entries through the normal verification
   process and re-tier them — 90% gold at high confidence is not credible for
   a category built this way.
3. Adopt the rule that fixed this before: **a listing may only be added from a
   named source** (a directory, an association's member list, a show's
   exhibitor list) — never from a model's recall of "makers in X".
4. Consider adding a `source` field to each record recording where the lead
   came from. It makes this class of error impossible to hide.

## Other observations (not integrity issues)

- **Tier drift across categories.** Gold share: cutlery 90%, farm 82%,
  jewellery 73% vs clothing 36%, ceramics 34%. The clothing and ceramics
  numbers reflect the strict rulebook; the others don't. Farm shops in
  particular were originally Silver whenever they stocked *any* imported
  lines — 58 of 70 at Gold suggests that test stopped being applied.
- **39 evidence notes are under 60 characters**, some as short as
  "Own-grown produce." Those can't be audited by a reader, which is what the
  evidence note is for.
- 112 records have an empty `instagram` field (harmless, just uneven).
