import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InviteCore as C } from '../helpers.mjs';

test('safeHttpUrl only allows http(s)', () => {
  assert.equal(C.safeHttpUrl('https://maps.app.goo.gl/abc'), 'https://maps.app.goo.gl/abc');
  assert.equal(C.safeHttpUrl('  http://example.com  '), 'http://example.com/');
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>', 'vbscript:x', '//evil.com', 'maps.google.com', '']) {
    assert.equal(C.safeHttpUrl(bad), '', bad);
  }
});

test('phone and WhatsApp links are normalised', () => {
  assert.equal(C.telHref('+91 98765 43210'), 'tel:+919876543210');
  assert.equal(C.telHref('call me'), '');
  assert.equal(C.whatsappHref('+44 7700-900123', 'Hi & bye'), 'https://wa.me/447700900123?text=Hi%20%26%20bye');
  assert.equal(C.whatsappHref('abc'), '');
});

test('maps link falls back to an address search', () => {
  assert.equal(C.mapsHref('', 'Rose Hall, Pune'), 'https://www.google.com/maps/search/?api=1&query=Rose%20Hall%2C%20Pune');
  assert.equal(C.mapsHref('javascript:alert(1)', ''), '');
});

test('asset sources are restricted to data URIs of media and relative asset paths', () => {
  assert.ok(C.safeAssetSrc('data:image/png;base64,AAAA'));
  assert.ok(C.safeAssetSrc('data:audio/mpeg;base64,AAAA'));
  assert.ok(C.safeAssetSrc('assets/images/couple-photo.jpg'));
  for (const bad of ['data:text/html;base64,AAAA', 'https://evil.com/x.png', '/assets/x.png', 'assets/../../x', 'javascript:1', 'assets/a b.png', 'blob:http://x/1']) {
    assert.equal(C.safeAssetSrc(bad), '', bad);
  }
});

test('countdown target respects the configured UTC offset', () => {
  assert.equal(C.parseTarget('2027-02-14T11:00', '+05:30'), Date.UTC(2027, 1, 14, 5, 30));
  assert.equal(C.parseTarget('2027-02-14T11:00', 'Z'), Date.UTC(2027, 1, 14, 11, 0));
  assert.equal(C.parseTarget('2027-02-14T11:00', 'garbage'), Date.UTC(2027, 1, 14, 11, 0));
  assert.ok(Number.isNaN(C.parseTarget('14/02/2027', 'Z')));
  assert.ok(Number.isNaN(C.parseTarget('', 'Z')));
});

test('countdown parts, expiry and invalid dates', () => {
  const now = Date.UTC(2027, 0, 1, 0, 0, 0);
  const target = now + ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;
  assert.deepEqual(C.countdownParts(target, now), { valid: true, expired: false, days: 2, hours: 3, minutes: 4, seconds: 5 });
  assert.equal(C.countdownParts(now - 1, now).expired, true);
  assert.equal(C.countdownParts(now, now).expired, true);
  assert.equal(C.countdownParts(NaN, now).valid, false);
});

test('date, time and Hijri formatting', () => {
  assert.equal(C.formatDate('2027-02-14', 'en'), 'Sunday, February 14, 2027');
  assert.equal(C.formatDate('not-a-date', 'en'), '');
  assert.match(C.formatTime('19:30', 'en'), /7:30\s?PM/);
  assert.equal(C.formatTime('After Asr', 'en'), 'After Asr');
  const hijri = C.hijriDate('2027-02-14', 'en');
  assert.match(hijri, /1448/);
});

test('content model applies fallbacks and section toggles', () => {
  const m = C.content({
    invitation: { couple: { partner1: { name: '' }, partner2: { name: 'Zayan' } }, events: [{ enabled: false, label: 'Hidden' }, { label: 'Nikah', date: '2027-02-14' }] },
    sections: { rsvp: false, countdown: false },
    assets: {}
  });
  assert.equal(m.names.one, 'Bride');
  assert.equal(m.events.length, 1);
  assert.equal(m.rsvp, null);
  assert.equal(m.countdown, null);
  assert.equal(m.labels.days, 'Days');
});
