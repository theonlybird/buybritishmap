# Buy British Map

**[buybritishmap.uk](https://buybritishmap.uk)** — an interactive map of UK makers and producers who genuinely make or grow what they sell. Built to help shoppers find the British businesses around them instead of defaulting to Amazon.

## The standard

Every listing is checked before it appears, and carries a tier badge:

- **Gold** — fully made/grown in the UK, including the main material (fabric milled or woven here, produce grown here). Strict and non-discretionary.
- **Silver** — genuinely made in the UK, but the main material or some stock is imported (e.g. Northampton shoes made from imported calf leather).

Products merely designed, branded, printed or packed in the UK do not qualify at all. Where UK origin of the main material isn't clearly evidenced, listings default to Silver.

## Structure

```
index.html            The map (Leaflet, no build step)
submit.html           Public "suggest a business" form
data/businesses.json  The dataset — one record per listing
```

No framework, no build step. Every record in `businesses.json` includes an `evidence_note` and `tier_confidence` so the tiering can be audited.

## Running locally

Browsers block `fetch` of local files, so serve the folder:

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## Deployment

Hosted as a static site (Cloudflare Pages, connected to this repo). Pushes to `main` deploy automatically.

The submission form posts to Formspree — the form ID in `submit.html` must be set (search for `YOUR_FORM_ID`) or the form displays as inactive.

## Roadmap

1. **Phase 1 (now):** public map + interim submission form, reviewed by hand.
2. **Phase 2:** automated vetting pipeline — submissions checked against Companies House and the business's own site by an AI agent applying the tiering rulebook, with human sign-off on all Gold awards.
3. **Phase 3:** owner-claimed listings, community reports, annual re-verification, more categories (pottery & crockery, jewellery).

## Suggesting a business

Use the [form](https://buybritishmap.uk/submit.html) — or open a PR against `data/businesses.json` including an `evidence_note` with a public source for the made-in-UK claim.
