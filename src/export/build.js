// Export engine. Pure functions shared by the browser editor and Node tests.
//
// buildSite() turns a configuration, in-memory assets and the template
// sources into either a multi-file static website, a single self-contained
// HTML document, or the editor preview document.

import { ASSET_SLOTS, invitationTitle, stripAssetSources } from '../schema.js';
import { FONT_FILES, FONT_LICENSES, fontsForConfig, getTemplate } from '../templates.js';
import { bytesToDataUrl, escapeHtml, jsonForScript } from '../util.js';

export const SINGLE_FILE_WARN_BYTES = 8 * 1024 * 1024;
export const SINGLE_FILE_LIMIT_BYTES = 40 * 1024 * 1024;

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/webm': 'webm',
  'audio/flac': 'flac'
};

export function extensionFor(mime) {
  return MIME_EXT[mime] || null;
}

function fontFaceCss(families, urlFor) {
  return families
    .flatMap((family) =>
      FONT_FILES[family].map(
        (f) =>
          `@font-face{font-family:'${family}';font-style:${f.style};font-weight:${f.weight};font-display:swap;` +
          `src:url(${urlFor(f.file)}) format('woff2');${f.range ? `unicode-range:${f.range};` : ''}}`
      )
    )
    .join('\n');
}

function cspMeta(mode) {
  const policy =
    mode === 'zip'
      ? "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' data:; font-src 'self' data:; base-uri 'none'; form-action 'none'"
      : "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; base-uri 'none'; form-action 'none'";
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
}

// Script content inside <script> must never contain "</script".
function inlineScript(code) {
  return code.replace(/<\/(script)/gi, '<\\/$1');
}

function inlineStyle(css) {
  return css.replace(/<\/(style)/gi, '<\\/$1');
}

function noscriptFallback(config) {
  const inv = config.invitation;
  const names = `${inv.couple.partner1.name} ${inv.couple.joiner} ${inv.couple.partner2.name}`;
  const events = inv.events
    .filter((e) => e.enabled)
    .map(
      (e) =>
        `<li><strong>${escapeHtml(e.label)}</strong> — ${escapeHtml(e.date)} ${escapeHtml(e.time)}<br>` +
        `${escapeHtml(e.venueName)}${e.address ? ', ' + escapeHtml(e.address) : ''}</li>`
    )
    .join('');
  return (
    `<noscript><div style="max-width:640px;margin:40px auto;padding:24px;font-family:Georgia,serif;text-align:center">` +
    `<h1>${escapeHtml(names)}</h1><p>${escapeHtml(inv.familyIntro)}</p><ul style="list-style:none;padding:0">${events}</ul>` +
    `<p>Please enable JavaScript to view the animated invitation.</p></div></noscript>`
  );
}

function headTags(config, mode, extra) {
  const title = invitationTitle(config);
  const description =
    config.meta.description.trim() ||
    `You are warmly invited to the wedding of ${config.invitation.couple.partner1.name} and ${config.invitation.couple.partner2.name}.`;
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    mode === 'preview' ? '' : cspMeta(mode),
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    '<meta property="og:type" content="website">',
    `<meta name="theme-color" content="${escapeHtml(config.theme.colors.primary)}">`,
    '<meta name="generator" content="Wedding Invitation Studio">',
    extra
  ]
    .filter(Boolean)
    .join('\n');
}

function htmlOpen(config) {
  return `<!doctype html>\n<html lang="${escapeHtml(config.meta.lang)}" dir="${config.meta.dir === 'rtl' ? 'rtl' : 'ltr'}">`;
}

/**
 * Resolve asset references to concrete URLs for a build mode.
 * Returns { config, files, warnings }.
 */
function resolveAssets(config, assets, mode, art, sources) {
  const out = stripAssetSources(config);
  const files = [];
  const warnings = [];
  for (const [slot, def] of Object.entries(ASSET_SLOTS)) {
    const ref = out.assets[slot];
    if (!ref) continue;
    const libBytes = ref.library && sources?.library?.[ref.library];
    const asset = assets.get(ref.id) || (libBytes ? { bytes: libBytes, mime: 'audio/mpeg' } : null);
    if (!asset) {
      warnings.push(`${def.label} (“${ref.name}”) is not loaded in this session and was left out. Re-upload it to include it.`);
      out.assets[slot] = null;
      continue;
    }
    if (mode === 'zip') {
      const ext = extensionFor(asset.mime) || 'bin';
      const path = ref.library ? `assets/${def.folder}/${ref.library}.mp3` : `assets/${def.folder}/${def.file}.${ext}`;
      files.push({ path, data: asset.bytes });
      out.assets[slot] = { ...ref, src: path };
    } else {
      out.assets[slot] = { ...ref, src: bytesToDataUrl(asset.bytes, asset.mime) };
    }
  }
  if (mode === 'zip' && !out.assets.background && art) {
    // Ship the generated default artwork as a real, replaceable file.
    const path = 'assets/images/floral-background.svg';
    files.push({ path, data: art.background(out.theme.colors) });
    out.assets.background = { id: 'default-background', name: 'floral-background.svg', mime: 'image/svg+xml', size: 0, src: path };
  }
  return { config: out, files, warnings };
}

function appScript(sources, templateId) {
  const t = getTemplate(templateId);
  return [
    '/* Wedding invitation — generated by Wedding Invitation Studio. No external dependencies. */',
    sources.files[`templates/shared/art.js`],
    sources.files[`templates/shared/core.js`],
    sources.files[t.runtime],
    sources.files[`templates/shared/boot.js`]
  ].join('\n;\n');
}

function styleSheet(sources, templateId, fontCss) {
  const t = getTemplate(templateId);
  return [fontCss, sources.files['templates/shared/base.css'], sources.files[t.css]].join('\n\n');
}

function readme(config, files) {
  const inv = config.invitation;
  const names = `${inv.couple.partner1.name} ${inv.couple.joiner} ${inv.couple.partner2.name}`;
  const images = files.filter((f) => f.path.startsWith('assets/images/')).map((f) => `- \`${f.path}\``);
  const audio = files.filter((f) => f.path.startsWith('assets/audio/')).map((f) => `- \`${f.path}\``);
  return `# ${names} — Wedding Invitation

This folder is a complete static website. It has no build step, no backend and
does not contact the generator that created it. Open \`index.html\` in a
browser to check it locally.

## Contents

- \`index.html\` — the page and the invitation configuration (inside the
  \`<script type="application/json" id="invitation-config">\` block)
- \`assets/css/style.css\` — template styles and font definitions
- \`assets/js/app.js\` — the invitation runtime (no frameworks)
- \`assets/fonts/\` — bundled fonts (SIL Open Font License, see the LICENSE files)
${images.length ? `- Images:\n${images.join('\n')}\n` : ''}${audio.length ? `- Audio:\n${audio.join('\n')}\n` : ''}
## Host it for free

**Vercel**
1. Sign in at https://vercel.com and choose *Add New → Project*.
2. Drag this folder in (or push it to a Git repository and import it).
   Framework preset: *Other*. No build command, output directory: \`.\`
3. Or with the CLI: \`npx vercel deploy\` from inside this folder.

**Netlify** — open https://app.netlify.com/drop and drop this folder.

**Cloudflare Pages** — *Create project → Direct upload* and upload this folder.

**GitHub Pages** — push the folder to a repository, then *Settings → Pages →
Deploy from branch*.

All paths are relative, so the site also works from a sub-folder.

## Making small changes later

- Text, dates and colours live in the JSON block inside \`index.html\`.
  Edit it with any text editor and keep it valid JSON.
- To replace a picture, overwrite the file in \`assets/images/\` keeping the
  same name (or update the \`src\` path in the configuration).
- Browsers only allow music to start after a tap, so music begins when a
  guest opens the invitation or presses the music button.
- For larger changes, re-import your project backup into the generator and
  export again.
${config.assets.music?.library ? '\n## Music\n\nThe background tone is an original composition from Wedding Invitation Studio\nand is free to use and share with this invitation.\n' : ''}`;
}

/**
 * @param {object} opts
 * @param {object} opts.config  normalized invitation configuration
 * @param {Map<string,{bytes:Uint8Array,mime:string,name:string}>} opts.assets
 * @param {{files:Object<string,string>, fonts:Object<string,Uint8Array>, licenses:Object<string,string>}} opts.sources
 * @param {'zip'|'single'|'preview'} opts.mode
 * @param {object} [opts.art] InviteArt API (for generated artwork files)
 */
export function buildSite({ config, assets = new Map(), sources, mode, art }) {
  if (!['zip', 'single', 'preview'].includes(mode)) throw new Error(`Unknown build mode: ${mode}`);
  const templateId = config.template;

  if (mode === 'preview') {
    const families = Object.keys(FONT_FILES);
    const fontCss = fontFaceCss(families, (file) => bytesToDataUrl(sources.fonts[file], 'font/woff2'));
    const html = [
      htmlOpen(config),
      '<head>',
      headTags(config, mode),
      `<style>${inlineStyle(styleSheet(sources, templateId, fontCss))}</style>`,
      '</head>',
      '<body>',
      '<div id="invitation"></div>',
      '<script>window.__WIS_PREVIEW__ = true;</script>',
      `<script>${inlineScript(appScript(sources, templateId))}</script>`,
      '</body>',
      '</html>'
    ].join('\n');
    return { html, warnings: [] };
  }

  const { config: resolved, files: assetFiles, warnings } = resolveAssets(config, assets, mode, art, sources);
  const families = fontsForConfig(resolved);

  if (mode === 'single') {
    const fontCss = fontFaceCss(families, (file) => bytesToDataUrl(sources.fonts[file], 'font/woff2'));
    const favicon = art ? `<link rel="icon" href="${escapeHtml(art.dataUri(art.favicon(resolved.theme.colors)))}">` : '';
    const html = [
      htmlOpen(resolved),
      '<head>',
      headTags(resolved, mode, favicon),
      `<style>${inlineStyle(styleSheet(sources, templateId, fontCss))}</style>`,
      '</head>',
      '<body>',
      '<div id="invitation"></div>',
      noscriptFallback(resolved),
      `<script type="application/json" id="invitation-config">${jsonForScript(resolved)}</script>`,
      `<script>${inlineScript(appScript(sources, templateId))}</script>`,
      '</body>',
      '</html>'
    ].join('\n');
    const size = new TextEncoder().encode(html).length;
    if (size > SINGLE_FILE_WARN_BYTES) {
      warnings.push(
        `The single file is ${(size / 1048576).toFixed(1)} MB because photos and music are embedded. ` +
          'It may load slowly on phones and some messaging apps may refuse it. The ZIP export is recommended.'
      );
    }
    return { html, size, warnings, config: resolved };
  }

  // ZIP website
  const fontCss = fontFaceCss(families, (file) => `../fonts/${file}`);
  const files = [];
  const favicon = art ? '<link rel="icon" href="assets/images/favicon.svg" type="image/svg+xml">' : '';
  const html = [
    htmlOpen(resolved),
    '<head>',
    headTags(resolved, mode, favicon),
    '<link rel="stylesheet" href="assets/css/style.css">',
    '</head>',
    '<body>',
    '<div id="invitation"></div>',
    noscriptFallback(resolved),
    `<script type="application/json" id="invitation-config">\n${jsonForScript(resolved, 2)}\n</script>`,
    '<script src="assets/js/app.js"></script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
  files.push({ path: 'index.html', data: html });
  files.push({ path: 'assets/css/style.css', data: styleSheet(sources, templateId, fontCss) });
  files.push({ path: 'assets/js/app.js', data: appScript(sources, templateId) });
  if (art) files.push({ path: 'assets/images/favicon.svg', data: art.favicon(resolved.theme.colors) });
  files.push(...assetFiles);
  for (const family of families) {
    for (const f of FONT_FILES[family]) files.push({ path: `assets/fonts/${f.file}`, data: sources.fonts[f.file] });
    const lic = FONT_LICENSES[family];
    if (lic && sources.licenses?.[lic]) files.push({ path: `assets/fonts/${lic}`, data: sources.licenses[lic] });
  }
  files.push({ path: 'README.md', data: readme(resolved, files) });
  return { files, warnings, config: resolved };
}

// Every relative URL referenced by the exported HTML/CSS (used by tests and
// the export self-check).
export function referencedPaths(files) {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const refs = new Set();
  const html = byPath.get('index.html')?.data || '';
  for (const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) refs.add(m[1]);
  const cfg = /<script type="application\/json" id="invitation-config">([\s\S]*?)<\/script>/.exec(html);
  if (cfg) {
    const parsed = JSON.parse(cfg[1]);
    for (const a of Object.values(parsed.assets || {})) if (a?.src && !a.src.startsWith('data:')) refs.add(a.src);
  }
  const css = byPath.get('assets/css/style.css')?.data || '';
  for (const m of css.matchAll(/url\(([^)'"]+)\)/g)) {
    if (!m[1].startsWith('data:')) refs.add(resolveRelative('assets/css/', m[1]));
  }
  return [...refs];
}

function resolveRelative(base, rel) {
  const stack = base.split('/').filter(Boolean);
  for (const part of rel.split('/')) {
    if (part === '..') stack.pop();
    else if (part !== '.') stack.push(part);
  }
  return stack.join('/');
}

export function verifyZipFiles(files) {
  const present = new Set(files.map((f) => f.path));
  const missing = referencedPaths(files).filter((p) => !present.has(p));
  const absolute = files
    .filter((f) => /\.(html|css|js)$/.test(f.path) && typeof f.data === 'string')
    .filter((f) => /(?:src|href)="\/(?!\/)/.test(f.data));
  return { missing, absolute: absolute.map((f) => f.path) };
}

