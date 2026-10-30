/*
 * Template: Moonlit Night — a night sky with a crescent moon, twinkling stars
 * and hanging lanterns. Guests tap to light the lanterns, then scroll through
 * glowing gold-framed sections.
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
    var lanternUri = art.dataUri(art.lantern(colors));

    var rootEl = el('div', { className: 'wis-root mn' + (reduced ? ' is-reduced' : '') });
    core.applyTheme(rootEl, config);

    function divider() {
      return el('img', { className: 'mn-divider', src: dividerUri, alt: '', 'aria-hidden': 'true' });
    }

    // Sky: deterministic stars so re-renders do not reshuffle them.
    var sky = el('div', { className: 'mn-sky', 'aria-hidden': 'true' });
    var seed = 7;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (var i = 0; i < 70; i++) {
      sky.appendChild(el('span', {
        className: 'mn-star',
        style: { left: (rand() * 100).toFixed(2) + '%', top: (rand() * 100).toFixed(2) + '%', '--s': (1 + rand() * 2.2).toFixed(1) + 'px', '--d': (2 + rand() * 4).toFixed(1) + 's', '--o': (-rand() * 5).toFixed(1) + 's' }
      }));
    }
    sky.appendChild(el('span', { className: 'mn-moon' }));
    rootEl.appendChild(sky);

    var lanterns = el('div', { className: 'mn-lanterns', 'aria-hidden': 'true' }, [
      ['12%', '18%', 0.9, '-1.2s'], ['32%', '6%', 0.7, '-0.4s'], ['70%', '10%', 0.8, '-2s'], ['88%', '22%', 1, '-0.8s']
    ].map(function (l) {
      return el('img', { className: 'mn-lantern', src: lanternUri, alt: '', style: { left: l[0], '--drop': l[1], '--scale': String(l[2]), '--delay': l[3] } });
    }));
    rootEl.appendChild(lanterns);

    var light = el('button', { type: 'button', className: 'mn-light' }, el('span', { text: C.openPrompt || 'Tap to light the lanterns' }));
    var hero = el('header', { className: 'mn-hero' },
      el('div', { className: 'mn-hero-inner' },
        core.arabic(C.bismillah, 'mn-bismillah'),
        core.textBlock('p', C.coverTagline, 'wis-b-small mn-tag'),
        el('h1', { className: 'mn-names' },
          el('span', { text: C.names.one, dir: 'auto' }), el('span', { className: 'mn-amp', text: C.names.joiner }),
          el('span', { text: C.names.two, dir: 'auto' })),
        core.textBlock('p', C.coverDate, 'wis-b-small mn-date'),
        light,
        el('a', { className: 'mn-cue', href: '#mn-details' }, el('span', { text: L.details }), el('span', { className: 'mn-chevron', 'aria-hidden': 'true' }))));
    rootEl.appendChild(hero);

    var main = el('main', { className: 'mn-main', id: 'mn-details' });
    core.blocks(C, { divider: divider, cleanups: cleanups, onReplay: function () { root.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); } }).forEach(function (blk) {
      main.appendChild(el('section', { className: 'mn-card mn-reveal mn-card--' + blk.id.replace(/-\d+$/, ''), 'aria-label': blk.label }, blk.nodes));
    });
    rootEl.appendChild(main);

    if (C.musicSrc) {
      var mb = core.musicButton(ctx.music, L);
      cleanups.push(mb.destroy);
      rootEl.appendChild(mb);
    }

    var lit = false;
    function lightUp(instant) {
      if (lit) return;
      lit = true;
      if (!instant && C.musicSrc && C.musicOnOpen && !ctx.music.isPlaying()) ctx.music.play();
      rootEl.classList.add('is-lit');
    }
    light.addEventListener('click', function () { lightUp(false); });
    hero.addEventListener('click', function (e) { if (!e.target.closest('a')) lightUp(false); });
    // Scrolling down also lights the lanterns, so nobody gets stuck.
    function onScroll() { if (root.scrollY > 40) lightUp(true); }
    root.addEventListener('scroll', onScroll, { passive: true });
    cleanups.push(function () { root.removeEventListener('scroll', onScroll); });
    cleanups.push(core.revealOnScroll(rootEl, '.mn-reveal', reduced));

    if (ctx.state && ctx.state.lit) {
      rootEl.classList.add('no-anim');
      lightUp(true);
    }
    mount.appendChild(rootEl);
    if (ctx.state && ctx.state.scroll) root.scrollTo(0, ctx.state.scroll);
    requestAnimationFrame(function () { requestAnimationFrame(function () { rootEl.classList.remove('no-anim'); }); });

    return {
      goTo: function (i) { root.scrollTo({ top: i ? main.offsetTop : 0, behavior: reduced ? 'auto' : 'smooth' }); },
      getState: function () { return { lit: lit, scroll: root.scrollY }; },
      destroy: function () {
        cleanups.forEach(function (fn) { if (fn) fn(); });
        cleanups = [];
      }
    };
  }

  root.InviteTemplates = root.InviteTemplates || {};
  root.InviteTemplates['moonlit-night'] = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
