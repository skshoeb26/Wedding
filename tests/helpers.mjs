// Shared helpers for Node tests.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources } from '../src/export/sources.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

export const JSZip = require(path.join(ROOT, 'vendor/jszip/jszip.min.js'));
export const InviteArt = require(path.join(ROOT, 'templates/shared/art.js'));
export const InviteCore = require(path.join(ROOT, 'templates/shared/core.js'));

export function nodeSources() {
  return loadSources({
    readText: (p) => readFile(path.join(ROOT, p), 'utf8'),
    readBytes: async (p) => new Uint8Array(await readFile(path.join(ROOT, p)))
  });
}

// 1x1 PNG and a tiny silent WAV for upload tests.
export const PNG_1PX = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

export function silentWav(seconds = 1, rate = 8000) {
  const samples = seconds * rate;
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44);
  return new Uint8Array(buf);
}
