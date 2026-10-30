import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSite, verifyZipFiles, SINGLE_FILE_WARN_BYTES } from '../../src/export/build.js';
import { createDefaultConfig, normalizeConfig } from '../../src/schema.js';
import { nodeSources, InviteArt, PNG_1PX, silentWav, JSZip } from '../helpers.mjs';

const sources = await nodeSources();

function configWithAssets() {
  const config = normalizeConfig(createDefaultConfig());
  config.assets.couplePhoto = { id: 'p1', name: '../../etc/passwd<script>.png', mime: 'image/png', size: PNG_1PX.length };
  config.assets.music = { id: 'm1', name: 'song.wav', mime: 'audio/wav', size: 100 };
  const assets = new Map([
    ['p1', { bytes: PNG_1PX, mime: 'image/png', name: 'x.png' }],
    ['m1', { bytes: silentWav(), mime: 'audio/wav', name: 'song.wav' }]
  ]);
  return { config, assets };
}

function configJson(html) {
  const m = /<script type="application\/json" id="invitation-config">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(m[1]);
}

test('ZIP export contains the required structure with relative paths', () => {
  const { config, assets } = configWithAssets();
  const { files, warnings } = buildSite({ config, assets, sources, mode: 'zip', art: InviteArt });
  const paths = files.map((f) => f.path);
  for (const p of ['index.html', 'assets/css/style.css', 'assets/js/app.js', 'README.md', 'assets/images/couple-photo.png', 'assets/audio/background-music.wav', 'assets/images/floral-background.svg']) {
    assert.ok(paths.includes(p), `missing ${p}`);
  }
  assert.deepEqual(warnings, []);
  assert.deepEqual(verifyZipFiles(files), { missing: [], absolute: [] });
  assert.ok(!paths.some((p) => p.startsWith('src/') || p.includes('package.json') || p.startsWith('tests/') || p.includes('..')), 'no editor files');
  assert.equal(new Set(paths).size, paths.length, 'no duplicate paths');
  const cfg = configJson(files.find((f) => f.path === 'index.html').data);
  assert.equal(cfg.assets.couplePhoto.src, 'assets/images/couple-photo.png');
  assert.equal(cfg.assets.music.src, 'assets/audio/background-music.wav');
});

test('ZIP export only references local files', () => {
  const { config, assets } = configWithAssets();
  const { files } = buildSite({ config, assets, sources, mode: 'zip', art: InviteArt });
  const html = files.find((f) => f.path === 'index.html').data;
  const css = files.find((f) => f.path === 'assets/css/style.css').data;
  assert.doesNotMatch(html, /(src|href)="(https?:)?\/\//);
  assert.doesNotMatch(css, /url\((['"])?https?:/);
  assert.doesNotMatch(css, /@import/);
  assert.match(html, /Content-Security-Policy/);
});

test('user text is escaped in HTML and kept intact in the configuration', () => {
  const { config, assets } = configWithAssets();
  const evil = '</script><img src=x onerror=alert(1)> “Zoë” & عائشة';
  config.invitation.couple.partner1.name = evil;
  config.invitation.familyIntro = '<b>bold</b>';
  config.meta.title = '"><script>alert(1)</script>';
  for (const mode of ['zip', 'single']) {
    const out = buildSite({ config, assets, sources, mode, art: InviteArt });
    const html = mode === 'zip' ? out.files.find((f) => f.path === 'index.html').data : out.html;
    assert.doesNotMatch(html, /<img src=x/);
    assert.doesNotMatch(html, /<b>bold<\/b>/);
    assert.doesNotMatch(html, /<script>alert/);
    assert.equal((html.match(/<\/script>/g) || []).length, (html.match(/<script/g) || []).length, 'script tags balanced');
    assert.equal(configJson(html).invitation.couple.partner1.name, evil);
  }
});

test('single-file export embeds everything as data URIs', () => {
  const { config, assets } = configWithAssets();
  const { html, size, warnings } = buildSite({ config, assets, sources, mode: 'single', art: InviteArt });
  assert.doesNotMatch(html, /(src|href)="(?!data:)[^"]+"/, 'no external src/href');
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
  assert.doesNotMatch(css, /url\((?!data:)/);
  assert.match(html, /data:font\/woff2;base64,/);
  const cfg = configJson(html);
  assert.match(cfg.assets.couplePhoto.src, /^data:image\/png;base64,/);
  assert.match(cfg.assets.music.src, /^data:audio\/wav;base64,/);
  assert.ok(size < SINGLE_FILE_WARN_BYTES);
  assert.deepEqual(warnings, []);
});

test('large single files produce a warning', () => {
  const { config } = configWithAssets();
  const big = new Uint8Array(9 * 1024 * 1024);
  big.set(silentWav(1).slice(0, 44));
  const assets = new Map([['m1', { bytes: big, mime: 'audio/wav' }], ['p1', { bytes: PNG_1PX, mime: 'image/png' }]]);
  const { warnings } = buildSite({ config, assets, sources, mode: 'single', art: InviteArt });
  assert.ok(warnings.some((w) => /ZIP export is recommended/.test(w)));
});

test('missing uploads are left out with a warning', () => {
  const { config } = configWithAssets();
  const { files, warnings } = buildSite({ config, assets: new Map(), sources, mode: 'zip', art: InviteArt });
  assert.equal(warnings.length, 2);
  assert.equal(configJson(files[0].data).assets.couplePhoto, null);
});

test('only fonts used by the theme are bundled', () => {
  const config = normalizeConfig(createDefaultConfig());
  config.theme.fonts = { script: 'Marcellus', heading: 'Marcellus', body: 'System Sans', arabic: 'Amiri', calligraphy: 'Amiri' };
  const { files } = buildSite({ config, sources, mode: 'zip', art: InviteArt });
  const fonts = files.filter((f) => f.path.endsWith('.woff2')).map((f) => f.path);
  assert.ok(fonts.some((p) => p.includes('marcellus')));
  assert.ok(!fonts.some((p) => p.includes('great-vibes') || p.includes('aref')));
  assert.deepEqual(verifyZipFiles(files).missing, []);
});

test('each template bundles only its own runtime', () => {
  for (const id of ['floral-book', 'garden-scroll']) {
    const config = normalizeConfig({ ...createDefaultConfig(), template: id });
    const { files } = buildSite({ config, sources, mode: 'zip', art: InviteArt });
    const js = files.find((f) => f.path === 'assets/js/app.js').data;
    assert.match(js, new RegExp(`InviteTemplates\\['${id}'\\]`));
    assert.equal((js.match(/InviteTemplates\['/g) || []).length, 1);
  }
});

test('ZIP archive can be generated and read back', async () => {
  const { config, assets } = configWithAssets();
  const { files } = buildSite({ config, assets, sources, mode: 'zip', art: InviteArt });
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.data);
  const buf = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const back = await JSZip.loadAsync(buf);
  const html = await back.file('index.html').async('string');
  assert.equal(html, files[0].data);
  const png = await back.file('assets/images/couple-photo.png').async('uint8array');
  assert.deepEqual([...png], [...PNG_1PX]);
});
