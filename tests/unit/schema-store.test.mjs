import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig, normalizeConfig } from '../../src/schema.js';
import { Store } from '../../src/store.js';

test('default config is stable under normalisation', () => {
  const c = createDefaultConfig();
  assert.deepEqual(normalizeConfig(c), c);
});

test('normalizeConfig drops unknown keys and repairs invalid values', () => {
  const c = normalizeConfig({
    template: 'nope',
    evil: '<script>',
    invitation: { couple: { partner1: { name: 42 } }, events: Array.from({ length: 20 }, () => ({ label: 'x' })), labels: { days: 'Tage', 'bad key': 'x' } },
    theme: { colors: { primary: 'red; background:url(x)' }, fonts: { script: 'Comic Sans' }, textScale: 9 },
    animation: { pageTurn: 'explode', pageTurnMs: 99999 },
    assets: { music: { id: 'a1', name: 'x.mp3', mime: 'audio/mpeg', src: 'javascript:1' }, couplePhoto: 'bad' },
    meta: { lang: '"><script>', dir: 'sideways' }
  });
  assert.equal(c.template, 'floral-book');
  assert.equal(c.evil, undefined);
  assert.equal(c.invitation.couple.partner1.name, 'Ayesha');
  assert.equal(c.invitation.events.length, 8);
  assert.deepEqual(c.invitation.labels, { days: 'Tage' });
  assert.equal(c.theme.colors.primary, '#a4605b');
  assert.equal(c.theme.fonts.script, 'Great Vibes');
  assert.equal(c.theme.textScale, 1.3);
  assert.equal(c.animation.pageTurn, 'flip');
  assert.equal(c.animation.pageTurnMs, 2500);
  assert.equal(c.assets.music.src, undefined, 'src is never imported');
  assert.equal(c.assets.couplePhoto, null);
  assert.equal(c.meta.lang, 'en');
  assert.equal(c.meta.dir, 'ltr');
});

test('store undo/redo with coalesced typing', () => {
  const s = new Store(createDefaultConfig());
  s.set('invitation.couple.partner1.name', 'A');
  s.set('invitation.couple.partner1.name', 'Am');
  s.set('invitation.couple.partner1.name', 'Amina');
  assert.equal(s.undoStack.length, 1, 'rapid edits to one field coalesce');
  s.set('invitation.couple.partner2.name', 'Omar');
  s.undo();
  assert.equal(s.config.invitation.couple.partner2.name, 'Zayan');
  s.undo();
  assert.equal(s.config.invitation.couple.partner1.name, 'Ayesha');
  s.redo();
  assert.equal(s.config.invitation.couple.partner1.name, 'Amina');
  assert.ok(s.canRedo());
});

test('drafts store configuration only and report missing uploads', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const s = new Store(createDefaultConfig());
  s.addAsset({ id: 'p1', bytes: new Uint8Array([1, 2, 3]), mime: 'image/png', name: 'a.png', size: 3 });
  s.update((c) => { c.assets.couplePhoto = { id: 'p1', name: 'a.png', mime: 'image/png', size: 3 }; });
  s.set('invitation.couple.partner1.name', 'مريم');
  assert.ok(s.saveDraft(storage));
  assert.ok(!mem.values().next().value.includes('AQID'), 'asset bytes are not stored');
  const draft = Store.loadDraft(storage);
  assert.equal(draft.config.invitation.couple.partner1.name, 'مريم');
  const restored = new Store(draft.config);
  assert.deepEqual(restored.missingAssets().map((m) => m.slot), ['couplePhoto']);
  Store.clearDraft(storage);
  assert.equal(Store.loadDraft(storage), null);
});

test('drafts survive a broken storage backend', () => {
  const s = new Store(createDefaultConfig());
  const broken = { setItem() { throw new Error('quota'); }, getItem() { throw new Error('denied'); } };
  assert.equal(s.saveDraft(broken), false);
  assert.equal(Store.loadDraft(broken), null);
});

test('older drafts gain new fields with defaults', () => {
  const old = createDefaultConfig();
  delete old.invitation.blessings;
  delete old.animation.intro;
  delete old.sections.blessings;
  const c = normalizeConfig(old);
  assert.equal(c.animation.intro, 'curtain');
  assert.equal(c.sections.blessings, true);
  assert.match(c.invitation.blessings.heading, /blessings/);
  assert.equal(normalizeConfig({ ...old, animation: { intro: 'fireworks' } }).animation.intro, 'curtain');
});
