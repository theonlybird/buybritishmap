# Grown and Made UK — Design Brief

Paste-ready brief for Claude Design. Work through the prompts in section 12 in order.

---

## 1. What this is

An interactive map and directory of **472 British makers and growers** — clothing, farms and farm shops, ceramics, jewellery and watches, cutlery. Every listing is manually verified as genuinely made or grown in the British Isles, and graded Gold or Silver against published, non-discretionary rules.

The purpose is to give people a real alternative to Amazon and to "designed in Britain, made in Shenzhen." It is a research tool, not a shop — we don't sell anything and take no commission.

Audience: design-literate British consumers, 30–60, who read Monocle or shop Toast and are quietly sick of disposable goods. Also journalists and the makers themselves.

**Current live pages:** map + grid (`index.html`), Gold & Silver methodology, About, FAQs, Contact, Submit a business.

---

## 2. Scope — what to design, what to leave alone

**Design these:**

- A new landing page (does not exist yet) with a transition into the map
- The map application shell: header, search, filter chips, results list, business card, map pin, popup
- The grid view (card layout, 290px min column)
- The five content pages, as one consistent template
- **Illustration assets** — the trade engravings (section 9) and the recoloured flag (section 3). These are the pieces I most need produced as actual files, not just specified.
- A design system I can hand to Claude Code

**Already settled, don't reopen:** the landing-to-map transition (section 8) is prototyped and approved. Gold and Silver are always the same size (section 8). The landing page has exactly one call to action.

**Do not attempt to rebuild:** the Leaflet map instance, marker clustering, the autocomplete, the filter logic, or the `/api/ai-search` endpoint. These work well and are out of scope. Design the surfaces around them and I'll apply the styling myself.

**Technical constraints to respect:**

- Static HTML/CSS/vanilla JS on Vercel. No framework, no build step. Single-file pages.
- Leaflet 1.9.4 and markercluster are loaded from CDN and impose some of their own DOM.
- Mobile is a bottom-sheet pattern over a full-bleed map. Desktop is a 360px left sidebar + map.
- There is an existing `prefers-reduced-motion` block — every animation you add must have a reduced-motion fallback.

---

## 3. The problem I'm trying to solve

The site functions well and looks like a generic SaaS dashboard: `#1f3a5f` corporate navy, `#f6f8fa` grey, 10px radii, soft grey drop shadows. It has no point of view.

I want **sophisticated, quiet, well-made** — the visual equivalent of the products on it. Think a good hardback book or an Ordnance Survey sheet, not a startup.

### The guardrail, stated plainly

There must be a sense of Britain, but the site must never read as nationalist. This is the single most important constraint in this brief. The Union Jack has been thoroughly claimed by the far right in the UK and any naive use of it will lose exactly the audience I want.

**Never use:**

- The Union Jack in its actual colours, anywhere
- Red, white and blue together at full saturation as the primary palette
- Bulldogs, crowns, lions, Big Ben, red buses, Spitfires, "Great British" set in bold caps
- Bunting, "keep calm" typography, wartime nostalgia of any kind
- Any language about foreign goods, protecting British jobs, or taking anything back

**Instead, take Britishness from:**

- **The flag's geometry, abstracted** — the saltire diagonals and their distinctive *off-centre* crossing, used as hairline rules, watermarks, section dividers, loading states. Line-work, never fill. At 6–10% opacity it reads as a considered watermark; at 100% it reads as a rally.
- **Cartography** — Ordnance Survey contour lines, grid references, Admiralty chart hatching, the coastline itself. This is the strongest and safest well to draw from and should do most of the work.
- **Heritage print** — letterpress impression, hallmark punches, assay marks, wool-bale stencils, seed-packet type, foundry stamps.
- **Landscape colour** — moss, slate, oxblood, ecru, brass. Britain as a place with weather, not a flag.

The test: it should feel like Britain the way *The Modern House* or the National Trust feels like Britain — through material and restraint — not the way a football shirt does.

### The one sanctioned use of the flag

There is exactly one place the Union Jack may appear, and it is tightly specified.

**Recoloured, not red and blue.** Take the flag's full geometry — saltires, cross, fimbriations, the lot — and render it entirely in the heritage palette: racing green `#004225` where the blue would be, a deep moss or oxblood where the red would be, and warm ecru rather than pure white. Removing the red-white-blue triad is what strips out the political charge; the shape survives, the rally does not. Do not simply desaturate the real flag to grey — recolour it into the palette so it reads as a deliberate brand artefact.

**Cloth, not graphic.** It must have the three-dimensionality of real fabric in motion: soft folds, the light catching a ridge and falling into a trough, slow drift. A flat vector Union Jack reads as clip art and as politics. A slowly moving piece of dyed cloth reads as material — which is the whole subject of the site.

**Background only, and very faint.** Maximum 6–8% opacity, sitting behind content, never as a hero element and never near a heading. It should be the thing you notice on the second visit, not the first. Good candidates: behind the About page masthead, or as the backdrop to the Gold & Silver methodology hero.

**Implementation.** A pre-rendered looping video (webm/mp4, muted, ~6 s, seamless loop) is the cheapest way to get convincing cloth. An SVG with an animated `feDisplacementMap` over turbulence is lighter but harder to make look like fabric — propose both and show me the difference. Whichever you pick: static poster frame on mobile, static under `prefers-reduced-motion`, and never a blocking asset.

If in doubt, take it further down in opacity. The failure mode here is it being noticeable.

---

## 4. Existing tokens — keep, kill, and why

```css
--racing-green:#004225   /* KEEP as primary. Best thing in the palette. */
--gold:#c8a24a           /* KEEP but desaturate slightly — currently a touch brassy-yellow */
--silver:#b8c2cc         /* REPLACE — reads as "disabled UI grey", see section 7 */
--red:#8c1d2c            /* KEEP as a rare accent only. Never near blue. */
--navy:#1f3a5f           /* KILL. This is the corporate-SaaS problem. */
--bg:#f6f8fa             /* KILL. Replace with a warm paper tone. */
--line:#e3e8ee           /* KILL. Cool grey. Replace with a warm hairline. */
--ink:#1d2733            /* Adjust warmer. */
--muted:#6b7682          /* Adjust warmer. */
--font-heading: 'Cormorant Garamond', Georgia, serif        /* KEEP, retune — see section 6 */
--font-body: 'Plus Jakarta Sans', -apple-system, sans-serif /* OPEN to replacement */
```

Category colours currently: farm `#3c9d4e`, clothing `#24549c`, ceramics `#b0653a`, jewellery `#7a5296`, cutlery `#374151`. These are too saturated and too evenly-spaced-on-the-colour-wheel — they look like a chart legend. Rework as five muted, unequal, earth-derived hues that still pass WCAG AA as map pin fills against both light and dark map tiles.

---

## 5. Palette direction

Build a system around **racing green as primary**, on **warm paper** rather than cool grey. Supporting range from the British landscape and workshop: slate, moss, oxblood, ecru, bone, brass, ink.

Give me the full scale — surface, raised surface, hairline, ink, muted ink, primary, primary-hover, and the five category hues — with contrast ratios checked. The site is majority white space with a big map in it, so the neutrals matter far more than the accents.

The map tiles themselves are part of the palette. Propose a Leaflet tile style (or a CSS filter over the current tiles) that sits with the rest — muted, low-contrast, letting the pins carry the colour.

---

## 6. Typography

Cormorant Garamond stays as the display face but needs retuning — it currently sits at default tracking and reads slightly generic-luxury. Tighten it, take it up in size and down in weight, and let it be genuinely large on the landing page.

For body, Plus Jakarta Sans is competent but neutral. I'm open to something with more character — a grotesque with British-foundry warmth, or a text serif if it can hold up at 13px in a dense sidebar list. Show me one alternative alongside the incumbent rather than a dozen.

Small caps with generous letter-spacing for labels and tier badges. Tabular figures wherever counts appear.

---

## 7. Gold and Silver — the heart of the brand

The tier system is the reason the site has any authority, and right now it's rendered as two pale badges (`#f6edd2` / `#eceff2`) that look like nothing.

**Gold** = the chain runs deep. Cloth woven here, clay dug or prepared here, metal worked from bullion at a British bench, food grown on the farm. 199 listings.

**Silver** = made or constructed in Britain, but the principal material was imported. Northampton shoes are Silver — iconic British construction does not override imported leather. 273 listings.

Silver is explicitly **not** a consolation prize, and the design must not make it look like one. For several trades Silver is the best Britain can currently offer, because the upstream industry no longer exists here. Some are Silver only because a maker hasn't yet told us who spins their yarn.

Design a tier treatment that reads as **hallmark or assay mark** — a struck, official, slightly archaic mark — rather than a gamification badge. It should feel earned and verifiable. Silver needs its own dignity: real metal, not disabled grey.

Show the treatment at three scales: 10px inline in a dense list row, 14px on a card, and large as a hero element on the Gold & Silver methodology page.

**Where the mark appears, and where it does not.** The hallmark is a *document* device — it needs a quiet surface and a moment's reading. Put it on surfaces that behave like paper: grid cards, sidebar list rows, map popups, the methodology page.

Keep it **off the map pins themselves.** A pin is glanced at, at 22px, over textured moving tiles. A struck mark at that size on that background is noise. On the map, tier is carried by the pin alone.

---

## 8. Landing page

Currently there is none — visitors land straight on the map. I want a landing page that establishes what this is and why it's credible, then transitions into the map.

**Content, roughly:**

- Wordmark: *Grown and Made UK*
- One line on what it is. Restrained, no exclamation, no "discover amazing."
- The number — 472 verified makers — and the categories
- A single primary action: **Go to the map**, and nothing else

No secondary link, no "learn how Gold and Silver are decided", no footer matter. One action only. Anything competing with the button weakens it, and the methodology page is one click away from the map anyway.

**Honest caveat I want you to design around:** a gate in front of the map costs SEO and bounce rate, and repeat visitors will resent it. So:

- Landing lives at `/`, map moves to `/map` — real URLs, so the map is directly linkable and indexable
- Use `sessionStorage` so the full sequence plays on first visit only; on return, land straight through
- The transition must be skippable — any click, key, or scroll cuts to the map immediately

**The transition itself.** Pencil lines resolving into the UK coastline, which then hands over to the live map. It should feel like a map being drawn, not like an intro video. Timing is settled — see the table below.

**Direction 3, the maker constellation, is the chosen one.** It has already been prototyped and approved; a working build lives at `landing-prototype.html` in the repo, with `data/prototype-data.js` and `data/uk-coast.json`. Match its behaviour rather than reinventing it. The other three are recorded here as context for the decision, and as fallbacks if 3 fails on a real device.

1. **Saltire resolve.** Four diagonals strike in from the corners of the viewport, cross slightly off-centre, hold for a beat, then fade out as the coastline draws itself. The flag geometry appears and is immediately superseded by the country — which is more or less the argument the whole site is making.
2. **Contour bloom.** Concentric Ordnance Survey contours ripple inward from beyond the frame and settle onto the coastline. No flag reference whatsoever. The safest option and possibly the most sophisticated.
3. **Maker constellation.** The 472 listings land first as scattered gold and silver points, then the coastline draws itself around them. The country is described by its makers before it's outlined. Strongest conceptually, and it doubles as a genuine first read of the dataset.
4. **Engraved plate.** Two strokes very slightly out of register — racing green and a brass hairline — then cross-hatching fills the landmass. Reads as a letterpress misprint. Warmest and most tactile; the most "printed object" of the four.

Use 2 as the shorter returning-visitor variant if one is needed.

**Timeline for direction 3.** Total **4600ms** — deliberately slow, and tested at this pace against faster alternatives.

| Time | What happens |
| --- | --- |
| 0–2100ms | 472 pins land, staggered from the centre outward. Small scale-up with a slight overshoot, no bounce. |
| 1100–3100ms | Coastline draws itself around them, racing green, single continuous stroke. |
| 2900–3400ms | Coastline thins to a hairline, map tiles fade up beneath. |
| 3200–3700ms | Pins converge into cluster bubbles with counts. |
| 3650–4600ms | Header and search fade in, intro overlay retires. |

**On the length.** 4.6s is far longer than a page-load budget would normally allow, and that is a decision, not an oversight. It is affordable only because of the `sessionStorage` skip: the sequence plays on the first visit and never again in that session. A slow reveal seen once is a different proposition from a slow site. If the skip is ever dropped, this timing must be cut back to about 1.2s.

**Design decisions to resolve when building it:**

- **The pins must be real.** Project the actual 472 records — not a decorative scatter. The density is the point: the clumping around London, the West Country, the Scottish central belt is a true first read of the dataset, and anyone who knows British making will recognise it.
- **The handover must be continuous.** The pins that land during the intro should become the map's real cluster markers, not fade out and get replaced. If they blink, the whole illusion collapses and it becomes an intro video.
- Stagger pins by distance from the centre of the map, not by array index — a radial bloom, not a random sparkle.
- **Gold and Silver pins are exactly the same size.** Colour is the only difference between them, everywhere on the site — map pins, list rows, grid cards, tier marks. Size encodes importance, and Silver businesses are not less important; they are real workshops, and for several trades Silver is the best Britain can currently offer. Making them smaller would contradict the argument the Gold & Silver page makes. This overrides any instinct to weight the hierarchy.

**Non-negotiables for whichever wins.** Instant cut under `prefers-reduced-motion`. Skippable on any click, key or scroll. Must not delay the Leaflet instance booting behind it. Coastline geometry should come from real projected data, not a traced approximation — the site is a map, and a wrong coastline would be noticed by exactly the people we want.

One technical gotcha, found while prototyping: use **50m** Natural Earth resolution, not 110m. The 110m outline drops Shetland, Orkney and most of the Hebrides, which leaves any island maker floating in open sea. We have listings up there.

---

## 9. Illustration — the trades

This is the main visual asset of the site and needs its own system.

Cross-hatched engravings in the Five Pathways / Victorian trade-catalogue idiom (section 10a): black or racing-green line-work on warm paper, no fills, no colour except where a single accent earns it. Drawn from the work itself — hands and tools mid-action, not still-life product shots.

**Subjects, drawn from what's actually on the site:**

- **Clothing (294 listings)** — a cobbler's hands working a last; a tailor's tape across a shoulder; a shuttle crossing a loom; a knitting frame; a cutting table with chalk marks
- **Farms (70)** — pigs at a trough; a wheel of cheese with a wire cutting through; a hand pulling leeks; a milk churn; an orchard ladder
- **Ceramics (63)** — a wheel mid-throw with hands on the clay; a kiln door; a glaze pour
- **Jewellery & watches (38)** — a ring on a mandrel under a hammer; a jeweller's loupe; a movement under tweezers
- **Cutlery (7)** — a blade on a grinding wheel throwing sparks; a bone handle being pinned

**Rules:**

- One illustration per category, reusable as: category filter mark, empty-state art, section divider, and the reveal layer described in the appendix
- Consistent line weight and hatch density across the whole set, so they read as one hand
- Landscape-agnostic — these must work at 24px as a filter chip mark and at 400px as page art. Draw for the small size first
- No faces. Hands, tools and materials only. Keeps it about the work and avoids the casting problem entirely

If Claude Design can't generate these consistently, produce three finished examples plus a written spec (line weight, hatch angle, hatch density, crop conventions) that I can commission an illustrator against.

---

## 9b. Ambient motion elsewhere

Gentle and few. Hairline rules that draw rather than appear, filter chips that feel struck rather than toggled, cards that lift on a warm shadow, the loading spinner replaced with something cartographic. Nothing should move without being touched.

**Grid view — staggered entrance.** Reference: `normalisboring.es`. Their trick is **differential velocity**: as you scroll, elements enter from different axes at different speeds, so the page assembles itself rather than simply appearing. Applied to our grid:

- Cards enter on scroll with a small offset — roughly 24px translate plus a fade — not a scale or a flip
- **Stagger by grid position, not by DOM index.** A wave running diagonally across the grid reads as intentional; a straight top-to-bottom cascade reads as a slow page
- Cadence around 40–60ms between neighbours, each card's own transition ~400ms. Fast enough that a fast scroller never waits
- Alternate the entry axis by column so it syncopates rather than marches
- **Only animate below the fold.** Cards already in view on load appear immediately — never make someone wait to read the first result
- **Skip entirely under about 8 results.** As I noted, a 3-card result set doesn't need choreography; it needs to be there. Below the threshold, no animation at all
- `IntersectionObserver`, animate once, unobserve. Never re-trigger on scroll-up
- Off under `prefers-reduced-motion`

---

## 10. References

### 10a. The two that define the target

These two sites together describe the register I want: **warm, a little playful, but unmistakably grown-up.** Not solemn, not corporate, not whimsical. I've looked at both closely — notes below are from inspecting them, not guesswork.

---

**klimtwine.com** — *for the interaction craft*

Austrian wine brand, built by agency Dops on Next.js + Strapi.

What it does:

- A preloader — a wine glass filling 0→100% over a warm greige `#CFC6BD`, with the line "Passion and culture loading…" — then the whole plate lifts away like a curtain.
- A **scroll-locked hero**: the headline *Where Art Meets Wine* types itself out one letter at a time, each glyph dropping and settling into place, while a gnarled 3D vine rotates and a bottle rises through it. Scroll drives a timeline rather than the page.
- The thing I actually want: **a pencil drawing revealed by the cursor.** Move the mouse and graphite line-work appears in the trail, then fades. It's set to `mix-blend-mode: multiply`, so it reads as drawn *into* the paper rather than pasted on top. See the appendix for how it's built.
- Elsewhere: a video thumbnail set *inside* a headline, between words.

What to take: the cursor-reveal, the multiply-blend drawing layer, the letter-by-letter headline, the sense that the page is being made in front of you.

What to leave: the eight-second preloader, the scroll hijacking, and the WebGL weight. Klimt Wine is a brochure — nobody arrives with a task. My users arrive wanting to find a shoemaker in Northampton. Borrow the craft, not the self-indulgence.

---

**fivepathways.com** — *for the warmth*

US retirement advisers. Should be the dullest possible brief; it's charming instead.

What it does:

- **Palette:** warm cream `#FFFAF5` throughout, banded with `#FAF5E8`, a butter `#FCEFCF` and a pale sage `#EEF3E7`. Ink is pure black. Exactly **one** bright colour — a mint `#63CFBF` — used only on buttons. That discipline is why it feels calm rather than busy.
- **Illustration:** hand-drawn cross-hatched engravings — pines, clouds, a lake, a shoreline — rendered as pure black line-work on the cream. One object in the whole scene is in full colour: a hot-air balloon. That single point of colour is the entire trick.
- **Victorian printer's ornaments** used as UI: an engraved compass above a section heading, and a gold wax-seal coin with a **pointing hand** (a manicule) as the persistent floating button. Archaic, functional, and quietly funny.
- **Handwriting that draws itself** — script text strokes on letter by letter as you scroll, like a fountain pen writing.
- Type: a high-contrast display serif for headlines against a plain geometric sans for body. Two voices, clearly separated.

What to take: the warm-cream-plus-black-line-work formula, the one-accent-colour discipline, engraved ornaments as interface, and above all the **register** — a serious subject handled with a light hand.

Direct translations for us: the manicule and compass are already British print vernacular. A pointing hand for "show me on the map." A compass rose for the locate control. Cross-hatched engravings of a loom, a potter's wheel, a sheep, a bench vice as category marks.

### 10b. Supporting references

- **Ordnance Survey map sheets** and **Admiralty charts** — the key well. Line weight, contour, grid, the specific greens and buffs.
- **The Modern House** — restraint, photography, generous type
- **Toast** and **Sunspel** — British without saying so
- **Hiut Denim** — maker-story credibility
- **Monocle** — editorial density done elegantly
- **National Trust** — heritage without jingoism
- **Assay office hallmarks** and **letterpress specimen sheets** — for the tier marks
- **Victorian trade-catalogue engravings** — for category ornaments

---

## 11. Deliverables

1. A design system: colour scale with contrast ratios, type scale, spacing, radii, shadow, motion tokens — as CSS custom properties matching my existing `:root` naming so I can drop them in
2. Landing page, full comp, desktop and mobile
3. The transition, as an interactive prototype
4. Map shell: header, search, filter chips, sidebar list row, map pin, popup — desktop and mobile
5. Grid card
6. Content page template
7. Gold/Silver tier marks at three scales
8. **The trade engravings** — five category illustrations plus the drawing spec (section 9), as SVG or transparent PNG at 2× 
9. **The recoloured flag asset** — the heritage-palette Union Jack described in section 3, as a seamless loop plus a static poster frame
10. A Claude Code handoff bundle

---

## 12. Prompt sequence

Run these in order. **Do not attach the codebase until step 3** — if Claude Design reads the repo during onboarding it will faithfully extract the exact look I'm trying to escape and call it my brand.

**Step 1 — mood, no code.**
> Here is a brief for a British makers directory, plus reference images. Use the web capture tool on klimtwine.com and fivepathways.com — section 10a explains what I want from each. Do not generate layouts yet. Read section 3 carefully — the constraint about avoiding nationalist visual language is the most important thing here. Give me three divergent art directions as mood boards: palette, type pairing, texture, illustration style, and one paragraph on how each expresses Britishness without the flag. All three should hit the register described in 10a: warm, slightly playful, still sophisticated.

**Step 2 — pick and build the system.**
> Direction [N]. Build this into a full design system: colour scale with contrast ratios, type scale, spacing, radii, shadows, motion tokens. Output as CSS custom properties. Then show me the Gold and Silver tier marks per section 7, at all three scales.

**Step 3 — now bring in the code.**
> Here is my existing codebase. This is a component inventory, not a brand — the current styling is what I'm replacing. Restyle the map shell, sidebar list row, map pin, popup and grid card into the new system. Keep the existing DOM structure and class names so I can swap the CSS without touching the JavaScript.

**Step 4 — landing.**
> Design the landing page per section 8, desktop and mobile.

**Step 5 — transition and illustration.**
> Build the landing-to-map transition as an interactive prototype. Section 8 lists four prototyped directions — refine the two strongest and show the reduced-motion fallback. Separately, produce the three trade engravings and the illustration spec from section 9.

**Step 6 — handoff.**
> Package everything as a Claude Code handoff bundle. Flag anything that requires JavaScript changes rather than CSS-only.

---

## 12b. Comp review — corrections to the first Claude Design pass

The first pass is good and most of it stands. Five corrections, in priority order. Numbers below are measured from `Grown and Made.dc.html`.

### 1. Grid cards go white; the page stays beige

The comp sets the card background to `#FAF7F0` and the page background to `#FAF7F0` — **the same value**. The only thing separating a card from the page is a `#E9E2D3` hairline at a 1.21:1 ratio. That is why the grid is harder to read than the old design despite being better looking: there is no figure/ground, so the eye can't chunk the page into discrete objects.

- **Cards:** `#FFFFFF`
- **Page:** the warm beige `#FAF7F0`
- **Card border:** strengthen from `#E9E2D3` to about `#D4C9B2` (1.53:1 against the page, up from 1.21:1). White alone only buys 1.07:1 of separation — the border has to do real work.

Keep the card layout, the type, the 46px logo slot and the staggered entrance exactly as they are. This is a fill change, not a redesign.

There is a second, quieter reason to do this: the muted text `#7A7568` measures **4.29:1 on beige**, which fails WCAG AA for normal text. On white it reaches 4.59:1 and passes. The white card fixes an accessibility failure as a side effect.

### 2. Darken the tier colours when they carry text

As text, both currently fail AA on white:

| Token | Current | On white | Use instead |
| --- | --- | --- | --- |
| Gold | `#A8823A` | 3.55 — fails | `#7D5F22` (5.95) |
| Silver | `#7E8078` | 4.00 — fails | `#3F4744` (9.56) |

Two tokens per metal, and they are not interchangeable:

```css
--gold-pin:#C79A3E;   --gold-mark:#7D5F22;
--silver-pin:#535E58; --silver-mark:#3F4744;
```

`-pin` is a fill and answers to the 3:1 non-text threshold. `-mark` carries text and answers to 4.5:1. Conveniently `--gold-mark` is also the gold pin's ring colour, so the palette stays small.

### 3. Gold and Silver pins are currently indistinguishable

This one is more serious than it looks. `#A8823A` and `#7E8078` sit at a **1.13:1** luminance ratio — effectively the same tone. Once the hallmark comes off the pins (above), colour is the only thing left carrying tier, and these two colours cannot carry it. In greyscale, or for a red-green colour-blind user, the map has no tiers at all.

**Both pins carry the ring.** Identical form, identical diameter — the ring is part of the pin, not a Gold privilege. Anything else reintroduces the hierarchy through the back door.

That parity has a condition attached: if the form is identical, colour is doing all of the work, so the colours have to be genuinely separable. The current pair is not. The replacement pair is.

| | Fill | Ring | Greyscale |
| --- | --- | --- | --- |
| **Gold** | `#C79A3E` brass | `#7D5F22` | `#A1A1A1` |
| **Silver** | `#535E58` pewter | `#2B3330` | `#5B5B5B` |

The two fills sit **2.61:1** apart in luminance, up from 1.13:1. That gap is what makes them separable in greyscale, on a poor monitor, in bright sun, and under any form of colour blindness — lightness perception is intact in all of them. The hue axis reinforces it: a warm ochre against a cool neutral survives red-green colour blindness in a way that two mid-value browns do not.

Pin construction, both tiers identically:

1. Paper halo, outermost — separates the pin from tile detail
2. Ring in the metal's dark tone — this is the struck-hallmark edge, and it carries the pin's contrast against the map (`#7D5F22` reaches 5.8:1 against light tiles, `#2B3330` around 13:1, both well clear of the 3:1 threshold)
3. Fill in the metal

Because the dark ring provides the edge definition, the fills are free to be chosen purely for tier separation rather than for map visibility. That is what makes the parity affordable.

**Silver is the deeper metal here, not the paler one.** Pewter reads as substantial; a pale silver would read as faded, which is the exact impression section 7 forbids.

### 4. Keep the badges on cards

Confirmed — the hallmark on the card is the best thing in the comp. See the new placement rule at the end of section 7.

### 5. Everything else stands

The landing page with the cursor-reveal is approved as designed. The staggered card entrance, the category chips, the five muted hues, the zero-result state, the system guide and the colour scale all stand.

---

## 13. Appendix — the cursor-reveal technique

How Klimt Wine does it, and how we should do it more cheaply.

**Their rig.** Two stacked full-viewport canvases plus a third, very tall one:

- A 2D canvas acting as an offscreen **brush buffer**. Every `pointermove`, stamp a soft radial blob at the cursor. Every frame, paint the whole buffer with a low-alpha background fill so old strokes decay. The result is a live greyscale heat-map of where the cursor has recently been.
- A WebGL canvas whose fragment shader samples that buffer as an **alpha mask** over the artwork texture. High mask value = artwork visible.
- A third canvas, 3420 × 3884, set to `mix-blend-mode: multiply` behind the whole section. This is what makes it read as graphite in paper rather than an image floating on top.

**Our version — no WebGL needed.** Same idea, a fraction of the weight:

1. An SVG or transparent PNG of the line drawing, absolutely positioned, `mix-blend-mode: multiply`, `opacity` low.
2. A small offscreen 2D canvas (quarter resolution is plenty) as the brush buffer, painted exactly as above.
3. Apply it with CSS `mask-image` sourced from the canvas, refreshed per frame — or simply composite in a single visible 2D canvas using `globalCompositeOperation = 'destination-in'`, which avoids the mask round-trip entirely.
4. Throttle to `requestAnimationFrame` and skip frames when the pointer is still.

Budget: one rAF loop and a quarter-res canvas. No shader, no Three.js, no bundle.

**Requirements:**

- `@media (hover: none), (pointer: coarse)` — disable entirely on touch and show the drawing at a low static opacity instead. Klimt Wine does exactly this.
- `prefers-reduced-motion` — static drawing, no trail.
- The drawing must be legible enough to be worth revealing, and quiet enough that the underlying content still reads. This is decoration, not a puzzle.

**What the drawing should be.** First candidate: an engraved British Isles — coastline, contours, hachured hills, in the Ordnance Survey / Admiralty chart idiom from section 3. This is the single best answer to the whole "Britishness without the flag" problem in the brief: the map *is* the country, drawn rather than flown.

Second candidate, for the maker pages rather than the landing: cross-hatched engravings of the trades — a loom, a potter's wheel, a bench vice, a shearing hook — revealed as you move across the category filters.

**Where to use it.** The landing page, and nowhere else. On the map itself people are working, and a cursor trail over a Leaflet instance would be both distracting and expensive. Restraint is what makes it feel expensive rather than gimmicky.
