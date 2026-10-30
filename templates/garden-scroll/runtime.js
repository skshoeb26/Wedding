/*
 * Template: Garden Scroll — a single elegant scrolling invitation page.
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
    var dividerUri = art.dataUri(art.divider(colors));
    var cornerUri = art.dataUri(art.corner(colors));
    var names = C.names.one + ' ' + C.names.joiner + ' ' + C.names.two;

    var rootEl = el('div', { className: 'wis-root gs' + (reduced ? ' is-reduced' : '') });
    core.applyTheme(rootEl, config);

    function divider() {
      return el('img', { className: 'gs-divider', src: dividerUri, alt: '', 'aria-hidden': 'true' });
    }

    function section(cls, label, children) {
      return el('section', { className: 'gs-section gs-reveal ' + cls, 'aria-label': label }, children);
    }

    var hero = el('header', { className: 'gs-hero' },
      el('img', { className: 'gs-hero-bg', src: C.background || art.dataUri(art.background(colors)), alt: '', 'aria-hidden': 'true' }),
      el('div', { className: 'gs-hero-card' },
        el('img', { className: 'gs-corner gs-corner--tl', src: cornerUri, alt: '', 'aria-hidden': 'true' }),
        el('img', { className: 'gs-corner gs-corner--br', src: cornerUri, alt: '', 'aria-hidden': 'true' }),
        core.arabic(C.bismillah, 'gs-bismillah'),
        core.textBlock('p', C.coverTagline, 'gs-eyebrow'),
        el('h1', { className: 'gs-names' },
          el('span', { text: C.names.one, dir: 'auto' }), el('span', { className: 'gs-amp', text: C.names.joiner }),
          el('span', { text: C.names.two, dir: 'auto' })),
        core.textBlock('p', C.coverDate, 'gs-hero-date'),
        el('a', { className: 'wis-btn gs-scroll-cue', href: '#gs-start' }, el('span', { text: C.openPrompt || L.open }))));
    rootEl.appendChild(hero);

    var body = el('main', { className: 'gs-main', id: 'gs-start' });

    body.appendChild(section('gs-intro', C.heading || 'Invitation', [
      core.textBlock('p', C.heading, 'gs-eyebrow'),
      C.family ? core.textBlock('p', C.family.intro, 'gs-lead') : null,
      divider(),
      el('div', { className: 'gs-couple' },
        el('div', null, el('p', { className: 'gs-script', text: C.names.one, dir: 'auto' }), core.textBlock('p', C.names.full1, 'gs-full'),
          C.family ? core.textBlock('p', C.names.parents1, 'gs-muted') : null),
        el('p', { className: 'gs-script gs-amp', text: C.names.joiner }),
        el('div', null, el('p', { className: 'gs-script', text: C.names.two, dir: 'auto' }), core.textBlock('p', C.names.full2, 'gs-full'),
          C.family ? core.textBlock('p', C.names.parents2, 'gs-muted') : null))
    ]));

    if (C.quote || C.message) {
      body.appendChild(section('gs-quote', 'Message', [
        C.quote ? core.arabic(C.quote.arabic, 'gs-quote-ar') : null,
        C.quote ? core.textBlock('p', C.quote.translation, 'gs-quote-text') : null,
        C.quote ? core.textBlock('p', C.quote.reference, 'gs-eyebrow') : null,
        core.textBlock('p', C.message, 'gs-lead')
      ]));
    }

    if (C.events.length) {
      body.appendChild(section('gs-events', 'Events', el('div', { className: 'gs-event-grid' }, C.events.map(function (ev) {
        var time = ev.timeText + (ev.endTimeText ? ' – ' + ev.endTimeText : '');
        return el('article', { className: 'gs-event' },
          el('h2', { className: 'gs-script gs-event-title', text: ev.label }),
          core.textBlock('p', ev.dateText, 'gs-event-date'),
          core.textBlock('p', time, 'gs-event-time'),
          core.textBlock('p', ev.hijriText, 'gs-muted'),
          core.textBlock('p', ev.venueName, 'gs-venue'),
          core.textBlock('p', ev.address, 'gs-muted'),
          core.textBlock('p', ev.note, 'gs-muted'),
          core.linkButton(ev.mapsHref, L.viewMap, 'map'));
      }))));
    }

    if (C.countdown && isFinite(C.countdown.targetMs)) {
      var w = core.countdownWidget(C.countdown, L);
      cleanups.push(w.destroy);
      body.appendChild(section('gs-count', 'Countdown', [
        el('h2', { className: 'gs-script gs-event-title', text: C.countdown.heading || 'Save the date' }), w
      ]));
    }

    if (C.photo) {
      body.appendChild(section('gs-photo', 'Photo', [
        core.textBlock('p', C.photo.heading, 'gs-eyebrow'),
        el('figure', null, el('img', { src: C.photo.src, alt: C.photo.caption || names, loading: 'lazy' }),
          C.photo.caption ? el('figcaption', { text: C.photo.caption }) : null)
      ]));
    }

    if (C.rsvp) {
      var r = C.rsvp;
      body.appendChild(section('gs-rsvp', 'RSVP', [
        el('h2', { className: 'gs-script gs-event-title', text: r.heading || 'RSVP' }),
        core.textBlock('p', r.message, 'gs-lead'),
        r.deadlineText ? el('p', { className: 'gs-event-time' }, L.rsvpBy + ' ', el('strong', { text: r.deadlineText })) : null,
        r.contacts.length ? el('ul', { className: 'gs-contacts' }, r.contacts.map(function (c) {
          return el('li', null, el('span', { text: c.name }),
            c.telHref ? el('a', { href: c.telHref }, core.icon('phone'), el('span', { text: c.phone, dir: 'ltr' })) : null);
        })) : null,
        el('div', { className: 'gs-actions' }, core.linkButton(r.whatsappHref, L.whatsapp, 'chat'), core.linkButton(r.link, L.rsvpLink, 'link'))
      ]));
    }

    body.appendChild(section('gs-closing', 'Closing', [
      el('h2', { className: 'gs-script gs-event-title', text: C.closing.heading }),
      divider(),
      core.textBlock('p', C.closing.message, 'gs-lead'),
      el('p', { className: 'gs-script gs-closing-names', text: names }),
      core.textBlock('p', C.closing.signature, 'gs-muted'),
      core.textBlock('p', C.closing.hashtag, 'gs-eyebrow')
    ]));

    rootEl.appendChild(body);

    if (C.musicSrc) {
      var mb = core.musicButton(ctx.music, L);
      cleanups.push(mb.destroy);
      rootEl.appendChild(mb);
      var startOnScroll = function () {
        if (C.musicOnOpen && !ctx.music.isPlaying()) ctx.music.play();
      };
      var cue = hero.querySelector('.gs-scroll-cue');
      cue.addEventListener('click', startOnScroll);
    }

    if (core.get(config, 'animation.intro', 'curtain') === 'curtain' && !(ctx.state && ctx.state.curtainOpen)) {
      var curtain = core.curtain(config, function () {
        if (C.musicSrc && C.musicOnOpen && !ctx.music.isPlaying()) ctx.music.play();
      });
      rootEl.appendChild(curtain.el);
      rootEl.curtain = curtain;
    }

    mount.appendChild(rootEl);

    if (!reduced && 'IntersectionObserver' in root) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });
      Array.prototype.forEach.call(rootEl.querySelectorAll('.gs-reveal'), function (n) { io.observe(n); });
      cleanups.push(function () { io.disconnect(); });
    } else {
      Array.prototype.forEach.call(rootEl.querySelectorAll('.gs-reveal'), function (n) { n.classList.add('is-visible'); });
    }

    if (ctx.state && ctx.state.scroll) root.scrollTo(0, ctx.state.scroll);

    return {
      goTo: function (i) { root.scrollTo({ top: i ? body.offsetTop : 0, behavior: reduced ? 'auto' : 'smooth' }); },
      getState: function () { return { scroll: root.scrollY, curtainOpen: !rootEl.curtain || rootEl.curtain.isOpen() }; },
      destroy: function () {
        cleanups.forEach(function (fn) { if (fn) fn(); });
        cleanups = [];
      }
    };
  }

  root.InviteTemplates = root.InviteTemplates || {};
  root.InviteTemplates['garden-scroll'] = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
