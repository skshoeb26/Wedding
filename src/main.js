// Wedding Invitation Studio — editor controller.

import { createProjectFile, parseProjectFile, readUpload } from './assets.js';
import { buildSite, verifyZipFiles, SINGLE_FILE_LIMIT_BYTES } from './export/build.js';
import { loadBrowserSources, loadLibraryTrack } from './export/sources.js';
import { EditorForm } from './form.js';
import { Preview } from './preview.js';
import { ASSET_SLOTS, THEME_PRESETS, createDefaultConfig, normalizeConfig } from './schema.js';
import { Store } from './store.js';
import { TEMPLATES, TEMPLATE_IDS, getTemplate, switchTemplate } from './templates.js';
import { debounce, formatBytes, slug } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ui = {
  status: $('#save-status'),
  undo: $('#undo'),
  redo: $('#redo'),
  notices: $('#notices'),
  toast: $('#toast'),
  previewStage: $('#preview-stage'),
  previewHost: $('#preview-host'),
  exportDialog: $('#export-dialog'),
  exportMessages: $('#export-messages'),
  templateDialog: $('#template-dialog'),
  confirmDialog: $('#confirm-dialog')
};

let store;
let form;
let preview;
let sources;
let objectUrls = new Map();
let backupStale = false;
let storageOk = true;

// ---------------------------------------------------------------- helpers

function toast(message, ms = 3500) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { ui.toast.hidden = true; }, ms);
}

function message(kind, text) {
  const p = document.createElement('p');
  p.className = `msg msg-${kind}`;
  p.textContent = text;
  return p;
}

function confirmAction(title, text, okLabel = 'Continue') {
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#confirm-ok').textContent = okLabel;
  ui.confirmDialog.showModal();
  return new Promise((resolve) => {
    const done = (v) => {
      ui.confirmDialog.close();
      $('#confirm-ok').onclick = null;
      ui.confirmDialog.onclose = null;
      resolve(v);
    };
    $('#confirm-ok').onclick = () => done(true);
    ui.confirmDialog.onclose = () => resolve(false);
  });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function objectUrl(id) {
  if (!objectUrls.has(id)) {
    const a = store.assets.get(id);
    if (!a) return '';
    objectUrls.set(id, URL.createObjectURL(new Blob([a.bytes], { type: a.mime })));
  }
  return objectUrls.get(id);
}

function baseName() {
  const c = store.config.invitation.couple;
  return slug(`${c.partner1.name}-${c.partner2.name}`, 'wedding') + '-invitation';
}

// ---------------------------------------------------------------- status

const autosave = debounce(() => {
  storageOk = store.saveDraft();
  renderStatus();
}, 700);

function renderStatus() {
  ui.undo.disabled = !store.canUndo();
  ui.redo.disabled = !store.canRedo();
  let text;
  if (!storageOk) text = 'Draft not saved — browser storage is unavailable. Use “Save project backup”.';
  else if (store.dirty) text = 'Unsaved changes…';
  else if (store.savedAt) text = `Draft saved ${store.savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  else text = 'All changes saved';
  const files = store.sessionOnlyAssets().length;
  if (files && backupStale) text += ` · ${files} uploaded file${files > 1 ? 's' : ''} not backed up`;
  ui.status.textContent = text;
  ui.status.classList.toggle('is-dirty', store.dirty || !storageOk);
}

function renderNotices() {
  ui.notices.replaceChildren();
  const missing = store.missingAssets();
  if (missing.length) {
    const labels = missing.map(({ slot }) => ASSET_SLOTS[slot].label.toLowerCase()).join(', ');
    ui.notices.append(message('warn', `Your draft was restored. Browsers do not keep uploaded files, so please upload the ${labels} again or import your project backup.`));
  }
}

// ---------------------------------------------------------------- routing

function route() {
  const name = location.hash.replace(/^#\/?/, '') || (Store.loadDraft() ? 'editor' : 'templates');
  const view = name === 'editor' ? 'editor' : 'templates';
  $('#view-templates').hidden = view !== 'templates';
  $('#view-editor').hidden = view !== 'editor';
  $$('[data-editor-only]').forEach((n) => { n.hidden = view !== 'editor'; });
  $$('.app-nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.route === view ? 'page' : 'false'));
  document.body.dataset.view = view;
  if (view === 'editor' && preview && !preview.frame) preview.mount();
}

// ---------------------------------------------------------------- gallery

function renderGallery() {
  const grid = $('#template-grid');
  grid.replaceChildren(
    ...TEMPLATES.map((t) => {
      const card = document.createElement('article');
      card.className = 'template-card';
      const img = document.createElement('img');
      img.src = globalThis.InviteArt.dataUri(globalThis.InviteArt.thumbnail(THEME_PRESETS[t.preset]?.colors || store.config.theme.colors, t.thumbnailVariant));
      img.alt = `${t.name} template thumbnail`;
      img.width = 300;
      img.height = 400;
      const body = document.createElement('div');
      body.className = 'template-card-body';
      const h2 = document.createElement('h2');
      h2.textContent = t.name;
      const p = document.createElement('p');
      p.textContent = t.description;
      const ul = document.createElement('ul');
      ul.className = 'feature-list';
      t.features.forEach((f) => {
        const li = document.createElement('li');
        li.textContent = f;
        ul.append(li);
      });
      const row = document.createElement('div');
      row.className = 'button-row';
      const prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'btn btn-secondary';
      prev.textContent = 'Preview';
      prev.addEventListener('click', () => openTemplatePreview(t.id));
      const use = document.createElement('button');
      use.type = 'button';
      use.className = 'btn btn-primary';
      use.textContent = store.config.template === t.id ? 'Continue editing' : 'Use this template';
      use.addEventListener('click', () => useTemplate(t.id));
      row.append(prev, use);
      body.append(h2, p, ul, row);
      card.append(img, body);
      return card;
    })
  );
}

let dialogPreview = null;
let dialogTemplate = null;
function openTemplatePreview(id) {
  dialogTemplate = id;
  $('#template-dialog-title').textContent = `${getTemplate(id).name} — preview`;
  const sample = normalizeConfig(switchTemplate(createDefaultConfig(id), id), TEMPLATE_IDS);
  dialogPreview = new Preview($('#template-dialog-host'), { sources, getConfig: () => sample, getAsset: () => null });
  dialogPreview.mount();
  ui.templateDialog.showModal();
}

function useTemplate(id) {
  if (store.config.template !== id) store.update((c) => switchTemplate(c, id), 'template');
  location.hash = '#/editor';
}

// ---------------------------------------------------------------- uploads

async function onUpload(slot, file) {
  toast(`Reading “${file.name}”…`);
  try {
    const asset = await readUpload(file, slot);
    store.addAsset(asset);
    store.update((c) => {
      c.assets[slot] = { id: asset.id, name: asset.name, mime: asset.mime, size: asset.size };
      if (slot === 'couplePhoto') c.sections.photo = true;
    }, 'asset');
    backupStale = true;
    toast(`${ASSET_SLOTS[slot].label} added.${asset.notes.length ? ' ' + asset.notes.join(' ') : ''}`, 5000);
  } catch (err) {
    toast(err.message || 'This file could not be read.', 6000);
  }
}

// Built-in tones are fetched on demand and kept in memory like uploads.
async function ensureLibraryAssets() {
  const ref = store.config.assets.music;
  if (!ref || !ref.library || store.assets.has(ref.id)) return;
  try {
    const bytes = await loadLibraryTrack(ref.library);
    store.addAsset({ id: ref.id, name: ref.name, mime: 'audio/mpeg', size: bytes.length, bytes });
    preview.update();
    form.sync();
  } catch {
    toast('The selected tone could not be loaded. Check your connection and try again.');
  }
}

function onRemoveAsset(slot) {
  store.update((c) => { c.assets[slot] = null; }, 'asset');
  toast(`${ASSET_SLOTS[slot].label} removed. Use Undo to restore it.`);
}

// ---------------------------------------------------------------- export

function exportFormat() {
  return $('input[name="export-format"]:checked').value;
}

function openExport() {
  ui.exportMessages.replaceChildren();
  const missing = store.missingAssets();
  if (missing.length) {
    ui.exportMessages.append(message('warn', `${missing.map((m) => ASSET_SLOTS[m.slot].label).join(', ')} must be uploaded again before they can be included.`));
  }
  const assetBytes = store.sessionOnlyAssets().reduce((n, r) => n + (store.assets.get(r.id)?.size || 0), 0);
  ui.exportMessages.append(message('info', `Uploaded files: ${formatBytes(assetBytes)}. The invitation and fonts add roughly 0.5 MB.`));
  ui.exportDialog.showModal();
}

async function doExport() {
  const btn = $('#do-export');
  const format = exportFormat();
  btn.disabled = true;
  ui.exportMessages.replaceChildren(message('info', 'Preparing your website…'));
  try {
    const src = await loadBrowserSources();
    const config = normalizeConfig(store.config, TEMPLATE_IDS);
    if (format === 'single') {
      const result = buildSite({ config, assets: store.assets, sources: src, mode: 'single', art: globalThis.InviteArt });
      if (result.size > SINGLE_FILE_LIMIT_BYTES) {
        throw new Error(`The single file would be ${formatBytes(result.size)}, which is too large to open reliably. Please use the ZIP export or smaller files.`);
      }
      download(new Blob([result.html], { type: 'text/html;charset=utf-8' }), `${baseName()}.html`);
      ui.exportMessages.replaceChildren(
        message('ok', `Downloaded ${baseName()}.html (${formatBytes(result.size)}). Open it in any browser — it needs no internet connection.`),
        ...result.warnings.map((w) => message('warn', w))
      );
    } else {
      if (typeof globalThis.JSZip !== 'function') throw new Error('The ZIP library did not load. Please reload the page and try again.');
      const result = buildSite({ config, assets: store.assets, sources: src, mode: 'zip', art: globalThis.InviteArt });
      const check = verifyZipFiles(result.files);
      if (check.missing.length || check.absolute.length) {
        throw new Error(`Packaging check failed: missing ${check.missing.join(', ') || 'none'}; absolute paths in ${check.absolute.join(', ') || 'none'}.`);
      }
      const zip = new globalThis.JSZip();
      const folder = zip.folder(baseName());
      for (const f of result.files) folder.file(f.path, f.data, { binary: typeof f.data !== 'string' });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, (meta) => {
        btn.textContent = `Packaging ${Math.round(meta.percent)}%`;
      });
      download(blob, `${baseName()}.zip`);
      ui.exportMessages.replaceChildren(
        message('ok', `Downloaded ${baseName()}.zip (${formatBytes(blob.size)}, ${result.files.length} files). All file references were checked. Extract it and upload the folder to your static host — see README.md inside.`),
        ...result.warnings.map((w) => message('warn', w))
      );
    }
  } catch (err) {
    console.error(err);
    ui.exportMessages.replaceChildren(message('error', `Export failed: ${err.message || err}`));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download';
  }
}

// ---------------------------------------------------------------- backup

function saveProject() {
  const text = createProjectFile(store.config, store.assets);
  download(new Blob([text], { type: 'application/json' }), `${baseName()}-project.json`);
  backupStale = false;
  renderStatus();
  toast('Project backup saved. Import it later to continue editing.');
}

async function importProject(file) {
  try {
    const { config, assets, warnings } = parseProjectFile(await file.text());
    if (!(await confirmAction('Import this backup?', 'Your current invitation will be replaced. You can undo this.', 'Import'))) return;
    for (const [id, a] of assets) store.addAsset(a);
    store.replace(config, 'import');
    backupStale = false;
    form.sync();
    renderNotices();
    toast(warnings.length ? `Imported with notes: ${warnings.join(' ')}` : 'Backup imported.', 6000);
  } catch (err) {
    toast(err.message || 'This backup could not be imported.', 6000);
  }
}

// ---------------------------------------------------------------- preview UI

function setViewport(v) {
  ui.previewStage.dataset.viewport = v;
  $$('[data-viewport]', $('.preview-toolbar')).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.viewport === v)));
  fitDevice();
}

function fitDevice() {
  const device = $('#preview-device');
  if (ui.previewStage.dataset.viewport !== 'mobile') {
    device.style.removeProperty('--scale');
    return;
  }
  const r = ui.previewStage.getBoundingClientRect();
  const scale = Math.min(1, (r.height - 28) / 868, (r.width - 28) / 414);
  device.style.setProperty('--scale', String(Math.max(0.4, scale)));
}

function openInNewTab() {
  const config = normalizeConfig(store.config, TEMPLATE_IDS);
  const { html } = buildSite({ config, assets: store.assets, sources, mode: 'single', art: globalThis.InviteArt });
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function setMobileTab(tab) {
  document.body.dataset.tab = tab;
  $('#tab-edit').setAttribute('aria-selected', String(tab === 'edit'));
  $('#tab-preview').setAttribute('aria-selected', String(tab === 'preview'));
  if (tab === 'preview') fitDevice();
}

// ---------------------------------------------------------------- init

async function init() {
  const draft = Store.loadDraft();
  store = new Store(draft ? draft.config : createDefaultConfig());
  if (draft) store.savedAt = draft.savedAt;

  try {
    sources = await loadBrowserSources();
  } catch (err) {
    document.body.prepend(message('error', `The editor could not load its template files (${err.message}). If you opened index.html directly from disk, run it from a local web server instead — see README.md.`));
    throw err;
  }

  $('#editor-form').addEventListener('submit', (e) => e.preventDefault());
  form = new EditorForm($('#editor-form'), store, { onUpload, onRemoveAsset, toast, objectUrl });
  preview = new Preview(ui.previewHost, { sources, getConfig: () => store.config, getAsset: (id) => store.assets.get(id) });

  store.subscribe((config, reason) => {
    form.sync();
    preview.update();
    ensureLibraryAssets();
    if (reason.type !== 'saved') autosave();
    if (reason.type === 'asset' || reason.type === 'import' || reason.type === 'undo' || reason.type === 'redo' || reason.type === 'replace') renderNotices();
    if (reason.type === 'template' || reason.type === 'preset') renderGallery();
    renderStatus();
  });

  ensureLibraryAssets();
  renderGallery();
  renderNotices();
  renderStatus();

  ui.undo.addEventListener('click', () => store.undo());
  ui.redo.addEventListener('click', () => store.redo());
  $('#open-export').addEventListener('click', openExport);
  $('#do-export').addEventListener('click', doExport);
  $('#save-project').addEventListener('click', saveProject);
  $('#import-project').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importProject(file);
  });
  $('#reset-sample').addEventListener('click', async () => {
    if (!(await confirmAction('Reset to sample content?', 'All fields return to the sample invitation. You can undo this.', 'Reset'))) return;
    store.replace(createDefaultConfig(store.config.template), 'replace');
    toast('Sample content restored. Use Undo to go back.');
  });
  $('#clear-draft').addEventListener('click', async () => {
    if (!(await confirmAction('Clear the saved draft?', 'The draft stored in this browser is deleted. The editor keeps its current content until you reload.', 'Clear draft'))) return;
    autosave.cancel();
    Store.clearDraft();
    store.savedAt = null;
    toast('Saved draft cleared from this browser.');
    renderStatus();
  });
  $('#restart-preview').addEventListener('click', () => preview.restart());
  $('#open-tab').addEventListener('click', openInNewTab);
  $$('[data-viewport]', $('.preview-toolbar')).forEach((b) => b.addEventListener('click', () => setViewport(b.dataset.viewport)));
  $('#tab-edit').addEventListener('click', () => setMobileTab('edit'));
  $('#tab-preview').addEventListener('click', () => setMobileTab('preview'));
  $('#template-dialog-use').addEventListener('click', () => {
    ui.templateDialog.close();
    useTemplate(dialogTemplate);
  });
  ui.templateDialog.addEventListener('close', () => {
    $('#template-dialog-host').replaceChildren();
    dialogPreview = null;
  });
  $$('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'color', 'file'].includes(t.type)))) return;
    if (document.body.dataset.view !== 'editor') return;
    e.preventDefault();
    if (e.key.toLowerCase() === 'y' || e.shiftKey) store.redo();
    else store.undo();
  });

  window.addEventListener('beforeunload', (e) => {
    autosave.flush();
    if (backupStale && store.sessionOnlyAssets().length) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  window.addEventListener('resize', fitDevice);
  new ResizeObserver(fitDevice).observe(ui.previewStage);
  window.addEventListener('hashchange', route);
  setMobileTab('edit');
  setViewport(window.matchMedia('(min-width: 1500px), (max-width: 900px)').matches ? 'desktop' : 'mobile');
  route();
  document.body.classList.add('is-ready');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
