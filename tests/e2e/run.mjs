// End-to-end test: drives the editor in Chromium, exports the invitation and
// verifies the exported websites in clean browser sessions that are blocked
// from contacting anything except the static file server.
//
// Requires Playwright with Chromium (`require('playwright')`).
// Usage: node tests/e2e/run.mjs

import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { serve } from '../../tools/serve.mjs';
import { ROOT, JSZip, PNG_1PX, silentWav, InviteArt, nodeSources } from '../helpers.mjs';
import { buildSite } from '../../src/export/build.js';
import { createDefaultConfig, normalizeConfig } from '../../src/schema.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const OUT = path.join(ROOT, 'test-results');
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// A real 300x400 PNG for the couple photo (generated in the browser below).
// EDITOR_DIR lets the suite run against the deployable build (npm run build).
const editorServer = await serve(process.env.EDITOR_DIR ? path.resolve(process.env.EDITOR_DIR) : ROOT, 0);
const EDITOR = `http://127.0.0.1:${editorServer.address().port}/`;
const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });

const errors = [];
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`editor: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`editor console: ${m.text()}`));

const frame = () => page.frameLocator('#preview-host iframe');
const field = (label) => page.locator('#editor-form').getByLabel(label, { exact: true }).first();
async function openAllSections() {
  await page.evaluate(() => document.querySelectorAll('#editor-form details').forEach((d) => { d.open = true; }));
}
async function waitPreview(fn, arg, timeout = 4000) {
  const handle = page.locator('#preview-host iframe');
  const f = await (await handle.elementHandle()).contentFrame();
  return f.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
}
async function previewEval(fn, arg) {
  const f = await (await page.locator('#preview-host iframe').elementHandle()).contentFrame();
  return f.evaluate(fn, arg);
}

// ------------------------------------------------------------- gallery
await page.goto(EDITOR);
await page.evaluate(() => localStorage.clear());
await page.goto(`${EDITOR}#/templates`);
await page.locator('.template-card').nth(5).waitFor({ timeout: 5000 }).catch(() => {});
check('gallery lists all six templates', (await page.locator('.template-card').count()) === 6);
await page.locator('.template-card').first().getByRole('button', { name: 'Preview' }).click();
const dialogOk = await page.frameLocator('#template-dialog-host iframe').locator('.fb-cover-names').waitFor({ timeout: 5000 }).then(() => true, () => false);
check('template preview dialog renders the book', dialogOk);
await shot(page, 'editor-template-preview');
await page.locator('#template-dialog').getByRole('button', { name: 'Close' }).first().click();
await page.locator('.template-card').first().getByRole('button', { name: /Use this template|Continue editing/ }).click();
check('editor opens', await page.locator('#view-editor').waitFor({ timeout: 3000 }).then(() => true, () => false));
await frame().locator('.fb-cover-names').waitFor({ timeout: 5000 });
check('live preview renders', true);

// ------------------------------------------------------------- live edits
await openAllSections();
const tricky = 'Mariam <b>&</b> "Zoë"';
await field("Bride's name").fill(tricky);
check('preview updates with special characters as text', await waitPreview((t) => document.querySelector('.fb-cover-names').textContent.includes(t), tricky));
check('user HTML is not interpreted', (await previewEval(() => document.querySelectorAll('.fb-cover-names b').length)) === 0);
await field("Bride's name in Arabic (optional)").fill('مريم');
await field("Groom's name in Arabic (optional)").fill('يوسف');
check('Arabic names render on the cover', await waitPreview(() => document.querySelector('.fb-oval-text')?.textContent === 'مريم و يوسف'));
await field("Groom's name").fill('Muhammad Abdur-Rahman Al-Hashimi');
check('long names get a smaller size class', await waitPreview(() => !!document.querySelector('.fb-name[data-len="xlong"]')));

// Undo / redo
await field("Groom's name").fill('Yusuf');
await page.waitForTimeout(1300);
await field("Groom's name").fill('Yusuf Khan');
await field("Groom's name").blur();
await page.locator('#undo').click();
check('undo restores the previous value', (await field("Groom's name").inputValue()) === 'Yusuf');
check('undo updates the preview', await waitPreview(() => document.querySelector('.fb-cover-names').textContent.includes('Yusuf') && !document.querySelector('.fb-cover-names').textContent.includes('Khan')));
await page.locator('#redo').click();
check('redo re-applies the change', (await field("Groom's name").inputValue()) === 'Yusuf Khan');
check('unsaved indicator or saved status is shown', /Unsaved|Draft saved/.test(await page.locator('#save-status').textContent()));

// Dates
const nikah = page.locator('.list-item').first();
await nikah.getByLabel('Date (Gregorian)', { exact: true }).fill('2027-03-05');
check('event date updates the preview', await waitPreview(() => /Friday, 5\b|Friday, 05/.test(document.querySelector('[data-page="event-0"] .fb-date')?.textContent || '')));
check('Hijri date is calculated', /\d{4}/.test(await nikah.getByLabel('Hijri date', { exact: true }).inputValue()));

// Section toggles
const rsvpToggle = page.getByRole('switch', { name: 'Show the RSVP page' });
await rsvpToggle.uncheck({ force: true });
check('turning RSVP off removes the page', await waitPreview(() => !document.querySelector('[data-page="rsvp"]')));
await rsvpToggle.check({ force: true });
check('turning RSVP on restores the page', await waitPreview(() => !!document.querySelector('[data-page="rsvp"]')));

// Add / remove events
await page.getByRole('button', { name: '+ Add another event' }).click();
check('adding an event adds a page', await waitPreview(() => !!document.querySelector('[data-page="event-2"]')));
await page.locator('.list-item').nth(2).getByRole('button', { name: 'Remove' }).click();
check('removing an event removes the page', await waitPreview(() => !document.querySelector('[data-page="event-2"]')));

// Countdown expiry
await field('Count down to').fill('2020-01-01T10:00');
check('expired countdown shows the message', await waitPreview(() => {
  const m = document.querySelector('.wis-count-expired');
  return m && !m.hidden && /celebration has begun/.test(m.textContent);
}));
await field('Count down to').fill('2030-06-01T18:00');
check('future countdown ticks', await waitPreview(() => /^\d+$/.test(document.querySelector('.wis-count-num')?.textContent || '')));

// Colours and fonts
await page.locator('.swatch').nth(1).click();
check('palette preset recolours the preview', await waitPreview(() => getComputedStyle(document.querySelector('.wis-root')).getPropertyValue('--wis-primary').trim() === '#5f7358'));
await field('Script font (names)').selectOption('Marcellus');
check('font change reaches the preview', await waitPreview(() => getComputedStyle(document.querySelector('.wis-root')).getPropertyValue('--wis-font-script').includes('Marcellus')));
await field('Script font (names)').selectOption('Great Vibes');
await page.locator('.swatch').nth(0).click();

// Template switching
await page.locator('.template-option', { hasText: 'Garden Scroll' }).click();
check('switching template re-renders the preview', await frame().locator('.gs-names').waitFor({ timeout: 5000 }).then(() => true, () => false));
await shot(page, 'editor-garden-scroll');
await page.locator('.template-option', { hasText: 'Sealed Envelope' }).click();
check('switching to the envelope template', await frame().locator('.se-seal').waitFor({ timeout: 5000 }).then(() => true, () => false));
await page.locator('.template-option', { hasText: 'Floral Book' }).click();
await frame().locator('.fb-cover-names').waitFor({ timeout: 5000 });

// ------------------------------------------------------------- built-in tones
const tones = page.locator('.tone-option');
check('tone picker lists no-music, the daf rhythms and own upload', (await tones.count()) === 5);
check('a daf rhythm is preselected', await page.locator('.tone-option.is-selected').filter({ hasText: 'Daf & Claps' }).count() === 1);
check('preselected tone gives the preview a music button', await waitPreview(() => !!document.querySelector('.wis-music'), null, 6000));
const rastPlay = tones.filter({ hasText: 'Festive Daf' }).locator('.tone-play');
await rastPlay.click();
check('tone preview plays in the editor', await rastPlay.evaluate((b) => b.classList.contains('is-playing')).catch(() => false)
  || await page.waitForFunction(() => !!document.querySelector('.tone-play.is-playing'), null, { timeout: 3000 }).then(() => true, () => false));
await rastPlay.click();
check('tone preview stops on second press', await page.locator('.tone-play.is-playing').count() === 0);
await tones.filter({ hasText: 'No music' }).locator('input').check();
check('choosing no music removes the music button', await waitPreview(() => !document.querySelector('.wis-music')));
await tones.filter({ hasText: 'Daf & Claps' }).locator('input').check();
check('choosing a tone adds the music button', await waitPreview(() => !!document.querySelector('.wis-music'), null, 6000));

// ------------------------------------------------------------- uploads
const photo = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 300; c.height = 400;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 300, 400);
  grad.addColorStop(0, '#e8c3c0'); grad.addColorStop(1, '#8d5560');
  g.fillStyle = grad; g.fillRect(0, 0, 300, 400);
  g.fillStyle = '#fff'; g.font = '40px serif'; g.fillText('Photo', 90, 210);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return [...new Uint8Array(await blob.arrayBuffer())];
});
const photoBuf = Buffer.from(photo);
await page.locator('.field-asset', { hasText: 'Couple photo' }).locator('input[type=file]').setInputFiles({ name: 'us.png', mimeType: 'image/png', buffer: photoBuf });
check('photo upload shows on a photo page', await waitPreview(() => /^data:image\/png/.test(document.querySelector('.fb-photo img')?.src || '')),
  await previewEval(() => [...document.querySelectorAll('.fb-leaf')].map((l) => l.dataset.page + ':' + (l.querySelector('img:not(.fb-corner):not(.fb-divider)')?.src || '').slice(0, 30)).join(' ')));
await page.locator('.field-asset', { hasText: 'Or upload your own' }).locator('input[type=file]').setInputFiles({ name: 'song.wav', mimeType: 'audio/wav', buffer: Buffer.from(silentWav(3)) });
check('music upload adds the music control', await waitPreview(() => !!document.querySelector('.wis-music')));
check('uploading music selects “My own upload”', await page.locator('.tone-option.is-selected').filter({ hasText: 'My own upload' }).count() === 1);
await page.locator('.field-asset', { hasText: 'Background artwork' }).locator('input[type=file]').setInputFiles({ name: 'evil.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
check('SVG upload is rejected', await page.locator('#toast').filter({ hasText: /not accepted/ }).waitFor({ timeout: 3000 }).then(() => true, () => false));
await page.locator('.field-asset', { hasText: 'Background artwork' }).locator('input[type=file]').setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('<html>not an image</html>') });
check('mislabelled upload is rejected by content', await page.locator('#toast').filter({ hasText: /JPEG, PNG/ }).waitFor({ timeout: 3000 }).then(() => true, () => false));

// ------------------------------------------------------------- preview interactions
await frame().locator('.wis-curtain-pull').click();
check('curtain opens in the preview', await waitPreview(() => { const c = document.querySelector('.wis-curtain'); return !c || c.classList.contains('is-open'); }));
check('music starts from the curtain tap', await waitPreview(() => document.querySelector('.wis-music')?.getAttribute('aria-pressed') === 'true', null, 5000));
await frame().locator('.wis-music').click();
check('music button pauses', await waitPreview(() => document.querySelector('.wis-music').getAttribute('aria-pressed') === 'false'));
await page.waitForTimeout(1500);
await frame().locator('.fb-prompt').click();
check('opening the cover turns it', await waitPreview(() => document.querySelector('.fb-cover').classList.contains('is-turned')));
check('preview keeps the open page while editing', await (async () => {
  await field('Heading').first().fill('Live edit check');
  return waitPreview(() => document.querySelector('.fb-cover').classList.contains('is-turned') && !document.querySelector('.wis-curtain'));
})());
await page.waitForTimeout(1000);
await shot(page, 'editor-preview-open');
await page.locator('[data-viewport="desktop"]').click();
check('desktop viewport toggle', (await page.locator('#preview-stage').getAttribute('data-viewport')) === 'desktop');
await page.waitForTimeout(500);
await shot(page, 'editor-preview-desktop');
await page.locator('[data-viewport="mobile"]').click();

// ------------------------------------------------------------- draft persistence
await page.waitForTimeout(1200);
check('draft saved indicator', /Draft saved/.test(await page.locator('#save-status').textContent()));
await page.reload();
await frame().locator('.fb-cover-names').waitFor({ timeout: 5000 });
await openAllSections();
check('draft restores text after reload', (await field("Bride's name").inputValue()) === tricky);
check('missing uploads are explained after reload', /upload the couple photo, background music again/.test(await page.locator('#notices').textContent()));
await page.locator('.field-asset', { hasText: 'Couple photo' }).locator('input[type=file]').setInputFiles({ name: 'us.png', mimeType: 'image/png', buffer: photoBuf });
await page.locator('.field-asset', { hasText: 'Or upload your own' }).locator('input[type=file]').setInputFiles({ name: 'song.wav', mimeType: 'audio/wav', buffer: Buffer.from(silentWav(3)) });
await waitPreview(() => !!document.querySelector('.wis-music'));
check('notice clears after re-upload', (await page.locator('#notices').textContent()).trim() === '');

// ------------------------------------------------------------- export
async function exportAs(format) {
  await page.locator('#open-export').click();
  await page.locator(`input[name="export-format"][value="${format}"]`).check();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#do-export').click()]);
  const file = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(file);
  await page.locator('#export-messages .msg-ok').waitFor({ timeout: 5000 });
  const msg = await page.locator('#export-messages').textContent();
  await page.locator('#export-dialog').getByRole('button', { name: 'Cancel' }).click();
  return { file, msg };
}
const zipExport = await exportAs('zip');
check('ZIP export succeeds', /\.zip$/.test(zipExport.file) && /All file references were checked/.test(zipExport.msg), zipExport.msg);
const singleExport = await exportAs('single');
check('single HTML export succeeds', /\.html$/.test(singleExport.file), singleExport.msg);

// Project backup + import
const [backupDl] = await Promise.all([page.waitForEvent('download'), page.locator('#save-project').click()]);
const backupFile = path.join(OUT, backupDl.suggestedFilename());
await backupDl.saveAs(backupFile);
const backup = JSON.parse(await readFile(backupFile, 'utf8'));
check('project backup embeds uploaded files', Object.keys(backup.assets).length === 2);
await page.locator('#reset-sample').click();
await page.locator('#confirm-ok').click();
check('reset restores the sample', (await field("Bride's name").inputValue()) === 'Ayesha');
await page.locator('#import-project').setInputFiles(backupFile);
await page.locator('#confirm-ok').click();
await page.waitForTimeout(300);
check('import restores text', (await field("Bride's name").inputValue()) === tricky);
check('import restores uploads', await waitPreview(() => !!document.querySelector('[data-page="photo"] img') && !!document.querySelector('.wis-music')));

// ------------------------------------------------------------- mobile editor layout
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto(`${EDITOR}#/editor`);
await phone.locator('#editor-form details').first().waitFor();
check('mobile editor has no horizontal overflow', await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
check('mobile editor has no empty scroll area below the screen', await phone.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
  String(await phone.evaluate(() => document.documentElement.scrollHeight + ' vs ' + innerHeight)));
await phone.locator('#tab-preview').click();
check('mobile preview tab shows the invitation', await phone.frameLocator('#preview-host iframe').locator('.fb-cover-names').waitFor({ timeout: 5000 }).then(() => true, () => false));
await shot(phone, 'editor-mobile-preview');
await phone.close();

// ------------------------------------------------------------- every text field reaches the output
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await p.goto(`${EDITOR}#/editor`);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.frameLocator('#preview-host iframe').locator('.fb-cover-names').waitFor();
  await p.evaluate(() => document.querySelectorAll('#editor-form details').forEach((d) => { d.open = true; }));
  // Re-open list items too
  await p.evaluate(() => document.querySelectorAll('#editor-form details').forEach((d) => { d.open = true; }));
  const inputs = await p.locator('#editor-form input[type=text]:not([readonly]), #editor-form input[type=tel], #editor-form input[type=url], #editor-form textarea').all();
  const missing = [];
  let n = 0;
  for (const input of inputs) {
    if (!(await input.isVisible())) continue;
    const id = await input.getAttribute('id');
    const label = (await p.locator(`label[for="${id}"]`).first().textContent().catch(() => id)).trim();
    const type = await input.getAttribute('type');
    const token = type === 'url' ? `https://example.com/t${n}` : type === 'tel' ? `+1 555 01${String(n).padStart(2, '0')} 999` : `Tok${n}x`;
    await input.fill(token);
    n++;
    const want = type === 'tel' ? token.replace(/[^0-9]/g, '') : token;
    const f = await (await p.locator('#preview-host iframe').elementHandle()).contentFrame();
    const found = await f.waitForFunction((w) => {
      const text = document.body.textContent.replace(/\s/g, '');
      const hrefs = [...document.querySelectorAll('a[href]')].map((a) => decodeURIComponent(a.href).replace(/[^0-9a-zA-Z:/.]/g, ''));
      return text.includes(w.replace(/\s/g, '')) || hrefs.some((h) => h.includes(w.replace(/[^0-9a-zA-Z:/.]/g, '')));
    }, want, { timeout: 2500 }).then(() => true, () => false);
    if (!found) missing.push(label);
  }
  // Photo fields only render once a photo is uploaded (covered by the upload checks).
  const expectedElsewhere = ['Photo heading', 'Photo caption', 'View details', 'Browser tab / link preview title', 'Link preview description', 'Pre-filled WhatsApp message', 'Track title (optional)'];
  const reallyMissing = missing.filter((m) => !expectedElsewhere.some((e) => m.startsWith(e)));
  check(`every visible text field updates the preview (${n} fields)`, reallyMissing.length === 0, reallyMissing.join(', '));
  const title = await (await (await p.locator('#preview-host iframe').elementHandle()).contentFrame()).evaluate(() => document.title);
  void title;
  await p.close();
}

check('no editor errors', errors.length === 0, errors.join(' | '));
await context.close();
editorServer.close();

// ------------------------------------------------------------- exported ZIP in a clean session
const zipData = await JSZip.loadAsync(await readFile(zipExport.file));
const siteDir = path.join(OUT, 'site');
for (const [name, entry] of Object.entries(zipData.files)) {
  if (entry.dir) continue;
  const dest = path.join(siteDir, name);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, await entry.async('uint8array'));
}
const topFolders = Object.keys(zipData.files).map((n) => n.split('/')[0]);
const siteRoot = path.join(siteDir, topFolders[0]);
const zipNames = Object.keys(zipData.files).map((n) => n.split('/').slice(1).join('/')).filter(Boolean);
check('ZIP has the documented layout', ['index.html', 'assets/css/style.css', 'assets/js/app.js', 'README.md'].every((p) => zipNames.includes(p)) && zipNames.some((p) => p.startsWith('assets/images/')) && zipNames.some((p) => p.startsWith('assets/audio/')), zipNames.join(', '));

async function verifySite(url, label, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport, reducedMotion: opts.reducedMotion || 'no-preference', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const external = [];
  const failed = [];
  const origin = url.startsWith('file:') ? 'file://' : new URL(url).origin;
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    external.push(u);
    return route.abort();
  });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  pg.on('requestfailed', (r) => failed.push(r.url()));
  pg.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  await pg.goto(url);
  return { ctx, pg, external, failed, errs };
}

async function exerciseBook(pg, label) {
  await pg.locator('.fb-cover-names').waitFor({ timeout: 5000 });
  await pg.waitForTimeout(400);
  check(`${label}: fonts load locally`, await pg.evaluate(async () => { await document.fonts.ready; return document.fonts.check('32px "Great Vibes"') && [...document.fonts].some((f) => f.family.includes('Great Vibes') && f.status === 'loaded'); }));
  check(`${label}: no horizontal overflow`, await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check(`${label}: curtain covers the invitation first`, await pg.locator('.wis-curtain-pull').isVisible());
  check(`${label}: music does not autoplay`, (await pg.locator('.wis-music').getAttribute('aria-pressed')) === 'false');
  await shot(pg, `${label}-0-curtain`);
  await pg.locator('.wis-curtain-pull').click();
  await pg.waitForTimeout(2300);
  check(`${label}: curtain opens and is removed`, await pg.locator('.wis-curtain').isHidden());
  check(`${label}: music starts on the curtain tap`, (await pg.locator('.wis-music').getAttribute('aria-pressed')) === 'true');
  check(`${label}: book fits in the viewport`, await pg.evaluate(() => {
    const r = document.querySelector('.fb-book').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
  }));
  check(`${label}: scroll prompt is shown on the closed book`, await pg.locator('.fb-prompt').isVisible());
  await shot(pg, `${label}-1-cover`);
  const box = await pg.locator('.fb-book').boundingBox();
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pg.mouse.wheel(0, 150);
  await pg.waitForTimeout(1300);
  check(`${label}: scrolling opens the book`, (await pg.locator('.fb-counter').textContent()).startsWith('2 /'));
  await shot(pg, `${label}-2`);
  const total = await pg.locator('.fb-leaf').count();
  for (let i = 3; i <= total; i++) {
    await pg.locator('.fb-nav-btn').nth(1).click();
    await pg.waitForTimeout(1150);
    await shot(pg, `${label}-${i}`);
  }
  check(`${label}: turns through all ${total} pages to the back cover`, (await pg.locator('.fb-counter').textContent()) === `${total} / ${total}`);
  check(`${label}: back cover countdown shows numbers`, /^\d+$/.test(await pg.locator('.fb-backcover .wis-count-num').first().textContent()));
  check(`${label}: back cover links every venue`, (await pg.locator('.fb-backcover .fb-pill').count()) === 2);
  await pg.keyboard.press('ArrowLeft');
  await pg.waitForTimeout(1100);
  check(`${label}: keyboard navigation`, (await pg.locator('.fb-counter').textContent()) === `${total - 1} / ${total}`);
  await pg.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await pg.mouse.down();
  await pg.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
  await pg.mouse.up();
  await pg.waitForTimeout(1100);
  check(`${label}: swipe navigation`, (await pg.locator('.fb-counter').textContent()) === `${total} / ${total}`);
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pg.mouse.wheel(0, -150);
  await pg.waitForTimeout(1100);
  check(`${label}: scrolling up turns back`, (await pg.locator('.fb-counter').textContent()) === `${total - 1} / ${total}`);
  await pg.locator('.fb-nav-btn').nth(1).click();
  await pg.waitForTimeout(1100);
  await pg.locator('.fb-again').click();
  await pg.waitForTimeout(1100);
  check(`${label}: “Open again” closes the book`, !(await pg.locator('.fb-cover').getAttribute('class')).includes('is-turned'));
  await pg.locator('.wis-music').click();
  check(`${label}: music button pauses`, await pg.waitForFunction(() => document.querySelector('.wis-music').getAttribute('aria-pressed') === 'false', null, { timeout: 3000 }).then(() => true, () => false));
}

const siteServer = await serve(siteRoot, 0);
const SITE = `http://127.0.0.1:${siteServer.address().port}/`;

for (const [label, viewport, touch] of [['zip-mobile', { width: 390, height: 844 }, true], ['zip-desktop', { width: 1440, height: 900 }, false]]) {
  const s = await verifySite(SITE, label, { viewport, touch });
  await exerciseBook(s.pg, label);
  check(`${label}: no requests outside the site`, s.external.length === 0, s.external.join(', '));
  check(`${label}: no failed requests`, s.failed.length === 0, s.failed.join(', '));
  check(`${label}: no errors`, s.errs.length === 0, s.errs.join(' | '));
  await s.ctx.close();
}

{
  const s = await verifySite(SITE, 'zip-reduced', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await s.pg.locator('.fb').waitFor();
  check('reduced motion uses fades', (await s.pg.locator('.fb').getAttribute('data-turn')) === 'fade');
  await s.pg.locator('.wis-curtain-pull').click();
  check('reduced motion: curtain clears quickly', await s.pg.locator('.wis-curtain').waitFor({ state: 'hidden', timeout: 1200 }).then(() => true, () => false));
  check('reduced motion disables petals', (await s.pg.locator('.fb-petals').count()) === 0);
  await s.ctx.close();
}

{
  // The ZIP also works when opened directly from disk.
  const s = await verifySite('file://' + path.join(siteRoot, 'index.html'), 'zip-file');
  check('ZIP index.html works from file://', await s.pg.locator('.fb-cover-names').waitFor({ timeout: 5000 }).then(() => true, () => false));
  check('ZIP from file:// has no errors', s.errs.length === 0, s.errs.join(' | '));
  await s.ctx.close();
}

{
  // Single HTML file, offline.
  const s = await verifySite('file://' + singleExport.file, 'single', { viewport: { width: 390, height: 844 } });
  await s.ctx.setOffline(true);
  await exerciseBook(s.pg, 'single-mobile');
  check('single file: no external requests', s.external.length === 0, s.external.join(', '));
  check('single file: no errors', s.errs.length === 0, s.errs.join(' | '));
  await s.ctx.close();
}

{
  // Garden Scroll template export renders and needs nothing external.
  const sources = await nodeSources();
  const config = normalizeConfig({ ...createDefaultConfig(), template: 'garden-scroll' });
  config.assets.couplePhoto = { id: 'p', name: 'p.png', mime: 'image/png', size: PNG_1PX.length };
  const { files } = buildSite({ config, assets: new Map([['p', { bytes: photoBuf, mime: 'image/png' }]]), sources, mode: 'zip', art: InviteArt });
  const dir = path.join(OUT, 'garden');
  for (const f of files) {
    await mkdir(path.dirname(path.join(dir, f.path)), { recursive: true });
    await writeFile(path.join(dir, f.path), f.data);
  }
  const srv = await serve(dir, 0);
  const s = await verifySite(`http://127.0.0.1:${srv.address().port}/`, 'garden', { viewport: { width: 390, height: 844 } });
  check('garden scroll export renders', await s.pg.locator('.gs-names').waitFor({ timeout: 5000 }).then(() => true, () => false));
  await s.pg.locator('.wis-curtain-pull').click();
  await s.pg.waitForTimeout(2100);
  await s.pg.mouse.wheel(0, 2000);
  await s.pg.waitForTimeout(1200);
  check('garden scroll reveals sections', (await s.pg.locator('.gs-reveal.is-visible').count()) > 0);
  await s.pg.screenshot({ path: path.join(OUT, 'garden-full.png'), fullPage: true });
  check('garden scroll: no external requests or errors', s.external.length === 0 && s.errs.length === 0 && s.failed.length === 0, [...s.external, ...s.errs, ...s.failed].join(' | '));
  await s.ctx.close();
  srv.close();
}

{
  // Sealed Envelope template export.
  const sources = await nodeSources();
  const config = normalizeConfig({ ...createDefaultConfig(), template: 'sealed-envelope' });
  const { files } = buildSite({ config, sources, mode: 'zip', art: InviteArt });
  const dir = path.join(OUT, 'envelope');
  for (const f of files) {
    await mkdir(path.dirname(path.join(dir, f.path)), { recursive: true });
    await writeFile(path.join(dir, f.path), f.data);
  }
  const srv = await serve(dir, 0);
  const s = await verifySite(`http://127.0.0.1:${srv.address().port}/`, 'envelope', { viewport: { width: 390, height: 844 } });
  await s.pg.locator('.se-seal').waitFor({ timeout: 5000 });
  check('envelope: page is locked until opened', await s.pg.evaluate(() => document.documentElement.classList.contains('se-locked')));
  await shot(s.pg, 'envelope-0-closed');
  await s.pg.locator('.se-seal').click();
  await s.pg.waitForTimeout(2700);
  check('envelope: seal opens the letter', await s.pg.locator('.se.is-open').count() === 1);
  check('envelope: the built-in tone starts on open', await s.pg.waitForFunction(() => document.querySelector('.wis-music')?.getAttribute('aria-pressed') === 'true', null, { timeout: 4000 }).then(() => true, () => false));
  check('envelope: letter comes fully out and the envelope drops away', await s.pg.waitForFunction(() => {
    const letter = document.querySelector('.se-letter').getBoundingClientRect();
    const pocket = getComputedStyle(document.querySelector('.se-pocket'));
    return letter.top >= 0 && letter.bottom <= innerHeight && Number(pocket.opacity) < 0.05;
  }, null, { timeout: 3000 }).then(() => true, () => false));
  check('envelope: scrolling is unlocked', !(await s.pg.evaluate(() => document.documentElement.classList.contains('se-locked'))));
  await shot(s.pg, 'envelope-1-open');
  await s.pg.mouse.wheel(0, 1500);
  await s.pg.waitForTimeout(1200);
  check('envelope: detail cards reveal', (await s.pg.locator('.se-reveal.is-visible').count()) > 0);
  check('envelope: countdown renders', /^\d+$/.test(await s.pg.locator('.wis-count-num').first().textContent()));
  await s.pg.screenshot({ path: path.join(OUT, 'envelope-full.png'), fullPage: true });
  check('envelope: no external requests or errors', s.external.length === 0 && s.errs.length === 0 && s.failed.length === 0, [...s.external, ...s.errs, ...s.failed].join(' | '));
  await s.ctx.close();
  srv.close();
}

async function exportTemplate(id) {
  const { switchTemplate } = await import('../../src/templates.js');
  const sources = await nodeSources();
  const config = normalizeConfig(switchTemplate(createDefaultConfig(), id));
  const { files } = buildSite({ config, sources, mode: 'zip', art: InviteArt });
  const dir = path.join(OUT, id);
  for (const f of files) {
    await mkdir(path.dirname(path.join(dir, f.path)), { recursive: true });
    await writeFile(path.join(dir, f.path), f.data);
  }
  const srv = await serve(dir, 0);
  const s = await verifySite(`http://127.0.0.1:${srv.address().port}/`, id, { viewport: { width: 390, height: 844 } });
  return { s, srv };
}

{
  const { s, srv } = await exportTemplate('royal-doors');
  await s.pg.locator('.rd-open').waitFor({ timeout: 5000 });
  check('royal doors: page is locked until opened', await s.pg.evaluate(() => document.documentElement.classList.contains('rd-locked')));
  await shot(s.pg, 'royal-doors-0');
  await s.pg.locator('.rd-open').click();
  await s.pg.waitForTimeout(2200);
  check('royal doors: doors swing open onto the names', await s.pg.evaluate(() =>
    getComputedStyle(document.querySelector('.rd-door--left')).transform !== 'none' && Number(getComputedStyle(document.querySelector('.rd-inside')).opacity) > 0.95));
  await shot(s.pg, 'royal-doors-1');
  await s.pg.mouse.wheel(0, 1600);
  await s.pg.waitForTimeout(1200);
  check('royal doors: detail panels reveal', (await s.pg.locator('.rd-reveal.is-visible').count()) > 0);
  check('royal doors: no horizontal overflow', await s.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('royal doors: no external requests or errors', !s.external.length && !s.errs.length && !s.failed.length, [...s.external, ...s.errs, ...s.failed].join(' | '));
  await s.ctx.close();
  srv.close();
}

{
  const { s, srv } = await exportTemplate('story-cards');
  await s.pg.locator('.wis-curtain-pull').click();
  await s.pg.waitForTimeout(2100);
  const total = await s.pg.locator('.sc-slide').count();
  check('story cards: page does not scroll (fits the screen)', await s.pg.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
  await s.pg.mouse.click(320, 420);
  await s.pg.waitForTimeout(700);
  check('story cards: tapping the right side advances', await s.pg.locator('.sc-slide').nth(1).evaluate((n) => n.classList.contains('is-active')));
  await s.pg.mouse.click(40, 420);
  await s.pg.waitForTimeout(700);
  check('story cards: tapping the left side goes back', await s.pg.locator('.sc-slide').nth(0).evaluate((n) => n.classList.contains('is-active')));
  await s.pg.mouse.click(320, 420);
  await s.pg.waitForTimeout(7600);
  check('story cards: slides advance on their own', await s.pg.locator('.sc-slide').nth(2).evaluate((n) => n.classList.contains('is-active')));
  await s.pg.mouse.move(320, 420);
  await s.pg.mouse.down();
  await s.pg.waitForTimeout(800);
  check('story cards: press and hold pauses', await s.pg.locator('.sc.is-holding').count() === 1);
  await s.pg.mouse.up();
  await s.pg.waitForTimeout(300);
  check('story cards: a long press does not skip a slide', await s.pg.locator('.sc-slide').nth(2).evaluate((n) => n.classList.contains('is-active')));
  for (let i = 0; i < total; i++) await s.pg.keyboard.press('ArrowRight');
  await s.pg.waitForTimeout(700);
  check('story cards: reaches the last slide', await s.pg.locator('.sc-slide').nth(total - 1).evaluate((n) => n.classList.contains('is-active')));
  await shot(s.pg, 'story-cards-last');
  check('story cards: no external requests or errors', !s.external.length && !s.errs.length && !s.failed.length, [...s.external, ...s.errs, ...s.failed].join(' | '));
  await s.ctx.close();
  srv.close();
}

{
  const { s, srv } = await exportTemplate('moonlit-night');
  await s.pg.locator('.mn-light').waitFor({ timeout: 5000 });
  await shot(s.pg, 'moonlit-night-0');
  await s.pg.locator('.mn-light').click();
  await s.pg.waitForTimeout(1500);
  check('moonlit night: tapping lights the lanterns', await s.pg.locator('.mn.is-lit').count() === 1);
  await shot(s.pg, 'moonlit-night-1');
  await s.pg.mouse.wheel(0, 1600);
  await s.pg.waitForTimeout(1200);
  check('moonlit night: sections reveal on scroll', (await s.pg.locator('.mn-reveal.is-visible').count()) > 0);
  check('moonlit night: countdown renders', /^\d+$/.test(await s.pg.locator('.wis-count-num').first().textContent()));
  check('moonlit night: no horizontal overflow', await s.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('moonlit night: no external requests or errors', !s.external.length && !s.errs.length && !s.failed.length, [...s.external, ...s.errs, ...s.failed].join(' | '));
  await s.ctx.close();
  srv.close();
}

siteServer.close();
await browser.close();

const failedChecks = results.filter((r) => !r.ok);
console.log(`\n${results.length - failedChecks.length}/${results.length} checks passed. Screenshots: ${path.relative(process.cwd(), OUT)}/`);
process.exit(failedChecks.length ? 1 : 0);
