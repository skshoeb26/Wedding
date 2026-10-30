import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { MUSIC_LIBRARY, libraryPath } from '../../src/music-library.js';
import { createDefaultConfig, normalizeConfig, libraryMusicRef } from '../../src/schema.js';
import { buildSite, verifyZipFiles } from '../../src/export/build.js';
import { createProjectFile, parseProjectFile, sniffMime } from '../../src/assets.js';
import { nodeSources, InviteArt, ROOT } from '../helpers.mjs';

const sources = await nodeSources();

test('every library tone exists, is a small valid MP3', async () => {
  for (const t of MUSIC_LIBRARY) {
    const file = path.join(ROOT, libraryPath(t.id));
    const bytes = new Uint8Array(await readFile(file));
    assert.equal(sniffMime(bytes), 'audio/mpeg', t.id);
    assert.ok((await stat(file)).size < 500 * 1024, `${t.id} stays under 500 KB`);
  }
});

test('library references are validated', () => {
  const c = normalizeConfig({ ...createDefaultConfig(), assets: { music: { id: 'x', library: 'rast-celebration', src: 'javascript:1' } } });
  assert.deepEqual(c.assets.music, libraryMusicRef('rast-celebration'));
  assert.equal(normalizeConfig({ ...createDefaultConfig(), assets: { music: { id: 'x', library: 'not-a-track' } } }).assets.music, null);
  assert.equal(createDefaultConfig().assets.music.library, 'ajam-joy', 'a happy tone is preselected');
  assert.equal(normalizeConfig({ ...createDefaultConfig(), assets: { music: { id: 'x', library: 'bayati-serenity' } } }).assets.music.library, 'sweet-nikah', 'replaced tones map to their successors');
});

test('a chosen tone is packaged in the ZIP and embedded in the single file', () => {
  const config = normalizeConfig(createDefaultConfig());
  config.assets.music = libraryMusicRef('daf-zaffa');
  const zip = buildSite({ config, sources, mode: 'zip', art: InviteArt });
  assert.ok(zip.files.some((f) => f.path === 'assets/audio/daf-zaffa.mp3'));
  assert.deepEqual(zip.warnings, []);
  assert.deepEqual(verifyZipFiles(zip.files).missing, []);
  assert.match(zip.files.find((f) => f.path === 'README.md').data, /original composition/);
  const single = buildSite({ config, sources, mode: 'single', art: InviteArt });
  assert.match(single.html, /data:audio\/mpeg;base64,/);
});

test('no music means no audio files', () => {
  const config = normalizeConfig(createDefaultConfig());
  config.assets.music = null;
  const zip = buildSite({ config, sources, mode: 'zip', art: InviteArt });
  assert.ok(!zip.files.some((f) => f.path.startsWith('assets/audio/')));
});

test('backups reference tones instead of embedding them', () => {
  const config = createDefaultConfig();
  const file = createProjectFile(config, new Map([[config.assets.music.id, { bytes: new Uint8Array(10), mime: 'audio/mpeg' }]]));
  assert.deepEqual(JSON.parse(file).assets, {});
  const parsed = parseProjectFile(file);
  assert.equal(parsed.config.assets.music.library, 'ajam-joy');
  assert.deepEqual(parsed.warnings, []);
});
