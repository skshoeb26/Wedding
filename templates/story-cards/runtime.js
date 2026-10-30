/*
 * Template: Story Cards — full-screen slides like a social-media story.
 * Tap the right side for the next slide, the left side to go back, hold to
 * pause. Slides advance on their own unless reduced motion is requested.
 */
(function (root) {
  'use strict';

  var SLIDE_MS = 7000;

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

    var rootEl = el('div', { className: 'wis-root sc' + (reduced ? ' is-reduced' : '') });
    core.applyTheme(rootEl, config);
    rootEl.style.setProperty('--sc-slide-ms', SLIDE_MS + 'ms');
    rootEl.style.setProperty('--sc-damask', 'url("' + art.dataUri(art.damask(colors)) + '")');

    function divider() {
      return el('img', { className: 'sc-divider', src: dividerUri, alt: '', 'aria-hidden': 'true' });
    }

    var cover = {
      id: 'cover', label: C.names.one + ' ' + C.names.joiner + ' ' + C.names.two, nodes: [
        core.arabic(C.bismillah, 'wis-b-bismillah'),
        core.textBlock('p', C.coverTagline, 'wis-b-small sc-tag'),
        el('h1', { className: 'sc-names' },
          el('span', { text: C.names.one, dir: 'auto' }), el('span', { className: 'sc-amp', text: C.names.joiner }),
          el('span', { text: C.names.two, dir: 'auto' })),
        core.textBlock('p', C.coverDate, 'wis-b-small'),
        el('p', { className: 'sc-hint', text: C.openPrompt || 'Tap to continue' })
      ]
    };
    var slides = [cover].concat(core.blocks(C, { divider: divider, cleanups: cleanups, onReplay: function () { goTo(0); } }));
    var total = slides.length;

    var bars = el('div', { className: 'sc-bars', 'aria-hidden': 'true' }, slides.map(function () {
      return el('span', { className: 'sc-bar' }, el('i'));
    }));
    var deck = el('div', { className: 'sc-deck', role: 'region', 'aria-roledescription': 'slideshow', 'aria-label': cover.label });
    var slideEls = slides.map(function (s, i) {
      var node = el('section', {
        className: 'sc-slide sc-slide--' + s.id.replace(/-\d+$/, ''),
        'aria-roledescription': 'slide',
        'aria-label': (i + 1) + ' / ' + total + ': ' + s.label
      },
      el('img', { className: 'sc-corner sc-corner--tl', src: cornerUri, alt: '', 'aria-hidden': 'true' }),
      el('img', { className: 'sc-corner sc-corner--br', src: cornerUri, alt: '', 'aria-hidden': 'true' }),
      el('div', { className: 'sc-card' }, s.nodes));
      deck.appendChild(node);
      return node;
    });
    var prev = el('button', { type: 'button', className: 'sc-tap sc-tap--prev', 'aria-label': L.previous });
    var next = el('button', { type: 'button', className: 'sc-tap sc-tap--next', 'aria-label': L.next });
    var pauseBtn = el('button', { type: 'button', className: 'sc-pause', 'aria-pressed': 'false', 'aria-label': 'Pause slideshow' }, el('span', { 'aria-hidden': 'true' }));
    var live = el('p', { className: 'wis-sr-only', 'aria-live': 'polite' });

    rootEl.appendChild(el('div', { className: 'sc-bg', 'aria-hidden': 'true' },
      el('img', { src: C.background || art.dataUri(art.background(colors)), alt: '' })));
    var stage = el('div', { className: 'sc-stage' }, bars, deck, prev, next, pauseBtn, live);
    rootEl.appendChild(stage);

    if (C.musicSrc) {
      var mb = core.musicButton(ctx.music, L);
      cleanups.push(mb.destroy);
      rootEl.appendChild(mb);
    }

    var index = 0;
    var timer = null;
    var paused = reduced;
    var started = false;

    var remaining = SLIDE_MS, timerStart = 0;
    function schedule(ms) {
      clearTimeout(timer);
      remaining = ms || SLIDE_MS;
      rootEl.classList.toggle('is-paused', paused);
      pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      pauseBtn.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
      if (paused || index >= total - 1 || !started) return;
      timerStart = Date.now();
      timer = setTimeout(function () { goTo(index + 1); }, remaining);
    }

    function render(announce) {
      slideEls.forEach(function (s, k) {
        s.classList.toggle('is-active', k === index);
        s.classList.toggle('is-before', k < index);
        s.inert = k !== index;
        s.setAttribute('aria-hidden', k === index ? 'false' : 'true');
      });
      Array.prototype.forEach.call(bars.children, function (b, k) {
        b.classList.toggle('is-done', k < index);
        b.classList.remove('is-active');
        if (k === index) {
          void b.offsetWidth; // restart the fill animation
          b.classList.add('is-active');
        }
      });
      deck.setAttribute('aria-label', slides[index].label);
      prev.disabled = index === 0;
      if (announce) live.textContent = (index + 1) + ' / ' + total + ': ' + slides[index].label;
    }

    function start() {
      if (started) return;
      started = true;
      rootEl.classList.add('is-started');
      if (C.musicSrc && C.musicOnOpen && !ctx.music.isPlaying()) ctx.music.play();
    }

    function goTo(i) {
      i = Math.max(0, Math.min(total - 1, i));
      index = i;
      render(true);
      schedule();
    }

    // A long press pauses (like stories) and must not also change the slide.
    var holding = false, heldLong = false, holdTimer = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a, .sc-card button, .sc-pause')) return;
      holding = true;
      heldLong = false;
      holdTimer = setTimeout(function () {
        heldLong = true;
        rootEl.classList.add('is-holding');
        clearTimeout(timer);
        remaining = Math.max(300, remaining - (Date.now() - timerStart));
      }, 350);
    });
    function release() {
      if (!holding) return;
      holding = false;
      clearTimeout(holdTimer);
      if (heldLong) {
        rootEl.classList.remove('is-holding');
        schedule(remaining);
      }
    }
    rootEl.addEventListener('pointerup', release);
    rootEl.addEventListener('pointercancel', release);

    prev.addEventListener('click', function () {
      if (heldLong) { heldLong = false; return; }
      start();
      goTo(index - 1);
    });
    next.addEventListener('click', function () {
      if (heldLong) { heldLong = false; return; }
      var wasStarted = started;
      start();
      if (!wasStarted && index === 0) { goTo(1); return; }
      goTo(index + 1);
    });
    pauseBtn.addEventListener('click', function () {
      start();
      paused = !paused;
      schedule();
    });

    function onKey(e) {
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { start(); goTo(index + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(index - 1);
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);

    var curtain = null;
    if (core.get(config, 'animation.intro', 'curtain') === 'curtain' && !(ctx.state && ctx.state.started)) {
      curtain = core.curtain(config, function () { start(); schedule(); });
      rootEl.appendChild(curtain.el);
    }

    cleanups.push(function () { clearTimeout(timer); document.removeEventListener('keydown', onKey); });

    if (ctx.state) {
      index = Math.min(ctx.state.index || 0, total - 1);
      if (ctx.state.started) { started = true; rootEl.classList.add('is-started'); }
      paused = reduced || !!ctx.state.paused;
    }
    rootEl.classList.add('no-anim');
    render(false);
    schedule();
    mount.appendChild(rootEl);
    requestAnimationFrame(function () { requestAnimationFrame(function () { rootEl.classList.remove('no-anim'); }); });

    return {
      goTo: function (i) { start(); goTo(i); },
      getState: function () { return { index: index, started: started, paused: paused }; },
      destroy: function () {
        cleanups.forEach(function (fn) { if (fn) fn(); });
        cleanups = [];
      }
    };
  }

  root.InviteTemplates = root.InviteTemplates || {};
  root.InviteTemplates['story-cards'] = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
