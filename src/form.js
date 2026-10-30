// Renders the editor form from FORM (form-spec.js) and keeps it in sync with
// the store. All values are written with DOM properties, never as HTML.

import { FORM } from './form-spec.js';
import { ASSET_SLOTS, THEME_PRESETS, newEvent } from './schema.js';
import { TEMPLATES } from './templates.js';
import { formatBytes, getPath } from './util.js';

const Core = globalThis.InviteCore;

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'className') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

let idCounter = 0;
const nextId = (p) => `f-${p.replace(/[^a-z0-9]+/gi, '-')}-${++idCounter}`;

export class EditorForm {
  constructor(root, store, ctx) {
    this.root = root;
    this.store = store;
    this.ctx = ctx; // { onUpload(slot, file), onRemoveAsset(slot), toast(msg) }
    this.bindings = [];
    this.conditionals = [];
    this.lists = [];
    this.render();
  }

  render() {
    const openState = new Map([...this.root.querySelectorAll('details[data-section]')].map((d) => [d.dataset.section, d.open]));
    this.bindings = [];
    this.conditionals = [];
    this.lists = [];
    this.root.replaceChildren(
      ...FORM.map((section) => {
        const details = h('details', { className: 'form-section', 'data-section': section.id });
        details.open = openState.has(section.id) ? openState.get(section.id) : !!section.open;
        details.append(h('summary', {}, h('span', { text: section.title })));
        const body = h('div', { className: 'form-body' });
        section.fields.forEach((f) => body.append(this.field(f, '')));
        details.append(body);
        return details;
      })
    );
    this.sync();
  }

  conditional(node, field, prefix) {
    if (field.showIf) this.conditionals.push({ node, field, prefix });
    return node;
  }

  field(f, prefix) {
    const path = f.path ? prefix + f.path : null;
    switch (f.type) {
      case 'group':
        return this.conditional(
          h('fieldset', { className: `field-group ${f.className || ''}` }, h('legend', { text: f.label }), f.fields.map((x) => this.field(x, prefix))),
          f,
          prefix
        );
      case 'list':
        return this.conditional(this.list(f, path), f, prefix);
      case 'template':
        return this.templatePicker(f, path);
      case 'preset':
        return this.presetPicker(f);
      case 'asset':
        return this.conditional(this.assetField(f), f, prefix);
      case 'action':
        return this.conditional(
          h('button', { type: 'button', className: 'btn btn-ghost btn-small', text: f.label, onclick: () => this.action(f.action) }),
          f,
          prefix
        );
      default:
        return this.conditional(this.input(f, path), f, prefix);
    }
  }

  input(f, path) {
    const id = nextId(path);
    const hint = f.hint ? h('p', { className: 'hint', id: `${id}-hint`, text: f.hint }) : null;
    const msg = h('p', { className: 'field-msg', id: `${id}-msg`, 'aria-live': 'polite' });
    let control;
    let wrapClass = 'field';
    const describedBy = [hint && `${id}-hint`, `${id}-msg`].filter(Boolean).join(' ');

    if (f.type === 'toggle') {
      control = h('input', { type: 'checkbox', id, role: 'switch', 'aria-describedby': describedBy });
      control.addEventListener('change', () => this.store.set(path, control.checked));
      wrapClass = 'field field-toggle';
      const node = h('div', { className: wrapClass }, h('label', { for: id }, control, h('span', { className: 'switch', 'aria-hidden': 'true' }), h('span', { text: f.label })), hint, msg);
      this.bindings.push({ path, control, f, msg });
      return node;
    }

    if (f.type === 'textarea') {
      control = h('textarea', { id, rows: f.rows || 3, maxlength: f.maxLength, dir: f.dir || 'auto', placeholder: f.placeholder, 'aria-describedby': describedBy });
    } else if (f.type === 'select') {
      control = h('select', { id, 'aria-describedby': describedBy }, f.options.map((o) => h('option', { value: o.value, text: o.label })));
    } else if (f.type === 'range') {
      control = h('input', { type: 'range', id, min: f.min, max: f.max, step: f.step, 'aria-describedby': describedBy });
    } else if (f.type === 'color') {
      control = h('input', { type: 'color', id, 'aria-describedby': describedBy });
      wrapClass = 'field field-color';
    } else {
      const typeMap = { text: 'text', url: 'url', tel: 'tel', date: 'date', time: 'time', datetime: 'datetime-local', hijri: 'text' };
      control = h('input', {
        type: typeMap[f.type] || 'text', id, maxlength: f.maxLength, placeholder: f.placeholder,
        dir: f.dir || (f.type === 'text' || f.type === 'hijri' ? 'auto' : null),
        inputmode: f.type === 'tel' ? 'tel' : null, autocomplete: 'off', spellcheck: f.type === 'url' ? 'false' : null,
        'aria-describedby': describedBy
      });
    }

    const output = f.type === 'range' ? h('output', { for: id, className: 'range-value' }) : null;
    const label = h('label', { for: id, className: 'label' }, h('span', { text: f.label }), output);
    const node = h('div', { className: wrapClass }, label, control, hint, msg);

    const read = () => {
      if (f.type === 'range') return Number(control.value);
      return control.value;
    };
    const evt = f.type === 'select' || f.type === 'color' ? 'change' : 'input';
    control.addEventListener(evt, () => {
      this.store.set(path, read());
      this.validate({ path, control, f, msg });
    });
    if (f.type === 'color') control.addEventListener('input', () => this.store.set(path, read()));
    this.bindings.push({ path, control, f, msg, output });
    return node;
  }

  validate(b) {
    const v = String(b.control.value || '').trim();
    let text = '';
    if (b.f.type === 'url' && v && !/^https?:\/\/[^\s]+$/i.test(v)) text = 'Please enter a full link starting with https://';
    if (b.f.type === 'tel' && v && !Core.telHref(v)) text = 'This does not look like a phone number.';
    b.msg.textContent = text;
    b.control.setAttribute('aria-invalid', text ? 'true' : 'false');
  }

  templatePicker(f, path) {
    const name = nextId('template');
    const wrap = h('div', { className: 'template-picker', role: 'radiogroup', 'aria-label': f.label });
    for (const t of TEMPLATES) {
      const id = nextId(t.id);
      const radio = h('input', { type: 'radio', name, id, value: t.id });
      radio.addEventListener('change', () => radio.checked && this.store.update((c) => { c.template = t.id; }, 'template'));
      wrap.append(h('label', { for: id, className: 'template-option' }, radio, h('span', { className: 'template-option-name', text: t.name }), h('span', { className: 'hint', text: t.tagline })));
      this.bindings.push({ path, control: radio, f: { type: 'radio' } });
    }
    return h('div', { className: 'field' }, h('p', { className: 'label', text: f.label }), wrap);
  }

  presetPicker(f) {
    const id = nextId('preset');
    const select = h('select', { id }, h('option', { value: 'custom', text: 'Custom colours' }), f.options.map((o) => h('option', { value: o.value, text: o.label })));
    select.addEventListener('change', () => {
      const preset = THEME_PRESETS[select.value];
      if (!preset) return;
      this.store.update((c) => {
        c.theme.preset = select.value;
        c.theme.colors = { ...preset.colors };
      }, 'preset');
    });
    this.presetSelect = select;
    const swatches = h('div', { className: 'preset-swatches' }, Object.entries(THEME_PRESETS).map(([key, p]) =>
      h('button', {
        type: 'button', className: 'swatch', title: p.name, 'aria-label': `Use ${p.name} palette`,
        style: `--a:${p.colors.primary};--b:${p.colors.rose};--c:${p.colors.accent}`,
        onclick: () => { select.value = key; select.dispatchEvent(new Event('change')); }
      })));
    return h('div', { className: 'field' }, h('label', { for: id, className: 'label', text: f.label }), select, swatches);
  }

  assetField(f) {
    const def = ASSET_SLOTS[f.slot];
    const id = nextId(f.slot);
    const input = h('input', { type: 'file', id, accept: f.accept, className: 'visually-hidden' });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) this.ctx.onUpload(f.slot, file);
    });
    const info = h('div', { className: 'asset-info' });
    const remove = h('button', { type: 'button', className: 'btn btn-ghost btn-small', text: 'Remove', onclick: () => this.ctx.onRemoveAsset(f.slot) });
    const pick = h('label', { for: id, className: 'btn btn-secondary btn-small' }, 'Choose file…');
    const drop = h('div', { className: 'asset-drop' }, info, h('div', { className: 'asset-actions' }, pick, remove));
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-drag'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-drag');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.ctx.onUpload(f.slot, file);
    });
    this.bindings.push({ asset: f.slot, info, remove, def });
    return h('div', { className: 'field field-asset' }, h('p', { className: 'label', text: f.label }), drop, input, f.hint ? h('p', { className: 'hint', text: f.hint }) : null);
  }

  list(f, path) {
    const wrap = h('div', { className: 'list-field' });
    this.lists.push({ f, path, wrap, length: -1 });
    return wrap;
  }

  renderList(entry) {
    const { f, path, wrap } = entry;
    const items = getPath(this.store.config, path) || [];
    const grew = entry.length >= 0 && items.length > entry.length;
    entry.length = items.length;
    const openItems = new Set([...wrap.querySelectorAll('details[data-index]')].filter((d) => d.open).map((d) => d.dataset.index));
    // Remove old bindings that belong to this list.
    this.bindings = this.bindings.filter((b) => !b.path || !b.path.startsWith(`${path}.`));
    this.conditionals = this.conditionals.filter((c) => !c.prefix.startsWith(`${path}.`));
    wrap.replaceChildren();
    items.forEach((item, i) => {
      const prefix = `${path}.${i}.`;
      const title = h('span', { className: 'list-item-title', text: f.itemTitle(item, i) });
      const details = h('details', { className: 'list-item', 'data-index': String(i) });
      details.open = (grew && i === items.length - 1) || (openItems.size ? openItems.has(String(i)) : f.newItem === 'contact' || i === 0);
      const tools = h('div', { className: 'list-tools' },
        h('button', { type: 'button', className: 'btn btn-ghost btn-small', text: 'Move up', disabled: i === 0, onclick: () => this.move(path, i, -1) }),
        h('button', { type: 'button', className: 'btn btn-ghost btn-small', text: 'Move down', disabled: i === items.length - 1, onclick: () => this.move(path, i, 1) }),
        h('button', { type: 'button', className: 'btn btn-danger btn-small', text: 'Remove', disabled: items.length <= f.min, onclick: () => this.removeItem(path, i) }));
      details.append(h('summary', {}, title), h('div', { className: 'form-body' }, f.fields.map((x) => this.field(x, prefix)), tools));
      details.titleNode = title;
      details.item = { f, index: i, path };
      wrap.append(details);
    });
    if (items.length < f.max) {
      wrap.append(h('button', { type: 'button', className: 'btn btn-secondary btn-small', text: `+ ${f.addLabel}`, onclick: () => this.addItem(path, f) }));
    }
  }

  addItem(path, f) {
    this.store.update((c) => {
      const list = getPath(c, path);
      list.push(f.newItem === 'event' ? newEvent(list.length) : { name: '', phone: '' });
    }, 'list');
  }

  removeItem(path, i) {
    this.store.update((c) => getPath(c, path).splice(i, 1), 'list');
    this.ctx.toast('Removed. Use Undo to bring it back.');
  }

  move(path, i, dir) {
    this.store.update((c) => {
      const list = getPath(c, path);
      const [it] = list.splice(i, 1);
      list.splice(i + dir, 0, it);
    }, 'list');
  }

  action(name) {
    if (name === 'countdownFromEvent') {
      const ev = this.store.config.invitation.events.find((e) => e.enabled && e.date);
      if (!ev) {
        this.ctx.toast('Add a date to an event first.');
        return;
      }
      this.store.set('invitation.countdown.target', `${ev.date}T${ev.time || '00:00'}`);
      this.sync();
    }
  }

  // Push store values into the controls (after undo, import, reset...).
  sync() {
    const c = this.store.config;
    for (const entry of this.lists) {
      const len = (getPath(c, entry.path) || []).length;
      if (len !== entry.length || entry.dirty) this.renderList(entry);
      entry.dirty = false;
    }
    for (const b of this.bindings) {
      if (b.asset) {
        this.syncAsset(b);
        continue;
      }
      const value = getPath(c, b.path);
      const ctl = b.control;
      if (b.f.type === 'radio') ctl.checked = ctl.value === value;
      else if (b.f.type === 'toggle') ctl.checked = value !== false;
      else if (document.activeElement !== ctl || b.f.type === 'range') {
        const v = value ?? '';
        if (ctl.value !== String(v)) ctl.value = v;
      }
      if (b.output) b.output.textContent = b.f.format ? b.f.format(Number(ctl.value)) : ctl.value;
      if (b.f.type === 'hijri') this.syncHijri(b);
      if (b.msg && (b.f.type === 'url' || b.f.type === 'tel')) this.validate(b);
    }
    for (const { node, field, prefix } of this.conditionals) {
      const scope = prefix ? getPath(c, prefix.slice(0, -1)) : c;
      node.hidden = !field.showIf(prefix ? c : scope, scope);
    }
    // List item titles
    for (const d of this.root.querySelectorAll('details.list-item')) {
      const { f, index, path } = d.item || {};
      if (!f) continue;
      const item = getPath(c, `${path}.${index}`);
      if (item) d.titleNode.textContent = f.itemTitle(item, index) + (item.enabled === false ? ' (hidden)' : '');
    }
    if (this.presetSelect) {
      const match = Object.entries(THEME_PRESETS).find(([, p]) => Object.entries(p.colors).every(([k, v]) => c.theme.colors[k]?.toLowerCase() === v));
      this.presetSelect.value = match ? match[0] : 'custom';
    }
  }

  syncHijri(b) {
    const prefix = b.path.slice(0, -'hijriDate'.length);
    const ev = getPath(this.store.config, prefix.slice(0, -1));
    const auto = ev?.hijriAuto !== false;
    b.control.readOnly = auto;
    b.control.classList.toggle('is-computed', auto);
    if (auto) {
      const lang = this.store.config.meta.lang;
      const computed = Core.hijriDate(ev?.date, lang);
      b.control.value = computed || '';
      b.control.placeholder = !ev?.date ? 'Choose a date first' : computed ? '' : 'Not supported by this browser — type it instead';
    } else if (document.activeElement !== b.control) {
      b.control.value = ev?.hijriDate || '';
      b.control.placeholder = b.f.placeholder;
    }
  }

  syncAsset(b) {
    const ref = this.store.config.assets[b.asset];
    const loaded = ref && this.store.assets.get(ref.id);
    b.info.replaceChildren();
    if (!ref) {
      b.info.append(h('span', { className: 'asset-empty', text: b.def.kind === 'image' ? 'No image — drop one here' : 'No music — drop a file here' }));
    } else if (!loaded) {
      b.info.append(h('span', { className: 'asset-missing', text: `“${ref.name}” needs to be uploaded again (files are not kept in browser storage).` }));
    } else {
      if (b.def.kind === 'image') {
        const url = this.ctx.objectUrl(ref.id);
        b.info.append(h('img', { src: url, alt: '', className: 'asset-thumb' }));
      } else {
        const audio = h('audio', { controls: true, src: this.ctx.objectUrl(ref.id), preload: 'none', className: 'asset-audio' });
        b.info.append(audio);
      }
      b.info.append(h('span', { className: 'asset-name', text: `${ref.name} · ${formatBytes(loaded.size)}` }));
    }
    b.remove.hidden = !ref;
  }
}
