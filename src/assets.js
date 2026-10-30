// Upload handling: validation, content sniffing, image optimisation and
// project backup (configuration + embedded assets) import/export.

import { ASSET_SLOTS, normalizeConfig } from './schema.js';
import { TEMPLATE_IDS } from './templates.js';
import { base64ToBytes, bytesToBase64, uid, isPlainObject } from './util.js';

export const LIMITS = {
  imageBytes: 25 * 1024 * 1024,
  audioBytes: 25 * 1024 * 1024,
  audioWarnBytes: 8 * 1024 * 1024,
  optimizeAboveBytes: 1.2 * 1024 * 1024,
  maxImageEdge: 2200,
  projectBytes: 120 * 1024 * 1024
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/flac'];

function startsWith(bytes, sig, offset = 0) {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => b === null || bytes[offset + i] === b);
}

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

// Detect the real file type from its first bytes. Returns a MIME type or null.
export function sniffMime(bytes) {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('GIF8'))) return 'image/gif';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WAVE'), 8)) return 'audio/wav';
  if (startsWith(bytes, ascii('ftyp'), 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (/^avi[fs]/.test(brand)) return 'image/avif';
    if (/^(M4A |M4B |mp4|isom|iso[2-9]|dash|mp42|mp41)/.test(brand)) return 'audio/mp4';
    return null;
  }
  if (startsWith(bytes, ascii('ID3'))) return 'audio/mpeg';
  if (bytes.length > 1 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (startsWith(bytes, ascii('OggS'))) return 'audio/ogg';
  if (startsWith(bytes, ascii('fLaC'))) return 'audio/flac';
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'audio/webm';
  return null;
}

export function validateBytes(bytes, kind) {
  const mime = sniffMime(bytes);
  const allowed = kind === 'image' ? IMAGE_TYPES : AUDIO_TYPES;
  if (!mime || !allowed.includes(mime)) {
    return {
      ok: false,
      error:
        kind === 'image'
          ? 'Please choose a JPEG, PNG, WebP, GIF or AVIF image. (SVG and other formats are not accepted for security reasons.)'
          : 'Please choose an MP3, M4A/AAC, OGG, WAV, WebM or FLAC audio file.'
    };
  }
  const max = kind === 'image' ? LIMITS.imageBytes : LIMITS.audioBytes;
  if (bytes.length > max) return { ok: false, error: `This file is too large (limit ${max / 1048576} MB).` };
  return { ok: true, mime };
}

async function optimizeImage(bytes, mime) {
  if (mime === 'image/gif' || typeof createImageBitmap !== 'function') return null;
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  const scale = Math.min(1, LIMITS.maxImageEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && bytes.length <= LIMITS.optimizeAboveBytes) {
    bitmap.close?.();
    return null;
  }
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const outType = mime === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outType, 0.86));
  if (!blob) return null;
  const out = new Uint8Array(await blob.arrayBuffer());
  return out.length < bytes.length ? { bytes: out, mime: outType, width: w, height: h } : null;
}

/** Read an uploaded File into an in-memory asset. */
export async function readUpload(file, slot) {
  const def = ASSET_SLOTS[slot];
  if (!def) throw new Error('Unknown upload slot');
  const max = def.kind === 'image' ? LIMITS.imageBytes : LIMITS.audioBytes;
  if (file.size > max) throw new Error(`“${file.name}” is too large (limit ${max / 1048576} MB).`);
  let bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateBytes(bytes, def.kind);
  if (!check.ok) throw new Error(check.error);
  let mime = check.mime;
  const notes = [];
  if (def.kind === 'image') {
    try {
      const optimized = await optimizeImage(bytes, mime);
      if (optimized) {
        notes.push(`Optimised from ${(bytes.length / 1048576).toFixed(1)} MB to ${(optimized.bytes.length / 1048576).toFixed(1)} MB.`);
        bytes = optimized.bytes;
        mime = optimized.mime;
      }
    } catch {
      /* keep the original if the browser cannot decode it */
    }
  } else if (bytes.length > LIMITS.audioWarnBytes) {
    notes.push('Large audio files make the invitation slower to load on mobile data. A short, compressed MP3 is ideal.');
  }
  return {
    id: uid(slot),
    name: String(file.name || slot).slice(0, 200),
    mime,
    size: bytes.length,
    bytes,
    notes
  };
}

// ---- Project backup ------------------------------------------------------

export const PROJECT_FORMAT = 'wedding-invitation-studio/project';

export function createProjectFile(config, assets) {
  const embedded = {};
  for (const ref of Object.values(config.assets)) {
    if (!ref || ref.library) continue;
    const a = assets.get(ref.id);
    if (a) embedded[ref.id] = { name: a.name, mime: a.mime, size: a.size, data: bytesToBase64(a.bytes) };
  }
  return JSON.stringify({ format: PROJECT_FORMAT, version: 1, savedAt: new Date().toISOString(), config, assets: embedded });
}

/**
 * Parse a project backup or a bare configuration JSON.
 * Returns { config, assets: Map, warnings }.
 */
export function parseProjectFile(text) {
  if (typeof text !== 'string' || text.length > LIMITS.projectBytes) throw new Error('This file is too large to import.');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isPlainObject(data)) throw new Error('This file does not contain an invitation.');
  const isProject = data.format === PROJECT_FORMAT;
  const rawConfig = isProject ? data.config : data;
  if (!isPlainObject(rawConfig) || !isPlainObject(rawConfig.invitation)) {
    throw new Error('This file does not look like a Wedding Invitation Studio project or configuration.');
  }
  const config = normalizeConfig(rawConfig, TEMPLATE_IDS);
  const assets = new Map();
  const warnings = [];
  if (isProject && isPlainObject(data.assets)) {
    for (const [slot, ref] of Object.entries(config.assets)) {
      if (!ref) continue;
      const entry = data.assets[ref.id];
      if (!isPlainObject(entry) || typeof entry.data !== 'string') continue;
      let bytes;
      try {
        bytes = base64ToBytes(entry.data);
      } catch {
        warnings.push(`${ASSET_SLOTS[slot].label} could not be decoded and was skipped.`);
        continue;
      }
      const check = validateBytes(bytes, ASSET_SLOTS[slot].kind);
      if (!check.ok) {
        warnings.push(`${ASSET_SLOTS[slot].label} was skipped: ${check.error}`);
        continue;
      }
      assets.set(ref.id, { id: ref.id, name: ref.name, mime: check.mime, size: bytes.length, bytes });
      config.assets[slot] = { ...ref, mime: check.mime, size: bytes.length };
    }
  }
  for (const [slot, ref] of Object.entries(config.assets)) {
    if (ref && !ref.library && !assets.has(ref.id)) warnings.push(`${ASSET_SLOTS[slot].label} (“${ref.name}”) is not included in this file. Please upload it again.`);
  }
  return { config, assets, warnings };
}
