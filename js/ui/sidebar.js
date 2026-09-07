/* Divergent V3 - sidebar permission renderer */
(function (window) {
  'use strict';

  function normalizeAccess(access, user) {
    if (window.DivergentPermissions) return window.DivergentPermissions.normalize(access, user);
    return access || {};
  }

  function setVisible(node, allowed) {
    if (!node) return;
    node.hidden = !allowed;
    node.style.display = allowed ? '' : 'none';
    node.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    node.dataset.permissionVisible = allowed ? '1' : '0';
  }

  function render(access, root, user) {
    const scope = root || document;
    const normalized = normalizeAccess(access, user);

    // V3-native markup.
    scope.querySelectorAll('[data-permission]').forEach((node) => {
      const key = String(node.getAttribute('data-permission') || '').trim();
      setVisible(node, !!normalized[key]);
    });

    // Temporary bridge while index.html is being split into modules.
    const config = window.DivergentSidebarConfigV3 && window.DivergentSidebarConfigV3.ITEMS;
    if (Array.isArray(config)) {
      for (const item of config) {
        const node = scope.getElementById ? scope.getElementById(item.id) : document.getElementById(item.id);
        if (!node) continue;
        setVisible(node, item.always === true ? true : !!normalized[item.key]);
      }
    }

    return normalized;
  }

  function renderFromAuth(root) {
    if (!window.DivergentAuthV3) return null;
    const state = window.DivergentAuthV3.getState();
    if (!state.confirmed) return render({}, root, null);
    return render(state.access, root, state.user);
  }

  function bind(root) {
    const scope = root || document;
    const apply = function (event) {
      const detail = event && event.detail ? event.detail : null;
      render(
        detail && detail.confirmed ? detail.access : {},
        scope,
        detail && detail.confirmed ? detail.user : null
      );
    };

    window.addEventListener('divergent:v3:auth', apply);
    renderFromAuth(scope);

    return function unbind() {
      window.removeEventListener('divergent:v3:auth', apply);
    };
  }

  window.DivergentSidebarV3 = Object.freeze({ render, renderFromAuth, bind });
})(window);
