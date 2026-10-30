# Design notes

## 1. Reference and verified behaviour

The brief points to `https://kasim-khadija.vercel.app` and a screen
recording. Neither could be inspected while this was built: the domain is
blocked by the build environment's network policy, and the recording was not
attached. The design below therefore follows the written brief and the
supplied starter HTML (`wedding_invitation_studio.html`). It reproduces the
described style (ornate floral book cover, page turns, music control,
countdown) with original artwork, and copies no code or assets from the
reference.

Interactions implemented and verified by `tests/e2e/run.mjs`:

| Interaction | Behaviour |
| --- | --- |
| Landing | Full-screen floral background, a closed book with a damask cover, gold double frame, floral corners, a medallion with Arabic names (or initials), script names, the date and a pulsing “Tap to open” seal. |
| Open | Tapping the cover, swiping left, or pressing → turns the cover. Music starts at that moment if one was uploaded, because the tap counts as the user gesture browsers require. |
| Page turn | Each leaf rotates around the spine in 3D with a moving shadow. On wide screens the book opens into a two-page spread: the back of the turned page shows on the left. On narrow screens turned pages swing away. The transition can also be set to slide or fade. |
| Navigation | Previous/next buttons, page dots, an “n / total” counter, arrow, Home and End keys, and swipe gestures. “Read again” closes the book. |
| Pages | Cover → Bismillah, family introduction and couple → verse and message → one page per event (date block, time, Hijri date, venue, map button) → countdown → photo → RSVP → closing. Optional sections are left out entirely when turned off. |
| Countdown | Live days/hours/minutes/seconds to a target time in a chosen UTC offset. Shows a configurable message once the date has passed. |
| Music | A floating button with an equaliser animation while playing. It pauses when the tab is hidden and resumes when it returns. A visible error state appears if the file cannot play. |
| Reduced motion | Follows `prefers-reduced-motion`, or can be forced either way: fades instead of 3D turns, no petals, no pulsing. |

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

## 5. Adding a template

1. Create `templates/<id>/runtime.js` that registers
   `InviteTemplates['<id>'] = { create }`. Use `ctx.core.content(config)` and
   `ctx.core.el()`. Return `{ goTo, getState, destroy }`.
2. Create `templates/<id>/template.css`, scoped under a root class.
3. Add an entry to `TEMPLATES` in `src/templates.js`, with a thumbnail
   variant in `art.thumbnail()` if needed.
4. Run `npm test && npm run test:e2e`.

## 6. Known limitations

- The reference site and recording could not be compared visually (see §1).
- The automatic Hijri date uses the Umm al-Qura calendar from the browser's
  `Intl` support. Local moon sighting can differ by a day, so it can be
  switched off per event and typed by hand.
- Uploaded files are not kept across browser restarts unless a project backup
  is saved. This is deliberate: `localStorage` holds configuration only.
- Deployment to Vercel itself was not performed. The export was verified on a
  plain static server, from `file://`, and offline, in clean browser contexts
  that block all outside requests.
