/*
 * Template: Sealed Envelope — guests tap a wax seal, the flap lifts, the
 * letter slides out, and the full invitation unfolds below it.
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
    var cleanups = [];
    var names = C.names.one + ' ' + C.names.joiner + ' ' + C.names.two;
    var dividerUri = art.dataUri(art.divider(colors));
    var cornerUri = art.dataUri(art.corner(colors));

    var rootEl = el('div', { className: 'wis-root se' + (reduced ? ' is-reduced' : '') });
    core.applyTheme(rootEl, config);
    rootEl.style.setProperty('--se-paper-art', 'url("' + art.dataUri(art.paperFloral(colors)) + '")');

    function divider() {
      return el('img', { className: 'se-divider', src: dividerUri, alt: '', 'aria-hidden': 'true' });
    }

    function small(text, cls) {
      return core.textBlock('p', text, 'se-small' + (cls ? ' ' + cls : ''));
    }

    // ---- envelope hero -------------------------------------------------------
    var promptText = C.openPrompt || 'Tap the seal to open';
    var seal = el('button', { type: 'button', className: 'se-seal', 'aria-label': promptText },
      el('span', { className: 'se-seal-text', text: C.names.one.charAt(0) + C.names.two.charAt(0), 'aria-hidden': 'true' }));
    var letter = el('div', { className: 'se-letter', 'aria-hidden': 'true' },
      small(C.coverTagline, 'se-letter-tag'),
      el('p', { className: 'se-letter-names', dir: 'auto' }, el('span', { text: C.names.one }), el('span', { className: 'se-amp', text: C.names.joiner }), el('span', { text: C.names.two })),
      small(C.coverDate, 'se-letter-date'));
    var envelope = el('div', { className: 'se-envelope' },
      el('div', { className: 'se-back' }),
      letter,
      el('div', { className: 'se-pocket', 'aria-hidden': 'true' }),
      el('div', { className: 'se-flap', 'aria-hidden': 'true' }),
      seal);
    var hint = el('p', { className: 'se-hint', text: promptText });
    var cue = el('a', { className: 'se-cue', href: '#se-details' }, el('span', { text: L.details }), el('span', { className: 'se-chevron', 'aria-hidden': 'true' }));
    var hero = el('header', { className: 'se-hero' },
      el('img', { className: 'se-hero-bg', src: C.background || art.dataUri(art.background(colors)), alt: '', 'aria-hidden': 'true' }),
      el('div', { className: 'se-hero-inner' }, small(C.coverTagline, 'se-hero-tag'), envelope, hint, cue));
    rootEl.appendChild(hero);

    // ---- details -------------------------------------------------------------
    function card(cls, label, children) {
      return el('section', { className: 'se-card se-reveal ' + cls, 'aria-label': label },
        el('img', { className: 'se-card-corner', src: cornerUri, alt: '', 'aria-hidden': 'true' }), children);
    }

    var main = el('main', { className: 'se-main', id: 'se-details' });
    main.appendChild(card('se-intro', C.heading || 'Invitation', [
      core.arabic(C.bismillah, 'se-bismillah'),
      small(C.heading, 'se-heading'),
      C.family ? core.textBlock('p', C.family.intro, 'se-lead') : null,
      el('p', { className: 'se-script se-name', text: C.names.one, dir: 'auto' }),
      small(C.names.full1),
      C.family ? small(C.names.parents1, 'se-muted') : null,
      el('p', { className: 'se-script se-amp-big', text: C.names.joiner }),
      el('p', { className: 'se-script se-name', text: C.names.two, dir: 'auto' }),
      small(C.names.full2),
      C.family ? small(C.names.parents2, 'se-muted') : null
    ]));

    if (C.blessings || C.quote || C.message) {
      var b = C.blessings, q = C.quote;
      main.appendChild(card('se-bless', 'Blessings', [
        b ? small(b.intro) : null,
        q ? core.arabic(q.arabic, 'se-quote-ar') : null,
        q ? core.textBlock('p', q.translation, 'se-quote') : null,
        q ? small(q.reference, 'se-muted') : null,
        b && b.names.length ? divider() : null,
        b && b.names.length ? small(b.heading, 'se-label') : null,
        b && b.names.length ? el('ul', { className: 'se-list' }, b.names.map(function (l) { return el('li', { text: l, dir: 'auto' }); })) : null,
        core.textBlock('p', C.message, 'se-lead')
      ]));
    }

    C.events.forEach(function (ev) {
      var time = ev.timeText + (ev.endTimeText ? ' – ' + ev.endTimeText : '');
      main.appendChild(card('se-event', ev.label || 'Event', [
        el('h2', { className: 'se-display', text: ev.label, dir: 'auto' }),
        small(ev.dateText, 'se-date'),
        small(ev.hijriText, 'se-muted'),
        small([ev.note, time].filter(Boolean).join(' · ')),
        divider(),
        small(ev.venueName, 'se-venue'),
        small(ev.address, 'se-muted'),
        core.linkButton(ev.mapsHref, L.viewMap, 'map')
      ]));
    });

    if (C.countdown && isFinite(C.countdown.targetMs)) {
      var w = core.countdownWidget(C.countdown, L);
      cleanups.push(w.destroy);
      main.appendChild(card('se-count', 'Countdown', [small(C.countdown.heading, 'se-label'), w]));
    }

    if (C.photo) {
      main.appendChild(card('se-photo', 'Photo', [
        small(C.photo.heading, 'se-label'),
        el('figure', null, el('img', { src: C.photo.src, alt: C.photo.caption || names, loading: 'lazy' }),
          C.photo.caption ? el('figcaption', { text: C.photo.caption }) : null)
      ]));
    }

    if (C.rsvp) {
      var r = C.rsvp;
      main.appendChild(card('se-rsvp', 'RSVP', [
        el('h2', { className: 'se-display se-display-sm', text: r.heading || 'RSVP' }),
        core.textBlock('p', r.message, 'se-lead'),
        r.deadlineText ? el('p', { className: 'se-small' }, L.rsvpBy + ' ', el('strong', { text: r.deadlineText })) : null,
        r.contacts.length ? el('ul', { className: 'se-list se-contacts' }, r.contacts.map(function (c) {
          return el('li', null, el('span', { text: c.name }),
            c.telHref ? el('a', { href: c.telHref }, core.icon('phone'), el('span', { text: c.phone, dir: 'ltr' })) : null);
        })) : null,
        el('div', { className: 'se-actions' }, core.linkButton(r.whatsappHref, L.whatsapp, 'chat'), core.linkButton(r.link, L.rsvpLink, 'link'))
      ]));
    }

    main.appendChild(card('se-closing', 'Closing', [
      small(C.closing.heading, 'se-label'),
      el('p', { className: 'se-script se-name', text: C.closing.signature || names, dir: 'auto' }),
      core.textBlock('p', C.closing.message, 'se-lead'),
      small(C.closing.hashtag, 'se-label'),
      el('button', { type: 'button', className: 'wis-btn', onclick: function () { reseal(); } }, core.icon('replay'), el('span', { text: L.readAgain }))
    ]));
    rootEl.appendChild(main);

    if (C.musicSrc) {
      var mb = core.musicButton(ctx.music, L);
      cleanups.push(mb.destroy);
      rootEl.appendChild(mb);
    }

    // ---- open / close --------------------------------------------------------
    var opened = false;
    var timers = [];
    function setLocked(locked) {
      document.documentElement.classList.toggle('se-locked', locked);
    }
    function open(instant) {
      if (opened) return;
      opened = true;
      if (C.musicSrc && C.musicOnOpen && !ctx.music.isPlaying() && !instant) ctx.music.play();
      rootEl.classList.add('is-opening');
      timers.push(setTimeout(function () {
        rootEl.classList.add('is-open');
        setLocked(false);
        main.inert = false;
        observe();
      }, instant || reduced ? 0 : 2300));
    }
    function reseal() {
      timers.forEach(clearTimeout);
      opened = false;
      root.scrollTo(0, 0);
      rootEl.classList.remove('is-opening', 'is-open');
      main.inert = true;
      setLocked(true);
      seal.focus({ preventScroll: true });
    }
    seal.addEventListener('click', function () { open(false); });
    letter.addEventListener('click', function () {
      if (rootEl.classList.contains('is-open')) main.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    });
    envelope.addEventListener('click', function (e) { if (e.target !== seal) open(false); });
    function onKey(e) {
      if (!opened && (e.key === 'Enter' || e.key === ' ') && e.target === document.body) {
        e.preventDefault();
        open(false);
      }
    }
    document.addEventListener('keydown', onKey);
    cleanups.push(function () { document.removeEventListener('keydown', onKey); });

    var io = null;
    function observe() {
      var items = rootEl.querySelectorAll('.se-reveal');
      if (reduced || !('IntersectionObserver' in root)) {
        Array.prototype.forEach.call(items, function (n) { n.classList.add('is-visible'); });
        return;
      }
      if (io) io.disconnect();
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.1 });
      Array.prototype.forEach.call(items, function (n) { io.observe(n); });
    }
    cleanups.push(function () { if (io) io.disconnect(); timers.forEach(clearTimeout); setLocked(false); });

    mount.appendChild(rootEl);
    if (ctx.state && ctx.state.opened) {
      rootEl.classList.add('no-anim');
      open(true);
      if (ctx.state.scroll) root.scrollTo(0, ctx.state.scroll);
      requestAnimationFrame(function () { requestAnimationFrame(function () { rootEl.classList.remove('no-anim'); }); });
    } else {
      main.inert = true;
      setLocked(true);
    }

    return {
      goTo: function (i) { if (i) open(false); else reseal(); },
      getState: function () { return { opened: opened, scroll: root.scrollY }; },
      destroy: function () {
        cleanups.forEach(function (fn) { if (fn) fn(); });
        cleanups = [];
      }
    };
  }

  root.InviteTemplates = root.InviteTemplates || {};
  root.InviteTemplates['sealed-envelope'] = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
