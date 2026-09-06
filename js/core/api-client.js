/* Divergent V3 - shared API client */
(function (window) {
  'use strict';

  async function request(url, options) {
    options = options || {};
    const timeoutMs = Number(options.timeoutMs || 10000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = Object.assign({}, options.headers || {});
    if (options.json !== undefined) headers['Content-Type'] = 'application/json';
    if (options.token) headers.Authorization = 'Bearer ' + options.token;

    try {
      const response = await fetch(url, {
        method: options.method || (options.json !== undefined ? 'POST' : 'GET'),
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
        signal: controller.signal
      });

      const text = await response.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); }
        catch (_) { data = text; }
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
        headers: response.headers
      };
    } catch (error) {
      if (error && error.name === 'AbortError') {
        return { ok: false, status: 0, data: { error: 'TIMEOUT' }, error: 'TIMEOUT' };
      }
      return {
        ok: false,
        status: 0,
        data: { error: 'NETWORK_ERROR', detail: error && error.message ? error.message : String(error) },
        error: 'NETWORK_ERROR'
      };
    } finally {
      clearTimeout(timer);
    }
  }

  window.DivergentApi = Object.freeze({ request });
})(window);
