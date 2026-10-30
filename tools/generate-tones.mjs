// Generates the built-in background tones: short, loopable, original
// Arabic-style instrumentals in classical maqam scales, synthesised from
// scratch (no samples), so they are free to bundle and redistribute.
//
// Usage: node tools/generate-tones.mjs   (needs ffmpeg with libmp3lame)
// Output: audio/library/<id>.mp3

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUSIC_LIBRARY } from '../src/music-library.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'audio', 'library');
const SR = 32000;

// ---------------------------------------------------------------- helpers

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Maqam scales as semitone offsets of degrees 0..6 (quarter tones as .5).
const MAQAM = {
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  nahawand: [0, 2, 3, 5, 7, 8, 11],
  rast: [0, 2, 3.5, 5, 7, 9, 10.5],
  bayati: [0, 1.5, 3, 5, 7, 8, 10],
  kurd: [0, 1, 3, 5, 7, 8, 10]
};

function degreeFreq(tonic, scale, degree) {
  const oct = Math.floor(degree / 7);
  const idx = ((degree % 7) + 7) % 7;
  return tonic * 2 ** ((scale[idx] + 12 * oct) / 12);
}

// RBJ biquad filter, applied in place.
function biquad(buf, type, freq, q = 0.707) {
  const w = (2 * Math.PI * freq) / SR;
  const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lowpass') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'highpass') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha]; // bandpass
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

function noise(len, rand) {
  const b = new Float32Array(len);
  for (let i = 0; i < len; i++) b[i] = rand() * 2 - 1;
  return b;
}

function mixInto(dst, src, at, gain = 1) {
  const start = Math.round(at * SR);
  for (let i = 0; i < src.length && start + i < dst.length; i++) if (start + i >= 0) dst[start + i] += src[i] * gain;
}

// ---------------------------------------------------------------- instruments

// Plucked string by additive synthesis: exact pitch (quarter tones stay in
// tune), higher partials decay faster. Oud is warm, qanun bright.
function pluck(freq, dur, kind, rand) {
  const oud = kind === 'oud';
  const len = Math.round((dur + (oud ? 1.2 : 1.8)) * SR);
  const out = new Float32Array(len);
  const partials = oud ? 10 : 14;
  const tau = oud ? 0.9 : 1.6;
  const strings = oud ? [0] : [-2.5, 0, 2.5]; // qanun courses are tuned in threes
  for (const cents of strings) {
    const f0 = freq * 2 ** (cents / 1200);
    for (let n = 1; n <= partials; n++) {
      const f = f0 * n * (1 + 0.0004 * n * n);
      if (f > SR / 2.2) break;
      const amp = (oud ? 1 / n ** 1.35 : 1 / n ** 1.05) * (n === 1 ? 1 : 0.9 + 0.2 * rand()) / strings.length;
      const decay = tau / (1 + (oud ? 0.55 : 0.35) * (n - 1));
      const phase = rand() * Math.PI * 2;
      const k = (2 * Math.PI * f) / SR;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        out[i] += amp * Math.exp(-t / decay) * Math.sin(k * i + phase);
      }
    }
  }
  // pick attack
  const click = biquad(noise(Math.round(0.012 * SR), rand), 'bandpass', oud ? 1800 : 3500, 1.2);
  for (let i = 0; i < click.length; i++) out[i] += click[i] * 0.35 * (1 - i / click.length);
  // damp at note end (player mutes the string)
  const end = Math.round(dur * SR);
  for (let i = end; i < len; i++) out[i] *= Math.exp(-(i - end) / (SR * (oud ? 0.18 : 0.35)));
  if (oud) biquad(out, 'lowpass', 2600);
  return out;
}

// Ney: breathy reed flute rendered as one continuous line with glides,
// delayed vibrato and filtered breath noise.
function neyLine(notes, rand, totalLen) {
  const out = new Float32Array(totalLen);
  const breath = biquad(noise(totalLen, rand), 'bandpass', 1400, 0.6);
  let phase = 0;
  let prevF = notes.length ? notes[0].freq : 220;
  for (const note of notes) {
    const start = Math.round(note.at * SR);
    const len = Math.round(note.dur * SR);
    for (let i = 0; i < len && start + i < totalLen; i++) {
      const t = i / SR;
      const glide = Math.min(1, t / 0.06);
      const vibDepth = Math.min(1, Math.max(0, (t - 0.25) / 0.4)) * 0.0075;
      const f = (prevF + (note.freq - prevF) * glide) * (1 + vibDepth * Math.sin(2 * Math.PI * 5.3 * t));
      phase += (2 * Math.PI * f) / SR;
      const att = Math.min(1, t / 0.09);
      const rel = Math.min(1, (note.dur - t) / 0.12);
      const env = Math.max(0, Math.min(att, rel)) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.7 * t));
      const tone = Math.sin(phase) + 0.32 * Math.sin(2 * phase) + 0.14 * Math.sin(3 * phase) + 0.05 * Math.sin(4 * phase);
      out[start + i] += env * (tone * 0.75 + breath[start + i] * 0.55);
    }
    prevF = note.freq;
  }
  return biquad(out, 'lowpass', 4200);
}

function drone(freq, totalLen, rand) {
  const out = new Float32Array(totalLen);
  const parts = [[1, 1], [1.5, 0.5], [2, 0.35], [3, 0.12]];
  for (const [mult, amp] of parts) {
    const f = freq * mult;
    const ph = rand() * 6.28;
    for (let i = 0; i < totalLen; i++) {
      const t = i / SR;
      out[i] += amp * Math.sin((2 * Math.PI * f * i) / SR + ph) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 0.13 * t + ph));
    }
  }
  return biquad(out, 'lowpass', 900);
}

// Daf (frame drum): deep "dum" in the centre, sharp "tek" at the rim, and
// the jingle of its rings.
function dum(rand) {
  const len = Math.round(0.6 * SR);
  const out = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 58 + 70 * Math.exp(-t / 0.035);
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t / 0.22);
  }
  const thump = biquad(noise(Math.round(0.05 * SR), rand), 'lowpass', 900);
  for (let i = 0; i < thump.length; i++) out[i] += thump[i] * 0.6 * (1 - i / thump.length);
  return out;
}

function tek(rand, jingle = 0.5) {
  const len = Math.round(0.35 * SR);
  const out = new Float32Array(len);
  const slap = biquad(noise(len, rand), 'bandpass', 2600, 0.9);
  const rings = biquad(biquad(noise(len, rand), 'highpass', 5500), 'bandpass', 7800, 1.5);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    out[i] = slap[i] * Math.exp(-t / 0.025) * 1.4 + rings[i] * Math.exp(-t / 0.12) * jingle * (1 + 0.5 * Math.sin(2 * Math.PI * 38 * t));
  }
  return out;
}

function clap(rand) {
  const len = Math.round(0.25 * SR);
  const out = new Float32Array(len);
  const n = biquad(noise(len, rand), 'bandpass', 1500, 0.8);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const bursts = [0, 0.008, 0.017].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) / (o === 0.017 ? 0.06 : 0.006)) : 0), 0);
    out[i] = n[i] * bursts;
  }
  return out;
}

// Small Schroeder reverb for a sense of space.
function reverb(buf, mix = 0.22) {
  const combs = [1116, 1188, 1277, 1356].map((d) => Math.round((d * SR) / 44100));
  const wet = new Float32Array(buf.length);
  for (const d of combs) {
    const line = new Float32Array(d);
    let idx = 0, lp = 0;
    for (let i = 0; i < buf.length; i++) {
      const y = line[idx];
      lp = y * 0.7 + lp * 0.3;
      line[idx] = buf[i] + lp * 0.8;
      idx = (idx + 1) % d;
      wet[i] += y / combs.length;
    }
  }
  for (const d of [556, 441].map((x) => Math.round((x * SR) / 44100))) {
    const line = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < wet.length; i++) {
      const bo = line[idx];
      const y = -wet[i] + bo;
      line[idx] = wet[i] + bo * 0.5;
      idx = (idx + 1) % d;
      wet[i] = y;
    }
  }
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * (1 - mix) + wet[i] * mix;
  return buf;
}

// ---------------------------------------------------------------- composition

// A phrase is a list of [degree, beats]; degree null is a rest.
function place(phrases, bpm, startBeat = 0) {
  const beat = 60 / bpm;
  const notes = [];
  let b = startBeat;
  for (const phrase of phrases) {
    for (const [deg, beats] of phrase) {
      if (deg !== null) notes.push({ deg, at: b * beat, dur: beats * beat });
      b += beats;
    }
  }
  return { notes, endBeat: b };
}

function playPlucks(mix, notes, tonic, scale, kind, gain, rand, octave = 0) {
  for (const n of notes) {
    const f = degreeFreq(tonic, scale, n.deg) * 2 ** octave;
    mixInto(mix, pluck(f, n.dur, kind, rand), n.at, gain);
    // qanun players tremolo long notes
    if (kind === 'qanun' && n.dur > 0.9) {
      for (let t = 0.14; t < n.dur - 0.1; t += 0.14) mixInto(mix, pluck(f, 0.14, kind, rand), n.at + t, gain * 0.45);
    }
  }
}

function daf(mix, pattern, bpm, fromBeat, toBeat, rand, gain = 1) {
  const beat = 60 / bpm;
  const barBeats = pattern.beats;
  for (let bar = fromBeat; bar < toBeat; bar += barBeats) {
    for (const [pos, kind, vel = 1] of pattern.hits) {
      const at = (bar + pos) * beat;
      const v = vel * (0.9 + 0.2 * rand());
      if (kind === 'D') mixInto(mix, dum(rand), at, gain * v);
      else if (kind === 'T') mixInto(mix, tek(rand), at, gain * 0.6 * v);
      else if (kind === 'C') mixInto(mix, clap(rand), at, gain * 0.5 * v);
    }
  }
}

const MAQSUM = { beats: 4, hits: [[0, 'D'], [0.5, 'T', 0.7], [1.5, 'T', 0.8], [2, 'D'], [3, 'T', 0.8]] };
const SOFT = { beats: 4, hits: [[0, 'D', 0.7], [2, 'T', 0.5], [2.5, 'D', 0.5], [3, 'T', 0.4]] };

const COMPOSITIONS = {
  'hijaz-dawn': () => {
    const bpm = 72, tonic = 293.66, scale = MAQAM.hijaz, rand = rng(11);
    const mel = place([
      [[4, 1.5], [5, 0.5], [4, 1], [3, 1], [2, 1.5], [3, 0.5], [2, 1], [1, 1]],
      [[2, 1], [3, 1], [4, 2], [3, 0.5], [2, 0.5], [1, 1], [0, 2]],
      [[4, 1], [5, 1], [6, 1], [7, 1], [6, 0.5], [5, 0.5], [4, 1], [5, 2]],
      [[7, 1.5], [6, 0.5], [5, 1], [4, 1], [3, 0.5], [2, 0.5], [1, 0.5], [2, 0.5], [1, 1], [0, 1]],
      [[null, 2], [0, 0.5], [1, 0.5], [2, 1], [4, 2], [3, 1], [2, 1]],
      [[1, 1], [2, 0.5], [1, 0.5], [0, 6]]
    ], bpm, 2);
    const len = Math.round(((mel.endBeat + 2) * 60) / bpm * SR);
    const mix = new Float32Array(len);
    mixInto(mix, drone(tonic / 2, len, rand), 0, 0.09);
    const ney = neyLine(mel.notes.map((n) => ({ at: n.at, dur: n.dur, freq: degreeFreq(tonic, scale, n.deg) })), rand, len);
    mixInto(mix, ney, 0, 0.33);
    // qanun arpeggios underneath
    const arp = [];
    for (let b = 0; b < mel.endBeat; b += 1) arp.push({ deg: [0, 4, 7, 4][b % 4] - 7, at: (b * 60) / bpm, dur: 0.8 });
    playPlucks(mix, arp, tonic, scale, 'qanun', 0.13, rand);
    return mix;
  },
  'nahawand-evening': () => {
    const bpm = 84, tonic = 261.63, scale = MAQAM.nahawand, rand = rng(22);
    const A = [
      [[0, 0.5], [1, 0.5], [2, 1], [3, 1], [4, 1], [5, 1], [4, 0.5], [3, 0.5], [4, 2]],
      [[4, 0.5], [5, 0.5], [4, 0.5], [3, 0.5], [2, 1], [3, 1], [2, 0.5], [1, 0.5], [0, 1], [1, 2]],
      [[4, 1], [7, 1], [6, 0.5], [5, 0.5], [6, 1], [5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5], [3, 2]],
      [[2, 0.5], [3, 0.5], [4, 1], [3, 0.5], [2, 0.5], [1, 1], [0, 4]]
    ];
    const first = place(A, bpm, 0);
    const second = place(A, bpm, first.endBeat);
    const len = Math.round(((second.endBeat + 3) * 60) / bpm * SR);
    const mix = new Float32Array(len);
    mixInto(mix, drone(tonic / 2, len, rand), 0, 0.07);
    playPlucks(mix, first.notes, tonic / 2, scale, 'oud', 0.5, rand);
    playPlucks(mix, second.notes, tonic, scale, 'qanun', 0.3, rand);
    playPlucks(mix, second.notes, tonic / 2, scale, 'oud', 0.28, rand);
    daf(mix, SOFT, bpm, 0, second.endBeat, rand, 0.32);
    return mix;
  },
  'rast-celebration': () => {
    const bpm = 100, tonic = 261.63, scale = MAQAM.rast, rand = rng(33);
    const A = [
      [[0, 0.5], [1, 0.5], [2, 0.5], [3, 0.5], [4, 1], [4, 1], [5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5], [3, 2]],
      [[2, 0.5], [3, 0.5], [4, 0.5], [5, 0.5], [4, 1], [2, 1], [1, 0.5], [2, 0.5], [1, 0.5], [0, 0.5], [1, 2]],
      [[4, 0.5], [5, 0.5], [6, 0.5], [7, 0.5], [7, 1], [6, 1], [5, 0.5], [6, 0.5], [5, 0.5], [4, 0.5], [5, 2]],
      [[4, 0.5], [3, 0.5], [2, 0.5], [3, 0.5], [4, 1], [2, 1], [1, 0.5], [2, 0.5], [1, 0.5], [1, 0.5], [0, 2]]
    ];
    const intro = 4;
    const first = place(A, bpm, intro);
    const second = place(A, bpm, first.endBeat);
    const len = Math.round(((second.endBeat + 3) * 60) / bpm * SR);
    const mix = new Float32Array(len);
    playPlucks(mix, first.notes, tonic, scale, 'qanun', 0.4, rand);
    playPlucks(mix, second.notes, tonic, scale, 'qanun', 0.3, rand);
    playPlucks(mix, second.notes, tonic / 2, scale, 'oud', 0.4, rand);
    daf(mix, MAQSUM, bpm, 0, second.endBeat, rand, 0.42);
    daf(mix, { beats: 2, hits: [[1, 'C', 0.6]] }, bpm, first.endBeat, second.endBeat, rand, 0.5);
    mixInto(mix, dum(rand), (second.endBeat * 60) / bpm, 0.6);
    return mix;
  },
  'bayati-serenity': () => {
    const bpm = 60, tonic = 293.66, scale = MAQAM.bayati, rand = rng(44);
    const mel = place([
      [[0, 2], [1, 1], [2, 1], [3, 3], [2, 0.5], [1, 0.5]],
      [[2, 1], [1, 0.5], [0, 0.5], [1, 2], [0, 4]],
      [[3, 1], [4, 1], [5, 2], [4, 1], [3, 0.5], [4, 0.5], [3, 2]],
      [[2, 1], [3, 0.5], [2, 0.5], [1, 1], [2, 1], [1, 1], [0, 3]]
    ], bpm, 2);
    const len = Math.round(((mel.endBeat + 3) * 60) / bpm * SR);
    const mix = new Float32Array(len);
    mixInto(mix, drone(tonic / 2, len, rand), 0, 0.13);
    mixInto(mix, neyLine(mel.notes.map((n) => ({ at: n.at, dur: n.dur, freq: degreeFreq(tonic, scale, n.deg) })), rand, len), 0, 0.36);
    // a few soft oud notes marking each phrase
    playPlucks(mix, [0, 8, 16, 24].map((b) => ({ deg: -7, at: ((b + 2) * 60) / bpm, dur: 1.5 })), tonic, scale, 'oud', 0.22, rand);
    return mix;
  },
  'kurd-blessing': () => {
    const bpm = 76, tonic = 293.66, scale = MAQAM.kurd, rand = rng(55);
    const P = [
      [[4, 1], [3, 0.5], [2, 0.5], [1, 1], [2, 1], [3, 1.5], [2, 0.5], [1, 2]],
      [[1, 0.5], [2, 0.5], [3, 1], [4, 1], [5, 1], [4, 0.5], [3, 0.5], [2, 1], [1, 1], [0, 1]],
      [[4, 1], [5, 0.5], [6, 0.5], [7, 2], [6, 0.5], [5, 0.5], [4, 1], [5, 2]],
      [[4, 0.5], [3, 0.5], [2, 1], [3, 0.5], [2, 0.5], [1, 1], [0, 4]]
    ];
    const first = place(P, bpm, 0);
    const second = place([P[0], P[3]], bpm, first.endBeat);
    const len = Math.round(((second.endBeat + 3) * 60) / bpm * SR);
    const mix = new Float32Array(len);
    mixInto(mix, drone(tonic / 2, len, rand), 0, 0.06);
    playPlucks(mix, first.notes, tonic / 2, scale, 'oud', 0.48, rand);
    playPlucks(mix, second.notes, tonic, scale, 'qanun', 0.32, rand);
    // qanun answers the oud an octave up at phrase ends
    playPlucks(mix, first.notes.filter((n) => n.dur >= 2), tonic, scale, 'qanun', 0.18, rand);
    return mix;
  },
  'daf-zaffa': () => {
    const bpm = 96, rand = rng(66);
    const main = { beats: 4, hits: [[0, 'D'], [1, 'T', 0.7], [1.5, 'T', 0.6], [2, 'D', 0.9], [3, 'T', 0.8], [3.5, 'T', 0.5]] };
    const fill = { beats: 4, hits: [[0, 'D'], [0.5, 'T', 0.5], [1, 'T', 0.7], [1.5, 'D', 0.8], [2, 'D'], [2.5, 'T', 0.6], [2.75, 'T', 0.5], [3, 'T', 0.7], [3.25, 'T', 0.6], [3.5, 'T', 0.8], [3.75, 'T', 0.9]] };
    const claps = { beats: 4, hits: [[1, 'C'], [3, 'C']] };
    const beats = 64;
    const len = Math.round(((beats + 3) * 60) / bpm * SR);
    const mix = new Float32Array(len);
    daf(mix, { beats: 4, hits: [[0, 'D', 0.8], [2, 'D', 0.6]] }, bpm, 0, 8, rand, 0.8);
    for (let b = 8; b < beats; b += 16) {
      daf(mix, main, bpm, b, b + 12, rand, 0.8);
      daf(mix, fill, bpm, b + 12, b + 16, rand, 0.8);
    }
    daf(mix, claps, bpm, 24, beats, rand, 0.7);
    mixInto(mix, dum(rand), (beats * 60) / bpm, 0.9);
    return mix;
  }
};

// ---------------------------------------------------------------- output

function finish(mix) {
  reverb(mix, 0.2);
  let peak = 0;
  for (const v of mix) peak = Math.max(peak, Math.abs(v));
  const gain = 0.89 / (peak || 1);
  const fadeIn = 0.25 * SR, fadeOut = 2.2 * SR;
  for (let i = 0; i < mix.length; i++) {
    let g = gain;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > mix.length - fadeOut) g *= (mix.length - i) / fadeOut;
    mix[i] *= g;
  }
  return mix;
}

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return buf;
}

await mkdir(OUT, { recursive: true });
for (const track of MUSIC_LIBRARY) {
  const compose = COMPOSITIONS[track.id];
  if (!compose) throw new Error(`No composition for ${track.id}`);
  const samples = finish(compose());
  const tmp = path.join(OUT, `${track.id}.wav`);
  await writeFile(tmp, wav(samples));
  const mp3 = path.join(OUT, `${track.id}.mp3`);
  // Loudness-normalise so every tone plays at the same comfortable level.
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ac', '1', '-ar', String(SR), '-codec:a', 'libmp3lame', '-b:a', '64k',
    '-metadata', `title=${track.title}`, '-metadata', 'artist=Wedding Invitation Studio', '-metadata', 'comment=Original composition, free to use', mp3]);
  await rm(tmp);
  if (r.status !== 0) throw new Error(r.stderr.toString());
  console.log(`${track.id}: ${(samples.length / SR).toFixed(1)} s`);
}
