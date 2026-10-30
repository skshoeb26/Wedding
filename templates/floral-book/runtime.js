/*
 * Template: Floral Book — an ornate invitation book with page-turn animation.
 */
(function (root) {
  'use strict';

  function create(mount, config, ctx) {
    var core = ctx.core;
    var art = root.InviteArt;
    var el = core.el;
    var C = core.content(config);
    var L = C.labels;
    var colors = core.get(config, 'theme.colors', {});
    var reduced = core.reducedMotion(config);
    var turn = reduced ? 'fade' : core.get(config, 'animation.pageTurn', 'flip');
    if (['flip', 'fade', 'slide'].indexOf(turn) === -1) turn = 'flip';
    var cleanups = [];

    var cornerUri = art.dataUri(art.corner(colors));
    var dividerUri = art.dataUri(art.divider(colors));
    var medallionUri = art.dataUri(art.medallion(colors));

    var rootEl = el('div', { className: 'wis-root fb', 'data-turn': turn });
    core.applyTheme(rootEl, config);
    rootEl.style.setProperty('--fb-damask', 'url("' + art.dataUri(art.damask(colors)) + '")');
    if (reduced) rootEl.classList.add('is-reduced');

    // Background artwork (uploaded image or the generated floral default).
    var bgSrc = C.background || art.dataUri(art.background(colors));
    rootEl.appendChild(el('div', { className: 'fb-bg', 'aria-hidden': 'true' },
      el('img', { className: 'fb-bg-img', src: bgSrc, alt: '', decoding: 'async' }),
      el('div', { className: 'fb-bg-tint' })));

    if (core.get(config, 'animation.petals', true) && !reduced) rootEl.appendChild(petals());

    function divider() {
      return el('img', { className: 'fb-divider', src: dividerUri, alt: '', 'aria-hidden': 'true' });
    }

    function corners(all) {
      var list = all ? ['tl', 'tr', 'bl', 'br'] : ['tl', 'br'];
      return list.map(function (pos) {
        return el('img', { className: 'fb-corner fb-corner--' + pos, src: cornerUri, alt: '', 'aria-hidden': 'true' });
      });
    }

    function script(text, cls) {
      var len = Array.from(text || '').length;
      return el('p', {
        className: 'fb-script' + (cls ? ' ' + cls : ''), text: text, dir: 'auto',
        'data-len': len > 22 ? 'xlong' : len > 13 ? 'long' : null
      });
    }

    // ---- Page definitions -------------------------------------------------
    var pages = [];

    var coverLen = Math.max(Array.from(C.names.one).length, Array.from(C.names.two).length);
    pages.push({ id: 'cover', label: C.names.one + ' ' + C.names.joiner + ' ' + C.names.two, cover: true, body: function () {
      var mono = C.names.arabic1 && C.names.arabic2
        ? el('p', { className: 'fb-medallion-text wis-arabic fb-calligraphy', lang: 'ar', dir: 'rtl', text: C.names.arabic1 + ' و ' + C.names.arabic2 })
        : el('p', { className: 'fb-medallion-text fb-script', text: C.names.initials });
      var openBtn = el('button', {
        type: 'button', className: 'fb-open', onclick: function (e) { e.stopPropagation(); open(); }
      }, el('span', { className: 'fb-seal', 'aria-hidden': 'true' }, C.names.one.charAt(0)), el('span', { text: C.openPrompt || L.open }));
      return [
        el('div', { className: 'fb-cover-frame', 'aria-hidden': 'true' }),
        corners(true),
        el('div', { className: 'fb-cover-content' },
          core.textBlock('p', C.coverTagline, 'fb-eyebrow'),
          el('div', { className: 'fb-medallion' },
            el('img', { src: medallionUri, alt: '', 'aria-hidden': 'true' }), mono),
          el('h1', { className: 'fb-cover-names', 'data-len': coverLen > 22 ? 'xlong' : coverLen > 12 ? 'long' : null },
            el('span', { text: C.names.one, dir: 'auto' }),
            el('span', { className: 'fb-amp', text: C.names.joiner }),
            el('span', { text: C.names.two, dir: 'auto' })),
          core.textBlock('p', C.coverDate, 'fb-cover-date'),
          openBtn)
      ];
    } });

    pages.push({ id: 'welcome', label: C.heading || 'Invitation', body: function () {
      var n = C.names;
      return [
        core.arabic(C.bismillah, 'fb-bismillah fb-calligraphy'),
        core.textBlock('p', C.heading, 'fb-eyebrow'),
        C.family ? core.textBlock('p', C.family.intro, 'fb-lead') : null,
        divider(),
        el('div', { className: 'fb-couple' },
          el('div', { className: 'fb-person' },
            script(n.one, 'fb-name'), core.textBlock('p', n.full1, 'fb-fullname'), C.family ? core.textBlock('p', n.parents1, 'fb-parents') : null),
          el('p', { className: 'fb-amp fb-script', text: n.joiner, 'aria-hidden': 'true' }),
          el('div', { className: 'fb-person' },
            script(n.two, 'fb-name'), core.textBlock('p', n.full2, 'fb-fullname'), C.family ? core.textBlock('p', n.parents2, 'fb-parents') : null))
      ];
    } });

    if (C.quote || C.message) {
      pages.push({ id: 'message', label: C.quote ? C.quote.reference || 'Quote' : 'Message', body: function () {
        var q = C.quote;
        return [
          q ? core.arabic(q.arabic, 'fb-quote-ar') : null,
          q ? core.textBlock('p', q.translation, 'fb-quote') : null,
          q ? core.textBlock('p', q.reference, 'fb-eyebrow') : null,
          q && C.message ? divider() : null,
          core.textBlock('p', C.message, 'fb-lead')
        ];
      } });
    }

    C.events.forEach(function (ev, i) {
      pages.push({ id: 'event-' + i, label: ev.label || 'Event', body: function () {
        var time = ev.timeText + (ev.endTimeText ? ' – ' + ev.endTimeText : '');
        return [
          script(ev.label, 'fb-event-title'),
          divider(),
          ev.parts ? el('div', { className: 'fb-date' },
            el('span', { className: 'fb-date-side', text: ev.parts.weekday }),
            el('span', { className: 'fb-date-day', text: ev.parts.day }),
            el('span', { className: 'fb-date-side', text: ev.parts.month + ' ' + ev.parts.year })) : core.textBlock('p', ev.dateText, 'fb-lead'),
          core.textBlock('p', time, 'fb-time'),
          core.textBlock('p', ev.hijriText, 'fb-hijri'),
          ev.venueName || ev.address ? el('div', { className: 'fb-venue' },
            core.textBlock('p', L.venue, 'fb-eyebrow'),
            core.textBlock('p', ev.venueName, 'fb-venue-name'),
            core.textBlock('p', ev.address, 'fb-address')) : null,
          core.textBlock('p', ev.note, 'fb-note'),
          core.linkButton(ev.mapsHref, L.viewMap, 'map')
        ];
      } });
    });

    if (C.countdown && isFinite(C.countdown.targetMs)) {
      pages.push({ id: 'countdown', label: C.countdown.heading || 'Countdown', body: function () {
        var w = core.countdownWidget(C.countdown, L);
        cleanups.push(w.destroy);
        return [
          script(C.countdown.heading || 'Save the date', 'fb-event-title'),
          divider(),
          w,
          C.events[0] ? core.textBlock('p', C.events[0].dateText, 'fb-time') : null,
          el('p', { className: 'fb-names-small fb-script', text: C.names.one + ' ' + C.names.joiner + ' ' + C.names.two })
        ];
      } });
    }

    if (C.photo) {
      pages.push({ id: 'photo', label: C.photo.heading || 'Photo', body: function () {
        return [
          core.textBlock('p', C.photo.heading, 'fb-eyebrow'),
          el('figure', { className: 'fb-photo' },
            el('img', { src: C.photo.src, alt: C.photo.caption || (C.names.one + ' ' + C.names.joiner + ' ' + C.names.two), loading: 'lazy' }),
            C.photo.caption ? el('figcaption', { text: C.photo.caption, dir: 'auto' }) : null)
        ];
      } });
    }

    if (C.rsvp) {
      pages.push({ id: 'rsvp', label: C.rsvp.heading || 'RSVP', body: function () {
        var r = C.rsvp;
        return [
          script(r.heading || 'RSVP', 'fb-event-title'),
          divider(),
          core.textBlock('p', r.message, 'fb-lead'),
          r.deadlineText ? el('p', { className: 'fb-time' }, L.rsvpBy + ' ', el('strong', { text: r.deadlineText })) : null,
          r.contacts.length ? el('ul', { className: 'fb-contacts' }, r.contacts.map(function (c) {
            return el('li', null,
              el('span', { className: 'fb-contact-name', text: c.name, dir: 'auto' }),
              c.telHref ? el('a', { className: 'fb-contact-phone', href: c.telHref }, core.icon('phone'), el('span', { text: c.phone, dir: 'ltr' })) : null);
          })) : null,
          el('div', { className: 'fb-actions' },
            core.linkButton(r.whatsappHref, L.whatsapp, 'chat'),
            core.linkButton(r.link, L.rsvpLink, 'link'))
        ];
      } });
    }

    pages.push({ id: 'closing', label: C.closing.heading || 'Thank you', body: function () {
      var cl = C.closing;
      return [
        script(cl.heading, 'fb-event-title'),
        divider(),
        core.textBlock('p', cl.message, 'fb-lead'),
        el('p', { className: 'fb-names-small fb-script', text: C.names.one + ' ' + C.names.joiner + ' ' + C.names.two }),
        core.textBlock('p', cl.signature, 'fb-parents'),
        core.textBlock('p', cl.hashtag, 'fb-hashtag'),
        el('button', { type: 'button', className: 'wis-btn fb-replay', onclick: function () { goTo(0); } },
          core.icon('replay'), el('span', { text: L.readAgain }))
      ];
    } });

    // ---- Book --------------------------------------------------------------
    var total = pages.length;
    var book = el('div', { className: 'fb-book', role: 'region', 'aria-roledescription': 'book', 'aria-label': pages[0].label });
    var leaves = pages.map(function (pg, i) {
      var inner = el('div', { className: pg.cover ? 'fb-cover-inner' : 'fb-page-inner' }, pg.body());
      var front = el('div', { className: 'fb-face fb-front' + (pg.cover ? ' fb-cover-face' : ' fb-paper') },
        pg.cover ? null : el('div', { className: 'fb-frame', 'aria-hidden': 'true' }),
        pg.cover ? null : corners(false),
        inner,
        pg.cover ? null : el('span', { className: 'fb-folio', 'aria-hidden': 'true', text: String(i) }));
      var back = el('div', { className: 'fb-face fb-back', 'aria-hidden': 'true' },
        el('div', { className: 'fb-back-art' },
          el('div', { className: 'fb-frame' }),
          el('img', { className: 'fb-corner fb-corner--tr', src: cornerUri, alt: '' }),
          el('img', { className: 'fb-corner fb-corner--bl', src: cornerUri, alt: '' }),
          el('img', { className: 'fb-back-medallion', src: medallionUri, alt: '' })));
      var leaf = el('section', {
        className: 'fb-leaf' + (pg.cover ? ' fb-cover' : ''),
        'aria-label': L.page + ' ' + (i + 1) + ' ' + L.of + ' ' + total + ': ' + pg.label,
        'data-page': pg.id
      }, front, back);
      if (pg.cover) leaf.addEventListener('click', function () { if (index === 0) open(); });
      book.appendChild(leaf);
      return leaf;
    });

    var prev = el('button', { type: 'button', className: 'fb-nav-btn', 'aria-label': L.previous, onclick: function () { goTo(index - 1); } }, core.icon('left'));
    var next = el('button', { type: 'button', className: 'fb-nav-btn', 'aria-label': L.next, onclick: function () { goTo(index + 1); } }, core.icon('right'));
    var dots = el('div', { className: 'fb-dots' }, pages.map(function (pg, i) {
      return el('button', {
        type: 'button', className: 'fb-dot', 'aria-label': L.page + ' ' + (i + 1) + ': ' + pg.label,
        onclick: function () { goTo(i); }
      });
    }));
    var counter = el('span', { className: 'fb-counter', 'aria-hidden': 'true' });
    var nav = el('nav', { className: 'fb-nav', 'aria-label': 'Invitation pages' }, prev, el('div', { className: 'fb-nav-mid' }, dots, counter), next);
    var live = el('p', { className: 'wis-sr-only', 'aria-live': 'polite' });

    var stage = el('main', { className: 'fb-stage' }, el('div', { className: 'fb-book-wrap' }, book), nav, live);
    rootEl.appendChild(stage);

    if (C.musicSrc) {
      var mb = core.musicButton(ctx.music, L);
      cleanups.push(mb.destroy);
      rootEl.appendChild(mb);
    }

    var index = 0;

    function update(announce) {
      leaves.forEach(function (leaf, k) {
        var turned = k < index;
        leaf.classList.toggle('is-turned', turned);
        leaf.style.zIndex = String(turned ? total + k : total - k);
        leaf.inert = k !== index;
        leaf.setAttribute('aria-hidden', k === index ? 'false' : 'true');
      });
      Array.prototype.forEach.call(dots.children, function (d, k) {
        d.classList.toggle('is-active', k === index);
        if (k === index) d.setAttribute('aria-current', 'page');
        else d.removeAttribute('aria-current');
      });
      rootEl.classList.toggle('is-open', index > 0);
      prev.disabled = index === 0;
      next.disabled = index === total - 1;
      counter.textContent = index + 1 + ' / ' + total;
      book.setAttribute('aria-label', pages[index].label);
      if (announce) live.textContent = L.page + ' ' + (index + 1) + ' ' + L.of + ' ' + total + ': ' + pages[index].label;
    }

    function goTo(i, silent) {
      i = Math.max(0, Math.min(total - 1, i | 0));
      if (i === index && !silent) return;
      var from = index;
      index = i;
      var moving = i > from ? leaves.slice(from, i) : leaves.slice(i, from);
      moving.forEach(function (leaf) {
        leaf.classList.add('is-moving');
        setTimeout(function () { leaf.classList.remove('is-moving'); }, 2600);
      });
      var hadFocus = leaves[from].contains(document.activeElement);
      update(!silent);
      // Keep keyboard focus inside the invitation when its leaf becomes inert.
      if (hadFocus) (index === total - 1 ? prev : next).focus({ preventScroll: true });
    }

    function open() {
      if (C.musicSrc && C.musicOnOpen && !ctx.music.isPlaying()) ctx.music.play();
      goTo(1);
    }

    // Swipe support
    var startX = null, startY = 0;
    book.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
    });
    book.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      startX = null;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      if (index === 0 && dx < 0) open();
      else goTo(index + (dx < 0 ? 1 : -1));
    });
    book.addEventListener('pointercancel', function () { startX = null; });

    function onKey(e) {
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (index === 0) open(); else goTo(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(index - 1);
      else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(total - 1);
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    cleanups.push(function () { document.removeEventListener('keydown', onKey); });

    // Restore the previous page without animating when re-rendering.
    var startIndex = ctx.state && typeof ctx.state.index === 'number' ? Math.min(ctx.state.index, total - 1) : 0;
    rootEl.classList.add('no-anim');
    index = startIndex;
    update(false);
    mount.appendChild(rootEl);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { rootEl.classList.remove('no-anim'); });
    });

    function petals() {
      var wrap = el('div', { className: 'fb-petals', 'aria-hidden': 'true' });
      for (var i = 0; i < 14; i++) {
        wrap.appendChild(el('span', {
          style: {
            '--x': (i * 37) % 100 + 'vw',
            '--drift': ((i % 5) - 2) * 6 + 'vw',
            '--dur': 11 + (i * 7) % 9 + 's',
            '--delay': -((i * 13) % 17) + 's',
            '--size': 9 + (i * 5) % 9 + 'px'
          }
        }));
      }
      return wrap;
    }

    return {
      goTo: function (i) { goTo(i); },
      getState: function () { return { index: index }; },
      destroy: function () {
        cleanups.forEach(function (fn) { if (fn) fn(); });
        cleanups = [];
      }
    };
  }

  root.InviteTemplates = root.InviteTemplates || {};
  root.InviteTemplates['floral-book'] = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
