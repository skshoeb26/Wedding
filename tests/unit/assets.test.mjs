import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniffMime, validateBytes, createProjectFile, parseProjectFile } from '../../src/assets.js';
import { createDefaultConfig } from '../../src/schema.js';
import { PNG_1PX, silentWav } from '../helpers.mjs';

const bytes = (...a) => Uint8Array.from(a);
const text = (s) => new TextEncoder().encode(s);

test('file types are detected from content, not names', () => {
  assert.equal(sniffMime(PNG_1PX), 'image/png');
  assert.equal(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(sniffMime(silentWav()), 'audio/wav');
  assert.equal(sniffMime(text('ID3\u0004')), 'audio/mpeg');
  assert.equal(sniffMime(text('OggS')), 'audio/ogg');
  assert.equal(sniffMime(text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(sniffMime(text('<!doctype html>')), null);
});

test('uploads must match the slot kind', () => {
  assert.equal(validateBytes(PNG_1PX, 'image').ok, true);
  assert.equal(validateBytes(PNG_1PX, 'audio').ok, false);
  assert.equal(validateBytes(silentWav(), 'audio').ok, true);
  assert.equal(validateBytes(text('<svg/>'), 'image').ok, false);
});

test('project backup round-trips configuration and assets', () => {
  const config = createDefaultConfig();
  config.invitation.couple.partner1.name = 'Ayesha “Aisha” <O\'Brien> & co — عائشة';
  config.assets.couplePhoto = { id: 'p1', name: 'photo.png', mime: 'image/png', size: PNG_1PX.length };
  config.assets.music = { id: 'm1', name: 'song.wav', mime: 'audio/wav', size: 0 };
  const assets = new Map([['p1', { id: 'p1', bytes: PNG_1PX, mime: 'image/png', name: 'photo.png', size: PNG_1PX.length }]]);
  const file = createProjectFile(config, assets);
  const parsed = parseProjectFile(file);
  assert.equal(parsed.config.invitation.couple.partner1.name, config.invitation.couple.partner1.name);
  assert.deepEqual([...parsed.assets.get('p1').bytes], [...PNG_1PX]);
  assert.equal(parsed.warnings.length, 1, 'missing music is reported');
});

test('import accepts a bare configuration and rejects junk', () => {
  const parsed = parseProjectFile(JSON.stringify(createDefaultConfig('garden-scroll')));
  assert.equal(parsed.config.template, 'garden-scroll');
  assert.throws(() => parseProjectFile('not json'), /valid JSON/);
  assert.throws(() => parseProjectFile('{"hello":1}'), /does not look like/);
  assert.throws(() => parseProjectFile('[1,2]'), /does not contain/);
});

test('imported assets with forged content are skipped', () => {
  const config = createDefaultConfig();
  config.assets.couplePhoto = { id: 'p1', name: 'x.png', mime: 'image/png', size: 5 };
  const file = JSON.stringify({ format: 'wedding-invitation-studio/project', version: 1, config, assets: { p1: { data: Buffer.from('<svg onload=alert(1)>').toString('base64') } } });
  const parsed = parseProjectFile(file);
  assert.equal(parsed.assets.size, 0);
  assert.ok(parsed.warnings.some((w) => /skipped/.test(w)));
});
