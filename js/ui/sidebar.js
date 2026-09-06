/* Divergent V3 - sidebar permission renderer */
(function (window) {
  'use strict';

  function normalizeAccess(access) {
    if (window.DivergentPermissions) return window.DivergentPermissions.normalize(access);
    return access || {};
  }

  function render(access, root) {
    const scope = root || document;
    const normalized = normalizeAccess(access);
    const nodes = scope.querySelectorAll('[data-permission]');

    nodes.forEach((node) => {
      const key = String(node.getAttribute('data-permission') || '').trim();
      const allowed = !!normalized[key];
      node.hidden = !allowed;
      node.setAttribute('aria-hidden', allowed ? 'false' : 'true');
      node.dataset.permissionVisible = allowed ? '1' : '0';
    });

    return normalized;
  }

  function renderFromAuth(root) {
    if (!window.DivergentAuthV3) return null;
    const state = window.DivergentAuthV3.getState();
    if (!state.confirmed) return render({}, root);
    return render(state.access, root);
  }

  function bind(root) {
    const scope = root || document;
    const apply = function (event) {
      const detail = event && event.detail ? event.detail : null;
      render(detail && detail.confirmed ? detail.access : {}, scope);
    };

    window.addEventListener('divergent:v3:auth', apply);
    renderFromAuth(scope);

    return function unbind() {
      window.removeEventListener('divergent:v3:auth', apply);
    };
  }

  window.DivergentSidebarV3 = Object.freeze({ render, renderFromAuth, bind });
})(window);
