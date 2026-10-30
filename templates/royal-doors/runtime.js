/*
 * Template: Royal Doors — a carved arched doorway. Guests tap the door rings,
 * the doors swing open, and the invitation continues in arch-topped panels.
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
    var medallionUri = art.dataUri(art.medallion(colors));

    var rootEl = el('div', { className: 'wis-root rd' + (reduced ? ' is-reduced' : '') });
    core.applyTheme(rootEl, config);
    rootEl.style.setProperty('--rd-damask', 'url("' + art.dataUri(art.damask(colors)) + '")');
    rootEl.style.setProperty('--rd-paper-art', 'url("' + art.dataUri(art.paperFloral(colors)) + '")');

    function divider() {
      return el('img', { className: 'rd-divider', src: dividerUri, alt: '', 'aria-hidden': 'true' });
    }

    function door(side) {
      return el('div', { className: 'rd-door rd-door--' + side, 'aria-hidden': 'true' },
        el('div', { className: 'rd-door-panel rd-door-panel--top' }),
        el('div', { className: 'rd-door-panel rd-door-panel--bottom' }),
        el('img', { className: 'rd-door-medallion', src: medallionUri, alt: '' }),
        el('span', { className: 'rd-ring' }));
    }

    var prompt = C.openPrompt || 'Tap to open the doors';
    var opener = el('button', { type: 'button', className: 'rd-open', 'aria-label': prompt },
      el('span', { text: prompt }));
    var inside = el('div', { className: 'rd-inside' },
      core.arabic(C.bismillah, 'rd-bismillah'),
      core.textBlock('p', C.coverTagline, 'wis-b-small rd-tag'),
      el('h1', { className: 'rd-names' },
        el('span', { text: C.names.one, dir: 'auto' }), el('span', { className: 'rd-amp', text: C.names.joiner }),
        el('span', { text: C.names.two, dir: 'auto' })),
      core.textBlock('p', C.coverDate, 'wis-b-small rd-date'),
      el('a', { className: 'rd-cue', href: '#rd-details' }, el('span', { text: L.details }), el('span', { className: 'rd-chevron', 'aria-hidden': 'true' })));
    var archway = el('div', { className: 'rd-arch' },
      el('div', { className: 'rd-arch-inner' }, inside, door('left'), door('right')),
      opener);
    var hero = el('header', { className: 'rd-hero' },
      el('img', { className: 'rd-hero-bg', src: C.background || art.dataUri(art.background(colors)), alt: '', 'aria-hidden': 'true' }),
      el('div', { className: 'rd-hero-inner' }, archway));
    rootEl.appendChild(hero);

    var main = el('main', { className: 'rd-main', id: 'rd-details' });
    core.blocks(C, { divider: divider, cleanups: cleanups, onReplay: function () { close(); } }).forEach(function (blk) {
      main.appendChild(el('section', { className: 'rd-panel rd-reveal rd-panel--' + blk.id.replace(/-\d+$/, ''), 'aria-label': blk.label },
        el('img', { className: 'rd-panel-corner', src: cornerUri, alt: '', 'aria-hidden': 'true' }), blk.nodes));
    });
    rootEl.appendChild(main);

    if (C.musicSrc) {
      var mb = core.musicButton(ctx.music, L);
      cleanups.push(mb.destroy);
      rootEl.appendChild(mb);
    }

    var opened = false;
    var stopReveal = null;
    function setLocked(v) { document.documentElement.classList.toggle('rd-locked', v); }
    function open(instant) {
      if (opened) return;
      opened = true;
      if (!instant && C.musicSrc && C.musicOnOpen && !ctx.music.isPlaying()) ctx.music.play();
      rootEl.classList.add('is-open');
      main.inert = false;
      setLocked(false);
      if (!stopReveal) stopReveal = core.revealOnScroll(rootEl, '.rd-reveal', reduced);
    }
    function close() {
      opened = false;
      root.scrollTo(0, 0);
      rootEl.classList.remove('is-open');
      main.inert = true;
      setLocked(true);
      opener.focus({ preventScroll: true });
    }
    opener.addEventListener('click', function () { open(false); });
    function onKey(e) {
      if (!opened && (e.key === 'Enter' || e.key === ' ') && e.target === document.body) {
        e.preventDefault();
        open(false);
      }
    }
    document.addEventListener('keydown', onKey);
    cleanups.push(function () {
      document.removeEventListener('keydown', onKey);
      if (stopReveal) stopReveal();
      setLocked(false);
    });

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
      goTo: function (i) { if (i) open(false); else close(); },
      getState: function () { return { opened: opened, scroll: root.scrollY }; },
      destroy: function () {
        cleanups.forEach(function (fn) { if (fn) fn(); });
        cleanups = [];
      }
    };
  }

  root.InviteTemplates = root.InviteTemplates || {};
  root.InviteTemplates['royal-doors'] = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
