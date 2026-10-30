// Live preview. The invitation runs in a sandboxed iframe (scripts only, no
// same-origin access) built from the same sources as the export. Updates
// are sent with postMessage so the current page is kept while editing.

import { buildSite } from './export/build.js';
import { ASSET_SLOTS, stripAssetSources } from './schema.js';
import { bytesToDataUrl } from './util.js';

export class Preview {
  constructor(frameHost, { sources, getConfig, getAsset }) {
    this.host = frameHost;
    this.sources = sources;
    this.getConfig = getConfig;
    this.getAsset = getAsset;
    this.frame = null;
    this.ready = false;
    this.templateId = null;
    this.pending = null;
    this.dataUrls = new Map();
    this.onMessage = this.onMessage.bind(this);
    window.addEventListener('message', this.onMessage);
  }

  mount() {
    const config = this.getConfig();
    this.templateId = config.template;
    this.ready = false;
    const { html } = buildSite({ config, sources: this.sources, mode: 'preview' });
    const frame = document.createElement('iframe');
    frame.title = 'Invitation preview';
    frame.className = 'preview-frame';
    // No allow-same-origin: the preview cannot reach the editor or its storage.
    frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
    frame.setAttribute('allow', 'autoplay');
    frame.srcdoc = html;
    this.host.replaceChildren(frame);
    this.frame = frame;
  }

  onMessage(event) {
    if (!this.frame || event.source !== this.frame.contentWindow) return;
    if (event.data?.type === 'wis:ready') {
      this.ready = true;
      this.send(true);
    }
  }

  resolvedConfig() {
    const config = stripAssetSources(this.getConfig());
    for (const slot of Object.keys(ASSET_SLOTS)) {
      const ref = config.assets[slot];
      if (!ref) continue;
      const asset = this.getAsset(ref.id);
      if (!asset) {
        config.assets[slot] = null;
        continue;
      }
      if (!this.dataUrls.has(ref.id)) this.dataUrls.set(ref.id, bytesToDataUrl(asset.bytes, asset.mime));
      config.assets[slot] = { ...ref, src: this.dataUrls.get(ref.id) };
    }
    return config;
  }

  send(restart = false) {
    if (!this.ready || !this.frame?.contentWindow) return;
    this.frame.contentWindow.postMessage({ type: 'wis:render', config: this.resolvedConfig(), restart }, '*');
  }

  // Called on every change; batches to one render per animation frame.
  update() {
    if (this.getConfig().template !== this.templateId) {
      this.mount();
      return;
    }
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = null;
      this.send(false);
    });
  }

  restart() {
    this.send(true);
  }
}
