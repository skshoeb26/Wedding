/*
 * Wedding Invitation Studio — invitation bootstrap.
 *
 * In an exported site the configuration is read from the inline JSON
 * element with the id "invitation-config".
 * In the editor preview the configuration arrives through postMessage.
 */
(function (root) {
  'use strict';

  var core = root.InviteCore;
  var mount = document.getElementById('invitation');
  var music = core.createMusic();
  var instance = null;
  var currentTemplate = '';

  function pickTemplate(id) {
    var all = root.InviteTemplates || {};
    return all[id] || all[Object.keys(all)[0]];
  }

  function render(config, opts) {
    opts = opts || {};
    var template = pickTemplate(core.get(config, 'template', ''));
    if (!template) {
      mount.textContent = 'This invitation template could not be loaded.';
      return;
    }
    var id = core.get(config, 'template', '');
    var state = instance && currentTemplate === id && !opts.restart && instance.getState ? instance.getState() : null;
    if (instance && instance.destroy) instance.destroy();
    while (mount.firstChild) mount.removeChild(mount.firstChild);
    document.documentElement.lang = core.get(config, 'meta.lang', 'en');
    document.documentElement.dir = core.get(config, 'meta.dir', 'ltr') === 'rtl' ? 'rtl' : 'ltr';
    var volume = Number(core.get(config, 'invitation.music.volume', 0.7));
    music.setSource(core.get(config, 'assets.music.src', ''), isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.7);
    if (opts.restart) music.pause();
    currentTemplate = id;
    instance = template.create(mount, config, { core: core, music: music, state: state, preview: !!root.__WIS_PREVIEW__ });
  }

  function readConfig() {
    var node = document.getElementById('invitation-config');
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (e) {
      return null;
    }
  }

  if (root.__WIS_PREVIEW__) {
    root.addEventListener('message', function (event) {
      if (event.source !== root.parent) return;
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'wis:render' && data.config) render(data.config, { restart: !!data.restart });
      if (data.type === 'wis:goto' && instance && instance.goTo) instance.goTo(Number(data.page) || 0);
    });
    root.parent.postMessage({ type: 'wis:ready' }, '*');
  } else {
    var config = readConfig();
    if (config) render(config);
    else mount.textContent = 'The invitation configuration is missing or invalid.';
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
