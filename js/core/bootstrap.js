/* Divergent V3 - application bootstrap */
(function (window) {
  'use strict';

  let started = false;
  let sidebarUnbind = null;

  async function start(options) {
    if (started) return window.DivergentAuthV3 ? window.DivergentAuthV3.getState() : null;
    started = true;
    options = options || {};

    if (!window.DivergentPermissions) throw new Error('PERMISSIONS_NOT_LOADED');
    if (!window.DivergentApi) throw new Error('API_CLIENT_NOT_LOADED');
    if (!window.DivergentAuthV3) throw new Error('AUTH_V3_NOT_LOADED');

    if (window.DivergentSidebarV3) {
      sidebarUnbind = window.DivergentSidebarV3.bind(options.sidebarRoot || document);
    }

    const state = await window.DivergentAuthV3.refresh();
    if (window.DivergentLegacyMenuBridge) {
      window.DivergentLegacyMenuBridge.apply(state);
    }

    if (window.DivergentEvents) {
      window.DivergentEvents.emit('app:ready', state);
    }

    return state;
  }

  function stop() {
    if (typeof sidebarUnbind === 'function') sidebarUnbind();
    sidebarUnbind = null;
    started = false;
  }

  window.DivergentBootstrapV3 = Object.freeze({ start, stop });
})(window);
