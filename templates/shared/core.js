/*
 * Wedding Invitation Studio — shared invitation runtime.
 *
 * Runs inside every exported invitation. It never interprets user content as
 * HTML: all text is inserted with textContent and every URL is validated.
 */
(function (root) {
  'use strict';

  var HEX = /^#[0-9a-fA-F]{6}$/;

  var FONT_STACKS = {
    'Great Vibes': "'Great Vibes', 'Segoe Script', 'Brush Script MT', cursive",
    'Cormorant Garamond': "'Cormorant Garamond', 'Cormorant', Garamond, 'Times New Roman', serif",
    'Marcellus': "'Marcellus', 'Trajan Pro', 'Palatino Linotype', Palatino, serif",
    'Georgia': "Georgia, 'Times New Roman', serif",
    'System Sans': "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    'Amiri': "'Amiri', 'Noto Naskh Arabic', 'Traditional Arabic', 'Times New Roman', serif",
    'Aref Ruqaa': "'Aref Ruqaa', 'Amiri', 'Noto Naskh Arabic', 'Traditional Arabic', serif"
  };

  var DEFAULT_LABELS = {
    days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds',
    viewMap: 'View location', venue: 'Venue', call: 'Call', whatsapp: 'WhatsApp',
    rsvpLink: 'Respond online', rsvpBy: 'Kindly respond by', previous: 'Previous page',
    next: 'Next page', open: 'Open invitation', readAgain: 'Open again',
    playMusic: 'Play music', pauseMusic: 'Pause music', page: 'Page', of: 'of',
    details: 'View details'
  };

  function get(obj, path, fallback) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return fallback;
      cur = cur[parts[i]];
    }
    return cur === undefined || cur === null ? fallback : cur;
  }

  function str(value, max) {
    if (value === undefined || value === null) return '';
    var s = String(value);
    return max && s.length > max ? s.slice(0, max) : s;
  }

  function safeColor(value, fallback) {
    return HEX.test(str(value)) ? str(value) : fallback;
  }

  function safeHttpUrl(value) {
    var s = str(value).trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) return '';
    try {
      var u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
    } catch (e) {
      return '';
    }
  }

  function phoneDigits(value) {
    var s = str(value).trim();
    var plus = s.charAt(0) === '+';
    var digits = s.replace(/[^0-9]/g, '');
    if (digits.length < 5 || digits.length > 16) return '';
    return (plus ? '+' : '') + digits;
  }

  function telHref(value) {
    var d = phoneDigits(value);
    return d ? 'tel:' + d : '';
  }

  function whatsappHref(value, text) {
    var d = phoneDigits(value).replace('+', '');
    if (!d) return '';
    return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(str(text, 300)) : '');
  }

  function mapsHref(url, address) {
    var safe = safeHttpUrl(url);
    if (safe) return safe;
    var a = str(address).trim();
    return a ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a) : '';
  }

  var DATA_URI = /^data:(image\/(png|jpeg|webp|gif|avif|svg\+xml)|audio\/(mpeg|mp3|mp4|aac|x-m4a|ogg|wav|x-wav|wave|webm|flac))(;charset=[\w-]+)?(;base64)?,/i;
  var REL_ASSET = /^assets\/[A-Za-z0-9._\/-]+$/;

  function safeAssetSrc(value) {
    var s = str(value);
    if (!s) return '';
    if (DATA_URI.test(s)) return s;
    if (REL_ASSET.test(s) && s.indexOf('..') === -1) return s;
    return '';
  }

  function assetSrc(config, slot) {
    return safeAssetSrc(get(config, 'assets.' + slot + '.src', ''));
  }

  function lang(config) {
    var l = str(get(config, 'meta.lang', 'en')).trim();
    return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(l) ? l : 'en';
  }

  function isoDate(value) {
    var s = str(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }

  function dateAtNoonUtc(iso) {
    var d = new Date(iso + 'T12:00:00Z');
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(iso, locale) {
    iso = isoDate(iso);
    var d = iso && dateAtNoonUtc(iso);
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
      }).format(d);
    } catch (e) {
      return iso;
    }
  }

  function dateParts(iso, locale) {
    iso = isoDate(iso);
    var d = iso && dateAtNoonUtc(iso);
    if (!d) return null;
    function f(opts) {
      try {
        opts.timeZone = 'UTC';
        return new Intl.DateTimeFormat(locale, opts).format(d);
      } catch (e) {
        return '';
      }
    }
    return { day: f({ day: '2-digit' }), month: f({ month: 'long' }), year: f({ year: 'numeric' }), weekday: f({ weekday: 'long' }) };
  }

  function formatTime(value, locale) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(str(value).trim());
    if (!m) return str(value, 80);
    var h = +m[1], min = +m[2];
    if (h > 23 || min > 59) return str(value, 80);
    try {
      return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
        .format(new Date(Date.UTC(2000, 0, 1, h, min)));
    } catch (e) {
      return value;
    }
  }

  function hijriDate(iso, locale) {
    iso = isoDate(iso);
    var d = iso && dateAtNoonUtc(iso);
    if (!d) return '';
    try {
      var fmt = new Intl.DateTimeFormat((locale || 'en') + '-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
      });
      if (!/^islamic/.test(fmt.resolvedOptions().calendar)) return '';
      return fmt.format(d);
    } catch (e) {
      return '';
    }
  }

  function utcOffset(value) {
    var s = str(value).trim();
    if (s === 'Z' || s === '') return 'Z';
    var m = /^([+-])(\d{2}):?(\d{2})$/.exec(s);
    if (!m || +m[2] > 14 || +m[3] > 59) return 'Z';
    return m[1] + m[2] + ':' + m[3];
  }

  // Parses "YYYY-MM-DDTHH:MM" in the given UTC offset (e.g. "+05:30").
  function parseTarget(target, offset) {
    var s = str(target).trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) return NaN;
    if (s.length === 16) s += ':00';
    return Date.parse(s + utcOffset(offset));
  }

  function countdownParts(targetMs, nowMs) {
    if (!isFinite(targetMs)) return { valid: false, expired: false, days: 0, hours: 0, minutes: 0, seconds: 0 };
    var ms = targetMs - nowMs;
    if (ms <= 0) return { valid: true, expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    var total = Math.floor(ms / 1000);
    return {
      valid: true,
      expired: false,
      days: Math.floor(total / 86400),
      hours: Math.floor(total / 3600) % 24,
      minutes: Math.floor(total / 60) % 60,
      seconds: total % 60
    };
  }

  function pad2(v) {
    return v < 10 ? '0' + v : String(v);
  }

  function reducedMotion(config) {
    var mode = get(config, 'animation.reducedMotion', 'auto');
    if (mode === 'reduce') return true;
    if (mode === 'full') return false;
    try {
      return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  // Minimal element builder. `attrs.text` sets textContent; children may be
  // strings (inserted as text nodes) or nodes. No HTML parsing ever happens.
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'text') node.textContent = v;
        else if (k === 'className') node.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') {
          Object.keys(v).forEach(function (p) { node.style.setProperty(p, v[p]); });
        } else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(node, child) {
    if (child === undefined || child === null || child === false) return;
    if (Array.isArray(child)) child.forEach(function (c) { append(node, c); });
    else if (typeof child === 'string' || typeof child === 'number') node.appendChild(document.createTextNode(String(child)));
    else node.appendChild(child);
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var ICONS = {
    note: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0z',
    pause: 'M7 5v14M17 5v14',
    left: 'M15 18l-6-6l6-6',
    right: 'M9 18l6-6l-6-6',
    map: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12.2a2.6 2.6 0 1 0 0-5.2a2.6 2.6 0 0 0 0 5.2z',
    phone: 'M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
    chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
    link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
    replay: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5'
  };

  function icon(name) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'wis-icon');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name] || '');
    svg.appendChild(path);
    return svg;
  }

  function fontStack(name, fallback) {
    return FONT_STACKS[name] || FONT_STACKS[fallback];
  }

  function applyTheme(node, config) {
    var c = get(config, 'theme.colors', {});
    var f = get(config, 'theme.fonts', {});
    var vars = {
      '--wis-primary': safeColor(c.primary, '#9c5b63'),
      '--wis-rose': safeColor(c.rose, '#d9a3a5'),
      '--wis-accent': safeColor(c.accent, '#b8925a'),
      '--wis-paper': safeColor(c.paper, '#fffaf2'),
      '--wis-ink': safeColor(c.ink, '#4f3535'),
      '--wis-background': safeColor(c.background, '#f2dcd6'),
      '--wis-font-script': fontStack(f.script, 'Great Vibes'),
      '--wis-font-heading': fontStack(f.heading, 'Cormorant Garamond'),
      '--wis-font-body': fontStack(f.body, 'Cormorant Garamond'),
      '--wis-font-arabic': fontStack(f.arabic, 'Amiri'),
      '--wis-font-calligraphy': fontStack(f.calligraphy, 'Aref Ruqaa'),
      '--wis-text-scale': String(Math.min(1.3, Math.max(0.8, Number(get(config, 'theme.textScale', 1)) || 1))),
      '--wis-turn-ms': Math.min(2500, Math.max(200, Number(get(config, 'animation.pageTurnMs', 900)) || 900)) + 'ms'
    };
    Object.keys(vars).forEach(function (k) { node.style.setProperty(k, vars[k]); });
  }

  function labels(config) {
    var custom = get(config, 'invitation.labels', {});
    var out = {};
    Object.keys(DEFAULT_LABELS).forEach(function (k) {
      var v = str(custom[k]).trim();
      out[k] = v ? str(v, 60) : DEFAULT_LABELS[k];
    });
    return out;
  }

  function enabled(config, section) {
    return get(config, 'sections.' + section, true) !== false;
  }

  // Builds the display model shared by every template.
  function content(config) {
    var L = lang(config);
    var inv = get(config, 'invitation', {});
    var p1 = get(inv, 'couple.partner1', {});
    var p2 = get(inv, 'couple.partner2', {});
    var name1 = str(p1.name, 80).trim() || 'Bride';
    var name2 = str(p2.name, 80).trim() || 'Groom';
    var showHijri = enabled(config, 'hijri');

    var events = (Array.isArray(inv.events) ? inv.events : []).slice(0, 8).filter(function (e) {
      return e && e.enabled !== false;
    }).map(function (e) {
      var hijri = '';
      if (showHijri) hijri = e.hijriAuto === false ? str(e.hijriDate, 80).trim() : hijriDate(e.date, L);
      return {
        label: str(e.label, 80).trim(),
        dateText: formatDate(e.date, L) || str(e.dateText, 80),
        parts: dateParts(e.date, L),
        timeText: e.time ? formatTime(e.time, L) : '',
        endTimeText: e.endTime ? formatTime(e.endTime, L) : '',
        hijriText: hijri,
        venueName: str(e.venueName, 120).trim(),
        address: str(e.address, 300).trim(),
        note: str(e.note, 300).trim(),
        mapsHref: (e.mapsUrl || e.address) ? mapsHref(e.mapsUrl, e.address) : ''
      };
    });

    var countdown = null;
    if (enabled(config, 'countdown')) {
      countdown = {
        heading: str(get(inv, 'countdown.heading', ''), 120),
        targetMs: parseTarget(get(inv, 'countdown.target', ''), get(inv, 'countdown.utcOffset', 'Z')),
        expiredMessage: str(get(inv, 'countdown.expiredMessage', ''), 200)
      };
    }

    var rsvp = null;
    if (enabled(config, 'rsvp')) {
      var r = get(inv, 'rsvp', {});
      rsvp = {
        heading: str(r.heading, 120),
        message: str(r.message, 600),
        deadlineText: formatDate(r.deadline, L),
        link: safeHttpUrl(r.link),
        whatsappHref: whatsappHref(r.whatsapp, r.whatsappMessage),
        contacts: (Array.isArray(r.contacts) ? r.contacts : []).slice(0, 6).map(function (c) {
          return { name: str(c && c.name, 80).trim(), phone: str(c && c.phone, 40).trim(), telHref: telHref(c && c.phone) };
        }).filter(function (c) { return c.name || c.telHref; })
      };
    }

    var quote = null;
    if (enabled(config, 'quote')) {
      quote = {
        arabic: str(get(inv, 'quote.arabic', ''), 600).trim(),
        translation: str(get(inv, 'quote.translation', ''), 800).trim(),
        reference: str(get(inv, 'quote.reference', ''), 120).trim()
      };
      if (!quote.arabic && !quote.translation) quote = null;
    }

    var photo = enabled(config, 'photo') ? assetSrc(config, 'couplePhoto') : '';

    return {
      lang: L,
      labels: labels(config),
      names: {
        one: name1,
        two: name2,
        joiner: str(get(inv, 'couple.joiner', '&'), 12) || '&',
        full1: str(p1.fullName, 120).trim(),
        full2: str(p2.fullName, 120).trim(),
        arabic1: str(p1.arabicName, 80).trim(),
        arabic2: str(p2.arabicName, 80).trim(),
        parents1: str(p1.parents, 200).trim(),
        parents2: str(p2.parents, 200).trim(),
        initials: (name1.charAt(0) + ' ' + (str(get(inv, 'couple.joiner', '&'), 12) || '&') + ' ' + name2.charAt(0))
      },
      heading: str(inv.heading, 160),
      blessings: enabled(config, 'blessings') ? {
        intro: str(get(inv, 'blessings.intro', ''), 300).trim(),
        heading: str(get(inv, 'blessings.heading', ''), 120).trim(),
        names: str(get(inv, 'blessings.names', ''), 600).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 8)
      } : null,
      curtainPrompt: str(inv.curtainPrompt, 80).trim(),
      coverTagline: str(inv.coverTagline, 120),
      coverDate: enabled(config, 'coverDate') && events[0] ? events[0].dateText : '',
      openPrompt: str(inv.openPrompt, 80),
      bismillah: enabled(config, 'bismillah') ? str(inv.bismillah, 200).trim() : '',
      family: enabled(config, 'family') ? {
        intro: str(inv.familyIntro, 800).trim(),
        showParents: true
      } : null,
      message: str(inv.message, 1200).trim(),
      quote: quote,
      events: enabled(config, 'events') ? events : [],
      countdown: countdown,
      photo: photo ? { src: photo, caption: str(get(inv, 'gallery.caption', ''), 200), heading: str(get(inv, 'gallery.heading', ''), 120) } : null,
      rsvp: rsvp,
      closing: {
        heading: str(get(inv, 'closing.heading', ''), 120),
        message: str(get(inv, 'closing.message', ''), 800),
        signature: str(get(inv, 'closing.signature', ''), 200),
        hashtag: str(get(inv, 'closing.hashtag', ''), 80)
      },
      background: assetSrc(config, 'background'),
      musicSrc: assetSrc(config, 'music'),
      musicOnOpen: get(config, 'invitation.music.startOnOpen', true) !== false,
      musicTitle: str(get(config, 'invitation.music.title', ''), 120)
    };
  }

  // Background music controller. Browsers block autoplay, so playback only
  // starts from a user gesture (the open tap or the music button).
  function createMusic() {
    var audio = null;
    var src = '';
    var listeners = [];
    var state = 'idle'; // idle | playing | paused | blocked | error
    var resumeOnVisible = false;

    function emit(s) {
      state = s;
      listeners.forEach(function (fn) { fn(state); });
    }

    function ensure() {
      if (audio || !src) return audio;
      audio = new Audio();
      audio.loop = true;
      audio.preload = 'none';
      audio.src = src;
      audio.addEventListener('playing', function () { emit('playing'); });
      audio.addEventListener('pause', function () { if (state !== 'error') emit('paused'); });
      audio.addEventListener('error', function () { emit('error'); });
      return audio;
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (!audio) return;
        if (document.hidden && !audio.paused) {
          resumeOnVisible = true;
          audio.pause();
        } else if (!document.hidden && resumeOnVisible) {
          resumeOnVisible = false;
          play();
        }
      });
    }

    function play() {
      var a = ensure();
      if (!a) return Promise.resolve(false);
      var p;
      try {
        p = a.play();
      } catch (e) {
        emit('blocked');
        return Promise.resolve(false);
      }
      return Promise.resolve(p).then(function () { return true; }, function (err) {
        emit(err && err.name === 'NotAllowedError' ? 'blocked' : 'error');
        return false;
      });
    }

    return {
      setSource: function (next, volume) {
        next = safeAssetSrc(next);
        if (next === src) {
          if (audio && volume !== undefined) audio.volume = volume;
          return;
        }
        if (audio) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
          audio = null;
        }
        src = next;
        emit('idle');
        if (src && volume !== undefined) ensure().volume = volume;
      },
      hasSource: function () { return !!src; },
      play: play,
      pause: function () { if (audio) audio.pause(); },
      toggle: function () {
        if (audio && !audio.paused) {
          audio.pause();
          return Promise.resolve(false);
        }
        return play();
      },
      state: function () { return state; },
      isPlaying: function () { return state === 'playing'; },
      subscribe: function (fn) {
        listeners.push(fn);
        return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
      }
    };
  }

  function musicButton(music, L) {
    var label = el('span', { className: 'wis-music-label', text: L.playMusic });
    var bars = el('span', { className: 'wis-music-bars', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'));
    var btn = el('button', {
      type: 'button',
      className: 'wis-music',
      'aria-pressed': 'false',
      'aria-label': L.playMusic,
      onclick: function () { music.toggle(); }
    }, icon('note'), bars, label);
    var unsub = music.subscribe(render);
    function render(s) {
      var playing = s === 'playing';
      btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      btn.setAttribute('aria-label', playing ? L.pauseMusic : L.playMusic);
      btn.classList.toggle('is-playing', playing);
      btn.classList.toggle('is-error', s === 'error');
      label.textContent = s === 'error' ? 'Audio unavailable' : playing ? L.pauseMusic : L.playMusic;
      btn.title = s === 'blocked' ? 'Tap to start the music' : label.textContent;
    }
    render(music.state());
    btn.destroy = unsub;
    return btn;
  }

  function countdownWidget(model, L, onExpire) {
    var units = [['days', L.days], ['hours', L.hours], ['minutes', L.minutes], ['seconds', L.seconds]];
    var cells = {};
    var grid = el('div', { className: 'wis-countdown', role: 'timer', 'aria-live': 'off' }, units.map(function (u) {
      cells[u[0]] = el('span', { className: 'wis-count-num', text: '--' });
      return el('div', { className: 'wis-count-cell' }, cells[u[0]], el('span', { className: 'wis-count-label', text: u[1] }));
    }));
    var expired = el('p', { className: 'wis-count-expired', hidden: true, text: model.expiredMessage });
    var wrap = el('div', { className: 'wis-countdown-wrap' }, grid, expired);
    var timer = null;
    function tick() {
      var parts = countdownParts(model.targetMs, Date.now());
      if (!parts.valid) {
        grid.hidden = true;
        expired.hidden = true;
        return;
      }
      if (parts.expired) {
        Object.keys(cells).forEach(function (k) { cells[k].textContent = '00'; });
        expired.hidden = !model.expiredMessage;
        grid.classList.add('is-expired');
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        if (onExpire) onExpire();
        return;
      }
      cells.days.textContent = String(parts.days);
      cells.hours.textContent = pad2(parts.hours);
      cells.minutes.textContent = pad2(parts.minutes);
      cells.seconds.textContent = pad2(parts.seconds);
      grid.setAttribute('aria-label', parts.days + ' ' + L.days + ', ' + parts.hours + ' ' + L.hours + ', ' +
        parts.minutes + ' ' + L.minutes);
    }
    tick();
    if (!grid.classList.contains('is-expired') && isFinite(model.targetMs)) timer = setInterval(tick, 1000);
    wrap.destroy = function () { if (timer) clearInterval(timer); };
    return wrap;
  }

  // Full-screen curtain shown before the invitation. Any tap, key press or
  // scroll on it draws the curtains apart (and counts as the user gesture
  // that lets music start).
  function curtain(config, onOpen) {
    var art = root.InviteArt;
    var colors = get(config, 'theme.colors', {});
    var prompt = str(get(config, 'invitation.curtainPrompt', ''), 80).trim() || 'Pull the strings to open';
    var uri = art.dataUri(art.curtain(colors));
    var opened = false;
    var btn = el('button', { type: 'button', className: 'wis-curtain-pull' },
      el('span', { className: 'wis-curtain-tassel', 'aria-hidden': 'true' }),
      el('span', { className: 'wis-curtain-text', text: prompt }),
      el('span', { className: 'wis-curtain-chevron', 'aria-hidden': 'true' }));
    var wrap = el('div', { className: 'wis-curtain' },
      el('div', { className: 'wis-curtain-panel is-left', 'aria-hidden': 'true' }, el('img', { src: uri, alt: '' })),
      el('div', { className: 'wis-curtain-panel is-right', 'aria-hidden': 'true' }, el('img', { src: uri, alt: '' })),
      btn);
    function open() {
      if (opened) return;
      opened = true;
      wrap.classList.add('is-open');
      if (onOpen) onOpen();
      setTimeout(function () { wrap.hidden = true; }, reducedMotion(config) ? 450 : 1900);
    }
    wrap.addEventListener('click', open);
    wrap.addEventListener('wheel', open, { passive: true });
    var startY = null;
    wrap.addEventListener('pointerdown', function (e) { startY = e.clientY; });
    wrap.addEventListener('pointermove', function (e) {
      if (startY !== null && Math.abs(e.clientY - startY) > 30) open();
    });
    return { el: wrap, open: open, isOpen: function () { return opened; }, focus: function () { btn.focus({ preventScroll: true }); } };
  }

  function linkButton(href, text, iconName, extra) {
    if (!href) return null;
    var external = /^https?:/i.test(href);
    return el('a', {
      className: 'wis-btn' + (extra ? ' ' + extra : ''),
      href: href,
      target: external ? '_blank' : null,
      rel: external ? 'noopener noreferrer' : null
    }, iconName ? icon(iconName) : null, el('span', { text: text }));
  }

  function arabic(text, className) {
    if (!text) return null;
    return el('p', { className: 'wis-arabic' + (className ? ' ' + className : ''), lang: 'ar', dir: 'rtl', text: text });
  }

  function textBlock(tag, text, className) {
    if (!text) return null;
    return el(tag, { className: className || null, text: text, dir: 'auto' });
  }

  var api = {
    get: get,
    str: str,
    el: el,
    icon: icon,
    safeColor: safeColor,
    safeHttpUrl: safeHttpUrl,
    safeAssetSrc: safeAssetSrc,
    telHref: telHref,
    whatsappHref: whatsappHref,
    mapsHref: mapsHref,
    formatDate: formatDate,
    formatTime: formatTime,
    hijriDate: hijriDate,
    parseTarget: parseTarget,
    countdownParts: countdownParts,
    reducedMotion: reducedMotion,
    applyTheme: applyTheme,
    content: content,
    createMusic: createMusic,
    musicButton: musicButton,
    countdownWidget: countdownWidget,
    linkButton: linkButton,
    curtain: curtain,
    arabic: arabic,
    textBlock: textBlock,
    FONT_STACKS: FONT_STACKS,
    DEFAULT_LABELS: DEFAULT_LABELS
  };

  root.InviteCore = api;
  root.InviteTemplates = root.InviteTemplates || {};
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
