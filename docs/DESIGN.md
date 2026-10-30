# Design notes

## 1. Reference and verified behaviour

The reference site (`kasim-khadija.vercel.app`) is blocked by the build
environment's network policy, so the design was checked against the supplied
screen recording (64 s, portrait phone). The template recreates the
interaction and layout with original artwork. No code, images or personal
details from the reference were copied.

Verified in the recording, and how Floral Book implements it:

| Reference | Implementation |
| --- | --- |
| Full-screen pink curtain with pearl strands and swags, “Pull the strings to open” | `core.curtain()`: two procedurally drawn curtain panels (`art.curtain`) with a tassel prompt. Any tap, swipe, scroll or key press draws them apart, and music starts at that moment. |
| Closed dusty-rose book with a baroque gold oval medallion holding Arabic calligraphy, lace florals in the top-left and bottom-right, visible page edges, “Scroll to open the book” pill | Cover leaf with damask texture, spine bands, `art.ovalFrame`, gold frame, pearl-studded corner clusters, layered page edges and the prompt pill. |
| Scrolling turns pages around the spine, one page per gesture; scrolling up turns back | Wheel and trackpad, vertical and horizontal swipes, arrow keys and buttons all turn pages, with one turn per gesture. |
| Page 1: Bismillah calligraphy, monogram and Arabic names | Monogram page: Bismillah, Arabic names in the calligraphy font, and the Latin names. |
| Page 2: “In the name of Allah…”, Arabic phrase, transliteration, “With the blessings of” and family names | Blessings page (`invitation.blessings` with the optional verse). |
| Page 3: “We cordially invite you to the Nikah & Reception of”, script names with “(S/O …)” / “(D/O …)”, a satin ribbon | Invitation page with the ribbon (`art.ribbon`). |
| Event pages: large serif title (“Nikkah”), weekday and date, Hijri date, prayer-time note, time, “At,” venue | One page per event. |
| Final page: “Awaiting your presence” + family name in script | Closing page. |
| Back cover: “Countdown to the Nikah”, 4 boxes, venue pills with map pins, “↺ Open again” | Back-cover leaf with the countdown, map pills and an “Open again” button. |
| Music button top-right with equaliser bars | Shared music control. |
| Blush notched-corner page frames with gold star ornaments | `art.pageFrame`. |

Added beyond the recording: an optional photo page and RSVP page, the
desktop two-page spread, page dots and buttons, a reduced-motion mode,
keyboard support and screen-reader page announcements.

## 2. Configuration schema

Every user-editable value lives in one JSON object (`src/schema.js`), split
into separate concerns:

```jsonc
{
  "schemaVersion": 1,
  "template": "floral-book",                // template selection
  "invitation": {                           // invitation data
    "heading", "coverTagline", "openPrompt", "bismillah",
    "couple": { "joiner", "partner1": { "name", "fullName", "arabicName", "parents" }, "partner2": { … } },
    "familyIntro", "message",
    "quote": { "arabic", "translation", "reference" },
    "events": [{ "id", "enabled", "label", "date", "time", "endTime", "hijriAuto", "hijriDate",
                 "venueName", "address", "mapsUrl", "note" }],
    "countdown": { "target": "YYYY-MM-DDTHH:MM", "utcOffset": "+05:30", "heading", "expiredMessage" },
    "gallery": { "heading", "caption" },
    "rsvp": { "heading", "message", "deadline", "contacts": [{ "name", "phone" }], "whatsapp", "whatsappMessage", "link" },
    "closing": { "heading", "message", "signature", "hashtag" },
    "music": { "title", "startOnOpen", "volume" },
    "labels": { "days": "…", … }            // optional translations of UI words
  },
  "sections": { "bismillah", "coverDate", "family", "quote", "events", "hijri", "countdown", "photo", "rsvp" },
  "theme": { "preset", "colors": { "primary", "rose", "accent", "paper", "ink", "background" },
             "fonts": { "script", "heading", "body", "arabic", "calligraphy" }, "textScale" },
  "animation": { "pageTurn": "flip|slide|fade", "pageTurnMs", "petals", "reducedMotion": "auto|reduce|full" },
  "assets": {                                // asset references
    "background": null | { "id", "name", "mime", "size", "src"? },
    "couplePhoto": …, "music": …
  },
  "meta": { "title", "description", "lang", "dir" }
}
```

`normalizeConfig()` merges any input onto the defaults. It keeps only known
keys and correct types, clamps numbers, checks colours (`#rrggbb`), fonts
(allow-list), language tags and enums, and never imports an asset `src`.
Imports, drafts and the store all pass through it.

Asset references hold metadata only. The bytes stay in memory
(`Store.assets`). A `src` is attached only when a build runs: a data URI for
the preview and single-file export, or a relative path such as
`assets/images/couple-photo.jpg` for the ZIP.

## 3. Rendering

Templates are framework-free classic scripts that register
`InviteTemplates[id] = { create(mount, config, ctx) }` and render the config
with DOM APIs. Shared helpers in `templates/shared/core.js` build a display
model (`content(config)`) and enforce the security rules:

- text only through `textContent`; no `innerHTML` anywhere in the runtime
- links: `https?:` URLs parsed with `URL`, `tel:` built from digits, WhatsApp
  as `https://wa.me/<digits>`, maps fall back to a Google Maps search URL
- media `src`: only `data:image/*` or `data:audio/*`, or `assets/…` paths
  without `..`
- colours and fonts go through allow-lists before being set as CSS custom
  properties with `style.setProperty`

The same runtime files run in three places, so they cannot drift apart:

1. **Editor preview**: `buildSite({ mode: 'preview' })` creates a document
   with inlined CSS, fonts and JS. It loads into an
   `<iframe sandbox="allow-scripts allow-popups">` (no same-origin access).
   Config updates arrive by `postMessage`, at most once per animation frame,
   and keep the current page.
2. **ZIP export**: `index.html` holds the configuration in
   `<script type="application/json" id="invitation-config">` (with `<`, `>`,
   `&`, U+2028 and U+2029 escaped), plus `assets/js/app.js`
   (art + core + one template runtime + boot) and `assets/css/style.css`
   (only the font faces in use + shared + template CSS).
3. **Single file**: the same pieces, inlined, with every asset as a data URI.

Exported pages include a `<noscript>` fallback with the names and event
details, Open Graph tags and a CSP meta tag (`default-src 'none'`, with
scripts limited to `'self'` in the ZIP build).

## 4. Artwork

`templates/shared/art.js` draws all artwork procedurally: layered petal roses,
leaves, blossoms, gold sprigs, the medallion, divider, damask texture,
thumbnail and favicon. A seeded PRNG keeps the output deterministic, and the
artwork is recoloured from the theme palette. The ZIP export also writes the
background as a real file (`assets/images/floral-background.svg`), so it can
be replaced by hand, and the editor accepts an uploaded background instead.

## 5. Templates and shared sections

`core.blocks(content, opts)` builds the standard invitation sections: names,
blessings, one per event, countdown, photo, RSVP and closing. Each section is
returned as a list of DOM nodes with generic `wis-b-*` classes. Royal Doors,
Story Cards and Moonlit Night lay these blocks out as panels, slides or cards
and only style them, so new templates stay small and every template gets the
same tested escaping and link handling. Each registry entry names a suggested
`preset` palette; `switchTemplate()` applies it unless the colours were
customised.

## 6. Adding a template

1. Create `templates/<id>/runtime.js` that registers
   `InviteTemplates['<id>'] = { create }`. Use `ctx.core.content(config)` and
   `ctx.core.el()`. Return `{ goTo, getState, destroy }`.
2. Create `templates/<id>/template.css`, scoped under a root class.
3. Add an entry to `TEMPLATES` in `src/templates.js`, with a thumbnail
   variant in `art.thumbnail()` if needed.
4. Run `npm test && npm run test:e2e`.

## 7. Known limitations

- The live reference site could not be opened from the build environment.
  Fidelity was checked against the screen recording (see §1).
- The automatic Hijri date uses the Umm al-Qura calendar from the browser's
  `Intl` support. Local moon sighting can differ by a day, so it can be
  switched off per event and typed by hand.
- Uploaded files are not kept across browser restarts unless a project backup
  is saved. This is deliberate: `localStorage` holds configuration only.
- Deployment to Vercel itself was not performed. The export was verified on a
  plain static server, from `file://`, and offline, in clean browser contexts
  that block all outside requests.
