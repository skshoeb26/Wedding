/*
 * Wedding Invitation Studio — procedural floral artwork.
 *
 * All artwork here is original and generated from simple vector shapes, so it
 * can be recoloured from the theme palette and replaced by user uploads.
 * Only validated hex colours are interpolated into the SVG markup.
 */
(function (root) {
  'use strict';

  var HEX = /^#[0-9a-fA-F]{6}$/;

  function hex(value, fallback) {
    return HEX.test(String(value || '')) ? String(value).toLowerCase() : fallback;
  }

  function toRgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

  // Linear blend of two hex colours, t = 0 → a, t = 1 → b.
  function mix(a, b, t) {
    var x = toRgb(a), y = toRgb(b);
    return toHex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; }));
  }

  // Deterministic PRNG so artwork is stable between renders and exports.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function n(v) { return Math.round(v * 10) / 10; }

  function palette(colors) {
    colors = colors || {};
    var p = {
      primary: hex(colors.primary, '#9c5b63'),
      rose: hex(colors.rose, '#d9a3a5'),
      accent: hex(colors.accent, '#b8925a'),
      paper: hex(colors.paper, '#fffaf2'),
      ink: hex(colors.ink, '#4f3535'),
      background: hex(colors.background, '#f2dcd6')
    };
    p.leaf = mix(mix('#8d8a62', p.accent, 0.45), p.ink, 0.12);
    p.leafLight = mix(p.leaf, '#f3ead6', 0.5);
    p.roseLight = mix(p.rose, '#ffffff', 0.55);
    p.roseDeep = mix(p.rose, p.primary, 0.6);
    p.goldLight = mix(p.accent, '#fff4d8', 0.5);
    p.goldDeep = mix(p.accent, '#5a3d1c', 0.35);
    return p;
  }

  function key(p) {
    return [p.primary, p.rose, p.accent, p.paper, p.ink, p.background].join('');
  }

  function defs(p, id) {
    return '<defs>' +
      '<radialGradient id="' + id + 'rose" cx="50%" cy="85%" r="95%">' +
      '<stop offset="0" stop-color="' + p.roseDeep + '"/>' +
      '<stop offset="0.55" stop-color="' + p.rose + '"/>' +
      '<stop offset="1" stop-color="' + p.roseLight + '"/></radialGradient>' +
      '<radialGradient id="' + id + 'roseIn" cx="50%" cy="90%" r="90%">' +
      '<stop offset="0" stop-color="' + mix(p.roseDeep, p.ink, 0.25) + '"/>' +
      '<stop offset="1" stop-color="' + p.rose + '"/></radialGradient>' +
      '<radialGradient id="' + id + 'ivory" cx="50%" cy="85%" r="95%">' +
      '<stop offset="0" stop-color="' + mix(p.paper, p.accent, 0.35) + '"/>' +
      '<stop offset="1" stop-color="' + p.paper + '"/></radialGradient>' +
      '<linearGradient id="' + id + 'leaf" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="' + p.leaf + '"/>' +
      '<stop offset="1" stop-color="' + p.leafLight + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'gold" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + p.goldLight + '"/>' +
      '<stop offset="0.5" stop-color="' + p.accent + '"/>' +
      '<stop offset="1" stop-color="' + p.goldDeep + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'pearl" cx="35%" cy="30%" r="75%">' +
      '<stop offset="0" stop-color="#ffffff"/>' +
      '<stop offset="0.55" stop-color="' + mix(p.paper, p.rose, 0.18) + '"/>' +
      '<stop offset="1" stop-color="' + mix(p.rose, p.ink, 0.25) + '"/></radialGradient>' +
      '</defs>';
  }

  function petalPath(r) {
    return 'M0 0C' + n(-0.58 * r) + ' ' + n(-0.12 * r) + ' ' + n(-0.66 * r) + ' ' + n(-0.86 * r) +
      ' 0 ' + n(-r) + 'C' + n(0.66 * r) + ' ' + n(-0.86 * r) + ' ' + n(0.58 * r) + ' ' + n(-0.12 * r) + ' 0 0Z';
  }

  function rose(x, y, r, rot, p, id, ivory) {
    var fill = ivory ? 'url(#' + id + 'ivory)' : 'url(#' + id + 'rose)';
    var edge = ivory ? mix(p.paper, p.accent, 0.55) : p.roseDeep;
    var layers = [
      { s: 1, count: 6, off: 0 },
      { s: 0.8, count: 5, off: 28 },
      { s: 0.6, count: 5, off: 8 },
      { s: 0.42, count: 4, off: 50 },
      { s: 0.26, count: 3, off: 20 }
    ];
    var out = '<g transform="translate(' + n(x) + ' ' + n(y) + ') rotate(' + n(rot) + ')">';
    layers.forEach(function (layer, li) {
      for (var i = 0; i < layer.count; i++) {
        var a = layer.off + (360 / layer.count) * i;
        out += '<path d="' + petalPath(r * layer.s) + '" transform="rotate(' + n(a) + ')" fill="' +
          (li > 2 && !ivory ? 'url(#' + id + 'roseIn)' : fill) + '" stroke="' + edge +
          '" stroke-opacity="0.45" stroke-width="' + n(Math.max(0.6, r * 0.018)) + '"/>';
      }
    });
    out += '<path d="M0 ' + n(-r * 0.12) + 'c' + n(r * 0.12) + ' 0 ' + n(r * 0.14) + ' ' + n(r * 0.16) + ' 0 ' +
      n(r * 0.18) + 's' + n(-r * 0.2) + ' ' + n(-r * 0.2) + ' 0 ' + n(-r * 0.3) + '" fill="none" stroke="' +
      edge + '" stroke-opacity="0.7" stroke-width="' + n(Math.max(0.8, r * 0.025)) + '"/>';
    return out + '</g>';
  }

  function leaf(x, y, len, angle, id, p) {
    var w = len * 0.3;
    return '<g transform="translate(' + n(x) + ' ' + n(y) + ') rotate(' + n(angle) + ')">' +
      '<path d="M0 0C' + n(len * 0.28) + ' ' + n(-w) + ' ' + n(len * 0.78) + ' ' + n(-w * 0.8) + ' ' + n(len) +
      ' 0C' + n(len * 0.78) + ' ' + n(w * 0.8) + ' ' + n(len * 0.28) + ' ' + n(w) + ' 0 0Z" fill="url(#' + id +
      'leaf)" opacity="0.92"/>' +
      '<path d="M0 0Q' + n(len * 0.5) + ' ' + n(-w * 0.08) + ' ' + n(len * 0.95) + ' 0" fill="none" stroke="' +
      p.leafLight + '" stroke-opacity="0.8" stroke-width="' + n(Math.max(0.6, len * 0.012)) + '"/></g>';
  }

  function blossom(x, y, r, p, color) {
    var out = '<g transform="translate(' + n(x) + ' ' + n(y) + ')">';
    for (var i = 0; i < 5; i++) {
      var a = (Math.PI * 2 * i) / 5;
      out += '<circle cx="' + n(Math.cos(a) * r * 0.62) + '" cy="' + n(Math.sin(a) * r * 0.62) + '" r="' +
        n(r * 0.48) + '" fill="' + color + '" opacity="0.92"/>';
    }
    return out + '<circle r="' + n(r * 0.3) + '" fill="' + p.accent + '"/></g>';
  }

  function sprig(x, y, len, angle, p, rand) {
    var out = '<g transform="translate(' + n(x) + ' ' + n(y) + ') rotate(' + n(angle) + ')">' +
      '<path d="M0 0Q' + n(len * 0.5) + ' ' + n(-len * 0.18) + ' ' + n(len) + ' 0" fill="none" stroke="' +
      p.accent + '" stroke-width="' + n(Math.max(0.8, len * 0.012)) + '" stroke-linecap="round"/>';
    for (var i = 1; i <= 5; i++) {
      var t = i / 6;
      out += '<circle cx="' + n(len * t) + '" cy="' + n(-len * 0.18 * 4 * t * (1 - t) * 0.5 - (rand() * 6 - 3)) +
        '" r="' + n(len * 0.022 + rand() * len * 0.012) + '" fill="' + p.goldLight + '"/>';
    }
    return out + '</g>';
  }

  function pearl(x, y, r, id) {
    return '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r) + '" fill="url(#' + id + 'pearl)"/>';
  }

  // A string of pearls along a quadratic curve.
  function pearlStrand(x0, y0, cx, cy, x1, y1, r, id, gap) {
    var len = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
    var count = Math.max(2, Math.round(len / (r * (gap || 2.3))));
    var out = '';
    for (var i = 0; i <= count; i++) {
      var t = i / count, u = 1 - t;
      out += pearl(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1, r, id);
    }
    return out;
  }

  // A rose cluster centred on (x, y), fanning toward `dir` degrees.
  function cluster(x, y, s, dir, p, id, seed) {
    var rand = rng(seed);
    var out = '';
    for (var i = 0; i < 9; i++) {
      var a = dir - 95 + i * 23 + rand() * 12;
      out += leaf(x, y, s * (0.95 + rand() * 0.55), a, id, p);
    }
    for (var j = 0; j < 4; j++) {
      out += sprig(x, y, s * (1.1 + rand() * 0.4), dir - 70 + j * 45 + rand() * 10, p, rand);
    }
    var spots = [
      [0, 0, 0.5, false], [0.55, -0.15, 0.34, true], [-0.2, 0.52, 0.32, false],
      [0.4, 0.48, 0.24, false], [-0.5, -0.2, 0.22, true]
    ];
    var rad = (dir * Math.PI) / 180;
    var cos = Math.cos(rad), sin = Math.sin(rad);
    spots.forEach(function (sp, k) {
      var dx = sp[0] * s, dy = sp[1] * s;
      var px = x + dx * cos - dy * sin, py = y + dx * sin + dy * cos;
      if (k === 4 || k === 3) out += blossom(px, py, s * 0.12, p, k === 4 ? p.paper : p.roseLight);
      out += rose(px, py, s * sp[2], rand() * 360, p, id, sp[3]);
    });
    for (var b = 0; b < 6; b++) {
      var ba = rad + (rand() - 0.5) * 2.4;
      var bd = s * (0.75 + rand() * 0.45);
      out += blossom(x + Math.cos(ba) * bd, y + Math.sin(ba) * bd, s * (0.06 + rand() * 0.05), p,
        b % 2 ? p.roseLight : p.paper);
    }
    for (var q = 0; q < 7; q++) {
      var qa = rad + (rand() - 0.5) * 2.2;
      var qd = s * (0.35 + rand() * 0.6);
      out += pearl(x + Math.cos(qa) * qd, y + Math.sin(qa) * qd, s * (0.025 + rand() * 0.025), id);
    }
    return out;
  }

  function svg(w, h, body, extra) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w +
      '" height="' + h + '"' + (extra || '') + '>' + body + '</svg>';
  }

  var cache = {};
  function memo(name, colors, fn) {
    var p = palette(colors);
    var k = name + key(p);
    if (!cache[k]) cache[k] = fn(p);
    return cache[k];
  }

  function background(colors) {
    return memo('bg', colors, function (p) {
      var id = 'b';
      var rand = rng(7);
      var body = defs(p, id) +
        '<linearGradient id="bgg" x1="0" y1="0" x2="0.3" y2="1">' +
        '<stop offset="0" stop-color="' + mix(p.background, '#ffffff', 0.35) + '"/>' +
        '<stop offset="0.5" stop-color="' + p.background + '"/>' +
        '<stop offset="1" stop-color="' + mix(p.background, p.rose, 0.45) + '"/></linearGradient>' +
        '<rect width="1080" height="1920" fill="url(#bgg)"/>';
      for (var i = 0; i < 26; i++) {
        body += '<circle cx="' + n(rand() * 1080) + '" cy="' + n(rand() * 1920) + '" r="' + n(20 + rand() * 90) +
          '" fill="' + (i % 3 ? p.paper : p.roseLight) + '" opacity="' + n(0.08 + rand() * 0.16) + '"/>';
      }
      body += cluster(70, 90, 300, 35, p, id, 11) + cluster(1040, 260, 220, 150, p, id, 12) +
        cluster(30, 1700, 230, -40, p, id, 13) + cluster(1010, 1830, 320, -140, p, id, 14) +
        cluster(-20, 930, 150, 0, p, id, 15) + cluster(1100, 1080, 160, 180, p, id, 16);
      for (var k = 0; k < 22; k++) {
        var px = rand() * 1080, py = rand() * 1920, pr = 10 + rand() * 14;
        body += '<path d="' + petalPath(pr) + '" transform="translate(' + n(px) + ' ' + n(py) + ') rotate(' +
          n(rand() * 360) + ')" fill="' + (k % 2 ? p.rose : p.roseLight) + '" opacity="0.55"/>';
      }
      return svg(1080, 1920, body, ' preserveAspectRatio="xMidYMid slice"');
    });
  }

  function corner(colors) {
    return memo('corner', colors, function (p) {
      var id = 'c';
      var body = defs(p, id);
      var rand = rng(21);
      for (var i = 0; i < 4; i++) body += leaf(30, 30, 150 + rand() * 60, 5 + i * 3, id, p);
      for (var j = 0; j < 4; j++) body += leaf(30, 30, 150 + rand() * 60, 72 + j * 4, id, p);
      body += sprig(40, 40, 230, 12, p, rand) + sprig(40, 40, 230, 72, p, rand);
      body += cluster(70, 70, 120, 45, p, id, 22);
      return svg(400, 400, body);
    });
  }

  function divider(colors) {
    return memo('divider', colors, function (p) {
      var g = p.accent;
      var body = '<g fill="none" stroke="' + g + '" stroke-width="2" stroke-linecap="round">' +
        '<path d="M20 30H235M365 30H580"/>' +
        '<path d="M235 30c18-22 40-22 50-8M365 30c-18-22-40-22-50-8M235 30c18 22 40 22 50 8M365 30c-18 22-40 22-50 8"/>' +
        '</g>' +
        '<path d="M300 12L314 30L300 48L286 30Z" fill="' + g + '"/>' +
        '<circle cx="300" cy="30" r="4" fill="' + p.paper + '"/>' +
        '<circle cx="20" cy="30" r="3.5" fill="' + g + '"/><circle cx="580" cy="30" r="3.5" fill="' + g + '"/>' +
        '<circle cx="262" cy="30" r="2.5" fill="' + g + '"/><circle cx="338" cy="30" r="2.5" fill="' + g + '"/>';
      return svg(600, 60, body);
    });
  }

  function medallion(colors) {
    return memo('medallion', colors, function (p) {
      var id = 'm';
      var g = 'url(#' + id + 'gold)';
      var body = defs(p, id) +
        '<circle cx="200" cy="200" r="182" fill="none" stroke="' + g + '" stroke-width="5"/>' +
        '<circle cx="200" cy="200" r="168" fill="none" stroke="' + g + '" stroke-width="1.5"/>' +
        '<circle cx="200" cy="200" r="158" fill="none" stroke="' + p.accent +
        '" stroke-width="2.5" stroke-dasharray="1 9" stroke-linecap="round"/>';
      for (var i = 0; i < 16; i++) {
        var a = (360 / 16) * i;
        body += '<path d="' + petalPath(16) + '" transform="rotate(' + a + ' 200 200) translate(200 22)" fill="' +
          p.accent + '" opacity="' + (i % 2 ? 0.55 : 0.9) + '"/>';
      }
      [0, 90, 180, 270].forEach(function (a) {
        body += '<g transform="rotate(' + a + ' 200 200)">' + rose(200, 18, 15, 0, p, id, true) + '</g>';
      });
      return svg(400, 400, body);
    });
  }

  // Tonal damask tile used as the cover texture.
  function damask(colors) {
    return memo('damask', colors, function (p) {
      var c = mix(p.primary, p.paper, 0.18);
      var body = '<g fill="none" stroke="' + c + '" stroke-width="2" opacity="0.55">' +
        '<path d="M60 10c22 22 22 48 0 70c-22-22-22-48 0-70z"/>' +
        '<path d="M60 80c-30 6-44 24-44 40M60 80c30 6 44 24 44 40"/>' +
        '<path d="M0 0c16 18 16 42 0 60M120 0c-16 18-16 42 0 60"/></g>' +
        '<circle cx="60" cy="45" r="5" fill="' + c + '" opacity="0.55"/>';
      return svg(120, 120, body);
    });
  }

  function thumbnail(colors, variant) {
    return memo('thumb' + (variant || ''), colors, function (p) {
      var id = 't';
      var body = defs(p, id) + '<rect width="600" height="800" fill="' + p.background + '"/>' +
        cluster(40, 60, 170, 35, p, id, 31) + cluster(570, 760, 180, -140, p, id, 32) +
        cluster(560, 120, 110, 150, p, id, 33) + cluster(40, 720, 110, -40, p, id, 34);
      if (variant === 'envelope') {
        body += '<rect x="110" y="300" width="380" height="250" rx="10" fill="' + mix(p.paper, p.rose, 0.2) + '" stroke="' + p.accent +
          '" stroke-width="3"/><path d="M110 300L300 440L490 300" fill="' + mix(p.paper, p.rose, 0.35) + '" stroke="' + p.accent +
          '" stroke-width="3"/><circle cx="300" cy="440" r="38" fill="' + p.primary + '"/><circle cx="300" cy="440" r="28" fill="none" stroke="' +
          mix(p.primary, '#ffffff', 0.3) + '" stroke-width="3"/>';
      } else if (variant === 'scroll') {
        body += '<rect x="150" y="150" width="300" height="500" rx="150" fill="' + p.paper + '" stroke="' +
          p.accent + '" stroke-width="4"/>' +
          '<rect x="200" y="330" width="200" height="10" rx="5" fill="' + p.rose + '"/>' +
          '<rect x="230" y="360" width="140" height="8" rx="4" fill="' + p.accent + '" opacity="0.6"/>' +
          '<rect x="210" y="420" width="180" height="70" rx="10" fill="' + mix(p.paper, p.rose, 0.2) + '"/>';
      } else {
        body += '<rect x="160" y="150" width="290" height="470" rx="10" fill="' + mix(p.primary, '#000000', 0.05) +
          '"/><rect x="150" y="140" width="290" height="470" rx="10" fill="' + mix(p.primary, p.rose, 0.48) + '"/>' +
          '<rect x="168" y="158" width="254" height="434" rx="6" fill="none" stroke="' + p.accent +
          '" stroke-width="4"/><rect x="178" y="168" width="234" height="414" rx="4" fill="none" stroke="' +
          p.accent + '" stroke-width="1.5"/>' +
          '<circle cx="295" cy="320" r="70" fill="none" stroke="' + p.accent + '" stroke-width="5"/>' +
          '<circle cx="295" cy="320" r="58" fill="none" stroke="' + p.accent + '" stroke-width="1.5"/>' +
          '<rect x="215" y="430" width="160" height="10" rx="5" fill="' + p.goldLight + '"/>' +
          '<rect x="245" y="458" width="100" height="7" rx="3" fill="' + p.goldLight + '" opacity="0.7"/>' +
          cluster(165, 160, 60, 45, p, id, 35) + cluster(430, 595, 60, -135, p, id, 36);
      }
      return svg(600, 800, body);
    });
  }

  // One curtain panel (left side); the right panel is mirrored with CSS.
  function curtain(colors) {
    return memo('curtain', colors, function (p) {
      var id = 'k';
      var W = 540, H = 1920;
      var light = mix(p.rose, '#ffffff', 0.35), dark = mix(p.rose, p.primary, 0.45);
      var body = defs(p, id) +
        '<linearGradient id="kfold" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="' + dark + '"/><stop offset="0.35" stop-color="' + light + '"/>' +
        '<stop offset="0.6" stop-color="' + mix(p.rose, '#ffffff', 0.15) + '"/><stop offset="1" stop-color="' + dark + '"/></linearGradient>' +
        '<pattern id="klace" width="18" height="18" patternUnits="userSpaceOnUse">' +
        '<circle cx="9" cy="9" r="1.6" fill="#ffffff" opacity="0.35"/><circle cx="0" cy="0" r="1" fill="#ffffff" opacity="0.25"/></pattern>' +
        '<linearGradient id="kswag" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + light + '"/><stop offset="0.7" stop-color="' + mix(p.rose, p.primary, 0.2) + '"/>' +
        '<stop offset="1" stop-color="' + dark + '"/></linearGradient>' +
        '<rect width="' + W + '" height="' + H + '" fill="' + p.rose + '"/>';
      // vertical folds
      var x = 0, rand = rng(41);
      while (x < W) {
        var w = 46 + rand() * 30;
        body += '<rect x="' + n(x) + '" y="0" width="' + n(w + 2) + '" height="' + H + '" fill="url(#kfold)"/>';
        x += w;
      }
      body += '<rect width="' + W + '" height="' + H + '" fill="url(#klace)"/>';
      // swags across the top
      for (var row = 0; row < 4; row++) {
        var y = 40 + row * 110, depth = 170 + row * 30;
        for (var sx = -135; sx < W; sx += 270) {
          body += '<path d="M' + sx + ' ' + y + 'Q' + (sx + 135) + ' ' + (y + depth * 2) + ' ' + (sx + 270) + ' ' + y +
            'L' + (sx + 270) + ' ' + (y + 40) + 'Q' + (sx + 135) + ' ' + (y + depth * 2 + 50) + ' ' + sx + ' ' + (y + 40) +
            'Z" fill="url(#kswag)" stroke="' + dark + '" stroke-opacity="0.35" stroke-width="2" opacity="' + (0.95 - row * 0.12) + '"/>' +
            pearlStrand(sx, y + 18, sx + 135, y + depth * 2 + 34, sx + 270, y + 18, 9 - row, id, 2.1);
        }
      }
      // hanging pearl strands near the opening edge
      [W - 110, W - 40].forEach(function (px, k) {
        var py = 30;
        while (py < H * 0.62 - k * 40) {
          var r = py % 300 < 40 ? 22 : 11;
          body += pearl(px, py, r, id);
          py += r * 2.1;
        }
      });
      return svg(W, H, body, ' preserveAspectRatio="xMaxYMid slice"');
    });
  }

  // Baroque oval frame for the book cover.
  function ovalFrame(colors) {
    return memo('oval', colors, function (p) {
      var id = 'o';
      var g = 'url(#' + id + 'gold)';
      var body = defs(p, id) +
        '<ellipse cx="200" cy="260" rx="128" ry="168" fill="' + mix(p.paper, p.rose, 0.12) + '"/>' +
        '<ellipse cx="200" cy="260" rx="134" ry="174" fill="none" stroke="' + g + '" stroke-width="12"/>' +
        '<ellipse cx="200" cy="260" rx="122" ry="162" fill="none" stroke="' + p.goldLight + '" stroke-width="2"/>' +
        '<ellipse cx="200" cy="260" rx="146" ry="186" fill="none" stroke="' + g + '" stroke-width="2.5"/>';
      for (var i = 0; i < 36; i++) {
        var a = (Math.PI * 2 * i) / 36;
        body += pearl(200 + Math.cos(a) * 141, 260 + Math.sin(a) * 181, 4, id);
      }
      // scrolls on four sides
      var scroll = function (x, y, rot, sc) {
        return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + sc + ')" fill="none" stroke="' + g +
          '" stroke-width="7" stroke-linecap="round"><path d="M0 0c-30-6-48 16-36 34c10 14 30 6 26-8"/>' +
          '<path d="M0 0c30-6 48 16 36 34c-10 14-30 6-26-8"/></g>';
      };
      body += scroll(200, 70, 180, 1.2) + scroll(200, 452, 0, 1.2) + scroll(52, 260, 90, 1) + scroll(348, 260, -90, 1);
      // crest and drop
      body += '<path d="M200 6c-14 18-14 34 0 46c14-12 14-28 0-46z" fill="' + g + '"/>' +
        '<path d="M200 470c-12 14-12 28 0 40c12-12 12-26 0-40z" fill="' + g + '"/>';
      [[200, 82], [200, 440], [64, 260], [336, 260]].forEach(function (pt) {
        body += rose(pt[0], pt[1], 17, 20, p, id, true) + pearl(pt[0] - 22, pt[1], 4, id) + pearl(pt[0] + 22, pt[1], 4, id);
      });
      return svg(400, 520, body);
    });
  }

  // Ornate page border with notched corners (600 x 900, the page ratio).
  function pageFrame(colors) {
    return memo('pageFrame', colors, function (p) {
      var id = 'pf';
      var g = 'url(#' + id + 'gold)';
      function notched(i, r) {
        var x0 = i, y0 = i, x1 = 600 - i, y1 = 900 - i;
        return 'M' + (x0 + r) + ' ' + y0 + 'H' + (x1 - r) + 'A' + r + ' ' + r + ' 0 0 0 ' + x1 + ' ' + (y0 + r) +
          'V' + (y1 - r) + 'A' + r + ' ' + r + ' 0 0 0 ' + (x1 - r) + ' ' + y1 + 'H' + (x0 + r) +
          'A' + r + ' ' + r + ' 0 0 0 ' + x0 + ' ' + (y1 - r) + 'V' + (y0 + r) + 'A' + r + ' ' + r + ' 0 0 0 ' + (x0 + r) + ' ' + y0 + 'Z';
      }
      var body = defs(p, id) +
        '<path d="' + notched(30, 46) + '" fill="none" stroke="' + g + '" stroke-width="5"/>' +
        '<path d="' + notched(42, 40) + '" fill="none" stroke="' + p.accent + '" stroke-width="1.5" opacity="0.8"/>';
      function star(x, y, r) {
        return '<path d="M' + x + ' ' + (y - r) + 'L' + (x + r * 0.28) + ' ' + (y - r * 0.28) + 'L' + (x + r) + ' ' + y + 'L' +
          (x + r * 0.28) + ' ' + (y + r * 0.28) + 'L' + x + ' ' + (y + r) + 'L' + (x - r * 0.28) + ' ' + (y + r * 0.28) + 'L' +
          (x - r) + ' ' + y + 'L' + (x - r * 0.28) + ' ' + (y - r * 0.28) + 'Z" fill="' + g + '"/>';
      }
      [[300, 30], [300, 870], [30, 450], [570, 450]].forEach(function (pt) {
        body += star(pt[0], pt[1], 16) + pearl(pt[0], pt[1], 4.5, id);
      });
      [[30, 30], [570, 30], [30, 870], [570, 870]].forEach(function (pt) {
        body += star(pt[0], pt[1], 11);
      });
      return svg(600, 900, body, ' preserveAspectRatio="none"');
    });
  }

  // Satin ribbon bow with long tails.
  function ribbon(colors) {
    return memo('ribbon', colors, function (p) {
      var c1 = mix(p.rose, '#ffffff', 0.25), c2 = mix(p.rose, p.primary, 0.4);
      var body = '<defs><linearGradient id="rb" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="' + c1 + '"/><stop offset="0.5" stop-color="' + p.rose + '"/>' +
        '<stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
        '<g fill="url(#rb)" stroke="' + c2 + '" stroke-opacity="0.5" stroke-width="1.5">' +
        '<path d="M100 90C60 40 10 40 12 80c2 40 50 40 88 12z"/>' +
        '<path d="M100 90c40-50 92-50 90-10c-2 40-52 40-90 12z"/>' +
        '<path d="M92 98c-30 60-40 140-20 210c10 40 0 80-20 110l22-4c24-40 30-80 20-120c-14-60-4-130 14-190z"/>' +
        '<path d="M108 98c6 70 30 130 24 200c-4 40 10 70 24 96l-22 4c-14-30-24-60-20-100c6-70-14-130-20-196z"/>' +
        '<ellipse cx="100" cy="92" rx="16" ry="14"/></g>';
      return svg(200, 440, body);
    });
  }

  // Faint watercolour florals for the page paper.
  function paperFloral(colors) {
    return memo('paperFloral', colors, function (p) {
      var c = mix(p.rose, p.paper, 0.45);
      var body = '<g fill="none" stroke="' + c + '" stroke-width="1.4" opacity="0.5">' +
        '<path d="M40 180c20-40 20-80 60-120M60 140c-14-6-22-18-20-30M80 100c12-10 26-12 36-6"/>' +
        '<path d="M150 60c10 30 30 50 40 90"/></g>' +
        '<g fill="' + c + '" opacity="0.35"><circle cx="100" cy="60" r="6"/><circle cx="40" cy="110" r="4"/>' +
        '<circle cx="118" cy="94" r="4"/><circle cx="190" cy="150" r="5"/></g>';
      return svg(200, 200, body);
    });
  }

  function favicon(colors) {
    return memo('favicon', colors, function (p) {
      return svg(64, 64, defs(p, 'f') + rose(32, 34, 28, 10, p, 'f', false));
    });
  }

  function dataUri(svgText) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  }

  var api = {
    palette: palette,
    mix: mix,
    background: background,
    corner: corner,
    divider: divider,
    medallion: medallion,
    damask: damask,
    thumbnail: thumbnail,
    favicon: favicon,
    curtain: curtain,
    ovalFrame: ovalFrame,
    pageFrame: pageFrame,
    ribbon: ribbon,
    paperFloral: paperFloral,
    dataUri: dataUri
  };

  root.InviteArt = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
