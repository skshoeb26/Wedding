// Generates the built-in daf rhythms: short, loopable, original frame-drum
// patterns with hand claps and no melodic instruments, synthesised from
// scratch (no samples), so they are free to bundle and redistribute.
// Vocal nasheeds in the library are separate recorded files, not generated here.
//
// Usage: node tools/generate-tones.mjs   (needs ffmpeg with libmp3lame)
// Output: audio/library/<id>.mp3 for every track with `generated: true`

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

// ---------------------------------------------------------------- daf

// Daf (frame drum): deep "dum" in the centre, sharp "tek" at the rim, and
// the jingle of its rings.
function dum(rand) {
  const len = Math.round(0.6 * SR);
  const out = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 88 + 80 * Math.exp(-t / 0.035);
    ph += (2 * Math.PI * f) / SR;
    out[i] = (Math.sin(ph) + 0.45 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph)) * Math.exp(-t / 0.18);
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

function daf(mix, pattern, bpm, fromBeat, toBeat, rand, gain = 1) {
  const beat = 60 / bpm;
  const barBeats = pattern.beats;
  for (let bar = fromBeat; bar < toBeat; bar += barBeats) {
    for (const [pos, kind, vel = 1] of pattern.hits) {
      const at = (bar + pos) * beat;
      const v = vel * (0.9 + 0.2 * rand());
      if (kind === 'D') mixInto(mix, dum(rand), at, gain * v);
      else if (kind === 'T') mixInto(mix, tek(rand, 0.8), at, gain * 0.9 * v);
      else if (kind === 'C') mixInto(mix, clap(rand), at, gain * 0.9 * v);
    }
  }
}

// ---------------------------------------------------------------- rhythms

const MAQSUM = { beats: 4, hits: [[0, 'D'], [0.5, 'T', 0.6], [1, 'T', 0.7], [1.5, 'T', 0.5], [2, 'D', 0.9], [2.5, 'T', 0.5], [3, 'T', 0.8], [3.5, 'T', 0.5]] };
const FILL = { beats: 4, hits: [[0, 'D'], [0.5, 'T', 0.5], [1, 'T', 0.7], [1.5, 'D', 0.8], [2, 'D'], [2.5, 'T', 0.6], [2.75, 'T', 0.5], [3, 'T', 0.7], [3.25, 'T', 0.6], [3.5, 'T', 0.8], [3.75, 'T', 0.9]] };
const SOFT = { beats: 4, hits: [[0, 'D', 0.8], [1.5, 'T', 0.45], [2, 'D', 0.6], [3, 'T', 0.5], [3.5, 'T', 0.35]] };
const SAIDI = { beats: 4, hits: [[0, 'D'], [0.5, 'T', 0.6], [1, 'D', 0.9], [2, 'T', 0.6], [2.5, 'D', 0.8], [3, 'D', 0.9], [3.5, 'T', 0.6]] };
const CLAPS = { beats: 4, hits: [[1, 'C'], [3, 'C']] };
const DOUBLE_CLAPS = { beats: 2, hits: [[0.5, 'C', 0.5], [1, 'C']] };

function track(bpm, beats, build) {
  const len = Math.round(((beats + 3) * 60) / bpm * SR);
  const mix = new Float32Array(len);
  build(mix);
  mixInto(mix, dum(rng(beats)), (beats * 60) / bpm, 0.9);
  return mix;
}

const COMPOSITIONS = {
  'daf-zaffa': () => {
    const bpm = 112, beats = 72, rand = rng(106);
    return track(bpm, beats, (mix) => {
      daf(mix, { beats: 4, hits: [[0, 'D', 0.8], [1, 'C', 0.8], [2, 'D', 0.7], [3, 'C', 0.8]] }, bpm, 0, 8, rand, 0.8);
      for (let b = 8; b < beats; b += 16) {
        daf(mix, MAQSUM, bpm, b, b + 12, rand, 0.8);
        daf(mix, FILL, bpm, b + 12, b + 16, rand, 0.8);
      }
      daf(mix, DOUBLE_CLAPS, bpm, 8, beats, rand, 0.65);
    });
  },
  'daf-gentle': () => {
    const bpm = 84, beats = 56, rand = rng(107);
    return track(bpm, beats, (mix) => {
      daf(mix, { beats: 4, hits: [[0, 'D', 0.6], [2, 'D', 0.45]] }, bpm, 0, 8, rand, 0.7);
      daf(mix, SOFT, bpm, 8, beats, rand, 0.7);
    });
  },
  'daf-festive': () => {
    const bpm = 124, beats = 80, rand = rng(108);
    return track(bpm, beats, (mix) => {
      daf(mix, { beats: 4, hits: [[0, 'D'], [0.5, 'T', 0.5], [1, 'T', 0.6], [1.5, 'T', 0.7], [2, 'T', 0.8], [2.5, 'T', 0.9], [3, 'T'], [3.5, 'T']] }, bpm, 0, 4, rand, 0.8);
      for (let b = 4; b < beats; b += 16) {
        daf(mix, SAIDI, bpm, b, b + 12, rand, 0.8);
        daf(mix, FILL, bpm, b + 12, b + 16, rand, 0.8);
      }
      daf(mix, CLAPS, bpm, 4, beats, rand, 0.75);
      daf(mix, DOUBLE_CLAPS, bpm, 36, beats, rand, 0.4);
    });
  }
};

// ---------------------------------------------------------------- output

function finish(mix) {
  biquad(biquad(mix, 'highpass', 70), 'highpass', 70); // no rumble phone speakers cannot play
  reverb(mix, 0.12);
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
for (const track of MUSIC_LIBRARY.filter((t) => t.generated)) {
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
