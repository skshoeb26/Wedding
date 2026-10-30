# Wedding Invitation Studio

A client-side generator for animated wedding invitation websites. Pick a
template, personalise it with a live preview, and download a complete static
website you can host for free. There is no database, no backend API, no
account and no build step, and the exported site never contacts the generator.

![Templates](docs/screenshots/gallery.png)

![Floral Book on mobile](docs/screenshots/floral-book-mobile.png)

![Sealed Envelope](docs/screenshots/sealed-envelope.png)

![Editor with live preview](docs/screenshots/editor.png)

## Features

- **Template gallery** with previews. Three templates are included:
  - **Floral Book** (main template, modelled on the reference recording):
    a pearl-draped curtain (“Pull the strings to open”) reveals a dusty-rose
    book with a baroque gold oval medallion, Arabic calligraphy and lace
    florals. Guests turn the 3D pages by scrolling, swiping, tapping or with
    the keyboard: monogram page → blessings → invitation → one page per event
    → photo → RSVP → “Awaiting your presence”. The back cover holds the live
    countdown, venue map links and “Open again”. Desktop shows a two-page
    spread.
  - **Sealed Envelope**: tap the monogrammed wax seal, the flap lifts and the
    letter slides out, then the details unfold as cards.
  - **Garden Scroll**: a single scrolling page with reveal animations.
- **Live editor**: two panels on desktop and Edit/Preview tabs on mobile. The
  preview updates as you type and can be shown at desktop or phone size.
  Undo/redo, reset to sample content, and an unsaved/saved draft indicator.
- **Everything is editable**: couple and parents' names, family introduction,
  heading and message, Qur'an verse or quotation, any number of events (Nikah,
  Walima, Mehndi…) with Gregorian and automatic or manual Hijri dates, times,
  venues, addresses and Google Maps links, countdown with time zone, photos,
  background artwork, colours (with presets), fonts, text size, music, optional
  sections, RSVP contacts, WhatsApp and form links, labels and language.
- **Exports**
  - **ZIP website (recommended)**: `index.html`, `assets/css/style.css`,
    `assets/js/app.js`, `assets/images/`, `assets/audio/`, `assets/fonts/` and
    a `README.md` with hosting steps. All paths are relative, and every
    reference is checked before the download starts.
  - **Single HTML file**: everything is embedded as data URIs. You get a
    warning when the file becomes large.
- **Drafts and backups**: settings are saved to `localStorage` automatically.
  Uploaded files stay in memory only. A project backup (`.json`) includes the
  uploads and can be imported again later.
- **Safe by design**: user text is only ever inserted with `textContent`, and
  links are restricted to `https:`, `tel:` and `wa.me`. Uploads are checked by
  their real content, so SVG and HTML files are rejected. The preview runs in a
  sandboxed iframe, and exported pages ship with a strict Content Security
  Policy.
- **Accessible**: keyboard navigation (arrow keys, Home/End), swipe gestures,
  labelled controls, live page announcements, focus management and a
  reduced-motion fallback that switches to fades and turns off the petals.

## Run the generator locally

The editor is plain HTML, CSS and ES modules. Browsers do not load ES modules
from `file://`, so serve the folder over HTTP:

```bash
npm start            # node tools/serve.mjs  →  http://127.0.0.1:8080/
# or: python3 -m http.server 8080
```

No `npm install` is needed. The repository has no runtime dependencies:
JSZip and the fonts are vendored in `vendor/`.

## Deploy the generator (optional)

The repository root is a static site. On Vercel, import the repository with
framework preset **Other**, no build command, and `.` as the output
directory. Netlify, Cloudflare Pages and GitHub Pages work the same way.
(Nothing has been deployed for you.)

## Host an exported invitation

1. Click **Download website** and choose the ZIP.
2. Extract it. You get a folder such as `ayesha-zayan-invitation/`.
3. Upload that folder to any static host:
   - **Vercel**: *Add New → Project*, then drag the folder in, or run
     `npx vercel deploy` inside it.
   - **Netlify Drop**: drop the folder on https://app.netlify.com/drop
   - **Cloudflare Pages** (direct upload) or **GitHub Pages**.

The `README.md` inside every export repeats these steps.

## Tests

```bash
npm run check      # syntax check of every JS file and JSON validation
npm test           # 29 unit tests: core runtime, schema, store, uploads, export engine
npm run test:e2e   # 122 browser checks with Playwright + Chromium
```

The end-to-end test drives the real editor. It edits every text field and
checks that each one reaches the preview. It also covers uploads (including
rejected SVG and mislabelled files), undo/redo, template switching, the
countdown before and after expiry, draft restore, and backup export and
import. It downloads both exports, extracts the ZIP and opens the result in
**clean browser contexts that block every request outside the exported
site**: on a mobile and a desktop viewport, from `file://`, offline as a
single file, and with reduced motion. In those contexts it opens the cover,
turns through every page with buttons, the keyboard and swipes, and checks
fonts, layout overflow, music start and pause, and errors. The same clean,
request-blocking setup also covers the curtain reveal, scroll-wheel page turns
and the back cover, plus the Sealed Envelope and Garden Scroll exports. Screenshots are
written to `test-results/`.

## Project structure

```
index.html                 editor page
src/
  main.js                  editor controller (routing, export, backup, status)
  schema.js                configuration schema, defaults, presets, validation
  store.js                 state, undo/redo, localStorage drafts
  form-spec.js, form.js    declarative form definition and renderer
  preview.js               sandboxed live preview (postMessage updates)
  assets.js                upload validation, image optimisation, project backups
  export/build.js          export engine (ZIP / single file / preview)
  export/sources.js        loads template sources and fonts
  templates.js             template and font registry
  util.js, editor.css
templates/                 everything that ships inside an exported site
  shared/core.js           safe DOM helpers, formatting, countdown, music
  shared/art.js            original procedural floral artwork (SVG)
  shared/boot.js           reads the inline JSON configuration and renders
  shared/base.css
  floral-book/             runtime.js + template.css
  sealed-envelope/         runtime.js + template.css
  garden-scroll/           runtime.js + template.css
vendor/                    JSZip (MIT) and OFL fonts with their licences
tools/                     static server and syntax checker
tests/                     unit and end-to-end tests
docs/DESIGN.md             design notes, schema and architecture decisions
```

See [docs/DESIGN.md](docs/DESIGN.md) for the configuration schema, how
rendering and export work, and how to add a template.

## Licences and assets

- All artwork is original: it is generated procedurally from vector shapes in
  `templates/shared/art.js` and recoloured from the theme.
- Fonts: Great Vibes, Cormorant Garamond, Marcellus, Amiri and Aref Ruqaa,
  all under the SIL Open Font License. The licence files ship with every
  export that uses the font.
- JSZip 3.10.1 is dual-licensed MIT/GPLv3 (`vendor/jszip/LICENSE.md`).
- Only upload photos and music you have the right to share.
