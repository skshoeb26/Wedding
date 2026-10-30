// Loads template sources, fonts and licences for the export engine.
// The loader is injectable so the same code runs in the browser (fetch) and
// in Node tests (fs).

import { SHARED_FILES, TEMPLATES, FONT_FILES, FONT_LICENSES } from '../templates.js';

export function sourceManifest() {
  const text = [...Object.values(SHARED_FILES), ...TEMPLATES.flatMap((t) => [t.runtime, t.css])];
  const fonts = Object.values(FONT_FILES).flat().map((f) => f.file);
  const licenses = Object.values(FONT_LICENSES);
  return { text, fonts, licenses };
}

export async function loadSources({ readText, readBytes }) {
  const m = sourceManifest();
  const files = {};
  const fonts = {};
  const licenses = {};
  await Promise.all([
    ...m.text.map(async (p) => { files[p] = await readText(p); }),
    ...m.fonts.map(async (f) => { fonts[f] = await readBytes(`vendor/fonts/${f}`); }),
    ...m.licenses.map(async (f) => { licenses[f] = await readText(`vendor/fonts/${f}`); })
  ]);
  return { files, fonts, licenses };
}

export function browserLoader(base = new URL('../../', import.meta.url)) {
  async function get(path) {
    const res = await fetch(new URL(path, base));
    if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
    return res;
  }
  return {
    readText: async (p) => (await get(p)).text(),
    readBytes: async (p) => new Uint8Array(await (await get(p)).arrayBuffer())
  };
}

let cached = null;
export function loadBrowserSources() {
  if (!cached) cached = loadSources(browserLoader()).catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}
