/*
 * Template: Floral Book — a pearl-curtain reveal, then an ornate invitation
 * book whose pages turn on scroll, swipe, tap or keyboard. The last leaf is
 * the back cover with the countdown and venue links.
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
    var turnMs = Math.min(2500, Math.max(200, Number(core.get(config, 'animation.pageTurnMs', 1000)) || 1000));
    var cleanups = [];

    var cornerUri = art.dataUri(art.corner(colors));
    var dividerUri = art.dataUri(art.divider(colors));
    var frameUri = art.dataUri(art.pageFrame(colors));
    var ribbonUri = art.dataUri(art.ribbon(colors));
    var names = C.names.one + ' ' + C.names.joiner + ' ' + C.names.two;

    var rootEl = el('div', { className: 'wis-root fb', 'data-turn': turn });
    core.applyTheme(rootEl, config);
    rootEl.style.setProperty('--fb-damask', 'url("' + art.dataUri(art.damask(colors)) + '")');
    rootEl.style.setProperty('--fb-paper-art', 'url("' + art.dataUri(art.paperFloral(colors)) + '")');
    if (reduced) rootEl.classList.add('is-reduced');

    rootEl.appendChild(el('div', { className: 'fb-bg', 'aria-hidden': 'true' },
      el('img', { className: 'fb-bg-img', src: C.background || art.dataUri(art.background(colors)), alt: '', decoding: 'async' }),
      el('div', { className: 'fb-bg-tint' })));

    if (core.get(config, 'animation.petals', true) && !reduced) rootEl.appendChild(petals());

    // ---- helpers -----------------------------------------------------------
    function img(cls, src) {
      return el('img', { className: cls, src: src, alt: '', 'aria-hidden': 'true' });
    }

    function divider() {
      return img('fb-divider', dividerUri);
    }

    function lengthClass(text, long, xlong) {
      var len = Array.from(text || '').length;
      return len > xlong ? 'xlong' : len > long ? 'long' : null;
    }

    function script(text, cls) {
      return el('p', { className: 'fb-script' + (cls ? ' ' + cls : ''), text: text, dir: 'auto', 'data-len': lengthClass(text, 11, 18) });
    }

    function small(text, cls) {
      return core.textBlock('p', text, 'fb-small' + (cls ? ' ' + cls : ''));
    }

    // ---- page definitions ----------------------------------------------------
    var pages = [];

    pages.push({ id: 'cover', kind: 'cover', label: names, body: function () {
      var mono = C.names.arabic1 && C.names.arabic2
        ? el('p', {
          className: 'fb-oval-text wis-arabic fb-calligraphy', lang: 'ar', dir: 'rtl', text: C.names.arabic1 + ' و ' + C.names.arabic2,
          'data-len': lengthClass(C.names.arabic1 + C.names.arabic2, 11, 18)
        })
        : el('p', { className: 'fb-oval-text fb-script', text: C.names.initials });
      var coverLen = Math.max(Array.from(C.names.one).length, Array.from(C.names.two).length);
      return [
        small(C.coverTagline, 'fb-cover-tagline'),
        el('div', { className: 'fb-oval' }, img('fb-oval-frame', art.dataUri(art.ovalFrame(colors))), mono),
        el('h1', { className: 'fb-cover-names', 'data-len': coverLen > 18 ? 'xlong' : coverLen > 11 ? 'long' : null },
          el('span', { text: C.names.one, dir: 'auto' }),
          el('span', { className: 'fb-amp', text: C.names.joiner }),
          el('span', { text: C.names.two, dir: 'auto' })),
        small(C.coverDate, 'fb-cover-date')
      ];
    } });

    pages.push({ id: 'monogram', label: C.bismillah ? 'Bismillah' : names, body: function () {
      var arabicNames = C.names.arabic1 && C.names.arabic2;
      return [
        core.arabic(C.bismillah, 'fb-bismillah fb-calligraphy'),
        arabicNames
          ? el('p', { className: 'wis-arabic fb-calligraphy fb-arabic-names', lang: 'ar', dir: 'rtl', text: C.names.arabic1 + ' و ' + C.names.arabic2 })
          : null,
        arabicNames ? divider() : null,
        script(names, arabicNames ? 'fb-mono-latin' : 'fb-name')
      ];
    } });

    if (C.blessings || C.quote) {
      pages.push({ id: 'blessings', label: (C.blessings && C.blessings.heading) || 'Blessings', body: function () {
        var b = C.blessings, q = C.quote;
        return [
          b ? small(b.intro, 'fb-blessing-intro') : null,
          q ? core.arabic(q.arabic, 'fb-quote-ar fb-calligraphy') : null,
          q ? core.textBlock('p', q.translation, 'fb-quote') : null,
          q ? small(q.reference, 'fb-muted') : null,
          b && b.names.length ? divider() : null,
          b && b.names.length ? small(b.heading, 'fb-label') : null,
          b && b.names.length ? el('ul', { className: 'fb-blessing-names' }, b.names.map(function (line) {
            return el('li', { text: line, dir: 'auto' });
          })) : null
        ];
      } });
    }

    pages.push({ id: 'invite', label: C.heading || 'Invitation', ribbon: true, body: function () {
      var n = C.names;
      return [
        small(C.heading, 'fb-invite-heading'),
        C.family ? core.textBlock('p', C.family.intro, 'fb-lead') : null,
        el('div', { className: 'fb-couple' },
          script(n.one, 'fb-name'),
          small(n.full1, 'fb-fullname'),
          C.family ? small(n.parents1, 'fb-parents') : null,
          el('p', { className: 'fb-script fb-joiner', text: n.joiner, dir: 'auto' }),
          script(n.two, 'fb-name'),
          small(n.full2, 'fb-fullname'),
          C.family ? small(n.parents2, 'fb-parents') : null)
      ];
    } });

    if (C.message) {
      pages.push({ id: 'message', label: 'Message', body: function () {
        return [divider(), core.textBlock('p', C.message, 'fb-lead'), divider()];
      } });
    }

    C.events.forEach(function (ev, i) {
      pages.push({ id: 'event-' + i, label: ev.label || 'Event', ribbon: i === 0, body: function () {
        var time = ev.timeText + (ev.endTimeText ? ' – ' + ev.endTimeText : '');
        var parts = ev.parts;
        return [
          el('h2', { className: 'fb-display', text: ev.label, dir: 'auto', 'data-len': lengthClass(ev.label, 9, 14) }),
          parts ? el('p', { className: 'fb-date' },
            el('span', { className: 'fb-date-line', text: parts.weekday + ', ' + parts.day }),
            el('span', { className: 'fb-date-line', text: parts.month + ' ' + parts.year })) : small(ev.dateText, 'fb-date'),
          small(ev.hijriText, 'fb-hijri'),
          small(ev.note, 'fb-note'),
          small(time, 'fb-time'),
          ev.venueName || ev.address ? el('div', { className: 'fb-venue' },
            small(L.venue, 'fb-label'),
            small(ev.venueName, 'fb-venue-name'),
            small(ev.address, 'fb-address')) : null,
          core.linkButton(ev.mapsHref, L.viewMap, 'map')
        ];
      } });
    });

    if (C.photo) {
      pages.push({ id: 'photo', label: C.photo.heading || 'Photo', body: function () {
        return [
          small(C.photo.heading, 'fb-label'),
          el('figure', { className: 'fb-photo' },
            el('img', { src: C.photo.src, alt: C.photo.caption || names, loading: 'lazy' }),
            C.photo.caption ? el('figcaption', { text: C.photo.caption, dir: 'auto' }) : null)
        ];
      } });
    }

    if (C.rsvp) {
      pages.push({ id: 'rsvp', label: C.rsvp.heading || 'RSVP', body: function () {
        var r = C.rsvp;
        return [
          el('h2', { className: 'fb-display fb-display-sm', text: r.heading || 'RSVP', dir: 'auto' }),
          divider(),
          core.textBlock('p', r.message, 'fb-lead'),
          r.deadlineText ? el('p', { className: 'fb-small' }, L.rsvpBy + ' ', el('strong', { text: r.deadlineText })) : null,
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
        small(cl.heading, 'fb-closing-heading'),
        script(cl.signature || names, 'fb-closing-name'),
        core.textBlock('p', cl.message, 'fb-lead'),
        small(cl.hashtag, 'fb-hashtag')
      ];
    } });

    pages.push({ id: 'back', kind: 'backcover', label: (C.countdown && C.countdown.heading) || L.readAgain, body: function () {
      var parts = [];
      if (C.countdown && isFinite(C.countdown.targetMs)) {
        var w = core.countdownWidget(C.countdown, L);
        cleanups.push(w.destroy);
        parts.push(small(C.countdown.heading, 'fb-back-heading'), w);
      }
      var pills = C.events.filter(function (ev) { return ev.mapsHref; }).map(function (ev) {
        return el('a', { className: 'fb-pill', href: ev.mapsHref, target: '_blank', rel: 'noopener noreferrer' },
          core.icon('map'),
          el('span', { className: 'fb-pill-text' },
            el('span', { className: 'fb-pill-label', text: ev.label }),
            el('span', { className: 'fb-pill-venue', text: ev.venueName || ev.address })));
      });
      if (pills.length) parts.push(el('div', { className: 'fb-pills' }, pills));
      parts.push(el('button', { type: 'button', className: 'fb-again', onclick: function () { goTo(0); } },
        core.icon('replay'), el('span', { text: L.readAgain })));
      return parts;
    } });

    // ---- book --------------------------------------------------------------
    var total = pages.length;
    var book = el('div', { className: 'fb-book', role: 'region', 'aria-roledescription': 'book', 'aria-label': pages[0].label });

    function decorations(pg) {
      if (pg.kind) {
        return [
          img('fb-cover-frame', frameUri),
          img('fb-corner fb-corner--tl', cornerUri),
          img('fb-corner fb-corner--br', cornerUri)
        ];
      }
      return [
        img('fb-frame', frameUri),
        img('fb-corner fb-corner--tl', cornerUri),
        img('fb-corner fb-corner--br', cornerUri),
        pg.ribbon ? img('fb-ribbon', ribbonUri) : null
      ];
    }

    var leaves = pages.map(function (pg, i) {
      var inner = el('div', { className: pg.kind ? 'fb-cover-inner' : 'fb-page-inner' }, pg.body());
      var front = el('div', { className: 'fb-face fb-front ' + (pg.kind ? 'fb-cover-face' : 'fb-paper') }, decorations(pg), inner);
      var back = el('div', { className: 'fb-face fb-back', 'aria-hidden': 'true' },
        img('fb-frame', frameUri), img('fb-corner fb-corner--tr', cornerUri), img('fb-corner fb-corner--bl', cornerUri));
      var leaf = el('section', {
        className: 'fb-leaf' + (pg.kind ? ' fb-' + pg.kind : ''),
        'aria-label': L.page + ' ' + (i + 1) + ' ' + L.of + ' ' + total + ': ' + pg.label,
        'data-page': pg.id
      }, front, back);
      if (pg.kind === 'cover') leaf.addEventListener('click', function () { if (index === 0) open(); });
      book.appendChild(leaf);
      return leaf;
    });

    var prompt = el('button', { type: 'button', className: 'fb-prompt', onclick: function () { open(); } },
      el('span', { text: C.openPrompt || 'Scroll to open the book' }), el('span', { className: 'fb-chevron', 'aria-hidden': 'true' }));
    var prev = el('button', { type: 'button', className: 'fb-nav-btn', 'aria-label': L.previous, onclick: function () { goTo(index - 1); } }, core.icon('left'));
    var next = el('button', { type: 'button', className: 'fb-nav-btn', 'aria-label': L.next, onclick: function () { goTo(index + 1); } }, core.icon('right'));
    var dots = el('div', { className: 'fb-dots' }, pages.map(function (pg, i) {
      return el('button', { type: 'button', className: 'fb-dot', 'aria-label': L.page + ' ' + (i + 1) + ': ' + pg.label, onclick: function () { goTo(i); } });
    }));
    var counter = el('span', { className: 'fb-counter', 'aria-hidden': 'true' });
    var nav = el('nav', { className: 'fb-nav', 'aria-label': 'Invitation pages' }, prev, el('div', { className: 'fb-nav-mid' }, dots, counter), next);
    var live = el('p', { className: 'wis-sr-only', 'aria-live': 'polite' });
    var stage = el('main', { className: 'fb-stage' }, el('div', { className: 'fb-book-wrap' }, book), el('div', { className: 'fb-controls' }, prompt, nav), live);
    rootEl.appendChild(stage);

    if (C.musicSrc) {
      var mb = core.musicButton(ctx.music, L);
      cleanups.push(mb.destroy);
      rootEl.appendChild(mb);
    }

    function startMusic() {
      if (C.musicSrc && C.musicOnOpen && !ctx.music.isPlaying()) ctx.music.play();
    }

    // Curtain intro
    var curtain = null;
    var showCurtain = core.get(config, 'animation.intro', 'curtain') === 'curtain' && !(ctx.state && ctx.state.curtainOpen);
    if (showCurtain) {
      curtain = core.curtain(config, function () {
        startMusic();
        stage.inert = false;
        rootEl.classList.add('is-revealed');
        prompt.focus({ preventScroll: true });
      });
      stage.inert = true;
      rootEl.appendChild(curtain.el);
    } else {
      rootEl.classList.add('is-revealed');
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
      rootEl.classList.toggle('is-open', index > 0 && index < total - 1);
      rootEl.classList.toggle('is-closed', index === 0);
      rootEl.classList.toggle('is-back', index === total - 1);
      prev.disabled = index === 0;
      next.disabled = index === total - 1;
      counter.textContent = index + 1 + ' / ' + total;
      book.setAttribute('aria-label', pages[index].label);
      if (announce) live.textContent = L.page + ' ' + (index + 1) + ' ' + L.of + ' ' + total + ': ' + pages[index].label;
    }

    var lockUntil = 0;
    function goTo(i, opts) {
      i = Math.max(0, Math.min(total - 1, i | 0));
      if (i === index) return;
      var from = index;
      index = i;
      lockUntil = Date.now() + turnMs * 0.85;
      var moving = i > from ? leaves.slice(from, i) : leaves.slice(i, from);
      moving.forEach(function (leaf) {
        leaf.classList.add('is-moving');
        setTimeout(function () { leaf.classList.remove('is-moving'); }, turnMs + 200);
      });
      var hadFocus = leaves[from].contains(document.activeElement) || document.activeElement === prompt;
      update(!(opts && opts.silent));
      if (hadFocus) (index === 0 ? prompt : index === total - 1 ? prev : next).focus({ preventScroll: true });
    }

    function open() {
      if (curtain && !curtain.isOpen()) {
        curtain.open();
        return;
      }
      startMusic();
      goTo(1);
    }

    function step(dir) {
      if (Date.now() < lockUntil) return;
      if (dir > 0) {
        if (index === 0) open();
        else goTo(index + 1);
      } else goTo(index - 1);
    }

    // Scroll-wheel / trackpad: one page per gesture. A page whose own text
    // overflows scrolls first.
    var wheelAcc = 0;
    var wheelTimer = null;
    function onWheel(e) {
      if (curtain && !curtain.isOpen()) return;
      var scroller = e.target.closest && e.target.closest('.fb-page-inner');
      if (scroller && scroller.scrollHeight > scroller.clientHeight + 2) {
        var atTop = scroller.scrollTop <= 0, atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        if ((e.deltaY > 0 && !atEnd) || (e.deltaY < 0 && !atTop)) return;
      }
      e.preventDefault();
      wheelAcc += e.deltaY;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () { wheelAcc = 0; }, 220);
      if (Math.abs(wheelAcc) > 40) {
        step(wheelAcc > 0 ? 1 : -1);
        wheelAcc = 0;
      }
    }
    rootEl.addEventListener('wheel', onWheel, { passive: false });

    // Swipes: left/up = next, right/down = previous.
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
      var horizontal = Math.abs(dx) > Math.abs(dy);
      var d = horizontal ? dx : dy;
      if (Math.abs(d) < 45) return;
      step(d < 0 ? 1 : -1);
    });
    book.addEventListener('pointercancel', function () { startX = null; });

    function onKey(e) {
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (curtain && !curtain.isOpen()) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          curtain.open();
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'ArrowDown') step(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') step(-1);
      else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(total - 1);
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    cleanups.push(function () { document.removeEventListener('keydown', onKey); });

    // Restore the previous page without animating when re-rendering.
    rootEl.classList.add('no-anim');
    index = ctx.state && typeof ctx.state.index === 'number' ? Math.min(ctx.state.index, total - 1) : 0;
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
      getState: function () { return { index: index, curtainOpen: !curtain || curtain.isOpen() }; },
      destroy: function () {
        cleanups.forEach(function (fn) { if (fn) fn(); });
        cleanups = [];
      }
    };
  }

  root.InviteTemplates = root.InviteTemplates || {};
  root.InviteTemplates['floral-book'] = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
