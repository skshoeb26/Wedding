// Editor state: configuration, in-memory assets, undo/redo and drafts.

import { normalizeConfig } from './schema.js';
import { TEMPLATE_IDS } from './templates.js';
import { clone, setPath, getPath } from './util.js';

const DRAFT_KEY = 'wis:draft:v1';
const HISTORY_LIMIT = 100;

export class Store {
  constructor(config) {
    this.config = normalizeConfig(config, TEMPLATE_IDS);
    /** @type {Map<string, {bytes:Uint8Array, mime:string, name:string, size:number, dataUrl?:string}>} */
    this.assets = new Map();
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
    this.lastCoalesce = null;
    this.dirty = false;
    this.savedAt = null;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason) {
    for (const fn of this.listeners) fn(this.config, reason);
  }

  snapshot() {
    return JSON.stringify(this.config);
  }

  pushHistory(coalesceKey) {
    const now = Date.now();
    if (coalesceKey && this.lastCoalesce && this.lastCoalesce.key === coalesceKey && now - this.lastCoalesce.at < 1200) {
      this.lastCoalesce.at = now;
      return;
    }
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.lastCoalesce = coalesceKey ? { key: coalesceKey, at: now } : null;
  }

  get(path) {
    return getPath(this.config, path);
  }

  set(path, value) {
    if (JSON.stringify(getPath(this.config, path)) === JSON.stringify(value)) return;
    this.pushHistory(path);
    setPath(this.config, path, value);
    this.dirty = true;
    this.emit({ type: 'set', path });
  }

  // Structural change (add/remove list items, presets, template switch).
  update(mutator, reason = 'update') {
    this.pushHistory(null);
    mutator(this.config);
    this.config = normalizeConfig(this.config, TEMPLATE_IDS);
    this.dirty = true;
    this.emit({ type: reason, structural: true });
  }

  replace(config, reason = 'replace') {
    this.pushHistory(null);
    this.config = normalizeConfig(config, TEMPLATE_IDS);
    this.dirty = true;
    this.emit({ type: reason, structural: true });
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return;
    this.redoStack.push(this.snapshot());
    this.config = JSON.parse(this.undoStack.pop());
    this.lastCoalesce = null;
    this.dirty = true;
    this.emit({ type: 'undo', structural: true });
  }

  redo() {
    if (!this.canRedo()) return;
    this.undoStack.push(this.snapshot());
    this.config = JSON.parse(this.redoStack.pop());
    this.lastCoalesce = null;
    this.dirty = true;
    this.emit({ type: 'redo', structural: true });
  }

  addAsset(asset) {
    this.assets.set(asset.id, asset);
  }

  // Asset references in the config whose bytes are not in memory.
  missingAssets() {
    return Object.entries(this.config.assets)
      .filter(([, ref]) => ref && !this.assets.has(ref.id))
      .map(([slot, ref]) => ({ slot, ref }));
  }

  sessionOnlyAssets() {
    return Object.values(this.config.assets).filter((ref) => ref && this.assets.has(ref.id));
  }

  // ---- Drafts (configuration only; uploaded files stay in memory) --------
  saveDraft(storage = globalThis.localStorage) {
    try {
      const payload = { savedAt: new Date().toISOString(), config: clone(this.config) };
      storage.setItem(DRAFT_KEY, JSON.stringify(payload));
      this.dirty = false;
      this.savedAt = new Date(payload.savedAt);
      this.emit({ type: 'saved' });
      return true;
    } catch {
      return false;
    }
  }

  static loadDraft(storage = globalThis.localStorage) {
    try {
      const raw = storage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.config) return null;
      return { savedAt: new Date(parsed.savedAt), config: normalizeConfig(parsed.config, TEMPLATE_IDS) };
    } catch {
      return null;
    }
  }

  static clearDraft(storage = globalThis.localStorage) {
    try {
      storage.removeItem(DRAFT_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}
